/**
 * Underwater Photo Mode Studio & Marine Field Guide Collector Card Renderer (v139).
 * Pure ES module with zero DOM dependencies — works identically in browser canvas and Node tests.
 */

export const PHOTO_FILTERS = Object.freeze([
  {
    id: 'natural',
    name: 'Natural Reef',
    shortName: 'Natural',
    tintCss: '',
    blendMode: 'source-over',
    vignetteAlpha: 0.22,
    desaturate: false,
    contrastBoost: 0,
  },
  {
    id: 'natgeo-cyan',
    name: 'Deep Expedition',
    shortName: 'Deep Cyan',
    tintCss: 'rgba(14, 165, 233, 0.16)',
    blendMode: 'color',
    vignetteAlpha: 0.36,
    desaturate: false,
    contrastBoost: 0.14,
  },
  {
    id: 'warm-strobe',
    name: 'Dual Strobe Warm',
    shortName: 'Warm Strobe',
    tintCss: 'rgba(251, 146, 60, 0.17)',
    blendMode: 'soft-light',
    vignetteAlpha: 0.28,
    desaturate: false,
    contrastBoost: 0.1,
  },
  {
    id: 'biolum-noir',
    name: 'Abyssal Neon',
    shortName: 'Abyssal',
    tintCss: 'rgba(99, 102, 241, 0.2)',
    blendMode: 'multiply',
    vignetteAlpha: 0.54,
    desaturate: false,
    contrastBoost: 0.22,
  },
  {
    id: 'monochrome',
    name: 'Silver Halide B&W',
    shortName: 'B&W Film',
    tintCss: 'rgba(226, 232, 240, 0.08)',
    blendMode: 'source-over',
    vignetteAlpha: 0.44,
    desaturate: true,
    contrastBoost: 0.18,
  },
  {
    id: 'kelp-emerald',
    name: 'Cenote Emerald',
    shortName: 'Emerald',
    tintCss: 'rgba(16, 185, 129, 0.18)',
    blendMode: 'soft-light',
    vignetteAlpha: 0.34,
    desaturate: false,
    contrastBoost: 0.12,
  },
  {
    id: 'wreck-sepia',
    name: 'Archival Wreck',
    shortName: 'Archival',
    tintCss: 'rgba(180, 118, 62, 0.24)',
    blendMode: 'color',
    vignetteAlpha: 0.5,
    desaturate: true,
    contrastBoost: 0.16,
  },
]);

export const PHOTO_FRAMES = Object.freeze([
  { id: 'telemetry', name: 'Dive Stamp', shortName: 'Stamp' },
  { id: 'field-guide', name: 'Field Guide Plate', shortName: 'Plate' },
  { id: 'cinema', name: '2.35:1 Cinema', shortName: 'Cinema' },
  { id: 'clean', name: 'Borderless', shortName: 'Clean' },
]);

const FILTER_BY_ID = new Map(PHOTO_FILTERS.map((f) => [f.id, f]));
const FRAME_BY_ID = new Map(PHOTO_FRAMES.map((f) => [f.id, f]));

export const PHOTO_MIN_ZOOM = 0.65;
export const PHOTO_MAX_ZOOM = 2.2;
export const PHOTO_MAX_PAN_M = 14;

export function getPhotoFilter(filterId) {
  return (filterId && FILTER_BY_ID.get(filterId)) || PHOTO_FILTERS[0];
}

export function getPhotoFrame(frameId) {
  return (frameId && FRAME_BY_ID.get(frameId)) || PHOTO_FRAMES[0];
}

export function createPhotoModeState() {
  return {
    active: false,
    panX: 0,
    panY: 0,
    zoom: 1.0,
    filterId: 'natural',
    frameId: 'telemetry',
    showGrid: true,
    hideOverlayForCapture: false,
  };
}

