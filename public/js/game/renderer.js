import { evaluateCaveSDF, evaluateCaveNormal, createChunkSDFEvaluator } from './collision.js';
import { createDiverBody } from './diverBody.js';
import { castTorchFan, castSunCurtain, computeSpectralAbsorption } from './lighting.js';
import { getScubaSignalById } from './diveSignals.js';
import { getWeatherById, computeStormLightningFlash } from './weather.js';
import { resolveDiverLiveryPalette, getTorchOptic } from './rigLivery.js';
import { applyPhotoViewportOverlay } from './photoStudio.js';
import { isHatchPressurized } from './salvagePhysics.js';
import { sampleSiltDensity } from './silt.js';
import { computeSurgeWave } from './diveSession.js';
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
  drawStyledDenizen,
} from './artSprites.js';

const CACHE_PX_PER_M = 24;
const MOBILE_CACHE_PX_PER_M = 16;
const BACK_PX_PER_M = 12;
const CHUNK_W_M = 24;
const CHUNK_H_M = 64; // Caps every canvas tile <= 1536px tall (avoids >4096px GPU overflow on L14-L20)
const TEX_SIZE = 512;
const MAX_CACHED_LEVELS = 5;
const BAKE_FRAME_BUDGET_MS = 12;

const _nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

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
    this.dustMotes = [];
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
      this.dustMotes = [];
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
    this.skyBackdropImg = entry.skyBackdropImg;
    this.backChunks = entry.backChunks;
    this.rockChunks = entry.rockChunks;
    this.dustMotes = entry.dustMotes || [];
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
      dustMotes: [],
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
  }

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
  }

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
  }

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

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const data = img.data;

    const evalChunkSdf = createChunkSDFEvaluator(level, cx0, cx1);
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
    const invPpm = 1 / ppm;
    const gxBase = Math.floor((cx0 - xMin) * ppm);
    const gyBase = Math.floor((cy0 - yMin) * ppm);

    // Precompute 1D horizon ground curve once per chunk (eliminates ~1M redundant sin/cos calls/chunk)
    const topGroundYByPx = new Float32Array(w);
    let maxTopGroundY = -Infinity;
    for (let px = 0; px < w; px++) {
      const gy = this._getHorizonGroundY(level, cx0 + px * invPpm);
      topGroundYByPx[px] = gy;
      if (gy > maxTopGroundY) maxTopGroundY = gy;
    }

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
   * Lightweight <0.5ms water-and-light menu backdrop rendered when no cave chunks have been baked yet.
   */
  renderMenuBackdrop(level, timeSec = 0, weather = null) {
    this._activeWeather = weather ? (typeof weather === 'string' ? getWeatherById(weather) : weather) : null;
    this.resize();
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const theme = level?.theme || {};

    // Smoothly cross-fade ocean backdrop palette when switching expedition sites
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
    const dt = this._lastMenuBackdropSec ? Math.min(0.1, Math.max(0.004, timeSec - this._lastMenuBackdropSec)) : 0.016;
    this._lastMenuBackdropSec = timeSec;

    if (!this._menuBackdropRgb) {
      this._menuBackdropRgb = targetHexes.map(parseHex);
    } else {
      const alpha = 1 - Math.exp(-dt * 4.2);
      for (let i = 0; i < 5; i++) {
        const tgt = parseHex(targetHexes[i]);
        const cur = this._menuBackdropRgb[i];
        cur[0] += (tgt[0] - cur[0]) * alpha;
        cur[1] += (tgt[1] - cur[1]) * alpha;
        cur[2] += (tgt[2] - cur[2]) * alpha;
      }
    }
    const rgbStop = (i) => {
      const c = this._menuBackdropRgb[i];
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

    // Subtle animated sun shafts drifting behind menu card
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const baseX = cw * (0.12 + i * 0.2) + Math.sin(timeSec * 0.24 + i * 1.65) * cw * 0.045;
      const topW = cw * (0.045 + (i % 2) * 0.02);
      const botW = cw * (0.18 + (i % 3) * 0.045);
      const shimmer = 0.13 + 0.06 * Math.sin(timeSec * 0.55 + i * 2.1);
      const rayGrad = ctx.createLinearGradient(baseX, 0, baseX + cw * 0.04, ch * 0.82);
      rayGrad.addColorStop(0, `rgba(186, 230, 253, ${shimmer.toFixed(3)})`);
      rayGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(baseX - topW, 0);
      ctx.lineTo(baseX + topW, 0);
      ctx.lineTo(baseX + botW, ch * 0.84);
      ctx.lineTo(baseX - botW * 0.42, ch * 0.84);
      ctx.closePath();
      ctx.fill();
    }

    // Ambient buoyant bokeh bubbles rising softly through the deep backdrop (zero-alloc)
    if (!this._reducedMotion) {
      const bubbleCount = 26;
      const mdpr = this._cachedDpr || 1;
      ctx.lineWidth = Math.max(1, mdpr * 0.8);
      for (let i = 0; i < bubbleCount; i++) {
        const seed = (i + 1) * 1.6180339;
        const speed = 0.022 + (i % 7) * 0.0075;
        const phase = (timeSec * speed + (seed % 1)) % 1;
        const by = ch * (1.06 - phase * 1.12);
        const bx = cw * (((seed * 7.31) % 1) + Math.sin(timeSec * (0.6 + (i % 4) * 0.25) + i * 2.3) * 0.018);
        const r = (2.0 + (i % 5) * 1.35) * (0.65 + (1 - phase) * 0.45) * mdpr;
        const fade = Math.sin(phase * Math.PI);
        const alpha = fade * (0.14 + (i % 3) * 0.06);
        ctx.fillStyle = `rgba(186, 230, 253, ${(alpha * 0.55).toFixed(3)})`;
        ctx.strokeStyle = `rgba(224, 242, 254, ${(alpha * 1.25).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(bx, by, r * 1.08, r * 0.92, Math.sin(timeSec + i) * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
    if (this._activeWeather && this._activeWeather.id !== 'clear-day') {
      this._drawWeatherSkyAtmosphere(ctx, cw, ch * 0.44, timeSec);
      this._drawWeatherPrecipitation(ctx, cw, ch, ch * 0.44, timeSec);
    }
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
    powerRelays = null,
    smb = null,
    salvage = null,
    mechFx = null,
    stories = null,
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
    compactHud = false,
    spaceClearanceM = 4.0,
    breathState = 'hold',
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
    const scale = this.pxPerM * dpr * photoZoom * this._restrictionZoom;

    // Smooth camera follow + Torch-Coupled Peek Look-Ahead (or direct pan/zoom in Photo Mode Studio)
    const camAnchor = cameraTarget || diver;
    if (isPhotoMode) {
      this.camX = camAnchor.x + (Number(photoMode.panX) || 0);
      this.camY = camAnchor.y + (Number(photoMode.panY) || 0);
    } else {
      const isManualPeek = Boolean(camAnchor.torchManualAim && Number.isFinite(camAnchor.torchAngle));
      const peekX = isManualPeek ? Math.cos(camAnchor.torchAngle) * 3.4 : 0;
      const peekY = isManualPeek ? Math.sin(camAnchor.torchAngle) * 2.5 : 0;
      const lookX = camAnchor.x + Math.cos(camAnchor.angle || 0) * (isManualPeek ? 1.0 : 2.2) + peekX;
      // Subtle plunge-entry camera settle during the first 1.5s of submerging (v161)
      const plungeDrop = !this._reducedMotion && timeSec >= 0 && timeSec < 1.5 && (camAnchor.y || 0) < 4.5
        ? Math.sin((1 - timeSec / 1.5) * Math.PI) * 0.42
        : 0;
      const lookY = camAnchor.y + Math.sin(camAnchor.angle || 0) * (isManualPeek ? 0.7 : 1.4) + peekY + plungeDrop;
      const camAlpha = Math.min(1, dt * (isManualPeek ? 3.2 : 6.0));
      this.camX += (lookX - this.camX) * camAlpha;
      this.camY += (lookY - this.camY) * camAlpha;
    }

    // Narcosis gentle camera drift (suppressed under prefers-reduced-motion, spectating, or Photo Mode)
    let narcX = 0;
    let narcY = 0;
    const isSpectating = Boolean(cameraTarget && cameraTarget !== diver);
    if (!isPhotoMode && !isSpectating && !this._reducedMotion && diveState.narcosisLevel > 0.15) {
      narcX = Math.sin(timeSec * 1.7) * diveState.narcosisLevel * 0.45;
      narcY = Math.cos(timeSec * 1.3) * diveState.narcosisLevel * 0.35;
    }

    const viewCenterX = cw * 0.5;
    // On narrow portrait phones, shift framing slightly higher so the diver sits centered above the bottom dock
    const viewCenterY = isPhotoMode ? ch * 0.5 : (cw < ch ? ch * 0.39 : ch * 0.46);

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
    this._drawCollectibles(ctx, viewWorldLeft, viewWorldRight, toScreenX, toScreenY, scale, collectedIds, timeSec);
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
    if (stories && typeof this._drawSubmergedStories === 'function') {
      this._drawSubmergedStories(ctx, stories, visX0 - 8, visX1 + 8, visY0 - 8, visY1 + 8, toScreenX, toScreenY, scale, timeSec, 'world');
    }

    // 9. Divers & Active Co-op Rescue Tow Lifelines + Air-Share Octo Hose Beams
    this._drawBuddyRescueTethers(ctx, diver, peerList, toScreenX, toScreenY, scale, timeSec, airShareBeams);
    for (let i = 0; i < peerList.length; i++) {
      this._drawDiver(ctx, peerList[i], toScreenX, toScreenY, scale, timeSec, true);
    }
    this._drawDiver(ctx, diver, toScreenX, toScreenY, scale, timeSec, false, { wreckState, mechFx, reelingActive, drills });
    if (salvage?.liftBagActive || (salvage?.inflateAnim || 0) > 0.02) {
      this._drawDiverLiftBag(ctx, diver, salvage, toScreenX, toScreenY, scale, timeSec, mechFx);
    }

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
      localSiltDensity,
      powerRelays,
      smb,
      ecosystem
    );

    // 10b. Emissive Geothermal Vents, Deep Bioluminescence, Crystal Glint, Spectral Optics & Collect Bursts
    this._drawSpectralAbsorption(ctx, cw, ch, diver, toScreenX, toScreenY, scale);
    if (Array.isArray(this.level.geothermalVents) && this.level.geothermalVents.length > 0) {
      this._drawGeothermalVents(ctx, viewWorldLeft, viewWorldRight, visY0, visY1, toScreenX, toScreenY, scale, timeSec);
    }
    if (this.level.theme?.bioluminescent || this._activeWeather?.forceBiolum) {
      this._drawBioluminescence(ctx, viewWorldLeft, viewWorldRight, visY0, visY1, toScreenX, toScreenY, scale, timeSec);
    }
    if (bioWake && bioWake.length > 0 && typeof this._drawBioWake === 'function') {
      this._drawBioWake(ctx, bioWake, visX0 - 2, visX1 + 2, visY0 - 2, visY1 + 2, toScreenX, toScreenY, scale, timeSec);
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
    if ((blackBox || (Array.isArray(lineCookies) && lineCookies.length > 0)) && typeof this._drawBlackBoxAndCookies === 'function') {
      this._drawBlackBoxAndCookies(ctx, blackBox, lineCookies, diver, toScreenX, toScreenY, scale, timeSec, Boolean(sonarPulse));
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

    // 11a. Active Acoustic Cave Sonar Overlay (drawn POST-silt so echoes pierce zero-vis silt-outs! v142)
    if (sonarPulse) {
      this._drawSonarPulse(ctx, sonarPulse, toScreenX, toScreenY, scale, timeSec);
    }

    // 11b. Diegetic Depth Bands, Gas-Switch / Deco Hover Zones, Waypoint, Offscreen Buddy Pings & Ascent Pacer
    if (!isPhotoMode) {
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
      this._drawPeerEdgeIndicators(ctx, cw, ch, diver, peerList, toScreenX, toScreenY, timeSec);
      if (celebrationParticles && celebrationParticles.length > 0) {
        this._drawCelebrationParticles(ctx, celebrationParticles, cw, ch);
      }
      if (!endedState) {
        this._drawAscentCoach(ctx, diver, diveState, checkpointsHit, toScreenX, toScreenY, scale, nextCheckpoint, timeSec);
        if (compactHud) {
          this._drawDiegeticImmersionTape(ctx, cw, ch, diver, diveState, nextCheckpoint, timeSec);
        }
      }
    }

    // 12. Physiology Screen Vignettes & Emergency Drill Visor FX (skipped while spectating or in Photo Mode)
    if (!isSpectating && !isPhotoMode) {
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

      const sx0 = (cx0 - chnk.x0) * pxPerM;
      const sw = (cx1 - cx0) * pxPerM;
      const sy0 = (cy0 - tileY0) * pxPerM;
      const sh = (cy1 - cy0) * pxPerM;
      ctx.drawImage(
        chnk.canvas,
        sx0,
        sy0,
        sw,
        sh,
        toScreenX(cx0),
        toScreenY(cy0),
        (cx1 - cx0) * scale,
        (cy1 - cy0) * scale
      );
    }
  }

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
  }

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
  }

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
  }

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
    return SURFACE_SOIL_PALETTES[style] || SURFACE_SOIL_PALETTES.yucatan;
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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  _drawWreckSurfaceBoat(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec) {
    const boatX = this.level.spawn?.x ?? 0;
    if (boatX + 14 < visX0 || boatX - 14 > visX1) return;
    const bobY = Math.sin(timeSec * 1.7) * 0.14;
    const pitch = Math.sin(timeSec * 1.35 + 0.6) * 0.022;
    const bx = toScreenX(boatX);
    const by = toScreenY(bobY);
    const surfY = toScreenY(0);

    const boatImg = this._getSurfaceProp('boat');
    if (boatImg) {
      const iw = boatImg.naturalWidth || boatImg.width;
      const ih = boatImg.naturalHeight || boatImg.height;
      const bw = 12.2 * scale;
      const bh = bw * (ih / iw);
      const hullDraftY = bh * 0.23; // Submerge bottom ~23% (keel + ladder rungs) below waterline

      ctx.save();
      // 1. Live vertically-flipped rippled water reflection synchronized with hull bob & pitch
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx - bw * 0.65, surfY, bw * 1.3, bh * 0.85);
      ctx.clip();
      const bobDelta = by - surfY;
      ctx.translate(bx, surfY - bobDelta * 0.52);
      ctx.scale(1, -0.52);
      ctx.rotate(pitch);
      ctx.globalAlpha = 0.24;
      const rippleShift = Math.sin(timeSec * 2.8) * 0.12 * scale;
      ctx.drawImage(boatImg, -bw * 0.5 + rippleShift, -bh + hullDraftY, bw, bh);
      ctx.restore();

      // Soft dark ambient hull shadow under the keel
      ctx.fillStyle = 'rgba(2, 12, 26, 0.42)';
      ctx.beginPath();
      ctx.ellipse(bx, surfY + 0.45 * scale, bw * 0.44, 0.46 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Photorealistic Technical Dive Charter Boat rocking on ocean swell
      ctx.translate(bx, by);
      ctx.rotate(pitch);
      ctx.drawImage(boatImg, -bw * 0.5, -bh + hullDraftY, bw, bh);
      ctx.restore();

      // 3. Animated white sea-foam & waterline lapping ripples across hull beam
      ctx.save();
      ctx.strokeStyle = 'rgba(241, 248, 255, 0.62)';
      ctx.lineWidth = Math.max(1.2, 0.065 * scale);
      ctx.lineCap = 'round';
      for (let w = -3; w <= 3; w++) {
        const ox = bx + w * 1.35 * scale + Math.sin(timeSec * 2.4 + w * 1.3) * 0.18 * scale;
        const oy = surfY + Math.sin(timeSec * 3.1 + w) * 0.05 * scale;
        const len = (0.45 + Math.abs(Math.cos(w * 0.9 + timeSec * 1.5)) * 0.48) * scale;
        ctx.beginPath();
        ctx.moveTo(ox - len * 0.5, oy);
        ctx.lineTo(ox + len * 0.5, oy);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(pitch);

    // Soft dark hull reflection in water beneath the charter vessel
    ctx.fillStyle = 'rgba(2, 12, 26, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 0.55 * scale, 5.4 * scale, 0.55 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main dive boat hull (deep-water fiberglass charter boat, ~10m long)
    ctx.fillStyle = '#0f2942';
    ctx.beginPath();
    ctx.moveTo(-4.8 * scale, 0.35 * scale);
    ctx.lineTo(4.6 * scale, 0.35 * scale);
    ctx.lineTo(5.6 * scale, -0.75 * scale);
    ctx.lineTo(-4.9 * scale, -0.65 * scale);
    ctx.closePath();
    ctx.fill();

    // White upper freeboard & cyan sheer stripe
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(-4.9 * scale, -0.1 * scale);
    ctx.lineTo(5.15 * scale, -0.1 * scale);
    ctx.lineTo(5.65 * scale, -0.95 * scale);
    ctx.lineTo(-4.95 * scale, -0.82 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-4.85 * scale, -0.42 * scale, 10.1 * scale, 0.18 * scale);

    // Wheelhouse cabin & warm lit bridge windows
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-1.3 * scale, -2.25 * scale, 4.1 * scale, 1.42 * scale);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-0.9 * scale, -2.0 * scale, 3.25 * scale, 0.68 * scale);
    ctx.fillStyle = 'rgba(253, 224, 71, 0.42)';
    ctx.fillRect(0.6 * scale, -1.94 * scale, 1.55 * scale, 0.56 * scale);

    // Cabin roof, radar mast & beacon light
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-1.55 * scale, -2.38 * scale, 4.55 * scale, 0.16 * scale);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(1.5, 0.08 * scale);
    ctx.beginPath();
    ctx.moveTo(0.8 * scale, -2.38 * scale);
    ctx.lineTo(0.45 * scale, -3.75 * scale);
    ctx.stroke();

    // Fluttering red-and-white Diver Down flag on stern staff
    const flagWave = Math.sin(timeSec * 5.2) * 0.12 * scale;
    const fx = -3.8 * scale;
    const fy = -2.45 * scale;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = Math.max(1.2, 0.06 * scale);
    ctx.beginPath();
    ctx.moveTo(fx, -0.82 * scale);
    ctx.lineTo(fx, fy - 0.1 * scale);
    ctx.stroke();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx - 1.1 * scale, fy + 0.08 * scale + flagWave);
    ctx.lineTo(fx - 1.1 * scale, fy + 0.72 * scale + flagWave);
    ctx.lineTo(fx, fy + 0.68 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.6, 0.11 * scale);
    ctx.beginPath();
    ctx.moveTo(fx - 0.05 * scale, fy + 0.05 * scale);
    ctx.lineTo(fx - 1.05 * scale, fy + 0.66 * scale + flagWave);
    ctx.stroke();

    // Stern dive platform & boarding ladder descending into open water
    ctx.fillStyle = '#475569';
    ctx.fillRect(-5.45 * scale, -0.12 * scale, 0.7 * scale, 0.22 * scale);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(1.5, 0.075 * scale);
    ctx.beginPath();
    ctx.moveTo(-5.15 * scale, 0.08 * scale);
    ctx.lineTo(-5.35 * scale, 1.85 * scale);
    ctx.moveTo(-4.75 * scale, 0.08 * scale);
    ctx.lineTo(-4.95 * scale, 1.85 * scale);
    for (let r = 0; r < 4; r++) {
      const ry = (0.42 + r * 0.38) * scale;
      ctx.moveTo(-5.2 * scale, ry);
      ctx.lineTo(-4.8 * scale, ry);
    }
    ctx.stroke();

    ctx.restore();
  }

  _drawWreckShipArchitecture(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec) {
    const level = this.level;
    const deckY = level.wreckDeckY ?? 42;
    const seabedY = level.wreckSeabedY ?? 70;
    const hMin = level.wreckHullXMin ?? -24;
    const hMax = level.wreckHullXMax ?? 96;
    if (hMax + 18 < visX0 || hMin - 18 > visX1 || seabedY + 8 < visY0 || deckY - 24 > visY1) return;

    const profile = level.shipProfile || 'default';
    ctx.save();

    if (profile === 'victoria-vertical-battleship') {
      // Dramatic vertical Victorian ironclad battleship spire standing nose-down from 74m to 145m!
      const xL = toScreenX(hMin);
      const xR = toScreenX(hMax);
      const yTop = toScreenY(deckY);
      const yBot = toScreenY(seabedY);
      // Armored steel hull plating band & rivet lines along vertical column
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
      ctx.lineWidth = Math.max(1.2, 0.08 * scale);
      for (let wy = Math.ceil(deckY / 6) * 6; wy <= seabedY; wy += 6) {
        if (wy < visY0 - 2 || wy > visY1 + 2) continue;
        const sy = toScreenY(wy);
        ctx.beginPath();
        ctx.moveTo(xL, sy);
        ctx.lineTo(xR, sy);
        ctx.stroke();
      }
      // Armored casemate gun ports along both outer sides of the vertical spire
      for (let wy = deckY + 14; wy <= seabedY - 12; wy += 10) {
        if (wy < visY0 - 3 || wy > visY1 + 3) continue;
        const sy = toScreenY(wy);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(xL - 0.5 * scale, sy - 0.55 * scale, 1.4 * scale, 1.1 * scale);
        ctx.fillRect(xR - 0.9 * scale, sy - 0.55 * scale, 1.4 * scale, 1.1 * scale);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(1, 0.06 * scale);
        ctx.strokeRect(xL - 0.5 * scale, sy - 0.55 * scale, 1.4 * scale, 1.1 * scale);
        ctx.strokeRect(xR - 0.9 * scale, sy - 0.55 * scale, 1.4 * scale, 1.1 * scale);
      }
      // Upright stern keel rudder blade rising into the blue above 74m
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = Math.max(1.2, 0.09 * scale);
      ctx.beginPath();
      ctx.moveTo(toScreenX(22), yTop);
      ctx.lineTo(toScreenX(25.5), yTop);
      ctx.lineTo(toScreenX(24.8), toScreenY(deckY - 6.5));
      ctx.lineTo(toScreenX(21.8), toScreenY(deckY - 5.2));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Standard horizontal/capsized/split hull silhouette backdrop & bow/stern prow shapes
    const xBow = toScreenX(hMin);
    const xStern = toScreenX(hMax);
    const yDeck = toScreenY(deckY);
    const yBase = toScreenY(seabedY);
    const hullH = Math.max(4, yBase - yDeck);

    // Raked Steel Bow Prow jutting into the deep blue at left end
    if (hMin + 10 >= visX0 && hMin - 18 <= visX1) {
      const bowCol =
        profile === 'fitzgerald-split-freighter'
          ? '#6e2321'
          : profile === 'britannic-hospital-liner'
            ? '#cbd5e1'
            : profile === 'andrea-doria-capsized'
              ? '#334155'
              : '#3b4a5e';
      ctx.fillStyle = bowCol;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.moveTo(xBow + 2 * scale, yDeck);
      ctx.lineTo(xBow - 9.5 * scale, yDeck - 1.8 * scale);
      ctx.quadraticCurveTo(xBow - 5.5 * scale, yDeck + hullH * 0.55, xBow + 1.5 * scale, yBase);
      ctx.closePath();
      ctx.fill();
      // Anti-fouling red oxide lower bow hull stripe
      ctx.fillStyle = '#7f1d1d';
      ctx.globalAlpha = 0.58;
      ctx.beginPath();
      ctx.moveTo(xBow - 5.2 * scale, yDeck + hullH * 0.55);
      ctx.lineTo(xBow + 2 * scale, yDeck + hullH * 0.55);
      ctx.lineTo(xBow + 2 * scale, yBase);
      ctx.lineTo(xBow - 1.2 * scale, yBase);
      ctx.closePath();
      ctx.fill();
      // Hawsepipe oval & Plimsoll draft marks
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(xBow - 3.6 * scale, yDeck + 2.4 * scale, 0.7 * scale, 0.45 * scale, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = Math.max(1.2, 0.08 * scale);
      ctx.stroke();
    }

    // Counter-stern overhang & rudder post at right end
    if (hMax + 18 >= visX0 && hMax - 10 <= visX1) {
      ctx.fillStyle = profile === 'fitzgerald-split-freighter' ? '#6e2321' : '#334155';
      ctx.globalAlpha = 0.68;
      ctx.beginPath();
      ctx.moveTo(xStern - 2 * scale, yDeck);
      ctx.lineTo(xStern + 7.5 * scale, yDeck - 0.6 * scale);
      ctx.quadraticCurveTo(xStern + 4.5 * scale, yDeck + hullH * 0.45, xStern - 1.5 * scale, yBase);
      ctx.closePath();
      ctx.fill();
    }

    // Ship-specific iconic exterior livery & superstructure details
    ctx.globalAlpha = 1;
    if (profile === 'oriskany-carrier') {
      // Flight Deck angled yellow/white catapult tracks & deck edge stripes
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.42)';
      ctx.lineWidth = Math.max(2, 0.14 * scale);
      ctx.setLineDash([1.6 * scale, 1.1 * scale]);
      ctx.beginPath();
      ctx.moveTo(xBow, yDeck - 0.25 * scale);
      ctx.lineTo(xStern, yDeck - 0.25 * scale);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (profile === 'britannic-hospital-liner') {
      // Iconic HMHS Britannic faded green hospital stripe & Red Cross hull emblem
      const stripeY = yDeck + 3.2 * scale;
      ctx.fillStyle = 'rgba(22, 163, 74, 0.28)';
      ctx.fillRect(xBow, stripeY, xStern - xBow, 2.2 * scale);
      const crossX = toScreenX(42);
      const crossY = yDeck + 4.3 * scale;
      if (42 + 12 >= visX0 && 42 - 12 <= visX1) {
        ctx.fillStyle = 'rgba(248, 250, 252, 0.26)';
        ctx.beginPath();
        ctx.arc(crossX, crossY, 2.7 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(220, 38, 38, 0.48)';
        ctx.fillRect(crossX - 0.55 * scale, crossY - 1.8 * scale, 1.1 * scale, 3.6 * scale);
        ctx.fillRect(crossX - 1.8 * scale, crossY - 0.55 * scale, 3.6 * scale, 1.1 * scale);
      }
    } else if (profile === 'fitzgerald-split-freighter') {
      // Catastrophic jagged midships break & dark iron-ore taconite pellet mounds in the 161m trench
      const breakX1 = toScreenX(48);
      const breakX2 = toScreenX(84);
      const trenchY = toScreenY(161.5);
      if (86 >= visX0 && 44 <= visX1) {
        ctx.fillStyle = 'rgba(30, 27, 24, 0.72)';
        ctx.beginPath();
        ctx.moveTo(breakX1, trenchY + 2 * scale);
        ctx.quadraticCurveTo((breakX1 + breakX2) * 0.5, trenchY - 4.2 * scale, breakX2, trenchY + 2 * scale);
        ctx.closePath();
        ctx.fill();
        // Jagged torn steel hull plates facing inward across the split
        ctx.strokeStyle = 'rgba(180, 83, 9, 0.55)';
        ctx.lineWidth = Math.max(2, 0.14 * scale);
        ctx.beginPath();
        ctx.moveTo(breakX1, toScreenY(134));
        ctx.lineTo(breakX1 + 2.8 * scale, toScreenY(141));
        ctx.lineTo(breakX1 - 0.8 * scale, toScreenY(148));
        ctx.lineTo(breakX1 + 3.2 * scale, toScreenY(155));
        ctx.moveTo(breakX2, toScreenY(142));
        ctx.lineTo(breakX2 - 3.0 * scale, toScreenY(148));
        ctx.lineTo(breakX2 + 1.0 * scale, toScreenY(154));
        ctx.stroke();
      }
    } else if (profile === 'thistlegorm-cargo-wreck') {
      // Dramatic midships WWII ammunition blast crater jagged plates & scattered munitions silhouette
      const bx1 = toScreenX(45);
      const bx2 = toScreenX(65);
      if (67 >= visX0 && 43 <= visX1) {
        ctx.strokeStyle = 'rgba(217, 119, 6, 0.62)';
        ctx.lineWidth = Math.max(2, 0.14 * scale);
        ctx.beginPath();
        ctx.moveTo(bx1, toScreenY(26));
        ctx.lineTo(bx1 + 2.4 * scale, toScreenY(31));
        ctx.lineTo(bx1 - 0.6 * scale, toScreenY(36));
        ctx.lineTo(bx1 + 2.8 * scale, toScreenY(41));
        ctx.moveTo(bx2, toScreenY(26));
        ctx.lineTo(bx2 - 2.6 * scale, toScreenY(32));
        ctx.lineTo(bx2 + 0.8 * scale, toScreenY(37));
        ctx.lineTo(bx2 - 2.2 * scale, toScreenY(42));
        ctx.stroke();
      }
    } else if (profile === 'u1206-submarine') {
      // Type VIIC U-Boat saddle-tank flood vents, bow hydroplanes & hull stencil
      ctx.fillStyle = 'rgba(15, 23, 42, 0.68)';
      const slitStart = Math.max(hMin + 4, Math.floor(visX0 / 4) * 4);
      const slitEnd = Math.min(hMax - 4, visX1 + 4);
      for (let wx = slitStart; wx <= slitEnd; wx += 4) {
        const sx = toScreenX(wx);
        ctx.fillRect(sx - 0.7 * scale, yDeck + 3.2 * scale, 1.4 * scale, 0.55 * scale);
      }
      // Forward & aft submarine diving hydroplanes
      if (hMin + 12 >= visX0 && hMin - 10 <= visX1) {
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = Math.max(1.2, 0.08 * scale);
        ctx.beginPath();
        ctx.ellipse(xBow + 2.5 * scale, yDeck + 5.2 * scale, 3.2 * scale, 0.65 * scale, -0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (hMax + 10 >= visX0 && hMax - 12 <= visX1) {
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.ellipse(xStern - 2.2 * scale, yDeck + 6.4 * scale, 2.8 * scale, 0.58 * scale, 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Subtle riveted vertical hull frame seams along the exterior backdrop
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = Math.max(1, 0.05 * scale);
    const seamStart = Math.max(hMin, Math.floor(visX0 / 8) * 8);
    const seamEnd = Math.min(hMax, visX1 + 8);
    for (let wx = seamStart; wx <= seamEnd; wx += 8) {
      const sx = toScreenX(wx);
      ctx.beginPath();
      ctx.moveTo(sx, yDeck);
      ctx.lineTo(sx, yBase);
      ctx.stroke();
    }

    // Signature underwater shipwreck bridge landmark (Brass Engine Order Telegraph anchored on intact deck)
    if (profile !== 'victoria-vertical-battleship') {
      const teleWx = profile === 'fitzgerald-split-freighter' ? 14 : (hMin + hMax) * 0.5 + 3.2;
      const teleWy = this._getHorizonGroundY(level, teleWx);
      if (teleWx + 4 >= visX0 && teleWx - 4 <= visX1 && teleWy + 4 >= visY0 && teleWy - 6 <= visY1) {
        const tx = toScreenX(teleWx);
        const ty = toScreenY(teleWy);
        ctx.save();
        ctx.translate(tx, ty);
        ctx.fillStyle = '#85622c';
        ctx.fillRect(-0.18 * scale, -1.45 * scale, 0.36 * scale, 1.45 * scale);
        ctx.fillStyle = '#d4a64a';
        ctx.strokeStyle = '#5c4119';
        ctx.lineWidth = Math.max(1.2, 0.06 * scale);
        ctx.beginPath();
        ctx.arc(0, -1.68 * scale, 0.44 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(0, -1.68 * scale, 0.3 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = Math.max(1.2, 0.05 * scale);
        ctx.beginPath();
        ctx.moveTo(0, -1.68 * scale);
        ctx.lineTo(0.28 * scale, -2.18 * scale);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  _drawWreckBackdropDetails(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, wreckState = null) {
    const level = this.level;
    ctx.save();

    // 0. Bespoke Exterior Ship Hull Silhouette, Bow/Stern Prow, Paint Livery & Plate Seams
    this._drawWreckShipArchitecture(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec);

    // 1. Layered Ocean Drift Current flow filaments
    if (Array.isArray(level.driftCurrents)) {
      ctx.lineCap = 'round';
      for (let c = 0; c < level.driftCurrents.length; c++) {
        const cur = level.driftCurrents[c];
        if (cur.yMax < visY0 || cur.yMin > visY1) continue;
        const dir = (cur.vx || 0) >= 0 ? 1 : -1;
        const spd = Math.max(0.4, Math.abs(cur.vx || 0.8));
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.25)';
        ctx.lineWidth = Math.max(1, 0.048 * scale);
        ctx.beginPath();
        for (let k = 0; k < 14; k++) {
          const frac = (k + 0.5) / 14;
          const wy = cur.yMin + (cur.yMax - cur.yMin) * frac;
          if (wy < visY0 - 1 || wy > visY1 + 1) continue;
          const span = Math.max(24, visX1 - visX0 + 14);
          const rawX = ((timeSec * spd * 3.4 * dir + k * 9.7) % span + span) % span;
          const wx = visX0 - 7 + rawX;
          const sx = toScreenX(wx);
          const sy = toScreenY(wy);
          const len = (1.8 + (k % 3) * 0.75) * scale * dir;
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + len, sy + Math.sin(timeSec * 1.4 + k) * 0.14 * scale);
        }
        ctx.stroke();
      }
    }

    // 2. Weighted Anchor / Shot Line from Dive Boat to Wreck Deck + Multi-Stage Deco Bottles & 6m O2 Trapeze Bar
    const shotX = level.shotLine?.x ?? level.spawn?.x ?? 0;
    const shotY0 = 0.35;
    const shotY1 = level.shotLine?.bottomY ?? level.wreckDeckY ?? 40;
    const isClipped = Boolean(wreckState?.clippedToShotLine);
    if (shotX + 8 >= visX0 && shotX - 8 <= visX1 && shotY1 >= visY0 && shotY0 <= visY1) {
      const sway = (y) => Math.sin(y * 0.11 + timeSec * 1.1) * 0.28 * Math.sin(Math.min(1, y / Math.max(1, shotY1)) * Math.PI);
      // Glowing cyan sheath when diver is clipped on for zip-descent/ascent
      if (isClipped) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
        ctx.lineWidth = Math.max(5, 0.26 * scale);
        ctx.beginPath();
        const segs = Math.max(8, Math.ceil((shotY1 - shotY0) / 3));
        for (let i = 0; i <= segs; i++) {
          const wy = shotY0 + ((shotY1 - shotY0) * i) / segs;
          const sx = toScreenX(shotX + sway(wy));
          const sy = toScreenY(wy);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = isClipped ? 'rgba(125, 211, 252, 0.95)' : 'rgba(250, 204, 21, 0.82)';
      ctx.lineWidth = Math.max(1.8, 0.08 * scale);
      ctx.beginPath();
      const segs = Math.max(8, Math.ceil((shotY1 - shotY0) / 3));
      for (let i = 0; i <= segs; i++) {
        const wy = shotY0 + ((shotY1 - shotY0) * i) / segs;
        const sx = toScreenX(shotX + sway(wy));
        const sy = toScreenY(wy);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Depth distance tick marks every 10m along the shot line so vertical descent has crisp speed feel!
      ctx.font = `600 ${Math.max(9, Math.round(scale * 0.28))}px ui-monospace, monospace`;
      ctx.textAlign = 'left';
      for (let wy = 10; wy < shotY1 - 3; wy += 10) {
        if (wy < visY0 - 2 || wy > visY1 + 2) continue;
        const tx = toScreenX(shotX + sway(wy));
        const ty = toScreenY(wy);
        ctx.fillStyle = 'rgba(226, 232, 240, 0.55)';
        ctx.fillRect(tx - 0.16 * scale, ty - 0.04 * scale, 0.32 * scale, 0.08 * scale);
        ctx.fillStyle = 'rgba(186, 230, 253, 0.68)';
        ctx.fillText(`${wy}m`, tx + 0.35 * scale, ty + 0.1 * scale);
      }

      // Staged spare bailout/deco cylinders clipped along deep shot line (e.g. 22m, 42m, 60m)
      const stages = Array.isArray(level.shotLine?.decoStagesY) ? level.shotLine.decoStagesY : [22.0, 6.0];
      for (let st = 0; st < stages.length; st++) {
        const syW = stages[st];
        if (syW <= 7 || syW >= shotY1 - 2 || syW < visY0 - 3 || syW > visY1 + 3) continue;
        const mx = toScreenX(shotX + sway(syW));
        const my = toScreenY(syW);
        // Hanging AL80 stage bottle clipped to shot line
        ctx.fillStyle = syW <= 25 ? '#fbbf24' : '#38bdf8';
        ctx.fillRect(mx + 0.32 * scale, my - 0.42 * scale, 0.32 * scale, 0.98 * scale);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(mx + 0.32 * scale, my - 0.22 * scale, 0.32 * scale, 0.18 * scale);
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(mx, my, 0.26 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // 6m O2 Deco Trapeze Bar suspended beneath the dive boat
      const barY = 5.4;
      if (barY >= visY0 - 4 && barY <= visY1 + 4) {
        const bx = toScreenX(shotX + sway(barY));
        const by = toScreenY(barY);
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
        ctx.lineWidth = Math.max(1, 0.045 * scale);
        ctx.beginPath();
        ctx.moveTo(bx - 1.9 * scale, toScreenY(0.3));
        ctx.lineTo(bx - 1.9 * scale, by);
        ctx.moveTo(bx + 1.9 * scale, toScreenY(0.3));
        ctx.lineTo(bx + 1.9 * scale, by);
        ctx.stroke();

        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = Math.max(3, 0.16 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - 2.2 * scale, by);
        ctx.lineTo(bx + 2.2 * scale, by);
        ctx.stroke();

        for (const ox of [-1.25, 1.25]) {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(bx + (ox - 0.15) * scale, by + 0.12 * scale, 0.3 * scale, 0.92 * scale);
          ctx.fillStyle = '#ecfdf5';
          ctx.fillRect(bx + (ox - 0.15) * scale, by + 0.25 * scale, 0.3 * scale, 0.16 * scale);
        }
        ctx.font = `700 ${Math.max(10, Math.round(scale * 0.36))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(167, 243, 208, 0.92)';
        ctx.fillText('6m O₂ DECO BAR', bx, by - 0.34 * scale);
      }
    }

    // 3. Shipwreck Architectural Landmarks, Chains, Railings, Davits & Glowing Porthole Light Cones
    if (Array.isArray(level.wreckProps)) {
      for (let i = 0; i < level.wreckProps.length; i++) {
        const prop = level.wreckProps[i];
        const margin = Math.max((prop.scale || 1) * 14, prop.len || 0, prop.chainLen || 0);
        if (prop.x + margin < visX0 || prop.x - margin > visX1 || prop.y + margin < visY0 || prop.y - margin > visY1) continue;
        const sx = toScreenX(prop.x);
        const sy = toScreenY(prop.y);
        const ps = (prop.scale || 1) * scale;

        if (prop.kind === 'anchor') {
          // Heavy iron anchor chain draped down from bow hawsepipe toward seabed gloom
          const clen = (prop.chainLen || 22) * scale;
          ctx.strokeStyle = 'rgba(71, 85, 105, 0.78)';
          ctx.lineWidth = Math.max(2.2, 0.16 * scale);
          ctx.setLineDash([0.35 * scale, 0.16 * scale]);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx - 2.4 * scale, sy + clen * 0.55, sx - 1.2 * scale, sy + clen);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (prop.kind === 'railing') {
          // Weathered ship deck stanchions & partially broken handrail
          const rlen = (prop.len || 16) * scale;
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.52)';
          ctx.lineWidth = Math.max(1.2, 0.06 * scale);
          ctx.beginPath();
          ctx.moveTo(sx, sy - 1.05 * scale);
          ctx.lineTo(sx + rlen, sy - 1.05 * scale);
          ctx.moveTo(sx, sy - 0.55 * scale);
          ctx.lineTo(sx + rlen * 0.85, sy - 0.55 * scale);
          const posts = Math.max(3, Math.floor((prop.len || 16) / 2.2));
          for (let p = 0; p <= posts; p++) {
            const px = sx + (p / posts) * rlen;
            ctx.moveTo(px, sy);
            ctx.lineTo(px, sy - 1.1 * scale);
          }
          ctx.stroke();
        } else if (prop.kind === 'davit') {
          // Curved steel ocean-liner lifeboat davit arm jutting out into the blue
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(prop.angle || 0);
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = Math.max(2.5, 0.22 * ps);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(-0.4 * ps, -3.2 * ps, 1.8 * ps, -4.4 * ps);
          ctx.stroke();
          // Dangling pulley fall rope
          ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
          ctx.lineWidth = Math.max(1, 0.05 * ps);
          ctx.beginPath();
          ctx.moveTo(1.8 * ps, -4.4 * ps);
          ctx.lineTo(1.8 * ps + Math.sin(timeSec * 1.1 + i) * 0.35 * ps, -1.2 * ps);
          ctx.stroke();
          ctx.restore();
        } else if (prop.kind === 'mast') {
          // Tall lattice radar mast rising into sunlit upper water
          ctx.save();
          ctx.translate(sx, sy);
          ctx.strokeStyle = 'rgba(100, 116, 139, 0.72)';
          ctx.lineWidth = Math.max(1.5, 0.1 * ps);
          ctx.beginPath();
          ctx.moveTo(-1.1 * ps, 0);
          ctx.lineTo(0, -10.5 * ps);
          ctx.lineTo(1.1 * ps, 0);
          ctx.moveTo(-3.4 * ps, -6.5 * ps);
          ctx.lineTo(3.4 * ps, -6.5 * ps);
          ctx.moveTo(-2.1 * ps, -9.2 * ps);
          ctx.lineTo(2.1 * ps, -9.2 * ps);
          ctx.stroke();
          ctx.restore();
        } else if (prop.kind === 'pipe') {
          // Overhead riveted engine-room steam pipe run
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(prop.angle || 0);
          const plen = (prop.len || 10) * scale;
          ctx.fillStyle = '#523a28';
          ctx.fillRect(-plen * 0.5, -0.22 * scale, plen, 0.44 * scale);
          ctx.fillStyle = 'rgba(251, 146, 60, 0.22)';
          ctx.fillRect(-plen * 0.5, -0.18 * scale, plen, 0.12 * scale);
          // Pipe flange rings
          ctx.fillStyle = '#334155';
          for (let f = -plen * 0.4; f <= plen * 0.4; f += 2.8 * scale) {
            ctx.fillRect(f - 0.09 * scale, -0.32 * scale, 0.18 * scale, 0.64 * scale);
          }
          ctx.restore();
        } else if (prop.kind === 'porthole') {
          const ang = prop.angle ?? 0.65;
          const beamLen = (prop.beamLen || 5.8) * scale;
          const grad = ctx.createLinearGradient(sx, sy, sx + Math.cos(ang) * beamLen, sy + Math.sin(ang) * beamLen);
          grad.addColorStop(0, 'rgba(125, 211, 252, 0.36)');
          grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(sx - Math.sin(ang) * 0.32 * scale, sy + Math.cos(ang) * 0.32 * scale);
          ctx.lineTo(sx + Math.sin(ang) * 0.32 * scale, sy - Math.cos(ang) * 0.32 * scale);
          ctx.lineTo(sx + Math.cos(ang) * beamLen + Math.sin(ang) * 1.45 * scale, sy + Math.sin(ang) * beamLen - Math.cos(ang) * 1.45 * scale);
          ctx.lineTo(sx + Math.cos(ang) * beamLen - Math.sin(ang) * 1.45 * scale, sy + Math.sin(ang) * beamLen + Math.cos(ang) * 1.45 * scale);
          ctx.closePath();
          ctx.fill();
        } else if (prop.kind === 'propeller') {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(prop.angle || 0);
          for (let b = 0; b < 3; b++) {
            ctx.save();
            ctx.rotate((b * Math.PI * 2) / 3);
            ctx.fillStyle = '#9a7b4f';
            ctx.strokeStyle = '#4a3721';
            ctx.lineWidth = Math.max(1.2, 0.08 * scale);
            ctx.beginPath();
            ctx.ellipse(0, -1.55 * ps, 0.64 * ps, 1.52 * ps, 0.16, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
          ctx.fillStyle = '#c29e65';
          ctx.beginPath();
          ctx.arc(0, 0, 0.58 * ps, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (prop.kind === 'funnel') {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(prop.angle || 0.35);
          ctx.fillStyle = '#6b4226';
          ctx.fillRect(-2.0 * ps, -4.5 * ps, 4.0 * ps, 9.0 * ps);
          ctx.fillStyle = '#b46534';
          ctx.fillRect(-2.0 * ps, -2.5 * ps, 4.0 * ps, 1.6 * ps);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-2.0 * ps, -4.5 * ps, 4.0 * ps, 1.2 * ps);
          // Steam whistle pipe alongside funnel
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(1.2, 0.14 * ps);
          ctx.beginPath();
          ctx.moveTo(2.25 * ps, -4.0 * ps);
          ctx.lineTo(2.25 * ps, 4.2 * ps);
          ctx.stroke();
          ctx.restore();
        } else if (prop.kind === 'island') {
          ctx.save();
          ctx.translate(sx, sy);
          // Tiered Essex-class carrier bridge superstructure with Pri-Fly & hull number "34"
          ctx.fillStyle = '#334155';
          ctx.fillRect(-4.2 * ps, -9.8 * ps, 8.4 * ps, 10.6 * ps);
          ctx.fillStyle = '#475569';
          ctx.fillRect(-2.8 * ps, -14.0 * ps, 5.6 * ps, 4.4 * ps);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(1.6 * ps, -12.6 * ps, 2.2 * ps, 3.2 * ps); // Funnel stack
          // Bridge windows
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.fillRect(-3.4 * ps, -8.5 * ps, 6.4 * ps, 1.15 * ps);
          ctx.fillRect(-2.2 * ps, -12.8 * ps, 3.2 * ps, 0.95 * ps);
          // Hull number "34" painted on the island side
          ctx.font = `800 ${Math.max(10, Math.round(1.9 * ps))}px ui-sans-serif, system-ui, sans-serif`;
          ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
          ctx.textAlign = 'center';
          ctx.fillText('34', -1.2 * ps, -3.5 * ps);
          ctx.restore();
        } else if (prop.kind === 'turret') {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(prop.angle || 0);
          ctx.fillStyle = '#475569';
          ctx.fillRect(0.6 * ps, -0.6 * ps, 6.6 * ps, 0.44 * ps);
          ctx.fillRect(0.6 * ps, 0.16 * ps, 6.6 * ps, 0.44 * ps);
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(0, 0, 2.3 * ps, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(1.5, 0.11 * ps);
          ctx.stroke();
          ctx.restore();
        } else if (prop.kind === 'pilothouse') {
          ctx.save();
          ctx.translate(sx, sy);
          // White Great Lakes forecastle & open Pilot House windows + glowing memorial bronze bell
          ctx.fillStyle = '#64748b';
          ctx.fillRect(-4.2 * ps, -4.6 * ps, 8.4 * ps, 5.0 * ps);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(-4.5 * ps, -5.0 * ps, 9.0 * ps, 0.6 * ps);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-3.4 * ps, -3.6 * ps, 6.8 * ps, 1.5 * ps);
          // Warm memorial halo around 1995 replica bronze bell
          ctx.fillStyle = 'rgba(251, 191, 36, 0.24)';
          ctx.beginPath();
          ctx.arc(0, -5.6 * ps, 1.45 * ps, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(0, -5.6 * ps, 0.68 * ps, Math.PI, 0);
          ctx.lineTo(0.88 * ps, -4.95 * ps);
          ctx.lineTo(-0.88 * ps, -4.95 * ps);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (prop.kind === 'crane') {
          // Angled WWII cargo derrick crane boom + suspended hook cable
          ctx.save();
          ctx.translate(sx, sy);
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = Math.max(2, 0.18 * ps);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -7.8 * ps);
          ctx.stroke();
          ctx.save();
          ctx.translate(0, -6.5 * ps);
          ctx.rotate(prop.angle || 0.25);
          ctx.lineWidth = Math.max(2, 0.16 * ps);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(8.5 * ps, -2.2 * ps);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
          ctx.lineWidth = Math.max(1, 0.05 * ps);
          ctx.beginPath();
          ctx.moveTo(8.5 * ps, -2.2 * ps);
          ctx.lineTo(8.5 * ps + Math.sin(timeSec * 1.2 + i) * 0.35 * ps, 3.8 * ps);
          ctx.stroke();
          ctx.restore();
          ctx.restore();
        } else if (prop.kind === 'locomotive') {
          // Iconic WWII Stanier 8F Steam Locomotive resting upright on the Red Sea floor
          ctx.save();
          ctx.translate(sx, sy);
          ctx.fillStyle = '#47362b';
          ctx.strokeStyle = '#785a46';
          ctx.lineWidth = Math.max(1.2, 0.08 * ps);
          ctx.beginPath();
          ctx.roundRect(-5.2 * ps, -2.9 * ps, 8.2 * ps, 2.2 * ps, 0.6 * ps);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#3b2d24';
          ctx.fillRect(2.6 * ps, -3.5 * ps, 2.6 * ps, 2.9 * ps);
          ctx.fillRect(-4.2 * ps, -4.3 * ps, 0.85 * ps, 1.5 * ps);
          ctx.beginPath();
          ctx.arc(-1.2 * ps, -2.9 * ps, 0.65 * ps, Math.PI, 0);
          ctx.fill();
          ctx.strokeStyle = '#9a7b5c';
          ctx.lineWidth = Math.max(1.5, 0.1 * ps);
          for (let w = -3.4; w <= 3.6; w += 1.75) {
            ctx.beginPath();
            ctx.arc(w * ps, -0.55 * ps, 0.68 * ps, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        } else if (prop.kind === 'conning-tower') {
          // WWII Type VIIC U-Boat armored conning tower with twin periscopes & hull stencil
          ctx.save();
          ctx.translate(sx, sy);
          ctx.fillStyle = '#334155';
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = Math.max(1.5, 0.09 * ps);
          ctx.beginPath();
          ctx.moveTo(-4.8 * ps, 0.5 * ps);
          ctx.lineTo(-3.6 * ps, -5.8 * ps);
          ctx.lineTo(3.2 * ps, -5.8 * ps);
          ctx.lineTo(4.6 * ps, 0.5 * ps);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#475569';
          ctx.fillRect(2.8 * ps, -4.6 * ps, 2.6 * ps, 2.2 * ps);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(2, 0.14 * ps);
          ctx.beginPath();
          ctx.moveTo(-1.2 * ps, -5.8 * ps);
          ctx.lineTo(-1.2 * ps, -10.8 * ps);
          ctx.lineTo(-1.9 * ps, -10.8 * ps);
          ctx.moveTo(0.8 * ps, -5.8 * ps);
          ctx.lineTo(0.8 * ps, -9.2 * ps);
          ctx.stroke();
          ctx.font = `800 ${Math.max(9, Math.round(1.1 * ps))}px ui-sans-serif, system-ui, sans-serif`;
          ctx.fillStyle = 'rgba(226, 232, 240, 0.48)';
          ctx.textAlign = 'center';
          ctx.fillText('U-1206', -0.4 * ps, -2.2 * ps);
          ctx.restore();
        }
      }
    }

    ctx.restore();
  }

  _drawWreckForegroundHazards(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, diver = null, wreckState = null, mechFx = null) {
    const level = this.level;
    ctx.save();

    // 1. Interior Steel Bulkhead Rib Frames along wreck corridors (so interiors read as steel rooms!)
    if (Array.isArray(level.segments)) {
      ctx.strokeStyle = 'rgba(120, 74, 44, 0.34)';
      ctx.lineWidth = Math.max(1.4, 0.11 * scale);
      for (let i = 0; i < level.segments.length; i++) {
        const s = level.segments[i];
        const minX = Math.min(s.ax, s.bx) - 5;
        const maxX = Math.max(s.ax, s.bx) + 5;
        const minY = Math.min(s.ay, s.by) - 5;
        const maxY = Math.max(s.ay, s.by) + 5;
        if (maxX < visX0 || minX > visX1 || maxY < visY0 || minY > visY1) continue;
        const dx = s.bx - s.ax;
        const dy = s.by - s.ay;
        const len = Math.hypot(dx, dy);
        if (len < 4) continue;
        const nx = -dy / len;
        const ny = dx / len;
        const ribs = Math.max(2, Math.floor(len / 7.5));
        for (let r = 1; r < ribs; r++) {
          const t = r / ribs;
          const cx = s.ax + dx * t;
          const cy = s.ay + dy * t;
          const rad = s.ra + (s.rb - s.ra) * t;
          // Draw crisp steel frame brackets on both walls of the corridor
          const p1x = toScreenX(cx + nx * (rad * 0.92));
          const p1y = toScreenY(cy + ny * (rad * 0.92));
          const p2x = toScreenX(cx + nx * (rad * 0.62));
          const p2y = toScreenY(cy + ny * (rad * 0.62));
          const q1x = toScreenX(cx - nx * (rad * 0.92));
          const q1y = toScreenY(cy - ny * (rad * 0.92));
          const q2x = toScreenX(cx - nx * (rad * 0.62));
          const q2y = toScreenY(cy - ny * (rad * 0.62));
          ctx.beginPath();
          ctx.moveTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
          ctx.moveTo(q1x, q1y);
          ctx.lineTo(q2x, q2y);
          ctx.stroke();
        }
      }
    }

    // 2. Riveted steel beams & brass porthole rims
    if (Array.isArray(level.wreckProps)) {
      for (let i = 0; i < level.wreckProps.length; i++) {
        const prop = level.wreckProps[i];
        if (prop.x + 8 < visX0 || prop.x - 8 > visX1 || prop.y + 8 < visY0 || prop.y - 8 > visY1) continue;
        const sx = toScreenX(prop.x);
        const sy = toScreenY(prop.y);
        if (prop.kind === 'porthole') {
          ctx.fillStyle = 'rgba(186, 230, 253, 0.55)';
          ctx.beginPath();
          ctx.arc(sx, sy, 0.36 * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#b47b3a';
          ctx.lineWidth = Math.max(2, 0.12 * scale);
          ctx.stroke();
        } else if (prop.kind === 'beam') {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(prop.angle || 0);
          const len = (prop.len || 4.2) * scale;
          ctx.fillStyle = '#4a3525';
          ctx.fillRect(-len * 0.5, -0.18 * scale, len, 0.36 * scale);
          ctx.strokeStyle = '#8b5328';
          ctx.lineWidth = Math.max(1, 0.05 * scale);
          ctx.strokeRect(-len * 0.5, -0.18 * scale, len, 0.36 * scale);
          // Rivet dots along I-beam web
          ctx.fillStyle = '#b47b3a';
          for (let rv = -len * 0.42; rv <= len * 0.42; rv += 0.55 * scale) {
            ctx.beginPath();
            ctx.arc(rv, 0, Math.max(1, 0.04 * scale), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }
    }

    // 3. Timed Hull-Breach Surge Current Jet Streams (pulsing in exact phase with physics!)
    if (Array.isArray(level.surgeZones)) {
      for (let z = 0; z < level.surgeZones.length; z++) {
        const zone = level.surgeZones[z];
        const zr = zone.radius || 4.0;
        if (zone.x + zr + 2 < visX0 || zone.x - zr - 2 > visX1 || zone.y + zr + 2 < visY0 || zone.y - zr - 2 > visY1) continue;
        const wave = computeSurgeWave(zone, timeSec);
        const sx = toScreenX(zone.x);
        const sy = toScreenY(zone.y);
        const sr = zr * scale;
        const mag = Math.hypot(zone.vx || 0, zone.vy || 0) || 1;
        const dirX = (zone.vx || 0) / mag;
        const dirY = (zone.vy || 0) / mag;
        const flowSign = wave >= 0 ? 1 : -1;
        const strength = Math.abs(wave);

        if (strength > 0.05) {
          // Active surging water jets & directional chevrons
          const ang = Math.atan2(dirY * flowSign, dirX * flowSign);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(ang);
          ctx.strokeStyle = `rgba(125, 211, 252, ${0.22 + strength * 0.58})`;
          ctx.lineWidth = Math.max(1.5, (0.06 + strength * 0.06) * scale);
          ctx.lineCap = 'round';
          for (let k = -2; k <= 2; k++) {
            const oy = k * sr * 0.32;
            const travel = ((timeSec * 5.2 + k * 0.7) % 1.0) * 2 - 1;
            const ox = travel * sr * 0.55;
            const segLen = sr * (0.35 + strength * 0.25);
            ctx.beginPath();
            ctx.moveTo(ox - segLen * 0.5, oy);
            ctx.lineTo(ox + segLen * 0.5, oy);
            // Directional chevron tip
            ctx.lineTo(ox + segLen * 0.5 - 0.28 * scale, oy - 0.2 * scale);
            ctx.moveTo(ox + segLen * 0.5, oy);
            ctx.lineTo(ox + segLen * 0.5 - 0.28 * scale, oy + 0.2 * scale);
            ctx.stroke();
          }
          ctx.restore();
        } else {
          // Safe calm lull window indicator
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.32)';
          ctx.lineWidth = Math.max(1.1, 0.045 * scale);
          ctx.setLineDash([5, 6]);
          ctx.beginPath();
          ctx.arc(sx, sy, sr * 0.72, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // 4. Interactive Watertight Bulkhead Hatches (heavy steel door + spinning brass handwheel!)
    this._drawWatertightHatches(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, wreckState, mechFx);

    // 5. Cuttable Fishing-Net & Cable Entanglement Zones (with taut snare strands when hooked!)
    if (Array.isArray(level.snagZones)) {
      const cutSet = wreckState?.cutSnagIds;
      const activeIdx = wreckState?.activeSnagIndex ?? -1;
      for (let s = 0; s < level.snagZones.length; s++) {
        const snag = level.snagZones[s];
        const snagKey = snag.id || `snag_${s}`;
        const r = snag.radius || 2.4;
        if (snag.x + r + 3 < visX0 || snag.x - r - 3 > visX1 || snag.y + r + 3 < visY0 || snag.y - r - 3 > visY1) continue;
        const sx = toScreenX(snag.x);
        const sy = toScreenY(snag.y);
        const sr = r * scale;
        const sway = Math.sin(timeSec * 1.45 + s * 2.1) * 0.22 * scale;
        const isCut = cutSet?.has(snagKey);

        if (isCut) {
          // Sliced & parted harmless frayed net remnants hanging on outer edges
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
          ctx.lineWidth = Math.max(1, 0.035 * scale);
          ctx.beginPath();
          for (const side of [-1, 1]) {
            ctx.moveTo(sx + side * sr * 0.85, sy - sr * 0.75);
            ctx.quadraticCurveTo(sx + side * sr * 0.6 + sway, sy, sx + side * sr * 0.72 + sway, sy + sr * 0.7);
          }
          ctx.stroke();
          continue;
        }

        const isHooked = activeIdx === s;
        ctx.strokeStyle = isHooked ? 'rgba(248, 113, 113, 0.72)' : 'rgba(251, 191, 36, 0.42)';
        ctx.lineWidth = Math.max(1.1, 0.045 * scale);
        ctx.beginPath();
        for (let k = -3; k <= 3; k++) {
          const ox = (k / 3.2) * sr;
          ctx.moveTo(sx + ox, sy - sr * 0.85);
          ctx.quadraticCurveTo(sx + ox + sway, sy, sx + ox * 0.85 + sway * 1.4, sy + sr * 0.85);
          ctx.moveTo(sx - sr * 0.85, sy + ox);
          ctx.quadraticCurveTo(sx + sway * 0.5, sy + ox + sway * 0.4, sx + sr * 0.85 + sway * 0.8, sy + ox);
        }
        ctx.stroke();

        // Taut snare monofilament strands pulled tight from net to hooked diver!
        if (isHooked && diver) {
          const dx = toScreenX(diver.x);
          const dy = toScreenY(diver.y);
          ctx.strokeStyle = 'rgba(251, 146, 60, 0.88)';
          ctx.lineWidth = Math.max(1.6, 0.055 * scale);
          ctx.beginPath();
          ctx.moveTo(sx - sr * 0.35, sy - sr * 0.25);
          ctx.lineTo(dx, dy);
          ctx.moveTo(sx + sr * 0.35, sy + sr * 0.22);
          ctx.lineTo(dx, dy);
          ctx.stroke();
        }

        // Subtle warning perimeter shimmer
        ctx.strokeStyle = isHooked ? 'rgba(248, 113, 113, 0.55)' : 'rgba(251, 146, 60, 0.28)';
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.arc(sx + sway * 0.35, sy, sr * 0.92, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }

  /**
   * Shared Interactive Watertight Bulkhead / Mine Blast-Door Hatch renderer (v148 Mechanical Craft Overhaul):
   * Brushed naval steel bevel, cast-iron hinges, 4 retracting perimeter locking dogs,
   * spinning brass dogging handwheel, analog Bourdon pressure gauge + bypass bleed valve,
   * and smooth 3D foreshortened hinged swing-open animation.
   */
  _drawWatertightHatches(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, wreckState = null, mechFx = null) {
    const level = this.level;
    if (!Array.isArray(level.watertightHatches) || level.watertightHatches.length === 0) return;
    const openedSet = wreckState?.openedHatchIds;
    const crankId = wreckState?.crankingHatchId;
    const crankProg = wreckState?.crankingHatchProgress || 0;

    for (let h = 0; h < level.watertightHatches.length; h++) {
      const hatch = level.watertightHatches[h];
      const hr = hatch.radius || 1.9;
      if (hatch.x + hr + 3 < visX0 || hatch.x - hr - 3 > visX1 || hatch.y + hr + 3 < visY0 || hatch.y - hr - 3 > visY1) continue;
      const sx = toScreenX(hatch.x);
      const sy = toScreenY(hatch.y);
      const sr = hr * scale;
      const isOpen = openedSet?.has(hatch.id);
      const isCranking = !isOpen && crankId === hatch.id;
      const pressurized = isHatchPressurized(level, hatch);
      const equalized = Boolean(wreckState?.equalizedHatchIds?.has(hatch.id));
      const valveProg = mechFx?.valveAnims?.get(hatch.id) ?? (equalized ? 1 : 0);
      const openProg = isOpen ? (mechFx?.hatchOpenAnims?.get(hatch.id) ?? 1) : 0;

      // Subtle mechanical shudder during active pressure bleed or high-torque cranking
      const shudderAmp =
        valveProg > 0 && valveProg < 0.62
          ? (1 - valveProg / 0.62) * 0.045 * scale
          : isCranking
            ? 0.022 * scale
            : 0;
      const jx = shudderAmp > 0 ? Math.sin(timeSec * 52 + h * 3) * shudderAmp : 0;
      const jy = shudderAmp > 0 ? Math.cos(timeSec * 47 + h * 5) * shudderAmp : 0;

      ctx.save();
      ctx.translate(sx + jx, sy + jy);

      // Outer bolted bulkhead coaming flange (always anchored to hull)
      ctx.strokeStyle = isOpen ? 'rgba(52, 211, 153, 0.58)' : 'rgba(71, 85, 105, 0.92)';
      ctx.lineWidth = Math.max(2.6, 0.17 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, sr * 0.97, 0, Math.PI * 2);
      ctx.stroke();

      // Heavy cast-iron twin hinge knuckles bolted on the right coaming
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1.1, 0.045 * scale);
      for (const hy of [-sr * 0.42, sr * 0.42]) {
        ctx.fillRect(sr * 0.84, hy - sr * 0.11, sr * 0.24, sr * 0.22);
        ctx.strokeRect(sr * 0.84, hy - sr * 0.11, sr * 0.24, sr * 0.22);
        // Brass hinge pin
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(sr * 0.96, hy, Math.max(1.5, 0.055 * scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#334155';
      }

      if (isOpen) {
        // Open passable interior portal ring + subtle safe emerald clearance glow
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.72)';
        ctx.lineWidth = Math.max(2.2, 0.12 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.86, 0, Math.PI * 2);
        ctx.stroke();

        // Smooth 3D foreshortened hinged door swing-open animation (0 -> 1 over ~0.68s)
        const easeOpen = 1 - Math.pow(1 - Math.max(0, Math.min(1, openProg)), 3);
        const doorScaleX = Math.max(0.16, 1 - easeOpen * 0.84);
        ctx.save();
        ctx.translate(sr * 0.88, 0);
        ctx.scale(doorScaleX, 1);
        ctx.translate(-sr * 0.88, 0);

        const openDoorGrad = ctx.createLinearGradient(-sr, -sr, sr, sr);
        openDoorGrad.addColorStop(0, '#475569');
        openDoorGrad.addColorStop(0.5, '#1e293b');
        openDoorGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = openDoorGrad;
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.88, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = Math.max(1.8, 0.09 * scale);
        ctx.stroke();

        // Retracted brass wheel rim silhouette visible on the swung door
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.72)';
        ctx.lineWidth = Math.max(1.5, 0.08 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.42, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        // Sealed heavy naval steel door plate with radial metallic bevel shading
        const plateGrad = ctx.createRadialGradient(-sr * 0.28, -sr * 0.28, sr * 0.08, 0, 0, sr * 0.96);
        plateGrad.addColorStop(0, '#475569');
        plateGrad.addColorStop(0.45, '#293548');
        plateGrad.addColorStop(0.84, '#1e293b');
        plateGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = plateGrad;
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.91, 0, Math.PI * 2);
        ctx.fill();

        // Oxidized corrosion halo + gasket ring
        ctx.strokeStyle = 'rgba(146, 64, 14, 0.48)';
        ctx.lineWidth = Math.max(2.4, 0.16 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.83, 0, Math.PI * 2);
        ctx.stroke();

        // Active status rim (amber sealed / cyan cranking / emerald equalized ready)
        ctx.strokeStyle = isCranking ? '#38bdf8' : pressurized && !equalized ? '#f87171' : '#f59e0b';
        ctx.lineWidth = Math.max(2.2, 0.12 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.91, 0, Math.PI * 2);
        ctx.stroke();

        // Inner stamped stiffening dish ring
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.lineWidth = Math.max(1.2, 0.06 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.62, 0, Math.PI * 2);
        ctx.stroke();

        // 4 Mechanical Locking Dogs (perimeter steel wedges that retract inward as wheel cranks!)
        const dogRetract = isCranking ? crankProg : 0;
        for (let d = 0; d < 4; d++) {
          const da = (d / 4) * Math.PI * 2 + Math.PI * 0.25;
          ctx.save();
          ctx.rotate(da);
          const dogX = sr * (0.86 - dogRetract * 0.22);
          ctx.translate(dogX, 0);
          ctx.rotate(dogRetract * 0.65);
          ctx.fillStyle = dogRetract > 0.55 ? '#94a3b8' : '#cbd5e1';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = Math.max(1.1, 0.045 * scale);
          ctx.fillRect(-sr * 0.11, -sr * 0.065, sr * 0.22, sr * 0.13);
          ctx.strokeRect(-sr * 0.11, -sr * 0.065, sr * 0.22, sr * 0.13);
          ctx.restore();
        }

        // 10 Forged Perimeter Rivets with metallic top glint
        for (let b = 0; b < 10; b++) {
          const ba = (b / 10) * Math.PI * 2;
          const bx = Math.cos(ba) * sr * 0.76;
          const by = Math.sin(ba) * sr * 0.76;
          const br = Math.max(1.5, 0.06 * scale);
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.arc(bx - br * 0.28, by - br * 0.28, br * 0.36, 0, Math.PI * 2);
          ctx.fill();
        }

        // Central Brass Dogging Handwheel (tapered spokes + knurled rim + hex center nut)
        ctx.save();
        const wheelRot = isCranking ? crankProg * Math.PI * 5 : Math.sin(timeSec * 0.9 + h) * 0.05;
        ctx.rotate(wheelRot);

        // Soft cast shadow behind wheel
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.45)';
        ctx.lineWidth = Math.max(2.6, 0.14 * scale);
        ctx.beginPath();
        ctx.arc(0.04 * scale, 0.05 * scale, sr * 0.45, 0, Math.PI * 2);
        ctx.stroke();

        // Brass wheel spokes & rim
        const brassGrad = ctx.createLinearGradient(-sr * 0.45, -sr * 0.45, sr * 0.45, sr * 0.45);
        brassGrad.addColorStop(0, '#fef08a');
        brassGrad.addColorStop(0.45, '#f59e0b');
        brassGrad.addColorStop(1, '#92400e');
        ctx.strokeStyle = brassGrad;
        ctx.lineWidth = Math.max(2.2, 0.12 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.45, 0, Math.PI * 2);
        for (let sp = 0; sp < 6; sp++) {
          const sa = (sp / 6) * Math.PI * 2;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(sa) * sr * 0.45, Math.sin(sa) * sr * 0.45);
        }
        ctx.stroke();

        // Outer grip lugs around brass wheel
        ctx.fillStyle = '#fde047';
        for (let sp = 0; sp < 6; sp++) {
          const sa = (sp / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(Math.cos(sa) * sr * 0.45, Math.sin(sa) * sr * 0.45, Math.max(1.6, 0.065 * scale), 0, Math.PI * 2);
          ctx.fill();
        }

        // Center brass spindle hub + hex locknut
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.arc(0, 0, 0.17 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(0, 0, 0.095 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Outer radial cranking progress ring
        if (isCranking && crankProg > 0) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = Math.max(3, 0.16 * scale);
          ctx.beginPath();
          ctx.arc(0, 0, sr * 1.1, -Math.PI * 0.5, -Math.PI * 0.5 + crankProg * Math.PI * 2);
          ctx.stroke();
        }

        // Pressurized Deep Wreck Bulkhead Copper Bypass Valve & Analog Bourdon Gauge (v148)
        if (pressurized) {
          const vx = sr * 0.64;
          const vy = -sr * 0.64;
          const vr = Math.max(5.5, 0.34 * scale);
          const pulse = 0.65 + 0.35 * Math.sin(timeSec * 4.4 + h);

          // Copper bypass conduit connecting door cavity to bleed gauge
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = Math.max(2, 0.11 * scale);
          ctx.beginPath();
          ctx.moveTo(sr * 0.34, -sr * 0.56);
          ctx.quadraticCurveTo(sr * 0.56, -sr * 0.72, vx, vy);
          ctx.stroke();

          // Spinning miniature red/brass bleed valve wheel beside the gauge
          const miniX = sr * 0.32;
          const miniY = -sr * 0.58;
          ctx.save();
          ctx.translate(miniX, miniY);
          ctx.rotate(valveProg * Math.PI * 6);
          ctx.strokeStyle = equalized ? '#34d399' : '#f87171';
          ctx.lineWidth = Math.max(1.4, 0.065 * scale);
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(3, 0.16 * scale), 0, Math.PI * 2);
          ctx.moveTo(-0.15 * scale, 0);
          ctx.lineTo(0.15 * scale, 0);
          ctx.moveTo(0, -0.15 * scale);
          ctx.lineTo(0, 0.15 * scale);
          ctx.stroke();
          ctx.restore();

          // Active directional high-pressure bleed jet cone while valve is equalizing!
          if (valveProg > 0 && valveProg < 0.78) {
            const jetFade = Math.sin((valveProg / 0.78) * Math.PI);
            const jetLen = (0.8 + jetFade * 1.35) * scale;
            const jetGrad = ctx.createLinearGradient(vx, vy, vx + jetLen * 0.75, vy - jetLen * 0.75);
            jetGrad.addColorStop(0, `rgba(224, 242, 254, ${(0.82 * jetFade).toFixed(2)})`);
            jetGrad.addColorStop(0.5, `rgba(125, 211, 252, ${(0.45 * jetFade).toFixed(2)})`);
            jetGrad.addColorStop(1, 'rgba(125, 211, 252, 0)');
            ctx.fillStyle = jetGrad;
            ctx.beginPath();
            ctx.moveTo(vx, vy);
            ctx.lineTo(vx + jetLen * 0.55, vy - jetLen * 0.95);
            ctx.lineTo(vx + jetLen * 0.98, vy - jetLen * 0.52);
            ctx.closePath();
            ctx.fill();
          }

          // Brass Bourdon Gauge Housing + Glass Face
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = equalized ? '#34d399' : `rgba(251, 191, 36, ${pulse.toFixed(2)})`;
          ctx.lineWidth = Math.max(1.8, 0.085 * scale);
          ctx.beginPath();
          ctx.arc(vx, vy, vr, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Red High-ΔP & Green Equalized dial arcs
          ctx.lineWidth = Math.max(1.2, 0.055 * scale);
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
          ctx.beginPath();
          ctx.arc(vx, vy, vr * 0.7, Math.PI * 0.78, Math.PI * 1.32);
          ctx.stroke();
          ctx.strokeStyle = `rgba(248, 113, 113, ${equalized ? 0.3 : pulse.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(vx, vy, vr * 0.7, Math.PI * 1.48, Math.PI * 2.18);
          ctx.stroke();

          // Sweeping Analog Needle (High ΔP red -> Equalized 0 green)
          const needleEase = 1 - Math.pow(1 - Math.max(0, Math.min(1, valveProg)), 2);
          const needleAng = equalized || valveProg > 0
            ? (0.35 - needleEase * 2.15)
            : (0.35 + Math.sin(timeSec * 8 + h) * 0.08);
          ctx.strokeStyle = equalized && valveProg >= 0.8 ? '#6ee7b7' : '#fca5a5';
          ctx.lineWidth = Math.max(1.3, 0.055 * scale);
          ctx.beginPath();
          ctx.moveTo(vx, vy);
          ctx.lineTo(vx + Math.cos(needleAng) * vr * 0.72, vy + Math.sin(needleAng) * vr * 0.72);
          ctx.stroke();
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(vx, vy, Math.max(1.2, 0.05 * scale), 0, Math.PI * 2);
          ctx.fill();

          // Compact status badge just below gauge
          if (scale >= 12) {
            ctx.font = `800 ${Math.max(8, Math.round(scale * 0.25))}px ui-monospace, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = equalized ? '#6ee7b7' : '#fca5a5';
            ctx.fillText(equalized ? 'EQ' : 'ΔP', vx, vy + vr + 1.5);
          }
        }
      }
      ctx.restore();
    }
  }

  /**
   * Render an inflated Safety-Orange Commercial Parachute Lift Bag tethered above the diver (v148):
   * Multi-gore ripstop canopy, SOLAS tape, top spring dump valve + pull-cord lanyard,
   * stainless bolt-snap hardware, pressurized inflator shimmer plume & slung salvage load mesh.
   */
  _drawDiverLiftBag(ctx, diver, salvage, toScreenX, toScreenY, scale, timeSec, mechFx = null) {
    if (!diver || !salvage) return;
    const anim = Math.max(0, Math.min(1, salvage.inflateAnim || (salvage.liftBagActive ? 1 : 0)));
    if (anim <= 0.02) return;

    const anchorX = toScreenX(diver.x);
    const anchorY = toScreenY(diver.y);
    const swayX = Math.max(-0.58, Math.min(0.58, -(diver.vx || 0) * 0.16)) + Math.sin(timeSec * 2.4) * 0.085;
    const strapLen = (1.18 + anim * 0.7) * scale;
    const bagX = anchorX + swayX * scale;
    const bagY = anchorY - strapLen;
    // Subtle Boyle's-Law breathing expansion when ascending or floating empty
    const boylePulse = salvage.status === 'float-warn' ? 1 + 0.06 * Math.sin(timeSec * 5.2) : 1;
    const bagW = (0.36 + anim * 0.46) * scale * boylePulse;
    const bagH = (0.4 + anim * 0.56) * scale * boylePulse;
    const isInflating = anim < 0.92 || mechFx?.activeAction?.kind === 'liftbag-inflate';
    const isDumping = salvage.status === 'float-warn' || (diver.vy || 0) < -0.35;

    ctx.save();

    // 1. Initial pressurized gas-injection shimmer plume from inflator into open canopy mouth
    if (isInflating) {
      const infFade = Math.max(0.15, 1 - anim * 0.72);
      const plumeGrad = ctx.createLinearGradient(anchorX, anchorY - 0.25 * scale, bagX, bagY + bagH * 0.2);
      plumeGrad.addColorStop(0, `rgba(254, 243, 199, ${(0.72 * infFade).toFixed(2)})`);
      plumeGrad.addColorStop(0.6, `rgba(186, 230, 253, ${(0.38 * infFade).toFixed(2)})`);
      plumeGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.fillStyle = plumeGrad;
      ctx.beginPath();
      ctx.moveTo(anchorX - 0.06 * scale, anchorY - 0.18 * scale);
      ctx.lineTo(anchorX + 0.06 * scale, anchorY - 0.18 * scale);
      ctx.lineTo(bagX + bagW * 0.34, bagY + bagH * 0.18);
      ctx.lineTo(bagX - bagW * 0.34, bagY + bagH * 0.18);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Catenary braided yellow lifting tether + 4-point shroud bridle
    const bridleY = bagY + bagH * 0.52;
    const midStrapX = (anchorX + bagX) * 0.5 + swayX * 0.16 * scale;
    const midStrapY = (anchorY + bridleY) * 0.5;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.94)';
    ctx.lineWidth = Math.max(1.6, 0.068 * scale);
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY - 0.12 * scale);
    ctx.quadraticCurveTo(midStrapX, midStrapY, bagX, bridleY);
    ctx.stroke();

    // 4 canopy shroud lines (outer + inner webbing straps)
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
    ctx.lineWidth = Math.max(1.1, 0.042 * scale);
    ctx.beginPath();
    for (const frac of [-0.58, -0.22, 0.22, 0.58]) {
      ctx.moveTo(bagX, bridleY);
      ctx.lineTo(bagX + bagW * frac, bagY + bagH * 0.15);
    }
    ctx.stroke();

    // Gleaming stainless steel harness bolt-snap carabiner & bridle D-ring
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = Math.max(1.3, 0.055 * scale);
    ctx.beginPath();
    ctx.arc(anchorX, anchorY - 0.16 * scale, Math.max(2.2, 0.095 * scale), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(bagX, bridleY, Math.max(2, 0.08 * scale), 0, Math.PI * 2);
    ctx.fill();

    // Heavy Salvage Load Mesh Sling visibly suspended beneath the carabiner when carrying >= 6kg!
    if ((salvage.payloadKg || 0) >= 6) {
      const slingX = anchorX + swayX * 0.22 * scale;
      const slingY = anchorY + 0.28 * scale;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.82)';
      ctx.lineWidth = Math.max(1.1, 0.042 * scale);
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY - 0.08 * scale);
      ctx.lineTo(slingX, slingY);
      ctx.stroke();
      const loadR = Math.min(0.32, 0.16 + ((salvage.payloadKg || 6) / 30) * 0.15) * scale;
      const loadGrad = ctx.createRadialGradient(slingX - loadR * 0.3, slingY - loadR * 0.25, loadR * 0.1, slingX, slingY, loadR);
      loadGrad.addColorStop(0, '#fcd34d');
      loadGrad.addColorStop(0.55, '#b45309');
      loadGrad.addColorStop(1, '#451a03');
      ctx.fillStyle = loadGrad;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = Math.max(1, 0.038 * scale);
      ctx.beginPath();
      ctx.arc(slingX, slingY + loadR * 0.45, loadR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 3. Multi-Gore Safety-Orange Commercial Ripstop Parachute Canopy
    // Dark open skirt interior shadow
    ctx.fillStyle = 'rgba(67, 20, 7, 0.72)';
    ctx.beginPath();
    ctx.ellipse(bagX, bagY + bagH * 0.16, bagW * 0.6, bagH * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createRadialGradient(bagX - bagW * 0.22, bagY - bagH * 0.36, bagW * 0.08, bagX, bagY, bagH * 1.08);
    grad.addColorStop(0, '#fed7aa');
    grad.addColorStop(0.32, '#fb923c');
    grad.addColorStop(0.72, '#ea580c');
    grad.addColorStop(1, '#9a3412');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = Math.max(1.4, 0.058 * scale);
    ctx.beginPath();
    ctx.moveTo(bagX - bagW * 0.62, bagY + bagH * 0.18);
    ctx.bezierCurveTo(
      bagX - bagW * 0.88,
      bagY - bagH * 0.68,
      bagX + bagW * 0.88,
      bagY - bagH * 0.68,
      bagX + bagW * 0.62,
      bagY + bagH * 0.18
    );
    ctx.quadraticCurveTo(bagX, bagY + bagH * 0.04, bagX - bagW * 0.62, bagY + bagH * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vertical curved ripstop gore seam stitching
    ctx.strokeStyle = 'rgba(124, 45, 18, 0.52)';
    ctx.lineWidth = Math.max(1, 0.036 * scale);
    ctx.beginPath();
    ctx.moveTo(bagX, bagY - bagH * 0.44);
    ctx.quadraticCurveTo(bagX - bagW * 0.36, bagY - bagH * 0.16, bagX - bagW * 0.24, bagY + bagH * 0.12);
    ctx.moveTo(bagX, bagY - bagH * 0.44);
    ctx.quadraticCurveTo(bagX + bagW * 0.36, bagY - bagH * 0.16, bagX + bagW * 0.24, bagY + bagH * 0.12);
    ctx.stroke();

    // Segmented SOLAS retro-reflective safety tape band
    ctx.strokeStyle = 'rgba(254, 249, 195, 0.92)';
    ctx.lineWidth = Math.max(1.5, 0.072 * scale);
    ctx.setLineDash([Math.max(3, 0.16 * scale), Math.max(2, 0.07 * scale)]);
    ctx.beginPath();
    ctx.moveTo(bagX - bagW * 0.58, bagY - bagH * 0.05);
    ctx.quadraticCurveTo(bagX, bagY - bagH * 0.18, bagX + bagW * 0.58, bagY - bagH * 0.05);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Top Spring-Loaded Overpressure Dump Valve + Fluttering Pull-Cord Lanyard
    const valveLift = isDumping ? (0.04 + 0.03 * Math.sin(timeSec * 18)) * scale : 0;
    const valveY = bagY - bagH * 0.46;
    if (isDumping) {
      // Soft escaping white gas flutter at cracked dump cap
      ctx.fillStyle = 'rgba(224, 242, 254, 0.55)';
      ctx.beginPath();
      ctx.ellipse(bagX, valveY - valveLift - 0.08 * scale, 0.16 * scale, 0.07 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(1, 0.04 * scale);
    ctx.beginPath();
    ctx.arc(bagX, valveY - valveLift, Math.max(2.2, 0.095 * scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dangling dump pull-cord + bright red toggle ball
    const cordSway = Math.sin(timeSec * (isDumping ? 9.5 : 3.2)) * 0.1 * scale;
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.78)';
    ctx.lineWidth = Math.max(1, 0.032 * scale);
    ctx.beginPath();
    ctx.moveTo(bagX + 0.08 * scale, valveY);
    ctx.quadraticCurveTo(bagX + bagW * 0.72 + cordSway, bagY + bagH * 0.1, bagX + bagW * 0.42 + cordSway * 1.4, bagY + bagH * 0.58);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(bagX + bagW * 0.42 + cordSway * 1.4, bagY + bagH * 0.58, Math.max(1.8, 0.065 * scale), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Cave Interactive Parity elements: steady karst spring currents, pulsing tidal blue-hole siphons,
   * clipped staged bailout/deco cylinders, unlined cave junction line-markers & jump spools, and
   * abandoned tangled cave line traps cuttable with shears.
   */
  /**
   * Shared high-detail AL80 technical stage cylinder renderer (v148):
   * Brushed metallic cylindrical gradient, color-coded gas band, cam/bungee hose retainers,
   * brass DIN valve + chrome turret, coiled HP hose + glowing mini SPG pressure dial,
   * and a stainless steel bolt-snap carabiner clipped cleanly to the line.
   */
  _drawDetailedStageCylinder(ctx, scale, { bodyCol, trimCol, claimed = false, cordColor = 'rgba(226, 232, 240, 0.8)', tiltRad = -0.4, timeSec = 0 }) {
    // Braided rigging tether cord + gleaming stainless bolt-snap carabiner
    ctx.strokeStyle = cordColor;
    ctx.lineWidth = Math.max(1.2, 0.046 * scale);
    ctx.beginPath();
    ctx.moveTo(0, -0.5 * scale);
    ctx.lineTo(0, -1.04 * scale);
    ctx.stroke();

    // Stainless steel bolt-snap clip at top anchor
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = Math.max(1.3, 0.052 * scale);
    ctx.beginPath();
    ctx.arc(0, -1.04 * scale, Math.max(2.1, 0.095 * scale), 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.rotate(tiltRad);
    const cw = 0.98 * scale;
    const ch = 0.4 * scale;

    // Metallic brushed-aluminum cylindrical body gradient
    const cylGrad = ctx.createLinearGradient?.(0, -ch * 0.55, 0, ch * 0.55);
    if (cylGrad) {
      if (claimed) {
        cylGrad.addColorStop(0, '#94a3b8');
        cylGrad.addColorStop(0.32, '#475569');
        cylGrad.addColorStop(1, '#1e293b');
      } else {
        cylGrad.addColorStop(0, '#f8fafc');
        cylGrad.addColorStop(0.28, '#cbd5e1');
        cylGrad.addColorStop(0.7, '#64748b');
        cylGrad.addColorStop(1, '#1e293b');
      }
      ctx.fillStyle = cylGrad;
    } else {
      ctx.fillStyle = claimed ? '#475569' : '#cbd5e1';
    }
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1.2, 0.05 * scale);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-cw * 0.5, -ch * 0.5, cw, ch, ch * 0.46);
    } else {
      ctx.rect(-cw * 0.5, -ch * 0.5, cw, ch);
    }
    ctx.fill();
    ctx.stroke();

    // Color-coded gas mix shoulder band + glossy specular stripe
    ctx.fillStyle = bodyCol;
    ctx.fillRect(-cw * 0.22, -ch * 0.46, cw * 0.42, ch * 0.92);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.fillRect(-cw * 0.4, -ch * 0.34, cw * 0.8, ch * 0.14);

    // Dual matte-black bungee hose-retainer cam bands
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-cw * 0.36, -ch * 0.5, cw * 0.06, ch);
    ctx.fillRect(cw * 0.24, -ch * 0.5, cw * 0.06, ch);

    // Coiled black regulator hose tucked along cylinder + mini glowing SPG pressure dial
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1.5, 0.062 * scale);
    ctx.beginPath();
    ctx.moveTo(cw * 0.54, 0.06 * scale);
    ctx.bezierCurveTo(cw * 0.52, ch * 0.85, -cw * 0.15, ch * 0.9, -cw * 0.32, ch * 0.28);
    ctx.stroke();

    // Mini SPG dial face (emerald/cyan full vs dim red empty/claimed)
    const spgX = -cw * 0.32;
    const spgY = ch * 0.32;
    const spgR = Math.max(2.3, 0.105 * scale);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(1, 0.036 * scale);
    ctx.beginPath();
    ctx.arc(spgX, spgY, spgR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = claimed ? '#ef4444' : trimCol;
    ctx.beginPath();
    ctx.arc(spgX, spgY, spgR * 0.62, 0, Math.PI * 2);
    ctx.fill();

    // Brass DIN valve manifold + chrome 1st stage turret + knurled rubber knob
    ctx.fillStyle = '#eab308';
    ctx.fillRect(cw * 0.44, -ch * 0.22, 0.14 * scale, ch * 0.44);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(cw * 0.54, -ch * 0.24, 0.14 * scale, ch * 0.48);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cw * 0.68, -ch * 0.12, Math.max(2, 0.088 * scale), 0, Math.PI * 2);
    ctx.fill();

    // Stainless stage-rigging bolt-snap at cylinder neck
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = Math.max(1.1, 0.044 * scale);
    ctx.beginPath();
    ctx.arc(cw * 0.4, -ch * 0.55, Math.max(1.6, 0.068 * scale), 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  _drawCaveInteractives(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, diver = null, wreckState = null, mechFx = null) {
    const level = this.level;
    ctx.save();

    // 0. Overhead Calcite / Glacial Stalactite Draperies (pre-cached & SDF-anchored to true ceiling rock)
    if (Array.isArray(level.segments)) {
      if (!this._stalactiteCache) {
        const list = [];
        for (let i = 0; i < level.segments.length; i += 2) {
          const seg = level.segments[i];
          const dx = Math.abs(seg.bx - seg.ax);
          const dy = Math.abs(seg.by - seg.ay);
          // Skip steep/vertical shafts where stalactites have no overhead ceiling
          if (dy > dx * 0.75) continue;
          const mx = (seg.ax + seg.bx) * 0.5;
          const my = (seg.ay + seg.by) * 0.5;
          const mr = ((seg.ra || 2.5) + (seg.rb || 2.5)) * 0.5;
          if (mr < 2.5 || my < 8) continue;
          for (let t = -2; t <= 2; t++) {
            const tx = mx + t * 0.42;
            const lenM = 0.46 + (Math.abs(t * 7 + i * 3) % 4) * 0.22;
            const bwM = 0.14 + (t === 0 ? 0.06 : 0);
            // March upward from open passage center to locate the exact ceiling rock surface
            let hitY = null;
            const startY = my - mr * 0.35;
            const maxY = Math.max(4.0, my - mr - 2.4);
            for (let y = startY; y >= maxY; y -= 0.16) {
              if (evaluateCaveSDF(level, tx, y) >= 0.05) {
                hitY = y;
                break;
              }
            }
            if (hitY === null || hitY < 4.2) continue;
            // Verify clear open water below the icicle tip so it hangs cleanly into the cavern
            if (evaluateCaveSDF(level, tx, hitY + lenM + 0.35) > -0.3) continue;
            list.push({ x: tx, y: hitY, len: lenM, bw: bwM });
          }
        }
        this._stalactiteCache = list;
      }
      const stals = this._stalactiteCache;
      if (stals.length > 0) {
        const isGlacial = level.theme?.id === 'kverkfjoll-glacier' || level.theme?.id === 'greenland-iceberg';
        const isMine = level.theme?.id === 'nordic-mine';
        const isBermuda = level.theme?.id === 'bermuda-sargasso';
        const stalCol = isGlacial
          ? 'rgba(125, 211, 252, 0.48)'
          : isMine
            ? 'rgba(92, 84, 78, 0.44)'
            : isBermuda
              ? 'rgba(218, 204, 188, 0.48)'
              : 'rgba(148, 138, 118, 0.42)';
        const stalHi = isGlacial
          ? 'rgba(224, 242, 254, 0.46)'
          : isBermuda
            ? 'rgba(248, 240, 232, 0.38)'
            : 'rgba(214, 204, 184, 0.34)';
        for (let i = 0; i < stals.length; i++) {
          const st = stals[i];
          if (st.x + 1 < visX0 || st.x - 1 > visX1 || st.y + st.len + 1 < visY0 || st.y - 1 > visY1) continue;
          const sx = toScreenX(st.x);
          const sy = toScreenY(st.y);
          const len = st.len * scale;
          const bw = st.bw * scale;
          ctx.fillStyle = stalCol;
          ctx.beginPath();
          ctx.moveTo(sx - bw, sy - 0.14 * scale);
          ctx.lineTo(sx + bw, sy - 0.14 * scale);
          ctx.lineTo(sx, sy + len);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = stalHi;
          ctx.beginPath();
          ctx.moveTo(sx, sy - 0.12 * scale);
          ctx.lineTo(sx + bw * 0.55, sy - 0.12 * scale);
          ctx.lineTo(sx, sy + len * 0.85);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // 1. Steady Karst Spring / Underground River Currents
    if (Array.isArray(level.caveCurrents)) {
      for (let c = 0; c < level.caveCurrents.length; c++) {
        const cur = level.caveCurrents[c];
        const cr = cur.radius || 4.0;
        if (cur.x + cr + 2 < visX0 || cur.x - cr - 2 > visX1 || cur.y + cr + 2 < visY0 || cur.y - cr - 2 > visY1) continue;
        const sx = toScreenX(cur.x);
        const sy = toScreenY(cur.y);
        const sr = cr * scale;
        const ang = Math.atan2(cur.vy || 0, cur.vx || 1);
        const spd = Math.hypot(cur.vx || 0, cur.vy || 0);

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.38)';
        ctx.lineWidth = Math.max(1.3, 0.055 * scale);
        ctx.lineCap = 'round';
        for (let k = -2; k <= 2; k++) {
          const oy = k * sr * 0.3;
          const travel = ((timeSec * (1.25 + spd * 0.65) + k * 0.63 + c * 0.4) % 1.0) * 2 - 1;
          const ox = travel * sr * 0.56;
          const segLen = sr * 0.42;
          ctx.beginPath();
          ctx.moveTo(ox - segLen * 0.5, oy);
          ctx.lineTo(ox + segLen * 0.5, oy);
          ctx.lineTo(ox + segLen * 0.5 - 0.24 * scale, oy - 0.17 * scale);
          ctx.moveTo(ox + segLen * 0.5, oy);
          ctx.lineTo(ox + segLen * 0.5 - 0.24 * scale, oy + 0.17 * scale);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 2. Pulsing Tidal Blue-Hole & Karst Siphon Surges (in exact phase with computeSurgeWave!)
    if (Array.isArray(level.surgeZones)) {
      for (let z = 0; z < level.surgeZones.length; z++) {
        const zone = level.surgeZones[z];
        const zr = zone.radius || 4.0;
        if (zone.x + zr + 2 < visX0 || zone.x - zr - 2 > visX1 || zone.y + zr + 2 < visY0 || zone.y - zr - 2 > visY1) continue;
        const wave = computeSurgeWave(zone, timeSec);
        const sx = toScreenX(zone.x);
        const sy = toScreenY(zone.y);
        const sr = zr * scale;
        const mag = Math.hypot(zone.vx || 0, zone.vy || 0) || 1;
        const dirX = (zone.vx || 0) / mag;
        const dirY = (zone.vy || 0) / mag;
        const flowSign = wave >= 0 ? 1 : -1;
        const strength = Math.abs(wave);

        if (strength > 0.05) {
          const ang = Math.atan2(dirY * flowSign, dirX * flowSign);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(ang);
          ctx.strokeStyle = `rgba(125, 211, 252, ${0.22 + strength * 0.58})`;
          ctx.lineWidth = Math.max(1.5, (0.06 + strength * 0.06) * scale);
          ctx.lineCap = 'round';
          for (let k = -2; k <= 2; k++) {
            const oy = k * sr * 0.32;
            const travel = ((timeSec * 5.0 + k * 0.7) % 1.0) * 2 - 1;
            const ox = travel * sr * 0.55;
            const segLen = sr * (0.35 + strength * 0.25);
            ctx.beginPath();
            ctx.moveTo(ox - segLen * 0.5, oy);
            ctx.lineTo(ox + segLen * 0.5, oy);
            ctx.lineTo(ox + segLen * 0.5 - 0.28 * scale, oy - 0.2 * scale);
            ctx.moveTo(ox + segLen * 0.5, oy);
            ctx.lineTo(ox + segLen * 0.5 - 0.28 * scale, oy + 0.2 * scale);
            ctx.stroke();
          }
          ctx.restore();
        } else {
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.34)';
          ctx.lineWidth = Math.max(1.1, 0.045 * scale);
          ctx.setLineDash([5, 6]);
          ctx.beginPath();
          ctx.arc(sx, sy, sr * 0.72, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // 3. Staged Bailout / Reserve Scuba Cylinders clipped on rock tie-offs
    if (Array.isArray(level.stageCaches)) {
      const claimedSet = wreckState?.claimedStageIds;
      for (let i = 0; i < level.stageCaches.length; i++) {
        const cache = level.stageCaches[i];
        if (cache.x + 3 < visX0 || cache.x - 3 > visX1 || cache.y + 3 < visY0 || cache.y - 3 > visY1) continue;
        const sx = toScreenX(cache.x);
        const sy = toScreenY(cache.y);
        const claimed = claimedSet?.has(cache.id);
        const bob = Math.sin(timeSec * 1.9 + i * 2.1) * 0.09 * scale;
        const isTmx = cache.gasId === 'TMX1455';
        const isO2 = cache.gasId === 'O2';
        const bodyCol = claimed ? '#475569' : isTmx ? '#f59e0b' : isO2 ? '#10b981' : '#0ea5e9';
        const trimCol = claimed ? '#94a3b8' : isTmx ? '#fef08a' : isO2 ? '#a7f3d0' : '#bae6fd';

        ctx.save();
        ctx.translate(sx, sy + bob);

        // Pulsing beacon ring for unclaimed reserve stage bottle
        if (!claimed) {
          const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.2 + i);
          ctx.strokeStyle = isTmx
            ? `rgba(251, 191, 36, ${0.28 + pulse * 0.34})`
            : isO2
              ? `rgba(52, 211, 153, ${0.28 + pulse * 0.34})`
              : `rgba(56, 189, 248, ${0.28 + pulse * 0.34})`;
          ctx.lineWidth = Math.max(1.5, 0.06 * scale);
          ctx.beginPath();
          ctx.arc(0, 0, (0.95 + pulse * 0.25) * scale, 0, Math.PI * 2);
          ctx.stroke();
        }

        CaveRenderer.prototype._drawDetailedStageCylinder(ctx, scale, {
          bodyCol,
          trimCol,
          claimed,
          cordColor: 'rgba(226, 232, 240, 0.78)',
          tiltRad: -0.42 + Math.sin(timeSec * 1.4 + i) * 0.04,
          timeSec,
        });

        // Crisp stenciled tag below cylinder
        if (scale >= 12) {
          ctx.font = `700 ${Math.max(9, Math.round(scale * 0.31))}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = claimed ? 'rgba(148, 163, 184, 0.85)' : trimCol;
          const shortTag = claimed ? '✓ STAGE' : `${isTmx ? 'TMX' : isO2 ? 'O2' : 'EAN'} +${cache.barBonus || 65}b`;
          ctx.fillText(shortTag, 0, 0.58 * scale);
        }
        ctx.restore();
      }
    }

    // 4. Unlined Cave Line-Marker & Jump-Spool Stations
    if (Array.isArray(level.lineAnchors)) {
      const placedSet = wreckState?.placedMarkerIds;
      for (let i = 0; i < level.lineAnchors.length; i++) {
        const anchor = level.lineAnchors[i];
        if (anchor.x + 3 < visX0 || anchor.x - 3 > visX1 || anchor.y + 3 < visY0 || anchor.y - 3 > visY1) continue;
        const sx = toScreenX(anchor.x);
        const sy = toScreenY(anchor.y);
        const placed = placedSet?.has(anchor.id);

        ctx.save();
        ctx.translate(sx, sy);
        if (placed) {
          // Clipped 3D beveled hi-vis yellow ABS cave arrow ("REM cookie") with line-wrap notches!
          ctx.rotate(anchor.dirAngle || -Math.PI * 0.5);
          // Taut cave guideline threaded through arrow wrap notches
          ctx.strokeStyle = 'rgba(248, 250, 252, 0.82)';
          ctx.lineWidth = Math.max(1.1, 0.042 * scale);
          ctx.beginPath();
          ctx.moveTo(-0.78 * scale, 0);
          ctx.lineTo(0.86 * scale, 0);
          ctx.stroke();

          const arrowGrad = ctx.createLinearGradient?.(-0.45 * scale, -0.38 * scale, 0.72 * scale, 0.38 * scale);
          if (arrowGrad) {
            arrowGrad.addColorStop(0, '#fef08a');
            arrowGrad.addColorStop(0.5, '#facc15');
            arrowGrad.addColorStop(1, '#ca8a04');
            ctx.fillStyle = arrowGrad;
          } else {
            ctx.fillStyle = '#facc15';
          }
          ctx.strokeStyle = '#713f12';
          ctx.lineWidth = Math.max(1.2, 0.05 * scale);
          ctx.beginPath();
          ctx.moveTo(0.72 * scale, 0);
          ctx.lineTo(-0.36 * scale, -0.38 * scale);
          ctx.lineTo(-0.22 * scale, -0.14 * scale);
          // Authentic cave-arrow wrap notch
          ctx.lineTo(-0.36 * scale, -0.06 * scale);
          ctx.lineTo(-0.24 * scale, 0);
          ctx.lineTo(-0.36 * scale, 0.06 * scale);
          ctx.lineTo(-0.22 * scale, 0.14 * scale);
          ctx.lineTo(-0.36 * scale, 0.38 * scale);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Glossy bevel ridge
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.lineWidth = Math.max(0.9, 0.032 * scale);
          ctx.beginPath();
          ctx.moveTo(-0.18 * scale, -0.18 * scale);
          ctx.lineTo(0.46 * scale, 0);
          ctx.stroke();
        } else {
          // Waiting machined Delrin jump-spool station with radial lightening holes & double-ender bolt-snap
          const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.0 + i * 1.4);
          ctx.strokeStyle = `rgba(250, 204, 21, ${0.32 + pulse * 0.35})`;
          ctx.lineWidth = Math.max(1.3, 0.05 * scale);
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, 0.85 * scale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.save();
          ctx.rotate(timeSec * 0.75 + i);
          // Wound white nylon cave line visible inside flange
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.arc(0, 0, 0.34 * scale, 0, Math.PI * 2);
          ctx.fill();
          // Machined Delrin spool flange
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = Math.max(1.5, 0.068 * scale);
          ctx.beginPath();
          ctx.arc(0, 0, 0.42 * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // 6 machined lightening holes showing wound white line underneath
          ctx.fillStyle = '#f8fafc';
          for (let h = 0; h < 6; h++) {
            const ha = (h / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(Math.cos(ha) * 0.27 * scale, Math.sin(ha) * 0.27 * scale, Math.max(1.2, 0.055 * scale), 0, Math.PI * 2);
            ctx.fill();
          }
          // Center finger-hole hub
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(1, 0.04 * scale);
          ctx.beginPath();
          ctx.arc(0, 0, 0.14 * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // Clipped stainless double-ender bolt-snap hanging on side
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = Math.max(1.3, 0.05 * scale);
          ctx.beginPath();
          ctx.arc(0.42 * scale, -0.22 * scale, Math.max(2, 0.085 * scale), 0, Math.PI * 2);
          ctx.stroke();

          if (scale >= 12) {
            ctx.font = `700 ${Math.max(9, Math.round(scale * 0.3))}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#fef08a';
            ctx.fillText(`+${anchor.reelBonusM || 40}m SPOOL`, 0, 0.58 * scale);
          }
        }
        ctx.restore();
      }
    }

    // 5. Abandoned Tangled Cave Line Traps (cuttable with [E] shears / buddy rescue)
    if (Array.isArray(level.snagZones)) {
      const cutSet = wreckState?.cutSnagIds;
      const activeIdx = wreckState?.activeSnagIndex ?? -1;
      for (let s = 0; s < level.snagZones.length; s++) {
        const snag = level.snagZones[s];
        const snagKey = snag.id || `snag_${s}`;
        const r = snag.radius || 2.1;
        if (snag.x + r + 3 < visX0 || snag.x - r - 3 > visX1 || snag.y + r + 3 < visY0 || snag.y - r - 3 > visY1) continue;
        const sx = toScreenX(snag.x);
        const sy = toScreenY(snag.y);
        const sr = r * scale;
        const sway = Math.sin(timeSec * 1.55 + s * 2.3) * 0.2 * scale;
        const isCut = cutSet?.has(snagKey);

        if (isCut) {
          ctx.strokeStyle = 'rgba(226, 232, 240, 0.34)';
          ctx.lineWidth = Math.max(1, 0.035 * scale);
          ctx.beginPath();
          for (const side of [-1, 1]) {
            ctx.moveTo(sx + side * sr * 0.78, sy - sr * 0.65);
            ctx.quadraticCurveTo(sx + side * sr * 0.55 + sway, sy, sx + side * sr * 0.68 + sway, sy + sr * 0.62);
          }
          ctx.stroke();
          continue;
        }

        const isHooked = activeIdx === s;
        // Loose snarled pale-yellow nylon cave guideline loops
        ctx.strokeStyle = isHooked ? 'rgba(248, 113, 113, 0.85)' : 'rgba(254, 240, 138, 0.58)';
        ctx.lineWidth = Math.max(1.1, 0.045 * scale);
        ctx.beginPath();
        for (let k = -2; k <= 2; k++) {
          const ang = k * 0.62 + sway * 0.02;
          ctx.ellipse(
            sx + Math.cos(ang) * sr * 0.22 + sway * 0.35,
            sy + Math.sin(ang) * sr * 0.22,
            sr * (0.48 + Math.abs(k) * 0.14),
            sr * (0.28 + (2 - Math.abs(k)) * 0.12),
            ang,
            0,
            Math.PI * 2
          );
        }
        ctx.stroke();

        if (isHooked && diver) {
          const dx = toScreenX(diver.x);
          const dy = toScreenY(diver.y);
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.92)';
          ctx.lineWidth = Math.max(1.6, 0.055 * scale);
          ctx.beginPath();
          ctx.moveTo(sx - sr * 0.28, sy - sr * 0.22);
          ctx.lineTo(dx, dy);
          ctx.moveTo(sx + sr * 0.28, sy + sr * 0.22);
          ctx.lineTo(dx, dy);
          ctx.stroke();
        }
      }
    }

    // 6. Crankable Mine / Subterranean Blast-Door Bulkhead Hatches (e.g., Ojamo Flooded Iron Mine)
    if (typeof this._drawWatertightHatches === 'function') {
      this._drawWatertightHatches(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, wreckState, mechFx);
    }

    ctx.restore();
  }

  /**
   * Post-lighting subtle phosphorescent glints for placed yellow cave arrows and clipped stage bottles
   * so divers can navigate by placed markers and spot reserve gas even in deep sumps.
   */
  _drawDroppedStages(ctx, droppedStages, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec) {
    if (!Array.isArray(droppedStages) || droppedStages.length === 0) return;
    for (let i = 0; i < droppedStages.length; i++) {
      const st = droppedStages[i];
      if (!st) continue;
      if (st.x + 3 < visX0 || st.x - 3 > visX1 || st.y + 3 < visY0 || st.y - 3 > visY1) continue;
      const sx = toScreenX(st.x);
      const sy = toScreenY(st.y);
      const bob = Math.sin(timeSec * 2.1 + i * 1.7) * 0.08 * scale;
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.4 + i);
      const isTmx = st.gasId === 'TMX1455';
      const isO2 = st.gasId === 'O2';
      const bodyCol = st.color || (isTmx ? '#c084fc' : isO2 ? '#4ade80' : '#38bdf8');
      const trimCol = isTmx ? '#f5d0fe' : isO2 ? '#bbf7d0' : '#bae6fd';

      ctx.save();
      ctx.translate(sx, sy + bob);

      // Soft pulsing retrieval locator ring
      ctx.strokeStyle = isTmx
        ? `rgba(192, 132, 252, ${0.32 + pulse * 0.36})`
        : isO2
          ? `rgba(74, 222, 128, ${0.32 + pulse * 0.36})`
          : `rgba(56, 189, 248, ${0.32 + pulse * 0.36})`;
      ctx.lineWidth = Math.max(1.5, 0.06 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, (0.92 + pulse * 0.24) * scale, 0, Math.PI * 2);
      ctx.stroke();

      CaveRenderer.prototype._drawDetailedStageCylinder(ctx, scale, {
        bodyCol,
        trimCol,
        claimed: false,
        cordColor: 'rgba(253, 224, 71, 0.88)',
        tiltRad: -0.36 + Math.sin(timeSec * 1.5 + i) * 0.04,
        timeSec,
      });

      // Crisp stenciled bar + mix tag
      if (scale >= 11) {
        ctx.font = `700 ${Math.max(9, Math.round(scale * 0.3))}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = trimCol;
        const shortTag = `${st.bar || 45}b ${st.shortLabel || st.gasId}`;
        ctx.fillText(shortTag, 0, 0.56 * scale);
      }
      ctx.restore();
    }
  }

  _drawCaveInteractiveBeacons(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, wreckState = null) {
    const level = this.level;
    const placedSet = wreckState?.placedMarkerIds;
    const claimedSet = wreckState?.claimedStageIds;
    const hasAnchors = Array.isArray(level.lineAnchors) && level.lineAnchors.length > 0;
    const hasStages = Array.isArray(level.stageCaches) && level.stageCaches.length > 0;
    if (!hasAnchors && !hasStages) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    if (hasAnchors && placedSet && placedSet.size > 0) {
      for (let i = 0; i < level.lineAnchors.length; i++) {
        const anchor = level.lineAnchors[i];
        if (!placedSet.has(anchor.id)) continue;
        if (anchor.x + 3 < visX0 || anchor.x - 3 > visX1 || anchor.y + 3 < visY0 || anchor.y - 3 > visY1) continue;
        const sx = toScreenX(anchor.x);
        const sy = toScreenY(anchor.y);
        const pulse = 0.72 + 0.28 * Math.sin(timeSec * 2.6 + i);
        if (this.glowStamps?.warm) {
          const r = 1.65 * scale;
          ctx.globalAlpha = 0.42 * pulse;
          ctx.drawImage(this.glowStamps.warm, sx - r, sy - r, r * 2, r * 2);
        }
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(anchor.dirAngle || -Math.PI * 0.5);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(0.64 * scale, 0);
        ctx.lineTo(-0.38 * scale, -0.32 * scale);
        ctx.lineTo(-0.22 * scale, 0);
        ctx.lineTo(-0.38 * scale, 0.32 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    if (hasStages) {
      for (let i = 0; i < level.stageCaches.length; i++) {
        const cache = level.stageCaches[i];
        if (claimedSet?.has(cache.id)) continue;
        if (cache.x + 3 < visX0 || cache.x - 3 > visX1 || cache.y + 3 < visY0 || cache.y - 3 > visY1) continue;
        const sx = toScreenX(cache.x);
        const sy = toScreenY(cache.y);
        const glint = 0.22 + 0.16 * Math.sin(timeSec * 3.1 + i * 1.9);
        const stamp = cache.gasId === 'TMX1455' ? this.glowStamps?.warm : this.glowStamps?.cyan;
        if (stamp) {
          const r = 1.35 * scale;
          ctx.globalAlpha = glint;
          ctx.drawImage(stamp, sx - r, sy - r, r * 2, r * 2);
        }
      }
    }

    ctx.restore();
  }

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
  }

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

      // Distinct angled crepuscular god-ray shafts + sunlit motes inside open-water cavern/wreck shafts (v119)
      const shaftCount = Math.max(3, Math.min(6, Math.round(spanW / 3.4)));
      const tiltPx = (this.level.isWreck ? 4.8 : 3.2) * scale;
      ctx.globalCompositeOperation = 'screen';
      for (let sIdx = 0; sIdx < shaftCount; sIdx++) {
        const frac = (sIdx + 0.5) / shaftCount;
        const wave = Math.sin(timeSec * 0.85 + sIdx * 1.45) * 0.65;
        const shimmer = 0.55 + 0.45 * Math.sin(timeSec * 1.35 + sIdx * 2.1);
        const topWorldX = leftX + spanW * frac + wave * 0.45;
        const halfTop = Math.max(0.42, (spanW / shaftCount) * 0.24) * scale;
        const halfBot = halfTop * 2.25;
        const tx = toScreenX(topWorldX);
        const bx = tx + tiltPx + wave * 0.7 * scale;
        const shaftGrad = ctx.createLinearGradient(tx, sy0, bx, sy1);
        shaftGrad.addColorStop(0, `rgba(224, 242, 254, ${(0.11 + shimmer * 0.12).toFixed(3)})`);
        shaftGrad.addColorStop(0.5, `rgba(103, 232, 249, ${(0.045 + shimmer * 0.055).toFixed(3)})`);
        shaftGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = shaftGrad;
        ctx.beginPath();
        ctx.moveTo(tx - halfTop, sy0);
        ctx.lineTo(tx + halfTop, sy0);
        ctx.lineTo(bx + halfBot, sy1);
        ctx.lineTo(bx - halfBot, sy1);
        ctx.closePath();
        ctx.fill();
      }

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
      // Fin-wash hydrodynamic deflection when diver swims past flexible flora (v151)
      if (hasDiver && divSpd > 0.25 && (a.kind === 'vine' || a.kind === 'chara' || a.kind === 'biofilm' || a.kind === 'seafan')) {
        const dx = a.x - divX;
        const dy = a.y - divY;
        const dSq = dx * dx + dy * dy;
        if (dSq < 27.0) {
          const dist = Math.sqrt(dSq);
          const falloff = (1 - dist / 5.2);
          const pushDir = Math.abs(divVx) > 0.2 ? Math.sign(divVx) : Math.sign(dx || 1);
          const flutter = 0.72 + 0.28 * Math.sin(timeSec * 8.5 + a.phase);
          sway += pushDir * Math.min(0.42, falloff * falloff * (0.14 + divSpd * 0.14)) * flutter * scale;
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
    // Overhead Pelagic Shadow Crossing: slow colossal Whale Shark or Giant Manta silhouette gliding across open-water light (v156)
    const pelagic = stories?.pelagicShadow;
    if (pass === 'world' && pelagic && (pelagic.enabled !== false)) {
      const period = pelagic.periodSec || 46;
      const crossDur = pelagic.crossingDurationSec || Math.min(22, period * 0.48);
      const phaseTime = (((timeSec + (pelagic.phaseOffset || 0)) % period) + period) % period;
      if (phaseTime < crossDur) {
        const u = phaseTime / crossDur;
        const span = Math.max(12, pelagic.xMax - pelagic.xMin);
        const dir = (pelagic.direction ?? 1) >= 0 ? 1 : -1;
        const wx = dir > 0 ? pelagic.xMin + u * span : pelagic.xMax - u * span;
        const baseY = Number.isFinite(pelagic.y) ? pelagic.y : (pelagic.depthM || 6.0);
        const wy = baseY + Math.sin(u * Math.PI * 2) * 0.65;
        // Hard SDF rock-wall clearance guard: never draw pelagic shadow inside or clipping through solid rock!
        const sizeM = pelagic.size || pelagic.sizeM || 6.2;
        const halfM = sizeM * 0.42;
        const sdfMax = this.level
          ? Math.max(
              evaluateCaveSDF(this.level, wx, wy),
              evaluateCaveSDF(this.level, wx - halfM, wy),
              evaluateCaveSDF(this.level, wx + halfM, wy)
            )
          : -5;
        const rockClearFade = Math.max(0, Math.min(1, (-sdfMax - 0.35) / 1.45));
        const psx = toScreenX(wx);
        const psy = toScreenY(wy);
        const len = sizeM * scale;
        const fade = Math.sin(Math.min(1, Math.max(0, u)) * Math.PI) * rockClearFade;
        const alpha = 0.24 * fade;
        if (alpha > 0.01) {
          ctx.save();
          const sg = ctx.createLinearGradient?.(psx, psy, psx, psy + len * 1.45);
          if (sg && typeof sg.addColorStop === 'function') {
            sg.addColorStop(0, `rgba(2, 6, 23, ${(alpha * 0.85).toFixed(3)})`);
            sg.addColorStop(0.55, `rgba(2, 6, 23, ${(alpha * 0.38).toFixed(3)})`);
            sg.addColorStop(1, 'rgba(2, 6, 23, 0)');
            ctx.fillStyle = sg;
          } else {
            ctx.fillStyle = `rgba(2, 6, 23, ${(alpha * 0.45).toFixed(3)})`;
          }
          ctx.beginPath();
          ctx.moveTo(psx - len * 0.42, psy);
          ctx.lineTo(psx + len * 0.42, psy);
          ctx.lineTo(psx + len * 0.72, psy + len * 1.45);
          ctx.lineTo(psx - len * 0.72, psy + len * 1.45);
          ctx.closePath();
          ctx.fill();

          ctx.translate(psx, psy);
          ctx.scale(dir, 1);
          ctx.fillStyle = `rgba(3, 12, 26, ${(alpha * 1.65).toFixed(3)})`;
          if (pelagic.kind === 'manta' || pelagic.species === 'giant-manta') {
            const wingFlap = Math.sin(timeSec * 1.65) * len * 0.08;
            ctx.beginPath();
            ctx.moveTo(len * 0.36, 0);
            ctx.quadraticCurveTo(len * 0.08, -len * 0.28 + wingFlap, -len * 0.12, -len * 0.32 + wingFlap);
            ctx.quadraticCurveTo(-len * 0.2, -len * 0.06, -len * 0.48, 0);
            ctx.quadraticCurveTo(-len * 0.2, len * 0.06, -len * 0.12, len * 0.28 - wingFlap * 0.7);
            ctx.quadraticCurveTo(len * 0.08, len * 0.24 - wingFlap * 0.7, len * 0.36, 0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = `rgba(3, 12, 26, ${(alpha * 1.5).toFixed(3)})`;
            ctx.lineWidth = Math.max(1.2, 0.045 * scale);
            ctx.beginPath();
            ctx.moveTo(-len * 0.42, 0);
            ctx.quadraticCurveTo(-len * 0.64, Math.sin(timeSec * 2.2) * len * 0.05, -len * 0.84, 0);
            ctx.stroke();
          } else {
            const tailWag = Math.sin(timeSec * 1.35) * len * 0.055;
            ctx.beginPath();
            ctx.moveTo(len * 0.46, -len * 0.03);
            ctx.quadraticCurveTo(len * 0.12, -len * 0.16, -len * 0.34, -len * 0.04 + tailWag * 0.4);
            ctx.lineTo(-len * 0.56, -len * 0.18 + tailWag);
            ctx.lineTo(-len * 0.48, tailWag * 0.5);
            ctx.lineTo(-len * 0.54, len * 0.13 + tailWag);
            ctx.lineTo(-len * 0.34, len * 0.05 + tailWag * 0.4);
            ctx.quadraticCurveTo(len * 0.1, len * 0.14, len * 0.46, len * 0.04);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(len * 0.04, -len * 0.12);
            ctx.lineTo(-len * 0.06, -len * 0.23);
            ctx.lineTo(-len * 0.12, -len * 0.1);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
      }
    }
    const list = stories?.setPieces;
    if (!Array.isArray(list) || list.length === 0) return;

    ctx.save();
    for (let i = 0; i < list.length; i++) {
      const sp = list[i];
      if (!sp || sp.x < xMin || sp.x > xMax || sp.y < yMin || sp.y > yMax) continue;

      const sx = toScreenX(sp.x);
      const sy = toScreenY(sp.y);
      const sz = (sp.size || 1.0) * scale;

      if (pass === 'emissive') {
        if (sp.kind === 'emergency-lamp') {
          // Erratic dying-battery red-amber emergency bulkhead lamp glow
          const flick =
            0.38 +
            0.35 * Math.max(0, Math.sin(timeSec * 3.1 + sp.phase)) +
            0.27 * (Math.sin(timeSec * 19.3 + sp.phase * 2.7) > 0.72 ? 0.15 : 1);
          const rad = sz * 3.6;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const g = ctx.createRadialGradient?.(sx, sy + sz * 0.25, sz * 0.1, sx, sy + sz * 0.25, rad);
          if (g && typeof g.addColorStop === 'function') {
            g.addColorStop(0, `rgba(248, 113, 113, ${(0.55 * flick).toFixed(3)})`);
            g.addColorStop(0.35, `rgba(220, 38, 38, ${(0.24 * flick).toFixed(3)})`);
            g.addColorStop(1, 'rgba(185, 28, 28, 0)');
            ctx.fillStyle = g;
          } else {
            ctx.fillStyle = `rgba(220, 38, 38, ${(0.28 * flick).toFixed(3)})`;
          }
          ctx.beginPath();
          ctx.arc(sx, sy + sz * 0.25, rad, 0, Math.PI * 2);
          ctx.fill();
          // Glowing crimson bulb filament core
          ctx.fillStyle = `rgba(254, 202, 202, ${(0.85 * flick).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy + sz * 0.22, Math.max(2, sz * 0.14), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (sp.kind === 'porthole-shaft') {
          // Volumetric tilted cobalt-cyan porthole light shaft with drifting dust motes
          const len = (sp.shaftLen || 4.8) * scale;
          const ang = sp.shaftAngle || 0.44;
          const sway = Math.sin(timeSec * 1.1 + sp.phase) * 0.04;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(ang + sway);
          ctx.globalCompositeOperation = 'screen';
          const sg = ctx.createLinearGradient?.(0, 0, 0, len);
          if (sg && typeof sg.addColorStop === 'function') {
            sg.addColorStop(0, 'rgba(125, 211, 252, 0.32)');
            sg.addColorStop(0.5, 'rgba(56, 189, 248, 0.12)');
            sg.addColorStop(1, 'rgba(14, 165, 233, 0)');
            ctx.fillStyle = sg;
          } else {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
          }
          ctx.beginPath();
          ctx.moveTo(-sz * 0.34, 0);
          ctx.lineTo(sz * 0.34, 0);
          ctx.lineTo(sz * 1.28, len);
          ctx.lineTo(-sz * 1.05, len);
          ctx.closePath();
          ctx.fill();
          // Backlit dust motes suspended inside the porthole shaft
          ctx.fillStyle = 'rgba(224, 242, 254, 0.42)';
          for (let m = 0; m < 5; m++) {
            const frac = ((timeSec * 0.12 + m * 0.21 + sp.phase) % 1);
            const mx = Math.sin(timeSec * 1.4 + m * 2.1) * sz * (0.28 + frac * 0.52);
            const my = frac * len * 0.92;
            ctx.beginPath();
            ctx.arc(mx, my, Math.max(1.1, 0.038 * scale), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else if (sp.kind === 'halocline-lens') {
          // Undulating translucent freshwater-over-saltwater halocline optical shimmer wave
          const hw = (sp.halfWidth || 3.4) * scale;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const hg = ctx.createLinearGradient?.(sx, sy - 0.55 * scale, sx, sy + 0.55 * scale);
          if (hg && typeof hg.addColorStop === 'function') {
            hg.addColorStop(0, 'rgba(56, 189, 248, 0)');
            hg.addColorStop(0.45, 'rgba(103, 232, 249, 0.22)');
            hg.addColorStop(0.55, 'rgba(240, 249, 255, 0.32)');
            hg.addColorStop(1, 'rgba(14, 165, 233, 0)');
            ctx.fillStyle = hg;
          } else {
            ctx.fillStyle = 'rgba(103, 232, 249, 0.18)';
          }
          ctx.beginPath();
          ctx.ellipse(sx, sy, hw, 0.48 * scale, 0, 0, Math.PI * 2);
          ctx.fill();
          // Twin undulating liquid-glass refraction ripples
          for (let wIdx = 0; wIdx < 2; wIdx++) {
            ctx.strokeStyle = wIdx === 0 ? 'rgba(224, 242, 254, 0.44)' : 'rgba(56, 189, 248, 0.32)';
            ctx.lineWidth = Math.max(1.2, 0.045 * scale);
            ctx.beginPath();
            const steps = 14;
            for (let k = 0; k <= steps; k++) {
              const u = (k / steps) * 2 - 1;
              const wx = sx + u * hw;
              const env = Math.max(0, 1 - u * u);
              const wy =
                sy +
                (wIdx === 0 ? -0.06 : 0.08) * scale +
                Math.sin(timeSec * (2.2 + wIdx * 0.7) + u * 5.2 + sp.phase) * 0.14 * scale * env;
              if (k === 0) ctx.moveTo(wx, wy);
              else ctx.lineTo(wx, wy);
            }
            ctx.stroke();
          }
          ctx.restore();
        } else if (sp.kind === 'ice-arch' && Number.isFinite(sp.ceilY) && Number.isFinite(sp.floorY)) {
          // Subtle subglacial sapphire crystal refraction pulse along the ice arch
          const cy0 = toScreenY(sp.ceilY);
          const shimmer = 0.25 + 0.25 * Math.sin(timeSec * 1.9 + sp.phase);
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.strokeStyle = `rgba(125, 211, 252, ${shimmer.toFixed(3)})`;
          ctx.lineWidth = Math.max(1.5, 0.07 * scale);
          ctx.beginPath();
          ctx.moveTo(sx - sz * 0.55, cy0);
          ctx.quadraticCurveTo(sx, cy0 + sz * 0.9, sx + sz * 0.55, cy0);
          ctx.stroke();
          ctx.restore();
        } else if (sp.kind === 'air-dome') {
          // Trapped Overhead Air Dome: liquid-mercury mirror meniscus clinging to the ceiling pocket (v156)
          const hw = (sp.halfWidth || 2.1) * scale;
          const ripple = Math.sin(timeSec * 2.4 + sp.phase) * 0.06 * scale;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const ag = ctx.createLinearGradient?.(sx, sy - 0.52 * scale, sx, sy + 0.42 * scale);
          if (ag && typeof ag.addColorStop === 'function') {
            ag.addColorStop(0, 'rgba(186, 230, 253, 0.04)');
            ag.addColorStop(0.45, 'rgba(224, 242, 254, 0.56)');
            ag.addColorStop(0.62, 'rgba(255, 255, 255, 0.72)');
            ag.addColorStop(1, 'rgba(56, 189, 248, 0)');
            ctx.fillStyle = ag;
          } else {
            ctx.fillStyle = 'rgba(224, 242, 254, 0.48)';
          }
          ctx.beginPath();
          ctx.ellipse(sx, sy + ripple * 0.35, hw, 0.34 * scale, 0, 0, Math.PI * 2);
          ctx.fill();
          // Liquid-mirror undulating meniscus line
          ctx.strokeStyle = 'rgba(240, 249, 255, 0.85)';
          ctx.lineWidth = Math.max(1.5, 0.055 * scale);
          ctx.beginPath();
          const steps = 14;
          for (let k = 0; k <= steps; k++) {
            const u = (k / steps) * 2 - 1;
            const wx = sx + u * hw;
            const env = Math.max(0, 1 - u * u);
            const wy = sy + Math.sin(timeSec * 3.1 + u * 5.8 + sp.phase) * 0.09 * scale * env;
            if (k === 0) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
          }
          ctx.stroke();
          // Tiny silver exhaust bubbles coalescing along the mirror ceiling
          ctx.fillStyle = 'rgba(248, 250, 252, 0.78)';
          for (let b = 0; b < 4; b++) {
            const bx = sx + Math.sin(timeSec * 0.9 + b * 2.3 + sp.phase) * hw * 0.65;
            const by = sy + (0.04 + 0.05 * Math.cos(timeSec * 2.1 + b)) * scale;
            ctx.beginPath();
            ctx.arc(bx, by, Math.max(1.3, (0.045 + (b % 2) * 0.02) * scale), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else if (sp.kind === 'survey-station') {
          // Retro-reflective tape glint on vintage explorer cave survey marker
          const glint = 0.35 + 0.65 * Math.max(0, Math.sin(timeSec * 2.8 + sp.phase));
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(254, 240, 138, ${(0.55 * glint).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy - sz * 0.42, Math.max(1.8, 0.075 * scale), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        continue;
      }

      // === PRE-LIGHTING WORLD GEOMETRY PASS ===
      if (sp.kind === 'speleothem-cathedral' && Number.isFinite(sp.ceilY) && Number.isFinite(sp.floorY)) {
        // Monumental Ice-Age fluted calcite stalactite & stalagmite cathedral pillars
        const cy0 = toScreenY(sp.ceilY);
        const fy0 = toScreenY(sp.floorY);
        const span = Math.max(scale * 1.5, fy0 - cy0);
        const topLen = Math.min(span * 0.42, sz * 1.95);
        const botLen = Math.min(span * 0.44, sz * 2.1);

        // Twin ceiling stalactite icicles
        for (let k = -1; k <= 1; k++) {
          const ox = sx + k * sz * 0.34;
          const len = topLen * (k === 0 ? 1.0 : 0.68);
          const halfW = sz * (k === 0 ? 0.22 : 0.14);
          ctx.fillStyle = k === 0 ? '#786852' : '#615342';
          ctx.beginPath();
          ctx.moveTo(ox - halfW, cy0);
          ctx.lineTo(ox + halfW, cy0);
          ctx.lineTo(ox + halfW * 0.18, cy0 + len);
          ctx.lineTo(ox - halfW * 0.18, cy0 + len);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(214, 198, 170, 0.45)';
          ctx.lineWidth = Math.max(1, 0.03 * scale);
          ctx.beginPath();
          ctx.moveTo(ox - halfW * 0.2, cy0 + 2);
          ctx.lineTo(ox - halfW * 0.06, cy0 + len * 0.88);
          ctx.stroke();
        }
        // Twin floor stalagmite domes reaching upward
        for (let k = -1; k <= 1; k++) {
          const ox = sx + k * sz * 0.36;
          const len = botLen * (k === 0 ? 1.0 : 0.62);
          const halfW = sz * (k === 0 ? 0.28 : 0.18);
          ctx.fillStyle = k === 0 ? '#85735a' : '#6b5c48';
          ctx.beginPath();
          ctx.moveTo(ox - halfW, fy0);
          ctx.quadraticCurveTo(ox - halfW * 0.55, fy0 - len * 0.65, ox, fy0 - len);
          ctx.quadraticCurveTo(ox + halfW * 0.55, fy0 - len * 0.65, ox + halfW, fy0);
          ctx.closePath();
          ctx.fill();
          // Mineral drip rings
          ctx.strokeStyle = 'rgba(226, 211, 186, 0.32)';
          ctx.lineWidth = Math.max(1, 0.032 * scale);
          ctx.beginPath();
          ctx.moveTo(ox - halfW * 0.45, fy0 - len * 0.35);
          ctx.lineTo(ox + halfW * 0.45, fy0 - len * 0.35);
          ctx.stroke();
        }
      } else if (sp.kind === 'mine-timber' && Number.isFinite(sp.ceilY) && Number.isFinite(sp.floorY)) {
        // Historic flooded wooden mine drift shoring timbers & rusted iron joiner plates
        const cy0 = toScreenY(sp.ceilY);
        const fy0 = toScreenY(sp.floorY);
        const halfW = sz * 0.72;
        const beamW = Math.max(3, 0.18 * scale);
        ctx.fillStyle = '#452b17';
        ctx.strokeStyle = '#29180b';
        ctx.lineWidth = Math.max(1, 0.04 * scale);
        // Left & right vertical shoring posts
        ctx.fillRect(sx - halfW, cy0, beamW, fy0 - cy0);
        ctx.strokeRect(sx - halfW, cy0, beamW, fy0 - cy0);
        ctx.fillRect(sx + halfW - beamW, cy0, beamW, fy0 - cy0);
        ctx.strokeRect(sx + halfW - beamW, cy0, beamW, fy0 - cy0);
        // Overhead cross-lintel timber
        ctx.fillStyle = '#5c3a1e';
        ctx.fillRect(sx - halfW - beamW * 0.3, cy0, halfW * 2 + beamW * 0.6, beamW * 1.15);
        ctx.strokeRect(sx - halfW - beamW * 0.3, cy0, halfW * 2 + beamW * 0.6, beamW * 1.15);
        // Rusted iron corner gusset plates with bolts
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(sx - halfW, cy0 + beamW * 0.85, beamW * 1.25, beamW * 1.25);
        ctx.fillRect(sx + halfW - beamW * 1.25, cy0 + beamW * 0.85, beamW * 1.25, beamW * 1.25);
      } else if (sp.kind === 'ice-arch' && Number.isFinite(sp.ceilY) && Number.isFinite(sp.floorY)) {
        // Sculpted translucent subglacial blue-ice ribs
        const cy0 = toScreenY(sp.ceilY);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.65)';
        ctx.lineWidth = Math.max(1.2, 0.045 * scale);
        ctx.beginPath();
        ctx.moveTo(sx - sz * 0.7, cy0);
        ctx.quadraticCurveTo(sx, cy0 + sz * 1.15, sx + sz * 0.7, cy0);
        ctx.lineTo(sx + sz * 0.42, cy0);
        ctx.quadraticCurveTo(sx, cy0 + sz * 0.65, sx - sz * 0.42, cy0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (sp.kind === 'emergency-lamp') {
        // Cast-iron caged bulkhead sconce
        ctx.fillStyle = '#334155';
        ctx.fillRect(sx - sz * 0.24, sy - sz * 0.08, sz * 0.48, sz * 0.14);
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.arc(sx, sy + sz * 0.2, sz * 0.18, 0, Math.PI * 2);
        ctx.fill();
        // Brass protective cage bars
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = Math.max(1, 0.04 * scale);
        ctx.beginPath();
        ctx.arc(sx, sy + sz * 0.2, sz * 0.22, 0, Math.PI);
        ctx.moveTo(sx, sy + sz * 0.04);
        ctx.lineTo(sx, sy + sz * 0.42);
        ctx.stroke();
      } else if (sp.kind === 'porthole-shaft') {
        // Heavy bolted bronze ship porthole frame
        ctx.fillStyle = '#0c4a6e';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = Math.max(2.2, 0.1 * scale);
        ctx.beginPath();
        ctx.arc(sx, sy, sz * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 6 brass perimeter clamping dogs
        ctx.fillStyle = '#f59e0b';
        for (let b = 0; b < 6; b++) {
          const a = (b / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(sx + Math.cos(a) * sz * 0.44, sy + Math.sin(a) * sz * 0.44, Math.max(1.4, 0.045 * scale), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (sp.kind === 'brass-telegraph') {
        // Tilted Chadburn Engine-Room Brass Telegraph pedestal
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(sp.tilt || 0);
        // Cast-bronze flared base & column
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.moveTo(-sz * 0.24, 0);
        ctx.lineTo(sz * 0.24, 0);
        ctx.lineTo(sz * 0.1, -sz * 0.78);
        ctx.lineTo(-sz * 0.1, -sz * 0.78);
        ctx.closePath();
        ctx.fill();
        // Brass circular engraved dial head
        ctx.fillStyle = '#d97706';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = Math.max(1.2, 0.045 * scale);
        ctx.beginPath();
        ctx.arc(0, -sz * 0.92, sz * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Cream enamel inner dial & order pointer
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(0, -sz * 0.92, sz * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = Math.max(1.2, 0.04 * scale);
        ctx.beginPath();
        ctx.moveTo(0, -sz * 0.92);
        ctx.lineTo(sz * 0.15, -sz * 0.98);
        ctx.stroke();
        // Brass telegraph control lever sticking out top
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = Math.max(1.8, 0.06 * scale);
        ctx.beginPath();
        ctx.moveTo(0, -sz * 0.92);
        ctx.lineTo(sz * 0.34, -sz * 1.18);
        ctx.stroke();
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.arc(sz * 0.34, -sz * 1.18, Math.max(2, sz * 0.07), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (sp.kind === 'ship-wheel') {
        // Corroded 8-spoke teak & brass ship's helm wheel
        ctx.save();
        ctx.translate(sx, sy - sz * 0.56);
        ctx.rotate((sp.tilt || 0) * 1.5);
        const r = sz * 0.44;
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = Math.max(2.2, 0.08 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = Math.max(1.3, 0.048 * scale);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * r * 1.28, Math.sin(a) * r * 1.28);
          ctx.stroke();
        }
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (sp.kind === 'boiler-panel') {
        // Riveted iron boiler gauge board + twin cracked dials + copper pipes
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate((sp.tilt || 0) * 0.5);
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = Math.max(1.2, 0.045 * scale);
        ctx.fillRect(-sz * 0.48, -sz * 0.72, sz * 0.96, sz * 0.68);
        ctx.strokeRect(-sz * 0.48, -sz * 0.72, sz * 0.96, sz * 0.68);
        // Copper steam lines
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = Math.max(1.8, 0.06 * scale);
        ctx.beginPath();
        ctx.moveTo(-sz * 0.22, -sz * 0.04);
        ctx.lineTo(-sz * 0.22, -sz * 0.88);
        ctx.moveTo(sz * 0.22, -sz * 0.04);
        ctx.lineTo(sz * 0.22, -sz * 0.88);
        ctx.stroke();
        // Twin Bourdon dials
        for (const ox of [-sz * 0.22, sz * 0.22]) {
          ctx.fillStyle = '#e2e8f0';
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = Math.max(1.2, 0.045 * scale);
          ctx.beginPath();
          ctx.arc(ox, -sz * 0.42, sz * 0.16, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = Math.max(1, 0.03 * scale);
          ctx.beginPath();
          ctx.moveTo(ox, -sz * 0.42);
          ctx.lineTo(ox - sz * 0.09, -sz * 0.34);
          ctx.stroke();
        }
        ctx.restore();
      } else if (sp.kind === 'mayan-vessel') {
        // Sculpted submerged Mayan ceramic offering vessel resting on cenote silt
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(sp.tilt || 0);
        ctx.fillStyle = '#9a3412';
        ctx.strokeStyle = '#431407';
        ctx.lineWidth = Math.max(1.1, 0.04 * scale);
        ctx.beginPath();
        ctx.ellipse(0, -sz * 0.28, sz * 0.32, sz * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Flared ceramic neck & rim
        ctx.fillStyle = '#c2410c';
        ctx.beginPath();
        ctx.roundRect(-sz * 0.17, -sz * 0.62, sz * 0.34, sz * 0.16, sz * 0.05);
        ctx.fill();
        ctx.stroke();
        // Ochre geometric rim band
        ctx.strokeStyle = '#fdba74';
        ctx.lineWidth = Math.max(1.1, 0.04 * scale);
        ctx.beginPath();
        ctx.moveTo(-sz * 0.26, -sz * 0.3);
        ctx.lineTo(sz * 0.26, -sz * 0.3);
        ctx.stroke();
        ctx.restore();
      } else if (sp.kind === 'fossil-bed') {
        // Embedded logarithmic spiral ammonite fossil in limestone slab
        ctx.save();
        ctx.translate(sx, sy - sz * 0.24);
        ctx.fillStyle = '#57534e';
        ctx.beginPath();
        ctx.ellipse(0, sz * 0.08, sz * 0.44, sz * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d6d3d1';
        ctx.lineWidth = Math.max(1.4, 0.05 * scale);
        ctx.beginPath();
        for (let t = 0; t <= 18; t++) {
          const ang = t * 0.58;
          const rad = (t / 18) * sz * 0.26;
          const fx = Math.cos(ang) * rad;
          const fy = Math.sin(ang) * rad;
          if (t === 0) ctx.moveTo(fx, fy);
          else ctx.lineTo(fx, fy);
        }
        ctx.stroke();
        ctx.restore();
      } else if (sp.kind === 'survey-station') {
        // Hammered stainless cave survey piton & weathered brass station plate
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(1.6, 0.055 * scale);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy - sz * 0.45);
        ctx.stroke();
        ctx.fillStyle = '#eab308';
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = Math.max(1, 0.035 * scale);
        ctx.beginPath();
        ctx.moveTo(sx - sz * 0.22, sy - sz * 0.42);
        ctx.lineTo(sx + sz * 0.14, sy - sz * 0.54);
        ctx.lineTo(sx + sz * 0.24, sy - sz * 0.42);
        ctx.lineTo(sx + sz * 0.14, sy - sz * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * Ultra-Minimal "Diegetic Immersion Mode" wrist-computer depth tape & heading compass ribbon (v156).
   * Drawn directly on the canvas edge when Compact HUD is enabled so players can fly near-zero-chrome.
   */
  _drawDiegeticImmersionTape(ctx, cw, ch, diver, diveState, nextCheckpoint, timeSec = 0) {
    if (!diver || !diveState) return;
    const dpr = this._cachedDpr || 1;
    const depthM = Math.max(0, Number(diveState.depth) || 0);
    const ceilingM = Math.max(0, Number(diveState.decoCeilingM) || 0);
    const bar = Math.max(0, Math.round(Number(diveState.activeTankBar) || 0));
    const mixName = diveState.activeMix?.shortName || diveState.activeMix?.name || 'GAS';
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
    ctx.fillText(`${mixName} ${bar}`, tapeX + tapeW * 0.5, tapeY + tapeH + 11 * dpr);

    const ribW = Math.min(cw * 0.38, 210 * dpr);
    const ribH = 22 * dpr;
    const ribX = Math.round((cw - ribW) * 0.5);
    const ribY = 12 * dpr;
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

    const headingDeg = ((Math.round((Math.atan2(diver.facingY || 0, diver.facingX || 1) * 180) / Math.PI) + 90) % 360 + 360) % 360;
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

    // 1b. Universal Descent 22m TMX Gas-Switch Line (makes stopping & switching to Trimix unmistakable)
    const ascentCfg = getAscentConfig(this.level);
    const ascending = Boolean(checkpointsHit && checkpointsHit.has(ascentCfg.turnaroundId));
    if (!ascending && diveState && (this.level.bounds?.yMax || 0) > 28 && diver.y > 4 && diver.y < 38) {
      const switchY = toScreenY(22.0);
      if (switchY > -36 && switchY < ch + 36) {
        const needsTmx = diveState.activeGasId === 'EAN32' && diveState.tanks?.TMX1455?.bar > 1;
        const overdue = needsTmx && diver.y >= 24.5;
        const deepName = diveState.mixes?.TMX1455?.name || 'TMX 14/55';
        const pulse = 0.65 + 0.35 * Math.sin(timeSec * (overdue ? 9.0 : 5.0));
        const lineCol = overdue ? '#f87171' : needsTmx ? '#fbbf24' : '#4ade80';

        ctx.save();
        ctx.strokeStyle = lineCol;
        ctx.globalAlpha = needsTmx ? 0.62 + pulse * 0.34 : 0.42;
        ctx.lineWidth = needsTmx ? 2.6 : 1.5;
        ctx.setLineDash([12, 7]);
        ctx.beginPath();
        ctx.moveTo(0, switchY);
        ctx.lineTo(cw, switchY);
        ctx.stroke();
        ctx.setLineDash([]);

        const label = overdue
          ? `⛔ PASSED 22m LINE · STOP & SWITCH TO ${deepName} [2]`
          : needsTmx
            ? `▼ 22m GAS SWITCH LINE · STOP & SWITCH TO ${deepName} [2]`
            : `✓ 22m SWITCH COMPLETE · ON ${deepName}`;
        ctx.font = `800 ${Math.max(10, Math.round(0.35 * scale))}px ui-monospace, monospace`;
        const textW = ctx.measureText(label).width;
        const boxW = textW + 18;
        const boxH = Math.max(20, 0.64 * scale);
        const cx = Math.max(boxW * 0.5 + 10, Math.min(cw - boxW * 0.5 - 10, toScreenX(diver.x)));
        const pillY = switchY - boxH * 0.5 - 5;

        ctx.globalAlpha = needsTmx ? 0.96 : 0.72;
        ctx.fillStyle = overdue
          ? 'rgba(127, 29, 29, 0.92)'
          : needsTmx
            ? 'rgba(120, 53, 15, 0.92)'
            : 'rgba(6, 78, 59, 0.85)';
        ctx.strokeStyle = lineCol;
        ctx.lineWidth = needsTmx ? 1.8 : 1.2;
        ctx.beginPath();
        ctx.roundRect(cx - boxW * 0.5, pillY - boxH * 0.5, boxW, boxH, 999);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = overdue ? '#fecaca' : needsTmx ? '#fef08a' : '#bbf7d0';
        ctx.fillText(label, cx, pillY + 0.5);
        ctx.restore();
      }
    }

    // 2. Horizontal Gas Switch & 6m Deco Stop Zone Lines (not boxes)
    if (!this.level.zoneLines) return;
    ctx.save();
    for (const z of this.level.zoneLines) {
      if (!Number.isFinite(z?.y) || !Number.isFinite(z?.xMin) || !Number.isFinite(z?.xMax)) continue;
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

    // Urgent pulsing ring around the diver when breathing an unsafe/wrong gas
    if (gasCoach && step === gasCoach) {
      ctx.strokeStyle = isDanger ? `rgba(248, 113, 113, ${0.45 + pulse * 0.5})` : `rgba(251, 191, 36, ${0.35 + pulse * 0.45})`;
      ctx.lineWidth = isDanger ? 3.0 : 2.0;
      ctx.beginPath();
      ctx.arc(sx, sy, (1.15 + (isDanger ? 0.14 * pulse : 0.06 * pulse)) * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Compact floating action badge above diver: STOP · SWITCH TO TMX ... or NOW MOVE TO ...
    const label = step.shortLabel || (isStop ? `■ ${step.title}` : `▲ ${step.title}`);
    ctx.font = `800 ${Math.max(10, Math.round((isDanger ? 0.37 : 0.34) * scale))}px ui-monospace, monospace`;
    const padX = 9;
    const textW = ctx.measureText(label).width;
    const boxW = textW + padX * 2;
    const boxH = Math.max(22, 0.66 * scale);

    ctx.fillStyle = isDanger
      ? `rgba(153, 27, 27, ${0.88 + pulse * 0.1})`
      : isStop
        ? 'rgba(120, 53, 15, 0.92)'
        : 'rgba(8, 47, 73, 0.88)';
    ctx.strokeStyle = isDanger ? '#f87171' : isStop ? '#fbbf24' : '#38bdf8';
    ctx.lineWidth = isDanger ? 2.2 : 1.6;
    ctx.beginPath();
    ctx.roundRect(sx - boxW * 0.5, pillY - boxH * 0.5, boxW, boxH, 999);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDanger ? '#fef2f2' : isStop ? '#fde68a' : '#e0f2fe';
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
        item.kind === 'relic' || item.kind === 'gear'
          ? this.glowStamps.warm
          : item.kind === 'crystal' || item.kind === 'pearl'
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
      } else if (item.kind === 'pearl') {
        // Iridescent nacre oyster pearl nestled in a fluted dark shell
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(1.1, 0.04 * scale);
        ctx.beginPath();
        ctx.ellipse(0, r * 0.36, r * 0.88, r * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#e0e7ff';
        ctx.beginPath();
        ctx.arc(0, -r * 0.06, r * 0.56, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(244, 114, 182, 0.32)';
        ctx.beginPath();
        ctx.arc(r * 0.14, r * 0.08, r * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.beginPath();
        ctx.arc(-r * 0.18, -r * 0.24, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.kind === 'gear') {
        // Vintage brass submersible pressure gauge (SPG) / expedition compass
        ctx.fillStyle = '#b45309';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = Math.max(1.3, 0.05 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.64, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = Math.max(1.1, 0.045 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.52, -Math.PI * 0.85, Math.PI * 0.35);
        ctx.stroke();
        ctx.strokeStyle = '#f87171';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r * 0.42, -r * 0.24);
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

  _drawArticulatedLeg(ctx, pelvis, leg, toScreenX, toScreenY, scale, isPeer, isBackLeg, liverySuit = null) {
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
      liverySuit
    );
  }

  /**
   * Emissive bioluminescent plankton / dinoflagellate fin-wake sparkle trails (v119).
   */
  _drawBioWake(ctx, bioWake, xMin, xMax, yMin, yMax, toScreenX, toScreenY, scale, timeSec) {
    if (!Array.isArray(bioWake) || bioWake.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < bioWake.length; i++) {
      const p = bioWake[i];
      if (!p || p.x < xMin || p.x > xMax || p.y < yMin || p.y > yMax) continue;
      const frac = Math.max(0, Math.min(1, p.age / Math.max(0.2, p.life)));
      const fadeIn = Math.min(1, p.age / 0.14);
      const twinkle = 0.68 + 0.32 * Math.sin(timeSec * 8.5 + (p.phase || i));
      const alpha = fadeIn * (1 - frac) * (1 - frac) * 0.72 * twinkle;
      if (alpha < 0.02) continue;
      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      const r = Math.max(1.2, (p.size || 0.06) * scale * (1.15 - frac * 0.45));
      const hue = Math.round(p.hue || 184);
      ctx.fillStyle = `hsla(${hue}, 96%, 68%, ${(alpha * 0.38).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${hue}, 100%, 86%, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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
    // Expanding translucent hydrophone wavefront + trailing echo ring
    if (sweepProgress < 1) {
      const waveAlpha = (1 - sweepProgress) * 0.72;
      ctx.strokeStyle = `rgba(56, 189, 248, ${waveAlpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(2, 0.14 * scale);
      ctx.beginPath();
      ctx.arc(cx, cy, waveRadiusM * scale, 0, Math.PI * 2);
      ctx.stroke();

      if (waveRadiusM > 2.2) {
        ctx.strokeStyle = `rgba(103, 232, 249, ${(waveAlpha * 0.42).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.2, 0.06 * scale);
        ctx.beginPath();
        ctx.arc(cx, cy, (waveRadiusM - 1.8) * scale, 0, Math.PI * 2);
        ctx.stroke();
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

      const col = c.kind === 'recovery' ? '251, 191, 36' : c.kind === 'hatch' ? '249, 115, 22' : c.kind === 'stage' ? '74, 222, 128' : '56, 189, 248';
      const r = (0.65 + Math.sin(timeSec * 9 + i) * 0.12) * scale;
      ctx.strokeStyle = `rgba(${col}, ${(a * 0.95).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.8, 0.08 * scale);
      ctx.beginPath();
      ctx.moveTo(px, py - r);
      ctx.lineTo(px + r, py);
      ctx.lineTo(px, py + r);
      ctx.lineTo(px - r, py);
      ctx.closePath();
      ctx.stroke();
      ctx.font = `700 ${Math.max(10, Math.round(scale * 0.46))}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(248, 250, 252, ${a.toFixed(3)})`;
      ctx.fillText(c.icon || '◆', px, py);
      if (c.kind === 'collectible' || c.kind === 'recovery') {
        ctx.font = `800 ${Math.max(8, Math.round(scale * 0.28))}px ui-monospace, monospace`;
        ctx.fillStyle = `rgba(${col}, ${(a * 0.95).toFixed(3)})`;
        ctx.fillText(`${Math.round(c.dist)}m`, px, py + r + Math.max(6, scale * 0.22));
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

    // 1. Far leg (behind torso)
    this._drawArticulatedLeg(ctx, body.pelvis, body.legs[1], toScreenX, toScreenY, scale, isPeer, true, liveryPalette);

    // 2. Articulated Torso connecting shoulders (sx, sy) to pelvis (px, py)
    const accent = liveryPalette ? liveryPalette.trim : (isPeer ? '#fb923c' : '#22d3ee');
    const torsoAngle = Math.atan2(sy - py, sx - px);
    const rollScale = Math.abs(body.rollVisual) < 0.15 ? 0.15 : body.rollVisual;
    const facingLeft = body.facingSign < 0;

    // Flexible drysuit spine core
    this._drawLimbSegment(ctx, px, py, sx, sy, 0.36 * scale, liveryPalette ? liveryPalette.suitMid : '#0f172a');
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
    this._drawArticulatedLeg(ctx, body.pelvis, body.legs[0], toScreenX, toScreenY, scale, isPeer, false, liveryPalette);

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
      { torchOn: diver.torchOn !== false, glowStamps: this.glowStamps }
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

  _drawVolumetricTorchBeam(ctx, diver, torchData, rangeM, { siltHaze = 0, isPeer = false, intensityMult = 1.0, toScreenX, toScreenY, scale, timeSec = 0 } = {}) {
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
    const optic = getTorchOptic(diver?.livery?.torchId);
    const intensity = (isPeer ? 0.58 : 1.0) * intensityMult;
    const effectiveHaze = siltHaze * (1 - (optic.siltPierce || 0));
    const warmBoost = Math.min(0.18, effectiveHaze * 0.14);
    const beamAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : (diver.angle || 0);
    const scatterStamp = this.glowStamps?.torchBeamScatter;
    if (scatterStamp && optic.id === 'tech-led') {
      ctx.globalAlpha = Math.min(1, intensity * 0.85 + warmBoost * 1.4);
      ctx.drawImage(scatterStamp, tx - rPx, ty - rPx, rPx * 2, rPx * 2);
      ctx.globalAlpha = 1;
    } else {
      const scatter = ctx.createRadialGradient(tx, ty, 0.15 * scale, tx, ty, rPx);
      scatter.addColorStop(0, `rgba(${optic.coreRgb}, ${(0.28 * intensity + warmBoost).toFixed(3)})`);
      scatter.addColorStop(0.32, `rgba(${optic.shaftRgb}, ${(0.16 * intensity + warmBoost * 0.45).toFixed(3)})`);
      scatter.addColorStop(0.72, `rgba(${optic.shaftRgb}, ${(0.06 * intensity).toFixed(3)})`);
      scatter.addColorStop(1, `rgba(${optic.shaftRgb}, 0)`);
      ctx.fillStyle = scatter;
      ctx.fillRect(tx - rPx, ty - rPx, rPx * 2, rPx * 2);
    }

    // Tight hotspot beam core (follows torchAngle override for both local & co-divers)
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.arc(tx, ty, rPx * 0.9, beamAng - 0.13, beamAng + 0.13);
    ctx.closePath();
    ctx.fillStyle = `rgba(${optic.coreRgb}, ${(0.12 * intensity).toFixed(3)})`;
    ctx.fill();

    // Smooth feathered 2D Ray-Cast Tyndall / Particulate Light Shafts (coarser stride for remote peers = 2x faster GPU)
    ctx.globalCompositeOperation = 'lighter';
    const rayLen = torchData.rays.length;
    const shaftStep = isPeer ? 4 : 2;
    for (let i = 0; i < rayLen - shaftStep; i += shaftStep) {
      const rA = torchData.rays[i];
      const rB = torchData.rays[Math.min(rayLen - 1, i + shaftStep)];
      const centerDist = Math.abs((i + shaftStep * 0.5) / Math.max(1, rayLen - 1) - 0.5) * 2;
      const rayAlpha = (1 - centerDist * 0.75) * (isPeer ? 0.032 : 0.024) * intensity;
      ctx.fillStyle = `rgba(${optic.shaftRgb}, ${rayAlpha.toFixed(4)})`;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(toScreenX(rA.x), toScreenY(rA.y));
      ctx.lineTo(toScreenX(rB.x), toScreenY(rB.y));
      ctx.closePath();
      ctx.fill();
    }

    if (!isPeer) {
      // Suspended water particulates & soft bokeh plankton inside ray-cast torch polygon (cone-culled + zero-alloc scratch)
      const maxDistSq = rangeM * rangeM;
      const moteStamp = this.glowStamps.cyan;
      const sparks = this._torchSparksScratch;
      sparks.length = 0;
      const beamAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : (diver.angle || 0);
      const beamFx = Math.cos(beamAng);
      const beamFy = Math.sin(beamAng);
      const cell = 6;
      const gx0 = Math.floor((torchData.ox - rangeM) / cell);
      const gx1 = Math.ceil((torchData.ox + rangeM) / cell);
      const gy0 = Math.floor((torchData.oy - rangeM) / cell);
      const gy1 = Math.ceil((torchData.oy + rangeM) / cell);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gy = gy0; gy <= gy1; gy++) {
          for (let k = 0; k < 4; k++) {
            const h1 = Math.sin(gx * 127.1 + gy * 311.7 + k * 74.7) * 43758.5453;
            const r1 = h1 - Math.floor(h1);
            const h2 = Math.sin(gx * 269.5 + gy * 183.3 + k * 41.9) * 43758.5453;
            const r2 = h2 - Math.floor(h2);
            const wx = (gx + r1) * cell;
            const wy = (gy + r2) * cell;
            if (wy < 0.25) continue;
            const dx = wx - torchData.ox;
            const dy = wy - torchData.oy;
            const dSq = dx * dx + dy * dy;
            if (dSq > maxDistSq || dSq < 0.35) continue;
            const invDist = 1 / Math.sqrt(dSq);
            if ((dx * beamFx + dy * beamFy) * invDist < 0.72) continue; // Outside torch cone
            const phase = r1 * 6.283;
            const driftX = wx + Math.sin(timeSec * 0.78 + phase) * 0.19;
            const driftY = wy + Math.cos(timeSec * 0.62 + phase) * 0.14;
            const mx = toScreenX(driftX);
            const my = toScreenY(driftY);
            const size = 0.028 + r2 * 0.036;
            if (k === 0 && moteStamp) {
              const fade = Math.max(0, 1 - (dSq * invDist) / rangeM);
              const bokehR = Math.max(3.5, size * 6.2 * scale);
              ctx.globalAlpha = 0.26 * fade;
              ctx.drawImage(moteStamp, mx - bokehR, my - bokehR, bokehR * 2, bokehR * 2);
            }
            sparks.push(mx, my, Math.max(1, size * scale));
          }
        }
      }
      if (sparks.length > 0) {
        ctx.globalAlpha = 0.44;
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

    // Normal-weighted 2D diffuse limestone wall scatter + Snell's-window underside surface reflection
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const warmStamp = this.glowStamps.warm;
    const cyanStamp = this.glowStamps.cyan;
    const wallStep = isPeer ? 2 : 1;
    for (let i = 1; i < torchData.rays.length - 1; i += wallStep) {
      const pt = torchData.rays[i];
      if (pt.dist > rangeM) continue;
      if (pt.hitSurface && cyanStamp) {
        const strength = Math.max(0, (1 - pt.dist / rangeM) * (pt.incidence || 0.6)) * 0.24 * intensity;
        if (strength > 0.01) {
          const sx = toScreenX(pt.x);
          const sy = toScreenY(0.05);
          const rad = (0.95 + pt.dist * 0.08) * scale;
          ctx.globalAlpha = Math.min(0.45, strength);
          ctx.drawImage(cyanStamp, sx - rad * 1.4, sy - rad * 0.35, rad * 2.8, rad * 0.7);
        }
        continue;
      }
      if (!pt.hitWall) continue;
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

  _drawLighting(ctx, cw, ch, diver, peersInput, checkpointsHit, siltClouds, sunCurtains, toScreenX, toScreenY, scale, timeSec, bodyRecovered = false, localSiltDensity = 0, powerRelays = null, smb = null, ecosystem = null) {
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
    const wObj = this._activeWeather;
    const weatherDarkBoost = wObj?.darknessBoost || 0;
    const lightningFlash = wObj?.lightning ? computeStormLightningFlash(wObj, timeSec) : 0;
    const weatherSunScale = Math.min(1, (wObj ? wObj.sunIntensity : 1.0) + lightningFlash * 0.65);
    const effectiveDaylight = daylight * weatherSunScale;
    const darknessAlpha = Math.max(
      0.16,
      Math.min(0.96, 0.28 + depthFactor * 0.7 + weatherDarkBoost * (1 - depthFactor * 0.65) - effectiveDaylight * 0.55 - lightningFlash * 0.22)
    );

    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lw, lh);
    // Subtle depth-driven spectral absorption tint (shallow teal-navy -> abyssal indigo)
    const ambR = this.level.theme?.id === 'florida-karst' ? 8 : 2;
    const ambG = Math.round(11 - depthFactor * 6);
    const ambB = Math.round(18 + depthFactor * 4);
    lctx.fillStyle = `rgba(${ambR}, ${ambG}, ${ambB}, ${darknessAlpha.toFixed(3)})`;
    lctx.fillRect(0, 0, lw, lh);

    // Cut out open-sky daylight, physical ray-cast cenote sun shafts, and torch cones
    lctx.globalCompositeOperation = 'destination-out';

    // 1. Open sky & cliff-top daylight at Entrance & Exit top (y <= 0 stays sunlit even when diving deeper)
    const surfMaskY = toScreenY(0.1) * ry;
    if (surfMaskY > -20) {
      const fadeBot = surfMaskY + 1.4 * scale * ry;
      if (fadeBot > 0) {
        const cutTop = Math.max(0, surfMaskY - 4);
        const skyCutKey = `${Math.round(cutTop / 2)}|${Math.round(fadeBot / 2)}`;
        if (!this._skyCutGradCache || this._skyCutGradCache.key !== skyCutKey) {
          const skyCut = lctx.createLinearGradient(0, cutTop, 0, fadeBot);
          skyCut.addColorStop(0, 'rgba(0,0,0,1)');
          skyCut.addColorStop(0.65, 'rgba(0,0,0,0.92)');
          skyCut.addColorStop(1, 'rgba(0,0,0,0)');
          this._skyCutGradCache = { key: skyCutKey, grad: skyCut };
        }
        lctx.fillStyle = this._skyCutGradCache.grad;
        lctx.fillRect(0, 0, lw, Math.min(lh, fadeBot));
      }
    }

    // 2. Ray-cast underwater sun shafts entering Cenote Alpha (entrance) & Cenote Beta (exit)
    if (sunCurtains && sunCurtains.length > 0 && weatherSunScale > 0.08) {
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
        sunCut.addColorStop(0, `rgba(0,0,0,${(0.98 * weatherSunScale).toFixed(3)})`);
        sunCut.addColorStop(0.35, `rgba(0,0,0,${(0.85 * weatherSunScale).toFixed(3)})`);
        sunCut.addColorStop(0.75, `rgba(0,0,0,${(0.42 * weatherSunScale).toFixed(3)})`);
        sunCut.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = sunCut;
        lctx.fill();
        lctx.restore();
      }
    }

    const localTorchAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : diver.angle;
    const localRayCount = Math.max(26, Math.round(52 * (this._perfBudget?.rayScale ?? 1)));
    const localTorch = diver.torchOn !== false
      ? {
          ox: diver.body?.hand ? diver.body.hand.x : diver.x,
          oy: diver.body?.hand ? diver.body.hand.y : diver.y,
          rays: castTorchFan(
            this.level,
            diver.body?.hand ? diver.body.hand.x : diver.x,
            diver.body?.hand ? diver.body.hand.y : diver.y,
            localTorchAng,
            0.44,
            16.5 * (getTorchOptic(diver?.livery?.torchId).rangeMult || 1.0),
            localRayCount,
            siltClouds
          ),
        }
      : null;

    const peerList = Array.isArray(peersInput) ? peersInput : (peersInput ? [peersInput] : []);
    const peerTorches = [];
    const halfViewW = (cw / Math.max(1, scale)) * 0.5;
    const halfViewH = (ch / Math.max(1, scale)) * 0.5;
    const viewMinX = this.camX - halfViewW - 2;
    const viewMaxX = this.camX + halfViewW + 2;
    const viewMinY = this.camY - halfViewH - 2;
    const viewMaxY = this.camY + halfViewH + 2;
    const nowPerf = _nowMs();
    const peerRange = 14.0;
    const peerHalfSpread = 0.4;
    const activePeerKeys = this._activePeerKeysScratch || (this._activePeerKeysScratch = new Set());
    activePeerKeys.clear();

    // First pass: directional beam-cone frustum culling so offscreen beams pointing away cost 0 CPU/GPU
    const visibleTorchPeers = this._visibleTorchPeersScratch || (this._visibleTorchPeersScratch = []);
    visibleTorchPeers.length = 0;
    for (let i = 0; i < peerList.length; i++) {
      const p = peerList[i];
      if (!p || p.alive === false || p.torchOn === false) continue;
      const ox = p.body?.hand ? p.body.hand.x : p.x;
      const oy = p.body?.hand ? p.body.hand.y : p.y;
      const pTorchAng = Number.isFinite(p.torchAngle) ? p.torchAngle : (p.angle || 0);
      const a0 = pTorchAng - peerHalfSpread;
      const a1 = pTorchAng + peerHalfSpread;
      const tipX0 = ox + Math.cos(a0) * peerRange;
      const tipY0 = oy + Math.sin(a0) * peerRange;
      const tipX1 = ox + Math.cos(a1) * peerRange;
      const tipY1 = oy + Math.sin(a1) * peerRange;
      const tipXc = ox + Math.cos(pTorchAng) * peerRange;
      const tipYc = oy + Math.sin(pTorchAng) * peerRange;
      const bMinX = Math.min(ox, tipX0, tipX1, tipXc);
      const bMaxX = Math.max(ox, tipX0, tipX1, tipXc);
      const bMinY = Math.min(oy, tipY0, tipY1, tipYc);
      const bMaxY = Math.max(oy, tipY0, tipY1, tipYc);
      if (bMaxX < viewMinX || bMinX > viewMaxX || bMaxY < viewMinY || bMinY > viewMaxY) continue;
      visibleTorchPeers.push({ peer: p, ox, oy, pTorchAng, key: p.id || `peer_${i}` });
    }

    // Adaptive ray budget + pose-delta raycast cache per peer (cuts co-op CPU by 70-90%!)
    const basePeerRays = (this._isCoarseMobile || visibleTorchPeers.length >= 2 || cw < 900) ? 16 : 22;
    const peerRayCount = Math.min(basePeerRays, this._perfBudget?.peerRayMax ?? basePeerRays);
    const hasSilt = siltClouds && siltClouds.length > 0;
    const cacheMaxAgeMs = hasSilt ? 55 : 135;

    for (let i = 0; i < visibleTorchPeers.length; i++) {
      const vp = visibleTorchPeers[i];
      activePeerKeys.add(vp.key);
      const prev = this._peerTorchCache.get(vp.key);
      let rays = null;
      if (prev && prev.levelId === this.level?.id && prev.rayCount === peerRayCount) {
        let angDelta = vp.pTorchAng - prev.angle;
        while (angDelta > Math.PI) angDelta -= Math.PI * 2;
        while (angDelta < -Math.PI) angDelta += Math.PI * 2;
        const posDeltaSq = (vp.ox - prev.ox) * (vp.ox - prev.ox) + (vp.oy - prev.oy) * (vp.oy - prev.oy);
        if (posDeltaSq < 0.0196 && Math.abs(angDelta) < 0.035 && nowPerf - prev.at < cacheMaxAgeMs) {
          rays = prev.rays;
        }
      }
      if (!rays) {
        rays = castTorchFan(this.level, vp.ox, vp.oy, vp.pTorchAng, peerHalfSpread, peerRange, peerRayCount, siltClouds);
        this._peerTorchCache.set(vp.key, {
          levelId: this.level?.id,
          ox: vp.ox,
          oy: vp.oy,
          angle: vp.pTorchAng,
          rayCount: peerRayCount,
          at: nowPerf,
          rays,
        });
      }
      peerTorches.push({
        peer: vp.peer,
        torch: {
          ox: vp.ox,
          oy: vp.oy,
          rays,
        },
      });
    }
    // Prune disconnected/offscreen peer cache entries to prevent stale growth
    if (this._peerTorchCache.size > activePeerKeys.size + 4) {
      for (const k of this._peerTorchCache.keys()) {
        if (!activePeerKeys.has(k)) this._peerTorchCache.delete(k);
      }
    }

    const cutoutStamp = this.glowStamps.cutout;
    const spillCutoutStamp = this.glowStamps.torchSpillCutout;
    const hotCutoutStamp = this.glowStamps.torchHotCutout;
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
      const beamAng = Number.isFinite(d.torchAngle) ? d.torchAngle : (d.angle || 0);

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

      // Wide spill cone via pre-baked radial cutout stamp (0 per-frame gradient allocation!)
      if (spillCutoutStamp) {
        lctx.drawImage(spillCutoutStamp, tx - rPx, ty - rPx, rPx * 2, rPx * 2);
      } else {
        const spill = lctx.createRadialGradient(tx, ty, 0.15 * scale * rx, tx, ty, rPx);
        spill.addColorStop(0, 'rgba(0,0,0,1)');
        spill.addColorStop(0.45, 'rgba(0,0,0,0.88)');
        spill.addColorStop(0.78, 'rgba(0,0,0,0.45)');
        spill.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = spill;
        lctx.fillRect(tx - rPx, ty - rPx, rPx * 2, rPx * 2);
      }

      // Tight intense hotspot beam core (follows torchAngle override!)
      const hotR = rPx * 0.92;
      lctx.beginPath();
      lctx.moveTo(tx, ty);
      lctx.arc(tx, ty, hotR, beamAng - 0.14, beamAng + 0.14);
      lctx.closePath();
      if (hotCutoutStamp) {
        lctx.clip();
        lctx.drawImage(hotCutoutStamp, tx - hotR, ty - hotR, hotR * 2, hotR * 2);
      } else {
        const hot = lctx.createRadialGradient(tx, ty, 0.1 * scale * rx, tx, ty, hotR);
        hot.addColorStop(0, 'rgba(0,0,0,1)');
        hot.addColorStop(0.7, 'rgba(0,0,0,0.95)');
        hot.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = hot;
        lctx.fill();
      }

      lctx.restore();
    };

    const localStrobe = Number.isFinite(diver.strobeMod) ? diver.strobeMod : 1.0;
    carveDiverLight(diver, localTorch, 16.5 * (0.28 + 0.72 * localStrobe));
    const torchPeerIds = this._torchPeerIdsScratch || (this._torchPeerIdsScratch = new Set());
    torchPeerIds.clear();
    for (let i = 0; i < peerTorches.length; i++) {
      const pt = peerTorches[i];
      if (pt.peer?.id) torchPeerIds.add(pt.peer.id);
      carveDiverLight(pt.peer, pt.torch, 14.0);
    }
    // Always carve a soft personal ambient halo around dark/downed buddies so they stay visible
    for (let i = 0; i < peerList.length; i++) {
      const p = peerList[i];
      if (!p || (p.id && torchPeerIds.has(p.id)) || p.alive !== false && p.torchOn !== false) continue;
      carveDiverLight(p, null, 0);
    }

    // Active Emergency Wreck Power Relay Chamber Floodlights punch huge 17.5m holes through darkness! (v162)
    if (Array.isArray(powerRelays)) {
      for (let i = 0; i < powerRelays.length; i++) {
        const rel = powerRelays[i];
        if (!rel || !rel.active) continue;
        const rSx = toScreenX(rel.x) * rx;
        const rSy = toScreenY(rel.y) * ry;
        const flick = 0.92 + 0.08 * Math.sin(timeSec * 14 + (rel.flickerPhase || 0)) * Math.sin(timeSec * 3.7);
        const floodR = (rel.radius || 17.5) * scale * rx * flick;
        if (rSx + floodR < 0 || rSx - floodR > lw || rSy + floodR < 0 || rSy - floodR > lh) continue;
        const fg = lctx.createRadialGradient(rSx, rSy, floodR * 0.06, rSx, rSy, floodR);
        fg.addColorStop(0, 'rgba(0,0,0,0.96)');
        fg.addColorStop(0.55, 'rgba(0,0,0,0.78)');
        fg.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = fg;
        lctx.fillRect(rSx - floodR, rSy - floodR, floodR * 2, floodR * 2);
      }
    }
    // Topside Support Boat Spotlight cutting down onto a surfaced orange dSMB (v162)
    if (smb?.active && smb.surfaced) {
      const smx = toScreenX(smb.x) * rx;
      const smTop = toScreenY(0) * ry;
      const smBot = toScreenY(16) * ry;
      const halfTop = 2.6 * scale * rx;
      const halfBot = 7.2 * scale * rx;
      lctx.save();
      lctx.beginPath();
      lctx.moveTo(smx - halfTop, smTop);
      lctx.lineTo(smx + halfTop, smTop);
      lctx.lineTo(smx + halfBot, smBot);
      lctx.lineTo(smx - halfBot, smBot);
      lctx.closePath();
      const sg = lctx.createLinearGradient(0, smTop, 0, smBot);
      sg.addColorStop(0, 'rgba(0,0,0,0.88)');
      sg.addColorStop(0.65, 'rgba(0,0,0,0.42)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = sg;
      lctx.fill();
      lctx.restore();
    }
    // Soft bioluminescent/moonlit rim reveal on escorting Megafauna (Mantas, Belugas, Reef Sharks) so they shine beside your wing
    if (Array.isArray(ecosystem?.megafauna)) {
      for (let i = 0; i < ecosystem.megafauna.length; i++) {
        const m = ecosystem.megafauna[i];
        if (!m || (m.behavior !== 'escort' && m.behavior !== 'curious')) continue;
        const isEsc = m.behavior === 'escort';
        const mx = toScreenX(m.x) * rx;
        const my = toScreenY(m.y) * ry;
        const mr = Math.max(5.2, (m.size || 1.8) * (isEsc ? 3.2 : 2.3)) * scale * rx;
        if (mx + mr < 0 || mx - mr > lw || my + mr < 0 || my - mr > lh) continue;
        const mg = lctx.createRadialGradient(mx, my, mr * 0.08, mx, my, mr);
        mg.addColorStop(0, isEsc ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0.45)');
        mg.addColorStop(0.55, isEsc ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.18)');
        mg.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = mg;
        lctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
      }
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

    // Geothermal vent illumination cutouts (lights up surrounding volcanic basalt/chimney walls)
    if (cutoutStamp && Array.isArray(this.level.geothermalVents)) {
      for (let i = 0; i < this.level.geothermalVents.length; i++) {
        const v = this.level.geothermalVents[i];
        const vx = toScreenX(v.x) * rx;
        const vy = toScreenY(v.y - (v.plumeHeight ? v.plumeHeight * 0.18 : 1.0)) * ry;
        const rad = (4.2 + (v.radius || 1.2) * 1.4) * scale * rx;
        if (vx + rad < 0 || vx - rad > lw || vy + rad < 0 || vy - rad > lh) continue;
        const pulse = 0.62 + 0.22 * Math.sin(timeSec * 3.4 + i * 1.7);
        lctx.globalAlpha = Math.min(0.88, pulse * (0.75 + (v.strength || 0.7) * 0.25));
        lctx.drawImage(cutoutStamp, vx - rad, vy - rad, rad * 2, rad * 2);
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
      this._drawVolumetricTorchBeam(ctx, diver, localTorch, 15.5 * (0.3 + 0.7 * localStrobe), {
        siltHaze: localSiltDensity,
        isPeer: false,
        intensityMult: 0.22 + 0.78 * localStrobe,
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

  _drawBubbles(ctx, cw, ch, toScreenX, toScreenY, scale, bubbles) {
    if (!bubbles || !bubbles.length) return;
    ctx.save();

    // Pass 1: Fast batched micro-bubbles (< 2.5px)
    let hasMicro = false;
    ctx.fillStyle = 'rgba(210, 240, 255, 0.56)';
    ctx.beginPath();
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      if (b.trapped) continue;
      const r = Math.max(1.1, b.r * scale);
      if (r >= 2.5) continue;
      const sx = toScreenX(b.x);
      const sy = toScreenY(b.y);
      if (sx < -12 || sx > cw + 12 || sy < -12 || sy > ch + 12) continue;
      ctx.moveTo(sx + r, sy);
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      hasMicro = true;
    }
    if (hasMicro) ctx.fill();

    // Pass 2: Oblate wobbling primary bubbles & silver ceiling-trapped mercury bubbles
    const glints = [];
    let hasRising = false;
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.74)';
    ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      if (b.trapped) continue;
      const r = b.r * scale;
      if (r < 2.5) continue;
      const sx = toScreenX(b.x);
      const sy = toScreenY(b.y);
      if (sx < -24 || sx > cw + 24 || sy < -24 || sy > ch + 24) continue;
      const wobble = b.wobbleFreq ? Math.sin((b.age || 0) * b.wobbleFreq + (b.wobblePhase || 0)) : 0;
      const oblate = Math.min(0.28, (r / 14) * 0.22) + Math.abs(wobble) * 0.06;
      const rx = r * (1 + oblate);
      const ry = r * (1 - oblate * 0.65);
      const tilt = wobble * 0.24;
      ctx.moveTo(sx + Math.cos(tilt) * rx, sy + Math.sin(tilt) * rx);
      ctx.ellipse(sx, sy, rx, ry, tilt, 0, Math.PI * 2);
      hasRising = true;
      if (r >= 3.0) {
        glints.push(sx - rx * 0.34, sy - ry * 0.34, Math.max(0.85, r * 0.24));
      }
    }
    if (hasRising) {
      ctx.fill();
      ctx.stroke();
    }

    // Pass 3: Silver ceiling-trapped percolation bubbles hugging overhead rock
    let hasTrapped = false;
    ctx.fillStyle = 'rgba(224, 242, 254, 0.44)';
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.78)';
    ctx.lineWidth = 1.05;
    ctx.beginPath();
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      if (!b.trapped) continue;
      const sx = toScreenX(b.x);
      const sy = toScreenY(b.y);
      if (sx < -24 || sx > cw + 24 || sy < -24 || sy > ch + 24) continue;
      const fade = Math.max(0.2, Math.min(1, b.life / 0.85));
      const r = Math.max(1.6, b.r * scale * (0.75 + 0.25 * fade));
      const rx = r * 1.48;
      const ry = Math.max(1.1, r * 0.46);
      ctx.moveTo(sx + rx, sy);
      ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
      hasTrapped = true;
    }
    if (hasTrapped) {
      ctx.fill();
      ctx.stroke();
    }

    // Pass 4: Specular highlights on primary bubbles
    if (glints.length > 0) {
      ctx.fillStyle = 'rgba(248, 250, 252, 0.82)';
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
    const rustStamp = this.glowStamps.rustSilt || baseStamp;
    const warmStamp = this.glowStamps.warm;

    const localBeamAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : (diver.angle || 0);
    // Zero-GC reusable light source pool for silt backscatter (v144)
    const lights = this._siltLightsScratch || (this._siltLightsScratch = []);
    let lightCount = 1;
    if (!lights[0]) lights[0] = { x: 0, y: 0, fx: 1, fy: 0, torchOn: true };
    lights[0].x = diver.x;
    lights[0].y = diver.y;
    lights[0].fx = Math.cos(localBeamAng);
    lights[0].fy = Math.sin(localBeamAng);
    lights[0].torchOn = diver.torchOn !== false;
    if (Array.isArray(peerList)) {
      for (let i = 0; i < peerList.length; i++) {
        const p = peerList[i];
        if (!p || p.alive === false) continue;
        const pBeamAng = Number.isFinite(p.torchAngle) ? p.torchAngle : (p.angle || 0);
        if (!lights[lightCount]) lights[lightCount] = { x: 0, y: 0, fx: 1, fy: 0, torchOn: true };
        const slot = lights[lightCount++];
        slot.x = p.x;
        slot.y = p.y;
        slot.fx = Math.cos(pBeamAng);
        slot.fy = Math.sin(pBeamAng);
        slot.torchOn = p.torchOn !== false;
      }
    }

    // Pass 1: all source-over silt bodies & wispy tendrils; collect lit glare records for Pass 2
    const glareList = this._siltGlareScratch;
    glareList.length = 0;
    const tendrilLimit = this._perfBudget?.siltTendrilLimit ?? (this._isCoarseMobile ? 24 : 999);
    const skipSmallAlpha = this._perfBudget?.siltSkipSmallBelow ?? 0;
    ctx.globalCompositeOperation = 'source-over';

    for (let i = 0; i < siltClouds.length; i++) {
      const s = siltClouds[i];
      if (skipSmallAlpha > 0 && s.alpha < skipSmallAlpha) continue;
      const sx = toScreenX(s.x);
      const sy = toScreenY(s.y);
      const r = s.radius * scale;
      if (sx + r * 1.3 < 0 || sx - r * 1.3 > cw || sy + r * 1.3 < 0 || sy - r * 1.3 > ch) continue;

      let lit = 0.24;
      let glare = 0;
      for (let l = 0; l < lightCount; l++) {
        const src = lights[l];
        const dx = s.x - src.x;
        const dy = s.y - src.y;
        const dSq = dx * dx + dy * dy;
        if (dSq >= 210.25) continue; // 14.5^2
        const dist = Math.sqrt(dSq);
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
      const cloudBase = s.isRust ? rustStamp : baseStamp;
      ctx.globalAlpha = Math.min(0.72, s.alpha * (0.36 + lit * 0.4));
      ctx.drawImage(cloudBase, sx - r * 0.92, sy - r * 0.92, r * 1.84, r * 1.84);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(rot);
      ctx.globalAlpha = Math.min(0.88, s.alpha * (0.48 + lit * 0.44));
      ctx.drawImage(s.isRust ? rustStamp : wispStamp, -r * 1.15, -r * 1.05, r * 2.3, r * 2.1);

      // Counter-rotating secondary billowing tendril (governed by adaptive 60 FPS mobile budget)
      if (lifeRatio < 0.96 && siltClouds.length <= tendrilLimit) {
        ctx.rotate(-rot * 1.7 + 1.1);
        ctx.globalAlpha = Math.min(0.54, s.alpha * 0.42);
        ctx.drawImage(s.isRust ? rustStamp : wispStamp, -r * 0.85, -r * 0.95, r * 1.9, r * 1.75);
      }
      ctx.restore();

      if (glare > 0.01) {
        glareList.push(sx, sy, r, glare, s.seed || 0, s.isRust ? 1 : 0);
      }
    }

    // Pass 2: single batched 'screen' torch backscatter (warm limestone vs burnt-orange shipwreck rust!)
    if (glareList.length > 0) {
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < glareList.length; i += 6) {
        const sx = glareList[i];
        const sy = glareList[i + 1];
        const r = glareList[i + 2];
        const glare = glareList[i + 3];
        const isRust = glareList[i + 5] === 1;
        ctx.globalAlpha = Math.min(0.65, glare * (isRust ? 0.82 : 0.72));
        ctx.drawImage(isRust ? rustStamp : warmStamp, sx - r * 0.9, sy - r * 0.9, r * 1.8, r * 1.8);
      }

      // Pass 3: single batched 'source-over' suspended sediment glints
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(236, 224, 198, 0.45)';
      for (let i = 0; i < glareList.length; i += 6) {
        const sx = glareList[i];
        const sy = glareList[i + 1];
        const r = glareList[i + 2];
        const seed = glareList[i + 4];
        for (let k = 0; k < 4; k++) {
          const a = seed + k * 1.65 + timeSec * 0.25;
          const d = r * (0.25 + ((k * 37) % 10) * 0.055);
          ctx.fillRect(sx + Math.cos(a) * d, sy + Math.sin(a * 1.2) * d * 0.75, 2.2, 2.2);
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

  _drawEmergencyDrillOverlay(ctx, cw, ch, drills, timeSec) {
    if (!drills) return;
    const active = drills.active;
    ctx.save();

    if (active?.kind === 'mask-flood') {
      const sev = Math.max(0.25, Math.min(1, active.severity ?? 0.65));
      const waterTopY = ch * (0.72 - sev * 0.44);
      const grad = ctx.createLinearGradient(0, waterTopY - 24, 0, ch);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      grad.addColorStop(0.14, `rgba(125, 211, 252, ${0.22 + sev * 0.24})`);
      grad.addColorStop(0.55, `rgba(14, 116, 144, ${0.32 + sev * 0.26})`);
      grad.addColorStop(1, `rgba(7, 42, 71, ${0.44 + sev * 0.25})`);

      // Rising sloshing water-line meniscus inside the dive mask
      ctx.beginPath();
      ctx.moveTo(0, ch);
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const px = (i / steps) * cw;
        const slosh =
          Math.sin(timeSec * 3.8 + i * 0.72) * (6 + sev * 7) +
          Math.cos(timeSec * 2.3 - i * 0.45) * 4;
        ctx.lineTo(px, waterTopY + slosh);
      }
      ctx.lineTo(cw, ch);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Refractive shimmering bright meniscus ridge
      ctx.strokeStyle = `rgba(224, 242, 254, ${0.55 + sev * 0.3})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const px = (i / steps) * cw;
        const slosh =
          Math.sin(timeSec * 3.8 + i * 0.72) * (6 + sev * 7) +
          Math.cos(timeSec * 2.3 - i * 0.45) * 4;
        if (i === 0) ctx.moveTo(px, waterTopY + slosh);
        else ctx.lineTo(px, waterTopY + slosh);
      }
      ctx.stroke();

      // Scattered refraction droplets across upper visor glass
      ctx.fillStyle = `rgba(186, 230, 253, ${0.18 + sev * 0.16})`;
      for (let k = 0; k < 14; k++) {
        const dx = ((k * 197 + 43) % 100) * 0.01 * cw;
        const dy = ((k * 131 + 19) % 100) * 0.01 * waterTopY;
        const r = 4 + (k % 4) * 3.5;
        ctx.beginPath();
        ctx.arc(dx, dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (active?.kind === 'free-flow') {
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 9.0);
      ctx.strokeStyle = `rgba(251, 191, 36, ${0.26 + pulse * 0.32})`;
      ctx.lineWidth = Math.max(6, Math.min(cw, ch) * 0.014);
      ctx.strokeRect(4, 4, cw - 8, ch - 8);
    } else if (active?.kind === 'torch-fail') {
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 12.0);
      ctx.strokeStyle = `rgba(248, 113, 113, ${0.22 + pulse * 0.28})`;
      ctx.lineWidth = Math.max(5, Math.min(cw, ch) * 0.012);
      ctx.strokeRect(4, 4, cw - 8, ch - 8);
    }

    if (drills.backupTorchActive && !active) {
      // Subtle warm halogen amber lens tint when operating on backup light
      ctx.fillStyle = 'rgba(251, 191, 36, 0.045)';
      ctx.fillRect(0, 0, cw, ch);
    }

    ctx.restore();
  }

  /**
   * Shimmering animated underwater caustic light webs projected along sunlit shallow floors & wreck decks (v124).
   * Uses ray-traced sunCurtains hit points so dark overhead cave passages stay authentically shadow-free.
   */
  _drawCausticWebs(ctx, sunCurtains, toScreenX, toScreenY, scale, timeSec) {
    if (!Array.isArray(sunCurtains) || sunCurtains.length === 0) return;
    const t = this._reducedMotion ? timeSec * 0.25 : timeSec;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let c = 0; c < sunCurtains.length; c++) {
      const curtain = sunCurtains[c];
      const rays = Array.isArray(curtain) ? curtain : curtain?.rays;
      if (!Array.isArray(rays) || rays.length < 2) continue;

      // Project caustic dance cells along the sunlit floor/deck contour (0.4m .. 22m depth)
      for (let i = 0; i < rays.length - 1; i++) {
        const a = rays[i];
        const b = rays[i + 1];
        if (!a || !b) continue;
        if (a.hitWall === false && b.hitWall === false) continue;
        const midY = (a.yBot + b.yBot) * 0.5;
        if (midY < 0.35 || midY > 22.5) continue;
        const depthFade = Math.pow(Math.max(0, 1 - midY / 23.0), 1.35);
        if (depthFade <= 0.03) continue;

        const ax = toScreenX(a.xBot);
        const ay = toScreenY(a.yBot);
        const bx = toScreenX(b.xBot);
        const by = toScreenY(b.yBot);
        const segLen = Math.hypot(bx - ax, by - ay);
        if (segLen < 2 || segLen > scale * 9) continue;

        const wave1 = 0.5 + 0.5 * Math.sin(a.xBot * 1.45 + t * 2.35 + c * 1.3);
        const wave2 = 0.5 + 0.5 * Math.cos(a.xBot * 2.4 - t * 1.85 + midY * 0.45);
        const shimmer = (0.35 + 0.65 * wave1 * wave2) * depthFade;

        // Luminous caustic ribbon hugging the rock/deck contour
        ctx.strokeStyle = `rgba(186, 245, 255, ${(0.22 + shimmer * 0.38).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, (0.09 + shimmer * 0.14) * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();

        // Interference caustic cell arcs dancing just above the sunlit surface
        const cx = (ax + bx) * 0.5 + Math.sin(t * 2.1 + i * 1.7) * 0.16 * scale;
        const cy = (ay + by) * 0.5 - (0.28 + wave1 * 0.35) * scale;
        const rx = Math.max(4, (0.42 + wave2 * 0.36) * scale);
        const ry = Math.max(2, rx * 0.34);
        ctx.strokeStyle = `rgba(224, 252, 255, ${(shimmer * 0.32).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, 0.045 * scale);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, Math.sin(t * 1.2 + i) * 0.18, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Foreshortened concentric water-surface fin-kick & splash meniscus ripple rings at y = 0 (v124).
   */
  _drawSurfaceRipples(ctx, surfaceRipples, visX0, visX1, toScreenX, toScreenY, scale, timeSec) {
    const surfY = toScreenY(0);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Subtle ambient horizon shimmer along open water surface
    if (Array.isArray(surfaceRipples) && surfaceRipples.length > 0) {
      for (let i = 0; i < surfaceRipples.length; i++) {
        const rp = surfaceRipples[i];
        if (!rp || rp.x + rp.radius < visX0 - 2 || rp.x - rp.radius > visX1 + 2) continue;
        const lifeT = Math.max(0, Math.min(1, rp.age / Math.max(0.2, rp.life)));
        const fade = (1 - lifeT) * (1 - lifeT) * (rp.intensity ?? 0.7);
        if (fade <= 0.02) continue;

        const sx = toScreenX(rp.x);
        const rx = Math.max(3, rp.radius * scale);
        const ry = Math.max(1.2, rx * 0.14);

        // Outer bright meniscus ring
        ctx.strokeStyle = `rgba(224, 248, 255, ${(fade * 0.68).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.1, (0.045 * (1 - lifeT * 0.5)) * scale);
        ctx.beginPath();
        ctx.ellipse(sx, surfY, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Inner harmonic secondary ripple crest
        if (rx > 10) {
          ctx.strokeStyle = `rgba(103, 232, 249, ${(fade * 0.42).toFixed(3)})`;
          ctx.lineWidth = Math.max(0.9, 0.03 * scale);
          ctx.beginPath();
          ctx.ellipse(sx, surfY + 1, rx * 0.64, ry * 0.68, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else {
      // Gentle resting meniscus glints when camera sits near calm surface
      const t = this._reducedMotion ? timeSec * 0.25 : timeSec;
      const startX = Math.floor(visX0 / 6) * 6;
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.24)';
      ctx.lineWidth = 1.2;
      for (let wx = startX; wx <= visX1; wx += 6) {
        const sx = toScreenX(wx + Math.sin(t * 0.8 + wx) * 0.6);
        const w = (0.7 + 0.4 * Math.sin(t * 1.9 + wx * 0.7)) * scale;
        ctx.beginPath();
        ctx.moveTo(sx - w, surfY);
        ctx.lineTo(sx + w, surfY);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Beer-Lambert depth spectral color absorption + warm high-CRI torch color restoration cone (v124).
   * Below ~6m reds fade into deep cobalt-indigo, while sweeping your torch vividly brings warm hues back.
   */
  _drawSpectralAbsorption(ctx, cw, ch, diver, toScreenX, toScreenY, scale) {
    if (!diver) return;
    const spec = computeSpectralAbsorption(diver.y);
    if (spec.tintAlpha <= 0.005) return;

    ctx.save();
    // 1. Subtle deep-water cobalt spectral wash (reduces red/warm ambient saturation cleanly at depth)
    ctx.fillStyle = `rgba(4, 32, 74, ${spec.tintAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, cw, ch);

    // 2. High-CRI Torch Spectral Restoration Cone: restores warm natural reds/oranges inside the beam!
    if (diver.torchOn !== false && spec.warmRestoreStrength > 0.08) {
      const strobe = Number.isFinite(diver.strobeMod) ? diver.strobeMod : 1.0;
      const beamAlpha = spec.warmRestoreStrength * (0.11 + (diver.backupTorchActive ? 0.05 : 0)) * (0.25 + 0.75 * strobe);
      if (beamAlpha > 0.01) {
        const ang = Number.isFinite(diver.torchAngle) ? diver.torchAngle : diver.angle || 0;
        const ox = toScreenX(diver.x + Math.cos(ang) * 0.45);
        const oy = toScreenY(diver.y + Math.sin(ang) * 0.45);
        const reachPx = Math.max(40, (diver.backupTorchActive ? 9.5 : 13.0) * scale * (0.35 + 0.65 * strobe));
        const tx = ox + Math.cos(ang) * reachPx * 0.48;
        const ty = oy + Math.sin(ang) * reachPx * 0.48;
        const g = ctx.createRadialGradient(ox, oy, 4, tx, ty, reachPx * 0.62);
        const optic = getTorchOptic(diver?.livery?.torchId);
        const warmRgb = diver.backupTorchActive ? '255, 198, 120' : (optic.warmRgb || '255, 224, 182');
        g.addColorStop(0, `rgba(${warmRgb}, ${(beamAlpha * 1.15).toFixed(3)})`);
        g.addColorStop(0.55, `rgba(${warmRgb}, ${(beamAlpha * 0.48).toFixed(3)})`);
        g.addColorStop(1, `rgba(${warmRgb}, 0)`);
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        const halfCone = diver.backupTorchActive ? 0.27 : 0.34;
        ctx.arc(ox, oy, reachPx, ang - halfCone, ang + halfCone);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Dynamic weather & time-of-day sky atmosphere (v137):
   * Golden Hour molten sunset wash, Night Dive starry vault + glowing crescent moon,
   * Tropical Storm brooding cloud veil + lightning sky flash, and Arctic Snow overcast.
   */
  _drawWeatherSkyAtmosphere(ctx, cw, surfY, timeSec) {
    const w = this._activeWeather;
    if (!w || w.id === 'clear-day' || surfY <= 0) return;
    const skyH = Math.max(10, Math.min(ctx.canvas.height, surfY + 8));
    ctx.save();

    if (w.skyDarken > 0) {
      ctx.fillStyle = `rgba(2, 6, 23, ${Math.min(0.88, w.skyDarken).toFixed(3)})`;
      ctx.fillRect(0, 0, cw, skyH);
    }
    if (w.skyTintRgba) {
      const grad = ctx.createLinearGradient(0, 0, 0, skyH);
      grad.addColorStop(0, w.skyTintRgba);
      grad.addColorStop(1, w.id === 'golden-hour' ? 'rgba(251, 191, 36, 0.42)' : 'rgba(2, 6, 23, 0.08)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, skyH);
    }

    // Starfield + crescent moon for Bioluminescent Night Dive
    if (w.stars) {
      const starCount = Math.min(68, Math.max(28, Math.round(cw / 20)));
      for (let i = 0; i < starCount; i++) {
        const sx = ((Math.sin(i * 127.1 + 3.1) * 43758.5453) % 1 + 1) % 1 * cw;
        const sy = ((Math.sin(i * 269.5 + 1.7) * 43758.5453) % 1 + 1) % 1 * (skyH * 0.86);
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(timeSec * (1.4 + (i % 5) * 0.4) + i * 2.1));
        const r = i % 7 === 0 ? 1.8 : 1.05;
        ctx.fillStyle = i % 9 === 0 ? `rgba(186, 230, 253, ${(tw * 0.92).toFixed(3)})` : `rgba(241, 245, 249, ${(tw * 0.82).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Glowing crescent moon
      const mx = cw * 0.78;
      const my = Math.min(skyH * 0.34, 72);
      const mr = Math.max(11, Math.min(18, skyH * 0.12));
      const halo = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 3.8);
      halo.addColorStop(0, 'rgba(224, 242, 254, 0.36)');
      halo.addColorStop(0.5, 'rgba(125, 211, 252, 0.12)');
      halo.addColorStop(1, 'rgba(125, 211, 252, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(mx, my, mr * 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#07112b';
      ctx.beginPath();
      ctx.arc(mx + mr * 0.42, my - mr * 0.16, mr * 0.88, 0, Math.PI * 2);
      ctx.fill();
    }

    // Golden Hour low horizon sun glow
    if (w.id === 'golden-hour') {
      const sunX = cw * 0.72;
      const sunY = Math.max(18, skyH - 18);
      const g = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, Math.max(120, cw * 0.32));
      g.addColorStop(0, 'rgba(254, 240, 138, 0.62)');
      g.addColorStop(0.35, 'rgba(251, 146, 60, 0.3)');
      g.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, skyH);
    }

    // Storm distant lightning sky illumination
    if (w.lightning) {
      const flash = computeStormLightningFlash(w, timeSec);
      if (flash > 0.02) {
        ctx.fillStyle = `rgba(224, 242, 254, ${(flash * 0.42).toFixed(3)})`;
        ctx.fillRect(0, 0, cw, skyH);
      }
    }

    ctx.restore();
  }

  /**
   * Falling rain streaks (Tropical Storm) or blowing snow flurries (Arctic Snow) above water (v137).
   */
  _drawWeatherPrecipitation(ctx, cw, ch, surfY, timeSec) {
    const w = this._activeWeather;
    if (!w) return;
    const clipH = Math.max(0, Math.min(ch, surfY + 6));
    if (clipH < 8) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, clipH);
    ctx.clip();

    if (w.precip === 'rain') {
      const count = Math.min(84, Math.max(36, Math.round(cw / 16)));
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.42)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const seedX = ((Math.sin(i * 91.7 + 1.3) * 43758.5453) % 1 + 1) % 1;
        const seedY = ((Math.sin(i * 183.1 + 4.9) * 43758.5453) % 1 + 1) % 1;
        const speed = 420 + (i % 5) * 65;
        const y = ((seedY * clipH + timeSec * speed) % (clipH + 40)) - 20;
        const x = ((seedX * cw - timeSec * 125 + y * 0.24) % (cw + 60) + (cw + 60)) % (cw + 60) - 30;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 6.5, y + 18);
      }
      ctx.stroke();

      const flash = computeStormLightningFlash(w, timeSec);
      if (flash > 0.05) {
        ctx.fillStyle = `rgba(224, 242, 254, ${(flash * 0.16).toFixed(3)})`;
        ctx.fillRect(0, 0, cw, clipH);
      }
    } else if (w.precip === 'snow') {
      const count = Math.min(72, Math.max(32, Math.round(cw / 18)));
      ctx.fillStyle = 'rgba(241, 245, 249, 0.78)';
      for (let i = 0; i < count; i++) {
        const seedX = ((Math.sin(i * 63.3 + 2.7) * 43758.5453) % 1 + 1) % 1;
        const seedY = ((Math.sin(i * 149.9 + 5.1) * 43758.5453) % 1 + 1) % 1;
        const speed = 34 + (i % 6) * 11;
        const y = ((seedY * clipH + timeSec * speed) % (clipH + 16)) - 8;
        const drift = Math.sin(timeSec * 1.4 + i * 1.7) * 18 - timeSec * 22;
        const x = ((seedX * cw + drift) % (cw + 20) + (cw + 20)) % (cw + 20) - 10;
        const r = 1.2 + (i % 3) * 0.75;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Draw reactive underwater environmental hazards (v141):
   *   - Cold Thermocline Pockets (shimmering icy-cobalt refraction lenses)
   *   - Overhead Bubble Percolation Ceilings (fragile silt ribbons + cascading sediment streaks)
   *   - Surge-Driven Shifting Wreck Hatches / Tidal Siphon Gates (animated doors + status beacon)
   */
  _drawDynamicHazards(ctx, hazards, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, diver) {
    if (!hazards) return;
    ctx.save();

    // 1. Cold Thermocline Pockets
    const thermos = hazards.thermoclines || [];
    for (let i = 0; i < thermos.length; i++) {
      const th = thermos[i];
      if (th.x + th.rx < visX0 || th.x - th.rx > visX1 || th.y + th.ry < visY0 || th.y - th.ry > visY1) continue;
      const sx = toScreenX(th.x);
      const sy = toScreenY(th.y);
      const rxPx = th.rx * scale;
      const ryPx = th.ry * scale;
      const grad = ctx.createRadialGradient(sx, sy, rxPx * 0.12, sx, sy, Math.max(rxPx, ryPx));
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
      grad.addColorStop(0.55, 'rgba(14, 165, 233, 0.14)');
      grad.addColorStop(1, 'rgba(2, 132, 199, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(sx, sy, rxPx, ryPx, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shimmering cold thermal shear ribbons
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.36)';
      ctx.lineWidth = Math.max(1, 0.055 * scale);
      for (let r = -1; r <= 1; r++) {
        ctx.beginPath();
        const yOff = r * ryPx * 0.38;
        const steps = 10;
        for (let k = 0; k <= steps; k++) {
          const frac = k / steps;
          const px = sx - rxPx * 0.85 + frac * rxPx * 1.7;
          const py = sy + yOff + Math.sin(frac * 6.2 + timeSec * 2.4 + th.phase + r) * (0.14 * scale);
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      if (diver && Math.hypot(diver.x - th.x, diver.y - th.y) < th.rx + 4.5) {
        ctx.font = `800 ${Math.max(9, Math.round(scale * 0.34))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(186, 230, 253, 0.85)';
        ctx.fillText(`❄️ -${th.tempDropC}°C THERMOCLINE`, sx, sy - ryPx * 0.72);
      }
    }

    // 2. Overhead Bubble Percolation Ceilings
    const percs = hazards.percolationZones || [];
    for (let i = 0; i < percs.length; i++) {
      const pz = percs[i];
      if (pz.x + pz.halfWidth < visX0 || pz.x - pz.halfWidth > visX1 || pz.ceilY + 6 < visY0 || pz.ceilY - 1 > visY1) continue;
      const sx0 = toScreenX(pz.x - pz.halfWidth);
      const sx1 = toScreenX(pz.x + pz.halfWidth);
      const sy = toScreenY(pz.ceilY);
      const isRust = Boolean(this.level?.isWreck);
      const activeGlow = Math.min(1, pz.intensity || 0);

      // Delicate clinging ceiling silt crust
      ctx.strokeStyle = isRust
        ? `rgba(217, 119, 6, ${(0.34 + activeGlow * 0.45).toFixed(2)})`
        : `rgba(226, 232, 240, ${(0.28 + activeGlow * 0.48).toFixed(2)})`;
      ctx.lineWidth = Math.max(1.5, (0.09 + activeGlow * 0.08) * scale);
      ctx.setLineDash([Math.max(4, scale * 0.25), Math.max(3, scale * 0.16)]);
      ctx.beginPath();
      ctx.moveTo(sx0, sy);
      ctx.lineTo(sx1, sy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cascading falling sediment streaks
      if (pz.streaks && pz.streaks.length > 0) {
        ctx.strokeStyle = isRust ? 'rgba(245, 158, 11, 0.58)' : 'rgba(203, 213, 225, 0.56)';
        ctx.lineWidth = Math.max(1, 0.05 * scale);
        ctx.beginPath();
        for (let k = 0; k < pz.streaks.length; k++) {
          const st = pz.streaks[k];
          const px = toScreenX(st.x);
          const py = toScreenY(st.y);
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + Math.max(4, scale * 0.35));
        }
        ctx.stroke();
      }
    }

    // 3. Surge-Driven Shifting Wreck Hatches / Tidal Siphon Gates
    const hatches = hazards.shiftingHatches || [];
    for (let i = 0; i < hatches.length; i++) {
      const h = hatches[i];
      if (h.x + h.radius < visX0 || h.x - h.radius > visX1 || h.y + h.radius < visY0 || h.y - h.radius > visY1) continue;
      const sx = toScreenX(h.x);
      const sy = toScreenY(h.y);
      const rPx = h.radius * scale;
      const open = Math.max(0, Math.min(1, h.openness ?? 1));
      const leafSpan = rPx * 0.82 * (1 - open * 0.86);
      const frameW = Math.max(4, 0.24 * scale);

      // Steel bulkhead / karst gate leaves closing from top & bottom
      ctx.fillStyle = h.isWreckHatch ? '#334155' : '#475569';
      ctx.strokeStyle = h.isWreckHatch ? '#94a3b8' : '#7dd3fc';
      ctx.lineWidth = Math.max(1.2, 0.06 * scale);
      ctx.fillRect(sx - frameW * 0.5, sy - rPx, frameW, Math.max(3, leafSpan));
      ctx.strokeRect(sx - frameW * 0.5, sy - rPx, frameW, Math.max(3, leafSpan));
      ctx.fillRect(sx - frameW * 0.5, sy + rPx - Math.max(3, leafSpan), frameW, Math.max(3, leafSpan));
      ctx.strokeRect(sx - frameW * 0.5, sy + rPx - Math.max(3, leafSpan), frameW, Math.max(3, leafSpan));

      // Status timing beacon (Green = wide open window, Amber = closing, Red = slamming/surging)
      const beaconCol = open >= 0.55 ? '#4ade80' : open >= 0.3 ? '#fbbf24' : '#f87171';
      ctx.fillStyle = beaconCol;
      ctx.beginPath();
      ctx.arc(sx, sy - rPx - Math.max(4, scale * 0.22), Math.max(3, scale * 0.14), 0, Math.PI * 2);
      ctx.fill();

      if (open < 0.35) {
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.45)';
        ctx.lineWidth = Math.max(1.2, 0.06 * scale);
        ctx.beginPath();
        ctx.arc(sx, sy, rPx * 0.9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 4. Living Sump Hydrology: Subtle Tidal Siphon / Outflow Current Drift Streaks (v159)
    const tide = hazards.tidalCurrent;
    if (tide?.enabled && tide.strength >= 0.16 && diver) {
      const dir = Math.sign(tide.vx || 1);
      const streakAlpha = Math.min(0.36, tide.strength * 0.48);
      ctx.strokeStyle = `rgba(186, 230, 253, ${streakAlpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(1, 0.045 * scale);
      ctx.lineCap = 'round';
      const spanX = Math.max(14, visX1 - visX0);
      const spanY = Math.max(10, visY1 - visY0);
      for (let i = 0; i < 14; i++) {
        const seed = i * 19.37;
        const speed = 1.6 + tide.strength * 3.8 + (i % 3) * 0.45;
        const rawX = (((seed * 7.3 + timeSec * speed * dir) % spanX) + spanX) % spanX;
        const wx = visX0 + rawX;
        const wy = Math.max(2.5, visY0 + ((seed * 3.1) % spanY));
        const sx = toScreenX(wx);
        const sy = toScreenY(wy);
        const lenPx = (0.75 + tide.strength * 1.4) * scale;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + dir * lenPx, sy + (tide.vy || 0) * lenPx * 0.4);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Render hidden Acoustic Black-Box / Lost Hydro-Probe (with sonar-piercing ping waves)
   * and player-clipped glowing directional Line Cookies (v159).
   */
  _drawBlackBoxAndCookies(ctx, blackBox, lineCookies, diver, toScreenX, toScreenY, scale, timeSec, sonarActive = false) {
    ctx.save();

    if (blackBox && !blackBox.recovered) {
      const bx = toScreenX(blackBox.x);
      const by = toScreenY(blackBox.y);
      const distM = diver ? Math.hypot(diver.x - blackBox.x, diver.y - blackBox.y) : 99;
      const pulse = Math.max(0, Math.min(1, blackBox.pingPulse || 0));

      if (pulse > 0.02 && (distM <= 28 || sonarActive)) {
        const expand = 1 - pulse;
        const ringR = (0.9 + expand * 7.5) * scale;
        ctx.strokeStyle = blackBox.isWreck
          ? `rgba(251, 146, 60, ${(pulse * 0.72).toFixed(3)})`
          : `rgba(250, 204, 21, ${(pulse * 0.72).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, 0.08 * scale);
        ctx.beginPath();
        ctx.arc(bx, by, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (distM <= 18 || sonarActive) {
        const boxW = Math.max(10, 0.56 * scale);
        const boxH = Math.max(7, 0.36 * scale);
        ctx.fillStyle = blackBox.isWreck ? '#f97316' : '#eab308';
        ctx.strokeStyle = '#fff7ed';
        ctx.lineWidth = Math.max(1.2, 0.055 * scale);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx - boxW * 0.5, by - boxH * 0.5, boxW, boxH, Math.max(2, 0.08 * scale));
        } else {
          ctx.rect(bx - boxW * 0.5, by - boxH * 0.5, boxW, boxH);
        }
        ctx.fill();
        ctx.stroke();

        const ledOn = Math.sin(timeSec * 6.5) > 0;
        ctx.fillStyle = ledOn ? '#38bdf8' : '#7dd3fc';
        ctx.beginPath();
        ctx.arc(bx + boxW * 0.28, by - boxH * 0.12, Math.max(2, 0.09 * scale), 0, Math.PI * 2);
        ctx.fill();

        if (distM <= 9.5) {
          ctx.font = `800 ${Math.max(9, Math.round(scale * 0.34))}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fed7aa';
          ctx.fillText(`📟 ${blackBox.isWreck ? 'BLACK BOX' : 'HYDRO-PROBE'}`, bx, by - boxH - Math.max(4, 0.18 * scale));
        }
      }
    }

    if (Array.isArray(lineCookies) && lineCookies.length > 0) {
      for (let i = 0; i < lineCookies.length; i++) {
        const ck = lineCookies[i];
        if (!ck) continue;
        const cx = toScreenX(ck.x);
        const cy = toScreenY(ck.y);
        const rPx = Math.max(6, 0.3 * scale);
        const glow = 0.75 + 0.25 * Math.sin(timeSec * 3.4 + i);

        ctx.fillStyle = `rgba(251, 146, 60, ${(0.24 * glow).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, rPx * 1.9, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ck.exitAngle || 0);
        ctx.fillStyle = '#fb923c';
        ctx.strokeStyle = '#ffedd5';
        ctx.lineWidth = Math.max(1.2, 0.05 * scale);
        ctx.beginPath();
        ctx.moveTo(rPx * 1.25, 0);
        ctx.lineTo(-rPx * 0.85, -rPx * 0.78);
        ctx.lineTo(-rPx * 0.42, 0);
        ctx.lineTo(-rPx * 0.85, rPx * 0.78);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.font = `800 ${Math.max(8, Math.round(scale * 0.28))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 237, 213, 0.92)';
        ctx.fillText(`#${ck.index} 🏠${ck.distToExitM}m`, cx, cy - rPx * 1.45);
      }
    }

    ctx.restore();
  }

  /**
   * Render Emergency Wreck Hull Power Relays & Warm Tungsten-Amber Floodlight Glow (v162).
   */
  _drawPowerRelays(ctx, powerRelays, diver, toScreenX, toScreenY, scale, timeSec) {
    if (!Array.isArray(powerRelays) || powerRelays.length === 0) return;
    ctx.save();
    for (let i = 0; i < powerRelays.length; i++) {
      const rel = powerRelays[i];
      if (!rel) continue;
      const sx = toScreenX(rel.x);
      const sy = toScreenY(rel.y);
      const bw = Math.max(12, 0.72 * scale);
      const bh = Math.max(15, 0.88 * scale);

      if (rel.active) {
        // Warm tungsten-amber volumetric chamber bloom
        const flick = 0.93 + 0.07 * Math.sin(timeSec * 14 + (rel.flickerPhase || 0));
        const glowR = (rel.radius || 17.5) * 0.72 * scale * flick;
        const g = ctx.createRadialGradient(sx, sy, bw * 0.3, sx, sy, glowR);
        g.addColorStop(0, 'rgba(251, 191, 36, 0.32)');
        g.addColorStop(0.45, 'rgba(245, 158, 11, 0.12)');
        g.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Watertight steel breaker box housing
      ctx.fillStyle = rel.active ? '#334155' : '#1e293b';
      ctx.strokeStyle = rel.active ? '#fbbf24' : '#64748b';
      ctx.lineWidth = Math.max(1.4, 0.06 * scale);
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(sx - bw * 0.5, sy - bh * 0.5, bw, bh, Math.max(2, 0.08 * scale));
      } else {
        ctx.rect(sx - bw * 0.5, sy - bh * 0.5, bw, bh);
      }
      ctx.fill();
      ctx.stroke();

      // Status LED (pulsing red standby vs steady emerald-amber active)
      const ledPulse = 0.55 + 0.45 * Math.sin(timeSec * (rel.active ? 2.5 : 5.5));
      ctx.fillStyle = rel.active
        ? `rgba(74, 222, 128, ${(0.75 + 0.25 * ledPulse).toFixed(2)})`
        : `rgba(248, 113, 113, ${ledPulse.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy - bh * 0.22, Math.max(2.5, 0.13 * scale), 0, Math.PI * 2);
      ctx.fill();

      // Heavy breaker throw handle
      ctx.strokeStyle = rel.active ? '#fde047' : '#cbd5e1';
      ctx.lineWidth = Math.max(2, 0.09 * scale);
      ctx.beginPath();
      ctx.moveTo(sx, sy + bh * 0.05);
      ctx.lineTo(sx + bw * 0.34, sy + (rel.active ? -bh * 0.12 : bh * 0.28));
      ctx.stroke();

      const distM = diver ? Math.hypot(diver.x - rel.x, diver.y - rel.y) : 99;
      if (distM <= 11) {
        ctx.font = `800 ${Math.max(9, Math.round(scale * 0.33))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = rel.active ? '#fde68a' : '#fca5a5';
        ctx.fillText(rel.active ? '⚡ FLOODLIGHTS ON' : '⚡ AUX POWER [E]', sx, sy - bh * 0.72);
      }
    }
    ctx.restore();
  }

  /**
   * Render Deployed Delayed Surface Marker Buoy (dSMB): taut finger-spool line, bobbing 1.8m
   * fluorescent-orange inflatable sausage with SOLAS collar & Topside Boat Spotlight beam (v162).
   */
  _drawSurfaceMarkerBuoy(ctx, smb, toScreenX, toScreenY, scale, timeSec) {
    if (!smb?.active) return;
    ctx.save();
    const sx = toScreenX(smb.x);
    const bobY = smb.surfaced ? Math.sin(timeSec * 3.1) * 0.14 : 0;
    const sy = toScreenY((smb.y || 0.3) + bobY);
    const ax = toScreenX(smb.anchorX ?? smb.x);
    const ay = toScreenY(smb.anchorY ?? (smb.y + 6));

    // 1. Subtle Topside Support Boat amber-white searchlight cone once SMB hits surface
    if (smb.surfaced) {
      const topY = toScreenY(0);
      const botY = toScreenY(15);
      const g = ctx.createLinearGradient(0, topY, 0, botY);
      g.addColorStop(0, 'rgba(254, 240, 138, 0.24)');
      g.addColorStop(0.55, 'rgba(254, 240, 138, 0.08)');
      g.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx - 1.8 * scale, topY);
      ctx.lineTo(sx + 1.8 * scale, topY);
      ctx.lineTo(sx + 5.6 * scale, botY);
      ctx.lineTo(sx - 5.6 * scale, botY);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Taut white finger-spool line from diver/anchor up to the SMB
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.72)';
    ctx.lineWidth = Math.max(1.3, 0.055 * scale);
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(sx, sy + 0.55 * scale);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Fluorescent-orange 1.8m inflatable dSMB sausage with SOLAS reflective silver collar
    const wPx = Math.max(7, 0.28 * scale);
    const hPx = Math.max(26, 1.55 * scale);
    ctx.fillStyle = '#f97316';
    ctx.strokeStyle = '#ffedd5';
    ctx.lineWidth = Math.max(1.2, 0.05 * scale);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(sx - wPx * 0.5, sy - hPx * 0.65, wPx, hPx, wPx * 0.45);
    } else {
      ctx.rect(sx - wPx * 0.5, sy - hPx * 0.65, wPx, hPx);
    }
    ctx.fill();
    ctx.stroke();

    // SOLAS reflective silver band near top
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(sx - wPx * 0.48, sy - hPx * 0.44, wPx * 0.96, Math.max(3, hPx * 0.14));

    ctx.font = `800 ${Math.max(9, Math.round(scale * 0.32))}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fed7aa';
    ctx.fillText(smb.surfaced ? '🎈 SMB · TOPSIDE COPY' : '🎈 SMB RISING', sx, sy - hPx * 0.78);

    ctx.restore();
  }

  _drawThermoclineFrostRim(ctx, cw, ch, hazards, timeSec) {
    const cold = Math.max(0, Math.min(1, hazards?.thermoclineColdFactor || 0));
    if (cold <= 0.05) return;
    ctx.save();
    const pulse = 0.85 + 0.15 * Math.sin(timeSec * 4.5);
    const alpha = Math.min(0.42, cold * 0.36 * pulse);
    const rOuter = Math.hypot(cw * 0.5, ch * 0.5);
    const g = ctx.createRadialGradient(cw * 0.5, ch * 0.5, rOuter * 0.46, cw * 0.5, ch * 0.5, rOuter);
    g.addColorStop(0, 'rgba(56, 189, 248, 0)');
    g.addColorStop(1, `rgba(125, 211, 252, ${alpha.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  }

  /**
   * Tactile AAA Mask-Glass Immersion Pass (v161):
   *  - Sparkling water droplets on mask glass near/breaking the surface (<2.0m)
   *  - Plunge-entry surface splash sheen during the first 1.4s
   *  - Cold thermocline mask rim condensation
   *  - Soft foreground exhale bubble parallax during heavy breathing / exhale
   */
  _drawImmersionGlassFx(ctx, cw, ch, diver, diveState, hazards, breathState, timeSec) {
    if (!diver || this._reducedMotion) return;
    const depthM = Math.max(0, Number(diver.y) || 0);
    const hr = Number(diveState?.heartRateBpm) || 72;
    const cold = Math.max(0, Math.min(1, hazards?.thermoclineColdFactor || 0));
    const nearSurface = depthM < 2.0;
    const plungeSplash = timeSec >= 0 && timeSec < 1.4 && depthM < 3.8;
    const showExhaleBubbles = depthM >= 1.5 && (breathState === 'exhale' || hr >= 112);
    if (!nearSurface && !plungeSplash && cold < 0.14 && !showExhaleBubbles) return;

    ctx.save();

    // 1. Sparkling surface mask droplets & gentle sun-glare sheen
    if (nearSurface) {
      const surfFactor = Math.max(0, Math.min(1, (2.0 - depthM) / 1.6));
      for (let i = 0; i < 12; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const edgeFrac = 0.04 + ((i * 37) % 14) * 0.012;
        const x = side > 0 ? cw * edgeFrac : cw * (1 - edgeFrac);
        const slide = ((timeSec * (18 + (i % 4) * 9) + i * 73) % (ch * 0.78)) + ch * 0.08;
        const r = (3.5 + (i % 4) * 2.1) * (cw > 900 ? 1.15 : 0.9);
        ctx.fillStyle = `rgba(224, 242, 254, ${(0.24 * surfFactor).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(x, slide, r * 0.82, r * 1.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.55 * surfFactor).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x - r * 0.24, slide - r * 0.32, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Entry plunge splash curtain
    if (plungeSplash) {
      const splashAlpha = Math.max(0, (1 - timeSec / 1.4) * 0.28);
      const grad = ctx.createLinearGradient(0, 0, 0, ch * 0.42);
      grad.addColorStop(0, `rgba(186, 230, 253, ${splashAlpha.toFixed(3)})`);
      grad.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch * 0.42);
    }

    // 3. Cold thermocline mask rim fog condensation
    if (cold >= 0.14) {
      const fogAlpha = Math.min(0.26, (cold - 0.12) * 0.3);
      const cornerR = Math.min(cw, ch) * 0.34;
      const corners = [[0, 0], [cw, 0], [0, ch], [cw, ch]];
      for (let i = 0; i < corners.length; i++) {
        const [cx, cy] = corners[i];
        const fg = ctx.createRadialGradient(cx, cy, cornerR * 0.1, cx, cy, cornerR);
        fg.addColorStop(0, `rgba(224, 242, 254, ${fogAlpha.toFixed(3)})`);
        fg.addColorStop(1, 'rgba(224, 242, 254, 0)');
        ctx.fillStyle = fg;
        ctx.fillRect(cx - cornerR, cy - cornerR, cornerR * 2, cornerR * 2);
      }
    }

    // 4. Soft out-of-focus foreground exhale bubble parallax near viewport margins
    if (showExhaleBubbles) {
      const intensity = Math.min(1, (breathState === 'exhale' ? 0.55 : 0.25) + Math.max(0, (hr - 95) / 85) * 0.55);
      for (let i = 0; i < 6; i++) {
        const side = i % 2 === 0 ? 0.055 : 0.945;
        const bx = cw * side + Math.sin(timeSec * 3.1 + i * 2.1) * 18;
        const by = ch - (((timeSec * (115 + i * 22) + i * 140) % (ch + 60)) - 30);
        const br = 6 + (i % 3) * 4.5;
        ctx.strokeStyle = `rgba(186, 230, 253, ${(0.18 * intensity).toFixed(3)})`;
        ctx.fillStyle = `rgba(224, 242, 254, ${(0.06 * intensity).toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
