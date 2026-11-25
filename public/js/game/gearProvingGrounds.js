import {
  DEFAULT_RIG_LIVERY,
  GEAR_SET_SYNERGIES,
  SUIT_LIVERIES,
  TORCH_OPTICS,
  MILESTONE_PATCHES,
  HEADGEAR_STYLES,
  ACCENT_TRIMS,
  TANK_FINISHES,
  VISOR_TINTS,
  getGearTierMeta,
} from './rigLivery.js';
import { computeRigPerformanceProfile } from './gearStats.js';

export const PROVING_GROUNDS_LEVEL_ID = 'gear-proving-grounds';

export const STOCK_BASELINE_LIVERY = Object.freeze({
  suitId: 'zissou-classic',
  torchId: 'tech-led',
  patchId: 'none',
  headgearId: 'zissou-cap',
  trimId: 'suit-default',
  tankId: 'al80-silver',
  visorId: 'clear-cyan',
});

/**
 * Curated instant A/B trial builds available in the live Proving Grounds switcher bar (v217).
 */
export const PROVING_GROUNDS_PRESETS = Object.freeze([
  Object.freeze({
    id: 'stock',
    icon: '📦',
    label: 'Stock',
    desc: 'Standard Issue baseline (for A/B feel comparison)',
    livery: STOCK_BASELINE_LIVERY,
  }),
  Object.freeze({
    id: 'karst-hydro-glider',
    icon: '⚡',
    label: 'Speed Hydro',
    desc: 'SPEED 3pc: +28% Swim, Silt-Ghost (<1.8 m/s), Hydro-Ghost (-85% wall drag) & DPV Overdrive',
    livery: {
      suitId: 'world-hydro-suit',
      trimId: 'world-hydro-fins',
      tankId: 'world-hydro-tank',
      headgearId: 'cave-hood',
      visorId: 'amber-contrast',
      torchId: 'amber-silt',
      patchId: 'first-descent',
    },
  }),
  Object.freeze({
    id: 'thermal-mantle',
    icon: '🌊',
    label: 'Deep Tech',
    desc: 'DEEP: +40 Bar Overfill, +18m Depth Clarity, 100% Cold-Proof & +36% Deco Offgas',
    livery: {
      suitId: 'secret-volcanic-nautilus',
      tankId: 'world-chimney-tank',
      headgearId: 'world-thermal-hood',
      visorId: 'thermocline-prism',
      torchId: 'aurora-plasma',
      trimId: 'secret-selenite-trim',
      patchId: 'world-arch-crest',
    },
  }),
  Object.freeze({
    id: 'apex-combat',
    icon: '🔱',
    label: 'Boss Combat',
    desc: 'COMBAT 3pc: 155 Boss HP, +45% Spear DPS, +28% Fire Rate & Every 3rd Shot Golden Hyper-Tip',
    livery: {
      suitId: 'bounty-hunter-suit',
      visorId: 'bounty-hunter-visor',
      torchId: 'bounty-hunter-torch',
      headgearId: 'secret-dreadnought-helm',
      tankId: 'secret-dreadnought-brass',
      trimId: 'signal-crimson',
      patchId: 'bounty-hunter-master',
    },
  }),
  Object.freeze({
    id: 'sunken-cartographer',
    icon: '🧭',
    label: 'Cartographer',
    desc: 'EXPLORER 3pc: Golden Relic Compass (32m), +20m Relic Glow, +45% Sonar & +48% Beam',
    livery: {
      suitId: 'world-cartographer-suit',
      visorId: 'world-cartographer-visor',
      torchId: 'world-cartographer-torch',
      headgearId: 'cave-helmet',
      tankId: 'anodized-cobalt',
      trimId: 'cavern-yellow',
      patchId: 'cenote-explorer',
    },
  }),
  Object.freeze({
    id: 'hybrid-mix',
    icon: '✨',
    label: 'Hybrid Mix',
    desc: 'HYBRID 2pc+2pc: Hydro-Glider (Silt-Ghost + Flow) + Cartographer (Relic Radar + Sonar)',
    livery: {
      suitId: 'world-hydro-suit',
      trimId: 'world-hydro-fins',
      visorId: 'world-cartographer-visor',
      torchId: 'world-cartographer-torch',
      headgearId: 'world-thermal-hood',
      tankId: 'world-chimney-tank',
      patchId: 'world-arch-crest',
    },
  }),
]);

