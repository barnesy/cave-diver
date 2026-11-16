const CACHE_VERSION = 'cave-diver-v33';
const CORE_SHELL = [
  './',
  './manifest.json',
  './css/style.css?v=33',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/vendor/peerjs.min.js?v=33',
  './js/main.js?v=33',
  './js/physics/diveModel.js?v=33',
  './js/game/audio.js?v=33',
  './js/game/collision.js?v=33',
  './js/game/input.js?v=33',
  './js/game/hud.js?v=33',
  './js/game/diverBody.js?v=33',
  './js/game/diveSession.js?v=33',
  './js/game/scoring.js?v=33',
  './js/game/renderer.js?v=33',
  './js/game/artSprites.js?v=33',
  './js/game/silt.js?v=33',
  './js/game/lighting.js?v=33',
  './js/game/marineLife.js?v=33',
  './js/levels/themes.js?v=33',
  './js/levels/campaign.js?v=33',
  './js/levels/index.js?v=33',
  './js/levels/level1.js?v=33',
  './js/levels/level2.js?v=33',
  './js/levels/level3.js?v=33',
  './js/levels/level4.js?v=33',
  './js/levels/level5.js?v=33',
  './js/levels/level6.js?v=33',
  './js/levels/level7.js?v=33',
  './js/levels/level8.js?v=33',
  './js/levels/level9.js?v=33',
  './js/levels/level10.js?v=33',
  './js/levels/level11.js?v=33',
  './js/levels/level12.js?v=33',
  './js/levels/level13.js?v=33',
  './js/net/p2pRoomHost.js?v=33',
  './js/net/lanClient.js?v=33',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const scopeUrl = new URL(self.registration.scope);
  const relPath = url.pathname.startsWith(scopeUrl.pathname)
    ? url.pathname.slice(scopeUrl.pathname.length)
    : url.pathname.replace(/^\//, '');

  // Never intercept live WebSocket/API/health/SW paths
  if (
    relPath === 'ws' ||
    relPath.startsWith('api/') ||
    relPath === 'healthz' ||
    relPath === 'sw.js'
  ) {
    return;
  }

  // Navigations: network-first so updates land immediately, offline fallback to cached shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(new URL('./', scopeUrl).href, copy));
          }
          return res;
        })
        .catch(() => caches.match(new URL('./', scopeUrl).href))
    );
    return;
  }

  // Versioned modules, styles, icons & artwork: cache-first with runtime caching backfill
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (
          res.ok &&
          (relPath.startsWith('assets/') ||
            relPath.startsWith('js/') ||
            relPath.startsWith('css/') ||
            relPath.startsWith('icons/'))
        ) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
