import { createLevelTheme } from './themes.js';

/**
 * Level 23 (Campaign Rank 18 · Tier IV): Bermuda Crystal Arch & Abyss (Bermuda Platform, Sargasso Sea)
 * Unlined mid-Atlantic sea-cave & coral drop-off expedition with lost telemetry buoy recovery!
 * - Enter a crystalline Bermuda stalactite sinkhole, deploy a 225m reel [G], burst out through
 *   twin glowing turquoise Sargasso sea-wall archWindows, brave pulsing ocean swells, and
 *   recover the Lost Bermuda Telemetry Buoy from 98m before ascending the East Coral Chimney.
 */
export const LEVEL_23 = {
  id: 'bermuda-devils-wall',
  name: 'Bermuda Crystal Arch & Abyss',
  subtitle: 'Bermuda, Sargasso Sea • 102m Unlined Sea-Wall Recovery',
  difficultyRank: 18,
  tier: 4,
  badge: 'Bermuda 102m',
  description:
    'Plunge into Bermuda\'s crystalline aragonite sea-caverns with NO fixed line. Anchor your 225m reel [G], burst through twin turquoise Sargasso sea-wall arches, recover the Lost Bermuda Telemetry Buoy at 98m on hypoxic TMX 11/65, and clear deco in the eastern coral lagoon.',
  bounds: {
    xMin: -40,
    xMax: 448,
    yMin: -6,
    yMax: 124,
  },
  roughness: 0.38,
  spawn: { x: 14, y: 2.0 },
  haloclineY: 32.0,
  parTimeSec: 410,
  lined: false,
  reelMetersPerDiver: 225,
  hideWaypointCompass: true,
  turnaroundCheckpointId: 'cp5',
  ascentSwitchCheckpointId: 'cp6',
  ascentSwitchDepthM: 22.0,
  theme: createLevelTheme('bermuda-sargasso'),

  gasOverrides: {
    TMX1455: {
      name: 'TMX 11/65',
      shortLabel: '11/65',
      role: 'Sargasso Deep (16–135m)',
      fO2: 0.11,
      fHe: 0.65,
      fN2: 0.24,
      tankVolumeL: 36.0,
      modM: 135.0,
      minM: 6.5,
    },
    EAN32: { tankVolumeL: 15.0 },
    O2: { tankVolumeL: 11.0 },
  },

  recoveryTarget: {
    id: 'bermuda-telemetry-buoy',
    name: 'Bermuda Telemetry Buoy',
    kind: 'probe',
    x: 214.0,
    y: 98.0,
    radius: 4.5,
    points: 1800,
  },

  archWindows: [
    // Radiant turquoise Sargasso Sea ocean light beaming through twin coral cliff arches!
    { x: 96, y: 42.0, radiusX: 15.5, radiusY: 9.0 },
    { x: 184, y: 74.0, radiusX: 17.0, radiusY: 10.0 },
  ],

  openBasins: [
    { kind: 'entry', xMin: 6, xMax: 22, rimHalf: 5.6, flareAdd: 2.5, lipTilt: 0.2, floorY: 2.8, sunAngle: 1.48 },
    { kind: 'exit', xMin: 304, xMax: 320, rimHalf: 5.0, flareAdd: 2.3, lipTilt: -0.2, floorY: 2.6, sunAngle: 1.62 },
  ],

  segments: [
    // === CRYSTAL GROTTO ENTRY (0m -> 40m) ===
    { ax: 14, ay: 1.0, bx: 16, by: 20.0, ra: 5.2, rb: 4.2 },
    { ax: 16, ay: 20.0, bx: 48, by: 36.0, ra: 3.8, rb: 3.4 },
    { ax: 48, ay: 36.0, bx: 78, by: 42.0, ra: 3.2, rb: 4.0 },

    // === UPPER SARGASSO SEA-ARCH I (42m) ===
    { ax: 78, ay: 42.0, bx: 116, by: 44.0, ra: 4.6, rb: 4.4 },

    // === SPLIT REEF WALL LABYRINTH (44m -> 74m ARCH II) ===
    // Upper Coral Gallery
    { ax: 116, ay: 44.0, bx: 148, by: 52.0, ra: 3.0, rb: 2.4 },
    { ax: 148, ay: 52.0, bx: 168, by: 72.0, ra: 2.4, rb: 3.6 },
    // Deep Lower Stalactite Tunnel
    { ax: 116, ay: 44.0, bx: 132, by: 68.0, ra: 2.8, rb: 2.6 },
    { ax: 132, ay: 68.0, bx: 168, by: 72.0, ra: 2.6, rb: 3.8 },

    // === DEVIL'S WALL ARCH II (74m) -> 102m SARGASSO ABYSSAL SHELF ===
    { ax: 168, ay: 72.0, bx: 202, by: 76.0, ra: 4.6, rb: 4.2 },
    { ax: 202, ay: 76.0, bx: 214, by: 98.0, ra: 3.6, rb: 4.4 },
    { ax: 214, ay: 98.0, bx: 236, by: 102.0, ra: 4.2, rb: 3.8 },

    // === EAST REEF CHIMNEY ASCENT (102m -> 54m -> 22m -> 6m -> EXIT) ===
    { ax: 236, ay: 102.0, bx: 258, by: 78.0, ra: 3.2, rb: 2.8 },
    { ax: 258, ay: 78.0, bx: 274, by: 54.0, ra: 2.8, rb: 3.2 },
    { ax: 274, ay: 54.0, bx: 286, by: 22.0, ra: 2.8, rb: 3.4 },
    { ax: 286, ay: 22.0, bx: 312, by: 10.0, ra: 3.2, rb: 4.2 },
    { ax: 312, ay: 10.0, bx: 312, by: 1.0, ra: 4.5, rb: 4.8 },

    // === 6 BLIND BERMUDA STALACTITE GROTTOS & DEAD ENDS ===
    // Dead End 1: West Aragonite Mirror Pool
    { ax: 16, ay: 20.0, bx: -14, by: 26.0, ra: 2.4, rb: 2.8 },
    // Dead End 2: High Coral Skylight Dome above Arch I
    { ax: 78, ay: 42.0, bx: 84, by: 22.0, ra: 2.2, rb: 2.7 },
    // Dead End 3: Sunken Galleon Cannon Pocket (68m)
    { ax: 132, ay: 68.0, bx: 104, by: 78.0, ra: 2.3, rb: 2.9 },
    // Dead End 4: Upper Sargasso Reef Loft above Arch II
    { ax: 168, ay: 72.0, bx: 176, by: 50.0, ra: 2.2, rb: 2.6 },
    // Dead End 5: Deep 102m West Abyssal Amphora Pocket
    { ax: 214, ay: 98.0, bx: 184, by: 101.0, ra: 2.5, rb: 3.0 },
    // Dead End 6: East Reef Chimney Coral Alcove
    { ax: 274, ay: 54.0, bx: 304, by: 48.0, ra: 2.3, rb: 2.8 },
    // Hidden East Sargasso Shelf Tunnel -> Old Ironbrow Grumpy Sea Turtle Secret Lair (v269)
    { ax: 236, ay: 102.0, bx: 274, by: 102.0, ra: 3.8, rb: 3.4, secretLair: true },
    { ax: 274, ay: 102.0, bx: 308, by: 100.0, ra: 3.5, rb: 4.0, secretLair: true },
    { ax: 308, ay: 100.0, bx: 334, by: 100.0, ra: 4.6, rb: 4.8, secretLair: true },
    { ax: 334, ay: 100.0, bx: 364, by: 100.0, ra: 4.2, rb: 4.4, secretLair: true },
    { ax: 364, ay: 100.0, bx: 380, by: 100.0, ra: 4.6, rb: 10.5, secretLair: true },
    { ax: 380, ay: 100.0, bx: 420, by: 100.0, ra: 14.0, rb: 14.0, secretLair: true },
  ],

  guideline: [],

  checkpoints: [
    { id: 'cp1', name: 'Crystal Grotto Tie-Off (20m)', x: 16, y: 20.0, radius: 5.0, hint: 'Anchor your 225m reel [G]! Prep hypoxic TMX 11/65 [2] before crossing 32m.' },
    { id: 'cp2', name: 'Sargasso Sea-Arch I (42m)', x: 96, y: 42.0, radius: 5.0, hint: 'Switch to TMX 11/65 [2]! Twin coral tunnels lead down to Devil\'s Wall Arch.' },
    { id: 'cp3', name: 'Devil\'s Wall Arch II (74m)', x: 184, y: 74.0, radius: 5.0, hint: 'Drop beneath the glowing abyssal arch to 98m to recover the lost Telemetry Buoy!' },
    { id: 'cp4', name: '98m Telemetry Buoy Vault', x: 214, y: 98.0, radius: 4.8, hint: 'Secure the Bermuda Telemetry Buoy and tag the 102m shelf turnaround.' },
    { id: 'cp5', name: '102m Sargasso Abyssal Shelf', x: 236, y: 102.0, radius: 4.6, hint: 'Maximum depth 102m! Ascend the East Reef Chimney with the buoy in tow.' },
    { id: 'cp6', name: 'East Chimney Stage Switch (22m)', x: 286, y: 22.0, radius: 4.6, hint: 'Switch back to EAN32 [1] at 22m and cruise into the eastern coral lagoon.' },
    { id: 'cp7', name: '6m Coral Lagoon Deco Shelf', x: 312, y: 6.0, radius: 6.2, hint: 'Switch to O2 100% [3] and clear all deco before surfacing with the buoy.' },
  ],

  collectibles: [
    { id: 'ber_c1', name: 'Pink Bermuda Aragonite Fan', x: -12, y: 26.0, kind: 'crystal', points: 420, scale: 1.35 },
    { id: 'ber_c2', name: 'Grotto Skylight Amber', x: 84, y: 23.0, kind: 'crystal', points: 520, scale: 1.45 },
    { id: 'ber_c3', name: 'Sargasso Arch Pearl', x: 116, y: 44.0, kind: 'pearl', points: 340, scale: 1.1 },
    { id: 'ber_c4', name: '1609 Sea Venture Astrolabe', x: 106, y: 77.5, kind: 'relic', points: 880, scale: 1.7 },
    { id: 'ber_c5', name: 'Reef Gallery Brass Compass', x: 148, y: 52.0, kind: 'compass', points: 360, scale: 1.1 },
    { id: 'ber_c6', name: 'Upper Wall Coral Crown', x: 176, y: 51.0, kind: 'fossil', points: 580, scale: 1.5 },
    { id: 'ber_c7', name: 'Devil\'s Wall Black Pearl', x: 202, y: 76.0, kind: 'pearl', points: 420, scale: 1.2 },
    { id: 'ber_c8', name: '101m Triangle Flight Transponder', x: 186, y: 100.8, kind: 'beacon', points: 960, scale: 1.85 },
    { id: 'ber_c9', name: 'Abyssal Shelf Quartz Spire', x: 236, y: 102.0, kind: 'crystal', points: 480, scale: 1.25 },
    { id: 'ber_c10', name: 'East Reef Spanish Doubloon', x: 302, y: 48.2, kind: 'relic', points: 720, scale: 1.6 },
    { id: 'ber_c11', name: 'Chimney Drift Survey Reel', x: 258, y: 78.0, kind: 'gear', points: 380, scale: 1.15 },
    { id: 'ber_c12', name: 'Bermuda Sea-Glass Relic', x: 48, y: 36.0, kind: 'relic', points: 290, scale: 1.0 },
  ],

  zoneLines: [
    { id: 'zone-tmx', title: 'SWITCH TO TMX 11/65 AT 30m (MOD 33.7m)', xMin: 24, xMax: 68, y: 33.7, color: '#c084fc' },
    { id: 'zone-ean32-up', title: 'ASCENT SWITCH -> EAN32 (22m)', xMin: 274, xMax: 298, y: 22.0, color: '#38bdf8' },
    { id: 'zone-deco', title: '6m DECO LINE · SWITCH TO O2 100%', xMin: 304, xMax: 320, y: 6.0, color: '#4ade80' },
  ],

  depthMarkers: [
    { x: 96, y: 42, label: '42m • SARGASSO SEA-ARCH I', color: 'rgba(94, 234, 212, 0.78)' },
    { x: 184, y: 74, label: '74m • DEVIL\'S WALL ARCH II', color: 'rgba(56, 189, 248, 0.78)' },
    { x: 214, y: 100, label: '98m • TELEMETRY BUOY VAULT', color: 'rgba(251, 191, 36, 0.85)' },
  ],

  exitZone: {
    name: 'East Coral Lagoon Exit',
    x: 312,
    y: 1.5,
    radius: 5.5,
  },
};
