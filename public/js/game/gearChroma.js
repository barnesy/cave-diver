/**
 * Salvage Doubloons Currency & Gear Color / Animated Coating Foundry (v229).
 * Pure cosmetic color finishes, rare metallic coats, animated color-FX combos,
 * and exclusive prestige coatings that layer over ANY equipped gear while keeping
 * 100% of your gear stats, powers, and Set Synergies intact.
 */

export const STARTER_DOUBLOONS = 150;

export const CHROMA_TIERS = Object.freeze({
  default: Object.freeze({ id: 'default', label: 'NATIVE', color: '#94a3b8' }),
  standard: Object.freeze({ id: 'standard', label: 'STANDARD', color: '#34d399' }),
  rare: Object.freeze({ id: 'rare', label: 'RARE', color: '#38bdf8' }),
  animated: Object.freeze({ id: 'animated', label: 'ANIMATED COMBO', color: '#c084fc' }),
  exclusive: Object.freeze({ id: 'exclusive', label: 'EXCLUSIVE', color: '#facc15' }),
});

export const GEAR_CHROMA_FINISHES = Object.freeze([
  // 0. Native Gear Colors (always owned, free)
  Object.freeze({
    id: 'none',
    name: 'Original Gear Finish',
    tier: 'default',
    cost: 0,
    animated: false,
    exclusive: false,
    swatch: ['#1e293b', '#0f172a', '#38bdf8'],
    desc: 'Uses each equipped gear piece’s native colorway and visual FX.',
    palette: null,
  }),

  // ── TIER I: STANDARD FINISHES (120–180 🪙) ──
  Object.freeze({
    id: 'matte-graphite',
    name: 'Stealth Obsidian',
    tier: 'standard',
    cost: 120,
    animated: false,
    exclusive: false,
    swatch: ['#1e293b', '#090d16', '#94a3b8'],
    desc: 'Low-glare matte carbon shell, slate webbing & dark gunmetal cylinders.',
    palette: Object.freeze({
      suitTop: '#1f2937',
      suitMid: '#111827',
      suitBot: '#030712',
      accent: '#cbd5e1',
      trim: '#94a3b8',
      finColor: '#111827',
      finTip: '#cbd5e1',
      stageBand: '#64748b',
      tank: Object.freeze({ bodyTop: '#475569', bodyMid: '#1e293b', bodyBot: '#090d16', band: '#94a3b8', valve: '#cbd5e1' }),
    }),
  }),
  Object.freeze({
    id: 'coral-reef',
    name: 'Reef Coral',
    tier: 'standard',
    cost: 140,
    animated: false,
    exclusive: false,
    swatch: ['#fb7185', '#9f1239', '#2dd4bf'],
    desc: 'Sunlit reef-coral drysuit paired with bright turquoise fin tips & bands.',
    palette: Object.freeze({
      suitTop: '#e11d48',
      suitMid: '#9f1239',
      suitBot: '#4c0519',
      accent: '#fda4af',
      trim: '#2dd4bf',
      finColor: '#881337',
      finTip: '#5eead4',
      stageBand: '#2dd4bf',
      tank: Object.freeze({ bodyTop: '#fb7185', bodyMid: '#be123c', bodyBot: '#4c0519', band: '#5eead4', valve: '#f8fafc' }),
    }),
  }),
  Object.freeze({
    id: 'kelp-olive',
    name: 'Tactical Kelp',
    tier: 'standard',
    cost: 140,
    animated: false,
    exclusive: false,
    swatch: ['#3f6212', '#1a2e05', '#eab308'],
    desc: 'Expedition olive-kelp shell, warm brass hardware & sand-gold harness trim.',
    palette: Object.freeze({
      suitTop: '#4d7c0f',
      suitMid: '#365314',
      suitBot: '#1a2e05',
      accent: '#facc15',
      trim: '#bef264',
      finColor: '#1a2e05',
      finTip: '#fde047',
      stageBand: '#eab308',
      tank: Object.freeze({ bodyTop: '#a16207', bodyMid: '#713f12', bodyBot: '#422006', band: '#fde047', valve: '#fef08a' }),
    }),
  }),
  Object.freeze({
    id: 'glacier-white',
    name: 'Polar Alabaster',
    tier: 'standard',
    cost: 180,
    animated: false,
    exclusive: false,
    swatch: ['#f1f5f9', '#94a3b8', '#0284c7'],
    desc: 'High-contrast Arctic white shell with glacier-blue trim & frosted tanks.',
    palette: Object.freeze({
      suitTop: '#f1f5f9',
      suitMid: '#cbd5e1',
      suitBot: '#64748b',
      accent: '#0284c7',
      trim: '#38bdf8',
      finColor: '#e2e8f0',
      finTip: '#0ea5e9',
      stageBand: '#0284c7',
      tank: Object.freeze({ bodyTop: '#f8fafc', bodyMid: '#bae6fd', bodyBot: '#0369a1', band: '#0284c7', valve: '#e0f2fe' }),
    }),
  }),

  // ── TIER II: RARE FINISHES (280–400 🪙) ──
  Object.freeze({
    id: 'cobalt-cerakote',
    name: 'Deep Cobalt Cerakote',
    tier: 'rare',
    cost: 280,
    animated: false,
    exclusive: false,
    swatch: ['#2563eb', '#1e3a8a', '#38bdf8'],
    desc: 'Anodized sapphire ceramic coat across drysuit, twinset & electric cyan fins.',
    palette: Object.freeze({
      suitTop: '#2563eb',
      suitMid: '#1d4ed8',
      suitBot: '#172554',
      accent: '#7dd3fc',
      trim: '#38bdf8',
      finColor: '#1e3a8a',
      finTip: '#7dd3fc',
      stageBand: '#38bdf8',
      tank: Object.freeze({ bodyTop: '#60a5fa', bodyMid: '#1d4ed8', bodyBot: '#172554', band: '#e0f2fe', valve: '#f8fafc' }),
      visor: Object.freeze({ top: '#7dd3fc', mid: '#0284c7', bot: '#0c4a6e', glint: '#ffffff' }),
    }),
  }),
  Object.freeze({
    id: 'imperial-crimson',
    name: 'Crimson Bathysphere',
    tier: 'rare',
    cost: 320,
    animated: false,
    exclusive: false,
    swatch: ['#dc2626', '#7f1d1d', '#f59e0b'],
    desc: 'Deep lacquered crimson shell with antique brass cylinders & warm amber lens.',
    palette: Object.freeze({
      suitTop: '#dc2626',
      suitMid: '#991b1b',
      suitBot: '#450a0a',
      accent: '#fbbf24',
      trim: '#f59e0b',
      finColor: '#7f1d1d',
      finTip: '#fde68a',
      stageBand: '#f59e0b',
      tank: Object.freeze({ bodyTop: '#f59e0b', bodyMid: '#b45309', bodyBot: '#451a03', band: '#fef3c7', valve: '#fde68a' }),
      visor: Object.freeze({ top: '#fde68a', mid: '#d97706', bot: '#78350f', glint: '#fffbeb' }),
    }),
  }),
  Object.freeze({
    id: 'jade-cenote',
    name: 'Mayan Jade Sheen',
    tier: 'rare',
    cost: 350,
    animated: false,
    exclusive: false,
    swatch: ['#10b981', '#065f46', '#67e8f9'],
    desc: 'Translucent cenote-jade coating with aquamarine harness & seafoam tanks.',
    palette: Object.freeze({
      suitTop: '#10b981',
      suitMid: '#047857',
      suitBot: '#022c22',
      accent: '#67e8f9',
      trim: '#5eead4',
      finColor: '#065f46',
      finTip: '#a5f3fc',
      stageBand: '#2dd4bf',
      tank: Object.freeze({ bodyTop: '#34d399', bodyMid: '#059669', bodyBot: '#022c22', band: '#a5f3fc', valve: '#ecfdf5' }),
      visor: Object.freeze({ top: '#a7f3d0', mid: '#0d9488', bot: '#134e4a', glint: '#ffffff' }),
    }),
  }),
  Object.freeze({
    id: 'midnight-amethyst',
    name: 'Abyssal Amethyst',
    tier: 'rare',
    cost: 400,
    animated: false,
    exclusive: false,
    swatch: ['#9333ea', '#3b0764', '#f0abfc'],
    desc: 'Velvet indigo-violet drysuit, glowing orchid piping & smoked titanium tanks.',
    palette: Object.freeze({
      suitTop: '#7e22ce',
      suitMid: '#581c87',
      suitBot: '#2e1065',
      accent: '#f0abfc',
      trim: '#d8b4fe',
      finColor: '#3b0764',
      finTip: '#f5d0fe',
      stageBand: '#c084fc',
      tank: Object.freeze({ bodyTop: '#a855f7', bodyMid: '#581c87', bodyBot: '#1e1b4b', band: '#f5d0fe', valve: '#faf5ff' }),
      visor: Object.freeze({ top: '#f0abfc', mid: '#7e22ce', bot: '#3b0764', glint: '#ffffff' }),
    }),
  }),

  // ── TIER III: ANIMATED COLOR COMBOS (520–760 🪙) ──
  Object.freeze({
    id: 'anim-biolum-tide',
    name: 'Bioluminescent Tide',
    tier: 'animated',
    cost: 520,
    animated: true,
    exclusive: false,
    swatch: ['#06b6d4', '#083344', '#34d399'],
    fxName: 'Bioluminescent Pulse + Plasma Trim',
    desc: 'Animated abyssal teal coating with pulsing cyan spores, plasma spine surge & aqua wake.',
    palette: Object.freeze({
      suitTop: '#0e7490',
      suitMid: '#083344',
      suitBot: '#021a24',
      accent: '#22d3ee',
      trim: '#34d399',
      finColor: '#0c4a6e',
      finTip: '#67e8f9',
      stageBand: '#2dd4bf',
      tank: Object.freeze({ bodyTop: '#22d3ee', bodyMid: '#0e7490', bodyBot: '#082f49', band: '#a7f3d0', valve: '#ecfeff' }),
      visor: Object.freeze({ top: '#67e8f9', mid: '#0891b2', bot: '#164e63', glint: '#ffffff' }),
      suitFx: 'biolume-pulse',
      trimFx: 'plasma-wave',
      tankFx: 'halocline-glow',
      wake: Object.freeze({ active: true, isSetAura: false, auraRgb: '34, 211, 238', hueA: 188, hueB: 162, rising: true, prism: false }),
    }),
  }),
  Object.freeze({
    id: 'anim-solar-reef',
    name: 'Solar Caustic Gold',
    tier: 'animated',
    cost: 600,
    animated: true,
    exclusive: false,
    swatch: ['#facc15', '#854d0e', '#38bdf8'],
    fxName: 'Sunlit Caustic Wave + Gold Orbitals',
    desc: 'Animated sunlit gold & ocean-blue finish with shimmering caustic bands & gilded wake.',
    palette: Object.freeze({
      suitTop: '#ca8a04',
      suitMid: '#854d0e',
      suitBot: '#422006',
      accent: '#fef08a',
      trim: '#38bdf8',
      finColor: '#713f12',
      finTip: '#fde047',
      stageBand: '#facc15',
      tank: Object.freeze({ bodyTop: '#fde047', bodyMid: '#ca8a04', bodyBot: '#713f12', band: '#7dd3fc', valve: '#fefce8' }),
      visor: Object.freeze({ top: '#fef08a', mid: '#eab308', bot: '#713f12', glint: '#ffffff' }),
      suitFx: 'sovereign-aura',
      trimFx: 'foundry-sparks',
      wake: Object.freeze({ active: true, isSetAura: false, auraRgb: '250, 204, 21', hueA: 46, hueB: 196, rising: false, prism: false }),
    }),
  }),
  Object.freeze({
    id: 'anim-thermal-ember',
    name: 'Magma Vent Circuit',
    tier: 'animated',
    cost: 680,
    animated: true,
    exclusive: false,
    swatch: ['#f97316', '#29150b', '#fde047'],
    fxName: 'Molten Magma Veins + Ember Sparks',
    desc: 'Animated volcanic basalt shell glowing with rising lava embers & molten spark trim.',
    palette: Object.freeze({
      suitTop: '#3b1d12',
      suitMid: '#241008',
      suitBot: '#0f0603',
      accent: '#fb923c',
      trim: '#f97316',
      finColor: '#29150b',
      finTip: '#fde047',
      stageBand: '#f97316',
      tank: Object.freeze({ bodyTop: '#ea580c', bodyMid: '#7c2d12', bodyBot: '#1c0a04', band: '#fde047', valve: '#fed7aa' }),
      visor: Object.freeze({ top: '#fde047', mid: '#ea580c', bot: '#7c2d12', glint: '#fff7ed' }),
      suitFx: 'magma-embers',
      trimFx: 'foundry-sparks',
      tankFx: 'reactor-core',
      wake: Object.freeze({ active: true, isSetAura: false, auraRgb: '251, 146, 60', hueA: 24, hueB: 48, rising: true, prism: false }),
    }),
  }),
  Object.freeze({
    id: 'anim-aurora-frost',
    name: 'Glacial Aurora Borealis',
    tier: 'animated',
    cost: 760,
    animated: true,
    exclusive: false,
    swatch: ['#34d399', '#1e1b4b', '#818cf8'],
    fxName: 'Aurora Ribbon + Prism Spine',
    desc: 'Animated arctic midnight finish with flowing green-cyan-violet aurora ribbons & frost wake.',
    palette: Object.freeze({
      suitTop: '#1e3a5f',
      suitMid: '#172554',
      suitBot: '#0c1229',
      accent: '#34d399',
      trim: '#818cf8',
      finColor: '#1e1b4b',
      finTip: '#6ee7b7',
      stageBand: '#34d399',
      tank: Object.freeze({ bodyTop: '#a5f3fc', bodyMid: '#0369a1', bodyBot: '#1e1b4b', band: '#6ee7b7', valve: '#f0f9ff' }),
      visor: Object.freeze({ top: '#6ee7b7', mid: '#38bdf8', bot: '#312e81', glint: '#ffffff' }),
      suitFx: 'aurora-ribbon',
      trimFx: 'selenite-prism',
      tankFx: 'halocline-glow',
      wake: Object.freeze({ active: true, isSetAura: false, auraRgb: '52, 211, 153', hueA: 158, hueB: 245, rising: true, prism: false }),
    }),
  }),

  // ── TIER IV: EXCLUSIVE PRESTIGE ANIMATED COMBOS (900–1400 🪙 + Milestone) ──
  Object.freeze({
    id: 'excl-wreck-gilded',
    name: 'Sovereign Salvage 24K',
    tier: 'exclusive',
    cost: 900,
    animated: true,
    exclusive: true,
    requirementHint: 'Requires 3+ Shipwrecks or 10+ Sites cleared',
    isEligible: (stats) => (stats?.wreckClears || 0) >= 3 || (stats?.sitesCleared || 0) >= 10,
    swatch: ['#fde047', '#18181b', '#f59e0b'],
    fxName: '24K Sovereign Sheen + Foundry Sparks',
    desc: 'Exclusive maritime obsidian & 24K burnished gold hull finish with orbiting prestige motes.',
    palette: Object.freeze({
      suitTop: '#27272a',
      suitMid: '#18181b',
      suitBot: '#09090b',
      accent: '#fde047',
      trim: '#facc15',
      finColor: '#18181b',
      finTip: '#fef08a',
      stageBand: '#eab308',
      tank: Object.freeze({ bodyTop: '#fef08a', bodyMid: '#ca8a04', bodyBot: '#422006', band: '#18181b', valve: '#fef9c3' }),
      visor: Object.freeze({ top: '#fef9c3', mid: '#eab308', bot: '#713f12', glint: '#ffffff' }),
      suitFx: 'sovereign-aura',
      trimFx: 'foundry-sparks',
      tankFx: 'reactor-core',
      wake: Object.freeze({ active: true, isSetAura: true, auraRgb: '250, 204, 21', hueA: 45, hueB: 32, rising: false, prism: false }),
    }),
  }),
  Object.freeze({
    id: 'excl-abyssal-prism',
    name: 'Astral Prism Iridescence',
    tier: 'exclusive',
    cost: 1150,
    animated: true,
    exclusive: true,
    requirementHint: 'Requires 1+ Boss Bounty claimed or 120m+ depth',
    isEligible: (stats) => (stats?.bountiesClaimed || 0) >= 1 || (stats?.deepestM || 0) >= 120,
    swatch: ['#38bdf8', '#c084fc', '#fb7185'],
    fxName: 'Live Hue-Shifting Holographic Prism',
    desc: 'Exclusive pearlescent iridescent finish that cycles prismatic spectrum across suit, trim & wake.',
    palette: Object.freeze({
      suitTop: '#312e81',
      suitMid: '#1e1b4b',
      suitBot: '#09071a',
      accent: '#e879f9',
      trim: '#67e8f9',
      finColor: '#1e1b4b',
      finTip: '#f0abfc',
      stageBand: '#38bdf8',
      tank: Object.freeze({ bodyTop: '#e0f2fe', bodyMid: '#818cf8', bodyBot: '#312e81', band: '#f0abfc', valve: '#ffffff' }),
      visor: Object.freeze({ top: '#67e8f9', mid: '#c084fc', bot: '#ec4899', glint: '#ffffff' }),
      suitFx: 'prism-shift',
      trimFx: 'selenite-prism',
      tankFx: 'carbon-plasma',
      wake: Object.freeze({ active: true, isSetAura: true, auraRgb: '192, 132, 252', hueA: 190, hueB: 310, rising: true, prism: true }),
    }),
  }),
  Object.freeze({
    id: 'excl-leviathan-void',
    name: 'Leviathan Void-Plasma',
    tier: 'exclusive',
    cost: 1400,
    animated: true,
    exclusive: true,
    requirementHint: 'Requires Hardcore Clear or 3+ Boss Bounties',
    isEligible: (stats) => (stats?.hardcoreClears || 0) >= 1 || (stats?.bountiesClaimed || 0) >= 3,
    swatch: ['#f43f5e', '#090412', '#a855f7'],
    fxName: 'Void-Plasma Arcs + Crimson Surge',
    desc: 'Exclusive abyssal void-black armor crackling with ultraviolet & crimson plasma energy.',
    palette: Object.freeze({
      suitTop: '#160921',
      suitMid: '#0b0412',
      suitBot: '#030106',
      accent: '#fb7185',
      trim: '#f43f5e',
      finColor: '#0b0412',
      finTip: '#fb7185',
      stageBand: '#a855f7',
      tank: Object.freeze({ bodyTop: '#3b0764', bodyMid: '#180529', bodyBot: '#05010a', band: '#fb7185', valve: '#fda4af' }),
      visor: Object.freeze({ top: '#fda4af', mid: '#e11d48', bot: '#4c0519', glint: '#fff1f2' }),
      suitFx: 'void-plasma',
      trimFx: 'plasma-wave',
      tankFx: 'carbon-plasma',
      wake: Object.freeze({ active: true, isSetAura: true, auraRgb: '244, 63, 94', hueA: 348, hueB: 276, rising: true, prism: false }),
    }),
  }),
]);

