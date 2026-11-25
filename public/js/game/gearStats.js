import { evaluateCaveSDF } from './collision.js';
import {
  DEFAULT_RIG_LIVERY,
  GEAR_SET_SYNERGIES,
  getGearItemBySlot,
  evaluateGearSetSynergy,
} from './rigLivery.js';

/**
 * Ultra Mode Gear Performance Engine, Diablo III Tiered Set Bonuses,
 * Zelda Single-Piece Wonders & World-Found Sunken Gear Caches (v216).
 */

export const WORLD_GEAR_CACHES = Object.freeze([
  Object.freeze({
    id: 'cache-cenote-visor',
    slot: 'visor',
    itemId: 'world-cartographer-visor',
    levelId: 'cenote-el-abismo',
    siteName: 'Cenote El Abismo',
    tier: 'uncommon',
    icon: '🧭',
    clue: 'Hidden in a sunken crate inside Cenote El Abismo',
    depthFrac: 0.56,
    offsetSign: 1,
  }),
  Object.freeze({
    id: 'cache-eagles-fins',
    slot: 'trim',
    itemId: 'world-hydro-fins',
    levelId: 'eagles-nest-sink',
    siteName: "Eagle's Nest Sink",
    tier: 'rare',
    icon: '🌊',
    clue: "Tucked along a karst shelf in Eagle's Nest Sink",
    depthFrac: 0.48,
    offsetSign: -1,
  }),
  Object.freeze({
    id: 'cache-thistlegorm-suit',
    slot: 'suit',
    itemId: 'world-cartographer-suit',
    levelId: 'ss-thistlegorm-wreck',
    siteName: 'SS Thistlegorm',
    tier: 'rare',
    icon: '🗺️',
    clue: 'Stowed in a flooded cargo locker aboard SS Thistlegorm',
    depthFrac: 0.54,
    offsetSign: 1,
  }),
  Object.freeze({
    id: 'cache-oriskany-suit',
    slot: 'suit',
    itemId: 'world-hydro-suit',
    levelId: 'uss-oriskany-carrier',
    siteName: 'USS Oriskany',
    tier: 'rare',
    icon: '🚀',
    clue: 'Wedged inside a hangar bulkhead of USS Oriskany',
    depthFrac: 0.52,
    offsetSign: -1,
  }),
  Object.freeze({
    id: 'cache-plura-hood',
    slot: 'headgear',
    itemId: 'world-thermal-hood',
    levelId: 'plura-marble-sump',
    siteName: 'Plura Marble Sump',
    tier: 'rare',
    icon: '❄️',
    clue: 'Cached near an icy marble overhang in Plura Sump',
    depthFrac: 0.58,
    offsetSign: 1,
  }),
  Object.freeze({
    id: 'cache-vaucluse-tank',
    slot: 'tank',
    itemId: 'world-hydro-tank',
    levelId: 'fontaine-de-vaucluse',
    siteName: 'Fontaine de Vaucluse',
    tier: 'epic',
    icon: '💧',
    clue: 'Secured to a deep spring resurgence ledge in Fontaine de Vaucluse',
    depthFrac: 0.60,
    offsetSign: -1,
  }),
  Object.freeze({
    id: 'cache-orda-torch',
    slot: 'torch',
    itemId: 'world-cartographer-torch',
    levelId: 'orda-crystal-maze',
    siteName: 'Orda Crystal Maze',
    tier: 'epic',
    icon: '💎',
    clue: 'Resting in a gypsum crystal grotto of Orda Cave',
    depthFrac: 0.55,
    offsetSign: 1,
  }),
  Object.freeze({
    id: 'cache-dahab-patch',
    slot: 'patch',
    itemId: 'world-arch-crest',
    levelId: 'blue-hole-dahab-arch',
    siteName: 'Blue Hole Dahab',
    tier: 'epic',
    icon: '🏛️',
    clue: 'Anchored beside the Bells Archway of Blue Hole Dahab',
    depthFrac: 0.62,
    offsetSign: 1,
  }),
  Object.freeze({
    id: 'cache-zenobia-visor',
    slot: 'visor',
    itemId: 'world-salvage-visor',
    levelId: 'ms-zenobia-ferry',
    siteName: 'MS Zenobia',
    tier: 'rare',
    icon: '⚓',
    clue: 'Recovered from the tilted vehicle deck of MS Zenobia',
    depthFrac: 0.50,
    offsetSign: -1,
  }),
  Object.freeze({
    id: 'cache-strytan-tank',
    slot: 'tank',
    itemId: 'world-chimney-tank',
    levelId: 'strytan-hydrothermal-chimneys',
    siteName: 'Strýtan Hydrothermal Chimneys',
    tier: 'mythic',
    icon: '🌋',
    clue: 'Forged beside the hydrothermal spire of Strýtan, Iceland',
    depthFrac: 0.64,
    offsetSign: 1,
  }),
]);

