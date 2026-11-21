import { createLevelTheme } from './themes.js';

/**
 * Shipwreck 8 (Tier II · Mediterranean RO-RO Ferry Wreck): MS Zenobia, Larnaca, Cyprus
 * Consistently voted one of the world's top 5 shipwreck dives! A massive 172m Swedish
 * roll-on/roll-off ferry capsized on her maiden voyage in 1980, resting on her port side
 * in electric-blue Mediterranean water (18m starboard hull -> 32m lorry car deck -> 48m seabed).
 */
export const WRECK_ZENOBIA = {
  id: 'ms-zenobia-ferry',
  name: 'MS Zenobia RO-RO Ferry Wreck',
  category: 'wreck',
  isWreck: true,
  difficultyRank: 5,
  tier: 2,
  subtitle: 'Larnaca Bay, Cyprus • 48m Capsized Ferry & Lorry Car Deck',
  description:
    'Descend the Mediterranean shot line onto the towering 18m starboard hull of the capsized Swedish ferry MS Zenobia. Penetrate the cavernous 32m upper vehicle deck lined with chained articulated lorries on EAN32, switch to TMX 14/55 to breach the 48m lower cargo hold and engine control room, and decompress under golden Cyprus sunbeams.',
  badge: 'Wreck 48m',
  parTimeSec: 295,
  lined: true,
  reelMetersPerDiver: 0,
  roughness: 0.14,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 22.0,
  bounds: { xMin: -46, xMax: 136, yMin: -6, yMax: 58 },
  spawn: { x: 12.0, y: 2.0 },
  exitZone: { x: 12.0, y: 1.8, radius: 6.8, name: 'Larnaca Dive Boat Stern Line' },
  haloclineY: 26.0,
  wreckDeckY: 22.0,
  wreckSeabedY: 50.0,
  wreckHullXMin: -26,
  wreckHullXMax: 108,
  shipProfile: 'zenobia-roro-ferry',
  hullTopY(wx) {
    // Sloped capsized superstructure with open stern ramp bay near x = 84..104
    if (wx >= 82 && wx <= 106) {
      return 27.5;
    }
    return 22.0 + Math.max(0, (wx + 20) * 0.03);
  },
  shotLine: { x: 12.0, bottomY: 22.0, decoStagesY: [18.0, 6.0] },
  theme: createLevelTheme('red-sea-coral-wreck'),

  openBasins: [
    { kind: 'entry', xMin: -42, xMax: 132, rimHalf: 88, flareAdd: 0, lipTilt: 0, floorY: 21.5, sunAngle: 1.48 },
  ],

  driftCurrents: [
    { yMin: 8.0, yMax: 24.0, vx: 0.45, vy: 0, label: 'Larnaca Bay Mediterranean Drift' },
  ],

  surgeZones: [
    { id: 'zen_surge1', x: 56.0, y: 34.0, radius: 4.2, vx: 2.4, vy: 1.2, periodSec: 8.2, phase: 0.3, label: 'Car-Deck Companionway Surge' },
  ],

  snagZones: [
    { id: 'zen_snag1', x: 38.0, y: 33.5, radius: 2.1, label: 'Snapped Lorry Lashing Chains' },
    { id: 'zen_snag2', x: 74.0, y: 45.0, radius: 2.0, label: 'Engine-Room Conduit Tangle' },
  ],

  watertightHatches: [
    { id: 'zen_hatch_bridge', x: -6.0, y: 33.0, radius: 1.9, label: 'Capsized Navigation Bridge', bonusPoints: 170 },
    { id: 'zen_hatch_engine', x: 88.0, y: 45.5, radius: 1.9, label: 'Lower Engine Control Room', bonusPoints: 190 },
  ],

  wreckProps: [
    { kind: 'anchor', x: -22.0, y: 22.0, chainLen: 22.0 },
    { kind: 'railing', x: -16.0, y: 22.0, len: 22.0 },
    { kind: 'railing', x: 46.0, y: 23.5, len: 28.0 },
    { kind: 'mast', x: 24.0, y: 23.0, scale: 0.96 },
    { kind: 'crane', x: 64.0, y: 24.0, scale: 1.0, angle: -0.22 },
    { kind: 'porthole', x: 4.0, y: 32.0, angle: 0.72, beamLen: 6.2 },
    { kind: 'porthole', x: 30.0, y: 32.5, angle: 0.82, beamLen: 6.0 },
    { kind: 'porthole', x: 68.0, y: 35.0, angle: 2.25, beamLen: 5.8 },
    { kind: 'beam', x: 20.0, y: 30.5, len: 6.0, angle: 0.04 },
    { kind: 'beam', x: 52.0, y: 31.0, len: 5.5, angle: -0.04 },
    { kind: 'pipe', x: 64.0, y: 45.5, len: 14.0, angle: 0.02 },
    { kind: 'propeller', x: 102.0, y: 42.5, scale: 1.35, angle: 0.18 },
  ],

  segments: [
    // Forward Starboard Entry Hatch (20m -> 33m Upper Car Deck)
    { ax: 12, ay: 19.5, bx: 12, by: 33.0, ra: 4.5, rb: 4.2 },
    // Capsized Bridge Wing beyond watertight hatch
    { ax: 12, ay: 33.0, bx: -16, by: 33.0, ra: 3.3, rb: 2.8 },
    // Main Upper Lorry Car Deck (33m)
    { ax: 12, ay: 33.0, bx: 56, by: 34.0, ra: 4.1, rb: 4.0 },
    // Midships Ramp Drop to Lower Vehicle Hold & Engine Flat (34m -> 47.5m)
    { ax: 56, ay: 34.0, bx: 60, by: 47.5, ra: 4.0, rb: 4.4 },
    // Lower Seabed Cargo Hold & Twin Screw Shaft Alley (47.5m -> 45.5m)
    { ax: 60, ay: 47.5, bx: 84, by: 46.0, ra: 4.0, rb: 3.5 },
    // Sealed Engine Control Room beyond aft hatch
    { ax: 84, ay: 46.0, bx: 98, by: 45.0, ra: 3.0, rb: 2.7 },
    // Stern Loading Ramp Exit back up to Open Mediterranean Water (46m -> 25m)
    { ax: 84, ay: 46.0, bx: 86, by: 25.0, ra: 3.8, rb: 4.6 },
  ],

  guideline: [
    { x: 12, y: 2.0 },
    { x: 12, y: 18.0 },
    { x: 12, y: 22.0 },
    { x: 12, y: 33.0 },
    { x: 56, y: 34.0 },
    { x: 60, y: 47.5 },
    { x: 84, y: 46.0 },
    { x: 86, y: 26.0 },
    { x: 48, y: 20.0 },
    { x: 12, y: 18.0 },
    { x: 12, y: 6.0 },
    { x: 12, y: 2.0 },
  ],

  checkpoints: [
    {
      id: 'cp1',
      name: 'Starboard Hull Entry (22m)',
      x: 12,
      y: 23.0,
      radius: 4.5,
      hint: 'Drop into the cavernous upper lorry deck on EAN32.',
    },
    {
      id: 'cp2',
      name: 'Upper Lorry Car Deck (33m)',
      x: 42,
      y: 33.5,
      radius: 4.2,
      hint: 'Watch for dangling truck chains — switch to TMX 14/55 before the lower ramp!',
    },
    {
      id: 'cp3',
      name: 'Lower Hold Ramp (42m)',
      x: 58,
      y: 41.5,
      radius: 3.8,
      expectedGas: 'TMX1455',
      hint: 'Descending into the 48m lower cargo deck on Trimix.',
    },
    {
      id: 'cp4',
      name: 'Seabed Cargo & Engine Alley (47m)',
      x: 74,
      y: 46.5,
      radius: 4.5,
      expectedGas: 'TMX1455',
      hint: 'Turnaround! Exit through the wide stern ramp and cruise back to the shot line.',
    },
    {
      id: 'cp5',
      name: 'Shot-Line Ascent Switch (18m)',
      x: 12,
      y: 18.0,
      radius: 5.0,
      expectedGas: 'EAN32',
      hint: 'Switch back to EAN32 on the shot line to avoid hypoxia.',
    },
    {
      id: 'cp6',
      name: 'Mediterranean Deco Bar (6m)',
      x: 12,
      y: 6.0,
      radius: 5.8,
      expectedGas: 'O2',
      hint: 'Hold 6m on O2 100% under the dive boat until deco clears!',
    },
  ],

  collectibles: [
    { id: 'zen-1', kind: 'artifact', name: 'Bridge Ship Telegraph', x: -12, y: 33.0, points: 260 },
    { id: 'zen-2', kind: 'artifact', name: 'Swedish Lorry Manifest', x: 30, y: 33.5, points: 210 },
    { id: 'zen-3', kind: 'artifact', name: 'Cafeteria Porcelain Plate', x: 56, y: 34.0, points: 220 },
    { id: 'zen-4', kind: 'artifact', name: 'Seabed Cargo Axle', x: 64, y: 47.0, points: 290 },
    { id: 'zen-5', kind: 'artifact', name: 'Chief Engineer Log', x: 94, y: 45.2, points: 340 },
    { id: 'zen-6', kind: 'artifact', name: 'Stern Ramp Bell', x: 85, y: 34.0, points: 250 },
  ],

  zoneLines: [
    { id: 'zen-deck', xMin: -20, xMax: 100, y: 22.0, title: 'STARBOARD HULL', subtitle: '22m Capsized Deck' },
    { id: 'zen-deco', xMin: 2, xMax: 24, y: 6.0, title: '6m DECO STAGE', subtitle: 'Hold on O2 100%' },
  ],

  depthMarkers: [
    { y: 6, label: '6m O2 DECO', color: '#4ade80' },
    { y: 22, label: '22m STARBOARD HULL', color: '#38bdf8' },
    { y: 34, label: '34m LORRY DECK', color: '#c084fc' },
    { y: 48, label: '48m SEABED HOLD', color: '#f59e0b' },
  ],
};
