#!/usr/bin/env node
/**
 * Atomically bump Cave Diver PWA / cache-busting version across all 5 files:
 *   - public/index.html (meta app-version, version pill, ?v=N query params)
 *   - public/manifest.json (?v=N icons)
 *   - public/sw.js (CACHE_VERSION + ?v=N precache URLs)
 *   - public/js/net/lanClient.js (trystero vendor import ?v=N)
 *   - public/js/main.js (map-expedition.jpg?v=N)
 *
 * Usage: node scripts/bump-version.mjs 84
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const nextRaw = process.argv[2];
const nextVer = parseInt(nextRaw, 10);
if (!Number.isInteger(nextVer) || nextVer < 1) {
  console.error('Usage: node scripts/bump-version.mjs <positive-integer-version>');
  process.exit(1);
}

const files = [
  {
    rel: 'public/index.html',
    transform: (src) =>
      src
        .replace(/(<meta\s+name="app-version"\s+content=")\d+("\s*\/>)/, `$1${nextVer}$2`)
        .replace(/(id="btn-pwa-update"[^>]*>)v\d+(<\/button>)/, `$1v${nextVer}$2`)
        .replace(/(\?v=)\d+/g, `$1${nextVer}`),
  },
  {
    rel: 'public/manifest.json',
    transform: (src) => src.replace(/(\?v=)\d+/g, `$1${nextVer}`),
  },
  {
    rel: 'public/sw.js',
    transform: (src) =>
      src
        .replace(/(const\s+CACHE_VERSION\s*=\s*['"]cave-diver-v)\d+(['"])/, `$1${nextVer}$2`)
        .replace(/(\?v=)\d+/g, `$1${nextVer}`),
  },
  {
    rel: 'public/js/net/lanClient.js',
    transform: (src) => src.replace(/(trystero-nostr\.min\.js\?v=)\d+/g, `$1${nextVer}`),
  },
  {
    rel: 'public/js/main.js',
    transform: (src) => src.replace(/(map-expedition\.jpg\?v=)\d+/g, `$1${nextVer}`),
  },
];

for (const f of files) {
  const fullPath = path.join(rootDir, f.rel);
  const before = fs.readFileSync(fullPath, 'utf8');
  const after = f.transform(before);
  if (after !== before) {
    fs.writeFileSync(fullPath, after, 'utf8');
    console.log(`Updated ${f.rel} -> v${nextVer}`);
  } else {
    console.log(`Unchanged ${f.rel} (already v${nextVer})`);
  }
}
