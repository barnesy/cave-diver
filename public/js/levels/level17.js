import { createLevelTheme } from './themes.js';

/**
 * Level 17: Grjótagjá Magma Fissure (Lake Mývatn, North Iceland)
 * Ultimate 152m capstone expedition: penetrate the off-limits glowing volcanic
 * rift under Mývatn on ultra-hypoxic TMX 7/78, traverse magma-lit obsidian conduits,
 * and surface into an east caldera crater spring.
 */
export const LEVEL_17 = {
  id: 'grjotagja-kleifarvatn-rift',
  name: 'Grjótagjá Magma Fissure',
  difficultyRank: 17,
  tier: 4,
  subtitle: 'Lake Mývatn, North Iceland • 152m Volcanic Rift Traverse',
  description:
    'Final 152m expedition through Lake Mývatn\'s forbidden glowing volcanic fissure. Thread fractured obsidian tubes on hypoxic TMX 7/78 across shimmering 58°C geothermal shear layers, pass beneath luminous magma skylights, and emerge in the east caldera crater.',
  badge: 'Magma 152m',
  parTimeSec: 630,
  lined: false,
  reelMetersPerDiver: 315,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp6',
  ascentSwitchDepthM: 22.0,
  bounds: { xMin: -46, xMax: 376, yMin: -6, yMax: 162 },
  spawn: { x: 12.0, y: 2.0 },
  exitZone: { x: 322.0, y: 1.8, radius: 6.4, name: 'Mývatn Caldera Spring' },
  haloclineY: 50.0,
  theme: createLevelTheme('grjotagja-lava'),

  gasOverrides: {
    TMX1455: {
      name: 'TMX 7/78',
      shortLabel: '7/78',
      role: 'Abyss (14–185m)',
      fO2: 0.07,
      fHe: 0.78,
      fN2: 0.15,
      tankVolumeL: 45.0,
      modM: 185.0,
      minM: 14.0,
    },
    EAN32: {
      tankVolumeL: 16.0,
    },
    O2: {
      tankVolumeL: 12.0,
    },
  },

  archWindows: [
    { x: 126.0, y: 90.0, radiusX: 12.5, radiusY: 7.5 },
    { x: 196.0, y: 146.0, radiusX: 16.0, radiusY: 9.0 },
  ],

  geothermalVents: [
    { x: 74.0, y: 78.0, halfWidth: 3.5, height: 22, strength: 4.3 },
    { x: 126.0, y: 92.0, halfWidth: 4.0, height: 25, strength: 4.6 },
    { x: 196.0, y: 150.0, halfWidth: 4.8, height: 28, strength: 5.0 },
    { x: 264.0, y: 78.0, halfWidth: 3.8, height: 22, strength: 4.3 },
    { x: 304.0, y: 26.0, halfWidth: 3.2, height: 15, strength: 3.6 },
  ],

  openBasins: [
    { kind: 'entry', xMin: 3, xMax: 21, rimHalf: 5.8, flareAdd: 2.4, lipTilt: 0.25, floorY: 3.0, sunAngle: 1.50 },
    { kind: 'exit', xMin: 314, xMax: 330, rimHalf: 5.6, flareAdd: 2.2, lipTilt: -0.22, floorY: 3.0, sunAngle: 1.62 },
  ],

  segments: [
    // Grjótagjá Radiant Lava Pool -> Basalt Dyke Shear (0m -> 48m)
    { ax: 12, ay: 1.0, bx: 12, by: 18.0, ra: 5.8, rb: 4.6 },
    { ax: 12, ay: 18.0, bx: 28, by: 34.0, ra: 4.6, rb: 3.8 },
    { ax: 28, ay: 34.0, bx: 46, by: 48.0, ra: 3.8, rb: 4.2 },

    // Upper Branch: Fractured Columnar Tube
    { ax: 46, ay: 48.0, bx: 78, by: 46.0, ra: 3.2, rb: 2.2 },
    { ax: 78, ay: 46.0, bx: 104, by: 66.0, ra: 2.2, rb: 2.1 },
    { ax: 104, ay: 66.0, bx: 126, by: 92.0, ra: 2.1, rb: 4.2 },

    // Lower Branch: Obsidian Fumarole Chute
    { ax: 46, ay: 48.0, bx: 74, by: 78.0, ra: 3.4, rb: 3.6 },
    { ax: 74, ay: 78.0, bx: 100, by: 96.0, ra: 3.6, rb: 3.0 },
    { ax: 100, ay: 96.0, bx: 126, by: 92.0, ra: 3.0, rb: 4.2 },

    // Convergence -> 152m Hverfjall Mantle Floor
    { ax: 126, ay: 92.0, bx: 160, by: 124.0, ra: 4.2, rb: 3.9 },
    { ax: 160, ay: 124.0, bx: 196, by: 150.0, ra: 3.9, rb: 5.2 },
    { ax: 196, ay: 150.0, bx: 214, by: 152.0, ra: 4.8, rb: 3.6 },

    // East Caldera Crater Chimney Ascent (150m -> 0m)
    { ax: 196, ay: 150.0, bx: 234, by: 118.0, ra: 4.6, rb: 3.3 },
    { ax: 234, ay: 118.0, bx: 264, by: 78.0, ra: 3.3, rb: 4.0 },
    { ax: 264, ay: 78.0, bx: 288, by: 44.0, ra: 3.5, rb: 2.2 },
    { ax: 288, ay: 44.0, bx: 304, by: 22.0, ra: 2.2, rb: 3.4 },
    { ax: 304, ay: 22.0, bx: 322, by: 6.2, ra: 3.2, rb: 4.8 },
    { ax: 322, ay: 6.2, bx: 322, by: 0.8, ra: 5.0, rb: 5.0 },

    // Volcanic Lava Tubes & Offshoot Pockets
    { ax: 28, ay: 34.0, bx: 6, by: 44.0, ra: 2.5, rb: 2.0 },
    { ax: 78, ay: 46.0, bx: 88, by: 24.0, ra: 2.1, rb: 1.85 },
    { ax: 74, ay: 78.0, bx: 56, by: 102.0, ra: 2.6, rb: 2.1 },
    { ax: 100, ay: 96.0, bx: 102, by: 122.0, ra: 2.5, rb: 2.1 },
    { ax: 160, ay: 124.0, bx: 166, by: 98.0, ra: 2.5, rb: 2.0 },
    { ax: 196, ay: 150.0, bx: 174, by: 154.0, ra: 2.8, rb: 2.2 },
    { ax: 264, ay: 78.0, bx: 294, by: 84.0, ra: 2.5, rb: 2.1 },
    { ax: 304, ay: 22.0, bx: 282, by: 10.0, ra: 2.1, rb: 1.85 },
  ],
  guideline: [],

  zoneLines: [
    {
      id: 'zone-switch',
      xMin: 295,
      xMax: 313,
      y: 22,
      color: '#38bdf8',
      title: '22m ASCENT SWITCH · TAP EAN32 [1]',
    },
    {
      id: 'zone-deco',
      xMin: 312,
      xMax: 332,
      y: 6.0,
      color: '#4ade80',
      title: '6m O2 DECO SHELF · TAP O2 100% [3]',
    },
  ],

  depthMarkers: [
    { x: 12, y: 18, label: '18m • Grjótagjá Sill', color: 'rgba(251, 191, 36, 0.52)' },
    { x: 46, y: 48, label: '48m • 58°C Lava Shear', color: 'rgba(56, 189, 248, 0.50)' },
    { x: 126, y: 92, label: '92m • Magma Skylight', color: 'rgba(56, 189, 248, 0.50)' },
    { x: 196, y: 150, label: '152m • Hverfjall Floor', color: 'rgba(192, 132, 252, 0.55)' },
    { x: 264, y: 78, label: '78m • Caldera Vent Spire', color: 'rgba(56, 189, 248, 0.50)' },
    { x: 304, y: 22, label: '22m • Caldera Deco Shelf', color: 'rgba(251, 191, 36, 0.52)' },
  ],

  checkpoints: [
    {
      id: 'cp1',
      name: 'Grjótagjá Rift Rim (18m)',
      x: 12,
      y: 18.0,
      radius: 5.6,
      expectedGas: 'EAN32',
      hint: 'Anchor your 315m reel [G] inside the electric cobalt volcanic rift.',
    },
    {
      id: 'cp2',
      name: 'Basalt Dyke Shear (48m)',
      x: 46,
      y: 48.0,
      radius: 4.5,
      expectedGas: 'TMX1455',
      hint: 'Switch to hypoxic TMX 7/78 [2] before plunging into the dual obsidian rift.',
    },
    {
      id: 'cp3',
      name: 'Obsidian Convergence (92m)',
      x: 126,
      y: 92.0,
      radius: 4.6,
      expectedGas: 'TMX1455',
      hint: 'Beneath the glowing magma skylight — descend smoothly toward the 152m mantle floor.',
    },
    {
      id: 'cp4',
      name: 'Hverfjall Mantle Floor (152m)',
      x: 196,
      y: 150.0,
      radius: 5.4,
      expectedGas: 'TMX1455',
      hint: 'Deepest point of the expedition (152m)! Begin climbing the East Caldera Chimney.',
    },
    {
      id: 'cp5',
      name: 'Caldera Vent Spire (78m)',
      x: 264,
      y: 78.0,
      radius: 4.4,
      expectedGas: 'TMX1455',
      hint: 'Manage thermal plume updrafts carefully up the steep basalt chimney.',
    },
    {
      id: 'cp6',
      name: 'East Thermal Stage (22m)',
      x: 304,
      y: 22.0,
      radius: 4.5,
      expectedGas: 'EAN32',
      hint: 'Switch back to EAN32 above 25m and cruise into the Caldera Spring deco pool.',
    },
    {
      id: 'cp7',
      name: 'Caldera 6m O2 Deco Pool',
      x: 322,
      y: 5.7,
      radius: 7.0,
      expectedGas: 'O2',
      hint: 'Switch to O2 100% and clear your entire decompression obligation to finish the campaign.',
    },
  ],

  collectibles: [
    { id: 'col-1', name: 'Cobalt Lava Glass', x: 6, y: 44.0, radius: 1.5, points: 420 },
    { id: 'col-2', name: 'Pahoehoe Basalt Core', x: 88, y: 24.0, radius: 1.5, points: 460 },
    { id: 'col-3', name: 'Fracture Xenon Probe', x: 78, y: 46.0, radius: 1.5, points: 480 },
    { id: 'col-4', name: 'Sulfur Crust Needle', x: 56, y: 102.0, radius: 1.5, points: 540 },
    { id: 'col-5', name: 'Fumarole Brine Vial', x: 102, y: 122.0, radius: 1.5, points: 580 },
    { id: 'col-6', name: 'Skylight Olivine Matrix', x: 104, y: 66.0, radius: 1.5, points: 500 },
    { id: 'col-7', name: 'Mantle Rift Pyrite', x: 166, y: 98.0, radius: 1.5, points: 620 },
    { id: 'col-8', name: 'Deep Thermal Transponder', x: 160, y: 124.0, radius: 1.5, points: 600 },
    { id: 'col-9', name: 'Abyssal Magma Crystal', x: 174, y: 154.0, radius: 1.6, points: 860 },
    { id: 'col-10', name: 'Hverfjall Scoria Relic', x: 214, y: 152.0, radius: 1.6, points: 900 },
    { id: 'col-11', name: 'Caldera Silica Geode', x: 234, y: 118.0, radius: 1.5, points: 640 },
    { id: 'col-12', name: 'Tuff Ring Garnet', x: 294, y: 84.0, radius: 1.5, points: 620 },
    { id: 'col-13', name: 'Mývatn Obsidian Shard', x: 282, y: 10.0, radius: 1.5, points: 520 },
    { id: 'col-14', name: 'Rift Pressure Capsule', x: 288, y: 44.0, radius: 1.5, points: 560 },
  ],
};
