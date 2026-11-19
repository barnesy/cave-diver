import { createLevelTheme } from './themes.js';

/**
 * Level 18: Túnel de la Atlántida (Lanzarote, Canary Islands)
 * World's longest submerged volcanic lava tube extending beneath the Atlantic Ocean.
 * - Enter Jameos Lagoon crater, cross the 42m Atlantic tide-surge halocline on TMX 7/79
 * - Dual basalt lava tubes plunging down to 160m Montaña de Arena seafloor fault
 * - Emerge up the Outer Seamount Chimney into the Atlantic Ocean Surge Exit
 */
export const LEVEL_18 = {
  id: 'tunel-de-la-atlantida',
  name: 'Túnel de la Atlántida',
  difficultyRank: 18,
  tier: 4,
  subtitle: 'Lanzarote, Canary Islands • 160m Subsea Volcanic Lava Tube',
  description:
    'Dive from Jameos Lagoon into Earth\'s longest submerged volcanic lava tube beneath the Atlantic floor. Thread tight pahoehoe basalt tubes on TMX 7/79 across 42m ocean tide-surge vents down to 160m and ascend the Outer Seamount Chimney.',
  badge: 'Atlantis 160m',
  parTimeSec: 720,
  lined: false,
  reelMetersPerDiver: 335,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp6',
  ascentSwitchDepthM: 24.0,
  bounds: { xMin: -46, xMax: 386, yMin: -6, yMax: 170 },
  spawn: { x: 10.0, y: 2.0 },
  exitZone: { x: 336.0, y: 1.8, radius: 6.4, name: 'Outer Seamount Surge Pool' },
  haloclineY: 42.0,
  theme: createLevelTheme('atlantida-volcanic'),

  gasOverrides: {
    TMX1455: {
      name: 'TMX 7/79',
      shortLabel: '7/79',
      role: 'Abyss (14–190m)',
      fO2: 0.07,
      fHe: 0.79,
      fN2: 0.14,
      tankVolumeL: 48.0,
      modM: 190.0,
      minM: 14.0,
    },
    EAN32: {
      tankVolumeL: 16.5,
    },
    O2: {
      tankVolumeL: 12.5,
    },
  },

  archWindows: [
    { x: 112.0, y: 74.0, radiusX: 13.0, radiusY: 7.5 },
    { x: 204.0, y: 150.0, radiusX: 15.0, radiusY: 8.5 },
  ],

  geothermalVents: [
    { x: 46.0, y: 42.0, halfWidth: 3.4, height: 18, strength: 3.6 },
    { x: 134.0, y: 98.0, halfWidth: 4.0, height: 24, strength: 4.3 },
    { x: 204.0, y: 158.0, halfWidth: 4.6, height: 26, strength: 4.6 },
    { x: 276.0, y: 82.0, halfWidth: 3.6, height: 22, strength: 4.1 },
    { x: 318.0, y: 26.0, halfWidth: 3.2, height: 14, strength: 3.4 },
  ],

  openBasins: [
    { kind: 'entry', xMin: 1, xMax: 19, rimHalf: 5.8, flareAdd: 2.5, lipTilt: 0.24, floorY: 3.0, sunAngle: 1.50 },
    { kind: 'exit', xMin: 328, xMax: 344, rimHalf: 5.6, flareAdd: 2.2, lipTilt: -0.22, floorY: 3.0, sunAngle: 1.62 },
  ],

  segments: [
    // Jameos Lagoon Crater -> Atlantic Surge Halocline (0m -> 42m)
    { ax: 10, ay: 1.0, bx: 10, by: 18.0, ra: 5.8, rb: 4.6 },
    { ax: 10, ay: 18.0, bx: 28, by: 30.0, ra: 4.6, rb: 3.8 },
    { ax: 28, ay: 30.0, bx: 46, by: 42.0, ra: 3.8, rb: 4.0 },

    // Upper Branch: Tight Subsea Skylight Lava Tube
    { ax: 46, ay: 42.0, bx: 82, by: 46.0, ra: 3.1, rb: 2.1 },
    { ax: 82, ay: 46.0, bx: 112, by: 74.0, ra: 2.1, rb: 2.0 },
    { ax: 112, ay: 74.0, bx: 134, by: 98.0, ra: 2.0, rb: 4.2 },

    // Lower Branch: Pahoehoe Surge Chute
    { ax: 46, ay: 42.0, bx: 78, by: 72.0, ra: 3.3, rb: 3.5 },
    { ax: 78, ay: 72.0, bx: 106, by: 96.0, ra: 3.5, rb: 2.8 },
    { ax: 106, ay: 96.0, bx: 134, by: 98.0, ra: 2.8, rb: 4.2 },

    // Subsea Fault Corridor -> 160m Montaña de Arena Abyss
    { ax: 134, ay: 98.0, bx: 168, by: 128.0, ra: 4.2, rb: 3.6 },
    { ax: 168, ay: 128.0, bx: 204, by: 158.0, ra: 3.6, rb: 5.0 },
    { ax: 204, ay: 158.0, bx: 224, by: 160.0, ra: 4.6, rb: 3.4 },

    // Outer Seamount Chimney Ascent (160m -> 0m)
    { ax: 204, ay: 158.0, bx: 244, by: 124.0, ra: 4.4, rb: 3.1 },
    { ax: 244, ay: 124.0, bx: 276, by: 82.0, ra: 3.1, rb: 4.0 },
    { ax: 276, ay: 82.0, bx: 300, by: 48.0, ra: 3.4, rb: 2.0 },
    { ax: 300, ay: 48.0, bx: 318, by: 24.0, ra: 2.0, rb: 3.4 },
    { ax: 318, ay: 24.0, bx: 336, by: 5.6, ra: 3.2, rb: 4.8 },
    { ax: 336, ay: 5.6, bx: 336, by: 0.8, ra: 5.0, rb: 5.0 },

    // 8 Blind Volcanic Lava Blisters & Pockets
    { ax: 28, ay: 30.0, bx: 4, by: 40.0, ra: 2.4, rb: 1.9 },
    { ax: 82, ay: 46.0, bx: 94, by: 24.0, ra: 2.0, rb: 1.8 },
    { ax: 78, ay: 72.0, bx: 58, by: 96.0, ra: 2.5, rb: 2.0 },
    { ax: 106, ay: 96.0, bx: 108, by: 122.0, ra: 2.4, rb: 2.0 },
    { ax: 168, ay: 128.0, bx: 174, by: 102.0, ra: 2.4, rb: 1.9 },
    { ax: 204, ay: 158.0, bx: 184, by: 160.0, ra: 2.6, rb: 2.1 },
    { ax: 276, ay: 82.0, bx: 306, by: 88.0, ra: 2.4, rb: 2.0 },
    { ax: 318, ay: 24.0, bx: 296, by: 10.0, ra: 2.0, rb: 1.8 },
  ],
  guideline: [],

  zoneLines: [
    {
      id: 'zone-switch',
      xMin: 309,
      xMax: 327,
      y: 24,
      color: '#38bdf8',
      title: '24m ASCENT SWITCH · TAP EAN32 [1]',
    },
    {
      id: 'zone-deco',
      xMin: 326,
      xMax: 346,
      y: 6.0,
      color: '#4ade80',
      title: '6m O2 DECO SHELF · TAP O2 100% [3]',
    },
  ],

  depthMarkers: [
    { x: 10, y: 18, label: '18m • Jameos Arch', color: 'rgba(251, 191, 36, 0.52)' },
    { x: 46, y: 42, label: '42m • Ocean Tide Shear', color: 'rgba(251, 191, 36, 0.52)' },
    { x: 134, y: 98, label: '98m • Sea-Cave Dome', color: 'rgba(56, 189, 248, 0.50)' },
    { x: 204, y: 158, label: '160m • Montaña de Arena', color: 'rgba(192, 132, 252, 0.55)' },
    { x: 276, y: 82, label: '82m • Seamount Squeeze', color: 'rgba(56, 189, 248, 0.50)' },
    { x: 318, y: 24, label: '24m • Atlantic Deco Stage', color: 'rgba(251, 191, 36, 0.52)' },
  ],

  checkpoints: [
    {
      id: 'cp1',
      name: 'Jameos Crater Lip (18m)',
      x: 10,
      y: 18.0,
      radius: 5.6,
      expectedGas: 'EAN32',
      hint: 'Anchor your 335m reel [G] entering the volcanic basalt tube.',
    },
    {
      id: 'cp2',
      name: 'Atlantic Surge Halocline (42m)',
      x: 46,
      y: 42.0,
      radius: 4.5,
      expectedGas: 'TMX1455',
      hint: 'Switch to hypoxic TMX 7/79 [2] before choosing the tight Skylight or Pahoehoe tube.',
    },
    {
      id: 'cp3',
      name: 'Cathedral Lava Vault (98m)',
      x: 134,
      y: 98.0,
      radius: 4.6,
      expectedGas: 'TMX1455',
      hint: 'Twin subsea tubes merge at 98m — follow the deep fault trench east to 160m.',
    },
    {
      id: 'cp4',
      name: 'Montaña de Arena Abyss (160m)',
      x: 204,
      y: 158.0,
      radius: 5.4,
      expectedGas: 'TMX1455',
      hint: 'Deepest Atlantic floor (160m) reached! Turn east up the Seamount Chimney.',
    },
    {
      id: 'cp5',
      name: 'Outer Seamount Sill (82m)',
      x: 276,
      y: 82.0,
      radius: 4.4,
      expectedGas: 'TMX1455',
      hint: 'Maintain neutral trim climbing through the 2.0m basalt chimney.',
    },
    {
      id: 'cp6',
      name: 'Seamount 24m Stage Shelf',
      x: 318,
      y: 24.0,
      radius: 4.5,
      expectedGas: 'EAN32',
      hint: 'Switch back to EAN32 above 26m and cruise into the shallow surge pool.',
    },
    {
      id: 'cp7',
      name: 'Atlantic 6m O2 Deco Rim',
      x: 336,
      y: 5.6,
      radius: 7.0,
      expectedGas: 'O2',
      hint: 'Switch to O2 100% and hold shallow deco until ceiling clears completely.',
    },
  ],

  collectibles: [
    { id: 'col-1', name: 'Pahoehoe Basalt Seal', x: 4, y: 40.0, radius: 1.5, points: 450 },
    { id: 'col-2', name: 'Skylight Olivine Drop', x: 94, y: 24.0, radius: 1.5, points: 500 },
    { id: 'col-3', name: 'Albino Munidopsis Shell', x: 82, y: 46.0, radius: 1.5, points: 520 },
    { id: 'col-4', name: 'Tide-Surge Tide Gauge', x: 58, y: 96.0, radius: 1.5, points: 580 },
    { id: 'col-5', name: 'Lava Blister Quartz', x: 108, y: 122.0, radius: 1.5, points: 620 },
    { id: 'col-6', name: 'Volcanic Glass Stalactite', x: 112, y: 74.0, radius: 1.5, points: 540 },
    { id: 'col-7', name: 'Seabed Fault Magnetite', x: 174, y: 102.0, radius: 1.5, points: 660 },
    { id: 'col-8', name: 'Atlantic Conduit Transponder', x: 168, y: 128.0, radius: 1.5, points: 640 },
    { id: 'col-9', name: 'Abyssal Arena Coral', x: 184, y: 160.0, radius: 1.6, points: 920 },
    { id: 'col-10', name: '160m Basalt Core Vial', x: 224, y: 160.0, radius: 1.6, points: 960 },
    { id: 'col-11', name: 'Seamount Sponge Skeleton', x: 244, y: 124.0, radius: 1.5, points: 680 },
    { id: 'col-12', name: 'Pelagic Drift Beacon', x: 306, y: 88.0, radius: 1.5, points: 660 },
    { id: 'col-13', name: 'Volcanic Ash Amphora', x: 296, y: 10.0, radius: 1.5, points: 560 },
    { id: 'col-14', name: 'Surge Chimney Sensor', x: 300, y: 48.0, radius: 1.5, points: 600 },
  ],
};
