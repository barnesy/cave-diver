/**
 * Diver Gear Workshop, Custom Rig Liveries, Technical Torch Optics & Milestone Patches (v138).
 * Pure data catalog, career unlock evaluation, sanitization, and animated workshop preview renderer.
 */

import {
  drawStyledDiverRig,
  drawDiverLimbSegment,
  drawArticulatedDiverLeg,
  drawDiverArmAndTorch,
} from './artSprites.js';
import {
  applyChromaToPalette,
  isValidGearChromaId,
  getGearChroma,
} from './gearChroma.js';

function _hasTrophyRelic(stats, relicId) {
  const ids = stats?.artifactIds;
  if (!(ids instanceof Set) || !relicId) return false;
  if (ids.has(relicId)) return true;
  const suffix = `:${relicId}`;
  for (const key of ids) {
    if (typeof key === 'string' && key.endsWith(suffix)) return true;
  }
  return false;
}

const ALL_BOSS_TROPHY_IDS = Object.freeze([
  'l1-kraken-crown',
  'thistlegorm-engine-core',
  'scoresby-frost-heart',
  'krubera-empress-diadem',
  'bluehole-solar-prism',
  'strytan-magma-pearl',
  'orda-selenite-prism',
  'u1206-phantom-compass',
  'bimini-orichalcum-astrolabe',
  'ojamo-tungsten-core',
  'yonaguni-dragon-pearl',
  'markgraf-fleet-heart',
]);

function _countClaimedBounties(stats) {
  let n = 0;
  for (const id of ALL_BOSS_TROPHY_IDS) {
    if (_hasTrophyRelic(stats, id)) n++;
  }
  return n;
}

function _mkProg(current, target, unit) {
  const c = Math.max(0, Math.min(target, Math.floor(current || 0)));
  const t = Math.max(1, target);
  return {
    current: c,
    target: t,
    pct: Math.min(1, c / t),
    label: `${c}/${t} ${unit}`,
  };
}

function _bestProg(...candidates) {
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].pct > best.pct) best = candidates[i];
  }
  return best;
}

/**
 * 5-Tier Expedition Gear Prestige & Difficulty Ladder (v211).
 * Visual rarity styling, unlock celebration scale, and sorting order match attainment difficulty.
 */
export const GEAR_TIERS = Object.freeze({
  common: Object.freeze({
    id: 'common',
    rank: 1,
    badge: 'STANDARD',
    title: 'Tier I · Standard Issue',
    icon: '◇',
    color: '#94a3b8',
    glow: 'rgba(148, 163, 184, 0.35)',
    bg: 'rgba(51, 65, 85, 0.42)',
  }),
  uncommon: Object.freeze({
    id: 'uncommon',
    rank: 2,
    badge: 'FIELD TECH',
    title: 'Tier II · Field Tech',
    icon: '●',
    color: '#34d399',
    glow: 'rgba(52, 211, 153, 0.45)',
    bg: 'rgba(6, 78, 59, 0.42)',
  }),
  rare: Object.freeze({
    id: 'rare',
    rank: 3,
    badge: 'VETERAN',
    title: 'Tier III · Veteran Specialist',
    icon: '▲',
    color: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.5)',
    bg: 'rgba(12, 74, 110, 0.46)',
  }),
  epic: Object.freeze({
    id: 'epic',
    rank: 4,
    badge: 'MASTER',
    title: 'Tier IV · Campaign Master',
    icon: '◆',
    color: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.56)',
    bg: 'rgba(88, 28, 135, 0.46)',
  }),
  mythic: Object.freeze({
    id: 'mythic',
    rank: 5,
    badge: 'MYTHIC RELIC',
    title: 'Tier V · Abyssal Relic',
    icon: '✦',
    color: '#facc15',
    glow: 'rgba(250, 204, 21, 0.65)',
    bg: 'rgba(113, 63, 18, 0.48)',
  }),
  legendary: Object.freeze({
    id: 'legendary',
    rank: 6,
    badge: 'LEGENDARY',
    title: 'Tier VI · Ultra-Rare Legendary',
    icon: '🔥',
    color: '#ff9524',
    glow: 'rgba(255, 149, 36, 0.78)',
    bg: 'rgba(154, 52, 18, 0.56)',
  }),
});

/**
 * Salvage Doubloons sell & buyback pricing by gear rarity tier (v230).
 * Common/starter issue gear cannot be sold so divers always retain a baseline kit.
 */
export const GEAR_SELL_VALUES = Object.freeze({
  common: 0,
  uncommon: 60,
  rare: 130,
  epic: 260,
  mythic: 520,
  legendary: 1200,
});

export function getGearSellValue(tierId) {
  return GEAR_SELL_VALUES[tierId] || 0;
}

export function getGearBuybackCost(tierId) {
  const sell = getGearSellValue(tierId);
  return sell > 0 ? Math.round(sell * 1.25) : 0;
}

export function isGearSellable(item) {
  if (!item || !item.id) return false;
  if (getGearSellValue(item.tier) <= 0) return false;
  if (item.ladderRank === 0 && item.tier === 'common') return false;
  return true;
}

export function getGearTierMeta(tierId) {
  return (tierId && GEAR_TIERS[tierId]) || GEAR_TIERS.common;
}

export const SUIT_LIVERIES = Object.freeze([
  {
    id: 'zissou-classic',
    name: 'Zissou Tech',
    tier: 'common',
    ladderRank: 0,
    suitTop: '#1e293b',
    suitMid: '#0f172a',
    suitBot: '#020617',
    accent: '#ef4444',
    trim: '#38bdf8',
    finColor: '#1e293b',
    finTip: '#38bdf8',
    stageBand: '#22c55e',
    unlockHint: 'Standard Expedition Issue',
    isUnlocked: () => true,
  },
  {
    id: 'arctic-cobalt',
    name: 'Arctic Cobalt',
    tier: 'common',
    ladderRank: 1,
    suitTop: '#1e3a5f',
    suitMid: '#0c2444',
    suitBot: '#041226',
    accent: '#22d3ee',
    trim: '#e2e8f0',
    finColor: '#0369a1',
    finTip: '#bae6fd',
    stageBand: '#38bdf8',
    unlockHint: 'Standard Expedition Issue',
    isUnlocked: () => true,
  },
  {
    id: 'expedition-amber',
    name: 'Rescue Amber',
    tier: 'common',
    ladderRank: 2,
    suitTop: '#292524',
    suitMid: '#1c1917',
    suitBot: '#0c0a09',
    accent: '#f97316',
    trim: '#fbbf24',
    finColor: '#44403c',
    finTip: '#fbbf24',
    stageBand: '#f59e0b',
    unlockHint: 'Standard Expedition Issue',
    isUnlocked: () => true,
  },
  {
    id: 'cenote-azure',
    name: 'Cenote Azure',
    tier: 'uncommon',
    ladderRank: 12,
    suitTop: '#0e7490',
    suitMid: '#155e75',
    suitBot: '#083344',
    accent: '#38bdf8',
    trim: '#a5f3fc',
    finColor: '#0c4a6e',
    finTip: '#67e8f9',
    stageBand: '#22d3ee',
    unlockHint: 'Clear your 1st expedition site',
    getProgress: (s) => _mkProg(s.sitesCleared, 1, 'site'),
    isUnlocked: (stats) => stats.sitesCleared >= 1,
  },
  {
    id: 'abyss-emerald',
    name: 'Cenote Emerald',
    tier: 'uncommon',
    ladderRank: 24,
    suitTop: '#064e3b',
    suitMid: '#052e23',
    suitBot: '#021a14',
    accent: '#10b981',
    trim: '#5eead4',
    finColor: '#065f46',
    finTip: '#6ee7b7',
    stageBand: '#34d399',
    unlockHint: 'Clear 3+ expedition sites',
    getProgress: (s) => _mkProg(s.sitesCleared, 3, 'sites'),
    isUnlocked: (stats) => stats.sitesCleared >= 3,
  },
  {
    id: 'wreck-titanium',
    name: 'Wreck Titanium',
    tier: 'rare',
    ladderRank: 42,
    suitTop: '#334155',
    suitMid: '#1e293b',
    suitBot: '#0f172a',
    accent: '#eab308',
    trim: '#cbd5e1',
    finColor: '#475569',
    finTip: '#facc15',
    stageBand: '#eab308',
    unlockHint: 'Clear any shipwreck or 6+ sites',
    getProgress: (s) => _bestProg(_mkProg(s.wreckClears, 1, 'wreck'), _mkProg(s.sitesCleared, 6, 'sites')),
    isUnlocked: (stats) => stats.wreckClears >= 1 || stats.sitesCleared >= 6,
  },
  {
    id: 'karst-jade',
    name: 'Karst Jade Explorer',
    tier: 'epic',
    ladderRank: 70,
    fx: { id: 'karst-caustics', name: 'Cenote Caustics', desc: 'Sunlit turquoise caustic light ribbons ripple across the drysuit.' },
    suitTop: '#0f766e',
    suitMid: '#115e59',
    suitBot: '#042f2e',
    accent: '#f59e0b',
    trim: '#99f6e4',
    finColor: '#134e4a',
    finTip: '#2dd4bf',
    stageBand: '#fbbf24',
    unlockHint: 'Complete Yucatán & Karst Circuit Campaign',
    getProgress: (s) => _mkProg(s.completedCampaigns?.has('cenote-circuit') ? 1 : 0, 1, 'campaign'),
    isUnlocked: (stats) => Boolean(stats.completedCampaigns?.has('cenote-circuit')),
  },
  {
    id: 'krubera-obsidian',
    name: 'Abyssal Sovereign',
    tier: 'epic',
    ladderRank: 76,
    fx: { id: 'abyssal-shimmer', name: 'Biolum Sheen', desc: 'Deep-violet abyssal luminescence breathes along armor seams.' },
    suitTop: '#27272a',
    suitMid: '#18181b',
    suitBot: '#09090b',
    accent: '#a855f7',
    trim: '#e879f9',
    finColor: '#1e1b4b',
    finTip: '#c084fc',
    stageBand: '#a855f7',
    unlockHint: 'Clear 20+ sites or log 8+ species',
    getProgress: (s) => _bestProg(_mkProg(s.sitesCleared, 20, 'sites'), _mkProg(s.speciesLogged, 8, 'species')),
    isUnlocked: (stats) => stats.sitesCleared >= 20 || stats.speciesLogged >= 8,
  },
  {
    id: 'secret-kraken-biolume',
    name: 'Kraken Biolume',
    tier: 'mythic',
    ladderRank: 90,
    fx: { id: 'biolume-pulse', name: 'Bioluminescent Pulse', desc: 'Living cyan-violet circuit veins ripple down torso & drift glowing bio-spores.' },
    secret: true,
    trophyRelicId: 'l1-kraken-crown',
    suitTop: '#0c1c36',
    suitMid: '#071226',
    suitBot: '#020712',
    accent: '#22d3ee',
    trim: '#c084fc',
    finColor: '#0e2948',
    finTip: '#67e8f9',
    stageBand: '#38bdf8',
    unlockHint: '✦ Guardian Relic · Kraken Sanctum',
    isUnlocked: (stats) => _hasTrophyRelic(stats, 'l1-kraken-crown'),
  },
  {
    id: 'secret-volcanic-nautilus',
    name: 'Volcanic Basalt Suit',
    tier: 'mythic',
    ladderRank: 92,
    fx: { id: 'magma-embers', name: 'Molten Magma Veins', desc: 'Incandescent basalt fissures pulse across armor while embers rise.' },
    secret: true,
    trophyRelicId: 'strytan-magma-pearl',
    suitTop: '#292524',
    suitMid: '#1c1917',
    suitBot: '#0c0a09',
    accent: '#f97316',
    trim: '#fde047',
    finColor: '#44403c',
    finTip: '#fb923c',
    stageBand: '#f97316',
    unlockHint: '✦ Guardian Relic · Strýtan Spire',
    isUnlocked: (stats) => _hasTrophyRelic(stats, 'strytan-magma-pearl'),
  },
  {
    id: 'secret-phantom-suit',
    name: 'North Sea Phantom Suit',
    tier: 'mythic',
    ladderRank: 93,
    fx: { id: 'phantom-phase', name: 'Spectral Phase Shimmer', desc: 'Ghostly teal sonar contours phase across the stealth hull.' },
    secret: true,
    trophyRelicId: 'u1206-phantom-compass',
    suitTop: '#1e293b',
    suitMid: '#0f172a',
    suitBot: '#020617',
    accent: '#2dd4bf',
    trim: '#5eead4',
    finColor: '#134e4a',
    finTip: '#99f6e4',
    stageBand: '#14b8a6',
    unlockHint: '✦ Guardian Relic · U-1206 Phantom',
    isUnlocked: (stats) => _hasTrophyRelic(stats, 'u1206-phantom-compass'),
  },
  {
    id: 'secret-orichalcum-suit',
    name: 'Atlantean Orichalcum Suit',
    tier: 'mythic',
    ladderRank: 94,
    fx: { id: 'orichalcum-runes', name: 'Orichalcum Rune Glow', desc: 'Ancient golden-cyan glyphs pulse with harmonic energy along the rig.' },
    secret: true,
    trophyRelicId: 'bimini-orichalcum-astrolabe',
    suitTop: '#164e63',
    suitMid: '#0e3a52',
    suitBot: '#061d2e',
    accent: '#fbbf24',
    trim: '#fde047',
    finColor: '#0c4a6e',
    finTip: '#fde047',
    stageBand: '#f59e0b',
    unlockHint: '✦ Guardian Relic · Bimini Astrolabe',
    isUnlocked: (stats) => _hasTrophyRelic(stats, 'bimini-orichalcum-astrolabe'),
  },
  {
    id: 'secret-ryujin-suit',
    name: 'Ryūjin Jade Dragon Suit',
    tier: 'mythic',
    ladderRank: 95,
    fx: { id: 'dragon-jade', name: 'Dragon Scale Radiance', desc: 'Jade-crimson dragon scales shimmer with drifting golden lantern sparks.' },
    secret: true,
    trophyRelicId: 'yonaguni-dragon-pearl',
    suitTop: '#0f766e',
    suitMid: '#115e59',
    suitBot: '#042f2e',
    accent: '#f43f5e',
    trim: '#fde047',
    finColor: '#134e4a',
    finTip: '#fb7185',
    stageBand: '#2dd4bf',
    unlockHint: '✦ Guardian Relic · Yonaguni Dragon',
    isUnlocked: (stats) => _hasTrophyRelic(stats, 'yonaguni-dragon-pearl'),
  },
  {
    id: 'secret-empress-sovereign',
    name: 'Abyssal Sovereign Gold',
    tier: 'mythic',
    ladderRank: 97,
    fx: { id: 'sovereign-aura', name: 'Sovereign Gilded Aura', desc: 'Golden specular crown-wave sweeps armor with orbiting starlight motes.' },
    secret: true,
    trophyRelicId: 'krubera-empress-diadem',
    suitTop: '#1e1b4b',
    suitMid: '#110e2e',
    suitBot: '#070516',
    accent: '#facc15',
    trim: '#67e8f9',
    finColor: '#1e1b4b',
    finTip: '#fde047',
    stageBand: '#facc15',
    unlockHint: '✦ Guardian Relic · Krubera Empress',
    isUnlocked: (stats) => _hasTrophyRelic(stats, 'krubera-empress-diadem'),
  },
  {
    id: 'bounty-hunter-suit',
    name: 'Master Bounty Hunter Gilded',
    tier: 'mythic',
    ladderRank: 100,
    fx: { id: 'sovereign-aura', name: 'Apex Bounty Aura', desc: 'Radiant gilded-emerald sweep & orbiting apex prestige motes.' },
    suitTop: '#422006',
    suitMid: '#1c1917',
    suitBot: '#09090b',
    accent: '#facc15',
    trim: '#34d399',
    finColor: '#292524',
    finTip: '#fde047',
    stageBand: '#eab308',
    unlockHint: 'Claim 12 Abyssal Bounties or 8+ Hardcore clears',
    getProgress: (s) => _bestProg(_mkProg(_countClaimedBounties(s), 12, 'bounties'), _mkProg(s.hardcoreClears, 8, 'hardcore')),
    isUnlocked: (stats) => _countClaimedBounties(stats) >= 12 || (stats.hardcoreClears || 0) >= 8,
  },
  {
    id: 'world-cartographer-suit',
    name: 'Sunken Cartographer Shell',
    tier: 'rare',
    source: 'world',
    ladderRank: 44,
    fx: { id: 'cartographer-glint', name: 'Brass Compass Sheen', desc: 'Warm expedition-gold shoulder compass & relic survey sheen.' },
    suitTop: '#1e3a5f',
    suitMid: '#0f243d',
    suitBot: '#071321',
    accent: '#fbbf24',
    trim: '#38bdf8',
    finColor: '#1e293b',
    finTip: '#fde047',
    stageBand: '#f59e0b',
    unlockHint: '🗺️ World Cache · SS Thistlegorm cargo locker',
    isUnlocked: (stats) => Boolean(stats.foundGearIds?.has('suit:world-cartographer-suit')),
  },
  {
    id: 'world-hydro-suit',
    name: 'Slipstream Aero Drysuit',
    tier: 'rare',
    source: 'world',
    ladderRank: 48,
    fx: { id: 'hydro-stream', name: 'Laminar Hydro-Weave', desc: 'Silky turquoise boundary-layer shimmer hugs the sleek drysuit.' },
    suitTop: '#115e59',
    suitMid: '#0f3f4a',
    suitBot: '#042029',
    accent: '#2dd4bf',
    trim: '#67e8f9',
    finColor: '#0f172a',
    finTip: '#2dd4bf',
    stageBand: '#14b8a6',
    unlockHint: "🗺️ World Cache · Dan's Cave Abaco karst tunnel",
    isUnlocked: (stats) => Boolean(stats.foundGearIds?.has('suit:world-hydro-suit')),
  },
  {
    id: 'chest-nautilus-suit',
    name: 'Gilded Nautilus Relic Suit',
    tier: 'mythic',
    source: 'chest',
    dropRarity: 'very-rare',
    ladderRank: 98,
    fx: { id: 'sovereign-aura', name: 'Nautilus Gold Filigree', desc: 'Rare sunken brass-gold filigree pulses with abyssal reserve energy.' },
    suitTop: '#1e3a5f',
    suitMid: '#0f2340',
    suitBot: '#050d1c',
    accent: '#fbbf24',
    trim: '#38bdf8',
    finColor: '#1e293b',
    finTip: '#fde047',
    stageBand: '#f59e0b',
    unlockHint: '🧰 Very Rare Random Drop · Sunken Treasure Chests (~3.5%)',
    isUnlocked: (stats) => Boolean(stats.foundGearIds?.has('suit:chest-nautilus-suit')),
  },
  {
    id: 'chest-bulwark-shell',
    name: 'Bulwark Hydro-Plate Suit',
    tier: 'epic',
    source: 'chest',
    dropRarity: 'rare',
    ladderRank: 84,
    fx: { id: 'armor-plate', name: 'Ceramic Hydro-Plate', desc: 'Reinforced cobalt armor weave with integrated rechargeable hydro-shield cells.' },
    suitTop: '#1d4ed8',
    suitMid: '#1e3a8a',
    suitBot: '#0b1634',
    accent: '#60a5fa',
    trim: '#93c5fd',
    finColor: '#1e293b',
    finTip: '#60a5fa',
    stageBand: '#3b82f6',
    unlockHint: '🧰 Rare Chest / 🛡️ Shield Map Vault Drop',
    isUnlocked: (stats) => Boolean(stats.foundGearIds?.has('suit:chest-bulwark-shell')),
  },
  {
    id: 'legendary-aegis-exosuit',
    name: 'Aegis Hydro-Shield Exosuit',
    tier: 'legendary',
    source: 'chest',
    dropRarity: 'legendary',
    ladderRank: 112,
    fx: { id: 'prism-shift', name: 'Aegis Shield Matrix', desc: 'Ultra-rare rechargeable hydro-shield matrix absorbs predator bites & cavern shock.' },
    suitTop: '#1e40af',
    suitMid: '#0f172a',
    suitBot: '#020617',
    accent: '#ff9524',
    trim: '#38bdf8',
    finColor: '#0f172a',
    finTip: '#ff9524',
    stageBand: '#38bdf8',
    unlockHint: '🔥 Ultra-Rare Legendary · Treasure Chests & 🛡️ Shield Maps',
    isUnlocked: (stats) => Boolean(stats.foundGearIds?.has('suit:legendary-aegis-exosuit')),
  },
]);