export function clampPhotoModeState(state) {
  if (!state || typeof state !== 'object') return createPhotoModeState();
  state.zoom = Math.max(PHOTO_MIN_ZOOM, Math.min(PHOTO_MAX_ZOOM, Number(state.zoom) || 1.0));
  state.panX = Math.max(-PHOTO_MAX_PAN_M, Math.min(PHOTO_MAX_PAN_M, Number(state.panX) || 0));
  state.panY = Math.max(-PHOTO_MAX_PAN_M, Math.min(PHOTO_MAX_PAN_M, Number(state.panY) || 0));
  state.filterId = getPhotoFilter(state.filterId).id;
  state.frameId = getPhotoFrame(state.frameId).id;
  state.showGrid = Boolean(state.showGrid);
  return state;
}

function fillRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

function strokeRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.stroke();
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${line} ${words[i]}`;
    const m = ctx.measureText ? ctx.measureText(test).width : test.length * 9;
    if (m <= maxWidth) {
      line = test;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

/**
 * Apply live Photo Mode color-grade, vignette, cinema letterbox, and optional Rule-of-Thirds
 * composition guides on top of the active underwater viewport.
 */
export function applyPhotoViewportOverlay(ctx, width, height, photoMode) {
  if (!ctx || !width || !height || !photoMode?.active) return;
  const filter = getPhotoFilter(photoMode.filterId);
  const frame = getPhotoFrame(photoMode.frameId);

  ctx.save();
  // 1. Optional grayscale pass via saturation composite for Silver Halide B&W
  if (filter.desaturate) {
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // 2. Color grade tint wash
  if (filter.tintCss) {
    ctx.save();
    ctx.globalCompositeOperation = filter.blendMode || 'source-over';
    ctx.fillStyle = filter.tintCss;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // 3. Subtle optical lens vignette
  const vigAlpha = filter.vignetteAlpha || 0.22;
  if (vigAlpha > 0.01) {
    const cx = width * 0.5;
    const cy = height * 0.5;
    const rOuter = Math.hypot(cx, cy);
    const vig = ctx.createRadialGradient(cx, cy, rOuter * 0.38, cx, cy, rOuter);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, `rgba(2, 6, 23, ${vigAlpha.toFixed(2)})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }

  // 4. Frame preview (Cinema 2.35:1 matte or Field Guide specimen corner brackets)
  if (!photoMode.hideOverlayForCapture && frame.id === 'cinema') {
    const barH = Math.round(height * 0.11);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
    ctx.fillRect(0, 0, width, barH);
    ctx.fillRect(0, height - barH, width, barH);
  } else if (!photoMode.hideOverlayForCapture && frame.id === 'field-guide') {
    const pad = Math.round(Math.min(width, height) * 0.036);
    const corner = Math.round(Math.min(width, height) * 0.045);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, pad + corner); ctx.lineTo(pad, pad); ctx.lineTo(pad + corner, pad);
    ctx.moveTo(width - pad - corner, pad); ctx.lineTo(width - pad, pad); ctx.lineTo(width - pad, pad + corner);
    ctx.moveTo(pad, height - pad - corner); ctx.lineTo(pad, height - pad); ctx.lineTo(pad + corner, height - pad);
    ctx.moveTo(width - pad - corner, height - pad); ctx.lineTo(width - pad, height - pad); ctx.lineTo(width - pad, height - pad - corner);
    ctx.stroke();
  }

  // 5. Rule-of-thirds composition grid + focus reticle (live preview only, never baked into PNG)
  if (!photoMode.hideOverlayForCapture && photoMode.showGrid) {
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.26)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 3, 0);
    ctx.lineTo(width / 3, height);
    ctx.moveTo((width * 2) / 3, 0);
    ctx.lineTo((width * 2) / 3, height);
    ctx.moveTo(0, height / 3);
    ctx.lineTo(width, height / 3);
    ctx.moveTo(0, (height * 2) / 3);
    ctx.lineTo(width, (height * 2) / 3);
    ctx.stroke();

    // Subtle center focus brackets
    const bLen = Math.min(width, height) * 0.025;
    const cx = width * 0.5;
    const cy = height * 0.5;
    const gap = bLen * 1.4;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - gap, cy - gap + bLen);
    ctx.lineTo(cx - gap, cy - gap);
    ctx.lineTo(cx - gap + bLen, cy - gap);
    ctx.moveTo(cx + gap - bLen, cy - gap);
    ctx.lineTo(cx + gap, cy - gap);
    ctx.lineTo(cx + gap, cy - gap + bLen);
    ctx.moveTo(cx - gap, cy + gap - bLen);
    ctx.lineTo(cx - gap, cy + gap);
    ctx.lineTo(cx - gap + bLen, cy + gap);
    ctx.moveTo(cx + gap - bLen, cy + gap);
    ctx.lineTo(cx + gap, cy + gap);
    ctx.lineTo(cx + gap, cy + gap - bLen);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Composite a high-resolution shareable PNG snapshot from the live frozen game canvas,
 * applying the chosen underwater color grade and expedition framing.
 */
