import { jsonResponse, CORS_HEADERS } from './_blobJson.js';
import { getGitHubConfig } from './_githubAuth.js';

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function GET() {
  const gh = getGitHubConfig(process.env);
  const githubEnvKeys = Object.keys(process.env).filter((k) => /github|gh_/i.test(k)).sort();
  return jsonResponse({
    ok: true,
    platform: 'vercel',
    blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID),
    blobHasRwToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    blobHasStoreId: Boolean(process.env.BLOB_STORE_ID),
    githubConfigured: gh.configured,
    githubHasClientId: Boolean(gh.clientId),
    githubHasClientSecret: Boolean(gh.clientSecret),
    githubEnvKeys,
  });
}
