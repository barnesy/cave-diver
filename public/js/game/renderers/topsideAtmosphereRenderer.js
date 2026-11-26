import { evaluateCaveSDF } from '../collision.js';

const _topsideLevelMetaCache = new WeakMap();

function getTopsideLevelMeta(level) {
  let meta = _topsideLevelMetaCache.get(level);
  if (meta) return meta;
  const style = level?.theme?.surfaceStyle || '';
  const name = level?.name || '';
  const isWreck = Boolean(level?.isWreck || style === 'open-ocean-wreck');
  const isPolar =
    !isWreck &&
    (/nordic|fjord|glacier|iceberg|aurora|strytan|kverk|grjota/i.test(style) ||
      /arctic|ice|glacier|orda|strytan|greenland/i.test(name));

  // Precompute valid open-water ice floe coordinates once per polar level (avoids per-frame SDF calls)
  const iceFloes = [];
  if (isPolar && Array.isArray(level?.openBasins)) {
    for (const basin of level.openBasins) {
      for (let f = 0; f < 3; f++) {
        const fx = basin.xMin + 1.8 + ((basin.xMax - basin.xMin - 3.6) * (f + 0.35)) / 3;
        if (evaluateCaveSDF(level, fx, 0.2) <= -0.3) {
          iceFloes.push({ fx, f, phase: f * 2.1, widthM: 1.05 + (f % 2) * 0.55 });
        }
      }
    }
  }

  meta = { style, isWreck, isPolar, iceFloes };
  _topsideLevelMetaCache.set(level, meta);
  return meta;
}

/**
 * Draws living topside surface atmosphere extras:
 * 1. Shipwrecks: Weighted descent shot-line with 6m/12m knots + diver-down buoy flag
 * 2. Polar / Glacial sites: Shimmering aurora curtains + bobbing sea-ice floes with cyan keels
 * 3. Cenotes & Karst Caves: Hanging banyan roots & swaying jungle lianas anchored to cliff lips
 */
