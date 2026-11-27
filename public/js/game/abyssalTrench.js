/**
 * Endless Risk-Reward Mode: "The Abyssal Trench" (v206).
 *
 * A seeded infinite descent where every deeper chamber shifts biome, scales depth
 * and technical gas discipline (EAN32 -> TMX 12/60 -> Hypoxic TMX 9/70 / CCR),
 * and presents an Air-Bell Extraction choice at the end of each chamber:
 *   - EXTRACT & BANK SCORE (lock in cumulative score * multiplier safely)
 *   - DESCEND DEEPER (+0.5x multiplier, next biome & deeper depth tier, higher stakes!)
 */

import {
  generateProceduralLevel,
  normalizeProceduralSeed,
  randomProceduralSeed,
} from '../levels/proceduralLevel.js';

export const TRENCH_BEST_STORAGE_KEY = 'caveDiverTrenchBest_v1';

/**
 * Transfer-Bell Chamber Perks (v264): pick 1 tactical risk-reward upgrade before descending deeper.
 */
export const TRENCH_CHAMBER_PERKS = Object.freeze([
  Object.freeze({
    id: 'risk-multiplier',
    icon: '🔥',
    name: 'High-Stakes Core',
    shortDesc: '+0.25× permanent run multiplier',
    accent: '#fb7185',
    multiplierBonus: 0.25,
  }),
  Object.freeze({
    id: 'reserve-stage',
    icon: '⛽',
    name: 'Reserve Gas Manifold',
    shortDesc: '+40 bar pressurized gas next chamber',
    accent: '#38bdf8',
    gasBonusBar: 40,
  }),
  Object.freeze({
    id: 'dpv-overcharge',
    icon: '⚡',
    name: 'DPV & Sonar Overcharge',
    shortDesc: 'Full DPV battery + 30% faster Sonar',
    accent: '#fde047',
    dpvOvercharge: true,
  }),
]);

export function getTrenchPerkById(perkId) {
  return TRENCH_CHAMBER_PERKS.find((p) => p.id === perkId) || TRENCH_CHAMBER_PERKS[0];
}

export function applyTrenchPerkToRun(runState, perkId) {
  if (!runState) return null;
  const perk = getTrenchPerkById(perkId);
  runState.pendingPerkId = perk.id;
  if (perk.multiplierBonus) {
    runState.multiplierBonus = Math.round(((runState.multiplierBonus || 0) + perk.multiplierBonus) * 100) / 100;
  }
  if (!Array.isArray(runState.perksHistory)) runState.perksHistory = [];
  runState.perksHistory.push({ chamber: (runState.chamber || 1) + 1, perkId: perk.id, name: perk.name });
  return perk;
}

export function applyTrenchPerkToSession(session, runState) {
  if (!session || !runState?.pendingPerkId) return null;
  const perk = getTrenchPerkById(runState.pendingPerkId);
  if (perk.gasBonusBar && session.diveState?.tanks) {
    for (const tank of Object.values(session.diveState.tanks)) {
      if (!tank || !Number.isFinite(tank.bar)) continue;
      const cap = Math.max(240, (tank.maxBar || 200) + perk.gasBonusBar);
      tank.maxBar = cap;
      tank.bar = Math.min(cap, tank.bar + perk.gasBonusBar);
      if (Number.isFinite(tank.litersRemaining) && Number.isFinite(tank.volumeLiters)) {
        tank.litersRemaining = tank.bar * tank.volumeLiters;
      }
    }
  }
  if (perk.dpvOvercharge) {
    if (session.dpv) {
      session.dpv.equipped = true;
      session.dpv.batteryPct = 100;
    }
    if (session.sonar) {
      session.sonar.equipped = true;
      session.sonar.cooldownMult = Math.min(session.sonar.cooldownMult || 1, 0.7);
    }
  }
  session.activeTrenchPerk = perk;
  runState.pendingPerkId = '';
  return perk;
}

