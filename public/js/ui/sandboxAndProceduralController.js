import { escapeHtml } from '../util/common.js';
import {
  DEFAULT_LEVEL_ID,
  getLevelById,
  PROCEDURAL_TIERS,
  PROCEDURAL_BIOMES,
  normalizeProceduralSeed,
  randomProceduralSeed,
  buildProceduralLevelId,
  buildProceduralShareUrl,
  generateProceduralLevel,
} from '../levels/index.js';
import { DAILY_MUTATORS, getDailyMutatorById } from '../game/logbookModel.js';
import { buildChallengeUrl, formatChallengeSummary } from '../game/challengeLink.js';

/**
 * Custom Challenge Links, Mutator Sandbox & Procedural Endless Cave Generator (v123–v125 / modularized v172).
 */
export function createSandboxAndProceduralController({
  difficultyPrefKey,
  drillsPrefKey,
  getActiveLevel,
  getActiveDifficulty,
  setActiveDifficulty,
  getDrillsEnabled,
  setDrillsEnabled,
  getCustomGasPlan,
  setCustomGasPlan,
  saveCustomGasPlan,
  syncGasPlanBadges,
  syncPreferenceMenuButtons,
  syncDrillsUi,
  syncSetupDrawerSummary,
  loadCareerLogbook,
  getDiverName,
  setHomeMenuOpen,
  closeDiveSetupModal,
  selectAndLoadLevel,
  btnPlaySolo,
  showToast,
}) {
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
    const gasPlan = getCustomGasPlan();
    return {
      siteId: getActiveLevel()?.id || DEFAULT_LEVEL_ID,
      difficulty: draftSandbox.difficulty,
      mutatorId: draftSandbox.mutatorId,
      customGas: draftSandbox.customGas,
      o2Pct: gasPlan.o2Pct,
      hePct: gasPlan.hePct,
      drillsEnabled: draftSandbox.drillsEnabled,
      challengerName: getDiverName() || '',
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
      const gp = getCustomGasPlan();
      const mixTxt = gp.hePct > 0 ? `TMX ${gp.o2Pct}/${gp.hePct}` : `EAN${gp.o2Pct}`;
      sandboxGasLabelEl.textContent = `🧪 Include Custom Trimix (${mixTxt})`;
    }
    const url = buildChallengeUrl(`${location.origin}${location.pathname}`, getDraftChallengeConfig());
    if (sandboxUrlInput) sandboxUrlInput.value = url;
    if (btnSandboxShare) btnSandboxShare.hidden = typeof navigator.share !== 'function';
  }

  function openChallengeModal() {
    if (!challengeModal) return;
    setHomeMenuOpen(false);
    const pbRec = loadCareerLogbook().cleared?.[getActiveLevel()?.id];
    draftSandbox = {
      mutatorId: activeSandboxMutatorId,
      difficulty: getActiveDifficulty(),
      drillsEnabled: getDrillsEnabled(),
      customGas: getCustomGasPlan().enabled,
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
    setActiveDifficulty(draftSandbox.difficulty);
    try { localStorage.setItem(difficultyPrefKey, draftSandbox.difficulty); } catch {}
    syncPreferenceMenuButtons();

    const nextDrills = Boolean(draftSandbox.drillsEnabled);
    setDrillsEnabled(nextDrills);
    try { localStorage.setItem(drillsPrefKey, nextDrills ? '1' : '0'); } catch {}
    syncDrillsUi();

    getCustomGasPlan().enabled = Boolean(draftSandbox.customGas);
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
    setActiveDifficulty(ch.difficulty);
    try { localStorage.setItem(difficultyPrefKey, ch.difficulty); } catch {}
    syncPreferenceMenuButtons();

    activeSandboxMutatorId = ch.mutatorId || '';
    syncSandboxPillUi();

    const nextDrills = Boolean(ch.drillsEnabled);
    setDrillsEnabled(nextDrills);
    try { localStorage.setItem(drillsPrefKey, nextDrills ? '1' : '0'); } catch {}
    syncDrillsUi();

    if (ch.customGas) {
      setCustomGasPlan({ enabled: true, o2Pct: ch.o2Pct, hePct: ch.hePct });
    } else {
      getCustomGasPlan().enabled = false;
      saveCustomGasPlan();
    }
    syncGasPlanBadges();

    if (ch.siteId && ch.siteId !== getActiveLevel()?.id) {
      await selectAndLoadLevel(ch.siteId, { focusMap: false });
    }
    renderIncomingChallengeBanner();
    try {
      const cleanUrl = `${location.origin}${location.pathname}`;
      history.replaceState(null, '', cleanUrl);
    } catch {}
  }

  btnOpenChallenge?.addEventListener('click', openChallengeModal);
  menuMutatorPillEl?.addEventListener('click', () => {
    closeDiveSetupModal();
    openChallengeModal();
  });
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
    const { shareText } = formatChallengeSummary(cfg, { levelName: getActiveLevel()?.name || 'Expedition', mutator: mut });
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

  // Procedural Endless Expeditions ("Uncharted Sump Generator", v125)
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

  const draftProcedural = {
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
  menuProcPillEl?.addEventListener('click', () => {
    closeDiveSetupModal();
    openProceduralModal();
  });
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

  return {
    challengeModal,
    proceduralModal,
    menuProcPillEl,
    debriefChallengeBannerEl,
    btnChallengeAccept,
    btnChallengeDismiss,
    btnDebriefChallenge,
    draftProcedural,
    getActiveSandboxMutatorId: () => activeSandboxMutatorId,
    setActiveSandboxMutatorId(id) { activeSandboxMutatorId = id || ''; },
    getActiveIncomingChallenge: () => activeIncomingChallenge,
    setActiveIncomingChallenge(ch) { activeIncomingChallenge = ch; },
    setLastDebriefChallenge(url, text) {
      lastDebriefChallengeUrl = url || '';
      lastDebriefChallengeText = text || '';
    },
    getLastDebriefChallenge: () => ({ url: lastDebriefChallengeUrl, text: lastDebriefChallengeText }),
    syncSandboxPillUi,
    openChallengeModal,
    closeChallengeModal,
    copyOrShareChallengeUrl,
    renderIncomingChallengeBanner,
    applyIncomingChallenge,
    openProceduralModal,
    closeProceduralModal,
    applyProceduralLevelToMenu,
  };
}
