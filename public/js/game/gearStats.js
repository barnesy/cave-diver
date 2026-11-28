import { evaluateCaveSDF } from './collision.js';
import {
  DEFAULT_RIG_LIVERY,
  GEAR_SET_SYNERGIES,
  getGearItemBySlot,
  evaluateGearSetSynergy,
  resolveDiverLiveryPalette,
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
    id: 'cache-vaucluse-fins',
    slot: 'trim',
    itemId: 'world-hydro-fins',
    levelId: 'fontaine-de-vaucluse',
    siteName: 'Fontaine de Vaucluse',
    tier: 'rare',
    icon: '🌊',
    clue: 'Tucked along a karst surge shelf in Fontaine de Vaucluse',
    depthFrac: 0.52,
    offsetSign: -1,
  }),
  Object.freeze({
    id: 'cache-boesmansgat-lens',
    slot: 'visor',
    itemId: 'world-abyss-lens',
    levelId: 'boesmansgat-abyss',
    siteName: 'Boesmansgat Abyss',
    tier: 'rare',
    icon: '🔭',
    clue: 'Wedged along a deep dolomite ledge in Boesmansgat Abyss',
    depthFrac: 0.54,
    offsetSign: 1,
  }),
  Object.freeze({
    id: 'cache-danscave-suit',
    slot: 'suit',
    itemId: 'world-hydro-suit',
    levelId: 'dans-cave-abaco',
    siteName: "Dan's Cave Abaco",
    tier: 'rare',
    icon: '🚀',
    clue: "Tucked inside a stalactite tunnel of Dan's Cave Abaco",
    depthFrac: 0.54,
    offsetSign: -1,
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
    id: 'cache-bermuda-thrusters',
    slot: 'trim',
    itemId: 'world-reef-thrusters',
    levelId: 'bermuda-devils-wall',
    siteName: "Bermuda Devil's Wall",
    tier: 'epic',
    icon: '⚡',
    clue: "Strapped to a sheer coral overhang on Bermuda Devil's Wall",
    depthFrac: 0.56,
    offsetSign: -1,
  }),
  Object.freeze({
    id: 'cache-oxbelha-torch',
    slot: 'torch',
    itemId: 'world-cartographer-torch',
    levelId: 'ox-bel-ha-grand-traverse',
    siteName: 'Ox Bel Ha Grand Traverse',
    tier: 'epic',
    icon: '💎',
    clue: 'Resting in a limestone grotto along Ox Bel Ha Grand Traverse',
    depthFrac: 0.55,
    offsetSign: 1,
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
  Object.freeze({
    id: 'cache-grjotagja-flare',
    slot: 'torch',
    itemId: 'world-rift-flare',
    levelId: 'grjotagja-kleifarvatn-rift',
    siteName: 'Grjótagjá Rift',
    tier: 'epic',
    icon: '🔥',
    clue: 'Stashed beside a glowing volcanic fissure in Grjótagjá Rift',
    depthFrac: 0.58,
    offsetSign: -1,
  }),
  Object.freeze({
    id: 'cache-lagoa-tank',
    slot: 'tank',
    itemId: 'world-hydro-tank',
    levelId: 'lagoa-misteriosa-abyss',
    siteName: 'Lagoa Misteriosa Abyss',
    tier: 'epic',
    icon: '💧',
    clue: 'Secured to a crystalline vertical ledge in Lagoa Misteriosa',
    depthFrac: 0.60,
    offsetSign: -1,
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
    id: 'cache-angelita-mask',
    slot: 'headgear',
    itemId: 'world-halocline-mask',
    levelId: 'cenote-angelita-river',
    siteName: 'Cenote Angelita',
    tier: 'epic',
    icon: '🌫️',
    clue: 'Resting along the submerged H₂S mist bank in Cenote Angelita',
    depthFrac: 0.56,
    offsetSign: 1,
  }),
  Object.freeze({
    id: 'cache-yonaguni-seal',
    slot: 'patch',
    itemId: 'world-monolith-seal',
    levelId: 'yonaguni-submerged-monument',
    siteName: 'Yonaguni Monument',
    tier: 'mythic',
    icon: '🗿',
    clue: 'Carved into a sunken sandstone terrace of Yonaguni Monument',
    depthFrac: 0.60,
    offsetSign: 1,
  }),
]);

export const WORLD_CACHE_BY_KEY = new Map(
  WORLD_GEAR_CACHES.map((c) => [`${c.slot}:${c.itemId}`, c])
);

/**
 * 4 Core Expedition Build Archetypes (v218):
 * Each piece and Set contributes meaningfully toward Deep Tech, Speed/Hydro, Boss Combat, or Explorer/Hybrid play!
 */
export const GEAR_ARCHETYPES = Object.freeze({
  deep: Object.freeze({
    id: 'deep',
    icon: '🌊',
    label: 'Deep Tech',
    short: 'DEEP',
    color: '#38bdf8',
    desc: 'High-pressure +Bar overfill, deeper narcosis tolerance, Cold Immunity & rapid Bühlmann deco',
  }),
  speed: Object.freeze({
    id: 'speed',
    icon: '⚡',
    label: 'Speed / Hydro',
    short: 'SPEED',
    color: '#34d399',
    desc: 'Fast swim propulsion, DPV overdrive, Silt-Ghost gliding & extreme current mastery',
  }),
  combat: Object.freeze({
    id: 'combat',
    icon: '🔱',
    label: 'Boss Combat',
    short: 'COMBAT',
    color: '#fb7185',
    desc: 'Bonus Boss Arena Max HP, rapid-fire speargun DPS, Golden Hyper-Tips & fast Hydro-Dash',
  }),
  hybrid: Object.freeze({
    id: 'hybrid',
    icon: '🧭',
    label: 'Explorer / Hybrid',
    short: 'HYBRID',
    color: '#facc15',
    desc: 'Golden Relic Compass, long-range sonar, 2× wreck bulkhead cranking & multi-set mixing',
  }),
});

/**
 * Mode & Difficulty Gear Tuning Profiles (v219).
 * Tunes build buffs cleanly to Guided, Standard, Hardcore, Daily, Rescue Drills, Endless Trench & Purist!
 */
export const GEAR_TUNING_PROFILES = Object.freeze({
  guided: Object.freeze({
    id: 'guided',
    icon: '🛡️',
    label: 'Guided',
    badge: '🛡️ GUIDED · +15% Safety & Utility',
    summary: 'Generous safety margins, wider relic glow & full capstones for learning expeditions',
    safetyScale: 1.15,
    mobilityScale: 1.05,
    skillScale: 1.05,
    combatScale: 1.10,
    utilityScale: 1.20,
    scoreBonusAdd: 0,
    maxSwimSpeed: 0.30,
    maxSpearPower: 0.38,
    maxColdResist: 1.0,
    maxNarcResist: 0.60,
    maxNarcDepthM: 22,
    maxBonusStartBar: 45,
    maxCombatHp: 60,
    maxGasSave: 0.32,
    allowImmunities: true,
    isNormalized: false,
  }),
  standard: Object.freeze({
    id: 'standard',
    icon: '🤿',
    label: 'Standard',
    badge: '🤿 STANDARD · 1.0× Expedition Spec',
    summary: 'Core balanced archetype tuning across the 37-site expedition atlas & 12 Boss Lairs',
    safetyScale: 1.0,
    mobilityScale: 1.0,
    skillScale: 1.0,
    combatScale: 1.0,
    utilityScale: 1.0,
    scoreBonusAdd: 0,
    maxSwimSpeed: 0.28,
    maxSpearPower: 0.34,
    maxColdResist: 1.0,
    maxNarcResist: 0.55,
    maxNarcDepthM: 20,
    maxBonusStartBar: 40,
    maxCombatHp: 55,
    maxGasSave: 0.28,
    allowImmunities: true,
    isNormalized: false,
  }),
  hardcore: Object.freeze({
    id: 'hardcore',
    icon: '🔥',
    label: 'Hardcore',
    badge: '🔥 HARDCORE · -38% Safety / +15% Skill',
    summary: 'Tightens safety crutches (cap 75% Cold, +24b Bar, 135 HP) while amplifying skill perks & +15% score',
    safetyScale: 0.62,
    mobilityScale: 0.95,
    skillScale: 1.15,
    combatScale: 0.85,
    utilityScale: 1.05,
    scoreBonusAdd: 0.15,
    maxSwimSpeed: 0.26,
    maxSpearPower: 0.26,
    maxColdResist: 0.75,
    maxNarcResist: 0.40,
    maxNarcDepthM: 12,
    maxBonusStartBar: 24,
    maxCombatHp: 35,
    maxGasSave: 0.18,
    allowImmunities: true,
    isNormalized: false,
  }),
  daily: Object.freeze({
    id: 'daily',
    icon: '📅',
    label: 'Daily Dive',
    badge: '📅 DAILY · 85% Competitive Parity',
    summary: 'Competitive leaderboard calibration — archetype choices matter without mythic blowouts',
    safetyScale: 0.85,
    mobilityScale: 0.85,
    skillScale: 0.90,
    combatScale: 0.85,
    utilityScale: 0.90,
    scoreBonusAdd: 0,
    maxSwimSpeed: 0.22,
    maxSpearPower: 0.26,
    maxColdResist: 0.85,
    maxNarcResist: 0.45,
    maxNarcDepthM: 16,
    maxBonusStartBar: 30,
    maxCombatHp: 45,
    maxGasSave: 0.22,
    allowImmunities: true,
    isNormalized: false,
  }),
  drill: Object.freeze({
    id: 'drill',
    icon: '🚨',
    label: 'Rescue Drill',
    badge: '🚨 DRILL · 55% Training Calibration',
    summary: 'Normalized technical rescue calibration so timed S+/S/A medals reward pure emergency skill',
    safetyScale: 0.50,
    mobilityScale: 0.60,
    skillScale: 0.75,
    combatScale: 0.60,
    utilityScale: 0.70,
    scoreBonusAdd: 0,
    maxSwimSpeed: 0.16,
    maxSpearPower: 0.18,
    maxColdResist: 0.60,
    maxNarcResist: 0.30,
    maxNarcDepthM: 10,
    maxBonusStartBar: 16,
    maxCombatHp: 25,
    maxGasSave: 0.14,
    allowImmunities: false,
    isNormalized: false,
  }),
  purist: Object.freeze({
    id: 'purist',
    icon: '🧭',
    label: 'Purist',
    badge: '🧭 PURIST · Normalized Baseline (0% Buffs)',
    summary: 'Cosmetic-only pure technical diving — all gear stats and set powers normalized to baseline',
    safetyScale: 0,
    mobilityScale: 0,
    skillScale: 0,
    combatScale: 0,
    utilityScale: 0,
    scoreBonusAdd: 0,
    maxSwimSpeed: 0,
    maxSpearPower: 0,
    maxColdResist: 0,
    maxNarcResist: 0,
    maxNarcDepthM: 0,
    maxBonusStartBar: 0,
    maxCombatHp: 0,
    maxGasSave: 0,
    allowImmunities: false,
    isNormalized: true,
  }),
});

/**
 * Resolve active Mode + Difficulty + Trench Chamber tuning profile (v219).
 */
export function resolveGearTuningProfile(context = null) {
  if (!context || typeof context !== 'object') {
    return { ...GEAR_TUNING_PROFILES.standard, difficulty: 'standard', modeTag: 'standard', trenchChamber: 0, trenchResonance: 0, modifiers: [] };
  }
  const difficulty = context.difficulty === 'guided' || context.difficulty === 'hardcore' ? context.difficulty : 'standard';
  const mutatorId = String(context.mutatorId || '').trim().toLowerCase();
  const isPurist = mutatorId === 'purist' || context.mode === 'purist';
  const isDrill = Boolean(context.isRescueDrill || context.mode === 'drill');
  const isDaily = Boolean(context.isDaily || context.dailyDateKey || context.mode === 'daily');
  const isTrench = Boolean(context.isTrench || context.mode === 'trench');
  const trenchChamber = isTrench ? Math.max(1, Math.round(Number(context.trenchChamber) || 3)) : 0;
  const modifiers = Array.isArray(context.modifiers) ? context.modifiers : [];

  let base = GEAR_TUNING_PROFILES[difficulty] || GEAR_TUNING_PROFILES.standard;
  let modeTag = difficulty;
  if (isPurist) {
    base = GEAR_TUNING_PROFILES.purist;
    modeTag = 'purist';
  } else if (isDrill) {
    base = GEAR_TUNING_PROFILES.drill;
    modeTag = 'drill';
  } else if (isDaily) {
    base = GEAR_TUNING_PROFILES.daily;
    modeTag = 'daily';
  }

  // Endless Abyssal Trench deep-chamber resonance (+6% Deep/Hydro endurance per chamber >= 3, up to +24%)
  const trenchResonance = !isPurist && isTrench && trenchChamber >= 3
    ? Math.min(0.24, (trenchChamber - 2) * 0.06)
    : 0;

  let badge = base.badge;
  if (isTrench && !isPurist) {
    const resTxt = trenchResonance > 0 ? ` · +${Math.round(trenchResonance * 100)}% Abyss Resonance` : '';
    badge = `🌊 TRENCH CH.${trenchChamber} (${base.label})${resTxt}`;
    modeTag = 'trench';
  }

  return {
    ...base,
    difficulty,
    modeTag,
    trenchChamber,
    trenchResonance,
    badge,
    modifiers,
  };
}

