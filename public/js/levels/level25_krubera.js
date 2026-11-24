import { createLevelTheme } from './themes.js';

/**
 * Level 25 (Tier V · Ultimate World-Record Finale): Krubera-Voronya Abyssal Sump, Western Caucasus
 * The legendary "Everest of Caves" terminal flooded siphon! An extreme 198m unlined alpine karst
 * abyss requiring ultra-deep hypoxic TMX 8/76, 405m exploration reel, deep mineral thermal vents,
 * and recovery of the Sunken Krubera Deep-Sump Telemetry Probe at 195m.
 */
export const LEVEL_25 = {
  id: 'krubera-voronya-sump',
  name: 'Krubera-Voronya Abyssal Sump',
  subtitle: 'Arabika Massif, Western Caucasus • 198m Ultimate Unlined Sump Recovery',
  difficultyRank: 33,
  tier: 5,
  badge: 'Everest 198m',
  description:
    'The ultimate technical cave summit beneath the Western Caucasus — the flooded terminal sump of Krubera-Voronya. Lay your 405m reel [G] with zero compass aid, plunge to an awe-inspiring 198m on ultra-hypoxic TMX 8/76, ride buoyant deep mineral vents, recover the Krubera Abyssal Telemetry Probe at 195m, and execute a disciplined staged decompression ascent.',
  bounds: {
    xMin: -44,
    xMax: 402,
    yMin: -6,
    yMax: 214,
  },
  roughness: 0.42,
  spawn: { x: 14, y: 2.0 },
  exitZone: {
    x: 326,
    y: 1.8,
    radius: 7.2,
    name: 'Arabika Alpine Resurgence',
  },
  haloclineY: 54.0,
  parTimeSec: 640,
  lined: false,
  reelMetersPerDiver: 405,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 28.0,
  theme: createLevelTheme('boybulok-alpine'),

  gasOverrides: {
    TMX1455: {
      name: 'TMX 8/76',
      shortLabel: '8/76',
      role: 'Everest Sump (10–210m)',
      fO2: 0.08,
      fHe: 0.76,
      fN2: 0.16,
      tankVolumeL: 54.0,
      modM: 210.0,
      minM: 10.0,
    },
    EAN32: { tankVolumeL: 18.0 },
    O2: { tankVolumeL: 14.0 },
  },

  recoveryTarget: {
    id: 'krubera-abyssal-probe',
    name: 'Krubera Abyssal Telemetry Probe',
    kind: 'probe',
    x: 204.0,
    y: 195.0,
    radius: 4.8,
    points: 2400,
  },

  geothermalVents: [
    { x: 190.0, y: 197.5, radius: 4.0, lift: 4.5, tempC: 36 },
    { x: 256.0, y: 162.0, radius: 3.6, lift: 4.8, tempC: 34 },
    { x: 286.0, y: 98.0, radius: 3.4, lift: 4.2, tempC: 30 },
  ],

  openBasins: [
    { kind: 'entry', xMin: 6, xMax: 22, rimHalf: 5.5, flareAdd: 2.4, lipTilt: 0.4, floorY: 2.6, sunAngle: 1.44 },
    { kind: 'exit', xMin: 318, xMax: 334, rimHalf: 5.2, flareAdd: 2.5, lipTilt: -0.4, floorY: 2.6, sunAngle: 1.66 },
  ],

  segments: [
    // Alpine Sinkhole Entry -> Cold Karst Pitch (0m -> 56m)
    { ax: 14, ay: 1.0, bx: 14, by: 22.0, ra: 6.4, rb: 4.6 },
    { ax: 14, ay: 22.0, bx: 44, by: 54.0, ra: 4.4, rb: 3.8 },
    // Upper Siphon Split & Crystal Side Gallery
    { ax: 44, ay: 54.0, bx: 78, by: 92.0, ra: 3.8, rb: 3.6 },
    { ax: 78, ay: 92.0, bx: 58, by: 108.0, ra: 3.0, rb: 3.2 },
    // Mid-Abyssal Vertical Limestone Rift (92m -> 146m)
    { ax: 78, ay: 92.0, bx: 112, by: 138.0, ra: 3.5, rb: 2.7 },
    // Game-Over Squeeze (138m -> 158m)
    { ax: 112, ay: 138.0, bx: 144, by: 158.0, ra: 2.6, rb: 3.4 },
    // Terminal Sump Plunge into 198m Everest Floor!
    { ax: 144, ay: 158.0, bx: 176, by: 194.0, ra: 3.6, rb: 4.6 },
    { ax: 176, ay: 194.0, bx: 214, by: 198.0, ra: 4.8, rb: 5.0 },
    // Deep Terminal Alcove
    { ax: 214, ay: 198.0, bx: 238, by: 184.0, ra: 4.5, rb: 3.8 },
    // Great Caucasus Ascent Chimney (184m -> 115m -> 52m -> 28m)
    { ax: 238, ay: 184.0, bx: 262, by: 146.0, ra: 3.8, rb: 3.6 },
    { ax: 262, ay: 146.0, bx: 286, by: 96.0, ra: 3.6, rb: 3.8 },
    { ax: 286, ay: 96.0, bx: 298, by: 48.0, ra: 3.8, rb: 3.8 },
    { ax: 298, ay: 48.0, bx: 306, by: 28.0, ra: 3.8, rb: 4.0 },
    // 6m Alpine Deco Gallery -> Resurgence Exit
    { ax: 306, ay: 28.0, bx: 308, by: 12.0, ra: 4.0, rb: 4.0 },
    { ax: 308, ay: 12.0, bx: 314, by: 6.5, ra: 4.0, rb: 4.4 },
    { ax: 314, ay: 6.5, bx: 326, by: 6.4, ra: 4.4, rb: 5.4 },
    { ax: 326, ay: 6.4, bx: 326, by: 0.6, ra: 5.8, rb: 5.4 },

    // === Secret Sonar-Only Abyssal Rift -> Throne of the Abyssal Empress (v189) ===
    // Sealed behind the 198m Terminal Sump floor at (214, 198.0), running deep beneath the ascent chimney!
    { ax: 214.0, ay: 198.0, bx: 224.0, by: 197.2, ra: 1.5, rb: 1.9, secretLair: true },
    // Quiet Armory Sanctum
    { ax: 224.0, ay: 197.2, bx: 238.0, by: 196.0, ra: 2.5, rb: 3.6, secretLair: true },
    // Abyssal Rift Corridor Gauntlet
    { ax: 238.0, ay: 196.0, bx: 260.0, by: 194.0, ra: 3.6, rb: 3.8, secretLair: true },
    { ax: 260.0, ay: 194.0, bx: 282.0, by: 190.0, ra: 3.9, rb: 4.3, secretLair: true },
    { ax: 282.0, ay: 190.0, bx: 304.0, by: 186.5, ra: 4.1, rb: 4.5, secretLair: true },
    { ax: 304.0, ay: 186.5, bx: 330.0, by: 184.0, ra: 4.6, rb: 8.2, secretLair: true },
    // ABYSSAL EMPRESS THRONE — 58m × 26m Boss Arena centered at (358, 184)
    { ax: 330.0, ay: 184.0, bx: 348.0, by: 184.0, ra: 9.6, rb: 13.0, secretLair: true },
    { ax: 348.0, ay: 184.0, bx: 368.0, by: 184.0, ra: 13.0, rb: 13.0, secretLair: true },
    { ax: 368.0, ay: 184.0, bx: 382.5, by: 184.0, ra: 11.8, rb: 8.6, secretLair: true },
  ],

  guideline: [],

  checkpoints: [
    {
      id: 'cp1',
      name: 'Arabika Pitch (22m)',
      x: 14,
      y: 22.0,
      radius: 4.5,
      hint: 'Unlined sump! Deploy your 405m reel [G] and switch to TMX 8/76 before 30m.',
    },
    {
      id: 'cp2',
      name: 'Thermal Shear (54m)',
      x: 44,
      y: 54.0,
      radius: 4.2,
      expectedGas: 'TMX1455',
      hint: 'Crossing 54m cold karst shear on ultra-hypoxic TMX 8/76.',
    },
    {
      id: 'cp3',
      name: 'Two Captains Squeeze (138m)',
      x: 112,
      y: 138.0,
      radius: 3.5,
      expectedGas: 'TMX1455',
      hint: 'Tight deep restriction — control trim and watch PPO₂!',
    },
    {
      id: 'cp4',
      name: 'Krubera Terminal Sump (198m)',
      x: 204,
      y: 195.0,
      radius: 5.2,
      expectedGas: 'TMX1455',
      hint: 'Recover the Abyssal Telemetry Probe at 195m, then ride the vents up the East Chimney!',
    },
    {
      id: 'cp5',
      name: 'East Chimney Switch (28m)',
      x: 306,
      y: 28.0,
      radius: 4.6,
      expectedGas: 'EAN32',
      hint: 'Switch to EAN32 above 30m — TMX 8/76 is acutely hypoxic near the surface!',
    },
    {
      id: 'cp6',
      name: 'Alpine Deco Shelf (6m)',
      x: 320,
      y: 6.5,
      radius: 5.8,
      expectedGas: 'O2',
      hint: 'Hold 6m on O2 100% until full deco obligation clears, then surface!',
    },
  ],

  collectibles: [
    { id: 'kru-1', kind: 'crystal', name: 'Arabika Calcite Spear', x: 58, y: 108.0, points: 320 },
    { id: 'kru-2', kind: 'fossil', name: 'Caucasus Blind Crustacean Fossil', x: 96, y: 116.0, points: 300 },
    { id: 'kru-3', kind: 'artifact', name: '2004 Expedition Line Marker', x: 144, y: 158.0, points: 360 },
    { id: 'kru-4', kind: 'crystal', name: '198m Abyssal Onyx Geode', x: 184, y: 195.0, points: 440 },
    { id: 'kru-5', kind: 'artifact', name: 'Deep Vent Core Vial', x: 262, y: 146.0, points: 380 },
    { id: 'kru-6', kind: 'crystal', name: 'Resurgence Quartz Cluster', x: 298, y: 48.0, points: 280 },
  ],

  zoneLines: [
    { id: 'kru-shear', xMin: 30, xMax: 60, y: 54.0, title: '54m KARST SHEAR', subtitle: 'TMX 8/76 Required' },
    { id: 'kru-sump', xMin: 165, xMax: 230, y: 198.0, title: '198m EVEREST SUMP', subtitle: 'World-Record Depth Floor' },
    { id: 'kru-deco', xMin: 308, xMax: 336, y: 6.5, title: '6m DECO SHELF', subtitle: 'Hold on O2 100%' },
  ],

  depthMarkers: [
    { y: 6, label: '6m O2 DECO', color: '#4ade80' },
    { y: 54, label: '54m KARST SHEAR', color: '#38bdf8' },
    { y: 138, label: '138m TWO CAPTAINS', color: '#c084fc' },
    { y: 198, label: '198m KRUBERA FLOOR', color: '#ef4444' },
  ],
};
