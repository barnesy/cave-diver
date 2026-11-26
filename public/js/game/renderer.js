import { evaluateCaveSDF } from './collision.js';
import { drawSubmergedStories } from './renderers/submergedStoriesRenderer.js';
import { drawTopsideAtmosphereExtras, drawMenuBackdropDiorama } from './renderers/topsideAtmosphereRenderer.js';
import {
  CACHE_PX_PER_M,
  MOBILE_CACHE_PX_PER_M,
  BACK_PX_PER_M,
  CHUNK_W_M,
  CHUNK_H_M,
  TEX_SIZE,
  chunkBakerMethods,
} from './renderers/chunkBaker.js';
import { surfaceRendererMethods } from './renderers/surfaceRenderer.js';
import { wreckAndInteractivesMethods } from './renderers/wreckAndInteractivesRenderer.js';
import { lightingAndFxMethods } from './renderers/lightingAndFxRenderer.js';
import { bossAndLairMethods } from './renderers/bossAndLairRenderer.js';
import {
  underwaterJuiceRendererMethods,
  computeCavernFramingZoom,
} from './renderers/underwaterJuiceRenderer.js';
import { foregroundDepthRendererMethods } from './renderers/foregroundDepthRenderer.js';
import { createDiverBody } from './diverBody.js';
import { castSunCurtain } from './lighting.js';
import { getScubaSignalById } from './diveSignals.js';
import { getWeatherById } from './weather.js';
import { resolveDiverLiveryPalette } from './rigLivery.js';
import { applyPhotoViewportOverlay } from './photoStudio.js';
import { getAscentInstruction, getGasSwitchCoach } from '../physics/diveModel.js';
import { getAscentConfig } from '../levels/index.js';
import {
  createGlowStamps,
  drawStyledFish,
  drawStyledTurtle,
  drawStyledRemipede,
  drawStyledDiverRig,
  drawArticulatedDiverLeg,
  drawDiverArmAndTorch,
  drawStyledJellyfish,
  drawStyledMegafauna,
  drawStyledWhaleShark,
  drawStyledOarfish,
  drawStyledCoelacanth,
  drawStyledDenizen,
  classifyArtifactVisual,
  drawStyledArtifact,
} from './artSprites.js';

const MAX_CACHED_LEVELS = 5;
const BAKE_FRAME_BUDGET_MS = 12;

const _nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

const SURFACE_PROP_ASSETS = {
  boat: '/assets/surf-dive-boat.webp',
  palapa: '/assets/surf-palapa.webp',
  cabin: '/assets/surf-cabin.webp',
  bathhouse: '/assets/surf-bathhouse.webp',
  research: '/assets/surf-research-dome.webp',
  palm: '/assets/surf-tree-palm.webp',
  cypress: '/assets/surf-tree-cypress.webp',
  spruce: '/assets/surf-tree-spruce.webp',
  med: '/assets/surf-tree-med.webp',
  acacia: '/assets/surf-tree-acacia.webp',
};

const SURFACE_STYLE_PROPS = {
  'open-ocean-wreck': ['boat'],
  'florida-cypress': ['cabin', 'cypress', 'spruce'],
  'nordic-fjord': ['cabin', 'spruce'],
  'ural-birch': ['cabin', 'spruce'],
  'moravia-rift': ['cabin', 'spruce'],
  'provence-gorge': ['cabin', 'med'],
  'quercy-ressel': ['cabin', 'med'],
  'lazio-travertine': ['cabin', 'med'],
  'boybulok-steppe': ['cabin', 'med'],
  'kalahari-crater': ['cabin', 'acacia'],
  'bahamas-abaco': ['palapa', 'palm', 'spruce'],
  'budapest-bathhouse': ['bathhouse', 'med'],
  'sinai-coast': ['palapa', 'palm'],
  'atlantida-lava': ['palapa', 'palm'],
  'oxbelha-twilight': ['palapa', 'palm'],
  'lagoa-cerrado': ['palapa', 'palm'],
  'aurora-basalt': ['research', 'spruce'],
  'strytan-fjord': ['research', 'spruce'],
  'kverkfjoll-glacier': ['research'],
  'grjotagja-rift': ['research'],
  yucatan: ['palapa', 'palm'],
};

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

