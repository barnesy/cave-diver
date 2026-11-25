import { createLevelTheme } from './themes.js';

/**
 * Shipwreck 10 (Tier II · Scuttled WWI Imperial Dreadnought Battleship): SMS Markgraf — Scapa Flow, Scotland
 * Legendary 48m König-class battleship scuttled in June 1919 in Orkney's cold North Atlantic waters.
 * Lies inverted on the seabed with towering casemate corridors, 12-inch armored gun turrets,
 * crankable magazine bulkheads, and a hidden spectral citadel reachable only via active sonar.
 */
export const WRECK_MARKGRAF = {
  id: 'sms-markgraf-scapa-flow',
  name: 'SMS Markgraf — Scapa Flow',
  category: 'wreck',
  isWreck: true,
  difficultyRank: 14,
  tier: 2,
  subtitle: 'Orkney Islands, Scotland • 48m WWI Imperial Dreadnought Battleship',
  description:
    'Descend through cold, moody Orkney waters onto the massive inverted steel hull of WWI battleship SMS Markgraf. Penetrate the towering casemate galleries on TMX 14/55, crank open sealed armored magazine hatches past 12-inch gun turrets, and clear a disciplined 6m O2 deco stop on the Scapa Flow shot line.',
  badge: 'Dreadnought 48m',
  parTimeSec: 300,
  lined: true,
  reelMetersPerDiver: 0,
  roughness: 0.16,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 22.0,
  bounds: { xMin: -44, xMax: 295, yMin: -6, yMax: 66 },
  spawn: { x: 10.0, y: 2.0 },
  exitZone: { x: 10.0, y: 1.8, radius: 6.8, name: 'Scapa Flow North Sea Dive Vessel' },
  haloclineY: 22.0,
  wreckDeckY: 24.0,
  wreckSeabedY: 50.0,
  wreckHullXMin: -28,
  wreckHullXMax: 106,
  shipProfile: 'markgraf-dreadnought-wreck',
  hullTopY(wx) {
    if (wx >= 30 && wx <= 56) return 25.4;
    return 24.0;
  },
  shotLine: { x: 10.0, bottomY: 24.0, decoStagesY: [22.0, 6.0] },
  theme: createLevelTheme('north-sea-sub-wreck'),

  openBasins: [
    { kind: 'entry', xMin: -40, xMax: 120, rimHalf: 80, flareAdd: 0, lipTilt: 0, floorY: 23.5, sunAngle: 1.54 },
  ],

  driftCurrents: [
    { yMin: 5.0, yMax: 22.0, vx: 0.55, vy: 0, label: 'Orkney Tidal Race' },
  ],

  surgeZones: [
    { id: 'mkg_surge1', x: 42.0, y: 36.5, radius: 4.2, vx: 1.8, vy: 0.7, periodSec: 8.8, phase: 0.3, label: 'Armored Casemate Swell' },
  ],

  snagZones: [
    { id: 'mkg_snag1', x: 30.0, y: 36.8, radius: 2.0, label: 'Dreadnought Signal Halyard' },
  ],

  watertightHatches: [
    { id: 'mkg_hatch_bow', x: -6.0, y: 36.5, radius: 1.8, label: 'Forward 12-Inch Shell Room', bonusPoints: 185 },
    { id: 'mkg_hatch_aft', x: 86.0, y: 46.0, radius: 1.8, label: 'Armored Admiral Chart Vault', bonusPoints: 210 },
  ],

  wreckProps: [
    { kind: 'anchor', x: -22.0, y: 24.0, chainLen: 22.0 },
    { kind: 'turret', x: 24.0, y: 24.0, scale: 1.15 },
    { kind: 'turret', x: 64.0, y: 24.0, scale: 1.15 },
    { kind: 'mast', x: 44.0, y: 24.0, scale: 1.1 },
    { kind: 'railing', x: -12.0, y: 24.0, len: 20.0 },
    { kind: 'railing', x: 74.0, y: 24.0, len: 22.0 },
    { kind: 'porthole', x: 16.0, y: 34.0, angle: 0.7, beamLen: 5.5 },
    { kind: 'porthole', x: 50.0, y: 34.5, angle: 0.8, beamLen: 6.0 },
    { kind: 'beam', x: 36.0, y: 33.0, len: 6.4, angle: 0 },
    { kind: 'pipe', x: 62.0, y: 45.5, len: 14.0, angle: -0.03 },
    { kind: 'propeller', x: 102.0, y: 43.0, scale: 1.35, angle: 0.18 },
  ],

  segments: [
    // Forward Breach Drop into Armored Casemate Deck (22m -> 36.5m)
    { ax: 10, ay: 20.5, bx: 10, by: 36.5, ra: 4.5, rb: 4.2 },
    // Forward 12-Inch Magazine Chamber (behind watertight hatch!)
    { ax: 10, ay: 36.5, bx: -16, by: 36.5, ra: 3.2, rb: 2.9 },
    // Midships Dreadnought Casemate Battery Gallery (36.5m -> 37.5m)
    { ax: 10, ay: 36.5, bx: 52, by: 37.5, ra: 4.2, rb: 4.4 },
    // Breach Hatch Skylight up to Keel Deck
    { ax: 42, ay: 37.0, bx: 42, by: 23.2, ra: 3.8, rb: 4.4 },
    // Deep Boiler & Turbine Citadel Drop (37.5m -> 47.0m)
    { ax: 52, ay: 37.5, bx: 64, by: 47.0, ra: 4.0, rb: 4.4 },
    { ax: 64, ay: 47.0, bx: 82, by: 46.5, ra: 4.4, rb: 4.0 },
    // Sealed Admiral Chart Vault (behind watertight hatch!)
    { ax: 82, ay: 46.5, bx: 96, by: 46.0, ra: 3.2, rb: 2.8 },
    // Stern Propeller Escape Shaft back to 23m Hull Deck
    { ax: 82, ay: 46.5, bx: 82, by: 22.5, ra: 3.8, rb: 4.4 },

    // SECRET SONAR-ONLY ARMORED CITADEL VAULT (100% hidden until Sonar breaches false armor plate at x=98, y=46!)
    { ax: 86, ay: 46.5, bx: 122, by: 46.5, ra: 2.4, rb: 3.8, secretLair: true },
    { ax: 122, ay: 46.5, bx: 148, by: 46.5, ra: 5.4, rb: 4.4, secretLair: true }, // Armory chamber (x=134, y=46.5)
    { ax: 148, ay: 46.5, bx: 220, by: 46.0, ra: 4.5, rb: 4.8, secretLair: true }, // Gauntlet corridor
    { ax: 220, ay: 46.0, bx: 252, by: 45.5, ra: 14.5, rb: 15.5, secretLair: true }, // Massive Spectral Dreadnought Arena
    { ax: 252, ay: 45.5, bx: 278, by: 45.5, ra: 15.5, rb: 13.0, secretLair: true },
  ],

  guideline: [
    { x: 10, y: 2.0 },
    { x: 10, y: 24.0 },
    { x: 10, y: 36.5 },
    { x: 42, y: 37.0 },
    { x: 52, y: 37.5 },
    { x: 64, y: 47.0 },
    { x: 82, y: 46.5 },
    { x: 82, y: 23.0 },
    { x: 10, y: 22.0 },
    { x: 10, y: 6.0 },
  ],

  checkpoints: [
    { id: 'cp1', x: 10, y: 24.0, radius: 5.4, name: '24m Dreadnought Keel Breach', hint: 'Switch to TMX 14/55 [2] before penetrating the deep armored hull!' },
    { id: 'cp2', x: 42, y: 37.0, radius: 5.0, expectedGas: 'TMX1455', name: '37m Casemate Gun Gallery', hint: 'Glide past the 12-inch turret barbettes toward the boiler drop.' },
    { id: 'cp3', x: 64, y: 47.0, radius: 4.8, expectedGas: 'TMX1455', name: '47m Imperial Turbine Room', hint: 'Push aft to the sealed Admiral Chart Vault or prepare for ascent.' },
    { id: 'cp4', x: 82, y: 46.5, radius: 5.0, expectedGas: 'TMX1455', name: 'Aft Citadel Turnaround', hint: 'Turnaround reached! Ascend the stern shaft and follow the hull line west.' },
    { id: 'cp5', x: 10, y: 18.0, radius: 5.6, name: '18m Shot Line Ascent Switch', hint: 'Switch back to EAN32 [1] on the Scapa Flow shot line.' },
    { id: 'cp6', x: 10, y: 6.0, radius: 5.8, name: '6m Orkney O2 Deco Stop', hint: 'Switch to O2 100% [3] beneath the dive vessel to clear deco.' },
  ],

  collectibles: [
    { id: 'mkg_c1', name: 'Imperial Rangefinder Prism', x: 24, y: 22.2, kind: 'compass', points: 260, scale: 1.12 },
    { id: 'mkg_c2', name: '12-Inch Brass Fuse Cap', x: -13, y: 36.5, kind: 'relic', points: 520, scale: 1.42 },
    { id: 'mkg_c3', name: 'Casemate Porcelain Insignia Plate', x: 38, y: 37.2, kind: 'relic', points: 360, scale: 1.24 },
    { id: 'mkg_c4', name: 'Turbine Brass Revolution Counter', x: 64, y: 47.4, kind: 'gear', points: 420, scale: 1.3 },
    { id: 'mkg_c5', name: 'Scapa Flow Signal Lamp', x: 80, y: 34.0, kind: 'gear', points: 340, scale: 1.2 },
    { id: 'mkg_c6', name: 'SMS Markgraf Bronze Fleet Logbox', x: 93, y: 46.0, kind: 'relic', points: 680, scale: 1.56 },
  ],

  zoneLines: [
    { id: 'mkg-tmx', title: '22m · SWITCH TO TMX 14/55 [2]', xMin: -18, xMax: 96, y: 22.0, color: '#c084fc' },
    { id: 'mkg-floor', title: '48m SCAPA FLOW SEABED', xMin: 40, xMax: 102, y: 48.0, color: '#38bdf8' },
  ],
};
