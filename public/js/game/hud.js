import { GAS_MIXES, GAS_ORDER, computePPO2, getRecommendedGas, getAscentInstruction, getGasSwitchCoach } from '../physics/diveModel.js';
import { getAscentConfig } from '../levels/index.js';
import { EXPLORE_GRID_CELL_M } from './scoring.js';

const GAS_HOTKEY_LABELS = { EAN32: '1', TMX1455: '2', O2: '3' };

function formatClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

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

export function computeMinimapViewport(level, diver, { zoomMode = 'follow', width = 352, height = 224 } = {}) {
  const b = level?.bounds || { xMin: -20, xMax: 160, yMin: -4, yMax: 70 };
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
    buddyPing = null,
    difficulty = 'standard',
    zoomMode = 'follow',
    timeSec = 0,
  } = state;

  const vp = computeMinimapViewport(level, diver, { zoomMode, width, height });
  const { scale, toX, toY, viewMinX, viewMaxX, viewMinY, viewMaxY } = vp;
  const isGuided = difficulty === 'guided';
  const isWreck = Boolean(level.isWreck);

  ctx.save();
  // 1. Deep Sonar Scope Backdrop & Subtle Bathymetric Depth Grid
  ctx.fillStyle = '#030d19';
  ctx.fillRect(0, 0, width, height);

  const depthStep = zoomMode === 'full' ? (viewMaxY - viewMinY > 110 ? 40 : 20) : 10;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.10)';
  ctx.fillStyle = 'rgba(125, 211, 252, 0.42)';
  ctx.font = 'bold 14px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textBaseline = 'bottom';
  const firstDepth = Math.max(depthStep, Math.ceil(Math.max(0, viewMinY) / depthStep) * depthStep);
  for (let d = firstDepth; d <= viewMaxY; d += depthStep) {
    const sy = toY(d);
    if (sy < 12 || sy > height - 6) continue;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
    ctx.stroke();
    ctx.fillText(`${d}m`, 6, sy - 2);
  }

  // Water surface horizon line (y = 0)
  const surfY = toY(0);
  if (surfY >= -4 && surfY <= height + 4) {
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, surfY);
    ctx.lineTo(width, surfY);
    ctx.stroke();
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
    // Soft sonar halo + crisp carved passage core
    ctx.fillStyle = isWreck ? 'rgba(251, 146, 60, 0.24)' : 'rgba(14, 165, 233, 0.24)';
    const outerR = cellR * 1.24;
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

    ctx.fillStyle = isWreck ? 'rgba(253, 186, 116, 0.34)' : 'rgba(125, 211, 252, 0.36)';
    ctx.beginPath();
    for (const idx of exploredCells) {
      const c = exploreCells[idx];
      if (!c) continue;
      if (c.x < viewMinX - padWorld || c.x > viewMaxX + padWorld || c.y < viewMinY - padWorld || c.y > viewMaxY + padWorld) continue;
      const sx = toX(c.x);
      const sy = toY(c.y);
      ctx.moveTo(sx + cellR * 0.82, sy);
      ctx.arc(sx, sy, cellR * 0.82, 0, Math.PI * 2);
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
  if (Array.isArray(level.collectibles)) {
    for (let i = 0; i < level.collectibles.length; i++) {
      const item = level.collectibles[i];
      if (!item || collectedIds?.has(item.id)) continue;
      if (!_isPointRevealed(item.x, item.y, diver, exploreCells, exploredCells, exploredGrid, sonarPulse, 6.0)) continue;
      const sx = toX(item.x);
      const sy = toY(item.y);
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4.2);
      ctx.lineTo(sx + 3.6, sy);
      ctx.lineTo(sx, sy + 4.2);
      ctx.lineTo(sx - 3.6, sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 7. Checkpoints, Surface Exit & Recovery Target
  const allowCompassHints = isGuided || !level.hideWaypointCompass;
  const pulse = 0.5 + 0.5 * Math.sin(timeSec * 5.2);
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
        ctx.strokeStyle = `rgba(56, 189, 248, ${(0.45 + 0.45 * pulse).toFixed(2)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 5.5 + pulse * 3.5, 0, Math.PI * 2);
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

  // 8. Active Cave Sonar Hydrophone Pulse Ring
  if (sonarPulse && sonarPulse.durationSec > 0) {
    const frac = Math.max(0, Math.min(1, sonarPulse.ageSec / sonarPulse.durationSec));
    const rPx = frac * (sonarPulse.maxRadiusM || 28) * scale;
    const px = toX(sonarPulse.x);
    const py = toY(sonarPulse.y);
    ctx.strokeStyle = `rgba(34, 211, 238, ${((1 - frac) * 0.9).toFixed(2)})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(px, py, rPx, 0, Math.PI * 2);
    ctx.stroke();
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

  // Subtle radar scanline sheen
  const sweepY = ((timeSec * 28) % (height + 40)) - 20;
  ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
  ctx.fillRect(0, sweepY, width, 10);

  ctx.restore();
}

export class DiveComputerHUD {
  constructor({ onGasSelect, onReelToggle, onReelRewind, onReelRewindHold = null, onHeartbeatPulse, onBuddySelect = null }) {
    this.onHeartbeatPulse = onHeartbeatPulse;
    this.onBuddySelect = onBuddySelect;
    this._onReelRewindHold = onReelRewindHold;
    this._isTouchDevice =
      typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    this.elDepth = document.getElementById('dc-depth');
    this.elMaxDepth = document.getElementById('dc-max-depth');
    this.elTime = document.getElementById('dc-time');
    this.elDecoLabel = document.getElementById('dc-deco-label');
    this.elDecoVal = document.getElementById('dc-deco-val');
    this.elPPO2 = document.getElementById('dc-ppo2');
    this.elCNS = document.getElementById('dc-cns');
    this.elEND = document.getElementById('dc-end');
    this.elAscentFill = document.getElementById('dc-ascent-fill');
    this.elAscentVal = document.getElementById('dc-ascent-val');
    this.elAlerts = document.getElementById('dc-alerts');
    this.elObjective = document.getElementById('dc-objective');
    this.elBuddy = document.getElementById('dc-buddy');
    this.elSelfHealth = document.getElementById('hud-self-health');
    this.elSelfName = document.getElementById('dc-self-name');
    this.elModeBadge = document.getElementById('dc-mode-badge');
    this.elDailyBadge = document.getElementById('dc-daily-badge');
    this.elMinimapWrap = document.getElementById('hud-minimap-wrap');
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
      });
      btn.addEventListener('click', (e) => {
        if (e.detail === 0) onGasSelect(id);
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
    buddyPing = null,
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
    setText(this.elTime, formatClock(diveState.diveTimeSec));

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

    // PPO2 color grading
    setText(this.elPPO2, diveState.ppo2.toFixed(2));
    if (diveState.ppo2 < 0.16 && diveState.depthM > 0.2) {
      setClass(this.elPPO2, 'dc-val cyan blink');
    } else if (diveState.ppo2 > 1.6) {
      setClass(this.elPPO2, 'dc-val danger blink');
    } else if (diveState.ppo2 > 1.4) {
      setClass(this.elPPO2, 'dc-val warn');
    } else {
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
          const prefix = this._isTouchDevice ? '' : '[G] ';
          setText(
            this.btnReelToggle,
            reelingActive
              ? `${prefix}TIE OFF`
              : remM < 1
                ? 'SPOOL EMPTY'
                : `${prefix}DEPLOY LINE`
          );
        }
        if (this.btnReelRewind) {
          setText(this.btnReelRewind, this._isTouchDevice ? 'REWIND ↩' : '[R] REWIND ↩');
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

    // Alerts Strip (uses active level mixMap so gasOverrides on L12–L20 display accurately)
    if (endedState === 'surfaced') {
      setText(this.elAlerts, '✓ SURFACED SAFE · TEAM HOLD');
      setClass(this.elAlerts, 'dc-alerts ok');
    } else if (endedState === 'down') {
      setText(this.elAlerts, '✕ DIVER DOWN · AWAITING RESCUE');
      setClass(this.elAlerts, 'dc-alerts danger');
    } else if (gasCoach && gasCoach.severity === 'danger') {
      setText(this.elAlerts, gasCoach.title);
      setClass(this.elAlerts, 'dc-alerts danger');
    } else if (diveState.warnings.length > 0) {
      setText(this.elAlerts, diveState.warnings[0]);
      setClass(this.elAlerts, `dc-alerts ${diveState.criticalAlarm ? 'danger' : 'warn'}`);
    } else if (myBpm >= 138) {
      setText(this.elAlerts, `♥ ${myBpm} BPM — RELEASE CONTROLS TO CALM`);
      setClass(this.elAlerts, 'dc-alerts warn');
    } else if (gasCoach) {
      setText(this.elAlerts, gasCoach.title);
      setClass(this.elAlerts, 'dc-alerts warn');
    } else if (ascentStep) {
      setText(this.elAlerts, ascentStep.title);
      setClass(this.elAlerts, `dc-alerts ${ascentStep.action === 'STOP' ? 'warn' : 'ok'}`);
    } else if (recGasId !== diveState.activeGasId) {
      setText(this.elAlerts, `SWITCH → ${(mixMap[recGasId] || GAS_MIXES[recGasId]).name}`);
      setClass(this.elAlerts, 'dc-alerts warn');
    } else {
      setText(this.elAlerts, `${(mixMap[diveState.activeGasId] || GAS_MIXES[diveState.activeGasId]).name} · NOMINAL`);
      setClass(this.elAlerts, 'dc-alerts ok');
    }

    // Concise Objective Tracker
    const recName = (mixMap[recGasId] || GAS_MIXES[recGasId]).name;
    const gasBadge = recGasId === diveState.activeGasId
      ? `<span class="obj-gas ok">✓ ${recName}</span>`
      : `<span class="obj-gas switch">→ ${recName}</span>`;

    const extraStat =
      collectiblesTotal > 0
        ? `<span class="obj-extra">💎${collectedCount}/${collectiblesTotal} · 🧭${exploredPct}%</span>`
        : '';

    const isProbe = level?.recoveryTarget?.kind === 'probe';
    const recoveryTag = level?.recoveryTarget
      ? carryingBody
        ? isProbe ? ' · 🛰 CORE' : ' · 🛟 TOW'
        : bodyRecovered
          ? ' · ✓ REC'
          : isProbe ? ' · 🛰 PROBE' : ' · 🛟 BODY'
      : '';
    let objectiveHtml = '';
    if (endedState === 'surfaced') {
      objectiveHtml = `
        <div class="obj-top-row">
          <span class="obj-count">TEAM HOLD · CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}${recoveryTag}</span>
          <span class="obj-gas ok">✓ SAFE</span>
        </div>
        <div class="obj-action move">✓ SURFACED SAFE · WAITING FOR CREW</div>
        <span class="obj-hint">${spectatingPeer ? 'Spectating crew below · Tap Finish Now to debrief' : 'Tap Watch Buddy below to spectate or Finish Now to debrief'}</span>
      `;
    } else if (endedState === 'down') {
      objectiveHtml = `
        <div class="obj-top-row">
          <span class="obj-count">DIVER DOWN · CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}${recoveryTag}</span>
          <span class="obj-gas switch">RESCUE</span>
        </div>
        <div class="obj-action danger">✕ DIVER DOWN · SPECTATING CREW</div>
        <span class="obj-hint">A buddy can tow you to surface, or tap Finish Now below</span>
      `;
    } else if (gasCoach && (gasCoach.severity === 'danger' || !ascentStep)) {
      const cls = gasCoach.severity === 'danger' ? 'danger' : 'stop';
      const icon = gasCoach.severity === 'danger' ? '⛔' : '■';
      objectiveHtml = `
        <div class="obj-top-row">
          <span class="obj-count">GAS SWITCH · CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}${recoveryTag}</span>
          ${gasBadge}
        </div>
        <div class="obj-action ${cls}">${icon} ${gasCoach.title}</div>
        <span class="obj-hint">${gasCoach.detail}</span>
      `;
    } else if (ascentStep && (!level?.recoveryTarget || bodyRecovered)) {
      const cls = ascentStep.action === 'STOP' ? 'stop' : 'move';
      const icon = ascentStep.action === 'STOP' ? '■' : '▲';
      objectiveHtml = `
        <div class="obj-top-row">
          <span class="obj-count">ASCENT · CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}${recoveryTag}</span>
          ${gasBadge}
        </div>
        <div class="obj-action ${cls}">${icon} ${ascentStep.title}</div>
        <span class="obj-hint">${ascentStep.detail}</span>
      `;
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
        objectiveHtml = `
          <div class="obj-top-row">
            <span class="obj-count">${mutatorId === 'purist' ? 'PURIST' : cleanDiff === 'hardcore' ? 'HARDCORE' : 'MAZE'} · CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}${recoveryTag}</span>
            ${gasBadge}
          </div>
          <span class="obj-name">${level.recoveryTarget && !bodyRecovered ? `Recover ${level.recoveryTarget.name} (${Math.round(level.recoveryTarget.y)}m)` : `Tag cave hubs (${checkpointsHit.size}/${totalCheckpoints})`}</span>
          <span class="obj-hint">${navHint}</span>
        `;
      } else {
        const dist = Math.hypot(nextCheckpoint.x - diver.x, nextCheckpoint.y - diver.y);
        const dir = nextCheckpoint.x > diver.x + 1.5 ? '→' : nextCheckpoint.x < diver.x - 1.5 ? '←' : '';
        const vDir = nextCheckpoint.y > diver.y + 1.5 ? '↓' : nextCheckpoint.y < diver.y - 1.5 ? '↑' : '';
        objectiveHtml = `
          <div class="obj-top-row">
            <span class="obj-count">CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}</span>
            ${gasBadge}
          </div>
          <span class="obj-name">${dir}${vDir} ${nextCheckpoint.name} (${Math.round(dist)}m)</span>
          <span class="obj-hint">${nextCheckpoint.hint}</span>
        `;
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
        objectiveHtml = `
          <div class="obj-top-row">
            <span class="obj-count">CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}${recoveryTag}</span>
            ${gasBadge}
          </div>
          <span class="obj-name">${needsRecovery ? `Recover ${level.recoveryTarget.name} (${Math.round(level.recoveryTarget.y)}m)` : `↑ Locate ${exitZone?.name || 'Resurgence Exit'}`}</span>
          <span class="obj-hint">${needsRecovery ? `Recovery required before surfacing at ${exitZone?.name || 'exit'}` : `Follow your deployed line or ascend to ${exitZone?.name || 'surface exit'}`}</span>
        `;
      } else {
        const dist = Math.hypot(exitZone.x - diver.x, exitZone.y - diver.y);
        objectiveHtml = `
          <div class="obj-top-row">
            <span class="obj-count">CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}</span>
            ${gasBadge}
          </div>
          <span class="obj-name">↑ ${exitZone.name} (${Math.round(dist)}m)</span>
          <span class="obj-hint">Ascend smoothly to surface exit</span>
        `;
      }
    }
    if (objectiveHtml !== this._lastObjectiveHtml) {
      this._lastObjectiveHtml = objectiveHtml;
      this.elObjective.innerHTML = objectiveHtml;
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

    // Live Sonar Cave & Wreck Cartography Minimap (throttled ~18 Hz for ultra-light GPU cost)
    if (this.elMinimapWrap) {
      const allowed = isMinimapAllowed(cleanDiff, mutatorId);
      const showMap = Boolean(allowed && minimapVisible && level);
      setHidden(this.elMinimapWrap, !showMap);
      if (showMap && this.elMinimapCanvas) {
        setText(this.elMinimapPct, `${Math.round(exploredPct || 0)}%`);
        setText(this.elMinimapZoom, minimapZoomMode === 'full' ? 'FULL' : 'ZOOM');
        this._minimapRedrawAccum += dt;
        const expSize = exploredCells ? exploredCells.size : 0;
        const needsRedraw =
          this._minimapRedrawAccum >= 0.055 ||
          expSize !== this._minimapLastExplored ||
          minimapZoomMode !== this._minimapLastZoom ||
          Boolean(sonarPulse) ||
          Boolean(buddyPing);
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