export function computeCameraDampingAlpha(dt, responsiveness = 6.0) {
  const safeDt = Math.max(0, Math.min(0.25, Number(dt) || 0.016));
  const rate = Math.max(0.5, Number(responsiveness) || 6.0);
  return 1 - Math.exp(-rate * safeDt);
}

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
    this._tintedRockPatternCache = new Map();
    this.skyBackdropImg = null;

    this._rawImageCache = new Map();
    this._surfaceSprites = new Map();
    this._bitmapAssetCache = new Map();
    this._bakedLevelCache = new Map();
    this._loadEpoch = 0;

    this.backChunks = [];
    this.rockChunks = [];
    this._sunCurtainCache = new Map();
    this._basinEdgeCache = new Map();
    this._waterMeniscusCache = new Map();
    this._ventCeilingCache = new Map();
    this._stalactiteCache = null;
    this._haloclineStamp = null;
    this._haloclineStampKey = '';
    this._biolumMotes = null;
    this._shallowBiolumMotes = null;
    this._activeWeather = null;
    this._skyGradCache = null;
    this._vignetteCache = null;
    this._siltGlareScratch = [];
    this._torchSparksScratch = [];
    this._peerTorchCache = new Map();
    this._activePeerKeysScratch = new Set();
    this._torchPeerIdsScratch = new Set();
    this._visibleTorchPeersScratch = [];
    this._siltLightsScratch = [
      { x: 0, y: 0, fx: 1, fy: 0, torchOn: true },
      { x: 0, y: 0, fx: 1, fy: 0, torchOn: true },
      { x: 0, y: 0, fx: 1, fy: 0, torchOn: true },
      { x: 0, y: 0, fx: 1, fy: 0, torchOn: true },
    ];
    this._perfBudget = null;
    this._airGradCache = null;
    this._skyCutGradCache = null;
    this._auroraStamps = this._buildAuroraStamps();
    this._needsResize = true;
    this._cachedDpr = 1;
    const isCoarseMobile =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory <= 4));
    this._isCoarseMobile = isCoarseMobile;
    this._rockPxPerM = isCoarseMobile ? MOBILE_CACHE_PX_PER_M : CACHE_PX_PER_M;
    this._maxCachedLevels = isCoarseMobile ? 2 : MAX_CACHED_LEVELS;
    this._maxCacheBytes = isCoarseMobile ? 120 * 1024 * 1024 : 320 * 1024 * 1024;
    this._reducedMotion =
      typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    this.ready = false;
    this.camX = level.spawn.x;
    this.camY = level.spawn.y;
    this.pxPerM = 28; // Dynamically adjusted by viewport size

    // Mark resize dirty via ResizeObserver / window events instead of forcing layout reflow every frame
    if (typeof ResizeObserver !== 'undefined' && canvas && typeof canvas.getBoundingClientRect === 'function') {
      try {
        this._resizeObserver = new ResizeObserver(() => {
          this._needsResize = true;
        });
        this._resizeObserver.observe(canvas);
      } catch (_) {}
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this._onWindowResize = () => {
        this._needsResize = true;
      };
      window.addEventListener('resize', this._onWindowResize, { passive: true });
      window.addEventListener('orientationchange', this._onWindowResize, { passive: true });
      window.visualViewport?.addEventListener?.('resize', this._onWindowResize, { passive: true });
    }

    if (!deferBuild) {
      this.backChunks = this._buildBackChunks(level);
      this.rockChunks = this._buildRockChunks(level);
      this.ready = true;
      this._loadBitmapTextures();
    }
  }

  _buildAuroraStamps() {
    if (typeof document === 'undefined') return null;
    const makeCol = (c0, c1) => {
      const c = document.createElement('canvas');
      c.width = 2;
      c.height = 128;
      const gctx = c.getContext('2d');
      if (!gctx?.createLinearGradient) return null;
      const g = gctx.createLinearGradient(0, 128, 0, 0);
      g.addColorStop(0, c0);
      g.addColorStop(0.52, c1);
      g.addColorStop(1, 'rgba(15, 23, 42, 0)');
      gctx.fillStyle = g;
      gctx.fillRect(0, 0, 2, 128);
      return c;
    };
    return [
      makeCol('rgba(45, 212, 191, 0.24)', 'rgba(74, 222, 128, 0.14)'),
      makeCol('rgba(56, 189, 248, 0.18)', 'rgba(167, 139, 250, 0.13)'),
    ];
  }

  _estimateEntryBytes(entry) {
    let bytes = 0;
    for (const ch of entry?.backChunks || []) {
      if (ch?.canvas) bytes += (ch.canvas.width || 0) * (ch.canvas.height || 0) * 4;
    }
    for (const ch of entry?.rockChunks || []) {
      if (ch?.canvas) bytes += (ch.canvas.width || 0) * (ch.canvas.height || 0) * 4;
    }
    return bytes;
  }

  isLevelCached(levelId) {
    return this._bakedLevelCache.has(levelId);
  }

  _saveBakedLevel(entry) {
    const id = entry?.level?.id;
    if (!id) return;
    entry.bytes = this._estimateEntryBytes(entry);
    if (this._bakedLevelCache.has(id)) {
      this._bakedLevelCache.delete(id);
    }
    this._bakedLevelCache.set(id, entry);
    const totalBytes = () => {
      let sum = 0;
      for (const e of this._bakedLevelCache.values()) sum += e.bytes || 0;
      return sum;
    };
    while (
      this._bakedLevelCache.size > 1 &&
      (this._bakedLevelCache.size > this._maxCachedLevels || totalBytes() > this._maxCacheBytes)
    ) {
      const oldestKey = this._bakedLevelCache.keys().next().value;
      if (oldestKey && oldestKey !== id) {
        const evicted = this._bakedLevelCache.get(oldestKey);
        this._bakedLevelCache.delete(oldestKey);
        // Zero canvas backing stores immediately so mobile WebKit releases GPU memory
        if (evicted) {
          for (const ch of evicted.backChunks || []) {
            if (ch?.canvas) { ch.canvas.width = 0; ch.canvas.height = 0; }
          }
          for (const ch of evicted.rockChunks || []) {
            if (ch?.canvas) { ch.canvas.width = 0; ch.canvas.height = 0; }
          }
        }
      } else {
        break;
      }
    }
  }

  _applyBakedLevel(entry) {
    this.level = entry.level;
    this.rockTex = entry.rockTex;
    this.backTex = entry.backTex;
    this.foliageTex = entry.foliageTex;
    this.foliagePattern = entry.foliagePattern;
    this._rockPattern = null;
    this._solidRockPattern = null;
    this._solidRockPatternKey = '';
    this._auroraGradCache = null;
    this._localTorchCache = null;
    this.skyBackdropImg = entry.skyBackdropImg;
    this.backChunks = entry.backChunks;
    this.rockChunks = entry.rockChunks;
    this._peerTorchCache?.clear();
    this._sunCurtainCache.clear();
    this._basinEdgeCache.clear();
    this._waterMeniscusCache.clear();
    this._ventCeilingCache.clear();
    this._stalactiteCache = null;
    this._haloclineStamp = null;
    this._haloclineStampKey = '';
    this._biolumMotes = null;
    this._shallowBiolumMotes = null;
    this._activeWeather = null;
    this._skyGradCache = null;
    this._hydroWakeRing = null;
    this._hydroWakeLastT = -1;
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

  _getSurfaceProp(key) {
    const existing = this._surfaceSprites.get(key);
    if (existing) {
      return existing !== 'loading' && (existing.naturalWidth || existing.width) > 0 ? existing : null;
    }
    const src = SURFACE_PROP_ASSETS[key];
    if (!src) return null;
    this._surfaceSprites.set(key, 'loading');
    this._loadRawImageAsset(src).then((img) => {
      if (img && (img.naturalWidth || img.width) > 0) {
        this._surfaceSprites.set(key, img);
      } else {
        this._surfaceSprites.delete(key);
      }
    });
    return null;
  }

  _preloadLevelSurfaceProps(level = this.level) {
    const style = level?.theme?.surfaceStyle || (level?.isWreck ? 'open-ocean-wreck' : 'yucatan');
    const keys = SURFACE_STYLE_PROPS[style] || SURFACE_STYLE_PROPS.yucatan;
    return Promise.all(
      keys.map((key) => {
        const cur = this._surfaceSprites.get(key);
        if (cur && cur !== 'loading') return Promise.resolve(cur);
        const src = SURFACE_PROP_ASSETS[key];
        if (!src) return Promise.resolve(null);
        this._surfaceSprites.set(key, 'loading');
        return this._loadRawImageAsset(src).then((img) => {
          if (img && (img.naturalWidth || img.width) > 0) {
            this._surfaceSprites.set(key, img);
            return img;
          }
          this._surfaceSprites.delete(key);
          return null;
        });
      })
    );
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
    this._preloadLevelSurfaceProps(level);
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
      this._preloadLevelSurfaceProps(targetLevel),
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
    let frameStartMs = _nowMs();
    for (let i = 0; i < spans.length; i++) {
      if (i === 0 || _nowMs() - frameStartMs >= BAKE_FRAME_BUDGET_MS) {
        await nextFrame();
        frameStartMs = _nowMs();
      }
      if (epoch !== this._loadEpoch) return { cancelled: true };
      report(24 + Math.round(((i + 1) / spans.length) * 26), `Carving cavern backdrop (${i + 1}/${spans.length})...`);
      nextBackChunks.push(this._buildBackChunk(targetLevel, spans[i][0], spans[i][1], backTex));
    }

    // Proactively evict older baked levels BEFORE allocating new tiles on coarse mobile to cap peak VRAM (v171)
    if (this._isCoarseMobile && this._bakedLevelCache.size > 0) {
      for (const [oldId, oldEntry] of this._bakedLevelCache.entries()) {
        if (oldId === targetLevel.id) continue;
        this._bakedLevelCache.delete(oldId);
        for (const ch of oldEntry.backChunks || []) {
          if (ch?.canvas) { ch.canvas.width = 0; ch.canvas.height = 0; }
        }
        for (const ch of oldEntry.rockChunks || []) {
          if (ch?.canvas) { ch.canvas.width = 0; ch.canvas.height = 0; }
        }
      }
    }

    const nextRockChunks = [];
    const { yMin: lvlYMin, yMax: lvlYMax } = targetLevel.bounds;
    for (let i = 0; i < spans.length; i++) {
      if (i === 0 || _nowMs() - frameStartMs >= BAKE_FRAME_BUDGET_MS) {
        await nextFrame();
        frameStartMs = _nowMs();
      }
      if (epoch !== this._loadEpoch) return { cancelled: true };
      report(50 + Math.round(((i + 1) / spans.length) * 42), `Sculpting high-res limestone walls (${i + 1}/${spans.length})...`);
      for (let cy0 = lvlYMin; cy0 < lvlYMax; cy0 += CHUNK_H_M) {
        if (_nowMs() - frameStartMs >= BAKE_FRAME_BUDGET_MS) {
          await nextFrame();
          frameStartMs = _nowMs();
          if (epoch !== this._loadEpoch) return { cancelled: true };
        }
        const cy1 = Math.min(lvlYMax, cy0 + CHUNK_H_M);
        nextRockChunks.push(this._buildRockChunk(targetLevel, spans[i][0], spans[i][1], rockTex, foliageTex, cy0, cy1));
      }
    }

    if (epoch !== this._loadEpoch) return { cancelled: true };

    const entry = {
      level: targetLevel,
      rockTex,
      backTex,
      foliageTex,
      foliagePattern,
      skyBackdropImg,
      backChunks: nextBackChunks,
      rockChunks: nextRockChunks,
    };
    this._saveBakedLevel(entry);
    this._applyBakedLevel(entry);
    return { cancelled: false, fromCache: false };
  }

  /**
   * Apply adaptive 60 FPS mobile quality budget from perfMonitor (v144).
   * Smoothly scales DPR cap, lightmap resolution, ray count, silt tendrils & bioluminescence stride.
   */
  setPerfBudget(budget) {
    if (!budget) return;
    const prev = this._perfBudget;
    this._perfBudget = budget;
    if (!prev || prev.dprCap !== budget.dprCap || prev.lightmapScale !== budget.lightmapScale) {
      this._needsResize = true;
    }
  }

  resize(force = false) {
    if (!force && !this._needsResize && this.canvas.width > 0 && this.canvas.height > 0) {
      return;
    }
    this._needsResize = false;
    const dprCap = this._perfBudget?.dprCap ?? (this._isCoarseMobile ? 1.75 : 2);
    const lightScale = this._perfBudget?.lightmapScale ?? 0.35;
    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, dprCap);
    const w = this.canvas.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280) || 1280;
    const h = this.canvas.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 720) || 720;
    const targetW = Math.max(1, Math.floor(w * dpr));
    const targetH = Math.max(1, Math.floor(h * dpr));
    const targetLW = Math.max(1, Math.floor(targetW * lightScale));
    const targetLH = Math.max(1, Math.floor(targetH * lightScale));
    if (
      this.canvas.width !== targetW ||
      this.canvas.height !== targetH ||
      this.lightCanvas.width !== targetLW ||
      this.lightCanvas.height !== targetLH
    ) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
      this.lightCanvas.width = targetLW;
      this.lightCanvas.height = targetLH;
      this._skyGradCache = null;
      this._vignetteCache = null;
      this._skyCutGradCache = null;
    }
    this._cachedDpr = this.canvas.width / w;
    // Scale pixels-per-meter so ~20–26m vertical span is visible on mobile & desktop
    const minDim = Math.min(w, h);
    this.pxPerM = Math.max(18, Math.min(34, minDim / 18));
  }

  /**
   * Living underwater cavern/wreck backdrop for Home & Menu screens (v240):
   * renders the full-detail live in-game level when baked, falling back to diorama while baking.
   */
  renderMenuBackdrop(level, timeSec = 0, weather = null) {
    this._activeWeather = weather ? (typeof weather === 'string' ? getWeatherById(weather) : weather) : null;
    this.resize();
    drawMenuBackdropDiorama(this, level, timeSec);
    if (this._activeWeather && this._activeWeather.id !== 'clear-day') {
      this._drawWeatherSkyAtmosphere(this.ctx, this.canvas.width, this.canvas.height * 0.44, timeSec);
      this._drawWeatherPrecipitation(this.ctx, this.canvas.width, this.canvas.height, this.canvas.height * 0.44, timeSec);
    }
  }

  renderMenuScene({ level, diver, diveState, ecosystem, weather, timeSec, dt, livery }) {
    // Throttle live Home backdrop to ~24fps so GPU stays cool and dive transitions are instant (v241)
    if (this._lastMenuSceneT && timeSec - this._lastMenuSceneT > 0 && timeSec - this._lastMenuSceneT < 0.04) {
      return;
    }
    this._lastMenuSceneT = timeSec;
    if (this.ready && this.level && this.level.id === level?.id && diver) {
      const lvl = this.level;
      const swayX = Math.sin(timeSec * 0.28) * 3.4;
      const swayVx = Math.cos(timeSec * 0.28) * 0.95;
      const swayY = Math.cos(timeSec * 0.36) * 0.9;
      diver.x = lvl.spawn.x + 2.4 + swayX;
      diver.y = Math.max(2.4, Math.min((lvl.spawn.y || 2.5) + 3.2 + swayY, 9.5));
      diver.vx = swayVx;
      diver.vy = -Math.sin(timeSec * 0.36) * 0.32;
      diver.angle = swayVx >= 0 ? 0.12 : Math.PI - 0.12;
      diver.livery = livery;
      if (!this._menuEmptySet) this._menuEmptySet = new Set();
      if (!this._menuEmptyArr) this._menuEmptyArr = [];
      this.render({ diver, diveState, peerDiver: null, checkpointsHit: this._menuEmptySet, nextCheckpoint: lvl.checkpoints?.[0] || null, siltClouds: this._menuEmptyArr, bubbles: this._menuEmptyArr, ecosystem, weather, timeSec, dt });
      return;
    }
    this.renderMenuBackdrop(level, timeSec, weather);
  }

  /**
   * Project CSS viewport client coordinates (e.g. desktop mouse cursor) into exact world meters,
   * eliminating camera-peek & arena-zoom parallax error during twin-stick speargun aiming (v182).
   */
  screenToWorld(clientX, clientY) {
    const vt = this._lastViewTransform;
    if (!vt || !this.canvas || !vt.scale) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const cx = (clientX - rect.left) * (this.canvas.width / rect.width);
    const cy = (clientY - rect.top) * (this.canvas.height / rect.height);
    return {
      x: vt.camX + (cx - vt.viewCenterX) / vt.scale,
      y: vt.camY + (cy - vt.viewCenterY) / vt.scale,
    };
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
    wreckState = null,
    ghostPose = null,
    sonarPulse = null,
    cameraFlash = null,
    encounters = null,
    hazards = null,
    blackBox = null,
    lineCookies = null,
    surveyPins = null,
    powerRelays = null,
    smb = null,
    salvage = null,
    mechFx = null,
    stories = null,
    secretLair = null,
    reelingActive = false,
    bioWake = null,
    surfaceRipples = null,
    buddyPing = null,
    airShareBeams = null,
    droppedStages = null,
    drills = null,
    weather = null,
    photoMode = null,
    endedState = '',
    difficulty = 'standard',
    mutatorId = '',
    expeditionModifiers = null,
    compactHud = false,
    spaceClearanceM = 4.0,
    breathState = 'hold',
    squeezeDust = null,
    handOnLinePt = null,
    cameraShake = 0,
    cameraKickX = 0,
    cameraKickY = 0,
    biolumWake = null,
    dashSlipstreams = null,
    worldBeacons = null,
    syncedSonarPings = null,
    decoMastery = null,
    timeSec,
    dt,
  }) {
    this._activeWeather = weather ? (typeof weather === 'string' ? getWeatherById(weather) : weather) : null;
    const isPhotoMode = Boolean(photoMode?.active);
    const peerList = Array.isArray(peers) ? peers : (peerDiver ? [peerDiver] : []);
    this.resize();
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const dpr = this._cachedDpr || 1;
    const photoZoom = isPhotoMode ? Math.max(0.65, Math.min(2.2, Number(photoMode.zoom) || 1.0)) : 1.0;
    // Dynamic Restriction Camera Framing (v161): subtle zoom-in when threading tight cave squeezes
    const targetRestrictZoom =
      !isPhotoMode && !this._reducedMotion && Number.isFinite(spaceClearanceM) && spaceClearanceM < 2.2 && (diver?.y || 0) > 3.5
        ? 1.0 + Math.min(0.13, ((2.2 - spaceClearanceM) / 1.5) * 0.13)
        : 1.0;
    this._restrictionZoom = Number.isFinite(this._restrictionZoom)
      ? this._restrictionZoom + (targetRestrictZoom - this._restrictionZoom) * Math.min(1, (dt || 0.016) * 2.6)
      : 1.0;
    // Dynamic Arena Camera Zoom-Out (v180): smoothly frames the massive Sunken Sanctum cathedral & Kraken!
    const inBossArena = Boolean(
      secretLair?.veilBreached &&
      secretLair.spec?.arena &&
      Math.hypot((diver?.x || 0) - secretLair.spec.arena.cx, (diver?.y || 0) - secretLair.spec.arena.cy) <=
        (secretLair.spec.arena.rx || 26) + 5
    );
    const targetArenaZoom = !isPhotoMode && inBossArena ? (cw < ch ? 0.64 : 0.72) : 1.0;
    this._arenaZoom = Number.isFinite(this._arenaZoom)
      ? this._arenaZoom + (targetArenaZoom - this._arenaZoom) * Math.min(1, (dt || 0.016) * 2.2)
      : targetArenaZoom;
    // Dynamic Cavern Vista Zoom (v195): gently breathes out up to 9% in wide cathedrals
    const targetCavernZoom = computeCavernFramingZoom(spaceClearanceM, diver?.y, inBossArena, isPhotoMode, this._reducedMotion);
    this._cavernZoom = Number.isFinite(this._cavernZoom)
      ? this._cavernZoom + (targetCavernZoom - this._cavernZoom) * Math.min(1, (dt || 0.016) * 1.8)
      : 1.0;

    const scale = this.pxPerM * dpr * photoZoom * this._restrictionZoom * this._arenaZoom * this._cavernZoom;

    // Smooth camera follow + Torch-Coupled Peek Look-Ahead (or direct pan/zoom in Photo Mode Studio)
    const camAnchor = cameraTarget || diver;
    if (isPhotoMode) {
      this.camX = camAnchor.x + (Number(photoMode.panX) || 0);
      this.camY = camAnchor.y + (Number(photoMode.panY) || 0);
    } else {
      const isManualPeek = Boolean(camAnchor.torchManualAim && Number.isFinite(camAnchor.torchAngle));
      const inCombatMode = Boolean(secretLair?.combatMode);
      const peekScale = inCombatMode ? 1.45 : 3.4;
      const peekScaleY = inCombatMode ? 1.1 : 2.5;
      const peekX = isManualPeek ? Math.cos(camAnchor.torchAngle) * peekScale : 0;
      const peekY = isManualPeek ? Math.sin(camAnchor.torchAngle) * peekScaleY : 0;
      const velLeadX = Math.max(-1.6, Math.min(1.6, (camAnchor.vx || 0) * (inCombatMode ? 0.16 : 0.28)));
      const velLeadY = Math.max(-1.1, Math.min(1.1, (camAnchor.vy || 0) * (inCombatMode ? 0.12 : 0.2)));
      let lookX = camAnchor.x + Math.cos(camAnchor.angle || 0) * (isManualPeek ? 0.85 : 2.0) + peekX + velLeadX;
      // Subtle plunge-entry camera settle during the first 1.5s of submerging (v161)
      const plungeDrop = !this._reducedMotion && timeSec >= 0 && timeSec < 1.5 && (camAnchor.y || 0) < 4.5
        ? Math.sin((1 - timeSec / 1.5) * Math.PI) * 0.42
        : 0;
      let lookY = camAnchor.y + Math.sin(camAnchor.angle || 0) * (isManualPeek ? 0.6 : 1.3) + peekY + velLeadY + plungeDrop;
      // Dramatic Awakening pan: smoothly frame both diver and *XIBALBA'S MAW* as sconces ignite! (v182)
      if (secretLair?.boss?.aiState === 'awakening' && !this._reducedMotion) {
        lookX = lookX * 0.66 + secretLair.boss.x * 0.34;
        lookY = lookY * 0.66 + secretLair.boss.y * 0.34;
      }
      const camAlpha = computeCameraDampingAlpha(dt, inCombatMode ? 5.6 : isManualPeek ? 3.5 : 6.4);
      this.camX += (lookX - this.camX) * camAlpha;
      this.camY += (lookY - this.camY) * camAlpha;
    }

    // Narcosis gentle camera drift + damped Combat Camera Shake (suppressed under prefers-reduced-motion)
    let narcX = 0;
    let narcY = 0;
    const isSpectating = Boolean(cameraTarget && cameraTarget !== diver);
    if (!isPhotoMode && !isSpectating && !this._reducedMotion && diveState.narcosisLevel > 0.15) {
      narcX = Math.sin(timeSec * 1.7) * diveState.narcosisLevel * 0.45;
      narcY = Math.cos(timeSec * 1.3) * diveState.narcosisLevel * 0.35;
    }
    if (!isPhotoMode && !this._reducedMotion && cameraShake > 0.01) {
      const sh = Math.min(1.0, cameraShake) * 0.62;
      narcX += (Math.sin(timeSec * 57.3) * 0.65 + Math.cos(timeSec * 93.1) * 0.35) * sh;
      narcY += (Math.cos(timeSec * 61.7) * 0.65 + Math.sin(timeSec * 89.4) * 0.35) * sh;
    }
    if (!isPhotoMode && !this._reducedMotion && (Math.abs(cameraKickX) > 0.004 || Math.abs(cameraKickY) > 0.004)) {
      narcX += cameraKickX;
      narcY += cameraKickY;
    }

    const viewCenterX = cw * 0.5;
    // On narrow portrait phones, shift framing slightly higher so the diver sits centered above the bottom dock
    const viewCenterY = isPhotoMode ? ch * 0.5 : (cw < ch ? ch * 0.39 : ch * 0.46);

    const effCamX = this.camX + narcX;
    const effCamY = this.camY + narcY;
    this._lastViewTransform = { viewCenterX, viewCenterY, camX: effCamX, camY: effCamY, scale, dpr };

    const toScreenX = (wx) => viewCenterX + (wx - effCamX) * scale;
    const toScreenY = (wy) => viewCenterY + (wy - effCamY) * scale;

    const { xMin, xMax, yMin, yMax } = this.level.bounds;
    const viewWorldLeft = (this.camX + narcX) - viewCenterX / scale;
    const viewWorldTop = (this.camY + narcY) - viewCenterY / scale;
    const viewWorldRight = viewWorldLeft + cw / scale;
    const viewWorldBottom = viewWorldTop + ch / scale;

    const visX0 = Math.max(xMin, viewWorldLeft);
    const visY0 = Math.max(yMin, viewWorldTop);
    const visX1 = Math.min(xMax, viewWorldRight);
    const visY1 = Math.min(yMax, viewWorldBottom);

    // 1. Sky & Rich Level-Themed Water Gradient (cached per quantized surfY/viewport step)
    const surfY = toScreenY(0);
    const theme = this.level.theme;
    const skyKey = `${this.level.id}|${Math.round(surfY / 8)}|${ch}|${Math.round(scale * 10)}`;
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

    // Above-water sky strip (sky, sun halo & clouds behind cliffs + dynamic weather sky atmosphere)
    if (surfY > 0) {
      this._drawSurfaceSky(ctx, cw, surfY, toScreenX, toScreenY, scale, timeSec);
      if (this._activeWeather && this._activeWeather.id !== 'clear-day') {
        this._drawWeatherSkyAtmosphere(ctx, cw, surfY, timeSec);
      }
    }

    // 1b. 1:1 World-Locked Carved Cave Backwall + subtle atmospheric depth-fog veil separating backwall from foreground rock
    this._drawChunks(ctx, this.backChunks, BACK_PX_PER_M, yMin, visX0, visY0, visX1, visY1, toScreenX, toScreenY, scale);
    if (surfY < ch) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = theme?.waterDeep || '#072a47';
      ctx.fillRect(0, Math.max(0, surfY), cw, ch - Math.max(0, surfY));
      ctx.restore();
    }

    // 2. Physical 2D Ray-Cast Cenote Daylight Sunbeams & Shimmering Caustics (modulated by weather/time-of-day)
    const sunCurtains = this._computeVisibleSunCurtains(visX0, visX1, visY0, siltClouds);
    const weatherSun = this._activeWeather ? this._activeWeather.sunIntensity : 1.0;
    const weatherCaustics = this._activeWeather ? this._activeWeather.causticIntensity : 1.0;
    if (weatherSun > 0.08) {
      if (weatherSun < 0.99) {
        ctx.save();
        ctx.globalAlpha = weatherSun;
        this._drawSunbeams(ctx, sunCurtains, toScreenX, toScreenY, scale, timeSec);
        ctx.restore();
      } else {
        this._drawSunbeams(ctx, sunCurtains, toScreenX, toScreenY, scale, timeSec);
      }
    }
    if (weatherCaustics > 0.08) {
      if (weatherCaustics < 0.99) {
        ctx.save();
        ctx.globalAlpha = weatherCaustics;
        this._drawCaustics(ctx, sunCurtains, toScreenX, toScreenY, scale, timeSec);
        ctx.restore();
      } else {
        this._drawCaustics(ctx, sunCurtains, toScreenX, toScreenY, scale, timeSec);
      }
    }

    // 3. Water Surface Wave Line (clipped to open basin mouths so waves never cut through solid cliff rock)
    if (surfY > -2.2 * scale && surfY < ch + 2.2 * scale) {
      this._drawWaterSurfaceWaves(ctx, cw, toScreenX, toScreenY, scale, timeSec, surfY, narcX);
    }

    // 4. Multi-Layer Refractive Halocline / Thermocline Interface Shimmer + Optical Shear Waves (v159 dynamic hydrology)
    const effectiveHaloY = Number.isFinite(this.level.haloclineY)
      ? this.level.haloclineY
      : hazards?.halocline?.enabled
        ? hazards.halocline.depthM
        : NaN;
    if (Number.isFinite(effectiveHaloY)) {
      const haloY = toScreenY(effectiveHaloY);
      if (haloY > -90 && haloY < ch + 90) {
        ctx.save();
        const bandH = 2.6 * scale;
        const haloKey = theme?.haloclineColor || 'default';
        if (this._haloclineStampKey !== haloKey && typeof document !== 'undefined') {
          this._haloclineStampKey = haloKey;
          const c = document.createElement('canvas');
          c.width = 1;
          c.height = 64;
          const gctx = c.getContext('2d');
          const hg = gctx.createLinearGradient(0, 0, 0, 64);
          hg.addColorStop(0, 'rgba(165, 243, 252, 0)');
          hg.addColorStop(0.42, theme?.haloclineColor || 'rgba(165, 243, 252, 0.26)');
          hg.addColorStop(0.58, theme?.haloclineColor || 'rgba(94, 234, 212, 0.18)');
          hg.addColorStop(1, 'rgba(14, 116, 144, 0)');
          gctx.fillStyle = hg;
          gctx.fillRect(0, 0, 1, 64);
          this._haloclineStamp = c;
        }
        if (this._haloclineStamp) {
          ctx.drawImage(this._haloclineStamp, 0, haloY - bandH, cw, bandH * 2);
        } else if (this.glowStamps.bandGlow) {
          ctx.globalAlpha = 0.62;
          ctx.drawImage(this.glowStamps.bandGlow, 0, haloY - bandH * 0.72, cw, bandH * 1.44);
          ctx.globalAlpha = 1;
        }

        // Three phase-offset refractive density ribbons simulating freshwater-over-saltwater optical shear
        const stepPx = Math.max(14, Math.round(cw / 34));
        const rCols = this._haloclineRibbonCols || (this._haloclineRibbonCols = [
          'rgba(224, 242, 254, 0.44)',
          'rgba(94, 234, 212, 0.34)',
          'rgba(186, 230, 253, 0.26)',
        ]);
        const rOffs = [-0.34, 0.04, 0.42];
        const rAmps = [0.12, 0.16, 0.1];
        const rFreqs = [0.55, 0.78, 1.05];
        const rSpeeds = [1.8, -1.35, 2.15];
        const rWidths = [0.055, 0.075, 0.042];
        for (let r = 0; r < 3; r++) {
          ctx.strokeStyle = r === 1 && theme?.haloclineColor ? theme.haloclineColor : rCols[r];
          ctx.lineWidth = Math.max(1, rWidths[r] * scale);
          ctx.beginPath();
          for (let sx = 0; sx <= cw + stepPx; sx += stepPx) {
            const wx = this.camX + narcX + (sx - viewCenterX) / scale;
            const waveY =
              haloY +
              (rOffs[r] +
                Math.sin(wx * rFreqs[r] + timeSec * rSpeeds[r]) * rAmps[r] +
                Math.cos(wx * (rFreqs[r] * 1.8) - timeSec * 1.2 + r) * (rAmps[r] * 0.45)) *
                scale;
            if (sx === 0) ctx.moveTo(sx, waveY);
            else ctx.lineTo(sx, waveY);
          }
          ctx.stroke();
        }

        // Floating iridescent halocline density-interface motes
        ctx.fillStyle = 'rgba(224, 242, 254, 0.46)';
        const moteStart = Math.floor(visX0 / 2.6) * 2.6;
        for (let mx = moteStart; mx <= visX1; mx += 2.6) {
          const phase = mx * 1.73 + timeSec * 1.4;
          const sx = toScreenX(mx + Math.sin(phase) * 0.35);
          const sy = haloY + (Math.cos(phase * 1.3) * 0.65) * scale;
          const mr = Math.max(1.2, (0.04 + 0.03 * Math.sin(phase * 2)) * scale);
          ctx.beginPath();
          ctx.ellipse(sx, sy, mr * 2.2, mr * 0.65, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 4b. Shipwreck Open-Water Shot Line, Multi-Stage Deco Rig, Ship Silhouette, Drift Currents & Props
    if (this.level.isWreck) {
      this._drawWreckBackdropDetails(ctx, viewWorldLeft, viewWorldRight, viewWorldTop, viewWorldBottom, toScreenX, toScreenY, scale, timeSec, wreckState);
    }

    // 5. Guideline (Fixed gold cave line + player-deployed reel lines & directional pins)
    this._drawGuideline(ctx, toScreenX, toScreenY, scale, playerLines);

    // 6. Checkpoints, Collectables & Recovery Target
    this._drawCheckpoints(ctx, toScreenX, toScreenY, scale, checkpointsHit, nextCheckpoint, timeSec);
    this._drawCollectibles(ctx, viewWorldLeft, viewWorldRight, toScreenX, toScreenY, scale, collectedIds, timeSec, diver);
    if (this.level.recoveryTarget) {
      this._drawRecoveryTarget(ctx, diver, peerList, bodyRecovered, carryingBody, toScreenX, toScreenY, scale, timeSec);
    }

    // 7. Bubbles
    this._drawBubbles(ctx, cw, ch, toScreenX, toScreenY, scale, bubbles);

    // 8. High-Res Bitmap Cutaway Cave Limestone Walls (2D vertical+horizontal tiles, mobile VRAM-capped)
    this._drawChunks(ctx, this.rockChunks, this._rockPxPerM || CACHE_PX_PER_M, yMin, visX0, visY0, visX1, visY1, toScreenX, toScreenY, scale);
    this._drawInfiniteRockMargin(ctx, viewWorldLeft, viewWorldRight, xMin, xMax, yMin, yMax, toScreenX, toScreenY, scale);

    // 8a. Top-Level Surface Environment: Full-width jungle/cypress ridge, cenote rims, stairways & docks
    if (visY0 < 4.5) {
      this._drawSurfaceTopEnvironment(ctx, viewWorldLeft, viewWorldRight, toScreenX, toScreenY, scale, timeSec);
    }
    if (visY0 < 18) {
      this._drawTopsideAtmosphereExtras(ctx, viewWorldLeft, viewWorldRight, toScreenX, toScreenY, scale, timeSec);
    }
    if (visY0 < 3.8 && surfY >= -24 && surfY <= ch + 24) {
      this._drawSurfaceRipples(ctx, surfaceRipples, viewWorldLeft, viewWorldRight, toScreenX, toScreenY, scale, timeSec);
    }
    if (visY0 < 24 && sunCurtains && sunCurtains.length > 0 && weatherCaustics > 0.08) {
      if (weatherCaustics < 0.99) {
        ctx.save();
        ctx.globalAlpha = weatherCaustics;
        this._drawCausticWebs(ctx, sunCurtains, toScreenX, toScreenY, scale, timeSec);
        ctx.restore();
      } else {
        this._drawCausticWebs(ctx, sunCurtains, toScreenX, toScreenY, scale, timeSec);
      }
    }
    if (this._activeWeather && (this._activeWeather.precip !== 'none' || this._activeWeather.lightning) && surfY > -40) {
      this._drawWeatherPrecipitation(ctx, cw, ch, surfY, timeSec);
    }

    // 8a-ii. Shipwreck Foreground Hazards OR Cave Interactive Features (Stages, Line Markers, Flows, Siphons & Line Traps)
    if (this.level.isWreck) {
      this._drawWreckForegroundHazards(ctx, viewWorldLeft, viewWorldRight, viewWorldTop, viewWorldBottom, toScreenX, toScreenY, scale, timeSec, diver, wreckState, mechFx);
    } else {
      this._drawCaveInteractives(ctx, viewWorldLeft, viewWorldRight, viewWorldTop, viewWorldBottom, toScreenX, toScreenY, scale, timeSec, diver, wreckState, mechFx);
    }
    if (Array.isArray(droppedStages) && droppedStages.length > 0) {
      this._drawDroppedStages(ctx, droppedStages, viewWorldLeft, viewWorldRight, viewWorldTop, viewWorldBottom, toScreenX, toScreenY, scale, timeSec);
    }

    // 8b. Authentic Cenote & Cave Flora, Calcite Formations, Fishes, Slider Turtles & Remipedes
    if (ecosystem) {
      this._drawAnchoredLife(ctx, ecosystem, visX0 - 3, visX1 + 3, visY0 - 3, visY1 + 3, toScreenX, toScreenY, scale, timeSec, diver);
      this._drawSwimmers(ctx, ecosystem, visX0 - 4, visX1 + 4, visY0 - 4, visY1 + 4, toScreenX, toScreenY, scale, timeSec);
    }
    if (encounters && typeof this._drawDynamicEncounters === 'function') {
      this._drawDynamicEncounters(ctx, encounters, visX0 - 10, visX1 + 10, visY0 - 6, visY1 + 6, toScreenX, toScreenY, scale, timeSec, 'world');
    }
    if (hazards && typeof this._drawDynamicHazards === 'function') {
      this._drawDynamicHazards(ctx, hazards, visX0 - 8, visX1 + 8, visY0 - 6, visY1 + 6, toScreenX, toScreenY, scale, timeSec, diver);
    }
    if (secretLair && typeof this._drawSecretLairWorld === 'function') {
      this._drawSecretLairWorld(ctx, visX0 - 6, visX1 + 6, visY0 - 6, visY1 + 6, toScreenX, toScreenY, scale, timeSec, secretLair);
    }
    if (stories && typeof this._drawSubmergedStories === 'function') {
      this._drawSubmergedStories(ctx, stories, visX0 - 8, visX1 + 8, visY0 - 8, visY1 + 8, toScreenX, toScreenY, scale, timeSec, 'world');
    }

    // 9. Divers & Active Co-op Rescue Tow Lifelines + Air-Share Octo Hose Beams + Hydrodynamic Fin/DPV Wake (v202)
    this._drawDiverHydroWake?.(ctx, diver, toScreenX, toScreenY, scale, timeSec);
    this._drawBuddyRescueTethers(ctx, diver, peerList, toScreenX, toScreenY, scale, timeSec, airShareBeams);
    const lairArmed = Boolean(secretLair?.combatMode && secretLair?.weaponEquipped && !secretLair?.bossDefeated);
    for (let i = 0; i < peerList.length; i++) {
      this._drawDiver(ctx, peerList[i], toScreenX, toScreenY, scale, timeSec, true, lairArmed ? { hasSpeargun: true } : null);
    }
    this._drawDiver(ctx, diver, toScreenX, toScreenY, scale, timeSec, false, {
      wreckState,
      mechFx,
      reelingActive,
      drills,
      hasSpeargun: lairArmed,
      spearRecoil: secretLair?.recoilSec ? secretLair.recoilSec / 0.12 : 0,
      muzzleFlash: secretLair?.muzzleFlashSec || 0,
    });
    if (salvage?.liftBagActive || (salvage?.inflateAnim || 0) > 0.02) {
      this._drawDiverLiftBag(ctx, diver, salvage, toScreenX, toScreenY, scale, timeSec, mechFx);
    }

    // 10. Volumetric Ray-Cast Darkness + Entrance/Exit Sunlight + 2D Torch Scattering + Dynamic Boss Arena Lighting
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
      localSiltDensity,
      powerRelays,
      smb,
      ecosystem,
      secretLair
    );
    // Mastery Expedition Modifier: Blackout Abyss deepens ambient peripheral darkness (v201)
    if (Array.isArray(expeditionModifiers) && expeditionModifiers.includes('blackout-abyss')) {
      const dx = toScreenX(diver.x);
      const dy = toScreenY(diver.y);
      ctx.save();
      const blk = ctx.createRadialGradient(dx, dy, 2.2 * scale, dx, dy, Math.max(cw, ch) * 0.62);
      blk.addColorStop(0, 'rgba(1, 4, 12, 0)');
      blk.addColorStop(0.45, 'rgba(1, 4, 12, 0.34)');
      blk.addColorStop(1, 'rgba(1, 4, 12, 0.66)');
      ctx.fillStyle = blk;
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    }

    // 10b. Emissive Geothermal Vents, Deep Bioluminescence, Crystal Glint, Spectral Optics & Collect Bursts
    this._drawSpectralAbsorption(ctx, cw, ch, diver, toScreenX, toScreenY, scale);
    if (Array.isArray(this.level.geothermalVents) && this.level.geothermalVents.length > 0) {
      this._drawGeothermalVents(ctx, viewWorldLeft, viewWorldRight, visY0, visY1, toScreenX, toScreenY, scale, timeSec);
    }
    if (this.level.theme?.bioluminescent || this._activeWeather?.forceBiolum) {
      this._drawBioluminescence(ctx, viewWorldLeft, viewWorldRight, visY0, visY1, toScreenX, toScreenY, scale, timeSec);
    }
    if (this.level.h2sCloudLayer && typeof this._drawH2sCloudRiver === 'function') {
      this._drawH2sCloudRiver(ctx, cw, ch, this.level.h2sCloudLayer, toScreenX, toScreenY, scale, timeSec);
      this._drawH2sCloudImmersionVignette?.(ctx, cw, ch, diver, this.level.h2sCloudLayer);
    }
    if (bioWake && bioWake.length > 0 && typeof this._drawBioWake === 'function') {
      this._drawBioWake(ctx, bioWake, visX0 - 2, visX1 + 2, visY0 - 2, visY1 + 2, toScreenX, toScreenY, scale, timeSec);
    }
    if (biolumWake && biolumWake.length > 0 && typeof this._drawBiolumPlanktonWake === 'function') {
      this._drawBiolumPlanktonWake(ctx, biolumWake, visX0 - 2, visX1 + 2, visY0 - 2, visY1 + 2, toScreenX, toScreenY, scale);
    }
    if (dashSlipstreams && dashSlipstreams.length > 0 && typeof this._drawDashSlipstreamArcs === 'function') {
      this._drawDashSlipstreamArcs(ctx, dashSlipstreams, toScreenX, toScreenY, scale, timeSec);
    }
    if (ecosystem) {
      this._drawCrystalSparkle(ctx, ecosystem, visX0 - 3, visX1 + 3, visY0 - 3, visY1 + 3, toScreenX, toScreenY, scale, timeSec);
      if (diver && diver.torchOn !== false) {
        this._drawFaunaEyeshine(ctx, ecosystem, diver, visX0 - 4, visX1 + 4, visY0 - 4, visY1 + 4, toScreenX, toScreenY, scale, timeSec);
      }
    }
    if (ghostPose) {
      this._drawGhostDiver(ctx, ghostPose, toScreenX, toScreenY, scale, timeSec, cw, ch, diver);
    }
    if (cameraFlash && typeof this._drawCameraFlash === 'function') {
      this._drawCameraFlash(ctx, cameraFlash, toScreenX, toScreenY, scale);
    }
    if (encounters && typeof this._drawDynamicEncounters === 'function') {
      this._drawDynamicEncounters(ctx, encounters, visX0 - 10, visX1 + 10, visY0 - 6, visY1 + 6, toScreenX, toScreenY, scale, timeSec, 'emissive');
    }
    if (stories && typeof this._drawSubmergedStories === 'function') {
      this._drawSubmergedStories(ctx, stories, visX0 - 8, visX1 + 8, visY0 - 8, visY1 + 8, toScreenX, toScreenY, scale, timeSec, 'emissive');
    }
    if ((Array.isArray(squeezeDust) && squeezeDust.length > 0) || handOnLinePt) {
      this._drawTactileSqueezeAndLineFeel(ctx, diver, squeezeDust, handOnLinePt, localSiltDensity, toScreenX, toScreenY, scale, timeSec);
    }
    if ((blackBox || (Array.isArray(lineCookies) && lineCookies.length > 0) || (Array.isArray(surveyPins) && surveyPins.length > 0)) && typeof this._drawBlackBoxAndCookies === 'function') {
      this._drawBlackBoxAndCookies(ctx, blackBox, lineCookies, diver, toScreenX, toScreenY, scale, timeSec, Boolean(sonarPulse), surveyPins);
    }
    if (Array.isArray(powerRelays) && powerRelays.length > 0 && typeof this._drawPowerRelays === 'function') {
      this._drawPowerRelays(ctx, powerRelays, diver, toScreenX, toScreenY, scale, timeSec);
    }
    if (smb?.active && typeof this._drawSurfaceMarkerBuoy === 'function') {
      this._drawSurfaceMarkerBuoy(ctx, smb, toScreenX, toScreenY, scale, timeSec);
    }
    if (bubbles && bubbles.length > 0 && diver.torchOn !== false) {
      this._drawTorchLitBubbles(ctx, cw, ch, diver, bubbles, toScreenX, toScreenY, scale);
    }
    this._drawTorchMarineSnowAndCaustics(ctx, diver, viewWorldLeft, viewWorldRight, viewWorldTop, viewWorldBottom, toScreenX, toScreenY, scale, timeSec, weatherCaustics, hazards, cw);
    this._drawShallowRefractionBands?.(ctx, cw, ch, surfY, diver?.y, weatherCaustics, timeSec);
    this._drawVolumetricSkylightBeams?.(ctx, cw, ch, surfY, diver?.y, weatherCaustics, timeSec, toScreenX, scale);
    this._drawParallaxMarineSnow?.(ctx, cw, ch, effCamX, effCamY, surfY, scale, timeSec);
    this._drawBossPhaseAtmosphere?.(ctx, cw, ch, secretLair, timeSec);
    if (!this.level.isWreck) {
      this._drawCaveInteractiveBeacons(ctx, viewWorldLeft, viewWorldRight, viewWorldTop, viewWorldBottom, toScreenX, toScreenY, scale, timeSec, wreckState);
    }
    this._drawDiverSignals(ctx, diver, peerList, toScreenX, toScreenY, scale, timeSec, cw, ch);
    if (buddyPing && typeof this._drawBuddyLocatePing === 'function') {
      this._drawBuddyLocatePing(ctx, diver, buddyPing, toScreenX, toScreenY, scale, timeSec, cw, ch);
    }
    this._drawCollectBursts(ctx, collectBursts, toScreenX, toScreenY, scale);
    if (mechFx && ((mechFx.particles && mechFx.particles.length > 0) || mechFx.activeAction)) {
      this._drawMechanicalFx(ctx, mechFx, toScreenX, toScreenY, scale, timeSec);
    }

    // 11. World-space Diffusing Cavern Silt Clouds & Torch Backscatter across ALL divers' lights
    this._drawSiltClouds(ctx, cw, ch, toScreenX, toScreenY, scale, siltClouds, diver, peerList, timeSec);
    // 11-fg. Strategic Near-Camera Foreground Parallax Silhouettes (auto-fades near diver for 100% clarity, v224)
    this._drawForegroundDepthElements?.(ctx, cw, ch, effCamX, effCamY, viewCenterX, viewCenterY, scale, timeSec, diver, secretLair);
    // 11a-pre. Co-op Crossed-Beam Triangulation (drawn post-silt so triangulated focal bloom & relic glints pierce haze! v213)
    this._drawCoopBeamTriangulation?.(ctx, diver, peerList, this.level.collectibles, collectedIds, toScreenX, toScreenY, scale, timeSec);
    // 11a-deco. Diegetic Decompression Hover Band & Steady-Trim Offgas Reticle (v214)
    this._drawDiegeticDecoHoverBand?.(ctx, cw, ch, diver, diveState, decoMastery, toScreenX, toScreenY, scale, timeSec);

    // 11a. Active Acoustic Cave Sonar Overlay (drawn POST-silt so echoes pierce zero-vis silt-outs! v142)
    if (sonarPulse) {
      this._drawSonarPulse(ctx, sonarPulse, toScreenX, toScreenY, scale, timeSec);
    }
    if (worldBeacons && worldBeacons.length > 0 && typeof this._drawWorldBeacons === 'function') {
      this._drawWorldBeacons(ctx, worldBeacons, toScreenX, toScreenY, scale, timeSec);
    }
    if (syncedSonarPings && syncedSonarPings.length > 0 && typeof this._drawSyncedSonarPings === 'function') {
      this._drawSyncedSonarPings(ctx, cw, ch, syncedSonarPings, diver, toScreenX, toScreenY, scale, timeSec);
    }
    if (secretLair && typeof this._drawSecretLairEmissive === 'function') {
      this._drawSecretLairEmissive(ctx, cw, ch, diver, toScreenX, toScreenY, scale, timeSec, secretLair);
    }

    // 11b. Diegetic Depth Bands, Gas-Switch / Deco Hover Zones, Waypoint, Offscreen Buddy Pings & Ascent Pacer
    // In Secret Lair Pure Combat Mode, strip ALL diving lines/coach/telemetry overlays for crisp arcade clarity!
    const inCombatMode = Boolean(secretLair?.combatMode);
    if (!isPhotoMode) {
      if (!inCombatMode) {
        this._drawZonesAndMarkers(ctx, cw, ch, diver, diveState, checkpointsHit, toScreenX, toScreenY, scale, timeSec);
        const showCompass =
          mutatorId === 'purist'
            ? false
            : difficulty === 'guided'
              ? true
              : difficulty === 'hardcore'
                ? false
                : !this.level.hideWaypointCompass;
        if (showCompass && !endedState) {
          this._drawWaypointCompass(ctx, cw, ch, diver, nextCheckpoint, toScreenX, toScreenY, scale, timeSec);
        }
      }
      this._drawPeerEdgeIndicators(ctx, cw, ch, diver, peerList, toScreenX, toScreenY, timeSec);
      if (celebrationParticles && celebrationParticles.length > 0) {
        this._drawCelebrationParticles(ctx, celebrationParticles, cw, ch);
      }
      if (!endedState && !inCombatMode) {
        this._drawAscentCoach(ctx, diver, diveState, checkpointsHit, toScreenX, toScreenY, scale, nextCheckpoint, timeSec);
        if (compactHud) {
          this._drawDiegeticImmersionTape(ctx, cw, ch, diver, diveState, nextCheckpoint, timeSec);
        }
      }
    }

    // 12. Physiology Screen Vignettes & Emergency Drill Visor FX (skipped while spectating, Photo Mode, or Combat Mode)
    if (!isSpectating && !isPhotoMode && !inCombatMode) {
      this._drawPhysiologyOverlay(ctx, cw, ch, diveState, timeSec);
      if (hazards?.thermoclineColdFactor > 0.06) {
        this._drawThermoclineFrostRim(ctx, cw, ch, hazards, timeSec);
      }
      if (drills?.active || drills?.backupTorchActive) {
        this._drawEmergencyDrillOverlay(ctx, cw, ch, drills, timeSec);
      }
      if (typeof this._drawImmersionGlassFx === 'function') {
        this._drawImmersionGlassFx(ctx, cw, ch, diver, diveState, hazards, breathState, timeSec);
      }
    }

    // 13. Live Freeze-Frame Photo Mode Color Grade, Vignette & Composition Grid (v139)
    if (isPhotoMode) {
      applyPhotoViewportOverlay(ctx, cw, ch, photoMode);
    }
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
      const sy1 = toScreenY(24);
      const leftX = rays[0].xTop;
      const rightX = rays[rays.length - 1].xTop;
      const spanW = Math.max(2, rightX - leftX);
      const midX = toScreenX((leftX + rightX) * 0.5);
      const sway = Math.sin(timeSec * 0.7) * 0.8 * scale;
      const grad = ctx.createLinearGradient(midX, sy0, midX + sway, sy1);
      grad.addColorStop(0, this.level.theme?.sunbeamTop || 'rgba(186, 230, 253, 0.34)');
      grad.addColorStop(0.45, this.level.theme?.sunbeamMid || 'rgba(56, 189, 248, 0.13)');
      grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(
        toScreenX(leftX) - 6 * scale,
        sy0,
        (spanW + 12) * scale,
        sy1 - sy0
      );

      // Distinct angled crepuscular god-ray shafts + sunlit motes inside open-water cavern/wreck shafts (v119 / v193 zero-loop-grad)
      const shaftCount = Math.max(3, Math.min(7, Math.round(spanW / 3.1)));
      const tiltPx = (this.level.isWreck ? 4.8 : 3.2) * scale;
      ctx.globalCompositeOperation = 'screen';
      const sharedShaftGrad = ctx.createLinearGradient(midX, sy0, midX + tiltPx * 0.65, sy1);
      sharedShaftGrad.addColorStop(0, 'rgba(224, 242, 254, 0.24)');
      sharedShaftGrad.addColorStop(0.45, 'rgba(103, 232, 249, 0.11)');
      sharedShaftGrad.addColorStop(0.82, 'rgba(56, 189, 248, 0.03)');
      sharedShaftGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = sharedShaftGrad;
      for (let sIdx = 0; sIdx < shaftCount; sIdx++) {
        const frac = (sIdx + 0.5) / shaftCount;
        const wave = Math.sin(timeSec * 0.85 + sIdx * 1.45) * 0.68;
        const shimmer = 0.45 + 0.55 * Math.sin(timeSec * 1.4 + sIdx * 2.1);
        const topWorldX = leftX + spanW * frac + wave * 0.45;
        const halfTop = Math.max(0.38, (spanW / shaftCount) * 0.22) * scale;
        const halfBot = halfTop * 2.35;
        const tx = toScreenX(topWorldX);
        const bx = tx + tiltPx + wave * 0.72 * scale;
        ctx.globalAlpha = 0.48 + shimmer * 0.52;
        ctx.beginPath();
        ctx.moveTo(tx - halfTop, sy0);
        ctx.lineTo(tx + halfTop, sy0);
        ctx.lineTo(bx + halfBot, sy1);
        ctx.lineTo(bx - halfBot, sy1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Drifting sunlit water motes suspended inside the bright upper beam
      ctx.fillStyle = 'rgba(224, 242, 254, 0.36)';
      for (let m = 0; m < 8; m++) {
        const mx = leftX + ((m * 0.37 + Math.sin(timeSec * 0.25 + m * 1.9) * 0.14 + 1) % 1) * spanW;
        const my = 1.2 + ((m * 1.95 + timeSec * 0.28) % 13.5);
        const mr = Math.max(1.0, (0.032 + (m % 3) * 0.014) * scale);
        ctx.beginPath();
        ctx.arc(toScreenX(mx), toScreenY(my), mr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  _drawCaustics(ctx, sunCurtains, toScreenX, toScreenY, scale, timeSec) {
    if (!sunCurtains.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const cyanStamp = this.glowStamps.cyan;
    const warmStamp = this.glowStamps.warm;
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

        // Projected shimmering wall-hit sun caustic pools where daylight strikes rock ledges
        if (cyanStamp && a.hitWall && a.yBot < 16.5) {
          const depthAtten = Math.max(0, 1 - a.yBot / 16.5);
          const inc = Math.max(0.25, a.incidence || 0.5);
          const cAlpha = depthAtten * inc * (0.14 + shimmer * 0.2);
          if (cAlpha > 0.025) {
            const wx = toScreenX(a.xBot + Math.sin(timeSec * 2.8 + i) * 0.14);
            const wy = toScreenY(a.yBot);
            const rad = (0.75 + shimmer * 0.42) * scale;
            ctx.globalAlpha = Math.min(0.42, cAlpha);
            ctx.drawImage(a.yBot < 7.5 && warmStamp ? warmStamp : cyanStamp, wx - rad, wy - rad * 0.65, rad * 2, rad * 1.3);
            ctx.globalAlpha = 1;
          }
        }
      }
    }
    ctx.restore();
  }

  _drawAnchoredLife(ctx, eco, xMin, xMax, yMin, yMax, toScreenX, toScreenY, scale, timeSec, diver = null) {
    ctx.save();
    const hasDiver = Boolean(diver);
    const divX = hasDiver ? diver.x : 0;
    const divY = hasDiver ? diver.y : 0;
    const divVx = hasDiver ? (diver.vx || 0) : 0;
    const divVy = hasDiver ? (diver.vy || 0) : 0;
    const divSpd = hasDiver ? Math.hypot(divVx, divVy) : 0;

    for (let i = 0; i < eco.anchored.length; i++) {
      const a = eco.anchored[i];
      if (a.x < xMin || a.x > xMax || a.y < yMin || a.y > yMax) continue;

      const sx = toScreenX(a.x);
      const sy = toScreenY(a.y);
      let sway = Math.sin(timeSec * 1.8 + a.phase) * 0.09 * scale;
      // Fin-wash & DPV scooter prop-wash hydrodynamic deflection when diver swims past flexible flora (v151 / v192)
      if (hasDiver && (divSpd > 0.25 || diver.dpvThrusting) && (a.kind === 'vine' || a.kind === 'chara' || a.kind === 'biofilm' || a.kind === 'seafan')) {
        const dx = a.x - divX;
        const dy = a.y - divY;
        const dSq = dx * dx + dy * dy;
        const reach = diver.dpvThrusting ? 8.2 : 5.2;
        if (dSq < reach * reach) {
          const dist = Math.sqrt(dSq);
          const falloff = (1 - dist / reach);
          const pushDir = Math.abs(divVx) > 0.2 ? Math.sign(divVx) : Math.sign(dx || 1);
          const flutter = 0.72 + 0.28 * Math.sin(timeSec * (diver.dpvThrusting ? 14.5 : 8.5) + a.phase);
          const propBoost = diver.dpvThrusting ? 0.28 : 0;
          sway += pushDir * Math.min(0.68, falloff * falloff * (0.14 + divSpd * 0.15 + propBoost)) * flutter * scale;
        }
      }

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
      } else if (a.kind === 'rusticle') {
        // Hanging icicle-like iron-oxide rusticles dripping from sunken steel ceilings
        for (let s = -1; s <= 1; s++) {
          const sh = sz * (s === 0 ? 1.15 : 0.72);
          const ox = s * 0.14 * scale;
          ctx.fillStyle = a.color;
          ctx.beginPath();
          ctx.moveTo(ox - 0.065 * scale, 0);
          ctx.lineTo(ox + 0.065 * scale, 0);
          ctx.lineTo(ox + 0.015 * scale, -sh);
          ctx.lineTo(ox - 0.015 * scale, -sh);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = a.accent;
          ctx.beginPath();
          ctx.arc(ox, -sh, 0.032 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (a.kind === 'seafan') {
        // Branching gorgonian sea fan corals & red sponges colonizing upper ship steel
        ctx.strokeStyle = a.color;
        ctx.lineWidth = Math.max(1.4, 0.055 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(sway * 0.6, -sz * 0.5, sway * 1.1, -sz);
        ctx.moveTo(sway * 0.3, -sz * 0.35);
        ctx.lineTo(-sz * 0.42 + sway * 0.8, -sz * 0.78);
        ctx.moveTo(sway * 0.3, -sz * 0.4);
        ctx.lineTo(sz * 0.42 + sway * 0.9, -sz * 0.82);
        ctx.moveTo(sway * 0.6, -sz * 0.65);
        ctx.lineTo(-sz * 0.25 + sway * 1.1, -sz * 0.96);
        ctx.moveTo(sway * 0.6, -sz * 0.65);
        ctx.lineTo(sz * 0.25 + sway * 1.2, -sz * 0.98);
        ctx.stroke();
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

    // 4. Pelagic Moon Jellyfish pulsing along open-water shipwreck shot lines
    if (Array.isArray(eco.jellies)) {
      for (let i = 0; i < eco.jellies.length; i++) {
        const j = eco.jellies[i];
        if (j.x < xMin - 2 || j.x > xMax + 2 || j.y < yMin - 3 || j.y > yMax + 2) continue;
        drawStyledJellyfish(ctx, j, toScreenX(j.x), toScreenY(j.y), scale, timeSec);
      }
    }

    // 5. Reactive Megafauna (Reef Sharks, Giant Manta Rays, Arctic Belugas & Goliath Groupers)
    if (Array.isArray(eco.megafauna)) {
      for (let i = 0; i < eco.megafauna.length; i++) {
        const m = eco.megafauna[i];
        if (m.x < xMin - 6 || m.x > xMax + 6 || m.y < yMin - 4 || m.y > yMax + 4) continue;
        drawStyledMegafauna(ctx, m, toScreenX(m.x), toScreenY(m.y), scale, timeSec);
      }
    }
    // 6. Interactive Wreck & Karst Crevice Denizens (Giant Octopuses & Emerald Moray Eels, v162)
    if (Array.isArray(eco.denizens)) {
      for (let i = 0; i < eco.denizens.length; i++) {
        const d = eco.denizens[i];
        if (d.x < xMin - 3 || d.x > xMax + 3 || d.y < yMin - 3 || d.y > yMax + 3) continue;
        drawStyledDenizen(ctx, d, toScreenX(d.x), toScreenY(d.y), scale, timeSec);
      }
    }
    ctx.restore();
  }

  /**
   * Subtle post-lighting specular glints on exhaled bubbles passing inside the diver's torch cone.
   */
  _drawTorchLitBubbles(ctx, cw, ch, diver, bubbles, toScreenX, toScreenY, scale) {
    const ox = diver.body?.hand ? diver.body.hand.x : diver.x;
    const oy = diver.body?.hand ? diver.body.hand.y : diver.y;
    const ang = Number.isFinite(diver.torchAngle) ? diver.torchAngle : (diver.angle || 0);
    const fx = Math.cos(ang);
    const fy = Math.sin(ang);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(224, 242, 254, 0.72)';
    ctx.beginPath();
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      const dx = b.x - ox;
      const dy = b.y - oy;
      const dSq = dx * dx + dy * dy;
      if (dSq < 0.08 || dSq > 144) continue;
      const dist = Math.sqrt(dSq);
      if ((dx * fx + dy * fy) / dist < 0.8) continue;
      const sx = toScreenX(b.x);
      const sy = toScreenY(b.y);
      if (sx < -6 || sx > cw + 6 || sy < -6 || sy > ch + 6) continue;
      const gr = Math.max(1.1, Math.min(3.2, (b.r || 0.05) * scale * 0.42));
      ctx.moveTo(sx + gr, sy);
      ctx.arc(sx, sy, gr, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }

  _drawGhostDiver(ctx, ghost, toScreenX, toScreenY, scale, timeSec, cw = 0, ch = 0, diver = null) {
    if (!ghost) return;
    const sx = toScreenX(ghost.x);
    const sy = toScreenY(ghost.y);
    const u = scale;
    const isPar = Boolean(ghost.isPar);
    const strokeCol = isPar ? '#c084fc' : '#22d3ee';
    const fillCol = isPar ? 'rgba(192, 132, 252, 0.34)' : 'rgba(34, 211, 238, 0.36)';
    const labelText = isPar ? '👻 PAR PACER' : '👻 PB GHOST';
    const dpr = this._cachedDpr || 1;

    // If ghost has swum off-camera, show a sleek edge indicator so the diver can always race their pace
    if (cw > 0 && ch > 0 && diver) {
      const marginX = Math.round(28 * dpr);
      const topSafe = Math.round((cw < ch ? 116 : 92) * dpr);
      const botSafe = Math.round((cw < ch ? 225 : 138) * dpr);
      const onScreen = sx >= -18 && sx <= cw + 18 && sy >= -18 && sy <= ch + 18;
      if (!onScreen) {
        const distM = Math.round(Math.hypot(ghost.x - diver.x, ghost.y - diver.y));
        const dDepth = Math.round((ghost.y || 0) - (diver.y || 0));
        const depthTag = Math.abs(dDepth) >= 3 ? (dDepth > 0 ? ` ▼${dDepth}m` : ` ▲${Math.abs(dDepth)}m`) : '';
        const ang = Math.atan2(sy - ch * 0.5, sx - cw * 0.5);
        const rx = Math.max(marginX, Math.min(cw - marginX, cw * 0.5 + Math.cos(ang) * (cw * 0.5 - marginX)));
        const ry = Math.max(topSafe, Math.min(ch - botSafe, ch * 0.5 + Math.sin(ang) * (ch * 0.5 - Math.max(topSafe, botSafe) * 0.5)));
        const arrowSz = Math.round(7 * dpr);
        const fontPx = Math.round(10 * dpr);
        const tag = `${isPar ? '👻 PAR' : '👻 PB'} ${distM}m${depthTag}`;
        ctx.save();
        ctx.globalAlpha = 0.82;
        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(ang);
        ctx.fillStyle = strokeCol;
        ctx.beginPath();
        ctx.moveTo(arrowSz, 0);
        ctx.lineTo(-arrowSz * 0.7, -arrowSz * 0.55);
        ctx.lineTo(-arrowSz * 0.35, 0);
        ctx.lineTo(-arrowSz * 0.7, arrowSz * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.font = `800 ${fontPx}px ui-monospace, monospace`;
        ctx.textBaseline = 'middle';
        const pillPad = Math.round(6 * dpr);
        const pillW = ctx.measureText(tag).width + pillPad * 2;
        const pillH = Math.round(18 * dpr);
        const onRight = rx > cw * 0.5;
        const rawX = onRight ? rx - arrowSz - Math.round(5 * dpr) - pillW : rx + arrowSz + Math.round(5 * dpr);
        const pillX = Math.max(marginX, Math.min(cw - marginX - pillW, rawX));
        ctx.fillStyle = 'rgba(2, 12, 26, 0.84)';
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = Math.max(1, 1.2 * dpr);
        ctx.beginPath();
        ctx.roundRect(pillX, ry - pillH * 0.5, pillW, pillH, 999);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = isPar ? '#e9d5ff' : '#a5f3fc';
        ctx.fillText(tag, pillX + pillW * 0.5, ry + 0.5);
        ctx.restore();
        return;
      }
    }

    const pulse = 0.82 + 0.18 * Math.sin(timeSec * 3.4);

    ctx.save();
    ctx.translate(sx, sy);

    // Luminous holographic aura so the ghost reads clearly in both sunlit cenotes and pitch-black sumps
    const stamp = this.glowStamps?.cyan;
    if (stamp) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = (ghost.finished ? 0.22 : 0.42) * pulse;
      const gr = u * 1.35;
      ctx.drawImage(stamp, -gr, -gr, gr * 2, gr * 2);
      ctx.restore();
    }

    // Translucent holographic diver rig matching the player's actual custom headgear & silhouette (v155)
    ctx.save();
    ctx.rotate(ghost.angle || 0);
    if (Math.cos(ghost.angle || 0) < 0) ctx.scale(1, -1);
    ctx.globalAlpha = (ghost.finished ? 0.34 : 0.68) * pulse;

    const ghostPal = diver?.livery ? resolveDiverLiveryPalette(diver.livery) : null;
    drawStyledDiverRig(ctx, u * 0.55, u, isPar, 1, {
      hasCcr: Boolean(diver?.hasCcr),
      hasDpv: false,
      timeSec,
      liveryPalette: ghostPal
        ? {
            ...ghostPal,
            accent: strokeCol,
            trim: strokeCol,
          }
        : {
            suitTop: fillCol,
            suitMid: fillCol,
            suitBot: fillCol,
            accent: strokeCol,
            trim: strokeCol,
            stageBand: strokeCol,
          },
    });

    // Soft forward holographic torch cone
    if (!ghost.finished) {
      ctx.fillStyle = isPar ? 'rgba(192, 132, 252, 0.14)' : 'rgba(34, 211, 238, 0.15)';
      ctx.beginPath();
      ctx.moveTo(u * 0.56, -u * 0.02);
      ctx.lineTo(u * 2.2, -u * 0.48);
      ctx.lineTo(u * 2.2, u * 0.44);
      ctx.closePath();
      ctx.fill();
    }

    // Sweeping animated holographic fin stroke
    const kick = Math.sin(timeSec * 6.5) * u * 0.14;
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = Math.max(1.6, u * 0.06);
    ctx.beginPath();
    ctx.moveTo(-u * 0.42, 0);
    ctx.lineTo(-u * 0.86, -u * 0.09 + kick);
    ctx.lineTo(-u * 1.14, -u * 0.15 + kick);
    ctx.moveTo(-u * 0.42, 0);
    ctx.lineTo(-u * 0.86, u * 0.09 - kick);
    ctx.lineTo(-u * 1.14, u * 0.15 - kick);
    ctx.stroke();
    ctx.restore();

    // High-contrast floating pill badge (readable against bright water & dark rock)
    ctx.globalAlpha = ghost.finished ? 0.6 : 0.92;
    const fontPx = Math.max(9, Math.round(u * 0.3));
    ctx.font = `800 ${fontPx}px ui-monospace, monospace`;
    const tw = ctx.measureText(labelText).width;
    const bw = tw + 12;
    const bh = Math.max(16, fontPx + 6);
    const labelY = -u * 0.72;
    ctx.fillStyle = 'rgba(2, 12, 26, 0.82)';
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-bw * 0.5, labelY - bh * 0.5, bw, bh, 999);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isPar ? '#e9d5ff' : '#cffafe';
    ctx.fillText(labelText, 0, labelY + 0.5);
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

  /**
   * Subtle deep-water tapetum-lucidum eyeshine glint for lurking megafauna (sharks, groupers, lake trout)
   * and dark-zone catfish/barracuda caught near the outer edge of the diver's torch cone (v151).
   */
  _drawFaunaEyeshine(ctx, eco, diver, xMin, xMax, yMin, yMax, toScreenX, toScreenY, scale, timeSec) {
    if (!eco || !diver || diver.torchOn === false) return;
    const beamAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : (diver.angle || 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const drawGlint = (wx, wy, dirX, radiusPx, col, alpha) => {
      if (alpha <= 0.04) return;
      const sx = toScreenX(wx);
      const sy = toScreenY(wy);
      const ex = sx + dirX * radiusPx * 2.1;
      const ey = sy - radiusPx * 0.45;
      ctx.globalAlpha = Math.min(0.85, alpha);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(ex, ey, radiusPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = Math.min(0.32, alpha * 0.45);
      ctx.beginPath();
      ctx.arc(ex, ey, radiusPx * 2.5, 0, Math.PI * 2);
      ctx.fill();
    };

    const checkArc = (wx, wy, maxD) => {
      const dx = wx - diver.x;
      const dy = wy - diver.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < 6.25 || dSq > maxD * maxD) return 0; // glint appears at dim mid/far rim (2.5m..maxD)
      const d = Math.sqrt(dSq);
      let diff = Math.atan2(dy, dx) - beamAng;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const ad = Math.abs(diff);
      if (ad > 0.62) return 0;
      return (1 - ad / 0.62) * (1 - d / maxD) * Math.min(1, (d - 2.5) / 3.5);
    };

    if (Array.isArray(eco.megafauna)) {
      for (let i = 0; i < eco.megafauna.length; i++) {
        const m = eco.megafauna[i];
        if (!m || m.kind === 'manta' || m.kind === 'beluga' || m.x < xMin || m.x > xMax || m.y < yMin || m.y > yMax || m.y < 8) continue;
        const g = checkArc(m.x, m.y, 19.5);
        if (g > 0.05) {
          const dirX = (m.facing ?? ((m.vx || 0) >= 0 ? 1 : -1)) >= 0 ? 1 : -1;
          const eyeOffX = dirX * (m.size || 1.2) * (m.kind === 'shark' ? 0.98 : 0.72);
          const eyeOffY = -(m.size || 1.2) * (m.kind === 'shark' ? 0.05 : 0.09);
          const col = m.kind === 'shark' ? '#a7f3d0' : '#fde047';
          const pulse = 0.78 + 0.22 * Math.sin(timeSec * 4.5 + i * 1.7);
          drawGlint(m.x + eyeOffX, m.y + eyeOffY, dirX, Math.max(1.4, (m.size || 1) * 0.032 * scale), col, g * 0.65 * pulse);
        }
      }
    }

    if (Array.isArray(eco.fish)) {
      for (let i = 0; i < eco.fish.length; i++) {
        const f = eco.fish[i];
        if (!f || f.kind === 'cavefish' || f.y < 14) continue;
        if (f.x < xMin || f.x > xMax || f.y < yMin || f.y > yMax) continue;
        const g = checkArc(f.x, f.y, 14.0);
        if (g > 0.1) {
          const dirX = (f.vx || 0) >= 0 ? 1 : -1;
          const col = f.kind === 'barracuda' ? '#bae6fd' : '#fde68a';
          drawGlint(f.x, f.y, dirX, Math.max(1.2, (f.size || 0.2) * 0.14 * scale), col, g * 0.68);
        }
      }
    }

    ctx.restore();
  }

  /**
   * Submerged Storytelling & Atmospheric Set-Pieces Renderer (v155):
   * - pass === 'world' (pre-lighting): speleothem cathedrals, historic mine shoring,
   *   glacial ice arches, Chadburn engine telegraphs, ship helm wheels, boiler gauge panels,
   *   bolted bronze portholes, caged bulkhead sconces, Mayan ceramic vessels, ammonite fossils,
   *   and vintage brass explorer survey pitons.
   * - pass === 'emissive' (post-lighting): flickering crimson emergency bulkhead lamp pools,
   *   volumetric diagonal porthole dust shafts, undulating halocline optical refraction waves,
   *   glacial sapphire inner shimmer, and survey-tag reflector glints.
   */
  _drawSubmergedStories(ctx, stories, xMin, xMax, yMin, yMax, toScreenX, toScreenY, scale, timeSec, pass = 'world') {
    return drawSubmergedStories(this, ctx, stories, xMin, xMax, yMin, yMax, toScreenX, toScreenY, scale, timeSec, pass);
  }

  _drawDiegeticImmersionTape(ctx, cw, ch, diver, diveState, nextCheckpoint, timeSec = 0) {
    if (!diver || !diveState) return;
    const dpr = this._cachedDpr || 1;
    const depthM = Math.max(0, Number(diveState.depthM ?? diveState.depth ?? diver.y) || 0);
    const ceilingM = Math.max(0, Number(diveState.ceilingM ?? diveState.decoCeilingM) || 0);
    const activeGasId = diveState.activeGasId || 'EAN32';
    const activeTank = diveState.tanks?.[activeGasId];
    const bar = Math.max(0, Math.round(Number(activeTank?.bar ?? diveState.activeTankBar) || 0));
    const activeMix = diveState.mixes?.[activeGasId] || diveState.activeMix;
    const mixName = activeMix?.shortName || activeMix?.name || activeGasId || 'GAS';
    const fontScale = Math.max(10, Math.round(11 * dpr));

    ctx.save();
    const tapeW = 46 * dpr;
    const tapeH = Math.min(ch * 0.44, 210 * dpr);
    const tapeX = cw - tapeW - 14 * dpr;
    const tapeY = Math.round((ch - tapeH) * 0.52);

    ctx.fillStyle = 'rgba(2, 12, 24, 0.42)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(tapeX, tapeY, tapeW, tapeH, 8 * dpr);
    } else {
      ctx.rect(tapeX, tapeY, tapeW, tapeH);
    }
    ctx.fill();
    ctx.stroke();

    const pxPerTickM = tapeH / 24;
    const centerY = tapeY + tapeH * 0.5;
    ctx.font = `600 ${Math.round(fontScale * 0.82)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const minTickM = Math.max(0, Math.floor((depthM - 12) / 5) * 5);
    const maxTickM = Math.ceil((depthM + 12) / 5) * 5;
    for (let m = minTickM; m <= maxTickM; m += 5) {
      const ty = centerY + (m - depthM) * pxPerTickM;
      if (ty < tapeY + 8 * dpr || ty > tapeY + tapeH - 8 * dpr) continue;
      ctx.strokeStyle = m === 0 ? 'rgba(125, 211, 252, 0.72)' : 'rgba(148, 163, 184, 0.45)';
      ctx.beginPath();
      ctx.moveTo(tapeX + 4 * dpr, ty);
      ctx.lineTo(tapeX + 12 * dpr, ty);
      ctx.stroke();
      ctx.fillStyle = 'rgba(203, 213, 225, 0.78)';
      ctx.fillText(`${m}`, tapeX + tapeW - 6 * dpr, ty);
    }

    if (ceilingM > 0.4) {
      const ceilY = Math.max(tapeY + 6 * dpr, Math.min(tapeY + tapeH - 6 * dpr, centerY + (ceilingM - depthM) * pxPerTickM));
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.92)';
      ctx.lineWidth = Math.max(1.5, 1.5 * dpr);
      ctx.beginPath();
      ctx.moveTo(tapeX + 2 * dpr, ceilY);
      ctx.lineTo(tapeX + tapeW - 2 * dpr, ceilY);
      ctx.stroke();
    }

    const pillH = 20 * dpr;
    ctx.fillStyle = 'rgba(14, 165, 233, 0.28)';
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.9)';
    ctx.lineWidth = Math.max(1.2, 1.2 * dpr);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(tapeX - 6 * dpr, centerY - pillH * 0.5, tapeW + 8 * dpr, pillH, 5 * dpr);
    } else {
      ctx.rect(tapeX - 6 * dpr, centerY - pillH * 0.5, tapeW + 8 * dpr, pillH);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f0f9ff';
    ctx.font = `700 ${fontScale}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${depthM.toFixed(1)}m`, tapeX + tapeW * 0.5 - 2 * dpr, centerY);

    ctx.fillStyle = bar < 50 ? '#fca5a5' : '#93c5fd';
    ctx.font = `700 ${Math.round(fontScale * 0.78)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(`${mixName} ${bar}b`, tapeX + tapeW, tapeY + tapeH + 12 * dpr);

    const ribW = Math.min(cw * 0.38, 210 * dpr);
    const ribH = 22 * dpr;
    const ribX = Math.round((cw - ribW) * 0.5);
    const ribY = Math.round(62 * dpr);
    ctx.fillStyle = 'rgba(2, 12, 24, 0.42)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(ribX, ribY, ribW, ribH, 11 * dpr);
    } else {
      ctx.rect(ribX, ribY, ribW, ribH);
    }
    ctx.fill();
    ctx.stroke();

    const angleRad = Number.isFinite(diver.angle)
      ? diver.angle
      : Math.atan2(diver.facingY || 0, diver.facingX || 1);
    const headingDeg = ((Math.round((angleRad * 180) / Math.PI) + 90) % 360 + 360) % 360;
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const card = cardinals[Math.round(headingDeg / 45) % 8];
    let navTxt = `HDG ${String(headingDeg).padStart(3, '0')}° ${card}`;
    if (nextCheckpoint && Number.isFinite(nextCheckpoint.x) && Number.isFinite(nextCheckpoint.y)) {
      const dist = Math.hypot(nextCheckpoint.x - diver.x, nextCheckpoint.y - diver.y);
      navTxt += ` · WP ${Math.round(dist)}m`;
    }
    const pulse = 0.85 + 0.15 * Math.sin(timeSec * 3.0);
    ctx.fillStyle = `rgba(224, 242, 254, ${pulse.toFixed(3)})`;
    ctx.font = `700 ${Math.round(fontScale * 0.84)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(navTxt, ribX + ribW * 0.5, ribY + ribH * 0.5 + 0.5 * dpr);
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

  _drawZonesAndMarkers(ctx, cw, ch, diver, diveState, checkpointsHit, toScreenX, toScreenY, scale, timeSec) {
    // 1. Subtle horizontal depth boundary lines (e.g., 33.7m EAN32 MOD)
    if (this.level.depthMarkers) {
      ctx.save();
      ctx.font = `700 ${Math.max(9, Math.round(0.32 * scale))}px ui-monospace, monospace`;
      ctx.textAlign = 'left';
      for (const dm of this.level.depthMarkers) {
        if (!Number.isFinite(dm?.y)) continue;
        const sy = toScreenY(dm.y);
        if (sy < 0 || sy > ch) continue;
        const col = dm.color || 'rgba(148, 163, 184, 0.55)';
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.25;
        ctx.setLineDash([7, 7]);
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(cw, sy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.72)';
        ctx.strokeText(dm.label, 12, sy - 5);
        ctx.fillStyle = col;
        ctx.fillText(dm.label, 12, sy - 5);
      }
      ctx.restore();
    }

    // 1b. Subtle, Refined 22m Trimix Gas-Switch Depth Line (quiet frosted-glass micro-tag, v193)
    const ascentCfg = getAscentConfig(this.level);
    const ascending = Boolean(checkpointsHit && checkpointsHit.has(ascentCfg.turnaroundId));
    if (!ascending && diveState && (this.level.bounds?.yMax || 0) > 28 && diver.y > 11 && diver.y < 35) {
      const switchY = toScreenY(22.0);
      if (switchY > -36 && switchY < ch + 36) {
        const needsTmx = diveState.activeGasId === 'EAN32' && diveState.tanks?.TMX1455?.bar > 1;
        const overdue = needsTmx && diver.y >= 26.0;
        const deepName = diveState.mixes?.TMX1455?.name || 'TMX 14/55';
        const distFade = Math.max(0.22, Math.min(1, 1 - Math.abs(diver.y - 22.0) / 13.5));
        const pulse = 0.78 + 0.22 * Math.sin(timeSec * (overdue ? 4.5 : 2.6));
        const lineCol = overdue ? '#fca5a5' : needsTmx ? '#fcd34d' : '#86efac';

        ctx.save();
        ctx.strokeStyle = lineCol;
        ctx.globalAlpha = (needsTmx ? (overdue ? 0.56 : 0.42) : 0.24) * distFade * pulse;
        ctx.lineWidth = overdue ? 1.45 : 1.05;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(0, switchY);
        ctx.lineTo(cw, switchY);
        ctx.stroke();
        ctx.setLineDash([]);

        const label = overdue
          ? `22m · Switch to ${deepName} [2]`
          : needsTmx
            ? `22m · ${deepName} [2]`
            : `22m · ${deepName} ✓`;
        ctx.font = `700 ${Math.max(9.5, Math.round(0.27 * scale))}px ui-monospace, monospace`;
        const textW = ctx.measureText(label).width;
        const boxW = textW + 14;
        const boxH = Math.max(17, 0.5 * scale);
        const cx = Math.max(boxW * 0.5 + 12, Math.min(cw - boxW * 0.5 - 12, toScreenX(diver.x)));
        const pillY = switchY - boxH * 0.5 - 4;

        ctx.globalAlpha = (needsTmx ? 0.78 : 0.48) * distFade;
        ctx.fillStyle = overdue
          ? 'rgba(69, 10, 10, 0.78)'
          : needsTmx
            ? 'rgba(15, 23, 42, 0.76)'
            : 'rgba(6, 46, 36, 0.66)';
        ctx.strokeStyle = lineCol;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.roundRect(cx - boxW * 0.5, pillY - boxH * 0.5, boxW, boxH, 999);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = overdue ? '#fecaca' : needsTmx ? '#fde68a' : '#bbf7d0';
        ctx.fillText(label, cx, pillY + 0.5);
        ctx.restore();
      }
    }

    // 2. Horizontal Gas Switch & 6m Deco Stop Zone Lines (quiet, refined diegetic style, v193)
    if (!this.level.zoneLines) return;
    ctx.save();
    for (const z of this.level.zoneLines) {
      if (!Number.isFinite(z?.y) || !Number.isFinite(z?.xMin) || !Number.isFinite(z?.xMax)) continue;
      const x0 = toScreenX(z.xMin);
      const x1 = toScreenX(z.xMax);
      const sy = toScreenY(z.y);
      if (x1 < -40 || x0 > cw + 40 || sy < -50 || sy > ch + 50) continue;

      const nearDepth = Math.abs(diver.y - z.y) <= 1.8 && diver.x >= z.xMin && diver.x <= z.xMax;
      const pulse = 0.84 + 0.16 * Math.sin(timeSec * 2.8);

      // Subtle translucent depth-band glow around the line
      const bandH = 0.45 * scale;
      if (this.glowStamps.bandGlow) {
        ctx.globalAlpha = nearDepth ? 0.42 : 0.16;
        ctx.drawImage(this.glowStamps.bandGlow, x0, sy - bandH, x1 - x0, bandH * 2);
        ctx.globalAlpha = 1;
      }

      // Slim crisp horizontal zone line with clean end-cap ticks
      ctx.strokeStyle = z.color;
      ctx.globalAlpha = (nearDepth ? 0.72 : 0.36) * pulse;
      ctx.lineWidth = nearDepth ? 1.5 : 1.0;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.moveTo(x0, sy);
      ctx.lineTo(x1, sy);
      ctx.stroke();
      ctx.setLineDash([]);

      const tick = 0.24 * scale;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(x0, sy - tick);
      ctx.lineTo(x0, sy + tick);
      ctx.moveTo(x1, sy - tick);
      ctx.lineTo(x1, sy + tick);
      ctx.stroke();

      // Quiet micro-label directly above horizontal line
      ctx.globalAlpha = nearDepth ? 0.84 : 0.56;
      ctx.textAlign = 'center';
      const cx = (x0 + x1) * 0.5;
      ctx.font = `700 ${Math.max(9.5, Math.round(0.27 * scale))}px ui-monospace, monospace`;

      let label = z.title;
      if (z.id === 'zone-deco' && diveState) {
        if (diveState.stopDepthM > 0) {
          const s = Math.max(0, Math.ceil(diveState.stopRemainingSec));
          label = diveState.activeGasId === 'O2'
            ? `6m Deco · O2 0:${String(s).padStart(2, '0')}`
            : `6m Deco · Switch O2 [3] (0:${String(s).padStart(2, '0')})`;
        } else if (diveState.maxDepthM > 20) {
          label = '6m Deco · Clear ✓';
        }
      }
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.72)';
      ctx.strokeText(label, cx, sy - 6);
      ctx.fillStyle = z.color;
      ctx.fillText(label, cx, sy - 6);
    }
    ctx.restore();
  }

  /**
   * Render Synced Tactical Sonar Waypoint Pings (v207) in 2D underwater world space
   * (drawn post-silt so pings cut cleanly through zero-vis silt-outs) + clamped
   * off-screen viewport edge arrows so teammates never miss a distant callout.
   */
  _drawSyncedSonarPings(ctx, cw, ch, pings, diver, toScreenX, toScreenY, scale, timeSec) {
    if (!Array.isArray(pings) || pings.length === 0) return;
    const dpr = this._cachedDpr || 1;
    const padX = Math.round(54 * dpr);
    const padTop = Math.round(78 * dpr);
    const padBot = Math.round((cw < ch ? 226 : 124) * dpr);

    ctx.save();
    for (let i = 0; i < pings.length; i++) {
      const p = pings[i];
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      const rgb = p.rgb || '56, 189, 248';
      const color = p.color || '#38bdf8';
      const fade = Math.max(0, Math.min(1, (p.life || 1) / 2.6));
      const distM =
        diver && Number.isFinite(diver.x) && Number.isFinite(diver.y)
          ? Math.round(Math.hypot(p.x - diver.x, p.y - diver.y))
          : null;
      const depthM = Math.max(0, Math.round(p.y));
      const onScreen = sx >= 18 * dpr && sx <= cw - 18 * dpr && sy >= 18 * dpr && sy <= ch - 18 * dpr;

      if (onScreen) {
        // Dual expanding holographic acoustic sonar rings
        const w1 = ((timeSec * 0.95 + i * 0.31) % 1);
        const w2 = ((timeSec * 0.95 + i * 0.31 + 0.5) % 1);
        const maxR = Math.max(24 * dpr, 2.4 * scale);

        ctx.lineWidth = Math.max(1.5, 2.2 * dpr);
        ctx.strokeStyle = `rgba(${rgb}, ${((1 - w1) * 0.82 * fade).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 6 * dpr + w1 * maxR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = Math.max(1, 1.4 * dpr);
        ctx.strokeStyle = `rgba(${rgb}, ${((1 - w2) * 0.6 * fade).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 6 * dpr + w2 * maxR, 0, Math.PI * 2);
        ctx.stroke();

        // Crisp tactical diamond reticle
        const r = Math.max(7, 9 * dpr);
        ctx.globalAlpha = fade;
        ctx.fillStyle = `rgba(2, 12, 24, 0.85)`;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.6, 2.0 * dpr);
        ctx.beginPath();
        ctx.moveTo(sx, sy - r);
        ctx.lineTo(sx + r, sy);
        ctx.lineTo(sx, sy + r);
        ctx.lineTo(sx - r, sy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(2.6, 3.2 * dpr), 0, Math.PI * 2);
        ctx.fill();

        // Floating pill badge (icon + label/author + depth)
        const who = p.isSelf ? (p.shortLabel || 'PING') : (p.author || p.shortLabel || 'PING');
        const badgeText = `${p.icon || '📍'} ${who} · ${depthM}m`;
        ctx.font = `800 ${Math.round(11 * dpr)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        const tw = ctx.measureText(badgeText).width;
        const bw = tw + 14 * dpr;
        const bh = 20 * dpr;
        const bx = sx - bw * 0.5;
        const by = sy - r - bh - 6 * dpr;

        ctx.fillStyle = 'rgba(2, 11, 22, 0.86)';
        ctx.strokeStyle = `rgba(${rgb}, 0.85)`;
        ctx.lineWidth = Math.max(1.2, 1.4 * dpr);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, by, bw, bh, 6 * dpr);
        } else {
          ctx.rect(bx, by, bw, bh);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, sx, by + bh * 0.52);
        ctx.globalAlpha = 1;
      } else {
        // Off-screen clamped directional edge indicator pill pointing toward ping
        const cx = cw * 0.5;
        const cy = ch * 0.5;
        const ang = Math.atan2(sy - cy, sx - cx);
        const ex = Math.max(padX, Math.min(cw - padX, sx));
        const ey = Math.max(padTop, Math.min(ch - padBot, sy));

        const edgeText = distM !== null ? `${p.icon || '📍'} ${distM}m` : `${p.icon || '📍'} ${depthM}m`;
        ctx.globalAlpha = Math.max(0.45, fade);
        ctx.font = `800 ${Math.round(10.5 * dpr)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        const tw = ctx.measureText(edgeText).width;
        const bw = tw + 16 * dpr;
        const bh = 21 * dpr;

        ctx.fillStyle = 'rgba(2, 11, 22, 0.88)';
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.3, 1.6 * dpr);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(ex - bw * 0.5, ey - bh * 0.5, bw, bh, 9 * dpr);
        } else {
          ctx.rect(ex - bw * 0.5, ey - bh * 0.5, bw, bh);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(edgeText, ex, ey + 0.5 * dpr);

        // Directional chevron outside the pill pointing toward the off-screen target
        const arrowDist = Math.max(bw, bh) * 0.5 + 8 * dpr;
        const ax = ex + Math.cos(ang) * arrowDist;
        const ay = ey + Math.sin(ang) * arrowDist;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.fillStyle = color;
        const sz = Math.max(5.5, 6.5 * dpr);
        ctx.beginPath();
        ctx.moveTo(sz, 0);
        ctx.lineTo(-sz * 0.65, -sz * 0.65);
        ctx.lineTo(-sz * 0.3, 0);
        ctx.lineTo(-sz * 0.65, sz * 0.65);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
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
    const dpr = this._cachedDpr || 1;
    const padX = Math.round(28 * dpr);
    const padTop = Math.round(86 * dpr);
    const padBot = Math.round((cw < ch ? 220 : 120) * dpr);
    const clampedX = Math.max(padX, Math.min(cw - padX, ax));
    const clampedY = Math.max(padTop, Math.min(ch - padBot, ay));

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

  _drawAscentCoach(ctx, diver, diveState, checkpointsHit, toScreenX, toScreenY, scale, nextCheckpoint = null, timeSec = 0) {
    const ascentCfg = getAscentConfig(this.level);
    const ascending = Boolean(checkpointsHit && checkpointsHit.has(ascentCfg.turnaroundId));
    const ascentStep = getAscentInstruction(diveState, diver.y, checkpointsHit, ascentCfg, nextCheckpoint);
    const gasCoach = getGasSwitchCoach(diveState, diver.y, { ascending });
    const step = gasCoach && (gasCoach.severity === 'danger' || !ascentStep) ? gasCoach : ascentStep;
    if (!step) return;

    const sx = toScreenX(diver.x);
    const sy = toScreenY(diver.y);
    const pillY = sy - 1.65 * scale;

    ctx.save();
    const isDanger = step.severity === 'danger';
    const isStop = step.action === 'STOP';
    const pulse = 0.65 + 0.35 * Math.sin(timeSec * (isDanger ? 10 : 5.5));

    // Soft indicator ring around diver when breathing an unsafe/wrong gas (refined v193–v194)
    if (gasCoach && step === gasCoach) {
      ctx.strokeStyle = isDanger ? `rgba(248, 113, 113, ${(0.28 + pulse * 0.28).toFixed(2)})` : `rgba(251, 191, 36, ${(0.18 + pulse * 0.18).toFixed(2)})`;
      ctx.lineWidth = isDanger ? 1.8 : 1.25;
      ctx.beginPath();
      ctx.arc(sx, sy, (1.08 + (isDanger ? 0.08 * pulse : 0.04 * pulse)) * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Deduplicate floating diver pill when diver is already next to a visible depth gas-switch line (v194)
    const nearSwitchLine =
      Math.abs((diver.y || 0) - 22.0) <= 3.8 ||
      (Array.isArray(this.level?.zoneLines) && this.level.zoneLines.some((z) => Math.abs((diver.y || 0) - (z.y || 0)) <= 3.0));
    const suppressRedundantPill = Boolean(gasCoach && step === gasCoach && !isDanger && nearSwitchLine);

    if (!suppressRedundantPill) {
      // Compact quiet floating micro-badge above diver (v193–v194)
      const label = (gasCoach && step === gasCoach && !isDanger && step.gasName)
        ? `Switch ${step.gasName}${step.hotkey ? ` [${step.hotkey}]` : ''}`
        : (step.shortLabel || (isStop ? `■ ${step.title}` : `▲ ${step.title}`));
      ctx.font = `700 ${Math.max(9.5, Math.round((isDanger ? 0.29 : 0.26) * scale))}px ui-monospace, monospace`;
      const padX = 8;
      const textW = ctx.measureText(label).width;
      const boxW = textW + padX * 2;
      const boxH = Math.max(18, 0.52 * scale);

      ctx.fillStyle = isDanger
        ? 'rgba(69, 10, 10, 0.84)'
        : isStop
          ? 'rgba(15, 23, 42, 0.78)'
          : 'rgba(8, 28, 48, 0.76)';
      ctx.strokeStyle = isDanger ? 'rgba(248, 113, 113, 0.78)' : isStop ? 'rgba(251, 191, 36, 0.55)' : 'rgba(56, 189, 248, 0.52)';
      ctx.lineWidth = isDanger ? 1.4 : 1.05;
      ctx.beginPath();
      ctx.roundRect(sx - boxW * 0.5, pillY - boxH * 0.5, boxW, boxH, 999);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isDanger ? '#fef2f2' : isStop ? '#fde68a' : '#e0f2fe';
      ctx.fillText(label, sx, pillY + 0.5);
    }

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

  /**
   * Draws tight-squeeze tank-scrape limestone/rust dust flakes & tactile "Hand-on-the-Line"
   * luminescent guideline grip feedback during zero-visibility silt-outs (v168).
   */
  _drawTactileSqueezeAndLineFeel(ctx, diver, squeezeDust, handOnLinePt, localSiltDensity, toScreenX, toScreenY, scale, timeSec) {
    ctx.save();
    if (Array.isArray(squeezeDust) && squeezeDust.length > 0) {
      for (let i = 0; i < squeezeDust.length; i++) {
        const p = squeezeDust[i];
        const alpha = Math.max(0, Math.min(0.85, (p.life / (p.maxLife || 1.5)) * 0.8));
        ctx.fillStyle = p.isRust
          ? `rgba(194, 98, 52, ${alpha.toFixed(3)})`
          : `rgba(226, 214, 192, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(toScreenX(p.x), toScreenY(p.y), Math.max(1.2, p.r * scale), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (handOnLinePt && diver) {
      const dx = toScreenX(diver.x);
      const dy = toScreenY(diver.y);
      const lx = toScreenX(handOnLinePt.x);
      const ly = toScreenY(handOnLinePt.y);
      const ax = toScreenX(handOnLinePt.prevX);
      const ay = toScreenY(handOnLinePt.prevY);
      const bx = toScreenX(handOnLinePt.nextX);
      const by = toScreenY(handOnLinePt.nextY);
      const pulse = 0.65 + 0.35 * Math.sin(timeSec * 5.2);
      const siltGain = Math.min(1, Math.max(0.45, ((localSiltDensity || 0.4) - 0.25) * 1.8));

      // Glowing tactile segment of the guideline cutting cleanly through silt fog
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = `rgba(250, 204, 21, ${(0.32 * siltGain * pulse).toFixed(3)})`;
      ctx.lineWidth = Math.max(5, 0.24 * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();

      ctx.strokeStyle = `rgba(254, 240, 138, ${(0.92 * siltGain).toFixed(3)})`;
      ctx.lineWidth = Math.max(2, 0.065 * scale);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();

      // Tactile OK-grip tether line from diver to closest point on line
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = `rgba(253, 224, 71, ${(0.68 * siltGain).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.2, 0.04 * scale);
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.setLineDash([]);

      // Glowing contact ring on the line (diegetic visual only, no floating text clutter)
      ctx.fillStyle = `rgba(254, 249, 195, ${(0.9 * pulse).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(lx, ly, Math.max(3, 0.12 * scale), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Living Topside Entry & Extraction Atmosphere (v169):
   * - Shipwrecks: Bobbing Diver-Down Float Buoy & taut weighted descent shot-line with 6m O2 deco ring.
   * - Cenotes/Karst: Overhanging banyan/jungle canopy roots, swaying lianas & drifting surface leaves.
   * - Arctic/Glacial: Translucent bobbing sea-ice floes with turquoise submerged keels & polar aurora ribbons.
   */
  _drawTopsideAtmosphereExtras(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec) {
    return drawTopsideAtmosphereExtras(this, ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec);
  }

  /**
   * AAA Underwater Lighting Pass (v169):
   * 1. Torch-Beam Volumetric Marine Snow / Rust Motes (deterministic spatial hash, 0 allocations/frame)
   * 2. Sunlit Shallow Caustic Shimmer Filaments
   * 3. Bioluminescent Fin-Wake Plankton Sparks in Night-Dive / Bioluminescent biomes
   */
  _drawTorchMarineSnowAndCaustics(ctx, diver, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, weatherCaustics = 1, hazards = null, cw = 1280) {
    if (!diver) return;
    const isWreck = Boolean(this.level.isWreck);
    const isPolar = /arctic|ice|glacier|orda|strytan|greenland/i.test(this.level.name || "");
    const isThermal = /strytan|katla|thermal|volcan|kverk|grjotagja/i.test(this.level.id || this.level.name || "");
    const isRedSea = /dahab|blue-hole|red sea|thistlegorm/i.test(this.level.id || this.level.name || "");
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // 1. Rippling Shallow Solar Caustic Web Filaments in sunlit entry water
    if (visY0 < 17 && weatherCaustics > 0.14) {
      const cAlpha = Math.min(0.26, weatherCaustics * 0.22);
      ctx.strokeStyle = isWreck ? `rgba(125, 211, 252, ${cAlpha.toFixed(3)})` : `rgba(165, 243, 252, ${cAlpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(1, 0.045 * scale);
      for (const basin of this.level.openBasins || []) {
        if (basin.xMax + 6 < visX0 || basin.xMin - 6 > visX1) continue;
        const bx0 = Math.max(visX0, basin.xMin - 2);
        const bx1 = Math.min(visX1, basin.xMax + 2);
        for (let row = 1; row <= 5; row++) {
          const wy = row * 2.5;
          if (wy < visY0 - 2 || wy > visY1 + 2) continue;
          const depthFade = Math.max(0, 1 - wy / 16);
          if (depthFade <= 0.05) continue;
          ctx.globalAlpha = depthFade;
          ctx.beginPath();
          let first = true;
          for (let wx = bx0; wx <= bx1; wx += 0.9) {
            const ripple = Math.sin(wx * 0.85 + timeSec * 1.9 + row * 1.3) * 0.34 + Math.cos(wx * 1.45 - timeSec * 1.4 + row) * 0.18;
            const sx = toScreenX(wx);
            const sy = toScreenY(wy + ripple);
            if (first) { ctx.moveTo(sx, sy); first = false; } else { ctx.lineTo(sx, sy); }
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // 2. Ambient Drifting Torch-Reactive Plankton & Cave Dust Motes (v193 zero-GC spatial hash)
    if (!this._reducedMotion) {
      const cell = this._isCoarseMobile ? 5.6 : 4.4;
      const gx0 = Math.floor(visX0 / cell);
      const gx1 = Math.ceil(visX1 / cell);
      const gy0 = Math.max(0, Math.floor(Math.max(0.4, visY0) / cell));
      const gy1 = Math.ceil(visY1 / cell);
      const torchOn = diver.torchOn !== false;
      const tox = diver.body?.hand ? diver.body.hand.x : diver.x;
      const toy = diver.body?.hand ? diver.body.hand.y : diver.y;
      const tang = Number.isFinite(diver.torchAngle) ? diver.torchAngle : (diver.angle || 0);
      const tfx = Math.cos(tang);
      const tfy = Math.sin(tang);
      const bokehStamp = isThermal || isRedSea ? (this.glowStamps?.warm || this.glowStamps?.cyan) : this.glowStamps?.cyan;
      const ambientFill = isThermal
        ? 'rgba(253, 186, 116, 0.24)'
        : isPolar
          ? 'rgba(186, 230, 253, 0.24)'
          : isRedSea
            ? 'rgba(254, 240, 138, 0.22)'
            : 'rgba(125, 211, 252, 0.21)';
      const litFill = isThermal
        ? 'rgba(254, 215, 170, 0.68)'
        : isRedSea
          ? 'rgba(254, 249, 195, 0.68)'
          : 'rgba(224, 242, 254, 0.66)';
      const litScratch = this._ambientLitMotesScratch || (this._ambientLitMotesScratch = []);
      litScratch.length = 0;

      ctx.fillStyle = ambientFill;
      ctx.beginPath();
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gy = gy0; gy <= gy1; gy++) {
          for (let k = 0; k < 2; k++) {
            const h1 = Math.sin(gx * 157.3 + gy * 289.1 + k * 61.7) * 43758.5453;
            const r1 = h1 - Math.floor(h1);
            const h2 = Math.sin(gx * 241.9 + gy * 131.7 + k * 93.1) * 43758.5453;
            const r2 = h2 - Math.floor(h2);
            const phase = r1 * 6.28318;
            const wx = (gx + r1) * cell + Math.sin(timeSec * (0.42 + r2 * 0.28) + phase) * 0.34;
            const wy = (gy + r2) * cell + Math.cos(timeSec * (0.36 + r1 * 0.24) + phase) * 0.24;
            if (wy < 0.45) continue;
            const sx = toScreenX(wx);
            const sy = toScreenY(wy);
            const baseR = Math.max(0.95, (0.024 + r2 * 0.026) * scale);
            let torchBoost = 0;
            if (torchOn) {
              const dx = wx - tox;
              const dy = wy - toy;
              const dSq = dx * dx + dy * dy;
              if (dSq > 0.36 && dSq < 196) {
                const dist = Math.sqrt(dSq);
                const dot = (dx * tfx + dy * tfy) / dist;
                if (dot > 0.72) {
                  torchBoost = ((dot - 0.72) / 0.28) * Math.max(0, 1 - dist / 14);
                }
              }
            }
            if (torchBoost > 0.14) {
              litScratch.push(sx, sy, baseR * (1.25 + torchBoost * 0.55), torchBoost);
            } else {
              ctx.moveTo(sx + baseR, sy);
              ctx.arc(sx, sy, baseR, 0, Math.PI * 2);
            }
          }
        }
      }
      ctx.fill();

      if (litScratch.length > 0) {
        if (bokehStamp) {
          for (let i = 0; i < litScratch.length; i += 4) {
            const sx = litScratch[i];
            const sy = litScratch[i + 1];
            const mr = litScratch[i + 2];
            const boost = litScratch[i + 3];
            const br = Math.max(3.2, mr * 3.4);
            ctx.globalAlpha = Math.min(0.38, boost * 0.34);
            ctx.drawImage(bokehStamp, sx - br, sy - br, br * 2, br * 2);
          }
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = litFill;
        ctx.beginPath();
        for (let i = 0; i < litScratch.length; i += 4) {
          const sx = litScratch[i];
          const sy = litScratch[i + 1];
          const mr = litScratch[i + 2];
          ctx.moveTo(sx + mr, sy);
          ctx.arc(sx, sy, mr, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }

    // 2b. World-Reactive Special Torch Optic FX inside the active ray-cast beam cone (v212)
    const diverPal = diver.livery ? resolveDiverLiveryPalette(diver.livery) : null;
    if (diverPal?.torchFx) this._drawWorldSpecialTorchFx?.(ctx, diver, diverPal, toScreenX, toScreenY, scale, timeSec);

    // 3. Bioluminescent / Special-Gear Fin-Wake Sparks directly behind articulated fin tips (v119 / v212)
    const wakeProf = diverPal?.wakeProfile || null;
    const bioActive = Boolean(this.level.theme?.bioluminescent || this._activeWeather?.forceBiolum || wakeProf?.active);
    if (bioActive && diver.body?.legs && diver.y > 1.0) {
      const spd = Math.hypot(diver.vx || 0, diver.vy || 0);
      if (spd > 0.25) {
        const bx = -Math.cos(diver.angle || 0);
        const by = -Math.sin(diver.angle || 0);
        const inten = Math.min(1, spd * 0.45);
        for (let li = 0; li < diver.body.legs.length; li++) {
          const tip = diver.body.legs[li].finTip;
          if (!tip) continue;
          for (let k = 0; k < 5; k++) {
            const t = (k + ((timeSec * 3.8 + li * 0.5) % 1)) * 0.34;
            const px = tip.x + bx * t * 1.45 + Math.sin(timeSec * 5 + k * 2.1 + li) * 0.18;
            const py = tip.y + by * t * 1.45 + Math.cos(timeSec * 4.4 + k * 1.9) * 0.15 - (wakeProf?.rising ? t * 0.36 : 0);
            const a = Math.max(0, (1 - k / 5) * (wakeProf?.isSetAura ? 0.85 : 0.72) * inten);
            if (wakeProf?.active) {
              const hue = wakeProf.prism
                ? Math.round((timeSec * 120 + k * 48 + li * 60) % 360)
                : (k % 2 === 0 ? wakeProf.hueA : wakeProf.hueB);
              ctx.fillStyle = `hsla(${hue}, 96%, 72%, ${a.toFixed(3)})`;
            } else {
              ctx.fillStyle = k % 2 === 0 ? `rgba(56, 232, 255, ${a.toFixed(3)})` : `rgba(110, 231, 183, ${(a * 0.85).toFixed(3)})`;
            }
            ctx.beginPath();
            ctx.arc(toScreenX(px), toScreenY(py), Math.max(1.3, (0.065 - k * 0.008) * scale), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // 4. Foreground Halocline Refractive Crossing Shimmer (v193 — luminous optical shear when passing freshwater/saltwater boundary)
    const effectiveHaloY = Number.isFinite(this.level.haloclineY)
      ? this.level.haloclineY
      : hazards?.halocline?.enabled
        ? hazards.halocline.depthM
        : NaN;
    if (Number.isFinite(effectiveHaloY)) {
      const haloDist = Math.abs((diver.y || 0) - effectiveHaloY);
      if (haloDist < 2.6) {
        const proximity = 1 - haloDist / 2.6;
        const haloSy = toScreenY(effectiveHaloY);
        const bandPx = Math.max(14, 1.5 * scale);
        if (this.glowStamps?.bandGlow) {
          ctx.globalAlpha = proximity * 0.34;
          ctx.drawImage(this.glowStamps.bandGlow, 0, haloSy - bandPx, cw, bandPx * 2);
        }
        const stepPx = Math.max(20, Math.round(cw / 24));
        ctx.lineWidth = Math.max(1, 0.045 * scale);
        for (let r = 0; r < 2; r++) {
          ctx.strokeStyle = r === 0
            ? `rgba(186, 230, 253, ${(proximity * 0.32).toFixed(3)})`
            : `rgba(94, 234, 212, ${(proximity * 0.24).toFixed(3)})`;
          ctx.beginPath();
          const yOff = (r === 0 ? -0.22 : 0.26) * scale;
          for (let sx = 0; sx <= cw + stepPx; sx += stepPx) {
            const wy = haloSy + yOff + Math.sin(sx * 0.018 + timeSec * (r === 0 ? 2.4 : -1.9) + r * 2.1) * (0.14 * scale);
            if (sx === 0) ctx.moveTo(sx, wy);
            else ctx.lineTo(sx, wy);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }

  _drawCollectibles(ctx, visX0, visX1, toScreenX, toScreenY, scale, collectedIds, timeSec, diver = null) {
    const list = this.level.collectibles;
    if (!list || list.length === 0) return;
    ctx.save();
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (collectedIds && collectedIds.has(item.id)) continue;
      if (item.x < visX0 - 4 || item.x > visX1 + 4) continue;

      const bobY = Math.sin(timeSec * 2.1 + i * 1.4) * 0.13;
      const sx = toScreenX(item.x);
      const sy = toScreenY(item.y + bobY);
      const itemScale = item.scale || 1.0;
      const isGrand = itemScale >= 1.35;
      const pulse = 0.86 + 0.14 * Math.sin(timeSec * 3.8 + i);
      const r = 0.48 * scale * itemScale;

      // Tactile diegetic proximity focus halo when diver swims within 5.8m of an artifact (v204 AAA Polish Wave 2)
      if (diver && Number.isFinite(diver.x) && Number.isFinite(diver.y)) {
        const dDist = Math.hypot(item.x - diver.x, item.y - diver.y);
        if (dDist < 5.8) {
          const prox = Math.max(0, Math.min(1, 1 - dDist / 5.8));
          const ringR = r * (1.85 - prox * 0.32) + Math.sin(timeSec * 6.5 + i) * 2.2;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(timeSec * 0.95 + i);
          ctx.strokeStyle = isGrand
            ? `rgba(254, 240, 138, ${(0.28 + prox * 0.56).toFixed(3)})`
            : `rgba(125, 211, 252, ${(0.24 + prox * 0.52).toFixed(3)})`;
          ctx.lineWidth = Math.max(1.2, 0.055 * scale);
          ctx.setLineDash([Math.max(4, ringR * 0.42), Math.max(4, ringR * 0.36)]);
          ctx.beginPath();
          ctx.arc(0, 0, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      const vis = classifyArtifactVisual(item);
      const stamp =
        vis.glow === 'warm'
          ? this.glowStamps.warm
          : vis.glow === 'magenta'
            ? this.glowStamps.magenta
            : vis.glow === 'emerald'
              ? this.glowStamps.emerald
              : this.glowStamps.cyan;
      if (stamp) {
        const gs = r * (isGrand ? 4.8 : 3.9) * pulse;
        ctx.drawImage(stamp, sx - gs * 0.5, sy - gs * 0.5, gs, gs);
      }

      if (isGrand) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(timeSec * 0.36 + i);
        ctx.globalCompositeOperation = 'screen';
        for (let ray = 0; ray < 6; ray++) {
          const ang = (ray / 6) * Math.PI * 2;
          ctx.fillStyle = 'rgba(254, 240, 138, 0.16)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang - 0.08) * r * 1.9 * pulse, Math.sin(ang - 0.08) * r * 1.9 * pulse);
          ctx.lineTo(Math.cos(ang + 0.08) * r * 1.9 * pulse, Math.sin(ang + 0.08) * r * 1.9 * pulse);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      drawStyledArtifact(ctx, item, sx, sy, r, timeSec, { index: i, isGrand });
    }
    ctx.restore();
  }

  _drawBuddyRescueTethers(ctx, diver, peerList, toScreenX, toScreenY, scale, timeSec, airShareBeams = null) {
    if (!Array.isArray(peerList) || peerList.length === 0) return;
    ctx.save();
    const allDivers = [
      { id: diver.id || '__self__', x: diver.x, y: diver.y, name: diver.name || 'You', alive: true, rescueTargetId: diver.rescueTargetId || '' },
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
      ctx.strokeStyle = p.rescuedBy ? 'rgba(74, 222, 128, 0.78)' : 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = Math.max(1.8, 0.065 * scale);
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `800 ${Math.max(9, Math.round(0.32 * scale))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = p.rescuedBy ? '#86efac' : '#fde68a';
      ctx.fillText(p.rescuedBy ? '🛟 TOWING' : 'SOS · RESCUE', sx, sy - r - 0.25 * scale);
    }

    // 2. Braided catenary umbilical tow line between rescuer and towed teammate
    // 1b. Hardcore AI Wingman Leadership / Issue Beacon & Guided Pro Guide Halo (v157/v158)
    for (let i = 0; i < peerList.length; i++) {
      const p = peerList[i];
      if (!p || p.alive === false || p.surfaced) continue;
      if (!p.issue && !p.separated) {
        if (p.isAiBuddy && (p.condition === 'SAFETY GUARD' || p.condition === 'DECO PACE')) {
          const sx = toScreenX(p.x);
          const sy = toScreenY(p.y);
          const pulse = 0.55 + 0.45 * Math.sin(timeSec * 4.2 + i);
          const r = (1.02 + pulse * 0.16) * scale;
          const isGuard = p.condition === 'SAFETY GUARD';
          ctx.strokeStyle = isGuard ? 'rgba(52, 211, 153, 0.78)' : 'rgba(56, 189, 248, 0.65)';
          ctx.lineWidth = Math.max(1.5, 0.05 * scale);
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = `800 ${Math.max(9, Math.round(0.28 * scale))}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.fillStyle = isGuard ? '#a7f3d0' : '#bae6fd';
          ctx.fillText(isGuard ? '🛡️ SAFETY GUARD' : '🛡️ DECO PACE', sx, sy - r - 0.26 * scale);
        }
        continue;
      }
      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      const pulse = 0.55 + 0.45 * Math.sin(timeSec * 5.8 + i);
      const r = (1.05 + pulse * 0.25) * scale;
      const isCrit = p.issue && (p.issue.kind === 'snagged' || p.issue.kind === 'low-gas' || (p.issue.countdownSec || 99) < 15);
      ctx.strokeStyle = isCrit ? 'rgba(248, 113, 113, 0.85)' : 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = Math.max(1.8, 0.06 * scale);
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const prog = Math.max(0, Math.min(1, Number(p.issue?.progress) || 0));
      if (prog > 0.02) {
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = Math.max(2.6, 0.085 * scale);
        ctx.beginPath();
        ctx.arc(sx, sy, r + 0.14 * scale, -Math.PI * 0.5, -Math.PI * 0.5 + prog * Math.PI * 2);
        ctx.stroke();
      }
      ctx.font = `800 ${Math.max(9, Math.round(0.31 * scale))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = isCrit ? '#fecaca' : '#fde68a';
      const baseLbl = p.issue ? (p.issue.hudLabel || p.issue.condition) : '🧭 SEPARATED · LEAD';
      const pctSuffix = p.issue && prog > 0.02 ? ` ${Math.round(prog * 100)}%` : '';
      ctx.fillText(`${baseLbl}${pctSuffix}`, sx, sy - r - 0.3 * scale);
    }
    for (let i = 0; i < allDivers.length; i++) {
      const rescuer = allDivers[i];
      if (!rescuer?.rescueTargetId) continue;
      const target = peerList.find((p) => p && p.id === rescuer.rescueTargetId);
      const tPos = target || (rescuer !== allDivers[0] && diver.rescuedBy === rescuer.id ? diver : null);
      if (!tPos) continue;
      const x1 = toScreenX(rescuer.x);
      const y1 = toScreenY(rescuer.y);
      const x2 = toScreenX(tPos.x);
      const y2 = toScreenY(tPos.y);
      const mx = (x1 + x2) * 0.5;
      const my = (y1 + y2) * 0.5 + (0.28 + 0.09 * Math.sin(timeSec * 4.2)) * scale;

      ctx.strokeStyle = 'rgba(250, 204, 21, 0.28)';
      ctx.lineWidth = Math.max(4.5, 0.16 * scale);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.stroke();

      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = Math.max(2, 0.075 * scale);
      ctx.setLineDash([7, 4]);
      ctx.lineDashOffset = -timeSec * 18;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      // Carabiner clip rings at both diver harness attachment points
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(x1, y1, Math.max(2.6, 0.08 * scale), 0, Math.PI * 2);
      ctx.arc(x2, y2, Math.max(2.6, 0.08 * scale), 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Active Air-Share 2m Braided Yellow Primary-Donate Long Hose (upgraded v151)
    if (Array.isArray(airShareBeams) && airShareBeams.length > 0) {
      for (let i = 0; i < airShareBeams.length; i++) {
        const b = airShareBeams[i];
        if (!b || b.timer <= 0) continue;
        const peer = peerList.find((p) => p && (p.id === b.peerId || p.name === b.peerName));
        if (!peer) continue;
        const donor = b.fromSelf ? diver : peer;
        const recv = b.fromSelf ? peer : diver;
        const x1 = toScreenX(donor.x);
        const y1 = toScreenY(donor.y);
        const x2 = toScreenX(recv.x);
        const y2 = toScreenY(recv.y);
        const alpha = Math.min(1, b.timer / 0.55) * Math.min(1, ((b.duration || 2.6) - b.timer) / 0.18 + 0.25);
        const mx = (x1 + x2) * 0.5;
        const my = (y1 + y2) * 0.5 + 0.42 * scale + Math.sin(timeSec * 3.6 + i) * 0.06 * scale;

        // Soft underwater glow halo around high-vis safety-yellow primary-donate hose
        ctx.strokeStyle = `rgba(250, 204, 21, ${(0.24 * alpha).toFixed(3)})`;
        ctx.lineWidth = Math.max(6, 0.22 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();

        // Dark rubber outer jacket border
        ctx.strokeStyle = `rgba(15, 23, 42, ${(0.88 * alpha).toFixed(3)})`;
        ctx.lineWidth = Math.max(3.6, 0.13 * scale);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();

        // High-visibility safety-yellow braided long-hose core
        ctx.strokeStyle = `rgba(250, 204, 21, ${(0.95 * alpha).toFixed(3)})`;
        ctx.lineWidth = Math.max(2.1, 0.075 * scale);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();

        // Subtle braided weave dash highlight along the hose
        ctx.save();
        ctx.setLineDash([Math.max(3, 0.12 * scale), Math.max(3, 0.12 * scale)]);
        ctx.strokeStyle = `rgba(254, 249, 195, ${(0.75 * alpha).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.1, 0.035 * scale);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();
        ctx.restore();

        // Brass 1st-stage swivel fitting (donor) & yellow 2nd-stage octo housing (receiver)
        ctx.fillStyle = `rgba(217, 119, 6, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x1, y1, Math.max(2.6, 0.095 * scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(250, 204, 21, ${alpha.toFixed(3)})`;
        ctx.strokeStyle = `rgba(15, 23, 42, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x2, y2, Math.max(3.0, 0.11 * scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Flowing pressurized gas pulses + twin synced regulator exhaust bubble wisps
        for (let k = 0; k < 4; k++) {
          const u = ((timeSec * 1.45 + k * 0.25) % 1);
          const inv = 1 - u;
          const px = inv * inv * x1 + 2 * inv * u * mx + u * u * x2;
          const py = inv * inv * y1 + 2 * inv * u * my + u * u * y2;
          ctx.fillStyle = `rgba(240, 249, 255, ${(0.92 * alpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(px, py, Math.max(2.1, 0.075 * scale), 0, Math.PI * 2);
          ctx.fill();
        }
        for (let p = 0; p < 3; p++) {
          const rise = ((timeSec * 1.6 + p * 0.33) % 1);
          const rBub = Math.max(1.4, (0.045 + rise * 0.03) * scale);
          const bAlpha = (1 - rise) * 0.65 * alpha;
          ctx.fillStyle = `rgba(224, 242, 254, ${bAlpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x2 + Math.sin(timeSec * 4 + p) * 0.1 * scale, y2 - rise * 0.65 * scale, rBub, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.font = `800 ${Math.max(10, Math.round(0.34 * scale))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(254, 249, 195, ${alpha.toFixed(3)})`;
        ctx.fillText(`🟡 LONG-HOSE +${b.amountBar}b`, mx, my - 0.32 * scale);
      }
    }
    ctx.restore();
  }

  _drawBuddyLocatePing(ctx, diver, buddyPing, toScreenX, toScreenY, scale, timeSec, cw, ch) {
    if (!buddyPing || buddyPing.timer <= 0) return;
    const dur = Math.max(0.5, buddyPing.duration || 4.6);
    const fade = Math.min(1, buddyPing.timer / 0.85);
    const dx = toScreenX(diver.x);
    const dy = toScreenY(diver.y);
    const bx = toScreenX(buddyPing.x);
    const by = toScreenY(buddyPing.y);
    const distM = Math.round(Math.hypot(buddyPing.x - diver.x, buddyPing.y - diver.y));

    ctx.save();
    // 1. Acoustic bearing line from self diver toward pinged buddy (visible through walls & silt)
    const grad = ctx.createLinearGradient(dx, dy, bx, by);
    grad.addColorStop(0, `rgba(56, 189, 248, ${(0.12 * fade).toFixed(3)})`);
    grad.addColorStop(0.55, `rgba(56, 189, 248, ${(0.52 * fade).toFixed(3)})`);
    grad.addColorStop(1, `rgba(251, 191, 36, ${(0.88 * fade).toFixed(3)})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(1.8, 0.065 * scale);
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -timeSec * 34;
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // 2. Expanding concentric sonar target rings centered on buddy
    for (let rIdx = 0; rIdx < 2; rIdx++) {
      const phase = ((dur - buddyPing.timer) * 1.15 + rIdx * 0.5) % 1;
      const rad = (0.7 + phase * 2.8) * scale;
      const ringAlpha = (1 - phase) * 0.82 * fade;
      ctx.strokeStyle = `rgba(251, 191, 36, ${ringAlpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(1.8, 0.07 * scale);
      ctx.beginPath();
      ctx.arc(bx, by, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Floating clamped locator badge (stays onscreen at edge when buddy is far away)
    const padX = Math.max(66, cw * 0.08);
    const padY = Math.max(92, ch * 0.14);
    const lx = Math.max(padX, Math.min(cw - padX, bx));
    const ly = Math.max(padY, Math.min(ch - padY, by - 1.35 * scale));
    const label = `📡 ${buddyPing.targetName || 'Buddy'} · ${distM}m`;
    ctx.font = `800 ${Math.max(11, Math.round(0.36 * scale))}px ui-monospace, monospace`;
    const tw = ctx.measureText(label).width;
    const pw = tw + 18;
    const ph = Math.max(22, Math.round(0.68 * scale));
    ctx.fillStyle = `rgba(8, 20, 36, ${(0.92 * fade).toFixed(3)})`;
    ctx.strokeStyle = `rgba(251, 191, 36, ${(0.88 * fade).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(lx - pw / 2, ly - ph / 2, pw, ph, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgba(254, 243, 199, ${fade.toFixed(3)})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, ly + 0.5);
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

      // Catenary braided recovery tow bridle + stainless shackle carabiners
      const midTowX = (cx + tx) * 0.5;
      const midTowY = (cy + ty) * 0.5 + 0.22 * scale + Math.sin(timeSec * 3.1) * 0.05 * scale;
      ctx.strokeStyle = rt.kind === 'probe' ? 'rgba(94, 234, 212, 0.92)' : 'rgba(251, 191, 36, 0.92)';
      ctx.lineWidth = Math.max(1.6, 0.06 * scale);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(midTowX, midTowY, tx, ty);
      ctx.stroke();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = Math.max(1.2, 0.048 * scale);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.8, 0.075 * scale), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(1.8, 0.075 * scale), 0, Math.PI * 2);
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

      // Soft feathered hydrothermal convection plume puffs via pre-baked glowStamps (0 gradients/frame)
      const cyanStamp = this.glowStamps.cyan;
      const warmStamp = this.glowStamps.warm;
      if (cyanStamp && warmStamp) {
        const puffCount = 6;
        for (let p = 0; p < puffCount; p++) {
          const t = p / (puffCount - 1);
          const py = toScreenY(v.y - 1.2 - t * (height * 0.88));
          const swayX = sx + Math.sin(timeSec * 2.4 - t * 3.6 + vIdx * 1.7) * (0.18 + t * 0.65) * scale;
          const rx = (0.75 + t * hw * 0.52) * scale;
          const ry = (1.6 + t * 1.9) * scale;
          const fade = Math.max(0, 1 - t * 0.9);
          ctx.globalAlpha = (t < 0.25 ? 0.34 : 0.22) * fade;
          ctx.drawImage(t < 0.25 ? warmStamp : cyanStamp, swayX - rx, py - ry, rx * 2, ry * 2);
        }
        ctx.globalAlpha = 1;
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

      // Glowing magma vent fissure halo + inner molten cracks via pre-baked warmStamp
      const glowPulse = 0.74 + 0.26 * Math.sin(timeSec * 4.4 + vIdx * 2.1);
      if (warmStamp) {
        const gr = 2.9 * scale;
        ctx.globalAlpha = 0.92 * glowPulse;
        ctx.drawImage(warmStamp, sx - gr, throatY - gr, gr * 2, gr * 2);
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = `rgba(253, 186, 116, ${(0.82 * glowPulse).toFixed(2)})`;
      ctx.lineWidth = Math.max(1.2, 0.055 * scale);
      ctx.beginPath();
      ctx.moveTo(sx - 0.38 * scale, throatY + 0.05 * scale);
      ctx.lineTo(sx - 0.08 * scale, throatY - 0.08 * scale);
      ctx.lineTo(sx + 0.28 * scale, throatY + 0.04 * scale);
      ctx.moveTo(sx - 0.12 * scale, throatY + 0.12 * scale);
      ctx.lineTo(sx + 0.08 * scale, throatY + 0.55 * scale);
      ctx.stroke();

      // Precompute ceiling clamp once per vent (eliminates 14 static SDF calls/vent/frame)
      let ceilY = this._ventCeilingCache.get(vIdx);
      if (ceilY === undefined) {
        ceilY = v.y - height;
        for (let step = 1.0; step <= height; step += 0.6) {
          if (evaluateCaveSDF(this.level, v.x, v.y - step) >= -0.25) {
            ceilY = v.y - step + 0.35;
            break;
          }
        }
        this._ventCeilingCache.set(vIdx, ceilY);
      }

      // Rising mineral bubbles & glowing thermal embers inside the updraft column
      for (let b = 0; b < 14; b++) {
        const phase = ((timeSec * (0.42 + (b % 3) * 0.14) + vIdx * 0.31 + b / 14) % 1);
        const by = v.y - 1.0 - phase * height;
        if (by <= ceilY) continue;
        const bx = v.x + Math.sin(phase * 9.0 + b * 2.1 + timeSec * 2.5) * hw * (0.26 + phase * 0.36);
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

  _ensureBiolumMotes() {
    if (this._biolumMotes) return this._biolumMotes;
    const motes = [];
    const { xMin, xMax, yMax } = this.level.bounds;
    if (yMax >= 34) {
      const cellSize = 10;
      const cx0 = Math.floor(xMin / cellSize);
      const cx1 = Math.ceil(xMax / cellSize);
      const cy0 = Math.floor(34 / cellSize);
      const cy1 = Math.ceil(yMax / cellSize);
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cy = cy0; cy <= cy1; cy++) {
          for (let k = 0; k < 6; k++) {
            const h1 = Math.sin(cx * 127.1 + cy * 311.7 + k * 74.7) * 43758.5453;
            const r1 = h1 - Math.floor(h1);
            const h2 = Math.sin(cx * 269.5 + cy * 183.3 + k * 41.9) * 43758.5453;
            const r2 = h2 - Math.floor(h2);
            const bx = (cx + r1) * cellSize;
            const by = (cy + r2) * cellSize;
            if (by < 34 || evaluateCaveSDF(this.level, bx, by) >= -0.45) continue;
            motes.push({ bx, by, r1, r2, k, isTeal: (k & 1) === 0 });
          }
        }
      }
    }
    this._biolumMotes = motes;
    return motes;
  }

  _ensureShallowBiolumMotes() {
    if (this._shallowBiolumMotes) return this._shallowBiolumMotes;
    const motes = [];
    const { xMin, xMax, yMax } = this.level.bounds;
    const maxShallowY = Math.min(34, yMax);
    const cellSize = 8;
    const cx0 = Math.floor(xMin / cellSize);
    const cx1 = Math.ceil(xMax / cellSize);
    const cy0 = 0;
    const cy1 = Math.ceil(maxShallowY / cellSize);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let k = 0; k < 5; k++) {
          const h1 = Math.sin(cx * 151.3 + cy * 277.9 + k * 63.1) * 43758.5453;
          const r1 = h1 - Math.floor(h1);
          const h2 = Math.sin(cx * 211.7 + cy * 197.3 + k * 53.7) * 43758.5453;
          const r2 = h2 - Math.floor(h2);
          const bx = (cx + r1) * cellSize;
          const by = (cy + r2) * cellSize;
          if (by < 1.8 || by >= 34 || evaluateCaveSDF(this.level, bx, by) >= -0.45) continue;
          motes.push({ bx, by, r1, r2, k, isTeal: (k & 1) === 0 });
        }
      }
    }
    this._shallowBiolumMotes = motes;
    return motes;
  }

  _drawBioluminescence(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec) {
    const nightBiolum = Boolean(this._activeWeather?.forceBiolum);
    if (!nightBiolum && visY1 < 34) return;
    if (nightBiolum && visY1 < 1.5) return;
    const deepMotes = visY1 >= 34 ? this._ensureBiolumMotes() : [];
    const shallowMotes = nightBiolum && visY0 < 34 ? this._ensureShallowBiolumMotes() : [];
    if (!deepMotes.length && !shallowMotes.length) return;
    const cyanStamp = this.glowStamps.cyan;
    const magStamp = this.glowStamps.magenta;
    const alphaScale = nightBiolum ? 0.85 : 0.65;
    const stride = Math.max(1, this._perfBudget?.bioStride ?? 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const drawList = (motes) => {
      for (let i = 0; i < motes.length; i += stride) {
        const m = motes[i];
        if (m.bx < visX0 - 1.5 || m.bx > visX1 + 1.5 || m.by < visY0 - 1.5 || m.by > visY1 + 1.5) continue;
        const wx = m.bx + Math.sin(timeSec * 0.55 + m.r2 * 6.28) * 0.72;
        const wy = m.by + Math.cos(timeSec * 0.45 + m.r1 * 6.28) * 0.52;
        const s = 0.5 + 0.5 * Math.sin(timeSec * 1.9 + m.r1 * 12 + m.k);
        const twinkle = 0.25 + 0.75 * s * s;
        const sx = toScreenX(wx);
        const sy = toScreenY(wy);
        const haloR = Math.max(5.5, (0.24 + m.r2 * 0.18) * scale);
        const stamp = m.isTeal ? cyanStamp : magStamp;
        ctx.globalAlpha = alphaScale * twinkle;
        if (stamp) {
          ctx.drawImage(stamp, sx - haloR, sy - haloR, haloR * 2, haloR * 2);
        } else {
          ctx.fillStyle = m.isTeal ? '#5eead4' : '#c4b5fd';
          ctx.beginPath();
          ctx.arc(sx, sy, haloR * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    if (shallowMotes.length) drawList(shallowMotes);
    if (deepMotes.length) drawList(deepMotes);
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

  /**
   * Post-lighting mechanical interaction FX pass (v148):
   * Titanium shears slash arcs, 4-point stainless carabiner specular star glints,
   * tumbling iron-oxide bulkhead rust flakes, recoiling severed monofilament curls,
   * and luminous compressed-gas bleed mist (capped cleanly under performance tier).
   */
  _drawMechanicalFx(ctx, mechFx, toScreenX, toScreenY, scale, timeSec) {
    if (!mechFx) return;
    ctx.save();

    // 1. Titanium Shears Curved Slash Arc during net / cave-line snag cuts
    const act = mechFx.activeAction;
    if (act && act.kind === 'cut-net' && act.timer < 0.34) {
      const t = act.timer / 0.34;
      const alpha = Math.max(0, 1 - t);
      const sx = toScreenX(act.x);
      const sy = toScreenY(act.y);
      const r = (0.72 + t * 0.45) * scale;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate((act.angle || 0) - 0.55 + t * 1.15);
      ctx.strokeStyle = `rgba(248, 250, 252, ${(alpha * 0.95).toFixed(2)})`;
      ctx.lineWidth = Math.max(2.2, (0.14 * (1 - t * 0.55)) * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, r, -0.95, 0.85);
      ctx.stroke();
      ctx.strokeStyle = `rgba(56, 189, 248, ${(alpha * 0.72).toFixed(2)})`;
      ctx.lineWidth = Math.max(1.2, 0.06 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.84, -0.75, 0.75);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Pooled Mechanical Micro-Particles
    const list = mechFx.particles;
    if (Array.isArray(list) && list.length > 0) {
      const stride = this._perfBudget?.tier === 'performance' ? 2 : 1;
      for (let i = 0; i < list.length; i += stride) {
        const p = list[i];
        const frac = Math.min(1, p.age / Math.max(0.05, p.life));
        const alpha = Math.max(0, 1 - frac);
        const px = toScreenX(p.x);
        const py = toScreenY(p.y);

        if (p.kind === 'rust') {
          const s = p.size * scale;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rot);
          ctx.globalAlpha = alpha * 0.88;
          ctx.fillStyle = p.color || '#92400e';
          ctx.beginPath();
          ctx.moveTo(-s, -s * 0.55);
          ctx.lineTo(s * 0.8, -s * 0.85);
          ctx.lineTo(s, s * 0.45);
          ctx.lineTo(-s * 0.65, s * 0.75);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (p.kind === 'filament') {
          const r = p.size * scale;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rot);
          ctx.globalAlpha = alpha * 0.9;
          ctx.strokeStyle = p.color || '#fbbf24';
          ctx.lineWidth = Math.max(1.1, 0.042 * scale);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.6, 0, Math.PI * (0.95 + frac * 0.45));
          ctx.stroke();
          ctx.restore();
        } else if (p.kind === 'jet') {
          const r = (p.size * (1 + frac * 1.6)) * scale;
          ctx.globalAlpha = alpha * 0.52;
          ctx.fillStyle = p.color || '#e0f2fe';
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'glint') {
          const pulse = Math.sin(frac * Math.PI);
          const arm = p.size * (0.45 + pulse * 0.95) * scale;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rot);
          ctx.globalAlpha = pulse * 0.95;
          ctx.strokeStyle = p.color || '#f8fafc';
          ctx.lineWidth = Math.max(1.6, 0.065 * scale);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-arm, 0);
          ctx.lineTo(arm, 0);
          ctx.moveTo(0, -arm);
          ctx.lineTo(0, arm);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(2, 0.09 * scale) * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
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

  _drawArticulatedLeg(ctx, pelvis, leg, toScreenX, toScreenY, scale, isPeer, isBackLeg, liverySuit = null, timeSec = 0) {
    drawArticulatedDiverLeg(
      ctx,
      toScreenX(pelvis.x),
      toScreenY(pelvis.y),
      toScreenX(leg.knee.x),
      toScreenY(leg.knee.y),
      toScreenX(leg.ankle.x),
      toScreenY(leg.ankle.y),
      toScreenX(leg.finTip.x),
      toScreenY(leg.finTip.y),
      leg.finOpen ?? 0.65,
      scale,
      isPeer,
      isBackLeg,
      liverySuit,
      timeSec
    );
  }

  _drawDynamicEncounters(ctx, encounters, xMin, xMax, yMin, yMax, toScreenX, toScreenY, scale, timeSec, pass = 'world') {
    if (!encounters) return;
    ctx.save();

    if (pass === 'world') {
      // 1. Drifting Thermocline / Halocline Visibility Mist Banks
      const banks = encounters.fogBanks || [];
      for (let i = 0; i < banks.length; i++) {
        const fb = banks[i];
        if (fb.x + fb.radiusX < xMin || fb.x - fb.radiusX > xMax || fb.y + fb.radiusY < yMin || fb.y - fb.radiusY > yMax) continue;
        const sx = toScreenX(fb.x);
        const sy = toScreenY(fb.y);
        const rx = fb.radiusX * scale;
        const ry = fb.radiusY * scale;
        const waveShift = Math.sin(timeSec * 0.9 + fb.phase) * 0.35 * scale;
        ctx.save();
        ctx.translate(sx + waveShift, sy);
        ctx.scale(1, Math.max(0.25, ry / Math.max(1, rx)));
        const grad = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
        const col = fb.tint === 'ocean' ? '125, 211, 252' : '165, 243, 252';
        grad.addColorStop(0, `rgba(${col}, ${(fb.density * 0.42).toFixed(3)})`);
        grad.addColorStop(0.6, `rgba(${col}, ${(fb.density * 0.2).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${col}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Monumental Passing Pelagic Giants (Cathedral-Scale Whale Shark & Giant Oceanic Manta Ray) (v165)
      const visitors = encounters.visitors || [];
      for (let i = 0; i < visitors.length; i++) {
        const v = visitors[i];
        if (v.kind === 'biolum-swarm') continue;
        if (v.x + v.size * 2.4 < xMin || v.x - v.size * 2.4 > xMax || v.y + v.size * 1.6 < yMin || v.y - v.size * 1.6 > yMax) continue;
        const sx = toScreenX(v.x);
        const sy = toScreenY(v.y);
        const fade = Math.min(1, v.ageSec / 2.2) * Math.min(1, (v.durationSec - v.ageSec) / 2.4);
        if (fade <= 0.01) continue;
        ctx.save();
        ctx.globalAlpha = 0.92 * fade;
        if (v.kind === 'whaleshark') {
          drawStyledWhaleShark(ctx, v, sx, sy, scale, timeSec);
        } else if (v.kind === 'oarfish') {
          drawStyledOarfish(ctx, v, sx, sy, scale, timeSec);
        } else if (v.kind === 'coelacanth') {
          drawStyledCoelacanth(ctx, v, sx, sy, scale, timeSec);
        } else if (v.kind === 'mantaray') {
          drawStyledMegafauna(
            ctx,
            {
              kind: 'manta',
              x: v.x,
              y: v.y,
              vx: v.vx,
              vy: v.vy || 0,
              facing: v.dir,
              size: v.size || 2.5,
              phase: v.phase || 0,
              litIntensity: 0.35,
            },
            sx,
            sy,
            scale,
            timeSec
          );
        }
        ctx.restore();
      }
    } else {
      // Emissive post-lighting pass: Bioluminescent Comb-Jelly Swarms & Survey/Distress Beacon
      const visitors = encounters.visitors || [];
      for (let i = 0; i < visitors.length; i++) {
        const v = visitors[i];
        if (v.kind !== 'biolum-swarm') continue;
        if (v.x + 5 < xMin || v.x - 5 > xMax || v.y + 4 < yMin || v.y - 4 > yMax) continue;
        const fade = Math.min(1, v.ageSec / 1.8) * Math.min(1, (v.durationSec - v.ageSec) / 2.2);
        const sx = toScreenX(v.x);
        const sy = toScreenY(v.y);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 12; k++) {
          const ang = k * 0.55 + timeSec * 0.45 + v.phase;
          const rad = (0.45 + (k % 4) * 0.42) * scale;
          const jx = sx + Math.cos(ang) * rad * 1.4;
          const jy = sy + Math.sin(ang * 1.3) * rad * 0.75;
          const pulse = 0.45 + 0.55 * Math.sin(timeSec * 4.2 + k * 1.1);
          const col = k % 3 === 0 ? '#c084fc' : '#22d3ee';
          ctx.globalAlpha = 0.72 * pulse * fade;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(jx, jy, Math.max(2.0, (0.09 + (k % 3) * 0.03) * scale), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Optional Survey / Emergency Distress Beacon with rhythmic amber-cyan strobe pulse
      const bc = encounters.beacon;
      if (bc && !bc.claimed && bc.x >= xMin && bc.x <= xMax && bc.y >= yMin && bc.y <= yMax) {
        const bob = Math.sin(timeSec * 2.2 + bc.pingPhase) * 0.16;
        const bx = toScreenX(bc.x);
        const by = toScreenY(bc.y + bob);
        const ringT = (timeSec * 0.85) % 1;

        // Expanding acoustic transponder strobe ring
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(251, 191, 36, ${((1 - ringT) * 0.78).toFixed(3)})`;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(bx, by, (0.45 + ringT * 2.4) * scale, 0, Math.PI * 2);
        ctx.stroke();

        // Transponder buoy canister + antenna + blinking LED
        ctx.globalCompositeOperation = 'source-over';
        const r = Math.max(5.5, 0.28 * scale);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(bx, by - r);
        ctx.lineTo(bx, by - r * 2.4);
        ctx.stroke();

        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(bx - r * 0.85, by - r, r * 1.7, r * 2.0, 4) : ctx.rect(bx - r * 0.85, by - r, r * 1.7, r * 2.0);
        ctx.fill();
        ctx.stroke();

        const blink = Math.sin(timeSec * 7.0) > 0.15;
        ctx.fillStyle = blink ? '#38bdf8' : '#fef08a';
        ctx.beginPath();
        ctx.arc(bx, by - r * 2.4, Math.max(2.8, r * 0.45), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  _drawCameraFlash(ctx, flash, toScreenX, toScreenY, scale) {
    if (!flash || flash.ageSec >= flash.durationSec) return;
    const t = Math.max(0, Math.min(1, flash.ageSec / flash.durationSec));
    const sx = toScreenX(flash.x);
    const sy = toScreenY(flash.y);
    const ang = Number.isFinite(flash.angle) ? flash.angle : 0;

    ctx.save();
    // 1. Intense twin-strobe flash burst cone (fades sharply in first 0.36s)
    if (t < 0.52) {
      const flashAlpha = Math.pow(1 - t / 0.52, 1.8);
      const rPx = (10.5 + t * 5.0) * scale;
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createRadialGradient(sx, sy, 0.2 * scale, sx, sy, rPx);
      grad.addColorStop(0, `rgba(255, 255, 255, ${(0.92 * flashAlpha).toFixed(3)})`);
      grad.addColorStop(0.32, `rgba(224, 242, 254, ${(0.52 * flashAlpha).toFixed(3)})`);
      grad.addColorStop(0.75, `rgba(56, 189, 248, ${(0.18 * flashAlpha).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, rPx, ang - 0.86, ang + 0.86);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Crisp viewfinder focus brackets around the captured subject
    if (flash.subject && Number.isFinite(flash.targetX) && Number.isFinite(flash.targetY)) {
      const tx = toScreenX(flash.targetX);
      const ty = toScreenY(flash.targetY);
      const boxAlpha = t < 0.2 ? t / 0.2 : Math.max(0, 1 - (t - 0.2) / 0.8);
      const half = Math.max(18, 1.15 * scale) * (1.15 - 0.15 * Math.min(1, t * 3));
      const corner = Math.max(6, half * 0.36);
      const col = flash.isNewInGuide ? '#fde047' : '#38bdf8';

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = boxAlpha;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      // Top-left
      ctx.moveTo(tx - half, ty - half + corner);
      ctx.lineTo(tx - half, ty - half);
      ctx.lineTo(tx - half + corner, ty - half);
      // Top-right
      ctx.moveTo(tx + half - corner, ty - half);
      ctx.lineTo(tx + half, ty - half);
      ctx.lineTo(tx + half, ty - half + corner);
      // Bottom-right
      ctx.moveTo(tx + half, ty + half - corner);
      ctx.lineTo(tx + half, ty + half);
      ctx.lineTo(tx + half - corner, ty + half);
      // Bottom-left
      ctx.moveTo(tx - half + corner, ty + half);
      ctx.lineTo(tx - half, ty + half);
      ctx.lineTo(tx - half, ty + half - corner);
      ctx.stroke();

      const starStr = '★'.repeat(Math.max(1, Math.min(3, flash.stars || 1)));
      const tag = flash.isNewInGuide ? `NEW · ${starStr}` : starStr;
      ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = col;
      ctx.fillText(tag, tx, ty - half - 4);
    }
    ctx.restore();
  }

  _drawSonarPulse(ctx, pulse, toScreenX, toScreenY, scale, timeSec) {
    if (!pulse || pulse.ageSec >= pulse.durationSec) return;
    const sweepDur = 1.45;
    const sweepProgress = Math.min(1, pulse.ageSec / sweepDur);
    const waveRadiusM = sweepProgress * (pulse.maxRadiusM || 28);
    const overallFade = Math.max(0, 1 - pulse.ageSec / pulse.durationSec);
    const cx = toScreenX(pulse.x);
    const cy = toScreenY(pulse.y);

    ctx.save();
    // Expanding translucent high-tech hydrophone wavefront + radial acoustic wash + trailing echo ring
    if (sweepProgress < 1) {
      const waveAlpha = (1 - sweepProgress) * 0.78;
      const radPx = Math.max(2, waveRadiusM * scale);
      const innerPx = Math.max(0, radPx * 0.78);
      const wash = ctx.createRadialGradient(cx, cy, innerPx, cx, cy, radPx);
      wash.addColorStop(0, 'rgba(34, 211, 238, 0)');
      wash.addColorStop(0.82, `rgba(34, 211, 238, ${(waveAlpha * 0.14).toFixed(3)})`);
      wash.addColorStop(1, `rgba(103, 232, 249, ${(waveAlpha * 0.28).toFixed(3)})`);
      ctx.fillStyle = wash;
      ctx.beginPath();
      ctx.arc(cx, cy, radPx, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(103, 232, 249, ${waveAlpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(2.2, 0.14 * scale);
      ctx.beginPath();
      ctx.arc(cx, cy, radPx, 0, Math.PI * 2);
      ctx.stroke();

      if (waveRadiusM > 2.2) {
        ctx.strokeStyle = `rgba(45, 212, 191, ${(waveAlpha * 0.48).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.2, 0.065 * scale);
        ctx.setLineDash([Math.max(6, scale * 0.35), Math.max(4, scale * 0.22)]);
        ctx.beginPath();
        ctx.arc(cx, cy, (waveRadiusM - 1.8) * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Rock-wall contour echo dots illuminated as the sonar ring sweeps past
    const hits = pulse.wallHits || [];
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      if (h.dist > waveRadiusM) continue;
      const hitAge = pulse.ageSec - (h.dist / (pulse.maxRadiusM || 28)) * sweepDur;
      const a = Math.max(0, Math.min(1, 1 - hitAge / 1.45)) * overallFade;
      if (a <= 0.03) continue;
      const hx = toScreenX(h.x);
      const hy = toScreenY(h.y);
      ctx.fillStyle = `rgba(103, 232, 249, ${(a * 0.85).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(hx, hy, Math.max(2.2, 0.14 * scale), 0, Math.PI * 2);
      ctx.fill();
      if (i > 0) {
        const prev = hits[i - 1];
        if (prev.dist <= waveRadiusM && Math.hypot(h.x - prev.x, h.y - prev.y) < 5.5) {
          ctx.strokeStyle = `rgba(45, 212, 191, ${(a * 0.48).toFixed(3)})`;
          ctx.lineWidth = Math.max(1.2, 0.065 * scale);
          ctx.beginPath();
          ctx.moveTo(toScreenX(prev.x), toScreenY(prev.y));
          ctx.lineTo(hx, hy);
          ctx.stroke();
        }
      }
    }

    // High-contrast silt-piercing sonar contacts: relics, stage caches, markers, recovery, AND reactive hazards (v142)
    const contacts = pulse.contacts || [];
    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      if (c.dist > waveRadiusM) continue;
      const pingAge = pulse.ageSec - (c.dist / (pulse.maxRadiusM || 28)) * sweepDur;
      const a = Math.max(0, Math.min(1, 1 - pingAge / 2.65)) * overallFade;
      if (a <= 0.04) continue;
      const px = toScreenX(c.x);
      const py = toScreenY(c.y);

      if (c.kind === 'shifting-hatch') {
        const open = Math.max(0, Math.min(1, c.hatchRef?.openness ?? 1));
        const col = open >= 0.55 ? '74, 222, 128' : open >= 0.3 ? '251, 191, 36' : '248, 113, 113';
        const statusTxt = open >= 0.55 ? 'OPEN' : open >= 0.3 ? 'CLOSING' : 'SLAM!';
        const hr = Math.max(0.85, (c.radius || 2.4) * 0.55) * scale;
        ctx.strokeStyle = `rgba(${col}, ${(a * 0.95).toFixed(3)})`;
        ctx.lineWidth = Math.max(2, 0.1 * scale);
        ctx.beginPath();
        ctx.arc(px, py, hr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = `800 ${Math.max(9, Math.round(scale * 0.34))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(${col}, ${a.toFixed(3)})`;
        ctx.fillText(`🚪 ${statusTxt}`, px, py - hr - Math.max(7, scale * 0.28));
        continue;
      }

      if (c.kind === 'percolation') {
        const halfPx = (c.halfWidth || 3.4) * scale;
        const ceilPy = toScreenY(c.ceilY ?? c.y);
        ctx.strokeStyle = `rgba(251, 191, 36, ${(a * 0.9).toFixed(3)})`;
        ctx.lineWidth = Math.max(2, 0.1 * scale);
        ctx.setLineDash([Math.max(5, scale * 0.3), Math.max(3, scale * 0.18)]);
        ctx.beginPath();
        ctx.moveTo(px - halfPx, ceilPy);
        ctx.lineTo(px + halfPx, ceilPy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `800 ${Math.max(9, Math.round(scale * 0.32))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = `rgba(253, 224, 71, ${a.toFixed(3)})`;
        ctx.fillText('🌫️ CEIL SILT', px, ceilPy - Math.max(4, scale * 0.14));
        continue;
      }

      if (c.kind === 'thermocline') {
        const rxPx = (c.rx || 4.5) * scale * 0.72;
        const ryPx = (c.ry || 2.2) * scale * 0.72;
        ctx.strokeStyle = `rgba(125, 211, 252, ${(a * 0.85).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, 0.08 * scale);
        ctx.setLineDash([Math.max(4, scale * 0.24), Math.max(3, scale * 0.18)]);
        ctx.beginPath();
        ctx.ellipse(px, py, rxPx, ryPx, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `800 ${Math.max(9, Math.round(scale * 0.32))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(186, 230, 253, ${a.toFixed(3)})`;
        ctx.fillText(`❄️ -${c.tempDropC || 7}°C`, px, py);
        continue;
      }

      if (c.kind === 'secret-veil') {
        // Subtle, mysterious acoustic hollow echo (ZERO text callout — observant divers spot the faint fissure!)
        const pulseR = (0.72 + Math.sin(timeSec * 6.5) * 0.1) * scale;
        ctx.strokeStyle = `rgba(103, 232, 249, ${(a * 0.58).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, 0.07 * scale);
        ctx.setLineDash([Math.max(3, scale * 0.16), Math.max(4, scale * 0.2)]);
        ctx.beginPath();
        ctx.arc(px, py, pulseR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }

      const col = c.kind === 'recovery' ? '251, 191, 36' : c.kind === 'hatch' ? '249, 115, 22' : c.kind === 'stage' ? '74, 222, 128' : c.kind === 'collectible' ? '253, 224, 71' : '56, 189, 248';
      const r = (0.72 + Math.sin(timeSec * 9 + i) * 0.1) * scale;
      const bk = r * 1.18;
      const arm = Math.max(4, bk * 0.36);
      // High-tech tactical corner target-lock brackets
      ctx.strokeStyle = `rgba(${col}, ${(a * 0.92).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.8, 0.08 * scale);
      ctx.beginPath();
      ctx.moveTo(px - bk, py - bk + arm); ctx.lineTo(px - bk, py - bk); ctx.lineTo(px - bk + arm, py - bk);
      ctx.moveTo(px + bk - arm, py - bk); ctx.lineTo(px + bk, py - bk); ctx.lineTo(px + bk, py - bk + arm);
      ctx.moveTo(px - bk, py + bk - arm); ctx.lineTo(px - bk, py + bk); ctx.lineTo(px - bk + arm, py + bk);
      ctx.moveTo(px + bk - arm, py + bk); ctx.lineTo(px + bk, py + bk); ctx.lineTo(px + bk, py + bk - arm);
      ctx.stroke();
      ctx.font = `700 ${Math.max(10, Math.round(scale * 0.44))}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(248, 250, 252, ${a.toFixed(3)})`;
      ctx.fillText(c.icon || '◆', px, py);
      if (c.kind === 'collectible' || c.kind === 'recovery' || c.kind === 'stage') {
        ctx.font = `800 ${Math.max(8, Math.round(scale * 0.28))}px ui-monospace, monospace`;
        ctx.fillStyle = `rgba(${col}, ${(a * 0.95).toFixed(3)})`;
        ctx.fillText(`${Math.round(c.dist)}m`, px, py + bk + Math.max(6, scale * 0.22));
      }
    }
    ctx.restore();
  }

  _drawDiver(ctx, diver, toScreenX, toScreenY, scale, timeSec, isPeer, mechCtx = null) {
    const body = diver.body || createDiverBody(diver.x, diver.y, diver.angle);
    const sx = toScreenX(diver.x);
    const sy = toScreenY(diver.y);
    const px = toScreenX(body.pelvis.x);
    const py = toScreenY(body.pelvis.y);
    const hx = toScreenX(body.hand.x);
    const hy = toScreenY(body.hand.y);

    ctx.save();

    const liveryPalette = diver.livery ? resolveDiverLiveryPalette(diver.livery) : null;
    if (liveryPalette?.wakeProfile?.active) this._drawDiverGearAura?.(ctx, sx, sy, scale, timeSec, liveryPalette);

    // 1. Far leg (behind torso)
    this._drawArticulatedLeg(ctx, body.pelvis, body.legs[1], toScreenX, toScreenY, scale, isPeer, true, liveryPalette, timeSec);

    // 2. Articulated Torso connecting shoulders (sx, sy) to pelvis (px, py)
    let accent = liveryPalette ? liveryPalette.trim : (isPeer ? '#fb923c' : '#22d3ee');
    if (liveryPalette?.trimFx === 'selenite-prism') {
      accent = `hsl(${Math.round((timeSec * 90) % 360)}, 92%, 78%)`;
    } else if (liveryPalette?.trimFx === 'foundry-sparks') {
      accent = `hsl(32, 98%, ${58 + Math.round(Math.sin(timeSec * 6.5) * 14)}%)`;
    }
    const torsoAngle = Math.atan2(sy - py, sx - px);
    const rollScale = Math.abs(body.rollVisual) < 0.15 ? 0.15 : body.rollVisual;
    const facingLeft = body.facingSign < 0;

    // Flexible drysuit spine core
    this._drawLimbSegment(ctx, px, py, sx, sy, 0.36 * scale, liveryPalette ? liveryPalette.suitMid : '#0f172a');
    // Subtle shoulder / hip trim stripe (with live plasma-wave conduit pulse)
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1.5, 0.04 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    if (liveryPalette?.trimFx === 'plasma-wave') {
      const pt = ((timeSec * 1.45) % 1 + 1) % 1;
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(sx + (px - sx) * pt, sy + (py - sy) * pt, Math.max(2, 0.048 * scale), 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Rigid Rig & Head oriented to torsoAngle + smooth roll (artSprites)
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(torsoAngle);
    if (facingLeft) ctx.scale(1, -1);

    const u = scale * 0.55;
    drawStyledDiverRig(ctx, u, scale, isPeer, rollScale, {
      hasCcr: diver.hasCcr,
      hasDpv: diver.hasDpv,
      dpvActive: diver.dpvActive,
      dpvThrusting: diver.dpvThrusting,
      timeSec,
      liveryPalette,
    });
    ctx.restore();

    // 4. Near leg (in front of pelvis)
    this._drawArticulatedLeg(ctx, body.pelvis, body.legs[0], toScreenX, toScreenY, scale, isPeer, false, liveryPalette, timeSec);

    // 5. Articulated Arm, Wrist Dive Computer & Goodman-handle Primary Torch (shared with Workshop Preview)
    const shoulderX = sx + Math.cos(torsoAngle) * (0.08 * scale);
    const shoulderY = sy + Math.sin(torsoAngle) * (0.08 * scale);
    const midArmX = (shoulderX + hx) * 0.5 + Math.sin(torsoAngle) * body.facingSign * (0.12 * scale);
    const midArmY = (shoulderY + hy) * 0.5 - Math.cos(torsoAngle) * body.facingSign * (0.12 * scale);
    const torchAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : diver.angle;
    drawDiverArmAndTorch(
      ctx,
      shoulderX,
      shoulderY,
      midArmX,
      midArmY,
      hx,
      hy,
      torchAng,
      scale,
      isPeer,
      liveryPalette,
      {
        torchOn: diver.torchOn !== false,
        glowStamps: this.glowStamps,
        hasSpeargun: Boolean(mechCtx?.hasSpeargun),
        spearRecoil: mechCtx?.spearRecoil || 0,
        muzzleFlash: mechCtx?.muzzleFlash || 0,
        timeSec,
      }
    );

    // 5b. Articulated Working Arm & Mechanical Hardware Rig (v148: Wheel Crank, Valve Bleed, Shears, Delrin Reel, Shot-Line Lanyard)
    if (!isPeer && mechCtx) {
      const ws = mechCtx.wreckState;
      const mfx = mechCtx.mechFx;

      // Shot-line stainless carabiner & yellow braided clip lanyard when clipped onto descent line
      if (ws?.clippedToShotLine && this.level?.shotLine) {
        const lineX = toScreenX(this.level.shotLine.x ?? this.level.spawn?.x ?? diver.x);
        const lineY = sy - 0.08 * scale;
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.94)';
        ctx.lineWidth = Math.max(1.5, 0.058 * scale);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo((sx + lineX) * 0.5, sy + 0.16 * scale, lineX, lineY);
        ctx.stroke();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = Math.max(1.4, 0.055 * scale);
        ctx.beginPath();
        ctx.arc(lineX, lineY, Math.max(2.2, 0.095 * scale), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Compute working-hand screen target for active mechanical interactions
      let workTargetX = null;
      let workTargetY = null;
      let workTool = null;

      const activeDrillKind = mechCtx?.drills?.active?.kind || null;
      if (ws?.crankingHatchId && Array.isArray(this.level?.watertightHatches)) {
        const hObj = this.level.watertightHatches.find((h) => h && h.id === ws.crankingHatchId);
        if (hObj) {
          const hr = (hObj.radius || 1.9) * scale;
          const wheelRot = (ws.crankingHatchProgress || 0) * Math.PI * 5;
          workTargetX = toScreenX(hObj.x) + Math.cos(wheelRot) * hr * 0.44;
          workTargetY = toScreenY(hObj.y) + Math.sin(wheelRot) * hr * 0.44;
          workTool = 'crank';
        }
      } else if (activeDrillKind === 'mask-flood' || mfx?.activeAction?.kind === 'mask-purge') {
        // Working hand rises to upper mask visor rim to press & exhale-purge flooded mask (v151)
        const headX = sx + Math.cos(torsoAngle) * 0.36 * scale;
        const headY = sy + Math.sin(torsoAngle) * 0.36 * scale - 0.08 * scale;
        workTargetX = headX + Math.cos(torsoAngle + body.facingSign * 0.25) * 0.12 * scale;
        workTargetY = headY + Math.sin(torsoAngle + body.facingSign * 0.25) * 0.12 * scale;
        workTool = 'mask-purge';
      } else if (activeDrillKind === 'free-flow' || mfx?.activeAction?.kind === 'free-flow-shutoff') {
        // Working arm reaches back over the shoulder to crank the rear tank isolator manifold valve (v151)
        const backAng = torsoAngle + Math.PI - body.facingSign * 0.48;
        const twist = Math.sin(timeSec * 12) * 0.05 * scale;
        workTargetX = shoulderX + Math.cos(backAng) * 0.38 * scale + twist;
        workTargetY = shoulderY + Math.sin(backAng) * 0.38 * scale - 0.12 * scale;
        workTool = 'free-flow-shutoff';
      } else if (mfx?.activeAction?.kind === 'gas-switch') {
        // Gloved hand clips/switches color-coded 2nd-stage regulator at chest/mouthpiece (v151)
        const reach = Math.sin(Math.min(1, mfx.activeAction.timer / Math.max(0.1, mfx.activeAction.duration)) * Math.PI);
        if (reach > 0.05) {
          const regAng = torsoAngle + body.facingSign * 0.28;
          workTargetX = shoulderX + Math.cos(regAng) * (0.26 + reach * 0.18) * scale;
          workTargetY = shoulderY + Math.sin(regAng) * (0.26 + reach * 0.18) * scale;
          workTool = 'gas-switch';
        }
      } else if (mfx?.activeAction) {
        const a = mfx.activeAction;
        const reach = Math.sin(Math.min(1, a.timer / Math.max(0.1, a.duration)) * Math.PI);
        if (reach > 0.05) {
          const tx = toScreenX(a.x);
          const ty = toScreenY(a.y);
          const distPx = Math.hypot(tx - shoulderX, ty - shoulderY);
          const clamped = Math.min(distPx, 2.6 * scale);
          const ratio = distPx > 0.01 ? (clamped / distPx) * reach : 0;
          workTargetX = shoulderX + (tx - shoulderX) * ratio;
          workTargetY = shoulderY + (ty - shoulderY) * ratio;
          workTool = a.kind;
        }
      } else if (mechCtx.reelingActive) {
        // Off-hand holds the spinning machined Delrin cave guideline spool
        const offAng = torsoAngle + body.facingSign * 0.55;
        workTargetX = shoulderX + Math.cos(offAng) * 0.52 * scale;
        workTargetY = shoulderY + Math.sin(offAng) * 0.52 * scale;
        workTool = 'spool';
      }

      if (workTargetX !== null && workTargetY !== null) {
        const elbowX = (shoulderX + workTargetX) * 0.5 - Math.sin(torsoAngle) * body.facingSign * (0.14 * scale);
        const elbowY = (shoulderY + workTargetY) * 0.5 + Math.cos(torsoAngle) * body.facingSign * (0.14 * scale);
        this._drawLimbSegment(ctx, shoulderX, shoulderY, elbowX, elbowY, 0.125 * scale, '#1e293b');
        this._drawLimbSegment(ctx, elbowX, elbowY, workTargetX, workTargetY, 0.11 * scale, '#0f172a');
        // Neoprene gloved hand
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(workTargetX, workTargetY, Math.max(2.2, 0.075 * scale), 0, Math.PI * 2);
        ctx.fill();

        if (workTool === 'spool') {
          // Spinning machined Delrin guideline finger-spool in hand
          ctx.save();
          ctx.translate(workTargetX, workTargetY);
          ctx.rotate(timeSec * 5.2);
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = Math.max(1.2, 0.05 * scale);
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(3.2, 0.16 * scale), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(1.4, 0.07 * scale), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (workTool === 'cut-net') {
          // Gleaming titanium trauma shears blades at hand
          const shearAng = Math.atan2(workTargetY - elbowY, workTargetX - elbowX);
          ctx.save();
          ctx.translate(workTargetX, workTargetY);
          ctx.rotate(shearAng);
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = Math.max(1.4, 0.055 * scale);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0.24 * scale, -0.07 * scale);
          ctx.moveTo(0, 0);
          ctx.lineTo(0.24 * scale, 0.07 * scale);
          ctx.stroke();
          ctx.restore();
        } else if (workTool === 'gas-switch') {
          // Color-coded 2nd-stage regulator housing + stainless bolt-snap glint
          const gId = mfx?.activeAction?.gasId || 'EAN32';
          const regCol = gId === 'O2' ? '#22c55e' : gId === 'TMX1455' ? '#f59e0b' : '#38bdf8';
          ctx.fillStyle = regCol;
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = Math.max(1.1, 0.04 * scale);
          ctx.beginPath();
          ctx.arc(workTargetX, workTargetY, Math.max(2.6, 0.105 * scale), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (workTool === 'free-flow-shutoff') {
          // Brass tank isolator valve knob + turning arc highlight
          ctx.fillStyle = '#fbbf24';
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = Math.max(1.1, 0.04 * scale);
          ctx.beginPath();
          ctx.arc(workTargetX, workTargetY, Math.max(2.4, 0.095 * scale), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (workTool === 'mask-purge') {
          // Rising silver nasal-purge micro-bubbles escaping bottom skirt of mask
          ctx.fillStyle = 'rgba(224, 242, 254, 0.82)';
          for (let pb = 0; pb < 3; pb++) {
            const lift = ((timeSec * 3.8 + pb * 0.33) % 1) * 0.42 * scale;
            ctx.beginPath();
            ctx.arc(workTargetX + (pb - 1) * 0.07 * scale, workTargetY - lift, Math.max(1.2, 0.038 * scale), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

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
      const isDecoHold = cond.startsWith('DECO ');
      const alertColor =
        diver.alive === false ||
        cond === 'NO GAS' ||
        cond === 'HYPOXIA' ||
        cond === 'O2 TOX' ||
        cond === 'DCS' ||
        cond === 'SNAGGED!' ||
        cond === 'NO LIGHT' ||
        cond === 'NARCOSIS' ||
        cond === 'PANIC' ||
        cond === 'LOW GAS' ||
        cond === 'SEPARATED' ||
        stress >= 65 ||
        bpm >= 150
          ? '#ef4444'
          : (cond !== 'NOMINAL' && !isDecoHold) || bar < 50 || stress >= 25 || bpm >= 118
            ? '#fbbf24'
            : isDecoHold
              ? '#38bdf8'
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
      const mixStartBar = this.level?.gasOverrides?.[diver.gasId]?.startBar || 200;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(sx - barW * 0.5, pillY, barW, 4);
      const gasW = Math.max(0, Math.min(1, bar / mixStartBar)) * (barW * 0.48);
      ctx.fillStyle = bar < 45 ? '#ef4444' : '#38bdf8';
      ctx.fillRect(sx - barW * 0.5, pillY, gasW, 4);
      const stressW = Math.max(0, Math.min(1, stress / 100)) * (barW * 0.48);
      ctx.fillStyle = stress >= 65 ? '#ef4444' : stress >= 25 ? '#fbbf24' : '#4ade80';
      ctx.fillRect(sx + barW * 0.02, pillY, stressW, 4);
      ctx.restore();
    }
  }

  /**
   * Post-lighting luminous overhead hand/torch signals & 3-flash dive-light pulse
   * so co-op team signals remain razor-sharp even in pitch-black cave sumps.
   */
  _drawDiverSignals(ctx, diver, peers, toScreenX, toScreenY, scale, timeSec, cw = 0, ch = 0) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const list = [];
    if (diver?.signalText && diver.signalExpiresAt > now) list.push({ d: diver, isPeer: false });
    if (Array.isArray(peers)) {
      for (let i = 0; i < peers.length; i++) {
        const p = peers[i];
        if (p?.signalText && p.signalExpiresAt > now) list.push({ d: p, isPeer: true });
      }
    }
    if (list.length === 0) return;

    ctx.save();
    for (let i = 0; i < list.length; i++) {
      const { d, isPeer } = list[i];
      const remMs = d.signalExpiresAt - now;
      const totalMs = isPeer ? 4500 : 4000;
      const elapsedSec = Math.max(0, (totalMs - remMs) / 1000);
      const fade = Math.min(1, remMs / 550);
      const sx = toScreenX(d.x);
      const sy = toScreenY(d.y);
      // Skip completely offscreen peers (their signal is surfaced on _drawPeerEdgeIndicators)
      if (isPeer && cw > 0 && ch > 0 && (sx < -24 || sx > cw + 24 || sy < -24 || sy > ch + 24)) continue;

      const sigSpec = getScubaSignalById(d.signalId || d.signalText);
      const isWarn = sigSpec ? (sigSpec.id === 'low-gas' || sigSpec.id === 'hold' || sigSpec.id === 'share-air') : /GAS|DECO|HOLD|SHARE/i.test(d.signalText);
      const accentColor = sigSpec?.color || (isWarn ? '#fbbf24' : '#38bdf8');
      const bgColor = sigSpec?.bgRgba || (isWarn ? 'rgba(69, 26, 3, 0.94)' : 'rgba(8, 47, 73, 0.94)');
      const txtColor = sigSpec?.textColor || (isWarn ? '#fef3c7' : '#e0f2fe');
      const sigElapsed = Number.isFinite(d.signalStartedAt) ? Math.max(0, (now - d.signalStartedAt) / 1000) : elapsedSec;

      // Authentic in-world cave-diving torch light gesture graphic ahead of diver's beam (v127)
      if (sigSpec && sigElapsed < 2.35 && d.torchOn !== false) {
        const gFade = Math.min(1, sigElapsed / 0.2) * Math.min(1, (2.35 - sigElapsed) / 0.35);
        const aimAng = Number.isFinite(d.torchAngle) ? d.torchAngle : (d.angle || 0);
        const gx = sx + Math.cos(aimAng) * 2.15 * scale;
        const gy = sy + Math.sin(aimAng) * 2.15 * scale;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = gFade * 0.9;
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = Math.max(2, 0.08 * scale);
        if (sigSpec.torchPattern === 'circle') {
          // Luminous Torch "O" Circle signal (classic cave-diving OK gesture!)
          const r = 0.68 * scale;
          const headA = sigElapsed * Math.PI * 2.8;
          ctx.beginPath();
          ctx.arc(gx, gy, r, headA - Math.PI * 1.45, headA);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(gx + Math.cos(headA) * r, gy + Math.sin(headA) * r, Math.max(2.6, 0.1 * scale), 0, Math.PI * 2);
          ctx.fill();
        } else if (sigSpec.torchPattern === 'wave' || sigSpec.torchPattern === 'sos-wave') {
          // Sweeping attention light arcs
          for (let aIdx = 0; aIdx < 2; aIdx++) {
            const ar = (1.1 + aIdx * 0.55) * scale;
            ctx.beginPath();
            ctx.arc(sx, sy, ar, aimAng - 0.52, aimAng + 0.52);
            ctx.stroke();
          }
        } else if (sigSpec.torchPattern === 'nod-up') {
          // Rising upward ascent chevrons above diver
          for (let cIdx = 0; cIdx < 2; cIdx++) {
            const cy = sy - (1.0 + ((sigElapsed * 1.3 + cIdx * 0.5) % 1.0) * 1.1) * scale;
            const cwHalf = 0.36 * scale;
            ctx.beginPath();
            ctx.moveTo(sx - cwHalf, cy + 0.18 * scale);
            ctx.lineTo(sx, cy - 0.12 * scale);
            ctx.lineTo(sx + cwHalf, cy + 0.18 * scale);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 3-flash dive-light beacon ring during first 1.6s of signal so teammates spot it across dark passages
      if (elapsedSec < 1.65) {
        const flashPhase = (elapsedSec * 3.0) % 1.0;
        const flashAlpha = Math.sin(flashPhase * Math.PI) * (1 - elapsedSec / 1.8);
        if (flashAlpha > 0.04) {
          const ringR = (0.75 + flashPhase * 2.15) * scale;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = flashAlpha * 0.85;
          ctx.strokeStyle = accentColor;
          ctx.lineWidth = Math.max(2, 0.1 * scale);
          ctx.beginPath();
          ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      const risePx = Math.min(14, elapsedSec * 5) + Math.sin(timeSec * 4 + i) * 1.5;
      const baseMsgY = isPeer
        ? Math.min(sy - scale * 1.92, sy - scale * 1.12 - 28) - risePx
        : sy - scale * 1.55 - risePx;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.font = `800 ${Math.max(10, Math.round(0.36 * scale))}px ui-monospace, monospace`;
      const padX = 9;
      const tw = ctx.measureText(d.signalText).width;
      const bw = tw + padX * 2;
      const bh = Math.max(20, 0.58 * scale);
      const pillCx = cw > 0 ? Math.max(bw * 0.5 + 8, Math.min(cw - bw * 0.5 - 8, sx)) : sx;
      const msgY = ch > 0 ? Math.max(bh * 0.5 + 12, Math.min(ch - bh * 0.5 - 12, baseMsgY)) : baseMsgY;
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(pillCx - bw * 0.5, msgY - bh * 0.5, bw, bh, 999);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = txtColor;
      ctx.fillText(d.signalText, pillCx, msgY + 0.5);
      ctx.restore();
    }
    ctx.restore();
  }

  _drawPeerEdgeIndicators(ctx, cw, ch, diver, peers, toScreenX, toScreenY, timeSec) {
    if (!peers || peers.length === 0) return;
    const dpr = this._cachedDpr || 1;
    const marginX = Math.round(28 * dpr);
    const topSafe = Math.round((cw < ch ? 116 : 92) * dpr);
    const botSafe = Math.round((cw < ch ? 225 : 138) * dpr);
    const fontPx = Math.round(11 * dpr);
    const arrowSz = Math.round(8 * dpr);
    const pillH = Math.round(20 * dpr);
    const placedPills = [];
    ctx.save();
    ctx.font = `800 ${fontPx}px ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    for (let i = 0; i < peers.length; i++) {
      const p = peers[i];
      const px = toScreenX(p.x);
      const py = toScreenY(p.y);
      const onScreen = px >= marginX && px <= cw - marginX && py >= topSafe && py <= ch - botSafe;
      if (onScreen) continue;

      const distM = Math.round(Math.hypot(p.x - diver.x, p.y - diver.y));
      const dDepth = Math.round((p.y || 0) - (diver.y || 0));
      const depthTag = Math.abs(dDepth) >= 3 ? (dDepth > 0 ? ` ▼${dDepth}m` : ` ▲${Math.abs(dDepth)}m`) : '';
      const ang = Math.atan2(py - ch * 0.5, px - cw * 0.5);
      const rx = Math.max(marginX, Math.min(cw - marginX, cw * 0.5 + Math.cos(ang) * (cw * 0.5 - marginX)));
      let ry = Math.max(topSafe, Math.min(ch - botSafe, ch * 0.5 + Math.sin(ang) * (ch * 0.5 - Math.max(topSafe, botSafe) * 0.5)));

      const stress = Math.round(
        Math.max(p.cnsPercent || 0, p.dcsStress || 0, p.hypoxiaStress || 0, p.cardiacStress || 0, (p.narcosisLevel || 0) * 80)
      );
      const bpm = p.alive === false ? 0 : Math.round(p.heartRateBpm ?? 68);
      const bar = Math.round(p.activeBar ?? 200);
      const cond = p.alive === false ? 'DOWN' : (p.condition || 'NOMINAL');
      const isDecoHold = cond.startsWith('DECO ');
      const distressed =
        p.alive === false ||
        cond === 'NO GAS' ||
        cond === 'HYPOXIA' ||
        cond === 'O2 TOX' ||
        cond === 'DCS' ||
        cond === 'SNAGGED!' ||
        cond === 'NO LIGHT' ||
        cond === 'NARCOSIS' ||
        cond === 'PANIC' ||
        cond === 'LOW GAS' ||
        cond === 'SEPARATED' ||
        stress >= 65 ||
        bpm >= 150;
      const isWarn = !distressed && ((cond !== 'NOMINAL' && !isDecoHold) || bar < 50 || stress >= 25 || bpm >= 118);
      const pulse = distressed ? 0.65 + 0.35 * Math.sin(timeSec * 8) : 0.94;
      const col = distressed ? '#f87171' : isWarn ? '#fbbf24' : isDecoHold ? '#38bdf8' : '#fdba74';

      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const activeSig = p.signalText && p.signalExpiresAt > nowMs ? ` · ${p.signalText}` : '';
      const label = cond === 'NOMINAL'
        ? `${p.name || 'Buddy'} ${distM}m${depthTag}${activeSig}`
        : `${p.name || 'Buddy'} ${cond} ${distM}m${depthTag}${activeSig}`;
      const textW = ctx.measureText(label).width;
      const pillPadX = Math.round(7 * dpr);
      const pillW = Math.min(cw - marginX * 2, textW + pillPadX * 2);
      const onRight = rx > cw * 0.5;
      const rawPillX = onRight ? rx - arrowSz - Math.round(5 * dpr) - pillW : rx + arrowSz + Math.round(5 * dpr);
      const pillX = Math.max(marginX, Math.min(cw - marginX - pillW, rawPillX));

      // Avoid vertical stacking collisions when multiple peers lie in the same direction
      const stepY = pillH + Math.round(4 * dpr);
      for (let k = 0; k < placedPills.length; k++) {
        const prev = placedPills[k];
        if (Math.abs(prev.x - pillX) < (prev.w + pillW) * 0.5 && Math.abs(prev.y - ry) < stepY) {
          ry = Math.min(ch - botSafe, Math.max(topSafe, prev.y + (ry >= prev.y ? stepY : -stepY)));
        }
      }
      placedPills.push({ x: pillX, y: ry, w: pillW });

      ctx.globalAlpha = pulse;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(ang);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(arrowSz, 0);
      ctx.lineTo(-arrowSz * 0.7, -arrowSz * 0.6);
      ctx.lineTo(-arrowSz * 0.38, 0);
      ctx.lineTo(-arrowSz * 0.7, arrowSz * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = distressed ? 'rgba(69, 10, 10, 0.9)' : 'rgba(6, 15, 29, 0.88)';
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1.2, 1.3 * dpr);
      ctx.beginPath();
      ctx.roundRect(pillX, ry - pillH * 0.5, pillW, pillH, 999);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = col;
      ctx.fillText(label, pillX + pillW * 0.5, ry + 0.5, pillW - pillPadX * 1.4);
    }
    ctx.restore();
  }

}

Object.assign(
  CaveRenderer.prototype,
  chunkBakerMethods,
  surfaceRendererMethods,
  wreckAndInteractivesMethods,
  lightingAndFxMethods,
  bossAndLairMethods,
  underwaterJuiceRendererMethods,
  foregroundDepthRendererMethods
);
