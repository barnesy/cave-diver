import { createLevelTheme } from './themes.js';

/**
 * Level 8: Molnar Janos Thermal Vaults (Budapest, Hungary)
 * World's largest active thermal karst cave beneath the Buda Hills & Lukacs Bathhouse.
 * Recognizable characteristics:
 * - Warm geothermal turquoise water colliding with amber-gold thermal marl depths (24m convection shear)
 * - Colossal 5.5m-radius Rozsadomb Fault Dome contrasted with tight honeycomb tectonic squeezes (1.48m)
 * - NO fixed guideline! Divers carry a 185m reel spool down to 76m/78m sump & 7 blind pockets.
 */

export const LEVEL_8 = {
  id: 'molnar-janos-vaults',
  name: 'Molnar Janos Thermal Vaults',
  subtitle: 'Max Depth 78m · Budapest Hypogenic Thermal Karst · No Fixed Line',
  difficultyRank: 8,
  tier: 4,
  description:
    "Dive beneath historic Budapest's Lukacs Thermal Baths into the warm, crystal-clear Eocene marl honeycomb of Molnar Janos Cave. Lay your 185m reel [G] across the colossal Rozsadomb Fault Vault, descend to 78m on Trimix, and escape 7 blind thermal fissures.",
  bounds: {
    xMin: -46,
    xMax: 348,
    yMin: -6,
    yMax: 86,
  },
  roughness: 0.43,
  spawn: { x: 14, y: 2.0 },
  haloclineY: 24.0,
  parTimeSec: 285,
  reelMetersPerDiver: 185,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp6',
  ascentSwitchDepthM: 22.0,
  theme: createLevelTheme('budapest-thermal'),
  openBasins: [
    // Historic Malom Lake / Lukacs Bathhouse geothermal spring basin
    { kind: 'entry', xMin: 8, xMax: 20, rimHalf: 4.9, flareAdd: 2.4, lipTilt: 0.3, floorY: 2.5, sunAngle: 1.46 },
    // East Gellert limestone thermal park resurgence well
    { kind: 'exit', xMin: 278, xMax: 290, rimHalf: 5.0, flareAdd: 2.5, lipTilt: -0.3, floorY: 2.5, sunAngle: 1.65 },
  ],
  segments: [
    // === MALOM LAKE ENTRY TUNNEL -> CP1 EOCENE SPRING MOUTH ===
    { ax: 14, ay: 0.8, bx: 14, by: 11.0, ra: 5.0, rb: 3.5 },
    { ax: 14, ay: 11.0, bx: 38, by: 17.0, ra: 3.5, rb: 3.2 },

    // === UPPER HONEYCOMB CONDUIT -> CP2 24m THERMAL SHEAR ===
    { ax: 38, ay: 17.0, bx: 68, by: 20.0, ra: 2.3, rb: 1.68 },
    { ax: 68, ay: 20.0, bx: 94, by: 24.0, ra: 1.68, rb: 3.1 },

    // === LOWER SULFUR BYPASS -> CP2 ===
    { ax: 38, ay: 17.0, bx: 54, by: 31.0, ra: 2.6, rb: 2.1 },
    { ax: 54, ay: 31.0, bx: 78, by: 34.5, ra: 2.1, rb: 1.85 },
    { ax: 78, ay: 34.5, bx: 94, by: 24.0, ra: 1.9, rb: 3.1 },

    // === COLOSSAL ROZSADOMB FAULT DOME (CP2 -> CP3 AT 46m) ===
    { ax: 94, ay: 24.0, bx: 120, by: 37.5, ra: 2.9, rb: 5.4 },
    { ax: 120, ay: 37.5, bx: 146, by: 46.0, ra: 5.4, rb: 3.8 },

    // === TECTONIC PLUNGE -> DEEP 76m BUDA PIT (CP4) ===
    // Branch A: Direct tectonic chimney (1.52m squeeze -> 76m bottom)
    { ax: 146, ay: 46.0, bx: 162, by: 61.5, ra: 2.5, rb: 1.52 },
    { ax: 162, ay: 61.5, bx: 178, by: 76.0, ra: 1.6, rb: 3.8 },
    // Branch B: Longer barite terrace bypass (52m -> 64m -> 76m)
    { ax: 146, ay: 46.0, bx: 174, by: 52.0, ra: 2.4, rb: 2.1 },
    { ax: 174, ay: 52.0, bx: 192, by: 64.0, ra: 2.1, rb: 2.2 },
    { ax: 192, ay: 64.0, bx: 178, by: 76.0, ra: 2.2, rb: 3.7 },

    // === CP4 (76m TURNAROUND) -> CP5 SULFUR SQUEEZE (52m) -> CP6 22m SWITCH ===
    { ax: 178, ay: 76.0, bx: 204, by: 61.0, ra: 2.9, rb: 2.1 },
    { ax: 204, ay: 61.0, bx: 218, by: 52.0, ra: 2.1, rb: 2.8 },
    { ax: 218, ay: 52.0, bx: 230, by: 36.5, ra: 2.4, rb: 1.62 },
    { ax: 230, ay: 36.5, bx: 240, by: 22.0, ra: 1.68, rb: 3.2 },
    // Wide eastern alternate chimney bypass around squeeze
    { ax: 218, ay: 52.0, bx: 244, by: 43.0, ra: 2.1, rb: 1.95 },
    { ax: 244, ay: 43.0, bx: 240, by: 22.0, ra: 2.0, rb: 3.1 },

    // === CP6 -> CP7 LUKACS 6m DECO GALLERY & SURFACE RESURGENCE ===
    { ax: 240, ay: 22.0, bx: 260, by: 14.0, ra: 2.7, rb: 2.4 },
    { ax: 260, ay: 14.0, bx: 272, by: 6.4, ra: 2.6, rb: 4.3 },
    { ax: 272, ay: 6.4, bx: 284, by: 6.2, ra: 4.3, rb: 4.9 },
    { ax: 284, ay: 6.2, bx: 284, by: 0.8, ra: 5.0, rb: 4.9 },

    // === 7 HONEYCOMB TECTONIC BLIND ENDS ===
    // Dead End 1: High Shallow Bathhouse Drain off CP1
    { ax: 38, ay: 17.0, bx: 46, by: 8.5, ra: 1.9, rb: 1.65 },
    { ax: 46, ay: 8.5, bx: 55, by: 9.8, ra: 1.65, rb: 2.5 },
    // Dead End 2: West Warm-Spring Cellar
    { ax: 54, ay: 31.0, bx: 36, by: 44.0, ra: 2.0, rb: 1.68 },
    { ax: 36, ay: 44.0, bx: 22, by: 47.5, ra: 1.68, rb: 2.8 },
    // Dead End 3: Ceiling Crystal Cupola above Colossal Vault
    { ax: 120, ay: 37.5, bx: 118, by: 19.0, ra: 2.1, rb: 1.72 },
    { ax: 118, ay: 19.0, bx: 112, by: 12.0, ra: 1.72, rb: 2.7 },
    // Dead End 4: West Tectonic Razor Sump (64m)
    { ax: 146, ay: 46.0, bx: 130, by: 63.0, ra: 1.85, rb: 1.48 },
    { ax: 130, ay: 63.0, bx: 116, by: 60.5, ra: 1.48, rb: 2.7 },
    // Dead End 5: Deep 78m Buda Geothermal Pit
    { ax: 178, ay: 76.0, bx: 158, by: 78.0, ra: 2.0, rb: 1.65 },
    { ax: 158, ay: 78.0, bx: 144, by: 73.5, ra: 1.65, rb: 2.8 },
    // Dead End 6: East Sulfur Chamber off 52m Hub
    { ax: 218, ay: 52.0, bx: 244, by: 62.0, ra: 1.9, rb: 1.62 },
    { ax: 244, ay: 62.0, bx: 260, by: 58.5, ra: 1.62, rb: 2.8 },
    // Dead End 7: False Wellhead Alcove near Resurgence
    { ax: 260, ay: 14.0, bx: 250, by: 6.0, ra: 1.85, rb: 1.62 },
    { ax: 250, ay: 6.0, bx: 240, by: 7.2, ra: 1.62, rb: 2.6 },
  ],
  guideline: [],
  checkpoints: [
    { id: 'cp1', name: 'Malom Spring Entry', x: 38, y: 17.0, radius: 3.3, hint: '27°C thermal spring! Anchor reel [G] cleanly before picking an Eocene tier.' },
    { id: 'cp2', name: '24m Convection Shear', x: 94, y: 24.0, radius: 3.4, hint: 'Warm thermal amber mixes with cool karst water before the colossal vault.' },
    { id: 'cp3', name: 'Rozsadomb Vault Floor', x: 146, y: 46.0, radius: 3.7, hint: 'Breathe TMX 14/55! Watch the tight 1.52m fissure plunge down to 76m.' },
    { id: 'cp4', name: '76m Deep Buda Pit', x: 178, y: 76.0, radius: 3.9, hint: 'Maximum thermal pit reached! Ascend cleanly along the eastern fault chimney.' },
    { id: 'cp5', name: 'Sulfur Honeycomb Hub', x: 218, y: 52.0, radius: 3.4, hint: 'Conserve bottom trimix through the vertical chimney up toward 22m.' },
    { id: 'cp6', name: 'Eocene Balcony Switch', x: 240, y: 22.0, radius: 3.5, hint: 'Switch up to EAN32 above 26m and navigate toward Lukacs Deco Gallery.' },
    { id: 'cp7', name: 'Lukacs 6m Deco Gallery', x: 278, y: 6.3, radius: 4.1, hint: 'Switch to O2 100% at 6m and clear your full decompression ceiling.' },
  ],
  collectibles: [
    { id: 'l8-snail-shell', name: 'Endemic Thermal Snail Fossil', x: 68, y: 20.0, kind: 'fossil', points: 260, scale: 1.0 },
    { id: 'l8-marl-geode', name: 'Eocene Marl Calcite', x: 78, y: 34.0, kind: 'crystal', points: 300, scale: 1.05 },
    { id: 'l8-dome-rose', name: 'Rozsadomb Dome Barite', x: 120, y: 37.5, kind: 'crystal', points: 340, scale: 1.2 },
    { id: 'l8-brass-gauge', name: '1890 Lukacs Bath Gauge', x: 174, y: 52.0, kind: 'gear', points: 360, scale: 1.1 },
    { id: 'l8-drain-pearl', name: 'Thermal Wellhead Pearl', x: 54, y: 9.8, kind: 'pearl', points: 490, scale: 1.35 },
    { id: 'l8-west-opal', name: 'Sulfur Opal Cluster', x: 23, y: 47.4, kind: 'crystal', points: 690, scale: 1.55 },
    { id: 'l8-cupola-amber', name: 'Dome Cupola Aragonite', x: 112, y: 12.2, kind: 'crystal', points: 620, scale: 1.48 },
    { id: 'l8-razor-relic', name: '64m Fissure Mineral Crown', x: 117, y: 60.6, kind: 'relic', points: 860, scale: 1.7 },
    { id: 'l8-buda-chalice', name: '78m Buda Thermal Relic', x: 145, y: 73.6, kind: 'relic', points: 1050, scale: 1.9 },
    { id: 'l8-east-sulfur-crown', name: 'Danube Barite Sovereign', x: 259, y: 58.6, kind: 'relic', points: 820, scale: 1.65 },
    { id: 'l8-wellhead-compass', name: 'Surveyor Brass Compass', x: 241, y: 7.1, kind: 'gear', points: 640, scale: 1.5 },
    { id: 'l8-balcony-quartz', name: 'Thermal Balcony Quartz', x: 244, y: 43.0, kind: 'crystal', points: 540, scale: 1.4 },
    { id: 'l8-deep-pearl', name: 'Abyssal Sulfur Pearl', x: 192, y: 64.0, kind: 'pearl', points: 590, scale: 1.45 },
  ],
  zoneLines: [
    { id: 'zone-tmx', title: 'SWITCH TO TMX 14/55 AT 30m (MOD 33.7m)', xMin: 106, xMax: 146, y: 33.7, color: '#c084fc' },
    { id: 'zone-ean32-up', title: 'ASCENT SWITCH -> EAN32 (22m)', xMin: 226, xMax: 252, y: 22.0, color: '#38bdf8' },
    { id: 'zone-deco', title: '6m DECO LINE · SWITCH TO O2 100%', xMin: 272, xMax: 289, y: 6.0, color: '#4ade80' },
  ],
  depthMarkers: [
    { y: 33.7, label: '33.7m EAN32 MOD -> TRIMIX 14/55', color: 'rgba(248, 113, 113, 0.72)' },
  ],
  exitZone: {
    name: 'Gellert Thermal Resurgence',
    x: 284,
    y: 1.5,
    radius: 5.0,
  },
};
