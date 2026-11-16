import { createLevelTheme } from './themes.js';

/**
 * Level 7: Dan's Cave (Great Abaco Island, Bahamas)
 * Deep multi-tier crystal & aragonite labyrinth down to 69m with ZERO default guideline.
 * Tighter restrictions (down to 1.54m radius), strong halocline transition at 16.5m,
 * longer 316m footprint, 7 blind dead ends, and a strict 170m reel budget per diver.
 */

export const LEVEL_7 = {
  id: 'dans-cave-abaco',
  name: "Dan's Cave",
  subtitle: 'Max Depth 69m · No Fixed Guideline · Bahamian Aragonite Labyrinth',
  difficultyRank: 7,
  tier: 4,
  description:
    "Navigate Great Abaco's razor-tight Bahamian crystal passages down to 69m with NO fixed guideline. Deploy your 170m reel [G], manage TMX 14/55 past the 16.5m halocline, clear tight crystal squeezes without spiking your HR, and escape 7 blind dead ends.",
  bounds: {
    xMin: -46,
    xMax: 316,
    yMin: -6,
    yMax: 78,
  },
  roughness: 0.42,
  spawn: { x: 14, y: 2.0 },
  haloclineY: 16.5,
  parTimeSec: 255,
  reelMetersPerDiver: 170,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 22.0,
  theme: createLevelTheme('abaco-crystal'),
  openBasins: [
    // Emerald Abaco inland pine-forest sinkhole entry
    { kind: 'entry', xMin: 8, xMax: 20, rimHalf: 4.9, flareAdd: 2.5, lipTilt: 0.35, floorY: 2.4, sunAngle: 1.44 },
    // East Bahamian tidal resurgence sinkhole exit
    { kind: 'exit', xMin: 248, xMax: 260, rimHalf: 5.0, flareAdd: 2.6, lipTilt: -0.35, floorY: 2.4, sunAngle: 1.66 },
  ],
  segments: [
    // === INLAND PINE SINKHOLE ENTRY -> CP1 ARAGONITE MOUTH ===
    { ax: 14, ay: 0.8, bx: 14, by: 10.5, ra: 5.1, rb: 3.6 },
    { ax: 14, ay: 10.5, bx: 36, by: 16.5, ra: 3.6, rb: 3.2 },

    // === UPPER CRYSTAL GALLERY (CP1 -> CP2 CHANDELIER VAULT) ===
    { ax: 36, ay: 16.5, bx: 62, by: 20.5, ra: 2.3, rb: 1.75 },
    { ax: 62, ay: 20.5, bx: 88, by: 27.5, ra: 1.75, rb: 3.1 },

    // === LOWER HALOCLINE CONDUIT (CP1 -> CP2) ===
    { ax: 36, ay: 16.5, bx: 52, by: 31.5, ra: 2.7, rb: 2.2 },
    { ax: 52, ay: 31.5, bx: 74, by: 36.0, ra: 2.2, rb: 1.95 },
    { ax: 74, ay: 36.0, bx: 88, by: 27.5, ra: 2.0, rb: 3.1 },

    // === INTER-TIER WINDOW (Upper 20.5m <-> Lower 36.0m) ===
    { ax: 62, ay: 20.5, bx: 69, by: 29.0, ra: 1.72, rb: 1.72 },
    { ax: 69, ay: 29.0, bx: 74, by: 36.0, ra: 1.72, rb: 1.9 },

    // === CP2 -> TIGHT HALOCLINE SQUEEZE (CP3 AT 46m) ===
    { ax: 88, ay: 27.5, bx: 108, by: 37.5, ra: 2.7, rb: 1.68 },
    { ax: 108, ay: 37.5, bx: 126, by: 46.0, ra: 1.68, rb: 3.0 },

    // === CP3 -> DEEP 69m ABACO RIFT (CP4) ===
    // Route A: Direct steep fissure (tight restriction 1.60m -> 69m pit)
    { ax: 126, ay: 46.0, bx: 142, by: 58.0, ra: 2.4, rb: 1.62 },
    { ax: 142, ay: 58.0, bx: 158, by: 69.0, ra: 1.68, rb: 3.7 },
    // Route B: Mid-depth Crystal Shelf bypass (50m level before plunge)
    { ax: 126, ay: 46.0, bx: 150, by: 49.5, ra: 2.3, rb: 2.1 },
    { ax: 150, ay: 49.5, bx: 168, by: 57.5, ra: 2.1, rb: 2.2 },
    { ax: 168, ay: 57.5, bx: 158, by: 69.0, ra: 2.2, rb: 3.6 },

    // === CP4 (69m TURNAROUND) -> ASCENT TO CP5 CORAL CATHEDRAL (22m) ===
    // West steep chimney
    { ax: 158, ay: 69.0, bx: 180, by: 51.0, ra: 3.0, rb: 2.2 },
    { ax: 180, ay: 51.0, bx: 196, by: 35.5, ra: 2.2, rb: 2.4 },
    { ax: 196, ay: 35.5, bx: 206, by: 22.0, ra: 2.4, rb: 3.2 },
    // East wider gallery climb
    { ax: 180, ay: 51.0, bx: 208, by: 48.0, ra: 2.2, rb: 2.0 },
    { ax: 208, ay: 48.0, bx: 220, by: 33.5, ra: 2.0, rb: 1.88 },
    { ax: 220, ay: 33.5, bx: 206, by: 22.0, ra: 1.9, rb: 3.1 },

    // === CP5 (22m) -> CP6 6m DECO GROTTO & EAST RESURGENCE EXIT ===
    { ax: 206, ay: 22.0, bx: 228, by: 14.5, ra: 2.7, rb: 2.4 },
    { ax: 228, ay: 14.5, bx: 242, by: 6.4, ra: 2.6, rb: 4.3 },
    { ax: 242, ay: 6.4, bx: 254, by: 6.2, ra: 4.3, rb: 4.8 },
    { ax: 254, ay: 6.2, bx: 254, by: 0.8, ra: 5.0, rb: 4.9 },

    // === 7 UNLINED BLIND DEAD ENDS (RISKIER CRYSTALLINE POCKETS) ===
    // Dead End 1: Upper Coral Chimney above CP1
    { ax: 36, ay: 16.5, bx: 44, by: 8.5, ra: 2.0, rb: 1.75 },
    { ax: 44, ay: 8.5, bx: 53, by: 10.0, ra: 1.75, rb: 2.6 },

    // Dead End 2: West Aragonite Cellar off Lower Halocline Conduit
    { ax: 52, ay: 31.5, bx: 36, by: 45.0, ra: 2.0, rb: 1.72 },
    { ax: 36, ay: 45.0, bx: 22, by: 49.0, ra: 1.72, rb: 2.8 },

    // Dead End 3: False Emerald Skylight Dome off CP2
    { ax: 88, ay: 27.5, bx: 94, by: 14.0, ra: 1.85, rb: 1.7 },
    { ax: 94, ay: 14.0, bx: 102, by: 10.5, ra: 1.7, rb: 2.7 },

    // Dead End 4: Razor Squeeze Blind Sump under CP3 (59m)
    { ax: 126, ay: 46.0, bx: 112, by: 58.0, ra: 1.9, rb: 1.56 },
    { ax: 112, ay: 58.0, bx: 98, by: 56.5, ra: 1.56, rb: 2.8 },

    // Dead End 5: Abyssal Deep South Pit off 69m Rift (71m bottom!)
    { ax: 158, ay: 69.0, bx: 138, by: 71.5, ra: 2.0, rb: 1.65 },
    { ax: 138, ay: 71.5, bx: 122, by: 67.5, ra: 1.65, rb: 2.9 },

    // Dead End 6: East Crystal Alcove off 48m gallery
    { ax: 208, ay: 48.0, bx: 230, by: 54.0, ra: 1.95, rb: 1.62 },
    { ax: 230, ay: 54.0, bx: 244, by: 49.0, ra: 1.62, rb: 2.8 },

    // Dead End 7: High False Resurgence Chimney near Exit
    { ax: 228, ay: 14.5, bx: 218, by: 6.5, ra: 1.85, rb: 1.68 },
    { ax: 218, ay: 6.5, bx: 208, by: 7.5, ra: 1.68, rb: 2.6 },
  ],
  // NO fixed guideline! Divers must deploy, terminate, and selectively rewind their 170m reel.
  guideline: [],
  checkpoints: [
    {
      id: 'cp1',
      name: 'Aragonite Halocline Mouth',
      x: 36,
      y: 16.5,
      radius: 3.3,
      hint: 'Shimmery Abaco halocline split! Tie your first reel anchor [G] before entering the maze.',
    },
    {
      id: 'cp2',
      name: 'Chandelier Crystal Vault',
      x: 88,
      y: 27.5,
      radius: 3.4,
      hint: 'Switch to TMX 14/55 soon — approaching tight 37m squeeze & abyssal fissures.',
    },
    {
      id: 'cp3',
      name: 'Hall of Glass Squeeze',
      x: 126,
      y: 46.0,
      radius: 3.5,
      hint: 'Breathe TMX 14/55! Avoid bumping fragile crystal ceilings during the plunge to 69m.',
    },
    {
      id: 'cp4',
      name: 'Deep Abaco 69m Rift',
      x: 158,
      y: 69.0,
      radius: 3.9,
      hint: 'Bottom 69m reached! Manage gas closely and follow your reel line up the eastern chimneys.',
    },
    {
      id: 'cp5',
      name: 'Coral Cathedral Switch',
      x: 206,
      y: 22.0,
      radius: 3.4,
      hint: 'Switch up to EAN32 above 26m and navigate toward the 6m East Mangrove Deco Grotto.',
    },
    {
      id: 'cp6',
      name: 'Abaco 6m Deco Sanctuary',
      x: 248,
      y: 6.3,
      radius: 4.0,
      hint: 'Switch to O2 100% at 6m and clear your full decompression obligation.',
    },
  ],
  collectibles: [
    { id: 'l7-sea-fan', name: 'Fossilized Gorgonian Fan', x: 62, y: 20.5, kind: 'fossil', points: 250, scale: 1.0 },
    { id: 'l7-needle-cluster', name: 'Aragonite Needle Spray', x: 69, y: 29.0, kind: 'crystal', points: 300, scale: 1.05 },
    { id: 'l7-halocline-lens', name: 'Crystal Cavern Compass', x: 150, y: 49.5, kind: 'gear', points: 325, scale: 1.1 },
    { id: 'l7-cathedral-shard', name: 'Cathedral Calcite Blade', x: 196, y: 35.5, kind: 'crystal', points: 350, scale: 1.12 },
    { id: 'l7-chimney-pearl', name: 'Upper Chimney Cave Pearl', x: 52, y: 10.0, kind: 'pearl', points: 480, scale: 1.35 },
    { id: 'l7-west-conch', name: 'Ice-Age Lucayan Conch', x: 23, y: 48.8, kind: 'fossil', points: 680, scale: 1.55 },
    { id: 'l7-false-dome-ruby', name: 'Emerald Dome Quartz', x: 101, y: 10.8, kind: 'crystal', points: 590, scale: 1.48 },
    { id: 'l7-glass-sump-crown', name: 'Squeeze-Vault Crystal Crown', x: 99, y: 56.6, kind: 'relic', points: 820, scale: 1.68 },
    { id: 'l7-abyssal-trident', name: '71m Rift Lucayan Idol', x: 123, y: 67.6, kind: 'relic', points: 980, scale: 1.85 },
    { id: 'l7-east-alcove-geode', name: 'Bahamian Amber Geode', x: 243, y: 49.2, kind: 'crystal', points: 790, scale: 1.65 },
    { id: 'l7-false-exit-spool', name: 'Pioneer Brass Survey Reel', x: 209, y: 7.4, kind: 'gear', points: 620, scale: 1.48 },
    { id: 'l7-deep-rift-cluster', name: 'Abaco Sovereign Crystal', x: 170, y: 57.5, kind: 'crystal', points: 520, scale: 1.4 },
  ],
  zoneLines: [
    {
      id: 'zone-tmx',
      title: 'SWITCH TO TMX 14/55 AT 30m (MOD 33.7m)',
      xMin: 82,
      xMax: 122,
      y: 33.7,
      color: '#c084fc',
    },
    {
      id: 'zone-ean32-up',
      title: 'ASCENT SWITCH -> EAN32 (22m)',
      xMin: 194,
      xMax: 222,
      y: 22.0,
      color: '#38bdf8',
    },
    {
      id: 'zone-deco',
      title: '6m DECO LINE · SWITCH TO O2 100%',
      xMin: 242,
      xMax: 259,
      y: 6.0,
      color: '#4ade80',
    },
  ],
  depthMarkers: [
    { y: 33.7, label: '33.7m EAN32 MOD -> TRIMIX 14/55', color: 'rgba(248, 113, 113, 0.72)' },
  ],
  exitZone: {
    name: 'Abaco Tidal Sink',
    x: 254,
    y: 1.5,
    radius: 5.0,
  },
};
