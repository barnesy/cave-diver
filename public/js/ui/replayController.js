import { decodeReplayTrack, drawReplayFrame, formatReplayTime, renderExpeditionPostcard } from '../game/diveCard.js';
import { getLevelById, getLevelMaxDepthM } from '../levels/index.js';

const REPLAY_SPEEDS = [1, 2, 4];

export function createReplayPlayer({ canvas, metaEl, playBtn, scrubber, speedBtn, onTimeUpdate = null }) {
  const state = {
    level: null,
    samples: [],
    profile: null,
    progress: 0,
    playing: false,
    speedIdx: 1, // default 2x
    rafId: 0,
    lastTs: 0,
  };

  let timeListener = typeof onTimeUpdate === 'function' ? onTimeUpdate : null;

  function draw({ notify = true } = {}) {
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
    if (notify && pose && typeof timeListener === 'function') {
      timeListener(pose.t, state.progress);
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

  function seekToTime(tSec, { notify = true } = {}) {
    if (!state.level || state.samples.length < 2) return;
    stop();
    const totalSec = Math.max(1, state.samples[state.samples.length - 1]?.t || 20);
    state.progress = Math.max(0, Math.min(1, (Number(tSec) || 0) / totalSec));
    draw({ notify });
  }

  function setOnTimeUpdate(fn) {
    timeListener = typeof fn === 'function' ? fn : null;
  }

  return { load, play, stop, draw, seekToTime, setOnTimeUpdate };
}

/**
 * Dive Replay Theater & Shareable PNG Expedition Postcard controller (v121 / modularized v172).
 */
export function createReplayTheaterController({
  github,
  showToast,
  loadGhostTrack,
  loadCareerLogbook,
  getDiverName,
  getActiveDifficulty,
}) {
  async function shareOrDownloadPostcard(cardData) {
    if (!cardData?.level) return false;
    const off = document.createElement('canvas');
    off.width = 1200;
    off.height = 630;
    const ctx = off.getContext('2d');
    if (!ctx) return false;

    const appVer = document.querySelector('meta[name="app-version"]')?.content || '172';
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
  const debriefReplay = createReplayPlayer({
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
  const modalReplay = createReplayPlayer({
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
      diverName: getDiverName() || 'Diver',
      success: Boolean(rec),
      grade: rec?.grade || 'PB',
      score: rec?.score || 0,
      maxDepthM: maxD || getLevelMaxDepthM(lvl),
      diveTimeSec: totalSec,
      exploredPct: rec ? 100 : 0,
      difficulty: rec?.bestDifficulty || getActiveDifficulty(),
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

  return {
    replayModal,
    debriefReplayWrapEl,
    debriefReplay,
    shareOrDownloadPostcard,
    openLogbookReplayModal,
    closeReplayModal,
    setLastDebriefCardData(data) {
      lastDebriefCardData = data;
    },
    isOpen: () => Boolean(replayModal && !replayModal.hidden),
  };
}
