/**
 * Level 5: Boesmansgat — The Dolomite Abyss (Northern Cape, South Africa)
 * Epic flagship 92m expedition dive demanding strict gas conservation (Rule of Thirds),
 * disciplined EAN32 <-> TMX 14/55 switching at 30m/26m, smooth gliding to minimize SAC,
 * and perilous probes into 5 deep unlined dead-end siphons down to 95m.
 */

export const LEVEL_5 = {
  id: 'boesmansgat-abyss',
  name: 'Boesmansgat Abyss',
  subtitle: 'Max Depth 92m · Extreme Trimix & Strict Gas Conservation',
  description:
    "Plunge into South Africa's legendary 92m dolomite abyss. Conserve every bar of Trimix with smooth finning & crisp 30m/26m switches, raid five blind abyssal chutes for colossal relics, and clear deep O2 deco.",
  bounds: {
    xMin: -44,
    xMax: 560,
    yMin: -6,
    yMax: 102,
  },
  roughness: 0.46,
  spawn: { x: 14, y: 2.0 },
  haloclineY: 14.5,
  turnaroundCheckpointId: 'cp6',
  ascentSwitchCheckpointId: 'cp9',
  ascentSwitchDepthM: 26.0,
  theme: {
    id: 'kalahari-dolomite',
    rockTexture: '/assets/tex-florida-limestone.jpg',
    backTexture: '/assets/tex-cave-backwall.jpg',
    skyBackdrop: '/assets/sky-boesmansgat.jpg',
    skyTop: '#1d4ed8',
    skyMid: '#d97706',
    skyGlow: '#fef08a',
    skyHorizon: '#fdba74',
    waterSurface: '#38bdf8',
    waterShallow: '#0369a1',
    waterMid: '#1e3a8a',
    waterDeep: '#17153b',
    waterAbyss: '#02020a',
    haloclineLabel: 'Hydrogen-Sulfide Dolomite Chemocline',
    haloclineColor: 'rgba(192, 132, 252, 0.26)',
    mossTint: 'kalahari-ironstone',
    rockTint: [1.14, 0.86, 0.72],
    backTint: [0.62, 0.72, 0.98],
    surfaceStyle: 'kalahari-crater',
    sunbeamTop: 'rgba(254, 240, 138, 0.36)',
    sunbeamMid: 'rgba(99, 102, 241, 0.16)',
  },
  openBasins: [
    // Arid Kalahari red-ironstone dolomite sinkhole crater
    { kind: 'entry', xMin: 8, xMax: 20, rimHalf: 5.2, flareAdd: 2.8, lipTilt: 0.35, floorY: 2.6, sunAngle: 1.44 },
    // Sunlit eastern dolomite basin resurgence
    { kind: 'exit', xMin: 493, xMax: 507, rimHalf: 5.2, flareAdd: 2.8, lipTilt: -0.35, floorY: 2.6, sunAngle: 1.68 },
  ],
  segments: [
    // === MAIN GOLD ROUTE (Guideline follows segments 1..19) ===
    // 1. Kalahari Crater Sinkhole Throat
    { ax: 14, ay: 0.8, bx: 14, by: 10.5, ra: 5.6, rb: 3.9 },
    // 2. Upper Dolomite Arch -> CP1
    { ax: 14, ay: 10.5, bx: 40, by: 19.0, ra: 4.0, rb: 3.6 },
    // 3. Chemocline Gallery -> CP2 (30m Gas Switch — conserve TMX above 30m!)
    { ax: 40, ay: 19.0, bx: 68, by: 30.0, ra: 3.6, rb: 3.4 },
    // 4. Giant's Hall Rift -> CP3 (Dead End 1 forks down-left at 46m!)
    { ax: 68, ay: 30.0, bx: 98, by: 46.0, ra: 3.3, rb: 3.9 },
    // 5. First Razor Dolomite Squeeze
    { ax: 98, ay: 46.0, bx: 122, by: 52.0, ra: 2.4, rb: 2.0 },
    // 6. Crystal Chute Junction -> CP4 (Dead End 2 forks down-left at 64m!)
    { ax: 122, ay: 52.0, bx: 152, by: 64.0, ra: 2.4, rb: 3.8 },
    // 7. Abyssal Chimney Plunge
    { ax: 152, ay: 64.0, bx: 176, by: 76.0, ra: 3.5, rb: 2.8 },
    // 8. Tight 74m Dolomite Slot -> CP5
    { ax: 176, ay: 76.0, bx: 196, by: 74.0, ra: 2.0, rb: 1.95 },
    // 9. Abyssal Threshold Drop (Dead End 3 plunges to 95m at 222,88!)
    { ax: 196, ay: 74.0, bx: 222, by: 88.0, ra: 2.4, rb: 4.0 },
    // 10. Boesmansgat 92m Abyss Floor -> Turnaround CP6
    { ax: 222, ay: 88.0, bx: 256, by: 92.0, ra: 4.2, rb: 4.5 },
    // 11. Staircase of Ghosts Climb -> CP7 (Dead End 4 forks up-left at 68m!)
    { ax: 256, ay: 92.0, bx: 282, by: 68.0, ra: 3.9, rb: 3.4 },
    // 12. Twin Crossover Vault -> CP8
    { ax: 282, ay: 68.0, bx: 318, by: 48.0, ra: 3.4, rb: 3.7 },
    // 13. Backtrack Undertow Dip (Dead End 5 forks down at 348,54!)
    { ax: 318, ay: 48.0, bx: 348, by: 54.0, ra: 2.6, rb: 2.7 },
    // 14. Ascending Rift out of Undertow
    { ax: 348, ay: 54.0, bx: 378, by: 38.0, ra: 2.8, rb: 3.1 },
    // 15. Dolomite Switchback Shelf (26m EAN32 Switch) -> CP9
    { ax: 378, ay: 38.0, bx: 400, by: 26.0, ra: 3.1, rb: 3.2 },
    // 16. Upper Travertine Squeeze
    { ax: 400, ay: 26.0, bx: 434, by: 14.5, ra: 2.3, rb: 2.15 },
    // 17. Shallow Undulating Travertine Gallery (EAN32 Endurance Stretch)
    { ax: 434, ay: 14.5, bx: 468, by: 20.5, ra: 2.5, rb: 2.8 },
    // 18. Step-Up into Crater 6m Deco Sanctuary
    { ax: 468, ay: 20.5, bx: 486, by: 6.4, ra: 2.9, rb: 4.7 },
    // 19. 6m Expedition Deco Bench -> CP10
    { ax: 486, ay: 6.4, bx: 500, by: 6.2, ra: 4.7, rb: 5.2 },
    // 20. Kalahari Crater Emergence Pool
    { ax: 500, ay: 6.2, bx: 500, by: 0.6, ra: 5.4, rb: 5.2 },

    // === 5 UNLINED DEEP DEAD-END CHUTES ===
    // Dead End 1: Sandstone Alcove (46m -> 61.5m blind spur)
    { ax: 98, ay: 46.0, bx: 84, by: 58.0, ra: 2.2, rb: 1.85 },
    { ax: 84, ay: 58.0, bx: 68, by: 61.5, ra: 1.85, rb: 2.8 },

    // Dead End 2: Crystal Chute False Drop (64m -> 82m sealed pocket)
    { ax: 152, ay: 64.0, bx: 138, by: 79.0, ra: 2.2, rb: 1.85 },
    { ax: 138, ay: 79.0, bx: 120, by: 82.0, ra: 1.85, rb: 3.0 },

    // Dead End 3: Abyssal Midnight Sump (88m -> 95.5m deepest chamber in Cave Diver!)
    { ax: 222, ay: 88.0, bx: 204, by: 95.5, ra: 2.3, rb: 1.9 },
    { ax: 204, ay: 95.5, bx: 184, by: 94.0, ra: 1.9, rb: 3.1 },

    // Dead End 4: Ghost Chimney False Exit (68m -> 34.5m blind rising dome)
    { ax: 282, ay: 68.0, bx: 274, by: 48.0, ra: 2.3, rb: 1.9 },
    { ax: 274, ay: 48.0, bx: 262, by: 34.5, ra: 1.9, rb: 3.0 },

    // Dead End 5: East Rift Blind Pit (54m -> 71.5m deep cul-de-sac)
    { ax: 348, ay: 54.0, bx: 368, by: 68.0, ra: 2.2, rb: 1.85 },
    { ax: 368, ay: 68.0, bx: 388, by: 71.5, ra: 1.85, rb: 3.0 },
  ],
  guideline: [
    { x: 14, y: 2.8 },
    { x: 14, y: 10.5 },
    { x: 40, y: 19.0 },
    { x: 68, y: 30.0 },
    { x: 98, y: 46.0 },
    { x: 122, y: 52.0 },
    { x: 152, y: 64.0 },
    { x: 176, y: 76.0 },
    { x: 196, y: 74.0 },
    { x: 222, y: 88.0 },
    { x: 242, y: 90.8 },
    { x: 256, y: 92.0 },
    { x: 282, y: 68.0 },
    { x: 318, y: 48.0 },
    { x: 348, y: 54.0 },
    { x: 378, y: 38.0 },
    { x: 400, y: 26.0 },
    { x: 434, y: 14.5 },
    { x: 468, y: 20.5 },
    { x: 486, y: 6.4 },
    { x: 500, y: 6.2 },
    { x: 500, y: 2.0 },
  ],
  checkpoints: [
    {
      id: 'cp1',
      name: 'Upper Dolomite Arch',
      x: 40,
      y: 19.0,
      radius: 3.6,
      hint: 'Ride EAN32 cleanly down to 30m — preserve every drop of TMX 14/55!',
    },
    {
      id: 'cp2',
      name: 'Trimix Gate (30m)',
      x: 68,
      y: 30.0,
      radius: 3.6,
      expectedGas: 'TMX1455',
      hint: 'Switch to TMX 14/55 now! Glide gently — rushing burns gas 4x faster deep.',
    },
    {
      id: 'cp3',
      name: "Giant's Hall (46m)",
      x: 98,
      y: 46.0,
      radius: 3.9,
      expectedGas: 'TMX1455',
      hint: 'Blind ironstone spur drops left — track your TMX thirds before detouring!',
    },
    {
      id: 'cp4',
      name: 'Crystal Chute Forks (64m)',
      x: 152,
      y: 64.0,
      radius: 3.8,
      expectedGas: 'TMX1455',
      hint: 'Plunge carefully down the right shaft — beware the false chute left.',
    },
    {
      id: 'cp5',
      name: 'Dolomite Razor Slot (74m)',
      x: 186,
      y: 75.0,
      radius: 2.7,
      expectedGas: 'TMX1455',
      hint: 'Narrow squeeze at 8.5 bar pressure — smooth frog kicks conserve Trimix!',
    },
    {
      id: 'cp6',
      name: 'Boesmansgat Abyss (92m)',
      x: 242,
      y: 90.8,
      radius: 4.4,
      expectedGas: 'TMX1455',
      hint: '92m turnaround! Check TMX reserve (>75 bar ideal) and begin steady climb.',
    },
    {
      id: 'cp7',
      name: 'Staircase of Ghosts (68m)',
      x: 282,
      y: 68.0,
      radius: 3.6,
      expectedGas: 'TMX1455',
      hint: 'Ignore the false rising dome — follow gold arrows diagonally up-right.',
    },
    {
      id: 'cp8',
      name: 'Twin Crossover (48m)',
      x: 318,
      y: 48.0,
      radius: 3.7,
      expectedGas: 'TMX1455',
      hint: 'Keep calm pace through the undertow dip toward the 26m switchback.',
    },
    {
      id: 'cp9',
      name: 'Ascent Switch (26m)',
      x: 400,
      y: 26.0,
      radius: 3.6,
      expectedGas: 'EAN32',
      hint: 'Switch back to EAN32 immediately! Saves remaining TMX and prevents hypoxia.',
    },
    {
      id: 'cp10',
      name: 'Crater Deco Sanctuary (6m)',
      x: 493,
      y: 6.3,
      radius: 5.2,
      expectedGas: 'O2',
      hint: 'Hold 6m on O2 100% until full abyssal decompression clears, then surface!',
    },
  ],
  zoneLines: [
    {
      id: 'zone-chemocline',
      xMin: 8,
      xMax: 20,
      y: 14.5,
      color: '#c084fc',
      title: '14.5m · H2S DOLOMITE CHEMOCLINE',
    },
    {
      id: 'zone-trimix-30',
      xMin: 61,
      xMax: 75,
      y: 30.0,
      color: '#38bdf8',
      title: '30m · GAS CONSERVATION SWITCH (EAN32 → TMX 14/55)',
    },
    {
      id: 'zone-switch-26',
      xMin: 393,
      xMax: 407,
      y: 26.0,
      color: '#38bdf8',
      title: '26m · ASCENT SWITCH LINE (TMX 14/55 → EAN32)',
    },
    {
      id: 'zone-deco',
      xMin: 484,
      xMax: 505,
      y: 6.0,
      color: '#4ade80',
      title: '6m · DEEP DECO STOP LINE (HOLD ON O2 100%)',
    },
  ],
  depthMarkers: [
    { y: 33.7, label: '33.7m · EAN32 MOD (O2 TOX BELOW)', color: 'rgba(248, 113, 113, 0.35)' },
    { y: 65.0, label: '65.0m · DEEP ZONE (HIGH SAC BURN)', color: 'rgba(167, 139, 250, 0.30)' },
    { y: 90.0, label: '90.0m · BOESMANSGAT ABYSS (EXTREME SAC & NARCOSIS)', color: 'rgba(248, 113, 113, 0.42)' },
  ],
  parTimeSec: 440,
  collectibles: [
    // Main-route collectibles
    { id: 'l5-winch', name: '1993 Expedition Winch Tag', kind: 'survey', scale: 0.84, points: 200, x: 27.0, y: 14.8 },
    { id: 'l5-pyrite', name: 'Dolomite Sulfide Vein Shard', kind: 'crystal', scale: 0.92, points: 225, x: 83.0, y: 38.0 },
    { id: 'l5-slot-marker', name: '74m Line Arrow Plaque', kind: 'survey', scale: 0.90, points: 250, x: 164.0, y: 70.0 },
    { id: 'l5-floor-core', name: '92m Abyssal Limestone Core', kind: 'fossil', scale: 1.05, points: 325, x: 252.0, y: 90.5 },
    { id: 'l5-ghost-tag', name: 'Ghost Staircase Line Cookie', kind: 'survey', scale: 0.90, points: 225, x: 300.0, y: 58.0 },
    { id: 'l5-undertow-gem', name: 'Deep Indigo Fluorite', kind: 'crystal', scale: 0.98, points: 275, x: 363.0, y: 46.0 },
    { id: 'l5-travertine', name: 'Kalahari Spring Brass Seal', kind: 'relic', scale: 0.95, points: 250, x: 477.0, y: 13.5 },
    // 5 Massive Rare Relics hidden in the dead-end abyssal chutes
    { id: 'l5-ironstone', name: 'Giant Ironstone Meteorite Core', kind: 'relic', scale: 1.52, points: 600, x: 68.0, y: 61.5 },
    { id: 'l5-specularite', name: 'Colossal Specularite Crystal Crown', kind: 'crystal', scale: 1.62, points: 725, x: 120.0, y: 82.0 },
    { id: 'l5-exley-bell', name: '95m Abyssal Expedition Bell', kind: 'relic', scale: 1.80, points: 1000, x: 184.0, y: 94.0 },
    { id: 'l5-bushman-idol', name: 'Ancient Kalahari Ochre Sunstone', kind: 'relic', scale: 1.56, points: 675, x: 262.0, y: 34.5 },
    { id: 'l5-stromatolite', name: 'Giant Archean Stromatolite Orb', kind: 'fossil', scale: 1.60, points: 700, x: 388.0, y: 71.5 },
  ],
  exitZone: {
    name: 'Boesmansgat Emergence',
    x: 500,
    y: 1.5,
    radius: 5.0,
  },
};
