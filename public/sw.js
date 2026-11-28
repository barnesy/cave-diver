const CACHE_VERSION = 'cave-diver-v306';
const CORE_SHELL = [
  './',
  './codex.html',
  './topside-studio.html',
  './codex.css?v=306',
  './manifest.json',
  './css/style.css?v=306',
  './fonts/plus-jakarta-sans-latin.woff2?v=306',
  './icons/icon.svg?v=306',
  './icons/icon-192.png?v=306',
  './assets/map-expedition.jpg?v=306',
  './js/vendor/trystero-nostr.min.js?v=306',
  './js/main.js?v=306',
  './js/util/common.js?v=306',
  './js/physics/diveModel.js?v=306',
  './js/game/aquaticRadio.js?v=306',
  './js/game/audio.js?v=306',
  './js/game/collision.js?v=306',
  './js/game/input.js?v=306',
  './js/game/hud.js?v=306',
  './js/game/diverBody.js?v=306',
  './js/game/diveSession.js?v=306',
  './js/game/diveCard.js?v=306',
  './js/game/surveySlate.js?v=306',
  './js/game/diveSignals.js?v=306',
  './js/game/sonarPings.js?v=306',
  './js/game/aiBuddy.js?v=306',
  './js/game/weather.js?v=306',
  './js/game/rigLivery.js?v=306',
  './js/game/gearChroma.js?v=306',
  './js/game/gearStats.js?v=306',
  './js/game/gearCodexModel.js?v=306',
  './js/game/treasureMaps.js?v=306',
  './js/game/gearProvingGrounds.js?v=306',
  './js/game/photoStudio.js?v=306',
  './js/game/dynamicHazards.js?v=306',
  './js/game/salvagePhysics.js?v=306',
  './js/game/mechanicalFx.js?v=306',
  './js/game/submergedStories.js?v=306',
  './js/game/expeditionContracts.js?v=306',
  './js/game/expeditionCampaigns.js?v=306',
  './js/game/rescueDrills.js?v=306',
  './js/game/bossBounties.js?v=306',
  './js/game/abyssalTrench.js?v=306',
  './js/game/perfMonitor.js?v=306',
  './js/ui/modalManager.js?v=306',
  './js/ui/gearCodexPage.js?v=306',
  './js/ui/debriefChart.js?v=306',
  './js/ui/replayController.js?v=306',
  './js/ui/gasPlannerController.js?v=306',
  './js/ui/leaderboardController.js?v=306',
  './js/ui/siteBrowserController.js?v=306',
  './js/ui/liveryWorkshopController.js?v=306',
  './js/ui/gearArtwork.js?v=306',
  './js/ui/gearUnlockShowcase.js?v=306',
  './js/ui/pwaAndAudioController.js?v=306',
  './js/ui/trophyGalleryRenderer.js?v=306',
  './js/ui/logbookModalController.js?v=306',
  './js/ui/sandboxAndProceduralController.js?v=306',
  './js/ui/githubSyncController.js?v=306',
  './js/ui/rescueDrillsController.js?v=306',
  './js/ui/bountiesController.js?v=306',
  './js/ui/combatHudController.js?v=306',
  './js/ui/trenchController.js?v=306',
  './js/ui/dailyChallengeController.js?v=306',
  './js/ui/photoStudioController.js?v=306',
  './js/ui/coopInviteController.js?v=306',
  './js/ui/touchFeedback.js?v=306',
  './js/ui/victoryPhotoController.js?v=306',
  './js/game/challengeLink.js?v=306',
  './js/game/scoring.js?v=306',
  './js/game/leaderboardModel.js?v=306',
  './js/game/logbookModel.js?v=306',
  './js/game/worldMapData.js?v=306',
  './js/game/renderer.js?v=306',
  './js/game/renderers/chunkBaker.js?v=306',
  './js/game/renderers/surfaceRenderer.js?v=306',
  './js/game/renderers/wreckAndInteractivesRenderer.js?v=306',
  './js/game/renderers/chestAndSalvageRenderer.js?v=306',
  './js/game/hyperRealSprites.js?v=306',
  './js/game/playerAvatar.js?v=306',
  './js/ui/avatarCreatorController.js?v=306',
  './assets/prop-chest-brass-closed.webp',
  './assets/prop-chest-brass-open.webp',
  './assets/prop-chest-grotto-closed.webp',
  './assets/prop-chest-grotto-open.webp',
  './assets/prop-chest-vault-closed.webp',
  './assets/prop-chest-vault-open.webp',
  './assets/prop-gearcache-closed.webp',
  './assets/prop-gearcache-open.webp',
  './assets/prop-vault-door-plate.webp',
  './assets/prop-vault-handwheel.webp',
  './assets/prop-blast-gate-leaf.webp',
  './assets/surf-tiki-gazebo.webp',
  './assets/surf-umbrella-coral.webp',
  './assets/surf-umbrella-teal.webp',
  './assets/surf-umbrella-gold.webp',
  './assets/surf-party-cooler-boombox.webp',
  './assets/surf-scuba-gear-rack.webp',
  './assets/surf-geo-awning.webp',
  './assets/surf-dive-van.webp',
  './assets/surf-snowcat.webp',
  './assets/surf-cedar-hottub.webp',
  './assets/surf-party-raft.webp',
  './assets/surf-research-dome.webp',
  './assets/surf-palapa.webp',
  './assets/surf-dive-boat.webp',
  './js/game/renderers/lightingAndFxRenderer.js?v=306',
  './js/game/renderers/submergedStoriesRenderer.js?v=306',
  './js/game/renderers/topsideAtmosphereRenderer.js?v=306',
  './js/game/renderers/topsidePeopleRenderer.js?v=306',
  './js/game/renderers/topsidePropsRenderer.js?v=306',
  './js/game/renderers/bossAndLairRenderer.js?v=306',
  './js/game/renderers/bossGuardiansRenderer.js?v=306',
  './js/game/renderers/underwaterJuiceRenderer.js?v=306',
  './js/game/renderers/foregroundDepthRenderer.js?v=306',
  './js/game/renderers/diverAndSquadRenderer.js?v=306',
  './js/game/bossSpecs.js?v=306',
  './js/game/secretLairs.js?v=306',
  './js/game/artSprites.js?v=306',
  './js/game/silt.js?v=306',
  './js/game/lighting.js?v=306',
  './js/game/marineLife.js?v=306',
  './js/levels/themes.js?v=306',
  './js/levels/campaign.js?v=306',
  './js/levels/caveInteractives.js?v=306',
  './js/levels/proceduralLevel.js?v=306',
  './js/levels/index.js?v=306',
  './js/levels/level1.js?v=306',
  './js/levels/level2.js?v=306',
  './js/levels/level3.js?v=306',
  './js/levels/level4.js?v=306',
  './js/levels/level5.js?v=306',
  './js/levels/level6.js?v=306',
  './js/levels/level7.js?v=306',
  './js/levels/level8.js?v=306',
  './js/levels/level9.js?v=306',
  './js/levels/level10.js?v=306',
  './js/levels/level11.js?v=306',
  './js/levels/level12.js?v=306',
  './js/levels/level13.js?v=306',
  './js/levels/level14.js?v=306',
  './js/levels/level15.js?v=306',
  './js/levels/level16.js?v=306',
  './js/levels/level17.js?v=306',
  './js/levels/level18.js?v=306',
  './js/levels/level19.js?v=306',
  './js/levels/level20.js?v=306',
  './js/levels/level21_ojamo.js?v=306',
  './js/levels/level22_scoresby.js?v=306',
  './js/levels/level23_bermuda.js?v=306',
  './js/levels/level24_bimini.js?v=306',
  './js/levels/level25_krubera.js?v=306',
  './js/levels/level26_angelita.js?v=306',
  './js/levels/level27_yonaguni.js?v=306',
  './js/levels/wreck1_oriskany.js?v=306',
  './js/levels/wreck2_andrea_doria.js?v=306',
  './js/levels/wreck3_britannic.js?v=306',
  './js/levels/wreck4_hms_victoria.js?v=306',
  './js/levels/wreck5_edmund_fitzgerald.js?v=306',
  './js/levels/wreck6_thistlegorm.js?v=306',
  './js/levels/wreck7_u1206.js?v=306',
  './js/levels/wreck8_zenobia.js?v=306',
  './js/levels/wreck9_fujikawa.js?v=306',
  './js/levels/wreck10_markgraf.js?v=306',
  './js/net/leaderboardClient.js?v=306',
  './js/net/githubClient.js?v=306',
  './js/net/p2pRoomHost.js?v=306',
  './js/net/lanClient.js?v=306',
  './assets/tex-limestone-wall.jpg',
  './assets/tex-cave-backwall.jpg',
  './assets/tex-florida-limestone.jpg',
  './assets/tex-florida-backwall.jpg',
  './assets/tex-foliage-canopy.jpg',
  './assets/sky-yucatan.jpg',
  './assets/surf-palapa.webp',
  './assets/surf-tree-palm.webp',
  './assets/tex-wreck-steel.jpg',
  './assets/tex-wreck-interior.jpg',
  './assets/surf-dive-boat.webp',
  './assets/tex-fg-kelp.jpg',
  './assets/tex-fg-roots.jpg',
  './assets/tex-fg-crystal.jpg',
  './assets/tex-fg-ice.jpg',
];

const MEDIA_CACHE = 'cave-diver-media-v306';
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
