/**
 * Dive Replay Theater & Shareable PNG Expedition Postcard renderer.
 * Pure ES module with zero DOM dependencies — renders onto any 2D canvas context
 * (browser HTMLCanvasElement or Node test mock).
 */

import { buildExploreCells } from './scoring.js';
import { drawMiniDiverAvatar, resolveDiverLiveryPalette } from './rigLivery.js';
import { drawStyledArtifact } from './artSprites.js';

export function formatReplayTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

/**
 * Normalize a ghost track array of [t*10, x*10, y*10, ang*10] into world-space samples.
 */
export function decodeReplayTrack(track) {
  if (!Array.isArray(track) || track.length === 0) return [];
  const out = [];
  for (let i = 0; i < track.length; i++) {
    const pt = track[i];
    if (!Array.isArray(pt) || pt.length < 3) continue;
    const t = Math.max(0, (Number(pt[0]) || 0) / 10);
    const x = (Number(pt[1]) || 0) / 10;
    const y = (Number(pt[2]) || 0) / 10;
    const angle = pt.length >= 4 ? (Number(pt[3]) || 0) / 10 : 0;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ t, x, y, angle });
  }
  return out;
}

/**
 * Sample an interpolated diver pose along a decoded replay track at progress [0..1].
 */
export function sampleReplayPoint(samples, progress = 1) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  if (samples.length === 1 || p <= 0) {
    return { ...samples[0], index: 0, totalSec: samples[samples.length - 1].t };
  }
  const totalSec = Math.max(0.1, samples[samples.length - 1].t);
  const targetT = totalSec * p;
  if (p >= 1 || targetT >= totalSec) {
    const last = samples[samples.length - 1];
    return { ...last, index: samples.length - 1, totalSec };
  }
  let lo = 0;
  let hi = samples.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= targetT) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const span = Math.max(0.001, b.t - a.t);
  const alpha = Math.max(0, Math.min(1, (targetT - a.t) / span));
  const x = a.x + (b.x - a.x) * alpha;
  const y = a.y + (b.y - a.y) * alpha;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const angle = Math.hypot(dx, dy) > 0.05 ? Math.atan2(dy, dx) : a.angle;
  return { t: targetT, x, y, angle, index: lo, totalSec };
}

function gasColorForDepth(depthM, profile, tSec) {
  if (Array.isArray(profile) && profile.length > 0 && Number.isFinite(tSec)) {
    let best = profile[0];
    for (let i = 0; i < profile.length; i++) {
      if (profile[i].t <= tSec) best = profile[i];
      else break;
    }
    if (best?.gas === 'O2') return '#4ade80';
    if (best?.gas === 'TMX1455') return '#c084fc';
    if (best?.gas === 'EAN32') return '#38bdf8';
  }
  if (depthM <= 6.5) return '#4ade80';
  if (depthM >= 23) return '#c084fc';
  return '#38bdf8';
}

function fillRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.fill();
}

function strokeRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.stroke();
}

const _exploreCellsCache = new WeakMap();
function getCachedExploreCells(level) {
  if (!level) return [];
  let cached = _exploreCellsCache.get(level);
  if (!cached) {
    cached = buildExploreCells(level);
    _exploreCellsCache.set(level, cached);
  }
  return cached;
}

/**
 * Draw an interactive Dive Replay Theater frame showing the expedition silhouette,
 * checkpoints, exit zone, full dim trace, and glowing animated diver path up to `progress`.
 */