/**
 * Build a complete multi-slot livery patch containing every piece of a given Gear Set (v217).
 * Used for 1-tap "Try Full Set" preview and "Field Test Set" in the Proving Grounds.
 */
export function buildSetPreviewPatch(setObj) {
  if (!setObj || !Array.isArray(setObj.slots)) return {};
  const patch = {};
  for (const rule of setObj.slots) {
    if (rule?.field && Array.isArray(rule.ids) && rule.ids.length > 0) {
      patch[rule.field] = rule.ids[0];
    }
  }
  return patch;
}

/**
 * Auto-build the strongest unlocked rig for 1-tap "⚡ Best Rig" equipping (v217).
 * Prioritizes the highest-tier Set Synergy with >=2 owned pieces, then fills remaining
 * slots with the highest-tier unlocked gear pieces.
 */
export function buildBestOwnedRig(unlocks) {
  const res = { ...DEFAULT_RIG_LIVERY };
  if (!unlocks) return res;

  const setMapKey = {
    suit: 'suits',
    trim: 'trims',
    headgear: 'headgears',
    visor: 'visors',
    tank: 'tanks',
    torch: 'torches',
    patch: 'patches',
  };

  // 1. Find best owned Set Synergy (>=2 pieces unlocked, prioritizing full capstones & higher rarity)
  let bestSet = null;
  let bestSetScore = 0;
  for (const set of GEAR_SET_SYNERGIES) {
    let owned = 0;
    const ownedPatch = {};
    for (const rule of set.slots) {
      const uSet = unlocks[setMapKey[rule.slot]];
      const hit = rule.ids.find((id) => uSet instanceof Set && uSet.has(id));
      if (hit) {
        owned++;
        ownedPatch[rule.field] = hit;
      }
    }
    if (owned < 2) continue;
    const isCapstone = owned >= (set.required || 3);
    const score = (isCapstone ? 100 : 40) + owned * 12 + (getGearTierMeta(set.tier).rank || 1) * 15;
    if (score > bestSetScore) {
      bestSetScore = score;
      bestSet = { set, ownedPatch, owned, isCapstone };
    }
  }

  const lockedFields = new Set();
  if (bestSet) {
    for (const [k, v] of Object.entries(bestSet.ownedPatch)) {
      res[k] = v;
      lockedFields.add(k);
    }
  }

  // 2. Fill every remaining slot with the highest-tier / highest-rank unlocked item
  const slotCatalogs = [
    ['suitId', SUIT_LIVERIES, unlocks.suits],
    ['headgearId', HEADGEAR_STYLES, unlocks.headgears],
    ['torchId', TORCH_OPTICS, unlocks.torches],
    ['tankId', TANK_FINISHES, unlocks.tanks],
    ['visorId', VISOR_TINTS, unlocks.visors],
    ['trimId', ACCENT_TRIMS, unlocks.trims],
    ['patchId', MILESTONE_PATCHES, unlocks.patches],
  ];
  for (const [field, list, uSet] of slotCatalogs) {
    if (lockedFields.has(field) || !(uSet instanceof Set)) continue;
    let bestItem = null;
    let bestScore = -1;
    for (const item of list) {
      if (!uSet.has(item.id)) continue;
      const sc = (getGearTierMeta(item.tier).rank || 1) * 100 + (item.ladderRank || 0);
      if (sc > bestScore) {
        bestScore = sc;
        bestItem = item;
      }
    }
    if (bestItem) res[field] = bestItem.id;
  }

  return {
    livery: res,
    activeSetName: bestSet ? bestSet.set.name : '',
    activeSetCount: bestSet ? bestSet.owned : 0,
    isCapstone: Boolean(bestSet?.isCapstone),
  };
}

/**
 * Create the compact, fast-loading 6-zone underwater Gear Proving Grounds basin (v217).
 * Lets divers practically test Swim Speed, Slipstream/Pull-and-Glide Currents, Silt-Ghost,
 * Percolation Immunity, Cold Thermocline Resist, Surge/Crank Hatches, Torch/Relic Compass & Deco!
 */
