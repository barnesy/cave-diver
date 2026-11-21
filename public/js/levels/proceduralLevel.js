/**
 * Procedural Endless Expeditions ("Uncharted Sump Generator") — v125.
 * Deterministically generates fully navigable, validateLevel()-compliant twin-basin
 * karst caves, flooded mines, glacial rifts, and volcanic lava tubes from a shareable seed.
 */

import { createLevelTheme } from './themes.js';
import { enrichCaveInteractives } from './caveInteractives.js';

export const PROCEDURAL_TIERS = {
  shallow: {
    id: 'shallow',
    label: 'Shallow Karst (~38m)',
    shortLabel: '38m Karst',
    targetDepthM: 38,
    spineSteps: 5,
    parTimeSec: 230,
    tier: 1,
    difficultyRank: 5,
    ascentSwitchDepthM: 18.0,
    gasOverrides: null,
  },
  deep: {
    id: 'deep',
    label: 'Deep Sump (~78m)',
    shortLabel: '78m Deep',
    targetDepthM: 78,
    spineSteps: 7,
    parTimeSec: 340,
    tier: 3,
    difficultyRank: 13,
    ascentSwitchDepthM: 24.0,
    gasOverrides: {
      TMX1455: {
        name: 'TMX 12/60',
        shortLabel: '12/60',
        role: 'Deep (4–106m)',
        fO2: 0.12,
        fHe: 0.60,
        fN2: 0.28,
        tankVolumeL: 32.0,
        modM: 106.0,
        minM: 4.5,
      },
      EAN32: { tankVolumeL: 13.5 },
    },
  },
  extreme: {
    id: 'extreme',
    label: 'Abyssal Rift (~142m)',
    shortLabel: '142m Abyss',
    targetDepthM: 142,
    spineSteps: 9,
    parTimeSec: 470,
    tier: 4,
    difficultyRank: 19,
    ascentSwitchDepthM: 28.0,
    gasOverrides: {
      TMX1455: {
        name: 'TMX 9/70',
        shortLabel: '9/70',
        role: 'Abyss (7–145m)',
        fO2: 0.09,
        fHe: 0.70,
        fN2: 0.21,
        tankVolumeL: 42.0,
        modM: 145.0,
        minM: 6.5,
      },
      EAN32: { tankVolumeL: 15.5 },
    },
  },
};

export const PROCEDURAL_BIOMES = {
  cenote: {
    id: 'cenote',
    label: 'Yucatán Cenote',
    themeId: 'yucatan-cenote',
    roughness: 0.36,
    namePrefix: 'Cenote',
  },
  mine: {
    id: 'mine',
    label: 'Flooded Mine',
    themeId: 'nordic-mine',
    roughness: 0.22,
    namePrefix: 'Mine Sump',
  },
  glacier: {
    id: 'glacier',
    label: 'Glacial Rift',
    themeId: 'kverkfjoll-glacier',
    roughness: 0.34,
    namePrefix: 'Glacier Vault',
  },
  volcanic: {
    id: 'volcanic',
    label: 'Volcanic Tube',
    themeId: 'atlantida-volcanic',
    roughness: 0.40,
    namePrefix: 'Lava Tube',
  },
  crystal: {
    id: 'crystal',
    label: 'Crystal Sink',
    themeId: 'abaco-crystal',
    roughness: 0.31,
    namePrefix: 'Crystal Sink',
  },
};

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Normalize any user-typed seed string into a clean uppercase alphanumeric seed code.
 * @param {string|number|null|undefined} raw
 * @returns {string}
 */
export function normalizeProceduralSeed(raw) {
  const cleaned = String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
  return cleaned || 'ABYSS7';
}

/**
 * Generate a fresh human-friendly 6-character seed code.
 */
export function randomProceduralSeed() {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)];
  }
  return out;
}

/**
 * Deterministic FNV-1a 32-bit string hash -> Mulberry32 PRNG.
 */