export const TORCH_OPTICS = Object.freeze([
  {
    id: 'tech-led',
    name: '6500K Tech LED',
    shortLabel: '6500K LED',
    tier: 'common',
    ladderRank: 0,
    swatch: '#bae6fd',
    coreRgb: '224, 242, 254',
    shaftRgb: '186, 230, 253',
    warmRgb: '255, 224, 182',
    rangeMult: 1.0,
    siltPierce: 0.0,
    specText: 'Balanced cold-white cave LED beam',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'warm-halogen',
    name: '3200K Halogen',
    shortLabel: 'Halogen',
    tier: 'common',
    ladderRank: 1,
    swatch: '#fde047',
    coreRgb: '254, 240, 138',
    shaftRgb: '253, 224, 71',
    warmRgb: '255, 206, 128',
    rangeMult: 0.96,
    siltPierce: 0.14,
    specText: 'Warm high-CRI spectrum · +14% silt clarity',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'amber-silt',
    name: 'Amber Silt-Piercer',
    shortLabel: 'Amber Piercer',
    tier: 'uncommon',
    ladderRank: 20,
    swatch: '#fb923c',
    coreRgb: '253, 186, 116',
    shaftRgb: '251, 146, 60',
    warmRgb: '255, 178, 92',
    rangeMult: 1.04,
    siltPierce: 0.28,
    specText: 'Low-backscatter amber · +28% silt penetration',
    unlockHint: 'Clear 2+ expedition sites',
    getProgress: (s) => _mkProg(s.sitesCleared, 2, 'sites'),
    isUnlocked: (stats) => stats.sitesCleared >= 2,
  },
  {
    id: 'emerald-spot',
    name: '5000K Emerald Spot',
    shortLabel: 'Emerald Spot',
    tier: 'rare',
    ladderRank: 44,
    swatch: '#5eead4',
    coreRgb: '167, 243, 208',
    shaftRgb: '94, 234, 212',
    warmRgb: '180, 250, 224',
    rangeMult: 1.08,
    siltPierce: 0.12,
    specText: 'Long-throw pelagic focus · +8% beam reach',
    unlockHint: 'Clear 5+ sites or log 4+ species',
    getProgress: (s) => _bestProg(_mkProg(s.sitesCleared, 5, 'sites'), _mkProg(s.speciesLogged, 4, 'species')),
    isUnlocked: (stats) => stats.sitesCleared >= 5 || stats.speciesLogged >= 4,
  },
  {
    id: 'halocline-uv',
    name: 'UV Biolume Spotter',
    shortLabel: 'UV Biolume',
    tier: 'rare',
    ladderRank: 54,
    fx: { id: 'uv-fluorescence', name: 'UV Fluorescence', desc: 'Dancing violet-cyan excitation flecks shimmer through the torch cone.' },
    swatch: '#c084fc',
    coreRgb: '233, 213, 255',
    shaftRgb: '192, 132, 252',
    warmRgb: '165, 243, 252',
    rangeMult: 1.10,
    siltPierce: 0.18,
    specText: 'Actinic UV-cyan spotter · +10% reach & +18% silt pierce',
    unlockHint: 'Clear 1+ Daily Dive, 6+ species, or 11+ sites',
    getProgress: (s) => _bestProg(_mkProg(s.dailyClears, 1, 'daily'), _mkProg(s.speciesLogged, 6, 'species'), _mkProg(s.sitesCleared, 11, 'sites')),
    isUnlocked: (stats) => (stats.dailyClears || 0) >= 1 || stats.speciesLogged >= 6 || stats.sitesCleared >= 11,
  },
  {
    id: 'aurora-plasma',
    name: '9000K Aurora Plasma',
    shortLabel: 'Aurora 9000K',
    tier: 'epic',
    ladderRank: 74,
    fx: { id: 'aurora-arc', name: 'Aurora Plasma Arc', desc: 'Shimmering polar-cyan plasma ribbons pulse inside the volumetric beam.' },
    swatch: '#38bdf8',
    coreRgb: '207, 250, 254',
    shaftRgb: '56, 189, 248',
    warmRgb: '165, 243, 252',
    rangeMult: 1.12,
    siltPierce: 0.22,
    specText: 'Subglacial aurora arc · +12% reach & +22% silt pierce',
    unlockHint: 'Complete Iceland Geothermal Survey Campaign',
    getProgress: (s) => _mkProg(s.completedCampaigns?.has('iceland-survey') ? 1 : 0, 1, 'campaign'),
    isUnlocked: (stats) => Boolean(stats.completedCampaigns?.has('iceland-survey')),
  },
  {
    id: 'bounty-hunter-torch',
    name: 'Leviathan Hunter Plasma',
    shortLabel: 'Hunter Plasma',
    tier: 'epic',
    ladderRank: 84,
    fx: { id: 'hunter-plasma', name: 'Crimson Core Surge', desc: 'Pulsing crimson-gold plasma corona & harmonic power surge in the beam.' },
    swatch: '#f43f5e',
    coreRgb: '255, 228, 230',
    shaftRgb: '244, 63, 94',
    warmRgb: '253, 186, 116',
    rangeMult: 1.15,
    siltPierce: 0.26,
    specText: 'Deep-stalker crimson-gold plasma · +15% reach & +26% silt pierce',
    unlockHint: 'Claim 6 Abyssal Bounties or 4+ Hardcore clears',
    getProgress: (s) => _bestProg(_mkProg(_countClaimedBounties(s), 6, 'bounties'), _mkProg(s.hardcoreClears, 4, 'hardcore')),
    isUnlocked: (stats) => _countClaimedBounties(stats) >= 6 || (stats.hardcoreClears || 0) >= 4,
  },
  {
    id: 'secret-solar-prism',
    name: 'Solar Reef Prism',
    shortLabel: 'Solar Prism',
    tier: 'mythic',
    ladderRank: 95,
    fx: { id: 'solar-caustic', name: 'Solar Caustic Starburst', desc: 'Radiant golden caustic ripple bands & starburst corona emit from the lens.' },
    secret: true,
    trophyRelicId: 'bluehole-solar-prism',
    swatch: '#fde047',
    coreRgb: '254, 249, 195',
    shaftRgb: '250, 204, 21',
    warmRgb: '253, 224, 71',
    rangeMult: 1.14,
    siltPierce: 0.24,
    specText: 'Radiant caustic reef beam · +14% reach & +24% silt pierce',
    unlockHint: '✦ Guardian Relic · Blue Hole Arch',
    isUnlocked: (stats) => _hasTrophyRelic(stats, 'bluehole-solar-prism'),
  },
  {
    id: 'world-cartographer-torch',
    name: 'Selenite Survey Beacon',
    shortLabel: 'Survey Beam',
    tier: 'epic',
    source: 'world',
    ladderRank: 72,
    fx: { id: 'solar-caustic', name: 'Survey Relic Glint', desc: 'Crisp gold-white survey optics illuminate distant hidden relics.' },
    swatch: '#fde68a',
    coreRgb: '254, 243, 199',
    shaftRgb: '251, 191, 36',
    warmRgb: '253, 224, 71',
    rangeMult: 1.12,
    siltPierce: 0.22,
    specText: 'World-Found Survey Beam · +20% reach & +8m relic glint',
    unlockHint: '🗺️ World Cache · Ox Bel Ha Grand Traverse',
    isUnlocked: (stats) => Boolean(stats.foundGearIds?.has('torch:world-cartographer-torch')),
  },
  {
    id: 'world-rift-flare',
    name: 'Rift Plasma Floodlight',
    shortLabel: 'Rift Plasma',
    tier: 'epic',
    source: 'world',
    ladderRank: 80,
    fx: { id: 'solar-caustic', name: 'Geothermal Rift Flare', desc: 'Incandescent coral-cyan volcanic torch beam cuts frigid rift shadows.' },
    swatch: '#fb923c',
    coreRgb: '255, 237, 213',
    shaftRgb: '249, 115, 22',
    warmRgb: '56, 189, 248',
    rangeMult: 1.15,
    siltPierce: 0.24,
    specText: 'World-Found Rift Floodlight · +24% beam, +16% Spear & +35% Cold',
    unlockHint: '🗺️ World Cache · Grjótagjá Rift volcanic chamber',
    isUnlocked: (stats) => Boolean(stats.foundGearIds?.has('torch:world-rift-flare')),
  },
  {
    id: 'chest-abyssal-lantern',
    name: 'Sunken Sovereign Lantern',
    shortLabel: 'Sovereign Lantern',
    tier: 'mythic',
    source: 'chest',
    dropRarity: 'very-rare',
    ladderRank: 98,
    fx: { id: 'solar-caustic', name: 'Sovereign Treasure Ray', desc: 'Radiant golden caustic beam highlights distant chests & relics.' },
    swatch: '#facc15',
    coreRgb: '254, 249, 195',
    shaftRgb: '250, 204, 21',
    warmRgb: '251, 146, 60',
    rangeMult: 1.18,
    siltPierce: 0.28,
    specText: 'Very Rare Chest Relic · +30% beam & +35% Chest Luck',
    unlockHint: '🧰 Very Rare Random Drop · Sunken Treasure Chests (~3.5%)',
    isUnlocked: (stats) => Boolean(stats.foundGearIds?.has('torch:chest-abyssal-lantern')),
  },
  {
    id: 'chest-amber-cutter',
    name: 'Amber Silt-Cutter Flood',
    shortLabel: 'Silt-Cutter',
    tier: 'epic',
    source: 'chest',
    dropRarity: 'rare',
    ladderRank: 85,
    fx: { id: 'solar-caustic', name: 'Polarized Silt Beam', desc: 'Narrow-wavelength amber optic parts dense cave silt clouds.' },
    swatch: '#fbbf24',
    coreRgb: '254, 243, 199',
    shaftRgb: '245, 158, 11',
    warmRgb: '251, 146, 60',
    rangeMult: 1.12,
    siltPierce: 0.48,
    specText: 'Chest / 🔦 Silt Map Relic · Cuts 48% Silt Haze & +18% Beam Reach',
    unlockHint: '🧰 Rare Chest / 🔦 Silt Lamp Map Vault Drop',
    isUnlocked: (stats) => Boolean(stats.foundGearIds?.has('torch:chest-amber-cutter')),
  },
  {
    id: 'legendary-photon-lance',
    name: 'Helios Silt-Piercer Lance',
    shortLabel: 'Helios Lance',
    tier: 'legendary',
    source: 'chest',
    dropRarity: 'legendary',
    ladderRank: 114,
    fx: { id: 'solar-caustic', name: 'Helios Coherent Beam', desc: 'Ultra-rare coherent gold-amber laser flood slices straight through blinding cave silt.' },
    swatch: '#ff9524',
    coreRgb: '255, 251, 235',
    shaftRgb: '255, 179, 71',
    warmRgb: '251, 146, 60',
    rangeMult: 1.24,
    siltPierce: 0.78,
    specText: '🔥 Legendary · Pierces 78% Cave Silt & +32% Beam Reach',
    unlockHint: '🔥 Ultra-Rare Legendary · Treasure Chests & 🔦 Silt Maps',
    isUnlocked: (stats) => Boolean(stats.foundGearIds?.has('torch:legendary-photon-lance')),
  },
]);

export const MILESTONE_PATCHES = Object.freeze([
  { id: 'none', icon: '—', name: 'Clean Harness', tier: 'common', ladderRank: 0, unlockHint: 'Standard', isUnlocked: () => true },
  { id: 'cave-arrow', icon: '▷', name: 'Line Arrow', tier: 'common', ladderRank: 1, unlockHint: 'Standard', isUnlocked: () => true },
  { id: 'first-descent', icon: '💧', name: 'First Sump', tier: 'uncommon', ladderRank: 10, unlockHint: 'Clear 1st site', getProgress: (s) => _mkProg(s.sitesCleared, 1, 'site'), isUnlocked: (s) => s.sitesCleared >= 1 },
  { id: 'cenote-explorer', icon: '🌴', name: 'Cenote Diver', tier: 'uncommon', ladderRank: 24, unlockHint: '3+ clears', getProgress: (s) => _mkProg(s.sitesCleared, 3, 'sites'), isUnlocked: (s) => s.sitesCleared >= 3 },
  { id: 'wreck-penetrator', icon: '⚓', name: 'Wreck Tech', tier: 'rare', ladderRank: 40, unlockHint: '1+ wreck or 5+ clears', getProgress: (s) => _bestProg(_mkProg(s.wreckClears, 1, 'wreck'), _mkProg(s.sitesCleared, 5, 'sites')), isUnlocked: (s) => s.wreckClears >= 1 || s.sitesCleared >= 5 },
  { id: 'wildlife-biologist', icon: '📷', name: 'Marine Bio', tier: 'rare', ladderRank: 46, unlockHint: '5+ Field Guide species', getProgress: (s) => _mkProg(s.speciesLogged, 5, 'species'), isUnlocked: (s) => s.speciesLogged >= 5 },
  { id: 'abyss-veteran', icon: '🔱', name: 'Abyss Veteran', tier: 'rare', ladderRank: 60, unlockHint: '2+ Hardcore, 3+ Daily, or 16+ clears', getProgress: (s) => _bestProg(_mkProg(s.hardcoreClears, 2, 'hardcore'), _mkProg(s.dailyClears, 3, 'daily'), _mkProg(s.sitesCleared, 16, 'sites')), isUnlocked: (s) => (s.hardcoreClears || 0) >= 2 || (s.dailyClears || 0) >= 3 || s.sitesCleared >= 16 },
  { id: 'camp-karst', icon: '🧭', name: 'Karst Pioneer', tier: 'epic', ladderRank: 70, fx: { id: 'crest-halo', name: 'Mastery Crest Ring', desc: 'Pulsing prestige halo ring around shoulder patch.' }, unlockHint: 'Yucatán & Karst Circuit Campaign', getProgress: (s) => _mkProg(s.completedCampaigns?.has('cenote-circuit') ? 1 : 0, 1, 'campaign'), isUnlocked: (s) => Boolean(s.completedCampaigns?.has('cenote-circuit')) },
  { id: 'camp-coral-wrecks', icon: '🪸', name: 'Coral Wrecker', tier: 'epic', ladderRank: 72, fx: { id: 'crest-halo', name: 'Mastery Crest Ring', desc: 'Pulsing prestige halo ring around shoulder patch.' }, unlockHint: 'Coral & Iron Wrecks Campaign', getProgress: (s) => _mkProg(s.completedCampaigns?.has('coral-iron-wrecks') ? 1 : 0, 1, 'campaign'), isUnlocked: (s) => Boolean(s.completedCampaigns?.has('coral-iron-wrecks')) },
  { id: 'camp-halocline', icon: '🧪', name: 'Halocline Pioneer', tier: 'epic', ladderRank: 74, fx: { id: 'crest-halo', name: 'Mastery Crest Ring', desc: 'Pulsing prestige halo ring around shoulder patch.' }, unlockHint: 'Halocline Wonders Campaign', getProgress: (s) => _mkProg(s.completedCampaigns?.has('halocline-wonders') ? 1 : 0, 1, 'campaign'), isUnlocked: (s) => Boolean(s.completedCampaigns?.has('halocline-wonders')) },
  { id: 'camp-salvage', icon: '🎖️', name: 'Master Salvager', tier: 'epic', ladderRank: 76, fx: { id: 'crest-halo', name: 'Mastery Crest Ring', desc: 'Pulsing prestige halo ring around shoulder patch.' }, unlockHint: 'Maritime Wreck Salvage Campaign', getProgress: (s) => _mkProg(s.completedCampaigns?.has('wreck-salvage') ? 1 : 0, 1, 'campaign'), isUnlocked: (s) => Boolean(s.completedCampaigns?.has('wreck-salvage')) },
  { id: 'camp-polar', icon: '🌋', name: 'Polar Surveyor', tier: 'epic', ladderRank: 78, fx: { id: 'crest-halo', name: 'Mastery Crest Ring', desc: 'Pulsing prestige halo ring around shoulder patch.' }, unlockHint: 'Iceland Geothermal Survey Campaign', getProgress: (s) => _mkProg(s.completedCampaigns?.has('iceland-survey') ? 1 : 0, 1, 'campaign'), isUnlocked: (s) => Boolean(s.completedCampaigns?.has('iceland-survey')) },
  { id: 'camp-abyssal', icon: '🌌', name: 'Abyssal Legend', tier: 'epic', ladderRank: 84, fx: { id: 'crest-halo', name: 'Mastery Crest Ring', desc: 'Pulsing prestige halo ring around shoulder patch.' }, unlockHint: 'Abyssal World Record Campaign', getProgress: (s) => _mkProg(s.completedCampaigns?.has('abyssal-record') ? 1 : 0, 1, 'campaign'), isUnlocked: (s) => Boolean(s.completedCampaigns?.has('abyssal-record')) },
  { id: 'bounty-hunter-master', icon: '📜', name: 'Master Bounty Hunter', tier: 'mythic', ladderRank: 100, fx: { id: 'crest-halo', name: 'Mythic Gilded Crest', desc: 'Radiant golden rotating prestige halo on harness.' }, unlockHint: 'Claim 12 Abyssal Bounties or 8+ Hardcore clears', getProgress: (s) => _bestProg(_mkProg(_countClaimedBounties(s), 12, 'bounties'), _mkProg(s.hardcoreClears, 8, 'hardcore')), isUnlocked: (s) => _countClaimedBounties(s) >= 12 || (s.hardcoreClears || 0) >= 8 },
  { id: 'world-arch-crest', icon: '🏛️', name: 'Bells Archway Crest', tier: 'epic', source: 'world', ladderRank: 74, fx: { id: 'crest-halo', name: 'Archway Deep Crest', desc: 'Deep-blue cobalt halo signaling trimix arch mastery.' }, unlockHint: '🗺️ World Cache · Blue Hole Dahab Archway', isUnlocked: (s) => Boolean(s.foundGearIds?.has('patch:world-arch-crest')) },
  { id: 'world-monolith-seal', icon: '🗿', name: 'Yonaguni Monolith Seal', tier: 'mythic', source: 'world', ladderRank: 96, fx: { id: 'crest-halo', name: 'Monolith Sovereign Aura', desc: 'Ancient sandstone-gold crest radiating guardian resonance.' }, unlockHint: '🗺️ World Cache · Yonaguni Submerged Monument', isUnlocked: (s) => Boolean(s.foundGearIds?.has('patch:world-monolith-seal')) },
  { id: 'chest-corsair-crest', icon: '🏴‍☠️', name: 'Sunken Corsair Crest', tier: 'rare', source: 'chest', dropRarity: 'rare', ladderRank: 64, fx: { id: 'crest-halo', name: "Corsair's Fortune", desc: 'Gilded compass rose halo increasing sunken treasure luck (+20%).' }, unlockHint: '🧰 Rare Random Drop · Sunken Treasure Chests (~12%)', isUnlocked: (s) => Boolean(s.foundGearIds?.has('patch:chest-corsair-crest')) },
  { id: 'legendary-cartographer-compass', icon: '🧭', name: 'Sovereign Treasure Compass', tier: 'legendary', source: 'chest', dropRarity: 'legendary', ladderRank: 115, fx: { id: 'crest-halo', name: 'Sovereign Astrolabe', desc: 'Ultra-rare radiant astrolabe crest amplifying chest luck, doubloons, armor & stealth.' }, unlockHint: '🔥 Ultra-Rare Legendary · Treasure Chests & Vault Maps', isUnlocked: (s) => Boolean(s.foundGearIds?.has('patch:legendary-cartographer-compass')) },
]);

export const HEADGEAR_STYLES = Object.freeze([
  {
    id: 'zissou-cap',
    name: 'Zissou Beanie',
    icon: '🧶',
    tier: 'common',
    ladderRank: 0,
    specText: 'Classic expedition knit cap',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'cave-hood',
    name: 'Neoprene Hood',
    icon: '🤿',
    tier: 'common',
    ladderRank: 1,
    specText: '7mm contoured cave hood + trim stripe',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'cave-helmet',
    name: 'Carbon Cave Helmet',
    icon: '⛑️',
    tier: 'uncommon',
    ladderRank: 28,
    specText: 'Hard-shell impact helmet + twin backup pods',
    unlockHint: 'Bulkhead Engineer cert, 1+ wreck, or 4+ sites',
    getProgress: (s) => _bestProg(_mkProg(s.pressurizedEqualizations, 1, 'bulkhead'), _mkProg(s.wreckClears, 1, 'wreck'), _mkProg(s.sitesCleared, 4, 'sites')),
    isUnlocked: (s) => (s.pressurizedEqualizations || 0) >= 1 || s.wreckClears >= 1 || s.sitesCleared >= 4,
  },
  {
    id: 'exo-mask',
    name: 'Full-Face Exo Mask',
    icon: '🧑‍🚀',
    tier: 'rare',
    ladderRank: 48,
    fx: { id: 'exo-hud', name: 'Live Comms HUD', desc: 'Scanning telemetry lightbar pulses smoothly across the panoramic visor.' },
    specText: 'Comms full-face visor + live interior HUD glow',
    unlockHint: '2+ Rescue/Emergency Drills or 5+ sites',
    getProgress: (s) => _bestProg(_mkProg(s.drillsCompleted, 2, 'drills'), _mkProg(s.sitesCleared, 5, 'sites')),
    isUnlocked: (s) => (s.drillsCompleted || 0) >= 2 || s.sitesCleared >= 5,
  },
  {
    id: 'brass-hardhat',
    name: 'Brass Salvage Helmet',
    icon: '🪖',
    tier: 'epic',
    ladderRank: 76,
    fx: { id: 'brass-glint', name: 'Burnished Bronze Sheen', desc: 'Warm specular sheen sweeps across the riveted bronze dome.' },
    specText: 'Riveted bronze deep-salvage dome + heavy collar',
    unlockHint: 'Complete Maritime Wreck Salvage Campaign',
    getProgress: (s) => _mkProg(s.completedCampaigns?.has('wreck-salvage') ? 1 : 0, 1, 'campaign'),
    isUnlocked: (s) => Boolean(s.completedCampaigns?.has('wreck-salvage')),
  },
  {
    id: 'abyss-halo-helm',
    name: 'Abyssal Halo Helmet',
    icon: '🛸',
    tier: 'epic',
    ladderRank: 84,
    fx: { id: 'halo-telemetry', name: 'Orbital Telemetry Halo', desc: 'Animated holographic cyan ring & twin synchronized strobe beacons.' },
    specText: 'Armored titanium sump dome + animated telemetry halo',
    unlockHint: 'Hardcore clear, 100m+ depth, or 28+ sites',
    getProgress: (s) => _bestProg(_mkProg(s.hardcoreClears, 1, 'Hardcore'), _mkProg(s.deepestM, 100, 'm depth'), _mkProg(s.sitesCleared, 28, 'sites')),
    isUnlocked: (s) => (s.hardcoreClears || 0) >= 1 || (s.deepestM || 0) >= 100 || s.sitesCleared >= 28,
  },
  {
    id: 'secret-dreadnought-helm',
    name: 'WWII Brass Hardhat Mk-IV',
    icon: '⚙️',
    tier: 'mythic',
    ladderRank: 95,
    fx: { id: 'dreadnought-steam', name: 'Furnace Core & Steam Glint', desc: 'Pulsing amber porthole glow & venting crown spark glints.' },
    secret: true,
    trophyRelicId: 'thistlegorm-engine-core',
    specText: 'Riveted armored brass dreadnought dome + amber porthole',
    unlockHint: '✦ Guardian Relic · SS Thistlegorm',
    isUnlocked: (s) => _hasTrophyRelic(s, 'thistlegorm-engine-core'),
  },
  {
    id: 'world-thermal-hood',
    name: 'Nordic Thermal Hood',
    icon: '❄️',
    tier: 'rare',
    source: 'world',
    ladderRank: 52,
    specText: 'Insulated arctic 9mm neoprene hood · 70% Cold Thermocline resist',
    unlockHint: '🗺️ World Cache · Plura Marble Sump overhang',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('headgear:world-thermal-hood')),
  },
  {
    id: 'world-halocline-mask',
    name: 'Angelita Halocline Mask',
    icon: '🌫️',
    tier: 'epic',
    source: 'world',
    ladderRank: 86,
    fx: { id: 'halo-telemetry', name: 'H₂S Mist Filter', desc: 'Emerald-mist positive-pressure seal cuts dense halocline & ceiling silt.' },
    specText: 'World-Found H₂S Halocline Mask · +24% Deco, -24% Silt & +10m Relic',
    unlockHint: '🗺️ World Cache · Cenote Angelita H₂S river ledge',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('headgear:world-halocline-mask')),
  },
  {
    id: 'chest-ghost-hood',
    name: 'Shadow-Weave Acoustic Hood',
    icon: '🥷',
    tier: 'rare',
    source: 'chest',
    dropRarity: 'rare',
    ladderRank: 68,
    fx: { id: 'halo-telemetry', name: 'Acoustic Dampener', desc: 'Matte sound-absorbing neoprene cuts predator detection & fin wake noise.' },
    specText: 'Chest / 🥷 Stealth Map Relic · +28% Stealth & -18% Silt Stir',
    unlockHint: '🧰 Rare Chest / 🥷 Stealth Map Vault Drop',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('headgear:chest-ghost-hood')),
  },
  {
    id: 'legendary-phantom-shroud',
    name: 'Abyssal Phantom Shroud',
    icon: '👻',
    tier: 'legendary',
    source: 'chest',
    dropRarity: 'legendary',
    ladderRank: 113,
    fx: { id: 'halo-telemetry', name: 'Phantom Acoustic Cloak', desc: 'Ultra-rare void-weave shroud cuts predator detection by 56% & calms megafauna.' },
    specText: '🔥 Legendary · +56% Stealth, +25% Cold Resist & -14% Gas Burn',
    unlockHint: '🔥 Ultra-Rare Legendary · Treasure Chests & 🥷 Stealth Maps',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('headgear:legendary-phantom-shroud')),
  },
]);