export function createProvingGroundsLevel() {
  return {
    id: PROVING_GROUNDS_LEVEL_ID,
    name: 'Gear Proving Grounds',
    subtitle: 'Interactive 6-Lane Rig Testing Facility · Risk-Free Sandbox',
    isProvingGrounds: true,
    noLogbook: true,
    maxDepthM: 28,
    bounds: { xMin: -20, xMax: 84, yMin: -4, yMax: 38 },
    roughness: 0.24,
    spawn: { x: 10, y: 2.2 },
    turnaroundCheckpointId: 'pg-relic-vault',
    ascentSwitchCheckpointId: 'pg-deco-shelf',
    ascentSwitchDepthM: 18,
    openBasins: [
      { kind: 'entry', xMin: 4, xMax: 16, rimHalf: 5.4, flareAdd: 2.0, lipTilt: 0.3, floorY: 2.4, sunAngle: 1.45 },
    ],
    segments: [
      // Entry Research Sinkhole & 6m Deco Calibration Shelf
      { ax: 10, ay: 0.8, bx: 10, by: 9.0, ra: 6.4, rb: 5.2 },
      // Lane 1: Hydro-Flume Current Tunnel (x: 12..34, y: 11)
      { ax: 10, ay: 9.0, bx: 34, by: 11.5, ra: 4.4, rb: 3.6 },
      // Lane 2: Fine Silt & Fragile Ceiling Gallery (x: 34..52, y: 13.5)
      { ax: 34, ay: 11.5, bx: 52, by: 14.0, ra: 3.6, rb: 4.0 },
      // Drop into Lane 3: Cryo Thermocline Chamber (x: 52..58, y: 14..21)
      { ax: 52, ay: 14.0, bx: 56, by: 21.5, ra: 4.0, rb: 4.8 },
      // Lower Return Loop: Lane 5 Dark Relic Vault (x: 56..36, y: 24)
      { ax: 56, ay: 21.5, bx: 36, by: 24.5, ra: 4.6, rb: 4.2 },
      // Lane 4: Surge Hatch & Bulkhead Test Bay (x: 36..16, y: 22)
      { ax: 36, ay: 24.5, bx: 16, by: 21.5, ra: 4.2, rb: 4.0 },
      // West Vertical Return Shaft back to 6m Deco Shelf & Entry
      { ax: 16, ay: 21.5, bx: 10, by: 9.0, ra: 3.8, rb: 4.8 },
    ],
    guideline: [
      { x: 10, y: 3.5 },
      { x: 11, y: 9.2 },
      { x: 24, y: 10.6 },
      { x: 34, y: 11.5 },
      { x: 46, y: 13.2 },
      { x: 54, y: 18.0 },
      { x: 55, y: 22.0 },
      { x: 44, y: 23.6 },
      { x: 34, y: 24.0 },
      { x: 22, y: 22.2 },
      { x: 15, y: 18.0 },
      { x: 10, y: 9.2 },
    ],
    caveCurrents: [
      {
        x: 23,
        y: 10.6,
        radius: 8.5,
        vx: 1.18,
        vy: 0.08,
        label: 'Hydro-Flume Test Current (1.2 m/s)',
      },
    ],
    watertightHatches: [
      {
        id: 'pg-hatch-1',
        x: 24,
        y: 22.5,
        radius: 1.8,
        label: 'Test Bulkhead Crank Hatch',
      },
    ],
    checkpoints: [
      { id: 'pg-flume', name: '🌊 Lane 1 · Hydro-Flume', x: 22, y: 10.6, radius: 3.8, hint: 'Test Swim Speed, Slipstream & Pull-and-Glide wall shelter!' },
      { id: 'pg-silt', name: '🌫️ Lane 2 · Silt & Ceiling', x: 43, y: 13.2, radius: 3.8, hint: 'Skim the floor to test Silt-Ghost & Percolation Immunity!' },
      { id: 'pg-cryo', name: '❄️ Lane 3 · Cryo Thermocline', x: 55, y: 21.0, radius: 4.0, hint: 'Hover in -10°C pocket to test Cold Resist & Thermal Mantle!' },
      { id: 'pg-relic-vault', name: '🧭 Lane 5 · Dark Relic Vault', x: 44, y: 24.2, radius: 4.2, hint: 'Test Torch Reach, Sonar Range & Cartographer Relic Compass!' },
      { id: 'pg-deco-shelf', name: '🫧 Lane 6 · 6m Deco Shelf', x: 10, y: 6.0, radius: 3.8, hint: 'Click Test 6m Deco to feel Steady-Trim & Halcyon Fast-Lock!' },
    ],
    collectibles: [
      { id: 'pg-rel-1', name: 'Calibration Crystal A', kind: 'crystal', x: 49, y: 25.2, points: 100, radius: 1.4 },
      { id: 'pg-rel-2', name: 'Calibration Relic B', kind: 'relic', x: 40, y: 25.8, points: 150, radius: 1.4 },
      { id: 'pg-rel-3', name: 'Hydro-Gauge Beacon', kind: 'compass', x: 31, y: 24.4, points: 150, radius: 1.4 },
    ],
    exitZone: { x: 10, y: 1.0, radius: 5.5 },
    theme: {
      id: 'cenote-turquoise',
      surfaceStyle: 'cenote',
      skyTop: '#0b2944',
      skyBot: '#155e75',
      waterTop: '#0a3d5c',
      waterBot: '#021224',
      rockFill: '#1a2736',
      rockStroke: '#38bdf8',
    },
  };
}

