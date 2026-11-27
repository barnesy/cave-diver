import { GAS_MIXES, GAS_ORDER, computePPO2, computeTissueCompartmentStatus, getRecommendedGas, getAscentInstruction, getGasSwitchCoach } from '../physics/diveModel.js';
import { getAscentConfig } from '../levels/index.js';
import { EXPLORE_GRID_CELL_M } from './scoring.js';
import { formatClock } from '../util/common.js';
import { computeDrillPaceStatus } from './rescueDrills.js';

const GAS_HOTKEY_LABELS = { EAN32: '1', TMX1455: '2', O2: '3' };

/**
 * Sample normalized P-QRS-T cardiac EKG deflection (-0.4..+1.0) at beat phase [0..1).
 */
export function sampleEkgWave(phase, alive = true) {
  if (!alive) return 0;
  const p = ((phase % 1) + 1) % 1;
  // P wave
  if (p >= 0.09 && p < 0.19) {
    return 0.16 * Math.sin(((p - 0.09) / 0.1) * Math.PI);
  }
  // Q dip
  if (p >= 0.21 && p < 0.235) {
    return -0.2 * Math.sin(((p - 0.21) / 0.025) * Math.PI);
  }
  // Sharp R spike
  if (p >= 0.235 && p < 0.275) {
    const t = (p - 0.235) / 0.04;
    return t < 0.5 ? t * 2.0 : (1 - t) * 2.0;
  }
  // S dip
  if (p >= 0.275 && p < 0.315) {
    return -0.36 * Math.sin(((p - 0.275) / 0.04) * Math.PI);
  }
  // T wave
  if (p >= 0.44 && p < 0.62) {
    return 0.25 * Math.sin(((p - 0.44) / 0.18) * Math.PI);
  }
  return 0;
}

function createEkgState(width = 160) {
  return {
    samples: new Float32Array(Math.max(40, width)),
    cursor: 0,
    phase: Math.random(),
    accumX: 0,
    ctx: null,
    layoutW: width,
    layoutH: 22,
    measured: false,
    visible: true,
  };
}

function measureEkgCanvas(canvas, state) {
  if (!canvas || !state) return;
  const w = Math.round(canvas.clientWidth || 0);
  const h = Math.round(canvas.clientHeight || 0);
  const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
  state.measured = true;
  state.dpr = dpr;
  if (w > 0 && h > 0) {
    state.visible = true;
    state.layoutW = w;
    state.layoutH = h;
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
  } else {
    // Hidden canvas (e.g. mobile compact card) — skip expensive 2D strokes until visible
    state.visible = canvas.offsetParent !== null && canvas.width > 0 && canvas.height > 0;
  }
}