export const ACCENT_TRIMS = Object.freeze([
  {
    id: 'suit-default',
    name: 'Match Drysuit',
    tier: 'common',
    ladderRank: 0,
    accent: null,
    trim: null,
    finTip: null,
    stageBand: null,
    swatchA: '#38bdf8',
    swatchB: '#ef4444',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'safety-orange',
    name: 'Rescue Orange',
    tier: 'common',
    ladderRank: 1,
    accent: '#f97316',
    trim: '#fdba74',
    finTip: '#fb923c',
    stageBand: '#f97316',
    swatchA: '#f97316',
    swatchB: '#fdba74',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'cavern-yellow',
    name: 'Cave-Line Yellow',
    tier: 'common',
    ladderRank: 2,
    accent: '#eab308',
    trim: '#fde047',
    finTip: '#facc15',
    stageBand: '#eab308',
    swatchA: '#eab308',
    swatchB: '#fde047',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'tech-cyan',
    name: 'Ice Cyan',
    tier: 'common',
    ladderRank: 3,
    accent: '#06b6d4',
    trim: '#67e8f9',
    finTip: '#22d3ee',
    stageBand: '#38bdf8',
    swatchA: '#06b6d4',
    swatchB: '#67e8f9',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'signal-crimson',
    name: 'Crimson Flare',
    tier: 'uncommon',
    ladderRank: 18,
    accent: '#ef4444',
    trim: '#fca5a5',
    finTip: '#f87171',
    stageBand: '#ef4444',
    swatchA: '#ef4444',
    swatchB: '#fca5a5',
    unlockHint: 'Clear 2+ expedition sites',
    getProgress: (s) => _mkProg(s.sitesCleared, 2, 'sites'),
    isUnlocked: (s) => s.sitesCleared >= 2,
  },
  {
    id: 'salvage-gold',
    name: 'Salvage Gold',
    tier: 'rare',
    ladderRank: 40,
    accent: '#f59e0b',
    trim: '#fef08a',
    finTip: '#fde047',
    stageBand: '#f59e0b',
    swatchA: '#d97706',
    swatchB: '#fef08a',
    unlockHint: 'Salvage Master cert, 1+ wreck, or 8+ sites',
    getProgress: (s) => _bestProg(_mkProg(s.cleanSalvageLifts, 1, 'salvage'), _mkProg(s.wreckClears, 1, 'wreck'), _mkProg(s.sitesCleared, 8, 'sites')),
    isUnlocked: (s) => (s.cleanSalvageLifts || 0) >= 1 || s.wreckClears >= 1 || s.sitesCleared >= 8,
  },
  {
    id: 'biolum-violet',
    name: 'Biolum Orchid',
    tier: 'rare',
    ladderRank: 56,
    fx: { id: 'abyssal-shimmer', name: 'Orchid Pulse', desc: 'Soft bioluminescent violet glow breathes along webbing & fin tips.' },
    accent: '#a855f7',
    trim: '#f0abfc',
    finTip: '#c084fc',
    stageBand: '#a855f7',
    swatchA: '#a855f7',
    swatchB: '#f0abfc',
    unlockHint: '4+ Field Guide species or 13+ sites',
    getProgress: (s) => _bestProg(_mkProg(s.speciesLogged, 4, 'species'), _mkProg(s.sitesCleared, 13, 'sites')),
    isUnlocked: (s) => s.speciesLogged >= 4 || s.sitesCleared >= 13,
  },
  {
    id: 'plasma-circuit-trim',
    name: 'Plasma Circuit Trim',
    tier: 'epic',
    ladderRank: 80,
    fx: { id: 'plasma-wave', name: 'Plasma Energy Conduit', desc: 'Bright cyan telemetry pulse travels continuously from harness to fin tips.' },
    accent: '#06b6d4',
    trim: '#67e8f9',
    finTip: '#38bdf8',
    stageBand: '#22d3ee',
    swatchA: '#0ea5e9',
    swatchB: '#a5f3fc',
    unlockHint: 'Hardcore clear, 90m+ depth, or 24+ sites',
    getProgress: (s) => _bestProg(_mkProg(s.hardcoreClears, 1, 'Hardcore'), _mkProg(s.deepestM, 90, 'm depth'), _mkProg(s.sitesCleared, 24, 'sites')),
    isUnlocked: (s) => (s.hardcoreClears || 0) >= 1 || (s.deepestM || 0) >= 90 || s.sitesCleared >= 24,
  },
  {
    id: 'secret-selenite-trim',
    name: 'Selenite Prism Trim',
    tier: 'mythic',
    ladderRank: 94,
    fx: { id: 'selenite-prism', name: 'Prismatic Refraction', desc: 'Iridescent crystal spectrum flows smoothly through webbing & fins.' },
    secret: true,
    trophyRelicId: 'orda-selenite-prism',
    accent: '#e879f9',
    trim: '#bae6fd',
    finTip: '#f0abfc',
    stageBand: '#c084fc',
    swatchA: '#e879f9',
    swatchB: '#bae6fd',
    unlockHint: '✦ Guardian Relic · Orda Crystal Maze',
    isUnlocked: (s) => _hasTrophyRelic(s, 'orda-selenite-prism'),
  },
  {
    id: 'secret-foundry-trim',
    name: 'Foundry Tungsten Trim',
    tier: 'mythic',
    ladderRank: 95,
    fx: { id: 'foundry-sparks', name: 'Superheated Tungsten Sparks', desc: 'Molten tungsten glow pulses along the harness with drifting ember sparks.' },
    secret: true,
    trophyRelicId: 'ojamo-tungsten-core',
    accent: '#f97316',
    trim: '#fbbf24',
    finTip: '#fb923c',
    stageBand: '#ea580c',
    swatchA: '#f97316',
    swatchB: '#fbbf24',
    unlockHint: '✦ Guardian Relic · Ojamo Mine',
    isUnlocked: (s) => _hasTrophyRelic(s, 'ojamo-tungsten-core'),
  },
  {
    id: 'world-hydro-fins',
    name: 'Hydro-Glider Split Fins',
    tier: 'rare',
    source: 'world',
    ladderRank: 40,
    fx: { id: 'hydro-blades', name: 'Silt-Ghost Split Blades', desc: 'Zero floor silt kick below 1.2 m/s & glowing aqua hydro edges.' },
    accent: '#2dd4bf',
    trim: '#67e8f9',
    finTip: '#5eead4',
    stageBand: '#06b6d4',
    swatchA: '#06b6d4',
    swatchB: '#5eead4',
    unlockHint: '🗺️ World Cache · Fontaine de Vaucluse karst shelf',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('trim:world-hydro-fins')),
  },
  {
    id: 'world-reef-thrusters',
    name: "Devil's Wall Jet-Fins",
    tier: 'epic',
    source: 'world',
    ladderRank: 76,
    fx: { id: 'hydro-blades', name: 'Reef-Drop Jet Fins', desc: 'Twin crimson-aqua venturi jet slots accelerate dashes & drop-off sprints.' },
    accent: '#fb7185',
    trim: '#38bdf8',
    finTip: '#f43f5e',
    stageBand: '#e11d48',
    swatchA: '#e11d48',
    swatchB: '#38bdf8',
    unlockHint: "🗺️ World Cache · Bermuda Devil's Wall drop-off",
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('trim:world-reef-thrusters')),
  },
  {
    id: 'chest-manta-fins',
    name: 'Pelagic Manta Hydro-Blades',
    tier: 'epic',
    source: 'chest',
    dropRarity: 'rare',
    ladderRank: 82,
    fx: { id: 'hydro-blades', name: 'Manta Wing Glide', desc: 'Swept cyan-gold hydro-wings slice cleanly through surging karst flow.' },
    accent: '#38bdf8',
    trim: '#fde047',
    finTip: '#38bdf8',
    stageBand: '#0ea5e9',
    swatchA: '#0284c7',
    swatchB: '#fde047',
    unlockHint: '🧰 Rare Random Drop · Sunken Treasure Chests (~7%)',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('trim:chest-manta-fins')),
  },
  {
    id: 'legendary-slipstream-fins',
    name: 'Slipstream Apex Fins',
    tier: 'legendary',
    source: 'chest',
    dropRarity: 'legendary',
    ladderRank: 112,
    fx: { id: 'hydro-blades', name: 'Slipstream Cavitation Wake', desc: 'Ultra-rare active hydrofoil blades deliver peak swim speed, DPV thrust & Silt-Ghost glide.' },
    accent: '#34d399',
    trim: '#ff9524',
    finTip: '#fde047',
    stageBand: '#10b981',
    swatchA: '#10b981',
    swatchB: '#ff9524',
    unlockHint: '🔥 Ultra-Rare Legendary · Treasure Chests & ⚡ Speed Maps',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('trim:legendary-slipstream-fins')),
  },
]);

export const TANK_FINISHES = Object.freeze([
  {
    id: 'al80-silver',
    name: 'Brushed AL80',
    tier: 'common',
    ladderRank: 0,
    top: '#f8fafc',
    mid: '#cbd5e1',
    bot: '#64748b',
    stroke: '#475569',
    ccrShell: '#eab308',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'hivis-yellow',
    name: 'Hi-Vis Steel Yellow',
    tier: 'common',
    ladderRank: 1,
    top: '#fef08a',
    mid: '#eab308',
    bot: '#a16207',
    stroke: '#713f12',
    ccrShell: '#facc15',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'anodized-cobalt',
    name: 'Anodized Cobalt',
    tier: 'uncommon',
    ladderRank: 18,
    top: '#7dd3fc',
    mid: '#0284c7',
    bot: '#0c4a6e',
    stroke: '#082f49',
    ccrShell: '#0ea5e9',
    unlockHint: 'Clear 2+ expedition sites',
    getProgress: (s) => _mkProg(s.sitesCleared, 2, 'sites'),
    isUnlocked: (s) => s.sitesCleared >= 2,
  },
  {
    id: 'carbon-stealth',
    name: 'Carbon Stealth',
    tier: 'uncommon',
    ladderRank: 30,
    top: '#475569',
    mid: '#1e293b',
    bot: '#020617',
    stroke: '#334155',
    ccrShell: '#334155',
    unlockHint: 'Zero-Silt Trim cert or 4+ sites',
    getProgress: (s) => _bestProg(_mkProg(s.zeroSiltClears, 1, 'zero-silt'), _mkProg(s.sitesCleared, 4, 'sites')),
    isUnlocked: (s) => (s.zeroSiltClears || 0) >= 1 || s.sitesCleared >= 4,
  },
  {
    id: 'salvage-brass',
    name: 'Patina Salvage Brass',
    tier: 'rare',
    ladderRank: 46,
    top: '#fde68a',
    mid: '#d97706',
    bot: '#78350f',
    stroke: '#451a03',
    ccrShell: '#d97706',
    unlockHint: 'Bulkhead Engineer cert or 2+ wrecks',
    getProgress: (s) => _bestProg(_mkProg(s.pressurizedEqualizations, 1, 'bulkhead'), _mkProg(s.wreckClears, 2, 'wrecks')),
    isUnlocked: (s) => (s.pressurizedEqualizations || 0) >= 1 || s.wreckClears >= 2,
  },
  {
    id: 'sulfur-emerald-tank',
    name: 'Sulfur Emerald Twinset',
    tier: 'epic',
    ladderRank: 74,
    fx: { id: 'halocline-glow', name: 'Chemocline Shimmer', desc: 'Luminous lime-emerald halocline sheen glides along the twin cylinders.' },
    top: '#ecfccb',
    mid: '#84cc16',
    bot: '#1a2e05',
    stroke: '#bef264',
    ccrShell: '#65a30d',
    unlockHint: 'Complete Halocline Wonders Campaign',
    getProgress: (s) => _mkProg(s.completedCampaigns?.has('halocline-wonders') ? 1 : 0, 1, 'campaign'),
    isUnlocked: (s) => Boolean(s.completedCampaigns?.has('halocline-wonders')),
  },
  {
    id: 'abyssal-titanium',
    name: 'Abyssal Carbon-Ti',
    tier: 'epic',
    ladderRank: 84,
    fx: { id: 'carbon-plasma', name: 'Cryo-Plasma Rings', desc: 'Traveling indigo-violet pressure rings sweep along the carbon-titanium tanks.' },
    top: '#e0e7ff',
    mid: '#6366f1',
    bot: '#1e1b4b',
    stroke: '#c084fc',
    ccrShell: '#818cf8',
    unlockHint: 'Complete Abyssal World Record Campaign',
    getProgress: (s) => _mkProg(s.completedCampaigns?.has('abyssal-record') ? 1 : 0, 1, 'campaign'),
    isUnlocked: (s) => Boolean(s.completedCampaigns?.has('abyssal-record')),
  },
  {
    id: 'secret-dreadnought-brass',
    name: 'Mk-IV Riveted Reactor',
    tier: 'mythic',
    ladderRank: 96,
    fx: { id: 'reactor-core', name: 'Live Reactor Cells', desc: 'Pulsing amber reactor viewports glow warmly along the armored brass cylinder.' },
    secret: true,
    trophyRelicId: 'thistlegorm-engine-core',
    top: '#fef08a',
    mid: '#b45309',
    bot: '#451a03',
    stroke: '#f59e0b',
    ccrShell: '#d97706',
    unlockHint: '✦ Guardian Relic · SS Thistlegorm',
    isUnlocked: (s) => _hasTrophyRelic(s, 'thistlegorm-engine-core'),
  },
  {
    id: 'world-hydro-tank',
    name: 'Lagoa Hydro Twinset',
    tier: 'epic',
    source: 'world',
    ladderRank: 78,
    fx: { id: 'halocline-glow', name: 'Laminar Aqua Flow', desc: 'Crisp cyan laminar streams shimmer across the pressure cylinders.' },
    top: '#cffafe',
    mid: '#06b6d4',
    bot: '#0e7490',
    stroke: '#22d3ee',
    ccrShell: '#0891b2',
    unlockHint: '🗺️ World Cache · Lagoa Misteriosa crystal shaft',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('tank:world-hydro-tank')),
  },
  {
    id: 'world-chimney-tank',
    name: 'Strýtan Geothermal Core',
    tier: 'mythic',
    source: 'world',
    ladderRank: 97,
    fx: { id: 'reactor-core', name: 'Geothermal Vent Core', desc: 'Warm volcanic gold pressure cells pulse with mineral vent heat.' },
    top: '#fef08a',
    mid: '#ea580c',
    bot: '#431407',
    stroke: '#fb923c',
    ccrShell: '#c2410c',
    unlockHint: '🗺️ World Cache · Strýtan Hydrothermal Chimneys',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('tank:world-chimney-tank')),
  },
  {
    id: 'chest-titanium-twin',
    name: 'Hadal Overpressure Twinset',
    tier: 'rare',
    source: 'chest',
    dropRarity: 'rare',
    ladderRank: 66,
    fx: { id: 'titanium-pulse', name: 'Overpressure Manifold', desc: 'High-strength banded titanium twins built for deep reserve dives.' },
    top: '#e2e8f0',
    mid: '#0284c7',
    bot: '#082f49',
    stroke: '#7dd3fc',
    ccrShell: '#0369a1',
    unlockHint: '🧰 Rare Random Drop · Sunken Treasure Chests (~12%)',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('tank:chest-titanium-twin')),
  },
  {
    id: 'legendary-cryo-titan-tank',
    name: 'Cryo-Titan Abyssal Twins',
    tier: 'legendary',
    source: 'chest',
    dropRarity: 'legendary',
    ladderRank: 113,
    fx: { id: 'reactor-core', name: 'Cryo-Heliox Core', desc: 'Ultra-rare insulated titanium twins defy lethal cold, crush depth & narcosis.' },
    top: '#ecfeff',
    mid: '#06b6d4',
    bot: '#083344',
    stroke: '#ff9524',
    ccrShell: '#0891b2',
    unlockHint: '🔥 Ultra-Rare Legendary · Treasure Chests & ❄️ Depth Res Maps',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('tank:legendary-cryo-titan-tank')),
  },
]);

