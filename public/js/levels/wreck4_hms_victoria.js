import { createLevelTheme } from './themes.js';

/**
 * Shipwreck 4 (Campaign L20): HMS Victoria (Off Tripoli, Lebanon, Eastern Mediterranean)
 * The world's only vertical battleship wreck! Sunk in 1893, the Royal Navy flagship plunged bow-first
 * straight into the seabed — her twin bronze stern propellers stand upright in open blue water at 74m
 * while her armored decks plunge vertically down to the 145m seabed.
 * - Deep Hypoxic TMX 8/75 expedition dive (mod 165m)
 * - Drop from the charter boat to the vertical stern props at 74m
 * - Deploy 305m reel and descend straight down vertical stacked battleship decks, 6-inch casemate guns,
 *   the armored conning tower (120m), and the 110-ton twin gun turret buried in mud at 144m!
 */
export const WRECK_HMS_VICTORIA = {
  id: 'hms-victoria-battleship',
  name: 'HMS Victoria Vertical Wreck',
  category: 'wreck',
  isWreck: true,
  difficultyRank: 20,
  tier: 5,
  subtitle: 'Off Tripoli, Lebanon • 145m Vertical Battleship Shaft',
  description:
    'The most surreal deep shipwreck on Earth: an 1893 Royal Navy battleship standing 100% vertical, plunged nose-first into the Mediterranean seabed. Descend on TMX 8/75 onto her twin propellers pointing skyward at 74m, then drop straight down stacked armored decks and casemate batteries to the 144m twin gun turret.',
  badge: 'Vertical 145m',
  parTimeSec: 650,
  lined: false,
  reelMetersPerDiver: 305,
  roughness: 0.14,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 22.0,
  bounds: { xMin: -58, xMax: 112, yMin: -6, yMax: 154 },
  spawn: { x: 22.0, y: 2.0 },
  exitZone: { x: 22.0, y: 1.8, radius: 6.8, name: 'Tripoli Technical Support Boat' },
  haloclineY: 50.0,
  wreckDeckY: 74.0,
  wreckSeabedY: 145.0,
  wreckHullXMin: 4,
  wreckHullXMax: 44,
  hullTopY(wx) {
    // Dramatic vertical battleship tower standing nose-down out of the 145m flat seabed!
    if (wx >= 4 && wx <= 44) return 74.0 + Math.abs(wx - 24) * 0.12;
    const dist = wx < 4 ? 4 - wx : wx - 44;
    const t = Math.min(1, dist / 6.5);
    const ease = t * t * (3 - 2 * t);
    return 76.4 + (145.0 - 76.4) * ease;
  },
  shotLine: { x: 22.0, bottomY: 74.0 },
  theme: createLevelTheme('aegean-britannic-wreck'),

  gasOverrides: {
    TMX1455: {
      name: 'TMX 8/75',
      shortLabel: '8/75',
      role: 'Vertical Abyss (13–168m)',
      fO2: 0.08,
      fHe: 0.75,
      fN2: 0.17,
      tankVolumeL: 42.0,
      modM: 168.0,
      minM: 13.0,
    },
    EAN32: { tankVolumeL: 16.0 },
    O2: { tankVolumeL: 12.0 },
  },

  openBasins: [
    // Deep open Mediterranean water surrounding the entire vertical hull column down to 73.5m
    { kind: 'entry', xMin: -54, xMax: 108, rimHalf: 81, flareAdd: 0, lipTilt: 0, floorY: 73.5, sunAngle: 1.55 },
  ],

  driftCurrents: [
    { yMin: 18.0, yMax: 64.0, vx: 0.7, vy: 0, label: 'Levantine Current' },
  ],

  snagZones: [
    { x: 24.0, y: 102.0, radius: 2.2, label: 'Tangled Mast Rigging' },
    { x: 32.0, y: 131.0, radius: 2.2, label: 'Shattered Turret Chains' },
  ],

  wreckProps: [
    // Iconic twin stern bronze propellers pointing straight toward the surface at 74m!
    { kind: 'propeller', x: 13.0, y: 72.5, scale: 1.45, angle: 0.2 },
    { kind: 'propeller', x: 34.0, y: 72.5, scale: 1.45, angle: -0.35 },
    { kind: 'porthole', x: 10.0, y: 90.0, angle: 0.25, beamLen: 6.0 },
    { kind: 'porthole', x: 38.0, y: 112.0, angle: 2.85, beamLen: 6.0 },
    { kind: 'beam', x: 24.0, y: 88.0, len: 6.0, angle: 0 },
    { kind: 'beam', x: 24.0, y: 118.0, len: 6.4, angle: 0 },
    // Iconic 110-ton armored twin gun turret sticking horizontally from the vertical hull at 136m!
    { kind: 'turret', x: 44.0, y: 136.0, scale: 1.35, angle: -0.12 },
  ],

  segments: [
    // Vertical Stern Hatch Entry (71.5m -> 90m Aft Quarterdeck)
    { ax: 22, ay: 71.5, bx: 24, by: 90.0, ra: 4.2, rb: 3.6 },

    // Vertical Companionway Shaft + Port/Starboard 6-inch Casemate Galleries (90m -> 118m)
    { ax: 24, ay: 90.0, bx: 14, by: 104.0, ra: 3.3, rb: 3.0 },
    { ax: 24, ay: 90.0, bx: 35, by: 104.0, ra: 3.3, rb: 3.0 },
    { ax: 14, ay: 104.0, bx: 24, by: 118.0, ra: 3.0, rb: 3.6 },
    { ax: 35, ay: 104.0, bx: 24, by: 118.0, ra: 3.0, rb: 3.6 },

    // Armored Conning Tower & Lower Magazine Shaft (118m -> 144m Seabed Base)
    { ax: 24, ay: 118.0, bx: 16, by: 134.0, ra: 3.2, rb: 3.1 },
    { ax: 16, ay: 134.0, bx: 28, by: 144.0, ra: 3.2, rb: 4.0 },
    { ax: 28, ay: 144.0, bx: 38, by: 136.0, ra: 3.6, rb: 3.2 },
    { ax: 38, ay: 136.0, bx: 35, by: 104.0, ra: 2.8, rb: 2.9 },
  ],

  guideline: [],

  checkpoints: [
    { id: 'cp1', x: 22, y: 22.0, radius: 5.5, name: '22m Shot Line Buoy', hint: 'Switch to deep hypoxic TMX 8/75 [2] before dropping to the vertical stern!' },
    { id: 'cp2', x: 22, y: 74.0, radius: 5.5, name: '74m Twin Stern Propellers', hint: 'Anchor your 305m reel [G] and drop straight down the vertical hull!' },
    { id: 'cp3', x: 24, y: 118.0, radius: 4.8, name: 'Armored Conning Tower', hint: 'Thread past the casemate batteries to the 144m bow ram & gun turret.' },
    { id: 'cp4', x: 28, y: 144.0, radius: 5.0, name: '144m Gun Turret & Mud Base', hint: 'Deep turnaround! Ascend up the starboard shaft and respect deep deco.' },
    { id: 'cp5', x: 22, y: 22.0, radius: 5.8, name: '22m Ascent Switch Buoy', hint: 'Clear deep TMX deco stops, then switch to EAN32 [1] at 22m.' },
    { id: 'cp6', x: 22, y: 6.0, radius: 5.8, name: '6m O2 Deco Trapeze Bar', hint: 'Switch to O2 100% [3] beneath the boat to finish decompression.' },
  ],

  collectibles: [
    { id: 'vic_c1', x: 22, y: 74.0, kind: 'compass', name: 'Royal Navy Brass Binnacle', points: 460, scale: 1.1, radius: 1.5 },
    { id: 'vic_c2', x: 24, y: 90.0, kind: 'relic', name: 'Aft Quarterdeck Brass Bell', points: 500, scale: 1.12, radius: 1.5 },
    { id: 'vic_c3', x: 14, y: 104.0, kind: 'relic', name: '6-Inch Casemate Rangefinder', points: 540, scale: 1.15, radius: 1.5 },
    { id: 'vic_c4', x: 35, y: 104.0, kind: 'relic', name: 'Wardroom Brass Spyglass', points: 540, scale: 1.15, radius: 1.5 },
    { id: 'vic_c5', x: 16, y: 134.0, kind: 'relic', name: 'Conning Tower Armored Porthole', points: 620, scale: 1.25, radius: 1.5 },
    { id: 'vic_c6', x: 36, y: 136.5, kind: 'relic', name: '110-Ton Turret Builder Plaque', points: 780, scale: 1.4, radius: 1.5 },
  ],

  zoneLines: [
    { id: 'zone-switch', y: 22.0, xMin: 10, xMax: 36, color: '#fbbf24', title: '22m SHOT LINE SWITCH — TMX 8/75 [2]' },
    { id: 'zone-deco', y: 6.0, xMin: 10, xMax: 36, color: '#34d399', title: '6m O2 DECO TRAPEZE BAR — O2 100% [3]' },
  ],

  depthMarkers: [
    { x: 28, y: 6, label: '6m O2 BAR', color: '#34d399' },
    { x: 28, y: 22, label: '22m TMX 8/75', color: '#fbbf24' },
    { x: 40, y: 73, label: '74m TWIN PROPS', color: '#38bdf8' },
    { x: 38, y: 118, label: '118m CONNING TOWER', color: '#7dd3fc' },
    { x: 28, y: 146, label: '145m TURRET BASE', color: '#f87171' },
  ],
};
