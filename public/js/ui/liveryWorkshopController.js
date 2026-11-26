import { escapeHtml } from '../util/common.js';
import { LEVELS } from '../levels/index.js';
import {
  computeUnlockedGear,
  recordFoundWorldGear,
  awardDoubloonsInLogbook,
  purchaseGearChromaInLogbook,
  sellGearInLogbook,
  buybackGearInLogbook,
  addTreasureMapLeadInLogbook,
  completeTreasureMapLeadInLogbook,
} from '../game/logbookModel.js';
import { rollExpeditionTreasureMapLead } from '../game/treasureMaps.js';
import {
  GEAR_CHROMA_FINISHES,
  CHROMA_TIERS,
  getGearChroma,
  isChromaExclusiveEligible,
} from '../game/gearChroma.js';
import {
  SUIT_LIVERIES,
  TORCH_OPTICS,
  MILESTONE_PATCHES,
  HEADGEAR_STYLES,
  ACCENT_TRIMS,
  TANK_FINISHES,
  VISOR_TINTS,
  SCOOTER_MODELS,
  HARPOON_MODELS,
  OUTFITTER_PRESETS,
  WELCOME_RELIC_CHOICES,
  DEFAULT_RIG_LIVERY,
  getSuitLivery,
  getGearTierMeta,
  getGearSellValue,
  getGearBuybackCost,
  isGearSellable,
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
import { renderGearArtworkSvg } from './gearArtwork.js';
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
const EQUIP_ANIM_DURATION_MS = 2400;
const SLOT_DISPLAY_NAMES = {
  suit: 'Drysuit',
  trim: 'Trim & Fins',
  headgear: 'Headgear',
  visor: 'Visor Lens',
  tank: 'Twin Tanks',
  torch: 'Primary Torch',
  scooter: 'DPV Scooter',
  harpoon: 'Harpoon',
  patch: 'Shoulder Patch',
  chroma: 'Color Coat',
};

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
  launchSiteDive = null,
  refreshWorldMap = null,
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
    for (const id of unlocks.scooters || []) keys.push(`scooter:${id}`);
    for (const id of unlocks.harpoons || []) keys.push(`harpoon:${id}`);
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
  const btnHomeQuickLiveryEl = document.getElementById('btn-home-quick-livery');
  const homeAvatarCanvasEl = document.getElementById('home-avatar-canvas');
  const homeAvatarCtx = homeAvatarCanvasEl?.getContext?.('2d') || null;
  const liveryModalEl = document.getElementById('livery-modal');
  const liveryPreviewCanvasEl = document.getElementById('livery-preview-canvas');
  const liveryPreviewCtx = liveryPreviewCanvasEl?.getContext?.('2d') || null;
  const liveryInspectorBarEl = document.getElementById('livery-inspector-bar');
  const liveryWelcomeStageEl = document.getElementById('livery-welcome-stage');
  const firstPlayWelcomeStripEl = document.getElementById('first-play-welcome-strip');
  const btnLiveryLaunchDiveEl = document.getElementById('btn-livery-launch-dive');
  const liveryPerfPanelEl = document.getElementById('livery-perf-panel');
  const liveryLadderRailEl = document.getElementById('livery-ladder-rail');
  const liverySavedSlotsEl = document.getElementById('livery-saved-slots');
  const btnLiveryTeamUniformEl = document.getElementById('btn-livery-team-uniform');
  const liveryCatTabsEl = document.getElementById('livery-cat-tabs');
  const liveryEnvTabsEl = document.getElementById('livery-env-tabs');
  const btnLiveryPrevCcrEl = document.getElementById('btn-livery-prev-ccr');
  const btnLiveryPrevDpvEl = document.getElementById('btn-livery-prev-dpv');
  const btnLiveryBestEl = document.getElementById('btn-livery-best');
  const btnLiveryRandomEl = document.getElementById('btn-livery-random');
  const btnLiveryFieldTestEl = document.getElementById('btn-livery-field-test');
  const liveryEquippedGridEl = document.getElementById('livery-equipped-grid');
  const liveryTreasureMapsSectionEl = document.getElementById('livery-treasure-maps-section');
  const liveryDiscoveryWhisperEl = document.getElementById('livery-discovery-whisper');
  const liveryChromaGridEl = document.getElementById('livery-chroma-grid');
  const liveryChromaAnimGridEl = document.getElementById('livery-chroma-anim-grid');
  const liveryWalletPillEl = document.getElementById('livery-wallet-pill');
  const liveryUnlockSummaryEl = document.getElementById('livery-unlock-summary');
  const debriefGearUnlocksEl = document.getElementById('debrief-gear-unlocks');
  const lootDiscoveryBannerEl = document.getElementById('loot-discovery-banner');
  let lootBannerTimer = null;
  const btnLiveryCloseEl = document.getElementById('btn-livery-close');
  const btnLiveryResetEl = document.getElementById('btn-livery-reset');
  const btnLiveryDoneEl = document.getElementById('btn-livery-done');
  const gearSlotModalEl = document.getElementById('gear-slot-modal');
  const gearSlotPreviewCanvasEl = document.getElementById('gear-slot-preview-canvas');
  const gearSlotPreviewCtx = gearSlotPreviewCanvasEl?.getContext?.('2d') || null;
  const gearSlotModalTitleEl = document.getElementById('gear-slot-modal-title');
  const gearSlotModalSubEl = document.getElementById('gear-slot-modal-sub');
  const gearSlotEquippedHeroEl = document.getElementById('gear-slot-equipped-hero');
  const gearSlotOwnedHeadingEl = document.getElementById('gear-slot-owned-heading');
  const gearSlotOwnedListEl = document.getElementById('gear-slot-owned-list');
  const gearSlotBuybackWrapEl = document.getElementById('gear-slot-buyback-wrap');
  const gearSlotBuybackListEl = document.getElementById('gear-slot-buyback-list');
  const btnGearSlotCloseEl = document.getElementById('btn-gear-slot-close');
  let activeCompareSlot = null;
  const liveryPanels = {
    equipped: document.getElementById('livery-panel-equipped'),
    chroma: document.getElementById('livery-panel-chroma'),
  };

  let activeLiveryTab = 'equipped';
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

  // Kinetic equip-on-avatar animation state, multi-slot Try-On, Equip Flash, Gear Inspector & Set Inspector state (v211–v228)
  let activeEquipFx = null;
  let justEquippedKey = '';
  let lockedTryOn = null; // { slot, field, id, patch?, name, hint, tier, isSet?, setId? } | null
  let hoveredGear = null; // { slot, field, item, unlocked } | null (live hover preview without modal re-render)
  let pinnedInspect = null; // { slot, field, item, unlocked, justEquipped?, replacedName?, impact? } | null
  let lastEquipFlash = null; // { itemName, diffs, expiresAt } | null
  let inspectedSetId = '';
  let recentDiveUnlocks = [];
  let savedPrevLevelBeforeProving = null;
  let launchingFieldTest = false;

  function getWelcomeCrateState() {
    let book = null;
    try { book = loadCareerLogbook(); } catch {}
    const totalDives = Number(book?.totalDives) || 0;
    const sitesCleared = book?.cleared ? Object.keys(book.cleared).length : 0;
    const foundGear = book?.foundGear && typeof book.foundGear === 'object' ? book.foundGear : {};
    let claimedChoice = null;
    for (const ch of WELCOME_RELIC_CHOICES) {
      const rec = foundGear[`${ch.giftSlot}:${ch.giftItemId}`];
      if (rec && rec.siteId === 'welcome-crate') {
        claimedChoice = ch;
        break;
      }
    }
    const isNewDiver = totalDives === 0 && sitesCleared === 0;
    return { isNewDiver, claimedChoice, totalDives, sitesCleared };
  }

  function claimWelcomeRelicChoice(choiceId) {
    const ch = WELCOME_RELIC_CHOICES.find((c) => c.id === choiceId);
    if (!ch) return false;
    const st = getWelcomeCrateState();
    if (st.claimedChoice) return false;
    try {
      const res = recordFoundWorldGear(loadCareerLogbook(), {
        slot: ch.giftSlot,
        itemId: ch.giftItemId,
        siteId: 'welcome-crate',
        siteName: 'Expedition Welcome Crate',
      });
      if (res?.book && typeof saveCareerLogbook === 'function') {
        saveCareerLogbook(res.book);
      }
    } catch {}
    markEntrySeen(`${ch.giftSlot}:${ch.giftItemId}`);
    try { playGearUnlock?.('uncommon'); } catch {}
    try { spawnConfetti?.(); } catch {}
    updateActiveLiveryField(
      { ...ch.fullRig },
      { slot: ch.giftSlot, itemMeta: { id: ch.giftItemId, name: ch.giftName, tier: 'uncommon' }, silentAudio: true }
    );
    showToast?.(`🎁 Claimed ${ch.giftName} & outfitted your ${ch.title} starter rig! Ready for Dive #1!`, 3.8);
    return true;
  }

  function getDisplayedRigLivery() {
    if (hoveredGear?.field && hoveredGear?.item?.id) {
      return { ...activeRigLivery, [hoveredGear.field]: hoveredGear.item.id };
    }
    if (pinnedInspect && !pinnedInspect.justEquipped && pinnedInspect.field && pinnedInspect.item?.id) {
      return { ...activeRigLivery, [pinnedInspect.field]: pinnedInspect.item.id };
    }
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
    if (launchingFieldTest || typeof launchProvingGrounds !== 'function') return false;
    launchingFieldTest = true;
    try {
      const pgLevel = createProvingGroundsLevel();
      const useLivery = trialLivery ? { ...trialLivery } : { ...getDisplayedRigLivery() };
      const isCustomTrial = Boolean(trialLivery || lockedTryOn);
      const label = trialLabel || (lockedTryOn ? lockedTryOn.name : '');
      closeLiveryModal();
      closeDiveSetupModal?.();
      setHomeMenuOpen?.(false);
      const prevLvl = await launchProvingGrounds(pgLevel);
      if (prevLvl && !prevLvl.isProvingGrounds) {
        savedPrevLevelBeforeProving = prevLvl;
      } else if (!savedPrevLevelBeforeProving) {
        savedPrevLevelBeforeProving = LEVELS[0] || null;
      }
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
    } catch (err) {
      console.error('Proving Grounds launch failed:', err);
      const prev = savedPrevLevelBeforeProving || LEVELS[0] || null;
      savedPrevLevelBeforeProving = null;
      try { exitProvingGrounds?.(prev); } catch {}
      try { openLiveryModal(activeLiveryTab); } catch {}
      showToast?.('Could not launch Proving Grounds — returned safely to Gear Workshop.', 3.2);
      return false;
    } finally {
      launchingFieldTest = false;
    }
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

  function triggerEquipAnimation(slot, itemOrMeta = null, { silentAudio = false, isPreview = false } = {}) {
    const tierId = itemOrMeta?.tier || 'common';
    const tierMeta = getGearTierMeta(tierId);
    activeEquipFx = {
      slot: slot || 'all',
      startedAtMs: performance.now(),
      color: tierMeta.color,
      tier: tierMeta.id,
      itemName: itemOrMeta?.name || '',
      isPreview: Boolean(isPreview),
    };
    if (slot && itemOrMeta?.id) {
      justEquippedKey = `${slot}:${itemOrMeta.id}`;
    }
    if (!silentAudio) {
      try { playGearEquip?.(slot, tierMeta.id); } catch {}
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
      hasDpv = Boolean(eq?.dpv || (activeRigLivery?.scooterId && activeRigLivery.scooterId !== 'none'));
    } catch {}
    drawMiniDiverAvatar(homeAvatarCtx, homeAvatarCanvasEl.width, homeAvatarCanvasEl.height, activeRigLivery, { hasCcr, hasDpv });
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
        const cleared = completeTreasureMapLeadInLogbook(res?.book || loadCareerLogbook(), {
          levelId: sess?.level?.id || '',
          gearKey: `${gc.slot}:${gc.itemId}`,
        });
        const credited = awardDoubloonsInLogbook(cleared?.book || res?.book || loadCareerLogbook(), 50);
        if (credited?.book) saveCareerLogbook(credited.book);
        refreshWorldMap?.();
      } catch {}
    }
    syncLiveryUi();

    if (!lootDiscoveryBannerEl) return;
    const entry = getGearItemBySlot(gc.slot, gc.itemId);
    const item = entry?.item || { id: gc.itemId, name: gc.itemName || gc.name || gc.itemId, tier: gc.tier || 'rare' };
    const info = getGearItemStats(gc.slot, item);
    const tierMeta = getGearTierMeta(item.tier || gc.tier || 'rare');
    const pillsHtml = info.pills.slice(0, 4).map((p) => `<span class="livery-stat-pill">${escapeHtml(p)}</span>`).join('');
    const pwrHtml = info.power ? `<span class="livery-power-badge" title="${escapeHtml(info.power.desc)}">⚡ ${escapeHtml(info.power.name)}</span>` : '';
    const artHtml = renderGearArtworkSvg(gc.slot, item, { size: 54 });
    const cmp = _buildLootImpactSection(gc.slot, gc.itemId, sess);
    lootDiscoveryBannerEl.dataset.tier = tierMeta.id;
    lootDiscoveryBannerEl.hidden = false;
    lootDiscoveryBannerEl.innerHTML = `
      <div class="loot-disc-hero">
        <div class="loot-disc-art">${artHtml}</div>
        <div class="loot-disc-info">
          <div class="loot-disc-top">
            <span class="loot-disc-kicker">${tierMeta.icon} ${isDemo ? 'DEMO CACHE' : tierMeta.badge}</span>
          </div>
          <div class="loot-disc-name">${escapeHtml(item.name)}</div>
          <div class="loot-disc-pills">${pillsHtml}${pwrHtml}</div>
        </div>
      </div>
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
    const _maybeGrantExpeditionMapLead = (bookIn) => {
      if (!bookIn || sess?.isProvingGrounds) return { book: bookIn, newLead: null };
      const curLeads = Array.isArray(bookIn.treasureMapLeads) ? bookIn.treasureMapLeads : [];
      if (curLeads.length >= 3) return { book: bookIn, newLead: null };
      // Guaranteed fresh map lead if player has 0 active maps; 50% chance otherwise
      if (curLeads.length > 0 && Math.random() > 0.5) return { book: bookIn, newLead: null };
      const lead = rollExpeditionTreasureMapLead({
        levels: LEVELS,
        currentLevelId: sess?.level?.id || '',
        foundGearMap: bookIn.foundGear || {},
        existingLeads: curLeads,
        chestPool: CHEST_GEAR_DROPS,
        worldCaches: WORLD_GEAR_CACHES,
      });
      if (!lead) return { book: bookIn, newLead: null };
      const added = addTreasureMapLeadInLogbook(bookIn, lead);
      return { book: added.book, newLead: added.added ? added.lead : null };
    };

    if (drop.kind === 'gear') {
      playGearUnlock?.(drop.tier || 'rare');
      const bonusMult = Math.max(1, Number(sess?.rigPerf?.salvageBonusMult) || 1);
      const gearCoins = Math.round((drop.tier === 'legendary' ? 160 : drop.tier === 'mythic' ? 95 : 65) * bonusMult);
      let chartedLead = null;
      if (typeof saveCareerLogbook === 'function') {
        try {
          const res = recordFoundWorldGear(loadCareerLogbook(), {
            slot: drop.slot,
            itemId: drop.itemId,
            siteId: sess?.level?.id || '',
            siteName: sess?.level?.name || '',
          });
          const cleared = completeTreasureMapLeadInLogbook(res?.book || loadCareerLogbook(), {
            levelId: sess?.level?.id || '',
            leadId: chest.leadId || '',
            skillId: chest.skillFocus || '',
          });
          const credited = awardDoubloonsInLogbook(cleared?.book || loadCareerLogbook(), gearCoins);
          const mapped = _maybeGrantExpeditionMapLead(credited?.book || loadCareerLogbook());
          chartedLead = mapped.newLead;
          if (mapped.book) saveCareerLogbook(mapped.book);
          refreshWorldMap?.();
        } catch {}
      }
      syncLiveryUi();

      if (!lootDiscoveryBannerEl) return;
      const entry = getGearItemBySlot(drop.slot, drop.itemId);
      const item = entry?.item || { id: drop.itemId, name: drop.name || drop.itemId, tier: drop.tier || 'rare' };
      const info = drop.statsInfo || getGearItemStats(drop.slot, item);
      const tierMeta = getGearTierMeta(item.tier || drop.tier || 'rare');
      const pillsHtml = info.pills.slice(0, 4).map((p) => `<span class="livery-stat-pill">${escapeHtml(p)}</span>`).join('');
      const pwrHtml = info.power ? `<span class="livery-power-badge" title="${escapeHtml(info.power.desc)}">⚡ ${escapeHtml(info.power.name)}</span>` : '';
      const mapLeadHtml = chartedLead
        ? `<div class="loot-disc-power">🗺️ <strong>Map Found:</strong> ${escapeHtml(chartedLead.skillIcon)} ${escapeHtml(chartedLead.skillShort)} → ${escapeHtml(chartedLead.siteName)}</div>`
        : '';
      const artHtml = renderGearArtworkSvg(drop.slot, item, { size: 54 });
      const cmp = _buildLootImpactSection(drop.slot, drop.itemId, sess);
      lootDiscoveryBannerEl.dataset.tier = tierMeta.id;
      lootDiscoveryBannerEl.hidden = false;
      lootDiscoveryBannerEl.innerHTML = `
        <div class="loot-disc-hero">
          <div class="loot-disc-art">${artHtml}</div>
          <div class="loot-disc-info">
            <div class="loot-disc-top">
              <span class="loot-disc-kicker">🧰 ${tierMeta.icon} ${tierMeta.badge}</span>
              <span class="livery-stat-pill">+${drop.gasBonusBar || 10}b · +${gearCoins} 🪙</span>
            </div>
            <div class="loot-disc-name">${escapeHtml(item.name)}</div>
            <div class="loot-disc-pills">${pillsHtml}${pwrHtml}</div>
          </div>
        </div>
        ${mapLeadHtml}
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
    const bonusMult = Math.max(1, Number(sess?.rigPerf?.salvageBonusMult) || 1);
    const baseCoins = Number(drop.doubloonBonus) || (drop.tier === 'mythic' ? 130 : drop.tier === 'epic' ? 90 : 55);
    const chestCoins = Math.round(baseCoins * bonusMult);
    let chartedLead = null;
    if (!sess?.isProvingGrounds && typeof saveCareerLogbook === 'function') {
      try {
        const cleared = completeTreasureMapLeadInLogbook(loadCareerLogbook(), {
          levelId: sess?.level?.id || '',
          leadId: chest.leadId || '',
          skillId: chest.skillFocus || '',
        });
        const credited = awardDoubloonsInLogbook(cleared?.book || loadCareerLogbook(), chestCoins);
        const mapped = _maybeGrantExpeditionMapLead(credited?.book || loadCareerLogbook());
        chartedLead = mapped.newLead;
        if (mapped.book) saveCareerLogbook(mapped.book);
        refreshWorldMap?.();
      } catch {}
    }
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
      <div class="loot-disc-detail">${escapeHtml(drop.detail || `+${drop.points || 300} Salvage pts`)} · <strong>+${chestCoins} 🪙 Doubloons</strong>${chartedLead ? `<br/>🗺️ <strong>Treasure Map Found:</strong> ${escapeHtml(chartedLead.skillIcon)} ${escapeHtml(chartedLead.skillShort)} Lead marked on World Map (${escapeHtml(chartedLead.siteName)})` : ''}</div>
      <div class="loot-disc-actions">
        <button type="button" class="btn tiny ghost" id="btn-loot-dismiss">Continue Dive</button>
      </div>
    `;
    lootDiscoveryBannerEl.querySelector('#btn-loot-dismiss')?.addEventListener('click', hideLootDiscoveryBanner);
    if (lootBannerTimer) clearTimeout(lootBannerTimer);
    lootBannerTimer = setTimeout(hideLootDiscoveryBanner, 5600);
  }

  function handleTreasureMapFound(map, beacon) {
    if (!map || !beacon) return;
    const sess = getSession?.();
    // Persist the Treasure Map lead in logbook so it appears on World Map & Gear Workshop until opened!
    if (!sess?.isProvingGrounds && sess?.level?.id && typeof saveCareerLogbook === 'function') {
      try {
        const res = addTreasureMapLeadInLogbook(loadCareerLogbook(), {
          id: `lead-vault-${sess.level.id}-${beacon.skillId}`,
          kind: 'vault-chest',
          levelId: sess.level.id,
          siteName: sess.level.name || sess.level.id,
          targetGearKey: '',
          skillId: beacon.skillId,
          skillLabel: beacon.skillLabel,
          skillShort: beacon.skillShort,
          skillIcon: beacon.skillIcon,
          skillVerb: beacon.skillVerb,
          color: beacon.color,
          rgb: beacon.rgb,
          hintSlot: 'suit',
          hintSlotLabel: 'Vault Gear',
          hintTier: 'legendary',
          hintTitle: `${beacon.skillShort} Vault Relic`,
          hintClue: `Vault Chest located in ${sess.level.name || sess.level.id} — track on Sonar`,
        });
        if (res?.book) saveCareerLogbook(res.book);
        refreshWorldMap?.();
      } catch {}
    }
    if (!lootDiscoveryBannerEl) return;
    const distM = sess?.diver ? Math.round(Math.hypot(beacon.x - sess.diver.x, beacon.y - sess.diver.y)) : 0;
    const depthM = Math.max(0, Math.round(beacon.y || 0));
    lootDiscoveryBannerEl.dataset.tier = 'legendary';
    lootDiscoveryBannerEl.hidden = false;
    lootDiscoveryBannerEl.innerHTML = `
      <div class="loot-disc-top">
        <span class="loot-disc-kicker">🗺️ TREASURE MAP DECODED · SONAR BEACON LOCKED</span>
        <span class="livery-tier-pill tier-legendary">${escapeHtml(beacon.skillIcon)} ${escapeHtml(beacon.skillShort)}</span>
      </div>
      <div class="loot-disc-name">${escapeHtml(beacon.skillIcon)} ${escapeHtml(beacon.skillLabel)} Gear Vault</div>
      <div class="loot-disc-detail"><strong>Boosts:</strong> ${escapeHtml(beacon.skillVerb)} · Track pulsing <strong>${escapeHtml(beacon.skillIcon)}</strong> beacon on your Sonar (${distM}m away · ${depthM}m depth)</div>
      <div class="loot-disc-actions">
        <button type="button" class="btn tiny primary" id="btn-loot-dismiss">📡 Track on Sonar</button>
      </div>
    `;
    lootDiscoveryBannerEl.querySelector('#btn-loot-dismiss')?.addEventListener('click', hideLootDiscoveryBanner);
    if (lootBannerTimer) clearTimeout(lootBannerTimer);
    lootBannerTimer = setTimeout(hideLootDiscoveryBanner, 7500);
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
    if (btnHomeQuickLiveryEl) {
      btnHomeQuickLiveryEl.classList.toggle('has-new-gear', unseenCount > 0);
      btnHomeQuickLiveryEl.textContent = unseenCount > 0 ? `🎨 Gear · ${unseenCount}` : '🎨 Gear Workshop';
    }
    if (firstPlayWelcomeStripEl) {
      const wc = getWelcomeCrateState();
      firstPlayWelcomeStripEl.hidden = !(wc.isNewDiver && !wc.claimedChoice);
    }
    renderHomeAvatarBadge();
    if (session?.diver && !session.isProvingGrounds) {
      session.diver.livery = { ...activeRigLivery };
      session.rigPerf = perf;
      session.diver.torchReachMult = perf.torchReachMult || 1.0;
      session.diver.siltPierce = perf.siltPierce || 0;
      session.diver.stealth = perf.stealth || 0;
      if (session.hazards) session.hazards.rigPerf = perf;
    }
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
    const previewLivery = getDisplayedRigLivery();
    const hasEquippedScooter = Boolean(previewLivery?.scooterId && previewLivery.scooterId !== 'none');
    const showCcr = ccrUnlocked ? hasCcr : (liveryPreviewCcr !== null ? liveryPreviewCcr : hasCcr);
    const showDpv = hasEquippedScooter || (dpvUnlocked ? hasDpv : (liveryPreviewDpv !== null ? liveryPreviewDpv : hasDpv));

    let equipFxArg = null;
    if (activeEquipFx) {
      const p = (performance.now() - activeEquipFx.startedAtMs) / EQUIP_ANIM_DURATION_MS;
      if (p < 1) {
        equipFxArg = { ...activeEquipFx, progress: Math.max(0, p) };
      } else {
        activeEquipFx = null;
      }
    }

    // Live slot focus spotlight on the avatar when hovering, inspecting, or trying on gear (v228)
    let focusHighlight = null;
    if (hoveredGear?.slot && hoveredGear?.item) {
      const tm = getGearTierMeta(hoveredGear.item.tier);
      const isSame = hoveredGear.field && (activeRigLivery[hoveredGear.field] || '') === hoveredGear.item.id;
      focusHighlight = {
        slot: hoveredGear.slot,
        color: isSame ? '#38bdf8' : tm.color,
        kicker: isSame ? 'EQUIPPED' : hoveredGear.unlocked ? 'PREVIEW' : 'LOCKED PREVIEW',
        label: hoveredGear.item.name,
      };
    } else if (!equipFxArg && pinnedInspect?.slot && pinnedInspect?.item) {
      const tm = getGearTierMeta(pinnedInspect.item.tier);
      focusHighlight = {
        slot: pinnedInspect.slot,
        color: pinnedInspect.justEquipped ? '#34d399' : tm.color,
        kicker: pinnedInspect.justEquipped ? 'EQUIPPED' : pinnedInspect.unlocked ? 'INSPECTING' : 'LOCKED PREVIEW',
        label: pinnedInspect.item.name,
      };
    } else if (!equipFxArg && lockedTryOn?.slot && lockedTryOn.slot !== 'all') {
      const tm = getGearTierMeta(lockedTryOn.tier);
      focusHighlight = {
        slot: lockedTryOn.slot,
        color: '#facc15',
        kicker: 'TRY-ON',
        label: lockedTryOn.name,
      };
    }

    const slotModalOpen = Boolean(gearSlotModalEl && !gearSlotModalEl.hidden && gearSlotPreviewCtx && gearSlotPreviewCanvasEl);
    try {
      drawLiveryPreview(liveryPreviewCtx, liveryPreviewCanvasEl.width, liveryPreviewCanvasEl.height, previewLivery, {
        hasCcr: showCcr,
        hasDpv: showDpv,
        hasSpeargun: activeCompareSlot === 'harpoon' && slotModalOpen,
        envMode: liveryPreviewEnv,
        timeSec,
        equipFx: equipFxArg,
        focusHighlight,
        previewLockedLabel: lockedTryOn && !hoveredGear ? `${lockedTryOn.name} (${lockedTryOn.hint})` : '',
      });
      if (slotModalOpen) {
        const modalHasDpv = activeCompareSlot === 'scooter'
          ? Boolean(previewLivery?.scooterId && previewLivery.scooterId !== 'none')
          : showDpv;
        let modalFocus = focusHighlight;
        if (!modalFocus && !equipFxArg && activeCompareSlot) {
          const palNow = resolveDiverLiveryPalette(previewLivery);
          const slotItemMap = {
            suit: palNow.suit,
            trim: palNow.trimSpec,
            headgear: palNow.headgear,
            visor: palNow.visor,
            tank: palNow.tank,
            torch: palNow.torch,
            scooter: palNow.scooter,
            harpoon: palNow.harpoon,
            patch: palNow.patch,
          };
          const eqSlotItem = slotItemMap[activeCompareSlot];
          if (eqSlotItem) {
            const tm = getGearTierMeta(eqSlotItem.tier);
            modalFocus = {
              slot: activeCompareSlot,
              color: tm.color,
              kicker: 'EQUIPPED',
              label: eqSlotItem.name,
            };
          }
        }
        drawLiveryPreview(gearSlotPreviewCtx, gearSlotPreviewCanvasEl.width, gearSlotPreviewCanvasEl.height, previewLivery, {
          hasCcr: showCcr,
          hasDpv: modalHasDpv,
          hasSpeargun: activeCompareSlot === 'harpoon',
          envMode: liveryPreviewEnv,
          timeSec,
          equipFx: equipFxArg,
          focusHighlight: modalFocus,
        });
      }
    } catch (err) {
      console.error('Livery preview render error:', err);
    }
  }

  function purchaseAndApplyChroma(dyeId) {
    const unlocks = getCurrentLiveryUnlocks();
    const res = purchaseGearChromaInLogbook(loadCareerLogbook(), dyeId, unlocks.stats);
    if (!res.ok) {
      if (res.reason === 'exclusive-locked') {
        showToast?.(`🔒 Exclusive Coating — ${res.chroma?.requirementHint || 'Complete career milestone first'}`, 3.0);
      } else if (res.reason === 'insufficient-funds') {
        const shortBy = Math.max(1, (res.cost || 0) - (res.book?.doubloons || 0));
        showToast?.(`🪙 Need ${shortBy} more Salvage Doubloons — clear sites or open sunken chests!`, 3.0);
      }
      return false;
    }
    if (res.reason === 'purchased') {
      if (typeof saveCareerLogbook === 'function') saveCareerLogbook(res.book);
      scheduleGitHubStatsSync?.();
      try { playGearUnlock?.(res.chroma.exclusive ? 'mythic' : res.chroma.animated ? 'epic' : 'rare'); } catch {}
      if (res.chroma.animated || res.chroma.exclusive) {
        try { spawnConfetti?.(); } catch {}
      }
      showToast?.(`🎨 Purchased & applied ${res.chroma.name} (-${res.cost} 🪙)!`, 3.2);
    }
    updateActiveLiveryField(
      { dyeId: res.chroma.id },
      { slot: 'chroma', itemMeta: { id: res.chroma.id, name: res.chroma.name, tier: res.chroma.exclusive ? 'mythic' : res.chroma.animated ? 'epic' : 'rare' }, silentAudio: res.reason === 'purchased' }
    );
    return true;
  }

  let pendingSellKey = null;

  function sellGearItem(slot, field, item) {
    if (!item || !slot) return;
    const key = `${slot}:${item.id}`;
    const perf = computeRigPerformanceProfile(activeRigLivery, getWorkshopTuningCtx(workshopTuningMode));
    const res = sellGearInLogbook(loadCareerLogbook(), slot, item.id, {
      salvageBonusMult: perf?.salvageBonusMult || 1.0,
    });
    pendingSellKey = null;
    if (!res.ok) {
      showToast?.('Standard Issue gear cannot be sold.', 2.2);
      return;
    }
    if (typeof saveCareerLogbook === 'function') {
      try { saveCareerLogbook(res.book); } catch {}
    }
    if (field && activeRigLivery[field] === item.id) {
      const nextRaw = { ...activeRigLivery };
      delete nextRaw[field];
      activeRigLivery = sanitizeRigLivery(nextRaw, getCurrentLiveryUnlocks());
      saveRigLivery();
      if (slot === 'scooter') {
        try {
          const savedGearLoadout = getSavedGearLoadout();
          if (savedGearLoadout) {
            savedGearLoadout.dpv = false;
            saveGearLoadout();
            renderTechGearDock();
          }
        } catch {}
      }
    }
    pinnedInspect = null;
    lockedTryOn = null;
    playGearEquip?.('all', 'rare');
    syncLiveryUi();
    renderLiveryWorkshopModal();
    const note = res.reentersLootPool
      ? 'Returned to Chest/World loot pool.'
      : 'Available for Buyback anytime in Workshop.';
    showToast?.(`🪙 Sold ${item.name} for +${res.value} Doubloons! ${note}`, 3.4);
  }

  function buybackSoldGearItem(slot, field, item) {
    if (!item || !slot) return;
    const res = buybackGearInLogbook(loadCareerLogbook(), slot, item.id);
    if (!res.ok) {
      if (res.reason === 'insufficient-funds') {
        const bal = Math.max(0, Math.round(Number(res.book?.doubloons) || 0));
        showToast?.(`🪙 Need ${res.cost - bal} more Doubloons to buy back ${item.name}.`, 2.8);
      }
      return;
    }
    if (typeof saveCareerLogbook === 'function') {
      try { saveCareerLogbook(res.book); } catch {}
    }
    pinnedInspect = null;
    lockedTryOn = null;
    if (field) {
      updateActiveLiveryField({ [field]: item.id }, { slot, itemMeta: item });
    } else {
      syncLiveryUi();
      renderLiveryWorkshopModal();
    }
    showToast?.(`🪙 Bought back & equipped ${item.name} (-${res.cost} 🪙)!`, 2.8);
  }

  function renderInspectorBar() {
    if (!liveryInspectorBarEl) return;
    const tuningCtx = getWorkshopTuningCtx(workshopTuningMode);
    const activeTarget = hoveredGear || (pinnedInspect ? pinnedInspect : null) || (lockedTryOn && !lockedTryOn.isSet
      ? (() => {
          const entry = getGearItemBySlot(lockedTryOn.slot, lockedTryOn.id);
          return entry ? { slot: lockedTryOn.slot, field: lockedTryOn.field, item: entry.item, unlocked: false } : null;
        })()
      : null);

    // Default: hide inspector bar when idle on Equipped Rig tab to keep Workshop zero-noise (v232)
    if (!activeTarget || !activeTarget.item) {
      if (activeLiveryTab === 'chroma') {
        const curChroma = getGearChroma(activeRigLivery.dyeId || 'none');
        liveryInspectorBarEl.hidden = false;
        liveryInspectorBarEl.dataset.state = 'idle';
        liveryInspectorBarEl.innerHTML = `
          <div class="livery-insp-row">
            <span class="livery-insp-kicker">COATING</span>
            <strong class="livery-insp-name">${escapeHtml(curChroma.name)}</strong>
            ${curChroma.fxName ? `<span class="livery-insp-pill fx">✦ ${escapeHtml(curChroma.fxName)}</span>` : ''}
          </div>
        `;
        return;
      }
      liveryInspectorBarEl.hidden = true;
      liveryInspectorBarEl.innerHTML = '';
      return;
    }

    // Also keep inspector bar hidden when merely hovering equipped cards on the Equipped Rig tab (card itself shows art & stats)
    if (hoveredGear && activeLiveryTab === 'equipped' && activeTarget.slot !== 'chroma') {
      liveryInspectorBarEl.hidden = true;
      liveryInspectorBarEl.innerHTML = '';
      return;
    }

    liveryInspectorBarEl.hidden = false;

    // Specialized clean inspector mode for Color Finishes & Animated Coatings (v229)
    if (activeTarget.slot === 'chroma') {
      const chroma = getGearChroma(activeTarget.item.id);
      const tierMeta = CHROMA_TIERS[chroma.tier] || CHROMA_TIERS.standard;
      const unlocks = getCurrentLiveryUnlocks();
      const book = loadCareerLogbook();
      const bal = Math.max(0, Math.round(Number(book?.doubloons) || 0));
      const owned = unlocks.dyes?.has(chroma.id) || chroma.id === 'none';
      const isEquippedNow = (activeRigLivery.dyeId || 'none') === chroma.id;
      const eligible = isChromaExclusiveEligible(chroma, unlocks.stats);
      const canAfford = bal >= chroma.cost;
      const stateKey = isEquippedNow ? 'equipped' : owned ? 'same' : !eligible ? 'downgrade' : canAfford ? 'upgrade' : 'tradeoff';
      const verdictTxt = isEquippedNow
        ? '✓ ACTIVE'
        : owned
          ? 'OWNED'
          : !eligible
            ? '🔒 EXCLUSIVE LOCKED'
            : `🪙 ${chroma.cost} DOUBLOONS`;

      let actHtml = '';
      if (!hoveredGear && pinnedInspect && !isEquippedNow) {
        if (owned) {
          actHtml = `<button type="button" class="btn tiny primary livery-insp-act" id="btn-insp-apply-chroma">🎨 Apply</button><button type="button" class="btn tiny ghost livery-insp-act" id="btn-insp-clear" aria-label="Close preview">✕</button>`;
        } else if (eligible && canAfford) {
          actHtml = `<button type="button" class="btn tiny primary livery-insp-act" id="btn-insp-buy-chroma">🪙 Buy &amp; Apply (${chroma.cost})</button><button type="button" class="btn tiny ghost livery-insp-act" id="btn-insp-clear" aria-label="Revert preview">↺</button>`;
        } else {
          actHtml = `<button type="button" class="btn tiny secondary livery-insp-act" id="btn-insp-test-chroma">🧪 Test</button><button type="button" class="btn tiny ghost livery-insp-act" id="btn-insp-clear" aria-label="Revert preview">↺</button>`;
        }
      }

      liveryInspectorBarEl.dataset.state = stateKey;
      liveryInspectorBarEl.innerHTML = `
        <div class="livery-insp-row">
          <span class="livery-insp-kicker" style="color:${tierMeta.color}">${escapeHtml(tierMeta.label)}</span>
          <strong class="livery-insp-name">${escapeHtml(chroma.name)}</strong>
          <span class="livery-insp-verdict verdict-${stateKey}">${verdictTxt}</span>
          ${!owned && !eligible && chroma.requirementHint ? `<span class="livery-insp-vs">${escapeHtml(chroma.requirementHint)}</span>` : ''}
          ${!owned && eligible && !canAfford ? `<span class="livery-insp-vs">Need <strong>${chroma.cost - bal} 🪙</strong> more</span>` : ''}
          ${actHtml ? `<span class="livery-insp-actions">${actHtml}</span>` : ''}
        </div>
        <div class="livery-insp-deltas">
          <span class="livery-insp-pill neutral">Keeps 100% of gear stats &amp; Set Bonuses</span>
          ${chroma.fxName ? `<span class="livery-insp-pill fx">✦ ${escapeHtml(chroma.fxName)}</span>` : `<span class="livery-insp-note">${escapeHtml(chroma.desc)}</span>`}
        </div>
      `;
      liveryInspectorBarEl.querySelector('#btn-insp-apply-chroma')?.addEventListener('click', () => {
        updateActiveLiveryField(
          { dyeId: chroma.id },
          { slot: 'chroma', itemMeta: { id: chroma.id, name: chroma.name, tier: chroma.exclusive ? 'mythic' : chroma.animated ? 'epic' : 'rare' } }
        );
      });
      liveryInspectorBarEl.querySelector('#btn-insp-buy-chroma')?.addEventListener('click', () => {
        purchaseAndApplyChroma(chroma.id);
      });
      liveryInspectorBarEl.querySelector('#btn-insp-test-chroma')?.addEventListener('click', () => {
        startFieldTestDive({
          trialLivery: { ...activeRigLivery, dyeId: chroma.id },
          trialLabel: `🎨 ${chroma.name}`,
        });
      });
      liveryInspectorBarEl.querySelector('#btn-insp-clear')?.addEventListener('click', () => {
        pinnedInspect = null;
        lockedTryOn = null;
        renderLiveryWorkshopModal();
      });
      return;
    }

    const { slot, field, item, unlocked, justEquipped, replacedName, impact: cachedImpact } = activeTarget;
    const slotLbl = SLOT_DISPLAY_NAMES[slot] || slot;
    const isEquippedNow = field && (activeRigLivery[field] || '') === item.id;
    const impact = justEquipped && cachedImpact
      ? cachedImpact
      : evaluateLootUpgradeImpact(activeRigLivery, slot, item.id, tuningCtx);
    const itemStats = getGearItemStats(slot, item);
    const chips = [];

    if (impact && !impact.isNormalized && (justEquipped || !isEquippedNow)) {
      for (const sc of impact.setChanges || []) {
        chips.push(`<span class="livery-insp-pill ${sc.positive ? 'pos' : 'neg'} is-set">${sc.positive ? '✦' : '⚠'} ${escapeHtml(sc.text)}</span>`);
      }
      for (const gp of impact.gainedPowers || []) {
        chips.push(`<span class="livery-insp-pill pos is-pwr">+⚡ ${escapeHtml(gp.name)}</span>`);
      }
      for (const lp of impact.lostPowers || []) {
        chips.push(`<span class="livery-insp-pill neg is-pwr">-⚡ ${escapeHtml(lp.name)}</span>`);
      }
      for (const d of (impact.deltas || []).slice(0, 5)) {
        chips.push(`<span class="livery-insp-pill ${d.positive ? 'pos' : 'neg'}">${d.positive ? '▲' : '▼'} ${escapeHtml(d.text)}</span>`);
      }
      if (impact.archChanged && impact.archBefore && impact.archAfter) {
        chips.push(`<span class="livery-insp-pill neutral">${impact.archBefore.icon} ${escapeHtml(impact.archBefore.short)} → ${impact.archAfter.icon} ${escapeHtml(impact.archAfter.short)}</span>`);
      }
    } else if (isEquippedNow) {
      for (const p of itemStats.pills.slice(0, 4)) {
        chips.push(`<span class="livery-insp-pill neutral">${escapeHtml(p)}</span>`);
      }
      if (itemStats.power) {
        chips.push(`<span class="livery-insp-pill pwr" title="${escapeHtml(itemStats.power.desc)}">⚡ ${escapeHtml(itemStats.power.name)}</span>`);
      }
    }
    if (item.fx) {
      chips.push(`<span class="livery-insp-pill fx" title="${escapeHtml(item.fx.desc)}">✦ ${escapeHtml(item.fx.name)}</span>`);
    }

    const verdictCls = justEquipped
      ? 'equipped'
      : isEquippedNow
        ? 'same'
        : impact?.verdict || 'tradeoff';
    const verdictText = justEquipped
      ? '✓ EQUIPPED'
      : isEquippedNow
        ? '✓ CURRENTLY EQUIPPED'
        : impact?.isNormalized
          ? '🧭 PURIST (COSMETIC)'
          : impact?.verdict === 'upgrade'
            ? '▲ UPGRADE'
            : impact?.verdict === 'downgrade'
              ? '▼ LOWER STATS'
              : '⇄ TRADE-OFF';
    const vsText = justEquipped && replacedName && replacedName !== item.name
      ? `Replaced <strong>${escapeHtml(replacedName)}</strong>`
      : !isEquippedNow && impact?.replacedItemName
        ? `vs. <strong>${escapeHtml(impact.replacedItemName)}</strong>`
        : !unlocked
          ? escapeHtml(item.unlockHint || 'Locked')
          : '';

    const itemKey = `${slot}:${item.id}`;
    const unlocksNow = getCurrentLiveryUnlocks();
    const wasSold = Boolean(unlocksNow.soldGear?.has(itemKey));
    const sellVal = isGearSellable(item) ? getGearSellValue(item.tier) : 0;
    const buybackCost = wasSold ? getGearBuybackCost(item.tier) : 0;
    const curBal = Math.max(0, Math.round(Number(loadCareerLogbook()?.doubloons) || 0));
    const isConfirmingSell = pendingSellKey === itemKey;

    let actionHtml = '';
    if (!hoveredGear && pinnedInspect) {
      if (unlocked) {
        const equipBtn = !isEquippedNow
          ? `<button type="button" class="btn tiny primary livery-insp-act" id="btn-insp-equip">⚡ Equip</button>`
          : '';
        const sellBtn = sellVal > 0
          ? isConfirmingSell
            ? `<button type="button" class="btn tiny danger livery-insp-act" id="btn-insp-sell-confirm">⚠️ Confirm Sell (+${sellVal} 🪙)</button>`
            : `<button type="button" class="btn tiny ghost livery-insp-act livery-sell-btn" id="btn-insp-sell" title="Sell for +${sellVal} Salvage Doubloons">🪙 Sell +${sellVal}</button>`
          : '';
        actionHtml = `${equipBtn}${sellBtn}<button type="button" class="btn tiny ghost livery-insp-act" id="btn-insp-clear" aria-label="Close inspector">✕</button>`;
      } else if (wasSold && buybackCost > 0) {
        const canAffordBb = curBal >= buybackCost;
        actionHtml = `<button type="button" class="btn tiny ${canAffordBb ? 'primary' : 'secondary'} livery-insp-act" id="btn-insp-buyback" ${canAffordBb ? '' : 'disabled'}>🪙 Buy Back (${buybackCost})</button><button type="button" class="btn tiny ghost livery-insp-act" id="btn-insp-clear" aria-label="Revert preview">↺</button>`;
      } else {
        actionHtml = `<button type="button" class="btn tiny primary livery-insp-act" id="btn-insp-test">🧪 Test</button><button type="button" class="btn tiny ghost livery-insp-act" id="btn-insp-clear" aria-label="Revert preview">↺</button>`;
      }
    }

    const noteFallback = impact?.isNormalized
      ? `<span class="livery-insp-note">Purist mode normalizes stats — visual swap only.</span>`
      : chips.length === 0
        ? `<span class="livery-insp-note">${wasSold ? `Sold · Buy back anytime for ${buybackCost} 🪙` : !unlocked ? `🔒 ${escapeHtml(item.unlockHint || 'Locked')}` : 'Same baseline stats as current gear.'}</span>`
        : '';

    liveryInspectorBarEl.dataset.state = verdictCls;
    liveryInspectorBarEl.innerHTML = `
      <div class="livery-insp-row">
        <span class="livery-insp-kicker">${escapeHtml(slotLbl.toUpperCase())}</span>
        <strong class="livery-insp-name">${escapeHtml(item.name)}</strong>
        <span class="livery-insp-verdict verdict-${verdictCls}">${verdictText}</span>
        ${vsText ? `<span class="livery-insp-vs">${vsText}</span>` : ''}
        ${actionHtml ? `<span class="livery-insp-actions">${actionHtml}</span>` : ''}
      </div>
      <div class="livery-insp-deltas">${chips.join('')}${noteFallback}</div>
    `;

    liveryInspectorBarEl.querySelector('#btn-insp-equip')?.addEventListener('click', () => {
      pendingSellKey = null;
      if (field && item) updateActiveLiveryField({ [field]: item.id }, { slot, itemMeta: item });
    });
    liveryInspectorBarEl.querySelector('#btn-insp-sell')?.addEventListener('click', () => {
      pendingSellKey = itemKey;
      renderInspectorBar();
    });
    liveryInspectorBarEl.querySelector('#btn-insp-sell-confirm')?.addEventListener('click', () => {
      sellGearItem(slot, field, item);
    });
    liveryInspectorBarEl.querySelector('#btn-insp-buyback')?.addEventListener('click', () => {
      buybackSoldGearItem(slot, field, item);
    });
    liveryInspectorBarEl.querySelector('#btn-insp-test')?.addEventListener('click', () => {
      pendingSellKey = null;
      startFieldTestDive({
        trialLivery: { ...activeRigLivery, [field]: item.id },
        trialLabel: item.name,
      });
    });
    liveryInspectorBarEl.querySelector('#btn-insp-clear')?.addEventListener('click', () => {
      pendingSellKey = null;
      pinnedInspect = null;
      lockedTryOn = null;
      renderLiveryWorkshopModal();
    });
  }

  function setLiveryActiveTab(tabId) {
    if (!liveryPanels[tabId]) return;
    activeLiveryTab = tabId;
    hoveredGear = null;
    liveryCatTabsEl?.querySelectorAll?.('button[data-livery-tab]')?.forEach?.((btn) => {
      const on = btn.getAttribute('data-livery-tab') === tabId;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    for (const [k, el] of Object.entries(liveryPanels)) {
      if (el) el.hidden = k !== tabId;
    }
    renderInspectorBar();
  }

  function updateActiveLiveryField(patchObj, { slot = 'all', itemMeta = null, silentAudio = false } = {}) {
    lockedTryOn = null;
    hoveredGear = null;
    const prevTuningCtx = getWorkshopTuningCtx(workshopTuningMode);
    const prevLivery = { ...activeRigLivery };
    const prevPerf = computeRigPerformanceProfile(prevLivery, prevTuningCtx);
    const preImpact = slot && slot !== 'all' && slot !== 'chroma' && itemMeta?.id
      ? evaluateLootUpgradeImpact(prevLivery, slot, itemMeta.id, prevTuningCtx)
      : null;
    const unlocks = getCurrentLiveryUnlocks();
    activeRigLivery = sanitizeRigLivery({ ...activeRigLivery, ...patchObj }, unlocks);
    const nextPerf = computeRigPerformanceProfile(activeRigLivery, prevTuningCtx);
    const eqDiffs = diffRigPerformanceProfiles(prevPerf, nextPerf);
    if (eqDiffs.length > 0 && itemMeta?.name) {
      lastEquipFlash = { itemName: itemMeta.name, diffs: eqDiffs, expiresAt: performance.now() + 4800 };
    } else {
      lastEquipFlash = null;
    }
    if (slot && slot !== 'all' && itemMeta?.id) {
      if (slot === 'chroma') {
        pinnedInspect = {
          slot: 'chroma',
          field: 'dyeId',
          item: getGearChroma(itemMeta.id),
          unlocked: true,
          justEquipped: true,
        };
      } else {
        pinnedInspect = null;
        markEntrySeen(`${slot}:${itemMeta.id}`);
      }
    } else {
      pinnedInspect = null;
    }
    if (slot === 'scooter' && patchObj && Object.prototype.hasOwnProperty.call(patchObj, 'scooterId')) {
      try {
        const savedGearLoadout = getSavedGearLoadout();
        if (savedGearLoadout) {
          savedGearLoadout.dpv = patchObj.scooterId !== 'none';
          liveryPreviewDpv = null;
          saveGearLoadout();
          renderTechGearDock();
        }
      } catch {}
    }
    triggerEquipAnimation(slot, itemMeta, { silentAudio });
    saveRigLivery();
    syncLiveryUi();
    renderLiveryWorkshopModal();
  }

  function tryOnLockedItem(slot, field, item) {
    if (!item) return;
    hoveredGear = null;
    lockedTryOn = {
      slot,
      field,
      id: item.id,
      patch: { [field]: item.id },
      name: item.name,
      hint: item.unlockHint || 'Locked',
      tier: item.tier || 'uncommon',
    };
    pinnedInspect = { slot, field, item, unlocked: false, justEquipped: false };
    triggerEquipAnimation(slot, item, { silentAudio: false });
    renderLiveryWorkshopModal();
  }

  function tryOnFullSet(setObj) {
    if (!setObj) return;
    hoveredGear = null;
    pinnedInspect = null;
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
    const isInspected = Boolean(pinnedInspect && !pinnedInspect.justEquipped && pinnedInspect.slot === slot && pinnedInspect.item?.id === item.id);
    const justPop = justEquippedKey === key;
    const prog = !unlocked ? getGearItemProgress(item, stats) : null;
    const pct = prog ? Math.round((prog.pct || 0) * 100) : 0;
    const itemStats = getGearItemStats(slot, item);
    const tuningCtx = getWorkshopTuningCtx(workshopTuningMode);
    const impact = !selected ? evaluateLootUpgradeImpact(activeRigLivery, slot, item.id, tuningCtx) : null;
    const hasSetBoost = Boolean(impact?.setChanges?.some((sc) => sc.positive));
    const impactBadge = selected || !impact || impact.isNormalized
      ? ''
      : hasSetBoost
        ? `<span class="livery-impact-tag tag-set" title="Advances or activates a Gear Set bonus">✦ Set</span>`
        : impact.verdict === 'upgrade'
          ? `<span class="livery-impact-tag tag-upgrade" title="Net upgrade over your currently equipped ${escapeHtml(SLOT_DISPLAY_NAMES[slot] || slot)}">▲ Upgrade</span>`
          : impact.verdict === 'tradeoff' && unlocked
            ? `<span class="livery-impact-tag tag-swap" title="Stat trade-off vs. ${escapeHtml(impact.replacedItemName)}">⇄ Swap</span>`
            : '';
    const sourceBadge =
      itemStats.source === 'world'
        ? `<span class="livery-source-pill src-world" title="${escapeHtml(itemStats.worldCache?.clue || item.unlockHint || 'Found in world')}">🗺️ World</span>`
        : itemStats.source === 'chest'
          ? `<span class="livery-source-pill src-chest${item.dropRarity === 'legendary' ? ' legendary' : item.dropRarity === 'very-rare' ? ' very-rare' : ''}" title="${escapeHtml(item.unlockHint || 'Rare random drop from Sunken Treasure Chests')}">${item.dropRarity === 'legendary' ? '🗺️ Vault / Chest' : item.dropRarity === 'very-rare' ? '🧰 Rare Chest' : '🧰 Chest'}</span>`
          : itemStats.source === 'earned'
            ? `<span class="livery-source-pill src-earned" aria-hidden="true">Earned</span>`
            : '';
    const statPillsHtml = itemStats.pills.length > 0
      ? `<span class="livery-stat-pills">${itemStats.pills.slice(0, 3).map((p) => `<span class="livery-stat-pill">${escapeHtml(p)}</span>`).join('')}</span>`
      : '';
    const powerHtml = itemStats.power
      ? `<span class="livery-power-badge" title="${escapeHtml(itemStats.power.desc)}">⚡ ${escapeHtml(itemStats.power.name)}</span>`
      : '';
    const tierBadge =
      tierMeta.rank >= 3
        ? `<span class="livery-tier-pill tier-${tierMeta.id}">${tierMeta.badge}</span>`
        : '';
    const newBadge = isNew ? `<span class="livery-new-badge">NEW</span>` : '';
    const cardTitle = [
      item.name,
      impact && !selected && !impact.isNormalized ? `${impact.verdictIcon} ${impact.verdictLabel} vs. ${impact.replacedItemName}` : '',
      item.fx ? `Visual FX: ${item.fx.name} — ${item.fx.desc}` : '',
      !unlocked ? item.unlockHint : '',
    ].filter(Boolean).join(' · ');
    const progLabel = prog?.label || item.unlockHint || 'Locked';
    const isDupHint = !unlocked && progLabel.trim() === String(item.unlockHint || '').trim();
    const progressHtml = !unlocked
      ? `<span class="livery-prog-wrap" aria-label="Progress ${pct}%">
          <span class="livery-prog-track"><span class="livery-prog-fill tier-${tierMeta.id}" style="width:${pct}%"></span></span>
          <span class="livery-prog-label">${escapeHtml(isDupHint ? `🔒 ${progLabel}` : progLabel)}${isTrying ? ' · Previewing' : ''}</span>
        </span>`
      : '';
    const metaHtml = unlocked
      ? `<span class="livery-swatch-meta">${escapeHtml(selected ? '✓ Equipped' : unlockedMeta)}</span>`
      : isDupHint
        ? ''
        : `<span class="livery-swatch-meta">${escapeHtml(`🔒 ${item.unlockHint}`)}</span>`;

    return `<button type="button" class="livery-swatch-btn tier-${tierMeta.id}${selected ? ' active' : ''}${unlocked ? '' : ' locked'}${isTrying ? ' trying' : ''}${isInspected ? ' inspecting' : ''}${item.fx ? ' has-fx' : ''}${justPop ? ' equip-pop' : ''}" data-slot="${slot}" data-field="${field}" data-item-id="${item.id}" data-unlocked="${unlocked ? '1' : '0'}" title="${escapeHtml(cardTitle)}" role="radio" aria-checked="${selected}">
      <span class="livery-swatch-chip" style="${chipStyle}" aria-hidden="true">${chipContent}</span>
      <span class="livery-swatch-copy">
        <span class="livery-swatch-top">
          <span class="livery-swatch-name">${escapeHtml(item.name)}</span>
          ${newBadge}${impactBadge}${sourceBadge}${tierBadge}
          <span class="livery-inspect-btn" role="button" tabindex="0" data-inspect-item="1" title="Inspect loadout impact &amp; spotlight on avatar" aria-label="Inspect ${escapeHtml(item.name)}">ℹ</span>
        </span>
        ${statPillsHtml}
        ${powerHtml}
        ${metaHtml}
        ${progressHtml}
      </span>
    </button>`;
  }

  function _bindGridHandlers(gridEl, list, slot, field, unlockedSet) {
    if (!gridEl) return;
    gridEl.onmouseleave = () => {
      if (hoveredGear) {
        hoveredGear = null;
        renderInspectorBar();
        renderLiveryPreviewFrame(performance.now() * 0.001);
      }
    };
    gridEl.querySelectorAll('button[data-item-id]').forEach((btn) => {
      const id = btn.getAttribute('data-item-id');
      const item = list.find((x) => x.id === id);
      if (!item) return;
      const isUnlocked = unlockedSet.has(id);

      const enterPreview = () => {
        hoveredGear = { slot, field, item, unlocked: isUnlocked };
        renderInspectorBar();
        renderLiveryPreviewFrame(performance.now() * 0.001);
      };
      btn.addEventListener('mouseenter', enterPreview);
      btn.addEventListener('focus', enterPreview);

      btn.addEventListener('click', (e) => {
        if (e.target?.closest?.('[data-inspect-item]')) {
          e.preventDefault();
          e.stopPropagation();
          hoveredGear = null;
          if (!isUnlocked) {
            tryOnLockedItem(slot, field, item);
          } else {
            pinnedInspect = { slot, field, item, unlocked: true, justEquipped: false };
            renderLiveryWorkshopModal();
          }
          return;
        }
        if (isUnlocked) {
          updateActiveLiveryField({ [field]: id }, { slot, itemMeta: item });
        } else {
          tryOnLockedItem(slot, field, item);
        }
      });

      btn.querySelector('[data-inspect-item]')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          hoveredGear = null;
          if (!isUnlocked) tryOnLockedItem(slot, field, item);
          else {
            pinnedInspect = { slot, field, item, unlocked: true, justEquipped: false };
            renderLiveryWorkshopModal();
          }
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
        const impact = !equipped ? evaluateLootUpgradeImpact(activeRigLivery, entry.slot, entry.item.id) : null;
        const topDeltas = impact && !impact.isNormalized
          ? (impact.deltas || []).slice(0, 3).map((d) => `${d.positive ? '▲' : '▼'} ${d.text}`).join(' · ')
          : '';
        const impactLine = equipped
          ? `<span class="debrief-unlock-impact verdict-same">✓ Equipped on Rig</span>`
          : impact && !impact.isNormalized
            ? `<span class="debrief-unlock-impact verdict-${impact.verdict}">${impact.verdictIcon} ${impact.verdict === 'upgrade' ? 'Upgrade' : impact.verdict === 'downgrade' ? 'Lower' : 'Trade-off'} vs. ${escapeHtml(impact.replacedItemName)}${topDeltas ? ` · ${escapeHtml(topDeltas)}` : ''}</span>`
            : '';
        return `<div class="debrief-unlock-chip tier-${tm.id}">
          <span class="debrief-unlock-copy">
            <span class="livery-tier-pill tier-${tm.id}">${tm.icon} ${tm.badge}</span>
            <strong>${escapeHtml(entry.item.name)}</strong>
            <span class="debrief-unlock-slot">${escapeHtml(entry.categoryLabel)}${entry.item.fx ? ` · ✦ ${escapeHtml(entry.item.fx.name)}` : ''}</span>
            ${impactLine}
          </span>
          <span class="debrief-unlock-btns">
            <button type="button" class="btn tiny ${equipped ? 'secondary' : 'primary'}" data-debrief-equip="${idx}">${equipped ? '✓ Equipped' : impact?.verdict === 'upgrade' ? '▲ Equip' : '⚡ Equip'}</button>
            <button type="button" class="btn tiny ghost" data-debrief-card="${idx}" title="Inspect Loadout Impact &amp; Collector Card">ℹ</button>
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
      (unlocks.scooters?.size || 0) +
      (unlocks.harpoons?.size || 0) +
      unlocks.patches.size;
    const overallPct = Math.min(100, Math.round((totalUnlocked / Math.max(1, totalItems)) * 100));
    const foundSet = unlocks.stats.foundGearIds || new Set();
    const worldFoundCount = WORLD_GEAR_CACHES.filter((c) => foundSet.has(`${c.slot}:${c.itemId}`)).length;
    const chestFoundCount = CHEST_GEAR_DROPS.filter((c) => foundSet.has(`${c.slot}:${c.itemId}`)).length;
    const activeLeadsCount = Array.isArray(loadCareerLogbook()?.treasureMapLeads) ? loadCareerLogbook().treasureMapLeads.length : 0;
    if (liveryUnlockSummaryEl) {
      const leadNote = activeLeadsCount > 0 ? ` · 🗺️ ${activeLeadsCount} map${activeLeadsCount === 1 ? '' : 's'}` : '';
      liveryUnlockSummaryEl.textContent = `${totalUnlocked} owned${leadNote}`;
    }

    // First-Play Expedition Welcome Crate & Starter Outfitting Stage (v222)
    const wcState = getWelcomeCrateState();
    if (btnLiveryLaunchDiveEl) {
      btnLiveryLaunchDiveEl.hidden = !wcState.isNewDiver;
    }
    if (liveryWelcomeStageEl) {
      if (!wcState.isNewDiver) {
        liveryWelcomeStageEl.hidden = true;
        liveryWelcomeStageEl.innerHTML = '';
      } else if (!wcState.claimedChoice) {
        liveryWelcomeStageEl.hidden = false;
        const previewChoiceId = lockedTryOn?.welcomeChoiceId || '';
        liveryWelcomeStageEl.innerHTML = `
          <div class="livery-welcome-head">
            <div>
              <span class="livery-welcome-kicker">🎁 EXPEDITION WELCOME CRATE · 1 FREE SPECIALTY RELIC</span>
              <div class="livery-welcome-sub">Choose your starting dive style to unlock a free Field-Tech Relic &amp; outfit your rig live in the Test Tank!</div>
            </div>
          </div>
          <div class="livery-welcome-grid">
            ${WELCOME_RELIC_CHOICES.map(
              (ch) => `<div class="livery-welcome-card arch-${ch.archetype}${previewChoiceId === ch.id ? ' previewing' : ''}">
                <div class="lwc-top">
                  <span class="lwc-title">${ch.icon} <strong>${escapeHtml(ch.title)}</strong></span>
                  <span class="livery-arch-pill arch-${ch.archetype}">${escapeHtml(ch.archetype.toUpperCase())}</span>
                </div>
                <div class="lwc-gift">🎁 Free Relic: <strong>${escapeHtml(ch.giftName)}</strong></div>
                <div class="lwc-stats">${escapeHtml(ch.giftHighlight)}</div>
                <div class="lwc-desc">${escapeHtml(ch.tagline)}</div>
                <div class="lwc-actions">
                  <button type="button" class="btn tiny secondary" data-welcome-preview="${ch.id}" title="Preview this full kit live in the Test Tank">👁 Try</button>
                  <button type="button" class="btn tiny primary upgrade-equip" data-welcome-claim="${ch.id}" title="Unlock permanently &amp; equip for Dive #1">🎁 Claim</button>
                </div>
              </div>`
            ).join('')}
          </div>
        `;
        liveryWelcomeStageEl.querySelectorAll('button[data-welcome-preview]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const cid = btn.getAttribute('data-welcome-preview');
            const ch = WELCOME_RELIC_CHOICES.find((c) => c.id === cid);
            if (!ch) return;
            lockedTryOn = {
              slot: ch.giftSlot,
              field: ch.giftField,
              id: ch.giftItemId,
              patch: { ...ch.fullRig },
              welcomeChoiceId: ch.id,
              name: `${ch.icon} ${ch.title} Welcome Kit`,
              hint: `Free Welcome Relic: ${ch.giftName}`,
              tier: 'uncommon',
            };
            const giftEntry = getGearItemBySlot(ch.giftSlot, ch.giftItemId);
            pinnedInspect = giftEntry ? { slot: ch.giftSlot, field: ch.giftField, item: giftEntry.item, unlocked: false, justEquipped: false } : null;
            triggerEquipAnimation(ch.giftSlot, { name: ch.giftName, tier: 'uncommon' });
            renderLiveryWorkshopModal();
          });
        });
        liveryWelcomeStageEl.querySelectorAll('button[data-welcome-claim]').forEach((btn) => {
          btn.addEventListener('click', () => {
            claimWelcomeRelicChoice(btn.getAttribute('data-welcome-claim'));
          });
        });
      } else {
        // Brand-new diver already claimed their Welcome Relic -> celebratory Launch Ready banner!
        const ch = wcState.claimedChoice;
        liveryWelcomeStageEl.hidden = false;
        liveryWelcomeStageEl.innerHTML = `
          <div class="livery-welcome-ready">
            <div class="lwr-copy">
              <span class="livery-welcome-kicker">✨ FIRST DIVE OUTFITTED · ${ch.icon} ${escapeHtml(ch.title.toUpperCase())}</span>
              <div class="lwr-detail">Equipped <strong>${escapeHtml(ch.giftName)}</strong> (${escapeHtml(ch.giftHighlight)}). Hunt glowing Gear Caches &amp; Sunken Brass Chests inside <strong>Cenote El Abismo</strong>!</div>
            </div>
            <div class="lwr-actions">
              <button type="button" class="btn tiny primary upgrade-equip" id="btn-welcome-launch-dive">🤿 Launch Dive #1 →</button>
              <button type="button" class="btn tiny secondary" id="btn-welcome-field-test">🧪 Test Rig</button>
            </div>
          </div>
        `;
        liveryWelcomeStageEl.querySelector('#btn-welcome-launch-dive')?.addEventListener('click', () => {
          closeLiveryModal();
          document.getElementById('btn-play-solo')?.click();
        });
        liveryWelcomeStageEl.querySelector('#btn-welcome-field-test')?.addEventListener('click', () => {
          startFieldTestDive();
        });
      }
    }

    // Live Rig Performance Stat Sheet & Diablo III Try-On Compare Deltas, Mode/Difficulty Tuned (v216–v222)
    const previewRigForPerf = getDisplayedRigLivery();
    const wsTuningCtx = getWorkshopTuningCtx(workshopTuningMode);
    const basePerf = computeRigPerformanceProfile(activeRigLivery, wsTuningCtx);
    const viewPerf = lockedTryOn ? computeRigPerformanceProfile(previewRigForPerf, wsTuningCtx) : basePerf;
    const activeFlash = !lockedTryOn && lastEquipFlash && performance.now() < lastEquipFlash.expiresAt ? lastEquipFlash : null;
    const perfDiffs = lockedTryOn ? diffRigPerformanceProfiles(basePerf, viewPerf) : activeFlash ? activeFlash.diffs : [];
    if (liveryPerfPanelEl) {
      const swimPct = Math.round((viewPerf.swimSpeedMult - 1) * 100);
      const gasPct = Math.round((1 - viewPerf.gasBurnMult) * 100);
      const siltPct = Math.round((1 - viewPerf.siltStirMult) * 100);
      const decoPct = Math.round((viewPerf.decoOffgasMult - 1) * 100);
      const beamPct = Math.round((viewPerf.torchReachMult - 1) * 100);
      const coldPct = Math.round(viewPerf.coldResist * 100);
      const armorPct = Math.round(viewPerf.bumpArmor * 100);
      const shieldMax = Math.round(viewPerf.shieldMax || 0);
      const stealthPct = Math.round((viewPerf.stealth || 0) * 100);

      const extraRes = [];
      if (shieldMax > 0) extraRes.push(`+${shieldMax} Shld`);
      if (armorPct > 0) extraRes.push(`${armorPct}% Arm`);
      if (coldPct >= 99) extraRes.push('Cold-Proof');
      else if (coldPct > 0) extraRes.push(`${coldPct}% Cold`);
      if (stealthPct > 0) extraRes.push(`${stealthPct}% Stealth`);

      const bars = [
        { lbl: '⚡ Swim', val: swimPct > 0 ? `+${swimPct}%` : '—', active: swimPct > 0 || viewPerf.dpvSpeedBonus > 0, cls: 'c-cyan' },
        { lbl: '🌊 Gas', val: gasPct > 0 || viewPerf.bonusStartBar > 0 ? `${gasPct > 0 ? `-${gasPct}%` : ''}${gasPct > 0 && viewPerf.bonusStartBar > 0 ? ' ' : ''}${viewPerf.bonusStartBar > 0 ? `+${viewPerf.bonusStartBar}b` : ''}` : '—', active: gasPct > 0 || viewPerf.bonusStartBar > 0, cls: 'c-emerald' },
        { lbl: '🌫️ Silt', val: siltPct > 0 ? `-${siltPct}%` : '—', active: siltPct > 0, cls: 'c-teal' },
        { lbl: '⏱️ Deco', val: decoPct > 0 || viewPerf.narcDepthBonusM > 0 ? `${decoPct > 0 ? `+${decoPct}%` : ''}${decoPct > 0 && viewPerf.narcDepthBonusM > 0 ? ' ' : ''}${viewPerf.narcDepthBonusM > 0 ? `+${viewPerf.narcDepthBonusM}m` : ''}` : '—', active: decoPct > 0 || viewPerf.narcDepthBonusM > 0, cls: 'c-amber' },
        { lbl: '🛡️ Combat', val: viewPerf.combatMaxHpBonus > 0 || shieldMax > 0 || armorPct > 0 ? `${100 + viewPerf.combatMaxHpBonus} HP${shieldMax > 0 ? ` · +${shieldMax}S` : ''}` : '100 HP', active: viewPerf.combatMaxHpBonus > 0 || shieldMax > 0 || armorPct > 0, cls: 'c-rose' },
        { lbl: '🔦 Beam', val: beamPct > 0 || viewPerf.siltPierce > 0 ? `+${beamPct}%${viewPerf.siltPierce >= 0.2 ? ` · ${Math.round(viewPerf.siltPierce * 100)}%P` : ''}` : '—', active: beamPct > 0 || viewPerf.siltPierce > 0, cls: 'c-violet' },
      ];
      const curModeSpec = WORKSHOP_TUNING_MODES.find((m) => m.id === workshopTuningMode) || WORKSHOP_TUNING_MODES[1];
      const tuningOpenAttr = workshopTuningMode !== 'standard' ? ' open' : '';
      const tuningStripHtml = `<details class="livery-disclosure livery-tuning-disclosure"${tuningOpenAttr}>
        <summary class="livery-disclosure-sum subtle">
          <span>${curModeSpec.icon} ${curModeSpec.label}</span>
          <span class="livery-disclosure-caret">▾</span>
        </summary>
        <div class="livery-tuning-bar" role="radiogroup" aria-label="Preview stats by Mode and Difficulty">
          ${WORKSHOP_TUNING_MODES.map(
            (m) => `<button type="button" class="livery-tuning-pill${workshopTuningMode === m.id ? ' active' : ''}" data-tuning-mode="${m.id}">${m.icon} ${m.label}</button>`
          ).join('')}
          <span class="livery-tuning-badge" title="${escapeHtml(viewPerf.tuning?.summary || '')}">${escapeHtml(viewPerf.tuning?.badge || '')}</span>
        </div>
      </details>`;
      const deltaHtml = perfDiffs.length > 0
        ? `<div class="livery-perf-deltas${activeFlash ? ' is-equip-flash' : ''}">${activeFlash ? `<span class="livery-flash-tag">✓ ${escapeHtml(activeFlash.itemName)}</span>` : ''}${perfDiffs
            .slice(0, 5)
            .map((d) => `<span class="livery-delta-chip ${d.positive ? 'pos' : 'neg'}">${d.positive ? '▲' : '▼'} ${escapeHtml(d.text)}</span>`)
            .join('')}</div>`
        : '';
      const powersHtml = viewPerf.tuning?.isNormalized
        ? `<div class="livery-perf-powers empty">🧭 Purist — normalized stats</div>`
        : (viewPerf.powers.length > 0 || extraRes.length > 0)
          ? `<div class="livery-perf-powers">${extraRes
              .map((r) => `<span class="livery-perf-res-chip">${escapeHtml(r)}</span>`)
              .join('')}${viewPerf.powers
              .slice(0, 4)
              .map((p) => `<span class="livery-perf-power-chip src-${escapeHtml(p.source || 'item')}" title="${escapeHtml(p.desc)}">⚡ ${escapeHtml(p.name)}</span>`)
              .join('')}</div>`
          : '';
      const setBonusHtml = viewPerf.activeSets.length > 0
        ? `<div class="livery-perf-sets">${viewPerf.activeSets
            .map((as) => `<span class="livery-perf-set-pill${as.capstoneActive ? ' capstone' : ''}" style="--set-color:${as.color}">
              ${as.icon} <strong>${escapeHtml(as.name)} (${as.matched}/${as.capstoneReq})</strong> · ${escapeHtml(as.capstoneActive ? as.tierFullLabel : as.tier2Label)}
            </span>`)
            .join('')}</div>`
        : '';

      liveryPerfPanelEl.innerHTML = `
        <div class="livery-perf-compact-grid">
          ${bars
            .map(
              (b) => `<div class="livery-perf-stat ${b.cls}${b.active ? ' is-boosted' : ' is-base'}">
                <span class="livery-perf-stat-lbl">${b.lbl}</span>
                <strong class="livery-perf-stat-val">${escapeHtml(b.val)}</strong>
              </div>`
            )
            .join('')}
        </div>
        ${deltaHtml}
        ${setBonusHtml}
        ${powersHtml}
        ${tuningStripHtml}
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

    // v231 Clean Equipped-Only Workshop: hide undiscovered progression spoilers, ONLY surface newly earned unlocks banner if any!
    if (liveryLadderRailEl) {
      const unseenNow = getUnseenEntries(unlocks);
      if (unseenNow.length > 0) {
        liveryLadderRailEl.hidden = false;
        liveryLadderRailEl.innerHTML = `<button type="button" class="livery-unseen-banner" id="btn-livery-view-unseen">
          <span>🎁 <strong>${unseenNow.length} New Gear Unlock${unseenNow.length > 1 ? 's' : ''}</strong> Ready to Inspect &amp; Equip!</span>
          <span class="livery-unseen-cta">Open Card →</span>
        </button>`;
        liveryLadderRailEl.querySelector('#btn-livery-view-unseen')?.addEventListener('click', () => {
          unlockShowcase.openShowcase(unseenNow);
        });
      } else {
        liveryLadderRailEl.hidden = true;
        liveryLadderRailEl.innerHTML = '';
      }
    }
    if (false && liveryLadderRailEl) {
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
      const setsOpenAttr = Boolean(inspectedSetId || synergyState.active) ? ' open' : '';
      const activeSetCount = viewPerf.activeSets.length;
      const setsSummaryLabel = activeSetCount > 0
        ? `✨ Gear Sets &amp; Next Unlocks · ${activeSetCount} Active`
        : `✨ Gear Sets &amp; Next Unlocks (${visibleSets.length} Sets)`;
      const ladderDrawer = `<details class="livery-disclosure livery-sets-disclosure"${setsOpenAttr}>
        <summary class="livery-disclosure-sum">
          <span>${setsSummaryLabel}</span>
          <span class="livery-disclosure-caret">▾</span>
        </summary>
        <div class="livery-disclosure-body">${setStrip}${nextChips}</div>
      </details>`;
      liveryLadderRailEl.innerHTML = `${tryOnBanner}${unseenBanner}${ladderDrawer}`;
      liveryLadderRailEl.querySelector('#btn-livery-clear-tryon')?.addEventListener('click', () => {
        lockedTryOn = null;
        pinnedInspect = null;
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

    const _slotConfigs = [
      { slot: 'suit', field: 'suitId', setKey: 'suits', icon: '🤿', label: 'Drysuit', list: SUIT_LIVERIES, equipped: pal.suit },
      { slot: 'trim', field: 'trimId', setKey: 'trims', icon: '⚡', label: 'Harness & Fins', list: ACCENT_TRIMS, equipped: pal.trimSpec },
      { slot: 'headgear', field: 'headgearId', setKey: 'headgears', icon: '⛑️', label: 'Headgear', list: HEADGEAR_STYLES, equipped: pal.headgear },
      { slot: 'visor', field: 'visorId', setKey: 'visors', icon: '🕶️', label: 'Mask Visor', list: VISOR_TINTS, equipped: pal.visor },
      { slot: 'tank', field: 'tankId', setKey: 'tanks', icon: '🛢', label: 'Twin Tanks', list: TANK_FINISHES, equipped: pal.tank },
      { slot: 'torch', field: 'torchId', setKey: 'torches', icon: '🔦', label: 'Primary Torch', list: TORCH_OPTICS, equipped: pal.torch },
      { slot: 'scooter', field: 'scooterId', setKey: 'scooters', icon: '🛴', label: 'DPV Scooter', list: SCOOTER_MODELS, equipped: pal.scooter },
      { slot: 'harpoon', field: 'harpoonId', setKey: 'harpoons', icon: '🔱', label: 'Harpoon', list: HARPOON_MODELS, equipped: pal.harpoon },
      { slot: 'patch', field: 'patchId', setKey: 'patches', icon: '🎖️', label: 'Expedition Crest', list: MILESTONE_PATCHES, equipped: pal.patch },
    ];

    const careerBook = loadCareerLogbook();

    // v232 Image-Focused Equipped Gear Grid: crisp custom hardware artwork + only the stats that matter, zero noise!
    if (liveryEquippedGridEl) {
      const slotCardsHtml = _slotConfigs
        .map((cfg) => {
          const item = cfg.equipped;
          const tierMeta = getGearTierMeta(item?.tier);
          const itemStats = getGearItemStats(cfg.slot, item);
          const artSvg = renderGearArtworkSvg(cfg.slot, item, { suitFallback: pal.suit, size: 74 });
          const ownedSet = unlocks[cfg.setKey];
          const ownedCount = ownedSet instanceof Set ? ownedSet.size : 1;
          const altCount = Math.max(0, ownedCount - 1);
          const soldCount = Array.from(unlocks.soldGear || []).filter((k) => k.startsWith(`${cfg.slot}:`)).length;
          const hasUnseenInSlot = Array.from(ownedSet || []).some(
            (id) => id !== item?.id && !seenUnlockKeys.has(`${cfg.slot}:${id}`) && getGearItemBySlot(cfg.slot, id)?.item?.tier !== 'common'
          );
          const cornerBadge = hasUnseenInSlot
            ? `<span class="livery-card-badge is-new">NEW</span>`
            : altCount > 0
              ? `<span class="livery-card-badge" title="${altCount} other owned">⇄ ${altCount}</span>`
              : soldCount > 0
                ? `<span class="livery-card-badge" title="${soldCount} sold">🪙</span>`
                : '';
          const tierGem = tierMeta.id === 'legendary'
            ? `<span class="livery-card-gem is-legendary" title="Legendary">🔥</span>`
            : tierMeta.id === 'mythic'
              ? `<span class="livery-card-gem is-mythic" title="Mythic Relic">✦</span>`
              : '';
          const statItems = itemStats.pills.slice(0, 2).map((p) => `<span class="livery-stat-pill">${escapeHtml(p)}</span>`);
          if (itemStats.power) {
            statItems.push(`<span class="livery-power-badge" title="${escapeHtml(itemStats.power.desc)}">⚡ ${escapeHtml(itemStats.power.name)}</span>`);
          }
          const statsHtml = statItems.length > 0
            ? `<span class="livery-card-stats">${statItems.slice(0, 3).join('')}</span>`
            : '';
          return `<button type="button" class="livery-equipped-card tier-${tierMeta.id}${hasUnseenInSlot ? ' has-new-alt' : ''}" data-open-slot="${cfg.slot}" data-item-id="${escapeHtml(item?.id || '')}" title="${escapeHtml(`${cfg.label}: ${item?.name || 'Standard Issue'}`)}">
            <span class="livery-card-stage">
              ${tierGem}
              ${cornerBadge}
              ${artSvg}
            </span>
            <span class="livery-card-body">
              <span class="livery-card-slot">${escapeHtml(cfg.label)}</span>
              <span class="livery-card-name">${escapeHtml(item?.name || 'Standard Issue')}</span>
              ${statsHtml}
            </span>
          </button>`;
        })
        .join('');

      const activeChroma = getGearChroma(activeRigLivery.dyeId || 'none');
      const chromaArtSvg = renderGearArtworkSvg('chroma', activeChroma, { size: 74 });
      const chromaCardHtml = `<button type="button" class="livery-equipped-card livery-equipped-chroma-card" data-open-chroma="1" title="Color & FX Coating">
        <span class="livery-card-stage">
          <span class="livery-card-badge">🎨</span>
          ${chromaArtSvg}
        </span>
        <span class="livery-card-body">
          <span class="livery-card-slot">Color Coat</span>
          <span class="livery-card-name">${escapeHtml(activeChroma.name)}</span>
          ${activeChroma.fxName ? `<span class="livery-card-stats"><span class="livery-power-badge">✦ ${escapeHtml(activeChroma.fxName)}</span></span>` : ''}
        </span>
      </button>`;

      liveryEquippedGridEl.innerHTML = `${slotCardsHtml}${chromaCardHtml}`;
      liveryEquippedGridEl.querySelectorAll('button[data-open-slot]').forEach((btn) => {
        const slot = btn.getAttribute('data-open-slot');
        const cfg = _slotConfigs.find((c) => c.slot === slot);
        if (!cfg) return;
        btn.addEventListener('mouseenter', () => {
          hoveredGear = { slot: cfg.slot, field: cfg.field, item: cfg.equipped, unlocked: true };
          renderLiveryPreviewFrame(performance.now() * 0.001);
        });
        btn.addEventListener('mouseleave', () => {
          hoveredGear = null;
          renderLiveryPreviewFrame(performance.now() * 0.001);
        });
        btn.addEventListener('click', () => {
          openGearSlotModal(slot);
        });
      });
      liveryEquippedGridEl.querySelector('button[data-open-chroma]')?.addEventListener('click', () => {
        setLiveryActiveTab('chroma');
      });
    }

    // v232 Image-Focused Active Treasure Map Leads: compact visual lead + 1-tap Dive Launch!
    const activeMapLeads = Array.isArray(careerBook?.treasureMapLeads) ? careerBook.treasureMapLeads : [];
    if (liveryTreasureMapsSectionEl) {
      if (activeMapLeads.length > 0) {
        liveryTreasureMapsSectionEl.hidden = false;
        liveryTreasureMapsSectionEl.innerHTML = `
          <div class="livery-section-label">🗺️ TREASURE MAPS (${activeMapLeads.length})</div>
          <div class="livery-map-leads-grid">
            ${activeMapLeads
              .map((lead) => {
                const mapArt = renderGearArtworkSvg('treasure-map', lead, { size: 54 });
                return `<div class="livery-map-lead-card" style="--tm-col:${escapeHtml(lead.color || '#facc15')}">
                  <div class="livery-map-lead-art">${mapArt}</div>
                  <div class="livery-map-lead-copy">
                    <div class="livery-map-lead-title">${escapeHtml(lead.hintTitle || `Uncharted ${lead.hintSlotLabel || 'Gear'}`)}</div>
                    <div class="livery-map-lead-meta">
                      <span class="livery-map-lead-badge">${escapeHtml(lead.skillIcon || '🗺️')} ${escapeHtml(lead.skillShort || lead.skillLabel || 'SKILL')}</span>
                      <span class="livery-map-lead-site">📍 ${escapeHtml(lead.siteName || lead.levelId)}</span>
                    </div>
                  </div>
                  <button type="button" class="btn tiny primary livery-map-dive-btn" data-map-dive-level="${escapeHtml(lead.levelId)}">🤿 Dive →</button>
                </div>`;
              })
              .join('')}
          </div>
        `;
        liveryTreasureMapsSectionEl.querySelectorAll('button[data-map-dive-level]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-map-dive-level');
            const targetLvl = LEVELS.find((l) => l.id === targetId);
            if (!targetLvl) return;
            closeGearSlotModal();
            closeLiveryModal();
            if (typeof launchSiteDive === 'function') {
              launchSiteDive(targetLvl);
            } else {
              document.getElementById('btn-play-solo')?.click();
            }
          });
        });
      } else {
        liveryTreasureMapsSectionEl.hidden = true;
        liveryTreasureMapsSectionEl.innerHTML = '';
      }
    }
    if (liveryDiscoveryWhisperEl) {
      liveryDiscoveryWhisperEl.hidden = true;
      liveryDiscoveryWhisperEl.textContent = '';
    }

    // Keep open Slot Comparison Modal synced whenever Workshop re-renders (e.g. after Equip/Sell/Buyback)
    if (activeCompareSlot && gearSlotModalEl && !gearSlotModalEl.hidden) {
      renderGearSlotModal();
    }

    // Salvage Doubloons Wallet & Gear Color / Animated Coating Foundry (v229 / v232)
    const doubloonsBal = Math.max(0, Math.round(Number(careerBook?.doubloons) || 0));
    if (liveryWalletPillEl) {
      liveryWalletPillEl.textContent = `🪙 ${doubloonsBal.toLocaleString()}`;
    }
    const activeDyeId = activeRigLivery.dyeId || 'none';
    const renderChromaCard = (ch) => {
      const owned = unlocks.dyes?.has(ch.id) || ch.id === 'none';
      const selected = activeDyeId === ch.id;
      const eligible = isChromaExclusiveEligible(ch, unlocks.stats);
      const canAfford = doubloonsBal >= ch.cost;
      const isInspected = Boolean(pinnedInspect && !pinnedInspect.justEquipped && pinnedInspect.slot === 'chroma' && pinnedInspect.item?.id === ch.id);
      const orbSvg = renderGearArtworkSvg('chroma', ch, { size: 46 });
      const priceTag = selected
        ? `<span class="livery-chroma-price is-active">✓</span>`
        : owned
          ? `<span class="livery-chroma-price is-owned">Owned</span>`
          : !eligible
            ? `<span class="livery-chroma-price is-locked">🔒 ${ch.cost}</span>`
            : `<span class="livery-chroma-price${canAfford ? ' is-affordable' : ' is-short'}">🪙 ${ch.cost}</span>`;
      const subLine = ch.fxName
        ? `<span class="livery-power-badge">✦ ${escapeHtml(ch.fxName)}</span>`
        : (!owned && !eligible && ch.requirementHint)
          ? `<span class="livery-swatch-meta">🔒 ${escapeHtml(ch.requirementHint)}</span>`
          : '';
      return `<button type="button" class="livery-swatch-btn livery-chroma-card chroma-${ch.tier}${selected ? ' active' : ''}${owned ? '' : ' locked'}${isInspected ? ' inspecting' : ''}${ch.animated ? ' has-fx' : ''}" data-chroma-id="${ch.id}" data-owned="${owned ? '1' : '0'}" title="${escapeHtml(`${ch.name} — ${ch.desc}`)}" role="radio" aria-checked="${selected}">
        <span class="livery-chroma-orb" aria-hidden="true">${orbSvg}</span>
        <span class="livery-swatch-copy">
          <span class="livery-swatch-top">
            <span class="livery-swatch-name">${escapeHtml(ch.name)}</span>
            ${priceTag}
          </span>
          ${subLine}
        </span>
      </button>`;
    };
    const bindChromaGrid = (gridEl) => {
      if (!gridEl) return;
      gridEl.onmouseleave = () => {
        if (hoveredGear?.slot === 'chroma') {
          hoveredGear = null;
          renderInspectorBar();
          renderLiveryPreviewFrame(performance.now() * 0.001);
        }
      };
      gridEl.querySelectorAll('button[data-chroma-id]').forEach((btn) => {
        const cid = btn.getAttribute('data-chroma-id');
        const ch = getGearChroma(cid);
        if (!ch) return;
        const owned = unlocks.dyes?.has(ch.id) || ch.id === 'none';
        const enterPrev = () => {
          hoveredGear = { slot: 'chroma', field: 'dyeId', item: ch, unlocked: owned };
          renderInspectorBar();
          renderLiveryPreviewFrame(performance.now() * 0.001);
        };
        btn.addEventListener('mouseenter', enterPrev);
        btn.addEventListener('focus', enterPrev);
        btn.addEventListener('click', () => {
          hoveredGear = null;
          if (owned) {
            updateActiveLiveryField(
              { dyeId: ch.id },
              { slot: 'chroma', itemMeta: { id: ch.id, name: ch.name, tier: ch.exclusive ? 'mythic' : ch.animated ? 'epic' : 'rare' } }
            );
          } else {
            // Safe 2-step purchase: 1st tap previews live on diver & shows 🪙 Buy & Apply right in the Sticky Inspector!
            lockedTryOn = null;
            pinnedInspect = { slot: 'chroma', field: 'dyeId', item: ch, unlocked: false, justEquipped: false };
            triggerEquipAnimation('chroma', { id: ch.id, name: ch.name, tier: ch.exclusive ? 'mythic' : ch.animated ? 'epic' : 'rare' }, { isPreview: true });
            renderLiveryWorkshopModal();
          }
        });
      });
    };
    const baseChromas = GEAR_CHROMA_FINISHES.filter((c) => !c.animated);
    const animChromas = GEAR_CHROMA_FINISHES.filter((c) => c.animated);
    if (liveryChromaGridEl) {
      liveryChromaGridEl.innerHTML = baseChromas.map(renderChromaCard).join('');
      bindChromaGrid(liveryChromaGridEl);
    }
    if (liveryChromaAnimGridEl) {
      liveryChromaAnimGridEl.innerHTML = animChromas.map(renderChromaCard).join('');
      bindChromaGrid(liveryChromaAnimGridEl);
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

  function renderGearSlotModal() {
    if (!gearSlotModalEl || !activeCompareSlot) return;
    const unlocks = getCurrentLiveryUnlocks();
    const pal = resolveDiverLiveryPalette(activeRigLivery);
    const tuningCtx = getWorkshopTuningCtx(workshopTuningMode);
    const slotDefs = {
      suit: { slot: 'suit', field: 'suitId', setKey: 'suits', icon: '🤿', label: 'Drysuit', list: SUIT_LIVERIES, equipped: pal.suit },
      trim: { slot: 'trim', field: 'trimId', setKey: 'trims', icon: '⚡', label: 'Harness & Fins', list: ACCENT_TRIMS, equipped: pal.trimSpec },
      headgear: { slot: 'headgear', field: 'headgearId', setKey: 'headgears', icon: '⛑️', label: 'Headgear', list: HEADGEAR_STYLES, equipped: pal.headgear },
      visor: { slot: 'visor', field: 'visorId', setKey: 'visors', icon: '🕶️', label: 'Mask Visor', list: VISOR_TINTS, equipped: pal.visor },
      tank: { slot: 'tank', field: 'tankId', setKey: 'tanks', icon: '🛢', label: 'Twin Tanks', list: TANK_FINISHES, equipped: pal.tank },
      torch: { slot: 'torch', field: 'torchId', setKey: 'torches', icon: '🔦', label: 'Primary Torch', list: TORCH_OPTICS, equipped: pal.torch },
      scooter: { slot: 'scooter', field: 'scooterId', setKey: 'scooters', icon: '🛴', label: 'DPV Scooter', list: SCOOTER_MODELS, equipped: pal.scooter },
      harpoon: { slot: 'harpoon', field: 'harpoonId', setKey: 'harpoons', icon: '🔱', label: 'Harpoon', list: HARPOON_MODELS, equipped: pal.harpoon },
      patch: { slot: 'patch', field: 'patchId', setKey: 'patches', icon: '🎖️', label: 'Expedition Crest', list: MILESTONE_PATCHES, equipped: pal.patch },
    };
    const cfg = slotDefs[activeCompareSlot];
    if (!cfg) return;

    const eqItem = cfg.equipped;
    const eqTier = getGearTierMeta(eqItem?.tier);
    const eqStats = getGearItemStats(cfg.slot, eqItem);
    const ownedSet = unlocks[cfg.setKey] instanceof Set ? unlocks[cfg.setKey] : new Set();
    // Strictly ONLY gear the player owns for this slot (excluding currently equipped)!
    const otherOwned = cfg.list
      .filter((it) => ownedSet.has(it.id) && it.id !== eqItem?.id)
      .sort((a, b) => (getGearTierMeta(b.tier).rank - getGearTierMeta(a.tier).rank) || ((b.ladderRank || 0) - (a.ladderRank || 0)));

    // Any previously sold Milestone/Secret items for this slot (for Buyback!)
    const soldForSlot = cfg.list.filter((it) => unlocks.soldGear?.has(`${cfg.slot}:${it.id}`));

    if (gearSlotModalTitleEl) gearSlotModalTitleEl.textContent = `${cfg.icon} ${cfg.label}`;
    if (gearSlotModalSubEl) {
      gearSlotModalSubEl.textContent = `${otherOwned.length + 1} owned`;
    }

    const eqKey = `${cfg.slot}:${eqItem?.id || ''}`;
    const eqSellVal = isGearSellable(eqItem) ? getGearSellValue(eqItem?.tier) : 0;
    const eqConfirm = pendingSellKey === eqKey;
    const eqSellBtn = eqSellVal > 0
      ? eqConfirm
        ? `<button type="button" class="btn tiny danger" data-slot-sell-confirm="${escapeHtml(eqItem.id)}">Confirm +${eqSellVal} 🪙</button>`
        : `<button type="button" class="btn tiny ghost livery-sell-btn" data-slot-sell="${escapeHtml(eqItem.id)}" title="Sell for +${eqSellVal} Doubloons">🪙 ${eqSellVal}</button>`
      : '';

    if (gearSlotEquippedHeroEl) {
      const eqArt = renderGearArtworkSvg(cfg.slot, eqItem, { suitFallback: pal.suit, size: 76 });
      const eqPills = eqStats.pills.slice(0, 5).map((p) => `<span class="livery-stat-pill">${escapeHtml(p)}</span>`);
      if (eqStats.power) {
        eqPills.push(`<span class="livery-power-badge" title="${escapeHtml(eqStats.power.desc)}">⚡ ${escapeHtml(eqStats.power.name)}</span>`);
      }
      const eqTierBadge = eqTier.rank >= 3
        ? `<span class="livery-tier-pill tier-${eqTier.id}">${eqTier.badge}</span>`
        : '';
      gearSlotEquippedHeroEl.className = `gear-slot-equipped-hero tier-${eqTier.id}`;
      gearSlotEquippedHeroEl.innerHTML = `
        <div class="gear-slot-art-box is-hero">${eqArt}</div>
        <div class="gear-slot-hero-body">
          <div class="gear-slot-hero-top">
            <span class="gear-slot-hero-badge">✓ EQUIPPED</span>
            ${eqTierBadge}
          </div>
          <div class="gear-slot-hero-name">${escapeHtml(eqItem?.name || 'Standard Issue')}</div>
          ${eqPills.length > 0 ? `<div class="livery-stat-pills">${eqPills.join('')}</div>` : ''}
        </div>
        ${eqSellBtn ? `<div class="gear-slot-cmp-actions">${eqSellBtn}</div>` : ''}
      `;
    }

    if (gearSlotOwnedHeadingEl) {
      gearSlotOwnedHeadingEl.hidden = otherOwned.length === 0;
      gearSlotOwnedHeadingEl.textContent = `OWNED (${otherOwned.length})`;
    }

    if (gearSlotOwnedListEl) {
      if (otherOwned.length === 0) {
        gearSlotOwnedListEl.innerHTML = `<div class="gear-slot-empty">No other ${escapeHtml(cfg.label.toLowerCase())} owned yet.</div>`;
      } else {
        gearSlotOwnedListEl.innerHTML = otherOwned
          .map((item) => {
            const tierMeta = getGearTierMeta(item.tier);
            const itemStats = getGearItemStats(cfg.slot, item);
            const impact = evaluateLootUpgradeImpact(activeRigLivery, cfg.slot, item.id, tuningCtx);
            const key = `${cfg.slot}:${item.id}`;
            const sellVal = isGearSellable(item) ? getGearSellValue(item.tier) : 0;
            const isConfirm = pendingSellKey === key;
            const itemArt = renderGearArtworkSvg(cfg.slot, item, { suitFallback: pal.suit, size: 66 });

            // Unified single stat row: show net deltas vs. equipped (no triple repetition!)
            const statChips = [];
            if (impact && !impact.isNormalized) {
              for (const sc of impact.setChanges || []) {
                statChips.push(`<span class="livery-insp-pill ${sc.positive ? 'pos' : 'neg'} is-set">${sc.positive ? '✦' : '⚠'} ${escapeHtml(sc.text)}</span>`);
              }
              for (const gp of impact.gainedPowers || []) {
                statChips.push(`<span class="livery-insp-pill pos is-pwr" title="${escapeHtml(gp.desc || '')}">⚡ ${escapeHtml(gp.name)}</span>`);
              }
              for (const d of (impact.deltas || []).slice(0, 5)) {
                statChips.push(`<span class="livery-insp-pill ${d.positive ? 'pos' : 'neg'}">${d.positive ? '▲' : '▼'} ${escapeHtml(d.text)}</span>`);
              }
              for (const lp of (impact.lostPowers || []).slice(0, 1)) {
                statChips.push(`<span class="livery-insp-pill neg is-pwr" title="${escapeHtml(lp.desc || '')}">-⚡ ${escapeHtml(lp.name)}</span>`);
              }
            }
            if (statChips.length === 0 && itemStats.pills.length > 0) {
              for (const p of itemStats.pills.slice(0, 4)) {
                statChips.push(`<span class="livery-stat-pill">${escapeHtml(p)}</span>`);
              }
            }

            const tierPill = tierMeta.rank >= 3
              ? `<span class="livery-tier-pill tier-${tierMeta.id}">${tierMeta.badge}</span>`
              : '';
            const sellBtn = sellVal > 0
              ? isConfirm
                ? `<button type="button" class="btn tiny danger" data-slot-sell-confirm="${escapeHtml(item.id)}">Confirm +${sellVal}</button>`
                : `<button type="button" class="btn tiny ghost livery-sell-btn" data-slot-sell="${escapeHtml(item.id)}" title="Sell for +${sellVal} Doubloons">🪙 ${sellVal}</button>`
              : '';
            return `<div class="gear-slot-cmp-card tier-${tierMeta.id}" data-cmp-item-id="${escapeHtml(item.id)}">
              <div class="gear-slot-art-box">${itemArt}</div>
              <div class="gear-slot-cmp-body">
                <div class="gear-slot-cmp-title-wrap">
                  <strong class="gear-slot-cmp-name">${escapeHtml(item.name)}</strong>
                  ${tierPill}
                </div>
                ${statChips.length > 0 ? `<div class="gear-slot-cmp-deltas">${statChips.slice(0, 6).join('')}</div>` : ''}
              </div>
              <div class="gear-slot-cmp-actions">
                <button type="button" class="btn tiny primary" data-slot-equip="${escapeHtml(item.id)}">Equip</button>
                ${sellBtn}
              </div>
            </div>`;
          })
          .join('');
      }
    }

    if (gearSlotBuybackWrapEl && gearSlotBuybackListEl) {
      if (soldForSlot.length > 0) {
        const bal = Math.max(0, Math.round(Number(loadCareerLogbook()?.doubloons) || 0));
        gearSlotBuybackWrapEl.hidden = false;
        gearSlotBuybackListEl.innerHTML = soldForSlot
          .map((item) => {
            const cost = getGearBuybackCost(item.tier);
            const canAfford = bal >= cost;
            const bbArt = renderGearArtworkSvg(cfg.slot, item, { suitFallback: pal.suit, size: 54 });
            return `<div class="gear-slot-cmp-card is-buyback">
              <div class="gear-slot-art-box is-sm">${bbArt}</div>
              <div class="gear-slot-cmp-body">
                <div class="gear-slot-cmp-title-wrap">
                  <strong class="gear-slot-cmp-name">${escapeHtml(item.name)}</strong>
                </div>
              </div>
              <div class="gear-slot-cmp-actions">
                <button type="button" class="btn tiny ${canAfford ? 'primary' : 'secondary'}" data-slot-buyback="${escapeHtml(item.id)}" ${canAfford ? '' : 'disabled'}>🪙 ${cost}</button>
              </div>
            </div>`;
          })
          .join('');
      } else {
        gearSlotBuybackWrapEl.hidden = true;
        gearSlotBuybackListEl.innerHTML = '';
      }
    }

    // Bind live hover preview on the pinned diver avatar + Equip, 2-step Sell & Buyback actions inside the modal
    const bindInModal = (root) => {
      if (!root) return;
      root.querySelectorAll('.gear-slot-cmp-card[data-cmp-item-id]').forEach((card) => {
        const id = card.getAttribute('data-cmp-item-id');
        const item = cfg.list.find((x) => x.id === id);
        if (!item) return;
        const enterPrev = () => {
          hoveredGear = { slot: cfg.slot, field: cfg.field, item, unlocked: true };
          renderLiveryPreviewFrame(performance.now() * 0.001);
        };
        const leavePrev = () => {
          if (hoveredGear?.item?.id === item.id) {
            hoveredGear = null;
            renderLiveryPreviewFrame(performance.now() * 0.001);
          }
        };
        card.addEventListener('mouseenter', enterPrev);
        card.addEventListener('mouseleave', leavePrev);
      });
      root.querySelectorAll('button[data-slot-equip]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-slot-equip');
          const item = cfg.list.find((x) => x.id === id);
          if (!item) return;
          pendingSellKey = null;
          hoveredGear = null;
          markEntrySeen(`${cfg.slot}:${item.id}`);
          updateActiveLiveryField({ [cfg.field]: item.id }, { slot: cfg.slot, itemMeta: item });
          renderGearSlotModal();
        });
      });
      root.querySelectorAll('button[data-slot-sell]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-slot-sell');
          pendingSellKey = `${cfg.slot}:${id}`;
          renderGearSlotModal();
        });
      });
      root.querySelectorAll('button[data-slot-sell-confirm]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-slot-sell-confirm');
          const item = cfg.list.find((x) => x.id === id);
          if (item) sellGearItem(cfg.slot, cfg.field, item);
          renderGearSlotModal();
        });
      });
      root.querySelectorAll('button[data-slot-buyback]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-slot-buyback');
          const item = cfg.list.find((x) => x.id === id);
          if (item) buybackSoldGearItem(cfg.slot, cfg.field, item);
          renderGearSlotModal();
        });
      });
    };
    bindInModal(gearSlotEquippedHeroEl);
    bindInModal(gearSlotOwnedListEl);
    bindInModal(gearSlotBuybackListEl);
  }

  function openGearSlotModal(slot) {
    if (!gearSlotModalEl || !slot) return;
    activeCompareSlot = slot;
    pendingSellKey = null;
    hoveredGear = null;
    renderGearSlotModal();
    gearSlotModalEl.hidden = false;
    renderLiveryPreviewFrame(performance.now() * 0.001);
  }

  function closeGearSlotModal() {
    if (!gearSlotModalEl) return;
    activeCompareSlot = null;
    pendingSellKey = null;
    hoveredGear = null;
    gearSlotModalEl.hidden = true;
    renderLiveryPreviewFrame(performance.now() * 0.001);
  }

  btnGearSlotCloseEl?.addEventListener('click', closeGearSlotModal);
  gearSlotModalEl?.addEventListener('click', (e) => {
    if (e.target === gearSlotModalEl) closeGearSlotModal();
  });

  function openLiveryModal(initialTab = null) {
    if (!liveryModalEl) return;
    closeDiveSetupModal();
    setHomeMenuOpen(false);
    closeGearSlotModal();
    lockedTryOn = null;
    hoveredGear = null;
    pinnedInspect = null;
    if (typeof getDifficulty === 'function') {
      const curD = getDifficulty();
      if (curD === 'guided' || curD === 'standard' || curD === 'hardcore') {
        workshopTuningMode = curD;
      }
    }
    if (initialTab && liveryPanels[initialTab]) {
      activeLiveryTab = initialTab;
    } else {
      activeLiveryTab = 'equipped';
    }
    renderLiveryWorkshopModal();
    liveryModalEl.hidden = false;
  }

  function closeLiveryModal() {
    if (!liveryModalEl) return;
    closeGearSlotModal();
    lockedTryOn = null;
    hoveredGear = null;
    pinnedInspect = null;
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
  liveryWalletPillEl?.addEventListener('click', () => {
    setLiveryActiveTab('chroma');
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
    hoveredGear = null;
    pinnedInspect = null;
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
    hoveredGear = null;
    pinnedInspect = null;
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
  firstPlayWelcomeStripEl?.addEventListener('click', () => openLiveryModal('suit'));
  btnLiveryLaunchDiveEl?.addEventListener('click', () => {
    closeLiveryModal();
    document.getElementById('btn-play-solo')?.click();
  });
  btnLiveryCloseEl?.addEventListener('click', closeLiveryModal);
  btnLiveryDoneEl?.addEventListener('click', closeLiveryModal);
  liveryModalEl?.addEventListener('click', (e) => {
    if (e.target === liveryModalEl) closeLiveryModal();
  });
  btnLiveryResetEl?.addEventListener('click', () => {
    lockedTryOn = null;
    hoveredGear = null;
    pinnedInspect = null;
    activeRigLivery = { ...DEFAULT_RIG_LIVERY };
    triggerEquipAnimation('all', { name: 'Standard Issue', tier: 'common' });
    saveRigLivery();
    syncLiveryUi();
    renderLiveryWorkshopModal();
    showToast('🎨 Gear Workshop reset to Standard Issue (Zissou Tech · 6500K LED).', 2.2);
  });

  return {
    liveryModalEl,
    gearSlotModalEl,
    gearUnlockModalEl: unlockShowcase.modalEl,
    openGearSlotModal,
    closeGearSlotModal,
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
    handleTreasureMapFound,
    hideLootDiscoveryBanner,
    onExitProvingGrounds: () => {
      provingHudBar.hide();
      hideLootDiscoveryBanner();
      const prev = savedPrevLevelBeforeProving;
      savedPrevLevelBeforeProving = null;
      return prev;
    },
  };
}
