import { escapeHtml } from '../util/common.js';
import { LEVELS, CAMPAIGN_PLAN, getLevelMeta, getLevelMaxDepthM } from '../levels/index.js';
import {
  GLOBAL_MAP_VIEWBOX,
  MAP_CONTOUR_LINES,
  projectMapPoint,
  computeSiteFocusViewBox,
  formatLatLng,
} from '../game/worldMapData.js';
import { getRecommendedArchetypeForLevel, getWorldGearCachesForSite } from '../game/gearStats.js';

export const SITE_COORDS_BY_ID = new Map(CAMPAIGN_PLAN.map((s) => [s.id, s]));

export function retriggerAnim(el, className) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  const cleanup = () => el.classList.remove(className);
  el.addEventListener('animationend', cleanup, { once: true });
}

/**
 * Interactive Global Dive Map SVG, Site Category Filter, Expedition Cards & Menu Labels (modularized v172).
 */
export function createSiteBrowserController({
  lan,
  renderer,
  loadCareerLogbook,
  getActiveLevel,
  getSavedBestScore,
  getLevelDifficultyLabel,
  renderModeBadgeHtml,
  formatRunClock,
  mapRasterUrl,
  els,
}) {
  const {
    siteWorldMapEl,
    btnMapZoom,
    siteCatTabsEl,
    siteMapRegionBadgeEl,
    siteMapCoordsEl,
    levelCardsEl,
    selectLevel,
    btnPlaySolo,
    screenMenu,
    screenLoader,
    menuDescEl,
    btnDescToggle,
  } = els;

  let siteViewMode = 'split'; // Permanent split view (Map + Expedition Cards) (v198)
  let mapZoomMode = 'global'; // 'global' | 'site'
  let currentMapViewBox = { ...GLOBAL_MAP_VIEWBOX };
  let mapAnimFrameId = 0;
  let mapBaseInitialized = false;
  let siteCategoryFilter = 'all';
  let menuDescExpanded = false;

  function formatViewBox(vb) {
    return `${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`;
  }

  function animateMapViewBox(targetVb, instant = false) {
    if (!siteWorldMapEl) return;
    if (mapAnimFrameId) {
      cancelAnimationFrame(mapAnimFrameId);
      mapAnimFrameId = 0;
    }
    if (
      instant ||
      (Math.abs(currentMapViewBox.x - targetVb.x) < 0.05 &&
        Math.abs(currentMapViewBox.y - targetVb.y) < 0.05 &&
        Math.abs(currentMapViewBox.w - targetVb.w) < 0.05 &&
        Math.abs(currentMapViewBox.h - targetVb.h) < 0.05)
    ) {
      currentMapViewBox = { ...targetVb };
      siteWorldMapEl.setAttribute('viewBox', formatViewBox(currentMapViewBox));
      return;
    }

    const startVb = { ...currentMapViewBox };
    const startTime = performance.now();
    const durationMs = 480;

    const tick = (now) => {
      const rawT = Math.min(1, (now - startTime) / durationMs);
      const ease = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;
      currentMapViewBox = {
        x: startVb.x + (targetVb.x - startVb.x) * ease,
        y: startVb.y + (targetVb.y - startVb.y) * ease,
        w: startVb.w + (targetVb.w - startVb.w) * ease,
        h: startVb.h + (targetVb.h - startVb.h) * ease,
      };
      siteWorldMapEl.setAttribute('viewBox', formatViewBox(currentMapViewBox));
      if (rawT < 1) {
        mapAnimFrameId = requestAnimationFrame(tick);
      } else {
        mapAnimFrameId = 0;
        currentMapViewBox = { ...targetVb };
      }
    };
    mapAnimFrameId = requestAnimationFrame(tick);
  }

  function polylineToSvgPoints(coords) {
    return coords
      .map(([lng, lat]) => {
        const pt = projectMapPoint(lng, lat);
        return `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
      })
      .join(' ');
  }

  function ensureSiteWorldMapBase() {
    if (!siteWorldMapEl || mapBaseInitialized) return;
    mapBaseInitialized = true;

    const defs = `
    <defs>
      <radialGradient id="mapOceanGlow" cx="55%" cy="42%" r="68%">
        <stop offset="0%" stop-color="#0a2540" />
        <stop offset="65%" stop-color="#041425" />
        <stop offset="100%" stop-color="#020a14" />
      </radialGradient>
      <linearGradient id="mapLandFill" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#174469" />
        <stop offset="100%" stop-color="#0d2a44" />
      </linearGradient>
    </defs>
  `;

    const oceanRect = `<rect x="-80" y="-120" width="540" height="440" fill="url(#mapOceanGlow)" />`;

    const gridParts = [];
    for (let lng = -105; lng <= 75; lng += 15) {
      const gx = (lng + 108) * 2;
      const isMajor = lng % 30 === 0;
      gridParts.push(
        `<line x1="${gx}" y1="-40" x2="${gx}" y2="230" vector-effect="non-scaling-stroke" stroke="${
          isMajor ? 'rgba(56,189,248,0.12)' : 'rgba(56,189,248,0.05)'
        }" stroke-width="${isMajor ? 0.8 : 0.5}" ${isMajor ? '' : 'stroke-dasharray="2,3"'} />`
      );
      if (isMajor && lng >= -90 && lng <= 60) {
        const lbl = lng === 0 ? '0°' : `${Math.abs(lng)}°${lng > 0 ? 'E' : 'W'}`;
        gridParts.push(
          `<text x="${(gx + 1.5).toFixed(1)}" y="213" fill="rgba(125,211,252,0.34)" font-size="4.4" font-family="ui-monospace, monospace">${lbl}</text>`
        );
      }
    }
    for (let lat = -45; lat <= 75; lat += 15) {
      const gy = projectMapPoint(0, lat).y;
      const isMajor = lat % 30 === 0;
      gridParts.push(
        `<line x1="-20" y1="${gy.toFixed(2)}" x2="380" y2="${gy.toFixed(2)}" vector-effect="non-scaling-stroke" stroke="${
          isMajor ? 'rgba(56,189,248,0.12)' : 'rgba(56,189,248,0.05)'
        }" stroke-width="${isMajor ? 0.8 : 0.5}" ${isMajor ? '' : 'stroke-dasharray="2,3"'} />`
      );
      if (isMajor && lat >= -30 && lat <= 60) {
        const lbl = lat === 0 ? 'EQ' : `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`;
        gridParts.push(
          `<text x="-7" y="${(gy - 1.5).toFixed(1)}" fill="rgba(125,211,252,0.34)" font-size="4.4" font-family="ui-monospace, monospace">${lbl}</text>`
        );
      }
    }

    const mapRaster = `<image href="${mapRasterUrl}" x="${GLOBAL_MAP_VIEWBOX.x}" y="${GLOBAL_MAP_VIEWBOX.y}" width="${GLOBAL_MAP_VIEWBOX.w}" height="${GLOBAL_MAP_VIEWBOX.h}" preserveAspectRatio="none" />`;

    const trenchPaths = MAP_CONTOUR_LINES.filter((c) => c.kind === 'trench')
      .map(
        ({ coords }) =>
          `<polyline points="${polylineToSvgPoints(coords)}" fill="none" vector-effect="non-scaling-stroke" stroke="rgba(56, 189, 248, 0.28)" stroke-width="0.95" stroke-dasharray="3,3" stroke-linecap="round" stroke-linejoin="round" />`
      )
      .join('');

    siteWorldMapEl.innerHTML = `${defs}<g id="map-base-layer">${oceanRect}${mapRaster}${gridParts.join('')}${trenchPaths}</g><g id="map-overlay-layer"></g>`;
    siteWorldMapEl.setAttribute('viewBox', formatViewBox(currentMapViewBox));
  }

  function setSiteCategoryFilter() {
    siteCategoryFilter = 'all';
  }

  function getFilteredLevels() {
    return LEVELS;
  }

  function renderSiteWorldMap({ instantZoom = false, book: bookOverride = null } = {}) {
    if (!siteWorldMapEl) return;
    ensureSiteWorldMapBase();

    const activeLevel = getActiveLevel();
    const locked = Boolean(lan.room && !lan.isHost());
    const book = bookOverride || loadCareerLogbook();
    const visibleLevels = getFilteredLevels(book);
    const activeSlot = SITE_COORDS_BY_ID.get(activeLevel.id);
    const activeVisible = visibleLevels.some((l) => l.id === activeLevel.id);
    const targetVb =
      mapZoomMode === 'site' && activeVisible
        ? computeSiteFocusViewBox(activeLevel.id, activeSlot)
        : { ...GLOBAL_MAP_VIEWBOX };

    if (btnMapZoom) {
      btnMapZoom.textContent = mapZoomMode === 'site' ? '🌍 World' : '🎯 Focus';
      btnMapZoom.title =
        mapZoomMode === 'site' ? 'Zoom out to full global map' : 'Zoom & pan to active dive site';
    }

    const k = Math.max(0.14, Math.min(1, targetVb.w / GLOBAL_MAP_VIEWBOX.w));
    const isZoomed = mapZoomMode === 'site';

    const pins = visibleLevels.map((lvl) => {
      const idx = Math.max(0, LEVELS.findIndex((l) => l.id === lvl.id));
      const slot = SITE_COORDS_BY_ID.get(lvl.id);
      const pt = projectMapPoint(slot?.lng ?? 0, slot?.lat ?? 20);
      if (!isZoomed) {
        if (lvl.id === 'ox-bel-ha-grand-traverse') {
          pt.y += 2.6;
          pt.x -= 1.2;
        }
        if (lvl.id === 'cenote-el-abismo') {
          pt.y -= 2.2;
          pt.x += 1.0;
        }
        if (lvl.id === 'strytan-hydrothermal-chimneys') {
          pt.x -= 2.4;
          pt.y -= 1.6;
        }
        if (lvl.id === 'grjotagja-kleifarvatn-rift') {
          pt.x += 2.4;
          pt.y -= 0.4;
        }
        if (lvl.id === 'kverkfjoll-subglacial-caves') {
          pt.x += 2.2;
          pt.y += 2.0;
        }
        if (lvl.id === 'silfra-katla-aurora-abyss') {
          pt.x -= 2.0;
          pt.y += 1.4;
        }
        if (lvl.id === 'uss-oriskany-carrier') {
          pt.x -= 2.0;
          pt.y -= 1.6;
        }
      }
      return { lvl, idx, slot, x: pt.x, y: pt.y };
    });

    const routePts = pins.length >= 2 ? pins.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') : '';
    const routeLine = routePts
      ? `<polyline points="${routePts}" fill="none" vector-effect="non-scaling-stroke" stroke="rgba(56, 189, 248, 0.28)" stroke-width="1" stroke-dasharray="3,3" />`
      : '';

    const pinMarkup = pins
      .map(({ lvl, idx, slot, x, y }) => {
        const isSelected = lvl.id === activeLevel.id;
        const isWreck = Boolean(lvl.isWreck || lvl.category === 'wreck');
        const isUnlined = lvl.reelMetersPerDiver > 0;
        const clearRec = book.cleared?.[lvl.id] || null;
        const best = Math.max(getSavedBestScore(lvl.id), clearRec?.score || 0);
        const gradeTag = clearRec?.grade || '';
        const pinColor = isWreck ? '#fb923c' : isUnlined ? '#fbbf24' : '#38bdf8';
        const r = (isSelected ? 5.2 : 3.4) * k;

        const halo = isSelected
          ? `<circle class="map-pin-sonar" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(7.5 * k).toFixed(2)}" vector-effect="non-scaling-stroke" />
           <circle class="map-pin-halo" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(9.0 * k).toFixed(2)}" />`
          : '';
        const crosshair = isSelected
          ? `<g stroke="rgba(224,242,254,0.62)" vector-effect="non-scaling-stroke" stroke-width="1">
             <line x1="${(x - 12 * k).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x - 6.6 * k).toFixed(2)}" y2="${y.toFixed(2)}" />
             <line x1="${(x + 6.6 * k).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x + 12 * k).toFixed(2)}" y2="${y.toFixed(2)}" />
             <line x1="${x.toFixed(2)}" y1="${(y - 12 * k).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y - 6.6 * k).toFixed(2)}" />
             <line x1="${x.toFixed(2)}" y1="${(y + 6.6 * k).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y + 12 * k).toFixed(2)}" />
           </g>`
          : '';
        const ring =
          best > 0
            ? `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(r + 2.0 * k).toFixed(2)}" fill="none" vector-effect="non-scaling-stroke" stroke="#34d399" stroke-width="1.4" />`
            : '';

        let labelMarkup = '';
        if (isSelected || isZoomed) {
          const placeLeft =
            x > targetVb.x + targetVb.w * 0.6 ||
            lvl.id === 'strytan-hydrothermal-chimneys' ||
            lvl.id === 'silfra-katla-aurora-abyss';
          const anchor = placeLeft ? 'end' : 'start';
          const lx = x + (placeLeft ? -7.2 * k : 7.2 * k);
          const ly = y + 3.4 * k;
          const labelText =
            isSelected && isZoomed
              ? `L${idx + 1} · ${lvl.name}${gradeTag ? ` [${gradeTag}]` : ''}`
              : gradeTag
                ? `L${idx + 1}·${gradeTag}`
                : `L${idx + 1}`;
          labelMarkup = `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="${anchor}" fill="${
            isSelected ? '#f0f9ff' : '#bae6fd'
          }" stroke="#020b14" stroke-width="${(3.4 * k).toFixed(2)}" paint-order="stroke" font-size="${(
            (isSelected ? 11.0 : 9.2) * k
          ).toFixed(2)}" font-weight="700" font-family="ui-monospace, monospace">${escapeHtml(labelText)}</text>`;
        }

        return `
        <g class="map-pin-btn ${isSelected ? 'active' : ''} ${locked ? 'locked' : ''}" data-level-id="${lvl.id}" role="option" aria-selected="${isSelected ? 'true' : 'false'}" tabindex="0">
          <title>L${idx + 1}: ${escapeHtml(lvl.name)} (${escapeHtml(slot?.region || '')} · ${getLevelMaxDepthM(lvl)}m)</title>
          ${halo}
          ${crosshair}
          <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(9.0 * k).toFixed(2)}" fill="transparent" />
          ${ring}
          <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="${pinColor}" stroke="#020b14" vector-effect="non-scaling-stroke" stroke-width="1.4" />
          ${labelMarkup}
        </g>
      `;
      })
      .join('');

    const overlayLayer = siteWorldMapEl.querySelector('#map-overlay-layer');
    if (overlayLayer) {
      const emptyBanner =
        pins.length === 0
          ? `<g><rect x="74" y="82" width="210" height="32" rx="10" fill="rgba(2, 11, 20, 0.88)" stroke="rgba(52, 211, 153, 0.55)" stroke-width="1" /><text x="179" y="101.5" text-anchor="middle" fill="#a7f3d0" font-size="9.5" font-weight="700" font-family="ui-monospace, monospace">ALL ${LEVELS.length} EXPEDITIONS CLEARED!</text></g>`
          : '';
      overlayLayer.innerHTML = `${routeLine}${pinMarkup}${emptyBanner}`;
    }

    animateMapViewBox(targetVb, instantZoom);

    const activeIdx = Math.max(0, LEVELS.findIndex((l) => l.id === activeLevel.id));
    if (siteMapRegionBadgeEl) {
      siteMapRegionBadgeEl.textContent = `L${activeIdx + 1} · ${activeSlot?.region || activeLevel.name} · ${getLevelMaxDepthM(activeLevel)}m`;
    }
    if (siteMapCoordsEl && activeSlot) {
      siteMapCoordsEl.textContent = formatLatLng(activeSlot.lat, activeSlot.lng);
    }
  }

  function renderLevelCards() {
    if (!levelCardsEl) return;
    const activeLevel = getActiveLevel();
    const locked = Boolean(lan.room && !lan.isHost());
    const book = loadCareerLogbook();
    const clearedCount = Object.keys(book.cleared || {}).length;
    const nextRecommendedId = LEVELS.find((l) => !book.cleared?.[l.id])?.id || null;
    const visibleLevels = getFilteredLevels(book);
    const pill = document.getElementById('campaign-progress-pill');
    if (pill) {
      pill.textContent = `${clearedCount} / ${LEVELS.length} Cleared`;
    }
    if (visibleLevels.length === 0) {
      levelCardsEl.innerHTML = `<div class="lvl-empty-msg" style="padding:18px;text-align:center;color:#a7f3d0;font-size:0.8rem;">🏆 All ${LEVELS.length} expeditions cleared! Switch to All to chase S+ records.</div>`;
      renderSiteWorldMap({ book });
      return;
    }
    levelCardsEl.innerHTML = visibleLevels.map((lvl) => {
      const idx = Math.max(0, LEVELS.findIndex((l) => l.id === lvl.id));
      const isSelected = lvl.id === activeLevel.id;
      const isWreck = Boolean(lvl.isWreck || lvl.category === 'wreck');
      const isCached = renderer.isLevelCached(lvl.id) || (renderer.ready && renderer.level?.id === lvl.id);
      const clearRec = book.cleared?.[lvl.id] || null;
      const best = Math.max(getSavedBestScore(lvl.id), clearRec?.score || 0);
      const meta = getLevelMeta(lvl, idx);
      const slot = SITE_COORDS_BY_ID.get(lvl.id);
      const depth = `${meta.maxDepthM}m`;
      const isNext = !clearRec && lvl.id === nextRecommendedId;
      const grade = clearRec?.grade || '';
      const gradeCls = grade.startsWith('S') ? 'grade-s' : grade === 'A' ? 'grade-a' : '';
      const modePillHtml = renderModeBadgeHtml(clearRec?.bestDifficulty || clearRec?.lastDifficulty, { compact: true });
      const badgesHtml = grade
        ? `${modePillHtml}<span class="lvl-grade-badge ${gradeCls}">${escapeHtml(grade)}</span>`
        : isNext
          ? `<span class="lvl-next-badge">NEXT</span>`
          : '';
      const timeStr = clearRec?.bestTimeSec > 0 ? ` · ${formatRunClock(clearRec.bestTimeSec)}` : '';
      const metaText =
        best > 0
          ? `✓ ${best.toLocaleString()}${timeStr}`
          : isCached
            ? lvl.reelMetersPerDiver > 0
              ? `✓ Ready · ${lvl.reelMetersPerDiver}m`
              : `✓ Ready`
            : lvl.reelMetersPerDiver > 0
              ? `${isWreck ? 'Wreck Reel' : 'No Line'} · ${lvl.reelMetersPerDiver}m`
              : isWreck
                ? 'Wreck · Fixed Line'
                : getLevelDifficultyLabel(idx, lvl);
      const prefix = isWreck ? '🚢 ' : '';
      const tierTag = lvl.reelMetersPerDiver > 0 ? `${prefix}L${idx + 1} · T${meta.tier}` : `${prefix}L${idx + 1}`;
      const recArch = getRecommendedArchetypeForLevel(lvl);
      const siteCaches = getWorldGearCachesForSite(lvl.id, book.foundGear);
      const unfoundCache = siteCaches.find((c) => !c.found) || null;
      const foundCache = !unfoundCache && siteCaches.length > 0 ? siteCaches[0] : null;
      const cacheBadgeHtml = unfoundCache
        ? `<span class="lvl-cache-badge unfound" title="Hidden World Gear Cache: ${escapeHtml(unfoundCache.clue)}">📦 Gear Cache</span>`
        : foundCache
          ? `<span class="lvl-cache-badge found" title="Discovered: ${escapeHtml(foundCache.itemName)}">✓ Gear</span>`
          : '';
      const archPillHtml = `<span class="lvl-arch-badge arch-${recArch.id}" title="Recommended Build: ${escapeHtml(recArch.label)}">${recArch.icon} ${recArch.short}</span>`;
      return `
      <button
        type="button"
        class="level-card-btn ${isWreck ? 'is-wreck' : ''} ${isSelected ? 'active' : ''}"
        data-level-id="${lvl.id}"
        role="option"
        aria-selected="${isSelected ? 'true' : 'false'}"
        ${locked ? 'disabled' : ''}
      >
        <div class="lvl-card-top">
          <span>${tierTag} · ${slot?.region || ''}</span>
          <span class="lvl-card-badges">${badgesHtml}<span class="lvl-card-depth">${depth}</span></span>
        </div>
        <span class="lvl-card-name">${lvl.name}</span>
        <div class="lvl-card-foot">
          <span class="lvl-card-meta ${best > 0 || isCached ? 'cached' : lvl.reelMetersPerDiver > 0 ? 'reel' : ''}">${metaText}</span>
          <span class="lvl-card-intel">${cacheBadgeHtml}${archPillHtml}</span>
        </div>
      </button>
    `;
    }).join('');

    const activeBtn = levelCardsEl.querySelector('.level-card-btn.active');
    activeBtn?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    renderSiteWorldMap({ book });
  }

  function syncMenuDescToggle() {
    if (!menuDescEl || !btnDescToggle) return;
    if (menuDescExpanded) {
      menuDescEl.classList.remove('clamped');
      btnDescToggle.hidden = false;
      btnDescToggle.textContent = 'Less ▴';
      btnDescToggle.setAttribute('aria-expanded', 'true');
      return;
    }
    menuDescEl.classList.add('clamped');
    const overflows = menuDescEl.clientHeight > 0 && menuDescEl.scrollHeight > menuDescEl.clientHeight + 2;
    btnDescToggle.hidden = !overflows;
    btnDescToggle.textContent = 'More ▾';
    btnDescToggle.setAttribute('aria-expanded', 'false');
  }

  btnDescToggle?.addEventListener('click', () => {
    menuDescExpanded = !menuDescExpanded;
    syncMenuDescToggle();
    if (menuDescExpanded) {
      retriggerAnim(menuDescEl, 'anim-telemetry-swap');
    }
  });

  window.addEventListener('resize', () => {
    if (!screenMenu.hidden) syncMenuDescToggle();
  });

  function syncMenuLevelLabels(level, { animate = false } = {}) {
    const idx = LEVELS.findIndex((l) => l.id === level.id);
    const lvlNum = idx >= 0 ? idx + 1 : 1;
    btnPlaySolo.textContent = level.isProcedural
      ? `DIVE · ∞ #${level.proceduralMeta?.seed || 'SUMP'}`
      : `DIVE · LEVEL ${lvlNum}`;
    const menuTitle = screenMenu.querySelector('.menu-title');
    const menuDesc = menuDescEl || screenMenu.querySelector('.menu-desc');
    const loaderTitle = screenLoader.querySelector('.loader-title');
    const loaderMetaSpan = screenLoader.querySelector('.loader-meta span');
    if (menuTitle) {
      menuTitle.textContent = level.name.toUpperCase();
      if (animate) retriggerAnim(menuTitle, 'anim-telemetry-swap');
    }
    if (menuDesc && level.description) {
      menuDescExpanded = false;
      menuDesc.textContent = level.description;
      requestAnimationFrame(syncMenuDescToggle);
      if (animate) retriggerAnim(menuDesc, 'anim-telemetry-swap');
    }
    if (loaderTitle) loaderTitle.textContent = level.name.toUpperCase();
    if (loaderMetaSpan && level.subtitle) loaderMetaSpan.textContent = level.subtitle.toUpperCase();
    renderLevelCards();
    if (animate) {
      retriggerAnim(siteMapRegionBadgeEl, 'anim-badge-lock');
      retriggerAnim(siteMapCoordsEl, 'anim-badge-lock');
    }
  }

  function populateLevelSelect() {
    const activeLevel = getActiveLevel();
    if (selectLevel) {
      selectLevel.innerHTML = '';
      LEVELS.forEach((lvl, idx) => {
        const opt = document.createElement('option');
        opt.value = lvl.id;
        opt.textContent = `L${idx + 1}: ${lvl.name}`;
        selectLevel.appendChild(opt);
      });
      selectLevel.value = activeLevel.id;
    }
    syncMenuLevelLabels(activeLevel);
  }

  return {
    getSiteViewMode: () => siteViewMode,
    setSiteViewMode: (v) => { siteViewMode = v; },
    getMapZoomMode: () => mapZoomMode,
    setMapZoomMode: (v) => { mapZoomMode = v; },
    getSiteCategoryFilter: () => siteCategoryFilter,
    setSiteCategoryFilter,
    getFilteredLevels,
    renderSiteWorldMap,
    renderLevelCards,
    syncMenuDescToggle,
    syncMenuLevelLabels,
    populateLevelSelect,
  };
}
