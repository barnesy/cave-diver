import { createChunkSDFEvaluator, createBoxSDFEvaluator } from '../collision.js';

export const CACHE_PX_PER_M = 24;
export const MOBILE_CACHE_PX_PER_M = 16;
export const BACK_PX_PER_M = 12;
export const CHUNK_W_M = 24;
export const CHUNK_H_M = 64; // Caps every canvas tile <= 1536px tall (avoids >4096px GPU overflow on L14-L20)
export const TEX_SIZE = 512;

const NO_HANGING_ROOTS_THEMES = new Set([
  'aurora-glacial',
  'strytan-hydrothermal',
  'kverkfjoll-glacier',
  'grjotagja-lava',
  'atlantida-volcanic',
  'boybulok-alpine',
  'dahab-red-sea',
  'kalahari-dolomite',
  'nordic-marble',
  'ural-gypsum-karst',
  'nordic-mine',
  'greenland-iceberg',
]);

const STAIN_MAP = {
  'tannin-chert': [22, 10, -20, 0.96, 18, 0.86, 6, 0.78, 0],
  'glacial-marble': [-18, 20, 28, 0.72, 0, 0.92, 8, 1.05, 14],
  'provence-ivory': [6, 22, -12, 0.88, 10, 0.9, 4, 0.72, 0],
  'kalahari-ironstone': [28, 10, -18, 1.08, 22, 0.82, 4, 0.56, 0],
  'ural-gypsum': [-10, 18, 24, 0.84, 18, 0.94, 16, 1.04, 22],
  'abaco-aragonite': [-14, 26, 18, 0.82, 0, 0.96, 8, 0.86, 4],
  'buda-thermal-marl': [16, 14, -14, 0.88, 12, 0.92, 6, 0.72, 0],
  'sinai-coral-sandstone': [24, 8, -18, 1.02, 18, 0.86, 8, 0.62, 0],
  'quercy-chalk': [-8, 16, 12, 0.84, 4, 0.9, 6, 0.88, 6],
  'lazio-travertine': [18, 14, -12, 0.9, 8, 0.92, 6, 0.74, 0],
  'moravia-carbonic': [-16, 8, 10, 0.78, 0, 0.84, 6, 0.86, 10],
  'oxbelha-dusk': [-18, 22, -8, 0.82, 0, 0.9, 4, 0.82, 6],
  'katla-basalt': [-18, 12, 26, 0.54, 4, 0.62, 10, 0.76, 22],
  'strytan-smectite': [-14, 18, 28, 0.62, 6, 0.74, 12, 0.84, 20],
  'kverkfjoll-ice': [-10, 24, 42, 0.68, 10, 0.88, 22, 1.06, 36],
  'grjotagja-obsidian': [10, -6, 18, 0.52, 8, 0.48, 2, 0.64, 14],
  'atlantida-basalt': [-10, 14, 24, 0.58, 6, 0.66, 10, 0.8, 18],
  'lagoa-cerrado': [-22, 30, -4, 0.84, 0, 0.94, 4, 0.82, 4],
  'boybulok-steppe': [14, 10, -10, 0.86, 10, 0.84, 4, 0.74, 0],
  'nordic-iron-mine': [14, 4, -8, 0.68, 8, 0.62, 4, 0.60, 4],
  'greenland-glacial': [-12, 26, 46, 0.62, 12, 0.92, 24, 1.08, 40],
  'bermuda-coral': [18, 12, 6, 0.94, 10, 0.92, 6, 0.88, 6],
};