export function renderPhotoSnapshot(
  dstCtx,
  srcCanvas,
  {
    width = 1200,
    height = 675,
    filterId = 'natural',
    frameId = 'telemetry',
    siteName = 'Expedition Site',
    depthM = 0,
    gasLabel = 'EAN32',
    diverName = 'Diver',
    weatherLabel = '',
    dateLabel = new Date().toISOString().slice(0, 10),
    version = 'v139',
  } = {}
) {
  if (!dstCtx || !width || !height) return false;
  const filter = getPhotoFilter(filterId);
  const frame = getPhotoFrame(frameId);

  dstCtx.save();
  dstCtx.fillStyle = '#020914';
  dstCtx.fillRect(0, 0, width, height);

  // Center-crop / cover draw from source game canvas
  if (srcCanvas && srcCanvas.width > 0 && srcCanvas.height > 0) {
    const srcAspect = srcCanvas.width / srcCanvas.height;
    const dstAspect = width / height;
    let sx = 0;
    let sy = 0;
    let sw = srcCanvas.width;
    let sh = srcCanvas.height;
    if (srcAspect > dstAspect) {
      sw = Math.round(srcCanvas.height * dstAspect);
      sx = Math.round((srcCanvas.width - sw) * 0.5);
    } else {
      sh = Math.round(srcCanvas.width / dstAspect);
      sy = Math.round((srcCanvas.height - sh) * 0.5);
    }
    dstCtx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, width, height);
  }

  // Apply color grade + optical vignette (without composition grid)
  applyPhotoViewportOverlay(dstCtx, width, height, {
    active: true,
    filterId: filter.id,
    frameId: 'clean',
    showGrid: false,
    hideOverlayForCapture: true,
  });

  if (frame.id === 'cinema') {
    const barH = Math.round(height * 0.11);
    dstCtx.fillStyle = '#020617';
    dstCtx.fillRect(0, 0, width, barH);
    dstCtx.fillRect(0, height - barH, width, barH);
    dstCtx.fillStyle = 'rgba(226, 232, 240, 0.86)';
    dstCtx.font = '700 16px ui-monospace, SFMono-Regular, Menlo, monospace';
    dstCtx.textAlign = 'left';
    dstCtx.textBaseline = 'middle';
    dstCtx.fillText(
      `TECHNO DIVE  ·  ${String(siteName).toUpperCase()}  ·  ${Math.round(Number(depthM) || 0)}M`,
      28,
      height - barH * 0.5
    );
    dstCtx.textAlign = 'right';
    dstCtx.fillStyle = 'rgba(125, 211, 252, 0.85)';
    dstCtx.fillText(`${diverName} · ${gasLabel} · ${dateLabel}`, width - 28, height - barH * 0.5);
  } else if (frame.id === 'telemetry') {
    const barH = 66;
    const barGrad = dstCtx.createLinearGradient(0, height - barH - 20, 0, height);
    barGrad.addColorStop(0, 'rgba(2, 6, 23, 0)');
    barGrad.addColorStop(0.35, 'rgba(2, 6, 23, 0.82)');
    barGrad.addColorStop(1, 'rgba(2, 6, 23, 0.96)');
    dstCtx.fillStyle = barGrad;
    dstCtx.fillRect(0, height - barH - 20, width, barH + 20);

    dstCtx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    dstCtx.lineWidth = 1.5;
    dstCtx.beginPath();
    dstCtx.moveTo(24, height - barH);
    dstCtx.lineTo(width - 24, height - barH);
    dstCtx.stroke();

    dstCtx.textAlign = 'left';
    dstCtx.textBaseline = 'middle';
    dstCtx.fillStyle = '#f8fafc';
    dstCtx.font = '800 20px system-ui, -apple-system, sans-serif';
    dstCtx.fillText(`📷 ${siteName}`, 28, height - barH + 24);

    dstCtx.fillStyle = '#94a3b8';
    dstCtx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
    const metaParts = [
      `DEPTH ${Math.round((Number(depthM) || 0) * 10) / 10}m`,
      gasLabel,
      weatherLabel || null,
      filter.id !== 'natural' ? filter.name : null,
    ].filter(Boolean);
    dstCtx.fillText(metaParts.join('  ·  '), 28, height - barH + 48);

    dstCtx.textAlign = 'right';
    dstCtx.fillStyle = '#38bdf8';
    dstCtx.font = '800 15px ui-monospace, SFMono-Regular, Menlo, monospace';
    dstCtx.fillText(`DIVER ${String(diverName || 'Diver').toUpperCase()}`, width - 28, height - barH + 24);
    dstCtx.fillStyle = '#64748b';
    dstCtx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, monospace';
    dstCtx.fillText(`TECHNO DIVE ${version}  ·  ${dateLabel}`, width - 28, height - barH + 48);
  } else if (frame.id === 'field-guide') {
    // Field Guide Specimen Plate framing (archival museum plate border + taxonomic footer, v263)
    const pad = 18;
    const footerH = 62;
    dstCtx.strokeStyle = 'rgba(250, 204, 21, 0.62)';
    dstCtx.lineWidth = 2;
    strokeRoundedRect(dstCtx, pad, pad, width - pad * 2, height - pad * 2, 10);

    // Specimen plate footer band
    dstCtx.fillStyle = 'rgba(3, 10, 22, 0.92)';
    dstCtx.fillRect(pad + 1, height - pad - footerH, width - pad * 2 - 2, footerH - 1);
    dstCtx.strokeStyle = 'rgba(250, 204, 21, 0.42)';
    dstCtx.lineWidth = 1;
    dstCtx.beginPath();
    dstCtx.moveTo(pad + 10, height - pad - footerH);
    dstCtx.lineTo(width - pad - 10, height - pad - footerH);
    dstCtx.stroke();

    // Specimen corner ticks inside top frame
    const tick = 18;
    dstCtx.strokeStyle = '#fde047';
    dstCtx.lineWidth = 2.4;
    dstCtx.beginPath();
    dstCtx.moveTo(pad + 8, pad + 8 + tick); dstCtx.lineTo(pad + 8, pad + 8); dstCtx.lineTo(pad + 8 + tick, pad + 8);
    dstCtx.moveTo(width - pad - 8 - tick, pad + 8); dstCtx.lineTo(width - pad - 8, pad + 8); dstCtx.lineTo(width - pad - 8, pad + 8 + tick);
    dstCtx.stroke();

    dstCtx.textAlign = 'left';
    dstCtx.textBaseline = 'middle';
    dstCtx.fillStyle = '#fef08a';
    dstCtx.font = '800 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    dstCtx.fillText('MARINE FIELD GUIDE · SPECIMEN PLATE', pad + 18, height - pad - footerH + 18);
    dstCtx.fillStyle = '#f8fafc';
    dstCtx.font = '800 19px system-ui, -apple-system, sans-serif';
    dstCtx.fillText(String(siteName || 'Expedition Site'), pad + 18, height - pad - 20);

    dstCtx.textAlign = 'right';
    dstCtx.fillStyle = '#7dd3fc';
    dstCtx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
    const plateMeta = [
      `${Math.round((Number(depthM) || 0) * 10) / 10}M`,
      gasLabel,
      filter.shortName.toUpperCase(),
    ].filter(Boolean).join(' · ');
    dstCtx.fillText(plateMeta, width - pad - 18, height - pad - footerH + 20);
    dstCtx.fillStyle = '#94a3b8';
    dstCtx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    dstCtx.fillText(`${String(diverName || 'Diver').toUpperCase()} · ${dateLabel}`, width - pad - 18, height - pad - 18);
  }

  dstCtx.restore();
  return true;
}

