import { createLevelTheme } from './themes.js';

/**
 * Shipwreck 6 (Campaign Rank 3 · Tier I): SS Thistlegorm (Sha'ab Ali, Red Sea, Egypt)
 * World-famous WWII British armed merchant ship sunk in 1941 while carrying locomotives,
 * Bedford trucks, BSA motorcycles, and munitions.
 * - Sunlit introductory technical wreck (26m deck, 34m cargo holds, 44m blasted stern & locomotive pit)
 * - Breathable on EAN32 across the coral-draped upper deck; switch to TMX 14/55 [2] to penetrate
 *   the 44m ammunition blast crater & stern keel!
 */
export const WRECK_THISTLEGORM = {
  id: 'ss-thistlegorm-wreck',
  name: 'SS Thistlegorm WWII Cargo Wreck',
  category: 'wreck',
  isWreck: true,
  difficultyRank: 3,
  tier: 1,
  subtitle: "Sha'ab Ali, Red Sea, Egypt • 44m WWII Cargo & Blast Crater",
  description:
    "Drop into warm turquoise Red Sea water onto the world's most iconic WWII shipwreck. Swim through sunlit coral-crusted cargo holds packed with motorcycles and trucks on EAN32, then switch to TMX 14/55 to penetrate the 44m blasted stern ammunition hold and seabed steam locomotive.",
  badge: 'Wreck 44m',
  parTimeSec: 270,
  lined: true,
  reelMetersPerDiver: 0,
  roughness: 0.14,
  turnaroundCheckpointId: 'cp4',
  ascentSwitchCheckpointId: 'cp5',
  ascentSwitchDepthM: 20.0,
  bounds: { xMin: -46, xMax: 274, yMin: -6, yMax: 60 },
  spawn: { x: 10.0, y: 2.0 },
  exitZone: { x: 10.0, y: 1.8, radius: 6.8, name: 'Red Sea Liveaboard Stern Platform' },
  haloclineY: 22.0,
  wreckDeckY: 26.0,
  wreckSeabedY: 46.0,
  wreckHullXMin: -24,
  wreckHullXMax: 96,
  shipProfile: 'thistlegorm-cargo-wreck',
  hullTopY(wx) {
    // Dramatic midships WWII ammunition blast crater between Holds #3 and #4 (x = 46..64)
    if (wx >= 44 && wx <= 66) {
      const u = (wx - 55) / 11;
      const dip = Math.max(0, 1 - u * u);
      return 26.0 + dip * 11.5;
    }
    return 26.0;
  },
  shotLine: { x: 10.0, bottomY: 26.0, decoStagesY: [20.0, 6.0] },
  theme: createLevelTheme('red-sea-coral-wreck'),

  openBasins: [
    { kind: 'entry', xMin: -42, xMax: 118, rimHalf: 80, flareAdd: 0, lipTilt: 0, floorY: 25.5, sunAngle: 1.5 },
  ],

  driftCurrents: [
    { yMin: 7.0, yMax: 24.0, vx: 0.52, vy: 0, label: "Sha'ab Ali Reef Current" },
  ],

  surgeZones: [
    { id: 'thi_surge1', x: 55.0, y: 34.5, radius: 4.0, vx: 2.5, vy: 1.4, periodSec: 7.6, phase: 0.5, label: 'Blast Crater Cross-Swell' },
  ],

  snagZones: [
    { id: 'thi_snag1', x: 34.0, y: 34.2, radius: 2.1, label: 'Fallen Derrick Rigging Cable' },
    { id: 'thi_snag2', x: 74.0, y: 42.2, radius: 2.0, label: 'Stern Blast Wiring Snarl' },
  ],

  watertightHatches: [
    { id: 'thi_hatch_bow', x: -5.0, y: 34.5, radius: 1.8, label: 'Forepeak Chain Locker', bonusPoints: 150 },
    { id: 'thi_hatch_stern', x: 82.0, y: 41.5, radius: 1.8, label: 'Stern Gun-Crew Locker', bonusPoints: 160 },
  ],

  wreckProps: [
    { kind: 'anchor', x: -20.0, y: 26.0, chainLen: 19.0 },
    { kind: 'crane', x: 4.0, y: 26.0, scale: 1.05, angle: 0.25 },
    { kind: 'crane', x: 36.0, y: 26.0, scale: 1.0, angle: -0.35 },
    { kind: 'mast', x: 20.0, y: 26.0, scale: 0.92 },
    { kind: 'railing', x: -14.0, y: 26.0, len: 16.0 },
    { kind: 'railing', x: 68.0, y: 26.0, len: 20.0 },
    { kind: 'locomotive', x: 55.0, y: 44.5, scale: 1.15 },
    { kind: 'porthole', x: 2.0, y: 33.5, angle: 0.65, beamLen: 5.5 },
    { kind: 'porthole', x: 28.0, y: 33.5, angle: 0.78, beamLen: 5.8 },
    { kind: 'porthole', x: 72.0, y: 36.0, angle: 2.35, beamLen: 5.4 },
    { kind: 'beam', x: 18.0, y: 31.8, len: 5.2, angle: 0 },
    { kind: 'beam', x: 40.0, y: 32.0, len: 4.8, angle: 0.08 },
    { kind: 'pipe', x: 66.0, y: 42.5, len: 12.0, angle: -0.05 },
    { kind: 'propeller', x: 94.0, y: 40.5, scale: 1.25, angle: 0.22 },
  ],

  segments: [
    // Forward Cargo Hold #1 Hatch Drop (Deck 26m -> Upper Tween Deck 34m)
    { ax: 10, ay: 23.5, bx: 10, by: 34.5, ra: 4.4, rb: 4.0 },

    // Bow Forepeak Chain Locker (guarded by watertight hatch!)
    { ax: 10, ay: 34.5, bx: -14, by: 34.8, ra: 3.1, rb: 2.6 },

    // Main Cargo Holds #1 & #2 (Bedford Trucks & BSA Motorcycles at 34m)
    { ax: 10, ay: 34.5, bx: 42, by: 34.5, ra: 3.9, rb: 3.8 },

    // Midships Ammunition Blast Crater Open Breach (34m -> 43.5m Seabed Locomotive Pit)
    { ax: 42, ay: 34.5, bx: 55, by: 38.5, ra: 3.8, rb: 4.6 },
    { ax: 55, ay: 38.5, bx: 55, by: 44.0, ra: 4.6, rb: 4.2 },
    // Open breach upward back to reef daylight above blast crater
    { ax: 55, ay: 38.5, bx: 55, by: 25.0, ra: 4.6, rb: 4.8 },

    // Lower Stern Hold & Ammunition Magazine (44m)
    { ax: 55, ay: 44.0, bx: 78, by: 42.5, ra: 3.6, rb: 3.2 },
    // Sealed Stern Gun-Crew Locker beyond hatch
    { ax: 78, ay: 42.5, bx: 90, by: 41.0, ra: 2.9, rb: 2.5 },

    // Aft Return Hatchway back up to Stern Deck (42.5m -> 24m)
    { ax: 78, ay: 42.5, bx: 78, by: 24.0, ra: 3.4, rb: 4.2 },

    // === Secret Sonar-Only Submerged Engine-Room Vault -> Iron Leviathan Arena (v189) ===
    // Sealed behind the far stern bulkhead at (90, 41.0) — completely underground beneath reef/hull!
    { ax: 90.0, ay: 41.0, bx: 100.0, by: 41.5, ra: 1.5, rb: 1.9, secretLair: true },
    // Quiet Armory Anteroom (Munitions Hold)
    { ax: 100.0, ay: 41.5, bx: 114.0, by: 42.0, ra: 2.5, rb: 3.6, secretLair: true },
    // Corridor Chambers 1-4 (Flooded Boiler Passage -> Turbine Tunnel -> Bulkhead Gate)
    { ax: 114.0, ay: 42.0, bx: 136.0, by: 42.5, ra: 3.5, rb: 3.6, secretLair: true },
    { ax: 136.0, ay: 42.5, bx: 158.0, by: 40.5, ra: 3.8, rb: 4.2, secretLair: true },
    { ax: 158.0, ay: 40.5, bx: 180.0, by: 42.0, ra: 4.1, rb: 4.4, secretLair: true },
    { ax: 180.0, ay: 42.0, bx: 204.0, by: 41.0, ra: 4.5, rb: 8.2, secretLair: true },
    // SUNKEN ENGINE VAULT — 58m × 26m Boss Arena centered at (232, 41)
    { ax: 204.0, ay: 41.0, bx: 222.0, by: 41.0, ra: 9.6, rb: 13.0, secretLair: true },
    { ax: 222.0, ay: 41.0, bx: 242.0, by: 41.0, ra: 13.0, rb: 13.0, secretLair: true },
    { ax: 242.0, ay: 41.0, bx: 256.5, by: 41.0, ra: 11.8, rb: 8.6, secretLair: true },
  ],

  guideline: [
    { x: 10, y: 2.0 },
    { x: 10, y: 20.0 },
    { x: 10, y: 26.0 },
    { x: 10, y: 34.5 },
    { x: 42, y: 34.5 },
    { x: 55, y: 38.5 },
    { x: 55, y: 44.0 },
    { x: 78, y: 42.5 },
    { x: 78, y: 25.0 },
    { x: 10, y: 23.0 },
    { x: 10, y: 20.0 },
    { x: 10, y: 6.0 },
  ],

  checkpoints: [
    { id: 'cp1', x: 10, y: 20.0, radius: 5.5, name: '20m Shot Line Buoy', hint: 'EAN32 is safe across the 26m deck — prep TMX 14/55 [2] for the 44m blast crater!' },
    { id: 'cp2', x: 10, y: 26.0, radius: 5.2, name: 'Hold #1 Cargo Hatch', hint: 'Drop into Hold #1 to see the rows of WWII Bedford trucks and motorcycles.' },
    { id: 'cp3', x: 42, y: 34.5, radius: 4.8, name: 'BSA Motorcycle Tween Deck', hint: 'Switch to TMX 14/55 [2] before plunging through the blast crater to 44m!' },
    { id: 'cp4', x: 55, y: 44.0, radius: 5.0, name: '44m Locomotive & Blast Pit', hint: 'Turnaround! Swim east through the stern hold and exit up the aft hatch.' },
    { id: 'cp5', x: 10, y: 20.0, radius: 5.8, name: '20m Ascent Switch Buoy', hint: 'Switch back to EAN32 [1] on the shot line and ascend smoothly.' },
    { id: 'cp6', x: 10, y: 6.0, radius: 5.8, name: '6m O2 Deco Trapeze Bar', hint: 'Switch to O2 100% [3] beneath the liveaboard to clear deco.' },
  ],

  collectibles: [
    { id: 'thi_c1', x: 20, y: 22.0, kind: 'compass', name: 'Bridge Wing Brass Azimuth', points: 220, scale: 1.0, radius: 1.5 },
    { id: 'thi_c2', x: -12, y: 34.8, kind: 'relic', name: 'Forepeak Captain Safe', points: 340, scale: 1.15, radius: 1.5 },
    { id: 'thi_c3', x: 24, y: 34.5, kind: 'gear', name: 'BSA M20 Motorcycle Headlamp', points: 260, scale: 1.05, radius: 1.45 },
    { id: 'thi_c4', x: 40, y: 34.2, kind: 'relic', name: 'Bedford Truck Steering Wheel', points: 280, scale: 1.05, radius: 1.45 },
    { id: 'thi_c5', x: 55, y: 43.8, kind: 'relic', name: 'Stanier 8F Locomotive Whistle', points: 420, scale: 1.3, radius: 1.55 },
    { id: 'thi_c6', x: 70, y: 43.0, kind: 'beacon', name: 'Stern Brass Engine Gauge', points: 320, scale: 1.1, radius: 1.45 },
    { id: 'thi_c7', x: 88, y: 41.2, kind: 'relic', name: '4.7-Inch Deck Gun Sight', points: 480, scale: 1.35, radius: 1.5 },
  ],

  zoneLines: [
    { id: 'zone-tmx', y: 32.0, xMin: 34, xMax: 66, color: '#fbbf24', title: '32m BLAST CRATER — SWITCH TO TMX 14/55 [2]' },
    { id: 'zone-switch', y: 20.0, xMin: -2, xMax: 24, color: '#38bdf8', title: '20m ASCENT SWITCH — EAN32 [1]' },
    { id: 'zone-deco', y: 6.0, xMin: -2, xMax: 24, color: '#34d399', title: '6m O2 DECO TRAPEZE BAR — O2 100% [3]' },
  ],

  depthMarkers: [
    { x: 15, y: 6, label: '6m O2 BAR', color: '#34d399' },
    { x: 15, y: 20, label: '20m EAN32', color: '#38bdf8' },
    { x: 28, y: 25, label: '26m CARGO DECK', color: '#7dd3fc' },
    { x: 30, y: 34, label: '34m HOLD #2 TRUCKS', color: '#fbbf24' },
    { x: 55, y: 45, label: '44m LOCOMOTIVE PIT', color: '#f87171' },
  ],
};
