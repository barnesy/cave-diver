import {
  LEVELS,
  DEFAULT_LEVEL_ID,
  getLevelById,
  getLevelMeta,
  getLevelMaxDepthM,
  parseProceduralFromSearch,
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
import { escapeHtml } from './util/common.js';
import { createPerfMonitor } from './game/perfMonitor.js';
import { createModalManager } from './ui/modalManager.js';
import { renderDebriefDepthChart } from './ui/debriefChart.js';
import { createReplayTheaterController } from './ui/replayController.js';
import { createGasPlannerController } from './ui/gasPlannerController.js';
import { createLeaderboardController } from './ui/leaderboardController.js';
import { createSiteBrowserController, retriggerAnim } from './ui/siteBrowserController.js';
import { createLiveryWorkshopController } from './ui/liveryWorkshopController.js';
import { createLogbookModalController } from './ui/logbookModalController.js';
import { createSandboxAndProceduralController } from './ui/sandboxAndProceduralController.js';
import { createGitHubSyncController } from './ui/githubSyncController.js';
import { createRescueDrillsController } from './ui/rescueDrillsController.js';
import { applyRescueDrillScenario, evaluateRescueDrillResult } from './game/rescueDrills.js';
import {
  createEmptyLogbook,
  recordDiveInLogbook,
  seedLogbookFromEntries,
  computeCertifications,
  TECH_GEAR_CATALOG,
  computeUnlockedGear,
  sanitizeGearLoadout,
  DAILY_MUTATORS,
  getDailyMutatorById,
  getDailyMutatorForDate,
  getUtcDateKey,
  buildDailyCalendarMonth,
  recordDailyClear,
  getDailyStatus,
  recordFieldGuidePhoto,
  recordLoreDiscoveryInLogbook,
  recordCampaignClearInLogbook,
  recordRescueDrillClearInLogbook,
  recordCrewDiveInLogbook,
  recordArtifactInLogbook,
  getArtifactVaultStats,
  getFieldGuideStats,
} from './game/logbookModel.js';
import { drawStyledArtifact } from './game/artSprites.js';
import { renderSurveySlate } from './game/surveySlate.js';
import { formatReplayTime } from './game/diveCard.js';
import {
  getCrewRole,
  cycleCrewRoleId,
  computeGhostCheckpointSplits,
  formatSplitDelta,
} from './game/expeditionContracts.js';
import {
  EXPEDITION_CAMPAIGNS,
  SURFACE_INTERVAL_OPTIONS,
  getExpeditionCampaignById,
  createCampaignRunState,
  computeResidualTissueLoadPct,
  computeSurfaceIntervalOffgas,
  applyResidualTissuesToDiveState,
} from './game/expeditionCampaigns.js';
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
  toggleLiftBag,
  dropLineCookie,
  deploySurfaceMarkerBuoy,
  WILDLIFE_HARMONY_BONUS_PTS,
  recordDiveHighlight,
  resolveEmergencyDrill,
  recordGasSwitchFx,
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
import { CaveRenderer } from './game/renderer.js';
import { createMarineEcosystem, stepMarineEcosystem } from './game/marineLife.js';
import { spawnSiltPlume } from './game/silt.js';
import { DiveComputerHUD, isMinimapAllowed, drawShearwaterComputer } from './game/hud.js';
import { SCUBA_SIGNALS, triggerDiverSignal } from './game/diveSignals.js';
import {
  AI_SQUAD_ROSTER,
  getAiDifficultyProfile,
  createAiSquad,
  stepAiSquad,
  handlePlayerSignalForAiSquad,
  receiveGasForAiBuddy,
  assistHardcoreBuddyIssue,
  updateTowedAiBuddy,
} from './game/aiBuddy.js';
import { WEATHER_CYCLE_ORDER, resolveEffectiveWeather } from './game/weather.js';
import {
  DEFAULT_RIG_LIVERY,
  getSuitLivery,
  getTorchOptic,
  getMilestonePatch,
  isDefaultRigLivery,
} from './game/rigLivery.js';
import { getCollectibleLoreNote } from './game/submergedStories.js';
import {
  PHOTO_FILTERS,
  PHOTO_FRAMES,
  createPhotoModeState,
  clampPhotoModeState,
  getPhotoFrame,
  renderPhotoSnapshot,
} from './game/photoStudio.js';
import { InputController } from './game/input.js';
import { DiveAudio, computeSpatialMix } from './game/audio.js';
import { LanClient } from './net/lanClient.js';
import { LeaderboardClient } from './net/leaderboardClient.js';
import { GitHubClient } from './net/githubClient.js';

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

// Career Logbook storage helpers (initialized early so startup Gear Workshop & Tech Gear unlocks never hit TDZ)
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

const toastQueue = [];
function showToast(text, duration = 2.6) {
  if (!gameToastEl || !text) return;
  if (toastTimer > 0 && gameToastEl.classList.contains('visible')) {
    if (gameToastEl.textContent === text) {
      toastTimer = Math.max(toastTimer, duration);
      return;
    }
    if (toastQueue.length > 0 && toastQueue[toastQueue.length - 1].text === text) {
      toastQueue[toastQueue.length - 1].duration = Math.max(toastQueue[toastQueue.length - 1].duration, duration);
      return;
    }
    if (toastQueue.length >= 3) toastQueue.shift();
    toastQueue.push({ text, duration });
    return;
  }
  gameToastEl.textContent = text;
  gameToastEl.classList.add('visible');
  toastTimer = duration;
}

function getActiveGasName(gasId, diveState = session?.diveState) {
  const mixMap = diveState?.mixes || GAS_MIXES;
  return mixMap[gasId]?.name || GAS_MIXES[gasId]?.name || gasId || 'Gas';
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

// ── Site Browser, Global Dive Map SVG & Level Cards Controller (modularized v172) ──
const siteBrowser = createSiteBrowserController({
  lan,
  renderer,
  loadCareerLogbook,
  getActiveLevel: () => activeLevel,
  getSavedBestScore,
  getLevelDifficultyLabel,
  renderModeBadgeHtml: (...a) => renderModeBadgeHtml(...a),
  formatRunClock: (...a) => formatRunClock(...a),
  mapRasterUrl: './assets/map-expedition.jpg?v=177',
  els: {
    siteWorldMapEl,
    btnMapZoom,
    siteCatTabsEl,
    siteMapRegionBadgeEl,
    siteMapCoordsEl,
    levelCardsEl,
    selectLevel,
    btnPlaySolo,
    screenMenu,
    screenLoader,
    menuDescEl,
    btnDescToggle,
  },
});
const {
  setSiteCategoryFilter,
  getFilteredLevels,
  renderSiteWorldMap,
  renderLevelCards,
  syncMenuDescToggle,
  syncMenuLevelLabels,
  populateLevelSelect,
} = siteBrowser;

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
  if (photoModeState.active) setPhotoModeActive(false);
  const hasHumanPeers = Boolean(isMultiplayer && lan.getPeers().length > 0);
  const next = Boolean(paused) && mode === 'diving' && !hasHumanPeers && Boolean(session && !session.endedState);
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
      recordGasSwitchFx(session, gasId);
      showToast(`Switched regulator to ${getActiveGasName(gasId)}`, 1.8);
    }
    return true;
  }
  showToast(`${getActiveGasName(gasId)} cylinder empty!`, 1.8);
  return false;
}

function getActivePeers() {
  if (isMultiplayer) {
    const humanPeers = lan.getPeers();
    if (humanPeers && humanPeers.length > 0) return humanPeers;
  }
  if (Array.isArray(session?.aiSquad) && session.aiSquad.length > 0) return session.aiSquad;
  return session?.aiBuddy ? [session.aiBuddy] : [];
}

function handleBuddyLocatePing(targetPeerId = '') {
  if (mode !== 'diving' || !session) return false;
  const peers = getActivePeers();
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

// Centralized stack-ordered overlay/modal manager & focus restoration (v144 module)
const modalManager = createModalManager([
  { isOpen: () => photoModeState.active, close: () => setPhotoModeActive(false) },
  { isOpen: () => typeof fgCardModalEl !== 'undefined' && fgCardModalEl && !fgCardModalEl.hidden, close: () => closeFieldGuideCardModal() },
  { isOpen: () => typeof artifactInspectorModalEl !== 'undefined' && artifactInspectorModalEl && !artifactInspectorModalEl.hidden, close: () => closeArtifactInspector() },
  { isOpen: () => typeof replayModal !== 'undefined' && replayModal && !replayModal.hidden, close: () => closeReplayModal() },
  { isOpen: () => typeof lbStatsModalEl !== 'undefined' && lbStatsModalEl && !lbStatsModalEl.hidden, close: () => closeLeaderboardStatsModal() },
  { isOpen: () => typeof liveryModalEl !== 'undefined' && liveryModalEl && !liveryModalEl.hidden, close: () => closeLiveryModal() },
  { isOpen: () => typeof gasPlannerModal !== 'undefined' && gasPlannerModal && !gasPlannerModal.hidden, close: () => closeGasPlannerModal() },
  { isOpen: () => typeof challengeModal !== 'undefined' && challengeModal && !challengeModal.hidden, close: () => closeChallengeModal() },
  { isOpen: () => typeof proceduralModal !== 'undefined' && proceduralModal && !proceduralModal.hidden, close: () => closeProceduralModal() },
  { isOpen: () => typeof campaignsModal !== 'undefined' && campaignsModal && !campaignsModal.hidden, close: () => closeCampaignsModal() },
  { isOpen: () => typeof drillsModal !== 'undefined' && drillsModal && !drillsModal.hidden, close: () => closeDrillsModal() },
  { isOpen: () => typeof dailyCalModalEl !== 'undefined' && dailyCalModalEl && !dailyCalModalEl.hidden, close: () => closeDailyCalendarModal() },
  { isOpen: () => typeof audioMixerModalEl !== 'undefined' && audioMixerModalEl && !audioMixerModalEl.hidden, close: () => closeAudioMixerModal() },
  { isOpen: () => typeof modalIssue !== 'undefined' && modalIssue && !modalIssue.hidden, close: () => closeIssueModal() },
  { isOpen: () => typeof modalDiveGuide !== 'undefined' && modalDiveGuide && !modalDiveGuide.hidden, close: () => closeDiveGuideModal(false) },
  { isOpen: () => typeof diveSetupModalEl !== 'undefined' && diveSetupModalEl && !diveSetupModalEl.hidden, close: () => closeDiveSetupModal() },
  { isOpen: () => typeof modalLogbook !== 'undefined' && modalLogbook && !modalLogbook.hidden, close: () => closeLogbookModal() },
  { isOpen: () => Boolean(signalWheelOpen), close: () => toggleSignalWheel(false) },
  { isOpen: () => Boolean(shearwaterOpen), close: () => toggleShearwaterComputer(false) },
  { isOpen: () => Boolean(surveySlateOpen), close: () => toggleSurveySlate(false) },
  { isOpen: () => typeof hudKitPopoverEl !== 'undefined' && hudKitPopoverEl && !hudKitPopoverEl.hidden, close: () => setKitPopoverOpen(false) },
  { isOpen: () => typeof hud !== 'undefined' && hud?.isGasDrawerOpen?.(), close: () => hud?.setGasDrawerOpen?.(false) },
  { isOpen: () => typeof hudMenuPopover !== 'undefined' && hudMenuPopover && !hudMenuPopover.hidden, close: () => setHudMenuOpen(false) },
  { isOpen: () => typeof homeMenuPopover !== 'undefined' && homeMenuPopover && !homeMenuPopover.hidden, close: () => setHomeMenuOpen(false) },
]);

function closeTopmostOverlay() {
  return modalManager.closeTopmost();
}

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
    if (closeTopmostOverlay()) return true;
    if (mode !== 'diving' || !session || session.endedState) return false;
    if (isMultiplayer && lan.getPeers().length > 0) {
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
  onCameraSnap: () => (photoModeState.active ? savePhotoStudioSnapshot() : handleCameraSnap()),
  onBuddyPing: () => handleBuddyLocatePing(''),
  onStageDrop: () => handleStageDrop(),
  onLiftBagToggle: () => handleLiftBagToggle(),
  onDropLineCookie: () => handleDropLineCookie(),
  onDeploySmb: () => handleDeploySmb(),
  onComputerToggle: () => toggleShearwaterComputer(),
  onSurveySlateToggle: () => toggleSurveySlate(),
  onSignalWheelToggle: () => toggleSignalWheel(),
  onPhotoModeToggle: () => {
    if (mode !== 'diving' || !session || session.endedState) return false;
    setPhotoModeActive(!photoModeState.active);
    return true;
  },
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
  if (Array.isArray(session.aiSquad) && session.aiSquad.length > 0 && (!isMultiplayer || lan.getPeers().length === 0)) {
    const aiRes = handlePlayerSignalForAiSquad(session.aiSquad, idOrText, session, performance.now());
    if (aiRes?.responded) {
      const leadAi = session.aiSquad[0];
      const mix = computeSpatialMix(session.diver.x, session.diver.y, leadAi.x, leadAi.y);
      if (aiRes.resolvedIssue) audio.playDrillClear?.();
      else audio.playSignal?.(mix.pan);
      showToast(aiRes.toast || `${leadAi.name}: 👌 Copy`, aiRes.resolvedIssue ? 3.8 : 2.6);
      toggleSignalWheel(false);
      return true;
    }
  }
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
  if (typeof setKitPopoverOpen === 'function') setKitPopoverOpen(false);
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
  if (shearwaterOpen && surveySlateOpen) {
    surveySlateOpen = false;
    if (surveySlatePanelEl) surveySlatePanelEl.hidden = true;
    btnHudSurveySlateEl?.classList.remove('active');
    btnMinimapSlateEl?.classList.remove('active');
  }
  if (shearwaterPanelEl) shearwaterPanelEl.hidden = !shearwaterOpen;
  if (btnHudComputerEl) btnHudComputerEl.classList.toggle('active', shearwaterOpen);
  if (shearwaterOpen && session?.diveState && shearwaterCanvasEl) {
    const sctx = shearwaterCanvasEl.getContext('2d');
    if (sctx) {
      drawShearwaterComputer(sctx, shearwaterCanvasEl.width, shearwaterCanvasEl.height, session.diveState, {
        waterTempC: session.hazards?.waterTempC,
        inThermocline: Boolean(session.hazards?.inThermocline),
      });
    }
  }
  return true;
}
btnHudComputerEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (typeof setKitPopoverOpen === 'function') setKitPopoverOpen(false);
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

// Unified Docked Tactical Map: Sonar Minimap | Wetnotes Survey Slate (v169-v173)
const surveySlatePanelEl = document.getElementById('survey-slate-panel');
const surveySlateCanvasEl = document.getElementById('survey-slate-canvas');
const btnSurveySlateCloseEl = document.getElementById('btn-survey-slate-close');
const btnTacmapSonarEl = document.getElementById('btn-tacmap-sonar');
const btnMinimapZoomEl = document.getElementById('hud-minimap-zoom');
const btnSurveyDropPinEl = document.getElementById('btn-survey-drop-pin');
const btnSurveyDropCookieEl = document.getElementById('btn-survey-drop-cookie');
const btnSurveyClearPinsEl = document.getElementById('btn-survey-clear-pins');
const SURVEY_PINS_STORAGE_KEY = 'caveDiverSurveyPins_v1';
function loadSavedSurveyPins(levelId) {
  if (!levelId) return [];
  try {
    const raw = localStorage.getItem(SURVEY_PINS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = parsed?.[levelId];
    if (!Array.isArray(list)) return [];
    return list
      .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
      .slice(-12)
      .map((p, idx) => ({
        id: String(p.id || `pin-${idx}`),
        x: Number(p.x),
        y: Number(p.y),
        depthM: Math.max(0, Math.round(Number(p.depthM ?? p.y) || 0)),
        tag: String(p.tag || 'JUNCTION').slice(0, 12),
      }));
  } catch {
    return [];
  }
}
function saveSurveyPinsForLevel(levelId, pins) {
  if (!levelId) return;
  try {
    const raw = localStorage.getItem(SURVEY_PINS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const store = parsed && typeof parsed === 'object' ? parsed : {};
    if (Array.isArray(pins) && pins.length > 0) {
      store[levelId] = pins.slice(-12);
    } else {
      delete store[levelId];
    }
    localStorage.setItem(SURVEY_PINS_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

const btnHudSurveySlateEl = document.getElementById('btn-hud-survey-slate');
const btnMinimapSlateEl = document.getElementById('btn-minimap-slate');
const SURVEY_PIN_TAGS = ['JUNCTION', 'RELIC', 'SQUEEZE', 'AIR', 'TURN'];
let surveySlateOpen = false;
let surveySlateFollowZoom = false;
let lastSurveySlateDrawMs = 0;

function redrawSurveySlateNow() {
  if (!surveySlateOpen || !session || !surveySlateCanvasEl) return;
  const sctx = surveySlateCanvasEl.getContext('2d');
  if (sctx) {
    renderSurveySlate(sctx, surveySlateCanvasEl.width, surveySlateCanvasEl.height, session, performance.now() / 1000, {
      followZoom: surveySlateFollowZoom,
    });
  }
}

function syncTacticalMapTabsUi() {
  const diff = session?.difficulty || activeDifficulty;
  const mut = session?.mutatorId || '';
  const sonarAllowed = isMinimapAllowed(diff, mut);
  if (hudMinimapWrapEl) {
    hudMinimapWrapEl.classList.toggle('mode-wetnotes', Boolean(surveySlateOpen));
  }
  const sonarViewEl = document.getElementById('hud-minimap-sonar-view');
  if (sonarViewEl) {
    sonarViewEl.hidden = Boolean(surveySlateOpen || !sonarAllowed || !minimapVisible);
  }
  if (btnTacmapSonarEl) {
    btnTacmapSonarEl.classList.toggle('active', !surveySlateOpen && sonarAllowed);
    btnTacmapSonarEl.classList.toggle('locked', !sonarAllowed);
    btnTacmapSonarEl.disabled = !sonarAllowed;
    btnTacmapSonarEl.setAttribute('aria-selected', String(!surveySlateOpen && sonarAllowed));
    btnTacmapSonarEl.textContent = sonarAllowed ? '📡 SONAR' : '🔒 SONAR';
  }
  if (btnMinimapSlateEl) {
    btnMinimapSlateEl.classList.toggle('active', Boolean(surveySlateOpen));
    btnMinimapSlateEl.setAttribute('aria-selected', String(Boolean(surveySlateOpen)));
  }
  btnHudSurveySlateEl?.classList.toggle('active', Boolean(surveySlateOpen));
  syncMinimapButtonUi();
}

function toggleSurveySlate(forceState) {
  if (mode !== 'diving' && forceState !== false) return false;
  surveySlateOpen = typeof forceState === 'boolean' ? forceState : !surveySlateOpen;
  if (surveySlateOpen && shearwaterOpen) {
    shearwaterOpen = false;
    if (shearwaterPanelEl) shearwaterPanelEl.hidden = true;
    btnHudComputerEl?.classList.remove('active');
  }
  if (surveySlatePanelEl) surveySlatePanelEl.hidden = !surveySlateOpen;
  syncTacticalMapTabsUi();
  if (surveySlateOpen) redrawSurveySlateNow();
  return true;
}
btnHudSurveySlateEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (typeof setKitPopoverOpen === 'function') setKitPopoverOpen(false);
  toggleSurveySlate();
});
btnMinimapSlateEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSurveySlate(true);
});
btnTacmapSonarEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  const allowed = isMinimapAllowed(session?.difficulty || activeDifficulty, session?.mutatorId || '');
  if (!allowed) {
    showToast('🔒 Sonar Minimap disabled in Hardcore / Purist — use Wetnotes!', 2.2);
    return;
  }
  minimapVisible = true;
  try { localStorage.setItem(MINIMAP_PREF_KEY, '1'); } catch {}
  toggleSurveySlate(false);
});
btnSurveySlateCloseEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (surveySlateOpen) {
    toggleSurveySlate(false);
    // If Sonar was hidden or locked, closing Wetnotes hides the whole dock
    if (!isMinimapAllowed(session?.difficulty || activeDifficulty, session?.mutatorId || '')) return;
  }
  minimapVisible = false;
  try { localStorage.setItem(MINIMAP_PREF_KEY, '0'); } catch {}
  syncTacticalMapTabsUi();
  showToast('🗺️ Tactical Map hidden — press [M] or [N] anytime.', 1.8);
});
const flipSurveySlateZoom = (e) => {
  e.stopPropagation();
  surveySlateFollowZoom = !surveySlateFollowZoom;
  if (btnMinimapZoomEl) btnMinimapZoomEl.textContent = surveySlateFollowZoom ? 'FOLLOW' : 'FULL';
  redrawSurveySlateNow();
};
btnMinimapZoomEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (surveySlateOpen) {
    flipSurveySlateZoom(e);
  } else {
    toggleMinimapZoom();
  }
});
surveySlateCanvasEl?.addEventListener('click', flipSurveySlateZoom);
btnSurveyDropPinEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!session?.diver) return;
  if (!Array.isArray(session.surveyPins)) session.surveyPins = [];
  if (session.surveyPins.length >= 12) session.surveyPins.shift();
  const seq = (session._surveyPinSeq || 0);
  session._surveyPinSeq = seq + 1;
  const tag = SURVEY_PIN_TAGS[seq % SURVEY_PIN_TAGS.length];
  const depthM = Math.max(0, Math.round(session.diver.y));
  session.surveyPins.push({
    id: `pin-${Date.now()}-${seq}`,
    x: session.diver.x,
    y: session.diver.y,
    depthM,
    tag,
  });
  saveSurveyPinsForLevel(session.level?.id, session.surveyPins);
  audio.playUiClick?.();
  showToast(`📍 Wetnotes Pin #${session._surveyPinSeq} (${tag} · ${depthM}m) marked!`, 2.4);
  redrawSurveySlateNow();
});
btnSurveyDropCookieEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('btn-hud-cookie')?.click();
  redrawSurveySlateNow();
});
btnSurveyClearPinsEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!session) return;
  session.surveyPins = [];
  saveSurveyPinsForLevel(session.level?.id, []);
  audio.playUiClick?.();
  showToast('📋 Cleared custom Wetnotes pins.', 2.0);
  redrawSurveySlateNow();
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
  btnMinimap.classList.toggle('active', allowed ? minimapVisible : surveySlateOpen);
  btnMinimap.classList.toggle('disabled-mode', false);
  btnMinimap.title = !allowed
    ? 'Hardcore / Purist: Toggle Waterproof Wetnotes Survey Slate (M / N)'
    : minimapVisible
      ? 'Hide Sonar Minimap (M)'
      : 'Show Sonar Minimap (M)';
}