const RARITY_STYLES = Object.freeze({
  common: { label: 'COMMON', accent: '#38bdf8', glow: 'rgba(56, 189, 248, 0.25)', bgTop: '#08263f', bgBot: '#030d1c' },
  uncommon: { label: 'UNCOMMON', accent: '#34d399', glow: 'rgba(52, 211, 153, 0.26)', bgTop: '#06332c', bgBot: '#031214' },
  rare: { label: 'RARE SPECIMEN', accent: '#c084fc', glow: 'rgba(192, 132, 252, 0.28)', bgTop: '#251542', bgBot: '#0a071a' },
  epic: { label: 'EPIC PELAGIC', accent: '#fbbf24', glow: 'rgba(251, 191, 36, 0.32)', bgTop: '#3b2408', bgBot: '#120b03' },
});

const RARITY_RANK = Object.freeze({ common: 1, uncommon: 2, rare: 3, epic: 4 });

/**
 * Filter & sort Field Guide entries for the Marine Field Guide Gallery toolbar.
 */
export function filterAndSortFieldGuide(entries, { filter = 'all', sort = 'catalog' } = {}) {
  if (!Array.isArray(entries)) return [];
  let list = entries.slice();
  if (filter === 'discovered') list = list.filter((e) => e.discovered);
  else if (filter === 'gold') list = list.filter((e) => e.discovered && (e.bestStars || 0) >= 3);
  else if (filter === 'rare') list = list.filter((e) => e.rarity === 'rare' || e.rarity === 'epic');
  else if (filter === 'undiscovered') list = list.filter((e) => !e.discovered);

  if (sort === 'stars') {
    list.sort((a, b) => (b.bestStars || 0) - (a.bestStars || 0) || Number(b.discovered) - Number(a.discovered));
  } else if (sort === 'depth') {
    list.sort((a, b) => (b.bestDepthM || 0) - (a.bestDepthM || 0) || Number(b.discovered) - Number(a.discovered));
  } else if (sort === 'rarity') {
    list.sort(
      (a, b) =>
        (RARITY_RANK[b.rarity] || 0) - (RARITY_RANK[a.rarity] || 0) ||
        (b.bestStars || 0) - (a.bestStars || 0)
    );
  }
  return list;
}