export function drawTopsideAtmosphereExtras(renderer, ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec) {
  const level = renderer.level;
  if (!level) return;
  const meta = getTopsideLevelMeta(level);
  const surfY = toScreenY(0);
  ctx.save();

  // 1. Shipwrecks: Weighted Descent Shot-Line + Diver-Down Surface Float Buoy
  if (meta.isWreck) {
    const spawnX = level.spawn?.x ?? 0;
    const buoyX = spawnX + 4.4;
    if (buoyX + 6 >= visX0 && buoyX - 10 <= visX1) {
      const shotX = spawnX + 0.35;
      const sxShot = toScreenX(shotX);
      const shotBottomM = Math.min(18, Math.max(8, (level.spawn?.y ?? 2) + 11));
      const syBot = toScreenY(shotBottomM);
      const sway = Math.sin(timeSec * 1.45) * 0.16 * scale;

      ctx.strokeStyle = 'rgba(254, 240, 138, 0.56)';
      ctx.lineWidth = Math.max(1.3, 0.055 * scale);
      ctx.beginPath();
      ctx.moveTo(sxShot, surfY);
      ctx.quadraticCurveTo(sxShot + sway, (surfY + syBot) * 0.5, sxShot + sway * 0.4, syBot);
      ctx.stroke();

      for (const dm of [6, 12]) {
        if (dm >= shotBottomM - 1) continue;
        const dy = toScreenY(dm);
        const t = dm / shotBottomM;
        const dx = sxShot + sway * (2 * t * (1 - t) + 0.4 * t * t);
        ctx.fillStyle = dm === 6 ? '#4ade80' : '#facc15';
        ctx.beginPath();
        ctx.arc(dx, dy, Math.max(2.6, 0.11 * scale), 0, Math.PI * 2);
        ctx.fill();
        if (scale >= 16) {
          ctx.font = '800 9px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = dm === 6 ? 'rgba(134, 239, 172, 0.88)' : 'rgba(253, 224, 71, 0.8)';
          ctx.textAlign = 'left';
          ctx.fillText(dm === 6 ? '6m O₂ STOP' : '12m SHOT', dx + 6, dy + 3);
        }
      }

      const bx = toScreenX(buoyX);
      const bob = Math.sin(timeSec * 2.3 + 0.8) * 0.12 * scale;
      const by = surfY + bob;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sxShot + 2.2 * scale, surfY + 0.08 * scale);
      ctx.quadraticCurveTo((sxShot + bx) * 0.5, surfY + 0.45 * scale, bx, by + 0.1 * scale);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.ellipse(bx, by, 0.48 * scale, 0.24 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(bx - 0.12 * scale, by - 0.22 * scale, 0.24 * scale, 0.12 * scale);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1.2, 0.05 * scale);
      ctx.beginPath();
      ctx.moveTo(bx, by - 0.2 * scale);
      ctx.lineTo(bx, by - 1.15 * scale);
      ctx.stroke();
      const fw = 0.72 * scale;
      const fh = 0.46 * scale;
      const wave = Math.sin(timeSec * 4.2) * 0.06 * scale;
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(bx, by - 1.12 * scale);
      ctx.lineTo(bx + fw, by - 1.12 * scale + wave);
      ctx.lineTo(bx + fw, by - 1.12 * scale + fh + wave);
      ctx.lineTo(bx, by - 1.12 * scale + fh);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.6, 0.09 * scale);
      ctx.beginPath();
      ctx.moveTo(bx + 0.06 * scale, by - 1.06 * scale);
      ctx.lineTo(bx + fw - 0.06 * scale, by - 1.12 * scale + fh - 0.05 * scale + wave);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // 2. Arctic / Glacial / Polar Sites: Bobbing Sea-Ice Floes + Cached Aurora Ribbons
  if (meta.isPolar) {
    if (surfY > 40) {
      ctx.globalCompositeOperation = 'screen';
      const qSurf = Math.round(surfY / 4);
      if (!renderer._auroraGradCache || renderer._auroraGradCache.qSurf !== qSurf) {
        const yTop = Math.max(0, surfY - 210);
        const yBot = surfY - 28;
        const g0 = ctx.createLinearGradient(0, yTop, 0, yBot);
        g0.addColorStop(0, 'rgba(52, 211, 153, 0)');
        g0.addColorStop(0.45, 'rgba(52, 211, 153, 0.16)');
        g0.addColorStop(1, 'rgba(167, 139, 250, 0)');
        const g1 = ctx.createLinearGradient(0, yTop, 0, yBot);
        g1.addColorStop(0, 'rgba(52, 211, 153, 0)');
        g1.addColorStop(0.45, 'rgba(56, 189, 248, 0.14)');
        g1.addColorStop(1, 'rgba(167, 139, 250, 0)');
        renderer._auroraGradCache = { qSurf, grads: [g0, g1] };
      }
      const xStart = toScreenX(visX0 - 4);
      const xEnd = toScreenX(visX1 + 4);
      for (let b = 0; b < 2; b++) {
        ctx.fillStyle = renderer._auroraGradCache.grads[b];
        ctx.beginPath();
        ctx.moveTo(xStart, surfY - 28);
        for (let px = xStart; px <= xEnd; px += 48) {
          const wy = surfY - 125 - b * 36 + Math.sin(px * 0.012 + timeSec * (0.55 + b * 0.2) + b * 2) * 26;
          ctx.lineTo(px, wy);
        }
        ctx.lineTo(xEnd, surfY - 28);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    for (let i = 0; i < meta.iceFloes.length; i++) {
      const floe = meta.iceFloes[i];
      if (floe.fx + 4 < visX0 || floe.fx - 4 > visX1) continue;
      const sx = toScreenX(floe.fx);
      const bob = Math.sin(timeSec * 1.4 + floe.phase) * 0.08 * scale;
      const fw = floe.widthM * scale;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.beginPath();
      ctx.moveTo(sx - fw * 0.88, surfY + bob);
      ctx.lineTo(sx - fw * 0.55, surfY + bob + 0.58 * scale);
      ctx.lineTo(sx + fw * 0.45, surfY + bob + 0.66 * scale);
      ctx.lineTo(sx + fw * 0.85, surfY + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(sx - fw, surfY + bob);
      ctx.lineTo(sx - fw * 0.68, surfY + bob - 0.34 * scale);
      ctx.lineTo(sx + fw * 0.52, surfY + bob - 0.38 * scale);
      ctx.lineTo(sx + fw, surfY + bob);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  // 3. Cenotes & Karst Caves: Hanging Banyan Roots, Swaying Jungle Lianas & Drifting Leaves
  for (const basin of level.openBasins || []) {
    if (basin.xMax + 8 < visX0 || basin.xMin - 8 > visX1) continue;
    const waterL =
      renderer._basinEdgeCache && typeof renderer._findBasinCliffEdgeX === 'function'
        ? renderer._findBasinCliffEdgeX(basin, -0.35, -1)
        : basin.xMin + 0.5;
    const waterR =
      renderer._basinEdgeCache && typeof renderer._findBasinCliffEdgeX === 'function'
        ? renderer._findBasinCliffEdgeX(basin, -0.35, 1)
        : basin.xMax - 0.5;
    for (let side = 0; side < 2; side++) {
      const rimProbeX = side === 0 ? waterL - 1.2 : waterR + 1.2;
      const rimY = typeof renderer._getHorizonGroundY === 'function' ? renderer._getHorizonGroundY(level, rimProbeX) : -3.4;
      const baseX = side === 0 ? waterL : waterR;
      const dir = side === 0 ? 1 : -1;
      for (let v = 0; v < 3; v++) {
        const rx = baseX + dir * (0.12 + v * 0.34);
        const sx = toScreenX(rx);
        const startWorldY = Math.min(-0.6, rimY + 0.25 + v * 0.18);
        const topY = toScreenY(startWorldY);
        const lenM = Math.max(1.4, Math.abs(startWorldY) * (0.72 + (v % 2) * 0.35));
        const botY = toScreenY(startWorldY + lenM);
        const sway = Math.sin(timeSec * (1.1 + v * 0.25) + v * 1.7 + side) * 0.26 * scale;
        ctx.strokeStyle = v === 0 ? 'rgba(78, 56, 36, 0.82)' : 'rgba(45, 92, 52, 0.72)';
        ctx.lineWidth = Math.max(1.2, (v === 0 ? 0.08 : 0.045) * scale);
        ctx.beginPath();
        ctx.moveTo(sx, topY);
        ctx.quadraticCurveTo(sx + sway, (topY + botY) * 0.5, sx + sway * 1.25, botY);
        ctx.stroke();
        if (v > 0 && scale >= 12) {
          ctx.fillStyle = 'rgba(74, 152, 82, 0.76)';
          for (let k = 1; k <= 3; k++) {
            const lt = k / 4;
            const lx = sx + sway * (2 * lt * (1 - lt) + 1.25 * lt * lt);
            const ly = topY + (botY - topY) * lt;
            ctx.beginPath();
            ctx.ellipse(lx + (k % 2 === 0 ? 3 : -3), ly, 3.2, 1.5, k % 2 === 0 ? 0.5 : -0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }
  ctx.restore();
}

/**
 * Rich, living underwater cavern / shipwreck diorama rendered behind the Home & Gear Workshop
 * screens even before cave chunks are baked (v240). Matches in-game biome palettes, volumetric
 * sunbeams, sculpted walls/stalactites, schooling fish, swaying kelp, marine snow & bubbles.
 */
export function drawMenuBackdropDiorama(renderer, level, timeSec = 0) {
  const ctx = renderer.ctx;
  const cw = renderer.canvas.width;
  const ch = renderer.canvas.height;
  const theme = level?.theme || {};

  const targetHexes = [
    theme.waterSurface || '#67e8f9',
    theme.waterShallow || '#06b6d4',
    theme.waterMid || '#0e5a6f',
    theme.waterDeep || '#072a47',
    theme.waterAbyss || '#020914',
  ];
  const parseHex = (hex) => {
    const s = String(hex || '#020b14').replace('#', '');
    const full = s.length === 3 ? `${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}` : s.padEnd(6, '0');
    const n = parseInt(full.slice(0, 6), 16);
    return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [2, 11, 20];
  };
  const dt = renderer._lastMenuBackdropSec ? Math.min(0.1, Math.max(0.004, timeSec - renderer._lastMenuBackdropSec)) : 0.016;
  renderer._lastMenuBackdropSec = timeSec;

  if (!renderer._menuBackdropRgb) {
    renderer._menuBackdropRgb = targetHexes.map(parseHex);
  } else {
    const alpha = 1 - Math.exp(-dt * 4.2);
    for (let i = 0; i < 5; i++) {
      const tgt = parseHex(targetHexes[i]);
      const cur = renderer._menuBackdropRgb[i];
      cur[0] += (tgt[0] - cur[0]) * alpha;
      cur[1] += (tgt[1] - cur[1]) * alpha;
      cur[2] += (tgt[2] - cur[2]) * alpha;
    }
  }
  const rgbStop = (i) => {
    const c = renderer._menuBackdropRgb[i];
    return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  };

  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, rgbStop(0));
  grad.addColorStop(0.22, rgbStop(1));
  grad.addColorStop(0.54, rgbStop(2));
  grad.addColorStop(0.82, rgbStop(3));
  grad.addColorStop(1, rgbStop(4));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  const mdpr = renderer._cachedDpr || 1;
  const isWreck = Boolean(level?.isWreck || level?.category === 'wreck');
  const isIce = /ice|arctic|glacial|scoresby|kverk/i.test(`${level?.id || ''} ${level?.name || ''}`);
  const tAnim = renderer._reducedMotion ? 0 : timeSec;

  ctx.save();

  // 1. Subtle refracted water surface caustic bands along top water column
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let c = 0; c < 4; c++) {
    const cy = ch * (0.04 + c * 0.045) + Math.sin(tAnim * (0.45 + c * 0.1) + c * 1.9) * ch * 0.012;
    const cg = ctx.createLinearGradient(0, cy - ch * 0.03, 0, cy + ch * 0.045);
    cg.addColorStop(0, 'rgba(186, 230, 253, 0)');
    cg.addColorStop(0.5, `rgba(186, 230, 253, ${(0.085 - c * 0.014).toFixed(3)})`);
    cg.addColorStop(1, 'rgba(186, 230, 253, 0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    for (let x = 0; x <= cw; x += Math.max(48, cw / 14)) {
      const wy = cy + Math.sin(x * 0.0045 + tAnim * 0.75 + c * 1.4) * ch * 0.014;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(cw, cy + ch * 0.055);
    ctx.lineTo(0, cy + ch * 0.055);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Helper: trace an organic rocky contour using multi-frequency harmonic curves (no sharp spikes)
  const rockNoise = (t, seed) =>
    Math.sin(t * 7.3 + seed) * 0.45 +
    Math.sin(t * 15.1 + seed * 1.9) * 0.28 +
    Math.sin(t * 29.7 + seed * 3.1) * 0.14 +
    Math.cos(t * 4.2 + seed * 0.7) * 0.13;

  // 2. Far misty cavern formations & distant canyon floor (asymmetric organic depth layer)
  ctx.fillStyle = isIce ? 'rgba(10, 44, 72, 0.36)' : isWreck ? 'rgba(10, 22, 36, 0.38)' : 'rgba(4, 24, 40, 0.38)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(cw, 0);
  for (let i = 0; i <= 28; i++) {
    const u = i / 28;
    const x = cw * (1 - u);
    const arch = Math.pow(Math.abs(u - 0.54) * 1.85, 1.7);
    const baseDepth = ch * (0.045 + Math.min(0.32, arch * 0.22));
    const y = baseDepth + rockNoise(u, 1.3) * ch * 0.032;
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // Distant organic canyon floor sloping gently from left to deep basin on right
  ctx.fillStyle = isIce ? 'rgba(6, 26, 48, 0.46)' : 'rgba(2, 13, 25, 0.48)';
  ctx.beginPath();
  ctx.moveTo(0, ch);
  for (let i = 0; i <= 28; i++) {
    const u = i / 28;
    const x = cw * u;
    const valley = Math.sin(u * Math.PI) * ch * 0.14;
    const y = ch * 0.76 + valley + rockNoise(u, 4.7) * ch * 0.034;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(cw, ch);
  ctx.closePath();
  ctx.fill();

  // 3. Soft volumetric sunbeams streaming diagonally through the natural cenote skylight
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 6; i++) {
    const baseX = cw * (0.18 + i * 0.13) + Math.sin(tAnim * 0.2 + i * 1.55) * cw * 0.028;
    const topW = cw * (0.024 + (i % 3) * 0.013);
    const botW = cw * (0.105 + (i % 3) * 0.034);
    const shimmer = 0.075 + 0.038 * Math.sin(tAnim * 0.48 + i * 2.1);
    const rayGrad = ctx.createLinearGradient(baseX, 0, baseX + cw * 0.07, ch * 0.9);
    rayGrad.addColorStop(0, `rgba(224, 242, 254, ${shimmer.toFixed(3)})`);
    rayGrad.addColorStop(0.55, `rgba(56, 189, 248, ${(shimmer * 0.4).toFixed(3)})`);
    rayGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.moveTo(baseX - topW, 0);
    ctx.lineTo(baseX + topW, 0);
    ctx.lineTo(baseX + botW + cw * 0.07, ch * 0.94);
    ctx.lineTo(baseX - botW * 0.38 + cw * 0.07, ch * 0.94);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 4. Living midground school of graceful fish silhouettes gliding through the sunlit column
  ctx.save();
  for (let f = 0; f < 10; f++) {
    const dir = f % 3 === 0 ? -1 : 1;
    const speed = (0.011 + (f % 4) * 0.004) * dir;
    const fx = (((f * 0.183 + tAnim * speed) % 1.16) + 1.16) % 1.16 - 0.08;
    const fy = 0.22 + (f % 5) * 0.12 + Math.sin(tAnim * 0.8 + f * 1.7) * 0.016;
    const sx = fx * cw;
    const sy = fy * ch;
    const flen = (7.5 + (f % 4) * 3.0) * mdpr;
    const tailWag = Math.sin(tAnim * (5.0 + (f % 3)) + f * 2.1) * flen * 0.22;
    ctx.save();
    ctx.translate(sx, sy);
    if (dir < 0) ctx.scale(-1, 1);
    ctx.fillStyle = f % 2 === 0 ? 'rgba(148, 218, 245, 0.2)' : 'rgba(56, 189, 248, 0.14)';
    ctx.beginPath();
    ctx.moveTo(flen * 0.65, 0);
    ctx.quadraticCurveTo(flen * 0.1, -flen * 0.34, -flen * 0.52, tailWag * 0.45);
    ctx.lineTo(-flen * 0.92, -flen * 0.28 + tailWag);
    ctx.lineTo(-flen * 0.72, tailWag * 0.5);
    ctx.lineTo(-flen * 0.92, flen * 0.28 + tailWag);
    ctx.lineTo(-flen * 0.52, tailWag * 0.45);
    ctx.quadraticCurveTo(flen * 0.1, flen * 0.34, flen * 0.65, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // 5. Organic asymmetric limestone rock ledges framing outer viewport margins (zero sharp spikes)
  const wallGradL = ctx.createLinearGradient(0, 0, cw * 0.18, 0);
  wallGradL.addColorStop(0, isIce ? 'rgba(5, 24, 42, 0.94)' : isWreck ? 'rgba(8, 16, 26, 0.94)' : 'rgba(2, 10, 20, 0.92)');
  wallGradL.addColorStop(0.65, isIce ? 'rgba(10, 42, 68, 0.66)' : 'rgba(4, 18, 32, 0.62)');
  wallGradL.addColorStop(1, 'rgba(4, 18, 32, 0)');
  ctx.fillStyle = wallGradL;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const y = ch * u;
    const cornerFlare = Math.pow(Math.max(0, 0.28 - u) / 0.28, 1.8) * cw * 0.11 + Math.pow(Math.max(0, u - 0.72) / 0.28, 1.8) * cw * 0.14;
    const x = cw * 0.045 + cornerFlare + rockNoise(u, 2.6) * cw * 0.022;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(0, ch);
  ctx.closePath();
  ctx.fill();

  const wallGradR = ctx.createLinearGradient(cw, 0, cw * 0.82, 0);
  wallGradR.addColorStop(0, isIce ? 'rgba(5, 24, 42, 0.94)' : isWreck ? 'rgba(8, 16, 26, 0.94)' : 'rgba(2, 10, 20, 0.92)');
  wallGradR.addColorStop(0.65, isIce ? 'rgba(10, 42, 68, 0.66)' : 'rgba(4, 18, 32, 0.62)');
  wallGradR.addColorStop(1, 'rgba(4, 18, 32, 0)');
  ctx.fillStyle = wallGradR;
  ctx.beginPath();
  ctx.moveTo(cw, 0);
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const y = ch * u;
    const cornerFlare = Math.pow(Math.max(0, 0.24 - u) / 0.24, 1.8) * cw * 0.09 + Math.pow(Math.max(0, u - 0.70) / 0.30, 1.8) * cw * 0.15;
    const x = cw - (cw * 0.04 + cornerFlare + rockNoise(u, 6.1) * cw * 0.022);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(cw, ch);
  ctx.closePath();
  ctx.fill();

  if (isWreck) {
    ctx.save();
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.11)';
    ctx.lineWidth = Math.max(1.8, 2.2 * mdpr);
    for (let r = 0; r < 4; r++) {
      const rx = cw * (0.03 + r * 0.028);
      ctx.beginPath();
      ctx.moveTo(rx, ch * (0.9 - r * 0.035));
      ctx.quadraticCurveTo(rx + cw * 0.018, ch * (0.72 - r * 0.03), rx - cw * 0.008, ch * (0.6 - r * 0.02));
      ctx.stroke();
    }
    ctx.restore();
  }

  // 6. Delicate hanging cenote roots (upper corners) & gently swaying kelp fronds (lower corners)
  ctx.save();
  ctx.lineCap = 'round';
  if (!isWreck && !isIce) {
    const rootAnchors = [
      { x: 0.055, len: 0.17, ph: 0.3 },
      { x: 0.095, len: 0.11, ph: 1.5 },
      { x: 0.915, len: 0.13, ph: 2.4 },
      { x: 0.955, len: 0.19, ph: 0.9 },
    ];
    for (let r = 0; r < rootAnchors.length; r++) {
      const ra = rootAnchors[r];
      const rx = cw * ra.x;
      const rlen = ch * ra.len;
      const sway = Math.sin(tAnim * 0.75 + ra.ph) * cw * 0.008;
      ctx.strokeStyle = 'rgba(12, 42, 46, 0.48)';
      ctx.lineWidth = Math.max(1.2, 1.8 * mdpr);
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.quadraticCurveTo(rx + sway * 0.5, rlen * 0.52, rx + sway, rlen);
      ctx.stroke();
    }
  }
  const kelpAnchors = [
    { x: 0.038, y: 1.0, h: 0.15, ph: 0.4 },
    { x: 0.072, y: 1.0, h: 0.11, ph: 1.7 },
    { x: 0.925, y: 1.0, h: 0.12, ph: 2.2 },
    { x: 0.962, y: 1.0, h: 0.16, ph: 3.5 },
  ];
  for (let k = 0; k < kelpAnchors.length; k++) {
    const ka = kelpAnchors[k];
    const bx = cw * ka.x;
    const by = ch * ka.y;
    const kh = ch * ka.h;
    const sway = Math.sin(tAnim * 0.95 + ka.ph) * cw * 0.012;
    ctx.strokeStyle = isIce ? 'rgba(56, 189, 248, 0.2)' : 'rgba(13, 66, 76, 0.52)';
    ctx.lineWidth = Math.max(1.8, 2.6 * mdpr);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + sway * 0.45, by - kh * 0.55, bx + sway, by - kh);
    ctx.stroke();
  }
  ctx.restore();

  // 7. Drifting parallax marine snow & specular rising bubbles (zero-alloc)
  if (!renderer._reducedMotion) {
    for (let s = 0; s < 34; s++) {
      const seed = (s + 3) * 1.6180339;
      const sx = ((((seed * 11.7) % 1) + Math.sin(tAnim * 0.32 + s * 1.3) * 0.015 + 1) % 1) * cw;
      const sy = ((((seed * 5.3) % 1) + tAnim * (0.004 + (s % 4) * 0.002)) % 1) * ch;
      const sr = (0.7 + (s % 3) * 0.55) * mdpr;
      ctx.fillStyle = `rgba(224, 242, 254, ${(0.12 + (s % 3) * 0.06).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.lineWidth = Math.max(1, mdpr * 0.8);
    for (let i = 0; i < 22; i++) {
      const seed = (i + 1) * 1.6180339;
      const speed = 0.02 + (i % 7) * 0.0065;
      const phase = (tAnim * speed + (seed % 1)) % 1;
      const by = ch * (1.06 - phase * 1.12);
      const bx = cw * (((seed * 7.31) % 1) + Math.sin(tAnim * (0.6 + (i % 4) * 0.25) + i * 2.3) * 0.015);
      const r = (1.8 + (i % 5) * 1.15) * (0.65 + (1 - phase) * 0.45) * mdpr;
      const fade = Math.sin(phase * Math.PI);
      const alpha = fade * (0.14 + (i % 3) * 0.055);
      ctx.fillStyle = `rgba(186, 230, 253, ${(alpha * 0.48).toFixed(3)})`;
      ctx.strokeStyle = `rgba(224, 242, 254, ${(alpha * 1.15).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(bx, by, r * 1.06, r * 0.94, Math.sin(tAnim + i) * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}
