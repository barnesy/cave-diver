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
  bounds: { xMin: -54, xMax: 126, yMin: -6, yMax: 74 },
  spawn: { x: 10.0, y: 2.0 },
  exitZone: { x: 10.0, y: 1.8, radius: 6.8, name: 'Charter Boat Stern Ladder' },
  haloclineY: 28.0,
  wreckDeckY: 42.0,
  wreckSeabedY: 67.0,
  wreckHullXMin: -28,
  wreckHullXMax: 98,
  shotLine: { x: 10.0, bottomY: 42.0 },
  theme: createLevelTheme('gulf-carrier-wreck'),

  openBasins: [
    { kind: 'entry', xMin: -50, xMax: 122, rimHalf: 86, flareAdd: 0, lipTilt: 0, floorY: 41.5, sunAngle: 1.54 },
  ],

  driftCurrents: [
    { yMin: 8.0, yMax: 34.0, vx: 0.55, vy: 0, label: 'Gulf Surface Drift' },
  ],

  snagZones: [
    { x: 48.0, y: 51.0, radius: 2.1, label: 'Hanging Hangar Conduit' },
  ],

  wreckProps: [
    { kind: 'island', x: 24.0, y: 42.0, scale: 1.05 },
    { kind: 'porthole', x: -8.0, y: 50.0, angle: 0.55, beamLen: 6.0 },
    { kind: 'porthole', x: 34.0, y: 51.0, angle: 0.72, beamLen: 5.5 },
    { kind: 'porthole', x: 74.0, y: 51.0, angle: 2.45, beamLen: 5.5 },
    { kind: 'beam', x: 16.0, y: 49.0, len: 5.2, angle: 0 },
    { kind: 'beam', x: 58.0, y: 58.0, len: 5.0, angle: 0.08 },
    { kind: 'propeller', x: 96.0, y: 61.0, scale: 1.25, angle: 0.3 },
  ],

  segments: [
    // Forward Aircraft Elevator Shaft (Flight Deck 42m -> Hangar Bay 52m)
    { ax: 8, ay: 39.5, bx: 8, by: 52.0, ra: 4.4, rb: 4.2 },

    // Main Cavernous Hangar Bay Corridor (52m)
    { ax: 8, ay: 52.0, bx: 36, by: 52.0, ra: 4.0, rb: 4.2 },
    { ax: 36, ay: 52.0, bx: 68, by: 52.0, ra: 4.2, rb: 3.8 },

    // Forward Bow Storage Alcove (dead-end artifact bay)
    { ax: 8, ay: 52.0, bx: -14, by: 53.0, ra: 3.2, rb: 2.6 },

    // Central Companionway Drop -> CIC & Lower Machinery Deck (64m)
    { ax: 36, ay: 52.0, bx: 34, by: 62.5, ra: 2.8, rb: 3.0 },
    { ax: 34, ay: 62.5, bx: 58, by: 64.0, ra: 3.0, rb: 3.3 },
    { ax: 58, ay: 64.0, bx: 78, by: 61.0, ra: 3.2, rb: 2.9 },

    // Stern Elevator Ascent Shaft back to Flight Deck (61m -> 40m)
    { ax: 68, ay: 52.0, bx: 80, by: 52.0, ra: 3.5, rb: 3.6 },
    { ax: 78, ay: 61.0, bx: 80, by: 52.0, ra: 2.9, rb: 3.5 },
    { ax: 80, ay: 52.0, bx: 80, by: 39.5, ra: 3.8, rb: 4.4 },
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
