import { jsonResponse, CORS_HEADERS } from './_blobJson.js';
import { getGitHubConfig } from './_githubAuth.js';
import { isUpstashConfigured } from './_kvStore.js';

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function GET() {
  const gh = getGitHubConfig(process.env);
  const redisConfigured = isUpstashConfigured(process.env);
  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
  return jsonResponse({
    ok: true,
    platform: 'vercel',
    storageBackend: redisConfigured ? 'upstash-redis' : blobConfigured ? 'vercel-blob' : 'none',
    redisConfigured,
    blobConfigured,
    githubConfigured: gh.configured,
  });
}