/**
 * Inject crisp, predictable test hazards & live trial livery into a Proving Grounds DiveSession (v217).
 */
export function configureProvingGroundsSession(session, trialLivery = null) {
  if (!session) return session;
  session.isProvingGrounds = true;
  if (session.hazards) {
    // Lane 3: Predictable -10°C Cryo Thermocline Chamber
    session.hazards.thermoclines = [
      { id: 'pg-thermo-cryo', x: 55, y: 21.0, rx: 5.8, ry: 3.4, tempDropC: 10, phase: 0 },
    ];
    // Lane 2: Fragile Limestone Percolation Ceiling
    session.hazards.percolationZones = [
      { id: 'pg-perc-1', x: 43, y: 13.5, ceilY: 10.2, halfWidth: 5.5, intensity: 0, siltCooldown: 0, streaks: [] },
    ];
    // Lane 4: Surge Bulkhead Hatch
    session.hazards.shiftingHatches = [
      { id: 'pg-surge-1', x: 31, y: 23.6, radius: 2.6, periodSec: 7.5, phase: 0, isWreckHatch: true, openness: 1, pushCooldown: 0, label: 'Test Surge Door' },
    ];
  }
  // Demo Sunken Gear Cache with Diablo III Light Pillar in Lane 5 (never writes to logbook!)
  session.worldGearCaches = [
    {
      id: 'pg-demo-cache',
      gearKey: 'demo:proving-cache',
      slot: 'torch',
      itemId: 'world-cartographer-torch',
      itemName: 'Calibration Gear Cache (Demo)',
      name: 'Calibration Gear Cache (Demo)',
      tier: 'mythic',
      icon: '📦',
      clue: 'Proving Grounds demonstration loot beacon',
      x: 46,
      y: 24.5,
      radius: 1.9,
      opened: false,
      isDemoCache: true,
      beamColor: '#facc15',
    },
  ];
  if (session.hazards) {
    session.hazards.worldGearCaches = session.worldGearCaches;
  }
  if (trialLivery) {
    applyTrialLiveryToSession(session, trialLivery);
  }
  return session;
}

/**
 * Hot-swap a diver's livery & live gear performance profile directly inside an active DiveSession (v217–v219).
 * Respects active Mode & Difficulty tuning (Guided / Standard / Hardcore / Daily / Drill / Trench / Purist).
 */
