import { createLevelTheme } from './themes.js';

/**
 * Level 26 (Tier II · Glowing H2S Cloud River Sinkhole): Cenote Angelita, Tulum, Mexico
 * World-famous 58m karst bell sinkhole featuring a surreal 30m Hydrogen Sulfide (H2S)
 * cloud river hovering over sunken jungle tree branches, separating sunlit freshwater
 * above from pitch-clear saltwater caverns below.
 */
export const LEVEL_26 = {
  id: 'cenote-angelita-river',
  name: 'Cenote Angelita H2S River',
  subtitle: 'Tulum, Mexico • 58m Hydrogen Sulfide Cloud River & Sunken Forest',
  difficultyRank: 11,
  tier: 2,
  badge: 'H2S River 58m',
  description:
    'Drop through sunlit jungle water into Tulum\'s legendary Cenote Angelita. Glide over the eerie glowing 30m Hydrogen Sulfide cloud river draped around sunken mahogany trunks, plunge through the misty layer on TMX 14/55 into crystal-clear 58m saltwater limestone overhangs, and ascend cleanly to your 6m O2 deco stop.',
  bounds: {
    xMin: -34,
    xMax: 300,
    yMin: -6,
    yMax: 76,
  },
  roughness: 0.28,
  spawn: { x: 14, y: 2.0 },
  exitZone: {
    x: 102,
    y: 1.8,
    radius: 6.4,
    name: 'Angelita Jungle Skylight',
  },
  haloclineY: 30.0,
  h2sCloudLayer: {
    y: 30.0,
    thickness: 3.8,
    xMin: -12,
    xMax: 118,
    color: '#a3e635',
    trees: [
      { x: 24, y: 31.8, h: 6.5, lean: -0.22 },
      { x: 38, y: 32.4, h: 7.4, lean: 0.18 },
      { x: 52, y: 32.0, h: 6.0, lean: -0.14 },
      { x: 92, y: 31.6, h: 5.2, lean: 0.25 },
    ],
  },
  parTimeSec: 285,
  lined: true,
  reelMetersPerDiver: 0,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 22.0,
  theme: createLevelTheme('yucatan-cenote'),

  openBasins: [
    { kind: 'entry', xMin: 6, xMax: 22, rimHalf: 6.2, flareAdd: 2.6, lipTilt: 0.25, floorY: 2.6, sunAngle: 1.48 },
    { kind: 'exit', xMin: 94, xMax: 110, rimHalf: 5.6, flareAdd: 2.4, lipTilt: -0.25, floorY: 2.6, sunAngle: 1.62 },
  ],

  surgeZones: [
    { id: 'ang_h2s_drift', x: 40, y: 30.8, radius: 4.5, vx: 1.6, vy: 0.3, periodSec: 9.4, phase: 0.5, label: 'H2S Cloud-River Drift' },
  ],

  segments: [
    // Sunlit Vertical Sinkhole Bell Shaft (0m -> 30m H2S Cloud River)
    { ax: 14, ay: 1.0, bx: 14, by: 18.0, ra: 6.6, rb: 6.2 },
    { ax: 14, ay: 18.0, bx: 22, by: 30.0, ra: 6.2, rb: 6.8 },
    // Sunken Forest & Glowing H2S Cloud River Terrace (30m)
    { ax: 22, ay: 30.0, bx: 58, by: 31.5, ra: 6.8, rb: 6.2 },
    // Plunge Through H2S Cloud into Pitch-Clear Saltwater Abyss (31.5m -> 57m)
    { ax: 58, ay: 31.5, bx: 70, by: 45.0, ra: 4.8, rb: 4.4 },
    { ax: 70, ay: 45.0, bx: 52, by: 57.0, ra: 4.4, rb: 5.0 },
    // Deep Saltwater Overhang Gallery (57m -> 55m) + West Relic Grotto
    { ax: 52, ay: 57.0, bx: 24, by: 55.0, ra: 4.6, rb: 4.2 },
    { ax: 24, ay: 55.0, bx: 4, by: 56.5, ra: 3.4, rb: 3.4 },
    // East Ascent Chimney Returning Up Through H2S Cloud -> 6m Deco Shelf
    { ax: 52, ay: 57.0, bx: 88, by: 48.0, ra: 4.2, rb: 4.0 },
    { ax: 88, ay: 48.0, bx: 96, by: 30.0, ra: 4.0, rb: 4.4 },
    { ax: 96, ay: 30.0, bx: 102, by: 18.0, ra: 4.4, rb: 4.4 },
    { ax: 102, ay: 18.0, bx: 102, by: 6.2, ra: 4.4, rb: 5.0 },
    { ax: 102, ay: 6.2, bx: 102, by: 0.8, ra: 5.4, rb: 5.6 },
    // Hidden East Sub-Cloud Cenote Tunnel -> Crimson Piranha Trio Secret Lair (v268)
    { ax: 88, ay: 48.0, bx: 120, by: 48.0, ra: 3.6, rb: 3.4, secretLair: true },
    { ax: 120, ay: 48.0, bx: 156, by: 50.0, ra: 3.4, rb: 3.8, secretLair: true },
    { ax: 156, ay: 50.0, bx: 184, by: 50.0, ra: 4.6, rb: 4.8, secretLair: true },
    { ax: 184, ay: 50.0, bx: 214, by: 50.0, ra: 4.2, rb: 4.4, secretLair: true },
    { ax: 214, ay: 50.0, bx: 230, by: 50.0, ra: 4.6, rb: 10.5, secretLair: true },
    { ax: 230, ay: 50.0, bx: 270, by: 50.0, ra: 14.0, rb: 14.0, secretLair: true },
  ],

  guideline: [
    { x: 14, y: 2.5 },
    { x: 14, y: 18.0 },
    { x: 22, y: 30.0 },
    { x: 58, y: 31.5 },
    { x: 70, y: 45.0 },
    { x: 52, y: 57.0 },
    { x: 88, y: 48.0 },
    { x: 96, y: 30.0 },
    { x: 102, y: 18.0 },
    { x: 102, y: 6.2 },
    { x: 102, y: 2.0 },
  ],

  checkpoints: [
    {
      id: 'cp1',
      name: 'Sunlit Bell Rim (18m)',
      x: 14,
      y: 18.0,
      radius: 4.8,
      hint: 'Descend on EAN32 toward the glowing 30m Hydrogen Sulfide cloud river.',
    },
    {
      id: 'cp2',
      name: 'Sunken Forest Cloud Terrace (30m)',
      x: 40,
      y: 30.8,
      radius: 5.2,
      hint: 'Switch to TMX 14/55 [2] before plunging through the golden H2S mist layer!',
    },
    {
      id: 'cp3',
      name: 'Sub-Cloud Saltwater Drop (45m)',
      x: 70,
      y: 45.0,
      radius: 4.4,
      expectedGas: 'TMX1455',
      hint: 'Crystal-clear saltwater below the mist — stay calm on Trimix.',
    },
    {
      id: 'cp4',
      name: '57m Abyssal Overhang Turnaround',
      x: 52,
      y: 57.0,
      radius: 5.0,
      expectedGas: 'TMX1455',
      hint: 'Turnaround reached! Explore the west overhang grotto or ascend the east chimney.',
    },
    {
      id: 'cp5',
      name: 'East Chimney Gas Switch (22m)',
      x: 99,
      y: 22.0,
      radius: 4.6,
      expectedGas: 'EAN32',
      hint: 'Above the H2S river — switch back to EAN32 [1] for a calm ascent.',
    },
    {
      id: 'cp6',
      name: '6m Jungle Skylight Deco Shelf',
      x: 102,
      y: 6.2,
      radius: 5.5,
      expectedGas: 'O2',
      hint: 'Hold 6m on O2 100% [3] until decompression clears, then surface!',
    },
  ],

  collectibles: [
    { id: 'ang_c1', name: 'Submerged Mahogany Amber', x: 32, y: 29.5, kind: 'fossil', points: 240, scale: 1.05 },
    { id: 'ang_c2', name: 'Sulfur-Rim Calcite Cluster', x: 54, y: 31.0, kind: 'crystal', points: 290, scale: 1.15 },
    { id: 'ang_c3', name: 'Mayan Jade Offering Bead', x: 66, y: 45.5, kind: 'relic', points: 360, scale: 1.25 },
    { id: 'ang_c4', name: 'Deep Saltwater Stalactite Core', x: 30, y: 55.2, kind: 'crystal', points: 460, scale: 1.38 },
    { id: 'ang_c5', name: 'Sunken Obsidian Mirror Shard', x: 6, y: 56.5, kind: 'relic', points: 680, scale: 1.6 },
    { id: 'ang_c6', name: 'East Chimney Survey Compass', x: 94, y: 31.0, kind: 'compass', points: 310, scale: 1.12 },
  ],

  zoneLines: [
    { id: 'ang-h2s', xMin: 8, xMax: 66, y: 30.0, title: '30m H2S CLOUD RIVER · SWITCH TMX 14/55 [2]', color: '#a3e635' },
    { id: 'ang-ean', xMin: 90, xMax: 112, y: 22.0, title: 'ASCENT SWITCH -> EAN32 [1] (22m)', color: '#38bdf8' },
    { id: 'ang-deco', xMin: 94, xMax: 110, y: 6.2, title: '6m DECO SHELF · O2 100% [3]', color: '#4ade80' },
  ],

  depthMarkers: [
    { x: 102, y: 6.2, label: '6m • O2 DECO', color: '#4ade80' },
    { x: 40, y: 30.0, label: '30m • H2S CLOUD RIVER', color: '#a3e635' },
    { x: 52, y: 57.0, label: '57m • SALTWATER OVERHANG', color: '#38bdf8' },
  ],
};