function stepAndDrawEkg(canvas, state, bpm, alive, dt = 0.016) {
  if (!canvas) return false;
  if (!state.measured) {
    measureEkgCanvas(canvas, state);
  }
  const effectiveBpm = alive ? Math.max(40, Math.min(210, bpm || 68)) : 0;
  const beatHz = effectiveBpm / 60;
  if (!state.visible) {
    state.phase = (state.phase + beatHz * dt) % 1;
    return alive && state.phase >= 0.22 && state.phase <= 0.34;
  }
  const ctx = state.ctx || (state.ctx = canvas.getContext('2d'));
  if (!ctx) return false;

  const dpr = state.dpr || 1;
  const w = state.layoutW || Math.round(canvas.width / dpr);
  const h = state.layoutH || Math.round(canvas.height / dpr);
  if (w <= 0 || h <= 0) return false;
  if (state.samples.length !== w) {
    state.samples = new Float32Array(w);
    state.cursor = 0;
  }
  if (ctx.setTransform) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const sweepPxPerSec = 48;
  const stepPx = sweepPxPerSec * dt;
  state.accumX += stepPx;

  const pxAdvance = Math.min(8, Math.floor(state.accumX));
  if (pxAdvance > 0) {
    state.accumX -= pxAdvance;
    const subDt = dt / pxAdvance;
    for (let i = 0; i < pxAdvance; i++) {
      state.phase = (state.phase + beatHz * subDt) % 1;
      state.cursor = (state.cursor + 1) % w;
      state.samples[state.cursor] = sampleEkgWave(state.phase, alive);
    }
  } else {
    state.phase = (state.phase + beatHz * dt) % 1;
  }

  // Subtle background grid + phosphor trace sweep
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  ctx.lineTo(w, h * 0.62);
  ctx.stroke();

  const color = !alive || effectiveBpm >= 145 ? '#f87171' : effectiveBpm >= 115 ? '#fbbf24' : '#4ade80';
  const baseY = h * 0.64;
  const ampUp = h * 0.52;
  const gap = 7;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let penDown = false;
  for (let x = 0; x < w; x++) {
    const ahead = (x - state.cursor + w) % w;
    if (ahead > 0 && ahead < gap) {
      penDown = false;
      continue;
    }
    const y = baseY - state.samples[x] * ampUp;
    if (!penDown) {
      ctx.moveTo(x, y);
      penDown = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Leading sweep dot
  const dotY = baseY - state.samples[state.cursor] * ampUp;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(state.cursor, dotY, 1.8, 0, Math.PI * 2);
  ctx.fill();

  return alive && state.phase >= 0.22 && state.phase <= 0.34;
}

const _domState = new WeakMap();
function _getCache(el) {
  let c = _domState.get(el);
  if (!c) {
    c = {};
    _domState.set(el, c);
  }
  return c;
}
function setText(el, val) {
  if (!el) return;
  const c = _getCache(el);
  if (c.t !== val) {
    c.t = val;
    el.textContent = val;
  }
}
function setClass(el, cls) {
  if (!el) return;
  const c = _getCache(el);
  if (c.c !== cls) {
    c.c = cls;
    el.className = cls;
  }
}
function setHidden(el, hidden) {
  if (!el) return;
  const c = _getCache(el);
  if (c.h !== hidden) {
    c.h = hidden;
    el.hidden = hidden;
  }
}
function setStyleProp(el, prop, val) {
  if (!el) return;
  const c = _getCache(el);
  if (c[prop] !== val) {
    c[prop] = val;
    el.style[prop] = val;
  }
}

export function isMinimapAllowed(difficulty = 'standard', mutatorId = '') {
  return difficulty !== 'hardcore' && mutatorId !== 'purist';
}

export function computeMinimapViewport(level, diver, { zoomMode = 'follow', width = 352, height = 224, revealSecretLair = true } = {}) {
  let b = level?.bounds || { xMin: -20, xMax: 160, yMin: -4, yMax: 70 };
  if (!revealSecretLair && Array.isArray(level?.segments) && level.segments.some((s) => s.secretLair)) {
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = b.yMin;
    let yMax = -Infinity;
    for (let i = 0; i < level.segments.length; i++) {
      const s = level.segments[i];
      if (s.secretLair) continue;
      const r = Math.max(s.ra || 2, s.rb || 2) + 4;
      xMin = Math.min(xMin, s.ax - r, s.bx - r);
      xMax = Math.max(xMax, s.ax + r, s.bx + r);
      yMax = Math.max(yMax, s.ay + r, s.by + r);
    }
    if (Number.isFinite(xMin) && Number.isFinite(xMax)) {
      b = { xMin: Math.max(b.xMin, xMin), xMax: Math.min(b.xMax, xMax), yMin, yMax: Math.min(b.yMax, yMax) };
    }
  }
  const padPx = 10;
  const innerW = Math.max(20, width - padPx * 2);
  const innerH = Math.max(20, height - padPx * 2);
  const worldW = Math.max(20, (b.xMax - b.xMin) || 120);
  const worldH = Math.max(20, (b.yMax - b.yMin) || 60);

  if (zoomMode === 'full') {
    const scale = Math.min(innerW / worldW, innerH / worldH);
    const drawW = worldW * scale;
    const drawH = worldH * scale;
    const offX = (width - drawW) * 0.5 - b.xMin * scale;
    const offY = (height - drawH) * 0.5 - b.yMin * scale;
    return {
      zoomMode: 'full',
      scale,
      offX,
      offY,
      viewMinX: -offX / scale,
      viewMaxX: (width - offX) / scale,
      viewMinY: -offY / scale,
      viewMaxY: (height - offY) / scale,
      toX: (wx) => offX + wx * scale,
      toY: (wy) => offY + wy * scale,
      fromX: (sx) => (sx - offX) / scale,
      fromY: (sy) => (sy - offY) / scale,
    };
  }

  // Follow zoom: tactical local sonar window centered on diver (~58m wide)
  const targetSpanX = Math.min(worldW, 60);
  const targetSpanY = Math.min(worldH, 38);
  const scale = Math.min(innerW / Math.max(24, targetSpanX), innerH / Math.max(18, targetSpanY));
  const halfSpanX = (width * 0.5) / scale;
  const halfSpanY = (height * 0.5) / scale;
  let cx = Number.isFinite(diver?.x) ? diver.x : (b.xMin + b.xMax) * 0.5;
  let cy = Number.isFinite(diver?.y) ? diver.y : (b.yMin + b.yMax) * 0.5;

  if (worldW > halfSpanX * 2) {
    cx = Math.max(b.xMin + halfSpanX - 4, Math.min(b.xMax - halfSpanX + 4, cx));
  } else {
    cx = (b.xMin + b.xMax) * 0.5;
  }
  if (worldH > halfSpanY * 2) {
    cy = Math.max(b.yMin + halfSpanY - 3, Math.min(b.yMax - halfSpanY + 3, cy));
  } else {
    cy = (b.yMin + b.yMax) * 0.5;
  }

  const offX = width * 0.5 - cx * scale;
  const offY = height * 0.5 - cy * scale;
  return {
    zoomMode: 'follow',
    scale,
    offX,
    offY,
    viewMinX: cx - halfSpanX,
    viewMaxX: cx + halfSpanX,
    viewMinY: cy - halfSpanY,
    viewMaxY: cy + halfSpanY,
    toX: (wx) => offX + wx * scale,
    toY: (wy) => offY + wy * scale,
    fromX: (sx) => (sx - offX) / scale,
    fromY: (sy) => (sy - offY) / scale,
  };
}

function _isPointRevealed(wx, wy, diver, exploreCells, exploredCells, exploredGrid, sonarPulse, revealDistM = 6.5) {
  if (diver) {
    const ddx = wx - diver.x;
    const ddy = wy - diver.y;
    const dr = revealDistM + 3.5;
    if (ddx * ddx + ddy * ddy <= dr * dr) return true;
  }
  if (sonarPulse) {
    const sdx = wx - sonarPulse.x;
    const sdy = wy - sonarPulse.y;
    const sr = sonarPulse.maxRadiusM || 28;
    if (sdx * sdx + sdy * sdy <= sr * sr) return true;
  }
  if (exploredGrid && exploredGrid.size > 0) {
    // O(1) 3x3 coarse 4m spatial neighborhood lookup (covers >= 6.5m radius with zero allocations)
    const cgx = Math.round(wx / EXPLORE_GRID_CELL_M) + 8192;
    const cgy = Math.round(wy / EXPLORE_GRID_CELL_M) + 8192;
    const span = revealDistM > 7.5 ? 2 : 1;
    for (let dx = -span; dx <= span; dx++) {
      const row = (cgx + dx) * 16384;
      for (let dy = -span; dy <= span; dy++) {
        if (exploredGrid.has(row + (cgy + dy))) return true;
      }
    }
    return false;
  }
  if (!exploreCells || !exploredCells || exploredCells.size === 0) return false;
  const r2 = revealDistM * revealDistM;
  for (const idx of exploredCells) {
    const c = exploreCells[idx];
    if (!c) continue;
    const dx = c.x - wx;
    const dy = c.y - wy;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

/**
 * Draw the live tactical Sonar Cave & Wreck Cartography Minimap onto a 2D canvas context.
 */
export function drawSonarMinimap(ctx, width, height, state) {
  if (!ctx || !state?.level || width <= 0 || height <= 0) return;
  const {
    level,
    diver,
    peers = [],
    exploreCells = [],
    exploredCells = null,
    exploredGrid = null,
    checkpointsHit = null,
    nextCheckpoint = null,
    collectedIds = null,
    openedHatchIds = null,
    claimedStageIds = null,
    placedMarkerIds = null,
    bodyRecovered = false,
    playerLines = [],
    sonarPulse = null,
    encounters = null,
    hazards = null,
    buddyPing = null,
    droppedStages = null,
    surveyPins = null,
    secretLair = null,
    syncedSonarPings = null,
    difficulty = 'standard',
    zoomMode = 'follow',
    timeSec = 0,
  } = state;

  const vp = computeMinimapViewport(level, diver, {
    zoomMode,
    width,
    height,
    revealSecretLair: secretLair ? Boolean(secretLair.veilBreached) : true,
  });
  const { scale, toX, toY, viewMinX, viewMaxX, viewMinY, viewMaxY } = vp;
  const isGuided = difficulty === 'guided';
  const isWreck = Boolean(level.isWreck);

  ctx.save();
  // 1. Translucent High-Tech Holographic Scope Backdrop & Bathymetric Tactical Grid
  if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, width, height);
  const bgGrad =
    typeof ctx.createRadialGradient === 'function'
      ? ctx.createRadialGradient(
          width * 0.5,
          height * 0.5,
          Math.min(width, height) * 0.08,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.72
        )
      : null;
  if (bgGrad && typeof bgGrad.addColorStop === 'function') {
    bgGrad.addColorStop(0, 'rgba(3, 24, 38, 0.74)');
    bgGrad.addColorStop(0.7, 'rgba(2, 13, 24, 0.84)');
    bgGrad.addColorStop(1, 'rgba(1, 8, 17, 0.92)');
    ctx.fillStyle = bgGrad;
  } else {
    ctx.fillStyle = 'rgba(2, 14, 26, 0.84)';
  }
  ctx.fillRect(0, 0, width, height);

  // Subtle vertical tactical range grid lines
  const horizStep = zoomMode === 'full' ? (viewMaxX - viewMinX > 140 ? 40 : 20) : 10;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.07)';
  const firstX = Math.ceil(viewMinX / horizStep) * horizStep;
  for (let wx = firstX; wx <= viewMaxX; wx += horizStep) {
    const sx = toX(wx);
    if (sx < 8 || sx > width - 8) continue;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
    ctx.stroke();
  }

  const depthStep = zoomMode === 'full' ? (viewMaxY - viewMinY > 110 ? 40 : 20) : 10;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.11)';
  ctx.fillStyle = 'rgba(103, 232, 249, 0.52)';
  ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  const firstDepth = Math.max(depthStep, Math.ceil(Math.max(0, viewMinY) / depthStep) * depthStep);
  for (let d = firstDepth; d <= viewMaxY; d += depthStep) {
    const sy = toY(d);
    if (sy < 14 || sy > height - 14) continue;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
    ctx.stroke();
    if (sy <= height - 24) {
      ctx.fillText(`${d}m`, 6, sy - 2);
    }
  }

  // Water surface horizon line (y = 0)
  const surfY = toY(0);
  if (surfY >= -4 && surfY <= height + 4) {
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.68)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, surfY);
    ctx.lineTo(width, surfY);
    ctx.stroke();
  }

  // 1b. Concentric Polar Range Rings & Live Rotating Phosphor Radar Sweep centered on Diver!
  if (diver && Number.isFinite(diver.x) && Number.isFinite(diver.y)) {
    const dcx = toX(diver.x);
    const dcy = toY(diver.y);
    const ringMeters = zoomMode === 'full' ? [20, 40] : [10, 20, 30];
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.17)';
    ctx.lineWidth = 1;
    for (let rIdx = 0; rIdx < ringMeters.length; rIdx++) {
      const rm = ringMeters[rIdx];
      const rp = rm * scale;
      if (rp < 14 || rp > Math.max(width, height) * 1.1) continue;
      ctx.beginPath();
      ctx.arc(dcx, dcy, rp, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Rotating phosphor sweep wedge with soft trailing glow
    const sweepR = Math.max(48, (zoomMode === 'full' ? 32 : 28) * scale);
    const sweepAng = (timeSec * 1.45) % (Math.PI * 2);
    const trailArc = 0.72;
    const steps = 6;
    for (let s = 0; s < steps; s++) {
      const f0 = s / steps;
      const f1 = (s + 1) / steps;
      const a0 = sweepAng - trailArc * (1 - f0);
      const a1 = sweepAng - trailArc * (1 - f1);
      ctx.fillStyle = `rgba(34, 211, 238, ${(0.018 + f1 * 0.085).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(dcx, dcy);
      ctx.arc(dcx, dcy, sweepR, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.58)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(dcx, dcy);
    ctx.lineTo(dcx + Math.cos(sweepAng) * sweepR, dcy + Math.sin(sweepAng) * sweepR);
    ctx.stroke();
    ctx.restore();
  }

  // 2. Passage Cartography: Guided Blueprint Ghost + Live Fog-of-War Explored Passages
  const cellR = Math.max(2.6, 2.35 * scale);
  const padWorld = 4;

  if (isGuided && Array.isArray(exploreCells) && exploreCells.length > 0) {
    ctx.fillStyle = isWreck ? 'rgba(251, 146, 60, 0.11)' : 'rgba(56, 189, 248, 0.11)';
    ctx.beginPath();
    for (let i = 0; i < exploreCells.length; i++) {
      const c = exploreCells[i];
      if (c.x < viewMinX - padWorld || c.x > viewMaxX + padWorld || c.y < viewMinY - padWorld || c.y > viewMaxY + padWorld) continue;
      const sx = toX(c.x);
      const sy = toY(c.y);
      ctx.moveTo(sx + cellR, sy);
      ctx.arc(sx, sy, cellR, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  if (exploredCells && exploredCells.size > 0 && Array.isArray(exploreCells)) {
    // High-tech bathymetric neon rim + translucent acoustic passage core
    ctx.fillStyle = isWreck ? 'rgba(251, 146, 60, 0.26)' : 'rgba(34, 211, 238, 0.24)';
    const outerR = cellR * 1.28;
    ctx.beginPath();
    for (const idx of exploredCells) {
      const c = exploreCells[idx];
      if (!c) continue;
      if (c.x < viewMinX - padWorld || c.x > viewMaxX + padWorld || c.y < viewMinY - padWorld || c.y > viewMaxY + padWorld) continue;
      const sx = toX(c.x);
      const sy = toY(c.y);
      ctx.moveTo(sx + outerR, sy);
      ctx.arc(sx, sy, outerR, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.fillStyle = isWreck ? 'rgba(253, 186, 116, 0.36)' : 'rgba(103, 232, 249, 0.36)';
    ctx.beginPath();
    for (const idx of exploredCells) {
      const c = exploreCells[idx];
      if (!c) continue;
      if (c.x < viewMinX - padWorld || c.x > viewMaxX + padWorld || c.y < viewMinY - padWorld || c.y > viewMaxY + padWorld) continue;
      const sx = toX(c.x);
      const sy = toY(c.y);
      ctx.moveTo(sx + cellR * 0.84, sy);
      ctx.arc(sx, sy, cellR * 0.84, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // 3. Shipwreck Shot Line
  if (isWreck && level.shotLine) {
    const sx = toX(level.shotLine.x ?? level.spawn?.x ?? 0);
    const sy0 = toY(0);
    const sy1 = toY(level.shotLine.bottomY ?? level.wreckDeckY ?? 40);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.65)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(sx, sy0);
    ctx.lineTo(sx, sy1);
    ctx.stroke();
    ctx.restore();
  }

  // 4. Fixed Cave Guidelines (shown fully in Guided, or where revealed in Standard)
  const drawGuidelineChain = (pts, stroke, lw) => {
    if (!Array.isArray(pts) || pts.length < 2) return;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      const vis = isGuided || _isPointRevealed(pt.x, pt.y, diver, exploreCells, exploredCells, exploredGrid, sonarPulse, 7.5);
      if (vis) {
        const sx = toX(pt.x);
        const sy = toY(pt.y);
        if (!drawing) {
          ctx.moveTo(sx, sy);
          drawing = true;
        } else {
          ctx.lineTo(sx, sy);
        }
      } else {
        drawing = false;
      }
    }
    ctx.stroke();
  };
  if (Array.isArray(level.guideline) && level.guideline.length >= 2) {
    drawGuidelineChain(level.guideline, 'rgba(253, 224, 71, 0.72)', 1.8);
  }
  if (Array.isArray(level.guidelineBranches)) {
    for (let b = 0; b < level.guidelineBranches.length; b++) {
      drawGuidelineChain(level.guidelineBranches[b], 'rgba(253, 224, 71, 0.48)', 1.3);
    }
  }

  // 5. Player-Deployed Guideline Reel Chains (always visible as your own breadcrumb trail!)
  if (Array.isArray(playerLines)) {
    for (let i = 0; i < playerLines.length; i++) {
      const pl = playerLines[i];
      if (!pl?.chains?.length) continue;
      ctx.strokeStyle = pl.isSelf ? '#4ade80' : '#38bdf8';
      ctx.lineWidth = pl.isSelf ? 2.2 : 1.7;
      for (let c = 0; c < pl.chains.length; c++) {
        const ch = pl.chains[c];
        if (!ch || ch.length === 0) continue;
        ctx.beginPath();
        ctx.moveTo(toX(ch[0].x), toY(ch[0].y));
        for (let k = 1; k < ch.length; k++) {
          ctx.lineTo(toX(ch[k].x), toY(ch[k].y));
        }
        if (pl.reelingActive && c === pl.chains.length - 1 && Number.isFinite(pl.ownerX) && Number.isFinite(pl.ownerY)) {
          ctx.lineTo(toX(pl.ownerX), toY(pl.ownerY));
        }
        ctx.stroke();
      }
    }
  }

  // 6. Discovered Interactive Stations & Relics
  if (Array.isArray(level.stageCaches)) {
    for (let i = 0; i < level.stageCaches.length; i++) {
      const st = level.stageCaches[i];
      if (!st || claimedStageIds?.has(st.id)) continue;
      if (!isGuided && !_isPointRevealed(st.x, st.y, diver, exploreCells, exploredCells, exploredGrid, sonarPulse, 7.0)) continue;
      const sx = toX(st.x);
      const sy = toY(st.y);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(sx - 3.5, sy - 3.5, 7, 7);
    }
  }
  if (Array.isArray(droppedStages) && droppedStages.length > 0) {
    for (let i = 0; i < droppedStages.length; i++) {
      const st = droppedStages[i];
      if (!st) continue;
      const sx = toX(st.x);
      const sy = toY(st.y);
      ctx.fillStyle = st.color || '#38bdf8';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.4;
      ctx.fillRect(sx - 3.5, sy - 5, 7, 10);
      ctx.strokeRect(sx - 3.5, sy - 5, 7, 10);
    }
  }
  if (Array.isArray(level.lineAnchors)) {
    for (let i = 0; i < level.lineAnchors.length; i++) {
      const an = level.lineAnchors[i];
      if (!an) continue;
      const tagged = Boolean(placedMarkerIds?.has(an.id));
      if (!tagged && !isGuided && !_isPointRevealed(an.x, an.y, diver, exploreCells, exploredCells, exploredGrid, sonarPulse, 7.0)) continue;
      const sx = toX(an.x);
      const sy = toY(an.y);
      ctx.fillStyle = tagged ? '#4ade80' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (Array.isArray(level.watertightHatches)) {
    for (let i = 0; i < level.watertightHatches.length; i++) {
      const h = level.watertightHatches[i];
      if (!h || openedHatchIds?.has(h.id)) continue;
      if (!isGuided && !_isPointRevealed(h.x, h.y, diver, exploreCells, exploredCells, exploredGrid, sonarPulse, 7.0)) continue;
      const sx = toX(h.x);
      const sy = toY(h.y);
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 4, sy - 4, 8, 8);
    }
  }
  const pulse = 0.5 + 0.5 * Math.sin(timeSec * 5.2);
  if (Array.isArray(level.collectibles)) {
    for (let i = 0; i < level.collectibles.length; i++) {
      const item = level.collectibles[i];
      if (!item || collectedIds?.has(item.id)) continue;
      if (!_isPointRevealed(item.x, item.y, diver, exploreCells, exploredCells, exploredGrid, sonarPulse, 6.0)) continue;
      const sx = toX(item.x);
      const sy = toY(item.y);
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(sx, sy, 6.2 + pulse * 1.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4.4);
      ctx.lineTo(sx + 3.8, sy);
      ctx.lineTo(sx, sy + 4.4);
      ctx.lineTo(sx - 3.8, sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 7. Checkpoints (with Tactical Bearing Vector + Target-Lock Brackets), Surface Exit & Recovery Target
  const allowCompassHints = isGuided || !level.hideWaypointCompass;
  let activeTargetDistM = null;
  let activeTargetTag = '';
  if (Array.isArray(level.checkpoints)) {
    for (let i = 0; i < level.checkpoints.length; i++) {
      const cp = level.checkpoints[i];
      const hit = Boolean(checkpointsHit?.has(cp.id));
      const isNext = nextCheckpoint && nextCheckpoint.id === cp.id;
      if (!hit && !allowCompassHints && !_isPointRevealed(cp.x, cp.y, diver, exploreCells, exploredCells, exploredGrid, sonarPulse, 6.5)) {
        continue;
      }
      const sx = toX(cp.x);
      const sy = toY(cp.y);
      if (isNext) {
        if (diver && Number.isFinite(diver.x) && Number.isFinite(diver.y)) {
          activeTargetDistM = Math.round(Math.hypot(cp.x - diver.x, cp.y - diver.y));
          activeTargetTag = 'WP';
          // Dashed tactical bearing vector from diver to active waypoint
          ctx.save();
          ctx.setLineDash([4, 5]);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.34)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(toX(diver.x), toY(diver.y));
          ctx.lineTo(sx, sy);
          ctx.stroke();
          ctx.restore();
        }
        // Corner target-lock reticle around next waypoint
        const br = 7.5 + pulse * 2.2;
        ctx.strokeStyle = `rgba(103, 232, 249, ${(0.62 + 0.35 * pulse).toFixed(2)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(sx - br, sy - br + 3.5); ctx.lineTo(sx - br, sy - br); ctx.lineTo(sx - br + 3.5, sy - br);
        ctx.moveTo(sx + br - 3.5, sy - br); ctx.lineTo(sx + br, sy - br); ctx.lineTo(sx + br, sy - br + 3.5);
        ctx.moveTo(sx - br, sy + br - 3.5); ctx.lineTo(sx - br, sy + br); ctx.lineTo(sx - br + 3.5, sy + br);
        ctx.moveTo(sx + br - 3.5, sy + br); ctx.lineTo(sx + br, sy + br); ctx.lineTo(sx + br, sy + br - 3.5);
        ctx.stroke();
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (hit) {
        ctx.fillStyle = 'rgba(74, 222, 128, 0.78)';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (level.exitZone) {
    const ex = toX(level.exitZone.x);
    const ey = toY(Math.max(1.0, level.exitZone.y));
    if (activeTargetDistM === null && diver && Number.isFinite(diver.x) && Number.isFinite(diver.y)) {
      activeTargetDistM = Math.round(Math.hypot(level.exitZone.x - diver.x, level.exitZone.y - diver.y));
      activeTargetTag = 'EXIT';
    }
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(ex, ey - 5.5);
    ctx.lineTo(ex + 5, ey + 3.5);
    ctx.lineTo(ex - 5, ey + 3.5);
    ctx.closePath();
    ctx.fill();
  }

  if (level.recoveryTarget && !bodyRecovered) {
    const rt = level.recoveryTarget;
    if (allowCompassHints || _isPointRevealed(rt.x, rt.y, diver, exploreCells, exploredCells, exploredGrid, sonarPulse, 7.0)) {
      const rx = toX(rt.x);
      const ry = toY(rt.y);
      ctx.strokeStyle = `rgba(244, 114, 182, ${(0.5 + 0.5 * pulse).toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rx, ry, 5 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(rx, ry, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Optional Survey / Distress Beacon (detectable via 24m acoustic ping range or once explored)
  if (encounters?.beacon && !encounters.beacon.claimed) {
    const bc = encounters.beacon;
    const inPingRange = diver && Math.hypot(bc.x - diver.x, bc.y - diver.y) <= 24;
    if (isGuided || inPingRange || _isPointRevealed(bc.x, bc.y, diver, exploreCells, exploredCells, exploredGrid, sonarPulse, 7.5)) {
      const bx = toX(bc.x);
      const by = toY(bc.y);
      ctx.strokeStyle = `rgba(251, 191, 36, ${(0.45 + 0.5 * pulse).toFixed(2)})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(bx, by, 4.5 + pulse * 3.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(bx, by - 4);
      ctx.lineTo(bx + 3.5, by);
      ctx.lineTo(bx, by + 4);
      ctx.lineTo(bx - 3.5, by);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Custom Wetnotes Survey Pins (v171 spatial markers synced with Survey Slate)
  if (Array.isArray(surveyPins) && surveyPins.length > 0) {
    for (let i = 0; i < surveyPins.length; i++) {
      const p = surveyPins[i];
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const px = toX(p.x);
      const py = toY(p.y);
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px, py - 5.2);
      ctx.lineTo(px + 4.4, py + 2.8);
      ctx.lineTo(px - 4.4, py + 2.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // 8. Active Cave Sonar Hydrophone Pulse Ring + Wall Echo Cloud + Hazard Contact Echoes
  if (sonarPulse && sonarPulse.durationSec > 0) {
    const frac = Math.max(0, Math.min(1, sonarPulse.ageSec / sonarPulse.durationSec));
    const sweepFrac = Math.min(1, sonarPulse.ageSec / 1.45);
    const rPx = sweepFrac * (sonarPulse.maxRadiusM || 28) * scale;
    const px = toX(sonarPulse.x);
    const py = toY(sonarPulse.y);
    const fade = Math.max(0, 1 - frac);

    if (sweepFrac < 1) {
      // Soft radial energy glow + dual wavefront rings
      const waveG =
        typeof ctx.createRadialGradient === 'function'
          ? ctx.createRadialGradient(px, py, Math.max(1, rPx * 0.72), px, py, Math.max(2, rPx))
          : null;
      if (waveG && typeof waveG.addColorStop === 'function') {
        waveG.addColorStop(0, 'rgba(34, 211, 238, 0)');
        waveG.addColorStop(1, `rgba(34, 211, 238, ${((1 - sweepFrac) * 0.24).toFixed(2)})`);
        ctx.fillStyle = waveG;
        ctx.beginPath();
        ctx.arc(px, py, rPx, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = `rgba(103, 232, 249, ${((1 - sweepFrac) * 0.95).toFixed(2)})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(px, py, rPx, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crisp wall-hit bathymetric dots swept by the active sonar wave
    const wallHits = sonarPulse.wallHits || [];
    if (wallHits.length > 0) {
      ctx.fillStyle = `rgba(103, 232, 249, ${(fade * 0.78).toFixed(2)})`;
      const maxWaveM = sweepFrac * (sonarPulse.maxRadiusM || 28);
      for (let i = 0; i < wallHits.length; i++) {
        const wh = wallHits[i];
        if (!wh || wh.dist > maxWaveM) continue;
        ctx.fillRect(toX(wh.x) - 1.2, toY(wh.y) - 1.2, 2.4, 2.4);
      }
    }

    const contacts = sonarPulse.contacts || [];
    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      const isLootOrThreat = c.kind === 'gear-cache' || c.kind === 'treasure-map' || c.kind === 'predator';
      if (!isLootOrThreat && c.kind !== 'shifting-hatch' && c.kind !== 'percolation' && c.kind !== 'thermocline' && c.kind !== 'secret-veil') continue;
      const cx = toX(c.x);
      const cy = toY(c.y);
      ctx.fillStyle =
        c.kind === 'predator'
          ? `rgba(251, 113, 133, ${(fade * 0.96).toFixed(2)})`
          : c.kind === 'treasure-map'
            ? `rgba(253, 224, 71, ${(fade * 0.96).toFixed(2)})`
            : c.kind === 'gear-cache'
              ? `rgba(250, 204, 21, ${(fade * 0.92).toFixed(2)})`
              : c.kind === 'secret-veil'
                ? `rgba(103, 232, 249, ${(fade * 0.72).toFixed(2)})`
                : c.kind === 'shifting-hatch'
                  ? (c.hatchRef?.openness ?? 1) < 0.35
                    ? `rgba(248, 113, 113, ${(fade * 0.95).toFixed(2)})`
                    : `rgba(74, 222, 128, ${(fade * 0.95).toFixed(2)})`
                  : c.kind === 'percolation'
                    ? `rgba(251, 191, 36, ${(fade * 0.9).toFixed(2)})`
                    : `rgba(125, 211, 252, ${(fade * 0.9).toFixed(2)})`;
      ctx.beginPath();
      if (c.kind === 'predator') {
        // Sharp crimson diamond for hostile predator sonar contact
        ctx.moveTo(cx, cy - 4.4);
        ctx.lineTo(cx + 4.4, cy);
        ctx.lineTo(cx, cy + 4.4);
        ctx.lineTo(cx - 4.4, cy);
        ctx.closePath();
      } else {
        ctx.arc(cx, cy, c.kind === 'secret-veil' ? 4.8 : isLootOrThreat ? 3.8 : c.kind === 'thermocline' ? 4.2 : 3.2, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  // 8a.5. Live Pulsing Treasure Map Gear Beacons on Player's Sonar Scope (v230 / v231)
  const mapChests = Array.isArray(hazards?.treasureChests) ? hazards.treasureChests : null;
  const mapCaches = Array.isArray(hazards?.worldGearCaches) ? hazards.worldGearCaches : null;
  const mapsList = Array.isArray(hazards?.treasureMaps) ? hazards.treasureMaps : null;
  const beaconTargets = [];
  if (mapChests) {
    for (const tc of mapChests) {
      if (!tc || tc.opened || !tc.beaconRevealed) continue;
      const linkedMap = mapsList?.find((m) => m.targetChestId === tc.id) || hazards?.activeTreasureBeacons?.find((b) => b.chestId === tc.id) || null;
      beaconTargets.push({ x: tc.x, y: tc.y, col: linkedMap?.color || tc.beamColor || '#facc15', rgb: linkedMap?.rgb || '250, 204, 21', icon: linkedMap?.skillIcon || '🗺️', short: linkedMap?.skillShort || 'GEAR' });
    }
  }
  if (mapCaches) {
    for (const gc of mapCaches) {
      if (!gc || gc.opened || !gc.beaconRevealed) continue;
      const lm = gc.leadMeta || null;
      beaconTargets.push({ x: gc.x, y: gc.y, col: lm?.color || '#facc15', rgb: lm?.rgb || '250, 204, 21', icon: lm?.skillIcon || gc.icon || '🗺️', short: lm?.skillShort || 'CACHE' });
    }
  }
  for (let i = 0; i < beaconTargets.length; i++) {
    const bt = beaconTargets[i];
    const rawX = toX(bt.x);
    const rawY = toY(bt.y);
    const pad = 10;
    const clampedX = Math.max(pad, Math.min(width - pad, rawX));
    const clampedY = Math.max(pad, Math.min(height - pad, rawY));
    const isOffEdge = Math.abs(rawX - clampedX) > 1 || Math.abs(rawY - clampedY) > 1;
    const ringP = (timeSec * 0.95 + i * 0.37) % 1;

    ctx.save();
    ctx.strokeStyle = `rgba(${bt.rgb}, ${((1 - ringP) * 0.95).toFixed(2)})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(clampedX, clampedY, 4 + ringP * 11, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = bt.col;
    ctx.strokeStyle = '#08111f';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(clampedX, clampedY - 5);
    ctx.lineTo(clampedX + 5, clampedY);
    ctx.lineTo(clampedX, clampedY + 5);
    ctx.lineTo(clampedX - 5, clampedY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const tag = `${bt.icon}${bt.short}${isOffEdge ? '↗' : ''}`;
    ctx.font = '800 8px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = clampedX > width * 0.65 ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef9c3';
    ctx.fillText(tag, clampedX + (clampedX > width * 0.65 ? -7 : 7), clampedY);
    ctx.restore();
  }

  // 8b. Secret Sonar-Only Lair Cartography (strictly hidden until sonar-revealed or breached!)
  if (secretLair?.spec) {
    const spec = secretLair.spec;
    if (secretLair.veilRevealed && !secretLair.veilBreached && (secretLair.veilRevealPulse || 0) > 0 && spec.veil) {
      const vx = toX(spec.veil.x);
      const vy = toY(spec.veil.y);
      const fade = Math.min(1, secretLair.veilRevealPulse / 2.5);
      ctx.strokeStyle = `rgba(103, 232, 249, ${(fade * (0.28 + 0.25 * pulse)).toFixed(2)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(vx, vy, 3.6 + pulse * 1.8, 0, Math.PI * 2);
      ctx.stroke();
    } else if (secretLair.veilBreached) {
      // Draw discovered secret corridor & abyssal arena passages in distinct bioluminescent violet
      const segs = level.segments || [];
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (!s.secretLair) continue;
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.30)';
        ctx.lineWidth = Math.max(4, ((s.ra + s.rb) * 0.5) * 1.65 * scale);
        ctx.beginPath();
        ctx.moveTo(toX(s.ax), toY(s.ay));
        ctx.lineTo(toX(s.bx), toY(s.by));
        ctx.stroke();
      }
      ctx.restore();
      if (!secretLair.weaponEquipped && spec.armory) {
        const ax = toX(spec.armory.x);
        const ay = toY(spec.armory.y);
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(ax, ay, 3.8, 0, Math.PI * 2);
        ctx.fill();
      }
      if (secretLair.boss && !secretLair.bossDefeated) {
        const bx = toX(secretLair.boss.x);
        const by = toY(secretLair.boss.y);
        ctx.strokeStyle = `rgba(244, 63, 94, ${(0.55 + 0.45 * pulse).toFixed(2)})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(bx, by, 6 + pulse * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fb7185';
        ctx.beginPath();
        ctx.arc(bx, by, 4.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (secretLair.bossDefeated && spec.arena?.exitUpdraft) {
        const ux = toX(spec.arena.exitUpdraft.x);
        const uy = toY(spec.arena.exitUpdraft.y);
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(ux, uy, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 8c. Synced Tactical Sonar Waypoint Pings (v207 — Tap-to-Ping Co-op & Solo Squad Callouts)
  if (Array.isArray(syncedSonarPings) && syncedSonarPings.length > 0) {
    // Dashed tactical bearing vector from diver to the most recent teammate ping (or latest ping)
    let latestRemote = null;
    for (let i = syncedSonarPings.length - 1; i >= 0; i--) {
      const p = syncedSonarPings[i];
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      if (!p.isSelf) {
        latestRemote = p;
        break;
      }
      if (!latestRemote) latestRemote = p;
    }
    if (latestRemote && diver && Number.isFinite(diver.x) && Number.isFinite(diver.y)) {
      const fadeVec = Math.max(0.25, Math.min(1, (latestRemote.life || 1) / 3.5));
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = `rgba(${latestRemote.rgb || '56, 189, 248'}, ${(0.55 * fadeVec).toFixed(2)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(toX(diver.x), toY(diver.y));
      ctx.lineTo(toX(latestRemote.x), toY(latestRemote.y));
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i < syncedSonarPings.length; i++) {
      const p = syncedSonarPings[i];
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const sx = toX(p.x);
      const sy = toY(p.y);
      const rgb = p.rgb || '56, 189, 248';
      const color = p.color || '#38bdf8';
      const fade = Math.max(0, Math.min(1, (p.life || 1) / 2.6));
      const offScope = sx < 8 || sx > width - 8 || sy < 8 || sy > height - 8;

      if (offScope) {
        // Clamped directional edge chevron on the sonar border when ping lies outside follow-zoom window
        const cx = Math.max(12, Math.min(width - 12, sx));
        const cy = Math.max(12, Math.min(height - 12, sy));
        const ang = Math.atan2(sy - cy, sx - cx);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.fillStyle = `rgba(${rgb}, ${(0.88 * fade).toFixed(2)})`;
        ctx.beginPath();
        ctx.moveTo(6.5, 0);
        ctx.lineTo(-4.5, -4.5);
        ctx.lineTo(-2.2, 0);
        ctx.lineTo(-4.5, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        continue;
      }

      // Dual expanding concentric radar ping ripples
      const wave1 = ((timeSec * 1.15 + i * 0.37) % 1);
      const wave2 = ((timeSec * 1.15 + i * 0.37 + 0.5) % 1);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = `rgba(${rgb}, ${((1 - wave1) * 0.85 * fade).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 4 + wave1 * 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1.1;
      ctx.strokeStyle = `rgba(${rgb}, ${((1 - wave2) * 0.65 * fade).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 4 + wave2 * 18, 0, Math.PI * 2);
      ctx.stroke();

      // High-contrast beacon diamond core
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = color;
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 5.4);
      ctx.lineTo(sx + 5.0, sy);
      ctx.lineTo(sx, sy + 5.4);
      ctx.lineTo(sx - 5.0, sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Compact tactical badge label above ping
      const tag = p.shortLabel || 'PING';
      ctx.font = '800 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
      const tw = ctx.measureText(tag).width + 8;
      const lx = Math.max(tw * 0.5 + 4, Math.min(width - tw * 0.5 - 4, sx));
      const ly = Math.max(16, sy - 7.5);
      ctx.fillRect(lx - tw * 0.5, ly - 11, tw, 11.5);
      ctx.fillStyle = color;
      ctx.fillText(tag, lx, ly - 0.5);
      ctx.restore();
    }
  }

  // 9. Co-op Buddy Dots (+ active Buddy Locate Ping reticle)
  if (Array.isArray(peers)) {
    for (let i = 0; i < peers.length; i++) {
      const p = peers[i];
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const px = toX(p.x);
      const py = toY(p.y);
      const isPinged = Boolean(buddyPing && buddyPing.timer > 0 && (!buddyPing.targetId || buddyPing.targetId === p.id));
      if (isPinged) {
        const pRing = 7 + ((timeSec * 14) % 10);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, pRing, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = p.alive === false ? '#ef4444' : isPinged ? '#fbbf24' : '#38bdf8';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(px, py, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // 10. Local Diver Torch Wedge & Heading Chevron
  if (diver && Number.isFinite(diver.x) && Number.isFinite(diver.y)) {
    const dx = toX(diver.x);
    const dy = toY(diver.y);
    const ang = Number.isFinite(diver.angle) ? diver.angle : 0;
    const tAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : ang;

    if (diver.torchOn !== false) {
      const coneR = Math.max(18, 12 * scale);
      ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.arc(dx, dy, coneR, tAng - 0.36, tAng + 0.36);
      ctx.closePath();
      ctx.fill();
    }

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(7.5, 0);
    ctx.lineTo(-5.2, -4.6);
    ctx.lineTo(-2.6, 0);
    ctx.lineTo(-5.2, 4.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // High-Tech Corner Telemetry Strip & Subtle Radar Scanline Sheen
  const sweepY = ((timeSec * 32) % (height + 40)) - 20;
  ctx.fillStyle = 'rgba(34, 211, 238, 0.055)';
  ctx.fillRect(0, sweepY, width, 8);

  // Bottom tactical telemetry badges (Depth + Waypoint Range)
  ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textBaseline = 'bottom';
  if (diver && Number.isFinite(diver.y)) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(186, 230, 253, 0.84)';
    ctx.fillText(`D ${Math.max(0, diver.y).toFixed(1)}m`, 8, height - 6);
  }
  if (activeTargetDistM !== null && activeTargetTag) {
    ctx.textAlign = 'right';
    ctx.fillStyle = activeTargetTag === 'EXIT' ? 'rgba(74, 222, 128, 0.9)' : 'rgba(103, 232, 249, 0.9)';
    ctx.fillText(`${activeTargetTag} ${activeTargetDistM}m`, width - 8, height - 6);
  }

  ctx.restore();
}

export class DiveComputerHUD {
  constructor({ onGasSelect, onReelToggle, onReelRewind, onReelRewindHold = null, onHeartbeatPulse, onBuddySelect = null }) {
    this.onHeartbeatPulse = onHeartbeatPulse;
    this.onBuddySelect = onBuddySelect;
    this._onReelRewindHold = onReelRewindHold;
    this._isTouchDevice =
      typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    this._narrowPhone = typeof window !== 'undefined' && window.innerWidth <= 680;
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', () => {
        this._narrowPhone = window.innerWidth <= 680;
      });
    }
    this.elDepth = document.getElementById('dc-depth');
    this.elMaxDepth = document.getElementById('dc-max-depth');
    this.elTime = document.getElementById('dc-time');
    this.elTemp = document.getElementById('dc-temp');
    this.elDecoLabel = document.getElementById('dc-deco-label');
    this.elDecoVal = document.getElementById('dc-deco-val');
    this.elPPO2 = document.getElementById('dc-ppo2');
    this.elCNS = document.getElementById('dc-cns');
    this.elEND = document.getElementById('dc-end');
    this.elAscentFill = document.getElementById('dc-ascent-fill');
    this.elAscentVal = document.getElementById('dc-ascent-val');
    this.elAlerts = document.getElementById('dc-alerts');
    this.elObjective = document.getElementById('dc-objective');
    this._objCountEl = null;
    this._objExtraEl = null;
    this._objGasEl = null;
    this._objMainEl = null;
    this._objHintEl = null;
    if (this.elObjective && this.elObjective.nodeType === 1 && typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const topRow = document.createElement('div');
      topRow.className = 'obj-top-row';
      const countEl = document.createElement('span');
      countEl.className = 'obj-count';
      const extraEl = document.createElement('span');
      extraEl.className = 'obj-extra';
      const gasEl = document.createElement('span');
      gasEl.className = 'obj-gas ok';
      topRow.appendChild(countEl);
      topRow.appendChild(extraEl);
      topRow.appendChild(gasEl);
      const mainEl = document.createElement('div');
      mainEl.className = 'obj-name';
      const hintEl = document.createElement('span');
      hintEl.className = 'obj-hint';
      this.elObjective.textContent = '';
      this.elObjective.appendChild(topRow);
      this.elObjective.appendChild(mainEl);
      this.elObjective.appendChild(hintEl);
      this._objCountEl = countEl;
      this._objExtraEl = extraEl;
      this._objGasEl = gasEl;
      this._objMainEl = mainEl;
      this._objHintEl = hintEl;
    }
    this.elBuddy = document.getElementById('dc-buddy');
    this.elSelfHealth = document.getElementById('hud-self-health');
    this.elSelfName = document.getElementById('dc-self-name');
    this.elModeBadge = document.getElementById('dc-mode-badge');
    this.elDailyBadge = document.getElementById('dc-daily-badge');
    this.elDrillPace = document.getElementById('hud-drill-pace');
    this.elDrillPaceTitle = document.getElementById('hud-drill-pace-title');
    this.elDrillPaceDelta = document.getElementById('hud-drill-pace-delta');
    this.elDrillPaceFill = document.getElementById('hud-drill-pace-fill');
    this.elMinimapWrap = document.getElementById('hud-minimap-wrap');
    this.elMinimapSonarView = document.getElementById('hud-minimap-sonar-view');
    this.elMinimapCanvas = document.getElementById('hud-minimap-canvas');
    this.elMinimapPct = document.getElementById('hud-minimap-pct');
    this.elMinimapZoom = document.getElementById('hud-minimap-zoom');
    this._minimapCtx = null;
    this._minimapRedrawAccum = 1;
    this._minimapLastExplored = -1;
    this._minimapLastZoom = '';
    this.elGasCallout = document.getElementById('hud-gas-callout');
    this.elGasCalloutTitle = document.getElementById('hud-gas-callout-title');
    this.elGasCalloutDetail = document.getElementById('hud-gas-callout-detail');
    this.elGasCalloutCta = document.getElementById('hud-gas-callout-cta');
    this._gasCalloutTargetId = null;
    this.elGasCallout?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this._gasCalloutTargetId) onGasSelect?.(this._gasCalloutTargetId);
    });
    this.elGasCallout?.addEventListener('click', (e) => {
      if (e.detail === 0 && this._gasCalloutTargetId) onGasSelect?.(this._gasCalloutTargetId);
    });
    this.elEkgRow = document.getElementById('dc-ekg-row');
    this.elEkgHeart = document.getElementById('dc-ekg-heart');
    this.elEkgBpm = document.getElementById('dc-ekg-bpm');
    this.elEkgCanvas = document.getElementById('dc-ekg-canvas');
    this.elReelRow = document.getElementById('hud-reel-dock');
    this.elReelStatus = document.getElementById('hud-reel-status');
    this.elReelMeters = document.getElementById('dc-reel-meters');
    this.btnReelToggle = document.getElementById('btn-reel-toggle');
    this.btnReelRewind = document.getElementById('btn-reel-rewind');
    this.btnReelToggle?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onReelToggle?.();
    });
    this.btnReelToggle?.addEventListener('click', (e) => {
      if (e.detail === 0) onReelToggle?.();
    });
    this.btnReelRewind?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { this.btnReelRewind.setPointerCapture(e.pointerId); } catch {}
      this._onReelRewindHold?.(true);
      onReelRewind?.();
    });
    const endRewindHold = () => this._onReelRewindHold?.(false);
    this.btnReelRewind?.addEventListener('pointerup', endRewindHold);
    this.btnReelRewind?.addEventListener('pointercancel', endRewindHold);
    this.btnReelRewind?.addEventListener('lostpointercapture', endRewindHold);
    this.btnReelRewind?.addEventListener('click', (e) => {
      if (e.detail === 0) onReelRewind?.();
    });
    this.selfEkg = createEkgState(128);
    this.mateCards = new Map();
    this._seenPeerIds = new Set();
    this._ekgStateByCanvas = new WeakMap();
    this._ekgResizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      try {
        this._ekgResizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const st = this._ekgStateByCanvas.get(entry.target);
            if (st) st.measured = false;
          }
        });
      } catch (_) {}
    }
    if (this.elEkgCanvas) {
      this._ekgStateByCanvas.set(this.elEkgCanvas, this.selfEkg);
      this._ekgResizeObserver?.observe(this.elEkgCanvas);
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this._onHudResize = () => {
        this.selfEkg.measured = false;
        for (const ui of this.mateCards.values()) {
          if (ui?.ekg) ui.ekg.measured = false;
        }
      };
      window.addEventListener('resize', this._onHudResize, { passive: true });
    }
    const bindVital = (el) => ({
      el,
      fill: el?.querySelector('.v-fill') || null,
      val: el?.querySelector('.v-val') || null,
      lastPct: -1,
      lastCls: '',
    });
    this.vitalEls = {
      tox: bindVital(document.getElementById('vital-tox')),
      dcs: bindVital(document.getElementById('vital-dcs')),
      narc: bindVital(document.getElementById('vital-narc')),
      hyp: bindVital(document.getElementById('vital-hyp')),
    };
    this.elVitalsRow = document.getElementById('dc-vitals');
    this._lastVitalsNominal = null;
    this.elGasZone = document.getElementById('hud-gas-zone');
    this.btnGasCompact = document.getElementById('btn-gas-compact');
    this.elGasCompactName = document.getElementById('gas-compact-name');
    this.elGasCompactBar = document.getElementById('gas-compact-bar');
    this.elGasCompactFill = document.getElementById('gas-compact-fill');
    this.elCcrControls = document.getElementById('hud-ccr-controls');
    this.elCcrSetpoint = document.getElementById('btn-ccr-setpoint');
    this.elCcrBailout = document.getElementById('btn-ccr-bailout');
    this._gasDrawerOpen = false;
    this._lastObjectiveHtml = '';
    this.tankButtons = {};

    const gasRack = document.getElementById('dc-gas-rack');
    gasRack.innerHTML = '';

    for (const id of GAS_ORDER) {
      const mix = GAS_MIXES[id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dc-tank-btn';
      btn.dataset.gas = id;
      btn.innerHTML = `
        <div class="tank-top">
          <span class="tank-name">${mix.name}</span>
          <span class="tank-bar-txt">200b</span>
        </div>
        <div class="tank-meta">${mix.role}</div>
        <div class="tank-gauge"><div class="tank-gauge-fill"></div></div>
      `;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        onGasSelect(id);
        this.setGasDrawerOpen(false);
      });
      btn.addEventListener('click', (e) => {
        if (e.detail === 0) {
          onGasSelect(id);
          this.setGasDrawerOpen(false);
        }
      });
      gasRack.appendChild(btn);
      this.tankButtons[id] = {
        btn,
        nameEl: btn.querySelector('.tank-name'),
        metaEl: btn.querySelector('.tank-meta'),
        barTxt: btn.querySelector('.tank-bar-txt'),
        fill: btn.querySelector('.tank-gauge-fill'),
      };
    }

    if (this.btnGasCompact) {
      this.btnGasCompact.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setGasDrawerOpen(!this._gasDrawerOpen);
      });
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('pointerdown', (e) => {
        if (!this._gasDrawerOpen) return;
        if (this.elGasZone && this.elGasZone.contains(e.target)) return;
        this.setGasDrawerOpen(false);
      });
    }
  }

  setGasDrawerOpen(open) {
    const next = Boolean(open);
    this._gasDrawerOpen = next;
    if (this.elGasZone) this.elGasZone.classList.toggle('gas-open', next);
    if (this.btnGasCompact) {
      this.btnGasCompact.classList.toggle('open', next);
      this.btnGasCompact.setAttribute('aria-expanded', next ? 'true' : 'false');
      const caret = this.btnGasCompact.querySelector('.gas-compact-caret');
      if (caret) caret.textContent = next ? '▾' : '▴';
    }
  }

  isGasDrawerOpen() {
    return Boolean(this._gasDrawerOpen);
  }

  _updateVitalBar(vital, pct, warnAt, dangerAt) {
    if (!vital?.el) return;
    const clamped = Math.max(0, Math.min(100, Math.round(pct || 0)));
    const cls = clamped >= dangerAt ? 'danger' : clamped >= warnAt ? 'warn' : '';
    if (vital.lastCls !== cls) {
      vital.lastCls = cls;
      vital.el.className = cls ? `dc-vital ${cls}` : 'dc-vital';
    }
    if (vital.lastPct !== clamped) {
      vital.lastPct = clamped;
      if (vital.fill) vital.fill.style.width = `${clamped}%`;
      if (vital.val) vital.val.textContent = `${clamped}%`;
    }
  }

  update({
    diveState,
    diver,
    nextCheckpoint,
    exitZone,
    checkpointsHit,
    totalCheckpoints,
    collectedCount = 0,
    collectiblesTotal = 0,
    exploredPct = 0,
    bodyRecovered = false,
    carryingBody = false,
    peerDiver,
    peers,
    playerName = '',
    level,
    ascentConfig,
    reelMaxMeters = 0,
    reelRemainingM = 0,
    reelingActive = false,
    difficulty = 'standard',
    mutatorId = '',
    dailyMutatorLabel = '',
    minimapVisible = true,
    minimapZoomMode = 'follow',
    surveySlateOpen = false,
    surveySlateFollowZoom = false,
    exploreCells = null,
    exploredCells = null,
    exploredGrid = null,
    collectedIds = null,
    openedHatchIds = null,
    claimedStageIds = null,
    placedMarkerIds = null,
    playerLines = null,
    sonarPulse = null,
    encounters = null,
    hazards = null,
    buddyPing = null,
    droppedStages = null,
    surveyPins = null,
    secretLair = null,
    syncedSonarPings = null,
    rescueDrillMeta = null,
    endedState = '',
    spectatingPeer = false,
    timeSec = 0,
    dt = 0.016,
  }) {
    const cleanDiff = difficulty === 'guided' || difficulty === 'hardcore' ? difficulty : 'standard';
    if (this.elModeBadge) {
      const modeLbl =
        cleanDiff === 'hardcore' ? '🔥 HARDCORE' : cleanDiff === 'guided' ? '🧭 GUIDED' : '🤿 TECH';
      setText(this.elModeBadge, modeLbl);
      setClass(this.elModeBadge, `mode-badge hud-mode-badge mode-${cleanDiff}`);
    }
    if (this.elDailyBadge) {
      const hasDaily = Boolean(mutatorId && dailyMutatorLabel);
      setHidden(this.elDailyBadge, !hasDaily);
      if (hasDaily) {
        setText(this.elDailyBadge, dailyMutatorLabel);
      }
    }
    setText(this.elDepth, diveState.depthM.toFixed(1));
    setText(this.elMaxDepth, `MAX ${diveState.maxDepthM.toFixed(1)}m`);
    if (rescueDrillMeta?.parTimeSec > 0) {
      const pace = computeDrillPaceStatus(rescueDrillMeta.parTimeSec, diveState.diveTimeSec);
      setText(this.elTime, formatClock(diveState.diveTimeSec));
      if (this.elTime?.style) this.elTime.style.color = pace.color;
      if (this.elDrillPace) {
        setHidden(this.elDrillPace, false);
        setText(this.elDrillPaceTitle, `${rescueDrillMeta.icon || '⚡'} ${rescueDrillMeta.name || 'RESCUE DRILL'}`);
        setText(this.elDrillPaceDelta, `${formatClock(diveState.diveTimeSec)} · ${pace.label}`);
        if (this.elDrillPaceDelta?.style) this.elDrillPaceDelta.style.color = pace.color;
        const pct = Math.max(0, Math.min(100, (diveState.diveTimeSec / Math.max(1, rescueDrillMeta.parTimeSec)) * 100));
        if (this.elDrillPaceFill?.style) {
          this.elDrillPaceFill.style.width = `${pct.toFixed(1)}%`;
          this.elDrillPaceFill.style.background = pace.color;
        }
        setClass(this.elDrillPace, `hud-drill-pace band-${pace.band}`);
      }
    } else {
      setText(this.elTime, formatClock(diveState.diveTimeSec));
      if (this.elTime?.style && this.elTime.style.color) this.elTime.style.color = '';
      setHidden(this.elDrillPace, true);
    }
    if (this.elTemp && hazards && Number.isFinite(hazards.waterTempC)) {
      const inCold = Boolean(hazards.inThermocline || (hazards.thermoclineColdFactor || 0) > 0.2);
      setText(this.elTemp, `${inCold ? '❄️' : ''}${Math.round(hazards.waterTempC)}°C`);
      setClass(this.elTemp, inCold ? 'dc-subval dc-temp cold' : 'dc-subval dc-temp');
    }

    // Live CCR Rebreather Setpoint & Scrubber Pill (hidden strictly on open-circuit dives! v197)
    if (this.elCcrControls) {
      const ccrOn = Boolean(diveState?.ccrEnabled);
      setHidden(this.elCcrControls, !ccrOn);
      if (ccrOn) {
        const sp = Number(diveState.ccrSetpointBar ?? 1.3).toFixed(1);
        const sc = Math.max(0, Math.round(diveState.ccrScrubberPct ?? 100));
        setText(this.elCcrSetpoint, `♻️ SP ${sp} · ${sc}%`);
        setClass(this.elCcrSetpoint, sc <= 25 ? 'ccr-pill-btn low-scrub' : 'ccr-pill-btn');
        setHidden(this.elCcrBailout, sc > 25);
      }
    }

    // NDL vs Mandatory Deco Stop
    if (diveState.stopDepthM > 0) {
      const violating = diveState.depthM < diveState.ceilingM - 0.5;
      setText(this.elDecoLabel, violating ? 'BELOW CEIL!' : `STOP ${diveState.stopDepthM}m`);
      setText(this.elDecoVal, formatClock(diveState.stopRemainingSec));
      setClass(this.elDecoVal, `dc-val ${violating ? 'danger blink' : 'warn'}`);
      setClass(this.elDecoLabel, `dc-lbl ${violating ? 'danger' : 'warn'}`);
    } else {
      setText(this.elDecoLabel, 'NDL');
      setClass(this.elDecoLabel, 'dc-lbl');
      setText(this.elDecoVal, `${diveState.ndlMin}m`);
      setClass(this.elDecoVal, `dc-val ${diveState.ndlMin <= 2 ? 'warn' : 'ok'}`);
    }

    // PPO2 color grading + colorblind-safe micro-glyphs (v143)
    const ppo2Str = diveState.ppo2.toFixed(2);
    if (diveState.ppo2 < 0.16 && diveState.depthM > 0.2) {
      setText(this.elPPO2, `▼${ppo2Str}`);
      setClass(this.elPPO2, 'dc-val cyan blink');
    } else if (diveState.ppo2 > 1.6) {
      setText(this.elPPO2, `⛔${ppo2Str}`);
      setClass(this.elPPO2, 'dc-val danger blink');
    } else if (diveState.ppo2 > 1.4) {
      setText(this.elPPO2, `⚠${ppo2Str}`);
      setClass(this.elPPO2, 'dc-val warn');
    } else {
      setText(this.elPPO2, ppo2Str);
      setClass(this.elPPO2, 'dc-val ok');
    }

    // CNS & END & Self Vitals Bars
    setText(this.elCNS, `${Math.round(diveState.cnsPercent)}%`);
    setClass(this.elCNS, `dc-subval ${diveState.cnsPercent >= 80 ? 'danger' : diveState.cnsPercent >= 40 ? 'warn' : ''}`);
    setText(this.elEND, `END ${Math.round(diveState.endM)}m`);
    setClass(this.elEND, `dc-subval ${diveState.narcosisLevel > 0.35 ? 'warn' : ''}`);

    this._updateVitalBar(this.vitalEls.tox, diveState.cnsPercent, 30, 70);
    this._updateVitalBar(this.vitalEls.dcs, diveState.dcsStress, 22, 65);
    this._updateVitalBar(this.vitalEls.narc, (diveState.narcosisLevel || 0) * 100, 28, 68);
    this._updateVitalBar(this.vitalEls.hyp, diveState.hypoxiaStress, 22, 65);
    if (this.elVitalsRow) {
      const allNominal =
        (diveState.cnsPercent || 0) < 5 &&
        (diveState.dcsStress || 0) < 5 &&
        ((diveState.narcosisLevel || 0) * 100) < 5 &&
        (diveState.hypoxiaStress || 0) < 5;
      if (this._lastVitalsNominal !== allNominal) {
        this._lastVitalsNominal = allNominal;
        this.elVitalsRow.classList.toggle('all-nominal', allNominal);
      }
    }

    // Local Heartbeat, Self Name & EKG Waveform Monitor
    const myBpm = diveState.alive === false ? 0 : Math.round(diveState.heartRateBpm ?? 68);
    if (this.elSelfName) {
      const cleanName = typeof playerName === 'string' ? playerName.trim() : '';
      setText(this.elSelfName, cleanName ? `YOU · ${cleanName}` : 'YOU');
    }
    setText(this.elEkgBpm, diveState.alive === false ? '--' : String(myBpm));
    const selfSev =
      diveState.alive === false ||
      diveState.criticalAlarm ||
      myBpm >= 145 ||
      (diveState.cnsPercent || 0) >= 70 ||
      (diveState.dcsStress || 0) >= 65 ||
      (diveState.hypoxiaStress || 0) >= 65 ||
      ((diveState.narcosisLevel || 0) * 100) >= 68
        ? 'danger'
        : myBpm >= 115 ||
            diveState.warnings?.length > 0 ||
            (diveState.cnsPercent || 0) >= 30 ||
            (diveState.dcsStress || 0) >= 22 ||
            (diveState.hypoxiaStress || 0) >= 22 ||
            ((diveState.narcosisLevel || 0) * 100) >= 28
          ? 'warn'
          : '';
    setClass(this.elSelfHealth, selfSev ? `self-health-card ${selfSev}` : 'self-health-card');
    if (this.elEkgRow) {
      const hrCls = diveState.alive === false || myBpm >= 145 ? 'danger' : myBpm >= 115 ? 'warn' : '';
      setClass(this.elEkgRow, hrCls ? `dc-ekg-row ${hrCls}` : 'dc-ekg-row');
    }
    const qrsPeak = stepAndDrawEkg(this.elEkgCanvas, this.selfEkg, myBpm, diveState.alive !== false, dt);
    if (this.elEkgHeart && this._lastQrsPeak !== qrsPeak) {
      this._lastQrsPeak = qrsPeak;
      this.elEkgHeart.classList.toggle('pulse', qrsPeak);
      if (qrsPeak && myBpm >= 130) {
        this.onHeartbeatPulse?.(myBpm);
      }
    }

    // Deployable Guideline Spool Dock & Bottom-Center Line Status (unlined labyrinth caves)
    const showReel = reelMaxMeters > 0;
    setHidden(this.elReelStatus, !showReel);
    if (this.elReelRow) {
      if (showReel) {
        setHidden(this.elReelRow, false);
        const remM = Math.max(0, Math.round(reelRemainingM));
        const rCls = remM <= 1 ? 'danger' : remM < 35 ? 'warn' : reelingActive ? 'active' : '';
        const dockStateCls = `${reelingActive ? 'active ' : ''}${rCls}`.trim();
        setClass(this.elReelRow, dockStateCls ? `hud-reel-dock ${dockStateCls}` : 'hud-reel-dock');
        setClass(this.elReelStatus, dockStateCls ? `reel-dock-status ${dockStateCls}` : 'reel-dock-status');
        setText(this.elReelMeters, `${remM}m / ${reelMaxMeters}m`);
        if (this.btnReelToggle) {
          setClass(this.btnReelToggle, reelingActive ? 'reel-btn active' : 'reel-btn');
          const narrowPhone = this._narrowPhone;
          const prefix = this._isTouchDevice || narrowPhone ? '' : '[G] ';
          setText(
            this.btnReelToggle,
            reelingActive
              ? `${prefix}TIE OFF`
              : remM < 1
                ? 'EMPTY'
                : narrowPhone
                  ? '🧵 LINE'
                  : `${prefix}DEPLOY LINE`
          );
        }
        if (this.btnReelRewind) {
          const narrowPhone = this._narrowPhone;
          setText(this.btnReelRewind, narrowPhone ? '↩' : this._isTouchDevice ? 'REWIND ↩' : '[R] REWIND ↩');
        }
      } else {
        setHidden(this.elReelRow, true);
      }
    }

    // Ascent rate meter (0 to 18 m/min)
    const upRate = Math.max(0, diveState.ascentRateMPerMin);
    const pct = Math.min(100, Math.round((upRate / 18) * 100));
    setStyleProp(this.elAscentFill, 'height', `${pct}%`);
    setClass(this.elAscentFill, `dc-ascent-fill ${upRate > 12 ? 'danger' : upRate > 9 ? 'warn' : 'ok'}`);
    setText(this.elAscentVal, `${Math.round(upRate)}`);

    // Gas Tank Selectors & Optimal Depth Recommendation
    const resolvedAscent = ascentConfig || getAscentConfig(level);
    const ascending = checkpointsHit.has(resolvedAscent.turnaroundId);
    const recGasId = getRecommendedGas(diveState, { ascending });
    const ascentStep = getAscentInstruction(diveState, diver.y, checkpointsHit, resolvedAscent, nextCheckpoint);
    const gasCoach = getGasSwitchCoach(diveState, diver.y, { ascending });

    // One-tap interactive gas-switch callout banner (descent 22m TMX switch, wrong O2/hypoxic gas, or ascent switch)
    let calloutPrompt = gasCoach;
    if (!calloutPrompt && ascentStep && ascentStep.action === 'STOP' && ascentStep.targetGas && ascentStep.targetGas !== diveState.activeGasId) {
      const tMix = (diveState.mixes || GAS_MIXES)[ascentStep.targetGas] || GAS_MIXES[ascentStep.targetGas];
      const hk = GAS_HOTKEY_LABELS[ascentStep.targetGas] || '';
      calloutPrompt = {
        severity: 'warn',
        targetGas: ascentStep.targetGas,
        gasName: tMix?.name || ascentStep.targetGas,
        hotkey: hk,
        title: ascentStep.title,
        detail: ascentStep.detail,
      };
    }
    if (this.elGasCallout) {
      if (calloutPrompt) {
        this._gasCalloutTargetId = calloutPrompt.targetGas;
        setHidden(this.elGasCallout, false);
        setClass(this.elGasCallout, `hud-gas-callout ${calloutPrompt.severity === 'danger' ? 'danger' : 'warn'}`);
        setText(this.elGasCalloutTitle, `${calloutPrompt.severity === 'danger' ? '⛔' : '■'} ${calloutPrompt.title}`);
        setText(this.elGasCalloutDetail, calloutPrompt.detail);
        setText(
          this.elGasCalloutCta,
          this._isTouchDevice ? `TAP ${calloutPrompt.gasName}` : `TAP ${calloutPrompt.gasName} [${calloutPrompt.hotkey}]`
        );
      } else {
        this._gasCalloutTargetId = null;
        setHidden(this.elGasCallout, true);
      }
    }

    const mixMap = diveState.mixes || GAS_MIXES;
    for (const id of GAS_ORDER) {
      const tank = diveState.tanks[id];
      const mix = mixMap[id];
      const ui = this.tankButtons[id];
      setText(ui.nameEl, mix.name);
      setText(ui.metaEl, mix.role);
      const isActive = diveState.activeGasId === id;
      const isRec = (recGasId === id || calloutPrompt?.targetGas === id) && !isActive;
      const isUrgentRec = isRec && calloutPrompt?.severity === 'danger';
      const futurePPO2 = computePPO2(diveState.depthM, mix);
      const unsafeAtDepth = (futurePPO2 > 1.65 || (futurePPO2 < 0.16 && diveState.depthM > 0.2));
      const isEmpty = tank.bar <= 0.5;
      const btnCls = `dc-tank-btn${isActive ? ' active' : ''}${isRec ? ' recommended' : ''}${isUrgentRec ? ' urgent' : ''}${unsafeAtDepth ? ' unsafe' : ''}${isEmpty ? ' empty' : ''}`;
      setClass(ui.btn, btnCls);
      const recBadge = this._isTouchDevice ? 'TAP!' : `TAP [${GAS_HOTKEY_LABELS[id]}]`;
      setText(ui.barTxt, isRec ? recBadge : `${Math.round(tank.bar)}b`);
      const fillPct = Math.max(0, Math.min(100, Math.round((tank.bar / mix.startBar) * 200) * 0.5));
      setStyleProp(ui.fill, 'width', `${fillPct}%`);
      setStyleProp(ui.fill, 'backgroundColor', tank.bar < 45 ? '#ef4444' : mix.color);
    }

    // Mobile Compact Single-Button Active Gas Pill (v149)
    if (this.btnGasCompact) {
      const actId = diveState.activeGasId;
      const actTank = diveState.tanks[actId];
      const actMix = mixMap[actId] || GAS_MIXES[actId];
      const targetRecId = calloutPrompt?.targetGas || (recGasId !== actId ? recGasId : null);
      const needsSwitch = Boolean(targetRecId && targetRecId !== actId);
      const isUrgent = Boolean(needsSwitch && calloutPrompt?.severity === 'danger');
      const recMix = targetRecId ? (mixMap[targetRecId] || GAS_MIXES[targetRecId]) : null;
      const compactCls = `gas-compact-btn${this._gasDrawerOpen ? ' open' : ''}${needsSwitch ? ' needs-switch' : ''}${isUrgent ? ' urgent' : ''}`;
      setClass(this.btnGasCompact, compactCls);
      setText(this.elGasCompactName, needsSwitch && recMix ? `→ ${recMix.name}` : actMix.name);
      setText(this.elGasCompactBar, `${Math.round(actTank?.bar ?? 0)}b`);
      const actPct = Math.max(0, Math.min(100, Math.round(((actTank?.bar ?? 0) / (actMix.startBar || 200)) * 200) * 0.5));
      setStyleProp(this.elGasCompactFill, 'width', `${actPct}%`);
      setStyleProp(this.elGasCompactFill, 'backgroundColor', (actTank?.bar ?? 0) < 45 ? '#ef4444' : actMix.color);
    }

    // Alerts Strip (uses active level mixMap so gasOverrides on L12–L20 display accurately)
    if (endedState === 'surfaced') {
      setText(this.elAlerts, '✓ SURFACED SAFE · TEAM HOLD');
      setClass(this.elAlerts, 'dc-alerts ok');
    } else if (endedState === 'down') {
      setText(this.elAlerts, '✕ DIVER DOWN · AWAITING RESCUE');
      setClass(this.elAlerts, 'dc-alerts danger');
    } else if (gasCoach && gasCoach.severity === 'danger') {
      setText(this.elAlerts, `⛔ ${gasCoach.title}`);
      setClass(this.elAlerts, 'dc-alerts danger');
    } else if (diveState.warnings.length > 0) {
      const wTxt = String(diveState.warnings[0] || '');
      const hasGlyph = /^[⛔⚠✕♥■▲✓]/.test(wTxt);
      setText(this.elAlerts, hasGlyph ? wTxt : `${diveState.criticalAlarm ? '⛔' : '⚠'} ${wTxt}`);
      setClass(this.elAlerts, `dc-alerts ${diveState.criticalAlarm ? 'danger' : 'warn'}`);
    } else if (myBpm >= 138) {
      setText(this.elAlerts, `♥ ${myBpm} BPM — RELEASE CONTROLS TO CALM`);
      setClass(this.elAlerts, 'dc-alerts warn');
    } else if (gasCoach) {
      setText(this.elAlerts, `⚠ ${gasCoach.title}`);
      setClass(this.elAlerts, 'dc-alerts warn');
    } else if (ascentStep) {
      setText(this.elAlerts, `${ascentStep.action === 'STOP' ? '■ ' : '▲ '}${ascentStep.title}`);
      setClass(this.elAlerts, `dc-alerts ${ascentStep.action === 'STOP' ? 'warn' : 'ok'}`);
    } else if (recGasId !== diveState.activeGasId) {
      setText(this.elAlerts, `⚠ SWITCH → ${(mixMap[recGasId] || GAS_MIXES[recGasId]).name}`);
      setClass(this.elAlerts, 'dc-alerts warn');
    } else {
      setText(this.elAlerts, `✓ ${(mixMap[diveState.activeGasId] || GAS_MIXES[diveState.activeGasId]).name} · NOMINAL`);
      setClass(this.elAlerts, 'dc-alerts ok');
    }

    // Concise Objective Tracker
    const recName = (mixMap[recGasId] || GAS_MIXES[recGasId]).name;
    const gasBadgeCls = recGasId === diveState.activeGasId ? 'obj-gas ok' : 'obj-gas switch';
    const gasBadgeTxt = recGasId === diveState.activeGasId ? `✓ ${recName}` : `→ ${recName}`;

    const extraStatTxt =
      collectiblesTotal > 0 ? `💎${collectedCount}/${collectiblesTotal} · 🧭${exploredPct}%` : '';

    const isProbe = level?.recoveryTarget?.kind === 'probe';
    const recoveryTag = level?.recoveryTarget
      ? carryingBody
        ? isProbe ? ' · 🛰 CORE' : ' · 🛟 TOW'
        : bodyRecovered
          ? ' · ✓ REC'
          : isProbe ? ' · 🛰 PROBE' : ' · 🛟 BODY'
      : '';

    let objCountTxt = '';
    let objGasCls = gasBadgeCls;
    let objGasTxt = gasBadgeTxt;
    let objMainCls = 'obj-name';
    let objMainTxt = '';
    let objHintTxt = '';

    if (endedState === 'surfaced') {
      objCountTxt = `TEAM HOLD · CP ${checkpointsHit.size}/${totalCheckpoints}${recoveryTag}`;
      objGasCls = 'obj-gas ok';
      objGasTxt = '✓ SAFE';
      objMainCls = 'obj-action move';
      objMainTxt = '✓ SURFACED SAFE · WAITING FOR CREW';
      objHintTxt = spectatingPeer
        ? 'Spectating crew below · Tap Finish Now to debrief'
        : 'Tap Watch Buddy below to spectate or Finish Now to debrief';
    } else if (endedState === 'down') {
      objCountTxt = `DIVER DOWN · CP ${checkpointsHit.size}/${totalCheckpoints}${recoveryTag}`;
      objGasCls = 'obj-gas switch';
      objGasTxt = 'RESCUE';
      objMainCls = 'obj-action danger';
      objMainTxt = '✕ DIVER DOWN · SPECTATING CREW';
      objHintTxt = 'A buddy can tow you to surface, or tap Finish Now below';
    } else if (gasCoach && (gasCoach.severity === 'danger' || !ascentStep)) {
      const cls = gasCoach.severity === 'danger' ? 'danger' : 'stop';
      const icon = gasCoach.severity === 'danger' ? '⛔' : '■';
      objCountTxt = `GAS SWITCH · CP ${checkpointsHit.size}/${totalCheckpoints}${recoveryTag}`;
      objMainCls = `obj-action ${cls}`;
      objMainTxt = `${icon} ${gasCoach.title}`;
      objHintTxt = gasCoach.detail;
    } else if (ascentStep && (!level?.recoveryTarget || bodyRecovered)) {
      const cls = ascentStep.action === 'STOP' ? 'stop' : 'move';
      const icon = ascentStep.action === 'STOP' ? '■' : '▲';
      objCountTxt = `ASCENT · CP ${checkpointsHit.size}/${totalCheckpoints}${recoveryTag}`;
      objMainCls = `obj-action ${cls}`;
      objMainTxt = `${icon} ${ascentStep.title}`;
      objHintTxt = ascentStep.detail;
    } else if (nextCheckpoint) {
      const hideCompass =
        mutatorId === 'purist'
          ? true
          : cleanDiff === 'guided'
            ? false
            : cleanDiff === 'hardcore'
              ? true
              : Boolean(level?.hideWaypointCompass);
      if (hideCompass) {
        const navHint =
          mutatorId === 'purist'
            ? 'Purist Daily · Navigate by guideline & landmarks'
            : reelMaxMeters > 0
              ? `Unlined · [G] deploy reel (${Math.round(reelRemainingM)}m)`
              : cleanDiff === 'hardcore'
                ? 'Hardcore · Navigate by guideline & landmarks'
                : 'Follow landmarks & cave corridors';
        objCountTxt = `${mutatorId === 'purist' ? 'PURIST' : cleanDiff === 'hardcore' ? 'HARDCORE' : 'MAZE'} · CP ${checkpointsHit.size}/${totalCheckpoints}${recoveryTag}`;
        objMainTxt =
          level.recoveryTarget && !bodyRecovered
            ? `Recover ${level.recoveryTarget.name} (${Math.round(level.recoveryTarget.y)}m)`
            : `Tag cave hubs (${checkpointsHit.size}/${totalCheckpoints})`;
        objHintTxt = navHint;
      } else {
        const dist = Math.hypot(nextCheckpoint.x - diver.x, nextCheckpoint.y - diver.y);
        const dir = nextCheckpoint.x > diver.x + 1.5 ? '→' : nextCheckpoint.x < diver.x - 1.5 ? '←' : '';
        const vDir = nextCheckpoint.y > diver.y + 1.5 ? '↓' : nextCheckpoint.y < diver.y - 1.5 ? '↑' : '';
        objCountTxt = `CP ${checkpointsHit.size}/${totalCheckpoints}`;
        objMainTxt = `${dir}${vDir} ${nextCheckpoint.name} (${Math.round(dist)}m)`;
        objHintTxt = nextCheckpoint.hint;
      }
    } else {
      const hideCompass =
        mutatorId === 'purist'
          ? true
          : cleanDiff === 'guided'
            ? false
            : cleanDiff === 'hardcore'
              ? true
              : Boolean(level?.hideWaypointCompass);
      if (hideCompass) {
        const needsRecovery = Boolean(level?.recoveryTarget && !bodyRecovered);
        objCountTxt = `CP ${checkpointsHit.size}/${totalCheckpoints}${recoveryTag}`;
        objMainTxt = needsRecovery
          ? `Recover ${level.recoveryTarget.name} (${Math.round(level.recoveryTarget.y)}m)`
          : `↑ Locate ${exitZone?.name || 'Resurgence Exit'}`;
        objHintTxt = needsRecovery
          ? `Recovery required before surfacing at ${exitZone?.name || 'exit'}`
          : `Follow your deployed line or ascend to ${exitZone?.name || 'surface exit'}`;
      } else {
        const dist = Math.hypot(exitZone.x - diver.x, exitZone.y - diver.y);
        objCountTxt = `CP ${checkpointsHit.size}/${totalCheckpoints}`;
        objMainTxt = `↑ ${exitZone.name} (${Math.round(dist)}m)`;
        objHintTxt = 'Ascend smoothly to surface exit';
      }
    }
    if (this._objCountEl) {
      setText(this._objCountEl, objCountTxt);
      setHidden(this._objExtraEl, !extraStatTxt);
      if (extraStatTxt) setText(this._objExtraEl, extraStatTxt);
      setClass(this._objGasEl, objGasCls);
      setText(this._objGasEl, objGasTxt);
      setClass(this._objMainEl, objMainCls);
      setText(this._objMainEl, objMainTxt);
      setText(this._objHintEl, objHintTxt);
    } else if (this.elObjective) {
      const fallbackHtml = `<div class="obj-top-row"><span class="obj-count">${objCountTxt}</span>${extraStatTxt ? `<span class="obj-extra">${extraStatTxt}</span>` : ''}<span class="${objGasCls}">${objGasTxt}</span></div><div class="${objMainCls}">${objMainTxt}</div><span class="obj-hint">${objHintTxt}</span>`;
      if (fallbackHtml !== this._lastObjectiveHtml) {
        this._lastObjectiveHtml = fallbackHtml;
        this.elObjective.innerHTML = fallbackHtml;
      }
    }

    // Team Vitals & Live EKG Monitors (LAN Multiplayer, keyed DOM reuse so EKG traces sweep smoothly)
    const teamList = Array.isArray(peers) ? peers : (peerDiver ? [peerDiver] : []);
    if (teamList.length > 0) {
      setHidden(this.elBuddy, false);
      const seenIds = this._seenPeerIds;
      seenIds.clear();
      for (const p of teamList) {
        const pid = p.id || p.name || 'peer';
        seenIds.add(pid);
        let ui = this.mateCards.get(pid);
        if (!ui) {
          const card = document.createElement('div');
          card.className = 'mate-card';
          card.title = 'Tap to ping buddy locator [B]';
          card.setAttribute?.('role', 'button');
          card.addEventListener?.('click', () => {
            this.onBuddySelect?.(pid);
          });
          card.innerHTML = `
            <div class="mate-top">
              <span class="mate-name"></span>
              <span class="mate-cond"></span>
            </div>
            <div class="mate-meta">
              <span class="mate-pos"></span>
              <span class="mate-gas"></span>
            </div>
            <div class="mate-bars">
              <div class="mate-bar" title="Gas Remaining"><div class="mate-bar-fill mate-gas-fill"></div></div>
              <div class="mate-bar" title="Physiological Stress"><div class="mate-bar-fill mate-stress-fill"></div></div>
            </div>
            <div class="mate-ekg-row">
              <span class="mate-hr">♥ --</span>
              <canvas class="mate-ekg-canvas" width="110" height="18"></canvas>
            </div>
          `;
          this.elBuddy.appendChild(card);
          const canvasEl = card.querySelector('.mate-ekg-canvas');
          const ekg = createEkgState(110);
          if (canvasEl) {
            this._ekgStateByCanvas.set(canvasEl, ekg);
            this._ekgResizeObserver?.observe(canvasEl);
          }
          ui = {
            card,
            nameEl: card.querySelector('.mate-name'),
            condEl: card.querySelector('.mate-cond'),
            posEl: card.querySelector('.mate-pos'),
            gasEl: card.querySelector('.mate-gas'),
            gasFill: card.querySelector('.mate-gas-fill'),
            stressFill: card.querySelector('.mate-stress-fill'),
            hrEl: card.querySelector('.mate-hr'),
            canvasEl,
            ekg,
          };
          this.mateCards.set(pid, ui);
        }

        const dist = Math.hypot(p.x - diver.x, p.y - diver.y);
        const bar = Math.round(p.activeBar ?? 200);
        const mateMix = mixMap[p.gasId] || GAS_MIXES[p.gasId];
        const startBar = mateMix?.startBar || 200;
        const gasPct = Math.max(0, Math.min(100, Math.round((bar / startBar) * 100)));
        const stress = Math.round(
          Math.max(
            p.cnsPercent || 0,
            p.dcsStress || 0,
            p.hypoxiaStress || 0,
            p.cardiacStress || 0,
            (p.narcosisLevel || 0) * 80
          )
        );
        const mateBpm = p.alive === false ? 0 : Math.round(p.heartRateBpm ?? 68);
        const cond = p.alive === false ? 'DOWN' : (p.condition || 'NOMINAL');
        const isDecoHold = cond.startsWith('DECO ');
        const sevCls =
          p.alive === false ||
          cond === 'NO GAS' ||
          cond === 'HYPOXIA' ||
          cond === 'O2 TOX' ||
          cond === 'DCS' ||
          cond === 'SNAGGED!' ||
          stress >= 65 ||
          mateBpm >= 150
            ? 'danger'
            : (cond !== 'NOMINAL' && !isDecoHold) || bar < 50 || stress >= 25 || mateBpm >= 118
              ? 'warn'
              : '';
        const gasColor = bar < 45 ? '#ef4444' : (mateMix?.color || '#38bdf8');
        const stressColor = stress >= 65 ? '#ef4444' : stress >= 25 ? '#fbbf24' : '#4ade80';

        setClass(ui.card, sevCls ? `mate-card ${sevCls}` : 'mate-card');
        setText(ui.nameEl, p.name || 'Buddy');
        setClass(ui.condEl, sevCls ? `mate-cond ${sevCls}` : 'mate-cond');
        setText(ui.condEl, cond);
        setText(ui.posEl, `${(p.depthM ?? 0).toFixed(1)}m · ${Math.round(dist)}m away`);
        setText(ui.gasEl, `${mateMix?.name || p.gasId || 'EAN32'} ${bar}b`);
        setStyleProp(ui.gasFill, 'width', `${gasPct}%`);
        setStyleProp(ui.gasFill, 'background', gasColor);
        setStyleProp(ui.stressFill, 'width', `${stress}%`);
        setStyleProp(ui.stressFill, 'background', stressColor);

        const hrCls = p.alive === false || mateBpm >= 145 ? 'danger' : mateBpm >= 115 ? 'warn' : '';
        setClass(ui.hrEl, hrCls ? `mate-hr ${hrCls}` : 'mate-hr');
        setText(ui.hrEl, p.alive === false ? '♥ --' : `♥ ${mateBpm}`);
        stepAndDrawEkg(ui.canvasEl, ui.ekg, mateBpm, p.alive !== false, dt);
      }

      for (const [pid, ui] of this.mateCards.entries()) {
        if (!seenIds.has(pid)) {
          if (ui.canvasEl) {
            this._ekgResizeObserver?.unobserve(ui.canvasEl);
            ui.canvasEl.width = 0;
            ui.canvasEl.height = 0;
          }
          ui.card.remove();
          this.mateCards.delete(pid);
        }
      }
    } else {
      setHidden(this.elBuddy, true);
      if (this.mateCards.size > 0) {
        for (const ui of this.mateCards.values()) {
          if (ui.canvasEl) {
            this._ekgResizeObserver?.unobserve(ui.canvasEl);
            ui.canvasEl.width = 0;
            ui.canvasEl.height = 0;
          }
          ui.card.remove();
        }
        this.mateCards.clear();
      }
    }

    // High-Tech Tactical Sonar Overlay (v186 — Wetnotes removed)
    if (this.elMinimapWrap) {
      const allowed = isMinimapAllowed(cleanDiff, mutatorId);
      const showSonar = Boolean(allowed && minimapVisible && level);
      setHidden(this.elMinimapWrap, !showSonar);
      if (this.elMinimapSonarView) setHidden(this.elMinimapSonarView, !showSonar);
      if (showSonar) {
        setText(this.elMinimapPct, `${Math.round(exploredPct || 0)}%`);
        setText(this.elMinimapZoom, minimapZoomMode === 'full' ? 'FULL' : 'ZOOM');
      }
      if (showSonar && this.elMinimapCanvas) {
        this._minimapRedrawAccum += dt;
        const expSize = exploredCells ? exploredCells.size : 0;
        const needsRedraw =
          this._minimapRedrawAccum >= 0.045 ||
          expSize !== this._minimapLastExplored ||
          minimapZoomMode !== this._minimapLastZoom ||
          Boolean(sonarPulse) ||
          Boolean(buddyPing) ||
          Boolean(syncedSonarPings && syncedSonarPings.length > 0);
        if (needsRedraw) {
          this._minimapRedrawAccum = 0;
          this._minimapLastExplored = expSize;
          this._minimapLastZoom = minimapZoomMode;
          const mctx =
            this._minimapCtx ||
            (typeof this.elMinimapCanvas.getContext === 'function'
              ? (this._minimapCtx = this.elMinimapCanvas.getContext('2d'))
              : null);
          if (mctx) {
            drawSonarMinimap(mctx, this.elMinimapCanvas.width, this.elMinimapCanvas.height, {
              level,
              diver,
              peers: teamList,
              exploreCells,
              exploredCells,
              exploredGrid,
              checkpointsHit,
              nextCheckpoint,
              collectedIds,
              openedHatchIds,
              claimedStageIds,
              placedMarkerIds,
              bodyRecovered,
              playerLines,
              sonarPulse,
              encounters,
              buddyPing,
              droppedStages,
              secretLair,
              syncedSonarPings,
              difficulty: cleanDiff,
              zoomMode: minimapZoomMode,
              timeSec,
            });
          }
        }
      }
    }
  }
}

/**
 * Sample / interpolate a dive profile array at any target timeSec for interactive Debrief scrubbing (v126).
 */
export function sampleDiveProfileAtTime(profile, timeSec) {
  if (!Array.isArray(profile) || profile.length === 0) return null;
  if (profile.length === 1) return { ...profile[0] };
  const t = Math.max(profile[0].t || 0, Math.min(profile[profile.length - 1].t || 0, Number(timeSec) || 0));
  let lo = 0;
  let hi = profile.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if ((profile[mid].t || 0) <= t) lo = mid;
    else hi = mid;
  }
  const a = profile[lo];
  const b = profile[hi];
  const span = Math.max(0.001, (b.t || 0) - (a.t || 0));
  const f = Math.max(0, Math.min(1, (t - (a.t || 0)) / span));
  const lerp = (va, vb, fallback = 0) => {
    const na = Number.isFinite(va) ? va : fallback;
    const nb = Number.isFinite(vb) ? vb : na;
    return na + (nb - na) * f;
  };
  return {
    t: Math.round(t * 10) / 10,
    d: Math.round(lerp(a.d, b.d, 0) * 10) / 10,
    gas: f < 0.5 ? a.gas : b.gas,
    deco: Math.round(lerp(a.deco, b.deco, 0)),
    ppo2: Math.round(lerp(a.ppo2, b.ppo2, 0.32) * 100) / 100,
    cns: Math.round(lerp(a.cns, b.cns, 0)),
    hr: Math.round(lerp(a.hr, b.hr, 68)),
    bar: Math.round(lerp(a.bar, b.bar, 150)),
    gf99: Math.round(lerp(a.gf99, b.gf99, 0)),
  };
}

/**
 * Render Shearwater-Perdix-style Technical Dive Computer OLED overlay with live
 * Bühlmann ZH-L16C tissue loading bars (N2 + He), GF99%, CNS%, NDL/TTS, PPO2 & END (v126).
 */
export function drawShearwaterComputer(ctx, width, height, diveState, thermal = null) {
  if (!ctx || width <= 0 || height <= 0 || !diveState) return;
  const status = computeTissueCompartmentStatus(diveState);
  const gas = diveState.mixes?.[diveState.activeGasId] || GAS_MIXES[diveState.activeGasId] || GAS_MIXES.EAN32;
  const tankBar = Math.round(diveState.tanks?.[diveState.activeGasId]?.bar || 0);

  ctx.save();
  // Dark OLED bezel backdrop
  ctx.fillStyle = '#040914';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.38)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Header strip (with live ambient water temp °C & thermocline cold-shock badge)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(2, 2, width - 4, 18);
  ctx.font = '700 9px ui-monospace, SFMono-Regular, monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'left';
  ctx.fillText('SHEARWATER · ZH-L16C', 8, 14);
  ctx.textAlign = 'right';
  const hasTemp = thermal && Number.isFinite(thermal.waterTempC);
  const coldShock = Boolean(thermal?.inThermocline);
  const tempTag = hasTemp ? `${coldShock ? '❄️' : ''}${thermal.waterTempC.toFixed(1)}°C · ` : '';
  ctx.fillStyle = coldShock ? '#7dd3fc' : diveState.ccrEnabled ? '#4ade80' : '#94a3b8';
  ctx.fillText(`${tempTag}${diveState.ccrEnabled ? 'CCR 1.3' : 'OC TEC'}`, width - 8, 14);

  // Top primary readout row: DEPTH | TIME | NDL / TTS
  const topY = 24;
  ctx.textAlign = 'left';
  ctx.font = '600 8px ui-monospace, monospace';
  ctx.fillStyle = '#64748b';
  ctx.fillText('DEPTH', 8, topY + 7);
  ctx.fillText('TIME', 88, topY + 7);
  ctx.fillText(status.stopDepthM > 0 ? 'TTS / STOP' : 'NDL', 152, topY + 7);

  ctx.font = '800 18px ui-monospace, monospace';
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText(`${(diveState.depthM || 0).toFixed(1)}m`, 8, topY + 25);

  ctx.font = '700 14px ui-monospace, monospace';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(formatClock(diveState.diveTimeSec || 0), 88, topY + 24);

  if (status.stopDepthM > 0) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = '800 13px ui-monospace, monospace';
    ctx.fillText(`${Math.ceil(status.ttsSec / 60)}m · ${status.stopDepthM}m`, 152, topY + 24);
  } else {
    ctx.fillStyle = status.ndlMin <= 5 ? '#f59e0b' : '#4ade80';
    ctx.font = '800 15px ui-monospace, monospace';
    ctx.fillText(`${status.ndlMin} min`, 152, topY + 24);
  }

  // Tissue Saturation Bar Graph (T1..T4 N2 cyan + He violet vs 100% M-value ceiling)
  const chartX = 8;
  const chartY = 58;
  const chartW = width - 16;
  const chartH = 60;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.fillRect(chartX, chartY, chartW, chartH);

  // 100% M-Value threshold line (at 76% of chart height so supersaturation >1.0 can rise visibly above it)
  const mLineY = chartY + chartH - chartH * 0.72;
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(chartX, mLineY);
  ctx.lineTo(chartX + chartW, mLineY);
  ctx.stroke();
  ctx.restore();

  ctx.font = '600 8px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
  ctx.textAlign = 'right';
  ctx.fillText('M-VAL 100%', chartX + chartW - 3, mLineY - 2);
  ctx.textAlign = 'left';
  ctx.fillText(`TISSUES (LEAD ${status.leadingLabel})`, chartX + 4, chartY + 9);

  const barCount = status.bars.length;
  const gap = 8;
  const barW = Math.max(18, Math.floor((chartW - gap * (barCount + 1)) / Math.max(1, barCount)));
  const maxBarH = chartH - 22;
  const barBaseY = chartY + chartH - 11;

  for (let i = 0; i < barCount; i++) {
    const b = status.bars[i];
    const bx = chartX + gap + i * (barW + gap);
    const norm = Math.max(0.06, Math.min(1.25, b.loadFrac));
    const totalH = Math.min(maxBarH, Math.round((norm / 1.25) * maxBarH));
    const heH = Math.round(totalH * b.heShare);
    const n2H = Math.max(1, totalH - heH);

    // Track background
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.fillRect(bx, barBaseY - maxBarH, barW, maxBarH);

    // N2 lower segment (cyan / amber if deco)
    ctx.fillStyle = b.inDeco ? '#f59e0b' : '#38bdf8';
    ctx.fillRect(bx, barBaseY - n2H, barW, n2H);

    // He upper segment (violet)
    if (heH > 0) {
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(bx, barBaseY - n2H - heH, barW, heH);
    }

    // Highlight leading tissue outline
    if (i === status.leadingIndex) {
      ctx.strokeStyle = b.inDeco ? '#fde047' : '#e0f2fe';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(bx - 0.5, barBaseY - maxBarH - 0.5, barW + 1, maxBarH + 1);
    }

    // Compartment label
    ctx.font = '700 8px ui-monospace, monospace';
    ctx.fillStyle = i === status.leadingIndex ? '#f8fafc' : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(b.id, bx + barW * 0.5, chartY + chartH - 2);
  }

  // Bottom telemetry strip: GAS | PPO2 | CNS% | GF99% | END
  const botY = height - 30;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
  ctx.fillRect(4, botY, width - 8, 26);

  const cells = [
    { lbl: gas.shortLabel || gas.id, val: `${tankBar}b`, col: gas.color || '#38bdf8' },
    { lbl: 'PPO2', val: status.ppo2.toFixed(2), col: status.ppo2 > 1.55 || status.ppo2 < 0.18 ? '#f87171' : status.ppo2 > 1.38 ? '#fbbf24' : '#4ade80' },
    { lbl: 'CNS', val: `${status.cnsPct}%`, col: status.cnsPct >= 80 ? '#f87171' : status.cnsPct >= 50 ? '#fbbf24' : '#cbd5e1' },
    { lbl: 'GF99', val: `${status.gf99Pct}%`, col: status.gf99Pct >= 95 ? '#f87171' : status.gf99Pct >= 75 ? '#fbbf24' : '#67e8f9' },
    { lbl: 'END', val: `${status.endM}m`, col: status.endM >= 35 ? '#fbbf24' : '#cbd5e1' },
  ];
  const cellW = (width - 12) / cells.length;
  for (let i = 0; i < cells.length; i++) {
    const cx = 6 + cellW * (i + 0.5);
    ctx.textAlign = 'center';
    ctx.font = '600 7.5px ui-monospace, monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText(cells[i].lbl, cx, botY + 9);
    ctx.font = '800 10px ui-monospace, monospace';
    ctx.fillStyle = cells[i].col;
    ctx.fillText(cells[i].val, cx, botY + 21);
  }

  ctx.restore();
}
