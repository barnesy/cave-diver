import { createLevelTheme } from './themes.js';

/**
 * Level 9: Blue Hole & The Arch (Dahab, Red Sea, Egypt)
 * World-famous submarine Red Sea coral amphitheater & cathedral underwater arch.
 * Recognizable characteristics:
 * - Wide vertical submarine Blue Hole drop (0m -> 58m) framed against Sinai desert cliffs
 * - Iconic radiant cobalt "Arch" cathedral tunnel at 56m Depth illuminated from the outer reef sea-wall
 * - Outer Abyssal Red Sea Drop-Off to 84m before threading tight Bells Canyon chimneys back to surface
 * - NO fixed guideline! Divers manage a 205m reel spool, deep trimix bottom gas, and 8 blind grottos.
 */

export const LEVEL_9 = {
  id: 'blue-hole-dahab-arch',
  name: 'Blue Hole & The Arch',
  subtitle: 'Max Depth 84m · Red Sea Submarine Amphitheater · No Fixed Line',
  difficultyRank: 9,
  tier: 4,
  description:
    "Drop into Sinai's legendary cobalt submarine Blue Hole in the Red Sea. Navigate with NO fixed line using a 205m reel [G], pass beneath the glowing 56m Cathedral Arch, touch the 84m outer reef drop-off, and ascend through The Bells canyon.",
  bounds: {
    xMin: -48,
    xMax: 386,
    yMin: -6,
    yMax: 94,
  },
  roughness: 0.41,
  spawn: { x: 14, y: 2.0 },
  haloclineY: 34.0,
  parTimeSec: 325,
  reelMetersPerDiver: 205,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp5',
  ascentSwitchCheckpointId: 'cp7',
  ascentSwitchDepthM: 22.0,
  theme: createLevelTheme('dahab-red-sea'),
  archWindows: [
    // Luminous cobalt Red Sea light streaming downward/sideways inside The Arch cathedral tunnel
    { x: 142, y: 55.5, radiusX: 16.0, radiusY: 9.5 },
  ],
  openBasins: [
    // Dahab Blue Hole wide open marine coral amphitheater
    { kind: 'entry', xMin: 7, xMax: 22, rimHalf: 5.8, flareAdd: 2.6, lipTilt: 0.25, floorY: 2.6, sunAngle: 1.48 },
    // The Bells narrow Red Sea cliff chasm exit
    { kind: 'exit', xMin: 300, xMax: 312, rimHalf: 4.5, flareAdd: 2.2, lipTilt: -0.25, floorY: 2.5, sunAngle: 1.65 },
  ],
  segments: [
    // === BLUE HOLE CORAL WELL (0m -> 54m WIDE AMPHITHEATER PIT) ===
    { ax: 14, ay: 0.8, bx: 14, by: 20.0, ra: 5.8, rb: 4.8 },
    { ax: 14, ay: 20.0, bx: 28, by: 40.0, ra: 4.5, rb: 4.2 },
    { ax: 28, ay: 40.0, bx: 48, by: 54.0, ra: 4.2, rb: 4.0 },

    // === UPPER SADDLE GALLERY BYPASS (20m -> CP2 CORAL SADDLE -> REJOINS 54m) ===
    { ax: 14, ay: 20.0, bx: 48, by: 22.0, ra: 2.6, rb: 2.4 },
    { ax: 48, ay: 22.0, bx: 78, by: 28.5, ra: 2.4, rb: 2.1 },
    { ax: 78, ay: 28.5, bx: 88, by: 44.0, ra: 2.1, rb: 2.3 },
    { ax: 88, ay: 44.0, bx: 48, by: 54.0, ra: 2.3, rb: 3.4 },

    // === APPROACH SQUEEZE -> THE ARCH CATHEDRAL APERTURE (CP4 AT 56m) ===
    { ax: 48, ay: 54.0, bx: 88, by: 56.5, ra: 3.1, rb: 2.1 },
    { ax: 88, ay: 56.5, bx: 124, by: 56.0, ra: 2.1, rb: 4.4 },
    { ax: 124, ay: 56.0, bx: 160, by: 58.0, ra: 5.2, rb: 4.6 },

    // === OUTER SEA-WALL PLUNGE -> 84m DEEP SINAI REEF (CP5) ===
    { ax: 160, ay: 58.0, bx: 184, by: 72.0, ra: 3.2, rb: 2.6 },
    { ax: 184, ay: 72.0, bx: 202, by: 84.0, ra: 2.6, rb: 4.1 },
    // Alternate mid-wall coral tunnel to 84m
    { ax: 160, ay: 58.0, bx: 196, by: 62.5, ra: 2.4, rb: 2.0 },
    { ax: 196, ay: 62.5, bx: 214, by: 74.0, ra: 2.0, rb: 2.2 },
    { ax: 214, ay: 74.0, bx: 202, by: 84.0, ra: 2.2, rb: 3.8 },

    // === CP5 (84m TURNAROUND) -> BELLS CANYON LABYRINTH (CP6 AT 48m) -> CP7 (22m) ===
    { ax: 202, ay: 84.0, bx: 230, by: 68.0, ra: 3.0, rb: 2.2 },
    { ax: 230, ay: 68.0, bx: 244, by: 48.0, ra: 2.2, rb: 3.0 },
    { ax: 244, ay: 48.0, bx: 256, by: 34.0, ra: 2.3, rb: 1.48 },
    { ax: 256, ay: 34.0, bx: 266, by: 22.0, ra: 1.54, rb: 3.2 },
    // Alternate outer coral fissure climb
    { ax: 244, ay: 48.0, bx: 272, by: 41.0, ra: 2.1, rb: 1.9 },
    { ax: 272, ay: 41.0, bx: 266, by: 22.0, ra: 1.95, rb: 3.1 },

    // === CP7 -> CP8 BELLS 6m DECO CHASM & EXIT ===
    { ax: 266, ay: 22.0, bx: 286, by: 14.0, ra: 2.6, rb: 2.3 },
    { ax: 286, ay: 14.0, bx: 296, by: 6.4, ra: 2.5, rb: 4.1 },
    { ax: 296, ay: 6.4, bx: 306, by: 6.2, ra: 4.1, rb: 4.5 },
    { ax: 306, ay: 6.2, bx: 306, by: 0.8, ra: 4.7, rb: 4.5 },

    // === 8 BLIND RED SEA GROTTOS & DEAD ENDS ===
    // Dead End 1: High Western Saddle Coral Loft
    { ax: 48, ay: 22.0, bx: 58, by: 10.5, ra: 1.9, rb: 1.68 },
    { ax: 58, ay: 10.5, bx: 68, by: 12.0, ra: 1.68, rb: 2.5 },
    // Dead End 2: Deep West Amphitheater Blind Pit (64m)
    { ax: 48, ay: 54.0, bx: 30, by: 64.0, ra: 2.0, rb: 1.65 },
    { ax: 30, ay: 64.0, bx: 16, by: 61.5, ra: 1.65, rb: 2.8 },
    // Dead End 3: False Sea-Surface Chimney above The Arch Approach
    { ax: 88, ay: 56.5, bx: 94, by: 36.0, ra: 1.95, rb: 1.62 },
    { ax: 94, ay: 36.0, bx: 102, by: 26.0, ra: 1.62, rb: 2.6 },
    // Dead End 4: Upper Cathedral Gallery above The Arch
    { ax: 124, ay: 56.0, bx: 126, by: 37.0, ra: 2.1, rb: 1.72 },
    { ax: 126, ay: 37.0, bx: 136, by: 28.0, ra: 1.72, rb: 2.8 },
    // Dead End 5: Blind Sea-Fan Cave under The Arch (68m)
    { ax: 160, ay: 58.0, bx: 146, by: 71.0, ra: 1.95, rb: 1.56 },
    { ax: 146, ay: 71.0, bx: 130, by: 69.5, ra: 1.56, rb: 2.8 },
    // Dead End 6: Deepest 86m Sinai Abyssal Amphora Cavern
    { ax: 202, ay: 84.0, bx: 180, by: 86.0, ra: 2.0, rb: 1.6 },
    { ax: 180, ay: 86.0, bx: 166, by: 81.5, ra: 1.6, rb: 2.9 },
    // Dead End 7: East Gorgonian Grotto off Bells 48m Hub
    { ax: 244, ay: 48.0, bx: 274, by: 56.5, ra: 1.9, rb: 1.54 },
    { ax: 274, ay: 56.5, bx: 290, by: 52.0, ra: 1.54, rb: 2.7 },
    // Dead End 8: High Coastal Coral Pocket near Bells Exit
    { ax: 286, ay: 14.0, bx: 276, by: 6.2, ra: 1.85, rb: 1.6 },
    { ax: 276, ay: 6.2, bx: 266, by: 7.4, ra: 1.6, rb: 2.5 },
  ],
  guideline: [],
  checkpoints: [
    { id: 'cp1', name: 'Blue Hole Coral Wall', x: 14, y: 12.0, radius: 5.8, hint: 'Anchor your 205m reel [G]! Saddle bypass cuts right or plunge deep down the shaft.' },
    { id: 'cp2', name: 'Upper Saddle Reef', x: 14, y: 20.5, radius: 5.2, hint: 'Check TMX 14/55 readiness — saddle gallery cuts right or plunge straight to 54m.' },
    { id: 'cp3', name: '54m Blue Hole Floor', x: 48, y: 54.0, radius: 4.5, hint: 'Breathe TMX 14/55! Swim east into the approach corridor toward The Arch.' },
    { id: 'cp4', name: 'The Arch Cathedral (58m)', x: 160, y: 58.0, radius: 4.8, hint: 'Cobalt Red Sea light ahead! Drop carefully along the outer drop-off toward 84m.' },
    { id: 'cp5', name: '84m Sinai Abyssal Shelf', x: 202, y: 84.0, radius: 4.5, hint: 'Maximum depth 84m reached! Manage gas closely climbing up Bells Canyon.' },
    { id: 'cp6', name: 'Bells Canyon Hub', x: 244, y: 48.0, radius: 3.8, hint: 'Thread the narrow 1.48m coral chimney or east bypass toward the 22m stage shelf.' },
    { id: 'cp7', name: 'Bells Stage Switch', x: 266, y: 22.0, radius: 3.8, hint: 'Switch back to EAN32 above 26m and navigate into Bells Chasm.' },
    { id: 'cp8', name: 'Bells 6m Deco Chasm', x: 304.5, y: 5.8, radius: 6.5, hint: 'Switch to O2 100% and clear your entire decompression obligation before surfacing.' },
  ],
  collectibles: [
    { id: 'l9-coral-crown', name: 'Red Sea Acropora Relic', x: 78, y: 28.5, kind: 'fossil', points: 280, scale: 1.0 },
    { id: 'l9-hole-compass', name: 'Sunken Reef Brass Dial', x: 88, y: 56.5, kind: 'gear', points: 320, scale: 1.05 },
    { id: 'l9-arch-pearl', name: 'Cathedral Arch Pearl', x: 124, y: 56.0, kind: 'pearl', points: 380, scale: 1.2 },
    { id: 'l9-wall-shard', name: 'Sinai Drop-Off Quartz', x: 196, y: 62.5, kind: 'crystal', points: 390, scale: 1.15 },
    { id: 'l9-saddle-conch', name: 'Sinai Triton Shell', x: 67, y: 12.0, kind: 'fossil', points: 510, scale: 1.35 },
    { id: 'l9-pit-geode', name: '64m West Reef Geode', x: 17, y: 61.5, kind: 'crystal', points: 720, scale: 1.55 },
    { id: 'l9-false-chimney-orb', name: 'Coral Skylight Amber', x: 102, y: 26.2, kind: 'crystal', points: 640, scale: 1.48 },
    { id: 'l9-cathedral-crown', name: 'Upper Arch Golden Idol', x: 135, y: 28.2, kind: 'relic', points: 690, scale: 1.55 },
    { id: 'l9-under-arch-sextant', name: 'Expedition Brass Sextant', x: 131, y: 69.5, kind: 'gear', points: 860, scale: 1.68 },
    { id: 'l9-abyssal-amphora', name: '86m Red Sea Amphora', x: 167, y: 81.6, kind: 'relic', points: 1150, scale: 1.95 },
    { id: 'l9-gorgonian-chalice', name: 'Bells Fissure Coral Crown', x: 289, y: 52.2, kind: 'relic', points: 880, scale: 1.72 },
    { id: 'l9-bells-reel', name: 'Sinai Pioneer Survey Reel', x: 267, y: 7.3, kind: 'gear', points: 660, scale: 1.5 },
    { id: 'l9-cliff-pearl', name: 'Bells Reef Black Pearl', x: 272, y: 41.0, kind: 'pearl', points: 560, scale: 1.42 },
    { id: 'l9-shelf-quartz', name: 'Deep Reef Aragonite', x: 214, y: 74.0, kind: 'crystal', points: 610, scale: 1.48 },
  ],
  zoneLines: [
    { id: 'zone-tmx', title: 'SWITCH TO TMX 14/55 AT 30m (MOD 33.7m)', xMin: 10, xMax: 52, y: 33.7, color: '#c084fc' },
    { id: 'zone-ean32-up', title: 'ASCENT SWITCH -> EAN32 (22m)', xMin: 252, xMax: 280, y: 22.0, color: '#38bdf8' },
    { id: 'zone-deco', title: '6m DECO LINE · SWITCH TO O2 100%', xMin: 296, xMax: 311, y: 6.0, color: '#4ade80' },
  ],
  depthMarkers: [
    { y: 33.7, label: '33.7m EAN32 MOD -> TRIMIX 14/55', color: 'rgba(248, 113, 113, 0.72)' },
  ],
  exitZone: {
    name: 'The Bells Red Sea Exit',
    x: 306,
    y: 1.5,
    radius: 4.8,
  },
};
