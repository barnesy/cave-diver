/**
 * Diver Gear Workshop, Custom Rig Liveries, Technical Torch Optics & Milestone Patches (v138).
 * Pure data catalog, career unlock evaluation, sanitization, and animated workshop preview renderer.
 */

import { drawStyledDiverRig } from './artSprites.js';

export const SUIT_LIVERIES = Object.freeze([
  {
    id: 'zissou-classic',
    name: 'Zissou Tech',
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
    id: 'abyss-emerald',
    name: 'Cenote Emerald',
    suitTop: '#064e3b',
    suitMid: '#052e23',
    suitBot: '#021a14',
    accent: '#10b981',
    trim: '#5eead4',
    finColor: '#065f46',
    finTip: '#6ee7b7',
    stageBand: '#34d399',
    unlockHint: 'Clear 3+ expedition sites',
    isUnlocked: (stats) => stats.sitesCleared >= 3,
  },
  {
    id: 'wreck-titanium',
    name: 'Wreck Titanium',
    suitTop: '#334155',
    suitMid: '#1e293b',
    suitBot: '#0f172a',
    accent: '#eab308',
    trim: '#cbd5e1',
    finColor: '#475569',
    finTip: '#facc15',
    stageBand: '#eab308',
    unlockHint: 'Clear any shipwreck or 6+ sites',
    isUnlocked: (stats) => stats.wreckClears >= 1 || stats.sitesCleared >= 6,
  },
  {
    id: 'krubera-obsidian',
    name: 'Abyssal Sovereign',
    suitTop: '#27272a',
    suitMid: '#18181b',
    suitBot: '#09090b',
    accent: '#a855f7',
    trim: '#e879f9',
    finColor: '#1e1b4b',
    finTip: '#c084fc',
    stageBand: '#a855f7',
    unlockHint: 'Clear 12+ sites or log 8+ species',
    isUnlocked: (stats) => stats.sitesCleared >= 12 || stats.speciesLogged >= 8,
  },
]);

export const TORCH_OPTICS = Object.freeze([
  {
    id: 'tech-led',
    name: '6500K Tech LED',
    shortLabel: '6500K LED',
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
    swatch: '#fb923c',
    coreRgb: '253, 186, 116',
    shaftRgb: '251, 146, 60',
    warmRgb: '255, 178, 92',
    rangeMult: 1.04,
    siltPierce: 0.28,
    specText: 'Low-backscatter amber · +28% silt penetration',
    unlockHint: 'Clear 2+ expedition sites',
    isUnlocked: (stats) => stats.sitesCleared >= 2,
  },
  {
    id: 'emerald-spot',
    name: '5000K Emerald Spot',
    shortLabel: 'Emerald Spot',
    swatch: '#5eead4',
    coreRgb: '167, 243, 208',
    shaftRgb: '94, 234, 212',
    warmRgb: '180, 250, 224',
    rangeMult: 1.08,
    siltPierce: 0.12,
    specText: 'Long-throw pelagic focus · +8% beam reach',
    unlockHint: 'Clear 5+ sites or log 4+ species',
    isUnlocked: (stats) => stats.sitesCleared >= 5 || stats.speciesLogged >= 4,
  },
]);

export const MILESTONE_PATCHES = Object.freeze([
  { id: 'none', icon: '—', name: 'Clean Harness', unlockHint: 'Standard', isUnlocked: () => true },
  { id: 'cave-arrow', icon: '▷', name: 'Line Arrow', unlockHint: 'Standard', isUnlocked: () => true },
  { id: 'cenote-explorer', icon: '🌴', name: 'Cenote Diver', unlockHint: '3+ clears', isUnlocked: (s) => s.sitesCleared >= 3 },
  { id: 'wreck-penetrator', icon: '⚓', name: 'Wreck Tech', unlockHint: '1+ wreck or 5+ clears', isUnlocked: (s) => s.wreckClears >= 1 || s.sitesCleared >= 5 },
  { id: 'wildlife-biologist', icon: '📷', name: 'Marine Bio', unlockHint: '5+ Field Guide species', isUnlocked: (s) => s.speciesLogged >= 5 },
  { id: 'abyss-veteran', icon: '🔱', name: 'Abyss Veteran', unlockHint: '10+ clears', isUnlocked: (s) => s.sitesCleared >= 10 },
]);