export const VISOR_TINTS = Object.freeze([
  {
    id: 'clear-cyan',
    name: 'Crystal Cyan',
    tier: 'common',
    ladderRank: 0,
    top: '#e0f2fe',
    mid: '#38bdf8',
    bot: '#0369a1',
    frame: '#083344',
    hudGlow: '#38bdf8',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'amber-contrast',
    name: 'High-Contrast Amber',
    tier: 'common',
    ladderRank: 1,
    top: '#fef9c3',
    mid: '#f59e0b',
    bot: '#92400e',
    frame: '#451a03',
    hudGlow: '#fde047',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'reef-mirror',
    name: 'Iridescent Mirror',
    tier: 'uncommon',
    ladderRank: 24,
    top: '#f0abfc',
    mid: '#38bdf8',
    bot: '#4f46e5',
    frame: '#1e1b4b',
    hudGlow: '#e879f9',
    unlockHint: '3+ Field Guide species or 3+ sites',
    getProgress: (s) => _bestProg(_mkProg(s.speciesLogged, 3, 'species'), _mkProg(s.sitesCleared, 3, 'sites')),
    isUnlocked: (s) => s.speciesLogged >= 3 || s.sitesCleared >= 3,
  },
  {
    id: 'thermocline-prism',
    name: 'Thermocline Prism',
    tier: 'rare',
    ladderRank: 38,
    fx: { id: 'thermocline-wave', name: 'Halocline Refraction', desc: 'Shifting ice-blue refraction ribbon glides smoothly across the mask glass.' },
    top: '#ecfeff',
    mid: '#06b6d4',
    bot: '#1d4ed8',
    frame: '#0c4a6e',
    hudGlow: '#67e8f9',
    unlockHint: 'Reach 45m+ depth or clear 4+ sites',
    getProgress: (s) => _bestProg(_mkProg(s.deepestM, 45, 'm depth'), _mkProg(s.sitesCleared, 4, 'sites')),
    isUnlocked: (s) => (s.deepestM || 0) >= 45 || s.sitesCleared >= 4,
  },
  {
    id: 'night-emerald',
    name: 'Night-Ops Emerald',
    tier: 'rare',
    ladderRank: 50,
    top: '#d1fae5',
    mid: '#10b981',
    bot: '#064e3b',
    frame: '#022c22',
    hudGlow: '#34d399',
    unlockHint: '2+ Rescue/Emergency Drills or 9+ sites',
    getProgress: (s) => _bestProg(_mkProg(s.drillsCompleted, 2, 'drills'), _mkProg(s.sitesCleared, 9, 'sites')),
    isUnlocked: (s) => (s.drillsCompleted || 0) >= 2 || s.sitesCleared >= 9,
  },
  {
    id: 'bounty-hunter-visor',
    name: 'Deep Stalker Visor',
    tier: 'rare',
    ladderRank: 58,
    fx: { id: 'stalker-lock', name: 'Predator Reticle Pulse', desc: 'Amber optical lock-on pulse glows inside the tactical mask lens.' },
    top: '#fef08a',
    mid: '#f59e0b',
    bot: '#78350f',
    frame: '#1c1917',
    hudGlow: '#fde047',
    unlockHint: 'Claim 3 Abyssal Bounties or 2+ Hardcore clears',
    getProgress: (s) => _bestProg(_mkProg(_countClaimedBounties(s), 3, 'bounties'), _mkProg(s.hardcoreClears, 2, 'hardcore')),
    isUnlocked: (s) => _countClaimedBounties(s) >= 3 || (s.hardcoreClears || 0) >= 2,
  },
  {
    id: 'pacific-coral-visor',
    name: 'Pacific Coral Visor',
    tier: 'epic',
    ladderRank: 72,
    fx: { id: 'coral-shimmer', name: 'Rose-Gold Glint', desc: 'Iridescent sunset coral sheen sweeps across the lens.' },
    top: '#ffe4e6',
    mid: '#fb7185',
    bot: '#9f1239',
    frame: '#4c0519',
    hudGlow: '#fda4af',
    unlockHint: 'Complete Coral & Iron Wrecks Campaign',
    getProgress: (s) => _mkProg(s.completedCampaigns?.has('coral-iron-wrecks') ? 1 : 0, 1, 'campaign'),
    isUnlocked: (s) => Boolean(s.completedCampaigns?.has('coral-iron-wrecks')),
  },
  {
    id: 'secret-aurora-frost',
    name: 'Aurora Frost Visor',
    tier: 'mythic',
    ladderRank: 94,
    fx: { id: 'aurora-frost', name: 'Polar Aurora Wave', desc: 'Living northern-lights curtain shimmers with crystalline frost sparkles.' },
    secret: true,
    trophyRelicId: 'scoresby-frost-heart',
    top: '#ecfeff',
    mid: '#22d3ee',
    bot: '#0d9488',
    frame: '#083344',
    hudGlow: '#5eead4',
    unlockHint: '✦ Guardian Relic · Scoresby Sund',
    isUnlocked: (s) => _hasTrophyRelic(s, 'scoresby-frost-heart'),
  },
  {
    id: 'secret-markgraf-visor',
    name: 'Scapa Spectral Visor',
    tier: 'mythic',
    ladderRank: 96,
    fx: { id: 'spectral-scan', name: 'Spectral Sonar Sweep', desc: 'Oscillating emerald sonar scanline sweeps across the phantom glass.' },
    secret: true,
    trophyRelicId: 'markgraf-fleet-heart',
    top: '#ecfdf5',
    mid: '#34d399',
    bot: '#064e3b',
    frame: '#022c22',
    hudGlow: '#6ee7b7',
    unlockHint: '✦ Guardian Relic · SMS Markgraf',
    isUnlocked: (s) => _hasTrophyRelic(s, 'markgraf-fleet-heart'),
  },
  {
    id: 'world-cartographer-visor',
    name: 'Cartographer Resonance Lens',
    tier: 'uncommon',
    source: 'world',
    ladderRank: 20,
    fx: { id: 'spectral-scan', name: 'Relic Resonance Lens', desc: 'Golden reticle sweep highlights hidden relics & Sunken Gear Caches.' },
    top: '#fef9c3',
    mid: '#eab308',
    bot: '#713f12',
    frame: '#422006',
    hudGlow: '#fde047',
    unlockHint: '🗺️ World Cache · Cenote El Abismo sunken crate',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('visor:world-cartographer-visor')),
  },
  {
    id: 'world-abyss-lens',
    name: 'Boesmansgat Depth Lens',
    tier: 'rare',
    source: 'world',
    ladderRank: 50,
    fx: { id: 'spectral-scan', name: 'Abyssal Clarity Optic', desc: 'Deep-cobalt polarization sharpens vision & steadies narcosis past 80m.' },
    top: '#dbeafe',
    mid: '#2563eb',
    bot: '#172554',
    frame: '#0f172a',
    hudGlow: '#60a5fa',
    unlockHint: '🗺️ World Cache · Boesmansgat Abyss cavern ledge',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('visor:world-abyss-lens')),
  },
  {
    id: 'world-salvage-visor',
    name: 'Deck-Clearance HUD Visor',
    tier: 'rare',
    source: 'world',
    ladderRank: 54,
    top: '#e0f2fe',
    mid: '#0284c7',
    bot: '#0c4a6e',
    frame: '#0f172a',
    hudGlow: '#38bdf8',
    unlockHint: '🗺️ World Cache · MS Zenobia vehicle deck',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('visor:world-salvage-visor')),
  },
  {
    id: 'chest-harpoon-visor',
    name: 'Leviathan Sight-Core Visor',
    tier: 'epic',
    source: 'chest',
    dropRarity: 'rare',
    ladderRank: 84,
    fx: { id: 'stalker-lock', name: 'Weakpoint Optical Core', desc: 'Crimson-amber combat reticle tracks boss weakpoints & firing cadence.' },
    top: '#fecdd3',
    mid: '#f43f5e',
    bot: '#4c0519',
    frame: '#0f172a',
    hudGlow: '#fb7185',
    unlockHint: '🧰 Rare Random Drop · Sunken Treasure Chests (~7%)',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('visor:chest-harpoon-visor')),
  },
  {
    id: 'chest-echo-array',
    name: 'Echo-Array Wide Sonar Visor',
    tier: 'epic',
    source: 'chest',
    dropRarity: 'rare',
    ladderRank: 86,
    fx: { id: 'stalker-lock', name: 'Passive Echo Sweep', desc: 'Continuous wide-band sonar visor passively pings chests & relics on your scope.' },
    top: '#bae6fd',
    mid: '#0ea5e9',
    bot: '#082f49',
    frame: '#0f172a',
    hudGlow: '#38bdf8',
    unlockHint: '🧰 Rare Chest / 📡 Sonar Map Vault Drop',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('visor:chest-echo-array')),
  },
  {
    id: 'legendary-omniscanner-visor',
    name: 'Omniscanner Pulse Visor',
    tier: 'legendary',
    source: 'chest',
    dropRarity: 'legendary',
    ladderRank: 114,
    fx: { id: 'stalker-lock', name: 'Omniscanner Continuous Radar', desc: 'Ultra-rare always-on wide-range sonar tracks Chests, Maps, Relics & Predators live.' },
    top: '#fef08a',
    mid: '#38bdf8',
    bot: '#0f172a',
    frame: '#ff9524',
    hudGlow: '#ff9524',
    unlockHint: '🔥 Ultra-Rare Legendary · Treasure Chests & 📡 Sonar Maps',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('visor:legendary-omniscanner-visor')),
  },
]);

export const SCOOTER_MODELS = Object.freeze([
  {
    id: 'none',
    name: 'No Scooter',
    icon: '—',
    tier: 'common',
    ladderRank: 0,
    hull: '#334155',
    shroud: '#0f172a',
    accent: '#64748b',
    unlockHint: 'Standard Free-Swim (no scooter equipped)',
    isUnlocked: () => true,
  },
  {
    id: 'expedition-dpv',
    name: 'Expedition Mk-I DPV',
    icon: '🛴',
    tier: 'uncommon',
    ladderRank: 22,
    hull: '#facc15',
    shroud: '#1e293b',
    accent: '#38bdf8',
    unlockHint: 'Clear 3+ expedition sites',
    getProgress: (s) => _mkProg(s.sitesCleared, 3, 'sites'),
    isUnlocked: (s) => s.sitesCleared >= 3,
  },
  {
    id: 'salvage-tug-dpv',
    name: 'Salvage Tug DPV',
    icon: '⚓',
    tier: 'rare',
    source: 'chest',
    dropRarity: 'rare',
    ladderRank: 46,
    hull: '#f59e0b',
    shroud: '#292524',
    accent: '#fef08a',
    unlockHint: '🧰 Rare Chest Drop · Deep Salvage Set',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('scooter:salvage-tug-dpv')),
  },
  {
    id: 'hydro-glider-dpv',
    name: 'Hydro-Glider Torpedo',
    icon: '🌊',
    tier: 'epic',
    source: 'chest',
    dropRarity: 'rare',
    ladderRank: 76,
    fx: { id: 'hydro-blades', name: 'Laminar Hydro-Drive', desc: 'Turquoise laminar impeller wake minimizes silt kick at cruise speed.' },
    hull: '#0d9488',
    shroud: '#042f2e',
    accent: '#5eead4',
    unlockHint: '🧰 Epic Chest / ⚡ Speed Map Vault · Hydro-Glider Set',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('scooter:hydro-glider-dpv')),
  },
  {
    id: 'phantom-whisper-dpv',
    name: 'Phantom Whisper Drive',
    icon: '🥷',
    tier: 'epic',
    source: 'chest',
    dropRarity: 'rare',
    ladderRank: 84,
    fx: { id: 'phantom-phase', name: 'Silent Magneto-Drive', desc: 'Shrouded acoustic-stealth impeller cuts predator detection.' },
    hull: '#18181b',
    shroud: '#09090b',
    accent: '#c084fc',
    unlockHint: '🧰 Epic Chest / 🥷 Stealth Map Vault · Voidwalker Set',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('scooter:phantom-whisper-dpv')),
  },
  {
    id: 'legendary-valkyrie-dpv',
    name: 'Valkyrie Cavitation DPV',
    icon: '🔥',
    tier: 'legendary',
    source: 'chest',
    dropRarity: 'legendary',
    ladderRank: 115,
    fx: { id: 'prism-shift', name: 'Supercavitation Surge', desc: 'Ultra-rare hyper-scooter generating a low-drag cavitation plasma cone.' },
    hull: '#ff9524',
    shroud: '#0f172a',
    accent: '#38bdf8',
    unlockHint: '🔥 Ultra-Rare Legendary · Treasure Chests & ⚡ Speed Maps',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('scooter:legendary-valkyrie-dpv')),
  },
]);

export const HARPOON_MODELS = Object.freeze([
  {
    id: 'pneumatic-mk1',
    name: 'Mk-I Pneumatic Spear',
    icon: '🔱',
    tier: 'common',
    ladderRank: 0,
    barrel: '#cbd5e1',
    rail: '#38bdf8',
    band: '#f59e0b',
    tip: '#bae6fd',
    unlockHint: 'Standard Expedition Issue',
    isUnlocked: () => true,
  },
  {
    id: 'reef-carbine',
    name: 'Reef Carbon Carbine',
    icon: '🎯',
    tier: 'uncommon',
    ladderRank: 20,
    barrel: '#334155',
    rail: '#34d399',
    band: '#fbbf24',
    tip: '#6ee7b7',
    unlockHint: 'Clear 2+ expedition sites',
    getProgress: (s) => _mkProg(s.sitesCleared, 2, 'sites'),
    isUnlocked: (s) => s.sitesCleared >= 2,
  },
  {
    id: 'salvage-rivet-lance',
    name: 'Salvage Rivet Harpoon',
    icon: '⚓',
    tier: 'rare',
    source: 'chest',
    dropRarity: 'rare',
    ladderRank: 48,
    barrel: '#b45309',
    rail: '#fbbf24',
    band: '#f97316',
    tip: '#fef08a',
    unlockHint: '🧰 Rare Chest Drop · Deep Salvage Set',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('harpoon:salvage-rivet-lance')),
  },
  {
    id: 'kraken-biolume-spear',
    name: 'Biolume Spine Launcher',
    icon: '🐙',
    tier: 'epic',
    source: 'chest',
    dropRarity: 'rare',
    ladderRank: 78,
    fx: { id: 'biolume-pulse', name: 'Bio-Tether Rail', desc: 'Silent bioluminescent rail discharges high-velocity cyan bolts.' },
    barrel: '#1e1b4b',
    rail: '#22d3ee',
    band: '#c084fc',
    tip: '#67e8f9',
    unlockHint: '🧰 Epic Chest / 🥷 Stealth Map Vault · Biolume Set',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('harpoon:kraken-biolume-spear')),
  },
  {
    id: 'apex-hunter-railgun',
    name: 'Apex Leviathan Rail-Spear',
    icon: '👑',
    tier: 'epic',
    source: 'chest',
    dropRarity: 'rare',
    ladderRank: 86,
    fx: { id: 'hunter-plasma', name: 'Predator Twin-Rail', desc: 'Crimson-gold twin pneumatic rails built for Leviathan boss hunts.' },
    barrel: '#27272a',
    rail: '#f43f5e',
    band: '#facc15',
    tip: '#fda4af',
    unlockHint: '🧰 Epic Chest / 🛡️ Shield Map Vault · Apex Hunter Set',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('harpoon:apex-hunter-railgun')),
  },
  {
    id: 'legendary-poseidon-trident',
    name: 'Poseidon Arc-Rail Harpoon',
    icon: '🔥',
    tier: 'legendary',
    source: 'chest',
    dropRarity: 'legendary',
    ladderRank: 116,
    fx: { id: 'sovereign-aura', name: 'Poseidon Arc-Tip', desc: 'Ultra-rare electromagnetic trident harpoon supercharges every 3rd bolt into a Golden Hyper-Tip.' },
    barrel: '#1e3a8a',
    rail: '#ff9524',
    band: '#fde047',
    tip: '#ff9524',
    unlockHint: '🔥 Ultra-Rare Legendary · Treasure Chests & 🛡️ Shield Maps',
    isUnlocked: (s) => Boolean(s.foundGearIds?.has('harpoon:legendary-poseidon-trident')),
  },
]);

export const OUTFITTER_PRESETS = Object.freeze([
  {
    id: 'zissou-expedition',
    name: 'Zissou Classic',
    icon: '🧶',
    livery: { suitId: 'zissou-classic', torchId: 'tech-led', patchId: 'cave-arrow', headgearId: 'zissou-cap', trimId: 'suit-default', tankId: 'al80-silver', visorId: 'clear-cyan' },
  },
  {
    id: 'arctic-explorer',
    name: 'Arctic Tech',
    icon: '❄️',
    livery: { suitId: 'arctic-cobalt', torchId: 'tech-led', patchId: 'cave-arrow', headgearId: 'cave-hood', trimId: 'tech-cyan', tankId: 'al80-silver', visorId: 'clear-cyan' },
  },
  {
    id: 'rescue-diver',
    name: 'Rescue Amber',
    icon: '🛟',
    livery: { suitId: 'expedition-amber', torchId: 'warm-halogen', patchId: 'cave-arrow', headgearId: 'cave-hood', trimId: 'safety-orange', tankId: 'hivis-yellow', visorId: 'amber-contrast' },
  },
  {
    id: 'deep-salvage',
    name: 'Wreck Salvage',
    icon: '⚓',
    livery: { suitId: 'wreck-titanium', torchId: 'amber-silt', patchId: 'wreck-penetrator', headgearId: 'cave-helmet', trimId: 'salvage-gold', tankId: 'salvage-brass', visorId: 'amber-contrast' },
  },
  {
    id: 'stealth-sump',
    name: 'Carbon Sump',
    icon: '🔦',
    livery: { suitId: 'abyss-emerald', torchId: 'emerald-spot', patchId: 'cenote-explorer', headgearId: 'exo-mask', trimId: 'cavern-yellow', tankId: 'carbon-stealth', visorId: 'night-emerald' },
  },
  {
    id: 'abyss-sovereign',
    name: 'Abyssal Bio',
    icon: '🔱',
    livery: { suitId: 'krubera-obsidian', torchId: 'emerald-spot', patchId: 'abyss-veteran', headgearId: 'exo-mask', trimId: 'biolum-violet', tankId: 'carbon-stealth', visorId: 'reef-mirror' },
  },
]);

export const DEFAULT_RIG_LIVERY = Object.freeze({
  suitId: 'zissou-classic',
  torchId: 'tech-led',
  patchId: 'cave-arrow',
});

const DEFAULT_MODULAR_IDS = Object.freeze({
  headgearId: 'zissou-cap',
  trimId: 'suit-default',
  tankId: 'al80-silver',
  visorId: 'clear-cyan',
  scooterId: 'none',
  harpoonId: 'pneumatic-mk1',
  dyeId: 'none',
});

const SUIT_BY_ID = new Map(SUIT_LIVERIES.map((s) => [s.id, s]));
const TORCH_BY_ID = new Map(TORCH_OPTICS.map((t) => [t.id, t]));
const PATCH_BY_ID = new Map(MILESTONE_PATCHES.map((p) => [p.id, p]));
const HEADGEAR_BY_ID = new Map(HEADGEAR_STYLES.map((h) => [h.id, h]));
const TRIM_BY_ID = new Map(ACCENT_TRIMS.map((t) => [t.id, t]));
const TANK_BY_ID = new Map(TANK_FINISHES.map((t) => [t.id, t]));
const VISOR_BY_ID = new Map(VISOR_TINTS.map((v) => [v.id, v]));
const SCOOTER_BY_ID = new Map(SCOOTER_MODELS.map((sc) => [sc.id, sc]));
const HARPOON_BY_ID = new Map(HARPOON_MODELS.map((hp) => [hp.id, hp]));

export function getSuitLivery(suitId) {
  return (suitId && SUIT_BY_ID.get(suitId)) || SUIT_LIVERIES[0];
}

export function getTorchOptic(torchId) {
  return (torchId && TORCH_BY_ID.get(torchId)) || TORCH_OPTICS[0];
}

export function getMilestonePatch(patchId) {
  return (patchId && PATCH_BY_ID.get(patchId)) || MILESTONE_PATCHES[0];
}

export function getHeadgearStyle(headgearId) {
  return (headgearId && HEADGEAR_BY_ID.get(headgearId)) || HEADGEAR_STYLES[0];
}

export function getAccentTrim(trimId) {
  return (trimId && TRIM_BY_ID.get(trimId)) || ACCENT_TRIMS[0];
}

export function getTankFinish(tankId) {
  return (tankId && TANK_BY_ID.get(tankId)) || TANK_FINISHES[0];
}

export function getVisorTint(visorId) {
  return (visorId && VISOR_BY_ID.get(visorId)) || VISOR_TINTS[0];
}

export function getScooterModel(scooterId) {
  return (scooterId && SCOOTER_BY_ID.get(scooterId)) || SCOOTER_MODELS[0];
}

export function getHarpoonModel(harpoonId) {
  return (harpoonId && HARPOON_BY_ID.get(harpoonId)) || HARPOON_MODELS[0];
}

/**
 * Return any secret Gear Workshop cosmetic names unlocked by a specific trophy relic ID.
 * Used only when a player actively earns that trophy (zero spoilers beforehand).
 */
export function getSecretCosmeticsForTrophy(trophyRelicId) {
  if (!trophyRelicId) return [];
  const all = [
    ...SUIT_LIVERIES,
    ...HEADGEAR_STYLES,
    ...VISOR_TINTS,
    ...TANK_FINISHES,
    ...TORCH_OPTICS,
    ...ACCENT_TRIMS,
    ...MILESTONE_PATCHES,
    ...SCOOTER_MODELS,
    ...HARPOON_MODELS,
  ];
  return all.filter((item) => item.secret && item.trophyRelicId === trophyRelicId).map((item) => item.name);
}

export const GEAR_CATEGORIES = Object.freeze([
  Object.freeze({ slot: 'suit', field: 'suitId', setKey: 'suits', tabId: 'suit', label: 'Drysuit', list: SUIT_LIVERIES }),
  Object.freeze({ slot: 'trim', field: 'trimId', setKey: 'trims', tabId: 'suit', label: 'Harness Trim', list: ACCENT_TRIMS }),
  Object.freeze({ slot: 'headgear', field: 'headgearId', setKey: 'headgears', tabId: 'head', label: 'Headgear', list: HEADGEAR_STYLES }),
  Object.freeze({ slot: 'visor', field: 'visorId', setKey: 'visors', tabId: 'head', label: 'Visor Tint', list: VISOR_TINTS }),
  Object.freeze({ slot: 'tank', field: 'tankId', setKey: 'tanks', tabId: 'gear', label: 'Tank Finish', list: TANK_FINISHES }),
  Object.freeze({ slot: 'torch', field: 'torchId', setKey: 'torches', tabId: 'gear', label: 'Torch Optic', list: TORCH_OPTICS }),
  Object.freeze({ slot: 'scooter', field: 'scooterId', setKey: 'scooters', tabId: 'gear', label: 'DPV Scooter', list: SCOOTER_MODELS }),
  Object.freeze({ slot: 'harpoon', field: 'harpoonId', setKey: 'harpoons', tabId: 'gear', label: 'Harpoon', list: HARPOON_MODELS }),
  Object.freeze({ slot: 'patch', field: 'patchId', setKey: 'patches', tabId: 'patch', label: 'Milestone Patch', list: MILESTONE_PATCHES }),
]);

export function getAllGearCatalogEntries() {
  const out = [];
  for (const cat of GEAR_CATEGORIES) {
    for (const item of cat.list) {
      out.push({
        key: `${cat.slot}:${item.id}`,
        slot: cat.slot,
        field: cat.field,
        setKey: cat.setKey,
        tabId: cat.tabId,
        categoryLabel: cat.label,
        item,
        tier: getGearTierMeta(item.tier),
      });
    }
  }
  return out;
}

export function getGearItemBySlot(slot, id) {
  const cat = GEAR_CATEGORIES.find((c) => c.slot === slot);
  if (!cat) return null;
  const item = cat.list.find((x) => x.id === id);
  if (!item) return null;
  return {
    key: `${cat.slot}:${item.id}`,
    slot: cat.slot,
    field: cat.field,
    setKey: cat.setKey,
    tabId: cat.tabId,
    categoryLabel: cat.label,
    item,
    tier: getGearTierMeta(item.tier),
  };
}

/**
 * Evaluate attainment progress (0..1) for any unlockable gear item given computed career stats.
 */
export function getGearItemProgress(item, stats = null) {
  if (!item) return { current: 0, target: 1, pct: 0, label: '' };
  if (typeof item.getProgress === 'function' && stats) {
    return item.getProgress(stats);
  }
  const unlocked = stats && typeof item.isUnlocked === 'function' ? Boolean(item.isUnlocked(stats)) : false;
  return {
    current: unlocked ? 1 : 0,
    target: 1,
    pct: unlocked ? 1 : 0,
    label: unlocked ? 'Unlocked' : item.unlockHint || 'Locked',
  };
}

