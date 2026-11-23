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
  resolveDiverLiveryPalette,
  computeUnlockedLiveries,
  sanitizeRigLivery,
  isDefaultRigLivery,
  randomizeUnlockedLivery,
  drawLiveryPreview,
  drawMiniDiverAvatar,
} from '../game/rigLivery.js';

export const WRECK_LEVEL_ID_SET = new Set(
  LEVELS.filter((l) => Boolean(l.isWreck || l.category === 'wreck')).map((l) => l.id)
);
export const LIVERY_SLOTS_KEY = 'caveDiverLiverySlots_v1';
export const SQUAD_UNIFORM_KEY = 'caveDiverSquadUniform_v1';
const SAVED_KIT_LABELS = ['Cave Kit', 'Wreck Kit', 'Night Ops'];

/**
 * Diver Gear Workshop, Custom Rig Liveries, Test-Tank Preview & AI Squad Team Uniform (v138–v166 / modularized v172).
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

  const menuLiveryPillEl = document.getElementById('menu-livery-pill');
  const btnHomeAvatarBadgeEl = document.getElementById('btn-home-avatar-badge');
  const homeAvatarCanvasEl = document.getElementById('home-avatar-canvas');
  const homeAvatarCtx = homeAvatarCanvasEl?.getContext?.('2d') || null;
  const liveryModalEl = document.getElementById('livery-modal');
  const liveryPreviewCanvasEl = document.getElementById('livery-preview-canvas');
  const liveryPreviewCtx = liveryPreviewCanvasEl?.getContext?.('2d') || null;
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
    if (menuLiveryPillEl) {
      menuLiveryPillEl.textContent = `🎨 ${pal.suit.name}${pal.headgear.id !== 'zissou-cap' ? ` · ${pal.headgear.icon}` : ''}`;
      menuLiveryPillEl.classList.toggle('active', custom);
    }
    if (btnHomeAvatarBadgeEl) {
      btnHomeAvatarBadgeEl.classList.toggle('custom', custom);
      btnHomeAvatarBadgeEl.title = `Diver Gear: ${pal.suit.name} · ${pal.headgear.name} · ${pal.tank.name} (tap to customize)`;
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
    drawLiveryPreview(liveryPreviewCtx, liveryPreviewCanvasEl.width, liveryPreviewCanvasEl.height, activeRigLivery, {
      hasCcr: showCcr,
      hasDpv: showDpv,
      envMode: liveryPreviewEnv,
      timeSec,
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

  function updateActiveLiveryField(patchObj) {
    const unlocks = getCurrentLiveryUnlocks();
    activeRigLivery = sanitizeRigLivery({ ...activeRigLivery, ...patchObj }, unlocks);
    saveRigLivery();
    syncLiveryUi();
    renderLiveryWorkshopModal();
  }

  function renderLiveryWorkshopModal() {
    const modalCard = liveryModalEl?.querySelector?.('.livery-modal-card') || null;
    const prevScrollTop = modalCard ? modalCard.scrollTop : 0;
    const unlocks = getCurrentLiveryUnlocks();
    activeRigLivery = sanitizeRigLivery(activeRigLivery, unlocks);
    const pal = resolveDiverLiveryPalette(activeRigLivery);

    const totalItems =
      SUIT_LIVERIES.length +
      ACCENT_TRIMS.length +
      HEADGEAR_STYLES.length +
      VISOR_TINTS.length +
      TANK_FINISHES.length +
      TORCH_OPTICS.length +
      MILESTONE_PATCHES.length;
    const totalUnlocked =
      unlocks.suits.size +
      unlocks.trims.size +
      unlocks.headgears.size +
      unlocks.visors.size +
      unlocks.tanks.size +
      unlocks.torches.size +
      unlocks.patches.size;
    if (liveryUnlockSummaryEl) {
      liveryUnlockSummaryEl.textContent = `${totalUnlocked}/${totalItems} gear pieces unlocked (${unlocks.stats.sitesCleared} sites · ${unlocks.stats.wreckClears} wrecks · ${unlocks.stats.speciesLogged} species). Syncs live in co-op.`;
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
          updateActiveLiveryField(pr.livery);
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
          activeRigLivery = sanitizeRigLivery(slot, getCurrentLiveryUnlocks());
          saveRigLivery();
          syncLiveryUi();
          renderLiveryWorkshopModal();
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
      liverySuitGridEl.innerHTML = SUIT_LIVERIES.map((s) => {
        const unlocked = unlocks.suits.has(s.id);
        const selected = activeRigLivery.suitId === s.id;
        const chipStyle = `background: linear-gradient(135deg, ${s.suitTop} 0%, ${s.suitMid} 52%, ${s.accent} 53%, ${s.trim} 100%);`;
        return `<button type="button" class="livery-swatch-btn${selected ? ' active' : ''}${unlocked ? '' : ' locked'}" data-suit-id="${s.id}" ${unlocked ? '' : 'disabled'} role="radio" aria-checked="${selected}">
        <span class="livery-swatch-chip" style="${chipStyle}" aria-hidden="true">${unlocked ? '' : '🔒'}</span>
        <span class="livery-swatch-copy">
          <span class="livery-swatch-name">${escapeHtml(s.name)}</span>
          <span class="livery-swatch-meta">${escapeHtml(unlocked ? (selected ? 'Equipped' : s.unlockHint) : `Locked · ${s.unlockHint}`)}</span>
        </span>
      </button>`;
      }).join('');
      liverySuitGridEl.querySelectorAll('button[data-suit-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sid = btn.getAttribute('data-suit-id');
          if (!sid || !unlocks.suits.has(sid)) return;
          updateActiveLiveryField({ suitId: sid });
        });
      });
    }

    if (liveryTrimGridEl) {
      liveryTrimGridEl.innerHTML = ACCENT_TRIMS.map((tr) => {
        const unlocked = unlocks.trims.has(tr.id);
        const selected = pal.trimSpec.id === tr.id;
        const chipStyle =
          tr.id === 'suit-default'
            ? `background: linear-gradient(135deg, ${pal.suit.accent} 0%, ${pal.suit.trim} 100%);`
            : `background: linear-gradient(135deg, ${tr.swatchA} 0%, ${tr.swatchB} 100%);`;
        return `<button type="button" class="livery-swatch-btn${selected ? ' active' : ''}${unlocked ? '' : ' locked'}" data-trim-id="${tr.id}" ${unlocked ? '' : 'disabled'} role="radio" aria-checked="${selected}">
        <span class="livery-swatch-chip" style="${chipStyle}" aria-hidden="true">${unlocked ? '' : '🔒'}</span>
        <span class="livery-swatch-copy">
          <span class="livery-swatch-name">${escapeHtml(tr.name)}</span>
          <span class="livery-swatch-meta">${escapeHtml(unlocked ? (selected ? 'Equipped' : tr.unlockHint) : `Locked · ${tr.unlockHint}`)}</span>
        </span>
      </button>`;
      }).join('');
      liveryTrimGridEl.querySelectorAll('button[data-trim-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tid = btn.getAttribute('data-trim-id');
          if (!tid || !unlocks.trims.has(tid)) return;
          updateActiveLiveryField({ trimId: tid });
        });
      });
    }

    if (liveryHeadgearGridEl) {
      liveryHeadgearGridEl.innerHTML = HEADGEAR_STYLES.map((h) => {
        const unlocked = unlocks.headgears.has(h.id);
        const selected = pal.headgear.id === h.id;
        return `<button type="button" class="livery-swatch-btn${selected ? ' active' : ''}${unlocked ? '' : ' locked'}" data-headgear-id="${h.id}" ${unlocked ? '' : 'disabled'} role="radio" aria-checked="${selected}">
        <span class="livery-swatch-chip" style="background: rgba(15, 23, 42, 0.92);" aria-hidden="true">${unlocked ? h.icon : '🔒'}</span>
        <span class="livery-swatch-copy">
          <span class="livery-swatch-name">${escapeHtml(h.name)}</span>
          <span class="livery-swatch-meta">${escapeHtml(unlocked ? h.specText : `Locked · ${h.unlockHint}`)}</span>
        </span>
      </button>`;
      }).join('');
      liveryHeadgearGridEl.querySelectorAll('button[data-headgear-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const hid = btn.getAttribute('data-headgear-id');
          if (!hid || !unlocks.headgears.has(hid)) return;
          updateActiveLiveryField({ headgearId: hid });
        });
      });
    }

    if (liveryVisorGridEl) {
      liveryVisorGridEl.innerHTML = VISOR_TINTS.map((v) => {
        const unlocked = unlocks.visors.has(v.id);
        const selected = pal.visor.id === v.id;
        const chipStyle = `background: linear-gradient(135deg, ${v.top} 0%, ${v.mid} 50%, ${v.bot} 100%);`;
        return `<button type="button" class="livery-swatch-btn${selected ? ' active' : ''}${unlocked ? '' : ' locked'}" data-visor-id="${v.id}" ${unlocked ? '' : 'disabled'} role="radio" aria-checked="${selected}">
        <span class="livery-swatch-chip" style="${chipStyle}" aria-hidden="true">${unlocked ? '' : '🔒'}</span>
        <span class="livery-swatch-copy">
          <span class="livery-swatch-name">${escapeHtml(v.name)}</span>
          <span class="livery-swatch-meta">${escapeHtml(unlocked ? (selected ? 'Equipped' : v.unlockHint) : `Locked · ${v.unlockHint}`)}</span>
        </span>
      </button>`;
      }).join('');
      liveryVisorGridEl.querySelectorAll('button[data-visor-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const vid = btn.getAttribute('data-visor-id');
          if (!vid || !unlocks.visors.has(vid)) return;
          updateActiveLiveryField({ visorId: vid });
        });
      });
    }

    if (liveryTankGridEl) {
      liveryTankGridEl.innerHTML = TANK_FINISHES.map((tk) => {
        const unlocked = unlocks.tanks.has(tk.id);
        const selected = pal.tank.id === tk.id;
        const chipStyle = `background: linear-gradient(180deg, ${tk.top} 0%, ${tk.mid} 50%, ${tk.bot} 100%);`;
        return `<button type="button" class="livery-swatch-btn${selected ? ' active' : ''}${unlocked ? '' : ' locked'}" data-tank-id="${tk.id}" ${unlocked ? '' : 'disabled'} role="radio" aria-checked="${selected}">
        <span class="livery-swatch-chip" style="${chipStyle}" aria-hidden="true">${unlocked ? '' : '🔒'}</span>
        <span class="livery-swatch-copy">
          <span class="livery-swatch-name">${escapeHtml(tk.name)}</span>
          <span class="livery-swatch-meta">${escapeHtml(unlocked ? (selected ? 'Equipped' : tk.unlockHint) : `Locked · ${tk.unlockHint}`)}</span>
        </span>
      </button>`;
      }).join('');
      liveryTankGridEl.querySelectorAll('button[data-tank-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const kid = btn.getAttribute('data-tank-id');
          if (!kid || !unlocks.tanks.has(kid)) return;
          updateActiveLiveryField({ tankId: kid });
        });
      });
    }

    if (liveryTorchGridEl) {
      liveryTorchGridEl.innerHTML = TORCH_OPTICS.map((t) => {
        const unlocked = unlocks.torches.has(t.id);
        const selected = activeRigLivery.torchId === t.id;
        const chipStyle = `background: radial-gradient(circle at 35% 35%, #ffffff 0%, ${t.swatch} 55%, #0f172a 100%);`;
        return `<button type="button" class="livery-swatch-btn${selected ? ' active' : ''}${unlocked ? '' : ' locked'}" data-torch-id="${t.id}" ${unlocked ? '' : 'disabled'} role="radio" aria-checked="${selected}">
        <span class="livery-swatch-chip" style="${chipStyle}" aria-hidden="true">${unlocked ? '' : '🔒'}</span>
        <span class="livery-swatch-copy">
          <span class="livery-swatch-name">${escapeHtml(t.name)}</span>
          <span class="livery-swatch-meta">${escapeHtml(unlocked ? t.specText : `Locked · ${t.unlockHint}`)}</span>
        </span>
      </button>`;
      }).join('');
      liveryTorchGridEl.querySelectorAll('button[data-torch-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tid = btn.getAttribute('data-torch-id');
          if (!tid || !unlocks.torches.has(tid)) return;
          updateActiveLiveryField({ torchId: tid });
        });
      });
    }

    if (liveryPatchGridEl) {
      liveryPatchGridEl.innerHTML = MILESTONE_PATCHES.map((p) => {
        const unlocked = unlocks.patches.has(p.id);
        const selected = activeRigLivery.patchId === p.id;
        return `<button type="button" class="livery-swatch-btn${selected ? ' active' : ''}${unlocked ? '' : ' locked'}" data-patch-id="${p.id}" ${unlocked ? '' : 'disabled'} role="radio" aria-checked="${selected}">
        <span class="livery-swatch-chip" style="background: rgba(15, 23, 42, 0.9);" aria-hidden="true">${unlocked ? escapeHtml(p.icon) : '🔒'}</span>
        <span class="livery-swatch-copy">
          <span class="livery-swatch-name">${escapeHtml(p.name)}</span>
          <span class="livery-swatch-meta">${escapeHtml(unlocked ? (selected ? 'Equipped' : p.unlockHint) : p.unlockHint)}</span>
        </span>
      </button>`;
      }).join('');
      liveryPatchGridEl.querySelectorAll('button[data-patch-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pid = btn.getAttribute('data-patch-id');
          if (!pid || !unlocks.patches.has(pid)) return;
          updateActiveLiveryField({ patchId: pid });
        });
      });
    }

    setLiveryActiveTab(activeLiveryTab);
    if (btnLiveryResetEl) {
      btnLiveryResetEl.disabled = isDefaultRigLivery(activeRigLivery);
    }
    renderLiveryPreviewFrame(performance.now() * 0.001);
    if (modalCard) modalCard.scrollTop = prevScrollTop;
  }

  function openLiveryModal() {
    if (!liveryModalEl) return;
    closeDiveSetupModal();
    setHomeMenuOpen(false);
    renderLiveryWorkshopModal();
    liveryModalEl.hidden = false;
  }

  function closeLiveryModal() {
    if (!liveryModalEl) return;
    liveryModalEl.hidden = true;
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
    renderLiveryWorkshopModal();
    if (liveryPreviewDpv) {
      showToast('👁 Previewing DPV in Test Tank — unlock via Cert Ladder to equip in dives.', 2.4);
    }
  });
  btnLiveryRandomEl?.addEventListener('click', () => {
    const unlocks = getCurrentLiveryUnlocks();
    activeRigLivery = randomizeUnlockedLivery(unlocks);
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
  btnHomeAvatarBadgeEl?.addEventListener('click', openLiveryModal);
  menuLiveryPillEl?.addEventListener('click', openLiveryModal);
  btnLiveryCloseEl?.addEventListener('click', closeLiveryModal);
  btnLiveryDoneEl?.addEventListener('click', closeLiveryModal);
  liveryModalEl?.addEventListener('click', (e) => {
    if (e.target === liveryModalEl) closeLiveryModal();
  });
  btnLiveryResetEl?.addEventListener('click', () => {
    activeRigLivery = { ...DEFAULT_RIG_LIVERY };
    saveRigLivery();
    syncLiveryUi();
    renderLiveryWorkshopModal();
    showToast('🎨 Gear Workshop reset to Standard Issue (Zissou Tech · 6500K LED).', 2.2);
  });

  return {
    liveryModalEl,
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
