import {
  LEVELS,
  DEFAULT_LEVEL_ID,
  CAMPAIGN_PLAN,
  getLevelById,
  getLevelMeta,
  getLevelMaxDepthM,
  PROCEDURAL_TIERS,
  PROCEDURAL_BIOMES,
  normalizeProceduralSeed,
  randomProceduralSeed,
  buildProceduralLevelId,
  buildProceduralShareUrl,
  parseProceduralFromSearch,
  generateProceduralLevel,
  getDailyGeneratedConfig,
} from './levels/index.js';
import {
  createDiveState,
  switchGas,
  GAS_MIXES,
  computePPO2,
  buildCustomGasBlend,
  getRecommendedGas,
  getShareableGasCandidate,
  donateGasFromState,
  receiveGasIntoState,
} from './physics/diveModel.js';
import { resolveDiverCollision } from './game/collision.js';
import {
  createEmptyLogbook,
  mergeCareerLogbooks,
  normalizeGhostTrack,
  recordDiveInLogbook,
  seedLogbookFromEntries,
  formatLogbookSummary,
  computeCertifications,
  TECH_GEAR_CATALOG,
  computeUnlockedGear,
  sanitizeGearLoadout,
  DAILY_MUTATORS,
  getDailyChallenge,
  getDailyMutatorById,
  getDailyMutatorForDate,
  getUtcDateKey,
  buildDailyCalendarMonth,
  recordDailyClear,
  getDailyStatus,
  recordFieldGuidePhoto,
  getFieldGuideStats,
  exportLogbookToCsv,
  exportLogbookToJson,
  parseImportedLogbookJson,
} from './game/logbookModel.js';
import {
  decodeReplayTrack,
  drawReplayFrame,
  renderExpeditionPostcard,
  formatReplayTime,
} from './game/diveCard.js';
import {
  buildChallengeUrl,
  parseChallengeFromSearch,
  formatChallengeSummary,
  evaluateChallengeResult,
} from './game/challengeLink.js';
import {
  createDiveSession,
  stepDiveSession,
  stepPeerBubbles,
  toggleGuidelineReel,
  rewindGuidelineSegment,
  getEffectiveReelRemainingM,
  triggerWreckAction,
  dropStageTank,
  resolveEmergencyDrill,
  toggleDpvScooter,
  triggerSonarPing,
  captureCameraPhoto,
  triggerBuddyLocatePing,
  pushAirShareBeam,
  recordPeerDepthProfiles,
  sampleGhostPose,
  buildParGhostTrack,
  applyPeerWreckAction,
} from './game/diveSession.js';
import {
  computeDiverScoreSummary,
  computeTeamScoreSummary,
  computeHealthPct,
  computeGasRemainingPct,
  markExploredAround,
} from './game/scoring.js';
import {
  GLOBAL_MAP_VIEWBOX,
  MAP_CONTOUR_LINES,
  projectMapPoint,
  computeSiteFocusViewBox,
  formatLatLng,
} from './game/worldMapData.js';
import { CaveRenderer } from './game/renderer.js';
import { createMarineEcosystem, stepMarineEcosystem } from './game/marineLife.js';
import { spawnSiltPlume } from './game/silt.js';
import { DiveComputerHUD, isMinimapAllowed, drawShearwaterComputer, sampleDiveProfileAtTime } from './game/hud.js';
import { SCUBA_SIGNALS, triggerDiverSignal } from './game/diveSignals.js';
import { InputController } from './game/input.js';
import { DiveAudio, computeSpatialMix } from './game/audio.js';
import { LanClient } from './net/lanClient.js';
import { LeaderboardClient } from './net/leaderboardClient.js';
import { GitHubClient, buildPrefilledIssueUrl } from './net/githubClient.js';

function parseRoomCodeFromLocation() {
  const params = new URLSearchParams(location.search);
  const hashRaw = location.hash.replace(/^#/, '');
  const hashParams = new URLSearchParams(hashRaw.includes('=') ? hashRaw : '');
  const pathMatch = location.pathname.match(/\/join\/([A-Za-z0-9]{1,8})\/?$/);
  const raw =
    params.get('room') ||
    params.get('join') ||
    hashParams.get('room') ||
    hashParams.get('join') ||
    pathMatch?.[1] ||
    '';
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

const URL_PARAMS = new URLSearchParams(location.search);
const INITIAL_LEVEL_ID = URL_PARAMS.get('level') || DEFAULT_LEVEL_ID;
const INITIAL_ROOM_CODE = parseRoomCodeFromLocation();

let activeLevel = getLevelById(INITIAL_LEVEL_ID);
const canvas = document.getElementById('game-canvas');
const renderer = new CaveRenderer(canvas, activeLevel, { deferBuild: true });
let ecosystem = null;
const audio = new DiveAudio();
const lan = new LanClient();
const leaderboard = new LeaderboardClient();
const github = new GitHubClient();

// UI Elements
const screenLoader = document.getElementById('screen-loader');
const loaderStepEl = document.getElementById('loader-step');
const loaderPctEl = document.getElementById('loader-pct');
const loaderBarFill = document.getElementById('loader-bar-fill');
const loaderBarTrack = document.getElementById('loader-bar-track');
const selectLevel = document.getElementById('select-level');
const levelCardsEl = document.getElementById('level-cards');
const levelLockNoteEl = document.getElementById('level-lock-note');
const inlineLoaderEl = document.getElementById('inline-level-loader');
const inlineLoaderLabelEl = document.getElementById('inline-level-loader-label');
const inlineLoaderFillEl = document.getElementById('inline-loader-fill');
const playerNameInput = document.getElementById('input-player-name');
const btnHomeMenu = document.getElementById('btn-home-menu');
const homeMenuPopover = document.getElementById('home-menu-popover');
const homeMenuUpdateDot = document.getElementById('home-menu-update-dot');
const homeMenuLbLabel = document.getElementById('home-menu-lb-label');
const btnLbBack = document.getElementById('btn-lb-back');
const menuDescEl = document.getElementById('menu-desc');
const btnDescToggle = document.getElementById('btn-desc-toggle');
const menuIdentityRow = document.getElementById('menu-identity-row');
const menuSitePicker = document.getElementById('menu-site-picker');
const soloPanel = document.getElementById('solo-panel');
const siteBrowserEl = document.getElementById('site-browser');
const siteCatTabsEl = document.getElementById('site-cat-tabs');
const siteViewTabsEl = document.getElementById('site-view-tabs');
const siteWorldMapEl = document.getElementById('site-world-map');
const siteMapRegionBadgeEl = document.getElementById('site-map-region-badge');
const siteMapCoordsEl = document.getElementById('site-map-coords');
const btnMapZoom = document.getElementById('btn-map-zoom');
const btnPlaySolo = document.getElementById('btn-play-solo');
const btnOpenLeaderboard = document.getElementById('btn-open-leaderboard');
const leaderboardPanel = document.getElementById('leaderboard-panel');
const lbCareerSummaryEl = document.getElementById('lb-career-summary');
const selectLbSite = document.getElementById('select-lb-site');
const leaderboardSubEl = document.getElementById('leaderboard-sub');
const leaderboardRowsEl = document.getElementById('leaderboard-rows');
const debriefLeaderboardEl = document.getElementById('debrief-leaderboard');
const lbStatsModalEl = document.getElementById('lb-stats-modal');
const lbStatsKickerEl = document.getElementById('lb-stats-kicker');
const lbStatsTitleEl = document.getElementById('lb-stats-title');
const lbStatsSubEl = document.getElementById('lb-stats-sub');
const lbStatsBodyEl = document.getElementById('lb-stats-body');
const btnLbStatsClose = document.getElementById('btn-lb-stats-close');
const btnInstallPwa = document.getElementById('btn-install-pwa');
const screenMenu = document.getElementById('screen-menu');
const screenHud = document.getElementById('screen-hud');
const screenDebrief = document.getElementById('screen-debrief');
const lanStatus = document.getElementById('lan-status');
const lanConnBadge = document.getElementById('lan-conn-badge');
const lanSetupControls = document.getElementById('lan-setup-controls');
const lanRoomsSection = document.getElementById('lan-rooms-section');
const lanRoomsList = document.getElementById('lan-rooms-list');
const lanRoomBox = document.getElementById('lan-room-box');
const lanInviteUrlInput = document.getElementById('lan-invite-url');
const btnCopyInvite = document.getElementById('btn-copy-invite');
const btnShareInvite = document.getElementById('btn-share-invite');
const btnNotifyToggle = document.getElementById('btn-notify-toggle');
const btnHudMenu = document.getElementById('btn-hud-menu');
const hudMenuPopover = document.getElementById('hud-menu-popover');
const btnHudInvite = document.getElementById('btn-hud-invite');
const btnHudShare = document.getElementById('btn-hud-share');
const gameToastEl = document.getElementById('game-toast');
const loaderCoopSyncEl = document.getElementById('loader-coop-sync');
const loaderCrewStatusEl = document.getElementById('loader-crew-status');
const btnLoaderForce = document.getElementById('btn-loader-force');
const btnLoaderCancel = document.getElementById('btn-loader-cancel');
const loaderCallsignGateEl = document.getElementById('loader-callsign-gate');
const loaderCallsignInput = document.getElementById('input-loader-callsign');
const btnLoaderJoin = document.getElementById('btn-loader-join');
const callsignCountEl = document.getElementById('callsign-count');
const coopCommsEl = document.getElementById('coop-comms');
const btnShareGas = document.getElementById('btn-share-gas');
const btnTowBuddy = document.getElementById('btn-tow-buddy');
const btnDropTow = document.getElementById('btn-drop-tow');
const hudPauseOverlay = document.getElementById('hud-pause-overlay');
const btnPauseResume = document.getElementById('btn-pause-resume');
const btnPauseAbort = document.getElementById('btn-pause-abort');
const btnNextLevel = document.getElementById('btn-next-level');
const btnMenuRadio = document.getElementById('btn-menu-radio');
const btnHudRadio = document.getElementById('btn-hud-radio');
const btnPwaUpdate = document.getElementById('btn-pwa-update');
const pwaUpdateBanner = document.getElementById('pwa-update-banner');
const pwaUpdateText = document.getElementById('pwa-update-text');
const btnApplyPwaUpdate = document.getElementById('btn-apply-pwa-update');
const coopWaitBannerEl = document.getElementById('coop-wait-banner');
const coopWaitTitleEl = document.getElementById('coop-wait-title');
const coopWaitDetailEl = document.getElementById('coop-wait-detail');
const btnCoopSpectate = document.getElementById('btn-coop-spectate');
const btnCoopFinishNow = document.getElementById('btn-coop-finish-now');

// Session State
let mode = 'menu'; // 'menu' | 'diving' | 'debrief'
let isMultiplayer = false;
let session = null;
let lastFrameMs = 0;
let toastTimer = 0;
let loadSeq = 0;
let inFlightLoad = null; // { seq, levelId, promise }
let cachedLanUrls = [];
let spectatingPeer = false;
let spectatePeerIdx = 0;
let divePaused = false;
let pendingUnsafeGasId = '';
let pendingUnsafeGasAt = 0;
let pendingAbortAt = 0;
let rewindHoldTimer = 0;
let pendingAutoJoinCode = INITIAL_ROOM_CODE;
let directJoinToDive = Boolean(INITIAL_ROOM_CODE);
let joiningRoomCode = INITIAL_ROOM_CODE;
let joiningIsDropIn = false;
let attemptJoinAfterExpire = '';
let suppressNextExpiredError = false;
let activeDiveSeq = 0;
let lastHostPromoMs = 0;
let copyInviteFeedbackTimer = 0;
let knownRoomCode = '';
let knownRoomMemberIds = new Set();
let notifyPromptedOnce = false;
let notifyAlertsMuted = false;
let lbMode = 'solo';
let lbFilterLevelId = activeLevel.id; // 'overall' | level.id

const CALLSIGN_MAX_LEN = 16;

function sanitizeCallsignInput(raw) {
  return String(raw || '')
    .replace(/[\r\n\t<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CALLSIGN_MAX_LEN);
}

function syncCallsignCount() {
  if (!callsignCountEl || !playerNameInput) return;
  const len = playerNameInput.value.trim().length;
  callsignCountEl.textContent = `${len}/${CALLSIGN_MAX_LEN}`;
}

function getEnteredCallsign() {
  return sanitizeCallsignInput(playerNameInput?.value || '');
}

function requireCallsign() {
  const clean = getEnteredCallsign();
  if (clean) {
    if (playerNameInput && playerNameInput.value !== clean) {
      playerNameInput.value = clean;
    }
    syncCallsignCount();
    playerNameInput?.classList.remove('invalid');
    try {
      localStorage.setItem('caveDiverCallsign', clean);
    } catch {}
    return clean;
  }
  if (activeMenuTab === 'leaderboards') {
    setActiveMenuTab('solo');
  }
  playerNameInput?.classList.remove('invalid');
  void playerNameInput?.offsetWidth;
  playerNameInput?.classList.add('invalid');
  playerNameInput?.focus();
  playerNameInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(`Enter your diver callsign (1–${CALLSIGN_MAX_LEN} chars) to dive!`, 3.0);
  if (lanStatus && (!soloPanel || !soloPanel.hidden)) {
    lanStatus.hidden = false;
    lanStatus.className = 'lan-status warn';
    lanStatus.textContent = `Enter a diver callsign (1–${CALLSIGN_MAX_LEN} chars) above first.`;
  }
  return '';
}

// Restore saved player callsign on phone/desktop (no anonymous auto-fill; every diver enters a 1–12 char callsign)
try {
  const savedName = sanitizeCallsignInput(localStorage.getItem('caveDiverCallsign'));
  if (savedName && playerNameInput) {
    playerNameInput.value = savedName;
  } else if (playerNameInput) {
    playerNameInput.value = '';
  }
} catch {
  if (playerNameInput) playerNameInput.value = '';
}
syncCallsignCount();

playerNameInput?.addEventListener('input', () => {
  if (playerNameInput.value.length > CALLSIGN_MAX_LEN) {
    playerNameInput.value = playerNameInput.value.slice(0, CALLSIGN_MAX_LEN);
  }
  syncCallsignCount();
  const clean = getEnteredCallsign();
  if (clean) {
    playerNameInput.classList.remove('invalid');
    try {
      localStorage.setItem('caveDiverCallsign', clean);
    } catch {}
  } else {
    try {
      localStorage.removeItem('caveDiverCallsign');
    } catch {}
  }
});

const nextUiTick = () =>
  new Promise((resolve) => {
    if (document.hidden) {
      setTimeout(resolve, 0);
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(finish);
    setTimeout(finish, 34);
  });

function showToast(text, duration = 2.6) {
  if (!gameToastEl) return;
  gameToastEl.textContent = text;
  gameToastEl.classList.add('visible');
  toastTimer = duration;
}

function getActiveGasName(gasId, diveState = session?.diveState) {
  const mixMap = diveState?.mixes || GAS_MIXES;
  return mixMap[gasId]?.name || GAS_MIXES[gasId]?.name || gasId || 'Gas';
}

function getLevelDepthLabel(level) {
  return `${getLevelMaxDepthM(level)}m`;
}

function getLevelDifficultyLabel(idx, level) {
  const meta = getLevelMeta(level || LEVELS[idx], idx);
  return meta.badge || 'Cave';
}

function getSavedBestScore(levelId) {
  try {
    return Number(localStorage.getItem(`caveDiverBest_${levelId}`) || 0);
  } catch {
    return 0;
  }
}

function setLoaderProgress(pct, label) {
  const clamped = Math.round(Math.min(100, Math.max(0, pct)));
  loaderBarFill.style.width = `${clamped}%`;
  loaderBarTrack.setAttribute('aria-valuenow', String(clamped));
  loaderPctEl.textContent = `${clamped}%`;
  if (label) loaderStepEl.textContent = label;
  if (inlineLoaderFillEl) inlineLoaderFillEl.style.width = `${clamped}%`;
  if (inlineLoaderLabelEl && label) inlineLoaderLabelEl.textContent = `${label} (${clamped}%)`;
}

function setLevelSelectionLocked(locked) {
  if (selectLevel) selectLevel.disabled = locked;
  if (levelLockNoteEl) levelLockNoteEl.hidden = !locked;
  if (levelCardsEl) {
    for (const btn of levelCardsEl.querySelectorAll('.level-card-btn')) {
      btn.disabled = locked;
    }
  }
  if (siteWorldMapEl) {
    for (const pin of siteWorldMapEl.querySelectorAll('.map-pin-btn')) {
      pin.classList.toggle('locked', locked);
    }
  }
  if (logbookSitesEl) {
    for (const btn of logbookSitesEl.querySelectorAll('button[data-logbook-jump]')) {
      btn.disabled = locked;
    }
  }
}

// Removed legacy inline MAP_LANDMASS_POLYGONS (moved to ./game/worldMapData.js)

const SITE_COORDS_BY_ID = new Map(CAMPAIGN_PLAN.map((s) => [s.id, s]));
let siteViewMode = 'split'; // 'split' | 'map' | 'list'
let mapZoomMode = 'global'; // 'global' | 'site'
let currentMapViewBox = { ...GLOBAL_MAP_VIEWBOX };
let mapAnimFrameId = 0;
let mapBaseInitialized = false;

function formatViewBox(vb) {
  return `${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`;
}

function animateMapViewBox(targetVb, instant = false) {
  if (!siteWorldMapEl) return;
  if (mapAnimFrameId) {
    cancelAnimationFrame(mapAnimFrameId);
    mapAnimFrameId = 0;
  }
  if (
    instant ||
    (Math.abs(currentMapViewBox.x - targetVb.x) < 0.05 &&
      Math.abs(currentMapViewBox.y - targetVb.y) < 0.05 &&
      Math.abs(currentMapViewBox.w - targetVb.w) < 0.05 &&
      Math.abs(currentMapViewBox.h - targetVb.h) < 0.05)
  ) {
    currentMapViewBox = { ...targetVb };
    siteWorldMapEl.setAttribute('viewBox', formatViewBox(currentMapViewBox));
    return;
  }

  const startVb = { ...currentMapViewBox };
  const startTime = performance.now();
  const durationMs = 480;

  const tick = (now) => {
    const rawT = Math.min(1, (now - startTime) / durationMs);
    const ease = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;
    currentMapViewBox = {
      x: startVb.x + (targetVb.x - startVb.x) * ease,
      y: startVb.y + (targetVb.y - startVb.y) * ease,
      w: startVb.w + (targetVb.w - startVb.w) * ease,
      h: startVb.h + (targetVb.h - startVb.h) * ease,
    };
    siteWorldMapEl.setAttribute('viewBox', formatViewBox(currentMapViewBox));
    if (rawT < 1) {
      mapAnimFrameId = requestAnimationFrame(tick);
    } else {
      mapAnimFrameId = 0;
      currentMapViewBox = { ...targetVb };
    }
  };
  mapAnimFrameId = requestAnimationFrame(tick);
}

function polylineToSvgPoints(coords) {
  return coords
    .map(([lng, lat]) => {
      const pt = projectMapPoint(lng, lat);
      return `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
    })
    .join(' ');
}

function ensureSiteWorldMapBase() {
  if (!siteWorldMapEl || mapBaseInitialized) return;
  mapBaseInitialized = true;

  const defs = `
    <defs>
      <radialGradient id="mapOceanGlow" cx="55%" cy="42%" r="68%">
        <stop offset="0%" stop-color="#0a2540" />
        <stop offset="65%" stop-color="#041425" />
        <stop offset="100%" stop-color="#020a14" />
      </radialGradient>
      <linearGradient id="mapLandFill" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#174469" />
        <stop offset="100%" stop-color="#0d2a44" />
      </linearGradient>
    </defs>
  `;

  const oceanRect = `<rect x="-80" y="-120" width="540" height="440" fill="url(#mapOceanGlow)" />`;

  // Graticule (15° minor + 30° major + axis labels)
  const gridParts = [];
  for (let lng = -105; lng <= 75; lng += 15) {
    const gx = (lng + 108) * 2;
    const isMajor = lng % 30 === 0;
    gridParts.push(
      `<line x1="${gx}" y1="-40" x2="${gx}" y2="230" vector-effect="non-scaling-stroke" stroke="${
        isMajor ? 'rgba(56,189,248,0.12)' : 'rgba(56,189,248,0.05)'
      }" stroke-width="${isMajor ? 0.8 : 0.5}" ${isMajor ? '' : 'stroke-dasharray="2,3"'} />`
    );
    if (isMajor && lng >= -90 && lng <= 60) {
      const lbl = lng === 0 ? '0°' : `${Math.abs(lng)}°${lng > 0 ? 'E' : 'W'}`;
      gridParts.push(
        `<text x="${(gx + 1.5).toFixed(1)}" y="213" fill="rgba(125,211,252,0.34)" font-size="4.4" font-family="ui-monospace, monospace">${lbl}</text>`
      );
    }
  }
  for (let lat = -45; lat <= 75; lat += 15) {
    const gy = projectMapPoint(0, lat).y;
    const isMajor = lat % 30 === 0;
    gridParts.push(
      `<line x1="-20" y1="${gy.toFixed(2)}" x2="380" y2="${gy.toFixed(2)}" vector-effect="non-scaling-stroke" stroke="${
        isMajor ? 'rgba(56,189,248,0.12)' : 'rgba(56,189,248,0.05)'
      }" stroke-width="${isMajor ? 0.8 : 0.5}" ${isMajor ? '' : 'stroke-dasharray="2,3"'} />`
    );
    if (isMajor && lat >= -30 && lat <= 60) {
      const lbl = lat === 0 ? 'EQ' : `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`;
      gridParts.push(
        `<text x="-7" y="${(gy - 1.5).toFixed(1)}" fill="rgba(125,211,252,0.34)" font-size="4.4" font-family="ui-monospace, monospace">${lbl}</text>`
      );
    }
  }

  // Baked 2646x1736 Miller-projected NASA Blue Marble + Natural Earth 1:10m bathymetric atlas texture
  const mapRaster = `<image href="./assets/map-expedition.jpg?v=133" x="${GLOBAL_MAP_VIEWBOX.x}" y="${GLOBAL_MAP_VIEWBOX.y}" width="${GLOBAL_MAP_VIEWBOX.w}" height="${GLOBAL_MAP_VIEWBOX.h}" preserveAspectRatio="none" />`;

  // Mid-Atlantic tectonic rift ridge overlay
  const trenchPaths = MAP_CONTOUR_LINES.filter((c) => c.kind === 'trench')
    .map(
      ({ coords }) =>
        `<polyline points="${polylineToSvgPoints(coords)}" fill="none" vector-effect="non-scaling-stroke" stroke="rgba(56, 189, 248, 0.28)" stroke-width="0.95" stroke-dasharray="3,3" stroke-linecap="round" stroke-linejoin="round" />`
    )
    .join('');

  siteWorldMapEl.innerHTML = `${defs}<g id="map-base-layer">${oceanRect}${mapRaster}${gridParts.join('')}${trenchPaths}</g><g id="map-overlay-layer"></g>`;
  siteWorldMapEl.setAttribute('viewBox', formatViewBox(currentMapViewBox));
}

let siteCategoryFilter = 'all'; // 'all' | 'cave' | 'wreck' | 'todo'

function setSiteCategoryFilter(nextCat) {
  const valid = nextCat === 'wreck' || nextCat === 'cave' || nextCat === 'todo' ? nextCat : 'all';
  siteCategoryFilter = valid;
  if (siteCatTabsEl) {
    const catIdx = valid === 'cave' ? 1 : valid === 'wreck' ? 2 : valid === 'todo' ? 3 : 0;
    siteCatTabsEl.style.setProperty('--cat-index', String(catIdx));
    for (const b of siteCatTabsEl.querySelectorAll('button[data-site-cat]')) {
      const isAct = b.dataset.siteCat === valid;
      b.classList.toggle('active', isAct);
      b.setAttribute('aria-selected', String(isAct));
    }
  }
}

function getFilteredLevels(bookOverride = null) {
  if (siteCategoryFilter === 'wreck') return LEVELS.filter((l) => Boolean(l.isWreck || l.category === 'wreck'));
  if (siteCategoryFilter === 'cave') return LEVELS.filter((l) => !l.isWreck && l.category !== 'wreck');
  if (siteCategoryFilter === 'todo') {
    const book = bookOverride || loadCareerLogbook();
    return LEVELS.filter((l) => !book.cleared?.[l.id]);
  }
  return LEVELS;
}

function renderSiteWorldMap({ instantZoom = false, book: bookOverride = null } = {}) {
  if (!siteWorldMapEl) return;
  ensureSiteWorldMapBase();

  const locked = Boolean(lan.room && !lan.isHost());
  const book = bookOverride || loadCareerLogbook();
  const visibleLevels = getFilteredLevels(book);
  const activeSlot = SITE_COORDS_BY_ID.get(activeLevel.id);
  const activeVisible = visibleLevels.some((l) => l.id === activeLevel.id);
  const targetVb =
    mapZoomMode === 'site' && activeVisible
      ? computeSiteFocusViewBox(activeLevel.id, activeSlot)
      : { ...GLOBAL_MAP_VIEWBOX };

  if (btnMapZoom) {
    btnMapZoom.textContent = mapZoomMode === 'site' ? '🌍 World' : '🎯 Focus';
    btnMapZoom.title =
      mapZoomMode === 'site' ? 'Zoom out to full global map' : 'Zoom & pan to active dive site';
  }

  const k = Math.max(0.14, Math.min(1, targetVb.w / GLOBAL_MAP_VIEWBOX.w));
  const isZoomed = mapZoomMode === 'site';

  // Pin coordinates (with slight declustering only when in wide global view)
  const pins = visibleLevels.map((lvl) => {
    const idx = Math.max(0, LEVELS.findIndex((l) => l.id === lvl.id));
    const slot = SITE_COORDS_BY_ID.get(lvl.id);
    const pt = projectMapPoint(slot?.lng ?? 0, slot?.lat ?? 20);
    if (!isZoomed) {
      if (lvl.id === 'ox-bel-ha-grand-traverse') {
        pt.y += 2.6;
        pt.x -= 1.2;
      }
      if (lvl.id === 'cenote-el-abismo') {
        pt.y -= 2.2;
        pt.x += 1.0;
      }
      if (lvl.id === 'strytan-hydrothermal-chimneys') {
        pt.x -= 2.4;
        pt.y -= 1.6;
      }
      if (lvl.id === 'grjotagja-kleifarvatn-rift') {
        pt.x += 2.4;
        pt.y -= 0.4;
      }
      if (lvl.id === 'kverkfjoll-subglacial-caves') {
        pt.x += 2.2;
        pt.y += 2.0;
      }
      if (lvl.id === 'silfra-katla-aurora-abyss') {
        pt.x -= 2.0;
        pt.y += 1.4;
      }
      if (lvl.id === 'uss-oriskany-carrier') {
        pt.x -= 2.0;
        pt.y -= 1.6;
      }
    }
    return { lvl, idx, slot, x: pt.x, y: pt.y };
  });

  const routePts = pins.length >= 2 ? pins.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') : '';
  const routeLine = routePts
    ? `<polyline points="${routePts}" fill="none" vector-effect="non-scaling-stroke" stroke="rgba(56, 189, 248, 0.28)" stroke-width="1" stroke-dasharray="3,3" />`
    : '';

  const pinMarkup = pins
    .map(({ lvl, idx, slot, x, y }) => {
      const isSelected = lvl.id === activeLevel.id;
      const isWreck = Boolean(lvl.isWreck || lvl.category === 'wreck');
      const isUnlined = lvl.reelMetersPerDiver > 0;
      const clearRec = book.cleared?.[lvl.id] || null;
      const best = Math.max(getSavedBestScore(lvl.id), clearRec?.score || 0);
      const gradeTag = clearRec?.grade || '';
      const pinColor = isWreck ? '#fb923c' : isUnlined ? '#fbbf24' : '#38bdf8';
      const r = (isSelected ? 5.2 : 3.4) * k;

      const halo = isSelected
        ? `<circle class="map-pin-sonar" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(7.5 * k).toFixed(2)}" vector-effect="non-scaling-stroke" />
           <circle class="map-pin-halo" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(9.0 * k).toFixed(2)}" />`
        : '';
      const crosshair = isSelected
        ? `<g stroke="rgba(224,242,254,0.62)" vector-effect="non-scaling-stroke" stroke-width="1">
             <line x1="${(x - 12 * k).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x - 6.6 * k).toFixed(2)}" y2="${y.toFixed(2)}" />
             <line x1="${(x + 6.6 * k).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x + 12 * k).toFixed(2)}" y2="${y.toFixed(2)}" />
             <line x1="${x.toFixed(2)}" y1="${(y - 12 * k).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y - 6.6 * k).toFixed(2)}" />
             <line x1="${x.toFixed(2)}" y1="${(y + 6.6 * k).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y + 12 * k).toFixed(2)}" />
           </g>`
        : '';
      const ring =
        best > 0
          ? `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(r + 2.0 * k).toFixed(2)}" fill="none" vector-effect="non-scaling-stroke" stroke="#34d399" stroke-width="1.4" />`
          : '';

      // Show short L# tag on selected or nearby zoomed pins; place to the left if near right edge or clustered west (Strytan L15)
      let labelMarkup = '';
      if (isSelected || isZoomed) {
        const placeLeft =
          x > targetVb.x + targetVb.w * 0.6 ||
          lvl.id === 'strytan-hydrothermal-chimneys' ||
          lvl.id === 'silfra-katla-aurora-abyss';
        const anchor = placeLeft ? 'end' : 'start';
        const lx = x + (placeLeft ? -7.2 * k : 7.2 * k);
        const ly = y + 3.4 * k;
        const labelText =
          isSelected && isZoomed
            ? `L${idx + 1} · ${lvl.name}${gradeTag ? ` [${gradeTag}]` : ''}`
            : gradeTag
              ? `L${idx + 1}·${gradeTag}`
              : `L${idx + 1}`;
        labelMarkup = `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="${anchor}" fill="${
          isSelected ? '#f0f9ff' : '#bae6fd'
        }" stroke="#020b14" stroke-width="${(3.4 * k).toFixed(2)}" paint-order="stroke" font-size="${(
          (isSelected ? 11.0 : 9.2) * k
        ).toFixed(2)}" font-weight="700" font-family="ui-monospace, monospace">${escapeHtml(labelText)}</text>`;
      }

      return `
        <g class="map-pin-btn ${isSelected ? 'active' : ''} ${locked ? 'locked' : ''}" data-level-id="${lvl.id}" role="option" aria-selected="${isSelected ? 'true' : 'false'}" tabindex="0">
          <title>L${idx + 1}: ${escapeHtml(lvl.name)} (${escapeHtml(slot?.region || '')} · ${getLevelMaxDepthM(lvl)}m)</title>
          ${halo}
          ${crosshair}
          <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(9.0 * k).toFixed(2)}" fill="transparent" />
          ${ring}
          <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="${pinColor}" stroke="#020b14" vector-effect="non-scaling-stroke" stroke-width="1.4" />
          ${labelMarkup}
        </g>
      `;
    })
    .join('');

  const overlayLayer = siteWorldMapEl.querySelector('#map-overlay-layer');
  if (overlayLayer) {
    const emptyBanner =
      pins.length === 0
        ? `<g><rect x="74" y="82" width="210" height="32" rx="10" fill="rgba(2, 11, 20, 0.88)" stroke="rgba(52, 211, 153, 0.55)" stroke-width="1" /><text x="179" y="101.5" text-anchor="middle" fill="#a7f3d0" font-size="9.5" font-weight="700" font-family="ui-monospace, monospace">ALL ${LEVELS.length} EXPEDITIONS CLEARED!</text></g>`
        : '';
    overlayLayer.innerHTML = `${routeLine}${pinMarkup}${emptyBanner}`;
  }

  animateMapViewBox(targetVb, instantZoom);

  const activeIdx = Math.max(0, LEVELS.findIndex((l) => l.id === activeLevel.id));
  if (siteMapRegionBadgeEl) {
    siteMapRegionBadgeEl.textContent = `L${activeIdx + 1} · ${activeSlot?.region || activeLevel.name} · ${getLevelMaxDepthM(activeLevel)}m`;
  }
  if (siteMapCoordsEl && activeSlot) {
    siteMapCoordsEl.textContent = formatLatLng(activeSlot.lat, activeSlot.lng);
  }
}

function renderLevelCards() {
  if (!levelCardsEl) return;
  const locked = Boolean(lan.room && !lan.isHost());
  const book = loadCareerLogbook();
  const clearedCount = Object.keys(book.cleared || {}).length;
  const nextRecommendedId = LEVELS.find((l) => !book.cleared?.[l.id])?.id || null;
  const visibleLevels = getFilteredLevels(book);
  const pill = document.getElementById('campaign-progress-pill');
  if (pill) {
    pill.textContent =
      siteCategoryFilter === 'wreck'
        ? `${visibleLevels.length} Wrecks · ${clearedCount}/${LEVELS.length}`
        : siteCategoryFilter === 'cave'
          ? `${visibleLevels.length} Caves · ${clearedCount}/${LEVELS.length}`
          : siteCategoryFilter === 'todo'
            ? `${visibleLevels.length} Uncleared`
            : `${clearedCount} / ${LEVELS.length} Cleared`;
  }
  if (visibleLevels.length === 0) {
    levelCardsEl.innerHTML = `<div class="lvl-empty-msg" style="padding:18px;text-align:center;color:#a7f3d0;font-size:0.8rem;">🏆 All ${LEVELS.length} expeditions cleared! Switch to All to chase S+ records.</div>`;
    renderSiteWorldMap({ book });
    return;
  }
  levelCardsEl.innerHTML = visibleLevels.map((lvl) => {
    const idx = Math.max(0, LEVELS.findIndex((l) => l.id === lvl.id));
    const isSelected = lvl.id === activeLevel.id;
    const isWreck = Boolean(lvl.isWreck || lvl.category === 'wreck');
    const isCached = renderer.isLevelCached(lvl.id) || (renderer.ready && renderer.level?.id === lvl.id);
    const clearRec = book.cleared?.[lvl.id] || null;
    const best = Math.max(getSavedBestScore(lvl.id), clearRec?.score || 0);
    const meta = getLevelMeta(lvl, idx);
    const slot = SITE_COORDS_BY_ID.get(lvl.id);
    const depth = `${meta.maxDepthM}m`;
    const isNext = !clearRec && lvl.id === nextRecommendedId;
    const grade = clearRec?.grade || '';
    const gradeCls = grade.startsWith('S') ? 'grade-s' : grade === 'A' ? 'grade-a' : '';
    const modePillHtml = renderModeBadgeHtml(clearRec?.bestDifficulty || clearRec?.lastDifficulty, { compact: true });
    const badgesHtml = grade
      ? `${modePillHtml}<span class="lvl-grade-badge ${gradeCls}">${escapeHtml(grade)}</span>`
      : isNext
        ? `<span class="lvl-next-badge">NEXT</span>`
        : '';
    const timeStr = clearRec?.bestTimeSec > 0 ? ` · ${formatRunClock(clearRec.bestTimeSec)}` : '';
    const metaText =
      best > 0
        ? `✓ ${best.toLocaleString()}${timeStr}`
        : isCached
          ? lvl.reelMetersPerDiver > 0
            ? `✓ Ready · ${lvl.reelMetersPerDiver}m`
            : `✓ Ready`
          : lvl.reelMetersPerDiver > 0
            ? `${isWreck ? 'Wreck Reel' : 'No Line'} · ${lvl.reelMetersPerDiver}m`
            : isWreck
              ? 'Wreck · Fixed Line'
              : getLevelDifficultyLabel(idx, lvl);
    const prefix = isWreck ? '🚢 ' : '';
    const tierTag = lvl.reelMetersPerDiver > 0 ? `${prefix}L${idx + 1} · T${meta.tier}` : `${prefix}L${idx + 1}`;
    return `
      <button
        type="button"
        class="level-card-btn ${isWreck ? 'is-wreck' : ''} ${isSelected ? 'active' : ''}"
        data-level-id="${lvl.id}"
        role="option"
        aria-selected="${isSelected ? 'true' : 'false'}"
        ${locked ? 'disabled' : ''}
      >
        <div class="lvl-card-top">
          <span>${tierTag} · ${slot?.region || ''}</span>
          <span class="lvl-card-badges">${badgesHtml}<span class="lvl-card-depth">${depth}</span></span>
        </div>
        <span class="lvl-card-name">${lvl.name}</span>
        <span class="lvl-card-meta ${best > 0 || isCached ? 'cached' : lvl.reelMetersPerDiver > 0 ? 'reel' : ''}">${metaText}</span>
      </button>
    `;
  }).join('');

  const activeBtn = levelCardsEl.querySelector('.level-card-btn.active');
  activeBtn?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  renderSiteWorldMap({ book });
}

function retriggerAnim(el, className) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  const cleanup = () => el.classList.remove(className);
  el.addEventListener('animationend', cleanup, { once: true });
}

let menuDescExpanded = false;

function syncMenuDescToggle() {
  if (!menuDescEl || !btnDescToggle) return;
  if (menuDescExpanded) {
    menuDescEl.classList.remove('clamped');
    btnDescToggle.hidden = false;
    btnDescToggle.textContent = 'Less ▴';
    btnDescToggle.setAttribute('aria-expanded', 'true');
    return;
  }
  menuDescEl.classList.add('clamped');
  const overflows = menuDescEl.clientHeight > 0 && menuDescEl.scrollHeight > menuDescEl.clientHeight + 2;
  btnDescToggle.hidden = !overflows;
  btnDescToggle.textContent = 'More ▾';
  btnDescToggle.setAttribute('aria-expanded', 'false');
}

btnDescToggle?.addEventListener('click', () => {
  menuDescExpanded = !menuDescExpanded;
  syncMenuDescToggle();
  if (menuDescExpanded) {
    retriggerAnim(menuDescEl, 'anim-telemetry-swap');
  }
});

window.addEventListener('resize', () => {
  if (!screenMenu.hidden) syncMenuDescToggle();
});

function syncMenuLevelLabels(level, { animate = false } = {}) {
  const idx = LEVELS.findIndex((l) => l.id === level.id);
  const lvlNum = idx >= 0 ? idx + 1 : 1;
  btnPlaySolo.textContent = level.isProcedural
    ? `DIVE · ∞ #${level.proceduralMeta?.seed || 'SUMP'}`
    : `DIVE · LEVEL ${lvlNum}`;
  const menuTitle = screenMenu.querySelector('.menu-title');
  const menuDesc = menuDescEl || screenMenu.querySelector('.menu-desc');
  const loaderTitle = screenLoader.querySelector('.loader-title');
  const loaderMetaSpan = screenLoader.querySelector('.loader-meta span');
  if (menuTitle) {
    menuTitle.textContent = level.name.toUpperCase();
    if (animate) retriggerAnim(menuTitle, 'anim-telemetry-swap');
  }
  if (menuDesc && level.description) {
    menuDescExpanded = false;
    menuDesc.textContent = level.description;
    requestAnimationFrame(syncMenuDescToggle);
    if (animate) retriggerAnim(menuDesc, 'anim-telemetry-swap');
  }
  if (loaderTitle) loaderTitle.textContent = level.name.toUpperCase();
  if (loaderMetaSpan && level.subtitle) loaderMetaSpan.textContent = level.subtitle.toUpperCase();
  renderLevelCards();
  if (animate) {
    retriggerAnim(siteMapRegionBadgeEl, 'anim-badge-lock');
    retriggerAnim(siteMapCoordsEl, 'anim-badge-lock');
  }
}

function populateLevelSelect() {
  if (selectLevel) {
    selectLevel.innerHTML = '';
    LEVELS.forEach((lvl, idx) => {
      const opt = document.createElement('option');
      opt.value = lvl.id;
      opt.textContent = `L${idx + 1}: ${lvl.name}`;
      selectLevel.appendChild(opt);
    });
    selectLevel.value = activeLevel.id;
  }
  syncMenuLevelLabels(activeLevel);
}

async function ensureLevelLoaded(levelId, { showOverlay = true, keepOpenAfterLoad = false } = {}) {
  const nextLevel = getLevelById(levelId);

  // Deduplicate identical in-flight load so rapid events (e.g. dive_preparing + dive_started) share one build
  if (inFlightLoad && inFlightLoad.levelId === nextLevel.id) {
    if (showOverlay) screenLoader.classList.remove('done');
    return inFlightLoad.promise;
  }

  if (
    activeLevel.id === nextLevel.id &&
    renderer.ready &&
    renderer.level?.id === nextLevel.id &&
    ecosystem &&
    !inFlightLoad
  ) {
    lan.setPlayerStatus({ loadStatus: 'ready', loadPct: 100, loadedLevelId: nextLevel.id });
    renderLevelCards();
    if (showOverlay && keepOpenAfterLoad) {
      screenLoader.classList.remove('done');
      setLoaderProgress(100, 'Dive systems ready — syncing crew...');
    } else if (showOverlay && !keepOpenAfterLoad) {
      screenLoader.classList.add('done');
    }
    return nextLevel;
  }

  const mySeq = ++loadSeq;
  activeLevel = nextLevel;
  if (selectLevel) selectLevel.value = nextLevel.id;
  syncMenuLevelLabels(nextLevel, { animate: true });
  if (typeof syncGasPlanBadges === 'function') syncGasPlanBadges();

  const isCached = renderer.isLevelCached(nextLevel.id);
  const mapPct = (rawPct) => {
    const p = Math.max(0, Math.min(100, rawPct));
    return joiningRoomCode ? Math.round(44 + (p / 100) * 52) : p;
  };
  if (showOverlay && (!isCached || keepOpenAfterLoad)) {
    screenLoader.classList.remove('done');
  }
  if (!isCached && inlineLoaderEl) {
    inlineLoaderEl.hidden = false;
  }
  setLoaderProgress(mapPct(isCached ? 95 : 8), `Loading ${nextLevel.name}...`);

  let lastStatusBroadcastAt = 0;
  let lastBroadcastPct = -1;
  const broadcastLoadProgress = (pct, force = false) => {
    const rounded = Math.round(pct);
    const now = performance.now();
    if (!force && (now - lastStatusBroadcastAt < 220 || Math.abs(rounded - lastBroadcastPct) < 12)) {
      return;
    }
    lastStatusBroadcastAt = now;
    lastBroadcastPct = rounded;
    lan.setPlayerStatus({
      loadStatus: rounded >= 100 ? 'ready' : 'loading',
      loadPct: rounded,
      loadedLevelId: nextLevel.id,
    });
  };
  if (!isCached) {
    broadcastLoadProgress(5, true);
  }

  const runPromise = (async () => {
    try {
      const res = await renderer.setLevel(nextLevel, {
        onProgress: (pct, label) => {
          if (mySeq !== loadSeq) return;
          setLoaderProgress(mapPct(pct), label);
          if (pct < 100) broadcastLoadProgress(pct);
        },
      });
      if (res?.cancelled || mySeq !== loadSeq) return nextLevel;
      setLoaderProgress(mapPct(96), 'Populating marine life & ecosystems...');
      await nextUiTick();
      if (mySeq !== loadSeq) return nextLevel;
      ecosystem = createMarineEcosystem(nextLevel);
      setLoaderProgress(
        joiningRoomCode && keepOpenAfterLoad ? 98 : 100,
        keepOpenAfterLoad ? 'Dive systems ready — syncing with crew...' : 'Dive systems ready.'
      );
      lan.setPlayerStatus({ loadStatus: 'ready', loadPct: 100, loadedLevelId: nextLevel.id });
      renderLevelCards();
    } catch (err) {
      if (mySeq !== loadSeq) return nextLevel;
      console.error('Level load error:', err);
      if (!renderer.rockChunks.length) {
        renderer.backChunks = renderer._buildBackChunks(nextLevel);
        renderer.rockChunks = renderer._buildRockChunks(nextLevel);
        renderer.dustMotes = renderer._buildDustMotes(nextLevel);
        renderer.ready = true;
      }
      ecosystem = createMarineEcosystem(nextLevel);
      setLoaderProgress(100, 'Loaded with fallback textures.');
      lan.setPlayerStatus({ loadStatus: 'ready', loadPct: 100, loadedLevelId: nextLevel.id });
      renderLevelCards();
    } finally {
      if (inFlightLoad?.seq === mySeq) {
        inFlightLoad = null;
      }
      if (mySeq === loadSeq) {
        if (inlineLoaderEl) inlineLoaderEl.hidden = true;
        if (showOverlay && !keepOpenAfterLoad) {
          setTimeout(() => {
            if (mySeq === loadSeq) screenLoader.classList.add('done');
          }, isCached ? 50 : 120);
        }
      }
    }
    return nextLevel;
  })();

  inFlightLoad = { seq: mySeq, levelId: nextLevel.id, promise: runPromise };
  return runPromise;
}

function handleReelToggle() {
  if (mode !== 'diving' || !session || session.endedState) return;
  const res = toggleGuidelineReel(session);
  if (res.action === 'start_reel') {
    audio.playReelClick();
    showToast(`Anchored reel! Paying out cave line (${Math.round(session.reelRemainingM)}m left).`, 2.2);
    if (isMultiplayer) lan.sendGuidelineSync(session.guidelineChains, true);
  } else if (res.action === 'tie_off') {
    audio.playReelClick();
    showToast(`Line tied off (${Math.round(session.reelRemainingM)}m remaining on spool).`, 2.0);
    if (isMultiplayer) lan.sendGuidelineSync(session.guidelineChains, false);
  } else if (res.action === 'empty') {
    showToast('Reel spool empty! Swim near line tail & press [R] to rewind.', 2.4);
  }
}

function handleReelRewind() {
  if (mode !== 'diving' || !session || session.endedState) return;
  const res = rewindGuidelineSegment(session);
  if (res.action === 'rewound') {
    audio.playReelClick();
    const msg = res.recoveredM > 0.2
      ? `Rewound +${res.recoveredM.toFixed(1)}m (${Math.round(session.reelRemainingM)}m left).`
      : 'Cleared live reel pin.';
    showToast(msg, 1.8);
    if (isMultiplayer) lan.sendGuidelineSync(session.guidelineChains, false);
  } else if (res.action === 'too_far') {
    showToast('Swim close to line tail to rewind segment.', 2.0);
  } else if (res.action === 'empty') {
    showToast('No deployed line segments to rewind.', 1.8);
  }
}

function setDivePaused(paused) {
  const next = Boolean(paused) && mode === 'diving' && !isMultiplayer && Boolean(session && !session.endedState);
  divePaused = next;
  if (next) {
    input?.resetAll?.();
    audio.resetEnvironmentFilter();
  }
  if (hudPauseOverlay) hudPauseOverlay.hidden = !next;
}

function trySwitchGas(gasId, { bypassSafety = false } = {}) {
  if (mode !== 'diving' || !session || divePaused) return false;
  const ds = session.diveState;
  const tank = ds?.tanks?.[gasId];
  const mix = GAS_MIXES[gasId];
  if (!tank || !mix) return false;
  if (ds.activeGasId === gasId) return true;
  if (tank.bar <= 0.1) {
    showToast(`${getActiveGasName(gasId)} cylinder empty!`, 1.8);
    return false;
  }

  // Double-tap safety guard against accidental lethal O2 or hypoxic switches
  const now = performance.now();
  const futurePPO2 = computePPO2(ds.depthM, mix);
  const isHyperoxic = futurePPO2 > 1.65;
  const isHypoxic = futurePPO2 < 0.16 && ds.depthM > 0.2;
  if (!bypassSafety && (isHyperoxic || isHypoxic)) {
    const confirmed = pendingUnsafeGasId === gasId && now - pendingUnsafeGasAt <= 2500;
    if (!confirmed) {
      pendingUnsafeGasId = gasId;
      pendingUnsafeGasAt = now;
      audio.playAlarm('warn');
      const reason = isHyperoxic
        ? `TOXIC PPO2 ${futurePPO2.toFixed(2)}`
        : `HYPOXIC PPO2 ${futurePPO2.toFixed(2)}`;
      showToast(
        `⚠️ ${getActiveGasName(gasId)} UNSAFE at ${Math.round(ds.depthM)}m (${reason})! Tap again to force`,
        2.6
      );
      return false;
    }
  }
  pendingUnsafeGasId = '';
  pendingUnsafeGasAt = 0;

  if (switchGas(ds, gasId)) {
    audio.playGasSwitch();
    if (session.drills?.active?.kind === 'free-flow') {
      resolveEmergencyDrill(session, 'free-flow', sessionStepCallbacks);
    } else {
      showToast(`Switched regulator to ${getActiveGasName(gasId)}`, 1.8);
    }
    return true;
  }
  showToast(`${getActiveGasName(gasId)} cylinder empty!`, 1.8);
  return false;
}

function handleBuddyLocatePing(targetPeerId = '') {
  if (mode !== 'diving' || !session || !isMultiplayer) return false;
  const peers = lan.getPeers();
  if (!peers || peers.length === 0) return false;
  const peer =
    (targetPeerId ? peers.find((p) => p && (p.id === targetPeerId || p.name === targetPeerId)) : null) ||
    peers.find((p) => p && p.alive === false && !p.rescued) ||
    peers.find((p) => p && !p.surfaced) ||
    peers[0];
  if (!peer) return false;
  const res = triggerBuddyLocatePing(session, peer, sessionStepCallbacks);
  return Boolean(res?.ok);
}

const hud = new DiveComputerHUD({
  onGasSelect: (gasId) => trySwitchGas(gasId),
  onReelToggle: handleReelToggle,
  onReelRewind: handleReelRewind,
  onReelRewindHold: (held) => input?.setTouchRewindHeld(held),
  onBuddySelect: (pid) => handleBuddyLocatePing(pid),
  onHeartbeatPulse: (bpm) => {
    if (mode === 'diving' && !divePaused && !session?.endedState && session?.diveState?.alive !== false) {
      audio.playHeartbeat(bpm);
    }
  },
});

const input = new InputController({
  stickBaseEl: document.getElementById('touch-stick'),
  stickKnobEl: document.getElementById('touch-knob'),
  torchStickBaseEl: document.getElementById('torch-stick'),
  torchStickKnobEl: document.getElementById('torch-knob'),
  onGasSelect: (gasId) => trySwitchGas(gasId),
  onRecommendedGasSwitch: () => {
    if (mode !== 'diving' || !session || divePaused) return false;
    const ds = session.diveState;
    const ascending =
      session.checkpointsHit.size >= (session.level.checkpoints?.length || 1) ||
      Boolean(session.carryingBody || session.bodyRecovered) ||
      ds.stopDepthM > 0;
    const rec = getRecommendedGas(ds, { ascending });
    if (rec && rec !== ds.activeGasId) {
      return trySwitchGas(rec);
    }
    showToast(`Optimal gas already active (${getActiveGasName(ds.activeGasId)})`, 1.5);
    return true;
  },
  onPauseToggle: () => {
    if (shearwaterOpen) {
      toggleShearwaterComputer(false);
      return true;
    }
    if (signalWheelOpen) {
      toggleSignalWheel(false);
      return true;
    }
    if (hudMenuPopover && !hudMenuPopover.hidden) {
      setHudMenuOpen(false);
      return true;
    }
    if (modalLogbook && !modalLogbook.hidden) {
      closeLogbookModal();
      return true;
    }
    if (dailyCalModalEl && !dailyCalModalEl.hidden) {
      closeDailyCalendarModal();
      return true;
    }
    if (proceduralModal && !proceduralModal.hidden) {
      closeProceduralModal();
      return true;
    }
    if (audioMixerModalEl && !audioMixerModalEl.hidden) {
      closeAudioMixerModal();
      return true;
    }
    if (gasPlannerModal && !gasPlannerModal.hidden) {
      closeGasPlannerModal();
      return true;
    }
    if (replayModal && !replayModal.hidden) {
      closeReplayModal();
      return true;
    }
    if (challengeModal && !challengeModal.hidden) {
      closeChallengeModal();
      return true;
    }
    if (modalDiveGuide && !modalDiveGuide.hidden) {
      closeDiveGuideModal(false);
      return true;
    }
    if (mode !== 'diving' || !session || session.endedState) return false;
    if (isMultiplayer) {
      showToast('Co-op dives run live — pause is solo-only.', 1.8);
      return true;
    }
    setDivePaused(!divePaused);
    return true;
  },
  onTorchToggle: () => {
    if (!session?.diver || divePaused) return;
    if (session.drills?.active?.kind === 'torch-fail') {
      resolveEmergencyDrill(session, 'torch-fail', sessionStepCallbacks);
      return;
    }
    session.diver.torchOn = !session.diver.torchOn;
  },
  onReelToggle: handleReelToggle,
  onReelRewind: handleReelRewind,
  onWreckAction: () => handleWreckAction(),
  onSonarPing: () => handleSonarPing(),
  onDpvToggle: () => handleDpvToggle(),
  onMinimapToggle: () => handleMinimapToggle(),
  onCameraSnap: () => handleCameraSnap(),
  onBuddyPing: () => handleBuddyLocatePing(''),
  onStageDrop: () => handleStageDrop(),
  onComputerToggle: () => toggleShearwaterComputer(),
  onSignalWheelToggle: () => toggleSignalWheel(),
});

// Scuba Hand-Signals & Torch Light-Signaling Wheel (v127)
const signalWheelEl = document.getElementById('signal-wheel');
const signalWheelGridEl = document.getElementById('signal-wheel-grid');
const btnSignalWheelClose = document.getElementById('btn-signal-wheel-close');
const btnHudSignalsEl = document.getElementById('btn-hud-signals');
let signalWheelOpen = false;

function dispatchScubaSignal(idOrText) {
  if (mode !== 'diving' || !session || !session.diver || divePaused) return false;
  const spec = triggerDiverSignal(session.diver, idOrText, performance.now());
  if (!spec) return false;
  if (lan?.roomCode) lan.sendSignal(spec.text);
  audio.playSignal?.();
  showToast(lan?.roomCode ? `Signaled crew: ${spec.text}` : `Dive Signal: ${spec.text}`, 2.1);
  toggleSignalWheel(false);
  return true;
}

function toggleSignalWheel(forceState) {
  if (mode !== 'diving' && forceState !== false) return false;
  signalWheelOpen = typeof forceState === 'boolean' ? forceState : !signalWheelOpen;
  if (signalWheelEl) signalWheelEl.hidden = !signalWheelOpen;
  if (btnHudSignalsEl) btnHudSignalsEl.classList.toggle('active', signalWheelOpen);
  return true;
}

if (signalWheelGridEl) {
  signalWheelGridEl.innerHTML = SCUBA_SIGNALS.map(
    (s) =>
      `<button type="button" class="signal-wheel-btn" data-sig-id="${s.id}" style="--sig-col:${s.color}">` +
      `<strong>${s.text}</strong><span>${s.desc}</span></button>`
  ).join('');
  signalWheelGridEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-sig-id]');
    if (!btn) return;
    dispatchScubaSignal(btn.dataset.sigId);
  });
}
btnHudSignalsEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSignalWheel();
});
btnSignalWheelClose?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSignalWheel(false);
});

// Shearwater ZH-L16C OLED Dive Computer Overlay (v126/v129)
const shearwaterPanelEl = document.getElementById('shearwater-panel');
const shearwaterCanvasEl = document.getElementById('shearwater-canvas');
const btnShearwaterCloseEl = document.getElementById('btn-shearwater-close');
const btnHudComputerEl = document.getElementById('btn-hud-computer');
let shearwaterOpen = false;
let lastShearwaterDrawMs = 0;

function toggleShearwaterComputer(forceState) {
  if (mode !== 'diving' && forceState !== false) return false;
  shearwaterOpen = typeof forceState === 'boolean' ? forceState : !shearwaterOpen;
  if (shearwaterPanelEl) shearwaterPanelEl.hidden = !shearwaterOpen;
  if (btnHudComputerEl) btnHudComputerEl.classList.toggle('active', shearwaterOpen);
  if (shearwaterOpen && session?.diveState && shearwaterCanvasEl) {
    const sctx = shearwaterCanvasEl.getContext('2d');
    if (sctx) drawShearwaterComputer(sctx, shearwaterCanvasEl.width, shearwaterCanvasEl.height, session.diveState);
  }
  return true;
}
btnHudComputerEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleShearwaterComputer();
});
btnShearwaterCloseEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleShearwaterComputer(false);
});
shearwaterCanvasEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleShearwaterComputer(false);
});

const btnWreckAction = document.getElementById('btn-wreck-action');
const wreckActionLabelEl = document.getElementById('wreck-action-label');
const wreckActionDetailEl = document.getElementById('wreck-action-detail');
const wreckActionProgressEl = document.getElementById('wreck-action-progress');
let lastWreckActionKey = '';

// Live Sonar Cave & Wreck Cartography Minimap state & controls (v109)
const MINIMAP_PREF_KEY = 'caveDiverMinimap_v1';
const btnMinimap = document.getElementById('btn-minimap');
const hudMinimapWrapEl = document.getElementById('hud-minimap-wrap');
let minimapVisible = true;
let minimapZoomMode = 'follow'; // 'follow' | 'full'
const _minimapPlayerLines = [];
try {
  if (localStorage.getItem(MINIMAP_PREF_KEY) === '0') minimapVisible = false;
} catch {}

function syncMinimapButtonUi() {
  if (!btnMinimap) return;
  const diff = session?.difficulty || activeDifficulty;
  const mut = session?.mutatorId || '';
  const allowed = isMinimapAllowed(diff, mut);
  btnMinimap.classList.toggle('active', allowed && minimapVisible);
  btnMinimap.classList.toggle('disabled-mode', !allowed);
  btnMinimap.title = !allowed
    ? 'Sonar Minimap disabled in Hardcore / Zero-Gear Purist mode'
    : minimapVisible
      ? 'Hide Sonar Minimap (M)'
      : 'Show Sonar Minimap (M)';
}

function handleMinimapToggle() {
  if (mode !== 'diving' || !session || divePaused) return false;
  const allowed = isMinimapAllowed(session.difficulty || activeDifficulty, session.mutatorId || '');
  if (!allowed) {
    showToast('🧭 Sonar Minimap disabled in Hardcore / Zero-Gear Purist mode.', 2.2);
    return true;
  }
  minimapVisible = !minimapVisible;
  try { localStorage.setItem(MINIMAP_PREF_KEY, minimapVisible ? '1' : '0'); } catch {}
  syncMinimapButtonUi();
  showToast(minimapVisible ? '📡 Sonar Minimap: On (tap map for Full Survey)' : '📡 Sonar Minimap: Hidden [M]', 1.8);
  return true;
}

function toggleMinimapZoom() {
  if (mode !== 'diving' || !session || !minimapVisible) return;
  if (!isMinimapAllowed(session.difficulty || activeDifficulty, session.mutatorId || '')) return;
  minimapZoomMode = minimapZoomMode === 'follow' ? 'full' : 'follow';
  showToast(minimapZoomMode === 'full' ? '🗺️ Sonar Map: Full Site Survey' : '🗺️ Sonar Map: Tactical Follow Zoom', 1.6);
}

btnMinimap?.addEventListener('click', (e) => {
  e.stopPropagation();
  handleMinimapToggle();
});

// Underwater Strobe Camera & Marine Field Guide controls (v110)
const btnCamera = document.getElementById('btn-camera');
const hudPhotoCardEl = document.getElementById('hud-photo-card');
const hudPhotoIconEl = document.getElementById('hud-photo-icon');
const hudPhotoNameEl = document.getElementById('hud-photo-name');
const hudPhotoBadgeEl = document.getElementById('hud-photo-badge');
const hudPhotoSubEl = document.getElementById('hud-photo-sub');
let hudPhotoCardTimer = 0;

function hideHudPhotoCard() {
  clearTimeout(hudPhotoCardTimer);
  hudPhotoCardTimer = 0;
  if (hudPhotoCardEl) hudPhotoCardEl.hidden = true;
}

function showHudPhotoCard(res, fgStats) {
  if (!hudPhotoCardEl || !res?.subject) return;
  clearTimeout(hudPhotoCardTimer);
  const starStr = '★'.repeat(Math.max(1, Math.min(3, res.stars || 1)));
  if (hudPhotoIconEl) hudPhotoIconEl.textContent = res.subject.icon || '📷';
  if (hudPhotoNameEl) hudPhotoNameEl.textContent = res.subject.name;
  if (hudPhotoBadgeEl) {
    hudPhotoBadgeEl.hidden = !res.isNewInGuide && !res.upgradedStars;
    hudPhotoBadgeEl.textContent = res.isNewInGuide ? 'NEW GUIDE!' : 'UPGRADED!';
  }
  const ptsTxt = res.points > 0 ? ` · +${res.points} pts` : '';
  const guideTxt = fgStats ? ` · Guide ${fgStats.discoveredCount}/${fgStats.totalCount}` : '';
  if (hudPhotoSubEl) hudPhotoSubEl.textContent = `${starStr}${ptsTxt}${guideTxt}`;
  hudPhotoCardEl.classList.toggle('is-new', Boolean(res.isNewInGuide));
  hudPhotoCardEl.hidden = false;
  hudPhotoCardTimer = setTimeout(() => {
    hudPhotoCardTimer = 0;
    if (hudPhotoCardEl) hudPhotoCardEl.hidden = true;
  }, 3200);
}

function handleCameraSnap() {
  if (mode !== 'diving' || !session || divePaused || session.endedState) return false;
  const book = loadCareerLogbook();
  const knownIds = new Set(Object.keys(book.fieldGuide || {}));
  const res = captureCameraPhoto(session, ecosystem, { knownIds });
  if (!res.ok) {
    if (res.reason === 'cooldown') {
      showToast('📷 Strobe recharging...', 0.9);
      return true;
    }
    return false;
  }
  audio.playCameraShutter(Boolean(res.subject), Boolean(res.isNewInGuide));
  if (res.subject) {
    const saved = recordFieldGuidePhoto(book, {
      entryId: res.subject.id,
      stars: res.stars,
      siteId: session.level?.id || '',
      siteName: session.level?.name || '',
      depthM: res.depthM,
    });
    saveCareerLogbook(saved.book);
    const fgStats = getFieldGuideStats(saved.book);
    showHudPhotoCard({ ...res, upgradedStars: saved.upgradedStars }, fgStats);
  } else {
    showToast('📷 Snap! Aim torch at wildlife, corals, crystals or vents.', 1.8);
  }
  return true;
}

btnCamera?.addEventListener('click', (e) => {
  e.stopPropagation();
  handleCameraSnap();
});
hudMinimapWrapEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMinimapZoom();
});
hudMinimapWrapEl?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggleMinimapZoom();
  }
});

// Unlockable Tech Gear Loadout (Cave Sonar, DPV Scooter & CCR Rebreather tied to Cert Ladder)
const GEAR_LOADOUT_KEY = 'caveDiverGearLoadout_v1';
const gearDockGridEl = document.getElementById('gear-dock-grid');
const gearDockSubEl = document.getElementById('gear-dock-sub');
const hudGearDockEl = document.getElementById('hud-gear-dock');
const hudDrillPill = document.getElementById('hud-drill-pill');
const btnHudStage = document.getElementById('btn-hud-stage');
const btnHudSonar = document.getElementById('btn-hud-sonar');
const btnHudDpv = document.getElementById('btn-hud-dpv');
const hudCcrPill = document.getElementById('hud-ccr-pill');
const debriefGearBadgeEl = document.getElementById('debrief-gear-badge');
const dailyChallengeCardEl = document.getElementById('daily-challenge-card');
const dailyDateLabelEl = document.getElementById('daily-date-label');
const dailyStreakPillEl = document.getElementById('daily-streak-pill');
const dailySiteTitleEl = document.getElementById('daily-site-title');
const dailyMutatorBadgeEl = document.getElementById('daily-mutator-badge');
const dailyMutatorDescEl = document.getElementById('daily-mutator-desc');
const btnPlayDaily = document.getElementById('btn-play-daily');
const debriefDailyBadgeEl = document.getElementById('debrief-daily-badge');
let activeDailyChallenge = null;
let savedGearLoadout = { sonar: false, dpv: false, ccr: false };
let lastGearHudKey = '';
try {
  const rawGear = localStorage.getItem(GEAR_LOADOUT_KEY);
  if (rawGear) {
    const parsedGear = JSON.parse(rawGear);
    if (parsedGear && typeof parsedGear === 'object') {
      savedGearLoadout = {
        sonar: Boolean(parsedGear.sonar),
        dpv: Boolean(parsedGear.dpv),
        ccr: Boolean(parsedGear.ccr),
      };
    }
  }
} catch {}

function saveGearLoadout({ skipCloudSync = false } = {}) {
  try {
    localStorage.setItem(GEAR_LOADOUT_KEY, JSON.stringify(savedGearLoadout));
  } catch {}
  if (!skipCloudSync) scheduleGitHubStatsSync();
}

function getEffectiveGearLoadout() {
  const book = loadCareerLogbook();
  const { unlockedIds } = computeUnlockedGear(book, LEVELS);
  return sanitizeGearLoadout(savedGearLoadout, unlockedIds);
}

function getDailyGeneratedExpedition(dateOrKey = new Date()) {
  const cfg = getDailyGeneratedConfig(dateOrKey);
  const level = getLevelById(cfg.levelId);
  const mutator = getDailyMutatorForDate(cfg.dateKey);
  return {
    dateKey: cfg.dateKey,
    seed: cfg.seed,
    tier: cfg.tier,
    biome: cfg.biome,
    biomeSpec: cfg.biomeSpec,
    tierSpec: cfg.tierSpec,
    unlined: cfg.unlined,
    level,
    levelId: level.id,
    mutator,
    mutatorId: mutator.id,
  };
}

function renderDailyChallengeCard() {
  if (!dailyChallengeCardEl) return;
  const daily = getDailyGeneratedExpedition();
  const book = loadCareerLogbook();
  const status = getDailyStatus(book, daily.dateKey);
  dailyChallengeCardEl.classList.toggle('cleared', status.clearedToday);
  if (dailyDateLabelEl) {
    dailyDateLabelEl.textContent = daily.dateKey;
  }
  if (dailyStreakPillEl) {
    const streakLabel = `🔥 ${status.activeStreak}d Streak`;
    dailyStreakPillEl.textContent = status.clearedToday ? `✓ Cleared · ${streakLabel}` : streakLabel;
    dailyStreakPillEl.title =
      status.bestStreak > 0
        ? `Best Streak: ${status.bestStreak}d · Total Daily Clears: ${status.totalClears}`
        : 'Clear today’s daily generated sump to start your streak!';
  }
  if (dailySiteTitleEl && daily.level) {
    const lineTag = daily.unlined ? ' · 🧵 Unlined' : '';
    dailySiteTitleEl.textContent = `∞ ${daily.level.name} · ${daily.level.proceduralMeta?.targetDepthM || getLevelMaxDepthM(daily.level)}m${lineTag}`;
  }
  if (dailyMutatorBadgeEl && daily.mutator) {
    dailyMutatorBadgeEl.textContent = `${daily.mutator.icon} ${daily.mutator.name}`;
  }
  if (dailyMutatorDescEl && daily.mutator) {
    dailyMutatorDescEl.textContent = daily.mutator.shortDesc || daily.mutator.summary || '';
  }
  if (btnPlayDaily) {
    btnPlayDaily.textContent = status.clearedToday ? '↻ REPLAY DAILY' : '▶ PLAY DAILY';
  }
}

// ─── Daily Generated Sump Calendar Modal (v131) ───
const dailyCalModalEl = document.getElementById('daily-calendar-modal');
const btnOpenDailyCalendar = document.getElementById('btn-open-daily-calendar');
const btnDailyCalClose = document.getElementById('btn-daily-cal-close');
const btnDailyCalPrev = document.getElementById('btn-daily-cal-prev');
const btnDailyCalNext = document.getElementById('btn-daily-cal-next');
const dailyCalMonthLabelEl = document.getElementById('daily-cal-month-label');
const dailyCalStatsEl = document.getElementById('daily-cal-stats');
const dailyCalGridEl = document.getElementById('daily-cal-grid');
const dailyCalSelTitleEl = document.getElementById('daily-cal-sel-title');
const dailyCalSelBadgeEl = document.getElementById('daily-cal-sel-badge');
const dailyCalSelMetaEl = document.getElementById('daily-cal-sel-meta');
const dailyCalSelRecordEl = document.getElementById('daily-cal-sel-record');
const btnDailyCalLaunch = document.getElementById('btn-daily-cal-launch');

let dailyCalYear = new Date().getUTCFullYear();
let dailyCalMonth0 = new Date().getUTCMonth();
let dailyCalSelectedKey = getUtcDateKey();

function renderDailyCalendarModal() {
  if (!dailyCalModalEl || !dailyCalGridEl) return;
  const book = loadCareerLogbook();
  const todayKey = getUtcDateKey();
  const cal = buildDailyCalendarMonth(book, dailyCalYear, dailyCalMonth0, todayKey);
  const status = getDailyStatus(book, todayKey);

  if (dailyCalMonthLabelEl) dailyCalMonthLabelEl.textContent = cal.monthLabel;
  if (dailyCalStatsEl) {
    dailyCalStatsEl.textContent =
      `🔥 ${status.activeStreak}d Streak · 🏆 Best ${status.bestStreak}d · ✅ ${cal.clearedInMonth}/${cal.availableInMonth} this month (${status.totalClears} total)`;
  }
  if (btnDailyCalNext) {
    const todayY = Number(todayKey.slice(0, 4));
    const todayM0 = Number(todayKey.slice(5, 7)) - 1;
    btnDailyCalNext.disabled = cal.year > todayY || (cal.year === todayY && cal.month0 >= todayM0);
  }

  let html = '';
  for (let s = 0; s < cal.firstWeekday; s++) {
    html += '<div class="daily-cal-spacer" aria-hidden="true"></div>';
  }
  for (const cell of cal.days) {
    const classes = ['daily-cal-cell'];
    if (cell.cleared) classes.push('cleared');
    if (cell.isToday) classes.push('today');
    if (cell.isFuture) classes.push('future');
    if (cell.dateKey === dailyCalSelectedKey) classes.push('selected');
    const sub = cell.isFuture ? '🔒' : cell.cleared ? (cell.grade || '✓') : cell.isToday ? 'NOW' : '·';
    html +=
      `<button type="button" class="${classes.join(' ')}" data-cal-date="${cell.dateKey}"` +
      (cell.isFuture ? ' disabled' : '') +
      ` aria-label="${cell.dateKey}${cell.cleared ? ' cleared' : ''}">` +
      `<span>${cell.day}</span><span class="daily-cal-cell-sub">${sub}</span></button>`;
  }
  dailyCalGridEl.innerHTML = html;

  // Render preview for selected day
  const selKey = dailyCalSelectedKey <= todayKey ? dailyCalSelectedKey : todayKey;
  dailyCalSelectedKey = selKey;
  const daily = getDailyGeneratedExpedition(selKey);
  const rec = book.daily?.records?.[selKey] || null;
  const depthM = daily.level?.proceduralMeta?.targetDepthM || getLevelMaxDepthM(daily.level);
  const isTodaySel = selKey === todayKey;
  if (dailyCalSelTitleEl) {
    dailyCalSelTitleEl.textContent = `${isTodaySel ? 'Today · ' : ''}${selKey} · ${daily.level.name}`;
  }
  if (dailyCalSelBadgeEl && daily.mutator) {
    dailyCalSelBadgeEl.textContent = `${daily.mutator.icon} ${daily.mutator.name}`;
  }
  if (dailyCalSelMetaEl) {
    const gasName = daily.level.gasOverrides?.TMX1455?.name || 'TMX 14/55';
    dailyCalSelMetaEl.textContent =
      `Seed #${daily.seed} · ${daily.biomeSpec.label} · ${depthM}m (${gasName})${daily.unlined ? ' · 🧵 Unlined Reel' : ' · Fixed Line'} — ${daily.mutator.summary || ''}`;
  }
  if (dailyCalSelRecordEl) {
    dailyCalSelRecordEl.textContent = rec
      ? `✅ Cleared · Grade ${rec.grade} · Best Score ${rec.score.toLocaleString()} · Time ${formatRunClock(rec.timeSec || 0)}`
      : isTodaySel
        ? 'Not cleared yet — clear today to grow your streak!'
        : 'Archive Expedition — dive anytime to earn its calendar checkmark!';
  }
  if (btnDailyCalLaunch) {
    btnDailyCalLaunch.textContent = rec
      ? `↻ Replay ${selKey}`
      : isTodaySel
        ? '▶ Dive Today’s Daily Sump'
        : `▶ Dive Archive (${selKey})`;
  }
}

function openDailyCalendarModal() {
  if (!dailyCalModalEl) return;
  const todayKey = getUtcDateKey();
  dailyCalYear = Number(todayKey.slice(0, 4));
  dailyCalMonth0 = Number(todayKey.slice(5, 7)) - 1;
  dailyCalSelectedKey = todayKey;
  renderDailyCalendarModal();
  dailyCalModalEl.hidden = false;
}

function closeDailyCalendarModal() {
  if (dailyCalModalEl) dailyCalModalEl.hidden = true;
}

btnOpenDailyCalendar?.addEventListener('click', openDailyCalendarModal);
btnDailyCalClose?.addEventListener('click', closeDailyCalendarModal);
dailyCalModalEl?.addEventListener('click', (e) => {
  if (e.target === dailyCalModalEl) closeDailyCalendarModal();
});
btnDailyCalPrev?.addEventListener('click', () => {
  dailyCalMonth0 -= 1;
  if (dailyCalMonth0 < 0) {
    dailyCalMonth0 = 11;
    dailyCalYear -= 1;
  }
  renderDailyCalendarModal();
});
btnDailyCalNext?.addEventListener('click', () => {
  dailyCalMonth0 += 1;
  if (dailyCalMonth0 > 11) {
    dailyCalMonth0 = 0;
    dailyCalYear += 1;
  }
  renderDailyCalendarModal();
});
dailyCalGridEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-cal-date]');
  if (!btn || btn.disabled) return;
  dailyCalSelectedKey = btn.dataset.calDate;
  renderDailyCalendarModal();
});
btnDailyCalLaunch?.addEventListener('click', () => {
  const daily = getDailyGeneratedExpedition(dailyCalSelectedKey);
  closeDailyCalendarModal();
  launchDailyChallenge(daily);
});

function renderTechGearDock() {
  if (!gearDockGridEl) return;
  const book = loadCareerLogbook();
  const { items, unlockedIds } = computeUnlockedGear(book, LEVELS);
  const eff = sanitizeGearLoadout(savedGearLoadout, unlockedIds);
  const unlockedCount = unlockedIds.size;
  if (gearDockSubEl) {
    gearDockSubEl.textContent =
      unlockedCount === items.length
        ? 'All Tech Gear Unlocked · Tap to equip'
        : `${unlockedCount}/${items.length} Unlocked via Career Certs`;
  }
  gearDockGridEl.innerHTML = items
    .map((g) => {
      const equipped = eff[g.id];
      const cls = g.unlocked ? (equipped ? 'equipped' : 'unlocked') : 'locked';
      const stateTxt = g.unlocked ? (equipped ? 'ON' : 'OFF') : '🔒';
      const metaTxt = g.unlocked
        ? g.id === 'sonar'
          ? '[Q] 28m Scan'
          : g.id === 'dpv'
            ? '[V] 1.8× Speed'
            : 'Silent · 2.6× Gas'
        : g.requirement;
      return `
        <button type="button" class="gear-slot-btn ${cls}" data-gear-id="${g.id}" title="${escapeHtml(g.summary)}" aria-pressed="${equipped ? 'true' : 'false'}">
          <span class="gear-slot-top"><span>${g.icon} ${g.shortName}</span><span class="gear-slot-state">${stateTxt}</span></span>
          <span class="gear-slot-meta">${escapeHtml(metaTxt)}</span>
        </button>
      `;
    })
    .join('');
}

gearDockGridEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-gear-id]');
  if (!btn) return;
  const gid = btn.dataset.gearId;
  const book = loadCareerLogbook();
  const { items, unlockedIds } = computeUnlockedGear(book, LEVELS);
  const item = items.find((g) => g.id === gid);
  if (!item) return;
  if (!unlockedIds.has(gid)) {
    showToast(`🔒 Unlock ${item.name}: earn ${item.certName} (${item.requirement})`, 3.2);
    return;
  }
  savedGearLoadout[gid] = !savedGearLoadout[gid];
  saveGearLoadout();
  renderTechGearDock();
  showToast(
    savedGearLoadout[gid] ? `${item.icon} ${item.name} equipped — ${item.summary}` : `${item.icon} ${item.name} unequipped`,
    2.6
  );
});

function handleSonarPing() {
  if (mode !== 'diving' || !session || divePaused || session.endedState) return false;
  if (!session.sonar?.equipped) return false;
  const res = triggerSonarPing(session, {
    onSonarPing: () => audio.playSonarPing(),
  });
  if (res.ok) {
    const count = res.pulse?.contacts?.length || 0;
    showToast(count > 0 ? `📡 Sonar sweep: ${count} target${count === 1 ? '' : 's'} pinged!` : '📡 Sonar contour sweep!', 1.8);
    return true;
  }
  if (res.reason === 'cooldown') {
    showToast(`📡 Sonar recharging (${Math.ceil(res.remainingSec)}s)...`, 1.4);
    return true;
  }
  return false;
}

function handleDpvToggle() {
  if (mode !== 'diving' || !session || divePaused || session.endedState) return false;
  if (!session.dpv?.equipped) return false;
  const res = toggleDpvScooter(session);
  if (res.ok) {
    audio.playClipLine(res.active);
    showToast(
      res.active
        ? `🛴 DPV Scooter ENGAGED (${Math.round(res.batteryPct)}% batt) — watch floor silt wake!`
        : '🛴 DPV Scooter OFF — fin propulsion',
      2.0
    );
    return true;
  }
  if (res.reason === 'empty') {
    showToast('🔋 DPV battery empty — swim on fins.', 1.8);
    return true;
  }
  return false;
}

btnHudSonar?.addEventListener('click', (e) => {
  e.stopPropagation();
  handleSonarPing();
});
btnHudDpv?.addEventListener('click', (e) => {
  e.stopPropagation();
  handleDpvToggle();
});
btnHudStage?.addEventListener('click', (e) => {
  e.stopPropagation();
  handleStageDrop();
});

function handleStageDrop() {
  if (mode !== 'diving' || !session || divePaused || session.endedState) return false;
  audio.unlock();
  const res = dropStageTank(session, {
    onWreckSync: (actionKind, targetId) => {
      if (isMultiplayer) lan.sendWreckAction(actionKind, targetId);
    },
    onStageDrop: () => {
      audio.playClipLine?.(true);
    },
    onToast: (txt, sec) => showToast(txt, sec),
  });
  if (res.ok) {
    lastGearHudKey = '';
    syncTechGearHud(session);
  }
  return Boolean(res.ok);
}

function syncTechGearHud(sess) {
  if (!hudGearDockEl) return;
  if (!sess) {
    if (lastGearHudKey !== 'none') {
      lastGearHudKey = 'none';
      hudGearDockEl.hidden = true;
    }
    return;
  }
  const hasSonar = Boolean(sess.sonar?.equipped);
  const hasDpv = Boolean(sess.dpv?.equipped);
  const hasCcr = Boolean(sess.gear?.ccr);
  const drillsOn = Boolean(sess.drills?.enabled || sess.drills?.active);
  const activeDrillKind = sess.drills?.active?.kind || '';
  const drillsDone = sess.drills?.completedCount || 0;
  const staged = Boolean(sess.spareStageDropped);
  const activeGasBar = Math.round(sess.diveState?.tanks?.[sess.diveState?.activeGasId]?.bar ?? 0);
  const canStage = !staged && activeGasBar >= 75 && (sess.diver?.y || 0) >= 1.2;
  const cdSec = Math.ceil(sess.sonar?.cooldownSec || 0);
  const dpvPct = Math.round(sess.dpv?.batteryPct ?? 100);
  const dpvOn = Boolean(sess.dpv?.active);
  const ccrPct = Math.round(sess.diveState?.ccrScrubberPct ?? 100);
  const key = `drl:${drillsOn}:${activeDrillKind}:${drillsDone}|stg:${staged}:${canStage}|${hasSonar}:${cdSec}|${hasDpv}:${dpvOn}:${dpvPct}|${hasCcr}:${ccrPct}`;
  if (key === lastGearHudKey) return;
  lastGearHudKey = key;
  hudGearDockEl.hidden = false;

  if (hudDrillPill) {
    hudDrillPill.hidden = !drillsOn;
    if (drillsOn) {
      if (activeDrillKind === 'mask-flood') {
        hudDrillPill.textContent = '🫧 MASK FLOOD [E]';
        hudDrillPill.className = 'gear-hud-pill drill alert';
      } else if (activeDrillKind === 'torch-fail') {
        hudDrillPill.textContent = '🔦 LIGHT FAIL [L]';
        hudDrillPill.className = 'gear-hud-pill drill alert';
      } else if (activeDrillKind === 'free-flow') {
        hudDrillPill.textContent = '🔧 FREE-FLOW [E]';
        hudDrillPill.className = 'gear-hud-pill drill alert';
      } else {
        hudDrillPill.textContent = drillsDone > 0 ? `⚡ DRILLS · ${drillsDone}✓` : '⚡ DRILLS';
        hudDrillPill.className = 'gear-hud-pill drill';
      }
    }
  }
  if (btnHudStage) {
    btnHudStage.hidden = false;
    btnHudStage.textContent = staged ? '🛢 STAGED (+6%)' : '🛢 STAGE [T]';
    btnHudStage.className = `gear-hud-btn stage ${staged ? 'staged' : canStage ? '' : 'low'}`;
  }
  if (btnHudSonar) {
    btnHudSonar.hidden = !hasSonar;
    if (hasSonar) {
      btnHudSonar.textContent = cdSec > 0 ? `📡 ${cdSec}s` : '📡 SONAR [Q]';
      btnHudSonar.className = `gear-hud-btn sonar ${cdSec > 0 ? 'cooling' : 'ready'}`;
    }
  }
  if (btnHudDpv) {
    btnHudDpv.hidden = !hasDpv;
    if (hasDpv) {
      btnHudDpv.textContent = dpvPct <= 0 ? '🔋 DPV 0%' : dpvOn ? `🛴 DPV ON · ${dpvPct}%` : `🛴 DPV · ${dpvPct}%`;
      btnHudDpv.className = `gear-hud-btn dpv ${dpvPct <= 0 ? 'empty' : dpvOn ? 'active' : ''}`;
    }
  }
  if (hudCcrPill) {
    hudCcrPill.hidden = !hasCcr;
    if (hasCcr) {
      hudCcrPill.textContent = ccrPct <= 0 ? '🫁 CCR BAILOUT' : `🫁 CCR ${ccrPct}%`;
      hudCcrPill.className = `gear-hud-pill ccr ${ccrPct < 20 ? 'low' : ''}`;
    }
  }
}

// Difficulty Realism Mode (Guided / Standard Tech / Hardcore), PB Ghost Replay & First-Dive Guide
const DIFFICULTY_PREF_KEY = 'caveDiverDifficulty_v1';
const GHOST_PREF_KEY = 'caveDiverGhostEnabled_v1';
const TORCH_STICK_PREF_KEY = 'caveDiverTorchStick_v1';
const DRILLS_PREF_KEY = 'caveDiverDrills_v1';
const BRIEFED_PREF_KEY = 'caveDiverBriefed_v1';
const DIFFICULTY_MODES = [
  { id: 'guided', label: 'Guided', fullBadge: '🧭 GUIDED', shortBadge: '🧭 GD', pillBadge: '🧭 GUIDED', btnText: '🎚️ Mode: Guided', tag: ' · GUIDED' },
  { id: 'standard', label: 'Standard Tech', fullBadge: '🤿 STANDARD TECH', shortBadge: '🤿 ST', pillBadge: '🤿 TECH', btnText: '🎚️ Mode: Standard Tech', tag: '' },
  { id: 'hardcore', label: 'Hardcore', fullBadge: '🔥 HARDCORE', shortBadge: '🔥 HC', pillBadge: '🔥 HARDCORE', btnText: '🎚️ Mode: Hardcore 🔥', tag: ' · HARDCORE' },
];
function getDifficultyMeta(diff) {
  return DIFFICULTY_MODES.find((d) => d.id === diff) || null;
}
function renderModeBadgeHtml(diff, { compact = true } = {}) {
  const m = getDifficultyMeta(diff);
  if (!m) return '';
  const txt = compact ? m.shortBadge : m.fullBadge;
  return `<span class="mode-badge mode-${m.id}${compact ? ' compact' : ''}" title="${escapeHtml(m.label)} Mode">${txt}</span>`;
}
let activeDifficulty = 'standard';
let ghostEnabled = true;
let torchStickEnabled = true;
let drillsEnabled = false;
try {
  drillsEnabled = localStorage.getItem(DRILLS_PREF_KEY) === '1';
} catch {}
const btnDrillsToggle = document.getElementById('btn-drills-toggle');
const menuDrillsPillEl = document.getElementById('menu-drills-pill');
function syncDrillsUi() {
  if (btnDrillsToggle) {
    btnDrillsToggle.textContent = drillsEnabled ? '⚡ Failure Drills: On' : '⚡ Failure Drills: Off';
    btnDrillsToggle.classList.toggle('active', drillsEnabled);
  }
  if (menuDrillsPillEl) {
    menuDrillsPillEl.textContent = drillsEnabled ? '⚡ Drills: ON' : '⚡ Drills: Off';
    menuDrillsPillEl.classList.toggle('active', drillsEnabled);
  }
  syncSetupDrawerSummary();
}
function toggleDrillsPreference() {
  drillsEnabled = !drillsEnabled;
  try {
    localStorage.setItem(DRILLS_PREF_KEY, drillsEnabled ? '1' : '0');
  } catch {}
  syncDrillsUi();
  showToast(
    drillsEnabled
      ? '⚡ Technical Failure Drills ON — Mask Flood, Light Failure & Free-Flow (+200 each)!'
      : '⚡ Technical Failure Drills turned off.',
    2.8
  );
}
btnDrillsToggle?.addEventListener('click', () => {
  setHomeMenuOpen(false);
  toggleDrillsPreference();
});
menuDrillsPillEl?.addEventListener('click', toggleDrillsPreference);
syncDrillsUi();
let activeGhostTrack = null;
let activeGhostIsPar = false;
let pendingGuideLaunch = false;

try {
  const savedDiff = localStorage.getItem(DIFFICULTY_PREF_KEY);
  if (savedDiff === 'guided' || savedDiff === 'standard' || savedDiff === 'hardcore') {
    activeDifficulty = savedDiff;
  }
  const savedGhost = localStorage.getItem(GHOST_PREF_KEY);
  if (savedGhost === '0') ghostEnabled = false;
  const savedTorchStick = localStorage.getItem(TORCH_STICK_PREF_KEY);
  if (savedTorchStick === '0') torchStickEnabled = false;
} catch {}

const btnDifficultyCycle = document.getElementById('btn-difficulty-cycle');
const menuModeBadgeEl = document.getElementById('menu-mode-badge');
const debriefModeBadgeEl = document.getElementById('debrief-mode-badge');
const btnGhostToggle = document.getElementById('btn-ghost-toggle');
const btnHudGhostToggle = document.getElementById('btn-hud-ghost-toggle');
const btnTorchStickToggle = document.getElementById('btn-torch-stick-toggle');
const btnHudTorchStick = document.getElementById('btn-hud-torch-stick');
const torchStickEl = document.getElementById('torch-stick');
const btnOpenGuide = document.getElementById('btn-open-guide');
const modalDiveGuide = document.getElementById('modal-dive-guide');
const btnDiveGuideClose = document.getElementById('btn-dive-guide-close');
const btnDiveGuideStart = document.getElementById('btn-dive-guide-start');

function syncPreferenceMenuButtons() {
  const diffMeta = DIFFICULTY_MODES.find((d) => d.id === activeDifficulty) || DIFFICULTY_MODES[1];
  if (btnDifficultyCycle) btnDifficultyCycle.textContent = diffMeta.btnText;
  if (menuModeBadgeEl) {
    menuModeBadgeEl.textContent = diffMeta.pillBadge;
    menuModeBadgeEl.className = `mode-badge mode-${diffMeta.id}`;
    menuModeBadgeEl.title = `Active Mode: ${diffMeta.label} (tap to switch)`;
  }
  const ghostLabel = ghostEnabled ? '👻 PB Ghost: On' : '👻 PB Ghost: Off';
  if (btnGhostToggle) btnGhostToggle.textContent = ghostLabel;
  if (btnHudGhostToggle) btnHudGhostToggle.textContent = ghostLabel;
  const torchLabel = torchStickEnabled ? '🔦 Light Stick: On' : '🔦 Light Stick: Off';
  if (btnTorchStickToggle) btnTorchStickToggle.textContent = torchLabel;
  if (btnHudTorchStick) btnHudTorchStick.textContent = torchLabel;
  if (torchStickEl) torchStickEl.hidden = !torchStickEnabled;
  syncSetupDrawerSummary();
}
syncPreferenceMenuButtons();

function toggleTorchStickOption() {
  torchStickEnabled = !torchStickEnabled;
  if (!torchStickEnabled) input.resetTorchStick();
  try { localStorage.setItem(TORCH_STICK_PREF_KEY, torchStickEnabled ? '1' : '0'); } catch {}
  syncPreferenceMenuButtons();
  scheduleGitHubStatsSync();
  showToast(
    torchStickEnabled
      ? '🔦 Left flashlight aim joystick enabled.'
      : '🔦 Left flashlight joystick hidden (beam follows diver).',
    2.2
  );
}
btnTorchStickToggle?.addEventListener('click', toggleTorchStickOption);
btnHudTorchStick?.addEventListener('click', toggleTorchStickOption);

function cycleDifficultyMode() {
  const idx = DIFFICULTY_MODES.findIndex((d) => d.id === activeDifficulty);
  const next = DIFFICULTY_MODES[(idx + 1) % DIFFICULTY_MODES.length];
  activeDifficulty = next.id;
  try { localStorage.setItem(DIFFICULTY_PREF_KEY, activeDifficulty); } catch {}
  syncPreferenceMenuButtons();
  scheduleGitHubStatsSync();
  showToast(
    activeDifficulty === 'hardcore'
      ? '🔥 Hardcore Mode: No compass, stronger surges & heavy percolation!'
      : activeDifficulty === 'guided'
        ? '🧭 Guided Mode: Always-on compass & gentler silt-outs.'
        : '🤿 Standard Tech Mode active.',
    2.6
  );
}
btnDifficultyCycle?.addEventListener('click', cycleDifficultyMode);
menuModeBadgeEl?.addEventListener('click', cycleDifficultyMode);

function toggleGhostOption() {
  ghostEnabled = !ghostEnabled;
  try { localStorage.setItem(GHOST_PREF_KEY, ghostEnabled ? '1' : '0'); } catch {}
  syncPreferenceMenuButtons();
  scheduleGitHubStatsSync();
  const targetLvl = session?.level || activeLevel;
  refreshActiveGhostTrack(targetLvl);
  if (!ghostEnabled) {
    showToast('👻 PB Ghost Diver hidden.', 2.0);
  } else if (activeGhostTrack && !activeGhostIsPar) {
    showToast('👻 PB Ghost Diver active — racing your Personal Best!', 2.4);
  } else {
    showToast('👻 Par Pacer active — clear this site to save your own PB Ghost!', 2.8);
  }
}
btnGhostToggle?.addEventListener('click', toggleGhostOption);
btnHudGhostToggle?.addEventListener('click', toggleGhostOption);

function openDiveGuideModal(launchAfter = false) {
  pendingGuideLaunch = Boolean(launchAfter);
  if (modalDiveGuide) modalDiveGuide.hidden = false;
  setHomeMenuOpen(false);
}

function closeDiveGuideModal(startNow = false) {
  if (modalDiveGuide) modalDiveGuide.hidden = true;
  try { localStorage.setItem(BRIEFED_PREF_KEY, '1'); } catch {}
  const shouldLaunch = startNow && pendingGuideLaunch;
  pendingGuideLaunch = false;
  if (shouldLaunch) launchOpenCoopDive();
}

btnOpenGuide?.addEventListener('click', () => openDiveGuideModal(false));
btnDiveGuideClose?.addEventListener('click', () => closeDiveGuideModal(false));
btnDiveGuideStart?.addEventListener('click', () => closeDiveGuideModal(true));
modalDiveGuide?.addEventListener('click', (e) => {
  if (e.target === modalDiveGuide) closeDiveGuideModal(false);
});

const btnOpenLogbook = document.getElementById('btn-open-logbook');
const btnProgressPill = document.getElementById('campaign-progress-pill');
const modalLogbook = document.getElementById('modal-logbook');
const btnLogbookClose = document.getElementById('btn-logbook-close');
const logbookKpisEl = document.getElementById('logbook-kpis');
const logbookCertsEl = document.getElementById('logbook-certs-grid');
const logbookSitesEl = document.getElementById('logbook-sites-list');
const logbookSubEl = document.getElementById('logbook-modal-sub');

function formatBottomTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

function openLogbookModal() {
  if (!modalLogbook) return;
  setHomeMenuOpen(false);
  const book = loadCareerLogbook();
  const sum = formatLogbookSummary(book, LEVELS.length);
  const certInfo = computeCertifications(book, LEVELS);
  const locked = Boolean(lan.room && !lan.isHost());

  if (logbookSubEl) {
    const rankStr = certInfo.highest ? `${certInfo.highest.icon} ${certInfo.highest.title}` : sum.campaignMedal;
    logbookSubEl.textContent = certInfo.next
      ? `Current Rank: ${rankStr} · Next: ${certInfo.next.title} (${certInfo.next.requirement})`
      : `Current Rank: ${rankStr} · All Technical Certifications Earned!`;
  }
  if (logbookKpisEl) {
    const dailyStatus = getDailyStatus(book);
    const fgStats = getFieldGuideStats(book);
    logbookKpisEl.innerHTML = `
      <div class="logbook-kpi"><span>Cleared</span><strong>${sum.clearedCount}/${sum.totalSites}</strong></div>
      <div class="logbook-kpi"><span>Dives</span><strong>${sum.totalDives}</strong></div>
      <div class="logbook-kpi"><span>Bottom Time</span><strong>${formatBottomTime(sum.totalTimeSec)}</strong></div>
      <div class="logbook-kpi"><span>Deepest</span><strong>${sum.deepestM.toFixed(0)}m</strong></div>
      <div class="logbook-kpi"><span>S-Ranks</span><strong>${certInfo.sGrades}</strong></div>
      <div class="logbook-kpi"><span>Daily Streak</span><strong>🔥 ${dailyStatus.activeStreak}d${dailyStatus.bestStreak > 0 ? ` · Best ${dailyStatus.bestStreak}d` : ''}</strong></div>
      <div class="logbook-kpi"><span>Field Guide</span><strong>📷 ${fgStats.discoveredCount}/${fgStats.totalCount}</strong></div>
    `;
  }
  if (logbookCertsEl) {
    logbookCertsEl.innerHTML = certInfo.certs
      .map(
        (c) => `
        <div class="logbook-cert-card ${c.earned ? '' : 'locked'}">
          <span class="logbook-cert-icon" aria-hidden="true">${c.earned ? c.icon : '🔒'}</span>
          <div class="logbook-cert-copy">
            <strong>${escapeHtml(c.title)}</strong>
            <span>${escapeHtml(c.requirement)}</span>
          </div>
        </div>`
      )
      .join('');
  }
  const fgHeading = document.getElementById('logbook-field-guide-heading');
  const fgTrophyEl = document.getElementById('logbook-fg-trophy');
  const fgGrid = document.getElementById('logbook-field-guide-grid');
  if (fgGrid) {
    const fgStats = getFieldGuideStats(book);
    if (fgHeading) {
      fgHeading.textContent = `EXPEDITION FIELD GUIDE (${fgStats.discoveredCount}/${fgStats.totalCount} PHOTOGRAPHED)`;
    }
    if (fgTrophyEl) {
      fgTrophyEl.innerHTML = `
        <div class="fg-trophy-top">
          <span class="fg-trophy-rank">${escapeHtml(fgStats.naturalistRank)}</span>
          <div class="fg-trophy-pills">
            <span class="fg-trophy-pill gold">★★★ ${fgStats.goldCount}/${fgStats.totalCount}</span>
            <span class="fg-trophy-pill">🐋 Rare/Epic ${fgStats.rareDiscovered}/${fgStats.rareTotal}</span>
            <span class="fg-trophy-pill">📷 ${fgStats.totalPhotos} shots</span>
          </div>
        </div>
        <div class="fg-trophy-bar"><div class="fg-trophy-fill" style="width:${fgStats.pct}%"></div></div>
      `;
    }
    fgGrid.innerHTML = fgStats.entries
      .map((e) => {
        if (!e.discovered) {
          return `
            <div class="fg-card locked">
              <span class="fg-icon" aria-hidden="true">${e.icon}</span>
              <div class="fg-copy">
                <div class="fg-head"><strong>??? (${e.rarity.toUpperCase()})</strong></div>
                <span class="fg-meta">Habitat: ${escapeHtml(e.habitat)}</span>
              </div>
            </div>`;
        }
        const stars = '★'.repeat(e.bestStars) + '☆'.repeat(3 - e.bestStars);
        const sightTxt = e.bestSiteName
          ? `${e.bestSiteName} · ${Math.round(e.bestDepthM)}m · ×${e.count}`
          : `${Math.round(e.bestDepthM)}m · ×${e.count}`;
        return `
          <div class="fg-card rarity-${e.rarity}">
            <span class="fg-icon" aria-hidden="true">${e.icon}</span>
            <div class="fg-copy">
              <div class="fg-head"><strong>${escapeHtml(e.name)}</strong><span class="fg-stars">${stars}</span></div>
              <span class="fg-latin">${escapeHtml(e.latin)}</span>
              <span class="fg-meta">${escapeHtml(sightTxt)}</span>
            </div>
          </div>`;
      })
      .join('');
  }
  if (logbookSitesEl) {
    const sitesHeading = document.getElementById('logbook-sites-heading');
    if (sitesHeading) sitesHeading.textContent = `EXPEDITION MASTERY (${LEVELS.length} SITES)`;
    logbookSitesEl.innerHTML = LEVELS.map((lvl, idx) => {
      const rec = book.cleared?.[lvl.id] || null;
      const grade = rec?.grade || '—';
      const gradeCls = grade.startsWith('S') ? 'grade-s' : grade === 'A' ? 'grade-a' : '';
      const scoreTxt = rec ? `${rec.score.toLocaleString()} pts` : `${getLevelMaxDepthM(lvl)}m`;
      const timeTxt = rec?.bestTimeSec > 0 ? formatRunClock(rec.bestTimeSec) : (lvl.isWreck ? 'Wreck' : 'Cave');
      const modeBadge = renderModeBadgeHtml(rec?.bestDifficulty || rec?.lastDifficulty, { compact: true });
      const hasPbTrack = Boolean(loadGhostTrack(lvl.id));
      return `
        <div class="logbook-site-row ${rec ? 'cleared' : ''}">
          <span class="logbook-site-num">L${idx + 1}</span>
          <span class="logbook-site-name">${lvl.isWreck ? '🚢 ' : ''}${escapeHtml(lvl.name)}</span>
          <span class="logbook-site-stat">${escapeHtml(scoreTxt)} · ${escapeHtml(timeTxt)}</span>
          ${rec ? `<span class="lvl-card-badges">${modeBadge}<span class="lvl-grade-badge ${gradeCls}">${escapeHtml(grade)}</span></span>` : '<span class="logbook-site-stat">—</span>'}
          <span class="logbook-site-actions">
            ${hasPbTrack ? `<button type="button" class="btn tiny secondary" data-logbook-replay="${lvl.id}" title="Watch PB Track Replay &amp; Share Card">🎬</button>` : ''}
            <button type="button" class="btn tiny ghost" data-logbook-jump="${lvl.id}" ${locked ? 'disabled' : ''}>Select</button>
          </span>
        </div>`;
    }).join('');
  }
  if (modalLogbook) {
    renderGitHubAccountUi();
    modalLogbook.hidden = false;
  }
}

function closeLogbookModal() {
  if (modalLogbook) modalLogbook.hidden = true;
}

btnOpenLogbook?.addEventListener('click', openLogbookModal);
btnProgressPill?.addEventListener('click', openLogbookModal);
btnLogbookClose?.addEventListener('click', closeLogbookModal);

function downloadTextFile(filename, content, mimeType) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch {
    return false;
  }
}

const btnLogbookExportCsv = document.getElementById('btn-logbook-export-csv');
const btnLogbookExportJson = document.getElementById('btn-logbook-export-json');
btnLogbookExportCsv?.addEventListener('click', () => {
  const book = loadCareerLogbook();
  const csv = exportLogbookToCsv(book, LEVELS);
  const stamp = new Date().toISOString().slice(0, 10);
  if (downloadTextFile(`techno-dive-logbook-${stamp}.csv`, csv, 'text/csv;charset=utf-8')) {
    showToast(`📥 Exported Dive Logbook CSV (${Object.keys(book.cleared).length}/${LEVELS.length} sites)`, 2.6);
  }
});
btnLogbookExportJson?.addEventListener('click', () => {
  const book = loadCareerLogbook();
  const appVer = document.querySelector('meta[name="app-version"]')?.content || '';
  const json = exportLogbookToJson(book, LEVELS, {
    diverName: playerNameInput?.value.trim() || 'Diver',
    githubLogin: github.getStatus().user?.login || '',
    version: appVer ? `v${appVer}` : '',
  });
  const stamp = new Date().toISOString().slice(0, 10);
  if (downloadTextFile(`techno-dive-logbook-${stamp}.json`, json, 'application/json;charset=utf-8')) {
    showToast('📄 Exported full Dive Logbook & Field Guide JSON!', 2.6);
  }
});

const btnLogbookImportJson = document.getElementById('btn-logbook-import-json');
const inputLogbookImport = document.getElementById('input-logbook-import');
btnLogbookImportJson?.addEventListener('click', () => {
  if (inputLogbookImport) {
    inputLogbookImport.value = '';
    inputLogbookImport.click();
  }
});
inputLogbookImport?.addEventListener('change', async () => {
  const file = inputLogbookImport.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = parseImportedLogbookJson(text);
    if (!parsed.ok) {
      showToast(`⚠️ Import failed: ${parsed.error}`, 3.0);
      return;
    }
    const merged = mergeCareerLogbooks(loadCareerLogbook(), parsed.book);
    saveCareerLogbook(merged);
    renderCareerSummary();
    renderTechGearDock();
    renderDailyChallengeCard();
    populateLevelSelector();
    openLogbookModal();
    showToast(
      `📤 Imported & merged ${parsed.siteCount} site clears & ${parsed.fieldGuideCount} Field Guide species!`,
      3.2
    );
  } catch {
    showToast('⚠️ Could not read backup JSON file.', 2.8);
  }
});

// ── Dive Replay Theater & Shareable PNG Expedition Postcard (v121) ──
const REPLAY_SPEEDS = [1, 2, 4];

function createReplayController({ canvas, metaEl, playBtn, scrubber, speedBtn }) {
  let state = {
    level: null,
    samples: [],
    profile: null,
    progress: 0,
    playing: false,
    speedIdx: 1, // default 2x
    rafId: 0,
    lastTs: 0,
  };

  function draw() {
    if (!canvas || !state.level || state.samples.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pose = drawReplayFrame(ctx, canvas.width, canvas.height, {
      level: state.level,
      track: state.samples,
      profile: state.profile,
      progress: state.progress,
    });
    if (scrubber) scrubber.value = String(Math.round(state.progress * 1000));
    if (metaEl && pose) {
      const tCur = formatReplayTime(pose.t);
      const tTot = formatReplayTime(pose.totalSec);
      metaEl.textContent = `${tCur} / ${tTot} · ${Math.max(0, pose.y).toFixed(1)}m`;
    }
  }

  function syncBtns() {
    if (playBtn) playBtn.textContent = state.playing ? '⏸ Pause' : state.progress >= 0.999 ? '↺ Replay' : '▶ Play';
    if (speedBtn) speedBtn.textContent = `${REPLAY_SPEEDS[state.speedIdx]}×`;
  }

  function stop() {
    state.playing = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    syncBtns();
  }

  function tick(ts) {
    if (!state.playing) return;
    if (!state.lastTs) state.lastTs = ts;
    const dtSec = Math.min(0.1, Math.max(0, (ts - state.lastTs) / 1000));
    state.lastTs = ts;
    const totalSec = Math.max(4, state.samples[state.samples.length - 1]?.t || 20);
    // Compressed theatrical playback: 1x finishes a 60s dive in ~10s, 2x in ~5s, 4x in ~2.5s
    const speed = REPLAY_SPEEDS[state.speedIdx] * 6;
    state.progress = Math.min(1, state.progress + (dtSec * speed) / totalSec);
    draw();
    if (state.progress >= 1) {
      stop();
      return;
    }
    state.rafId = requestAnimationFrame(tick);
  }

  function play() {
    if (!state.level || state.samples.length < 2) return;
    if (state.progress >= 0.995) state.progress = 0;
    state.playing = true;
    state.lastTs = 0;
    syncBtns();
    if (!state.rafId) state.rafId = requestAnimationFrame(tick);
  }

  function load({ level, track, profile = null, autoPlay = true }) {
    stop();
    const samples = decodeReplayTrack(track);
    state.level = level || null;
    state.samples = samples;
    state.profile = Array.isArray(profile) ? profile : null;
    state.progress = autoPlay ? 0 : 1;
    syncBtns();
    draw();
    if (autoPlay && samples.length >= 2) play();
    return samples.length >= 2;
  }

  playBtn?.addEventListener('click', () => {
    if (state.playing) stop();
    else play();
  });
  speedBtn?.addEventListener('click', () => {
    state.speedIdx = (state.speedIdx + 1) % REPLAY_SPEEDS.length;
    syncBtns();
  });
  scrubber?.addEventListener('input', () => {
    stop();
    state.progress = Math.max(0, Math.min(1, Number(scrubber.value) / 1000));
    draw();
  });

  return { load, play, stop, draw };
}

async function shareOrDownloadPostcard(cardData) {
  if (!cardData?.level) return false;
  const off = document.createElement('canvas');
  off.width = 1200;
  off.height = 630;
  const ctx = off.getContext('2d');
  if (!ctx) return false;

  const appVer = document.querySelector('meta[name="app-version"]')?.content || '121';
  renderExpeditionPostcard(ctx, 1200, 630, {
    ...cardData,
    githubLogin: github.getStatus().user?.login || '',
    version: `v${appVer}`,
  });

  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  if (!blob) return false;
  const slug = String(cardData.level.id || 'expedition').replace(/[^a-z0-9-]+/gi, '-');
  const gradeSlug = String(cardData.grade || 'S').replace(/[^a-z0-9]+/gi, '');
  const filename = `techno-dive-${slug}-${gradeSlug}.png`;

  try {
    if (typeof File !== 'undefined' && navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Techno Dive · ${cardData.level.name} (${cardData.grade})`,
          text: `Cleared ${cardData.level.name} (${Number(cardData.maxDepthM || 0).toFixed(1)}m · ${Number(cardData.score || 0).toLocaleString()} pts) in Techno Dive!`,
        });
        showToast('📸 Expedition Postcard shared!', 2.4);
        return true;
      }
    }
  } catch (err) {
    if (err?.name === 'AbortError') return false;
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast(`📸 Saved Expedition Postcard (${filename})!`, 2.8);
    return true;
  } catch {
    return false;
  }
}

const debriefReplayWrapEl = document.getElementById('debrief-replay-wrap');
const debriefReplay = createReplayController({
  canvas: document.getElementById('debrief-replay-canvas'),
  metaEl: document.getElementById('debrief-replay-meta'),
  playBtn: document.getElementById('btn-replay-play'),
  scrubber: document.getElementById('replay-scrubber'),
  speedBtn: document.getElementById('btn-replay-speed'),
});
let lastDebriefCardData = null;
const btnDebriefShareCard = document.getElementById('btn-debrief-share-card');
btnDebriefShareCard?.addEventListener('click', () => {
  if (lastDebriefCardData) shareOrDownloadPostcard(lastDebriefCardData);
});

const replayModal = document.getElementById('replay-modal');
const replayModalTitleEl = document.getElementById('replay-modal-title');
const replayModalSubEl = document.getElementById('replay-modal-sub');
const btnReplayModalClose = document.getElementById('btn-replay-modal-close');
const btnModalReplayShare = document.getElementById('btn-modal-replay-share');
const modalReplay = createReplayController({
  canvas: document.getElementById('modal-replay-canvas'),
  metaEl: document.getElementById('modal-replay-meta'),
  playBtn: document.getElementById('btn-modal-replay-play'),
  scrubber: document.getElementById('modal-replay-scrubber'),
  speedBtn: document.getElementById('btn-modal-replay-speed'),
});
let activeModalReplayCardData = null;

function openLogbookReplayModal(levelId) {
  const lvl = getLevelById(levelId);
  const track = loadGhostTrack(levelId);
  if (!lvl || !track || track.length < 2 || !replayModal) {
    showToast('No recorded PB track found for this site yet.', 2.2);
    return;
  }
  const book = loadCareerLogbook();
  const rec = book.cleared?.[lvl.id] || null;
  const decoded = decodeReplayTrack(track);
  const maxD = decoded.reduce((m, p) => Math.max(m, p.y), 0);
  const totalSec = rec?.bestTimeSec || decoded[decoded.length - 1]?.t || 0;

  if (replayModalTitleEl) replayModalTitleEl.textContent = lvl.name;
  if (replayModalSubEl) {
    replayModalSubEl.textContent = rec
      ? `Grade ${rec.grade} · ${rec.score.toLocaleString()} pts · ${formatReplayTime(totalSec)} · Max ${maxD.toFixed(1)}m`
      : `Recorded Run · ${formatReplayTime(totalSec)} · Max ${maxD.toFixed(1)}m`;
  }
  activeModalReplayCardData = {
    level: lvl,
    diverName: playerNameInput?.value.trim() || 'Diver',
    success: Boolean(rec),
    grade: rec?.grade || 'PB',
    score: rec?.score || 0,
    maxDepthM: maxD || getLevelMaxDepthM(lvl),
    diveTimeSec: totalSec,
    exploredPct: rec ? 100 : 0,
    difficulty: rec?.bestDifficulty || activeDifficulty,
    track,
    profile: null,
  };
  replayModal.hidden = false;
  modalReplay.load({ level: lvl, track, autoPlay: true });
}

function closeReplayModal() {
  modalReplay.stop();
  if (replayModal) replayModal.hidden = true;
}

btnReplayModalClose?.addEventListener('click', closeReplayModal);
replayModal?.addEventListener('click', (e) => {
  if (e.target === replayModal) closeReplayModal();
});
btnModalReplayShare?.addEventListener('click', () => {
  if (activeModalReplayCardData) shareOrDownloadPostcard(activeModalReplayCardData);
});

// Pre-Dive Technical Trimix / Nitrox Gas Blender (v120)
const CUSTOM_GAS_PREF_KEY = 'caveDiverCustomGas_v1';
const gasPlannerModal = document.getElementById('gas-planner-modal');
const btnOpenGasPlanner = document.getElementById('btn-open-gas-planner');
const menuGasPillEl = document.getElementById('menu-gas-pill');
const homeMenuGasLabelEl = document.getElementById('home-menu-gas-label');
const btnGasPlannerClose = document.getElementById('btn-gas-planner-close');
const gasPlannerSubEl = document.getElementById('gas-planner-sub');
const gasPresetRowEl = document.getElementById('gas-preset-row');
const gasO2Slider = document.getElementById('gas-o2-slider');
const gasHeSlider = document.getElementById('gas-he-slider');
const gasO2ValEl = document.getElementById('gas-o2-val');
const gasHeValEl = document.getElementById('gas-he-val');
const gasBarO2El = document.getElementById('gas-bar-o2');
const gasBarHeEl = document.getElementById('gas-bar-he');
const gasBarN2El = document.getElementById('gas-bar-n2');
const gasLegO2El = document.getElementById('gas-leg-o2');
const gasLegHeEl = document.getElementById('gas-leg-he');
const gasLegN2El = document.getElementById('gas-leg-n2');
const gasOutNameEl = document.getElementById('gas-out-name');
const gasOutMod14El = document.getElementById('gas-out-mod14');
const gasOutMod16El = document.getElementById('gas-out-mod16');
const gasOutMinEl = document.getElementById('gas-out-min');
const gasOutDepthLblEl = document.getElementById('gas-out-depth-lbl');
const gasOutPpo2El = document.getElementById('gas-out-ppo2');
const gasOutEndEl = document.getElementById('gas-out-end');
const gasSafetyPillEl = document.getElementById('gas-safety-pill');
const btnGasApply = document.getElementById('btn-gas-apply');
const btnGasReset = document.getElementById('btn-gas-reset');

let customGasPlan = { enabled: false, o2Pct: 18, hePct: 45 };
let draftGasPlan = { o2Pct: 18, hePct: 45, useDefault: true };
try {
  const rawGas = localStorage.getItem(CUSTOM_GAS_PREF_KEY);
  if (rawGas) {
    const parsed = JSON.parse(rawGas);
    if (parsed && typeof parsed === 'object') {
      customGasPlan = {
        enabled: Boolean(parsed.enabled),
        o2Pct: Math.max(8, Math.min(40, Math.round(Number(parsed.o2Pct) || 18))),
        hePct: Math.max(0, Math.min(75, Math.round(Number(parsed.hePct) || 45))),
      };
    }
  }
} catch {}

function saveCustomGasPlan() {
  try {
    localStorage.setItem(CUSTOM_GAS_PREF_KEY, JSON.stringify(customGasPlan));
  } catch {}
}

function getSiteDefaultBottomMix(lvl) {
  const ov = lvl?.gasOverrides?.TMX1455;
  return ov ? { ...GAS_MIXES.TMX1455, ...ov } : GAS_MIXES.TMX1455;
}

function getActiveCustomMixOverrides(lvl = activeLevel) {
  if (!customGasPlan.enabled) return null;
  const targetDepthM = getLevelMaxDepthM(lvl) || 50;
  const baseGas = getSiteDefaultBottomMix(lvl);
  const blend = buildCustomGasBlend({
    o2Pct: customGasPlan.o2Pct,
    hePct: customGasPlan.hePct,
    targetDepthM,
    baseGas,
  });
  return { TMX1455: blend.override };
}

function syncGasPlanBadges() {
  const targetDepthM = getLevelMaxDepthM(activeLevel) || 50;
  if (customGasPlan.enabled) {
    const blend = buildCustomGasBlend({
      o2Pct: customGasPlan.o2Pct,
      hePct: customGasPlan.hePct,
      targetDepthM,
      baseGas: getSiteDefaultBottomMix(activeLevel),
    });
    if (menuGasPillEl) {
      menuGasPillEl.textContent = `🧪 ${blend.name}`;
      menuGasPillEl.classList.add('custom');
    }
    if (homeMenuGasLabelEl) {
      homeMenuGasLabelEl.textContent = `🧪 Gas Blender (${blend.shortLabel})`;
    }
  } else {
    if (menuGasPillEl) {
      menuGasPillEl.textContent = '🧪 Default Mix';
      menuGasPillEl.classList.remove('custom');
    }
    if (homeMenuGasLabelEl) {
      homeMenuGasLabelEl.textContent = '🧪 Gas Blender';
    }
  }
  syncSetupDrawerSummary();
}

function renderGasPlannerModal() {
  if (!gasPlannerModal) return;
  const lvl = activeLevel || LEVELS[0];
  const targetDepthM = Math.round(getLevelMaxDepthM(lvl) || 50);
  const siteBase = getSiteDefaultBottomMix(lvl);
  const maxAllowedHe = Math.min(75, Math.max(0, 95 - draftGasPlan.o2Pct));
  if (draftGasPlan.hePct > maxAllowedHe) draftGasPlan.hePct = maxAllowedHe;

  const blend = buildCustomGasBlend({
    o2Pct: draftGasPlan.o2Pct,
    hePct: draftGasPlan.hePct,
    targetDepthM,
    baseGas: siteBase,
  });

  if (gasPlannerSubEl) {
    gasPlannerSubEl.textContent = `${lvl.name} · Target Max Depth ${targetDepthM}m (Site Default: ${siteBase.name})`;
  }
  if (gasO2Slider) gasO2Slider.value = String(blend.o2Pct);
  if (gasHeSlider) {
    gasHeSlider.max = String(Math.min(75, Math.max(0, 95 - blend.o2Pct)));
    gasHeSlider.value = String(blend.hePct);
  }
  if (gasO2ValEl) gasO2ValEl.textContent = `${blend.o2Pct}%`;
  if (gasHeValEl) gasHeValEl.textContent = `${blend.hePct}%`;
  if (gasBarO2El) gasBarO2El.style.width = `${blend.o2Pct}%`;
  if (gasBarHeEl) gasBarHeEl.style.width = `${blend.hePct}%`;
  if (gasBarN2El) gasBarN2El.style.width = `${blend.n2Pct}%`;
  if (gasLegO2El) gasLegO2El.textContent = `${blend.o2Pct}%`;
  if (gasLegHeEl) gasLegHeEl.textContent = `${blend.hePct}%`;
  if (gasLegN2El) gasLegN2El.textContent = `${blend.n2Pct}%`;

  if (gasOutNameEl) gasOutNameEl.textContent = draftGasPlan.useDefault ? `${siteBase.name} (Default)` : blend.name;
  if (gasOutMod14El) gasOutMod14El.textContent = `${blend.mod14M.toFixed(1)}m`;
  if (gasOutMod16El) gasOutMod16El.textContent = `${blend.mod16M.toFixed(1)}m`;
  if (gasOutMinEl) gasOutMinEl.textContent = blend.minM > 0 ? `${blend.minM}m (Hypoxic)` : '0m (Normoxic)';
  if (gasOutDepthLblEl) gasOutDepthLblEl.textContent = `PPO₂ @ ${targetDepthM}m`;
  if (gasOutPpo2El) gasOutPpo2El.textContent = `${blend.ppo2AtTarget.toFixed(2)} bar`;
  if (gasOutEndEl) gasOutEndEl.textContent = `${blend.endAtTargetM.toFixed(1)}m`;
  if (gasSafetyPillEl) {
    gasSafetyPillEl.textContent = blend.statusText;
    gasSafetyPillEl.className = `gas-safety-pill ${blend.status}`;
  }

  if (gasPresetRowEl) {
    gasPresetRowEl.querySelectorAll('.gas-preset-btn').forEach((btn) => {
      const isDefBtn = btn.dataset.preset === 'default';
      const match = isDefBtn
        ? draftGasPlan.useDefault
        : !draftGasPlan.useDefault && Number(btn.dataset.o2) === blend.o2Pct && Number(btn.dataset.he) === blend.hePct;
      btn.classList.toggle('active', match);
    });
  }
}

function openGasPlannerModal() {
  if (!gasPlannerModal) return;
  setHomeMenuOpen(false);
  const siteBase = getSiteDefaultBottomMix(activeLevel);
  if (customGasPlan.enabled) {
    draftGasPlan = { o2Pct: customGasPlan.o2Pct, hePct: customGasPlan.hePct, useDefault: false };
  } else {
    draftGasPlan = {
      o2Pct: Math.round((siteBase.fO2 || 0.14) * 100),
      hePct: Math.round((siteBase.fHe || 0.55) * 100),
      useDefault: true,
    };
  }
  renderGasPlannerModal();
  gasPlannerModal.hidden = false;
}

function closeGasPlannerModal() {
  if (gasPlannerModal) gasPlannerModal.hidden = true;
}

btnOpenGasPlanner?.addEventListener('click', openGasPlannerModal);
menuGasPillEl?.addEventListener('click', openGasPlannerModal);
btnGasPlannerClose?.addEventListener('click', closeGasPlannerModal);
gasPlannerModal?.addEventListener('click', (e) => {
  if (e.target === gasPlannerModal) closeGasPlannerModal();
});
gasO2Slider?.addEventListener('input', () => {
  draftGasPlan.o2Pct = Number(gasO2Slider.value) || 18;
  draftGasPlan.useDefault = false;
  renderGasPlannerModal();
});
gasHeSlider?.addEventListener('input', () => {
  draftGasPlan.hePct = Number(gasHeSlider.value) || 0;
  draftGasPlan.useDefault = false;
  renderGasPlannerModal();
});
gasPresetRowEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('.gas-preset-btn');
  if (!btn) return;
  if (btn.dataset.preset === 'default') {
    const siteBase = getSiteDefaultBottomMix(activeLevel);
    draftGasPlan = {
      o2Pct: Math.round((siteBase.fO2 || 0.14) * 100),
      hePct: Math.round((siteBase.fHe || 0.55) * 100),
      useDefault: true,
    };
  } else {
    draftGasPlan = {
      o2Pct: Number(btn.dataset.o2) || 18,
      hePct: Number(btn.dataset.he) || 45,
      useDefault: false,
    };
  }
  renderGasPlannerModal();
});
btnGasApply?.addEventListener('click', () => {
  if (draftGasPlan.useDefault) {
    customGasPlan.enabled = false;
    saveCustomGasPlan();
    syncGasPlanBadges();
    closeGasPlannerModal();
    showToast('🧪 Using expedition site default bottom gas.', 2.2);
    return;
  }
  customGasPlan = {
    enabled: true,
    o2Pct: draftGasPlan.o2Pct,
    hePct: draftGasPlan.hePct,
  };
  saveCustomGasPlan();
  syncGasPlanBadges();
  closeGasPlannerModal();
  const blend = buildCustomGasBlend({
    o2Pct: customGasPlan.o2Pct,
    hePct: customGasPlan.hePct,
    targetDepthM: getLevelMaxDepthM(activeLevel) || 50,
  });
  showToast(`🧪 Custom bottom gas locked: ${blend.name} (MOD ${blend.mod14M.toFixed(0)}m)`, 2.8);
});
btnGasReset?.addEventListener('click', () => {
  customGasPlan.enabled = false;
  saveCustomGasPlan();
  syncGasPlanBadges();
  closeGasPlannerModal();
  showToast('🧪 Reset to expedition site default gas mix.', 2.2);
});
syncGasPlanBadges();

// ── Custom Challenge Links & Mutator Sandbox (v123) ──
const challengeModal = document.getElementById('challenge-modal');
const btnOpenChallenge = document.getElementById('btn-open-challenge');
const menuMutatorPillEl = document.getElementById('menu-mutator-pill');
const homeMenuSandboxLabelEl = document.getElementById('home-menu-sandbox-label');
const btnChallengeModalClose = document.getElementById('btn-challenge-modal-close');
const sandboxMutatorGridEl = document.getElementById('sandbox-mutator-grid');
const sandboxDiffSelect = document.getElementById('sandbox-diff-select');
const sandboxTargetInput = document.getElementById('sandbox-target-input');
const sandboxDrillsCheck = document.getElementById('sandbox-drills-check');
const sandboxGasCheck = document.getElementById('sandbox-gas-check');
const sandboxGasLabelEl = document.getElementById('sandbox-gas-label');
const sandboxUrlInput = document.getElementById('sandbox-url-input');
const btnSandboxCopy = document.getElementById('btn-sandbox-copy');
const btnSandboxShare = document.getElementById('btn-sandbox-share');
const btnSandboxLaunch = document.getElementById('btn-sandbox-launch');
const btnSandboxApply = document.getElementById('btn-sandbox-apply');
const challengeBannerEl = document.getElementById('challenge-banner');
const challengeBannerTitleEl = document.getElementById('challenge-banner-title');
const challengeBannerTagsEl = document.getElementById('challenge-banner-tags');
const btnChallengeAccept = document.getElementById('btn-challenge-accept');
const btnChallengeDismiss = document.getElementById('btn-challenge-dismiss');
const debriefChallengeBannerEl = document.getElementById('debrief-challenge-banner');
const btnDebriefChallenge = document.getElementById('btn-debrief-challenge');

let activeSandboxMutatorId = '';
let activeIncomingChallenge = null;
let draftSandbox = {
  mutatorId: '',
  difficulty: 'standard',
  drillsEnabled: false,
  customGas: false,
  targetScore: 0,
};
let lastDebriefChallengeUrl = '';
let lastDebriefChallengeText = '';

function syncSandboxPillUi() {
  const mut = activeSandboxMutatorId ? getDailyMutatorById(activeSandboxMutatorId) : null;
  if (menuMutatorPillEl) {
    menuMutatorPillEl.textContent = mut ? `${mut.icon} ${mut.shortName}` : '🎛️ Sandbox';
    menuMutatorPillEl.classList.toggle('active', Boolean(mut));
  }
  if (homeMenuSandboxLabelEl) {
    homeMenuSandboxLabelEl.textContent = mut ? `🎛️ Sandbox (${mut.shortName})` : '🎛️ Challenge Sandbox';
  }
  syncSetupDrawerSummary();
}

function getDraftChallengeConfig() {
  return {
    siteId: activeLevel?.id || DEFAULT_LEVEL_ID,
    difficulty: draftSandbox.difficulty,
    mutatorId: draftSandbox.mutatorId,
    customGas: draftSandbox.customGas,
    o2Pct: customGasPlan.o2Pct,
    hePct: customGasPlan.hePct,
    drillsEnabled: draftSandbox.drillsEnabled,
    challengerName: playerNameInput?.value.trim() || '',
    targetScore: Math.max(0, Math.round(Number(draftSandbox.targetScore) || 0)),
  };
}

function renderSandboxModal() {
  if (!challengeModal) return;
  if (sandboxMutatorGridEl) {
    const items = [
      { id: '', icon: '✨', shortName: 'No Mutator', desc: 'Standard site rules & conditions' },
      ...DAILY_MUTATORS,
    ];
    sandboxMutatorGridEl.innerHTML = items
      .map(
        (m) => `
        <button type="button" class="sandbox-mut-btn${draftSandbox.mutatorId === m.id ? ' active' : ''}" data-sandbox-mut="${m.id}">
          <strong>${m.icon} ${escapeHtml(m.shortName)}</strong>
          <span>${escapeHtml(m.desc || '')}</span>
        </button>`
      )
      .join('');
  }
  if (sandboxDiffSelect) sandboxDiffSelect.value = draftSandbox.difficulty;
  if (sandboxTargetInput) sandboxTargetInput.value = draftSandbox.targetScore > 0 ? String(draftSandbox.targetScore) : '';
  if (sandboxDrillsCheck) sandboxDrillsCheck.checked = draftSandbox.drillsEnabled;
  if (sandboxGasCheck) sandboxGasCheck.checked = draftSandbox.customGas;
  if (sandboxGasLabelEl) {
    const mixTxt = customGasPlan.hePct > 0 ? `TMX ${customGasPlan.o2Pct}/${customGasPlan.hePct}` : `EAN${customGasPlan.o2Pct}`;
    sandboxGasLabelEl.textContent = `🧪 Include Custom Trimix (${mixTxt})`;
  }
  const url = buildChallengeUrl(`${location.origin}${location.pathname}`, getDraftChallengeConfig());
  if (sandboxUrlInput) sandboxUrlInput.value = url;
  if (btnSandboxShare) btnSandboxShare.hidden = typeof navigator.share !== 'function';
}

function openChallengeModal() {
  if (!challengeModal) return;
  setHomeMenuOpen(false);
  const pbRec = loadCareerLogbook().cleared?.[activeLevel?.id];
  draftSandbox = {
    mutatorId: activeSandboxMutatorId,
    difficulty: activeDifficulty,
    drillsEnabled,
    customGas: customGasPlan.enabled,
    targetScore: pbRec?.score || 0,
  };
  renderSandboxModal();
  challengeModal.hidden = false;
}

function closeChallengeModal() {
  if (challengeModal) challengeModal.hidden = true;
}

function applyDraftSandboxToMenu() {
  activeSandboxMutatorId = draftSandbox.mutatorId || '';
  activeDifficulty = draftSandbox.difficulty;
  try { localStorage.setItem(DIFFICULTY_PREF_KEY, activeDifficulty); } catch {}
  syncPreferenceMenuButtons();

  drillsEnabled = Boolean(draftSandbox.drillsEnabled);
  try { localStorage.setItem(DRILLS_PREF_KEY, drillsEnabled ? '1' : '0'); } catch {}
  syncDrillsUi();

  customGasPlan.enabled = Boolean(draftSandbox.customGas);
  saveCustomGasPlan();
  syncGasPlanBadges();
  syncSandboxPillUi();
}

async function copyOrShareChallengeUrl(url, shareText) {
  if (!url) return false;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Techno Dive Expedition Challenge', text: shareText, url });
      showToast('🔗 Challenge link shared!', 2.4);
      return true;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return false;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      showToast('📋 Challenge link copied! Send it to a friend to race!', 2.8);
      return true;
    }
  } catch {}
  showToast('Select & copy the Challenge URL above!', 2.4);
  return false;
}

function renderIncomingChallengeBanner() {
  if (!challengeBannerEl) return;
  if (!activeIncomingChallenge) {
    challengeBannerEl.hidden = true;
    return;
  }
  const lvl = getLevelById(activeIncomingChallenge.siteId);
  const mut = activeIncomingChallenge.mutatorId ? getDailyMutatorById(activeIncomingChallenge.mutatorId) : null;
  const { tags } = formatChallengeSummary(activeIncomingChallenge, { levelName: lvl?.name || 'Expedition', mutator: mut });
  const who = activeIncomingChallenge.challengerName
    ? `🏆 ${activeIncomingChallenge.challengerName.toUpperCase()} CHALLENGED YOU`
    : '🏆 EXPEDITION CHALLENGE RECEIVED';
  if (challengeBannerTitleEl) challengeBannerTitleEl.textContent = `${who} · ${lvl?.name || ''}`;
  if (challengeBannerTagsEl) challengeBannerTagsEl.textContent = tags.join(' · ');
  challengeBannerEl.hidden = false;
}

async function applyIncomingChallenge(ch) {
  if (!ch) return;
  activeIncomingChallenge = ch;
  activeDifficulty = ch.difficulty;
  try { localStorage.setItem(DIFFICULTY_PREF_KEY, activeDifficulty); } catch {}
  syncPreferenceMenuButtons();

  activeSandboxMutatorId = ch.mutatorId || '';
  syncSandboxPillUi();

  drillsEnabled = Boolean(ch.drillsEnabled);
  try { localStorage.setItem(DRILLS_PREF_KEY, drillsEnabled ? '1' : '0'); } catch {}
  syncDrillsUi();

  if (ch.customGas) {
    customGasPlan = { enabled: true, o2Pct: ch.o2Pct, hePct: ch.hePct };
    saveCustomGasPlan();
  } else {
    customGasPlan.enabled = false;
    saveCustomGasPlan();
  }
  syncGasPlanBadges();

  if (ch.siteId && ch.siteId !== activeLevel?.id) {
    await selectAndLoadLevel(ch.siteId, { focusMap: false });
  }
  renderIncomingChallengeBanner();
  // Clean URL query params cleanly without reloading so refresh doesn't re-apply stale challenge
  try {
    const cleanUrl = `${location.origin}${location.pathname}`;
    history.replaceState(null, '', cleanUrl);
  } catch {}
}

btnOpenChallenge?.addEventListener('click', openChallengeModal);
menuMutatorPillEl?.addEventListener('click', openChallengeModal);
btnChallengeModalClose?.addEventListener('click', closeChallengeModal);
challengeModal?.addEventListener('click', (e) => {
  if (e.target === challengeModal) closeChallengeModal();
});
sandboxMutatorGridEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-sandbox-mut]');
  if (!btn) return;
  draftSandbox.mutatorId = btn.dataset.sandboxMut || '';
  renderSandboxModal();
});
sandboxDiffSelect?.addEventListener('change', () => {
  draftSandbox.difficulty = sandboxDiffSelect.value || 'standard';
  renderSandboxModal();
});
sandboxTargetInput?.addEventListener('input', () => {
  draftSandbox.targetScore = Math.max(0, Math.round(Number(sandboxTargetInput.value) || 0));
  renderSandboxModal();
});
sandboxDrillsCheck?.addEventListener('change', () => {
  draftSandbox.drillsEnabled = Boolean(sandboxDrillsCheck.checked);
  renderSandboxModal();
});
sandboxGasCheck?.addEventListener('change', () => {
  draftSandbox.customGas = Boolean(sandboxGasCheck.checked);
  renderSandboxModal();
});
btnSandboxCopy?.addEventListener('click', async () => {
  const url = sandboxUrlInput?.value || '';
  if (!url) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      showToast('📋 Challenge URL copied to clipboard!', 2.4);
      return;
    }
  } catch {}
  sandboxUrlInput?.select();
  showToast('Challenge URL selected — press Ctrl+C to copy.', 2.2);
});
btnSandboxShare?.addEventListener('click', () => {
  const cfg = getDraftChallengeConfig();
  const mut = cfg.mutatorId ? getDailyMutatorById(cfg.mutatorId) : null;
  const { shareText } = formatChallengeSummary(cfg, { levelName: activeLevel?.name || 'Expedition', mutator: mut });
  copyOrShareChallengeUrl(sandboxUrlInput?.value || '', shareText);
});
btnSandboxApply?.addEventListener('click', () => {
  applyDraftSandboxToMenu();
  closeChallengeModal();
  showToast('🎛️ Sandbox settings applied! Hit DIVE SOLO whenever ready.', 2.4);
});
btnSandboxLaunch?.addEventListener('click', () => {
  applyDraftSandboxToMenu();
  closeChallengeModal();
  btnPlaySolo?.click();
});

// ─── Procedural Endless Expeditions ("Uncharted Sump Generator", v125) ───
const proceduralModal = document.getElementById('procedural-modal');
const btnOpenProcedural = document.getElementById('btn-open-procedural');
const menuProcPillEl = document.getElementById('menu-proc-pill');
const btnProcModalClose = document.getElementById('btn-proc-modal-close');
const procSeedInput = document.getElementById('proc-seed-input');
const btnProcRandom = document.getElementById('btn-proc-random');
const procTierSelect = document.getElementById('proc-tier-select');
const procBiomeSelect = document.getElementById('proc-biome-select');
const procUnlinedCheck = document.getElementById('proc-unlined-check');
const procPreviewBox = document.getElementById('proc-preview-box');
const procUrlInput = document.getElementById('proc-url-input');
const btnProcCopy = document.getElementById('btn-proc-copy');
const btnProcLaunch = document.getElementById('btn-proc-launch');
const btnProcSelect = document.getElementById('btn-proc-select');

let draftProcedural = {
  seed: randomProceduralSeed(),
  tier: 'deep',
  biome: 'cenote',
  unlined: false,
};

function renderProceduralModal() {
  if (!proceduralModal) return;
  draftProcedural.seed = normalizeProceduralSeed(procSeedInput?.value || draftProcedural.seed);
  draftProcedural.tier = PROCEDURAL_TIERS[procTierSelect?.value] ? procTierSelect.value : 'deep';
  draftProcedural.biome = PROCEDURAL_BIOMES[procBiomeSelect?.value] ? procBiomeSelect.value : 'cenote';
  draftProcedural.unlined = Boolean(procUnlinedCheck?.checked);

  const previewLevel = generateProceduralLevel(draftProcedural);
  const gasLabel = previewLevel.gasOverrides?.TMX1455?.name || 'TMX 14/55';
  if (procPreviewBox) {
    procPreviewBox.innerHTML =
      `<strong>${previewLevel.name}</strong><br/>` +
      `Max Depth: <strong>${previewLevel.proceduralMeta.targetDepthM}m</strong> · ` +
      `Segments: <strong>${previewLevel.segments.length}</strong> · ` +
      `Relics: <strong>${previewLevel.collectibles.length}</strong> · ` +
      `Bottom Mix: <strong>${gasLabel}</strong>` +
      (previewLevel.reelMetersPerDiver > 0 ? ` · <strong>🧵 ${previewLevel.reelMetersPerDiver}m Unlined Reel</strong>` : ' · <strong>Fixed Guideline</strong>');
  }
  if (procUrlInput) {
    procUrlInput.value = buildProceduralShareUrl(`${location.origin}${location.pathname}`, draftProcedural);
  }
}

function openProceduralModal() {
  if (!proceduralModal) return;
  setHomeMenuOpen(false);
  if (procSeedInput) procSeedInput.value = draftProcedural.seed;
  if (procTierSelect) procTierSelect.value = draftProcedural.tier;
  if (procBiomeSelect) procBiomeSelect.value = draftProcedural.biome;
  if (procUnlinedCheck) procUnlinedCheck.checked = draftProcedural.unlined;
  renderProceduralModal();
  proceduralModal.hidden = false;
}

function closeProceduralModal() {
  if (proceduralModal) proceduralModal.hidden = true;
}

async function applyProceduralLevelToMenu(cfg, { launchImmediately = false } = {}) {
  const procId = buildProceduralLevelId(cfg);
  await selectAndLoadLevel(procId, { focusMap: false });
  if (menuProcPillEl) {
    const s = normalizeProceduralSeed(cfg.seed);
    menuProcPillEl.textContent = `∞ #${s}`;
    menuProcPillEl.classList.add('active');
  }
  syncSetupDrawerSummary();
  if (launchImmediately) {
    btnPlaySolo?.click();
  } else {
    showToast(`∞ Uncharted Sump #${normalizeProceduralSeed(cfg.seed)} carved & ready!`, 2.6);
  }
}

btnOpenProcedural?.addEventListener('click', openProceduralModal);
menuProcPillEl?.addEventListener('click', openProceduralModal);
btnProcModalClose?.addEventListener('click', closeProceduralModal);
proceduralModal?.addEventListener('click', (e) => {
  if (e.target === proceduralModal) closeProceduralModal();
});
procSeedInput?.addEventListener('input', renderProceduralModal);
procTierSelect?.addEventListener('change', renderProceduralModal);
procBiomeSelect?.addEventListener('change', renderProceduralModal);
procUnlinedCheck?.addEventListener('change', renderProceduralModal);
btnProcRandom?.addEventListener('click', () => {
  draftProcedural.seed = randomProceduralSeed();
  if (procSeedInput) procSeedInput.value = draftProcedural.seed;
  renderProceduralModal();
});
btnProcCopy?.addEventListener('click', async () => {
  const url = procUrlInput?.value || '';
  if (!url) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      showToast('📋 Uncharted Sump seed URL copied!', 2.4);
      return;
    }
  } catch {}
  procUrlInput?.select();
  showToast('Seed URL selected — press Ctrl+C to copy.', 2.2);
});
btnProcSelect?.addEventListener('click', async () => {
  renderProceduralModal();
  closeProceduralModal();
  await applyProceduralLevelToMenu(draftProcedural, { launchImmediately: false });
});
btnProcLaunch?.addEventListener('click', async () => {
  renderProceduralModal();
  closeProceduralModal();
  await applyProceduralLevelToMenu(draftProcedural, { launchImmediately: true });
});

// ─── Spatial 3D Underwater Audio Mixer & Mobile Haptics (v133) ───
const AUDIO_MIXER_PREF_KEY = 'caveDiverAudioMix_v1';
const audioMixerModalEl = document.getElementById('audio-mixer-modal');
const btnOpenAudioMixer = document.getElementById('btn-open-audio-mixer');
const btnHudAudioMixer = document.getElementById('btn-hud-audio-mixer');
const btnAudioMixerClose = document.getElementById('btn-audio-mixer-close');
const btnMixerDone = document.getElementById('btn-mixer-done');
const btnMixerTest = document.getElementById('btn-mixer-test');
const mixerSfxRange = document.getElementById('mixer-sfx-range');
const mixerAmbRange = document.getElementById('mixer-amb-range');
const mixerRadioRange = document.getElementById('mixer-radio-range');
const mixerSfxVal = document.getElementById('mixer-sfx-val');
const mixerAmbVal = document.getElementById('mixer-amb-val');
const mixerRadioVal = document.getElementById('mixer-radio-val');
const mixerSpatialCheck = document.getElementById('mixer-spatial-check');
const mixerHapticsCheck = document.getElementById('mixer-haptics-check');

try {
  const rawMix = localStorage.getItem(AUDIO_MIXER_PREF_KEY);
  if (rawMix) {
    const parsedMix = JSON.parse(rawMix);
    if (parsedMix && typeof parsedMix === 'object') {
      audio.setMixerSettings(parsedMix);
    }
  }
} catch {}

function saveAudioMixerPrefs() {
  try {
    localStorage.setItem(AUDIO_MIXER_PREF_KEY, JSON.stringify(audio.getMixerSettings()));
  } catch {}
}

function syncAudioMixerModalUi() {
  const s = audio.getMixerSettings();
  const sfxPct = Math.round(s.sfxVolume * 100);
  const ambPct = Math.round(s.ambienceVolume * 100);
  const radPct = Math.round(s.radioVolume * 100);
  if (mixerSfxRange) mixerSfxRange.value = String(sfxPct);
  if (mixerAmbRange) mixerAmbRange.value = String(ambPct);
  if (mixerRadioRange) mixerRadioRange.value = String(radPct);
  if (mixerSfxVal) mixerSfxVal.textContent = `${sfxPct}%`;
  if (mixerAmbVal) mixerAmbVal.textContent = `${ambPct}%`;
  if (mixerRadioVal) mixerRadioVal.textContent = `${radPct}%`;
  if (mixerSpatialCheck) mixerSpatialCheck.checked = Boolean(s.spatialEnabled);
  if (mixerHapticsCheck) mixerHapticsCheck.checked = Boolean(s.hapticsEnabled);
}

function openAudioMixerModal() {
  if (!audioMixerModalEl) return;
  setHomeMenuOpen(false);
  setHudMenuOpen(false);
  syncAudioMixerModalUi();
  audioMixerModalEl.hidden = false;
}

function closeAudioMixerModal() {
  if (audioMixerModalEl) audioMixerModalEl.hidden = true;
}

btnOpenAudioMixer?.addEventListener('click', openAudioMixerModal);
btnHudAudioMixer?.addEventListener('click', openAudioMixerModal);
btnAudioMixerClose?.addEventListener('click', closeAudioMixerModal);
btnMixerDone?.addEventListener('click', closeAudioMixerModal);
audioMixerModalEl?.addEventListener('click', (e) => {
  if (e.target === audioMixerModalEl) closeAudioMixerModal();
});
mixerSfxRange?.addEventListener('input', () => {
  const v = Math.max(0, Math.min(100, Number(mixerSfxRange.value) || 0));
  audio.setMixerSettings({ sfxVolume: v / 100 });
  if (mixerSfxVal) mixerSfxVal.textContent = `${v}%`;
  saveAudioMixerPrefs();
});
mixerAmbRange?.addEventListener('input', () => {
  const v = Math.max(0, Math.min(100, Number(mixerAmbRange.value) || 0));
  audio.setMixerSettings({ ambienceVolume: v / 100 });
  if (mixerAmbVal) mixerAmbVal.textContent = `${v}%`;
  saveAudioMixerPrefs();
});
mixerRadioRange?.addEventListener('input', () => {
  const v = Math.max(0, Math.min(100, Number(mixerRadioRange.value) || 0));
  audio.setMixerSettings({ radioVolume: v / 100 });
  if (mixerRadioVal) mixerRadioVal.textContent = `${v}%`;
  saveAudioMixerPrefs();
});
mixerSpatialCheck?.addEventListener('change', () => {
  audio.setMixerSettings({ spatialEnabled: Boolean(mixerSpatialCheck.checked) });
  saveAudioMixerPrefs();
});
mixerHapticsCheck?.addEventListener('change', () => {
  audio.setMixerSettings({ hapticsEnabled: Boolean(mixerHapticsCheck.checked) });
  saveAudioMixerPrefs();
});
btnMixerTest?.addEventListener('click', () => {
  audio.playSpatialTestSweep();
  showToast('🎧 Left → Center → Right spatial sonar sweep!', 2.0);
});
btnChallengeAccept?.addEventListener('click', () => {
  btnPlaySolo?.click();
});
btnChallengeDismiss?.addEventListener('click', () => {
  activeIncomingChallenge = null;
  renderIncomingChallengeBanner();
});
btnDebriefChallenge?.addEventListener('click', () => {
  if (lastDebriefChallengeUrl) {
    copyOrShareChallengeUrl(lastDebriefChallengeUrl, lastDebriefChallengeText);
  }
});
syncSandboxPillUi();
modalLogbook?.addEventListener('click', (e) => {
  if (e.target === modalLogbook) {
    closeLogbookModal();
    return;
  }
  const replayBtn = e.target.closest('button[data-logbook-replay]');
  if (replayBtn) {
    const lid = replayBtn.dataset.logbookReplay;
    if (lid) openLogbookReplayModal(lid);
    return;
  }
  const jumpBtn = e.target.closest('button[data-logbook-jump]');
  if (jumpBtn) {
    if (mode !== 'menu') {
      closeLogbookModal();
      return;
    }
    if (lan.room && !lan.isHost()) {
      showToast('Host selects the expedition site in co-op.', 2.0);
      return;
    }
    const lid = jumpBtn.dataset.logbookJump;
    closeLogbookModal();
    setActiveMenuTab('solo');
    if (lid) selectAndLoadLevel(lid, { focusMap: mapZoomMode === 'site' });
  }
});

// ── GitHub OAuth Cloud Save (Private Gist) & In-App Issue Reporter (v115) ──
const btnGithubAccount = document.getElementById('btn-github-account');
const ghAccountAvatarEl = document.getElementById('gh-account-avatar');
const ghAccountLabelEl = document.getElementById('gh-account-label');
const ghSyncDotEl = document.getElementById('gh-sync-dot');
const logbookGithubBarEl = document.getElementById('logbook-github-bar');
const btnOpenIssue = document.getElementById('btn-open-issue');
const btnHudIssue = document.getElementById('btn-hud-issue');
const modalIssue = document.getElementById('issue-modal');
const btnIssueClose = document.getElementById('btn-issue-close');
const issueModalSubEl = document.getElementById('issue-modal-sub');
const issueKindTabsEl = document.getElementById('issue-kind-tabs');
const issueTitleInput = document.getElementById('issue-title-input');
const issueDescInput = document.getElementById('issue-desc-input');
const issueAttachDiagInput = document.getElementById('issue-attach-diag');
const issueDiagPreviewEl = document.getElementById('issue-diag-preview');
const issueResultEl = document.getElementById('issue-result');
const btnIssueSubmit = document.getElementById('btn-issue-submit');
const btnIssueOpenGh = document.getElementById('btn-issue-open-gh');

let activeIssueKind = 'bug';
let ghSyncDebounceTimer = 0;

function getCurrentAppVersionLabel() {
  const ver = document.querySelector('meta[name="app-version"]')?.getAttribute('content');
  return ver ? `v${ver}` : 'v115';
}

function formatSyncTimeLabel(isoStr) {
  if (!isoStr) return 'Private Gist ready';
  try {
    const dt = new Date(isoStr);
    if (Number.isNaN(dt.getTime())) return 'Private Gist synced';
    return `Synced ${dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  } catch {
    return 'Private Gist synced';
  }
}

function buildCurrentPrefsForSync() {
  const prefs = {
    difficulty: activeDifficulty,
    gear: { ...savedGearLoadout },
    ghostEnabled: Boolean(ghostEnabled),
    torchStickEnabled: Boolean(torchStickEnabled),
  };
  const callsign = getEnteredCallsign();
  if (callsign) prefs.playerName = callsign;
  return prefs;
}

function collectLocalGhostTracks() {
  const out = {};
  for (const lvl of LEVELS) {
    const raw = loadGhostTrack(lvl.id);
    if (!raw) continue;
    const compact = normalizeGhostTrack(raw, 360);
    if (compact) out[lvl.id] = compact;
  }
  return out;
}

function applyMergedGhostTracks(mergedGhosts) {
  if (!mergedGhosts || typeof mergedGhosts !== 'object') return 0;
  let updated = 0;
  for (const [lid, track] of Object.entries(mergedGhosts)) {
    const clean = normalizeGhostTrack(track, 360);
    if (!clean) continue;
    const local = loadGhostTrack(lid);
    const localDur = local && local.length >= 2 ? local[local.length - 1][0] : Infinity;
    const cloudDur = clean[clean.length - 1][0];
    if (!local || (cloudDur > 0 && cloudDur < localDur)) {
      saveGhostTrack(lid, clean);
      updated += 1;
    }
  }
  if (updated > 0) {
    refreshActiveGhostTrack(session?.level || activeLevel);
  }
  return updated;
}

function renderGitHubAccountUi() {
  const st = github.getStatus();
  if (btnGithubAccount) {
    btnGithubAccount.classList.toggle('connected', st.authenticated);
    const markSvg = btnGithubAccount.querySelector('.gh-mark-svg');
    if (st.authenticated && st.user) {
      if (markSvg) markSvg.hidden = Boolean(st.user.avatarUrl);
      if (ghAccountAvatarEl) {
        if (st.user.avatarUrl) {
          ghAccountAvatarEl.src = st.user.avatarUrl;
          ghAccountAvatarEl.hidden = false;
        } else {
          ghAccountAvatarEl.hidden = true;
        }
      }
      if (ghAccountLabelEl) ghAccountLabelEl.textContent = `@${st.user.login}`;
      if (ghSyncDotEl) {
        ghSyncDotEl.hidden = false;
        ghSyncDotEl.classList.toggle('syncing', st.syncing);
        ghSyncDotEl.title = st.syncing ? 'Syncing Private Gist...' : formatSyncTimeLabel(st.lastSyncedAt);
      }
      btnGithubAccount.title = `Signed in as @${st.user.login} · ${formatSyncTimeLabel(st.lastSyncedAt)} (Open Logbook)`;
    } else {
      if (markSvg) markSvg.hidden = false;
      if (ghAccountAvatarEl) ghAccountAvatarEl.hidden = true;
      if (ghAccountLabelEl) ghAccountLabelEl.textContent = st.configured ? 'Sign in' : 'GitHub';
      if (ghSyncDotEl) ghSyncDotEl.hidden = true;
      btnGithubAccount.title = st.configured
        ? 'Sign in with GitHub to cloud-save stats via Private Gist & submit issues'
        : 'Open GitHub Cloud Save & Issue Reporter';
    }
  }

  if (logbookGithubBarEl) {
    logbookGithubBarEl.classList.toggle('connected', st.authenticated);
    if (st.authenticated && st.user) {
      const syncMeta = st.syncing ? 'Syncing private Gist...' : formatSyncTimeLabel(st.lastSyncedAt);
      const ghostMeta = st.ghostCount > 0 ? ` · ${st.ghostCount} PB ghost${st.ghostCount === 1 ? '' : 's'}` : '';
      const gistLink = st.gistUrl
        ? `<a class="btn tiny ghost" href="${escapeHtml(st.gistUrl)}" target="_blank" rel="noopener noreferrer">Gist ↗</a>`
        : '';
      logbookGithubBarEl.innerHTML = `
        <div class="logbook-gh-left">
          ${st.user.avatarUrl ? `<img class="logbook-gh-avatar" src="${escapeHtml(st.user.avatarUrl)}" alt="" />` : ''}
          <div class="logbook-gh-copy">
            <strong>🐙 @${escapeHtml(st.user.login)} · Cloud Save Active</strong>
            <span>${escapeHtml(syncMeta)}${escapeHtml(ghostMeta)} · Private Gist sync across devices</span>
          </div>
        </div>
        <div class="logbook-gh-actions">
          <button type="button" class="btn tiny secondary" data-gh-action="sync" ${st.syncing ? 'disabled' : ''}>${st.syncing ? 'Syncing...' : '☁ Sync Now'}</button>
          ${gistLink}
          <button type="button" class="btn tiny ghost" data-gh-action="issue">🐛 Issue</button>
          <button type="button" class="btn tiny ghost" data-gh-action="logout">Sign Out</button>
        </div>
      `;
    } else if (st.configured) {
      logbookGithubBarEl.innerHTML = `
        <div class="logbook-gh-left">
          <div class="logbook-gh-copy">
            <strong>☁ Sync Your Dive Career with GitHub</strong>
            <span>Save clears, Field Guide &amp; streaks in your own Private Gist + submit issues directly.</span>
          </div>
        </div>
        <div class="logbook-gh-actions">
          <button type="button" class="btn tiny primary" data-gh-action="login">Sign in with GitHub</button>
          <button type="button" class="btn tiny ghost" data-gh-action="issue">🐛 Report Issue</button>
        </div>
      `;
    } else {
      logbookGithubBarEl.innerHTML = `
        <div class="logbook-gh-left">
          <div class="logbook-gh-copy">
            <strong>🐙 GitHub Cloud Save &amp; Issues</strong>
            <span>Add GITHUB_CLIENT_ID &amp; GITHUB_CLIENT_SECRET in Vercel to enable 1-click OAuth Gist sync.</span>
          </div>
        </div>
        <div class="logbook-gh-actions">
          <button type="button" class="btn tiny secondary" data-gh-action="issue">🐛 Report Issue</button>
        </div>
      `;
    }
  }

  if (btnIssueSubmit) {
    if (st.authenticated && st.user) {
      btnIssueSubmit.textContent = `Submit as @${st.user.login}`;
      btnIssueSubmit.hidden = false;
    } else if (st.configured) {
      btnIssueSubmit.textContent = 'Sign in with GitHub to Submit';
      btnIssueSubmit.hidden = false;
    } else {
      btnIssueSubmit.hidden = true;
    }
  }
  if (issueModalSubEl) {
    issueModalSubEl.textContent =
      st.authenticated && st.user
        ? `Signed in as @${st.user.login} — submits directly to ${st.repo}`
        : `Sign in with GitHub to submit directly, or open a pre-filled issue on ${st.repo}`;
  }
}

async function syncCareerStatsWithGitHub({ quiet = true } = {}) {
  if (!github.authenticated) return { ok: false };
  renderGitHubAccountUi();
  const localBook = loadCareerLogbook();
  const localGhosts = collectLocalGhostTracks();
  const res = await github.syncStats(localBook, buildCurrentPrefsForSync(), localGhosts);
  if (res.ok && res.logbook) {
    const merged = mergeCareerLogbooks(localBook, res.logbook);
    saveCareerLogbook(merged, { skipCloudSync: true });
    applyMergedGhostTracks(res.ghosts);

    // Restore cloud callsign & loadout/preferences on fresh devices (without clobbering explicit local overrides)
    const prefs = res.prefs || {};
    if (!getEnteredCallsign() && (prefs.playerName || github.user?.login)) {
      const nextName = sanitizeCallsignInput(prefs.playerName || github.user?.login || '');
      if (nextName && playerNameInput) {
        playerNameInput.value = nextName;
        syncCallsignCount();
        try {
          localStorage.setItem('caveDiverCallsign', nextName);
        } catch {}
      }
    }
    try {
      if (prefs.gear && !localStorage.getItem(GEAR_LOADOUT_KEY)) {
        const { unlockedIds } = computeUnlockedGear(merged, LEVELS);
        savedGearLoadout = sanitizeGearLoadout(prefs.gear, unlockedIds);
        saveGearLoadout({ skipCloudSync: true });
      }
      if (
        (prefs.difficulty === 'guided' || prefs.difficulty === 'standard' || prefs.difficulty === 'hardcore') &&
        !localStorage.getItem(DIFFICULTY_PREF_KEY)
      ) {
        activeDifficulty = prefs.difficulty;
        localStorage.setItem(DIFFICULTY_PREF_KEY, activeDifficulty);
      }
      if (typeof prefs.ghostEnabled === 'boolean' && localStorage.getItem(GHOST_PREF_KEY) === null) {
        ghostEnabled = prefs.ghostEnabled;
        localStorage.setItem(GHOST_PREF_KEY, ghostEnabled ? '1' : '0');
      }
      if (typeof prefs.torchStickEnabled === 'boolean' && localStorage.getItem(TORCH_STICK_PREF_KEY) === null) {
        torchStickEnabled = prefs.torchStickEnabled;
        localStorage.setItem(TORCH_STICK_PREF_KEY, torchStickEnabled ? '1' : '0');
      }
    } catch {}

    syncPreferenceMenuButtons();
    renderCareerSummary();
    renderTechGearDock();
    renderDailyChallengeCard();
    renderLevelCards();
    if (modalLogbook && !modalLogbook.hidden) {
      openLogbookModal();
    }
    if (!quiet) {
      const gCount = Object.keys(res.ghosts || {}).length;
      const gTxt = gCount > 0 ? ` + ${gCount} PB ghost${gCount === 1 ? '' : 's'}` : '';
      showToast(`☁ Synced career stats${gTxt} to @${github.user?.login}'s Private Gist!`, 2.8);
    }
  } else if (!quiet && res.error) {
    showToast(res.error, 3.0);
  }
  renderGitHubAccountUi();
  return res;
}

function scheduleGitHubStatsSync() {
  if (!github.authenticated) return;
  if (ghSyncDebounceTimer) clearTimeout(ghSyncDebounceTimer);
  ghSyncDebounceTimer = setTimeout(() => {
    ghSyncDebounceTimer = 0;
    syncCareerStatsWithGitHub({ quiet: true });
  }, 900);
}

function triggerGitHubLogin() {
  if (!github.configured) {
    openLogbookModal();
    showToast('Set GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET in Vercel to activate GitHub Sign-In.', 3.8);
    return;
  }
  window.location.href = github.getLoginUrl();
}

btnGithubAccount?.addEventListener('click', () => {
  setHomeMenuOpen(false);
  if (github.authenticated) {
    openLogbookModal();
  } else if (github.configured) {
    triggerGitHubLogin();
  } else {
    openLogbookModal();
  }
});

logbookGithubBarEl?.addEventListener('click', async (e) => {
  const actBtn = e.target.closest('button[data-gh-action]');
  if (!actBtn) return;
  const action = actBtn.dataset.ghAction;
  if (action === 'login') {
    triggerGitHubLogin();
  } else if (action === 'sync') {
    await syncCareerStatsWithGitHub({ quiet: false });
  } else if (action === 'logout') {
    await github.logout();
    renderGitHubAccountUi();
    showToast('Signed out of GitHub (local logbook preserved).', 2.4);
  } else if (action === 'issue') {
    closeLogbookModal();
    openIssueModal();
  }
});

function collectIssueDiagnostics() {
  const book = loadCareerLogbook();
  const sum = formatLogbookSummary(book, LEVELS.length);
  const lvl = session?.level || activeLevel;
  const diff = session?.difficulty || activeDifficulty;
  const vp = typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight} @${(window.devicePixelRatio || 1).toFixed(1)}x` : '';
  return {
    appVersion: getCurrentAppVersionLabel(),
    levelId: lvl?.id || '',
    levelName: lvl?.name || '',
    difficulty: diff,
    multiplayer: Boolean(isMultiplayer),
    careerSummary: `${sum.clearedCount}/${sum.totalSites} cleared · ${sum.totalDives} dives · ${sum.deepestM.toFixed(0)}m max`,
    viewport: vp,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}

function setIssueKind(kind) {
  activeIssueKind = kind === 'feature' || kind === 'feedback' ? kind : 'bug';
  if (issueKindTabsEl) {
    for (const btn of issueKindTabsEl.querySelectorAll('.issue-kind-btn')) {
      const active = btn.dataset.issueKind === activeIssueKind;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    }
  }
  if (issueTitleInput) {
    issueTitleInput.placeholder =
      activeIssueKind === 'feature'
        ? 'Short feature title (e.g. Add dive log export)'
        : activeIssueKind === 'feedback'
          ? 'Short feedback summary'
          : 'Short bug summary (e.g. Co-op banner overlap on mobile)';
  }
}

function openIssueModal(defaultKind = 'bug') {
  if (!modalIssue) return;
  setHomeMenuOpen(false);
  setHudMenuOpen(false);
  setIssueKind(defaultKind);
  if (issueResultEl) {
    issueResultEl.hidden = true;
    issueResultEl.className = 'issue-result';
    issueResultEl.innerHTML = '';
  }
  const diag = collectIssueDiagnostics();
  if (issueDiagPreviewEl) {
    issueDiagPreviewEl.textContent = `${diag.appVersion} · ${diag.levelName || 'Menu'} · ${diag.multiplayer ? 'Co-op' : 'Solo'}`;
  }
  renderGitHubAccountUi();
  modalIssue.hidden = false;
  issueTitleInput?.focus();
}

function closeIssueModal() {
  if (modalIssue) modalIssue.hidden = true;
}

btnOpenIssue?.addEventListener('click', () => openIssueModal('bug'));
btnHudIssue?.addEventListener('click', () => {
  if (mode === 'diving' && !isMultiplayer && session && !session.endedState) {
    setDivePaused(true);
  }
  openIssueModal('bug');
});
btnIssueClose?.addEventListener('click', closeIssueModal);
modalIssue?.addEventListener('click', (e) => {
  if (e.target === modalIssue) closeIssueModal();
});
issueKindTabsEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('.issue-kind-btn');
  if (btn?.dataset?.issueKind) setIssueKind(btn.dataset.issueKind);
});

btnIssueOpenGh?.addEventListener('click', () => {
  const title = issueTitleInput?.value.trim() || '';
  const description = issueDescInput?.value.trim() || '';
  const context = issueAttachDiagInput?.checked ? collectIssueDiagnostics() : {};
  const url = buildPrefilledIssueUrl({
    kind: activeIssueKind,
    title,
    description,
    context,
    repo: github.repo,
  });
  window.open(url, '_blank', 'noopener,noreferrer');
});

btnIssueSubmit?.addEventListener('click', async () => {
  if (!github.authenticated) {
    triggerGitHubLogin();
    return;
  }
  const title = issueTitleInput?.value.trim() || '';
  const description = issueDescInput?.value.trim() || '';
  if (title.length < 3 || description.length < 5) {
    if (issueResultEl) {
      issueResultEl.hidden = false;
      issueResultEl.className = 'issue-result err';
      issueResultEl.textContent = 'Please enter a short title (3+ chars) and details (5+ chars).';
    }
    return;
  }
  btnIssueSubmit.disabled = true;
  btnIssueSubmit.textContent = 'Submitting...';
  const context = issueAttachDiagInput?.checked ? collectIssueDiagnostics() : {};
  const res = await github.submitIssue({
    kind: activeIssueKind,
    title,
    description,
    context,
  });
  btnIssueSubmit.disabled = false;
  renderGitHubAccountUi();

  if (res.ok && res.issue) {
    if (issueTitleInput) issueTitleInput.value = '';
    if (issueDescInput) issueDescInput.value = '';
    if (issueResultEl) {
      issueResultEl.hidden = false;
      issueResultEl.className = 'issue-result ok';
      issueResultEl.innerHTML = `✓ Issue <strong>#${escapeHtml(String(res.issue.number))}</strong> created! <a href="${escapeHtml(res.issue.url)}" target="_blank" rel="noopener noreferrer">View on GitHub ↗</a>`;
    }
    showToast(`🐙 GitHub Issue #${res.issue.number} submitted!`, 3.2);
  } else {
    if (issueResultEl) {
      issueResultEl.hidden = false;
      issueResultEl.className = 'issue-result err';
      const fallback = res.fallbackUrl
        ? ` <a href="${escapeHtml(res.fallbackUrl)}" target="_blank" rel="noopener noreferrer">Open on GitHub ↗</a>`
        : '';
      issueResultEl.innerHTML = `${escapeHtml(res.error || 'Could not submit issue.')}${fallback}`;
    }
  }
});

async function initGitHubAuth() {
  const ghFlag = URL_PARAMS.get('gh');
  if (ghFlag && typeof history !== 'undefined' && typeof history.replaceState === 'function') {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('gh');
    history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  }
  await github.fetchSession();
  renderGitHubAccountUi();
  if (github.authenticated) {
    if (!getEnteredCallsign() && github.user?.login && playerNameInput) {
      const cleanName = sanitizeCallsignInput(github.user.name || github.user.login);
      if (cleanName) {
        playerNameInput.value = cleanName;
        syncCallsignCount();
        try {
          localStorage.setItem('caveDiverCallsign', cleanName);
        } catch {}
      }
    }
    await syncCareerStatsWithGitHub({ quiet: ghFlag !== 'connected' });
  } else if (ghFlag === 'not_configured') {
    showToast('GitHub OAuth not configured yet — add GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET in Vercel.', 4.2);
  } else if (ghFlag && ghFlag !== 'connected') {
    showToast(`GitHub sign-in canceled or failed (${ghFlag}).`, 3.2);
  }
}

function loadGhostTrack(levelId) {
  if (!levelId) return null;
  try {
    const raw = localStorage.getItem(`caveDiverGhost_${levelId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length >= 2 ? parsed : null;
  } catch {
    return null;
  }
}

function saveGhostTrack(levelId, track) {
  if (!levelId || !Array.isArray(track) || track.length < 2) return;
  try {
    localStorage.setItem(`caveDiverGhost_${levelId}`, JSON.stringify(track.slice(0, 1200)));
  } catch {}
}

function refreshActiveGhostTrack(level) {
  if (!ghostEnabled || !level) {
    activeGhostTrack = null;
    activeGhostIsPar = false;
    return;
  }
  const saved = loadGhostTrack(level.id);
  if (saved) {
    activeGhostTrack = saved;
    activeGhostIsPar = false;
  } else {
    activeGhostTrack = buildParGhostTrack(level);
    activeGhostIsPar = Boolean(activeGhostTrack);
  }
}

function renderDebriefDepthProfile(profile, maxDepthM, success, peerProfiles = null) {
  const wrap = document.getElementById('debrief-profile-wrap');
  const svg = document.getElementById('debrief-profile-svg');
  if (!wrap || !svg) return;
  if (!Array.isArray(profile) || profile.length < 2) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const buddyTraces = [];
  if (peerProfiles instanceof Map) {
    for (const rec of peerProfiles.values()) {
      if (rec && Array.isArray(rec.points) && rec.points.length >= 2) {
        buddyTraces.push(rec);
      }
    }
  }
  const W = 420;
  const H = 124;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  let maxT = Math.max(10, profile[profile.length - 1].t || 10);
  let peakAllD = Math.max(maxDepthM || 0, ...profile.map((p) => p.d));
  for (const bt of buddyTraces) {
    const lastPt = bt.points[bt.points.length - 1];
    if (lastPt?.t > maxT) maxT = lastPt.t;
    for (const pt of bt.points) {
      if (pt.d > peakAllD) peakAllD = pt.d;
    }
  }
  const maxD = Math.max(12, Math.ceil(peakAllD / 10) * 10);

  const sx = (t) => padL + (t / maxT) * plotW;
  const sy = (d) => padT + (d / maxD) * plotH;

  const gasColor = (g) => (g === 'O2' ? '#34d399' : g === 'TMX1455' ? '#fbbf24' : '#38bdf8');
  const buddyPalette = ['#f472b6', '#c084fc', '#fb923c'];

  let markup = '';
  // Subtle depth horizontal grid lines (0m, 50%, 100%)
  for (const frac of [0, 0.5, 1]) {
    const dVal = Math.round(maxD * frac);
    const y = sy(dVal).toFixed(1);
    markup += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(148,163,184,0.16)" stroke-dasharray="${frac === 0 ? '' : '3 3'}"/>`;
    markup += `<text x="${padL - 5}" y="${Number(y) + 3}" text-anchor="end" fill="#94a3b8" font-size="9" font-family="ui-monospace,monospace">${dVal}m</text>`;
  }

  // Soft translucent area fill under local diver profile curve
  let areaPts = `${sx(profile[0].t).toFixed(1)},${padT} `;
  for (const p of profile) {
    areaPts += `${sx(p.t).toFixed(1)},${sy(p.d).toFixed(1)} `;
  }
  areaPts += `${sx(profile[profile.length - 1].t).toFixed(1)},${padT}`;
  markup += `<polygon points="${areaPts}" fill="rgba(14,165,233,0.12)"/>`;

  // Co-op buddy comparison depth traces (dashed warm accent overlays, v117)
  buddyTraces.forEach((bt, bIdx) => {
    const col = buddyPalette[bIdx % buddyPalette.length];
    const polyPts = bt.points.map((pt) => `${sx(pt.t).toFixed(1)},${sy(pt.d).toFixed(1)}`).join(' ');
    markup += `<polyline points="${polyPts}" fill="none" stroke="${col}" stroke-width="1.8" stroke-dasharray="4 3" stroke-linecap="round" stroke-linejoin="round" opacity="0.88"/>`;
  });

  // Highlight deco-stop segments with soft emerald shading
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1];
    const b = profile[i];
    const x1 = sx(a.t).toFixed(1);
    const y1 = sy(a.d).toFixed(1);
    const x2 = sx(b.t).toFixed(1);
    const y2 = sy(b.d).toFixed(1);
    if (b.deco > 0 && Math.abs(b.d - b.deco) <= 2.2) {
      markup += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(52,211,153,0.35)" stroke-width="6" stroke-linecap="round"/>`;
    }
    markup += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${gasColor(b.gas)}" stroke-width="2.3" stroke-linecap="round"/>`;
  }

  // Peak depth marker pin
  let peak = profile[0];
  for (const p of profile) {
    if (p.d > peak.d) peak = p;
  }
  const px = sx(peak.t).toFixed(1);
  const py = sy(peak.d).toFixed(1);
  markup += `<circle cx="${px}" cy="${py}" r="3.4" fill="#f87171" stroke="#0f172a" stroke-width="1.2"/>`;
  markup += `<text x="${Math.min(W - 44, Math.max(padL + 24, Number(px)))}" y="${Math.min(H - 5, Number(py) + 12)}" text-anchor="middle" fill="#fca5a5" font-size="9" font-weight="700" font-family="ui-monospace,monospace">MAX ${peak.d.toFixed(0)}m</text>`;

  // Final point (surface or incident marker)
  const endP = profile[profile.length - 1];
  markup += `<circle cx="${sx(endP.t).toFixed(1)}" cy="${sy(endP.d).toFixed(1)}" r="3.4" fill="${success ? '#34d399' : '#ef4444'}" stroke="#0f172a" stroke-width="1.2"/>`;
  markup += `<text x="${W - padR}" y="${H - 4}" text-anchor="end" fill="#94a3b8" font-size="9" font-family="ui-monospace,monospace">${formatRunClock(maxT)}</text>`;

  // Compact co-op legend in top-right when buddy trace(s) are overlaid
  if (buddyTraces.length > 0) {
    const names = buddyTraces
      .slice(0, 2)
      .map((bt, idx) => `<tspan fill="${buddyPalette[idx % buddyPalette.length]}">╌ ${escapeHtml((bt.name || 'Buddy').slice(0, 10))}</tspan>`)
      .join('  ');
    markup += `<text x="${W - padR}" y="10" text-anchor="end" font-size="8.5" font-weight="700" font-family="ui-monospace,monospace"><tspan fill="#38bdf8">━ You</tspan>  ${names}</text>`;
  }

  // Interactive telemetry scrubber crosshair overlay (v126)
  markup += `<g id="debrief-scrub-cursor" visibility="hidden">`;
  markup += `<line id="debrief-scrub-line" x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="3 2"/>`;
  markup += `<circle id="debrief-scrub-dot" cx="${padL}" cy="${padT}" r="4.2" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.8"/>`;
  markup += `</g>`;

  svg.innerHTML = markup;

  const scrubEl = document.getElementById('debrief-profile-scrub');
  const cursorGroup = svg.querySelector('#debrief-scrub-cursor');
  const cursorLine = svg.querySelector('#debrief-scrub-line');
  const cursorDot = svg.querySelector('#debrief-scrub-dot');
  const defaultScrubHint = 'Hover or drag across the depth curve to inspect PPO₂, CNS%, GF99%, Heart Rate & Tank Bar';
  if (scrubEl) scrubEl.textContent = defaultScrubHint;

  const updateScrubFromClientX = (clientX) => {
    const rect = svg.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const clampedFrac = Math.max(0, Math.min(1, (svgX - padL) / plotW));
    const sample = sampleDiveProfileAtTime(profile, clampedFrac * maxT);
    if (!sample) return;
    const cx = sx(sample.t).toFixed(1);
    const cy = sy(sample.d).toFixed(1);
    if (cursorGroup) cursorGroup.setAttribute('visibility', 'visible');
    if (cursorLine) {
      cursorLine.setAttribute('x1', cx);
      cursorLine.setAttribute('x2', cx);
    }
    if (cursorDot) {
      cursorDot.setAttribute('cx', cx);
      cursorDot.setAttribute('cy', cy);
    }
    if (scrubEl) {
      const decoTxt = sample.deco > 0 ? ` · STOP ${sample.deco}m` : '';
      scrubEl.textContent =
        `⏱ ${formatRunClock(sample.t)} · ${sample.d.toFixed(1)}m · ${sample.gas} (${sample.bar}b) · PPO₂ ${sample.ppo2.toFixed(2)} · CNS ${sample.cns}% · GF99 ${sample.gf99}% · ♥ ${sample.hr}bpm${decoTxt}`;
    }
  };
  svg.onpointermove = (e) => updateScrubFromClientX(e.clientX);
  svg.onpointerdown = (e) => updateScrubFromClientX(e.clientX);
  svg.onpointerleave = () => {
    if (cursorGroup) cursorGroup.setAttribute('visibility', 'hidden');
    if (scrubEl) scrubEl.textContent = defaultScrubHint;
  };
}

function renderDebriefCertifications(logbook) {
  const el = document.getElementById('debrief-certs');
  if (!el) return;
  const info = computeCertifications(logbook, LEVELS);
  if (info.earned.length === 0 && !info.next) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  let html = '';
  for (const c of info.earned) {
    html += `<span class="cert-pill" title="${escapeHtml(c.requirement)}">${c.icon} ${escapeHtml(c.title)}</span>`;
  }
  if (info.next) {
    html += `<span class="cert-pill locked" title="${escapeHtml(info.next.requirement)}">🔒 Next: ${escapeHtml(info.next.title)} (${escapeHtml(info.next.requirement)})</span>`;
  }
  el.innerHTML = html;
}

function handleWreckAction() {
  if (mode !== 'diving' || !session || divePaused || session.endedState) return false;
  const res = triggerWreckAction(session, sessionStepCallbacks);
  return Boolean(res?.handled);
}

btnWreckAction?.addEventListener('click', (e) => {
  e.preventDefault();
  handleWreckAction();
});

function syncWreckActionHud(prompt) {
  if (!btnWreckAction) return;
  if (!prompt || mode !== 'diving' || divePaused || session?.endedState) {
    if (!btnWreckAction.hidden) {
      btnWreckAction.hidden = true;
      lastWreckActionKey = '';
    }
    return;
  }
  const pct = Math.round((prompt.progress || 0) * 100);
  const key = `${prompt.kind}|${prompt.label}|${prompt.detail}|${pct}`;
  if (btnWreckAction.hidden) btnWreckAction.hidden = false;
  if (key === lastWreckActionKey) return;
  lastWreckActionKey = key;
  btnWreckAction.classList.toggle('is-cut', prompt.kind === 'cut-net');
  btnWreckAction.classList.toggle('is-hatch', prompt.kind === 'open-hatch');
  btnWreckAction.classList.toggle('is-clip', prompt.kind === 'clip-line');
  btnWreckAction.classList.toggle('is-unclip', prompt.kind === 'unclip-line');
  btnWreckAction.classList.toggle('is-stage', prompt.kind === 'refill-stage');
  btnWreckAction.classList.toggle('is-marker', prompt.kind === 'place-marker');
  if (wreckActionLabelEl) wreckActionLabelEl.textContent = prompt.label;
  if (wreckActionDetailEl) wreckActionDetailEl.textContent = prompt.detail || '';
  if (wreckActionProgressEl) wreckActionProgressEl.style.width = `${pct}%`;
}

let celebrationParticles = [];
let debriefAnimFrame = 0;
let syncWakeLockFn = null;

function cancelDebriefAnimations() {
  if (debriefAnimFrame) {
    cancelAnimationFrame(debriefAnimFrame);
    debriefAnimFrame = 0;
  }
  celebrationParticles.length = 0;
}

function spawnCelebrationConfetti() {
  const palette = ['#fde047', '#38bdf8', '#4ade80', '#f472b6', '#fb923c', '#ffffff'];
  celebrationParticles = [];
  for (let i = 0; i < 65; i++) {
    const isBubble = i % 3 === 0;
    celebrationParticles.push({
      x: 0.08 + Math.random() * 0.84,
      y: isBubble ? 0.92 + Math.random() * 0.18 : 0.15 + Math.random() * 0.45,
      vx: (Math.random() - 0.5) * 0.22,
      vy: isBubble ? -(0.18 + Math.random() * 0.22) : -(0.28 + Math.random() * 0.34),
      gravity: isBubble ? -0.02 : 0.38,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 6,
      size: isBubble ? 4 + Math.random() * 6 : 6 + Math.random() * 6,
      color: palette[i % palette.length],
      shape: isBubble ? 'bubble' : 'confetti',
      life: 4.5 + Math.random() * 2.5,
      maxLife: 7.0,
    });
  }
}

function formatRunClock(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function startDiveRun(multiplayer = false, restoredState = null) {
  audio.unlock();
  audio._ambienceTimer = 4.0;
  audio.resetEnvironmentFilter();
  input?.resetAll?.();
  closeLogbookModal();
  toggleShearwaterComputer(false);
  toggleSignalWheel(false);
  closeDiveGuideModal(false);
  closeLeaderboardStatsModal();
  directJoinToDive = false;
  isMultiplayer = multiplayer;
  mode = 'diving';
  divePaused = false;
  spectatingPeer = false;
  spectatePeerIdx = 0;
  pendingUnsafeGasId = '';
  pendingUnsafeGasAt = 0;
  pendingAbortAt = 0;
  rewindHoldTimer = 0;
  if (hudPauseOverlay) hudPauseOverlay.hidden = true;
  if (btnDropTow) btnDropTow.hidden = true;
  if (btnTowBuddy) btnTowBuddy.hidden = true;
  if (btnShareGas) btnShareGas.hidden = true;
  syncWreckActionHud(null);
  hideHudPhotoCard();
  celebrationParticles = [];
  if (debriefAnimFrame) {
    cancelAnimationFrame(debriefAnimFrame);
    debriefAnimFrame = 0;
  }

  const diverName = playerNameInput?.value.trim() || 'Diver 1';
  const slotOffsets = [0, -1.35, 1.35, -2.5];
  const spawnOffsetX = multiplayer ? (slotOffsets[lan.getPlayerSlotIndex()] ?? 0) : 0;
  const activeGear = getEffectiveGearLoadout();
  const dailyRun =
    !multiplayer && activeDailyChallenge && activeDailyChallenge.levelId === activeLevel.id
      ? activeDailyChallenge
      : null;
  const effectiveMutatorId = dailyRun?.mutatorId || (!multiplayer ? activeSandboxMutatorId : '') || '';
  session = createDiveSession(activeLevel, {
    diverName,
    spawnOffsetX,
    difficulty: activeDifficulty,
    gear: activeGear,
    mutatorId: effectiveMutatorId,
    dailyDateKey: dailyRun?.dateKey || '',
    customMixOverrides: getActiveCustomMixOverrides(activeLevel),
    drillsEnabled,
  });
  const runMutMeta = session.mutatorId ? getDailyMutatorById(session.mutatorId) : null;
  session._dailyBadgeLabel = runMutMeta
    ? `${session.dailyDateKey ? '📅' : '🎛️'} ${runMutMeta.icon} ${runMutMeta.shortName}`
    : '';
  session._challenge =
    !multiplayer && activeIncomingChallenge && activeIncomingChallenge.siteId === activeLevel.id
      ? { ...activeIncomingChallenge }
      : null;
  lastGearHudKey = '';
  syncTechGearHud(session);
  syncMinimapButtonUi();
  refreshActiveGhostTrack(activeLevel);
  session.endedState = null;
  session.localOutcome = null;
  session._awaitingHostStart = Boolean(restoredState?.awaitingHostStart);
  session.restoredPeerLines = new Map();

  if (restoredState?.checkpoints) {
    for (const cpId of restoredState.checkpoints) session.checkpointsHit.add(cpId);
  }
  if (restoredState?.collectibles) {
    for (const cId of restoredState.collectibles) session.collectedIds.add(cId);
  }
  if (Array.isArray(restoredState?.openedHatches)) {
    for (const hId of restoredState.openedHatches) {
      session.openedHatchIds.add(hId);
      const hObj = activeLevel.watertightHatches?.find((h) => h.id === hId);
      session.hatchBonusScore = (session.hatchBonusScore || 0) + (hObj?.bonusPoints || 150);
    }
  }
  if (Array.isArray(restoredState?.cutSnags)) {
    for (const sId of restoredState.cutSnags) session.cutSnagIds.add(sId);
  }
  if (Array.isArray(restoredState?.placedMarkers)) {
    for (const mId of restoredState.placedMarkers) session.placedMarkerIds.add(mId);
  }
  if (restoredState?.bodyRecoveredBy) {
    session.bodyRecovered = true;
    session.carryingBody = restoredState.bodyRecoveredBy === lan.clientId;
  }
  if (Array.isArray(restoredState?.playerLines)) {
    for (const entry of restoredState.playerLines) {
      if (entry.playerId === lan.clientId) {
        session.guidelineChains = entry.chains || [];
        let used = 0;
        for (const ch of session.guidelineChains) {
          for (let i = 1; i < ch.length; i++) {
            used += Math.hypot(ch[i].x - ch[i - 1].x, ch[i].y - ch[i - 1].y);
          }
        }
        session.reelRemainingM = Math.max(0, session.reelMaxMeters - used);
      } else {
        session.restoredPeerLines.set(entry.playerId, entry.chains || []);
      }
    }
  }

  screenLoader.classList.add('done');
  if (loaderCoopSyncEl) loaderCoopSyncEl.hidden = true;
  cancelDebriefAnimations();
  setHudMenuOpen(false);
  setHomeMenuOpen(false);
  screenMenu.classList.remove('menu-submerging');
  screenMenu.hidden = true;
  screenDebrief.hidden = true;
  debriefReplay.stop();
  screenHud.classList.remove('hud-team-hold');
  screenHud.hidden = false;
  syncWakeLockFn?.();
  if (coopCommsEl) coopCommsEl.hidden = !(multiplayer && lan.getPeers().length > 0);
  if (multiplayer && lan.room) {
    syncRoomInviteUi(lan.room);
  } else {
    syncRoomInviteUi(null);
  }
  if (coopWaitBannerEl) coopWaitBannerEl.hidden = true;
  const bottomMixName = getActiveGasName('TMX1455');
  const openMsg = dailyMutMeta
    ? `📅 DAILY · ${dailyMutMeta.icon} ${dailyMutMeta.name}: ${dailyMutMeta.shortDesc}`
    : activeLevel.isWreck
      ? activeLevel.reelMetersPerDiver > 0
        ? `🚢 Descend the shot line! Switch to ${bottomMixName} [2] at ${Math.round(activeLevel.ascentSwitchDepthM || 22)}m & anchor your ${activeLevel.reelMetersPerDiver}m wreck reel [G].`
        : `🚢 Descend the boat shot line! Switch to ${bottomMixName} [2] at ${Math.round(activeLevel.ascentSwitchDepthM || 22)}m before entering the hull.`
      : activeLevel.reelMetersPerDiver > 0
        ? `Unlined cave: [G] deploy ${activeLevel.reelMetersPerDiver}m reel. STOP at 22m & switch to ${bottomMixName} [2]!`
        : `Start on ${getActiveGasName('EAN32')}. STOP at 22m & switch to ${bottomMixName} [2] before descending deeper!`;
  showToast(openMsg, 4.8);
}

function finishDiveRun(success, title, detail, outcomeScore = null) {
  if (!session) return;
  cancelDebriefAnimations();
  input?.resetAll?.();
  audio.resetEnvironmentFilter();
  mode = 'debrief';
  divePaused = false;
  spectatingPeer = false;
  setHudMenuOpen(false);
  if (hudPauseOverlay) hudPauseOverlay.hidden = true;
  hideHudPhotoCard();
  screenHud.classList.remove('hud-team-hold');
  screenHud.hidden = true;
  if (coopCommsEl) coopCommsEl.hidden = true;
  if (coopWaitBannerEl) coopWaitBannerEl.hidden = true;
  screenDebrief.hidden = false;
  syncWakeLockFn?.();

  const btnRetry = document.getElementById('btn-retry');
  const btnMenu = document.getElementById('btn-menu');
  const inCoopCrew = Boolean(isMultiplayer && lan.room && lan.getPeers().length > 0);
  if (btnRetry) btnRetry.textContent = inCoopCrew ? 'CO-OP ROOM LOBBY' : 'DIVE AGAIN';
  if (btnMenu) btnMenu.textContent = inCoopCrew ? 'LEAVE CO-OP ROOM' : 'MAIN MENU';
  if (btnNextLevel) {
    const curIdx = LEVELS.findIndex((l) => l.id === session.level?.id);
    const hasNext = curIdx >= 0 && curIdx + 1 < LEVELS.length;
    const canAdvance = Boolean(success && hasNext && (!inCoopCrew || lan.isHost()));
    btnNextLevel.hidden = !canAdvance;
    if (canAdvance) {
      const nextLvl = LEVELS[curIdx + 1];
      btnNextLevel.textContent = `NEXT: L${curIdx + 2} ${nextLvl.name} →`;
    }
  }

  const { diver, diveState, checkpointsHit, level } = session;
  const localSummary =
    outcomeScore ||
    computeDiverScoreSummary({
      name: diver.name,
      level,
      diveState,
      checkpointsHit,
      collectedIds: session.collectedIds,
      exploredCount: session.exploredCells?.size || 0,
      totalExploreCells: session.exploreCells?.length || 1,
      diveTimeSec: diveState.diveTimeSec,
      hatchBonusScore: session.hatchBonusScore || 0,
      photoBonusScore: session.camera?.photoBonusScore || 0,
      encounterBonusScore: session.encounters?.encounterBonusScore || 0,
      drillBonusScore: session.drills?.bonusScore || 0,
      mutatorId: session.mutatorId || '',
    });

  if (isMultiplayer) {
    lan.sendPlayerState(
      buildPlayerStatePayload(session, {
        vx: 0,
        vy: 0,
        condition: diveState.impairment?.primaryCondition || 'NOMINAL',
        surfaced: Boolean(success),
        healthPct: localSummary.healthPct,
        gasRemainingPct: localSummary.gasRemainingPct,
        collectiblesFound: localSummary.collectiblesFound,
        exploredPct: localSummary.exploredPct,
        totalScore: localSummary.totalScore,
      }),
      { force: true }
    );
  }

  const teamSummary = computeTeamScoreSummary(localSummary, isMultiplayer ? lan.getPeers() : [], {
    localRescued: Boolean(session.rescued),
  });

  if (success) {
    spawnCelebrationConfetti();
    audio.playVictoryFanfare();
  } else {
    audio.playFatality();
  }

  const badge = document.getElementById('debrief-badge');
  badge.textContent = success
    ? teamSummary.isTeam
      ? teamSummary.rescuedCount > 0 && teamSummary.allSurvived
        ? 'CREW RESCUE COMPLETE'
        : teamSummary.allSurvived
          ? 'TEAM EXPEDITION COMPLETE'
          : 'PARTIAL TEAM SURFACE'
      : 'DIVE COMPLETE'
    : 'DIVE FATALITY';
  badge.className = `debrief-badge ${success ? 'ok' : 'danger'}`;
  const runDiff = session.difficulty || activeDifficulty;
  const runDiffMeta = getDifficultyMeta(runDiff) || DIFFICULTY_MODES[1];
  if (debriefModeBadgeEl) {
    debriefModeBadgeEl.textContent = runDiffMeta.fullBadge;
    debriefModeBadgeEl.className = `mode-badge mode-${runDiffMeta.id}`;
  }
  if (debriefGearBadgeEl) {
    const equippedIcons = TECH_GEAR_CATALOG.filter((g) => session.gear?.[g.id]).map((g) => `${g.icon} ${g.shortName}`);
    if (equippedIcons.length > 0) {
      debriefGearBadgeEl.textContent = equippedIcons.join(' · ');
      debriefGearBadgeEl.hidden = false;
    } else {
      debriefGearBadgeEl.hidden = true;
    }
  }

  document.getElementById('debrief-title').textContent = title;
  document.getElementById('debrief-detail').textContent = detail;

  if (debriefChallengeBannerEl) {
    if (session._challenge) {
      const chRes = evaluateChallengeResult(session._challenge, {
        success,
        score: teamSummary.teamScore,
      });
      debriefChallengeBannerEl.hidden = false;
      debriefChallengeBannerEl.className = `debrief-challenge-banner ${chRes.won ? 'won' : 'lost'}`;
      debriefChallengeBannerEl.textContent = chRes.headline;
    } else {
      debriefChallengeBannerEl.hidden = true;
    }
  }
  const runChallengeCfg = {
    siteId: level.id,
    difficulty: runDiff,
    mutatorId: session.mutatorId || '',
    customGas: customGasPlan.enabled,
    o2Pct: customGasPlan.o2Pct,
    hePct: customGasPlan.hePct,
    drillsEnabled: Boolean(session.drills?.enabled),
    challengerName: diver.name || playerNameInput?.value.trim() || '',
    targetScore: success ? teamSummary.teamScore : 0,
  };
  lastDebriefChallengeUrl = buildChallengeUrl(`${location.origin}${location.pathname}`, runChallengeCfg);
  lastDebriefChallengeText = formatChallengeSummary(runChallengeCfg, {
    levelName: level.name,
    mutator: session.mutatorId ? getDailyMutatorById(session.mutatorId) : null,
  }).shareText;

  const scoreLblEl = document.getElementById('debrief-score-label');
  const totalScoreEl = document.getElementById('debrief-total-score');
  const bestEl = document.getElementById('debrief-best');
  const gradeEl = document.getElementById('debrief-grade');
  scoreLblEl.textContent = teamSummary.isTeam ? 'TEAM EXPEDITION SCORE' : 'EXPEDITION SCORE';

  // Track best score & PB ghost cleanly per level in localStorage
  const bestKey = `caveDiverBest_${level.id}`;
  let prevBest = 0;
  try {
    prevBest = Number(localStorage.getItem(bestKey) || 0);
    const prevLogRec = loadCareerLogbook().cleared?.[level.id] || null;
    const hadGhost = Boolean(loadGhostTrack(level.id));
    const isFasterClear =
      success &&
      diveState.diveTimeSec > 0 &&
      (!prevLogRec?.bestTimeSec || diveState.diveTimeSec < prevLogRec.bestTimeSec);
    if (success && teamSummary.teamScore > prevBest) {
      localStorage.setItem(bestKey, String(teamSummary.teamScore));
    }
    if (success && session?.ghostTrack?.length >= 2 && (teamSummary.teamScore >= prevBest || isFasterClear || !hadGhost)) {
      const finTrack = session.ghostTrack.slice(0, 1199);
      finTrack.push([
        Math.round((session.simTimeSec || diveState.diveTimeSec || 0) * 10),
        Math.round(diver.x * 10),
        Math.round(diver.y * 10),
        Math.round((diver.angle || 0) * 10),
      ]);
      saveGhostTrack(level.id, finTrack);
    }
  } catch {
    // ignore storage restriction
  }
  toggleShearwaterComputer(false);
  toggleSignalWheel(false);
  // Append final profile point and render the Dive Computer Depth Profile Graph + Earned Certifications
  if (session?.diveProfile) {
    session.diveProfile.push({
      t: Number((diveState.diveTimeSec || session.simTimeSec || 0).toFixed(1)),
      d: Number(Math.max(0, diver.y).toFixed(1)),
      gas: diveState.activeGasId,
      deco: diveState.stopDepthM || 0,
      ppo2: Number((diveState.ppo2 || 0).toFixed(2)),
      cns: Math.round(diveState.cnsPercent || 0),
      hr: Math.round(diveState.heartRateBpm || 68),
      bar: Math.round(diveState.tanks?.[diveState.activeGasId]?.bar || 0),
      gf99: 0,
    });
  }
  renderDebriefDepthProfile(session?.diveProfile, diveState.maxDepthM, success, session?.peerProfiles);

  const replayTrack = Array.isArray(session?.ghostTrack) ? session.ghostTrack.slice(0, 1199) : [];
  if (replayTrack.length > 0) {
    replayTrack.push([
      Math.round((session.simTimeSec || diveState.diveTimeSec || 0) * 10),
      Math.round(diver.x * 10),
      Math.round(diver.y * 10),
      Math.round((diver.angle || 0) * 10),
    ]);
  }
  if (debriefReplayWrapEl) {
    const hasReplay = replayTrack.length >= 2;
    debriefReplayWrapEl.hidden = !hasReplay;
    if (hasReplay) {
      debriefReplay.load({
        level,
        track: replayTrack,
        profile: session?.diveProfile || null,
        autoPlay: true,
      });
    } else {
      debriefReplay.stop();
    }
  }
  lastDebriefCardData = {
    level,
    diverName: diver.name || playerNameInput?.value.trim() || 'Diver',
    success,
    grade: teamSummary.teamRank.grade,
    score: teamSummary.teamScore,
    maxDepthM: diveState.maxDepthM,
    diveTimeSec: diveState.diveTimeSec,
    exploredPct: teamSummary.exploredPct,
    difficulty: runDiff,
    customMixLabel: customGasPlan.enabled ? diveState.mixes?.TMX1455?.name || '' : '',
    dailyBadge: session._dailyBadgeLabel || '',
    track: replayTrack,
    profile: session?.diveProfile ? session.diveProfile.slice() : [],
  };

  let updatedLogbook = recordDiveInLogbook(loadCareerLogbook(), {
    levelId: level.id,
    success,
    score: teamSummary.teamScore,
    grade: teamSummary.teamRank.grade,
    maxDepthM: diveState.maxDepthM,
    diveTimeSec: diveState.diveTimeSec,
    difficulty: runDiff,
  });
  if (success && session.dailyDateKey) {
    updatedLogbook = recordDailyClear(updatedLogbook, {
      dateKey: session.dailyDateKey,
      levelId: level.id,
      mutatorId: session.mutatorId || '',
      score: teamSummary.teamScore,
      grade: teamSummary.teamRank.grade,
      timeSec: diveState.diveTimeSec,
    });
  }
  saveCareerLogbook(updatedLogbook);
  renderTechGearDock();
  renderDailyChallengeCard();
  renderCareerSummary();
  renderDebriefCertifications(updatedLogbook);
  if (debriefDailyBadgeEl) {
    if (session.dailyDateKey) {
      const dStatus = getDailyStatus(updatedLogbook, session.dailyDateKey);
      const dMut = getDailyMutatorById(session.mutatorId);
      debriefDailyBadgeEl.hidden = false;
      debriefDailyBadgeEl.className = `debrief-daily-badge${success ? ' cleared' : ''}`;
      debriefDailyBadgeEl.textContent = success
        ? `📅 DAILY CLEARED · 🔥 ${dStatus.activeStreak}d STREAK`
        : `📅 DAILY · ${dMut ? `${dMut.icon} ${dMut.shortName}` : 'EXPEDITION'}`;
    } else {
      debriefDailyBadgeEl.hidden = true;
    }
  }
  bestEl.textContent =
    success && teamSummary.teamScore > prevBest
      ? 'NEW PERSONAL BEST!'
      : prevBest > 0
        ? `Best: ${prevBest.toLocaleString()}`
        : teamSummary.teamRank.label;

  gradeEl.textContent = teamSummary.teamRank.grade;
  gradeEl.className = `debrief-grade-seal ${success ? '' : 'dnf'}`;

  // Staggered animated score category bars
  const rows = [
    {
      label: `Health (${teamSummary.avgHealthPct}%)`,
      pts: teamSummary.avgHealthScore,
      pct: Math.round((teamSummary.avgHealthScore / 1000) * 100),
      cls: 'green',
    },
    {
      label: `Speed (${formatRunClock(teamSummary.avgTimeSec)})`,
      pts: teamSummary.avgSpeedScore,
      pct: Math.round((teamSummary.avgSpeedScore / 800) * 100),
      cls: '',
    },
    {
      label: `Collectables (${teamSummary.collectiblesFound}/${teamSummary.collectiblesTotal})`,
      pts: teamSummary.collectiblesScore,
      pct: Math.round(
        (teamSummary.collectiblesFound / Math.max(1, teamSummary.collectiblesTotal)) * 100
      ),
      cls: 'gold',
    },
    {
      label: `Explored (${teamSummary.exploredPct}%)`,
      pts: teamSummary.explorationScore + teamSummary.cartographerBonus,
      pct: teamSummary.exploredPct,
      cls: 'purple',
    },
  ];
  if ((teamSummary.photoBonusScore || 0) > 0) {
    const snapCount = session.camera?.photographedIds?.size || 1;
    rows.push({
      label: `Field Photos (${snapCount} species)`,
      pts: teamSummary.photoBonusScore,
      pct: Math.round((teamSummary.photoBonusScore / 300) * 100),
      cls: 'gold',
    });
  }
  if ((teamSummary.encounterBonusScore || 0) > 0) {
    rows.push({
      label: '📡 Survey Beacon Salvaged',
      pts: teamSummary.encounterBonusScore,
      pct: 100,
      cls: 'green',
    });
  }
  if ((teamSummary.drillBonusScore || 0) > 0) {
    const drillCnt = session.drills?.completedCount || Math.max(1, Math.round(teamSummary.drillBonusScore / 200));
    rows.push({
      label: `⚡ Emergency Drills (${drillCnt} mastered)`,
      pts: teamSummary.drillBonusScore,
      pct: Math.round((teamSummary.drillBonusScore / 600) * 100),
      cls: 'gold',
    });
  }
  if (teamSummary.isTeam) {
    if (teamSummary.rescueBonus > 0) {
      rows.push({
        label: `Buddy Rescue (${teamSummary.rescuedCount})`,
        pts: teamSummary.rescueBonus,
        pct: 100,
        cls: 'gold',
      });
    }
    rows.push({
      label: `Team Extraction (${teamSummary.extractedCount}/${teamSummary.teamSize})`,
      pts: teamSummary.teamSurvivalBonus,
      pct: teamSummary.allSurvived ? 100 : 0,
      cls: 'green',
    });
  }

  const breakdownEl = document.getElementById('debrief-breakdown');
  breakdownEl.innerHTML = rows
    .map(
      (r, idx) => `
        <div class="score-bar-row">
          <span class="score-bar-lbl">${r.label}</span>
          <div class="score-bar-track"><div class="score-bar-fill ${r.cls}" data-target-w="${Math.max(0, Math.min(100, r.pct))}%" style="transition-delay:${idx * 90}ms"></div></div>
          <span class="score-bar-pts">+${r.pts}</span>
        </div>
      `
    )
    .join('');

  // Team Stats, Averages & Roster Comparison
  const teamEl = document.getElementById('debrief-team');
  teamEl.hidden = false;
  teamEl.innerHTML = `
    <div class="debrief-section-title">${teamSummary.isTeam ? 'TEAM STATS & AVERAGES' : 'DIVER PERFORMANCE SUMMARY'}</div>
    <div class="team-avg-grid">
      <div class="team-avg-cell"><span>Avg Health</span><strong>${teamSummary.avgHealthPct}%</strong></div>
      <div class="team-avg-cell"><span>Avg Speed</span><strong>${teamSummary.avgSpeedPct}%</strong></div>
      <div class="team-avg-cell"><span>Avg Time</span><strong>${formatRunClock(teamSummary.avgTimeSec)}</strong></div>
      <div class="team-avg-cell"><span>Avg Gas Left</span><strong>${teamSummary.avgGasRemainingPct}%</strong></div>
    </div>
    ${
      teamSummary.isTeam
        ? teamSummary.roster
            .map(
              (r) => `
          <div class="team-roster-row">
            <strong>${escapeHtml(r.name)}</strong>
            <span>${r.alive ? `${r.healthPct}% HP · ${formatRunClock(r.diveTimeSec)} · ${r.gasRemainingPct}% Gas` : r.rescued ? '🛟 RESCUED' : 'DOWN'}</span>
            <strong>${r.totalScore.toLocaleString()} pts</strong>
          </div>
        `
            )
            .join('')
        : ''
    }
  `;

  // Collectibles Trophy Shelf
  const artifactsEl = document.getElementById('debrief-artifacts');
  const levelCollectibles = level.collectibles || [];
  artifactsEl.innerHTML = levelCollectibles
    .map((item, idx) => {
      const found = session.collectedIds?.has(item.id);
      const icon = item.kind === 'relic' ? '🏺' : item.kind === 'crystal' ? '💎' : item.kind === 'fossil' ? '🐚' : '🧭';
      const star = (item.scale || 1) >= 1.35 ? '★ ' : '';
      return `<span class="artifact-chip ${found ? 'found' : ''}" style="animation-delay:${idx * 55}ms">${star}${icon} ${item.name}${found ? ` +${item.points}` : ''}</span>`;
    })
    .join('');

  document.getElementById('debrief-stats').innerHTML = `
    <div><span>Max Depth</span><strong>${diveState.maxDepthM.toFixed(1)} m</strong></div>
    <div><span>Dive Time</span><strong>${formatRunClock(diveState.diveTimeSec)}</strong></div>
    <div><span>Explored</span><strong>${localSummary.exploredPct}%</strong></div>
    <div><span>Checkpoints</span><strong>${checkpointsHit.size} / ${level.checkpoints.length}</strong></div>
    <div><span>Peak HR</span><strong>${Math.round(diveState.maxHeartRateBpm || diveState.heartRateBpm || 68)} BPM</strong></div>
    <div><span>EAN32 Left</span><strong>${Math.round(diveState.tanks.EAN32.bar)} bar</strong></div>
    <div><span>TMX / O2 Left</span><strong>${Math.round(diveState.tanks.TMX1455.bar)} / ${Math.round(diveState.tanks.O2.bar)}b</strong></div>
  `;

  // Trigger smooth animated odometer count-up & meter fills
  totalScoreEl.textContent = '0';
  requestAnimationFrame(() => {
    for (const fill of breakdownEl.querySelectorAll('.score-bar-fill')) {
      fill.style.width = fill.dataset.targetW || '0%';
    }
  });

  const targetScore = teamSummary.teamScore;
  const animStart = performance.now();
  const duration = 1250;
  const stepOdometer = (now) => {
    const t = Math.min(1, (now - animStart) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    totalScoreEl.textContent = Math.round(targetScore * eased).toLocaleString();
    if (t < 1) {
      debriefAnimFrame = requestAnimationFrame(stepOdometer);
    } else {
      gradeEl.classList.add('revealed');
      debriefAnimFrame = 0;
    }
  };
  debriefAnimFrame = requestAnimationFrame(stepOdometer);

  if (debriefLeaderboardEl) {
    debriefLeaderboardEl.hidden = true;
    debriefLeaderboardEl.innerHTML = '';
  }
  if (success) {
    const subMode = teamSummary.isTeam ? 'team' : 'solo';
    const subRunId =
      teamSummary.isTeam && lan.room?.code
        ? `${lan.room.code}-d${activeDiveSeq || 1}-${level.id}`
        : undefined;
    const shouldSubmitToServer = !teamSummary.isTeam || !lan.room || lan.isHost();
    const verifiedGh = github.authenticated && github.user ? github.user : null;
    const baseStatsPayload = {
      difficulty: runDiff,
      maxDepthM: diveState.maxDepthM,
      avgHealthPct: teamSummary.avgHealthPct,
      avgSpeedPct: teamSummary.avgSpeedPct,
      avgGasRemainingPct: teamSummary.avgGasRemainingPct,
      peakHeartRateBpm: Math.round(diveState.maxHeartRateBpm || diveState.heartRateBpm || 68),
      checkpointsHit: checkpointsHit.size,
      totalCheckpoints: (level.checkpoints || []).length,
      healthScore: teamSummary.avgHealthScore,
      speedScore: teamSummary.avgSpeedScore,
      collectiblesScore: teamSummary.collectiblesScore,
      explorationScore: teamSummary.explorationScore + teamSummary.cartographerBonus,
      rescueBonus: teamSummary.rescueBonus || 0,
      teamSurvivalBonus: teamSummary.teamSurvivalBonus || 0,
      eanBar: Math.round(diveState.tanks.EAN32.bar),
      tmxBar: Math.round(diveState.tanks.TMX1455.bar),
      o2Bar: Math.round(diveState.tanks.O2.bar),
    };
    const lbPromise = shouldSubmitToServer
      ? leaderboard.submitRun({
          mode: subMode,
          levelId: level.id,
          runId: subRunId,
          diverName: playerNameInput?.value.trim() || 'Diver 1',
          verifiedGitHubUser: verifiedGh,
          crew: teamSummary.roster.map((r) => ({
            name: r.name,
            score: r.totalScore,
            alive: r.alive,
            healthPct: r.healthPct,
            gasRemainingPct: r.gasRemainingPct,
            diveTimeSec: r.diveTimeSec,
            rescued: Boolean(r.rescued),
          })),
          teamSize: teamSummary.teamSize,
          score: teamSummary.teamScore,
          grade: teamSummary.teamRank.grade,
          timeSec: teamSummary.avgTimeSec,
          exploredPct: teamSummary.exploredPct,
          collectiblesFound: teamSummary.collectiblesFound,
          difficulty: runDiff,
          stats: baseStatsPayload,
        })
      : leaderboard.fetchBoard({ mode: subMode, levelId: level.id, limit: 10 }).then((b) => ({
          ok: true,
          source: b.source,
          entries: b.entries || [],
        }));

    // Also submit Daily Expedition Challenge clears to the dedicated Daily Leaderboard!
    if (session.dailyDateKey) {
      leaderboard
        .submitRun({
          mode: 'daily',
          levelId: level.id,
          dailyDateKey: session.dailyDateKey,
          mutatorId: session.mutatorId || '',
          diverName: playerNameInput?.value.trim() || 'Diver 1',
          verifiedGitHubUser: verifiedGh,
          teamSize: 1,
          score: localSummary.totalScore,
          grade: localSummary.rank?.grade || teamSummary.teamRank.grade,
          timeSec: diveState.diveTimeSec,
          exploredPct: localSummary.exploredPct,
          collectiblesFound: localSummary.collectiblesFound,
          difficulty: runDiff,
          stats: baseStatsPayload,
        })
        .catch(() => {});
    }

    lbPromise
      .then((res) => {
        if (!debriefLeaderboardEl || mode !== 'debrief') return;
        if (!res?.ok) {
          console.warn('Leaderboard submit failed:', res?.error);
          return;
        }
        const boardLabel = subMode === 'team' ? 'TEAM LEADERBOARD' : 'INDIVIDUAL LEADERBOARD';
        const srcTag = res.source === 'global' ? 'Global' : res.pendingSync ? 'Saved Offline · Auto-Sync' : 'Local PB';
        const rankText = res.rank ? `${srcTag} Rank #${res.rank} of ${res.total || res.rank}` : srcTag;
        lastDebriefLbEntries = (res.entries || []).slice(0, 5);
        debriefLeaderboardEl.hidden = false;
        debriefLeaderboardEl.innerHTML = `
          <div class="debrief-lb-head">
            <span class="debrief-section-title" style="margin:0">${boardLabel} · ${escapeHtml(level.name)}</span>
            <span class="debrief-lb-rank">${escapeHtml(rankText)}</span>
          </div>
          ${renderLeaderboardRowsHtml(lastDebriefLbEntries, { highlightKey: res.entry?.entryKey })}
        `;
        if (leaderboardPanel && !leaderboardPanel.hidden) {
          refreshMenuLeaderboard();
        }
      })
      .catch((err) => {
        console.warn('Leaderboard submit error:', err);
      });
  }
}

function escapeHtml(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let lastMenuLbEntries = [];
let lastDebriefLbEntries = [];

function formatLbDate(ts) {
  if (!Number.isFinite(Number(ts)) || Number(ts) <= 0) return 'Recorded Dive';
  try {
    return new Date(Number(ts)).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recorded Dive';
  }
}

let lbStatsCloseTimer = 0;
function closeLeaderboardStatsModal() {
  if (!lbStatsModalEl || lbStatsModalEl.hidden) return;
  clearTimeout(lbStatsCloseTimer);
  lbStatsModalEl.classList.add('is-closing');
  lbStatsCloseTimer = setTimeout(() => {
    lbStatsCloseTimer = 0;
    lbStatsModalEl.classList.remove('is-closing');
    lbStatsModalEl.hidden = true;
  }, 190);
}

function openLeaderboardStatsModal(entry, rankNum = 1) {
  if (!entry || !lbStatsModalEl || !lbStatsBodyEl) return;
  clearTimeout(lbStatsCloseTimer);
  lbStatsCloseTimer = 0;
  lbStatsModalEl.classList.remove('is-closing');
  const isOverall = entry.levelId === 'overall';
  const isDaily = entry.mode === 'daily';
  const lvl = !isOverall ? getLevelById(entry.levelId) : null;
  const lvlIdx = lvl ? LEVELS.findIndex((l) => l.id === lvl.id) + 1 : 0;
  const meta = lvl ? getLevelMeta(lvl, Math.max(0, lvlIdx - 1)) : null;
  const modeLabel = entry.mode === 'team' ? 'CO-OP TEAM' : isDaily ? 'DAILY EXPEDITION' : 'SOLO DIVER';
  const dailyMut = entry.mutatorId ? getDailyMutatorById(entry.mutatorId) : null;
  const siteTitle = isOverall
    ? isDaily
      ? `All-Time Daily Champions (${entry.sitesCompleted || 0} Daily Clears)`
      : `Overall Campaign (${entry.sitesCompleted || 0}/${entry.totalSites || LEVELS.length} Sites)`
    : isDaily && entry.dailyDateKey
      ? `Daily ${entry.dailyDateKey} · L${lvlIdx}: ${lvl?.name || entry.levelId}`
      : `L${lvlIdx}: ${lvl?.name || entry.levelId}`;

  if (lbStatsKickerEl) {
    lbStatsKickerEl.textContent = `${modeLabel} · RANK #${rankNum}`;
  }
  if (lbStatsTitleEl) {
    lbStatsTitleEl.textContent = entry.displayName || 'Diver';
  }
  if (lbStatsSubEl) {
    const regionPart = meta?.region ? ` · ${meta.region}` : '';
    const mutPart = dailyMut ? ` · ${dailyMut.icon} ${dailyMut.shortName}` : '';
    lbStatsSubEl.textContent = `${siteTitle}${regionPart}${mutPart} · ${formatLbDate(entry.createdAt)}`;
  }

  const st = entry.stats || null;
  const entryDiff = entry.difficulty || st?.difficulty || '';
  const entryDiffMeta = getDifficultyMeta(entryDiff);
  const collectMax = entry.collectiblesTotal ?? (lvl?.collectibles?.length || 0);
  const cells = [
    ['Dive Time', formatRunClock(entry.timeSec || 0)],
    ['Cave Explored', `${entry.exploredPct ?? 0}%`],
    ['Collectables', `${entry.collectiblesFound ?? 0} / ${collectMax}`],
    [
      isOverall ? 'Sites Cleared' : 'Max Depth',
      isOverall
        ? `${entry.sitesCompleted || 0} / ${entry.totalSites || LEVELS.length}`
        : `${(st?.maxDepthM ?? meta?.maxDepthM ?? getLevelMaxDepthM(lvl)).toFixed?.(1) ?? (st?.maxDepthM ?? meta?.maxDepthM)} m`,
    ],
  ];
  if (entryDiffMeta) cells.unshift(['Dive Mode', entryDiffMeta.fullBadge]);
  if (st?.avgHealthPct !== undefined) cells.push(['Avg Health', `${st.avgHealthPct}%`]);
  if (st?.avgSpeedPct !== undefined) cells.push(['Speed Rating', `${st.avgSpeedPct}%`]);
  if (st?.avgGasRemainingPct !== undefined) cells.push(['Gas Reserve', `${st.avgGasRemainingPct}%`]);
  if (st?.peakHeartRateBpm !== undefined) cells.push(['Peak Heart Rate', `${st.peakHeartRateBpm} BPM`]);
  if (st?.checkpointsHit !== undefined) {
    cells.push(['Checkpoints', `${st.checkpointsHit} / ${st.totalCheckpoints ?? (lvl?.checkpoints?.length || 0)}`]);
  }
  if (st?.eanBar !== undefined || st?.tmxBar !== undefined) {
    cells.push(['Tanks Left', `${st.eanBar ?? '-'} / ${st.tmxBar ?? '-'} / ${st.o2Bar ?? '-'}b`]);
  }

  let breakdownHtml = '';
  if (st && (st.healthScore !== undefined || st.speedScore !== undefined)) {
    const barRows = [
      { label: 'Survival & Health', pts: st.healthScore || 0, pct: Math.round(((st.healthScore || 0) / 1000) * 100), cls: 'green' },
      { label: `Speed (${formatRunClock(entry.timeSec || 0)})`, pts: st.speedScore || 0, pct: Math.round(((st.speedScore || 0) / 800) * 100), cls: '' },
      { label: `Collectables (${entry.collectiblesFound ?? 0}/${collectMax})`, pts: st.collectiblesScore || 0, pct: Math.round(((entry.collectiblesFound ?? 0) / Math.max(1, collectMax)) * 100), cls: 'gold' },
      { label: `Exploration (${entry.exploredPct ?? 0}%)`, pts: st.explorationScore || 0, pct: entry.exploredPct ?? 0, cls: 'purple' },
    ];
    if (st.rescueBonus > 0) {
      barRows.push({ label: 'Buddy Rescue', pts: st.rescueBonus, pct: 100, cls: 'gold' });
    }
    if (entry.mode === 'team' && st.teamSurvivalBonus !== undefined) {
      barRows.push({ label: 'Team Extraction', pts: st.teamSurvivalBonus, pct: st.teamSurvivalBonus > 0 ? 100 : 0, cls: 'green' });
    }
    breakdownHtml = `
      <div class="lb-stats-section">
        <div class="lb-stats-section-title">Score Breakdown</div>
        ${barRows
          .map(
            (r, idx) => `
          <div class="score-bar-row">
            <span class="score-bar-lbl">${escapeHtml(r.label)}</span>
            <div class="score-bar-track"><div class="score-bar-fill ${r.cls}" data-target-w="${Math.max(0, Math.min(100, r.pct))}%" style="width:0%;transition-delay:${idx * 70}ms"></div></div>
            <span class="score-bar-pts">+${r.pts}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  let crewHtml = '';
  if (Array.isArray(entry.crew) && entry.crew.length > 0 && (entry.teamSize > 1 || entry.crew[0]?.healthPct !== undefined)) {
    crewHtml = `
      <div class="lb-stats-section">
        <div class="lb-stats-section-title">${entry.teamSize > 1 ? `Dive Crew (${entry.teamSize} Divers)` : 'Diver Telemetry'}</div>
        ${entry.crew
          .map((m) => {
            const parts = [];
            if (m.healthPct !== undefined) parts.push(`${m.healthPct}% HP`);
            if (m.diveTimeSec !== undefined) parts.push(formatRunClock(m.diveTimeSec));
            if (m.gasRemainingPct !== undefined) parts.push(`${m.gasRemainingPct}% Gas`);
            const detail = m.alive === false ? (m.rescued ? '🛟 RESCUED' : 'DOWN') : parts.join(' · ') || 'Surfaced';
            return `
              <div class="team-roster-row">
                <strong>${escapeHtml(m.name)}</strong>
                <span>${escapeHtml(detail)}</span>
                <strong>${Number(m.score || 0).toLocaleString()} pts</strong>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  let siteRunsHtml = '';
  if (isOverall && Array.isArray(entry.siteRuns) && entry.siteRuns.length > 0) {
    siteRunsHtml = `
      <div class="lb-stats-section">
        <div class="lb-stats-section-title">Cleared Expedition Sites (${entry.siteRuns.length})</div>
        <div class="lb-stats-sitelist">
          ${entry.siteRuns
            .map((sr) => {
              const idx = LEVELS.findIndex((l) => l.id === sr.levelId) + 1;
              const name = getLevelById(sr.levelId)?.name || sr.levelId;
              const srModeBadge = renderModeBadgeHtml(sr.difficulty || sr.stats?.difficulty, { compact: true });
              return `
                <div class="lb-stats-siterow">
                  <span class="lb-name">L${Math.max(1, idx)}: ${escapeHtml(name)}</span>
                  <span class="lb-meta">${srModeBadge} ${formatRunClock(sr.timeSec)} · ${sr.exploredPct}%</span>
                  <span class="lb-grade">${escapeHtml(sr.grade)}</span>
                  <span class="lb-score">${Number(sr.score || 0).toLocaleString()}</span>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  const legacyNote = !st && !isOverall ? '<div class="lb-stats-note">Detailed physiology & score breakdown is recorded on new dives completed in v81+.</div>' : '';

  const ghProfileBanner =
    entry.githubVerified && entry.githubLogin
      ? `
        <div class="lb-profile-banner">
          <div class="lb-profile-left">
            ${entry.githubAvatar ? `<img class="lb-profile-avatar" src="${escapeHtml(entry.githubAvatar)}" alt="" />` : ''}
            <div class="lb-profile-copy">
              <strong>✓ @${escapeHtml(entry.githubLogin)} · GitHub Verified Diver</strong>
              <span>Authenticated expedition record synced via GitHub</span>
            </div>
          </div>
          <a class="btn tiny secondary" href="https://github.com/${encodeURIComponent(entry.githubLogin)}" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
        </div>
      `
      : '';

  lbStatsBodyEl.innerHTML = `
    ${ghProfileBanner}
    <div class="lb-stats-hero">
      <div>
        <div class="lb-stats-score-lbl">Total Score</div>
        <div class="lb-stats-score-val">${Number(entry.score || 0).toLocaleString()}</div>
      </div>
      <div class="lb-stats-grade-pill">${escapeHtml(entry.grade || 'B')}</div>
    </div>
    <div class="lb-stats-grid">
      ${cells.map(([k, v]) => `<div class="lb-stats-cell"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('')}
    </div>
    ${breakdownHtml}
    ${crewHtml}
    ${siteRunsHtml}
    ${legacyNote}
  `;

  lbStatsModalEl.hidden = false;
  requestAnimationFrame(() => {
    for (const fill of lbStatsBodyEl.querySelectorAll('.score-bar-fill[data-target-w]')) {
      fill.style.width = fill.dataset.targetW || '0%';
    }
  });
}

function renderLeaderboardRowsHtml(entries, { highlightKey = '' } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '<div class="lb-empty">No completed expeditions recorded here yet. Finish a dive to claim #1!</div>';
  }
  const myGhLogin = github.authenticated && github.user?.login ? github.user.login.toLowerCase() : '';
  return entries
    .map((e, i) => {
      const isMe =
        (highlightKey && e.entryKey === highlightKey) ||
        (e.playerId && e.playerId === leaderboard.playerId) ||
        (myGhLogin && e.githubVerified && String(e.githubLogin || '').toLowerCase() === myGhLogin);
      const teamTag = e.teamSize > 1 ? ` · ${e.teamSize}P` : '';
      const rowModeBadge = renderModeBadgeHtml(e.difficulty || e.stats?.difficulty, { compact: true });
      const ghAvatarHtml =
        e.githubVerified && e.githubAvatar
          ? `<img class="lb-gh-avatar" src="${escapeHtml(e.githubAvatar)}" alt="" />`
          : '';
      const ghBadgeHtml =
        e.githubVerified && e.githubLogin
          ? `<span class="lb-gh-badge" title="GitHub Verified Diver">✓ @${escapeHtml(e.githubLogin)}</span>`
          : '';
      const mutMeta = e.mode === 'daily' && e.mutatorId ? getDailyMutatorById(e.mutatorId) : null;
      const mutPillHtml = mutMeta
        ? `<span class="lb-mutator-pill">${mutMeta.icon} ${escapeHtml(mutMeta.shortName)}</span>`
        : '';
      return `
        <button type="button" class="lb-row ${isMe ? 'me' : ''}" style="--row-i:${i}" data-lb-idx="${i}" title="View diver profile &amp; full dive stats">
          <span class="lb-rank">#${i + 1}</span>
          <span class="lb-name"><span class="lb-name-wrap">${ghAvatarHtml}<span>${escapeHtml(e.displayName)}</span><small class="lb-meta">${teamTag}</small>${ghBadgeHtml}${mutPillHtml}${rowModeBadge}</span></span>
          <span class="lb-meta">${formatRunClock(e.timeSec)} · ${e.exploredPct}%</span>
          <span class="lb-grade">${escapeHtml(e.grade)}</span>
          <span class="lb-score">${Number(e.score || 0).toLocaleString()}</span>
          <span class="lb-chevron" aria-hidden="true">›</span>
        </button>
      `;
    })
    .join('');
}

const CAREER_LOGBOOK_KEY = 'caveDiverLogbook_v1';
let _cachedLogbook = null;

function invalidateCareerLogbookCache() {
  _cachedLogbook = null;
}
window.addEventListener('storage', (e) => {
  if (!e?.key || e.key === CAREER_LOGBOOK_KEY) invalidateCareerLogbookCache();
});

function loadCareerLogbook() {
  if (_cachedLogbook) return _cachedLogbook;
  try {
    let book = createEmptyLogbook();
    const raw = localStorage.getItem(CAREER_LOGBOOK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') book = parsed;
    }
    _cachedLogbook = seedLogbookFromEntries(book, leaderboard._loadLocalCache());
    return _cachedLogbook;
  } catch {
    return createEmptyLogbook();
  }
}

function saveCareerLogbook(book, { skipCloudSync = false } = {}) {
  _cachedLogbook = book || null;
  try {
    localStorage.setItem(CAREER_LOGBOOK_KEY, JSON.stringify(book));
  } catch {}
  if (!skipCloudSync) {
    scheduleGitHubStatsSync();
  }
}

/**
 * Single source of truth for outgoing co-op diver telemetry snapshots.
 */
function buildPlayerStatePayload(sess, overrides = {}) {
  const { diver, diveState } = sess;
  const activeTank = diveState.tanks?.[diveState.activeGasId];
  const defaultCondition = (() => {
    const pc = diveState.impairment?.primaryCondition;
    if (pc === 'NO GAS' || pc === 'HYPOXIA' || pc === 'O2 TOX') return pc;
    if (sess.activeSnagIndex >= 0) return 'SNAGGED!';
    if (pc && pc !== 'NOMINAL') return pc;
    if (diveState.stopDepthM > 0 && Math.abs(diver.y - diveState.stopDepthM) <= 3.5) {
      return `DECO ${diveState.stopDepthM}m`;
    }
    return 'NOMINAL';
  })();

  return {
    x: diver.x,
    y: diver.y,
    vx: diver.vx,
    vy: diver.vy,
    angle: diver.angle,
    gasId: diveState.activeGasId,
    activeBar: activeTank ? activeTank.bar : 0,
    cnsPercent: diveState.cnsPercent,
    dcsStress: diveState.dcsStress,
    hypoxiaStress: diveState.hypoxiaStress,
    narcosisLevel: diveState.narcosisLevel,
    heartRateBpm: diveState.heartRateBpm,
    cardiacStress: diveState.cardiacStress,
    ceilingM: diveState.ceilingM,
    condition: defaultCondition,
    surfaced: Boolean(sess.surfaced),
    healthPct: computeHealthPct(diveState),
    gasRemainingPct: computeGasRemainingPct(diveState),
    diveTimeSec: diveState.diveTimeSec,
    collectiblesFound: sess.collectedIds?.size || 0,
    exploredPct: sess.exploredPct || 0,
    depthM: diveState.depthM,
    torchOn: diver.torchOn,
    torchAngle: Number((Number.isFinite(diver.torchAngle) ? diver.torchAngle : diver.angle).toFixed(3)),
    torchManualAim: Boolean(diver.torchManualAim),
    hasCcr: Boolean(diver.hasCcr),
    hasDpv: Boolean(diver.hasDpv),
    dpvActive: Boolean(diver.dpvActive),
    dpvThrusting: Boolean(diver.dpvThrusting),
    alive: diveState.alive,
    carryingBody: Boolean(sess.carryingBody),
    rescueTargetId: sess.rescueTargetId || '',
    rescuedBy: sess.rescuedBy || '',
    rescued: Boolean(sess.rescued),
    name: diver.name,
    ...overrides,
  };
}

function renderCareerSummary() {
  if (!lbCareerSummaryEl) return;
  const book = loadCareerLogbook();
  const s = formatLogbookSummary(book, LEVELS.length);
  const certInfo = computeCertifications(book, LEVELS);
  const certLabel = certInfo.highest ? `${certInfo.highest.icon} ${certInfo.highest.title}` : s.campaignMedal;
  lbCareerSummaryEl.hidden = false;
  lbCareerSummaryEl.innerHTML = `
    <div class="lb-career-cell"><span>Sites</span><strong>${s.clearedCount}/${s.totalSites}</strong></div>
    <div class="lb-career-cell"><span>Dives</span><strong>${s.totalDives}</strong></div>
    <div class="lb-career-cell"><span>Deepest</span><strong>${s.deepestM.toFixed(0)}m</strong></div>
    <div class="lb-career-cell"><span>Cert</span><strong>${escapeHtml(certLabel)}</strong></div>
  `;
}

function getRecentUtcDateKeys(count = 7) {
  const keys = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function populateLbSiteSelect() {
  if (!selectLbSite) return;
  if (lbMode === 'daily') {
    const recentDates = getRecentUtcDateKeys(7);
    const dateOpts = recentDates.map((dk, idx) => {
      const ch = getDailyChallenge(LEVELS, dk);
      const dayTag = idx === 0 ? 'Today' : idx === 1 ? 'Yesterday' : dk;
      return `<option value="${dk}">📅 ${dayTag} (${dk}) · ${ch.level.name} · ${ch.mutator.icon} ${ch.mutator.shortName}</option>`;
    });
    selectLbSite.innerHTML = [
      ...dateOpts,
      `<option value="overall">🏆 All-Time Daily Champions</option>`,
    ].join('');
    if (!lbFilterLevelId || (lbFilterLevelId !== 'overall' && !/^\d{4}-\d{2}-\d{2}$/.test(lbFilterLevelId))) {
      lbFilterLevelId = recentDates[0];
    }
    selectLbSite.value = lbFilterLevelId;
    return;
  }
  const opts = [
    `<option value="overall">🌐 All ${LEVELS.length} Sites (Overall)</option>`,
    ...LEVELS.map((lvl, idx) => `<option value="${lvl.id}">L${idx + 1}: ${lvl.name} (${getLevelMaxDepthM(lvl)}m)</option>`),
  ];
  selectLbSite.innerHTML = opts.join('');
  if (!lbFilterLevelId || /^\d{4}-\d{2}-\d{2}$/.test(lbFilterLevelId)) {
    lbFilterLevelId = activeLevel.id;
  }
  selectLbSite.value = lbFilterLevelId || activeLevel.id;
}

async function refreshMenuLeaderboard() {
  renderCareerSummary();
  if (!leaderboardRowsEl || !leaderboardSubEl) return;
  populateLbSiteSelect();
  const targetLevel = lbFilterLevelId || (lbMode === 'daily' ? getRecentUtcDateKeys(1)[0] : activeLevel.id);
  if (selectLbSite) selectLbSite.value = targetLevel;
  leaderboardSubEl.textContent = 'Syncing rankings...';
  const board = await leaderboard.fetchBoard({ mode: lbMode, levelId: targetLevel, limit: 20 });
  const modeLabel = lbMode === 'team' ? 'Co-op Teams' : lbMode === 'daily' ? 'Daily Expedition' : 'Individual Divers';
  let scopeLabel = '';
  if (lbMode === 'daily') {
    if (targetLevel === 'overall') {
      scopeLabel = 'All-Time Daily Champions';
    } else {
      const ch = getDailyChallenge(LEVELS, targetLevel);
      scopeLabel = `${targetLevel} · ${ch.level.name} (${ch.mutator.icon} ${ch.mutator.shortName})`;
    }
  } else {
    const lvlIdx = LEVELS.findIndex((l) => l.id === targetLevel);
    scopeLabel =
      targetLevel === 'overall'
        ? `Overall Campaign (All ${LEVELS.length} Sites)`
        : `L${Math.max(1, lvlIdx + 1)}: ${getLevelById(targetLevel).name}`;
  }
  const originNote =
    board.source === 'global'
      ? (board.pendingSync > 0 ? `Global Rankings (${board.pendingSync} pending sync)` : 'Global Rankings')
      : 'Local Device Records (auto-syncs when online)';
  leaderboardSubEl.textContent = `${modeLabel} · ${scopeLabel} · ${originNote}`;
  lastMenuLbEntries = board.entries || [];
  leaderboardRowsEl.innerHTML = renderLeaderboardRowsHtml(lastMenuLbEntries);
}

// --- Menu & LAN Lobby Wiring ---
function isLoopbackHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function getAppBasePath() {
  return location.pathname
    .replace(/\/index\.html$/, '')
    .replace(/\/join\/.*$/, '')
    .replace(/\/+$/, '');
}

function getLanJoinBaseUrl() {
  const basePath = getAppBasePath();
  if (!isLoopbackHost(location.hostname)) {
    return `${location.origin}${basePath}`;
  }
  const lanIp = cachedLanUrls.find((u) => !u.includes('127.0.0.1') && !u.includes('localhost'));
  const root = lanIp || cachedLanUrls[0] || location.origin;
  return `${root}${basePath}`;
}

function buildRoomInviteUrl(code) {
  if (!code) return '';
  const params = new URLSearchParams();
  params.set('room', code);
  const currentParams = new URLSearchParams(location.search);
  const forcedTransport = currentParams.get('transport');
  if (forcedTransport) params.set('transport', forcedTransport);
  return `${getLanJoinBaseUrl()}/?${params.toString()}`;
}

function syncBrowserRoomUrl(code) {
  try {
    const nextUrl = new URL(location.href);
    const joinMatch = nextUrl.pathname.match(/^(.*)\/join\/[A-Za-z0-9]{1,8}\/?$/);
    if (joinMatch) {
      nextUrl.pathname = `${joinMatch[1] || ''}/`;
    }
    if (code) {
      nextUrl.searchParams.set('room', code);
    } else {
      nextUrl.searchParams.delete('room');
      nextUrl.searchParams.delete('join');
    }
    if (nextUrl.toString() !== location.href) {
      history.replaceState(null, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }
  } catch {
    // ignore history restriction
  }
}

function syncRoomInviteUi(room) {
  const code = room?.code || '';
  const inviteUrl = buildRoomInviteUrl(code);
  const maxP = room?.maxPlayers || 4;
  const hasOpenSlots = Boolean(code && Array.isArray(room?.players) && room.players.length < maxP);
  const showInSoloDive = !code && mode === 'diving' && Boolean(session);
  if (lanInviteUrlInput) {
    lanInviteUrlInput.value = inviteUrl;
  }
  if (btnShareInvite) {
    btnShareInvite.hidden = !(code && typeof navigator.share === 'function');
  }
  if (btnHudInvite) {
    btnHudInvite.hidden = !(hasOpenSlots || showInSoloDive);
    if (!copyInviteFeedbackTimer) {
      btnHudInvite.textContent = code ? `🔗 ${code}` : '🔗 Invite';
    }
    if (hasOpenSlots) {
      btnHudInvite.title = `Copy drop-in link (${room.players.length}/${maxP} divers · Room ${code})`;
    } else if (showInSoloDive) {
      btnHudInvite.title = 'Open Co-op Room & copy drop-in invite link for friends';
    }
  }
  if (btnHudShare) {
    btnHudShare.hidden = !((hasOpenSlots || showInSoloDive) && typeof navigator.share === 'function');
    if (showInSoloDive) {
      btnHudShare.title = 'Open Co-op Room & share invite link';
    }
  }
  syncNotifyToggleUi();
}

function syncNotifyToggleUi() {
  if (!btnNotifyToggle) return;
  if (!('Notification' in window)) {
    btnNotifyToggle.hidden = true;
    return;
  }
  btnNotifyToggle.hidden = false;
  const perm = Notification.permission;
  if (perm === 'denied') {
    btnNotifyToggle.textContent = '🔕 Blocked';
    btnNotifyToggle.title = 'Notifications blocked in browser site settings';
  } else if (perm === 'granted') {
    btnNotifyToggle.textContent = notifyAlertsMuted ? '🔕 Muted' : '🔔 Alerts';
    btnNotifyToggle.title = notifyAlertsMuted
      ? 'Tap to unmute join notifications'
      : 'You will get a notification when a diver joins while app is in background';
  } else {
    btnNotifyToggle.textContent = '🔔 Alerts';
    btnNotifyToggle.title = 'Enable notification when a diver joins';
  }
}

async function requestDiverNotificationPermission({ userTriggered = false } = {}) {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') {
    syncNotifyToggleUi();
    return 'granted';
  }
  if (Notification.permission === 'denied') {
    syncNotifyToggleUi();
    if (userTriggered) {
      showToast('Notifications are blocked in your browser site settings.', 3.4);
    }
    return 'denied';
  }
  if (!userTriggered && notifyPromptedOnce) return Notification.permission;
  notifyPromptedOnce = true;
  try {
    const res = await Notification.requestPermission();
    syncNotifyToggleUi();
    if (userTriggered && res === 'granted') {
      showToast('Join alerts enabled — you will be notified when a buddy enters!', 3.0);
    }
    return res;
  } catch {
    return Notification.permission;
  }
}

async function showJoinOsNotification(room, joiners, siteNum, siteLevel) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || notifyAlertsMuted) return;
  if (!document.hidden && document.hasFocus()) return;
  const names = joiners.map((p) => p.name || 'Buddy Diver').join(', ');
  const maxP = room.maxPlayers || 2;
  const title = `${names} joined Room ${room.code}`;
  const options = {
    body: `L${siteNum}: ${siteLevel.name} (${room.players.length}/${maxP} divers)`,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: `cave-diver-join-${room.code}`,
    renotify: true,
    data: { url: buildRoomInviteUrl(room.code) },
  };
  try {
    if (navigator.serviceWorker?.controller) {
      const reg = await navigator.serviceWorker.ready;
      if (reg?.showNotification) {
        await reg.showNotification(title, options);
        return;
      }
    }
  } catch {
    // Fallback to foreground Notification constructor below
  }
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      try { window.focus(); } catch {}
      n.close();
    };
  } catch {
    // Some mobile browsers require ServiceWorkerRegistration.showNotification
  }
}

async function fetchLanUrls() {
  const transport = lan.getTransportMode();
  if (transport === 'p2p') {
    if (lan.room) syncRoomInviteUi(lan.room);
    return;
  }
  try {
    const res = await fetch('./api/lan-info');
    if (!res.ok) throw new Error('no lan-info');
    const info = await res.json();
    cachedLanUrls = Array.isArray(info.urls) ? info.urls : [];
    if (lan.room) syncRoomInviteUi(lan.room);
  } catch {
    cachedLanUrls = [];
  }
}

async function copyText(text, toastLabel, { selectEl = null } = {}) {
  let copied = false;
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }
  }
  if (!copied && selectEl) {
    try {
      selectEl.focus();
      selectEl.select();
      selectEl.setSelectionRange?.(0, text.length);
      copied = Boolean(document.execCommand?.('copy'));
    } catch {
      copied = false;
    }
  }
  if (!copied) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    try {
      copied = Boolean(document.execCommand?.('copy'));
    } catch {
      copied = false;
    }
    ta.remove();
  }
  if (copied) {
    showToast(toastLabel, 2.4);
  } else {
    if (selectEl) {
      selectEl.focus();
      selectEl.select();
      selectEl.setSelectionRange?.(0, text.length);
    }
    showToast(`Select & copy invite link: ${text}`, 4.0);
  }
  return copied;
}

function setLanConnectionBadge(state, text) {
  if (!lanConnBadge) return;
  lanConnBadge.className = `lan-conn-badge ${state}`;
  lanConnBadge.textContent = text;
}

function resetLobbyUiState(statusText = '') {
  lanRoomBox.hidden = true;
  knownRoomCode = '';
  knownRoomMemberIds = new Set();
  if (lanSetupControls) lanSetupControls.hidden = false;
  if (lanInviteUrlInput) lanInviteUrlInput.value = '';
  if (btnShareInvite) btnShareInvite.hidden = true;
  if (btnHudInvite) btnHudInvite.hidden = true;
  if (btnHudShare) btnHudShare.hidden = true;
  syncBrowserRoomUrl('');
  setLevelSelectionLocked(false);
  if (lanStatus) {
    lanStatus.className = 'lan-status';
    lanStatus.textContent = statusText;
    lanStatus.hidden = !statusText;
  }
  renderLevelCards();
}

function renderRoomsList(rooms = lan.rooms) {
  if (!lanRoomsSection || !lanRoomsList) return;
  if (lan.room || !Array.isArray(rooms) || rooms.length === 0) {
    lanRoomsSection.hidden = true;
    lanRoomsList.innerHTML = '';
    return;
  }
  lanRoomsSection.hidden = false;
  lanRoomsList.innerHTML = rooms
    .map((r) => {
      const lvl = getLevelById(r.levelId);
      const lvlIdx = LEVELS.findIndex((l) => l.id === lvl.id) + 1;
      const full = r.playerCount >= r.maxPlayers;
      const busy = full;
      const stateText = full
        ? 'Full'
        : r.started
          ? `In Dive · ${r.playerCount}/${r.maxPlayers} Divers`
          : `${r.playerCount}/${r.maxPlayers} Divers`;
      const safeCode = escapeHtml(r.code);
      return `
        <div class="lan-room-row">
          <div class="lan-room-row-info">
            <span><strong>${safeCode}</strong> · Host: ${escapeHtml(r.hostName)}</span>
            <span class="lan-room-row-sub">L${lvlIdx}: ${escapeHtml(lvl.name)} · ${stateText}</span>
          </div>
          <button
            type="button"
            class="btn tiny ${busy ? 'ghost' : 'primary'}"
            data-join-code="${safeCode}"
            ${busy ? 'disabled' : ''}
          >
            ${full ? 'Full' : r.started ? 'Drop In' : 'Join'}
          </button>
        </div>
      `;
    })
    .join('');
}

async function selectAndLoadLevel(chosenId, { focusMap = true } = {}) {
  if (lan.room && !lan.isHost()) {
    showToast('Host selects the expedition site in co-op.', 2.0);
    return;
  }
  loadSeq += 1;
  inFlightLoad = null;
  const nextLevel = getLevelById(chosenId);
  activeLevel = nextLevel;
  if (siteCategoryFilter !== 'all' && !getFilteredLevels().some((l) => l.id === nextLevel.id)) {
    setSiteCategoryFilter('all');
  }
  if (focusMap) {
    mapZoomMode = 'site';
  }
  if (selectLevel) selectLevel.value = nextLevel.id;
  if (lbFilterLevelId !== 'overall') {
    lbFilterLevelId = nextLevel.id;
    if (selectLbSite) selectLbSite.value = nextLevel.id;
  }
  syncMenuLevelLabels(nextLevel, { animate: true });
  if (lan.room && lan.isHost()) {
    lan.setLevel(nextLevel.id);
  }
  if (leaderboardPanel && !leaderboardPanel.hidden && lbFilterLevelId !== 'overall') {
    refreshMenuLeaderboard();
  }
  // Only restore immediately if already baked in cache; defer heavy SDF baking until player starts dive
  if (renderer.isLevelCached(nextLevel.id)) {
    await ensureLevelLoaded(nextLevel.id, { showOverlay: false });
  }
}

if (selectLevel) {
  selectLevel.addEventListener('change', (e) => selectAndLoadLevel(e.target.value));
}

if (levelCardsEl) {
  levelCardsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.level-card-btn');
    if (!btn || btn.disabled) return;
    const chosenId = btn.dataset.levelId;
    if (chosenId) selectAndLoadLevel(chosenId);
  });
}

if (siteWorldMapEl) {
  siteWorldMapEl.addEventListener('click', (e) => {
    const pin = e.target.closest('.map-pin-btn');
    if (!pin || pin.classList.contains('locked')) return;
    const chosenId = pin.dataset.levelId;
    if (chosenId) selectAndLoadLevel(chosenId);
  });
  siteWorldMapEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const pin = e.target.closest('.map-pin-btn');
    if (!pin || pin.classList.contains('locked')) return;
    e.preventDefault();
    const chosenId = pin.dataset.levelId;
    if (chosenId) selectAndLoadLevel(chosenId);
  });
}

if (btnMapZoom) {
  btnMapZoom.addEventListener('click', () => {
    mapZoomMode = mapZoomMode === 'site' ? 'global' : 'site';
    renderSiteWorldMap();
  });
}

if (siteCatTabsEl) {
  siteCatTabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-site-cat]');
    if (!btn) return;
    const nextCat =
      btn.dataset.siteCat === 'wreck' || btn.dataset.siteCat === 'cave' || btn.dataset.siteCat === 'todo'
        ? btn.dataset.siteCat
        : 'all';
    if (nextCat === siteCategoryFilter) return;
    setSiteCategoryFilter(nextCat);
    const visible = getFilteredLevels();
    if (visible.length > 0 && !visible.some((l) => l.id === activeLevel.id) && !(lan.room && !lan.isHost())) {
      selectAndLoadLevel(visible[0].id, { focusMap: mapZoomMode === 'site' });
    } else {
      renderLevelCards();
    }
    retriggerAnim(siteBrowserEl, 'anim-view-morph');
  });
}

const btnCycleSiteView = document.getElementById('btn-cycle-site-view');
const btnSetupDrawerEl = document.getElementById('btn-setup-drawer');
const diveSetupDrawerEl = document.getElementById('dive-setup-drawer');

function syncSetupDrawerSummary() {
  const btn = document.getElementById('btn-setup-drawer');
  const drawer = document.getElementById('dive-setup-drawer');
  if (!btn) return;
  let activeCount = 0;
  try {
    if (activeDifficulty !== 'standard') activeCount++;
  } catch {}
  try {
    if (customGasPlan?.enabled) activeCount++;
  } catch {}
  try {
    if (drillsEnabled) activeCount++;
  } catch {}
  try {
    if (activeSandboxMutatorId) activeCount++;
  } catch {}
  try {
    if (activeLevel?.isProcedural) activeCount++;
  } catch {}
  const isOpen = Boolean(drawer && !drawer.hidden);
  btn.textContent = activeCount > 0 ? `⚙️ Setup · ${activeCount}` : '⚙️ Setup';
  btn.classList.toggle('has-mods', activeCount > 0);
  btn.classList.toggle('open', isOpen);
  btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

btnSetupDrawerEl?.addEventListener('click', () => {
  if (!diveSetupDrawerEl) return;
  diveSetupDrawerEl.hidden = !diveSetupDrawerEl.hidden;
  syncSetupDrawerSummary();
});
syncSetupDrawerSummary();

const SITE_VIEW_ORDER = ['split', 'map', 'list'];
const SITE_VIEW_LABELS = { split: '◫ Split', map: '🗺 Map', list: '☰ List' };

function applySiteViewMode(nextMode) {
  const cleanMode = nextMode === 'map' || nextMode === 'list' ? nextMode : 'split';
  if (cleanMode === siteViewMode && siteBrowserEl?.classList.contains(`view-${cleanMode}`)) return;
  siteViewMode = cleanMode;
  const viewIdx = cleanMode === 'map' ? 1 : cleanMode === 'list' ? 2 : 0;
  if (siteViewTabsEl) {
    siteViewTabsEl.style.setProperty('--view-index', String(viewIdx));
    for (const b of siteViewTabsEl.querySelectorAll('button[data-site-view]')) {
      b.classList.toggle('active', b.dataset.siteView === cleanMode);
    }
  }
  if (btnCycleSiteView) {
    btnCycleSiteView.textContent = SITE_VIEW_LABELS[cleanMode] || '◫ Split';
  }
  if (siteBrowserEl) {
    siteBrowserEl.className = `site-browser view-${siteViewMode}`;
    retriggerAnim(siteBrowserEl, 'anim-view-morph');
  }
  if (cleanMode !== 'list') {
    renderSiteWorldMap({ instantZoom: false });
  }
}

if (siteViewTabsEl && siteBrowserEl) {
  siteViewTabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-site-view]');
    if (!btn) return;
    applySiteViewMode(btn.dataset.siteView);
  });
}
btnCycleSiteView?.addEventListener('click', () => {
  const idx = SITE_VIEW_ORDER.indexOf(siteViewMode);
  const next = SITE_VIEW_ORDER[(idx + 1) % SITE_VIEW_ORDER.length];
  applySiteViewMode(next);
});

async function launchOpenCoopDive() {
  const diverName = requireCallsign();
  if (!diverName) return false;
  activeDailyChallenge = null;
  if (lan.room) {
    lan.leaveRoom();
    resetLobbyUiState();
  }
  btnPlaySolo.disabled = true;
  if (!screenMenu.hidden) {
    screenMenu.classList.add('menu-submerging');
  }
  try {
    lan.connect();
    const roomPromise =
      typeof navigator !== 'undefined' && navigator.onLine === false
        ? Promise.resolve(null)
        : Promise.race([
            lan
              .createRoom(diverName, activeLevel.id, 4, {
                checkpoints: [],
                collectibles: [],
                bodyRecovered: false,
                playerLines: [],
              })
              .catch(() => null),
            new Promise((resolve) => setTimeout(() => resolve(null), 2200)),
          ]);
    const [, room] = await Promise.all([
      ensureLevelLoaded(activeLevel.id, { showOverlay: true }),
      roomPromise,
    ]);
    if (room?.code) {
      activeDiveSeq = room.diveSeq || 1;
      syncBrowserRoomUrl(room.code);
      startDiveRun(true);
    } else {
      startDiveRun(false);
    }
    return true;
  } finally {
    btnPlaySolo.disabled = false;
    screenMenu.classList.remove('menu-submerging');
  }
}

btnPlaySolo.addEventListener('click', () => {
  // Show a skippable 3-step technical quick briefing on a brand-new diver's very first launch
  let briefed = true;
  try {
    const book = loadCareerLogbook();
    briefed = Boolean(localStorage.getItem(BRIEFED_PREF_KEY)) || (book.totalDives || 0) > 0;
  } catch {}
  if (!briefed && modalDiveGuide) {
    openDiveGuideModal(true);
    return;
  }
  launchOpenCoopDive();
});

async function launchDailyChallenge(dailyOverride = null) {
  const diverName = requireCallsign();
  if (!diverName) return false;
  const daily = dailyOverride || getDailyGeneratedExpedition();
  if (!daily?.levelId) return false;
  if (lan.room) {
    lan.leaveRoom();
    resetLobbyUiState();
  }
  activeDailyChallenge = daily;
  if (activeLevel.id !== daily.levelId) {
    activeLevel = getLevelById(daily.levelId);
    if (selectLevel) selectLevel.value = activeLevel.id;
    syncMenuLevelLabels(activeLevel);
    renderLevelCards();
  }
  if (btnPlayDaily) btnPlayDaily.disabled = true;
  if (btnPlaySolo) btnPlaySolo.disabled = true;
  if (!screenMenu.hidden) {
    screenMenu.classList.add('menu-submerging');
  }
  try {
    await ensureLevelLoaded(daily.levelId, { showOverlay: true });
    startDiveRun(false);
    return true;
  } finally {
    if (btnPlayDaily) btnPlayDaily.disabled = false;
    if (btnPlaySolo) btnPlaySolo.disabled = false;
    screenMenu.classList.remove('menu-submerging');
  }
}

btnPlayDaily?.addEventListener('click', () => {
  launchDailyChallenge();
});

let activeMenuTab = 'solo';

function syncSitePickerVisibility() {
  if (!menuSitePicker) return;
  menuSitePicker.hidden = activeMenuTab === 'leaderboards';
}

function setHomeMenuOpen(open) {
  if (!homeMenuPopover || !btnHomeMenu) return;
  const next = Boolean(open);
  homeMenuPopover.hidden = !next;
  btnHomeMenu.setAttribute('aria-expanded', String(next));
  btnHomeMenu.classList.toggle('active', next);
}

btnHomeMenu?.addEventListener('click', (e) => {
  e.stopPropagation();
  setHomeMenuOpen(Boolean(homeMenuPopover?.hidden));
});

document.addEventListener('pointerdown', (e) => {
  if (!homeMenuPopover || homeMenuPopover.hidden) return;
  const wrap = btnHomeMenu?.closest('.home-menu-wrap');
  if (wrap && !wrap.contains(e.target)) {
    setHomeMenuOpen(false);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (homeMenuPopover && !homeMenuPopover.hidden) setHomeMenuOpen(false);
    if (modalLogbook && !modalLogbook.hidden) closeLogbookModal();
  }
});

async function setActiveMenuTab(tab = 'solo') {
  const prevTab = activeMenuTab;
  activeMenuTab = tab === 'leaderboards' ? 'leaderboards' : 'solo';
  const changed = prevTab !== activeMenuTab;
  const isSolo = activeMenuTab === 'solo';
  const isLb = activeMenuTab === 'leaderboards';

  setHomeMenuOpen(false);
  screenMenu.classList.toggle('is-leaderboard', isLb);
  btnOpenLeaderboard?.classList.toggle('active', isLb);
  if (homeMenuLbLabel) {
    homeMenuLbLabel.textContent = isLb ? '🤿 Back to Dive' : '🏆 Leaderboard';
  }

  if (soloPanel) soloPanel.hidden = !isSolo;
  if (leaderboardPanel) leaderboardPanel.hidden = !isLb;
  if (menuIdentityRow) menuIdentityRow.hidden = isLb;
  syncSitePickerVisibility();
  if (isSolo) {
    requestAnimationFrame(syncMenuDescToggle);
  }

  if (changed) {
    if (isLb) {
      retriggerAnim(leaderboardPanel, 'anim-glide-right');
    } else {
      retriggerAnim(menuIdentityRow, 'anim-glide-left');
      retriggerAnim(menuSitePicker, 'anim-glide-left');
      retriggerAnim(soloPanel, 'anim-glide-left');
    }
  }

  if (isSolo) {
    lan.ensureConnected();
    lan.listRooms();
  } else if (isLb) {
    refreshMenuLeaderboard();
  }
}

btnOpenLeaderboard?.addEventListener('click', () => {
  setActiveMenuTab(activeMenuTab === 'leaderboards' ? 'solo' : 'leaderboards');
});
btnLbBack?.addEventListener('click', () => setActiveMenuTab('solo'));

leaderboardPanel?.addEventListener('click', (e) => {
  const modeBtn = e.target.closest('button[data-lb-mode]');
  if (modeBtn) {
    const rawMode = modeBtn.dataset.lbMode;
    lbMode = rawMode === 'team' ? 'team' : rawMode === 'daily' ? 'daily' : 'solo';
    const tabsWrap = modeBtn.closest('.lb-tabs');
    tabsWrap?.style.setProperty('--lb-index', lbMode === 'daily' ? '2' : lbMode === 'team' ? '1' : '0');
    for (const b of leaderboardPanel.querySelectorAll('button[data-lb-mode]')) {
      b.classList.toggle('active', b === modeBtn);
    }
    refreshMenuLeaderboard();
    return;
  }
  const rowBtn = e.target.closest('button[data-lb-idx]');
  if (rowBtn) {
    const idx = Number(rowBtn.dataset.lbIdx);
    const entry = Number.isInteger(idx) ? lastMenuLbEntries[idx] : null;
    if (entry) openLeaderboardStatsModal(entry, idx + 1);
  }
});

debriefLeaderboardEl?.addEventListener('click', (e) => {
  const rowBtn = e.target.closest('button[data-lb-idx]');
  if (!rowBtn) return;
  const idx = Number(rowBtn.dataset.lbIdx);
  const entry = Number.isInteger(idx) ? lastDebriefLbEntries[idx] : null;
  if (entry) openLeaderboardStatsModal(entry, idx + 1);
});

btnLbStatsClose?.addEventListener('click', closeLeaderboardStatsModal);
lbStatsModalEl?.addEventListener('click', (e) => {
  if (e.target === lbStatsModalEl) closeLeaderboardStatsModal();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && lbStatsModalEl && !lbStatsModalEl.hidden) {
    closeLeaderboardStatsModal();
  }
});

selectLbSite?.addEventListener('change', () => {
  lbFilterLevelId = selectLbSite.value || 'overall';
  refreshMenuLeaderboard();
});

function beginRoomJoinLoading(code, { isDropIn = false, directDive = false, statusText = '' } = {}) {
  const cleanCode = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleanCode) return;
  joiningRoomCode = cleanCode;
  joiningIsDropIn = Boolean(isDropIn);
  if (directDive) {
    directJoinToDive = true;
    pendingAutoJoinCode = cleanCode;
  }
  const eyebrowEl = screenLoader?.querySelector('.menu-eyebrow');
  if (eyebrowEl) {
    eyebrowEl.textContent = isDropIn ? 'CO-OP DROP-IN · SYNCING ACTIVE DIVE' : 'CO-OP JOIN · CONNECTING TO CREW';
  }
  screenMenu.hidden = true;
  screenLoader.classList.remove('done');
  setLoaderProgress(14, isDropIn ? `Dropping into Room ${cleanCode}...` : `Joining Room ${cleanCode}...`);
  if (loaderCoopSyncEl) loaderCoopSyncEl.hidden = false;
  if (loaderCrewStatusEl) {
    loaderCrewStatusEl.textContent = statusText || `Connecting to Room ${cleanCode}...`;
  }
  if (btnLoaderForce) btnLoaderForce.hidden = true;
  if (btnLoaderCancel) btnLoaderCancel.hidden = false;
}

function finishRoomJoinLoading({ revealMenu = false } = {}) {
  joiningRoomCode = '';
  joiningIsDropIn = false;
  const eyebrowEl = screenLoader?.querySelector('.menu-eyebrow');
  if (eyebrowEl) eyebrowEl.textContent = 'SYSTEM CHECK · PRE-DIVE SETUP';
  if (revealMenu) {
    screenLoader.classList.add('done');
    if (loaderCoopSyncEl) loaderCoopSyncEl.hidden = true;
    screenMenu.hidden = false;
  }
}

if (lanRoomsList) {
  lanRoomsList.addEventListener('click', (e) => {
    const joinBtn = e.target.closest('button[data-join-code]');
    if (!joinBtn || joinBtn.disabled) return;
    const code = joinBtn.dataset.joinCode;
    const name = requireCallsign();
    if (!name) return;
    const roomInput = document.getElementById('input-room-code');
    if (roomInput) roomInput.value = code;
    const matchedRoom = Array.isArray(lan.rooms) ? lan.rooms.find((r) => r.code === code) : null;
    const isDropIn = Boolean(matchedRoom?.started || joinBtn.textContent.toLowerCase().includes('drop'));
    lanStatus.textContent = isDropIn ? `Dropping into Room ${code}...` : `Joining room ${code}...`;
    beginRoomJoinLoading(code, { isDropIn });
    lan.connect();
    lan.joinRoom(code, name);
  });
}

const roomCodeInput = document.getElementById('input-room-code');
function triggerJoinFromInput() {
  const name = requireCallsign();
  if (!name) return;
  const code = (roomCodeInput?.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) {
    if (lanStatus) {
      lanStatus.hidden = false;
      lanStatus.className = 'lan-status warn';
      lanStatus.textContent = 'Enter a 4-letter room code or pick an active dive below.';
    }
    return;
  }
  const matchedRoom = Array.isArray(lan.rooms) ? lan.rooms.find((r) => r.code === code) : null;
  const isDropIn = Boolean(matchedRoom?.started);
  if (lanStatus) {
    lanStatus.hidden = false;
    lanStatus.className = 'lan-status';
    lanStatus.textContent = isDropIn ? `Dropping into Room ${code}...` : `Joining room ${code}...`;
  }
  beginRoomJoinLoading(code, { isDropIn });
  lan.connect();
  lan.joinRoom(code, name);
}

roomCodeInput?.addEventListener('input', () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});
roomCodeInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    triggerJoinFromInput();
  }
});

document.getElementById('btn-join-room').addEventListener('click', triggerJoinFromInput);

async function copyCurrentInviteLink() {
  if (!lan.room) return;
  requestDiverNotificationPermission();
  if (cachedLanUrls.length === 0) await fetchLanUrls();
  syncRoomInviteUi(lan.room);
  const inviteUrl = lanInviteUrlInput?.value || buildRoomInviteUrl(lan.room.code);
  const ok = await copyText(inviteUrl, `Copied invite link for Room ${lan.room.code}!`, {
    selectEl: lanInviteUrlInput,
  });
  if (ok) {
    clearTimeout(copyInviteFeedbackTimer);
    if (btnCopyInvite) {
      btnCopyInvite.textContent = '✓ Copied!';
      btnCopyInvite.classList.add('copied');
    }
    if (btnHudInvite) {
      btnHudInvite.textContent = '✓ Copied';
      btnHudInvite.classList.add('copied');
    }
    copyInviteFeedbackTimer = setTimeout(() => {
      copyInviteFeedbackTimer = 0;
      if (btnCopyInvite) {
        btnCopyInvite.textContent = 'Copy Link';
        btnCopyInvite.classList.remove('copied');
      }
      if (btnHudInvite) {
        btnHudInvite.textContent = lan.room?.code ? `🔗 ${lan.room.code}` : '🔗 Invite';
        btnHudInvite.classList.remove('copied');
      }
    }, 2000);
  }
}

let upgradingDiveRoom = false;
async function upgradeDiveToCoopRoom({ share = false } = {}) {
  if (lan.room && isMultiplayer) {
    return share ? shareCurrentInviteLink() : copyCurrentInviteLink();
  }
  if (mode !== 'diving' || !session || upgradingDiveRoom) return;
  if (lan.room && !isMultiplayer) {
    lan.leaveRoom();
  }
  upgradingDiveRoom = true;
  if (btnHudInvite) btnHudInvite.disabled = true;
  try {
    const diverName = playerNameInput?.value.trim() || 'Lead Diver';
    requestDiverNotificationPermission();
    lan.connect();
    const room = await lan.createRoom(diverName, activeLevel.id, 4, {
      checkpoints: Array.from(session.checkpointsHit || []),
      collectibles: Array.from(session.collectedIds || []),
      openedHatches: Array.from(session.openedHatchIds || []),
      cutSnags: Array.from(session.cutSnagIds || []),
      placedMarkers: Array.from(session.placedMarkerIds || []),
      bodyRecovered: Boolean(session.bodyRecovered),
      playerLines: session.guidelineChains || [],
    });
    if (!room?.code) {
      showToast('Could not open co-op room right now — try again.', 2.8);
      return;
    }
    isMultiplayer = true;
    activeDiveSeq = room.diveSeq || 1;
    if (coopCommsEl) coopCommsEl.hidden = false;
    syncBrowserRoomUrl(room.code);
    syncRoomInviteUi(room);
    if (share && typeof navigator.share === 'function') {
      await shareCurrentInviteLink();
    } else {
      await copyCurrentInviteLink();
    }
    showToast(`Co-op Room ${room.code} live! Share link — friends drop straight in.`, 3.8);
  } finally {
    upgradingDiveRoom = false;
    if (btnHudInvite) btnHudInvite.disabled = false;
  }
}

async function shareCurrentInviteLink() {
  if ((!lan.room || !isMultiplayer) && mode === 'diving' && session) {
    return upgradeDiveToCoopRoom({ share: true });
  }
  if (!lan.room || typeof navigator.share !== 'function') {
    copyCurrentInviteLink();
    return;
  }
  requestDiverNotificationPermission();
  if (cachedLanUrls.length === 0) await fetchLanUrls();
  const url = buildRoomInviteUrl(lan.room.code);
  const lvl = getLevelById(lan.room.levelId);
  try {
    await navigator.share({
      title: `Techno Dive Co-op · Room ${lan.room.code}`,
      text: `Join my Techno Dive co-op dive (${lvl.name}) — Room ${lan.room.code}`,
      url,
    });
  } catch (err) {
    if (err?.name !== 'AbortError') {
      copyCurrentInviteLink();
    }
  }
}

btnCopyInvite?.addEventListener('click', copyCurrentInviteLink);
btnHudInvite?.addEventListener('click', () => {
  if ((!lan.room || !isMultiplayer) && mode === 'diving' && session) {
    upgradeDiveToCoopRoom({ share: false });
  } else {
    copyCurrentInviteLink();
  }
});

lanInviteUrlInput?.addEventListener('click', () => {
  lanInviteUrlInput.focus();
  lanInviteUrlInput.select();
  copyCurrentInviteLink();
});

btnShareInvite?.addEventListener('click', shareCurrentInviteLink);
btnHudShare?.addEventListener('click', shareCurrentInviteLink);

btnNotifyToggle?.addEventListener('click', async () => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    notifyAlertsMuted = !notifyAlertsMuted;
    syncNotifyToggleUi();
    showToast(notifyAlertsMuted ? 'Join notifications muted.' : 'Join notifications active!', 2.2);
    return;
  }
  await requestDiverNotificationPermission({ userTriggered: true });
});

document.getElementById('btn-ready-toggle')?.addEventListener('click', () => {
  const me = lan.getMyPlayer();
  if (!me) return;
  lan.setReady(!me.ready);
});

document.getElementById('btn-start-coop').addEventListener('click', () => lan.prepareDive());

btnLoaderForce?.addEventListener('click', () => lan.startDive(true));
btnLoaderCancel?.addEventListener('click', () => {
  loadSeq += 1;
  inFlightLoad = null;
  if (directJoinToDive || pendingAutoJoinCode || joiningRoomCode) {
    directJoinToDive = false;
    pendingAutoJoinCode = '';
    attemptJoinAfterExpire = '';
    lan.leaveRoom();
    syncBrowserRoomUrl('');
    finishRoomJoinLoading({ revealMenu: true });
    setActiveMenuTab('solo');
    resetLobbyUiState('Canceled room join.');
    return;
  }
  screenLoader.classList.add('done');
  if (loaderCoopSyncEl) loaderCoopSyncEl.hidden = true;
  if (lan.room && lan.isHost()) lan.cancelPrepare();
});

coopCommsEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('.comm-btn');
  if (!btn || !session || mode !== 'diving') return;
  if (btn.id === 'btn-share-gas') {
    const targetId = btn.dataset.targetId || '';
    const targetGas = btn.dataset.targetGas || session.diveState.activeGasId;
    const targetName = btn.dataset.targetName || 'Buddy';
    if (!targetId) return;
    const targetPeer = lan.getPeers().find((p) => p && p.id === targetId);
    if (
      !targetPeer ||
      targetPeer.alive === false ||
      targetPeer.surfaced ||
      Math.hypot(targetPeer.x - session.diver.x, targetPeer.y - session.diver.y) > 4.2
    ) {
      btn.hidden = true;
      showToast(`${targetName} moved out of gas-sharing reach.`, 2.0);
      return;
    }
    const candidate = getShareableGasCandidate(session.diveState, targetGas, 25, session.diveState.depthM);
    if (!candidate) {
      showToast('No safe gas cylinder with enough reserve to share here.', 2.2);
      return;
    }
    const donation = donateGasFromState(session.diveState, candidate.gasId, candidate.donatedBar);
    if (!donation) {
      showToast('Reserve too low to share gas safely.', 2.0);
      return;
    }
    lan.sendGasShare(targetId, donation.gasId, donation.donatedBar);
    pushAirShareBeam(session, {
      peerId: targetId,
      peerName: targetName,
      fromSelf: true,
      gasId: donation.gasId,
      amountBar: donation.donatedBar,
    });
    audio.playGasShare();
    showToast(`🎁 Shared +${donation.donatedBar} bar ${getActiveGasName(donation.gasId)} with ${targetName}!`, 2.6);
    btn.hidden = true;
    return;
  }
  if (btn.id === 'btn-tow-buddy') {
    const peer = lan.getPeers().find((p) => p && p.id === btn.dataset.targetId);
    if (peer) attachBuddyTow(peer);
    btn.hidden = true;
    return;
  }
  if (btn.id === 'btn-drop-tow') {
    if (session.rescueTargetId) {
      const dropped = lan.getPeers().find((p) => p && p.id === session.rescueTargetId);
      const droppedId = session.rescueTargetId;
      const droppedName = dropped?.name || 'Buddy';
      if (dropped) dropped.rescuedBy = '';
      session.rescueTargetId = null;
      session.diver.rescueTargetId = '';
      lan.sendBuddyRescue(droppedId, droppedName, 'dropped');
      audio.playReelClick();
      showToast(`🔓 Released tow line on ${droppedName}.`, 2.2);
    }
    btn.hidden = true;
    return;
  }
  const sig = btn.dataset.signal;
  if (!sig) return;
  dispatchScubaSignal(sig);
});

btnCoopSpectate?.addEventListener('click', () => {
  const activePeers = isMultiplayer
    ? lan.getPeers().filter((p) => p && p.alive !== false && !p.surfaced)
    : [];
  if (!spectatingPeer) {
    spectatingPeer = true;
    spectatePeerIdx = 0;
  } else if (activePeers.length > 1 && spectatePeerIdx < activePeers.length - 1) {
    spectatePeerIdx += 1;
  } else {
    spectatingPeer = false;
    spectatePeerIdx = 0;
  }
  if (btnCoopSpectate) {
    if (!spectatingPeer) {
      btnCoopSpectate.textContent = 'Watch Buddy';
    } else if (activePeers.length > 1) {
      const target = activePeers[spectatePeerIdx % activePeers.length];
      btnCoopSpectate.textContent = `Next (${target?.name || 'Buddy'})`;
    } else {
      btnCoopSpectate.textContent = 'My Diver';
    }
  }
});

btnCoopFinishNow?.addEventListener('click', () => {
  if (!session || !session.localOutcome) return;
  finishDiveRun(
    session.localOutcome.success,
    session.localOutcome.title,
    session.localOutcome.detail,
    session.localOutcome.scoreSummary
  );
});

document.getElementById('btn-leave-room').addEventListener('click', () => {
  const prevCode = lan.room?.code || '';
  lan.leaveRoom();
  isMultiplayer = false;
  activeDiveSeq = 0;
  resetLobbyUiState(prevCode ? `Left room ${prevCode}. Enter code or click Join to rejoin.` : 'Left room.');
  if (prevCode && roomCodeInput) roomCodeInput.value = prevCode;
  renderRoomsList();
});

document.getElementById('btn-torch').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (!session?.diver) return;
  if (session.drills?.active?.kind === 'torch-fail') {
    resolveEmergencyDrill(session, 'torch-fail', sessionStepCallbacks);
    return;
  }
  session.diver.torchOn = !session.diver.torchOn;
});

function setHudMenuOpen(open) {
  if (!hudMenuPopover || !btnHudMenu) return;
  const next = Boolean(open);
  hudMenuPopover.hidden = !next;
  btnHudMenu.setAttribute('aria-expanded', String(next));
  btnHudMenu.classList.toggle('active', next);
}

btnHudMenu?.addEventListener('click', (e) => {
  e.stopPropagation();
  setHudMenuOpen(Boolean(hudMenuPopover?.hidden));
});

document.addEventListener('pointerdown', (e) => {
  if (!hudMenuPopover || hudMenuPopover.hidden) return;
  const wrap = btnHudMenu?.closest('.hud-menu-wrap');
  if (wrap && !wrap.contains(e.target)) {
    setHudMenuOpen(false);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (hudMenuPopover && !hudMenuPopover.hidden) setHudMenuOpen(false);
    if (modalDiveGuide && !modalDiveGuide.hidden) closeDiveGuideModal(false);
    if (modalIssue && !modalIssue.hidden) closeIssueModal();
  }
});

// Auto-resume AudioContext on any gesture after iOS Safari interruption or background tab suspend
function resumeAudioOnGesture() {
  if (!audio.muted && audio.ctx && audio.ctx.state !== 'running') {
    audio.unlock();
  }
}
window.addEventListener('pointerdown', resumeAudioOnGesture, { passive: true });
window.addEventListener('keydown', resumeAudioOnGesture, { passive: true });

// Block accidental iOS/Android pinch-zoom during dual-thumb diving (keeps single-tap clicks & dual-stick pointer events intact)
const preventPinchGesture = (e) => {
  e.preventDefault();
};
document.addEventListener('gesturestart', preventPinchGesture, { passive: false });
document.addEventListener('gesturechange', preventPinchGesture, { passive: false });
document.addEventListener('gestureend', preventPinchGesture, { passive: false });
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  },
  { passive: false }
);

const btnMute = document.getElementById('btn-mute');
function syncMuteUi() {
  if (!btnMute) return;
  btnMute.textContent = audio.muted ? '🔇 Sound: Off' : '🔊 Sound: On';
  btnMute.classList.toggle('muted', Boolean(audio.muted));
}
syncMuteUi();
btnMute.addEventListener('click', () => {
  const next = !audio.muted;
  audio.setMuted(next);
  syncMuteUi();
});

const RADIO_PREF_KEY = 'caveDiverRadioTrack_v1';
function syncRadioUi() {
  const tr = audio.radio.getCurrentTrack();
  const active = tr.id !== 'off';
  if (btnMenuRadio) {
    btnMenuRadio.textContent = active ? `🎵 Music: ${tr.name}` : '📻 Music: Off';
    btnMenuRadio.classList.toggle('active', active);
  }
  if (btnHudRadio) {
    btnHudRadio.textContent = active ? `🎵 Radio: ${tr.name}` : '📻 Radio: Off';
    btnHudRadio.title = active ? `Radio: ${tr.name} (tap to switch)` : 'Radio: Off (tap for aquatic tunes)';
    btnHudRadio.classList.toggle('active', active);
  }
}

function handleRadioCycle() {
  const track = audio.cycleRadioTrack();
  syncMuteUi();
  try {
    localStorage.setItem(RADIO_PREF_KEY, String(audio.radio.trackIndex));
  } catch {}
  syncRadioUi();
  showToast(track.id === 'off' ? '📻 Aquatic Radio: Off' : `📻 Aquatic Radio: ${track.name} (${track.bpm} BPM)`, 2.1);
}

try {
  const savedIdx = Number(localStorage.getItem(RADIO_PREF_KEY));
  if (Number.isFinite(savedIdx) && savedIdx > 0) {
    audio.setRadioTrackIndex(savedIdx);
  }
} catch {}
syncRadioUi();
btnMenuRadio?.addEventListener('click', handleRadioCycle);
btnHudRadio?.addEventListener('click', handleRadioCycle);

function reconcileSiteFilterOnMenuReturn() {
  if (siteCategoryFilter !== 'todo') return;
  const visible = getFilteredLevels();
  if (visible.length === 0) {
    setSiteCategoryFilter('all');
  } else if (!visible.some((l) => l.id === activeLevel.id) && !(lan.room && !lan.isHost())) {
    activeLevel = visible[0];
    if (selectLevel) selectLevel.value = activeLevel.id;
    syncMenuLevelLabels(activeLevel);
  }
}

function abortActiveDiveToMenu() {
  const prevCode = lan.room?.code || '';
  activeDailyChallenge = null;
  cancelDebriefAnimations();
  input?.resetAll?.();
  audio.resetEnvironmentFilter();
  divePaused = false;
  pendingAbortAt = 0;
  mode = 'menu';
  session = null;
  spectatingPeer = false;
  spectatePeerIdx = 0;
  activeDiveSeq = 0;
  setHudMenuOpen(false);
  if (hudPauseOverlay) hudPauseOverlay.hidden = true;
  if (btnDropTow) btnDropTow.hidden = true;
  if (btnTowBuddy) btnTowBuddy.hidden = true;
  if (btnShareGas) btnShareGas.hidden = true;
  syncWreckActionHud(null);
  hideHudPhotoCard();
  screenHud.classList.remove('hud-team-hold');
  toggleShearwaterComputer(false);
  toggleSignalWheel(false);
  screenHud.hidden = true;
  if (coopCommsEl) coopCommsEl.hidden = true;
  if (coopWaitBannerEl) coopWaitBannerEl.hidden = true;
  screenMenu.hidden = false;
  if (isMultiplayer) {
    lan.leaveRoom();
    isMultiplayer = false;
    setActiveMenuTab('solo');
    resetLobbyUiState(prevCode ? `Aborted dive (Room ${prevCode} stays open for remaining divers).` : 'Aborted dive and left room.');
    if (prevCode && roomCodeInput) roomCodeInput.value = prevCode;
  }
  syncWakeLockFn?.();
  reconcileSiteFilterOnMenuReturn();
  renderRoomsList();
  renderLevelCards();
  renderDailyChallengeCard();
}

btnPauseResume?.addEventListener('click', () => setDivePaused(false));
btnPauseAbort?.addEventListener('click', abortActiveDiveToMenu);

document.getElementById('btn-abort').addEventListener('click', () => {
  const inLiveDive = mode === 'diving' && session && !session.endedState && !divePaused;
  const elapsed = session?.diveState?.diveTimeSec || 0;
  if (inLiveDive && elapsed > 15) {
    const now = performance.now();
    if (now - pendingAbortAt > 3000) {
      pendingAbortAt = now;
      showToast('Tap ✕ again within 3s to abort dive', 2.8);
      return;
    }
  }
  abortActiveDiveToMenu();
});

btnNextLevel?.addEventListener('click', async () => {
  if (btnNextLevel.disabled) return;
  const curIdx = LEVELS.findIndex((l) => l.id === activeLevel.id);
  if (curIdx < 0 || curIdx + 1 >= LEVELS.length) return;
  const nextLvl = LEVELS[curIdx + 1];
  btnNextLevel.disabled = true;
  try {
    cancelDebriefAnimations();
    audio.resetEnvironmentFilter();
    await selectAndLoadLevel(nextLvl.id);
    if (isMultiplayer && lan.room && lan.getPeers().length > 0 && lan.isHost()) {
      mode = 'menu';
      session = null;
      screenDebrief.hidden = true;
  debriefReplay.stop();
      screenMenu.hidden = false;
      setActiveMenuTab('solo');
      syncWakeLockFn?.();
      lan.returnToLobby();
      showToast(`Selected L${curIdx + 2}: ${nextLvl.name} — ready for crew launch!`, 2.8);
      return;
    }
    screenDebrief.hidden = true;
  debriefReplay.stop();
    launchOpenCoopDive();
  } finally {
    btnNextLevel.disabled = false;
  }
});

document.getElementById('btn-retry').addEventListener('click', () => {
  const retryDaily = Boolean(session?.dailyDateKey && activeDailyChallenge);
  cancelDebriefAnimations();
  audio.resetEnvironmentFilter();
  if (isMultiplayer && lan.room && lan.getPeers().length > 0) {
    mode = 'menu';
    session = null;
    screenDebrief.hidden = true;
  debriefReplay.stop();
    screenMenu.hidden = false;
    setActiveMenuTab('solo');
    syncWakeLockFn?.();
    reconcileSiteFilterOnMenuReturn();
    renderLevelCards();
    if (lan.isHost()) {
      lan.returnToLobby();
      showToast('Back in co-op room — choose next site or start dive!', 2.8);
    } else {
      showToast('Returned to room lobby — waiting for Host to launch next dive.', 2.8);
    }
    return;
  }
  screenDebrief.hidden = true;
  debriefReplay.stop();
  if (retryDaily) {
    launchDailyChallenge(activeDailyChallenge);
  } else {
    launchOpenCoopDive();
  }
});

document.getElementById('btn-menu').addEventListener('click', () => {
  const prevCode = lan.room?.code || '';
  activeDailyChallenge = null;
  cancelDebriefAnimations();
  audio.resetEnvironmentFilter();
  mode = 'menu';
  session = null;
  activeDiveSeq = 0;
  screenDebrief.hidden = true;
  debriefReplay.stop();
  screenMenu.hidden = false;
  if (isMultiplayer) {
    lan.leaveRoom();
    isMultiplayer = false;
    resetLobbyUiState(prevCode ? `Left co-op room ${prevCode}.` : 'Left co-op room.');
    if (prevCode && roomCodeInput) roomCodeInput.value = prevCode;
  }
  syncWakeLockFn?.();
  reconcileSiteFilterOnMenuReturn();
  renderRoomsList();
  renderLevelCards();
  renderDailyChallengeCard();
});

lan.on('host_promoted', ({ code }) => {
  lastHostPromoMs = Date.now();
  if (mode === 'diving' && lan.room && !lan.room.started) {
    lan.startDive(true);
  }
  showToast(`Previous host left — you are now Host of Room ${code}!`, 3.4);
});

lan.on('transport_changed', () => {
  fetchLanUrls();
});

lan.on('connected', () => {
  const isP2p = lan.getTransportMode() === 'p2p';
  setLanConnectionBadge('ok', isP2p ? '● P2P Ready' : '● LAN Connected');
  fetchLanUrls();
  if (!lan.room && !pendingAutoJoinCode && lanStatus) {
    lanStatus.hidden = true;
  }
});

lan.on('reconnecting', ({ attempt }) => {
  setLanConnectionBadge('', `○ Reconnecting (${attempt})...`);
  if (mode === 'diving') {
    showToast('LAN hiccup — reconnecting...', 2.0);
  }
});

lan.on('disconnected', () => {
  setLanConnectionBadge('danger', '○ Disconnected');
});

lan.on('rooms_list', (rooms) => {
  renderRoomsList(rooms);
});

lan.on('session_expired', () => {
  if (attemptJoinAfterExpire) {
    const code = attemptJoinAfterExpire;
    attemptJoinAfterExpire = '';
    suppressNextExpiredError = true;
    const diverName = playerNameInput?.value.trim() || 'Buddy Diver';
    pendingAutoJoinCode = code;
    lanStatus.className = 'lan-status';
    lanStatus.textContent = `Joining room ${code}...`;
    lan.joinRoom(code, diverName);
    return;
  }
  resetLobbyUiState('Previous room session expired. Create or join a room.');
});

lan.on('join_stage', ({ code, pct, message }) => {
  if (!joiningRoomCode || (code && code !== joiningRoomCode)) return;
  const curPct = parseInt(loaderPctEl?.textContent || '0', 10) || 0;
  setLoaderProgress(Math.max(curPct, pct || curPct), message || `Joining Room ${joiningRoomCode}...`);
  if (loaderCrewStatusEl && message) loaderCrewStatusEl.textContent = message;
});

lan.on('error', (msg) => {
  const errText = typeof msg === 'string' ? msg : String(msg?.message || msg || 'Connection error');
  if (suppressNextExpiredError) {
    suppressNextExpiredError = false;
    if (errText.includes('no longer active') || errText.includes('expired')) {
      return;
    }
  }
  if (attemptJoinAfterExpire && (errText.includes('no longer active') || errText.includes('expired'))) {
    return;
  }
  if (directJoinToDive || pendingAutoJoinCode || joiningRoomCode) {
    directJoinToDive = false;
    pendingAutoJoinCode = '';
    syncBrowserRoomUrl('');
    finishRoomJoinLoading({ revealMenu: true });
    setActiveMenuTab('solo');
  }
  if (lanStatus) {
    lanStatus.hidden = false;
    lanStatus.className = 'lan-status warn';
    lanStatus.textContent = errText;
  }
  showToast(errText, 3.0);
});

lan.on('returned_to_lobby', () => {
  loadSeq += 1;
  inFlightLoad = null;
  cancelDebriefAnimations();
  audio.resetEnvironmentFilter();
  screenLoader.classList.add('done');
  if (loaderCoopSyncEl) loaderCoopSyncEl.hidden = true;
  if (mode === 'debrief') {
    mode = 'menu';
    session = null;
    screenDebrief.hidden = true;
  debriefReplay.stop();
    screenMenu.hidden = false;
    setActiveMenuTab('solo');
    syncWakeLockFn?.();
    reconcileSiteFilterOnMenuReturn();
    showToast('Host returned crew to room lobby for next dive.', 2.8);
  }
  renderLevelCards();
});

function updateLoaderCrewSyncBanner(room) {
  if (!loaderCrewStatusEl || !room || room.phase !== 'preparing') return;
  const parts = room.players
    .filter((p) => p.connected !== false)
    .map((p) => {
      const done = p.loadedLevelId === room.levelId && p.loadStatus === 'ready';
      return `${p.name}: ${done ? '✓ Ready' : `${p.loadPct ?? 0}%`}`;
    });
  loaderCrewStatusEl.textContent = `Crew Sync · ${parts.join(' | ')}`;
  if (btnLoaderForce) btnLoaderForce.hidden = !lan.isHost();
  if (btnLoaderCancel) btnLoaderCancel.hidden = !lan.isHost();
}

lan.on('room_update', async (room) => {
  const autoJoinedNow = Boolean(pendingAutoJoinCode && room?.code === pendingAutoJoinCode);
  const wasJoiningThisRoom = Boolean(joiningRoomCode && room?.code === joiningRoomCode);
  const matchesTargetRoom = !INITIAL_ROOM_CODE || room?.code === INITIAL_ROOM_CODE;
  const shouldEnterDirectDive = Boolean(directJoinToDive && room?.code && matchesTargetRoom && !lan.isHost());
  if (autoJoinedNow) {
    pendingAutoJoinCode = '';
    if (!shouldEnterDirectDive && !room?.started) {
      setActiveMenuTab('solo');
    }
  }
  const justEnteredRoom = lanRoomBox.hidden;
  lanRoomBox.hidden = false;
  if (lanSetupControls) lanSetupControls.hidden = true;
  if (lanRoomsSection) lanRoomsSection.hidden = true;

  syncRoomInviteUi(room);
  syncBrowserRoomUrl(room.code);
  if (!shouldEnterDirectDive && !room?.started && (justEnteredRoom || autoJoinedNow)) {
    lanRoomBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  if ((autoJoinedNow || wasJoiningThisRoom) && !shouldEnterDirectDive && !room?.started) {
    showToast(`Joined Room ${room.code}!`, 3.0);
  }

  const siteLevel = getLevelById(room.levelId);
  const siteNum = Math.max(1, LEVELS.findIndex((l) => l.id === siteLevel.id) + 1);
  if (knownRoomCode !== room.code) {
    knownRoomCode = room.code;
    knownRoomMemberIds = new Set((room.players || []).map((p) => p.id));
  } else {
    const newJoiners = (room.players || []).filter(
      (p) => p.id !== lan.clientId && !knownRoomMemberIds.has(p.id)
    );
    knownRoomMemberIds = new Set((room.players || []).map((p) => p.id));
    if (newJoiners.length > 0) {
      showJoinOsNotification(room, newJoiners, siteNum, siteLevel);
      if (document.hasFocus() && !document.hidden) {
        const names = newJoiners.map((p) => p.name || 'Buddy Diver').join(', ');
        showToast(`${names} joined Room ${room.code}!`, 3.0);
      }
    }
  }
  document.getElementById('lan-room-code').textContent = room.code;
  const sitePill = document.getElementById('lan-room-site-pill');
  if (sitePill) sitePill.textContent = `L${siteNum}: ${siteLevel.name}`;

  const roster = document.getElementById('lan-roster');
  roster.innerHTML = room.players
    .map((p) => {
      const roleTag = p.isHost ? 'Host' : 'Buddy';
      const isCachedOnMember = p.loadedLevelId === room.levelId && p.loadStatus === 'ready';
      let loadBadge = isCachedOnMember
        ? '<span class="roster-pill ok">✓ Ready</span>'
        : p.loadStatus === 'loading'
          ? `<span class="roster-pill loading">Loading ${p.loadPct ?? 0}%</span>`
          : '<span class="roster-pill">In Lobby</span>';
      if (p.connected === false) {
        loadBadge = room.started
          ? '<span class="roster-pill off">Reconnecting...</span>'
          : '<span class="roster-pill loading">Away · Held</span>';
      } else if (!p.ready) {
        loadBadge = '<span class="roster-pill loading">Hold Up</span>';
      }
      return `
        <li>
          <span><strong>${escapeHtml(p.name)}</strong> <small>(${roleTag})</small></span>
          <span class="roster-badges">${loadBadge}</span>
        </li>
      `;
    })
    .join('');

  const hostMode = lan.isHost();
  const startBtn = document.getElementById('btn-start-coop');
  const readyBtn = document.getElementById('btn-ready-toggle');
  startBtn.hidden = !hostMode;
  if (readyBtn) {
    const me = lan.getMyPlayer();
    readyBtn.hidden = hostMode || !me;
    if (me) {
      readyBtn.textContent = me.ready ? 'Ready ✓' : 'Hold Up';
    }
  }
  setLevelSelectionLocked(!hostMode);

  if (room.levelId && room.levelId !== activeLevel.id) {
    activeLevel = siteLevel;
    if (selectLevel) selectLevel.value = siteLevel.id;
    syncMenuLevelLabels(siteLevel);
    // Only restore silently if already cached; do not bake chunks until dive begins
    if (renderer.isLevelCached(siteLevel.id)) {
      await ensureLevelLoaded(siteLevel.id, { showOverlay: false });
    }
  } else {
    renderLevelCards();
  }

  updateLoaderCrewSyncBanner(room);

  const loadingPlayer = room.players.find(
    (p) => p.connected !== false && p.loadStatus === 'loading'
  );
  if (hostMode) {
    startBtn.disabled = room.phase === 'preparing';
    startBtn.textContent =
      room.phase === 'preparing'
        ? 'SYNCING CREW...'
        : `START CO-OP DIVE (${room.players.length}/${room.maxPlayers || 2})`;
  }

  const maxP = room.maxPlayers || 2;
  if (lanStatus) lanStatus.hidden = false;
  if (loadingPlayer) {
    lanStatus.className = 'lan-status warn';
    lanStatus.textContent = `Loading L${siteNum} (${siteLevel.name}): ${loadingPlayer.name} ${loadingPlayer.loadPct ?? 0}%...`;
  } else if (room.players.length >= maxP) {
    lanStatus.className = 'lan-status ok';
    lanStatus.textContent = `${room.players.length}/${maxP} Divers in Room ${room.code} on L${siteNum}: ${siteLevel.name}!`;
  } else {
    lanStatus.className = 'lan-status';
    lanStatus.textContent = `Room ${room.code} · L${siteNum}: ${siteLevel.name} (${room.players.length}/${maxP} Divers)`;
  }

  // Keep loader open continuously while dropping into an active dive until dive_started + terrain load complete
  if (wasJoiningThisRoom && room.started && mode !== 'diving') {
    const alreadyReadyOnSite =
      renderer.ready && renderer.level?.id === siteLevel.id && ecosystem && !inFlightLoad;
    if (joiningIsDropIn && (inFlightLoad?.levelId === siteLevel.id || alreadyReadyOnSite)) {
      return;
    }
    joiningIsDropIn = true;
    const eyebrowEl = screenLoader?.querySelector('.menu-eyebrow');
    if (eyebrowEl) eyebrowEl.textContent = 'CO-OP DROP-IN · SYNCING ACTIVE DIVE';
    if (loaderCrewStatusEl) {
      loaderCrewStatusEl.textContent = `Room ${room.code} active · Syncing L${siteNum}: ${siteLevel.name}...`;
    }
    activeLevel = siteLevel;
    if (selectLevel) selectLevel.value = siteLevel.id;
    syncMenuLevelLabels(siteLevel);
    await ensureLevelLoaded(siteLevel.id, { showOverlay: true, keepOpenAfterLoad: true });
    return;
  }

  // Invited user clicking an invite link skips the lobby/join UI and drops straight into the dive!
  if (shouldEnterDirectDive && !room.started && mode !== 'diving') {
    directJoinToDive = false;
    activeLevel = siteLevel;
    if (selectLevel) selectLevel.value = siteLevel.id;
    syncMenuLevelLabels(siteLevel);
    await ensureLevelLoaded(siteLevel.id, { showOverlay: true, keepOpenAfterLoad: false });
    finishRoomJoinLoading({ revealMenu: false });
    if (mode !== 'diving') {
      startDiveRun(true, { awaitingHostStart: true });
      showToast(`Room ${room.code} joined — diving now! Host diver will drop in shortly.`, 3.6);
    }
    return;
  }

  // Normal lobby join (clicked Join / entered room code for a room in lobby): smoothly transition to Room Lobby once fully joined
  if (wasJoiningThisRoom && !room.started && room.phase !== 'preparing' && !shouldEnterDirectDive) {
    finishRoomJoinLoading({ revealMenu: true });
    setActiveMenuTab('solo');
    lanRoomBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

lan.on('dive_preparing', async (msg) => {
  const nextLevelId = msg?.levelId || activeLevel.id;
  if (mode === 'diving' && (!session?._awaitingHostStart || session?.level?.id === nextLevelId)) {
    return;
  }
  if (mode === 'diving') {
    mode = 'menu';
    setHudMenuOpen(false);
    screenHud.hidden = true;
  }
  if (loaderCoopSyncEl) loaderCoopSyncEl.hidden = false;
  updateLoaderCrewSyncBanner(msg.room);
  await ensureLevelLoaded(nextLevelId, {
    showOverlay: true,
    keepOpenAfterLoad: true,
  });
});

lan.on('peer_joined_mid_dive', (name) => {
  if (mode === 'diving') {
    showToast(`${name || 'Buddy'} dropped into the dive!`, 3.0);
  }
});

lan.on('dive_started', async (msg) => {
  directJoinToDive = false;
  if (loaderCrewStatusEl && joiningRoomCode) {
    loaderCrewStatusEl.textContent = `Room ${joiningRoomCode} live — loading cave geometry...`;
  }
  const sameLevel = !msg?.levelId || msg.levelId === session?.level?.id;
  if (
    mode === 'diving' &&
    session &&
    sameLevel &&
    (msg?.preserveDive || (msg?.rejoined && msg?.diveSeq && msg.diveSeq === activeDiveSeq) || session._awaitingHostStart)
  ) {
    const wasWaiting = Boolean(session._awaitingHostStart);
    session._awaitingHostStart = false;
    activeDiveSeq = msg?.diveSeq || activeDiveSeq || 1;
    if (msg.checkpoints) for (const cpId of msg.checkpoints) session.checkpointsHit.add(cpId);
    if (msg.collectibles) for (const cId of msg.collectibles) session.collectedIds.add(cId);
    if (Array.isArray(msg.openedHatches)) {
      for (const hId of msg.openedHatches) {
        if (!session.openedHatchIds.has(hId)) {
          session.openedHatchIds.add(hId);
          const hObj = session.level?.watertightHatches?.find((h) => h.id === hId);
          session.hatchBonusScore = (session.hatchBonusScore || 0) + (hObj?.bonusPoints || 150);
        }
      }
    }
    if (Array.isArray(msg.cutSnags)) {
      for (const sId of msg.cutSnags) {
        session.cutSnagIds.add(sId);
        const snIdx = session.level?.snagZones?.findIndex((s, i) => (s.id || `snag_${i}`) === sId);
        if (snIdx >= 0 && snIdx === session.activeSnagIndex) session.activeSnagIndex = -1;
      }
    }
    if (Array.isArray(msg.placedMarkers)) {
      for (const mId of msg.placedMarkers) session.placedMarkerIds.add(mId);
    }
    if (Array.isArray(msg.playerLines)) {
      if (!session.restoredPeerLines) session.restoredPeerLines = new Map();
      for (const entry of msg.playerLines) {
        if (entry.playerId && entry.playerId !== lan.clientId) {
          session.restoredPeerLines.set(entry.playerId, entry.chains || []);
        }
      }
    }
    if (msg.bodyRecoveredBy && !session.bodyRecovered) session.bodyRecovered = true;
    if (wasWaiting && !lan.isHost()) {
      showToast('Lead diver dropped into the cave!', 2.8);
    }
    return;
  }
  activeDiveSeq = msg?.diveSeq || 1;
  if (msg?.levelId) {
    await ensureLevelLoaded(msg.levelId, { showOverlay: true, keepOpenAfterLoad: false });
  }
  finishRoomJoinLoading({ revealMenu: false });
  startDiveRun(
    true,
    msg?.rejoined || msg?.lateJoin
      ? {
          checkpoints: msg.checkpoints,
          collectibles: msg.collectibles,
          openedHatches: msg.openedHatches,
          cutSnags: msg.cutSnags,
          placedMarkers: msg.placedMarkers,
          playerLines: msg.playerLines,
          bodyRecoveredBy: msg.bodyRecoveredBy,
        }
      : null
  );
  if (msg?.lateJoin) {
    showToast('Dropped straight into the active co-op dive!', 3.6);
  }
});

lan.on('peer_signal', (msg) => {
  let pan = 0;
  if (session?.diver) {
    const p = lan.getPeers().find((peer) => peer && peer.id === msg.playerId);
    if (p && Number.isFinite(p.x)) {
      pan = computeSpatialMix(session.diver.x, session.diver.y, p.x, p.y, { maxDistM: 60 }).pan;
    }
  }
  audio.playSignal(pan);
  showToast(`${msg.name || 'Buddy'}: ${msg.signal}`, 3.0);
});

lan.on('peer_guideline', (msg) => {
  if (!session || !msg?.playerId) return;
  if (!session.restoredPeerLines) session.restoredPeerLines = new Map();
  session.restoredPeerLines.set(msg.playerId, msg.chains || []);
});

lan.on('peer_checkpoint', (msg) => {
  if (!session || !msg?.checkpointId || session.checkpointsHit.has(msg.checkpointId)) return;
  session.checkpointsHit.add(msg.checkpointId);
  audio.playCheckpoint();
  showToast('Buddy tagged checkpoint!', 2.0);
});

lan.on('peer_wreck_action', (msg) => {
  if (!session) return;
  applyPeerWreckAction(session, msg, sessionStepCallbacks);
});

lan.on('peer_collectible', (msg) => {
  if (!session || !msg?.collectibleId || session.collectedIds.has(msg.collectibleId)) return;
  session.collectedIds.add(msg.collectibleId);
  const item = (session.level.collectibles || []).find((c) => c.id === msg.collectibleId);
  if (item) {
    session.collectBursts.push({
      x: item.x,
      y: item.y,
      points: item.points || 200,
      kind: item.kind || 'crystal',
      age: 0,
      duration: 1.35,
    });
    audio.playCollect();
    showToast(`Buddy found ${item.name}! (+${item.points})`, 2.2);
  }
});

lan.on('peer_silt', (msg) => {
  if (!session || !msg?.plume) return;
  spawnSiltPlume(session.siltClouds, msg.plume);
});

lan.on('peer_body_recovered', (msg) => {
  if (!session || session.bodyRecovered) return;
  session.bodyRecovered = true;
  const who = msg?.name || 'Buddy';
  const targetName = session.level.recoveryTarget?.name || 'fallen diver';
  audio.playRecovery();
  showToast(`🛟 ${who} secured ${targetName}! Escort back to surface exit.`, 4.0);
});

function attachBuddyTow(peer) {
  if (!session || !peer || peer.alive !== false || peer.rescued) return false;
  session.rescueTargetId = peer.id;
  session.diver.rescueTargetId = peer.id;
  peer.rescuedBy = lan.clientId || 'self';
  audio.playRecovery();
  showToast(`🛟 Towing ${peer.name || 'Buddy'}! Haul safely through deco to surface exit (+450 pts)!`, 3.6);
  lan.sendBuddyRescue(peer.id, peer.name || 'Buddy', 'towing');
  return true;
}

lan.on('peer_buddy_rescue', (msg) => {
  if (!session || mode !== 'diving') return;
  if (msg.status === 'dropped') {
    if (msg.rescuedId === lan.clientId) {
      session.rescuedBy = '';
      session.diver.rescuedBy = '';
      showToast(`🔓 ${msg.rescuerName || 'Buddy'} released your rescue tow line.`, 2.6);
    } else {
      const peer = lan.getPeers().find((p) => p && p.id === msg.rescuedId);
      if (peer) peer.rescuedBy = '';
    }
    return;
  }
  if (msg.rescuedId === lan.clientId) {
    if (msg.status === 'extracted') {
      session.rescued = true;
      session.surfaced = true;
      if (!session.localOutcome || session.endedState) {
        finishDiveRun(
          true,
          `Rescued by ${msg.rescuerName || 'Buddy'}!`,
          `${msg.rescuerName || 'Your buddy'} towed you safely back through the cave to the surface exit.`
        );
      }
      return;
    }
    session.rescuedBy = msg.rescuerId || 'peer';
    session.diver.rescuedBy = session.rescuedBy;
    audio.playRecovery();
    showToast(`🛟 ${msg.rescuerName || 'Buddy'} clipped a rescue tow onto you!`, 3.6);
  } else if (msg.status === 'extracted') {
    showToast(`🏆 ${msg.rescuerName || 'Buddy'} rescued ${msg.rescuedName || 'teammate'} safely to the surface!`, 3.4);
  } else {
    showToast(`🛟 ${msg.rescuerName || 'Buddy'} is towing ${msg.rescuedName || 'teammate'} toward the surface!`, 3.2);
  }
});

lan.on('peer_gas_share', (msg) => {
  if (!session || mode !== 'diving' || !msg?.amountBar) return;
  const added = receiveGasIntoState(session.diveState, msg.gasId, msg.amountBar);
  if (added > 0) {
    pushAirShareBeam(session, {
      peerId: msg.fromId || '',
      peerName: msg.fromName || 'Buddy',
      fromSelf: false,
      gasId: msg.gasId,
      amountBar: added,
    });
    audio.playGasShare();
    const gName = getActiveGasName(msg.gasId);
    showToast(`🎁 ${msg.fromName || 'Buddy'} shared +${Math.round(added)} bar ${gName}!`, 3.0);
  }
});

lan.on('peer_left', (peerId) => {
  if (session && peerId) {
    if (session.rescuedBy === peerId) {
      session.rescuedBy = '';
      session.diver.rescuedBy = '';
    }
    if (session.rescueTargetId === peerId) {
      session.rescueTargetId = null;
      session.diver.rescueTargetId = '';
    }
  }
  if (mode === 'diving' && Date.now() - lastHostPromoMs > 800) {
    showToast('Buddy diver left the dive.', 2.8);
  }
});

// --- Main Simulation Loop ---
let menuTimeSec = 0;

// Persistent zero-GC scratch objects for 60fps simulation & menu preview rendering
const MENU_PREVIEW_DIVE_STATE = createDiveState();
const EMPTY_SET = new Set();
const EMPTY_ARR = [];
const menuPreviewDiver = { x: 0, y: 0, vx: 0, vy: 0, angle: 0.2, torchOn: true };
const _framePlayerLines = [];
const _frameHandledPeerIds = new Set();
const sessionStepCallbacks = {
  onToast: showToast,
  onImpactSound: (spd) => audio.playImpact(spd),
  onAlarm: (lvl) => audio.playAlarm(lvl),
  onInhale: (ev) => audio.playRegulatorInhale(ev),
  onExhale: (ev) => (ev?.isCcr ? audio.playCcrSolenoid() : audio.playRegulatorExhale(ev)),
  onDpvHum: (mag) => audio.playDpvHum(mag),
  onHullGroan: (depthRatio) => audio.playHullGroan(depthRatio),
  onHatchCrank: (progress) => audio.playHatchCrank(progress),
  onHatchOpen: () => audio.playHatchOpen(),
  onLineCut: () => audio.playLineCut(),
  onClipLine: (clipped) => audio.playClipLine(clipped),
  onStageRefill: () => audio.playGasShare(),
  onMarkerPlaced: () => audio.playClipLine(true),
  onEncounterSpawn: (visitor) => audio.playEncounterChime(visitor?.kind || 'whaleshark'),
  onBeaconClaimed: () => audio.playEncounterChime('beacon'),
  onBuddyPing: () => audio.playEncounterChime('buddy-ping'),
  onMaskPurge: () => {
    audio.playMaskPurge();
    audio.playDrillClear();
  },
  onFreeFlowHiss: () => audio.playFreeFlowHiss(),
  onDrillClear: () => audio.playDrillClear(),
  onWreckSync: (actionKind, targetId) => {
    if (isMultiplayer) lan.sendWreckAction(actionKind, targetId);
  },
  onCheckpoint: (cp) => {
    audio.playCheckpoint();
    showToast(`✓ ${cp.name} — ${cp.hint}`, 3.5);
    if (isMultiplayer) lan.sendCheckpoint(cp.id);
  },
  onCollect: (item) => {
    audio.playCollect();
    showToast(`💎 Collected ${item.name} (+${item.points} pts)!`, 2.6);
    if (isMultiplayer) lan.sendCollectible(item.id);
  },
  onBodyRecovered: (rt) => {
    audio.playRecovery();
    showToast(`🛟 Secured ${rt.name}! Tow carefully back through deep deco to the surface!`, 4.2);
    if (isMultiplayer) lan.sendBodyRecovered();
  },
  onSiltSpawn: (plume) => {
    if (isMultiplayer) lan.sendSiltEvent(plume);
  },
  onGuidelineSync: (chains) => {
    if (isMultiplayer && session) lan.sendGuidelineSync(chains, session.reelingActive);
  },
};

function stepSimulation(dt) {
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0 && gameToastEl) {
      gameToastEl.classList.remove('visible');
    }
  }

  const activeTimeSec = mode === 'diving' && session ? session.simTimeSec : menuTimeSec;
  if (ecosystem && renderer.ready && renderer.level?.id === activeLevel.id) {
    stepMarineEcosystem(ecosystem, mode === 'diving' ? session?.diver : null, dt, activeTimeSec, activeLevel);
  }

  if (celebrationParticles.length > 0) {
    for (let i = celebrationParticles.length - 1; i >= 0; i--) {
      const p = celebrationParticles[i];
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vRot * dt;
      p.life -= dt;
      if (p.life <= 0 || p.y > 1.1 || p.y < -0.1) celebrationParticles.splice(i, 1);
    }
  }

  if (mode !== 'diving' || !session) return;
  if (divePaused && !isMultiplayer) return;

  const { diver, diveState, checkpointsHit, level } = session;
  let result = {
    nextCheckpoint: level.checkpoints.find((cp) => !checkpointsHit.has(cp.id)) || null,
    blockedExitDecoDepthM: 0,
    outcome: null,
  };

  if (!session.endedState) {
    // Continuous hold-[R] guideline rewind
    if (input.isRewindHeld() && !session.reelingActive && session.reelMaxMeters > 0) {
      rewindHoldTimer += dt;
      if (rewindHoldTimer >= 0.28) {
        rewindHoldTimer = 0;
        const rw = rewindGuidelineSegment(session);
        if (rw.action === 'rewound') {
          audio.playReelClick();
          if (isMultiplayer) lan.sendGuidelineSync(session.guidelineChains, false);
        }
      }
    } else {
      rewindHoldTimer = 0;
    }
    sessionStepCallbacks.peers = isMultiplayer ? lan.getPeers() : null;
    sessionStepCallbacks.torchAim = input.getTorchAim();
    const wasSubmerged = session._wasSubmerged ?? diver.y > 0.75;
    result = stepDiveSession(session, input.getThrust(), dt, sessionStepCallbacks);
    // Hysteresis band (0.55m / 0.95m) prevents breathing buoyancy bob from re-triggering splash
    const nowSubmerged = wasSubmerged ? diver.y > 0.55 : diver.y > 0.95;
    if (nowSubmerged !== wasSubmerged && session.simTimeSec > 0.35) {
      audio.playSplash(nowSubmerged);
    }
    session._wasSubmerged = nowSubmerged;
    audio.setEnvironmentFilter(diveState.depthM, diveState.narcosisLevel);
    if (diveState.alive) {
      audio.stepAmbience(dt, level, diver.y, diver);
    }
    syncWreckActionHud(session.wreckActionPrompt);
    syncTechGearHud(session);
  } else {
    session.simTimeSec += dt;
    diver.vx = 0;
    diver.vy = 0;
    syncWreckActionHud(null);
    syncTechGearHud(session);
  }

  const peers = isMultiplayer ? lan.getPeers() : [];
  if (coopCommsEl && mode === 'diving') {
    coopCommsEl.hidden = !(isMultiplayer && peers.length > 0);
  }
  if (isMultiplayer) {
    // Share cave exploration coverage across buddies only when they move >= 1.2m (avoids 60Hz O(cells) scans)
    if (session.exploreCells && session.exploredCells) {
      for (const p of peers) {
        if (!p || p.surfaced || p.alive === false) continue;
        if (p._lastExploreX !== undefined && Math.hypot(p.x - p._lastExploreX, p.y - p._lastExploreY) < 1.2) {
          continue;
        }
        p._lastExploreX = p.x;
        p._lastExploreY = p.y;
        if (markExploredAround(session.exploreCells, session.exploredCells, p.x, p.y, 4.4, session.exploredGrid) > 0) {
          session.exploredPct = Math.round(
            (session.exploredCells.size / Math.max(1, session.exploreCells.length)) * 100
          );
        }
      }
    }
    if (lan.shouldSendPlayerState()) {
      lan.sendPlayerState(buildPlayerStatePayload(session));
    }
    lan.stepPeerInterpolation(dt, level);
    stepPeerBubbles(session.bubbles, peers, dt);
    recordPeerDepthProfiles(session, peers, session.simTimeSec);

    // If downed and a rescuer is towing us, glide smoothly behind the rescuer (respecting cave rock SDF)
    if (!diveState.alive && session.rescuedBy) {
      const rescuer = peers.find((p) => p && (p.id === session.rescuedBy || p.rescueTargetId === lan.clientId));
      if (!rescuer || rescuer.alive === false) {
        session.rescuedBy = '';
        session.diver.rescuedBy = '';
      } else {
        const ang = rescuer.angle || 0;
        const tx = rescuer.x - Math.cos(ang) * 1.55;
        const ty = rescuer.y - Math.sin(ang) * 1.55;
        const nextX = diver.x + (tx - diver.x) * Math.min(1, dt * 8);
        const nextY = diver.y + (ty - diver.y) * Math.min(1, dt * 8);
        const towProbe = { x: nextX, y: nextY, vx: 0, vy: 0 };
        resolveDiverCollision(level, towProbe, 0.55);
        diver.x = towProbe.x;
        diver.y = towProbe.y;
        diver.angle = ang;
        if (rescuer.surfaced && !session.rescued) {
          session.rescued = true;
          session.surfaced = true;
          finishDiveRun(
            true,
            `Rescued by ${rescuer.name || 'Buddy'}!`,
            `${rescuer.name || 'Your buddy'} towed you safely back through the cave to the surface exit.`
          );
          return;
        }
      }
    }
    // Clear stale rescuedBy flags on peers whose rescuer died or dropped tow
    for (const p of peers) {
      if (!p || !p.rescuedBy || p.rescued) continue;
      if (p.rescuedBy === lan.clientId) {
        if (!diveState.alive || session.rescueTargetId !== p.id) p.rescuedBy = '';
      } else {
        const otherRescuer = peers.find((r) => r && r.id === p.rescuedBy);
        if (!otherRescuer || otherRescuer.alive === false) p.rescuedBy = '';
      }
    }
  }

  if (btnDropTow) {
    btnDropTow.hidden = !(isMultiplayer && diveState.alive && !session.endedState && session.rescueTargetId);
  }

  if (btnTowBuddy) {
    let downedPeer = null;
    if (isMultiplayer && diveState.alive && !session.endedState && !session.rescueTargetId) {
      let bestDist = 3.6;
      for (const p of peers) {
        if (!p || p.alive !== false || p.rescued || p.rescuedBy) continue;
        const d = Math.hypot(p.x - diver.x, p.y - diver.y);
        if (d <= 1.45) {
          attachBuddyTow(p);
          downedPeer = null;
          break;
        }
        if (d <= bestDist) {
          bestDist = d;
          downedPeer = p;
        }
      }
    }
    if (downedPeer) {
      btnTowBuddy.hidden = false;
      btnTowBuddy.dataset.targetId = downedPeer.id || '';
    } else {
      btnTowBuddy.hidden = true;
    }
  }

  if (btnShareGas) {
    let needyPeer = null;
    let shareCand = null;
    if (isMultiplayer && diveState.alive && !session.endedState) {
      let bestDist = 3.6;
      for (const p of peers) {
        if (!p || p.alive === false || p.surfaced) continue;
        const d = Math.hypot(p.x - diver.x, p.y - diver.y);
        const lowGas = (p.activeBar ?? 200) < 95 || p.condition === 'NO GAS' || p.condition === 'LOW GAS';
        if (lowGas && d <= bestDist) {
          const cand = getShareableGasCandidate(diveState, p.gasId || diveState.activeGasId, 25, diveState.depthM);
          if (cand) {
            bestDist = d;
            needyPeer = p;
            shareCand = cand;
          }
        }
      }
    }
    if (needyPeer && shareCand) {
      btnShareGas.hidden = false;
      btnShareGas.dataset.targetId = needyPeer.id || '';
      btnShareGas.dataset.targetGas = shareCand.gasId;
      btnShareGas.dataset.targetName = needyPeer.name || 'Buddy';
      btnShareGas.textContent = `🎁 +${shareCand.donatedBar}b ${shareCand.gasName}`;
    } else {
      btnShareGas.hidden = true;
    }
  }

  _minimapPlayerLines.length = 0;
  if (session.guidelineChains?.length > 0) {
    _minimapPlayerLines.push({
      isSelf: true,
      chains: session.guidelineChains,
      reelingActive: session.reelingActive,
      ownerX: diver.x,
      ownerY: diver.y,
    });
  }
  if (isMultiplayer) {
    for (let i = 0; i < peers.length; i++) {
      const p = peers[i];
      const chains = p.guidelineChains || session.restoredPeerLines?.get(p.id);
      if (chains && chains.length > 0) {
        _minimapPlayerLines.push({
          isSelf: false,
          chains,
          reelingActive: Boolean(p.reelingActive),
          ownerX: p.x,
          ownerY: p.y,
        });
      }
    }
  }

  if (shearwaterOpen && shearwaterCanvasEl) {
    const shearNowMs = performance.now();
    if (shearNowMs - lastShearwaterDrawMs >= 140) {
      lastShearwaterDrawMs = shearNowMs;
      const sctx = shearwaterCanvasEl.getContext('2d');
      if (sctx) drawShearwaterComputer(sctx, shearwaterCanvasEl.width, shearwaterCanvasEl.height, diveState);
    }
  }

  hud.update({
    diveState,
    diver,
    nextCheckpoint: result.nextCheckpoint,
    exitZone: level.exitZone,
    checkpointsHit,
    totalCheckpoints: level.checkpoints.length,
    collectedCount: session.collectedIds?.size || 0,
    collectiblesTotal: (level.collectibles || []).length,
    exploredPct: session.exploredPct || 0,
    bodyRecovered: Boolean(session.bodyRecovered),
    carryingBody: Boolean(session.carryingBody),
    peers,
    playerName: diver.name || '',
    level,
    ascentConfig: session.ascentConfig,
    reelMaxMeters: session.reelMaxMeters || 0,
    reelRemainingM: getEffectiveReelRemainingM(session),
    reelingActive: Boolean(session.reelingActive),
    difficulty: session.difficulty || activeDifficulty,
    mutatorId: session.mutatorId || '',
    dailyMutatorLabel: session._dailyBadgeLabel || '',
    minimapVisible,
    minimapZoomMode,
    exploreCells: session.exploreCells,
    exploredCells: session.exploredCells,
    exploredGrid: session.exploredGrid,
    collectedIds: session.collectedIds,
    openedHatchIds: session.openedHatchIds,
    claimedStageIds: session.claimedStageIds,
    placedMarkerIds: session.placedMarkerIds,
    playerLines: _minimapPlayerLines,
    sonarPulse: session.sonar?.activePulse || null,
    encounters: session.encounters || null,
    buddyPing: session.buddyPing || null,
    droppedStages: session.droppedStages || null,
    endedState: session.endedState || '',
    spectatingPeer: Boolean(spectatingPeer),
    timeSec: session.simTimeSec,
    dt,
  });

  if (result.blockedExitDecoDepthM > 0) {
    showToast(`Hold at ${result.blockedExitDecoDepthM}m to clear deco stop before surfacing!`, 2.0);
  }

  if (result.outcome && !session.endedState) {
    if (result.outcome.success) {
      audio.playSplash(false);
    }
    if (result.outcome.success && isMultiplayer && session.rescueTargetId) {
      const towed = peers.find((p) => p && p.id === session.rescueTargetId);
      if (towed) {
        towed.rescued = true;
        lan.sendBuddyRescue(towed.id, towed.name || 'Buddy', 'extracted');
        result.outcome.title = `Buddy Rescued · ${level.name}!`;
        result.outcome.detail = `You hauled ${towed.name || 'your buddy'} through the cave to the surface exit (+450 Rescue Bonus)!`;
      }
    }
    session.localOutcome = result.outcome;
    const pendingPeers = isMultiplayer
      ? peers.filter((p) => p.alive !== false && !p.surfaced)
      : [];

    if (!isMultiplayer || pendingPeers.length === 0) {
      finishDiveRun(
        result.outcome.success,
        result.outcome.title,
        result.outcome.detail,
        result.outcome.scoreSummary
      );
      return;
    }

    // Wait cleanly on surface / spectate while teammates finish or fall
    session.endedState = result.outcome.success ? 'surfaced' : 'down';
    session.surfaced = Boolean(result.outcome.success);
    input?.resetAll?.();
    screenHud.classList.add('hud-team-hold');
    audio.resetEnvironmentFilter();
    lan.sendPlayerState(
      buildPlayerStatePayload(session, {
        vx: 0,
        vy: 0,
        condition: diveState.alive ? 'NOMINAL' : 'DOWN',
        surfaced: Boolean(result.outcome.success),
      }),
      { force: true }
    );
    if (!result.outcome.success) {
      spectatingPeer = true;
    }
    const leadPeer = pendingPeers[0];
    if (coopWaitBannerEl) {
      coopWaitBannerEl.hidden = false;
      coopWaitBannerEl.className = `coop-wait-banner ${result.outcome.success ? '' : 'down'}`;
      if (coopWaitTitleEl) {
        coopWaitTitleEl.textContent = result.outcome.success
          ? '✓ SURFACED SAFE · TEAM HOLD'
          : '✕ DIVER DOWN · SPECTATING CREW';
      }
      if (coopWaitDetailEl && leadPeer) {
        coopWaitDetailEl.textContent = `Waiting for ${leadPeer.name || 'Buddy'} (${(leadPeer.depthM ?? 0).toFixed(1)}m · ${Math.round(leadPeer.activeBar ?? 200)} bar)`;
      }
      if (btnCoopSpectate) {
        btnCoopSpectate.textContent = spectatingPeer ? 'My Diver' : 'Watch Buddy';
      }
    }
    if (result.outcome.success) {
      showToast(
        `✓ Surfaced safe! Waiting for ${leadPeer?.name || 'your buddy'} — tap Watch Buddy or Finish Now`,
        4.2
      );
    }
  } else if (session.endedState && isMultiplayer) {
    const activePeers = peers.filter((p) => p.alive !== false && !p.surfaced);
    if (activePeers.length === 0 && session.localOutcome) {
      const peersAllSurfaced = peers.length > 0 && peers.every((p) => p.alive !== false && p.surfaced);
      const outcomeTitle = peersAllSurfaced
        ? `Team Surfaced: ${level.name}!`
        : session.localOutcome.title;
      finishDiveRun(
        session.localOutcome.success,
        outcomeTitle,
        session.localOutcome.detail,
        session.localOutcome.scoreSummary
      );
      return;
    }
    if (coopWaitDetailEl && activePeers.length > 0) {
      const lead = activePeers[0];
      coopWaitDetailEl.textContent = `Waiting for ${lead.name || 'Buddy'} (${(lead.depthM ?? 0).toFixed(1)}m · ${Math.round(lead.activeBar ?? 200)} bar)`;
    }
  }
}

function frame(nowMs) {
  const dt = lastFrameMs ? Math.min(0.05, (nowMs - lastFrameMs) / 1000) : 0.016;
  lastFrameMs = nowMs;
  menuTimeSec = nowMs * 0.001;

  stepSimulation(dt);

  if (typeof document !== 'undefined' && document.hidden) {
    requestAnimationFrame(frame);
    return;
  }

  if ((mode === 'diving' || mode === 'debrief') && session) {
    if (mode === 'debrief') {
      session.simTimeSec += dt;
    }
    const nextCheckpoint =
      session.level.checkpoints.find((cp) => !session.checkpointsHit.has(cp.id)) || null;
    const peers = isMultiplayer ? lan.getPeers() : [];
    const activeSpectatePeers = spectatingPeer
      ? peers.filter((p) => p && p.alive !== false && !p.surfaced)
      : [];
    const spectateTarget =
      spectatingPeer && peers.length > 0
        ? activeSpectatePeers.length > 0
          ? activeSpectatePeers[spectatePeerIdx % activeSpectatePeers.length]
          : peers[0]
        : null;
    const playerLines = _framePlayerLines;
    playerLines.length = 0;
    if (session.guidelineChains?.length > 0) {
      playerLines.push({
        isSelf: true,
        chains: session.guidelineChains,
        reelingActive: session.reelingActive,
        ownerX: session.diver.x,
        ownerY: session.diver.y,
      });
    }
    if (isMultiplayer) {
      const handledIds = _frameHandledPeerIds;
      handledIds.clear();
      for (const p of peers) {
        handledIds.add(p.id);
        const chains = p.guidelineChains || session.restoredPeerLines?.get(p.id);
        if (chains && chains.length > 0) {
          playerLines.push({
            isSelf: false,
            chains,
            reelingActive: Boolean(p.reelingActive),
            ownerX: p.x,
            ownerY: p.y,
          });
        }
      }
      if (session.restoredPeerLines) {
        for (const [pid, chains] of session.restoredPeerLines.entries()) {
          if (!handledIds.has(pid) && chains?.length > 0) {
            playerLines.push({ isSelf: false, chains, reelingActive: false });
          }
        }
      }
    }
    renderer.render({
      diver: session.diver,
      diveState: session.diveState,
      cameraTarget: spectateTarget,
      peers,
      checkpointsHit: session.checkpointsHit,
      nextCheckpoint,
      playerLines,
      collectedIds: session.collectedIds,
      bodyRecovered: Boolean(session.bodyRecovered),
      carryingBody: Boolean(session.carryingBody),
      collectBursts: session.collectBursts,
      celebrationParticles,
      siltClouds: session.siltClouds,
      localSiltDensity: session.localSiltDensity,
      bubbles: session.bubbles,
      ecosystem,
      wreckState: {
        clippedToShotLine: session.clippedToShotLine,
        cutSnagIds: session.cutSnagIds,
        activeSnagIndex: session.activeSnagIndex,
        openedHatchIds: session.openedHatchIds,
        crankingHatchId: session.crankingHatchId,
        crankingHatchProgress: session.crankingHatchProgress,
        claimedStageIds: session.claimedStageIds,
        placedMarkerIds: session.placedMarkerIds,
      },
      ghostPose: (() => {
        if (!ghostEnabled || !activeGhostTrack) return null;
        const pose = sampleGhostPose(activeGhostTrack, session.simTimeSec);
        return pose ? { ...pose, isPar: activeGhostIsPar } : null;
      })(),
      sonarPulse: session.sonar?.activePulse || null,
      cameraFlash: session.camera?.activeFlash || null,
      encounters: session.encounters || null,
      bioWake: session.bioWake || null,
      surfaceRipples: session.surfaceRipples || null,
      buddyPing: session.buddyPing || null,
      airShareBeams: session.airShareBeams || null,
      droppedStages: session.droppedStages || null,
      drills: session.drills || null,
      endedState: session.endedState || '',
      difficulty: session.difficulty || activeDifficulty,
      mutatorId: session.mutatorId || '',
      timeSec: session.simTimeSec,
      dt,
    });
  } else if (renderer.ready && renderer.level?.id === activeLevel.id) {
    menuPreviewDiver.x = activeLevel.spawn.x + 7 + Math.sin(nowMs * 0.0003) * 4;
    menuPreviewDiver.y = Math.min(activeLevel.spawn.y + 6.5, 9);
    renderer.render({
      diver: menuPreviewDiver,
      diveState: MENU_PREVIEW_DIVE_STATE,
      peerDiver: null,
      checkpointsHit: EMPTY_SET,
      nextCheckpoint: activeLevel.checkpoints[0],
      siltClouds: EMPTY_ARR,
      bubbles: EMPTY_ARR,
      ecosystem,
      timeSec: menuTimeSec,
      dt,
    });
  } else {
    renderer.renderMenuBackdrop(activeLevel, menuTimeSec);
  }

  requestAnimationFrame(frame);
}

function setupPwaSupport() {
  const localVersion = parseInt(document.querySelector('meta[name="app-version"]')?.content || '61', 10) || 61;
  if (btnPwaUpdate) {
    btnPwaUpdate.textContent = `v${localVersion}`;
  }

  let swReg = null;
  let updateAvailable = false;
  let detectedRemoteVer = null;
  let applyingUpdate = false;
  let swReloading = false;
  let announcedDiveToast = false;
  let lastUpdateCheckAt = 0;

  const reloadApp = () => {
    if (swReloading) return;
    swReloading = true;
    location.reload();
  };

  const markUpdateAvailable = (nextVer = null) => {
    updateAvailable = true;
    if (nextVer && (!detectedRemoteVer || nextVer > detectedRemoteVer)) {
      detectedRemoteVer = nextVer;
    }
    const verLabel = detectedRemoteVer ? `v${detectedRemoteVer}` : 'new build';
    if (pwaUpdateText) {
      pwaUpdateText.textContent = `New version (${verLabel}) ready — tap Update to apply.`;
    }
    if (pwaUpdateBanner) {
      pwaUpdateBanner.hidden = false;
    }
    if (homeMenuUpdateDot) {
      homeMenuUpdateDot.hidden = false;
    }
    if (btnPwaUpdate && !applyingUpdate) {
      btnPwaUpdate.textContent = detectedRemoteVer ? `⬆ v${detectedRemoteVer}` : '⬆ Update';
      btnPwaUpdate.classList.add('has-update');
      btnPwaUpdate.title = `Update Techno Dive to ${verLabel}`;
    }
    if (mode === 'diving' && !announcedDiveToast) {
      announcedDiveToast = true;
      showToast(`⬆ Update (${verLabel}) ready — open Menu after surfacing to apply.`, 3.8);
    }
  };

  const watchedWorkers = new WeakSet();
  const watchInstallingWorker = (worker) => {
    if (!worker || watchedWorkers.has(worker)) return;
    watchedWorkers.add(worker);
    if (worker.state === 'installed' && navigator.serviceWorker?.controller) {
      markUpdateAvailable(detectedRemoteVer);
      return;
    }
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker?.controller) {
        markUpdateAvailable(detectedRemoteVer);
      }
    });
  };

  const fetchRemoteSwVersion = async () => {
    try {
      const res = await fetch(`./sw.js?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const text = await res.text();
      const m = text.match(/CACHE_VERSION\s*=\s*['"]cave-diver-v(\d+)['"]/);
      return m ? parseInt(m[1], 10) : null;
    } catch {
      return null;
    }
  };

  const checkForPwaUpdate = async ({ manual = false } = {}) => {
    if (applyingUpdate) return;
    if (manual && updateAvailable) {
      applyPwaUpdate();
      return;
    }
    const now = Date.now();
    if (!manual && now - lastUpdateCheckAt < 15000) return;
    lastUpdateCheckAt = now;

    if (manual && btnPwaUpdate) {
      btnPwaUpdate.disabled = true;
      btnPwaUpdate.textContent = '↻ ...';
    }
    try {
      const [regRes, remoteVer] = await Promise.all([
        'serviceWorker' in navigator
          ? (swReg || (await navigator.serviceWorker.getRegistration('./').catch(() => null)))
          : Promise.resolve(null),
        fetchRemoteSwVersion(),
      ]);
      if (regRes) {
        swReg = regRes;
        await regRes.update().catch(() => {});
      }
      if (regRes?.installing) {
        watchInstallingWorker(regRes.installing);
      }
      if (remoteVer && remoteVer > localVersion) {
        markUpdateAvailable(remoteVer);
        if (manual) {
          showToast(`⬆ Techno Dive v${remoteVer} is ready — tap Update Now!`, 3.2);
        }
        return;
      }
      if (regRes?.waiting) {
        markUpdateAvailable(remoteVer);
        if (manual) {
          showToast('⬆ New update is ready — tap Update Now!', 3.2);
        }
        return;
      }
      if (manual) {
        showToast(`✓ Techno Dive v${localVersion} is up to date!`, 2.4);
      }
    } finally {
      if (manual && btnPwaUpdate && !applyingUpdate) {
        btnPwaUpdate.disabled = false;
        if (!updateAvailable) {
          btnPwaUpdate.textContent = `v${localVersion}`;
        }
      }
    }
  };

  const applyPwaUpdate = async () => {
    if (applyingUpdate) return;
    applyingUpdate = true;
    if (btnApplyPwaUpdate) {
      btnApplyPwaUpdate.disabled = true;
      btnApplyPwaUpdate.textContent = 'Updating...';
    }
    if (btnPwaUpdate) {
      btnPwaUpdate.disabled = true;
      btnPwaUpdate.textContent = 'Updating...';
    }
    setTimeout(reloadApp, 4500);

    if ('serviceWorker' in navigator) {
      try {
        const reg = swReg || (await navigator.serviceWorker.getRegistration('./'));
        if (reg) {
          await reg.update().catch(() => {});
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            return;
          }
          if (reg.installing) {
            await new Promise((resolve) => {
              const w = reg.installing;
              const tm = setTimeout(resolve, 3200);
              w.addEventListener('statechange', () => {
                if (w.state === 'installed' || w.state === 'redundant') {
                  clearTimeout(tm);
                  resolve();
                }
              });
            });
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              return;
            }
          }
        }
      } catch {}
    }

    // Never wipe offline caches destructively; let the new SW activate cleanly on reload
    reloadApp();
  };

  btnPwaUpdate?.addEventListener('click', () => checkForPwaUpdate({ manual: true }));
  btnApplyPwaUpdate?.addEventListener('click', applyPwaUpdate);

  if ('serviceWorker' in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      if (applyingUpdate || (mode === 'menu' && !lan.room && !joiningRoomCode && !INITIAL_ROOM_CODE && !document.hidden)) {
        reloadApp();
      } else {
        markUpdateAvailable(detectedRemoteVer);
      }
    });
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        swReg = reg;
        if (reg.waiting) markUpdateAvailable(detectedRemoteVer);
        if (reg.installing) watchInstallingWorker(reg.installing);
        reg.addEventListener('updatefound', () => watchInstallingWorker(reg.installing));
        checkForPwaUpdate({ manual: false });
      })
      .catch(() => {
        checkForPwaUpdate({ manual: false });
      });
  } else {
    checkForPwaUpdate({ manual: false });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForPwaUpdate({ manual: false });
  });
  window.addEventListener('pageshow', () => checkForPwaUpdate({ manual: false }));
  window.addEventListener('focus', () => checkForPwaUpdate({ manual: false }));
  window.addEventListener('online', () => checkForPwaUpdate({ manual: false }));
  setInterval(() => {
    if (!document.hidden) checkForPwaUpdate({ manual: false });
  }, 5 * 60 * 1000);

  let screenWakeLock = null;
  const syncWakeLock = async () => {
    const shouldHold = !document.hidden && (mode === 'diving' || Boolean(lan.room));
    if (shouldHold && 'wakeLock' in navigator && !screenWakeLock) {
      try {
        screenWakeLock = await navigator.wakeLock.request('screen');
        screenWakeLock.addEventListener('release', () => {
          screenWakeLock = null;
        });
      } catch {}
    } else if (!shouldHold && screenWakeLock) {
      try { await screenWakeLock.release(); } catch {}
      screenWakeLock = null;
    }
  };
  syncWakeLockFn = syncWakeLock;
  document.addEventListener('visibilitychange', syncWakeLock);
  window.addEventListener('focus', syncWakeLock);
  lan.on('room_update', syncWakeLock);
  syncWakeLock();

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true;
  if (isStandalone) {
    if (btnInstallPwa) btnInstallPwa.hidden = true;
    return;
  }

  let deferredInstallPrompt = null;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  if (btnInstallPwa && isIos) {
    btnInstallPwa.hidden = false;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (btnInstallPwa) btnInstallPwa.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (btnInstallPwa) btnInstallPwa.hidden = true;
    showToast('Techno Dive installed to Home Screen!', 3.0);
  });

  btnInstallPwa?.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch {}
      deferredInstallPrompt = null;
      btnInstallPwa.hidden = true;
      return;
    }
    if (isIos) {
      showToast('On iPhone/iPad: tap Share (↑) → "Add to Home Screen"', 4.5);
    } else {
      showToast('Open browser menu (⋮) → "Install app" or "Add to Home Screen"', 4.0);
    }
  });
}

async function bootGame() {
  populateLevelSelect();
  renderLevelCards();
  renderDailyChallengeCard();
  renderTechGearDock();
  setupPwaSupport();

  const incomingChallenge = parseChallengeFromSearch(location.search, {
    validLevelIds: LEVELS.map((l) => l.id),
    validMutatorIds: DAILY_MUTATORS.map((m) => m.id),
  });
  const incomingProc = parseProceduralFromSearch(location.search);
  if (incomingChallenge && !INITIAL_ROOM_CODE) {
    applyIncomingChallenge(incomingChallenge).catch(() => {});
  } else if (incomingProc && !INITIAL_ROOM_CODE) {
    draftProcedural = {
      seed: incomingProc.seed,
      tier: incomingProc.tier,
      biome: incomingProc.biome,
      unlined: incomingProc.unlined,
    };
    applyProceduralLevelToMenu(draftProcedural, { launchImmediately: false }).catch(() => {});
    try {
      history.replaceState(null, '', `${location.origin}${location.pathname}`);
    } catch {}
  }
  if (INITIAL_ROOM_CODE) {
    beginRoomJoinLoading(INITIAL_ROOM_CODE, {
      directDive: true,
      statusText: `Connecting to Room ${INITIAL_ROOM_CODE}...`,
    });
  } else {
    screenLoader.classList.add('done');
  }
  btnPlaySolo.disabled = false;

  // Keep socket & room session alive seamlessly across mobile app-switching and tab navigation
  const syncWhenReady = () => {
    lan.ensureConnected();
    leaderboard.syncPendingLocalRuns().then((uploaded) => {
      if (uploaded > 0 && leaderboardPanel && !leaderboardPanel.hidden) {
        refreshMenuLeaderboard();
      }
    }).catch(() => {});
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncWhenReady();
  });
  window.addEventListener('pageshow', () => lan.ensureConnected());
  window.addEventListener('focus', () => lan.ensureConnected());
  window.addEventListener('online', syncWhenReady);

  // Clear stale session from a different room before connecting to URL invite room
  let savedSession = lan.getSavedSession();
  if (INITIAL_ROOM_CODE && savedSession && savedSession.code !== INITIAL_ROOM_CODE) {
    lan.clearSavedSession();
    savedSession = null;
  }
  if (savedSession && savedSession.code === INITIAL_ROOM_CODE && savedSession.isHost) {
    directJoinToDive = false;
  }

  // Connect cleanly & backfill any prior local dive records to global Vercel Blob storage
  lan.connect();
  fetchLanUrls();
  leaderboard.syncPendingLocalRuns().catch(() => {});

  if (savedSession && !INITIAL_ROOM_CODE) {
    pendingAutoJoinCode = savedSession.code;
    attemptJoinAfterExpire = '';
    setActiveMenuTab('solo');
    if (roomCodeInput) roomCodeInput.value = savedSession.code;
    if (lanStatus) {
      lanStatus.hidden = false;
      lanStatus.className = 'lan-status';
      lanStatus.textContent = `Reconnecting to room ${savedSession.code}...`;
    }
  } else if (savedSession && savedSession.code === INITIAL_ROOM_CODE && savedSession.isHost) {
    pendingAutoJoinCode = savedSession.code;
    attemptJoinAfterExpire = INITIAL_ROOM_CODE;
    if (roomCodeInput) roomCodeInput.value = savedSession.code;
  } else if (INITIAL_ROOM_CODE) {
    pendingAutoJoinCode = INITIAL_ROOM_CODE;
    if (roomCodeInput) roomCodeInput.value = INITIAL_ROOM_CODE;
    const savedCallsign = getEnteredCallsign();
    const rejoinToken = savedSession?.code === INITIAL_ROOM_CODE ? savedSession.reconnectToken : '';
    if (savedCallsign) {
      lanStatus.className = 'lan-status';
      lanStatus.textContent = `Auto-joining room ${INITIAL_ROOM_CODE}...`;
      lan.joinRoom(INITIAL_ROOM_CODE, savedCallsign, { reconnectToken: rejoinToken });
    } else if (loaderCallsignGateEl && loaderCallsignInput && btnLoaderJoin) {
      setLoaderProgress(18, `Room ${INITIAL_ROOM_CODE} ready`);
      if (loaderCrewStatusEl) {
        loaderCrewStatusEl.textContent = `Enter a callsign (1–${CALLSIGN_MAX_LEN} chars) to join Room ${INITIAL_ROOM_CODE}`;
      }
      loaderCallsignGateEl.hidden = false;
      loaderCallsignInput.focus();
      const submitGateJoin = () => {
        const clean = sanitizeCallsignInput(loaderCallsignInput.value);
        if (!clean) {
          loaderCallsignInput.classList.add('invalid');
          loaderCallsignInput.focus();
          showToast(`Enter a callsign (1–${CALLSIGN_MAX_LEN} chars) first!`, 2.6);
          return;
        }
        loaderCallsignInput.classList.remove('invalid');
        loaderCallsignGateEl.hidden = true;
        if (playerNameInput) {
          playerNameInput.value = clean;
          syncCallsignCount();
        }
        try {
          localStorage.setItem('caveDiverCallsign', clean);
        } catch {}
        setLoaderProgress(28, `Joining Room ${INITIAL_ROOM_CODE}...`);
        if (loaderCrewStatusEl) {
          loaderCrewStatusEl.textContent = `Connecting to Room ${INITIAL_ROOM_CODE} as ${clean}...`;
        }
        lan.joinRoom(INITIAL_ROOM_CODE, clean, { reconnectToken: rejoinToken });
      };
      btnLoaderJoin.addEventListener('click', submitGateJoin);
      loaderCallsignInput.addEventListener('input', () => {
        if (loaderCallsignInput.value.length > CALLSIGN_MAX_LEN) {
          loaderCallsignInput.value = loaderCallsignInput.value.slice(0, CALLSIGN_MAX_LEN);
        }
        loaderCallsignInput.classList.remove('invalid');
      });
      loaderCallsignInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitGateJoin();
        }
      });
    }
  }

  initGitHubAuth();
  requestAnimationFrame(frame);
}

bootGame();