function handleMinimapToggle() {
  if (mode !== 'diving' || !session || divePaused) return false;
  const allowed = isMinimapAllowed(session.difficulty || activeDifficulty, session.mutatorId || '');
  if (!allowed) {
    toggleSurveySlate();
    return true;
  }
  if (surveySlateOpen) {
    // Pressing [M] while Wetnotes is open switches cleanly back to Sonar tab
    minimapVisible = true;
    try { localStorage.setItem(MINIMAP_PREF_KEY, '1'); } catch {}
    toggleSurveySlate(false);
    return true;
  }
  minimapVisible = !minimapVisible;
  try { localStorage.setItem(MINIMAP_PREF_KEY, minimapVisible ? '1' : '0'); } catch {}
  syncTacticalMapTabsUi();
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
  hideArtifactSpotlight();
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

// Freeze-Frame Underwater Photo Mode Studio (v139)
const photoModeState = createPhotoModeState();
const photoStudioOverlayEl = document.getElementById('photo-studio-overlay');
const btnPausePhotoMode = document.getElementById('btn-pause-photo-mode');
const btnPhotoExit = document.getElementById('btn-photo-exit');
const photoZoomRangeEl = document.getElementById('photo-zoom-range');
const photoZoomValEl = document.getElementById('photo-zoom-val');
const btnPhotoCenter = document.getElementById('btn-photo-center');
const btnPhotoGrid = document.getElementById('btn-photo-grid');
const btnPhotoFrame = document.getElementById('btn-photo-frame');
const btnPhotoSave = document.getElementById('btn-photo-save');
const photoFilterPillsEl = document.getElementById('photo-filter-pills');

function syncPhotoStudioUi() {
  clampPhotoModeState(photoModeState);
  if (photoZoomRangeEl) photoZoomRangeEl.value = String(Math.round(photoModeState.zoom * 100));
  if (photoZoomValEl) photoZoomValEl.textContent = `${photoModeState.zoom.toFixed(2)}×`;
  if (btnPhotoGrid) btnPhotoGrid.classList.toggle('active', photoModeState.showGrid);
  if (btnPhotoFrame) {
    const fr = getPhotoFrame(photoModeState.frameId);
    btnPhotoFrame.textContent = `🖼 ${fr.shortName}`;
  }
  if (photoFilterPillsEl) {
    photoFilterPillsEl.querySelectorAll('button[data-photo-filter]').forEach((btn) => {
      const active = btn.getAttribute('data-photo-filter') === photoModeState.filterId;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }
}

if (photoFilterPillsEl) {
  photoFilterPillsEl.innerHTML = PHOTO_FILTERS.map(
    (f) => `<button type="button" class="photo-filter-pill${f.id === photoModeState.filterId ? ' active' : ''}" data-photo-filter="${f.id}" role="radio" aria-checked="${f.id === photoModeState.filterId}">${escapeHtml(f.shortName)}</button>`
  ).join('');
  photoFilterPillsEl.querySelectorAll('button[data-photo-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fid = btn.getAttribute('data-photo-filter');
      if (!fid) return;
      photoModeState.filterId = fid;
      syncPhotoStudioUi();
    });
  });
}

function setPhotoModeActive(nextActive) {
  const want = Boolean(nextActive);
  if (want) {
    if (mode !== 'diving' || !session || session.endedState) return false;
    if (isMultiplayer && lan.getPeers().length > 0) {
      showToast('📸 Photo Mode freezes time — available on solo dives!', 2.2);
      return false;
    }
    photoModeState.active = true;
    photoModeState.panX = 0;
    photoModeState.panY = 0;
    photoModeState.zoom = 1.0;
    photoModeState.hideOverlayForCapture = false;
    divePaused = true;
    input?.resetAll?.();
    audio.resetEnvironmentFilter();
    if (hudPauseOverlay) hudPauseOverlay.hidden = true;
    if (screenHud) screenHud.hidden = true;
    if (photoStudioOverlayEl) photoStudioOverlayEl.hidden = false;
    syncPhotoStudioUi();
    return true;
  }
  if (!photoModeState.active) return false;
  photoModeState.active = false;
  photoModeState.hideOverlayForCapture = false;
  divePaused = false;
  if (photoStudioOverlayEl) photoStudioOverlayEl.hidden = true;
  if (screenHud && mode === 'diving') screenHud.hidden = false;
  return true;
}