function createSeededRng(seedStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build deterministic level ID for a procedural expedition configuration.
 */
export function buildProceduralLevelId({ seed = 'ABYSS7', tier = 'deep', biome = 'cenote', unlined = false } = {}) {
  const s = normalizeProceduralSeed(seed);
  const t = PROCEDURAL_TIERS[tier] ? tier : 'deep';
  const b = PROCEDURAL_BIOMES[biome] ? biome : 'cenote';
  const u = unlined ? 'u' : 'l';
  return `proc-${t}-${b}-${u}-${s}`;
}

/**
 * Parse a procedural level ID back into its config, or return null for curated campaign levels.
 */
export function parseProceduralLevelId(levelId) {
  if (typeof levelId !== 'string' || !levelId.startsWith('proc-')) return null;
  const parts = levelId.split('-');
  if (parts.length < 5) return null;
  const [, tier, biome, lineFlag, ...seedRest] = parts;
  if (!PROCEDURAL_TIERS[tier] || !PROCEDURAL_BIOMES[biome]) return null;
  if (lineFlag !== 'l' && lineFlag !== 'u') return null;
  const seed = normalizeProceduralSeed(seedRest.join(''));
  return {
    seed,
    tier,
    biome,
    unlined: lineFlag === 'u',
  };
}

/**
 * Build a shareable URL for a procedural Uncharted Sump expedition.
 */
export function buildProceduralShareUrl(baseUrl, config = {}) {
  const seed = normalizeProceduralSeed(config.seed);
  const tier = PROCEDURAL_TIERS[config.tier] ? config.tier : 'deep';
  const biome = PROCEDURAL_BIOMES[config.biome] ? config.biome : 'cenote';
  const url = new URL(baseUrl || 'https://cave-diver.vercel.app/');
  url.searchParams.set('procSeed', seed);
  url.searchParams.set('procTier', tier);
  url.searchParams.set('procBiome', biome);
  if (config.unlined) url.searchParams.set('procUnlined', '1');
  else url.searchParams.delete('procUnlined');
  return url.toString();
}

/**
 * Parse `?procSeed=...` query params from window.location.search.
 */
export function parseProceduralFromSearch(search) {
  if (!search || typeof search !== 'string') return null;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (!params.has('procSeed')) return null;
  const seed = normalizeProceduralSeed(params.get('procSeed'));
  const rawTier = params.get('procTier') || 'deep';
  const rawBiome = params.get('procBiome') || 'cenote';
  const tier = PROCEDURAL_TIERS[rawTier] ? rawTier : 'deep';
  const biome = PROCEDURAL_BIOMES[rawBiome] ? rawBiome : 'cenote';
  const unlined = params.get('procUnlined') === '1' || params.get('procUnlined') === 'true';
  return {
    seed,
    tier,
    biome,
    unlined,
    levelId: buildProceduralLevelId({ seed, tier, biome, unlined }),
  };
}

const COLLECTIBLE_KINDS = [
  { kind: 'crystal', label: 'Aragonite Cluster', pts: 180 },
  { kind: 'fossil', label: 'Karst Fossil', pts: 220 },
  { kind: 'artifact', label: 'Survey Relic', pts: 260 },
  { kind: 'crystal', label: 'Abyssal Geode', pts: 300 },
  { kind: 'artifact', label: 'Lost Dive Reel', pts: 340 },
];

/**
 * Generate a complete, validateLevel()-compliant procedural cave expedition.
 * @param {{ seed?: string, tier?: string, biome?: string, unlined?: boolean }} [opts]
 * @returns {object}
 */
export function generateProceduralLevel(opts = {}) {
  const seed = normalizeProceduralSeed(opts.seed);
  const tierSpec = PROCEDURAL_TIERS[opts.tier] || PROCEDURAL_TIERS.deep;
  const biomeSpec = PROCEDURAL_BIOMES[opts.biome] || PROCEDURAL_BIOMES.cenote;
  const unlined = Boolean(opts.unlined);
  const id = buildProceduralLevelId({ seed, tier: tierSpec.id, biome: biomeSpec.id, unlined });
  const rng = createSeededRng(`${id}|v125`);
  const range = (lo, hi) => lo + rng() * (hi - lo);
  const round1 = (v) => Math.round(v * 10) / 10;

  const targetDepth = Math.round(tierSpec.targetDepthM + range(-3, 4));
  const spineSteps = tierSpec.spineSteps;
  const restrictionIdx = Math.max(2, Math.floor(spineSteps * 0.52));

  // Build main continuous centerline nodes from Entry Sinkhole -> Deep Sump -> Chimney -> Deco Shelf -> Exit Skylight
  const nodes = [];
  const entryX = 12;
  nodes.push({ x: entryX, y: 1.0, r: 7.2, tag: 'entry-top' });
  nodes.push({ x: entryX, y: 9.0, r: 5.8, tag: 'entry-bowl' });

  let curX = entryX;
  let curY = 9.0;
  const descentNodes = [];

  for (let i = 1; i <= spineSteps; i++) {
    const frac = i / spineSteps;
    const dx = range(17, 25);
    curX = round1(curX + dx);
    // Smoothly descend toward targetDepth with gentle natural undulations
    const targetY = 9.0 + (targetDepth - 9.0) * Math.pow(frac, 0.92);
    const jitterY = i === spineSteps ? 0 : range(-3.2, 3.2);
    curY = round1(Math.max(11.5, Math.min(targetDepth, targetY + jitterY)));
    let r = round1(range(3.4, 4.6));
    if (i === restrictionIdx) {
      r = round1(range(2.2, 2.5)); // Tight limestone restriction!
    } else if (i === spineSteps) {
      r = round1(range(4.4, 5.1)); // Wide deep sump turnaround chamber
    }
    const n = { x: curX, y: curY, r, tag: i === restrictionIdx ? 'restriction' : i === spineSteps ? 'sump-start' : 'descent' };
    nodes.push(n);
    descentNodes.push(n);
  }

  // Deep sump turnaround floor gallery
  const sumpMidX = round1(curX + range(14, 20));
  const sumpEndX = round1(sumpMidX + range(14, 20));
  const sumpY = round1(targetDepth);
  const sumpMid = { x: sumpMidX, y: sumpY, r: 4.8, tag: 'sump-turnaround' };
  const sumpEnd = { x: sumpEndX, y: round1(sumpY - range(1.5, 3.5)), r: 4.3, tag: 'sump-end' };
  nodes.push(sumpMid, sumpEnd);

  // Ascent chimney base -> mid chimney -> upper switch -> 6m deco shelf -> exit skylight
  const chimX = round1(sumpEndX + range(12, 16));
  const chimBaseY = round1(Math.max(24, sumpY - range(10, 15)));
  const switchY = round1(tierSpec.ascentSwitchDepthM);
  const chimBase = { x: chimX, y: chimBaseY, r: 3.7, tag: 'chimney-base' };
  const chimMidX = round1(chimX + range(-2.5, 3.5));
  const chimSwitch = { x: chimMidX, y: switchY, r: 3.8, tag: 'ascent-switch' };
  const decoApproachX = round1(chimMidX - range(6, 11));
  const decoShelfA = { x: decoApproachX, y: 12.2, r: 3.8, tag: 'deco-approach' };
  const decoShelfB = { x: round1(decoApproachX - range(3, 6)), y: 6.6, r: 4.1, tag: 'deco-shelf' };
  const exitX = round1(decoShelfB.x + range(16, 20));
  const decoShelfC = { x: exitX, y: 6.4, r: 5.2, tag: 'exit-base' };
  const exitTop = { x: exitX, y: 0.6, r: 5.8, tag: 'exit-top' };
  nodes.push(chimBase, chimSwitch, decoShelfA, decoShelfB, decoShelfC, exitTop);

  // Convert centerline spine to connected segments
  const segments = [];
  let totalRouteM = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    segments.push({
      ax: a.x,
      ay: a.y,
      bx: b.x,
      by: b.y,
      ra: a.r,
      rb: b.r,
    });
    totalRouteM += Math.hypot(b.x - a.x, b.y - a.y);
  }

  // Carve 2-3 branching side alcoves / treasure pockets off safe interior nodes
  const alcoveTips = [];
  const candidateIdxs = [2, Math.max(3, Math.floor(descentNodes.length * 0.7)), nodes.indexOf(sumpMid)];
  for (let k = 0; k < candidateIdxs.length; k++) {
    const host = nodes[candidateIdxs[k]];
    if (!host || host.y < 14) continue;
    const dirY = k % 2 === 0 ? -1 : 1;
    const bx = round1(host.x + range(-8, 10));
    const by = round1(Math.max(10.5, Math.min(targetDepth + 4, host.y + dirY * range(7.5, 11.5))));
    segments.push({
      ax: host.x,
      ay: host.y,
      bx,
      by,
      ra: Math.max(2.4, host.r * 0.78),
      rb: round1(range(2.6, 3.3)),
    });
    alcoveTips.push({ x: bx, y: by, depth: by });
  }

  // Guideline (fixed gold line or unlined reel challenge)
  const guideline = unlined
    ? []
    : nodes.map((n, idx) => ({
        x: n.x,
        y: idx === 0 ? 3.2 : idx === nodes.length - 1 ? 2.0 : n.y,
      }));

  // 6 Technical Checkpoints mapped directly to open centerline nodes
  const cp1Node = descentNodes[0];
  const cp2Node = descentNodes[Math.max(1, Math.floor(descentNodes.length * 0.35))];
  const cp3Node = descentNodes[restrictionIdx - 1] || descentNodes[Math.floor(descentNodes.length * 0.6)];
  const deepGasLabel = tierSpec.gasOverrides?.TMX1455?.name || 'TMX 14/55';

  const checkpoints = [
    {
      id: 'cp1',
      name: 'Cavern Portal',
      x: cp1Node.x,
      y: cp1Node.y,
      radius: 3.8,
      hint: 'Entering uncharted overhead passage. Stay on EAN32 above 30m.',
    },
    {
      id: 'cp2',
      name: 'Halocline Drop',
      x: cp2Node.x,
      y: cp2Node.y,
      radius: 3.8,
      hint: `Switch to ${deepGasLabel} before dropping into the deep sump.`,
    },
    {
      id: 'cp3',
      name: 'The Squeeze',
      x: cp3Node.x,
      y: cp3Node.y,
      radius: 3.2,
      hint: 'Tight passage — trim horizontal and kick gently to avoid silt-out.',
    },
    {
      id: 'cp4',
      name: `Deep Sump (${Math.round(sumpMid.y)}m)`,
      x: sumpMid.x,
      y: sumpMid.y,
      radius: 4.5,
      expectedGas: 'TMX1455',
      hint: 'Turnaround reached! Ascend cleanly up the eastern chimney.',
    },
    {
      id: 'cp5',
      name: `Chimney Switch (${Math.round(chimSwitch.y)}m)`,
      x: chimSwitch.x,
      y: chimSwitch.y,
      radius: 4.2,
      expectedGas: 'EAN32',
      hint: 'Switch back to EAN32 on ascent to prevent hypoxia!',
    },
    {
      id: 'cp6',
      name: 'Deco Shelf (6m)',
      x: round1((decoShelfB.x + decoShelfC.x) * 0.5),
      y: 6.5,
      radius: 5.5,
      expectedGas: 'O2',
      hint: 'Hold 5–6m on O2 100% until DECO STOP clears, then surface!',
    },
  ];

  // Collectibles placed strictly inside carved alcove tips & wide gallery centers
  const collectibles = [];
  alcoveTips.forEach((tip, idx) => {
    const spec = COLLECTIBLE_KINDS[idx % COLLECTIBLE_KINDS.length];
    collectibles.push({
      id: `proc-item-alcove-${idx + 1}`,
      kind: spec.kind,
      name: spec.label,
      x: tip.x,
      y: tip.y,
      points: spec.pts,
    });
  });
  const extraSpots = [sumpEnd, chimBase, decoShelfA];
  extraSpots.forEach((n, idx) => {
    const spec = COLLECTIBLE_KINDS[(idx + 2) % COLLECTIBLE_KINDS.length];
    collectibles.push({
      id: `proc-item-main-${idx + 1}`,
      kind: spec.kind,
      name: spec.label,
      x: n.x,
      y: n.y,
      points: spec.pts,
    });
  });

  // Bounds computed generously around all segments
  let minX = entryX - 20;
  let maxX = exitX + 20;
  let maxY = targetDepth + 12;
  for (const s of segments) {
    minX = Math.min(minX, s.ax - s.ra, s.bx - s.rb);
    maxX = Math.max(maxX, s.ax + s.ra, s.bx + s.rb);
    maxY = Math.max(maxY, s.ay + s.ra, s.by + s.rb);
  }

  const haloclineY = round1(Math.max(16, Math.min(targetDepth * 0.45, 38)));

  // Optional geothermal vents for volcanic biome or extreme depth tier
  const geothermalVents = [];
  if (biomeSpec.id === 'volcanic' || tierSpec.id === 'extreme') {
    geothermalVents.push(
      { x: sumpMid.x, y: sumpMid.y + 3.2, radius: 3.4, lift: 3.8, tempC: 44 },
      { x: chimBase.x, y: chimBase.y + 2.6, radius: 3.0, lift: 4.2, tempC: 39 }
    );
  }

  const level = {
    id,
    name: `${biomeSpec.namePrefix} #${seed}`,
    subtitle: `Uncharted ${Math.round(targetDepth)}m · ${biomeSpec.label}${unlined ? ' · Unlined Reel Maze' : ''}`,
    description: `Procedurally carved ${biomeSpec.label.toLowerCase()} expedition (Seed #${seed}) descending to ${Math.round(targetDepth)}m with branching treasure alcoves, restriction squeeze, and staged decompression ascent.`,
    badge: `∞ ${Math.round(targetDepth)}m #${seed}`,
    difficultyRank: tierSpec.difficultyRank,
    tier: tierSpec.tier,
    category: 'cave',
    isProcedural: true,
    proceduralMeta: {
      seed,
      tier: tierSpec.id,
      biome: biomeSpec.id,
      unlined,
      targetDepthM: Math.round(targetDepth),
    },
    bounds: {
      xMin: Math.floor(minX - 24),
      xMax: Math.ceil(maxX + 28),
      yMin: -6,
      yMax: Math.ceil(maxY + 10),
    },
    roughness: biomeSpec.roughness,
    spawn: { x: entryX, y: 2.2 },
    exitZone: {
      x: exitX,
      y: 1.8,
      radius: 6.8,
      name: `${biomeSpec.namePrefix} Skylight Exit`,
    },
    haloclineY,
    turnaroundCheckpointId: 'cp4',
    ascentSwitchCheckpointId: 'cp5',
    ascentSwitchDepthM: tierSpec.ascentSwitchDepthM,
    lined: !unlined,
    reelMetersPerDiver: unlined ? Math.round(totalRouteM * 1.45) : 0,
    hideWaypointCompass: unlined,
    parTimeSec: tierSpec.parTimeSec,
    theme: createLevelTheme(biomeSpec.themeId),
    ...(tierSpec.gasOverrides ? { gasOverrides: tierSpec.gasOverrides } : {}),
    ...(geothermalVents.length > 0 ? { geothermalVents } : {}),
    openBasins: [
      {
        kind: 'entry',
        xMin: entryX - 6.5,
        xMax: entryX + 6.5,
        rimHalf: 5.5,
        flareAdd: 2.3,
        lipTilt: 0.48,
        floorY: 2.5,
        sunAngle: 1.42,
      },
      {
        kind: 'exit',
        xMin: exitX - 6.2,
        xMax: exitX + 6.2,
        rimHalf: 4.8,
        flareAdd: 2.8,
        lipTilt: -0.45,
        floorY: 2.5,
        sunAngle: 1.7,
      },
    ],
    segments,
    guideline,
    checkpoints,
    collectibles,
    zoneLines: [
      {
        id: 'proc-halocline',
        xMin: Math.floor(cp2Node.x - 10),
        xMax: Math.ceil(cp2Node.x + 14),
        y: haloclineY,
        title: 'HALOCLINE',
        subtitle: `Switch to ${deepGasLabel}`,
      },
      {
        id: 'proc-deco-shelf',
        xMin: Math.floor(decoShelfB.x - 6),
        xMax: Math.ceil(exitX + 6),
        y: 6.5,
        title: '6m DECO SHELF',
        subtitle: 'Hold on O2 100%',
      },
    ],
    depthMarkers: [
      { y: 6, label: '6m O2 DECO', color: '#4ade80' },
      { y: Math.round(haloclineY), label: `${Math.round(haloclineY)}m HALOCLINE`, color: '#38bdf8' },
      { y: Math.round(targetDepth), label: `${Math.round(targetDepth)}m SUMP`, color: '#f59e0b' },
    ],
  };

  enrichCaveInteractives(level);
  return level;
}
