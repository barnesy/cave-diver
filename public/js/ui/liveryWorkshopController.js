import { escapeHtml } from '../util/common.js';
import { LEVELS } from '../levels/index.js';
import { computeUnlockedGear } from '../game/logbookModel.js';
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
  resolveDiverLiveryPalette,
  computeUnlockedLiveries,
  sanitizeRigLivery,
  isDefaultRigLivery,
  randomizeUnlockedLivery,
  drawLiveryPreview,
  drawMiniDiverAvatar,
} from '../game/rigLivery.js';
import { createGearUnlockShowcase } from './gearUnlockShowcase.js';

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
  const liveryLadderRailEl = document.getElementById('livery-ladder-rail');
  const liveryPresetRowEl = document.getElementById('livery-preset-row');
  const liverySavedSlotsEl = document.getElementById('livery-saved-slots');
  const btnLiveryTeamUniformEl = document.getElementById('btn-livery-team-uniform');
  const liveryCatTabsEl = document.getElementById('livery-cat-tabs');
  const liveryEnvTabsEl = document.getElementById('livery-env-tabs');
  const btnLiveryPrevCcrEl = document.getElementById('btn-livery-prev-ccr');
  const btnLiveryPrevDpvEl = document.getElementById('btn-livery-prev-dpv');
  const btnLiveryRandomEl = document.getElementById('btn-livery-random');
  const liverySuitGridEl = document.getElementById('livery-suit-grid');
  const liveryTrimGridEl = document.getElementById('livery-trim-grid');
  const liveryHeadgearGridEl = document.getElementById('livery-headgear-grid');
  const liveryVisorGridEl = document.getElementById('livery-visor-grid');
  const liveryTankGridEl = document.getElementById('livery-tank-grid');
  const liveryTorchGridEl = document.getElementById('livery-torch-grid');
  const liveryPatchGridEl = document.getElementById('livery-patch-grid');
  const liveryUnlockSummaryEl = document.getElementById('livery-unlock-summary');
  const debriefGearUnlocksEl = document.getElementById('debrief-gear-unlocks');
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

  // Kinetic equip-on-avatar animation state & locked try-on preview state (v211)
  let activeEquipFx = null;
  let justEquippedKey = '';
  let lockedTryOn = null; // { slot, field, id, name, hint, tier } | null
  let recentDiveUnlocks = [];

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

  function syncLiveryUi() {
    const pal = resolveDiverLiveryPalette(activeRigLivery);
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
    const session = getSession();
    if (session?.diver) {
      session.diver.livery = { ...activeRigLivery };
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
    const showCcr = ccrUnlocked ? hasCcr : (liveryPreviewCcr !== null ? liveryPreviewCcr : hasCcr);
    const showDpv = dpvUnlocked ? hasDpv : (liveryPreviewDpv !== null ? liveryPreviewDpv : hasDpv);

    const previewLivery = lockedTryOn
      ? { ...activeRigLivery, [lockedTryOn.field]: lockedTryOn.id }
      : activeRigLivery;

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
      name: item.name,
      hint: item.unlockHint || 'Locked',
      tier: item.tier || 'uncommon',
    };
    triggerEquipAnimation(slot, item, { silentAudio: false });
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
          ${newBadge}${tierBadge}
        </span>
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
    if (liveryUnlockSummaryEl) {
      liveryUnlockSummaryEl.textContent = `${totalUnlocked}/${totalItems} gear pieces (${overallPct}%) · ${unlocks.stats.sitesCleared} sites · ${unlocks.stats.wreckClears} wrecks · ${Math.round(unlocks.stats.deepestM || 0)}m max depth. Syncs live in co-op.`;
    }

    // Progression Ladder Rail: Next Closest Unlocks + Unseen New Unlock Callout + Locked Try-On Revert
    if (liveryLadderRailEl) {
      const unseen = getUnseenEntries(unlocks);
      const nextList = getNextGearMilestones(unlocks, 2);
      const tryOnBanner = lockedTryOn
        ? `<div class="livery-tryon-banner">
            <span>👁 Previewing locked <strong>${escapeHtml(lockedTryOn.name)}</strong> — ${escapeHtml(lockedTryOn.hint)}</span>
            <button type="button" class="btn tiny secondary" id="btn-livery-clear-tryon">↺ Equipped Rig</button>
          </div>`
        : '';
      const unseenBanner = unseen.length > 0
        ? `<button type="button" class="livery-unseen-banner" id="btn-livery-view-unseen">
            <span>🎁 <strong>${unseen.length} New Gear Unlock${unseen.length > 1 ? 's' : ''}</strong> Ready to Inspect &amp; Equip!</span>
            <span class="livery-unseen-cta">Open Card →</span>
          </button>`
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
      liveryLadderRailEl.innerHTML = `${tryOnBanner}${unseenBanner}${nextChips}`;
      liveryLadderRailEl.querySelector('#btn-livery-clear-tryon')?.addEventListener('click', () => {
        lockedTryOn = null;
        renderLiveryWorkshopModal();
      });
      liveryLadderRailEl.querySelector('#btn-livery-view-unseen')?.addEventListener('click', () => {
        unlockShowcase.openShowcase(unseen);
      });
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
  };
}
