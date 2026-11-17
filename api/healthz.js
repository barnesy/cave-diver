import { jsonResponse, CORS_HEADERS } from './_blobJson.js';

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function GET() {
  return jsonResponse({
    ok: true,
    platform: 'vercel',
    blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID),
  });
}