const CHROMA_BY_ID = new Map(GEAR_CHROMA_FINISHES.map((c) => [c.id, c]));

export function getGearChroma(dyeId) {
  return (dyeId && CHROMA_BY_ID.get(dyeId)) || GEAR_CHROMA_FINISHES[0];
}

export function isValidGearChromaId(dyeId) {
  return Boolean(dyeId && CHROMA_BY_ID.has(dyeId));
}

export function isChromaExclusiveEligible(chroma, stats) {
  if (!chroma || !chroma.exclusive) return true;
  if (typeof chroma.isEligible === 'function') return Boolean(chroma.isEligible(stats || {}));
  return true;
}

/**
 * Overlay a purchased Chroma Color Finish / Animated Combo onto a resolved diver palette.
 * Purely cosmetic: never alters gear IDs, stats, powers, or Set Synergy bonuses.
 */
export function applyChromaToPalette(basePalette, dyeId) {
  const chroma = getGearChroma(dyeId);
  if (!basePalette || !chroma || !chroma.palette) {
    return { ...basePalette, chroma };
  }
  const cp = chroma.palette;
  const next = {
    ...basePalette,
    chroma,
    suitTop: cp.suitTop || basePalette.suitTop,
    suitMid: cp.suitMid || basePalette.suitMid,
    suitBot: cp.suitBot || basePalette.suitBot,
    accent: cp.accent || basePalette.accent,
    trim: cp.trim || basePalette.trim,
    finColor: cp.finColor || basePalette.finColor,
    finTip: cp.finTip || basePalette.finTip,
    stageBand: cp.stageBand || basePalette.stageBand,
  };
  if (cp.tank && basePalette.tankFinish) {
    next.tankFinish = { ...basePalette.tankFinish, ...cp.tank };
  }
  if (cp.visor && basePalette.visorTint) {
    next.visorTint = { ...basePalette.visorTint, ...cp.visor };
  }
  if (cp.suitFx) next.suitFx = cp.suitFx;
  if (cp.trimFx) next.trimFx = cp.trimFx;
  if (cp.tankFx) next.tankFx = cp.tankFx;
  if (cp.visorFx) next.visorFx = cp.visorFx;
  if (cp.wake) next.wakeProfile = cp.wake;
  return next;
}