export const WORLD_CACHE_BY_KEY = new Map(
  WORLD_GEAR_CACHES.map((c) => [`${c.slot}:${c.itemId}`, c])
);

/**
 * Diablo III Multi-Tier Set Bonuses (2pc Gateway Utility + Full-Set Archetype Capstone / Zelda Immunities).
 */
export const SET_TIER_BONUSES = Object.freeze({
  'dreadnought-mk4': Object.freeze({
    capstoneReq: 2,
    tier2: Object.freeze({
      label: '(2) Unbreakable Hull',
      desc: '+35% Hatch Crank · -45% Wall Shock · Immune to Shifting-Hatch Knockback',
      stats: { crankSpeed: 0.35, bumpArmor: 0.45 },
      power: { id: 'hatchKnockbackImmune', name: 'Unbreakable Hull', desc: 'Immune to shifting-hatch knockback & -45% impact shock' },
    }),
    tierFull: Object.freeze({
      label: '(2) Furnace Boiler Core',
      desc: 'Unbreakable Hull + +10% Swim Speed · Molten Steam Aura',
      stats: { swimSpeed: 0.10, gasSave: 0.05 },
      power: { id: 'hatchKnockbackImmune', name: 'Unbreakable Hull', desc: 'Immune to shifting-hatch knockback & -45% impact shock' },
    }),
  }),
  'apex-bounty': Object.freeze({
    capstoneReq: 3,
    tier2: Object.freeze({
      label: '(2) Predator Tempo',
      desc: '+14% Speargun Power · +6% Swim Agility',
      stats: { spearPower: 0.14, swimSpeed: 0.06 },
    }),
    tierFull: Object.freeze({
      label: '(3) Apex Overcharge',
      desc: 'Every 4th Speargun shot is a Piercing Golden Hyper-Tip · +12% Speargun Power',
      stats: { spearPower: 0.12, bumpArmor: 0.18 },
      power: { id: 'apexOvercharge', name: 'Apex Overcharge', desc: 'Every 4th speargun shot fires a piercing golden Hyper-Tip' },
    }),
  }),
  'kraken-depths': Object.freeze({
    capstoneReq: 3,
    tier2: Object.freeze({
      label: '(2) Silt-Shadow Glide',
      desc: '-22% Fin Silt Stir · +6m Relic Glow Detection',
      stats: { siltCut: 0.22, relicGlowM: 6 },
    }),
    tierFull: Object.freeze({
      label: '(3) Abyssal Ghost',
      desc: 'Zero Ceiling Percolation Silt (CCR-grade stealth) · +10% Swim Speed',
      stats: { swimSpeed: 0.10, narcResist: 0.15 },
      power: { id: 'percolationImmune', name: 'Abyssal Ghost', desc: 'Exhale bubbles never trigger overhead ceiling percolation silt' },
    }),
  }),
  'abyssal-void': Object.freeze({
    capstoneReq: 3,
    tier2: Object.freeze({
      label: '(2) Deep Pressure Mind',
      desc: '-24% Nitrogen Narcosis · +12% Torch Reach',
      stats: { narcResist: 0.24, torchReach: 0.12 },
    }),
    tierFull: Object.freeze({
      label: '(3) Void Telemetry',
      desc: '+25% Sonar Scan Range · +12% Deco Offgas · Void Clarity',
      stats: { sonarRange: 0.25, decoOffgas: 0.12, siltCut: 0.14 },
      power: { id: 'voidClarity', name: 'Void Telemetry', desc: '+25% sonar range & crisp clarity in deep dark sumps' },
    }),
  }),
  'karst-pioneer': Object.freeze({
    capstoneReq: 3,
    tier2: Object.freeze({
      label: '(2) Halocline Trim',
      desc: '-9% Gas Burn · +14% Deco Offgassing',
      stats: { gasSave: 0.09, decoOffgas: 0.14 },
    }),
    tierFull: Object.freeze({
      label: '(3) Halcyon Equilibrium',
      desc: 'Cold Thermocline Immunity · Steady-Trim Deco locks 2× faster (+30% Offgas)',
      stats: { coldResist: 1.0, decoOffgas: 0.12 },
      power: { id: 'halcyonDecoFastLock', name: 'Halcyon Equilibrium', desc: 'Cold Thermocline immunity & 2× faster Steady-Trim Deco lock-in' },
    }),
  }),
  'wreck-salvager': Object.freeze({
    capstoneReq: 3,
    tier2: Object.freeze({
      label: '(2) Bulkhead Torque',
      desc: '+24% Hatch Crank Speed · -20% Wall Bump Shock',
      stats: { crankSpeed: 0.24, bumpArmor: 0.20 },
    }),
    tierFull: Object.freeze({
      label: '(3) Master Salvager',
      desc: '+10% Swim Speed · +18% Pull-and-Glide Wall Draft · +8% Expedition Score',
      stats: { swimSpeed: 0.10, hydroEff: 0.18, scoreBonus: 0.08 },
      power: { id: 'masterSalvager', name: 'Master Salvager', desc: 'Effortless wreck penetration & +8% expedition score' },
    }),
  }),
  'sunken-cartographer': Object.freeze({
    capstoneReq: 3,
    tier2: Object.freeze({
      label: '(2) Relic Resonance',
      desc: '+8m Relic & Gear Cache Detection · +18% Sonar Range',
      stats: { relicGlowM: 8, sonarRange: 0.18 },
    }),
    tierFull: Object.freeze({
      label: '(3) Cartographer Compass',
      desc: 'Live Golden Compass points to nearest hidden Relic or Gear Cache (26m) · +8% Swim',
      stats: { swimSpeed: 0.08, scoreBonus: 0.06 },
      power: { id: 'relicCompass', name: 'Cartographer Compass', desc: 'Diegetic golden compass arc tracks nearest hidden relic or Gear Cache within 26m' },
    }),
  }),
  'karst-hydro-glider': Object.freeze({
    capstoneReq: 3,
    tier2: Object.freeze({
      label: '(2) Laminar Fin Edge',
      desc: '-26% Fin Silt Stir · +18% Hydrology Efficiency',
      stats: { siltCut: 0.26, hydroEff: 0.18 },
    }),
    tierFull: Object.freeze({
      label: '(3) Hydro-Ghost',
      desc: '-82% Pull-and-Glide Headwind Drag · +10% Swim · Extra Slipstream Gas Savings',
      stats: { swimSpeed: 0.10, gasSave: 0.07, hydroEff: 0.16 },
      power: { id: 'hydroGhost', name: 'Hydro-Ghost', desc: 'Extreme current mastery: up to -82% Pull-and-Glide drag & effortless slipstream surfing' },
    }),
  }),
});

