import { evaluateCaveSDF } from '../collision.js';
import { CACHE_PX_PER_M } from './chunkBaker.js';

const SKY_PALETTES = {
  'florida-cypress': ['#8aa6bd', '#dfd3bc', '#e6c999', 'rgba(253, 224, 158, 0.20)', 'rgba(252, 244, 224, 0.14)', 'rgba(48, 52, 58, 0.48)'],
  'nordic-fjord': ['#5c82a3', '#b8cede', '#d8e6ee', 'rgba(224, 242, 254, 0.22)', 'rgba(226, 240, 248, 0.17)', 'rgba(34, 48, 62, 0.46)'],
  'provence-gorge': ['#688bb5', '#dfd0c2', '#f4d9b5', 'rgba(254, 215, 170, 0.22)', 'rgba(254, 244, 232, 0.14)', 'rgba(56, 48, 42, 0.44)'],
  'kalahari-crater': ['#2e5b9e', '#d6975c', '#f5cb86', 'rgba(253, 224, 71, 0.25)', 'rgba(254, 235, 200, 0.14)', 'rgba(54, 38, 28, 0.50)'],
  'ural-birch': ['#4f7da8', '#bfd5e6', '#eef4f8', 'rgba(248, 250, 252, 0.28)', 'rgba(241, 245, 249, 0.20)', 'rgba(38, 52, 68, 0.46)'],
  'bahamas-abaco': ['#0284c7', '#67e8f9', '#fef08a', 'rgba(254, 240, 138, 0.24)', 'rgba(224, 242, 254, 0.16)', 'rgba(15, 38, 48, 0.44)'],
  'budapest-bathhouse': ['#507294', '#c5d4df', '#efe2c7', 'rgba(254, 243, 199, 0.24)', 'rgba(255, 247, 232, 0.22)', 'rgba(42, 46, 54, 0.44)'],
  'sinai-coast': ['#0369a1', '#38bdf8', '#fde68a', 'rgba(254, 215, 170, 0.28)', 'rgba(254, 243, 214, 0.14)', 'rgba(54, 38, 28, 0.46)'],
  'quercy-ressel': ['#52799e', '#c8dce6', '#ece7da', 'rgba(254, 243, 199, 0.20)', 'rgba(236, 248, 250, 0.18)', 'rgba(44, 52, 60, 0.44)'],
  'lazio-travertine': ['#3b75b2', '#9bc5e8', '#f5e4c3', 'rgba(253, 230, 138, 0.24)', 'rgba(254, 249, 235, 0.14)', 'rgba(54, 48, 42, 0.42)'],
  'moravia-rift': ['#475569', '#94a3b8', '#cbd5e1', 'rgba(226, 232, 240, 0.20)', 'rgba(203, 213, 225, 0.26)', 'rgba(30, 41, 59, 0.48)'],
  'oxbelha-twilight': ['#172554', '#475569', '#f59e0b', 'rgba(251, 191, 36, 0.22)', 'rgba(254, 215, 170, 0.16)', 'rgba(15, 23, 42, 0.56)'],
  'aurora-basalt': ['#030816', '#0f2847', '#2dd4bf', 'rgba(45, 212, 191, 0.26)', 'rgba(165, 243, 252, 0.16)', 'rgba(15, 23, 42, 0.45)'],
  'strytan-fjord': ['#0b2242', '#24527a', '#cbd5e1', 'rgba(186, 230, 253, 0.24)', 'rgba(203, 213, 225, 0.18)', 'rgba(15, 23, 42, 0.46)'],
  'kverkfjoll-glacier': ['#163859', '#4f8eb8', '#e0f2fe', 'rgba(207, 250, 254, 0.28)', 'rgba(224, 242, 254, 0.22)', 'rgba(30, 41, 59, 0.44)'],
  'grjotagja-rift': ['#0f172a', '#312e81', '#fb923c', 'rgba(251, 146, 60, 0.26)', 'rgba(254, 215, 170, 0.16)', 'rgba(15, 23, 42, 0.52)'],
  'atlantida-lava': ['#0c4a6e', '#38bdf8', '#fed7aa', 'rgba(254, 215, 170, 0.28)', 'rgba(224, 242, 254, 0.14)', 'rgba(15, 23, 42, 0.48)'],
  'lagoa-cerrado': ['#1d6fa3', '#67b7dc', '#fef08a', 'rgba(254, 240, 138, 0.22)', 'rgba(220, 252, 231, 0.16)', 'rgba(30, 48, 42, 0.44)'],
  'boybulok-steppe': ['#14233c', '#3c5a80', '#cbd5e1', 'rgba(226, 232, 240, 0.24)', 'rgba(203, 213, 225, 0.20)', 'rgba(30, 41, 59, 0.48)'],
  'nordic-mine': ['#1e354d', '#526f8a', '#cbd5e1', 'rgba(226, 232, 240, 0.20)', 'rgba(203, 213, 225, 0.20)', 'rgba(30, 41, 59, 0.48)'],
  'greenland-iceberg': ['#0f2c4d', '#3b82b8', '#e0f2fe', 'rgba(224, 242, 254, 0.30)', 'rgba(186, 230, 253, 0.24)', 'rgba(15, 32, 54, 0.44)'],
  'bermuda-sargasso': ['#0369a1', '#38bdf8', '#fef08a', 'rgba(254, 240, 138, 0.24)', 'rgba(204, 251, 241, 0.18)', 'rgba(15, 38, 48, 0.44)'],
  yucatan: ['#7cb0cc', '#c6dfea', '#e6eed8', 'rgba(254, 243, 199, 0.18)', 'rgba(236, 248, 250, 0.15)', 'rgba(30, 48, 52, 0.44)'],
};

const SURFACE_SOIL_PALETTES = {
  'florida-cypress': { turf: '#3b4e24', soil: '#463b2d', tuft: '#5a722e', stone: '#686259' },
  'nordic-fjord': { turf: '#2c4a3e', soil: '#36414c', tuft: '#476b5a', stone: '#64748b' },
  'ural-birch': { turf: '#38574c', soil: '#52606d', tuft: '#5b7d6c', stone: '#9aa7b5' },
  'provence-gorge': { turf: '#4e5f2c', soil: '#6c5c46', tuft: '#6f823e', stone: '#a69d8b' },
  'kalahari-crater': { turf: '#7c5c28', soil: '#764128', tuft: '#b88c28', stone: '#8b4528' },
  'bahamas-abaco': { turf: '#2f6548', soil: '#8f8b7e', tuft: '#4a855c', stone: '#c7c2b4' },
  'budapest-bathhouse': { turf: '#41572c', soil: '#6a5d47', tuft: '#5c7838', stone: '#b5a88d' },
  'sinai-coast': { turf: '#8e6c3f', soil: '#9c6e44', tuft: '#b88f4c', stone: '#b38354' },
  'quercy-ressel': { turf: '#3e5932', soil: '#635e54', tuft: '#587842', stone: '#aca79a' },
  'lazio-travertine': { turf: '#525f30', soil: '#736148', tuft: '#75823d', stone: '#b09d7c' },
  'moravia-rift': { turf: '#2f4539', soil: '#37414b', tuft: '#476252', stone: '#546170' },
  'oxbelha-twilight': { turf: '#233c26', soil: '#30342e', tuft: '#365a35', stone: '#4c5249' },
  'aurora-basalt': { turf: '#1c313f', soil: '#1e242d', tuft: '#2dd4bf', stone: '#334155' },
  'strytan-fjord': { turf: '#243b4a', soil: '#27303d', tuft: '#7dd3fc', stone: '#475569' },
  'kverkfjoll-glacier': { turf: '#3b6b8f', soil: '#1f334a', tuft: '#a5f3fc', stone: '#7dd3fc' },
  'grjotagja-rift': { turf: '#24292e', soil: '#1c1917', tuft: '#fb923c', stone: '#292524' },
  'atlantida-lava': { turf: '#3b2b24', soil: '#1e1b18', tuft: '#fdba74', stone: '#44403c' },
  'lagoa-cerrado': { turf: '#2f6532', soil: '#524432', tuft: '#4ade80', stone: '#8c8370' },
  'boybulok-steppe': { turf: '#5c5340', soil: '#463f33', tuft: '#cbd5e1', stone: '#78716c' },
  'nordic-mine': { turf: '#2c4138', soil: '#3a3430', tuft: '#4b6b58', stone: '#57534e' },
  'greenland-iceberg': { turf: '#7dd3fc', soil: '#1e3a5f', tuft: '#e0f2fe', stone: '#bae6fd' },
  'bermuda-sargasso': { turf: '#2e6a4a', soil: '#a89888', tuft: '#4ade80', stone: '#d6c7bc' },
  yucatan: { turf: '#2b5528', soil: '#4a3d2d', tuft: '#447634', stone: '#6d6658' },
};

const MARGIN_MAP = {
  'tannin-chert': ['#4e4535', '#4f5d2a'],
  'glacial-marble': ['#3b4856', '#34524a'],
  'provence-ivory': ['#6b604e', '#4d5d2b'],
  'kalahari-ironstone': ['#784730', '#8c6932'],
  'ural-gypsum': ['#6b7785', '#4b6b63'],
  'abaco-aragonite': ['#5d6b6e', '#2f6d5a'],
  'buda-thermal-marl': ['#6f624c', '#455931'],
  'sinai-coral-sandstone': ['#8d6644', '#b58d52'],
  'quercy-chalk': ['#6b6b64', '#415c36'],
  'lazio-travertine': ['#7b6c55', '#5a6332'],
  'moravia-carbonic': ['#3e4752', '#354b3e'],
  'oxbelha-dusk': ['#323934', '#26422b'],
  'katla-basalt': ['#232c38', '#2a4a5e'],
  'strytan-smectite': ['#263544', '#2c5a70'],
  'kverkfjoll-ice': ['#2e5272', '#67d4f5'],
  'grjotagja-obsidian': ['#1f1c26', '#7c3aed'],
  'atlantida-basalt': ['#262328', '#ea580c'],
  'lagoa-cerrado': ['#5c5444', '#2f6d34'],
  'boybulok-steppe': ['#6b5d4d', '#64748b'],
  'nordic-iron-mine': ['#44403c', '#57534e'],
  'greenland-glacial': ['#2563eb', '#7dd3fc'],
  'bermuda-coral': ['#8c7d72', '#2f7a64'],
};

