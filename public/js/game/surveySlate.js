/**
 * Diegetic Underwater Wetnotes Survey Slate Renderer (v169).
 * Progressively sketches explored cave/wreck passages in true fog-of-war:
 * never reveals unexplored branches, while cleanly plotting explored corridors,
 * guidelines, deployed reel segments, discovered air pockets, stage caches,
 * line cookies, torch-spotted relics, and live diver heading.
 */

import { exploreGridKey } from './scoring.js';
import { clamp } from '../util/common.js';

/**
 * Render the waterproof Yellow-and-Graphite Wetnotes Survey Slate onto a 2D canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {object} session - Live dive session state
 * @param {number} [timeSec=0]
 * @param {object} [opts]
 * @param {boolean} [opts.followZoom=false]
 * @returns {boolean}
 */
export function renderSurveySlate(ctx, width, height, session, timeSec = 0, { followZoom = false } = {}) {
  if (!ctx || !session?.level) return false;
  const level = session.level;
  const diver = session.diver;
  const cells = session.exploreCells || [];
  const exploredSet = session.exploredCells;
  const exploredGrid = session.exploredGrid;
  const isWreck = level.theme?.environmentType === 'shipwreck';

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // 1. Waterproof yellow-parchment / slate-grid wetnotes card background
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#0c1828');
  bg.addColorStop(1, '#08111e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle wetnotes survey grid lines (10m drafting rules)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.11)';
  ctx.lineWidth = 1;
  const gridStep = 18;
  for (let gx = gridStep; gx < width; gx += gridStep) {
    ctx.beginPath();
    ctx.moveTo(gx, 24);
    ctx.lineTo(gx, height - 18);
    ctx.stroke();
  }
  for (let gy = 24 + gridStep; gy < height - 18; gy += gridStep) {
    ctx.beginPath();
    ctx.moveTo(8, gy);
    ctx.lineTo(width - 8, gy);
    ctx.stroke();
  }

  // Header bar (wetnotes notebook binding + live % surveyed)
  ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
  ctx.fillRect(0, 0, width, 22);
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
  ctx.beginPath();
  ctx.moveTo(0, 22);
  ctx.lineTo(width, 22);
  ctx.stroke();

  // Spiral notebook punch holes along top margin
  ctx.fillStyle = '#040914';
  for (let rx = 14; rx < width - 80; rx += 16) {
    ctx.beginPath();
    ctx.arc(rx, 4, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = '800 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#fde047';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(isWreck ? '📋 WRECK SURVEY' : '📋 WETNOTES MAP', 8, 13);

  const pct = Math.max(0, Math.min(100, Math.round(session.exploredPct || 0)));
  ctx.textAlign = 'right';
  ctx.fillStyle = pct >= 92 ? '#4ade80' : '#7dd3fc';
  ctx.fillText(`${pct}% MAPPED`, width - 8, 13);

  // Compute bounding box from explored cells + diver + spawn (never leaks unexplored extremities!)
  let minX = (diver?.x ?? level.spawn?.x ?? 0) - (followZoom ? 22 : 18);
  let maxX = (diver?.x ?? level.spawn?.x ?? 0) + (followZoom ? 22 : 18);
  let minY = Math.min(followZoom ? (diver?.y ?? 2) - 14 : 0, (diver?.y ?? 2) - 10);
  let maxY = Math.max(followZoom ? (diver?.y ?? 2) + 14 : 20, (diver?.y ?? 2) + 14);

  if (!followZoom && exploredSet && exploredSet.size > 0 && cells.length > 0) {
    for (const idx of exploredSet) {
      const c = cells[idx];
      if (!c) continue;
      if (c.x - 6 < minX) minX = c.x - 6;
      if (c.x + 6 > maxX) maxX = c.x + 6;
      if (c.y - 5 < minY) minY = c.y - 5;
      if (c.y + 6 > maxY) maxY = c.y + 6;
    }
  }

  const padL = 12;
  const padR = 12;
  const padT = 28;
  const padB = 22;
  const plotW = Math.max(20, width - padL - padR);
  const plotH = Math.max(20, height - padT - padB);
  const worldW = Math.max(24, maxX - minX);
  const worldH = Math.max(18, maxY - minY);
  const scale = Math.min(plotW / worldW, plotH / worldH);
  const offX = padL + (plotW - worldW * scale) * 0.5;
  const offY = padT + (plotH - worldH * scale) * 0.5;

  const toX = (wx) => offX + (wx - minX) * scale;
  const toY = (wy) => offY + (wy - minY) * scale;
  const isPointExplored = (wx, wy) => {
    if (diver && Math.hypot(wx - diver.x, wy - diver.y) <= 7.5) return true;
    if (exploredGrid && exploredGrid.has(exploreGridKey(wx, wy))) return true;
    return false;
  };

  // Waterline rule at 0m
  const surfY = toY(0);
  if (surfY >= padT && surfY <= height - padB) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, surfY);
    ctx.lineTo(width - padR, surfY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 2. Sketched explored passage cells (outer dark outline -> inner luminous wetnotes fill)
  const cellR = Math.max(3.2, 2.35 * scale);
  if (exploredSet && exploredSet.size > 0 && cells.length > 0) {
    // Dark ink passage wall border
    ctx.fillStyle = isWreck ? 'rgba(180, 118, 72, 0.42)' : 'rgba(148, 163, 184, 0.34)';
    ctx.beginPath();
    for (const idx of exploredSet) {
      const c = cells[idx];
      if (!c) continue;
      const sx = toX(c.x);
      const sy = toY(c.y);
      ctx.moveTo(sx + cellR + 1.4, sy);
      ctx.arc(sx, sy, cellR + 1.4, 0, Math.PI * 2);
    }
    ctx.fill();

    // Open-water explored passage ink
    ctx.fillStyle = isWreck ? '#16273d' : '#132a46';
    ctx.beginPath();
    for (const idx of exploredSet) {
      const c = cells[idx];
      if (!c) continue;
      const sx = toX(c.x);
      const sy = toY(c.y);
      ctx.moveTo(sx + cellR, sy);
      ctx.arc(sx, sy, cellR, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // 3. Explored guideline segments (gold survey line) & deployed player reel (cyan)
  const gl = level.guideline || [];
  if (gl.length >= 2) {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.78)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i < gl.length; i++) {
      const pt = gl[i];
      if (isPointExplored(pt.x, pt.y)) {
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
  }

  const reelChains = session.guidelineChains || session.reel?.chains || [];
  if (reelChains.length > 0) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.88)';
    ctx.lineWidth = 1.4;
    for (const chain of reelChains) {
      if (!Array.isArray(chain) || chain.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(toX(chain[0].x), toY(chain[0].y));
      for (let i = 1; i < chain.length; i++) ctx.lineTo(toX(chain[i].x), toY(chain[i].y));
      ctx.stroke();
    }
  }

  // 4. Discovered Air Pockets (cyan dome arcs)
  const setPieces = session.stories?.setPieces || [];
  for (const sp of setPieces) {
    if (sp.kind !== 'air-dome') continue;
    if (!sp.discovered && !isPointExplored(sp.x, sp.y)) continue;
    const sx = toX(sp.x);
    const sy = toY(sp.y);
    ctx.strokeStyle = '#7dd3fc';
    ctx.fillStyle = 'rgba(125, 211, 252, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, 4.2, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // 5. Dropped Stage Tanks & Placed Line Cookies
  const stages = session.droppedStages || [];
  for (const st of stages) {
    const sx = toX(st.x);
    const sy = toY(st.y);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(sx - 2.5, sy - 3.5, 5, 7);
  }
  const cookies = session.lineCookies || [];
  for (const ck of cookies) {
    const sx = toX(ck.x);
    const sy = toY(ck.y);
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(sx, sy, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. Torch-spotted uncollected relics (sparkling gold diamond)
  const spotted = session.spottedArtifacts;
  const collected = session.collectedIds;
  if (spotted && spotted.size > 0) {
    const pulse = 0.72 + 0.28 * Math.sin(timeSec * 5);
    ctx.fillStyle = `rgba(250, 204, 21, ${pulse.toFixed(2)})`;
    for (const item of level.collectibles || []) {
      if (collected?.has(item.id) || !spotted.has(item.id)) continue;
      const sx = toX(item.x);
      const sy = toY(item.y);
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4);
      ctx.lineTo(sx + 3.5, sy);
      ctx.lineTo(sx, sy + 4);
      ctx.lineTo(sx - 3.5, sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 6b. Player-placed custom Wetnotes Survey Pins (v170)
  const pins = session.surveyPins || [];
  if (pins.length > 0) {
    ctx.font = '800 8px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let pi = 0; pi < pins.length; pi++) {
      const pin = pins[pi];
      const px = toX(pin.x);
      const py = toY(pin.y);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py - 9);
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(px, py - 9);
      ctx.lineTo(px + 6, py - 6.5);
      ctx.lineTo(px, py - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.fillText(`#${pi + 1} ${pin.tag || 'PIN'} ${Math.round(pin.depthM || pin.y)}m`, px + 8, py - 6.5);
    }
  }

  // 7. Spawn / Exit beacon (if explored)
  if (level.exitZone && isPointExplored(level.exitZone.x, level.exitZone.y)) {
    const ex = toX(level.exitZone.x);
    const ey = toY(level.exitZone.y);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 8. Live diver heading chevron + torch cone
  if (diver) {
    const dx = toX(diver.x);
    const dy = toY(diver.y);
    const ang = diver.angle || 0;
    const tang = Number.isFinite(diver.torchAngle) ? diver.torchAngle : ang;

    // Soft mini torch cone
    if (diver.torchOn !== false) {
      ctx.fillStyle = 'rgba(254, 240, 138, 0.22)';
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.arc(dx, dy, 16, tang - 0.34, tang + 0.34);
      ctx.closePath();
      ctx.fill();
    }

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(5.8, 0);
    ctx.lineTo(-4.2, -3.6);
    ctx.lineTo(-2.1, 0);
    ctx.lineTo(-4.2, 3.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Footer legend
  ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
  ctx.fillRect(0, height - 18, width, 18);
  ctx.font = '700 8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const depthTxt = diver ? `${Math.max(0, diver.y).toFixed(1)}m` : '0.0m';
  ctx.fillText(`◆RELIC  ☁AIR  ●COOKIE  [${depthTxt}]`, 8, height - 9);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.fillText('[N] HIDE', width - 8, height - 9);

  ctx.restore();
  return true;
}
