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
import {
  GEAR_ARCHETYPES,
  computeRigPerformanceProfile,
} from '../game/gearStats.js';
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

function initGearCodexPage() {
  const book = loadSavedLogbook();
  const unlocked = computeUnlockedLiveries(book, WRECK_LEVEL_ID_SET);
  const codexData = buildGearCodexData(unlocked);

  let savedLivery = loadSavedLivery();
  let previewLivery = sanitizeRigLivery(savedLivery);
  let previewTitle = 'Your Saved Dive Rig';

  const params = new URLSearchParams(window.location.search || '');
  const initialTab = ['sets', 'legendaries', 'mythics'].includes(params.get('tab'))
    ? params.get('tab')
    : 'sets';

  const state = {
    tab: initialTab,
    query: params.get('q') || '',
    archetype: 'all',
    slot: 'all',
    origin: 'all',
    ownership: 'all',
  };

  // Optional deep-link auto-preview (?set=... or ?item=...)
  const deepSetId = params.get('set');
  if (deepSetId) {
    const matchSet = codexData.sets.find((s) => s.id === deepSetId);
    if (matchSet) {
      previewLivery = applyCodexSetToLivery(previewLivery, matchSet);
      previewTitle = `${matchSet.icon} ${matchSet.name}`;
    }
  }
  const deepItemId = params.get('item');
  if (deepItemId) {
    const matchItem = codexData.allItems.find((e) => e.item.id === deepItemId);
    if (matchItem) {
      previewLivery = applyCodexItemToLivery(previewLivery, matchItem.slot, matchItem.item.id);
      previewTitle = `${matchItem.slotIcon} ${matchItem.item.name}`;
    }
  }

  // DOM refs
  const sumSetsEl = document.getElementById('codex-sum-sets');
  const sumLegsEl = document.getElementById('codex-sum-legendaries');
  const sumMythsEl = document.getElementById('codex-sum-mythics');
  const tabCountSetsEl = document.getElementById('tab-count-sets');
  const tabCountLegsEl = document.getElementById('tab-count-legendaries');
  const tabCountMythsEl = document.getElementById('tab-count-mythics');
  const searchInput = document.getElementById('codex-search');
  const subfiltersEl = document.getElementById('codex-subfilters');
  const ownershipEl = document.getElementById('codex-ownership-filters');
  const resultsMetaEl = document.getElementById('codex-results-meta');
  const contentEl = document.getElementById('codex-content');
  const previewCanvas = document.getElementById('codex-preview-canvas');
  const previewLabelEl = document.getElementById('codex-preview-label');
  const previewSetsEl = document.getElementById('codex-preview-sets');
  const previewPerfEl = document.getElementById('codex-preview-perf');
  const previewSlotsEl = document.getElementById('codex-preview-slots');
  const btnEquipRig = document.getElementById('btn-codex-equip-rig');
  const btnResetPreview = document.getElementById('btn-codex-reset-preview');
  const btnStockPreview = document.getElementById('btn-codex-stock-preview');
  const btnAllLegendary = document.getElementById('btn-codex-all-legendary');
  const toastEl = document.getElementById('codex-toast');

  let toastTimer = null;
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  // Populate summary header
  const { summary } = codexData;
  if (sumSetsEl) sumSetsEl.textContent = `✨ Sets: ${summary.completedSets} / ${summary.totalSets}`;
  if (sumLegsEl) sumLegsEl.textContent = `🔥 Legendaries: ${summary.ownedLegendaries} / ${summary.totalLegendaries}`;
  if (sumMythsEl) sumMythsEl.textContent = `✦ Mythics: ${summary.ownedMythics} / ${summary.totalMythics}`;
  if (tabCountSetsEl) tabCountSetsEl.textContent = String(summary.totalSets);
  if (tabCountLegsEl) tabCountLegsEl.textContent = String(summary.totalLegendaries);
  if (tabCountMythsEl) tabCountMythsEl.textContent = String(summary.totalMythics);
  if (searchInput && state.query) searchInput.value = state.query;

  function renderSubfilters() {
    if (!subfiltersEl) return;
    if (state.tab === 'sets') {
      const archs = [
        { id: 'all', label: 'All Roles' },
        ...Object.values(GEAR_ARCHETYPES).map((a) => ({ id: a.id, label: `${a.icon} ${a.label}` })),
      ];
      subfiltersEl.innerHTML = archs
        .map(
          (a) =>
            `<button type="button" class="codex-chip${state.archetype === a.id ? ' active' : ''}" data-arch="${escapeHtml(a.id)}">${escapeHtml(a.label)}</button>`
        )
        .join('');
    } else if (state.tab === 'legendaries') {
      const slots = [
        { id: 'all', label: 'All Slots' },
        ...CODEX_SLOT_ORDER.map((sl) => ({ id: sl, label: `${CODEX_SLOT_META[sl].icon} ${CODEX_SLOT_META[sl].label}` })),
      ];
      subfiltersEl.innerHTML = slots
        .map(
          (s) =>
            `<button type="button" class="codex-chip${state.slot === s.id ? ' active' : ''}" data-slot="${escapeHtml(s.id)}">${escapeHtml(s.label)}</button>`
        )
        .join('');
    } else {
      const origins = [
        { id: 'all', label: 'All Sources' },
        { id: 'boss', label: '🏆 Boss Guardians' },
        { id: 'world', label: '🗺️ World Caches' },
        { id: 'chest', label: '🧰 Chest Drops' },
        { id: 'milestone', label: '🎖️ Milestones' },
      ];
      subfiltersEl.innerHTML = origins
        .map(
          (o) =>
            `<button type="button" class="codex-chip${state.origin === o.id ? ' active' : ''}" data-origin="${escapeHtml(o.id)}">${escapeHtml(o.label)}</button>`
        )
        .join('');
    }
  }

  function renderSetCardHtml(s) {
    const ownedBadge = s.completed
      ? `<span class="codex-badge owned">✓ Complete (${s.ownedCount}/${s.totalCount})</span>`
      : `<span class="codex-badge locked">${s.ownedCount}/${s.totalCount} Owned</span>`;
    const piecesHtml = s.pieces
      .map((p) => {
        const entry = p.entry;
        if (!entry) return '';
        const art = renderGearArtworkSvg(entry.slot, entry.item, { size: 52 });
        return `
          <div class="codex-piece-mini${p.owned ? ' owned' : ''}" data-action="preview-item" data-slot="${escapeHtml(entry.slot)}" data-id="${escapeHtml(entry.item.id)}" title="Click to preview ${escapeHtml(entry.item.name)}">
            <div class="codex-piece-art">${art}</div>
            <div class="codex-piece-info">
              <div class="codex-piece-slot">${escapeHtml(entry.slotIcon)} ${escapeHtml(entry.slotLabel)} · ${p.owned ? '✓ Owned' : '🔒'}</div>
              <div class="codex-piece-name">${escapeHtml(entry.item.name)}</div>
              <div class="codex-piece-origin">${escapeHtml(entry.origin.icon)} ${escapeHtml(entry.origin.label)}</div>
            </div>
          </div>
        `;
      })
      .join('');

    const showSeparateTier2 = s.tier2 && s.tierFull && s.tier2.label !== s.tierFull.label;
    return `
      <article class="codex-set-card" style="--set-rgb: ${escapeHtml(s.rgb)}" data-set-id="${escapeHtml(s.id)}">
        <div class="codex-set-head">
          <div class="codex-set-title-block">
            <div class="codex-set-emblem" aria-hidden="true">${escapeHtml(s.icon)}</div>
            <div>
              <h3 class="codex-set-name">${escapeHtml(s.name)}</h3>
              <div class="codex-set-badges">
                <span class="codex-badge" style="border-color:${escapeHtml(s.tier.color)};color:${escapeHtml(s.tier.color)}">${escapeHtml(s.tier.icon)} ${escapeHtml(s.tier.badge)}</span>
                <span class="codex-badge">${escapeHtml(s.archetype.icon)} ${escapeHtml(s.archetype.label)}</span>
                ${ownedBadge}
              </div>
            </div>
          </div>
          <div class="codex-set-actions">
            <button type="button" class="codex-btn primary" data-action="preview-set" data-set-id="${escapeHtml(s.id)}">👁 Preview Full Set</button>
          </div>
        </div>
        ${s.auraName ? `<div class="codex-set-aura"><strong>✦ ${escapeHtml(s.auraName)}:</strong> ${escapeHtml(s.auraDesc)}</div>` : ''}
        <div class="codex-set-bonuses">
          ${showSeparateTier2 ? `
            <div class="codex-bonus-box">
              <div class="codex-bonus-head">${escapeHtml(s.tier2.label)}</div>
              <div class="codex-bonus-desc">${escapeHtml(s.tier2.desc)}</div>
              ${s.tier2.power ? `<div class="codex-bonus-power">⚡ ${escapeHtml(s.tier2.power.name)}: ${escapeHtml(s.tier2.power.desc)}</div>` : ''}
            </div>
          ` : ''}
          ${s.tierFull ? `
            <div class="codex-bonus-box capstone">
              <div class="codex-bonus-head">★ ${escapeHtml(s.tierFull.label)}</div>
              <div class="codex-bonus-desc">${escapeHtml(s.tierFull.desc)}</div>
              ${s.tierFull.power ? `<div class="codex-bonus-power">⚡ ${escapeHtml(s.tierFull.power.name)}: ${escapeHtml(s.tierFull.power.desc)}</div>` : ''}
            </div>
          ` : ''}
        </div>
        <div class="codex-set-pieces">${piecesHtml}</div>
      </article>
    `;
  }

  function renderItemCardHtml(e) {
    const art = renderGearArtworkSvg(e.slot, e.item, { size: 70 });
    const statPillsHtml = (e.statPills || [])
      .map((p) => `<span class="codex-pill">${escapeHtml(p)}</span>`)
      .join('');
    const setTagsHtml = (e.memberSets || [])
      .map((ms) => `<span class="codex-badge" style="border-color:${escapeHtml(ms.color)};color:${escapeHtml(ms.color)}">${escapeHtml(ms.icon)} ${escapeHtml(ms.name)}</span>`)
      .join('');
    const ownBadge = e.owned
      ? '<span class="codex-badge owned">✓ Owned</span>'
      : '<span class="codex-badge locked">🔒 Undiscovered</span>';

    return `
      <article class="codex-item-card" data-tier="${escapeHtml(e.tier.id)}" data-item-key="${escapeHtml(e.key)}">
        <div class="codex-item-top">
          <div class="codex-item-art">${art}</div>
          <div class="codex-item-head-meta">
            <div class="codex-item-kicker">
              <span class="codex-item-slot">${escapeHtml(e.slotIcon)} ${escapeHtml(e.slotLabel)}</span>
              ${ownBadge}
            </div>
            <h3 class="codex-item-name">${escapeHtml(e.item.name)}</h3>
            <div class="codex-set-badges">
              <span class="codex-badge" style="border-color:${escapeHtml(e.tier.color)};color:${escapeHtml(e.tier.color)}">${escapeHtml(e.tier.icon)} ${escapeHtml(e.tier.badge)}</span>
              ${setTagsHtml}
            </div>
          </div>
        </div>
        ${statPillsHtml ? `<div class="codex-stat-pills">${statPillsHtml}</div>` : ''}
        ${e.power ? `
          <div class="codex-power-box">
            <div class="codex-power-name">⚡ ${escapeHtml(e.power.name)}</div>
            <div class="codex-power-desc">${escapeHtml(e.power.desc)}</div>
          </div>
        ` : ''}
        ${e.fx ? `<div class="codex-fx-note">✨ <strong>${escapeHtml(e.fx.name)}</strong> — ${escapeHtml(e.fx.desc)}</div>` : ''}
        <div class="codex-origin-row">
          <strong>${escapeHtml(e.origin.icon)} ${escapeHtml(e.origin.label)}</strong><br/>
          ${escapeHtml(e.origin.detail)}
        </div>
        <div class="codex-item-footer">
          <button type="button" class="codex-btn primary" data-action="preview-item" data-slot="${escapeHtml(e.slot)}" data-id="${escapeHtml(e.item.id)}">👁 Preview</button>
          ${e.owned
            ? `<button type="button" class="codex-btn" data-action="equip-item" data-slot="${escapeHtml(e.slot)}" data-id="${escapeHtml(e.item.id)}">⚡ Equip</button>`
            : ''}
        </div>
      </article>
    `;
  }

  function renderMainContent() {
    if (!contentEl) return;
    if (state.tab === 'sets') {
      const filtered = filterCodexSets(codexData.sets, {
        query: state.query,
        archetype: state.archetype,
        ownership: state.ownership,
      });
      if (resultsMetaEl) {
        resultsMetaEl.textContent = `Showing ${filtered.length} of ${codexData.sets.length} Armor Sets`;
      }
      if (!filtered.length) {
        contentEl.innerHTML = '<div class="codex-empty-state">No Armor Sets match your filters. Try clearing search or switching ownership filters.</div>';
        return;
      }
      contentEl.innerHTML = `<div class="codex-sets-grid">${filtered.map(renderSetCardHtml).join('')}</div>`;
      return;
    }

    const pool = state.tab === 'legendaries' ? codexData.legendaries : codexData.mythics;
    const filtered = filterCodexItems(pool, {
      query: state.query,
      slot: state.tab === 'legendaries' ? state.slot : 'all',
      origin: state.tab === 'mythics' ? state.origin : 'all',
      ownership: state.ownership,
    });
    const label = state.tab === 'legendaries' ? 'Ultra-Rare Legendaries' : 'Mythic Relics & Guardian Drysuits';
    if (resultsMetaEl) {
      resultsMetaEl.textContent = `Showing ${filtered.length} of ${pool.length} ${label}`;
    }
    if (!filtered.length) {
      contentEl.innerHTML = `<div class="codex-empty-state">No ${escapeHtml(label)} match your filters.</div>`;
      return;
    }
    contentEl.innerHTML = `<div class="codex-items-grid">${filtered.map(renderItemCardHtml).join('')}</div>`;
  }

  function renderPreviewPanel() {
    if (previewLabelEl) previewLabelEl.textContent = previewTitle;

    const perf = computeRigPerformanceProfile(previewLivery);
    const activeSets = evaluateGearSetSynergy(previewLivery) || [];

    if (previewSetsEl) {
      if (activeSets.length) {
        previewSetsEl.innerHTML = activeSets
          .map(
            (s) =>
              `<div class="codex-active-set-chip">${escapeHtml(s.icon)} <strong>${escapeHtml(s.name)}</strong> (${s.count}/${s.required}) — ${escapeHtml(s.auraName || 'Set Bonus Active')}</div>`
          )
          .join('');
      } else if (perf.powers && perf.powers.length) {
        const topPowers = perf.powers
          .slice(0, 3)
          .map((p) => `<div class="codex-active-set-chip">⚡ <strong>${escapeHtml(p.name)}</strong></div>`);
        if (perf.powers.length > 3) {
          topPowers.push(
            `<div class="codex-active-set-chip">🔥 <strong>+${perf.powers.length - 3} more active gear powers</strong> (${perf.powers.length} total)</div>`
          );
        }
        previewSetsEl.innerHTML = topPowers.join('');
      } else {
        previewSetsEl.innerHTML = '<div class="codex-active-set-chip">Click any Set or Legendary to preview its full build live!</div>';
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
        { lbl: 'Swim Speed', val: speedPct >= 0 ? `+${speedPct}%` : `${speedPct}%`, boost: speedPct > 0 },
        { lbl: 'Gas Savings', val: `${gasSavePct >= 0 ? '+' : ''}${gasSavePct}%`, boost: gasSavePct > 0 },
        { lbl: 'Cold Resist', val: coldPct >= 100 ? 'COLD-PROOF' : `${coldPct}%`, boost: coldPct > 0 },
        { lbl: 'Depth / Reserve', val: `+${depthBonus}m · +${Math.round(perf.bonusStartBar || 0)}b`, boost: depthBonus > 0 || (perf.bonusStartBar || 0) > 0 },
        { lbl: 'Boss HP / Armor', val: `${bossHp} HP · ${armorPct}% DR`, boost: bossHp > 100 || armorPct > 0 },
        { lbl: 'Sonar / Shield', val: `+${sonarPct}% · ${shield} Sh`, boost: sonarPct > 0 || shield > 0 },
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
        if (isOwned && id !== savedLivery[meta.field]) ownedSlotsToApply++;
        if (!isDefault) {
          const isHighlight = entry.tier?.id === 'legendary' || entry.tier?.id === 'mythic';
          tags.push(
            `<span class="codex-slot-tag${isHighlight ? ' highlight' : ''}">${escapeHtml(meta.icon)} ${escapeHtml(entry.item.name)}</span>`
          );
        }
      }
      previewSlotsEl.innerHTML = tags.length
        ? tags.join('')
        : '<span class="codex-slot-tag">📦 Standard Issue Expedition Rig</span>';
    }

    if (btnEquipRig) {
      if (ownedSlotsToApply > 0) {
        btnEquipRig.disabled = false;
        btnEquipRig.textContent = `⚡ Equip ${ownedSlotsToApply} Owned Piece${ownedSlotsToApply > 1 ? 's' : ''} to My Rig`;
      } else {
        btnEquipRig.disabled = true;
        btnEquipRig.textContent = '🔒 Preview Only (Unlock Pieces to Equip)';
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
      renderSubfilters();
      renderMainContent();
    });
  });

  // Search input
  searchInput?.addEventListener('input', () => {
    state.query = searchInput.value || '';
    renderMainContent();
  });

  // Subfilter clicks
  subfiltersEl?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('.codex-chip');
    if (!btn) return;
    if (btn.dataset.arch) state.archetype = btn.dataset.arch;
    if (btn.dataset.slot) state.slot = btn.dataset.slot;
    if (btn.dataset.origin) state.origin = btn.dataset.origin;
    renderSubfilters();
    renderMainContent();
  });

  // Ownership filter clicks
  ownershipEl?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('.codex-chip');
    if (!btn || !btn.dataset.own) return;
    state.ownership = btn.dataset.own;
    ownershipEl.querySelectorAll('.codex-chip').forEach((b) => {
      b.classList.toggle('active', b.dataset.own === state.ownership);
    });
    renderMainContent();
  });

  // Card action delegation
  contentEl?.addEventListener('click', (e) => {
    const el = e.target?.closest?.('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'preview-set') {
      const s = codexData.sets.find((x) => x.id === el.dataset.setId);
      if (!s) return;
      previewLivery = applyCodexSetToLivery(previewLivery, s);
      previewTitle = `${s.icon} ${s.name}`;
      renderPreviewPanel();
      showToast(`👁 Previewing full ${s.name} set`);
    } else if (action === 'preview-item') {
      const slot = el.dataset.slot;
      const id = el.dataset.id;
      const entry = codexData.byKey.get(`${slot}:${id}`);
      if (!entry) return;
      previewLivery = applyCodexItemToLivery(previewLivery, slot, id);
      previewTitle = `${entry.slotIcon} ${entry.item.name}`;
      renderPreviewPanel();
      showToast(`👁 Previewing ${entry.item.name}`);
    } else if (action === 'equip-item') {
      const slot = el.dataset.slot;
      const id = el.dataset.id;
      const entry = codexData.byKey.get(`${slot}:${id}`);
      if (!entry || !entry.owned) return;
      savedLivery = applyCodexItemToLivery(savedLivery, slot, id);
      previewLivery = applyCodexItemToLivery(previewLivery, slot, id);
      saveLivery(savedLivery);
      renderPreviewPanel();
      showToast(`⚡ Equipped ${entry.item.name} on your Dive Rig!`);
    }
  });

  // Preview control buttons
  btnAllLegendary?.addEventListener('click', () => {
    previewLivery = buildAllLegendaryPreviewRig(codexData);
    previewTitle = '🔥 Full 9-Slot Legendary Dream Rig';
    renderPreviewPanel();
    showToast('🔥 Previewing all 9 Ultra-Rare Legendaries!');
  });

  btnResetPreview?.addEventListener('click', () => {
    previewLivery = sanitizeRigLivery(savedLivery);
    previewTitle = 'Your Saved Dive Rig';
    renderPreviewPanel();
    showToast('↺ Restored your saved dive rig');
  });

  btnStockPreview?.addEventListener('click', () => {
    previewLivery = sanitizeRigLivery(DEFAULT_RIG_LIVERY);
    previewTitle = '📦 Standard Issue Rig';
    renderPreviewPanel();
    showToast('📦 Previewing stock baseline rig');
  });

  btnEquipRig?.addEventListener('click', () => {
    const next = { ...savedLivery };
    let applied = 0;
    for (const sl of CODEX_SLOT_ORDER) {
      const meta = CODEX_SLOT_META[sl];
      const id = previewLivery[meta.field];
      if (unlocked[meta.setKey]?.has?.(id) && id !== savedLivery[meta.field]) {
        next[meta.field] = id;
        applied++;
      }
    }
    if (applied > 0) {
      savedLivery = sanitizeRigLivery(next);
      saveLivery(savedLivery);
      renderPreviewPanel();
      showToast(`⚡ Equipped ${applied} owned gear piece${applied > 1 ? 's' : ''} to your Dive Rig!`);
    }
  });

  // Initial render
  renderSubfilters();
  renderMainContent();
  renderPreviewPanel();

  // Live 60 FPS animated Diver Rig Preview loop
  if (previewCanvas) {
    const ctx = previewCanvas.getContext('2d');
    const startMs = performance.now();
    const tick = (now) => {
      if (!document.hidden && ctx) {
        const t = (now - startMs) * 0.001;
        const hasDpv = Boolean(previewLivery.scooterId && previewLivery.scooterId !== 'standard-dpv');
        const hasSpeargun = Boolean(previewLivery.harpoonId && previewLivery.harpoonId !== 'standard-harpoon');
        drawLiveryPreview(ctx, previewCanvas.width, previewCanvas.height, previewLivery, {
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
