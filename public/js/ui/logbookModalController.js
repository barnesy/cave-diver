import { escapeHtml } from '../util/common.js';
import { LEVELS, getLevelMaxDepthM } from '../levels/index.js';
import {
  mergeCareerLogbooks,
  formatLogbookSummary,
  computeCertifications,
  getDailyStatus,
  setPinnedArtifactInLogbook,
  getArtifactVaultStats,
  ARTIFACT_COLLECTIONS,
  getFieldGuideStats,
  exportLogbookToCsv,
  exportLogbookToJson,
  parseImportedLogbookJson,
} from '../game/logbookModel.js';
import { drawStyledArtifact } from '../game/artSprites.js';
import { getCollectibleLoreNote } from '../game/submergedStories.js';
import { renderFieldGuideCollectorCard, filterAndSortFieldGuide } from '../game/photoStudio.js';
import { RESCUE_DRILLS } from '../game/rescueDrills.js';

const LORE_CATALOG = [
  { kind: 'air-dome', icon: '🫧', title: 'Trapped Air Dome' },
  { kind: 'speleothem-cathedral', icon: '🏛️', title: 'Speleothem Cathedral' },
  { kind: 'halocline-lens', icon: '🌊', title: 'Halocline Lens' },
  { kind: 'emergency-lamp', icon: '🚨', title: 'Emergency Bulkhead Lamp' },
  { kind: 'brass-telegraph', icon: '🧭', title: 'Chadburn Telegraph' },
  { kind: 'ship-wheel', icon: '⚓', title: 'Corroded Ship Helm' },
  { kind: 'porthole-shaft', icon: '🔆', title: 'Bronze Porthole Shaft' },
  { kind: 'boiler-panel', icon: '⚙️', title: 'Steam Boiler Manifold' },
  { kind: 'mayan-vessel', icon: '🏺', title: 'Mayan Offering Vessel' },
  { kind: 'mine-timber', icon: '⛏️', title: 'Flooded Mine Shoring' },
  { kind: 'ice-arch', icon: '🧊', title: 'Subglacial Blue-Ice Arch' },
  { kind: 'fossil-bed', icon: '🐚', title: 'Ammonite Fossil Wall' },
  { kind: 'survey-station', icon: '📍', title: 'Explorer Survey Piton' },
];

export function formatBottomTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

function downloadTextFile(filename, content, mimeType) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch {
    return false;
  }
}

/**
 * Career Logbook, Artifact Trophy Vault, 3D Specimen Inspector, Field Guide & Backup Export/Import (modularized v172).
 */
