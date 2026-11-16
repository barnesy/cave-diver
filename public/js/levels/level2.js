/**
 * Level 2: Eagle's Nest Sink (Weeki Wachee / Chassahowitzka, Florida)
 * Modeled after the iconic Florida freshwater karst profile:
 * Narrow cypress-swamp sinkhole -> straight vertical chimney plunge -> vaulted Ballroom
 * cavern -> steep 60m Room of Dreams pit -> Duck-Under squeeze -> S-bend rift -> Sand-Boil deco shelf.
 */

export const LEVEL_2 = {
  id: 'eagles-nest-sink',
  name: "Eagle's Nest Sink",
  subtitle: 'Max Depth 60m · Florida Vertical Karst & Duck-Under',
  description:
    "Drop vertically down Eagle's Nest chimney into the vast Ballroom, plunge 60m into the Room of Dreams, thread the Duck-Under squeeze, and zig-zag up the chert rift.",
  bounds: {
    xMin: -44,
    xMax: 256,
    yMin: -6,
    yMax: 70,
  },
  roughness: 0.42,
  spawn: { x: 14, y: 2.0 },
  haloclineY: 6.8,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp6',
  ascentSwitchDepthM: 22.0,
  theme: {
    id: 'florida-karst',
    rockTexture: '/assets/tex-florida-limestone.jpg',
    backTexture: '/assets/tex-florida-backwall.jpg',
    skyTop: '#0369a1',
    skyMid: '#7dd3fc',
    skyGlow: '#fef3c7',
    skyHorizon: '#fde68a',
    waterSurface: '#b45309',
    waterShallow: '#0284c7',
    waterMid: '#0e4f76',
    waterDeep: '#092346',
    waterAbyss: '#020612',
    haloclineLabel: 'Tannic-Clear Spring Interface',
    haloclineColor: 'rgba(245, 158, 11, 0.24)',
    mossTint: 'tannin-chert',
    rockTint: [1.08, 0.99, 0.84],
    backTint: [0.68, 0.80, 1.06],
    surfaceStyle: 'florida-cypress',
    sunbeamTop: 'rgba(253, 224, 71, 0.34)',
    sunbeamMid: 'rgba(56, 189, 248, 0.16)',
  },
  openBasins: [
    // Narrow tannic cypress-sink entry funnel
    { kind: 'entry', xMin: 9.5, xMax: 18.5, rimHalf: 3.8, flareAdd: 2.3, lipTilt: -0.25, floorY: 2.5, sunAngle: 1.51 },
    // Broad pine-flatwoods spring boil recovery sink
    { kind: 'exit', xMin: 185, xMax: 199, rimHalf: 4.9, flareAdd: 2.6, lipTilt: 0.3, floorY: 2.6, sunAngle: 1.69 },
  ],
  segments: [
    // 1. Narrow cypress-pond funnel -> tight chimney throat
    { ax: 14, ay: 0.8, bx: 14, by: 9.5, ra: 4.5, rb: 2.55 },
    // 2. Vertical Chimney Shaft (plunge straight down!)
    { ax: 14, ay: 9.5, bx: 15, by: 23.5, ra: 2.55, rb: 3.1 },
    // 3. Sudden vaulted opening into The Ballroom cavern
    { ax: 15, ay: 23.5, bx: 35, by: 29.0, ra: 3.4, rb: 6.4 },
    // 4. Across The Ballroom slope -> Upstream drop edge
    { ax: 35, ay: 29.0, bx: 56, by: 31.5, ra: 6.4, rb: 4.2 },
    // 5. Steep staircase pitch past 33.7m EAN32 MOD
    { ax: 56, ay: 31.5, bx: 78, by: 46.5, ra: 4.0, rb: 3.4 },
    // 6. Plunge into the 60m Room of Dreams Pit
    { ax: 78, ay: 46.5, bx: 96, by: 58.8, ra: 3.4, rb: 4.3 },
    // 7. Room of Dreams Sump Turnaround (60m floor)
    { ax: 96, ay: 58.8, bx: 118, by: 60.2, ra: 4.3, rb: 4.1 },
    // 8. Steep climb toward Duck-Under Crest
    { ax: 118, ay: 60.2, bx: 132, by: 42.0, ra: 3.8, rb: 2.4 },
    // 9. The Duck-Under Squeeze (dips back down under an overhanging chert shelf!)
    { ax: 132, ay: 42.0, bx: 148, by: 47.2, ra: 2.0, rb: 1.85 },
    // 10. Lower Chert Gallery leading to S-Bend Rift
    { ax: 148, ay: 47.2, bx: 168, by: 36.5, ra: 2.2, rb: 3.1 },
    // 11. Zig-zag Diagonal Fissure cutting up & back left toward 22m Switch
    { ax: 168, ay: 36.5, bx: 158, by: 22.0, ra: 3.1, rb: 3.0 },
    // 12. Upper Fissure Switchback climbing toward Exit Cavern
    { ax: 158, ay: 22.0, bx: 175, by: 11.5, ra: 3.1, rb: 3.6 },
    // 13. Sand-Boil 6m Deco Cavern
    { ax: 175, ay: 11.5, bx: 191, by: 6.2, ra: 3.7, rb: 4.9 },
    // 14. Pine-Flatwoods Emergence Skylight
    { ax: 191, ay: 6.2, bx: 192, by: 0.6, ra: 5.1, rb: 4.9 },
  ],
  guideline: [
    { x: 14, y: 2.8 },
    { x: 14, y: 9.5 },
    { x: 15, y: 23.5 },
    { x: 35, y: 29.0 },
    { x: 56, y: 31.5 },
    { x: 78, y: 46.5 },
    { x: 96, y: 58.8 },
    { x: 108, y: 59.7 },
    { x: 118, y: 60.2 },
    { x: 132, y: 42.0 },
    { x: 148, y: 47.2 },
    { x: 168, y: 36.5 },
    { x: 158, y: 22.0 },
    { x: 175, y: 11.5 },
    { x: 186, y: 7.8 },
    { x: 191, y: 6.2 },
    { x: 192, y: 2.0 },
  ],
  checkpoints: [
    {
      id: 'cp1',
      name: 'The Chimney Throat',
      x: 14.8,
      y: 22.0,
      radius: 3.4,
      hint: 'Clear the vertical shaft into The Ballroom. Stay on EAN32.',
    },
    {
      id: 'cp2',
      name: 'The Ballroom Vault',
      x: 35,
      y: 29.0,
      radius: 4.5,
      hint: 'Massive Suwannee limestone vault — follow the perimeter line right.',
    },
    {
      id: 'cp3',
      name: 'Pit Dropoff (31.5m)',
      x: 56,
      y: 31.5,
      radius: 3.6,
      expectedGas: 'TMX1455',
      hint: 'Switch to TMX 14/55 before dropping down the 60m Pit!',
    },
    {
      id: 'cp4',
      name: 'Room of Dreams (60m)',
      x: 108,
      y: 59.6,
      radius: 4.2,
      expectedGas: 'TMX1455',
      hint: 'Deep turnaround! Ascend calmly toward the Duck-Under ledge.',
    },
    {
      id: 'cp5',
      name: 'The Duck-Under',
      x: 140,
      y: 44.6,
      radius: 2.7,
      expectedGas: 'TMX1455',
      hint: 'Duck beneath the chert shelf without brushing floor silt.',
    },
    {
      id: 'cp6',
      name: 'Chert Rift (22m)',
      x: 158.5,
      y: 22.0,
      radius: 3.8,
      expectedGas: 'EAN32',
      hint: 'Switch back to EAN32 on the switchback climb — avoid hypoxia!',
    },
    {
      id: 'cp7',
      name: 'Sand-Boil Deco (6m)',
      x: 185,
      y: 6.6,
      radius: 5.4,
      expectedGas: 'O2',
      hint: 'Hold 5–6m on O2 100% until deco clears, then emerge at the spring!',
    },
  ],
  zoneLines: [
    {
      id: 'zone-tannin',
      xMin: 9,
      xMax: 19,
      y: 6.8,
      color: '#f59e0b',
      title: '6.8m · TANNIC TEA -> CRYSTAL SPRING INTERFACE',
    },
    {
      id: 'zone-dropoff',
      xMin: 50,
      xMax: 62,
      y: 31.5,
      color: '#c084fc',
      title: '31.5m · GAS SWITCH LINE (EAN32 → TMX 14/55)',
    },
    {
      id: 'zone-rift',
      xMin: 153,
      xMax: 164,
      y: 22.0,
      color: '#38bdf8',
      title: '22m · ASCENT SWITCH LINE (TMX 14/55 → EAN32)',
    },
    {
      id: 'zone-deco',
      xMin: 176,
      xMax: 195,
      y: 6.0,
      color: '#4ade80',
      title: '6m · DECO STOP LINE (HOLD ON O2 100%)',
    },
  ],
  depthMarkers: [
    { y: 33.7, label: '33.7m · EAN32 MOD (O2 TOX BELOW)', color: 'rgba(248, 113, 113, 0.35)' },
    { y: 60.0, label: '60.0m · DEEP PIT FLOOR (HIGH SAC)', color: 'rgba(192, 132, 252, 0.35)' },
  ],
  parTimeSec: 195,
  collectibles: [
    { id: 'l2-cypress', name: 'Chimney Telemetry Tag', kind: 'survey', points: 175, x: 13.5, y: 15.5 },
    { id: 'l2-meg', name: 'Megalodon Tooth', kind: 'fossil', points: 325, x: 34.5, y: 24.5 },
    { id: 'l2-bone', name: 'Pleistocene Mastodon Shard', kind: 'fossil', points: 300, x: 42.5, y: 33.2 },
    { id: 'l2-fluorite', name: 'Golden Karst Fluorite', kind: 'crystal', points: 250, x: 67.5, y: 37.8 },
    { id: 'l2-idol', name: 'Calusa Shell Gorget', kind: 'relic', points: 350, x: 106.0, y: 57.0 },
    { id: 'l2-core', name: '60m Sump Core Sample', kind: 'survey', points: 225, x: 115.0, y: 61.5 },
    { id: 'l2-chert', name: 'Luminous Chert Crystal', kind: 'crystal', points: 250, x: 156.5, y: 42.0 },
    { id: 'l2-shark', name: 'Miocene Shark Tooth', kind: 'fossil', points: 275, x: 162.5, y: 27.5 },
    { id: 'l2-spring', name: 'Spring Survey Plaque', kind: 'relic', points: 250, x: 180.5, y: 6.2 },
  ],
  exitZone: {
    name: 'Pine Flatwoods Boil',
    x: 192,
    y: 1.5,
    radius: 5.0,
  },
};