/**
 * Diff two computeUnlockedLiveries snapshots and return all newly unlocked gear entries,
 * sorted highest prestige tier first so Mythic & Epic unlocks headline the celebration card.
 */
export function diffUnlockedLiveries(beforeUnlocks, afterUnlocks) {
  if (!afterUnlocks) return [];
  const newlyUnlocked = [];
  for (const cat of GEAR_CATEGORIES) {
    const prevSet = beforeUnlocks?.[cat.setKey];
    const nextSet = afterUnlocks?.[cat.setKey];
    if (!(nextSet instanceof Set)) continue;
    for (const item of cat.list) {
      if (nextSet.has(item.id) && !(prevSet instanceof Set && prevSet.has(item.id))) {
        newlyUnlocked.push({
          key: `${cat.slot}:${item.id}`,
          slot: cat.slot,
          field: cat.field,
          setKey: cat.setKey,
          tabId: cat.tabId,
          categoryLabel: cat.label,
          item,
          tier: getGearTierMeta(item.tier),
        });
      }
    }
  }
  newlyUnlocked.sort((a, b) => {
    const tierDiff = (b.tier?.rank || 0) - (a.tier?.rank || 0);
    if (tierDiff !== 0) return tierDiff;
    return (b.item.ladderRank || 0) - (a.item.ladderRank || 0);
  });
  return newlyUnlocked;
}

/**
 * Find the closest non-secret locked gear pieces on the difficulty ladder so the Gear Workshop
 * can highlight clear next milestones with live progress bars (v211).
 */
export function getNextGearMilestones(unlocks, limit = 3) {
  if (!unlocks?.stats) return [];
  const locked = [];
  for (const cat of GEAR_CATEGORIES) {
    const set = unlocks[cat.setKey];
    for (const item of cat.list) {
      if (item.secret) continue;
      if (set instanceof Set && set.has(item.id)) continue;
      const prog = getGearItemProgress(item, unlocks.stats);
      locked.push({
        key: `${cat.slot}:${item.id}`,
        slot: cat.slot,
        field: cat.field,
        setKey: cat.setKey,
        tabId: cat.tabId,
        categoryLabel: cat.label,
        item,
        tier: getGearTierMeta(item.tier),
        progress: prog,
      });
    }
  }
  locked.sort((a, b) => {
    // Prioritize items closest to completion, breaking ties by easiest ladder rank
    const pctDiff = (b.progress?.pct || 0) - (a.progress?.pct || 0);
    if (Math.abs(pctDiff) > 0.08) return pctDiff;
    return (a.item.ladderRank || 0) - (b.item.ladderRank || 0);
  });
  return locked.slice(0, Math.max(1, limit));
}

/**
 * Matching Gear Set Synergies (v212): pairing themed pieces across slots activates
 * bespoke visual set auras, synchronized wake trails, and Workshop set-completion badges.
 */
export const GEAR_SET_SYNERGIES = Object.freeze([
  Object.freeze({
    id: 'dreadnought-mk4',
    name: 'WWII Dreadnought Mk-IV',
    icon: '⚙️',
    tier: 'mythic',
    required: 2,
    secret: true,
    auraName: 'Furnace Steam Aura',
    auraDesc: 'Synchronized brass boiler shimmer & rising golden steam-ember wake.',
    color: '#fbbf24',
    rgb: '251, 191, 36',
    hueA: 38,
    hueB: 48,
    rising: true,
    slots: Object.freeze([
      { slot: 'headgear', field: 'headgearId', ids: ['secret-dreadnought-helm'] },
      { slot: 'tank', field: 'tankId', ids: ['secret-dreadnought-brass'] },
    ]),
  }),
  Object.freeze({
    id: 'apex-bounty',
    name: 'Apex Leviathan Hunter',
    icon: '👑',
    tier: 'mythic',
    required: 3,
    secret: false,
    auraName: 'Apex Sovereign Crest',
    auraDesc: 'Radiant crimson-gold sovereign halo & predator plasma fin-wake.',
    color: '#facc15',
    rgb: '250, 204, 21',
    hueA: 46,
    hueB: 348,
    rising: false,
    slots: Object.freeze([
      { slot: 'suit', field: 'suitId', ids: ['bounty-hunter-suit'] },
      { slot: 'torch', field: 'torchId', ids: ['bounty-hunter-torch'] },
      { slot: 'visor', field: 'visorId', ids: ['bounty-hunter-visor'] },
      { slot: 'harpoon', field: 'harpoonId', ids: ['apex-hunter-railgun', 'legendary-poseidon-trident'] },
      { slot: 'scooter', field: 'scooterId', ids: ['legendary-valkyrie-dpv'] },
      { slot: 'patch', field: 'patchId', ids: ['bounty-hunter-master'] },
    ]),
  }),
  Object.freeze({
    id: 'kraken-depths',
    name: 'Biolume Leviathan',
    icon: '🐙',
    tier: 'mythic',
    required: 2,
    secret: true,
    auraName: 'Living Biolume Bloom',
    auraDesc: 'Luminous cyan-violet plankton bloom trailing every fin kick.',
    color: '#22d3ee',
    rgb: '34, 211, 238',
    hueA: 190,
    hueB: 282,
    rising: false,
    slots: Object.freeze([
      { slot: 'suit', field: 'suitId', ids: ['secret-kraken-biolume'] },
      { slot: 'torch', field: 'torchId', ids: ['halocline-uv'] },
      { slot: 'trim', field: 'trimId', ids: ['secret-selenite-trim', 'biolum-violet', 'plasma-circuit-trim'] },
      { slot: 'visor', field: 'visorId', ids: ['secret-aurora-frost', 'reef-mirror'] },
      { slot: 'harpoon', field: 'harpoonId', ids: ['kraken-biolume-spear'] },
    ]),
  }),
  Object.freeze({
    id: 'abyssal-void',
    name: 'Abyssal Voidwalker',
    icon: '🛸',
    tier: 'epic',
    required: 3,
    secret: false,
    auraName: 'Void Resonance Field',
    auraDesc: 'Pulsing indigo-cyan telemetry aura & electric plasma fin-wake.',
    color: '#c084fc',
    rgb: '192, 132, 252',
    hueA: 274,
    hueB: 194,
    rising: false,
    slots: Object.freeze([
      { slot: 'suit', field: 'suitId', ids: ['krubera-obsidian', 'secret-empress-sovereign'] },
      { slot: 'headgear', field: 'headgearId', ids: ['abyss-halo-helm', 'exo-mask'] },
      { slot: 'tank', field: 'tankId', ids: ['abyssal-titanium'] },
      { slot: 'trim', field: 'trimId', ids: ['plasma-circuit-trim', 'biolum-violet'] },
      { slot: 'scooter', field: 'scooterId', ids: ['phantom-whisper-dpv'] },
      { slot: 'harpoon', field: 'harpoonId', ids: ['legendary-poseidon-trident'] },
    ]),
  }),
  Object.freeze({
    id: 'karst-pioneer',
    name: 'Karst & Halocline Explorer',
    icon: '🌿',
    tier: 'epic',
    required: 2,
    secret: false,
    auraName: 'Halocline Caustic Wake',
    auraDesc: 'Shimmering cenote turquoise-emerald caustic ribbon wake.',
    color: '#2dd4bf',
    rgb: '45, 212, 191',
    hueA: 168,
    hueB: 142,
    rising: false,
    slots: Object.freeze([
      { slot: 'suit', field: 'suitId', ids: ['karst-jade', 'abyss-emerald'] },
      { slot: 'headgear', field: 'headgearId', ids: ['world-thermal-hood'] },
      { slot: 'tank', field: 'tankId', ids: ['sulfur-emerald-tank', 'world-chimney-tank'] },
      { slot: 'visor', field: 'visorId', ids: ['thermocline-prism'] },
      { slot: 'patch', field: 'patchId', ids: ['camp-karst', 'camp-halocline'] },
    ]),
  }),
  Object.freeze({
    id: 'wreck-salvager',
    name: 'Deep Salvage Specialist',
    icon: '⚓',
    tier: 'rare',
    required: 3,
    secret: false,
    auraName: 'Burnished Salvage Halo',
    auraDesc: 'Warm amber-bronze salvage glint trail & rescue beacon aura.',
    color: '#f59e0b',
    rgb: '245, 158, 11',
    hueA: 38,
    hueB: 45,
    rising: false,
    slots: Object.freeze([
      { slot: 'suit', field: 'suitId', ids: ['wreck-titanium'] },
      { slot: 'headgear', field: 'headgearId', ids: ['brass-hardhat', 'cave-helmet'] },
      { slot: 'tank', field: 'tankId', ids: ['salvage-brass'] },
      { slot: 'trim', field: 'trimId', ids: ['salvage-gold'] },
      { slot: 'scooter', field: 'scooterId', ids: ['salvage-tug-dpv'] },
      { slot: 'harpoon', field: 'harpoonId', ids: ['salvage-rivet-lance'] },
    ]),
  }),
  Object.freeze({
    id: 'sunken-cartographer',
    name: 'Sunken Cartographer',
    icon: '🧭',
    tier: 'epic',
    required: 2,
    secret: false,
    source: 'world',
    auraName: 'Cartographer Compass Aura',
    auraDesc: 'Golden survey compass halo & live directional glint toward hidden relics (26m).',
    color: '#fbbf24',
    rgb: '251, 191, 36',
    hueA: 45,
    hueB: 196,
    rising: false,
    slots: Object.freeze([
      { slot: 'suit', field: 'suitId', ids: ['world-cartographer-suit'] },
      { slot: 'visor', field: 'visorId', ids: ['world-cartographer-visor'] },
      { slot: 'torch', field: 'torchId', ids: ['world-cartographer-torch'] },
      { slot: 'scooter', field: 'scooterId', ids: ['hydro-glider-dpv'] },
    ]),
  }),
  Object.freeze({
    id: 'karst-hydro-glider',
    name: 'Karst Hydro-Glider',
    icon: '🌊',
    tier: 'epic',
    required: 2,
    secret: false,
    source: 'world',
    auraName: 'Hydro-Ghost Slipstream',
    auraDesc: 'Silky turquoise laminar wake & up to -82% Pull-and-Glide headwind drag.',
    color: '#2dd4bf',
    rgb: '45, 212, 191',
    hueA: 174,
    hueB: 192,
    rising: false,
    slots: Object.freeze([
      { slot: 'suit', field: 'suitId', ids: ['world-hydro-suit'] },
      { slot: 'trim', field: 'trimId', ids: ['world-hydro-fins'] },
      { slot: 'tank', field: 'tankId', ids: ['world-hydro-tank'] },
      { slot: 'scooter', field: 'scooterId', ids: ['hydro-glider-dpv', 'legendary-valkyrie-dpv'] },
    ]),
  }),
]);

/**
 * Evaluate which Gear Set Synergies are active or partially matched on a livery (v212).
 */
export function evaluateGearSetSynergy(livery = null) {
  const cur = {
    suitId: livery?.suitId || DEFAULT_RIG_LIVERY.suitId,
    torchId: livery?.torchId || DEFAULT_RIG_LIVERY.torchId,
    patchId: livery?.patchId || DEFAULT_RIG_LIVERY.patchId,
    headgearId: livery?.headgearId || DEFAULT_MODULAR_IDS.headgearId,
    trimId: livery?.trimId || DEFAULT_MODULAR_IDS.trimId,
    tankId: livery?.tankId || DEFAULT_MODULAR_IDS.tankId,
    visorId: livery?.visorId || DEFAULT_MODULAR_IDS.visorId,
    scooterId: livery?.scooterId || DEFAULT_MODULAR_IDS.scooterId,
    harpoonId: livery?.harpoonId || DEFAULT_MODULAR_IDS.harpoonId,
  };
  const statuses = [];
  let active = null;
  for (const set of GEAR_SET_SYNERGIES) {
    let matched = 0;
    for (const rule of set.slots) {
      if (rule.ids.includes(cur[rule.field])) matched++;
    }
    const isActive = matched >= set.required;
    const st = {
      set,
      matched,
      required: set.required,
      active: isActive,
      pct: Math.min(1, matched / Math.max(1, set.required)),
    };
    statuses.push(st);
    if (isActive) {
      if (!active || getGearTierMeta(set.tier).rank > getGearTierMeta(active.tier).rank) {
        active = set;
      }
    }
  }
  return { active, sets: statuses };
}

/**
 * Find any Gear Set Synergies that include a given gear slot + item ID.
 */
export function getSetsForGearItem(slot, itemId) {
  if (!slot || !itemId) return [];
  return GEAR_SET_SYNERGIES.filter((set) =>
    set.slots.some((rule) => rule.slot === slot && rule.ids.includes(itemId))
  );
}

/**
 * Resolve world-space fin-wake trail & subtle ambient aura profile for Mythic/Epic gear
 * and active Set Synergies during live dives (v212).
 */
export function resolveGearWakeProfile(livery = null) {
  if (!livery) return null;
  const suit = getSuitLivery(livery.suitId);
  const trimSpec = getAccentTrim(livery.trimId);
  const syn = evaluateGearSetSynergy(livery);
  const activeSet = syn.active;

  if (activeSet) {
    return {
      active: true,
      hueA: activeSet.hueA,
      hueB: activeSet.hueB,
      prism: trimSpec?.fx?.id === 'selenite-prism',
      rising: Boolean(activeSet.rising),
      rateMult: activeSet.tier === 'mythic' ? 1.45 : 1.22,
      minDepth: 1.2,
      auraColor: activeSet.color,
      auraRgb: activeSet.rgb,
      isSetAura: true,
      label: activeSet.auraName,
    };
  }
  const sfx = suit?.fx?.id || '';
  const tfx = trimSpec?.fx?.id || '';
  if (tfx === 'selenite-prism') {
    return { active: true, hueA: 292, hueB: 192, prism: true, rising: false, rateMult: 1.35, minDepth: 1.2, auraColor: '#e879f9', auraRgb: '232, 121, 249', isSetAura: false, label: 'Prismatic Wake' };
  }
  if (sfx === 'magma-embers' || tfx === 'foundry-sparks') {
    return { active: true, hueA: 26, hueB: 44, prism: false, rising: true, rateMult: 1.35, minDepth: 1.2, auraColor: '#fb923c', auraRgb: '251, 146, 60', isSetAura: false, label: 'Molten Ember Wake' };
  }
  if (sfx === 'biolume-pulse') {
    return { active: true, hueA: 190, hueB: 280, prism: false, rising: false, rateMult: 1.35, minDepth: 1.2, auraColor: '#22d3ee', auraRgb: '34, 211, 238', isSetAura: false, label: 'Biolume Spore Wake' };
  }
  if (sfx === 'sovereign-aura') {
    return { active: true, hueA: 48, hueB: 158, prism: false, rising: false, rateMult: 1.32, minDepth: 1.2, auraColor: '#facc15', auraRgb: '250, 204, 21', isSetAura: false, label: 'Sovereign Mote Wake' };
  }
  if (sfx === 'phantom-phase') {
    return { active: true, hueA: 168, hueB: 184, prism: false, rising: false, rateMult: 1.28, minDepth: 1.2, auraColor: '#5eead4', auraRgb: '94, 234, 212', isSetAura: false, label: 'Spectral Wake' };
  }
  if (sfx === 'orichalcum-runes') {
    return { active: true, hueA: 46, hueB: 192, prism: false, rising: false, rateMult: 1.28, minDepth: 1.2, auraColor: '#fbbf24', auraRgb: '251, 191, 36', isSetAura: false, label: 'Orichalcum Wake' };
  }
  if (sfx === 'dragon-jade') {
    return { active: true, hueA: 166, hueB: 350, prism: false, rising: true, rateMult: 1.3, minDepth: 1.2, auraColor: '#2dd4bf', auraRgb: '45, 212, 191', isSetAura: false, label: 'Dragon Lantern Wake' };
  }
  if (tfx === 'plasma-wave') {
    return { active: true, hueA: 194, hueB: 208, prism: false, rising: false, rateMult: 1.18, minDepth: 1.6, auraColor: '#38bdf8', auraRgb: '56, 189, 248', isSetAura: false, label: 'Plasma Conduit Wake' };
  }
  if (sfx === 'karst-caustics') {
    return { active: true, hueA: 168, hueB: 182, prism: false, rising: false, rateMult: 1.15, minDepth: 1.6, auraColor: '#2dd4bf', auraRgb: '45, 212, 191', isSetAura: false, label: 'Caustic Wake' };
  }
  if (sfx === 'abyssal-shimmer' || tfx === 'abyssal-shimmer') {
    return { active: true, hueA: 278, hueB: 296, prism: false, rising: false, rateMult: 1.15, minDepth: 1.8, auraColor: '#c084fc', auraRgb: '192, 132, 252', isSetAura: false, label: 'Abyssal Sheen Wake' };
  }
  return null;
}

/**
 * Resolve any modular livery object into a complete drawing palette used consistently
 * by CaveRenderer, artSprites, Workshop Test-Tank Preview, and Home Mini-Avatar Badge (v153 / v211 / v212).
 */
export function resolveDiverLiveryPalette(livery = null) {
  const suit = getSuitLivery(livery?.suitId);
  const torch = getTorchOptic(livery?.torchId);
  const patch = getMilestonePatch(livery?.patchId);
  const headgear = getHeadgearStyle(livery?.headgearId);
  const trimSpec = getAccentTrim(livery?.trimId);
  const tank = getTankFinish(livery?.tankId);
  const visor = getVisorTint(livery?.visorId);
  const scooter = getScooterModel(livery?.scooterId);
  const harpoon = getHarpoonModel(livery?.harpoonId);

  const tierRanks = [suit, torch, patch, headgear, trimSpec, tank, visor, scooter, harpoon].map((x) => getGearTierMeta(x?.tier).rank);
  const maxRank = Math.max(...tierRanks);
  const maxTier = Object.values(GEAR_TIERS).find((t) => t.rank === maxRank) || GEAR_TIERS.common;
  const setSynergy = evaluateGearSetSynergy(livery).active;
  const wakeProfile = resolveGearWakeProfile(livery);

  const basePalette = {
    suit,
    torch,
    patch,
    headgear,
    trimSpec,
    tank,
    visor,
    scooter,
    harpoon,
    suitTop: suit.suitTop,
    suitMid: suit.suitMid,
    suitBot: suit.suitBot,
    accent: trimSpec.accent || suit.accent,
    trim: trimSpec.trim || suit.trim,
    finColor: suit.finColor,
    finTip: trimSpec.finTip || suit.finTip,
    stageBand: trimSpec.stageBand || suit.stageBand,
    patchIcon: patch.id !== 'none' ? patch.icon : '',
    headgearId: headgear.id,
    tankFinish: tank,
    visorTint: visor,
    suitFx: suit.fx?.id || '',
    headgearFx: headgear.fx?.id || '',
    visorFx: visor.fx?.id || '',
    tankFx: tank.fx?.id || '',
    trimFx: trimSpec.fx?.id || '',
    torchFx: torch.fx?.id || '',
    patchFx: patch.fx?.id || '',
    patchTier: patch.tier || 'common',
    maxTier,
    setSynergy,
    wakeProfile,
  };
  return applyChromaToPalette(basePalette, livery?.dyeId);
}

/**
 * Evaluate career progress & skill certification milestones from a logbook to determine unlocked
 * drysuits, torches, patches, headgear silhouettes, trims, tank finishes & visor tints.
 */
