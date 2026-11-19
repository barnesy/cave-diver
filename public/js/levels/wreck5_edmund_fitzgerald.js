import { createLevelTheme } from './themes.js';

/**
 * Shipwreck 5 (Campaign L23): SS Edmund Fitzgerald — 1995 Memorial Survey (Lake Superior)
 * Respectful historical documentation & memorial tribute honoring the 29 crew lost Nov 10, 1975
 * (the real wreck in Ontario waters is a strictly protected grave site).
 * - Ultra-deep frigid freshwater dive on hypoxic TMX 7/78 (162m seabed)
 * - Drop down the Whitefish Bay shot line to the Upright Bow & Open Pilot House (134m)
 * - Traverse the shattered midships taconite iron-ore debris trench (161m) to the Inverted Stern (148m)
 * - Document 5 memorial survey stations & return up the frigid shot line to the 6m O2 deco bar
 */
export const WRECK_EDMUND_FITZGERALD = {
  id: 'ss-edmund-fitzgerald',
  name: 'SS Edmund Fitzgerald Memorial',
  category: 'wreck',
  isWreck: true,
  difficultyRank: 23,
  tier: 5,
  subtitle: 'Lake Superior, Whitefish Bay • 162m 1995 Memorial Survey',
  description:
    'A solemn 1995 historical documentation tribute to the 29 lost crew of Lake Superior\'s legendary iron-ore freighter (strictly protected grave site in real life). Descend on TMX 7/78 into frigid 2°C freshwater, survey the upright bow and open pilot house at 136m, cross the 161m taconite debris trench to the inverted stern, and ascend through deep deco.',
  badge: 'Memorial 162m',
  parTimeSec: 720,
  lined: false,
  reelMetersPerDiver: 345,
  roughness: 0.15,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 23.0,
  bounds: { xMin: -66, xMax: 184, yMin: -6, yMax: 170 },
  spawn: { x: 16.0, y: 2.0 },
  exitZone: { x: 16.0, y: 1.8, radius: 6.8, name: 'Lake Superior Research Vessel' },
  haloclineY: 54.0,
  wreckDeckY: 134.0,
  wreckSeabedY: 162.0,
  wreckHullXMin: -28,
  wreckHullXMax: 152,
  hullTopY(wx) {
    // Two distinct hull halves separated by the catastrophic midships taconite trench!
    if (wx >= -24 && wx <= 48) return 134.0; // Upright Bow & Pilot House section
    if (wx > 48 && wx < 84) {
      // Midships break dropping down to the 161m taconite ore debris trench
      const u = Math.sin(((wx - 48) / 36) * Math.PI);
      return 136.0 + u * 23.0;
    }
    if (wx >= 84 && wx <= 148) return 142.0; // Inverted Stern section
    const dist = wx < -24 ? -24 - wx : wx - 148;
    const t = Math.min(1, dist / 8);
    const ease = t * t * (3 - 2 * t);
    const edgeY = wx < -24 ? 134.0 : 142.0;
    return edgeY + (162.0 - edgeY) * ease;
  },
  shotLine: { x: 16.0, bottomY: 134.0 },
  theme: createLevelTheme('superior-memorial-wreck'),

  gasOverrides: {
    TMX1455: {
      name: 'TMX 7/78',
      shortLabel: '7/78',
      role: 'Frigid Abyss (14–185m)',
      fO2: 0.07,
      fHe: 0.78,
      fN2: 0.15,
      tankVolumeL: 48.0,
      modM: 185.0,
      minM: 14.0,
    },
    EAN32: { tankVolumeL: 16.5 },
    O2: { tankVolumeL: 12.5 },
  },

  openBasins: [
    { kind: 'entry', xMin: -62, xMax: 180, rimHalf: 121, flareAdd: 0, lipTilt: 0, floorY: 133.5, sunAngle: 1.54 },
  ],

  driftCurrents: [
    { yMin: 16.0, yMax: 52.0, vx: -0.65, vy: 0, label: 'Superior Lake Seiche' },
  ],

  snagZones: [
    { x: 66.0, y: 157.0, radius: 2.5, label: 'Twisted Midships Hatch Coaming' },
    { x: 112.0, y: 152.0, radius: 2.3, label: 'Inverted Stern Cables' },
  ],

  wreckProps: [
    // Iconic upright Bow Pilot House & 1995 Replica Memorial Bell
    { kind: 'pilothouse', x: 8.0, y: 134.0, scale: 1.25 },
    { kind: 'porthole', x: -8.0, y: 143.0, angle: 0.5, beamLen: 5.5 },
    { kind: 'porthole', x: 34.0, y: 145.0, angle: 0.85, beamLen: 5.5 },
    { kind: 'beam', x: 66.0, y: 159.0, len: 6.4, angle: -0.22 },
    { kind: 'beam', x: 108.0, y: 154.0, len: 5.8, angle: 0.12 },
    // Inverted Stern Giant Freighter Propeller sticking upward into the dark lake
    { kind: 'propeller', x: 144.0, y: 141.0, scale: 1.55, angle: -0.25 },
  ],

  segments: [
    // Upright Bow Entry Hatch -> Forward Spar Deck & Cargo Hold #1 (131.5m -> 151m)
    { ax: 16, ay: 131.5, bx: 16, by: 147.0, ra: 4.2, rb: 3.6 },
    { ax: 16, ay: 147.0, bx: -12, by: 149.0, ra: 3.4, rb: 3.0 },
    { ax: 16, ay: 147.0, bx: 44, by: 152.0, ra: 3.5, rb: 3.8 },

    // Catastrophic Midships Break -> 161m Taconite Iron-Ore Debris Trench
    { ax: 44, ay: 152.0, bx: 66, by: 161.0, ra: 3.8, rb: 4.2 },
    { ax: 66, ay: 161.0, bx: 94, by: 158.0, ra: 4.2, rb: 3.8 },

    // Inverted Stern Hull Passage -> Engine Casing & Stern Propeller Ascent (158m -> 139.5m)
    { ax: 94, ay: 158.0, bx: 126, by: 154.0, ra: 3.6, rb: 3.4 },
    { ax: 126, ay: 154.0, bx: 136, by: 139.5, ra: 3.5, rb: 4.2 },
  ],

  guideline: [],

  checkpoints: [
    { id: 'cp1', x: 16, y: 23.0, radius: 5.5, name: '23m Shot Line Buoy', hint: 'Switch to hypoxic TMX 7/78 [2] for the 162m frigid freshwater descent.' },
    { id: 'cp2', x: 16, y: 134.0, radius: 5.4, name: 'Upright Bow & Pilot House', hint: 'Anchor your 345m survey reel [G] beside the open pilot house.' },
    { id: 'cp3', x: 66, y: 161.0, radius: 5.2, name: '161m Taconite Debris Trench', hint: 'Cross the shattered midships trench carefully toward the inverted stern.' },
    { id: 'cp4', x: 126, y: 154.0, radius: 5.2, name: 'Inverted Stern & Propeller', hint: 'Memorial turnaround complete! Exit above the stern back to the shot line.' },
    { id: 'cp5', x: 16, y: 23.0, radius: 5.8, name: '23m Ascent Switch Buoy', hint: 'Respect deep TMX deco stops, then switch back to EAN32 [1].' },
    { id: 'cp6', x: 16, y: 6.0, radius: 5.8, name: '6m O2 Deco Trapeze Bar', hint: 'Switch to O2 100% [3] beneath the research vessel to clear deco.' },
  ],

  collectibles: [
    { id: 'fitz_c1', x: 16, y: 132.5, kind: 'beacon', name: '1995 Replica Bell Tribute', points: 560, scale: 1.2, radius: 1.6 },
    { id: 'fitz_c2', x: -10, y: 149.0, kind: 'beacon', name: 'Forward Bow Anchor Survey', points: 520, scale: 1.1, radius: 1.5 },
    { id: 'fitz_c3', x: 42, y: 152.0, kind: 'beacon', name: 'Spar Deck Hatch #1 Scan', points: 540, scale: 1.15, radius: 1.5 },
    { id: 'fitz_c4', x: 66, y: 161.2, kind: 'beacon', name: 'Taconite Ore Trench Photo', points: 680, scale: 1.3, radius: 1.55 },
    { id: 'fitz_c5', x: 108, y: 156.0, kind: 'beacon', name: 'Stern Engine Casing Scan', points: 640, scale: 1.25, radius: 1.55 },
    { id: 'fitz_c6', x: 134, y: 142.0, kind: 'beacon', name: 'Inverted Stern Prop Survey', points: 780, scale: 1.4, radius: 1.55 },
  ],

  zoneLines: [
    { id: 'zone-switch', y: 23.0, xMin: 4, xMax: 30, color: '#fbbf24', title: '23m SHOT LINE SWITCH — TMX 7/78 [2]' },
    { id: 'zone-deco', y: 6.0, xMin: 4, xMax: 30, color: '#34d399', title: '6m O2 DECO TRAPEZE BAR — O2 100% [3]' },
  ],

  depthMarkers: [
    { x: 22, y: 6, label: '6m O2 BAR', color: '#34d399' },
    { x: 22, y: 23, label: '23m TMX 7/78', color: '#fbbf24' },
    { x: 26, y: 132, label: '134m UPRIGHT BOW', color: '#38bdf8' },
    { x: 66, y: 163, label: '162m DEBRIS TRENCH', color: '#f87171' },
    { x: 138, y: 139, label: '142m INVERTED STERN', color: '#7dd3fc' },
  ],
};