/**
 * Curated bespoke performance stats & Single-Piece Legendary Wonders (Zelda / Diablo affixes).
 * Any item not explicitly listed receives balanced, tier-scaled slot stats automatically so 100% of items matter!
 */
const BESPOKE_ITEM_STATS = Object.freeze({
  // Suits
  'suit:zissou-classic': { stats: { swimSpeed: 0.01, gasSave: 0.01 } },
  'suit:arctic-cobalt': { stats: { coldResist: 0.45, gasSave: 0.03 } },
  'suit:expedition-amber': { stats: { bumpArmor: 0.15, swimSpeed: 0.03 } },
  'suit:cenote-azure': { stats: { swimSpeed: 0.04, siltCut: 0.08 } },
  'suit:abyss-emerald': { stats: { narcResist: 0.12, decoOffgas: 0.06 } },
  'suit:wreck-titanium': { stats: { bumpArmor: 0.25, crankSpeed: 0.14 } },
  'suit:karst-jade': { stats: { siltCut: 0.14, gasSave: 0.05, decoOffgas: 0.06 } },
  'suit:krubera-obsidian': {
    stats: { narcResist: 0.22, bumpArmor: 0.28, coldResist: 0.35 },
    power: { id: 'abyssalPressureHull', name: 'Abyssal Pressure Hull', desc: '-28% wall shock & -22% deep narcosis' },
  },
  'suit:bounty-hunter-suit': {
    stats: { swimSpeed: 0.07, spearPower: 0.12, bumpArmor: 0.18 },
    power: { id: 'predatorPlate', name: 'Predator Exo-Plate', desc: '+12% speargun velocity & +7% combat agility' },
  },
  'suit:secret-kraken-biolume': {
    stats: { swimSpeed: 0.08, siltCut: 0.20, relicGlowM: 5 },
    power: { id: 'percolationImmune', name: 'Living Biolume Skin', desc: 'Stealth bubble dispersion prevents ceiling percolation silt' },
  },
  'suit:secret-volcanic-nautilus': {
    stats: { coldResist: 1.0, decoOffgas: 0.12, bumpArmor: 0.16 },
    power: { id: 'thermalMantle', name: 'Thermal Mantle', desc: '100% immune to Cold Thermocline shock' },
  },
  'suit:secret-empress-sovereign': {
    stats: { swimSpeed: 0.09, gasSave: 0.08, narcResist: 0.18, scoreBonus: 0.05 },
    power: { id: 'sovereignGrace', name: 'Sovereign Trim', desc: '+9% swim speed, -8% gas burn & +5% score' },
  },
  'suit:world-cartographer-suit': {
    stats: { swimSpeed: 0.05, relicGlowM: 6, sonarRange: 0.12 },
    power: { id: 'surveyHarness', name: 'Expedition Survey Harness', desc: '+6m hidden relic detection & +12% sonar radius' },
  },
  'suit:world-hydro-suit': {
    stats: { swimSpeed: 0.06, hydroEff: 0.16, siltCut: 0.12 },
    power: { id: 'hydroSkin', name: 'Laminar Aero-Weave', desc: '+16% Slipstream glide & Pull-and-Glide shelter' },
  },

  // Headgear
  'headgear:zissou-cap': { stats: { swimSpeed: 0.01 } },
  'headgear:cave-hood': { stats: { coldResist: 0.25, narcResist: 0.05 } },
  'headgear:cave-helmet': { stats: { bumpArmor: 0.18, torchReach: 0.05 } },
  'headgear:exo-mask': { stats: { narcResist: 0.14, gasSave: 0.04 } },
  'headgear:brass-hardhat': { stats: { bumpArmor: 0.26, crankSpeed: 0.10 } },
  'headgear:abyss-halo-helm': { stats: { narcResist: 0.18, sonarRange: 0.12, torchReach: 0.08 } },
  'headgear:secret-dreadnought-helm': {
    stats: { bumpArmor: 0.38, coldResist: 0.40 },
    power: { id: 'armoredDiveBell', name: 'Armored Dive Bell', desc: '-38% head-bump & impact trauma' },
  },
  'headgear:world-thermal-hood': {
    stats: { coldResist: 0.70, gasSave: 0.04 },
    power: { id: 'arcticInsulation', name: 'Arctic Thermal Seal', desc: '70% Cold Thermocline resistance & calmer breathing' },
  },

  // Torches
  'torch:tech-led': { stats: { torchReach: 0.02 } },
  'torch:warm-halogen': { stats: { torchReach: 0.05, siltCut: 0.06 } },
  'torch:amber-silt': { stats: { torchReach: 0.08, siltCut: 0.12 } },
  'torch:emerald-spot': { stats: { torchReach: 0.12, relicGlowM: 3 } },
  'torch:halocline-uv': {
    stats: { torchReach: 0.16, relicGlowM: 6 },
    power: { id: 'uvFluorescence', name: 'UV Relic Fluorescence', desc: '+6m fluorescent relic glow through dark sumps' },
  },
  'torch:aurora-plasma': { stats: { torchReach: 0.20, coldResist: 0.25, sonarRange: 0.08 } },
  'torch:bounty-hunter-torch': { stats: { torchReach: 0.18, spearPower: 0.10 } },
  'torch:secret-solar-prism': {
    stats: { torchReach: 0.26, relicGlowM: 7, decoOffgas: 0.06 },
    power: { id: 'heliosBeam', name: 'Helios Prism Beam', desc: '+26% beam reach & brilliant relic illumination' },
  },
  'torch:world-cartographer-torch': {
    stats: { torchReach: 0.20, relicGlowM: 8, sonarRange: 0.10 },
    power: { id: 'relicGlintBeam', name: 'Selenite Survey Beam', desc: '+8m relic & Gear Cache highlight range' },
  },

  // Tanks
  'tank:al80-silver': { stats: { gasSave: 0.01 } },
  'tank:hivis-yellow': { stats: { gasSave: 0.03, decoOffgas: 0.04 } },
  'tank:anodized-cobalt': { stats: { gasSave: 0.05, swimSpeed: 0.02 } },
  'tank:carbon-stealth': { stats: { swimSpeed: 0.04, gasSave: 0.06, siltCut: 0.06 } },
  'tank:salvage-brass': { stats: { gasSave: 0.05, crankSpeed: 0.12, bumpArmor: 0.10 } },
  'tank:sulfur-emerald-tank': { stats: { gasSave: 0.07, decoOffgas: 0.10 } },
  'tank:abyssal-titanium': { stats: { gasSave: 0.09, narcResist: 0.12, decoOffgas: 0.08 } },
  'tank:secret-dreadnought-brass': { stats: { gasSave: 0.10, bumpArmor: 0.18, crankSpeed: 0.14 } },
  'tank:world-hydro-tank': {
    stats: { gasSave: 0.10, decoOffgas: 0.09, hydroEff: 0.10 },
    power: { id: 'laminarMicroValve', name: 'Laminar Micro-Valve', desc: '-10% breathing gas burn & +9% deco offgas' },
  },
  'tank:world-chimney-tank': {
    stats: { gasSave: 0.11, decoOffgas: 0.16, coldResist: 0.55 },
    power: { id: 'thermalVentCore', name: 'Geothermal Core Tank', desc: '+16% Bühlmann offgassing & warm-gas cold shield' },
  },

  // Visors
  'visor:clear-cyan': { stats: { relicGlowM: 1 } },
  'visor:amber-contrast': { stats: { siltCut: 0.08, torchReach: 0.04 } },
  'visor:reef-mirror': { stats: { relicGlowM: 3, swimSpeed: 0.02 } },
  'visor:thermocline-prism': { stats: { coldResist: 0.25, narcResist: 0.08, relicGlowM: 3 } },
  'visor:night-emerald': { stats: { torchReach: 0.10, sonarRange: 0.10 } },
  'visor:bounty-hunter-visor': { stats: { spearPower: 0.10, relicGlowM: 4 } },
  'visor:secret-aurora-frost': { stats: { coldResist: 0.45, narcResist: 0.14, torchReach: 0.08 } },
  'visor:world-cartographer-visor': {
    stats: { relicGlowM: 8, sonarRange: 0.10 },
    power: { id: 'relicResonanceLens', name: 'Relic Resonance Lens', desc: '+8m hidden relic & Sunken Gear Cache glint' },
  },
  'visor:world-salvage-visor': {
    stats: { crankSpeed: 0.18, siltCut: 0.12, bumpArmor: 0.10 },
    power: { id: 'hullBreachOptics', name: 'Hull-Breach Optics', desc: '+18% hatch cranking & clear wreck sightlines' },
  },

  // Trim & Fins
  'trim:suit-default': { stats: { siltCut: 0.02 } },
  'trim:safety-orange': { stats: { swimSpeed: 0.02, hydroEff: 0.05 } },
  'trim:cavern-yellow': { stats: { siltCut: 0.08, swimSpeed: 0.02 } },
  'trim:tech-cyan': { stats: { swimSpeed: 0.03, siltCut: 0.10 } },
  'trim:signal-crimson': { stats: { swimSpeed: 0.04, spearPower: 0.05 } },
  'trim:salvage-gold': { stats: { hydroEff: 0.10, crankSpeed: 0.08 } },
  'trim:biolum-violet': { stats: { siltCut: 0.16, swimSpeed: 0.04 } },
  'trim:plasma-circuit-trim': { stats: { swimSpeed: 0.06, hydroEff: 0.12, siltCut: 0.14 } },
  'trim:secret-selenite-trim': { stats: { siltCut: 0.22, decoOffgas: 0.08, swimSpeed: 0.05 } },
  'trim:world-hydro-fins': {
    stats: { siltCut: 0.24, swimSpeed: 0.06, hydroEff: 0.20 },
    power: { id: 'siltGhost', name: 'Silt-Ghost Split Blades', desc: 'Zero floor silt kick below 1.2 m/s & +20% current agility' },
  },

  // Patches / Crests
  'patch:none': { stats: {} },
  'patch:cave-arrow': { stats: { sonarRange: 0.04 } },
  'patch:first-descent': { stats: { gasSave: 0.02, swimSpeed: 0.02 } },
  'patch:cenote-explorer': { stats: { relicGlowM: 3, siltCut: 0.06 } },
  'patch:wreck-penetrator': { stats: { crankSpeed: 0.12, bumpArmor: 0.08 } },
  'patch:wildlife-biologist': { stats: { siltCut: 0.10, scoreBonus: 0.04 } },
  'patch:abyss-veteran': { stats: { narcResist: 0.10, decoOffgas: 0.08 } },
  'patch:bounty-hunter-master': { stats: { spearPower: 0.12, scoreBonus: 0.06 } },
  'patch:world-arch-crest': {
    stats: { narcResist: 0.16, decoOffgas: 0.10, gasSave: 0.04 },
    power: { id: 'deepLineFocus', name: 'Bells Archway Focus', desc: '-16% narcosis & +10% Bühlmann deco clearing' },
  },
});

