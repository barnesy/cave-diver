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

const _DEFAULT_BG_URLS = {
  sky: './assets/sky-yucatan.jpg',
  rock: './assets/tex-limestone-wall.jpg',
  back: './assets/tex-cave-backwall.jpg',
  foliage: './assets/tex-foliage-canopy.jpg',
  palapa: './assets/surf-palapa.webp',
  palm: './assets/surf-tree-palm.webp',
};

const _defaultBgAssets = {
  started: false,
  rev: 0,
  imgs: {},
};

/**
 * Eagerly preload the photorealistic in-game textures & surface props used by the
 * universal default menu background so first paint matches in-game visual fidelity
 * instantaneously without waiting for heavy SDF chunk baking (v242).
 */
export function preloadDefaultMenuBackdrop() {
  if (_defaultBgAssets.started || typeof Image === 'undefined') return;
  _defaultBgAssets.started = true;
  for (const [key, src] of Object.entries(_DEFAULT_BG_URLS)) {
    try {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if ((img.naturalWidth || img.width) > 0) {
          _defaultBgAssets.imgs[key] = img;
          _defaultBgAssets.rev += 1;
        }
      };
      img.src = src;
    } catch (_) {}
  }
}

function _buildDefaultCenoteLayer(cw, ch) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const g = c.getContext('2d');
  if (!g) return null;

  const waterY = Math.round(ch * 0.295);
  const imgs = _defaultBgAssets.imgs;
  const rockNoise = (t, seed) =>
    Math.sin(t * 7.3 + seed) * 0.45 +
    Math.sin(t * 15.1 + seed * 1.9) * 0.28 +
    Math.sin(t * 29.7 + seed * 3.1) * 0.14 +
    Math.cos(t * 4.2 + seed * 0.7) * 0.13;

  // 1. Topside sky & jungle panorama (real sky-yucatan.jpg, exact same asset as Level 1)
  const skyGrad = g.createLinearGradient(0, 0, 0, waterY);
  skyGrad.addColorStop(0, '#1e3a4c');
  skyGrad.addColorStop(0.55, '#4b6c6e');
  skyGrad.addColorStop(1, '#78988a');
  g.fillStyle = skyGrad;
  g.fillRect(0, 0, cw, waterY + 4);

  if (imgs.sky && (imgs.sky.naturalWidth || imgs.sky.width) > 0) {
    const sw = imgs.sky.naturalWidth || imgs.sky.width;
    const sh = imgs.sky.naturalHeight || imgs.sky.height;
    const skyH = waterY + 8;
    const scaleCover = Math.max(cw / sw, skyH / sh);
    const dw = sw * scaleCover;
    const dh = sh * scaleCover;
    g.save();
    g.beginPath();
    g.rect(0, 0, cw, skyH);
    g.clip();
    g.drawImage(imgs.sky, (cw - dw) * 0.5, skyH - dh * 0.92, dw, dh);
    const mist = g.createLinearGradient(0, 0, 0, skyH);
    mist.addColorStop(0, 'rgba(6, 18, 30, 0.24)');
    mist.addColorStop(0.65, 'rgba(18, 42, 48, 0.06)');
    mist.addColorStop(1, 'rgba(120, 195, 198, 0.22)');
    g.fillStyle = mist;
    g.fillRect(0, 0, cw, skyH);
    g.restore();
  }

  // 2. Submerged Cenote Water Column + Recessed Photorealistic Cavern Backwall
  const waterGrad = g.createLinearGradient(0, waterY, 0, ch);
  waterGrad.addColorStop(0, '#36b5c8');
  waterGrad.addColorStop(0.18, '#167c94');
  waterGrad.addColorStop(0.5, '#0b455e');
  waterGrad.addColorStop(0.82, '#052236');
  waterGrad.addColorStop(1, '#020d1a');
  g.fillStyle = waterGrad;
  g.fillRect(0, waterY, cw, ch - waterY);

  if (imgs.back && g.createPattern) {
    g.save();
    g.beginPath();
    g.rect(0, waterY, cw, ch - waterY);
    g.clip();
    const backPat = g.createPattern(imgs.back, 'repeat');
    if (backPat) {
      g.globalAlpha = 0.24;
      g.fillStyle = backPat;
      g.fillRect(0, waterY, cw, ch - waterY);
    }
    const shaftGlow = g.createRadialGradient(cw * 0.48, waterY + ch * 0.12, cw * 0.04, cw * 0.48, waterY + ch * 0.34, cw * 0.48);
    shaftGlow.addColorStop(0, 'rgba(125, 224, 240, 0.28)');
    shaftGlow.addColorStop(0.5, 'rgba(14, 116, 144, 0.1)');
    shaftGlow.addColorStop(1, 'rgba(2, 10, 22, 0.62)');
    g.globalAlpha = 1;
    g.fillStyle = shaftGlow;
    g.fillRect(0, waterY, cw, ch - waterY);
    g.restore();
  }

  // Authentic karst limestone cliffs framing a wide cenote shaft opening into lower-right cavern mouth
  const cliffTopY = Math.round(ch * 0.085);
  const traceLeftCliff = () => {
    g.beginPath();
    g.moveTo(0, cliffTopY);
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const x = cw * (u * 0.23);
      const y = cliffTopY + Math.sin(u * Math.PI * 1.4) * ch * 0.014 + rockNoise(u, 0.9) * ch * 0.008;
      g.lineTo(x, y);
    }
    for (let i = 0; i <= 32; i++) {
      const u = i / 32;
      const y = cliffTopY + u * (ch - cliffTopY);
      const overhang = u < 0.26 ? Math.sin((u / 0.26) * Math.PI) * cw * 0.015 : 0;
      const cavernSlope = u > 0.56 ? Math.pow((u - 0.56) / 0.44, 1.45) * cw * 0.46 : 0;
      const x = cw * 0.225 + overhang + cavernSlope + rockNoise(u, 2.3) * cw * 0.018;
      g.lineTo(x, y);
    }
    g.lineTo(0, ch);
    g.closePath();
  };

  const traceRightCliff = () => {
    g.beginPath();
    g.moveTo(cw, cliffTopY - ch * 0.01);
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      const x = cw * (1 - u * 0.44);
      const y = cliffTopY - ch * 0.01 + Math.sin(u * Math.PI * 1.1) * ch * 0.018 + rockNoise(u, 3.1) * ch * 0.008;
      g.lineTo(x, y);
    }
    for (let i = 0; i <= 32; i++) {
      const u = i / 32;
      const y = cliffTopY + u * (ch - cliffTopY);
      const lip = u < 0.28 ? -Math.sin((u / 0.28) * Math.PI) * cw * 0.02 : 0;
      const mouthOpen = u > 0.48 ? Math.pow((u - 0.48) / 0.52, 1.35) * cw * 0.36 : 0;
      const x = cw * 0.565 + lip + mouthOpen + rockNoise(u, 5.4) * cw * 0.019;
      g.lineTo(x, y);
    }
    g.lineTo(cw, ch);
    g.closePath();
  };

  const rockPat = imgs.rock && g.createPattern ? g.createPattern(imgs.rock, 'repeat') : null;
  const paintCliff = (traceFn, isLeft) => {
    g.save();
    traceFn();
    g.clip();
    if (rockPat) {
      g.save();
      const s = Math.max(0.75, Math.min(1.25, cw / 1280));
      g.scale(s, s);
      g.fillStyle = rockPat;
      g.fillRect(0, 0, cw / s, ch / s);
      g.restore();
    } else {
      g.fillStyle = '#5c4b37';
      g.fillRect(0, 0, cw, ch);
    }
    const rockDepth = g.createLinearGradient(0, cliffTopY, 0, ch);
    rockDepth.addColorStop(0, 'rgba(32, 24, 16, 0.26)');
    rockDepth.addColorStop(0.24, 'rgba(20, 18, 16, 0.34)');
    rockDepth.addColorStop(0.55, 'rgba(7, 18, 26, 0.58)');
    rockDepth.addColorStop(1, 'rgba(2, 9, 18, 0.84)');
    g.fillStyle = rockDepth;
    g.fillRect(0, cliffTopY - 20, cw, ch - cliffTopY + 30);

    const rimX0 = isLeft ? cw * 0.28 : cw * 0.52;
    const rimX1 = isLeft ? cw * 0.02 : cw * 0.98;
    const bounce = g.createLinearGradient(rimX0, waterY, rimX1, waterY + ch * 0.25);
    bounce.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
    bounce.addColorStop(0.35, 'rgba(14, 116, 144, 0.05)');
    bounce.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
    g.fillStyle = bounce;
    g.fillRect(0, waterY - 10, cw, ch - waterY + 20);
    g.restore();

    g.save();
    traceFn();
    g.strokeStyle = 'rgba(4, 10, 16, 0.58)';
    g.lineWidth = Math.max(2, cw * 0.0022);
    g.stroke();
    g.restore();
  };

  paintCliff(traceLeftCliff, true);
  paintCliff(traceRightCliff, false);

  // 3. Topside Jungle Canopy Rim (real tex-foliage-canopy.jpg) + Palapa Hut + Palms
  const folPat = imgs.foliage && g.createPattern ? g.createPattern(imgs.foliage, 'repeat') : null;
  const drawFoliageCap = (x0, x1, baseY) => {
    g.save();
    g.beginPath();
    g.moveTo(x0, baseY + ch * 0.018);
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = x0 + (x1 - x0) * u;
      const tuft = Math.sin(u * Math.PI) * ch * 0.026 + Math.abs(Math.sin(u * 13.7)) * ch * 0.011;
      g.lineTo(x, baseY - tuft);
    }
    g.lineTo(x1, baseY + ch * 0.018);
    g.closePath();
    g.clip();
    g.fillStyle = folPat || '#1d4d2c';
    g.fillRect(x0 - 4, baseY - ch * 0.06, x1 - x0 + 8, ch * 0.09);
    const fg = g.createLinearGradient(0, baseY - ch * 0.04, 0, baseY + ch * 0.02);
    fg.addColorStop(0, 'rgba(74, 222, 128, 0.14)');
    fg.addColorStop(1, 'rgba(5, 22, 14, 0.56)');
    g.fillStyle = fg;
    g.fillRect(x0 - 4, baseY - ch * 0.06, x1 - x0 + 8, ch * 0.09);
    g.restore();
  };
  drawFoliageCap(0, cw * 0.235, cliffTopY + ch * 0.004);
  drawFoliageCap(cw * 0.555, cw, cliffTopY - ch * 0.004);

  if (imgs.palapa && (imgs.palapa.naturalWidth || imgs.palapa.width) > 0) {
    const ph = ch * 0.125;
    const pw = ph * ((imgs.palapa.naturalWidth || 1) / Math.max(1, imgs.palapa.naturalHeight || 1));
    g.save();
    g.globalAlpha = 0.92;
    g.drawImage(imgs.palapa, cw * 0.085, cliffTopY - ph * 0.86, pw, ph);
    g.restore();
  }
  if (imgs.palm && (imgs.palm.naturalWidth || imgs.palm.width) > 0) {
    const drawPalm = (px, py, ph, flip = false) => {
      const pw = ph * ((imgs.palm.naturalWidth || 1) / Math.max(1, imgs.palm.naturalHeight || 1));
      g.save();
      g.globalAlpha = 0.88;
      g.translate(px, py);
      if (flip) g.scale(-1, 1);
      g.drawImage(imgs.palm, -pw * 0.5, -ph * 0.9, pw, ph);
      g.restore();
    };
    drawPalm(cw * 0.04, cliffTopY + ch * 0.005, ch * 0.15, false);
    drawPalm(cw * 0.62, cliffTopY - ch * 0.004, ch * 0.145, true);
    drawPalm(cw * 0.91, cliffTopY - ch * 0.004, ch * 0.155, false);
  }

  // 4. Authentic Wooden Cenote Dive Platform & Entry Ladder descending into water
  const dockX = cw * 0.21;
  const dockW = cw * 0.068;
  const dockY = waterY - ch * 0.012;
  g.save();
  g.strokeStyle = '#4a321d';
  g.lineWidth = Math.max(2, cw * 0.0024);
  g.beginPath();
  g.moveTo(dockX + dockW * 0.25, dockY);
  g.lineTo(dockX + dockW * 0.25, waterY + ch * 0.075);
  g.moveTo(dockX + dockW * 0.82, dockY);
  g.lineTo(dockX + dockW * 0.82, waterY + ch * 0.075);
  g.stroke();
  g.fillStyle = '#6c492c';
  g.fillRect(dockX - cw * 0.01, dockY - 3, dockW + cw * 0.01, Math.max(5, ch * 0.008));
  g.fillStyle = 'rgba(255, 224, 178, 0.18)';
  g.fillRect(dockX - cw * 0.01, dockY - 3, dockW + cw * 0.01, 2);
  const ladX = cw * 0.228;
  const ladW = Math.max(9, cw * 0.011);
  g.strokeStyle = '#5a3c22';
  g.lineWidth = Math.max(1.8, cw * 0.0018);
  g.beginPath();
  g.moveTo(ladX, cliffTopY + ch * 0.01);
  g.lineTo(ladX - cw * 0.008, waterY + ch * 0.05);
  g.moveTo(ladX + ladW, cliffTopY + ch * 0.01);
  g.lineTo(ladX + ladW - cw * 0.008, waterY + ch * 0.05);
  g.stroke();
  g.lineWidth = Math.max(1.3, cw * 0.0014);
  for (let r = 0; r < 10; r++) {
    const u = r / 9;
    const rx = ladX - cw * 0.008 * u;
    const ry = cliffTopY + ch * 0.015 + u * (waterY + ch * 0.035 - cliffTopY);
    g.beginPath();
    g.moveTo(rx, ry);
    g.lineTo(rx + ladW, ry);
    g.stroke();
  }
  g.restore();

  return c;
}