export function createLogbookModalController({
  lan,
  github,
  loadCareerLogbook,
  saveCareerLogbook,
  loadGhostTrack,
  getEnteredCallsign,
  getDiverName,
  setHomeMenuOpen,
  renderModeBadgeHtml,
  formatRunClock,
  renderGitHubAccountUi,
  renderCareerSummary,
  renderTechGearDock,
  renderDailyChallengeCard,
  populateLevelSelect,
  renderLevelCards,
  showToast,
  els,
}) {
  const {
    btnOpenLogbook,
    btnProgressPill,
    modalLogbook,
    btnLogbookClose,
    logbookKpisEl,
    logbookCertsEl,
    logbookSitesEl,
    logbookSubEl,
  } = els;

  const artifactInspectorModalEl = document.getElementById('modal-artifact-inspector');
  const artifactInspectorColEl = document.getElementById('artifact-inspector-collection');
  const artifactInspectorTitleEl = document.getElementById('artifact-inspector-title');
  const artifactInspectorMetaEl = document.getElementById('artifact-inspector-meta');
  const artifactInspectorLoreEl = document.getElementById('artifact-inspector-lore');
  const artifactInspectorCanvasEl = document.getElementById('artifact-inspector-canvas');
  const btnArtifactInspectorClose = document.getElementById('btn-artifact-inspector-close');
  const btnArtifactInspectorDone = document.getElementById('btn-artifact-inspector-done');
  const btnArtifactPin = document.getElementById('btn-artifact-pin');

  let activeInspectorArtifact = null;
  let inspectorAnimRaf = 0;
  let inspectorLightAngle = 0.65;
  let inspectorDragging = false;
  let activeVaultCollectionFilter = 'all';
  let vaultVisibleLimit = 48;

  let fgFilterMode = 'all';
  let fgSortMode = 'catalog';
  let activeFgCardEntry = null;
  const fgFilterTabsEl = document.getElementById('fg-filter-tabs');
  const fgSortSelectEl = document.getElementById('fg-sort-select');
  const fgCardModalEl = document.getElementById('fg-card-modal');
  const fgCardTitleEl = document.getElementById('fg-card-title');
  const fgCardSubEl = document.getElementById('fg-card-sub');
  const fgCardCanvasEl = document.getElementById('fg-card-canvas');
  const fgCardCtx = fgCardCanvasEl?.getContext?.('2d') || null;
  const btnFgCardClose = document.getElementById('btn-fg-card-close');
  const btnFgCardDownload = document.getElementById('btn-fg-card-download');
  const btnFgCardShare = document.getElementById('btn-fg-card-share');

  function drawInspectorStage(tSec) {
    if (!artifactInspectorCanvasEl || !activeInspectorArtifact) return;
    const ctx = artifactInspectorCanvasEl.getContext?.('2d');
    if (!ctx) return;
    const w = artifactInspectorCanvasEl.width;
    const h = artifactInspectorCanvasEl.height;
    ctx.clearRect(0, 0, w, h);

    const lx = w * 0.5 + Math.cos(inspectorLightAngle) * (w * 0.28);
    const ly = h * 0.45 + Math.sin(inspectorLightAngle) * (h * 0.24);
    const spot = ctx.createRadialGradient(lx, ly, 8, w * 0.5, h * 0.5, w * 0.54);
    spot.addColorStop(0, 'rgba(254, 243, 199, 0.34)');
    spot.addColorStop(0.45, 'rgba(56, 189, 248, 0.14)');
    spot.addColorStop(1, 'rgba(2, 8, 18, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.82, w * 0.26, h * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = Math.sin(tSec * 2.1) * 4;
    drawStyledArtifact(
      ctx,
      activeInspectorArtifact,
      w * 0.5,
      h * 0.48 + bob,
      w * 0.31,
      tSec + inspectorLightAngle * 1.4,
      { index: 0, isGrand: true }
    );
  }

  function stepInspectorAnim(nowMs) {
    if (!artifactInspectorModalEl || artifactInspectorModalEl.hidden || !activeInspectorArtifact) {
      inspectorAnimRaf = 0;
      return;
    }
    drawInspectorStage(nowMs / 1000);
    inspectorAnimRaf = requestAnimationFrame(stepInspectorAnim);
  }

  function updateInspectorPinButton() {
    if (!btnArtifactPin || !activeInspectorArtifact) return;
    const book = loadCareerLogbook();
    const isPinned = book.pinnedArtifactId === activeInspectorArtifact.id;
    btnArtifactPin.textContent = isPinned ? '★ Pinned to Postcard (Unpin)' : '📌 Pin to Expedition Postcard';
    btnArtifactPin.classList.toggle('secondary', isPinned);
    btnArtifactPin.classList.toggle('primary', !isPinned);
  }

  function openArtifactInspector(item) {
    if (!artifactInspectorModalEl || !item) return;
    activeInspectorArtifact = item;
    const col = ARTIFACT_COLLECTIONS.find((c) => c.id === item.collectionId);
    if (artifactInspectorColEl) {
      artifactInspectorColEl.textContent = col ? `${col.icon} ${col.title.toUpperCase()}` : '🏛️ MUSEUM SPECIMEN';
    }
    if (artifactInspectorTitleEl) artifactInspectorTitleEl.textContent = item.name || 'Recovered Artifact';
    if (artifactInspectorMetaEl) {
      const parts = [`+${item.points || 0} PTS`];
      if (item.siteName) parts.push(item.siteName);
      if (item.bestClearSec > 0) {
        const mm = Math.floor(item.bestClearSec / 60);
        const ss = String(item.bestClearSec % 60).padStart(2, '0');
        parts.push(`⏱ Best Clear ${mm}:${ss}`);
      }
      if ((item.count || 1) > 1) parts.push(`Recovered ×${item.count}`);
      artifactInspectorMetaEl.textContent = parts.join(' · ');
    }
    if (artifactInspectorLoreEl) {
      const siteObj = LEVELS.find((l) => l.id === item.siteId) || null;
      artifactInspectorLoreEl.textContent =
        item.lore || getCollectibleLoreNote(item, siteObj) || 'Preserved in your Career Artifact Trophy Vault.';
    }
    updateInspectorPinButton();
    artifactInspectorModalEl.hidden = false;
    inspectorLightAngle = 0.65;
    if (inspectorAnimRaf) cancelAnimationFrame(inspectorAnimRaf);
    inspectorAnimRaf = requestAnimationFrame(stepInspectorAnim);
  }

  function closeArtifactInspector() {
    if (inspectorAnimRaf) {
      cancelAnimationFrame(inspectorAnimRaf);
      inspectorAnimRaf = 0;
    }
    activeInspectorArtifact = null;
    if (artifactInspectorModalEl) artifactInspectorModalEl.hidden = true;
  }

  function renderArtifactVaultSection(
    bookOverride = null,
    vaultHeading = document.getElementById('logbook-vault-heading'),
    collectionsBar = document.getElementById('logbook-collections-bar'),
    vaultGrid = document.getElementById('logbook-artifact-vault')
  ) {
    if (!vaultGrid) return;
    const book = bookOverride || loadCareerLogbook();
    const vault = getArtifactVaultStats(book, LEVELS);
    const colProg = vault.collections;
    if (vaultHeading) {
      const rankTxt = colProg?.highestCuratorTitle ? ` · ${colProg.highestCuratorTitle.toUpperCase()}` : '';
      vaultHeading.textContent = `🏛️ ARTIFACT TROPHY VAULT (${vault.recoveredCount}/${vault.totalCatalog} RECOVERED · ${vault.totalValue.toLocaleString()} PTS${rankTxt})`;
    }
    if (collectionsBar && colProg?.collections) {
      collectionsBar.innerHTML = colProg.collections
        .map(
          (c) => `<button type="button" class="collection-chip${c.completed ? ' completed' : ''}${activeVaultCollectionFilter === c.id ? ' active' : ''}" data-collection-id="${c.id}" aria-pressed="${activeVaultCollectionFilter === c.id ? 'true' : 'false'}" title="Filter by ${escapeHtml(c.title)} · Unlocks Curator Title: ${escapeHtml(c.curatorTitle)}">
          <div class="collection-chip-top">
            <span>${c.icon} ${escapeHtml(c.title)}</span>
            <span>${c.recovered}/${c.targetCount}</span>
          </div>
          <div class="collection-chip-prog"><div class="collection-chip-fill" style="width:${c.pct}%;background:${c.accent}"></div></div>
          <div class="collection-chip-title">${c.completed ? `★ ${escapeHtml(c.curatorTitle)}` : `Goal: ${escapeHtml(c.curatorTitle)}`}</div>
        </button>`
        )
        .join('');
      collectionsBar.querySelectorAll('button.collection-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = btn.getAttribute('data-collection-id') || 'all';
          activeVaultCollectionFilter = activeVaultCollectionFilter === cid ? 'all' : cid;
          vaultVisibleLimit = 48;
          renderArtifactVaultSection(book, vaultHeading, collectionsBar, vaultGrid);
        });
      });
    }
    if (vault.items.length === 0) {
      vaultGrid.innerHTML = `<div class="vault-empty-note">Explore cave chambers and shipwreck holds to recover relics, fossils, watches &amp; instruments for your Trophy Vault.</div>`;
      return;
    }
    const filteredItems =
      activeVaultCollectionFilter === 'all'
        ? vault.items
        : vault.items.filter((it) => it.collectionId === activeVaultCollectionFilter);
    if (filteredItems.length === 0) {
      vaultGrid.innerHTML = `<div class="vault-empty-note">No relics recovered in this collection yet. Click the active collection badge above to show all ${vault.items.length} relics.</div>`;
      return;
    }
    const visibleItems = filteredItems.slice(0, vaultVisibleLimit);
    const remaining = filteredItems.length - visibleItems.length;
    vaultGrid.innerHTML =
      visibleItems
        .map(
          (it, idx) => `<button type="button" class="vault-card${it.pinned ? ' pinned' : ''}" data-vault-idx="${idx}" title="Inspect ${escapeHtml(it.name)}${it.siteName ? ` · ${escapeHtml(it.siteName)}` : ''}">
          ${it.pinned ? '<span class="vault-pin-badge" title="Pinned to Postcard">★</span>' : ''}
          <canvas class="vault-art-canvas" data-vault-idx="${idx}" width="104" height="104" aria-hidden="true"></canvas>
          <div class="vault-card-name">${escapeHtml(it.name)}</div>
          <div class="vault-card-meta">+${it.points} pts${it.count > 1 ? ` · ×${it.count}` : ''}</div>
          ${it.siteName ? `<div class="vault-card-site">${escapeHtml(it.siteName)}</div>` : ''}
        </button>`
        )
        .join('') +
      (remaining > 0
        ? `<button type="button" class="vault-card vault-more-btn" data-vault-more="1" title="Show more relics">
          <div class="vault-card-name">+${remaining} More Relics</div>
          <div class="vault-card-meta">Show next ${Math.min(48, remaining)}</div>
        </button>`
        : '');
    vaultGrid.querySelectorAll('canvas.vault-art-canvas').forEach((cv) => {
      const idx = Number(cv.getAttribute('data-vault-idx'));
      const it = visibleItems[idx];
      const ctx = cv.getContext?.('2d');
      if (!ctx || !it) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      drawStyledArtifact(ctx, it, cv.width * 0.5, cv.height * 0.5, cv.width * 0.34, 2.2, {
        index: idx,
        isGrand: (it.scale || 1) >= 1.35 || it.pinned,
      });
    });
    vaultGrid.querySelectorAll('button.vault-card[data-vault-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-vault-idx'));
        const it = visibleItems[idx];
        if (it) openArtifactInspector(it);
      });
    });
    vaultGrid.querySelector('button[data-vault-more]')?.addEventListener('click', () => {
      vaultVisibleLimit += 48;
      renderArtifactVaultSection(book, vaultHeading, collectionsBar, vaultGrid);
    });
  }

  function renderFieldGuideGallery(
    bookOverride = null,
    fgHeading = document.getElementById('logbook-field-guide-heading'),
    fgTrophyEl = document.getElementById('logbook-fg-trophy'),
    fgGrid = document.getElementById('logbook-field-guide-grid')
  ) {
    if (!fgGrid) return;
    const book = bookOverride || loadCareerLogbook();
    const fgStats = getFieldGuideStats(book);
    if (fgHeading) {
      fgHeading.textContent = `EXPEDITION FIELD GUIDE (${fgStats.discoveredCount}/${fgStats.totalCount} PHOTOGRAPHED)`;
    }
    if (fgTrophyEl) {
      fgTrophyEl.innerHTML = `
      <div class="fg-trophy-top">
        <span class="fg-trophy-rank">${escapeHtml(fgStats.naturalistRank)}</span>
        <div class="fg-trophy-pills">
          <span class="fg-trophy-pill gold">★★★ ${fgStats.goldCount}/${fgStats.totalCount}</span>
          <span class="fg-trophy-pill">🐋 Rare/Epic ${fgStats.rareDiscovered}/${fgStats.rareTotal}</span>
          <span class="fg-trophy-pill">📷 ${fgStats.totalPhotos} shots</span>
        </div>
      </div>
      <div class="fg-trophy-bar"><div class="fg-trophy-fill" style="width:${fgStats.pct}%"></div></div>
    `;
    }
    const filtered = filterAndSortFieldGuide(fgStats.entries, { filter: fgFilterMode, sort: fgSortMode });
    if (filtered.length === 0) {
      fgGrid.innerHTML = `<div class="fg-empty-note">No specimens match this filter yet — snap underwater wildlife with <strong>[C]</strong> or freeze-frame Photo Studio <strong>[O]</strong>!</div>`;
      return;
    }
    fgGrid.innerHTML = filtered
      .map((e) => {
        if (!e.discovered) {
          return `
          <div class="fg-card locked">
            <span class="fg-icon" aria-hidden="true">${e.icon}</span>
            <div class="fg-copy">
              <div class="fg-head"><strong>??? (${e.rarity.toUpperCase()})</strong></div>
              <span class="fg-meta">Habitat: ${escapeHtml(e.habitat)}</span>
            </div>
          </div>`;
        }
        const stars = '★'.repeat(e.bestStars) + '☆'.repeat(3 - e.bestStars);
        const sightTxt = e.bestSiteName ? `${e.bestSiteName} · ×${e.count}` : `×${e.count} Logged`;
        const depthTxt = e.bestDepthM > 0 ? `${Math.round(e.bestDepthM)}m` : 'Shallow';
        return `
        <div class="fg-card clickable rarity-${e.rarity}${e.bestStars >= 3 ? ' gold-star' : ''}" data-fg-entry="${e.id}" role="button" tabindex="0" title="Inspect &amp; share ${escapeHtml(e.name)} collector card">
          <span class="fg-icon" aria-hidden="true">${e.icon}</span>
          <div class="fg-copy">
            <div class="fg-head"><strong>${escapeHtml(e.name)}</strong><span class="fg-stars">${stars}</span></div>
            <span class="fg-latin">${escapeHtml(e.latin)}</span>
            <span class="fg-meta">${escapeHtml(sightTxt)}</span>
            <div class="fg-badge-strip">
              <span class="fg-depth-badge">⬇ ${escapeHtml(depthTxt)}</span>
              <span class="fg-rarity-badge ${e.rarity}">${escapeHtml(e.rarity)}</span>
              <span class="fg-card-cta">🪪 Card</span>
            </div>
          </div>
        </div>`;
      })
      .join('');
  }

  function openFieldGuideCardModal(entryId) {
    if (!fgCardModalEl || !entryId) return;
    const book = loadCareerLogbook();
    const fgStats = getFieldGuideStats(book);
    const entry = fgStats.entries.find((e) => e.id === entryId && e.discovered);
    if (!entry) return;
    activeFgCardEntry = entry;
    if (fgCardTitleEl) fgCardTitleEl.textContent = `${entry.icon} ${entry.name}`;
    if (fgCardSubEl) {
      const stars = '★'.repeat(entry.bestStars) + '☆'.repeat(3 - entry.bestStars);
      fgCardSubEl.textContent = `${entry.latin} · ${stars} · ${entry.bestDepthM > 0 ? `${Math.round(entry.bestDepthM)}m` : 'Shallow'} · ${entry.bestSiteName || 'Expedition Archive'}`;
    }
    const verMeta = document.querySelector('meta[name="app-version"]')?.content || '172';
    if (fgCardCtx && fgCardCanvasEl) {
      renderFieldGuideCollectorCard(fgCardCtx, {
        width: fgCardCanvasEl.width,
        height: fgCardCanvasEl.height,
        entry,
        diverName: getEnteredCallsign() || 'Expedition Diver',
        fgStats,
        version: `v${verMeta}`,
      });
    }
    if (btnFgCardShare) {
      btnFgCardShare.hidden = typeof navigator?.share !== 'function';
    }
    fgCardModalEl.hidden = false;
  }

  function closeFieldGuideCardModal() {
    if (fgCardModalEl) fgCardModalEl.hidden = true;
  }

  function openLogbookModal() {
    if (!modalLogbook) return;
    setHomeMenuOpen(false);
    const book = loadCareerLogbook();
    const sum = formatLogbookSummary(book, LEVELS.length);
    const certInfo = computeCertifications(book, LEVELS);
    const locked = Boolean(lan.room && !lan.isHost());

    if (logbookSubEl) {
      const rankStr = certInfo.highest ? `${certInfo.highest.icon} ${certInfo.highest.title}` : sum.campaignMedal;
      logbookSubEl.textContent = certInfo.next
        ? `Current Rank: ${rankStr} · Next: ${certInfo.next.title} (${certInfo.next.requirement})`
        : `Current Rank: ${rankStr} · All Technical Certifications Earned!`;
    }
    if (logbookKpisEl) {
      const dailyStatus = getDailyStatus(book);
      const fgStats = getFieldGuideStats(book);
      logbookKpisEl.innerHTML = `
      <div class="logbook-kpi"><span>Cleared</span><strong>${sum.clearedCount}/${sum.totalSites}</strong></div>
      <div class="logbook-kpi"><span>Dives</span><strong>${sum.totalDives}</strong></div>
      <div class="logbook-kpi"><span>Bottom Time</span><strong>${formatBottomTime(sum.totalTimeSec)}</strong></div>
      <div class="logbook-kpi"><span>Deepest</span><strong>${sum.deepestM.toFixed(0)}m</strong></div>
      <div class="logbook-kpi"><span>S-Ranks</span><strong>${certInfo.sGrades}</strong></div>
      <div class="logbook-kpi"><span>Daily Streak</span><strong>🔥 ${dailyStatus.activeStreak}d${dailyStatus.bestStreak > 0 ? ` · Best ${dailyStatus.bestStreak}d` : ''}</strong></div>
      <div class="logbook-kpi"><span>Field Guide</span><strong>📷 ${fgStats.discoveredCount}/${fgStats.totalCount}</strong></div>
      <div class="logbook-kpi"><span>Contracts</span><strong>📋 ${book.milestones?.contractsCompleted || 0}</strong></div>
    `;
    }
    if (logbookCertsEl) {
      logbookCertsEl.innerHTML = certInfo.certs
        .map((c) => {
          const pct = Math.max(0, Math.min(100, Number(c.progressPct) || (c.earned ? 100 : 0)));
          const progLine = !c.earned && c.progressText
            ? `<div class="logbook-cert-prog"><div class="logbook-cert-bar"><div class="logbook-cert-fill" style="width:${pct}%"></div></div><em>${escapeHtml(c.progressText)}</em></div>`
            : '';
          return `
        <div class="logbook-cert-card ${c.earned ? '' : 'locked'}${c.specialty ? ' specialty' : ''}">
          <span class="logbook-cert-icon" aria-hidden="true">${c.earned ? c.icon : '🔒'}</span>
          <div class="logbook-cert-copy">
            <strong>${escapeHtml(c.title)}</strong>
            <span>${escapeHtml(c.requirement)}</span>
            ${progLine}
          </div>
        </div>`;
        })
        .join('');
    }
    const drillsHeading = document.getElementById('logbook-drills-heading');
    const drillsGrid = document.getElementById('logbook-drills-grid');
    if (drillsGrid) {
      const dm = book.drillMastery || {};
      const clearedDrills = RESCUE_DRILLS.filter((d) => Boolean(dm[d.id])).length;
      if (drillsHeading) {
        drillsHeading.textContent = `⚡ TECHNICAL RESCUE DRILLS MASTERY (${clearedDrills}/${RESCUE_DRILLS.length})`;
      }
      drillsGrid.innerHTML = RESCUE_DRILLS.map((d) => {
        const rec = dm[d.id] || null;
        return `
          <div class="drill-mastery-card${rec ? ' cleared' : ' locked'}">
            <span class="drill-mastery-icon" aria-hidden="true">${rec ? d.icon : '🔒'}</span>
            <div class="drill-mastery-copy">
              <strong>${escapeHtml(d.shortName)}</strong>
              <span>${rec ? `Best ${escapeHtml(rec.bestGrade)} · ${rec.bestTimeSec.toFixed(0)}s (Par ${d.parTimeSec}s)` : `Par ${d.parTimeSec}s · Not yet mastered`}</span>
            </div>
          </div>`;
      }).join('');
    }
    const fgHeading = document.getElementById('logbook-field-guide-heading');
    const fgTrophyEl = document.getElementById('logbook-fg-trophy');
    const fgGrid = document.getElementById('logbook-field-guide-grid');
    if (fgGrid) {
      renderFieldGuideGallery(book, fgHeading, fgTrophyEl, fgGrid);
    }
    const vaultHeading = document.getElementById('logbook-vault-heading');
    const collectionsBar = document.getElementById('logbook-collections-bar');
    const vaultGrid = document.getElementById('logbook-artifact-vault');
    if (vaultGrid) {
      renderArtifactVaultSection(book, vaultHeading, collectionsBar, vaultGrid);
    }
    const loreHeading = document.getElementById('logbook-lore-heading');
    const loreGrid = document.getElementById('logbook-lore-grid');
    if (loreGrid) {
      const arch = book.loreArchive || {};
      const foundCnt = LORE_CATALOG.filter((it) => arch[it.kind]).length;
      if (loreHeading) {
        loreHeading.textContent = `SUBMERGED LORE ARCHIVE (${foundCnt}/${LORE_CATALOG.length} DISCOVERED)`;
      }
      loreGrid.innerHTML = LORE_CATALOG.map((it) => {
        const rec = arch[it.kind];
        if (!rec) {
          return `<div class="lore-archive-card locked"><div class="lore-archive-head"><span>🔒 ${escapeHtml(it.title)}</span><span class="lore-archive-badge">Unexplored</span></div><div class="lore-archive-body">Illuminate with your primary dive torch during an expedition to archive.</div></div>`;
        }
        return `<div class="lore-archive-card"><div class="lore-archive-head"><span>${it.icon} ${escapeHtml(rec.title || it.title)}</span><span class="lore-archive-badge">×${rec.count || 1}</span></div><div class="lore-archive-body">${escapeHtml(rec.sampleLore || '')}</div>${rec.firstSiteName ? `<div class="lore-archive-site">First logged: ${escapeHtml(rec.firstSiteName)}</div>` : ''}</div>`;
      }).join('');
    }
    if (logbookSitesEl) {
      const sitesHeading = document.getElementById('logbook-sites-heading');
      if (sitesHeading) sitesHeading.textContent = `EXPEDITION MASTERY (${LEVELS.length} SITES)`;
      logbookSitesEl.innerHTML = LEVELS.map((lvl, idx) => {
        const rec = book.cleared?.[lvl.id] || null;
        const grade = rec?.grade || '—';
        const gradeCls = grade.startsWith('S') ? 'grade-s' : grade === 'A' ? 'grade-a' : '';
        const scoreTxt = rec ? `${rec.score.toLocaleString()} pts` : `${getLevelMaxDepthM(lvl)}m`;
        const timeTxt = rec?.bestTimeSec > 0 ? formatRunClock(rec.bestTimeSec) : (lvl.isWreck ? 'Wreck' : 'Cave');
        const modeBadge = renderModeBadgeHtml(rec?.bestDifficulty || rec?.lastDifficulty, { compact: true });
        const hasPbTrack = Boolean(loadGhostTrack(lvl.id));
        return `
        <div class="logbook-site-row ${rec ? 'cleared' : ''}">
          <span class="logbook-site-num">L${idx + 1}</span>
          <span class="logbook-site-name">${lvl.isWreck ? '🚢 ' : ''}${escapeHtml(lvl.name)}</span>
          <span class="logbook-site-stat">${escapeHtml(scoreTxt)} · ${escapeHtml(timeTxt)}</span>
          ${rec ? `<span class="lvl-card-badges">${modeBadge}<span class="lvl-grade-badge ${gradeCls}">${escapeHtml(grade)}</span></span>` : '<span class="logbook-site-stat">—</span>'}
          <span class="logbook-site-actions">
            ${hasPbTrack ? `<button type="button" class="btn tiny secondary" data-logbook-replay="${lvl.id}" title="Watch PB Track Replay &amp; Share Card">🎬</button>` : ''}
            <button type="button" class="btn tiny ghost" data-logbook-jump="${lvl.id}" ${locked ? 'disabled' : ''}>Select</button>
          </span>
        </div>`;
      }).join('');
    }
    if (modalLogbook) {
      renderGitHubAccountUi();
      modalLogbook.hidden = false;
    }
  }

  function closeLogbookModal() {
    closeArtifactInspector();
    if (modalLogbook) modalLogbook.hidden = true;
  }

  // Wire Artifact Inspector events
  if (artifactInspectorCanvasEl) {
    const updateLightFromEvent = (ev) => {
      const rect = artifactInspectorCanvasEl.getBoundingClientRect();
      if (!rect.width) return;
      const dx = ev.clientX - (rect.left + rect.width * 0.5);
      const dy = ev.clientY - (rect.top + rect.height * 0.5);
      inspectorLightAngle = Math.atan2(dy, dx);
    };
    artifactInspectorCanvasEl.addEventListener('pointerdown', (ev) => {
      inspectorDragging = true;
      artifactInspectorCanvasEl.setPointerCapture?.(ev.pointerId);
      updateLightFromEvent(ev);
    });
    artifactInspectorCanvasEl.addEventListener('pointermove', (ev) => {
      if (!inspectorDragging) return;
      updateLightFromEvent(ev);
    });
    const endDrag = () => { inspectorDragging = false; };
    artifactInspectorCanvasEl.addEventListener('pointerup', endDrag);
    artifactInspectorCanvasEl.addEventListener('pointercancel', endDrag);
  }
  btnArtifactInspectorClose?.addEventListener('click', closeArtifactInspector);
  btnArtifactInspectorDone?.addEventListener('click', closeArtifactInspector);
  artifactInspectorModalEl?.addEventListener('click', (e) => {
    if (e.target === artifactInspectorModalEl) closeArtifactInspector();
  });
  btnArtifactPin?.addEventListener('click', () => {
    if (!activeInspectorArtifact) return;
    const cur = loadCareerLogbook();
    const nextId = cur.pinnedArtifactId === activeInspectorArtifact.id ? '' : activeInspectorArtifact.id;
    const nextBook = setPinnedArtifactInLogbook(cur, nextId);
    saveCareerLogbook(nextBook);
    updateInspectorPinButton();
    renderArtifactVaultSection(nextBook);
    showToast(nextId ? `★ Pinned ${activeInspectorArtifact.name} to your Expedition Postcard!` : 'Unpinned showcase relic.', 2.6);
  });

  // Wire Logbook open/close & Field Guide events
  btnOpenLogbook?.addEventListener('click', openLogbookModal);
  btnProgressPill?.addEventListener('click', openLogbookModal);
  btnLogbookClose?.addEventListener('click', closeLogbookModal);

  fgFilterTabsEl?.querySelectorAll('button[data-fg-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-fg-filter') || 'all';
      fgFilterMode = next;
      fgFilterTabsEl.querySelectorAll('button[data-fg-filter]').forEach((b) => {
        const sel = b === btn;
        b.classList.toggle('active', sel);
        b.setAttribute('aria-selected', sel ? 'true' : 'false');
      });
      renderFieldGuideGallery();
    });
  });

  fgSortSelectEl?.addEventListener('change', () => {
    fgSortMode = fgSortSelectEl.value || 'catalog';
    renderFieldGuideGallery();
  });

  const fgGridClickRoot = document.getElementById('logbook-field-guide-grid');
  fgGridClickRoot?.addEventListener('click', (e) => {
    const card = e.target?.closest?.('[data-fg-entry]');
    if (!card) return;
    openFieldGuideCardModal(card.getAttribute('data-fg-entry'));
  });
  fgGridClickRoot?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target?.closest?.('[data-fg-entry]');
    if (!card) return;
    e.preventDefault();
    openFieldGuideCardModal(card.getAttribute('data-fg-entry'));
  });

  btnFgCardClose?.addEventListener('click', closeFieldGuideCardModal);
  fgCardModalEl?.addEventListener('click', (e) => {
    if (e.target === fgCardModalEl) closeFieldGuideCardModal();
  });
  btnFgCardDownload?.addEventListener('click', () => {
    if (!fgCardCanvasEl || !activeFgCardEntry) return;
    try {
      const a = document.createElement('a');
      a.href = fgCardCanvasEl.toDataURL('image/png');
      a.download = `techno-dive-specimen-${activeFgCardEntry.id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast(`🪪 Saved ${activeFgCardEntry.name} Collector Card PNG!`, 2.2);
    } catch {
      showToast('Could not export Collector Card PNG.', 2.0);
    }
  });
  btnFgCardShare?.addEventListener('click', async () => {
    if (!fgCardCanvasEl || !activeFgCardEntry || typeof navigator?.share !== 'function') return;
    try {
      const blob = await new Promise((resolve) => fgCardCanvasEl.toBlob?.(resolve, 'image/png'));
      if (blob && typeof File === 'function') {
        const file = new File([blob], `techno-dive-specimen-${activeFgCardEntry.id}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: `${activeFgCardEntry.name} — Techno Dive Marine Field Guide`,
            text: `Logged ${activeFgCardEntry.name} (${activeFgCardEntry.latin}) at ${Math.round(activeFgCardEntry.bestDepthM || 0)}m!`,
            files: [file],
          });
          return;
        }
      }
      await navigator.share({
        title: `${activeFgCardEntry.name} — Techno Dive Marine Field Guide`,
        text: `Logged ${activeFgCardEntry.name} (${activeFgCardEntry.latin}) at ${Math.round(activeFgCardEntry.bestDepthM || 0)}m!`,
      });
    } catch {}
  });

  // CSV / JSON Export & Import
  const btnLogbookExportCsv = document.getElementById('btn-logbook-export-csv');
  const btnLogbookExportJson = document.getElementById('btn-logbook-export-json');
  btnLogbookExportCsv?.addEventListener('click', () => {
    const book = loadCareerLogbook();
    const csv = exportLogbookToCsv(book, LEVELS);
    const stamp = new Date().toISOString().slice(0, 10);
    if (downloadTextFile(`techno-dive-logbook-${stamp}.csv`, csv, 'text/csv;charset=utf-8')) {
      showToast(`📥 Exported Dive Logbook CSV (${Object.keys(book.cleared).length}/${LEVELS.length} sites)`, 2.6);
    }
  });
  btnLogbookExportJson?.addEventListener('click', () => {
    const book = loadCareerLogbook();
    const appVer = document.querySelector('meta[name="app-version"]')?.content || '';
    const json = exportLogbookToJson(book, LEVELS, {
      diverName: getDiverName() || 'Diver',
      githubLogin: github.getStatus().user?.login || '',
      version: appVer ? `v${appVer}` : '',
    });
    const stamp = new Date().toISOString().slice(0, 10);
    if (downloadTextFile(`techno-dive-logbook-${stamp}.json`, json, 'application/json;charset=utf-8')) {
      showToast('📄 Exported full Dive Logbook & Field Guide JSON!', 2.6);
    }
  });

  const btnLogbookImportJson = document.getElementById('btn-logbook-import-json');
  const inputLogbookImport = document.getElementById('input-logbook-import');
  btnLogbookImportJson?.addEventListener('click', () => {
    if (inputLogbookImport) {
      inputLogbookImport.value = '';
      inputLogbookImport.click();
    }
  });
  inputLogbookImport?.addEventListener('change', async () => {
    const file = inputLogbookImport.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseImportedLogbookJson(text);
      if (!parsed.ok) {
        showToast(`⚠️ Import failed: ${parsed.error}`, 3.0);
        return;
      }
      const merged = mergeCareerLogbooks(loadCareerLogbook(), parsed.book);
      saveCareerLogbook(merged);
      renderCareerSummary();
      renderTechGearDock();
      renderDailyChallengeCard();
      populateLevelSelect();
      renderLevelCards();
      openLogbookModal();
      showToast(
        `📤 Imported & merged ${parsed.siteCount} site clears & ${parsed.fieldGuideCount} Field Guide species!`,
        3.2
      );
    } catch {
      showToast('⚠️ Could not read backup JSON file.', 2.8);
    }
  });

  return {
    artifactInspectorModalEl,
    fgCardModalEl,
    openLogbookModal,
    closeLogbookModal,
    openArtifactInspector,
    closeArtifactInspector,
    renderArtifactVaultSection,
    renderFieldGuideGallery,
    openFieldGuideCardModal,
    closeFieldGuideCardModal,
  };
}