/**
 * Render a museum-grade 960x560 Shareable Marine Field Guide Collector Card PNG.
 */
export function renderFieldGuideCollectorCard(
  ctx,
  {
    width = 960,
    height = 560,
    entry,
    diverName = 'Expedition Diver',
    fgStats = null,
    dateLabel = new Date().toISOString().slice(0, 10),
    version = 'v139',
  } = {}
) {
  if (!ctx || !entry) return false;
  const pal = RARITY_STYLES[entry.rarity] || RARITY_STYLES.common;
  const stars = Math.max(0, Math.min(3, Math.round(Number(entry.bestStars) || 0)));
  const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);

  ctx.save();
  // 1. Deep pelagic gradient backdrop
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, pal.bgTop);
  bg.addColorStop(0.55, '#061529');
  bg.addColorStop(1, pal.bgBot);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle decorative caustic radial glow behind emblem
  const glow = ctx.createRadialGradient(195, 240, 20, 195, 240, 240);
  glow.addColorStop(0, pal.glow);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // 2. Outer museum card border
  const pad = 26;
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 2.5;
  strokeRoundedRect(ctx, pad, pad, width - pad * 2, height - pad * 2, 22);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  strokeRoundedRect(ctx, pad + 8, pad + 8, width - (pad + 8) * 2, height - (pad + 8) * 2, 16);

  // 3. Top Header Kicker & Rarity Pill
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '800 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('TECHNO DIVE  ·  MARINE FIELD GUIDE SPECIMEN CARD', pad + 28, pad + 34);

  const pillW = 166;
  const pillH = 28;
  const pillX = width - pad - 28 - pillW;
  const pillY = pad + 20;
  ctx.fillStyle = pal.glow;
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 1.5;
  fillRoundedRect(ctx, pillX, pillY, pillW, pillH, 999);
  strokeRoundedRect(ctx, pillX, pillY, pillW, pillH, 999);
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.accent;
  ctx.font = '800 12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(pal.label, pillX + pillW * 0.5, pillY + pillH * 0.5);

  // 4. Left Specimen Medallion Showcase
  const medX = pad + 32;
  const medY = pad + 68;
  const medW = 280;
  const medH = 340;
  ctx.fillStyle = 'rgba(2, 10, 24, 0.72)';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 1.5;
  fillRoundedRect(ctx, medX, medY, medW, medH, 18);
  strokeRoundedRect(ctx, medX, medY, medW, medH, 18);

  // Specimen concentric sonar ring behind icon
  const cx = medX + medW * 0.5;
  const cy = medY + 132;
  ctx.strokeStyle = pal.glow;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 56, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '88px "Segoe UI Emoji", "Apple Color Emoji", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(entry.icon || '🐠', cx, cy + 4);

  // Star Quality Rating Plaque inside medallion
  ctx.fillStyle = stars >= 3 ? '#facc15' : '#e2e8f0';
  ctx.font = '800 32px system-ui, -apple-system, sans-serif';
  ctx.fillText(starStr, cx, medY + 252);
  ctx.fillStyle = stars >= 3 ? '#fde68a' : '#94a3b8';
  ctx.font = '800 12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(
    stars >= 3 ? 'GOLD MASTER PHOTOGRAPH' : stars === 2 ? 'SHARP FIELD EXPOSURE' : 'CONFIRMED SIGHTING',
    cx,
    medY + 286
  );

  // Depth Pill at bottom of medallion
  const depthBadge = entry.bestDepthM > 0 ? `MAX DEPTH · ${Math.round(entry.bestDepthM * 10) / 10}m` : 'SURFACE / SHALLOW';
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  fillRoundedRect(ctx, medX + 28, medY + 302, medW - 56, 26, 999);
  strokeRoundedRect(ctx, medX + 28, medY + 302, medW - 56, 26, 999);
  ctx.fillStyle = '#bae6fd';
  ctx.font = '800 12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(depthBadge, cx, medY + 315);

  // 5. Right Column: Species Title, Taxonomy, Bio & Sighting Telemetry
  const rx = medX + medW + 30;
  const rw = width - pad - 30 - rx;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 34px system-ui, -apple-system, sans-serif';
  ctx.fillText(entry.name || 'Marine Specimen', rx, medY + 6, rw);

  ctx.fillStyle = pal.accent;
  ctx.font = 'italic 600 19px Georgia, "Times New Roman", serif';
  ctx.fillText(entry.latin || '', rx, medY + 48, rw);

  // Divider line
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rx, medY + 82);
  ctx.lineTo(rx + rw, medY + 82);
  ctx.stroke();

  // Naturalist field notes bio
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 16px system-ui, -apple-system, sans-serif';
  const bioLines = wrapCanvasText(ctx, entry.bio || 'Documented underwater specimen.', rw);
  for (let i = 0; i < Math.min(4, bioLines.length); i++) {
    ctx.fillText(bioLines[i], rx, medY + 98 + i * 24);
  }

  // 3 Telemetry Stat Boxes
  const boxY = medY + 216;
  const boxGap = 12;
  const boxW = Math.floor((rw - boxGap) / 2);
  const statBoxes = [
    { lbl: 'HABITAT', val: entry.habitat || 'Karst / Pelagic', x: rx, y: boxY, w: rw, h: 52 },
    { lbl: 'BEST SIGHTING SITE', val: entry.bestSiteName || 'Expedition Archive', x: rx, y: boxY + 64, w: boxW, h: 60 },
    { lbl: 'TOTAL CAPTURES', val: `×${entry.count || 1} Logged`, x: rx + boxW + boxGap, y: boxY + 64, w: rw - boxW - boxGap, h: 60 },
  ];
  for (const b of statBoxes) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1;
    fillRoundedRect(ctx, b.x, b.y, b.w, b.h, 12);
    strokeRoundedRect(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.fillStyle = '#7dd3fc';
    ctx.font = '800 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(b.lbl, b.x + 14, b.y + 10);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(b.val, b.x + 14, b.y + 28, b.w - 28);
  }

  // 6. Footer Bar with Photographer Signature & Naturalist Progress
  const footY = height - pad - 54;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.beginPath();
  ctx.moveTo(pad + 28, footY - 12);
  ctx.lineTo(width - pad - 28, footY - 12);
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '800 14px ui-monospace, SFMono-Regular, Menlo, monospace';
  const rankTxt = fgStats?.naturalistRank ? `  ·  ${fgStats.naturalistRank}` : '';
  ctx.fillText(`PHOTOGRAPHER: ${String(diverName || 'Diver').toUpperCase()}${rankTxt}`, pad + 28, footY + 14);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  const progressTxt = fgStats ? `GUIDE ${fgStats.discoveredCount}/${fgStats.totalCount}  ·  ` : '';
  ctx.fillText(`${progressTxt}${dateLabel}  ·  ${version}`, width - pad - 28, footY + 14);

  ctx.restore();
  return true;
}

