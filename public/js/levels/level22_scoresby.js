import { createLevelTheme } from './themes.js';

/**
 * Level 22 (Campaign Rank 8 · Tier III): Scoresby Sund Iceberg Cathedral (East Greenland)
 * Dive straight through the submerged sapphire arches and meltwater vaults of a colossal
 * grounded Greenland tabular iceberg descending into an 82m sub-arctic fjord trench.
 * - 3 luminous translucent blue-ice archWindows streaming Arctic sunlight into the cavern
 * - Bioluminescent deep fjord trench & pulsing Arctic tidal swells
 * - Lined Tier III mixed-gas expedition bridging Fontaine (74m) and Boesmansgat (96m)
 */
export const LEVEL_22 = {
  id: 'scoresby-sund-iceberg',
  name: 'Scoresby Sund Iceberg Cathedral',
  subtitle: 'East Greenland • 82m Grounded Tabular Iceberg & Sapphire Arches',
  difficultyRank: 8,
  tier: 3,
  badge: 'Iceberg 82m',
  description:
    'Slip beneath the pack ice of East Greenland into a colossal grounded tabular iceberg. Thread three glowing sapphire ice-arch skylights, battle pulsing Arctic fjord swells, and plunge beneath the 82m glacial keel before ascending the eastern ice chimney.',
  bounds: {
    xMin: -36,
    xMax: 434,
    yMin: -6,
    yMax: 96,
  },
  roughness: 0.32,
  spawn: { x: 14, y: 2.0 },
  haloclineY: 28.0,
  parTimeSec: 380,
  lined: true,
  reelMetersPerDiver: 0,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 22.0,
  theme: createLevelTheme('greenland-iceberg'),

  archWindows: [
    // Sunlight pouring straight through translucent sapphire glacial ice arches!
    { x: 66, y: 24.0, radiusX: 14.5, radiusY: 8.5 },
    { x: 148, y: 48.0, radiusX: 16.5, radiusY: 9.5 },
    { x: 222, y: 66.0, radiusX: 15.0, radiusY: 8.5 },
  ],

  openBasins: [
    { kind: 'entry', xMin: 6, xMax: 22, rimHalf: 5.8, flareAdd: 2.6, lipTilt: 0.22, floorY: 2.8, sunAngle: 1.5 },
    { kind: 'exit', xMin: 282, xMax: 298, rimHalf: 5.2, flareAdd: 2.4, lipTilt: -0.22, floorY: 2.6, sunAngle: 1.62 },
  ],

  segments: [
    // === PACK-ICE LEAD ENTRY -> SAPPHIRE ARCH I (24m) ===
    { ax: 14, ay: 1.0, bx: 18, by: 16.0, ra: 5.4, rb: 4.4 },
    { ax: 18, ay: 16.0, bx: 44, by: 24.0, ra: 4.2, rb: 4.0 },
    { ax: 44, ay: 24.0, bx: 88, by: 24.0, ra: 4.2, rb: 4.4 },

    // === MELTWATER CASCADE -> CATHEDRAL ICE-BRIDGE ARCH II (48m) ===
    { ax: 88, ay: 24.0, bx: 118, by: 46.0, ra: 3.6, rb: 3.8 },
    { ax: 118, ay: 46.0, bx: 174, by: 50.0, ra: 4.4, rb: 4.6 },
    // High Upper Glacial Gallery alternate route
    { ax: 88, ay: 24.0, bx: 132, by: 28.0, ra: 2.5, rb: 2.3 },
    { ax: 132, ay: 28.0, bx: 174, by: 50.0, ra: 2.3, rb: 3.4 },

    // === SUB-KEEL ABYSSAL TRENCH (82m TURNAROUND) ===
    { ax: 174, ay: 50.0, bx: 196, by: 72.0, ra: 3.6, rb: 3.4 },
    { ax: 196, ay: 72.0, bx: 218, by: 82.0, ra: 3.4, rb: 4.2 },
    { ax: 218, ay: 82.0, bx: 244, by: 66.0, ra: 3.8, rb: 3.6 },
    // Direct Sapphire Rift Arch III shortcut (50m -> 66m)
    { ax: 174, ay: 50.0, bx: 222, by: 66.0, ra: 3.2, rb: 3.8 },
    { ax: 222, ay: 66.0, bx: 244, by: 66.0, ra: 3.8, rb: 3.6 },

    // === EAST ICE-CHIMNEY ASCENT (66m -> 22m -> 6m -> EXIT) ===
    { ax: 244, ay: 66.0, bx: 266, by: 42.0, ra: 3.2, rb: 2.8 },
    { ax: 266, ay: 42.0, bx: 276, by: 22.0, ra: 2.8, rb: 3.5 },
    { ax: 276, ay: 22.0, bx: 290, by: 10.0, ra: 3.4, rb: 4.0 },
    { ax: 290, ay: 10.0, bx: 290, by: 1.0, ra: 4.4, rb: 4.8 },

    // === 5 EXPLORATION ICE GROTTOS & DEAD ENDS ===
    // Dead End 1: West Pack-Ice Pocket
    { ax: 18, ay: 16.0, bx: -12, by: 22.0, ra: 2.4, rb: 2.8 },
    // Dead End 2: Frozen Crevasse Loft above Arch I
    { ax: 66, ay: 24.0, bx: 68, by: 10.0, ra: 2.2, rb: 2.6 },
    // Dead End 3: Under-Bridge Blue Vault (64m)
    { ax: 118, ay: 46.0, bx: 102, by: 64.0, ra: 2.4, rb: 2.9 },
    // Dead End 4: Deepest 84m Fjord Moraine Crypt
    { ax: 218, ay: 82.0, bx: 250, by: 84.0, ra: 2.6, rb: 3.0 },
    // Dead End 5: Upper Ice-Shelf Dome near East Exit
    { ax: 266, ay: 42.0, bx: 296, by: 36.0, ra: 2.3, rb: 2.8 },

    // === Secret Sonar-Only Glacial Fissure -> Borealis Wyrm Cathedral (v189) ===
    // Sealed behind the deepest 84m Fjord Moraine Crypt at (250, 84.0)
    { ax: 250.0, ay: 84.0, bx: 260.0, by: 83.2, ra: 1.5, rb: 1.9, secretLair: true },
    // Quiet Armory Ice-Alcove
    { ax: 260.0, ay: 83.2, bx: 274.0, by: 81.5, ra: 2.5, rb: 3.6, secretLair: true },
    // Glacial Corridor Gauntlet
    { ax: 274.0, ay: 81.5, bx: 296.0, by: 79.0, ra: 3.6, rb: 3.8, secretLair: true },
    { ax: 296.0, ay: 79.0, bx: 318.0, by: 75.5, ra: 3.9, rb: 4.3, secretLair: true },
    { ax: 318.0, ay: 75.5, bx: 340.0, by: 73.5, ra: 4.1, rb: 4.5, secretLair: true },
    { ax: 340.0, ay: 73.5, bx: 364.0, by: 72.0, ra: 4.6, rb: 8.2, secretLair: true },
    // BOREALIS FROST CATHEDRAL — 58m × 26m Boss Arena centered at (392, 72)
    { ax: 364.0, ay: 72.0, bx: 382.0, by: 72.0, ra: 9.6, rb: 13.0, secretLair: true },
    { ax: 382.0, ay: 72.0, bx: 402.0, by: 72.0, ra: 13.0, rb: 13.0, secretLair: true },
    { ax: 402.0, ay: 72.0, bx: 416.5, by: 72.0, ra: 11.8, rb: 8.6, secretLair: true },
  ],

  guideline: [
    { x: 14, y: 2.0 },
    { x: 18, y: 16.0 },
    { x: 44, y: 24.0 },
    { x: 88, y: 24.0 },
    { x: 118, y: 46.0 },
    { x: 174, y: 50.0 },
    { x: 196, y: 72.0 },
    { x: 218, y: 82.0 },
    { x: 244, y: 66.0 },
    { x: 266, y: 42.0 },
    { x: 276, y: 22.0 },
    { x: 290, y: 10.0 },
    { x: 290, y: 5.8 },
  ],

  checkpoints: [
    { id: 'cp1', name: 'Sapphire Ice Arch I (24m)', x: 66, y: 24.0, radius: 5.0, hint: 'Glide through the glowing blue-ice arch — prep TMX 14/55 [2] past 28m!' },
    { id: 'cp2', name: 'Cathedral Ice-Bridge (48m)', x: 148, y: 48.0, radius: 5.0, hint: 'Breathe TMX 14/55 [2]! Plunge below the iceberg keel toward the 82m fjord floor.' },
    { id: 'cp3', name: 'Sub-Keel Drop-Off (72m)', x: 196, y: 72.0, radius: 4.5, hint: 'Watch the Arctic surge swells along the ice keel as you drop to 82m.' },
    { id: 'cp4', name: '82m Fjord Keel Abyss', x: 218, y: 82.0, radius: 4.8, hint: 'Maximum depth 82m reached! Ascend through Sapphire Rift Arch III.' },
    { id: 'cp5', name: 'East Ice-Chimney Switch (22m)', x: 276, y: 22.0, radius: 4.5, hint: 'Switch back to EAN32 [1] at 22m and climb gently into the sunlit exit lead.' },
    { id: 'cp6', name: '6m Glacial Deco Shelf', x: 290, y: 6.0, radius: 5.8, hint: 'Switch to O2 100% [3] and clear decompression before surfacing.' },
  ],

  collectibles: [
    { id: 'sco_c1', name: 'Frozen Air-Bubble Ice Core', x: -10, y: 22.0, kind: 'crystal', points: 420, scale: 1.35 },
    { id: 'sco_c2', name: 'Sapphire Arch Prism', x: 68, y: 10.5, kind: 'crystal', points: 460, scale: 1.4 },
    { id: 'sco_c3', name: 'Glacial Meltwater Compass', x: 132, y: 28.0, kind: 'compass', points: 320, scale: 1.05 },
    { id: 'sco_c4', name: '1899 Arctic Brass Sextant', x: 103, y: 63.5, kind: 'relic', points: 680, scale: 1.6 },
    { id: 'sco_c5', name: 'Cathedral Blue-Ice Pearl', x: 174, y: 50.0, kind: 'pearl', points: 340, scale: 1.1 },
    { id: 'sco_c6', name: 'Sub-Keel Drift Beacon', x: 222, y: 66.0, kind: 'beacon', points: 380, scale: 1.15 },
    { id: 'sco_c7', name: 'Narwhal Ivory Tusk Relic', x: 248, y: 83.5, kind: 'fossil', points: 860, scale: 1.75 },
    { id: 'sco_c8', name: 'Scoresby Greenland Meteorite', x: 294, y: 36.5, kind: 'crystal', points: 640, scale: 1.55 },
    { id: 'sco_c9', name: 'Fjord Floor Quartz Cluster', x: 218, y: 82.0, kind: 'crystal', points: 400, scale: 1.2 },
  ],

  zoneLines: [
    { id: 'zone-tmx', title: 'SWITCH TO TMX 14/55 AT 30m (MOD 33.7m)', xMin: 82, xMax: 122, y: 33.7, color: '#c084fc' },
    { id: 'zone-ean32-up', title: 'ASCENT SWITCH -> EAN32 (22m)', xMin: 266, xMax: 288, y: 22.0, color: '#38bdf8' },
    { id: 'zone-deco', title: '6m DECO LINE · SWITCH TO O2 100%', xMin: 282, xMax: 298, y: 6.0, color: '#4ade80' },
  ],

  depthMarkers: [
    { x: 66, y: 24, label: '24m • SAPPHIRE ARCH I', color: 'rgba(165, 243, 252, 0.78)' },
    { x: 148, y: 48, label: '48m • CATHEDRAL ICE-BRIDGE', color: 'rgba(56, 189, 248, 0.78)' },
    { x: 218, y: 83, label: '82m • SUB-KEEL FJORD FLOOR', color: 'rgba(192, 132, 252, 0.80)' },
  ],

  exitZone: {
    name: 'East Fjord Pack-Ice Lead',
    x: 290,
    y: 1.5,
    radius: 5.5,
  },
};