/**
 * Diablo III Multi-Tier Set Bonuses (2pc Gateway Utility + Full-Set Archetype Capstone / Zelda Immunities).
 */
export const SET_TIER_BONUSES = Object.freeze({
  'dreadnought-mk4': Object.freeze({
    archetype: 'combat',
    capstoneReq: 2,
    tier2: Object.freeze({
      label: '(2) Unbreakable Hull',
      desc: '+45% Hatch Crank · +30 Boss HP · -45% Wall Shock · Immune to Shifting-Hatch Knockback',
      stats: { crankSpeed: 0.45, bumpArmor: 0.45, combatMaxHpBonus: 30, salvageDragCut: 0.35 },
      power: { id: 'hatchKnockbackImmune', name: 'Unbreakable Hull', desc: 'Immune to shifting-hatch knockback, +30 Boss HP & -45% impact shock' },
    }),
    tierFull: Object.freeze({
      label: '(2) Furnace Boiler Core',
      desc: '+16% Speargun Power · +8 Bar Reserve · +5% Heavy Trim · -6% Gas Burn',
      stats: { swimSpeed: 0.05, gasSave: 0.06, bonusStartBar: 8, spearPower: 0.16 },
      power: { id: 'hatchKnockbackImmune', name: 'Unbreakable Hull', desc: 'Immune to shifting-hatch knockback, +30 Boss HP & -45% impact shock' },
    }),
  }),
  'apex-bounty': Object.freeze({
    archetype: 'combat',
    capstoneReq: 3,
    tier2: Object.freeze({
      label: '(2) Predator Tempo',
      desc: '+24% Speargun Damage · +25 Boss Max HP · -22% Hydro-Dash Cooldown',
      stats: { spearPower: 0.24, combatMaxHpBonus: 25, dashCdCut: 0.22, swimSpeed: 0.04 },
    }),
    tierFull: Object.freeze({
      label: '(3) Apex Overcharge',
      desc: 'Every 3rd Speargun shot is a Piercing Golden Hyper-Tip · +22% Fire Rate · +20 Boss HP',
      stats: { spearPower: 0.18, spearFireRateCut: 0.22, combatMaxHpBonus: 20, bumpArmor: 0.20 },
      power: { id: 'apexOvercharge', name: 'Apex Overcharge', desc: 'Every 3rd speargun shot fires a piercing golden Hyper-Tip + rapid combat reload' },
    }),
  }),
  'kraken-depths': Object.freeze({
    archetype: 'speed',
    capstoneReq: 3,
    tier2: Object.freeze({
      label: '(2) Silt-Shadow Glide',
      desc: '-26% Fin Silt Stir · +10% Swim Speed · -20% DPV Battery Drain',
      stats: { siltCut: 0.26, swimSpeed: 0.10, dpvDrainCut: 0.20, relicGlowM: 6 },
    }),
    tierFull: Object.freeze({
      label: '(3) Abyssal Ghost',
      desc: 'Zero Ceiling Percolation Silt · +14% Swim · -22% Hydro-Dash CD · +8m Depth Tolerance',
      stats: { swimSpeed: 0.14, narcResist: 0.18, narcDepthBonusM: 8, dashCdCut: 0.22 },
      power: { id: 'percolationImmune', name: 'Abyssal Ghost', desc: 'Exhale bubbles never trigger overhead ceiling percolation silt' },
    }),
  }),
  'abyssal-void': Object.freeze({
    archetype: 'deep',
    capstoneReq: 3,
    tier2: Object.freeze({
      label: '(2) Deep Pressure Mind',
      desc: '+10m Narcosis Depth Tolerance · -28% Narcosis · +20 Bar Tank Overfill',
      stats: { narcResist: 0.28, narcDepthBonusM: 10, bonusStartBar: 20, torchReach: 0.14 },
    }),
    tierFull: Object.freeze({
      label: '(3) Void Telemetry',
      desc: '+30% Sonar Range · +22% Deco Offgas · +8m Depth Tolerance · Void Clarity',
      stats: { sonarRange: 0.30, decoOffgas: 0.22, narcDepthBonusM: 8, siltCut: 0.16 },
      power: { id: 'voidClarity', name: 'Void Telemetry', desc: '+30% sonar range, +18m total narcosis tolerance & deep sump clarity' },
    }),
  }),
  'karst-pioneer': Object.freeze({
    archetype: 'deep',
    capstoneReq: 3,
    tier2: Object.freeze({
      label: '(2) Halocline Trim',
      desc: '-12% Gas Burn · +20% Deco Offgassing · +15 Bar Tank Overfill',
      stats: { gasSave: 0.12, decoOffgas: 0.20, bonusStartBar: 15 },
    }),
    tierFull: Object.freeze({
      label: '(3) Halcyon Equilibrium',
      desc: '100% Cold Thermocline Immunity · Steady-Trim Deco locks 2× faster (+36% Offgas)',
      stats: { coldResist: 1.0, decoOffgas: 0.18, narcDepthBonusM: 6 },
      power: { id: 'halcyonDecoFastLock', name: 'Halcyon Equilibrium', desc: 'Cold Thermocline immunity & 2× faster Steady-Trim Deco lock-in' },
    }),
  }),
  'wreck-salvager': Object.freeze({
    archetype: 'hybrid',
    capstoneReq: 3,
    tier2: Object.freeze({
      label: '(2) Bulkhead Torque',
      desc: '+38% Hatch Crank · -35% Heavy Salvage Drag · -24% Wall Shock',
      stats: { crankSpeed: 0.38, salvageDragCut: 0.35, bumpArmor: 0.24 },
    }),
    tierFull: Object.freeze({
      label: '(3) Master Salvager',
      desc: 'Hatch Knockback Immunity · +12% Swim · +20% Wall Draft · +10% Score',
      stats: { swimSpeed: 0.12, hydroEff: 0.20, crankSpeed: 0.25, scoreBonus: 0.10 },
      power: { id: 'hatchKnockbackImmune', name: 'Master Salvager', desc: 'Immune to shifting-hatch knockback, 2× bulkhead cranking & effortless salvage haul' },
    }),
  }),
  'sunken-cartographer': Object.freeze({
    archetype: 'hybrid',
    capstoneReq: 3,
    tier2: Object.freeze({
      label: '(2) Relic Resonance',
      desc: '+10m Relic & Gear Cache Detection · +25% Sonar Range · +12% DPV Speed',
      stats: { relicGlowM: 10, sonarRange: 0.25, dpvSpeedBonus: 0.12 },
    }),
    tierFull: Object.freeze({
      label: '(3) Cartographer Compass',
      desc: 'Live Golden Compass tracks hidden Relics & Gear Caches (32m) · +18% Beam · +12% Score',
      stats: { swimSpeed: 0.06, scoreBonus: 0.12, torchReach: 0.18, sonarRange: 0.15 },
      power: { id: 'relicCompass', name: 'Cartographer Compass', desc: 'Diegetic golden compass arc tracks nearest hidden relic or Gear Cache within 32m' },
    }),
  }),
  'karst-hydro-glider': Object.freeze({
    archetype: 'speed',
    capstoneReq: 3,
    tier2: Object.freeze({
      label: '(2) Laminar Fin Edge',
      desc: '-30% Silt Stir · +22% Current Agility · +12% DPV Cruise & -25% Battery Drain',
      stats: { siltCut: 0.30, hydroEff: 0.22, dpvSpeedBonus: 0.12, dpvDrainCut: 0.25 },
    }),
    tierFull: Object.freeze({
      label: '(3) Hydro-Ghost',
      desc: '-85% Wall Pull-and-Glide Drag · +15% Swim · -25% Hydro-Dash CD · Turbo Slipstream',
      stats: { swimSpeed: 0.15, gasSave: 0.10, hydroEff: 0.20, dashCdCut: 0.25 },
      power: { id: 'hydroGhost', name: 'Hydro-Ghost', desc: 'Extreme current mastery: -85% Pull-and-Glide drag, turbo slipstreams & rapid dashing' },
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
  'suit:resort-bikini-coral': { archetype: 'speed', stats: { swimSpeed: 0.04, siltCut: 0.06 } },
  'suit:resort-bikini-lagoon': { archetype: 'speed', stats: { swimSpeed: 0.04, dashCdCut: 0.06 } },
  'suit:resort-cutout-neon': { archetype: 'speed', stats: { swimSpeed: 0.05, siltCut: 0.05 } },
  'suit:halfzip-wetsuit-reef': { archetype: 'hybrid', stats: { swimSpeed: 0.03, coldResist: 0.25, gasSave: 0.02 } },
  'suit:cenote-azure': { stats: { swimSpeed: 0.04, siltCut: 0.08 } },
  'suit:abyss-emerald': { archetype: 'deep', stats: { narcResist: 0.14, narcDepthBonusM: 6, decoOffgas: 0.10, bonusStartBar: 8 } },
  'suit:wreck-titanium': { archetype: 'hybrid', stats: { bumpArmor: 0.28, crankSpeed: 0.22, salvageDragCut: 0.22 } },
  'suit:karst-jade': { archetype: 'deep', stats: { siltCut: 0.16, gasSave: 0.06, decoOffgas: 0.09, bonusStartBar: 10 } },
  'suit:krubera-obsidian': {
    archetype: 'deep',
    stats: { narcResist: 0.25, narcDepthBonusM: 10, bumpArmor: 0.30, coldResist: 0.40 },
    power: { id: 'abyssalPressureHull', name: 'Abyssal Pressure Hull', desc: '+10m depth clarity, -30% wall shock & -25% narcosis' },
  },
  'suit:bounty-hunter-suit': {
    archetype: 'combat',
    stats: { swimSpeed: 0.05, spearPower: 0.20, combatMaxHpBonus: 25, bumpArmor: 0.22 },
    power: { id: 'predatorPlate', name: 'Predator Exo-Plate', desc: '+25 Boss Max HP, +20% speargun damage & armored hull trim' },
  },
  'suit:secret-kraken-biolume': {
    archetype: 'speed',
    stats: { swimSpeed: 0.11, siltCut: 0.22, dashCdCut: 0.16, relicGlowM: 6 },
    power: { id: 'percolationImmune', name: 'Living Biolume Skin', desc: 'Stealth bubble dispersion prevents ceiling percolation silt' },
  },
  'suit:secret-volcanic-nautilus': {
    archetype: 'deep',
    stats: { coldResist: 1.0, decoOffgas: 0.16, bonusStartBar: 15, bumpArmor: 0.18 },
    power: { id: 'thermalMantle', name: 'Thermal Mantle', desc: '100% immune to Cold Thermocline shock + 15 bar thermal overfill' },
  },
  'suit:secret-empress-sovereign': {
    archetype: 'hybrid',
    stats: { swimSpeed: 0.12, gasSave: 0.10, narcResist: 0.20, combatMaxHpBonus: 20, scoreBonus: 0.06 },
    power: { id: 'sovereignGrace', name: 'Sovereign Trim', desc: '+12% swim, -10% gas, +20 Boss HP & +6% score' },
  },
  'suit:world-cartographer-suit': {
    archetype: 'hybrid',
    stats: { swimSpeed: 0.07, relicGlowM: 8, sonarRange: 0.18 },
    power: { id: 'surveyHarness', name: 'Expedition Survey Harness', desc: '+8m hidden relic detection & +18% sonar radius' },
  },
  'suit:world-hydro-suit': {
    archetype: 'speed',
    stats: { swimSpeed: 0.10, hydroEff: 0.20, siltCut: 0.15, dpvSpeedBonus: 0.10 },
    power: { id: 'hydroSkin', name: 'Laminar Aero-Weave', desc: '+10% swim/DPV cruise & +20% Slipstream/Pull-and-Glide' },
  },
  'suit:chest-nautilus-suit': {
    archetype: 'deep',
    stats: { bonusStartBar: 22, narcDepthBonusM: 10, decoOffgas: 0.18, coldResist: 0.65, gasSave: 0.08 },
    power: { id: 'nautilusReserve', name: 'Abyssal Reserve Vault', desc: '+22 bar overfill, +10m depth clarity & +18% Bühlmann deco clearing' },
  },
  'suit:chest-bulwark-shell': {
    archetype: 'combat',
    stats: { armorDR: 0.16, shieldMax: 24, combatMaxHpBonus: 18, bumpArmor: 0.24 },
    power: { id: 'bulwarkHydroShield', name: 'Bulwark Hydro-Shield', desc: '+16% Armor DR & 24-pt Rechargeable Hydro-Shield cushioning bites & cave shock' },
  },
  'suit:legendary-aegis-exosuit': {
    archetype: 'combat',
    stats: { armorDR: 0.28, shieldMax: 45, combatMaxHpBonus: 30, bumpArmor: 0.35, coldResist: 0.35 },
    power: { id: 'aegisShieldMatrix', name: 'Aegis Shield Matrix', desc: '🔥 Legendary: +28% Armor DR & 45-pt fast-recharging Hydro-Shield protecting HP & dive shock' },
  },

  // Headgear
  'headgear:zissou-cap': { archetype: 'speed', stats: { swimSpeed: 0.01 } },
  'headgear:cave-hood': { archetype: 'deep', stats: { coldResist: 0.30, narcResist: 0.06 } },
  'headgear:cave-helmet': { archetype: 'hybrid', stats: { bumpArmor: 0.20, armorDR: 0.06, torchReach: 0.07, combatMaxHpBonus: 10 } },
  'headgear:exo-mask': { archetype: 'deep', stats: { narcResist: 0.16, narcDepthBonusM: 6, gasSave: 0.05 } },
  'headgear:brass-hardhat': { archetype: 'hybrid', stats: { bumpArmor: 0.30, armorDR: 0.10, shieldMax: 12, crankSpeed: 0.16, salvageDragCut: 0.15 } },
  'headgear:abyss-halo-helm': { archetype: 'deep', stats: { narcResist: 0.22, narcDepthBonusM: 8, sonarRange: 0.16, torchReach: 0.10 } },
  'headgear:secret-dreadnought-helm': {
    archetype: 'combat',
    stats: { bumpArmor: 0.42, armorDR: 0.15, shieldMax: 20, coldResist: 0.45, combatMaxHpBonus: 20 },
    power: { id: 'armoredDiveBell', name: 'Armored Dive Bell', desc: '+20 Boss HP, +15% Armor DR, +20 Shield & -42% wall shock' },
  },
  'headgear:world-thermal-hood': {
    archetype: 'deep',
    stats: { coldResist: 0.50, gasSave: 0.06, narcDepthBonusM: 5 },
    power: { id: 'arcticInsulation', name: 'Arctic Thermal Seal', desc: '50% Cold Thermocline resistance & calmer deep breathing' },
  },
  'headgear:world-halocline-mask': {
    archetype: 'deep',
    stats: { decoOffgas: 0.24, siltCut: 0.24, relicGlowM: 10, gasSave: 0.08 },
    power: { id: 'haloclineMistSeal', name: 'H₂S Halocline Seal', desc: '+24% Bühlmann deco clearing, -24% silt & +10m relic glint in mist' },
  },
  'headgear:chest-ghost-hood': {
    archetype: 'speed',
    stats: { stealth: 0.28, siltCut: 0.18, swimSpeed: 0.05 },
    power: { id: 'acousticHood', name: 'Acoustic Stealth Weave', desc: '+28% Stealth: cuts predator detection radius & calms startled wildlife' },
  },
  'headgear:legendary-phantom-shroud': {
    archetype: 'speed',
    stats: { stealth: 0.56, coldResist: 0.25, gasSave: 0.14, siltCut: 0.24 },
    power: { id: 'phantomCloak', name: 'Phantom Acoustic Cloak', desc: '🔥 Legendary: +56% Stealth slashes predator aggro in half & quiets torch/bubble signature' },
  },

  // Torches
  'torch:tech-led': { archetype: 'hybrid', stats: { torchReach: 0.02 } },
  'torch:warm-halogen': { archetype: 'hybrid', stats: { torchReach: 0.06, siltCut: 0.08, siltPierce: 0.14 } },
  'torch:amber-silt': { archetype: 'speed', stats: { torchReach: 0.10, siltCut: 0.15, siltPierce: 0.30 } },
  'torch:emerald-spot': { archetype: 'hybrid', stats: { torchReach: 0.15, relicGlowM: 4 } },
  'torch:halocline-uv': {
    archetype: 'hybrid',
    stats: { torchReach: 0.20, relicGlowM: 8 },
    power: { id: 'uvFluorescence', name: 'UV Relic Fluorescence', desc: '+8m fluorescent relic glow through dark sumps' },
  },
  'torch:aurora-plasma': { archetype: 'deep', stats: { torchReach: 0.24, coldResist: 0.30, sonarRange: 0.12 } },
  'torch:bounty-hunter-torch': { archetype: 'combat', stats: { torchReach: 0.20, spearPower: 0.16, spearFireRateCut: 0.10 } },
  'torch:secret-solar-prism': {
    archetype: 'hybrid',
    stats: { torchReach: 0.32, relicGlowM: 9, decoOffgas: 0.08 },
    power: { id: 'heliosBeam', name: 'Helios Prism Beam', desc: '+32% beam reach & brilliant relic illumination' },
  },
  'torch:world-cartographer-torch': {
    archetype: 'hybrid',
    stats: { torchReach: 0.26, relicGlowM: 10, sonarRange: 0.14 },
    power: { id: 'relicGlintBeam', name: 'Selenite Survey Beam', desc: '+10m relic & Gear Cache highlight range' },
  },
  'torch:world-rift-flare': {
    archetype: 'combat',
    stats: { torchReach: 0.24, spearPower: 0.16, coldResist: 0.35, siltCut: 0.14 },
    power: { id: 'riftPlasmaFlare', name: 'Rift Plasma Floodlight', desc: '+24% beam reach, +16% Speargun DPS & +35% volcanic cold shield' },
  },
  'torch:chest-abyssal-lantern': {
    archetype: 'hybrid',
    stats: { torchReach: 0.30, siltPierce: 0.28, relicGlowM: 14, sonarRange: 0.22, chestLuckBonus: 0.35 },
    power: { id: 'sovereignBeacon', name: 'Sovereign Treasure Beacon', desc: '+35% Sunken Treasure Chest Rare Drop Luck & +14m relic/chest glint' },
  },
  'torch:chest-amber-cutter': {
    archetype: 'hybrid',
    stats: { torchReach: 0.18, siltPierce: 0.48, siltCut: 0.14, relicGlowM: 6 },
    power: { id: 'amberSiltCutter', name: 'Polarized Silt-Cutter', desc: 'Slices through 48% of dense cave silt clouds & eliminates harsh torch backscatter' },
  },
  'torch:legendary-photon-lance': {
    archetype: 'hybrid',
    stats: { torchReach: 0.34, siltPierce: 0.78, relicGlowM: 14, sonarRange: 0.16 },
    power: { id: 'heliosSiltLance', name: 'Helios Silt-Piercing Lance', desc: '🔥 Legendary: Pierces 78% of blinding cave silt clouds & extends torch beam +34%' },
  },

  // Tanks
  'tank:al80-silver': { archetype: 'deep', stats: { gasSave: 0.01 } },
  'tank:hivis-yellow': { archetype: 'deep', stats: { gasSave: 0.04, decoOffgas: 0.05, bonusStartBar: 8 } },
  'tank:anodized-cobalt': { archetype: 'speed', stats: { gasSave: 0.06, swimSpeed: 0.04, bonusStartBar: 10 } },
  'tank:carbon-stealth': { archetype: 'speed', stats: { swimSpeed: 0.07, gasSave: 0.07, siltCut: 0.08, stealth: 0.16, dpvDrainCut: 0.14 } },
  'tank:salvage-brass': { archetype: 'hybrid', stats: { gasSave: 0.06, crankSpeed: 0.18, bumpArmor: 0.12, bonusStartBar: 12 } },
  'tank:sulfur-emerald-tank': { archetype: 'deep', stats: { gasSave: 0.09, decoOffgas: 0.14, bonusStartBar: 15 } },
  'tank:abyssal-titanium': { archetype: 'deep', stats: { gasSave: 0.11, narcResist: 0.14, decoOffgas: 0.12, bonusStartBar: 22 } },
  'tank:secret-dreadnought-brass': { archetype: 'combat', stats: { gasSave: 0.10, bumpArmor: 0.22, crankSpeed: 0.20, bonusStartBar: 10, combatMaxHpBonus: 15 } },
  'tank:world-hydro-tank': {
    archetype: 'speed',
    stats: { gasSave: 0.12, decoOffgas: 0.10, hydroEff: 0.14, bonusStartBar: 15, dpvDrainCut: 0.16 },
    power: { id: 'laminarMicroValve', name: 'Laminar Micro-Valve', desc: '+15 bar overfill, -12% gas burn & -16% DPV battery drain' },
  },
  'tank:world-chimney-tank': {
    archetype: 'deep',
    stats: { gasSave: 0.12, decoOffgas: 0.16, coldResist: 0.30, bonusStartBar: 18 },
    power: { id: 'thermalVentCore', name: 'Geothermal Core Tank', desc: '+18 bar overfill, +16% Bühlmann offgas & +30% warm-gas shield' },
  },
  'tank:chest-titanium-twin': {
    archetype: 'deep',
    stats: { gasSave: 0.10, decoOffgas: 0.12, bonusStartBar: 18, narcResist: 0.12 },
    power: { id: 'twinManifoldReserve', name: 'Twin-Manifold Reserve', desc: '+18 bar overpressure twinset & -10% trimix burn' },
  },
  'tank:legendary-cryo-titan-tank': {
    archetype: 'deep',
    stats: { coldResist: 0.72, narcDepthBonusM: 18, narcResist: 0.28, bonusStartBar: 34, gasSave: 0.16, armorDR: 0.14 },
    power: { id: 'cryoTitanHull', name: 'Cryo-Titan Abyssal Core', desc: '🔥 Legendary: +72% Cold Resist, +18m Depth Clarity, +34 bar Start Gas & +14% Armor' },
  },

  // Visors
  'visor:clear-cyan': { archetype: 'hybrid', stats: { relicGlowM: 1 } },
  'visor:amber-contrast': { archetype: 'speed', stats: { siltCut: 0.10, torchReach: 0.06 } },
  'visor:reef-mirror': { archetype: 'speed', stats: { relicGlowM: 4, swimSpeed: 0.04 } },
  'visor:thermocline-prism': { archetype: 'deep', stats: { coldResist: 0.30, narcResist: 0.10, narcDepthBonusM: 4, relicGlowM: 4 } },
  'visor:night-emerald': { archetype: 'deep', stats: { torchReach: 0.12, sonarRange: 0.14, narcDepthBonusM: 5 } },
  'visor:bounty-hunter-visor': { archetype: 'combat', stats: { spearPower: 0.15, spearFireRateCut: 0.10, relicGlowM: 4 } },
  'visor:secret-aurora-frost': { archetype: 'deep', stats: { coldResist: 0.50, narcResist: 0.16, narcDepthBonusM: 6, torchReach: 0.10 } },
  'visor:world-cartographer-visor': {
    archetype: 'hybrid',
    stats: { relicGlowM: 10, sonarRange: 0.14 },
    power: { id: 'relicResonanceLens', name: 'Relic Resonance Lens', desc: '+10m hidden relic & Sunken Gear Cache glint' },
  },
  'visor:world-abyss-lens': {
    archetype: 'deep',
    stats: { narcDepthBonusM: 10, narcResist: 0.16, torchReach: 0.12, gasSave: 0.06 },
    power: { id: 'abyssalClarity', name: 'Abyssal Clarity Optic', desc: '+10m narcosis depth clarity, -16% narcosis & +12% beam reach' },
  },
  'visor:world-salvage-visor': {
    archetype: 'hybrid',
    stats: { crankSpeed: 0.24, siltCut: 0.15, bumpArmor: 0.14, salvageDragCut: 0.20 },
    power: { id: 'hullBreachOptics', name: 'Hull-Breach Optics', desc: '+24% hatch cranking & -20% heavy salvage drag' },
  },
  'visor:chest-harpoon-visor': {
    archetype: 'combat',
    stats: { spearPower: 0.16, spearFireRateCut: 0.12, combatMaxHpBonus: 18 },
    power: { id: 'predatorWeakpoint', name: 'Predator Weakpoint Optic', desc: '+16% Speargun damage, +12% reload cadence & +18 Boss HP' },
  },
  'visor:chest-echo-array': {
    archetype: 'hybrid',
    stats: { sonarRange: 0.34, relicGlowM: 8 },
    power: { id: 'passiveSonar', name: 'Always-On Echo Sweep', desc: 'Continuous passive wide sonar pulse every 3.8s tagging chests, maps & relics' },
  },
  'visor:legendary-omniscanner-visor': {
    archetype: 'hybrid',
    stats: { sonarRange: 0.58, relicGlowM: 14, siltPierce: 0.18 },
    power: { id: 'omniscannerSonar', name: 'Omniscanner Tracking Array', desc: '🔥 Legendary: Always-On Wide Sonar (+58% range) continuously tracks Chests, Maps, Relics & Predators' },
  },

  // Trim & Fins
  'trim:suit-default': { archetype: 'speed', stats: { siltCut: 0.02 } },
  'trim:safety-orange': { archetype: 'speed', stats: { swimSpeed: 0.04, hydroEff: 0.08 } },
  'trim:cavern-yellow': { archetype: 'speed', stats: { siltCut: 0.10, swimSpeed: 0.04 } },
  'trim:tech-cyan': { archetype: 'speed', stats: { swimSpeed: 0.05, siltCut: 0.12, dpvSpeedBonus: 0.06 } },
  'trim:signal-crimson': { archetype: 'combat', stats: { swimSpeed: 0.06, spearPower: 0.08, dashCdCut: 0.10 } },
  'trim:salvage-gold': { archetype: 'hybrid', stats: { hydroEff: 0.12, crankSpeed: 0.12, salvageDragCut: 0.15 } },
  'trim:biolum-violet': { archetype: 'speed', stats: { siltCut: 0.18, swimSpeed: 0.06, dashCdCut: 0.12 } },
  'trim:plasma-circuit-trim': { archetype: 'speed', stats: { swimSpeed: 0.09, hydroEff: 0.16, siltCut: 0.16, dpvSpeedBonus: 0.10 } },
  'trim:secret-selenite-trim': { archetype: 'deep', stats: { siltCut: 0.24, decoOffgas: 0.12, swimSpeed: 0.07 } },
  'trim:world-hydro-fins': {
    archetype: 'speed',
    stats: { siltCut: 0.28, swimSpeed: 0.09, hydroEff: 0.24, dashCdCut: 0.15 },
    power: { id: 'siltGhost', name: 'Silt-Ghost Split Blades', desc: 'Zero floor silt kick below 1.8 m/s & +24% current agility' },
  },
  'trim:world-reef-thrusters': {
    archetype: 'combat',
    stats: { swimSpeed: 0.10, dpvSpeedBonus: 0.12, dashCdCut: 0.16, spearPower: 0.08 },
    power: { id: 'reefJetThrusters', name: 'Venturi Jet-Fin Surge', desc: '+10% swim, +12% DPV boost & -16% Hydro-Dash cooldown' },
  },
  'trim:chest-manta-fins': {
    archetype: 'speed',
    stats: { swimSpeed: 0.11, hydroEff: 0.24, siltCut: 0.22, dashCdCut: 0.14, dpvSpeedBonus: 0.08 },
    power: { id: 'mantaGlide', name: 'Manta Wing Glide', desc: '+11% swim, +24% current efficiency & faster Hydro-Dash recovery' },
  },
  'trim:legendary-slipstream-fins': {
    archetype: 'speed',
    stats: { swimSpeed: 0.22, dpvSpeedBonus: 0.24, dashCdCut: 0.26, hydroEff: 0.36, siltCut: 0.32 },
    power: { id: 'siltGhost', name: 'Slipstream Hyper-Glide', desc: '🔥 Legendary: +22% Swim, +24% DPV, -26% Dash CD & zero floor silt kick while gliding' },
  },

  // Patches / Crests
  'patch:none': { archetype: 'hybrid', stats: {} },
  'patch:cave-arrow': { archetype: 'hybrid', stats: { sonarRange: 0.06 } },
  'patch:first-descent': { archetype: 'speed', stats: { gasSave: 0.03, swimSpeed: 0.03 } },
  'patch:cenote-explorer': { archetype: 'hybrid', stats: { relicGlowM: 4, siltCut: 0.08 } },
  'patch:wreck-penetrator': { archetype: 'hybrid', stats: { crankSpeed: 0.18, bumpArmor: 0.10, salvageDragCut: 0.15, combatMaxHpBonus: 10 } },
  'patch:wildlife-biologist': { archetype: 'hybrid', stats: { siltCut: 0.12, scoreBonus: 0.05 } },
  'patch:abyss-veteran': { archetype: 'deep', stats: { narcResist: 0.12, narcDepthBonusM: 6, decoOffgas: 0.10 } },
  'patch:bounty-hunter-master': { archetype: 'combat', stats: { spearPower: 0.18, combatMaxHpBonus: 20, scoreBonus: 0.08 } },
  'patch:world-arch-crest': {
    archetype: 'deep',
    stats: { narcResist: 0.18, narcDepthBonusM: 8, decoOffgas: 0.14, gasSave: 0.06 },
    power: { id: 'deepLineFocus', name: 'Bells Archway Focus', desc: '+8m depth clarity, -18% narcosis & +14% Bühlmann deco clearing' },
  },
  'patch:world-monolith-seal': {
    archetype: 'combat',
    stats: { combatMaxHpBonus: 22, spearPower: 0.12, scoreBonus: 0.12, sonarRange: 0.14 },
    power: { id: 'monolithSovereign', name: 'Monolith Sovereign Seal', desc: '+22 Boss HP, +12% Speargun DPS, +12% Score & +14% Sonar range' },
  },
  'patch:chest-corsair-crest': {
    archetype: 'hybrid',
    stats: { scoreBonus: 0.10, crankSpeed: 0.18, relicGlowM: 6, chestLuckBonus: 0.20 },
    power: { id: 'corsairsFortune', name: "Corsair's Fortune", desc: '+20% Sunken Treasure Chest Rare Drop Luck, +10% Score & +6m Relic Glint' },
  },
  'patch:legendary-cartographer-compass': {
    archetype: 'hybrid',
    stats: { chestLuckBonus: 0.45, salvageBonus: 0.30, armorDR: 0.14, stealth: 0.16, sonarRange: 0.22, relicGlowM: 12 },
    power: { id: 'sovereignCompass', name: 'Sovereign Treasure Compass', desc: '🔥 Legendary: +45% Chest Luck, +30% Doubloons, reveals Treasure Maps on sonar + Armor & Stealth aura' },
  },

  // DPV Scooters (v233 — Loot Pool, Armor Sets & Legendary)
  'scooter:none': { archetype: 'hybrid', stats: {} },
  'scooter:expedition-dpv': { archetype: 'speed', stats: { dpvSpeedBonus: 0.08, dpvDrainCut: 0.10 } },
  'scooter:salvage-tug-dpv': { archetype: 'hybrid', stats: { dpvSpeedBonus: 0.12, dpvDrainCut: 0.14, salvageDragCut: 0.22, armorDR: 0.10 } },
  'scooter:hydro-glider-dpv': {
    archetype: 'speed',
    stats: { dpvSpeedBonus: 0.18, dpvDrainCut: 0.20, hydroEff: 0.14, siltCut: 0.18 },
    power: { id: 'laminarTow', name: 'Laminar Hydro-Drive', desc: '+18% DPV Speed, -20% Battery Drain & smooth low-silt hydro cruise' },
  },
  'scooter:phantom-whisper-dpv': {
    archetype: 'speed',
    stats: { dpvSpeedBonus: 0.16, dpvDrainCut: 0.22, stealth: 0.26, siltCut: 0.16 },
    power: { id: 'silentDrive', name: 'Silent Magneto-Drive', desc: '+26% Stealth, +16% DPV Speed & whisper-quiet impeller drive' },
  },
  'scooter:legendary-valkyrie-dpv': {
    archetype: 'speed',
    stats: { dpvSpeedBonus: 0.34, dpvDrainCut: 0.38, swimSpeed: 0.10, dashCdCut: 0.25, hydroEff: 0.25, shieldMax: 20 },
    power: { id: 'supercavitationSurge', name: 'Supercavitation Surge', desc: '🔥 Legendary: +34% DPV Overdrive, -38% Drain, +20 Hydro-Shield & -25% Dash CD' },
  },

  // Harpoons / Spearguns (v233 — Loot Pool, Armor Sets & Legendary)
  'harpoon:pneumatic-mk1': { archetype: 'combat', stats: { spearPower: 0.02 } },
  'harpoon:reef-carbine': { archetype: 'combat', stats: { spearPower: 0.08, spearFireRateCut: 0.06 } },
  'harpoon:salvage-rivet-lance': { archetype: 'combat', stats: { spearPower: 0.14, combatMaxHpBonus: 15, armorDR: 0.10 } },
  'harpoon:kraken-biolume-spear': {
    archetype: 'combat',
    stats: { spearPower: 0.18, spearFireRateCut: 0.14, stealth: 0.18, sonarRange: 0.12 },
    power: { id: 'bioTetherBolt', name: 'Bio-Tether Rail', desc: '+18% Spear DPS, +14% Fire Rate & acoustic-stealth biolume bolts' },
  },
  'harpoon:apex-hunter-railgun': {
    archetype: 'combat',
    stats: { spearPower: 0.24, spearFireRateCut: 0.16, combatMaxHpBonus: 20, dashCdCut: 0.14 },
    power: { id: 'predatorOverdrive', name: 'Predator Twin-Rail', desc: '+24% Spear DPS, +16% Fire Rate & +20 Boss Arena HP' },
  },
  'harpoon:legendary-poseidon-trident': {
    archetype: 'combat',
    stats: { spearPower: 0.38, spearFireRateCut: 0.24, combatMaxHpBonus: 28, armorDR: 0.16, shieldMax: 25, dashCdCut: 0.22 },
    power: { id: 'poseidonArcTip', name: 'Poseidon Arc-Tip', desc: '🔥 Legendary: Every 3rd shot fires a Golden Hyper-Tip + +38% Spear DPS, +25 Shield & +16% Armor' },
  },
});

const TIER_STAT_SCALE = { common: 1.0, uncommon: 1.35, rare: 1.8, epic: 2.35, mythic: 2.9, legendary: 3.6 };

function computeFallbackSlotStats(slot, tier = 'common') {
  const m = TIER_STAT_SCALE[tier] || 1.0;
  switch (slot) {
    case 'suit': return { swimSpeed: +(0.02 * m).toFixed(3), bumpArmor: +(0.05 * m).toFixed(3) };
    case 'headgear': return { narcResist: +(0.04 * m).toFixed(3), coldResist: +(0.08 * m).toFixed(3) };
    case 'torch': return { torchReach: +(0.04 * m).toFixed(3), relicGlowM: Math.round(1.5 * m) };
    case 'tank': return { gasSave: +(0.025 * m).toFixed(3), decoOffgas: +(0.03 * m).toFixed(3) };
    case 'visor': return { siltCut: +(0.04 * m).toFixed(3), sonarRange: +(0.035 * m).toFixed(3) };
    case 'trim': return { siltCut: +(0.05 * m).toFixed(3), hydroEff: +(0.04 * m).toFixed(3) };
    case 'scooter': return { dpvSpeedBonus: +(0.05 * m).toFixed(3), dpvDrainCut: +(0.06 * m).toFixed(3) };
    case 'harpoon': return { spearPower: +(0.06 * m).toFixed(3), spearFireRateCut: +(0.04 * m).toFixed(3) };
    case 'patch': return { decoOffgas: +(0.025 * m).toFixed(3), scoreBonus: +(0.015 * m).toFixed(3) };
    default: return {};
  }
}

export function formatStatPills(stats = {}) {
  const pills = [];
  if (stats.bonusStartBar >= 1) pills.push(`+${Math.round(stats.bonusStartBar)} Bar`);
  if (stats.combatMaxHpBonus >= 1) pills.push(`+${Math.round(stats.combatMaxHpBonus)} Boss HP`);
  if (stats.narcDepthBonusM >= 1) pills.push(`+${Math.round(stats.narcDepthBonusM)}m Depth`);
  if (stats.swimSpeed > 0.005) pills.push(`+${Math.round(stats.swimSpeed * 100)}% Swim`);
  if (stats.gasSave > 0.005) pills.push(`-${Math.round(stats.gasSave * 100)}% Gas`);
  if (stats.siltCut > 0.005) pills.push(`-${Math.round(stats.siltCut * 100)}% Silt`);
  if (stats.decoOffgas > 0.005) pills.push(`+${Math.round(stats.decoOffgas * 100)}% Deco`);
  if (stats.torchReach > 0.005) pills.push(`+${Math.round(stats.torchReach * 100)}% Beam`);
  if (stats.siltPierce > 0.03) pills.push(`+${Math.round(stats.siltPierce * 100)}% Silt Pierce`);
  if (stats.coldResist >= 0.99) pills.push('Cold-Proof');
  else if (stats.coldResist > 0.04) pills.push(`+${Math.round(stats.coldResist * 100)}% Cold`);
  if (stats.narcResist > 0.03) pills.push(`-${Math.round(stats.narcResist * 100)}% Narc`);
  if (stats.armorDR > 0.02) pills.push(`+${Math.round(stats.armorDR * 100)}% Armor`);
  if (stats.shieldMax >= 1) pills.push(`+${Math.round(stats.shieldMax)} Shield`);
  if (stats.stealth > 0.03) pills.push(`+${Math.round(stats.stealth * 100)}% Stealth`);
  if (stats.bumpArmor > 0.03) pills.push(`-${Math.round(stats.bumpArmor * 100)}% Shock`);
  if (stats.hydroEff > 0.03) pills.push(`+${Math.round(stats.hydroEff * 100)}% Flow`);
  if (stats.dpvSpeedBonus > 0.02) pills.push(`+${Math.round(stats.dpvSpeedBonus * 100)}% DPV`);
  if (stats.dpvDrainCut > 0.03) pills.push(`-${Math.round(stats.dpvDrainCut * 100)}% DPV Drain`);
  if (stats.spearPower > 0.03) pills.push(`+${Math.round(stats.spearPower * 100)}% Spear`);
  if (stats.spearFireRateCut > 0.03) pills.push(`+${Math.round(stats.spearFireRateCut * 100)}% RoF`);
  if (stats.dashCdCut > 0.03) pills.push(`-${Math.round(stats.dashCdCut * 100)}% Dash CD`);
  if (stats.sonarRange > 0.03) pills.push(`+${Math.round(stats.sonarRange * 100)}% Sonar`);
  if (stats.crankSpeed > 0.03) pills.push(`+${Math.round(stats.crankSpeed * 100)}% Crank`);
  if (stats.salvageDragCut > 0.03) pills.push(`-${Math.round(stats.salvageDragCut * 100)}% Haul Drag`);
  if (stats.relicGlowM >= 1) pills.push(`+${Math.round(stats.relicGlowM)}m Relic`);
  if (stats.chestLuckBonus > 0.01) pills.push(`+${Math.round(stats.chestLuckBonus * 100)}% Chest Luck`);
  if (stats.salvageBonus > 0.01) pills.push(`+${Math.round(stats.salvageBonus * 100)}% 🪙`);
  if (stats.scoreBonus > 0.01) pills.push(`+${Math.round(stats.scoreBonus * 100)}% Score`);
  return pills;
}

function inferArchetypeFromStats(stats = {}, slot = '') {
  const scores = {
    deep: (stats.bonusStartBar || 0) * 0.08 + (stats.narcDepthBonusM || 0) * 0.14 + (stats.coldResist || 0) * 1.4 + (stats.narcResist || 0) * 2.2 + (stats.decoOffgas || 0) * 2.2 + (stats.gasSave || 0) * 1.4,
    speed: (stats.swimSpeed || 0) * 3.5 + (stats.hydroEff || 0) * 2.4 + (stats.dpvSpeedBonus || 0) * 3.0 + (stats.dpvDrainCut || 0) * 1.8 + (stats.siltCut || 0) * 1.4,
    combat: (stats.combatMaxHpBonus || 0) * 0.08 + (stats.spearPower || 0) * 3.6 + (stats.spearFireRateCut || 0) * 3.0 + (stats.dashCdCut || 0) * 2.4,
    hybrid: (stats.relicGlowM || 0) * 0.18 + (stats.sonarRange || 0) * 2.4 + (stats.crankSpeed || 0) * 2.2 + (stats.salvageDragCut || 0) * 2.2 + (stats.torchReach || 0) * 1.6,
  };
  let best = slot === 'tank' ? 'deep' : slot === 'trim' ? 'speed' : 'hybrid';
  let top = 0.05;
  for (const [k, v] of Object.entries(scores)) {
    if (v > top) { top = v; best = k; }
  }
  return best;
}

/**
 * Look up the exact gameplay stats, Archetype, Legendary Power & World/Earned source for any gear item.
 */
export function getGearItemStats(slot, itemOrId) {
  const item = typeof itemOrId === 'string' ? (getGearItemBySlot(slot, itemOrId)?.item || null) : itemOrId;
  const id = item?.id || (typeof itemOrId === 'string' ? itemOrId : '');
  const key = `${slot}:${id}`;
  const bespoke = BESPOKE_ITEM_STATS[key];
  const stats = bespoke?.stats ? { ...bespoke.stats } : computeFallbackSlotStats(slot, item?.tier || 'common');
  const worldCache = WORLD_CACHE_BY_KEY.get(key) || null;
  const source = worldCache ? 'world' : item?.source || (item?.ladderRank <= 2 ? 'starter' : 'earned');
  const archetypeId = bespoke?.archetype || inferArchetypeFromStats(stats, slot);
  const archetype = GEAR_ARCHETYPES[archetypeId] || GEAR_ARCHETYPES.hybrid;
  const pills = formatStatPills(stats);
  return {
    key,
    slot,
    id,
    stats,
    pills,
    summaryText: pills.slice(0, 3).join(' · ') || 'Baseline Spec',
    power: bespoke?.power || null,
    archetypeId,
    archetype,
    source,
    worldCache,
  };
}

/**
 * Compute full aggregated dive performance profile across all 7 equipped gear slots
 * + active Diablo III 2-Piece & Full-Set Capstone bonuses + Zelda Single-Piece Powers,
 * tuned cleanly to Difficulty & Game Mode (Guided / Standard / Hardcore / Daily / Drill / Trench / Purist) (v219).
 */
export function computeRigPerformanceProfile(livery = null, tuningContext = null) {
  const tuning = resolveGearTuningProfile(tuningContext);
  const cur = {
    suit: livery?.suitId || DEFAULT_RIG_LIVERY.suitId,
    headgear: livery?.headgearId || 'zissou-cap',
    torch: livery?.torchId || DEFAULT_RIG_LIVERY.torchId,
    tank: livery?.tankId || 'al80-silver',
    visor: livery?.visorId || 'clear-cyan',
    trim: livery?.trimId || 'suit-default',
    scooter: livery?.scooterId || 'none',
    harpoon: livery?.harpoonId || 'pneumatic-mk1',
    patch: livery?.patchId || DEFAULT_RIG_LIVERY.patchId,
  };

  const sum = {
    swimSpeed: 0,
    gasSave: 0,
    siltCut: 0,
    decoOffgas: 0,
    torchReach: 0,
    siltPierce: 0,
    coldResist: 0,
    narcResist: 0,
    narcDepthBonusM: 0,
    bonusStartBar: 0,
    bumpArmor: 0,
    armorDR: 0,
    shieldMax: 0,
    stealth: 0,
    hydroEff: 0,
    dpvSpeedBonus: 0,
    dpvDrainCut: 0,
    combatMaxHpBonus: 0,
    spearPower: 0,
    spearFireRateCut: 0,
    dashCdCut: 0,
    sonarRange: 0,
    crankSpeed: 0,
    salvageDragCut: 0,
    relicGlowM: 0,
    chestLuckBonus: 0,
    salvageBonus: 0,
    scoreBonus: 0,
  };
  const archCounts = { deep: 0, speed: 0, combat: 0, hybrid: 0 };
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
    if (info.archetypeId && archCounts[info.archetypeId] !== undefined && info.pills.length > 0) {
      archCounts[info.archetypeId] += 1;
    }
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
    if (def.archetype && archCounts[def.archetype] !== undefined) {
      archCounts[def.archetype] += isCapstone ? 4 : 2;
    }
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
      archetype: def.archetype || 'hybrid',
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

  // Determine dominant build archetype + Hybrid Mix detection
  const sortedArch = Object.entries(archCounts).sort((a, b) => b[1] - a[1]);
  const distinctSetArchetypes = new Set(activeSets.map((s) => s.archetype)).size;
  const isHybridMix = distinctSetArchetypes >= 2 || (sortedArch[0][1] >= 2 && sortedArch[1][1] >= 2 && sortedArch[0][1] - sortedArch[1][1] <= 1);
  const dominantArchId = isHybridMix ? 'hybrid' : (sortedArch[0][1] > 0 ? sortedArch[0][0] : 'hybrid');
  const dominantArchetype = GEAR_ARCHETYPES[dominantArchId] || GEAR_ARCHETYPES.hybrid;

  // Reward intentional Multi-Set Hybrid Builds (combining 2+ distinct archetype set tiers)
  if (distinctSetArchetypes >= 2 && !tuning.isNormalized) {
    addStats({ swimSpeed: 0.05, gasSave: 0.04, decoOffgas: 0.06, sonarRange: 0.08, scoreBonus: 0.05 });
    powersMap.set('hybridAdaptation', {
      id: 'hybridAdaptation',
      name: 'Hybrid Adaptation',
      desc: 'Cross-archetype 2pc+2pc synergy: +5% Swim, -4% Gas, +6% Deco, +8% Sonar & +5% Score',
      source: 'hybrid-mix',
    });
  }

  // Mode, Difficulty & Trench Chamber Scaling (v219)
  const sSafe = tuning.safetyScale;
  const sMob = tuning.mobilityScale;
  const sSkill = tuning.skillScale;
  const sComb = tuning.combatScale;
  const sUtil = tuning.utilityScale;
  const trenchBoost = 1 + (tuning.trenchResonance || 0);

  // Evaluate Mastery Modifier Counter-Synergies (Blackout / Surge / Iron Lung)
  const modifierSynergies = [];
  if (!tuning.isNormalized && Array.isArray(tuning.modifiers) && tuning.modifiers.length > 0) {
    if (tuning.modifiers.includes('blackout-abyss') && (sum.torchReach >= 0.18 || sum.sonarRange >= 0.18)) {
      sum.torchReach += 0.06;
      sum.sonarRange += 0.06;
      modifierSynergies.push({
        id: 'blackout-abyss',
        icon: '🌑',
        label: 'Blackout Countered',
        desc: '+6% Torch & Sonar clarity against Blackout Abyss',
      });
    }
    if (tuning.modifiers.includes('surge-tide') && (sum.hydroEff >= 0.24 || powersMap.has('hydroGhost'))) {
      sum.hydroEff += 0.08;
      modifierSynergies.push({
        id: 'surge-tide',
        icon: '🌊',
        label: 'Surge Exploited',
        desc: '+8% Slipstream thrust harnessing Surge Tide currents',
      });
    }
    if (tuning.modifiers.includes('iron-lung') && (sum.bonusStartBar >= 15 || sum.gasSave >= 0.12)) {
      sum.gasSave += 0.04;
      modifierSynergies.push({
        id: 'iron-lung',
        icon: '🫁',
        label: 'Iron Lung Countered',
        desc: '+4% reserve efficiency offsetting Iron Lung burn',
      });
    }
  }

  const allowPow = Boolean(tuning.allowImmunities);
  const powers = tuning.isNormalized ? [] : Array.from(powersMap.values());
  const hasPower = (pid) => allowPow && powersMap.has(pid);

  // Noticeable, mode-calibrated simulation clamps that preserve build identity & difficulty tension (v219)
  const swimSpeedMult = +(1 + Math.min(tuning.maxSwimSpeed, sum.swimSpeed * sMob)).toFixed(3);
  const gasBurnMult = +(1 - Math.min(tuning.maxGasSave, sum.gasSave * sSafe)).toFixed(3);
  const siltStirMult = +(1 - Math.min(0.55, sum.siltCut * sSkill)).toFixed(3);
  const decoOffgasMult = +(1 + Math.min(0.55 * trenchBoost, sum.decoOffgas * sSkill * trenchBoost)).toFixed(3);
  const torchReachMult = +(1 + Math.min(0.55, sum.torchReach * sUtil)).toFixed(3);
  const siltPierce = +(Math.min(0.85, sum.siltPierce * sUtil)).toFixed(2);
  const coldResist = +(Math.min(tuning.maxColdResist, sum.coldResist * sSafe)).toFixed(2);
  const narcResist = +(Math.min(tuning.maxNarcResist, sum.narcResist * sSafe)).toFixed(2);
  const narcDepthBonusM = Math.min(Math.round(tuning.maxNarcDepthM * trenchBoost), Math.round(sum.narcDepthBonusM * sSafe * trenchBoost));
  const bonusStartBar = Math.min(Math.round(tuning.maxBonusStartBar * trenchBoost), Math.round(sum.bonusStartBar * sSafe * trenchBoost));
  const bumpArmor = +(Math.min(0.70, sum.bumpArmor * sSafe)).toFixed(2);
  const armorDR = +(Math.min(0.48, sum.armorDR * sSafe)).toFixed(2);
  const shieldMax = tuning.isNormalized ? 0 : Math.min(60, Math.round(sum.shieldMax * sSafe));
  const stealth = +(Math.min(0.68, sum.stealth * sSkill)).toFixed(2);
  const hydroEfficiency = +(Math.min(0.60, sum.hydroEff * sSkill * trenchBoost)).toFixed(2);
  const dpvSpeedBonus = +(Math.min(0.42, sum.dpvSpeedBonus * sMob)).toFixed(3);
  const dpvDrainMult = +(1 - Math.min(0.50, sum.dpvDrainCut * sMob * trenchBoost)).toFixed(3);
  const combatMaxHpBonus = Math.min(tuning.maxCombatHp, Math.round(sum.combatMaxHpBonus * sSafe));
  const spearPowerMult = +(1 + Math.min(tuning.maxSpearPower, sum.spearPower * sComb)).toFixed(3);
  const spearFireRateMult = +(1 - Math.min(0.20, sum.spearFireRateCut * sSkill)).toFixed(3);
  const dashCooldownMult = +(1 - Math.min(0.38, sum.dashCdCut * sSkill)).toFixed(3);
  const sonarRangeMult = +(1 + Math.min(0.68, sum.sonarRange * sUtil)).toFixed(3);
  const crankSpeedMult = +(1 + Math.min(1.10, sum.crankSpeed * sSkill)).toFixed(3);
  const salvageDragCut = +(Math.min(0.60, sum.salvageDragCut * sUtil)).toFixed(2);
  const relicGlowBonusM = Math.min(26, Math.round(sum.relicGlowM * sUtil));
  const chestLuckBonus = tuning.isNormalized ? 0 : +(Math.min(0.85, sum.chestLuckBonus)).toFixed(2);
  const salvageBonusMult = tuning.isNormalized ? 1.0 : +(1 + Math.min(0.45, sum.salvageBonus)).toFixed(2);
  const rawScoreBonus = tuning.isNormalized ? 0 : (sum.scoreBonus + (activeSets.length > 0 || powers.length > 0 ? (tuning.scoreBonusAdd || 0) : 0));
  const scoreBonusMult = +(1 + Math.min(0.35, rawScoreBonus)).toFixed(3);

  return {
    swimSpeedMult,
    gasBurnMult,
    siltStirMult,
    decoOffgasMult,
    torchReachMult,
    siltPierce,
    coldResist,
    narcResist,
    narcDepthBonusM,
    bonusStartBar,
    bumpArmor,
    armorDR,
    shieldMax,
    stealth,
    hydroEfficiency,
    dpvSpeedBonus,
    dpvDrainMult,
    combatMaxHpBonus,
    spearPowerMult,
    spearFireRateMult,
    dashCooldownMult,
    sonarRangeMult,
    crankSpeedMult,
    salvageDragCut,
    relicGlowBonusM,
    chestLuckBonus,
    salvageBonusMult,
    scoreBonusMult,
    // Named Legendary / Capstone mechanical flags (gated cleanly by mode tuning)
    siltGhost: hasPower('siltGhost'),
    percolationImmune: hasPower('percolationImmune'),
    hatchKnockbackImmune: hasPower('hatchKnockbackImmune'),
    halcyonDecoFastLock: hasPower('halcyonDecoFastLock'),
    apexOvercharge: hasPower('apexOvercharge') || hasPower('poseidonArcTip'),
    relicCompass: hasPower('relicCompass') || hasPower('sovereignCompass'),
    hydroGhost: hasPower('hydroGhost'),
    hybridAdaptation: hasPower('hybridAdaptation'),
    passiveSonar: hasPower('passiveSonar') || hasPower('omniscannerSonar'),
    sonarTrackPredators: hasPower('omniscannerSonar'),
    mapSonarTrack: hasPower('sovereignCompass') || hasPower('omniscannerSonar'),
    powers,
    activeSets: tuning.isNormalized ? [] : activeSets,
    capstoneActive: tuning.isNormalized ? false : capstoneActive,
    dominantArchetype,
    isHybridMix,
    tuning,
    modifierSynergies,
  };
}

/**
 * Compare equipped vs preview/hovered rig profile for Diablo III green/red stat deltas.
 */
export function diffRigPerformanceProfiles(baseProf, nextProf) {
  if (!baseProf || !nextProf) return [];
  const specs = [
    { key: 'bonusStartBar', label: 'Start Bar', scale: 1, unit: 'b', higherBetter: true, weight: 0.7 },
    { key: 'combatMaxHpBonus', label: 'Boss HP', scale: 1, unit: '', higherBetter: true, weight: 0.65 },
    { key: 'narcDepthBonusM', label: 'Depth Clarity', scale: 1, unit: 'm', higherBetter: true, weight: 0.9 },
    { key: 'swimSpeedMult', label: 'Swim', scale: 100, unit: '%', higherBetter: true, weight: 1.5 },
    { key: 'gasBurnMult', label: 'Gas Save', scale: -100, unit: '%', higherBetter: true, weight: 1.4 },
    { key: 'siltStirMult', label: 'Silt Ctrl', scale: -100, unit: '%', higherBetter: true, weight: 0.75 },
    { key: 'decoOffgasMult', label: 'Deco', scale: 100, unit: '%', higherBetter: true, weight: 0.9 },
    { key: 'spearPowerMult', label: 'Spear', scale: 100, unit: '%', higherBetter: true, weight: 1.3 },
    { key: 'spearFireRateMult', label: 'Fire Rate', scale: -100, unit: '%', higherBetter: true, weight: 1.2 },
    { key: 'dashCooldownMult', label: 'Dash CD', scale: -100, unit: '%', higherBetter: true, weight: 0.8 },
    { key: 'dpvSpeedBonus', label: 'DPV Speed', scale: 100, unit: '%', higherBetter: true, weight: 1.0 },
    { key: 'dpvDrainMult', label: 'DPV Batt', scale: -100, unit: '%', higherBetter: true, weight: 0.8 },
    { key: 'torchReachMult', label: 'Beam', scale: 100, unit: '%', higherBetter: true, weight: 0.75 },
    { key: 'siltPierce', label: 'Silt Pierce', scale: 100, unit: '%', higherBetter: true, weight: 1.25 },
    { key: 'sonarRangeMult', label: 'Sonar', scale: 100, unit: '%', higherBetter: true, weight: 0.9 },
    { key: 'coldResist', label: 'Cold Res', scale: 100, unit: '%', higherBetter: true, weight: 0.55 },
    { key: 'narcResist', label: 'Narc Res', scale: 100, unit: '%', higherBetter: true, weight: 0.6 },
    { key: 'armorDR', label: 'Armor', scale: 100, unit: '%', higherBetter: true, weight: 1.15 },
    { key: 'shieldMax', label: 'Shield', scale: 1, unit: '', higherBetter: true, weight: 1.05 },
    { key: 'stealth', label: 'Stealth', scale: 100, unit: '%', higherBetter: true, weight: 1.15 },
    { key: 'bumpArmor', label: 'Shock Res', scale: 100, unit: '%', higherBetter: true, weight: 0.55 },
    { key: 'hydroEfficiency', label: 'Flow', scale: 100, unit: '%', higherBetter: true, weight: 0.85 },
    { key: 'crankSpeedMult', label: 'Crank', scale: 100, unit: '%', higherBetter: true, weight: 0.5 },
    { key: 'salvageDragCut', label: 'Haul', scale: 100, unit: '%', higherBetter: true, weight: 0.5 },
    { key: 'relicGlowBonusM', label: 'Relic', scale: 1, unit: 'm', higherBetter: true, weight: 0.75 },
    { key: 'chestLuckBonus', label: 'Chest Luck', scale: 100, unit: '%', higherBetter: true, weight: 0.9 },
    { key: 'scoreBonusMult', label: 'Score', scale: 100, unit: '%', higherBetter: true, weight: 0.7 },
  ];
  const diffs = [];
  for (const sp of specs) {
    const delta = Math.round(((nextProf[sp.key] || 0) - (baseProf[sp.key] || 0)) * sp.scale);
    if (delta === 0) continue;
    diffs.push({
      key: sp.key,
      label: sp.label,
      delta,
      weight: sp.weight || 1,
      positive: sp.higherBetter ? delta > 0 : delta < 0,
      text: `${delta > 0 ? '+' : ''}${delta}${sp.unit} ${sp.label}`,
    });
  }
  return diffs;
}

/**
 * Instantly evaluate whether a discovered gear item upgrades, trades off, or downgrades
 * the diver's currently equipped mid-dive rig, including exact stat deltas, Powers & Set Tiers (v221).
 */
export function evaluateLootUpgradeImpact(currentLivery, slot, itemId, tuningCtx = null) {
  const curRig = { ...DEFAULT_RIG_LIVERY, ...(currentLivery && typeof currentLivery === 'object' ? currentLivery : {}) };
  const newEntry = getGearItemBySlot(slot, itemId);
  const field = newEntry?.field || null;
  const resolvedCur = resolveDiverLiveryPalette(curRig);
  const curSlotItem = resolvedCur?.[slot === 'trim' ? 'trimSpec' : slot] || null;
  const curId = (field && curRig[field]) || curSlotItem?.id || null;
  const curEntry = curId ? getGearItemBySlot(slot, curId) : null;
  const replacedItemName = curEntry?.item?.name || curSlotItem?.name || 'Standard Issue';
  const newItemName = newEntry?.item?.name || itemId;

  const baseProf = computeRigPerformanceProfile(curRig, tuningCtx);
  const nextRig = field ? { ...curRig, [field]: itemId } : curRig;
  const nextProf = computeRigPerformanceProfile(nextRig, tuningCtx);

  if (curId === itemId) {
    return {
      verdict: 'same',
      verdictIcon: '✓',
      verdictLabel: 'ALREADY EQUIPPED',
      slot,
      field,
      replacedItemName,
      newItemName,
      deltas: [],
      gainedPowers: [],
      lostPowers: [],
      setChanges: [],
      archBefore: baseProf.dominantArchetype,
      archAfter: nextProf.dominantArchetype,
      archChanged: false,
      isNormalized: Boolean(baseProf.tuning?.isNormalized),
    };
  }

  if (baseProf.tuning?.isNormalized) {
    return {
      verdict: 'same',
      verdictIcon: '🧭',
      verdictLabel: 'COSMETIC ONLY (PURIST)',
      slot,
      field,
      replacedItemName,
      newItemName,
      deltas: [],
      gainedPowers: [],
      lostPowers: [],
      setChanges: [],
      archBefore: baseProf.dominantArchetype,
      archAfter: nextProf.dominantArchetype,
      archChanged: false,
      isNormalized: true,
    };
  }

  const rawDeltas = diffRigPerformanceProfiles(baseProf, nextProf);
  const posDeltas = rawDeltas.filter((d) => d.positive).sort((a, b) => Math.abs(b.delta * b.weight) - Math.abs(a.delta * a.weight));
  const negDeltas = rawDeltas.filter((d) => !d.positive).sort((a, b) => Math.abs(b.delta * b.weight) - Math.abs(a.delta * a.weight));
  const deltas = [...posDeltas, ...negDeltas];

  const basePwrMap = new Map((baseProf.powers || []).map((p) => [p.id, p]));
  const nextPwrMap = new Map((nextProf.powers || []).map((p) => [p.id, p]));
  const gainedPowers = (nextProf.powers || []).filter((p) => !basePwrMap.has(p.id));
  const lostPowers = (baseProf.powers || []).filter((p) => !nextPwrMap.has(p.id));

  const baseSetMap = new Map((baseProf.activeSets || []).map((s) => [s.id, s]));
  const nextSetMap = new Map((nextProf.activeSets || []).map((s) => [s.id, s]));
  const setChanges = [];
  for (const [id, ns] of nextSetMap.entries()) {
    const bs = baseSetMap.get(id);
    if (!bs) {
      setChanges.push({ positive: true, text: `Activates ${ns.icon} ${ns.name} (${ns.matched}/${ns.capstoneReq})` });
    } else if (ns.capstoneActive && !bs.capstoneActive) {
      setChanges.push({ positive: true, text: `Unlocks ${ns.icon} ${ns.name} Capstone!` });
    }
  }
  for (const [id, bs] of baseSetMap.entries()) {
    const ns = nextSetMap.get(id);
    if (!ns) {
      setChanges.push({ positive: false, text: `Breaks ${bs.icon} ${bs.name} Set` });
    } else if (bs.capstoneActive && !ns.capstoneActive) {
      setChanges.push({ positive: false, text: `Loses ${bs.icon} ${bs.name} Capstone` });
    }
  }

  // Score net impact (weighted stat gains + powers + set tiers)
  let posScore = posDeltas.reduce((acc, d) => acc + Math.abs(d.delta) * d.weight, 0);
  let negScore = negDeltas.reduce((acc, d) => acc + Math.abs(d.delta) * d.weight, 0);
  posScore += gainedPowers.length * 22 + setChanges.filter((s) => s.positive).length * 28;
  negScore += lostPowers.length * 22 + setChanges.filter((s) => !s.positive).length * 28;

  let verdict = 'tradeoff';
  let verdictIcon = '⇄';
  let verdictLabel = 'BUILD TRADE-OFF';
  if (posScore > 0 && (negScore === 0 || posScore >= negScore * 1.85)) {
    verdict = 'upgrade';
    verdictIcon = '▲';
    verdictLabel = 'UPGRADE FOR YOUR BUILD';
  } else if (negScore > 0 && (posScore === 0 || negScore >= posScore * 1.85)) {
    verdict = 'downgrade';
    verdictIcon = '▼';
    verdictLabel = 'LOWER THAN EQUIPPED';
  }

  const archBefore = baseProf.isHybridMix ? GEAR_ARCHETYPES.hybrid : baseProf.dominantArchetype;
  const archAfter = nextProf.isHybridMix ? GEAR_ARCHETYPES.hybrid : nextProf.dominantArchetype;
  const archChanged = Boolean(archBefore?.id && archAfter?.id && archBefore.id !== archAfter.id);

  return {
    verdict,
    verdictIcon,
    verdictLabel,
    slot,
    field,
    replacedItemName,
    newItemName,
    deltas,
    gainedPowers,
    lostPowers,
    setChanges,
    archBefore,
    archAfter,
    archChanged,
    isNormalized: false,
  };
}

/**
 * Recommend the best Gear Build Archetype for any expedition site so players exploit
 * Deep Tech, Speed/Hydro, Boss Combat, or Explorer/Salvage builds strategically (v218).
 */
export function getRecommendedArchetypeForLevel(level) {
  if (!level) return GEAR_ARCHETYPES.hybrid;
  const id = String(level.id || '').toLowerCase();
  const maxD = Number(level.maxDepthM) || 35;
  if (level.isWreck) return GEAR_ARCHETYPES.hybrid;
  if (/plura|strytan|scoresby|silfra|kverkfjoll|krubera|boy-bulok|boesmansgat|hranicka|pozzo|dahab/i.test(id) || maxD >= 65) {
    return GEAR_ARCHETYPES.deep;
  }
  if (/vaucluse|wakulla|eagles-nest|cenote|dos-ojos|sac-actun|orda/i.test(id) || (Array.isArray(level.caveCurrents) && level.caveCurrents.length > 0)) {
    return GEAR_ARCHETYPES.speed;
  }
  return GEAR_ARCHETYPES.hybrid;
}

/**
 * Return World Gear Cache discovery status for a given dive site (used in Site Browser badges).
 */
export function getWorldGearCachesForSite(levelId, foundGearMap = null) {
  if (!levelId) return [];
  const found = foundGearMap && typeof foundGearMap === 'object' ? foundGearMap : {};
  return WORLD_GEAR_CACHES.filter((c) => c.levelId === levelId).map((c) => {
    const key = `${c.slot}:${c.itemId}`;
    const item = getGearItemBySlot(c.slot, c.itemId)?.item || null;
    const stats = getGearItemStats(c.slot, item || c.itemId);
    return {
      ...c,
      gearKey: key,
      itemName: item?.name || c.itemId,
      archetype: stats.archetype,
      found: Boolean(found[key]),
    };
  });
}

const TIER_BEAM_COLORS = {
  common: '#94a3b8',
  uncommon: '#34d399',
  rare: '#38bdf8',
  epic: '#c084fc',
  mythic: '#facc15',
  legendary: '#ff9524',
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

/**
 * Expanded Random Treasure Chest & Treasure-Map Vault Chase Gear Pool (v230).
 * 17 discoverable items spanning Rare, Epic, Mythic, and Ultra-Rare Legendary tiers,
 * tagged with their primary Skill Focus (`speed`, `visibility`, `sonar`, `resistance`, `armor`, `stealth`)
 * so Treasure Maps unambiguously guide players to the exact skill upgrade they're hunting!
 */
export const CHEST_GEAR_DROPS = Object.freeze([
  // Ultra-Rare Legendary Crown Jewels (~0.8% base; up to ~5.5% in Map Vaults / High Luck)
  Object.freeze({ slot: 'suit', itemId: 'legendary-aegis-exosuit', tier: 'legendary', skillId: 'armor', rarityLabel: 'ULTRA-RARE LEGENDARY', baseChance: 0.008, icon: '🛡️' }),
  Object.freeze({ slot: 'torch', itemId: 'legendary-photon-lance', tier: 'legendary', skillId: 'visibility', rarityLabel: 'ULTRA-RARE LEGENDARY', baseChance: 0.008, icon: '🔦' }),
  Object.freeze({ slot: 'visor', itemId: 'legendary-omniscanner-visor', tier: 'legendary', skillId: 'sonar', rarityLabel: 'ULTRA-RARE LEGENDARY', baseChance: 0.008, icon: '📡' }),
  Object.freeze({ slot: 'trim', itemId: 'legendary-slipstream-fins', tier: 'legendary', skillId: 'speed', rarityLabel: 'ULTRA-RARE LEGENDARY', baseChance: 0.008, icon: '⚡' }),
  Object.freeze({ slot: 'headgear', itemId: 'legendary-phantom-shroud', tier: 'legendary', skillId: 'stealth', rarityLabel: 'ULTRA-RARE LEGENDARY', baseChance: 0.008, icon: '🥷' }),
  Object.freeze({ slot: 'tank', itemId: 'legendary-cryo-titan-tank', tier: 'legendary', skillId: 'resistance', rarityLabel: 'ULTRA-RARE LEGENDARY', baseChance: 0.008, icon: '❄️' }),
  Object.freeze({ slot: 'patch', itemId: 'legendary-cartographer-compass', tier: 'legendary', skillId: 'sonar', rarityLabel: 'ULTRA-RARE LEGENDARY', baseChance: 0.008, icon: '🧭' }),
  Object.freeze({ slot: 'scooter', itemId: 'legendary-valkyrie-dpv', tier: 'legendary', skillId: 'speed', rarityLabel: 'ULTRA-RARE LEGENDARY', baseChance: 0.008, icon: '🛴' }),
  Object.freeze({ slot: 'harpoon', itemId: 'legendary-poseidon-trident', tier: 'legendary', skillId: 'armor', rarityLabel: 'ULTRA-RARE LEGENDARY', baseChance: 0.008, icon: '🔱' }),
  // Very Rare Mythic Drops
  Object.freeze({ slot: 'suit', itemId: 'chest-nautilus-suit', tier: 'mythic', skillId: 'resistance', rarityLabel: 'VERY RARE MYTHIC', baseChance: 0.035, icon: '🐚' }),
  Object.freeze({ slot: 'torch', itemId: 'chest-abyssal-lantern', tier: 'mythic', skillId: 'visibility', rarityLabel: 'VERY RARE MYTHIC', baseChance: 0.035, icon: '🏮' }),
  // Rare Epic Specialist Drops
  Object.freeze({ slot: 'suit', itemId: 'chest-bulwark-shell', tier: 'epic', skillId: 'armor', rarityLabel: 'RARE EPIC', baseChance: 0.075, icon: '🛡️' }),
  Object.freeze({ slot: 'torch', itemId: 'chest-amber-cutter', tier: 'epic', skillId: 'visibility', rarityLabel: 'RARE EPIC', baseChance: 0.075, icon: '🔦' }),
  Object.freeze({ slot: 'visor', itemId: 'chest-echo-array', tier: 'epic', skillId: 'sonar', rarityLabel: 'RARE EPIC', baseChance: 0.075, icon: '📡' }),
  Object.freeze({ slot: 'trim', itemId: 'chest-manta-fins', tier: 'epic', skillId: 'speed', rarityLabel: 'RARE EPIC', baseChance: 0.075, icon: '🪽' }),
  Object.freeze({ slot: 'visor', itemId: 'chest-harpoon-visor', tier: 'epic', skillId: 'armor', rarityLabel: 'RARE EPIC', baseChance: 0.075, icon: '🎯' }),
  Object.freeze({ slot: 'scooter', itemId: 'hydro-glider-dpv', tier: 'epic', skillId: 'speed', rarityLabel: 'RARE EPIC', baseChance: 0.075, icon: '🛴' }),
  Object.freeze({ slot: 'scooter', itemId: 'phantom-whisper-dpv', tier: 'epic', skillId: 'stealth', rarityLabel: 'RARE EPIC', baseChance: 0.075, icon: '🛴' }),
  Object.freeze({ slot: 'harpoon', itemId: 'kraken-biolume-spear', tier: 'epic', skillId: 'stealth', rarityLabel: 'RARE EPIC', baseChance: 0.075, icon: '🔱' }),
  Object.freeze({ slot: 'harpoon', itemId: 'apex-hunter-railgun', tier: 'epic', skillId: 'armor', rarityLabel: 'RARE EPIC', baseChance: 0.075, icon: '🔱' }),
  // Veteran Rare Drops
  Object.freeze({ slot: 'headgear', itemId: 'chest-ghost-hood', tier: 'rare', skillId: 'stealth', rarityLabel: 'RARE DROP', baseChance: 0.13, icon: '🥷' }),
  Object.freeze({ slot: 'tank', itemId: 'chest-titanium-twin', tier: 'rare', skillId: 'resistance', rarityLabel: 'RARE DROP', baseChance: 0.13, icon: '🫧' }),
  Object.freeze({ slot: 'patch', itemId: 'chest-corsair-crest', tier: 'rare', skillId: 'speed', rarityLabel: 'RARE DROP', baseChance: 0.13, icon: '🏴‍☠️' }),
  Object.freeze({ slot: 'scooter', itemId: 'salvage-tug-dpv', tier: 'rare', skillId: 'speed', rarityLabel: 'RARE DROP', baseChance: 0.13, icon: '🛴' }),
  Object.freeze({ slot: 'harpoon', itemId: 'salvage-rivet-lance', tier: 'rare', skillId: 'armor', rarityLabel: 'RARE DROP', baseChance: 0.13, icon: '🔱' }),
]);

/**
 * Compute balanced Treasure Chest drop-luck multiplier from Difficulty, Mastery Modifiers,
 * Trench Chamber depth, equipped Luck gear (Sovereign Lantern / Compass / Corsair Crest),
 * chest tier (brass / grotto / vault), and gentle bad-luck protection (v220 / v230).
 */
export function computeChestDropLuck({
  difficulty = 'standard',
  modifiers = [],
  trenchChamber = 0,
  rigPerf = null,
  dryStreak = 0,
  chestTier = 'brass',
  isMapVault = false,
} = {}) {
  const diffMult = difficulty === 'hardcore' ? 1.65 : difficulty === 'guided' ? 0.75 : 1.0;
  const modBonus = Array.isArray(modifiers) ? Math.min(0.6, modifiers.length * 0.2) : 0;
  const trenchBonus = trenchChamber >= 2 ? Math.min(0.9, (trenchChamber - 1) * 0.18) : 0;
  const gearLuck = Math.max(0, Number(rigPerf?.chestLuckBonus) || 0);
  const pityBonus = Math.min(0.85, Math.max(0, Number(dryStreak) || 0) * 0.09);
  const vaultBonus = isMapVault || chestTier === 'vault' ? 0.65 : chestTier === 'grotto' ? 0.25 : 0;
  return +(Math.min(4.2, diffMult + modBonus + trenchBonus + gearLuck + pityBonus + vaultBonus)).toFixed(2);
}

/**
 * Roll balanced loot when opening a discoverable Sunken Treasure Chest or Treasure-Map Vault (v230).
 * - Ultra-Rare Legendary drops start at ~0.8% base (up to ~5.5% in Map Vaults / high luck).
 * - Map-Linked Vault Chests (`skillFocus`) guarantee a gear drop matching that advertised Skill
 *   whenever any unowned piece exists for that skill, making Treasure Maps genuinely rewarding!
 */
export function rollTreasureChestLoot({
  foundGearMap = null,
  tuningCtx = null,
  rigPerf = null,
  dryStreak = 0,
  hasDpv = false,
  isFirstChestEver = false,
  skillFocus = null,
  chestTier = 'brass',
  isMapVault = false,
  rng = Math.random,
} = {}) {
  const found = foundGearMap && typeof foundGearMap === 'object' ? foundGearMap : {};
  const luck = computeChestDropLuck({
    difficulty: tuningCtx?.difficulty || 'standard',
    modifiers: tuningCtx?.modifiers || [],
    trenchChamber: tuningCtx?.trenchChamber || 0,
    rigPerf,
    dryStreak,
    chestTier,
    isMapVault,
  });

  const roll = Math.max(0, Math.min(0.999999, Number(rng()) || 0));
  const legendaryP = Math.min(isMapVault ? 0.055 : 0.032, (isMapVault ? 0.018 : 0.008) * luck);
  const mythicP = Math.min(0.15, (isMapVault ? 0.055 : 0.035) * luck);
  const epicP = Math.min(0.24, (isMapVault ? 0.12 : 0.075) * luck);
  const rareP = Math.min(0.32, 0.13 * luck);

  const pickUnowned = (tier, skillOnly = null) => {
    const pool = CHEST_GEAR_DROPS.filter(
      (d) => d.tier === tier && !found[`${d.slot}:${d.itemId}`] && (!skillOnly || d.skillId === skillOnly)
    );
    if (pool.length === 0) return null;
    return pool[Math.floor((Number(rng()) || 0) * pool.length) % pool.length];
  };

  let chosenGear = null;
  if (skillFocus) {
    // Treasure-Map Vault Chest: honor the advertised Skill with boosted rarity roll!
    if (roll < legendaryP) {
      chosenGear = pickUnowned('legendary', skillFocus) || pickUnowned('mythic', skillFocus) || pickUnowned('epic', skillFocus) || pickUnowned('rare', skillFocus);
    } else if (roll < legendaryP + mythicP) {
      chosenGear = pickUnowned('mythic', skillFocus) || pickUnowned('epic', skillFocus) || pickUnowned('rare', skillFocus) || pickUnowned('legendary', skillFocus);
    } else if (roll < legendaryP + mythicP + epicP + 0.25) {
      chosenGear = pickUnowned('epic', skillFocus) || pickUnowned('rare', skillFocus) || pickUnowned('mythic', skillFocus) || pickUnowned('legendary', skillFocus);
    } else {
      chosenGear = pickUnowned('rare', skillFocus) || pickUnowned('epic', skillFocus) || pickUnowned('mythic', skillFocus) || pickUnowned('legendary', skillFocus);
    }
    // If every piece in that skill is already owned, still give a fair roll on any unowned chest piece
    if (!chosenGear && roll < 0.45) {
      chosenGear = pickUnowned('epic') || pickUnowned('rare') || pickUnowned('mythic');
    }
  } else if (isFirstChestEver && !CHEST_GEAR_DROPS.some((d) => Boolean(found[`${d.slot}:${d.itemId}`]))) {
    // Make a new player's very first Sunken Treasure Chest unforgettable with a guaranteed Rare chest relic!
    chosenGear = pickUnowned('rare');
  } else if (roll < legendaryP) {
    chosenGear = pickUnowned('legendary') || pickUnowned('mythic') || pickUnowned('epic') || pickUnowned('rare');
  } else if (roll < legendaryP + mythicP) {
    chosenGear = pickUnowned('mythic') || pickUnowned('epic') || pickUnowned('rare');
  } else if (roll < legendaryP + mythicP + epicP) {
    chosenGear = pickUnowned('epic') || pickUnowned('rare');
  } else if (roll < legendaryP + mythicP + epicP + rareP) {
    chosenGear = pickUnowned('rare');
  }

  if (chosenGear) {
    const gearKey = `${chosenGear.slot}:${chosenGear.itemId}`;
    const itemMeta = getGearItemBySlot(chosenGear.slot, chosenGear.itemId)?.item || null;
    const statsInfo = getGearItemStats(chosenGear.slot, itemMeta || chosenGear.itemId);
    const ptsByTier = { legendary: 1500, mythic: 850, epic: 550, rare: 350 };
    return {
      kind: 'gear',
      gearKey,
      slot: chosenGear.slot,
      itemId: chosenGear.itemId,
      skillId: chosenGear.skillId || skillFocus || null,
      name: itemMeta?.name || chosenGear.itemId,
      tier: chosenGear.tier,
      rarityLabel: chosenGear.rarityLabel,
      icon: chosenGear.icon,
      points: ptsByTier[chosenGear.tier] || 400,
      gasBonusBar: chosenGear.tier === 'legendary' ? 18 : 10,
      luckMult: luck,
      beamColor: TIER_BEAM_COLORS[chosenGear.tier] || '#facc15',
      statsInfo,
      fromMapVault: Boolean(isMapVault || skillFocus),
    };
  }

  // Rewarding non-gear sunken treasure salvage (Map Vaults pay out extra-generous jackpots if skill pool is complete!)
  const salvageRoll = Number(rng()) || 0;
  if (isMapVault) {
    return {
      kind: 'reliquary',
      tier: 'epic',
      rarityLabel: 'VAULT SALVAGE JACKPOT',
      icon: '💎',
      name: 'Sunken Cartographer Vault Hoard',
      detail: '+1100 Bonus Score, +20 bar reserve & hefty Salvage Doubloons',
      points: 1100,
      gasBonusBar: 20,
      doubloonBonus: 185,
      calmHr: true,
      luckMult: luck,
      beamColor: TIER_BEAM_COLORS.epic,
      fromMapVault: true,
    };
  }
  if (salvageRoll < 0.34) {
    return {
      kind: 'gas-cache',
      tier: 'uncommon',
      rarityLabel: 'SPARE PONY BOTTLE',
      icon: '🫧',
      name: 'Sealed Trimix Pony Bottle',
      detail: '+22 bar instant reserve refill & +300 Salvage pts',
      points: 300,
      gasBonusBar: 22,
      luckMult: luck,
      beamColor: TIER_BEAM_COLORS.uncommon,
    };
  }
  if (hasDpv && salvageRoll < 0.56) {
    return {
      kind: 'dpv-cell',
      tier: 'rare',
      rarityLabel: 'HIGH-DENSITY CELL',
      icon: '🔋',
      name: 'Watertight DPV Lithium Pack',
      detail: '+45% DPV Scooter charge & +350 Salvage pts',
      points: 350,
      dpvBatteryBonus: 45,
      luckMult: luck,
      beamColor: TIER_BEAM_COLORS.rare,
    };
  }
  if (salvageRoll < 0.84) {
    return {
      kind: 'doubloons',
      tier: 'rare',
      rarityLabel: 'SUNKEN TREASURE',
      icon: '🪙',
      name: 'Gilded Expedition Doubloons',
      detail: '+550 Expedition Bonus Score & +10 bar calm reserve',
      points: 550,
      gasBonusBar: 10,
      luckMult: luck,
      beamColor: TIER_BEAM_COLORS.rare,
    };
  }
  return {
    kind: 'reliquary',
    tier: 'epic',
    rarityLabel: 'RARE RELIQUARY',
    icon: '💎',
    name: 'Abyssal Pearl Reliquary',
    detail: '+850 Bonus Score, +15 bar reserve & calm HR recovery',
    points: 850,
    gasBonusBar: 15,
    calmHr: true,
    luckMult: luck,
    beamColor: TIER_BEAM_COLORS.epic,
  };
}

function _hashChestSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Spawn 1–3 tiered discoverable Sunken Treasure Chests in verified navigable open water
 * on any expedition site or Endless Trench chamber (v220 / v230).
 * Deeper pockets yield Grotto Relic Chests with elevated rare/legendary drop luck!
 */
export function createTreasureChestsForLevel(level, { seed = null, excludePoints = [] } = {}) {
  if (!level || level.isProvingGrounds) return [];
  const segs = Array.isArray(level.segments) ? level.segments : [];
  if (segs.length < 2) return [];

  const spawnX = level.spawn?.x ?? 10;
  const spawnY = level.spawn?.y ?? 2;
  const seedVal = Number.isFinite(seed)
    ? (seed >>> 0)
    : _hashChestSeed(`${level.id || 'site'}:${Date.now() ^ Math.floor(Math.random() * 1e9)}`);

  // Deterministic PRNG per dive run so chests appear in fresh exciting side-alcoves each expedition!
  let s = (seedVal || 1337) >>> 0;
  const nextRng = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };

  // Scale chest count with site length & depth: intro 2 chests (so 1 can be a Map Vault!), grand deep sites 3 chests
  const desiredCount =
    segs.length >= 10 || (level.maxDepthM || 0) >= 80
      ? 3
      : segs.length >= 4 || (level.maxDepthM || 0) >= 35
        ? 2
        : 1;
  const chests = [];
  const usedFracs =
    desiredCount >= 3
      ? [0.30 + nextRng() * 0.12, 0.56 + nextRng() * 0.12, 0.78 + nextRng() * 0.14]
      : [0.36 + nextRng() * 0.14, 0.68 + nextRng() * 0.16];

  for (let i = 0; i < desiredCount; i++) {
    const segIdx = Math.max(1, Math.min(segs.length - 1, Math.floor(segs.length * usedFracs[i % usedFracs.length])));
    const seg = segs[segIdx];
    const ax = seg.x1 ?? seg.ax ?? 0;
    const ay = seg.y1 ?? seg.ay ?? 10;
    const bx = seg.x2 ?? seg.bx ?? ax;
    const by = seg.y2 ?? seg.by ?? ay;
    const mx = (ax + bx) * 0.5;
    const my = (ay + by) * 0.5;
    const r = Math.max(1.2, (seg.r ?? seg.ra ?? seg.radius ?? 3.2) * 0.52);
    const sign = nextRng() < 0.5 ? -1 : 1;

    const candidates = [
      { x: mx + sign * r * 0.58, y: my + r * 0.44 },
      { x: mx - sign * r * 0.48, y: my + r * 0.34 },
      { x: mx, y: my },
    ];
    let best = null;
    for (const pt of candidates) {
      if (Math.hypot(pt.x - spawnX, pt.y - spawnY) < 9.5) continue;
      if (excludePoints.some((ep) => Math.hypot(pt.x - ep.x, pt.y - ep.y) < 6.5)) continue;
      if (chests.some((c) => Math.hypot(pt.x - c.x, pt.y - c.y) < 11)) continue;
      if (evaluateCaveSDF(level, pt.x, pt.y) < -0.65) {
        best = pt;
        break;
      }
    }
    if (!best) continue;

    const chestTier = i === 0 ? 'brass' : 'grotto';
    chests.push({
      id: `chest-${level.id || 's'}-${i + 1}`,
      name: chestTier === 'grotto' ? 'Deep Grotto Relic Chest' : 'Sunken Brass Treasure Chest',
      chestTier,
      isMapVault: false,
      skillFocus: null,
      linkedMapId: null,
      beaconRevealed: false,
      x: Math.round(best.x * 100) / 100,
      y: Math.round(best.y * 100) / 100,
      opened: false,
      openAnim: 0,
      drop: null,
      beamColor: chestTier === 'grotto' ? '#38bdf8' : '#facc15',
      glintPhase: nextRng() * Math.PI * 2,
    });
  }
  return chests;
}