export const chunkBakerMethods = {
  _buildBackChunks(level) {
    const { xMin, xMax } = level.bounds;
    const chunks = [];
    for (let cx0 = xMin; cx0 < xMax; cx0 += CHUNK_W_M) {
      chunks.push(this._buildBackChunk(level, cx0, Math.min(xMax, cx0 + CHUNK_W_M)));
    }
    return chunks;
  },

  _getHorizonGroundY(level, wx) {
    if (level?.isWreck) {
      if (typeof level.hullTopY === 'function') {
        return level.hullTopY(wx);
      }
      const deckY = level.wreckDeckY ?? 40;
      const seabedY = level.wreckSeabedY ?? (level.bounds?.yMax ?? 70) - 4;
      const hMin = level.wreckHullXMin ?? -20;
      const hMax = level.wreckHullXMax ?? 20;
      const slopeW = 8;
      if (wx >= hMin && wx <= hMax) {
        return deckY + Math.sin(wx * 0.22) * 0.25;
      }
      const dist = wx < hMin ? hMin - wx : wx - hMax;
      const t = Math.min(1, dist / slopeW);
      const ease = t * t * (3 - 2 * t);
      return deckY + (seabedY - deckY) * ease + Math.sin(wx * 0.14) * 0.35 * ease;
    }
    const base = (level.bounds?.yMin ?? -6) + 0.72;
    return base + Math.sin(wx * 0.17 + 0.6) * 0.42 + Math.cos(wx * 0.43 - 0.4) * 0.22;
  },

  _getTintedRockPattern(ctx, level, rockTexOverride) {
    if (!ctx?.createPattern || !rockTexOverride?.canvas) return null;
    const rt = level?.theme?.rockTint;
    if (!rt) {
      if (!this._rockPattern) {
        this._rockPattern = ctx.createPattern(rockTexOverride.canvas, 'repeat');
      }
      return this._rockPattern;
    }
    const key = `${level.theme?.id || level.id}|${rt[0]}|${rt[1]}|${rt[2]}|${rockTexOverride === this._defaultRockTex ? 'fb' : 'img'}`;
    let pat = this._tintedRockPatternCache.get(key);
    if (pat !== undefined) return pat;

    const src = rockTexOverride.data;
    const tileSize = 128;
    const tc = document.createElement('canvas');
    tc.width = tileSize;
    tc.height = tileSize;
    const tctx = tc.getContext('2d');
    if (src && tctx?.createImageData && tctx?.putImageData) {
      const img = tctx.createImageData(tileSize, tileSize);
      const out = img.data;
      const mR = rt[0] * 0.56;
      const mG = rt[1] * 0.56;
      const mB = rt[2] * 0.56;
      const step = TEX_SIZE / tileSize;
      for (let y = 0; y < tileSize; y++) {
        const sy = (y * step) & (TEX_SIZE - 1);
        for (let x = 0; x < tileSize; x++) {
          const sx = (x * step) & (TEX_SIZE - 1);
          const sIdx = (sy * TEX_SIZE + sx) * 4;
          const dIdx = (y * tileSize + x) * 4;
          const r = src[sIdx] * mR;
          const g = src[sIdx + 1] * mG;
          const b = src[sIdx + 2] * mB;
          out[dIdx] = r < 10 ? 10 : r > 255 ? 255 : r;
          out[dIdx + 1] = g < 12 ? 12 : g > 255 ? 255 : g;
          out[dIdx + 2] = b < 12 ? 12 : b > 255 ? 255 : b;
          out[dIdx + 3] = 255;
        }
      }
      tctx.putImageData(img, 0, 0);
      pat = ctx.createPattern(tc, 'repeat');
    } else {
      pat = ctx.createPattern(rockTexOverride.canvas, 'repeat');
    }
    if (this._tintedRockPatternCache.size > 16) this._tintedRockPatternCache.clear();
    this._tintedRockPatternCache.set(key, pat);
    return pat;
  },

  _buildBackChunk(level, cx0, cx1, backTexOverride = this.backTex) {
    const { xMin, yMin, yMax } = level.bounds;
    const h = Math.ceil((yMax - yMin) * BACK_PX_PER_M);
    const tex = backTexOverride.data;
    const w = Math.ceil((cx1 - cx0) * BACK_PX_PER_M);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const data = img.data;

    const evalChunkSdf = createChunkSDFEvaluator(level, cx0, cx1);
    const basins = level.openBasins || [];
    const bt = level.theme?.backTint;
    const fixedBtR = bt ? bt[0] : 0;
    const fixedBtG = bt ? bt[1] : 0;
    const fixedBtB = bt ? bt[2] : 0;
    const STEP = 8;
    const invPpm = 1 / BACK_PX_PER_M;
    const gxBase = Math.floor((cx0 - xMin) * BACK_PX_PER_M);

    // Precompute 1D horizon ground curve once per chunk (eliminates ~250k redundant sin/cos calls)
    const topGroundYByPx = new Float32Array(w);
    let maxTopGroundY = -Infinity;
    for (let px = 0; px < w; px++) {
      const gy = this._getHorizonGroundY(level, cx0 + px * invPpm);
      topGroundYByPx[px] = gy;
      if (gy > maxTopGroundY) maxTopGroundY = gy;
    }

    for (let by = 0; by < h; by += STEP) {
      const pyEnd = Math.min(h, by + STEP);
      const midWy = yMin + (by + (pyEnd - by) * 0.5) * invPpm;
      const belowHorizon = yMin + by * invPpm >= maxTopGroundY + 0.05;
      for (let bx = 0; bx < w; bx += STEP) {
        const pxEnd = Math.min(w, bx + STEP);
        const midWx = cx0 + (bx + (pxEnd - bx) * 0.5) * invPpm;
        // 8x8 coarse skip: blocks strictly deep inside foreground rock or high in open air have alpha=0
        if (!belowHorizon && midWy + 1.0 < topGroundYByPx[Math.min(w - 1, bx + 4)]) continue;
        const cSdf = evalChunkSdf(midWx, midWy);
        if (cSdf > 1.25) continue;

        // Deep open-cavern fast path: strictly inside tunnel (wallDist===1) and below skylight band
        if (belowHorizon && midWy > 12.2 && cSdf < -4.2) {
          for (let py = by; py < pyEnd; py++) {
            const wy = yMin + py * invPpm;
            const ty = (py * 2) & (TEX_SIZE - 1);
            const haloShift = wy > level.haloclineY ? Math.min(1, (wy - level.haloclineY) / 14) : 0;
            const depthShade = Math.max(0.45, 0.92 - Math.max(0, wy) * 0.008);
            const mulR = depthShade * (bt ? fixedBtR : 0.72 + haloShift * 0.18);
            const mulG = depthShade * (bt ? fixedBtG : 0.86 - haloShift * 0.06);
            const mulB = depthShade * (bt ? fixedBtB : 0.94 - haloShift * 0.14);
            const rowTexBase = ty * TEX_SIZE;
            const rowOutBase = py * w;
            for (let px = bx; px < pxEnd; px++) {
              const idx = (rowOutBase + px) * 4;
              const tx = ((gxBase + px) * 2) & (TEX_SIZE - 1);
              const tIdx = (rowTexBase + tx) * 4;
              const r = tex[tIdx] * mulR;
              const g = tex[tIdx + 1] * mulG;
              const b = tex[tIdx + 2] * mulB;
              data[idx] = r > 255 ? 255 : r;
              data[idx + 1] = g > 255 ? 255 : g;
              data[idx + 2] = b > 255 ? 255 : b;
              data[idx + 3] = 246;
            }
          }
          continue;
        }

        for (let py = by; py < pyEnd; py++) {
          const wy = yMin + py * invPpm;
          const ty = (py * 2) & (TEX_SIZE - 1);
          const haloShift = wy > level.haloclineY ? Math.min(1, (wy - level.haloclineY) / 14) : 0;
          const depthShade = Math.max(0.45, 0.92 - Math.max(0, wy) * 0.008);
          const tintR = bt ? fixedBtR : 0.72 + haloShift * 0.18;
          const tintG = bt ? fixedBtG : 0.86 - haloShift * 0.06;
          const tintB = bt ? fixedBtB : 0.94 - haloShift * 0.14;
          const checkSkylight = wy < 11.5;
          const rowTexBase = ty * TEX_SIZE;
          const rowOutBase = py * w;

          for (let px = bx; px < pxEnd; px++) {
            if (!belowHorizon && wy < topGroundYByPx[px]) continue;
            const wx = cx0 + px * invPpm;
            const sdf = evalChunkSdf(wx, wy);
            if (sdf >= 0.45) continue;

            let skylight = 0;
            if (checkSkylight) {
              for (let b = 0; b < basins.length; b++) {
                const basin = basins[b];
                const bcx = (basin.xMin + basin.xMax) * 0.5;
                const rim = basin.rimHalf || 5.2;
                const inMouthX = Math.abs(wx - bcx) / (rim + 3.2);
                if (wy <= 0.3 && sdf < 0.05 && inMouthX < 1.25) {
                  skylight = 1;
                  break;
                }
                const distX = Math.abs(wx - bcx) / (rim + 0.8);
                const distY = Math.max(0, wy) / 11.5;
                const hole = Math.max(0, 1 - Math.sqrt(distX * distX * 0.6724 + distY * distY));
                if (hole > skylight) skylight = hole;
              }
              if (skylight >= 0.995) continue;
            }

            const idx = (rowOutBase + px) * 4;
            const tx = ((gxBase + px) * 2) & (TEX_SIZE - 1);
            const tIdx = (rowTexBase + tx) * 4;

            const wallDist = Math.min(1, Math.max(0, -sdf) / 3.4);
            const tubeShade = 0.44 + 0.56 * Math.sqrt(wallDist);
            const tintMul = tubeShade * depthShade;

            const r = tex[tIdx] * tintMul * tintR;
            const g = tex[tIdx + 1] * tintMul * tintG;
            const b = tex[tIdx + 2] * tintMul * tintB;

            data[idx] = r > 255 ? 255 : r;
            data[idx + 1] = g > 255 ? 255 : g;
            data[idx + 2] = b > 255 ? 255 : b;
            data[idx + 3] = Math.round((1 - skylight) * 246);
          }
        }
      }
    }

    ctx.putImageData(img, 0, 0);
    return { x0: cx0, x1: cx1, y0: yMin, y1: yMax, canvas: c };
  },

  _buildRockChunks(level) {
    const { xMin, xMax, yMin, yMax } = level.bounds;
    const chunks = [];
    for (let cx0 = xMin; cx0 < xMax; cx0 += CHUNK_W_M) {
      const cx1 = Math.min(xMax, cx0 + CHUNK_W_M);
      for (let cy0 = yMin; cy0 < yMax; cy0 += CHUNK_H_M) {
        chunks.push(this._buildRockChunk(level, cx0, cx1, this.rockTex, this.foliageTex, cy0, Math.min(yMax, cy0 + CHUNK_H_M)));
      }
    }
    return chunks;
  },

  _buildRockChunk(
    level,
    cx0,
    cx1,
    rockTexOverride = this.rockTex,
    foliageTexOverride = this.foliageTex,
    cy0 = level.bounds.yMin,
    cy1 = level.bounds.yMax
  ) {
    const { xMin, yMin } = level.bounds;
    const ppm = this._rockPxPerM || CACHE_PX_PER_M;
    const h = Math.ceil((cy1 - cy0) * ppm);
    const tex = rockTexOverride.data;
    const fol = foliageTexOverride?.data;
    const w = Math.ceil((cx1 - cx0) * ppm);

    // 2D-pruned box SDF evaluator (X and Y): skips distant upper/lower tiers & detects pure solid-rock tiles (v171)
    const evalChunkSdf = createBoxSDFEvaluator(level, cx0, cx1, cy0, cy1, 8.0);
    const invPpm = 1 / ppm;
    const topGroundYByPx = new Float32Array(w);
    let maxTopGroundY = -Infinity;
    for (let px = 0; px < w; px++) {
      const gy = this._getHorizonGroundY(level, cx0 + px * invPpm);
      topGroundYByPx[px] = gy;
      if (gy > maxTopGroundY) maxTopGroundY = gy;
    }

    // Sparse Rock-Tile Fast Path: tile has zero intersecting cave corridors/basins and lies below topsoil -> 0 VRAM canvas!
    if (!evalChunkSdf.hasGeometry && cy0 > maxTopGroundY + 1.2) {
      return { x0: cx0, x1: cx1, y0: cy0, y1: cy1, solidRock: true, canvas: null };
    }

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const data = img.data;

    const basins = level.openBasins || [];
    const basinCenters = new Float32Array(basins.length);
    for (let b = 0; b < basins.length; b++) {
      basinCenters[b] = (basins[b].xMin + basins[b].xMax) * 0.5;
    }

    const rt = level.theme?.rockTint;
    const mulR = rt ? rt[0] * 0.62 : 0.62;
    const mulG = rt ? rt[1] * 0.62 : 0.62;
    const mulB = rt ? rt[2] * 0.62 : 0.62;
    const mossKind = level.theme?.mossTint || 'emerald';
    const isAridTopsoil = mossKind === 'sinai-coral-sandstone' || mossKind === 'kalahari-ironstone';
    const isIceVein = mossKind === 'kverkfjoll-ice' || mossKind === 'glacial-marble' || mossKind === 'ural-gypsum';
    const [wR, wG, wB, lRm, lRa, lGm, lGa, lBm, lBa] = STAIN_MAP[mossKind] || [-26, 34, -8, 0.85, 0, 0.92, 0, 0.82, 0];

    const STEP = 8;
    const gxBase = Math.floor((cx0 - xMin) * ppm);
    const gyBase = Math.floor((cy0 - yMin) * ppm);

    for (let by = 0; by < h; by += STEP) {
      const pyEnd = Math.min(h, by + STEP);
      const byWy = cy0 + by * invPpm;
      const midWy = cy0 + (by + (pyEnd - by) * 0.5) * invPpm;
      const blockBelowTurf = byWy > maxTopGroundY + 1.2;

      for (let bx = 0; bx < w; bx += STEP) {
        const pxEnd = Math.min(w, bx + STEP);
        const midWx = cx0 + (bx + (pxEnd - bx) * 0.5) * invPpm;
        const midTopY = topGroundYByPx[Math.min(w - 1, bx + 4)];
        if (!blockBelowTurf && midWy + 0.8 < midTopY) continue;

        const cSdf = evalChunkSdf(midWx, midWy);
        // 8x8 coarse skip: strictly inside open tunnel water (alpha stays 0)
        if (cSdf < -0.95) continue;

        // 8x8 ultra-fast deep rock interior fill: zero SDF calls, zero topsoil checks
        if (cSdf > 1.75 && blockBelowTurf) {
          for (let py = by; py < pyEnd; py++) {
            const wy = cy0 + py * invPpm;
            const ty = (gyBase + py) & (TEX_SIZE - 1);
            const depthDarken = Math.max(0.42, 0.88 - Math.max(0, wy) * 0.0085);
            const mR = mulR * depthDarken;
            const mG = mulG * depthDarken;
            const mB = mulB * depthDarken;
            const rowTexBase = ty * TEX_SIZE;
            const rowOutBase = py * w;
            for (let px = bx; px < pxEnd; px++) {
              const idx = (rowOutBase + px) * 4;
              const tx = (gxBase + px) & (TEX_SIZE - 1);
              const tIdx = (rowTexBase + tx) * 4;
              const r = tex[tIdx] * mR;
              const g = tex[tIdx + 1] * mG;
              const b = tex[tIdx + 2] * mB;
              data[idx] = r < 10 ? 10 : r > 255 ? 255 : r;
              data[idx + 1] = g < 12 ? 12 : g > 255 ? 255 : g;
              data[idx + 2] = b < 12 ? 12 : b > 255 ? 255 : b;
              data[idx + 3] = 255;
            }
          }
          continue;
        }

        const deepRockBlock = cSdf > 1.75 && byWy >= midTopY + 0.5;

        for (let py = by; py < pyEnd; py++) {
          const wy = cy0 + py * invPpm;
          const ty = (gyBase + py) & (TEX_SIZE - 1);
          const depthDarken = Math.max(0.42, 0.88 - Math.max(0, wy) * 0.0085);
          const inVerticalMossBand = wy > -5.5 && wy < 13.5;
          const rowTexBase = ty * TEX_SIZE;
          const rowOutBase = py * w;

          for (let px = bx; px < pxEnd; px++) {
            const topGroundY = topGroundYByPx[px];
            if (!blockBelowTurf && wy < topGroundY) continue;

            const wx = cx0 + px * invPpm;
            const sdf = deepRockBlock ? 2.0 : evalChunkSdf(wx, wy);
            if (sdf < 0) continue;

            const idx = (rowOutBase + px) * 4;
            const tx = (gxBase + px) & (TEX_SIZE - 1);
            const tIdx = (rowTexBase + tx) * 4;

            let baseR;
            let baseG;
            let baseB;

            if (deepRockBlock) {
              baseR = tex[tIdx] * mulR * depthDarken;
              baseG = tex[tIdx + 1] * mulG * depthDarken;
              baseB = tex[tIdx + 2] * mulB * depthDarken;
            } else {
              const edgeShadow = sdf < 0.42 ? 0.56 + (sdf / 0.42) * 0.44 : 1.0;
              let rimCatchlight = sdf < 0.1 ? (1 - sdf / 0.1) * 22 : 0;
              // Sculpted 2.5D top-lit wall bevel using 2-sample local SDF normal (0ms runtime cost)
              let bevelShade = 1.0;
              if (sdf < 0.36) {
                const gx = evalChunkSdf(wx + 0.14, wy) - sdf;
                const gy = evalChunkSdf(wx, wy + 0.14) - sdf;
                const gLen = Math.sqrt(gx * gx + gy * gy) || 1;
                // Outward-into-water normal is (-gx/gLen, -gy/gLen); light from upper-left (-0.35, -0.94)
                const ndotl = (gx * 0.35 + gy * 0.94) / gLen;
                const rimWeight = 1 - sdf / 0.36;
                bevelShade = 1 + ndotl * 0.24 * rimWeight;
                if (ndotl > 0.25 && sdf < 0.14) {
                  rimCatchlight += ndotl * (1 - sdf / 0.14) * 16;
                }
              }
              let wallMoss = 0;
              if (inVerticalMossBand && sdf < 0.85) {
                let minBasinDx = Infinity;
                for (let bIdx = 0; bIdx < basinCenters.length; bIdx++) {
                  const dx = Math.abs(wx - basinCenters[bIdx]);
                  if (dx < minBasinDx) minBasinDx = dx;
                }
                if (minBasinDx < 12) {
                  wallMoss = (1 - sdf / 0.85) * Math.max(0, 1 - Math.max(0, wy) / 13.5);
                }
              }
              const edgeMul = edgeShadow * bevelShade * depthDarken;
              baseR = (tex[tIdx] * mulR + rimCatchlight) * edgeMul + wallMoss * wR;
              baseG = (tex[tIdx + 1] * mulG + rimCatchlight * 0.96) * edgeMul + wallMoss * wG;
              baseB = (tex[tIdx + 2] * mulB + rimCatchlight * (isIceVein ? 1.15 : 0.88)) * edgeMul + wallMoss * wB;
              // Subtle mineral/ice strata veins along rock edges
              if (sdf < 0.9) {
                const strata = Math.sin(wy * 3.1 + Math.sin(wx * 0.55) * 1.8);
                if (strata > 0.88) {
                  const vein = (strata - 0.88) * 120 * (1 - sdf / 0.9);
                  baseR += isIceVein ? vein * 0.55 : vein * 0.9;
                  baseG += isIceVein ? vein * 0.95 : vein * 0.86;
                  baseB += isIceVein ? vein * 1.25 : vein * 0.72;
                }
              }
            }

            if (!blockBelowTurf) {
              const turfDepth = wy - topGroundY;
              if (turfDepth < 1.16) {
                const loamLimit = 0.92 + Math.sin(wx * 2.1) * 0.16 + Math.cos(wx * 4.7) * 0.08;
                if (turfDepth < loamLimit) {
                  const soilWeight = 1 - Math.max(0, turfDepth) / loamLimit;
                  const grassWeight = Math.max(0, 1 - turfDepth / 0.42);
                  const fR = fol ? fol[tIdx] : 42;
                  const fG = fol ? fol[tIdx + 1] : 78;
                  const fB = fol ? fol[tIdx + 2] : 34;
                  const leafR = isAridTopsoil ? 148 + (fR - 50) * 0.45 : fR * lRm + lRa;
                  const leafG = isAridTopsoil ? 104 + (fG - 50) * 0.35 : fG * lGm + lGa;
                  const leafB = isAridTopsoil ? 66 + (fB - 50) * 0.25 : fB * lBm + lBa;
                  const subR = isAridTopsoil ? 112 : 52;
                  const subG = isAridTopsoil ? 76 : 40;
                  const subB = isAridTopsoil ? 48 : 28;
                  const surfR = subR * (1 - grassWeight) + leafR * grassWeight;
                  const surfG = subG * (1 - grassWeight) + leafG * grassWeight;
                  const surfB = subB * (1 - grassWeight) + leafB * grassWeight;
                  const blend = Math.min(0.94, soilWeight * 1.15);
                  baseR = baseR * (1 - blend) + surfR * blend;
                  baseG = baseG * (1 - blend) + surfG * blend;
                  baseB = baseB * (1 - blend) + surfB * blend;
                }
              }
              data[idx + 3] = turfDepth < 0.065 ? Math.round(255 * Math.max(0.14, turfDepth / 0.065)) : 255;
            } else {
              data[idx + 3] = 255;
            }

            data[idx] = baseR < 10 ? 10 : baseR > 255 ? 255 : baseR;
            data[idx + 1] = baseG < 12 ? 12 : baseG > 255 ? 255 : baseG;
            data[idx + 2] = baseB < 12 ? 12 : baseB > 255 ? 255 : baseB;
          }
        }
      }
    }

    ctx.putImageData(img, 0, 0);

    // Paint theme-tinted bitmap-textured speleothems & layered boulders (skip cave stalactites on steel shipwrecks)
    if (level.isWreck) {
      return { x0: cx0, x1: cx1, y0: cy0, y1: cy1, canvas: c };
    }
    const pat = this._getTintedRockPattern(ctx, level, rockTexOverride);
    const toCacheX = (wx) => (wx - cx0) * ppm;
    const toCacheY = (wy) => (wy - cy0) * ppm;
    const localNormalY = (wx, wy) => {
      const e = 0.1;
      const gx = evalChunkSdf(wx + e, wy) - evalChunkSdf(wx - e, wy);
      const gy = evalChunkSdf(wx, wy + e) - evalChunkSdf(wx, wy - e);
      const len = Math.sqrt(gx * gx + gy * gy) || 1;
      return -gy / len;
    };

    for (let sIdx = 0; sIdx < level.segments.length; sIdx++) {
      const seg = level.segments[sIdx];
      const segLen = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
      const count = Math.max(2, Math.floor(segLen / 3.4));

      for (let k = 1; k < count; k++) {
        const t = k / count;
        const cx = seg.ax + (seg.bx - seg.ax) * t;
        if (cx < cx0 - 2.5 || cx > cx1 + 2.5) continue;
        const cy = seg.ay + (seg.by - seg.ay) * t;
        const r = seg.ra + (seg.rb - seg.ra) * t;
        if (r < 2.55 || cy < 2.5 || cy + r + 9 < cy0 || cy - r - 9 > cy1) continue;

        const seed = Math.sin(sIdx * 31.7 + k * 17.3) * 43758.5453;
        const hash = seed - Math.floor(seed);

        // Probe ceiling wall straight up for eroded stalactite / icicle formations
        for (let step = 0; step < 32; step++) {
          const py = cy - step * 0.28;
          if (evalChunkSdf(cx, py) >= 0) {
            if (py >= cy0 - 2 && py <= cy1 + 2 && localNormalY(cx, py) < -0.35 && hash > 0.24) {
              const len = (0.5 + hash * 0.85) * ppm;
              const baseW = (0.16 + (1 - hash) * 0.16) * ppm;
              const sx = toCacheX(cx);
              const sy = toCacheY(py) - 3;

              ctx.save();
              ctx.beginPath();
              ctx.moveTo(sx - baseW, sy);
              ctx.bezierCurveTo(sx - baseW * 0.5, sy + len * 0.35, sx - baseW * 0.22, sy + len * 0.72, sx + baseW * 0.08, sy + len);
              ctx.bezierCurveTo(sx + baseW * 0.32, sy + len * 0.68, sx + baseW * 0.55, sy + len * 0.32, sx + baseW, sy);
              ctx.closePath();
              ctx.fillStyle = pat || '#47433e';
              ctx.fill();
              ctx.fillStyle = isIceVein ? 'rgba(186, 230, 253, 0.14)' : 'rgba(20, 22, 26, 0.30)';
              ctx.fill();
              ctx.strokeStyle = isIceVein ? 'rgba(224, 242, 254, 0.32)' : 'rgba(226, 232, 240, 0.16)';
              ctx.lineWidth = 1.2;
              ctx.stroke();
              ctx.restore();
            }
            break;
          }
        }

        // Probe floor straight down for eroded stalagmites & textured karst breakdown slabs
        for (let step = 0; step < 32; step++) {
          const py = cy + step * 0.28;
          if (evalChunkSdf(cx, py) >= 0) {
            if (py >= cy0 - 2 && py <= cy1 + 2 && localNormalY(cx, py) > 0.35) {
              const sx = toCacheX(cx);
              const sy = toCacheY(py) + 3;
              ctx.save();
              if (hash < 0.5) {
                const len = (0.44 + hash * 0.8) * ppm;
                const baseW = (0.18 + hash * 0.16) * ppm;
                ctx.beginPath();
                ctx.moveTo(sx - baseW, sy);
                ctx.bezierCurveTo(sx - baseW * 0.55, sy - len * 0.36, sx - baseW * 0.22, sy - len * 0.72, sx - baseW * 0.05, sy - len);
                ctx.bezierCurveTo(sx + baseW * 0.25, sy - len * 0.7, sx + baseW * 0.6, sy - len * 0.32, sx + baseW, sy);
                ctx.closePath();
              } else {
                const bw = (0.38 + (hash - 0.5) * 0.85) * ppm;
                const bh = bw * (0.52 + hash * 0.18);
                const by = sy - bh * 0.3;
                ctx.beginPath();
                ctx.ellipse(sx, by, bw, bh, (hash - 0.5) * 0.35, 0, Math.PI * 2);
              }
              ctx.fillStyle = pat || '#3f3c38';
              ctx.fill();
              ctx.fillStyle = isIceVein ? 'rgba(186, 230, 253, 0.12)' : 'rgba(18, 20, 24, 0.28)';
              ctx.fill();
              ctx.strokeStyle = isIceVein ? 'rgba(224, 242, 254, 0.28)' : 'rgba(245, 245, 244, 0.14)';
              ctx.lineWidth = 1.2;
              ctx.stroke();
              ctx.restore();
            }
            break;
          }
        }
      }
    }

    // Hanging tree roots along forested Cenote/Karst basin rims (only in top tile containing y=0)
    if (cy0 <= 4 && cy1 >= 0 && !NO_HANGING_ROOTS_THEMES.has(level.theme?.id)) {
      for (const basin of level.openBasins) {
        if (basin.xMax < cx0 - 2 || basin.xMin > cx1 + 2) continue;
        for (let i = 0; i < 8; i++) {
          const rx = basin.xMin + 1.4 + (i / 7) * (basin.xMax - basin.xMin - 2.8);
          if (rx < cx0 - 1 || rx > cx1 + 1) continue;
          const rootLen = 1.6 + ((i * 37) % 10) * 0.24;
          ctx.strokeStyle = i % 2 === 0 ? 'rgba(63, 98, 42, 0.82)' : 'rgba(113, 63, 18, 0.72)';
          ctx.lineWidth = i % 2 === 0 ? 2.4 : 1.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(toCacheX(rx), toCacheY(0));
          ctx.quadraticCurveTo(
            toCacheX(rx + (i % 2 === 0 ? 0.35 : -0.35)),
            toCacheY(rootLen * 0.55),
            toCacheX(rx + (i % 2 === 0 ? -0.15 : 0.2)),
            toCacheY(rootLen)
          );
          ctx.stroke();
        }
      }
    }

    return { x0: cx0, x1: cx1, y0: cy0, y1: cy1, canvas: c };
  },

  _getSolidRockPattern(ctx) {
    const rt = this.level?.theme?.rockTint;
    const key = `${this.level?.id || ''}|${rt ? rt.join(',') : 'def'}`;
    if (this._solidRockPattern && this._solidRockPatternKey === key) {
      return this._solidRockPattern;
    }
    this._solidRockPatternKey = key;
    if (!this.rockTex?.data || typeof document === 'undefined' || !ctx.createPattern) {
      this._solidRockPattern = null;
      return null;
    }
    const sz = 128;
    const tc = document.createElement('canvas');
    tc.width = sz;
    tc.height = sz;
    const tctx = tc.getContext('2d');
    const img = tctx.createImageData(sz, sz);
    const out = img.data;
    const tex = this.rockTex.data;
    const mulR = (rt ? rt[0] : 1) * 0.62 * 0.66;
    const mulG = (rt ? rt[1] : 1) * 0.62 * 0.66;
    const mulB = (rt ? rt[2] : 1) * 0.62 * 0.66;
    const step = Math.max(1, Math.floor(TEX_SIZE / sz));
    for (let y = 0; y < sz; y++) {
      const ty = (y * step) & (TEX_SIZE - 1);
      for (let x = 0; x < sz; x++) {
        const tx = (x * step) & (TEX_SIZE - 1);
        const ti = (ty * TEX_SIZE + tx) * 4;
        const oi = (y * sz + x) * 4;
        out[oi] = Math.max(10, Math.min(255, tex[ti] * mulR));
        out[oi + 1] = Math.max(12, Math.min(255, tex[ti + 1] * mulG));
        out[oi + 2] = Math.max(12, Math.min(255, tex[ti + 2] * mulB));
        out[oi + 3] = 255;
      }
    }
    tctx.putImageData(img, 0, 0);
    this._solidRockPattern = ctx.createPattern(tc, 'repeat');
    return this._solidRockPattern;
  },

  _drawChunks(ctx, chunks, pxPerM, yMin, visX0, visY0, visX1, visY1, toScreenX, toScreenY, scale) {
    if (visX1 <= visX0 || visY1 <= visY0 || !chunks) return;

    for (let i = 0; i < chunks.length; i++) {
      const chnk = chunks[i];
      const cx0 = Math.max(visX0, chnk.x0);
      const cx1 = Math.min(visX1, chnk.x1);
      if (cx1 <= cx0) continue;

      const tileY0 = chnk.y0 ?? yMin;
      const tileY1 = chnk.y1 ?? visY1;
      const cy0 = Math.max(visY0, tileY0);
      const cy1 = Math.min(visY1, tileY1);
      if (cy1 <= cy0) continue;

      const dx = toScreenX(cx0);
      const dy = toScreenY(cy0);
      const dw = (cx1 - cx0) * scale;
      const dh = (cy1 - cy0) * scale;

      if (chnk.solidRock || !chnk.canvas) {
        const pat = this._getSolidRockPattern(ctx);
        ctx.save();
        if (pat) {
          ctx.translate(toScreenX(this.level.bounds.xMin), toScreenY(yMin));
          const tileScale = (scale / pxPerM) * (TEX_SIZE / 128);
          ctx.scale(tileScale, tileScale);
          ctx.fillStyle = pat;
          ctx.fillRect(
            (cx0 - this.level.bounds.xMin) * pxPerM * (128 / TEX_SIZE),
            (cy0 - yMin) * pxPerM * (128 / TEX_SIZE),
            (cx1 - cx0) * pxPerM * (128 / TEX_SIZE) + 1,
            (cy1 - cy0) * pxPerM * (128 / TEX_SIZE) + 1
          );
        } else {
          ctx.fillStyle = '#181e27';
          ctx.fillRect(dx, dy, dw + 1, dh + 1);
        }
        ctx.restore();
        continue;
      }

      const sx0 = (cx0 - chnk.x0) * pxPerM;
      const sw = (cx1 - cx0) * pxPerM;
      const sy0 = (cy0 - tileY0) * pxPerM;
      const sh = (cy1 - cy0) * pxPerM;
      ctx.drawImage(chnk.canvas, sx0, sy0, sw, sh, dx, dy, dw, dh);
    }
  }
};
