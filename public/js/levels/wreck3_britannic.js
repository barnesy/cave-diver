import { createLevelTheme } from './themes.js';

/**
 * Shipwreck 3 (Campaign L16): HMHS Britannic (Kea Channel, Aegean Sea, Greece)
 * Sister ship to RMS Titanic — largest sunken passenger liner on Earth, lying on her starboard side
 * in 120m of deep sapphire Aegean water.
 * - Hypoxic TMX 10/70 expedition dive (mod 130m)
 * - Drop down the Kea Channel shot line to the port hull promenade at 84m
 * - Deploy 260m unlined wreck reel through the mine-damaged Bow Fracture, Grand Staircase Well,
 *   Hospital Ward Corridor, and 119m Scotch Boiler Room #1
 * - Exit past the colossal bronze stern propellers (106m) and ascend through deep Trimix & O2 deco
 */
export const WRECK_BRITANNIC = {
  id: 'hmhs-britannic',
  name: 'HMHS Britannic',
  category: 'wreck',
  isWreck: true,
  difficultyRank: 16,
  tier: 5,
  subtitle: 'Kea Channel, Aegean Sea, Greece • 120m Ocean Liner',
  description:
    'Titanic\'s younger, larger sister ship resting intact on her starboard side in 120m off Kea Island. Switch to hypoxic TMX 10/70 on the descent line, anchor your 260m reel at the 84m Port Promenade, penetrate the mine-torn bow fracture and 119m Scotch Boiler Rooms, and survey the giant bronze stern propellers.',
  badge: 'Wreck 120m',
  parTimeSec: 590,
  lined: false,
  reelMetersPerDiver: 260,
  roughness: 0.15,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 22.0,
  bounds: { xMin: -66, xMax: 178, yMin: -6, yMax: 129 },
  spawn: { x: 14.0, y: 2.0 },
  exitZone: { x: 14.0, y: 1.8, radius: 6.8, name: 'Kea Expedition Vessel' },
  haloclineY: 44.0,
  wreckDeckY: 84.0,
  wreckSeabedY: 121.0,
  wreckHullXMin: -36,
  wreckHullXMax: 146,
  shipProfile: 'britannic-hospital-liner',
  shotLine: { x: 14.0, bottomY: 84.0, decoStagesY: [42.0, 22.0, 6.0] },
  theme: createLevelTheme('aegean-britannic-wreck'),

  gasOverrides: {
    TMX1455: {
      name: 'TMX 10/70',
      shortLabel: '10/70',
      role: 'Deep Wreck (12–135m)',
      fO2: 0.10,
      fHe: 0.70,
      fN2: 0.20,
      tankVolumeL: 34.0,
      modM: 135.0,
      minM: 12.0,
    },
    EAN32: { tankVolumeL: 15.0 },
    O2: { tankVolumeL: 11.5 },
  },

  openBasins: [
    { kind: 'entry', xMin: -62, xMax: 174, rimHalf: 118, flareAdd: 0, lipTilt: 0, floorY: 83.5, sunAngle: 1.52 },
  ],

  driftCurrents: [
    { yMin: 14.0, yMax: 42.0, vx: 0.95, vy: 0, label: 'Kea Channel Current' },
    { yMin: 52.0, yMax: 80.0, vx: -0.85, vy: 0, label: 'Deep Aegean Shear' },
  ],

  surgeZones: [
    { id: 'bri_surge1', x: 15.0, y: 88.0, radius: 4.5, vx: 0.6, vy: 3.4, periodSec: 7.8, phase: 0.4, label: 'Mine-Blast Bow Breach Surge' },
    { id: 'bri_surge2', x: 132.0, y: 88.5, radius: 4.5, vx: 0.8, vy: -3.5, periodSec: 7.2, phase: 2.3, label: 'Turbine Casing Vent Surge' },
  ],

  snagZones: [
    { id: 'bri_snag1', x: 42.0, y: 95.5, radius: 2.4, label: 'Shattered C-Deck Davit Wires' },
    { id: 'bri_snag2', x: 108.0, y: 115.5, radius: 2.3, label: 'Collapsed Funnel Rigging' },
  ],

  watertightHatches: [
    { id: 'bri_hatch_bow', x: 0.0, y: 99.0, radius: 1.9, label: 'Mine-Damaged Bow Bulkhead', bonusPoints: 180 },
    { id: 'bri_hatch_boiler', x: 75.0, y: 118.0, radius: 1.9, label: 'Boiler Room #1 Watertight Door', bonusPoints: 200 },
  ],

  wreckProps: [
    { kind: 'funnel', x: 56.0, y: 82.0, scale: 1.35, angle: 1.38 },
    { kind: 'funnel', x: 104.0, y: 82.0, scale: 1.3, angle: 1.52 },
    { kind: 'davit', x: 32.0, y: 83.5, scale: 1.2, angle: 0.32 },
    { kind: 'davit', x: 82.0, y: 83.5, scale: 1.2, angle: -0.22 },
    { kind: 'anchor', x: -30.0, y: 84.0, chainLen: 36.0 },
    { kind: 'railing', x: -14.0, y: 84.0, len: 24.0 },
    { kind: 'porthole', x: 6.0, y: 92.0, angle: 0.65, beamLen: 6.8 },
    { kind: 'porthole', x: 52.0, y: 94.0, angle: 0.85, beamLen: 6.4 },
    { kind: 'porthole', x: 116.0, y: 94.0, angle: 2.25, beamLen: 6.4 },
    { kind: 'beam', x: 26.0, y: 98.0, len: 5.8, angle: 1.52 },
    { kind: 'beam', x: 78.0, y: 115.0, len: 6.0, angle: 0.06 },
    { kind: 'pipe', x: 76.0, y: 117.5, len: 16.0, angle: 0.04 },
    { kind: 'propeller', x: 144.0, y: 107.0, scale: 1.75, angle: 0.25 },
  ],

  segments: [
    // Port Promenade Entry & Mine-Damaged Bow Fracture (81.5m -> 98m)
    { ax: 14, ay: 81.5, bx: 16, by: 96.0, ra: 4.0, rb: 3.5 },
    { ax: 16, ay: 96.0, bx: -14, by: 102.0, ra: 3.2, rb: 3.0 },

    // Enclosed Promenade Swim-Through & Grand Staircase Skylight Well
    { ax: 16, ay: 96.0, bx: 54, by: 95.0, ra: 3.4, rb: 3.5 },
    { ax: 54, ay: 95.0, bx: 94, by: 97.0, ra: 3.4, rb: 3.2 },

    // Hospital Ward Descent -> 119m Scotch Boiler Room #1
    { ax: 54, ay: 95.0, bx: 58, by: 116.0, ra: 3.0, rb: 3.5 },
    { ax: 58, ay: 116.0, bx: 92, by: 119.5, ra: 3.5, rb: 3.8 },
    { ax: 92, ay: 119.5, bx: 124, by: 112.0, ra: 3.4, rb: 3.2 },

    // Aft Turbine Casing -> Giant Bronze Stern Propellers & Open-Water Ascent
    { ax: 94, ay: 97.0, bx: 124, by: 112.0, ra: 2.9, rb: 3.2 },
    { ax: 124, ay: 112.0, bx: 132, by: 94.0, ra: 3.3, rb: 3.6 },
    { ax: 132, ay: 94.0, bx: 132, by: 81.5, ra: 3.6, rb: 4.2 },
  ],

  guideline: [],

  checkpoints: [
    { id: 'cp1', x: 14, y: 22.0, radius: 5.5, name: '22m Shot Line Buoy', hint: 'Switch to hypoxic TMX 10/70 [2] for the 120m Aegean descent!' },
    { id: 'cp2', x: 14, y: 84.0, radius: 5.2, name: 'Port Promenade Deck', hint: 'Anchor your 260m reel [G] and penetrate the promenade swim-through.' },
    { id: 'cp3', x: 54, y: 95.0, radius: 4.8, name: 'Grand Staircase Well', hint: 'Drop down the hospital deck companionway to the Scotch boilers.' },
    { id: 'cp4', x: 92, y: 119.0, radius: 5.0, name: 'Scotch Boiler Room #1', hint: 'Turnaround at 119m! Exit aft past the giant bronze propellers.' },
    { id: 'cp5', x: 14, y: 22.0, radius: 5.8, name: '22m Ascent Switch Buoy', hint: 'Respect deep TMX deco stops, then switch back to EAN32 [1] here.' },
    { id: 'cp6', x: 14, y: 6.0, radius: 5.8, name: '6m O2 Deco Trapeze Bar', hint: 'Switch to O2 100% [3] and clear final decompression.' },
  ],

  collectibles: [
    { id: 'bri_c1', x: -12, y: 102.0, kind: 'relic', name: '1916 Bow Fracture Survey Plate', points: 480, scale: 1.15, radius: 1.5 },
    { id: 'bri_c2', x: 36, y: 95.5, kind: 'relic', name: 'White Star Brass Telemotor', points: 520, scale: 1.2, radius: 1.5 },
    { id: 'bri_c3', x: 74, y: 96.0, kind: 'relic', name: 'Hospital Ward Red Cross Lamp', points: 460, scale: 1.1, radius: 1.45 },
    { id: 'bri_c4', x: 60, y: 115.5, kind: 'relic', name: 'Grand Staircase Brass Lantern', points: 540, scale: 1.2, radius: 1.5 },
    { id: 'bri_c5', x: 90, y: 119.2, kind: 'relic', name: 'Scotch Boiler Pressure Gauge', points: 680, scale: 1.38, radius: 1.5 },
    { id: 'bri_c6', x: 130, y: 104.0, kind: 'beacon', name: 'Bronze Stern Propeller Scan', points: 600, scale: 1.3, radius: 1.5 },
  ],

  zoneLines: [
    { id: 'zone-switch', y: 22.0, xMin: 2, xMax: 28, color: '#fbbf24', title: '22m SHOT LINE SWITCH — TMX 10/70 [2]' },
    { id: 'zone-deco', y: 6.0, xMin: 2, xMax: 28, color: '#34d399', title: '6m O2 DECO TRAPEZE BAR — O2 100% [3]' },
  ],

  depthMarkers: [
    { x: 20, y: 6, label: '6m O2 BAR', color: '#34d399' },
    { x: 20, y: 22, label: '22m TMX 10/70', color: '#fbbf24' },
    { x: 28, y: 82, label: '84m PORT HULL', color: '#38bdf8' },
    { x: 64, y: 94, label: '95m GRAND STAIRCASE', color: '#7dd3fc' },
    { x: 92, y: 121, label: '120m BOILER ROOM', color: '#f87171' },
  ],
};