export const HEADGEAR_STYLES = Object.freeze([
  {
    id: 'zissou-cap',
    name: 'Zissou Beanie',
    icon: '🧶',
    specText: 'Classic expedition knit cap',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'cave-hood',
    name: 'Neoprene Hood',
    icon: '🤿',
    specText: '7mm contoured cave hood + trim stripe',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'cave-helmet',
    name: 'Carbon Cave Helmet',
    icon: '⛑️',
    specText: 'Hard-shell impact helmet + twin backup pods',
    unlockHint: 'Bulkhead Engineer cert or 1+ wreck',
    isUnlocked: (s) => (s.pressurizedEqualizations || 0) >= 1 || s.wreckClears >= 1 || s.sitesCleared >= 4,
  },
  {
    id: 'exo-mask',
    name: 'Full-Face Exo Mask',
    icon: '🧑‍🚀',
    specText: 'Comms full-face visor + interior HUD glow',
    unlockHint: 'Emergency Troubleshooter or 5+ sites',
    isUnlocked: (s) => (s.drillsCompleted || 0) >= 3 || s.sitesCleared >= 5,
  },
]);

export const ACCENT_TRIMS = Object.freeze([
  {
    id: 'suit-default',
    name: 'Match Drysuit',
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
    accent: '#ef4444',
    trim: '#fca5a5',
    finTip: '#f87171',
    stageBand: '#ef4444',
    swatchA: '#ef4444',
    swatchB: '#fca5a5',
    unlockHint: 'Clear 2+ expedition sites',
    isUnlocked: (s) => s.sitesCleared >= 2,
  },
  {
    id: 'salvage-gold',
    name: 'Salvage Gold',
    accent: '#f59e0b',
    trim: '#fef08a',
    finTip: '#fde047',
    stageBand: '#f59e0b',
    swatchA: '#d97706',
    swatchB: '#fef08a',
    unlockHint: 'Salvage Master cert or 1+ wreck',
    isUnlocked: (s) => (s.cleanSalvageLifts || 0) >= 1 || s.wreckClears >= 1 || s.sitesCleared >= 5,
  },
  {
    id: 'biolum-violet',
    name: 'Biolum Orchid',
    accent: '#a855f7',
    trim: '#f0abfc',
    finTip: '#c084fc',
    stageBand: '#a855f7',
    swatchA: '#a855f7',
    swatchB: '#f0abfc',
    unlockHint: '4+ Field Guide species or 8+ sites',
    isUnlocked: (s) => s.speciesLogged >= 4 || s.sitesCleared >= 8,
  },
]);

export const TANK_FINISHES = Object.freeze([
  {
    id: 'al80-silver',
    name: 'Brushed AL80',
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
    top: '#7dd3fc',
    mid: '#0284c7',
    bot: '#0c4a6e',
    stroke: '#082f49',
    ccrShell: '#0ea5e9',
    unlockHint: 'Clear 2+ expedition sites',
    isUnlocked: (s) => s.sitesCleared >= 2,
  },
  {
    id: 'carbon-stealth',
    name: 'Carbon Stealth',
    top: '#475569',
    mid: '#1e293b',
    bot: '#020617',
    stroke: '#334155',
    ccrShell: '#334155',
    unlockHint: 'Zero-Silt Trim cert or 4+ sites',
    isUnlocked: (s) => (s.zeroSiltClears || 0) >= 1 || s.sitesCleared >= 4,
  },
  {
    id: 'salvage-brass',
    name: 'Patina Salvage Brass',
    top: '#fde68a',
    mid: '#d97706',
    bot: '#78350f',
    stroke: '#451a03',
    ccrShell: '#d97706',
    unlockHint: 'Bulkhead Engineer cert or 2+ wrecks',
    isUnlocked: (s) => (s.pressurizedEqualizations || 0) >= 1 || s.wreckClears >= 2,
  },
]);

