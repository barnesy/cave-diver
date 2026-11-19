const CACHE_VERSION = 'cave-diver-v96';
const CORE_SHELL = [
  './',
  './manifest.json',
  './css/style.css?v=96',
  './icons/icon.svg?v=96',
  './icons/icon-192.png?v=96',
  './icons/icon-512.png?v=96',
  './assets/map-expedition.jpg?v=96',
  './js/vendor/trystero-nostr.min.js?v=96',
  './js/main.js?v=96',
  './js/physics/diveModel.js?v=96',
  './js/game/aquaticRadio.js?v=96',
  './js/game/audio.js?v=96',
  './js/game/collision.js?v=96',
  './js/game/input.js?v=96',
  './js/game/hud.js?v=96',
  './js/game/diverBody.js?v=96',
  './js/game/diveSession.js?v=96',
  './js/game/scoring.js?v=96',
  './js/game/leaderboardModel.js?v=96',
  './js/game/logbookModel.js?v=96',
  './js/game/worldMapData.js?v=96',
  './js/game/renderer.js?v=96',
  './js/game/artSprites.js?v=96',
  './js/game/silt.js?v=96',
  './js/game/lighting.js?v=96',
  './js/game/marineLife.js?v=96',
  './js/levels/themes.js?v=96',
  './js/levels/campaign.js?v=96',
  './js/levels/index.js?v=96',
  './js/levels/level1.js?v=96',
  './js/levels/level2.js?v=96',
  './js/levels/level3.js?v=96',
  './js/levels/level4.js?v=96',
  './js/levels/level5.js?v=96',
  './js/levels/level6.js?v=96',
  './js/levels/level7.js?v=96',
  './js/levels/level8.js?v=96',
  './js/levels/level9.js?v=96',
  './js/levels/level10.js?v=96',
  './js/levels/level11.js?v=96',
  './js/levels/level12.js?v=96',
  './js/levels/level13.js?v=96',
  './js/levels/level14.js?v=96',
  './js/levels/level15.js?v=96',
  './js/levels/level16.js?v=96',
  './js/levels/level17.js?v=96',
  './js/levels/level18.js?v=96',
  './js/levels/level19.js?v=96',
  './js/levels/level20.js?v=96',
  './js/levels/wreck1_oriskany.js?v=96',
  './js/levels/wreck2_andrea_doria.js?v=96',
  './js/levels/wreck3_britannic.js?v=96',
  './js/levels/wreck4_hms_victoria.js?v=96',
  './js/levels/wreck5_edmund_fitzgerald.js?v=96',
  './js/net/leaderboardClient.js?v=96',
  './js/net/p2pRoomHost.js?v=96',
  './js/net/lanClient.js?v=96',
];

const MEDIA_CACHE = 'cave-diver-media-v1';
const MAX_MEDIA_ENTRIES = 16;

async function trimMediaCache(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length <= MAX_MEDIA_ENTRIES) return;
    const excess = keys.slice(0, keys.length - MAX_MEDIA_ENTRIES);
    await Promise.all(excess.map((k) => cache.delete(k)));
  } catch {}
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(async (cache) => {
        // Batch precache fetches (concurrency 8) to avoid 53-request bursts stalling mobile cellular installs
        const batchSize = 8;
        for (let i = 0; i < CORE_SHELL.length; i += batchSize) {
          const slice = CORE_SHELL.slice(i, i + batchSize);
          await Promise.all(slice.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
        }
      })
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
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION && k !== MEDIA_CACHE)
            .map((k) => caches.delete(k))
        )
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

  // Versioned modules, styles, icons & artwork: cache-first with persistent LRU MEDIA_CACHE for large artwork
  const isMedia = relPath.startsWith('assets/');
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (
            res.ok &&
            (isMedia ||
              relPath.startsWith('js/') ||
              relPath.startsWith('css/') ||
              relPath.startsWith('icons/'))
          ) {
            const copy = res.clone();
            const targetCache = isMedia ? MEDIA_CACHE : CACHE_VERSION;
            caches.open(targetCache).then(async (c) => {
              await c.put(req, copy);
              if (isMedia) await trimMediaCache(c);
            });
          }
          return res;
        })
        .catch(() => Response.error());
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