function savePhotoStudioSnapshot() {
  if (!photoModeState.active || !session || !canvas) return false;
  const wasGrid = photoModeState.showGrid;
  const prevHide = photoModeState.hideOverlayForCapture;
  // Render a clean borderless/gridless frame onto the game canvas before compositing the styled PNG
  photoModeState.showGrid = false;
  photoModeState.hideOverlayForCapture = true;
  try {
    const nextCheckpoint = session.level.checkpoints.find((cp) => !session.checkpointsHit.has(cp.id)) || null;
    renderer.render({
      diver: session.diver,
      diveState: session.diveState,
      peers: getActivePeers(),
      checkpointsHit: session.checkpointsHit,
      nextCheckpoint,
      playerLines: _framePlayerLines,
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
        equalizedHatchIds: session.equalizedHatchIds,
        crankingHatchId: session.crankingHatchId,
        crankingHatchProgress: session.crankingHatchProgress,
        claimedStageIds: session.claimedStageIds,
        placedMarkerIds: session.placedMarkerIds,
      },
      encounters: session.encounters || null,
      hazards: session.hazards || null,
      blackBox: session.blackBox || null,
      lineCookies: session.lineCookies || null,
      surveyPins: session.surveyPins || null,
      powerRelays: session.powerRelays || null,
      smb: session.smb || null,
      salvage: session.salvage || null,
      mechFx: session.mechFx || null,
      stories: session.stories || null,
      reelingActive: Boolean(session.reelingActive),
      bioWake: session.bioWake || null,
      surfaceRipples: session.surfaceRipples || null,
      droppedStages: session.droppedStages || null,
      weather: session.weather || null,
      photoMode: photoModeState,
      endedState: session.endedState || '',
      difficulty: session.difficulty || activeDifficulty,
      mutatorId: session.mutatorId || '',
      compactHud: Boolean(compactHudEnabled),
      spaceClearanceM: session.spaceClearanceM ?? 4.0,
      breathState: session.breath?.state || 'hold',
      squeezeDust: session.squeezeDust || null,
      handOnLinePt: session.handOnLinePt || null,
      timeSec: session.simTimeSec,
      dt: 0,
    });
    const outCanvas = document.createElement('canvas');
    outCanvas.width = 1200;
    outCanvas.height = 675;
    const outCtx = outCanvas.getContext('2d');
    const verMeta = document.querySelector('meta[name="app-version"]')?.content || '139';
    renderPhotoSnapshot(outCtx, canvas, {
      width: 1200,
      height: 675,
      filterId: photoModeState.filterId,
      frameId: photoModeState.frameId,
      siteName: session.level?.name || 'Expedition Site',
      depthM: session.diveState?.depthM || session.diver?.y || 0,
      gasLabel: getActiveGasName(session.diveState?.activeGasId || 'EAN32'),
      diverName: session.diverName || getEnteredCallsign() || 'Diver',
      weatherLabel: session.weather?.label || '',
      version: `v${verMeta}`,
    });
    const dataUrl = outCanvas.toDataURL('image/png');
    const slug = String(session.level?.id || 'dive').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `techno-dive-photo-${slug}-${Math.round(session.diveState?.depthM || 0)}m.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    audio.playCameraShutter(true, false);
    showToast('📸 High-res Underwater Photo saved as PNG!', 2.4);
  } catch {
    showToast('Could not export photograph on this browser.', 2.0);
  } finally {
    photoModeState.showGrid = wasGrid;
    photoModeState.hideOverlayForCapture = prevHide;
  }
  return true;
}

btnPausePhotoMode?.addEventListener('click', () => setPhotoModeActive(true));
btnPhotoExit?.addEventListener('click', () => setPhotoModeActive(false));
photoZoomRangeEl?.addEventListener('input', () => {
  photoModeState.zoom = (Number(photoZoomRangeEl.value) || 100) / 100;
  syncPhotoStudioUi();
});
btnPhotoCenter?.addEventListener('click', () => {
  photoModeState.panX = 0;
  photoModeState.panY = 0;
  photoModeState.zoom = 1.0;
  syncPhotoStudioUi();
});
btnPhotoGrid?.addEventListener('click', () => {
  photoModeState.showGrid = !photoModeState.showGrid;
  syncPhotoStudioUi();
});
btnPhotoFrame?.addEventListener('click', () => {
  const idx = PHOTO_FRAMES.findIndex((f) => f.id === photoModeState.frameId);
  photoModeState.frameId = PHOTO_FRAMES[(idx + 1) % PHOTO_FRAMES.length].id;
  syncPhotoStudioUi();
});
btnPhotoSave?.addEventListener('click', () => savePhotoStudioSnapshot());

// Canvas pointer drag-pan & scroll-wheel zoom while Photo Mode Studio is active
let photoDragPointerId = null;
let photoDragLastX = 0;
let photoDragLastY = 0;
canvas?.addEventListener('pointerdown', (e) => {
  if (!photoModeState.active) return;
  photoDragPointerId = e.pointerId;
  photoDragLastX = e.clientX;
  photoDragLastY = e.clientY;
  try { canvas.setPointerCapture?.(e.pointerId); } catch {}
});
canvas?.addEventListener('pointermove', (e) => {
  if (!photoModeState.active || photoDragPointerId !== e.pointerId) return;
  const dx = e.clientX - photoDragLastX;
  const dy = e.clientY - photoDragLastY;
  photoDragLastX = e.clientX;
  photoDragLastY = e.clientY;
  const pxPerM = Math.max(12, (renderer.pxPerM || 28) * photoModeState.zoom);
  photoModeState.panX -= dx / pxPerM;
  photoModeState.panY -= dy / pxPerM;
  clampPhotoModeState(photoModeState);
});
const endPhotoDrag = (e) => {
  if (photoDragPointerId === e.pointerId) {
    photoDragPointerId = null;
    try { canvas?.releasePointerCapture?.(e.pointerId); } catch {}
  }
};
canvas?.addEventListener('pointerup', endPhotoDrag);
canvas?.addEventListener('pointercancel', endPhotoDrag);
canvas?.addEventListener('wheel', (e) => {
  if (!photoModeState.active) return;
  e.preventDefault();
  photoModeState.zoom += e.deltaY < 0 ? 0.1 : -0.1;
  syncPhotoStudioUi();
}, { passive: false });
hudMinimapWrapEl?.addEventListener('click', (e) => {
  if (e.target?.closest?.('button') || surveySlateOpen) return;
  e.stopPropagation();
  toggleMinimapZoom();
});
hudMinimapWrapEl?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.target?.closest?.('button')) {
    e.preventDefault();
    if (surveySlateOpen) flipSurveySlateZoom(e);
    else toggleMinimapZoom();
  }
});

// Unlockable Tech Gear Loadout (Cave Sonar, DPV Scooter & CCR Rebreather tied to Cert Ladder)
const GEAR_LOADOUT_KEY = 'caveDiverGearLoadout_v1';
const gearDockGridEl = document.getElementById('gear-dock-grid');
const gearDockSubEl = document.getElementById('gear-dock-sub');
const hudGearDockEl = document.getElementById('hud-gear-dock');
const hudDrillPill = document.getElementById('hud-drill-pill');
const btnHudStage = document.getElementById('btn-hud-stage');
const btnHudLiftBag = document.getElementById('btn-hud-liftbag');
const btnHudCookie = document.getElementById('btn-hud-cookie');
const btnHudSmb = document.getElementById('btn-hud-smb');
const btnHudSonar = document.getElementById('btn-hud-sonar');
const btnHudDpv = document.getElementById('btn-hud-dpv');
const hudCcrPill = document.getElementById('hud-ccr-pill');
const hudTrimPill = document.getElementById('hud-trim-pill');
const debriefGearBadgeEl = document.getElementById('debrief-gear-badge');
const dailyChallengeCardEl = document.getElementById('daily-challenge-card');
const dailyDateLabelEl = document.getElementById('daily-date-label');
const dailyStreakPillEl = document.getElementById('daily-streak-pill');
const dailySiteTitleEl = document.getElementById('daily-site-title');
const dailyMutatorBadgeEl = document.getElementById('daily-mutator-badge');
const dailyMutatorDescEl = document.getElementById('daily-mutator-desc');
const btnPlayDaily = document.getElementById('btn-play-daily');
const homeDailyStreakBadgeEl = document.getElementById('home-daily-streak-badge');
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
  if (homeDailyStreakBadgeEl) {
    homeDailyStreakBadgeEl.textContent = status.clearedToday
      ? `✓ 🔥 ${status.activeStreak}d`
      : `🔥 ${status.activeStreak}d`;
  }
  if (btnOpenDailyCalendar) {
    btnOpenDailyCalendar.classList.toggle('cleared', status.clearedToday);
    btnOpenDailyCalendar.title = status.clearedToday
      ? `Daily Dive cleared today (${status.activeStreak}d streak) — open archive calendar or replay`
      : `Open Today’s Daily Dive (${daily.dateKey}) & Archive Calendar`;
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
  setHomeMenuOpen(false);
  const todayKey = getUtcDateKey();
  dailyCalYear = Number(todayKey.slice(0, 4));
  dailyCalMonth0 = Number(todayKey.slice(5, 7)) - 1;
  dailyCalSelectedKey = todayKey;
  renderDailyChallengeCard();
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
  renderHomeAvatarBadge();
  syncSetupDrawerSummary();
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
    const sum = res.pulse?.summary;
    const count = res.pulse?.contacts?.length || 0;
    const parts = [];
    if (sum?.collectibles) parts.push(`💎 ${sum.collectibles} relic${sum.collectibles === 1 ? '' : 's'}`);
    if (sum?.hatches) parts.push(`🚪 ${sum.hatches} hatch${sum.hatches === 1 ? '' : 'es'}`);
    if (sum?.percolation) parts.push(`🌫️ ${sum.percolation} ceil silt`);
    if (sum?.thermoclines) parts.push(`❄️ ${sum.thermoclines} thermo`);
    showToast(
      parts.length > 0
        ? `📡 Sonar lock: ${parts.join(' · ')}`
        : count > 0
          ? `📡 Sonar sweep: ${count} target${count === 1 ? '' : 's'} pinged!`
          : '📡 Sonar contour sweep!',
      2.3
    );
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

const btnKitSonar = document.getElementById('btn-kit-sonar');
const btnKitDpv = document.getElementById('btn-kit-dpv');
const btnKitCamera = document.getElementById('btn-kit-camera');
const btnKitTorch = document.getElementById('btn-kit-torch');

btnHudSonar?.addEventListener('click', (e) => {
  e.stopPropagation();
  handleSonarPing();
});
btnKitSonar?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (typeof setKitPopoverOpen === 'function') setKitPopoverOpen(false);
  handleSonarPing();
});
btnHudDpv?.addEventListener('click', (e) => {
  e.stopPropagation();
  handleDpvToggle();
});
btnKitDpv?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (typeof setKitPopoverOpen === 'function') setKitPopoverOpen(false);
  handleDpvToggle();
});
btnKitCamera?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (typeof setKitPopoverOpen === 'function') setKitPopoverOpen(false);
  handleCameraSnap();
});
btnKitTorch?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (typeof setKitPopoverOpen === 'function') setKitPopoverOpen(false);
  if (!session?.diver) return;
  if (session.drills?.active?.kind === 'torch-fail') {
    resolveEmergencyDrill(session, 'torch-fail', sessionStepCallbacks);
    return;
  }
  session.diver.torchOn = !session.diver.torchOn;
  lastGearHudKey = '';
  syncTechGearHud(session);
});
btnHudStage?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (typeof setKitPopoverOpen === 'function') setKitPopoverOpen(false);
  handleStageDrop();
});
btnHudLiftBag?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (typeof setKitPopoverOpen === 'function') setKitPopoverOpen(false);
  handleLiftBagToggle();
});
btnHudCookie?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (typeof setKitPopoverOpen === 'function') setKitPopoverOpen(false);
  handleDropLineCookie();
});
btnHudSmb?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (typeof setKitPopoverOpen === 'function') setKitPopoverOpen(false);
  handleDeploySmb();
});

function handleDeploySmb() {
  if (mode !== 'diving' || !session || divePaused || session.endedState) return false;
  audio.unlock();
  const res = deploySurfaceMarkerBuoy(session, {
    onSmbDeploy: () => audio.playSmbDeploy?.(),
    onToast: (txt, sec) => showToast(txt, sec),
  });
  if (btnHudSmb && res?.ok) {
    btnHudSmb.innerHTML = `<span class="kit-item-label">🎈 SMB Flying</span><span class="kbd-hint kit-kbd">✓</span>`;
    btnHudSmb.disabled = true;
  }
  return Boolean(res?.ok);
}

function handleDropLineCookie() {
  if (mode !== 'diving' || !session || divePaused || session.endedState) return false;
  audio.unlock();
  const res = dropLineCookie(session, {
    onLineCookiePlaced: () => audio.playCookieClip?.(),
    onToast: (txt, sec) => showToast(txt, sec),
  });
  if (btnHudCookie && session) {
    const left = Math.max(0, (session.maxLineCookies || 6) - (session.lineCookies?.length || 0));
    btnHudCookie.innerHTML = `<span class="kit-item-label">🟠 Cookie (${left})</span><span class="kbd-hint kit-kbd">K</span>`;
    btnHudCookie.disabled = left <= 0;
  }
  return Boolean(res?.ok);
}

function handleLiftBagToggle() {
  if (mode !== 'diving' || !session || divePaused || session.endedState) return false;
  audio.unlock();
  const res = toggleLiftBag(session, {
    onLiftBagToggle: (inflated) => {
      audio.playLiftBag?.(inflated);
    },
    onToast: (txt, sec) => showToast(txt, sec),
  });
  syncTechGearHud(session);
  return Boolean(res?.ok);
}

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
  const lbActive = Boolean(sess.salvage?.liftBagActive);
  const trimStatus = sess.salvage?.status || 'neutral';
  const trimLabel = sess.salvage?.label || '';
  const payloadKg = Math.round(sess.salvage?.payloadKg || 0);
  const torchOn = sess.diver?.torchOn !== false;
  const nearSiltyFloor = Boolean(sess.diver?.nearSiltyFloor);
  const kickStyle = sess.diver?.kickStyle || 'glide';
  const key = `drl:${drillsOn}:${activeDrillKind}:${drillsDone}|stg:${staged}:${canStage}|lb:${lbActive}:${trimStatus}:${payloadKg}|${hasSonar}:${cdSec}|${hasDpv}:${dpvOn}:${dpvPct}|${hasCcr}:${ccrPct}|t:${torchOn}|fk:${nearSiltyFloor ? kickStyle : ''}`;
  if (key === lastGearHudKey) return;
  lastGearHudKey = key;
  hudGearDockEl.hidden = false;

  if (hudDrillPill) {
    hudDrillPill.hidden = !drillsOn;
    if (drillsOn) {
      if (activeDrillKind === 'mask-flood') {
        hudDrillPill.textContent = '🫧 MASK FLOOD [E]';
        hudDrillPill.className = 'gear-hud-pill drill status-strip-pill alert';
      } else if (activeDrillKind === 'torch-fail') {
        hudDrillPill.textContent = '🔦 LIGHT FAIL [L]';
        hudDrillPill.className = 'gear-hud-pill drill status-strip-pill alert';
      } else if (activeDrillKind === 'free-flow') {
        hudDrillPill.textContent = '🔧 FREE-FLOW [E]';
        hudDrillPill.className = 'gear-hud-pill drill status-strip-pill alert';
      } else {
        hudDrillPill.textContent = drillsDone > 0 ? `⚡ DRILLS · ${drillsDone}✓` : '⚡ DRILLS';
        hudDrillPill.className = 'gear-hud-pill drill status-strip-pill';
      }
    }
  }
  if (btnHudStage) {
    btnHudStage.hidden = false;
    btnHudStage.innerHTML = staged
      ? '<span class="kit-item-label">🛢 Stage Staged (+6%)</span><span class="kbd-hint kit-kbd">✓</span>'
      : '<span class="kit-item-label">🛢 Stage Bailout</span><span class="kbd-hint kit-kbd">T</span>';
    btnHudStage.className = `kit-item stage ${staged ? 'staged' : canStage ? '' : 'low'}`;
  }
  if (btnHudLiftBag) {
    btnHudLiftBag.hidden = false;
    btnHudLiftBag.innerHTML = lbActive
      ? '<span class="kit-item-label">🎈 Vent Lift Bag</span><span class="kbd-hint kit-kbd">Y</span>'
      : payloadKg >= 6
        ? `<span class="kit-item-label">🎈 Lift Bag (-${payloadKg}kg)</span><span class="kbd-hint kit-kbd">Y</span>`
        : '<span class="kit-item-label">🎈 Lift Bag</span><span class="kbd-hint kit-kbd">Y</span>';
    btnHudLiftBag.className = `kit-item liftbag${lbActive ? ' active' : ''}`;
  }
  if (hudTrimPill) {
    if (trimLabel) {
      hudTrimPill.hidden = false;
      hudTrimPill.textContent = trimLabel;
      const trimCls = lbActive && trimStatus === 'neutral' ? 'liftbag-ok' : trimStatus;
      hudTrimPill.className = `gear-hud-pill trim status-strip-pill ${trimCls}`;
    } else if (nearSiltyFloor && kickStyle === 'flutter') {
      hudTrimPill.hidden = false;
      hudTrimPill.textContent = '⚠️ FLOOR WASH · HOLD SHIFT (FROG-KICK)';
      hudTrimPill.className = 'gear-hud-pill trim status-strip-pill heavy';
    } else if (nearSiltyFloor && kickStyle === 'frog') {
      hudTrimPill.hidden = false;
      hudTrimPill.textContent = '🐸 FROG-KICK TRIM · CLEAN';
      hudTrimPill.className = 'gear-hud-pill trim status-strip-pill liftbag-ok';
    } else {
      hudTrimPill.hidden = true;
    }
  }
  if (btnHudSonar) {
    btnHudSonar.hidden = !hasSonar;
    if (hasSonar) {
      btnHudSonar.innerHTML = cdSec > 0 ? `📡 ${cdSec}s` : '📡 SONAR <span class="kbd-hint">[Q]</span>';
      btnHudSonar.className = `gear-hud-btn sonar ${cdSec > 0 ? 'cooling' : 'ready'}`;
    }
  }
  if (btnKitSonar) {
    btnKitSonar.hidden = !hasSonar;
    if (hasSonar) {
      btnKitSonar.innerHTML = `<span class="kit-item-label">${cdSec > 0 ? `📡 Sonar (${cdSec}s)` : '📡 Sonar'}</span>`;
      btnKitSonar.className = `kit-item sonar mobile-only-kit${cdSec > 0 ? ' low' : ''}`;
    }
  }
  if (btnHudDpv) {
    btnHudDpv.hidden = !hasDpv;
    if (hasDpv) {
      btnHudDpv.textContent = dpvPct <= 0 ? '🔋 DPV 0%' : dpvOn ? `🛴 DPV ON · ${dpvPct}%` : `🛴 DPV ${dpvPct}%`;
      btnHudDpv.className = `gear-hud-btn dpv ${dpvPct <= 0 ? 'empty' : dpvOn ? 'active' : ''}`;
    }
  }
  if (btnKitDpv) {
    btnKitDpv.hidden = !hasDpv;
    if (hasDpv) {
      btnKitDpv.innerHTML = `<span class="kit-item-label">${dpvPct <= 0 ? '🔋 DPV 0%' : dpvOn ? `🛴 DPV ON ${dpvPct}%` : `🛴 DPV ${dpvPct}%`}</span>`;
      btnKitDpv.className = `kit-item dpv mobile-only-kit${dpvPct <= 0 ? ' low' : dpvOn ? ' active' : ''}`;
    }
  }
  if (btnKitTorch) {
    btnKitTorch.innerHTML = `<span class="kit-item-label">${torchOn ? '🔦 Torch: On' : '🔦 Torch: Off'}</span>`;
    btnKitTorch.className = `kit-item torch mobile-only-kit${torchOn ? ' active' : ''}`;
  }
  if (hudCcrPill) {
    hudCcrPill.hidden = !hasCcr;
    if (hasCcr) {
      hudCcrPill.textContent = ccrPct <= 0 ? '🫁 CCR BAILOUT' : `🫁 CCR ${ccrPct}%`;
      hudCcrPill.className = `gear-hud-pill ccr status-strip-pill ${ccrPct < 20 ? 'low' : ''}`;
    }
  }
  if (typeof btnHudGearMoreEl !== 'undefined' && btnHudGearMoreEl) {
    btnHudGearMoreEl.classList.toggle('has-active', Boolean(staged || lbActive || dpvOn || shearwaterOpen || signalWheelOpen));
  }
}

// Difficulty Realism Mode (Guided / Standard Tech / Hardcore), PB Ghost Replay & First-Dive Guide
const DIFFICULTY_PREF_KEY = 'caveDiverDifficulty_v1';
const GHOST_PREF_KEY = 'caveDiverGhostEnabled_v1';
const TORCH_STICK_PREF_KEY = 'caveDiverTorchStick_v1';
const DRILLS_PREF_KEY = 'caveDiverDrills_v1';
const AI_BUDDY_PREF_KEY = 'caveDiverAiBuddy_v1';
const WEATHER_PREF_KEY = 'caveDiverWeather_v1';
const LIVERY_PREF_KEY = 'caveDiverLivery_v1';
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
const menuDrillsPillEl = document.getElementById('menu-drills-pill');
function syncDrillsUi() {
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
menuDrillsPillEl?.addEventListener('click', toggleDrillsPreference);
syncDrillsUi();

// AI Autonomous Dive Squad (0 = Solo, 1–3 = Wingmen up to full 4-Diver Solo Squad) (v134 / v141)
let aiSquadCount = 0;
try {
  const savedSquad = parseInt(localStorage.getItem(AI_BUDDY_PREF_KEY) || '0', 10);
  if (Number.isInteger(savedSquad) && savedSquad >= 0 && savedSquad <= AI_SQUAD_ROSTER.length) {
    aiSquadCount = savedSquad;
  }
} catch {}
const menuAiBuddyPillEl = document.getElementById('menu-ai-buddy-pill');
function syncAiBuddyUi() {
  if (menuAiBuddyPillEl) {
    menuAiBuddyPillEl.textContent =
      aiSquadCount <= 0
        ? '🤖 AI Squad: Off'
        : aiSquadCount === 1
          ? '🤖 AI Squad: 1 (2-Div)'
          : aiSquadCount === 2
            ? '🤖 AI Squad: 2 (3-Div)'
            : '🤖 AI Squad: 3 (4-Div)';
    menuAiBuddyPillEl.classList.toggle('active', aiSquadCount > 0);
  }
  syncSetupDrawerSummary();
}
function toggleAiBuddyPreference() {
  aiSquadCount = (aiSquadCount + 1) % (AI_SQUAD_ROSTER.length + 1);
  try {
    localStorage.setItem(AI_BUDDY_PREF_KEY, String(aiSquadCount));
  } catch {}
  syncAiBuddyUi();
  if (aiSquadCount === 0) {
    showToast('🤖 AI Dive Squad turned off (solo dive).', 2.4);
  } else {
    const names = AI_SQUAD_ROSTER.slice(0, aiSquadCount).map((r) => r.name.replace(/^🤖\s*/, '')).join(', ');
    showToast(
      `🤖 ${aiSquadCount + 1}-Diver AI Squad (${names}) — staggered torches, hand-signals & Hardcore collision ready!`,
      2.9
    );
  }
}
menuAiBuddyPillEl?.addEventListener('click', toggleAiBuddyPreference);
syncAiBuddyUi();

// Crew Specialty Role selector (v156)
const CREW_ROLE_PREF_KEY = 'caveDiverCrewRole_v1';
let activeCrewRoleId = 'balanced';
try {
  const savedRole = localStorage.getItem(CREW_ROLE_PREF_KEY);
  if (savedRole) activeCrewRoleId = getCrewRole(savedRole).id;
} catch {}
const menuRolePillEl = document.getElementById('menu-role-pill');
function syncCrewRoleUi() {
  const role = getCrewRole(activeCrewRoleId);
  if (menuRolePillEl) {
    menuRolePillEl.textContent = `${role.icon} ${role.shortLabel || role.name}`;
    menuRolePillEl.classList.toggle('active', role.id !== 'balanced');
  }
  const roleDescEl = document.getElementById('setup-role-desc');
  if (roleDescEl) {
    roleDescEl.textContent = `${role.name}: ${role.perkText}`;
  }
  syncSetupDrawerSummary();
}
function cycleCrewRolePreference() {
  activeCrewRoleId = cycleCrewRoleId(activeCrewRoleId);
  try {
    localStorage.setItem(CREW_ROLE_PREF_KEY, activeCrewRoleId);
  } catch {}
  const role = getCrewRole(activeCrewRoleId);
  syncCrewRoleUi();
  showToast(`${role.icon} Crew Role: ${role.name} — ${role.perkText}`, 3.0);
}
menuRolePillEl?.addEventListener('click', cycleCrewRolePreference);
syncCrewRoleUi();

// Dynamic Surface Weather & Time-of-Day preference (v137)
let weatherPrefId = 'clear-day';
try {
  const savedW = localStorage.getItem(WEATHER_PREF_KEY);
  if (savedW && WEATHER_CYCLE_ORDER.includes(savedW)) weatherPrefId = savedW;
} catch {}
const menuWeatherPillEl = document.getElementById('menu-weather-pill');
function syncWeatherUi() {
  const resolved = resolveEffectiveWeather(weatherPrefId, { level: activeLevel });
  if (menuWeatherPillEl) {
    menuWeatherPillEl.textContent =
      weatherPrefId === 'auto' ? `🌍 Auto (${resolved.shortLabel})` : resolved.pillText;
    menuWeatherPillEl.classList.toggle('active', weatherPrefId !== 'clear-day');
  }
  syncSetupDrawerSummary();
}
function cycleWeatherPreference() {
  const idx = WEATHER_CYCLE_ORDER.indexOf(weatherPrefId);
  weatherPrefId = WEATHER_CYCLE_ORDER[(idx + 1) % WEATHER_CYCLE_ORDER.length];
  try {
    localStorage.setItem(WEATHER_PREF_KEY, weatherPrefId);
  } catch {}
  syncWeatherUi();
  const resolved = resolveEffectiveWeather(weatherPrefId, { level: activeLevel });
  const bonusTxt = resolved.scoreBonus > 0 ? ` (+${resolved.scoreBonus} pts)` : '';
  showToast(
    weatherPrefId === 'auto'
      ? `🌍 Weather: Live Auto → ${resolved.icon} ${resolved.label}${bonusTxt}`
      : `${resolved.icon} Weather: ${resolved.label}${bonusTxt}`,
    2.5
  );
}
menuWeatherPillEl?.addEventListener('click', cycleWeatherPreference);
syncWeatherUi();

// ── Diver Gear Workshop, Custom Rig Liveries & Test-Tank Controller (modularized v172) ──
const liveryWorkshop = createLiveryWorkshopController({
  liveryPrefKey: LIVERY_PREF_KEY,
  loadCareerLogbook,
  getEffectiveGearLoadout: () => getEffectiveGearLoadout(),
  getSavedGearLoadout: () => savedGearLoadout,
  saveGearLoadout: (...a) => saveGearLoadout(...a),
  renderTechGearDock: () => renderTechGearDock(),
  getSession: () => session,
  syncSetupDrawerSummary: () => syncSetupDrawerSummary(),
  closeDiveSetupModal: () => closeDiveSetupModal(),
  setHomeMenuOpen: (v) => setHomeMenuOpen(v),
  scheduleGitHubStatsSync: () => scheduleGitHubStatsSync(),
  showToast,
});
const {
  liveryModalEl,
  getCurrentLiveryUnlocks,
  saveLiverySlotsToStorage,
  saveRigLivery,
  reconcileActiveRigLiveryFromStorage,
  renderHomeAvatarBadge,
  syncLiveryUi,
  renderLiveryPreviewFrame,
  renderLiveryWorkshopModal,
  openLiveryModal,
  closeLiveryModal,
} = liveryWorkshop;
syncLiveryUi();

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

// ── Career Logbook, Artifact Trophy Vault, 3D Inspector & Field Guide (modularized v172) ──
const logbookCtrl = createLogbookModalController({
  lan,
  github,
  loadCareerLogbook,
  saveCareerLogbook,
  loadGhostTrack: (id) => loadGhostTrack(id),
  getEnteredCallsign,
  getDiverName: () => playerNameInput?.value.trim() || 'Diver',
  setHomeMenuOpen: (v) => setHomeMenuOpen(v),
  renderModeBadgeHtml: (...a) => renderModeBadgeHtml(...a),
  formatRunClock: (...a) => formatRunClock(...a),
  renderGitHubAccountUi: () => renderGitHubAccountUi(),
  renderCareerSummary: () => renderCareerSummary(),
  renderTechGearDock: () => renderTechGearDock(),
  renderDailyChallengeCard: () => renderDailyChallengeCard(),
  populateLevelSelect,
  renderLevelCards,
  showToast,
  els: {
    btnOpenLogbook,
    btnProgressPill,
    modalLogbook,
    btnLogbookClose,
    logbookKpisEl,
    logbookCertsEl,
    logbookSitesEl,
    logbookSubEl,
  },
});
const {
  artifactInspectorModalEl,
  fgCardModalEl,
  openLogbookModal,
  closeLogbookModal,
  openArtifactInspector,
  closeArtifactInspector,
  renderArtifactVaultSection,
  renderFieldGuideGallery,
  openFieldGuideCardModal,
  closeFieldGuideCardModal,
} = logbookCtrl;

// ── Dive Replay Theater & Pre-Dive Gas Blender (modularized v172) ──
const replayTheater = createReplayTheaterController({
  github,
  showToast,
  loadGhostTrack,
  loadCareerLogbook,
  getDiverName: () => playerNameInput?.value.trim() || 'Diver',
  getActiveDifficulty: () => activeDifficulty,
});
const {
  replayModal,
  debriefReplayWrapEl,
  debriefReplay,
  shareOrDownloadPostcard,
  openLogbookReplayModal,
  closeReplayModal,
} = replayTheater;

const gasPlanner = createGasPlannerController({
  getActiveLevel: () => activeLevel,
  setHomeMenuOpen,
  closeDiveSetupModal,
  syncSetupDrawerSummary,
  showToast,
});
const {
  gasPlannerModal,
  saveCustomGasPlan,
  getSiteDefaultBottomMix,
  getActiveCustomMixOverrides,
  syncGasPlanBadges,
  renderGasPlannerModal,
  openGasPlannerModal,
  closeGasPlannerModal,
} = gasPlanner;
// Mutable proxy accessor kept for callers reading/mutating getCustomGasPlan() directly
const getCustomGasPlan = () => gasPlanner.getPlan();
syncGasPlanBadges();

// ── Custom Challenge Links, Mutator Sandbox & Procedural Generator (modularized v172) ──
const sandboxCtrl = createSandboxAndProceduralController({
  difficultyPrefKey: DIFFICULTY_PREF_KEY,
  drillsPrefKey: DRILLS_PREF_KEY,
  getActiveLevel: () => activeLevel,
  getActiveDifficulty: () => activeDifficulty,
  setActiveDifficulty: (v) => { activeDifficulty = v; },
  getDrillsEnabled: () => drillsEnabled,
  setDrillsEnabled: (v) => { drillsEnabled = v; },
  getCustomGasPlan,
  setCustomGasPlan: (plan) => gasPlanner.setPlan(plan),
  saveCustomGasPlan,
  syncGasPlanBadges,
  syncPreferenceMenuButtons: () => syncPreferenceMenuButtons(),
  syncDrillsUi: () => syncDrillsUi(),
  syncSetupDrawerSummary: () => syncSetupDrawerSummary(),
  loadCareerLogbook,
  getDiverName: () => playerNameInput?.value.trim() || '',
  setHomeMenuOpen: (v) => setHomeMenuOpen(v),
  closeDiveSetupModal: () => closeDiveSetupModal(),
  selectAndLoadLevel: (...a) => selectAndLoadLevel(...a),
  btnPlaySolo,
  showToast,
});
const {
  challengeModal,
  proceduralModal,
  menuProcPillEl,
  debriefChallengeBannerEl,
  btnChallengeAccept,
  btnChallengeDismiss,
  btnDebriefChallenge,
  draftProcedural,
  syncSandboxPillUi,
  openChallengeModal,
  closeChallengeModal,
  copyOrShareChallengeUrl,
  renderIncomingChallengeBanner,
  applyIncomingChallenge,
  openProceduralModal,
  closeProceduralModal,
  applyProceduralLevelToMenu,
} = sandboxCtrl;

// === Multi-Dive Expedition Campaigns & Repetitive Surface Intervals (v160) ===
const campaignsModal = document.getElementById('campaigns-modal');
const btnOpenCampaigns = document.getElementById('btn-open-campaigns');
const btnCampaignsClose = document.getElementById('btn-campaigns-close');
const campaignsGridEl = document.getElementById('campaigns-grid');
const debriefHighlightPillsEl = document.getElementById('debrief-highlight-pills');
const debriefCampaignBoxEl = document.getElementById('debrief-campaign-box');
let activeCampaignRun = null;

function renderCampaignsModal() {
  if (!campaignsGridEl) return;
  const book = loadCareerLogbook();
  const clearedSet = new Set(Array.isArray(book.completedCampaigns) ? book.completedCampaigns : []);
  campaignsGridEl.innerHTML = '';
  for (const camp of EXPEDITION_CAMPAIGNS) {
    const isCleared = clearedSet.has(camp.id);
    const card = document.createElement('div');
    card.className = `campaign-arc-card${isCleared ? ' cleared' : ''}`;
    const legLines = camp.legs
      .map((lid, idx) => {
        const lv = getLevelById(lid);
        return `<div>Leg ${idx + 1}: ${lv ? `${lv.name} (${lv.maxDepthM || lv.targetDepthM || '?'}m)` : lid}</div>`;
      })
      .join('');
    const rewardHtml = camp.reward
      ? `<div class="campaign-reward-strip${isCleared ? ' unlocked' : ''}"><span>${isCleared ? '✓ Unlocked:' : '🎁 Reward:'} ${escapeHtml(camp.reward.label)}</span></div>`
      : '';
    card.innerHTML = `
      <div class="campaign-arc-head">
        <span class="campaign-arc-title">${camp.icon} ${camp.name}</span>
        ${isCleared ? `<span class="campaign-patch-badge">🏅 ${camp.patchName}</span>` : `<span class="campaign-patch-badge" style="opacity:0.65">3 Dives</span>`}
      </div>
      <p class="campaign-arc-desc">${camp.desc}</p>
      ${rewardHtml}
      <div class="campaign-legs-list">${legLines}</div>
      <button class="btn primary tiny" type="button" data-start-campaign="${camp.id}">${isCleared ? '↺ REPLAY EXPEDITION' : '🚀 START EXPEDITION'}</button>
    `;
    campaignsGridEl.appendChild(card);
  }
}

function openCampaignsModal() {
  if (!campaignsModal) return;
  if (typeof setHomeMenuOpen === 'function') setHomeMenuOpen(false);
  renderCampaignsModal();
  campaignsModal.hidden = false;
}

function closeCampaignsModal() {
  if (campaignsModal) campaignsModal.hidden = true;
}

async function startExpeditionCampaign(campaignId) {
  const run = createCampaignRunState(campaignId);
  const camp = getExpeditionCampaignById(campaignId);
  if (!run || !camp) return;
  activeCampaignRun = run;
  closeCampaignsModal();
  const firstLegId = camp.legs[0];
  await selectAndLoadLevel(firstLegId);
  launchOpenCoopDive();
  showToast(`${camp.icon} ${camp.name} — Leg 1/3 launched!`, 3.4);
}

btnOpenCampaigns?.addEventListener('click', openCampaignsModal);
btnCampaignsClose?.addEventListener('click', closeCampaignsModal);
campaignsModal?.addEventListener('click', (e) => {
  if (e.target === campaignsModal) closeCampaignsModal();
});
campaignsGridEl?.addEventListener('click', (e) => {
  const btn = e.target?.closest?.('[data-start-campaign]');
  if (!btn) return;
  const cid = btn.getAttribute('data-start-campaign');
  if (cid) startExpeditionCampaign(cid);
});

// === Technical Rescue Drills Mode (v174 / v175) ===
let activeRescueDrill = null;
async function launchRescueDrill(drill) {
  if (!drill) return false;
  activeCampaignRun = null;
  activeDailyChallenge = null;
  activeRescueDrill = drill;
  if (lan.room) {
    lan.leaveRoom();
    resetLobbyUiState();
  }
  await selectAndLoadLevel(drill.levelId, { focusMap: false });
  await ensureLevelLoaded(drill.levelId, { showOverlay: true });
  startDiveRun(false);
  return true;
}
const rescueDrillsCtrl = createRescueDrillsController({
  loadCareerLogbook,
  setHomeMenuOpen: (v) => setHomeMenuOpen(v),
  closeDiveSetupModal: () => closeDiveSetupModal(),
  launchRescueDrill,
});
const { drillsModal, openDrillsModal, closeDrillsModal } = rescueDrillsCtrl;

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
  sandboxCtrl.setActiveIncomingChallenge(null);
  renderIncomingChallengeBanner();
});
btnDebriefChallenge?.addEventListener('click', () => {
  const lastCh = sandboxCtrl.getLastDebriefChallenge();
  if (lastCh.url) {
    copyOrShareChallengeUrl(lastCh.url, lastCh.text);
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
    if (lid) selectAndLoadLevel(lid, { focusMap: siteBrowser.getMapZoomMode() === 'site' });
  }
});

// ── GitHub OAuth Cloud Save (Private Gist) & In-App Issue Reporter (modularized v172) ──
const githubSync = createGitHubSyncController({
  github,
  urlParams: URL_PARAMS,
  prefKeys: {
    gear: GEAR_LOADOUT_KEY,
    difficulty: DIFFICULTY_PREF_KEY,
    ghost: GHOST_PREF_KEY,
    torchStick: TORCH_STICK_PREF_KEY,
    livery: LIVERY_PREF_KEY,
  },
  loadCareerLogbook,
  saveCareerLogbook,
  loadGhostTrack: (id) => loadGhostTrack(id),
  saveGhostTrack: (id, t) => saveGhostTrack(id, t),
  refreshActiveGhostTrack: (lvl) => refreshActiveGhostTrack(lvl),
  liveryWorkshop,
  getEnteredCallsign,
  sanitizeCallsignInput,
  syncCallsignCount,
  playerNameInput,
  getActiveLevel: () => activeLevel,
  getSession: () => session,
  getMode: () => mode,
  getIsMultiplayer: () => isMultiplayer,
  getActiveDifficulty: () => activeDifficulty,
  setActiveDifficulty: (v) => { activeDifficulty = v; },
  getGhostEnabled: () => ghostEnabled,
  setGhostEnabled: (v) => { ghostEnabled = v; },
  getTorchStickEnabled: () => torchStickEnabled,
  setTorchStickEnabled: (v) => { torchStickEnabled = v; },
  getSavedGearLoadout: () => savedGearLoadout,
  setSavedGearLoadout: (v) => { savedGearLoadout = v; },
  saveGearLoadout: (...a) => saveGearLoadout(...a),
  syncPreferenceMenuButtons: () => syncPreferenceMenuButtons(),
  syncLiveryUi,
  renderCareerSummary: () => renderCareerSummary(),
  renderTechGearDock: () => renderTechGearDock(),
  renderDailyChallengeCard: () => renderDailyChallengeCard(),
  renderLevelCards,
  modalLogbook,
  openLogbookModal,
  closeLogbookModal,
  setHomeMenuOpen: (v) => setHomeMenuOpen(v),
  setHudMenuOpen: (v) => setHudMenuOpen(v),
  setDivePaused: (v) => setDivePaused(v),
  showToast,
});
const {
  modalIssue,
  renderGitHubAccountUi,
  syncCareerStatsWithGitHub,
  scheduleGitHubStatsSync,
  triggerGitHubLogin,
  openIssueModal,
  closeIssueModal,
  initGitHubAuth,
} = githubSync;

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

let activeDebriefChartCtrl = null;
function renderDebriefDepthProfile(profile, maxDepthM, success, peerProfiles = null, highlights = null) {
  activeDebriefChartCtrl = renderDebriefDepthChart({
    wrapEl: document.getElementById('debrief-profile-wrap'),
    svgEl: document.getElementById('debrief-profile-svg'),
    scrubEl: document.getElementById('debrief-profile-scrub'),
    profile,
    maxDepthM,
    success,
    peerProfiles,
    highlights,
    onScrubTime: (tSec) => {
      debriefReplay.seekToTime(tSec, { notify: false });
    },
    formatRunClock,
    escapeHtml,
  });
  debriefReplay.setOnTimeUpdate((tSec) => {
    activeDebriefChartCtrl?.setCursorTime(tSec, { notify: false });
  });
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
    const pTxt = info.next.progressText ? ` · ${info.next.progressText}` : '';
    html += `<span class="cert-pill locked" title="${escapeHtml(info.next.requirement)}">🔒 Next: ${escapeHtml(info.next.title)} (${escapeHtml(info.next.requirement)}${escapeHtml(pTxt)})</span>`;
  }
  el.innerHTML = html;
}

function handleWreckAction() {
  if (mode !== 'diving' || !session || divePaused || session.endedState) return false;
  const res = triggerWreckAction(session, sessionStepCallbacks);
  if (res?.kind === 'inflate-liftbag') {
    syncTechGearHud(session);
  }
  return Boolean(res?.handled);
}

btnWreckAction?.addEventListener('click', (e) => {
  e.preventDefault();
  audio.triggerHaptic?.('action');
  handleWreckAction();
});

function formatActionLabelHtml(rawLabel) {
  const safe = escapeHtml(String(rawLabel || ''));
  return safe.replace(/\s*(\[[A-Z0-9 /]+\])$/i, ' <span class="kbd-hint">$1</span>');
}

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
  btnWreckAction.classList.toggle('is-hatch', prompt.kind === 'open-hatch' || prompt.kind === 'equalize-valve');
  btnWreckAction.classList.toggle('is-clip', prompt.kind === 'clip-line');
  btnWreckAction.classList.toggle('is-unclip', prompt.kind === 'unclip-line');
  btnWreckAction.classList.toggle('is-stage', prompt.kind === 'refill-stage' || prompt.kind === 'inflate-liftbag' || prompt.kind === 'retrieve-stage');
  btnWreckAction.classList.toggle('is-marker', prompt.kind === 'place-marker' || prompt.kind === 'claim-beacon');
  if (wreckActionLabelEl) wreckActionLabelEl.innerHTML = formatActionLabelHtml(prompt.label);
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
  toggleSurveySlate(false);
  toggleSignalWheel(false);
  setPhotoModeActive(false);
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
  resetAbortArmState();
  if (typeof setKitPopoverOpen === 'function') setKitPopoverOpen(false);
  try { document.activeElement?.blur?.(); } catch {}
  resetSafariViewportZoom(true);
  rewindHoldTimer = 0;
  if (hudPauseOverlay) hudPauseOverlay.hidden = true;
  if (btnDropTow) btnDropTow.hidden = true;
  if (btnTowBuddy) btnTowBuddy.hidden = true;
  if (btnShareGas) btnShareGas.hidden = true;
  syncWreckActionHud(null);
  hideHudPhotoCard();
  hideArtifactSpotlight();
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
  const effectiveMutatorId = dailyRun?.mutatorId || (!multiplayer ? sandboxCtrl.getActiveSandboxMutatorId() : '') || '';
  const isDrillLaunch = Boolean(activeRescueDrill && !multiplayer && activeLevel.id === activeRescueDrill.levelId);
  const runDifficulty = isDrillLaunch ? (activeRescueDrill.difficulty || activeDifficulty) : activeDifficulty;
  const runDrillsEnabled = isDrillLaunch ? true : drillsEnabled;
  session = createDiveSession(activeLevel, {
    diverName,
    spawnOffsetX,
    difficulty: runDifficulty,
    gear: activeGear,
    mutatorId: effectiveMutatorId,
    dailyDateKey: dailyRun?.dateKey || '',
    customMixOverrides: getActiveCustomMixOverrides(activeLevel),
    drillsEnabled: runDrillsEnabled,
    weatherId: weatherPrefId,
    livery: liveryWorkshop.getActiveRigLivery(),
    crewRoleId: activeCrewRoleId,
  });
  session.surveyPins = loadSavedSurveyPins(activeLevel.id);
  session._surveyPinSeq = session.surveyPins.length;
  const runMutMeta = session.mutatorId ? getDailyMutatorById(session.mutatorId) : null;
  session._dailyBadgeLabel = runMutMeta
    ? `${session.dailyDateKey ? '📅' : '🎛️'} ${runMutMeta.icon} ${runMutMeta.shortName}`
    : '';
  const incomingChallenge = sandboxCtrl.getActiveIncomingChallenge();
  session._challenge =
    !multiplayer && incomingChallenge && incomingChallenge.siteId === activeLevel.id
      ? { ...incomingChallenge }
      : null;
  lastGearHudKey = '';
  syncTechGearHud(session);
  if (btnHudCookie) {
    const maxCk = session.maxLineCookies || 6;
    btnHudCookie.innerHTML = `<span class="kit-item-label">🟠 Cookie (${maxCk})</span><span class="kbd-hint kit-kbd">K</span>`;
    btnHudCookie.disabled = false;
  }
  if (btnHudSmb) {
    btnHudSmb.innerHTML = `<span class="kit-item-label">🎈 Shoot SMB</span><span class="kbd-hint kit-kbd">U</span>`;
    btnHudSmb.disabled = false;
  }
  syncTacticalMapTabsUi();
  refreshActiveGhostTrack(activeLevel);
  session._pbSplits = activeGhostTrack ? computeGhostCheckpointSplits(activeLevel, activeGhostTrack) : {};
  session._pbSplitsLabel = activeGhostIsPar ? 'Par' : 'PB';
  session.endedState = null;
  session.localOutcome = null;
  session._awaitingHostStart = Boolean(restoredState?.awaitingHostStart);
  session.restoredPeerLines = new Map();
  session.aiSquad =
    aiSquadCount > 0 && (!multiplayer || lan.getPeers().length === 0)
      ? createAiSquad(activeLevel, session.diver, aiSquadCount, {
          initialGasId: session.diveState.activeGasId,
          teamUniform: liveryWorkshop.getAiSquadTeamUniform(),
          leaderLivery: liveryWorkshop.getActiveRigLivery(),
        })
      : [];
  session.aiBuddy = session.aiSquad[0] || null;
  if (isDrillLaunch) {
    if (activeRescueDrill.needsAiBuddy && session.aiSquad.length === 0) {
      session.aiSquad = createAiSquad(activeLevel, session.diver, 1, {
        initialGasId: session.diveState.activeGasId,
        teamUniform: liveryWorkshop.getAiSquadTeamUniform(),
        leaderLivery: liveryWorkshop.getActiveRigLivery(),
      });
      session.aiBuddy = session.aiSquad[0] || null;
    }
    applyRescueDrillScenario(session, activeRescueDrill);
    renderer.camX = session.diver.x;
    renderer.camY = session.diver.y;
    lastGearHudKey = '';
    syncTechGearHud(session);
  }

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
  if (coopCommsEl) coopCommsEl.hidden = !(getActivePeers().length > 0);
  if (multiplayer && lan.room) {
    syncRoomInviteUi(lan.room);
  } else {
    syncRoomInviteUi(null);
  }
  if (coopWaitBannerEl) coopWaitBannerEl.hidden = true;
  const bottomMixName = getActiveGasName('TMX1455');
  const openMsg = isDrillLaunch
    ? activeRescueDrill.briefing
    : runMutMeta
      ? `${session.dailyDateKey ? '📅 DAILY' : '🎛️ SANDBOX'} · ${runMutMeta.icon} ${runMutMeta.name}: ${runMutMeta.shortDesc}`
    : activeLevel.isWreck
      ? activeLevel.reelMetersPerDiver > 0
        ? `🚢 Descend the shot line! Switch to ${bottomMixName} [2] at ${Math.round(activeLevel.ascentSwitchDepthM || 22)}m & anchor your ${activeLevel.reelMetersPerDiver}m wreck reel [G].`
        : `🚢 Descend the boat shot line! Switch to ${bottomMixName} [2] at ${Math.round(activeLevel.ascentSwitchDepthM || 22)}m before entering the hull.`
      : activeLevel.reelMetersPerDiver > 0
        ? `Unlined cave: [G] deploy ${activeLevel.reelMetersPerDiver}m reel. STOP at 22m & switch to ${bottomMixName} [2]!`
        : `Start on ${getActiveGasName('EAN32')}. STOP at 22m & switch to ${bottomMixName} [2] before descending deeper!`;
  const aiSquadTag =
    session.aiSquad.length > 0
      ? (() => {
          const lead = session.aiSquad[0];
          const bRec = loadCareerLogbook()?.crewBonds?.[lead.id];
          const bondStr = bRec && bRec.dives > 0 ? ` · ${lead.callsign || lead.name} (${bRec.dives} dives)` : ` · ${session.aiSquad.map((b) => b.callsign || b.name).join(', ')}`;
          return ` · AI: ${getAiDifficultyProfile(session.difficulty).badge}${bondStr}`;
        })()
      : '';
  let campaignTag = '';
  if (activeCampaignRun && activeCampaignRun.residualTissues && activeCampaignRun.legIndex > 0) {
    applyResidualTissuesToDiveState(session.diveState, activeCampaignRun.residualTissues);
    const camp = getExpeditionCampaignById(activeCampaignRun.campaignId);
    const loadPct = activeCampaignRun.residualTissues.residualLoadPct ?? computeResidualTissueLoadPct(session.diveState.compartments);
    campaignTag = ` · ${camp?.icon || '🗺️'} Leg ${activeCampaignRun.legIndex + 1}/3 (Residual N₂ ${loadPct}%)`;
  }
  showToast(`${openMsg}${aiSquadTag}${campaignTag}`, 4.8);
}

function finishDiveRun(success, title, detail, outcomeScore = null) {
  if (!session) return;
  cancelDebriefAnimations();
  input?.resetAll?.();
  audio.resetEnvironmentFilter();
  setPhotoModeActive(false);
  mode = 'debrief';
  divePaused = false;
  spectatingPeer = false;
  setHudMenuOpen(false);
  if (hudPauseOverlay) hudPauseOverlay.hidden = true;
  hideHudPhotoCard();
  hideArtifactSpotlight();
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
      expeditionBonusScore:
        (session.blackBoxBonusScore || 0) +
        (session.relayBonusScore || 0) +
        (session.smbBonusScore || 0) +
        (session.wildlifeHarmonyScore || 0) +
        (session.contractBonusScore || 0) +
        (session.aiLeadBonusScore || 0) +
        (session.aiBuddiesRescued || 0) * 450,
      photoBonusScore: session.camera?.photoBonusScore || 0,
      encounterBonusScore: session.encounters?.encounterBonusScore || 0,
      drillBonusScore: session.drills?.bonusScore || 0,
      weatherBonusScore: session.weatherBonusScore || 0,
      trimBonusScore:
        session.trimStats && session.trimStats.blowouts === 0
          ? Math.round(((session.trimStats.disciplinePct || 0) / 100) * 250)
          : Math.round(((session.trimStats?.disciplinePct || 0) / 100) * 100),
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
    customGas: getCustomGasPlan().enabled,
    o2Pct: getCustomGasPlan().o2Pct,
    hePct: getCustomGasPlan().hePct,
    drillsEnabled: Boolean(session.drills?.enabled),
    challengerName: diver.name || playerNameInput?.value.trim() || '',
    targetScore: success ? teamSummary.teamScore : 0,
  };
  sandboxCtrl.setLastDebriefChallenge(
      buildChallengeUrl(`${location.origin}${location.pathname}`, runChallengeCfg),
      formatChallengeSummary(runChallengeCfg, {
        levelName: level.name,
        mutator: session.mutatorId ? getDailyMutatorById(session.mutatorId) : null,
      }).shareText
    );

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
  toggleSurveySlate(false);
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
  renderDebriefDepthProfile(session?.diveProfile, diveState.maxDepthM, success, session?.peerProfiles, session?.highlights);

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
    if (debriefHighlightPillsEl) {
      if (success) {
        recordDiveHighlight(session, {
          kind: 'extract',
          icon: '🏆',
          label: 'Safe Extraction',
          tSec: session.simTimeSec || diveState.diveTimeSec || 0,
          depthM: 0,
        });
      }
      const hlList = Array.isArray(session?.highlights) ? session.highlights : [];
      if (hasReplay && hlList.length > 0) {
        debriefHighlightPillsEl.hidden = false;
        debriefHighlightPillsEl.innerHTML = '';
        for (const hl of hlList) {
          const pill = document.createElement('button');
          pill.type = 'button';
          pill.className = 'highlight-pill';
          pill.innerHTML = `<span>${hl.icon} ${hl.label}</span> <span class="hl-time">${formatReplayTime(hl.tSec)}</span>`;
          pill.addEventListener('click', () => {
            debriefReplay.seekToTime(hl.tSec);
            debriefHighlightPillsEl.querySelectorAll('.highlight-pill.active').forEach((p) => p.classList.remove('active'));
            pill.classList.add('active');
          });
          debriefHighlightPillsEl.appendChild(pill);
        }
      } else {
        debriefHighlightPillsEl.hidden = true;
        debriefHighlightPillsEl.innerHTML = '';
      }
    }
  }

  // Multi-Dive Expedition Campaign Surface Interval, Campaign Rewards & Technical Rescue Drill Panel (v160 / v174)
  if (debriefCampaignBoxEl) {
    const camp = activeCampaignRun ? getExpeditionCampaignById(activeCampaignRun.campaignId) : null;
    if (activeRescueDrill && session?.activeRescueDrillId === activeRescueDrill.id) {
      const drillRes = evaluateRescueDrillResult(activeRescueDrill, session, { success });
      if (drillRes) {
        debriefCampaignBoxEl.hidden = false;
        if (drillRes.passed) {
          const recRes = recordRescueDrillClearInLogbook(loadCareerLogbook(), {
            drillId: activeRescueDrill.id,
            grade: drillRes.grade,
            timeSec: drillRes.elapsedSec,
            score: drillRes.score,
          });
          if (recRes?.book) saveCareerLogbook(recRes.book);
        }
        debriefCampaignBoxEl.innerHTML = `
          <div class="debrief-campaign-head">
            <span class="debrief-campaign-title">${activeRescueDrill.icon} ${escapeHtml(activeRescueDrill.name)} · ${drillRes.passed ? 'DRILL MASTERED!' : 'DRILL INCOMPLETE'}</span>
            <span class="campaign-patch-badge">🏅 Grade ${escapeHtml(drillRes.grade)} · ${drillRes.elapsedSec.toFixed(1)}s / ${drillRes.parTimeSec}s</span>
          </div>
          <div style="font-size:0.78rem;color:#cbd5e1;">${escapeHtml(drillRes.summary)}</div>
        `;
      }
    } else if (camp && activeCampaignRun) {
      debriefCampaignBoxEl.hidden = false;
      const curLegIdx = activeCampaignRun.legIndex || 0;
      const isFinalLeg = curLegIdx >= camp.legs.length - 1;
      if (success) {
        activeCampaignRun.totalScore = (activeCampaignRun.totalScore || 0) + (teamSummary.teamScore || 0);
        if (!activeCampaignRun.completedLegs.includes(level.id)) {
          activeCampaignRun.completedLegs.push(level.id);
        }
        if (isFinalLeg) {
          const patchRes = recordCampaignClearInLogbook(loadCareerLogbook(), camp.id);
          if (patchRes?.book) saveCareerLogbook(patchRes.book);
          const rewardBanner = camp.reward
            ? `<div class="campaign-reward-strip unlocked" style="margin-top:8px;"><span>🎁 Outfitter Unlocked: ${escapeHtml(camp.reward.label)}</span><button type="button" class="btn tiny primary" id="btn-campaign-equip-reward">🎨 Equip in Outfitter</button></div>`
            : '';
          debriefCampaignBoxEl.innerHTML = `
            <div class="debrief-campaign-head">
              <span class="debrief-campaign-title">${camp.icon} ${camp.name} · EXPEDITION COMPLETE!</span>
              <span class="campaign-patch-badge">🏅 ${camp.patchName}</span>
            </div>
            <div style="font-size:0.78rem;color:#cbd5e1;">All 3 legs cleared · Cumulative Score: <b>${activeCampaignRun.totalScore.toLocaleString()} pts</b> · Expedition Patch stitched to your Diver Logbook!</div>
            ${rewardBanner}
          `;
          debriefCampaignBoxEl.querySelector('#btn-campaign-equip-reward')?.addEventListener('click', () => {
            openLiveryModal();
          });
          activeCampaignRun = null;
  activeRescueDrill = null;
        } else {
          const nextLegId = camp.legs[curLegIdx + 1];
          const nextLvl = getLevelById(nextLegId);
          const rawComps = Array.isArray(diveState.compartments) ? diveState.compartments.map((c) => ({ ...c })) : [];
          const rawCns = Number(diveState.cnsPercent) || 0;
          const renderSiPanel = () => {
            const sim = computeSurfaceIntervalOffgas(rawComps, rawCns, activeCampaignRun.selectedIntervalId || 'standard');
            activeCampaignRun.residualTissues = sim;
            const btnsHtml = SURFACE_INTERVAL_OPTIONS.map(
              (o) =>
                `<button type="button" class="si-opt-btn${activeCampaignRun.selectedIntervalId === o.id ? ' active' : ''}" data-si-opt="${o.id}">${o.label}</button>`
            ).join('');
            debriefCampaignBoxEl.innerHTML = `
              <div class="debrief-campaign-head">
                <span class="debrief-campaign-title">${camp.icon} ${camp.name} · Leg ${curLegIdx + 1}/3 Cleared</span>
                <span class="debrief-campaign-load">Residual N₂: ${sim.residualLoadPct}% · CNS: ${Math.round(sim.cnsPercent)}%</span>
              </div>
              <div style="font-size:0.74rem;color:#94a3b8;">Surface Interval before <b>${nextLvl?.name || nextLegId}</b> (${sim.option.desc})</div>
              <div class="debrief-si-row">${btnsHtml}</div>
              <button type="button" class="btn primary tiny" id="btn-campaign-next-leg">🚀 LAUNCH LEG ${curLegIdx + 2}/3: ${nextLvl?.name || nextLegId} →</button>
            `;
            debriefCampaignBoxEl.querySelectorAll('[data-si-opt]').forEach((b) => {
              b.addEventListener('click', () => {
                activeCampaignRun.selectedIntervalId = b.getAttribute('data-si-opt');
                renderSiPanel();
              });
            });
            debriefCampaignBoxEl.querySelector('#btn-campaign-next-leg')?.addEventListener('click', async () => {
              activeCampaignRun.legIndex = curLegIdx + 1;
              cancelDebriefAnimations();
              audio.resetEnvironmentFilter();
              await selectAndLoadLevel(nextLegId);
              screenDebrief.hidden = true;
              debriefReplay.stop();
              launchOpenCoopDive();
            });
          };
          renderSiPanel();
        }
      } else {
        debriefCampaignBoxEl.innerHTML = `
          <div class="debrief-campaign-head">
            <span class="debrief-campaign-title">${camp.icon} ${camp.name} · Leg ${curLegIdx + 1}/3 Aborted</span>
            <span class="debrief-campaign-load" style="color:#f87171;">Retry Leg</span>
          </div>
          <div style="font-size:0.75rem;color:#cbd5e1;">Tap <b>DIVE AGAIN</b> to re-attempt Leg ${curLegIdx + 1}, or <b>MAIN MENU</b> to end the expedition.</div>
        `;
      }
    } else {
      debriefCampaignBoxEl.hidden = true;
      debriefCampaignBoxEl.innerHTML = '';
    }
  }
  replayTheater.setLastDebriefCardData({
    level,
    diverName: diver.name || playerNameInput?.value.trim() || 'Diver',
    success,
    grade: teamSummary.teamRank.grade,
    score: teamSummary.teamScore,
    maxDepthM: diveState.maxDepthM,
    diveTimeSec: diveState.diveTimeSec,
    exploredPct: teamSummary.exploredPct,
    difficulty: runDiff,
    customMixLabel: getCustomGasPlan().enabled ? diveState.mixes?.TMX1455?.name || '' : '',
    dailyBadge: session._dailyBadgeLabel || '',
    livery: diver.livery ? { ...diver.livery } : { ...liveryWorkshop.getActiveRigLivery() },
    hasCcr: Boolean(session.gear?.ccr),
    recoveredArtifacts: (level.collectibles || []).filter((it) => session.collectedIds?.has(it.id)),
    pinnedArtifact: getArtifactVaultStats(loadCareerLogbook(), LEVELS).pinnedArtifact || null,
    track: replayTrack,
    profile: session?.diveProfile ? session.diveProfile.slice() : [],
  });

  const runMs = session.runMilestones || {};
  let updatedLogbook = recordDiveInLogbook(loadCareerLogbook(), {
    levelId: level.id,
    success,
    score: teamSummary.teamScore,
    grade: teamSummary.teamRank.grade,
    maxDepthM: diveState.maxDepthM,
    diveTimeSec: diveState.diveTimeSec,
    difficulty: runDiff,
    milestones: {
      equalizedBulkheads: session.equalizedHatchIds?.size || 0,
      drillsCompleted: session.drills?.completedCount || 0,
      cleanSalvageLift: Boolean(success && runMs.usedLiftBagWithHeavySalvage && !runMs.floatUpIncident),
      zeroSiltCaveClear: Boolean(success && !level.isWreck && (runMs.heavySiltEvents || 0) === 0),
      contractsCompleted: (session.contracts || []).filter((c) => c.completed).length,
    },
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
  if (Array.isArray(session.aiSquad) && session.aiSquad.length > 0) {
    const squadIds = session.aiSquad.map((b) => b.id).filter(Boolean);
    const rescuedIds = session.aiSquad
      .filter((b) => b.rescued || (b.issuesResolvedCount || 0) > 0)
      .map((b) => b.id);
    updatedLogbook = recordCrewDiveInLogbook(updatedLogbook, squadIds, {
      cleared: Boolean(success),
      rescuedIds,
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
  if ((teamSummary.hatchBonusScore || 0) > 0) {
    rows.push({
      label: '⚙️ Watertight Hatches',
      pts: teamSummary.hatchBonusScore,
      pct: Math.min(100, Math.round((teamSummary.hatchBonusScore / 260) * 100)),
      cls: 'gold',
    });
  }
  const expOtherPts =
    (session.blackBoxBonusScore || 0) +
    (session.relayBonusScore || 0) +
    (session.smbBonusScore || 0) +
    (session.wildlifeHarmonyScore || 0);
  if (expOtherPts > 0) {
    rows.push({
      label: '🧭 Expedition Objectives (dSMB / Relays / Telemetry)',
      pts: expOtherPts,
      pct: Math.min(100, Math.round((expOtherPts / 500) * 100)),
      cls: 'green',
    });
  }
  if ((teamSummary.trimBonusScore || 0) > 0) {
    const trimPct = Math.round(session.trimStats?.disciplinePct ?? 100);
    const zeroSilt = Boolean(session.trimStats?.zeroSiltMaster);
    rows.push({
      label: `🐸 Frog-Kick Trim (${trimPct}%${zeroSilt ? ' · Zero-Silt Master' : ''})`,
      pts: teamSummary.trimBonusScore,
      pct: Math.min(100, Math.round((teamSummary.trimBonusScore / 250) * 100)),
      cls: 'green',
    });
  }
  if ((teamSummary.weatherBonusScore || 0) > 0) {
    rows.push({
      label: '🌊 Rough Sea / Weather Mastery',
      pts: teamSummary.weatherBonusScore,
      pct: Math.min(100, Math.round((teamSummary.weatherBonusScore / 250) * 100)),
      cls: 'purple',
    });
  }
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
  const doneContracts = (session.contracts || []).filter((c) => c.completed);
  if (doneContracts.length > 0) {
    const cPts = session.contractBonusScore || doneContracts.reduce((acc, c) => acc + (c.rewardPts || 150), 0);
    rows.push({
      label: `📋 Dive Contracts (${doneContracts.length}/${session.contracts.length})`,
      pts: cPts,
      pct: Math.round((doneContracts.length / Math.max(1, session.contracts.length)) * 100),
      cls: 'green',
    });
  }
  if ((session.aiLeadBonusScore || 0) > 0 || (session.aiBuddiesRescued || 0) > 0) {
    const leadPts = (session.aiLeadBonusScore || 0) + (session.aiBuddiesRescued || 0) * 450;
    const solved = session.aiIssuesResolved || 0;
    const rescued = session.aiBuddiesRescued || 0;
    rows.push({
      label: `🏅 Hardcore Squad Lead (${solved} solved${rescued > 0 ? ` · ${rescued} towed` : ''})`,
      pts: leadPts,
      pct: 100,
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

  // Collectibles Trophy Shelf — renders actual bespoke artifact close-ups for every recovered relic (v168)
  const artifactsEl = document.getElementById('debrief-artifacts');
  const levelCollectibles = level.collectibles || [];
  const recoveredList = levelCollectibles.filter((it) => session.collectedIds?.has(it.id));
  const missedList = levelCollectibles.filter((it) => !session.collectedIds?.has(it.id));
  const shelfHtml =
    recoveredList.length > 0
      ? `<div class="debrief-artifact-shelf">${recoveredList
          .map(
            (item, idx) => `<div class="debrief-artifact-chip" title="${escapeHtml(item.name)} (+${item.points} pts)">
              <canvas class="debrief-art-canvas" data-debrief-art="${idx}" width="76" height="76" aria-hidden="true"></canvas>
              <div class="debrief-artifact-chip-copy">
                <strong>${(item.scale || 1) >= 1.35 ? '★ ' : ''}${escapeHtml(item.name)}</strong>
                <span>+${item.points} PTS</span>
              </div>
            </div>`
          )
          .join('')}</div>`
      : '';
  const missedHtml = missedList
    .map((item, idx) => {
      const star = (item.scale || 1) >= 1.35 ? '★ ' : '';
      return `<span class="artifact-chip" style="animation-delay:${idx * 40}ms">${star}${escapeHtml(item.name)}</span>`;
    })
    .join('');
  artifactsEl.innerHTML = shelfHtml + missedHtml;
  artifactsEl.querySelectorAll('canvas.debrief-art-canvas').forEach((cv) => {
    const idx = Number(cv.getAttribute('data-debrief-art'));
    const it = recoveredList[idx];
    const ctx = cv.getContext?.('2d');
    if (!ctx || !it) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    drawStyledArtifact(ctx, it, cv.width * 0.5, cv.height * 0.5, cv.width * 0.35, 2.2, {
      index: idx,
      isGrand: (it.scale || 1) >= 1.35,
    });
  });

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
        leaderboardCtrl.setLastDebriefEntries((res.entries || []).slice(0, 5));
        debriefLeaderboardEl.hidden = false;
        debriefLeaderboardEl.innerHTML = `
          <div class="debrief-lb-head">
            <span class="debrief-section-title" style="margin:0">${boardLabel} · ${escapeHtml(level.name)}</span>
            <span class="debrief-lb-rank">${escapeHtml(rankText)}</span>
          </div>
          ${renderLeaderboardRowsHtml(leaderboardCtrl.getLastDebriefEntries(), { highlightKey: res.entry?.entryKey })}
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

// ── Leaderboard & Career Summary Controller (modularized v172) ──
const leaderboardCtrl = createLeaderboardController({
  github,
  leaderboard,
  loadCareerLogbook,
  getActiveLevel: () => activeLevel,
  getDifficultyMeta,
  renderModeBadgeHtml,
  formatRunClock,
  getLbMode: () => lbMode,
  getLbFilterLevelId: () => lbFilterLevelId,
  setLbFilterLevelId: (v) => {
    lbFilterLevelId = v;
  },
  els: {
    lbStatsModalEl,
    lbStatsBodyEl,
    lbStatsKickerEl,
    lbStatsTitleEl,
    lbStatsSubEl,
    lbCareerSummaryEl,
    selectLbSite,
    leaderboardRowsEl,
    leaderboardSubEl,
  },
});
const {
  closeLeaderboardStatsModal,
  openLeaderboardStatsModal,
  renderLeaderboardRowsHtml,
  renderCareerSummary,
  populateLbSiteSelect,
  refreshMenuLeaderboard,
} = leaderboardCtrl;

// (Career Logbook helpers moved to top of main.js to eliminate startup TDZ for Gear Workshop & Tech Gear)

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
    livery: diver.livery ? { ...diver.livery } : null,
    alive: diveState.alive,
    carryingBody: Boolean(sess.carryingBody),
    rescueTargetId: sess.rescueTargetId || '',
    rescuedBy: sess.rescuedBy || '',
    rescued: Boolean(sess.rescued),
    name: diver.name,
    ...overrides,
  };
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
  if (typeof setCoopDockExpanded === 'function') setCoopDockExpanded(true);
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
  if (siteBrowser.getSiteCategoryFilter() !== 'all' && !getFilteredLevels().some((l) => l.id === nextLevel.id)) {
    setSiteCategoryFilter('all');
  }
  if (focusMap) {
    siteBrowser.setMapZoomMode('site');
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
    siteBrowser.setMapZoomMode(siteBrowser.getMapZoomMode() === 'site' ? 'global' : 'site');
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
    if (nextCat === siteBrowser.getSiteCategoryFilter()) return;
    setSiteCategoryFilter(nextCat);
    const visible = getFilteredLevels();
    if (visible.length > 0 && !visible.some((l) => l.id === activeLevel.id) && !(lan.room && !lan.isHost())) {
      selectAndLoadLevel(visible[0].id, { focusMap: siteBrowser.getMapZoomMode() === 'site' });
    } else {
      renderLevelCards();
    }
    retriggerAnim(siteBrowserEl, 'anim-view-morph');
  });
}

