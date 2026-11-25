import { escapeHtml } from '../util/common.js';
import { LEVELS } from '../levels/index.js';
import { computeUnlockedGear, recordFoundWorldGear } from '../game/logbookModel.js';
import {
  SUIT_LIVERIES,
  TORCH_OPTICS,
  MILESTONE_PATCHES,
  HEADGEAR_STYLES,
  ACCENT_TRIMS,
  TANK_FINISHES,
  VISOR_TINTS,
  OUTFITTER_PRESETS,
  DEFAULT_RIG_LIVERY,
  getSuitLivery,
  getGearTierMeta,
  getGearItemProgress,
  getNextGearMilestones,
  diffUnlockedLiveries,
  getGearItemBySlot,
  evaluateGearSetSynergy,
  resolveDiverLiveryPalette,
  computeUnlockedLiveries,
  sanitizeRigLivery,
  isDefaultRigLivery,
  randomizeUnlockedLivery,
  drawLiveryPreview,
  drawMiniDiverAvatar,
} from '../game/rigLivery.js';
import { createGearUnlockShowcase } from './gearUnlockShowcase.js';
import {
  GEAR_ARCHETYPES,
  CHEST_GEAR_DROPS,
  WORLD_GEAR_CACHES,
  computeRigPerformanceProfile,
  diffRigPerformanceProfiles,
  evaluateLootUpgradeImpact,
  getGearItemStats,
  SET_TIER_BONUSES,
} from '../game/gearStats.js';
import {
  buildSetPreviewPatch,
  buildBestOwnedRig,
  createProvingGroundsLevel,
  configureProvingGroundsSession,
  applyTrialLiveryToSession,
  createProvingGroundsHudBar,
} from '../game/gearProvingGrounds.js';

export const WRECK_LEVEL_ID_SET = new Set(
  LEVELS.filter((l) => Boolean(l.isWreck || l.category === 'wreck')).map((l) => l.id)
);
export const LIVERY_SLOTS_KEY = 'caveDiverLiverySlots_v1';
export const SQUAD_UNIFORM_KEY = 'caveDiverSquadUniform_v1';
export const SEEN_GEAR_UNLOCKS_KEY = 'caveDiverSeenGearUnlocks_v1';
const SAVED_KIT_LABELS = ['Cave Kit', 'Wreck Kit', 'Night Ops'];
const EQUIP_ANIM_DURATION_MS = 860;

/**
 * Diver Gear Workshop, Difficulty-Aligned Progression Ladder, Kinetic Equip Animations,
 * Special Animated Gear FX & Celebratory Unlock Showcase Cards (v138–v211).
 */
