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

async function readBlobWithAccess(pathname, fallbackValue, access) {
  if (access === 'public') {
    const meta = await head(pathname);
    if (!meta || !meta.url) {
      return { data: fallbackValue, etag: null, notFound: true };
    }
    const baseUrl = meta.downloadUrl || meta.url;
    const sep = baseUrl.includes('?') ? '&' : '?';
    const bust = encodeURIComponent(meta.etag || Date.now());
    const res = await fetch(`${baseUrl}${sep}v=${bust}`, { cache: 'no-store' });
    if (res.status === 404) {
      return { data: fallbackValue, etag: null, notFound: true };
    }
    if (!res.ok) {
      throw Object.assign(new Error(`Blob read failed with status ${res.status}`), {
        status: res.status,
      });
    }
    const text = await res.text();
    const parsed = text ? JSON.parse(text) : fallbackValue;
    return {
      data: parsed ?? fallbackValue,
      etag: meta.etag || res.headers.get('etag') || null,
      notFound: false,
    };
  }

  const res = await get(pathname, { access: 'private', useCache: false });
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

export async function writeBlobJson(pathname, data, { ifMatch = null, allowOverwrite = true } = {}) {
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
  try {
    await del(pathname);
  } catch (err) {
    if (!isNotFoundBlobError(err)) {
      throw err;
    }
  }
}

export async function listBlobPaths(prefix, limit = 30) {
  const res = await list({ prefix, limit });
  return Array.isArray(res?.blobs) ? res.blobs : [];
}

/**
 * Optimistically read-modify-write a JSON document in Private Vercel Blob,
 * refusing blind overwrites on transient read failures and retrying conflicts with jittered backoff.
 */
export async function mutateBlobJson(pathname, makeDefaultFn, mutatorFn, maxAttempts = 8) {
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
        readRes.notFound ? { allowOverwrite: false } : { ifMatch: canonicalEtag, allowOverwrite: true }
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
