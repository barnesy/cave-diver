import {
  del,
  get,
  head,
  list,
  put,
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

function isNotFoundBlobError(err) {
  return Boolean(
    err instanceof BlobNotFoundError ||
      err?.name === 'BlobNotFoundError' ||
      err?.status === 404 ||
      String(err?.message || '').toLowerCase().includes('does not exist')
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

export async function readBlobJson(pathname, fallbackValue = null) {
  try {
    const res = await get(pathname, { access: 'private', useCache: false });
    if (!res) {
      return { data: fallbackValue, etag: null, notFound: true };
    }
    if (res.statusCode === 404) {
      return { data: fallbackValue, etag: null, notFound: true };
    }
    if (res.statusCode !== 200 || !res.stream) {
      throw new Error(`Blob read failed with status ${res.statusCode}`);
    }
    const text = await new Response(res.stream).text();
    const parsed = text ? JSON.parse(text) : fallbackValue;
    return {
      data: parsed ?? fallbackValue,
      etag: res.blob?.etag || null,
      notFound: false,
    };
  } catch (err) {
    if (isNotFoundBlobError(err)) {
      return { data: fallbackValue, etag: null, notFound: true };
    }
    throw err;
  }
}

export async function writeBlobJson(pathname, data, { ifMatch = null, allowOverwrite = true } = {}) {
  const opts = {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite,
    addRandomSuffix: false,
  };
  if (ifMatch) {
    opts.ifMatch = ifMatch;
  }
  return put(pathname, JSON.stringify(data), opts);
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
