import { createLevelTheme } from './themes.js';

/**
 * Level 15: Strýtan Hydrothermal Spires (Eyjafjörður, North Iceland)
 * The world's only diveable shallow-to-deep submarine hydrothermal smectite mineral chimneys.
 * - Big Strýtan cone rising in icy Eyjafjörður waters above a deep 136m tectonic feeder rift
 * - Twin thermal convection plumes & buoyant upward freshwater chimney vents
 * - Traverse deep beneath the smectite spires and surface via Arnarnesstrýtur (Little Strýtan)
 */
export const LEVEL_15 = {
  id: 'strytan-hydrothermal-chimneys',
  name: 'Strýtan Hydrothermal Spires',
  difficultyRank: 15,
  tier: 4,
  subtitle: 'Eyjafjörður, North Iceland • 136m Fjord Chimneys & Feeder Rift',
  description:
    'Descend beside the legendary smectite hydrothermal spires of Eyjafjörður in North Iceland. Navigate unlined on hypoxic TMX 8/74 through 72°C mineral plumes, map the deep 136m tectonic vent feeder, and ascend through Arnarnesstrýtur.',
  badge: 'Spires 136m',
  parTimeSec: 560,
  lined: false,
  reelMetersPerDiver: 280,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp6',
  ascentSwitchDepthM: 24.0,
  bounds: { xMin: -44, xMax: 478, yMin: -6, yMax: 146 },
  spawn: { x: 14.0, y: 2.0 },
  exitZone: { x: 306.0, y: 1.8, radius: 6.2, name: 'Arnarnesstrýtur Buoy Exit' },
  haloclineY: 38.0,
  theme: createLevelTheme('strytan-hydrothermal'),

  gasOverrides: {
    TMX1455: {
      name: 'TMX 8/74',
      shortLabel: '8/74',
      role: 'Abyss (12–162m)',
      fO2: 0.08,
      fHe: 0.74,
      fN2: 0.18,
      tankVolumeL: 40.0,
      modM: 162.0,
      minM: 12.0,
    },
    EAN32: {
      tankVolumeL: 15.0,
    },
    O2: {
      tankVolumeL: 11.0,
    },
  },

  geothermalVents: [
    { x: 44.0, y: 65.0, halfWidth: 3.4, height: 22, strength: 4.1 },
    { x: 108.0, y: 98.0, halfWidth: 3.8, height: 24, strength: 4.5 },
    { x: 176.0, y: 136.0, halfWidth: 4.5, height: 26, strength: 4.8 },
    { x: 244.0, y: 82.0, halfWidth: 3.6, height: 22, strength: 4.2 },
    { x: 288.0, y: 26.0, halfWidth: 3.2, height: 14, strength: 3.4 },
  ],

  openBasins: [
    { kind: 'entry', xMin: 5, xMax: 23, rimHalf: 6.2, flareAdd: 2.5, lipTilt: 0.22, floorY: 3.0, sunAngle: 1.52 },
    { kind: 'exit', xMin: 298, xMax: 314, rimHalf: 5.5, flareAdd: 2.2, lipTilt: -0.22, floorY: 3.0, sunAngle: 1.62 },
  ],

  segments: [
    // Entry Mooring & Big Strýtan Mineral Cone Descent (0m -> 65m)
    { ax: 14, ay: 1.0, bx: 14, by: 18.0, ra: 6.2, rb: 4.8 },
    { ax: 14, ay: 18.0, bx: 26, by: 38.0, ra: 4.8, rb: 3.8 },
    { ax: 26, ay: 38.0, bx: 44, by: 65.0, ra: 3.8, rb: 4.4 },

    // Upper Spire Crown Gallery Bypass (38m -> 24m -> 65m)
    { ax: 26, ay: 38.0, bx: 54, by: 24.0, ra: 2.6, rb: 2.3 },
    { ax: 54, ay: 24.0, bx: 78, by: 34.0, ra: 2.3, rb: 2.1 },
    { ax: 78, ay: 34.0, bx: 44, by: 65.0, ra: 2.1, rb: 3.6 },

    // Smectite Base -> Deep Hydrothermal Feeder Corridor (65m -> 136m)
    { ax: 44, ay: 65.0, bx: 78, by: 78.0, ra: 4.2, rb: 3.1 },
    { ax: 78, ay: 78.0, bx: 108, by: 98.0, ra: 3.1, rb: 3.6 },
    { ax: 108, ay: 98.0, bx: 142, by: 118.0, ra: 3.6, rb: 3.2 },
    { ax: 142, ay: 118.0, bx: 176, by: 136.0, ra: 3.2, rb: 5.0 },

    // Deep Lower Rift Branch (Rejoins 136m Vent Vault)
    { ax: 78, ay: 78.0, bx: 98, by: 112.0, ra: 2.4, rb: 2.1 },
    { ax: 98, ay: 112.0, bx: 136, by: 130.0, ra: 2.1, rb: 2.5 },
    { ax: 136, ay: 130.0, bx: 176, by: 136.0, ra: 2.5, rb: 4.2 },

    // East Ascent via Arnarnesstrýtur Chimneys (136m -> 0m)
    { ax: 176, ay: 136.0, bx: 212, by: 114.0, ra: 4.5, rb: 3.1 },
    { ax: 212, ay: 114.0, bx: 244, by: 82.0, ra: 3.1, rb: 4.0 },
    { ax: 244, ay: 82.0, bx: 268, by: 52.0, ra: 3.5, rb: 2.3 },
    { ax: 268, ay: 52.0, bx: 288, by: 24.0, ra: 2.3, rb: 3.4 },
    { ax: 288, ay: 24.0, bx: 306, by: 6.2, ra: 3.2, rb: 4.8 },
    { ax: 306, ay: 6.2, bx: 306, by: 0.8, ra: 5.0, rb: 5.0 },

    // 8 Hydrothermal Chimney Blind Pockets & Pockets
    { ax: 14, ay: 18.0, bx: -6, by: 24.0, ra: 2.4, rb: 2.0 },
    { ax: 54, ay: 24.0, bx: 60, by: 10.5, ra: 1.9, rb: 1.8 },
    { ax: 44, ay: 65.0, bx: 20, by: 72.0, ra: 2.4, rb: 2.0 },
    { ax: 108, ay: 98.0, bx: 122, by: 76.0, ra: 2.2, rb: 1.9 },
    { ax: 142, ay: 118.0, bx: 150, by: 94.0, ra: 2.2, rb: 1.9 },
    { ax: 176, ay: 136.0, bx: 196, by: 140.0, ra: 2.8, rb: 2.3 },
    { ax: 244, ay: 82.0, bx: 274, by: 88.0, ra: 2.4, rb: 2.0 },
    { ax: 288, ay: 24.0, bx: 268, by: 12.0, ra: 2.1, rb: 1.8 },

    // === Secret Sonar-Only Basalt Rift Seam -> Caldron Spire Vault (v193) ===
    { ax: 274.0, ay: 88.0, bx: 284.0, by: 88.8, ra: 1.5, rb: 1.9, secretLair: true },
    { ax: 284.0, ay: 88.8, bx: 298.0, by: 90.5, ra: 2.5, rb: 3.6, secretLair: true },
    { ax: 298.0, ay: 90.5, bx: 320.0, by: 92.5, ra: 3.6, rb: 3.8, secretLair: true },
    { ax: 320.0, ay: 92.5, bx: 342.0, by: 95.0, ra: 3.9, rb: 4.3, secretLair: true },
    { ax: 342.0, ay: 95.0, bx: 364.0, by: 96.8, ra: 4.1, rb: 4.5, secretLair: true },
    { ax: 364.0, ay: 96.8, bx: 388.0, by: 98.0, ra: 4.6, rb: 8.2, secretLair: true },
    // CALDRON SPIRE VAULT - 58m x 26m Boss Arena centered at (416, 98)
    { ax: 388.0, ay: 98.0, bx: 406.0, by: 98.0, ra: 9.6, rb: 13.0, secretLair: true },
    { ax: 406.0, ay: 98.0, bx: 426.0, by: 98.0, ra: 13.0, rb: 13.0, secretLair: true },
    { ax: 426.0, ay: 98.0, bx: 440.5, by: 98.0, ra: 11.8, rb: 8.6, secretLair: true },
  ],
  guideline: [],

  zoneLines: [
    {
      id: 'zone-switch',
      xMin: 279,
      xMax: 297,
      y: 24,
      color: '#38bdf8',
      title: '24m ASCENT SWITCH · TAP EAN32 [1]',
    },
    {
      id: 'zone-deco',
      xMin: 296,
      xMax: 316,
      y: 6.0,
      color: '#4ade80',
      title: '6m O2 DECO SHELF · TAP O2 100% [3]',
    },
  ],

  depthMarkers: [
    { x: 14, y: 18, label: '18m • Strýtan Summit', color: 'rgba(251, 191, 36, 0.52)' },
    { x: 26, y: 38, label: '38m • Vent Plume Halocline', color: 'rgba(251, 191, 36, 0.52)' },
    { x: 44, y: 65, label: '65m • Smectite Base', color: 'rgba(56, 189, 248, 0.50)' },
    { x: 176, y: 136, label: '136m • Tectonic Feeder Rift', color: 'rgba(192, 132, 252, 0.55)' },
    { x: 244, y: 82, label: '82m • Arnarnes Base', color: 'rgba(56, 189, 248, 0.50)' },
    { x: 288, y: 24, label: '24m • Fjord Deco Stage', color: 'rgba(251, 191, 36, 0.52)' },
  ],

  checkpoints: [
    {
      id: 'cp1',
      name: 'Strýtan Cone Summit (18m)',
      x: 14,
      y: 18.0,
      radius: 5.8,
      expectedGas: 'EAN32',
      hint: 'Anchor your 280m reel [G] beside the glowing 72°C hydrothermal spire tip.',
    },
    {
      id: 'cp2',
      name: 'Smectite Plume Shear (38m)',
      x: 26,
      y: 38.0,
      radius: 4.5,
      expectedGas: 'TMX1455',
      hint: 'Switch to hypoxic TMX 8/74 [2] at the shimmering 38m freshwater-fjord halocline.',
    },
    {
      id: 'cp3',
      name: 'Eastern Vent Chamber (78m)',
      x: 78,
      y: 78.0,
      radius: 4.0,
      expectedGas: 'TMX1455',
      hint: 'Both spire corridors converge at 78m — follow the deep basalt trough east.',
    },
    {
      id: 'cp4',
      name: '136m Tectonic Feeder Vault',
      x: 176,
      y: 136.0,
      radius: 5.2,
      expectedGas: 'TMX1455',
      hint: 'Maximum depth 136m reached! Ride the giant hydrothermal plume up into Arnarnesstrýtur.',
    },
    {
      id: 'cp5',
      name: 'Arnarnesstrýtur Chimney (82m)',
      x: 244,
      y: 82.0,
      radius: 4.4,
      expectedGas: 'TMX1455',
      hint: 'Control upward buoyancy through thermal vent eddies up the east fjord chimney.',
    },
    {
      id: 'cp6',
      name: 'Arnarnes 24m Gas Switch',
      x: 288,
      y: 24.0,
      radius: 4.5,
      expectedGas: 'EAN32',
      hint: 'Switch back to EAN32 above 26m before entering the shallow deco basin.',
    },
    {
      id: 'cp7',
      name: 'Fjord 6m O2 Deco Crest',
      x: 306,
      y: 5.7,
      radius: 7.0,
      expectedGas: 'O2',
      hint: 'Switch to O2 100% and clear all decompression stops under Arnarnesstrýtur.',
    },
  ],

  collectibles: [
    { id: 'col-1', name: 'Fjord Basalt Limpet', x: -6, y: 24.0, radius: 1.5, points: 360 },
    { id: 'col-2', name: '72°C Vent Calcite Cone', x: 60, y: 10.5, radius: 1.5, points: 400 },
    { id: 'col-3', name: 'Smectite Silicate Flake', x: 54, y: 24.0, radius: 1.5, points: 380 },
    { id: 'col-4', name: 'Arctic Sponge Crust', x: 20, y: 72.0, radius: 1.5, points: 420 },
    { id: 'col-5', name: 'Freshwater-Brine Sensor', x: 44, y: 65.0, radius: 1.5, points: 440 },
    { id: 'col-6', name: 'Thermal Pyrite Nodule', x: 122, y: 76.0, radius: 1.5, points: 480 },
    { id: 'col-7', name: 'Lower Rift Quartzite', x: 98, y: 112.0, radius: 1.5, points: 500 },
    { id: 'col-8', name: 'Superheated Vent Core', x: 136, y: 130.0, radius: 1.5, points: 540 },
    { id: 'col-9', name: 'Geothermal Bore Sample', x: 150, y: 94.0, radius: 1.5, points: 520 },
    { id: 'col-10', name: 'Abyssal Basalt Obsidian', x: 196, y: 140.0, radius: 1.6, points: 780 },
    { id: 'col-11', name: 'Isotope Chimney Sample', x: 212, y: 114.0, radius: 1.5, points: 560 },
    { id: 'col-12', name: 'Cold Seep Starfish Fossil', x: 274, y: 88.0, radius: 1.5, points: 600 },
    { id: 'col-13', name: 'Little Strýtan Mineral', x: 268, y: 12.0, radius: 1.5, points: 460 },
    { id: 'col-14', name: 'Fjord Thermocline Capsule', x: 268, y: 52.0, radius: 1.5, points: 520 },
  ],
};