export const TRENCH_BIOME_LADDER = Object.freeze([
  Object.freeze({
    chamber: 1,
    name: 'Sunlit Karst Sink',
    tier: 'shallow',
    biome: 'cenote',
    depthBand: '0–38m',
    gasHint: 'EAN32 Travel',
    multiplier: 1.0,
    unlined: false,
    accent: '#38bdf8',
  }),
  Object.freeze({
    chamber: 2,
    name: 'Coral Blue Hole',
    tier: 'deep',
    biome: 'bluehole',
    depthBand: '38–78m',
    gasHint: 'EAN32 → TMX 12/60',
    multiplier: 1.5,
    unlined: false,
    accent: '#22d3ee',
  }),
  Object.freeze({
    chamber: 3,
    name: 'Selenite Crystal Vault',
    tier: 'deep',
    biome: 'crystal',
    depthBand: '50–86m',
    gasHint: 'TMX 12/60 + Deco',
    multiplier: 2.0,
    unlined: false,
    accent: '#a78bfa',
  }),
  Object.freeze({
    chamber: 4,
    name: 'Hydrothermal Rift',
    tier: 'extreme',
    biome: 'volcanic',
    depthBand: '80–142m',
    gasHint: 'Hypoxic TMX 9/70',
    multiplier: 2.5,
    unlined: false,
    accent: '#fb923c',
  }),
  Object.freeze({
    chamber: 5,
    name: 'Hadal Bioluminescent Abyss',
    tier: 'extreme',
    biome: 'biolum',
    depthBand: '110–155m+',
    gasHint: 'Hypoxic TMX 9/70 · Surge',
    multiplier: 3.0,
    unlined: false,
    accent: '#c084fc',
  }),
]);

const DEEP_ROTATION_BIOMES = ['biolum', 'glacier', 'mine', 'volcanic'];

/**
 * Normalize any user-entered trench seed into a clean 6-character uppercase code.
 */
export function normalizeTrenchSeed(raw) {
  const cleaned = normalizeProceduralSeed(raw).slice(0, 6);
  return cleaned.length >= 3 ? cleaned : 'TRN7K4';
}

/**
 * Generate a fresh shareable 6-character trench seed code.
 */
export function generateTrenchSeed() {
  return randomProceduralSeed();
}

/**
 * Return metadata (biome, tier, multiplier, label) for any 1-based trench chamber index.
 */
export function getTrenchChamberMeta(chamberIndex = 1) {
  const idx = Math.max(1, Math.floor(Number(chamberIndex) || 1));
  if (idx <= TRENCH_BIOME_LADDER.length) {
    return { ...TRENCH_BIOME_LADDER[idx - 1], chamber: idx };
  }
  const extra = idx - TRENCH_BIOME_LADDER.length;
  const biome = DEEP_ROTATION_BIOMES[extra % DEEP_ROTATION_BIOMES.length];
  const multiplier = Number((3.0 + extra * 0.5).toFixed(1));
  return {
    chamber: idx,
    name: `Hadal Sector ${idx}`,
    tier: 'extreme',
    biome,
    depthBand: `${120 + extra * 12}–${155 + extra * 12}m`,
    gasHint: idx >= 6 ? 'Hypoxic TMX 9/70 · Unlined' : 'Hypoxic TMX 9/70',
    multiplier,
    unlined: idx >= 6,
    accent: '#e879f9',
  };
}

/**
 * Deterministically generate a fully navigable procedural level for a Trench chamber.
 */
export function createTrenchChamberLevel(seedRaw, chamberIndex = 1) {
  const seed = normalizeTrenchSeed(seedRaw);
  const meta = getTrenchChamberMeta(chamberIndex);
  const chamberSeed = `${seed}C${meta.chamber}`;
  const lvl = generateProceduralLevel({
    seed: chamberSeed,
    tier: meta.tier,
    biome: meta.biome,
    unlined: meta.unlined,
  });
  lvl.isTrench = true;
  lvl.trenchSeed = seed;
  lvl.trenchChamber = meta.chamber;
  lvl.trenchMultiplier = meta.multiplier;
  lvl.trenchMeta = meta;
  lvl.name = `Trench Ch.${meta.chamber} · ${meta.name}`;
  lvl.subtitle = `Seed ${seed} · ${meta.multiplier.toFixed(1)}× Extraction Multiplier · ${meta.gasHint}`;
  lvl.shortTag = `CH ${meta.chamber} · ${meta.multiplier.toFixed(1)}×`;
  return lvl;
}

/**
 * Create a fresh stateful Endless Trench run tracker.
 */
export function createTrenchRunState(seedRaw) {
  const seed = normalizeTrenchSeed(seedRaw);
  return {
    active: true,
    seed,
    chamber: 1,
    chambersCleared: 0,
    bankedScore: 0,
    totalRelics: 0,
    maxDepthM: 0,
    totalTimeSec: 0,
    multiplier: 1.0,
    multiplierBonus: 0,
    pendingPerkId: '',
    perksHistory: [],
    extracted: false,
    lost: false,
    history: [],
  };
}

/**
 * Score a cleared chamber and update the live Trench run state.
 */