const btnCycleSiteView = document.getElementById('btn-cycle-site-view');
const btnSetupDrawerEl = document.getElementById('btn-setup-drawer');
const diveSetupModalEl = document.getElementById('dive-setup-modal');
const btnSetupCloseEl = document.getElementById('btn-setup-close');
const btnSetupDoneEl = document.getElementById('btn-setup-done');
const btnSetupResetEl = document.getElementById('btn-setup-reset');

function getSetupModeDescription(diffId) {
  if (diffId === 'guided') {
    return 'Guided Mode: Gentle silt & currents with full compass guidance. With AI Squad active, Pro Instructors lead you to every artifact & lore landmark and actively stabilize your vitals so you stay safe.';
  }
  if (diffId === 'hardcore') {
    return 'Hardcore Mode: No compass coaching, physical diver-to-diver collision, aggressive silt & strict physiology. With AI Squad active, unhelpful rookies rely on YOU to lead them through emergencies & tow downed buddies home (+175/+450 pts)!';
  }
  return 'Standard Tech: Balanced technical cave & wreck diving. With AI Squad active, Expert Co-Divers flank your trim, spotlight nearby artifacts, obey signals & back you up in true emergencies.';
}

function openDiveSetupModal() {
  const modal = document.getElementById('dive-setup-modal');
  if (!modal) return;
  setHomeMenuOpen(false);
  renderTechGearDock();
  modal.hidden = false;
  syncSetupDrawerSummary();
}

