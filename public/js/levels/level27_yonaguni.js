import { createLevelTheme } from './themes.js';

/**
 * Level 27 (Tier II · Pacific Stepped Megaliths & Kuroshio Currents): Yonaguni Monument, Okinawa, Japan
 * World-famous 52m submerged sandstone terraces, monolith arches, sweeping Kuroshio pelagic currents,
 * hammerhead reef waters, and a hidden eastern coral sanctum accessible only by active sonar.
 */
export const LEVEL_27 = {
  id: 'yonaguni-submerged-monument',
  name: 'Yonaguni Submerged Monument',
  subtitle: 'Okinawa, Japan • 52m Stepped Megalith Terraces & Kuroshio Drift',
  difficultyRank: 13,
  tier: 2,
  badge: 'Monolith 52m',
  description:
    'Descend into the surging Kuroshio currents off Japan’s westernmost island to explore Yonaguni’s monumental stepped underwater terraces. Thread sunlit megalithic archways on EAN32, switch to TMX 14/55 along the 52m Dragon Stairway drop-off, and drift back up to the sunlit coral plateau for your 6m O2 stop.',
  bounds: {
    xMin: -30,
    xMax: 315,
    yMin: -6,
    yMax: 72,
  },
  roughness: 0.24,
  spawn: { x: 14, y: 2.0 },
  exitZone: {
    x: 112,
    y: 1.8,
    radius: 6.6,
    name: 'Yonaguni Coral Plateau Boat Mooring',
  },
  haloclineY: 26.0,
  parTimeSec: 295,
  lined: true,
  reelMetersPerDiver: 0,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 22.0,
  theme: createLevelTheme('bermuda-sargasso'),

  openBasins: [
    { kind: 'entry', xMin: 4, xMax: 24, rimHalf: 6.4, flareAdd: 2.6, lipTilt: 0.22, floorY: 2.8, sunAngle: 1.46 },
    { kind: 'exit', xMin: 102, xMax: 122, rimHalf: 6.0, flareAdd: 2.4, lipTilt: -0.22, floorY: 2.8, sunAngle: 1.62 },
  ],

  archWindows: [
    { x: 34, y: 22.0, rx: 4.5, ry: 3.4, glow: '#38bdf8' },
    { x: 64, y: 31.0, rx: 5.0, ry: 3.8, glow: '#2dd4bf' },
    { x: 96, y: 26.0, rx: 4.4, ry: 3.2, glow: '#7dd3fc' },
  ],

  caveCurrents: [
    { id: 'yon_kuroshio_1', x: 46, y: 27.0, radius: 5.2, vx: 1.85, vy: 0.2, label: 'Kuroshio Terrace Sweep' },
  ],

  surgeZones: [
    { id: 'yon_surge_1', x: 78, y: 44.0, radius: 4.8, vx: 1.7, vy: 0.5, periodSec: 9.0, phase: 0.6, label: 'Twin Pillar Pacific Surge' },
  ],

  segments: [
    // Sunlit Entry Drop onto Upper Sandstone Terrace (0m -> 22m)
    { ax: 14, ay: 1.0, bx: 14, by: 16.0, ra: 6.6, rb: 6.0 },
    { ax: 14, ay: 16.0, bx: 34, by: 22.0, ra: 6.0, rb: 5.6 },
    // Monumental Stepped Terrace & Twin Megalith Archway (22m -> 31m)
    { ax: 34, ay: 22.0, bx: 64, by: 31.0, ra: 5.6, rb: 5.4 },
    // Plunge Down the Carved Dragon Stairway (31m -> 52m)
    { ax: 64, ay: 31.0, bx: 80, by: 46.0, ra: 5.0, rb: 4.8 },
    { ax: 80, ay: 46.0, bx: 112, by: 52.0, ra: 4.8, rb: 5.4 },
    // Deep West Carved Alcove (optional relic chamber at 52m)
    { ax: 80, ay: 46.0, bx: 50, by: 51.0, ra: 4.0, rb: 3.6 },
    // East Ascent Corridor through Sunlit Monolith Gate -> 6m O2 Deco Shelf
    { ax: 112, ay: 52.0, bx: 108, by: 34.0, ra: 4.6, rb: 4.6 },
    { ax: 108, ay: 34.0, bx: 112, by: 20.0, ra: 4.6, rb: 4.8 },
    { ax: 112, ay: 20.0, bx: 112, by: 6.2, ra: 4.8, rb: 5.4 },
    { ax: 112, ay: 6.2, bx: 112, by: 0.8, ra: 5.6, rb: 5.8 },

    // SECRET SONAR-ONLY CORAL DRAGON SANCTUM (100% hidden until Sonar breaches false monolith veil at x=122, y=52!)
    { ax: 114, ay: 52.0, bx: 146, by: 52.0, ra: 2.3, rb: 3.8, secretLair: true },
    { ax: 146, ay: 52.0, bx: 170, by: 52.0, ra: 5.4, rb: 4.4, secretLair: true }, // Armory chamber (x=156, y=52)
    { ax: 170, ay: 52.0, bx: 244, by: 51.0, ra: 4.5, rb: 4.8, secretLair: true }, // Gauntlet corridor
    { ax: 244, ay: 51.0, bx: 274, by: 50.0, ra: 14.5, rb: 15.5, secretLair: true }, // Massive Coral Dragon Sanctum Arena
    { ax: 274, ay: 50.0, bx: 298, by: 50.0, ra: 15.5, rb: 13.0, secretLair: true },
  ],

  guideline: [
    { x: 14, y: 2.4 },
    { x: 14, y: 16.0 },
    { x: 34, y: 22.0 },
    { x: 64, y: 31.0 },
    { x: 80, y: 46.0 },
    { x: 112, y: 52.0 },
    { x: 108, y: 34.0 },
    { x: 112, y: 20.0 },
    { x: 112, y: 6.2 },
    { x: 112, y: 2.0 },
  ],

  checkpoints: [
    { id: 'cp1', name: 'Upper Terrace Arch (22m)', x: 34, y: 22.0, radius: 5.0, hint: 'Switch to TMX 14/55 [2] before descending the deep stepped terraces.' },
    { id: 'cp2', name: 'Kuroshio Monolith Gate (31m)', x: 64, y: 31.0, radius: 5.0, expectedGas: 'TMX1455', hint: 'Ride the Pacific sweep smoothly toward the carved stairway.' },
    { id: 'cp3', name: 'Dragon Stairway Drop (46m)', x: 80, y: 46.0, radius: 4.8, expectedGas: 'TMX1455', hint: 'Check the west relic alcove or push east to the 52m monolith floor.' },
    { id: 'cp4', name: '52m Megalith Floor Turnaround', x: 112, y: 52.0, radius: 5.2, expectedGas: 'TMX1455', hint: 'Turnaround reached! Ascend the sunlit eastern monolith chimney.' },
    { id: 'cp5', name: '20m Coral Plateau Switch', x: 112, y: 20.0, radius: 5.4, hint: 'Switch back to EAN32 [1] for a controlled ascent.' },
    { id: 'cp6', name: '6m Reef O2 Deco Stop', x: 112, y: 6.2, radius: 5.8, hint: 'Switch to O2 100% [3] to clear decompression beneath the boat.' },
  ],

  collectibles: [
    { id: 'yon_c1', name: 'Carved Sandstone Terraced Tablet', x: 34, y: 23.6, kind: 'relic', points: 240, scale: 1.1 },
    { id: 'yon_c2', name: 'Kuroshio Drift Brass Compass', x: 64, y: 32.5, kind: 'compass', points: 320, scale: 1.2 },
    { id: 'yon_c3', name: 'Ryukyu Jade Offering Bead', x: 54, y: 50.8, kind: 'gem', points: 460, scale: 1.35 },
    { id: 'yon_c4', name: 'Ancient Stone Turtle Relief', x: 82, y: 46.8, kind: 'relic', points: 380, scale: 1.28 },
    { id: 'yon_c5', name: 'Megalith Plumb-Bob Weight', x: 112, y: 53.2, kind: 'gear', points: 510, scale: 1.42 },
    { id: 'yon_c6', name: 'Pacific Star-Chart Medallion', x: 108, y: 34.2, kind: 'relic', points: 420, scale: 1.3 },
  ],

  zoneLines: [
    { id: 'yon-tmx', title: '22m TERRACE · SWITCH TO TMX 14/55 [2]', xMin: 20, xMax: 100, y: 22.0, color: '#c084fc' },
    { id: 'yon-floor', title: '52m MEGALITH FLOOR', xMin: 46, xMax: 120, y: 52.0, color: '#38bdf8' },
  ],
};