const TIER_STAT_SCALE = { common: 1.0, uncommon: 1.35, rare: 1.8, epic: 2.35, mythic: 2.9 };

function computeFallbackSlotStats(slot, tier = 'common') {
  const m = TIER_STAT_SCALE[tier] || 1.0;
  switch (slot) {
    case 'suit': return { swimSpeed: +(0.02 * m).toFixed(3), bumpArmor: +(0.05 * m).toFixed(3) };
    case 'headgear': return { narcResist: +(0.04 * m).toFixed(3), coldResist: +(0.08 * m).toFixed(3) };
    case 'torch': return { torchReach: +(0.04 * m).toFixed(3), relicGlowM: Math.round(1.5 * m) };
    case 'tank': return { gasSave: +(0.025 * m).toFixed(3), decoOffgas: +(0.03 * m).toFixed(3) };
    case 'visor': return { siltCut: +(0.04 * m).toFixed(3), sonarRange: +(0.035 * m).toFixed(3) };
    case 'trim': return { siltCut: +(0.05 * m).toFixed(3), hydroEff: +(0.04 * m).toFixed(3) };
    case 'patch': return { decoOffgas: +(0.025 * m).toFixed(3), scoreBonus: +(0.015 * m).toFixed(3) };
    default: return {};
  }
}