export const VISOR_TINTS = Object.freeze([
  {
    id: 'clear-cyan',
    name: 'Crystal Cyan',
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
    top: '#f0abfc',
    mid: '#38bdf8',
    bot: '#4f46e5',
    frame: '#1e1b4b',
    hudGlow: '#e879f9',
    unlockHint: '3+ Field Guide species or 3+ sites',
    isUnlocked: (s) => s.speciesLogged >= 3 || s.sitesCleared >= 3,
  },
  {
    id: 'night-emerald',
    name: 'Night-Ops Emerald',
    top: '#d1fae5',
    mid: '#10b981',
    bot: '#064e3b',
    frame: '#022c22',
    hudGlow: '#34d399',
    unlockHint: 'Emergency Troubleshooter or 6+ sites',
    isUnlocked: (s) => (s.drillsCompleted || 0) >= 3 || s.sitesCleared >= 6,
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
});

const SUIT_BY_ID = new Map(SUIT_LIVERIES.map((s) => [s.id, s]));
const TORCH_BY_ID = new Map(TORCH_OPTICS.map((t) => [t.id, t]));
const PATCH_BY_ID = new Map(MILESTONE_PATCHES.map((p) => [p.id, p]));
const HEADGEAR_BY_ID = new Map(HEADGEAR_STYLES.map((h) => [h.id, h]));
const TRIM_BY_ID = new Map(ACCENT_TRIMS.map((t) => [t.id, t]));
const TANK_BY_ID = new Map(TANK_FINISHES.map((t) => [t.id, t]));
const VISOR_BY_ID = new Map(VISOR_TINTS.map((v) => [v.id, v]));

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

/**
 * Resolve any modular livery object into a complete drawing palette used consistently
 * by CaveRenderer, artSprites, Workshop Test-Tank Preview, and Home Mini-Avatar Badge (v153).
 */
export function resolveDiverLiveryPalette(livery = null) {
  const suit = getSuitLivery(livery?.suitId);
  const torch = getTorchOptic(livery?.torchId);
  const patch = getMilestonePatch(livery?.patchId);
  const headgear = getHeadgearStyle(livery?.headgearId);
  const trimSpec = getAccentTrim(livery?.trimId);
  const tank = getTankFinish(livery?.tankId);
  const visor = getVisorTint(livery?.visorId);

  return {
    suit,
    torch,
    patch,
    headgear,
    trimSpec,
    tank,
    visor,
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
  };
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
  const wreckSet = wreckLevelIds instanceof Set ? wreckLevelIds : new Set(Array.isArray(wreckLevelIds) ? wreckLevelIds : []);
  for (const [siteId, rec] of Object.entries(sites)) {
    if (rec && (rec.clears > 0 || rec.score > 0 || rec.bestScore > 0)) {
      sitesCleared++;
      if (wreckSet.has(siteId) || siteId.includes('wreck') || siteId.includes('oriskany') || siteId.includes('britannic') || siteId.includes('fitzgerald') || siteId.includes('thistlegorm') || siteId.includes('u1206') || siteId.includes('zenobia') || siteId.includes('andrea-doria') || siteId.includes('victoria')) {
        wreckClears++;
      }
    }
  }
  const speciesLogged = logbook?.fieldGuide && typeof logbook.fieldGuide === 'object'
    ? Object.keys(logbook.fieldGuide).length
    : 0;
  const ms = logbook?.milestones && typeof logbook.milestones === 'object' ? logbook.milestones : {};
  const stats = {
    sitesCleared,
    wreckClears,
    speciesLogged,
    pressurizedEqualizations: Math.max(0, Number(ms.pressurizedEqualizations) || 0),
    cleanSalvageLifts: Math.max(0, Number(ms.cleanSalvageLifts) || 0),
    drillsCompleted: Math.max(0, Number(ms.drillsCompleted) || 0),
    zeroSiltClears: Math.max(0, Number(ms.zeroSiltClears) || 0),
  };

  const suits = new Set();
  for (const s of SUIT_LIVERIES) if (s.isUnlocked(stats)) suits.add(s.id);
  const torches = new Set();
  for (const t of TORCH_OPTICS) if (t.isUnlocked(stats)) torches.add(t.id);
  const patches = new Set();
  for (const p of MILESTONE_PATCHES) if (p.isUnlocked(stats)) patches.add(p.id);
  const headgears = new Set();
  for (const h of HEADGEAR_STYLES) if (h.isUnlocked(stats)) headgears.add(h.id);
  const trims = new Set();
  for (const tr of ACCENT_TRIMS) if (tr.isUnlocked(stats)) trims.add(tr.id);
  const tanks = new Set();
  for (const tk of TANK_FINISHES) if (tk.isUnlocked(stats)) tanks.add(tk.id);
  const visors = new Set();
  for (const vs of VISOR_TINTS) if (vs.isUnlocked(stats)) visors.add(vs.id);

  return { stats, suits, torches, patches, headgears, trims, tanks, visors };
}

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

  if (unlocked) {
    if (unlocked.suits && !unlocked.suits.has(suitId)) suitId = DEFAULT_RIG_LIVERY.suitId;
    if (unlocked.torches && !unlocked.torches.has(torchId)) torchId = DEFAULT_RIG_LIVERY.torchId;
    if (unlocked.patches && !unlocked.patches.has(patchId)) patchId = DEFAULT_RIG_LIVERY.patchId;
    if (unlocked.headgears && !unlocked.headgears.has(headgearId)) headgearId = DEFAULT_MODULAR_IDS.headgearId;
    if (unlocked.trims && !unlocked.trims.has(trimId)) trimId = DEFAULT_MODULAR_IDS.trimId;
    if (unlocked.tanks && !unlocked.tanks.has(tankId)) tankId = DEFAULT_MODULAR_IDS.tankId;
    if (unlocked.visors && !unlocked.visors.has(visorId)) visorId = DEFAULT_MODULAR_IDS.visorId;
  }

  const out = { suitId, torchId, patchId };
  if (headgearId !== DEFAULT_MODULAR_IDS.headgearId) out.headgearId = headgearId;
  if (trimId !== DEFAULT_MODULAR_IDS.trimId) out.trimId = trimId;
  if (tankId !== DEFAULT_MODULAR_IDS.tankId) out.tankId = tankId;
  if (visorId !== DEFAULT_MODULAR_IDS.visorId) out.visorId = visorId;
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
    (livery.visorId || DEFAULT_MODULAR_IDS.visorId) === DEFAULT_MODULAR_IDS.visorId
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
    },
    unlocked
  );
}