export function computeUnlockedLiveries(logbook = null, wreckLevelIds = null) {
  const sites =
    logbook?.cleared && typeof logbook.cleared === 'object'
      ? logbook.cleared
      : logbook?.sites && typeof logbook.sites === 'object'
        ? logbook.sites
        : {};
  let sitesCleared = 0;
  let wreckClears = 0;
  let hardcoreClears = 0;
  const wreckSet = wreckLevelIds instanceof Set ? wreckLevelIds : new Set(Array.isArray(wreckLevelIds) ? wreckLevelIds : []);
  for (const [siteId, rec] of Object.entries(sites)) {
    if (rec && (rec.clears > 0 || rec.score > 0 || rec.bestScore > 0)) {
      sitesCleared++;
      if (rec.bestDifficulty === 'hardcore' || rec.difficulty === 'hardcore') hardcoreClears++;
      if (wreckSet.has(siteId) || siteId.includes('wreck') || siteId.includes('oriskany') || siteId.includes('britannic') || siteId.includes('fitzgerald') || siteId.includes('thistlegorm') || siteId.includes('u1206') || siteId.includes('zenobia') || siteId.includes('andrea-doria') || siteId.includes('victoria') || siteId.includes('fujikawa') || siteId.includes('markgraf')) {
        wreckClears++;
      }
    }
  }
  const speciesLogged = logbook?.fieldGuide && typeof logbook.fieldGuide === 'object'
    ? Object.keys(logbook.fieldGuide).length
    : 0;
  const ms = logbook?.milestones && typeof logbook.milestones === 'object' ? logbook.milestones : {};
  const completedCampaigns = new Set(Array.isArray(logbook?.completedCampaigns) ? logbook.completedCampaigns : []);
  const artifactIds = new Set(
    logbook?.artifacts && typeof logbook.artifacts === 'object' ? Object.keys(logbook.artifacts) : []
  );
  const foundGearIds = new Set(
    logbook?.foundGear && typeof logbook.foundGear === 'object' ? Object.keys(logbook.foundGear) : []
  );
  const deepestM = Math.max(0, Number(logbook?.deepestM) || 0);
  const dailyClears = Math.max(0, Number(logbook?.daily?.totalClears) || 0);
  const drillMasteryClears = logbook?.drillMastery && typeof logbook.drillMastery === 'object'
    ? Object.values(logbook.drillMastery).reduce((acc, r) => acc + ((r?.clears || 0) > 0 ? 1 : 0), 0)
    : 0;
  const stats = {
    sitesCleared,
    wreckClears,
    hardcoreClears,
    deepestM,
    dailyClears,
    speciesLogged,
    completedCampaigns,
    artifactIds,
    foundGearIds,
    bountiesClaimed: 0,
    pressurizedEqualizations: Math.max(0, Number(ms.pressurizedEqualizations) || 0),
    cleanSalvageLifts: Math.max(0, Number(ms.cleanSalvageLifts) || 0),
    drillsCompleted: Math.max(0, Number(ms.drillsCompleted) || 0) + drillMasteryClears,
    zeroSiltClears: Math.max(0, Number(ms.zeroSiltClears) || 0),
  };
  stats.bountiesClaimed = _countClaimedBounties(stats);

  const soldGear = new Set(
    logbook?.soldGear && typeof logbook.soldGear === 'object' ? Object.keys(logbook.soldGear) : []
  );
  const suits = new Set();
  for (const s of SUIT_LIVERIES) {
    const k = `suit:${s.id}`;
    if ((s.isUnlocked(stats) || foundGearIds.has(k)) && !soldGear.has(k)) suits.add(s.id);
  }
  const torches = new Set();
  for (const t of TORCH_OPTICS) {
    const k = `torch:${t.id}`;
    if ((t.isUnlocked(stats) || foundGearIds.has(k)) && !soldGear.has(k)) torches.add(t.id);
  }
  const patches = new Set();
  for (const p of MILESTONE_PATCHES) {
    const k = `patch:${p.id}`;
    if ((p.isUnlocked(stats) || foundGearIds.has(k)) && !soldGear.has(k)) patches.add(p.id);
  }
  const headgears = new Set();
  for (const h of HEADGEAR_STYLES) {
    const k = `headgear:${h.id}`;
    if ((h.isUnlocked(stats) || foundGearIds.has(k)) && !soldGear.has(k)) headgears.add(h.id);
  }
  const trims = new Set();
  for (const tr of ACCENT_TRIMS) {
    const k = `trim:${tr.id}`;
    if ((tr.isUnlocked(stats) || foundGearIds.has(k)) && !soldGear.has(k)) trims.add(tr.id);
  }
  const tanks = new Set();
  for (const tk of TANK_FINISHES) {
    const k = `tank:${tk.id}`;
    if ((tk.isUnlocked(stats) || foundGearIds.has(k)) && !soldGear.has(k)) tanks.add(tk.id);
  }
  const visors = new Set();
  for (const vs of VISOR_TINTS) {
    const k = `visor:${vs.id}`;
    if ((vs.isUnlocked(stats) || foundGearIds.has(k)) && !soldGear.has(k)) visors.add(vs.id);
  }
  const scooters = new Set();
  for (const sc of SCOOTER_MODELS) {
    const k = `scooter:${sc.id}`;
    if ((sc.isUnlocked(stats) || foundGearIds.has(k)) && !soldGear.has(k)) scooters.add(sc.id);
  }
  const harpoons = new Set();
  for (const hp of HARPOON_MODELS) {
    const k = `harpoon:${hp.id}`;
    if ((hp.isUnlocked(stats) || foundGearIds.has(k)) && !soldGear.has(k)) harpoons.add(hp.id);
  }
  const dyes = new Set(['none']);
  if (Array.isArray(logbook?.ownedDyes)) {
    for (const did of logbook.ownedDyes) {
      if (isValidGearChromaId(did)) dyes.add(did);
    }
  }

  return { stats, suits, torches, patches, headgears, trims, tanks, visors, scooters, harpoons, dyes, soldGear };
}

/**
 * Curated First-Play Expedition Welcome Crate choices (v222).
 * Brand-new divers pick 1 free Specialty Relic to immediately unlock & outfit their starter rig before Dive #1.
 */
export const WELCOME_RELIC_CHOICES = Object.freeze([
  Object.freeze({
    id: 'deep-cobalt',
    icon: '🌊',
    archetype: 'deep',
    title: 'Deep Explorer',
    tagline: 'Extra gas reserve, icy cold insulation & warm cavern visibility.',
    giftSlot: 'tank',
    giftField: 'tankId',
    giftItemId: 'anodized-cobalt',
    giftName: 'Anodized Cobalt Twinset',
    giftHighlight: '+10 Bar · +4% Swim · -6% Gas',
    fullRig: Object.freeze({
      suitId: 'arctic-cobalt',
      trimId: 'tech-cyan',
      headgearId: 'cave-hood',
      visorId: 'amber-contrast',
      tankId: 'anodized-cobalt',
      torchId: 'warm-halogen',
      patchId: 'cave-arrow',
    }),
  }),
  Object.freeze({
    id: 'speed-amber',
    icon: '⚡',
    archetype: 'speed',
    title: 'Karst Speed-Glider',
    tagline: 'Nimble fin thrust, crystal-clear silt cutting & bright beam reach.',
    giftSlot: 'torch',
    giftField: 'torchId',
    giftItemId: 'amber-silt',
    giftName: 'Amber Silt-Piercer Torch',
    giftHighlight: '-15% Silt · +10% Beam',
    fullRig: Object.freeze({
      suitId: 'expedition-amber',
      trimId: 'safety-orange',
      headgearId: 'zissou-cap',
      visorId: 'clear-cyan',
      tankId: 'hivis-yellow',
      torchId: 'amber-silt',
      patchId: 'cave-arrow',
    }),
  }),
  Object.freeze({
    id: 'pathfinder-crimson',
    icon: '🔱',
    archetype: 'combat',
    title: 'Bold Pathfinder',
    tagline: 'Iconic Cousteau style with punchy propulsion & guardian readiness.',
    giftSlot: 'trim',
    giftField: 'trimId',
    giftItemId: 'signal-crimson',
    giftName: 'Crimson Flare Harness',
    giftHighlight: '+6% Swim · +8% Spear · -10% Dash CD',
    fullRig: Object.freeze({
      suitId: 'zissou-classic',
      trimId: 'signal-crimson',
      headgearId: 'zissou-cap',
      visorId: 'amber-contrast',
      tankId: 'al80-silver',
      torchId: 'tech-led',
      patchId: 'cave-arrow',
    }),
  }),
]);

/**
 * Validate and clamp a livery selection against catalog (and optionally against unlocked sets).
 * Preserves compact shape (omitting default modular overrides) for backward compatibility & light P2P sync.
 */
export function sanitizeRigLivery(raw = null, unlocked = null) {
  let suitId = typeof raw?.suitId === 'string' && SUIT_BY_ID.has(raw.suitId) ? raw.suitId : DEFAULT_RIG_LIVERY.suitId;
  let torchId = typeof raw?.torchId === 'string' && TORCH_BY_ID.has(raw.torchId) ? raw.torchId : DEFAULT_RIG_LIVERY.torchId;
  let patchId = typeof raw?.patchId === 'string' && PATCH_BY_ID.has(raw.patchId) ? raw.patchId : DEFAULT_RIG_LIVERY.patchId;
  let headgearId = typeof raw?.headgearId === 'string' && HEADGEAR_BY_ID.has(raw.headgearId) ? raw.headgearId : DEFAULT_MODULAR_IDS.headgearId;
  let trimId = typeof raw?.trimId === 'string' && TRIM_BY_ID.has(raw.trimId) ? raw.trimId : DEFAULT_MODULAR_IDS.trimId;
  let tankId = typeof raw?.tankId === 'string' && TANK_BY_ID.has(raw.tankId) ? raw.tankId : DEFAULT_MODULAR_IDS.tankId;
  let visorId = typeof raw?.visorId === 'string' && VISOR_BY_ID.has(raw.visorId) ? raw.visorId : DEFAULT_MODULAR_IDS.visorId;
  let scooterId = typeof raw?.scooterId === 'string' && SCOOTER_BY_ID.has(raw.scooterId) ? raw.scooterId : DEFAULT_MODULAR_IDS.scooterId;
  let harpoonId = typeof raw?.harpoonId === 'string' && HARPOON_BY_ID.has(raw.harpoonId) ? raw.harpoonId : DEFAULT_MODULAR_IDS.harpoonId;
  let dyeId = typeof raw?.dyeId === 'string' && isValidGearChromaId(raw.dyeId) ? raw.dyeId : DEFAULT_MODULAR_IDS.dyeId;

  if (unlocked) {
    if (unlocked.suits && !unlocked.suits.has(suitId)) suitId = DEFAULT_RIG_LIVERY.suitId;
    if (unlocked.torches && !unlocked.torches.has(torchId)) torchId = DEFAULT_RIG_LIVERY.torchId;
    if (unlocked.patches && !unlocked.patches.has(patchId)) patchId = DEFAULT_RIG_LIVERY.patchId;
    if (unlocked.headgears && !unlocked.headgears.has(headgearId)) headgearId = DEFAULT_MODULAR_IDS.headgearId;
    if (unlocked.trims && !unlocked.trims.has(trimId)) trimId = DEFAULT_MODULAR_IDS.trimId;
    if (unlocked.tanks && !unlocked.tanks.has(tankId)) tankId = DEFAULT_MODULAR_IDS.tankId;
    if (unlocked.visors && !unlocked.visors.has(visorId)) visorId = DEFAULT_MODULAR_IDS.visorId;
    if (unlocked.scooters && !unlocked.scooters.has(scooterId)) scooterId = DEFAULT_MODULAR_IDS.scooterId;
    if (unlocked.harpoons && !unlocked.harpoons.has(harpoonId)) harpoonId = DEFAULT_MODULAR_IDS.harpoonId;
    if (unlocked.dyes && !unlocked.dyes.has(dyeId)) dyeId = DEFAULT_MODULAR_IDS.dyeId;
  }

  const out = { suitId, torchId, patchId };
  if (headgearId !== DEFAULT_MODULAR_IDS.headgearId) out.headgearId = headgearId;
  if (trimId !== DEFAULT_MODULAR_IDS.trimId) out.trimId = trimId;
  if (tankId !== DEFAULT_MODULAR_IDS.tankId) out.tankId = tankId;
  if (visorId !== DEFAULT_MODULAR_IDS.visorId) out.visorId = visorId;
  if (scooterId !== DEFAULT_MODULAR_IDS.scooterId) out.scooterId = scooterId;
  if (harpoonId !== DEFAULT_MODULAR_IDS.harpoonId) out.harpoonId = harpoonId;
  if (dyeId !== DEFAULT_MODULAR_IDS.dyeId) out.dyeId = dyeId;
  return out;
}

export function isDefaultRigLivery(livery) {
  if (!livery) return true;
  return (
    (livery.suitId || DEFAULT_RIG_LIVERY.suitId) === DEFAULT_RIG_LIVERY.suitId &&
    (livery.torchId || DEFAULT_RIG_LIVERY.torchId) === DEFAULT_RIG_LIVERY.torchId &&
    (livery.patchId || DEFAULT_RIG_LIVERY.patchId) === DEFAULT_RIG_LIVERY.patchId &&
    (livery.headgearId || DEFAULT_MODULAR_IDS.headgearId) === DEFAULT_MODULAR_IDS.headgearId &&
    (livery.trimId || DEFAULT_MODULAR_IDS.trimId) === DEFAULT_MODULAR_IDS.trimId &&
    (livery.tankId || DEFAULT_MODULAR_IDS.tankId) === DEFAULT_MODULAR_IDS.tankId &&
    (livery.visorId || DEFAULT_MODULAR_IDS.visorId) === DEFAULT_MODULAR_IDS.visorId &&
    (livery.scooterId || DEFAULT_MODULAR_IDS.scooterId) === DEFAULT_MODULAR_IDS.scooterId &&
    (livery.harpoonId || DEFAULT_MODULAR_IDS.harpoonId) === DEFAULT_MODULAR_IDS.harpoonId &&
    (livery.dyeId || DEFAULT_MODULAR_IDS.dyeId) === DEFAULT_MODULAR_IDS.dyeId
  );
}

/**
 * Pick a randomized, visually cohesive unlocked rig combination (v153).
 */
export function randomizeUnlockedLivery(unlocked = null, rng = Math.random) {
  const pick = (arr, set) => {
    const pool = set ? arr.filter((x) => set.has(x.id)) : arr;
    if (pool.length === 0) return arr[0].id;
    return pool[Math.floor(rng() * pool.length) % pool.length].id;
  };
  return sanitizeRigLivery(
    {
      suitId: pick(SUIT_LIVERIES, unlocked?.suits),
      torchId: pick(TORCH_OPTICS, unlocked?.torches),
      patchId: pick(MILESTONE_PATCHES, unlocked?.patches),
      headgearId: pick(HEADGEAR_STYLES, unlocked?.headgears),
      trimId: pick(ACCENT_TRIMS, unlocked?.trims),
      tankId: pick(TANK_FINISHES, unlocked?.tanks),
      visorId: pick(VISOR_TINTS, unlocked?.visors),
      scooterId: pick(SCOOTER_MODELS, unlocked?.scooters),
      harpoonId: pick(HARPOON_MODELS, unlocked?.harpoons),
    },
    unlocked
  );
}

function _smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function _easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.max(0, Math.min(1, t));
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/**
 * Resolve exact avatar anchor, studio backlight geometry, and camera zoom framing for every gear slot (v228 / v236).
 */
function _getSlotPreviewAnchor(slot, sx, sy, scale) {
  const u = scale * 0.55;
  if (slot === 'headgear') {
    return { ax: sx + u * 0.52, ay: sy - u * 0.14, rx: u * 0.50, ry: u * 0.44, zoom: 1.62, shape: 'circle', label: 'Headgear', dirX: 1, dirY: -1 };
  }
  if (slot === 'visor') {
    return { ax: sx + u * 0.72, ay: sy - u * 0.02, rx: u * 0.34, ry: u * 0.32, zoom: 1.74, shape: 'circle', label: 'Visor Lens', dirX: 1, dirY: -1 };
  }
  if (slot === 'tank' || slot === 'ccr') {
    return {
      ax: sx - u * 0.28,
      ay: sy - u * 0.40,
      rx: u * 0.72,
      ry: u * 0.32,
      zoom: 1.50,
      shape: 'capsule',
      label: slot === 'ccr' ? 'CCR Loop' : 'Twin Tanks',
      dirX: -1,
      dirY: -1,
    };
  }
  if (slot === 'torch') {
    return { ax: sx + 0.58 * scale, ay: sy + 0.21 * scale, rx: u * 0.48, ry: u * 0.46, zoom: 1.58, shape: 'circle', label: 'Primary Torch', dirX: 1, dirY: 1 };
  }
  if (slot === 'patch') {
    return { ax: sx - u * 0.02, ay: sy + u * 0.01, rx: u * 0.36, ry: u * 0.36, zoom: 1.72, shape: 'circle', label: 'Shoulder Patch', dirX: -1, dirY: 1 };
  }
  if (slot === 'trim') {
    return {
      ax: sx - 0.56 * scale,
      ay: sy - 0.05 * scale,
      rx: scale * 0.58,
      ry: scale * 0.26,
      zoom: 1.32,
      shape: 'capsule',
      secondary: { ax: sx - 1.30 * scale, ay: sy - 0.14 * scale, r: u * 0.52 },
      label: 'Trim & Fins',
      dirX: -1,
      dirY: 1,
    };
  }
  if (slot === 'suit') {
    return { ax: sx - 0.26 * scale, ay: sy + 0.02 * scale, rx: scale * 0.68, ry: scale * 0.32, zoom: 1.26, shape: 'capsule', label: 'Drysuit', dirX: -1, dirY: 1 };
  }
  if (slot === 'dpv' || slot === 'scooter') {
    return { ax: sx + u * 0.92, ay: sy + u * 0.16, rx: u * 0.68, ry: u * 0.52, zoom: 1.40, shape: 'circle', label: 'DPV Scooter', dirX: 1, dirY: 1 };
  }
  if (slot === 'harpoon') {
    return { ax: sx + 0.68 * scale, ay: sy + 0.16 * scale, rx: u * 0.68, ry: u * 0.42, zoom: 1.36, shape: 'capsule', label: 'Harpoon', dirX: 1, dirY: 1 };
  }
  if (slot === 'chroma') {
    return { ax: sx - 0.16 * scale, ay: sy, rx: scale * 0.88, ry: scale * 0.44, zoom: 1.18, shape: 'capsule', label: 'Color Coat', dirX: -1, dirY: -1 };
  }
  return { ax: sx - 0.12 * scale, ay: sy, rx: scale * 0.96, ry: scale * 0.48, zoom: 1.0, shape: 'capsule', label: 'Full Rig', dirX: 1, dirY: -1 };
}

/**
 * Per-canvas smooth camera zoom & focus pan state (v236).
 * WeakMap keeps zero leaks across modal/canvas lifecycles and snaps immediately on first draw.
 */
const _previewCameraStates = new WeakMap();

function _resolvePreviewCameraTarget(slot, sx, syBase, scale, w, h, equipFx) {
  if (!slot || slot === 'all') {
    return { zoom: 1.0, cx: w * 0.50, cy: h * 0.52 };
  }
  const anchor = _getSlotPreviewAnchor(slot, sx, syBase, scale);
  let zoom = anchor.zoom || 1.25;
  // Subtle cinematic lock-in zoom pulse when freshly equipped
  if (equipFx && equipFx.progress >= 0 && equipFx.progress < 0.55) {
    const k = Math.sin((equipFx.progress / 0.55) * Math.PI);
    zoom += k * 0.07;
  }
  // Blend anchor slightly toward diver center so silhouette context stays clear
  const cx = anchor.ax * 0.88 + sx * 0.12;
  const cy = anchor.ay * 0.88 + syBase * 0.12;
  return { zoom, cx, cy };
}

function _stepPreviewCamera(ctx, target, timeSec) {
  if (!ctx || typeof ctx !== 'object') return target;
  const prev = _previewCameraStates.get(ctx);
  if (!prev || !Number.isFinite(timeSec)) {
    const init = { zoom: target.zoom, cx: target.cx, cy: target.cy, lastTimeSec: Number.isFinite(timeSec) ? timeSec : 0 };
    _previewCameraStates.set(ctx, init);
    return init;
  }
  const rawDt = timeSec - prev.lastTimeSec;
  if (rawDt < -0.05) {
    // Timeline reset (e.g. unit test or fresh session) -> snap immediately
    prev.zoom = target.zoom;
    prev.cx = target.cx;
    prev.cy = target.cy;
    prev.lastTimeSec = timeSec;
    return prev;
  }
  if (rawDt > 0.35) {
    // Modal was closed and reopened -> start gently pulled back for a smooth zoom-in reveal
    prev.zoom = Math.max(1.02, target.zoom * 0.86);
    prev.cx = target.cx;
    prev.cy = target.cy;
    prev.lastTimeSec = timeSec;
    return prev;
  }
  const dt = Math.max(0.008, Math.min(0.06, rawDt || 0.016));
  const k = 1 - Math.exp(-dt * 9.5);
  prev.zoom += (target.zoom - prev.zoom) * k;
  prev.cx += (target.cx - prev.cx) * k;
  prev.cy += (target.cy - prev.cy) * k;
  prev.lastTimeSec = timeSec;
  return prev;
}

/**
 * Draw luminous underwater studio backlighting strictly BEHIND the diver silhouette (v236).
 * Replaces harsh foreground outlines so every piece of gear stays 100% crisp and unobstructed.
 */
