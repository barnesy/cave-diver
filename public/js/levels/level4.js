/**
 * Level 4: Fontaine de Vaucluse (Vaucluse, Provence, France)
 * Cradle of world technical cave diving — longer phreatic labyrinth plunging to 74m
 * with five deceptive dead-end chutes harboring colossal hidden relics.
 */

export const LEVEL_4 = {
  id: 'fontaine-de-vaucluse',
  name: 'Fontaine de Vaucluse',
  subtitle: 'Max Depth 74m · Provençal Phreatic Maze & 5 Blind Spurs',
  description:
    "Conquer France's legendary abyssal resurgence down to 74m. Thread braided phreatic galleries along the main gold guideline, probe five perilous dead ends for colossal relics, and clear multi-gas deco.",
  bounds: {
    xMin: -44,
    xMax: 452,
    yMin: -6,
    yMax: 84,
  },
  roughness: 0.44,
  spawn: { x: 14, y: 2.0 },
  haloclineY: 9.5,
  turnaroundCheckpointId: 'cp6',
  ascentSwitchCheckpointId: 'cp8',
  ascentSwitchDepthM: 22.0,
  theme: {
    id: 'provence-gorge',
    rockTexture: '/assets/tex-limestone-wall.jpg',
    backTexture: '/assets/tex-cave-backwall.jpg',
    skyBackdrop: '/assets/sky-provence.jpg',
    skyTop: '#4a6fa5',
    skyMid: '#d6c6b8',
    skyGlow: '#fef3c7',
    skyHorizon: '#f5d0a9',
    waterSurface: '#60a5fa',
    waterShallow: '#0284c7',
    waterMid: '#1e40af',
    waterDeep: '#0f172a',
    waterAbyss: '#02040a',
    haloclineLabel: 'Carbonate Mineral Clarity Interface',
    haloclineColor: 'rgba(167, 139, 250, 0.22)',
    mossTint: 'provence-ivory',
    rockTint: [1.10, 1.04, 0.92],
    backTint: [0.74, 0.78, 0.96],
    surfaceStyle: 'provence-gorge',
    sunbeamTop: 'rgba(254, 243, 199, 0.36)',
    sunbeamMid: 'rgba(96, 165, 250, 0.16)',
  },
  openBasins: [
    // Deep sunlit Vaucluse cliff gorge emergence spring pool
    { kind: 'entry', xMin: 8, xMax: 20, rimHalf: 5.0, flareAdd: 2.8, lipTilt: 0.4, floorY: 2.6, sunAngle: 1.42 },
    // Downstream Provençal stone-weir gorge basin
    { kind: 'exit', xMin: 387, xMax: 401, rimHalf: 5.1, flareAdd: 2.8, lipTilt: -0.4, floorY: 2.6, sunAngle: 1.70 },
  ],
  segments: [
    // === MAIN GOLD ROUTE (Guideline follows segments 1..17) ===
    // 1. Gorge Pool Plunge Throat
    { ax: 14, ay: 0.8, bx: 14, by: 9.5, ra: 5.5, rb: 3.9 },
    // 2. Sweeping Canyon Descent -> CP1
    { ax: 14, ay: 9.5, bx: 38, by: 18.0, ra: 4.0, rb: 3.5 },
    // 3. Upper Vaucluse Gallery (Dead End 1 forks down-left at 64,24.5) -> CP2
    { ax: 38, ay: 18.0, bx: 64, by: 24.5, ra: 3.6, rb: 3.7 },
    // 4. Trimix Gate Dropoff past 33.7m MOD -> CP3
    { ax: 64, ay: 24.5, bx: 88, by: 33.0, ra: 3.4, rb: 2.9 },
    // 5. Steep Drop into Phreatic Forks (Dead End 2 forks up-right at 116,48) -> CP4
    { ax: 88, ay: 33.0, bx: 116, by: 48.0, ra: 3.0, rb: 3.8 },
    // 6. Tight Keyhole Restriction (<2m half-radius)
    { ax: 116, ay: 48.0, bx: 136, by: 44.5, ra: 2.1, rb: 1.95 },
    // 7. Cascade Step Down to Siphon Overlook (Dead End 3 forks down-left at 162,58) -> CP5
    { ax: 136, ay: 44.5, bx: 162, by: 58.0, ra: 2.3, rb: 3.6 },
    // 8. Plunge into 74m Abyssal Sump
    { ax: 162, ay: 58.0, bx: 186, by: 73.5, ra: 3.5, rb: 4.2 },
    // 9. 74m Vaucluse Abyssal Floor -> Turnaround CP6
    { ax: 186, ay: 73.5, bx: 214, by: 74.2, ra: 4.2, rb: 4.0 },
    // 10. Towering East Chimney (Dead End 4 forks down-right at 236,52)
    { ax: 214, ay: 74.2, bx: 236, by: 52.0, ra: 3.8, rb: 3.5 },
    // 11. Backtrack Dog-Leg Squeeze -> CP7
    { ax: 236, ay: 52.0, bx: 228, by: 36.0, ra: 2.9, rb: 2.3 },
    // 12. Switchback Rift across Fault (Dead End 5 forks down-right at 264,34)
    { ax: 228, ay: 36.0, bx: 264, by: 34.0, ra: 2.4, rb: 3.4 },
    // 13. Broad Phreatic Dip across East Gorge (after Dead End 5)
    { ax: 264, ay: 34.0, bx: 296, by: 40.5, ra: 2.9, rb: 3.1 },
    // 14. Ascending Rift Climb
    { ax: 296, ay: 40.5, bx: 326, by: 30.0, ra: 3.1, rb: 2.8 },
    // 15. Ascent toward 22m Gas Switch -> CP8
    { ax: 326, ay: 30.0, bx: 344, by: 22.0, ra: 3.0, rb: 3.1 },
    // 16. Upper Phreatic Squeeze
    { ax: 344, ay: 22.0, bx: 368, by: 14.0, ra: 2.3, rb: 2.2 },
    // 17. Step-Up into Emergence Deco Vault
    { ax: 368, ay: 14.0, bx: 382, by: 6.4, ra: 2.9, rb: 4.6 },
    // 18. Broad 6m Resurgence Deco Bench -> CP9
    { ax: 382, ay: 6.4, bx: 394, by: 6.2, ra: 4.6, rb: 5.1 },
    // 19. Provençal Canyon Emergence Basin
    { ax: 394, ay: 6.2, bx: 394, by: 0.6, ra: 5.3, rb: 5.1 },

    // === UNLINED DEAD-END LABYRINTH SPURS ===
    // Dead End 1: Blind Canyon Spur (24.5m -> 41.5m back-left cul-de-sac)
    { ax: 64, ay: 24.5, bx: 50, by: 36.0, ra: 2.2, rb: 1.85 },
    { ax: 50, ay: 36.0, bx: 36, by: 41.5, ra: 1.85, rb: 2.8 },

    // Dead End 2: Upper Maze Blind Dome (48m -> 22m rising sealed pocket)
    { ax: 116, ay: 48.0, bx: 126, by: 29.0, ra: 2.2, rb: 1.9 },
    { ax: 126, ay: 29.0, bx: 142, by: 22.0, ra: 1.9, rb: 2.9 },

    // Dead End 3: Siphon False Continuation (58m -> 67.5m deep left blind sump)
    { ax: 162, ay: 58.0, bx: 138, by: 67.5, ra: 2.3, rb: 1.85 },
    { ax: 138, ay: 67.5, bx: 118, by: 66.0, ra: 1.85, rb: 3.1 },

    // Dead End 4: East Fault Abyssal Pit (52m -> 68.5m deep right blind pit)
    { ax: 236, ay: 52.0, bx: 256, by: 64.0, ra: 2.3, rb: 1.85 },
    { ax: 256, ay: 64.0, bx: 274, by: 68.5, ra: 1.85, rb: 3.0 },

    // Dead End 5: High Gorge Blind Alcove (34m -> 58m lower shelf choke)
    { ax: 264, ay: 34.0, bx: 280, by: 52.0, ra: 2.2, rb: 1.8 },
    { ax: 280, ay: 52.0, bx: 298, by: 58.0, ra: 1.8, rb: 2.9 },
  ],
  guideline: [
    { x: 14, y: 2.8 },
    { x: 14, y: 9.5 },
    { x: 38, y: 18.0 },
    { x: 64, y: 24.5 },
    { x: 88, y: 33.0 },
    { x: 116, y: 48.0 },
    { x: 136, y: 44.5 },
    { x: 162, y: 58.0 },
    { x: 186, y: 73.5 },
    { x: 200, y: 73.8 },
    { x: 214, y: 74.2 },
    { x: 236, y: 52.0 },
    { x: 228, y: 36.0 },
    { x: 264, y: 34.0 },
    { x: 296, y: 40.5 },
    { x: 326, y: 30.0 },
    { x: 344, y: 22.0 },
    { x: 368, y: 14.0 },
    { x: 382, y: 6.4 },
    { x: 394, y: 6.2 },
    { x: 394, y: 2.0 },
  ],
  checkpoints: [
    {
      id: 'cp1',
      name: 'Provençal Gorge Arch',
      x: 38,
      y: 18.0,
      radius: 3.5,
      hint: 'Descending ivory-white karst canyon. Manage buoyancy on EAN32.',
    },
    {
      id: 'cp2',
      name: 'Vaucluse Gallery',
      x: 64,
      y: 24.5,
      radius: 3.7,
      hint: 'First blind spur branches below — main gold arrows lead right.',
    },
    {
      id: 'cp3',
      name: 'Trimix Gate (33m)',
      x: 88,
      y: 33.0,
      radius: 3.3,
      expectedGas: 'TMX1455',
      hint: 'Switch to TMX 14/55 before plunging into the 74m Phreatic Maze!',
    },
    {
      id: 'cp4',
      name: 'Phreatic Forks',
      x: 116,
      y: 48.0,
      radius: 3.8,
      expectedGas: 'TMX1455',
      hint: 'Keyhole squeeze dead ahead! Keep trim clean to prevent silt-out.',
    },
    {
      id: 'cp5',
      name: 'Siphon Overlook (58m)',
      x: 162,
      y: 58.0,
      radius: 3.7,
      expectedGas: 'TMX1455',
      hint: 'Two deep paths diverge — only the right plunge reaches the 74m Sump!',
    },
    {
      id: 'cp6',
      name: 'Vaucluse Abyss (74m)',
      x: 200,
      y: 73.8,
      radius: 4.2,
      expectedGas: 'TMX1455',
      hint: '74m turnaround! Monitor NDL/Deco & gas thirds for the long ascent.',
    },
    {
      id: 'cp7',
      name: 'Cousteau Dog-Leg',
      x: 228,
      y: 36.0,
      radius: 3.2,
      expectedGas: 'TMX1455',
      hint: 'Thread the dog-leg rift back toward the 22m ascent chimney.',
    },
    {
      id: 'cp8',
      name: 'Switchback Chimney (22m)',
      x: 344,
      y: 22.0,
      radius: 3.6,
      expectedGas: 'EAN32',
      hint: 'Switch back to EAN32 at 22m — watch pace (<10 m/min) to avoid DCS!',
    },
    {
      id: 'cp9',
      name: 'Resurgence Deco (6m)',
      x: 388,
      y: 6.3,
      radius: 5.2,
      expectedGas: 'O2',
      hint: 'Hover at 6m on O2 100% until ceiling clears completely, then surface!',
    },
  ],
  zoneLines: [
    {
      id: 'zone-mineral',
      xMin: 8,
      xMax: 20,
      y: 9.5,
      color: '#a78bfa',
      title: '9.5m · CARBONATE MINERAL CLARITY BOUNDARY',
    },
    {
      id: 'zone-trimix',
      xMin: 80,
      xMax: 95,
      y: 33.7,
      color: '#c084fc',
      title: '33.7m · GAS SWITCH LINE (EAN32 → TMX 14/55)',
    },
    {
      id: 'zone-switchback',
      xMin: 337,
      xMax: 351,
      y: 22.0,
      color: '#38bdf8',
      title: '22m · ASCENT SWITCH LINE (TMX 14/55 → EAN32)',
    },
    {
      id: 'zone-deco',
      xMin: 378,
      xMax: 400,
      y: 6.0,
      color: '#4ade80',
      title: '6m · DECO STOP LINE (HOLD ON O2 100%)',
    },
  ],
  depthMarkers: [
    { y: 33.7, label: '33.7m · EAN32 MOD (O2 TOX BELOW)', color: 'rgba(248, 113, 113, 0.35)' },
    { y: 74.0, label: '74.0m · VAUCLUSE DEEP SUMP FLOOR (CRITICAL GAS SAC)', color: 'rgba(192, 132, 252, 0.38)' },
  ],
  parTimeSec: 340,
  collectibles: [
    // Main-route collectibles (small/medium)
    { id: 'l4-plumb', name: '1946 Hemp Lead Line Weight', kind: 'survey', scale: 0.82, points: 175, x: 26.0, y: 13.8 },
    { id: 'l4-slate', name: 'Provençal Dive Log Slate', kind: 'survey', scale: 0.88, points: 200, x: 102.0, y: 40.5 },
    { id: 'l4-keyhole', name: 'Eroded Phreatic Scallop Core', kind: 'fossil', scale: 0.96, points: 250, x: 148.0, y: 51.0 },
    { id: 'l4-sump-gem', name: 'Cobalt Bathymetry Crystal', kind: 'crystal', scale: 1.02, points: 275, x: 212.0, y: 73.0 },
    { id: 'l4-marker', name: 'Cousteau Gorge Survey Arrow', kind: 'survey', scale: 0.90, points: 225, x: 311.0, y: 35.2 },
    { id: 'l4-weir', name: 'Vaucluse Spring Token', kind: 'relic', scale: 0.95, points: 225, x: 375.0, y: 9.8 },
    // Largest rare relics at the hardest dead-end extremes
    { id: 'l4-roman-amphora', name: 'Sunken Provençal Amphora', kind: 'relic', scale: 1.46, points: 525, x: 36.2, y: 41.5 },
    { id: 'l4-amethyst-spire', name: 'Massive Amethyst Cathedral Spire', kind: 'crystal', scale: 1.54, points: 600, x: 142.0, y: 22.0 },
    { id: 'l4-brass-astrolabe', name: 'Abyssal Cousteau Bathysphere Seal', kind: 'relic', scale: 1.68, points: 750, x: 118.0, y: 66.0 },
    { id: 'l4-plesiosaur-vertebra', name: 'Giant Jurassic Marine Vertebra', kind: 'fossil', scale: 1.58, points: 650, x: 274.0, y: 68.5 },
    { id: 'l4-calcite-monarch', name: 'Monarch Dogtooth Spar Cluster', kind: 'crystal', scale: 1.52, points: 575, x: 298.0, y: 58.0 },
  ],
  exitZone: {
    name: 'Vaucluse Gorge Spring',
    x: 394,
    y: 1.5,
    radius: 5.0,
  },
};