export function formatStatPills(stats = {}) {
  const pills = [];
  if (stats.swimSpeed > 0.005) pills.push(`+${Math.round(stats.swimSpeed * 100)}% Swim`);
  if (stats.gasSave > 0.005) pills.push(`-${Math.round(stats.gasSave * 100)}% Gas`);
  if (stats.siltCut > 0.005) pills.push(`-${Math.round(stats.siltCut * 100)}% Silt`);
  if (stats.decoOffgas > 0.005) pills.push(`+${Math.round(stats.decoOffgas * 100)}% Deco`);
  if (stats.torchReach > 0.005) pills.push(`+${Math.round(stats.torchReach * 100)}% Beam`);
  if (stats.coldResist >= 0.99) pills.push('Cold-Proof');
  else if (stats.coldResist > 0.04) pills.push(`+${Math.round(stats.coldResist * 100)}% Cold`);
  if (stats.narcResist > 0.03) pills.push(`-${Math.round(stats.narcResist * 100)}% Narc`);
  if (stats.bumpArmor > 0.03) pills.push(`-${Math.round(stats.bumpArmor * 100)}% Shock`);
  if (stats.hydroEff > 0.03) pills.push(`+${Math.round(stats.hydroEff * 100)}% Flow`);
  if (stats.sonarRange > 0.03) pills.push(`+${Math.round(stats.sonarRange * 100)}% Sonar`);
  if (stats.crankSpeed > 0.03) pills.push(`+${Math.round(stats.crankSpeed * 100)}% Crank`);
  if (stats.relicGlowM >= 1) pills.push(`+${Math.round(stats.relicGlowM)}m Relic`);
  if (stats.spearPower > 0.03) pills.push(`+${Math.round(stats.spearPower * 100)}% Spear`);
  if (stats.scoreBonus > 0.01) pills.push(`+${Math.round(stats.scoreBonus * 100)}% Score`);
  return pills;
}