function closeDiveSetupModal() {
  const modal = document.getElementById('dive-setup-modal');
  if (!modal) return;
  modal.hidden = true;
  syncSetupDrawerSummary();
}

function syncSetupDrawerSummary() {
  const btn = document.getElementById('btn-setup-drawer');
  const modal = document.getElementById('dive-setup-modal');
  const resetBtn = document.getElementById('btn-setup-reset');
  let activeCount = 0;
  let modeMod = false;
  let weatherMod = false;
  let liveryMod = false;
  let gasMod = false;
  let drillsMod = false;
  let aiMod = false;
  let mutMod = false;
  let procMod = false;
  let currentDiff = 'standard';
  let currentWeatherPref = 'clear-day';
  let currentLivery = DEFAULT_RIG_LIVERY;
  let currentMutId = '';
  try {
    currentDiff = activeDifficulty || 'standard';
    modeMod = currentDiff !== 'standard';
    if (modeMod) activeCount++;
  } catch {}
  try {
    currentWeatherPref = weatherPrefId || 'clear-day';
    weatherMod = currentWeatherPref !== 'clear-day';
    if (weatherMod) activeCount++;
  } catch {}
  try {
    currentLivery = liveryWorkshop.getActiveRigLivery() || DEFAULT_RIG_LIVERY;
    liveryMod = !isDefaultRigLivery(currentLivery);
    if (liveryMod) activeCount++;
  } catch {}
  try {
    gasMod = Boolean(getCustomGasPlan()?.enabled);
    if (gasMod) activeCount++;
  } catch {}
  try {
    drillsMod = Boolean(drillsEnabled);
    if (drillsMod) activeCount++;
  } catch {}
  let currentAiCount = 0;
  try {
    currentAiCount = aiSquadCount || 0;
    aiMod = currentAiCount > 0;
    if (aiMod) activeCount++;
  } catch {}
  let roleMod = false;
  let currentRole = getCrewRole('balanced');
  try {
    currentRole = getCrewRole(activeCrewRoleId);
    roleMod = currentRole.id !== 'balanced';
    if (roleMod) activeCount++;
  } catch {}
  try {
    currentMutId = sandboxCtrl.getActiveSandboxMutatorId() || '';
    mutMod = Boolean(currentMutId);
    if (mutMod) activeCount++;
  } catch {}
  try {
    procMod = Boolean(activeLevel?.isProcedural);
    if (procMod) activeCount++;
  } catch {}
  try {
    const effGear = getEffectiveGearLoadout();
    if (effGear.sonar) activeCount++;
    if (effGear.dpv) activeCount++;
    if (effGear.ccr) activeCount++;
  } catch {}

  const isOpen = Boolean(modal && !modal.hidden);
  if (btn) {
    btn.textContent = activeCount > 0 ? `⚙️ Dive Setup · ${activeCount}` : '⚙️ Dive Setup';
    btn.classList.toggle('has-mods', activeCount > 0);
    btn.classList.toggle('open', isOpen);
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  // Update active card highlights & readable live descriptions inside the Dive Setup Panel
  document.getElementById('setup-card-mode')?.classList.toggle('active-card', modeMod);
  document.getElementById('setup-card-weather')?.classList.toggle('active-card', weatherMod);
  document.getElementById('setup-card-livery')?.classList.toggle('active-card', liveryMod);
  document.getElementById('setup-card-ai')?.classList.toggle('active-card', aiMod);
  document.getElementById('setup-card-role')?.classList.toggle('active-card', roleMod);
  document.getElementById('setup-card-gas')?.classList.toggle('active-card', gasMod);
  document.getElementById('setup-card-drills')?.classList.toggle('active-card', drillsMod);
  document.getElementById('setup-card-mutator')?.classList.toggle('active-card', mutMod);
  document.getElementById('setup-card-proc')?.classList.toggle('active-card', procMod);

  const modeDescEl = document.getElementById('setup-mode-desc');
  if (modeDescEl) {
    modeDescEl.textContent = getSetupModeDescription(currentDiff);
  }
  const weatherDescEl = document.getElementById('setup-weather-desc');
  if (weatherDescEl) {
    const rw = resolveEffectiveWeather(currentWeatherPref, { level: activeLevel });
    weatherDescEl.textContent =
      currentWeatherPref === 'auto'
        ? `Live Auto (${rw.icon} ${rw.label}): ${rw.desc}`
        : rw.desc;
  }
  const liveryDescEl = document.getElementById('setup-livery-desc');
  if (liveryDescEl) {
    const suit = getSuitLivery(currentLivery.suitId);
    const torch = getTorchOptic(currentLivery.torchId);
    const patch = getMilestonePatch(currentLivery.patchId);
    liveryDescEl.textContent = liveryMod
      ? `Equipped: ${suit.name} · ${torch.name} (${torch.specText}) · Patch: ${patch.name}.`
      : 'Customize drysuit livery, primary torch optics (Halogen, Amber Silt-Piercer, Emerald Spot) & career harness patches.';
  }
  const aiDescEl = document.getElementById('setup-ai-desc');
  if (aiDescEl) {
    const aiProf = getAiDifficultyProfile(currentDiff);
    if (currentAiCount > 0) {
      const names = AI_SQUAD_ROSTER.slice(0, currentAiCount).map((r) => r.name.replace(/^🤖\s*/, '')).join(', ');
      aiDescEl.textContent = `${aiProf.badge} · ${currentAiCount + 1}-Diver Squad (${names}): ${aiProf.shortDesc}`;
    } else {
      aiDescEl.textContent = `Cycle 1–3 AI wingmen (APEX-2, COBRA-3, ORCA-4). Active profile in this mode — ${aiProf.badge}: ${aiProf.shortDesc}`;
    }
  }
  const gasDescEl = document.getElementById('setup-gas-desc');
  if (gasDescEl) {
    if (gasMod) {
      try {
        const targetDepthM = getLevelMaxDepthM(activeLevel) || 50;
        const b = buildCustomGasBlend({
          o2Pct: getCustomGasPlan().o2Pct,
          hePct: getCustomGasPlan().hePct,
          targetDepthM,
          baseGas: getSiteDefaultBottomMix(activeLevel),
        });
        gasDescEl.textContent = `Active custom bottom mix: ${b.name} (MOD ${Math.round(b.mod14M)}m · END ${Math.round(b.endAtTargetM)}m at ${Math.round(targetDepthM)}m). Tap to adjust or revert.`;
      } catch {
        gasDescEl.textContent = 'Custom bottom gas blend active. Tap to adjust or revert to site defaults.';
      }
    } else {
      gasDescEl.textContent = 'Customize your bottom Trimix or Nitrox O₂ & Helium ratios to fine-tune MOD, oxygen toxicity, and narcosis depth.';
    }
  }
  const mutDescEl = document.getElementById('setup-mutator-desc');
  if (mutDescEl) {
    const mut = currentMutId ? getDailyMutatorById(currentMutId) : null;
    mutDescEl.textContent = mut
      ? `Active mutator: ${mut.icon} ${mut.name} — ${mut.shortDesc}`
      : 'Activate extreme visibility, current, or gear mutators and generate shareable head-to-head challenge links.';
  }
  const procDescEl = document.getElementById('setup-proc-desc');
  if (procDescEl) {
    procDescEl.textContent = procMod
      ? `Active procedural sump: ${activeLevel.name} (Max ${activeLevel.maxDepthM || '?'}m). Tap to roll a new seed, tier, or biome.`
      : 'Generate infinite deterministic seeded cave expeditions across 4 technical depth tiers and 5 distinct geological biomes.';
  }
  if (resetBtn) {
    resetBtn.disabled = activeCount === 0;
  }
}

document.getElementById('btn-home-open-setup')?.addEventListener('click', () => {
  setHomeMenuOpen(false);
  openDiveSetupModal();
});
document.getElementById('btn-home-open-livery')?.addEventListener('click', () => {
  setHomeMenuOpen(false);
  openLiveryModal();
});

// Collapsible Co-op Join Dock on Home Screen (v143)
const btnCoopDockToggle = document.getElementById('btn-coop-dock-toggle');
function setCoopDockExpanded(expanded) {
  if (!lanSetupControls) return;
  lanSetupControls.classList.toggle('collapsed', !expanded);
  if (btnCoopDockToggle) {
    btnCoopDockToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    btnCoopDockToggle.textContent = expanded ? 'Hide ▴' : 'Join Code ▾';
  }
}
btnCoopDockToggle?.addEventListener('click', () => {
  const isCollapsed = lanSetupControls?.classList.contains('collapsed');
  setCoopDockExpanded(Boolean(isCollapsed));
  if (isCollapsed) {
    try { roomCodeInput?.focus(); } catch {}
  }
});

// Compact / Immersion HUD Mode Toggle & Mobile Secondary Tools Drawer (v143)
const COMPACT_HUD_KEY = 'caveDiverCompactHud_v1';
let compactHudEnabled = false;
try {
  compactHudEnabled = localStorage.getItem(COMPACT_HUD_KEY) === '1';
} catch {}
const btnHudCompactEl = document.getElementById('btn-hud-compact');
function syncCompactHudUi() {
  screenHud?.classList.toggle('hud-compact', compactHudEnabled);
  if (btnHudCompactEl) {
    btnHudCompactEl.textContent = compactHudEnabled ? '👁️ HUD: Compact' : '👁️ HUD: Full';
    btnHudCompactEl.classList.toggle('active', compactHudEnabled);
  }
}
syncCompactHudUi();
btnHudCompactEl?.addEventListener('click', () => {
  compactHudEnabled = !compactHudEnabled;
  try { localStorage.setItem(COMPACT_HUD_KEY, compactHudEnabled ? '1' : '0'); } catch {}
  syncCompactHudUi();
  setHudMenuOpen(false);
  showToast(compactHudEnabled ? '👁️ Compact Immersion HUD enabled' : '👁️ Full Technical HUD restored', 1.8);
});
const btnHudPhotoStudioEl = document.getElementById('btn-hud-photo-studio');
btnHudPhotoStudioEl?.addEventListener('click', () => {
  setHudMenuOpen(false);
  setPhotoModeActive(true);
});

const btnHudGearMoreEl = document.getElementById('btn-hud-gear-more');
const hudKitPopoverEl = document.getElementById('hud-kit-popover');
function setKitPopoverOpen(open) {
  const next = Boolean(open);
  if (next && typeof hud !== 'undefined') hud?.setGasDrawerOpen?.(false);
  if (hudKitPopoverEl) hudKitPopoverEl.hidden = !next;
  if (btnHudGearMoreEl) {
    btnHudGearMoreEl.classList.toggle('open', next);
    btnHudGearMoreEl.setAttribute('aria-expanded', next ? 'true' : 'false');
    const caret = btnHudGearMoreEl.querySelector('.kit-caret');
    if (caret) caret.textContent = next ? '▾' : '▴';
  }
}
btnHudGearMoreEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  const currentlyOpen = Boolean(hudKitPopoverEl && !hudKitPopoverEl.hidden);
  setKitPopoverOpen(!currentlyOpen);
});
document.addEventListener('pointerdown', (e) => {
  if (!hudKitPopoverEl || hudKitPopoverEl.hidden) return;
  if (hudGearDockEl && hudGearDockEl.contains(e.target)) return;
  setKitPopoverOpen(false);
});

