/**
 * Level 3: Plura Marble Sump (Rana, Nordland, Norway)
 * Europe's iconic sub-arctic glacial marble siphon traverse:
 * Glacial meltwater sinkhole -> Marble Crossroads -> 4 blind dead-end siphons ->
 * 48m Silt Squeeze -> Steinugle 66m Abyss -> Fault Labyrinth -> 6m Fjord Resurgence.
 */

export const LEVEL_3 = {
  id: 'plura-marble-sump',
  name: 'Plura Marble Sump',
  subtitle: 'Max Depth 66m · Sub-Arctic Marble Labyrinth & Blind Siphons',
  description:
    "Navigate Norway's glacial marble labyrinth down to 66m. The main gold guideline marks the true route while four unlined dead-end siphons conceal giant Arctic crystals and fossils.",
  bounds: {
    xMin: -44,
    xMax: 380,
    yMin: -6,
    yMax: 76,
  },
  roughness: 0.40,
  spawn: { x: 14, y: 2.0 },
  haloclineY: 4.0,
  turnaroundCheckpointId: 'cp5',
  ascentSwitchCheckpointId: 'cp7',
  ascentSwitchDepthM: 22.0,
  theme: {
    id: 'nordic-marble',
    rockTexture: '/assets/tex-limestone-wall.jpg',
    backTexture: '/assets/tex-cave-backwall.jpg',
    skyBackdrop: '/assets/sky-norway.jpg',
    skyTop: '#33658a',
    skyMid: '#94b8d0',
    skyGlow: '#e2e8f0',
    skyHorizon: '#cbd5e1',
    waterSurface: '#38bdf8',
    waterShallow: '#0e7490',
    waterMid: '#134e5e',
    waterDeep: '#092234',
    waterAbyss: '#02060f',
    haloclineLabel: 'Glacial Meltwater Thermocline',
    haloclineColor: 'rgba(125, 211, 252, 0.25)',
    mossTint: 'glacial-marble',
    rockTint: [0.88, 0.96, 1.07],
    backTint: [0.64, 0.78, 0.94],
    surfaceStyle: 'nordic-fjord',
    sunbeamTop: 'rgba(224, 242, 254, 0.34)',
    sunbeamMid: 'rgba(45, 212, 191, 0.14)',
  },
  openBasins: [
    // Ice-carved Jordbrua glacial meltwater entry sinkhole
    { kind: 'entry', xMin: 8, xMax: 20, rimHalf: 4.8, flareAdd: 2.5, lipTilt: 0.35, floorY: 2.5, sunAngle: 1.44 },
    // Broad Plura river marble resurgence weir exit
    { kind: 'exit', xMin: 315, xMax: 329, rimHalf: 5.0, flareAdd: 2.7, lipTilt: -0.35, floorY: 2.6, sunAngle: 1.66 },
  ],
  segments: [
    // === MAIN ROUTE (Guideline follows segments 1..16) ===
    // 1. Entry Fjord Sinkhole Funnel
    { ax: 14, ay: 0.8, bx: 14, by: 9.0, ra: 5.4, rb: 3.6 },
    // 2. Diagonal Marble Entry Arch -> CP1
    { ax: 14, ay: 9.0, bx: 36, by: 16.5, ra: 3.8, rb: 3.5 },
    // 3. Marble Crossroads Chamber (Branch 1 forks down-left here!) -> CP2
    { ax: 36, ay: 16.5, bx: 60, by: 24.5, ra: 3.5, rb: 3.8 },
    // 4. Phreatic Plunge past 33.7m EAN32 MOD -> CP3
    { ax: 60, ay: 24.5, bx: 82, by: 36.0, ra: 3.6, rb: 3.1 },
    // 5. Descending Striated Marble Rift
    { ax: 82, ay: 36.0, bx: 108, by: 48.5, ra: 3.2, rb: 3.8 },
    // 6. Tight Steinugle Silt Squeeze -> CP4
    { ax: 108, ay: 48.5, bx: 126, by: 46.0, ra: 2.3, rb: 2.05 },
    // 7. Deep Borehole Junction Vault (Branch 2 forks down-left here!)
    { ax: 126, ay: 46.0, bx: 144, by: 52.0, ra: 2.5, rb: 4.0 },
    // 8. Plunge into Steinugle 66m Abyss
    { ax: 144, ay: 52.0, bx: 156, by: 64.5, ra: 3.8, rb: 4.2 },
    // 9. 66m Abyss Floor Traverse -> Turnaround CP5
    { ax: 156, ay: 64.5, bx: 178, by: 65.5, ra: 4.2, rb: 3.9 },
    // 10. Steep Marble Chimney Climb (Branch 3 forks up-left at 42m!)
    { ax: 178, ay: 65.5, bx: 196, by: 42.0, ra: 3.6, rb: 3.3 },
    // 11. Undulating Fjord Marble Conduit -> CP6 (Branch 4 forks deep at 36.5m!)
    { ax: 196, ay: 42.0, bx: 226, by: 36.5, ra: 3.3, rb: 3.5 },
    // 12. Long Marble Labyrinth Switchback Dip
    { ax: 226, ay: 36.5, bx: 256, by: 41.0, ra: 2.8, rb: 3.1 },
    // 13. Glacial Chimney Climb to 22m Ascent Switch -> CP7
    { ax: 256, ay: 41.0, bx: 274, by: 22.0, ra: 3.2, rb: 3.1 },
    // 14. Narrow Upper Frost Squeeze
    { ax: 274, ay: 22.0, bx: 298, by: 14.5, ra: 2.4, rb: 2.2 },
    // 15. Step-up into 6m Fjord Deco Sanctuary
    { ax: 298, ay: 14.5, bx: 308, by: 6.4, ra: 2.8, rb: 4.4 },
    // 16. Horizontal 6m Deco Gallery -> CP8
    { ax: 308, ay: 6.4, bx: 322, by: 6.2, ra: 4.4, rb: 5.0 },
    // 17. Resurgence Weir Skylight Exit
    { ax: 322, ay: 6.2, bx: 322, by: 0.6, ra: 5.2, rb: 5.0 },

    // === UNLINED DEAD-END BRANCH ROUTES ===
    // Dead End A: Frost Pocket off Marble Crossroads (24.5m -> 34m cul-de-sac)
    { ax: 60, ay: 24.5, bx: 45, by: 36.5, ra: 2.4, rb: 1.9 },
    { ax: 45, ay: 36.5, bx: 34, by: 34.0, ra: 1.9, rb: 2.9 },

    // Dead End B: The Blind Borehole off Deep Vault (52m -> 63m sealed sump)
    { ax: 144, ay: 52.0, bx: 122, by: 62.5, ra: 2.4, rb: 1.9 },
    { ax: 122, ay: 62.5, bx: 102, by: 63.0, ra: 1.9, rb: 3.1 },

    // Dead End C: Twin Chimney False Skylight (42m -> 16.5m sealed dome ceiling)
    { ax: 196, ay: 42.0, bx: 186, by: 28.0, ra: 2.3, rb: 2.0 },
    { ax: 186, ay: 28.0, bx: 176, by: 16.5, ra: 2.0, rb: 3.2 },

    // Dead End D: East Fault Cul-de-Sac (36.5m -> 58m deep squeeze pocket)
    { ax: 226, ay: 36.5, bx: 238, by: 52.0, ra: 2.3, rb: 1.85 },
    { ax: 238, ay: 52.0, bx: 254, by: 58.0, ra: 1.85, rb: 2.9 },
  ],
  // Main gold guideline strictly follows the true exit route (no lines down dead ends)
  guideline: [
    { x: 14, y: 2.8 },
    { x: 14, y: 9.0 },
    { x: 36, y: 16.5 },
    { x: 60, y: 24.5 },
    { x: 82, y: 36.0 },
    { x: 108, y: 48.5 },
    { x: 126, y: 46.0 },
    { x: 144, y: 52.0 },
    { x: 156, y: 64.5 },
    { x: 168, y: 65.1 },
    { x: 178, y: 65.5 },
    { x: 196, y: 42.0 },
    { x: 226, y: 36.5 },
    { x: 256, y: 41.0 },
    { x: 274, y: 22.0 },
    { x: 298, y: 14.5 },
    { x: 308, y: 6.4 },
    { x: 322, y: 6.2 },
    { x: 322, y: 2.0 },
  ],
  checkpoints: [
    {
      id: 'cp1',
      name: 'Jordbrua Marble Arch',
      x: 36,
      y: 16.5,
      radius: 3.5,
      hint: 'Inside icy striated marble. Stay on EAN32 past the first bends.',
    },
    {
      id: 'cp2',
      name: 'Marble Crossroads',
      x: 60,
      y: 24.5,
      radius: 3.8,
      hint: 'Unlined blind pocket forks down-left! Stay on gold line or explore carefully.',
    },
    {
      id: 'cp3',
      name: 'Fault Dropoff (36m)',
      x: 82,
      y: 36.0,
      radius: 3.3,
      expectedGas: 'TMX1455',
      hint: 'Switch to TMX 14/55 — entering 48–66m Trimix zone!',
    },
    {
      id: 'cp4',
      name: 'Steinugle Silt Squeeze',
      x: 117,
      y: 47.2,
      radius: 2.6,
      expectedGas: 'TMX1455',
      hint: 'Hold flat frog-kick trim through the 2m marble slot.',
    },
    {
      id: 'cp5',
      name: 'Steinugle Abyss (66m)',
      x: 168,
      y: 65.0,
      radius: 4.1,
      expectedGas: 'TMX1455',
      hint: '66m turnaround! Watch gas pressure and ascend up the East Marble Chimney.',
    },
    {
      id: 'cp6',
      name: 'Fault Labyrinth',
      x: 226,
      y: 36.5,
      radius: 3.6,
      expectedGas: 'TMX1455',
      hint: 'Junction ahead — keep climbing left-up along the gold arrows toward 22m.',
    },
    {
      id: 'cp7',
      name: 'Glacial Chimney (22m)',
      x: 274,
      y: 22.0,
      radius: 3.6,
      expectedGas: 'EAN32',
      hint: 'Switch back to EAN32 on the climb — prevent hypoxia before 6m deco!',
    },
    {
      id: 'cp8',
      name: 'Fjord Deco Bench (6m)',
      x: 315,
      y: 6.3,
      radius: 5.2,
      expectedGas: 'O2',
      hint: 'Hold 6m on O2 100% until DECO STOP clears, then surface at Plura weir!',
    },
  ],
  zoneLines: [
    {
      id: 'zone-thermocline',
      xMin: 8,
      xMax: 20,
      y: 4.0,
      color: '#38bdf8',
      title: '4.0m · GLACIAL MELTWATER THERMOCLINE',
    },
    {
      id: 'zone-dropoff',
      xMin: 74,
      xMax: 88,
      y: 33.7,
      color: '#c084fc',
      title: '33.7m · GAS SWITCH LINE (EAN32 → TMX 14/55)',
    },
    {
      id: 'zone-chimney',
      xMin: 267,
      xMax: 281,
      y: 22.0,
      color: '#38bdf8',
      title: '22m · ASCENT SWITCH LINE (TMX 14/55 → EAN32)',
    },
    {
      id: 'zone-deco',
      xMin: 306,
      xMax: 326,
      y: 6.0,
      color: '#4ade80',
      title: '6m · DECO STOP LINE (HOLD ON O2 100%)',
    },
  ],
  depthMarkers: [
    { y: 33.7, label: '33.7m · EAN32 MOD (O2 TOX BELOW)', color: 'rgba(248, 113, 113, 0.35)' },
    { y: 65.5, label: '65.5m · STEINUGLE ABYSS FLOOR (WATCH SAC)', color: 'rgba(125, 211, 252, 0.35)' },
  ],
  parTimeSec: 265,
  collectibles: [
    // Smaller/medium main-line finds
    { id: 'l3-probe', name: 'Glacial Pitot Probe', kind: 'survey', scale: 0.85, points: 175, x: 25.0, y: 12.2 },
    { id: 'l3-spar', name: 'Pale Marble Spar Shard', kind: 'crystal', scale: 0.92, points: 225, x: 96.0, y: 42.5 },
    { id: 'l3-slate', name: 'Nordic Trilobite Trace', kind: 'fossil', scale: 0.95, points: 250, x: 150.0, y: 58.0 },
    { id: 'l3-spool', name: 'Deep Line Survey Cookie', kind: 'survey', scale: 0.88, points: 200, x: 187.0, y: 53.5 },
    { id: 'l3-pearl', name: 'Fjord Cave Pearl Cluster', kind: 'crystal', scale: 1.0, points: 275, x: 286.0, y: 18.2 },
    { id: 'l3-tag', name: 'Rana Expedition Brass Tag', kind: 'survey', scale: 0.85, points: 200, x: 314.0, y: 6.2 },
    // Largest rare collectibles deep inside unlined dead-end siphons
    { id: 'l3-frost-crown', name: 'Giant Arctic Calcite Crown', kind: 'crystal', scale: 1.48, points: 525, x: 34.2, y: 34.0 },
    { id: 'l3-runic-monolith', name: 'Abyssal Runic Quartz Monolith', kind: 'relic', scale: 1.62, points: 625, x: 102.0, y: 63.0 },
    { id: 'l3-ammonite-slab', name: 'Giant Nordic Ammonite Slab', kind: 'fossil', scale: 1.48, points: 550, x: 176.2, y: 16.5 },
    { id: 'l3-pyrite-heart', name: 'Colossal Marble Pyrite Heart', kind: 'crystal', scale: 1.55, points: 575, x: 254.0, y: 58.0 },
  ],
  exitZone: {
    name: 'Plura Weir Surface',
    x: 322,
    y: 1.5,
    radius: 5.0,
  },
};