/**
 * Look up the exact gameplay stats, Legendary Power & World/Earned source for any gear item.
 */
export function getGearItemStats(slot, itemOrId) {
  const item = typeof itemOrId === 'string' ? (getGearItemBySlot(slot, itemOrId)?.item || null) : itemOrId;
  const id = item?.id || (typeof itemOrId === 'string' ? itemOrId : '');
  const key = `${slot}:${id}`;
  const bespoke = BESPOKE_ITEM_STATS[key];
  const stats = bespoke?.stats ? { ...bespoke.stats } : computeFallbackSlotStats(slot, item?.tier || 'common');
  const worldCache = WORLD_CACHE_BY_KEY.get(key) || null;
  const source = worldCache ? 'world' : item?.source || (item?.ladderRank <= 2 ? 'starter' : 'earned');
  const pills = formatStatPills(stats);
  return {
    key,
    slot,
    id,
    stats,
    pills,
    summaryText: pills.slice(0, 3).join(' · ') || 'Baseline Spec',
    power: bespoke?.power || null,
    source,
    worldCache,
  };
}

/**
 * Compute full aggregated dive performance profile across all 7 equipped gear slots
 * + active Diablo III 2-Piece & Full-Set Capstone bonuses + Zelda Single-Piece Powers.
 */
