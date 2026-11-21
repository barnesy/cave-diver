/**
 * Zero-dependency Upstash Redis REST client for Vercel Functions.
 * Automatically activates when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * (or Vercel Marketplace KV_REST_API_URL + KV_REST_API_TOKEN) are configured.
 */

const KEY_PREFIX = 'td:';
const INDEX_PREFIX = 'td:idx:';

export function getUpstashConfig(env = process.env) {
  const url = String(env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || '').trim().replace(/\/+$/, '');
  const token = String(env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || '').trim();
  if (!url || !token) return null;
  return { url, token };
}

export function isUpstashConfigured(env = process.env) {
  return Boolean(getUpstashConfig(env));
}

function fullKey(pathname) {
  return `${KEY_PREFIX}${String(pathname || '').replace(/^\/+/, '')}`;
}

function indexKeyForPath(pathname) {
  const clean = String(pathname || '').replace(/^\/+/, '');
  const slash = clean.indexOf('/');
  if (slash <= 0) return null;
  return `${INDEX_PREFIX}${clean.slice(0, slash + 1)}`;
}

export async function redisCommand(commandArgs, { env = process.env, fetchImpl = fetch } = {}) {
  const cfg = getUpstashConfig(env);
  if (!cfg) {
    throw new Error('Upstash Redis is not configured');
  }
  const res = await fetchImpl(cfg.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commandArgs),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw Object.assign(new Error(`Upstash Redis HTTP ${res.status}: ${txt.slice(0, 140)}`), {
      status: res.status,
    });
  }
  const json = await res.json();
  if (json?.error) {
    throw new Error(`Upstash Redis error: ${json.error}`);
  }
  return json?.result;
}

export async function redisPipeline(commands, { env = process.env, fetchImpl = fetch } = {}) {
  const cfg = getUpstashConfig(env);
  if (!cfg) {
    throw new Error('Upstash Redis is not configured');
  }
  const res = await fetchImpl(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw Object.assign(new Error(`Upstash Redis pipeline HTTP ${res.status}: ${txt.slice(0, 140)}`), {
      status: res.status,
    });
  }
  const arr = await res.json();
  if (!Array.isArray(arr)) {
    throw new Error('Unexpected Upstash Redis pipeline response');
  }
  return arr.map((item) => {
    if (item?.error) throw new Error(`Upstash Redis error: ${item.error}`);
    return item?.result;
  });
}

export async function kvReadJson(pathname, fallbackValue = null, opts = {}) {
  const raw = await redisCommand(['GET', fullKey(pathname)], opts);
  if (raw === null || raw === undefined) {
    return { data: fallbackValue, etag: null, notFound: true };
  }
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    data: parsed ?? fallbackValue,
    etag: 'redis',
    notFound: false,
  };
}

export async function kvWriteJson(pathname, data, { ttlSec = 0, ...opts } = {}) {
  const cleanPath = String(pathname || '').replace(/^\/+/, '');
  const payload = JSON.stringify(data);
  const setCmd =
    Number.isFinite(ttlSec) && ttlSec > 0
      ? ['SET', fullKey(cleanPath), payload, 'EX', Math.max(1, Math.ceil(ttlSec))]
      : ['SET', fullKey(cleanPath), payload];

  const idxKey = indexKeyForPath(cleanPath);
  if (idxKey) {
    await redisPipeline([setCmd, ['SADD', idxKey, cleanPath]], opts);
  } else {
    await redisCommand(setCmd, opts);
  }
  return { pathname: cleanPath };
}

export async function kvDeletePath(pathname, opts = {}) {
  const cleanPath = String(pathname || '').replace(/^\/+/, '');
  const idxKey = indexKeyForPath(cleanPath);
  if (idxKey) {
    await redisPipeline([['DEL', fullKey(cleanPath)], ['SREM', idxKey, cleanPath]], opts);
  } else {
    await redisCommand(['DEL', fullKey(cleanPath)], opts);
  }
}

export async function kvListPaths(prefix, limit = 60, opts = {}) {
  const cleanPrefix = String(prefix || '').replace(/^\/+/, '');
  const idxKey = indexKeyForPath(cleanPrefix.endsWith('/') ? cleanPrefix : `${cleanPrefix}/`);
  if (!idxKey) return [];
  const members = await redisCommand(['SMEMBERS', idxKey], opts);
  if (!Array.isArray(members) || members.length === 0) return [];
  const matching = members
    .filter((m) => typeof m === 'string' && m.startsWith(cleanPrefix))
    .slice(0, Math.max(1, limit));
  return matching.map((pathname) => ({ pathname, url: '' }));
}