export function applyTrialLiveryToSession(session, livery, tuningOverride = null) {
  if (!session?.diver || !livery) return null;
  const clean = { ...STOCK_BASELINE_LIVERY, ...livery };
  const tuningCtx = tuningOverride
    ? { ...(session.rigTuningCtx || {}), ...tuningOverride }
    : (session.rigTuningCtx || { difficulty: session.difficulty || 'standard', modifiers: session.modifiers || [] });
  if (tuningOverride) {
    session.rigTuningCtx = tuningCtx;
    if (tuningOverride.difficulty) session.difficulty = tuningOverride.difficulty;
  }
  const perf = computeRigPerformanceProfile(clean, tuningCtx);
  session.diver.livery = clean;
  session.diver.torchReachMult = perf.torchReachMult || 1.0;
  session.rigPerf = perf;
  if (session.hazards) {
    session.hazards.rigPerf = perf;
  }
  // v218–v219: In Proving Grounds, immediately reflect the swapped rig's mode-tuned cylinder overfill (+bonusStartBar)
  if (session.isProvingGrounds && session.diveState?.tanks && session.diveState?.mixes) {
    const extraBar = Math.max(0, Math.min(55, Math.round(Number(perf.bonusStartBar) || 0)));
    for (const gasId of Object.keys(session.diveState.tanks)) {
      const tank = session.diveState.tanks[gasId];
      const mix = session.diveState.mixes[gasId];
      if (!tank || !mix || !mix.tankVolumeL) continue;
      const baseStartBar = mix._baseStartBar || 200;
      mix._baseStartBar = baseStartBar;
      const targetStartBar = baseStartBar + extraBar;
      const curFrac = tank.maxLiters > 0 ? Math.max(0, Math.min(1, tank.litersRemaining / tank.maxLiters)) : 1;
      const nextFrac = curFrac >= 0.9 ? 1 : curFrac;
      mix.startBar = targetStartBar;
      tank.maxLiters = mix.tankVolumeL * targetStartBar;
      tank.litersRemaining = tank.maxLiters * nextFrac;
      tank.bar = tank.litersRemaining / mix.tankVolumeL;
    }
  }
  // Emit a crisp celebratory ring of water bubbles around the diver on hot-swap
  if (Array.isArray(session.bubbles)) {
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      session.bubbles.push({
        x: session.diver.x + Math.cos(ang) * 0.45,
        y: session.diver.y + Math.sin(ang) * 0.45,
        vx: Math.cos(ang) * 1.1,
        vy: Math.sin(ang) * 0.7 - 0.6,
        r: 0.08 + (i % 3) * 0.04,
        alpha: 0.82,
        life: 0.9,
        maxLife: 0.9,
      });
    }
  }
  return perf;
}

/**
 * Load a gentle ~6m decompression stop onto the diver's fast compartment so they can
 * immediately feel Steady-Trim Offgas Mastery, Deco Offgas % and Halcyon Fast-Lock (v217).
 */
export function injectTestDecoStop(session) {
  const ds = session?.diveState;
  if (!ds || !Array.isArray(ds.compartments)) return false;
  // Load compartments so ceiling sits cleanly around ~4.4m -> 6m deco stop (~20s)
  for (let i = 0; i < ds.compartments.length; i++) {
    ds.compartments[i].pN2 = Math.max(ds.compartments[i].pN2 || 0.79, i === 0 ? 3.25 : 2.35);
  }
  if (ds.tanks?.O2 && ds.tanks.O2.bar < 140) {
    ds.tanks.O2.bar = 180;
    ds.tanks.O2.litersRemaining = ds.tanks.O2.maxLiters * 0.9;
  }
  return true;
}

const PG_TUNING_MODES = Object.freeze([
  Object.freeze({ id: 'standard', icon: '🤿', label: 'Standard', ctx: { difficulty: 'standard', isDaily: false, mutatorId: '', isRescueDrill: false, isTrench: false } }),
  Object.freeze({ id: 'hardcore', icon: '🔥', label: 'Hardcore', ctx: { difficulty: 'hardcore', isDaily: false, mutatorId: '', isRescueDrill: false, isTrench: false } }),
  Object.freeze({ id: 'guided', icon: '🛡️', label: 'Guided', ctx: { difficulty: 'guided', isDaily: false, mutatorId: '', isRescueDrill: false, isTrench: false } }),
  Object.freeze({ id: 'daily', icon: '📅', label: 'Daily', ctx: { difficulty: 'standard', isDaily: true, mutatorId: '', isRescueDrill: false, isTrench: false } }),
  Object.freeze({ id: 'purist', icon: '🧭', label: 'Purist', ctx: { difficulty: 'standard', isDaily: false, mutatorId: 'purist', isRescueDrill: false, isTrench: false } }),
]);