export const surfaceRendererMethods = {
  _drawSurfaceSky(ctx, cw, surfY, toScreenX, toScreenY, scale, timeSec) {
    const theme = this.level.theme;
    const style = theme?.surfaceStyle || 'yucatan';
    const [skyA, skyB, skyC, bloomCol, mistCol, birdCol] = SKY_PALETTES[style] || SKY_PALETTES.yucatan;
    const skyBotY = Math.max(0, surfY + 2);
    const horizonY = toScreenY(this.level.bounds.yMin + 1.15);
    const parallaxCam = this.camX;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, skyBotY);
    ctx.clip();

    // Base atmospheric gradient beneath panorama (cached per quantized skyBotY + style)
    const airKey = `${style}|${Math.round(skyBotY / 4)}`;
    if (!this._airGradCache || this._airGradCache.key !== airKey) {
      const airGrad = ctx.createLinearGradient(0, 0, 0, Math.max(1, skyBotY));
      airGrad.addColorStop(0, skyA);
      airGrad.addColorStop(0.55, skyB);
      airGrad.addColorStop(1, skyC);
      this._airGradCache = { key: airKey, grad: airGrad };
    }
    ctx.fillStyle = this._airGradCache.grad;
    ctx.fillRect(0, 0, cw, skyBotY);

    // 1. Photorealistic mirror-tiled sky & distant rainforest / cypress canopy panorama
    const img = this.skyBackdropImg;
    if (img && (img.naturalWidth || img.width) > 0) {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const drawH = Math.max(skyBotY + 32, scale * 16.5);
      const tileW = drawH * (iw / ih);
      const anchorY = Math.min(skyBotY, Math.max(drawH * 0.56, horizonY + 1.4 * scale));
      const drawY = Math.min(0, anchorY - drawH * 0.72);
      const finalDrawH = Math.max(drawH, skyBotY - drawY + 4);
      const scrollX = -parallaxCam * 0.06 * scale;
      const firstTile = Math.floor(-scrollX / tileW) - 1;
      const lastTile = Math.ceil((cw - scrollX) / tileW) + 1;

      for (let t = firstTile; t <= lastTile; t++) {
        const dx = scrollX + t * tileW;
        const mirrored = (Math.abs(t) & 1) === 1;
        ctx.save();
        if (mirrored) {
          ctx.translate(dx + tileW, drawY);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0, tileW + 1, finalDrawH);
        } else {
          ctx.drawImage(img, dx, drawY, tileW + 1, finalDrawH);
        }
        ctx.restore();
      }
    }

    // 1b. Animated shimmering Northern Lights (Aurora Borealis) via pre-baked 1x128 stamps (0 gradients/frame)
    if ((style === 'aurora-basalt' || style === 'grjotagja-rift') && this._auroraStamps) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const bandTop = Math.max(4, horizonY - 8 * scale);
      const bandBot = Math.min(skyBotY, horizonY + 0.4 * scale);
      const cols = Math.max(12, Math.min(48, Math.floor(cw / 36)));
      const colW = Math.ceil(cw / cols) + 6;
      for (let ribbon = 0; ribbon < 2; ribbon++) {
        const stamp = this._auroraStamps[ribbon];
        if (!stamp) continue;
        const phase = timeSec * (0.45 + ribbon * 0.2) + ribbon * 2.1;
        for (let c = 0; c < cols; c++) {
          const sx = (c / cols) * cw - ((parallaxCam * (0.025 + ribbon * 0.015) * scale) % 28);
          const wave = Math.sin(c * 0.34 + phase) * 0.5 + 0.5;
          if (wave < 0.22) continue;
          const h = (bandBot - bandTop) * (0.38 + wave * 0.52);
          const y0 = bandTop + Math.sin(c * 0.26 - phase * 0.8) * 14;
          ctx.globalAlpha = 0.24 + wave * 0.72;
          ctx.drawImage(stamp, sx, y0, colW, h);
        }
      }
      ctx.restore();
    }

    // 2. Soft photographic sunlight bloom & delicate diagonal atmospheric light rays (using pre-baked warm stamp)
    const sunScreenX = cw * 0.72 - parallaxCam * 0.03 * scale;
    const sunScreenY = Math.max(18, Math.min(horizonY - 2.2 * scale, skyBotY * 0.26));
    if (this.glowStamps.warm) {
      const sunR = 12 * scale;
      ctx.save();
      ctx.globalAlpha = 0.52;
      ctx.drawImage(this.glowStamps.warm, sunScreenX - sunR, sunScreenY - sunR, sunR * 2, sunR * 2);
      ctx.restore();
    }

    const rayGrad = ctx.createLinearGradient(sunScreenX, sunScreenY, sunScreenX, skyBotY);
    rayGrad.addColorStop(0, 'rgba(255, 249, 224, 0.065)');
    rayGrad.addColorStop(1, 'rgba(255, 249, 224, 0)');
    ctx.fillStyle = rayGrad;
    for (let r = -2; r <= 2; r++) {
      ctx.beginPath();
      ctx.moveTo(sunScreenX, sunScreenY);
      ctx.lineTo(sunScreenX + (r - 0.32) * 85 - 45, skyBotY);
      ctx.lineTo(sunScreenX + (r + 0.32) * 85 + 45, skyBotY);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Low-lying humid forest mist wisps drifting gently above the sinkhole waterline (stamp-based, 0 gradients/frame)
    const mistDrift = -parallaxCam * 0.10 * scale + timeSec * 5.2;
    const mistBaseY = Math.max(horizonY + 0.4 * scale, skyBotY - 2.6 * scale);
    const mistStamp = this.glowStamps.cyan;
    if (mistStamp) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      for (let m = 0; m < 7; m++) {
        const mx = ((m * 260 + mistDrift) % (cw + 380)) - 190;
        const my = mistBaseY + ((m * 29) % 42) - 18;
        const mw = 115 + (m % 3) * 45;
        ctx.drawImage(mistStamp, mx - mw, my - 22, mw * 2, 44);
      }
      ctx.restore();
    }

    // 4. Subtle distant gliding birds in aerial perspective
    ctx.strokeStyle = birdCol;
    ctx.lineWidth = 1.25;
    for (let b = 0; b < 4; b++) {
      const bx = ((cw * 0.25 + b * 145 + timeSec * (11 + b * 2.5) - parallaxCam * 0.05 * scale) % (cw + 120)) - 60;
      const by = Math.max(18, horizonY * (0.34 + b * 0.1) + Math.sin(timeSec * 1.8 + b) * 5);
      const wing = Math.sin(timeSec * 4.8 + b * 1.9) * 3.2;
      ctx.beginPath();
      ctx.moveTo(bx - 5.5, by + wing);
      ctx.quadraticCurveTo(bx - 2.5, by - 2.4, bx, by);
      ctx.quadraticCurveTo(bx + 2.5, by - 2.4, bx + 5.5, by + wing);
      ctx.stroke();
    }

    ctx.restore();
  },

  _drawWaterSurfaceWaves(ctx, cw, toScreenX, toScreenY, scale, timeSec, surfY = toScreenY(0), narcX = 0) {
    ctx.save();
    if (this.level.isWreck) {
      // Continuous open-ocean / Great Lakes surface swells across the entire viewport
      const stepPx = Math.max(12, Math.round(cw / 42));
      const pts = [];
      for (let sx = -stepPx; sx <= cw + stepPx; sx += stepPx) {
        const wx = this.camX + narcX + (sx - cw * 0.5) / scale;
        const wy = Math.sin(wx * 0.65 + timeSec * 2.1) * 0.14 + Math.cos(wx * 1.45 - timeSec * 1.55) * 0.065;
        pts.push([sx, toScreenY(wy), wx]);
      }
      this._strokeWaterMeniscus(ctx, pts, scale, false, timeSec, surfY);
      ctx.restore();
      return;
    }
    const isFlorida = this.level.theme?.id === 'florida-karst';
    for (let b = 0; b < this.level.openBasins.length; b++) {
      const basin = this.level.openBasins[b];
      const xStart = basin.xMin - 2;
      const xEnd = basin.xMax + 2;
      const sx0 = toScreenX(xStart);
      const sx1 = toScreenX(xEnd);
      if (sx1 < 0 || sx0 > cw) continue;

      // Cached static open-water meniscus X-runs per basin (eliminates ~250 static SDF calls/frame)
      let runs = this._waterMeniscusCache.get(b);
      if (!runs) {
        runs = [];
        let cur = [];
        for (let wx = xStart; wx <= xEnd; wx += 0.28) {
          if (evaluateCaveSDF(this.level, wx, 0.05) < 0.04) {
            cur.push(wx);
          } else {
            if (cur.length > 1) runs.push(cur);
            cur = [];
          }
        }
        if (cur.length > 1) runs.push(cur);
        this._waterMeniscusCache.set(b, runs);
      }

      for (let rIdx = 0; rIdx < runs.length; rIdx++) {
        const xs = runs[rIdx];
        const pts = new Array(xs.length);
        for (let i = 0; i < xs.length; i++) {
          const wx = xs[i];
          const wy = Math.sin(wx * 1.15 + timeSec * 2.2) * 0.065 + Math.cos(wx * 2.4 - timeSec * 1.6) * 0.032;
          pts[i] = [toScreenX(wx), toScreenY(wy), wx];
        }
        this._strokeWaterMeniscus(ctx, pts, scale, isFlorida, timeSec, surfY);
      }

      // Subtle skimming dragonflies above sunlit water
      const cx = (basin.xMin + basin.xMax) * 0.5;
      for (let d = 0; d < 2; d++) {
        const dx = cx + Math.sin(timeSec * (1.1 + d * 0.35) + d * 2.1 + b) * (basin.rimHalf * 0.5);
        const dy = -0.75 - d * 0.4 + Math.cos(timeSec * (2.4 + d * 0.4) + d) * 0.18;
        const px = toScreenX(dx);
        const py = toScreenY(dy);
        const wing = Math.sin(timeSec * 36 + d * 4) * 0.08 * scale;
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.85)';
        ctx.lineWidth = Math.max(1, 0.032 * scale);
        ctx.beginPath();
        ctx.moveTo(px - 0.09 * scale, py);
        ctx.lineTo(px + 0.09 * scale, py);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.ellipse(px - 0.045 * scale, py - 0.06 * scale + wing * 0.25, 0.08 * scale, 0.03 * scale, -0.35, 0, Math.PI * 2);
        ctx.ellipse(px + 0.045 * scale, py - 0.06 * scale - wing * 0.25, 0.08 * scale, 0.03 * scale, 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  },

  _strokeWaterMeniscus(ctx, pts, scale, isFlorida, timeSec, surfY = pts[0][1]) {
    // Soft underwater Fresnel sky-mirror reflection immediately under the wavy water surface
    const minX = pts[0][0];
    const maxX = pts[pts.length - 1][0];
    const reflTop = surfY - 0.25 * scale;
    const reflDepth = 1.7 * scale;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[pts.length - 1][0], surfY + reflDepth);
    ctx.lineTo(pts[0][0], surfY + reflDepth);
    ctx.closePath();
    ctx.clip();

    const skyImg = this.skyBackdropImg;
    if (skyImg && (skyImg.naturalWidth || skyImg.width) > 0 && maxX > minX + 4) {
      const iw = skyImg.naturalWidth || skyImg.width;
      const ih = skyImg.naturalHeight || skyImg.height;
      const worldPhase = pts[0][2] ?? 0;
      const waveShift = Math.sin(timeSec * 2.1 + worldPhase * 0.55) * 0.12 * scale;
      ctx.save();
      ctx.globalAlpha = isFlorida ? 0.17 : 0.24;
      ctx.translate(0, reflTop * 2 + reflDepth);
      ctx.scale(1, -1);
      ctx.drawImage(
        skyImg,
        0,
        ih * 0.56,
        iw,
        ih * 0.44,
        minX - 8 + waveShift,
        reflTop,
        maxX - minX + 16,
        reflDepth
      );
      ctx.restore();
    }

    const fresnelGrad = ctx.createLinearGradient(0, reflTop, 0, reflTop + reflDepth);
    fresnelGrad.addColorStop(0, isFlorida ? 'rgba(245, 224, 180, 0.22)' : 'rgba(218, 242, 252, 0.24)');
    fresnelGrad.addColorStop(0.5, isFlorida ? 'rgba(220, 198, 152, 0.08)' : 'rgba(125, 211, 252, 0.09)');
    fresnelGrad.addColorStop(1, 'rgba(14, 116, 144, 0)');
    ctx.fillStyle = fresnelGrad;
    ctx.fillRect(minX - 4, reflTop - 2, maxX - minX + 8, reflDepth + 6);
    ctx.restore();

    // Fine broken specular sky/sun glints instead of a thick uniform solid stripe
    ctx.strokeStyle = isFlorida ? 'rgba(255, 244, 214, 0.52)' : 'rgba(240, 250, 255, 0.58)';
    ctx.lineWidth = Math.max(1.2, 0.065 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 250, 0.74)';
    for (let i = 0; i < pts.length - 1; i += 2) {
      const shimmer = Math.sin(pts[i][2] * 3.1 + timeSec * 4.5);
      if (shimmer > 0.22) {
        ctx.fillRect(pts[i][0], pts[i][1] - 0.025 * scale, (0.28 + shimmer * 0.26) * scale, Math.max(1, 0.045 * scale));
      }
    }
  },

  _findBasinCliffEdgeX(basin, wy, side) {
    const key = `${basin.xMin}|${Math.round(wy * 20)}|${side}`;
    const cached = this._basinEdgeCache.get(key);
    if (cached !== undefined) return cached;
    const cx = (basin.xMin + basin.xMax) * 0.5;
    const maxOffset = (basin.rimHalf || 5.2) + 6.5;
    let found = cx + side * (basin.rimHalf || 5.2);
    for (let off = 1.0; off <= maxOffset; off += 0.25) {
      const wx = cx + side * off;
      if (evaluateCaveSDF(this.level, wx, wy) > 0.05) {
        found = wx;
        break;
      }
    }
    this._basinEdgeCache.set(key, found);
    return found;
  },

  _sampleSurfaceFooting(level, wx, halfWidthM = 1.2) {
    const gyL = this._getHorizonGroundY(level, wx - halfWidthM);
    const gyC = this._getHorizonGroundY(level, wx);
    const gyR = this._getHorizonGroundY(level, wx + halfWidthM);
    const gyHigh = Math.min(gyL, gyC, gyR);
    const gyDeep = Math.max(gyL, gyC, gyR);
    const slopeRad = Math.atan2(gyR - gyL, Math.max(0.05, halfWidthM * 2));
    return { gyL, gyC, gyR, gyHigh, gyDeep, slopeRad };
  },

  _getSurfaceBiomeSoilPalette() {
    const style = this.level.theme?.surfaceStyle || 'yucatan';
    return SURFACE_SOIL_PALETTES[style] || SURFACE_SOIL_PALETTES.yucatan;
  },

  _drawGroundContactShadow(ctx, x, y, width, scale, slopeRad = 0) {
    ctx.save();
    ctx.translate(x, y + 0.03 * scale);
    if (slopeRad) ctx.rotate(slopeRad * 0.72);
    const grad = ctx.createRadialGradient(0, 0, width * 0.1, 0, 0, width);
    grad.addColorStop(0, 'rgba(8, 12, 8, 0.56)');
    grad.addColorStop(0.65, 'rgba(8, 12, 8, 0.24)');
    grad.addColorStop(1, 'rgba(8, 12, 8, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, width, 0.18 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  _drawContouredFoundation(ctx, toScreenX, toScreenY, scale, wx, halfW, floorWy, opts = {}) {
    const xL = toScreenX(wx - halfW);
    const xR = toScreenX(wx + halfW);
    const yTop = toScreenY(floorWy);
    const embedM = opts.embedM ?? 0.22;
    const steps = opts.steps ?? 8;
    const pal = this._getSurfaceBiomeSoilPalette();
    const stoneTop = opts.stoneTop || '#9b9382';
    const stoneBot = opts.stoneBot || '#575044';

    ctx.save();
    // Contoured retaining wall / masonry plinth whose base hugs the terrain curve seamlessly
    ctx.beginPath();
    ctx.moveTo(xL, yTop);
    ctx.lineTo(xR, yTop);
    const bottomPts = [];
    for (let i = steps; i >= 0; i--) {
      const sxWorld = wx - halfW + (halfW * 2 * i) / steps;
      const syWorld = this._getHorizonGroundY(this.level, sxWorld) + embedM;
      const pt = [toScreenX(sxWorld), toScreenY(Math.max(floorWy + 0.12, syWorld))];
      bottomPts.push(pt);
      ctx.lineTo(pt[0], pt[1]);
    }
    ctx.closePath();

    const maxBotY = bottomPts.reduce((m, p) => Math.max(m, p[1]), yTop + 0.3 * scale);
    const fGrad = ctx.createLinearGradient(xL, yTop, xL, maxBotY);
    fGrad.addColorStop(0, stoneTop);
    fGrad.addColorStop(0.32, opts.stoneMid || '#7b7365');
    fGrad.addColorStop(1, stoneBot);
    ctx.fillStyle = fGrad;
    ctx.fill();

    // Clip stone masonry courses & real photographic stone grain inside the foundation contour
    ctx.save();
    ctx.clip();
    const rockPat = this._getTintedRockPattern(ctx, this.level, this.rockTex);
    if (rockPat) {
      ctx.save();
      if (typeof DOMMatrix !== 'undefined' && rockPat.setTransform) {
        const ps = Math.max(0.08, scale / (CACHE_PX_PER_M * 1.4));
        rockPat.setTransform(new DOMMatrix().translate(xL, yTop).scale(ps, ps));
      }
      ctx.globalAlpha = 0.48;
      ctx.fillStyle = rockPat;
      ctx.fillRect(xL, yTop, xR - xL, maxBotY - yTop + 4);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(12, 16, 12, 0.34)';
    ctx.fillRect(xL, yTop, xR - xL, 0.08 * scale);
    ctx.strokeStyle = 'rgba(20, 22, 18, 0.28)';
    ctx.lineWidth = Math.max(1, 0.032 * scale);
    const courseStep = 0.22 * scale;
    for (let cy = yTop + courseStep; cy < maxBotY; cy += courseStep) {
      ctx.beginPath();
      ctx.moveTo(xL, cy);
      ctx.lineTo(xR, cy);
      ctx.stroke();
      const rowIdx = Math.round((cy - yTop) / courseStep);
      const colStep = 0.44 * scale;
      for (let cx = xL + ((rowIdx & 1) ? colStep * 0.5 : 0); cx < xR; cx += colStep) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - courseStep);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }
    }
    // Earthy humus & grass collar along the bottom terrain intersection
    ctx.strokeStyle = pal.soil;
    ctx.lineWidth = Math.max(2.5, 0.18 * scale);
    ctx.beginPath();
    for (let i = 0; i < bottomPts.length; i++) {
      if (i === 0) ctx.moveTo(bottomPts[i][0], bottomPts[i][1] - 0.04 * scale);
      else ctx.lineTo(bottomPts[i][0], bottomPts[i][1] - 0.04 * scale);
    }
    ctx.stroke();
    ctx.restore();

    // Crisp stone coping / timber threshold beam along top edge of foundation
    ctx.fillStyle = opts.capColor || 'rgba(255, 250, 238, 0.16)';
    ctx.fillRect(xL - 0.04 * scale, yTop - 0.04 * scale, xR - xL + 0.08 * scale, 0.07 * scale);
    ctx.restore();

    // Foreground tufts & anchored base pebbles hiding the exact hill-to-wall contact line
    if (opts.berm !== false) {
      this._drawContouredBermSkirt(ctx, toScreenX, toScreenY, scale, wx, halfW * 1.06, opts);
    }
  },

  _drawContouredBermSkirt(ctx, toScreenX, toScreenY, scale, wx, halfW, opts = {}) {
    const pal = this._getSurfaceBiomeSoilPalette();
    const tufts = opts.tufts ?? 7;
    ctx.save();
    for (let i = 0; i < tufts; i++) {
      const t = tufts === 1 ? 0.5 : i / (tufts - 1);
      const sxWorld = wx - halfW + halfW * 2 * t;
      const syWorld = this._getHorizonGroundY(this.level, sxWorld);
      const sx = toScreenX(sxWorld);
      const sy = toScreenY(syWorld);
      const hFrac = Math.abs(Math.sin(sxWorld * 12.7 + i * 3.1));

      if (opts.stones !== false && (i % 2 === 0)) {
        const rx = (0.16 + hFrac * 0.14) * scale;
        const ry = (0.08 + hFrac * 0.06) * scale;
        ctx.fillStyle = pal.stone;
        ctx.beginPath();
        ctx.ellipse(sx, sy + 0.02 * scale, rx, ry, 0, Math.PI * 0.95, Math.PI * 2.05);
        ctx.fill();
      }
      ctx.strokeStyle = opts.tuftColor || pal.tuft;
      ctx.lineWidth = Math.max(1, 0.042 * scale);
      for (let b = -1; b <= 1; b++) {
        const bladeH = (0.18 + hFrac * 0.18) * scale;
        ctx.beginPath();
        ctx.moveTo(sx + b * 0.05 * scale, sy + 0.05 * scale);
        ctx.quadraticCurveTo(
          sx + b * 0.09 * scale,
          sy - bladeH * 0.55,
          sx + b * 0.14 * scale,
          sy - bladeH
        );
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  _drawFlaredTreeCollar(ctx, toScreenX, toScreenY, wx, x, groundY, trunkR, scale, barkColors, opts = {}) {
    const halfSpan = Math.max(0.55, (trunkR / Math.max(1, scale)) * 3.0);
    const foot = this._sampleSurfaceFooting(this.level, wx, halfSpan);
    const pal = this._getSurfaceBiomeSoilPalette();
    this._drawGroundContactShadow(ctx, x, groundY, trunkR * 4.4, scale, foot.slopeRad);

    const spread = trunkR * (opts.rootSpread ?? 2.35);
    const downSlopeDrop = Math.max(0.14 * scale, Math.abs(Math.sin(foot.slopeRad)) * spread * 1.15 + 0.14 * scale);
    const topFlareY = groundY - trunkR * 2.2;
    const baseLY = groundY + (foot.gyL - foot.gyC) * scale + downSlopeDrop * 0.5;
    const baseRY = groundY + (foot.gyR - foot.gyC) * scale + downSlopeDrop * 0.5;
    const baseCY = groundY + downSlopeDrop * 0.65;

    ctx.save();
    const rg = ctx.createLinearGradient(x - spread, groundY, x + spread, groundY);
    rg.addColorStop(0, barkColors[0]);
    rg.addColorStop(0.5, barkColors[1] || barkColors[0]);
    rg.addColorStop(1, barkColors[2] || barkColors[1] || barkColors[0]);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(x - trunkR * 0.96, topFlareY);
    ctx.quadraticCurveTo(x - trunkR * 1.15, groundY - trunkR * 0.45, x - spread, baseLY);
    ctx.quadraticCurveTo(x - spread * 0.35, baseCY + 0.04 * scale, x, baseCY);
    ctx.quadraticCurveTo(x + spread * 0.35, baseCY + 0.04 * scale, x + spread, baseRY);
    ctx.quadraticCurveTo(x + trunkR * 1.15, groundY - trunkR * 0.45, x + trunkR * 0.96, topFlareY);
    ctx.closePath();
    ctx.fill();

    // Subtle dark root-crevasse line down center flare
    ctx.strokeStyle = 'rgba(14, 10, 8, 0.34)';
    ctx.lineWidth = Math.max(1, trunkR * 0.22);
    ctx.beginPath();
    ctx.moveTo(x - trunkR * 0.15, topFlareY + trunkR * 0.6);
    ctx.quadraticCurveTo(x - trunkR * 0.3, groundY - trunkR * 0.1, x - trunkR * 0.7, baseCY - 0.03 * scale);
    ctx.stroke();

    // Basal grass / humus mound hiding where root meets ground curve
    this._drawContouredBermSkirt(ctx, toScreenX, toScreenY, scale, wx, Math.max(0.45, spread / Math.max(1, scale)), {
      tufts: 5,
      stones: false,
      tuftColor: opts.tuftColor || pal.tuft,
    });
    ctx.restore();
  },

  _drawAnchoredBoulder(ctx, wx, rxM, ryM, toScreenX, toScreenY, scale, color) {
    const foot = this._sampleSurfaceFooting(this.level, wx, rxM * 0.9);
    const pal = this._getSurfaceBiomeSoilPalette();
    const gx = toScreenX(wx);
    const gy = toScreenY(Math.max(foot.gyC, (foot.gyL + foot.gyR) * 0.5)) + 0.14 * scale;
    const rx = rxM * scale;
    const ry = ryM * scale * 1.15;

    this._drawGroundContactShadow(ctx, gx, gy - 0.04 * scale, rx * 1.18, scale, foot.slopeRad);
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(foot.slopeRad * 0.78);
    // Natural angular rock facet silhouette embedded cleanly down into soil
    const rGrad = ctx.createLinearGradient(0, -ry, 0, 0.08 * scale);
    rGrad.addColorStop(0, color);
    rGrad.addColorStop(0.68, color);
    rGrad.addColorStop(1, pal.soil);
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.moveTo(-rx * 0.98, 0.06 * scale);
    ctx.lineTo(-rx * 0.84, -ry * 0.54);
    ctx.lineTo(-rx * 0.34, -ry * 0.96);
    ctx.lineTo(rx * 0.28, -ry * 0.92);
    ctx.lineTo(rx * 0.82, -ry * 0.48);
    ctx.lineTo(rx * 0.98, 0.06 * scale);
    ctx.closePath();
    ctx.fill();
    // Photographic stone texture overlay so surface boulders match cliff limestone/basalt
    const rockPat = this._getTintedRockPattern(ctx, this.level, this.rockTex);
    if (rockPat) {
      ctx.save();
      ctx.clip();
      if (typeof DOMMatrix !== 'undefined' && rockPat.setTransform) {
        const ps = Math.max(0.08, scale / (CACHE_PX_PER_M * 1.35));
        rockPat.setTransform(new DOMMatrix().scale(ps, ps));
      }
      ctx.globalAlpha = 0.52;
      ctx.fillStyle = rockPat;
      ctx.fillRect(-rx, -ry, rx * 2, ry + 0.12 * scale);
      ctx.restore();
    }
    // Subtle shaded bevel on left shoulder + sun catchlight on crown
    ctx.fillStyle = 'rgba(255, 250, 236, 0.16)';
    ctx.beginPath();
    ctx.moveTo(-rx * 0.34, -ry * 0.96);
    ctx.lineTo(rx * 0.28, -ry * 0.92);
    ctx.lineTo(rx * 0.72, -ry * 0.48);
    ctx.lineTo(-rx * 0.05, -ry * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    this._drawContouredBermSkirt(ctx, toScreenX, toScreenY, scale, wx, rxM * 0.82, {
      tufts: 4,
      stones: false,
    });
  },

  _fillFoliageCluster(ctx, cx, cy, rx, ry, rot, scale, tone = 'jungle', sunSide = 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    // Organic ruffled botanical canopy silhouette (irregular leaf boundary, never a smooth oval)
    ctx.beginPath();
    const lobes = 14;
    for (let i = 0; i <= lobes; i++) {
      const a = (i / lobes) * Math.PI * 2;
      const rMod = 0.86 + Math.sin(i * 2.7 + cx * 0.1) * 0.14 + Math.cos(i * 4.1) * 0.08;
      const px = Math.cos(a) * rx * rMod;
      const py = Math.sin(a) * ry * rMod;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Base rich forest shadow + real photographic foliage texture pattern if available
    ctx.fillStyle = tone === 'pine' ? '#1c311c' : tone === 'cypress' ? '#2c3d22' : '#18331c';
    ctx.fill();
    if (this.foliagePattern) {
      ctx.save();
      const patScale = Math.max(0.08, scale * 0.0085);
      if (typeof DOMMatrix !== 'undefined' && this.foliagePattern.setTransform) {
        this.foliagePattern.setTransform(new DOMMatrix().scale(patScale, patScale));
      }
      ctx.globalAlpha = tone === 'cypress' ? 0.68 : 0.88;
      ctx.fillStyle = this.foliagePattern;
      ctx.fill();
      ctx.restore();
    }

    // Directional sun-to-shadow shading (sun from top-right, deep AO underside)
    const shadeGrad = ctx.createLinearGradient(-rx * 0.6 * sunSide, ry, rx * 0.6 * sunSide, -ry);
    shadeGrad.addColorStop(0, 'rgba(6, 12, 8, 0.56)');
    shadeGrad.addColorStop(0.55, tone === 'cypress' ? 'rgba(92, 108, 62, 0.18)' : 'rgba(20, 42, 22, 0.08)');
    shadeGrad.addColorStop(1, tone === 'cypress' ? 'rgba(206, 212, 148, 0.24)' : 'rgba(182, 214, 134, 0.24)');
    ctx.fillStyle = shadeGrad;
    ctx.fill();
    ctx.restore();
  },

  _drawTaperedCurvedTrunk(ctx, x0, y0, cx, cy, x1, y1, rBase, rTop, segs, colors, addRings = false) {
    const leftPts = [];
    const rightPts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const omt = 1 - t;
      const px = omt * omt * x0 + 2 * omt * t * cx + t * t * x1;
      const py = omt * omt * y0 + 2 * omt * t * cy + t * t * y1;
      const tx = 2 * omt * (cx - x0) + 2 * t * (x1 - cx);
      const ty = 2 * omt * (cy - y0) + 2 * t * (y1 - cy);
      const tLen = Math.hypot(tx, ty) || 1;
      const nx = -ty / tLen;
      const ny = tx / tLen;
      const rad = rBase + (rTop - rBase) * t;
      leftPts.push([px - nx * rad, py - ny * rad, px, py, nx, ny, rad]);
      rightPts.push([px + nx * rad, py + ny * rad]);
    }

    const grad = ctx.createLinearGradient(x0 - rBase, y0, x1 + rBase, y0);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.45, colors[1]);
    grad.addColorStop(1, colors[2]);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(leftPts[0][0], leftPts[0][1]);
    for (let i = 1; i < leftPts.length; i++) ctx.lineTo(leftPts[i][0], leftPts[i][1]);
    for (let i = rightPts.length - 1; i >= 0; i--) ctx.lineTo(rightPts[i][0], rightPts[i][1]);
    ctx.closePath();
    ctx.fill();

    if (addRings) {
      ctx.strokeStyle = 'rgba(26, 18, 12, 0.34)';
      ctx.lineWidth = Math.max(1, rBase * 0.14);
      for (let i = 1; i < leftPts.length - 1; i++) {
        const p = leftPts[i];
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.quadraticCurveTo(p[2], p[3] + p[6] * 0.25, rightPts[i][0], rightPts[i][1]);
        ctx.stroke();
      }
    }
  },

  _drawCliffStairs(ctx, topX, topY, botX, botY, scale, isWood = true) {
    const dx = botX - topX;
    const dy = botY - topY;
    const steps = Math.max(7, Math.round(Math.hypot(dx, dy) / (0.58 * scale)));
    const railH = 0.72 * scale;

    ctx.save();
    // Anchor stone / timber landing pad at cliff lip so stairs tie solidly into terrain
    ctx.fillStyle = isWood ? '#574838' : '#58626e';
    ctx.beginPath();
    ctx.roundRect(topX - 0.34 * scale, topY - 0.04 * scale, 0.68 * scale, 0.24 * scale, 0.05 * scale);
    ctx.fill();

    // Subtle dark cliff shadow behind stair stringer
    ctx.strokeStyle = 'rgba(10, 12, 10, 0.38)';
    ctx.lineWidth = Math.max(3, 0.18 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(topX + 0.05 * scale, topY + 0.08 * scale);
    ctx.lineTo(botX + 0.05 * scale, botY + 0.08 * scale);
    ctx.stroke();

    // Weathered timber / galvanized steel stair stringer
    ctx.strokeStyle = isWood ? '#4f3b2b' : '#525c68';
    ctx.lineWidth = Math.max(2, 0.11 * scale);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(botX, botY);
    ctx.stroke();

    // Handrail uprights + taut hemp rope / cable handrail (top post deeply anchored)
    ctx.strokeStyle = isWood ? '#634d39' : '#6e7985';
    ctx.lineWidth = Math.max(1.4, 0.065 * scale);
    const postCount = 4;
    ctx.beginPath();
    for (let p = 0; p <= postCount; p++) {
      const t = p / postCount;
      const px = topX + dx * t;
      const py = topY + dy * t;
      ctx.moveTo(px, py + (p === 0 ? 0.14 * scale : 0));
      ctx.lineTo(px, py - railH);
    }
    ctx.stroke();

    ctx.strokeStyle = isWood ? '#a89a82' : '#9ca7b4';
    ctx.lineWidth = Math.max(1.2, 0.048 * scale);
    ctx.beginPath();
    ctx.moveTo(topX, topY - railH);
    ctx.lineTo(botX, botY - railH);
    ctx.stroke();

    // Shaded weathered treads with underside thickness shadow
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      const sx = topX + dx * t;
      const sy = topY + dy * t;
      ctx.fillStyle = isWood ? '#3d2c1e' : '#475569';
      ctx.fillRect(sx - 0.25 * scale, sy, 0.5 * scale, 0.09 * scale);
      ctx.fillStyle = isWood ? '#846b50' : '#aeb9c4';
      ctx.fillRect(sx - 0.25 * scale, sy - 0.05 * scale, 0.5 * scale, 0.055 * scale);
    }
    ctx.restore();
  },

  /**
   * Renders a photorealistic transparent botanical tree cutout planted into terrain slope
   * with natural contact shadow, subtle wind-sway shear around the trunk base, and optional flip.
   */
  _drawPhotoTree(ctx, key, wx, toScreenX, toScreenY, scale, sway, heightM = 5.4, opts = {}) {
    const img = this._getSurfaceProp(key);
    if (!img) return false;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return false;

    const foot = this._sampleSurfaceFooting(this.level, wx, 0.85);
    const gx = toScreenX(wx);
    const groundY = toScreenY(foot.gyC);
    const h = heightM * scale * (opts.heightScale || 1.0);
    const w = h * (iw / ih) * (opts.widthScale || 1.0);
    const embed = (opts.embedM ?? 0.22) * scale + Math.abs(Math.sin(foot.slopeRad)) * 0.22 * scale;
    const flip = opts.flipX ? -1 : 1;
    const shear = Math.max(-0.075, Math.min(0.075, (sway / Math.max(24, h)) * 0.72));

    this._drawGroundContactShadow(ctx, gx, groundY + 0.06 * scale, Math.max(0.75 * scale, w * 0.28), scale, foot.slopeRad);

    ctx.save();
    ctx.translate(gx, groundY + embed);
    ctx.transform(1, 0, shear, 1, 0, 0);
    if (flip < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -w * 0.5, -h, w, h);
    ctx.restore();

    if (opts.berm !== false) {
      this._drawContouredBermSkirt(ctx, toScreenX, toScreenY, scale, wx, Math.min(1.0, Math.max(0.45, (w / Math.max(1, scale)) * 0.22)), {
        tufts: 4,
        stones: false,
      });
    }
    return true;
  },

  /**
   * Renders a photorealistic transparent surface structure (palapa, cabin, bathhouse, research dome)
   * anchored onto a stone-textured contoured retaining plinth matching the uneven cliff slope.
   */
  _drawPhotoBuilding(ctx, key, wx, toScreenX, toScreenY, scale, widthM = 4.2, opts = {}) {
    const img = this._getSurfaceProp(key);
    if (!img) return false;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return false;

    const halfW = widthM * 0.48;
    const foot = this._sampleSurfaceFooting(this.level, wx, halfW);
    const floorWy = Math.min(foot.gyC, foot.gyHigh + 0.05);
    const gx = toScreenX(wx);
    const groundY = toScreenY(floorWy);
    const w = widthM * scale;
    const h = w * (ih / iw);
    const embed = (opts.embedM ?? 0.14) * scale;

    this._drawGroundContactShadow(ctx, gx, toScreenY(foot.gyC) + 0.08 * scale, w * 0.56, scale, foot.slopeRad);
    if (opts.foundation !== false) {
      this._drawContouredFoundation(ctx, toScreenX, toScreenY, scale, wx, halfW * 0.94, floorWy - 0.06, {
        stoneTop: opts.stoneTop || '#8f8778',
        stoneMid: opts.stoneMid || '#6c6558',
        stoneBot: opts.stoneBot || '#464139',
        capColor: opts.capColor || 'rgba(255, 248, 232, 0.16)',
        tufts: 5,
        berm: false,
      });
    }

    ctx.save();
    ctx.drawImage(img, gx - w * 0.5, groundY - h + embed, w, h);
    ctx.restore();

    this._drawContouredBermSkirt(ctx, toScreenX, toScreenY, scale, wx, halfW * 0.96, {
      tufts: 6,
      stones: true,
    });
    return true;
  },

  _drawBotanicalPalm(ctx, wx, toScreenX, toScreenY, scale, leanDir, sway, heightM = 4.6) {
    if (
      this._drawPhotoTree(ctx, 'palm', wx, toScreenX, toScreenY, scale, sway, heightM * 1.18, {
        flipX: leanDir < 0,
        embedM: 0.24,
      })
    ) {
      return;
    }
    const x = toScreenX(wx);
    const groundY = toScreenY(this._getHorizonGroundY(this.level, wx));
    const h = heightM * scale;
    const topX = x + leanDir * (0.28 * h) + sway * 0.85;
    const topY = groundY - h;
    const ctrlX = x + leanDir * (0.04 * h);
    const ctrlY = groundY - h * 0.52;

    this._drawTaperedCurvedTrunk(
      ctx,
      x,
      groundY + 0.06 * scale,
      ctrlX,
      ctrlY,
      topX,
      topY,
      0.21 * scale,
      0.085 * scale,
      14,
      ['#3b2b1e', '#69533f', '#8c765c'],
      true
    );
    this._drawFlaredTreeCollar(ctx, toScreenX, toScreenY, wx, x, groundY, 0.21 * scale, scale, ['#3b2b1e', '#594534', '#7a644e'], {
      rootSpread: 2.1,
    });

    // Shaded coconut cluster tucked into crown base
    for (let c = -1; c <= 1; c++) {
      const cx = topX + c * 0.14 * scale;
      const cy = topY + 0.18 * scale;
      const cg = ctx.createRadialGradient(cx + 0.04 * scale, cy - 0.04 * scale, 0.02 * scale, cx, cy, 0.14 * scale);
      cg.addColorStop(0, '#6a4a24');
      cg.addColorStop(1, '#2a1a0c');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, 0.13 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Two layers of pinnate palm fronds: shaded deep fronds behind sunlit textured feathered blades
    const frondCount = 10;
    for (let f = 0; f < frondCount; f++) {
      const frac = f / (frondCount - 1);
      const ang = -Math.PI * 1.15 + frac * Math.PI * 1.3 + (leanDir < 0 ? -0.1 : 0.1);
      const flen = (1.85 + (f % 3) * 0.34) * scale;
      const midX = topX + Math.cos(ang) * flen * 0.52 + sway * 0.7;
      const midY = topY + Math.sin(ang) * flen * 0.62 - 0.18 * scale;
      const tipX = topX + Math.cos(ang) * flen + sway * 1.35;
      const tipY = topY + Math.sin(ang) * flen * 0.28 + 0.55 * scale;
      const isBack = f % 3 === 0;

      // Build serrated feathered palm leaf silhouette (natural organic tapering blade, not thin stick)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      const steps = 10;
      const upper = [];
      const lower = [];
      for (let s = 1; s <= steps; s++) {
        const st = s / steps;
        const omt = 1 - st;
        const px = omt * omt * topX + 2 * omt * st * midX + st * st * tipX;
        const py = omt * omt * topY + 2 * omt * st * midY + st * st * tipY;
        const width = Math.sin(st * Math.PI) * 0.28 * scale;
        const notch = (s & 1) ? 1.0 : 0.48;
        upper.push([px, py - width * 0.35 * notch]);
        lower.push([px + (Math.cos(ang) >= 0 ? 0.08 : -0.08) * scale, py + width * notch]);
      }
      for (const p of upper) ctx.lineTo(p[0], p[1]);
      for (let i = lower.length - 1; i >= 0; i--) ctx.lineTo(lower[i][0], lower[i][1]);
      ctx.closePath();

      ctx.fillStyle = isBack ? '#162d18' : '#264c24';
      ctx.fill();
      if (this.foliagePattern && !isBack) {
        if (typeof DOMMatrix !== 'undefined' && this.foliagePattern.setTransform) {
          const ps = Math.max(0.08, scale * 0.008);
          this.foliagePattern.setTransform(new DOMMatrix().scale(ps, ps));
        }
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = this.foliagePattern;
        ctx.fill();
      }
      ctx.restore();

      // Sunlit center rib (rachis)
      ctx.strokeStyle = isBack ? 'rgba(42, 68, 36, 0.7)' : 'rgba(138, 166, 86, 0.78)';
      ctx.lineWidth = Math.max(1, 0.035 * scale);
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();
    }
  },

  _drawTropicalUnderbrush(ctx, wx, toScreenX, toScreenY, scale, sway, dir) {
    const foot = this._sampleSurfaceFooting(this.level, wx, 0.8);
    const x = toScreenX(wx);
    const groundY = toScreenY(foot.gyC);
    if (this._getSurfaceProp('palm')) {
      // Photorealistic palms already carry rich fern/bromeliad root clusters; add subtle textured ground cover only
      this._drawGroundContactShadow(ctx, x, groundY + 0.05 * scale, 0.85 * scale, scale, foot.slopeRad);
      this._drawContouredBermSkirt(ctx, toScreenX, toScreenY, scale, wx, 0.9, { tufts: 6, stones: true });
      return;
    }
    const gyLeft = toScreenY(this._getHorizonGroundY(this.level, wx - 0.35));
    const gyRight = toScreenY(this._getHorizonGroundY(this.level, wx + 0.38));
    this._drawGroundContactShadow(ctx, x, groundY + 0.05 * scale, 1.05 * scale, scale, foot.slopeRad);
    // Layered textured fern & jungle undergrowth mass seated gently into hillside slope
    this._fillFoliageCluster(ctx, x - 0.35 * scale, gyLeft - 0.22 * scale, 0.75 * scale, 0.42 * scale, -0.15 + foot.slopeRad * 0.5, scale, 'jungle', dir);
    this._fillFoliageCluster(ctx, x + 0.38 * scale + sway * 0.4, gyRight - 0.28 * scale, 0.82 * scale, 0.48 * scale, 0.14 + foot.slopeRad * 0.5, scale, 'jungle', dir);

    // Subtle organic arching fern fronds (no neon lines)
    for (let f = 0; f < 5; f++) {
      const ang = -Math.PI * 0.88 + (f / 4) * Math.PI * 0.76;
      const len = (1.05 + (f % 2) * 0.38) * scale;
      ctx.strokeStyle = f % 2 === 0 ? '#274a24' : '#3a6230';
      ctx.lineWidth = Math.max(1.4, 0.065 * scale);
      ctx.beginPath();
      ctx.moveTo(x, groundY + 0.08 * scale);
      ctx.quadraticCurveTo(
        x + Math.cos(ang) * len * 0.55 + sway * 0.5,
        groundY + Math.sin(ang) * len * 0.82,
        x + Math.cos(ang) * len + sway,
        groundY + Math.sin(ang) * len * 0.45
      );
      ctx.stroke();
    }

    // Natural muted coral/terracotta wild heliconia blooms tucked into foliage
    for (const [ox, oy, col] of [
      [-0.42 * dir, -0.42, '#b84a48'],
      [0.32 * dir, -0.54, '#c26b36'],
    ]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x + ox * scale + sway * 0.4, groundY + oy * scale, 0.095 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    this._drawContouredBermSkirt(ctx, toScreenX, toScreenY, scale, wx, 0.85, { tufts: 5, stones: false });
  },

  _drawPalapaPavilion(ctx, wx, toScreenX, toScreenY, scale, variant = 'entry') {
    if (
      this._drawPhotoBuilding(ctx, 'palapa', wx, toScreenX, toScreenY, scale, 4.4, {
        stoneTop: '#a39b8a',
        stoneMid: '#7d7567',
        stoneBot: '#564f44',
        embedM: 0.16,
      })
    ) {
      return;
    }
    const wM = 3.2;
    const foot = this._sampleSurfaceFooting(this.level, wx, wM * 0.52);
    const floorWy = Math.min(foot.gyC, foot.gyHigh + 0.05);
    const x = toScreenX(wx);
    const groundY = toScreenY(floorWy);
    const w = wM * scale;
    const h = 2.05 * scale;
    const roofH = 1.5 * scale;

    this._drawGroundContactShadow(ctx, x, toScreenY(foot.gyC) + 0.08 * scale, w * 0.64, scale, foot.slopeRad);

    // Contoured limestone retaining plinth extending solidly into uneven ground slope
    this._drawContouredFoundation(ctx, toScreenX, toScreenY, scale, wx, wM * 0.52, floorWy - 0.14, {
      stoneTop: '#a39b8a',
      stoneMid: '#7d7567',
      stoneBot: '#564f44',
      capColor: 'rgba(255, 248, 232, 0.2)',
    });

    // Recessed shaded interior beneath the thatch roof
    ctx.fillStyle = 'rgba(18, 22, 16, 0.72)';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.46, groundY - 0.14 * scale);
    ctx.lineTo(x - w * 0.42, groundY - h + 0.1 * scale);
    ctx.lineTo(x, groundY - h - roofH * 0.5);
    ctx.lineTo(x + w * 0.42, groundY - h + 0.1 * scale);
    ctx.lineTo(x + w * 0.46, groundY - 0.14 * scale);
    ctx.closePath();
    ctx.fill();

    // Shaded rough-hewn timber corner posts seated solidly on the plinth sill
    for (const px of [x - w * 0.42, x + w * 0.42 - 0.16 * scale]) {
      const pg = ctx.createLinearGradient(px, groundY, px + 0.16 * scale, groundY);
      pg.addColorStop(0, '#3a2a1d');
      pg.addColorStop(0.55, '#664d36');
      pg.addColorStop(1, '#4c3826');
      ctx.fillStyle = pg;
      ctx.fillRect(px, groundY - h, 0.16 * scale, h - 0.1 * scale);
    }
    // Horizontal eaves tie beam across posts
    ctx.fillStyle = '#4b3726';
    ctx.fillRect(x - w * 0.45, groundY - h + 0.05 * scale, w * 0.9, 0.1 * scale);

    // Weathered timber gear table inside palapa
    ctx.fillStyle = '#5c4632';
    ctx.fillRect(x - w * 0.34, groundY - 0.72 * scale, w * 0.68, 0.12 * scale);
    ctx.fillStyle = '#3b2b1e';
    ctx.fillRect(x - w * 0.28, groundY - 0.6 * scale, 0.1 * scale, 0.46 * scale);
    ctx.fillRect(x + w * 0.28 - 0.1 * scale, groundY - 0.6 * scale, 0.1 * scale, 0.46 * scale);

    if (variant === 'entry') {
      // Natural brushed aluminum & muted mustard dive tanks staged in shade
      for (const [tx, col] of [[-0.55, '#b89432'], [-0.22, '#9ba3a8'], [0.24, '#366f7d']]) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(x + tx * scale, groundY - 1.26 * scale, 0.2 * scale, 0.54 * scale, 0.07 * scale);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
        ctx.fillRect(x + (tx + 0.12) * scale, groundY - 1.22 * scale, 0.05 * scale, 0.46 * scale);
        ctx.fillStyle = '#2c353d';
        ctx.fillRect(x + (tx + 0.05) * scale, groundY - 1.36 * scale, 0.1 * scale, 0.1 * scale);
      }
    } else {
      // Field hydro-logger & warm oil lantern
      ctx.fillStyle = '#29323a';
      ctx.fillRect(x - 0.42 * scale, groundY - 1.18 * scale, 0.56 * scale, 0.46 * scale);
      ctx.fillStyle = '#4f8699';
      ctx.fillRect(x - 0.36 * scale, groundY - 1.12 * scale, 0.44 * scale, 0.3 * scale);
      ctx.fillStyle = '#e6be5a';
      ctx.beginPath();
      ctx.arc(x + 0.52 * scale, groundY - 0.9 * scale, 0.1 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Realistic sun-dried layered palm-thatch A-frame roof with ragged straw eaves
    for (let layer = 0; layer < 4; layer++) {
      const ly = groundY - h + (0.3 - layer * 0.22) * scale;
      const lw = w * (1.3 - layer * 0.14);
      const peakY = groundY - h - roofH + layer * 0.13 * scale;
      const tGrad = ctx.createLinearGradient(x - lw * 0.5, ly, x + lw * 0.5, peakY);
      tGrad.addColorStop(0, layer === 0 ? '#4e3c24' : '#634d2e');
      tGrad.addColorStop(0.55, layer === 3 ? '#9a7e50' : '#7b613c');
      tGrad.addColorStop(1, '#ad905e');
      ctx.fillStyle = tGrad;
      ctx.beginPath();
      ctx.moveTo(x - lw * 0.55, ly);
      ctx.lineTo(x, peakY);
      ctx.lineTo(x + lw * 0.55, ly);
      // Jagged natural dried-palm thatch fringe along the lower roof eave
      const teeth = 14;
      for (let t = teeth - 1; t >= 1; t--) {
        const fx = x + lw * 0.55 - (lw * 1.1 * t) / teeth;
        const fy = ly + ((t & 1) ? 0.08 : -0.05) * scale;
        ctx.lineTo(fx, fy);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#473620';
    ctx.beginPath();
    ctx.arc(x, groundY - h - roofH + 0.07 * scale, 0.14 * scale, 0, Math.PI * 2);
    ctx.fill();
  },

  _drawBaldCypress(ctx, wx, toScreenX, toScreenY, scale, sway, heightM = 5.4) {
    if (
      this._drawPhotoTree(ctx, 'cypress', wx, toScreenX, toScreenY, scale, sway, heightM * 1.15, {
        flipX: (Math.round(wx) & 1) === 1,
        embedM: 0.2,
      })
    ) {
      return;
    }
    const foot = this._sampleSurfaceFooting(this.level, wx, 1.05);
    const x = toScreenX(wx);
    const groundY = toScreenY(foot.gyC);
    const h = heightM * scale;
    this._drawGroundContactShadow(ctx, x, groundY + 0.04 * scale, 1.2 * scale, scale, foot.slopeRad);

    // Fluted weathered cypress knees planted directly along the hillside slope
    for (let k = -2; k <= 2; k++) {
      if (k === 0) continue;
      const kWx = wx + k * 0.48;
      const kx = toScreenX(kWx);
      const kGroundY = toScreenY(this._getHorizonGroundY(this.level, kWx));
      const kh = (0.38 + (Math.abs(k) % 2) * 0.22) * scale;
      const kg = ctx.createLinearGradient(kx - 0.1 * scale, kGroundY, kx + 0.1 * scale, kGroundY);
      kg.addColorStop(0, '#3e332a');
      kg.addColorStop(1, '#756858');
      ctx.fillStyle = kg;
      ctx.beginPath();
      ctx.moveTo(kx - 0.11 * scale, kGroundY + 0.16 * scale);
      ctx.lineTo(kx, kGroundY - kh);
      ctx.lineTo(kx + 0.11 * scale, kGroundY + 0.16 * scale);
      ctx.closePath();
      ctx.fill();
    }

    // Wide grey-brown fibrous fluted buttress trunk extending smoothly into slope
    const downDrop = Math.max(0.18, foot.gyDeep - foot.gyC + 0.16) * scale;
    const tg = ctx.createLinearGradient(x - 0.6 * scale, groundY, x + 0.6 * scale, groundY);
    tg.addColorStop(0, '#362e28');
    tg.addColorStop(0.55, '#594f45');
    tg.addColorStop(1, '#7a6f62');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(x - 0.68 * scale, groundY + downDrop);
    ctx.quadraticCurveTo(x - 0.26 * scale, groundY - h * 0.3, x - 0.15 * scale, groundY - h * 0.92);
    ctx.lineTo(x + 0.15 * scale, groundY - h * 0.92);
    ctx.quadraticCurveTo(x + 0.26 * scale, groundY - h * 0.3, x + 0.68 * scale, groundY + downDrop);
    ctx.closePath();
    ctx.fill();

    this._drawContouredBermSkirt(ctx, toScreenX, toScreenY, scale, wx, 0.95, { tufts: 6, stones: false });

    // Textured ragged olive-sage cypress boughs & delicate wispy silver-grey Spanish moss
    const tiers = [
      { dy: -h * 0.72, ox: -1.15, rx: 1.38, ry: 0.46 },
      { dy: -h * 0.76, ox: 1.15, rx: 1.38, ry: 0.46 },
      { dy: -h * 0.94, ox: -0.45, rx: 1.5, ry: 0.54 },
      { dy: -h * 0.98, ox: 0.5, rx: 1.4, ry: 0.5 },
    ];
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      const bx = x + t.ox * scale + sway * (0.7 + i * 0.15);
      const by = groundY + t.dy;
      this._fillFoliageCluster(ctx, bx, by, t.rx * scale, t.ry * scale, t.ox > 0 ? 0.1 : -0.1, scale, 'cypress', 1);

      ctx.strokeStyle = 'rgba(154, 166, 134, 0.64)';
      ctx.lineWidth = Math.max(1, 0.042 * scale);
      for (let m = -3; m <= 3; m++) {
        const mx = bx + m * 0.32 * scale;
        const mLen = (0.75 + ((i + Math.abs(m)) % 3) * 0.42) * scale;
        ctx.beginPath();
        ctx.moveTo(mx, by + 0.16 * scale);
        ctx.quadraticCurveTo(mx + sway * 1.4, by + 0.16 * scale + mLen * 0.5, mx + sway * 2.1, by + 0.16 * scale + mLen);
        ctx.stroke();
      }
    }
  },

  _drawLongleafPine(ctx, wx, toScreenX, toScreenY, scale, sway, heightM = 5.8) {
    if (
      this._drawPhotoTree(ctx, 'spruce', wx, toScreenX, toScreenY, scale, sway, heightM * 1.14, {
        flipX: (Math.round(wx) & 1) === 1,
        widthScale: 0.92,
        embedM: 0.18,
      })
    ) {
      return;
    }
    const x = toScreenX(wx);
    const groundY = toScreenY(this._getHorizonGroundY(this.level, wx));
    const h = heightM * scale;
    const topX = x + sway * 0.45;
    const topY = groundY - h;
    this._drawTaperedCurvedTrunk(
      ctx,
      x,
      groundY + 0.06 * scale,
      x + sway * 0.2,
      groundY - h * 0.5,
      topX,
      topY,
      0.19 * scale,
      0.08 * scale,
      10,
      ['#362319', '#5a3a29', '#7d563f'],
      false
    );
    this._drawFlaredTreeCollar(ctx, toScreenX, toScreenY, wx, x, groundY, 0.19 * scale, scale, ['#362319', '#5a3a29', '#7d563f'], {
      rootSpread: 2.25,
    });

    const clusters = [
      { ox: -0.95, oy: 0.55, rx: 1.08, ry: 0.48 },
      { ox: 0.95, oy: 0.48, rx: 1.08, ry: 0.48 },
      { ox: -0.42, oy: 0.05, rx: 1.28, ry: 0.54 },
      { ox: 0.48, oy: -0.02, rx: 1.22, ry: 0.52 },
      { ox: 0, oy: -0.45, rx: 1.1, ry: 0.5 },
    ];
    for (const c of clusters) {
      this._fillFoliageCluster(
        ctx,
        topX + c.ox * scale + sway * 0.7,
        topY + c.oy * scale,
        c.rx * scale,
        c.ry * scale,
        0,
        scale,
        'pine',
        1
      );
    }
  },

  _drawFloridaRangerKiosk(ctx, wx, toScreenX, toScreenY, scale, isExit = false) {
    if (
      this._drawPhotoBuilding(ctx, 'cabin', wx, toScreenX, toScreenY, scale, 4.15, {
        stoneTop: '#686258',
        stoneMid: '#524c44',
        stoneBot: '#39342e',
        embedM: 0.14,
      })
    ) {
      return;
    }
    const wM = 2.9;
    const foot = this._sampleSurfaceFooting(this.level, wx, wM * 0.54);
    const floorWy = Math.min(foot.gyC, foot.gyHigh + 0.04);
    const x = toScreenX(wx);
    const groundY = toScreenY(floorWy);
    const w = wM * scale;
    const h = 2.1 * scale;
    this._drawGroundContactShadow(ctx, x, toScreenY(foot.gyC) + 0.07 * scale, w * 0.62, scale, foot.slopeRad);

    // Contoured fieldstone & treated-timber terrace foundation down into slope
    this._drawContouredFoundation(ctx, toScreenX, toScreenY, scale, wx, wM * 0.54, floorWy - 0.12, {
      stoneTop: '#686258',
      stoneMid: '#524c44',
      stoneBot: '#39342e',
      capColor: 'rgba(214, 206, 184, 0.24)',
    });

    ctx.fillStyle = 'rgba(14, 18, 16, 0.7)';
    ctx.fillRect(x - w * 0.4, groundY - h, w * 0.8, h - 0.12 * scale);

    ctx.fillStyle = '#5a4330';
    ctx.fillRect(x - w * 0.44, groundY - h, 0.16 * scale, h - 0.1 * scale);
    ctx.fillRect(x + w * 0.44 - 0.16 * scale, groundY - h, 0.16 * scale, h - 0.1 * scale);
    ctx.fillStyle = '#6e523a';
    ctx.fillRect(x - w * 0.34, groundY - h * 0.85, w * 0.68, h * 0.44);
    ctx.fillStyle = isExit ? '#3b7496' : '#d6ceb8';
    ctx.fillRect(x - w * 0.28, groundY - h * 0.8, w * 0.56, h * 0.34);
    // Notice header strip on board
    ctx.fillStyle = isExit ? '#1e3a5f' : '#991b1b';
    ctx.fillRect(x - w * 0.28, groundY - h * 0.8, w * 0.56, h * 0.075);

    // Weathered galvanized standing-seam roof with eave shadow
    ctx.fillStyle = 'rgba(10, 14, 16, 0.45)';
    ctx.fillRect(x - w * 0.52, groundY - h + 0.08 * scale, w * 1.04, 0.08 * scale);
    const rg = ctx.createLinearGradient(x - w * 0.6, groundY - h, x + w * 0.6, groundY - h - 0.85 * scale);
    rg.addColorStop(0, '#475569');
    rg.addColorStop(0.55, '#64748b');
    rg.addColorStop(1, '#94a3b8');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.6, groundY - h + 0.1 * scale);
    ctx.lineTo(x, groundY - h - 0.85 * scale);
    ctx.lineTo(x + w * 0.6, groundY - h + 0.1 * scale);
    ctx.closePath();
    ctx.fill();

    if (!isExit) {
      ctx.strokeStyle = '#c45b2c';
      ctx.lineWidth = Math.max(2, 0.11 * scale);
      ctx.beginPath();
      ctx.arc(x - w * 0.36, groundY - h * 0.48, 0.22 * scale, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#1e355e';
      ctx.beginPath();
      ctx.moveTo(x - 0.55 * scale, groundY - h - 0.5 * scale);
      ctx.lineTo(x + 0.55 * scale, groundY - h - 0.9 * scale);
      ctx.lineTo(x + 0.72 * scale, groundY - h - 0.78 * scale);
      ctx.lineTo(x - 0.38 * scale, groundY - h - 0.38 * scale);
      ctx.closePath();
      ctx.fill();
    }
  },

  _drawInfiniteRockMargin(ctx, viewLeft, viewRight, xMin, xMax, yMin, yMax, toScreenX, toScreenY, scale) {
    const spans = [];
    if (viewLeft < xMin) spans.push([viewLeft - 2, xMin + 0.08]);
    if (viewRight > xMax) spans.push([xMax - 0.08, viewRight + 2]);
    if (spans.length === 0) return;

    const mossKind = this.level.theme?.mossTint || 'emerald';
    const [marginBase, ridgeBase] = MARGIN_MAP[mossKind] || ['#4a3d2e', '#2e592d'];
    if (!this._rockPattern && this.rockTex?.canvas && ctx.createPattern) {
      this._rockPattern = ctx.createPattern(this.rockTex.canvas, 'repeat');
    }

    ctx.save();
    for (const [sx0, sx1] of spans) {
      ctx.beginPath();
      const firstGround = this._getHorizonGroundY(this.level, sx0);
      ctx.moveTo(toScreenX(sx0), toScreenY(yMax + 4));
      for (let wx = sx0; wx <= sx1 + 0.5; wx += 1.2) {
        const clampedX = Math.min(sx1, wx);
        ctx.lineTo(toScreenX(clampedX), toScreenY(this._getHorizonGroundY(this.level, clampedX)));
      }
      ctx.lineTo(toScreenX(sx1), toScreenY(yMax + 4));
      ctx.closePath();

      ctx.fillStyle = marginBase;
      ctx.fill();
      if (this._rockPattern) {
        ctx.save();
        if (typeof DOMMatrix !== 'undefined' && this._rockPattern.setTransform) {
          const ps = Math.max(0.08, scale / CACHE_PX_PER_M);
          this._rockPattern.setTransform(
            new DOMMatrix().translate(toScreenX(0), toScreenY(yMin)).scale(ps, ps)
          );
        }
        ctx.globalAlpha = 0.58;
        ctx.fillStyle = this._rockPattern;
        ctx.fill();
        ctx.restore();
      }

      // Mossy topsoil & dark humus ridge matching baked _buildRockChunk edges
      ctx.strokeStyle = ridgeBase;
      ctx.lineWidth = Math.max(4, 0.55 * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(toScreenX(sx0), toScreenY(firstGround) + 0.25 * scale);
      for (let wx = sx0; wx <= sx1 + 0.5; wx += 1.2) {
        const clampedX = Math.min(sx1, wx);
        ctx.lineTo(toScreenX(clampedX), toScreenY(this._getHorizonGroundY(this.level, clampedX)) + 0.25 * scale);
      }
      ctx.stroke();
    }
    ctx.restore();
  },

  _drawSurfaceTrailPostAndFence(ctx, x1, y1, x2, y2, scale, isRope = true) {
    ctx.strokeStyle = '#574534';
    ctx.lineWidth = Math.max(1.5, 0.08 * scale);
    ctx.beginPath();
    ctx.moveTo(x1, y1 + 0.18 * scale);
    ctx.lineTo(x1, y1 - 0.72 * scale);
    ctx.moveTo(x2, y2 + 0.18 * scale);
    ctx.lineTo(x2, y2 - 0.72 * scale);
    ctx.stroke();

    // Base soil/pebble collar at fence post sockets
    ctx.fillStyle = 'rgba(20, 18, 12, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x1, y1 + 0.06 * scale, 0.13 * scale, 0.055 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x2, y2 + 0.06 * scale, 0.13 * scale, 0.055 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isRope ? '#a6967a' : '#735b43';
    ctx.lineWidth = Math.max(1.2, (isRope ? 0.045 : 0.065) * scale);
    ctx.beginPath();
    ctx.moveTo(x1, y1 - 0.58 * scale);
    if (isRope) {
      ctx.quadraticCurveTo((x1 + x2) * 0.5, (y1 + y2) * 0.5 - 0.36 * scale, x2, y2 - 0.58 * scale);
    } else {
      ctx.lineTo(x2, y2 - 0.58 * scale);
      ctx.moveTo(x1, y1 - 0.32 * scale);
      ctx.lineTo(x2, y2 - 0.32 * scale);
    }
    ctx.stroke();
  },

  _drawHorizonForestSpan(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec, style = 'yucatan') {
    const slotW = 4.4;
    const basins = this.level.openBasins || [];
    const midX = (this.level.bounds.xMin + this.level.bounds.xMax) * 0.5;
    const s0 = Math.floor((visX0 - 6) / slotW);
    const s1 = Math.ceil((visX1 + 6) / slotW);

    for (let s = s0; s <= s1; s++) {
      const hRaw = Math.sin(s * 91.7 + 13.3) * 43758.5453;
      const hash = hRaw - Math.floor(hRaw);
      const wx = s * slotW + (hash - 0.5) * 1.45;

      // Never draw continuous forest inside open sinkholes, stairs, or pavilion clearances
      let insideBasinZone = false;
      for (let b = 0; b < basins.length; b++) {
        const bcx = (basins[b].xMin + basins[b].xMax) * 0.5;
        const clearHalf = (basins[b].rimHalf || 5.2) + 6.8;
        if (Math.abs(wx - bcx) < clearHalf) {
          insideBasinZone = true;
          break;
        }
      }
      if (insideBasinZone) continue;

      const gy = toScreenY(this._getHorizonGroundY(this.level, wx));
      const gx = toScreenX(wx);
      const sway = Math.sin(timeSec * 1.15 + s * 1.37) * 0.07 * scale;
      const leanDir = (s & 1) === 0 ? 1 : -1;
      const h = 4.4 + hash * 2.1;

      if (style === 'yucatan') {
        if (hash > 0.16) {
          this._drawBotanicalPalm(ctx, wx, toScreenX, toScreenY, scale, leanDir, sway, h);
        }
        this._drawTropicalUnderbrush(ctx, wx + leanDir * 0.65, toScreenX, toScreenY, scale, sway, leanDir);

        if ((s % 3) === 0) {
          const nx = wx + slotW * 0.85;
          let clearNext = true;
          for (let b = 0; b < basins.length; b++) {
            const bcx = (basins[b].xMin + basins[b].xMax) * 0.5;
            if (Math.abs(nx - bcx) < (basins[b].rimHalf || 5.2) + 6.2) clearNext = false;
          }
          if (clearNext) {
            const px1 = wx - 0.4;
            this._drawSurfaceTrailPostAndFence(
              ctx,
              toScreenX(px1),
              toScreenY(this._getHorizonGroundY(this.level, px1)),
              toScreenX(nx),
              toScreenY(this._getHorizonGroundY(this.level, nx)),
              scale,
              true
            );
          }
        } else if (hash < 0.35) {
          this._drawAnchoredBoulder(ctx, wx - 0.9, 0.52, 0.24, toScreenX, toScreenY, scale, '#5c5548');
        }
      } else if (style === 'nordic-fjord' || style === 'ural-birch') {
        if (style === 'ural-birch' ? hash > 0.42 : hash > 0.28) {
          if (style === 'ural-birch') this._drawSilverBirch(ctx, wx, toScreenX, toScreenY, scale, sway, h * 0.92);
          else this._drawNorwaySpruce(ctx, wx, toScreenX, toScreenY, scale, sway * 0.55, h + 1.0);
        } else {
          if (style === 'ural-birch') this._drawNorwaySpruce(ctx, wx, toScreenX, toScreenY, scale, sway * 0.5, h + 0.8);
          else this._drawSilverBirch(ctx, wx, toScreenX, toScreenY, scale, sway, h * 0.85);
        }
        if ((s % 2) === 0) {
          this._drawAnchoredBoulder(ctx, wx - 0.85, 0.56, 0.24, toScreenX, toScreenY, scale, style === 'ural-birch' ? '#b8c3cf' : '#536170');
        }
      } else if (style === 'provence-gorge') {
        if ((s & 1) === 0) {
          this._drawMediterraneanCypress(ctx, wx, toScreenX, toScreenY, scale, sway * 0.5, h + 1.1);
        } else if (!this._drawPhotoTree(ctx, 'med', wx, toScreenX, toScreenY, scale, sway * 0.45, h * 0.84, { flipX: true, widthScale: 1.15 })) {
          this._drawTaperedCurvedTrunk(ctx, gx, gy + 0.08 * scale, gx + 0.1 * scale, gy - 0.7 * scale, gx, gy - 1.2 * scale, 0.16 * scale, 0.08 * scale, 6, ['#4a3c30', '#695848', '#877664'], false);
          this._drawFlaredTreeCollar(ctx, toScreenX, toScreenY, wx, gx, gy, 0.16 * scale, scale, ['#4a3c30', '#695848', '#877664']);
          this._fillFoliageCluster(ctx, gx, gy - 1.3 * scale, 1.35 * scale, 0.72 * scale, 0, scale, 'cypress', 1);
        }
        this._drawAnchoredBoulder(ctx, wx - 0.48, 0.72, 0.24, toScreenX, toScreenY, scale, '#a89f8d');
      } else if (style === 'kalahari-crater') {
        if (hash > 0.25) {
          this._drawUmbrellaAcacia(ctx, wx, toScreenX, toScreenY, scale, sway * 0.45, h + 0.4);
        }
        this._drawAnchoredBoulder(ctx, wx - 0.45, 0.7, 0.23, toScreenX, toScreenY, scale, '#8b4528');
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = Math.max(1.1, 0.045 * scale);
        for (let g = -2; g <= 2; g++) {
          const gWx = wx + g * 0.22;
          const gGy = toScreenY(this._getHorizonGroundY(this.level, gWx));
          const gGx = toScreenX(gWx);
          ctx.beginPath();
          ctx.moveTo(gGx, gGy + 0.06 * scale);
          ctx.lineTo(gGx + 0.06 * scale + sway * 0.5, gGy - (0.55 + (Math.abs(g) % 2) * 0.25) * scale);
          ctx.stroke();
        }
      } else if (style === 'bahamas-abaco' || style === 'bermuda-sargasso') {
        if (hash > 0.22) {
          this._drawLongleafPine(ctx, wx, toScreenX, toScreenY, scale, sway * 0.85, h + 0.65);
        } else {
          this._drawBotanicalPalm(ctx, wx, toScreenX, toScreenY, scale, leanDir, sway, h * 0.8);
        }
        this._drawAnchoredBoulder(ctx, wx - 0.85, 0.62, 0.24, toScreenX, toScreenY, scale, style === 'bermuda-sargasso' ? '#d8c5b8' : '#d6d3c9');
        if ((s % 2) === 0) {
          const sbWx = wx + 0.85;
          const sbGy = toScreenY(this._getHorizonGroundY(this.level, sbWx));
          this._fillFoliageCluster(ctx, toScreenX(sbWx), sbGy - 0.22 * scale, 0.72 * scale, 0.34 * scale, 0.05, scale, 'jungle', 1);
        }
      } else if (style === 'budapest-bathhouse') {
        if (!this._drawPhotoTree(ctx, 'med', wx, toScreenX, toScreenY, scale, sway * 0.45, h * 0.92, { flipX: (s & 1) === 1, widthScale: 1.1 })) {
          this._drawTaperedCurvedTrunk(ctx, gx, gy + 0.06 * scale, gx + 0.08 * scale, gy - 0.75 * scale, gx, gy - 1.35 * scale, 0.16 * scale, 0.07 * scale, 6, ['#46382c', '#635141', '#7d6856'], false);
          this._drawFlaredTreeCollar(ctx, toScreenX, toScreenY, wx, gx, gy, 0.16 * scale, scale, ['#46382c', '#635141', '#7d6856']);
          this._fillFoliageCluster(ctx, gx, gy - 1.55 * scale, 1.45 * scale, 0.92 * scale, 0.04, scale, 'jungle', 1);
        }
        this._drawAnchoredBoulder(ctx, wx - 0.42, 0.68, 0.22, toScreenX, toScreenY, scale, '#c4b89f');
      } else if (style === 'sinai-coast' || style === 'atlantida-lava') {
        if (hash > 0.38) {
          this._drawBotanicalPalm(ctx, wx, toScreenX, toScreenY, scale, leanDir, sway * 0.85, h * 0.78);
        }
        this._drawAnchoredBoulder(ctx, wx - 0.75, 0.72, 0.26, toScreenX, toScreenY, scale, style === 'atlantida-lava' ? '#292524' : '#c2925e');
      } else if (style === 'quercy-ressel' || style === 'lazio-travertine' || style === 'boybulok-steppe') {
        if ((s & 1) === 0) {
          this._drawMediterraneanCypress(ctx, wx, toScreenX, toScreenY, scale, sway * 0.5, h + 0.8);
        } else if (!this._drawPhotoTree(ctx, 'med', wx, toScreenX, toScreenY, scale, sway * 0.45, h * 0.84, { flipX: true, widthScale: 1.15 })) {
          this._drawTaperedCurvedTrunk(ctx, gx, gy + 0.08 * scale, gx + 0.08 * scale, gy - 0.7 * scale, gx, gy - 1.2 * scale, 0.16 * scale, 0.08 * scale, 6, ['#4e4135', '#6b5a4a', '#877664'], false);
          this._drawFlaredTreeCollar(ctx, toScreenX, toScreenY, wx, gx, gy, 0.16 * scale, scale, ['#4e4135', '#6b5a4a', '#877664']);
          this._fillFoliageCluster(ctx, gx, gy - 1.3 * scale, 1.4 * scale, 0.8 * scale, 0, scale, 'cypress', 1);
        }
        this._drawAnchoredBoulder(ctx, wx - 0.45, 0.68, 0.23, toScreenX, toScreenY, scale, style === 'quercy-ressel' ? '#c2bdb0' : style === 'boybulok-steppe' ? '#8c7e6d' : '#bda886');
      } else if (style === 'moravia-rift' || style === 'nordic-mine') {
        this._drawNorwaySpruce(ctx, wx, toScreenX, toScreenY, scale, sway * 0.65, h + 1.1);
        this._drawAnchoredBoulder(ctx, wx - 0.85, 0.62, 0.25, toScreenX, toScreenY, scale, style === 'nordic-mine' ? '#57534e' : '#475569');
      } else if (style === 'aurora-basalt' || style === 'strytan-fjord' || style === 'kverkfjoll-glacier' || style === 'grjotagja-rift' || style === 'greenland-iceberg') {
        if (style === 'strytan-fjord' || style === 'aurora-basalt') {
          if ((s & 1) === 0) {
            this._drawNorwaySpruce(ctx, wx, toScreenX, toScreenY, scale, sway * 0.55, h * 0.88);
          } else {
            this._drawSilverBirch(ctx, wx, toScreenX, toScreenY, scale, sway * 0.5, h * 0.72);
          }
        }
        const bCol1 = (style === 'kverkfjoll-glacier' || style === 'greenland-iceberg') ? '#7dd3fc' : style === 'grjotagja-rift' ? '#292524' : '#334155';
        const bCol2 = (style === 'kverkfjoll-glacier' || style === 'greenland-iceberg') ? '#bae6fd' : style === 'grjotagja-rift' ? '#44403c' : '#1e293b';
        this._drawAnchoredBoulder(ctx, wx - 0.78, 0.68, 0.28, toScreenX, toScreenY, scale, bCol1);
        this._drawAnchoredBoulder(ctx, wx + 0.72, 0.44, 0.2, toScreenX, toScreenY, scale, bCol2);
      } else if (style === 'oxbelha-twilight' || style === 'lagoa-cerrado') {
        this._drawBotanicalPalm(ctx, wx, toScreenX, toScreenY, scale, leanDir, sway * 0.75, h * 0.88);
        const ubWx = wx + 0.8;
        const ubGy = toScreenY(this._getHorizonGroundY(this.level, ubWx));
        this._fillFoliageCluster(ctx, toScreenX(ubWx), ubGy - 0.24 * scale, 0.9 * scale, 0.42 * scale, 0.05, scale, 'jungle', 1);
      } else {
        // Florida Karst: Entrance side = cypress & Spanish moss swamp; Exit side = longleaf pine flatwoods
        const isCypressZone = wx < midX;
        if (isCypressZone) {
          if (hash > 0.18) {
            this._drawBaldCypress(ctx, wx, toScreenX, toScreenY, scale, sway, h + 0.5);
          }
          const shWx = wx + leanDir * 0.9;
          const shGy = toScreenY(this._getHorizonGroundY(this.level, shWx));
          this._fillFoliageCluster(ctx, toScreenX(shWx), shGy - 0.24 * scale, 0.85 * scale, 0.42 * scale, 0.08, scale, 'cypress', leanDir);
        } else {
          if (hash > 0.15) {
            this._drawLongleafPine(ctx, wx, toScreenX, toScreenY, scale, sway, h + 0.8);
          }
          // Sawgrass & cattail reed clumps grounded smoothly along sandy flatwoods ridge
          for (let r = 0; r < 5; r++) {
            const rWx = wx + (r - 2) * 0.32;
            const rx = toScreenX(rWx);
            const rGy = toScreenY(this._getHorizonGroundY(this.level, rWx));
            const rLen = (0.95 + (r % 2) * 0.42) * scale;
            ctx.strokeStyle = '#4e6928';
            ctx.lineWidth = Math.max(1.2, 0.048 * scale);
            ctx.beginPath();
            ctx.moveTo(rx, rGy + 0.08 * scale);
            ctx.quadraticCurveTo(rx + sway * 0.6, rGy - rLen * 0.6, rx + sway * 1.1, rGy - rLen);
            ctx.stroke();
          }
        }
        if ((s % 2) === 0) {
          const nx = wx + slotW * 0.82;
          let clearNext = true;
          for (let b = 0; b < basins.length; b++) {
            const bcx = (basins[b].xMin + basins[b].xMax) * 0.5;
            if (Math.abs(nx - bcx) < (basins[b].rimHalf || 5.2) + 6.2) clearNext = false;
          }
          if (clearNext) {
            this._drawSurfaceTrailPostAndFence(
              ctx,
              gx,
              gy,
              toScreenX(nx),
              toScreenY(this._getHorizonGroundY(this.level, nx)),
              scale,
              false
            );
          }
        }
      }
    }
  },

  _drawNorwaySpruce(ctx, wx, toScreenX, toScreenY, scale, sway, heightM = 5.6) {
    if (
      this._drawPhotoTree(ctx, 'spruce', wx, toScreenX, toScreenY, scale, sway, heightM * 1.16, {
        flipX: (Math.round(wx) & 1) === 1,
        embedM: 0.2,
      })
    ) {
      return;
    }
    const x = toScreenX(wx);
    const groundY = toScreenY(this._getHorizonGroundY(this.level, wx));
    const h = heightM * scale;
    this._drawTaperedCurvedTrunk(ctx, x, groundY + 0.06 * scale, x + sway * 0.1, groundY - h * 0.25, x + sway * 0.2, groundY - h * 0.45, 0.14 * scale, 0.08 * scale, 6, ['#2b1e15', '#3f2e21', '#5a4332'], false);
    this._drawFlaredTreeCollar(ctx, toScreenX, toScreenY, wx, x, groundY, 0.14 * scale, scale, ['#2b1e15', '#3f2e21', '#5a4332'], { rootSpread: 2.3 });
    for (let tier = 0; tier < 4; tier++) {
      const ty = groundY - h * (0.28 + tier * 0.2);
      const tw = (1.35 - tier * 0.24) * scale;
      const th = (1.55 - tier * 0.16) * scale;
      const ox = sway * (0.4 + tier * 0.22);
      const g = ctx.createLinearGradient(x - tw, ty, x + tw, ty - th);
      g.addColorStop(0, '#143028');
      g.addColorStop(0.55, '#1f4a3c');
      g.addColorStop(1, '#366854');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - tw + ox, ty);
      ctx.lineTo(x + ox * 1.3, ty - th);
      ctx.lineTo(x + tw + ox, ty);
      ctx.closePath();
      ctx.fill();
    }
  },

  _drawSilverBirch(ctx, wx, toScreenX, toScreenY, scale, sway, heightM = 4.6) {
    if (
      this._drawPhotoTree(ctx, 'spruce', wx, toScreenX, toScreenY, scale, sway, heightM * 1.05, {
        flipX: (Math.round(wx) & 1) === 0,
        widthScale: 0.84,
        embedM: 0.18,
      })
    ) {
      return;
    }
    const x = toScreenX(wx);
    const groundY = toScreenY(this._getHorizonGroundY(this.level, wx));
    const h = heightM * scale;
    const topX = x + sway * 0.5;
    const topY = groundY - h;
    this._drawTaperedCurvedTrunk(ctx, x, groundY + 0.06 * scale, x + 0.08 * scale, groundY - h * 0.5, topX, topY, 0.11 * scale, 0.04 * scale, 8, ['#94a3b8', '#e2e8f0', '#f8fafc'], false);
    this._drawFlaredTreeCollar(ctx, toScreenX, toScreenY, wx, x, groundY, 0.12 * scale, scale, ['#475569', '#94a3b8', '#cbd5e1'], { rootSpread: 2.15 });
    this._fillFoliageCluster(ctx, topX - 0.35 * scale, topY + 0.25 * scale, 1.05 * scale, 0.62 * scale, -0.1, scale, 'pine', -1);
    this._fillFoliageCluster(ctx, topX + 0.4 * scale, topY + 0.05 * scale, 0.95 * scale, 0.58 * scale, 0.1, scale, 'pine', 1);
  },

  _drawMediterraneanCypress(ctx, wx, toScreenX, toScreenY, scale, sway, heightM = 6.0) {
    if (
      this._drawPhotoTree(ctx, 'med', wx, toScreenX, toScreenY, scale, sway, heightM * 1.12, {
        flipX: (Math.round(wx) & 1) === 1,
        embedM: 0.22,
      })
    ) {
      return;
    }
    const x = toScreenX(wx);
    const groundY = toScreenY(this._getHorizonGroundY(this.level, wx));
    const h = heightM * scale;
    this._drawTaperedCurvedTrunk(ctx, x, groundY + 0.06 * scale, x + sway * 0.08, groundY - h * 0.2, x + sway * 0.15, groundY - h * 0.38, 0.13 * scale, 0.07 * scale, 6, ['#38281c', '#4f3b2b', '#6b523e'], false);
    this._drawFlaredTreeCollar(ctx, toScreenX, toScreenY, wx, x, groundY, 0.13 * scale, scale, ['#38281c', '#4f3b2b', '#6b523e'], { rootSpread: 2.1 });
    const cg = ctx.createLinearGradient(x - 0.6 * scale, groundY, x + 0.6 * scale, groundY - h);
    cg.addColorStop(0, '#1e3523');
    cg.addColorStop(0.6, '#2f5235');
    cg.addColorStop(1, '#4c7349');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(x - 0.58 * scale, groundY - h * 0.18);
    ctx.quadraticCurveTo(x - 0.62 * scale + sway * 0.4, groundY - h * 0.66, x + sway, groundY - h);
    ctx.quadraticCurveTo(x + 0.62 * scale + sway * 0.4, groundY - h * 0.66, x + 0.58 * scale, groundY - h * 0.18);
    ctx.closePath();
    ctx.fill();
  },

  _drawUmbrellaAcacia(ctx, wx, toScreenX, toScreenY, scale, sway, heightM = 5.2) {
    if (
      this._drawPhotoTree(ctx, 'acacia', wx, toScreenX, toScreenY, scale, sway, heightM * 0.96, {
        flipX: (Math.round(wx) & 1) === 1,
        embedM: 0.2,
      })
    ) {
      return;
    }
    const x = toScreenX(wx);
    const groundY = toScreenY(this._getHorizonGroundY(this.level, wx));
    const h = heightM * scale;
    const topX = x + sway * 0.35;
    const topY = groundY - h * 0.86;
    this._drawTaperedCurvedTrunk(ctx, x, groundY + 0.06 * scale, x - 0.2 * scale, groundY - h * 0.45, topX, topY, 0.18 * scale, 0.07 * scale, 8, ['#442d1d', '#6b472c', '#855838'], false);
    this._drawFlaredTreeCollar(ctx, toScreenX, toScreenY, wx, x, groundY, 0.18 * scale, scale, ['#442d1d', '#6b472c', '#855838'], { rootSpread: 2.35 });
    ctx.strokeStyle = '#5a3a22';
    ctx.lineWidth = Math.max(1.5, 0.075 * scale);
    ctx.beginPath();
    ctx.moveTo(topX, topY + 0.65 * scale);
    ctx.lineTo(topX - 1.55 * scale, topY + 0.08 * scale);
    ctx.moveTo(topX, topY + 0.55 * scale);
    ctx.lineTo(topX + 1.55 * scale, topY + 0.06 * scale);
    ctx.stroke();
    this._fillFoliageCluster(ctx, topX, topY, 2.35 * scale, 0.48 * scale, 0, scale, 'cypress', 1);
    this._fillFoliageCluster(ctx, topX - 1.15 * scale, topY + 0.12 * scale, 1.3 * scale, 0.34 * scale, -0.05, scale, 'cypress', -1);
    this._fillFoliageCluster(ctx, topX + 1.15 * scale, topY + 0.1 * scale, 1.3 * scale, 0.34 * scale, 0.05, scale, 'cypress', 1);
  },

  _drawSurfaceTopEnvironment(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec) {
    const surfaceStyle = this.level.theme?.surfaceStyle;
    if (surfaceStyle === 'open-ocean-wreck') {
      this._drawWreckSurfaceBoat(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec);
      return;
    }
    if (surfaceStyle === 'florida-cypress') {
      this._drawFloridaSurfaceEnvironment(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec);
      return;
    }
    if (
      surfaceStyle === 'nordic-fjord' ||
      surfaceStyle === 'provence-gorge' ||
      surfaceStyle === 'kalahari-crater' ||
      surfaceStyle === 'ural-birch' ||
      surfaceStyle === 'bahamas-abaco' ||
      surfaceStyle === 'budapest-bathhouse' ||
      surfaceStyle === 'sinai-coast' ||
      surfaceStyle === 'quercy-ressel' ||
      surfaceStyle === 'lazio-travertine' ||
      surfaceStyle === 'moravia-rift' ||
      surfaceStyle === 'oxbelha-twilight' ||
      surfaceStyle === 'aurora-basalt' ||
      surfaceStyle === 'strytan-fjord' ||
      surfaceStyle === 'kverkfjoll-glacier' ||
      surfaceStyle === 'grjotagja-rift' ||
      surfaceStyle === 'atlantida-lava' ||
      surfaceStyle === 'lagoa-cerrado' ||
      surfaceStyle === 'boybulok-steppe' ||
      surfaceStyle === 'nordic-mine' ||
      surfaceStyle === 'greenland-iceberg' ||
      surfaceStyle === 'bermuda-sargasso'
    ) {
      this._drawThemedExpeditionSurface(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec, surfaceStyle);
      return;
    }
    ctx.save();
    this._drawHorizonForestSpan(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec, 'yucatan');
    for (const basin of this.level.openBasins) {
      if (basin.xMax + 14 < visX0 || basin.xMin - 14 > visX1) continue;
      const cx = (basin.xMin + basin.xMax) * 0.5;
      const waterLeft = this._findBasinCliffEdgeX(basin, -0.35, -1);
      const waterRight = this._findBasinCliffEdgeX(basin, -0.35, 1);

      // 1. Floating olive-jade water-lilies with soft dark water reflection underside
      const padSpanL = waterLeft + 1.1;
      const padSpanR = waterRight - 1.1;
      for (let l = 0; l < 6; l++) {
        const lx = padSpanL + ((padSpanR - padSpanL) * (l + 0.45)) / 6;
        if (evaluateCaveSDF(this.level, lx, 0.05) > -0.3) continue;
        const bob = Math.sin(lx * 0.95 + timeSec * 2.4) * 0.07 + Math.cos(timeSec * 1.6 + l) * 0.02;
        const sx = toScreenX(lx);
        const sy = toScreenY(bob);
        ctx.fillStyle = 'rgba(8, 22, 14, 0.38)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 0.04 * scale, (0.38 + (l % 2) * 0.1) * scale, 0.07 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = l % 2 === 0 ? '#2b4f2b' : '#396232';
        ctx.beginPath();
        ctx.ellipse(sx, sy, (0.36 + (l % 2) * 0.1) * scale, 0.075 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        if (l === 1 || l === 4) {
          ctx.fillStyle = basin.kind === 'exit' ? '#d4b856' : '#c98a92';
          ctx.beginPath();
          ctx.arc(sx, sy - 0.055 * scale, 0.08 * scale, Math.PI, 0);
          ctx.fill();
        }
      }

      // 2. Waterline dock + terraced stairs climbing the inner limestone rim up to cliff-top ground
      const leftRimY = this._getHorizonGroundY(this.level, waterLeft - 2.6);
      const rightRimY = this._getHorizonGroundY(this.level, waterRight + 2.6);
      const topLeftX = this._findBasinCliffEdgeX(basin, leftRimY, -1) - 1.2;
      const topRightX = this._findBasinCliffEdgeX(basin, rightRimY, 1) + 1.2;

      if (basin.kind === 'entry') {
        this._drawCliffStairs(
          ctx,
          toScreenX(topLeftX + 0.5),
          toScreenY(this._getHorizonGroundY(this.level, topLeftX + 0.5)),
          toScreenX(waterLeft + 0.6),
          toScreenY(-0.55),
          scale,
          true
        );

        const deckX = toScreenX(waterLeft - 0.4);
        const deckW = 3.1 * scale;
        const deckY = toScreenY(-0.55);
        ctx.fillStyle = '#3a2c20';
        ctx.fillRect(deckX + deckW * 0.74, deckY, 0.2 * scale, 2.3 * scale);
        ctx.fillRect(deckX + deckW * 0.25, deckY, 0.2 * scale, 1.4 * scale);
        ctx.fillStyle = '#5c4632';
        ctx.beginPath();
        ctx.roundRect(deckX, deckY, deckW, 0.24 * scale, 0.05 * scale);
        ctx.fill();
        ctx.fillStyle = '#846b50';
        ctx.fillRect(deckX, deckY, deckW, 0.07 * scale);

        const ladX = deckX + deckW - 0.35 * scale;
        ctx.strokeStyle = '#4a3625';
        ctx.lineWidth = Math.max(2, 0.095 * scale);
        ctx.beginPath();
        ctx.moveTo(ladX, deckY + 0.1 * scale);
        ctx.lineTo(ladX + 0.35 * scale, toScreenY(1.9));
        ctx.stroke();
        for (let r = 0; r < 5; r++) {
          const ry = deckY + (0.4 + r * 0.42) * scale;
          const rx = ladX + r * 0.07 * scale;
          ctx.fillStyle = '#7d6347';
          ctx.fillRect(rx - 0.16 * scale, ry, 0.34 * scale, 0.075 * scale);
        }

        // Weathered rust-orange safety SMB surface buoy moored near guideline start
        const buoyX = toScreenX(cx);
        const buoyBob = Math.sin(cx * 0.95 + timeSec * 2.4) * 0.07;
        const buoyY = toScreenY(buoyBob);
        ctx.strokeStyle = 'rgba(214, 198, 128, 0.55)';
        ctx.lineWidth = Math.max(1, 0.035 * scale);
        ctx.beginPath();
        ctx.moveTo(buoyX, buoyY);
        ctx.lineTo(buoyX, toScreenY(3.4));
        ctx.stroke();
        const bg = ctx.createRadialGradient(buoyX + 0.08 * scale, buoyY - 0.18 * scale, 0.04 * scale, buoyX, buoyY - 0.12 * scale, 0.42 * scale);
        bg.addColorStop(0, '#db6c39');
        bg.addColorStop(1, '#7c3215');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.ellipse(buoyX, buoyY - 0.12 * scale, 0.4 * scale, 0.21 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        this._drawCliffStairs(
          ctx,
          toScreenX(topRightX - 0.5),
          toScreenY(this._getHorizonGroundY(this.level, topRightX - 0.5)),
          toScreenX(waterRight - 0.6),
          toScreenY(-0.55),
          scale,
          true
        );

        const deckX = toScreenX(waterRight - 2.6);
        const deckW = 3.1 * scale;
        const deckY = toScreenY(-0.55);
        ctx.fillStyle = '#3a2c20';
        ctx.fillRect(deckX + 0.22 * scale, deckY, 0.2 * scale, 2.2 * scale);
        ctx.fillStyle = '#5c4632';
        ctx.beginPath();
        ctx.roundRect(deckX, deckY, deckW, 0.24 * scale, 0.05 * scale);
        ctx.fill();
        ctx.fillStyle = '#846b50';
        ctx.fillRect(deckX, deckY, deckW, 0.07 * scale);

        const ladX = deckX + 0.25 * scale;
        ctx.strokeStyle = '#4a3625';
        ctx.lineWidth = Math.max(2, 0.095 * scale);
        ctx.beginPath();
        ctx.moveTo(ladX, deckY + 0.1 * scale);
        ctx.lineTo(ladX - 0.3 * scale, toScreenY(2.1));
        ctx.stroke();
        for (let r = 0; r < 5; r++) {
          const ry = deckY + (0.4 + r * 0.44) * scale;
          const rx = ladX - r * 0.06 * scale;
          ctx.fillStyle = '#846b50';
          ctx.fillRect(rx - 0.16 * scale, ry, 0.34 * scale, 0.075 * scale);
        }

        const buoyX = toScreenX(cx);
        const buoyBob = Math.sin(cx * 0.95 + timeSec * 2.4) * 0.07;
        const buoyY = toScreenY(buoyBob);
        const bg = ctx.createRadialGradient(buoyX + 0.08 * scale, buoyY - 0.16 * scale, 0.04 * scale, buoyX, buoyY - 0.11 * scale, 0.42 * scale);
        bg.addColorStop(0, '#c89b32');
        bg.addColorStop(1, '#785712');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.ellipse(buoyX, buoyY - 0.11 * scale, 0.42 * scale, 0.2 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d6dce2';
        ctx.lineWidth = Math.max(1.4, 0.05 * scale);
        ctx.beginPath();
        ctx.moveTo(buoyX, buoyY - 0.18 * scale);
        ctx.lineTo(buoyX, buoyY - 1.2 * scale);
        ctx.stroke();
        const flutter = Math.sin(timeSec * 4.2) * 0.07 * scale;
        ctx.fillStyle = '#b93832';
        ctx.beginPath();
        ctx.moveTo(buoyX, buoyY - 1.18 * scale);
        ctx.lineTo(buoyX + 0.68 * scale, buoyY - 1.11 * scale + flutter);
        ctx.lineTo(buoyX + 0.68 * scale, buoyY - 0.7 * scale + flutter);
        ctx.lineTo(buoyX, buoyY - 0.76 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = Math.max(1.4, 0.075 * scale);
        ctx.beginPath();
        ctx.moveTo(buoyX + 0.06 * scale, buoyY - 1.14 * scale);
        ctx.lineTo(buoyX + 0.62 * scale, buoyY - 0.74 * scale + flutter);
        ctx.stroke();
      }

      // 3. Cliff-top Yucatan jungle ridge (textured organic palms, shrubs & palapa grounded on terrain curves)
      const leftTreeX = topLeftX - 3.6;
      const rightTreeX = topRightX + 3.6;
      const palapaX = basin.kind === 'entry' ? topLeftX - 2.0 : topRightX + 2.0;
      this._drawPalapaPavilion(ctx, palapaX, toScreenX, toScreenY, scale, basin.kind);

      const rims = [
        { wx: topLeftX - 0.4, dir: 1, h: 4.5 },
        { wx: leftTreeX - 1.5, dir: 1, h: 5.4 },
        { wx: topRightX + 0.4, dir: -1, h: 4.7 },
        { wx: rightTreeX + 1.5, dir: -1, h: 5.3 },
      ];
      for (let e = 0; e < rims.length; e++) {
        const rw = rims[e];
        const sway = Math.sin(timeSec * 1.3 + e * 1.7 + cx) * 0.08 * scale;
        this._drawBotanicalPalm(ctx, rw.wx, toScreenX, toScreenY, scale, rw.dir, sway, rw.h);
        this._drawTropicalUnderbrush(ctx, rw.wx + rw.dir * 0.55, toScreenX, toScreenY, scale, sway, rw.dir);
      }

      // 4. Organic hanging aerial roots & creeping vines hugging the sinkhole cliff lips (clear of stairs)
      const rootEdges = [
        { wx: waterLeft - 0.1, dir: 1 },
        { wx: waterRight + 0.1, dir: -1 },
      ];
      for (let rIdx = 0; rIdx < rootEdges.length; rIdx++) {
        const edge = rootEdges[rIdx];
        for (let v = 0; v < 3; v++) {
          const vWx = edge.wx + edge.dir * (0.08 + v * 0.22);
          const vx = toScreenX(vWx);
          const vyTop = toScreenY(this._getHorizonGroundY(this.level, vWx) + 0.18);
          const vLen = (3.8 + (v % 3) * 1.1) * scale;
          const vSway = Math.sin(timeSec * 1.1 + v * 1.9 + rIdx) * 0.12 * scale;
          ctx.strokeStyle = v % 2 === 0 ? 'rgba(34, 68, 36, 0.78)' : 'rgba(66, 46, 30, 0.72)';
          ctx.lineWidth = Math.max(1.1, (v === 1 ? 0.05 : 0.034) * scale);
          ctx.beginPath();
          ctx.moveTo(vx, vyTop);
          ctx.quadraticCurveTo(vx + vSway * 0.45 - edge.dir * 0.1 * scale, vyTop + vLen * 0.5, vx + vSway, vyTop + vLen);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  },

  /**
   * Level 2+ Florida Karst Surface Biome:
   * Entry = Bald cypress swamp, Spanish moss, weathered cave danger sign, overlook kiosk & swamp canoe.
   * Exit  = Pine flatwoods spring boil, cattails/sawgrass, hydro station & marker sphere.
   */
  _drawFloridaSurfaceEnvironment(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec) {
    ctx.save();
    this._drawHorizonForestSpan(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec, 'florida');
    for (const basin of this.level.openBasins) {
      if (basin.xMax + 14 < visX0 || basin.xMin - 14 > visX1) continue;
      const cx = (basin.xMin + basin.xMax) * 0.5;
      const waterLeft = this._findBasinCliffEdgeX(basin, -0.35, -1);
      const waterRight = this._findBasinCliffEdgeX(basin, -0.35, 1);

      const padL = waterLeft + 0.9;
      const padR = waterRight - 0.9;
      for (let l = 0; l < 6; l++) {
        const lx = padL + ((padR - padL) * (l + 0.4)) / 6;
        if (evaluateCaveSDF(this.level, lx, 0.05) > -0.25) continue;
        const bob = Math.sin(lx * 0.95 + timeSec * 2.4) * 0.07 + Math.cos(timeSec * 1.5 + l) * 0.02;
        const sx = toScreenX(lx);
        const sy = toScreenY(bob);
        ctx.fillStyle = basin.kind === 'entry' ? '#364924' : '#3f5728';
        ctx.beginPath();
        ctx.ellipse(sx, sy, (0.34 + (l % 2) * 0.12) * scale, 0.065 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      const leftRimY = this._getHorizonGroundY(this.level, waterLeft - 2.6);
      const rightRimY = this._getHorizonGroundY(this.level, waterRight + 2.6);
      const topLeftX = this._findBasinCliffEdgeX(basin, leftRimY, -1) - 1.2;
      const topRightX = this._findBasinCliffEdgeX(basin, rightRimY, 1) + 1.2;

      if (basin.kind === 'entry') {
        this._drawCliffStairs(
          ctx,
          toScreenX(topLeftX + 0.5),
          toScreenY(this._getHorizonGroundY(this.level, topLeftX + 0.5)),
          toScreenX(waterLeft + 0.55),
          toScreenY(-0.52),
          scale,
          false
        );

        const deckX = toScreenX(waterLeft - 0.4);
        const deckW = 2.7 * scale;
        const deckY = toScreenY(-0.52);
        ctx.fillStyle = '#3f3d39';
        ctx.fillRect(deckX + deckW * 0.72, deckY, 0.19 * scale, 2.2 * scale);
        ctx.fillStyle = '#5c5852';
        ctx.beginPath();
        ctx.roundRect(deckX, deckY, deckW, 0.22 * scale, 0.04 * scale);
        ctx.fill();

        const stairX = deckX + deckW - 0.25 * scale;
        ctx.strokeStyle = '#9ca7b4';
        ctx.lineWidth = Math.max(1.8, 0.085 * scale);
        ctx.beginPath();
        ctx.moveTo(stairX, deckY + 0.08 * scale);
        ctx.lineTo(stairX + 0.55 * scale, toScreenY(2.1));
        ctx.stroke();
        for (let r = 0; r < 6; r++) {
          const ry = deckY + (0.32 + r * 0.38) * scale;
          const rx = stairX + r * 0.09 * scale;
          ctx.fillStyle = '#85909c';
          ctx.fillRect(rx - 0.15 * scale, ry, 0.32 * scale, 0.065 * scale);
        }

        // Weathered yellow diamond NSS-CDS Cave Danger Sign mounted beside cliff stairs
        const signWx = topLeftX - 0.18;
        const signX = toScreenX(signWx);
        const signGround = toScreenY(this._getHorizonGroundY(this.level, signWx));
        const signY = signGround - 1.55 * scale;
        ctx.fillStyle = '#3a3733';
        ctx.fillRect(signX - 0.055 * scale, signY, 0.11 * scale, 1.72 * scale);
        ctx.save();
        ctx.translate(signX, signY);
        ctx.rotate(Math.PI * 0.25);
        ctx.fillStyle = '#d4aa2c';
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = Math.max(1.4, 0.055 * scale);
        ctx.fillRect(-0.32 * scale, -0.32 * scale, 0.64 * scale, 0.64 * scale);
        ctx.strokeRect(-0.32 * scale, -0.32 * scale, 0.64 * scale, 0.64 * scale);
        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        ctx.arc(0, 0, 0.13 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Shaded olive swamp canoe resting in the tannic pond
        const canoeX = toScreenX(cx + 0.6);
        const canoeBob = Math.sin((cx + 0.6) * 0.95 + timeSec * 2.1) * 0.065;
        const canoeY = toScreenY(canoeBob);
        ctx.fillStyle = 'rgba(10, 14, 10, 0.35)';
        ctx.beginPath();
        ctx.ellipse(canoeX, canoeY + 0.12 * scale, 1.1 * scale, 0.14 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        const cg = ctx.createLinearGradient(canoeX, canoeY - 0.24 * scale, canoeX, canoeY + 0.2 * scale);
        cg.addColorStop(0, '#365434');
        cg.addColorStop(1, '#192b1a');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.moveTo(canoeX - 1.35 * scale, canoeY - 0.22 * scale);
        ctx.quadraticCurveTo(canoeX, canoeY + 0.24 * scale, canoeX + 1.35 * scale, canoeY - 0.22 * scale);
        ctx.lineTo(canoeX + 1.05 * scale, canoeY - 0.02 * scale);
        ctx.quadraticCurveTo(canoeX, canoeY + 0.18 * scale, canoeX - 1.05 * scale, canoeY - 0.02 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#8b6331';
        ctx.lineWidth = Math.max(1.4, 0.055 * scale);
        ctx.beginPath();
        ctx.moveTo(canoeX - 1.3 * scale, canoeY - 0.2 * scale);
        ctx.lineTo(canoeX + 1.3 * scale, canoeY - 0.2 * scale);
        ctx.stroke();

        const kioskX = topLeftX - 2.1;
        this._drawFloridaRangerKiosk(ctx, kioskX, toScreenX, toScreenY, scale, false);

        const cypressLocs = [
          { wx: topLeftX - 5.1, h: 5.8 },
          { wx: topRightX + 0.9, h: 5.2 },
          { wx: topRightX + 4.3, h: 6.0 },
        ];
        for (let e = 0; e < cypressLocs.length; e++) {
          const c = cypressLocs[e];
          const sway = Math.sin(timeSec * 1.1 + e * 2.0 + cx) * 0.06 * scale;
          this._drawBaldCypress(ctx, c.wx, toScreenX, toScreenY, scale, sway, c.h);
        }
      } else {
        this._drawCliffStairs(
          ctx,
          toScreenX(topRightX - 0.5),
          toScreenY(this._getHorizonGroundY(this.level, topRightX - 0.5)),
          toScreenX(waterRight - 0.55),
          toScreenY(-0.5),
          scale,
          false
        );

        const deckX = toScreenX(waterRight - 2.4);
        const deckW = 2.9 * scale;
        const deckY = toScreenY(-0.5);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(deckX + 0.2 * scale, deckY, 0.18 * scale, 2.1 * scale);
        ctx.fillStyle = '#9aa4b0';
        ctx.beginPath();
        ctx.roundRect(deckX, deckY, deckW, 0.22 * scale, 0.04 * scale);
        ctx.fill();

        const ladX = deckX + 0.22 * scale;
        ctx.strokeStyle = '#525e6c';
        ctx.lineWidth = Math.max(1.8, 0.09 * scale);
        ctx.beginPath();
        ctx.moveTo(ladX, deckY + 0.08 * scale);
        ctx.lineTo(ladX - 0.3 * scale, toScreenY(2.0));
        ctx.stroke();
        for (let r = 0; r < 5; r++) {
          const ry = deckY + (0.36 + r * 0.4) * scale;
          const rx = ladX - r * 0.06 * scale;
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(rx - 0.14 * scale, ry, 0.3 * scale, 0.065 * scale);
        }

        const buoyX = toScreenX(cx);
        const buoyBob = Math.sin(cx * 0.95 + timeSec * 2.4) * 0.07;
        const buoyY = toScreenY(buoyBob);
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(buoyX, buoyY - 0.16 * scale, 0.26 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c45b2c';
        ctx.beginPath();
        ctx.arc(buoyX, buoyY - 0.16 * scale, 0.26 * scale, Math.PI, 0);
        ctx.fill();

        const kioskX = topRightX + 2.1;
        this._drawFloridaRangerKiosk(ctx, kioskX, toScreenX, toScreenY, scale, true);

        const pineLocs = [
          { wx: topLeftX - 0.8, h: 5.4, dir: 1 },
          { wx: topLeftX - 4.0, h: 6.2, dir: 1 },
          { wx: topRightX + 4.9, h: 5.9, dir: -1 },
        ];
        for (let e = 0; e < pineLocs.length; e++) {
          const p = pineLocs[e];
          const sway = Math.sin(timeSec * 1.4 + e * 1.7 + cx) * 0.07 * scale;
          this._drawLongleafPine(ctx, p.wx, toScreenX, toScreenY, scale, sway, p.h);

          for (let r = 0; r < 5; r++) {
            const rWx = p.wx + p.dir * (r - 2) * 0.32;
            const rx = toScreenX(rWx);
            const gy = toScreenY(this._getHorizonGroundY(this.level, rWx));
            const rLen = (1.05 + (r % 2) * 0.42) * scale;
            ctx.strokeStyle = '#4e6928';
            ctx.lineWidth = Math.max(1.3, 0.05 * scale);
            ctx.beginPath();
            ctx.moveTo(rx, gy + 0.08 * scale);
            ctx.quadraticCurveTo(rx + sway * 0.7, gy - rLen * 0.6, rx + sway * 1.2, gy - rLen);
            ctx.stroke();
            if (r === 1 || r === 3) {
              ctx.fillStyle = '#5c3c22';
              ctx.beginPath();
              ctx.ellipse(rx + sway * 1.1, gy - rLen * 0.88, 0.055 * scale, 0.2 * scale, sway * 0.04, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }
    ctx.restore();
  },

  _drawThemedSurfaceBuilding(ctx, hutX, toScreenX, toScreenY, scale, timeSec, cx, flags) {
    const { isNordic, isUral, isKalahari, isAbaco, isBudapest, isSinai, isAurora, isOxBelHa, isAtlantida } = flags;

    // Use photorealistic transparent architectural cutouts matched to each expedition biome
    const spriteKey = isAurora
      ? 'research'
      : isBudapest
        ? 'bathhouse'
        : isSinai || isAbaco || isOxBelHa || isAtlantida
          ? 'palapa'
          : 'cabin';
    const spriteW = isBudapest || isAurora ? 4.6 : spriteKey === 'palapa' ? 4.35 : 4.15;
    const drewPhoto = this._drawPhotoBuilding(ctx, spriteKey, hutX, toScreenX, toScreenY, scale, spriteW, {
      stoneTop: isAurora ? '#475569' : isBudapest ? '#d6ccb4' : isSinai ? '#c49664' : isUral ? '#9aa6b4' : isKalahari ? '#9e5c3e' : '#8d8576',
      stoneMid: isAurora ? '#334155' : isBudapest ? '#b5a98f' : isSinai ? '#9d7247' : isUral ? '#707d8c' : isKalahari ? '#7a442c' : '#6b6458',
      stoneBot: isAurora ? '#1e293b' : isBudapest ? '#7d725c' : isSinai ? '#735130' : '#464139',
      embedM: 0.14,
    });
    if (drewPhoto) {
      if (isAurora || isBudapest) {
        for (let st = 0; st < 3; st++) {
          const sx = toScreenX(cx - 1.15 + st * 1.15 + Math.sin(timeSec * 0.85 + st) * 0.38);
          const sy = toScreenY(-0.55 - ((timeSec * 0.58 + st * 0.34) % 1.5));
          ctx.fillStyle = isAurora ? 'rgba(165, 243, 252, 0.2)' : 'rgba(255, 251, 240, 0.24)';
          ctx.beginPath();
          ctx.ellipse(sx, sy, (0.58 + st * 0.15) * scale, 0.28 * scale, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return;
    }

    const halfW = isBudapest || isAurora ? 1.65 : isSinai ? 1.55 : 1.38;
    const foot = this._sampleSurfaceFooting(this.level, hutX, halfW);
    const floorWy = Math.min(foot.gyC, foot.gyHigh + 0.04);
    const hutGx = toScreenX(hutX);
    const hutGy = toScreenY(floorWy);

    this._drawGroundContactShadow(ctx, hutGx, toScreenY(foot.gyC) + 0.08 * scale, halfW * 1.15 * scale, scale, foot.slopeRad);

    if (isAurora) {
      // Silfra Geothermal Research Dome perched on black volcanic basalt terrace + rising caldera steam
      this._drawContouredFoundation(ctx, toScreenX, toScreenY, scale, hutX, halfW, floorWy - 0.14, {
        stoneTop: '#475569',
        stoneMid: '#334155',
        stoneBot: '#1e293b',
        capColor: 'rgba(94, 234, 212, 0.28)',
      });
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(hutGx - 1.48 * scale, hutGy - 1.75 * scale, 2.96 * scale, 1.68 * scale);
      // Illuminated teal-cyan glass observatory cupola dome & beacon antenna
      const dg = ctx.createRadialGradient(hutGx, hutGy - 2.0 * scale, 0.12 * scale, hutGx, hutGy - 1.75 * scale, 1.38 * scale);
      dg.addColorStop(0, '#a5f3fc');
      dg.addColorStop(0.55, '#0284c7');
      dg.addColorStop(1, '#0f172a');
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(hutGx, hutGy - 1.75 * scale, 1.32 * scale, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      // Panoramic warm laboratory window
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(hutGx - 0.85 * scale, hutGy - 1.25 * scale, 1.7 * scale, 0.56 * scale);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hutGx - 0.04 * scale, hutGy - 1.25 * scale, 0.08 * scale, 0.56 * scale);
      // Geothermal vapor plumes rising from volcanic fracture vents
      for (let st = 0; st < 3; st++) {
        const sx = toScreenX(cx - 1.1 + st * 1.1 + Math.sin(timeSec * 0.85 + st) * 0.4);
        const sy = toScreenY(-0.55 - ((timeSec * 0.6 + st * 0.35) % 1.6));
        ctx.fillStyle = 'rgba(165, 243, 252, 0.2)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, (0.62 + st * 0.16) * scale, 0.3 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (isBudapest) {
      // Historic 19th-century ochre Lukacs Thermal Bath cupola pavilion seated on carved travertine terrace
      this._drawContouredFoundation(ctx, toScreenX, toScreenY, scale, hutX, halfW, floorWy - 0.14, {
        stoneTop: '#d6ccb4',
        stoneMid: '#b5a98f',
        stoneBot: '#7d725c',
      });
      ctx.fillStyle = '#e7c97f';
      ctx.fillRect(hutGx - 1.55 * scale, hutGy - 2.1 * scale, 3.1 * scale, 2.0 * scale);
      // Warm cornice molding & arched thermal windows
      ctx.fillStyle = '#f5e7bd';
      ctx.fillRect(hutGx - 1.64 * scale, hutGy - 2.16 * scale, 3.28 * scale, 0.14 * scale);
      ctx.fillStyle = '#2d6a62';
      ctx.beginPath();
      ctx.arc(hutGx, hutGy - 2.16 * scale, 1.24 * scale, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#d4b468';
      ctx.beginPath();
      ctx.roundRect(hutGx - 0.24 * scale, hutGy - 3.62 * scale, 0.48 * scale, 0.24 * scale, 0.08 * scale);
      ctx.fill();
      for (const wxOff of [-0.55, 0.1]) {
        ctx.fillStyle = '#6e5c42';
        ctx.beginPath();
        ctx.roundRect(hutGx + (wxOff - 0.04) * scale, hutGy - 1.55 * scale, 0.53 * scale, 0.82 * scale, [0.24 * scale, 0.24 * scale, 0, 0]);
        ctx.fill();
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.roundRect(hutGx + wxOff * scale, hutGy - 1.5 * scale, 0.45 * scale, 0.72 * scale, [0.2 * scale, 0.2 * scale, 0, 0]);
        ctx.fill();
      }
      for (let st = 0; st < 3; st++) {
        const sx = toScreenX(cx - 1.2 + st * 1.2 + Math.sin(timeSec * 0.9 + st) * 0.35);
        const sy = toScreenY(-0.55 - ((timeSec * 0.55 + st * 0.33) % 1.4));
        ctx.fillStyle = 'rgba(255, 251, 240, 0.24)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, (0.55 + st * 0.15) * scale, 0.28 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (isSinai) {
      // Bedouin terracotta cliffside shade canopy grounded into sandstone terrace + anchored timber posts
      this._drawContouredFoundation(ctx, toScreenX, toScreenY, scale, hutX, halfW, floorWy - 0.08, {
        stoneTop: '#c49664',
        stoneMid: '#9d7247',
        stoneBot: '#735130',
      });
      const postL = toScreenY(foot.gyL);
      const postR = toScreenY(foot.gyR);
      const eaveY = hutGy - 1.75 * scale;
      ctx.fillStyle = '#7c340b';
      ctx.fillRect(hutGx - 1.45 * scale, eaveY, 0.15 * scale, Math.max(1.5 * scale, postL - eaveY + 0.14 * scale));
      ctx.fillRect(hutGx + 1.3 * scale, eaveY, 0.15 * scale, Math.max(1.5 * scale, postR - eaveY + 0.14 * scale));
      // Guy-line stakes anchoring tent eaves to ground boulders
      ctx.strokeStyle = 'rgba(226, 212, 184, 0.7)';
      ctx.lineWidth = Math.max(1, 0.035 * scale);
      ctx.beginPath();
      ctx.moveTo(hutGx - 1.7 * scale, eaveY + 0.12 * scale);
      ctx.lineTo(hutGx - 2.15 * scale, postL + 0.04 * scale);
      ctx.moveTo(hutGx + 1.7 * scale, eaveY + 0.12 * scale);
      ctx.lineTo(hutGx + 2.15 * scale, postR + 0.04 * scale);
      ctx.stroke();
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.moveTo(hutGx - 1.75 * scale, eaveY);
      ctx.quadraticCurveTo(hutGx, hutGy - 2.35 * scale, hutGx + 1.75 * scale, eaveY);
      ctx.lineTo(hutGx + 1.6 * scale, hutGy - 1.42 * scale);
      ctx.lineTo(hutGx - 1.6 * scale, hutGy - 1.42 * scale);
      ctx.closePath();
      ctx.fill();
      return;
    }

    // Expedition cabin / gauge shelter with stone masonry plinth & framed trim
    this._drawContouredFoundation(ctx, toScreenX, toScreenY, scale, hutX, halfW, floorWy - 0.1, {
      stoneTop: isUral ? '#9aa6b4' : isKalahari ? '#9e5c3e' : '#8d8576',
      stoneMid: isUral ? '#707d8c' : isKalahari ? '#7a442c' : '#6b6458',
      stoneBot: '#464139',
    });

    const wallCol = isUral ? '#d8e0e8' : isNordic ? '#473628' : isKalahari ? '#9a5b3c' : isAbaco ? '#e2e8f0' : '#b8ad9b';
    const roofCol = isUral ? '#0284c7' : isNordic ? '#991b1b' : isKalahari ? '#cbd5e1' : isAbaco ? '#0d9488' : '#b45309';
    ctx.fillStyle = wallCol;
    ctx.fillRect(hutGx - 1.3 * scale, hutGy - 2.0 * scale, 2.6 * scale, 1.92 * scale);
    // Corner trim boards & shaded roof overhang
    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.fillRect(hutGx - 1.3 * scale, hutGy - 2.0 * scale, 2.6 * scale, 0.14 * scale);
    ctx.fillStyle = roofCol;
    ctx.beginPath();
    ctx.moveTo(hutGx - 1.62 * scale, hutGy - 1.95 * scale);
    ctx.lineTo(hutGx, hutGy - 2.92 * scale);
    ctx.lineTo(hutGx + 1.62 * scale, hutGy - 1.95 * scale);
    ctx.closePath();
    ctx.fill();
    // Framed cabin window with center mullion
    ctx.fillStyle = '#332920';
    ctx.fillRect(hutGx - 0.47 * scale, hutGy - 1.5 * scale, 0.94 * scale, 0.66 * scale);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(hutGx - 0.41 * scale, hutGy - 1.44 * scale, 0.82 * scale, 0.54 * scale);
    ctx.fillStyle = '#473628';
    ctx.fillRect(hutGx - 0.03 * scale, hutGy - 1.44 * scale, 0.06 * scale, 0.54 * scale);
    ctx.fillRect(hutGx - 0.41 * scale, hutGy - 1.2 * scale, 0.82 * scale, 0.05 * scale);
  },

  /**
   * Shared themed expedition surface renderer for Nordic, Provence, Kalahari, Ural, & Abaco biomes.
   */
  _drawThemedExpeditionSurface(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec, style) {
    const isNordic =
      style === 'nordic-fjord' ||
      style === 'ural-birch' ||
      style === 'moravia-rift' ||
      style === 'nordic-mine' ||
      style === 'aurora-basalt' ||
      style === 'strytan-fjord' ||
      style === 'kverkfjoll-glacier' ||
      style === 'greenland-iceberg' ||
      style === 'grjotagja-rift' ||
      style === 'boybulok-steppe';
    const isUral = style === 'ural-birch';
    const isKalahari = style === 'kalahari-crater';
    const isAbaco = style === 'bahamas-abaco' || style === 'bermuda-sargasso';
    const isBudapest = style === 'budapest-bathhouse';
    const isSinai = style === 'sinai-coast';
    const isAtlantida = style === 'atlantida-lava';
    const isBarrenVolcanicOrGlacier = style === 'kverkfjoll-glacier' || style === 'greenland-iceberg' || style === 'grjotagja-rift';
    const isOxBelHa = style === 'oxbelha-twilight' || style === 'lagoa-cerrado';
    const isAurora =
      style === 'aurora-basalt' ||
      style === 'strytan-fjord' ||
      style === 'kverkfjoll-glacier' ||
      style === 'greenland-iceberg' ||
      style === 'grjotagja-rift';
    ctx.save();
    this._drawHorizonForestSpan(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec, style);

    for (const basin of this.level.openBasins) {
      if (basin.xMax + 14 < visX0 || basin.xMin - 14 > visX1) continue;
      const cx = (basin.xMin + basin.xMax) * 0.5;
      const waterLeft = this._findBasinCliffEdgeX(basin, -0.35, -1);
      const waterRight = this._findBasinCliffEdgeX(basin, -0.35, 1);
      const leftRimY = this._getHorizonGroundY(this.level, waterLeft - 2.6);
      const rightRimY = this._getHorizonGroundY(this.level, waterRight + 2.6);
      const topLeftX = this._findBasinCliffEdgeX(basin, leftRimY, -1) - 1.2;
      const topRightX = this._findBasinCliffEdgeX(basin, rightRimY, 1) + 1.2;

      const isEntry = basin.kind === 'entry';
      const stairTopX = isEntry ? topLeftX + 0.5 : topRightX - 0.5;
      const stairBotX = isEntry ? waterLeft + 0.55 : waterRight - 0.55;
      this._drawCliffStairs(
        ctx,
        toScreenX(stairTopX),
        toScreenY(this._getHorizonGroundY(this.level, stairTopX)),
        toScreenX(stairBotX),
        toScreenY(-0.5),
        scale,
        !isNordic
      );

      // Staging pier + steel dive ladder
      const deckX = toScreenX(isEntry ? waterLeft - 0.35 : waterRight - 2.45);
      const deckW = 2.8 * scale;
      const deckY = toScreenY(-0.5);
      ctx.fillStyle = isNordic ? '#475569' : '#8b7e6d';
      ctx.fillRect(deckX + (isEntry ? deckW * 0.72 : 0.2 * scale), deckY, 0.18 * scale, 2.2 * scale);
      ctx.fillStyle = isUral ? '#cbd5e1' : isNordic ? '#7c644c' : '#a89f8d';
      ctx.beginPath();
      ctx.roundRect(deckX, deckY, deckW, 0.22 * scale, 0.04 * scale);
      ctx.fill();

      const ladX = isEntry ? deckX + deckW - 0.25 * scale : deckX + 0.25 * scale;
      const dir = isEntry ? 1 : -1;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = Math.max(1.8, 0.085 * scale);
      ctx.beginPath();
      ctx.moveTo(ladX, deckY + 0.08 * scale);
      ctx.lineTo(ladX + dir * 0.42 * scale, toScreenY(2.05));
      ctx.stroke();
      for (let r = 0; r < 5; r++) {
        const ry = deckY + (0.36 + r * 0.4) * scale;
        const rx = ladX + dir * r * 0.08 * scale;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(rx - 0.14 * scale, ry, 0.3 * scale, 0.065 * scale);
      }

      // Expedition dive cabin / stone gauge shelter / Budapest domed thermal bathhouse / Sinai shade camp
      const hutX = isEntry ? topLeftX - 2.2 : topRightX + 2.2;
      this._drawThemedSurfaceBuilding(ctx, hutX, toScreenX, toScreenY, scale, timeSec, cx, {
        isNordic,
        isUral,
        isKalahari,
        isAbaco,
        isBudapest,
        isSinai,
        isAurora,
        isOxBelHa,
        isAtlantida,
      });

      if ((isKalahari || isOxBelHa || isAurora) && isEntry) {
        // Steel rescue recovery winch A-frame grounded with stone footing plates
        const winchX = topLeftX - 0.1;
        const footW = this._sampleSurfaceFooting(this.level, winchX, 0.75);
        const wx = toScreenX(winchX);
        const wy = toScreenY(footW.gyC);
        const wyL = toScreenY(footW.gyL);
        const wyR = toScreenY(footW.gyR);
        ctx.fillStyle = '#475569';
        ctx.fillRect(toScreenX(winchX - 0.75) - 0.12 * scale, wyL - 0.05 * scale, 0.24 * scale, 0.16 * scale);
        ctx.fillRect(toScreenX(winchX + 0.75) - 0.12 * scale, wyR - 0.05 * scale, 0.24 * scale, 0.16 * scale);
        ctx.strokeStyle = isOxBelHa ? '#f59e0b' : '#d97706';
        ctx.lineWidth = Math.max(2, 0.09 * scale);
        ctx.beginPath();
        ctx.moveTo(toScreenX(winchX - 0.75), wyL + 0.04 * scale);
        ctx.lineTo(wx + 0.08 * scale, wy - 2.35 * scale);
        ctx.lineTo(toScreenX(winchX + 0.75), wyR + 0.04 * scale);
        ctx.stroke();
      }

      // Flanking regional trees (or volcanic basalt/ice cairns on barren glacier/lava rims)
      const treeSpecs = [
        { wx: topLeftX - 5.0, h: 5.8 },
        { wx: topRightX + 1.0, h: 5.4 },
        { wx: topRightX + 4.4, h: 6.1 },
      ];
      for (let e = 0; e < treeSpecs.length; e++) {
        const ts = treeSpecs[e];
        const gy = toScreenY(this._getHorizonGroundY(this.level, ts.wx));
        const gx = toScreenX(ts.wx);
        const sway = Math.sin(timeSec * 1.2 + e * 1.8 + cx) * 0.07 * scale;
        if (isBarrenVolcanicOrGlacier) {
          const rockCol = style === 'kverkfjoll-glacier' ? '#67b7dc' : '#292524';
          this._drawAnchoredBoulder(ctx, ts.wx, 0.72 + e * 0.14, 0.34 + (e & 1) * 0.12, toScreenX, toScreenY, scale, rockCol);
        } else if (isNordic) {
          if ((e & 1) === 0) this._drawNorwaySpruce(ctx, ts.wx, toScreenX, toScreenY, scale, sway, ts.h);
          else this._drawSilverBirch(ctx, ts.wx, toScreenX, toScreenY, scale, sway, ts.h * 0.85);
        } else if (isKalahari) {
          this._drawUmbrellaAcacia(ctx, ts.wx, toScreenX, toScreenY, scale, sway * 0.7, ts.h * 0.9);
        } else if (isAbaco) {
          if (e === 1) this._drawBotanicalPalm(ctx, ts.wx, toScreenX, toScreenY, scale, 1, sway, ts.h * 0.82);
          else this._drawLongleafPine(ctx, ts.wx, toScreenX, toScreenY, scale, sway * 0.85, ts.h * 0.95);
        } else if (isSinai || isOxBelHa || isAtlantida) {
          this._drawBotanicalPalm(ctx, ts.wx, toScreenX, toScreenY, scale, e === 0 ? 1 : -1, sway * 0.75, ts.h * 0.78);
        } else if (isBudapest) {
          if (!this._drawPhotoTree(ctx, 'med', ts.wx, toScreenX, toScreenY, scale, sway * 0.5, ts.h * 0.94, { flipX: (e & 1) === 1, widthScale: 1.12 })) {
            this._drawTaperedCurvedTrunk(ctx, gx, gy + 0.06 * scale, gx + 0.08 * scale, gy - 0.85 * scale, gx, gy - 1.55 * scale, 0.17 * scale, 0.07 * scale, 6, ['#46382c', '#635141', '#7d6856'], false);
            this._drawFlaredTreeCollar(ctx, toScreenX, toScreenY, ts.wx, gx, gy, 0.17 * scale, scale, ['#46382c', '#635141', '#7d6856']);
            this._fillFoliageCluster(ctx, gx, gy - 1.8 * scale, 1.6 * scale, 1.05 * scale, 0, scale, 'jungle', 1);
          }
        } else {
          this._drawMediterraneanCypress(ctx, ts.wx, toScreenX, toScreenY, scale, sway, ts.h);
        }
      }

      // Surface marker buoy (Nordic glacial beacon / Cousteau gorge buoy)
      const buoyX = toScreenX(cx);
      const buoyY = toScreenY(Math.sin(cx * 0.95 + timeSec * 2.4) * 0.07);
      ctx.fillStyle = isNordic ? '#f8fafc' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(buoyX, buoyY - 0.16 * scale, 0.28 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isNordic ? '#dc2626' : '#eab308';
      ctx.beginPath();
      ctx.arc(buoyX, buoyY - 0.16 * scale, 0.28 * scale, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();
  }
};
