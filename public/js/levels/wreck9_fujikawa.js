import { createLevelTheme } from './themes.js';

/**
 * Shipwreck 9 (Tier I · Iconic Sunlit Pacific WWII Cargo Wreck): Fujikawa Maru (Chuuk Lagoon, Micronesia)
 * World-famous 34m WWII Japanese armed aircraft ferry sunk in Operation Hailstone (1944).
 * Blanketed in soft corals with accessible Hold #2 containing intact A6M Zero fighter fuselages,
 * crankable watertight bulkheads, a sunlit engine room, and pelagic reef megafauna overhead.
 */
export const WRECK_FUJIKAWA = {
  id: 'fujikawa-maru-chuuk',
  name: 'Fujikawa Maru — Chuuk Lagoon',
  category: 'wreck',
  isWreck: true,
  difficultyRank: 4,
  tier: 1,
  subtitle: 'Chuuk Lagoon, Micronesia • 34m WWII Coral-Draped Aircraft Ferry',
  description:
    'Descend through crystal-clear Micronesian lagoon water onto the coral-blanketed decks of the iconic Fujikawa Maru. Swim through Hold #2 past sunken Zero fighter airframes, crank open sealed forepeak and engine-room bulkheads for wartime salvage, and clear a serene 6m masthead O2 stop surrounded by reef sharks and mantas.',
  badge: 'Wreck 34m',
  parTimeSec: 255,
  lined: true,
  reelMetersPerDiver: 0,
  roughness: 0.14,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 18.0,
  bounds: { xMin: -44, xMax: 126, yMin: -6, yMax: 46 },
  spawn: { x: 10.0, y: 2.0 },
  exitZone: { x: 10.0, y: 1.8, radius: 6.8, name: 'Chuuk Lagoon Outrigger Dive Platform' },
  haloclineY: 20.0,
  wreckDeckY: 18.0,
  wreckSeabedY: 36.0,
  wreckHullXMin: -24,
  wreckHullXMax: 94,
  shipProfile: 'fujikawa-cargo-wreck',
  hullTopY(wx) {
    // Open sunlit cargo hatch coamings over Hold #2 (x = 22..44)
    if (wx >= 22 && wx <= 44) {
      return 19.6;
    }
    return 18.0;
  },
  shotLine: { x: 10.0, bottomY: 18.0, decoStagesY: [18.0, 6.0] },
  theme: createLevelTheme('red-sea-coral-wreck'),

  openBasins: [
    { kind: 'entry', xMin: -40, xMax: 118, rimHalf: 79, flareAdd: 0, lipTilt: 0, floorY: 17.5, sunAngle: 1.52 },
  ],

  driftCurrents: [
    { yMin: 5.0, yMax: 17.0, vx: 0.44, vy: 0, label: 'Chuuk Atoll Lagoon Drift' },
  ],

  surgeZones: [
    { id: 'fuj_surge1', x: 34.0, y: 26.8, radius: 3.8, vx: 1.9, vy: 0.9, periodSec: 8.2, phase: 0.4, label: 'Hold #2 Hatch Swell' },
  ],

  snagZones: [
    { id: 'fuj_snag1', x: 26.0, y: 26.8, radius: 2.0, label: 'Zero Wing-Rigging Cable' },
  ],

  watertightHatches: [
    { id: 'fuj_hatch_bow', x: -5.0, y: 26.5, radius: 1.8, label: 'Forepeak Ordnance Locker', bonusPoints: 165 },
    { id: 'fuj_hatch_aft', x: 78.0, y: 32.5, radius: 1.8, label: 'Aft Telegraph Engine Vault', bonusPoints: 185 },
  ],

  wreckProps: [
    { kind: 'anchor', x: -20.0, y: 18.0, chainLen: 16.0 },
    { kind: 'crane', x: 4.0, y: 18.0, scale: 1.0, angle: 0.22 },
    { kind: 'mast', x: 20.0, y: 18.0, scale: 1.05 },
    { kind: 'crane', x: 48.0, y: 18.0, scale: 1.0, angle: -0.28 },
    { kind: 'railing', x: -14.0, y: 18.0, len: 16.0 },
    { kind: 'railing', x: 56.0, y: 18.0, len: 24.0 },
    { kind: 'porthole', x: 4.0, y: 25.5, angle: 0.65, beamLen: 5.4 },
    { kind: 'porthole', x: 32.0, y: 25.5, angle: 0.85, beamLen: 6.2 },
    { kind: 'porthole', x: 64.0, y: 29.0, angle: 2.35, beamLen: 5.5 },
    { kind: 'beam', x: 20.0, y: 23.5, len: 5.6, angle: 0 },
    { kind: 'beam', x: 38.0, y: 23.8, len: 5.4, angle: 0.06 },
    { kind: 'zero-fighter', x: 26.5, y: 27.9, scale: 1.05, angle: -0.08 },
    { kind: 'zero-fighter', x: 39.2, y: 28.2, scale: 0.96, angle: 0.14 },
    { kind: 'pipe', x: 60.0, y: 32.5, len: 12.0, angle: -0.04 },
    { kind: 'propeller', x: 92.0, y: 31.5, scale: 1.25, angle: 0.2 },
  ],

  segments: [
    // Forward Cargo Hold #1 Drop (Deck 18m -> Tween Deck 26.5m)
    { ax: 10, ay: 15.5, bx: 10, by: 26.5, ra: 4.4, rb: 4.0 },
    // Forepeak Ordnance Locker (guarded by watertight hatch!)
    { ax: 10, ay: 26.5, bx: -14, by: 26.5, ra: 3.1, rb: 2.8 },
    // Hold #2 Zero Fighter Aircraft Hangar (26.5m -> 27.5m)
    { ax: 10, ay: 26.5, bx: 46, by: 27.5, ra: 4.1, rb: 4.2 },
    // Sunlit Hatch Skylight above Zero Fighter Hold
    { ax: 32, ay: 27.0, bx: 32, by: 17.2, ra: 4.0, rb: 4.4 },
    // Midships Engine-Room Drop (27.5m -> 33.5m)
    { ax: 46, ay: 27.5, bx: 56, by: 33.5, ra: 3.8, rb: 4.2 },
    { ax: 56, ay: 33.5, bx: 74, by: 33.0, ra: 4.2, rb: 3.5 },
    // Sealed Aft Engine Telegraph Vault (guarded by watertight hatch!)
    { ax: 74, ay: 33.0, bx: 88, by: 32.0, ra: 3.0, rb: 2.6 },
    // Aft Escape Hatchway back up to Coral-Draped Stern Deck (33m -> 16.5m)
    { ax: 74, ay: 33.0, bx: 74, by: 16.5, ra: 3.6, rb: 4.4 },
  ],

  guideline: [
    { x: 10, y: 2.0 },
    { x: 10, y: 18.0 },
    { x: 10, y: 26.5 },
    { x: 32, y: 27.0 },
    { x: 46, y: 27.5 },
    { x: 56, y: 33.5 },
    { x: 74, y: 33.0 },
    { x: 74, y: 17.5 },
    { x: 10, y: 16.5 },
    { x: 10, y: 6.0 },
  ],

  checkpoints: [
    { id: 'cp1', x: 10, y: 18.0, radius: 5.2, name: '18m Coral Foredeck Hatch', hint: 'Drop into Hold #1 on EAN32 or glide east into the sunlit Zero Fighter hold!' },
    { id: 'cp2', x: 32, y: 27.0, radius: 5.0, name: 'Hold #2 Zero Fighter Hangar', hint: 'Switch to TMX 14/55 [2] before dropping into the 34m engine room!' },
    { id: 'cp3', x: 56, y: 33.5, radius: 4.6, name: '34m Main Engine Room', hint: 'Crank the aft engine vault bulkhead or continue to the stern escape hatch.' },
    { id: 'cp4', x: 74, y: 33.0, radius: 4.8, name: 'Aft Bulkhead Turnaround', hint: 'Turnaround reached! Ascend the aft hatch and cruise along the coral deck to the shot line.' },
    { id: 'cp5', x: 10, y: 14.0, radius: 5.6, name: '14m Shot Line Ascent Switch', hint: 'Switch back to EAN32 [1] on the shot line and ascend smoothly.' },
    { id: 'cp6', x: 10, y: 6.0, radius: 5.8, name: '6m Masthead O2 Deco Stop', hint: 'Switch to O2 100% [3] beneath the dive boat to clear decompression.' },
  ],

  collectibles: [
    { id: 'fuj_c1', name: 'Coral-Encrusted Mast Lantern', x: 20, y: 16.5, kind: 'gear', points: 210, scale: 1.0 },
    { id: 'fuj_c2', name: 'Forepeak Bronze Pressure Valve', x: -11, y: 26.5, kind: 'relic', points: 480, scale: 1.4 },
    { id: 'fuj_c3', name: 'A6M Zero Airframe Data Plate', x: 32, y: 27.2, kind: 'relic', points: 360, scale: 1.25 },
    { id: 'fuj_c4', name: 'Zero Fighter Cockpit Gyro', x: 42, y: 27.4, kind: 'compass', points: 340, scale: 1.2 },
    { id: 'fuj_c5', name: 'R2D2 Boiler Room Brass Gauge', x: 60, y: 33.2, kind: 'gear', points: 390, scale: 1.28 },
    { id: 'fuj_c6', name: 'Chuuk Brass Engine Telegraph', x: 85, y: 32.2, kind: 'relic', points: 640, scale: 1.55 },
  ],

  zoneLines: [
    { id: 'fuj-tmx', title: 'TMX 14/55 RECOMMENDED BELOW 30m', xMin: 44, xMax: 84, y: 30.0, color: '#c084fc' },
    { id: 'fuj-ean', title: 'ASCENT SWITCH -> EAN32 [1] (14m)', xMin: 0, xMax: 22, y: 14.0, color: '#38bdf8' },
    { id: 'fuj-deco', title: '6m MASTHEAD DECO · O2 100% [3]', xMin: 0, xMax: 22, y: 6.0, color: '#4ade80' },
  ],

  depthMarkers: [
    { x: 10, y: 6.0, label: '6m • MASTHEAD O2 DECO', color: '#4ade80' },
    { x: 42, y: 18.0, label: '18m • CORAL CARGO DECK', color: '#38bdf8' },
    { x: 58, y: 33.5, label: '34m • ENGINE ROOM FLOOR', color: '#f59e0b' },
  ],
};
