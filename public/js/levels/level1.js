/**
 * Level 1: Cenote El Abismo
 * Twin-cenote technical cave traverse down to 50m with halocline, tight restriction,
 * deep sump turnaround, ascent chimney, and 6m decompression shelf.
 */

export const LEVEL_1 = {
  id: 'cenote-el-abismo',
  name: 'Cenote El Abismo',
  subtitle: 'Max Depth 50m · 3-Gas Trimix Traverse',
  bounds: {
    xMin: -12,
    xMax: 322,
    yMin: -6,
    yMax: 64,
  },
  roughness: 0.36,
  spawn: { x: 10, y: 2.2 },
  haloclineY: 25.5,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 22.0,
  openBasins: [
    { kind: 'entry', xMin: 4, xMax: 18, rimHalf: 5.8, flareAdd: 2.4, lipTilt: 0.55, floorY: 2.5, sunAngle: 1.41 }, // Cenote Alpha (Wide Karst Entry)
    { kind: 'exit', xMin: 138, xMax: 152, rimHalf: 4.5, flareAdd: 3.1, lipTilt: -0.45, floorY: 2.6, sunAngle: 1.71 }, // Cenote Beta (Undercut Skylight Exit)
  ],
  // Connected tapered tunnel segments (meters)
  segments: [
    // Cenote Alpha Entry Sinkhole Bowl
    { ax: 11, ay: 1.0, bx: 11, by: 8.8, ra: 7.4, rb: 6.2 },
    // Cavern slope to CP1 (Cavern Gate archway)
    { ax: 11, ay: 8.8, bx: 28, by: 12.5, ra: 5.5, rb: 4.1 },
    // Descent to CP2 (Halocline Drop)
    { ax: 28, ay: 12.5, bx: 52, by: 26.0, ra: 4.1, rb: 3.6 },
    // Approach to The Restriction
    { ax: 52, ay: 26.0, bx: 68, by: 36.5, ra: 3.6, rb: 2.3 },
    // CP3: The Restriction (tight limestone squeeze)
    { ax: 68, ay: 36.5, bx: 84, by: 39.0, ra: 2.1, rb: 2.0 },
    // Opening into Deep Sump Gallery
    { ax: 84, ay: 39.0, bx: 100, by: 48.0, ra: 2.3, rb: 4.3 },
    // CP4: Deep Sump Turnaround (50m floor)
    { ax: 100, ay: 48.0, bx: 128, by: 49.5, ra: 4.3, rb: 4.6 },
    // Chimney Base Turn
    { ax: 128, ay: 49.5, bx: 141, by: 43.0, ra: 4.2, rb: 3.4 },
    // Vertical Ascent Chimney
    { ax: 141, ay: 43.0, bx: 143, by: 25.0, ra: 3.3, rb: 3.1 },
    // Upper Chimney -> Deco Shelf Approach
    { ax: 143, ay: 25.0, bx: 132, by: 13.5, ra: 3.2, rb: 3.4 },
    // CP5: 6m Deco Shelf
    { ax: 132, ay: 13.5, bx: 126, by: 6.8, ra: 3.4, rb: 3.8 },
    { ax: 126, ay: 6.8, bx: 144, by: 6.6, ra: 3.9, rb: 5.2 },
    // Exit Cenote Beta Jug-Shaped Skylight Cavern
    { ax: 144, ay: 6.6, bx: 145, by: 0.6, ra: 5.8, rb: 5.2 },

    // === Secret Bottom-Level Tight-Squeeze Offshoot -> Long Gauntlet -> Sunken Sanctum Arena (v182) ===
    // Hidden behind a narrow false rock squeeze off the very bottom of the 50m Deep Sump (133.5, 50.4)
    { ax: 133.5, ay: 50.4, bx: 143.0, by: 49.8, ra: 1.45, rb: 1.85, secretLair: true },
    // Quiet Armory Anteroom (weapon waiting BEFORE any enemies)
    { ax: 143.0, ay: 49.8, bx: 156.5, by: 48.6, ra: 2.35, rb: 3.6, secretLair: true },
    // Chamber 1: Moray Trench
    { ax: 156.5, ay: 48.6, bx: 176.0, by: 47.0, ra: 3.5, rb: 3.3, secretLair: true },
    // Chamber 2: Bioluminescent Brine Grotto
    { ax: 176.0, ay: 47.0, bx: 196.5, by: 43.2, ra: 3.5, rb: 4.5, secretLair: true },
    // Chamber 3: Sunken Ossuary Bend
    { ax: 196.5, ay: 43.2, bx: 217.5, by: 46.8, ra: 4.2, rb: 3.9, secretLair: true },
    // Chamber 4: The Guardian Gate (Armored Stalkers)
    { ax: 217.5, ay: 46.8, bx: 238.5, by: 43.5, ra: 4.0, rb: 4.8, secretLair: true },
    // Grand Sanctum Archway
    { ax: 238.5, ay: 43.5, bx: 252.0, by: 40.5, ra: 4.8, rb: 8.4, secretLair: true },
    // THE SUNKEN SANCTUM — Massive ~58m wide x 26m tall dynamically lit underwater boss cathedral
    { ax: 252.0, ay: 40.5, bx: 268.0, by: 40.5, ra: 9.6, rb: 13.0, secretLair: true },
    { ax: 268.0, ay: 40.5, bx: 288.0, by: 40.5, ra: 13.0, rb: 13.0, secretLair: true },
    { ax: 288.0, ay: 40.5, bx: 302.5, by: 40.2, ra: 11.8, rb: 8.6, secretLair: true },
  ],
  // Taut main guideline (gold/white line with line arrows)
  guideline: [
    { x: 11, y: 3.5 },
    { x: 14, y: 9.0 },
    { x: 28, y: 12.5 },
    { x: 42, y: 20.0 },
    { x: 52, y: 26.0 },
    { x: 68, y: 36.5 },
    { x: 84, y: 39.0 },
    { x: 100, y: 48.0 },
    { x: 114, y: 49.2 },
    { x: 128, y: 49.5 },
    { x: 141, y: 43.0 },
    { x: 143, y: 25.0 },
    { x: 132, y: 13.5 },
    { x: 127, y: 6.8 },
    { x: 143, y: 6.5 },
    { x: 145, y: 2.0 },
  ],
  checkpoints: [
    {
      id: 'cp1',
      name: 'Cavern Gate',
      x: 28,
      y: 12.5,
      radius: 3.6,
      hint: 'Entering overhead environment. Stay on EAN32 (MOD 33m).',
    },
    {
      id: 'cp2',
      name: 'Halocline Drop',
      x: 52,
      y: 26.0,
      radius: 3.5,
      hint: 'Switch to TMX 14/55 before descending below 30m!',
    },
    {
      id: 'cp3',
      name: 'The Restriction',
      x: 76,
      y: 37.8,
      radius: 2.8,
      hint: 'Tight squeeze — smooth finning prevents silt-out.',
    },
    {
      id: 'cp4',
      name: 'Deep Sump (50m)',
      x: 114,
      y: 49.0,
      radius: 4.0,
      expectedGas: 'TMX1455',
      hint: 'Turnaround! Ascend slowly (<10 m/min) up the chimney.',
    },
    {
      id: 'cp5',
      name: 'Chimney Switch (22m)',
      x: 140.5,
      y: 22.0,
      radius: 4.0,
      expectedGas: 'EAN32',
      hint: 'Switch to EAN32 for ascent — avoids hypoxia near surface!',
    },
    {
      id: 'cp6',
      name: 'Deco Shelf (6m)',
      x: 138,
      y: 6.7,
      radius: 5.5,
      expectedGas: 'O2',
      hint: 'Hold 5–6m on O2 100% until DECO STOP clears, then surface!',
    },
  ],
  zoneLines: [
    {
      id: 'zone-halocline',
      xMin: 46,
      xMax: 58,
      y: 26.0,
      color: '#c084fc',
      title: '26m · GAS SWITCH LINE (EAN32 → TMX 14/55)',
    },
    {
      id: 'zone-chimney',
      xMin: 136,
      xMax: 146,
      y: 22.0,
      color: '#38bdf8',
      title: '22m · ASCENT SWITCH LINE (TMX 14/55 → EAN32)',
    },
    {
      id: 'zone-deco',
      xMin: 127,
      xMax: 148,
      y: 6.0,
      color: '#4ade80',
      title: '6m · DECO STOP LINE (HOLD ON O2 100%)',
    },
  ],
  depthMarkers: [
    { y: 33.7, label: '33.7m · EAN32 MOD (O2 TOX BELOW)', color: 'rgba(248, 113, 113, 0.35)' },
  ],
  parTimeSec: 145,
  collectibles: [
    { id: 'l1-jade', name: 'Maya Jade Pendant', kind: 'relic', points: 300, x: 20.5, y: 8.6 },
    { id: 'l1-reel', name: 'Lost Survey Reel', kind: 'survey', points: 175, x: 39.5, y: 21.8 },
    { id: 'l1-geode', name: 'Blue Calcite Geode', kind: 'crystal', points: 225, x: 59.5, y: 29.5 },
    { id: 'l1-obsidian', name: 'Obsidian Offering Mask', kind: 'relic', points: 350, x: 96.0, y: 47.2 },
    { id: 'l1-ammonite', name: 'Fossil Nautilus', kind: 'fossil', points: 250, x: 114.5, y: 46.2 },
    { id: 'l1-gypsum', name: 'Gypsum Crystal Spear', kind: 'crystal', points: 225, x: 131.5, y: 46.2 },
    { id: 'l1-amber', name: 'Submerged Copal Amber', kind: 'relic', points: 275, x: 134.5, y: 12.2 },
    { id: 'l1-lantern', name: 'Expedition Brass Tag', kind: 'survey', points: 175, x: 129.0, y: 5.2 },
  ],
  exitZone: {
    name: 'Cenote Beta Surface',
    x: 145,
    y: 1.5,
    radius: 4.8,
  },
};