/**
 * Smart Photo Composition Detector (v197):
 * Scans the active Photo Studio camera frame for iconic landmarks, rare wreck set-pieces,
 * Cenote Angelita's H2S Cloud River, escorting megafauna, and sealed air pockets.
 */
export function detectPhotoCompositionSubject({
  level = null,
  diver = null,
  camX = 0,
  camY = 0,
  ecosystem = null,
  stories = null,
  maxDistM = 13.5,
} = {}) {
  const cx = Number.isFinite(camX) ? camX : (diver?.x || 0);
  const cy = Number.isFinite(camY) ? camY : (diver?.y || 0);
  const candidates = [];

  // 1. Sunken A6M Zero Fighter inside Fujikawa Maru Hold #2
  if (Array.isArray(level?.wreckProps)) {
    for (const p of level.wreckProps) {
      if (p.kind !== 'zero-fighter' && p.kind !== 'locomotive' && p.kind !== 'conning-tower') continue;
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d <= maxDistM) {
        const label = p.kind === 'zero-fighter'
          ? 'A6M Zero Fighter'
          : p.kind === 'locomotive'
            ? 'Sunken Steam Locomotive'
            : 'Submarine Conning Tower';
        candidates.push({ kind: p.kind, label, bonusPts: p.kind === 'zero-fighter' ? 240 : 210, dist: d, priority: 10 });
      }
    }
  }

  // 2. Cenote Angelita Glowing 30m H2S Cloud River
  if (level?.h2sCloudLayer && Math.abs(cy - level.h2sCloudLayer.y) <= 6.5) {
    candidates.push({
      kind: 'h2s-cloud',
      label: 'H₂S Cloud River & Sunken Forest',
      bonusPts: 220,
      dist: Math.abs(cy - level.h2sCloudLayer.y),
      priority: 9,
    });
  }

  // 3. Pelagic Megafauna (Manta Rays, Reef Sharks, Arctic Belugas)
  if (Array.isArray(ecosystem?.megafauna)) {
    for (const m of ecosystem.megafauna) {
      const d = Math.hypot(m.x - cx, m.y - cy);
      if (d <= maxDistM) {
        const escortBoost = m.behavior === 'escort' ? 60 : 0;
        candidates.push({
          kind: `megafauna-${m.kind}`,
          label: m.behavior === 'escort' ? `${m.label || 'Megafauna'} Escort` : (m.label || 'Pelagic Megafauna'),
          bonusPts: 185 + escortBoost,
          dist: d,
          priority: m.behavior === 'escort' ? 11 : 8,
        });
      }
    }
  }

  // 4. Submerged Lore Landmarks & Sealed Air Pockets
  if (Array.isArray(stories?.landmarks)) {
    for (const st of stories.landmarks) {
      const d = Math.hypot(st.x - cx, st.y - cy);
      if (d <= maxDistM * 0.85) {
        candidates.push({ kind: 'landmark', label: st.title || 'Submerged Landmark', bonusPts: 150, dist: d, priority: 6 });
      }
    }
  }
  if (Array.isArray(stories?.airPockets)) {
    for (const ap of stories.airPockets) {
      const d = Math.hypot(ap.x - cx, ap.y - cy);
      if (d <= maxDistM * 0.85) {
        candidates.push({ kind: 'air-pocket', label: 'Submerged Air Dome', bonusPts: 140, dist: d, priority: 5 });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.priority - a.priority) || (a.dist - b.dist));
  const best = candidates[0];
  return {
    kind: best.kind,
    label: best.label,
    bonusPts: best.bonusPts,
    badge: `📷 COMPOSITION LOCK · ${best.label} (+${best.bonusPts})`,
  };
}

