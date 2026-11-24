import { createLevelTheme } from './themes.js';

/**
 * Level 24 (Tier I · Sunlit Megalithic Road & Blue-Hole Fault): Bimini Road Submerged Megaliths, Bahamas
 * Sunlit turquoise Bahamian limestone pavement & stepped megalithic archways descending into a
 * 38m secret carbonate fault cavern with glowing halocline, Gulf Stream drift & ancient relics.
 */
export const LEVEL_24 = {
  id: 'bimini-road-megalith',
  name: 'Bimini Road Submerged Megaliths',
  subtitle: 'North Bimini, Bahamas • 38m Sunlit Megalithic Arch & Fault Cavern',
  difficultyRank: 3,
  tier: 1,
  badge: 'Megalith 38m',
  description:
    'Glide over the sunlit stepped sandstone megaliths of Bimini Road bathed in dancing caustics, ride warm Gulf Stream cross-currents through twin sea-arches, and plunge into the 38m Bahamas Bank fault cavern to map ancient carved keystones before clearing a serene 6m turquoise deco stop.',
  bounds: {
    xMin: -32,
    xMax: 352,
    yMin: -6,
    yMax: 56,
  },
  roughness: 0.24,
  spawn: { x: 12, y: 2.0 },
  exitZone: {
    x: 172,
    y: 1.8,
    radius: 6.8,
    name: 'Bimini Lagoon Skylight',
  },
  haloclineY: 22.0,
  parTimeSec: 245,
  lined: true,
  reelMetersPerDiver: 0,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 18.0,
  theme: createLevelTheme('abaco-crystal'),

  archWindows: [
    { x: 46, y: 12.5, radiusX: 11.5, radiusY: 5.5 },
    { x: 148, y: 14.0, radiusX: 10.5, radiusY: 5.2 },
  ],

  surgeZones: [
    { id: 'bim_surge1', x: 46, y: 13.0, radius: 4.5, vx: 2.1, vy: 0.4, periodSec: 8.0, phase: 0.2, label: 'Gulf Stream Arch Current' },
    { id: 'bim_surge2', x: 126, y: 38.0, radius: 4.2, vx: -1.8, vy: 0.5, periodSec: 9.2, phase: 1.4, label: 'Carbonate Fault Tidal Surge' },
  ],

  openBasins: [
    { kind: 'entry', xMin: 4, xMax: 22, rimHalf: 6.0, flareAdd: 2.6, lipTilt: 0.35, floorY: 2.6, sunAngle: 1.44 },
    { kind: 'exit', xMin: 164, xMax: 180, rimHalf: 5.4, flareAdd: 2.5, lipTilt: -0.35, floorY: 2.6, sunAngle: 1.66 },
  ],

  segments: [
    // Sunlit Entry Basin & Stepped Megalithic Terrace I
    { ax: 12, ay: 1.0, bx: 12, by: 9.0, ra: 7.4, rb: 6.0 },
    { ax: 12, ay: 9.0, bx: 34, by: 11.5, ra: 5.5, rb: 4.6 },
    // Great Megalithic Sea-Arch (sunlit window at x=46)
    { ax: 34, ay: 11.5, bx: 60, by: 14.5, ra: 4.6, rb: 4.4 },
    // Stepped Drop into Bahamas Bank Fault Cavern (14.5m -> 26m)
    { ax: 60, ay: 14.5, bx: 80, by: 25.0, ra: 4.0, rb: 3.6 },
    // Side Treasure Terrace (Ancient Carved Keystone Alcove)
    { ax: 80, ay: 25.0, bx: 72, by: 34.5, ra: 3.0, rb: 3.1 },
    // Megalithic Pillar Corridor (25m -> 34m)
    { ax: 80, ay: 25.0, bx: 102, by: 34.0, ra: 3.6, rb: 2.6 },
    // Deep Carbonate Fault Sanctuary (38m turnaround)
    { ax: 102, ay: 34.0, bx: 126, by: 38.0, ra: 3.2, rb: 4.5 },
    { ax: 126, ay: 38.0, bx: 146, by: 35.5, ra: 4.5, rb: 3.8 },
    // Eastern Ascent Shaft & Twin Sea-Arch II
    { ax: 146, ay: 35.5, bx: 152, by: 20.0, ra: 3.6, rb: 3.8 },
    { ax: 152, ay: 20.0, bx: 148, by: 13.0, ra: 3.8, rb: 4.0 },
    // 6m Turquoise Deco Shelf -> Lagoon Exit
    { ax: 148, ay: 13.0, bx: 158, by: 6.6, ra: 3.8, rb: 4.2 },
    { ax: 158, ay: 6.6, bx: 172, by: 6.4, ra: 4.2, rb: 5.4 },
    { ax: 172, ay: 6.4, bx: 172, by: 0.6, ra: 5.8, rb: 5.4 },

    // === UNCHARTED ORICHALCUM SANCTUM (100% Hidden Secret Lair branching east from Fault Sanctuary) ===
    { ax: 146, ay: 35.5, bx: 162, by: 36.5, ra: 2.5, rb: 3.2, secretLair: true },
    { ax: 162, ay: 36.5, bx: 204, by: 36.5, ra: 3.2, rb: 3.0, secretLair: true },
    { ax: 204, ay: 36.5, bx: 248, by: 36.5, ra: 3.0, rb: 3.4, secretLair: true },
    { ax: 248, ay: 36.5, bx: 264, by: 36.0, ra: 3.4, rb: 5.5, secretLair: true },
    { ax: 266, ay: 36.0, bx: 306, by: 36.0, ra: 11.2, rb: 11.2, secretLair: true },
    { ax: 274, ay: 29.5, bx: 298, by: 29.5, ra: 6.4, rb: 6.4, secretLair: true },
    { ax: 274, ay: 42.5, bx: 298, by: 42.5, ra: 6.4, rb: 6.4, secretLair: true },
  ],

  guideline: [
    { x: 12, y: 3.2 },
    { x: 12, y: 9.0 },
    { x: 34, y: 11.5 },
    { x: 60, y: 14.5 },
    { x: 80, y: 25.0 },
    { x: 102, y: 34.0 },
    { x: 126, y: 38.0 },
    { x: 146, y: 35.5 },
    { x: 152, y: 20.0 },
    { x: 148, y: 13.0 },
    { x: 158, y: 6.6 },
    { x: 172, y: 6.4 },
    { x: 172, y: 2.0 },
  ],

  checkpoints: [
    {
      id: 'cp1',
      name: 'Megalithic Archway',
      x: 46,
      y: 13.0,
      radius: 4.2,
      hint: 'Enjoy sunlit caustics on EAN32 along the stepped Bimini stones.',
    },
    {
      id: 'cp2',
      name: 'Halocline Terrace',
      x: 80,
      y: 25.0,
      radius: 3.8,
      hint: 'Entering the carbonate fault — switch to TMX 14/55 below 30m!',
    },
    {
      id: 'cp3',
      name: 'Monolith Squeeze',
      x: 102,
      y: 34.0,
      radius: 3.2,
      hint: 'Hold smooth trim between the limestone pillars.',
    },
    {
      id: 'cp4',
      name: 'Fault Sanctuary (38m)',
      x: 126,
      y: 38.0,
      radius: 4.5,
      expectedGas: 'TMX1455',
      hint: 'Turnaround reached! Ascend cleanly up the eastern coral shaft.',
    },
    {
      id: 'cp5',
      name: 'East Arch Switch (18m)',
      x: 150,
      y: 18.0,
      radius: 4.0,
      expectedGas: 'EAN32',
      hint: 'Switch back to EAN32 for your sunlit ascent.',
    },
    {
      id: 'cp6',
      name: 'Turquoise Deco Shelf (6m)',
      x: 165,
      y: 6.5,
      radius: 5.5,
      expectedGas: 'O2',
      hint: 'Hold 6m on O2 100% until deco clears, then surface!',
    },
  ],

  collectibles: [
    { id: 'bim-1', kind: 'artifact', name: 'Stepped Road Keystone', x: 34, y: 11.5, points: 180 },
    { id: 'bim-2', kind: 'fossil', name: 'Ancient Coral Monolith', x: 72, y: 34.5, points: 280 },
    { id: 'bim-3', kind: 'crystal', name: 'Bimini Aragonite Shard', x: 114, y: 36.2, points: 240 },
    { id: 'bim-4', kind: 'artifact', name: 'Sunken Compass Rose', x: 138, y: 36.5, points: 300 },
    { id: 'bim-5', kind: 'crystal', name: 'Sunlit Sea-Arch Pearl', x: 150, y: 13.5, points: 220 },
    { id: 'bim-6', kind: 'fossil', name: 'Bahamas Star Coral', x: 162, y: 6.5, points: 190 },
  ],

  zoneLines: [
    { id: 'bim-halo', xMin: 68, xMax: 94, y: 22.0, title: 'HALOCLINE', subtitle: 'Switch to TMX below 30m' },
    { id: 'bim-deco', xMin: 154, xMax: 178, y: 6.5, title: '6m DECO SHELF', subtitle: 'Hold on O2 100%' },
  ],

  depthMarkers: [
    { y: 6, label: '6m O2 DECO', color: '#4ade80' },
    { y: 22, label: '22m HALOCLINE', color: '#38bdf8' },
    { y: 38, label: '38m FAULT FLOOR', color: '#f59e0b' },
  ],
};