/**
 * Interactive floating HUD bar shown ONLY during a Gear Proving Grounds Field Test (v217–v219).
 * Allows instant mid-water A/B rig swapping, live Difficulty/Mode tuning, performance telemetry, Deco test & Workshop return.
 */
export function createProvingGroundsHudBar({
  getSession,
  getEquippedLivery,
  onExitToWorkshop,
  playGearEquip = null,
  showToast = null,
}) {
  const barEl = document.getElementById('proving-grounds-bar');
  let activePresetId = 'equipped';
  let activeTuningIdx = 0;
  let customTrialLivery = null;
  let customTrialLabel = '';
  let pollTimer = null;

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function updateLiveTelemetry() {
    if (!barEl || barEl.hidden) return;
    const sess = getSession?.();
    if (!sess || !sess.isProvingGrounds) {
      hide();
      return;
    }
    const readEl = barEl.querySelector('#pg-live-readout');
    if (!readEl) return;
    const perf = sess.rigPerf || computeRigPerformanceProfile(sess.diver?.livery, sess.rigTuningCtx);
    const spd = Math.hypot(sess.diver?.vx || 0, sess.diver?.vy || 0).toFixed(1);
    const swimPct = Math.round((perf.swimSpeedMult - 1) * 100);
    const gasPct = Math.round((1 - perf.gasBurnMult) * 100);
    const coldTxt = perf.coldResist >= 0.99 ? 'COLD-PROOF' : `Cold ${Math.round(perf.coldResist * 100)}%`;
    const archTag = perf.dominantArchetype ? `${perf.dominantArchetype.icon} ${perf.dominantArchetype.short}` : 'HYBRID';
    const modeTag = perf.tuning && perf.tuning.id !== 'standard' ? ` · ${perf.tuning.icon} ${perf.tuning.label.toUpperCase()}` : '';
    const extraBits = [];
    if (perf.bonusStartBar > 0) extraBits.push(`+${perf.bonusStartBar}b`);
    if (perf.narcDepthBonusM > 0) extraBits.push(`+${perf.narcDepthBonusM}m Depth`);
    if (perf.combatMaxHpBonus > 0) extraBits.push(`${100 + perf.combatMaxHpBonus} HP`);
    const hydroMode = sess.hydrology?.mode && sess.hydrology.mode !== 'calm'
      ? ` · 🌊 ${sess.hydrology.mode.toUpperCase()} (-${Math.round((1 - (sess.hydrology.effectiveDragMult || 1)) * 100)}% drag)`
      : '';
    readEl.textContent = `[${archTag}${modeTag}] ${spd} m/s (+${swimPct}%) · Gas -${gasPct}% · ${coldTxt}${extraBits.length ? ` · ${extraBits.join(' · ')}` : ''}${hydroMode}`;
  }

  function renderBar() {
    if (!barEl) return;
    const pills = [];
    if (customTrialLivery) {
      pills.push({ id: 'trial', icon: '👁', label: customTrialLabel || 'Try-On Rig' });
    }
    pills.push({ id: 'equipped', icon: '🎯', label: 'Your Rig' });
    for (const pr of PROVING_GROUNDS_PRESETS) {
      pills.push({ id: pr.id, icon: pr.icon, label: pr.label, desc: pr.desc });
    }
    const modeSpec = PG_TUNING_MODES[activeTuningIdx] || PG_TUNING_MODES[0];

    barEl.innerHTML = `
      <div class="pg-bar-top">
        <div class="pg-bar-title">🧪 <strong>GEAR PROVING GROUNDS</strong> <span id="pg-live-readout" class="pg-live-readout">Swim through the 6 lanes · Swap sets live!</span></div>
        <div class="pg-bar-actions">
          <button type="button" class="btn tiny secondary" id="btn-pg-cycle-mode" title="Cycle Mode & Difficulty gear tuning live (Standard → Hardcore → Guided → Daily → Purist)">${modeSpec.icon} ${modeSpec.label}</button>
          <button type="button" class="btn tiny secondary" id="btn-pg-test-deco" title="Load a quick 6m decompression stop to test Deco Offgas & Steady-Trim">🫧 Test 6m Deco</button>
          <button type="button" class="btn tiny primary" id="btn-pg-exit-workshop">← Back to Workshop</button>
        </div>
      </div>
      <div class="pg-preset-strip" role="radiogroup" aria-label="Live Mid-Water Rig Switcher">
        ${pills
          .map(
            (p) => `<button type="button" class="pg-preset-pill${activePresetId === p.id ? ' active' : ''}" data-pg-preset="${p.id}" title="${p.desc || p.label}">${p.icon} ${p.label}</button>`
          )
          .join('')}
      </div>
    `;

    barEl.querySelector('#btn-pg-exit-workshop')?.addEventListener('click', () => {
      hide();
      onExitToWorkshop?.();
    });
    barEl.querySelector('#btn-pg-cycle-mode')?.addEventListener('click', () => {
      const sess = getSession?.();
      if (!sess) return;
      activeTuningIdx = (activeTuningIdx + 1) % PG_TUNING_MODES.length;
      const nextMode = PG_TUNING_MODES[activeTuningIdx];
      const perf = applyTrialLiveryToSession(sess, sess.diver?.livery || STOCK_BASELINE_LIVERY, nextMode.ctx);
      playGearEquip?.('all', nextMode.id === 'hardcore' ? 'epic' : 'rare');
      showToast?.(`${perf?.tuning?.badge || `${nextMode.icon} ${nextMode.label}`} — live stats & tank overfill recalibrated!`, 2.8);
      renderBar();
      updateLiveTelemetry();
    });
    barEl.querySelector('#btn-pg-test-deco')?.addEventListener('click', () => {
      const sess = getSession?.();
      if (sess && injectTestDecoStop(sess)) {
        showToast?.('🫧 Loaded 6m Calibration Deco Stop! Swim to 6m shelf & hold steady trim.', 3.2);
      }
    });
    barEl.querySelectorAll('button[data-pg-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-pg-preset');
        const sess = getSession?.();
        if (!sess) return;
        let nextLiv = null;
        let label = '';
        if (pid === 'trial' && customTrialLivery) {
          nextLiv = customTrialLivery;
          label = customTrialLabel || 'Try-On Rig';
        } else if (pid === 'equipped') {
          nextLiv = getEquippedLivery?.() || STOCK_BASELINE_LIVERY;
          label = 'Your Equipped Rig';
        } else {
          const found = PROVING_GROUNDS_PRESETS.find((x) => x.id === pid);
          if (found) {
            nextLiv = found.livery;
            label = `${found.icon} ${found.label}`;
          }
        }
        if (!nextLiv) return;
        activePresetId = pid;
        const perf = applyTrialLiveryToSession(sess, nextLiv);
        playGearEquip?.('all', perf?.capstoneActive ? 'mythic' : 'rare');
        showToast?.(`⚡ Live Swapped: ${label} (+${Math.round((perf.swimSpeedMult - 1) * 100)}% Swim · -${Math.round((1 - perf.gasBurnMult) * 100)}% Gas · -${Math.round((1 - perf.siltStirMult) * 100)}% Silt)`, 2.6);
        renderBar();
        updateLiveTelemetry();
      });
    });
  }

  function show({ trialLivery = null, trialLabel = '', initialPresetId = 'equipped', initialModeId = 'standard' } = {}) {
    customTrialLivery = trialLivery ? { ...trialLivery } : null;
    customTrialLabel = trialLabel || '';
    activePresetId = customTrialLivery ? 'trial' : initialPresetId;
    const foundModeIdx = PG_TUNING_MODES.findIndex((m) => m.id === initialModeId);
    activeTuningIdx = foundModeIdx >= 0 ? foundModeIdx : 0;
    if (barEl) {
      barEl.hidden = false;
      renderBar();
      updateLiveTelemetry();
    }
    stopPolling();
    pollTimer = setInterval(updateLiveTelemetry, 250);
  }

  function hide() {
    stopPolling();
    if (barEl) {
      barEl.hidden = true;
      barEl.innerHTML = '';
    }
  }

  return { show, hide, updateLiveTelemetry, getActivePresetId: () => activePresetId };
}
