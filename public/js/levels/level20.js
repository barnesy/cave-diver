import { createLevelTheme } from './themes.js';

/**
 * Level 20: Boy-Bulok Asian Karst Sump (Baisuntau Ridge, Uzbekistan)
 * Campaign Grand Finale at 185m — Asia's deepest high-altitude alpine karst cave sumps.
 * - Ultra-hypoxic TMX 6/82 across a massive 380m unlined dual-sump alpine traverse
 * - Triple bifurcating tectonic galleries, warm fissure currents & tight 1.06m squeezes
 * - Emerge into the East Alpine Resurgence Spring under high Central Asian twilight
 */
export const LEVEL_20 = {
  id: 'boy-bulok-asian-sump',
  name: 'Boy-Bulok Asian Karst Sump',
  difficultyRank: 20,
  tier: 4,
  subtitle: 'Baisuntau Ridge, Uzbekistan • 185m Alpine Tectonic Finale',
  description:
    'Final 185m grand traverse through Central Asia\'s deepest alpine karst sump beneath Uzbekistan\'s Baisuntau Ridge. Navigate unlined for 380m on TMX 6/82 across ice-cold snowmelt shears, twin tectonic sumps, and a narrow resurgence chimney.',
  badge: 'Summit 185m',
  parTimeSec: 840,
  lined: false,
  reelMetersPerDiver: 380,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp6',
  ascentSwitchDepthM: 24.0,
  bounds: { xMin: -46, xMax: 404, yMin: -6, yMax: 194 },
  spawn: { x: 10.0, y: 2.0 },
  exitZone: { x: 356.0, y: 1.8, radius: 6.4, name: 'East Alpine Resurgence' },
  haloclineY: 54.0,
  theme: createLevelTheme('boybulok-alpine'),

  gasOverrides: {
    TMX1455: {
      name: 'TMX 6/82',
      shortLabel: '6/82',
      role: 'Abyss (16–215m)',
      fO2: 0.06,
      fHe: 0.82,
      fN2: 0.12,
      tankVolumeL: 54.0,
      modM: 215.0,
      minM: 16.0,
    },
    EAN32: {
      tankVolumeL: 18.5,
    },
    O2: {
      tankVolumeL: 14.5,
    },
  },

  geothermalVents: [
    { x: 86.0, y: 88.0, halfWidth: 3.4, height: 22, strength: 3.8 },
    { x: 148.0, y: 116.0, halfWidth: 4.0, height: 26, strength: 4.3 },
    { x: 226.0, y: 184.0, halfWidth: 4.6, height: 28, strength: 4.8 },
    { x: 294.0, y: 94.0, halfWidth: 3.8, height: 24, strength: 4.2 },
    { x: 338.0, y: 26.0, halfWidth: 3.2, height: 15, strength: 3.4 },
  ],

  openBasins: [
    { kind: 'entry', xMin: 1, xMax: 19, rimHalf: 5.8, flareAdd: 2.5, lipTilt: 0.24, floorY: 3.0, sunAngle: 1.50 },
    { kind: 'exit', xMin: 348, xMax: 364, rimHalf: 5.6, flareAdd: 2.2, lipTilt: -0.22, floorY: 3.0, sunAngle: 1.62 },
  ],

  segments: [
    // Snowmelt Gorge Entry -> Tectonic Shear (0m -> 54m)
    { ax: 10, ay: 1.0, bx: 10, by: 20.0, ra: 5.8, rb: 4.6 },
    { ax: 10, ay: 20.0, bx: 30, by: 38.0, ra: 4.6, rb: 3.8 },
    { ax: 30, ay: 38.0, bx: 52, by: 54.0, ra: 3.8, rb: 4.2 },

    // First Bifurcation: Tight Alpine Marble Siphon (1.8m) vs Lower Siphon Drain
    { ax: 52, ay: 54.0, bx: 90, by: 52.0, ra: 3.1, rb: 2.0 },
    { ax: 90, ay: 52.0, bx: 120, by: 82.0, ra: 2.0, rb: 1.8 },
    { ax: 120, ay: 82.0, bx: 148, by: 114.0, ra: 1.8, rb: 4.2 },

    { ax: 52, ay: 54.0, bx: 86, by: 88.0, ra: 3.4, rb: 3.5 },
    { ax: 86, ay: 88.0, bx: 116, by: 116.0, ra: 3.5, rb: 2.9 },
    { ax: 116, ay: 116.0, bx: 148, by: 114.0, ra: 2.9, rb: 4.2 },

    // Second Deep Tectonic Plunge -> 185m Terminal Asian Sump
    { ax: 148, ay: 114.0, bx: 186, by: 148.0, ra: 4.2, rb: 3.5 },
    { ax: 186, ay: 148.0, bx: 226, by: 184.0, ra: 3.5, rb: 5.2 },
    { ax: 226, ay: 184.0, bx: 248, by: 185.0, ra: 4.8, rb: 3.6 },

    // Upper Pillar Bypass around 148m Drop
    { ax: 148, ay: 114.0, bx: 188, by: 120.0, ra: 2.5, rb: 2.0 },
    { ax: 188, ay: 120.0, bx: 214, by: 152.0, ra: 2.0, rb: 2.3 },
    { ax: 214, ay: 152.0, bx: 226, by: 184.0, ra: 2.3, rb: 4.0 },

    // East Alpine Resurgence Chimney Climb (184m -> 0m)
    { ax: 226, ay: 184.0, bx: 264, by: 138.0, ra: 4.5, rb: 3.2 },
    { ax: 264, ay: 138.0, bx: 294, by: 94.0, ra: 3.2, rb: 4.0 },
    { ax: 294, ay: 94.0, bx: 320, by: 52.0, ra: 3.4, rb: 2.1 },
    { ax: 320, ay: 52.0, bx: 338, by: 24.0, ra: 2.1, rb: 3.4 },
    { ax: 338, ay: 24.0, bx: 356, by: 5.6, ra: 3.2, rb: 4.8 },
    { ax: 356, ay: 5.6, bx: 356, by: 0.8, ra: 5.0, rb: 5.0 },

    // 8 High-Altitude Blind Tectonic Fissures
    { ax: 30, ay: 38.0, bx: 4, by: 50.0, ra: 2.4, rb: 1.9 },
    { ax: 90, ay: 52.0, bx: 102, by: 26.0, ra: 2.0, rb: 1.8 },
    { ax: 86, ay: 88.0, bx: 66, by: 118.0, ra: 2.5, rb: 2.0 },
    { ax: 116, ay: 116.0, bx: 118, by: 144.0, ra: 2.4, rb: 2.0 },
    { ax: 186, ay: 148.0, bx: 174, by: 172.0, ra: 2.4, rb: 2.0 },
    { ax: 226, ay: 184.0, bx: 204, by: 184.5, ra: 2.8, rb: 2.2 },
    { ax: 294, ay: 94.0, bx: 326, by: 100.0, ra: 2.4, rb: 2.0 },
    { ax: 338, ay: 24.0, bx: 314, by: 10.0, ra: 2.0, rb: 1.8 },
  ],
  guideline: [],

  zoneLines: [
    {
      id: 'zone-switch',
      xMin: 329,
      xMax: 347,
      y: 24,
      color: '#38bdf8',
      title: '24m ASCENT SWITCH · TAP EAN32 [1]',
    },
    {
      id: 'zone-deco',
      xMin: 346,
      xMax: 366,
      y: 6.0,
      color: '#4ade80',
      title: '6m O2 DECO SHELF · TAP O2 100% [3]',
    },
  ],

  depthMarkers: [
    { x: 10, y: 20, label: '20m • Snowmelt Rim', color: 'rgba(251, 191, 36, 0.52)' },
    { x: 52, y: 54, label: '54m • Sump Shear', color: 'rgba(56, 189, 248, 0.50)' },
    { x: 148, y: 114, label: '114m • Pamir Vault', color: 'rgba(192, 132, 252, 0.55)' },
    { x: 226, y: 184, label: '185m • Terminal Asian Sump', color: 'rgba(192, 132, 252, 0.55)' },
    { x: 294, y: 94, label: '94m • East Chimney Base', color: 'rgba(56, 189, 248, 0.50)' },
    { x: 338, y: 24, label: '24m • Alpine Stage Shelf', color: 'rgba(251, 191, 36, 0.52)' },
  ],

  checkpoints: [
    {
      id: 'cp1',
      name: 'Snowmelt Gorge Lip (20m)',
      x: 10,
      y: 20.0,
      radius: 5.6,
      expectedGas: 'EAN32',
      hint: 'Anchor your 380m reel [G] inside the icy Baisuntau alpine gorge.',
    },
    {
      id: 'cp2',
      name: 'Baisuntau Sump Shear (54m)',
      x: 52,
      y: 54.0,
      radius: 4.5,
      expectedGas: 'TMX1455',
      hint: 'Switch to ultra-hypoxic TMX 6/82 [2] before entering the marble siphon branches.',
    },
    {
      id: 'cp3',
      name: 'Pamir Tectonic Vault (114m)',
      x: 148,
      y: 114.0,
      radius: 4.6,
      expectedGas: 'TMX1455',
      hint: 'Both siphons meet at 114m — drop smoothly toward the 185m terminal sump.',
    },
    {
      id: 'cp4',
      name: 'Terminal Asian Sump (185m)',
      x: 226,
      y: 184.0,
      radius: 5.4,
      expectedGas: 'TMX1455',
      hint: '185m expedition record reached! Begin your staged climb up the East Alpine Chimney.',
    },
    {
      id: 'cp5',
      name: 'East Alpine Chimney (94m)',
      x: 294,
      y: 94.0,
      radius: 4.4,
      expectedGas: 'TMX1455',
      hint: 'Use the warm fissure updraft carefully ascending toward the shallow stage shelf.',
    },
    {
      id: 'cp6',
      name: 'Alpine 24m Stage Switch',
      x: 338,
      y: 24.0,
      radius: 4.5,
      expectedGas: 'EAN32',
      hint: 'Switch back to EAN32 above 26m and navigate into the resurgence deco basin.',
    },
    {
      id: 'cp7',
      name: 'Resurgence 6m O2 Deco',
      x: 356,
      y: 5.6,
      radius: 7.0,
      expectedGas: 'O2',
      hint: 'Switch to O2 100% and clear all decompression ceilings to finish the world tour.',
    },
  ],

  collectibles: [
    { id: 'col-1', name: 'Steppe Limestone Calcite', x: 4, y: 50.0, radius: 1.5, points: 520 },
    { id: 'col-2', name: 'Snowmelt Isotope Vial', x: 102, y: 26.0, radius: 1.5, points: 560 },
    { id: 'col-3', name: 'Marble Siphon Fluorite', x: 90, y: 52.0, radius: 1.5, points: 580 },
    { id: 'col-4', name: 'Tectonic Breccia Shard', x: 66, y: 118.0, radius: 1.5, points: 640 },
    { id: 'col-5', name: 'Fissure Barite Cluster', x: 118, y: 144.0, radius: 1.5, points: 700 },
    { id: 'col-6', name: 'Pamir Onyx Blade', x: 116, y: 116.0, radius: 1.5, points: 620 },
    { id: 'col-7', name: 'Bypass Pillar Beacon', x: 188, y: 120.0, radius: 1.5, points: 740 },
    { id: 'col-8', name: '172m Siphon Gauge', x: 174, y: 172.0, radius: 1.5, points: 860 },
    { id: 'col-9', name: 'Boy-Bulok Expedition Plaque', x: 204, y: 184.5, radius: 1.6, points: 1050 },
    { id: 'col-10', name: '185m Asian Abyssal Crystal', x: 248, y: 185.0, radius: 1.6, points: 1150 },
    { id: 'col-11', name: 'Chimney Seismic Relay', x: 264, y: 138.0, radius: 1.5, points: 780 },
    { id: 'col-12', name: 'Baisuntau Ammonite Fossil', x: 326, y: 100.0, radius: 1.5, points: 720 },
    { id: 'col-13', name: 'Alpine Quartz Needle', x: 314, y: 10.0, radius: 1.5, points: 600 },
    { id: 'col-14', name: 'Resurgence Pressure Capsule', x: 320, y: 52.0, radius: 1.5, points: 640 },
  ],
};