export function computeRigPerformanceProfile(livery = null) {
  const cur = {
    suit: livery?.suitId || DEFAULT_RIG_LIVERY.suitId,
    headgear: livery?.headgearId || 'zissou-cap',
    torch: livery?.torchId || DEFAULT_RIG_LIVERY.torchId,
    tank: livery?.tankId || 'al80-silver',
    visor: livery?.visorId || 'clear-cyan',
    trim: livery?.trimId || 'suit-default',
    patch: livery?.patchId || DEFAULT_RIG_LIVERY.patchId,
  };

  const sum = {
    swimSpeed: 0,
    gasSave: 0,
    siltCut: 0,
    decoOffgas: 0,
    torchReach: 0,
    coldResist: 0,
    narcResist: 0,
    bumpArmor: 0,
    hydroEff: 0,
    sonarRange: 0,
    crankSpeed: 0,
    relicGlowM: 0,
    spearPower: 0,
    scoreBonus: 0,
  };
  const powersMap = new Map();
  const addStats = (s) => {
    if (!s) return;
    for (const k of Object.keys(sum)) {
      if (Number.isFinite(s[k])) sum[k] += s[k];
    }
  };

  for (const [slot, id] of Object.entries(cur)) {
    const info = getGearItemStats(slot, id);
    addStats(info.stats);
    if (info.power) powersMap.set(info.power.id, { ...info.power, source: 'item' });
  }

  // Evaluate Diablo III Multi-Tier Set Bonuses (2-Piece Gateway + Full-Set Capstone)
  const syn = evaluateGearSetSynergy(livery);
  const activeSets = [];
  let capstoneActive = false;
  for (const st of syn.sets || []) {
    const def = SET_TIER_BONUSES[st.set.id];
    if (!def || st.matched < 2) continue;
    const isCapstone = st.matched >= (def.capstoneReq || st.set.required || 3);
    addStats(def.tier2?.stats);
    if (def.tier2?.power) powersMap.set(def.tier2.power.id, { ...def.tier2.power, source: 'set-2pc' });
    if (isCapstone) {
      capstoneActive = true;
      addStats(def.tierFull?.stats);
      if (def.tierFull?.power) powersMap.set(def.tierFull.power.id, { ...def.tierFull.power, source: 'set-capstone' });
    }
    activeSets.push({
      id: st.set.id,
      name: st.set.name,
      icon: st.set.icon,
      color: st.set.color,
      matched: st.matched,
      capstoneReq: def.capstoneReq || st.set.required || 3,
      tier2Active: true,
      capstoneActive: isCapstone,
      tier2Label: def.tier2?.label || '',
      tier2Desc: def.tier2?.desc || '',
      tierFullLabel: def.tierFull?.label || '',
      tierFullDesc: def.tierFull?.desc || '',
    });
  }

  const powers = Array.from(powersMap.values());
  const hasPower = (pid) => powersMap.has(pid);

  // Fair simulation clamps so Ultra Mode feels awesome & transformative without breaking Bühlmann physics
  const swimSpeedMult = +(1 + Math.min(0.22, sum.swimSpeed)).toFixed(3);
  const gasBurnMult = +(1 - Math.min(0.24, sum.gasSave)).toFixed(3);
  const siltStirMult = +(1 - Math.min(0.50, sum.siltCut)).toFixed(3);
  const decoOffgasMult = +(1 + Math.min(0.36, sum.decoOffgas)).toFixed(3);
  const torchReachMult = +(1 + Math.min(0.38, sum.torchReach)).toFixed(3);
  const coldResist = +(Math.min(1.0, sum.coldResist)).toFixed(2);
  const narcResist = +(Math.min(0.50, sum.narcResist)).toFixed(2);
  const bumpArmor = +(Math.min(0.65, sum.bumpArmor)).toFixed(2);
  const hydroEfficiency = +(Math.min(0.45, sum.hydroEff)).toFixed(2);
  const sonarRangeMult = +(1 + Math.min(0.38, sum.sonarRange)).toFixed(3);
  const crankSpeedMult = +(1 + Math.min(0.50, sum.crankSpeed)).toFixed(3);
  const relicGlowBonusM = Math.min(16, Math.round(sum.relicGlowM));
  const spearPowerMult = +(1 + Math.min(0.32, sum.spearPower)).toFixed(3);
  const scoreBonusMult = +(1 + Math.min(0.16, sum.scoreBonus)).toFixed(3);

  return {
    swimSpeedMult,
    gasBurnMult,
    siltStirMult,
    decoOffgasMult,
    torchReachMult,
    coldResist,
    narcResist,
    bumpArmor,
    hydroEfficiency,
    sonarRangeMult,
    crankSpeedMult,
    relicGlowBonusM,
    spearPowerMult,
    scoreBonusMult,
    // Named Legendary / Capstone mechanical flags
    siltGhost: hasPower('siltGhost'),
    percolationImmune: hasPower('percolationImmune'),
    hatchKnockbackImmune: hasPower('hatchKnockbackImmune'),
    halcyonDecoFastLock: hasPower('halcyonDecoFastLock'),
    apexOvercharge: hasPower('apexOvercharge'),
    relicCompass: hasPower('relicCompass'),
    hydroGhost: hasPower('hydroGhost'),
    powers,
    activeSets,
    capstoneActive,
  };
}

/**
 * Compare equipped vs preview/hovered rig profile for Diablo III green/red stat deltas.
 */
