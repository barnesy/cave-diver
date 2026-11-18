const CACHE_VERSION = 'cave-diver-v63';
const CORE_SHELL = [
  './',
  './manifest.json',
  './css/style.css?v=63',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/vendor/trystero-nostr.min.js?v=63',
  './js/main.js?v=63',
  './js/physics/diveModel.js?v=63',
  './js/game/aquaticRadio.js?v=63',
  './js/game/audio.js?v=63',
  './js/game/collision.js?v=63',
  './js/game/input.js?v=63',
  './js/game/hud.js?v=63',
  './js/game/diverBody.js?v=63',
  './js/game/diveSession.js?v=63',
  './js/game/scoring.js?v=63',
  './js/game/leaderboardModel.js?v=63',
  './js/game/logbookModel.js?v=63',
  './js/game/renderer.js?v=63',
  './js/game/artSprites.js?v=63',
  './js/game/silt.js?v=63',
  './js/game/lighting.js?v=63',
  './js/game/marineLife.js?v=63',
  './js/levels/themes.js?v=63',
  './js/levels/campaign.js?v=63',
  './js/levels/index.js?v=63',
  './js/levels/level1.js?v=63',
  './js/levels/level2.js?v=63',
  './js/levels/level3.js?v=63',
  './js/levels/level4.js?v=63',
  './js/levels/level5.js?v=63',
  './js/levels/level6.js?v=63',
  './js/levels/level7.js?v=63',
  './js/levels/level8.js?v=63',
  './js/levels/level9.js?v=63',
  './js/levels/level10.js?v=63',
  './js/levels/level11.js?v=63',
  './js/levels/level12.js?v=63',
  './js/levels/level13.js?v=63',
  './js/levels/level14.js?v=63',
  './js/net/leaderboardClient.js?v=63',
  './js/net/p2pRoomHost.js?v=63',
  './js/net/lanClient.js?v=63',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        Promise.all(
          CORE_SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })))
        )
      )
      .then(async () => {
        // Activate immediately if no open tabs are controlled yet; otherwise wait cleanly for user Update tap
        if (!self.registration.active) {
          return self.skipWaiting();
        }
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (clients.length === 0) {
          return self.skipWaiting();
        }
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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

  // Navigations: always bypass HTTP CDN/disk cache so HTML + importmap versions stay in lockstep
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || new URL('./', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    })
  );
});
