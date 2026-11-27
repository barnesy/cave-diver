import { createLevelTheme } from './themes.js';

/**
 * Shipwreck 1 (Campaign L3): USS Oriskany ("The Mighty O" · Pensacola, Florida, Gulf of Mexico)
 * Intentionally scuttled 274m Essex-class aircraft carrier — ideal introduction to deep technical
 * shipwreck penetration.
 * - Drop from the charter boat down the weighted shot line past the radar island (28m) to the Flight Deck (42m)
 * - Enter the cavernous Hangar Bay (52m) via the Forward Aircraft Elevator
 * - Follow the fixed penetration line through the Combat Information Center (CIC) & Engine Room (64m)
 * - Ascend the Stern Elevator back to the shot line & 6m O2 deco trapeze bar beneath the boat
 */
export const WRECK_ORISKANY = {
  id: 'uss-oriskany-carrier',
  name: 'USS Oriskany Carrier Reef',
  category: 'wreck',
  isWreck: true,
  difficultyRank: 3,
  tier: 2,
  subtitle: 'Pensacola, Gulf of Mexico • 65m Aircraft Carrier Penetration',
  description:
    'Descend the charter shot line onto "The Mighty O," a 274m scuttled Essex-class aircraft carrier upright in the Gulf of Mexico. Drop past the radar island to the 42m flight deck, thread the cavernous hangar bay and lower CIC compartments at 64m on TMX 14/55, and clear O2 deco on the 6m trapeze bar.',
  badge: 'Wreck 65m',
  parTimeSec: 360,
  lined: true,
  reelMetersPerDiver: 0,
  roughness: 0.14,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 22.0,
  bounds: { xMin: -54, xMax: 295, yMin: -6, yMax: 84 },
  spawn: { x: 10.0, y: 2.0 },
  exitZone: { x: 10.0, y: 1.8, radius: 6.8, name: 'Charter Boat Stern Ladder' },
  haloclineY: 28.0,
  wreckDeckY: 42.0,
  wreckSeabedY: 67.0,
  wreckHullXMin: -28,
  wreckHullXMax: 98,
  shipProfile: 'oriskany-carrier',
  shotLine: { x: 10.0, bottomY: 42.0, decoStagesY: [22.0, 6.0] },
  theme: createLevelTheme('gulf-carrier-wreck'),

  openBasins: [
    { kind: 'entry', xMin: -50, xMax: 122, rimHalf: 86, flareAdd: 0, lipTilt: 0, floorY: 41.5, sunAngle: 1.54 },
  ],

  driftCurrents: [
    { yMin: 8.0, yMax: 34.0, vx: 0.65, vy: 0, label: 'Gulf Surface Drift' },
  ],

  surgeZones: [
    { id: 'ori_surge1', x: 8.0, y: 45.0, radius: 4.2, vx: 0, vy: 3.1, periodSec: 7.4, phase: 0.3, label: 'Forward Elevator Swell' },
    { id: 'ori_surge2', x: 80.0, y: 45.5, radius: 4.2, vx: 0, vy: -3.2, periodSec: 7.0, phase: 2.1, label: 'Stern Elevator Updraft' },
  ],

  snagZones: [
    { id: 'ori_snag1', x: 48.0, y: 51.2, radius: 2.2, label: 'Hanging Hangar Conduit' },
    { id: 'ori_snag2', x: 70.0, y: 62.5, radius: 2.1, label: 'Engine Room Cable Snarl' },
  ],

  watertightHatches: [
    { id: 'ori_hatch_bow', x: -3.5, y: 52.5, radius: 1.85, label: 'Armory Vault Bulkhead', bonusPoints: 150 },
    { id: 'ori_hatch_cic', x: 52.0, y: 57.5, radius: 1.8, label: 'CIC Shortcut Hatch', bonusPoints: 150 },
  ],

  wreckProps: [
    { kind: 'island', x: 26.0, y: 42.0, scale: 1.15 },
    { kind: 'mast', x: 26.0, y: 24.0, scale: 1.0 },
    { kind: 'anchor', x: -24.0, y: 42.0, chainLen: 24.0 },
    { kind: 'railing', x: -16.0, y: 42.0, len: 18.0 },
    { kind: 'railing', x: 44.0, y: 42.0, len: 28.0 },
    { kind: 'porthole', x: -8.0, y: 50.0, angle: 0.55, beamLen: 6.4 },
    { kind: 'porthole', x: 24.0, y: 50.0, angle: 0.72, beamLen: 6.0 },
    { kind: 'porthole', x: 54.0, y: 50.5, angle: 0.85, beamLen: 6.0 },
    { kind: 'porthole', x: 74.0, y: 51.0, angle: 2.45, beamLen: 5.8 },
    { kind: 'beam', x: 16.0, y: 49.0, len: 5.4, angle: 0 },
    { kind: 'beam', x: 42.0, y: 49.0, len: 5.6, angle: 0.04 },
    { kind: 'beam', x: 58.0, y: 59.5, len: 5.2, angle: 0.06 },
    { kind: 'pipe', x: 44.0, y: 62.0, len: 14.0, angle: 0.05 },
    { kind: 'propeller', x: 96.0, y: 61.0, scale: 1.35, angle: 0.3 },
  ],

  segments: [
    // Forward Aircraft Elevator Shaft (Flight Deck 42m -> Hangar Bay 52m)
    { ax: 8, ay: 39.5, bx: 8, by: 52.0, ra: 4.4, rb: 4.2 },

    // Main Cavernous Hangar Bay Corridor (52m)
    { ax: 8, ay: 52.0, bx: 36, by: 52.0, ra: 4.0, rb: 4.2 },
    { ax: 36, ay: 52.0, bx: 68, by: 52.0, ra: 4.2, rb: 3.8 },

    // Forward Bow Armory Vault (guarded by watertight hatch!)
    { ax: 8, ay: 52.0, bx: -14, by: 53.0, ra: 3.2, rb: 2.7 },

    // Direct CIC Bypass Shortcut Drop (guarded by watertight hatch!)
    { ax: 52, ay: 52.0, bx: 54, by: 63.5, ra: 2.5, rb: 2.7 },

    // Central Companionway Drop -> CIC & Lower Machinery Deck (64m)
    { ax: 36, ay: 52.0, bx: 34, by: 62.5, ra: 2.8, rb: 3.0 },
    { ax: 34, ay: 62.5, bx: 58, by: 64.0, ra: 3.0, rb: 3.3 },
    { ax: 58, ay: 64.0, bx: 78, by: 61.0, ra: 3.2, rb: 2.9 },

    // Stern Elevator Ascent Shaft back to Flight Deck (61m -> 40m)
    { ax: 68, ay: 52.0, bx: 80, by: 52.0, ra: 3.5, rb: 3.6 },
    { ax: 78, ay: 61.0, bx: 80, by: 52.0, ra: 2.9, rb: 3.5 },
    { ax: 80, ay: 52.0, bx: 80, by: 39.5, ra: 3.8, rb: 4.4 },

    // Secret Lair (Sonar-Breachable): Great White Sovereign Abyssal Trench (v267)
    { ax: 78, ay: 61.0, bx: 118, by: 61.5, ra: 2.5, rb: 3.8, secretLair: true },
    { ax: 118, ay: 61.5, bx: 146, by: 61.5, ra: 5.2, rb: 4.5, secretLair: true }, // Armory chamber (x=132, y=61.5)
    { ax: 146, ay: 61.5, bx: 214, by: 61.0, ra: 4.5, rb: 5.0, secretLair: true }, // Reef-shark gauntlet
    { ax: 214, ay: 61.0, bx: 246, by: 61.0, ra: 14.5, rb: 15.5, secretLair: true }, // Great White Arena
    { ax: 246, ay: 61.0, bx: 274, by: 61.0, ra: 15.5, rb: 13.0, secretLair: true },
  ],

  guideline: [
    { x: 10, y: 2.0 },
    { x: 10, y: 22.0 },
    { x: 8, y: 42.0 },
    { x: 8, y: 52.0 },
    { x: 36, y: 52.0 },
    { x: 34, y: 62.5 },
    { x: 58, y: 64.0 },
    { x: 78, y: 61.0 },
    { x: 80, y: 52.0 },
    { x: 80, y: 40.5 },
    { x: 10, y: 38.0 },
    { x: 10, y: 22.0 },
    { x: 10, y: 6.0 },
  ],

  checkpoints: [
    { id: 'cp1', x: 10, y: 22.0, radius: 5.5, name: '22m Shot Line Buoy', hint: 'Switch to TMX 14/55 [2] before descending to the Flight Deck!' },
    { id: 'cp2', x: 8, y: 42.0, radius: 5.2, name: 'Flight Deck & Elevator', hint: 'Drop into the forward aircraft elevator shaft.' },
    { id: 'cp3', x: 36, y: 52.0, radius: 4.8, name: 'Main Hangar Bay', hint: 'Descend the central hatch toward the Combat Information Center.' },
    { id: 'cp4', x: 58, y: 64.0, radius: 4.8, name: 'CIC & Lower Engine Vault', hint: 'Turnaround point! Exit via the stern elevator shaft.' },
    { id: 'cp5', x: 10, y: 22.0, radius: 5.8, name: '22m Ascent Switch Buoy', hint: 'Switch back to EAN32 [1] on the shot line and ascend at 9 m/min.' },
    { id: 'cp6', x: 10, y: 6.0, radius: 5.8, name: '6m O2 Deco Trapeze Bar', hint: 'Switch to O2 100% [3] and clear decompression before boarding.' },
  ],

  collectibles: [
    { id: 'ori_c1', x: 24, y: 31.0, kind: 'compass', name: 'Pri-Fly Bridge Compass', points: 250, scale: 1.0, radius: 1.5 },
    { id: 'ori_c2', x: -12, y: 53.0, kind: 'relic', name: 'Forward Bow Signal Lamp', points: 320, scale: 1.05, radius: 1.45 },
    { id: 'ori_c3', x: 46, y: 52.0, kind: 'beacon', name: 'Hangar Deck Tie-Down Plate', points: 280, scale: 1.0, radius: 1.45 },
    { id: 'ori_c4', x: 35, y: 61.5, kind: 'relic', name: 'Carrier Brass Speaking Tube', points: 340, scale: 1.1, radius: 1.45 },
    { id: 'ori_c5', x: 56, y: 64.2, kind: 'relic', name: 'CIC Radar Oscilloscope', points: 450, scale: 1.25, radius: 1.5 },
    { id: 'ori_c6', x: 76, y: 60.5, kind: 'relic', name: 'Engine Order Telegraph', points: 520, scale: 1.35, radius: 1.5 },
  ],

  zoneLines: [
    { id: 'zone-switch', y: 22.0, xMin: -2, xMax: 24, color: '#fbbf24', title: '22m SHOT LINE SWITCH — TMX 14/55 [2]' },
    { id: 'zone-deco', y: 6.0, xMin: -2, xMax: 24, color: '#34d399', title: '6m O2 DECO TRAPEZE BAR — O2 100% [3]' },
  ],

  depthMarkers: [
    { x: 15, y: 6, label: '6m O2 BAR', color: '#34d399' },
    { x: 15, y: 22, label: '22m TMX', color: '#fbbf24' },
    { x: 24, y: 40, label: '42m FLIGHT DECK', color: '#38bdf8' },
    { x: 46, y: 50, label: '52m HANGAR BAY', color: '#7dd3fc' },
    { x: 58, y: 66, label: '65m CIC / KEEL', color: '#f87171' },
  ],
};
