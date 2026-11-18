import { createLevelTheme } from './themes.js';

/**
 * Level 16: Kverkfjöll Ice-Magma Caverns (Vatnajökull Highlands, Iceland)
 * Subglacial geothermal caves carved between radiant blue glacier ice ceilings
 * and black volcanic basalt meltwater trenches down to 144m.
 */
export const LEVEL_16 = {
  id: 'kverkfjoll-subglacial-caves',
  name: 'Kverkfjöll Ice-Magma Caverns',
  difficultyRank: 16,
  tier: 4,
  subtitle: 'Vatnajökull Highlands, Iceland • 144m Glacial-Geothermal Recovery',
  description:
    'Plunge through a sapphire Vatnajökull glacier moulin where sub-zero ice arches meet scalding volcanic fissures. Navigate unlined on TMX 8/75 through twin crystalline ice vaults to 144m and recover the Kverkfjöll Subglacial Melt Logger.',
  badge: 'Glacier 144m',
  parTimeSec: 590,
  lined: false,
  reelMetersPerDiver: 295,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp6',
  ascentSwitchCheckpointId: 'cp1',
  ascentSwitchDepthM: 18.0,
  bounds: { xMin: -48, xMax: 328, yMin: -6, yMax: 154 },
  spawn: { x: 0.0, y: 1.8 },
  exitZone: { x: 0.0, y: 1.8, radius: 7.2 },
  haloclineY: 54.0,
  theme: createLevelTheme('kverkfjoll-glacier'),

  gasOverrides: {
    TMX1455: {
      name: 'TMX 8/75',
      shortLabel: '8/75',
      role: 'Abyss (12–165m)',
      fO2: 0.08,
      fHe: 0.75,
      fN2: 0.17,
      tankVolumeL: 42.0,
      modM: 165.0,
      minM: 12.0,
    },
    EAN32: {
      tankVolumeL: 15.5,
    },
    O2: {
      tankVolumeL: 11.5,
    },
  },

  recoveryTarget: {
    id: 'vatnajokull-melt-logger',
    name: 'Kverkfjöll Subglacial Melt Logger',
    kind: 'probe',
    x: 212.0,
    y: 141.0,
    radius: 4.8,
    points: 2500,
  },

  archWindows: [
    { x: 56.0, y: 42.0, radiusX: 12.0, radiusY: 7.0 },
    { x: 118.0, y: 92.0, radiusX: 13.0, radiusY: 8.0 },
  ],

  geothermalVents: [
    { x: 64.0, y: 80.0, halfWidth: 3.6, height: 22, strength: 4.2 },
    { x: 118.0, y: 92.0, halfWidth: 4.2, height: 24, strength: 4.6 },
    { x: 160.0, y: 120.0, halfWidth: 4.0, height: 22, strength: 4.4 },
    { x: 212.0, y: 144.0, halfWidth: 4.5, height: 22, strength: 4.5 },
  ],

  openBasins: [
    { kind: 'entry', xMin: -10, xMax: 10, rimHalf: 6.5, flareAdd: 2.6, lipTilt: 0.22, floorY: 3.0, sunAngle: 1.55 },
  ],

  segments: [
    // Moulin Entry & Subglacial Ice Collar
    { ax: 0, ay: 1.2, bx: 8, by: 18.0, ra: 7.2, rb: 5.0 },
    { ax: 8, ay: 18.0, bx: 26, by: 38.0, ra: 5.0, rb: 4.0 },
    { ax: 26, ay: 38.0, bx: 46, by: 56.0, ra: 4.0, rb: 4.2 },

    // Upper Branch: Sapphire Ice-Organ Arcade
    { ax: 46, ay: 56.0, bx: 72, by: 46.0, ra: 3.4, rb: 2.5 },
    { ax: 72, ay: 46.0, bx: 98, by: 62.0, ra: 2.5, rb: 2.3 },
    { ax: 98, ay: 62.0, bx: 118, by: 92.0, ra: 2.3, rb: 4.2 },

    // Lower Branch: Basalt Meltwater Trench (Thermal Plume Corridor)
    { ax: 46, ay: 56.0, bx: 64, by: 80.0, ra: 3.6, rb: 3.8 },
    { ax: 64, ay: 80.0, bx: 90, by: 94.0, ra: 3.8, rb: 3.2 },
    { ax: 90, ay: 94.0, bx: 118, by: 92.0, ra: 3.2, rb: 4.2 },

    // Basal Glacier Vault -> 144m Caldera Logger Chamber
    { ax: 118, ay: 92.0, bx: 158, by: 120.0, ra: 4.4, rb: 4.2 },
    { ax: 158, ay: 120.0, bx: 192, by: 136.0, ra: 4.2, rb: 4.4 },
    { ax: 192, ay: 136.0, bx: 212, by: 141.0, ra: 4.4, rb: 5.2 },
    { ax: 212, ay: 141.0, bx: 232, by: 144.0, ra: 4.8, rb: 3.8 },

    // Ice-Carved Offshoot Galleries & Basalt Pockets
    { ax: 8, ay: 18.0, bx: -14, by: 26.0, ra: 2.8, rb: 2.1 },
    { ax: 46, ay: 56.0, bx: 48, by: 28.0, ra: 2.5, rb: 2.0 },
    { ax: 72, ay: 46.0, bx: 84, by: 26.0, ra: 2.2, rb: 1.9 },
    { ax: 98, ay: 62.0, bx: 112, by: 46.0, ra: 2.2, rb: 1.9 },
    { ax: 64, ay: 80.0, bx: 50, by: 102.0, ra: 2.5, rb: 2.1 },
    { ax: 90, ay: 94.0, bx: 94, by: 118.0, ra: 2.5, rb: 2.1 },
    { ax: 158, ay: 120.0, bx: 164, by: 96.0, ra: 2.6, rb: 2.1 },
    { ax: 192, ay: 136.0, bx: 196, by: 112.0, ra: 2.6, rb: 2.1 },
  ],
  guideline: [],

  zoneLines: [
    { xMin: -28, xMax: 44, yMin: -2, yMax: 58, label: 'Vatnajökull Ice Moulin' },
    { xMin: 44, xMax: 130, yMin: 22, yMax: 125, label: 'Ice-Basalt Twin Bifurcation' },
    { xMin: 130, xMax: 248, yMin: 88, yMax: 150, label: 'Kverkfjöll Basal Magma Vault' },
  ],

  depthMarkers: [
    { x: 8, y: 18, label: '18m • Moulin Throat' },
    { x: 46, y: 56, label: '56m • Ice-Magma Shear' },
    { x: 72, y: 46, label: '46m • Blue-Ice Arcade' },
    { x: 118, y: 92, label: '92m • Crystal Convergence' },
    { x: 158, y: 120, label: '120m • Subglacial Geyser' },
    { x: 212, y: 141, label: '144m • Logger Abyss' },
  ],

  checkpoints: [
    {
      id: 'cp1',
      name: 'Cryo Moulin Collar (18m)',
      x: 8,
      y: 18.0,
      radius: 5.2,
      expectedGas: 'EAN32',
      hint: 'Anchor your 295m reel [G] cleanly inside the sculpted sapphire ice collar.',
    },
    {
      id: 'cp2',
      name: 'Subglacial Shear (56m)',
      x: 46,
      y: 56.0,
      radius: 4.5,
      expectedGas: 'TMX1455',
      hint: 'Switch to TMX 8/75 [2] before choosing either the Ice Arcade or Basalt Trench.',
    },
    {
      id: 'cp3',
      name: 'Crystal Moraine Vault (92m)',
      x: 118,
      y: 92.0,
      radius: 4.6,
      expectedGas: 'TMX1455',
      hint: 'Both subglacial corridors rejoin here — continue deep toward the basal melt vault.',
    },
    {
      id: 'cp4',
      name: 'Basal Geyser Sill (120m)',
      x: 158,
      y: 120.0,
      radius: 4.5,
      expectedGas: 'TMX1455',
      hint: 'Hold position above the thermal plume and monitor gas closely for recovery.',
    },
    {
      id: 'cp5',
      name: 'Logger Vault Rim (136m)',
      x: 192,
      y: 136.0,
      radius: 4.5,
      expectedGas: 'TMX1455',
      hint: 'Almost there — retrieve the Subglacial Melt Logger at 141m just ahead.',
    },
    {
      id: 'cp6',
      name: 'Hveradalir Ice Floor (144m)',
      x: 232,
      y: 144.0,
      radius: 4.2,
      expectedGas: 'TMX1455',
      hint: 'Maximum 144m depth! Tow the Melt Logger cleanly back through the Moulin.',
    },
  ],

  collectibles: [
    { id: 'col-1', name: 'Compressed Glacier Blue-Ice', x: -14, y: 26.0, radius: 1.5, points: 380 },
    { id: 'col-2', name: 'Cryo-Acoustic Sensor', x: 48, y: 28.0, radius: 1.5, points: 420 },
    { id: 'col-3', name: 'Ice-Ceiling Bubble Core', x: 84, y: 26.0, radius: 1.5, points: 460 },
    { id: 'col-4', name: 'Sapphire Ice Prism', x: 72, y: 46.0, radius: 1.5, points: 440 },
    { id: 'col-5', name: 'Meltwater Tephra Vein', x: 112, y: 46.0, radius: 1.5, points: 480 },
    { id: 'col-6', name: 'Subglacial Pillow Basalt', x: 50, y: 102.0, radius: 1.5, points: 520 },
    { id: 'col-7', name: 'Geothermal Rhyolite Shard', x: 94, y: 118.0, radius: 1.5, points: 560 },
    { id: 'col-8', name: 'Moraine Sill Beacon', x: 90, y: 94.0, radius: 1.5, points: 500 },
    { id: 'col-9', name: 'Volcanic Glass Pearl', x: 164, y: 96.0, radius: 1.5, points: 580 },
    { id: 'col-10', name: 'Abyssal Pressure Probe', x: 196, y: 112.0, radius: 1.5, points: 620 },
    { id: 'col-11', name: 'Magma-Ice Fluorite', x: 212, y: 141.0, radius: 1.6, points: 720 },
    { id: 'col-12', name: 'Highland Tephra Core', x: 232, y: 144.0, radius: 1.6, points: 820 },
    { id: 'col-13', name: 'Cryo-Thermal Node', x: 98, y: 62.0, radius: 1.5, points: 480 },
    { id: 'col-14', name: 'Basalt Sill Magnetometer', x: 64, y: 80.0, radius: 1.5, points: 510 },
  ],
};