export function createLiveryWorkshopController({
  liveryPrefKey,
  loadCareerLogbook,
  saveCareerLogbook = null,
  getEffectiveGearLoadout,
  getSavedGearLoadout,
  saveGearLoadout,
  renderTechGearDock,
  getSession,
  syncSetupDrawerSummary,
  closeDiveSetupModal,
  setHomeMenuOpen,
  scheduleGitHubStatsSync,
  showToast,
  playGearEquip = null,
  playGearUnlock = null,
  spawnConfetti = null,
  launchProvingGrounds = null,
  exitProvingGrounds = null,
  getDifficulty = null,
  getActiveModifiers = null,
}) {
  function getCurrentLiveryUnlocks() {
    let book = null;
    try { book = loadCareerLogbook(); } catch {}
    return computeUnlockedLiveries(book, WRECK_LEVEL_ID_SET);
  }

  let activeRigLivery = { ...DEFAULT_RIG_LIVERY };
  try {
    const rawLiv = localStorage.getItem(liveryPrefKey);
    if (rawLiv) {
      activeRigLivery = sanitizeRigLivery(JSON.parse(rawLiv), getCurrentLiveryUnlocks());
    }
  } catch {}

  // Track which unlocked gear items have already been seen/celebrated so NEW badges & unlock cards feel crisp
  let seenUnlockKeys = new Set();
  function _collectAllUnlockedKeys(unlocks) {
    const keys = [];
    if (!unlocks) return keys;
    for (const id of unlocks.suits || []) keys.push(`suit:${id}`);
    for (const id of unlocks.trims || []) keys.push(`trim:${id}`);
    for (const id of unlocks.headgears || []) keys.push(`headgear:${id}`);
    for (const id of unlocks.visors || []) keys.push(`visor:${id}`);
    for (const id of unlocks.tanks || []) keys.push(`tank:${id}`);
    for (const id of unlocks.torches || []) keys.push(`torch:${id}`);
    for (const id of unlocks.patches || []) keys.push(`patch:${id}`);
    return keys;
  }
  function saveSeenUnlockKeys() {
    try { localStorage.setItem(SEEN_GEAR_UNLOCKS_KEY, JSON.stringify(Array.from(seenUnlockKeys))); } catch {}
  }
  try {
    const rawSeen = localStorage.getItem(SEEN_GEAR_UNLOCKS_KEY);
    if (rawSeen) {
      const parsed = JSON.parse(rawSeen);
      if (Array.isArray(parsed)) seenUnlockKeys = new Set(parsed.filter((k) => typeof k === 'string'));
    } else {
      // Seed existing unlocked items on first v211 load so returning veterans only get cards for brand-new future unlocks
      seenUnlockKeys = new Set(_collectAllUnlockedKeys(getCurrentLiveryUnlocks()));
      saveSeenUnlockKeys();
    }
  } catch {}

  function markEntrySeen(key) {
    if (!key || seenUnlockKeys.has(key)) return;
    seenUnlockKeys.add(key);
    saveSeenUnlockKeys();
  }

  function getUnseenEntries(unlocks) {
    const out = [];
    for (const k of _collectAllUnlockedKeys(unlocks)) {
      if (seenUnlockKeys.has(k)) continue;
      const [slot, id] = k.split(':');
      const entry = getGearItemBySlot(slot, id);
      if (entry && entry.item.tier !== 'common') out.push(entry);
    }
    out.sort((a, b) => (b.tier?.rank || 0) - (a.tier?.rank || 0));
    return out;
  }

  const menuLiveryPillEl = document.getElementById('menu-livery-pill');
  const btnHomeOpenLiveryEl = document.getElementById('btn-home-open-livery');
  const homeAvatarCanvasEl = document.getElementById('home-avatar-canvas');
  const homeAvatarCtx = homeAvatarCanvasEl?.getContext?.('2d') || null;
  const liveryModalEl = document.getElementById('livery-modal');
  const liveryPreviewCanvasEl = document.getElementById('livery-preview-canvas');
  const liveryPreviewCtx = liveryPreviewCanvasEl?.getContext?.('2d') || null;
  const liveryPerfPanelEl = document.getElementById('livery-perf-panel');
  const liveryLadderRailEl = document.getElementById('livery-ladder-rail');
  const liveryPresetRowEl = document.getElementById('livery-preset-row');
  const liverySavedSlotsEl = document.getElementById('livery-saved-slots');
  const btnLiveryTeamUniformEl = document.getElementById('btn-livery-team-uniform');
  const liveryCatTabsEl = document.getElementById('livery-cat-tabs');
  const liveryEnvTabsEl = document.getElementById('livery-env-tabs');
  const btnLiveryPrevCcrEl = document.getElementById('btn-livery-prev-ccr');
  const btnLiveryPrevDpvEl = document.getElementById('btn-livery-prev-dpv');
  const btnLiveryBestEl = document.getElementById('btn-livery-best');
  const btnLiveryRandomEl = document.getElementById('btn-livery-random');
  const btnLiveryFieldTestEl = document.getElementById('btn-livery-field-test');
  const liverySuitGridEl = document.getElementById('livery-suit-grid');
  const liveryTrimGridEl = document.getElementById('livery-trim-grid');
  const liveryHeadgearGridEl = document.getElementById('livery-headgear-grid');
  const liveryVisorGridEl = document.getElementById('livery-visor-grid');
  const liveryTankGridEl = document.getElementById('livery-tank-grid');
  const liveryTorchGridEl = document.getElementById('livery-torch-grid');
  const liveryPatchGridEl = document.getElementById('livery-patch-grid');
  const liveryUnlockSummaryEl = document.getElementById('livery-unlock-summary');
  const debriefGearUnlocksEl = document.getElementById('debrief-gear-unlocks');
  const lootDiscoveryBannerEl = document.getElementById('loot-discovery-banner');
  const hudGearBuffsEl = document.getElementById('hud-gear-buffs');
  let lootBannerTimer = null;
  const btnLiveryCloseEl = document.getElementById('btn-livery-close');
  const btnLiveryResetEl = document.getElementById('btn-livery-reset');
  const btnLiveryDoneEl = document.getElementById('btn-livery-done');
  const liveryPanels = {
    suit: document.getElementById('livery-panel-suit'),
    head: document.getElementById('livery-panel-head'),
    gear: document.getElementById('livery-panel-gear'),
    patch: document.getElementById('livery-panel-patch'),
  };

  let activeLiveryTab = 'suit';
  let liveryPreviewEnv = 'clear';
  let liveryPreviewCcr = null;
  let liveryPreviewDpv = null;
  let workshopTuningMode = 'standard'; // guided | standard | hardcore | daily | trench | purist

  const WORKSHOP_TUNING_MODES = [
    { id: 'guided', icon: '🛡️', label: 'Guided' },
    { id: 'standard', icon: '🤿', label: 'Standard' },
    { id: 'hardcore', icon: '🔥', label: 'Hardcore' },
    { id: 'daily', icon: '📅', label: 'Daily' },
    { id: 'trench', icon: '🌊', label: 'Trench 5' },
    { id: 'purist', icon: '🧭', label: 'Purist' },
  ];

  function getWorkshopTuningCtx(modeId = workshopTuningMode) {
    let mods = [];
    let curDiff = 'standard';
    try { if (typeof getActiveModifiers === 'function') mods = getActiveModifiers() || []; } catch {}
    try { if (typeof getDifficulty === 'function') curDiff = getDifficulty() || 'standard'; } catch {}
    if (modeId === 'guided' || modeId === 'standard' || modeId === 'hardcore') {
      return { difficulty: modeId, modifiers: mods };
    }
    if (modeId === 'daily') return { difficulty: 'standard', isDaily: true, modifiers: mods };
    if (modeId === 'trench') return { difficulty: curDiff, isTrench: true, trenchChamber: 5, modifiers: mods };
    if (modeId === 'purist') return { difficulty: 'standard', mutatorId: 'purist', modifiers: mods };
    return { difficulty: curDiff, modifiers: mods };
  }

  // Kinetic equip-on-avatar animation state, multi-slot Try-On & Set Inspector state (v211–v217)
  let activeEquipFx = null;
  let justEquippedKey = '';
  let lockedTryOn = null; // { slot, field, id, patch?, name, hint, tier, isSet?, setId? } | null
  let inspectedSetId = '';
  let recentDiveUnlocks = [];
  let savedPrevLevelBeforeProving = null;

  function getDisplayedRigLivery() {
    if (!lockedTryOn) return activeRigLivery;
    if (lockedTryOn.patch && typeof lockedTryOn.patch === 'object') {
      return { ...activeRigLivery, ...lockedTryOn.patch };
    }
    return { ...activeRigLivery, [lockedTryOn.field]: lockedTryOn.id };
  }

  const provingHudBar = createProvingGroundsHudBar({
    getSession,
    getEquippedLivery: () => activeRigLivery,
    onExitToWorkshop: () => {
      const prevLvl = savedPrevLevelBeforeProving;
      savedPrevLevelBeforeProving = null;
      exitProvingGrounds?.(prevLvl);
      openLiveryModal(activeLiveryTab);
    },
    playGearEquip,
    showToast,
  });

  async function startFieldTestDive({ trialLivery = null, trialLabel = '' } = {}) {
    if (typeof launchProvingGrounds !== 'function') return false;
    const pgLevel = createProvingGroundsLevel();
    const useLivery = trialLivery ? { ...trialLivery } : { ...getDisplayedRigLivery() };
    const isCustomTrial = Boolean(trialLivery || lockedTryOn);
    const label = trialLabel || (lockedTryOn ? lockedTryOn.name : '');
    closeLiveryModal();
    closeDiveSetupModal?.();
    setHomeMenuOpen?.(false);
    savedPrevLevelBeforeProving = await launchProvingGrounds(pgLevel);
    const sess = getSession?.();
    const pgModeId = workshopTuningMode === 'trench' ? 'standard' : workshopTuningMode;
    const pgTuningCtx = getWorkshopTuningCtx(pgModeId);
    if (sess) {
      sess.rigTuningCtx = pgTuningCtx;
      if (pgTuningCtx.difficulty) sess.difficulty = pgTuningCtx.difficulty;
      configureProvingGroundsSession(sess, useLivery);
    }
    provingHudBar.show({
      trialLivery: isCustomTrial ? useLivery : null,
      trialLabel: label,
      initialPresetId: isCustomTrial ? 'trial' : 'equipped',
      initialModeId: pgModeId,
    });
    showToast?.('🧪 Gear Proving Grounds ready! Swim the 6 lanes & hot-swap Sets live on the top bar.', 3.8);
    return true;
  }

  let savedLiverySlots = [null, null, null];
  try {
    const rawSlots = JSON.parse(localStorage.getItem(LIVERY_SLOTS_KEY) || 'null');
    if (Array.isArray(rawSlots)) {
      savedLiverySlots = [0, 1, 2].map((i) => (rawSlots[i] && typeof rawSlots[i] === 'object' ? rawSlots[i] : null));
    }
  } catch {}
  let aiSquadTeamUniform = false;
  try {
    aiSquadTeamUniform = localStorage.getItem(SQUAD_UNIFORM_KEY) === '1';
  } catch {}

  function triggerEquipAnimation(slot, itemOrMeta = null, { silentAudio = false } = {}) {
    const tierId = itemOrMeta?.tier || 'common';
    const tierMeta = getGearTierMeta(tierId);
    activeEquipFx = {
      slot: slot || 'all',
      startedAtMs: performance.now(),
      color: tierMeta.color,
      tier: tierMeta.id,
      itemName: itemOrMeta?.name || '',
    };
    if (slot && itemOrMeta?.id) {
      justEquippedKey = `${slot}:${itemOrMeta.id}`;
    }
    if (!silentAudio) {
      playGearEquip?.(slot, tierMeta.id);
    }
  }

  function saveLiverySlotsToStorage({ skipCloudSync = false } = {}) {
    try { localStorage.setItem(LIVERY_SLOTS_KEY, JSON.stringify(savedLiverySlots)); } catch {}
    if (!skipCloudSync) scheduleGitHubStatsSync();
  }

  function saveRigLivery({ skipCloudSync = false } = {}) {
    try { localStorage.setItem(liveryPrefKey, JSON.stringify(activeRigLivery)); } catch {}
    if (!skipCloudSync) scheduleGitHubStatsSync();
  }

  function reconcileActiveRigLiveryFromStorage() {
    try {
      const rawLiv = localStorage.getItem(liveryPrefKey);
      if (rawLiv) {
        activeRigLivery = sanitizeRigLivery(JSON.parse(rawLiv), getCurrentLiveryUnlocks());
      }
    } catch {}
  }

  function renderHomeAvatarBadge() {
    if (!homeAvatarCtx || !homeAvatarCanvasEl) return;
    let hasCcr = false;
    let hasDpv = false;
    try {
      const eq = getEffectiveGearLoadout();
      hasCcr = Boolean(eq?.ccr);
      hasDpv = Boolean(eq?.dpv);
    } catch {}
    drawMiniDiverAvatar(homeAvatarCtx, homeAvatarCanvasEl.width, homeAvatarCanvasEl.height, activeRigLivery, { hasCcr, hasDpv });
  }

  function renderHudGearBuffs(perf, session) {
    if (!hudGearBuffsEl) return;
    if (!perf || session?.isProvingGrounds) {
      hudGearBuffsEl.hidden = true;
      return;
    }
    if (perf.tuning?.isNormalized) {
      hudGearBuffsEl.hidden = false;
      hudGearBuffsEl.innerHTML = `<span class="hud-gb-arch arch-hybrid">🧭 PURIST</span><span class="hud-gb-list"><span>Normalized Baseline (0% Buffs)</span></span>`;
      return;
    }
    const chips = [];
    if (perf.bonusStartBar > 0) chips.push(`+${perf.bonusStartBar}b`);
    if (perf.narcDepthBonusM > 0) chips.push(`+${perf.narcDepthBonusM}m Depth`);
    if (perf.swimSpeedMult >= 1.05) chips.push(`+${Math.round((perf.swimSpeedMult - 1) * 100)}% Swim`);
    if (perf.gasBurnMult <= 0.94) chips.push(`-${Math.round((1 - perf.gasBurnMult) * 100)}% Gas`);
    if (perf.combatMaxHpBonus > 0) chips.push(`${100 + perf.combatMaxHpBonus} Boss HP`);
    if (perf.coldResist >= 0.99) chips.push('Cold-Proof');
    if (perf.siltGhost) chips.push('Silt-Ghost');
    if (perf.hydroGhost) chips.push('Hydro-Ghost');
    if (perf.relicCompass) chips.push('Relic Compass');
    if (perf.apexOvercharge) chips.push('Hyper-Tip');
    if (Array.isArray(perf.modifierSynergies)) {
      for (const ms of perf.modifierSynergies) chips.push(`${ms.icon} ${ms.label}`);
    }
    if (chips.length === 0) {
      hudGearBuffsEl.hidden = true;
      return;
    }
    const arch = perf.dominantArchetype || GEAR_ARCHETYPES.hybrid;
    const modeTag = perf.tuning && perf.tuning.modeTag !== 'standard'
      ? `<span class="hud-gb-mode">${perf.tuning.icon} ${escapeHtml(perf.tuning.modeTag === 'trench' ? `TR.${perf.tuning.trenchChamber}` : perf.tuning.label.toUpperCase())}</span>`
      : '';
    hudGearBuffsEl.hidden = false;
    hudGearBuffsEl.innerHTML = `<span class="hud-gb-arch arch-${arch.id}">${arch.icon} ${perf.isHybridMix ? 'HYBRID' : arch.short}</span>${modeTag}<span class="hud-gb-list">${chips.slice(0, 4).map((c) => `<span>${escapeHtml(c)}</span>`).join('')}</span>`;
  }

  function hideLootDiscoveryBanner() {
    if (lootBannerTimer) { clearTimeout(lootBannerTimer); lootBannerTimer = null; }
    if (lootDiscoveryBannerEl) {
      lootDiscoveryBannerEl.hidden = true;
      lootDiscoveryBannerEl.innerHTML = '';
    }
  }

  function _buildLootImpactSection(slot, itemId, sess) {
    let fallbackDiff = 'standard';
    try { if (typeof getDifficulty === 'function') fallbackDiff = getDifficulty() || 'standard'; } catch {}
    const curLivery = sess?.diver?.livery || activeRigLivery;
    const tuningCtx = sess?.rigTuningCtx || getWorkshopTuningCtx(fallbackDiff);
    const impact = evaluateLootUpgradeImpact(curLivery, slot, itemId, tuningCtx);

    const chips = [];
    for (const sc of impact.setChanges || []) {
      chips.push(`<span class="loot-impact-chip ${sc.positive ? 'pos' : 'neg'} is-set">${sc.positive ? '▲' : '▼'} ${escapeHtml(sc.text)}</span>`);
    }
    for (const gp of impact.gainedPowers || []) {
      chips.push(`<span class="loot-impact-chip pos is-pwr">▲ +⚡ ${escapeHtml(gp.name)}</span>`);
    }
    for (const lp of impact.lostPowers || []) {
      chips.push(`<span class="loot-impact-chip neg is-pwr">▼ -⚡ ${escapeHtml(lp.name)}</span>`);
    }
    for (const d of (impact.deltas || []).slice(0, 6)) {
      chips.push(`<span class="loot-impact-chip ${d.positive ? 'pos' : 'neg'}">${d.positive ? '▲' : '▼'} ${escapeHtml(d.text)}</span>`);
    }
    if (impact.archChanged && impact.archBefore && impact.archAfter) {
      chips.push(`<span class="loot-impact-chip neutral">${impact.archBefore.icon} ${escapeHtml(impact.archBefore.short)} → ${impact.archAfter.icon} ${escapeHtml(impact.archAfter.short)}</span>`);
    }

    const bodyHtml = impact.isNormalized
      ? `<div class="loot-impact-note">🧭 Purist mode active — cosmetic unlock only (stats normalized).</div>`
      : impact.verdict === 'same'
        ? `<div class="loot-impact-note">✓ You already have this item equipped in this slot.</div>`
        : chips.length > 0
          ? `<div class="loot-impact-deltas">${chips.join('')}</div>`
          : `<div class="loot-impact-note">Matches your current build stats closely.</div>`;

    const html = `
      <div class="loot-impact-box verdict-${impact.verdict}">
        <div class="loot-impact-head">
          <span class="loot-verdict-pill verdict-${impact.verdict}">${impact.verdictIcon} ${escapeHtml(impact.verdictLabel)}</span>
          <span class="loot-impact-vs">vs Equipped: <strong>${escapeHtml(impact.replacedItemName)}</strong></span>
        </div>
        ${bodyHtml}
      </div>
    `;

    let equipLabel = '⚡ Equip Mid-Dive';
    let equipCls = 'primary';
    if (impact.verdict === 'upgrade') {
      equipLabel = '▲ Equip Upgrade';
      equipCls = 'primary upgrade-equip';
    } else if (impact.verdict === 'tradeoff') {
      equipLabel = '⇄ Swap Mid-Dive';
      equipCls = 'secondary';
    } else if (impact.verdict === 'downgrade') {
      equipLabel = 'Equip Anyway';
      equipCls = 'ghost';
    }
    return { html, impact, equipLabel, equipCls, showEquip: impact.verdict !== 'same' };
  }

  function handleWorldGearFound(gc) {
    if (!gc) return;
    playGearUnlock?.(gc.tier || 'rare');
    const sess = getSession?.();
    const isDemo = Boolean(gc.isDemoCache || sess?.isProvingGrounds);
    if (!isDemo && typeof saveCareerLogbook === 'function') {
      try {
        const res = recordFoundWorldGear(loadCareerLogbook(), {
          slot: gc.slot,
          itemId: gc.itemId,
          siteId: sess?.level?.id || '',
          siteName: sess?.level?.name || '',
        });
        if (res?.book) saveCareerLogbook(res.book);
      } catch {}
    }
    syncLiveryUi();

    if (!lootDiscoveryBannerEl) return;
    const entry = getGearItemBySlot(gc.slot, gc.itemId);
    const item = entry?.item || { id: gc.itemId, name: gc.itemName || gc.name || gc.itemId, tier: gc.tier || 'rare' };
    const info = getGearItemStats(gc.slot, item);
    const tierMeta = getGearTierMeta(item.tier || gc.tier || 'rare');
    const arch = info.archetype || GEAR_ARCHETYPES.hybrid;
    const pillsHtml = info.pills.slice(0, 4).map((p) => `<span class="livery-stat-pill">${escapeHtml(p)}</span>`).join('');
    const pwrHtml = info.power ? `<div class="loot-disc-power">⚡ <strong>${escapeHtml(info.power.name)}</strong> — ${escapeHtml(info.power.desc)}</div>` : '';
    const cmp = _buildLootImpactSection(gc.slot, gc.itemId, sess);
    lootDiscoveryBannerEl.dataset.tier = tierMeta.id;
    lootDiscoveryBannerEl.hidden = false;
    lootDiscoveryBannerEl.innerHTML = `
      <div class="loot-disc-top">
        <span class="loot-disc-kicker">${tierMeta.icon} ${isDemo ? 'DEMO CACHE' : 'WORLD GEAR DISCOVERED'} · ${tierMeta.badge}</span>
        <span class="livery-arch-pill arch-${arch.id}">${arch.icon} ${arch.short}</span>
      </div>
      <div class="loot-disc-name">${gc.icon || '📦'} ${escapeHtml(item.name)}</div>
      <div class="loot-disc-pills">${pillsHtml}</div>
      ${pwrHtml}
      ${cmp.html}
      <div class="loot-disc-actions">
        ${entry?.field && cmp.showEquip ? `<button type="button" class="btn tiny ${cmp.equipCls}" id="btn-loot-equip-now">${escapeHtml(cmp.equipLabel)}</button>` : ''}
        <button type="button" class="btn tiny ghost" id="btn-loot-dismiss">Keep Swimming</button>
      </div>
    `;
    lootDiscoveryBannerEl.querySelector('#btn-loot-dismiss')?.addEventListener('click', hideLootDiscoveryBanner);
    lootDiscoveryBannerEl.querySelector('#btn-loot-equip-now')?.addEventListener('click', () => {
      if (entry?.field && entry?.item) {
        if (!isDemo) {
          updateActiveLiveryField({ [entry.field]: entry.item.id }, { slot: entry.slot, itemMeta: entry.item });
        } else if (sess) {
          applyTrialLiveryToSession(sess, { ...(sess.diver?.livery || activeRigLivery), [entry.field]: entry.item.id });
          playGearEquip?.(entry.slot, tierMeta.id);
        }
        showToast?.(`⚡ Equipped ${entry.item.name} live mid-dive!`, 2.6);
      }
      hideLootDiscoveryBanner();
    });
    if (lootBannerTimer) clearTimeout(lootBannerTimer);
    lootBannerTimer = setTimeout(hideLootDiscoveryBanner, 11500);
  }

  function handleTreasureChestOpened(chest, drop) {
    if (!chest || !drop) return;
    const sess = getSession?.();
    if (drop.kind === 'gear') {
      playGearUnlock?.(drop.tier || 'rare');
      if (typeof saveCareerLogbook === 'function') {
        try {
          const res = recordFoundWorldGear(loadCareerLogbook(), {
            slot: drop.slot,
            itemId: drop.itemId,
            siteId: sess?.level?.id || '',
            siteName: sess?.level?.name || '',
          });
          if (res?.book) saveCareerLogbook(res.book);
        } catch {}
      }
      syncLiveryUi();

      if (!lootDiscoveryBannerEl) return;
      const entry = getGearItemBySlot(drop.slot, drop.itemId);
      const item = entry?.item || { id: drop.itemId, name: drop.name || drop.itemId, tier: drop.tier || 'rare' };
      const info = drop.statsInfo || getGearItemStats(drop.slot, item);
      const tierMeta = getGearTierMeta(item.tier || drop.tier || 'rare');
      const arch = info.archetype || GEAR_ARCHETYPES.hybrid;
      const pillsHtml = info.pills.slice(0, 4).map((p) => `<span class="livery-stat-pill">${escapeHtml(p)}</span>`).join('');
      const pwrHtml = info.power ? `<div class="loot-disc-power">⚡ <strong>${escapeHtml(info.power.name)}</strong> — ${escapeHtml(info.power.desc)}</div>` : '';
      const rarityBadge = drop.rarityLabel || `${tierMeta.badge} CHEST DROP`;
      const cmp = _buildLootImpactSection(drop.slot, drop.itemId, sess);
      lootDiscoveryBannerEl.dataset.tier = tierMeta.id;
      lootDiscoveryBannerEl.hidden = false;
      lootDiscoveryBannerEl.innerHTML = `
        <div class="loot-disc-top">
          <span class="loot-disc-kicker">🧰 ${escapeHtml(rarityBadge)} · ${tierMeta.icon} ${tierMeta.badge}</span>
          <span class="livery-arch-pill arch-${arch.id}">${arch.icon} ${arch.short}</span>
        </div>
        <div class="loot-disc-name">${drop.icon || '🧰'} ${escapeHtml(item.name)}</div>
        <div class="loot-disc-pills">${pillsHtml}<span class="livery-stat-pill">+${drop.points || 350} pts · +${drop.gasBonusBar || 10}b</span></div>
        ${pwrHtml}
        ${cmp.html}
        <div class="loot-disc-actions">
          ${entry?.field && cmp.showEquip ? `<button type="button" class="btn tiny ${cmp.equipCls}" id="btn-loot-equip-now">${escapeHtml(cmp.equipLabel)}</button>` : ''}
          <button type="button" class="btn tiny ghost" id="btn-loot-dismiss">Keep Swimming</button>
        </div>
      `;
      lootDiscoveryBannerEl.querySelector('#btn-loot-dismiss')?.addEventListener('click', hideLootDiscoveryBanner);
      lootDiscoveryBannerEl.querySelector('#btn-loot-equip-now')?.addEventListener('click', () => {
        if (entry?.field && entry?.item) {
          updateActiveLiveryField({ [entry.field]: entry.item.id }, { slot: entry.slot, itemMeta: entry.item });
          showToast?.(`⚡ Equipped ${entry.item.name} live mid-dive!`, 2.6);
        }
        hideLootDiscoveryBanner();
      });
      if (lootBannerTimer) clearTimeout(lootBannerTimer);
      lootBannerTimer = setTimeout(hideLootDiscoveryBanner, 11800);
      return;
    }

    // Salvage treasure drop (Spare Pony Bottle, DPV Cell, Doubloons, or Abyssal Reliquary)
    playGearEquip?.('all', drop.tier || 'rare');
    if (!lootDiscoveryBannerEl) return;
    const tierMeta = getGearTierMeta(drop.tier || 'rare');
    lootDiscoveryBannerEl.dataset.tier = tierMeta.id;
    lootDiscoveryBannerEl.hidden = false;
    lootDiscoveryBannerEl.innerHTML = `
      <div class="loot-disc-top">
        <span class="loot-disc-kicker">🧰 SUNKEN TREASURE CHEST · ${escapeHtml(drop.rarityLabel || tierMeta.badge)}</span>
        <span class="livery-tier-pill tier-${tierMeta.id}">${tierMeta.icon} ${tierMeta.badge}</span>
      </div>
      <div class="loot-disc-name">${drop.icon || '🪙'} ${escapeHtml(drop.name || 'Sunken Treasure')}</div>
      <div class="loot-disc-detail">${escapeHtml(drop.detail || `+${drop.points || 300} Salvage pts`)}</div>
      <div class="loot-disc-actions">
        <button type="button" class="btn tiny ghost" id="btn-loot-dismiss">Continue Dive</button>
      </div>
    `;
    lootDiscoveryBannerEl.querySelector('#btn-loot-dismiss')?.addEventListener('click', hideLootDiscoveryBanner);
    if (lootBannerTimer) clearTimeout(lootBannerTimer);
    lootBannerTimer = setTimeout(hideLootDiscoveryBanner, 4800);
  }

  function syncLiveryUi() {
    const pal = resolveDiverLiveryPalette(activeRigLivery);
    const session = getSession();
    let fallbackDiff = 'standard';
    try { if (typeof getDifficulty === 'function') fallbackDiff = getDifficulty() || 'standard'; } catch {}
    const liveTuningCtx = session?.rigTuningCtx || getWorkshopTuningCtx(fallbackDiff);
    const perf = computeRigPerformanceProfile(activeRigLivery, liveTuningCtx);
    const custom = !isDefaultRigLivery(activeRigLivery);
    const unseenCount = getUnseenEntries(getCurrentLiveryUnlocks()).length;
    if (menuLiveryPillEl) {
      const newTag = unseenCount > 0 ? ` · 🎁${unseenCount}` : '';
      menuLiveryPillEl.textContent = `🎨 ${pal.suit.name}${pal.headgear.id !== 'zissou-cap' ? ` · ${pal.headgear.icon}` : ''}${newTag}`;
      menuLiveryPillEl.classList.toggle('active', custom || unseenCount > 0);
    }
    if (btnHomeOpenLiveryEl) {
      btnHomeOpenLiveryEl.classList.toggle('custom', custom);
      btnHomeOpenLiveryEl.classList.toggle('has-new-gear', unseenCount > 0);
      btnHomeOpenLiveryEl.title = `Diver Gear: ${pal.suit.name} · ${pal.headgear.name} · ${pal.tank.name}${unseenCount > 0 ? ` (${unseenCount} NEW unlocked!)` : ' (tap to customize)'}`;
    }
    renderHomeAvatarBadge();
    if (session?.diver && !session.isProvingGrounds) {
      session.diver.livery = { ...activeRigLivery };
      session.rigPerf = perf;
      session.diver.torchReachMult = perf.torchReachMult || 1.0;
      if (session.hazards) session.hazards.rigPerf = perf;
    }
    renderHudGearBuffs(session?.rigPerf || perf, session);
    syncSetupDrawerSummary();
  }

  function renderLiveryPreviewFrame(timeSec = 0) {
    if (!liveryPreviewCtx || !liveryPreviewCanvasEl) return;
    let hasCcr = false;
    let hasDpv = false;
    let ccrUnlocked = false;
    let dpvUnlocked = false;
    try {
      const eq = getEffectiveGearLoadout();
      hasCcr = Boolean(eq?.ccr);
      hasDpv = Boolean(eq?.dpv);
      const { unlockedIds } = computeUnlockedGear(loadCareerLogbook(), LEVELS);
      ccrUnlocked = unlockedIds.has('ccr');
      dpvUnlocked = unlockedIds.has('dpv');
    } catch {}
    const showCcr = ccrUnlocked ? hasCcr : (liveryPreviewCcr !== null ? liveryPreviewCcr : hasCcr);
    const showDpv = dpvUnlocked ? hasDpv : (liveryPreviewDpv !== null ? liveryPreviewDpv : hasDpv);

    const previewLivery = getDisplayedRigLivery();

    let equipFxArg = null;
    if (activeEquipFx) {
      const p = (performance.now() - activeEquipFx.startedAtMs) / EQUIP_ANIM_DURATION_MS;
      if (p < 1) {
        equipFxArg = { ...activeEquipFx, progress: Math.max(0, p) };
      } else {
        activeEquipFx = null;
      }
    }

    drawLiveryPreview(liveryPreviewCtx, liveryPreviewCanvasEl.width, liveryPreviewCanvasEl.height, previewLivery, {
      hasCcr: showCcr,
      hasDpv: showDpv,
      envMode: liveryPreviewEnv,
      timeSec,
      equipFx: equipFxArg,
      previewLockedLabel: lockedTryOn ? `${lockedTryOn.name} (${lockedTryOn.hint})` : '',
    });
  }

  function setLiveryActiveTab(tabId) {
    if (!liveryPanels[tabId]) return;
    activeLiveryTab = tabId;
    liveryCatTabsEl?.querySelectorAll?.('button[data-livery-tab]')?.forEach?.((btn) => {
      const on = btn.getAttribute('data-livery-tab') === tabId;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    for (const [k, el] of Object.entries(liveryPanels)) {
      if (el) el.hidden = k !== tabId;
    }
  }

  function updateActiveLiveryField(patchObj, { slot = 'all', itemMeta = null, silentAudio = false } = {}) {
    lockedTryOn = null;
    const unlocks = getCurrentLiveryUnlocks();
    activeRigLivery = sanitizeRigLivery({ ...activeRigLivery, ...patchObj }, unlocks);
    if (slot && itemMeta?.id) markEntrySeen(`${slot}:${itemMeta.id}`);
    triggerEquipAnimation(slot, itemMeta, { silentAudio });
    saveRigLivery();
    syncLiveryUi();
    renderLiveryWorkshopModal();
  }

  function tryOnLockedItem(slot, field, item) {
    if (!item) return;
    lockedTryOn = {
      slot,
      field,
      id: item.id,
      patch: { [field]: item.id },
      name: item.name,
      hint: item.unlockHint || 'Locked',
      tier: item.tier || 'uncommon',
    };
    triggerEquipAnimation(slot, item, { silentAudio: false });
    renderLiveryWorkshopModal();
  }

  function tryOnFullSet(setObj) {
    if (!setObj) return;
    const patch = buildSetPreviewPatch(setObj);
    const capReq = SET_TIER_BONUSES[setObj.id]?.capstoneReq || setObj.required || 3;
    lockedTryOn = {
      slot: 'all',
      field: 'suitId',
      id: patch.suitId || '',
      patch,
      isSet: true,
      setId: setObj.id,
      name: `${setObj.icon} ${setObj.name} (Full Set)`,
      hint: `${capReq}pc Capstone Preview`,
      tier: setObj.tier || 'epic',
    };
    triggerEquipAnimation('all', { name: setObj.name, tier: setObj.tier }, { silentAudio: false });
    renderLiveryWorkshopModal();
  }

  function _sortByLadder(list) {
    return list.slice().sort((a, b) => (a.ladderRank || 0) - (b.ladderRank || 0));
  }

  function _renderSwatchCard({
    slot,
    field,
    item,
    unlocked,
    selected,
    chipStyle,
    chipContent,
    stats,
    unlockedMeta,
  }) {
    const tierMeta = getGearTierMeta(item.tier);
    const key = `${slot}:${item.id}`;
    const isNew = unlocked && !seenUnlockKeys.has(key) && item.tier !== 'common';
    const isTrying = Boolean(lockedTryOn && lockedTryOn.slot === slot && lockedTryOn.id === item.id);
    const justPop = justEquippedKey === key;
    const prog = !unlocked ? getGearItemProgress(item, stats) : null;
    const pct = prog ? Math.round((prog.pct || 0) * 100) : 0;
    const itemStats = getGearItemStats(slot, item);
    const sourceBadge =
      itemStats.source === 'world'
        ? `<span class="livery-source-pill src-world" title="${escapeHtml(itemStats.worldCache?.clue || item.unlockHint || 'Found in world')}">🗺️ WORLD</span>`
        : itemStats.source === 'chest'
          ? `<span class="livery-source-pill src-chest${item.dropRarity === 'very-rare' ? ' very-rare' : ''}" title="${escapeHtml(item.unlockHint || 'Rare random drop from Sunken Treasure Chests')}">${item.dropRarity === 'very-rare' ? '🧰 VERY RARE' : '🧰 CHEST'}</span>`
          : itemStats.source === 'earned'
            ? `<span class="livery-source-pill src-earned">🏆 EARNED</span>`
            : '';
    const archMeta = itemStats.archetype;
    const archBadge = archMeta && itemStats.pills.length > 0
      ? `<span class="livery-arch-pill arch-${archMeta.id}" title="${escapeHtml(archMeta.desc)}">${archMeta.icon} ${archMeta.short}</span>`
      : '';
    const statPillsHtml = itemStats.pills.length > 0
      ? `<span class="livery-stat-pills">${itemStats.pills.slice(0, 3).map((p) => `<span class="livery-stat-pill">${escapeHtml(p)}</span>`).join('')}</span>`
      : '';
    const powerHtml = itemStats.power
      ? `<span class="livery-power-badge" title="${escapeHtml(itemStats.power.desc)}">⚡ ${escapeHtml(itemStats.power.name)}</span>`
      : '';

    const fxBadge = item.fx
      ? `<span class="livery-fx-badge" title="${escapeHtml(item.fx.desc)}">✦ ${escapeHtml(item.fx.name)}</span>`
      : '';
    const tierBadge =
      tierMeta.rank >= 2
        ? `<span class="livery-tier-pill tier-${tierMeta.id}">${tierMeta.icon} ${tierMeta.badge}</span>`
        : '';
    const newBadge = isNew ? `<span class="livery-new-badge">NEW</span>` : '';
    const progressHtml = !unlocked
      ? `<span class="livery-prog-wrap" aria-label="Progress ${pct}%">
          <span class="livery-prog-track"><span class="livery-prog-fill tier-${tierMeta.id}" style="width:${pct}%"></span></span>
          <span class="livery-prog-label">${escapeHtml(prog?.label || item.unlockHint || 'Locked')} · ${isTrying ? 'Previewing' : 'Tap to Try On'}</span>
        </span>`
      : '';

    return `<button type="button" class="livery-swatch-btn tier-${tierMeta.id}${selected ? ' active' : ''}${unlocked ? '' : ' locked'}${isTrying ? ' trying' : ''}${item.fx ? ' has-fx' : ''}${justPop ? ' equip-pop' : ''}" data-slot="${slot}" data-field="${field}" data-item-id="${item.id}" data-unlocked="${unlocked ? '1' : '0'}" role="radio" aria-checked="${selected}">
      <span class="livery-swatch-chip" style="${chipStyle}" aria-hidden="true">${chipContent}</span>
      <span class="livery-swatch-copy">
        <span class="livery-swatch-top">
          <span class="livery-swatch-name">${escapeHtml(item.name)}</span>
          ${newBadge}${archBadge}${sourceBadge}${tierBadge}
        </span>
        ${statPillsHtml}
        ${powerHtml}
        ${fxBadge}
        <span class="livery-swatch-meta">${escapeHtml(unlocked ? (selected ? '✓ Equipped' : unlockedMeta) : `🔒 ${item.unlockHint}`)}</span>
        ${progressHtml}
      </span>
    </button>`;
  }

  function _bindGridHandlers(gridEl, list, slot, field, unlockedSet) {
    if (!gridEl) return;
    gridEl.querySelectorAll('button[data-item-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-item-id');
        const item = list.find((x) => x.id === id);
        if (!item) return;
        if (unlockedSet.has(id)) {
          updateActiveLiveryField({ [field]: id }, { slot, itemMeta: item });
        } else {
          tryOnLockedItem(slot, field, item);
        }
      });
    });
  }

  // Celebratory Gear Unlock Showcase Card Modal
  const unlockShowcase = createGearUnlockShowcase({
    getActiveRigLivery: () => activeRigLivery,
    getEffectiveGearLoadout,
    equipEntryFromShowcase: (entry) => {
      if (!entry?.field || !entry?.item) return;
      updateActiveLiveryField({ [entry.field]: entry.item.id }, { slot: entry.slot, itemMeta: entry.item, silentAudio: true });
      renderDebriefUnlockTray();
    },
    openWorkshopAtTab: (tabId) => {
      openLiveryModal(tabId);
    },
    markEntrySeen,
    playGearUnlock,
    playGearEquip,
    spawnConfetti,
  });

  function renderDebriefUnlockTray() {
    if (!debriefGearUnlocksEl) return;
    if (!Array.isArray(recentDiveUnlocks) || recentDiveUnlocks.length === 0) {
      debriefGearUnlocksEl.hidden = true;
      debriefGearUnlocksEl.innerHTML = '';
      return;
    }
    debriefGearUnlocksEl.hidden = false;
    const pills = recentDiveUnlocks
      .map((entry, idx) => {
        const tm = getGearTierMeta(entry.item?.tier);
        const equipped = (activeRigLivery[entry.field] || '') === entry.item.id;
        return `<div class="debrief-unlock-chip tier-${tm.id}">
          <span class="debrief-unlock-copy">
            <span class="livery-tier-pill tier-${tm.id}">${tm.icon} ${tm.badge}</span>
            <strong>${escapeHtml(entry.item.name)}</strong>
            <span class="debrief-unlock-slot">${escapeHtml(entry.categoryLabel)}${entry.item.fx ? ` · ✦ ${escapeHtml(entry.item.fx.name)}` : ''}</span>
          </span>
          <span class="debrief-unlock-btns">
            <button type="button" class="btn tiny ${equipped ? 'secondary' : 'primary'}" data-debrief-equip="${idx}">${equipped ? '✓ Equipped' : '⚡ Equip'}</button>
            <button type="button" class="btn tiny ghost" data-debrief-card="${idx}" title="View Collector Unlock Card">✨</button>
          </span>
        </div>`;
      })
      .join('');
    debriefGearUnlocksEl.innerHTML = `
      <div class="debrief-unlock-head">
        <span>🎁 NEW GEAR UNLOCKED (${recentDiveUnlocks.length})</span>
        <button type="button" class="btn tiny ghost" id="btn-debrief-open-workshop">🎨 Gear Workshop</button>
      </div>
      <div class="debrief-unlock-list">${pills}</div>
    `;
    debriefGearUnlocksEl.querySelector('#btn-debrief-open-workshop')?.addEventListener('click', () => {
      openLiveryModal(recentDiveUnlocks[0]?.tabId || 'suit');
    });
    debriefGearUnlocksEl.querySelectorAll('button[data-debrief-equip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const entry = recentDiveUnlocks[Number(btn.getAttribute('data-debrief-equip'))];
        if (!entry) return;
        updateActiveLiveryField({ [entry.field]: entry.item.id }, { slot: entry.slot, itemMeta: entry.item });
        showToast(`⚡ Equipped ${entry.item.name}!`, 2.2);
        renderDebriefUnlockTray();
      });
    });
    debriefGearUnlocksEl.querySelectorAll('button[data-debrief-card]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-debrief-card'));
        const entry = recentDiveUnlocks[idx];
        if (entry) unlockShowcase.openShowcase([entry]);
      });
    });
  }

  function renderLiveryWorkshopModal() {
    const modalCard = liveryModalEl?.querySelector?.('.livery-modal-card') || null;
    const prevScrollTop = modalCard ? modalCard.scrollTop : 0;
    const unlocks = getCurrentLiveryUnlocks();
    activeRigLivery = sanitizeRigLivery(activeRigLivery, unlocks);
    const pal = resolveDiverLiveryPalette(activeRigLivery);

    // Zero-spoiler filter (keeps secret boss cosmetics completely hidden until earned)
    const visibleSuits = _sortByLadder(SUIT_LIVERIES.filter((s) => !s.secret || unlocks.suits.has(s.id)));
    const visibleTrims = _sortByLadder(ACCENT_TRIMS.filter((tr) => !tr.secret || unlocks.trims.has(tr.id)));
    const visibleHeadgears = _sortByLadder(HEADGEAR_STYLES.filter((h) => !h.secret || unlocks.headgears.has(h.id)));
    const visibleVisors = _sortByLadder(VISOR_TINTS.filter((v) => !v.secret || unlocks.visors.has(v.id)));
    const visibleTanks = _sortByLadder(TANK_FINISHES.filter((tk) => !tk.secret || unlocks.tanks.has(tk.id)));
    const visibleTorches = _sortByLadder(TORCH_OPTICS.filter((t) => !t.secret || unlocks.torches.has(t.id)));
    const visiblePatches = _sortByLadder(MILESTONE_PATCHES.filter((p) => !p.secret || unlocks.patches.has(p.id)));

    const totalItems =
      visibleSuits.length +
      visibleTrims.length +
      visibleHeadgears.length +
      visibleVisors.length +
      visibleTanks.length +
      visibleTorches.length +
      visiblePatches.length;
    const totalUnlocked =
      unlocks.suits.size +
      unlocks.trims.size +
      unlocks.headgears.size +
      unlocks.visors.size +
      unlocks.tanks.size +
      unlocks.torches.size +
      unlocks.patches.size;
    const overallPct = Math.min(100, Math.round((totalUnlocked / Math.max(1, totalItems)) * 100));
    const foundSet = unlocks.stats.foundGearIds || new Set();
    const worldFoundCount = WORLD_GEAR_CACHES.filter((c) => foundSet.has(`${c.slot}:${c.itemId}`)).length;
    const chestFoundCount = CHEST_GEAR_DROPS.filter((c) => foundSet.has(`${c.slot}:${c.itemId}`)).length;
    if (liveryUnlockSummaryEl) {
      liveryUnlockSummaryEl.textContent = `${totalUnlocked}/${totalItems} gear (${overallPct}%) · 🗺️ ${worldFoundCount}/${WORLD_GEAR_CACHES.length} caches · 🧰 ${chestFoundCount}/${CHEST_GEAR_DROPS.length} chest relics · ${unlocks.stats.sitesCleared} sites · ${Math.round(unlocks.stats.deepestM || 0)}m max depth.`;
    }

    // Live Rig Performance Stat Sheet & Diablo III Try-On Compare Deltas, Mode/Difficulty Tuned (v216–v219)
    const previewRigForPerf = getDisplayedRigLivery();
    const wsTuningCtx = getWorkshopTuningCtx(workshopTuningMode);
    const basePerf = computeRigPerformanceProfile(activeRigLivery, wsTuningCtx);
    const viewPerf = lockedTryOn ? computeRigPerformanceProfile(previewRigForPerf, wsTuningCtx) : basePerf;
    const perfDiffs = lockedTryOn ? diffRigPerformanceProfiles(basePerf, viewPerf) : [];
    if (liveryPerfPanelEl) {
      const swimPct = Math.round((viewPerf.swimSpeedMult - 1) * 100);
      const gasPct = Math.round((1 - viewPerf.gasBurnMult) * 100);
      const siltPct = Math.round((1 - viewPerf.siltStirMult) * 100);
      const decoPct = Math.round((viewPerf.decoOffgasMult - 1) * 100);
      const beamPct = Math.round((viewPerf.torchReachMult - 1) * 100);
      const coldPct = Math.round(viewPerf.coldResist * 100);
      const narcPct = Math.round(viewPerf.narcResist * 100);
      const armorPct = Math.round(viewPerf.bumpArmor * 100);
      const resPeak = Math.max(coldPct, narcPct, armorPct);
      const resLabel = coldPct >= 99 ? 'COLD-PROOF' : `C${coldPct}/N${narcPct}/A${armorPct}`;

      const bars = [
        { lbl: '⚡ Swim / DPV', val: `+${swimPct}%${viewPerf.dpvSpeedBonus > 0 ? ` · +${Math.round(viewPerf.dpvSpeedBonus * 100)}% DPV` : ''}`, pct: Math.min(100, Math.round((swimPct / 28) * 100)), cls: 'c-cyan' },
        { lbl: '🌊 Gas / Bar', val: `-${gasPct}%${viewPerf.bonusStartBar > 0 ? ` · +${viewPerf.bonusStartBar}b` : ''}`, pct: Math.min(100, Math.round(((gasPct + viewPerf.bonusStartBar * 0.4) / 36) * 100)), cls: 'c-emerald' },
        { lbl: '🌫️ Silt / Flow', val: `-${siltPct}%${viewPerf.hydroEfficiency > 0 ? ` · +${Math.round(viewPerf.hydroEfficiency * 100)}%` : ''}`, pct: Math.min(100, Math.round((siltPct / 55) * 100)), cls: 'c-teal' },
        { lbl: '⏱️ Deco / Depth', val: `+${decoPct}%${viewPerf.narcDepthBonusM > 0 ? ` · +${viewPerf.narcDepthBonusM}m` : ''}`, pct: Math.min(100, Math.round(((decoPct + viewPerf.narcDepthBonusM) / 50) * 100)), cls: 'c-amber' },
        { lbl: '🔱 Combat', val: `${100 + viewPerf.combatMaxHpBonus} HP · +${Math.round((viewPerf.spearPowerMult - 1) * 100)}%`, pct: Math.min(100, Math.round(((viewPerf.combatMaxHpBonus + (viewPerf.spearPowerMult - 1) * 100) / 95) * 100)), cls: 'c-rose' },
        { lbl: '🔦 Beam / Res', val: `+${beamPct}% · ${resLabel}`, pct: Math.min(100, Math.max(Math.round((beamPct / 48) * 100), resPeak)), cls: 'c-violet' },
      ];
      const domArch = viewPerf.dominantArchetype || GEAR_ARCHETYPES.hybrid;
      const archBannerTag = `<span class="livery-arch-pill arch-${domArch.id}">${domArch.icon} ${viewPerf.isHybridMix ? 'HYBRID MIX' : domArch.label.toUpperCase()}</span>`;
      const tuningStripHtml = `<div class="livery-tuning-bar" role="radiogroup" aria-label="Preview stats by Mode and Difficulty">
        <span class="livery-tuning-lbl">Tune:</span>
        ${WORKSHOP_TUNING_MODES.map(
          (m) => `<button type="button" class="livery-tuning-pill${workshopTuningMode === m.id ? ' active' : ''}" data-tuning-mode="${m.id}">${m.icon} ${m.label}</button>`
        ).join('')}
        <span class="livery-tuning-badge" title="${escapeHtml(viewPerf.tuning?.summary || '')}">${escapeHtml(viewPerf.tuning?.badge || '')}</span>
      </div>`;
      const modSynHtml = Array.isArray(viewPerf.modifierSynergies) && viewPerf.modifierSynergies.length > 0
        ? `<div class="livery-mod-synergies">${viewPerf.modifierSynergies
            .map((ms) => `<span class="livery-mod-syn-chip" title="${escapeHtml(ms.desc)}">${ms.icon} ${escapeHtml(ms.label)}</span>`)
            .join('')}</div>`
        : '';

      const deltaHtml = perfDiffs.length > 0
        ? `<div class="livery-perf-deltas">${perfDiffs
            .slice(0, 6)
            .map((d) => `<span class="livery-delta-chip ${d.positive ? 'pos' : 'neg'}">${d.positive ? '▲' : '▼'} ${escapeHtml(d.text)}</span>`)
            .join('')}</div>`
        : '';
      const powersHtml = viewPerf.tuning?.isNormalized
        ? `<div class="livery-perf-powers empty">🧭 Purist Mutator active — all gear stats &amp; set powers are normalized to cosmetic-only pure diving.</div>`
        : viewPerf.powers.length > 0
          ? `<div class="livery-perf-powers">${viewPerf.powers
              .map((p) => `<span class="livery-perf-power-chip src-${escapeHtml(p.source || 'item')}" title="${escapeHtml(p.desc)}">⚡ ${escapeHtml(p.name)}</span>`)
              .join('')}</div>`
          : `<div class="livery-perf-powers empty">Equip Rare/World gear or 2–3pc Sets to unlock Legendary Powers &amp; Immunities.</div>`;
      const setBonusHtml = viewPerf.activeSets.length > 0
        ? `<div class="livery-perf-sets">${viewPerf.activeSets
            .map((as) => `<span class="livery-perf-set-pill${as.capstoneActive ? ' capstone' : ''}" style="--set-color:${as.color}">
              ${as.icon} <strong>${escapeHtml(as.name)} (${as.matched}/${as.capstoneReq})</strong>:
              ${escapeHtml(as.tier2Label)}${as.capstoneActive ? ` · ✦ ${escapeHtml(as.tierFullLabel)}` : ` · Next (${as.capstoneReq}): ${escapeHtml(as.tierFullLabel)}`}
            </span>`)
            .join('')}</div>`
        : '';

      liveryPerfPanelEl.innerHTML = `
        <div class="livery-perf-head">
          <span class="livery-perf-title">⚡ RIG PERFORMANCE ${archBannerTag}${lockedTryOn ? ' · <span class="livery-perf-cmp">COMPARE PREVIEW</span>' : ''}</span>
          <span class="livery-perf-sub">${viewPerf.powers.length} Power${viewPerf.powers.length === 1 ? '' : 's'} · ${viewPerf.activeSets.length} Set Tier${viewPerf.activeSets.length === 1 ? '' : 's'}${viewPerf.scoreBonusMult > 1.005 ? ` · +${Math.round((viewPerf.scoreBonusMult - 1) * 100)}% Score` : ''}${viewPerf.relicGlowBonusM > 0 ? ` · +${viewPerf.relicGlowBonusM}m Relic` : ''}</span>
        </div>
        ${tuningStripHtml}
        <div class="livery-perf-grid">
          ${bars
            .map(
              (b) => `<div class="livery-perf-stat">
                <div class="livery-perf-stat-row"><span>${b.lbl}</span><strong>${escapeHtml(b.val)}</strong></div>
                <div class="livery-perf-bar"><span class="livery-perf-fill ${b.cls}" style="width:${Math.max(4, b.pct)}%"></span></div>
              </div>`
            )
            .join('')}
        </div>
        ${modSynHtml}
        ${deltaHtml}
        ${setBonusHtml}
        ${powersHtml}
      `;
      liveryPerfPanelEl.querySelectorAll('button[data-tuning-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const mid = btn.getAttribute('data-tuning-mode');
          if (!mid || mid === workshopTuningMode) return;
          workshopTuningMode = mid;
          renderLiveryWorkshopModal();
        });
      });
    }

    // Progression Ladder Rail: Next Closest Unlocks + Set Synergies + Set Loadout Inspector + Locked Try-On Revert
    if (liveryLadderRailEl) {
      const unseen = getUnseenEntries(unlocks);
      const nextList = getNextGearMilestones(unlocks, 2);
      const previewRig = getDisplayedRigLivery();
      const synergyState = evaluateGearSetSynergy(previewRig);
      const setMapKey = { suit: 'suits', trim: 'trims', headgear: 'headgears', visor: 'visors', tank: 'tanks', torch: 'torches', patch: 'patches' };
      const visibleSets = synergyState.sets.filter((st) => {
        if (!st.set.secret) return true;
        // Keep secret boss sets zero-spoiler until player unlocks at least 1 piece of the set
        return st.set.slots.some((r) => {
          const uSet = unlocks[setMapKey[r.slot]];
          return uSet instanceof Set && r.ids.some((id) => uSet.has(id));
        });
      });

      const tryOnBanner = lockedTryOn
        ? `<div class="livery-tryon-banner">
            <span>👁 Previewing <strong>${escapeHtml(lockedTryOn.name)}</strong> — ${escapeHtml(lockedTryOn.hint)}</span>
            <span class="livery-tryon-btns">
              <button type="button" class="btn tiny primary" id="btn-livery-tryon-field-test">🧪 Test in Water</button>
              <button type="button" class="btn tiny secondary" id="btn-livery-clear-tryon">↺ Equipped Rig</button>
            </span>
          </div>`
        : '';
      const unseenBanner = unseen.length > 0
        ? `<button type="button" class="livery-unseen-banner" id="btn-livery-view-unseen">
            <span>🎁 <strong>${unseen.length} New Gear Unlock${unseen.length > 1 ? 's' : ''}</strong> Ready to Inspect &amp; Equip!</span>
            <span class="livery-unseen-cta">Open Card →</span>
          </button>`
        : '';

      const inspectedSetSt = inspectedSetId ? visibleSets.find((x) => x.set.id === inspectedSetId) || null : null;
      let setInspectorHtml = '';
      if (inspectedSetSt) {
        const s = inspectedSetSt.set;
        const tierDef = SET_TIER_BONUSES[s.id];
        const slotIcons = { suit: '🤿', headgear: '⛑️', torch: '🔦', tank: '🛢', visor: '🕶️', trim: '⚡', patch: '🎖️' };
        let ownedCount = 0;
        const piecesHtml = s.slots
          .map((rule) => {
            const uSet = unlocks[setMapKey[rule.slot]];
            const ownedId = rule.ids.find((id) => uSet instanceof Set && uSet.has(id)) || '';
            const primaryId = ownedId || rule.ids[0];
            const entry = getGearItemBySlot(rule.slot, primaryId);
            const item = entry?.item;
            const isOwned = Boolean(ownedId);
            if (isOwned) ownedCount++;
            const isEquipped = isOwned && (activeRigLivery[rule.field] || '') === ownedId;
            const stats = item ? getGearItemStats(rule.slot, item) : null;
            return `<button type="button" class="livery-set-piece-btn${isOwned ? ' owned' : ' locked'}${isEquipped ? ' equipped' : ''}" data-sp-slot="${rule.slot}" data-sp-field="${rule.field}" data-sp-id="${primaryId}" data-sp-owned="${isOwned ? '1' : '0'}" title="${escapeHtml(item?.unlockHint || '')}">
              <span class="livery-sp-head">${slotIcons[rule.slot] || '•'} <strong>${escapeHtml(item?.name || primaryId)}</strong> <span class="livery-sp-tag">${isEquipped ? '✓ Equipped' : isOwned ? 'Owned · Tap Equip' : stats?.source === 'world' ? '🗺️ World Cache' : '🔒 Locked'}</span></span>
              <span class="livery-sp-sub">${escapeHtml(stats?.summaryText || '')}${!isOwned && item?.unlockHint ? ` · ${escapeHtml(item.unlockHint)}` : ''}</span>
            </button>`;
          })
          .join('');

        const reqFull = tierDef?.capstoneReq || s.required || 3;
        const t2Lit = inspectedSetSt.matched >= 2;
        const tFullLit = inspectedSetSt.matched >= reqFull;
        setInspectorHtml = `
          <div id="livery-set-inspector" class="livery-set-inspector" style="--set-color:${s.color}">
            <div class="livery-si-head">
              <div>
                <strong>${s.icon} ${escapeHtml(s.name)}</strong>
                <span class="livery-si-count">${ownedCount}/${s.slots.length} Owned · ${inspectedSetSt.matched}/${reqFull} Equipped</span>
              </div>
              <button type="button" class="btn tiny ghost" id="btn-si-close" aria-label="Close set inspector">✕</button>
            </div>
            ${tierDef ? `<div class="livery-si-bonuses">
              <div class="livery-si-bonus${t2Lit ? ' lit' : ''}"><span>(2)</span> <strong>${escapeHtml(tierDef.tier2.label)}</strong> — ${escapeHtml(tierDef.tier2.desc)}</div>
              <div class="livery-si-bonus${tFullLit ? ' lit capstone' : ''}"><span>(${reqFull})</span> <strong>${escapeHtml(tierDef.tierFull.label)}</strong> — ${escapeHtml(tierDef.tierFull.desc)}</div>
            </div>` : ''}
            <div class="livery-si-pieces">${piecesHtml}</div>
            <div class="livery-si-actions">
              <button type="button" class="btn tiny ${ownedCount > 0 ? 'primary' : 'secondary'}" id="btn-si-equip-set" ${ownedCount === 0 ? 'disabled' : ''}>⚡ ${ownedCount >= s.slots.length ? 'Equip Full Set' : ownedCount > 0 ? `Equip ${ownedCount}/${s.slots.length} Owned` : '0 Pieces Owned'}</button>
              <button type="button" class="btn tiny secondary" id="btn-si-try-full">👁 Try Full Set</button>
              <button type="button" class="btn tiny accent" id="btn-si-field-test">🧪 Field Test Set</button>
            </div>
          </div>`;
      }

      const setStrip = visibleSets.length > 0
        ? `<div class="livery-set-row" aria-label="Gear Set Synergies">
            <span class="livery-next-kicker">${synergyState.active ? '✦ SET ACTIVE · TAP ANY SET TO EQUIP OR TEST' : 'GEAR SETS · TAP TO EQUIP / TRY FULL SET'}</span>
            <div class="livery-set-chips">
              ${visibleSets
                .map((st) => {
                  const s = st.set;
                  const unlockedSlots = s.slots.filter((r) => {
                    const uSet = unlocks[setMapKey[r.slot]];
                    return uSet instanceof Set && r.ids.some((id) => uSet.has(id));
                  }).length;
                  const tierDef = SET_TIER_BONUSES[s.id];
                  const capReq = tierDef?.capstoneReq || s.required || 3;
                  const isCap = st.matched >= capReq;
                  const tierInfo = tierDef ? ` | (2): ${tierDef.tier2.label} | (${capReq}): ${tierDef.tierFull.label}` : '';
                  const title = `${s.name} (${st.matched}/${capReq} equipped · ${unlockedSlots}/${s.slots.length} owned) — ${s.auraName}${tierInfo}`;
                  const badgeTxt = isCap
                    ? `✦ (${capReq}pc) ${tierDef?.tierFull?.label || s.auraName}`
                    : st.matched >= 2 && tierDef
                      ? `● (2pc) ${tierDef.tier2.label}`
                      : `${st.matched}/${capReq}${s.source === 'world' ? ' · 🗺️' : ''}`;
                  const isInspected = inspectedSetId === s.id;
                  return `<button type="button" class="livery-set-chip tier-${s.tier}${isCap ? ' active' : st.matched >= 2 ? ' tier2' : ''}${isInspected ? ' inspected' : ''}" data-set-id="${s.id}" style="--set-color:${s.color}" title="${escapeHtml(title)}">
                    <span>${s.icon} ${escapeHtml(s.name)}</span>
                    <span class="livery-set-count">${escapeHtml(badgeTxt)}</span>
                  </button>`;
                })
                .join('')}
            </div>
            ${setInspectorHtml}
          </div>`
        : '';
      const nextChips = nextList.length > 0
        ? `<div class="livery-next-row">
            <span class="livery-next-kicker">NEXT LADDER GOALS</span>
            ${nextList
              .map((m) => {
                const pct = Math.round((m.progress?.pct || 0) * 100);
                return `<button type="button" class="livery-next-chip tier-${m.tier.id}" data-next-slot="${m.slot}" data-next-field="${m.field}" data-next-id="${m.item.id}" data-next-tab="${m.tabId}" title="Tap to preview ${escapeHtml(m.item.name)} on your diver">
                  <span class="livery-next-top"><strong>${escapeHtml(m.item.name)}</strong> <span class="livery-next-pct">${escapeHtml(m.progress?.label || `${pct}%`)}</span></span>
                  <span class="livery-prog-track"><span class="livery-prog-fill tier-${m.tier.id}" style="width:${pct}%"></span></span>
                </button>`;
              })
              .join('')}
          </div>`
        : `<div class="livery-next-row complete">✦ Every standard ladder item unlocked — hunt hidden Guardian Relics for Mythic gear!</div>`;
      liveryLadderRailEl.innerHTML = `${tryOnBanner}${unseenBanner}${setStrip}${nextChips}`;
      liveryLadderRailEl.querySelector('#btn-livery-clear-tryon')?.addEventListener('click', () => {
        lockedTryOn = null;
        renderLiveryWorkshopModal();
      });
      liveryLadderRailEl.querySelector('#btn-livery-tryon-field-test')?.addEventListener('click', () => {
        startFieldTestDive();
      });
      liveryLadderRailEl.querySelector('#btn-livery-view-unseen')?.addEventListener('click', () => {
        unlockShowcase.openShowcase(unseen);
      });
      liveryLadderRailEl.querySelectorAll('button[data-set-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sid = btn.getAttribute('data-set-id');
          inspectedSetId = inspectedSetId === sid ? '' : sid;
          renderLiveryWorkshopModal();
        });
      });
      if (inspectedSetSt) {
        liveryLadderRailEl.querySelector('#btn-si-close')?.addEventListener('click', () => {
          inspectedSetId = '';
          renderLiveryWorkshopModal();
        });
        liveryLadderRailEl.querySelector('#btn-si-equip-set')?.addEventListener('click', () => {
          const patch = {};
          let equippedCnt = 0;
          for (const rule of inspectedSetSt.set.slots) {
            const uSet = unlocks[setMapKey[rule.slot]];
            const ownedId = rule.ids.find((id) => uSet instanceof Set && uSet.has(id));
            if (ownedId) {
              patch[rule.field] = ownedId;
              equippedCnt++;
            }
          }
          if (equippedCnt > 0) {
            updateActiveLiveryField(patch, { slot: 'all', itemMeta: { name: inspectedSetSt.set.name, tier: inspectedSetSt.set.tier } });
            showToast(
              equippedCnt >= inspectedSetSt.set.required
                ? `${inspectedSetSt.set.icon} Full Set Equipped: ${inspectedSetSt.set.name} — Capstone Active!`
                : `${inspectedSetSt.set.icon} Equipped ${equippedCnt}/${inspectedSetSt.set.slots.length} owned pieces of ${inspectedSetSt.set.name}!`,
              2.8
            );
          }
        });
        liveryLadderRailEl.querySelector('#btn-si-try-full')?.addEventListener('click', () => {
          tryOnFullSet(inspectedSetSt.set);
          showToast(`👁 Previewing full ${inspectedSetSt.set.name} Capstone on your diver — check live telemetry deltas!`, 2.8);
        });
        liveryLadderRailEl.querySelector('#btn-si-field-test')?.addEventListener('click', () => {
          const fullPatch = buildSetPreviewPatch(inspectedSetSt.set);
          startFieldTestDive({
            trialLivery: { ...activeRigLivery, ...fullPatch },
            trialLabel: `${inspectedSetSt.set.icon} ${inspectedSetSt.set.name}`,
          });
        });
        liveryLadderRailEl.querySelectorAll('button[data-sp-id]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const slot = btn.getAttribute('data-sp-slot');
            const field = btn.getAttribute('data-sp-field');
            const id = btn.getAttribute('data-sp-id');
            const owned = btn.getAttribute('data-sp-owned') === '1';
            const entry = getGearItemBySlot(slot, id);
            if (!entry?.item) return;
            if (owned) updateActiveLiveryField({ [field]: id }, { slot, itemMeta: entry.item });
            else tryOnLockedItem(slot, field, entry.item);
          });
        });
      }
      liveryLadderRailEl.querySelectorAll('button[data-next-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const slot = btn.getAttribute('data-next-slot');
          const field = btn.getAttribute('data-next-field');
          const id = btn.getAttribute('data-next-id');
          const tab = btn.getAttribute('data-next-tab');
          const entry = getGearItemBySlot(slot, id);
          if (tab) setLiveryActiveTab(tab);
          if (entry) tryOnLockedItem(slot, field, entry.item);
        });
      });
    }

    liveryEnvTabsEl?.querySelectorAll?.('button[data-livery-env]')?.forEach?.((btn) => {
      const on = btn.getAttribute('data-livery-env') === liveryPreviewEnv;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    let eqCcr = false;
    let eqDpv = false;
    let ccrUnlocked = false;
    let dpvUnlocked = false;
    try {
      const eq = getEffectiveGearLoadout();
      eqCcr = Boolean(eq?.ccr);
      eqDpv = Boolean(eq?.dpv);
      const { unlockedIds } = computeUnlockedGear(loadCareerLogbook(), LEVELS);
      ccrUnlocked = unlockedIds.has('ccr');
      dpvUnlocked = unlockedIds.has('dpv');
    } catch {}
    const showCcr = ccrUnlocked ? eqCcr : (liveryPreviewCcr !== null ? liveryPreviewCcr : eqCcr);
    const showDpv = dpvUnlocked ? eqDpv : (liveryPreviewDpv !== null ? liveryPreviewDpv : eqDpv);
    if (btnLiveryPrevCcrEl) {
      btnLiveryPrevCcrEl.classList.toggle('active', showCcr);
      btnLiveryPrevCcrEl.setAttribute('aria-pressed', showCcr ? 'true' : 'false');
      btnLiveryPrevCcrEl.textContent = ccrUnlocked ? (showCcr ? '✓ CCR' : 'CCR') : '👁 CCR';
      btnLiveryPrevCcrEl.title = ccrUnlocked
        ? (showCcr ? 'CCR Rebreather equipped for dives (click to unequip)' : 'Equip CCR Rebreather for dives')
        : 'Preview CCR Rebreather in Test Tank (locked — earn cert to equip in dives)';
    }
    if (btnLiveryPrevDpvEl) {
      btnLiveryPrevDpvEl.classList.toggle('active', showDpv);
      btnLiveryPrevDpvEl.setAttribute('aria-pressed', showDpv ? 'true' : 'false');
      btnLiveryPrevDpvEl.textContent = dpvUnlocked ? (showDpv ? '✓ DPV' : 'DPV') : '👁 DPV';
      btnLiveryPrevDpvEl.title = dpvUnlocked
        ? (showDpv ? 'DPV Scooter equipped for dives (click to unequip)' : 'Equip DPV Scooter for dives')
        : 'Preview DPV Scooter in Test Tank (locked — earn cert to equip in dives)';
    }

    if (liveryPresetRowEl) {
      liveryPresetRowEl.innerHTML = OUTFITTER_PRESETS.map((pr) => {
        const clamped = sanitizeRigLivery(pr.livery, unlocks);
        const isMatch =
          !lockedTryOn &&
          clamped.suitId === activeRigLivery.suitId &&
          clamped.torchId === activeRigLivery.torchId &&
          (clamped.headgearId || 'zissou-cap') === pal.headgear.id &&
          (clamped.trimId || 'suit-default') === pal.trimSpec.id &&
          (clamped.tankId || 'al80-silver') === pal.tank.id &&
          (clamped.visorId || 'clear-cyan') === pal.visor.id;
        const suit = getSuitLivery(pr.livery.suitId);
        const lockedParts =
          (!unlocks.suits.has(pr.livery.suitId) ? 1 : 0) +
          (!unlocks.headgears.has(pr.livery.headgearId) ? 1 : 0) +
          (!unlocks.tanks.has(pr.livery.tankId) ? 1 : 0);
        return `<button type="button" class="livery-preset-chip${isMatch ? ' active' : ''}" data-preset-id="${pr.id}" title="${escapeHtml(pr.name)}${lockedParts > 0 ? ' (applies unlocked items from this kit)' : ''}">
        <span class="livery-preset-dot" style="background: linear-gradient(135deg, ${suit.suitTop}, ${suit.accent});" aria-hidden="true"></span>
        <span>${pr.icon} ${escapeHtml(pr.name)}</span>
      </button>`;
      }).join('');
      liveryPresetRowEl.querySelectorAll('button[data-preset-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pid = btn.getAttribute('data-preset-id');
          const pr = OUTFITTER_PRESETS.find((x) => x.id === pid);
          if (!pr) return;
          const curUnlocks = getCurrentLiveryUnlocks();
          const lockedCount =
            (!curUnlocks.suits.has(pr.livery.suitId) ? 1 : 0) +
            (!curUnlocks.torches.has(pr.livery.torchId) ? 1 : 0) +
            (!curUnlocks.patches.has(pr.livery.patchId) ? 1 : 0) +
            (!curUnlocks.headgears.has(pr.livery.headgearId) ? 1 : 0) +
            (!curUnlocks.trims.has(pr.livery.trimId) ? 1 : 0) +
            (!curUnlocks.tanks.has(pr.livery.tankId) ? 1 : 0) +
            (!curUnlocks.visors.has(pr.livery.visorId) ? 1 : 0);
          updateActiveLiveryField(pr.livery, { slot: 'all', itemMeta: { name: pr.name, tier: 'rare' } });
          if (lockedCount > 0) {
            showToast(`🎨 Applied ${pr.name} (${lockedCount} locked piece${lockedCount > 1 ? 's' : ''} kept Standard Issue).`, 2.4);
          }
        });
      });
    }

    if (liverySavedSlotsEl) {
      liverySavedSlotsEl.innerHTML = SAVED_KIT_LABELS.map((label, idx) => {
        const saved = savedLiverySlots[idx] ? sanitizeRigLivery(savedLiverySlots[idx], unlocks) : null;
        const dotStyle = saved
          ? (() => {
              const p = resolveDiverLiveryPalette(saved);
              return `background: linear-gradient(135deg, ${p.suitTop}, ${p.accent});`;
            })()
          : 'background: rgba(148, 163, 184, 0.25);';
        return `<div class="livery-slot-pill${saved ? ' filled' : ''}">
        <button type="button" class="livery-slot-load" data-slot-load="${idx}" ${saved ? '' : 'disabled'} title="${saved ? `Load ${label}` : `Save a rig to ${label} first`}">
          <span class="livery-preset-dot" style="${dotStyle}" aria-hidden="true"></span>
          <span>${escapeHtml(label)}</span>
        </button>
        <button type="button" class="livery-slot-save" data-slot-save="${idx}" title="Save current rig to ${label}" aria-label="Save current rig to ${label}">💾</button>
      </div>`;
      }).join('');
      liverySavedSlotsEl.querySelectorAll('button[data-slot-load]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-slot-load'));
          const slot = savedLiverySlots[idx];
          if (!slot) return;
          updateActiveLiveryField(slot, { slot: 'all', itemMeta: { name: SAVED_KIT_LABELS[idx], tier: 'rare' } });
          showToast(`🎨 Loaded ${SAVED_KIT_LABELS[idx]}!`, 1.8);
        });
      });
      liverySavedSlotsEl.querySelectorAll('button[data-slot-save]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-slot-save'));
          savedLiverySlots[idx] = { ...activeRigLivery };
          saveLiverySlotsToStorage();
          renderLiveryWorkshopModal();
          showToast(`💾 Saved current rig to ${SAVED_KIT_LABELS[idx]}!`, 1.8);
        });
      });
    }
    if (btnLiveryTeamUniformEl) {
      btnLiveryTeamUniformEl.classList.toggle('active', aiSquadTeamUniform);
      btnLiveryTeamUniformEl.setAttribute('aria-pressed', aiSquadTeamUniform ? 'true' : 'false');
      btnLiveryTeamUniformEl.textContent = aiSquadTeamUniform ? '🤝 Squad Uniform: Team Match' : '🤝 Squad Uniform: Solo';
    }

    if (liverySuitGridEl) {
      liverySuitGridEl.innerHTML = visibleSuits
        .map((s) =>
          _renderSwatchCard({
            slot: 'suit',
            field: 'suitId',
            item: s,
            unlocked: unlocks.suits.has(s.id),
            selected: activeRigLivery.suitId === s.id,
            chipStyle: `background: linear-gradient(135deg, ${s.suitTop} 0%, ${s.suitMid} 52%, ${s.accent} 53%, ${s.trim} 100%);`,
            chipContent: unlocks.suits.has(s.id) ? (s.fx ? '✦' : '') : '🔒',
            stats: unlocks.stats,
            unlockedMeta: s.unlockHint,
          })
        )
        .join('');
      _bindGridHandlers(liverySuitGridEl, visibleSuits, 'suit', 'suitId', unlocks.suits);
    }

    if (liveryTrimGridEl) {
      liveryTrimGridEl.innerHTML = visibleTrims
        .map((tr) =>
          _renderSwatchCard({
            slot: 'trim',
            field: 'trimId',
            item: tr,
            unlocked: unlocks.trims.has(tr.id),
            selected: pal.trimSpec.id === tr.id,
            chipStyle:
              tr.id === 'suit-default'
                ? `background: linear-gradient(135deg, ${pal.suit.accent} 0%, ${pal.suit.trim} 100%);`
                : `background: linear-gradient(135deg, ${tr.swatchA} 0%, ${tr.swatchB} 100%);`,
            chipContent: unlocks.trims.has(tr.id) ? (tr.fx ? '✦' : '') : '🔒',
            stats: unlocks.stats,
            unlockedMeta: tr.unlockHint,
          })
        )
        .join('');
      _bindGridHandlers(liveryTrimGridEl, visibleTrims, 'trim', 'trimId', unlocks.trims);
    }

    if (liveryHeadgearGridEl) {
      liveryHeadgearGridEl.innerHTML = visibleHeadgears
        .map((h) =>
          _renderSwatchCard({
            slot: 'headgear',
            field: 'headgearId',
            item: h,
            unlocked: unlocks.headgears.has(h.id),
            selected: pal.headgear.id === h.id,
            chipStyle: 'background: rgba(15, 23, 42, 0.92);',
            chipContent: unlocks.headgears.has(h.id) ? h.icon : '🔒',
            stats: unlocks.stats,
            unlockedMeta: h.specText || h.unlockHint,
          })
        )
        .join('');
      _bindGridHandlers(liveryHeadgearGridEl, visibleHeadgears, 'headgear', 'headgearId', unlocks.headgears);
    }

    if (liveryVisorGridEl) {
      liveryVisorGridEl.innerHTML = visibleVisors
        .map((v) =>
          _renderSwatchCard({
            slot: 'visor',
            field: 'visorId',
            item: v,
            unlocked: unlocks.visors.has(v.id),
            selected: pal.visor.id === v.id,
            chipStyle: `background: linear-gradient(135deg, ${v.top} 0%, ${v.mid} 50%, ${v.bot} 100%);`,
            chipContent: unlocks.visors.has(v.id) ? (v.fx ? '✦' : '') : '🔒',
            stats: unlocks.stats,
            unlockedMeta: v.unlockHint,
          })
        )
        .join('');
      _bindGridHandlers(liveryVisorGridEl, visibleVisors, 'visor', 'visorId', unlocks.visors);
    }

    if (liveryTankGridEl) {
      liveryTankGridEl.innerHTML = visibleTanks
        .map((tk) =>
          _renderSwatchCard({
            slot: 'tank',
            field: 'tankId',
            item: tk,
            unlocked: unlocks.tanks.has(tk.id),
            selected: pal.tank.id === tk.id,
            chipStyle: `background: linear-gradient(180deg, ${tk.top} 0%, ${tk.mid} 50%, ${tk.bot} 100%);`,
            chipContent: unlocks.tanks.has(tk.id) ? (tk.fx ? '✦' : '') : '🔒',
            stats: unlocks.stats,
            unlockedMeta: tk.unlockHint,
          })
        )
        .join('');
      _bindGridHandlers(liveryTankGridEl, visibleTanks, 'tank', 'tankId', unlocks.tanks);
    }

    if (liveryTorchGridEl) {
      liveryTorchGridEl.innerHTML = visibleTorches
        .map((t) =>
          _renderSwatchCard({
            slot: 'torch',
            field: 'torchId',
            item: t,
            unlocked: unlocks.torches.has(t.id),
            selected: activeRigLivery.torchId === t.id,
            chipStyle: `background: radial-gradient(circle at 35% 35%, #ffffff 0%, ${t.swatch} 55%, #0f172a 100%);`,
            chipContent: unlocks.torches.has(t.id) ? (t.fx ? '✦' : '') : '🔒',
            stats: unlocks.stats,
            unlockedMeta: t.specText || t.unlockHint,
          })
        )
        .join('');
      _bindGridHandlers(liveryTorchGridEl, visibleTorches, 'torch', 'torchId', unlocks.torches);
    }

    if (liveryPatchGridEl) {
      liveryPatchGridEl.innerHTML = visiblePatches
        .map((p) =>
          _renderSwatchCard({
            slot: 'patch',
            field: 'patchId',
            item: p,
            unlocked: unlocks.patches.has(p.id),
            selected: activeRigLivery.patchId === p.id,
            chipStyle: 'background: rgba(15, 23, 42, 0.9);',
            chipContent: unlocks.patches.has(p.id) ? escapeHtml(p.icon) : '🔒',
            stats: unlocks.stats,
            unlockedMeta: p.unlockHint,
          })
        )
        .join('');
      _bindGridHandlers(liveryPatchGridEl, visiblePatches, 'patch', 'patchId', unlocks.patches);
    }

    // Clear one-shot CSS equip-pop flag after render so only the freshly equipped card pops
    justEquippedKey = '';

    setLiveryActiveTab(activeLiveryTab);
    if (btnLiveryResetEl) {
      btnLiveryResetEl.disabled = isDefaultRigLivery(activeRigLivery) && !lockedTryOn;
    }
    renderLiveryPreviewFrame(performance.now() * 0.001);
    if (modalCard) modalCard.scrollTop = prevScrollTop;
  }

  function openLiveryModal(initialTab = null) {
    if (!liveryModalEl) return;
    closeDiveSetupModal();
    setHomeMenuOpen(false);
    lockedTryOn = null;
    if (typeof getDifficulty === 'function') {
      const curD = getDifficulty();
      if (curD === 'guided' || curD === 'standard' || curD === 'hardcore') {
        workshopTuningMode = curD;
      }
    }
    if (initialTab && liveryPanels[initialTab]) {
      activeLiveryTab = initialTab;
    }
    renderLiveryWorkshopModal();
    liveryModalEl.hidden = false;
  }

  function closeLiveryModal() {
    if (!liveryModalEl) return;
    lockedTryOn = null;
    liveryModalEl.hidden = true;
  }

  function captureUnlockSnapshot() {
    return getCurrentLiveryUnlocks();
  }

  function celebrateNewUnlocks(beforeSnapshot = null, { openCard = true } = {}) {
    const afterUnlocks = getCurrentLiveryUnlocks();
    const diff = beforeSnapshot ? diffUnlockedLiveries(beforeSnapshot, afterUnlocks) : getUnseenEntries(afterUnlocks);
    recentDiveUnlocks = diff;
    renderDebriefUnlockTray();
    syncLiveryUi();
    if (diff.length > 0 && openCard) {
      unlockShowcase.openShowcase(diff);
    }
    return diff;
  }

  liveryCatTabsEl?.querySelectorAll?.('button[data-livery-tab]')?.forEach?.((btn) => {
    btn.addEventListener('click', () => {
      const tid = btn.getAttribute('data-livery-tab');
      if (tid) setLiveryActiveTab(tid);
    });
  });
  liveryEnvTabsEl?.querySelectorAll?.('button[data-livery-env]')?.forEach?.((btn) => {
    btn.addEventListener('click', () => {
      const env = btn.getAttribute('data-livery-env');
      if (!env) return;
      liveryPreviewEnv = env;
      renderLiveryWorkshopModal();
    });
  });
  btnLiveryPrevCcrEl?.addEventListener('click', () => {
    let ccrUnlocked = false;
    try { ccrUnlocked = computeUnlockedGear(loadCareerLogbook(), LEVELS).unlockedIds.has('ccr'); } catch {}
    if (ccrUnlocked) {
      const savedGearLoadout = getSavedGearLoadout();
      savedGearLoadout.ccr = !savedGearLoadout.ccr;
      liveryPreviewCcr = null;
      triggerEquipAnimation('ccr', { name: savedGearLoadout.ccr ? 'CCR Rebreather' : 'Twin Backgas', tier: 'epic' });
      saveGearLoadout();
      renderTechGearDock();
      syncLiveryUi();
      renderLiveryWorkshopModal();
      showToast(
        savedGearLoadout.ccr
          ? '♻️ CCR Rebreather equipped for your next dive!'
          : '♻️ CCR Rebreather unequipped (switched to twin backgas).',
        2.0
      );
      return;
    }
    const cur = liveryPreviewCcr !== null ? liveryPreviewCcr : false;
    liveryPreviewCcr = !cur;
    if (liveryPreviewCcr) triggerEquipAnimation('ccr', { name: 'CCR Preview', tier: 'epic' });
    renderLiveryWorkshopModal();
    if (liveryPreviewCcr) {
      showToast('👁 Previewing CCR in Test Tank — unlock via Cert Ladder to equip in dives.', 2.4);
    }
  });
  btnLiveryPrevDpvEl?.addEventListener('click', () => {
    let dpvUnlocked = false;
    try { dpvUnlocked = computeUnlockedGear(loadCareerLogbook(), LEVELS).unlockedIds.has('dpv'); } catch {}
    if (dpvUnlocked) {
      const savedGearLoadout = getSavedGearLoadout();
      savedGearLoadout.dpv = !savedGearLoadout.dpv;
      liveryPreviewDpv = null;
      triggerEquipAnimation('dpv', { name: savedGearLoadout.dpv ? 'DPV Scooter' : 'Free Swim', tier: 'rare' });
      saveGearLoadout();
      renderTechGearDock();
      syncLiveryUi();
      renderLiveryWorkshopModal();
      showToast(
        savedGearLoadout.dpv
          ? '🚀 DPV Scooter equipped for your next dive!'
          : '🚀 DPV Scooter unequipped.',
        2.0
      );
      return;
    }
    const cur = liveryPreviewDpv !== null ? liveryPreviewDpv : false;
    liveryPreviewDpv = !cur;
    if (liveryPreviewDpv) triggerEquipAnimation('dpv', { name: 'DPV Preview', tier: 'rare' });
    renderLiveryWorkshopModal();
    if (liveryPreviewDpv) {
      showToast('👁 Previewing DPV in Test Tank — unlock via Cert Ladder to equip in dives.', 2.4);
    }
  });
  btnLiveryBestEl?.addEventListener('click', () => {
    lockedTryOn = null;
    const unlocks = getCurrentLiveryUnlocks();
    const best = buildBestOwnedRig(unlocks);
    activeRigLivery = sanitizeRigLivery(best.livery, unlocks);
    triggerEquipAnimation('all', { name: best.activeSetName || 'Best Owned Rig', tier: best.isCapstone ? 'mythic' : 'epic' });
    saveRigLivery();
    syncLiveryUi();
    renderLiveryWorkshopModal();
    showToast(
      best.activeSetName
        ? `⚡ Equipped Best Rig (${best.activeSetName} ${best.activeSetCount}pc${best.isCapstone ? ' Capstone' : ''})!`
        : '⚡ Equipped your strongest unlocked gear across all 7 slots!',
      2.6
    );
  });
  btnLiveryFieldTestEl?.addEventListener('click', () => {
    startFieldTestDive();
  });
  btnLiveryRandomEl?.addEventListener('click', () => {
    lockedTryOn = null;
    const unlocks = getCurrentLiveryUnlocks();
    activeRigLivery = randomizeUnlockedLivery(unlocks);
    triggerEquipAnimation('all', { name: 'Custom Mix', tier: 'rare' });
    saveRigLivery();
    syncLiveryUi();
    renderLiveryWorkshopModal();
  });
  btnLiveryTeamUniformEl?.addEventListener('click', () => {
    aiSquadTeamUniform = !aiSquadTeamUniform;
    try { localStorage.setItem(SQUAD_UNIFORM_KEY, aiSquadTeamUniform ? '1' : '0'); } catch {}
    scheduleGitHubStatsSync();
    renderLiveryWorkshopModal();
    showToast(
      aiSquadTeamUniform
        ? '🤝 AI Squad will match your drysuit, headgear & tanks with unique wingman stripes!'
        : '🤝 AI Squad restored to individual expedition liveries.',
      2.4
    );
  });
  menuLiveryPillEl?.addEventListener('click', () => openLiveryModal());
  btnLiveryCloseEl?.addEventListener('click', closeLiveryModal);
  btnLiveryDoneEl?.addEventListener('click', closeLiveryModal);
  liveryModalEl?.addEventListener('click', (e) => {
    if (e.target === liveryModalEl) closeLiveryModal();
  });
  btnLiveryResetEl?.addEventListener('click', () => {
    lockedTryOn = null;
    activeRigLivery = { ...DEFAULT_RIG_LIVERY };
    triggerEquipAnimation('all', { name: 'Standard Issue', tier: 'common' });
    saveRigLivery();
    syncLiveryUi();
    renderLiveryWorkshopModal();
    showToast('🎨 Gear Workshop reset to Standard Issue (Zissou Tech · 6500K LED).', 2.2);
  });

  return {
    liveryModalEl,
    gearUnlockModalEl: unlockShowcase.modalEl,
    getActiveRigLivery: () => activeRigLivery,
    setActiveRigLivery(next, { skipCloudSync = false } = {}) {
      activeRigLivery = next;
      saveRigLivery({ skipCloudSync });
    },
    getSavedLiverySlots: () => savedLiverySlots,
    setSavedLiverySlots(next, { skipCloudSync = false } = {}) {
      savedLiverySlots = next;
      saveLiverySlotsToStorage({ skipCloudSync });
    },
    getAiSquadTeamUniform: () => aiSquadTeamUniform,
    setAiSquadTeamUniform(val) {
      aiSquadTeamUniform = Boolean(val);
      try { localStorage.setItem(SQUAD_UNIFORM_KEY, aiSquadTeamUniform ? '1' : '0'); } catch {}
    },
    getCurrentLiveryUnlocks,
    captureUnlockSnapshot,
    celebrateNewUnlocks,
    openGearUnlockShowcase: (entries) => unlockShowcase.openShowcase(entries),
    closeGearUnlockShowcase: () => unlockShowcase.closeShowcase(),
    clearRecentDiveUnlocks: () => {
      recentDiveUnlocks = [];
      renderDebriefUnlockTray();
    },
    saveLiverySlotsToStorage,
    saveRigLivery,
    reconcileActiveRigLiveryFromStorage,
    renderHomeAvatarBadge,
    syncLiveryUi,
    renderLiveryPreviewFrame,
    renderLiveryWorkshopModal,
    openLiveryModal,
    closeLiveryModal,
    startFieldTestDive,
    tryOnFullSet,
    handleWorldGearFound,
    handleTreasureChestOpened,
    hideLootDiscoveryBanner,
    onExitProvingGrounds: () => {
      provingHudBar.hide();
      hideLootDiscoveryBanner();
      if (hudGearBuffsEl) hudGearBuffsEl.hidden = true;
      const prev = savedPrevLevelBeforeProving;
      savedPrevLevelBeforeProving = null;
      return prev;
    },
  };
}
