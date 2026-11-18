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
  bounds: { xMin: -44, xMax: 356, yMin: -6, yMax: 146 },
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
  ],
  guideline: [],

  zoneLines: [
    { xMin: -20, xMax: 85, yMin: -2, yMax: 78, label: 'Big Strýtan Smectite Cone' },
    { xMin: 85, xMax: 215, yMin: 70, yMax: 144, label: 'Eyjafjörður Hydrothermal Feeder' },
    { xMin: 215, xMax: 330, yMin: -2, yMax: 120, label: 'Arnarnesstrýtur Ascent Spires' },
  ],

  depthMarkers: [
    { x: 14, y: 18, label: '18m • Strýtan Summit' },
    { x: 26, y: 38, label: '38m • Vent Plume Halocline' },
    { x: 44, y: 65, label: '65m • Smectite Base' },
    { x: 176, y: 136, label: '136m • Tectonic Feeder Rift' },
    { x: 244, y: 82, label: '82m • Arnarnes Base' },
    { x: 288, y: 24, label: '24m • Fjord Deco Stage' },
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