/**
 * Render a live animated "Test Tank" diorama preview of the customized diver rig + torch beam
 * across Clear Water, Silt Haze (backscatter comparison), or Night Bioluminescence environments (v153).
 */
export function drawLiveryPreview(
  ctx,
  w,
  h,
  livery,
  { hasCcr = false, hasDpv = false, envMode = 'clear', timeSec = 0 } = {}
) {
  if (!ctx || !w || !h) return;
  const pal = resolveDiverLiveryPalette(livery);
  const { suit, torch, patch, headgear, tank } = pal;
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

  const cx = w * 0.39;
  const cy = h * 0.54 + Math.sin(timeSec * 1.9) * 3.8;
  const u = Math.min(w * 0.142, h * 0.33);

  // Volumetric torch cone preview — in Silt mode, visibly demonstrates torch.siltPierce clarity!
  const torchX = cx + u * 0.86;
  const torchY = cy + u * 0.21;
  const siltPenalty = isSilt ? Math.max(0.45, 0.68 + (torch.siltPierce || 0) * 1.05) : 1.0;
  const coneLen = w * 0.50 * torch.rangeMult * siltPenalty;
  const sweepAng = Math.sin(timeSec * 1.15) * 0.08;
  const coneGrad = ctx.createRadialGradient(torchX, torchY, 4, torchX + coneLen * 0.45, torchY, coneLen * 0.68);
  const coreAlpha = isNight ? 0.78 : isSilt ? 0.56 + (torch.siltPierce || 0) * 0.55 : 0.62;
  coneGrad.addColorStop(0, `rgba(${torch.coreRgb}, ${Math.min(0.92, coreAlpha).toFixed(2)})`);
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
    // Near-field backscatter glare (noticeably softer for Amber Silt-Piercer!)
    const glareAlpha = Math.max(0.06, 0.28 - (torch.siltPierce || 0) * 0.72);
    ctx.fillStyle = `rgba(214, 198, 170, ${glareAlpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(torchX + coneLen * 0.22, torchY, coneLen * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Rising regulator exhaust bubbles (or whisper-fine CCR loop bubbles)
  const bubCount = hasCcr ? 3 : 7;
  for (let b = 0; b < bubCount; b++) {
    const phase = ((timeSec * (hasCcr ? 0.55 : 0.85) + b / bubCount) % 1);
    const bx = cx + u * 0.58 + Math.sin(timeSec * 3.4 + b * 2.1) * 5 - phase * 10;
    const by = cy - u * 0.05 - phase * (h * 0.52);
    const br = hasCcr ? 1.5 + phase * 1.4 : 2.2 + phase * 3.0;
    ctx.fillStyle = `rgba(224, 242, 254, ${((1 - phase) * (hasCcr ? 0.45 : 0.7)).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  // Twin articulated trailing fins behind torso using custom finColor & finTip
  const kickA = Math.sin(timeSec * 3.6) * 0.17;
  const kickB = Math.sin(timeSec * 3.6 + Math.PI) * 0.15;
  for (let legIdx = 0; legIdx < 2; legIdx++) {
    const isBack = legIdx === 0;
    ctx.save();
    ctx.translate(cx - u * (isBack ? 0.82 : 0.86), cy + u * (isBack ? -0.02 : 0.12));
    ctx.rotate(isBack ? kickB : kickA);
    ctx.globalAlpha = isBack ? 0.72 : 1;
    ctx.fillStyle = pal.finColor;
    ctx.beginPath();
    ctx.moveTo(0, -u * 0.08);
    ctx.lineTo(-u * 0.78, -u * 0.23);
    ctx.lineTo(-u * 0.82, u * 0.17);
    ctx.lineTo(0, u * 0.09);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.finTip;
    ctx.lineWidth = isBack ? 1.8 : 2.5;
    ctx.beginPath();
    ctx.moveTo(-u * 0.78, -u * 0.23);
    ctx.lineTo(-u * 0.82, u * 0.17);
    ctx.stroke();
    ctx.restore();
  }

  // Draw the authentic styled diver rig with full modular headgear, tank finish, visor & trim
  ctx.save();
  ctx.translate(cx, cy);
  drawStyledDiverRig(ctx, u, u / 0.55, false, 1, {
    hasCcr,
    hasDpv,
    dpvActive: hasDpv,
    dpvThrusting: hasDpv,
    timeSec,
    liveryPalette: pal,
  });
  ctx.restore();

  // Torch canister in hand
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(torchX - 10, torchY - 4, 18, 8, 3);
  ctx.fill();
  ctx.fillStyle = torch.swatch;
  ctx.beginPath();
  ctx.arc(torchX + 8, torchY, 4.2, 0, Math.PI * 2);
  ctx.fill();

  // Corner optical & gear telemetry tag
  ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
  ctx.textAlign = 'right';
  const specSummary = `${suit.name} · ${headgear.name} · ${tank.name} · ${torch.shortLabel}${patch.id !== 'none' ? ` ${patch.icon}` : ''}`;
  ctx.fillText(specSummary, w - 12, h - 10);
  ctx.restore();
}

/**
 * Render a crisp compact diver portrait badge for the Home Screen & Co-op Lobby (v153).
 */
export function drawMiniDiverAvatar(ctx, w, h, livery, { hasCcr = false } = {}) {
  if (!ctx || !w || !h) return;
  const pal = resolveDiverLiveryPalette(livery);
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#071a30');
  bg.addColorStop(1, '#020b16');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle torch glow wedge on right edge
  ctx.fillStyle = `rgba(${pal.torch.shaftRgb}, 0.26)`;
  ctx.beginPath();
  ctx.moveTo(w * 0.58, h * 0.56);
  ctx.lineTo(w, h * 0.2);
  ctx.lineTo(w, h * 0.92);
  ctx.closePath();
  ctx.fill();

  ctx.translate(w * 0.45, h * 0.56);
  const u = Math.min(w, h) * 0.46;
  drawStyledDiverRig(ctx, u, u / 0.55, false, 1, {
    hasCcr,
    hasDpv: false,
    timeSec: 0,
    liveryPalette: pal,
  });
  ctx.restore();
}
