import { createLevelTheme } from './themes.js';

/**
 * Level 19: Lagoa Misteriosa Abyss (Jardim, Mato Grosso do Sul, Brazil)
 * South America's iconic bottomless emerald-to-ultramarine flooded limestone sinkhole.
 * - Sunlit Cerrado doline funnel plunging vertically to 172m on ultra-hypoxic TMX 6/80
 * - Narrow twin dolomite chimneys down to 1.08m clearance
 * - Mission-required recovery of the Sunken ROV Magnetometer at 168m
 */
export const LEVEL_19 = {
  id: 'lagoa-misteriosa-abyss',
  name: 'Lagoa Misteriosa Abyss',
  difficultyRank: 19,
  tier: 4,
  subtitle: 'Mato Grosso do Sul, Brazil • 172m Cerrado Sinkhole & ROV Recovery',
  description:
    'Descend into South America\'s radiant cobalt doline at Lagoa Misteriosa. Thread vertical dolomite chimneys on hypoxic TMX 6/80 down to 172m, locate the Sunken ROV Magnetometer in the deep conduit, and complete all decompression back to the Cerrado rim.',
  badge: 'Abyss 172m',
  parTimeSec: 800,
  lined: false,
  reelMetersPerDiver: 355,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp5',
  ascentSwitchCheckpointId: 'cp1',
  ascentSwitchDepthM: 26.0,
  bounds: { xMin: -50, xMax: 340, yMin: -6, yMax: 182 },
  spawn: { x: 0.0, y: 1.8 },
  exitZone: { x: 0.0, y: 1.8, radius: 7.4, name: 'Lagoa Cerrado Sinkhole' },
  haloclineY: 56.0,
  theme: createLevelTheme('lagoa-misteriosa'),

  gasOverrides: {
    TMX1455: {
      name: 'TMX 6/80',
      shortLabel: '6/80',
      role: 'Abyss (16–205m)',
      fO2: 0.06,
      fHe: 0.80,
      fN2: 0.14,
      tankVolumeL: 52.0,
      modM: 205.0,
      minM: 16.0,
    },
    EAN32: {
      tankVolumeL: 17.5,
    },
    O2: {
      tankVolumeL: 13.5,
    },
  },

  recoveryTarget: {
    id: 'lagoa-rov-magnetometer',
    name: 'Sunken ROV Magnetometer',
    kind: 'probe',
    x: 214.0,
    y: 168.0,
    radius: 4.8,
    points: 2900,
  },

  openBasins: [
    { kind: 'entry', xMin: -11, xMax: 11, rimHalf: 6.8, flareAdd: 2.8, lipTilt: 0.22, floorY: 3.2, sunAngle: 1.54 },
  ],

  segments: [
    // Sunlit Lagoa Funnel & Cerrado Thermocline (0m -> 56m)
    { ax: 0, ay: 1.2, bx: 8, by: 24.0, ra: 7.4, rb: 5.2 },
    { ax: 8, ay: 24.0, bx: 28, by: 46.0, ra: 5.2, rb: 4.2 },
    { ax: 28, ay: 46.0, bx: 50, by: 60.0, ra: 4.2, rb: 4.4 },

    // Upper Branch: Tight Dolomite Curtain Chimney
    { ax: 50, ay: 60.0, bx: 78, by: 54.0, ra: 3.2, rb: 2.1 },
    { ax: 78, ay: 54.0, bx: 106, by: 78.0, ra: 2.1, rb: 1.9 },
    { ax: 106, ay: 78.0, bx: 126, by: 106.0, ra: 1.9, rb: 4.2 },

    // Lower Branch: Wide Sandstone Sink Chute
    { ax: 50, ay: 60.0, bx: 72, by: 88.0, ra: 3.8, rb: 3.6 },
    { ax: 72, ay: 88.0, bx: 98, by: 108.0, ra: 3.6, rb: 3.0 },
    { ax: 98, ay: 108.0, bx: 126, by: 106.0, ra: 3.0, rb: 4.2 },

    // Deep Funnel Neck -> 172m ROV Conduit
    { ax: 126, ay: 106.0, bx: 162, by: 144.0, ra: 4.4, rb: 4.0 },
    { ax: 162, ay: 144.0, bx: 194, by: 162.0, ra: 4.0, rb: 4.4 },
    { ax: 194, ay: 162.0, bx: 214, by: 168.0, ra: 4.4, rb: 5.2 },
    { ax: 214, ay: 168.0, bx: 236, by: 172.0, ra: 4.8, rb: 3.8 },

    // Karst Side Galleries & Dolomite Offshoots
    { ax: 8, ay: 24.0, bx: -14, by: 34.0, ra: 2.6, rb: 2.0 },
    { ax: 50, ay: 60.0, bx: 52, by: 30.0, ra: 2.4, rb: 1.9 },
    { ax: 78, ay: 54.0, bx: 90, by: 30.0, ra: 2.0, rb: 1.8 },
    { ax: 72, ay: 88.0, bx: 56, by: 112.0, ra: 2.5, rb: 2.0 },
    { ax: 98, ay: 108.0, bx: 100, by: 134.0, ra: 2.4, rb: 2.0 },
    { ax: 162, ay: 144.0, bx: 168, by: 116.0, ra: 2.5, rb: 2.0 },
    { ax: 194, ay: 162.0, bx: 198, by: 134.0, ra: 2.5, rb: 2.0 },
  ],
  guideline: [],

  zoneLines: [
    { xMin: -30, xMax: 46, yMin: -2, yMax: 66, label: 'Cerrado Sunlit Sinkhole' },
    { xMin: 46, xMax: 136, yMin: 26, yMax: 140, label: 'Bodoquena Twin Chimneys' },
    { xMin: 136, xMax: 256, yMin: 110, yMax: 178, label: '172m Bottomless Karst Conduit' },
  ],

  depthMarkers: [
    { x: 8, y: 24, label: '24m • Sapphire Funnel' },
    { x: 50, y: 60, label: '56m • Karst Thermocline' },
    { x: 126, y: 106, label: '106m • Deep Funnel Neck' },
    { x: 162, y: 144, label: '144m • Crystalline Vault' },
    { x: 214, y: 168, label: '168m • ROV Magnetometer' },
    { x: 236, y: 172, label: '172m • Deep Conduit Wall' },
  ],

  checkpoints: [
    {
      id: 'cp1',
      name: 'Sapphire Funnel Rim (24m)',
      x: 8,
      y: 24.0,
      radius: 5.4,
      expectedGas: 'EAN32',
      hint: 'Anchor your 355m reel [G] dropping out of the sunlit green-cobalt funnel.',
    },
    {
      id: 'cp2',
      name: 'Cerrado Thermocline (60m)',
      x: 50,
      y: 60.0,
      radius: 4.5,
      expectedGas: 'TMX1455',
      hint: 'Switch to TMX 6/80 [2] and preserve at least 60% gas for the long climb back out.',
    },
    {
      id: 'cp3',
      name: 'Funnel Convergence Neck (106m)',
      x: 126,
      y: 106.0,
      radius: 4.6,
      expectedGas: 'TMX1455',
      hint: 'Twin chimneys converge here — descend smoothly into the deep karst conduit.',
    },
    {
      id: 'cp4',
      name: 'Crystalline Drop Vault (144m)',
      x: 162,
      y: 144.0,
      radius: 4.5,
      expectedGas: 'TMX1455',
      hint: 'Deep overhead — locate and tow the Sunken ROV Magnetometer just ahead at 168m.',
    },
    {
      id: 'cp5',
      name: 'Lagoa Deep Conduit (172m)',
      x: 236,
      y: 172.0,
      radius: 4.4,
      expectedGas: 'TMX1455',
      hint: 'Maximum depth 172m reached! Begin staged decompression back to the Cerrado rim.',
    },
  ],

  collectibles: [
    { id: 'col-1', name: 'Cerrado Travertine Fan', x: -14, y: 34.0, radius: 1.5, points: 480 },
    { id: 'col-2', name: 'Sunlit Sink Algae Vial', x: 52, y: 30.0, radius: 1.5, points: 520 },
    { id: 'col-3', name: 'Dolomite Curtain Prism', x: 90, y: 30.0, radius: 1.5, points: 560 },
    { id: 'col-4', name: 'Bodoquena Phreatic Core', x: 78, y: 54.0, radius: 1.5, points: 540 },
    { id: 'col-5', name: 'Deep Sink Micro-Prawn', x: 106, y: 78.0, radius: 1.5, points: 600 },
    { id: 'col-6', name: 'Limestone Spar Needle', x: 56, y: 112.0, radius: 1.5, points: 620 },
    { id: 'col-7', name: 'Sandstone Breccia Sample', x: 100, y: 134.0, radius: 1.5, points: 680 },
    { id: 'col-8', name: 'Suspended Silt Probe', x: 72, y: 88.0, radius: 1.5, points: 580 },
    { id: 'col-9', name: 'Deep Conduit Dogtooth Spar', x: 168, y: 116.0, radius: 1.5, points: 720 },
    { id: 'col-10', name: 'Abyssal Acoustic Node', x: 198, y: 134.0, radius: 1.5, points: 760 },
    { id: 'col-11', name: 'Magnetometer Calibration Cell', x: 214, y: 168.0, radius: 1.6, points: 860 },
    { id: 'col-12', name: '172m Cerrado Aragonite', x: 236, y: 172.0, radius: 1.6, points: 980 },
    { id: 'col-13', name: 'Funnel Thermocline Tag', x: 98, y: 108.0, radius: 1.5, points: 640 },
    { id: 'col-14', name: 'Phreatic Conduit Compass', x: 194, y: 162.0, radius: 1.5, points: 780 },
  ],
};