/**
 * Compute Salvage Doubloons earned from completing or exploring a dive (v229).
 */
export function computeDiveDoubloonPayout({
  success = false,
  isFirstClear = false,
  grade = 'B',
  difficulty = 'standard',
  maxDepthM = 0,
  diveTimeSec = 0,
  artifactsCollected = 0,
} = {}) {
  const parts = [];
  let total = 0;
  if (success) {
    total += 65;
    parts.push('+65 Clear');
    if (isFirstClear) {
      total += 110;
      parts.push('+110 First Clear');
    }
    const gradeBonus = grade === 'S+' ? 75 : grade === 'S' ? 55 : grade === 'A' ? 35 : grade === 'B' ? 20 : 10;
    total += gradeBonus;
    parts.push(`+${gradeBonus} Grade ${grade}`);
    if (difficulty === 'hardcore') {
      total += 60;
      parts.push('+60 Hardcore');
    } else if (difficulty === 'standard') {
      total += 20;
      parts.push('+20 Standard');
    }
    const depthBonus = Math.min(80, Math.floor(Math.max(0, Number(maxDepthM) || 0) / 4));
    if (depthBonus > 0) {
      total += depthBonus;
      parts.push(`+${depthBonus} Depth`);
    }
  } else if ((Number(diveTimeSec) || 0) >= 20) {
    total += 20;
    parts.push('+20 Exploration');
  }
  const artCount = Math.max(0, Math.floor(Number(artifactsCollected) || 0));
  if (artCount > 0) {
    const artBonus = artCount * 25;
    total += artBonus;
    parts.push(`+${artBonus} Relics`);
  }
  return { total, summary: parts.join(' · ') };
}

/**
 * Retroactive starter credit for existing career logbooks upgrading to v229.
 */
export function computeRetroactiveDoubloons(book) {
  if (!book || typeof book !== 'object') return STARTER_DOUBLOONS;
  const sitesCleared = book.cleared && typeof book.cleared === 'object' ? Object.keys(book.cleared).length : 0;
  const totalDives = Math.max(0, Number(book.totalDives) || 0);
  const artifacts = book.artifacts && typeof book.artifacts === 'object' ? Object.keys(book.artifacts).length : 0;
  return STARTER_DOUBLOONS + sitesCleared * 110 + totalDives * 30 + artifacts * 25;
}
