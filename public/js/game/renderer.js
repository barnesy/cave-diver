import { evaluateCaveSDF, evaluateCaveNormal, createChunkSDFEvaluator } from './collision.js';
import { createDiverBody } from './diverBody.js';
import { castTorchFan, castSunCurtain } from './lighting.js';
import { sampleSiltDensity } from './silt.js';
import { getAscentInstruction } from '../physics/diveModel.js';
import { getAscentConfig } from '../levels/index.js';
import {
  createGlowStamps,
  drawStyledFish,
  drawStyledTurtle,
  drawStyledRemipede,
  drawStyledDiverRig,
} from './artSprites.js';

const CACHE_PX_PER_M = 24;
const BACK_PX_PER_M = 12;
const CHUNK_W_M = 24;
const TEX_SIZE = 512;
const MAX_CACHED_LEVELS = 5;

const nextFrame = () =>
  new Promise((resolve) => {
    if (typeof document !== 'undefined' && document.hidden) {
      setTimeout(resolve, 0);
      return;
    }
    if (typeof requestAnimationFrame === 'function') {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      requestAnimationFrame(done);
      // Fallback timer so background/throttled tabs never stall chunk baking at e.g. 92%
      setTimeout(done, 34);
    } else {
      setTimeout(resolve, 0);
    }
  });