export function drawReplayFrame(
  ctx,
  width,
  height,
  { level, track, profile = null, progress = 1, compact = false } = {}
) {
  if (!ctx || !level || width <= 0 || height <= 0) return null;
  const samples = Array.isArray(track) && track.length > 0 && typeof track[0]?.x === 'number'
    ? track
    : decodeReplayTrack(track);

  const b = level.bounds || { xMin: -20, xMax: 160, yMin: -4, yMax: 70 };
  const padX = compact ? 14 : 22;
  const padY = compact ? 14 : 20;
  const innerW = Math.max(20, width - padX * 2);
  const innerH = Math.max(20, height - padY * 2);
  const worldW = Math.max(20, (b.xMax - b.xMin) || 120);
  const worldH = Math.max(18, (b.yMax - Math.min(0, b.yMin)) || 60);
  const yStart = Math.min(0, b.yMin || 0);
  const scale = Math.min(innerW / worldW, innerH / worldH);
  const drawW = worldW * scale;
  const drawH = worldH * scale;
  const offX = (width - drawW) * 0.5 - b.xMin * scale;
  const offY = (height - drawH) * 0.5 - yStart * scale;
  const toX = (wx) => offX + wx * scale;
  const toY = (wy) => offY + wy * scale;
  const isWreck = Boolean(level.isWreck);

  ctx.save();
  // 1. Deep bathymetric theater canvas backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#041428');
  bgGrad.addColorStop(1, '#020814');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle depth gridlines
  const depthStep = worldH > 120 ? 40 : worldH > 65 ? 20 : 10;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.11)';
  ctx.fillStyle = 'rgba(125, 211, 252, 0.45)';
  ctx.lineWidth = 1;
  ctx.font = `700 ${compact ? 10 : 11}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  for (let d = depthStep; d <= b.yMax; d += depthStep) {
    const sy = toY(d);
    if (sy < 12 || sy > height - 6) continue;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
    ctx.stroke();
    ctx.fillText(`${d}m`, 6, sy - 2);
  }

  // Water surface line
  const surfY = toY(0);
  if (surfY >= 0 && surfY <= height) {
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, surfY);
    ctx.lineTo(width, surfY);
    ctx.stroke();
  }

  // 2. Cave / Shipwreck navigable passage silhouette
  const cells = getCachedExploreCells(level);
  if (cells.length > 0) {
    const r = Math.max(2.2, 2.3 * scale);
    ctx.fillStyle = isWreck ? 'rgba(251, 146, 60, 0.17)' : 'rgba(56, 189, 248, 0.17)';
    ctx.beginPath();
    for (let i = 0; i < cells.length; i++) {
      const sx = toX(cells[i].x);
      const sy = toY(cells[i].y);
      ctx.moveTo(sx + r, sy);
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // Fixed guideline blueprint (subtle gold dash)
  if (Array.isArray(level.guideline) && level.guideline.length >= 2) {
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.25)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < level.guideline.length; i++) {
      const pt = level.guideline[i];
      const gx = Array.isArray(pt) ? pt[0] : pt.x;
      const gy = Array.isArray(pt) ? pt[1] : pt.y;
      if (i === 0) ctx.moveTo(toX(gx), toY(gy));
      else ctx.lineTo(toX(gx), toY(gy));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Checkpoints & Exit beacon
  if (Array.isArray(level.checkpoints)) {
    for (let i = 0; i < level.checkpoints.length; i++) {
      const cp = level.checkpoints[i];
      const cx = toX(cp.x);
      const cy = toY(cp.y);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.beginPath();
      ctx.arc(cx, cy, compact ? 2.5 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (level.exitZone) {
    const ex = toX(level.exitZone.x);
    const ey = toY(level.exitZone.y);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(ex, ey, compact ? 4.5 : 5.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 3. Full dimmed reference path
  if (samples.length >= 2) {
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.22)';
    ctx.lineWidth = compact ? 1.8 : 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(toX(samples[0].x), toY(samples[0].y));
    for (let i = 1; i < samples.length; i++) {
      ctx.lineTo(toX(samples[i].x), toY(samples[i].y));
    }
    ctx.stroke();
  }

  // 4. Illuminated gas-colored active replay path up to `progress`
  const cur = sampleReplayPoint(samples, progress);
  if (cur && samples.length >= 2) {
    ctx.lineWidth = compact ? 2.4 : 3.0;
    ctx.lineCap = 'round';
    for (let i = 0; i < cur.index; i++) {
      const a = samples[i];
      const bPt = samples[i + 1];
      ctx.strokeStyle = gasColorForDepth((a.y + bPt.y) * 0.5, profile, a.t);
      ctx.beginPath();
      ctx.moveTo(toX(a.x), toY(a.y));
      ctx.lineTo(toX(bPt.x), toY(bPt.y));
      ctx.stroke();
    }
    const prev = samples[cur.index];
    if (prev && Math.hypot(cur.x - prev.x, cur.y - prev.y) > 0.02) {
      ctx.strokeStyle = gasColorForDepth(cur.y, profile, cur.t);
      ctx.beginPath();
      ctx.moveTo(toX(prev.x), toY(prev.y));
      ctx.lineTo(toX(cur.x), toY(cur.y));
      ctx.stroke();
    }

    // Glowing animated diver directional chevron
    const dx = toX(cur.x);
    const dy = toY(cur.y);
    const haloCol = gasColorForDepth(cur.y, profile, cur.t);
    ctx.fillStyle = 'rgba(248, 250, 252, 0.24)';
    ctx.beginPath();
    ctx.arc(dx, dy, compact ? 7 : 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(cur.angle || 0);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = haloCol;
    ctx.lineWidth = 1.6;
    const sz = compact ? 5.2 : 6.6;
    ctx.beginPath();
    ctx.moveTo(sz, 0);
    ctx.lineTo(-sz * 0.72, -sz * 0.62);
    ctx.lineTo(-sz * 0.35, 0);
    ctx.lineTo(-sz * 0.72, sz * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  return cur;
}

/**
 * Render a 1200x630 high-DPI shareable PNG Expedition Postcard onto a 2D canvas context.
 */
export function renderExpeditionPostcard(ctx, width, height, data = {}) {
  if (!ctx || width <= 0 || height <= 0) return false;
  const {
    level,
    diverName = 'Diver',
    githubLogin = '',
    success = true,
    grade = 'S',
    score = 0,
    maxDepthM = 0,
    diveTimeSec = 0,
    exploredPct = 0,
    difficulty = 'standard',
    customMixLabel = '',
    dailyBadge = '',
    livery = null,
    hasCcr = false,
    recoveredArtifacts = [],
    pinnedArtifact = null,
    track = [],
    profile = [],
    version = 'v169',
    dateLabel = new Date().toISOString().slice(0, 10),
  } = data;

  ctx.save();
  // 1. Abyssal ocean card background
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#041226');
  bg.addColorStop(0.55, '#071b34');
  bg.addColorStop(1, '#020814');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle decorative sonar rings in top-right corner
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 2;
  for (let r = 110; r <= 330; r += 75) {
    ctx.beginPath();
    ctx.arc(width - 140, 120, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Outer glowing border
  ctx.strokeStyle = success ? 'rgba(56, 189, 248, 0.42)' : 'rgba(248, 113, 113, 0.42)';
  ctx.lineWidth = 3;
  strokeRoundedRect(ctx, 14, 14, width - 28, height - 28, 22);

  // 2. Header Kicker & Badges
  const padX = 46;
  ctx.fillStyle = '#38bdf8';
  ctx.font = '800 17px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const kindTag = level?.isWreck ? 'TECHNICAL SHIPWRECK EXPEDITION' : 'TECHNICAL CAVE EXPEDITION';
  ctx.fillText(`TECHNO DIVE  ·  ${kindTag}`, padX, 40);

  // Diver & Mode Pills row
  const pills = [];
  pills.push({
    text: githubLogin ? `✓ @${githubLogin}` : `🤿 ${diverName}`,
    bg: githubLogin ? 'rgba(16, 185, 129, 0.22)' : 'rgba(56, 189, 248, 0.16)',
    border: githubLogin ? 'rgba(52, 211, 153, 0.65)' : 'rgba(56, 189, 248, 0.45)',
    color: githubLogin ? '#a7f3d0' : '#bae6fd',
  });
  const modeLabel = difficulty === 'hardcore' ? '🔥 HARDCORE' : difficulty === 'guided' ? '🧭 GUIDED' : '🤿 TECH';
  pills.push({
    text: modeLabel,
    bg: 'rgba(15, 23, 42, 0.8)',
    border: 'rgba(148, 163, 184, 0.4)',
    color: '#e2e8f0',
  });
  if (customMixLabel) {
    pills.push({
      text: `🧪 ${customMixLabel}`,
      bg: 'rgba(147, 51, 234, 0.28)',
      border: 'rgba(216, 180, 254, 0.62)',
      color: '#f3e8ff',
    });
  }
  if (dailyBadge) {
    pills.push({
      text: dailyBadge,
      bg: 'rgba(245, 158, 11, 0.24)',
      border: 'rgba(251, 191, 36, 0.6)',
      color: '#fef3c7',
    });
  }

  let px = padX;
  const py = 148;
  ctx.font = '700 16px system-ui, -apple-system, sans-serif';
  for (const pill of pills) {
    const tw = ctx.measureText ? ctx.measureText(pill.text).width : pill.text.length * 9;
    const pw = Math.round(tw + 24);
    ctx.fillStyle = pill.bg;
    ctx.strokeStyle = pill.border;
    ctx.lineWidth = 1.5;
    fillRoundedRect(ctx, px, py, pw, 32, 16);
    strokeRoundedRect(ctx, px, py, pw, 32, 16);
    ctx.fillStyle = pill.color;
    ctx.textBaseline = 'middle';
    ctx.fillText(pill.text, px + 12, py + 16);
    px += pw + 10;
  }

  // Hero Expedition Title & Location
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 44px system-ui, -apple-system, sans-serif';
  ctx.fillText(level?.name || 'Expedition Complete', padX, 68);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 19px system-ui, -apple-system, sans-serif';
  ctx.fillText(level?.location || 'Submerged Overhead System', padX, 118);

  // 2b. Custom Diver Rig Emblem framed beside the Grade Seal (v155)
  if (livery) {
    const embW = 148;
    const embH = 88;
    const embX = width - 356;
    const embY = 66;
    const pal = resolveDiverLiveryPalette(livery);
    ctx.save();
    ctx.fillStyle = 'rgba(4, 18, 36, 0.92)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    fillRoundedRect(ctx, embX, embY, embW, embH, 14);
    strokeRoundedRect(ctx, embX, embY, embW, embH, 14);
    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(embX + 2, embY + 2, embW - 4, embH - 22, 12);
    else ctx.rect(embX + 2, embY + 2, embW - 4, embH - 22);
    ctx.clip?.();
    ctx.translate(embX + 2, embY + 2);
    drawMiniDiverAvatar(ctx, embW - 4, embH - 22, livery, { hasCcr });
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#bae6fd';
    ctx.font = '700 11px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${pal.suit.name} · ${pal.headgear.icon}`, embX + embW * 0.5, embY + embH - 11);
    ctx.restore();
  }

  // 3. Giant Grade Seal (Top Right)
  const sealX = width - 118;
  const sealY = 112;
  const sealR = 62;
  const sealGrad = ctx.createRadialGradient(sealX - 14, sealY - 16, 8, sealX, sealY, sealR);
  if (success) {
    sealGrad.addColorStop(0, '#fde047');
    sealGrad.addColorStop(0.55, '#f59e0b');
    sealGrad.addColorStop(1, '#b45309');
  } else {
    sealGrad.addColorStop(0, '#f87171');
    sealGrad.addColorStop(1, '#991b1b');
  }
  ctx.fillStyle = sealGrad;
  ctx.beginPath();
  ctx.arc(sealX, sealY, sealR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = success ? '#fef08a' : '#fecaca';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = `900 ${String(grade).length > 1 ? 38 : 56}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(grade || 'S'), sealX, sealY + 2);

  // 4. Four KPI Cards
  const kpis = [
    { lbl: 'EXPEDITION SCORE', val: Number(score || 0).toLocaleString(), accent: '#fde047' },
    { lbl: 'MAX DEPTH', val: `${Number(maxDepthM || 0).toFixed(1)}m`, accent: '#38bdf8' },
    { lbl: 'BOTTOM TIME', val: formatReplayTime(diveTimeSec), accent: '#c084fc' },
    { lbl: 'PASSAGE EXPLORED', val: `${Math.round(Number(exploredPct || 0))}%`, accent: '#4ade80' },
  ];
  const kpiY = 200;
  const kpiGap = 16;
  const kpiW = (width - padX * 2 - kpiGap * 3) / 4;
  const kpiH = 82;
  for (let i = 0; i < kpis.length; i++) {
    const kx = padX + i * (kpiW + kpiGap);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1.5;
    fillRoundedRect(ctx, kx, kpiY, kpiW, kpiH, 14);
    strokeRoundedRect(ctx, kx, kpiY, kpiW, kpiH, 14);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '800 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(kpis[i].lbl, kx + 16, kpiY + 14);
    ctx.fillStyle = kpis[i].accent;
    ctx.font = '800 30px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(kpis[i].val, kx + 16, kpiY + 38);
  }

  // 5. Bottom Dual Visualization Strip: Left = Dive Path Replay Map, Right = Depth Profile Curve
  const panelY = 304;
  const panelH = 264;
  const panelGap = 18;
  const mapW = Math.round((width - padX * 2 - panelGap) * 0.56);
  const profW = width - padX * 2 - panelGap - mapW;

  // Left Panel: Miniature Replay Map
  ctx.save();
  ctx.fillStyle = 'rgba(3, 13, 25, 0.92)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 1.5;
  fillRoundedRect(ctx, padX, panelY, mapW, panelH, 14);
  strokeRoundedRect(ctx, padX, panelY, mapW, panelH, 14);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(padX + 2, panelY + 32, mapW - 4, panelH - 34, 12);
  else ctx.rect(padX + 2, panelY + 32, mapW - 4, panelH - 34);
  ctx.clip?.();
  ctx.translate(padX + 2, panelY + 32);
  if (level) {
    drawReplayFrame(ctx, mapW - 4, panelH - 34, {
      level,
      track,
      profile,
      progress: 1,
      compact: true,
    });
  }
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#7dd3fc';
  ctx.font = '800 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('🗺️ EXPEDITION TRACK REPLAY', padX + 14, panelY + 10);

  // Right Panel: Dive Computer Depth Profile Curve
  const profX = padX + mapW + panelGap;
  ctx.fillStyle = 'rgba(3, 13, 25, 0.92)';
  ctx.strokeStyle = 'rgba(192, 132, 252, 0.3)';
  ctx.lineWidth = 1.5;
  fillRoundedRect(ctx, profX, panelY, profW, panelH, 14);
  strokeRoundedRect(ctx, profX, panelY, profW, panelH, 14);
  ctx.fillStyle = '#d8b4fe';
  ctx.font = '800 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('📈 DIVE COMPUTER DEPTH PROFILE', profX + 14, panelY + 10);

  const pts =
    Array.isArray(profile) && profile.length >= 2
      ? profile
      : decodeReplayTrack(track).map((s) => ({ t: s.t, d: Math.max(0, s.y), gas: s.y >= 23 ? 'TMX1455' : s.y <= 6.5 ? 'O2' : 'EAN32' }));
  if (pts.length >= 2) {
    const gx0 = profX + 40;
    const gy0 = panelY + 40;
    const gw = profW - 56;
    const gh = panelH - 64;
    const tMax = Math.max(1, pts[pts.length - 1].t);
    const dMax = Math.max(10, Number(maxDepthM) || 0, ...pts.map((p) => p.d || 0));

    // Depth gridlines inside profile box
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let k = 0; k <= 3; k++) {
      const frac = k / 3;
      const ly = gy0 + frac * gh;
      ctx.beginPath();
      ctx.moveTo(gx0, ly);
      ctx.lineTo(gx0 + gw, ly);
      ctx.stroke();
      ctx.fillText(`${Math.round(frac * dMax)}m`, gx0 - 6, ly);
    }

    // Soft area fill
    ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.beginPath();
    ctx.moveTo(gx0, gy0);
    for (let i = 0; i < pts.length; i++) {
      const px2 = gx0 + (pts[i].t / tMax) * gw;
      const py2 = gy0 + (Math.max(0, pts[i].d) / dMax) * gh;
      ctx.lineTo(px2, py2);
    }
    ctx.lineTo(gx0 + gw, gy0);
    ctx.closePath();
    ctx.fill();

    // Gas-colored profile curve segments
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const bPt = pts[i + 1];
      ctx.strokeStyle = a.gas === 'O2' ? '#4ade80' : a.gas === 'TMX1455' ? '#c084fc' : '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(gx0 + (a.t / tMax) * gw, gy0 + (Math.max(0, a.d) / dMax) * gh);
      ctx.lineTo(gx0 + (bPt.t / tMax) * gw, gy0 + (Math.max(0, bPt.d) / dMax) * gh);
      ctx.stroke();
    }
  }

  // 6. Footer Signature Strip + Recovered Artifacts Collector Medallions (v168)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#64748b';
  ctx.font = '700 14px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`cave-diver.vercel.app  ·  ${version}`, padX, height - 34);
  const relicList = [];
  if (pinnedArtifact && pinnedArtifact.name) {
    relicList.push({ ...pinnedArtifact, _isPinned: true });
  }
  if (Array.isArray(recoveredArtifacts)) {
    for (const item of recoveredArtifacts) {
      if (!item) continue;
      if (pinnedArtifact && item.name === pinnedArtifact.name) continue;
      relicList.push(item);
      if (relicList.length >= 3) break;
    }
  }
  if (relicList.length > 0) {
    const shown = relicList.slice(0, 3);
    const stepX = 36;
    const startX = width * 0.5 - ((shown.length - 1) * stepX) * 0.5;
    for (let a = 0; a < shown.length; a++) {
      const ax = startX + a * stepX;
      const ay = height - 34;
      const isPin = Boolean(shown[a]._isPinned);
      ctx.fillStyle = isPin ? 'rgba(30, 24, 12, 0.94)' : 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = isPin ? 'rgba(253, 224, 71, 0.92)' : 'rgba(250, 204, 21, 0.45)';
      ctx.lineWidth = isPin ? 1.8 : 1.2;
      ctx.beginPath();
      ctx.arc(ax, ay, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawStyledArtifact(ctx, shown[a], ax, ay, 10.5, 1.8, { index: a, isGrand: isPin });
      if (isPin) {
        ctx.fillStyle = '#fde047';
        ctx.font = '800 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', ax + 11, ay - 11);
      }
    }
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.fillText(dateLabel, width - padX, height - 34);

  ctx.restore();
  return true;
}

/**
 * Interactive Pre-Dive Bathymetry & Gas-Switch MOD Dive Slate Renderer (v156).
 * Overlays color-coded O2 Deco (0-6m), EAN32 Travel (6m-MOD), and Custom/Default Trimix
 * Bottom zones directly across the selected expedition's real depth contour.
 */
export function drawDivePlanSlate(ctx, width, height, { level, mixes = null, customGasPlan = null } = {}) {
  if (!ctx || width <= 0 || height <= 0) return false;
  const maxD = Math.max(24, Number(level?.maxDepthM || level?.bounds?.yMax || 50));
  const o2Pct = customGasPlan?.enabled ? Number(customGasPlan.o2Pct || 14) : Number((mixes?.TMX1455?.fO2 || 0.14) * 100);
  const hePct = customGasPlan?.enabled ? Number(customGasPlan.hePct || 55) : Number((mixes?.TMX1455?.fHe || 0.55) * 100);
  const fO2 = Math.max(0.06, Math.min(0.4, o2Pct / 100));
  const fN2 = Math.max(0, 1 - fO2 - Math.max(0, hePct / 100));
  const eanModM = 30; // EAN32 @ 1.28-1.4 PPO2 switch zone
  const tmxModM = Math.max(12, Math.round(((1.4 / fO2) - 1) * 10));
  const endAtMaxM = Math.max(0, Math.round(((maxD / 10 + 1) * (fN2 / 0.79) - 1) * 10));
  const scaleD = Math.max(maxD * 1.12, 36);
  const padL = 36;
  const padR = 12;
  const padT = 18;
  const padB = 20;
  const gw = Math.max(40, width - padL - padR);
  const gh = Math.max(30, height - padT - padB);
  const toY = (d) => padT + (Math.min(scaleD, Math.max(0, d)) / scaleD) * gh;

  ctx.save();
  // Slate background
  const bg = ctx.createLinearGradient?.(0, 0, 0, height);
  if (bg && typeof bg.addColorStop === 'function') {
    bg.addColorStop(0, '#041428');
    bg.addColorStop(1, '#020814');
    ctx.fillStyle = bg;
  } else {
    ctx.fillStyle = '#041428';
  }
  ctx.fillRect(0, 0, width, height);

  // 1. Color-coded Gas Depth Bands (O2 Deco | EAN32 Travel | Trimix Bottom)
  const y0 = toY(0);
  const y6 = toY(6);
  const ySwitch = toY(Math.min(maxD, eanModM));
  const yBot = toY(scaleD);
  ctx.fillStyle = 'rgba(74, 222, 128, 0.14)';
  ctx.fillRect(padL, y0, gw, Math.max(2, y6 - y0));
  ctx.fillStyle = 'rgba(56, 189, 248, 0.13)';
  ctx.fillRect(padL, y6, gw, Math.max(2, ySwitch - y6));
  ctx.fillStyle = 'rgba(192, 132, 252, 0.14)';
  ctx.fillRect(padL, ySwitch, gw, Math.max(2, yBot - ySwitch));

  // 2. Site Depth Contour Silhouette derived from real level segments
  const segs = Array.isArray(level?.segments) ? level.segments : [];
  if (segs.length > 0) {
    const b = level.bounds || { xMin: 0, xMax: 100 };
    const spanX = Math.max(10, (b.xMax || 100) - (b.xMin || 0));
    const bins = 24;
    const depths = new Float32Array(bins + 1);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      for (const [px, py] of [[s.ax, s.ay], [s.bx, s.by], [(s.ax + s.bx) * 0.5, (s.ay + s.by) * 0.5]]) {
        const idx = Math.max(0, Math.min(bins, Math.round(((px - (b.xMin || 0)) / spanX) * bins)));
        if (py > depths[idx]) depths[idx] = py;
      }
    }
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padL, y0);
    for (let k = 0; k <= bins; k++) {
      const lx = padL + (k / bins) * gw;
      const ly = toY(depths[k] || (k === 0 || k === bins ? 1 : maxD * 0.5));
      ctx.lineTo(lx, ly);
    }
    ctx.lineTo(padL + gw, y0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    for (let k = 0; k <= bins; k++) {
      const lx = padL + (k / bins) * gw;
      const ly = toY(depths[k] || (k === 0 || k === bins ? 1 : maxD * 0.5));
      if (k === 0) ctx.moveTo(lx, ly);
      else ctx.lineTo(lx, ly);
    }
    ctx.stroke();
  }

  // 3. Dashed MOD line for current Bottom Trimix blend
  const yMod = toY(tmxModM);
  const modSafe = tmxModM >= maxD;
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = modSafe ? 'rgba(74, 222, 128, 0.82)' : 'rgba(248, 113, 113, 0.92)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(padL, yMod);
  ctx.lineTo(padL + gw, yMod);
  ctx.stroke();
  ctx.restore();

  // 4. Depth Axis & Zone Labels
  ctx.font = '700 10px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#94a3b8';
  for (const dm of [0, 6, Math.round(maxD * 0.5), Math.round(maxD)]) {
    ctx.fillText(`${dm}m`, padL - 5, toY(dm));
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#86efac';
  ctx.fillText('O₂ 100% DECO (0-6m)', padL + 6, Math.min(y6 - 4, y0 + 8));
  ctx.fillStyle = '#7dd3fc';
  ctx.fillText('EAN32 TRAVEL', padL + 6, (y6 + ySwitch) * 0.5);
  ctx.fillStyle = '#e9d5ff';
  ctx.fillText(`TMX ${Math.round(o2Pct)}/${Math.round(hePct)} · MOD ${tmxModM}m`, padL + 6, Math.min(height - 26, ySwitch + 12));

  // Top-right END & Rule-of-Thirds summary pill
  ctx.textAlign = 'right';
  ctx.fillStyle = modSafe ? '#4ade80' : '#fca5a5';
  ctx.fillText(
    `${modSafe ? '✓ MOD OK' : '⚠ SHALLOW MOD'} · END ${endAtMaxM}m @ ${Math.round(maxD)}m · ⅓ TURN`,
    width - padR,
    9
  );
  ctx.restore();
  return true;
}
