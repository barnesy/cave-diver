import {
  del,
  get,
  head,
  list,
  put,
  BlobAccessError,
  BlobNotFoundError,
  BlobPreconditionFailedError,
} from '@vercel/blob';
import {
  isUpstashConfigured,
  kvDeletePath,
  kvListPaths,
  kvReadJson,
  kvWriteJson,
} from './_kvStore.js';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

export const NO_BLOB_MUTATION = Symbol('NO_BLOB_MUTATION');

let cachedBlobAccess = null;

function isNotFoundBlobError(err) {
  return Boolean(
    err instanceof BlobNotFoundError ||
      err?.name === 'BlobNotFoundError' ||
      err?.status === 404 ||
      String(err?.message || '').toLowerCase().includes('does not exist') ||
      String(err?.message || '').toLowerCase().includes('404')
  );
}

function isConflictBlobError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return Boolean(
    err instanceof BlobPreconditionFailedError ||
      err?.name === 'BlobPreconditionFailedError' ||
      err?.status === 412 ||
      err?.status === 409 ||
      msg.includes('precondition') ||
      msg.includes('already exists') ||
      msg.includes('if-match')
  );
}

function isAccessMismatchError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return Boolean(
    err instanceof BlobAccessError ||
      err?.name === 'BlobAccessError' ||
      err?.status === 403 ||
      msg.includes('403') ||
      msg.includes('forbidden') ||
      msg.includes('private') ||
      msg.includes('public')
  );
}

async function detectStoreAccess() {
  const envAccess = process.env.BLOB_ACCESS;
  if (envAccess === 'public' || envAccess === 'private') {
    cachedBlobAccess = envAccess;
    return envAccess;
  }
  if (cachedBlobAccess) return cachedBlobAccess;
  try {
    const res = await list({ limit: 1 });
    const sampleUrl = res?.blobs?.[0]?.url || '';
    if (sampleUrl.includes('.public.blob.')) {
      cachedBlobAccess = 'public';
      return 'public';
    }
    if (sampleUrl.includes('.private.blob.')) {
      cachedBlobAccess = 'private';
      return 'private';
    }
  } catch {
    // Fall through to trial read/write
  }
  return 'private';
}

export async function readBlobEtag(pathname) {
  try {
    const meta = await head(pathname);
    return meta?.etag || null;
  } catch (err) {
    if (isNotFoundBlobError(err)) {
      return null;
    }
    throw err;
  }
}