btnSetupDrawerEl?.addEventListener('click', () => {
  if (diveSetupModalEl && !diveSetupModalEl.hidden) closeDiveSetupModal();
  else openDiveSetupModal();
});
btnSetupCloseEl?.addEventListener('click', closeDiveSetupModal);
btnSetupDoneEl?.addEventListener('click', closeDiveSetupModal);
diveSetupModalEl?.addEventListener('click', (e) => {
  if (e.target === diveSetupModalEl) closeDiveSetupModal();
});
btnSetupResetEl?.addEventListener('click', () => {
  if (activeDifficulty !== 'standard') {
    activeDifficulty = 'standard';
    try { localStorage.setItem(DIFFICULTY_PREF_KEY, activeDifficulty); } catch {}
    syncPreferenceMenuButtons();
  }
  if (weatherPrefId !== 'clear-day') {
    weatherPrefId = 'clear-day';
    try { localStorage.setItem(WEATHER_PREF_KEY, weatherPrefId); } catch {}
    syncWeatherUi();
  }
  if (aiSquadCount > 0) {
    aiSquadCount = 0;
    try { localStorage.setItem(AI_BUDDY_PREF_KEY, '0'); } catch {}
    syncAiBuddyUi();
  }
  if (activeCrewRoleId !== 'balanced') {
    activeCrewRoleId = 'balanced';
    try { localStorage.setItem(CREW_ROLE_PREF_KEY, activeCrewRoleId); } catch {}
    syncCrewRoleUi();
  }
  if (drillsEnabled) {
    drillsEnabled = false;
    try { localStorage.setItem(DRILLS_PREF_KEY, '0'); } catch {}
    syncDrillsUi();
  }
  if (getCustomGasPlan()?.enabled) {
    getCustomGasPlan().enabled = false;
    saveCustomGasPlan();
    syncGasPlanBadges();
  }
  if (sandboxCtrl.getActiveSandboxMutatorId()) {
    sandboxCtrl.setActiveSandboxMutatorId('');
    syncSandboxPillUi();
  }
  if (activeLevel?.isProcedural) {
    if (menuProcPillEl) {
      menuProcPillEl.textContent = '∞ Endless';
      menuProcPillEl.classList.remove('active');
    }
    selectAndLoadLevel(DEFAULT_LEVEL_ID);
  }
  if (savedGearLoadout.sonar || savedGearLoadout.dpv || savedGearLoadout.ccr) {
    savedGearLoadout = { sonar: false, dpv: false, ccr: false };
    saveGearLoadout();
    renderTechGearDock();
    renderHomeAvatarBadge();
  }
  syncSetupDrawerSummary();
  showToast('↺ Dive Setup reset to Standard Tech defaults.', 2.2);
});
syncSetupDrawerSummary();

const SITE_VIEW_ORDER = ['split', 'map', 'list'];
const SITE_VIEW_LABELS = { split: '◫ Split', map: '🗺 Map', list: '☰ List' };

