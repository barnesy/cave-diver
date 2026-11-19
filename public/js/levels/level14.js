import { createLevelTheme } from './themes.js';

export const LEVEL_14 = {
  id: 'silfra-katla-aurora-abyss',
  name: 'Silfra & Katla Aurora Abyss',
  difficultyRank: 14,
  tier: 4,
  subtitle: 'Icelandic Tectonic Rift • 128m Subglacial Geothermal Recovery',
  description:
    'Capstone unlined abyssal dive beneath the Aurora Borealis in Iceland. Penetrate black columnar basalt fissures, cross a 48m geothermal shear halocline on hypoxic TMX 9/70, ride buoyant hydrothermal vents through twin rift branches, and recover the sunken Katla Bathysphere Core from 126m.',
  badge: 'Aurora 128m',
  parTimeSec: 540,
  lined: false,
  reelMetersPerDiver: 265,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp7',
  ascentSwitchCheckpointId: 'cp1',
  ascentSwitchDepthM: 26.0,
  bounds: { xMin: -52, xMax: 320, yMin: -6, yMax: 138 },
  spawn: { x: -6.0, y: 1.8 },
  exitZone: { x: -6.0, y: 1.8, radius: 7.0, name: 'Aurora Glacial Pool' },
  haloclineY: 48.0,
  theme: createLevelTheme('aurora-glacial'),

  gasOverrides: {
    TMX1455: {
      name: 'TMX 9/70',
      shortLabel: '9/70',
      role: 'Abyss (7–145m)',
      fO2: 0.09,
      fHe: 0.70,
      fN2: 0.21,
      tankVolumeL: 38.0,
      modM: 145.0,
      minM: 6.5,
    },
    EAN32: {
      tankVolumeL: 14.5,
    },
  },

  recoveryTarget: {
    id: 'katla-bathysphere-core',
    name: 'Katla Bathysphere Core',
    kind: 'probe',
    x: 182.0,
    y: 125.0,
    radius: 4.6,
    points: 2200,
  },

  geothermalVents: [
    { x: 56.0, y: 71.0, halfWidth: 3.5, height: 19, strength: 3.8 },
    { x: 84.0, y: 89.2, halfWidth: 4.0, height: 22, strength: 4.4 },
    { x: 134.0, y: 105.5, halfWidth: 4.2, height: 24, strength: 4.6 },
    { x: 180.0, y: 129.6, halfWidth: 4.4, height: 20, strength: 4.1 },
  ],

  openBasins: [
    { kind: 'entry', name: 'Aurora Glacial Pool', xMin: -18, xMax: 6, rimHalf: 7.5, flareAdd: 2.8, lipTilt: 0.2, floorY: 3.0, sunAngle: 1.54 },
  ],

  segments: [
    // Entry Pool & Upper Tectonic Fracture
    { ax: -6, ay: 1.5, bx: -3, by: 12.0, ra: 7.5, rb: 6.2 },
    { ax: -3, ay: 12.0, bx: 12, by: 26.0, ra: 5.5, rb: 3.8 },
    { ax: 12, ay: 26.0, bx: 32, by: 46.0, ra: 3.8, rb: 4.0 },

    // Northern Route: Ice-Organ Crystal Bypass (Tight & Cold)
    { ax: 32, ay: 46.0, bx: 56, by: 43.0, ra: 3.8, rb: 2.5 },
    { ax: 56, ay: 43.0, bx: 84, by: 54.0, ra: 2.5, rb: 2.1 },
    { ax: 84, ay: 54.0, bx: 112, by: 76.0, ra: 2.15, rb: 2.8 },
    { ax: 112, ay: 76.0, bx: 134, by: 102.0, ra: 2.8, rb: 4.2 },

    // Southern Route: Geothermal Black Smoker Chute (Buoyant Updrafts)
    { ax: 32, ay: 46.0, bx: 54, by: 68.0, ra: 3.8, rb: 3.5 },
    { ax: 54, ay: 68.0, bx: 82, by: 86.0, ra: 3.5, rb: 3.9 },
    { ax: 82, ay: 86.0, bx: 108, by: 98.0, ra: 3.9, rb: 3.3 },
    { ax: 108, ay: 98.0, bx: 134, by: 102.0, ra: 3.3, rb: 4.2 },

    // Katla Convergence Dome -> Mantle Abyss (128m+)
    { ax: 134, ay: 102.0, bx: 158, by: 116.0, ra: 4.4, rb: 4.3 },
    { ax: 158, ay: 116.0, bx: 182, by: 125.0, ra: 4.3, rb: 5.0 },
    { ax: 182, ay: 125.0, bx: 204, by: 127.5, ra: 4.8, rb: 3.6 },

    // Exploration Basalt Fissures & Offshoot Pockets
    { ax: 12, ay: 26.0, bx: -10, by: 34.0, ra: 3.0, rb: 2.2 }, // West Tectonic Shelf
    { ax: 32, ay: 46.0, bx: 38, by: 22.0, ra: 2.6, rb: 2.1 }, // Glacial Ceiling Chimney
    { ax: 56, ay: 43.0, bx: 68, by: 26.0, ra: 2.3, rb: 2.0 }, // Basalt Ice-Organ Spire
    { ax: 112, ay: 76.0, bx: 122, by: 54.0, ra: 2.3, rb: 2.0 }, // Pillow-Lava Vault
    { ax: 82, ay: 86.0, bx: 72, by: 105.0, ra: 2.8, rb: 2.3 }, // Sulfur Fumarole Pit
    { ax: 108, ay: 98.0, bx: 114, by: 116.0, ra: 2.7, rb: 2.2 }, // Obsidian Rift Well
    { ax: 134, ay: 102.0, bx: 140, by: 82.0, ra: 3.0, rb: 2.2 }, // Dome Skylight Crypt
    { ax: 158, ay: 116.0, bx: 164, by: 96.0, ra: 2.8, rb: 2.1 }, // Magma Dyke Gallery
    { ax: 182, ay: 125.0, bx: 188, by: 106.0, ra: 3.0, rb: 2.2 }, // Upper Transponder Alcove
  ],
  guideline: [],

  zoneLines: [
    {
      id: 'zone-switch',
      xMin: 3,
      xMax: 21,
      y: 26,
      color: '#38bdf8',
      title: '26m ASCENT SWITCH · TAP EAN32 [1]',
    },
    {
      id: 'zone-deco',
      xMin: -16,
      xMax: 4,
      y: 6.0,
      color: '#4ade80',
      title: '6m O2 DECO SHELF · TAP O2 100% [3]',
    },
  ],

  depthMarkers: [
    { x: -1, y: 12, label: '12m • Aurora Sill', color: 'rgba(251, 191, 36, 0.52)' },
    { x: 25, y: 46, label: '48m • Thermal Shear', color: 'rgba(56, 189, 248, 0.50)' },
    { x: 78, y: 51, label: '54m • Ice-Organ Squeeze', color: 'rgba(56, 189, 248, 0.50)' },
    { x: 76, y: 84, label: '86m • Vent Field Alpha', color: 'rgba(56, 189, 248, 0.50)' },
    { x: 130, y: 100, label: '102m • Convergence Dome', color: 'rgba(192, 132, 252, 0.55)' },
    { x: 178, y: 123, label: '126m • Katla Core Vault', color: 'rgba(192, 132, 252, 0.55)' },
  ],

  checkpoints: [
    {
      id: 'cp1',
      name: 'Basalt Fracture Tie-Off (26m)',
      x: 12,
      y: 26,
      radius: 3.2,
      expectedGas: 'EAN32',
      hint: 'Anchor your unlined reel [G] at the basalt fracture rim before crossing the 48m thermal shear.',
    },
    {
      id: 'cp2',
      name: '48m Thermal Shear',
      x: 32,
      y: 46,
      radius: 3.2,
      expectedGas: 'TMX1455',
      hint: 'Switch to hypoxic TMX 9/70 [2] at the thermal shear — mandatory for the 128m Katla abyss.',
    },
    {
      id: 'cp3',
      name: 'Ice-Organ Bypass (54m)',
      x: 84,
      y: 54,
      radius: 2.4,
      expectedGas: 'TMX1455',
      hint: 'Tight columnar basalt upper bypass — trim carefully and keep reel tension tidy.',
    },
    {
      id: 'cp4',
      name: 'Black Smoker Alpha (86m)',
      x: 82,
      y: 86,
      radius: 3.2,
      expectedGas: 'TMX1455',
      hint: 'Southern hydrothermal chute — use rising thermal updrafts to conserve fin thrust.',
    },
    {
      id: 'cp5',
      name: 'Convergence Vent Dome (102m)',
      x: 134,
      y: 102,
      radius: 3.4,
      expectedGas: 'TMX1455',
      hint: 'Twin fissures converge beneath a giant thermal geyser — watch depth vs gas reserve.',
    },
    {
      id: 'cp6',
      name: 'Katla Core Approach (116m)',
      x: 158,
      y: 116,
      radius: 3.4,
      expectedGas: 'TMX1455',
      hint: 'Approach the 126m Katla Bathysphere Vault — save enough TMX 9/70 to tow it back up.',
    },
    {
      id: 'cp7',
      name: 'East Magma Apse (128m)',
      x: 204,
      y: 127.5,
      radius: 3.0,
      expectedGas: 'TMX1455',
      hint: 'Deepest basalt apse at 128m — grab the Obsidian specimen and turn for decompression.',
    },
  ],

  collectibles: [
    { id: 'col-1', name: 'Glacial Rift Quartz', x: -10, y: 34.0, radius: 1.5, points: 320 },
    { id: 'col-2', name: 'Subglacial Core Vial', x: 38, y: 22.0, radius: 1.5, points: 340 },
    { id: 'col-3', name: 'Ice-Organ Feldspar', x: 68, y: 26.0, radius: 1.5, points: 380 },
    { id: 'col-4', name: 'Basalt Needle Cluster', x: 56, y: 43.0, radius: 1.5, points: 340 },
    { id: 'col-5', name: 'Pillow-Lava Olivine', x: 122, y: 54.0, radius: 1.5, points: 420 },
    { id: 'col-6', name: 'Cryo-Seismic Relay', x: 112, y: 76.0, radius: 1.5, points: 440 },
    { id: 'col-7', name: 'Fumarole Sulfur Crystal', x: 72, y: 105.0, radius: 1.5, points: 480 },
    { id: 'col-8', name: 'Hydrothermal Tube Mineral', x: 54, y: 68.0, radius: 1.5, points: 400 },
    { id: 'col-9', name: 'Obsidian Rift Blade', x: 114, y: 116.0, radius: 1.5, points: 520 },
    { id: 'col-10', name: 'Tectonic Tilt Sensor', x: 140, y: 82.0, radius: 1.5, points: 500 },
    { id: 'col-11', name: 'Magma Dyke Garnet', x: 164, y: 96.0, radius: 1.5, points: 560 },
    { id: 'col-12', name: 'Transponder Beacon Cell', x: 188, y: 106.0, radius: 1.5, points: 600 },
    { id: 'col-13', name: 'Mantle Rift Obsidian', x: 204, y: 127.5, radius: 1.6, points: 750 },
    { id: 'col-14', name: 'Deep Vent Titanium Bolt', x: 158, y: 116.0, radius: 1.5, points: 540 },
  ],
};
