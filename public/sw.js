const CACHE_VERSION = 'cave-diver-v172';
const CORE_SHELL = [
  './',
  './manifest.json',
  './css/style.css?v=172',
  './icons/icon.svg?v=172',
  './icons/icon-192.png?v=172',
  './assets/map-expedition.jpg?v=172',
  './js/vendor/trystero-nostr.min.js?v=172',
  './js/main.js?v=172',
  './js/util/common.js?v=172',
  './js/physics/diveModel.js?v=172',
  './js/game/aquaticRadio.js?v=172',
  './js/game/audio.js?v=172',
  './js/game/collision.js?v=172',
  './js/game/input.js?v=172',
  './js/game/hud.js?v=172',
  './js/game/diverBody.js?v=172',
  './js/game/diveSession.js?v=172',
  './js/game/diveCard.js?v=172',
  './js/game/surveySlate.js?v=172',
  './js/game/diveSignals.js?v=172',
  './js/game/aiBuddy.js?v=172',
  './js/game/weather.js?v=172',
  './js/game/rigLivery.js?v=172',
  './js/game/photoStudio.js?v=172',
  './js/game/dynamicHazards.js?v=172',
  './js/game/salvagePhysics.js?v=172',
  './js/game/mechanicalFx.js?v=172',
  './js/game/submergedStories.js?v=172',
  './js/game/expeditionContracts.js?v=172',
  './js/game/expeditionCampaigns.js?v=172',
  './js/game/perfMonitor.js?v=172',
  './js/ui/modalManager.js?v=172',
  './js/ui/debriefChart.js?v=172',
  './js/ui/replayController.js?v=172',
  './js/ui/gasPlannerController.js?v=172',
  './js/ui/leaderboardController.js?v=172',
  './js/ui/siteBrowserController.js?v=172',
  './js/ui/liveryWorkshopController.js?v=172',
  './js/ui/logbookModalController.js?v=172',
  './js/ui/sandboxAndProceduralController.js?v=172',
  './js/ui/githubSyncController.js?v=172',
  './js/game/challengeLink.js?v=172',
  './js/game/scoring.js?v=172',
  './js/game/leaderboardModel.js?v=172',
  './js/game/logbookModel.js?v=172',
  './js/game/worldMapData.js?v=172',
  './js/game/renderer.js?v=172',
  './js/game/renderers/chunkBaker.js?v=172',
  './js/game/renderers/surfaceRenderer.js?v=172',
  './js/game/renderers/wreckAndInteractivesRenderer.js?v=172',
  './js/game/renderers/lightingAndFxRenderer.js?v=172',
  './js/game/renderers/submergedStoriesRenderer.js?v=172',
  './js/game/renderers/topsideAtmosphereRenderer.js?v=172',
  './js/game/artSprites.js?v=172',
  './js/game/silt.js?v=172',
  './js/game/lighting.js?v=172',
  './js/game/marineLife.js?v=172',
  './js/levels/themes.js?v=172',
  './js/levels/campaign.js?v=172',
  './js/levels/caveInteractives.js?v=172',
  './js/levels/proceduralLevel.js?v=172',
  './js/levels/index.js?v=172',
  './js/levels/level1.js?v=172',
  './js/levels/level2.js?v=172',
  './js/levels/level3.js?v=172',
  './js/levels/level4.js?v=172',
  './js/levels/level5.js?v=172',
  './js/levels/level6.js?v=172',
  './js/levels/level7.js?v=172',
  './js/levels/level8.js?v=172',
  './js/levels/level9.js?v=172',
  './js/levels/level10.js?v=172',
  './js/levels/level11.js?v=172',
  './js/levels/level12.js?v=172',
  './js/levels/level13.js?v=172',
  './js/levels/level14.js?v=172',
  './js/levels/level15.js?v=172',
  './js/levels/level16.js?v=172',
  './js/levels/level17.js?v=172',
  './js/levels/level18.js?v=172',
  './js/levels/level19.js?v=172',
  './js/levels/level20.js?v=172',
  './js/levels/level21_ojamo.js?v=172',
  './js/levels/level22_scoresby.js?v=172',
  './js/levels/level23_bermuda.js?v=172',
  './js/levels/level24_bimini.js?v=172',
  './js/levels/level25_krubera.js?v=172',
  './js/levels/wreck1_oriskany.js?v=172',
  './js/levels/wreck2_andrea_doria.js?v=172',
  './js/levels/wreck3_britannic.js?v=172',
  './js/levels/wreck4_hms_victoria.js?v=172',
  './js/levels/wreck5_edmund_fitzgerald.js?v=172',
  './js/levels/wreck6_thistlegorm.js?v=172',
  './js/levels/wreck7_u1206.js?v=172',
  './js/levels/wreck8_zenobia.js?v=172',
  './js/net/leaderboardClient.js?v=172',
  './js/net/githubClient.js?v=172',
  './js/net/p2pRoomHost.js?v=172',
  './js/net/lanClient.js?v=172',
  './assets/tex-limestone-wall.jpg',
  './assets/tex-cave-backwall.jpg',
  './assets/tex-florida-limestone.jpg',
  './assets/tex-florida-backwall.jpg',
  './assets/tex-foliage-canopy.jpg',
  './assets/tex-wreck-steel.jpg',
  './assets/tex-wreck-interior.jpg',
  './assets/surf-dive-boat.webp',
];

const MEDIA_CACHE = 'cave-diver-media-v172';
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
