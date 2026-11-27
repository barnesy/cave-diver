import { escapeHtml } from '../util/common.js';
import { LEVELS } from '../levels/index.js';
import { createEmptyLogbook } from '../game/logbookModel.js';
import {
  DEFAULT_RIG_LIVERY,
  computeUnlockedLiveries,
  drawLiveryPreview,
  evaluateGearSetSynergy,
  sanitizeRigLivery,
} from '../game/rigLivery.js';
import { computeRigPerformanceProfile } from '../game/gearStats.js';
import {
  CODEX_SLOT_META,
  CODEX_SLOT_ORDER,
  buildGearCodexData,
  filterCodexSets,
  filterCodexItems,
  applyCodexItemToLivery,
  applyCodexSetToLivery,
  buildAllLegendaryPreviewRig,
} from '../game/gearCodexModel.js';
import { renderGearArtworkSvg } from './gearArtwork.js';

const CAREER_LOGBOOK_KEY = 'caveDiverLogbook_v1';
const LIVERY_PREF_KEY = 'caveDiverLivery_v1';
const WRECK_LEVEL_ID_SET = new Set(
  LEVELS.filter((l) => Boolean(l.isWreck || l.category === 'wreck')).map((l) => l.id)
);

function loadSavedLogbook() {
  try {
    const raw = localStorage.getItem(CAREER_LOGBOOK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return createEmptyLogbook();
}

function loadSavedLivery() {
  try {
    const raw = localStorage.getItem(LIVERY_PREF_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return sanitizeRigLivery(parsed);
    }
  } catch {}
  return sanitizeRigLivery(DEFAULT_RIG_LIVERY);
}

function saveLivery(livery) {
  try {
    localStorage.setItem(LIVERY_PREF_KEY, JSON.stringify(sanitizeRigLivery(livery)));
    return true;
  } catch {
    return false;
  }
}

function shortOriginLabel(origin) {
  if (!origin) return '';
  if (origin.bounty?.watersRumor) return origin.bounty.watersRumor;
  if (origin.cache?.siteName) return origin.cache.siteName;
  if (origin.category === 'legendary') {
    const raw = String(origin.detail || '');
    const cleaned = raw.replace(/^[^·]*·\s*/i, '').trim();
    return cleaned || 'Treasure Chests & Maps';
  }
  return origin.label || '';
}

function initGearCodexPage() {
  const book = loadSavedLogbook();
  const unlocked = computeUnlockedLiveries(book, WRECK_LEVEL_ID_SET);
  const codexData = buildGearCodexData(unlocked);

  let savedLivery = loadSavedLivery();
  let previewLivery = sanitizeRigLivery(savedLivery);
  let previewTitle = 'Your Dive Rig';
  let activePreviewKey = ''; // 'set:<id>' | 'item:<slot>:<id>' | 'all-legendary' | ''

  const params = new URLSearchParams(window.location.search || '');
  const initialTab = params.get('tab') === 'legendaries' ? 'legendaries' : 'sets';

  const state = {
    tab: initialTab,
    query: params.get('q') || '',
    ownedOnly: false,
  };

  // Optional deep-link auto-preview (?set=... or ?item=...)
  const deepSetId = params.get('set');
  if (deepSetId) {
    const matchSet = codexData.sets.find((s) => s.id === deepSetId);
    if (matchSet) {
      previewLivery = applyCodexSetToLivery(previewLivery, matchSet);
      previewTitle = `${matchSet.icon} ${matchSet.name}`;
      activePreviewKey = `set:${matchSet.id}`;
    }
  }
  const deepItemId = params.get('item');
  if (deepItemId) {
    const matchItem = codexData.allItems.find((e) => e.item.id === deepItemId);
    if (matchItem) {
      previewLivery = applyCodexItemToLivery(previewLivery, matchItem.slot, matchItem.item.id);
      previewTitle = `${matchItem.slotIcon} ${matchItem.item.name}`;
      activePreviewKey = `item:${matchItem.key}`;
      if (matchItem.tier.id === 'legendary') state.tab = 'legendaries';
    }
  }

  // DOM refs
  const sumSetsEl = document.getElementById('codex-sum-sets');
  const sumLegEl = document.getElementById('codex-sum-legendaries');
  const tabCountSets = document.getElementById('tab-count-sets');
  const tabCountLeg = document.getElementById('tab-count-legendaries');
  const searchInput = document.getElementById('codex-search');
  const ownedToggleBtn = document.getElementById('btn-codex-owned-toggle');
  const contentEl = document.getElementById('codex-content');

  const previewCanvas = document.getElementById('codex-preview-canvas');
  const previewLabelEl = document.getElementById('codex-preview-label');
  const previewBonusEl = document.getElementById('codex-preview-bonus');
  const previewPerfEl = document.getElementById('codex-preview-perf');
  const previewSlotsEl = document.getElementById('codex-preview-slots');
  const btnAllLegendary = document.getElementById('btn-codex-all-legendary');
  const btnEquipRig = document.getElementById('btn-codex-equip-rig');
  const btnResetPreview = document.getElementById('btn-codex-reset-preview');
  const toastEl = document.getElementById('codex-toast');

  let toastTimer = null;
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  // Header progress chips
  if (sumSetsEl) sumSetsEl.textContent = `Sets ${codexData.summary.completedSets}/${codexData.summary.totalSets}`;
  if (sumLegEl) sumLegEl.textContent = `Legendaries ${codexData.summary.ownedLegendaries}/${codexData.summary.totalLegendaries}`;
  if (tabCountSets) tabCountSets.textContent = String(codexData.sets.length);
  if (tabCountLeg) tabCountLeg.textContent = String(codexData.legendaries.length);
  if (searchInput && state.query) searchInput.value = state.query;

  function renderSetCardHtml(s) {
    const isPreviewing = activePreviewKey === `set:${s.id}`;
    const totalCount = s.pieces.length;
    const ownedText = s.complete
      ? `<span class="owned-accent">✓ Complete (${s.ownedCount}/${totalCount})</span>`
      : `${s.ownedCount}/${totalCount} Owned`;

    const piecesHtml = s.pieces
      .map((p) => {
        const entry = p.entry;
        const art = renderGearArtworkSvg(entry.slot, entry.item, { size: 42 });
        const origin = shortOriginLabel(entry.origin);
        return `
          <button type="button" class="codex-piece-tile${p.owned ? ' owned' : ''}" data-action="preview-item" data-slot="${escapeHtml(entry.slot)}" data-id="${escapeHtml(entry.item.id)}" title="Preview ${escapeHtml(entry.item.name)}">
            <div class="codex-piece-art">${art}</div>
            <div class="codex-piece-info">
              <div class="codex-piece-slot">${escapeHtml(entry.slotLabel)}${p.owned ? ' <span class="codex-owned-dot">✓</span>' : ''}</div>
              <div class="codex-piece-name">${escapeHtml(entry.item.name)}</div>
              ${origin ? `<div class="codex-piece-origin">${escapeHtml(origin)}</div>` : ''}
            </div>
          </button>
        `;
      })
      .join('');

    // Deduplicate bonuses for 2-piece sets where tier2 and tierFull share the same (2) threshold
    const t2Prefix = s.tier2?.label?.match(/^\(\d+\)/)?.[0] || '';
    const tfPrefix = s.tierFull?.label?.match(/^\(\d+\)/)?.[0] || '';
    const hasTwoTiers = Boolean(
      s.tier2 &&
      s.tierFull &&
      s.tier2.label !== s.tierFull.label &&
      (!t2Prefix || !tfPrefix || t2Prefix !== tfPrefix)
    );

    let bonusesHtml = '';
    if (hasTwoTiers) {
      const samePower = s.tier2.power?.name && s.tier2.power.name === s.tierFull.power?.name;
      bonusesHtml = `
        <div class="codex-bonus-box">
          <div class="codex-bonus-head">${escapeHtml(s.tier2.label)}</div>
          <div class="codex-bonus-desc">${escapeHtml(s.tier2.desc)}</div>
          ${s.tier2.power && !samePower ? `<div class="codex-bonus-power">⚡ ${escapeHtml(s.tier2.power.name)}: ${escapeHtml(s.tier2.power.desc)}</div>` : ''}
        </div>
        <div class="codex-bonus-box capstone">
          <div class="codex-bonus-head">★ ${escapeHtml(s.tierFull.label)}</div>
          <div class="codex-bonus-desc">${escapeHtml(s.tierFull.desc)}</div>
          ${s.tierFull.power ? `<div class="codex-bonus-power">⚡ ${escapeHtml(s.tierFull.power.name)}: ${escapeHtml(s.tierFull.power.desc)}</div>` : ''}
        </div>
      `;
    } else if (s.tierFull || s.tier2) {
      const mainBonus = s.tierFull || s.tier2;
      const extraDesc =
        s.tier2 && s.tierFull && s.tier2.desc && s.tier2.desc !== s.tierFull.desc
          ? `${s.tier2.desc} · ${s.tierFull.desc}`
          : mainBonus.desc;
      const power = s.tierFull?.power || s.tier2?.power;
      bonusesHtml = `
        <div class="codex-bonus-box capstone">
          <div class="codex-bonus-head">★ ${escapeHtml(mainBonus.label)}</div>
          <div class="codex-bonus-desc">${escapeHtml(extraDesc)}</div>
          ${power ? `<div class="codex-bonus-power">⚡ ${escapeHtml(power.name)}: ${escapeHtml(power.desc)}</div>` : ''}
        </div>
      `;
    }

    return `
      <article class="codex-set-card${isPreviewing ? ' is-previewing' : ''}" style="--set-rgb: ${escapeHtml(s.rgb)}" data-set-id="${escapeHtml(s.id)}">
        <div class="codex-set-head">
          <div class="codex-set-title-block">
            <div class="codex-set-emblem" aria-hidden="true">${escapeHtml(s.icon)}</div>
            <div>
              <h3 class="codex-set-name">${escapeHtml(s.name)}</h3>
              <div class="codex-set-meta">
                <span>${escapeHtml(s.archetype.icon)} ${escapeHtml(s.archetype.label)}</span>
                <span>·</span>
                <span>${ownedText}</span>
              </div>
            </div>
          </div>
          <button type="button" class="codex-btn ${isPreviewing ? 'active-preview' : 'primary'}" data-action="preview-set" data-set-id="${escapeHtml(s.id)}">
            ${isPreviewing ? '✓ Previewing' : '👁 Preview Set'}
          </button>
        </div>

        <div class="codex-set-bonuses">${bonusesHtml}</div>
        ${s.auraName ? `<p class="codex-set-aura-line"><strong>✦ ${escapeHtml(s.auraName)}</strong> — ${escapeHtml(s.auraDesc)}</p>` : ''}
        <div class="codex-set-pieces">${piecesHtml}</div>
      </article>
    `;
  }

  function renderLegendaryCardHtml(e) {
    const isPreviewing = activePreviewKey === `item:${e.key}` || activePreviewKey === 'all-legendary';
    const art = renderGearArtworkSvg(e.slot, e.item, { size: 58 });
    const statPillsHtml = (e.statPills || [])
      .map((p) => `<span class="codex-pill">${escapeHtml(p)}</span>`)
      .join('');
    const sourceText = shortOriginLabel(e.origin);

    return `
      <article class="codex-item-card${isPreviewing ? ' is-previewing' : ''}" data-tier="legendary" data-action="preview-item" data-slot="${escapeHtml(e.slot)}" data-id="${escapeHtml(e.item.id)}">
        <div class="codex-item-top">
          <div class="codex-item-art">${art}</div>
          <div class="codex-item-head">
            <div class="codex-item-slot-row">
              <span class="codex-item-slot">${escapeHtml(e.slotIcon)} ${escapeHtml(e.slotLabel)}</span>
              ${e.owned ? '<span class="codex-owned-pill">✓ Owned</span>' : ''}
            </div>
            <h3 class="codex-item-name">${escapeHtml(e.item.name)}</h3>
          </div>
        </div>

        ${statPillsHtml ? `<div class="codex-stat-pills">${statPillsHtml}</div>` : ''}

        ${e.power ? `
          <div class="codex-power-box">
            <div class="codex-power-name">⚡ ${escapeHtml(e.power.name)}</div>
            <div class="codex-power-desc">${escapeHtml(e.power.desc)}</div>
          </div>
        ` : ''}

        <div class="codex-item-footer">
          <span class="codex-item-source" title="${escapeHtml(e.origin.detail)}">🗺️ ${escapeHtml(sourceText)}</span>
          <div class="codex-item-btns">
            ${e.owned
              ? `<button type="button" class="codex-btn primary" data-action="equip-item" data-slot="${escapeHtml(e.slot)}" data-id="${escapeHtml(e.item.id)}">⚡ Equip</button>`
              : `<button type="button" class="codex-btn ${isPreviewing ? 'active-preview' : ''}" data-action="preview-item" data-slot="${escapeHtml(e.slot)}" data-id="${escapeHtml(e.item.id)}">${isPreviewing ? '✓ Live' : '👁 Preview'}</button>`}
          </div>
        </div>
      </article>
    `;
  }

  function renderMainContent() {
    if (!contentEl) return;
    const ownership = state.ownedOnly ? 'owned' : 'all';

    if (state.tab === 'sets') {
      const filtered = filterCodexSets(codexData.sets, {
        query: state.query,
        ownership,
      });
      if (!filtered.length) {
        contentEl.innerHTML = '<div class="codex-empty-state">No Armor Sets match your search or filter.</div>';
        return;
      }
      contentEl.innerHTML = `<div class="codex-sets-list">${filtered.map(renderSetCardHtml).join('')}</div>`;
      return;
    }

    const filtered = filterCodexItems(codexData.legendaries, {
      query: state.query,
      ownership,
    });
    if (!filtered.length) {
      contentEl.innerHTML = '<div class="codex-empty-state">No Legendaries match your search or filter.</div>';
      return;
    }
    contentEl.innerHTML = `<div class="codex-items-grid">${filtered.map(renderLegendaryCardHtml).join('')}</div>`;
  }

  function renderPreviewPanel() {
    if (previewLabelEl) previewLabelEl.textContent = previewTitle;

    const perf = computeRigPerformanceProfile(previewLivery);
    const activeSets = evaluateGearSetSynergy(previewLivery) || [];

    if (previewBonusEl) {
      previewBonusEl.className = 'codex-preview-bonus';
      if (activeSets.length) {
        const s = activeSets[0];
        const extra = activeSets.length > 1 ? ` (+${activeSets.length - 1} more)` : '';
        previewBonusEl.textContent = `${s.icon} ${s.name} (${s.count}/${s.required}) — ${s.auraName || 'Set Bonus Active'}${extra}`;
      } else if (perf.powers && perf.powers.length === 1) {
        previewBonusEl.classList.add('is-legendary');
        previewBonusEl.textContent = `⚡ ${perf.powers[0].name}`;
      } else if (perf.powers && perf.powers.length > 1) {
        previewBonusEl.classList.add('is-legendary');
        previewBonusEl.textContent = `🔥 ${perf.powers.length} Active Powers · ${perf.powers[0].name} +${perf.powers.length - 1} more`;
      } else {
        previewBonusEl.classList.add('is-muted');
        previewBonusEl.textContent = 'Select any Set or Legendary to preview it live.';
      }
    }

    if (previewPerfEl) {
      const speedPct = Math.round(((perf.swimSpeedMult || 1) - 1) * 100);
      const gasSavePct = Math.round((1 - (perf.gasBurnMult || 1)) * 100);
      const coldPct = Math.round((perf.coldResist || 0) * 100);
      const sonarPct = Math.round(((perf.sonarRangeMult || 1) - 1) * 100);
      const bossHp = 100 + Math.round(perf.combatMaxHpBonus || 0);
      const armorPct = Math.round((perf.armorDR || 0) * 100);
      const shield = Math.round(perf.shieldMax || 0);
      const depthBonus = Math.round(perf.narcDepthBonusM || 0);

      const cells = [
        { lbl: 'Speed', val: speedPct >= 0 ? `+${speedPct}%` : `${speedPct}%`, boost: speedPct > 0 },
        { lbl: 'Gas Save', val: `${gasSavePct >= 0 ? '+' : ''}${gasSavePct}%`, boost: gasSavePct > 0 },
        { lbl: 'Cold', val: coldPct >= 100 ? 'IMMUNE' : `${coldPct}%`, boost: coldPct > 0 },
        { lbl: 'Depth/Bar', val: `+${depthBonus}m · +${Math.round(perf.bonusStartBar || 0)}b`, boost: depthBonus > 0 || (perf.bonusStartBar || 0) > 0 },
        { lbl: 'HP / DR', val: `${bossHp} · ${armorPct}%`, boost: bossHp > 100 || armorPct > 0 },
        { lbl: 'Sonar/Sh', val: `+${sonarPct}% · ${shield}`, boost: sonarPct > 0 || shield > 0 },
      ];
      previewPerfEl.innerHTML = cells
        .map(
          (c) => `
            <div class="codex-perf-cell">
              <div class="codex-perf-lbl">${escapeHtml(c.lbl)}</div>
              <div class="codex-perf-val${c.boost ? ' boosted' : ''}">${escapeHtml(c.val)}</div>
            </div>
          `
        )
        .join('');
    }

    let ownedSlotsToApply = 0;
    if (previewSlotsEl) {
      const tags = [];
      for (const sl of CODEX_SLOT_ORDER) {
        const meta = CODEX_SLOT_META[sl];
        const id = previewLivery[meta.field];
        const entry = codexData.byKey.get(`${sl}:${id}`);
        if (!entry || !entry.item) continue;
        const isDefault = id === DEFAULT_RIG_LIVERY[meta.field];
        const isOwned = unlocked[meta.setKey]?.has?.(id);
        if (!isDefault && isOwned && id !== savedLivery[meta.field]) ownedSlotsToApply++;
        if (!isDefault) {
          const isHighlight = entry.tier?.id === 'legendary' || entry.tier?.id === 'mythic';
          tags.push(
            `<span class="codex-slot-tag${isHighlight ? ' highlight' : ''}">${escapeHtml(meta.icon)} ${escapeHtml(entry.item.name)}</span>`
          );
        }
      }
      previewSlotsEl.innerHTML = tags.length
        ? tags.join('')
        : '<span class="codex-slot-tag">📦 Standard Issue Rig</span>';
    }

    if (btnEquipRig) {
      if (ownedSlotsToApply > 0) {
        btnEquipRig.hidden = false;
        btnEquipRig.textContent = `⚡ Equip ${ownedSlotsToApply} Owned`;
      } else {
        btnEquipRig.hidden = true;
      }
    }
  }

  // Tab switching
  document.querySelectorAll('.codex-tab').forEach((btn) => {
    const t = btn.getAttribute('data-tab');
    btn.classList.toggle('active', t === state.tab);
    btn.setAttribute('aria-selected', t === state.tab ? 'true' : 'false');
    btn.addEventListener('click', () => {
      state.tab = t;
      document.querySelectorAll('.codex-tab').forEach((b) => {
        const active = b.getAttribute('data-tab') === t;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      renderMainContent();
    });
  });

  // Search input
  searchInput?.addEventListener('input', () => {
    state.query = searchInput.value || '';
    renderMainContent();
  });

  // Owned-only toggle
  ownedToggleBtn?.addEventListener('click', () => {
    state.ownedOnly = !state.ownedOnly;
    ownedToggleBtn.classList.toggle('active', state.ownedOnly);
    ownedToggleBtn.setAttribute('aria-pressed', state.ownedOnly ? 'true' : 'false');
    renderMainContent();
  });

  // Card & piece click delegation
  contentEl?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('button[data-action]');
    const el = btn || e.target?.closest?.('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'preview-set') {
      const s = codexData.sets.find((x) => x.id === el.dataset.setId);
      if (!s) return;
      previewLivery = applyCodexSetToLivery(DEFAULT_RIG_LIVERY, s);
      previewTitle = `${s.icon} ${s.name}`;
      activePreviewKey = `set:${s.id}`;
      renderMainContent();
      renderPreviewPanel();
      showToast(`👁 Previewing ${s.name}`);
    } else if (action === 'preview-item') {
      const slot = el.dataset.slot;
      const id = el.dataset.id;
      const entry = codexData.byKey.get(`${slot}:${id}`);
      if (!entry) return;
      previewLivery = applyCodexItemToLivery(previewLivery, slot, id);
      previewTitle = `${entry.slotIcon} ${entry.item.name}`;
      activePreviewKey = `item:${entry.key}`;
      renderMainContent();
      renderPreviewPanel();
      showToast(`👁 Previewing ${entry.item.name}`);
    } else if (action === 'equip-item') {
      const slot = el.dataset.slot;
      const id = el.dataset.id;
      const entry = codexData.byKey.get(`${slot}:${id}`);
      if (!entry || !entry.owned) return;
      savedLivery = applyCodexItemToLivery(savedLivery, slot, id);
      previewLivery = applyCodexItemToLivery(previewLivery, slot, id);
      activePreviewKey = `item:${entry.key}`;
      saveLivery(savedLivery);
      renderMainContent();
      renderPreviewPanel();
      showToast(`⚡ Equipped ${entry.item.name}!`);
    }
  });

  // Preview toolbar buttons
  btnAllLegendary?.addEventListener('click', () => {
    previewLivery = buildAllLegendaryPreviewRig(codexData);
    previewTitle = '🔥 All 9 Legendaries';
    activePreviewKey = 'all-legendary';
    renderMainContent();
    renderPreviewPanel();
    showToast('🔥 Previewing all 9 Legendaries!');
  });

  btnResetPreview?.addEventListener('click', () => {
    previewLivery = sanitizeRigLivery(savedLivery);
    previewTitle = 'Your Dive Rig';
    activePreviewKey = '';
    renderMainContent();
    renderPreviewPanel();
    showToast('↺ Restored your saved dive rig');
  });

  btnEquipRig?.addEventListener('click', () => {
    const next = { ...savedLivery };
    let applied = 0;
    for (const sl of CODEX_SLOT_ORDER) {
      const meta = CODEX_SLOT_META[sl];
      const id = previewLivery[meta.field];
      if (id !== DEFAULT_RIG_LIVERY[meta.field] && unlocked[meta.setKey]?.has?.(id) && id !== savedLivery[meta.field]) {
        next[meta.field] = id;
        applied++;
      }
    }
    if (applied > 0) {
      savedLivery = sanitizeRigLivery(next);
      saveLivery(savedLivery);
      renderPreviewPanel();
      showToast(`⚡ Equipped ${applied} owned piece${applied > 1 ? 's' : ''} to your rig!`);
    }
  });

  // Initial render
  renderMainContent();
  renderPreviewPanel();

  // Live 60 FPS animated Diver Rig Preview loop (1:1 unstretched aspect ratio synced to rendered CSS box + DPR)
  if (previewCanvas) {
    const ctx = previewCanvas.getContext('2d');
    const startMs = performance.now();
    const tick = (now) => {
      if (!document.hidden && ctx) {
        const rect = previewCanvas.getBoundingClientRect();
        const cssW = Math.max(180, Math.round(rect.width || 368));
        const cssH = Math.max(120, Math.round(rect.height || 194));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const bufW = Math.round(cssW * dpr);
        const bufH = Math.round(cssH * dpr);
        if (previewCanvas.width !== bufW || previewCanvas.height !== bufH) {
          previewCanvas.width = bufW;
          previewCanvas.height = bufH;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const t = (now - startMs) * 0.001;
        const hasDpv = Boolean(previewLivery.scooterId && previewLivery.scooterId !== 'standard-dpv');
        const hasSpeargun = Boolean(previewLivery.harpoonId && previewLivery.harpoonId !== 'standard-harpoon');
        drawLiveryPreview(ctx, cssW, cssH, previewLivery, {
          hasDpv,
          hasSpeargun,
          envMode: 'clear',
          timeSec: t,
        });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGearCodexPage);
  } else {
    initGearCodexPage();
  }
}