/**
 * Paint an ultra-clean translucent National Geographic-style GPS Expedition Postcard Stamp
 * onto a captured Photo Studio canvas (site name, GPS lat/lng, depth, callsign & subject) (v197).
 */
export function stampExpeditionPostcardOverlay(ctx, width, height, meta = {}) {
  if (!ctx || !width || !height) return false;
  const pad = Math.max(14, Math.round(Math.min(width, height) * 0.025));
  const boxW = Math.min(width - pad * 2, Math.max(280, Math.round(width * 0.36)));
  const boxH = meta.subjectLabel ? 78 : 58;
  const bx = pad;
  const by = Number.isFinite(meta.topOffset) ? meta.topOffset : pad;

  ctx.save();
  ctx.fillStyle = 'rgba(4, 12, 26, 0.78)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 1.5;
  fillRoundedRect(ctx, bx, by, boxW, boxH, 10);
  strokeRoundedRect(ctx, bx, by, boxW, boxH, 10);

  // Subtle gold Nat-Geo accent bar on left edge
  ctx.fillStyle = '#facc15';
  ctx.fillRect(bx + 6, by + 8, 3.5, boxH - 16);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(String(meta.siteName || 'CAVE DIVER EXPEDITION').toUpperCase(), bx + 18, by + 10, boxW - 28);

  ctx.fillStyle = '#7dd3fc';
  ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  const depthTxt = Number.isFinite(meta.depthM) ? `${meta.depthM.toFixed(1)}m` : '';
  const gpsTxt = meta.gpsLabel ? `${meta.gpsLabel}` : '';
  const metaLine = [gpsTxt, depthTxt, meta.diverName || 'Diver'].filter(Boolean).join(' · ');
  ctx.fillText(metaLine, bx + 18, by + 29, boxW - 28);

  if (meta.subjectLabel) {
    ctx.fillStyle = '#fde047';
    ctx.font = '800 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(`✦ ${meta.subjectLabel}`, bx + 18, by + 49, boxW - 28);
  }
  ctx.restore();
  return true;
}