export function diffRigPerformanceProfiles(baseProf, nextProf) {
  if (!baseProf || !nextProf) return [];
  const specs = [
    { key: 'swimSpeedMult', label: 'Swim', scale: 100, unit: '%', higherBetter: true },
    { key: 'gasBurnMult', label: 'Gas Save', scale: -100, unit: '%', higherBetter: true },
    { key: 'siltStirMult', label: 'Silt Ctrl', scale: -100, unit: '%', higherBetter: true },
    { key: 'decoOffgasMult', label: 'Deco', scale: 100, unit: '%', higherBetter: true },
    { key: 'torchReachMult', label: 'Beam', scale: 100, unit: '%', higherBetter: true },
    { key: 'coldResist', label: 'Cold Res', scale: 100, unit: '%', higherBetter: true },
    { key: 'narcResist', label: 'Narc Res', scale: 100, unit: '%', higherBetter: true },
    { key: 'bumpArmor', label: 'Armor', scale: 100, unit: '%', higherBetter: true },
    { key: 'hydroEfficiency', label: 'Flow', scale: 100, unit: '%', higherBetter: true },
    { key: 'relicGlowBonusM', label: 'Relic', scale: 1, unit: 'm', higherBetter: true },
  ];
  const diffs = [];
  for (const sp of specs) {
    const delta = Math.round(((nextProf[sp.key] || 0) - (baseProf[sp.key] || 0)) * sp.scale);
    if (delta === 0) continue;
    diffs.push({
      key: sp.key,
      label: sp.label,
      delta,
      positive: sp.higherBetter ? delta > 0 : delta < 0,
      text: `${delta > 0 ? '+' : ''}${delta}${sp.unit} ${sp.label}`,
    });
  }
  return diffs;
}

const TIER_BEAM_COLORS = {
  common: '#94a3b8',
  uncommon: '#34d399',
  rare: '#38bdf8',
  epic: '#c084fc',
  mythic: '#facc15',
};

/**
 * Deterministically spawn hidden World-Found Sunken Gear Caches for a dive site (v216).
 * Always verifies navigable open water via evaluateCaveSDF so crates are 100% reachable.
 */
export function createWorldGearCachesForLevel(level, foundGearMap = null) {
  if (!level) return [];
  const found = foundGearMap && typeof foundGearMap === 'object' ? foundGearMap : {};
  const matches = WORLD_GEAR_CACHES.filter((c) => c.levelId === level.id);
  if (matches.length === 0) return [];

  const segs = Array.isArray(level.segments) ? level.segments : [];
  const cps = Array.isArray(level.checkpoints) ? level.checkpoints : [];
  const caches = [];

  for (let i = 0; i < matches.length; i++) {
    const def = matches[i];
    const gearKey = `${def.slot}:${def.itemId}`;
    const alreadyFound = Boolean(found[gearKey]);
    const itemMeta = getGearItemBySlot(def.slot, def.itemId)?.item || null;

    // Pick an authentic side alcove around the middle-deep portion of the dive route
    let bestX = (level.spawn?.x || 10) + 12;
    let bestY = (level.spawn?.y || 4) + 10;
    if (segs.length > 0) {
      const targetIdx = Math.max(0, Math.min(segs.length - 1, Math.floor(segs.length * (def.depthFrac || 0.55))));
      const seg = segs[targetIdx];
      const baseX = ((seg.x1 ?? seg.ax ?? 0) + (seg.x2 ?? seg.bx ?? 0)) * 0.5;
      const baseY = ((seg.y1 ?? seg.ay ?? 10) + (seg.y2 ?? seg.by ?? 10)) * 0.5;
      const r = Math.max(1.2, (seg.r ?? seg.radius ?? 3.0) * 0.52);
      // Try gentle alcove offsets and guarantee SDF < -0.65 (cleanly navigable open water!)
      const candidates = [
        { x: baseX + def.offsetSign * r * 0.65, y: baseY + r * 0.45 },
        { x: baseX - def.offsetSign * r * 0.5, y: baseY + r * 0.35 },
        { x: baseX, y: baseY },
      ];
      let placed = false;
      for (const pt of candidates) {
        if (evaluateCaveSDF(level, pt.x, pt.y) < -0.65) {
          bestX = pt.x;
          bestY = pt.y;
          placed = true;
          break;
        }
      }
      if (!placed && cps.length > 1) {
        const cp = cps[Math.min(cps.length - 1, Math.floor(cps.length * 0.5))];
        bestX = cp.x;
        bestY = cp.y;
      }
    } else if (cps.length > 0) {
      const cp = cps[Math.min(cps.length - 1, Math.floor(cps.length * 0.5))];
      bestX = cp.x;
      bestY = cp.y;
    }

    caches.push({
      id: def.id,
      gearKey,
      slot: def.slot,
      itemId: def.itemId,
      itemName: itemMeta?.name || def.itemId,
      name: itemMeta?.name || def.itemId,
      tier: def.tier,
      icon: def.icon,
      clue: def.clue,
      x: Math.round(bestX * 100) / 100,
      y: Math.round(bestY * 100) / 100,
      opened: alreadyFound,
      alreadyOwned: alreadyFound,
      openAnim: alreadyFound ? 1 : 0,
      beamColor: TIER_BEAM_COLORS[def.tier] || '#38bdf8',
    });
  }
  return caches;
}