/**
 * Photorealistic preloaded default underwater cenote backdrop (v242):
 * Matches in-game level texture & environmental fidelity using cached real game assets,
 * smoothly tinted to any selected expedition's biome palette before a level is baked.
 */
export function drawMenuBackdropDiorama(renderer, level, timeSec = 0) {
  preloadDefaultMenuBackdrop();
  const ctx = renderer.ctx;
  const cw = renderer.canvas.width;
  const ch = renderer.canvas.height;
  const theme = level?.theme || {};
  const waterY = Math.round(ch * 0.295);

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
  const rgbaStop = (i, a) => {
    const c = renderer._menuBackdropRgb[i];
    return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  };

  // Build / reuse cached photorealistic static cenote canvas (1 blit per frame!)
  const cache = renderer._defaultBackdropCache;
  if (!cache || cache.w !== cw || cache.h !== ch || cache.rev !== _defaultBgAssets.rev) {
    const layer = _buildDefaultCenoteLayer(cw, ch);
    renderer._defaultBackdropCache = layer ? { w: cw, h: ch, rev: _defaultBgAssets.rev, canvas: layer } : null;
  }

  if (renderer._defaultBackdropCache?.canvas) {
    ctx.drawImage(renderer._defaultBackdropCache.canvas, 0, 0);
  } else {
    const fallbackGrad = ctx.createLinearGradient(0, 0, 0, ch);
    fallbackGrad.addColorStop(0, rgbaStop(0, 1));
    fallbackGrad.addColorStop(0.35, rgbaStop(2, 1));
    fallbackGrad.addColorStop(1, rgbaStop(4, 1));
    ctx.fillStyle = fallbackGrad;
    ctx.fillRect(0, 0, cw, ch);
  }

  // Gentle biome water color-grading glaze clipped cleanly inside the submerged cenote shaft (zero seam on rock cliffs!)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cw * 0.215, waterY);
  ctx.lineTo(cw * 0.575, waterY);
  ctx.lineTo(cw * 0.96, ch);
  ctx.lineTo(cw * 0.65, ch);
  ctx.lineTo(cw * 0.215, ch * 0.65);
  ctx.closePath();
  ctx.clip();
  const biomeTint = ctx.createLinearGradient(0, waterY, 0, ch);
  biomeTint.addColorStop(0, rgbaStop(0, 0.16));
  biomeTint.addColorStop(0.28, rgbaStop(1, 0.22));
  biomeTint.addColorStop(0.62, rgbaStop(2, 0.24));
  biomeTint.addColorStop(1, rgbaStop(4, 0.32));
  ctx.fillStyle = biomeTint;
  ctx.fillRect(0, waterY, cw, ch - waterY);
  ctx.restore();

  const mdpr = renderer._cachedDpr || 1;
  const tAnim = renderer._reducedMotion ? 0 : timeSec;

  ctx.save();

  // 1. Live volumetric cenote sunbeams piercing down through the water surface opening
  ctx.save();
  ctx.beginPath();
  ctx.rect(cw * 0.21, waterY, cw * 0.56, ch - waterY);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 6; i++) {
    const baseX = cw * (0.27 + i * 0.068) + Math.sin(tAnim * 0.22 + i * 1.45) * cw * 0.016;
    const topW = cw * (0.016 + (i % 3) * 0.009);
    const botW = cw * (0.072 + (i % 3) * 0.022);
    const shimmer = 0.095 + 0.045 * Math.sin(tAnim * 0.55 + i * 2.1);
    const rayGrad = ctx.createLinearGradient(baseX, waterY, baseX + cw * 0.06, ch * 0.92);
    rayGrad.addColorStop(0, `rgba(224, 248, 255, ${shimmer.toFixed(3)})`);
    rayGrad.addColorStop(0.55, `rgba(56, 189, 248, ${(shimmer * 0.42).toFixed(3)})`);
    rayGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.moveTo(baseX - topW, waterY);
    ctx.lineTo(baseX + topW, waterY);
    ctx.lineTo(baseX + botW + cw * 0.075, ch * 0.94);
    ctx.lineTo(baseX - botW * 0.35 + cw * 0.075, ch * 0.94);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 2. Shimmering animated water surface meniscus + floating cenote lily pads
  ctx.save();
  const surfX0 = cw * 0.215;
  const surfX1 = cw * 0.575;
  ctx.strokeStyle = 'rgba(207, 250, 254, 0.72)';
  ctx.lineWidth = Math.max(1.8, 2.1 * mdpr);
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const x = surfX0 + (surfX1 - surfX0) * u;
    const y = waterY + Math.sin(u * 14 + tAnim * 1.9) * 1.8 * mdpr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const pads = [0.275, 0.325, 0.385, 0.465, 0.515];
  for (let p = 0; p < pads.length; p++) {
    const px = cw * pads[p] + Math.sin(tAnim * 0.7 + p * 1.8) * 2.5 * mdpr;
    const py = waterY + Math.sin(tAnim * 1.5 + p * 2.1) * 1.2 * mdpr;
    ctx.strokeStyle = 'rgba(34, 128, 72, 0.42)';
    ctx.lineWidth = Math.max(1.1, 1.3 * mdpr);
    ctx.beginPath();
    ctx.moveTo(px, py + 2);
    ctx.quadraticCurveTo(px + Math.sin(tAnim * 0.9 + p) * 5 * mdpr, py + ch * 0.07, px, py + ch * 0.14);
    ctx.stroke();
    ctx.fillStyle = '#2d7a46';
    ctx.beginPath();
    ctx.ellipse(px, py, (10 + (p % 2) * 3) * mdpr, 3.2 * mdpr, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3. Golden cave guideline curving from entry ladder down into the cavern gate (bottom-right)
  ctx.save();
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.52)';
  ctx.lineWidth = Math.max(1.5, 1.8 * mdpr);
  ctx.beginPath();
  ctx.moveTo(cw * 0.26, waterY + ch * 0.05);
  ctx.quadraticCurveTo(cw * 0.42, ch * 0.56, cw * 0.92, ch * 0.85);
  ctx.stroke();
  ctx.restore();

  // 4. Gently swaying hanging jungle vines along cliff lips
  ctx.save();
  ctx.lineCap = 'round';
  const vines = [
    { x: 0.215, y0: 0.09, len: 0.19, ph: 0.4 },
    { x: 0.555, y0: 0.085, len: 0.23, ph: 1.8 },
    { x: 0.578, y0: 0.09, len: 0.15, ph: 2.9 },
  ];
  for (let v = 0; v < vines.length; v++) {
    const vn = vines[v];
    const vx = cw * vn.x;
    const vy0 = ch * vn.y0;
    const vlen = ch * vn.len;
    const sway = Math.sin(tAnim * 0.85 + vn.ph) * cw * 0.008;
    ctx.strokeStyle = 'rgba(44, 128, 64, 0.58)';
    ctx.lineWidth = Math.max(1.3, 1.8 * mdpr);
    ctx.beginPath();
    ctx.moveTo(vx, vy0);
    ctx.quadraticCurveTo(vx + sway * 0.5, vy0 + vlen * 0.52, vx + sway, vy0 + vlen);
    ctx.stroke();
  }
  ctx.restore();

  // 5. Living colorful cenote fish swimming calmly through the sunlit shaft
  ctx.save();
  const fishPalette = ['#fb923c', '#38bdf8', '#facc15', '#34d399', '#f97316'];
  for (let f = 0; f < 9; f++) {
    const dir = f % 3 === 0 ? -1 : 1;
    const speed = (0.009 + (f % 4) * 0.0032) * dir;
    const spanU = (((f * 0.173 + tAnim * speed) % 1) + 1) % 1;
    const fx = 0.25 + spanU * 0.44;
    const fy = 0.36 + (f % 5) * 0.075 + Math.sin(tAnim * 0.85 + f * 1.7) * 0.012;
    const sx = fx * cw;
    const sy = fy * ch;
    const flen = (6.5 + (f % 3) * 2.4) * mdpr;
    const tailWag = Math.sin(tAnim * (5.2 + (f % 3)) + f * 2.1) * flen * 0.22;
    ctx.save();
    ctx.translate(sx, sy);
    if (dir < 0) ctx.scale(-1, 1);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = fishPalette[f % fishPalette.length];
    ctx.beginPath();
    ctx.moveTo(flen * 0.65, 0);
    ctx.quadraticCurveTo(flen * 0.1, -flen * 0.36, -flen * 0.52, tailWag * 0.45);
    ctx.lineTo(-flen * 0.92, -flen * 0.3 + tailWag);
    ctx.lineTo(-flen * 0.72, tailWag * 0.5);
    ctx.lineTo(-flen * 0.92, flen * 0.3 + tailWag);
    ctx.lineTo(-flen * 0.52, tailWag * 0.45);
    ctx.quadraticCurveTo(flen * 0.1, flen * 0.36, flen * 0.65, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // 6. Drifting marine snow & rising specular cenote bubbles
  if (!renderer._reducedMotion) {
    for (let s = 0; s < 26; s++) {
      const seed = (s + 3) * 1.6180339;
      const sx = (0.18 + ((((seed * 11.7) % 1) + Math.sin(tAnim * 0.32 + s * 1.3) * 0.015 + 1) % 1) * 0.68) * cw;
      const sy = waterY + ((((seed * 5.3) % 1) + tAnim * (0.004 + (s % 4) * 0.002)) % 1) * (ch - waterY);
      const sr = (0.7 + (s % 3) * 0.55) * mdpr;
      ctx.fillStyle = `rgba(224, 242, 254, ${(0.12 + (s % 3) * 0.05).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.lineWidth = Math.max(1, mdpr * 0.8);
    for (let i = 0; i < 18; i++) {
      const seed = (i + 1) * 1.6180339;
      const speed = 0.024 + (i % 7) * 0.007;
      const phase = (tAnim * speed + (seed % 1)) % 1;
      const by = ch - phase * (ch - waterY);
      const bx = cw * (0.24 + ((seed * 7.31) % 0.46) + Math.sin(tAnim * (0.65 + (i % 4) * 0.25) + i * 2.3) * 0.012);
      const r = (1.6 + (i % 5) * 1.05) * (0.65 + (1 - phase) * 0.45) * mdpr;
      const fade = Math.sin(phase * Math.PI);
      const alpha = fade * (0.16 + (i % 3) * 0.06);
      ctx.fillStyle = `rgba(186, 230, 253, ${(alpha * 0.48).toFixed(3)})`;
      ctx.strokeStyle = `rgba(224, 242, 254, ${(alpha * 1.2).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(bx, by, r * 1.06, r * 0.94, Math.sin(tAnim + i) * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}
