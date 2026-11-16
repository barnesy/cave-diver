import { LEVELS, DEFAULT_LEVEL_ID, CAMPAIGN_PLAN, getLevelById, getLevelMeta, getLevelMaxDepthM } from './levels/index.js';
import { createDiveState, switchGas, GAS_MIXES } from './physics/diveModel.js';
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
const btnPlaySolo = document.getElementById('btn-play-solo');
const btnOpenLan = document.getElementById('btn-open-lan');
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
const lanUrlsEl = document.getElementById('lan-urls');
const loaderCoopSyncEl = document.getElementById('loader-coop-sync');
const loaderCrewStatusEl = document.getElementById('loader-crew-status');
const btnLoaderForce = document.getElementById('btn-loader-force');
const btnLoaderCancel = document.getElementById('btn-loader-cancel');
const coopCommsEl = document.getElementById('coop-comms');
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
let attemptJoinAfterExpire = '';
let activeDiveSeq = 0;
let copyInviteFeedbackTimer = 0;

// Restore saved player callsign on phone/desktop (use unique fallback when auto-joining via link)
try {
  const savedName = localStorage.getItem('caveDiverCallsign');
  if (savedName && playerNameInput) {
    playerNameInput.value = savedName;
  } else if (INITIAL_ROOM_CODE && playerNameInput && playerNameInput.value === 'Diver 1') {
    playerNameInput.value = 'Buddy Diver';
  }
  playerNameInput?.addEventListener('change', () => {
    const clean = playerNameInput.value.trim();
    if (clean) localStorage.setItem('caveDiverCallsign', clean);
  });
} catch {
  // ignore storage restriction
}

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
    const depth = `${meta.maxDepthM}m`;
    const metaText = isCached
      ? best > 0
        ? `✓ ${best.toLocaleString()}`
        : lvl.reelMetersPerDiver > 0
          ? `✓ Ready · ${lvl.reelMetersPerDiver}m Reel`
          : `✓ Ready`
      : lvl.reelMetersPerDiver > 0
        ? `No Line · ${lvl.reelMetersPerDiver}m Reel`
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
          <span>${tierTag}</span>
          <span class="lvl-card-depth">${depth}</span>
        </div>
        <span class="lvl-card-name">${lvl.name}</span>
        <span class="lvl-card-meta ${isCached ? 'cached' : lvl.reelMetersPerDiver > 0 ? 'reel' : ''}">${metaText}</span>
      </button>
    `;
  }).join('');
}

function syncMenuLevelLabels(level) {
  const idx = LEVELS.findIndex((l) => l.id === level.id);
  const lvlNum = idx >= 0 ? idx + 1 : 1;
  btnPlaySolo.textContent = `SOLO DIVE · LEVEL ${lvlNum}`;
  const menuTitle = screenMenu.querySelector('.menu-title');
  const menuDesc = screenMenu.querySelector('.menu-desc');
  const loaderTitle = screenLoader.querySelector('.loader-title');
  const loaderMetaSpan = screenLoader.querySelector('.loader-meta span');
  const chipRangeTmx = document.getElementById('chip-range-tmx');
  const depthNum = parseInt(getLevelDepthLabel(level), 10) || 50;
  if (menuTitle) menuTitle.textContent = level.name.toUpperCase();
  if (menuDesc && level.description) menuDesc.textContent = level.description;
  if (loaderTitle) loaderTitle.textContent = level.name.toUpperCase();
  if (loaderMetaSpan && level.subtitle) loaderMetaSpan.textContent = level.subtitle.toUpperCase();
  if (chipRangeTmx) chipRangeTmx.textContent = `3–${Math.max(65, depthNum)}m Bottom`;
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
  if (showOverlay && (!isCached || keepOpenAfterLoad)) {
    screenLoader.classList.remove('done');
  }
  if (!isCached && inlineLoaderEl) {
    inlineLoaderEl.hidden = false;
  }
  setLoaderProgress(isCached ? 95 : 8, `Loading ${nextLevel.name}...`);

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
          setLoaderProgress(pct, label);
          if (pct < 100) broadcastLoadProgress(pct);
        },
      });
      if (res?.cancelled || mySeq !== loadSeq) return nextLevel;
      setLoaderProgress(96, 'Populating marine life & ecosystems...');
      await nextUiTick();
      if (mySeq !== loadSeq) return nextLevel;
      ecosystem = createMarineEcosystem(nextLevel);
      setLoaderProgress(100, keepOpenAfterLoad ? 'Dive systems ready — waiting on crew...' : 'Dive systems ready.');
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
    audio.playGasSwitch();
    showToast(`Anchored reel! Paying out cave line (${Math.round(session.reelRemainingM)}m left).`, 2.2);
    if (isMultiplayer) lan.sendGuidelineSync(session.guidelineChains, true);
  } else if (res.action === 'tie_off') {
    audio.playCheckpoint();
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
    audio.playGasSwitch();
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
  screenMenu.hidden = true;
  screenDebrief.hidden = true;
  screenHud.hidden = false;
  if (coopCommsEl) coopCommsEl.hidden = !multiplayer;
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

  const teamSummary = computeTeamScoreSummary(localSummary, isMultiplayer ? lan.getPeers() : []);

  if (success) {
    spawnCelebrationConfetti();
    audio.playVictoryFanfare();
  }

  const badge = document.getElementById('debrief-badge');
  badge.textContent = success
    ? teamSummary.isTeam
      ? teamSummary.allSurvived
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
    rows.push({
      label: `Team Bonus (${teamSummary.survivorsCount}/${teamSummary.teamSize})`,
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
            <span>${r.alive ? `${r.healthPct}% HP · ${formatRunClock(r.diveTimeSec)} · ${r.gasRemainingPct}% Gas` : 'DOWN'}</span>
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
  if (lanInviteUrlInput) {
    lanInviteUrlInput.value = inviteUrl;
  }
  if (btnShareInvite) {
    btnShareInvite.hidden = !(code && typeof navigator.share === 'function');
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
  if (lanSetupControls) lanSetupControls.hidden = false;
  if (lanInviteUrlInput) lanInviteUrlInput.value = '';
  if (btnShareInvite) btnShareInvite.hidden = true;
  syncBrowserRoomUrl('');
  setLevelSelectionLocked(false);
  lanStatus.className = 'lan-status';
  lanStatus.textContent = statusText;
  renderLevelCards();
}

function updateOpenLanButtonBadge(rooms = lan.rooms) {
  if (!btnOpenLan) return;
  if (lan.room) {
    btnOpenLan.textContent = `LAN CO-OP · ROOM ${lan.room.code}`;
    btnOpenLan.classList.add('has-rooms');
    return;
  }
  const openRooms = Array.isArray(rooms)
    ? rooms.filter((r) => r.playerCount < r.maxPlayers)
    : [];
  if (openRooms.length > 0) {
    btnOpenLan.textContent = `CO-OP · ${openRooms.length} OPEN ROOM${openRooms.length > 1 ? 'S' : ''}`;
    btnOpenLan.classList.add('has-rooms');
  } else {
    btnOpenLan.textContent = 'CO-OP DIVE (2–4 DIVERS)';
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
  syncMenuLevelLabels(nextLevel);
  if (lan.room && lan.isHost()) {
    lan.setLevel(nextLevel.id);
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

btnPlaySolo.addEventListener('click', async () => {
  btnPlaySolo.disabled = true;
  try {
    await ensureLevelLoaded(activeLevel.id, { showOverlay: true });
    startDiveRun(false);
  } finally {
    btnPlaySolo.disabled = false;
  }
});

btnOpenLan.addEventListener('click', async () => {
  lanPanel.hidden = !lanPanel.hidden;
  if (!lanPanel.hidden) {
    if (!lan.connected) {
      setLanConnectionBadge('', '○ Connecting...');
    }
    lan.connect();
    lan.listRooms();
    await fetchLanUrls();
  }
});

if (lanUrlsEl) {
  lanUrlsEl.addEventListener('click', (e) => {
    const codeEl = e.target.closest('code[data-copy-url]');
    if (!codeEl) return;
    copyText(codeEl.dataset.copyUrl, `Copied LAN URL: ${codeEl.dataset.copyUrl}`);
  });
}

if (lanRoomsList) {
  lanRoomsList.addEventListener('click', (e) => {
    const joinBtn = e.target.closest('button[data-join-code]');
    if (!joinBtn || joinBtn.disabled) return;
    const code = joinBtn.dataset.joinCode;
    const name = playerNameInput?.value.trim() || 'Buddy Diver';
    const roomInput = document.getElementById('input-room-code');
    if (roomInput) roomInput.value = code;
    lanStatus.textContent = `Joining room ${code}...`;
    lan.connect();
    lan.joinRoom(code, name);
  });
}

document.getElementById('btn-create-room').addEventListener('click', () => {
  const name = playerNameInput?.value.trim() || 'Lead Diver';
  const maxPlayers = Number(document.getElementById('select-max-players')?.value || 2);
  lanStatus.textContent = 'Creating room...';
  lan.connect();
  lan.createRoom(name, activeLevel.id, maxPlayers);
});

const roomCodeInput = document.getElementById('input-room-code');
function triggerJoinFromInput() {
  const code = (roomCodeInput?.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const name = playerNameInput?.value.trim() || 'Buddy Diver';
  if (!code) {
    lanStatus.className = 'lan-status warn';
    lanStatus.textContent = 'Enter a 4-letter room code or pick a room below.';
    return;
  }
  lanStatus.className = 'lan-status';
  lanStatus.textContent = `Joining room ${code}...`;
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
  if (cachedLanUrls.length === 0) await fetchLanUrls();
  syncRoomInviteUi(lan.room);
  const inviteUrl = lanInviteUrlInput?.value || buildRoomInviteUrl(lan.room.code);
  const ok = await copyText(inviteUrl, `Copied invite link for Room ${lan.room.code}!`, {
    selectEl: lanInviteUrlInput,
  });
  if (ok && btnCopyInvite) {
    clearTimeout(copyInviteFeedbackTimer);
    btnCopyInvite.textContent = '✓ Copied!';
    btnCopyInvite.classList.add('copied');
    copyInviteFeedbackTimer = setTimeout(() => {
      btnCopyInvite.textContent = 'Copy Link';
      btnCopyInvite.classList.remove('copied');
    }, 2000);
  }
}

btnCopyInvite?.addEventListener('click', copyCurrentInviteLink);

lanInviteUrlInput?.addEventListener('click', () => {
  lanInviteUrlInput.focus();
  lanInviteUrlInput.select();
  copyCurrentInviteLink();
});

btnShareInvite?.addEventListener('click', async () => {
  if (!lan.room || typeof navigator.share !== 'function') return;
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
  screenLoader.classList.add('done');
  if (loaderCoopSyncEl) loaderCoopSyncEl.hidden = true;
  if (lan.room && lan.isHost()) lan.cancelPrepare();
});

coopCommsEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('.comm-btn');
  if (!btn || !session || mode !== 'diving') return;
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

const btnMute = document.getElementById('btn-mute');
btnMute.addEventListener('click', () => {
  const next = !audio.muted;
  audio.setMuted(next);
  btnMute.textContent = next ? '🔇' : '🔊';
});

document.getElementById('btn-abort').addEventListener('click', () => {
  const prevCode = lan.room?.code || '';
  mode = 'menu';
  spectatingPeer = false;
  activeDiveSeq = 0;
  screenHud.hidden = true;
  if (coopCommsEl) coopCommsEl.hidden = true;
  if (coopWaitBannerEl) coopWaitBannerEl.hidden = true;
  screenMenu.hidden = false;
  if (isMultiplayer) {
    lan.leaveRoom();
    isMultiplayer = false;
    lanPanel.hidden = false;
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
    lanPanel.hidden = false;
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
    const diverName = playerNameInput?.value.trim() || 'Buddy Diver';
    pendingAutoJoinCode = code;
    lanStatus.className = 'lan-status';
    lanStatus.textContent = `Joining room ${code}...`;
    lan.joinRoom(code, diverName);
    return;
  }
  resetLobbyUiState('Previous room session expired. Create or join a room.');
});

lan.on('error', (msg) => {
  if (attemptJoinAfterExpire && (msg.includes('no longer active') || msg.includes('expired'))) {
    return;
  }
  if (pendingAutoJoinCode) {
    pendingAutoJoinCode = '';
    syncBrowserRoomUrl('');
    lanPanel.hidden = false;
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
    lanPanel.hidden = false;
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
  if (autoJoinedNow) {
    pendingAutoJoinCode = '';
    lanPanel.hidden = false;
  }
  const justEnteredRoom = lanRoomBox.hidden;
  updateOpenLanButtonBadge(lan.rooms);
  lanRoomBox.hidden = false;
  if (lanSetupControls) lanSetupControls.hidden = true;
  if (lanRoomsSection) lanRoomsSection.hidden = true;

  syncRoomInviteUi(room);
  syncBrowserRoomUrl(room.code);
  if (justEnteredRoom || autoJoinedNow) {
    lanRoomBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  if (autoJoinedNow) {
    showToast(`Joined Room ${room.code} automatically!`, 3.0);
  }

  const siteLevel = getLevelById(room.levelId);
  const siteNum = Math.max(1, LEVELS.findIndex((l) => l.id === siteLevel.id) + 1);
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
});

lan.on('dive_preparing', async (msg) => {
  if (loaderCoopSyncEl) loaderCoopSyncEl.hidden = false;
  updateLoaderCrewSyncBanner(msg.room);
  await ensureLevelLoaded(msg.levelId || activeLevel.id, {
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
  if (loaderCoopSyncEl) loaderCoopSyncEl.hidden = true;
  if (mode === 'diving' && session && msg?.rejoined && msg?.diveSeq && msg.diveSeq === activeDiveSeq) {
    if (msg.checkpoints) for (const cpId of msg.checkpoints) session.checkpointsHit.add(cpId);
    if (msg.collectibles) for (const cId of msg.collectibles) session.collectedIds.add(cId);
    if (msg.bodyRecoveredBy && !session.bodyRecovered) session.bodyRecovered = true;
    return;
  }
  activeDiveSeq = msg?.diveSeq || 1;
  if (msg?.levelId) {
    await ensureLevelLoaded(msg.levelId, { showOverlay: true, keepOpenAfterLoad: false });
  }
  startDiveRun(
    true,
    msg?.rejoined
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

lan.on('peer_left', () => {
  if (mode === 'diving') {
    showToast('Buddy diver disconnected from LAN.', 2.8);
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
      name: diver.name,
    });
    lan.stepPeerInterpolation(dt);
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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // ignore registration issues on non-HTTPS custom LAN hosts
    });
  }

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
  screenLoader.classList.add('done');
  btnPlaySolo.disabled = false;
  btnOpenLan.disabled = false;

  // Keep socket & room session alive seamlessly across mobile app-switching and tab navigation
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) lan.ensureConnected();
  });
  window.addEventListener('pageshow', () => lan.ensureConnected());
  window.addEventListener('focus', () => lan.ensureConnected());
  window.addEventListener('online', () => lan.ensureConnected());

  // Connect WebSocket quietly so active LAN rooms badge & auto-join/restore work instantaneously
  lan.connect();
  fetchLanUrls();

  const savedSession = lan.getSavedSession();
  if (savedSession && (!INITIAL_ROOM_CODE || savedSession.code === INITIAL_ROOM_CODE)) {
    pendingAutoJoinCode = savedSession.code;
    attemptJoinAfterExpire = INITIAL_ROOM_CODE || '';
    lanPanel.hidden = false;
    if (roomCodeInput) roomCodeInput.value = savedSession.code;
    lanStatus.className = 'lan-status';
    lanStatus.textContent = `Reconnecting to room ${savedSession.code}...`;
    lanPanel.scrollIntoView({ block: 'nearest' });
  } else if (INITIAL_ROOM_CODE) {
    pendingAutoJoinCode = INITIAL_ROOM_CODE;
    lanPanel.hidden = false;
    if (roomCodeInput) roomCodeInput.value = INITIAL_ROOM_CODE;
    const diverName = playerNameInput?.value.trim() || 'Buddy Diver';
    lanStatus.className = 'lan-status';
    lanStatus.textContent = `Auto-joining room ${INITIAL_ROOM_CODE}...`;
    lanPanel.scrollIntoView({ block: 'nearest' });
    lan.joinRoom(INITIAL_ROOM_CODE, diverName);
  }

  requestAnimationFrame(frame);
}

bootGame();