function _drawSlotBacklight(ctx, anchor, color, alpha, pulse, scale, timeSec = 0, equipBurst = 0) {
  if (alpha <= 0.01) return;
  const { ax, ay, rx, ry, secondary } = anchor;
  const baseR = Math.max(rx, ry);
  const bloomR = baseR * (2.55 + pulse * 0.16 + equipBurst * 0.85);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // 1. Wide feathered studio atmospheric wash behind the gear piece
  const wash = ctx.createRadialGradient(ax, ay, baseR * 0.08, ax, ay, bloomR);
  wash.addColorStop(0, '#ffffff');
  wash.addColorStop(0.24, color);
  wash.addColorStop(0.58, color);
  wash.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalAlpha = Math.min(0.72, alpha * (0.34 + pulse * 0.06 + equipBurst * 0.28));
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.arc(ax, ay, bloomR, 0, Math.PI * 2);
  ctx.fill();

  // 2. Tighter bright specular rim-core right behind the item silhouette so edges pop cleanly
  const coreR = baseR * (1.28 + pulse * 0.08 + equipBurst * 0.35);
  const core = ctx.createRadialGradient(ax, ay, 2, ax, ay, coreR);
  core.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  core.addColorStop(0.45, color);
  core.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalAlpha = Math.min(0.68, alpha * (0.28 + pulse * 0.05 + equipBurst * 0.26));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(ax, ay, coreR, 0, Math.PI * 2);
  ctx.fill();

  // 3. Soft feathered volumetric backlight rays fanning gently from behind the item
  const rayCount = 5;
  const rayR = bloomR * 1.12;
  const rotBase = timeSec * 0.16;
  ctx.globalAlpha = Math.min(0.28, alpha * (0.07 + pulse * 0.025 + equipBurst * 0.12));
  for (let i = 0; i < rayCount; i++) {
    const a0 = rotBase + (i / rayCount) * Math.PI * 2;
    const rg = ctx.createRadialGradient(ax, ay, baseR * 0.15, ax, ay, rayR);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(0.35, color);
    rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.arc(ax, ay, rayR, a0, a0 + 0.28);
    ctx.closePath();
    ctx.fill();
  }

  // 4. Secondary soft backlight behind fin tips when inspecting/equipping Trim & Fins
  if (secondary) {
    const sR = secondary.r * (2.35 + pulse * 0.16 + equipBurst * 0.6);
    const sg = ctx.createRadialGradient(secondary.ax, secondary.ay, 2, secondary.ax, secondary.ay, sR);
    sg.addColorStop(0, '#ffffff');
    sg.addColorStop(0.32, color);
    sg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = Math.min(0.56, alpha * (0.28 + pulse * 0.05 + equipBurst * 0.22));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(secondary.ax, secondary.ay, sR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw subtle peripheral depth-dimming vignette centered on the focused gear slot (v236).
 */
function _drawFocusVignette(ctx, anchor, w, h, scale, alpha) {
  if (!w || !h || alpha <= 0.01) return;
  const { ax, ay, rx, ry } = anchor;
  const baseR = Math.max(rx, ry);
  const spotR = Math.max(baseR * 2.4, scale * 0.82);
  ctx.save();
  const vig = ctx.createRadialGradient(ax, ay, spotR * 0.52, ax, ay, Math.max(w, h) * 0.85);
  vig.addColorStop(0, 'rgba(2, 8, 20, 0)');
  vig.addColorStop(0.58, `rgba(2, 8, 20, ${(0.14 * alpha).toFixed(3)})`);
  vig.addColorStop(1, `rgba(2, 8, 20, ${(0.28 * alpha).toFixed(3)})`);
  ctx.fillStyle = vig;
  ctx.fillRect(ax - w, ay - h, w * 2, h * 2);
  ctx.restore();
}

/**
 * Draw backlighting + rising luminous motes behind the diver when freshly equipping gear (v236).
 */
function _drawEquipBacklightFx(ctx, sx, sy, scale, equipFx, w = 0, h = 0, timeSec = 0) {
  if (!equipFx || !(equipFx.progress >= 0 && equipFx.progress < 1)) return;
  const t = Math.max(0, Math.min(1, equipFx.progress));
  const slot = equipFx.slot || 'all';
  const color = equipFx.color || '#38bdf8';
  const anchor = _getSlotPreviewAnchor(slot, sx, sy, scale);
  const { ax, ay } = anchor;
  const baseR = Math.max(anchor.rx, anchor.ry);

  const holdAlpha = t < 0.08 ? t / 0.08 : t < 0.76 ? 1 : Math.max(0, (1 - t) / 0.24);
  const pulse = 0.5 + 0.5 * Math.sin(timeSec * 4.5);
  const equipBurst = t < 0.45 ? Math.pow(1 - t / 0.45, 1.55) : 0;

  if (slot !== 'all') {
    _drawFocusVignette(ctx, anchor, w, h, scale, holdAlpha);
  }
  _drawSlotBacklight(ctx, anchor, color, holdAlpha, pulse, scale, timeSec, equipBurst);

  // Soft rising backlight motes drifting behind the silhouette during lock-in
  if (t < 0.55) {
    const bt = t / 0.55;
    const bFade = Math.pow(1 - bt, 1.4);
    const moteCount = equipFx.tier === 'legendary' || equipFx.tier === 'mythic' ? 12 : 8;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < moteCount; i++) {
      const ang = (i / moteCount) * Math.PI * 2 + 0.3;
      const dist = baseR * (0.45 + bt * (1.25 + (i % 3) * 0.25));
      const px = ax + Math.cos(ang) * dist;
      const py = ay + Math.sin(ang) * dist - bt * 12;
      const pr = Math.max(1.0, (1 - bt * 0.6) * (1.7 + (i % 2) * 0.9));
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : color;
      ctx.globalAlpha = bFade * 0.68;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * Draw calm, persistent studio backlighting behind the selected/hovered gear slot (v236).
 */
function _drawInspectBacklightFx(ctx, sx, sy, scale, focusHighlight, w = 0, h = 0, timeSec = 0) {
  if (!focusHighlight || !focusHighlight.slot || focusHighlight.slot === 'all') return;
  const anchor = _getSlotPreviewAnchor(focusHighlight.slot, sx, sy, scale);
  const color = focusHighlight.color || '#38bdf8';
  const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.0);

  _drawFocusVignette(ctx, anchor, w, h, scale, 0.85);
  _drawSlotBacklight(ctx, anchor, color, 0.92, pulse, scale, timeSec, 0);
}

/**
 * Whisper-soft translucent hydro-sheen sweep on full-body equips (zero outlines or rings).
 */
function _drawEquipForegroundSheen(ctx, sx, sy, scale, equipFx) {
  if (!equipFx || !(equipFx.progress >= 0 && equipFx.progress < 0.42)) return;
  const slot = equipFx.slot || 'all';
  if (slot !== 'suit' && slot !== 'trim' && slot !== 'chroma' && slot !== 'all') return;
  const bt = equipFx.progress / 0.42;
  const bFade = Math.pow(1 - bt, 1.5);
  const color = equipFx.color || '#38bdf8';
  const sweepX = sx + 0.72 * scale - bt * (2.25 * scale);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const waveGrad = ctx.createLinearGradient(sweepX - scale * 0.24, sy, sweepX + scale * 0.24, sy);
  waveGrad.addColorStop(0, 'rgba(255,255,255,0)');
  waveGrad.addColorStop(0.5, color);
  waveGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = waveGrad;
  ctx.globalAlpha = bFade * 0.22;
  ctx.fillRect(sweepX - scale * 0.24, sy - scale * 0.52, scale * 0.48, scale * 0.98);
  ctx.restore();
}

/**
 * Draw a clean, borderless frosted-glass corner status caption in screen space (v236).
 * Stays completely off the diver so gear artwork is never obscured by leader lines or boxes.
 */
function _drawPreviewCornerCaption(ctx, w, txt, accentColor, textColor = '#f1f5f9', alpha = 1) {
  if (!txt || alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.font = '800 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  const dotSpace = accentColor ? 12 : 0;
  const tw = Math.min(w - 20, ctx.measureText(txt).width + 20 + dotSpace);
  const pillH = 22;
  ctx.fillStyle = 'rgba(4, 14, 28, 0.72)';
  ctx.beginPath();
  ctx.roundRect?.(10, 10, tw, pillH, 99) ?? ctx.rect(10, 10, tw, pillH);
  ctx.fill();
  if (accentColor) {
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(20, 21, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.beginPath();
  ctx.rect(10, 10, tw - 8, pillH);
  ctx.clip();
  ctx.fillText(txt, 19 + dotSpace, 21.2);
  ctx.restore();
  ctx.restore();
}

/**
 * Shared articulated diver renderer for both the Gear Workshop Test-Tank Preview,
 * the Gear Unlock Showcase Card, and the Home Screen Mini-Avatar Badge (v166 / v211).
 */
export function _drawArticulatedPreviewDiver(
  ctx,
  sx,
  sy,
  scale,
  pal,
  { hasCcr = false, hasDpv = false, hasSpeargun = false, timeSec = 0, sweepAng = 0, animateKick = true, equipFx = null, focusHighlight = null, canvasW = 0, canvasH = 0 } = {}
) {
  const u = scale * 0.55;
  const equipKickBoost = equipFx && equipFx.progress < 0.7 ? Math.sin(equipFx.progress * Math.PI) * 0.35 : 0;
  const kickPower = !animateKick ? 0.12 : (hasDpv ? 0.14 : 0.72) + equipKickBoost;
  const kickPhase = animateKick ? ((timeSec * (hasDpv ? 0.35 : 0.72)) % 1 + 1) % 1 : 0.18;
  const recoveryAmt = _smoothstep(0.35, 0.62, kickPhase) * (1 - _smoothstep(0.68, 0.86, kickPhase)) * kickPower;
  const sweepSpread = _smoothstep(0.56, 0.74, kickPhase) * (1 - _smoothstep(0.84, 0.97, kickPhase)) * kickPower;
  const powerSnap = _smoothstep(0.66, 0.82, kickPhase) * (1 - _smoothstep(0.86, 0.99, kickPhase)) * kickPower;

  // Pelvis in flat cave trim behind shoulders (matches diverBody.js geometry)
  const px = sx - 0.42 * scale;
  const py = sy - 0.03 * scale;
  const torsoAngle = Math.atan2(sy - py, sx - px);

  const computeLeg = (sideSign) => {
    const kneeBack = 0.37 - recoveryAmt * 0.05;
    const kneeUp = 0.01 + sideSign * (0.035 + sweepSpread * 0.10) - recoveryAmt * 0.02;
    const kx = px - kneeBack * scale;
    const ky = py - kneeUp * scale;

    const calfBack = 0.31 - recoveryAmt * 0.08 + powerSnap * 0.05;
    const calfUp = 0.13 + recoveryAmt * 0.09 + sideSign * (0.03 + sweepSpread * 0.11) - powerSnap * 0.06;
    const ax = kx - calfBack * scale;
    const ay = ky - calfUp * scale;

    const finBack = 0.42;
    const finPitch = (recoveryAmt * 0.04 - powerSnap * 0.06) + sideSign * sweepSpread * 0.05;
    const fx = ax - finBack * scale;
    const fy = ay - finPitch * scale;
    const finOpen = Math.max(0.22, Math.min(1.1, 0.55 - recoveryAmt * 0.32 + powerSnap * 0.55));
    return { kx, ky, ax, ay, fx, fy, finOpen };
  };

  const farLeg = computeLeg(1);
  const nearLeg = computeLeg(-1);

  // 1. Far articulated leg (behind torso)
  drawArticulatedDiverLeg(
    ctx, px, py, farLeg.kx, farLeg.ky, farLeg.ax, farLeg.ay, farLeg.fx, farLeg.fy,
    farLeg.finOpen, scale, false, true, pal, timeSec
  );

  // 2. Flexible drysuit spine core + animated trim stripe (identical to CaveRenderer._drawDiver)
  drawDiverLimbSegment(ctx, px, py, sx, sy, 0.36 * scale, pal.suitMid);
  let spineTrimColor = pal.trim;
  if (pal.trimFx === 'selenite-prism') {
    spineTrimColor = `hsl(${Math.round((timeSec * 90) % 360)}, 92%, 78%)`;
  } else if (pal.trimFx === 'foundry-sparks') {
    const glow = 58 + Math.round(Math.sin(timeSec * 6.5) * 14);
    spineTrimColor = `hsl(32, 98%, ${glow}%)`;
  }
  ctx.strokeStyle = spineTrimColor;
  ctx.lineWidth = Math.max(1.4, 0.04 * scale);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(sx, sy);
  ctx.stroke();
  if (pal.trimFx === 'plasma-wave') {
    const pt = ((timeSec * 1.45) % 1 + 1) % 1;
    const wx = sx + (px - sx) * pt;
    const wy = sy + (py - sy) * pt;
    ctx.save();
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(wx, wy, Math.max(2.1, 0.048 * scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 3. Sculpted rig, cylinders/CCR, headgear silhouette, visor & optional DPV scooter
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(torsoAngle);
  drawStyledDiverRig(ctx, u, scale, false, 1, {
    hasCcr,
    hasDpv,
    dpvActive: hasDpv,
    dpvThrusting: hasDpv,
    timeSec,
    liveryPalette: pal,
    equipFx,
  });
  ctx.restore();

  // 4. Near articulated leg (in front of pelvis)
  drawArticulatedDiverLeg(
    ctx, px, py, nearLeg.kx, nearLeg.ky, nearLeg.ax, nearLeg.ay, nearLeg.fx, nearLeg.fy,
    nearLeg.finOpen, scale, false, false, pal, timeSec
  );

  // 5. Articulated arm, glowing wrist dive computer & Goodman-handle primary torch in hand
  const breath = animateKick ? Math.sin(timeSec * 1.7) * 0.02 : 0;
  const hx = sx + (hasDpv ? 0.44 : 0.48) * scale;
  const hy = sy + (hasDpv ? 0.16 : 0.21 + breath) * scale;
  const shoulderX = sx + Math.cos(torsoAngle) * (0.08 * scale);
  const shoulderY = sy + Math.sin(torsoAngle) * (0.08 * scale);
  const elbowX = (shoulderX + hx) * 0.5 + Math.sin(torsoAngle) * (0.12 * scale);
  const elbowY = (shoulderY + hy) * 0.5 + Math.cos(torsoAngle) * (0.12 * scale);
  drawDiverArmAndTorch(
    ctx,
    shoulderX,
    shoulderY,
    elbowX,
    elbowY,
    hx,
    hy,
    sweepAng,
    scale,
    false,
    pal,
    { torchOn: true, hasSpeargun, timeSec }
  );

  // 6. Subtle translucent foreground hydro-sheen only during full-body equip lock-in (zero outlines!)
  if (equipFx) {
    _drawEquipForegroundSheen(ctx, sx, sy, scale, equipFx);
  }

  // Return exact world-space torch lens tip & regulator mouthpiece coords for beam & bubbles
  const lensFwd = (hasSpeargun ? 0.847 : 0.18) * scale;
  const lensDown = (hasSpeargun ? 0.116 : 0) * scale;
  return {
    torchTipX: hx + Math.cos(sweepAng) * lensFwd - Math.sin(sweepAng) * lensDown,
    torchTipY: hy + Math.sin(sweepAng) * lensFwd + Math.cos(sweepAng) * lensDown,
    mouthX: sx + u * 0.68,
    mouthY: sy + u * 0.12,
  };
}

/**
 * Draw animated special torch cone shimmer / caustic ribbons / plasma arcs inside the preview beam.
 */
function _drawAnimatedTorchBeamFx(ctx, torchX, torchY, coneLen, sweepAng, torch, timeSec) {
  const fxId = torch?.fx?.id;
  if (!fxId) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  if (fxId === 'solar-caustic') {
    for (let r = 0; r < 3; r++) {
      const wave = ((timeSec * 0.8 + r / 3) % 1);
      const rad = coneLen * (0.18 + wave * 0.74);
      ctx.strokeStyle = `rgba(254, 240, 138, ${((1 - wave) * 0.34).toFixed(2)})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(torchX, torchY, rad, sweepAng - 0.22, sweepAng + 0.22);
      ctx.stroke();
    }
  } else if (fxId === 'aurora-arc') {
    ctx.strokeStyle = `rgba(125, 211, 252, ${(0.28 + Math.sin(timeSec * 4.2) * 0.12).toFixed(2)})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(torchX, torchY);
    ctx.quadraticCurveTo(
      torchX + Math.cos(sweepAng - 0.08) * coneLen * 0.5,
      torchY + Math.sin(sweepAng - 0.08) * coneLen * 0.5 + Math.sin(timeSec * 3.6) * 8,
      torchX + Math.cos(sweepAng) * coneLen * 0.88,
      torchY + Math.sin(sweepAng) * coneLen * 0.88
    );
    ctx.stroke();
  } else if (fxId === 'hunter-plasma') {
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 6.0);
    ctx.strokeStyle = `rgba(251, 113, 133, ${(0.24 + pulse * 0.26).toFixed(2)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(torchX, torchY, 10 + pulse * 14, sweepAng - 0.55, sweepAng + 0.55);
    ctx.stroke();
  } else if (fxId === 'uv-fluorescence') {
    for (let i = 0; i < 8; i++) {
      const d = ((i * 0.14 + timeSec * 0.28) % 0.82) + 0.14;
      const spread = Math.sin(i * 2.7 + timeSec * 2.2) * 0.19;
      const fx = torchX + Math.cos(sweepAng + spread) * coneLen * d;
      const fy = torchY + Math.sin(sweepAng + spread) * coneLen * d;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(216, 180, 254, 0.72)' : 'rgba(103, 232, 249, 0.72)';
      ctx.beginPath();
      ctx.arc(fx, fy, 1.8 + (i % 2) * 1.0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Render a live animated "Test Tank" diorama preview of the customized diver rig + torch beam
 * across Clear Water, Silt Haze (backscatter comparison), or Night Bioluminescence environments (v153 / v166 / v211 / v236).
 * Smoothly zooms onto selected/equipped gear slots with luminous backlighting strictly behind the diver.
 */
export function drawLiveryPreview(
  ctx,
  w,
  h,
  livery,
  { hasCcr = false, hasDpv = false, hasSpeargun = false, envMode = 'clear', timeSec = 0, equipFx = null, focusHighlight = null, previewLockedLabel = '' } = {}
) {
  if (!ctx || !w || !h) return;
  const pal = resolveDiverLiveryPalette(livery);
  const { torch } = pal;
  const isSilt = envMode === 'silt';
  const isNight = envMode === 'night';

  ctx.save();
  // Aquatic test-tank backdrop tuned by selected environment mode
  const bg = ctx.createLinearGradient(0, 0, w, h);
  if (isNight) {
    bg.addColorStop(0, '#020617');
    bg.addColorStop(0.55, '#07142b');
    bg.addColorStop(1, '#01040c');
  } else if (isSilt) {
    bg.addColorStop(0, '#141914');
    bg.addColorStop(0.55, '#1e251a');
    bg.addColorStop(1, '#0d120e');
  } else {
    bg.addColorStop(0, '#041224');
    bg.addColorStop(0.55, '#07223a');
    bg.addColorStop(1, '#020914');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle depth-grid ruler ticks along back glass wall
  ctx.strokeStyle = isNight ? 'rgba(56, 189, 248, 0.08)' : 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 1;
  for (let gx = 48; gx < w; gx += 48) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }

  // Drifting aquatic particles (clear dust, warm silt clouds, or glowing cyan biolum motes)
  const partCount = isSilt ? 28 : isNight ? 24 : 16;
  for (let i = 0; i < partCount; i++) {
    const px = (((i * 67 + timeSec * (isSilt ? 9 : 14)) % w) + w) % w;
    const py = (((i * 41 + Math.sin(timeSec + i) * 8) % h) + h) % h;
    if (isNight) {
      const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(timeSec * 3.1 + i * 1.4));
      ctx.fillStyle = i % 3 === 0 ? `rgba(52, 211, 153, ${(0.55 * pulse).toFixed(2)})` : `rgba(56, 189, 248, ${(0.62 * pulse).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.3 + (i % 2) * 0.9, 0, Math.PI * 2);
      ctx.fill();
    } else if (isSilt) {
      ctx.fillStyle = 'rgba(180, 154, 114, 0.22)';
      ctx.beginPath();
      ctx.arc(px, py, 2.8 + (i % 4) * 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
      ctx.beginPath();
      ctx.arc(px, py, 1.2 + (i % 2) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Subtle spring buoyancy recoil when new gear locks onto the avatar
  const recoilY = equipFx && equipFx.progress < 1 ? Math.sin(equipFx.progress * Math.PI * 2.2) * (1 - equipFx.progress) * 4.5 : 0;

  // Frame the full articulated in-game diver (fin tips to outstretched torch hand) cleanly inside tank
  const scale = Math.min(w * 0.215, h * 0.56);
  const sx = w * 0.445;
  const syBase = h * 0.54;
  const sy = syBase + Math.sin(timeSec * 1.8) * 3.4 + recoilY;
  const sweepAng = Math.sin(timeSec * 1.15) * 0.08;
  const breath = Math.sin(timeSec * 1.7) * 0.02;
  const hxPre = sx + (hasDpv ? 0.44 : 0.48) * scale;
  const hyPre = sy + (hasDpv ? 0.16 : 0.21 + breath) * scale;
  const lensFwd = (hasSpeargun ? 0.847 : 0.18) * scale;
  const lensDown = (hasSpeargun ? 0.116 : 0) * scale;
  const torchX = hxPre + Math.cos(sweepAng) * lensFwd - Math.sin(sweepAng) * lensDown;
  const torchY = hyPre + Math.sin(sweepAng) * lensFwd + Math.cos(sweepAng) * lensDown;

  // Smooth camera zoom & focus pan onto selected / equipped gear slot (v236)
  const activeSlot = equipFx?.slot || focusHighlight?.slot || null;
  const camTarget = _resolvePreviewCameraTarget(activeSlot, sx, syBase, scale, w, h, equipFx);
  const cam = _stepPreviewCamera(ctx, camTarget, timeSec);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  ctx.translate(w * 0.50, h * 0.52);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.cx, -cam.cy);

  // Volumetric torch cone preview (with optical ignition flare when torch is freshly equipped!)
  const torchIgniteScale =
    equipFx && (equipFx.slot === 'torch' || equipFx.slot === 'all')
      ? Math.max(0.15, _easeOutBack(Math.min(1, equipFx.progress * 1.55)))
      : 1;
  const siltPenalty = isSilt ? Math.max(0.45, 0.68 + (torch.siltPierce || 0) * 1.05) : 1.0;
  const coneLen = w * 0.46 * torch.rangeMult * siltPenalty * torchIgniteScale;
  const coneGrad = ctx.createRadialGradient(torchX, torchY, 4, torchX + coneLen * 0.45, torchY, Math.max(8, coneLen * 0.68));
  const coreAlpha = isNight ? 0.78 : isSilt ? 0.56 + (torch.siltPierce || 0) * 0.55 : 0.62;
  coneGrad.addColorStop(0, `rgba(${torch.coreRgb}, ${Math.min(0.94, coreAlpha).toFixed(2)})`);
  coneGrad.addColorStop(0.38, `rgba(${torch.shaftRgb}, ${(isNight ? 0.36 : 0.26).toFixed(2)})`);
  coneGrad.addColorStop(1, `rgba(${torch.shaftRgb}, 0)`);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(torchX, torchY);
  ctx.arc(torchX, torchY, coneLen, sweepAng - 0.26, sweepAng + 0.26);
  ctx.closePath();
  ctx.fill();
  if (isSilt) {
    const glareAlpha = Math.max(0.06, 0.28 - (torch.siltPierce || 0) * 0.72);
    ctx.fillStyle = `rgba(214, 198, 170, ${glareAlpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(torchX + coneLen * 0.22, torchY, coneLen * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  _drawAnimatedTorchBeamFx(ctx, torchX, torchY, coneLen, sweepAng, torch, timeSec);

  // Rising regulator exhaust bubbles (or whisper-fine CCR loop bubbles)
  const u = scale * 0.55;
  const bubCount = hasCcr ? 3 : 7;
  for (let b = 0; b < bubCount; b++) {
    const phase = ((timeSec * (hasCcr ? 0.55 : 0.85) + b / bubCount) % 1);
    const bx = sx + u * 0.66 + Math.sin(timeSec * 3.4 + b * 2.1) * 5 - phase * 14;
    const by = sy + u * 0.08 - phase * (h * 0.54);
    const br = hasCcr ? 1.5 + phase * 1.4 : 2.2 + phase * 3.0;
    ctx.fillStyle = `rgba(224, 242, 254, ${((1 - phase) * (hasCcr ? 0.45 : 0.7)).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw subtle ambient Set Synergy / Mythic aura behind the diver in the Test Tank (v212)
  if (pal.wakeProfile?.active) {
    const wp = pal.wakeProfile;
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.2);
    const auraR = scale * (wp.isSetAura ? 1.15 : 0.92);
    const ag = ctx.createRadialGradient(sx - scale * 0.15, sy, scale * 0.12, sx - scale * 0.15, sy, auraR);
    ag.addColorStop(0, `rgba(${wp.auraRgb}, ${(wp.isSetAura ? 0.24 + pulse * 0.1 : 0.14 + pulse * 0.06).toFixed(2)})`);
    ag.addColorStop(1, `rgba(${wp.auraRgb}, 0)`);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(sx - scale * 0.15, sy, auraR, 0, Math.PI * 2);
    ctx.fill();
    if (wp.isSetAura) {
      // Full-Set Capstone double-orbit prestige arcs (v216)
      ctx.strokeStyle = `rgba(${wp.auraRgb}, ${(0.24 + pulse * 0.18).toFixed(2)})`;
      ctx.lineWidth = 1.4;
      const rot = timeSec * 1.15;
      ctx.beginPath();
      ctx.arc(sx - scale * 0.1, sy, scale * 0.94, rot, rot + Math.PI * 0.62);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx - scale * 0.1, sy, scale * 0.94, rot + Math.PI, rot + Math.PI * 1.62);
      ctx.stroke();
    }
    // Subtle drifting rarity wake particles behind fin tips in the test tank
    const finTailX = sx - scale * 1.48;
    for (let k = 0; k < 6; k++) {
      const ph = ((timeSec * 0.85 + k / 6) % 1);
      const wx = finTailX - ph * scale * 0.72;
      const wy = sy + Math.sin(timeSec * 3.8 + k * 1.9) * scale * 0.18 - (wp.rising ? ph * scale * 0.42 : 0);
      const hue = wp.prism ? Math.round((timeSec * 120 + k * 55) % 360) : (k % 2 === 0 ? wp.hueA : wp.hueB);
      ctx.fillStyle = `hsla(${hue}, 96%, 72%, ${((1 - ph) * 0.72).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(wx, wy, 1.8 + (1 - ph) * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Luminous studio backlighting strictly BEHIND the diver for selected / equipped gear (v236)
  if (equipFx) {
    _drawEquipBacklightFx(ctx, sx, sy, scale, equipFx, w, h, timeSec);
  } else if (focusHighlight) {
    _drawInspectBacklightFx(ctx, sx, sy, scale, focusHighlight, w, h, timeSec);
  }

  // Draw the exact 1:1 in-game articulated diver crisp & unobstructed in front of the backlight
  _drawArticulatedPreviewDiver(ctx, sx, sy, scale, pal, {
    hasCcr,
    hasDpv,
    hasSpeargun,
    timeSec,
    sweepAng,
    animateKick: true,
    equipFx,
    focusHighlight: null,
    canvasW: w,
    canvasH: h,
  });

  ctx.restore();

  // Top-left borderless frosted status caption in crisp screen space (never overlaps diver gear)
  if (previewLockedLabel) {
    _drawPreviewCornerCaption(ctx, w, `🔒 Try-On · ${previewLockedLabel}`, '#facc15', '#fde047', 1);
  } else if (equipFx && equipFx.itemName && equipFx.progress < 0.98) {
    const pillAlpha = Math.min(1, (1 - equipFx.progress) * 2.4);
    const slotAnchor = equipFx.slot && equipFx.slot !== 'all' ? _getSlotPreviewAnchor(equipFx.slot, sx, syBase, scale) : null;
    const prefix = equipFx.isPreview ? 'Preview' : slotAnchor ? slotAnchor.label : 'Equipped';
    _drawPreviewCornerCaption(ctx, w, `${prefix} · ${equipFx.itemName}`, equipFx.color || '#38bdf8', '#f8fafc', pillAlpha);
  } else if (focusHighlight && focusHighlight.slot && focusHighlight.slot !== 'all') {
    const slotAnchor = _getSlotPreviewAnchor(focusHighlight.slot, sx, syBase, scale);
    const kicker = focusHighlight.kicker || slotAnchor.label;
    const label = focusHighlight.label || '';
    const txt = label ? `${kicker} · ${label}` : kicker;
    _drawPreviewCornerCaption(ctx, w, txt, focusHighlight.color || '#38bdf8', '#f1f5f9', 0.96);
  } else if (pal.setSynergy) {
    const set = pal.setSynergy;
    _drawPreviewCornerCaption(ctx, w, `${set.icon} ${set.auraName}`, set.color, set.color, 0.96);
  }
  ctx.restore();
}

/**
 * Hero collector-card renderer for newly unlocked gear reveals (v211 / v236):
 * renders rarity-tuned rotating god-rays, floating shimmer particles, zoomed backlit diver avatar
 * wearing the unlocked piece, and full kinetic equip-snap animation with zero foreground outlines.
 */
export function drawGearShowcasePreview(
  ctx,
  w,
  h,
  livery,
  { tier = 'rare', hasCcr = false, hasDpv = false, hasSpeargun = false, timeSec = 0, equipFx = null, focusHighlight = null } = {}
) {
  if (!ctx || !w || !h) return;
  const tierMeta = getGearTierMeta(tier);
  const pal = resolveDiverLiveryPalette(livery);
  const { torch } = pal;

  ctx.save();
  // Deep theatrical vault backdrop
  const bg = ctx.createRadialGradient(w * 0.48, h * 0.5, 12, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
  bg.addColorStop(0, tierMeta.bg);
  bg.addColorStop(0.55, '#071426');
  bg.addColorStop(1, '#020612');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Rotating rarity light rays behind the diver
  ctx.save();
  ctx.translate(w * 0.48, h * 0.52);
  ctx.rotate(timeSec * (tierMeta.rank >= 4 ? 0.34 : 0.2));
  ctx.globalCompositeOperation = 'screen';
  const rayCount = tierMeta.rank >= 5 ? 12 : tierMeta.rank >= 4 ? 10 : 8;
  for (let i = 0; i < rayCount; i++) {
    const a0 = (i / rayCount) * Math.PI * 2;
    const rg = ctx.createRadialGradient(0, 0, 8, 0, 0, Math.max(w, h) * 0.65);
    rg.addColorStop(0, tierMeta.glow);
    rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rg;
    ctx.globalAlpha = tierMeta.rank >= 4 ? 0.24 : 0.16;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, Math.max(w, h) * 0.65, a0, a0 + 0.18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Floating rarity shimmer motes
  const moteCount = tierMeta.rank >= 4 ? 26 : 16;
  for (let i = 0; i < moteCount; i++) {
    const mx = (((i * 73 + timeSec * (12 + (i % 3) * 6)) % w) + w) % w;
    const my = (((i * 47 - timeSec * (16 + (i % 4) * 5)) % h) + h) % h;
    const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(timeSec * 3.6 + i * 1.7));
    ctx.fillStyle = i % 3 === 0 ? '#ffffff' : tierMeta.color;
    ctx.globalAlpha = pulse * 0.72;
    ctx.beginPath();
    ctx.arc(mx, my, 1.2 + (i % 3) * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Diver hero scale + kinetic recoil + smooth focus zoom onto the unlocked slot
  const recoilY = equipFx && equipFx.progress < 1 ? Math.sin(equipFx.progress * Math.PI * 2.2) * (1 - equipFx.progress) * 5.2 : 0;
  const scale = Math.min(w * 0.24, h * 0.60);
  const sx = w * 0.47;
  const syBase = h * 0.54;
  const sy = syBase + Math.sin(timeSec * 2.0) * 3.8 + recoilY;
  const sweepAng = Math.sin(timeSec * 1.25) * 0.08;
  const hxPre = sx + (hasDpv ? 0.44 : 0.48) * scale;
  const hyPre = sy + (hasDpv ? 0.16 : 0.21) * scale;
  const lensFwd = (hasSpeargun ? 0.847 : 0.18) * scale;
  const lensDown = (hasSpeargun ? 0.116 : 0) * scale;
  const torchX = hxPre + Math.cos(sweepAng) * lensFwd - Math.sin(sweepAng) * lensDown;
  const torchY = hyPre + Math.sin(sweepAng) * lensFwd + Math.cos(sweepAng) * lensDown;

  const activeSlot = equipFx?.slot || focusHighlight?.slot || null;
  const rawTarget = _resolvePreviewCameraTarget(activeSlot, sx, syBase, scale, w, h, equipFx);
  // Showcase card is already generously zoomed, so cap extra zoom gently for full hero framing
  const camTarget = { zoom: Math.min(1.42, 1 + (rawTarget.zoom - 1) * 0.62), cx: rawTarget.cx, cy: rawTarget.cy };
  const cam = _stepPreviewCamera(ctx, camTarget, timeSec);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  ctx.translate(w * 0.50, h * 0.52);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.cx, -cam.cy);

  const coneLen = w * 0.44 * torch.rangeMult;
  const coneGrad = ctx.createRadialGradient(torchX, torchY, 4, torchX + coneLen * 0.45, torchY, coneLen * 0.68);
  coneGrad.addColorStop(0, `rgba(${torch.coreRgb}, 0.8)`);
  coneGrad.addColorStop(0.4, `rgba(${torch.shaftRgb}, 0.28)`);
  coneGrad.addColorStop(1, `rgba(${torch.shaftRgb}, 0)`);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(torchX, torchY);
  ctx.arc(torchX, torchY, coneLen, sweepAng - 0.25, sweepAng + 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  _drawAnimatedTorchBeamFx(ctx, torchX, torchY, coneLen, sweepAng, torch, timeSec);

  // Studio backlighting strictly behind the unlocked gear slot
  if (equipFx) {
    _drawEquipBacklightFx(ctx, sx, sy, scale, equipFx, w, h, timeSec);
  } else if (focusHighlight) {
    _drawInspectBacklightFx(ctx, sx, sy, scale, focusHighlight, w, h, timeSec);
  }

  _drawArticulatedPreviewDiver(ctx, sx, sy, scale, pal, {
    hasCcr,
    hasDpv,
    hasSpeargun,
    timeSec,
    sweepAng,
    animateKick: true,
    equipFx,
    focusHighlight: null,
    canvasW: w,
    canvasH: h,
  });

  ctx.restore();
  ctx.restore();
}

/**
 * Render a crisp compact articulated diver portrait badge for the Home Screen & Co-op Lobby (v153 / v166).
 */
export function drawMiniDiverAvatar(ctx, w, h, livery, { hasCcr = false, hasDpv = false } = {}) {
  if (!ctx || !w || !h) return;
  const pal = resolveDiverLiveryPalette(livery);
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#071a30');
  bg.addColorStop(1, '#020b16');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const scale = Math.min(w * 0.34, h * 0.64);
  const sx = w * 0.61;
  const sy = h * 0.56;
  const torchX = sx + (hasDpv ? 0.44 : 0.48) * scale + 0.18 * scale;
  const torchY = sy + (hasDpv ? 0.16 : 0.21) * scale;

  // Subtle torch glow wedge emanating from hand torch
  ctx.fillStyle = `rgba(${pal.torch.shaftRgb}, 0.28)`;
  ctx.beginPath();
  ctx.moveTo(torchX, torchY);
  ctx.lineTo(w + 4, Math.max(0, torchY - h * 0.38));
  ctx.lineTo(w + 4, Math.min(h, torchY + h * 0.38));
  ctx.closePath();
  ctx.fill();

  _drawArticulatedPreviewDiver(ctx, sx, sy, scale, pal, {
    hasCcr,
    hasDpv,
    timeSec: 0,
    sweepAng: 0,
    animateKick: false,
  });
  ctx.restore();
}

/**
 * Render a live animated underwater Squad & Co-op Staging Bay showing 1–4 divers
 * hovering side-by-side in their real articulated rigs, animated special gear FX,
 * Set Synergy auras, torch beams, callsigns & role/ready badges (v213).
 */
export function drawSquadStagingLineup(
  ctx,
  w,
  h,
  members = [],
  { timeSec = 0, title = 'SQUAD STAGING BAY' } = {}
) {
  if (!ctx || !w || !h) return;
  const crew = Array.isArray(members) && members.length > 0 ? members.slice(0, 4) : [];
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // Deep illuminated aquatic staging bay backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#04162c');
  bg.addColorStop(0.55, '#072440');
  bg.addColorStop(1, '#020b18');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Soft overhead staging sunbeams
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++) {
    const bx = w * (0.14 + i * 0.24) + Math.sin(timeSec * 0.55 + i * 1.6) * 14;
    const rg = ctx.createLinearGradient(bx, 0, bx + 28, h);
    rg.addColorStop(0, 'rgba(125, 211, 252, 0.14)');
    rg.addColorStop(1, 'rgba(125, 211, 252, 0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(bx - 18, 0);
    ctx.lineTo(bx + 18, 0);
    ctx.lineTo(bx + 46, h);
    ctx.lineTo(bx - 2, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Ambient rising micro-bubbles across the staging bay
  for (let i = 0; i < 16; i++) {
    const bx = (((i * 71 + Math.sin(timeSec * 1.4 + i) * 9) % w) + w) % w;
    const by = (((i * 37 - timeSec * (12 + (i % 3) * 5)) % h) + h) % h;
    ctx.fillStyle = 'rgba(186, 230, 253, 0.24)';
    ctx.beginPath();
    ctx.arc(bx, by, 1.1 + (i % 2) * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Top-left staging header kicker
  ctx.font = '800 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = 'rgba(125, 211, 252, 0.82)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`🤿 ${title.toUpperCase()} · ${crew.length} DIVER${crew.length === 1 ? '' : 'S'}`, 10, 8);

  const count = Math.max(1, crew.length);
  const slotW = w / count;
  const diverScale = Math.min(slotW * 0.26, h * 0.34, 42);

  for (let i = 0; i < crew.length; i++) {
    const m = crew[i];
    const pal = resolveDiverLiveryPalette(m.livery || null);
    const cx = slotW * (i + 0.52);
    const bob = Math.sin(timeSec * 1.9 + i * 1.45) * 3.2;
    const cy = h * 0.50 + bob;
    const sweepAng = Math.sin(timeSec * 1.1 + i * 1.2) * 0.06;

    // Subtle Set Synergy / Mythic aura glow behind each squad member
    if (pal.wakeProfile?.active) {
      const wp = pal.wakeProfile;
      const ar = diverScale * (wp.isSetAura ? 1.15 : 0.9);
      const ag = ctx.createRadialGradient(cx - diverScale * 0.12, cy, 4, cx - diverScale * 0.12, cy, ar);
      ag.addColorStop(0, `rgba(${wp.auraRgb}, ${wp.isSetAura ? 0.28 : 0.16})`);
      ag.addColorStop(1, `rgba(${wp.auraRgb}, 0)`);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(cx - diverScale * 0.12, cy, ar, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Interactive Staging Bay Emote timing (v214: torch beam check & 👌 OK wave!)
    const nowMs = Number.isFinite(m.nowMs) ? m.nowMs : Date.now();
    const emoteAgeSec = m.stagingEmote?.at ? Math.max(0, (nowMs - m.stagingEmote.at) / 1000) : 99;
    const isTorchFlash = m.stagingEmote?.kind === 'torch' && emoteAgeSec < 2.2;
    const isOkWave = m.stagingEmote?.kind === 'ok' && emoteAgeSec < 2.4;
    const activeSweep = isTorchFlash ? Math.sin(emoteAgeSec * 14) * 0.24 : sweepAng;
    const flashBoost = isTorchFlash ? 1.55 + 0.45 * Math.abs(Math.sin(emoteAgeSec * 16)) : 1.0;

    // Compact torch cone (flares dramatically on interactive Beam Check!)
    const torchX = cx + (m.hasDpv ? 0.44 : 0.48) * diverScale + 0.18 * diverScale;
    const torchY = cy + (m.hasDpv ? 0.16 : 0.21) * diverScale;
    const coneLen = Math.min(slotW * 0.48, diverScale * 2.15 * (isTorchFlash ? 1.32 : 1)) * (pal.torch?.rangeMult || 1);
    const cg = ctx.createRadialGradient(torchX, torchY, 2, torchX + coneLen * 0.45, torchY, coneLen * 0.78);
    cg.addColorStop(0, `rgba(${pal.torch.coreRgb}, ${Math.min(0.98, 0.64 * flashBoost).toFixed(2)})`);
    cg.addColorStop(0.45, `rgba(${pal.torch.shaftRgb}, ${Math.min(0.65, 0.22 * flashBoost).toFixed(2)})`);
    cg.addColorStop(1, `rgba(${pal.torch.shaftRgb}, 0)`);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(torchX, torchY);
    ctx.arc(torchX, torchY, coneLen, activeSweep - (isTorchFlash ? 0.31 : 0.24), activeSweep + (isTorchFlash ? 0.31 : 0.24));
    ctx.closePath();
    ctx.fill();
    if (isTorchFlash) {
      const fg = ctx.createRadialGradient(torchX, torchY, 1, torchX, torchY, diverScale * 0.72);
      fg.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
      fg.addColorStop(0.45, `rgba(${pal.torch.coreRgb}, 0.52)`);
      fg.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(torchX, torchY, diverScale * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    _drawArticulatedPreviewDiver(ctx, cx, cy, diverScale, pal, {
      hasCcr: Boolean(m.hasCcr),
      hasDpv: Boolean(m.hasDpv),
      timeSec: timeSec + i * 0.7,
      sweepAng: activeSweep,
      animateKick: true,
    });

    // Floating emote pill above diver on interactive Wave OK or Beam Check
    if (isOkWave || isTorchFlash) {
      const fade = Math.min(1, ((isOkWave ? 2.4 : 2.2) - emoteAgeSec) / 0.45);
      const lift = emoteAgeSec * 4.5;
      const badgeY = Math.max(22, cy - diverScale * 0.72 - lift);
      const badgeTxt = isOkWave ? '👌 OK!' : '🔦 BEAM CHECK';
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, fade));
      ctx.font = '800 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      const tw = ctx.measureText(badgeTxt).width + 14;
      ctx.fillStyle = isOkWave ? 'rgba(6, 78, 59, 0.9)' : 'rgba(30, 41, 59, 0.92)';
      ctx.strokeStyle = isOkWave ? '#4ade80' : '#facc15';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect?.(slotW * (i + 0.5) - tw * 0.5, badgeY - 9, tw, 18, 9) ??
        ctx.rect(slotW * (i + 0.5) - tw * 0.5, badgeY - 9, tw, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isOkWave ? '#bbf7d0' : '#fef08a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeTxt, slotW * (i + 0.5), badgeY);
      ctx.restore();
    }

    // Nameplate & ready/role subtitle beneath each diver
    const STAGING_ROLE_ICONS = { balanced: '🤿', navigator: '🧭', engineer: '⚙️', safety: '🩺' };
    const roleIcon = STAGING_ROLE_ICONS[m.crewRoleId] || '';
    const labelY = h - 22;
    const roleTxt = m.role ? ` · ${m.role}` : '';
    const statusDot = m.ready === false ? '#fbbf24' : '#4ade80';
    ctx.font = '800 10.5px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    const namePrefix = roleIcon && m.crewRoleId && m.crewRoleId !== 'balanced' ? `${roleIcon} ` : '';
    ctx.fillText(`${namePrefix}${String(m.name || 'Diver').slice(0, 14)}`, slotW * (i + 0.5), labelY);

    ctx.font = '700 8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = pal.setSynergy ? pal.setSynergy.color : '#94a3b8';
    const subTxt = pal.setSynergy
      ? `${pal.setSynergy.icon} ${pal.setSynergy.auraName}`
      : `${pal.suit.name}${roleTxt}`;
    ctx.fillText(subTxt.slice(0, 22), slotW * (i + 0.5), labelY + 12);

    // Status LED dot
    ctx.fillStyle = statusDot;
    ctx.beginPath();
    ctx.arc(slotW * (i + 0.5) - Math.min(slotW * 0.36, 46), labelY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

const STAGING_ROLE_META = {
  balanced: { icon: '🤿', label: 'Standard' },
  navigator: { icon: '🧭', label: 'Navigator' },
  engineer: { icon: '⚙️', label: 'Engineer' },
  safety: { icon: '🩺', label: 'Safety' },
};

/**
 * Summarize active Crew Roles & Gear Set Synergies for the Co-op Staging Bay coverage strip (v214).
 */
export function summarizeSquadStagingCoverage(members = []) {
  const crew = Array.isArray(members) ? members : [];
  const roleSet = new Set();
  const roleBadges = [];
  const synergyNames = [];
  for (let i = 0; i < crew.length; i++) {
    const m = crew[i];
    if (!m) continue;
    const rid = STAGING_ROLE_META[m.crewRoleId] ? m.crewRoleId : 'balanced';
    if (rid !== 'balanced' && !roleSet.has(rid)) {
      roleSet.add(rid);
      roleBadges.push(`${STAGING_ROLE_META[rid].icon} ${STAGING_ROLE_META[rid].label}`);
    }
    const syn = evaluateGearSetSynergy(m.livery || null);
    if (syn?.active && !synergyNames.includes(syn.active.auraName)) {
      synergyNames.push(`${syn.active.icon} ${syn.active.auraName}`);
    }
  }
  const parts = [];
  if (roleBadges.length > 0) parts.push(roleBadges.join(' · '));
  else parts.push('🤿 Standard Crew — tap Role to specialize');
  if (synergyNames.length > 0) parts.push(`✦ ${synergyNames.length} Set Aura${synergyNames.length > 1 ? 's' : ''}`);
  return {
    uniqueSpecialtyRoles: roleSet.size,
    roleBadges,
    setSynergyCount: synergyNames.length,
    synergyNames,
    summaryText: parts.join('  |  '),
  };
}
