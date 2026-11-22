const CACHE_VERSION = 'cave-diver-v151';
const CORE_SHELL = [
  './',
  './manifest.json',
  './css/style.css?v=151',
  './icons/icon.svg?v=151',
  './icons/icon-192.png?v=151',
  './icons/icon-512.png?v=151',
  './assets/map-expedition.jpg?v=151',
  './js/vendor/trystero-nostr.min.js?v=151',
  './js/main.js?v=151',
  './js/physics/diveModel.js?v=151',
  './js/game/aquaticRadio.js?v=151',
  './js/game/audio.js?v=151',
  './js/game/collision.js?v=151',
  './js/game/input.js?v=151',
  './js/game/hud.js?v=151',
  './js/game/diverBody.js?v=151',
  './js/game/diveSession.js?v=151',
  './js/game/diveCard.js?v=151',
  './js/game/diveSignals.js?v=151',
  './js/game/aiBuddy.js?v=151',
  './js/game/weather.js?v=151',
  './js/game/rigLivery.js?v=151',
  './js/game/photoStudio.js?v=151',
  './js/game/dynamicHazards.js?v=151',
  './js/game/salvagePhysics.js?v=151',
  './js/game/mechanicalFx.js?v=151',
  './js/game/perfMonitor.js?v=151',
  './js/ui/modalManager.js?v=151',
  './js/ui/debriefChart.js?v=151',
  './js/game/challengeLink.js?v=151',
  './js/game/scoring.js?v=151',
  './js/game/leaderboardModel.js?v=151',
  './js/game/logbookModel.js?v=151',
  './js/game/worldMapData.js?v=151',
  './js/game/renderer.js?v=151',
  './js/game/artSprites.js?v=151',
  './js/game/silt.js?v=151',
  './js/game/lighting.js?v=151',
  './js/game/marineLife.js?v=151',
  './js/levels/themes.js?v=151',
  './js/levels/campaign.js?v=151',
  './js/levels/caveInteractives.js?v=151',
  './js/levels/proceduralLevel.js?v=151',
  './js/levels/index.js?v=151',
  './js/levels/level1.js?v=151',
  './js/levels/level2.js?v=151',
  './js/levels/level3.js?v=151',
  './js/levels/level4.js?v=151',
  './js/levels/level5.js?v=151',
  './js/levels/level6.js?v=151',
  './js/levels/level7.js?v=151',
  './js/levels/level8.js?v=151',
  './js/levels/level9.js?v=151',
  './js/levels/level10.js?v=151',
  './js/levels/level11.js?v=151',
  './js/levels/level12.js?v=151',
  './js/levels/level13.js?v=151',
  './js/levels/level14.js?v=151',
  './js/levels/level15.js?v=151',
  './js/levels/level16.js?v=151',
  './js/levels/level17.js?v=151',
  './js/levels/level18.js?v=151',
  './js/levels/level19.js?v=151',
  './js/levels/level20.js?v=151',
  './js/levels/level21_ojamo.js?v=151',
  './js/levels/level22_scoresby.js?v=151',
  './js/levels/level23_bermuda.js?v=151',
  './js/levels/level24_bimini.js?v=151',
  './js/levels/level25_krubera.js?v=151',
  './js/levels/wreck1_oriskany.js?v=151',
  './js/levels/wreck2_andrea_doria.js?v=151',
  './js/levels/wreck3_britannic.js?v=151',
  './js/levels/wreck4_hms_victoria.js?v=151',
  './js/levels/wreck5_edmund_fitzgerald.js?v=151',
  './js/levels/wreck6_thistlegorm.js?v=151',
  './js/levels/wreck7_u1206.js?v=151',
  './js/levels/wreck8_zenobia.js?v=151',
  './js/net/leaderboardClient.js?v=151',
  './js/net/githubClient.js?v=151',
  './js/net/p2pRoomHost.js?v=151',
  './js/net/lanClient.js?v=151',
  './assets/tex-limestone-wall.jpg',
  './assets/tex-cave-backwall.jpg',
  './assets/tex-florida-limestone.jpg',
  './assets/tex-florida-backwall.jpg',
  './assets/tex-foliage-canopy.jpg',
  './assets/tex-wreck-steel.jpg',
  './assets/tex-wreck-interior.jpg',
  './assets/surf-dive-boat.webp',
  './assets/surf-palapa.webp',
  './assets/surf-cabin.webp',
  './assets/surf-bathhouse.webp',
  './assets/surf-research-dome.webp',
  './assets/surf-tree-palm.webp',
  './assets/surf-tree-cypress.webp',
  './assets/surf-tree-spruce.webp',
  './assets/surf-tree-med.webp',
  './assets/surf-tree-acacia.webp',
];

const MEDIA_CACHE = 'cave-diver-media-v151';
const MAX_MEDIA_ENTRIES = 56;

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
            event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.put(new URL('./', scopeUrl).href, copy)));
          }
          return res;
        })
        .catch(() => caches.match(new URL('./', scopeUrl).href))
    );
    return;
  }

  // Versioned modules, styles, icons & artwork: cache-first with versioned MEDIA_CACHE for large artwork
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
            event.waitUntil(
              caches.open(targetCache).then(async (c) => {
                await c.put(req, copy);
                if (isMedia) await trimMediaCache(c);
              })
            );
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
