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