export class CaveRenderer {
  constructor(canvas, level, { deferBuild = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.level = level;

    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d');

    this.glowStamps = createGlowStamps();
    this._defaultRockTex = this._makeFallbackTex(false);
    this._defaultBackTex = this._makeFallbackTex(true);
    this._defaultFoliageTex = this._makeFallbackTex('foliage');
    this.rockTex = this._defaultRockTex;
    this.backTex = this._defaultBackTex;
    this.foliageTex = this._defaultFoliageTex;
    this.foliagePattern = null;
    this._rockPattern = null;
    this.skyBackdropImg = null;

    this._rawImageCache = new Map();
    this._bitmapAssetCache = new Map();
    this._bakedLevelCache = new Map();
    this._loadEpoch = 0;

    this.backChunks = [];
    this.rockChunks = [];
    this.dustMotes = [];
    this._sunCurtainCache = new Map();
    this._skyGradCache = null;
    this._vignetteCache = null;
    this.ready = false;
    this.camX = level.spawn.x;
    this.camY = level.spawn.y;
    this.pxPerM = 28; // Dynamically adjusted by viewport size

    if (!deferBuild) {
      this.backChunks = this._buildBackChunks(level);
      this.rockChunks = this._buildRockChunks(level);
      this.dustMotes = this._buildDustMotes(level);
      this.ready = true;
      this._loadBitmapTextures();
    }
  }

  isLevelCached(levelId) {
    return this._bakedLevelCache.has(levelId);
  }

  _saveBakedLevel(entry) {
    const id = entry?.level?.id;
    if (!id) return;
    if (this._bakedLevelCache.has(id)) {
      this._bakedLevelCache.delete(id);
    }
    this._bakedLevelCache.set(id, entry);
    while (this._bakedLevelCache.size > MAX_CACHED_LEVELS) {
      const oldestKey = this._bakedLevelCache.keys().next().value;
      if (oldestKey) this._bakedLevelCache.delete(oldestKey);
      else break;
    }
  }

  _applyBakedLevel(entry) {
    this.level = entry.level;
    this.rockTex = entry.rockTex;
    this.backTex = entry.backTex;
    this.foliageTex = entry.foliageTex;
    this.foliagePattern = entry.foliagePattern;
    this._rockPattern = null;
    this.skyBackdropImg = entry.skyBackdropImg;
    this.backChunks = entry.backChunks;
    this.rockChunks = entry.rockChunks;
    this.dustMotes = entry.dustMotes;
    this._sunCurtainCache.clear();
    this.camX = entry.level.spawn.x;
    this.camY = entry.level.spawn.y;
    this.ready = true;
  }

  /**
   * Swap to a different level definition and rebuild (or restore cached) rock/background chunks.
   */
  async setLevel(nextLevel, opts = {}) {
    if (!nextLevel) return { cancelled: true };
    if (this.level?.id === nextLevel.id && this.ready) {
      opts.onProgress?.(100, 'Dive systems ready.');
      return { cancelled: false, fromCache: true };
    }

    const cached = this._bakedLevelCache.get(nextLevel.id);
    if (cached) {
      this._loadEpoch += 1;
      // Touch LRU order
      this._bakedLevelCache.delete(nextLevel.id);
      this._bakedLevelCache.set(nextLevel.id, cached);
      this._applyBakedLevel(cached);
      opts.onProgress?.(100, `Loaded ${nextLevel.name} from cache.`);
      return { cancelled: false, fromCache: true };
    }

    return this.initialize({ ...opts, targetLevel: nextLevel });
  }

  _buildDustMotes(level) {
    const motes = [];
    for (let i = 0; i < 160; i++) {
      // Deterministic hash across level bounds inside open water
      const s1 = Math.sin(i * 12.9898 + 4.14) * 43758.5453;
      const s2 = Math.sin(i * 78.233 + 1.73) * 28461.1923;
      const u = s1 - Math.floor(s1);
      const v = s2 - Math.floor(s2);
      const wx = level.bounds.xMin + 6 + u * (level.bounds.xMax - level.bounds.xMin - 12);
      const wy = 1.0 + v * (level.bounds.yMax - 4);
      if (evaluateCaveSDF(level, wx, wy) < -0.5) {
        motes.push({
          x: wx,
          y: wy,
          size: 0.025 + ((i * 7) % 10) * 0.004,
          phase: i * 0.9,
        });
      }
    }
    return motes;
  }

  _makeFallbackTex(kind) {
    const c = document.createElement('canvas');
    c.width = TEX_SIZE;
    c.height = TEX_SIZE;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    const data = img.data;

    for (let y = 0; y < TEX_SIZE; y++) {
      for (let x = 0; x < TEX_SIZE; x++) {
        const u = (x / TEX_SIZE) * Math.PI * 2;
        const v = (y / TEX_SIZE) * Math.PI * 2;
        const n1 = Math.sin(u * 3 + Math.cos(v * 2)) * Math.cos(v * 3 - Math.sin(u * 2));
        const n2 = Math.sin(u * 7 - v * 5) * 0.45 + Math.cos(u * 13 + v * 11) * 0.25;
        const grain = Math.sin(u * 29 + v * 31) * 0.14;
        const val = n1 * 22 + n2 * 14 + grain * 10;
        const idx = (y * TEX_SIZE + x) * 4;
        if (kind === 'foliage') {
          data[idx] = Math.max(12, Math.min(255, 38 + val * 0.65));
          data[idx + 1] = Math.max(20, Math.min(255, 72 + val * 0.95));
          data[idx + 2] = Math.max(10, Math.min(255, 30 + val * 0.45));
        } else if (kind) {
          data[idx] = Math.max(20, Math.min(255, 74 + val));
          data[idx + 1] = Math.max(24, Math.min(255, 92 + val * 0.95));
          data[idx + 2] = Math.max(28, Math.min(255, 104 + val * 0.85));
        } else {
          data[idx] = Math.max(30, Math.min(255, 148 + val));
          data[idx + 1] = Math.max(25, Math.min(255, 128 + val * 0.9));
          data[idx + 2] = Math.max(20, Math.min(255, 102 + val * 0.72));
        }
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: c, data };
  }

  _resolveAssetUrl(src) {
    if (typeof location !== 'undefined' && typeof src === 'string' && src.startsWith('/assets/')) {
      return new URL('../..' + src, import.meta.url).href;
    }
    return src;
  }

  _loadRawImageAsset(rawSrc) {
    const src = this._resolveAssetUrl(rawSrc);
    if (this._rawImageCache.has(src)) {
      return this._rawImageCache.get(src);
    }
    const p = new Promise((resolve) => {
      if (typeof Image === 'undefined') {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        this._rawImageCache.delete(src);
        resolve(null);
      };
      img.src = src;
    });
    this._rawImageCache.set(src, p);
    return p;
  }

  _getSurfaceAssetPaths(level = this.level) {
    const isFlorida = level?.theme?.surfaceStyle === 'florida-cypress' || level?.theme?.id === 'florida-karst';
    return {
      skySrc: level?.theme?.skyBackdrop || (isFlorida ? '/assets/sky-florida.jpg' : '/assets/sky-yucatan.jpg'),
      foliageSrc: level?.theme?.foliageTexture || '/assets/tex-foliage-canopy.jpg',
    };
  }

  _loadBitmapAsset(rawSrc) {
    const src = this._resolveAssetUrl(rawSrc);
    if (this._bitmapAssetCache.has(src)) {
      return this._bitmapAssetCache.get(src);
    }
    const p = new Promise((resolve) => {
      if (typeof Image === 'undefined') {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = TEX_SIZE;
        c.height = TEX_SIZE;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, TEX_SIZE, TEX_SIZE);
        const data = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
        resolve({ canvas: c, data });
      };
      img.onerror = () => {
        this._bitmapAssetCache.delete(src);
        resolve(null);
      };
      img.src = src;
    });
    this._bitmapAssetCache.set(src, p);
    return p;
  }

  _loadBitmapTextures(level = this.level) {
    const rockSrc = level?.theme?.rockTexture || '/assets/tex-limestone-wall.jpg';
    const backSrc = level?.theme?.backTexture || '/assets/tex-cave-backwall.jpg';
    const { skySrc, foliageSrc } = this._getSurfaceAssetPaths(level);
    Promise.all([
      this._loadBitmapAsset(rockSrc),
      this._loadBitmapAsset(backSrc),
      this._loadBitmapAsset(foliageSrc),
      this._loadRawImageAsset(skySrc),
    ]).then(([rockTex, backTex, foliageTex, skyImg]) => {
      if (this.level !== level) return;
      let changed = false;
      if (rockTex) {
        this.rockTex = rockTex;
        this._rockPattern = null;
        changed = true;
      }
      if (backTex) {
        this.backTex = backTex;
        changed = true;
      }
      if (foliageTex) {
        this.foliageTex = foliageTex;
        this.foliagePattern = this.ctx.createPattern ? this.ctx.createPattern(foliageTex.canvas, 'repeat') : null;
        changed = true;
      }
      if (skyImg) {
        this.skyBackdropImg = skyImg;
      }
      if (changed) {
        this.backChunks = this._buildBackChunks(this.level);
        this.rockChunks = this._buildRockChunks(this.level);
      }
    });
  }

  /**
   * Asynchronously fetches textures and bakes cavern chunks progressively across frames
   * so the UI loading screen animates smoothly without freezing or racing on level switches.
   */
  async initialize({ onProgress, targetLevel = this.level } = {}) {
    const epoch = ++this._loadEpoch;
    const report = (pct, label) => {
      if (epoch === this._loadEpoch) {
        onProgress?.(Math.min(100, Math.max(0, pct)), label);
      }
    };
    report(5, `Loading ${targetLevel.name} textures...`);

    const rockSrc = targetLevel?.theme?.rockTexture || '/assets/tex-limestone-wall.jpg';
    const backSrc = targetLevel?.theme?.backTexture || '/assets/tex-cave-backwall.jpg';
    const { skySrc, foliageSrc } = this._getSurfaceAssetPaths(targetLevel);

    let texDone = 0;
    const onAsset = (label) => {
      texDone += 1;
      report(5 + texDone * 4.5, label);
    };

    const [loadedRock, loadedBack, loadedFoliage, loadedSky] = await Promise.all([
      this._loadBitmapAsset(rockSrc).then((res) => {
        onAsset('Loaded karst limestone texture');
        return res;
      }),
      this._loadBitmapAsset(backSrc).then((res) => {
        onAsset('Loaded deep cavern wall texture');
        return res;
      }),
      this._loadBitmapAsset(foliageSrc).then((res) => {
        onAsset('Loaded photorealistic canopy foliage');
        return res;
      }),
      this._loadRawImageAsset(skySrc).then((img) => {
        onAsset('Loaded atmospheric sky panorama');
        return img;
      }),
    ]);

    if (epoch !== this._loadEpoch) return { cancelled: true };

    const rockTex = loadedRock || this._defaultRockTex;
    const backTex = loadedBack || this._defaultBackTex;
    const foliageTex = loadedFoliage || this._defaultFoliageTex;
    const foliagePattern =
      loadedFoliage && this.ctx.createPattern ? this.ctx.createPattern(loadedFoliage.canvas, 'repeat') : null;
    const skyBackdropImg = loadedSky || null;

    const { xMin, xMax } = targetLevel.bounds;
    const spans = [];
    for (let cx0 = xMin; cx0 < xMax; cx0 += CHUNK_W_M) {
      spans.push([cx0, Math.min(xMax, cx0 + CHUNK_W_M)]);
    }

    const nextBackChunks = [];
    for (let i = 0; i < spans.length; i++) {
      await nextFrame();
      if (epoch !== this._loadEpoch) return { cancelled: true };
      report(24 + Math.round(((i + 1) / spans.length) * 26), `Carving cavern backdrop (${i + 1}/${spans.length})...`);
      nextBackChunks.push(this._buildBackChunk(targetLevel, spans[i][0], spans[i][1], backTex));
    }

    const nextRockChunks = [];
    for (let i = 0; i < spans.length; i++) {
      await nextFrame();
      if (epoch !== this._loadEpoch) return { cancelled: true };
      report(50 + Math.round(((i + 1) / spans.length) * 38), `Sculpting high-res limestone walls (${i + 1}/${spans.length})...`);
      nextRockChunks.push(this._buildRockChunk(targetLevel, spans[i][0], spans[i][1], rockTex, foliageTex));
    }

    await nextFrame();
    if (epoch !== this._loadEpoch) return { cancelled: true };
    report(92, 'Seeding suspended cenote water particulates...');
    const nextDustMotes = this._buildDustMotes(targetLevel);

    const entry = {
      level: targetLevel,
      rockTex,
      backTex,
      foliageTex,
      foliagePattern,
      skyBackdropImg,
      backChunks: nextBackChunks,
      rockChunks: nextRockChunks,
      dustMotes: nextDustMotes,
    };
    this._saveBakedLevel(entry);
    this._applyBakedLevel(entry);
    return { cancelled: false, fromCache: false };
  }

  _buildBackChunks(level) {
    const { xMin, xMax } = level.bounds;
    const chunks = [];
    for (let cx0 = xMin; cx0 < xMax; cx0 += CHUNK_W_M) {
      chunks.push(this._buildBackChunk(level, cx0, Math.min(xMax, cx0 + CHUNK_W_M)));
    }
    return chunks;
  }

  _getHorizonGroundY(level, wx) {
    const base = (level.bounds?.yMin ?? -6) + 0.72;
    return base + Math.sin(wx * 0.17 + 0.6) * 0.42 + Math.cos(wx * 0.43 - 0.4) * 0.22;
  }

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

    for (let by = 0; by < h; by += STEP) {
      const pyEnd = Math.min(h, by + STEP);
      const midWy = yMin + (by + (pyEnd - by) * 0.5) / BACK_PX_PER_M;
      for (let bx = 0; bx < w; bx += STEP) {
        const pxEnd = Math.min(w, bx + STEP);
        const midWx = cx0 + (bx + (pxEnd - bx) * 0.5) / BACK_PX_PER_M;
        // 8x8 coarse skip: blocks strictly deep inside foreground rock or high in open air have alpha=0
        if (midWy + 1.0 < this._getHorizonGroundY(level, midWx)) continue;
        if (evalChunkSdf(midWx, midWy) > 1.25) continue;

        for (let py = by; py < pyEnd; py++) {
          const wy = yMin + py / BACK_PX_PER_M;
          const ty = (py * 2) & (TEX_SIZE - 1);
          const haloShift = wy > level.haloclineY ? Math.min(1, (wy - level.haloclineY) / 14) : 0;
          const depthShade = Math.max(0.45, 0.92 - Math.max(0, wy) * 0.008);
          const tintR = bt ? fixedBtR : 0.72 + haloShift * 0.18;
          const tintG = bt ? fixedBtG : 0.86 - haloShift * 0.06;
          const tintB = bt ? fixedBtB : 0.94 - haloShift * 0.14;

          for (let px = bx; px < pxEnd; px++) {
            const wx = cx0 + px / BACK_PX_PER_M;
            if (wy < this._getHorizonGroundY(level, wx)) continue;
            const sdf = evalChunkSdf(wx, wy);
            if (sdf >= 0.45) continue;

            let skylight = 0;
            if (wy < 11.5) {
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
                const hole = Math.max(0, 1 - Math.hypot(distX * 0.82, distY));
                if (hole > skylight) skylight = hole;
              }
            }
            if (skylight >= 0.995) continue;

            const idx = (py * w + px) * 4;
            const gpx = Math.floor((wx - xMin) * BACK_PX_PER_M);
            const tx = (gpx * 2) & (TEX_SIZE - 1);
            const tIdx = (ty * TEX_SIZE + tx) * 4;

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
  }

  _buildRockChunks(level) {
    const { xMin, xMax } = level.bounds;
    const chunks = [];
    for (let cx0 = xMin; cx0 < xMax; cx0 += CHUNK_W_M) {
      chunks.push(this._buildRockChunk(level, cx0, Math.min(xMax, cx0 + CHUNK_W_M)));
    }
    return chunks;
  }

  _buildRockChunk(level, cx0, cx1, rockTexOverride = this.rockTex, foliageTexOverride = this.foliageTex) {
    const { xMin, yMin, yMax } = level.bounds;
    const h = Math.ceil((yMax - yMin) * CACHE_PX_PER_M);
    const tex = rockTexOverride.data;
    const fol = foliageTexOverride?.data;
    const w = Math.ceil((cx1 - cx0) * CACHE_PX_PER_M);

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const data = img.data;

    const evalChunkSdf = createChunkSDFEvaluator(level, cx0, cx1);
    const basins = level.openBasins || [];
    const basinCenters = new Array(basins.length);
    for (let b = 0; b < basins.length; b++) {
      basinCenters[b] = (basins[b].xMin + basins[b].xMax) * 0.5;
    }

    const rt = level.theme?.rockTint;
    const mulR = rt ? rt[0] * 0.62 : 0.62;
    const mulG = rt ? rt[1] * 0.62 : 0.62;
    const mulB = rt ? rt[2] * 0.62 : 0.62;
    const mossKind = level.theme?.mossTint || 'emerald';
    const isAridTopsoil = mossKind === 'sinai-coral-sandstone' || mossKind === 'kalahari-ironstone';
    const stainMap = {
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
    };
    const [wR, wG, wB, lRm, lRa, lGm, lGa, lBm, lBa] = stainMap[mossKind] || [-26, 34, -8, 0.85, 0, 0.92, 0, 0.82, 0];

    const STEP = 8;
    const gxBase = Math.floor((cx0 - xMin) * CACHE_PX_PER_M);

    for (let by = 0; by < h; by += STEP) {
      const pyEnd = Math.min(h, by + STEP);
      const midWy = yMin + (by + (pyEnd - by) * 0.5) / CACHE_PX_PER_M;
      for (let bx = 0; bx < w; bx += STEP) {
        const pxEnd = Math.min(w, bx + STEP);
        const midWx = cx0 + (bx + (pxEnd - bx) * 0.5) / CACHE_PX_PER_M;
        const midTopY = this._getHorizonGroundY(level, midWx);
        if (midWy + 0.8 < midTopY) continue;

        const cSdf = evalChunkSdf(midWx, midWy);
        // 8x8 coarse skip: strictly inside open tunnel water (alpha stays 0)
        if (cSdf < -0.95) continue;
        // 8x8 fast interior fill: far from walls, no rim highlights or moss stain needed
        const deepRockBlock = cSdf > 1.75 && (yMin + by / CACHE_PX_PER_M) >= midTopY + 0.5;

        for (let py = by; py < pyEnd; py++) {
          const wy = yMin + py / CACHE_PX_PER_M;
          const ty = py & (TEX_SIZE - 1);
          const depthDarken = Math.max(0.42, 0.88 - Math.max(0, wy) * 0.0085);
          const inVerticalMossBand = wy > -5.5 && wy < 13.5;

          for (let px = bx; px < pxEnd; px++) {
            const wx = cx0 + px / CACHE_PX_PER_M;
            const topGroundY = this._getHorizonGroundY(level, wx);
            if (wy < topGroundY) continue;

            const sdf = deepRockBlock ? 2.0 : evalChunkSdf(wx, wy);
            if (sdf < 0) continue;

            const idx = (py * w + px) * 4;
            const tx = (gxBase + px) & (TEX_SIZE - 1);
            const tIdx = (ty * TEX_SIZE + tx) * 4;

            let baseR;
            let baseG;
            let baseB;

            if (deepRockBlock) {
              baseR = tex[tIdx] * mulR * depthDarken;
              baseG = tex[tIdx + 1] * mulG * depthDarken;
              baseB = tex[tIdx + 2] * mulB * depthDarken;
            } else {
              const edgeShadow = sdf < 0.42 ? 0.56 + (sdf / 0.42) * 0.44 : 1.0;
              const rimCatchlight = sdf < 0.1 ? (1 - sdf / 0.1) * 24 : 0;
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
              const edgeMul = edgeShadow * depthDarken;
              baseR = (tex[tIdx] * mulR + rimCatchlight) * edgeMul + wallMoss * wR;
              baseG = (tex[tIdx + 1] * mulG + rimCatchlight * 0.95) * edgeMul + wallMoss * wG;
              baseB = (tex[tIdx + 2] * mulB + rimCatchlight * 0.85) * edgeMul + wallMoss * wB;
            }

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

            data[idx] = baseR < 10 ? 10 : baseR > 255 ? 255 : baseR;
            data[idx + 1] = baseG < 12 ? 12 : baseG > 255 ? 255 : baseG;
            data[idx + 2] = baseB < 12 ? 12 : baseB > 255 ? 255 : baseB;
            data[idx + 3] = turfDepth < 0.065 ? Math.round(255 * Math.max(0.14, turfDepth / 0.065)) : 255;
          }
        }
      }
    }

    ctx.putImageData(img, 0, 0);

    // Paint bitmap-textured speleothems (no flat solid vector triangles!) & layered boulders
    if (!this._rockPattern && ctx.createPattern) {
      this._rockPattern = ctx.createPattern(rockTexOverride.canvas, 'repeat');
    }
    const pat = this._rockPattern || ctx.createPattern(rockTexOverride.canvas, 'repeat');
    const toCacheX = (wx) => (wx - cx0) * CACHE_PX_PER_M;
    const toCacheY = (wy) => (wy - yMin) * CACHE_PX_PER_M;

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
        if (r < 2.55 || cy < 2.5) continue;

        const seed = Math.sin(sIdx * 31.7 + k * 17.3) * 43758.5453;
        const hash = seed - Math.floor(seed);

        // Probe ceiling wall straight up for eroded limestone stalactite formations
        for (let step = 0; step < 32; step++) {
          const py = cy - step * 0.28;
          if (evalChunkSdf(cx, py) >= 0) {
            const n = evaluateCaveNormal(level, cx, py);
            if (n.ny < -0.35 && hash > 0.24) {
              const len = (0.5 + hash * 0.85) * CACHE_PX_PER_M;
              const baseW = (0.16 + (1 - hash) * 0.16) * CACHE_PX_PER_M;
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
              ctx.fillStyle = 'rgba(20, 22, 26, 0.45)';
              ctx.fill();
              ctx.strokeStyle = 'rgba(226, 232, 240, 0.16)';
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
            const n = evaluateCaveNormal(level, cx, py);
            if (n.ny > 0.35) {
              const sx = toCacheX(cx);
              const sy = toCacheY(py) + 3;
              ctx.save();
              if (hash < 0.5) {
                const len = (0.44 + hash * 0.8) * CACHE_PX_PER_M;
                const baseW = (0.18 + hash * 0.16) * CACHE_PX_PER_M;
                ctx.beginPath();
                ctx.moveTo(sx - baseW, sy);
                ctx.bezierCurveTo(sx - baseW * 0.55, sy - len * 0.36, sx - baseW * 0.22, sy - len * 0.72, sx - baseW * 0.05, sy - len);
                ctx.bezierCurveTo(sx + baseW * 0.25, sy - len * 0.7, sx + baseW * 0.6, sy - len * 0.32, sx + baseW, sy);
                ctx.closePath();
              } else {
                const bw = (0.38 + (hash - 0.5) * 0.85) * CACHE_PX_PER_M;
                const bh = bw * (0.52 + hash * 0.18);
                const by = sy - bh * 0.3;
                ctx.beginPath();
                ctx.ellipse(sx, by, bw, bh, (hash - 0.5) * 0.35, 0, Math.PI * 2);
              }
              ctx.fillStyle = pat || '#3f3c38';
              ctx.fill();
              ctx.fillStyle = 'rgba(18, 20, 24, 0.42)';
              ctx.fill();
              ctx.strokeStyle = 'rgba(245, 245, 244, 0.14)';
              ctx.lineWidth = 1.2;
              ctx.stroke();
              ctx.restore();
            }
            break;
          }
        }
      }
    }

      // Hanging tree roots along Cenote basin rims (omitted in crystal glacial Aurora Silfra pool)
      if (level.theme?.id !== 'aurora-glacial') {
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

    return { x0: cx0, x1: cx1, y0: yMin, y1: yMax, canvas: c };
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      // 0.35x lightmap resolution gives soft penumbras and fast mobile fill-rate
      this.lightCanvas.width = Math.max(1, Math.floor(this.canvas.width * 0.35));
      this.lightCanvas.height = Math.max(1, Math.floor(this.canvas.height * 0.35));
    }
    // Scale pixels-per-meter so ~20–26m vertical span is visible on mobile & desktop
    const minDim = Math.min(w, h);
    this.pxPerM = Math.max(18, Math.min(34, minDim / 18));
  }

  /**
   * Lightweight <0.5ms water-and-light menu backdrop rendered when no cave chunks have been baked yet.
   */
  renderMenuBackdrop(level, timeSec = 0) {
    this.resize();
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const theme = level?.theme || {};

    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, theme.waterSurface || '#67e8f9');
    grad.addColorStop(0.22, theme.waterShallow || '#06b6d4');
    grad.addColorStop(0.54, theme.waterMid || '#0e5a6f');
    grad.addColorStop(0.82, theme.waterDeep || '#072a47');
    grad.addColorStop(1, theme.waterAbyss || '#020914');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // Subtle animated sun shafts drifting behind menu card
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const baseX = cw * (0.18 + i * 0.22) + Math.sin(timeSec * 0.25 + i * 1.7) * cw * 0.04;
      const topW = cw * 0.06;
      const botW = cw * 0.22;
      const rayGrad = ctx.createLinearGradient(baseX, 0, baseX + cw * 0.04, ch * 0.78);
      rayGrad.addColorStop(0, 'rgba(186, 230, 253, 0.18)');
      rayGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(baseX - topW, 0);
      ctx.lineTo(baseX + topW, 0);
      ctx.lineTo(baseX + botW, ch * 0.8);
      ctx.lineTo(baseX - botW * 0.4, ch * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  render({
    diver,
    diveState,
    cameraTarget = null,
    peerDiver,
    peers,
    checkpointsHit,
    nextCheckpoint,
    playerLines = [],
    collectedIds,
    bodyRecovered = false,
    carryingBody = false,
    collectBursts,
    celebrationParticles,
    siltClouds,
    localSiltDensity = 0,
    bubbles,
    ecosystem,
    timeSec,
    dt,
  }) {
    const peerList = Array.isArray(peers) ? peers : (peerDiver ? [peerDiver] : []);
    this.resize();
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const dpr = cw / (this.canvas.clientWidth || window.innerWidth);
    const scale = this.pxPerM * dpr;

    // Smooth camera follow (defaults to local diver, or spectated buddy target)
    const camAnchor = cameraTarget || diver;
    const lookX = camAnchor.x + Math.cos(camAnchor.angle || 0) * 2.2;
    const lookY = camAnchor.y + Math.sin(camAnchor.angle || 0) * 1.4;
    const camAlpha = Math.min(1, dt * 6);
    this.camX += (lookX - this.camX) * camAlpha;
    this.camY += (lookY - this.camY) * camAlpha;

    // Narcosis gentle camera drift
    let narcX = 0;
    let narcY = 0;
    if (diveState.narcosisLevel > 0.15) {
      narcX = Math.sin(timeSec * 1.7) * diveState.narcosisLevel * 0.45;
      narcY = Math.cos(timeSec * 1.3) * diveState.narcosisLevel * 0.35;
    }

    const viewCenterX = cw * 0.5;
    const viewCenterY = ch * 0.46;

    const toScreenX = (wx) => viewCenterX + (wx - (this.camX + narcX)) * scale;
    const toScreenY = (wy) => viewCenterY + (wy - (this.camY + narcY)) * scale;

    const { xMin, xMax, yMin, yMax } = this.level.bounds;
    const viewWorldLeft = (this.camX + narcX) - viewCenterX / scale;
    const viewWorldTop = (this.camY + narcY) - viewCenterY / scale;
    const viewWorldRight = viewWorldLeft + cw / scale;
    const viewWorldBottom = viewWorldTop + ch / scale;

    const visX0 = Math.max(xMin, viewWorldLeft);
    const visY0 = Math.max(yMin, viewWorldTop);
    const visX1 = Math.min(xMax, viewWorldRight);
    const visY1 = Math.min(yMax, viewWorldBottom);

    // 1. Sky & Rich Level-Themed Water Gradient (cached per surfY/viewport step)
    const surfY = toScreenY(0);
    const theme = this.level.theme;
    const skyKey = `${this.level.id}|${Math.round(surfY)}|${ch}|${Math.round(scale * 10)}`;
    if (!this._skyGradCache || this._skyGradCache.key !== skyKey) {
      const skyGrad = ctx.createLinearGradient(0, Math.min(0, surfY - 80), 0, Math.max(ch, surfY + 48 * scale));
      skyGrad.addColorStop(0, theme?.waterSurface || '#67e8f9');
      skyGrad.addColorStop(Math.max(0.01, Math.min(0.35, surfY / ch)), theme?.waterShallow || '#06b6d4');
      skyGrad.addColorStop(Math.max(0.02, Math.min(0.58, (surfY + 14 * scale) / ch)), theme?.waterMid || '#0e5a6f');
      skyGrad.addColorStop(Math.max(0.03, Math.min(0.78, (surfY + 28 * scale) / ch)), theme?.waterDeep || '#072a47');
      skyGrad.addColorStop(1, theme?.waterAbyss || '#020914');
      this._skyGradCache = { key: skyKey, grad: skyGrad };
    }
    ctx.fillStyle = this._skyGradCache.grad;
    ctx.fillRect(0, 0, cw, ch);

    // Above-water sky strip (sky, sun halo & clouds behind cliffs)
    if (surfY > 0) {
      this._drawSurfaceSky(ctx, cw, surfY, toScreenX, toScreenY, scale, timeSec);
    }

    // 1b. 1:1 World-Locked Carved Cave Backwall (zero parallax — tube/cavern interior rock)
    this._drawChunks(ctx, this.backChunks, BACK_PX_PER_M, yMin, visX0, visY0, visX1, visY1, toScreenX, toScreenY, scale);

    // 2. Physical 2D Ray-Cast Cenote Daylight Sunbeams & Shimmering Caustics
    const sunCurtains = this._computeVisibleSunCurtains(visX0, visX1, visY0, siltClouds);
    this._drawSunbeams(ctx, sunCurtains, toScreenX, toScreenY, scale, timeSec);
    this._drawCaustics(ctx, sunCurtains, toScreenX, toScreenY, scale, timeSec);

    // 3. Water Surface Wave Line (clipped to open basin mouths so waves never cut through solid cliff rock)
    if (surfY > -20 && surfY < ch + 20) {
      this._drawWaterSurfaceWaves(ctx, cw, toScreenX, toScreenY, scale, timeSec);
    }

    // 4. Halocline / Thermocline Interface Shimmer + Refractive Shear Wave
    if (Number.isFinite(this.level.haloclineY)) {
      const haloY = toScreenY(this.level.haloclineY);
      if (haloY > -60 && haloY < ch + 60) {
        const haloCol = theme?.haloclineColor || 'rgba(165, 243, 252, 0.22)';
        ctx.save();
        const hg = ctx.createLinearGradient(0, haloY - 1.65 * scale, 0, haloY + 1.65 * scale);
        hg.addColorStop(0, 'rgba(56, 189, 248, 0)');
        hg.addColorStop(0.5, haloCol);
        hg.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = hg;
        ctx.fillRect(0, haloY - 1.65 * scale, cw, 3.3 * scale);

        ctx.strokeStyle = 'rgba(224, 242, 254, 0.36)';
        ctx.lineWidth = Math.max(1, 0.045 * scale);
        ctx.beginPath();
        const stepPx = Math.max(14, Math.round(cw / 32));
        for (let sx = 0; sx <= cw + stepPx; sx += stepPx) {
          const wx = (this.camX + narcX) + (sx - viewCenterX) / scale;
          const waveY = haloY + (Math.sin(wx * 0.6 + timeSec * 1.9) * 0.11 + Math.cos(wx * 1.4 - timeSec * 1.4) * 0.06) * scale;
          if (sx === 0) ctx.moveTo(sx, waveY);
          else ctx.lineTo(sx, waveY);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Guideline (Fixed gold cave line + player-deployed reel lines & directional pins)
    this._drawGuideline(ctx, toScreenX, toScreenY, scale, playerLines);

    // 6. Checkpoints, Collectables & Recovery Target
    this._drawCheckpoints(ctx, toScreenX, toScreenY, scale, checkpointsHit, nextCheckpoint, timeSec);
    this._drawCollectibles(ctx, viewWorldLeft, viewWorldRight, toScreenX, toScreenY, scale, collectedIds, timeSec);
    if (this.level.recoveryTarget) {
      this._drawRecoveryTarget(ctx, diver, peerList, bodyRecovered, carryingBody, toScreenX, toScreenY, scale, timeSec);
    }

    // 7. Bubbles
    this._drawBubbles(ctx, toScreenX, toScreenY, scale, bubbles);

    // 8. High-Res Bitmap Cutaway Cave Limestone Walls (24 px/m, sliced per visible chunk)
    this._drawChunks(ctx, this.rockChunks, CACHE_PX_PER_M, yMin, visX0, visY0, visX1, visY1, toScreenX, toScreenY, scale);
    this._drawInfiniteRockMargin(ctx, viewWorldLeft, viewWorldRight, xMin, xMax, yMin, yMax, toScreenX, toScreenY, scale);

    // 8a. Top-Level Surface Environment: Full-width jungle/cypress ridge, cenote rims, stairways & docks
    if (visY0 < 4.5) {
      this._drawSurfaceTopEnvironment(ctx, viewWorldLeft, viewWorldRight, toScreenX, toScreenY, scale, timeSec);
    }

    // 8b. Authentic Cenote & Cave Flora, Calcite Formations, Fishes, Slider Turtles & Remipedes
    if (ecosystem) {
      this._drawAnchoredLife(ctx, ecosystem, visX0 - 3, visX1 + 3, visY0 - 3, visY1 + 3, toScreenX, toScreenY, scale, timeSec);
      this._drawSwimmers(ctx, ecosystem, visX0 - 4, visX1 + 4, visY0 - 4, visY1 + 4, toScreenX, toScreenY, scale, timeSec);
    }

    // 9. Divers & Active Co-op Rescue Tow Lifelines
    this._drawBuddyRescueTethers(ctx, diver, peerList, toScreenX, toScreenY, scale, timeSec);
    for (let i = 0; i < peerList.length; i++) {
      this._drawDiver(ctx, peerList[i], toScreenX, toScreenY, scale, timeSec, true);
    }
    this._drawDiver(ctx, diver, toScreenX, toScreenY, scale, timeSec, false);

    // 10. Volumetric Ray-Cast Darkness + Entrance/Exit Sunlight + 2D Torch Scattering
    this._drawLighting(
      ctx,
      cw,
      ch,
      diver,
      peerList,
      checkpointsHit,
      siltClouds,
      sunCurtains,
      toScreenX,
      toScreenY,
      scale,
      timeSec,
      bodyRecovered,
      localSiltDensity
    );

    // 10b. Emissive Geothermal Vents, Deep Bioluminescence, Crystal Glint & Collect Bursts
    if (Array.isArray(this.level.geothermalVents) && this.level.geothermalVents.length > 0) {
      this._drawGeothermalVents(ctx, viewWorldLeft, viewWorldRight, visY0, visY1, toScreenX, toScreenY, scale, timeSec);
    }
    if (this.level.theme?.bioluminescent) {
      this._drawBioluminescence(ctx, viewWorldLeft, viewWorldRight, visY0, visY1, toScreenX, toScreenY, scale, timeSec);
    }
    if (ecosystem) {
      this._drawCrystalSparkle(ctx, ecosystem, visX0 - 3, visX1 + 3, visY0 - 3, visY1 + 3, toScreenX, toScreenY, scale, timeSec);
    }
    this._drawCollectBursts(ctx, collectBursts, toScreenX, toScreenY, scale);

    // 11. World-space Diffusing Cavern Silt Clouds & Torch Backscatter across ALL divers' lights
    this._drawSiltClouds(ctx, cw, ch, toScreenX, toScreenY, scale, siltClouds, diver, peerList, timeSec);

    // 11b. Diegetic Depth Bands, Gas-Switch / Deco Hover Zones, Waypoint, Offscreen Buddy Pings & Ascent Pacer
    this._drawZonesAndMarkers(ctx, cw, ch, diver, diveState, toScreenX, toScreenY, scale, timeSec);
    if (!this.level.hideWaypointCompass) {
      this._drawWaypointCompass(ctx, cw, ch, diver, nextCheckpoint, toScreenX, toScreenY, scale, timeSec);
    }
    this._drawPeerEdgeIndicators(ctx, cw, ch, diver, peerList, toScreenX, toScreenY, timeSec);
    if (celebrationParticles && celebrationParticles.length > 0) {
      this._drawCelebrationParticles(ctx, celebrationParticles, cw, ch);
    }
    this._drawAscentCoach(ctx, diver, diveState, checkpointsHit, toScreenX, toScreenY, scale);

    // 12. Physiology Screen Vignettes (Hypoxia / O2 Tox / Narcosis / DCS)
    this._drawPhysiologyOverlay(ctx, cw, ch, diveState, timeSec);
  }

  _drawChunks(ctx, chunks, pxPerM, yMin, visX0, visY0, visX1, visY1, toScreenX, toScreenY, scale) {
    if (visX1 <= visX0 || visY1 <= visY0 || !chunks) return;
    const sy0 = (visY0 - yMin) * pxPerM;
    const sh = (visY1 - visY0) * pxPerM;
    const dy = toScreenY(visY0);
    const dh = (visY1 - visY0) * scale;

    for (let i = 0; i < chunks.length; i++) {
      const chnk = chunks[i];
      const cx0 = Math.max(visX0, chnk.x0);
      const cx1 = Math.min(visX1, chnk.x1);
      if (cx1 <= cx0) continue;

      const sx0 = (cx0 - chnk.x0) * pxPerM;
      const sw = (cx1 - cx0) * pxPerM;
      ctx.drawImage(
        chnk.canvas,
        sx0,
        sy0,
        sw,
        sh,
        toScreenX(cx0),
        dy,
        (cx1 - cx0) * scale,
        dh
      );
    }
  }

  _drawSurfaceSky(ctx, cw, surfY, toScreenX, toScreenY, scale, timeSec) {
    const theme = this.level.theme;
    const style = theme?.surfaceStyle || 'yucatan';
    const skyPalettes = {
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
      yucatan: ['#7cb0cc', '#c6dfea', '#e6eed8', 'rgba(254, 243, 199, 0.18)', 'rgba(236, 248, 250, 0.15)', 'rgba(30, 48, 52, 0.44)'],
    };
    const [skyA, skyB, skyC, bloomCol, mistCol, birdCol] = skyPalettes[style] || skyPalettes.yucatan;
    const skyBotY = Math.max(0, surfY + 2);
    const horizonY = toScreenY(this.level.bounds.yMin + 1.15);
    const parallaxCam = this.camX;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, skyBotY);
    ctx.clip();

    // Base atmospheric gradient beneath panorama
    const airGrad = ctx.createLinearGradient(0, 0, 0, skyBotY);
    airGrad.addColorStop(0, skyA);
    airGrad.addColorStop(0.55, skyB);
    airGrad.addColorStop(1, skyC);
    ctx.fillStyle = airGrad;
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
      const scrollX = -parallaxCam * 0.22 * scale;
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

    // 1b. Animated shimmering Northern Lights (Aurora Borealis) ribbons for Silfra & Katla Aurora Abyss
    if (style === 'aurora-basalt') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const bandTop = Math.max(4, horizonY - 8 * scale);
      const bandBot = Math.min(skyBotY, horizonY + 0.4 * scale);
      const cols = Math.max(12, Math.floor(cw / 28));
      for (let ribbon = 0; ribbon < 2; ribbon++) {
        const phase = timeSec * (0.45 + ribbon * 0.2) + ribbon * 2.1;
        for (let c = 0; c < cols; c++) {
          const sx = (c / cols) * cw - ((parallaxCam * (0.08 + ribbon * 0.04) * scale) % 28);
          const wave = Math.sin(c * 0.34 + phase) * 0.5 + 0.5;
          if (wave < 0.22) continue;
          const h = (bandBot - bandTop) * (0.38 + wave * 0.52);
          const y0 = bandTop + Math.sin(c * 0.26 - phase * 0.8) * 14;
          const ag = ctx.createLinearGradient(sx, y0 + h, sx, y0);
          if (ribbon === 0) {
            ag.addColorStop(0, `rgba(45, 212, 191, ${(0.04 + wave * 0.16).toFixed(3)})`);
            ag.addColorStop(0.5, `rgba(74, 222, 128, ${(0.02 + wave * 0.11).toFixed(3)})`);
          } else {
            ag.addColorStop(0, `rgba(56, 189, 248, ${(0.03 + wave * 0.11).toFixed(3)})`);
            ag.addColorStop(0.55, `rgba(167, 139, 250, ${(0.02 + wave * 0.09).toFixed(3)})`);
          }
          ag.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = ag;
          ctx.fillRect(sx, y0, 32, h);
        }
      }
      ctx.restore();
    }

    // 2. Soft photographic sunlight bloom & delicate diagonal atmospheric light rays
    const sunScreenX = cw * 0.72 - parallaxCam * 0.14 * scale;
    const sunScreenY = Math.max(18, Math.min(horizonY - 2.2 * scale, skyBotY * 0.26));
    const sunHalo = ctx.createRadialGradient(sunScreenX, sunScreenY, 0.2 * scale, sunScreenX, sunScreenY, 12 * scale);
    sunHalo.addColorStop(0, 'rgba(255, 252, 238, 0.42)');
    sunHalo.addColorStop(0.22, bloomCol);
    sunHalo.addColorStop(1, 'rgba(255, 248, 220, 0)');
    ctx.fillStyle = sunHalo;
    ctx.beginPath();
    ctx.arc(sunScreenX, sunScreenY, 12 * scale, 0, Math.PI * 2);
    ctx.fill();

    for (let r = -2; r <= 2; r++) {
      const rayGrad = ctx.createLinearGradient(sunScreenX, sunScreenY, sunScreenX + r * 65, skyBotY);
      rayGrad.addColorStop(0, 'rgba(255, 249, 224, 0.065)');
      rayGrad.addColorStop(1, 'rgba(255, 249, 224, 0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(sunScreenX, sunScreenY);
      ctx.lineTo(sunScreenX + (r - 0.32) * 85 - 45, skyBotY);
      ctx.lineTo(sunScreenX + (r + 0.32) * 85 + 45, skyBotY);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Low-lying humid forest mist wisps drifting gently above the sinkhole waterline
    const mistDrift = -parallaxCam * 0.32 * scale + timeSec * 5.2;
    const mistBaseY = Math.max(horizonY + 0.4 * scale, skyBotY - 2.6 * scale);
    for (let m = 0; m < 7; m++) {
      const mx = ((m * 260 + mistDrift) % (cw + 380)) - 190;
      const my = mistBaseY + ((m * 29) % 42) - 18;
      const mw = 115 + (m % 3) * 45;
      const mg = ctx.createRadialGradient(mx, my, 4, mx, my, mw);
      mg.addColorStop(0, mistCol);
      mg.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.ellipse(mx, my, mw, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Subtle distant gliding birds in aerial perspective
    ctx.strokeStyle = birdCol;
    ctx.lineWidth = 1.25;
    for (let b = 0; b < 4; b++) {
      const bx = ((cw * 0.25 + b * 145 + timeSec * (11 + b * 2.5) - parallaxCam * 0.18 * scale) % (cw + 120)) - 60;
      const by = Math.max(18, horizonY * (0.34 + b * 0.1) + Math.sin(timeSec * 1.8 + b) * 5);
      const wing = Math.sin(timeSec * 4.8 + b * 1.9) * 3.2;
      ctx.beginPath();
      ctx.moveTo(bx - 5.5, by + wing);
      ctx.quadraticCurveTo(bx - 2.5, by - 2.4, bx, by);
      ctx.quadraticCurveTo(bx + 2.5, by - 2.4, bx + 5.5, by + wing);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawWaterSurfaceWaves(ctx, cw, toScreenX, toScreenY, scale, timeSec) {
    ctx.save();
    const isFlorida = this.level.theme?.id === 'florida-karst';
    for (let b = 0; b < this.level.openBasins.length; b++) {
      const basin = this.level.openBasins[b];
      const xStart = basin.xMin - 2;
      const xEnd = basin.xMax + 2;
      const sx0 = toScreenX(xStart);
      const sx1 = toScreenX(xEnd);
      if (sx1 < 0 || sx0 > cw) continue;

      const pts = [];
      for (let wx = xStart; wx <= xEnd; wx += 0.28) {
        const sdf = evaluateCaveSDF(this.level, wx, 0.05);
        if (sdf < 0.04) {
          const wy = Math.sin(wx * 1.15 + timeSec * 2.2) * 0.065 + Math.cos(wx * 2.4 - timeSec * 1.6) * 0.032;
          pts.push([toScreenX(wx), toScreenY(wy), wx]);
        } else if (pts.length > 1) {
          this._strokeWaterMeniscus(ctx, pts, scale, isFlorida, timeSec);
          pts.length = 0;
        } else {
          pts.length = 0;
        }
      }
      if (pts.length > 1) {
        this._strokeWaterMeniscus(ctx, pts, scale, isFlorida, timeSec);
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
  }

  _strokeWaterMeniscus(ctx, pts, scale, isFlorida, timeSec) {
    // Soft underwater Fresnel sky-mirror band immediately under the water surface
    ctx.fillStyle = isFlorida ? 'rgba(245, 224, 180, 0.14)' : 'rgba(218, 242, 252, 0.18)';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1] + 0.55 * scale);
    ctx.lineTo(pts[0][0], pts[0][1] + 0.55 * scale);
    ctx.closePath();
    ctx.fill();

    // Fine broken specular sky/sun glints instead of a thick uniform solid stripe
    ctx.strokeStyle = isFlorida ? 'rgba(255, 244, 214, 0.48)' : 'rgba(240, 250, 255, 0.54)';
    ctx.lineWidth = Math.max(1.2, 0.065 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 250, 0.72)';
    for (let i = 0; i < pts.length - 1; i += 2) {
      const shimmer = Math.sin(pts[i][2] * 3.1 + timeSec * 4.5);
      if (shimmer > 0.25) {
        ctx.fillRect(pts[i][0], pts[i][1] - 0.025 * scale, (0.28 + shimmer * 0.25) * scale, Math.max(1, 0.045 * scale));
      }
    }
  }

  _findBasinCliffEdgeX(basin, wy, side) {
    const cx = (basin.xMin + basin.xMax) * 0.5;
    const maxOffset = (basin.rimHalf || 5.2) + 6.5;
    for (let off = 1.0; off <= maxOffset; off += 0.25) {
      const wx = cx + side * off;
      if (evaluateCaveSDF(this.level, wx, wy) > 0.05) {
        return wx;
      }
    }
    return cx + side * (basin.rimHalf || 5.2);
  }

  _sampleSurfaceFooting(level, wx, halfWidthM = 1.2) {
    const gyL = this._getHorizonGroundY(level, wx - halfWidthM);
    const gyC = this._getHorizonGroundY(level, wx);
    const gyR = this._getHorizonGroundY(level, wx + halfWidthM);
    const gyHigh = Math.min(gyL, gyC, gyR);
    const gyDeep = Math.max(gyL, gyC, gyR);
    const slopeRad = Math.atan2(gyR - gyL, Math.max(0.05, halfWidthM * 2));
    return { gyL, gyC, gyR, gyHigh, gyDeep, slopeRad };
  }

  _getSurfaceBiomeSoilPalette() {
    const style = this.level.theme?.surfaceStyle || 'yucatan';
    const palettes = {
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
      yucatan: { turf: '#2b5528', soil: '#4a3d2d', tuft: '#447634', stone: '#6d6658' },
    };
    return palettes[style] || palettes.yucatan;
  }

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
  }

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

    // Clip stone masonry courses & top sill shadow inside the foundation contour
    ctx.save();
    ctx.clip();
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
    this._drawContouredBermSkirt(ctx, toScreenX, toScreenY, scale, wx, halfW * 1.06, opts);
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  _drawBotanicalPalm(ctx, wx, toScreenX, toScreenY, scale, leanDir, sway, heightM = 4.6) {
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
  }

  _drawTropicalUnderbrush(ctx, wx, toScreenX, toScreenY, scale, sway, dir) {
    const foot = this._sampleSurfaceFooting(this.level, wx, 0.8);
    const x = toScreenX(wx);
    const groundY = toScreenY(foot.gyC);
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
  }

  _drawPalapaPavilion(ctx, wx, toScreenX, toScreenY, scale, variant = 'entry') {
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
  }

  _drawBaldCypress(ctx, wx, toScreenX, toScreenY, scale, sway, heightM = 5.4) {
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
  }

  _drawLongleafPine(ctx, wx, toScreenX, toScreenY, scale, sway, heightM = 5.8) {
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
  }

  _drawFloridaRangerKiosk(ctx, wx, toScreenX, toScreenY, scale, isExit = false) {
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
  }

  _drawInfiniteRockMargin(ctx, viewLeft, viewRight, xMin, xMax, yMin, yMax, toScreenX, toScreenY, scale) {
    const spans = [];
    if (viewLeft < xMin) spans.push([viewLeft - 2, xMin + 0.08]);
    if (viewRight > xMax) spans.push([xMax - 0.08, viewRight + 2]);
    if (spans.length === 0) return;

    const mossKind = this.level.theme?.mossTint || 'emerald';
    const marginMap = {
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
    };
    const [marginBase, ridgeBase] = marginMap[mossKind] || ['#4a3d2e', '#2e592d'];
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
  }

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
  }

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
        } else {
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
      } else if (style === 'bahamas-abaco') {
        if (hash > 0.22) {
          this._drawLongleafPine(ctx, wx, toScreenX, toScreenY, scale, sway * 0.85, h + 0.65);
        } else {
          this._drawBotanicalPalm(ctx, wx, toScreenX, toScreenY, scale, leanDir, sway, h * 0.8);
        }
        this._drawAnchoredBoulder(ctx, wx - 0.85, 0.62, 0.24, toScreenX, toScreenY, scale, '#d6d3c9');
        if ((s % 2) === 0) {
          const sbWx = wx + 0.85;
          const sbGy = toScreenY(this._getHorizonGroundY(this.level, sbWx));
          this._fillFoliageCluster(ctx, toScreenX(sbWx), sbGy - 0.22 * scale, 0.72 * scale, 0.34 * scale, 0.05, scale, 'jungle', 1);
        }
      } else if (style === 'budapest-bathhouse') {
        this._drawTaperedCurvedTrunk(ctx, gx, gy + 0.06 * scale, gx + 0.08 * scale, gy - 0.75 * scale, gx, gy - 1.35 * scale, 0.16 * scale, 0.07 * scale, 6, ['#46382c', '#635141', '#7d6856'], false);
        this._drawFlaredTreeCollar(ctx, toScreenX, toScreenY, wx, gx, gy, 0.16 * scale, scale, ['#46382c', '#635141', '#7d6856']);
        this._fillFoliageCluster(ctx, gx, gy - 1.55 * scale, 1.45 * scale, 0.92 * scale, 0.04, scale, 'jungle', 1);
        this._drawAnchoredBoulder(ctx, wx - 0.42, 0.68, 0.22, toScreenX, toScreenY, scale, '#c4b89f');
      } else if (style === 'sinai-coast') {
        if (hash > 0.38) {
          this._drawBotanicalPalm(ctx, wx, toScreenX, toScreenY, scale, leanDir, sway * 0.85, h * 0.78);
        }
        this._drawAnchoredBoulder(ctx, wx - 0.75, 0.72, 0.26, toScreenX, toScreenY, scale, '#c2925e');
      } else if (style === 'quercy-ressel' || style === 'lazio-travertine') {
        if ((s & 1) === 0) {
          this._drawMediterraneanCypress(ctx, wx, toScreenX, toScreenY, scale, sway * 0.5, h + 0.8);
        } else {
          this._drawTaperedCurvedTrunk(ctx, gx, gy + 0.08 * scale, gx + 0.08 * scale, gy - 0.7 * scale, gx, gy - 1.2 * scale, 0.16 * scale, 0.08 * scale, 6, ['#4e4135', '#6b5a4a', '#877664'], false);
          this._drawFlaredTreeCollar(ctx, toScreenX, toScreenY, wx, gx, gy, 0.16 * scale, scale, ['#4e4135', '#6b5a4a', '#877664']);
          this._fillFoliageCluster(ctx, gx, gy - 1.3 * scale, 1.4 * scale, 0.8 * scale, 0, scale, 'cypress', 1);
        }
        this._drawAnchoredBoulder(ctx, wx - 0.45, 0.68, 0.23, toScreenX, toScreenY, scale, style === 'quercy-ressel' ? '#c2bdb0' : '#bda886');
      } else if (style === 'moravia-rift') {
        this._drawNorwaySpruce(ctx, wx, toScreenX, toScreenY, scale, sway * 0.65, h + 1.1);
        this._drawAnchoredBoulder(ctx, wx - 0.85, 0.62, 0.25, toScreenX, toScreenY, scale, '#475569');
      } else if (style === 'aurora-basalt') {
        if ((s & 1) === 0) {
          this._drawNorwaySpruce(ctx, wx, toScreenX, toScreenY, scale, sway * 0.55, h * 0.88);
        } else {
          this._drawSilverBirch(ctx, wx, toScreenX, toScreenY, scale, sway * 0.5, h * 0.72);
        }
        this._drawAnchoredBoulder(ctx, wx - 0.78, 0.68, 0.28, toScreenX, toScreenY, scale, '#334155');
        this._drawAnchoredBoulder(ctx, wx + 0.72, 0.44, 0.2, toScreenX, toScreenY, scale, '#1e293b');
      } else if (style === 'oxbelha-twilight') {
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
  }

  _drawNorwaySpruce(ctx, wx, toScreenX, toScreenY, scale, sway, heightM = 5.6) {
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
  }

  _drawSilverBirch(ctx, wx, toScreenX, toScreenY, scale, sway, heightM = 4.6) {
    const x = toScreenX(wx);
    const groundY = toScreenY(this._getHorizonGroundY(this.level, wx));
    const h = heightM * scale;
    const topX = x + sway * 0.5;
    const topY = groundY - h;
    this._drawTaperedCurvedTrunk(ctx, x, groundY + 0.06 * scale, x + 0.08 * scale, groundY - h * 0.5, topX, topY, 0.11 * scale, 0.04 * scale, 8, ['#94a3b8', '#e2e8f0', '#f8fafc'], false);
    this._drawFlaredTreeCollar(ctx, toScreenX, toScreenY, wx, x, groundY, 0.12 * scale, scale, ['#475569', '#94a3b8', '#cbd5e1'], { rootSpread: 2.15 });
    this._fillFoliageCluster(ctx, topX - 0.35 * scale, topY + 0.25 * scale, 1.05 * scale, 0.62 * scale, -0.1, scale, 'pine', -1);
    this._fillFoliageCluster(ctx, topX + 0.4 * scale, topY + 0.05 * scale, 0.95 * scale, 0.58 * scale, 0.1, scale, 'pine', 1);
  }

  _drawMediterraneanCypress(ctx, wx, toScreenX, toScreenY, scale, sway, heightM = 6.0) {
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
  }

  _drawUmbrellaAcacia(ctx, wx, toScreenX, toScreenY, scale, sway, heightM = 5.2) {
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
  }

  _drawSurfaceTopEnvironment(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec) {
    const surfaceStyle = this.level.theme?.surfaceStyle;
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
      surfaceStyle === 'aurora-basalt'
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
  }

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
  }

  _drawThemedSurfaceBuilding(ctx, hutX, toScreenX, toScreenY, scale, timeSec, cx, flags) {
    const { isNordic, isUral, isKalahari, isAbaco, isBudapest, isSinai, isAurora } = flags;
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
  }

  /**
   * Shared themed expedition surface renderer for Nordic, Provence, Kalahari, Ural, & Abaco biomes.
   */
  _drawThemedExpeditionSurface(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec, style) {
    const isNordic = style === 'nordic-fjord' || style === 'ural-birch' || style === 'moravia-rift' || style === 'aurora-basalt';
    const isUral = style === 'ural-birch';
    const isKalahari = style === 'kalahari-crater';
    const isAbaco = style === 'bahamas-abaco';
    const isBudapest = style === 'budapest-bathhouse';
    const isSinai = style === 'sinai-coast';
    const isOxBelHa = style === 'oxbelha-twilight';
    const isAurora = style === 'aurora-basalt';
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

      // Flanking regional trees (spruce/birch, Mediterranean cypress, palms, or Kalahari umbrella acacia)
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
        if (isNordic) {
          if ((e & 1) === 0) this._drawNorwaySpruce(ctx, ts.wx, toScreenX, toScreenY, scale, sway, ts.h);
          else this._drawSilverBirch(ctx, ts.wx, toScreenX, toScreenY, scale, sway, ts.h * 0.85);
        } else if (isKalahari) {
          this._drawUmbrellaAcacia(ctx, ts.wx, toScreenX, toScreenY, scale, sway * 0.7, ts.h * 0.9);
        } else if (isAbaco) {
          if (e === 1) this._drawBotanicalPalm(ctx, ts.wx, toScreenX, toScreenY, scale, 1, sway, ts.h * 0.82);
          else this._drawLongleafPine(ctx, ts.wx, toScreenX, toScreenY, scale, sway * 0.85, ts.h * 0.95);
        } else if (isSinai || isOxBelHa) {
          this._drawBotanicalPalm(ctx, ts.wx, toScreenX, toScreenY, scale, e === 0 ? 1 : -1, sway * 0.75, ts.h * 0.78);
        } else if (isBudapest) {
          this._drawTaperedCurvedTrunk(ctx, gx, gy + 0.06 * scale, gx + 0.08 * scale, gy - 0.85 * scale, gx, gy - 1.55 * scale, 0.17 * scale, 0.07 * scale, 6, ['#46382c', '#635141', '#7d6856'], false);
          this._drawFlaredTreeCollar(ctx, toScreenX, toScreenY, ts.wx, gx, gy, 0.17 * scale, scale, ['#46382c', '#635141', '#7d6856']);
          this._fillFoliageCluster(ctx, gx, gy - 1.8 * scale, 1.6 * scale, 1.05 * scale, 0, scale, 'jungle', 1);
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

  _computeVisibleSunCurtains(visX0, visX1, visY0, siltClouds) {
    if (visY0 > 20) return [];
    const out = [];
    for (let bIdx = 0; bIdx < this.level.openBasins.length; bIdx++) {
      const basin = this.level.openBasins[bIdx];
      if (basin.xMax + 8 < visX0 || basin.xMin - 8 > visX1) continue;

      let hasSurfaceSilt = false;
      if (siltClouds && siltClouds.length > 0) {
        const sx0 = basin.xMin - 8;
        const sx1 = basin.xMax + 8;
        for (let i = 0; i < siltClouds.length; i++) {
          const s = siltClouds[i];
          if (s.y - s.radius < 21 && s.x + s.radius > sx0 && s.x - s.radius < sx1) {
            hasSurfaceSilt = true;
            break;
          }
        }
      }

      let curtains = !hasSurfaceSilt ? this._sunCurtainCache.get(bIdx) : null;
      if (!curtains) {
        curtains = castSunCurtain(
          this.level,
          basin.xMin - 0.5,
          basin.xMax + 0.5,
          basin.sunAngle ?? (Math.PI * 0.5 - 0.14),
          20,
          hasSurfaceSilt ? siltClouds : [],
          22
        );
        if (!hasSurfaceSilt) {
          this._sunCurtainCache.set(bIdx, curtains);
        }
      }
      for (const c of curtains) {
        out.push({ basin, rays: c });
      }
    }
    return out;
  }

  _drawSunbeams(ctx, sunCurtains, toScreenX, toScreenY, scale, timeSec) {
    if (!sunCurtains.length) return;
    ctx.save();
    for (const { rays } of sunCurtains) {
      // Clip volumetric sunbeams strictly to the ray-cast cave-bounded polygon
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(toScreenX(rays[0].xTop), toScreenY(rays[0].yTop));
      for (let i = 1; i < rays.length; i++) {
        ctx.lineTo(toScreenX(rays[i].xTop), toScreenY(rays[i].yTop));
      }
      for (let i = rays.length - 1; i >= 0; i--) {
        ctx.lineTo(toScreenX(rays[i].xBot), toScreenY(rays[i].yBot));
      }
      ctx.closePath();
      ctx.clip();

      const sy0 = toScreenY(0);
      const sy1 = toScreenY(18);
      const midX = toScreenX((rays[0].xTop + rays[rays.length - 1].xTop) * 0.5);
      const sway = Math.sin(timeSec * 0.7) * 0.8 * scale;
      const grad = ctx.createLinearGradient(midX, sy0, midX + sway, sy1);
      grad.addColorStop(0, this.level.theme?.sunbeamTop || 'rgba(186, 230, 253, 0.36)');
      grad.addColorStop(0.55, this.level.theme?.sunbeamMid || 'rgba(56, 189, 248, 0.14)');
      grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(
        toScreenX(rays[0].xTop) - 6 * scale,
        sy0,
        (rays[rays.length - 1].xTop - rays[0].xTop + 12) * scale,
        sy1 - sy0
      );
      ctx.restore();
    }
    ctx.restore();
  }

  _drawCaustics(ctx, sunCurtains, toScreenX, toScreenY, scale, timeSec) {
    if (!sunCurtains.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const { rays } of sunCurtains) {
      for (let i = 0; i < rays.length - 1; i += 2) {
        const a = rays[i];
        const b = rays[i + 1];
        const shimmer = 0.5 + 0.5 * Math.sin(timeSec * 2.1 + i * 1.15);
        const topX = toScreenX((a.xTop + b.xTop) * 0.5);
        const topY = toScreenY(0.15);
        const botX = toScreenX((a.xBot + b.xBot) * 0.5);
        const botY = toScreenY(Math.min((a.yBot + b.yBot) * 0.5, 14.5));
        const g = ctx.createLinearGradient(topX, topY, botX, botY);
        g.addColorStop(0, `rgba(103, 232, 249, ${(0.08 + shimmer * 0.12).toFixed(3)})`);
        g.addColorStop(0.65, `rgba(45, 212, 191, ${(0.03 + shimmer * 0.05).toFixed(3)})`);
        g.addColorStop(1, 'rgba(45, 212, 191, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(toScreenX(a.xTop), topY);
        ctx.lineTo(toScreenX(b.xTop), topY);
        ctx.lineTo(toScreenX(b.xBot), toScreenY(b.yBot));
        ctx.lineTo(toScreenX(a.xBot), toScreenY(a.yBot));
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawAnchoredLife(ctx, eco, xMin, xMax, yMin, yMax, toScreenX, toScreenY, scale, timeSec) {
    ctx.save();
    for (let i = 0; i < eco.anchored.length; i++) {
      const a = eco.anchored[i];
      if (a.x < xMin || a.x > xMax || a.y < yMin || a.y > yMax) continue;

      const sx = toScreenX(a.x);
      const sy = toScreenY(a.y);
      const sway = Math.sin(timeSec * 1.8 + a.phase) * 0.09 * scale;

      if (a.kind === 'vine') {
        // Floating lily pad + hanging green cenote vine
        ctx.strokeStyle = a.color;
        ctx.lineWidth = Math.max(1.5, 0.055 * scale);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + sway * 1.4, sy + a.size * 0.5 * scale, sx + sway * 0.8, sy + a.size * scale);
        ctx.stroke();

        // Lily pad at water surface
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 0.34 * scale, 0.08 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = a.accent;
        ctx.beginPath();
        ctx.arc(sx + 0.06 * scale, sy - 0.04 * scale, 0.07 * scale, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      const ang = Math.atan2(a.ny, a.nx);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang + Math.PI * 0.5);
      const sz = a.size * scale;

      if (a.kind === 'chara') {
        // Sunlit freshwater Chara stonewort & cenote aquatic moss tufts
        ctx.strokeStyle = a.color;
        ctx.lineWidth = Math.max(1.5, 0.048 * scale);
        ctx.lineCap = 'round';
        for (let b = -1; b <= 1; b++) {
          ctx.beginPath();
          ctx.moveTo(b * 0.07 * scale, 0);
          ctx.quadraticCurveTo(b * 0.12 * scale + sway, -sz * 0.55, b * 0.14 * scale + sway * 1.4, -sz);
          ctx.stroke();
        }
      } else if (a.kind === 'sodastraw') {
        // Hanging translucent calcite soda-straw stalactite needles & miniature curtain
        for (let s = -1; s <= 1; s++) {
          const sh = sz * (s === 0 ? 1.05 : 0.65);
          const ox = s * 0.11 * scale;
          ctx.fillStyle = a.color;
          ctx.fillRect(ox - 0.025 * scale, -sh, 0.05 * scale, sh);
          ctx.fillStyle = a.accent;
          ctx.beginPath();
          ctx.arc(ox, -sh, 0.032 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (a.kind === 'biofilm') {
        // Delicate pale amber/cream sulfur & iron-bacteria cave microbial filaments
        ctx.strokeStyle = a.color;
        ctx.lineWidth = Math.max(1.2, 0.03 * scale);
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(k * 0.06 * scale, 0);
          ctx.bezierCurveTo(
            k * 0.1 * scale + sway * 1.4,
            -sz * 0.4,
            k * 0.04 * scale - sway,
            -sz * 0.72,
            k * 0.11 * scale + sway * 1.6,
            -sz * 0.95
          );
          ctx.stroke();
          ctx.fillStyle = a.accent;
          ctx.beginPath();
          ctx.arc(k * 0.11 * scale + sway * 1.6, -sz * 0.95, 0.03 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (a.kind === 'crystal') {
        // Phreatic dogtooth calcite/aragonite mineral crystal cluster
        for (let c = -1; c <= 1; c++) {
          const ch = sz * (c === 0 ? 1.0 : 0.68);
          ctx.save();
          ctx.rotate(c * 0.34);
          ctx.fillStyle = a.color;
          ctx.beginPath();
          ctx.moveTo(-0.07 * scale, 0);
          ctx.lineTo(-0.05 * scale, -ch * 0.72);
          ctx.lineTo(0, -ch);
          ctx.lineTo(0.05 * scale, -ch * 0.72);
          ctx.lineTo(0.07 * scale, 0);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = a.accent;
          ctx.beginPath();
          ctx.moveTo(0, -ch);
          ctx.lineTo(0.05 * scale, -ch * 0.72);
          ctx.lineTo(0, -ch * 0.15);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  _drawSwimmers(ctx, eco, xMin, xMax, yMin, yMax, toScreenX, toScreenY, scale, timeSec) {
    ctx.save();
    // 1. Authentic Yucatan Cenote & Cave Fishes (Mollies, Mayan Cichlids, Catfish, Dama Blanca)
    for (let i = 0; i < eco.fish.length; i++) {
      const f = eco.fish[i];
      if (f.x < xMin || f.x > xMax || f.y < yMin || f.y > yMax) continue;
      drawStyledFish(ctx, f, toScreenX(f.x), toScreenY(f.y), scale, timeSec);
    }

    // 2. Mesoamerican Freshwater Cenote Slider Turtles in sunlit surface pools
    for (let i = 0; i < eco.turtles.length; i++) {
      const t = eco.turtles[i];
      if (t.x < xMin || t.x > xMax || t.y < yMin || t.y > yMax) continue;
      drawStyledTurtle(ctx, t, toScreenX(t.x), toScreenY(t.y), scale, timeSec);
    }

    // 3. Blind Cave Remipedes (Xibalbanus) & Eyeless Cave Prawns (Creaseria)
    for (let i = 0; i < eco.remipedes.length; i++) {
      const r = eco.remipedes[i];
      if (r.x < xMin || r.x > xMax || r.y < yMin || r.y > yMax) continue;
      drawStyledRemipede(ctx, r, toScreenX(r.x), toScreenY(r.y), scale, timeSec);
    }
    ctx.restore();
  }

  _drawCrystalSparkle(ctx, eco, xMin, xMax, yMin, yMax, toScreenX, toScreenY, scale, timeSec) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const crystalStamp = this.glowStamps.warm;
    for (let i = 0; i < eco.anchored.length; i++) {
      const a = eco.anchored[i];
      if (a.kind !== 'crystal') continue;
      if (a.x < xMin || a.x > xMax || a.y < yMin || a.y > yMax) continue;
      const sx = toScreenX(a.x);
      const sy = toScreenY(a.y);
      const flicker = 0.35 + 0.65 * Math.max(0, Math.sin(timeSec * 2.2 + a.phase));
      const rad = 0.35 * scale;
      ctx.globalAlpha = 0.12 * flicker;
      ctx.drawImage(crystalStamp, sx - rad, sy - rad, rad * 2, rad * 2);

      ctx.globalAlpha = 0.38 * flicker;
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(sx, sy - 0.1 * scale, Math.max(1, 0.03 * scale), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawGuideline(ctx, toScreenX, toScreenY, scale, playerLines = []) {
    const pts = this.level.guideline;
    if (pts && pts.length >= 2) {
      ctx.save();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
      ctx.lineWidth = Math.max(1.5, 0.08 * scale);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const sx = toScreenX(pts[i].x);
        const sy = toScreenY(pts[i].y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Directional line arrows pointing toward exit along segments
      ctx.fillStyle = '#fde047';
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const mx = toScreenX((a.x + b.x) * 0.5);
        const my = toScreenY((a.y + b.y) * 0.5);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(ang);
        const sz = Math.max(4, 0.22 * scale);
        ctx.beginPath();
        ctx.moveTo(sz, 0);
        ctx.lineTo(-sz * 0.7, -sz * 0.55);
        ctx.lineTo(-sz * 0.7, sz * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // Player-deployed cave guideline reels (white/cyan for local diver, safety orange for buddies)
    if (!Array.isArray(playerLines) || playerLines.length === 0) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const bundle of playerLines) {
      const chains = bundle?.chains;
      if (!Array.isArray(chains) || chains.length === 0) continue;
      const lineCol = bundle.isSelf ? 'rgba(224, 242, 254, 0.92)' : 'rgba(251, 146, 60, 0.9)';
      const pinCol = bundle.isSelf ? '#38bdf8' : '#fb923c';

      for (let cIdx = 0; cIdx < chains.length; cIdx++) {
        const chain = chains[cIdx];
        if (!Array.isArray(chain) || chain.length === 0) continue;

        if (chain.length >= 2) {
          ctx.strokeStyle = lineCol;
          ctx.lineWidth = Math.max(1.5, 0.075 * scale);
          ctx.beginPath();
          for (let i = 0; i < chain.length; i++) {
            const sx = toScreenX(chain[i].x);
            const sy = toScreenY(chain[i].y);
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.stroke();

          // Entry-return chevron markers pointing back toward tie-off origin
          ctx.fillStyle = pinCol;
          for (let i = 0; i < chain.length - 1; i++) {
            const a = chain[i];
            const b = chain[i + 1];
            const mx = toScreenX((a.x + b.x) * 0.5);
            const my = toScreenY((a.y + b.y) * 0.5);
            const angBack = Math.atan2(a.y - b.y, a.x - b.x);
            ctx.save();
            ctx.translate(mx, my);
            ctx.rotate(angBack);
            const sz = Math.max(3.5, 0.16 * scale);
            ctx.beginPath();
            ctx.moveTo(sz, 0);
            ctx.lineTo(-sz * 0.65, -sz * 0.5);
            ctx.lineTo(-sz * 0.65, sz * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }

        // Glowing tie-off anchor pins at each node
        for (let i = 0; i < chain.length; i++) {
          const sx = toScreenX(chain[i].x);
          const sy = toScreenY(chain[i].y);
          ctx.fillStyle = i === 0 ? '#fde047' : pinCol;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(2.6, (i === 0 ? 0.15 : 0.1) * scale), 0, Math.PI * 2);
          ctx.fill();
        }

        // Live tension line from open tail anchor to reeling diver
        if (bundle.reelingActive && cIdx === chains.length - 1 && Number.isFinite(bundle.ownerX)) {
          const tail = chain[chain.length - 1];
          ctx.strokeStyle = pinCol;
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = Math.max(1.4, 0.065 * scale);
          ctx.beginPath();
          ctx.moveTo(toScreenX(tail.x), toScreenY(tail.y));
          ctx.lineTo(toScreenX(bundle.ownerX), toScreenY(bundle.ownerY));
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
    ctx.restore();
  }

  _drawZonesAndMarkers(ctx, cw, ch, diver, diveState, toScreenX, toScreenY, scale, timeSec) {
    // 1. Subtle horizontal depth boundary lines (e.g., 33.7m EAN32 MOD)
    if (this.level.depthMarkers) {
      ctx.save();
      ctx.font = `700 ${Math.max(9, Math.round(0.32 * scale))}px ui-monospace, monospace`;
      ctx.textAlign = 'left';
      for (const dm of this.level.depthMarkers) {
        const sy = toScreenY(dm.y);
        if (sy < 0 || sy > ch) continue;
        ctx.strokeStyle = dm.color;
        ctx.lineWidth = 1.25;
        ctx.setLineDash([7, 7]);
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(cw, sy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = dm.color;
        ctx.fillText(dm.label, 12, sy - 5);
      }
      ctx.restore();
    }

    // 2. Horizontal Gas Switch & 6m Deco Stop Zone Lines (not boxes)
    if (!this.level.zoneLines) return;
    ctx.save();
    for (const z of this.level.zoneLines) {
      const x0 = toScreenX(z.xMin);
      const x1 = toScreenX(z.xMax);
      const sy = toScreenY(z.y);
      if (x1 < -40 || x0 > cw + 40 || sy < -50 || sy > ch + 50) continue;

      const nearDepth = Math.abs(diver.y - z.y) <= 1.6 && diver.x >= z.xMin && diver.x <= z.xMax;
      const pulse = 0.7 + 0.3 * Math.sin(timeSec * 4.5);

      // Soft horizontal depth-band glow around the line via pre-baked 1x64 strip
      const bandH = 0.7 * scale;
      if (this.glowStamps.bandGlow) {
        ctx.globalAlpha = nearDepth ? 1.0 : 0.55;
        ctx.drawImage(this.glowStamps.bandGlow, x0, sy - bandH, x1 - x0, bandH * 2);
        ctx.globalAlpha = 1;
      }

      // Crisp horizontal zone line with depth tick endcaps
      ctx.strokeStyle = z.color;
      ctx.globalAlpha = nearDepth ? 0.98 : 0.7 * pulse;
      ctx.lineWidth = nearDepth ? 2.6 : 1.8;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.moveTo(x0, sy);
      ctx.lineTo(x1, sy);
      ctx.stroke();
      ctx.setLineDash([]);

      // End-cap vertical depth ticks
      const tick = 0.35 * scale;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, sy - tick);
      ctx.lineTo(x0, sy + tick);
      ctx.moveTo(x1, sy - tick);
      ctx.lineTo(x1, sy + tick);
      ctx.stroke();

      // Label directly above horizontal line
      ctx.globalAlpha = 0.95;
      ctx.textAlign = 'center';
      const cx = (x0 + x1) * 0.5;
      ctx.font = `800 ${Math.max(10, Math.round(0.35 * scale))}px ui-monospace, monospace`;
      ctx.fillStyle = z.color;

      let label = z.title;
      if (z.id === 'zone-deco' && diveState) {
        if (diveState.stopDepthM > 0) {
          const s = Math.max(0, Math.ceil(diveState.stopRemainingSec));
          label = diveState.activeGasId === 'O2'
            ? `6m DECO LINE · HOLD 0:${String(s).padStart(2, '0')} ON O2 100%`
            : `6m DECO LINE · TAP O2 100% (0:${String(s).padStart(2, '0')})`;
        } else if (diveState.maxDepthM > 20) {
          label = '6m DECO LINE · CEILING CLEAR ✓ ASCEND TO EXIT';
        }
      }
      ctx.fillText(label, cx, sy - 7);
    }
    ctx.restore();
  }

  _drawWaypointCompass(ctx, cw, ch, diver, nextCheckpoint, toScreenX, toScreenY, scale, timeSec) {
    const target = nextCheckpoint || this.level.exitZone;
    if (!target) return;

    const tx = toScreenX(target.x);
    const ty = toScreenY(target.y);
    const distM = Math.hypot(target.x - diver.x, target.y - diver.y);
    if (distM < 3.5) return;

    // Draw floating directional ring around diver pointing toward objective
    const sx = toScreenX(diver.x);
    const sy = toScreenY(diver.y);
    const ang = Math.atan2(ty - sy, tx - sx);
    const orbitR = Math.max(38, 2.2 * scale);
    const ax = sx + Math.cos(ang) * orbitR;
    const ay = sy + Math.sin(ang) * orbitR;
    const clampedX = Math.max(26, Math.min(cw - 26, ax));
    const clampedY = Math.max(66, Math.min(ch - 26, ay));

    ctx.save();
    ctx.translate(clampedX, clampedY);
    ctx.rotate(ang);
    const pulse = 0.75 + 0.25 * Math.sin(timeSec * 5);
    ctx.fillStyle = nextCheckpoint ? `rgba(251, 191, 36, ${pulse})` : `rgba(74, 222, 128, ${pulse})`;
    const sz = Math.max(7, 0.28 * scale);
    ctx.beginPath();
    ctx.moveTo(sz, 0);
    ctx.lineTo(-sz * 0.7, -sz * 0.65);
    ctx.lineTo(-sz * 0.35, 0);
    ctx.lineTo(-sz * 0.7, sz * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawAscentCoach(ctx, diver, diveState, checkpointsHit, toScreenX, toScreenY, scale) {
    const step = getAscentInstruction(diveState, diver.y, checkpointsHit, getAscentConfig(this.level));
    if (!step) return;

    const sx = toScreenX(diver.x);
    const sy = toScreenY(diver.y);
    const pillY = sy - 1.55 * scale;

    ctx.save();
    // Compact floating action badge above diver: STOP HERE or NOW MOVE TO ...
    const isStop = step.action === 'STOP';
    const label = isStop ? `■ ${step.title}` : `▲ ${step.title}`;
    ctx.font = `800 ${Math.max(10, Math.round(0.34 * scale))}px ui-monospace, monospace`;
    const padX = 8;
    const textW = ctx.measureText(label).width;
    const boxW = textW + padX * 2;
    const boxH = Math.max(20, 0.62 * scale);

    ctx.fillStyle = isStop ? 'rgba(120, 53, 15, 0.88)' : 'rgba(8, 47, 73, 0.88)';
    ctx.strokeStyle = isStop ? '#fbbf24' : '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(sx - boxW * 0.5, pillY - boxH * 0.5, boxW, boxH, 999);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isStop ? '#fde68a' : '#e0f2fe';
    ctx.fillText(label, sx, pillY + 0.5);

    // Inline vertical Target Pace Bar right beside diver during MOVE steps
    if (!isStop && diveState.depthM > 1.2) {
      const barX = sx + 1.45 * scale;
      const barH = 1.7 * scale;
      const barY = sy - barH * 0.5;
      const barW = Math.max(7, 0.24 * scale);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 4);
      ctx.fill();
      ctx.stroke();

      // Target green band around 5..10 m/min (out of 18)
      const gTop = barY + barH * (1 - 10 / 18);
      const gBot = barY + barH * (1 - 5 / 18);
      ctx.fillStyle = 'rgba(74, 222, 128, 0.35)';
      ctx.fillRect(barX + 1, gTop, barW - 2, gBot - gTop);

      // Target 9 m/min tick
      const targetY = barY + barH * 0.5;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(barX - 2, targetY - 1, barW + 4, 2);

      // Live ascent rate marker
      const upRate = Math.max(0, Math.min(18, diveState.ascentRateMPerMin));
      const fillH = (upRate / 18) * barH;
      ctx.fillStyle = upRate > 11 ? '#f87171' : upRate >= 4 ? '#4ade80' : '#38bdf8';
      ctx.fillRect(barX + 1.5, barY + barH - fillH, barW - 3, fillH);
    }
    ctx.restore();
  }

  _drawCheckpoints(ctx, toScreenX, toScreenY, scale, checkpointsHit, nextCheckpoint, timeSec) {
    ctx.save();
    for (const cp of this.level.checkpoints) {
      const sx = toScreenX(cp.x);
      const sy = toScreenY(cp.y);
      const hit = checkpointsHit.has(cp.id);
      const isNext = nextCheckpoint && nextCheckpoint.id === cp.id;

      const pulse = 0.75 + 0.25 * Math.sin(timeSec * 4.5);
      const color = hit ? '#4ade80' : isNext ? '#fbbf24' : '#64748b';
      const r = (isNext ? 0.42 : 0.3) * scale * (isNext ? pulse : 1);

      // Cookie marker ring
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, 0.08 * scale);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = hit ? 'rgba(74, 222, 128, 0.35)' : isNext ? 'rgba(251, 191, 36, 0.35)' : 'rgba(100, 116, 139, 0.2)';
      ctx.fill();

      // Label
      ctx.font = `600 ${Math.max(10, Math.round(0.38 * scale))}px ui-monospace, SFMono-Regular, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      ctx.fillText(cp.name, sx, sy - r - 0.35 * scale);
    }

    // Exit Zone beacon
    const ex = this.level.exitZone;
    const exX = toScreenX(ex.x);
    const exY = toScreenY(ex.y);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(2, 0.08 * scale);
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(exX, exY, 0.9 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `700 ${Math.max(10, Math.round(0.4 * scale))}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#bae6fd';
    ctx.fillText('SURFACE EXIT', exX, exY - 1.15 * scale);
    ctx.restore();
  }

  _drawCollectibles(ctx, visX0, visX1, toScreenX, toScreenY, scale, collectedIds, timeSec) {
    const list = this.level.collectibles;
    if (!list || list.length === 0) return;
    ctx.save();
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (collectedIds && collectedIds.has(item.id)) continue;
      if (item.x < visX0 - 4 || item.x > visX1 + 4) continue;

      const bobY = Math.sin(timeSec * 2.3 + i * 1.4) * 0.14;
      const sx = toScreenX(item.x);
      const sy = toScreenY(item.y + bobY);
      const itemScale = item.scale || 1.0;
      const isGrand = itemScale >= 1.35;
      const pulse = 0.85 + 0.15 * Math.sin(timeSec * 4.2 + i);
      const r = 0.36 * scale * itemScale;

      const stamp =
        item.kind === 'relic'
          ? this.glowStamps.warm
          : item.kind === 'crystal'
            ? this.glowStamps.magenta
            : item.kind === 'fossil'
              ? this.glowStamps.emerald
              : this.glowStamps.cyan;
      if (stamp) {
        const gs = r * (isGrand ? 5.2 : 4.2) * pulse;
        ctx.drawImage(stamp, sx - gs * 0.5, sy - gs * 0.5, gs, gs);
      }

      if (isGrand) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(timeSec * 0.45 + i);
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.42)';
        ctx.lineWidth = Math.max(1.2, 0.045 * scale);
        for (let ray = 0; ray < 6; ray++) {
          const ang = (ray / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * r * 1.05, Math.sin(ang) * r * 1.05);
          ctx.lineTo(Math.cos(ang) * r * 1.85 * pulse, Math.sin(ang) * r * 1.85 * pulse);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.sin(timeSec * 1.6 + i) * 0.18);

      if (item.kind === 'relic') {
        // Ornate carved golden jade sunstone medallion
        ctx.fillStyle = '#eab308';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = Math.max(1.2, 0.05 * scale);
        ctx.beginPath();
        for (let p = 0; p < 8; p++) {
          const a = (p / 8) * Math.PI * 2;
          const rad = (p & 1) ? r * 0.72 : r * 1.05;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.kind === 'crystal') {
        // Luminous faceted hexagonal quartz cluster
        ctx.fillStyle = '#c084fc';
        ctx.strokeStyle = '#f3e8ff';
        ctx.lineWidth = Math.max(1.2, 0.045 * scale);
        for (const [ang, lenMul] of [[-0.28, 0.85], [0.0, 1.15], [0.28, 0.82]]) {
          ctx.save();
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.moveTo(0, -r * lenMul);
          ctx.lineTo(r * 0.28, -r * 0.25);
          ctx.lineTo(r * 0.24, r * 0.65);
          ctx.lineTo(-r * 0.24, r * 0.65);
          ctx.lineTo(-r * 0.28, -r * 0.25);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      } else if (item.kind === 'fossil') {
        // Cream-amber spiral fossil / shark tooth silhouette
        ctx.fillStyle = '#f5d0a9';
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = Math.max(1.2, 0.05 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        for (let s = 0; s < 18; s++) {
          const a = s * 0.45;
          const sr = r * 0.08 + (s / 18) * r * 0.65;
          const px = Math.cos(a) * sr;
          const py = Math.sin(a) * sr;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else {
        // Survey exploration reel / brass marker tag
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = Math.max(1.2, 0.05 * scale);
        ctx.beginPath();
        ctx.roundRect(-r * 0.8, -r * 0.55, r * 1.6, r * 1.1, r * 0.22);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  _drawBuddyRescueTethers(ctx, diver, peerList, toScreenX, toScreenY, scale, timeSec) {
    if (!Array.isArray(peerList) || peerList.length === 0) return;
    ctx.save();
    const allDivers = [
      { id: diver.id || '__self__', x: diver.x, y: diver.y, alive: true, rescueTargetId: diver.rescueTargetId || '' },
      ...peerList,
    ];

    // 1. SOS distress beacon rings around untowed downed buddies
    for (let i = 0; i < peerList.length; i++) {
      const p = peerList[i];
      if (!p || p.alive !== false || p.rescued) continue;
      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      const pulse = 0.55 + 0.45 * Math.sin(timeSec * 5.2);
      const r = (0.95 + pulse * 0.45) * scale;
      ctx.strokeStyle = p.rescuedBy ? 'rgba(74, 222, 128, 0.75)' : 'rgba(245, 158, 11, 0.82)';
      ctx.lineWidth = Math.max(1.8, 0.065 * scale);
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `800 ${Math.max(9, Math.round(0.32 * scale))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = p.rescuedBy ? '#86efac' : '#fde68a';
      ctx.fillText(p.rescuedBy ? 'TOWING' : 'SOS · RESCUE', sx, sy - r - 0.25 * scale);
    }

    // 2. Umbilical tow line between rescuer and towed teammate
    for (let i = 0; i < allDivers.length; i++) {
      const rescuer = allDivers[i];
      if (!rescuer?.rescueTargetId) continue;
      const target = peerList.find((p) => p && p.id === rescuer.rescueTargetId);
      const tPos = target || (rescuer !== allDivers[0] && diver.rescuedBy === rescuer.id ? diver : null);
      if (!tPos) continue;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = Math.max(2, 0.07 * scale);
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(toScreenX(rescuer.x), toScreenY(rescuer.y));
      ctx.lineTo(toScreenX(tPos.x), toScreenY(tPos.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  _drawRecoveryTarget(ctx, diver, peerList, bodyRecovered, carryingBody, toScreenX, toScreenY, scale, timeSec) {
    const rt = this.level.recoveryTarget;
    if (!rt) return;
    ctx.save();

    if (!bodyRecovered) {
      const sx = toScreenX(rt.x);
      const sy = toScreenY(rt.y);
      if (rt.kind === 'probe') {
        // Titanium Katla Bathysphere Seismic Core: beacon halo, tripod stabilizer, pressure sphere & viewport
        const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.6);
        const halo = ctx.createRadialGradient(sx, sy, 0.2 * scale, sx, sy, (2.2 + pulse * 0.65) * scale);
        halo.addColorStop(0, 'rgba(45, 212, 191, 0.34)');
        halo.addColorStop(0.55, 'rgba(56, 189, 248, 0.14)');
        halo.addColorStop(1, 'rgba(45, 212, 191, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(sx, sy, (2.2 + pulse * 0.65) * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(sx, sy);
        // Anchoring skid legs + vertical stabilizing fins
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = Math.max(1.5, 0.08 * scale);
        ctx.beginPath();
        ctx.moveTo(-0.55 * scale, 0.65 * scale);
        ctx.lineTo(0, 0.12 * scale);
        ctx.lineTo(0.55 * scale, 0.65 * scale);
        ctx.moveTo(-0.75 * scale, 0.65 * scale);
        ctx.lineTo(0.75 * scale, 0.65 * scale);
        ctx.stroke();

        // Titanium pressure hull
        const hullGrad = ctx.createRadialGradient(-0.18 * scale, -0.18 * scale, 0.08 * scale, 0, 0, 0.62 * scale);
        hullGrad.addColorStop(0, '#e2e8f0');
        hullGrad.addColorStop(0.5, '#64748b');
        hullGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = hullGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 0.58 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Equatorial clamp ring & tow lug
        ctx.strokeStyle = '#2dd4bf';
        ctx.lineWidth = Math.max(1.2, 0.06 * scale);
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.58 * scale, 0.17 * scale, -0.15, 0, Math.PI * 2);
        ctx.stroke();

        // Glowing sapphire sensor viewport + top transponder mast
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0.16 * scale, -0.04 * scale, 0.2 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(94, 234, 212, ${(0.72 + pulse * 0.28).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(0.16 * scale, -0.04 * scale, 0.14 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Mast + strobe
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(1, 0.045 * scale);
        ctx.beginPath();
        ctx.moveTo(0, -0.58 * scale);
        ctx.lineTo(0, -1.08 * scale);
        ctx.stroke();
        const strobe = Math.pow(0.5 + 0.5 * Math.sin(timeSec * 6.0), 3);
        ctx.fillStyle = `rgba(251, 146, 60, ${(0.35 + strobe * 0.65).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(0, -1.1 * scale, (0.09 + strobe * 0.09) * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const dist = Math.hypot(diver.x - rt.x, diver.y - rt.y);
        if (dist < 26) {
          ctx.font = `800 ${Math.max(10, Math.round(0.32 * scale))}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#5eead4';
          ctx.fillText(`🛰 ${rt.name.toUpperCase()} (${Math.round(rt.y)}m)`, sx, sy - 1.45 * scale);
        }
        ctx.restore();
        return;
      }

      // Resting fallen cave diver silhouette on rocky cavern shelf + blinking amber locator strobe
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-0.18);
      // Fins + legs + drysuit torso + twin tanks
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-0.82 * scale, -0.14 * scale, 1.35 * scale, 0.28 * scale);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-0.45 * scale, -0.26 * scale, 0.78 * scale, 0.16 * scale);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(-1.02 * scale, -0.16 * scale, 0.28 * scale, 0.1 * scale);
      ctx.fillRect(-1.02 * scale, 0.05 * scale, 0.28 * scale, 0.1 * scale);
      // Helmet & visor
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0.58 * scale, -0.02 * scale, 0.18 * scale, 0, Math.PI * 2);
      ctx.fill();
      // Emergency wrist locator strobe
      const strobe = Math.pow(0.5 + 0.5 * Math.sin(timeSec * 5.2), 3);
      ctx.fillStyle = `rgba(251, 146, 60, ${(0.35 + strobe * 0.65).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(0.2 * scale, -0.24 * scale, (0.08 + strobe * 0.08) * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const dist = Math.hypot(diver.x - rt.x, diver.y - rt.y);
      if (dist < 22) {
        ctx.font = `800 ${Math.max(10, Math.round(0.32 * scale))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fdba74';
        ctx.fillText(`🛟 ${rt.name.toUpperCase()} (${Math.round(rt.y)}m)`, sx, sy - 0.75 * scale);
      }
      ctx.restore();
      return;
    }

    // Recovered target towed gently behind carrier diver (local player or co-op buddy)
    let carrier = carryingBody ? diver : null;
    if (!carrier && Array.isArray(peerList)) {
      carrier = peerList.find((p) => p && p.carryingBody);
    }
    if (carrier) {
      const ang = carrier.angle || 0;
      const towDist = rt.kind === 'probe' ? 1.8 : 1.65;
      const sway = Math.sin(timeSec * 2.2) * 0.12;
      const bx = carrier.x - Math.cos(ang) * towDist - Math.sin(ang) * sway;
      const by = carrier.y - Math.sin(ang) * towDist + Math.cos(ang) * sway;
      const cx = toScreenX(carrier.x);
      const cy = toScreenY(carrier.y);
      const tx = toScreenX(bx);
      const ty = toScreenY(by);

      ctx.strokeStyle = rt.kind === 'probe' ? 'rgba(94, 234, 212, 0.9)' : 'rgba(251, 191, 36, 0.88)';
      ctx.lineWidth = Math.max(1.5, 0.055 * scale);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(ang);
      if (rt.kind === 'probe') {
        const pulse = 0.5 + 0.5 * Math.sin(timeSec * 5.0);
        const g = ctx.createRadialGradient(-0.12 * scale, -0.12 * scale, 0.05 * scale, 0, 0, 0.44 * scale);
        g.addColorStop(0, '#e2e8f0');
        g.addColorStop(0.55, '#64748b');
        g.addColorStop(1, '#1e293b');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 0.42 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2dd4bf';
        ctx.lineWidth = Math.max(1.2, 0.05 * scale);
        ctx.stroke();
        ctx.fillStyle = `rgba(94, 234, 212, ${(0.7 + pulse * 0.3).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(0.14 * scale, 0, 0.12 * scale, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-0.62 * scale, -0.14 * scale, 1.1 * scale, 0.28 * scale);
        ctx.fillStyle = '#475569';
        ctx.fillRect(-0.35 * scale, -0.25 * scale, 0.65 * scale, 0.14 * scale);
        ctx.fillStyle = '#eab308';
        ctx.fillRect(-0.82 * scale, -0.14 * scale, 0.24 * scale, 0.24 * scale);
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0.48 * scale, 0, 0.16 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  _drawGeothermalVents(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec) {
    const vents = this.level.geothermalVents;
    if (!vents || vents.length === 0) return;
    ctx.save();
    for (let vIdx = 0; vIdx < vents.length; vIdx++) {
      const v = vents[vIdx];
      const hw = v.halfWidth || 3.4;
      const height = v.height || 18;
      if (v.x + hw < visX0 - 4 || v.x - hw > visX1 + 4) continue;
      if (v.y < visY0 - 4 || v.y - height > visY1 + 4) continue;

      const sx = toScreenX(v.x);
      const sy = toScreenY(v.y);
      const throatY = sy - 0.95 * scale;

      // Soft feathered hydrothermal convection plume puffs (no hard polygon edges!)
      const puffCount = 7;
      for (let p = 0; p < puffCount; p++) {
        const t = p / (puffCount - 1);
        const py = toScreenY(v.y - 1.2 - t * (height * 0.88));
        const swayX = sx + Math.sin(timeSec * 2.4 - t * 3.6 + vIdx * 1.7) * (0.18 + t * 0.65) * scale;
        const rx = (0.75 + t * hw * 0.52) * scale;
        const ry = (1.6 + t * 1.9) * scale;
        const rMax = Math.max(rx, ry);
        ctx.save();
        ctx.translate(swayX, py);
        ctx.scale(rx / rMax, ry / rMax);
        const g = ctx.createRadialGradient(0, 0, rMax * 0.05, 0, 0, rMax);
        const fade = Math.max(0, 1 - t * 0.92);
        if (t < 0.25) {
          g.addColorStop(0, `rgba(251, 146, 60, ${(0.22 * fade).toFixed(3)})`);
          g.addColorStop(0.55, `rgba(45, 212, 191, ${(0.11 * fade).toFixed(3)})`);
        } else {
          g.addColorStop(0, `rgba(45, 212, 191, ${(0.14 * fade).toFixed(3)})`);
          g.addColorStop(0.6, `rgba(56, 189, 248, ${(0.07 * fade).toFixed(3)})`);
        }
        g.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rMax, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Craggy basalt black-smoker chimney silhouette (jagged volcanic spire, not a flat box)
      ctx.fillStyle = '#070b14';
      ctx.beginPath();
      ctx.moveTo(sx - 1.55 * scale, sy + 0.7 * scale);
      ctx.lineTo(sx - 1.15 * scale, sy - 0.1 * scale);
      ctx.lineTo(sx - 0.85 * scale, sy - 0.55 * scale);
      ctx.lineTo(sx - 0.52 * scale, sy - 1.15 * scale);
      ctx.lineTo(sx - 0.18 * scale, sy - 0.95 * scale);
      ctx.lineTo(sx + 0.16 * scale, sy - 1.2 * scale);
      ctx.lineTo(sx + 0.56 * scale, sy - 1.08 * scale);
      ctx.lineTo(sx + 0.95 * scale, sy - 0.45 * scale);
      ctx.lineTo(sx + 1.5 * scale, sy + 0.7 * scale);
      ctx.closePath();
      ctx.fill();

      // Glowing magma vent fissure halo + inner molten cracks
      const glowPulse = 0.74 + 0.26 * Math.sin(timeSec * 4.4 + vIdx * 2.1);
      const ventGlow = ctx.createRadialGradient(sx, throatY, 0.08 * scale, sx, throatY, 2.9 * scale);
      ventGlow.addColorStop(0, `rgba(254, 240, 138, ${(0.95 * glowPulse).toFixed(2)})`);
      ventGlow.addColorStop(0.22, `rgba(251, 146, 60, ${(0.65 * glowPulse).toFixed(2)})`);
      ventGlow.addColorStop(0.58, `rgba(234, 88, 12, ${(0.22 * glowPulse).toFixed(2)})`);
      ventGlow.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = ventGlow;
      ctx.beginPath();
      ctx.arc(sx, throatY, 2.9 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(253, 186, 116, ${(0.82 * glowPulse).toFixed(2)})`;
      ctx.lineWidth = Math.max(1.2, 0.055 * scale);
      ctx.beginPath();
      ctx.moveTo(sx - 0.38 * scale, throatY + 0.05 * scale);
      ctx.lineTo(sx - 0.08 * scale, throatY - 0.08 * scale);
      ctx.lineTo(sx + 0.28 * scale, throatY + 0.04 * scale);
      ctx.moveTo(sx - 0.12 * scale, throatY + 0.12 * scale);
      ctx.lineTo(sx + 0.08 * scale, throatY + 0.55 * scale);
      ctx.stroke();

      // Rising mineral bubbles & glowing thermal embers inside the updraft column (clipped inside open cave water)
      for (let b = 0; b < 14; b++) {
        const phase = ((timeSec * (0.42 + (b % 3) * 0.14) + vIdx * 0.31 + b / 14) % 1);
        const by = v.y - 1.0 - phase * height;
        const bx = v.x + Math.sin(phase * 9.0 + b * 2.1 + timeSec * 2.5) * hw * (0.26 + phase * 0.36);
        if (evaluateCaveSDF(this.level, bx, by) >= -0.25) continue;
        const bsx = toScreenX(bx);
        const bsy = toScreenY(by);
        const alpha = (1 - phase) * (b % 3 === 0 ? 0.85 : 0.58);
        const er = Math.max(1.3, (0.045 + (1 - phase) * 0.065) * scale);
        ctx.fillStyle = b % 3 === 0
          ? `rgba(253, 186, 116, ${alpha.toFixed(2)})`
          : `rgba(94, 234, 212, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(bsx, bsy, er, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawBioluminescence(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec) {
    if (visY1 < 34) return;
    const cellSize = 10;
    const cx0 = Math.floor(visX0 / cellSize);
    const cx1 = Math.ceil(visX1 / cellSize);
    const cy0 = Math.max(Math.floor(34 / cellSize), Math.floor(visY0 / cellSize));
    const cy1 = Math.ceil(visY1 / cellSize);
    ctx.save();
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let k = 0; k < 6; k++) {
          const h1 = Math.sin(cx * 127.1 + cy * 311.7 + k * 74.7) * 43758.5453;
          const r1 = h1 - Math.floor(h1);
          const h2 = Math.sin(cx * 269.5 + cy * 183.3 + k * 41.9) * 43758.5453;
          const r2 = h2 - Math.floor(h2);
          const wx = (cx + r1) * cellSize + Math.sin(timeSec * 0.55 + r2 * 6.28) * 0.75;
          const wy = (cy + r2) * cellSize + Math.cos(timeSec * 0.45 + r1 * 6.28) * 0.55;
          if (wy < 34 || evaluateCaveSDF(this.level, wx, wy) >= -0.35) continue;
          const twinkle = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(timeSec * 1.9 + r1 * 12 + k), 2);
          const sx = toScreenX(wx);
          const sy = toScreenY(wy);
          const haloR = Math.max(4.5, (0.2 + r2 * 0.16) * scale);
          const isTeal = k % 2 === 0;
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, haloR);
          if (isTeal) {
            g.addColorStop(0, `rgba(153, 246, 228, ${(0.9 * twinkle).toFixed(2)})`);
            g.addColorStop(0.28, `rgba(45, 212, 191, ${(0.42 * twinkle).toFixed(2)})`);
            g.addColorStop(1, 'rgba(45, 212, 191, 0)');
          } else {
            g.addColorStop(0, `rgba(221, 214, 254, ${(0.85 * twinkle).toFixed(2)})`);
            g.addColorStop(0.28, `rgba(167, 139, 250, ${(0.38 * twinkle).toFixed(2)})`);
            g.addColorStop(1, 'rgba(167, 139, 250, 0)');
          }
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(sx, sy, haloR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  _drawCollectBursts(ctx, bursts, toScreenX, toScreenY, scale) {
    if (!bursts || bursts.length === 0) return;
    ctx.save();
    for (const b of bursts) {
      const t = Math.min(1, b.age / b.duration);
      const alpha = Math.max(0, 1 - t);
      const sx = toScreenX(b.x);
      const sy = toScreenY(b.y - t * 1.45);
      const ringR = (0.35 + t * 1.5) * scale;

      ctx.strokeStyle = `rgba(253, 224, 71, ${alpha * 0.9})`;
      ctx.lineWidth = Math.max(1.5, (1 - t) * 0.1 * scale);
      ctx.beginPath();
      ctx.arc(toScreenX(b.x), toScreenY(b.y), ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = `800 ${Math.max(13, Math.round(0.55 * scale))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
      ctx.fillText(`+${b.points}`, sx, sy);
    }
    ctx.restore();
  }

  _drawCelebrationParticles(ctx, particles, cw, ch) {
    ctx.save();
    for (const p of particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.translate(p.x * cw, p.y * ch);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'bubble') {
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillRect(-p.size * 0.6, -p.size * 0.35, p.size * 1.2, p.size * 0.7);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  _drawLimbSegment(ctx, x1, y1, x2, y2, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  _drawArticulatedLeg(ctx, pelvis, leg, toScreenX, toScreenY, scale, isPeer, isBackLeg) {
    const px = toScreenX(pelvis.x);
    const py = toScreenY(pelvis.y);
    const kx = toScreenX(leg.knee.x);
    const ky = toScreenY(leg.knee.y);
    const ax = toScreenX(leg.ankle.x);
    const ay = toScreenY(leg.ankle.y);
    const fx = toScreenX(leg.finTip.x);
    const fy = toScreenY(leg.finTip.y);

    const suitColor = isBackLeg ? '#09111e' : '#111c2d';
    const trimColor = isPeer
      ? (isBackLeg ? '#9a3412' : '#fb923c')
      : (isBackLeg ? '#0369a1' : '#38bdf8');

    // Thigh & calf
    this._drawLimbSegment(ctx, px, py, kx, ky, 0.21 * scale, suitColor);
    this._drawLimbSegment(ctx, kx, ky, ax, ay, 0.16 * scale, suitColor);

    // Ankle & Boot Heel anchored at (ax, ay) aligned with fin direction
    const ang = Math.atan2(fy - ay, fx - ax);
    const dirX = Math.cos(ang);
    const dirY = Math.sin(ang);
    const nx = -dirY;
    const ny = dirX;
    const finLen = Math.hypot(fx - ax, fy - ay);

    const heelX = ax - dirX * (0.04 * scale);
    const heelY = ay - dirY * (0.04 * scale);
    const pocketX = ax + dirX * (0.14 * scale);
    const pocketY = ay + dirY * (0.14 * scale);
    this._drawLimbSegment(ctx, heelX, heelY, pocketX, pocketY, 0.135 * scale, '#1e293b');

    // Scuba Jet Fin blade extending cleanly from foot pocket to finTip
    const open = leg.finOpen ?? 0.65;
    const baseHalfW = Math.max(1.5, 0.045 * scale * (0.55 + open * 0.45));
    const tipHalfW = Math.max(2.0, 0.115 * scale * (0.35 + open * 0.75));
    const bladeStartX = ax + dirX * (0.08 * scale);
    const bladeStartY = ay + dirY * (0.08 * scale);
    const midX = bladeStartX * 0.46 + fx * 0.54;
    const midY = bladeStartY * 0.46 + fy * 0.54;

    ctx.fillStyle = trimColor;
    ctx.beginPath();
    ctx.moveTo(bladeStartX + nx * baseHalfW, bladeStartY + ny * baseHalfW);
    ctx.quadraticCurveTo(
      midX + nx * (baseHalfW * 0.6 + tipHalfW * 0.45),
      midY + ny * (baseHalfW * 0.6 + tipHalfW * 0.45),
      fx + nx * tipHalfW,
      fy + ny * tipHalfW
    );
    // Scalloped jet-fin trailing tip
    ctx.quadraticCurveTo(
      fx - dirX * (0.03 * scale),
      fy - dirY * (0.03 * scale),
      fx - nx * tipHalfW,
      fy - ny * tipHalfW
    );
    ctx.quadraticCurveTo(
      midX - nx * (baseHalfW * 0.6 + tipHalfW * 0.45),
      midY - ny * (baseHalfW * 0.6 + tipHalfW * 0.45),
      bladeStartX - nx * baseHalfW,
      bladeStartY - ny * baseHalfW
    );
    ctx.closePath();
    ctx.fill();

    // Side rails & vent highlights
    if (finLen > 5) {
      ctx.strokeStyle = isBackLeg ? 'rgba(15,23,42,0.55)' : 'rgba(15,23,42,0.75)';
      ctx.lineWidth = Math.max(1, 0.028 * scale);
      ctx.beginPath();
      ctx.moveTo(bladeStartX + nx * baseHalfW, bladeStartY + ny * baseHalfW);
      ctx.lineTo(fx + nx * tipHalfW, fy + ny * tipHalfW);
      ctx.moveTo(bladeStartX - nx * baseHalfW, bladeStartY - ny * baseHalfW);
      ctx.lineTo(fx - nx * tipHalfW, fy - ny * tipHalfW);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = Math.max(1, 0.02 * scale);
      ctx.beginPath();
      ctx.moveTo(pocketX, pocketY);
      ctx.lineTo(ax + dirX * (finLen * 0.62), ay + dirY * (finLen * 0.62));
      ctx.stroke();
    }
  }

  _drawDiver(ctx, diver, toScreenX, toScreenY, scale, timeSec, isPeer) {
    const body = diver.body || createDiverBody(diver.x, diver.y, diver.angle);
    const sx = toScreenX(diver.x);
    const sy = toScreenY(diver.y);
    const px = toScreenX(body.pelvis.x);
    const py = toScreenY(body.pelvis.y);
    const hx = toScreenX(body.hand.x);
    const hy = toScreenY(body.hand.y);

    ctx.save();

    // 1. Far leg (behind torso)
    this._drawArticulatedLeg(ctx, body.pelvis, body.legs[1], toScreenX, toScreenY, scale, isPeer, true);

    // 2. Articulated Torso connecting shoulders (sx, sy) to pelvis (px, py)
    const accent = isPeer ? '#fb923c' : '#22d3ee';
    const torsoAngle = Math.atan2(sy - py, sx - px);
    const rollScale = Math.abs(body.rollVisual) < 0.15 ? 0.15 : body.rollVisual;
    const facingLeft = body.facingSign < 0;

    // Flexible drysuit spine core
    this._drawLimbSegment(ctx, px, py, sx, sy, 0.36 * scale, '#0f172a');
    // Subtle shoulder / hip trim stripe
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1.5, 0.04 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(sx, sy);
    ctx.stroke();

    // 3. Rigid Rig & Head oriented to torsoAngle + smooth roll (artSprites)
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(torsoAngle);
    if (facingLeft) ctx.scale(1, -1);

    const u = scale * 0.55;
    drawStyledDiverRig(ctx, u, scale, isPeer, rollScale);
    ctx.restore();

    // 4. Near leg (in front of pelvis)
    this._drawArticulatedLeg(ctx, body.pelvis, body.legs[0], toScreenX, toScreenY, scale, isPeer, false);

    // 5. Articulated Arm, Wrist Dive Computer & Goodman-handle Primary Torch
    const shoulderX = sx + Math.cos(torsoAngle) * (0.08 * scale);
    const shoulderY = sy + Math.sin(torsoAngle) * (0.08 * scale);
    const midArmX = (shoulderX + hx) * 0.5 + Math.sin(torsoAngle) * body.facingSign * (0.12 * scale);
    const midArmY = (shoulderY + hy) * 0.5 - Math.cos(torsoAngle) * body.facingSign * (0.12 * scale);
    this._drawLimbSegment(ctx, shoulderX, shoulderY, midArmX, midArmY, 0.14 * scale, '#1e293b');
    this._drawLimbSegment(ctx, midArmX, midArmY, hx, hy, 0.12 * scale, '#0f172a');

    // Glowing cyan wrist dive computer on forearm
    const wrX = midArmX * 0.46 + hx * 0.54;
    const wrY = midArmY * 0.46 + hy * 0.54;
    ctx.save();
    ctx.translate(wrX, wrY);
    ctx.rotate(Math.atan2(hy - midArmY, hx - midArmX));
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-0.07 * scale, -0.055 * scale, 0.14 * scale, 0.11 * scale, 0.025 * scale);
    ctx.fill();
    ctx.fillStyle = isPeer ? '#fdba74' : '#22d3ee';
    ctx.fillRect(-0.045 * scale, -0.032 * scale, 0.09 * scale, 0.064 * scale);
    ctx.restore();

    // Torch body at hand
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(diver.angle);
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(-0.1 * scale, -0.055 * scale, 0.28 * scale, 0.11 * scale, 0.03 * scale);
    ctx.fill();
    if (diver.torchOn !== false) {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0.18 * scale, 0, 0.05 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();

    // Buddy nameplate + live overhead gas & physiological vital bar
    if (isPeer && diver.name) {
      const bar = Math.round(diver.activeBar ?? 200);
      const bpm = diver.alive === false ? 0 : Math.round(diver.heartRateBpm ?? 68);
      const stress = Math.round(
        Math.max(
          diver.cnsPercent || 0,
          diver.dcsStress || 0,
          diver.hypoxiaStress || 0,
          diver.cardiacStress || 0,
          (diver.narcosisLevel || 0) * 80
        )
      );
      const cond = diver.alive === false ? 'DOWN' : (diver.condition || 'NOMINAL');
      const alertColor =
        diver.alive === false || cond === 'NO GAS' || cond === 'HYPOXIA' || cond === 'O2 TOX' || stress >= 65 || bpm >= 150
          ? '#ef4444'
          : cond !== 'NOMINAL' || bar < 50 || stress >= 25 || bpm >= 118
            ? '#fbbf24'
            : '#fdba74';

      const pillY = sy - scale * 1.12;
      const barW = Math.max(42, 1.8 * scale);
      ctx.save();
      ctx.font = `700 ${Math.max(9, Math.round(0.32 * scale))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = alertColor;
      const hrTag = diver.alive === false ? '' : ` ♥${bpm}`;
      const tag = cond === 'NOMINAL' ? `${diver.name} · ${bar}b${hrTag}` : `${diver.name} · ${cond} (${bar}b${hrTag})`;
      ctx.fillText(tag, sx, pillY - 5);

      // Compact mini-bars below nameplate (left: gas, right: stress)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(sx - barW * 0.5, pillY, barW, 4);
      const gasW = Math.max(0, Math.min(1, bar / 200)) * (barW * 0.48);
      ctx.fillStyle = bar < 45 ? '#ef4444' : '#38bdf8';
      ctx.fillRect(sx - barW * 0.5, pillY, gasW, 4);
      const stressW = Math.max(0, Math.min(1, stress / 100)) * (barW * 0.48);
      ctx.fillStyle = stress >= 65 ? '#ef4444' : stress >= 25 ? '#fbbf24' : '#4ade80';
      ctx.fillRect(sx + barW * 0.02, pillY, stressW, 4);
      ctx.restore();
    }

    // Overhead diver hand-signal / comms speech pill
    if (diver.signalText && diver.signalExpiresAt > performance.now()) {
      const msgY = sy - scale * (isPeer ? 1.85 : 1.45);
      ctx.save();
      ctx.font = `800 ${Math.max(10, Math.round(0.35 * scale))}px ui-monospace, monospace`;
      const padX = 8;
      const tw = ctx.measureText(diver.signalText).width;
      const bw = tw + padX * 2;
      const bh = Math.max(19, 0.56 * scale);
      ctx.fillStyle = 'rgba(8, 47, 73, 0.92)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(sx - bw * 0.5, msgY - bh * 0.5, bw, bh, 999);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e0f2fe';
      ctx.fillText(diver.signalText, sx, msgY + 0.5);
      ctx.restore();
    }
  }

  _drawPeerEdgeIndicators(ctx, cw, ch, diver, peers, toScreenX, toScreenY, timeSec) {
    if (!peers || peers.length === 0) return;
    ctx.save();
    for (let i = 0; i < peers.length; i++) {
      const p = peers[i];
      const px = toScreenX(p.x);
      const py = toScreenY(p.y);
      const margin = 34;
      const onScreen = px >= margin && px <= cw - margin && py >= 66 && py <= ch - margin;
      if (onScreen) continue;

      const distM = Math.round(Math.hypot(p.x - diver.x, p.y - diver.y));
      const ang = Math.atan2(py - ch * 0.5, px - cw * 0.5);
      const rx = Math.max(margin, Math.min(cw - margin, cw * 0.5 + Math.cos(ang) * (cw * 0.5 - margin)));
      const ry = Math.max(76, Math.min(ch - margin, ch * 0.5 + Math.sin(ang) * (ch * 0.5 - margin)));

      const cond = p.alive === false ? 'DOWN' : (p.condition || 'NOMINAL');
      const distressed = p.alive === false || cond === 'NO GAS' || cond === 'HYPOXIA' || cond === 'O2 TOX' || cond === 'DCS';
      const pulse = distressed ? 0.65 + 0.35 * Math.sin(timeSec * 8) : 0.9;
      const col = p.alive === false || cond === 'NO GAS' || cond === 'HYPOXIA' || cond === 'O2 TOX'
        ? '#ef4444'
        : cond !== 'NOMINAL'
          ? '#fbbf24'
          : '#fdba74';

      ctx.globalAlpha = pulse;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(ang);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-7, -6);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-7, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.font = '700 10px ui-monospace, monospace';
      ctx.textAlign = rx > cw * 0.5 ? 'right' : 'left';
      ctx.fillStyle = col;
      const lx = rx > cw * 0.5 ? rx - 14 : rx + 14;
      const label = cond === 'NOMINAL' ? `${p.name || 'Buddy'} ${distM}m` : `${p.name || 'Buddy'} ${cond} ${distM}m`;
      ctx.fillText(label, lx, ry + 3);
    }
    ctx.restore();
  }

  _drawVolumetricTorchBeam(ctx, diver, torchData, rangeM, { siltHaze = 0, isPeer = false, toScreenX, toScreenY, scale, timeSec = 0 } = {}) {
    if (!torchData) return;
    ctx.save();
    const tx = toScreenX(torchData.ox);
    const ty = toScreenY(torchData.oy);
    const rPx = rangeM * scale;

    ctx.beginPath();
    ctx.moveTo(tx, ty);
    for (let i = 0; i < torchData.rays.length; i++) {
      const pt = torchData.rays[i];
      ctx.lineTo(toScreenX(pt.x), toScreenY(pt.y));
    }
    ctx.closePath();
    ctx.clip();

    ctx.globalCompositeOperation = 'screen';
    const intensity = isPeer ? 0.58 : 1.0;
    const warmBoost = Math.min(0.18, siltHaze * 0.14);
    const scatter = ctx.createRadialGradient(tx, ty, 0.15 * scale, tx, ty, rPx);
    scatter.addColorStop(0, `rgba(254, 249, 195, ${(0.24 * intensity + warmBoost).toFixed(3)})`);
    scatter.addColorStop(0.28, `rgba(186, 230, 253, ${(0.14 * intensity + warmBoost * 0.45).toFixed(3)})`);
    scatter.addColorStop(0.7, `rgba(14, 165, 233, ${(0.05 * intensity).toFixed(3)})`);
    scatter.addColorStop(1, 'rgba(2, 132, 199, 0)');
    ctx.fillStyle = scatter;
    ctx.fillRect(tx - rPx, ty - rPx, rPx * 2, rPx * 2);

    // Tight hotspot beam core
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.arc(tx, ty, rPx * 0.9, diver.angle - 0.13, diver.angle + 0.13);
    ctx.closePath();
    ctx.fillStyle = `rgba(224, 242, 254, ${(0.1 * intensity).toFixed(3)})`;
    ctx.fill();

    // Smooth feathered 2D Ray-Cast Tyndall / Particulate Light Shafts (2-ray spans = 2x fewer draw calls)
    ctx.globalCompositeOperation = 'lighter';
    const rayLen = torchData.rays.length;
    for (let i = 0; i < rayLen - 2; i += 2) {
      const rA = torchData.rays[i];
      const rB = torchData.rays[Math.min(rayLen - 1, i + 2)];
      const centerDist = Math.abs((i + 1) / Math.max(1, rayLen - 1) - 0.5) * 2;
      const rayAlpha = (1 - centerDist * 0.75) * 0.024 * intensity;
      ctx.fillStyle = `rgba(186, 230, 253, ${rayAlpha.toFixed(4)})`;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(toScreenX(rA.x), toScreenY(rA.y));
      ctx.lineTo(toScreenX(rB.x), toScreenY(rB.y));
      ctx.closePath();
      ctx.fill();
    }

    if (!isPeer && this.dustMotes.length > 0) {
      // Suspended water particulates & soft bokeh plankton sparkling inside ray-cast torch polygon
      const maxDistSq = rangeM * rangeM;
      const moteStamp = this.glowStamps.cyan;
      const sparks = [];
      for (let i = 0; i < this.dustMotes.length; i++) {
        const m = this.dustMotes[i];
        const dx = m.x - torchData.ox;
        const dy = m.y - torchData.oy;
        const dSq = dx * dx + dy * dy;
        if (dSq > maxDistSq || dSq < 0.3) continue;
        const driftX = m.x + Math.sin(timeSec * 0.8 + m.phase) * 0.18;
        const driftY = m.y + Math.cos(timeSec * 0.65 + m.phase) * 0.14;
        const fade = Math.max(0, 1 - Math.sqrt(dSq) / rangeM);
        const mx = toScreenX(driftX);
        const my = toScreenY(driftY);
        if (i % 5 === 0) {
          const bokehR = Math.max(4, m.size * 6.5 * scale);
          ctx.globalAlpha = 0.28 * fade;
          ctx.drawImage(moteStamp, mx - bokehR, my - bokehR, bokehR * 2, bokehR * 2);
        }
        sparks.push(mx, my, Math.max(1, m.size * scale));
      }
      if (sparks.length > 0) {
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        for (let i = 0; i < sparks.length; i += 3) {
          const mx = sparks[i];
          const my = sparks[i + 1];
          const r = sparks[i + 2];
          ctx.moveTo(mx + r, my);
          ctx.arc(mx, my, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
    ctx.restore();

    // Normal-weighted 2D diffuse limestone wall scatter & mineral rim glint via pre-baked glowStamps
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const warmStamp = this.glowStamps.warm;
    const cyanStamp = this.glowStamps.cyan;
    const wallStep = isPeer ? 2 : 1;
    for (let i = 1; i < torchData.rays.length - 1; i += wallStep) {
      const pt = torchData.rays[i];
      if (!pt.hitWall || pt.dist > rangeM) continue;
      const wx = toScreenX(pt.x + pt.nx * 0.25);
      const wy = toScreenY(pt.y + pt.ny * 0.25);
      const beamWeight = 1 - Math.abs(i / (torchData.rays.length - 1) - 0.5) * 1.1;
      const strength = Math.max(0, (1 - pt.dist / rangeM) * pt.incidence * beamWeight) * 0.16 * intensity;
      if (strength < 0.008) continue;
      const rad = (1.0 + pt.dist * 0.06) * scale;
      ctx.globalAlpha = Math.min(0.45, strength);
      ctx.drawImage(pt.dist < 6.5 ? warmStamp : cyanStamp, wx - rad, wy - rad, rad * 2, rad * 2);

      if (!isPeer && pt.incidence > 0.42 && i % 3 === 0) {
        const glintR = Math.max(2, (0.28 + pt.incidence * 0.22) * scale);
        ctx.globalAlpha = Math.min(0.32, strength * 1.15);
        ctx.drawImage(warmStamp, toScreenX(pt.x) - glintR, toScreenY(pt.y) - glintR, glintR * 2, glintR * 2);
      }
    }
    ctx.restore();
  }

  _drawLighting(ctx, cw, ch, diver, peersInput, checkpointsHit, siltClouds, sunCurtains, toScreenX, toScreenY, scale, timeSec, bodyRecovered = false, localSiltDensity = 0) {
    const lctx = this.lightCtx;
    const lw = this.lightCanvas.width;
    const lh = this.lightCanvas.height;
    const rx = lw / cw;
    const ry = lh / ch;

    // Ambient cave darkness increases with depth and horizontal cave penetration
    const depthFactor = Math.min(1, Math.max(0, (diver.y - 3.5) / 16));
    let daylight = 0;
    const basins = this.level.openBasins || [];
    for (let i = 0; i < basins.length; i++) {
      const cx = (basins[i].xMin + basins[i].xMax) * 0.5;
      const near = Math.max(0, 1 - Math.hypot(diver.x - cx, diver.y - 3) / 14);
      if (near > daylight) daylight = near;
    }
    const darknessAlpha = Math.max(0.16, Math.min(0.96, 0.28 + depthFactor * 0.7 - daylight * 0.55));

    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lw, lh);
    lctx.fillStyle = `rgba(2, 6, 14, ${darknessAlpha.toFixed(3)})`;
    lctx.fillRect(0, 0, lw, lh);

    // Cut out open-sky daylight, physical ray-cast cenote sun shafts, and torch cones
    lctx.globalCompositeOperation = 'destination-out';

    // 1. Open sky & cliff-top daylight at Entrance & Exit top (y <= 0 stays sunlit even when diving deeper)
    const surfMaskY = toScreenY(0.1) * ry;
    if (surfMaskY > -20) {
      const fadeBot = surfMaskY + 1.4 * scale * ry;
      if (fadeBot > 0) {
        const skyCut = lctx.createLinearGradient(0, Math.max(0, surfMaskY - 4), 0, fadeBot);
        skyCut.addColorStop(0, 'rgba(0,0,0,1)');
        skyCut.addColorStop(0.65, 'rgba(0,0,0,0.92)');
        skyCut.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = skyCut;
        lctx.fillRect(0, 0, lw, Math.min(lh, fadeBot));
      }
    }

    // 2. Ray-cast underwater sun shafts entering Cenote Alpha (entrance) & Cenote Beta (exit)
    if (sunCurtains && sunCurtains.length > 0) {
      for (const { rays } of sunCurtains) {
        lctx.save();
        lctx.beginPath();
        lctx.moveTo(toScreenX(rays[0].xTop) * rx, toScreenY(rays[0].yTop) * ry);
        for (let i = 1; i < rays.length; i++) {
          lctx.lineTo(toScreenX(rays[i].xTop) * rx, toScreenY(rays[i].yTop) * ry);
        }
        for (let i = rays.length - 1; i >= 0; i--) {
          lctx.lineTo(toScreenX(rays[i].xBot) * rx, toScreenY(rays[i].yBot) * ry);
        }
        lctx.closePath();
        const topPx = toScreenY(0) * ry;
        const botPx = toScreenY(18.5) * ry;
        const sunCut = lctx.createLinearGradient(0, topPx, 0, botPx);
        sunCut.addColorStop(0, 'rgba(0,0,0,0.98)');
        sunCut.addColorStop(0.35, 'rgba(0,0,0,0.85)');
        sunCut.addColorStop(0.75, 'rgba(0,0,0,0.42)');
        sunCut.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = sunCut;
        lctx.fill();
        lctx.restore();
      }
    }

    const localTorch = diver.torchOn !== false
      ? {
          ox: diver.body?.hand ? diver.body.hand.x : diver.x,
          oy: diver.body?.hand ? diver.body.hand.y : diver.y,
          rays: castTorchFan(
            this.level,
            diver.body?.hand ? diver.body.hand.x : diver.x,
            diver.body?.hand ? diver.body.hand.y : diver.y,
            diver.angle,
            0.44,
            16.5,
            52,
            siltClouds
          ),
        }
      : null;

    const peerList = Array.isArray(peersInput) ? peersInput : (peersInput ? [peersInput] : []);
    const peerTorches = peerList
      .filter((p) => p && p.alive !== false && p.torchOn !== false)
      .map((p) => ({
        peer: p,
        torch: {
          ox: p.body?.hand ? p.body.hand.x : p.x,
          oy: p.body?.hand ? p.body.hand.y : p.y,
          rays: castTorchFan(
            this.level,
            p.body?.hand ? p.body.hand.x : p.x,
            p.body?.hand ? p.body.hand.y : p.y,
            p.angle,
            0.4,
            14.0,
            32,
            siltClouds
          ),
        },
      }));

    const cutoutStamp = this.glowStamps.cutout;
    const carveDiverLight = (d, torchData, rangeM) => {
      const sx = toScreenX(d.x) * rx;
      const sy = toScreenY(d.y) * ry;

      // Soft personal dive-computer / gauge ambient halo via pre-baked radial cutout
      const haloR = 3.4 * scale * rx;
      if (cutoutStamp) {
        lctx.globalAlpha = 0.9;
        lctx.drawImage(cutoutStamp, sx - haloR, sy - haloR, haloR * 2, haloR * 2);
        lctx.globalAlpha = 1;
      } else {
        const halo = lctx.createRadialGradient(sx, sy, 0.25 * scale * rx, sx, sy, haloR);
        halo.addColorStop(0, 'rgba(0,0,0,0.9)');
        halo.addColorStop(0.5, 'rgba(0,0,0,0.45)');
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = halo;
        lctx.beginPath();
        lctx.arc(sx, sy, haloR, 0, Math.PI * 2);
        lctx.fill();
      }

      if (!torchData) return;

      const tx = toScreenX(torchData.ox) * rx;
      const ty = toScreenY(torchData.oy) * ry;
      const rPx = rangeM * scale * rx;

      // Clip to ray-cast shadow polygon so beam never bleeds through limestone walls
      lctx.save();
      lctx.beginPath();
      lctx.moveTo(tx, ty);
      for (let i = 0; i < torchData.rays.length; i++) {
        const pt = torchData.rays[i];
        lctx.lineTo(toScreenX(pt.x) * rx, toScreenY(pt.y) * ry);
      }
      lctx.closePath();
      lctx.clip();

      // Wide spill cone (Beer-Lambert water attenuation)
      const spill = lctx.createRadialGradient(tx, ty, 0.15 * scale * rx, tx, ty, rPx);
      spill.addColorStop(0, 'rgba(0,0,0,1)');
      spill.addColorStop(0.45, 'rgba(0,0,0,0.88)');
      spill.addColorStop(0.78, 'rgba(0,0,0,0.45)');
      spill.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = spill;
      lctx.fillRect(tx - rPx, ty - rPx, rPx * 2, rPx * 2);

      // Tight intense hotspot beam core
      const hot = lctx.createRadialGradient(tx, ty, 0.1 * scale * rx, tx, ty, rPx * 0.92);
      hot.addColorStop(0, 'rgba(0,0,0,1)');
      hot.addColorStop(0.7, 'rgba(0,0,0,0.95)');
      hot.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = hot;
      lctx.beginPath();
      lctx.moveTo(tx, ty);
      lctx.arc(tx, ty, rPx * 0.92, d.angle - 0.14, d.angle + 0.14);
      lctx.closePath();
      lctx.fill();

      lctx.restore();
    };

    carveDiverLight(diver, localTorch, 16.5);
    for (let i = 0; i < peerTorches.length; i++) {
      carveDiverLight(peerTorches[i].peer, peerTorches[i].torch, 14.0);
    }

    // Faint marker glows at visible checkpoints via pre-baked cutout stamp
    const cpRad = 2.4 * scale * rx;
    for (const cp of this.level.checkpoints) {
      const sx = toScreenX(cp.x) * rx;
      const sy = toScreenY(cp.y) * ry;
      if (sx + cpRad < 0 || sx - cpRad > lw || sy + cpRad < 0 || sy - cpRad > lh) continue;
      lctx.globalAlpha = checkpointsHit.has(cp.id) ? 0.58 : 0.42;
      lctx.drawImage(cutoutStamp, sx - cpRad, sy - cpRad, cpRad * 2, cpRad * 2);
    }
    lctx.globalAlpha = 1;

    // Luminous outer-reef Arch daylight apertures (e.g. Dahab Red Sea The Arch at 56m)
    if (Array.isArray(this.level.archWindows)) {
      for (const aw of this.level.archWindows) {
        const ax = toScreenX(aw.x) * rx;
        const ay = toScreenY(aw.y) * ry;
        const awRx = (aw.radiusX || 12) * scale * rx;
        const awRy = (aw.radiusY || 8) * scale * ry;
        if (ax + awRx < 0 || ax - awRx > lw || ay + awRy < 0 || ay - awRy > lh) continue;
        lctx.globalAlpha = 0.88;
        lctx.drawImage(cutoutStamp, ax - awRx, ay - awRy, awRx * 2, awRy * 2);
      }
      lctx.globalAlpha = 1;
    }

    // Emergency locator beacon cutout around fallen diver recovery target
    if (this.level.recoveryTarget && !bodyRecovered) {
      const rt = this.level.recoveryTarget;
      const sx = toScreenX(rt.x) * rx;
      const sy = toScreenY(rt.y) * ry;
      const rad = 3.2 * scale * rx;
      if (sx + rad >= 0 && sx - rad <= lw && sy + rad >= 0 && sy - rad <= lh) {
        lctx.globalAlpha = 0.55 + 0.35 * Math.pow(0.5 + 0.5 * Math.sin(timeSec * 5.2), 3);
        lctx.drawImage(cutoutStamp, sx - rad, sy - rad, rad * 2, rad * 2);
        lctx.globalAlpha = 1;
      }
    }

    ctx.drawImage(this.lightCanvas, 0, 0, cw, ch);

    if (Array.isArray(this.level.archWindows)) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const archStamp = this.glowStamps.cyan;
      for (const aw of this.level.archWindows) {
        const ax = toScreenX(aw.x);
        const ay = toScreenY(aw.y);
        const rxW = (aw.radiusX || 12) * scale;
        const ryH = (aw.radiusY || 8) * scale;
        if (ax + rxW < 0 || ax - rxW > cw || ay + ryH < 0 || ay - ryH > ch) continue;
        ctx.globalAlpha = 0.36;
        ctx.drawImage(archStamp, ax - rxW, ay - ryH, rxW * 2, ryH * 2);
      }
      ctx.restore();
    }

    // Volumetric scattering cone + limestone wall bounce highlights for local diver & peer buddies
    if (localTorch) {
      this._drawVolumetricTorchBeam(ctx, diver, localTorch, 15.5, {
        siltHaze: localSiltDensity,
        isPeer: false,
        toScreenX,
        toScreenY,
        scale,
        timeSec,
      });
    }
    for (let i = 0; i < peerTorches.length; i++) {
      const pt = peerTorches[i];
      this._drawVolumetricTorchBeam(ctx, pt.peer, pt.torch, 13.0, {
        siltHaze: sampleSiltDensity(pt.torch.ox, pt.torch.oy, siltClouds),
        isPeer: true,
        toScreenX,
        toScreenY,
        scale,
        timeSec,
      });
    }
  }

  _drawBubbles(ctx, toScreenX, toScreenY, scale, bubbles) {
    if (!bubbles.length) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.72)';
    ctx.fillStyle = 'rgba(186, 230, 253, 0.24)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const glints = [];
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      const sx = toScreenX(b.x);
      const sy = toScreenY(b.y);
      const r = Math.max(1.5, b.r * scale);
      ctx.moveTo(sx + r, sy);
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      if (r >= 3) {
        glints.push(sx - r * 0.34, sy - r * 0.34, Math.max(0.8, r * 0.24));
      }
    }
    ctx.fill();
    ctx.stroke();

    if (glints.length > 0) {
      ctx.fillStyle = 'rgba(248, 250, 252, 0.78)';
      ctx.beginPath();
      for (let i = 0; i < glints.length; i += 3) {
        const gx = glints[i];
        const gy = glints[i + 1];
        const gr = glints[i + 2];
        ctx.moveTo(gx + gr, gy);
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  _drawSiltClouds(ctx, cw, ch, toScreenX, toScreenY, scale, siltClouds, diver, peerList = [], timeSec = 0) {
    if (!siltClouds.length) return;
    ctx.save();
    const wispStamp = this.glowStamps.siltWisp || this.glowStamps.silt;
    const baseStamp = this.glowStamps.silt;
    const warmStamp = this.glowStamps.warm;

    const lights = [
      {
        x: diver.x,
        y: diver.y,
        fx: Math.cos(diver.angle),
        fy: Math.sin(diver.angle),
        torchOn: diver.torchOn !== false,
      },
    ];
    if (Array.isArray(peerList)) {
      for (let i = 0; i < peerList.length; i++) {
        const p = peerList[i];
        if (!p || p.alive === false) continue;
        lights.push({
          x: p.x,
          y: p.y,
          fx: Math.cos(p.angle || 0),
          fy: Math.sin(p.angle || 0),
          torchOn: p.torchOn !== false,
        });
      }
    }

    for (let i = 0; i < siltClouds.length; i++) {
      const s = siltClouds[i];
      const sx = toScreenX(s.x);
      const sy = toScreenY(s.y);
      const r = s.radius * scale;
      if (sx + r * 1.3 < 0 || sx - r * 1.3 > cw || sy + r * 1.3 < 0 || sy - r * 1.3 > ch) continue;

      let lit = 0.24;
      let glare = 0;
      for (let l = 0; l < lights.length; l++) {
        const src = lights[l];
        const dx = s.x - src.x;
        const dy = s.y - src.y;
        const dist = Math.hypot(dx, dy);
        const nearLit = 1 - dist / 14.5;
        if (nearLit > lit) lit = nearLit;
        if (src.torchOn && dist < 13.0) {
          const align = dist > 0.1 ? (dx * src.fx + dy * src.fy) / dist : 1;
          if (align > 0.46) {
            const beamGlare = (align - 0.46) * 1.95 * Math.max(0, 1 - dist / 13.0) * s.alpha;
            if (beamGlare > glare) glare = beamGlare;
          }
        }
      }
      const lifeRatio = s.maxLife > 0 ? s.life / s.maxLife : 1;
      const rot = (s.rot ?? s.seed ?? 0) + Math.sin(timeSec * 0.35 + (s.seed || 0)) * 0.25;

      // Soft ambient silt body + multi-lobed rotating wispy cloud layers in world space
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.min(0.68, s.alpha * (0.34 + lit * 0.38));
      ctx.drawImage(baseStamp, sx - r * 0.92, sy - r * 0.92, r * 1.84, r * 1.84);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(rot);
      ctx.globalAlpha = Math.min(0.88, s.alpha * (0.48 + lit * 0.44));
      ctx.drawImage(wispStamp, -r * 1.15, -r * 1.05, r * 2.3, r * 2.1);

      // Counter-rotating secondary billowing tendril as cloud expands & diffuses
      if (lifeRatio < 0.96) {
        ctx.rotate(-rot * 1.7 + 1.1);
        ctx.globalAlpha = Math.min(0.54, s.alpha * 0.42);
        ctx.drawImage(wispStamp, -r * 0.85, -r * 0.95, r * 1.9, r * 1.75);
      }
      ctx.restore();

      // World-space milky torch backscatter when ANY diver's beam sweeps across the silt cloud
      if (glare > 0.01) {
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.min(0.65, glare * 0.72);
        ctx.drawImage(warmStamp, sx - r * 0.9, sy - r * 0.9, r * 1.8, r * 1.8);

        // Suspended limestone sediment specks glinting inside the lit beam
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(236, 224, 198, 0.45)';
        for (let k = 0; k < 4; k++) {
          const a = (s.seed || 0) + k * 1.65 + timeSec * 0.25;
          const d = r * (0.25 + ((k * 37) % 10) * 0.055);
          const px = sx + Math.cos(a) * d;
          const py = sy + Math.sin(a * 1.2) * d * 0.75;
          ctx.fillRect(px, py, 2.2, 2.2);
        }
      }
    }

    ctx.restore();
  }

  _getVignetteCache(ctx, cw, ch) {
    if (this._vignetteCache && this._vignetteCache.cw === cw && this._vignetteCache.ch === ch) {
      return this._vignetteCache;
    }
    const build = (innerScale, outerScale, colorRgb) => {
      const g = ctx.createRadialGradient(cw * 0.5, ch * 0.5, cw * innerScale, cw * 0.5, ch * 0.5, cw * outerScale);
      g.addColorStop(0, `rgba(${colorRgb}, 0)`);
      g.addColorStop(1, `rgba(${colorRgb}, 1)`);
      return g;
    };
    this._vignetteCache = {
      cw,
      ch,
      hypoxia: build(0.24, 0.65, '10, 12, 16'),
      danger: build(0.25, 0.72, '220, 38, 38'),
      narcosis: build(0.28, 0.75, '79, 70, 229'),
    };
    return this._vignetteCache;
  }

  _drawPhysiologyOverlay(ctx, cw, ch, diveState, timeSec) {
    const cnsDanger = (diveState.cnsPercent || 0) / 100;
    const dcsDanger = (diveState.dcsStress || 0) / 100;
    const danger = Math.max(cnsDanger, dcsDanger, diveState.ppo2 > 1.6 ? 0.55 : 0);
    const hasHypoxia = diveState.hypoxiaStress > 8;
    const hasDanger = danger > 0.18;
    const hasNarcosis = diveState.narcosisLevel > 0.2;
    if (!hasHypoxia && !hasDanger && !hasNarcosis) return;

    const vig = this._getVignetteCache(ctx, cw, ch);
    ctx.save();
    if (hasHypoxia) {
      const t = Math.min(1, diveState.hypoxiaStress / 100);
      ctx.globalAlpha = 0.45 + t * 0.52;
      ctx.fillStyle = vig.hypoxia;
      ctx.fillRect(0, 0, cw, ch);
    }
    if (hasDanger) {
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * (5 + danger * 6));
      ctx.globalAlpha = Math.min(0.62, danger * (0.28 + pulse * 0.3));
      ctx.fillStyle = vig.danger;
      ctx.fillRect(0, 0, cw, ch);
    }
    if (hasNarcosis) {
      ctx.globalAlpha = diveState.narcosisLevel * 0.34;
      ctx.fillStyle = vig.narcosis;
      ctx.fillRect(0, 0, cw, ch);
    }
    ctx.restore();
  }
}
