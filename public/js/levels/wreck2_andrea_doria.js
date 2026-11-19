import { createLevelTheme } from './themes.js';

/**
 * Shipwreck 2 (Campaign L9): SS Andrea Doria (Atlantic Ocean, off Nantucket, USA)
 * "The Mount Everest of Wreck Diving." The 701-foot Italian luxury liner lies 90 degrees on her
 * starboard side in 76m of cold, current-swept North Atlantic water.
 * - Fight shifting Atlantic drift currents down the shot line to the port hull at 53m
 * - Deploy your unlined 190m wreck reel at Gimbel's Hole breach
 * - Navigate sideways corridors (decks acting as vertical chimneys!) past fishing nets & rust silt
 * - Reach the First-Class China Dining Room & Banco di Roma Safe Vault at 75m, then ascend to 6m O2 bar
 */
export const WRECK_ANDREA_DORIA = {
  id: 'ss-andrea-doria',
  name: 'SS Andrea Doria',
  category: 'wreck',
  isWreck: true,
  difficultyRank: 9,
  tier: 4,
  subtitle: 'Off Nantucket, North Atlantic • 76m Sideways Luxury Liner',
  description:
    'The legendary "Mount Everest of Wreck Diving." Battle opposing North Atlantic drift currents down the shot line to the port hull at 53m, deploy your 190m unlined wreck reel into Gimbel\'s Hole, weave past tangled fishing nets through 90°-tilted luxury corridors to the 75m First-Class Vault, and clear deco beneath the boat.',
  badge: 'Wreck 76m',
  parTimeSec: 460,
  lined: false,
  reelMetersPerDiver: 190,
  roughness: 0.16,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 22.0,
  bounds: { xMin: -58, xMax: 138, yMin: -6, yMax: 84 },
  spawn: { x: 12.0, y: 2.0 },
  exitZone: { x: 12.0, y: 1.8, radius: 6.8, name: 'Nantucket Charter Boat' },
  haloclineY: 34.0,
  wreckDeckY: 53.0,
  wreckSeabedY: 77.0,
  wreckHullXMin: -28,
  wreckHullXMax: 106,
  shipProfile: 'andrea-doria-capsized',
  shotLine: { x: 12.0, bottomY: 53.0, decoStagesY: [22.0, 6.0] },
  theme: createLevelTheme('atlantic-liner-wreck'),

  openBasins: [
    { kind: 'entry', xMin: -54, xMax: 134, rimHalf: 94, flareAdd: 0, lipTilt: 0, floorY: 52.5, sunAngle: 1.5 },
  ],

  driftCurrents: [
    { yMin: 10.0, yMax: 32.0, vx: 1.05, vy: 0, label: 'Surface Atlantic Drift' },
    { yMin: 35.0, yMax: 52.0, vx: -0.95, vy: 0, label: 'Opposing Cold-Wall Current' },
  ],

  surgeZones: [
    { id: 'dor_surge1', x: 13.0, y: 56.0, radius: 4.2, vx: 0.4, vy: 3.6, periodSec: 7.2, phase: 0.0, label: "Gimbel's Hole Atlantic Surge" },
    { id: 'dor_surge2', x: 89.0, y: 56.5, radius: 4.3, vx: 0.5, vy: -3.5, periodSec: 6.8, phase: 1.9, label: 'Aft Hull Tear Surge' },
  ],

  snagZones: [
    { id: 'dor_snag1', x: 28.0, y: 62.5, radius: 2.3, label: 'Commercial Fishing Net' },
    { id: 'dor_snag2', x: 64.0, y: 75.0, radius: 2.2, label: 'Collapsed Promenade Cables' },
    { id: 'dor_snag3', x: 82.0, y: 66.0, radius: 2.3, label: 'Drifting Trawler Monofilament' },
  ],

  watertightHatches: [
    { id: 'dor_hatch_bow', x: 0.0, y: 65.5, radius: 1.8, label: 'First-Class Stateroom Door', bonusPoints: 150 },
    { id: 'dor_hatch_vault', x: 68.0, y: 75.2, radius: 1.8, label: 'Banco di Roma Vault Bulkhead', bonusPoints: 200 },
  ],

  wreckProps: [
    { kind: 'funnel', x: 52.0, y: 51.0, scale: 1.2, angle: 1.32 },
    { kind: 'davit', x: 28.0, y: 52.5, scale: 1.05, angle: 0.45 },
    { kind: 'davit', x: 74.0, y: 52.5, scale: 1.05, angle: -0.35 },
    { kind: 'anchor', x: -24.0, y: 53.0, chainLen: 24.0 },
    { kind: 'railing', x: -12.0, y: 53.0, len: 20.0 },
    { kind: 'porthole', x: 4.0, y: 59.0, angle: 0.85, beamLen: 6.2 },
    { kind: 'porthole', x: 42.0, y: 59.0, angle: 1.1, beamLen: 6.0 },
    { kind: 'porthole', x: 88.0, y: 59.0, angle: 2.1, beamLen: 5.8 },
    { kind: 'beam', x: 18.0, y: 62.0, len: 5.0, angle: 1.48 },
    { kind: 'beam', x: 46.0, y: 67.0, len: 4.8, angle: 1.52 },
    { kind: 'beam', x: 52.0, y: 72.5, len: 5.4, angle: 0.1 },
    { kind: 'pipe', x: 26.0, y: 61.5, len: 12.0, angle: -0.08 },
    { kind: 'propeller', x: 104.0, y: 71.0, scale: 1.3, angle: 0.5 },
  ],

  segments: [
    // Gimbel's Hole Port Breach (vertical drop through sideways upper decks 51m -> 64m)
    { ax: 12, ay: 50.5, bx: 14, by: 64.0, ra: 3.6, rb: 3.2 },

    // Sideways Promenade Deck (horizontal corridor with tilted bulkheads)
    { ax: 14, ay: 64.0, bx: 44, by: 61.0, ra: 3.1, rb: 2.8 },
    { ax: 44, ay: 61.0, bx: 74, by: 64.0, ra: 2.8, rb: 3.2 },

    // Forward Stateroom Maze (optional artifact pocket)
    { ax: 14, ay: 64.0, bx: -12, by: 67.0, ra: 2.7, rb: 2.5 },

    // First-Class Foyer Shaft -> China Dining Room & Safe Vault (75m)
    { ax: 44, ay: 61.0, bx: 46, by: 74.5, ra: 2.6, rb: 3.3 },
    { ax: 46, ay: 74.5, bx: 76, by: 75.5, ra: 3.3, rb: 3.2 },
    { ax: 76, ay: 75.5, bx: 90, by: 68.0, ra: 3.0, rb: 2.8 },

    // Aft Hull Tear Exit Chimney back to open water (68m -> 50.5m)
    { ax: 74, ay: 64.0, bx: 90, by: 68.0, ra: 2.8, rb: 2.9 },
    { ax: 90, ay: 68.0, bx: 88, by: 50.5, ra: 3.0, rb: 3.8 },
  ],

  guideline: [],

  checkpoints: [
    { id: 'cp1', x: 12, y: 22.0, radius: 5.5, name: '22m Shot Line Buoy', hint: 'Switch to TMX 14/55 [2] and watch for shifting Atlantic drift!' },
    { id: 'cp2', x: 12, y: 53.0, radius: 5.0, name: "Gimbel's Hole Breach", hint: 'Anchor your unlined reel [G] before entering the 90°-tilted decks.' },
    { id: 'cp3', x: 44, y: 61.0, radius: 4.5, name: 'Sideways First-Class Foyer', hint: 'Drop down the vertical stairwell bulkhead toward the Dining Room.' },
    { id: 'cp4', x: 64, y: 75.0, radius: 4.8, name: 'China Dining Room & Safe Vault', hint: 'Turnaround point! Navigate clear of fishing nets to the aft exit.' },
    { id: 'cp5', x: 12, y: 22.0, radius: 5.8, name: '22m Ascent Switch Buoy', hint: 'Switch back to EAN32 [1] on the shot line and hold 9 m/min.' },
    { id: 'cp6', x: 12, y: 6.0, radius: 5.8, name: '6m O2 Deco Trapeze Bar', hint: 'Switch to O2 100% [3] and hold beside the shot line.' },
  ],

  collectibles: [
    { id: 'dor_c1', x: -10, y: 67.0, kind: 'relic', name: 'Brass Stateroom Porthole', points: 360, scale: 1.05, radius: 1.45 },
    { id: 'dor_c2', x: 32, y: 62.2, kind: 'relic', name: 'Ginori Porcelain Dinner Plate', points: 420, scale: 1.1, radius: 1.45 },
    { id: 'dor_c3', x: 60, y: 62.5, kind: 'relic', name: 'Promenade Crystal Decanter', points: 400, scale: 1.1, radius: 1.45 },
    { id: 'dor_c4', x: 50, y: 74.8, kind: 'relic', name: 'First-Class Silver Candelabra', points: 480, scale: 1.2, radius: 1.5 },
    { id: 'dor_c5', x: 74, y: 75.5, kind: 'relic', name: 'Banco di Roma Safe Plaque', points: 620, scale: 1.38, radius: 1.5 },
    { id: 'dor_c6', x: 90, y: 67.5, kind: 'compass', name: 'Italian Line Brass Sextant', points: 440, scale: 1.15, radius: 1.45 },
  ],

  zoneLines: [
    { id: 'zone-switch', y: 22.0, xMin: 0, xMax: 26, color: '#fbbf24', title: '22m SHOT LINE SWITCH — TMX 14/55 [2]' },
    { id: 'zone-deco', y: 6.0, xMin: 0, xMax: 26, color: '#34d399', title: '6m O2 DECO TRAPEZE BAR — O2 100% [3]' },
  ],

  depthMarkers: [
    { x: 18, y: 6, label: '6m O2 BAR', color: '#34d399' },
    { x: 18, y: 22, label: '22m TMX', color: '#fbbf24' },
    { x: 24, y: 51, label: '53m PORT HULL', color: '#38bdf8' },
    { x: 48, y: 60, label: '62m FOYER', color: '#7dd3fc' },
    { x: 64, y: 77, label: '76m SAFE VAULT', color: '#f87171' },
  ],
};