function applySiteViewMode(nextMode) {
  const cleanMode = nextMode === 'map' || nextMode === 'list' ? nextMode : 'split';
  if (cleanMode === siteBrowser.getSiteViewMode() && siteBrowserEl?.classList.contains(`view-${cleanMode}`)) return;
  siteBrowser.setSiteViewMode(cleanMode);
  if (btnCycleSiteView) {
    btnCycleSiteView.textContent = SITE_VIEW_LABELS[cleanMode] || '◫ Split';
  }
  if (siteBrowserEl) {
    siteBrowserEl.className = `site-browser view-${siteBrowser.getSiteViewMode()}`;
    retriggerAnim(siteBrowserEl, 'anim-view-morph');
  }
  if (cleanMode !== 'list') {
    renderSiteWorldMap({ instantZoom: false });
  }
}

btnCycleSiteView?.addEventListener('click', () => {
  const idx = SITE_VIEW_ORDER.indexOf(siteBrowser.getSiteViewMode());
  const next = SITE_VIEW_ORDER[(idx + 1) % SITE_VIEW_ORDER.length];
  applySiteViewMode(next);
});

async function launchOpenCoopDive() {
  const diverName = requireCallsign();
  if (!diverName) return false;
  activeDailyChallenge = null;
  activeRescueDrill = null;
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
  activeRescueDrill = null;
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
  closeDailyCalendarModal();
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
    const entry = Number.isInteger(idx) ? leaderboardCtrl.getLastMenuEntries()[idx] : null;
    if (entry) openLeaderboardStatsModal(entry, idx + 1);
  }
});

debriefLeaderboardEl?.addEventListener('click', (e) => {
  const rowBtn = e.target.closest('button[data-lb-idx]');
  if (!rowBtn) return;
  const idx = Number(rowBtn.dataset.lbIdx);
  const entry = Number.isInteger(idx) ? leaderboardCtrl.getLastDebriefEntries()[idx] : null;
  if (entry) openLeaderboardStatsModal(entry, idx + 1);
});

btnLbStatsClose?.addEventListener('click', closeLeaderboardStatsModal);
lbStatsModalEl?.addEventListener('click', (e) => {
  if (e.target === lbStatsModalEl) closeLeaderboardStatsModal();
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
    const targetPeer = getActivePeers().find((p) => p && p.id === targetId);
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
    const shared = shareGasWithTargetPeer(targetPeer, targetGas);
    if (shared) btn.hidden = true;
    return;
  }
  if (btn.id === 'btn-tow-buddy') {
    const peer = getActivePeers().find((p) => p && p.id === btn.dataset.targetId);
    if (peer) attachBuddyTow(peer);
    btn.hidden = true;
    return;
  }
  if (btn.id === 'btn-drop-tow') {
    if (session.rescueTargetId) {
      const dropped = getActivePeers().find((p) => p && p.id === session.rescueTargetId);
      const droppedId = session.rescueTargetId;
      const droppedName = dropped?.name || 'Buddy';
      if (dropped) dropped.rescuedBy = '';
      session.rescueTargetId = null;
      session.diver.rescueTargetId = '';
      if (isMultiplayer && !dropped?.isAiBuddy) {
        lan.sendBuddyRescue(droppedId, droppedName, 'dropped');
      }
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

// Global Escape dismissal is centralized in closeTopmostOverlay() above (v143).

// Auto-resume AudioContext on any gesture after iOS Safari interruption or background tab suspend
function resumeAudioOnGesture() {
  if (!audio.muted && audio.ctx && audio.ctx.state !== 'running') {
    audio.unlock();
  }
}
window.addEventListener('pointerdown', resumeAudioOnGesture, { passive: true });
window.addEventListener('keydown', resumeAudioOnGesture, { passive: true });

// Safari Anti-Zoom-Trap & Accidental Pinch-Zoom Guard (v152):
// 1. Blocks accidental pinch-zoom-IN during dual-thumb diving at normal 1.0x scale.
// 2. NEVER traps the player if Safari zooms in anyway (e.g. input focus / rotation):
//    when visualViewport.scale > 1.02, pinch-OUT is always permitted and zoom auto-resets.
const BASE_VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
let _viewportResetTimer = 0;

function getVisualViewportScale() {
  const s = typeof window !== 'undefined' ? window.visualViewport?.scale : 1;
  return Number.isFinite(s) && s > 0 ? s : 1;
}

function resetSafariViewportZoom(force = false) {
  const scale = getVisualViewportScale();
  if (!force && scale <= 1.02) return;
  try {
    window.scrollTo(0, 0);
  } catch {}
  const vpMeta = document.querySelector?.('meta[name="viewport"]');
  if (vpMeta && scale > 1.02) {
    // Re-applying viewport content across a frame nudges WebKit Safari to snap scale cleanly back to 1.0
    vpMeta.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
    );
    clearTimeout(_viewportResetTimer);
    _viewportResetTimer = setTimeout(() => {
      vpMeta.setAttribute('content', BASE_VIEWPORT_CONTENT);
      try {
        window.scrollTo(0, 0);
      } catch {}
      renderer?.resize?.(true);
    }, 60);
  } else {
    renderer?.resize?.(true);
  }
}

const preventPinchGesture = (e) => {
  const vvScale = getVisualViewportScale();
  // If Safari is already zoomed in, allow pinching OUT (e.scale < 1) so the user is never stuck!
  if (vvScale > 1.02) {
    if (e.type === 'gesturechange' && typeof e.scale === 'number' && e.scale > 1.01) {
      e.preventDefault();
    }
    return;
  }
  e.preventDefault();
};
document.addEventListener('gesturestart', preventPinchGesture, { passive: false });
document.addEventListener('gesturechange', preventPinchGesture, { passive: false });
document.addEventListener('gestureend', preventPinchGesture, { passive: false });
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches && e.touches.length > 1) {
      // Allow two-finger pinch-out recovery whenever Safari is currently zoomed in (> 1.02x)
      if (getVisualViewportScale() > 1.02) return;
      e.preventDefault();
    }
  },
  { passive: false }
);
// Prevent iOS Safari rapid double-tap zoom on non-interactive background space
// (never cancels synthetic click on buttons, links, inputs, or sticks; those use CSS touch-action: manipulation/none)
let _lastTouchEndAt = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const tgt = e.target;
    if (tgt?.closest?.('button, a, input, select, textarea, label, summary, [role="button"], .touch-stick')) return;
    const now = performance.now();
    if (now - _lastTouchEndAt < 280 && e.touches?.length === 0 && getVisualViewportScale() <= 1.02) {
      e.preventDefault();
    }
    _lastTouchEndAt = now;
  },
  { passive: false }
);
document.addEventListener('focusout', (e) => {
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
    setTimeout(() => resetSafariViewportZoom(false), 120);
  }
});
window.addEventListener('orientationchange', () => {
  setTimeout(() => resetSafariViewportZoom(true), 180);
});
window.visualViewport?.addEventListener?.('resize', () => {
  renderer?.resize?.(true);
  if (!screenMenu.hidden) syncMenuDescToggle();
});

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
  if (siteBrowser.getSiteCategoryFilter() !== 'todo') return;
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
  setPhotoModeActive(false);
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
  toggleSurveySlate(false);
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

const btnAbortEl = document.getElementById('btn-abort');
let abortDisarmTimer = null;
function resetAbortArmState() {
  pendingAbortAt = 0;
  if (abortDisarmTimer) {
    clearTimeout(abortDisarmTimer);
    abortDisarmTimer = null;
  }
  if (btnAbortEl) {
    btnAbortEl.classList.remove('armed');
    btnAbortEl.textContent = '✕';
  }
}
btnAbortEl?.addEventListener('click', () => {
  const inLiveDive = mode === 'diving' && session && !session.endedState && !divePaused;
  const elapsed = Math.max(session?.diveState?.diveTimeSec || 0, session?.simTimeSec || 0);
  if (inLiveDive && elapsed > 3) {
    const now = performance.now();
    if (now - pendingAbortAt > 3000) {
      pendingAbortAt = now;
      btnAbortEl.classList.add('armed');
      btnAbortEl.textContent = '✕?';
      if (abortDisarmTimer) clearTimeout(abortDisarmTimer);
      abortDisarmTimer = setTimeout(resetAbortArmState, 3050);
      showToast('Tap ✕ again within 3s to abort dive', 2.8);
      return;
    }
  }
  resetAbortArmState();
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
  const retryDrill = Boolean(session?.activeRescueDrillId && activeRescueDrill);
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
  if (retryDrill) {
    launchRescueDrill(activeRescueDrill);
  } else if (retryDaily) {
    launchDailyChallenge(activeDailyChallenge);
  } else {
    launchOpenCoopDive();
  }
});

