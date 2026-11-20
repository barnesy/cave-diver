import { createLevelTheme } from './themes.js';

/**
 * Shipwreck 7 (Campaign Rank 9 · Tier III): U-1206 North Sea Submarine (Off Cruden Bay, Scotland)
 * Authentic WWII Type VIIC German U-Boat resting in 88m of cold, current-swept North Sea water.
 * - Sleek submarine pressure-hull silhouette with conning tower, twin periscopes & dive hydroplanes
 * - Claustrophobic bow-to-stern interior compartment traverse featuring 3 crankable watertight
 *   submarine bulkhead doors!
 * - First submarine wreck & first British Isles / North Sea expedition in the campaign.
 */
export const WRECK_U1206 = {
  id: 'u1206-north-sea-sub',
  name: 'U-1206 North Sea U-Boat',
  category: 'wreck',
  isWreck: true,
  difficultyRank: 9,
  tier: 3,
  subtitle: 'Off Cruden Bay, Scotland • 88m WWII Type VIIC Submarine',
  description:
    'Descend through cold North Sea currents onto the sleek pressure hull of WWII Type VIIC submarine U-1206. Drop through the 54m conning tower hatch, crank open sealed submarine bulkheads from bow torpedo tubes to diesel engine room at 88m, and clear deco on the Scottish shot line.',
  badge: 'U-Boat 88m',
  parTimeSec: 420,
  lined: true,
  reelMetersPerDiver: 0,
  roughness: 0.13,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 22.0,
  bounds: { xMin: -50, xMax: 120, yMin: -6, yMax: 96 },
  spawn: { x: 34.0, y: 2.0 },
  exitZone: { x: 34.0, y: 1.8, radius: 6.8, name: 'Aberdeen Technical Dive Vessel' },
  haloclineY: 38.0,
  wreckDeckY: 64.0,
  wreckSeabedY: 88.0,
  wreckHullXMin: -24,
  wreckHullXMax: 94,
  shipProfile: 'u1206-submarine',
  hullTopY(wx) {
    // Raised Type VIIC conning tower saddle around x=26..42; tapered submarine hull crest at 64m
    if (wx >= 26 && wx <= 42) return 58.0;
    const mid = 35;
    const norm = Math.min(1, Math.abs(wx - mid) / 62);
    return 64.0 + norm * norm * 6.5;
  },
  shotLine: { x: 34.0, bottomY: 58.0, decoStagesY: [36.0, 22.0, 6.0] },
  theme: createLevelTheme('north-sea-sub-wreck'),

  gasOverrides: {
    TMX1455: {
      name: 'TMX 12/60',
      shortLabel: '12/60',
      role: 'North Sea Deep (18–112m)',
      fO2: 0.12,
      fHe: 0.60,
      fN2: 0.28,
      tankVolumeL: 34.0,
      modM: 112.0,
      minM: 6.0,
    },
    EAN32: { tankVolumeL: 15.0 },
    O2: { tankVolumeL: 11.0 },
  },

  openBasins: [
    { kind: 'entry', xMin: -46, xMax: 116, rimHalf: 81, flareAdd: 0, lipTilt: 0, floorY: 57.5, sunAngle: 1.56 },
  ],

  driftCurrents: [
    { yMin: 10.0, yMax: 48.0, vx: -0.92, vy: 0, label: 'North Sea Tidal Drift' },
  ],

  surgeZones: [
    { id: 'u12_surge1', x: 34.0, y: 63.0, radius: 3.8, vx: 0, vy: 3.2, periodSec: 7.2, phase: 0.4, label: 'Conning Tower Hatch Swell' },
    { id: 'u12_surge2', x: 64.0, y: 81.5, radius: 4.0, vx: -3.0, vy: 0.8, periodSec: 6.8, phase: 2.0, label: 'Stern Scour Trench Surge' },
  ],

  snagZones: [
    { id: 'u12_snag1', x: 14.0, y: 72.0, radius: 2.1, label: 'Snagged North Sea Trawl Net' },
    { id: 'u12_snag2', x: 56.0, y: 73.0, radius: 2.1, label: 'Diesel Room Tangled Cables' },
  ],

  watertightHatches: [
    { id: 'u12_hatch_bow', x: -2.0, y: 72.0, radius: 1.8, label: 'Bow Torpedo Room Bulkhead', bonusPoints: 180 },
    { id: 'u12_hatch_bilge', x: 34.0, y: 80.5, radius: 1.8, label: 'Lower Battery Bilge Hatch', bonusPoints: 180 },
    { id: 'u12_hatch_cipher', x: 74.0, y: 73.0, radius: 1.8, label: 'Stern Cipher & Radio Vault', bonusPoints: 200 },
  ],

  wreckProps: [
    { kind: 'conning-tower', x: 34.0, y: 63.0, scale: 1.2 },
    { kind: 'anchor', x: -19.0, y: 69.0, chainLen: 18.0 },
    { kind: 'railing', x: -8.0, y: 66.0, len: 24.0 },
    { kind: 'railing', x: 46.0, y: 66.0, len: 24.0 },
    { kind: 'porthole', x: 18.0, y: 70.5, angle: 0.65, beamLen: 5.5 },
    { kind: 'porthole', x: 52.0, y: 71.0, angle: 2.45, beamLen: 5.5 },
    { kind: 'pipe', x: 48.0, y: 71.5, len: 14.0, angle: 0.02 },
    { kind: 'beam', x: 22.0, y: 70.0, len: 4.8, angle: 0 },
    { kind: 'beam', x: 56.0, y: 70.2, len: 5.0, angle: 0.03 },
    { kind: 'propeller', x: 92.0, y: 75.5, scale: 1.2, angle: 0.4 },
  ],

  segments: [
    // Conning Tower Vertical Entry Hatch (56.5m -> 72m Control Room)
    { ax: 34, ay: 56.5, bx: 34, by: 72.5, ra: 4.0, rb: 3.6 },

    // Forward Pressure Hull: Control Room -> Officers' Quarters -> Bow Torpedo Room (72m)
    { ax: 34, ay: 72.5, bx: 6, by: 72.0, ra: 3.4, rb: 3.0 },
    // Bow Torpedo Compartment beyond watertight hatch at x=-2
    { ax: 6, ay: 72.0, bx: -16, by: 72.5, ra: 2.8, rb: 2.6 },

    // Aft Pressure Hull: Control Room -> Diesel Engine Room -> Stern Cipher Vault (73m)
    { ax: 34, ay: 72.5, bx: 66, by: 73.0, ra: 3.4, rb: 3.2 },
    // Stern Cipher & Radio Vault beyond watertight hatch at x=74
    { ax: 66, ay: 73.0, bx: 84, by: 73.5, ra: 2.8, rb: 2.6 },

    // Lower Battery Bilge Shortcut Drop (guarded by watertight hatch at y=80.5)
    { ax: 34, ay: 72.5, bx: 34, by: 85.5, ra: 2.6, rb: 2.9 },

    // Deep Seabed Hull-Breach & Scour Trench Loop (86m-88m)
    { ax: 6, ay: 72.0, bx: 12, by: 85.5, ra: 2.8, rb: 3.0 },
    { ax: 12, ay: 85.5, bx: 44, by: 87.5, ra: 3.2, rb: 3.5 },
    { ax: 44, ay: 87.5, bx: 68, by: 84.0, ra: 3.4, rb: 3.2 },
    { ax: 68, ay: 84.0, bx: 66, by: 73.0, ra: 3.0, rb: 3.2 },

    // Aft Escape Hatch Ascent back up to open water (73m -> 58m)
    { ax: 66, ay: 73.0, bx: 66, by: 58.0, ra: 3.3, rb: 4.2 },
  ],

  guideline: [
    { x: 34, y: 2.0 },
    { x: 34, y: 22.0 },
    { x: 34, y: 58.0 },
    { x: 34, y: 72.5 },
    { x: 6, y: 72.0 },
    { x: 12, y: 85.5 },
    { x: 44, y: 87.5 },
    { x: 68, y: 84.0 },
    { x: 66, y: 73.0 },
    { x: 66, y: 58.0 },
    { x: 34, y: 55.0 },
    { x: 34, y: 22.0 },
    { x: 34, y: 6.0 },
  ],

  checkpoints: [
    { id: 'cp1', x: 34, y: 22.0, radius: 5.5, name: '22m Shot Line Buoy', hint: 'Switch to TMX 12/60 [2] before dropping through the North Sea current!' },
    { id: 'cp2', x: 34, y: 58.0, radius: 5.2, name: '58m Conning Tower Hatch', hint: 'Drop straight down the armored conning tower into the 72m Control Room.' },
    { id: 'cp3', x: 6, y: 72.0, radius: 4.5, name: 'Forward Control & Torpedo Bulkhead', hint: 'Unseal the bow torpedo door for relics, then drop into the 88m scour trench.' },
    { id: 'cp4', x: 44, y: 87.5, radius: 4.8, name: '88m Keel Scour Trench', hint: 'Deepest turnaround! Loop into the diesel room and ascend the aft escape hatch.' },
    { id: 'cp5', x: 34, y: 22.0, radius: 5.8, name: '22m Ascent Switch Buoy', hint: 'Switch back to EAN32 [1] on the shot line and hold a calm 9 m/min ascent.' },
    { id: 'cp6', x: 34, y: 6.0, radius: 5.8, name: '6m O2 Deco Trapeze Bar', hint: 'Switch to O2 100% [3] beneath the Aberdeen dive boat to clear deco.' },
  ],

  collectibles: [
    { id: 'u12_c1', x: 34, y: 54.0, kind: 'compass', name: 'Attack Periscope Brass Prism', points: 320, scale: 1.05, radius: 1.5 },
    { id: 'u12_c2', x: -14, y: 72.5, kind: 'relic', name: 'G7e Torpedo Brass Calculator', points: 540, scale: 1.35, radius: 1.5 },
    { id: 'u12_c3', x: 22, y: 72.2, kind: 'gear', name: 'Papenberg Brass Depth Gauge', points: 360, scale: 1.1, radius: 1.45 },
    { id: 'u12_c4', x: 44, y: 87.2, kind: 'relic', name: 'Keel High-Pressure Valve Wheel', points: 480, scale: 1.25, radius: 1.5 },
    { id: 'u12_c5', x: 54, y: 73.0, kind: 'gear', name: 'MAN Diesel Engine Telegraph', points: 380, scale: 1.15, radius: 1.45 },
    { id: 'u12_c6', x: 82, y: 73.5, kind: 'relic', name: 'Kriegsmarine Enigma Rotor', points: 680, scale: 1.5, radius: 1.5 },
    { id: 'u12_c7', x: 14, y: 85.2, kind: 'beacon', name: 'Submarine Hydrophone Receiver', points: 420, scale: 1.2, radius: 1.5 },
  ],

  zoneLines: [
    { id: 'zone-switch', y: 22.0, xMin: 22, xMax: 46, color: '#fbbf24', title: '22m SHOT LINE SWITCH — TMX 12/60 [2]' },
    { id: 'zone-deco', y: 6.0, xMin: 22, xMax: 46, color: '#34d399', title: '6m O2 DECO TRAPEZE BAR — O2 100% [3]' },
  ],

  depthMarkers: [
    { x: 40, y: 6, label: '6m O2 BAR', color: '#34d399' },
    { x: 40, y: 22, label: '22m TMX 12/60', color: '#fbbf24' },
    { x: 48, y: 58, label: '58m CONNING TOWER', color: '#38bdf8' },
    { x: 20, y: 72, label: '72m PRESSURE HULL', color: '#7dd3fc' },
    { x: 44, y: 89, label: '88m KEEL TRENCH', color: '#f87171' },
  ],
};