export function recordTrenchChamberClear(runState, {
  baseScore = 600,
  relics = 0,
  maxDepthM = 0,
  elapsedSec = 0,
  healthPct = 100,
} = {}) {
  if (!runState) return null;
  const meta = getTrenchChamberMeta(runState.chamber);
  const effectiveMultiplier = Math.round((meta.multiplier + (runState.multiplierBonus || 0)) * 100) / 100;
  const cleanBase = Math.max(250, Math.round(Number(baseScore) || 600));
  const relicBonus = Math.max(0, Math.round(Number(relics) || 0)) * 85;
  const healthBonus = Math.round(Math.max(0, Math.min(100, Number(healthPct) || 0)) * 1.5);
  const chamberPoints = Math.round((cleanBase + relicBonus + healthBonus) * effectiveMultiplier);

  runState.chambersCleared += 1;
  runState.bankedScore += chamberPoints;
  runState.totalRelics += Math.max(0, Math.round(Number(relics) || 0));
  runState.maxDepthM = Math.max(runState.maxDepthM, Number(maxDepthM) || 0);
  runState.totalTimeSec += Math.max(0, Number(elapsedSec) || 0);
  runState.multiplier = effectiveMultiplier;
  runState.history.push({
    chamber: meta.chamber,
    name: meta.name,
    multiplier: effectiveMultiplier,
    chamberPoints,
    relics: Math.max(0, Math.round(Number(relics) || 0)),
    maxDepthM: Number((Number(maxDepthM) || 0).toFixed(1)),
  });

  const nextMeta = getTrenchChamberMeta(runState.chamber + 1);
  return {
    chamberCleared: meta.chamber,
    chamberName: meta.name,
    chamberPoints,
    bankedScore: runState.bankedScore,
    nextChamber: nextMeta.chamber,
    nextName: nextMeta.name,
    nextMultiplier: Math.round((nextMeta.multiplier + (runState.multiplierBonus || 0)) * 100) / 100,
    nextDepthBand: nextMeta.depthBand,
    nextGasHint: nextMeta.gasHint,
  };
}

/**
 * Finalize a Trench run on Extraction (full banked score) or Loss (25% salvage credit).
 */
export function finalizeTrenchRun(runState, { extracted = true } = {}) {
  if (!runState) return null;
  runState.active = false;
  runState.extracted = Boolean(extracted);
  runState.lost = !extracted;
  const finalScore = extracted
    ? Math.round(runState.bankedScore)
    : Math.round(runState.bankedScore * 0.25);
  const summary = {
    seed: runState.seed,
    extracted: runState.extracted,
    chambersCleared: runState.chambersCleared,
    maxDepthM: Number(runState.maxDepthM.toFixed(1)),
    totalRelics: runState.totalRelics,
    finalScore,
    peakMultiplier: runState.multiplier,
  };
  saveTrenchBest(summary);
  return summary;
}

/**
 * Build a shareable URL that directly opens & pre-fills an Abyssal Trench seed.
 */
export function buildTrenchShareUrl(baseUrl, seedRaw) {
  const seed = normalizeTrenchSeed(seedRaw);
  const url = new URL(baseUrl || 'https://cave-diver.vercel.app/');
  url.searchParams.set('trenchSeed', seed);
  return url.toString();
}

/**
 * Parse `?trenchSeed=...` from window.location.search.
 */
export function parseTrenchFromSearch(search) {
  if (!search || typeof search !== 'string') return null;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (!params.has('trenchSeed')) return null;
  return { seed: normalizeTrenchSeed(params.get('trenchSeed')) };
}

export function loadTrenchBest() {
  const empty = { bestChamber: 0, bestDepthM: 0, bestScore: 0, bestSeed: '', runs: 0 };
  try {
    if (typeof localStorage === 'undefined') return empty;
    const raw = localStorage.getItem(TRENCH_BEST_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      bestChamber: Math.max(0, Math.floor(Number(parsed?.bestChamber) || 0)),
      bestDepthM: Math.max(0, Number(parsed?.bestDepthM) || 0),
      bestScore: Math.max(0, Math.floor(Number(parsed?.bestScore) || 0)),
      bestSeed: typeof parsed?.bestSeed === 'string' ? parsed.bestSeed.slice(0, 6) : '',
      runs: Math.max(0, Math.floor(Number(parsed?.runs) || 0)),
    };
  } catch {
    return empty;
  }
}

export function saveTrenchBest(summary) {
  if (!summary) return loadTrenchBest();
  const prev = loadTrenchBest();
  const next = {
    bestChamber: Math.max(prev.bestChamber, summary.chambersCleared || 0),
    bestDepthM: Number(Math.max(prev.bestDepthM, summary.maxDepthM || 0).toFixed(1)),
    bestScore: Math.max(prev.bestScore, summary.finalScore || 0),
    bestSeed: (summary.finalScore || 0) >= prev.bestScore && summary.seed ? summary.seed : prev.bestSeed,
    runs: prev.runs + 1,
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TRENCH_BEST_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {}
  return next;
}
