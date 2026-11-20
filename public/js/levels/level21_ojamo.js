import { createLevelTheme } from './themes.js';

/**
 * Level 21 (Campaign Rank 6 · Tier II): Ojamo Flooded Iron Mine (Lohja, Finland)
 * Historic 19th-century Finnish limestone & iron mine flooded with crystal-clear 4°C water.
 * Unique gameplay & architectural identity:
 * - Crisp, low-roughness blasted rectangular mine drifts stacked across 3 horizontal levels (26m, 46m, 68m)
 * - Interconnected by vertical ore-hoist & ventilation shafts
 * - First subterranean mine featuring crankable steel blast-door bulkheads (watertightHatches)
 *   guarding high-value ore vaults & a deep shortcut!
 */
export const LEVEL_21 = {
  id: 'ojamo-iron-mine',
  name: 'Ojamo Flooded Iron Mine',
  subtitle: 'Lohja, Finland • 68m 3-Level Flooded Mine & Blast Doors',
  difficultyRank: 6,
  tier: 2,
  badge: 'Mine 68m',
  description:
    'Descend the flooded vertical hoist shaft of Finland\'s legendary Ojamo Iron Mine. Navigate crisp, blasted three-story horizontal drifts at 26m, 46m, and 68m, crank open sealed steel mine blast doors for bonus ore-vault relics, and ascend the east ventilation shaft.',
  bounds: {
    xMin: -32,
    xMax: 274,
    yMin: -6,
    yMax: 78,
  },
  roughness: 0.16,
  spawn: { x: 12, y: 2.0 },
  haloclineY: 22.0,
  parTimeSec: 345,
  lined: true,
  reelMetersPerDiver: 0,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 22.0,
  theme: createLevelTheme('nordic-mine'),

  watertightHatches: [
    { id: 'oja_hatch_pump', x: 112.0, y: 26.0, radius: 1.85, label: 'Level-26 Pump Vault Bulkhead', bonusPoints: 175 },
    { id: 'oja_hatch_mag', x: 186.0, y: 68.0, radius: 1.85, label: 'Level-68 Dynamite Magazine Door', bonusPoints: 200 },
  ],

  openBasins: [
    { kind: 'entry', xMin: 5, xMax: 19, rimHalf: 5.2, flareAdd: 2.2, lipTilt: 0.12, floorY: 2.6, sunAngle: 1.54 },
    { kind: 'exit', xMin: 226, xMax: 240, rimHalf: 5.0, flareAdd: 2.2, lipTilt: -0.12, floorY: 2.6, sunAngle: 1.58 },
  ],

  segments: [
    // === WEST MAIN HOIST SHAFT (0m -> 46m) ===
    { ax: 12, ay: 1.0, bx: 12, by: 26.0, ra: 4.8, rb: 4.0 },
    { ax: 12, ay: 26.0, bx: 12, by: 46.0, ra: 3.4, rb: 3.4 },

    // === LEVEL 1 HORIZONTAL HAULAGE DRIFT (26m) ===
    { ax: 12, ay: 26.0, bx: 88, by: 26.0, ra: 3.1, rb: 3.0 },
    // Sealed Pump Vault Blast-Door Gallery beyond x=112
    { ax: 88, ay: 26.0, bx: 142, by: 26.0, ra: 2.8, rb: 3.2 },
    // West Blind Ore Pocket off Level 1
    { ax: 12, ay: 26.0, bx: -14, by: 26.0, ra: 2.5, rb: 2.9 },

    // === CENTRAL ORE-CHUTE SHAFT (26m -> 46m -> 68m) ===
    { ax: 88, ay: 26.0, bx: 88, by: 46.0, ra: 3.0, rb: 3.2 },
    { ax: 88, ay: 46.0, bx: 88, by: 68.0, ra: 3.0, rb: 3.6 },

    // === LEVEL 2 MID EXTRACTION DRIFT (46m) ===
    { ax: 12, ay: 46.0, bx: 88, by: 46.0, ra: 3.1, rb: 3.2 },
    { ax: 88, ay: 46.0, bx: 162, by: 46.0, ra: 3.1, rb: 3.1 },
    { ax: 162, ay: 46.0, bx: 233, by: 46.0, ra: 3.0, rb: 3.4 },
    // Deep West Blind Stope off Level 2
    { ax: 12, ay: 46.0, bx: -16, by: 52.0, ra: 2.4, rb: 3.0 },

    // === LEVEL 3 DEEP IRON-ORE SUMP DRIFT (68m) ===
    { ax: 88, ay: 68.0, bx: 162, by: 68.0, ra: 3.4, rb: 3.6 },
    // Sealed Dynamite Magazine Vault beyond x=186
    { ax: 162, ay: 68.0, bx: 214, by: 68.0, ra: 2.8, rb: 3.2 },
    // Deep West Sump Pocket (68m)
    { ax: 88, ay: 68.0, bx: 48, by: 68.0, ra: 2.5, rb: 3.1 },

    // === EAST ORE RAISE (68m -> 46m) ===
    { ax: 162, ay: 68.0, bx: 162, by: 46.0, ra: 3.2, rb: 3.1 },

    // === EAST VENTILATION ASCENT SHAFT (46m -> 22m -> 6m -> Surface) ===
    { ax: 233, ay: 46.0, bx: 233, by: 22.0, ra: 3.4, rb: 3.6 },
    { ax: 233, ay: 22.0, bx: 233, by: 6.0, ra: 3.6, rb: 4.4 },
    { ax: 233, ay: 6.0, bx: 233, by: 1.0, ra: 4.5, rb: 4.8 },
    // Upper East Timber Tool Drift off 22m shelf
    { ax: 233, ay: 22.0, bx: 196, by: 22.0, ra: 2.3, rb: 2.8 },
  ],

  guideline: [
    { x: 12, y: 2.0 },
    { x: 12, y: 26.0 },
    { x: 88, y: 26.0 },
    { x: 88, y: 46.0 },
    { x: 88, y: 68.0 },
    { x: 162, y: 68.0 },
    { x: 162, y: 46.0 },
    { x: 233, y: 46.0 },
    { x: 233, y: 22.0 },
    { x: 233, y: 6.0 },
  ],

  checkpoints: [
    { id: 'cp1', name: 'Level-26 Main Hoist Landing', x: 12, y: 26.0, radius: 4.4, hint: 'Follow the main rail line east along Level 26m, or explore the west drift.' },
    { id: 'cp2', name: 'Central Ore-Chute Junction (26m)', x: 88, y: 26.0, radius: 4.2, hint: 'Switch to TMX 14/55 [2] before descending the chute! Sealed Pump Vault lies east.' },
    { id: 'cp3', name: 'Level-46 Mid Extraction Drift', x: 88, y: 46.0, radius: 4.2, hint: 'Drop down to the 68m iron-ore sump drift on Trimix.' },
    { id: 'cp4', name: 'Level-68 Deep Sump Turnaround', x: 162, y: 68.0, radius: 4.4, hint: '68m reached! Crank the east Dynamite Magazine door or ascend the east raise.' },
    { id: 'cp5', name: 'East Shaft 22m Stage Switch', x: 233, y: 22.0, radius: 4.6, hint: 'Switch back to EAN32 [1] at 22m and ascend calmly up the hoist shaft.' },
    { id: 'cp6', name: '6m Hoist-Bay O2 Deco Shelf', x: 233, y: 6.0, radius: 5.5, hint: 'Switch to O2 100% [3] and clear your decompression ceiling before exiting.' },
  ],

  collectibles: [
    { id: 'oja_c1', name: '1924 Carbide Miner Lamp', x: -12, y: 26.0, kind: 'gear', points: 360, scale: 1.25 },
    { id: 'oja_c2', name: 'Brass Hoist Bell', x: 52, y: 26.0, kind: 'relic', points: 240, scale: 1.0 },
    { id: 'oja_c3', name: 'Pump-Vault Brass Pressure Gauge', x: 138, y: 26.0, kind: 'gear', points: 580, scale: 1.5 },
    { id: 'oja_c4', name: 'Magnetite Iron-Ore Geode', x: -14, y: 51.5, kind: 'crystal', points: 540, scale: 1.48 },
    { id: 'oja_c5', name: 'Ore-Cart Coupling Pin', x: 48, y: 46.0, kind: 'gear', points: 260, scale: 1.0 },
    { id: 'oja_c6', name: 'Deep Sump Quartz Cluster', x: 50, y: 68.0, kind: 'crystal', points: 620, scale: 1.55 },
    { id: 'oja_c7', name: 'Level-68 Survey Transit', x: 126, y: 68.0, kind: 'compass', points: 310, scale: 1.05 },
    { id: 'oja_c8', name: '1938 Blaster Brass Detonator', x: 210, y: 68.0, kind: 'relic', points: 780, scale: 1.7 },
    { id: 'oja_c9', name: 'Nordic Timber Wedge Token', x: 198, y: 46.0, kind: 'relic', points: 290, scale: 1.0 },
    { id: 'oja_c10', name: 'East Tool-Drift Pocket Watch', x: 198, y: 22.0, kind: 'relic', points: 520, scale: 1.45 },
  ],

  zoneLines: [
    { id: 'zone-tmx', title: 'SWITCH TO TMX 14/55 BELOW 30m (MOD 33.7m)', xMin: 78, xMax: 98, y: 33.7, color: '#c084fc' },
    { id: 'zone-ean32-up', title: 'ASCENT SWITCH -> EAN32 (22m)', xMin: 224, xMax: 242, y: 22.0, color: '#38bdf8' },
    { id: 'zone-deco', title: '6m DECO LINE · SWITCH TO O2 100%', xMin: 225, xMax: 241, y: 6.0, color: '#4ade80' },
  ],

  depthMarkers: [
    { x: 18, y: 26, label: '26m • LEVEL 1 HAULAGE DRIFT', color: 'rgba(125, 211, 252, 0.72)' },
    { x: 96, y: 46, label: '46m • LEVEL 2 EXTRACTION DRIFT', color: 'rgba(251, 191, 36, 0.72)' },
    { x: 126, y: 68, label: '68m • LEVEL 3 DEEP ORE SUMP', color: 'rgba(248, 113, 113, 0.75)' },
  ],

  exitZone: {
    name: 'East Ventilation Shaft Exit',
    x: 233,
    y: 1.5,
    radius: 5.2,
  },
};