document.getElementById('btn-menu').addEventListener('click', () => {
  activeCampaignRun = null;
  activeRescueDrill = null;
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

function shareGasWithTargetPeer(targetPeer, preferredGasId = '') {
  if (!session || !targetPeer || targetPeer.alive === false || targetPeer.surfaced) return false;
  const targetGas = preferredGasId || targetPeer.gasId || session.diveState.activeGasId;
  const targetName = targetPeer.name || 'Buddy';
  const candidate = getShareableGasCandidate(session.diveState, targetGas, 25, session.diveState.depthM);
  if (!candidate) {
    showToast('No safe gas cylinder with enough reserve to share here.', 2.2);
    return false;
  }
  const donation = donateGasFromState(session.diveState, candidate.gasId, candidate.donatedBar);
  if (!donation) {
    showToast('Reserve too low to share gas safely.', 2.0);
    return false;
  }
  if (targetPeer.isAiBuddy) {
    if (session?.rescueDrillMeta) session.rescueDrillMeta.sharedGasWithBuddy = true;
  receiveGasForAiBuddy(targetPeer, donation.donatedBar, donation.gasId, session, performance.now(), {
      onBuddyIssueResolved: (buddy, issue, info) => {
        audio.playDrillClear?.();
        showToast(
          `🏅 Rescued ${buddy.name} from ${issue.title} via long hose (+${info.bonusPts} Leadership pts)!`,
          3.8
        );
      },
    });
  } else if (isMultiplayer) {
    lan.sendGasShare(targetPeer.id, donation.gasId, donation.donatedBar);
  }
  pushAirShareBeam(session, {
    peerId: targetPeer.id,
    peerName: targetName,
    fromSelf: true,
    gasId: donation.gasId,
    amountBar: donation.donatedBar,
  });
  audio.playGasShare();
  showToast(`🎁 Shared +${donation.donatedBar} bar ${getActiveGasName(donation.gasId)} with ${targetName}!`, 2.8);
  return true;
}

function attachBuddyTow(peer) {
  if (!session || !peer || peer.alive !== false || peer.rescued) return false;
  session.rescueTargetId = peer.id;
  session.diver.rescueTargetId = peer.id;
  peer.rescuedBy = lan.clientId || 'self';
  audio.playRecovery();
  showToast(`🛟 Towing ${peer.name || 'Buddy'}! Haul safely through deco to surface exit (+450 pts)!`, 3.6);
  if (isMultiplayer && !peer.isAiBuddy) {
    lan.sendBuddyRescue(peer.id, peer.name || 'Buddy', 'towing');
  }
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
const hudArtifactSpotlightEl = document.getElementById('hud-artifact-spotlight');
const hudArtifactCanvasEl = document.getElementById('hud-artifact-canvas');
const hudArtifactTagEl = document.getElementById('hud-artifact-tag');
const hudArtifactPtsEl = document.getElementById('hud-artifact-pts');
const hudArtifactNameEl = document.getElementById('hud-artifact-name');
const hudArtifactLoreEl = document.getElementById('hud-artifact-lore');
let _artifactSpotlightTimer = 0;

function hideArtifactSpotlight() {
  if (_artifactSpotlightTimer) {
    clearTimeout(_artifactSpotlightTimer);
    _artifactSpotlightTimer = 0;
  }
  if (hudArtifactSpotlightEl) {
    hudArtifactSpotlightEl.hidden = true;
  }
}

function showArtifactSpotlight(item, lore = '', isNew = false) {
  if (!hudArtifactSpotlightEl || !item) return;
  hideHudPhotoCard();
  if (_artifactSpotlightTimer) {
    clearTimeout(_artifactSpotlightTimer);
    _artifactSpotlightTimer = 0;
  }
  if (hudArtifactTagEl) {
    hudArtifactTagEl.textContent = isNew ? '✨ NEW VAULT RELIC' : '🏛️ RELIC RECOVERED';
  }
  if (hudArtifactPtsEl) {
    hudArtifactPtsEl.textContent = `+${Math.round(Number(item.points) || 0)} PTS`;
  }
  if (hudArtifactNameEl) {
    hudArtifactNameEl.textContent = item.name || 'Recovered Artifact';
  }
  if (hudArtifactLoreEl) {
    hudArtifactLoreEl.textContent = lore || 'Added to your Career Artifact Trophy Vault.';
  }
  const ctx = hudArtifactCanvasEl?.getContext?.('2d');
  if (ctx && hudArtifactCanvasEl) {
    ctx.clearRect(0, 0, hudArtifactCanvasEl.width, hudArtifactCanvasEl.height);
    drawStyledArtifact(ctx, item, hudArtifactCanvasEl.width * 0.5, hudArtifactCanvasEl.height * 0.5, hudArtifactCanvasEl.width * 0.35, 2.2, {
      index: 0,
      isGrand: (item.scale || 1) >= 1.35,
    });
  }
  hudArtifactSpotlightEl.hidden = false;
  _artifactSpotlightTimer = setTimeout(() => {
    hudArtifactSpotlightEl.hidden = true;
    _artifactSpotlightTimer = 0;
  }, 4200);
}

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
  onValveEqualize: () => {
    audio.playValveEqualize();
  },
  onLiftBagToggle: (inflated) => {
    audio.playLiftBag(inflated);
  },
  onLineCut: () => audio.playLineCut(),
  onClipLine: (clipped) => audio.playClipLine(clipped),
  onStageRefill: () => audio.playGasShare(),
  onMarkerPlaced: () => audio.playClipLine(true),
  onEncounterSpawn: (visitor) => audio.playEncounterChime(visitor?.kind || 'whaleshark'),
  onBeaconClaimed: () => audio.playEncounterChime('beacon'),
  onBlackBoxPing: (_bb, distM, pan) => audio.playBlackBoxPing?.(distM, pan),
  onBlackBoxRecovered: () => audio.playEncounterChime('beacon'),
  onPowerRelay: () => audio.playBreakerSwitch?.(),
  onSmbDeploy: () => {
    audio.playSmbDeploy?.();
    if (btnHudSmb) {
      btnHudSmb.innerHTML = `<span class="kit-item-label">🎈 SMB Flying</span><span class="kbd-hint kit-kbd">✓</span>`;
      btnHudSmb.disabled = true;
    }
  },
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
    let splitSuffix = '';
    const pbSec = session?._pbSplits?.[cp.id];
    if (Number.isFinite(pbSec) && Number.isFinite(session?.simTimeSec)) {
      splitSuffix = ` · ${formatSplitDelta(session.simTimeSec - pbSec)} vs ${session._pbSplitsLabel || 'PB'}`;
    }
    showToast(`✓ ${cp.name}${splitSuffix} — ${cp.hint}`, 3.8);
    if (isMultiplayer) lan.sendCheckpoint(cp.id);
  },
  onCollect: (item) => {
    const isGrand = (item.scale || 1) >= 1.35;
    if (typeof audio.playArtifactDiscover === 'function') audio.playArtifactDiscover(isGrand);
    else audio.playCollect();
    const lore = getCollectibleLoreNote(item, session?.level);
    let isNew = false;
    try {
      const siteId = session?.level?.id || '';
      const artifactKey = siteId && !String(item.id || '').includes(':') ? `${siteId}:${item.id}` : item.id;
      const res = recordArtifactInLogbook(loadCareerLogbook(), {
        id: artifactKey,
        name: item.name,
        kind: item.kind,
        siteId,
        siteName: session?.level?.name || '',
        lore,
        points: item.points || 0,
        scale: item.scale || 1,
      });
      isNew = Boolean(res?.isNew);
      if (res?.book) saveCareerLogbook(res.book);
    } catch {}
    showArtifactSpotlight(item, lore, isNew);
    if (isMultiplayer) lan.sendCollectible(item.id);
  },
  onTankScrape: (intensity) => {
    audio.playTankScrape?.(intensity);
  },
  onStoryDiscovered: (sp) => {
    audio.playStoryDiscovery?.();
    showToast(`🧭 ${sp.title} — ${sp.lore}`, 4.4);
    recordDiveHighlight(session, { kind: 'lore', icon: '🧭', label: sp.title, depthM: session?.diver?.y });
    try {
      const res = recordLoreDiscoveryInLogbook(loadCareerLogbook(), {
        kind: sp.kind,
        title: sp.title,
        lore: sp.lore,
        siteName: session?.level?.name || '',
      });
      if (res?.book) saveCareerLogbook(res.book);
    } catch {}
  },
  onContractComplete: (c) => {
    audio.playDrillClear?.();
    showToast(`📋 Contract Complete: ${c.icon || '✓'} ${c.title} (+${c.rewardPts || 150} pts)!`, 4.0);
  },
  onTopsideChatter: (msg) => {
    if (msg) showToast(msg, 4.0);
  },
  onAttachBuddyTow: (buddy) => attachBuddyTow(buddy),
  onShareGasWithBuddy: (buddy) => shareGasWithTargetPeer(buddy),
  onAssistAiBuddy: (buddy) => {
    const res = assistHardcoreBuddyIssue(buddy, session, performance.now(), {
      onBuddyIssueResolved: (b, issue, info) => {
        if (issue.kind === 'snagged') audio.playLineCut?.();
        else audio.playDrillClear?.();
        showToast(`🏅 Led ${b.name} through ${issue.title} (+${info.bonusPts} Leadership pts)!`, 3.8);
      },
    });
    if (res?.handled && !res.resolved) {
      audio.playSignal?.();
      if (res.toast) showToast(res.toast, 2.8);
    }
    return Boolean(res?.handled);
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

// Module-level hoisted callback objects for zero per-frame closure allocations (v171)
const _marineStepOpts = {
  localSiltDensity: 0,
  onMegafaunaNear: () => {
    if (!session) return;
    audio.playWhaleSong?.();
  },
  onWildlifeEscort: (m) => {
    if (!session) return;
    session.wildlifeHarmonyScore = (session.wildlifeHarmonyScore || 0) + WILDLIFE_HARMONY_BONUS_PTS;
    audio.playWildlifeHarmony?.();
    recordDiveHighlight(session, {
      kind: 'moment',
      icon: m.kind === 'manta' ? '🌊' : m.kind === 'beluga' ? '🐋' : '🦈',
      label: `${m.label || 'Megafauna'} Escort`,
      depthM: session.diver?.y,
    });
    showToast(
      `✨ ${m.label || 'Megafauna'} is calmly escorting your dive! Hold steady for a 3★ photo [C] (+${WILDLIFE_HARMONY_BONUS_PTS} pts)`,
      4.2
    );
  },
  onDenizenEmerge: (d) => {
    showToast(`🐙 ${d.label || 'Denizen'} emerging curiously in dim light — snap a 3★ stealth photo [C]!`, 3.4);
  },
  onDenizenInk: (d) => {
    showToast(`💨 Bright torch startled ${d.label || 'Octopus'} — defensive ink cloud deployed! Try dimming [L].`, 2.8);
  },
};

const _aiSquadStepOpts = {
  timestampMs: 0,
  onBuddySignal: (buddy) => {
    if (!session?.diver) return;
    const mix = computeSpatialMix(session.diver.x, session.diver.y, buddy.x, buddy.y);
    audio.playSignal?.(mix.pan);
  },
  onBuddyGasShare: ({ buddy, gasId, amountBar }) => {
    audio.playGasShare?.();
    showToast(`🤖 ${buddy.name} shared +${amountBar} bar ${getActiveGasName(gasId)} via long hose!`, 2.8);
  },
  onBuddyCutSnag: (buddy) => {
    audio.playLineCut?.();
    showToast(`🤖 ${buddy.name} cut your entanglement free!`, 2.6);
  },
  onBuddyCoach: (buddy, msg) => {
    if (msg) showToast(msg, 3.6);
  },
  onBuddyIssueStarted: (buddy, issue) => {
    if (!session?.diver) return;
    const mix = computeSpatialMix(session.diver.x, session.diver.y, buddy.x, buddy.y);
    audio.playSignal?.(mix.pan);
    showToast(`🚨 ${buddy.name}: ${issue.icon} ${issue.title}! ${issue.hint}`, 4.6);
  },
  onBuddyIssueResolved: (buddy, issue, info) => {
    audio.playDrillClear?.();
    showToast(`🏅 Led ${buddy.name} through ${issue.title} (+${info.bonusPts} Leadership pts)!`, 3.8);
  },
  onBuddyDowned: (buddy, causeTitle) => {
    audio.playDrillAlarm?.();
    showToast(`🆘 ${buddy.name} DOWN (${causeTitle})! Swim back & tow them to the surface exit (+450 pts)!`, 5.0);
  },
  onBuddySeparated: (buddy, distM) => {
    if (!session?.diver) return;
    const mix = computeSpatialMix(session.diver.x, session.diver.y, buddy.x, buddy.y);
    audio.playSignal?.(mix.pan);
    showToast(`🧭 ${buddy.name} separated (${Math.round(distM)}m behind)! Swim back to lead them through!`, 3.8);
  },
  onBuddyRejoined: (buddy) => {
    audio.playSignal?.();
    showToast(`👌 ${buddy.name} locked back onto your lead!`, 2.4);
  },
};

function stepSimulation(dt) {
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0 && gameToastEl) {
      if (toastQueue.length > 0) {
        const nextToast = toastQueue.shift();
        gameToastEl.textContent = nextToast.text;
        gameToastEl.classList.add('visible');
        toastTimer = nextToast.duration;
      } else {
        gameToastEl.classList.remove('visible');
      }
    }
  }

  const activeTimeSec = mode === 'diving' && session ? session.simTimeSec : menuTimeSec;
  if (photoModeState.active && mode === 'diving' && session) {
    // Allow smooth WASD / Arrow camera panning while underwater time is frozen in Photo Mode Studio
    const panVec = input.getThrust();
    if (Math.abs(panVec.x) > 0.01 || Math.abs(panVec.y) > 0.01) {
      const panSpeed = 9.0 / Math.max(0.65, photoModeState.zoom || 1);
      photoModeState.panX += panVec.x * panSpeed * dt;
      photoModeState.panY += panVec.y * panSpeed * dt;
      clampPhotoModeState(photoModeState);
    }
    return;
  }
  if (ecosystem && renderer.ready && renderer.level?.id === activeLevel.id) {
    _marineStepOpts.localSiltDensity = session?.localSiltDensity || 0;
    stepMarineEcosystem(ecosystem, mode === 'diving' ? session?.diver : null, dt, activeTimeSec, activeLevel, _marineStepOpts);
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
    sessionStepCallbacks.peers = getActivePeers();
    sessionStepCallbacks.torchAim = input.getTorchAim();
    const wasSubmerged = session._wasSubmerged ?? diver.y > 0.75;
    result = stepDiveSession(session, input.getThrust(), dt, sessionStepCallbacks);
    // Hysteresis band (0.55m / 0.95m) prevents breathing buoyancy bob from re-triggering splash
    const nowSubmerged = wasSubmerged ? diver.y > 0.55 : diver.y > 0.95;
    if (nowSubmerged !== wasSubmerged && session.simTimeSec > 0.35) {
      audio.playSplash(nowSubmerged);
    }
    session._wasSubmerged = nowSubmerged;
    audio.setEnvironmentFilter(diveState.depthM, diveState.narcosisLevel, session.spaceClearanceM);
    if (diveState.alive) {
      const curTank = diveState.tanks?.[diveState.activeGasId];
      audio.stepAmbience(dt, level, diver.y, diver, {
        siltDensity: session.localSiltDensity || 0,
        inTightSqueeze: Boolean(session.inTightSqueeze),
        lowGas: Boolean(curTank && curTank.bar <= 52),
        inAirDome: Boolean(session.stories?.inAirDome),
      });
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

  const humanPeers = isMultiplayer ? lan.getPeers() : [];
  if (humanPeers.length > 0 && (session.aiBuddy || session.aiSquad?.length > 0)) {
    session.aiSquad = [];
    session.aiBuddy = null;
    showToast('🤖 AI Squad handed off wing to human crew!', 2.4);
  }
  if (Array.isArray(session.aiSquad) && session.aiSquad.length > 0 && diveState.alive && !session.endedState) {
    _aiSquadStepOpts.timestampMs = performance.now();
    stepAiSquad(session.aiSquad, session, dt, _aiSquadStepOpts);
    // If towing a downed Hardcore AI buddy, glide them cleanly along our rescue umbilical
    if (session.rescueTargetId) {
      const towedAi = session.aiSquad.find((b) => b && b.id === session.rescueTargetId && b.alive === false);
      if (towedAi) {
        updateTowedAiBuddy(towedAi, diver, level, dt);
      }
    }
  }

  const peers = getActivePeers();
  if (coopCommsEl && mode === 'diving') {
    coopCommsEl.hidden = !(peers.length > 0);
  }
  if (peers.length > 0) {
    // Share cave exploration coverage across buddies (human or AI wingman) only when they move >= 1.2m
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
    stepPeerBubbles(session.bubbles, peers, dt);
    recordPeerDepthProfiles(session, peers, session.simTimeSec);
  }
  if (isMultiplayer) {
    if (lan.shouldSendPlayerState()) {
      lan.sendPlayerState(buildPlayerStatePayload(session));
    }
    lan.stepPeerInterpolation(dt, level);

    // If downed and a rescuer is towing us, glide smoothly behind the rescuer (respecting cave rock SDF)
    if (!diveState.alive && session.rescuedBy) {
      const rescuer = humanPeers.find((p) => p && (p.id === session.rescuedBy || p.rescueTargetId === lan.clientId));
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
    for (const p of humanPeers) {
      if (!p || !p.rescuedBy || p.rescued) continue;
      if (p.rescuedBy === lan.clientId) {
        if (!diveState.alive || session.rescueTargetId !== p.id) p.rescuedBy = '';
      } else {
        const otherRescuer = humanPeers.find((r) => r && r.id === p.rescuedBy);
        if (!otherRescuer || otherRescuer.alive === false) p.rescuedBy = '';
      }
    }
  }

  if (btnDropTow) {
    btnDropTow.hidden = !(diveState.alive && !session.endedState && session.rescueTargetId);
  }

  if (btnTowBuddy) {
    let downedPeer = null;
    if (peers.length > 0 && diveState.alive && !session.endedState && !session.rescueTargetId) {
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
    if (peers.length > 0 && diveState.alive && !session.endedState) {
      let bestDist = 3.6;
      for (const p of peers) {
        if (!p || p.alive === false || p.surfaced) continue;
        const d = Math.hypot(p.x - diver.x, p.y - diver.y);
        const lowGas =
          (p.activeBar ?? 200) < 95 ||
          p.condition === 'NO GAS' ||
          p.condition === 'LOW GAS' ||
          p.issue?.kind === 'low-gas';
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
      if (sctx) {
        drawShearwaterComputer(sctx, shearwaterCanvasEl.width, shearwaterCanvasEl.height, diveState, {
          waterTempC: session.hazards?.waterTempC,
          inThermocline: Boolean(session.hazards?.inThermocline),
        });
      }
    }
  }
  if (surveySlateOpen && surveySlateCanvasEl) {
    const slateNowMs = performance.now();
    if (slateNowMs - lastSurveySlateDrawMs >= 140) {
      lastSurveySlateDrawMs = slateNowMs;
      const slCtx = surveySlateCanvasEl.getContext('2d');
      if (slCtx) {
        renderSurveySlate(slCtx, surveySlateCanvasEl.width, surveySlateCanvasEl.height, session, slateNowMs / 1000, {
          followZoom: surveySlateFollowZoom,
        });
      }
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
    surveySlateOpen,
    surveySlateFollowZoom,
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
    hazards: session.hazards || null,
    buddyPing: session.buddyPing || null,
    droppedStages: session.droppedStages || null,
    surveyPins: session.surveyPins || null,
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
    if (result.outcome.success && session.rescueTargetId) {
      const towed = peers.find((p) => p && p.id === session.rescueTargetId);
      if (towed) {
        towed.rescued = true;
        if (towed.isAiBuddy) {
          session.aiBuddiesRescued = (session.aiBuddiesRescued || 0) + 1;
        } else if (isMultiplayer) {
          lan.sendBuddyRescue(towed.id, towed.name || 'Buddy', 'extracted');
        }
        result.outcome.title = `Buddy Rescued · ${level.name}!`;
        result.outcome.detail = `You hauled ${towed.name || 'your buddy'} through the cave to the surface exit (+450 Rescue Bonus)!`;
      }
    }
    session.localOutcome = result.outcome;
    const pendingPeers = isMultiplayer
      ? humanPeers.filter((p) => p.alive !== false && !p.surfaced)
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
    const activePeers = humanPeers.filter((p) => p.alive !== false && !p.surfaced);
    if (activePeers.length === 0 && session.localOutcome) {
      const peersAllSurfaced = humanPeers.length > 0 && humanPeers.every((p) => p.alive !== false && p.surfaced);
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

// Zero-GC frame scratch objects & Adaptive 60 FPS Performance Governor (v144)
const perfMonitor = createPerfMonitor({ isMobile: Boolean(renderer?._isCoarseMobile) });
renderer.setPerfBudget(perfMonitor.getBudget());
const _frameWreckState = {
  clippedToShotLine: false,
  cutSnagIds: null,
  activeSnagIndex: -1,
  openedHatchIds: null,
  equalizedHatchIds: null,
  crankingHatchId: null,
  crankingHatchProgress: 0,
  claimedStageIds: null,
  placedMarkerIds: null,
};
const _frameGhostPose = { x: 0, y: 0, angle: 0, finished: false, isPar: false };

let lastIdleRenderMs = 0;

function frame(nowMs) {
  const rawDeltaMs = lastFrameMs ? nowMs - lastFrameMs : 16.67;
  const dt = lastFrameMs ? Math.min(0.05, rawDeltaMs / 1000) : 0.016;
  lastFrameMs = nowMs;
  menuTimeSec = nowMs * 0.001;

  if (typeof document !== 'undefined' && document.hidden) {
    perfMonitor.reset();
    requestAnimationFrame(frame);
    return;
  }

  // Throttle idle menu/debrief background work (~15 FPS) & pause full-canvas render behind full-screen modals (v171)
  const isIdleScreen = mode === 'menu' || mode === 'debrief';
  const modalOccludingMenu = mode === 'menu' && modalManager.getOpenCount() > 0;
  if (isIdleScreen) {
    if (liveryModalEl && !liveryModalEl.hidden) {
      renderLiveryPreviewFrame(menuTimeSec);
    }
    if (modalOccludingMenu) {
      requestAnimationFrame(frame);
      return;
    }
    if (nowMs - lastIdleRenderMs < 66) {
      requestAnimationFrame(frame);
      return;
    }
    lastIdleRenderMs = nowMs;
  }

  stepSimulation(dt);

  if (mode === 'diving' && !divePaused && perfMonitor.recordFrame(rawDeltaMs)) {
    renderer.setPerfBudget(perfMonitor.getBudget());
  }

  if ((mode === 'diving' || mode === 'debrief') && session) {
    if (mode === 'debrief') {
      session.simTimeSec += dt;
    }
    let nextCheckpoint = null;
    const cps = session.level.checkpoints;
    for (let i = 0; i < cps.length; i++) {
      if (!session.checkpointsHit.has(cps[i].id)) {
        nextCheckpoint = cps[i];
        break;
      }
    }
    const peers = getActivePeers();
    // Subtle periodic Biome Hydrophone Soundscape pulse (ice crack, volcanic rumble, hull groan, cenote drop) (v159)
    if (!divePaused && !session.endedState && (session.diver?.y || 0) >= 6.0) {
      session._biomeCueTimer = (session._biomeCueTimer ?? 9.0) - dt;
      if (session._biomeCueTimer <= 0) {
        session._biomeCueTimer = 14.5 + Math.random() * 8.5;
        const lvId = `${session.level?.id || ''} ${session.level?.theme?.surfaceStyle || ''} ${session.level?.name || ''}`;
        const biomeKind = session.level?.isWreck
          ? 'wreck'
          : /arctic|ice|scoresby|kverkfjoll|silfra/i.test(lvId)
            ? 'ice'
            : /katla|strytan|grjotagja|volcanic|lanzarote/i.test(lvId)
              ? 'volcanic'
              : 'cenote';
        audio.playBiomeHydrophoneCue?.(biomeKind, (Math.random() - 0.5) * 1.4);
      }
    }
    const humanFramePeers = isMultiplayer ? lan.getPeers() : EMPTY_ARR;
    let spectateTarget = null;
    if (spectatingPeer && humanFramePeers.length > 0) {
      let aliveCount = 0;
      for (let i = 0; i < humanFramePeers.length; i++) {
        const p = humanFramePeers[i];
        if (p && p.alive !== false && !p.surfaced) aliveCount++;
      }
      if (aliveCount > 0) {
        let pick = spectatePeerIdx % aliveCount;
        for (let i = 0; i < humanFramePeers.length; i++) {
          const p = humanFramePeers[i];
          if (p && p.alive !== false && !p.surfaced) {
            if (pick === 0) { spectateTarget = p; break; }
            pick--;
          }
        }
      } else {
        spectateTarget = humanFramePeers[0];
      }
    }
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
    _frameWreckState.clippedToShotLine = session.clippedToShotLine;
    _frameWreckState.cutSnagIds = session.cutSnagIds;
    _frameWreckState.activeSnagIndex = session.activeSnagIndex;
    _frameWreckState.openedHatchIds = session.openedHatchIds;
    _frameWreckState.equalizedHatchIds = session.equalizedHatchIds;
    _frameWreckState.crankingHatchId = session.crankingHatchId;
    _frameWreckState.crankingHatchProgress = session.crankingHatchProgress;
    _frameWreckState.claimedStageIds = session.claimedStageIds;
    _frameWreckState.placedMarkerIds = session.placedMarkerIds;

    let frameGhost = null;
    if (ghostEnabled && activeGhostTrack) {
      const pose = sampleGhostPose(activeGhostTrack, session.simTimeSec);
      if (pose) {
        _frameGhostPose.x = pose.x;
        _frameGhostPose.y = pose.y;
        _frameGhostPose.angle = pose.angle;
        _frameGhostPose.finished = Boolean(pose.finished);
        _frameGhostPose.isPar = activeGhostIsPar;
        frameGhost = _frameGhostPose;
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
      wreckState: _frameWreckState,
      ghostPose: frameGhost,
      sonarPulse: session.sonar?.activePulse || null,
      cameraFlash: session.camera?.activeFlash || null,
      encounters: session.encounters || null,
      hazards: session.hazards || null,
      blackBox: session.blackBox || null,
      lineCookies: session.lineCookies || null,
      surveyPins: session.surveyPins || null,
      powerRelays: session.powerRelays || null,
      smb: session.smb || null,
      salvage: session.salvage || null,
      mechFx: session.mechFx || null,
      stories: session.stories || null,
      reelingActive: Boolean(session.reelingActive),
      bioWake: session.bioWake || null,
      surfaceRipples: session.surfaceRipples || null,
      buddyPing: session.buddyPing || null,
      airShareBeams: session.airShareBeams || null,
      droppedStages: session.droppedStages || null,
      drills: session.drills || null,
      weather: session.weather || null,
      photoMode: photoModeState.active ? photoModeState : null,
      endedState: session.endedState || '',
      difficulty: session.difficulty || activeDifficulty,
      mutatorId: session.mutatorId || '',
      compactHud: Boolean(compactHudEnabled),
      spaceClearanceM: session.spaceClearanceM ?? 4.0,
      breathState: session.breath?.state || 'hold',
      squeezeDust: session.squeezeDust || null,
      handOnLinePt: session.handOnLinePt || null,
      timeSec: session.simTimeSec,
      dt,
    });
  } else if (renderer.ready && renderer.level?.id === activeLevel.id) {
    menuPreviewDiver.x = activeLevel.spawn.x + 7 + Math.sin(nowMs * 0.0003) * 4;
    menuPreviewDiver.y = Math.min(activeLevel.spawn.y + 6.5, 9);
    menuPreviewDiver.livery = liveryWorkshop.getActiveRigLivery();
    renderer.render({
      diver: menuPreviewDiver,
      diveState: MENU_PREVIEW_DIVE_STATE,
      peerDiver: null,
      checkpointsHit: EMPTY_SET,
      nextCheckpoint: activeLevel.checkpoints[0],
      siltClouds: EMPTY_ARR,
      bubbles: EMPTY_ARR,
      ecosystem,
      weather: resolveEffectiveWeather(weatherPrefId, { level: activeLevel }),
      timeSec: menuTimeSec,
      dt,
    });
  } else {
    renderer.renderMenuBackdrop(activeLevel, menuTimeSec, resolveEffectiveWeather(weatherPrefId, { level: activeLevel }));
  }

  if (liveryModalEl && !liveryModalEl.hidden) {
    renderLiveryPreviewFrame(menuTimeSec);
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

    if ('serviceWorker' in navigator && navigator.serviceWorker) {
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

  if ('serviceWorker' in navigator && navigator.serviceWorker) {
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
    if (shouldHold && navigator.wakeLock && !screenWakeLock) {
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
