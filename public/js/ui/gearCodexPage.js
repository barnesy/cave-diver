import { escapeHtml } from '../util/common.js';
import { LEVELS } from '../levels/index.js';
import { createEmptyLogbook } from '../game/logbookModel.js';
import {
  DEFAULT_RIG_LIVERY,
  computeUnlockedLiveries,
  drawLiveryPreview,
  sanitizeRigLivery,
} from '../game/rigLivery.js';
import {
  computeRigPerformanceProfile,
  formatStatPills,
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

function extractStatSnapshot(perf) {
  return {
    speed: Math.round(((perf.swimSpeedMult || 1) - 1) * 100),
    gasSave: Math.round((1 - (perf.gasBurnMult || 1)) * 100),
    cold: Math.round((perf.coldResist || 0) * 100),
    spear: Math.round(((perf.spearPowerMult || 1) - 1) * 100),
    hp: 100 + Math.round(perf.combatMaxHpBonus || 0),
    armor: Math.round((perf.armorDR || 0) * 100),
    shield: Math.round(perf.shieldMax || 0),
    sonar: Math.round(((perf.sonarRangeMult || 1) - 1) * 100),
    depth: Math.round(perf.narcDepthBonusM || 0),
    bar: Math.round(perf.bonusStartBar || 0),
  };
}

function formatDeltaBadge(delta, suffix = '%') {
  if (!delta) return '';
  const sign = delta > 0 ? '+' : '';
  return `<span class="codex-meter-delta ${delta > 0 ? 'up' : 'down'}">${sign}${delta}${suffix}</span>`;
}

function renderDiverCanvasHiDpi(canvas, livery, timeSec = 0.55, diverScaleMult = 1.0) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(120, Math.round(rect.width || 220));
  const cssH = Math.max(96, Math.round(rect.height || Math.round(cssW * 0.68)));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const bufW = Math.round(cssW * dpr);
  const bufH = Math.round(cssH * dpr);
  if (canvas.width !== bufW || canvas.height !== bufH) {
    canvas.width = bufW;
    canvas.height = bufH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const hasDpv = Boolean(livery.scooterId && livery.scooterId !== 'standard-dpv');
  const hasSpeargun = Boolean(livery.harpoonId && livery.harpoonId !== 'standard-harpoon');
  drawLiveryPreview(ctx, cssW, cssH, livery, {
    hasDpv,
    hasSpeargun,
    envMode: 'clear',
    timeSec,
    diverScaleMult,
    transparentBg: true,
  });
}

function initGearCodexPage() {
  const book = loadSavedLogbook();
  const unlocked = computeUnlockedLiveries(book, WRECK_LEVEL_ID_SET);
  const codexData = buildGearCodexData(unlocked);

  let savedLivery = loadSavedLivery();
  let previewLivery = sanitizeRigLivery(savedLivery);
  let prevSnap = extractStatSnapshot(computeRigPerformanceProfile(previewLivery));

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
    if (matchSet) previewLivery = applyCodexSetToLivery(previewLivery, matchSet);
  }
  const deepItemId = params.get('item');
  if (deepItemId) {
    const matchItem = codexData.allItems.find((e) => e.item.id === deepItemId);
    if (matchItem) {
      previewLivery = applyCodexItemToLivery(previewLivery, matchItem.slot, matchItem.item.id);
      if (matchItem.tier.id === 'legendary') state.tab = 'legendaries';
    }
  }
  prevSnap = extractStatSnapshot(computeRigPerformanceProfile(previewLivery));

  // DOM refs
  const tabCountSets = document.getElementById('tab-count-sets');
  const tabCountLeg = document.getElementById('tab-count-legendaries');
  const searchInput = document.getElementById('codex-search');
  const ownedToggleBtn = document.getElementById('btn-codex-owned-toggle');
  const contentEl = document.getElementById('codex-content');

  const previewCanvas = document.getElementById('codex-preview-canvas');
  const previewLabelEl = document.getElementById('codex-preview-label');
  const previewSynergiesEl = document.getElementById('codex-preview-synergies');
  const previewBarsEl = document.getElementById('codex-preview-bars');
  const previewSlotsEl = document.getElementById('codex-preview-slots');
  const btnAllLegendary = document.getElementById('btn-codex-all-legendary');
  const btnEquipRig = document.getElementById('btn-codex-equip-rig');
  const btnResetPreview = document.getElementById('btn-codex-reset-preview');
  const btnClearMix = document.getElementById('btn-codex-clear-mix');
  const toastEl = document.getElementById('codex-toast');

  // Precompute complete outfitted rig for every Armor Set card
  const setFullLiveryById = new Map();
  for (const s of codexData.sets) {
    setFullLiveryById.set(s.id, applyCodexSetToLivery(DEFAULT_RIG_LIVERY, s));
  }

  let toastTimer = null;
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  if (tabCountSets) tabCountSets.textContent = String(codexData.sets.length);
  if (tabCountLeg) tabCountLeg.textContent = String(codexData.legendaries.length);
  if (searchInput && state.query) searchInput.value = state.query;

  function countSetInMix(s) {
    let n = 0;
    for (const p of s.pieces) {
      if (p.ids.includes(previewLivery[p.field])) n++;
    }
    return n;
  }

  function computeBuildLabel(perf, activeSets) {
    let nonDefault = 0;
    let legCount = 0;
    for (const sl of CODEX_SLOT_ORDER) {
      const meta = CODEX_SLOT_META[sl];
      const id = previewLivery[meta.field];
      if (id !== DEFAULT_RIG_LIVERY[meta.field]) {
        nonDefault++;
        if (codexData.byKey.get(`${sl}:${id}`)?.tier?.id === 'legendary') legCount++;
      }
    }
    if (nonDefault === 0) return '📦 Stock Baseline';
    if (legCount === codexData.legendaries.length) return '🔥 All 9 Legendaries';
    if (activeSets.length >= 2) return `✨ Hybrid · ${activeSets.map((s) => s.icon || '✨').join('+')}`;
    if (activeSets.length === 1 && legCount > 0) return `${activeSets[0].icon || '✨'} ${activeSets[0].name} + ${legCount}🔥`;
    if (activeSets.length === 1) return `${activeSets[0].icon || '✨'} ${activeSets[0].name}`;
    if (legCount > 0) return `🔥 ${legCount} Legendary Mix`;
    return `🧪 Custom Mix (${nonDefault})`;
  }

  let activeSetCanvases = [];

  function refreshSetCanvasList() {
    if (!contentEl) {
      activeSetCanvases = [];
      return;
    }
    activeSetCanvases = [...contentEl.querySelectorAll('.codex-set-diver-canvas[data-set-id]')].map((canvas, idx) => ({
      canvas,
      setLivery: setFullLiveryById.get(canvas.getAttribute('data-set-id')) || null,
      phaseOffset: idx * 0.85,
    }));
  }

  function renderSetCardDivers(timeSec = 0.45, onlyVisible = false) {
    const vh = window.innerHeight || 900;
    for (let i = 0; i < activeSetCanvases.length; i++) {
      const item = activeSetCanvases[i];
      if (!item.setLivery || !item.canvas.isConnected) continue;
      if (onlyVisible) {
        const r = item.canvas.getBoundingClientRect();
        if (r.bottom < -40 || r.top > vh + 40) continue;
      }
      renderDiverCanvasHiDpi(item.canvas, item.setLivery, timeSec + item.phaseOffset, 0.84);
    }
  }

  function renderSetCardHtml(s) {
    const activeCount = countSetInMix(s);
    const totalCount = s.pieces.length;
    const isFull = activeCount >= s.capstoneReq;
    const isApplied = activeCount >= totalCount;

    const piecesHtml = s.pieces
      .map((p) => {
        const entry = p.entry;
        const inMix = p.ids.includes(previewLivery[p.field]);
        const art = renderGearArtworkSvg(entry.slot, entry.item, { size: 34 });
        const topStats = (entry.statPills || []).slice(0, 2).join(' · ');
        return `
          <button type="button" class="codex-piece-tile${inMix ? ' in-mix' : ''}" data-action="toggle-item" data-slot="${escapeHtml(entry.slot)}" data-id="${escapeHtml(entry.item.id)}" title="${escapeHtml(entry.item.name)} — Click to ${inMix ? 'remove from' : 'add to'} mix">
            <div class="codex-piece-art">${art}</div>
            <div class="codex-piece-info">
              <div class="codex-piece-top">
                <span class="codex-piece-slot">${escapeHtml(entry.slotLabel)}</span>
                ${p.owned ? '<span class="codex-owned-dot" title="Owned">✓</span>' : ''}
              </div>
              <div class="codex-piece-name">${escapeHtml(entry.item.name)}</div>
              ${topStats ? `<div class="codex-piece-stats">${escapeHtml(topStats)}</div>` : ''}
            </div>
          </button>
        `;
      })
      .join('');

    const t2Prefix = s.tier2?.label?.match(/^\(\d+\)/)?.[0] || '';
    const tfPrefix = s.tierFull?.label?.match(/^\(\d+\)/)?.[0] || '';
    const hasTwoTiers = Boolean(
      s.tier2 &&
      s.tierFull &&
      s.tier2.label !== s.tierFull.label &&
      (!t2Prefix || !tfPrefix || t2Prefix !== tfPrefix)
    );

    const buildTierRow = (reqLabel, bonusObj, isLit, mergedStats = null) => {
      const statsObj = mergedStats || bonusObj?.stats || {};
      const pills = formatStatPills(statsObj);
      const power = bonusObj?.power;
      return `
        <div class="codex-tier-row${isLit ? ' active' : ''}">
          <span class="codex-tier-badge">${escapeHtml(reqLabel)}</span>
          ${pills.map((p) => `<span class="codex-pill">${escapeHtml(p)}</span>`).join('')}
          ${power ? `<span class="codex-pill power" title="${escapeHtml(power.desc)}">⚡ ${escapeHtml(power.name)}</span>` : ''}
        </div>
      `;
    };

    let tiersHtml = '';
    if (hasTwoTiers) {
      tiersHtml =
        buildTierRow('2pc', s.tier2, activeCount >= 2) +
        buildTierRow(`${s.capstoneReq}pc ★`, s.tierFull, isFull);
    } else if (s.tierFull || s.tier2) {
      const merged = { ...(s.tier2?.stats || {}), ...(s.tierFull?.stats || {}) };
      const mainObj = s.tierFull || s.tier2;
      tiersHtml = buildTierRow(`${s.capstoneReq}pc ★`, mainObj, activeCount >= s.capstoneReq, merged);
    }

    return `
      <article class="codex-set-card${activeCount > 0 ? ' has-active' : ''}" style="--set-rgb: ${escapeHtml(s.rgb)}" data-set-id="${escapeHtml(s.id)}">
        <div class="codex-set-hero">
          <div class="codex-set-diver-box" data-action="toggle-set" data-set-id="${escapeHtml(s.id)}" title="Click to ${isApplied ? 'remove' : 'mix'} full ${escapeHtml(s.name)}">
            <canvas class="codex-set-diver-canvas" data-set-id="${escapeHtml(s.id)}" width="440" height="232" aria-label="Diver outfitted in ${escapeHtml(s.name)}"></canvas>
          </div>
          <div class="codex-set-hero-right">
            <div class="codex-set-head">
              <div class="codex-set-title-block">
                <div class="codex-set-emblem" aria-hidden="true">${escapeHtml(s.icon)}</div>
                <h3 class="codex-set-name">${escapeHtml(s.name)}</h3>
                <span class="codex-set-count-pill${activeCount >= 2 ? ' lit' : ''}">${activeCount}/${totalCount}</span>
              </div>
              <button type="button" class="codex-btn ${isApplied ? 'active-mix' : 'primary'}" data-action="toggle-set" data-set-id="${escapeHtml(s.id)}">
                ${isApplied ? '✓ In Mix' : '+ Mix Set'}
              </button>
            </div>
            <div class="codex-set-tiers">${tiersHtml}</div>
          </div>
        </div>

        <div class="codex-set-pieces">${piecesHtml}</div>
      </article>
    `;
  }

  function renderLegendaryCardHtml(e) {
    const inMix = previewLivery[e.field] === e.item.id;
    const art = renderGearArtworkSvg(e.slot, e.item, { size: 48 });
    const statPillsHtml = (e.statPills || [])
      .map((p) => `<span class="codex-pill">${escapeHtml(p)}</span>`)
      .join('');

    return `
      <article class="codex-item-card${inMix ? ' in-mix' : ''}" data-tier="legendary" data-action="toggle-item" data-slot="${escapeHtml(e.slot)}" data-id="${escapeHtml(e.item.id)}" title="Click to ${inMix ? 'remove from' : 'add to'} mix">
        <div class="codex-item-top">
          <div class="codex-item-art">${art}</div>
          <div class="codex-item-head">
            <div class="codex-item-slot-row">
              <span class="codex-item-slot">${escapeHtml(e.slotIcon)} ${escapeHtml(e.slotLabel)}</span>
              ${inMix ? '<span class="codex-mix-badge">✓ In Mix</span>' : (e.owned ? '<span class="codex-owned-dot" title="Owned">✓ Owned</span>' : '')}
            </div>
            <h3 class="codex-item-name">${escapeHtml(e.item.name)}</h3>
          </div>
        </div>

        <div class="codex-stat-pills">${statPillsHtml}</div>

        <div class="codex-item-power-row">
          ${e.power ? `<span class="codex-pill power" title="${escapeHtml(e.power.desc)}">⚡ ${escapeHtml(e.power.name)}</span>` : '<span></span>'}
          ${e.owned && savedLivery[e.field] !== e.item.id
            ? `<button type="button" class="codex-btn primary codex-mini-equip" data-action="equip-item" data-slot="${escapeHtml(e.slot)}" data-id="${escapeHtml(e.item.id)}">⚡ Equip</button>`
            : ''}
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
        contentEl.innerHTML = '<div class="codex-empty-state">No Armor Sets match your filter.</div>';
        return;
      }
      contentEl.innerHTML = `<div class="codex-sets-list">${filtered.map(renderSetCardHtml).join('')}</div>`;
      refreshSetCanvasList();
      renderSetCardDivers(0.45, false);
      return;
    }

    activeSetCanvases = [];

    const filtered = filterCodexItems(codexData.legendaries, {
      query: state.query,
      ownership,
    });
    if (!filtered.length) {
      contentEl.innerHTML = '<div class="codex-empty-state">No Legendaries match your filter.</div>';
      return;
    }
    contentEl.innerHTML = `<div class="codex-items-grid">${filtered.map(renderLegendaryCardHtml).join('')}</div>`;
  }

  function renderPreviewPanel(showDeltas = false) {
    const perf = computeRigPerformanceProfile(previewLivery);
    const activeSets = Array.isArray(perf.activeSets) ? perf.activeSets : [];
    const curSnap = extractStatSnapshot(perf);
    const d = (k) => (showDeltas ? curSnap[k] - prevSnap[k] : 0);

    if (previewLabelEl) {
      previewLabelEl.textContent = computeBuildLabel(perf, activeSets);
    }

    // Active Set Bonuses + Legendary Powers pills
    if (previewSynergiesEl) {
      const chips = [];
      for (const s of activeSets) {
        const setDef = codexData.sets.find((x) => x.id === s.id);
        const curCnt = setDef ? countSetInMix(setDef) : (s.equipped ?? s.equippedCount ?? s.count ?? 2);
        const req = s.required || s.capstoneReq || setDef?.capstoneReq || setDef?.totalCount || 2;
        chips.push(`<span class="codex-pill set-active">${escapeHtml(s.icon || setDef?.icon || '✨')} ${escapeHtml(s.name)} ${curCnt}/${req}</span>`);
      }
      for (const p of perf.powers || []) {
        chips.push(`<span class="codex-pill power" title="${escapeHtml(p.desc || p.name)}">⚡ ${escapeHtml(p.name)}</span>`);
      }
      previewSynergiesEl.innerHTML = chips.length
        ? chips.join('')
        : '<span class="codex-synergy-empty">Tap any set or piece below to mix stats live.</span>';
    }

    // 7 Animated Visual Stat Bars with live +/- deltas
    if (previewBarsEl) {
      const meters = [
        {
          lbl: 'Speed',
          val: `${curSnap.speed >= 0 ? '+' : ''}${curSnap.speed}%`,
          delta: formatDeltaBadge(d('speed'), '%'),
          pct: Math.min(100, Math.max(0, (curSnap.speed / 45) * 100)),
          boost: curSnap.speed > 0,
          tone: '',
        },
        {
          lbl: 'Gas Save',
          val: `${curSnap.gasSave >= 0 ? '+' : ''}${curSnap.gasSave}%`,
          delta: formatDeltaBadge(d('gasSave'), '%'),
          pct: Math.min(100, Math.max(0, (curSnap.gasSave / 42) * 100)),
          boost: curSnap.gasSave > 0,
          tone: 'emerald',
        },
        {
          lbl: 'Cold',
          val: curSnap.cold >= 100 ? 'IMMUNE' : `${curSnap.cold}%`,
          delta: formatDeltaBadge(d('cold'), '%'),
          pct: Math.min(100, Math.max(0, curSnap.cold)),
          boost: curSnap.cold > 0,
          tone: '',
        },
        {
          lbl: 'Spear',
          val: `+${curSnap.spear}%`,
          delta: formatDeltaBadge(d('spear'), '%'),
          pct: Math.min(100, Math.max(0, (curSnap.spear / 75) * 100)),
          boost: curSnap.spear > 0,
          tone: 'amber',
        },
        {
          lbl: 'HP · DR',
          val: `${curSnap.hp} · ${curSnap.armor}%`,
          delta: formatDeltaBadge(d('hp'), ' HP') || formatDeltaBadge(d('armor'), '%'),
          pct: Math.min(100, Math.max(0, ((curSnap.hp - 100) / 90) * 55 + (curSnap.armor / 60) * 45)),
          boost: curSnap.hp > 100 || curSnap.armor > 0,
          tone: 'amber',
        },
        {
          lbl: 'Sh · Sonar',
          val: `${curSnap.shield} · +${curSnap.sonar}%`,
          delta: formatDeltaBadge(d('shield'), ' Sh') || formatDeltaBadge(d('sonar'), '%'),
          pct: Math.min(100, Math.max(0, (curSnap.shield / 80) * 55 + (curSnap.sonar / 80) * 45)),
          boost: curSnap.shield > 0 || curSnap.sonar > 0,
          tone: 'violet',
        },
        {
          lbl: 'Depth · Bar',
          val: `+${curSnap.depth}m · +${curSnap.bar}b`,
          delta: formatDeltaBadge(d('depth'), 'm') || formatDeltaBadge(d('bar'), 'b'),
          pct: Math.min(100, Math.max(0, (curSnap.depth / 28) * 50 + (curSnap.bar / 50) * 50)),
          boost: curSnap.depth > 0 || curSnap.bar > 0,
          tone: 'emerald',
        },
      ];

      previewBarsEl.innerHTML = meters
        .map(
          (m) => `
            <div class="codex-meter">
              <div class="codex-meter-top">
                <span class="codex-meter-lbl">${escapeHtml(m.lbl)}</span>
                <span class="codex-meter-vals${m.boost ? ' boosted' : ''}">${m.delta}${escapeHtml(m.val)}</span>
              </div>
              <div class="codex-meter-track">
                <div class="codex-meter-fill ${m.tone}" style="width:${m.pct.toFixed(1)}%"></div>
              </div>
            </div>
          `
        )
        .join('');
    }

    prevSnap = curSnap;

    // Interactive mixed slot chips (click any chip to clear that slot back to stock!)
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
            `<button type="button" class="codex-slot-tag${isHighlight ? ' highlight' : ''}" data-clear-slot="${escapeHtml(sl)}" title="Remove ${escapeHtml(entry.item.name)}">${escapeHtml(meta.icon)} ${escapeHtml(entry.item.name)} <span class="codex-slot-x">✕</span></button>`
          );
        }
      }
      previewSlotsEl.innerHTML = tags.length
        ? tags.join('')
        : '<span class="codex-slot-tag static">📦 Stock Baseline</span>';
    }

    if (btnEquipRig) {
      if (ownedSlotsToApply > 0) {
        btnEquipRig.hidden = false;
        btnEquipRig.textContent = `⚡ Equip ${ownedSlotsToApply} Owned to My Rig`;
      } else {
        btnEquipRig.hidden = true;
      }
    }
  }

  function commitMixUpdate(nextLivery, toastMsg = '') {
    previewLivery = sanitizeRigLivery(nextLivery);
    renderMainContent();
    renderPreviewPanel(true);
    if (toastMsg) showToast(toastMsg);
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

  searchInput?.addEventListener('input', () => {
    state.query = searchInput.value || '';
    renderMainContent();
  });

  ownedToggleBtn?.addEventListener('click', () => {
    state.ownedOnly = !state.ownedOnly;
    ownedToggleBtn.classList.toggle('active', state.ownedOnly);
    ownedToggleBtn.setAttribute('aria-pressed', state.ownedOnly ? 'true' : 'false');
    renderMainContent();
  });

  // Card / piece / set mix toggling
  contentEl?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('button[data-action]');
    const el = btn || e.target?.closest?.('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'toggle-set') {
      const s = codexData.sets.find((x) => x.id === el.dataset.setId);
      if (!s) return;
      const alreadyFull = countSetInMix(s) >= s.pieces.length;
      if (alreadyFull) {
        const next = { ...previewLivery };
        for (const p of s.pieces) next[p.field] = DEFAULT_RIG_LIVERY[p.field];
        commitMixUpdate(next, `Removed ${s.name}`);
      } else {
        const next = applyCodexSetToLivery(previewLivery, s);
        commitMixUpdate(next, `+ Mixed ${s.name}`);
      }
    } else if (action === 'toggle-item') {
      const slot = el.dataset.slot;
      const id = el.dataset.id;
      const meta = CODEX_SLOT_META[slot];
      const entry = codexData.byKey.get(`${slot}:${id}`);
      if (!meta || !entry) return;
      if (previewLivery[meta.field] === id) {
        const next = { ...previewLivery, [meta.field]: DEFAULT_RIG_LIVERY[meta.field] };
        commitMixUpdate(next, `Removed ${entry.item.name}`);
      } else {
        const next = applyCodexItemToLivery(previewLivery, slot, id);
        commitMixUpdate(next, `+ ${entry.item.name}`);
      }
    } else if (action === 'equip-item') {
      e.stopPropagation();
      const slot = el.dataset.slot;
      const id = el.dataset.id;
      const entry = codexData.byKey.get(`${slot}:${id}`);
      if (!entry || !entry.owned) return;
      savedLivery = applyCodexItemToLivery(savedLivery, slot, id);
      saveLivery(savedLivery);
      commitMixUpdate(applyCodexItemToLivery(previewLivery, slot, id), `⚡ Equipped ${entry.item.name}`);
    }
  });

  // Click any slot chip in the right tray to clear that single slot
  previewSlotsEl?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('[data-clear-slot]');
    if (!btn) return;
    const sl = btn.dataset.clearSlot;
    const meta = CODEX_SLOT_META[sl];
    if (!meta) return;
    const next = { ...previewLivery, [meta.field]: DEFAULT_RIG_LIVERY[meta.field] };
    commitMixUpdate(next);
  });

  // Top bar presets
  btnAllLegendary?.addEventListener('click', () => {
    commitMixUpdate(buildAllLegendaryPreviewRig(codexData), '🔥 All 9 Legendaries');
  });

  btnResetPreview?.addEventListener('click', () => {
    commitMixUpdate(savedLivery, '↺ Loaded your saved rig');
  });

  btnClearMix?.addEventListener('click', () => {
    commitMixUpdate(DEFAULT_RIG_LIVERY, '📦 Cleared to stock baseline');
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
      renderMainContent();
      renderPreviewPanel(false);
      showToast(`⚡ Equipped ${applied} owned piece${applied > 1 ? 's' : ''}!`);
    }
  });

  // Re-sync per-set diver canvases cleanly on viewport resize
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.tab === 'sets') renderSetCardDivers();
    }, 90);
  });

  // Initial render
  renderMainContent();
  renderPreviewPanel(false);

  // Live 60 FPS animation loop for BOTH the top Live Mixer diver AND all visible Armor Set card divers!
  const startMs = performance.now();
  const tick = (now) => {
    if (!document.hidden) {
      const t = (now - startMs) * 0.001;
      if (previewCanvas) {
        renderDiverCanvasHiDpi(previewCanvas, previewLivery, t, 0.72);
      }
      if (state.tab === 'sets' && activeSetCanvases.length) {
        renderSetCardDivers(t, true);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGearCodexPage);
  } else {
    initGearCodexPage();
  }
}
