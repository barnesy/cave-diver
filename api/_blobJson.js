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

export async function readBlobEtag(pathname) {
  try {
    const meta = await head(pathname);
    return meta?.etag || null;
  } catch (err) {
    if (err instanceof BlobNotFoundError || err?.name === 'BlobNotFoundError') {
      return null;
    }
    return null;
  }
}

export async function readBlobJson(pathname, fallbackValue = null) {
  try {
    const res = await get(pathname, { access: 'private', useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) {
      return { data: fallbackValue, etag: null };
    }
    const text = await new Response(res.stream).text();
    const parsed = text ? JSON.parse(text) : fallbackValue;
    return {
      data: parsed ?? fallbackValue,
      etag: res.blob?.etag || null,
    };
  } catch {
    return { data: fallbackValue, etag: null };
  }
}

export async function writeBlobJson(pathname, data, { ifMatch = null } = {}) {
  const opts = {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true,
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
    if (!(err instanceof BlobNotFoundError || err?.name === 'BlobNotFoundError')) {
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
 * using canonical head().etag for ifMatch and retrying cleanly on concurrent conflicts.
 */
export async function mutateBlobJson(pathname, makeDefaultFn, mutatorFn, maxAttempts = 5) {
  let lastErr = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const [canonicalEtag, readRes] = await Promise.all([
      readBlobEtag(pathname),
      readBlobJson(pathname, makeDefaultFn()),
    ]);
    const draft = readRes.data ?? makeDefaultFn();
    const nextResult = await mutatorFn(draft);
    const valueToWrite = nextResult === undefined ? draft : nextResult;
    try {
      await writeBlobJson(pathname, valueToWrite, canonicalEtag ? { ifMatch: canonicalEtag } : undefined);
      return valueToWrite;
    } catch (err) {
      lastErr = err;
      const isPrecondition =
        err instanceof BlobPreconditionFailedError ||
        err?.name === 'BlobPreconditionFailedError' ||
        String(err?.message || '').toLowerCase().includes('precondition');
      if (!isPrecondition) throw err;
    }
  }
  throw lastErr || new Error('Concurrent blob update conflict');
}
