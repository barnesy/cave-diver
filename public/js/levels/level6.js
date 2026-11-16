/**
 * Level 6: Orda Crystal Maze (Perm Krai, Russia)
 * Short-run, unlined 3-tier underwater gypsum labyrinth down to 54m.
 * Zero pre-laid fixed guideline: divers carry a limited 155m guideline reel spool
 * to tie off anchors across stacked galleries, intersecting loops, and 6 blind dead ends.
 */

export const LEVEL_6 = {
  id: 'orda-crystal-maze',
  name: 'Orda Crystal Maze',
  subtitle: 'Max Depth 54m · No Fixed Guideline · 3-Tier Gypsum Labyrinth',
  description:
    "Explore Russia's flooded gypsum labyrinth with NO fixed guideline. Use your 155m line reel [G] and rewind [R] to mark junctions across multi-level routes, avoid 6 blind dead ends, and surface via the karst resurgence.",
  bounds: {
    xMin: -44,
    xMax: 256,
    yMin: -6,
    yMax: 68,
  },
  roughness: 0.39,
  spawn: { x: 14, y: 2.0 },
  haloclineY: 5.0,
  parTimeSec: 210,
  reelMetersPerDiver: 155,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp3',
  ascentSwitchCheckpointId: 'cp4',
  ascentSwitchDepthM: 22.0,
  theme: {
    id: 'ural-gypsum-karst',
    rockTexture: '/assets/tex-limestone-wall.jpg',
    backTexture: '/assets/tex-cave-backwall.jpg',
    skyBackdrop: '/assets/sky-orda.jpg',
    skyTop: '#3e6e96',
    skyMid: '#aac7dc',
    skyGlow: '#f8fafc',
    skyHorizon: '#e2e8f0',
    waterSurface: '#7dd3fc',
    waterShallow: '#0284c7',
    waterMid: '#0f4c6b',
    waterDeep: '#09243d',
    waterAbyss: '#020712',
    haloclineLabel: 'Permian Sulfide Crystal Boundary',
    haloclineColor: 'rgba(186, 230, 253, 0.28)',
    mossTint: 'ural-gypsum',
    rockTint: [1.05, 1.03, 1.09],
    backTint: [0.64, 0.78, 0.88],
    surfaceStyle: 'ural-birch',
    sunbeamTop: 'rgba(240, 249, 255, 0.36)',
    sunbeamMid: 'rgba(56, 189, 248, 0.16)',
  },
  openBasins: [
    // Frosted Ural gypsum karst sinkhole entry pool
    { kind: 'entry', xMin: 8, xMax: 20, rimHalf: 4.8, flareAdd: 2.4, lipTilt: 0.3, floorY: 2.5, sunAngle: 1.45 },
    // East birch-lined karst resurgence spring exit
    { kind: 'exit', xMin: 190, xMax: 202, rimHalf: 4.9, flareAdd: 2.6, lipTilt: -0.3, floorY: 2.5, sunAngle: 1.66 },
  ],
  segments: [
    // === ENTRY SHAFT -> HUB 1 ===
    { ax: 14, ay: 0.8, bx: 14, by: 10.0, ra: 5.2, rb: 3.7 },
    { ax: 14, ay: 10.0, bx: 34, by: 15.0, ra: 3.7, rb: 3.5 },

    // === UPPER TIER PASSAGE (Hub 1 -> Hub 2) ===
    { ax: 34, ay: 15.0, bx: 62, by: 18.0, ra: 2.7, rb: 2.4 },
    { ax: 62, ay: 18.0, bx: 86, by: 21.5, ra: 2.4, rb: 2.7 },
    { ax: 86, ay: 21.5, bx: 94, by: 34.0, ra: 2.7, rb: 3.1 },

    // === LOWER TIER PASSAGE (Hub 1 -> Hub 2) ===
    { ax: 34, ay: 15.0, bx: 50, by: 29.5, ra: 3.0, rb: 2.9 },
    { ax: 50, ay: 29.5, bx: 72, by: 37.5, ra: 2.9, rb: 2.6 },
    { ax: 72, ay: 37.5, bx: 94, by: 34.0, ra: 2.7, rb: 3.4 },

    // === VERTICAL INTER-TIER CUT (Upper 18m <-> Lower 37.5m) ===
    { ax: 62, ay: 18.0, bx: 68, by: 28.0, ra: 2.2, rb: 2.1 },
    { ax: 68, ay: 28.0, bx: 72, by: 37.5, ra: 2.1, rb: 2.3 },

    // === HUB 2 -> 54m ABYSSAL HALL & MID-TIER CROSSCUT ===
    { ax: 94, ay: 34.0, bx: 112, by: 46.5, ra: 3.2, rb: 3.0 },
    { ax: 112, ay: 46.5, bx: 126, by: 54.0, ra: 3.0, rb: 3.6 },
    { ax: 94, ay: 34.0, bx: 116, by: 36.0, ra: 2.4, rb: 2.3 },
    { ax: 116, ay: 36.0, bx: 138, by: 38.0, ra: 2.3, rb: 2.7 },

    // === ASCENT OPTION A: CENTRAL CHIMNEY -> CP4 ===
    { ax: 126, ay: 54.0, bx: 138, by: 38.0, ra: 3.0, rb: 2.8 },
    { ax: 138, ay: 38.0, bx: 152, by: 22.0, ra: 2.8, rb: 3.1 },

    // === ASCENT OPTION B: EAST SIPHON LOOP -> CP4 ===
    { ax: 126, ay: 54.0, bx: 150, by: 51.0, ra: 3.1, rb: 2.6 },
    { ax: 150, ay: 51.0, bx: 164, by: 36.0, ra: 2.6, rb: 2.5 },
    { ax: 164, ay: 36.0, bx: 152, by: 22.0, ra: 2.5, rb: 3.0 },

    // === RESURGENCE EXIT CLIMB & 6m DECO GROTTO ===
    { ax: 152, ay: 22.0, bx: 174, by: 14.0, ra: 2.7, rb: 2.5 },
    { ax: 174, ay: 14.0, bx: 184, by: 6.4, ra: 2.7, rb: 4.2 },
    { ax: 184, ay: 6.4, bx: 196, by: 6.2, ra: 4.2, rb: 4.8 },
    { ax: 196, ay: 6.2, bx: 196, by: 0.8, ra: 5.0, rb: 4.9 },

    // === 6 UNLINED BLIND DEAD ENDS ===
    // Dead End 1: Upper Gypsum Loft off Hub 1
    { ax: 34, ay: 15.0, bx: 46, by: 8.8, ra: 2.2, rb: 2.0 },
    { ax: 46, ay: 8.8, bx: 56, by: 10.5, ra: 2.0, rb: 2.7 },

    // Dead End 2: Western Sulfur Cellar (Giant Geode)
    { ax: 50, ay: 29.5, bx: 36, by: 42.5, ra: 2.2, rb: 2.0 },
    { ax: 36, ay: 42.5, bx: 24, by: 46.5, ra: 2.0, rb: 2.9 },

    // Dead End 3: Central False Skylight Chimney
    { ax: 116, ay: 36.0, bx: 112, by: 20.0, ra: 2.1, rb: 2.0 },
    { ax: 112, ay: 20.0, bx: 105, by: 13.0, ra: 2.0, rb: 2.8 },

    // Dead End 4: Deep West Flooded Sump (59m)
    { ax: 126, ay: 54.0, bx: 108, by: 59.0, ra: 2.2, rb: 2.0 },
    { ax: 108, ay: 59.0, bx: 92, by: 56.0, ra: 2.0, rb: 2.9 },

    // Dead End 5: Abyssal East Blind Gallery (56.5m)
    { ax: 150, ay: 51.0, bx: 170, by: 56.5, ra: 2.2, rb: 2.0 },
    { ax: 170, ay: 56.5, bx: 184, by: 51.5, ra: 2.0, rb: 2.9 },

    // Dead End 6: East Selenite Pocket
    { ax: 164, ay: 36.0, bx: 180, by: 32.0, ra: 2.1, rb: 2.0 },
    { ax: 180, ay: 32.0, bx: 192, by: 26.0, ra: 2.0, rb: 2.7 },
  ],
  // NO fixed guideline! Divers deploy their own guideline reels with [G] and rewind with [R].
  guideline: [],
  checkpoints: [
    {
      id: 'cp1',
      name: 'Crystal Gateway Hub',
      x: 34,
      y: 15.0,
      radius: 3.4,
      hint: 'Upper, lower & loft branches split here. Press [G] to tie off your guideline reel!',
    },
    {
      id: 'cp2',
      name: 'Gypsum Crossroads',
      x: 94,
      y: 34.0,
      radius: 3.6,
      hint: 'Three tiers converge! Switch to TMX 14/55 before dropping into the 54m Crystal Vault.',
    },
    {
      id: 'cp3',
      name: 'Orda 54m Crystal Vault',
      x: 126,
      y: 54.0,
      radius: 3.8,
      hint: 'Deepest gypsum vault reached! Choose either climb chimney toward the 22m switch.',
    },
    {
      id: 'cp4',
      name: 'Alabaster Switch Vault',
      x: 152,
      y: 22.0,
      radius: 3.5,
      hint: 'Switch back to EAN32 above 26m and follow upper passage to the 6m Deco Grotto.',
    },
    {
      id: 'cp5',
      name: 'Orda 6m Deco Grotto',
      x: 190,
      y: 6.3,
      radius: 4.0,
      hint: 'Switch to O2 100% and clear your decompression ceiling before surfacing.',
    },
  ],
  collectibles: [
    { id: 'l6-selenite-pin', name: 'Selenite Needle', x: 64, y: 18.0, kind: 'crystal', points: 250, scale: 1.0 },
    { id: 'l6-canyon-fossil', name: 'Permian Coral', x: 70, y: 36.8, kind: 'fossil', points: 275, scale: 1.0 },
    { id: 'l6-vault-compass', name: 'Brass Expedition Reel', x: 118, y: 36.2, kind: 'gear', points: 300, scale: 1.05 },
    { id: 'l6-alabaster-shard', name: 'Alabaster Shard', x: 140, y: 36.8, kind: 'crystal', points: 325, scale: 1.05 },
    { id: 'l6-gypsum-rose', name: 'White Gypsum Rose', x: 55, y: 10.6, kind: 'crystal', points: 450, scale: 1.35 },
    { id: 'l6-giant-geode', name: 'Sulfur Crystal Geode', x: 25, y: 46.4, kind: 'crystal', points: 650, scale: 1.55 },
    { id: 'l6-frost-prism', name: 'Hollow Skylight Prism', x: 105, y: 13.5, kind: 'crystal', points: 575, scale: 1.48 },
    { id: 'l6-permian-cluster', name: 'Permian Crystal Crown', x: 93, y: 56.0, kind: 'relic', points: 750, scale: 1.65 },
    { id: 'l6-ural-idol', name: 'Deep Ural Stone Relic', x: 183, y: 51.6, kind: 'relic', points: 850, scale: 1.75 },
    { id: 'l6-selenite-orb', name: 'East Pocket Selenite Orb', x: 191, y: 26.2, kind: 'relic', points: 700, scale: 1.6 },
  ],
  zoneLines: [
    {
      id: 'zone-tmx',
      title: 'SWITCH TO TMX 14/55 AT 30m (MOD 33.7m)',
      xMin: 76,
      xMax: 118,
      y: 33.7,
      color: '#c084fc',
    },
    {
      id: 'zone-ean32-up',
      title: 'ASCENT SWITCH -> EAN32 (22m)',
      xMin: 140,
      xMax: 164,
      y: 22.0,
      color: '#38bdf8',
    },
    {
      id: 'zone-deco',
      title: '6m DECO LINE · SWITCH TO O2 100%',
      xMin: 184,
      xMax: 201,
      y: 6.0,
      color: '#4ade80',
    },
  ],
  depthMarkers: [
    { y: 33.7, label: '33.7m EAN32 MOD -> TRIMIX 14/55', color: 'rgba(248, 113, 113, 0.72)' },
  ],
  exitZone: {
    name: 'Orda Karst Resurgence',
    x: 196,
    y: 1.5,
    radius: 5.0,
  },
};
