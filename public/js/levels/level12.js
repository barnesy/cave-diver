import { createLevelTheme } from './themes.js';

/**
 * Level 12: Hranická Propast Abyss — Carbonic Hypogenic Rift (Moravia, Czechia)
 * World-record depth expedition breaking the 100m barrier to 104m.
 * Standard Trimix 14/55 would exceed O2 toxicity below 104m, so expedition gas
 * switches to hypoxic TMX 11/65 (34L doubles, MOD 135m) beneath 30m with zero fixed line
 * and nine deceptive tectonic fissures.
 */
export const LEVEL_12 = {
  id: 'hranicka-propast-rift',
  name: 'Hranická Propast Abyss',
  subtitle: 'Max Depth 104m · Hypoxic TMX 11/65 · 215m Reel Budget',
  difficultyRank: 12,
  tier: 3,
  description:
    'Plunge below 100 meters into Moravia’s carbonic-acid tectonic rift on custom hypoxic TMX 11/65 gas. Thread steep unlined razor fissures down to the 104m ROV survey station and manage long helium offgassing climbs.',
  bounds: {
    xMin: -50,
    xMax: 470,
    yMin: -6,
    yMax: 114,
  },
  roughness: 0.50,
  spawn: { x: 15, y: 2.0 },
  haloclineY: 36.0,
  reelMetersPerDiver: 215,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp5',
  ascentSwitchCheckpointId: 'cp8',
  ascentSwitchDepthM: 24.0,
  gasOverrides: {
    TMX1455: {
      name: 'TMX 11/65',
      shortLabel: '11/65',
      role: 'Abyss (5–135m)',
      fO2: 0.11,
      fHe: 0.65,
      fN2: 0.24,
      tankVolumeL: 34.0,
      modM: 135.0,
      minM: 4.5,
    },
  },
  theme: createLevelTheme('moravia-rift'),
  openBasins: [
    { kind: 'entry', xMin: 8, xMax: 22, rimHalf: 5.0, flareAdd: 2.6, lipTilt: 0.35, floorY: 2.6, sunAngle: 1.50 },
    { kind: 'exit', xMin: 400, xMax: 414, rimHalf: 5.0, flareAdd: 2.6, lipTilt: -0.35, floorY: 2.6, sunAngle: 1.65 },
  ],
  segments: [
    // === MAIN HYPERSONIC CARBONIC RIFT ROUTE (1..16) ===
    { ax: 15, ay: 0.8, bx: 15, by: 16.0, ra: 5.0, rb: 3.8 },
    { ax: 15, ay: 16.0, bx: 42, by: 30.0, ra: 3.8, rb: 3.5 },
    { ax: 42, ay: 30.0, bx: 76, by: 48.0, ra: 3.5, rb: 3.2 },
    { ax: 76, ay: 48.0, bx: 110, by: 68.0, ra: 3.2, rb: 3.4 },
    { ax: 110, ay: 68.0, bx: 134, by: 72.0, ra: 2.1, rb: 1.85 },
    { ax: 134, ay: 72.0, bx: 164, by: 92.0, ra: 2.5, rb: 3.6 },
    { ax: 164, ay: 92.0, bx: 198, by: 104.0, ra: 3.6, rb: 4.4 },
    { ax: 198, ay: 104.0, bx: 234, by: 102.0, ra: 4.4, rb: 3.9 },
    { ax: 234, ay: 102.0, bx: 264, by: 80.0, ra: 3.5, rb: 3.1 },
    { ax: 264, ay: 80.0, bx: 294, by: 58.0, ra: 2.4, rb: 1.95 },
    { ax: 294, ay: 58.0, bx: 328, by: 42.0, ra: 2.9, rb: 3.3 },
    { ax: 328, ay: 42.0, bx: 356, by: 24.0, ra: 3.2, rb: 3.3 },
    { ax: 356, ay: 24.0, bx: 386, by: 14.0, ra: 2.4, rb: 2.3 },
    { ax: 386, ay: 14.0, bx: 396, by: 6.2, ra: 3.0, rb: 4.6 },
    { ax: 396, ay: 6.2, bx: 407, by: 6.0, ra: 4.6, rb: 5.0 },
    { ax: 407, ay: 6.0, bx: 407, by: 0.6, ra: 5.2, rb: 5.0 },

    // === 9 DECEPTIVE MORAVIAN TECTONIC FISSURES ===
    // 1. West Gorge Trap (30m -> 56m)
    { ax: 42, ay: 30.0, bx: 22, by: 48.0, ra: 2.4, rb: 2.0 },
    { ax: 22, ay: 48.0, bx: 8, by: 56.0, ra: 2.0, rb: 1.85 },
    // 2. Overhead Dissolution Bell (48m -> 22m)
    { ax: 76, ay: 48.0, bx: 94, by: 28.0, ra: 2.5, rb: 2.1 },
    { ax: 94, ay: 28.0, bx: 118, by: 22.0, ra: 2.1, rb: 1.9 },
    // 3. Lower Rift Cul-de-sac (68m -> 98m)
    { ax: 110, ay: 68.0, bx: 88, by: 86.0, ra: 2.5, rb: 2.0 },
    { ax: 88, ay: 86.0, bx: 72, by: 98.0, ra: 2.0, rb: 1.85 },
    // 4. Deepest West Alcove (92m -> 108m!)
    { ax: 164, ay: 92.0, bx: 142, by: 106.0, ra: 2.5, rb: 2.1 },
    { ax: 142, ay: 106.0, bx: 120, by: 108.0, ra: 2.1, rb: 1.9 },
    // 5. Inverted Floor Chimney (104m -> 68m)
    { ax: 198, ay: 104.0, bx: 208, by: 82.0, ra: 2.5, rb: 2.1 },
    { ax: 208, ay: 82.0, bx: 190, by: 68.0, ra: 2.1, rb: 1.9 },
    // 6. False 108m Sump Pocket (102m -> 108m)
    { ax: 234, ay: 102.0, bx: 266, by: 108.0, ra: 2.6, rb: 2.1 },
    { ax: 266, ay: 108.0, bx: 294, by: 104.0, ra: 2.1, rb: 1.9 },
    // 7. East Lateral Fault (80m -> 78m)
    { ax: 264, ay: 80.0, bx: 298, by: 84.0, ra: 2.4, rb: 2.0 },
    { ax: 298, ay: 84.0, bx: 324, by: 78.0, ra: 2.0, rb: 1.85 },
    // 8. Silt Terrace Blind Chimney (42m -> 16m)
    { ax: 328, ay: 42.0, bx: 308, by: 22.0, ra: 2.5, rb: 2.1 },
    { ax: 308, ay: 22.0, bx: 288, by: 16.0, ra: 2.1, rb: 1.9 },
    // 9. Ascent Siphon Trap (24m -> 48m)
    { ax: 356, ay: 24.0, bx: 378, by: 38.0, ra: 2.3, rb: 2.0 },
    { ax: 378, ay: 38.0, bx: 398, by: 48.0, ra: 2.0, rb: 1.85 },
  ],
  guideline: [],
  checkpoints: [
    {
      id: 'cp1',
      name: 'Propast Rim Switch Sill (30m)',
      x: 42,
      y: 30.0,
      radius: 3.6,
      expectedGas: 'TMX1455',
      hint: 'Switch to hypoxic TMX 11/65 [2]! Required for safe PPO2 past 104 meters.',
    },
    {
      id: 'cp2',
      name: 'Carbonic Slope Junction (48m)',
      x: 76,
      y: 48.0,
      radius: 3.4,
      expectedGas: 'TMX1455',
      hint: 'Set an arrow [G] below the dissolution bell before descending into the acidic rift.',
    },
    {
      id: 'cp3',
      name: 'Razor Fissure Squeeze (70m)',
      x: 122,
      y: 70.0,
      radius: 2.6,
      expectedGas: 'TMX1455',
      hint: 'Tight 70m slot — watch the 98m false sink directly beneath the entry jaw.',
    },
    {
      id: 'cp4',
      name: 'Abyssal Rift Drop (92m)',
      x: 164,
      y: 92.0,
      radius: 3.6,
      expectedGas: 'TMX1455',
      hint: 'Final plunge below 100m ahead. Maintain steady trim in hypoxic Trimix!',
    },
    {
      id: 'cp5',
      name: 'Hranická 104m ROV Station',
      x: 216,
      y: 103.0,
      radius: 4.2,
      expectedGas: 'TMX1455',
      hint: '104m Turnaround! Confirm at least 100 bar of TMX 11/65 and climb northeast.',
    },
    {
      id: 'cp6',
      name: 'Moravian Fault Rise (80m)',
      x: 264,
      y: 80.0,
      radius: 3.2,
      expectedGas: 'TMX1455',
      hint: 'Thread up the steep chimney squeeze on your left — ignore the east horizontal fault.',
    },
    {
      id: 'cp7',
      name: 'Silt Terrace Arch (42m)',
      x: 328,
      y: 42.0,
      radius: 3.4,
      expectedGas: 'TMX1455',
      hint: 'Cross east toward the 24m ascent sill; do not climb into the blind upper cupola.',
    },
    {
      id: 'cp8',
      name: 'Ascent Switch Sill (24m)',
      x: 356,
      y: 24.0,
      radius: 3.4,
      expectedGas: 'EAN32',
      hint: 'Switch back to EAN32 [1] immediately! Do NOT ride 11/65 hypoxic mix up to the surface.',
    },
    {
      id: 'cp9',
      name: 'Bečva Gorge Deco Shelf (6m)',
      x: 402,
      y: 6.1,
      radius: 4.8,
      expectedGas: 'O2',
      hint: 'Hold 6m on O2 100% [3] until every minute of your >100m deco obligation clears!',
    },
  ],
  zoneLines: [
    {
      id: 'zone-moravia-halo',
      xMin: 8,
      xMax: 22,
      y: 36.0,
      color: '#38bdf8',
      title: '36m · CARBONIC HYPOGENIC THERMOCLINE',
    },
    {
      id: 'zone-hranicka-tmx',
      xMin: 35,
      xMax: 49,
      y: 30.0,
      color: '#38bdf8',
      title: '30m · HYPOXIC TRIMIX SWITCH (EAN32 → TMX 11/65)',
    },
    {
      id: 'zone-hranicka-ascent',
      xMin: 349,
      xMax: 363,
      y: 24.0,
      color: '#38bdf8',
      title: '24m · ASCENT GAS SWITCH (TMX 11/65 → EAN32)',
    },
    {
      id: 'zone-hranicka-deco',
      xMin: 394,
      xMax: 414,
      y: 6.0,
      color: '#4ade80',
      title: '6m · GORGE EXPEDITION DECO SHELF (O2 100%)',
    },
  ],
  depthMarkers: [
    { y: 33.7, label: '33.7m · EAN32 MOD (SWITCH TO TMX 11/65)', color: 'rgba(248, 113, 113, 0.36)' },
    { y: 80.0, label: '80.0m · HYPERSONIC CARBONIC RIFT ZONE', color: 'rgba(56, 189, 248, 0.32)' },
    { y: 100.0, label: '100.0m · WORLD-DEPTH BOUNDARY (EXTREME SAC)', color: 'rgba(248, 113, 113, 0.44)' },
  ],
  parTimeSec: 450,
  collectibles: [
    // Main-route targets
    { id: 'l12-carbonic-tag', name: 'Hranice Limestone Core Marker', kind: 'survey', scale: 0.86, points: 225, x: 28.5, y: 23.0 },
    { id: 'l12-calcite-fin', name: 'Paleozoic Aragonite Spear', kind: 'crystal', scale: 0.96, points: 260, x: 93.0, y: 58.0 },
    { id: 'l12-rov-cable', name: '100m ROV Fiber Beacon', kind: 'survey', scale: 0.94, points: 275, x: 181.0, y: 98.0 },
    { id: 'l12-propast-plaque', name: '104m Propast Survey Plaque', kind: 'survey', scale: 1.06, points: 350, x: 220.0, y: 102.5 },
    { id: 'l12-fault-fluorite', name: 'Moravian Cobalt Fluorite', kind: 'crystal', scale: 0.98, points: 275, x: 311.0, y: 50.0 },
    { id: 'l12-becva-emblem', name: 'Bečva Karst Brass Emblem', kind: 'relic', scale: 0.95, points: 275, x: 371.0, y: 19.0 },
    // 9 Deceptive fissure treasures
    { id: 'l12-west-amethyst', name: 'Silesian Carbonic Amethyst', kind: 'crystal', scale: 1.44, points: 540, x: 8.0, y: 56.0 },
    { id: 'l12-bell-trilobite', name: 'Devonian Moravian Trilobite', kind: 'fossil', scale: 1.46, points: 560, x: 118.0, y: 22.0 },
    { id: 'l12-deep-spool', name: '98m Rift Exploration Spool', kind: 'relic', scale: 1.56, points: 660, x: 72.0, y: 98.0 },
    { id: 'l12-108m-siderite', name: '108m Abyssal Siderite Heart', kind: 'crystal', scale: 1.82, points: 975, x: 120.0, y: 108.0 },
    { id: 'l12-pipe-geode', name: 'Hypogenic Gypsum Halo Geode', kind: 'crystal', scale: 1.54, points: 640, x: 190.0, y: 68.0 },
    { id: 'l12-108m-bell', name: '1995 Depth Sounder Brass Bell', kind: 'relic', scale: 1.84, points: 1025, x: 294.0, y: 104.0 },
    { id: 'l12-fault-fossil', name: 'Pre-Alpine Crinoid Slab', kind: 'fossil', scale: 1.52, points: 625, x: 324.0, y: 78.0 },
    { id: 'l12-cupola-shard', name: 'Moravian Milky Quartz Crown', kind: 'crystal', scale: 1.46, points: 550, x: 288.0, y: 16.0 },
    { id: 'l12-ascent-lamp', name: 'Antique Brass Carbide Lamp', kind: 'relic', scale: 1.50, points: 590, x: 398.0, y: 48.0 },
  ],
  exitZone: {
    name: 'Bečva Gorge Resurgence',
    x: 407,
    y: 1.5,
    radius: 4.8,
  },
};
