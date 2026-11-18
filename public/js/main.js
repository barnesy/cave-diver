import { LEVELS, DEFAULT_LEVEL_ID, CAMPAIGN_PLAN, getLevelById, getLevelMeta, getLevelMaxDepthM } from './levels/index.js';
import {
  createDiveState,
  switchGas,
  GAS_MIXES,
  computeSiteDivePlan,
  donateGasFromState,
  receiveGasIntoState,
} from './physics/diveModel.js';
import {
  createEmptyLogbook,
  recordDiveInLogbook,
  seedLogbookFromEntries,
  formatLogbookSummary,
} from './game/logbookModel.js';
import {
  createDiveSession,
  stepDiveSession,
  toggleGuidelineReel,
  rewindGuidelineSegment,
  getEffectiveReelRemainingM,
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
import { DiveComputerHUD } from './game/hud.js';
import { InputController } from './game/input.js';
import { DiveAudio } from './game/audio.js';
import { LanClient } from './net/lanClient.js';
import { LeaderboardClient } from './net/leaderboardClient.js';

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
const tabBtnSolo = document.getElementById('tab-btn-solo');
const menuIdentityRow = document.getElementById('menu-identity-row');
const menuSitePicker = document.getElementById('menu-site-picker');
const soloPanel = document.getElementById('solo-panel');
const siteBrowserEl = document.getElementById('site-browser');
const siteViewTabsEl = document.getElementById('site-view-tabs');
const siteWorldMapEl = document.getElementById('site-world-map');
const siteMapRegionBadgeEl = document.getElementById('site-map-region-badge');
const btnMapZoom = document.getElementById('btn-map-zoom');
const btnPlaySolo = document.getElementById('btn-play-solo');
const btnOpenLan = document.getElementById('btn-open-lan');
const btnOpenLeaderboard = document.getElementById('btn-open-leaderboard');
const leaderboardPanel = document.getElementById('leaderboard-panel');
const lbCareerSummaryEl = document.getElementById('lb-career-summary');
const selectLbSite = document.getElementById('select-lb-site');
const siteDivePlanEl = document.getElementById('site-dive-plan');
const leaderboardSubEl = document.getElementById('leaderboard-sub');
const leaderboardRowsEl = document.getElementById('leaderboard-rows');
const debriefLeaderboardEl = document.getElementById('debrief-leaderboard');
const btnInstallPwa = document.getElementById('btn-install-pwa');
const screenMenu = document.getElementById('screen-menu');
const screenHud = document.getElementById('screen-hud');
const screenDebrief = document.getElementById('screen-debrief');
const lanPanel = document.getElementById('lan-panel');
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
const lanUrlsEl = document.getElementById('lan-urls');
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

const CALLSIGN_MAX_LEN = 12;

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
  playerNameInput?.classList.add('invalid');
  playerNameInput?.focus();
  playerNameInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(`Enter your diver callsign (1–${CALLSIGN_MAX_LEN} chars) to dive!`, 3.0);
  if (lanStatus && !lanPanel?.hidden) {
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
  const el = document.getElementById('game-toast');
  el.textContent = text;
  el.classList.add('visible');
  toastTimer = duration;
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
}

const MAP_LANDMASS_POLYGONS = [
  // North & Central America + Florida + Yucatan
  [[-108, 62], [-96, 63], [-82, 62], [-78, 53], [-64, 59], [-55, 52], [-66, 44], [-71, 41], [-76, 35], [-81, 31], [-80, 25], [-82.5, 26], [-83, 29], [-85, 30], [-90, 29], [-97, 26], [-96, 19], [-91, 18.5], [-90, 21.3], [-87, 21.5], [-87.4, 18.4], [-88.4, 15.8], [-83.5, 14.5], [-82.5, 9], [-78, 8], [-84, 10], [-94, 15], [-105, 20], [-108, 28]],
  // Cuba & Hispaniola / Bahamas bank
  [[-84.8, 22], [-79, 23], [-74.3, 20.1], [-77.5, 19.9], [-83, 21.5]],
  [[-74, 19.8], [-68.5, 18.5], [-71.5, 17.8], [-74.3, 18.5]],
  // Northern South America
  [[-78, 9], [-70, 12], [-61, 10.5], [-50, 1.5], [-35, -6], [-38, -14], [-40, -23], [-49, -28], [-54, -34], [-63, -38], [-74, -38], [-71, -18], [-81, -5], [-79, 2]],
  // Greenland tip (east)
  [[-52, 60], [-42, 60], [-22, 70], [-40, 72], [-55, 68]],
  // Iceland
  [[-24.4, 65.5], [-18.2, 66.5], [-13.5, 65.0], [-14.8, 63.6], [-22.6, 63.8]],
  // Great Britain & Ireland
  [[-6.0, 50.1], [-5.2, 58.6], [-1.8, 57.6], [1.6, 52.5], [1.2, 51.0]],
  [[-10.2, 52.0], [-9.4, 55.2], [-6.1, 54.6], [-6.2, 52.2]],
  // Continental Europe, Italy, Iberia, Balkans & Urals
  [[-9.2, 37.0], [-9.1, 43.2], [-1.8, 43.4], [-4.6, 48.4], [2.2, 51.0], [7.8, 53.9], [9.8, 57.2], [13.8, 54.0], [21.0, 54.8], [28.0, 60.2], [44.0, 66.0], [72.0, 68.0], [72.0, 42.0], [52.0, 40.0], [40.0, 42.0], [28.5, 41.2], [23.8, 37.9], [19.8, 40.4], [18.2, 40.1], [16.0, 38.0], [13.5, 41.2], [11.0, 43.4], [13.6, 45.6], [12.3, 42.0], [9.2, 44.3], [4.5, 43.3], [3.1, 42.3], [-0.4, 38.4], [-5.5, 36.1]],
  // Scandinavia
  [[5.1, 59.0], [6.8, 62.6], [12.0, 66.2], [16.5, 69.2], [28.5, 71.0], [28.0, 60.4], [20.2, 60.0], [18.0, 59.0], [12.8, 55.6], [10.8, 58.2]],
  // Africa & Red Sea / Arabian Peninsula
  [[-17.2, 14.8], [-13.2, 27.6], [-5.8, 35.8], [10.6, 37.2], [24.5, 31.8], [32.5, 31.4], [35.0, 29.4], [43.2, 12.6], [51.2, 11.9], [40.6, -2.5], [35.4, -24.5], [27.9, -33.2], [18.4, -34.4], [14.8, -24.0], [12.0, -15.5], [9.2, 3.8], [2.4, 6.3], [-8.0, 4.6], [-15.8, 11.4]],
  // Arabia / Levant
  [[34.8, 29.5], [35.5, 36.8], [48.0, 38.0], [60.0, 25.0], [56.2, 22.5], [43.5, 12.8], [35.0, 27.5]],
];

const SITE_COORDS_BY_ID = new Map(CAMPAIGN_PLAN.map((s) => [s.id, s]));
let siteViewMode = 'split'; // 'split' | 'map' | 'list'
let mapEuropeZoom = false;

function projectMapPoint(lng, lat) {
  return {
    x: (lng + 108) * 2,
    y: (72 - lat) * 2,
  };
}

function renderSiteWorldMap() {
  if (!siteWorldMapEl) return;
  const locked = Boolean(lan.room && !lan.isHost());
  siteWorldMapEl.setAttribute('viewBox', mapEuropeZoom ? '194 24 96 72' : '0 -22 360 246');
  if (btnMapZoom) {
    btnMapZoom.textContent = mapEuropeZoom ? '🇪🇺 EU' : '🌍 All';
  }
  const k = mapEuropeZoom ? 0.36 : 1;

  // Graticule grid
  const gridParts = [];
  for (let lng = -90; lng <= 60; lng += 30) {
    const gx = (lng + 108) * 2;
    gridParts.push(`<line x1="${gx}" y1="0" x2="${gx}" y2="220" stroke="rgba(56,189,248,0.08)" stroke-width="${(0.6 * k).toFixed(2)}" />`);
  }
  for (let lat = -30; lat <= 60; lat += 30) {
    const gy = (72 - lat) * 2;
    gridParts.push(`<line x1="0" y1="${gy}" x2="360" y2="${gy}" stroke="rgba(56,189,248,0.08)" stroke-width="${(0.6 * k).toFixed(2)}" />`);
  }
  for (let lng = -90; lng <= 60; lng += 30) {
    const gx = (lng + 108) * 2;
    gridParts[Math.floor((lng + 90) / 30)] = `<line x1="${gx}" y1="-22" x2="${gx}" y2="224" stroke="rgba(56,189,248,0.08)" stroke-width="${(0.6 * k).toFixed(2)}" />`;
  }

  // Continental polygons
  const landPaths = MAP_LANDMASS_POLYGONS.map((poly) => {
    const d = poly
      .map(([lng, lat], i) => {
        const pt = projectMapPoint(lng, lat);
        return `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      })
      .join(' ') + ' Z';
    return `<path d="${d}" fill="rgba(16, 48, 74, 0.92)" stroke="rgba(56, 189, 248, 0.28)" stroke-width="${(0.75 * k).toFixed(2)}" />`;
  }).join('');

  // Pin coordinates with slight decluster offsets for Yucatan & Central EU neighbors
  const pins = LEVELS.map((lvl, idx) => {
    const slot = SITE_COORDS_BY_ID.get(lvl.id);
    const pt = projectMapPoint(slot?.lng ?? 0, slot?.lat ?? 20);
    if (lvl.id === 'ox-bel-ha-grand-traverse') pt.y += 4.2 * k;
    if (lvl.id === 'cenote-el-abismo') pt.y -= 2.2 * k;
    return { lvl, idx, slot, x: pt.x, y: pt.y };
  });

  // Subtle campaign progression route polyline
  const routePts = pins.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const routeLine = `<polyline points="${routePts}" fill="none" stroke="rgba(56, 189, 248, 0.22)" stroke-width="${(0.75 * k).toFixed(2)}" stroke-dasharray="${(2.5 * k).toFixed(2)},${(2.2 * k).toFixed(2)}" />`;

  const pinMarkup = pins
    .map(({ lvl, idx, slot, x, y }) => {
      const isSelected = lvl.id === activeLevel.id;
      const isUnlined = lvl.reelMetersPerDiver > 0;
      const best = getSavedBestScore(lvl.id);
      const pinColor = isUnlined ? '#fbbf24' : '#38bdf8';
      const r = (isSelected ? 4.3 : 3.0) * k;
      const halo = isSelected
        ? `<circle class="map-pin-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(7.5 * k).toFixed(1)}" />`
        : '';
      const ring = best > 0
        ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r + 1.6 * k).toFixed(1)}" fill="none" stroke="#34d399" stroke-width="${(0.85 * k).toFixed(2)}" />`
        : '';
      const numLabel = isSelected || mapEuropeZoom
        ? `<text x="${(x + 4.8 * k).toFixed(1)}" y="${(y + 1.8 * k).toFixed(1)}" fill="#e0f2fe" font-size="${(6.2 * k).toFixed(2)}" font-weight="700" font-family="ui-monospace, monospace">L${idx + 1}</text>`
        : '';
      return `
        <g class="map-pin-btn ${isSelected ? 'active' : ''} ${locked ? 'locked' : ''}" data-level-id="${lvl.id}" role="option" aria-selected="${isSelected ? 'true' : 'false'}" tabindex="0">
          <title>L${idx + 1}: ${lvl.name} (${slot?.region || ''} · ${getLevelMaxDepthM(lvl)}m)</title>
          ${halo}
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(7.5 * k).toFixed(1)}" fill="transparent" />
          ${ring}
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${pinColor}" stroke="#020b14" stroke-width="${(0.9 * k).toFixed(2)}" />
          ${numLabel}
        </g>
      `;
    })
    .join('');

  siteWorldMapEl.innerHTML = `${gridParts.join('')}${landPaths}${routeLine}${pinMarkup}`;

  const activeIdx = Math.max(0, LEVELS.findIndex((l) => l.id === activeLevel.id));
  const activeSlot = SITE_COORDS_BY_ID.get(activeLevel.id);
  if (siteMapRegionBadgeEl) {
    siteMapRegionBadgeEl.textContent = `L${activeIdx + 1} · ${activeSlot?.region || activeLevel.name} · ${getLevelMaxDepthM(activeLevel)}m`;
  }
}

function renderLevelCards() {
  if (!levelCardsEl) return;
  const locked = Boolean(lan.room && !lan.isHost());
  const pill = document.getElementById('campaign-progress-pill');
  if (pill) {
    pill.textContent = `${LEVELS.length} / ${CAMPAIGN_PLAN.length} Sites`;
  }
  levelCardsEl.innerHTML = LEVELS.map((lvl, idx) => {
    const isSelected = lvl.id === activeLevel.id;
    const isCached = renderer.isLevelCached(lvl.id) || (renderer.ready && renderer.level?.id === lvl.id);
    const best = getSavedBestScore(lvl.id);
    const meta = getLevelMeta(lvl, idx);
    const slot = SITE_COORDS_BY_ID.get(lvl.id);
    const depth = `${meta.maxDepthM}m`;
    const metaText = isCached
      ? best > 0
        ? `✓ ${best.toLocaleString()}`
        : lvl.reelMetersPerDiver > 0
          ? `✓ Ready · ${lvl.reelMetersPerDiver}m`
          : `✓ Ready`
      : lvl.reelMetersPerDiver > 0
        ? `No Line · ${lvl.reelMetersPerDiver}m`
        : getLevelDifficultyLabel(idx, lvl);
    const tierTag = lvl.reelMetersPerDiver > 0 ? `L${idx + 1} · T${meta.tier}` : `L${idx + 1}`;
    return `
      <button
        type="button"
        class="level-card-btn ${isSelected ? 'active' : ''}"
        data-level-id="${lvl.id}"
        role="option"
        aria-selected="${isSelected ? 'true' : 'false'}"
        ${locked ? 'disabled' : ''}
      >
        <div class="lvl-card-top">
          <span>${tierTag} · ${slot?.region || ''}</span>
          <span class="lvl-card-depth">${depth}</span>
        </div>
        <span class="lvl-card-name">${lvl.name}</span>
        <span class="lvl-card-meta ${isCached ? 'cached' : lvl.reelMetersPerDiver > 0 ? 'reel' : ''}">${metaText}</span>
      </button>
    `;
  }).join('');

  const activeBtn = levelCardsEl.querySelector('.level-card-btn.active');
  activeBtn?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  renderSiteWorldMap();
}

function syncMenuLevelLabels(level) {
  const idx = LEVELS.findIndex((l) => l.id === level.id);
  const lvlNum = idx >= 0 ? idx + 1 : 1;
  btnPlaySolo.textContent = `SOLO DIVE · LEVEL ${lvlNum}`;
  const menuTitle = screenMenu.querySelector('.menu-title');
  const menuDesc = screenMenu.querySelector('.menu-desc');
  const loaderTitle = screenLoader.querySelector('.loader-title');
  const loaderMetaSpan = screenLoader.querySelector('.loader-meta span');
  const chipNameTmx = document.getElementById('chip-name-tmx');
  const chipRangeTmx = document.getElementById('chip-range-tmx');
  const depthNum = parseInt(getLevelDepthLabel(level), 10) || 50;
  if (menuTitle) menuTitle.textContent = level.name.toUpperCase();
  if (menuDesc && level.description) menuDesc.textContent = level.description;
  if (loaderTitle) loaderTitle.textContent = level.name.toUpperCase();
  if (loaderMetaSpan && level.subtitle) loaderMetaSpan.textContent = level.subtitle.toUpperCase();
  const plan = siteDivePlanEl || chipRangeTmx || chipNameTmx ? computeSiteDivePlan(level) : null;
  const tmxMinM = Math.max(3, Math.ceil(level.gasOverrides?.TMX1455?.minM ?? 3));
  if (chipNameTmx && plan) chipNameTmx.textContent = plan.bottomGasName;
  if (chipRangeTmx) chipRangeTmx.textContent = `${tmxMinM}–${Math.max(65, depthNum)}m Bottom`;
  if (siteDivePlanEl && plan) {
    siteDivePlanEl.innerHTML = `
      <span>Max ${plan.maxDepthM}m</span>
      <span>Bottom: ${plan.bottomGasName}</span>
      <span>1/3 Turn: ${plan.turnaroundBar}b</span>
      <span>Reserve: ${plan.reserveBar}b</span>
      <span>${plan.lineModeLabel}</span>
    `;
  }
  renderLevelCards();
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
  syncMenuLevelLabels(nextLevel);

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

const hud = new DiveComputerHUD({
  onGasSelect: (gasId) => {
    if (mode !== 'diving' || !session) return;
    if (switchGas(session.diveState, gasId)) {
      audio.playGasSwitch();
      showToast(`Switched regulator to ${GAS_MIXES[gasId].name}`, 1.8);
    } else {
      showToast(`${GAS_MIXES[gasId].name} cylinder empty!`, 1.8);
    }
  },
  onReelToggle: handleReelToggle,
  onReelRewind: handleReelRewind,
});

const input = new InputController({
  stickBaseEl: document.getElementById('touch-stick'),
  stickKnobEl: document.getElementById('touch-knob'),
  onGasSelect: (gasId) => {
    if (mode === 'diving' && session && switchGas(session.diveState, gasId)) {
      audio.playGasSwitch();
      showToast(`Regulator: ${GAS_MIXES[gasId].name}`, 1.6);
    }
  },
  onTorchToggle: () => {
    if (session?.diver) session.diver.torchOn = !session.diver.torchOn;
  },
  onReelToggle: handleReelToggle,
  onReelRewind: handleReelRewind,
});

let celebrationParticles = [];
let debriefAnimFrame = 0;

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
  directJoinToDive = false;
  isMultiplayer = multiplayer;
  mode = 'diving';
  spectatingPeer = false;
  celebrationParticles = [];
  if (debriefAnimFrame) {
    cancelAnimationFrame(debriefAnimFrame);
    debriefAnimFrame = 0;
  }

  const diverName = playerNameInput?.value.trim() || 'Diver 1';
  const slotOffsets = [0, -1.35, 1.35, -2.5];
  const spawnOffsetX = multiplayer ? (slotOffsets[lan.getPlayerSlotIndex()] ?? 0) : 0;
  session = createDiveSession(activeLevel, { diverName, spawnOffsetX });
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
  setHudMenuOpen(false);
  screenMenu.hidden = true;
  screenDebrief.hidden = true;
  screenHud.hidden = false;
  if (coopCommsEl) coopCommsEl.hidden = !multiplayer;
  if (multiplayer && lan.room) {
    syncRoomInviteUi(lan.room);
  } else {
    syncRoomInviteUi(null);
  }
  if (coopWaitBannerEl) coopWaitBannerEl.hidden = true;
  const openMsg =
    activeLevel.reelMetersPerDiver > 0
      ? `No fixed guideline! Press [G] to deploy your ${activeLevel.reelMetersPerDiver}m reel, [R] to rewind.`
      : 'Descend on EAN32. Switch to TMX 14/55 at the Halocline!';
  showToast(openMsg, 4.2);
}

function finishDiveRun(success, title, detail, outcomeScore = null) {
  if (!session) return;
  mode = 'debrief';
  spectatingPeer = false;
  setHudMenuOpen(false);
  screenHud.hidden = true;
  if (coopCommsEl) coopCommsEl.hidden = true;
  if (coopWaitBannerEl) coopWaitBannerEl.hidden = true;
  screenDebrief.hidden = false;

  const btnRetry = document.getElementById('btn-retry');
  const btnMenu = document.getElementById('btn-menu');
  const inCoopRoom = Boolean(isMultiplayer && lan.room);
  if (btnRetry) btnRetry.textContent = inCoopRoom ? 'CO-OP ROOM LOBBY' : 'DIVE AGAIN';
  if (btnMenu) btnMenu.textContent = inCoopRoom ? 'LEAVE CO-OP ROOM' : 'MAIN MENU';

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
    });

  if (isMultiplayer) {
    lan.sendPlayerState({
      x: diver.x,
      y: diver.y,
      vx: 0,
      vy: 0,
      angle: diver.angle,
      gasId: diveState.activeGasId,
      activeBar: diveState.tanks[diveState.activeGasId]?.bar ?? 0,
      cnsPercent: diveState.cnsPercent,
      dcsStress: diveState.dcsStress,
      hypoxiaStress: diveState.hypoxiaStress,
      narcosisLevel: diveState.narcosisLevel,
      heartRateBpm: diveState.heartRateBpm,
      cardiacStress: diveState.cardiacStress,
      ceilingM: diveState.ceilingM,
      condition: diveState.impairment?.primaryCondition || 'NOMINAL',
      surfaced: Boolean(success),
      healthPct: localSummary.healthPct,
      gasRemainingPct: localSummary.gasRemainingPct,
      diveTimeSec: diveState.diveTimeSec,
      collectiblesFound: localSummary.collectiblesFound,
      exploredPct: localSummary.exploredPct,
      totalScore: localSummary.totalScore,
      depthM: diveState.depthM,
      torchOn: diver.torchOn,
      alive: diveState.alive,
      name: diver.name,
    });
  }

  const teamSummary = computeTeamScoreSummary(localSummary, isMultiplayer ? lan.getPeers() : [], {
    localRescued: Boolean(session.rescued),
  });

  if (success) {
    spawnCelebrationConfetti();
    audio.playVictoryFanfare();
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

  document.getElementById('debrief-title').textContent = title;
  document.getElementById('debrief-detail').textContent = detail;

  const scoreLblEl = document.getElementById('debrief-score-label');
  const totalScoreEl = document.getElementById('debrief-total-score');
  const bestEl = document.getElementById('debrief-best');
  const gradeEl = document.getElementById('debrief-grade');
  scoreLblEl.textContent = teamSummary.isTeam ? 'TEAM EXPEDITION SCORE' : 'EXPEDITION SCORE';

  // Track best score cleanly per level in localStorage
  const bestKey = `caveDiverBest_${level.id}`;
  let prevBest = 0;
  try {
    prevBest = Number(localStorage.getItem(bestKey) || 0);
    if (success && teamSummary.teamScore > prevBest) {
      localStorage.setItem(bestKey, String(teamSummary.teamScore));
    }
  } catch {
    // ignore storage restriction
  }
  const updatedLogbook = recordDiveInLogbook(loadCareerLogbook(), {
    levelId: level.id,
    success,
    score: teamSummary.teamScore,
    grade: teamSummary.teamRank.grade,
    maxDepthM: diveState.maxDepthM,
    diveTimeSec: diveState.diveTimeSec,
  });
  saveCareerLogbook(updatedLogbook);
  renderCareerSummary();
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
            <strong>${r.name}</strong>
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
    leaderboard
      .submitRun({
        mode: subMode,
        levelId: level.id,
        runId: subRunId,
        diverName: playerNameInput?.value.trim() || 'Diver 1',
        crew: teamSummary.roster.map((r) => ({ name: r.name, score: r.totalScore, alive: r.alive })),
        teamSize: teamSummary.teamSize,
        score: teamSummary.teamScore,
        grade: teamSummary.teamRank.grade,
        timeSec: teamSummary.avgTimeSec,
        exploredPct: teamSummary.exploredPct,
        collectiblesFound: teamSummary.collectiblesFound,
      })
      .then((res) => {
        if (!debriefLeaderboardEl) return;
        if (!res?.ok) {
          console.warn('Leaderboard submit failed:', res?.error);
          return;
        }
        const boardLabel = subMode === 'team' ? 'TEAM LEADERBOARD' : 'INDIVIDUAL LEADERBOARD';
        const srcTag = res.source === 'global' ? 'Global' : res.pendingSync ? 'Saved Offline · Auto-Sync' : 'Local PB';
        const rankText = res.rank ? `${srcTag} Rank #${res.rank} of ${res.total || res.rank}` : srcTag;
        debriefLeaderboardEl.hidden = false;
        debriefLeaderboardEl.innerHTML = `
          <div class="debrief-lb-head">
            <span class="debrief-section-title" style="margin:0">${boardLabel} · ${escapeHtml(level.name)}</span>
            <span class="debrief-lb-rank">${escapeHtml(rankText)}</span>
          </div>
          ${renderLeaderboardRowsHtml((res.entries || []).slice(0, 5), { highlightKey: res.entry?.entryKey })}
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

function renderLeaderboardRowsHtml(entries, { highlightKey = '' } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '<div class="lb-empty">No completed expeditions recorded here yet. Finish a dive to claim #1!</div>';
  }
  return entries
    .map((e, i) => {
      const isMe =
        (highlightKey && e.entryKey === highlightKey) ||
        (e.playerId && e.playerId === leaderboard.playerId);
      const teamTag = e.teamSize > 1 ? ` · ${e.teamSize}P` : '';
      return `
        <div class="lb-row ${isMe ? 'me' : ''}">
          <span class="lb-rank">#${i + 1}</span>
          <span class="lb-name">${escapeHtml(e.displayName)}<small class="lb-meta">${teamTag}</small></span>
          <span class="lb-meta">${formatRunClock(e.timeSec)} · ${e.exploredPct}%</span>
          <span class="lb-grade">${escapeHtml(e.grade)}</span>
          <span class="lb-score">${Number(e.score || 0).toLocaleString()}</span>
        </div>
      `;
    })
    .join('');
}

const CAREER_LOGBOOK_KEY = 'caveDiverLogbook_v1';

function loadCareerLogbook() {
  try {
    let book = createEmptyLogbook();
    const raw = localStorage.getItem(CAREER_LOGBOOK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') book = parsed;
    }
    return seedLogbookFromEntries(book, leaderboard._loadLocalCache());
  } catch {
    return createEmptyLogbook();
  }
}

function saveCareerLogbook(book) {
  try {
    localStorage.setItem(CAREER_LOGBOOK_KEY, JSON.stringify(book));
  } catch {}
}

function renderCareerSummary() {
  if (!lbCareerSummaryEl) return;
  const s = formatLogbookSummary(loadCareerLogbook(), LEVELS.length);
  lbCareerSummaryEl.hidden = false;
  lbCareerSummaryEl.innerHTML = `
    <div class="lb-career-cell"><span>Sites</span><strong>${s.clearedCount}/${s.totalSites}</strong></div>
    <div class="lb-career-cell"><span>Dives</span><strong>${s.totalDives}</strong></div>
    <div class="lb-career-cell"><span>Deepest</span><strong>${s.deepestM.toFixed(0)}m</strong></div>
    <div class="lb-career-cell"><span>Rating</span><strong>${escapeHtml(s.campaignMedal)}</strong></div>
  `;
}

function populateLbSiteSelect() {
  if (!selectLbSite) return;
  const opts = [
    `<option value="overall">🌐 All ${LEVELS.length} Sites (Overall)</option>`,
    ...LEVELS.map((lvl, idx) => `<option value="${lvl.id}">L${idx + 1}: ${lvl.name} (${getLevelMaxDepthM(lvl)}m)</option>`),
  ];
  selectLbSite.innerHTML = opts.join('');
  selectLbSite.value = lbFilterLevelId || activeLevel.id;
}

async function refreshMenuLeaderboard() {
  renderCareerSummary();
  if (!leaderboardRowsEl || !leaderboardSubEl) return;
  if (selectLbSite && selectLbSite.options.length === 0) {
    populateLbSiteSelect();
  }
  const targetLevel = lbFilterLevelId || activeLevel.id;
  if (selectLbSite) selectLbSite.value = targetLevel;
  leaderboardSubEl.textContent = 'Syncing rankings...';
  const board = await leaderboard.fetchBoard({ mode: lbMode, levelId: targetLevel, limit: 20 });
  const modeLabel = lbMode === 'team' ? 'Co-op Teams' : 'Individual Divers';
  const lvlIdx = LEVELS.findIndex((l) => l.id === targetLevel);
  const scopeLabel =
    targetLevel === 'overall'
      ? `Overall Campaign (All ${LEVELS.length} Sites)`
      : `L${Math.max(1, lvlIdx + 1)}: ${getLevelById(targetLevel).name}`;
  const originNote =
    board.source === 'global'
      ? (board.pendingSync > 0 ? `Global Rankings (${board.pendingSync} pending sync)` : 'Global Rankings')
      : 'Local Device Records (auto-syncs when online)';
  leaderboardSubEl.textContent = `${modeLabel} · ${scopeLabel} · ${originNote}`;
  leaderboardRowsEl.innerHTML = renderLeaderboardRowsHtml(board.entries);
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
  const urlHeadSpan = document.querySelector('.lan-url-head span:first-child');
  if (transport === 'p2p') {
    if (urlHeadSpan) urlHeadSpan.textContent = 'Direct WebRTC P2P Co-op (Zero Server):';
    if (lanUrlsEl) lanUrlsEl.textContent = 'Share your Room Link with buddies on Wi-Fi or cellular!';
    if (lan.room) syncRoomInviteUi(lan.room);
    return;
  }
  try {
    const res = await fetch('./api/lan-info');
    if (!res.ok) throw new Error('no lan-info');
    const info = await res.json();
    cachedLanUrls = Array.isArray(info.urls) ? info.urls : [];
    if (cachedLanUrls.length > 0) {
      lanUrlsEl.innerHTML = cachedLanUrls
        .map((u) => `<code data-copy-url="${u}" title="Tap to copy LAN URL">${u}</code>`)
        .join(' ');
    } else {
      lanUrlsEl.textContent = `${location.origin}${getAppBasePath()}`;
    }
    if (lan.room) syncRoomInviteUi(lan.room);
  } catch {
    if (urlHeadSpan) urlHeadSpan.textContent = 'Direct WebRTC P2P Co-op:';
    if (lanUrlsEl) lanUrlsEl.textContent = 'Share your Room Link with buddies on Wi-Fi or cellular!';
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

function resetLobbyUiState(statusText = 'Connect to host or join a buddy\'s room.') {
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
  lanStatus.className = 'lan-status';
  lanStatus.textContent = statusText;
  renderLevelCards();
}

function updateOpenLanButtonBadge(rooms = lan.rooms) {
  if (!btnOpenLan) return;
  if (lan.room) {
    btnOpenLan.textContent = `👥 Team · ${lan.room.code}`;
    btnOpenLan.classList.add('has-rooms');
    return;
  }
  const openRooms = Array.isArray(rooms)
    ? rooms.filter((r) => r.playerCount < r.maxPlayers)
    : [];
  if (openRooms.length > 0) {
    btnOpenLan.textContent = `👥 Team (${openRooms.length})`;
    btnOpenLan.classList.add('has-rooms');
  } else {
    btnOpenLan.textContent = '👥 Team';
    btnOpenLan.classList.remove('has-rooms');
  }
}

function renderRoomsList(rooms = lan.rooms) {
  updateOpenLanButtonBadge(rooms);
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
      return `
        <div class="lan-room-row">
          <div class="lan-room-row-info">
            <span><strong>${r.code}</strong> · Host: ${r.hostName}</span>
            <span class="lan-room-row-sub">L${lvlIdx}: ${lvl.name} · ${stateText}</span>
          </div>
          <button
            type="button"
            class="btn tiny ${busy ? 'ghost' : 'primary'}"
            data-join-code="${r.code}"
            ${busy ? 'disabled' : ''}
          >
            ${full ? 'Full' : r.started ? 'Drop In' : 'Join'}
          </button>
        </div>
      `;
    })
    .join('');
}

async function selectAndLoadLevel(chosenId) {
  if (lan.room && !lan.isHost()) {
    showToast('Host selects the expedition site in co-op.', 2.0);
    return;
  }
  const nextLevel = getLevelById(chosenId);
  activeLevel = nextLevel;
  if (selectLevel) selectLevel.value = nextLevel.id;
  if (lbFilterLevelId !== 'overall') {
    lbFilterLevelId = nextLevel.id;
    if (selectLbSite) selectLbSite.value = nextLevel.id;
  }
  syncMenuLevelLabels(nextLevel);
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
    mapEuropeZoom = !mapEuropeZoom;
    renderSiteWorldMap();
  });
}

if (siteViewTabsEl && siteBrowserEl) {
  siteViewTabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-site-view]');
    if (!btn) return;
    const v = btn.dataset.siteView;
    siteViewMode = v === 'map' || v === 'list' ? v : 'split';
    siteBrowserEl.className = `site-browser view-${siteViewMode}`;
    for (const b of siteViewTabsEl.querySelectorAll('button[data-site-view]')) {
      b.classList.toggle('active', b === btn);
    }
  });
}

btnPlaySolo.addEventListener('click', async () => {
  const diverName = requireCallsign();
  if (!diverName) return;
  if (lan.room) {
    lan.leaveRoom();
    resetLobbyUiState();
  }
  btnPlaySolo.disabled = true;
  try {
    await ensureLevelLoaded(activeLevel.id, { showOverlay: true });
    startDiveRun(false);
  } finally {
    btnPlaySolo.disabled = false;
  }
});

let activeMenuTab = 'solo';

function syncSitePickerVisibility() {
  if (!menuSitePicker) return;
  menuSitePicker.hidden = activeMenuTab === 'leaderboards';
}

async function setActiveMenuTab(tab = 'solo') {
  activeMenuTab = tab === 'team' ? 'team' : tab === 'leaderboards' ? 'leaderboards' : 'solo';
  const isSolo = activeMenuTab === 'solo';
  const isTeam = activeMenuTab === 'team';
  const isLb = activeMenuTab === 'leaderboards';

  tabBtnSolo?.classList.toggle('active', isSolo);
  tabBtnSolo?.setAttribute('aria-selected', String(isSolo));
  btnOpenLan?.classList.toggle('active', isTeam);
  btnOpenLan?.setAttribute('aria-selected', String(isTeam));
  btnOpenLeaderboard?.classList.toggle('active', isLb);
  btnOpenLeaderboard?.setAttribute('aria-selected', String(isLb));

  if (soloPanel) soloPanel.hidden = !isSolo;
  if (lanPanel) lanPanel.hidden = !isTeam;
  if (leaderboardPanel) leaderboardPanel.hidden = !isLb;
  if (menuIdentityRow) menuIdentityRow.hidden = isLb;
  syncSitePickerVisibility();

  if (isTeam) {
    if (!lan.connected) {
      setLanConnectionBadge('', '○ Connecting...');
    }
    lan.connect();
    lan.listRooms();
    await fetchLanUrls();
  } else if (isLb) {
    refreshMenuLeaderboard();
  }
}

tabBtnSolo?.addEventListener('click', () => setActiveMenuTab('solo'));
btnOpenLan.addEventListener('click', () => setActiveMenuTab('team'));
btnOpenLeaderboard?.addEventListener('click', () => setActiveMenuTab('leaderboards'));

leaderboardPanel?.addEventListener('click', (e) => {
  const modeBtn = e.target.closest('button[data-lb-mode]');
  if (modeBtn) {
    lbMode = modeBtn.dataset.lbMode === 'team' ? 'team' : 'solo';
    for (const b of leaderboardPanel.querySelectorAll('button[data-lb-mode]')) {
      b.classList.toggle('active', b === modeBtn);
    }
    refreshMenuLeaderboard();
  }
});

selectLbSite?.addEventListener('change', () => {
  lbFilterLevelId = selectLbSite.value || 'overall';
  refreshMenuLeaderboard();
});

if (lanUrlsEl) {
  lanUrlsEl.addEventListener('click', (e) => {
    const codeEl = e.target.closest('code[data-copy-url]');
    if (!codeEl) return;
    copyText(codeEl.dataset.copyUrl, `Copied LAN URL: ${codeEl.dataset.copyUrl}`);
  });
}

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

const btnQuickCoop = document.getElementById('btn-quick-coop');
if (btnQuickCoop) {
  btnQuickCoop.addEventListener('click', async () => {
    const name = requireCallsign();
    if (!name) return;
    btnQuickCoop.disabled = true;
    const maxPlayers = Number(document.getElementById('select-max-players')?.value || 4);
    requestDiverNotificationPermission();
    try {
      lanStatus.className = 'lan-status';
      lanStatus.textContent = 'Opening drop-in co-op room...';
      lan.connect();
      const room = await lan.createRoom(name, activeLevel.id, maxPlayers, {
        checkpoints: [],
        collectibles: [],
        bodyRecovered: false,
        playerLines: [],
      });
      if (!room?.code) {
        showToast('Could not open co-op room right now — try again.', 2.8);
        return;
      }
      activeDiveSeq = room.diveSeq || 1;
      await copyCurrentInviteLink();
      await ensureLevelLoaded(activeLevel.id, { showOverlay: true });
      startDiveRun(true);
      showToast(`Room ${room.code} live & link copied! Friends drop straight in.`, 3.8);
    } finally {
      btnQuickCoop.disabled = false;
    }
  });
}

document.getElementById('btn-create-room').addEventListener('click', () => {
  const name = requireCallsign();
  if (!name) return;
  const maxPlayers = Number(document.getElementById('select-max-players')?.value || 4);
  requestDiverNotificationPermission();
  lanStatus.textContent = 'Creating room...';
  lan.connect();
  lan.createRoom(name, activeLevel.id, maxPlayers);
});

const roomCodeInput = document.getElementById('input-room-code');
function triggerJoinFromInput() {
  const name = requireCallsign();
  if (!name) return;
  const code = (roomCodeInput?.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) {
    lanStatus.className = 'lan-status warn';
    lanStatus.textContent = 'Enter a 4-letter room code or pick a room below.';
    return;
  }
  const matchedRoom = Array.isArray(lan.rooms) ? lan.rooms.find((r) => r.code === code) : null;
  const isDropIn = Boolean(matchedRoom?.started);
  lanStatus.className = 'lan-status';
  lanStatus.textContent = isDropIn ? `Dropping into Room ${code}...` : `Joining room ${code}...`;
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
      title: `Cave Diver Co-op · Room ${lan.room.code}`,
      text: `Join my Cave Diver co-op dive (${lvl.name}) — Room ${lan.room.code}`,
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
    setActiveMenuTab('team');
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
    const donation = donateGasFromState(session.diveState, targetGas, 25);
    if (!donation) {
      showToast('Reserve too low to share gas safely.', 2.0);
      return;
    }
    lan.sendGasShare(targetId, donation.gasId, donation.donatedBar);
    audio.playGasShare();
    showToast(`🎁 Shared +${donation.donatedBar} bar ${GAS_MIXES[donation.gasId]?.name || donation.gasId} with ${targetName}!`, 2.6);
    btn.hidden = true;
    return;
  }
  if (btn.id === 'btn-tow-buddy') {
    const peer = lan.getPeers().find((p) => p && p.id === btn.dataset.targetId);
    if (peer) attachBuddyTow(peer);
    btn.hidden = true;
    return;
  }
  const sig = btn.dataset.signal;
  if (!sig) return;
  session.diver.signalText = sig;
  session.diver.signalExpiresAt = performance.now() + 4000;
  lan.sendSignal(sig);
  audio.playCheckpoint();
  showToast(`Signaled crew: ${sig}`, 1.8);
});

btnCoopSpectate?.addEventListener('click', () => {
  spectatingPeer = !spectatingPeer;
  if (btnCoopSpectate) {
    btnCoopSpectate.textContent = spectatingPeer ? 'My Diver' : 'Watch Buddy';
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
  if (session?.diver) session.diver.torchOn = !session.diver.torchOn;
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
  if (e.key === 'Escape' && hudMenuPopover && !hudMenuPopover.hidden) {
    setHudMenuOpen(false);
  }
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
    btnMenuRadio.textContent = audio.getRadioButtonLabel();
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

document.getElementById('btn-abort').addEventListener('click', () => {
  const prevCode = lan.room?.code || '';
  mode = 'menu';
  spectatingPeer = false;
  activeDiveSeq = 0;
  setHudMenuOpen(false);
  screenHud.hidden = true;
  if (coopCommsEl) coopCommsEl.hidden = true;
  if (coopWaitBannerEl) coopWaitBannerEl.hidden = true;
  screenMenu.hidden = false;
  if (isMultiplayer) {
    lan.leaveRoom();
    isMultiplayer = false;
    setActiveMenuTab('team');
    resetLobbyUiState(prevCode ? `Aborted dive (Room ${prevCode} stays open for remaining divers).` : 'Aborted dive and left room.');
    if (prevCode && roomCodeInput) roomCodeInput.value = prevCode;
  }
  renderRoomsList();
  renderLevelCards();
});

document.getElementById('btn-retry').addEventListener('click', () => {
  if (isMultiplayer && lan.room) {
    mode = 'menu';
    screenDebrief.hidden = true;
    screenMenu.hidden = false;
    setActiveMenuTab('team');
    renderLevelCards();
    if (lan.isHost()) {
      lan.returnToLobby();
      showToast('Back in co-op room — choose next site or start dive!', 2.8);
    } else {
      showToast('Returned to room lobby — waiting for Host to launch next dive.', 2.8);
    }
    return;
  }
  startDiveRun(false);
});

document.getElementById('btn-menu').addEventListener('click', () => {
  const prevCode = lan.room?.code || '';
  mode = 'menu';
  activeDiveSeq = 0;
  screenDebrief.hidden = true;
  screenMenu.hidden = false;
  if (isMultiplayer) {
    lan.leaveRoom();
    isMultiplayer = false;
    resetLobbyUiState(prevCode ? `Left co-op room ${prevCode}.` : 'Left co-op room.');
    if (prevCode && roomCodeInput) roomCodeInput.value = prevCode;
  }
  renderRoomsList();
  renderLevelCards();
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
  if (!lan.room && !pendingAutoJoinCode) {
    lanStatus.className = 'lan-status ok';
    lanStatus.textContent = isP2p
      ? 'WebRTC P2P ready (zero server). Create a room or enter a code.'
      : 'Connected to LAN server. Create or join a room.';
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
  const curPct = parseInt(document.getElementById('loader-pct')?.textContent || '0', 10) || 0;
  setLoaderProgress(Math.max(curPct, pct || curPct), message || `Joining Room ${joiningRoomCode}...`);
  if (loaderCrewStatusEl && message) loaderCrewStatusEl.textContent = message;
});

lan.on('error', (msg) => {
  if (suppressNextExpiredError) {
    suppressNextExpiredError = false;
    if (typeof msg === 'string' && (msg.includes('no longer active') || msg.includes('expired'))) {
      return;
    }
  }
  if (attemptJoinAfterExpire && (msg.includes('no longer active') || msg.includes('expired'))) {
    return;
  }
  if (directJoinToDive || pendingAutoJoinCode || joiningRoomCode) {
    directJoinToDive = false;
    pendingAutoJoinCode = '';
    syncBrowserRoomUrl('');
    finishRoomJoinLoading({ revealMenu: true });
    setActiveMenuTab('team');
  }
  lanStatus.className = 'lan-status warn';
  lanStatus.textContent = msg;
  showToast(msg, 3.0);
});

lan.on('returned_to_lobby', () => {
  loadSeq += 1;
  inFlightLoad = null;
  screenLoader.classList.add('done');
  if (loaderCoopSyncEl) loaderCoopSyncEl.hidden = true;
  if (mode === 'debrief') {
    mode = 'menu';
    screenDebrief.hidden = true;
    screenMenu.hidden = false;
    setActiveMenuTab('team');
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
      setActiveMenuTab('team');
    }
  }
  const justEnteredRoom = lanRoomBox.hidden;
  updateOpenLanButtonBadge(lan.rooms);
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
          <span><strong>${p.name}</strong> <small>(${roleTag})</small></span>
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
    setActiveMenuTab('team');
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
  audio.playCheckpoint();
  showToast(`${msg.name || 'Buddy'}: ${msg.signal}`, 3.0);
});

lan.on('peer_guideline', (msg) => {
  if (!session || !msg?.playerId) return;
  if (!session.restoredPeerLines) session.restoredPeerLines = new Map();
  session.restoredPeerLines.set(msg.playerId, msg.chains || []);
});

lan.on('peer_checkpoint', (msg) => {
  if (!session) return;
  session.checkpointsHit.add(msg.checkpointId);
  audio.playCheckpoint();
  showToast('Buddy tagged checkpoint!', 2.0);
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
  if (!session) return;
  session.bodyRecovered = true;
  const who = msg?.name || 'Buddy';
  const targetName = session.level.recoveryTarget?.name || 'fallen diver';
  audio.playCheckpoint();
  showToast(`🛟 ${who} secured ${targetName}! Escort back to surface exit.`, 4.0);
});

function attachBuddyTow(peer) {
  if (!session || !peer || peer.alive !== false || peer.rescued) return false;
  session.rescueTargetId = peer.id;
  session.diver.rescueTargetId = peer.id;
  peer.rescuedBy = lan.clientId || 'self';
  audio.playCheckpoint();
  showToast(`🛟 Towing ${peer.name || 'Buddy'}! Haul safely through deco to surface exit (+450 pts)!`, 3.6);
  lan.sendBuddyRescue(peer.id, peer.name || 'Buddy', 'towing');
  return true;
}

lan.on('peer_buddy_rescue', (msg) => {
  if (!session || mode !== 'diving') return;
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
    audio.playCheckpoint();
    showToast(`🛟 ${msg.rescuerName || 'Buddy'} clipped a rescue tow onto you!`, 3.6);
  } else {
    showToast(`🛟 ${msg.rescuerName || 'Buddy'} is towing ${msg.rescuedName || 'teammate'} toward the surface!`, 3.2);
  }
});

lan.on('peer_gas_share', (msg) => {
  if (!session || mode !== 'diving' || !msg?.amountBar) return;
  const added = receiveGasIntoState(session.diveState, msg.gasId, msg.amountBar);
  if (added > 0) {
    audio.playGasShare();
    const gName = GAS_MIXES[msg.gasId]?.name || msg.gasId || 'Gas';
    showToast(`🎁 ${msg.fromName || 'Buddy'} shared +${Math.round(added)} bar ${gName}!`, 3.0);
  }
});

lan.on('peer_left', () => {
  if (mode === 'diving' && Date.now() - lastHostPromoMs > 800) {
    showToast('Buddy diver left the dive.', 2.8);
  }
});

// --- Main Simulation Loop ---
let menuTimeSec = 0;

function stepSimulation(dt) {
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) {
      document.getElementById('game-toast').classList.remove('visible');
    }
  }

  const activeTimeSec = session ? session.simTimeSec : menuTimeSec;
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

  const { diver, diveState, checkpointsHit, level } = session;
  let result = {
    nextCheckpoint: level.checkpoints.find((cp) => !checkpointsHit.has(cp.id)) || null,
    blockedExitDecoDepthM: 0,
    outcome: null,
  };

  if (!session.endedState) {
    result = stepDiveSession(session, input.getThrust(), dt, {
      onToast: showToast,
      onImpactSound: () => audio.playImpact(),
      onAlarm: (lvl) => audio.playAlarm(lvl),
      onExhale: (ex) => audio.playRegulatorExhale(ex),
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
        audio.playCheckpoint();
        showToast(`🛟 Secured ${rt.name}! Tow carefully back through deep deco to the surface!`, 4.2);
        if (isMultiplayer) lan.sendBodyRecovered();
      },
      onSiltSpawn: (plume) => {
        if (isMultiplayer) lan.sendSiltEvent(plume);
      },
      onGuidelineSync: (chains) => {
        if (isMultiplayer) lan.sendGuidelineSync(chains, session.reelingActive);
      },
    });
  } else {
    session.simTimeSec += dt;
    diver.vx = 0;
    diver.vy = 0;
  }

  const peers = isMultiplayer ? lan.getPeers() : [];
  if (isMultiplayer) {
    // Share cave exploration coverage across LAN buddies
    if (session.exploreCells && session.exploredCells) {
      for (const p of peers) {
        if (markExploredAround(session.exploreCells, session.exploredCells, p.x, p.y, 4.4) > 0) {
          session.exploredPct = Math.round(
            (session.exploredCells.size / Math.max(1, session.exploreCells.length)) * 100
          );
        }
      }
    }
      const activeTank = diveState.tanks[diveState.activeGasId];
    const healthPct = computeHealthPct(diveState);
    const gasRemainingPct = computeGasRemainingPct(diveState);
    lan.sendPlayerState({
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
      condition: diveState.impairment?.primaryCondition || 'NOMINAL',
      surfaced: Boolean(session.surfaced),
      healthPct,
      gasRemainingPct,
      diveTimeSec: diveState.diveTimeSec,
      collectiblesFound: session.collectedIds?.size || 0,
      exploredPct: session.exploredPct || 0,
      depthM: diveState.depthM,
      torchOn: diver.torchOn,
      alive: diveState.alive,
      carryingBody: Boolean(session.carryingBody),
      rescueTargetId: session.rescueTargetId || '',
      rescuedBy: session.rescuedBy || '',
      rescued: Boolean(session.rescued),
      name: diver.name,
    });
    lan.stepPeerInterpolation(dt);

    // If downed and a rescuer is towing us, glide smoothly behind the rescuer
    if (!diveState.alive && session.rescuedBy) {
      const rescuer = peers.find((p) => p && (p.id === session.rescuedBy || p.rescueTargetId === lan.clientId));
      if (rescuer) {
        const ang = rescuer.angle || 0;
        const tx = rescuer.x - Math.cos(ang) * 1.55;
        const ty = rescuer.y - Math.sin(ang) * 1.55;
        diver.x += (tx - diver.x) * Math.min(1, dt * 8);
        diver.y += (ty - diver.y) * Math.min(1, dt * 8);
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
    if (isMultiplayer && diveState.alive && !session.endedState) {
      const mySpare = (diveState.tanks[diveState.activeGasId]?.bar || 0) > 38;
      if (mySpare) {
        let bestDist = 3.6;
        for (const p of peers) {
          if (!p || p.alive === false || p.surfaced) continue;
          const d = Math.hypot(p.x - diver.x, p.y - diver.y);
          const lowGas = (p.activeBar ?? 200) < 95 || p.condition === 'NO GAS' || p.condition === 'LOW GAS';
          if (lowGas && d <= bestDist) {
            bestDist = d;
            needyPeer = p;
          }
        }
      }
    }
    if (needyPeer) {
      btnShareGas.hidden = false;
      btnShareGas.dataset.targetId = needyPeer.id || '';
      btnShareGas.dataset.targetGas = needyPeer.gasId || diveState.activeGasId;
      btnShareGas.dataset.targetName = needyPeer.name || 'Buddy';
    } else {
      btnShareGas.hidden = true;
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
    playerName: sanitizeCallsignInput(playerNameInput?.value || ''),
    level,
    ascentConfig: session.ascentConfig,
    reelMaxMeters: session.reelMaxMeters || 0,
    reelRemainingM: getEffectiveReelRemainingM(session),
    reelingActive: Boolean(session.reelingActive),
    dt,
  });

  if (result.blockedExitDecoDepthM > 0) {
    showToast(`Hold at ${result.blockedExitDecoDepthM}m to clear deco stop before surfacing!`, 2.0);
  }

  if (result.outcome && !session.endedState) {
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
    if (!result.outcome.success) {
      spectatingPeer = true;
    }
    if (coopWaitBannerEl) {
      coopWaitBannerEl.hidden = false;
      coopWaitBannerEl.className = `coop-wait-banner ${result.outcome.success ? '' : 'down'}`;
      if (coopWaitTitleEl) {
        coopWaitTitleEl.textContent = result.outcome.success
          ? '✓ SURFACED SAFE · TEAM HOLD'
          : '✕ DIVER DOWN · SPECTATING CREW';
      }
      if (btnCoopSpectate) {
        btnCoopSpectate.textContent = spectatingPeer ? 'My Diver' : 'Watch Buddy';
      }
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
    const spectateTarget =
      spectatingPeer && peers.length > 0
        ? peers.find((p) => p.alive !== false && !p.surfaced) || peers[0]
        : null;
    const playerLines = [];
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
      const handledIds = new Set();
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
      timeSec: session.simTimeSec,
      dt,
    });
  } else if (renderer.ready && renderer.level?.id === activeLevel.id) {
    renderer.render({
      diver: {
        x: activeLevel.spawn.x + 7 + Math.sin(nowMs * 0.0003) * 4,
        y: Math.min(activeLevel.spawn.y + 6.5, 9),
        vx: 0,
        vy: 0,
        angle: 0.2,
        torchOn: true,
      },
      diveState: createDiveState(),
      peerDiver: null,
      checkpointsHit: new Set(),
      nextCheckpoint: activeLevel.checkpoints[0],
      siltClouds: [],
      bubbles: [],
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
    if (btnPwaUpdate && !applyingUpdate) {
      btnPwaUpdate.textContent = detectedRemoteVer ? `⬆ v${detectedRemoteVer}` : '⬆ Update';
      btnPwaUpdate.classList.add('has-update');
      btnPwaUpdate.title = `Update Cave Diver to ${verLabel}`;
    }
    if (mode === 'diving' && !announcedDiveToast) {
      announcedDiveToast = true;
      showToast(`⬆ Update (${verLabel}) ready — open Menu after surfacing to apply.`, 3.8);
    }
  };

  const watchInstallingWorker = (worker) => {
    if (!worker) return;
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
          showToast(`⬆ Cave Diver v${remoteVer} is ready — tap Update Now!`, 3.2);
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
        showToast(`✓ Cave Diver v${localVersion} is up to date!`, 2.4);
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
    setTimeout(reloadApp, 2800);

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
              const tm = setTimeout(resolve, 1800);
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

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {}
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
  document.addEventListener('visibilitychange', syncWakeLock);
  window.addEventListener('focus', syncWakeLock);
  setInterval(syncWakeLock, 5000);

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
    showToast('Cave Diver installed to Home Screen!', 3.0);
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
  setupPwaSupport();
  if (INITIAL_ROOM_CODE) {
    beginRoomJoinLoading(INITIAL_ROOM_CODE, {
      directDive: true,
      statusText: `Connecting to Room ${INITIAL_ROOM_CODE}...`,
    });
  } else {
    screenLoader.classList.add('done');
  }
  btnPlaySolo.disabled = false;
  btnOpenLan.disabled = false;

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
    setActiveMenuTab('team');
    if (roomCodeInput) roomCodeInput.value = savedSession.code;
    lanStatus.className = 'lan-status';
    lanStatus.textContent = `Reconnecting to room ${savedSession.code}...`;
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

  requestAnimationFrame(frame);
}

bootGame();