async function fetchPublicBlobUrl(url, fallbackValue, etag = null) {
  const bust = new URL(url);
  bust.searchParams.set('_ts', String(Date.now()));
  const res = await fetch(bust.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  if (res.status === 404) {
    return { data: fallbackValue, etag: null, notFound: true };
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Public blob fetch failed with status ${res.status}`), {
      status: res.status,
    });
  }
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : fallbackValue;
  return {
    data: parsed ?? fallbackValue,
    etag: etag || res.headers.get('etag') || null,
    notFound: false,
  };
}

async function readBlobWithAccess(urlOrPathname, fallbackValue, access, extraOpts = {}) {
  const opts =
    access === 'public'
      ? { access: 'public', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }, ...extraOpts }
      : { access: 'private', useCache: false, ...extraOpts };

  const res = await get(urlOrPathname, opts);
  if (!res || res.statusCode === 404) {
    return { data: fallbackValue, etag: null, notFound: true };
  }
  if (res.statusCode !== 200 || !res.stream) {
    throw Object.assign(new Error(`Blob read failed with status ${res.statusCode}`), {
      status: res.statusCode,
    });
  }
  const text = await new Response(res.stream).text();
  const parsed = text ? JSON.parse(text) : fallbackValue;
  return {
    data: parsed ?? fallbackValue,
    etag: res.blob?.etag || null,
    notFound: false,
  };
}

export async function readBlobJson(pathname, fallbackValue = null) {
  if (isUpstashConfigured()) {
    return kvReadJson(pathname, fallbackValue);
  }
  // Authoritative lookup via head() avoids 403s on missing blobs & reveals exact public vs private URL
  let meta = null;
  try {
    meta = await head(pathname);
  } catch (err) {
    if (isNotFoundBlobError(err)) {
      return { data: fallbackValue, etag: null, notFound: true };
    }
    // Fall through to direct get() if head() failed for a non-404 reason
  }

  if (meta?.url) {
    if (meta.url.includes('.public.blob.')) {
      cachedBlobAccess = 'public';
      return fetchPublicBlobUrl(meta.url, fallbackValue, meta.etag || null);
    }
    if (meta.url.includes('.private.blob.')) {
      cachedBlobAccess = 'private';
      try {
        return await readBlobWithAccess(meta.url, fallbackValue, 'private');
      } catch (err) {
        if (isNotFoundBlobError(err)) {
          return { data: fallbackValue, etag: null, notFound: true };
        }
        const rwToken = process.env.BLOB_READ_WRITE_TOKEN;
        if (rwToken && isAccessMismatchError(err)) {
          return readBlobWithAccess(meta.url, fallbackValue, 'private', { token: rwToken });
        }
        throw err;
      }
    }
  }

  const primaryAccess = await detectStoreAccess();
  try {
    const out = await readBlobWithAccess(pathname, fallbackValue, primaryAccess);
    cachedBlobAccess = primaryAccess;
    return out;
  } catch (err) {
    if (isNotFoundBlobError(err)) {
      cachedBlobAccess = primaryAccess;
      return { data: fallbackValue, etag: null, notFound: true };
    }
    if (!isAccessMismatchError(err)) {
      throw err;
    }
    const altAccess = primaryAccess === 'private' ? 'public' : 'private';
    try {
      const altOut = await readBlobWithAccess(pathname, fallbackValue, altAccess);
      cachedBlobAccess = altAccess;
      return altOut;
    } catch (altErr) {
      if (isNotFoundBlobError(altErr)) {
        cachedBlobAccess = altAccess;
        return { data: fallbackValue, etag: null, notFound: true };
      }
      throw altErr;
    }
  }
}

export async function writeBlobJson(pathname, data, { ifMatch = null, allowOverwrite = true, ttlSec = 0 } = {}) {
  if (isUpstashConfigured()) {
    return kvWriteJson(pathname, data, { ttlSec });
  }
  const payload = JSON.stringify(data);
  const buildOpts = (access) => {
    const opts = {
      access,
      contentType: 'application/json',
      allowOverwrite,
      addRandomSuffix: false,
    };
    if (access === 'public') {
      opts.cacheControlMaxAge = 0;
    }
    if (ifMatch) {
      opts.ifMatch = ifMatch;
    }
    return opts;
  };

  const primaryAccess = await detectStoreAccess();
  try {
    const res = await put(pathname, payload, buildOpts(primaryAccess));
    cachedBlobAccess = primaryAccess;
    return res;
  } catch (err) {
    if (!isAccessMismatchError(err)) {
      throw err;
    }
    const altAccess = primaryAccess === 'private' ? 'public' : 'private';
    const res = await put(pathname, payload, buildOpts(altAccess));
    cachedBlobAccess = altAccess;
    return res;
  }
}

export async function deleteBlobPath(pathname) {
  if (isUpstashConfigured()) {
    await kvDeletePath(pathname);
    return;
  }
  try {
    await del(pathname);
  } catch (err) {
    if (!isNotFoundBlobError(err)) {
      throw err;
    }
  }
}

export async function listBlobPaths(prefix, limit = 30) {
  if (isUpstashConfigured()) {
    return kvListPaths(prefix, limit);
  }
  const res = await list({ prefix, limit });
  return Array.isArray(res?.blobs) ? res.blobs : [];
}

/**
 * Optimistically read-modify-write a JSON document in Upstash Redis (when configured)
 * or Private/Public Vercel Blob, refusing blind overwrites and retrying conflicts cleanly.
 */
export async function mutateBlobJson(pathname, makeDefaultFn, mutatorFn, maxAttempts = 8, { ttlSec = 0 } = {}) {
  if (isUpstashConfigured()) {
    const readRes = await kvReadJson(pathname, makeDefaultFn());
    const draft = readRes.data ?? makeDefaultFn();
    const nextResult = await mutatorFn(draft, { notFound: readRes.notFound });
    if (nextResult === NO_BLOB_MUTATION) {
      return draft;
    }
    const valueToWrite = nextResult === undefined ? draft : nextResult;
    await kvWriteJson(pathname, valueToWrite, { ttlSec });
    return valueToWrite;
  }
  let lastErr = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const readRes = await readBlobJson(pathname, makeDefaultFn());
    const canonicalEtag = readRes.notFound ? null : readRes.etag || (await readBlobEtag(pathname));
    if (!readRes.notFound && !canonicalEtag) {
      throw new Error('Missing canonical ETag for existing blob; refusing blind overwrite');
    }

    const draft = readRes.data ?? makeDefaultFn();
    const nextResult = await mutatorFn(draft, { notFound: readRes.notFound });
    if (nextResult === NO_BLOB_MUTATION) {
      return draft;
    }
    const valueToWrite = nextResult === undefined ? draft : nextResult;
    try {
      await writeBlobJson(
        pathname,
        valueToWrite,
        readRes.notFound ? { allowOverwrite: false, ttlSec } : { ifMatch: canonicalEtag, allowOverwrite: true, ttlSec }
      );
      return valueToWrite;
    } catch (err) {
      lastErr = err;
      if (!isConflictBlobError(err)) throw err;
      const delayMs = Math.round(25 + Math.random() * 50 * (attempt + 1));
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr || new Error('Concurrent blob update conflict');
}
