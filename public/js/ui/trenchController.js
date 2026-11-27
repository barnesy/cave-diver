/**
 * Abyssal Trench Endless Risk-Reward Mode UI Controller (v206).
 *
 * Manages:
 * - `#modal-trench` Launcher Modal (Personal Records, 6-Char Seed input/random/copy, Biome Ladder)
 * - `#hud-trench-pill` Live HUD indicator during Endless Trench runs
 * - `#trench-choice-overlay` Air-Bell Extraction vs Push-Deeper overlay on Chamber Clear
 */

import { escapeHtml } from '../util/common.js';
import {
  TRENCH_BIOME_LADDER,
  TRENCH_CHAMBER_PERKS,
  normalizeTrenchSeed,
  generateTrenchSeed,
  getTrenchChamberMeta,
  createTrenchChamberLevel,
  createTrenchRunState,
  applyTrenchPerkToRun,
  recordTrenchChamberClear,
  finalizeTrenchRun,
  buildTrenchShareUrl,
  parseTrenchFromSearch,
  loadTrenchBest,
} from '../game/abyssalTrench.js';
import { triggerHaptic } from './touchFeedback.js';

export function createTrenchController({
  modalManager,
  setHomeMenuOpen,
  closeDiveSetupModal,
  launchTrenchLevel,
  finishTrenchToDebrief,
  showToast,
  playUiModalOpen,
  playUiToggle,
}) {
  const modalEl = document.getElementById('modal-trench');
  const btnOpenHome = document.getElementById('btn-open-trench');
  const btnOpenSetup = document.getElementById('btn-setup-open-trench');
  const btnClose = document.getElementById('btn-trench-close');
  const recordsEl = document.getElementById('trench-records-bar');
  const seedInputEl = document.getElementById('input-trench-seed');
  const btnRandomSeed = document.getElementById('btn-trench-random');
  const btnCopySeed = document.getElementById('btn-trench-copy');
  const ladderEl = document.getElementById('trench-biome-ladder');
  const btnLaunch = document.getElementById('btn-trench-launch');

  const hudPillEl = document.getElementById('hud-trench-pill');
  const choiceOverlayEl = document.getElementById('trench-choice-overlay');
  const choiceTitleEl = document.getElementById('trench-choice-title');
  const choiceSubEl = document.getElementById('trench-choice-sub');
  const choiceStatsEl = document.getElementById('trench-choice-stats');
  const perkRowEl = document.getElementById('trench-perk-row');
  const btnExtract = document.getElementById('btn-trench-extract');
  const btnDescend = document.getElementById('btn-trench-descend');
  const btnDescendSubEl = document.getElementById('trench-descend-sub');

  let currentSeed = generateTrenchSeed();
  let activeRun = null;
  let pendingClearContext = null;
  let selectedPerkId = TRENCH_CHAMBER_PERKS[0].id;

  function renderRecords() {
    if (!recordsEl) return;
    const best = loadTrenchBest();
    recordsEl.innerHTML = `
      <div class="trench-rec-cell"><span>BEST CHAMBER</span><strong>${best.bestChamber > 0 ? `CH ${best.bestChamber}` : '—'}</strong></div>
      <div class="trench-rec-cell"><span>MAX DEPTH</span><strong>${best.bestDepthM > 0 ? `${best.bestDepthM.toFixed(1)}m` : '—'}</strong></div>
      <div class="trench-rec-cell"><span>HIGH BANKED</span><strong>${best.bestScore > 0 ? best.bestScore.toLocaleString() : '—'}</strong></div>
      <div class="trench-rec-cell"><span>RUNS</span><strong>${best.runs}</strong></div>
    `;
  }

  function renderLadder() {
    if (!ladderEl) return;
    ladderEl.innerHTML = TRENCH_BIOME_LADDER.map((tier) => `
      <div class="trench-ladder-row" style="--tier-accent:${tier.accent}">
        <span class="trench-tier-badge">CH ${tier.chamber}</span>
        <div class="trench-tier-main">
          <strong>${escapeHtml(tier.name)}</strong>
          <span>${escapeHtml(tier.depthBand)} · ${escapeHtml(tier.gasHint)}</span>
        </div>
        <span class="trench-tier-mult">${tier.multiplier.toFixed(1)}×</span>
      </div>
    `).join('');
  }

  function syncHudPill() {
    if (!hudPillEl) return;
    if (!activeRun?.active) {
      hudPillEl.hidden = true;
      return;
    }
    const meta = getTrenchChamberMeta(activeRun.chamber);
    const effMult = meta.multiplier + (activeRun.multiplierBonus || 0);
    hudPillEl.textContent = `🌊 CH ${meta.chamber} · ${effMult.toFixed(2).replace(/\.00$/, '.0')}× · ${activeRun.seed}`;
    hudPillEl.title = `Abyssal Trench · ${meta.name} · Banked: ${activeRun.bankedScore.toLocaleString()} pts`;
    hudPillEl.hidden = false;
  }

  function renderPerkChoices() {
    if (!perkRowEl) return;
    perkRowEl.innerHTML = TRENCH_CHAMBER_PERKS.map((perk) => {
      const sel = perk.id === selectedPerkId;
      return `
        <button type="button" class="trench-perk-btn${sel ? ' selected' : ''}" data-trench-perk="${escapeHtml(perk.id)}" style="--perk-accent:${perk.accent}" aria-pressed="${sel ? 'true' : 'false'}">
          <span class="trench-perk-ico">${perk.icon}</span>
          <span class="trench-perk-copy">
            <strong>${escapeHtml(perk.name)}</strong>
            <span>${escapeHtml(perk.shortDesc)}</span>
          </span>
        </button>`;
    }).join('');
  }

  perkRowEl?.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-trench-perk]');
    if (!btn) return;
    selectedPerkId = btn.getAttribute('data-trench-perk') || TRENCH_CHAMBER_PERKS[0].id;
    renderPerkChoices();
    playUiToggle?.();
    triggerHaptic('tap');
  });

  function openTrenchModal(prefillSeed = null) {
    if (!modalEl) return;
    setHomeMenuOpen?.(false);
    if (prefillSeed) {
      currentSeed = normalizeTrenchSeed(prefillSeed);
    }
    if (seedInputEl) seedInputEl.value = currentSeed;
    renderRecords();
    renderLadder();
    modalManager?.open(modalEl);
    playUiModalOpen?.();
  }

  function closeTrenchModal() {
    if (!modalEl) return;
    modalManager?.close(modalEl);
  }

  function hideChoiceOverlay() {
    if (choiceOverlayEl) choiceOverlayEl.hidden = true;
    pendingClearContext = null;
  }

  function startNewTrenchRun(seedOverride = null) {
    const chosenSeed = normalizeTrenchSeed(seedOverride || seedInputEl?.value || currentSeed);
    currentSeed = chosenSeed;
    if (seedInputEl) seedInputEl.value = chosenSeed;
    activeRun = createTrenchRunState(chosenSeed);
    pendingClearContext = null;
    hideChoiceOverlay();
    closeTrenchModal();
    closeDiveSetupModal?.();
    const lvl = createTrenchChamberLevel(chosenSeed, 1);
    syncHudPill();
    triggerHaptic('sonar');
    launchTrenchLevel?.(lvl, activeRun);
  }

  function handleChamberCleared({ scoreResult, session }) {
    if (!activeRun?.active) return false;
    const clearInfo = recordTrenchChamberClear(activeRun, {
      baseScore: scoreResult?.totalScore || 650,
      relics: session?.collectedIds?.size || 0,
      maxDepthM: session?.diver?.maxDepthM || session?.diver?.y || 0,
      elapsedSec: session?.elapsedSec || 0,
      healthPct: session?.diver?.health ?? 100,
    });
    pendingClearContext = { scoreResult, session, clearInfo };
    triggerHaptic('extract');
    if (choiceTitleEl) {
      choiceTitleEl.textContent = `AIR-BELL REACHED · CHAMBER ${clearInfo.chamberCleared} CLEARED`;
    }
    if (choiceSubEl) {
      choiceSubEl.textContent = `${clearInfo.chamberName} · Seed ${activeRun.seed}`;
    }
    if (choiceStatsEl) {
      choiceStatsEl.innerHTML = `
        <div class="trench-choice-stat"><span>CHAMBER SCORE</span><strong>+${clearInfo.chamberPoints.toLocaleString()}</strong></div>
        <div class="trench-choice-stat highlight"><span>TOTAL BANKED</span><strong>${clearInfo.bankedScore.toLocaleString()}</strong></div>
        <div class="trench-choice-stat"><span>RELICS</span><strong>${activeRun.totalRelics}</strong></div>
        <div class="trench-choice-stat"><span>MAX DEPTH</span><strong>${activeRun.maxDepthM.toFixed(1)}m</strong></div>
      `;
    }
    if (btnDescendSubEl) {
      btnDescendSubEl.textContent = `CH ${clearInfo.nextChamber}: ${clearInfo.nextName} (${clearInfo.nextDepthBand}) · ${clearInfo.nextMultiplier.toFixed(2).replace(/\.00$/, '.0')}× Mult`;
    }
    selectedPerkId = TRENCH_CHAMBER_PERKS[0].id;
    renderPerkChoices();
    if (choiceOverlayEl) choiceOverlayEl.hidden = false;
    return true;
  }

  function handleTrenchFailed() {
    if (!activeRun?.active) return null;
    hideChoiceOverlay();
    const summary = finalizeTrenchRun(activeRun, { extracted: false });
    activeRun = null;
    syncHudPill();
    return summary;
  }

  function resetTrenchRun() {
    hideChoiceOverlay();
    activeRun = null;
    syncHudPill();
  }

  // Wire buttons
  btnOpenHome?.addEventListener('click', () => openTrenchModal());
  btnOpenSetup?.addEventListener('click', () => openTrenchModal());
  btnClose?.addEventListener('click', closeTrenchModal);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) closeTrenchModal();
  });

  seedInputEl?.addEventListener('input', () => {
    const clean = seedInputEl.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (seedInputEl.value !== clean) seedInputEl.value = clean;
    if (clean.length >= 3) currentSeed = clean;
  });

  btnRandomSeed?.addEventListener('click', () => {
    currentSeed = generateTrenchSeed();
    if (seedInputEl) seedInputEl.value = currentSeed;
    playUiToggle?.();
    triggerHaptic('tap');
  });

  btnCopySeed?.addEventListener('click', async () => {
    const seed = normalizeTrenchSeed(seedInputEl?.value || currentSeed);
    currentSeed = seed;
    if (seedInputEl) seedInputEl.value = seed;
    const shareUrl = buildTrenchShareUrl(window.location?.href, seed);
    try {
      await navigator.clipboard?.writeText(shareUrl);
      showToast?.(`📋 Copied Trench Seed ${seed} link!`, 2.4);
    } catch {
      showToast?.(`🌊 Trench Seed: ${seed}`, 2.4);
    }
    playUiToggle?.();
    triggerHaptic('tap');
  });

  btnLaunch?.addEventListener('click', () => startNewTrenchRun());

  btnExtract?.addEventListener('click', () => {
    if (!activeRun) return;
    const ctx = pendingClearContext;
    hideChoiceOverlay();
    const summary = finalizeTrenchRun(activeRun, { extracted: true });
    activeRun = null;
    syncHudPill();
    triggerHaptic('extract');
    finishTrenchToDebrief?.(summary, ctx);
  });

  btnDescend?.addEventListener('click', () => {
    if (!activeRun?.active) return;
    hideChoiceOverlay();
    const chosenPerk = applyTrenchPerkToRun(activeRun, selectedPerkId);
    activeRun.chamber += 1;
    const nextLvl = createTrenchChamberLevel(activeRun.seed, activeRun.chamber);
    syncHudPill();
    triggerHaptic('dash');
    const effMult = (nextLvl.trenchMultiplier || 1) + (activeRun.multiplierBonus || 0);
    showToast?.(
      `⬇️ Trench CH ${activeRun.chamber} (${effMult.toFixed(2).replace(/\.00$/, '.0')}×) · ${chosenPerk.icon} ${chosenPerk.name}`,
      3.0
    );
    launchTrenchLevel?.(nextLvl, activeRun);
  });

  // Check URL `?trenchSeed=` deep link on boot
  const urlTrench = typeof window !== 'undefined' ? parseTrenchFromSearch(window.location.search) : null;
  if (urlTrench?.seed) {
    currentSeed = urlTrench.seed;
    if (seedInputEl) seedInputEl.value = currentSeed;
  }

  return {
    openTrenchModal,
    closeTrenchModal,
    startNewTrenchRun,
    handleChamberCleared,
    handleTrenchFailed,
    resetTrenchRun,
    syncHudPill,
    isTrenchActive: () => Boolean(activeRun?.active),
    getActiveTrenchRun: () => activeRun,
    getIncomingTrenchSeed: () => urlTrench?.seed || null,
  };
}
