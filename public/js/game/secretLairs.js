/**
 * Hidden Sonar-Only Secret Lairs, Twin-Stick Speargun Combat & Multi-Diver Boss Encounters (v182).
 *
 * Data-driven per-level registry (`SECRET_LAIRS`) so any of the 33 campaign sites can declare:
 *   - A subtle Sonar-only tight-squeeze offshoot at the bottom of the cave (zero direct callout!)
 *   - Bulletproof tight-squeeze planar veil seal + auto-breach failsafe so the lair can never load empty
 *   - A quiet Armory Anteroom granting the Mounted-Torch Titanium Speargun BEFORE any enemies
 *   - Pure Combat Mode (`combatMode`): hides diving telemetry/controls & freezes gas/DCS/tox physiology
 *   - Twin-stick hold autofire (`0.25s`) + faster tap-to-fire (`0.16s`) + automatic 5th-shot Hyper-Tip pierce
 *   - Atmospheric 4-chamber corridor gauntlet with environmental storytelling & Kraken shadow foreshadowing
 *   - Massive 58m × 26m dynamically lit cathedral (*The Sunken Sanctum*) with:
 *       * Interactive 3.2s Boss Awakening sequence (dim cathedral -> glowing eyes -> sequential sconces -> roar)
 *       * 3 Cover Pillars topped with chargeable Acoustic Resonance Crystals (3 hits or 1 Hyper-Tip -> Stun!)
 *       * Matador Pillar-Bait: lure the Kraken's lunge straight into a pillar for a massive crash stun!
 *       * Phase 2/3 Pillar-Occluded Sweeping Bioluminescent Abyssal Beam
 *       * Phase-Shift Chromatic Surges (Cyan -> Amethyst -> Crimson) with hitstop & projectile-clearing shockwaves
 *       * Multi-stage slow-mo killing blow collapse + soaring thermal updraft finale
 *   - Dynamic difficulty scaling for 1–4 divers (human co-op + helpful AI wingmen) & host-authoritative co-op sync
 *
 * Pure ES module with zero DOM dependencies.
 */

import { evaluateCaveSDF } from './collision.js';
import { spawnSiltPlume } from './silt.js';
import { triggerCameraKick, pushDashSlipstreamArc } from './renderers/underwaterJuiceRenderer.js';

export const SPEARGUN_AUTOFIRE_SEC = 0.25;
export const SPEARGUN_TAP_COOLDOWN_SEC = 0.16;
export const SPEARGUN_RELOAD_SEC = SPEARGUN_AUTOFIRE_SEC;
export const SPEARGUN_MAX_CHARGE_SEC = 1.05;
export const SPEARGUN_BASE_DAMAGE = 20;
export const SPEARGUN_HYPER_MULT = 1.60;
export const SPEARGUN_MAX_CHARGE_MULT = 2.45;
export const SPEARGUN_WEAKPOINT_MULT = 1.55;
export const COMBAT_MAX_HP = 100;
export const RESONANCE_MAX_CHARGE = 3;
export const RESONANCE_COOLDOWN_SEC = 16.5;
export const BOSS_BATTERY_RECHARGE_PCT = 45;
export const WEAPON_UPGRADE_MAX_LEVEL = 2;
export const SCOOTER_DASH_COST_PCT = 12;
export const SCOOTER_DASH_COOLDOWN_SEC = 0.85;
export const SCOOTER_DASH_DURATION_SEC = 0.26;
export const SCOOTER_DASH_IFRAMES_SEC = 0.34;
export const SCOOTER_DASH_SPEED = 16.5;
export const STALACTITE_MAX_HP = 2;
export const STALACTITE_CRUSH_DAMAGE = 260;
export const STALACTITE_RESPAWN_SEC = 24.0;

export const BOSS_WEAPON_UPGRADE_ORDER = Object.freeze(['twin', 'rapid', 'overcharge', 'homing']);

export const BOSS_WEAPON_UPGRADES = Object.freeze({
  twin: Object.freeze({
    id: 'twin',
    name: 'Split Barrel',
    shortLabel: 'SPLIT',
    lv1Label: 'TWIN SPLIT',
    lv2Label: 'TRI-FAN',
    icon: '🔱',
    color: '#38bdf8',
    maxLevel: WEAPON_UPGRADE_MAX_LEVEL,
  }),
  rapid: Object.freeze({
    id: 'rapid',
    name: 'Turbo Pneumatic',
    shortLabel: 'RAPID',
    lv1Label: 'RAPID FIRE',
    lv2Label: 'HYPER CYCLER',
    icon: '⚡',
    color: '#fbbf24',
    maxLevel: WEAPON_UPGRADE_MAX_LEVEL,
  }),
  overcharge: Object.freeze({
    id: 'overcharge',
    name: 'Plasma Core',
    shortLabel: 'PLASMA',
    lv1Label: 'OVERCHARGE',
    lv2Label: 'PLASMA MAX',
    icon: '🔥',
    color: '#fb7185',
    maxLevel: WEAPON_UPGRADE_MAX_LEVEL,
  }),
  homing: Object.freeze({
    id: 'homing',
    name: 'Seeker Sonar',
    shortLabel: 'SEEKER',
    lv1Label: 'SEEKER LOCK',
    lv2Label: 'OMNI SEEKER',
    icon: '🎯',
    color: '#c084fc',
    maxLevel: WEAPON_UPGRADE_MAX_LEVEL,
  }),
});

export const SECRET_LAIRS = Object.freeze({
  'cenote-el-abismo': Object.freeze({
    id: 'cenote-sunken-sanctum',
    levelId: 'cenote-el-abismo',
    name: 'The Sunken Sanctum',
    veil: Object.freeze({
      id: 'l1-sanctum-veil',
      x: 136.2,
      y: 50.1,
      radius: 2.2,
      sealWallX: 134.8,
      sealMinY: 46.2,
      sealMaxY: 54.4,
      failsafeX: 141.5,
      label: 'Narrow Abyssal Seam',
      silent: true,
    }),
    armory: Object.freeze({
      id: 'l1-speargun-rack',
      x: 151.5,
      y: 48.8,
      radius: 3.1,
      weaponName: 'Pneumatic Titanium Speargun',
      hint: '',
    }),
    landmarks: Object.freeze([
      // Quiet Armory Anteroom: salvaged 1980s expedition crate & flickering dive strobe
      Object.freeze({ kind: 'expedition-crate', x: 148.2, y: 50.9 }),
      Object.freeze({ kind: 'dive-strobe', x: 154.0, y: 46.8 }),
      // Chamber 1: Moray Trench (jagged vents & sea-whips)
      Object.freeze({ kind: 'thermal-vent', x: 162.0, y: 50.8 }),
      Object.freeze({ kind: 'sea-whips', x: 170.5, y: 49.8 }),
      // Chamber 2: Bioluminescent Brine Grotto
      Object.freeze({ kind: 'brine-pool', x: 185.5, y: 48.2, width: 7.5 }),
      Object.freeze({ kind: 'bio-coral', x: 192.5, y: 40.6 }),
      // Chamber 3: Sunken Ossuary Bend (whale-scale ribs, cracked helmet, Mayan glyphs)
      Object.freeze({ kind: 'rib-arch', x: 201.5, y: 44.5, scale: 1.0 }),
      Object.freeze({ kind: 'vintage-helmet', x: 206.8, y: 48.1 }),
      Object.freeze({ kind: 'rib-arch', x: 211.5, y: 45.8, scale: 1.15 }),
      Object.freeze({ kind: 'mayan-glyphs', x: 215.5, y: 43.2 }),
      // Chamber 4: The Guardian Gate (carved temple columns & deep Kraken claw gouges)
      Object.freeze({ kind: 'temple-column', x: 223.0, y: 45.8 }),
      Object.freeze({ kind: 'claw-scars', x: 230.5, y: 42.4 }),
      Object.freeze({ kind: 'temple-column', x: 236.5, y: 44.0 }),
      // Grand Sanctum Archway: Twin Serpent/Kraken Monoliths
      Object.freeze({ kind: 'monolith', x: 247.5, y: 36.2, side: 'top' }),
      Object.freeze({ kind: 'monolith', x: 247.5, y: 45.4, side: 'bottom' }),
    ]),
    foreshadowX: 199.5,
    arena: Object.freeze({
      cx: 278.0,
      cy: 40.5,
      triggerX: 252.0,
      rx: 28.0,
      ry: 14.0,
      respawnX: 245.5,
      respawnY: 42.2,
      pillars: Object.freeze([
        Object.freeze({ id: 'p-west', x: 262.0, y: 44.2, radius: 2.1 }),
        Object.freeze({ id: 'p-north', x: 277.0, y: 32.8, radius: 2.0 }),
        Object.freeze({ id: 'p-east', x: 292.5, y: 44.5, radius: 2.1 }),
      ]),
      lightSconces: Object.freeze([
        Object.freeze({ x: 256.5, y: 34.0, color: '#38bdf8', radius: 13.5 }),
        Object.freeze({ x: 266.0, y: 50.5, color: '#2dd4bf', radius: 14.5 }),
        Object.freeze({ x: 271.0, y: 29.5, color: '#22d3ee', radius: 15.0 }),
        Object.freeze({ x: 289.0, y: 29.8, color: '#38bdf8', radius: 15.0 }),
        Object.freeze({ x: 289.5, y: 50.2, color: '#2dd4bf', radius: 14.5 }),
        Object.freeze({ x: 300.5, y: 37.5, color: '#38bdf8', radius: 13.5 }),
      ]),
      bossAnchors: Object.freeze([
        Object.freeze({ x: 286.0, y: 40.5 }),
        Object.freeze({ x: 271.0, y: 39.2 }),
        Object.freeze({ x: 291.0, y: 37.5 }),
        Object.freeze({ x: 277.5, y: 45.2 }),
      ]),
      gasCaches: Object.freeze([
        Object.freeze({ id: 'l1-arena-stage-1', x: 257.0, y: 38.0, label: 'Sanctum Rim Stage (West)' }),
        Object.freeze({ id: 'l1-arena-stage-2', x: 276.0, y: 50.0, label: 'Sanctum Rim Stage (South)' }),
        Object.freeze({ id: 'l1-arena-stage-3', x: 298.0, y: 41.0, label: 'Sanctum Rim Stage (East)' }),
        Object.freeze({ id: 'l1-arena-stage-4', x: 281.0, y: 30.5, label: 'Sanctum Rim Stage (North)' }),
      ]),
      midStage: Object.freeze({
        id: 'l1-corridor-stage',
        x: 196.0,
        y: 43.2,
        label: 'Salvaged Expedition Bailout Stage',
      }),
      pickupPads: Object.freeze([
        Object.freeze({ id: 'pad-west', x: 257.5, y: 38.2 }),
        Object.freeze({ id: 'pad-north-west', x: 268.0, y: 34.0 }),
        Object.freeze({ id: 'pad-south', x: 277.0, y: 49.4 }),
        Object.freeze({ id: 'pad-north-east', x: 288.0, y: 33.8 }),
        Object.freeze({ id: 'pad-east', x: 298.0, y: 41.0 }),
        Object.freeze({ id: 'pad-south-east', x: 290.5, y: 49.0 }),
      ]),
      corridorBattery: Object.freeze({ x: 196.0, y: 43.2 }),
      corridorUpgrade: Object.freeze({ x: 213.5, y: 44.6, kind: 'twin' }),
      stalactites: Object.freeze([
        Object.freeze({ id: 'stal-l1-w', x: 267.5, y: 29.0, floorY: 51.5, style: 'limestone' }),
        Object.freeze({ id: 'stal-l1-c', x: 279.5, y: 28.4, floorY: 52.0, style: 'limestone' }),
        Object.freeze({ id: 'stal-l1-e', x: 290.5, y: 29.2, floorY: 51.5, style: 'limestone' }),
      ]),
      exitUpdraft: Object.freeze({
        x: 278.0,
        y: 32.0,
        radius: 3.6,
        destX: 138.0,
        destY: 7.4,
        label: 'Bioluminescent Thermal Updraft → 6m Deco Shelf',
      }),
    }),
    minions: Object.freeze([
      // Chamber 1: Moray Trench (well past Armory so player always gets weapon first!)
      Object.freeze({ id: 'm-moray-1', kind: 'moray', name: 'Abyssal Cave Moray', x: 165.5, y: 47.6, hp: 92, radius: 1.18, dropOrb: true }),
      Object.freeze({ id: 'm-moray-2', kind: 'moray', name: 'Abyssal Cave Moray', x: 173.5, y: 47.2, hp: 98, radius: 1.18, dropOrb: false }),
      // Chamber 2: Bioluminescent Brine Grotto
      Object.freeze({ id: 'm-swarmer-1', kind: 'swarmer', name: 'Brine Spitter Swarmer', x: 183.0, y: 45.2, hp: 74, radius: 1.0, dropOrb: false }),
      Object.freeze({ id: 'm-swarmer-2', kind: 'swarmer', name: 'Brine Spitter Swarmer', x: 189.5, y: 43.6, hp: 74, radius: 1.0, dropOrb: true }),
      Object.freeze({ id: 'm-swarmer-3', kind: 'swarmer', name: 'Brine Spitter Swarmer', x: 194.5, y: 44.2, hp: 78, radius: 1.0, dropOrb: false }),
      // Chamber 3: Sunken Ossuary Bend
      Object.freeze({ id: 'm-moray-3', kind: 'moray', name: 'Abyssal Cave Moray', x: 204.5, y: 44.8, hp: 104, radius: 1.2, dropOrb: false }),
      Object.freeze({ id: 'm-swarmer-4', kind: 'swarmer', name: 'Brine Spitter Swarmer', x: 210.0, y: 45.6, hp: 82, radius: 1.0, dropOrb: true }),
      Object.freeze({ id: 'm-moray-4', kind: 'moray', name: 'Abyssal Cave Moray', x: 215.5, y: 46.5, hp: 104, radius: 1.2, dropOrb: false }),
      // Chamber 4: The Guardian Gate (Armored Cenote Stalkers — flank or use 5th-shot Hyper-Tip!)
      Object.freeze({ id: 'm-stalker-1', kind: 'stalker', name: 'Armored Cenote Stalker', x: 225.5, y: 45.6, hp: 185, radius: 1.52, dropOrb: true }),
      Object.freeze({ id: 'm-stalker-2', kind: 'stalker', name: 'Armored Cenote Stalker', x: 235.0, y: 43.8, hp: 198, radius: 1.52, dropOrb: true }),
    ]),
    boss: Object.freeze({
      id: 'boss-xibalba-kraken',
      kind: 'cave-kraken',
      musicTheme: 'kraken',
      icon: '🐙',
      name: "XIBALBA'S MAW",
      title: 'Ancient Bioluminescent Cave Kraken',
      x: 285.0,
      y: 40.5,
      radius: 4.4,
      baseHp: 3800,
      trophyRelicId: 'l1-kraken-crown',
      trophyName: 'Abyssal Kraken Crown',
      bonusPoints: 2500,
    }),
  }),

  // === BOSS 2 (Shipwreck Secret Lair): SS Thistlegorm WWII Wreck -> IRON LEVIATHAN MK-IV ===
  'ss-thistlegorm-wreck': Object.freeze({
    id: 'thistlegorm-engine-vault',
    levelId: 'ss-thistlegorm-wreck',
    name: 'The Sunken Engine Vault',
    veil: Object.freeze({
      id: 'thi-vault-veil',
      x: 92.2,
      y: 41.1,
      radius: 2.2,
      sealWallX: 91.0,
      sealMinY: 37.5,
      sealMaxY: 45.5,
      failsafeX: 97.5,
      label: 'Buckled Boiler Bulkhead Seam',
      silent: true,
    }),
    armory: Object.freeze({
      id: 'thi-speargun-rack',
      x: 108.5,
      y: 41.8,
      radius: 3.1,
      weaponName: 'Pneumatic Titanium Speargun',
      hint: '',
    }),
    landmarks: Object.freeze([
      Object.freeze({ kind: 'expedition-crate', x: 105.5, y: 43.5 }),
      Object.freeze({ kind: 'dive-strobe', x: 111.5, y: 39.8 }),
      Object.freeze({ kind: 'thermal-vent', x: 126.0, y: 44.5 }),
      Object.freeze({ kind: 'vintage-helmet', x: 150.0, y: 43.0 }),
      Object.freeze({ kind: 'temple-column', x: 172.0, y: 42.0 }),
      Object.freeze({ kind: 'claw-scars', x: 186.0, y: 41.0 }),
      Object.freeze({ kind: 'monolith', x: 201.5, y: 36.8, side: 'top' }),
      Object.freeze({ kind: 'monolith', x: 201.5, y: 45.5, side: 'bottom' }),
    ]),
    foreshadowX: 152.0,
    arena: Object.freeze({
      cx: 232.0,
      cy: 41.0,
      triggerX: 206.0,
      rx: 28.0,
      ry: 13.5,
      respawnX: 199.5,
      respawnY: 41.5,
      pillars: Object.freeze([
        Object.freeze({ id: 'thi-p-west', x: 216.5, y: 44.5, radius: 2.1 }),
        Object.freeze({ id: 'thi-p-north', x: 231.5, y: 33.4, radius: 2.0 }),
        Object.freeze({ id: 'thi-p-east', x: 246.5, y: 44.8, radius: 2.1 }),
      ]),
      lightSconces: Object.freeze([
        Object.freeze({ x: 211.0, y: 34.5, color: '#f59e0b', radius: 13.5 }),
        Object.freeze({ x: 221.0, y: 50.5, color: '#38bdf8', radius: 14.5 }),
        Object.freeze({ x: 226.0, y: 30.2, color: '#fbbf24', radius: 15.0 }),
        Object.freeze({ x: 242.5, y: 30.5, color: '#38bdf8', radius: 15.0 }),
        Object.freeze({ x: 243.5, y: 50.2, color: '#f59e0b', radius: 14.5 }),
        Object.freeze({ x: 254.0, y: 38.0, color: '#fbbf24', radius: 13.5 }),
      ]),
      bossAnchors: Object.freeze([
        Object.freeze({ x: 240.0, y: 41.0 }),
        Object.freeze({ x: 225.5, y: 39.8 }),
        Object.freeze({ x: 244.5, y: 38.0 }),
        Object.freeze({ x: 232.0, y: 45.2 }),
      ]),
      gasCaches: Object.freeze([
        Object.freeze({ id: 'thi-stage-1', x: 211.5, y: 38.5, label: 'Engine Vault Rim Stage (West)' }),
        Object.freeze({ id: 'thi-stage-2', x: 231.0, y: 50.0, label: 'Engine Vault Rim Stage (South)' }),
        Object.freeze({ id: 'thi-stage-3', x: 252.0, y: 41.5, label: 'Engine Vault Rim Stage (East)' }),
        Object.freeze({ id: 'thi-stage-4', x: 235.0, y: 31.2, label: 'Engine Vault Rim Stage (North)' }),
      ]),
      midStage: Object.freeze({ id: 'thi-corridor-stage', x: 152.0, y: 41.0, label: 'Boiler Room Bailout Stage' }),
      pickupPads: Object.freeze([
        Object.freeze({ id: 'thi-pad-w', x: 212.0, y: 38.6 }),
        Object.freeze({ id: 'thi-pad-nw', x: 222.5, y: 34.4 }),
        Object.freeze({ id: 'thi-pad-s', x: 231.5, y: 49.4 }),
        Object.freeze({ id: 'thi-pad-ne', x: 242.0, y: 34.2 }),
        Object.freeze({ id: 'thi-pad-e', x: 251.5, y: 41.2 }),
        Object.freeze({ id: 'thi-pad-se', x: 244.0, y: 49.0 }),
      ]),
      corridorBattery: Object.freeze({ x: 150.0, y: 41.2 }),
      corridorUpgrade: Object.freeze({ x: 168.0, y: 41.2, kind: 'rapid' }),
      stalactites: Object.freeze([
        Object.freeze({ id: 'stal-thi-w', x: 222.0, y: 29.8, floorY: 51.8, style: 'steel' }),
        Object.freeze({ id: 'stal-thi-c', x: 233.5, y: 29.2, floorY: 52.0, style: 'steel' }),
        Object.freeze({ id: 'stal-thi-e', x: 244.5, y: 29.8, floorY: 51.6, style: 'steel' }),
      ]),
      exitUpdraft: Object.freeze({
        x: 232.0,
        y: 33.0,
        radius: 3.6,
        destX: 10.0,
        destY: 6.5,
        label: 'Pressurized Steam Updraft → 6m O2 Trapeze Bar',
      }),
    }),
    minions: Object.freeze([
      Object.freeze({ id: 'thi-m1', kind: 'moray', name: 'Hull-Breach Moray', x: 124.0, y: 42.2, hp: 105, radius: 1.2, dropOrb: true }),
      Object.freeze({ id: 'thi-m2', kind: 'swarmer', name: 'Bilge Spitter', x: 138.0, y: 41.8, hp: 82, radius: 1.0, dropOrb: false }),
      Object.freeze({ id: 'thi-m3', kind: 'swarmer', name: 'Bilge Spitter', x: 147.0, y: 40.8, hp: 84, radius: 1.0, dropOrb: true }),
      Object.freeze({ id: 'thi-m4', kind: 'moray', name: 'Turbine Moray', x: 162.0, y: 41.2, hp: 112, radius: 1.22, dropOrb: false }),
      Object.freeze({ id: 'thi-m5', kind: 'stalker', name: 'Riveted Hull Stalker', x: 178.0, y: 41.8, hp: 205, radius: 1.54, dropOrb: true }),
      Object.freeze({ id: 'thi-m6', kind: 'stalker', name: 'Riveted Hull Stalker', x: 190.0, y: 41.5, hp: 215, radius: 1.54, dropOrb: true }),
    ]),
    boss: Object.freeze({
      id: 'boss-iron-leviathan',
      kind: 'iron-leviathan',
      musicTheme: 'iron',
      icon: '⚙️',
      name: 'IRON LEVIATHAN MK-IV',
      title: 'Submerged WWII Angler-Mech Engine Sentinel',
      x: 239.0,
      y: 41.0,
      radius: 4.5,
      baseHp: 4200,
      trophyRelicId: 'thistlegorm-engine-core',
      trophyName: 'Sunken Engine Core',
      bonusPoints: 2800,
    }),
  }),

  // === BOSS 3 (Arctic Iceberg Secret Lair): Scoresby Sund -> BOREALIS WYRM ===
  'scoresby-sund-iceberg': Object.freeze({
    id: 'scoresby-frost-cathedral',
    levelId: 'scoresby-sund-iceberg',
    name: 'The Borealis Frost Vault',
    veil: Object.freeze({
      id: 'sco-vault-veil',
      x: 252.2,
      y: 83.8,
      radius: 2.2,
      sealWallX: 251.0,
      sealMinY: 79.5,
      sealMaxY: 88.0,
      failsafeX: 257.5,
      label: 'Glacial Sapphire Seam',
      silent: true,
    }),
    armory: Object.freeze({
      id: 'sco-speargun-rack',
      x: 268.0,
      y: 82.2,
      radius: 3.1,
      weaponName: 'Pneumatic Titanium Speargun',
      hint: '',
    }),
    landmarks: Object.freeze([
      Object.freeze({ kind: 'expedition-crate', x: 265.0, y: 83.8 }),
      Object.freeze({ kind: 'dive-strobe', x: 271.0, y: 80.2 }),
      Object.freeze({ kind: 'bio-coral', x: 288.0, y: 80.5 }),
      Object.freeze({ kind: 'rib-arch', x: 312.0, y: 76.5, scale: 1.1 }),
      Object.freeze({ kind: 'mayan-glyphs', x: 334.0, y: 74.2 }),
      Object.freeze({ kind: 'monolith', x: 361.5, y: 67.8, side: 'top' }),
      Object.freeze({ kind: 'monolith', x: 361.5, y: 76.5, side: 'bottom' }),
    ]),
    foreshadowX: 312.0,
    arena: Object.freeze({
      cx: 392.0,
      cy: 72.0,
      triggerX: 366.0,
      rx: 28.0,
      ry: 13.5,
      respawnX: 359.5,
      respawnY: 72.5,
      pillars: Object.freeze([
        Object.freeze({ id: 'sco-p-west', x: 376.5, y: 75.5, radius: 2.1 }),
        Object.freeze({ id: 'sco-p-north', x: 391.5, y: 64.4, radius: 2.0 }),
        Object.freeze({ id: 'sco-p-east', x: 406.5, y: 75.8, radius: 2.1 }),
      ]),
      lightSconces: Object.freeze([
        Object.freeze({ x: 371.0, y: 65.5, color: '#67e8f9', radius: 14.0 }),
        Object.freeze({ x: 381.0, y: 81.5, color: '#a5f3fc', radius: 14.5 }),
        Object.freeze({ x: 386.0, y: 61.2, color: '#38bdf8', radius: 15.0 }),
        Object.freeze({ x: 402.5, y: 61.5, color: '#67e8f9', radius: 15.0 }),
        Object.freeze({ x: 403.5, y: 81.2, color: '#a5f3fc', radius: 14.5 }),
        Object.freeze({ x: 414.0, y: 69.0, color: '#38bdf8', radius: 14.0 }),
      ]),
      bossAnchors: Object.freeze([
        Object.freeze({ x: 400.0, y: 72.0 }),
        Object.freeze({ x: 385.5, y: 70.8 }),
        Object.freeze({ x: 404.5, y: 69.0 }),
        Object.freeze({ x: 392.0, y: 76.2 }),
      ]),
      gasCaches: Object.freeze([
        Object.freeze({ id: 'sco-stage-1', x: 371.5, y: 69.5, label: 'Glacial Rim Stage (West)' }),
        Object.freeze({ id: 'sco-stage-2', x: 391.0, y: 81.0, label: 'Glacial Rim Stage (South)' }),
        Object.freeze({ id: 'sco-stage-3', x: 412.0, y: 72.5, label: 'Glacial Rim Stage (East)' }),
        Object.freeze({ id: 'sco-stage-4', x: 395.0, y: 62.2, label: 'Glacial Rim Stage (North)' }),
      ]),
      midStage: Object.freeze({ id: 'sco-corridor-stage', x: 312.0, y: 76.0, label: 'Ice-Vault Bailout Stage' }),
      pickupPads: Object.freeze([
        Object.freeze({ id: 'sco-pad-w', x: 372.0, y: 69.6 }),
        Object.freeze({ id: 'sco-pad-nw', x: 382.5, y: 65.4 }),
        Object.freeze({ id: 'sco-pad-s', x: 391.5, y: 80.4 }),
        Object.freeze({ id: 'sco-pad-ne', x: 402.0, y: 65.2 }),
        Object.freeze({ id: 'sco-pad-e', x: 411.5, y: 72.2 }),
        Object.freeze({ id: 'sco-pad-se', x: 404.0, y: 80.0 }),
      ]),
      corridorBattery: Object.freeze({ x: 310.0, y: 76.5 }),
      corridorUpgrade: Object.freeze({ x: 328.0, y: 74.5, kind: 'homing' }),
      stalactites: Object.freeze([
        Object.freeze({ id: 'stal-sco-w', x: 382.0, y: 60.8, floorY: 82.8, style: 'icicle' }),
        Object.freeze({ id: 'stal-sco-c', x: 393.5, y: 60.2, floorY: 83.0, style: 'icicle' }),
        Object.freeze({ id: 'stal-sco-e', x: 404.5, y: 60.8, floorY: 82.6, style: 'icicle' }),
      ]),
      exitUpdraft: Object.freeze({
        x: 392.0,
        y: 64.0,
        radius: 3.6,
        destX: 290.0,
        destY: 6.5,
        label: 'Aurora Meltwater Updraft → 6m Glacial Deco Shelf',
      }),
    }),
    minions: Object.freeze([
      Object.freeze({ id: 'sco-m1', kind: 'moray', name: 'Glacial Ice Eel', x: 284.0, y: 80.2, hp: 112, radius: 1.2, dropOrb: true }),
      Object.freeze({ id: 'sco-m2', kind: 'swarmer', name: 'Cryo Spitter Jelly', x: 299.0, y: 78.2, hp: 88, radius: 1.0, dropOrb: false }),
      Object.freeze({ id: 'sco-m3', kind: 'swarmer', name: 'Cryo Spitter Jelly', x: 309.0, y: 76.8, hp: 90, radius: 1.0, dropOrb: true }),
      Object.freeze({ id: 'sco-m4', kind: 'moray', name: 'Glacial Ice Eel', x: 324.0, y: 74.8, hp: 118, radius: 1.22, dropOrb: false }),
      Object.freeze({ id: 'sco-m5', kind: 'stalker', name: 'Frost-Carapace Stalker', x: 340.0, y: 73.5, hp: 220, radius: 1.54, dropOrb: true }),
      Object.freeze({ id: 'sco-m6', kind: 'stalker', name: 'Frost-Carapace Stalker', x: 352.0, y: 72.8, hp: 230, radius: 1.54, dropOrb: true }),
    ]),
    boss: Object.freeze({
      id: 'boss-borealis-wyrm',
      kind: 'frost-wyrm',
      musicTheme: 'frost',
      icon: '❄️',
      name: 'BOREALIS WYRM',
      title: 'Crystalline Glacial Fjord Leviathan',
      x: 399.0,
      y: 72.0,
      radius: 4.5,
      baseHp: 4600,
      trophyRelicId: 'scoresby-frost-heart',
      trophyName: 'Heart of Borealis',
      bonusPoints: 3200,
    }),
  }),

  // === BOSS 4 (Deep Abyssal Finale Secret Lair): Krubera-Voronya -> ABYSSAL EMPRESS ===
  'krubera-voronya-sump': Object.freeze({
    id: 'krubera-empress-throne',
    levelId: 'krubera-voronya-sump',
    name: 'Throne of the Abyssal Empress',
    veil: Object.freeze({
      id: 'kru-vault-veil',
      x: 217.2,
      y: 197.6,
      radius: 2.3,
      sealWallX: 216.0,
      sealMinY: 193.5,
      sealMaxY: 202.0,
      failsafeX: 222.5,
      label: 'Everest Abyssal Rift Seam',
      silent: true,
    }),
    armory: Object.freeze({
      id: 'kru-speargun-rack',
      x: 233.0,
      y: 196.4,
      radius: 3.1,
      weaponName: 'Pneumatic Titanium Speargun',
      hint: '',
    }),
    landmarks: Object.freeze([
      Object.freeze({ kind: 'expedition-crate', x: 230.0, y: 198.0 }),
      Object.freeze({ kind: 'dive-strobe', x: 236.0, y: 194.2 }),
      Object.freeze({ kind: 'thermal-vent', x: 254.0, y: 195.8 }),
      Object.freeze({ kind: 'rib-arch', x: 278.0, y: 190.5, scale: 1.15 }),
      Object.freeze({ kind: 'mayan-glyphs', x: 300.0, y: 187.0 }),
      Object.freeze({ kind: 'claw-scars', x: 314.0, y: 185.5 }),
      Object.freeze({ kind: 'monolith', x: 327.5, y: 179.8, side: 'top' }),
      Object.freeze({ kind: 'monolith', x: 327.5, y: 188.5, side: 'bottom' }),
    ]),
    foreshadowX: 278.0,
    arena: Object.freeze({
      cx: 358.0,
      cy: 184.0,
      triggerX: 332.0,
      rx: 28.0,
      ry: 13.5,
      respawnX: 325.5,
      respawnY: 184.5,
      pillars: Object.freeze([
        Object.freeze({ id: 'kru-p-west', x: 342.5, y: 187.5, radius: 2.1 }),
        Object.freeze({ id: 'kru-p-north', x: 357.5, y: 176.4, radius: 2.0 }),
        Object.freeze({ id: 'kru-p-east', x: 372.5, y: 187.8, radius: 2.1 }),
      ]),
      lightSconces: Object.freeze([
        Object.freeze({ x: 337.0, y: 177.5, color: '#c084fc', radius: 14.0 }),
        Object.freeze({ x: 347.0, y: 193.5, color: '#fbbf24', radius: 14.5 }),
        Object.freeze({ x: 352.0, y: 173.2, color: '#a855f7', radius: 15.0 }),
        Object.freeze({ x: 368.5, y: 173.5, color: '#fbbf24', radius: 15.0 }),
        Object.freeze({ x: 369.5, y: 193.2, color: '#c084fc', radius: 14.5 }),
        Object.freeze({ x: 380.0, y: 181.0, color: '#a855f7', radius: 14.0 }),
      ]),
      bossAnchors: Object.freeze([
        Object.freeze({ x: 366.0, y: 184.0 }),
        Object.freeze({ x: 351.5, y: 182.8 }),
        Object.freeze({ x: 370.5, y: 181.0 }),
        Object.freeze({ x: 358.0, y: 188.2 }),
      ]),
      gasCaches: Object.freeze([
        Object.freeze({ id: 'kru-stage-1', x: 337.5, y: 181.5, label: 'Abyssal Rim Stage (West)' }),
        Object.freeze({ id: 'kru-stage-2', x: 357.0, y: 193.0, label: 'Abyssal Rim Stage (South)' }),
        Object.freeze({ id: 'kru-stage-3', x: 378.0, y: 184.5, label: 'Abyssal Rim Stage (East)' }),
        Object.freeze({ id: 'kru-stage-4', x: 361.0, y: 174.2, label: 'Abyssal Rim Stage (North)' }),
      ]),
      midStage: Object.freeze({ id: 'kru-corridor-stage', x: 278.0, y: 190.5, label: 'Abyssal Rift Bailout Stage' }),
      pickupPads: Object.freeze([
        Object.freeze({ id: 'kru-pad-w', x: 338.0, y: 181.6 }),
        Object.freeze({ id: 'kru-pad-nw', x: 348.5, y: 177.4 }),
        Object.freeze({ id: 'kru-pad-s', x: 357.5, y: 192.4 }),
        Object.freeze({ id: 'kru-pad-ne', x: 368.0, y: 177.2 }),
        Object.freeze({ id: 'kru-pad-e', x: 377.5, y: 184.2 }),
        Object.freeze({ id: 'kru-pad-se', x: 370.0, y: 192.0 }),
      ]),
      corridorBattery: Object.freeze({ x: 276.0, y: 190.8 }),
      corridorUpgrade: Object.freeze({ x: 294.0, y: 188.0, kind: 'overcharge' }),
      stalactites: Object.freeze([
        Object.freeze({ id: 'stal-kru-w', x: 348.0, y: 172.8, floorY: 194.8, style: 'onyx' }),
        Object.freeze({ id: 'stal-kru-c', x: 359.5, y: 172.2, floorY: 195.0, style: 'onyx' }),
        Object.freeze({ id: 'stal-kru-e', x: 370.5, y: 172.8, floorY: 194.6, style: 'onyx' }),
      ]),
      exitUpdraft: Object.freeze({
        x: 358.0,
        y: 176.0,
        radius: 3.6,
        destX: 320.0,
        destY: 6.8,
        label: 'Abyssal Sovereign Updraft → 6m Alpine Deco Shelf',
      }),
    }),
    minions: Object.freeze([
      Object.freeze({ id: 'kru-m1', kind: 'moray', name: 'Onyx Rift Moray', x: 249.0, y: 194.8, hp: 122, radius: 1.24, dropOrb: true }),
      Object.freeze({ id: 'kru-m2', kind: 'swarmer', name: 'Royal Void Spitter', x: 264.0, y: 192.8, hp: 96, radius: 1.02, dropOrb: false }),
      Object.freeze({ id: 'kru-m3', kind: 'swarmer', name: 'Royal Void Spitter', x: 274.0, y: 191.2, hp: 98, radius: 1.02, dropOrb: true }),
      Object.freeze({ id: 'kru-m4', kind: 'moray', name: 'Onyx Rift Moray', x: 290.0, y: 188.5, hp: 128, radius: 1.24, dropOrb: false }),
      Object.freeze({ id: 'kru-m5', kind: 'stalker', name: 'Empress Royal Guard', x: 306.0, y: 186.2, hp: 245, radius: 1.56, dropOrb: true }),
      Object.freeze({ id: 'kru-m6', kind: 'stalker', name: 'Empress Royal Guard', x: 318.0, y: 185.0, hp: 255, radius: 1.56, dropOrb: true }),
    ]),
    boss: Object.freeze({
      id: 'boss-abyssal-empress',
      kind: 'abyssal-empress',
      musicTheme: 'empress',
      icon: '👑',
      name: 'ABYSSAL EMPRESS',
      title: 'Sovereign Bioluminescent Manta-Hydra Queen',
      x: 365.0,
      y: 184.0,
      radius: 4.8,
      baseHp: 5200,
      trophyRelicId: 'krubera-empress-diadem',
      trophyName: 'Abyssal Empress Diadem',
      bonusPoints: 4000,
    }),
  }),

  // === BOSS 5 (Red Sea Reef Secret Lair): Blue Hole & The Arch -> SOLAR LEVIATHAN (v193) ===
  'blue-hole-dahab-arch': Object.freeze({
    id: 'bluehole-helios-grotto',
    levelId: 'blue-hole-dahab-arch',
    name: 'The Sunken Helios Grotto',
    veil: Object.freeze({
      id: 'bh-vault-veil',
      x: 292.2,
      y: 52.2,
      radius: 2.2,
      sealWallX: 291.0,
      sealMinY: 48.0,
      sealMaxY: 56.5,
      failsafeX: 297.5,
      label: 'Sunlit Coral Reef Seam',
      silent: true,
    }),
    armory: Object.freeze({
      id: 'bh-speargun-rack',
      x: 308.0,
      y: 53.8,
      radius: 3.1,
      weaponName: 'Pneumatic Titanium Speargun',
      hint: '',
    }),
    landmarks: Object.freeze([
      Object.freeze({ kind: 'expedition-crate', x: 305.0, y: 55.4 }),
      Object.freeze({ kind: 'dive-strobe', x: 311.0, y: 51.8 }),
      Object.freeze({ kind: 'bio-coral', x: 328.0, y: 55.5 }),
      Object.freeze({ kind: 'temple-column', x: 352.0, y: 58.5 }),
      Object.freeze({ kind: 'mayan-glyphs', x: 374.0, y: 60.2 }),
      Object.freeze({ kind: 'monolith', x: 401.5, y: 57.8, side: 'top' }),
      Object.freeze({ kind: 'monolith', x: 401.5, y: 66.5, side: 'bottom' }),
    ]),
    foreshadowX: 352.0,
    arena: Object.freeze({
      cx: 432.0,
      cy: 62.0,
      triggerX: 406.0,
      rx: 28.0,
      ry: 13.5,
      respawnX: 399.5,
      respawnY: 62.0,
      pillars: Object.freeze([
        Object.freeze({ id: 'bh-p-west', x: 416.5, y: 65.5, radius: 2.1 }),
        Object.freeze({ id: 'bh-p-north', x: 431.5, y: 54.4, radius: 2.0 }),
        Object.freeze({ id: 'bh-p-east', x: 446.5, y: 65.8, radius: 2.1 }),
      ]),
      lightSconces: Object.freeze([
        Object.freeze({ x: 411.0, y: 55.5, color: '#fde047', radius: 14.5 }),
        Object.freeze({ x: 421.0, y: 71.5, color: '#38bdf8', radius: 14.5 }),
        Object.freeze({ x: 426.0, y: 51.2, color: '#facc15', radius: 15.5 }),
        Object.freeze({ x: 442.5, y: 51.5, color: '#fde047', radius: 15.5 }),
        Object.freeze({ x: 443.5, y: 71.2, color: '#2dd4bf', radius: 14.5 }),
        Object.freeze({ x: 454.0, y: 59.0, color: '#facc15', radius: 14.0 }),
      ]),
      bossAnchors: Object.freeze([
        Object.freeze({ x: 440.0, y: 62.0 }),
        Object.freeze({ x: 425.5, y: 60.8 }),
        Object.freeze({ x: 444.5, y: 59.0 }),
        Object.freeze({ x: 432.0, y: 66.2 }),
      ]),
      gasCaches: Object.freeze([
        Object.freeze({ id: 'bh-stage-1', x: 411.5, y: 59.5, label: 'Helios Rim Stage (West)' }),
        Object.freeze({ id: 'bh-stage-2', x: 431.0, y: 71.0, label: 'Helios Rim Stage (South)' }),
        Object.freeze({ id: 'bh-stage-3', x: 452.0, y: 62.5, label: 'Helios Rim Stage (East)' }),
        Object.freeze({ id: 'bh-stage-4', x: 435.0, y: 52.2, label: 'Helios Rim Stage (North)' }),
      ]),
      midStage: Object.freeze({ id: 'bh-corridor-stage', x: 352.0, y: 58.2, label: 'Reef Grotto Bailout Stage' }),
      pickupPads: Object.freeze([
        Object.freeze({ id: 'bh-pad-w', x: 412.0, y: 59.6 }),
        Object.freeze({ id: 'bh-pad-nw', x: 422.5, y: 55.4 }),
        Object.freeze({ id: 'bh-pad-s', x: 431.5, y: 70.4 }),
        Object.freeze({ id: 'bh-pad-ne', x: 442.0, y: 55.2 }),
        Object.freeze({ id: 'bh-pad-e', x: 451.5, y: 62.2 }),
        Object.freeze({ id: 'bh-pad-se', x: 444.0, y: 70.0 }),
      ]),
      corridorBattery: Object.freeze({ x: 350.0, y: 58.5 }),
      corridorUpgrade: Object.freeze({ x: 368.0, y: 60.0, kind: 'twin' }),
      stalactites: Object.freeze([
        Object.freeze({ id: 'stal-bh-w', x: 422.0, y: 50.8, floorY: 72.8, style: 'coral' }),
        Object.freeze({ id: 'stal-bh-c', x: 433.5, y: 50.2, floorY: 73.0, style: 'coral' }),
        Object.freeze({ id: 'stal-bh-e', x: 444.5, y: 50.8, floorY: 72.6, style: 'coral' }),
      ]),
      exitUpdraft: Object.freeze({
        x: 432.0,
        y: 54.0,
        radius: 3.6,
        destX: 304.5,
        destY: 6.0,
        label: 'Solar Caustic Updraft → Bells 6m Deco Chasm',
      }),
    }),
    minions: Object.freeze([
      Object.freeze({ id: 'bh-m1', kind: 'moray', name: 'Red Sea Sun Moray', x: 324.0, y: 55.5, hp: 108, radius: 1.2, dropOrb: true }),
      Object.freeze({ id: 'bh-m2', kind: 'swarmer', name: 'Caustic Reef Jelly', x: 339.0, y: 57.2, hp: 85, radius: 1.0, dropOrb: false }),
      Object.freeze({ id: 'bh-m3', kind: 'swarmer', name: 'Caustic Reef Jelly', x: 349.0, y: 58.2, hp: 88, radius: 1.0, dropOrb: true }),
      Object.freeze({ id: 'bh-m4', kind: 'moray', name: 'Red Sea Sun Moray', x: 364.0, y: 59.5, hp: 115, radius: 1.22, dropOrb: false }),
      Object.freeze({ id: 'bh-m5', kind: 'stalker', name: 'Coral-Shell Stalker', x: 380.0, y: 60.8, hp: 215, radius: 1.54, dropOrb: true }),
      Object.freeze({ id: 'bh-m6', kind: 'stalker', name: 'Coral-Shell Stalker', x: 392.0, y: 61.5, hp: 225, radius: 1.54, dropOrb: true }),
    ]),
    boss: Object.freeze({
      id: 'boss-solar-leviathan',
      kind: 'solar-leviathan',
      musicTheme: 'solar',
      icon: '☀️',
      name: 'SOLAR LEVIATHAN',
      title: 'Radiant Red Sea Caustic Reef Serpent',
      x: 439.0,
      y: 62.0,
      radius: 4.5,
      baseHp: 4400,
      trophyRelicId: 'bluehole-solar-prism',
      trophyName: 'Solar Reef Prism',
      bonusPoints: 3000,
    }),
  }),

  // === BOSS 6 (Iceland Geothermal Secret Lair): Strýtan -> HYDROTHERMAL NAUTILUS (v193) ===
  'strytan-hydrothermal-chimneys': Object.freeze({
    id: 'strytan-caldron-vault',
    levelId: 'strytan-hydrothermal-chimneys',
    name: 'The Caldron Spire Vault',
    veil: Object.freeze({
      id: 'str-vault-veil',
      x: 276.2,
      y: 88.2,
      radius: 2.2,
      sealWallX: 275.0,
      sealMinY: 84.0,
      sealMaxY: 92.5,
      failsafeX: 281.5,
      label: 'Geothermal Basalt Seam',
      silent: true,
    }),
    armory: Object.freeze({
      id: 'str-speargun-rack',
      x: 292.0,
      y: 89.8,
      radius: 3.1,
      weaponName: 'Pneumatic Titanium Speargun',
      hint: '',
    }),
    landmarks: Object.freeze([
      Object.freeze({ kind: 'expedition-crate', x: 289.0, y: 91.4 }),
      Object.freeze({ kind: 'dive-strobe', x: 295.0, y: 87.8 }),
      Object.freeze({ kind: 'thermal-vent', x: 312.0, y: 92.2 }),
      Object.freeze({ kind: 'thermal-vent', x: 336.0, y: 95.0 }),
      Object.freeze({ kind: 'temple-column', x: 358.0, y: 96.2 }),
      Object.freeze({ kind: 'monolith', x: 385.5, y: 93.8, side: 'top' }),
      Object.freeze({ kind: 'monolith', x: 385.5, y: 102.5, side: 'bottom' }),
    ]),
    foreshadowX: 336.0,
    arena: Object.freeze({
      cx: 416.0,
      cy: 98.0,
      triggerX: 390.0,
      rx: 28.0,
      ry: 13.5,
      respawnX: 383.5,
      respawnY: 98.0,
      pillars: Object.freeze([
        Object.freeze({ id: 'str-p-west', x: 400.5, y: 101.5, radius: 2.1 }),
        Object.freeze({ id: 'str-p-north', x: 415.5, y: 90.4, radius: 2.0 }),
        Object.freeze({ id: 'str-p-east', x: 430.5, y: 101.8, radius: 2.1 }),
      ]),
      lightSconces: Object.freeze([
        Object.freeze({ x: 395.0, y: 91.5, color: '#fb923c', radius: 14.0 }),
        Object.freeze({ x: 405.0, y: 107.5, color: '#f97316', radius: 14.5 }),
        Object.freeze({ x: 410.0, y: 87.2, color: '#fbbf24', radius: 15.0 }),
        Object.freeze({ x: 426.5, y: 87.5, color: '#fb923c', radius: 15.0 }),
        Object.freeze({ x: 427.5, y: 107.2, color: '#ef4444', radius: 14.5 }),
        Object.freeze({ x: 438.0, y: 95.0, color: '#fbbf24', radius: 14.0 }),
      ]),
      bossAnchors: Object.freeze([
        Object.freeze({ x: 424.0, y: 98.0 }),
        Object.freeze({ x: 409.5, y: 96.8 }),
        Object.freeze({ x: 428.5, y: 95.0 }),
        Object.freeze({ x: 416.0, y: 102.2 }),
      ]),
      gasCaches: Object.freeze([
        Object.freeze({ id: 'str-stage-1', x: 395.5, y: 95.5, label: 'Caldron Rim Stage (West)' }),
        Object.freeze({ id: 'str-stage-2', x: 415.0, y: 107.0, label: 'Caldron Rim Stage (South)' }),
        Object.freeze({ id: 'str-stage-3', x: 436.0, y: 98.5, label: 'Caldron Rim Stage (East)' }),
        Object.freeze({ id: 'str-stage-4', x: 419.0, y: 88.2, label: 'Caldron Rim Stage (North)' }),
      ]),
      midStage: Object.freeze({ id: 'str-corridor-stage', x: 336.0, y: 94.2, label: 'Smectite Rift Bailout Stage' }),
      pickupPads: Object.freeze([
        Object.freeze({ id: 'str-pad-w', x: 396.0, y: 95.6 }),
        Object.freeze({ id: 'str-pad-nw', x: 406.5, y: 91.4 }),
        Object.freeze({ id: 'str-pad-s', x: 415.5, y: 106.4 }),
        Object.freeze({ id: 'str-pad-ne', x: 426.0, y: 91.2 }),
        Object.freeze({ id: 'str-pad-e', x: 435.5, y: 98.2 }),
        Object.freeze({ id: 'str-pad-se', x: 428.0, y: 106.0 }),
      ]),
      corridorBattery: Object.freeze({ x: 334.0, y: 94.5 }),
      corridorUpgrade: Object.freeze({ x: 352.0, y: 96.0, kind: 'overcharge' }),
      stalactites: Object.freeze([
        Object.freeze({ id: 'stal-str-w', x: 406.0, y: 86.8, floorY: 108.8, style: 'basalt' }),
        Object.freeze({ id: 'stal-str-c', x: 417.5, y: 86.2, floorY: 109.0, style: 'basalt' }),
        Object.freeze({ id: 'stal-str-e', x: 428.5, y: 86.8, floorY: 108.6, style: 'basalt' }),
      ]),
      exitUpdraft: Object.freeze({
        x: 416.0,
        y: 90.0,
        radius: 3.6,
        destX: 306.0,
        destY: 6.0,
        label: 'Geothermal Vent Updraft → Fjord 6m O2 Deco Crest',
      }),
    }),
    minions: Object.freeze([
      Object.freeze({ id: 'str-m1', kind: 'moray', name: 'Magma-Vein Moray', x: 308.0, y: 91.5, hp: 118, radius: 1.22, dropOrb: true }),
      Object.freeze({ id: 'str-m2', kind: 'swarmer', name: 'Thermal Vent Jelly', x: 323.0, y: 93.2, hp: 92, radius: 1.02, dropOrb: false }),
      Object.freeze({ id: 'str-m3', kind: 'swarmer', name: 'Thermal Vent Jelly', x: 333.0, y: 94.2, hp: 94, radius: 1.02, dropOrb: true }),
      Object.freeze({ id: 'str-m4', kind: 'moray', name: 'Magma-Vein Moray', x: 348.0, y: 95.5, hp: 124, radius: 1.24, dropOrb: false }),
      Object.freeze({ id: 'str-m5', kind: 'stalker', name: 'Basalt-Armor Stalker', x: 364.0, y: 96.8, hp: 235, radius: 1.56, dropOrb: true }),
      Object.freeze({ id: 'str-m6', kind: 'stalker', name: 'Basalt-Armor Stalker', x: 376.0, y: 97.5, hp: 245, radius: 1.56, dropOrb: true }),
    ]),
    boss: Object.freeze({
      id: 'boss-thermal-nautilus',
      kind: 'thermal-nautilus',
      musicTheme: 'volcanic',
      icon: '🌋',
      name: 'HYDROTHERMAL NAUTILUS',
      title: 'Armored Volcanic Smectite Spire Titan',
      x: 423.0,
      y: 98.0,
      radius: 4.6,
      baseHp: 4850,
      trophyRelicId: 'strytan-magma-pearl',
      trophyName: 'Heart of the Thermal Spire',
      bonusPoints: 3500,
    }),
  }),

  // === BOSS 7 (Gypsum Crystal Maze Secret Lair): Orda Crystal Maze -> CRYSTAL BASILISK (v194) ===
  'orda-crystal-maze': Object.freeze({
    id: 'orda-selenite-vault',
    levelId: 'orda-crystal-maze',
    name: 'The Selenite Mirror Vault',
    veil: Object.freeze({
      id: 'ord-vault-veil',
      x: 186.2,
      y: 51.3,
      radius: 2.2,
      sealWallX: 185.0,
      sealMinY: 47.0,
      sealMaxY: 56.0,
      failsafeX: 191.5,
      label: 'Translucent Selenite Seam',
      silent: true,
    }),
    armory: Object.freeze({
      id: 'ord-speargun-rack',
      x: 202.0,
      y: 50.0,
      radius: 3.1,
      weaponName: 'Pneumatic Titanium Speargun',
      hint: '',
    }),
    landmarks: Object.freeze([
      Object.freeze({ kind: 'expedition-crate', x: 199.0, y: 51.6 }),
      Object.freeze({ kind: 'dive-strobe', x: 205.0, y: 48.0 }),
      Object.freeze({ kind: 'bio-coral', x: 222.0, y: 48.5 }),
      Object.freeze({ kind: 'temple-column', x: 246.0, y: 46.8 }),
      Object.freeze({ kind: 'mayan-glyphs', x: 268.0, y: 45.4 }),
      Object.freeze({ kind: 'monolith', x: 295.5, y: 39.8, side: 'top' }),
      Object.freeze({ kind: 'monolith', x: 295.5, y: 48.5, side: 'bottom' }),
    ]),
    foreshadowX: 246.0,
    arena: Object.freeze({
      cx: 326.0,
      cy: 44.0,
      triggerX: 300.0,
      rx: 28.0,
      ry: 13.5,
      respawnX: 293.5,
      respawnY: 44.2,
      pillars: Object.freeze([
        Object.freeze({ id: 'ord-p-west', x: 310.5, y: 47.5, radius: 2.1 }),
        Object.freeze({ id: 'ord-p-north', x: 325.5, y: 36.4, radius: 2.0 }),
        Object.freeze({ id: 'ord-p-east', x: 340.5, y: 47.8, radius: 2.1 }),
      ]),
      lightSconces: Object.freeze([
        Object.freeze({ x: 305.0, y: 37.5, color: '#e879f9', radius: 14.5 }),
        Object.freeze({ x: 315.0, y: 53.5, color: '#38bdf8', radius: 14.5 }),
        Object.freeze({ x: 320.0, y: 33.2, color: '#c084fc', radius: 15.5 }),
        Object.freeze({ x: 336.5, y: 33.5, color: '#e879f9', radius: 15.5 }),
        Object.freeze({ x: 337.5, y: 53.2, color: '#67e8f9', radius: 14.5 }),
        Object.freeze({ x: 348.0, y: 41.0, color: '#c084fc', radius: 14.0 }),
      ]),
      bossAnchors: Object.freeze([
        Object.freeze({ x: 334.0, y: 44.0 }),
        Object.freeze({ x: 319.5, y: 42.8 }),
        Object.freeze({ x: 338.5, y: 41.0 }),
        Object.freeze({ x: 326.0, y: 48.2 }),
      ]),
      gasCaches: Object.freeze([
        Object.freeze({ id: 'ord-stage-1', x: 305.5, y: 41.5, label: 'Selenite Rim Stage (West)' }),
        Object.freeze({ id: 'ord-stage-2', x: 325.0, y: 53.0, label: 'Selenite Rim Stage (South)' }),
        Object.freeze({ id: 'ord-stage-3', x: 346.0, y: 44.5, label: 'Selenite Rim Stage (East)' }),
        Object.freeze({ id: 'ord-stage-4', x: 329.0, y: 34.2, label: 'Selenite Rim Stage (North)' }),
      ]),
      midStage: Object.freeze({ id: 'ord-corridor-stage', x: 246.0, y: 46.8, label: 'Gypsum Vault Bailout Stage' }),
      pickupPads: Object.freeze([
        Object.freeze({ id: 'ord-pad-w', x: 306.0, y: 41.6 }),
        Object.freeze({ id: 'ord-pad-nw', x: 316.5, y: 37.4 }),
        Object.freeze({ id: 'ord-pad-s', x: 325.5, y: 52.4 }),
        Object.freeze({ id: 'ord-pad-ne', x: 336.0, y: 37.2 }),
        Object.freeze({ id: 'ord-pad-e', x: 345.5, y: 44.2 }),
        Object.freeze({ id: 'ord-pad-se', x: 338.0, y: 52.0 }),
      ]),
      corridorBattery: Object.freeze({ x: 244.0, y: 47.0 }),
      corridorUpgrade: Object.freeze({ x: 262.0, y: 45.8, kind: 'homing' }),
      stalactites: Object.freeze([
        Object.freeze({ id: 'stal-ord-w', x: 316.0, y: 32.8, floorY: 54.8, style: 'gypsum' }),
        Object.freeze({ id: 'stal-ord-c', x: 327.5, y: 32.2, floorY: 55.0, style: 'gypsum' }),
        Object.freeze({ id: 'stal-ord-e', x: 338.5, y: 32.8, floorY: 54.6, style: 'gypsum' }),
      ]),
      exitUpdraft: Object.freeze({
        x: 326.0,
        y: 36.0,
        radius: 3.6,
        destX: 192.0,
        destY: 6.2,
        label: 'Selenite Thermal Updraft → Orda 6m Deco Grotto',
      }),
    }),
    minions: Object.freeze([
      Object.freeze({ id: 'ord-m1', kind: 'moray', name: 'Gypsum Quartz Eel', x: 218.0, y: 48.8, hp: 102, radius: 1.2, dropOrb: true }),
      Object.freeze({ id: 'ord-m2', kind: 'swarmer', name: 'Selenite Shard Jelly', x: 233.0, y: 47.6, hp: 80, radius: 1.0, dropOrb: false }),
      Object.freeze({ id: 'ord-m3', kind: 'swarmer', name: 'Selenite Shard Jelly', x: 243.0, y: 47.0, hp: 84, radius: 1.0, dropOrb: true }),
      Object.freeze({ id: 'ord-m4', kind: 'moray', name: 'Gypsum Quartz Eel', x: 258.0, y: 46.0, hp: 110, radius: 1.22, dropOrb: false }),
      Object.freeze({ id: 'ord-m5', kind: 'stalker', name: 'Crystal-Carapace Stalker', x: 274.0, y: 45.2, hp: 205, radius: 1.54, dropOrb: true }),
      Object.freeze({ id: 'ord-m6', kind: 'stalker', name: 'Crystal-Carapace Stalker', x: 286.0, y: 44.6, hp: 215, radius: 1.54, dropOrb: true }),
    ]),
    boss: Object.freeze({
      id: 'boss-crystal-basilisk',
      kind: 'crystal-basilisk',
      musicTheme: 'crystal',
      icon: '💎',
      name: 'CRYSTAL BASILISK',
      title: 'Iridescent Ural Selenite Mirror Wyrm',
      x: 333.0,
      y: 44.0,
      radius: 4.5,
      baseHp: 4100,
      trophyRelicId: 'orda-selenite-prism',
      trophyName: 'Crown of Selenite',
      bonusPoints: 2900,
    }),
  }),

  // === BOSS 8 (North Sea Submarine Wreck Secret Lair): U-1206 -> PHANTOM TORPEDO SENTINEL (v194) ===
  'u1206-north-sea-sub': Object.freeze({
    id: 'u1206-torpedo-crypt',
    levelId: 'u1206-north-sea-sub',
    name: 'The Sunken Torpedo Crypt',
    veil: Object.freeze({
      id: 'u12-vault-veil',
      x: 86.2,
      y: 73.6,
      radius: 2.2,
      sealWallX: 85.0,
      sealMinY: 69.5,
      sealMaxY: 78.0,
      failsafeX: 91.5,
      label: 'Torn Torpedo Bulkhead Seam',
      silent: true,
    }),
    armory: Object.freeze({
      id: 'u12-speargun-rack',
      x: 102.0,
      y: 74.0,
      radius: 3.1,
      weaponName: 'Pneumatic Titanium Speargun',
      hint: '',
    }),
    landmarks: Object.freeze([
      Object.freeze({ kind: 'expedition-crate', x: 99.0, y: 75.6 }),
      Object.freeze({ kind: 'dive-strobe', x: 105.0, y: 72.2 }),
      Object.freeze({ kind: 'thermal-vent', x: 122.0, y: 76.2 }),
      Object.freeze({ kind: 'vintage-helmet', x: 146.0, y: 76.0 }),
      Object.freeze({ kind: 'temple-column', x: 168.0, y: 75.6 }),
      Object.freeze({ kind: 'monolith', x: 195.5, y: 71.8, side: 'top' }),
      Object.freeze({ kind: 'monolith', x: 195.5, y: 80.5, side: 'bottom' }),
    ]),
    foreshadowX: 146.0,
    arena: Object.freeze({
      cx: 226.0,
      cy: 76.0,
      triggerX: 200.0,
      rx: 28.0,
      ry: 13.5,
      respawnX: 193.5,
      respawnY: 76.0,
      pillars: Object.freeze([
        Object.freeze({ id: 'u12-p-west', x: 210.5, y: 79.5, radius: 2.1 }),
        Object.freeze({ id: 'u12-p-north', x: 225.5, y: 68.4, radius: 2.0 }),
        Object.freeze({ id: 'u12-p-east', x: 240.5, y: 79.8, radius: 2.1 }),
      ]),
      lightSconces: Object.freeze([
        Object.freeze({ x: 205.0, y: 69.5, color: '#2dd4bf', radius: 14.5 }),
        Object.freeze({ x: 215.0, y: 85.5, color: '#38bdf8', radius: 14.5 }),
        Object.freeze({ x: 220.0, y: 65.2, color: '#5eead4', radius: 15.5 }),
        Object.freeze({ x: 236.5, y: 65.5, color: '#2dd4bf', radius: 15.5 }),
        Object.freeze({ x: 237.5, y: 85.2, color: '#fbbf24', radius: 14.5 }),
        Object.freeze({ x: 248.0, y: 73.0, color: '#5eead4', radius: 14.0 }),
      ]),
      bossAnchors: Object.freeze([
        Object.freeze({ x: 234.0, y: 76.0 }),
        Object.freeze({ x: 219.5, y: 74.8 }),
        Object.freeze({ x: 238.5, y: 73.0 }),
        Object.freeze({ x: 226.0, y: 80.2 }),
      ]),
      gasCaches: Object.freeze([
        Object.freeze({ id: 'u12-stage-1', x: 205.5, y: 73.5, label: 'Torpedo Crypt Stage (West)' }),
        Object.freeze({ id: 'u12-stage-2', x: 225.0, y: 85.0, label: 'Torpedo Crypt Stage (South)' }),
        Object.freeze({ id: 'u12-stage-3', x: 246.0, y: 76.5, label: 'Torpedo Crypt Stage (East)' }),
        Object.freeze({ id: 'u12-stage-4', x: 229.0, y: 66.2, label: 'Torpedo Crypt Stage (North)' }),
      ]),
      midStage: Object.freeze({ id: 'u12-corridor-stage', x: 146.0, y: 75.2, label: 'U-Boat Bilge Bailout Stage' }),
      pickupPads: Object.freeze([
        Object.freeze({ id: 'u12-pad-w', x: 206.0, y: 73.6 }),
        Object.freeze({ id: 'u12-pad-nw', x: 216.5, y: 69.4 }),
        Object.freeze({ id: 'u12-pad-s', x: 225.5, y: 84.4 }),
        Object.freeze({ id: 'u12-pad-ne', x: 236.0, y: 69.2 }),
        Object.freeze({ id: 'u12-pad-e', x: 245.5, y: 76.2 }),
        Object.freeze({ id: 'u12-pad-se', x: 238.0, y: 84.0 }),
      ]),
      corridorBattery: Object.freeze({ x: 144.0, y: 75.4 }),
      corridorUpgrade: Object.freeze({ x: 162.0, y: 75.6, kind: 'rapid' }),
      stalactites: Object.freeze([
        Object.freeze({ id: 'stal-u12-w', x: 216.0, y: 64.8, floorY: 86.8, style: 'steel' }),
        Object.freeze({ id: 'stal-u12-c', x: 227.5, y: 64.2, floorY: 87.0, style: 'steel' }),
        Object.freeze({ id: 'stal-u12-e', x: 238.5, y: 64.8, floorY: 86.6, style: 'steel' }),
      ]),
      exitUpdraft: Object.freeze({
        x: 226.0,
        y: 68.0,
        radius: 3.6,
        destX: 34.0,
        destY: 6.2,
        label: 'Ballast Blow Updraft → U-1206 6m O2 Trapeze Bar',
      }),
    }),
    minions: Object.freeze([
      Object.freeze({ id: 'u12-m1', kind: 'moray', name: 'North Sea Hull Eel', x: 118.0, y: 74.6, hp: 112, radius: 1.22, dropOrb: true }),
      Object.freeze({ id: 'u12-m2', kind: 'swarmer', name: 'Sonar Jelly Drone', x: 133.0, y: 75.0, hp: 88, radius: 1.0, dropOrb: false }),
      Object.freeze({ id: 'u12-m3', kind: 'swarmer', name: 'Sonar Jelly Drone', x: 143.0, y: 75.2, hp: 90, radius: 1.0, dropOrb: true }),
      Object.freeze({ id: 'u12-m4', kind: 'moray', name: 'North Sea Hull Eel', x: 158.0, y: 75.4, hp: 118, radius: 1.24, dropOrb: false }),
      Object.freeze({ id: 'u12-m5', kind: 'stalker', name: 'Torpedo-Tube Stalker', x: 174.0, y: 75.6, hp: 225, radius: 1.54, dropOrb: true }),
      Object.freeze({ id: 'u12-m6', kind: 'stalker', name: 'Torpedo-Tube Stalker', x: 186.0, y: 75.8, hp: 235, radius: 1.54, dropOrb: true }),
    ]),
    boss: Object.freeze({
      id: 'boss-phantom-uboat',
      kind: 'phantom-uboat',
      musicTheme: 'uboat',
      icon: '⚓',
      name: 'PHANTOM TORPEDO SENTINEL',
      title: 'Haunted North Sea Type-VIIC U-Boat Leviathan',
      x: 233.0,
      y: 76.0,
      radius: 4.6,
      baseHp: 4650,
      trophyRelicId: 'u1206-phantom-compass',
      trophyName: 'Phantom U-Boat Gyrocompass',
      bonusPoints: 3400,
    }),
  }),

  // === BOSS 9 (Bimini Megalith Secret Lair): Bimini Road -> ORICHALCUM COLOSSUS (v195) ===
  'bimini-road-megalith': Object.freeze({
    id: 'bimini-orichalcum-sanctum',
    levelId: 'bimini-road-megalith',
    name: 'The Orichalcum Sanctum',
    veil: Object.freeze({
      id: 'bim-sanctum-veil',
      x: 149.8,
      y: 36.2,
      radius: 2.2,
      sealWallX: 148.6,
      sealMinY: 32.0,
      sealMaxY: 41.0,
      failsafeX: 155.0,
      label: 'Gilded Megalithic Seam',
      silent: true,
    }),
    armory: Object.freeze({
      id: 'bim-speargun-rack',
      x: 162.0,
      y: 36.5,
      radius: 3.1,
      weaponName: 'Pneumatic Titanium Speargun',
      hint: '',
    }),
    landmarks: Object.freeze([
      Object.freeze({ kind: 'temple-column', x: 159.0, y: 38.2 }),
      Object.freeze({ kind: 'dive-strobe', x: 165.0, y: 34.8 }),
      Object.freeze({ kind: 'expedition-crate', x: 184.0, y: 38.4 }),
      Object.freeze({ kind: 'temple-column', x: 208.0, y: 38.2 }),
      Object.freeze({ kind: 'vintage-helmet', x: 230.0, y: 38.0 }),
      Object.freeze({ kind: 'monolith', x: 255.5, y: 31.8, side: 'top' }),
      Object.freeze({ kind: 'monolith', x: 255.5, y: 40.5, side: 'bottom' }),
    ]),
    foreshadowX: 206.0,
    arena: Object.freeze({
      cx: 286.0,
      cy: 36.0,
      triggerX: 260.0,
      rx: 28.0,
      ry: 13.5,
      respawnX: 253.5,
      respawnY: 36.0,
      pillars: Object.freeze([
        Object.freeze({ id: 'bim-p-west', x: 270.5, y: 39.5, radius: 2.1 }),
        Object.freeze({ id: 'bim-p-north', x: 285.5, y: 28.4, radius: 2.0 }),
        Object.freeze({ id: 'bim-p-east', x: 300.5, y: 39.8, radius: 2.1 }),
      ]),
      lightSconces: Object.freeze([
        Object.freeze({ x: 265.0, y: 29.5, color: '#fbbf24', radius: 14.5 }),
        Object.freeze({ x: 275.0, y: 45.5, color: '#38bdf8', radius: 14.5 }),
        Object.freeze({ x: 280.0, y: 25.2, color: '#fde047', radius: 15.5 }),
        Object.freeze({ x: 296.5, y: 25.5, color: '#f59e0b', radius: 15.5 }),
        Object.freeze({ x: 297.5, y: 45.2, color: '#22d3ee', radius: 14.5 }),
        Object.freeze({ x: 308.0, y: 33.0, color: '#fde047', radius: 14.0 }),
      ]),
      bossAnchors: Object.freeze([
        Object.freeze({ x: 294.0, y: 36.0 }),
        Object.freeze({ x: 279.5, y: 34.8 }),
        Object.freeze({ x: 298.5, y: 33.0 }),
        Object.freeze({ x: 286.0, y: 40.2 }),
      ]),
      gasCaches: Object.freeze([
        Object.freeze({ id: 'bim-stage-1', x: 265.5, y: 33.5, label: 'Orichalcum Sanctum Stage (West)' }),
        Object.freeze({ id: 'bim-stage-2', x: 285.0, y: 45.0, label: 'Orichalcum Sanctum Stage (South)' }),
        Object.freeze({ id: 'bim-stage-3', x: 306.0, y: 36.5, label: 'Orichalcum Sanctum Stage (East)' }),
        Object.freeze({ id: 'bim-stage-4', x: 289.0, y: 26.2, label: 'Orichalcum Sanctum Stage (North)' }),
      ]),
      midStage: Object.freeze({ id: 'bim-corridor-stage', x: 206.0, y: 36.2, label: 'Megalith Vault Bailout Stage' }),
      pickupPads: Object.freeze([
        Object.freeze({ id: 'bim-pad-w', x: 266.0, y: 33.6 }),
        Object.freeze({ id: 'bim-pad-nw', x: 276.5, y: 29.4 }),
        Object.freeze({ id: 'bim-pad-s', x: 285.5, y: 44.4 }),
        Object.freeze({ id: 'bim-pad-ne', x: 296.0, y: 29.2 }),
        Object.freeze({ id: 'bim-pad-e', x: 305.5, y: 36.2 }),
        Object.freeze({ id: 'bim-pad-se', x: 298.0, y: 44.0 }),
      ]),
      corridorBattery: Object.freeze({ x: 204.0, y: 36.4 }),
      corridorUpgrade: Object.freeze({ x: 222.0, y: 36.6, kind: 'overcharge' }),
      stalactites: Object.freeze([
        Object.freeze({ id: 'stal-bim-w', x: 276.0, y: 24.8, floorY: 46.8, style: 'orichalcum' }),
        Object.freeze({ id: 'stal-bim-c', x: 287.5, y: 24.2, floorY: 47.0, style: 'orichalcum' }),
        Object.freeze({ id: 'stal-bim-e', x: 298.5, y: 24.8, floorY: 46.6, style: 'orichalcum' }),
      ]),
      exitUpdraft: Object.freeze({
        x: 286.0,
        y: 28.0,
        radius: 3.6,
        destX: 165.0,
        destY: 6.5,
        label: 'Solar Current Updraft → Bimini 6m Turquoise Deco Shelf',
      }),
    }),
    minions: Object.freeze([
      Object.freeze({ id: 'bim-m1', kind: 'moray', name: 'Gilded Reef Sentinel', x: 178.0, y: 36.2, hp: 100, radius: 1.2, dropOrb: true }),
      Object.freeze({ id: 'bim-m2', kind: 'swarmer', name: 'Orichalcum Scarab Drone', x: 193.0, y: 36.0, hp: 80, radius: 1.0, dropOrb: false }),
      Object.freeze({ id: 'bim-m3', kind: 'swarmer', name: 'Orichalcum Scarab Drone', x: 203.0, y: 36.6, hp: 82, radius: 1.0, dropOrb: true }),
      Object.freeze({ id: 'bim-m4', kind: 'moray', name: 'Gilded Reef Sentinel', x: 218.0, y: 36.4, hp: 108, radius: 1.22, dropOrb: false }),
      Object.freeze({ id: 'bim-m5', kind: 'stalker', name: 'Atlantean Ward Stalker', x: 234.0, y: 36.4, hp: 205, radius: 1.52, dropOrb: true }),
      Object.freeze({ id: 'bim-m6', kind: 'stalker', name: 'Atlantean Ward Stalker', x: 246.0, y: 36.2, hp: 215, radius: 1.52, dropOrb: true }),
    ]),
    boss: Object.freeze({
      id: 'boss-orichalcum-colossus',
      kind: 'orichalcum-colossus',
      musicTheme: 'atlantis',
      icon: '🏛️',
      name: 'ORICHALCUM COLOSSUS',
      title: 'Ancient Atlantean Astrolabe Guardian',
      x: 293.0,
      y: 36.0,
      radius: 4.6,
      baseHp: 4350,
      trophyRelicId: 'bimini-orichalcum-astrolabe',
      trophyName: 'Orichalcum Astrolabe',
      bonusPoints: 3100,
    }),
  }),

  // === BOSS 10 (Flooded Mine Secret Lair): Ojamo Iron Mine -> ABYSSAL DRILL-WYRM (v195) ===
  'ojamo-iron-mine': Object.freeze({
    id: 'ojamo-foundry-shaft',
    levelId: 'ojamo-iron-mine',
    name: 'The Flooded Foundry Shaft',
    veil: Object.freeze({
      id: 'oja-foundry-veil',
      x: 216.2,
      y: 68.0,
      radius: 2.2,
      sealWallX: 215.0,
      sealMinY: 64.0,
      sealMaxY: 72.5,
      failsafeX: 221.5,
      label: 'Collapsed Iron Ore Bulkhead',
      silent: true,
    }),
    armory: Object.freeze({
      id: 'oja-speargun-rack',
      x: 232.0,
      y: 68.0,
      radius: 3.1,
      weaponName: 'Pneumatic Titanium Speargun',
      hint: '',
    }),
    landmarks: Object.freeze([
      Object.freeze({ kind: 'expedition-crate', x: 229.0, y: 69.8 }),
      Object.freeze({ kind: 'dive-strobe', x: 235.0, y: 66.2 }),
      Object.freeze({ kind: 'thermal-vent', x: 254.0, y: 70.0 }),
      Object.freeze({ kind: 'vintage-helmet', x: 278.0, y: 69.6 }),
      Object.freeze({ kind: 'expedition-crate', x: 300.0, y: 69.8 }),
      Object.freeze({ kind: 'monolith', x: 325.5, y: 63.8, side: 'top' }),
      Object.freeze({ kind: 'monolith', x: 325.5, y: 72.5, side: 'bottom' }),
    ]),
    foreshadowX: 276.0,
    arena: Object.freeze({
      cx: 356.0,
      cy: 68.0,
      triggerX: 330.0,
      rx: 28.0,
      ry: 13.5,
      respawnX: 323.5,
      respawnY: 68.0,
      pillars: Object.freeze([
        Object.freeze({ id: 'oja-p-west', x: 340.5, y: 71.5, radius: 2.1 }),
        Object.freeze({ id: 'oja-p-north', x: 355.5, y: 60.4, radius: 2.0 }),
        Object.freeze({ id: 'oja-p-east', x: 370.5, y: 71.8, radius: 2.1 }),
      ]),
      lightSconces: Object.freeze([
        Object.freeze({ x: 335.0, y: 61.5, color: '#f97316', radius: 14.5 }),
        Object.freeze({ x: 345.0, y: 77.5, color: '#fbbf24', radius: 14.5 }),
        Object.freeze({ x: 350.0, y: 57.2, color: '#fb923c', radius: 15.5 }),
        Object.freeze({ x: 366.5, y: 57.5, color: '#f97316', radius: 15.5 }),
        Object.freeze({ x: 367.5, y: 77.2, color: '#38bdf8', radius: 14.5 }),
        Object.freeze({ x: 378.0, y: 65.0, color: '#fbbf24', radius: 14.0 }),
      ]),
      bossAnchors: Object.freeze([
        Object.freeze({ x: 364.0, y: 68.0 }),
        Object.freeze({ x: 349.5, y: 66.8 }),
        Object.freeze({ x: 368.5, y: 65.0 }),
        Object.freeze({ x: 356.0, y: 72.2 }),
      ]),
      gasCaches: Object.freeze([
        Object.freeze({ id: 'oja-stage-1', x: 335.5, y: 65.5, label: 'Foundry Shaft Stage (West)' }),
        Object.freeze({ id: 'oja-stage-2', x: 355.0, y: 77.0, label: 'Foundry Shaft Stage (South)' }),
        Object.freeze({ id: 'oja-stage-3', x: 376.0, y: 68.5, label: 'Foundry Shaft Stage (East)' }),
        Object.freeze({ id: 'oja-stage-4', x: 359.0, y: 58.2, label: 'Foundry Shaft Stage (North)' }),
      ]),
      midStage: Object.freeze({ id: 'oja-corridor-stage', x: 276.0, y: 68.2, label: 'Iron Drift Bailout Stage' }),
      pickupPads: Object.freeze([
        Object.freeze({ id: 'oja-pad-w', x: 336.0, y: 65.6 }),
        Object.freeze({ id: 'oja-pad-nw', x: 346.5, y: 61.4 }),
        Object.freeze({ id: 'oja-pad-s', x: 355.5, y: 76.4 }),
        Object.freeze({ id: 'oja-pad-ne', x: 366.0, y: 61.2 }),
        Object.freeze({ id: 'oja-pad-e', x: 375.5, y: 68.2 }),
        Object.freeze({ id: 'oja-pad-se', x: 368.0, y: 76.0 }),
      ]),
      corridorBattery: Object.freeze({ x: 274.0, y: 68.4 }),
      corridorUpgrade: Object.freeze({ x: 292.0, y: 68.6, kind: 'twin' }),
      stalactites: Object.freeze([
        Object.freeze({ id: 'stal-oja-w', x: 346.0, y: 56.8, floorY: 78.8, style: 'iron' }),
        Object.freeze({ id: 'stal-oja-c', x: 357.5, y: 56.2, floorY: 79.0, style: 'iron' }),
        Object.freeze({ id: 'stal-oja-e', x: 368.5, y: 56.8, floorY: 78.6, style: 'iron' }),
      ]),
      exitUpdraft: Object.freeze({
        x: 356.0,
        y: 60.0,
        radius: 3.6,
        destX: 233.0,
        destY: 6.2,
        label: 'Hoist-Shaft Updraft → Ojamo 6m O2 Deco Shelf',
      }),
    }),
    minions: Object.freeze([
      Object.freeze({ id: 'oja-m1', kind: 'moray', name: 'Magnetite Bore Eel', x: 248.0, y: 68.0, hp: 112, radius: 1.22, dropOrb: true }),
      Object.freeze({ id: 'oja-m2', kind: 'swarmer', name: 'Slag Spark Drone', x: 263.0, y: 67.8, hp: 86, radius: 1.0, dropOrb: false }),
      Object.freeze({ id: 'oja-m3', kind: 'swarmer', name: 'Slag Spark Drone', x: 273.0, y: 68.4, hp: 88, radius: 1.0, dropOrb: true }),
      Object.freeze({ id: 'oja-m4', kind: 'moray', name: 'Magnetite Bore Eel', x: 288.0, y: 68.2, hp: 116, radius: 1.24, dropOrb: false }),
      Object.freeze({ id: 'oja-m5', kind: 'stalker', name: 'Iron-Clad Shaft Stalker', x: 304.0, y: 68.2, hp: 225, radius: 1.54, dropOrb: true }),
      Object.freeze({ id: 'oja-m6', kind: 'stalker', name: 'Iron-Clad Shaft Stalker', x: 316.0, y: 68.0, hp: 235, radius: 1.54, dropOrb: true }),
    ]),
    boss: Object.freeze({
      id: 'boss-drill-wyrm',
      kind: 'drill-wyrm',
      musicTheme: 'foundry',
      icon: '⚙️',
      name: 'ABYSSAL DRILL-WYRM',
      title: 'Armored Tungsten Tunneling Leviathan',
      x: 363.0,
      y: 68.0,
      radius: 4.6,
      baseHp: 4550,
      trophyRelicId: 'ojamo-tungsten-core',
      trophyName: 'Heart of the Iron Shaft',
      bonusPoints: 3300,
    }),
  }),

  // === BOSS 11 (Pacific Megalith Secret Lair): Yonaguni Monument -> RYŪJIN'S SERPENT (v201) ===
  'yonaguni-submerged-monument': Object.freeze({
    id: 'yonaguni-dragon-sanctum',
    levelId: 'yonaguni-submerged-monument',
    name: 'The Terraced Dragon Sanctum',
    veil: Object.freeze({
      id: 'yon-dragon-veil',
      x: 118.2,
      y: 52.0,
      radius: 2.3,
      sealWallX: 116.5,
      sealMinY: 47.5,
      sealMaxY: 56.5,
      failsafeX: 123.5,
      label: 'Hollow Megalith Seam',
      silent: true,
    }),
    armory: Object.freeze({
      id: 'yon-speargun-rack',
      x: 156.0,
      y: 52.0,
      radius: 3.1,
      weaponName: 'Pneumatic Titanium Speargun',
      hint: '',
    }),
    landmarks: Object.freeze([
      Object.freeze({ kind: 'expedition-crate', x: 153.0, y: 53.6 }),
      Object.freeze({ kind: 'dive-strobe', x: 159.0, y: 50.4 }),
      Object.freeze({ kind: 'temple-column', x: 184.0, y: 53.2 }),
      Object.freeze({ kind: 'vintage-helmet', x: 208.0, y: 53.4 }),
      Object.freeze({ kind: 'temple-column', x: 226.0, y: 53.0 }),
      Object.freeze({ kind: 'monolith', x: 242.5, y: 46.8, side: 'top' }),
      Object.freeze({ kind: 'monolith', x: 242.5, y: 55.2, side: 'bottom' }),
    ]),
    foreshadowX: 204.0,
    arena: Object.freeze({
      cx: 274.0,
      cy: 50.0,
      triggerX: 246.0,
      rx: 26.0,
      ry: 13.5,
      respawnX: 241.0,
      respawnY: 51.0,
      pillars: Object.freeze([
        Object.freeze({ id: 'pil-yon-w', x: 256.0, y: 50.2, radius: 2.0 }),
        Object.freeze({ id: 'pil-yon-nw', x: 269.0, y: 42.5, radius: 2.0 }),
        Object.freeze({ id: 'pil-yon-sw', x: 269.0, y: 57.5, radius: 2.0 }),
        Object.freeze({ id: 'pil-yon-e', x: 288.0, y: 50.0, radius: 2.0 }),
      ]),
      lightSconces: Object.freeze([
        Object.freeze({ x: 255.0, y: 42.5, color: '#2dd4bf', radius: 14.5 }),
        Object.freeze({ x: 274.0, y: 39.2, color: '#f43f5e', radius: 15.5 }),
        Object.freeze({ x: 292.0, y: 43.0, color: '#2dd4bf', radius: 15.0 }),
        Object.freeze({ x: 256.0, y: 58.0, color: '#2dd4bf', radius: 14.5 }),
        Object.freeze({ x: 275.0, y: 60.5, color: '#f43f5e', radius: 15.0 }),
        Object.freeze({ x: 291.0, y: 57.5, color: '#fbbf24', radius: 14.0 }),
      ]),
      bossAnchors: Object.freeze([
        Object.freeze({ x: 281.0, y: 50.0 }),
        Object.freeze({ x: 266.0, y: 48.8 }),
        Object.freeze({ x: 285.0, y: 46.8 }),
        Object.freeze({ x: 274.0, y: 54.0 }),
      ]),
      gasCaches: Object.freeze([
        Object.freeze({ id: 'yon-stage-1', x: 251.0, y: 47.0, label: 'Megalith Sanctum Stage (West)' }),
        Object.freeze({ id: 'yon-stage-2', x: 272.0, y: 59.5, label: 'Megalith Sanctum Stage (South)' }),
        Object.freeze({ id: 'yon-stage-3', x: 292.0, y: 51.0, label: 'Megalith Sanctum Stage (East)' }),
        Object.freeze({ id: 'yon-stage-4', x: 275.0, y: 40.5, label: 'Megalith Sanctum Stage (North)' }),
      ]),
      midStage: Object.freeze({ id: 'yon-corridor-stage', x: 196.0, y: 51.5, label: 'Terrace Corridor Bailout Stage' }),
      pickupPads: Object.freeze([
        Object.freeze({ id: 'yon-pad-w', x: 251.5, y: 47.5 }),
        Object.freeze({ id: 'yon-pad-s', x: 272.5, y: 59.0 }),
        Object.freeze({ id: 'yon-pad-n', x: 275.0, y: 41.0 }),
        Object.freeze({ id: 'yon-pad-e', x: 291.5, y: 51.5 }),
      ]),
      corridorBattery: Object.freeze({ x: 198.0, y: 51.4 }),
      corridorUpgrade: Object.freeze({ x: 215.0, y: 51.3, kind: 'pierce' }),
      stalactites: Object.freeze([
        Object.freeze({ id: 'stal-yon-w', x: 263.0, y: 39.2, floorY: 60.8, style: 'limestone' }),
        Object.freeze({ id: 'stal-yon-c', x: 275.0, y: 38.6, floorY: 61.0, style: 'limestone' }),
        Object.freeze({ id: 'stal-yon-e', x: 286.0, y: 39.2, floorY: 60.6, style: 'limestone' }),
      ]),
      exitUpdraft: Object.freeze({
        x: 274.0,
        y: 42.0,
        radius: 3.6,
        destX: 112.0,
        destY: 6.2,
        label: 'Kuroshio Updraft → Yonaguni 6m O2 Deco Stop',
      }),
    }),
    minions: Object.freeze([
      Object.freeze({ id: 'yon-m1', kind: 'moray', name: 'Kuroshio Reef Moray', x: 176.0, y: 51.8, hp: 114, radius: 1.24, dropOrb: true }),
      Object.freeze({ id: 'yon-m2', kind: 'swarmer', name: 'Coral Dart Swarmer', x: 192.0, y: 51.4, hp: 86, radius: 1.0, dropOrb: false }),
      Object.freeze({ id: 'yon-m3', kind: 'swarmer', name: 'Coral Dart Swarmer', x: 204.0, y: 51.6, hp: 88, radius: 1.0, dropOrb: true }),
      Object.freeze({ id: 'yon-m4', kind: 'moray', name: 'Kuroshio Reef Moray', x: 218.0, y: 51.2, hp: 118, radius: 1.25, dropOrb: false }),
      Object.freeze({ id: 'yon-m5', kind: 'stalker', name: 'Megalith Jade Stalker', x: 232.0, y: 51.2, hp: 230, radius: 1.54, dropOrb: true }),
    ]),
    boss: Object.freeze({
      id: 'boss-coral-dragon',
      kind: 'coral-dragon',
      musicTheme: 'solar',
      icon: '🐉',
      name: "RYŪJIN'S SERPENT",
      title: 'Pacific Coral Dragon Leviathan',
      x: 280.0,
      y: 50.0,
      radius: 4.6,
      baseHp: 4650,
      trophyRelicId: 'yonaguni-dragon-pearl',
      trophyName: 'Pearl of Ryūjin',
      bonusPoints: 3450,
    }),
  }),

  // === BOSS 12 (Scapa Flow Secret Lair): SMS Markgraf -> SCAPA DREADNOUGHT (v201) ===
  'sms-markgraf-scapa-flow': Object.freeze({
    id: 'markgraf-spectral-citadel',
    levelId: 'sms-markgraf-scapa-flow',
    name: 'The Spectral Armored Citadel',
    veil: Object.freeze({
      id: 'mkg-citadel-veil',
      x: 97.5,
      y: 46.5,
      radius: 2.3,
      sealWallX: 96.0,
      sealMinY: 42.0,
      sealMaxY: 51.0,
      failsafeX: 103.0,
      label: 'False Armor Plate Seam',
      silent: true,
    }),
    armory: Object.freeze({
      id: 'mkg-speargun-rack',
      x: 134.0,
      y: 46.5,
      radius: 3.1,
      weaponName: 'Pneumatic Titanium Speargun',
      hint: '',
    }),
    landmarks: Object.freeze([
      Object.freeze({ kind: 'expedition-crate', x: 131.0, y: 48.0 }),
      Object.freeze({ kind: 'dive-strobe', x: 137.0, y: 44.8 }),
      Object.freeze({ kind: 'vintage-helmet', x: 162.0, y: 47.8 }),
      Object.freeze({ kind: 'thermal-vent', x: 188.0, y: 47.6 }),
      Object.freeze({ kind: 'monolith', x: 219.5, y: 41.5, side: 'top' }),
      Object.freeze({ kind: 'monolith', x: 219.5, y: 50.5, side: 'bottom' }),
    ]),
    foreshadowX: 180.0,
    arena: Object.freeze({
      cx: 252.0,
      cy: 45.5,
      triggerX: 224.0,
      rx: 26.0,
      ry: 13.5,
      respawnX: 218.0,
      respawnY: 46.0,
      pillars: Object.freeze([
        Object.freeze({ id: 'pil-mkg-w', x: 234.0, y: 45.8, radius: 2.0 }),
        Object.freeze({ id: 'pil-mkg-nw', x: 247.0, y: 38.0, radius: 2.0 }),
        Object.freeze({ id: 'pil-mkg-sw', x: 247.0, y: 53.0, radius: 2.0 }),
        Object.freeze({ id: 'pil-mkg-e', x: 266.0, y: 45.5, radius: 2.0 }),
      ]),
      lightSconces: Object.freeze([
        Object.freeze({ x: 233.0, y: 38.0, color: '#34d399', radius: 14.5 }),
        Object.freeze({ x: 252.0, y: 34.8, color: '#94a3b8', radius: 15.5 }),
        Object.freeze({ x: 270.0, y: 38.5, color: '#34d399', radius: 15.0 }),
        Object.freeze({ x: 234.0, y: 53.5, color: '#34d399', radius: 14.5 }),
        Object.freeze({ x: 253.0, y: 56.0, color: '#94a3b8', radius: 15.0 }),
        Object.freeze({ x: 269.0, y: 53.0, color: '#34d399', radius: 14.0 }),
      ]),
      bossAnchors: Object.freeze([
        Object.freeze({ x: 259.0, y: 45.5 }),
        Object.freeze({ x: 244.0, y: 44.4 }),
        Object.freeze({ x: 263.0, y: 42.5 }),
        Object.freeze({ x: 252.0, y: 49.5 }),
      ]),
      gasCaches: Object.freeze([
        Object.freeze({ id: 'mkg-stage-1', x: 229.0, y: 42.5, label: 'Citadel Stage (West)' }),
        Object.freeze({ id: 'mkg-stage-2', x: 250.0, y: 55.0, label: 'Citadel Stage (South)' }),
        Object.freeze({ id: 'mkg-stage-3', x: 270.0, y: 46.5, label: 'Citadel Stage (East)' }),
        Object.freeze({ id: 'mkg-stage-4', x: 253.0, y: 36.2, label: 'Citadel Stage (North)' }),
      ]),
      midStage: Object.freeze({ id: 'mkg-corridor-stage', x: 174.0, y: 46.2, label: 'Casemate Corridor Bailout Stage' }),
      pickupPads: Object.freeze([
        Object.freeze({ id: 'mkg-pad-w', x: 229.5, y: 43.0 }),
        Object.freeze({ id: 'mkg-pad-s', x: 250.5, y: 54.5 }),
        Object.freeze({ id: 'mkg-pad-n', x: 253.0, y: 36.8 }),
        Object.freeze({ id: 'mkg-pad-e', x: 269.5, y: 47.0 }),
      ]),
      corridorBattery: Object.freeze({ x: 176.0, y: 46.0 }),
      corridorUpgrade: Object.freeze({ x: 192.0, y: 46.0, kind: 'twin' }),
      stalactites: Object.freeze([
        Object.freeze({ id: 'stal-mkg-w', x: 241.0, y: 34.8, floorY: 56.2, style: 'iron' }),
        Object.freeze({ id: 'stal-mkg-c', x: 253.0, y: 34.2, floorY: 56.5, style: 'iron' }),
        Object.freeze({ id: 'stal-mkg-e', x: 264.0, y: 34.8, floorY: 56.0, style: 'iron' }),
      ]),
      exitUpdraft: Object.freeze({
        x: 252.0,
        y: 37.5,
        radius: 3.6,
        destX: 10.0,
        destY: 6.0,
        label: 'Citadel Updraft → Scapa Flow 6m O2 Stop',
      }),
    }),
    minions: Object.freeze([
      Object.freeze({ id: 'mkg-m1', kind: 'moray', name: 'Turret-Ring Moray', x: 154.0, y: 46.2, hp: 118, radius: 1.24, dropOrb: true }),
      Object.freeze({ id: 'mkg-m2', kind: 'swarmer', name: 'Spectral Signal Drone', x: 170.0, y: 46.0, hp: 88, radius: 1.0, dropOrb: false }),
      Object.freeze({ id: 'mkg-m3', kind: 'swarmer', name: 'Spectral Signal Drone', x: 184.0, y: 46.2, hp: 90, radius: 1.0, dropOrb: true }),
      Object.freeze({ id: 'mkg-m4', kind: 'moray', name: 'Turret-Ring Moray', x: 198.0, y: 46.0, hp: 120, radius: 1.26, dropOrb: false }),
      Object.freeze({ id: 'mkg-m5', kind: 'stalker', name: 'Dreadnought Hull Stalker', x: 210.0, y: 46.0, hp: 238, radius: 1.56, dropOrb: true }),
    ]),
    boss: Object.freeze({
      id: 'boss-spectral-dreadnought',
      kind: 'spectral-dreadnought',
      musicTheme: 'uboat',
      icon: '⚓',
      name: 'SCAPA DREADNOUGHT',
      title: 'Spectral WWI Armored Battleship Leviathan',
      x: 258.0,
      y: 45.5,
      radius: 4.7,
      baseHp: 4900,
      trophyRelicId: 'markgraf-fleet-heart',
      trophyName: 'Heart of Scapa Flow',
      bonusPoints: 3650,
    }),
  }),
});

export function getSecretLairForLevel(levelId) {
  return (levelId && SECRET_LAIRS[levelId]) || null;
}

export function isPointInArena(arena, x, y, padM = 0) {
  if (!arena || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const rx = Math.max(4, (arena.rx || 24) + padM);
  const ry = Math.max(4, (arena.ry || 12) + padM);
  const dx = (x - arena.cx) / rx;
  const dy = (y - arena.cy) / ry;
  return dx * dx + dy * dy <= 1.0;
}

/**
 * Minimum distance from point (px, py) to segment (ax, ay) -> (bx, by).
 */
export function distPointToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const lenSq = vx * vx + vy * vy;
  if (lenSq <= 1e-8) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / lenSq));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

/**
 * Exact ray-circle intersection for checking whether a cover pillar shelters a diver from the Kraken's
 * Vortex suction or Sweeping Bioluminescent Beam!
 * Returns the sheltering pillar object, or null if exposed.
 */
export function isShelteredByPillar(diverX, diverY, bossX, bossY, pillars, padRadius = 0.65) {
  if (!Array.isArray(pillars) || pillars.length === 0) return null;
  const dx = bossX - diverX;
  const dy = bossY - diverY;
  const totalLen = Math.hypot(dx, dy);
  if (totalLen <= 0.5) return null;
  const ux = dx / totalLen;
  const uy = dy / totalLen;
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    const px = p.x - diverX;
    const py = p.y - diverY;
    const proj = px * ux + py * uy;
    // Pillar must strictly lie between diver and boss!
    if (proj <= 0.1 || proj >= totalLen - 0.5) continue;
    const perpSq = Math.max(0, px * px + py * py - proj * proj);
    const effR = (p.radius || 2.0) + padRadius;
    if (perpSq <= effR * effR) {
      return p;
    }
  }
  return null;
}

/**
 * Compute where the Kraken's Sweeping Abyssal Beam terminates against the 3 cover pillars or maxRange.
 */
export function computeBeamEndPoint(originX, originY, angle, maxRange, pillars, padRadius = 0.2) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  let bestT = maxRange;
  let hitPillar = null;
  if (Array.isArray(pillars)) {
    for (let i = 0; i < pillars.length; i++) {
      const p = pillars[i];
      const fx = originX - p.x;
      const fy = originY - p.y;
      const r = (p.radius || 2.0) + padRadius;
      const b = 2 * (fx * ux + fy * uy);
      const c = fx * fx + fy * fy - r * r;
      const disc = b * b - 4 * c;
      if (disc < 0) continue;
      const sqrtD = Math.sqrt(disc);
      const t = (-b - sqrtD) * 0.5;
      if (t > 0.5 && t < bestT) {
        bestT = t;
        hitPillar = p;
      }
    }
  }
  return {
    x: originX + ux * bestT,
    y: originY + uy * bestT,
    dist: bestT,
    hitPillar,
  };
}

function hasLineOfSight(level, ax, ay, bx, by, pillars = []) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.8) return true;
  const steps = Math.min(20, Math.max(3, Math.ceil(dist / 1.4)));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const px = ax + dx * t;
    const py = ay + dy * t;
    if (evaluateCaveSDF(level, px, py) >= -0.15) return false;
  }
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    if (distPointToSegment(p.x, p.y, ax, ay, bx, by) < (p.radius || 2.0) - 0.15) return false;
  }
  return true;
}

/**
 * Tune boss HP, recovery cadence, reinforcements & arena bailout stages to active diver count (1–4).
 * Human divers contribute 1.0 weight; AI wingmen contribute 0.28 weight so bringing AI buddies helps cleanly!
 */
export function computeBossDifficultyScale(humanDivers = 1, aiWingmen = 0) {
  const humans = Math.max(1, Math.min(4, Math.round(Number(humanDivers) || 1)));
  const ai = Math.max(0, Math.min(3, Math.round(Number(aiWingmen) || 0)));
  const totalDivers = Math.max(1, Math.min(4, humans + ai));
  const effWeight = Math.max(1, Math.min(4, humans + ai * 0.28));
  const hpMult = Math.round((1 + (effWeight - 1) * 0.80) * 100) / 100;
  // Note: attackRateMult speeds up IDLE recovery ONLY — telegraphs stay crisp & fair at every squad size!
  const attackRateMult = Math.round((1 + (effWeight - 1) * 0.12) * 100) / 100;
  const damageMult = Math.round((1 + (effWeight - 1) * 0.06) * 100) / 100;
  const phase2Adds = effWeight >= 2.8 ? 3 : effWeight >= 1.65 ? 2 : 1;
  const activeStageCount = effWeight >= 3.0 ? 4 : effWeight >= 1.7 ? 3 : 2;
  return {
    humans,
    ai,
    totalDivers,
    effWeight,
    hpMult,
    attackRateMult,
    damageMult,
    phase2Adds,
    activeStageCount,
    label: `${totalDivers}-DIVER · ${hpMult.toFixed(2)}×`,
  };
}

function makeMinionInstance(spec, hpMult = 1) {
  const scaledHp = Math.round((spec.hp || 80) * (1.0 + (hpMult - 1) * 0.36));
  return {
    id: spec.id,
    kind: spec.kind,
    name: spec.name,
    homeX: spec.x,
    homeY: spec.y,
    x: spec.x,
    y: spec.y,
    vx: 0,
    vy: 0,
    angle: Math.PI,
    radius: spec.radius || 1.1,
    hp: scaledHp,
    maxHp: scaledHp,
    alive: true,
    aggro: false,
    state: 'idle',
    stateTimer: 0,
    cooldown: spec.kind === 'swarmer' ? 0.38 : 0.55,
    hitFlash: 0,
    wigglePhase: Math.random() * Math.PI * 2,
    lungeDirX: -1,
    lungeDirY: 0,
    dropOrb: spec.dropOrb !== undefined ? Boolean(spec.dropOrb) : true,
    isBossAdd: Boolean(spec.isBossAdd),
  };
}

function makePillarCrystals(pillars = []) {
  return pillars.map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    radius: p.radius,
    charge: 0,
    maxCharge: RESONANCE_MAX_CHARGE,
    cooldownSec: 0,
    dischargeAnimSec: 0,
    flashSec: 0,
    arcTargetX: 0,
    arcTargetY: 0,
  }));
}

function makeStalactites(specs = []) {
  return specs.map((st) => ({
    id: st.id,
    x: st.x,
    homeY: st.y,
    y: st.y,
    floorY: st.floorY || st.y + 22,
    vy: 0,
    style: st.style || 'limestone',
    hp: STALACTITE_MAX_HP,
    maxHp: STALACTITE_MAX_HP,
    state: 'hanging', // 'hanging' | 'falling' | 'broken'
    respawnSec: 0,
    flashSec: 0,
  }));
}

export function createSecretLairState(level, { humanDivers = 1, aiWingmen = 0 } = {}) {
  const spec = getSecretLairForLevel(level?.id);
  if (!spec) return null;
  const scaling = computeBossDifficultyScale(humanDivers, aiWingmen);
  const bossMaxHp = Math.round(spec.boss.baseHp * scaling.hpMult);
  const stages = [
    { ...spec.arena.midStage, used: false, cooldownSec: 0 },
    ...spec.arena.gasCaches.slice(0, scaling.activeStageCount).map((s) => ({ ...s, used: false, cooldownSec: 0 })),
  ];
  const tentacles = [];
  for (let i = 0; i < 6; i++) {
    tentacles.push({
      index: i,
      baseAngle: (i / 6) * Math.PI * 2 - Math.PI * 0.5,
      reach: 9.8 + (i % 2) * 2.2,
      waveOffset: i * 1.15,
      slamming: false,
      slamAngle: 0,
    });
  }
  return {
    spec,
    id: spec.id,
    scaling,
    veilRevealed: false,
    veilBreached: false,
    veilRevealPulse: 0,
    weaponClaimed: false,
    weaponEquipped: false,
    combatMode: false, // Pure combat HUD & frozen diving vitals once Speargun is picked up!
    combatScooterGranted: false,
    _savedDpvState: null,
    weaponMods: { twin: 0, rapid: 0, overcharge: 0, homing: 0 },
    playerHp: COMBAT_MAX_HP,
    playerMaxHp: COMBAT_MAX_HP,
    playerIframesSec: 0,
    playerHitFlash: 0,
    combatHintTimer: 0,
    reloadSec: 0,
    tapCooldownSec: 0,
    recoilSec: 0,
    muzzleFlashSec: 0,
    shotCounter: 0,
    charging: false,
    chargeSec: 0,
    spearAimAngle: 0,
    spears: [],
    enemyProjectiles: [],
    healOrbs: [],
    batteryCells: spec.arena.corridorBattery
      ? [{
          id: 'batt_init_1',
          x: spec.arena.corridorBattery.x,
          y: spec.arena.corridorBattery.y,
          vx: 0,
          vy: 0,
          chargePct: BOSS_BATTERY_RECHARGE_PCT,
          life: 999,
          phase: 0.4,
          inArena: false,
        }]
      : [],
    weaponUpgrades: spec.arena.corridorUpgrade
      ? [{
          id: 'upg_init_1',
          kind: spec.arena.corridorUpgrade.kind || 'twin',
          x: spec.arena.corridorUpgrade.x,
          y: spec.arena.corridorUpgrade.y,
          vx: 0,
          vy: 0,
          life: 999,
          phase: 1.1,
          inArena: false,
        }]
      : [],
    _batterySpawnTimer: 8.5,
    _upgradeSpawnTimer: 12.0,
    _pickupSeq: 0,
    hitSparks: [],
    shockwaves: [], // { x, y, radius, maxRadius, life, maxLife, color }
    pillarCrystals: makePillarCrystals(spec.arena.pillars || []),
    stalactites: makeStalactites(spec.arena.stalactites || []),
    bossHazards: [], // Biome-unique boss hazards: 'naval-mine' | 'frost-ring' | 'star-orb' (v192)
    cryoSlowSec: 0,
    mineBlasts: 0,
    _hazardSeq: 0,
    vortexShelteredPillarId: null,
    dashTimerSec: 0,
    dashCooldownSec: 0,
    dashDirX: 1,
    dashDirY: 0,
    dashTrail: [],
    dashesUsed: 0,
    upgradesCollected: 0,
    bossFightElapsedSec: 0,
    foreshadowTriggered: false,
    foreshadowTimer: 0,
    sconceLitCount: 0,
    sconceLitFrac: 0,
    titleBannerSec: 0,
    titleBannerMaxSec: 3.0,
    titleBannerText: '',
    titleBannerSub: '',
    titleBannerColor: '#38bdf8',
    resonanceBreaks: 0,
    pillarCrashes: 0,
    stalactiteCrushes: 0,
    minions: spec.minions.map((m) => makeMinionInstance(m, scaling.hpMult)),
    stages,
    arenaEntered: false,
    boss: {
      id: spec.boss.id,
      kind: spec.boss.kind,
      name: spec.boss.name,
      title: spec.boss.title,
      homeX: spec.boss.x,
      homeY: spec.boss.y,
      anchorIdx: 0,
      targetX: spec.boss.x,
      targetY: spec.boss.y,
      x: spec.boss.x,
      y: spec.boss.y,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      radius: spec.boss.radius,
      hp: bossMaxHp,
      maxHp: bossMaxHp,
      phase: 1,
      active: false,
      defeated: false,
      defeatAnimSec: 0,
      _defeatBurstStep: 0,
      hitFlash: 0,
      weakAngle: Math.PI * 0.8,
      aiState: 'dormant', // 'dormant'|'awakening'|'idle'|'slam_windup'|'slam_strike'|'vortex'|'ink_barrage'|'lunge_windup'|'lunge_dash'|'beam_windup'|'beam_sweep'|'grab_windup'|'grab_hold'|'stunned'
      stateTimer: 1.4,
      stateMaxTimer: 1.4,
      awakeningTimer: 0,
      phaseShiftSec: 0,
      attackSeq: 0,
      slamTargetAngle: Math.PI,
      slamArcHalf: 0.44,
      slamRadius: 14.5,
      twinSlam: false,
      inkAimAngle: Math.PI,
      lungeDestX: spec.boss.x,
      lungeDestY: spec.boss.y,
      beamAngle: Math.PI,
      beamSweepDir: 1,
      beamRange: 29.0,
      beamEndX: spec.boss.x - 10,
      beamEndY: spec.boss.y,
      beamHitPillar: false,
      vortexStrength: 0,
      blackoutAlpha: 0,
      stunTimerSec: 0,
      pinnedTargetId: null,
      pinHitsNeeded: 0,
      pinTimerSec: 0,
      phase2Summoned: false,
      phase3Roared: false,
      tentacles,
      anim: {
        prevX: spec.boss.x,
        prevY: spec.boss.y,
        facing: -1,
        pitch: 0,
        scaleX: 1,
        scaleY: 1,
        jiggleAmp: 0,
        jigglePhase: 0,
        swimCycle: 0,
        earFlap: 0,
        cheekPuff: 0,
        mouthOpen: 0,
        dizzyAngle: 0,
        hurtSec: 0,
        crownBob: 0,
        speed: 0,
      },
    },
    minionsKilled: 0,
    bossDefeated: false,
    trophyClaimed: false,
    bonusScore: 0,
    _spearSeq: 0,
    _orbSeq: 0,
    _aiFireCooldowns: new Map(),
    _netSyncAccum: 0,
  };
}

/**
 * Re-scale boss max/current HP proportionally if co-op peers join or leave before the boss is defeated.
 */
export function rescaleSecretLairForSquad(lair, humanDivers, aiWingmen) {
  if (!lair || !lair.boss || lair.boss.defeated) return;
  const next = computeBossDifficultyScale(humanDivers, aiWingmen);
  if (next.hpMult === lair.scaling.hpMult && next.totalDivers === lair.scaling.totalDivers) return;
  const prevRatio = lair.boss.maxHp > 0 ? lair.boss.hp / lair.boss.maxHp : 1;
  lair.scaling = next;
  lair.boss.maxHp = Math.round(lair.spec.boss.baseHp * next.hpMult);
  lair.boss.hp = Math.max(1, Math.round(lair.boss.maxHp * prevRatio));
  const wanted = [lair.spec.arena.midStage, ...lair.spec.arena.gasCaches.slice(0, next.activeStageCount)];
  for (const w of wanted) {
    if (!lair.stages.some((s) => s.id === w.id)) {
      lair.stages.push({ ...w, used: false, cooldownSec: 0 });
    }
  }
}

/**
 * Called by `triggerSonarPing` to detect whether an acoustic wave swept across a hidden rock seam.
 * Generous +5.2m acoustic resonance bonus so pinging from CP4 Deep Sump (20.8m) reliably reveals the seam!
 * Deliberately SILENT (zero text callout!) so observant divers discover the tight squeeze organically!
 */
export function revealSecretLairVeil(session, originX, originY, rangeM) {
  const lair = session?.secretLair;
  if (!lair || lair.veilBreached) return false;
  const veil = lair.spec.veil;
  const dist = Math.hypot(veil.x - originX, veil.y - originY);
  if (dist > rangeM + veil.radius + 5.2) return false;
  lair.veilRevealed = true;
  lair.veilRevealPulse = 9.0;
  return true;
}

/**
 * Fracture open a Sonar-revealed tight limestone squeeze (quiet stone dust + foley, zero noisy callout).
 */
export function breachSecretLairVeil(session, callbacks = {}, { fromRemote = false } = {}) {
  const lair = session?.secretLair;
  if (!lair || lair.veilBreached) return { ok: false };
  lair.veilRevealed = true;
  lair.veilBreached = true;
  const veil = lair.spec.veil;
  if (Array.isArray(session.siltClouds)) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      spawnSiltPlume(session.siltClouds, {
        x: veil.x + Math.cos(a) * 1.1,
        y: veil.y + Math.sin(a) * 0.9,
        vx: Math.cos(a) * 0.45,
        vy: Math.sin(a) * 0.3 - 0.1,
        radius: 1.2,
        maxRadius: 2.5,
        life: 8,
        peakAlpha: 0.52,
      });
    }
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spd = 2.0 + (i % 4) * 1.1;
    lair.hitSparks.push({
      x: veil.x,
      y: veil.y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life: 0.65,
      maxLife: 0.65,
      color: i % 2 === 0 ? '#7dd3fc' : '#cbd5e1',
      text: '',
      crit: false,
    });
  }
  if (session.cameraShake !== undefined) {
    session.cameraShake = Math.max(session.cameraShake || 0, 0.25);
  }
  callbacks.onVeilShatter?.(veil, { fromRemote });
  return { ok: true, veilId: veil.id };
}

/**
 * Grant a loaner Combat DPV Scooter when entering the Secret Lair boss fight so every diver can jet-strafe!
 * Saves the pre-combat DPV loadout so it restores cleanly after leaving the lair or defeating the boss.
 */
export function grantBossCombatScooter(session) {
  const lair = session?.secretLair;
  if (!lair || !session?.dpv) return false;
  if (!lair._savedDpvState) {
    lair._savedDpvState = {
      equipped: Boolean(session.dpv.equipped),
      active: Boolean(session.dpv.active),
      batteryPct: Number.isFinite(session.dpv.batteryPct) ? session.dpv.batteryPct : 100,
    };
  }
  lair.combatScooterGranted = true;
  session.dpv.equipped = true;
  session.dpv.active = true;
  session.dpv.batteryPct = Math.max(Number.isFinite(session.dpv.batteryPct) ? session.dpv.batteryPct : 0, 100);
  if (session.diver) {
    session.diver.hasDpv = true;
    session.diver.dpvActive = true;
  }
  return true;
}

/**
 * Restore the diver's original pre-combat DPV loadout upon leaving the Secret Lair or vanquishing the boss.
 */
export function restorePreCombatScooter(session) {
  const lair = session?.secretLair;
  if (!lair || !session?.dpv || !lair.combatScooterGranted) return false;
  const saved = lair._savedDpvState;
  lair.combatScooterGranted = false;
  lair._savedDpvState = null;
  if (saved) {
    session.dpv.equipped = Boolean(saved.equipped);
    session.dpv.active = saved.equipped ? Boolean(saved.active) : false;
    session.dpv.thrusting = false;
    session.dpv.batteryPct = saved.equipped
      ? Math.max(0, Math.min(100, Number.isFinite(saved.batteryPct) ? saved.batteryPct : 100))
      : 100;
  } else {
    session.dpv.active = false;
    session.dpv.thrusting = false;
  }
  if (session.diver) {
    session.diver.hasDpv = Boolean(session.dpv.equipped);
    session.diver.dpvActive = Boolean(session.dpv.active);
    session.diver.dpvThrusting = false;
  }
  return true;
}

/**
 * Equip the Pneumatic Titanium Speargun (mounts flashlight on barrel) + Combat DPV Scooter and enter Pure Combat Mode!
 */
export function claimSecretLairWeapon(session, callbacks = {}) {
  const lair = session?.secretLair;
  if (!lair || lair.weaponEquipped || lair.bossDefeated) return { ok: false };
  lair.weaponClaimed = true;
  lair.weaponEquipped = true;
  lair.combatMode = true;
  const rigMaxHp = COMBAT_MAX_HP + (session.rigPerf?.combatMaxHpBonus || 0);
  lair.playerHp = rigMaxHp;
  lair.playerMaxHp = rigMaxHp;
  lair.playerIframesSec = 0.6;
  lair.combatHintTimer = 7.5;
  lair.reloadSec = 0;
  lair.tapCooldownSec = 0;
  lair.shotCounter = 0;
  if (session.diver) session.diver.torchOn = true;
  grantBossCombatScooter(session);
  addSparkBurst(lair, lair.spec.armory.x, lair.spec.armory.y, '#38bdf8', 18, '🔱 SPEARGUN + ⚡ SCOOTER', true);
  lair.shockwaves.push({
    x: lair.spec.armory.x,
    y: lair.spec.armory.y,
    radius: 0.6,
    maxRadius: 5.5,
    life: 0.48,
    maxLife: 0.48,
    color: '#38bdf8',
  });
  callbacks.onWeaponEquip?.(lair.spec.armory);
  return { ok: true, weaponName: lair.spec.armory.weaponName, scooterGranted: true };
}

function spawnHealOrb(lair, x, y, heal = 24) {
  if (!lair || !Array.isArray(lair.healOrbs)) return;
  if (lair.healOrbs.length >= 14) lair.healOrbs.shift();
  const ang = Math.random() * Math.PI * 2;
  lair.healOrbs.push({
    id: `orb_${++lair._orbSeq}`,
    x,
    y,
    vx: Math.cos(ang) * 1.4,
    vy: Math.sin(ang) * 1.4 - 0.5,
    heal,
    life: 26,
    phase: Math.random() * Math.PI * 2,
  });
}

function _pickOpenArenaPad(lair, avoidX = null, avoidY = null) {
  const pads = lair?.spec?.arena?.pickupPads || [];
  if (!pads.length) return { x: lair?.spec?.arena?.cx || 278, y: lair?.spec?.arena?.cy || 40.5 };
  const occupied = [
    ...(lair.batteryCells || []),
    ...(lair.weaponUpgrades || []),
  ];
  const free = pads.filter((pad) => !occupied.some((it) => Math.hypot(it.x - pad.x, it.y - pad.y) < 3.6));
  const pool = free.length > 0 ? free : pads;
  if (Number.isFinite(avoidX) && Number.isFinite(avoidY) && pool.length > 1) {
    // Prefer pads farther from the boss so grabbing power-ups rewards smart positioning
    const sorted = [...pool].sort(
      (a, b) => Math.hypot(b.x - avoidX, b.y - avoidY) - Math.hypot(a.x - avoidX, a.y - avoidY)
    );
    const topHalf = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.6)));
    return topHalf[Math.floor(Math.random() * topHalf.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function spawnBatteryCell(lair, x, y, chargePct = BOSS_BATTERY_RECHARGE_PCT, { inArena = true } = {}) {
  if (!lair || !Array.isArray(lair.batteryCells)) return null;
  if (lair.batteryCells.length >= 4) lair.batteryCells.shift();
  const ang = Math.random() * Math.PI * 2;
  const cell = {
    id: `batt_${++lair._pickupSeq}`,
    x,
    y,
    vx: Math.cos(ang) * 0.7,
    vy: Math.sin(ang) * 0.7 - 0.25,
    chargePct,
    life: 36,
    phase: Math.random() * Math.PI * 2,
    inArena,
  };
  lair.batteryCells.push(cell);
  return cell;
}

function _chooseNextWeaponUpgradeKind(lair) {
  const mods = lair?.weaponMods || {};
  const activeKinds = new Set((lair?.weaponUpgrades || []).map((u) => u.kind));
  const unowned = BOSS_WEAPON_UPGRADE_ORDER.filter((k) => (mods[k] || 0) === 0 && !activeKinds.has(k));
  if (unowned.length > 0) return unowned[Math.floor(Math.random() * unowned.length)];
  const unmaxed = BOSS_WEAPON_UPGRADE_ORDER.filter((k) => (mods[k] || 0) < WEAPON_UPGRADE_MAX_LEVEL && !activeKinds.has(k));
  if (unmaxed.length > 0) return unmaxed[Math.floor(Math.random() * unmaxed.length)];
  const anyUnmaxed = BOSS_WEAPON_UPGRADE_ORDER.filter((k) => (mods[k] || 0) < WEAPON_UPGRADE_MAX_LEVEL);
  if (anyUnmaxed.length > 0) return anyUnmaxed[Math.floor(Math.random() * anyUnmaxed.length)];
  return BOSS_WEAPON_UPGRADE_ORDER[Math.floor(Math.random() * BOSS_WEAPON_UPGRADE_ORDER.length)];
}

export function spawnWeaponUpgrade(lair, x, y, kind = null, { inArena = true } = {}) {
  if (!lair || !Array.isArray(lair.weaponUpgrades)) return null;
  if (lair.weaponUpgrades.length >= 3) lair.weaponUpgrades.shift();
  const resolvedKind = kind && BOSS_WEAPON_UPGRADES[kind] ? kind : _chooseNextWeaponUpgradeKind(lair);
  const ang = Math.random() * Math.PI * 2;
  const pod = {
    id: `upg_${++lair._pickupSeq}`,
    kind: resolvedKind,
    x,
    y,
    vx: Math.cos(ang) * 0.55,
    vy: Math.sin(ang) * 0.55 - 0.2,
    life: 40,
    phase: Math.random() * Math.PI * 2,
    inArena,
  };
  lair.weaponUpgrades.push(pod);
  return pod;
}

export function collectBatteryCell(session, cell, callbacks = {}) {
  const lair = session?.secretLair;
  const dpv = session?.dpv;
  if (!lair || !cell) return { ok: false };
  const charge = Number.isFinite(cell.chargePct) ? cell.chargePct : BOSS_BATTERY_RECHARGE_PCT;
  let added = 0;
  if (dpv) {
    if (!dpv.equipped && lair.combatMode) grantBossCombatScooter(session);
    const before = Number.isFinite(dpv.batteryPct) ? dpv.batteryPct : 0;
    dpv.batteryPct = Math.min(100, before + charge);
    added = Math.round(dpv.batteryPct - before);
    if (dpv.equipped && !dpv.active && dpv.batteryPct > 5) {
      dpv.active = true;
      if (session.diver) session.diver.dpvActive = true;
    }
  }
  const px = session.diver?.x ?? cell.x;
  const py = session.diver?.y ?? cell.y;
  addSparkBurst(
    lair,
    px,
    py,
    '#fde047',
    12,
    added > 0 ? `⚡ +${added}% BATT` : '⚡ BATTERY FULL',
    true
  );
  addShockwave(lair, px, py, 3.8, '#22d3ee', 0.42);
  callbacks.onBatteryPickup?.({ added, batteryPct: dpv?.batteryPct ?? 100 });
  return { ok: true, added, batteryPct: dpv?.batteryPct ?? 100 };
}

export function applyWeaponUpgrade(session, kind, callbacks = {}) {
  const lair = session?.secretLair;
  const meta = BOSS_WEAPON_UPGRADES[kind];
  if (!lair || !meta) return { ok: false };
  if (!lair.weaponMods) lair.weaponMods = { twin: 0, rapid: 0, overcharge: 0, homing: 0 };
  const cur = lair.weaponMods[kind] || 0;
  const px = session.diver?.x ?? lair.spec?.arena?.cx ?? 278;
  const py = session.diver?.y ?? lair.spec?.arena?.cy ?? 40.5;
  if (cur < meta.maxLevel) {
    const nextLv = cur + 1;
    lair.weaponMods[kind] = nextLv;
    lair.upgradesCollected = (lair.upgradesCollected || 0) + 1;
    const label = nextLv >= 2 ? meta.lv2Label : meta.lv1Label;
    addSparkBurst(lair, px, py, meta.color, 16, `${meta.icon} ${label}!`, true);
    addShockwave(lair, px, py, 5.2, meta.color, 0.52);
    callbacks.onWeaponUpgrade?.({ kind, level: nextLv, label, color: meta.color, hyperSurge: false });
    return { ok: true, kind, level: nextLv, label, hyperSurge: false };
  }
  // All levels of this mod maxed -> Hyper Surge bonus (+25 HP & 100% DPV Battery!)
  lair.upgradesCollected = (lair.upgradesCollected || 0) + 1;
  lair.playerHp = Math.min(lair.playerMaxHp || COMBAT_MAX_HP, (lair.playerHp || 0) + 25);
  if (session.dpv) {
    session.dpv.batteryPct = 100;
    if (session.dpv.equipped) session.dpv.active = true;
  }
  addSparkBurst(lair, px, py, '#fde047', 18, '⚡ HYPER SURGE · +25 HP & FULL BATT', true);
  addShockwave(lair, px, py, 6.0, '#fde047', 0.55);
  callbacks.onWeaponUpgrade?.({ kind, level: cur, label: 'HYPER SURGE', color: '#fde047', hyperSurge: true });
  return { ok: true, kind, level: cur, label: 'HYPER SURGE', hyperSurge: true };
}

/**
 * Trigger a Combat Mode Scooter Hydro-Dash dodge burst! (v189)
 * Grants crisp directional torpedo surge + brief invulnerability i-frames (`0.34s`) for weaving
 * through Phase 3 Abyssal Beams, Tentacle Slams, and Frost/Arc barrages.
 */
export function triggerCombatScooterDash(session, { dirX = 0, dirY = 0, buddies = null } = {}, callbacks = {}) {
  const lair = session?.secretLair;
  const dpv = session?.dpv;
  const diver = session?.diver;
  if (!lair || !lair.combatMode || !session?.diveState?.alive || session.surfaced) {
    return { ok: false, reason: 'inactive' };
  }
  if (!dpv?.equipped || (dpv.batteryPct ?? 0) < 8) {
    return { ok: false, reason: 'low-battery' };
  }
  if ((lair.dashCooldownSec || 0) > 0.02 || (lair.dashTimerSec || 0) > 0.02) {
    return { ok: false, reason: 'cooldown' };
  }
  if (lair.boss?.pinnedTargetId === 'local') {
    return { ok: false, reason: 'pinned' };
  }

  let ux = Number(dirX) || 0;
  let uy = Number(dirY) || 0;
  let mag = Math.hypot(ux, uy);
  if (mag < 0.15) {
    const vMag = Math.hypot(diver?.vx || 0, diver?.vy || 0);
    if (vMag > 0.4) {
      ux = diver.vx / vMag;
      uy = diver.vy / vMag;
    } else {
      const fallbackAng = diver?.angle ?? diver?.torchAngle ?? 0;
      ux = Math.cos(fallbackAng);
      uy = Math.sin(fallbackAng);
    }
  } else {
    ux /= mag;
    uy /= mag;
  }

  // Hydro-Dash Buddy Slipstream Synergy (v195): dashing within 7.5m of an AI wingman or human peer
  // drafts off their wake for +18% speed burst & 22% faster dash recharge!
  let slipstreamBuddy = null;
  const buddyPool = Array.isArray(buddies)
    ? buddies
    : (typeof callbacks.getBuddies === 'function' ? callbacks.getBuddies() : []);
  if (diver && Array.isArray(buddyPool) && buddyPool.length > 0) {
    let bestD = 7.5;
    for (let i = 0; i < buddyPool.length; i++) {
      const b = buddyPool[i];
      if (!b || b.alive === false || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
      const d = Math.hypot(b.x - diver.x, b.y - diver.y);
      if (d <= bestD) {
        bestD = d;
        slipstreamBuddy = b;
      }
    }
  }
  const slipBoost = slipstreamBuddy ? 1.18 : 1.0;

  dpv.batteryPct = Math.max(0, (dpv.batteryPct ?? 0) - SCOOTER_DASH_COST_PCT);
  if (dpv.batteryPct <= 0.05) {
    dpv.batteryPct = 0;
    dpv.active = false;
  } else {
    dpv.active = true;
  }
  lair.dashDirX = ux;
  lair.dashDirY = uy;
  lair.dashTimerSec = SCOOTER_DASH_DURATION_SEC * (slipstreamBuddy ? 1.12 : 1.0);
  lair.dashCooldownSec = SCOOTER_DASH_COOLDOWN_SEC * (slipstreamBuddy ? 0.78 : 1.0) * (session.rigPerf?.dashCooldownMult || 1.0);
  lair.playerIframesSec = Math.max(lair.playerIframesSec || 0, SCOOTER_DASH_IFRAMES_SEC);
  lair.dashesUsed = (lair.dashesUsed || 0) + 1;
  if (diver) {
    diver.vx = ux * SCOOTER_DASH_SPEED * slipBoost;
    diver.vy = uy * SCOOTER_DASH_SPEED * slipBoost;
    diver.dpvActive = Boolean(dpv.active);
    diver.dpvThrusting = true;
    addShockwave(lair, diver.x, diver.y, slipstreamBuddy ? 4.4 : 3.6, slipstreamBuddy ? '#38bdf8' : '#22d3ee', 0.34);
    addSparkBurst(
      lair,
      diver.x,
      diver.y,
      slipstreamBuddy ? '#7dd3fc' : '#67e8f9',
      slipstreamBuddy ? 14 : 9,
      slipstreamBuddy ? '⚡ SLIPSTREAM!' : '',
      Boolean(slipstreamBuddy)
    );
    if (slipstreamBuddy) {
      pushDashSlipstreamArc(session, diver.x, diver.y, slipstreamBuddy.x, slipstreamBuddy.y, slipstreamBuddy.name || 'Buddy');
    }
  }
  callbacks.onScooterDash?.({ ux, uy, batteryPct: dpv.batteryPct, slipstream: Boolean(slipstreamBuddy) });
  return { ok: true, ux, uy, batteryPct: dpv.batteryPct, slipstream: Boolean(slipstreamBuddy) };
}

function addShockwave(lair, x, y, maxRadius, color = '#38bdf8', duration = 0.65) {
  if (!lair || !Array.isArray(lair.shockwaves)) return;
  if (lair.shockwaves.length >= 12) lair.shockwaves.shift();
  lair.shockwaves.push({
    x,
    y,
    radius: 0.8,
    maxRadius,
    life: duration,
    maxLife: duration,
    color,
  });
}

function showTitleBanner(lair, text, sub, color = '#38bdf8', sec = 3.0) {
  lair.titleBannerText = text;
  lair.titleBannerSub = sub;
  lair.titleBannerColor = color;
  lair.titleBannerSec = sec;
  lair.titleBannerMaxSec = sec;
}

/**
 * Fire tethered titanium speargun bolt(s) straight along the flashlight barrel!
 * Supports Boss Battle Weapon Upgrades:
 *  - `twin` (Lv 1: Twin Split 2-shot, Lv 2: Tri-Fan 3-shot)
 *  - `rapid` (Lv 1: 0.78× cooldown + 1.15× speed, Lv 2: 0.64× cooldown + 1.25× speed)
 *  - `overcharge` (Lv 1: 1.35× dmg + Hyper-Tip every 3rd shot, Lv 2: 1.70× dmg + Hyper-Tip every 2nd shot)
 *  - `homing` (Lv 1: acoustic seeker tracking 14m, Lv 2: omni-seeker 20m)
 */
export function fireSpeargun(
  session,
  {
    aimAngle = null,
    isTap = false,
    chargeFrac = 0,
    ownerId = 'local',
    isLocal = true,
    isWingman = false,
    damageOverride = null,
    isRemoteVisual = false,
    originX = null,
    originY = null,
  } = {},
  callbacks = {}
) {
  const lair = session?.secretLair;
  if (!lair || !session?.diveState?.alive || session.surfaced) return { ok: false, reason: 'inactive' };
  const mods = isLocal ? (lair.weaponMods || {}) : {};
  const rapidLv = mods.rapid || 0;
  const twinLv = mods.twin || 0;
  const overLv = mods.overcharge || 0;
  const homingLv = mods.homing || 0;

  if (isLocal) {
    if (!lair.weaponEquipped || !lair.combatMode || lair.bossDefeated) return { ok: false, reason: 'no-weapon' };
    const activeCd = isTap ? lair.tapCooldownSec : lair.reloadSec;
    if (activeCd > 0.015) return { ok: false, reason: 'reloading' };
    const cdMult = (rapidLv >= 2 ? 0.64 : rapidLv === 1 ? 0.78 : 1.0) * (session.rigPerf?.spearFireRateMult || 1.0);
    lair.reloadSec = SPEARGUN_AUTOFIRE_SEC * cdMult;
    lair.tapCooldownSec = SPEARGUN_TAP_COOLDOWN_SEC * cdMult;
    lair.recoilSec = 0.11;
    lair.muzzleFlashSec = 0.09;
    lair.charging = false;
    lair.chargeSec = 0;
    lair.shotCounter = (lair.shotCounter || 0) + 1;

    // If local diver is snared by Phase 3 Tentacle Grab, tapping fire breaks free cleanly (no double-decrement!)
    if (lair.boss?.pinnedTargetId === 'local' && !lair.boss.defeated) {
      lair.boss.pinHitsNeeded = Math.max(0, (lair.boss.pinHitsNeeded || 1) - 1);
      addSparkBurst(lair, session.diver.x, session.diver.y, '#fde047', 6, 'SNAP!', false);
      if (lair.boss.pinHitsNeeded <= 0) {
        _breakBossGrabAndStun(session, lair, session.diver, callbacks);
      }
    }
  }

  const diver = session.diver;
  const sx = Number.isFinite(originX) ? originX : (diver.body?.hand ? diver.body.hand.x : diver.x);
  const sy = Number.isFinite(originY) ? originY : (diver.body?.hand ? diver.body.hand.y : diver.y);
  const ang = Number.isFinite(aimAngle) ? aimAngle : (diver.torchAngle ?? diver.angle ?? 0);
  const cFrac = Math.max(0, Math.min(1, Number(chargeFrac) || 0));
  const rigSpearMult = isLocal ? (session.rigPerf?.spearPowerMult || 1.0) : 1.0;
  const hyperEvery = overLv >= 2 ? 2 : overLv === 1 ? 3 : (isLocal && session.rigPerf?.apexOvercharge ? 3 : 5);
  const isHyper = (isLocal && lair.shotCounter % hyperEvery === 0) || cFrac >= 0.72;
  const charged = isHyper || cFrac >= 0.45 || overLv >= 1;
  const speedMult = (rapidLv >= 2 ? 1.25 : rapidLv === 1 ? 1.15 : 1.0) * Math.min(1.35, 1 + (rigSpearMult - 1) * 0.55);
  const speed = (isHyper ? 32 : 27 + cFrac * 7) * speedMult;
  const overDmgMult = (overLv >= 2 ? 1.70 : overLv === 1 ? 1.35 : 1.0) * rigSpearMult;
  const rawBaseDmg = cFrac >= 0.45
    ? SPEARGUN_BASE_DAMAGE * (1 + cFrac * (SPEARGUN_MAX_CHARGE_MULT - 1))
    : SPEARGUN_BASE_DAMAGE * (isHyper ? SPEARGUN_HYPER_MULT : 1.0);
  // Multi-shot barrels deal slightly per-bolt balanced damage so Twin = ~1.56× and Tri-Fan = ~2.04× total DPS!
  const spreadScale = twinLv >= 2 ? 0.68 : twinLv === 1 ? 0.78 : 1.0;
  const baseDmg = Number.isFinite(damageOverride)
    ? Math.max(6, Math.round(damageOverride))
    : Math.max(10, Math.round(rawBaseDmg * overDmgMult * spreadScale));

  const angleOffsets = twinLv >= 2 ? [-0.14, 0, 0.14] : twinLv === 1 ? [-0.082, 0.082] : [0];
  const homingTurnRate = homingLv >= 2 ? 4.4 : homingLv === 1 ? 2.6 : 0;
  const homingRange = homingLv >= 2 ? 26 : homingLv === 1 ? 18 : 0;
  const bolts = [];

  for (let bIdx = 0; bIdx < angleOffsets.length; bIdx++) {
    const bAng = ang + angleOffsets[bIdx];
    const bolt = {
      id: `sp_${++lair._spearSeq}`,
      x: sx + Math.cos(bAng) * 0.95,
      y: sy + Math.sin(bAng) * 0.95,
      prevX: sx + Math.cos(bAng) * 0.5,
      prevY: sy + Math.sin(bAng) * 0.5,
      vx: Math.cos(bAng) * speed,
      vy: Math.sin(bAng) * speed,
      speed,
      angle: bAng,
      originX: sx,
      originY: sy,
      ownerId,
      isLocal,
      isWingman: Boolean(isWingman),
      isRemoteVisual: Boolean(isRemoteVisual),
      damage: baseDmg,
      charged,
      piercing: isHyper,
      overcharged: overLv >= 1,
      rapid: rapidLv >= 1,
      homingTurnRate,
      homingRange,
      life: isHyper ? 0.96 : 0.78,
      maxLife: isHyper ? 0.96 : 0.78,
      hitIds: new Set(),
    };
    lair.spears.push(bolt);
    bolts.push(bolt);
  }
  const bolt = bolts[0];

  // Crisp subtle underwater pneumatic kick
  if (isLocal && diver) {
    const recoil = isHyper ? 0.36 : 0.18;
    diver.vx = (diver.vx || 0) - Math.cos(ang) * recoil;
    diver.vy = (diver.vy || 0) - Math.sin(ang) * recoil;
  }

  if (Array.isArray(session.bubbles)) {
    for (let i = 0; i < (isHyper ? 5 : 2); i++) {
      session.bubbles.push({
        x: bolt.x + (Math.random() - 0.5) * 0.2,
        y: bolt.y + (Math.random() - 0.5) * 0.2,
        vx: Math.cos(ang) * 1.4 + (Math.random() - 0.5) * 0.5,
        vy: -0.45 - Math.random() * 0.5,
        r: 0.05 + Math.random() * 0.035,
        life: 0.75 + Math.random() * 0.4,
      });
    }
  }

  callbacks.onSpeargunFire?.({ bolt, bolts, charged: isHyper, isLocal });
  return { ok: true, bolt, bolts, charged: isHyper, aimAngle: ang, chargeFrac: cFrac };
}

function _stunBoss(session, lair, durationSec, label, color, callbacks) {
  const boss = lair?.boss;
  if (!boss || boss.defeated) return;
  boss.pinnedTargetId = null;
  boss.vortexStrength = 0;
  boss.aiState = 'stunned';
  boss.stunTimerSec = durationSec;
  boss.stateTimer = durationSec;
  boss.stateMaxTimer = durationSec;
  addSparkBurst(lair, boss.x, boss.y, color, 20, label, true);
  addShockwave(lair, boss.x, boss.y, 12.5, color, 0.55);
  if (session.cameraShake !== undefined) {
    session.cameraShake = Math.max(session.cameraShake || 0, 0.55);
  }
  if (session.hitstopSec !== undefined) {
    session.hitstopSec = Math.max(session.hitstopSec || 0, 0.08);
  }
  callbacks.onBossRoar?.(1);
}

function _breakBossGrabAndStun(session, lair, diver, callbacks) {
  _stunBoss(session, lair, 3.2, '⚡ STUNNED! 2× DMG', '#fde047', callbacks);
  if (diver) addSparkBurst(lair, diver.x, diver.y, '#4ade80', 8, 'FREE!', false);
}

function _chargePillarCrystal(session, lair, pc, addCharge, hitX, hitY, callbacks) {
  if (!pc || pc.cooldownSec > 0) {
    addSparkBurst(lair, hitX, hitY, '#94a3b8', 3);
    return;
  }
  pc.charge = Math.min(pc.maxCharge, pc.charge + addCharge);
  pc.flashSec = 0.25;
  addSparkBurst(lair, hitX, hitY, '#67e8f9', 6, pc.charge < pc.maxCharge ? `💎 ${pc.charge}/${pc.maxCharge}` : '', false);
  callbacks.onCrystalChime?.(pc.charge);

  if (pc.charge >= pc.maxCharge) {
    pc.charge = 0;
    pc.cooldownSec = RESONANCE_COOLDOWN_SEC;
    pc.dischargeAnimSec = 0.95;
    addShockwave(lair, pc.x, pc.y, 18.0, '#22d3ee', 0.6);
    callbacks.onResonanceBreak?.(pc);

    const boss = lair.boss;
    if (boss && boss.active && !boss.defeated && boss.aiState !== 'awakening') {
      const distToBoss = Math.hypot(boss.x - pc.x, boss.y - pc.y);
      pc.arcTargetX = boss.x;
      pc.arcTargetY = boss.y;
      if (distToBoss <= 21.5) {
        lair.resonanceBreaks = (lair.resonanceBreaks || 0) + 1;
        lair.enemyProjectiles.length = 0;
        _stunBoss(session, lair, 2.9, '⚡ RESONANCE BREAK! 2× DMG', '#22d3ee', callbacks);
        applyBossDamage(session, 220, { crit: true, hitX: boss.x, hitY: boss.y, bypassStunMult: true }, callbacks);
        // Tactical reward: Resonance Break pops a Weapon Upgrade Pod (or Battery Cell) near the pillar!
        const dropPad = _pickOpenArenaPad(lair, boss.x, boss.y);
        if ((lair.weaponUpgrades || []).filter((u) => u.inArena).length < 2) {
          spawnWeaponUpgrade(lair, dropPad.x, dropPad.y);
        } else {
          spawnBatteryCell(lair, dropPad.x, dropPad.y);
        }
      } else {
        addSparkBurst(lair, pc.x, pc.y, '#67e8f9', 14, '⚡ ACOUSTIC PULSE!', true);
      }
    }
  }
}

function addSparkBurst(lair, x, y, color, count = 8, text = '', crit = false) {
  let textY = y;
  if (text && Array.isArray(lair.hitSparks)) {
    // Stagger stacked floating callouts vertically so simultaneous pickups/crits NEVER overlap!
    for (let step = 0; step < 6; step++) {
      let overlaps = false;
      for (let j = 0; j < lair.hitSparks.length; j++) {
        const ex = lair.hitSparks[j];
        if (ex.text && Math.abs(ex.x - x) < 3.4 && Math.abs(ex.y - textY) < 0.88) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) break;
      textY -= 0.95;
    }
  }
  for (let i = 0; i < count; i++) {
    const isLabel = i === 0 && Boolean(text);
    const a = Math.random() * Math.PI * 2;
    const spd = 1.6 + Math.random() * 3.8;
    lair.hitSparks.push({
      x,
      y: isLabel ? textY : y,
      vx: isLabel ? 0 : Math.cos(a) * spd,
      vy: isLabel ? -0.9 : Math.sin(a) * spd - 0.5,
      life: isLabel ? 0.95 : 0.5 + Math.random() * 0.25,
      maxLife: isLabel ? 0.95 : 0.75,
      color,
      text: isLabel ? text : '',
      crit: isLabel && crit,
    });
  }
}

function applyDamageToLocalDiver(session, amount, sourceLabel, callbacks, { continuous = false } = {}) {
  const ds = session.diveState;
  const lair = session.secretLair;
  if (!ds?.alive || session.surfaced || !lair) return;

  if (lair.combatMode) {
    if (!continuous && lair.playerIframesSec > 0) return;
    const diffScale = session.difficulty === 'guided' ? 0.65 : session.difficulty === 'hardcore' ? 1.15 : 1.0;
    // CRITICAL FIX (v182): continuous damage is dt-scaled and MUST NOT clamp to 1.0 HP/frame!
    const dmg = continuous ? Math.max(0, amount * diffScale) : Math.max(6, amount * diffScale);
    lair.playerHp = Math.max(0, (lair.playerHp ?? COMBAT_MAX_HP) - dmg);
    if (!continuous) {
      lair.playerIframesSec = 0.85;
      lair.playerHitFlash = 0.38;
      if (session.cameraShake !== undefined) {
        session.cameraShake = Math.max(session.cameraShake || 0, 0.42);
      }
      callbacks.onAlarm?.('danger');
    } else if (dmg > 0.01) {
      lair.playerHitFlash = Math.max(lair.playerHitFlash || 0, 0.14);
    }
    if (lair.playerHp <= 0) {
      const rx = lair.arenaEntered ? (lair.spec.arena.respawnX ?? lair.spec.armory.x) : lair.spec.armory.x;
      const ry = lair.arenaEntered ? (lair.spec.arena.respawnY ?? lair.spec.armory.y) : lair.spec.armory.y;
      session.diver.x = rx;
      session.diver.y = ry;
      session.diver.vx = 0;
      session.diver.vy = 0;
      lair.playerHp = COMBAT_MAX_HP;
      lair.playerIframesSec = 2.2;
      lair.playerHitFlash = 0.45;
      lair.enemyProjectiles.length = 0;
      if (session.dpv?.equipped) {
        session.dpv.batteryPct = 100;
        session.dpv.active = true;
        if (session.diver) session.diver.dpvActive = true;
      }
      if (lair.boss && !lair.boss.defeated && lair.scaling.humans <= 1) {
        // Full clean solo rematch reset!
        const b = lair.boss;
        b.hp = b.maxHp;
        b.phase = 1;
        b.active = false;
        b.aiState = 'dormant';
        b.stateTimer = 1.4;
        b.stateMaxTimer = 1.4;
        b.awakeningTimer = 0;
        b.phaseShiftSec = 0;
        b.attackSeq = 0;
        b.anchorIdx = 0;
        b.vortexStrength = 0;
        b.blackoutAlpha = 0;
        b.pinnedTargetId = null;
        b.pinHitsNeeded = 0;
        b.phase2Summoned = false;
        b.phase3Roared = false;
        b.x = b.homeX;
        b.y = b.homeY;
        lair.minions = lair.minions.filter((m) => !m.isBossAdd);
        lair.batteryCells = (lair.batteryCells || []).filter((c) => !c.inArena);
        lair.weaponUpgrades = (lair.weaponUpgrades || []).filter((u) => !u.inArena);
        lair._batterySpawnTimer = 8.5;
        lair._upgradeSpawnTimer = 12.0;
        lair.bossFightElapsedSec = 0;
        lair.dashTimerSec = 0;
        lair.dashCooldownSec = 0;
        lair.dashTrail.length = 0;
        if (Array.isArray(lair.bossHazards)) lair.bossHazards.length = 0;
        lair.cryoSlowSec = 0;
        for (const pc of lair.pillarCrystals || []) {
          pc.charge = 0;
          pc.cooldownSec = 0;
          pc.dischargeAnimSec = 0;
        }
        for (const st of lair.stalactites || []) {
          st.state = 'hanging';
          st.y = st.homeY;
          st.vy = 0;
          st.hp = st.maxHp;
          st.respawnSec = 0;
          st.flashSec = 0;
        }
      }
      addSparkBurst(lair, rx, ry, '#38bdf8', 14, 'REFORMED · FULL HP', true);
    }
    return;
  }

  // Fallback outside combatMode
  const diffScale = session.difficulty === 'guided' ? 0.6 : session.difficulty === 'hardcore' ? 1.2 : 1.0;
  const dmg = continuous ? Math.max(0, amount * diffScale) : Math.max(2, amount * diffScale);
  ds.health = Math.max(0, (ds.health ?? 100) - dmg);
  if (!continuous && session.cameraShake !== undefined) {
    session.cameraShake = Math.max(session.cameraShake || 0, 0.35);
  }
  if (!continuous) callbacks.onAlarm?.('danger');
  if (ds.health <= 0) {
    ds.alive = false;
    ds.causeOfFailure = `Overwhelmed by ${sourceLabel}`;
    ds.failureDetail = `Overwhelmed by ${sourceLabel} in ${lair.spec?.name || 'the Sunken Sanctum'}.`;
  }
}

/**
 * Apply damage directly to the boss (used both locally and when relaying peer hits).
 */
export function applyBossDamage(
  session,
  damage,
  { crit = false, hitX = null, hitY = null, fromRemote = false, bypassStunMult = false } = {},
  callbacks = {}
) {
  const lair = session?.secretLair;
  const boss = lair?.boss;
  if (!boss || boss.defeated) return { ok: false };
  boss.active = true;
  lair.arenaEntered = true;
  if (boss.aiState === 'dormant') {
    boss.aiState = 'idle';
    boss.stateTimer = 0.9;
    lair.sconceLitCount = (lair.spec.arena.lightSconces || []).length;
    lair.sconceLitFrac = 1;
  }

  // Stun bonus applies cleanly once (no 3x double stacking!)
  const stunMult = !bypassStunMult && boss.aiState === 'stunned' ? 1.25 : 1.0;
  const finalDmg = Math.max(1, Math.round(damage * stunMult));
  boss.hp = Math.max(0, boss.hp - finalDmg);
  boss.hitFlash = 0.14;
  if (boss.anim) {
    boss.anim.jiggleAmp = Math.min(0.24, (boss.anim.jiggleAmp || 0) + (crit ? 0.14 : 0.08));
    boss.anim.hurtSec = Math.max(boss.anim.hurtSec || 0, crit ? 0.24 : 0.14);
  }
  const sx = Number.isFinite(hitX) ? hitX : boss.x;
  const sy = Number.isFinite(hitY) ? hitY : boss.y;
  addSparkBurst(
    lair,
    sx,
    sy,
    crit ? '#fde047' : '#38bdf8',
    crit ? 10 : 5,
    `${crit ? 'CRIT ' : ''}-${finalDmg}`,
    crit
  );
  if (crit && !fromRemote && session?.diver) {
    triggerCameraKick(session, sx - session.diver.x, sy - session.diver.y, 0.34, 0.028);
  }
  callbacks.onSpearHit?.({ target: 'boss', damage: finalDmg, crit, x: sx, y: sy });

  // Phase transitions — Chromatic Surge + Hitstop + Projectile-Clearing Shockwave!
  const hpRatio = boss.maxHp > 0 ? boss.hp / boss.maxHp : 0;
  if (boss.phase === 1 && hpRatio <= 0.66 && boss.hp > 0) {
    boss.phase = 2;
    boss.phaseShiftSec = 0.85;
    boss.aiState = 'vortex';
    boss.vortexStrength = 6.8;
    boss.stateTimer = 3.6;
    boss.stateMaxTimer = 3.6;
    lair.enemyProjectiles.length = 0;
    addShockwave(lair, boss.x, boss.y, 26, '#c084fc', 0.85);
    showTitleBanner(lair, 'PHASE II · ABYSSAL MAELSTROM', 'TAKE COVER BEHIND PILLARS · CHARGE CRYSTALS', '#c084fc', 2.8);
    if (session.cameraShake !== undefined) session.cameraShake = Math.max(session.cameraShake || 0, 0.72);
    if (session.hitstopSec !== undefined) session.hitstopSec = Math.max(session.hitstopSec || 0, 0.11);
    callbacks.onBossRoar?.(2);
    spawnHealOrb(lair, boss.x - 9.0, boss.y - 4.0, 28);
    spawnHealOrb(lair, boss.x - 9.0, boss.y + 4.0, 28);
    if (!fromRemote) {
      const bPad = _pickOpenArenaPad(lair, boss.x, boss.y);
      spawnBatteryCell(lair, bPad.x, bPad.y);
      const uPad = _pickOpenArenaPad(lair, boss.x, boss.y);
      spawnWeaponUpgrade(lair, uPad.x, uPad.y);
    }
    if (!boss.phase2Summoned && !fromRemote) {
      boss.phase2Summoned = true;
      for (let i = 0; i < lair.scaling.phase2Adds; i++) {
        const ang = Math.PI * 0.72 + i * 0.55;
        lair.minions.push(
          makeMinionInstance(
            {
              id: `p2-add-${i}-${Math.round(session.simTimeSec || 0)}`,
              kind: 'swarmer',
              name: 'Sanctum Swarmer',
              x: boss.x + Math.cos(ang) * 8.0,
              y: boss.y + Math.sin(ang) * 5.0,
              hp: 64,
              radius: 0.98,
              dropOrb: true,
              isBossAdd: true,
            },
            lair.scaling.hpMult
          )
        );
      }
    }
  } else if (boss.phase < 3 && hpRatio <= 0.33 && boss.hp > 0) {
    boss.phase = 3;
    boss.phaseShiftSec = 0.9;
    boss.phase3Roared = true;
    boss.aiState = 'beam_windup';
    const toPlayer = session.diver
      ? Math.atan2(session.diver.y - boss.y, session.diver.x - boss.x)
      : Math.PI;
    boss.beamSweepDir = Math.random() < 0.5 ? 1 : -1;
    boss.beamAngle = toPlayer - boss.beamSweepDir * 0.85;
    boss.stateTimer = 1.35;
    boss.stateMaxTimer = 1.35;
    boss.blackoutAlpha = 0.42;
    lair.enemyProjectiles.length = 0;
    addShockwave(lair, boss.x, boss.y, 29, '#f43f5e', 0.9);
    showTitleBanner(lair, `PHASE III · ${boss.name} UNLEASHED`, 'PILLAR COVER BLOCKS THE BEAM · DROP STALACTITES', '#fb7185', 2.8);
    if (session.cameraShake !== undefined) session.cameraShake = Math.max(session.cameraShake || 0, 0.82);
    if (session.hitstopSec !== undefined) session.hitstopSec = Math.max(session.hitstopSec || 0, 0.12);
    spawnHealOrb(lair, lair.spec.arena.cx - 4, lair.spec.arena.cy - 6.0, 32);
    spawnHealOrb(lair, lair.spec.arena.cx - 4, lair.spec.arena.cy + 6.0, 32);
    if (!fromRemote) {
      const bPad = _pickOpenArenaPad(lair, boss.x, boss.y);
      spawnBatteryCell(lair, bPad.x, bPad.y);
      const uPad = _pickOpenArenaPad(lair, boss.x, boss.y);
      spawnWeaponUpgrade(lair, uPad.x, uPad.y);
    }
    callbacks.onBossRoar?.(3);
  }

  // Victory — Multi-Stage Slow-Mo Killing Blow! (Lose Speargun immediately on Boss Kill!)
  if (boss.hp <= 0 && !boss.defeated) {
    boss.defeated = true;
    boss.active = false;
    boss.pinnedTargetId = null;
    boss.vortexStrength = 0;
    boss.blackoutAlpha = 0;
    boss.defeatAnimSec = 3.6;
    boss._defeatBurstStep = 0;
    lair.bossDefeated = true;
    lair.trophyClaimed = true;
    // Only have the Speargun in this mode — killing the boss immediately removes it & restores pre-combat DPV loadout!
    lair.weaponEquipped = false;
    lair.charging = false;
    lair.chargeSec = 0;
    lair.recoilSec = 0;
    lair.muzzleFlashSec = 0;
    lair.spears.length = 0;
    if (Array.isArray(lair.batteryCells)) lair.batteryCells.length = 0;
    if (Array.isArray(lair.weaponUpgrades)) lair.weaponUpgrades.length = 0;
    if (Array.isArray(lair.bossHazards)) lair.bossHazards.length = 0;
    lair.cryoSlowSec = 0;
    restorePreCombatScooter(session);
    lair.bonusScore = (lair.bonusScore || 0) + (lair.spec.boss.bonusPoints || 2500);
    for (const m of lair.minions) {
      if (m.alive && isPointInArena(lair.spec.arena, m.x, m.y, 12)) {
        m.alive = false;
        m.hp = 0;
      }
    }
    lair.enemyProjectiles.length = 0;
    if (session.cameraShake !== undefined) session.cameraShake = 0.92;
    if (session.timeScale !== undefined) {
      session.timeScale = 0.28;
      session._slowMoTimer = 0.58;
    }
    addShockwave(lair, boss.x, boss.y, 32, '#67e8f9', 1.15);
    addSparkBurst(lair, boss.x, boss.y, '#67e8f9', 32, `🏆 ${lair.spec.boss.trophyName}!`, true);
    showTitleBanner(lair, `${boss.name} VANQUISHED`, 'SWIM INTO THE THERMAL UPDRAFT TO SURFACE', '#34d399', 4.2);
    callbacks.onBossDefeat?.(boss, lair);
    callbacks.onToast?.(
      `🏆 VICTORY! ${boss.name} defeated (+${lair.spec.boss.bonusPoints} pts)! Swim into the glowing Updraft to surface!`,
      5.5
    );
  }
  return { ok: true, hp: boss.hp, defeated: boss.defeated, phase: boss.phase };
}

/**
 * Handle contextual `[E]` interact inside a Secret Lair.
 */
export function handleSecretLairInteract(session, callbacks = {}) {
  const lair = session?.secretLair;
  if (!lair || !session?.diveState?.alive) return { handled: false };
  const { diver } = session;

  if (lair.boss?.pinnedTargetId === 'local' && !lair.boss.defeated) {
    lair.boss.pinHitsNeeded = Math.max(0, (lair.boss.pinHitsNeeded || 1) - 1);
    addSparkBurst(lair, diver.x, diver.y, '#fde047', 6, 'SLASH!', false);
    if (lair.boss.pinHitsNeeded <= 0) {
      _breakBossGrabAndStun(session, lair, diver, callbacks);
    }
    return { handled: true, kind: 'lair-unpin' };
  }

  if (lair.veilRevealed && !lair.veilBreached) {
    const v = lair.spec.veil;
    if (Math.hypot(diver.x - v.x, diver.y - v.y) <= v.radius + 3.4) {
      const res = breachSecretLairVeil(session, callbacks);
      if (res.ok) return { handled: true, kind: 'lair-veil', targetId: v.id };
    }
  }

  if (lair.veilBreached && !lair.weaponEquipped) {
    const a = lair.spec.armory;
    if (Math.hypot(diver.x - a.x, diver.y - a.y) <= a.radius + 2.8) {
      const res = claimSecretLairWeapon(session, callbacks);
      if (res.ok) return { handled: true, kind: 'lair-weapon', targetId: a.id };
    }
  }

  if (lair.bossDefeated && lair.spec.arena.exitUpdraft) {
    const up = lair.spec.arena.exitUpdraft;
    if (Math.hypot(diver.x - up.x, diver.y - up.y) <= up.radius + 3.4) {
      return _triggerVictoryUpdraft(session, up, callbacks);
    }
  }

  return { handled: false };
}

function _triggerVictoryUpdraft(session, up, callbacks) {
  const { diver, diveState, secretLair: lair } = session;
  lair.combatMode = false;
  restorePreCombatScooter(session);
  diver.x = up.destX;
  diver.y = up.destY;
  diver.vx = 0;
  diver.vy = -0.5;
  if (diver.body) {
    // Snap articulated joints to exit basin so limbs never stretch across the map for 1 frame
    for (const k of ['head', 'shoulder', 'hip', 'knee', 'ankle', 'hand', 'elbow']) {
      if (diver.body[k] && typeof diver.body[k].x === 'number') {
        diver.body[k].x = up.destX;
        diver.body[k].y = up.destY;
      }
    }
  }
  // Hyperbaric Thermal Updraft cleanly purges Bühlmann tissue inert gases & prevents teleport ascent-rate DCS! (v190)
  session._updraftSafeDepthM = up.destY;
  diveState.depthM = up.destY;
  diveState.ceilingM = 0;
  diveState.stopDepthM = 0;
  diveState.stopRemainingSec = 0;
  diveState.decoStopSec = 0;
  diveState.ttsSec = Math.round(Math.max(0, up.destY) / 0.15);
  diveState.ndlMin = 99;
  diveState.ascentRateMPerMin = 0;
  diveState.dcsStress = 0;
  diveState.hypoxiaStress = 0;
  diveState.cardiacStress = 0;
  diveState.narcosisLevel = 0;
  diveState.panicLevel = 0;
  diveState.surfaceViolationsSec = 0;
  diveState.heartRateBpm = Math.min(diveState.heartRateBpm || 78, 82);
  diveState.warnings = [];
  diveState.criticalAlarm = null;
  if (Array.isArray(diveState.compartments)) {
    for (let i = 0; i < diveState.compartments.length; i++) {
      diveState.compartments[i].pN2 = 0.7408;
      diveState.compartments[i].pHe = 0;
    }
  }
  // Switch off hypoxic deep trimix onto shallow-safe EAN32 (with reserve guarantee) so surfacing at 6.5m -> 0m never causes hypoxia!
  if (diveState.tanks?.EAN32) {
    const eanTank = diveState.tanks.EAN32;
    const eanMix = diveState.mixes?.EAN32;
    const startBar = eanMix?.startBar || 200;
    if ((eanTank.bar || 0) < 40 && eanTank.maxLiters > 0) {
      eanTank.bar = 40;
      eanTank.litersRemaining = (40 / startBar) * eanTank.maxLiters;
    }
    diveState.activeGasId = 'EAN32';
  }
  if (session.checkpointsHit && Array.isArray(session.level?.checkpoints)) {
    for (let i = 0; i < session.level.checkpoints.length; i++) {
      session.checkpointsHit.add(session.level.checkpoints[i].id);
    }
  }
  if (session.level?.recoveryTarget) {
    session.bodyRecovered = true;
  }
  callbacks.onUpdraftTeleport?.(up);
  callbacks.onToast?.('✨ Thermal Updraft purged deco & carried you to the Exit Basin — ascend safely to claim your Boss Victory!', 4.5);
  return { handled: true, kind: 'lair-updraft', targetId: 'updraft' };
}

/**
 * Compute contextual HUD action prompt for the Secret Lair.
 * Deliberately returns NULL for the hidden tight squeeze so there is ZERO direct callout!
 */
export function getSecretLairActionPrompt(session) {
  const lair = session?.secretLair;
  if (!lair || !session?.diveState?.alive) return null;
  const { diver } = session;

  if (lair.boss?.pinnedTargetId === 'local' && !lair.boss.defeated) {
    return {
      kind: 'lair-unpin',
      label: `🔪 SLASH FREE [E] / TAP FIRE (${lair.boss.pinHitsNeeded || 1})`,
      detail: 'Break the Kraken tentacle snare to stun the boss!',
      progress: 0,
    };
  }

  if (lair.bossDefeated && lair.spec.arena.exitUpdraft) {
    const up = lair.spec.arena.exitUpdraft;
    if (Math.hypot(diver.x - up.x, diver.y - up.y) <= up.radius + 3.4) {
      return {
        kind: 'lair-updraft',
        label: '✨ ASCEND TO SURFACE [E]',
        detail: 'Ride the Bioluminescent Updraft out of the Sanctum',
        progress: 0,
      };
    }
  }
  return null;
}

/**
 * Step Secret Lair barriers, auto-equip armory, cover pillars, Resonance Crystals, speargun bolts,
 * emerald Bio-Heal Orbs, corridor gauntlet enemies, AI wingmen & 3-phase Kraken boss!
 */
export function stepSecretLairEncounter(session, dt, { peers = [], isAuthority = true } = {}, callbacks = {}) {
  const lair = session?.secretLair;
  if (!lair || dt <= 0) return;
  const { level, diver, diveState } = session;

  if (lair.veilRevealPulse > 0) lair.veilRevealPulse = Math.max(0, lair.veilRevealPulse - dt);
  if (lair.reloadSec > 0) lair.reloadSec = Math.max(0, lair.reloadSec - dt);
  if (lair.tapCooldownSec > 0) lair.tapCooldownSec = Math.max(0, lair.tapCooldownSec - dt);
  if (lair.recoilSec > 0) lair.recoilSec = Math.max(0, lair.recoilSec - dt);
  if (lair.muzzleFlashSec > 0) lair.muzzleFlashSec = Math.max(0, lair.muzzleFlashSec - dt);
  if (lair.playerIframesSec > 0) lair.playerIframesSec = Math.max(0, lair.playerIframesSec - dt);
  if (lair.playerHitFlash > 0) lair.playerHitFlash = Math.max(0, lair.playerHitFlash - dt);
  if (lair.combatHintTimer > 0) lair.combatHintTimer = Math.max(0, lair.combatHintTimer - dt);
  if (lair.titleBannerSec > 0) lair.titleBannerSec = Math.max(0, lair.titleBannerSec - dt);
  if (lair.foreshadowTimer > 0) lair.foreshadowTimer = Math.max(0, lair.foreshadowTimer - dt);
  if (lair.dashCooldownSec > 0) lair.dashCooldownSec = Math.max(0, lair.dashCooldownSec - dt);
  if (lair.cryoSlowSec > 0) {
    lair.cryoSlowSec = Math.max(0, lair.cryoSlowSec - dt);
    if (lair.dashTimerSec > 0) {
      lair.cryoSlowSec = 0; // Hydro-Dash instantly shatters frost chill!
    } else if (diver && diveState?.alive && lair.combatMode) {
      const drag = Math.max(0.55, 1 - dt * 2.4);
      diver.vx *= drag;
      diver.vy *= drag;
    }
  }
  if (lair.dashTimerSec > 0) {
    lair.dashTimerSec = Math.max(0, lair.dashTimerSec - dt);
    if (diver && diveState?.alive && lair.combatMode) {
      const dashBlend = 0.55 + 0.45 * (lair.dashTimerSec / Math.max(0.05, SCOOTER_DASH_DURATION_SEC));
      diver.vx = lair.dashDirX * SCOOTER_DASH_SPEED * dashBlend;
      diver.vy = lair.dashDirY * SCOOTER_DASH_SPEED * dashBlend;
      if (!Array.isArray(lair.dashTrail)) lair.dashTrail = [];
      lair.dashTrail.push({
        x: diver.x,
        y: diver.y,
        angle: Math.atan2(lair.dashDirY, lair.dashDirX),
        life: 0.28,
        maxLife: 0.28,
      });
      if (lair.dashTrail.length > 14) lair.dashTrail.shift();
    }
  }
  if (Array.isArray(lair.dashTrail)) {
    for (let i = lair.dashTrail.length - 1; i >= 0; i--) {
      lair.dashTrail[i].life -= dt;
      if (lair.dashTrail[i].life <= 0) lair.dashTrail.splice(i, 1);
    }
  }
  if (lair.boss?.phaseShiftSec > 0) lair.boss.phaseShiftSec = Math.max(0, lair.boss.phaseShiftSec - dt);
  if (lair.boss?.active && !lair.boss.defeated && lair.boss.aiState !== 'awakening') {
    lair.bossFightElapsedSec = (lair.bossFightElapsedSec || 0) + dt;
  }

  for (const st of lair.stages) {
    if (st.cooldownSec > 0) st.cooldownSec = Math.max(0, st.cooldownSec - dt);
  }
  for (const pc of lair.pillarCrystals || []) {
    if (pc.cooldownSec > 0) pc.cooldownSec = Math.max(0, pc.cooldownSec - dt);
    if (pc.dischargeAnimSec > 0) pc.dischargeAnimSec = Math.max(0, pc.dischargeAnimSec - dt);
    if (pc.flashSec > 0) pc.flashSec = Math.max(0, pc.flashSec - dt);
  }
  for (let i = (lair.shockwaves || []).length - 1; i >= 0; i--) {
    const sw = lair.shockwaves[i];
    sw.life -= dt;
    const t = 1 - Math.max(0, sw.life / Math.max(0.05, sw.maxLife));
    sw.radius = 0.8 + (sw.maxRadius - 0.8) * (1 - Math.pow(1 - t, 2.2));
    if (sw.life <= 0) lair.shockwaves.splice(i, 1);
  }

  // 1. Sealed False Limestone Tight-Squeeze Barrier (planar seal + radial push + failsafe!)
  if (!lair.veilBreached) {
    const v = lair.spec.veil;
    const dx = diver.x - v.x;
    const dy = diver.y - v.y;
    const dist = Math.hypot(dx, dy);
    const inNeckBand = diver.y >= (v.sealMinY ?? 46.2) && diver.y <= (v.sealMaxY ?? 54.4);

    // Ultimate Failsafe: if diver EVER gets deep past the neck (x >= 141.5), auto-breach so the lair is NEVER empty!
    if (inNeckBand && diver.x >= (v.failsafeX ?? 141.5)) {
      breachSecretLairVeil(session, callbacks);
    } else if (lair.veilRevealed && (dist <= v.radius + 1.35 || (inNeckBand && diver.x >= (v.sealWallX ?? 134.8) - 0.6))) {
      breachSecretLairVeil(session, callbacks);
    } else {
      // Unrevealed: enforce BOTH planar vertical seal across the entire tight-squeeze neck AND radial pushback!
      const sealX = v.sealWallX ?? 134.8;
      if (inNeckBand && diver.x > sealX) {
        diver.x = sealX;
        if (diver.vx > 0) diver.vx = 0;
      }
      const minD = v.radius + 0.65;
      if (dist < minD && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;
        const push = minD - dist;
        diver.x += nx * push;
        diver.y += ny * push;
        const vn = diver.vx * nx + diver.vy * ny;
        if (vn < 0) {
          diver.vx -= nx * vn;
          diver.vy -= ny * vn;
        }
      }
      _stepSparks(lair, dt);
      return;
    }
  }

  // 1a. Ossuary Kraken Shadow Foreshadowing (passing colossal shadowed tentacle + muffled sub-bass groan!)
  if (!lair.foreshadowTriggered && lair.spec.foreshadowX && diver.x >= lair.spec.foreshadowX && !lair.arenaEntered) {
    lair.foreshadowTriggered = true;
    lair.foreshadowTimer = 3.2;
    if (session.cameraShake !== undefined) {
      session.cameraShake = Math.max(session.cameraShake || 0, 0.24);
    }
    callbacks.onForeshadow?.();
  }

  // 1b. Speargun & Combat Scooter Mode Exclusivity: only equipped inside the Secret Lair while boss is undefeated!
  const sealX = lair.spec.veil?.sealWallX ?? 134.8;
  if (lair.bossDefeated) {
    if (lair.weaponEquipped) {
      lair.weaponEquipped = false;
      lair.spears.length = 0;
    }
    if (lair.combatScooterGranted) restorePreCombatScooter(session);
    if (diver.x < sealX - 1.8 && lair.combatMode) {
      lair.combatMode = false;
      session._updraftSafeDepthM = diver.y;
    }
  } else if (diver.x < sealX - 1.8) {
    // Exited secret passage back into main cave -> stow speargun, restore DPV loadout & normal diving HUD
    if (lair.weaponEquipped || lair.combatMode || lair.combatScooterGranted) {
      lair.weaponEquipped = false;
      lair.combatMode = false;
      lair.spears.length = 0;
      restorePreCombatScooter(session);
    }
  } else if (lair.weaponClaimed && !lair.weaponEquipped && diver.x >= sealX + 1.0 && diveState?.alive) {
    // Re-entered secret lair before defeating boss -> seamlessly re-equip speargun & Combat Scooter
    lair.weaponEquipped = true;
    lair.combatMode = true;
    grantBossCombatScooter(session);
  }

  // Frictionless Auto-Equip Speargun when swimming onto the Armory Rack in the quiet anteroom!
  if (!lair.weaponClaimed && !lair.bossDefeated && lair.spec.armory && diveState?.alive) {
    const a = lair.spec.armory;
    if (Math.hypot(diver.x - a.x, diver.y - a.y) <= a.radius) {
      claimSecretLairWeapon(session, callbacks);
    }
  }

  // 1c. Auto-ride Victory Updraft if swimming directly into the bright vortex column
  if (lair.bossDefeated && lair.spec.arena.exitUpdraft && diveState?.alive) {
    const up = lair.spec.arena.exitUpdraft;
    if (Math.hypot(diver.x - up.x, diver.y - up.y) <= up.radius * 0.78) {
      _triggerVictoryUpdraft(session, up, callbacks);
      return;
    }
  }

  // 2. Arena Natural Limestone Cover Pillar collision (runs AFTER hydrodynamics integration + zeroes inward velocity!)
  const pillars = lair.spec.arena.pillars || [];
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    const dx = diver.x - p.x;
    const dy = diver.y - p.y;
    const dist = Math.hypot(dx, dy);
    const minD = p.radius + 0.56;
    if (dist < minD && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      const push = minD - dist;
      diver.x += nx * push;
      diver.y += ny * push;
      const vn = diver.vx * nx + diver.vy * ny;
      if (vn < 0) {
        diver.vx -= nx * vn;
        diver.vy -= ny * vn;
      }
    }
  }

  // 2b. Step Emerald Bio-Heal Orbs (gentle float + magnetic swim-over pickup!)
  for (let i = lair.healOrbs.length - 1; i >= 0; i--) {
    const orb = lair.healOrbs[i];
    orb.life -= dt;
    orb.phase += dt * 4.5;
    orb.vx *= Math.max(0, 1 - dt * 2.4);
    orb.vy *= Math.max(0, 1 - dt * 2.4);
    const dx = diver.x - orb.x;
    const dy = diver.y - orb.y;
    const d = Math.hypot(dx, dy);
    if (d < 4.5 && d > 0.01 && lair.playerHp < lair.playerMaxHp) {
      orb.vx += (dx / d) * 14 * dt;
      orb.vy += (dy / d) * 14 * dt;
    }
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt + Math.sin(orb.phase) * 0.25 * dt;
    if (d <= 1.55 && diveState?.alive) {
      const healed = Math.min(orb.heal, lair.playerMaxHp - lair.playerHp);
      lair.playerHp = Math.min(lair.playerMaxHp, lair.playerHp + orb.heal);
      addSparkBurst(lair, diver.x, diver.y, '#4ade80', 8, healed > 0 ? `+${Math.round(healed)} HP` : 'FULL HP', false);
      callbacks.onHealOrb?.(healed);
      lair.healOrbs.splice(i, 1);
      continue;
    }
    if (orb.life <= 0) lair.healOrbs.splice(i, 1);
  }

  // 2c. Step DPV Battery Power Cells (glowing hover + magnetic pull + +45% scooter battery recharge!)
  for (let i = (lair.batteryCells || []).length - 1; i >= 0; i--) {
    const cell = lair.batteryCells[i];
    if (cell.inArena) cell.life -= dt;
    cell.phase = (cell.phase || 0) + dt * 4.2;
    cell.vx = (cell.vx || 0) * Math.max(0, 1 - dt * 2.5);
    cell.vy = (cell.vy || 0) * Math.max(0, 1 - dt * 2.5);
    const dx = diver.x - cell.x;
    const dy = diver.y - cell.y;
    const d = Math.hypot(dx, dy);
    const needBatt = !session.dpv || (session.dpv.batteryPct ?? 100) < 98;
    if (d < 4.6 && d > 0.01 && needBatt) {
      cell.vx += (dx / d) * 14 * dt;
      cell.vy += (dy / d) * 14 * dt;
    }
    cell.x += cell.vx * dt;
    cell.y += cell.vy * dt + Math.sin(cell.phase) * 0.2 * dt;
    if (d <= 1.7 && diveState?.alive) {
      collectBatteryCell(session, cell, callbacks);
      lair.batteryCells.splice(i, 1);
      continue;
    }
    if (cell.inArena && cell.life <= 0) lair.batteryCells.splice(i, 1);
  }

  // 2d. Step Speargun Weapon Upgrade Pods (magnetic swim-over upgrade!)
  for (let i = (lair.weaponUpgrades || []).length - 1; i >= 0; i--) {
    const pod = lair.weaponUpgrades[i];
    if (pod.inArena) pod.life -= dt;
    pod.phase = (pod.phase || 0) + dt * 3.8;
    pod.vx = (pod.vx || 0) * Math.max(0, 1 - dt * 2.6);
    pod.vy = (pod.vy || 0) * Math.max(0, 1 - dt * 2.6);
    const dx = diver.x - pod.x;
    const dy = diver.y - pod.y;
    const d = Math.hypot(dx, dy);
    if (d < 4.4 && d > 0.01 && lair.weaponEquipped) {
      pod.vx += (dx / d) * 13.5 * dt;
      pod.vy += (dy / d) * 13.5 * dt;
    }
    pod.x += pod.vx * dt;
    pod.y += pod.vy * dt + Math.sin(pod.phase) * 0.22 * dt;
    if (d <= 1.75 && diveState?.alive && lair.weaponEquipped) {
      applyWeaponUpgrade(session, pod.kind, callbacks);
      lair.weaponUpgrades.splice(i, 1);
      continue;
    }
    if (pod.inArena && pod.life <= 0) lair.weaponUpgrades.splice(i, 1);
  }

  // Build active target list (local diver + live human peers + live AI wingmen)
  const targets = [];
  if (diveState?.alive && !session.surfaced) {
    targets.push({ id: 'local', x: diver.x, y: diver.y, isLocal: true, isAi: false, ref: diver });
  }
  for (const p of peers || []) {
    if (p && p.alive !== false && !p.surfaced && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      targets.push({ id: p.id, x: p.x, y: p.y, isLocal: false, isAi: false, ref: p });
    }
  }
  for (const ai of session.aiSquad || []) {
    if (ai && ai.alive !== false && !ai.surfaced && Number.isFinite(ai.x) && Number.isFinite(ai.y)) {
      targets.push({ id: ai.id, x: ai.x, y: ai.y, isLocal: false, isAi: true, ref: ai });
    }
  }

  const liveHumans = Math.max(1, 1 + (peers || []).filter((p) => p && p.alive !== false).length);
  const liveAi = (session.aiSquad || []).filter((a) => a && a.alive !== false).length;
  rescaleSecretLairForSquad(lair, liveHumans, liveAi);

  // 3. Activate Interactive Boss Awakening Sequence once any diver enters the vaulted cathedral!
  const boss = lair.boss;
  if (!boss.defeated && !boss.active) {
    const entered = targets.some((t) => isPointInArena(lair.spec.arena, t.x, t.y, 1.0));
    if (entered) {
      lair.arenaEntered = true;
      boss.active = true;
      boss.aiState = 'awakening';
      boss.awakeningTimer = 0;
      boss.stateTimer = 2.6;
      boss.stateMaxTimer = 2.6;
      lair.sconceLitCount = 0;
      lair.sconceLitFrac = 0.08;
      showTitleBanner(lair, boss.name, `${(boss.title || 'ANCIENT GUARDIAN').toUpperCase()} · BATTERIES, UPGRADES & STALACTITES`, '#38bdf8', 3.4);
      // Seed the arena with 2 Battery Cells & 1 Weapon Upgrade Pod right as the boss awakens!
      if (isAuthority) {
        const p1 = _pickOpenArenaPad(lair, boss.x, boss.y);
        spawnBatteryCell(lair, p1.x, p1.y);
        const p2 = _pickOpenArenaPad(lair, p1.x, p1.y);
        spawnBatteryCell(lair, p2.x, p2.y);
        const p3 = _pickOpenArenaPad(lair, boss.x, boss.y);
        spawnWeaponUpgrade(lair, p3.x, p3.y);
        lair._batterySpawnTimer = 10.5;
        lair._upgradeSpawnTimer = 14.5;
      }
    }
  }

  // 3b. Periodic Boss Arena Supply Drops (DPV Battery Cells & Speargun Weapon Upgrades!)
  if (isAuthority && boss.active && !boss.defeated && boss.aiState !== 'awakening') {
    lair._batterySpawnTimer = (lair._batterySpawnTimer ?? 10.5) - dt;
    if (lair._batterySpawnTimer <= 0) {
      lair._batterySpawnTimer = 10.5;
      const arenaCells = (lair.batteryCells || []).filter((c) => c.inArena).length;
      if (arenaCells < 3) {
        const pad = _pickOpenArenaPad(lair, boss.x, boss.y);
        spawnBatteryCell(lair, pad.x, pad.y);
        addShockwave(lair, pad.x, pad.y, 2.8, '#22d3ee', 0.4);
      }
    }
    lair._upgradeSpawnTimer = (lair._upgradeSpawnTimer ?? 14.5) - dt;
    if (lair._upgradeSpawnTimer <= 0) {
      lair._upgradeSpawnTimer = 14.5;
      const arenaPods = (lair.weaponUpgrades || []).filter((u) => u.inArena).length;
      if (arenaPods < 2) {
        const pad = _pickOpenArenaPad(lair, boss.x, boss.y);
        const pod = spawnWeaponUpgrade(lair, pad.x, pad.y);
        const meta = pod && BOSS_WEAPON_UPGRADES[pod.kind];
        addShockwave(lair, pad.x, pad.y, 3.2, meta?.color || '#38bdf8', 0.45);
      }
    }
  }

  // 4. AI Wingmen combat support (LOS-checked, nearby player engagement, crisp helpful fire rate!)
  if (lair.weaponEquipped && Array.isArray(session.aiSquad)) {
    for (const ai of session.aiSquad) {
      if (!ai || ai.alive === false) continue;
      const cd = Math.max(0, (lair._aiFireCooldowns.get(ai.id) || 0) - dt);
      lair._aiFireCooldowns.set(ai.id, cd);
      if (cd > 0) continue;
      let targetObj = null;
      let bestD = 18.0;
      if (boss.active && !boss.defeated && boss.aiState !== 'awakening' && boss.pinnedTargetId === 'local') {
        targetObj = boss;
      } else {
        for (const m of lair.minions) {
          if (!m.alive || !m.aggro) continue;
          const d = Math.hypot(m.x - ai.x, m.y - ai.y);
          if (d < bestD && hasLineOfSight(level, ai.x, ai.y, m.x, m.y, pillars)) {
            bestD = d;
            targetObj = m;
          }
        }
        if (!targetObj && boss.active && !boss.defeated && boss.aiState !== 'awakening') {
          const db = Math.hypot(boss.x - ai.x, boss.y - ai.y);
          if (db < 26 && hasLineOfSight(level, ai.x, ai.y, boss.x, boss.y, pillars)) targetObj = boss;
        }
      }
      if (targetObj) {
        const aimAng = Math.atan2(targetObj.y - ai.y, targetObj.x - ai.x);
        ai.torchAngle = aimAng;
        fireSpeargun(
          session,
          { aimAngle: aimAng, chargeFrac: 0.15, ownerId: ai.id, isLocal: false, originX: ai.x, originY: ai.y },
          callbacks
        );
        lair._aiFireCooldowns.set(ai.id, 0.72 + Math.random() * 0.28);
      }
    }
  }

  // 5. Step Speargun Bolts & Swept Segment-Circle Collisions (walls, Resonance Crystals, minions, boss!)
  for (let i = lair.spears.length - 1; i >= 0; i--) {
    const sp = lair.spears[i];
    if (!sp) continue;
    sp.prevX = sp.x;
    sp.prevY = sp.y;
    // Seeker Sonar Upgrade: smoothly curves spears toward nearest live enemy or active boss!
    if ((sp.homingTurnRate || 0) > 0 && !sp.isRemoteVisual) {
      let bestTarget = null;
      let bestDist = sp.homingRange || 15;
      if (boss.active && !boss.defeated && boss.aiState !== 'awakening' && !sp.hitIds.has(boss.id)) {
        const db = Math.hypot(boss.x - sp.x, boss.y - sp.y);
        if (db < bestDist) {
          bestDist = db;
          bestTarget = boss;
        }
      }
      for (const m of lair.minions) {
        if (!m.alive || sp.hitIds.has(m.id)) continue;
        const dm = Math.hypot(m.x - sp.x, m.y - sp.y);
        if (dm < bestDist) {
          bestDist = dm;
          bestTarget = m;
        }
      }
      if (bestTarget) {
        const desiredAng = Math.atan2(bestTarget.y - sp.y, bestTarget.x - sp.x);
        const diff = Math.atan2(Math.sin(desiredAng - sp.angle), Math.cos(desiredAng - sp.angle));
        const maxTurn = sp.homingTurnRate * dt;
        sp.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
        const spd = sp.speed || Math.hypot(sp.vx, sp.vy) || 28;
        sp.vx = Math.cos(sp.angle) * spd;
        sp.vy = Math.sin(sp.angle) * spd;
      }
    }
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.life -= dt;

    let hitWall = sp.life <= 0 || evaluateCaveSDF(level, sp.x, sp.y) >= -0.05;
    let hitCrystal = null;
    if (!hitWall) {
      for (let pi = 0; pi < (lair.pillarCrystals || []).length; pi++) {
        const pc = lair.pillarCrystals[pi];
        if (distPointToSegment(pc.x, pc.y, sp.prevX, sp.prevY, sp.x, sp.y) <= pc.radius + 0.15) {
          hitWall = true;
          hitCrystal = pc;
          break;
        }
      }
    }
    if (hitWall) {
      if (hitCrystal && sp.life > 0 && !sp.isRemoteVisual) {
        // Shoot cover pillar Resonance Crystals to charge & stun the Kraken! (Hyper-Tip fills instantly!)
        _chargePillarCrystal(session, lair, hitCrystal, sp.piercing ? RESONANCE_MAX_CHARGE : 1, sp.x, sp.y, callbacks);
      } else if (sp.life > 0) {
        addSparkBurst(lair, sp.x, sp.y, '#94a3b8', 3);
      }
      lair.spears.splice(i, 1);
      continue;
    }

    if (sp.isRemoteVisual) continue;

    // Hanging Ceiling Stalactite swept hits (shoot twice, or 1 Hyper-Tip shot, to drop onto the boss!)
    let hitStalactite = false;
    for (const st of lair.stalactites || []) {
      if (st.state !== 'hanging') continue;
      if (distPointToSegment(st.x, st.y + 1.1, sp.prevX, sp.prevY, sp.x, sp.y) <= 1.35) {
        st.hp = Math.max(0, st.hp - (sp.piercing ? STALACTITE_MAX_HP : 1));
        st.flashSec = 0.22;
        if (st.hp <= 0) {
          st.state = 'falling';
          st.vy = 2.6;
          addSparkBurst(lair, st.x, st.y + 1.2, '#fde047', 10, '💥 STALACTITE LOOSE!', true);
          callbacks.onCrystalChime?.(2);
        } else {
          addSparkBurst(lair, st.x, st.y + 1.2, '#e2e8f0', 6, 'CRACK!', false);
          callbacks.onCrystalChime?.(1);
        }
        if (!sp.piercing) {
          hitStalactite = true;
          break;
        }
      }
    }
    if (hitStalactite) {
      lair.spears.splice(i, 1);
      continue;
    }

    // Biome-unique Shootable Boss Hazards: Mines, Orbs, Vents, Lances, Prisms, Torpedoes, Sun Obelisks & Ore Gates (v195)
    let hitHazard = false;
    for (let hi = (lair.bossHazards || []).length - 1; hi >= 0; hi--) {
      const hz = lair.bossHazards[hi];
      if (!hz || (hz.kind !== 'naval-mine' && hz.kind !== 'star-orb' && hz.kind !== 'vent-geyser' && hz.kind !== 'sun-lance' && hz.kind !== 'crystal-prism' && hz.kind !== 'homing-torpedo' && hz.kind !== 'sun-obelisk' && hz.kind !== 'ore-gate')) continue;
      if (hz.kind === 'ore-gate' && hz.dropping) continue;
      if (distPointToSegment(hz.x, hz.y, sp.prevX, sp.prevY, sp.x, sp.y) <= (hz.radius || 1.2) + 0.55) {
        hz.hp = Math.max(0, (hz.hp || 2) - (sp.piercing ? 2 : 1));
        hz.hitFlash = 0.2;
        if (hz.hp <= 0) {
          if (hz.kind === 'naval-mine') {
            _detonateNavalMine(session, lair, hi, { triggeredByPlayer: true }, callbacks);
          } else if (hz.kind === 'star-orb') {
            lair.bossHazards.splice(hi, 1);
            addShockwave(lair, hz.x, hz.y, 4.8, '#fde047', 0.42);
            addSparkBurst(lair, hz.x, hz.y, '#fde047', 12, '✦ ORB SHATTERED! +18% ⚡', true);
            if (session.dpv?.equipped) {
              session.dpv.batteryPct = Math.min(100, (session.dpv.batteryPct || 0) + 18);
            }
            callbacks.onCrystalChime?.(3);
          } else if (hz.kind === 'vent-geyser') {
            lair.bossHazards.splice(hi, 1);
            addShockwave(lair, hz.x, hz.y, 7.2, '#fb923c', 0.52);
            if (boss.active && !boss.defeated && Math.hypot(boss.x - hz.x, boss.y - hz.y) <= 13.5) {
              const dmg = Math.round(175 * (lair.scaling?.damageMult || 1));
              boss.hp = Math.max(0, boss.hp - dmg);
              boss.hitFlash = 0.35;
              lair.totalDamageDealt = (lair.totalDamageDealt || 0) + dmg;
              addSparkBurst(lair, boss.x, boss.y, '#fb923c', 18, `🌋 VENT BLAST! -${dmg}`, true);
              triggerCameraKick(session, boss.x - hz.x, boss.y - hz.y, 0.46, 0.036);
            } else {
              addSparkBurst(lair, hz.x, hz.y, '#fb923c', 12, '🌋 VENT CAPPED! +15% ⚡', true);
            }
            if (session.dpv?.equipped) {
              session.dpv.batteryPct = Math.min(100, (session.dpv.batteryPct || 0) + 15);
            }
            callbacks.onMineBlast?.();
          } else if (hz.kind === 'sun-lance') {
            lair.bossHazards.splice(hi, 1);
            addShockwave(lair, hz.x, hz.y, 5.4, '#fde047', 0.44);
            addSparkBurst(lair, hz.x, hz.y, '#fde047', 14, '☀️ PRISM SHATTERED! +18% ⚡', true);
            if (session.dpv?.equipped) {
              session.dpv.batteryPct = Math.min(100, (session.dpv.batteryPct || 0) + 18);
            }
            callbacks.onCrystalChime?.(3);
          } else if (hz.kind === 'crystal-prism') {
            lair.bossHazards.splice(hi, 1);
            addShockwave(lair, hz.x, hz.y, 6.4, '#e879f9', 0.48);
            if (boss.active && !boss.defeated) {
              const dmg = Math.round(185 * (lair.scaling?.damageMult || 1));
              boss.hp = Math.max(0, boss.hp - dmg);
              boss.hitFlash = 0.36;
              lair.totalDamageDealt = (lair.totalDamageDealt || 0) + dmg;
              addSparkBurst(lair, boss.x, boss.y, '#e879f9', 18, `💎 PRISM REFRACT! -${dmg}`, true);
              triggerCameraKick(session, boss.x - hz.x, boss.y - hz.y, 0.48, 0.038);
            } else {
              addSparkBurst(lair, hz.x, hz.y, '#e879f9', 12, '💎 SHARD SHATTERED! +18% ⚡', true);
            }
            if (session.dpv?.equipped) {
              session.dpv.batteryPct = Math.min(100, (session.dpv.batteryPct || 0) + 18);
            }
            callbacks.onCrystalChime?.(3);
          } else if (hz.kind === 'homing-torpedo') {
            lair.bossHazards.splice(hi, 1);
            addShockwave(lair, hz.x, hz.y, 5.6, '#5eead4', 0.44);
            addSparkBurst(lair, hz.x, hz.y, '#5eead4', 14, '⚓ TORPEDO INTERCEPTED! +15% ⚡', true);
            if (session.dpv?.equipped) {
              session.dpv.batteryPct = Math.min(100, (session.dpv.batteryPct || 0) + 15);
            }
            callbacks.onMineBlast?.();
          } else if (hz.kind === 'sun-obelisk') {
            // Bimini Orichalcum Mirror Obelisk: firing into it redirects a blazing solar beam straight into the Colossus!
            lair.bossHazards.splice(hi, 1);
            addShockwave(lair, hz.x, hz.y, 7.0, '#fde047', 0.5);
            if (boss.active && !boss.defeated) {
              const dmg = Math.round(205 * (lair.scaling?.damageMult || 1));
              boss.hp = Math.max(0, boss.hp - dmg);
              boss.hitFlash = 0.4;
              lair.totalDamageDealt = (lair.totalDamageDealt || 0) + dmg;
              addShockwave(lair, boss.x, boss.y, 8.0, '#fbbf24', 0.52);
              addSparkBurst(lair, boss.x, boss.y, '#fde047', 20, `🏛️ SOLAR REFLECT! -${dmg}`, true);
              triggerCameraKick(session, boss.x - hz.x, boss.y - hz.y, 0.55, 0.042);
            } else {
              addSparkBurst(lair, hz.x, hz.y, '#fde047', 12, '🏛️ OBELISK CHARGED! +18% ⚡', true);
            }
            if (session.dpv?.equipped) {
              session.dpv.batteryPct = Math.min(100, (session.dpv.batteryPct || 0) + 18);
            }
            callbacks.onCrystalChime?.(3);
          } else if (hz.kind === 'ore-gate') {
            // Ojamo Suspended Ore-Gate Counterweight: shooting the release latch drops the massive iron block!
            hz.dropping = true;
            hz.vy = 14.5;
            hz.life = 2.2;
            addShockwave(lair, hz.x, hz.y, 4.6, '#f97316', 0.36);
            addSparkBurst(lair, hz.x, hz.y, '#fbbf24', 12, '⚙️ LATCH RELEASED!', true);
            if (session.dpv?.equipped) {
              session.dpv.batteryPct = Math.min(100, (session.dpv.batteryPct || 0) + 18);
            }
            callbacks.onMineBlast?.();
          }
        } else {
          addSparkBurst(
            lair,
            hz.x,
            hz.y,
            hz.kind === 'naval-mine' || hz.kind === 'vent-geyser' || hz.kind === 'ore-gate'
              ? '#fb923c'
              : hz.kind === 'crystal-prism'
                ? '#e879f9'
                : hz.kind === 'sun-obelisk'
                  ? '#fde047'
                  : '#5eead4',
            6,
            'PING!',
            false
          );
          callbacks.onCrystalChime?.(1);
        }
        if (!sp.piercing) {
          hitHazard = true;
          break;
        }
      }
    }
    if (hitHazard) {
      lair.spears.splice(i, 1);
      continue;
    }

    // Minion swept hits
    let consumed = false;
    for (const m of lair.minions) {
      if (!m.alive || sp.hitIds.has(m.id)) continue;
      if (distPointToSegment(m.x, m.y, sp.prevX, sp.prevY, sp.x, sp.y) <= m.radius + 0.58) {
        sp.hitIds.add(m.id);
        let dmg = sp.damage;
        let crit = false;
        if (m.kind === 'stalker' && !sp.piercing) {
          const hitAng = Math.atan2(sp.y - m.y, sp.x - m.x);
          const diff = Math.abs(Math.atan2(Math.sin(hitAng - m.angle), Math.cos(hitAng - m.angle)));
          if (diff < 0.92) {
            dmg = Math.max(8, Math.round(dmg * 0.40));
          } else {
            dmg = Math.round(dmg * 1.85);
            crit = true;
          }
        } else if (sp.piercing) {
          crit = true;
        }
        m.hp = Math.max(0, m.hp - dmg);
        m.hitFlash = 0.14;
        m.aggro = true;
        addSparkBurst(
          lair,
          sp.x,
          sp.y,
          crit ? '#fde047' : dmg <= 12 ? '#94a3b8' : '#38bdf8',
          crit ? 8 : 5,
          `${crit ? 'CRIT ' : dmg <= 12 ? 'ARMOR ' : ''}-${dmg}`,
          crit
        );
        callbacks.onSpearHit?.({ target: 'minion', minionId: m.id, damage: dmg, crit, x: sp.x, y: sp.y });
        if (m.hp <= 0) {
          m.alive = false;
          lair.minionsKilled += 1;
          lair.bonusScore += m.kind === 'stalker' ? 300 : 150;
          addSparkBurst(lair, m.x, m.y, '#34d399', 12, `+${m.kind === 'stalker' ? 300 : 150}`, true);
          if (m.isBossAdd) {
            spawnBatteryCell(lair, m.x, m.y);
          } else if (m.dropOrb) {
            spawnHealOrb(lair, m.x, m.y, m.kind === 'stalker' ? 24 : 16);
          }
        }
        if (!sp.piercing) {
          consumed = true;
          break;
        }
      }
    }
    if (consumed) {
      lair.spears.splice(i, 1);
      continue;
    }

    // Boss swept hits (tighter 1.95m core radius rewards skilled aim!)
    if (boss.active && !boss.defeated && !sp.hitIds.has(boss.id)) {
      const distBoss = distPointToSegment(boss.x, boss.y, sp.prevX, sp.prevY, sp.x, sp.y);
      if (distBoss <= boss.radius + 0.65) {
        sp.hitIds.add(boss.id);
        const coreX = boss.x + Math.cos(boss.weakAngle) * (boss.radius * 1.08);
        const coreY = boss.y + Math.sin(boss.weakAngle) * (boss.radius * 1.08);
        const hitCore = distPointToSegment(coreX, coreY, sp.prevX, sp.prevY, sp.x, sp.y) <= 1.85 || boss.aiState === 'stunned';
        const crit = hitCore || sp.piercing;
        const weakMult = boss.aiState === 'stunned' ? 1.65 : (hitCore ? SPEARGUN_WEAKPOINT_MULT : 1.0);
        const roarArmor = boss.phaseShiftSec > 0 ? 0.35 : 1.0;
        const dmg = Math.round(sp.damage * weakMult * roarArmor * (sp.isLocal ? 1.0 : 0.85));

        applyBossDamage(session, dmg, { crit, hitX: sp.x, hitY: sp.y }, callbacks);
        if (sp.isLocal) {
          callbacks.onLocalBossHit?.({ damage: dmg, crit, x: sp.x, y: sp.y });
        }
        if (lair.spears[i] === sp) lair.spears.splice(i, 1);
        if (lair.spears.length === 0) break;
      }
    }
  }

  // 5b. Step Destructible Ceiling Stalactites (gravity drop -> Boss Crush +260 dmg & 2.4s stun -> 24s regrowth!)
  for (const st of lair.stalactites || []) {
    if (st.flashSec > 0) st.flashSec = Math.max(0, st.flashSec - dt);
    if (st.state === 'falling') {
      st.vy = Math.min(28, (st.vy || 2.6) + 26.0 * dt);
      st.y += st.vy * dt;
      if (
        boss.active &&
        !boss.defeated &&
        boss.aiState !== 'awakening' &&
        Math.hypot(st.x - boss.x, st.y - boss.y) <= boss.radius + 1.75
      ) {
        st.state = 'broken';
        st.respawnSec = STALACTITE_RESPAWN_SEC;
        lair.stalactiteCrushes = (lair.stalactiteCrushes || 0) + 1;
        lair.enemyProjectiles.length = 0;
        _stunBoss(session, lair, 2.4, '💥 STALACTITE CRUSH! 2× DMG', '#fde047', callbacks);
        applyBossDamage(
          session,
          STALACTITE_CRUSH_DAMAGE,
          { crit: true, hitX: st.x, hitY: st.y, bypassStunMult: true },
          callbacks
        );
        addShockwave(lair, st.x, st.y, 15.0, '#fde047', 0.58);
        if (session.cameraShake !== undefined) {
          session.cameraShake = Math.max(session.cameraShake || 0, 0.72);
        }
        if (session.hitstopSec !== undefined) {
          session.hitstopSec = Math.max(session.hitstopSec || 0, 0.055);
        }
        if (isAuthority) {
          const dropPad = _pickOpenArenaPad(lair, boss.x, boss.y);
          if ((lair.weaponUpgrades || []).filter((u) => u.inArena).length < 2) {
            spawnWeaponUpgrade(lair, dropPad.x, dropPad.y);
          } else {
            spawnBatteryCell(lair, dropPad.x, dropPad.y);
          }
        }
        callbacks.onStalactiteCrush?.(st);
      } else if (st.y >= st.floorY) {
        st.state = 'broken';
        st.respawnSec = STALACTITE_RESPAWN_SEC;
        addSparkBurst(lair, st.x, st.floorY, '#cbd5e1', 12, '', false);
        addShockwave(lair, st.x, st.floorY, 5.0, '#94a3b8', 0.32);
        if (session.cameraShake !== undefined) {
          session.cameraShake = Math.max(session.cameraShake || 0, 0.22);
        }
      }
    } else if (st.state === 'broken') {
      st.respawnSec = Math.max(0, (st.respawnSec || 0) - dt);
      if (st.respawnSec <= 0) {
        st.state = 'hanging';
        st.y = st.homeY;
        st.vy = 0;
        st.hp = st.maxHp;
      }
    }
  }

  // 5c. Step Biome-Unique Boss Signature Hazards (Naval Mines, Glacial Frost Rings, Constellation Star Orbs) (v192)
  for (let hi = (lair.bossHazards || []).length - 1; hi >= 0; hi--) {
    const hz = lair.bossHazards[hi];
    if (!hz) continue;
    hz.age = (hz.age || 0) + dt;
    if (hz.hitFlash > 0) hz.hitFlash = Math.max(0, hz.hitFlash - dt);

    if (hz.kind === 'naval-mine') {
      hz.fuseSec = (hz.fuseSec ?? 8.5) - dt;
      hz.y += Math.sin((hz.age || 0) * 2.8 + (hz.phase || 0)) * 0.35 * dt;
      const distDiver = diveState?.alive ? Math.hypot(diver.x - hz.x, diver.y - hz.y) : 99;
      if (hz.fuseSec <= 0 || distDiver <= (hz.radius || 1.35) + 0.95) {
        _detonateNavalMine(session, lair, hi, { triggeredByPlayer: false }, callbacks);
      }
    } else if (hz.kind === 'frost-ring') {
      hz.radius = (hz.radius || 2.4) + (hz.expandSpeed || 7.2) * dt;
      if (diveState?.alive && !hz.hitLocal && !hz.shatteredByLocal) {
        const dDiver = Math.hypot(diver.x - hz.x, diver.y - hz.y);
        if (Math.abs(dDiver - hz.radius) <= 1.05) {
          if ((lair.dashTimerSec || 0) > 0) {
            hz.shatteredByLocal = true;
            lair.cryoSlowSec = 0;
            if (session.dpv?.equipped) {
              session.dpv.batteryPct = Math.min(100, (session.dpv.batteryPct || 0) + 15);
            }
            addSparkBurst(lair, diver.x, diver.y, '#67e8f9', 14, '❄️ FROST SHATTER! +15% ⚡', true);
            callbacks.onCrystalChime?.(3);
          } else {
            hz.hitLocal = true;
            lair.cryoSlowSec = 1.4;
            applyDamageToLocalDiver(session, 15 * lair.scaling.damageMult, `${boss.name}'s Frost Ring`, callbacks);
            addSparkBurst(lair, diver.x, diver.y, '#38bdf8', 10, '❄️ CHILLED! DASH FREE', false);
          }
        }
      }
      if (hz.radius >= (hz.maxRadius || 17.5)) {
        lair.bossHazards.splice(hi, 1);
      }
    } else if (hz.kind === 'star-orb') {
      hz.life = (hz.life ?? 11.5) - dt;
      hz.orbitAngle = (hz.orbitAngle || 0) + (hz.orbitSpeed || 0.72) * dt;
      const cx = lair.spec.arena.cx;
      const cy = lair.spec.arena.cy;
      hz.x = cx + Math.cos(hz.orbitAngle) * (hz.orbitRx || 12.0);
      hz.y = cy + Math.sin(hz.orbitAngle) * (hz.orbitRy || 6.4);
      hz.fireCd = (hz.fireCd ?? 1.45) - dt;
      if (isAuthority && hz.fireCd <= 0 && diveState?.alive && !boss.defeated) {
        hz.fireCd = boss.phase >= 3 ? 1.55 : 1.95;
        const aim = Math.atan2(diver.y - hz.y, diver.x - hz.x);
        lair.enemyProjectiles.push({
          x: hz.x + Math.cos(aim) * 1.1,
          y: hz.y + Math.sin(aim) * 1.1,
          vx: Math.cos(aim) * 11.2,
          vy: Math.sin(aim) * 11.2,
          radius: 0.54,
          damage: 14 * lair.scaling.damageMult,
          life: 3.1,
          color: '#fde047',
          kind: 'prism',
        });
      }
      if (hz.life <= 0) {
        lair.bossHazards.splice(hi, 1);
      }
    } else if (hz.kind === 'vent-geyser') {
      hz.life = (hz.life ?? 4.2) - dt;
      const warnSec = hz.warnSec ?? 1.45;
      hz.erupting = hz.age >= warnSec;
      if (hz.erupting && diveState?.alive && !boss.defeated) {
        const halfW = hz.halfWidth || 1.65;
        const colTop = hz.y - (hz.height || 18.0);
        if (Math.abs(diver.x - hz.x) <= halfW && diver.y >= colTop && diver.y <= hz.y + 1.2) {
          // Strong thermal updraft push + scald damage unless Hydro-Dashing through i-frames
          diver.vy = Math.min(diver.vy || 0, -5.8);
          if ((lair.dashIframesSec || 0) <= 0 && (hz.hitCd || 0) <= 0) {
            hz.hitCd = 0.72;
            applyDamageToLocalDiver(session, 14 * lair.scaling.damageMult, `${boss.name}'s Thermal Vent`, callbacks);
            addSparkBurst(lair, diver.x, diver.y, '#fb923c', 10, '🌋 SCALDING PLUME!', false);
          }
        }
      }
      if ((hz.hitCd || 0) > 0) hz.hitCd = Math.max(0, hz.hitCd - dt);
      if (hz.life <= 0) {
        lair.bossHazards.splice(hi, 1);
      }
    } else if (hz.kind === 'sun-lance') {
      hz.life = (hz.life ?? 2.35) - dt;
      const warnSec = hz.warnSec ?? 1.35;
      hz.firing = hz.age >= warnSec;
      // Hydro-Dash straight through the charging Sun Prism node to shatter it for a massive counter-CRIT!
      if (!hz.firing && diveState?.alive && (lair.dashTimerSec || 0) > 0 && Math.hypot(diver.x - hz.x, diver.y - hz.y) <= (hz.radius || 1.35) + 1.4) {
        lair.bossHazards.splice(hi, 1);
        addShockwave(lair, hz.x, hz.y, 6.2, '#fde047', 0.45);
        if (session.dpv?.equipped) {
          session.dpv.batteryPct = Math.min(100, (session.dpv.batteryPct || 0) + 20);
        }
        if (boss.active && !boss.defeated) {
          const critDmg = Math.round(190 * (lair.scaling?.damageMult || 1));
          boss.hp = Math.max(0, boss.hp - critDmg);
          boss.hitFlash = 0.38;
          lair.totalDamageDealt = (lair.totalDamageDealt || 0) + critDmg;
          addSparkBurst(lair, boss.x, boss.y, '#fde047', 18, `☀️ PRISM REFLECT! -${critDmg}`, true);
        } else {
          addSparkBurst(lair, hz.x, hz.y, '#fde047', 14, '☀️ PRISM SHATTER! +20% ⚡', true);
        }
        callbacks.onCrystalChime?.(3);
        continue;
      }
      if (hz.firing && diveState?.alive && !hz.hitLocal && !boss.defeated) {
        const ang = hz.angle || 0;
        const len = hz.length || 24.0;
        const ex = hz.x + Math.cos(ang) * len;
        const ey = hz.y + Math.sin(ang) * len;
        if (distPointToSegment(diver.x, diver.y, hz.x, hz.y, ex, ey) <= 1.05) {
          if ((lair.dashIframesSec || 0) <= 0) {
            hz.hitLocal = true;
            applyDamageToLocalDiver(session, 16 * lair.scaling.damageMult, `${boss.name}'s Solar Lance`, callbacks);
            addSparkBurst(lair, diver.x, diver.y, '#fde047', 12, '☀️ SOLAR SCORCH!', false);
          }
        }
      }
      if (hz.life <= 0) {
        lair.bossHazards.splice(hi, 1);
      }
    } else if (hz.kind === 'crystal-prism') {
      // Floating Refracting Selenite Mirror Shard (v194): fires 3-way split crystal sparks until shattered!
      hz.life = (hz.life ?? 11.0) - dt;
      hz.y += Math.sin((hz.age || 0) * 2.4 + (hz.phase || 0)) * 0.42 * dt;
      hz.fireCd = (hz.fireCd ?? 1.8) - dt;
      if (isAuthority && hz.fireCd <= 0 && diveState?.alive && !boss.defeated) {
        hz.fireCd = boss.phase >= 3 ? 1.85 : 2.35;
        const baseAim = Math.atan2(diver.y - hz.y, diver.x - hz.x);
        for (let k = -1; k <= 1; k++) {
          const a = baseAim + k * 0.28;
          lair.enemyProjectiles.push({
            x: hz.x + Math.cos(a) * 1.0,
            y: hz.y + Math.sin(a) * 1.0,
            vx: Math.cos(a) * 9.8,
            vy: Math.sin(a) * 9.8,
            radius: 0.48,
            damage: 13 * lair.scaling.damageMult,
            life: 2.8,
            color: '#e879f9',
            kind: 'prism',
          });
        }
        callbacks.onCrystalChime?.(1);
      }
      if (hz.life <= 0) {
        lair.bossHazards.splice(hi, 1);
      }
    } else if (hz.kind === 'homing-torpedo') {
      // Acoustic Homing Torpedo (v194): Hydro-Dash past to invert guidance lock back into the Phantom U-Boat!
      hz.life = (hz.life ?? 9.0) - dt;
      const spd = hz.reversed ? 13.5 : (hz.speed || 7.2);
      const targetX = hz.reversed ? boss.x : diver.x;
      const targetY = hz.reversed ? boss.y : diver.y;
      const desired = Math.atan2(targetY - hz.y, targetX - hz.x);
      let ang = Number.isFinite(hz.angle) ? hz.angle : desired;
      let diff = Math.atan2(Math.sin(desired - ang), Math.cos(desired - ang));
      const maxTurn = (hz.reversed ? 5.2 : 1.85) * dt;
      ang += Math.max(-maxTurn, Math.min(maxTurn, diff));
      hz.angle = ang;
      hz.x += Math.cos(ang) * spd * dt;
      hz.y += Math.sin(ang) * spd * dt;

      // Hydro-Dash near torpedo reverses its acoustic homing lock onto the boss!
      if (!hz.reversed && diveState?.alive && (lair.dashTimerSec || 0) > 0 && Math.hypot(diver.x - hz.x, diver.y - hz.y) <= (hz.radius || 1.15) + 1.85) {
        hz.reversed = true;
        hz.life = Math.max(hz.life, 4.5);
        hz.angle = Math.atan2(boss.y - hz.y, boss.x - hz.x);
        addShockwave(lair, hz.x, hz.y, 4.4, '#5eead4', 0.38);
        addSparkBurst(lair, hz.x, hz.y, '#5eead4', 12, '⚓ TORPEDO REVERSED!', true);
        if (session.dpv?.equipped) {
          session.dpv.batteryPct = Math.min(100, (session.dpv.batteryPct || 0) + 15);
        }
        callbacks.onCrystalChime?.(3);
      }

      // Check impact on Boss (either reversed OR matador-baited after 0.9s arming)
      if (boss.active && !boss.defeated && (hz.reversed || hz.age >= 0.9) && Math.hypot(boss.x - hz.x, boss.y - hz.y) <= (boss.radius || 4.6) + (hz.radius || 1.1)) {
        lair.bossHazards.splice(hi, 1);
        const dmg = Math.round(240 * (lair.scaling?.damageMult || 1));
        boss.hp = Math.max(0, boss.hp - dmg);
        boss.hitFlash = 0.42;
        lair.totalDamageDealt = (lair.totalDamageDealt || 0) + dmg;
        addShockwave(lair, boss.x, boss.y, 8.2, '#5eead4', 0.56);
        addSparkBurst(lair, boss.x, boss.y, '#fde047', 22, `⚓ TORPEDO CRIT! -${dmg}`, true);
        triggerCameraKick(session, Math.cos(hz.angle || 0), Math.sin(hz.angle || 0), 0.62, 0.045);
        callbacks.onMineBlast?.();
        continue;
      }

      // Check impact on local diver (if not reversed and not in dash i-frames)
      if (!hz.reversed && diveState?.alive && Math.hypot(diver.x - hz.x, diver.y - hz.y) <= (hz.radius || 1.1) + 0.85) {
        lair.bossHazards.splice(hi, 1);
        if ((lair.dashIframesSec || 0) <= 0) {
          applyDamageToLocalDiver(session, 18 * lair.scaling.damageMult, `${boss.name}'s Acoustic Torpedo`, callbacks);
          addShockwave(lair, diver.x, diver.y, 5.2, '#fb923c', 0.42);
          callbacks.onMineBlast?.();
        }
        continue;
      }

      if (hz.life <= 0) {
        lair.bossHazards.splice(hi, 1);
      }
    } else if (hz.kind === 'sun-obelisk') {
      // Bimini Orichalcum Mirror Obelisk (v195): slowly rotates & fires sweeping golden sun-bolts unless shot to deflect into the Colossus!
      hz.life = (hz.life ?? 12.0) - dt;
      hz.angle = (hz.angle || 0) + dt * 0.85;
      hz.fireCd = (hz.fireCd ?? 1.9) - dt;
      if (isAuthority && hz.fireCd <= 0 && diveState?.alive && !boss.defeated) {
        hz.fireCd = boss.phase >= 3 ? 1.9 : 2.4;
        const aim = Math.atan2(diver.y - hz.y, diver.x - hz.x);
        for (let k = -1; k <= 1; k += 2) {
          const a = aim + k * 0.19;
          lair.enemyProjectiles.push({
            x: hz.x + Math.cos(a) * 1.1,
            y: hz.y + Math.sin(a) * 1.1,
            vx: Math.cos(a) * 10.2,
            vy: Math.sin(a) * 10.2,
            radius: 0.5,
            damage: 13 * lair.scaling.damageMult,
            life: 2.8,
            color: '#fde047',
            kind: 'prism',
          });
        }
        callbacks.onCrystalChime?.(1);
      }
      if (hz.life <= 0) {
        lair.bossHazards.splice(hi, 1);
      }
    } else if (hz.kind === 'ore-gate') {
      // Ojamo Suspended Ore-Gate Counterweight (v195): hovers with glowing latch; once shot, plummets to crush & stun the Drill-Wyrm!
      hz.life = (hz.life ?? 14.0) - dt;
      if (hz.dropping) {
        hz.vy = Math.min(26, (hz.vy || 14) + 22 * dt);
        hz.y += hz.vy * dt;
        // Check massive iron crush on Boss!
        if (boss.active && !boss.defeated && Math.hypot(boss.x - hz.x, boss.y - hz.y) <= (boss.radius || 4.6) + (hz.radius || 1.55) + 0.6) {
          lair.bossHazards.splice(hi, 1);
          const dmg = Math.round(235 * (lair.scaling?.damageMult || 1));
          boss.hp = Math.max(0, boss.hp - dmg);
          boss.hitFlash = 0.45;
          lair.totalDamageDealt = (lair.totalDamageDealt || 0) + dmg;
          _stunBoss(session, lair, 3.2, `⚙️ ORE-GATE CRUSH! -${dmg}`, '#fb923c', callbacks);
          triggerCameraKick(session, 0, 1, 0.68, 0.048);
          callbacks.onMineBlast?.();
          continue;
        }
        const floorY = (lair.spec.arena.cy || 68) + (lair.spec.arena.ry || 13.5) - 2.0;
        if (hz.y >= floorY) {
          lair.bossHazards.splice(hi, 1);
          addShockwave(lair, hz.x, floorY, 7.6, '#f97316', 0.48);
          // Splash blast if boss is close to impact floor
          if (boss.active && !boss.defeated && Math.hypot(boss.x - hz.x, boss.y - floorY) <= 10.5) {
            const dmg = Math.round(145 * (lair.scaling?.damageMult || 1));
            boss.hp = Math.max(0, boss.hp - dmg);
            boss.hitFlash = 0.35;
            lair.totalDamageDealt = (lair.totalDamageDealt || 0) + dmg;
            addSparkBurst(lair, boss.x, boss.y, '#fb923c', 16, `⚙️ TREMOR HIT! -${dmg}`, true);
            triggerCameraKick(session, 0, 1, 0.45, 0.032);
          } else {
            addSparkBurst(lair, hz.x, floorY, '#fb923c', 12, '⚙️ SLAM!', false);
          }
          callbacks.onMineBlast?.();
          continue;
        }
      } else {
        hz.y += Math.sin((hz.age || 0) * 2.2 + (hz.phase || 0)) * 0.22 * dt;
        if (hz.life <= 0) {
          lair.bossHazards.splice(hi, 1);
        }
      }
    }
  }

  // 6. Step Lesser Enemies along the Long Hidden Corridor
  if (isAuthority) {
    for (const m of lair.minions) {
      if (!m.alive) continue;
      if (m.hitFlash > 0) m.hitFlash = Math.max(0, m.hitFlash - dt);
      m.wigglePhase += dt * (m.state === 'lunge' ? 14 : 5);
      if (m.cooldown > 0) m.cooldown = Math.max(0, m.cooldown - dt);

      let nearest = null;
      let bestDist = 17.5;
      for (const t of targets) {
        const d = Math.hypot(t.x - m.x, t.y - m.y);
        if (d < bestDist) { bestDist = d; nearest = t; }
      }
      if (!nearest) {
        const tx = m.homeX + Math.cos(m.wigglePhase * 0.25) * 1.4;
        const ty = m.homeY + Math.sin(m.wigglePhase * 0.32) * 0.9;
        m.x += (tx - m.x) * Math.min(1, dt * 1.5);
        m.y += (ty - m.y) * Math.min(1, dt * 1.5);
        continue;
      }

      m.aggro = true;
      const toAng = Math.atan2(nearest.y - m.y, nearest.x - m.x);

      if (m.kind === 'moray' || m.kind === 'stalker') {
        if (m.state === 'idle') {
          m.angle = toAng;
          const speed = m.kind === 'stalker' ? 3.35 : 3.9;
          if (bestDist > (m.kind === 'stalker' ? 5.6 : 6.8)) {
            m.vx = Math.cos(toAng) * speed;
            m.vy = Math.sin(toAng) * speed;
          } else if (m.cooldown <= 0) {
            m.state = 'telegraph';
            m.stateTimer = m.kind === 'stalker' ? 0.65 : 0.48;
            m.lungeDirX = Math.cos(toAng);
            m.lungeDirY = Math.sin(toAng);
            m.vx *= 0.2;
            m.vy *= 0.2;
          } else {
            m.vx *= 0.85;
            m.vy *= 0.85;
          }
          // Mild body-contact damage so players can't just swim straight through monsters!
          if (diveState?.alive && Math.hypot(diver.x - m.x, diver.y - m.y) <= m.radius + 0.55) {
            applyDamageToLocalDiver(session, 9 * lair.scaling.damageMult, m.name, callbacks);
            const pa = Math.atan2(diver.y - m.y, diver.x - m.x);
            diver.vx += Math.cos(pa) * 3.8;
            diver.vy += Math.sin(pa) * 3.8;
          }
        } else if (m.state === 'telegraph') {
          m.stateTimer -= dt;
          if (m.stateTimer <= 0) {
            m.state = 'lunge';
            m.stateTimer = 0.46;
            const lSpd = m.kind === 'stalker' ? 9.8 : 11.2;
            m.vx = m.lungeDirX * lSpd;
            m.vy = m.lungeDirY * lSpd;
          }
        } else if (m.state === 'lunge') {
          m.stateTimer -= dt;
          // Fixed: always test distance to local diver even if minion lunged toward an AI buddy!
          if (diveState?.alive && Math.hypot(diver.x - m.x, diver.y - m.y) <= m.radius + 0.88) {
            applyDamageToLocalDiver(session, (m.kind === 'stalker' ? 22 : 16) * lair.scaling.damageMult, m.name, callbacks);
            diver.vx += m.lungeDirX * 5.2;
            diver.vy += m.lungeDirY * 5.2;
            m.state = 'idle';
            m.cooldown = 1.35;
          } else if (m.stateTimer <= 0) {
            m.state = 'idle';
            m.cooldown = 1.15;
          }
        }
      } else {
        // Brine Spitter Swarmer: strafes and fires dodgeable acid-brine globules
        m.angle = toAng;
        const desiredDist = 7.8;
        const radial = bestDist < desiredDist - 1.5 ? -2.4 : bestDist > desiredDist + 1.5 ? 3.0 : 0;
        const strafe = Math.sin(m.wigglePhase * 0.4) * 2.4;
        m.vx = Math.cos(toAng) * radial - Math.sin(toAng) * strafe;
        m.vy = Math.sin(toAng) * radial + Math.cos(toAng) * strafe;
        if (m.cooldown <= 0 && bestDist < 16.5) {
          m.cooldown = 1.75 / lair.scaling.attackRateMult;
          lair.enemyProjectiles.push({
            x: m.x + Math.cos(toAng) * 0.9,
            y: m.y + Math.sin(toAng) * 0.9,
            vx: Math.cos(toAng) * 10.2,
            vy: Math.sin(toAng) * 10.2,
            radius: 0.46,
            damage: 14 * lair.scaling.damageMult,
            life: 2.3,
            color: '#a3e635',
            kind: 'brine',
          });
        }
      }

      const nx = m.x + m.vx * dt;
      const ny = m.y + m.vy * dt;
      if (evaluateCaveSDF(level, nx, ny) < -(m.radius * 0.55)) {
        m.x = nx;
        m.y = ny;
      } else if (evaluateCaveSDF(level, nx, m.y) < -(m.radius * 0.55)) {
        m.x = nx;
        m.vy *= -0.25;
      } else if (evaluateCaveSDF(level, m.x, ny) < -(m.radius * 0.55)) {
        m.y = ny;
        m.vx *= -0.25;
      } else {
        m.vx *= -0.35;
        m.vy *= -0.35;
      }
    }
  }

  // 7. Step Dynamic 3-Phase Cave Kraken Boss (*XIBALBA'S MAW*) + Anime Body-Language Animation State
  lair.vortexShelteredPillarId = null;
  if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  if (boss.blackoutAlpha > 0) boss.blackoutAlpha = Math.max(0, boss.blackoutAlpha - dt * 0.35);
  const anim = boss.anim || (boss.anim = {
    prevX: boss.x, prevY: boss.y, facing: -1, pitch: 0, scaleX: 1, scaleY: 1,
    jiggleAmp: 0, jigglePhase: 0, swimCycle: 0, earFlap: 0, cheekPuff: 0,
    mouthOpen: 0, dizzyAngle: 0, hurtSec: 0, crownBob: 0, speed: 0,
  });
  anim.prevX = boss.x;
  anim.prevY = boss.y;

  if (boss.defeated) {
    if (boss.defeatAnimSec > 0) {
      boss.defeatAnimSec = Math.max(0, boss.defeatAnimSec - dt);
      const elapsed = 3.6 - boss.defeatAnimSec;
      const nextStep = Math.floor(elapsed / 0.52);
      if (nextStep > (boss._defeatBurstStep || 0) && nextStep <= 6) {
        boss._defeatBurstStep = nextStep;
        const bx = boss.x + (Math.random() - 0.5) * boss.radius * 1.4;
        const by = boss.y + (Math.random() - 0.5) * boss.radius * 1.2;
        addSparkBurst(lair, bx, by, nextStep % 2 === 0 ? '#67e8f9' : '#f472b6', 14);
        addShockwave(lair, bx, by, 7.5 + nextStep * 1.4, nextStep % 2 === 0 ? '#22d3ee' : '#c084fc', 0.55);
        if (session.cameraShake !== undefined) {
          session.cameraShake = Math.max(session.cameraShake || 0, 0.34);
        }
      }
    }
  } else if (boss.active) {
    if (boss.aiState !== 'stunned' && boss.aiState !== 'awakening') {
      boss.weakAngle += dt * (boss.phase === 3 ? 0.88 : boss.phase === 2 ? 0.62 : 0.44);
    }
    for (const t of boss.tentacles) {
      t.waveOffset += dt * (boss.aiState === 'stunned' ? 1.1 : boss.phase === 3 ? 5.2 : 3.4);
    }

    const arenaTargets = targets.filter((t) => isPointInArena(lair.spec.arena, t.x, t.y, 6));
    // Prefer human targets so immortal AI wingmen don't soak every single boss turn!
    const humanArenaTargets = arenaTargets.filter((t) => !t.isAi);
    const targetPool = humanArenaTargets.length > 0 ? humanArenaTargets : arenaTargets;
    const primaryTarget =
      targetPool.length > 0
        ? targetPool[boss.attackSeq % targetPool.length]
        : targets[0] || { id: 'local', x: diver.x, y: diver.y };

    // 7a. Awakening Sequence (sequential sconce ignition + roar shockwave!)
    if (boss.aiState === 'awakening') {
      boss.awakeningTimer = (boss.awakeningTimer || 0) + dt;
      boss.angle = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
      const totalSconces = (lair.spec.arena.lightSconces || []).length || 6;
      const desiredLit = Math.min(totalSconces, Math.max(0, Math.floor((boss.awakeningTimer - 0.42) / 0.28) + 1));
      if (desiredLit > (lair.sconceLitCount || 0)) {
        lair.sconceLitCount = desiredLit;
        callbacks.onSconceIgnite?.(desiredLit - 1);
      }
      lair.sconceLitFrac = Math.min(1, 0.1 + (lair.sconceLitCount / totalSconces) * 0.9);
      const prevT = boss.stateTimer;
      boss.stateTimer -= dt;
      if (prevT > 1.0 && boss.stateTimer <= 1.0) {
        // Dramatic Awakening Roar shockwave!
        addShockwave(lair, boss.x, boss.y, 28, '#38bdf8', 0.9);
        if (session.cameraShake !== undefined) session.cameraShake = Math.max(session.cameraShake || 0, 0.68);
        callbacks.onBossRoar?.(1);
      }
      if (boss.stateTimer <= 0) {
        lair.sconceLitCount = totalSconces;
        lair.sconceLitFrac = 1;
        boss.aiState = 'idle';
        boss.stateTimer = 0.75;
        boss.stateMaxTimer = 0.75;
      }
    }

    // 7b. Dynamic gliding & Lunge Dash (including Matador Pillar-Crash Stun!)
    if (isAuthority && boss.aiState !== 'awakening') {
      if (boss.aiState === 'lunge_dash') {
        const dx = boss.lungeDestX - boss.x;
        const dy = boss.lungeDestY - boss.y;
        const d = Math.hypot(dx, dy);
        const spd = 23.0;
        if (d > 0.6) {
          boss.x += (dx / d) * Math.min(d, spd * dt);
          boss.y += (dy / d) * Math.min(d, spd * dt);
          boss.angle = Math.atan2(dy, dx);
        }
        // Matador Pillar-Bait: if Kraken slams headfirst into a cover pillar, it CRASHES and self-stuns!
        let crashedPillar = null;
        for (const p of pillars) {
          if (Math.hypot(boss.x - p.x, boss.y - p.y) <= boss.radius * 0.78 + p.radius) {
            crashedPillar = p;
            break;
          }
        }
        if (crashedPillar) {
          // Bounce slightly off pillar and self-stun for 3.5s!
          const ba = Math.atan2(boss.y - crashedPillar.y, boss.x - crashedPillar.x);
          boss.x = crashedPillar.x + Math.cos(ba) * (boss.radius * 0.85 + crashedPillar.radius + 0.4);
          boss.y = crashedPillar.y + Math.sin(ba) * (boss.radius * 0.85 + crashedPillar.radius + 0.4);
          lair.pillarCrashes = (lair.pillarCrashes || 0) + 1;
          _stunBoss(session, lair, 3.5, '💥 PILLAR CRASH! 2× DMG', '#fde047', callbacks);
          applyBossDamage(session, 200, { crit: true, hitX: crashedPillar.x, hitY: crashedPillar.y, bypassStunMult: true }, callbacks);
          const pad = _pickOpenArenaPad(lair, boss.x, boss.y);
          if ((lair.weaponUpgrades || []).filter((u) => u.inArena).length < 2) {
            spawnWeaponUpgrade(lair, pad.x, pad.y);
          } else {
            spawnBatteryCell(lair, pad.x, pad.y);
          }
        }
      } else if (boss.aiState !== 'stunned' && boss.aiState !== 'beam_sweep') {
        const anchors = lair.spec.arena.bossAnchors || [{ x: boss.homeX, y: boss.homeY }];
        const anc = anchors[boss.anchorIdx % anchors.length];
        const hoverX = anc.x + Math.cos(session.simTimeSec * 0.52) * 3.2;
        const hoverY = anc.y + Math.sin(session.simTimeSec * 0.68) * 2.2;
        boss.x += (hoverX - boss.x) * Math.min(1, dt * 1.45);
        boss.y += (hoverY - boss.y) * Math.min(1, dt * 1.45);
        if (boss.aiState !== 'beam_windup' && boss.aiState !== 'lunge_windup') {
          boss.angle = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
        }
      }
    }

    // Local diver lunge-dash contact check (works on both host & non-host co-op clients; WYSIWYG radius!)
    if (boss.aiState === 'lunge_dash' && diveState?.alive) {
      if (Math.hypot(diver.x - boss.x, diver.y - boss.y) <= boss.radius + 0.45) {
        applyDamageToLocalDiver(session, 20 * lair.scaling.damageMult, `${boss.name}'s Lunge`, callbacks);
        const pushA = Math.atan2(diver.y - boss.y, diver.x - boss.x);
        diver.vx += Math.cos(pushA) * 7.5;
        diver.vy += Math.sin(pushA) * 7.5;
      }
    }

    // 7c. Sweeping Bioluminescent Abyssal Beam (Phase 2 & 3 — physically occluded by the 3 cover pillars!)
    if (boss.aiState === 'beam_windup' || boss.aiState === 'beam_sweep') {
      if (boss.aiState === 'beam_sweep') {
        const sweepSpeed = boss.phase === 3 ? 0.92 : 0.78;
        boss.beamAngle += boss.beamSweepDir * sweepSpeed * dt;
        boss.angle = boss.beamAngle;
      } else {
        boss.angle = boss.beamAngle;
      }
      const endPt = computeBeamEndPoint(boss.x, boss.y, boss.beamAngle, boss.beamRange || 29, pillars, 0.25);
      boss.beamEndX = endPt.x;
      boss.beamEndY = endPt.y;
      boss.beamHitPillar = Boolean(endPt.hitPillar);

      if (boss.aiState === 'beam_sweep') {
        if (endPt.hitPillar && Math.random() < dt * 22) {
          addSparkBurst(lair, endPt.x, endPt.y, boss.phase === 3 ? '#fda4af' : '#67e8f9', 2);
        }
        if (diveState?.alive) {
          const distToBeam = distPointToSegment(diver.x, diver.y, boss.x, boss.y, endPt.x, endPt.y);
          if (distToBeam <= 1.25) {
            applyDamageToLocalDiver(session, 26 * dt * lair.scaling.damageMult, `${boss.name}'s Abyssal Beam`, callbacks, { continuous: true });
            if (Math.random() < dt * 14) {
              addSparkBurst(lair, diver.x, diver.y, '#fda4af', 2);
            }
          }
        }
      }
    }

    // 7d. Abyssal Vortex suction current — TRUE ray-blocked shelter behind any of the 3 cover pillars!
    if (boss.aiState === 'vortex' && boss.vortexStrength > 0 && diveState?.alive) {
      const dx = boss.x - diver.x;
      const dy = boss.y - diver.y;
      const dist = Math.hypot(dx, dy);
      if (dist > boss.radius + 0.8 && dist < 34) {
        const shelter = isShelteredByPillar(diver.x, diver.y, boss.x, boss.y, pillars, 0.75);
        if (shelter) {
          lair.vortexShelteredPillarId = shelter.id;
        } else {
          const pull = (boss.vortexStrength / Math.max(4.5, dist * 0.42)) * dt;
          diver.vx += (dx / dist) * pull * 4.4;
          diver.vy += (dy / dist) * pull * 4.4;
        }
      }
      if (dist <= boss.radius + 1.05) {
        applyDamageToLocalDiver(session, 22 * dt * lair.scaling.damageMult, boss.name, callbacks, { continuous: true });
      }
    }

    // 7e. Tentacle Snare hold (fair 9 DPS continuous — never frame-clamped!)
    if (boss.pinnedTargetId === 'local' && diveState?.alive) {
      const holdX = boss.x + Math.cos(boss.angle) * (boss.radius + 2.6);
      const holdY = boss.y + Math.sin(boss.angle) * (boss.radius + 2.6);
      diver.x += (holdX - diver.x) * Math.min(1, dt * 8);
      diver.y += (holdY - diver.y) * Math.min(1, dt * 8);
      diver.vx *= 0.15;
      diver.vy *= 0.15;
      applyDamageToLocalDiver(session, 9 * dt * lair.scaling.damageMult, `${boss.name}'s Tentacle`, callbacks, { continuous: true });
    }

    // 7f. Host-authoritative Boss Attack State Machine
    if (isAuthority && boss.aiState !== 'awakening') {
      // ONLY scale idle recovery by attackRateMult so every telegraph windup stays fair at 1–4 divers!
      const timerRate = boss.aiState === 'idle' ? lair.scaling.attackRateMult : 1.0;
      boss.stateTimer -= dt * timerRate;

      if (boss.aiState === 'stunned') {
        boss.stunTimerSec = Math.max(0, boss.stateTimer);
        if (boss.stateTimer <= 0) {
          boss.aiState = 'idle';
          boss.stateTimer = 0.85;
          boss.stateMaxTimer = 0.85;
        }
      } else if (boss.aiState === 'idle') {
        boss.vortexStrength = 0;
        boss.twinSlam = false;
        if (boss.stateTimer <= 0 && arenaTargets.length > 0) {
          boss.attackSeq += 1;
          if (boss.attackSeq % 2 === 0 && lair.spec.arena.bossAnchors?.length) {
            boss.anchorIdx = (boss.anchorIdx + 1) % lair.spec.arena.bossAnchors.length;
          }
          const patternLen = boss.phase === 3 ? 6 : boss.phase === 2 ? 5 : 3;
          const roll = boss.attackSeq % patternLen;

          if (roll === 0) {
            boss.aiState = 'slam_windup';
            boss.slamTargetAngle = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
            boss.twinSlam = boss.phase === 3;
            boss.stateTimer = boss.phase === 3 ? 1.05 : 1.18;
            boss.stateMaxTimer = boss.stateTimer;
          } else if (roll === 1) {
            boss.aiState = 'ink_barrage';
            boss.inkAimAngle = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
            boss.stateTimer = 0.85;
            boss.stateMaxTimer = 0.85;
            if (boss.kind !== 'cave-kraken' && (lair.bossHazards || []).length < 3) {
              spawnBossSignatureHazard(session, lair, boss, primaryTarget, callbacks);
            }
          } else if (roll === 2 && boss.phase >= 2) {
            // Signature Pillar-Occluded Sweeping Abyssal Beam!
            const toP = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
            boss.beamSweepDir = boss.attackSeq % 2 === 0 ? 1 : -1;
            boss.beamAngle = toP - boss.beamSweepDir * 0.85;
            boss.aiState = 'beam_windup';
            boss.stateTimer = 1.25;
            boss.stateMaxTimer = 1.25;
            callbacks.onBossBeam?.('windup');
          } else if (roll === 3 && boss.phase >= 2) {
            boss.aiState = 'vortex';
            boss.vortexStrength = 5.8 + boss.phase * 1.1;
            boss.stateTimer = 3.5;
            boss.stateMaxTimer = 3.5;
            callbacks.onBossRoar?.(2);
          } else if (roll === 4 || (roll === 2 && boss.phase === 1)) {
            // Dynamic Kraken Lunge aimed toward the player (enables Matador Pillar-Bait!)
            const toP = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
            const ar = lair.spec.arena;
            const rawX = boss.x + Math.cos(toP) * 20;
            const rawY = boss.y + Math.sin(toP) * 14;
            boss.lungeDestX = Math.max(ar.cx - ar.rx + 7, Math.min(ar.cx + ar.rx - 7, rawX));
            boss.lungeDestY = Math.max(ar.cy - ar.ry + 5, Math.min(ar.cy + ar.ry - 5, rawY));
            boss.aiState = 'lunge_windup';
            boss.stateTimer = 1.05;
            boss.stateMaxTimer = 1.05;
          } else {
            // Phase 3 Directional Telegraphed Tentacle Grab (dodgeable cone!)
            boss.aiState = 'grab_windup';
            boss.slamTargetAngle = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
            boss.stateTimer = 1.12;
            boss.stateMaxTimer = 1.12;
          }
        }
      } else if (boss.aiState === 'lunge_windup') {
        boss.angle = Math.atan2(boss.lungeDestY - boss.y, boss.lungeDestX - boss.x);
        if (boss.stateTimer <= 0) {
          boss.aiState = 'lunge_dash';
          boss.stateTimer = 1.05;
          boss.stateMaxTimer = 1.05;
          callbacks.onBossRoar?.(1);
        }
      } else if (boss.aiState === 'lunge_dash') {
        const arrived = Math.hypot(boss.lungeDestX - boss.x, boss.lungeDestY - boss.y) < 1.2;
        if (arrived || boss.stateTimer <= 0) {
          boss.aiState = 'idle';
          boss.stateTimer = boss.phase === 3 ? 0.85 : 1.15;
          boss.stateMaxTimer = boss.stateTimer;
        }
      } else if (boss.aiState === 'beam_windup') {
        if (boss.stateTimer <= 0) {
          boss.aiState = 'beam_sweep';
          boss.stateTimer = boss.phase === 3 ? 2.45 : 2.25;
          boss.stateMaxTimer = boss.stateTimer;
          if (session.cameraShake !== undefined) session.cameraShake = Math.max(session.cameraShake || 0, 0.35);
          callbacks.onBossBeam?.('fire');
        }
      } else if (boss.aiState === 'beam_sweep') {
        if (boss.stateTimer <= 0) {
          boss.aiState = 'idle';
          boss.stateTimer = boss.phase === 3 ? 0.95 : 1.25;
          boss.stateMaxTimer = boss.stateTimer;
        }
      } else if (boss.aiState === 'slam_windup') {
        if (boss.stateTimer <= 0) {
          boss.aiState = 'slam_strike';
          boss.stateTimer = 0.5;
          boss.stateMaxTimer = 0.5;
          if (session.cameraShake !== undefined) session.cameraShake = Math.max(session.cameraShake || 0, 0.45);
          callbacks.onBossSlam?.();
          // Phase 3 Tri-Fan leaves two crisp safe dodge lanes at ±0.41 rad (no dead-center stand-still cheese!)
          const slamAngles = boss.twinSlam
            ? [boss.slamTargetAngle, boss.slamTargetAngle - 0.82, boss.slamTargetAngle + 0.82]
            : [boss.slamTargetAngle];
          const halfArc = boss.twinSlam ? 0.28 : boss.slamArcHalf;
          if (diveState?.alive) {
            const dLocal = Math.hypot(diver.x - boss.x, diver.y - boss.y);
            const aLocal = Math.atan2(diver.y - boss.y, diver.x - boss.x);
            const hit = slamAngles.some((sa) => {
              const aDiff = Math.abs(Math.atan2(Math.sin(aLocal - sa), Math.cos(aLocal - sa)));
              return dLocal <= boss.slamRadius && aDiff <= halfArc;
            });
            if (hit) {
              applyDamageToLocalDiver(session, 20 * lair.scaling.damageMult, `${boss.name}'s Tentacle Slam`, callbacks);
              diver.vx += Math.cos(aLocal) * 7.2;
              diver.vy += Math.sin(aLocal) * 7.2;
            }
          }
        }
      } else if (boss.aiState === 'slam_strike') {
        if (boss.stateTimer <= 0) {
          boss.aiState = 'idle';
          boss.stateTimer = boss.phase === 3 ? 0.88 : 1.25;
          boss.stateMaxTimer = boss.stateTimer;
        }
      } else if (boss.aiState === 'ink_barrage') {
        if (boss.stateTimer <= 0) {
          const count = boss.phase === 1 ? 3 : boss.phase === 2 ? 5 : 7;
          const baseAng = Number.isFinite(boss.inkAimAngle)
            ? boss.inkAimAngle
            : Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
          const spread = boss.phase === 3 ? 0.23 : 0.27;
          const projKind = (boss.kind === 'iron-leviathan' || boss.kind === 'thermal-nautilus' || boss.kind === 'drill-wyrm' || boss.kind === 'spectral-dreadnought')
            ? 'slag'
            : (boss.kind === 'frost-wyrm' || boss.kind === 'phantom-uboat')
              ? 'frost'
              : (boss.kind === 'abyssal-empress' || boss.kind === 'solar-leviathan' || boss.kind === 'crystal-basilisk' || boss.kind === 'orichalcum-colossus' || boss.kind === 'coral-dragon')
                ? 'prism'
                : 'ink';
          const projCol = projKind === 'slag'
            ? (boss.kind === 'spectral-dreadnought' ? '#34d399' : (boss.kind === 'thermal-nautilus' || boss.kind === 'drill-wyrm' ? '#f97316' : '#fb923c'))
            : projKind === 'frost'
              ? (boss.kind === 'phantom-uboat' ? '#5eead4' : '#67e8f9')
              : projKind === 'prism'
                ? (boss.kind === 'coral-dragon' ? '#2dd4bf' : (boss.kind === 'solar-leviathan' || boss.kind === 'orichalcum-colossus' ? '#fde047' : boss.kind === 'crystal-basilisk' ? '#e879f9' : (boss.phase >= 3 ? '#fde047' : '#f472b6')))
                : (boss.phase === 3 ? '#fb7185' : '#c084fc');
          for (let k = 0; k < count; k++) {
            const a = baseAng + (k - (count - 1) * 0.5) * spread;
            lair.enemyProjectiles.push({
              x: boss.x + Math.cos(a) * (boss.radius * 0.8),
              y: boss.y + Math.sin(a) * (boss.radius * 0.8),
              vx: Math.cos(a) * (9.8 + boss.phase * 1.15),
              vy: Math.sin(a) * (9.8 + boss.phase * 1.15),
              radius: 0.62,
              damage: 16 * lair.scaling.damageMult,
              life: 3.4,
              color: projCol,
              kind: projKind,
            });
          }
          boss.aiState = 'idle';
          boss.stateTimer = boss.phase === 3 ? 0.95 : 1.35;
          boss.stateMaxTimer = boss.stateTimer;
        }
      } else if (boss.aiState === 'vortex') {
        if (boss.stateTimer <= 0) {
          boss.vortexStrength = 0;
          boss.aiState = 'idle';
          boss.stateTimer = 1.15;
          boss.stateMaxTimer = 1.15;
        }
      } else if (boss.aiState === 'grab_windup') {
        if (boss.stateTimer <= 0) {
          const dLocal = Math.hypot(diver.x - boss.x, diver.y - boss.y);
          const aLocal = Math.atan2(diver.y - boss.y, diver.x - boss.x);
          const aDiff = Math.abs(Math.atan2(Math.sin(aLocal - boss.slamTargetAngle), Math.cos(aLocal - boss.slamTargetAngle)));
          // Dodgeable directional grab cone (±0.44 rad, 15.5m range)
          if (diveState?.alive && dLocal <= 15.5 && aDiff <= 0.44) {
            boss.pinnedTargetId = 'local';
            boss.pinHitsNeeded = 3;
            boss.pinTimerSec = 3.6;
            boss.aiState = 'grab_hold';
            boss.stateTimer = 3.6;
            boss.stateMaxTimer = 3.6;
          } else {
            boss.aiState = 'idle';
            boss.stateTimer = 0.95;
            boss.stateMaxTimer = 0.95;
          }
        }
      } else if (boss.aiState === 'grab_hold') {
        boss.pinTimerSec = Math.max(0, boss.pinTimerSec - dt);
        if (boss.stateTimer <= 0 || boss.pinTimerSec <= 0 || !boss.pinnedTargetId) {
          boss.pinnedTargetId = null;
          boss.aiState = 'idle';
          boss.stateTimer = 1.15;
          boss.stateMaxTimer = 1.15;
        }
      }
    }
  }

  // 7g. Update Cute Anime Boss Body Language (velocity-coupled squash/stretch, ear flaps, jelly jiggle & limb swim cycle!)
  {
    const safeDt = Math.max(0.001, dt);
    const vx = (boss.x - anim.prevX) / safeDt;
    const vy = (boss.y - anim.prevY) / safeDt;
    const spd = Math.hypot(vx, vy);
    boss.vx = vx;
    boss.vy = vy;
    anim.speed = anim.speed + (spd - anim.speed) * Math.min(1, dt * 8);

    // Smooth right-side-up anime facing with hysteresis (never flips upside down!)
    const lookCos = Math.cos(boss.angle || Math.PI);
    if (lookCos > 0.22) anim.facing = 1;
    else if (lookCos < -0.22) anim.facing = -1;

    // Gentle anime tilt toward target / motion vector (±0.30 rad max)
    const rawPitch = Math.sin(boss.angle || 0) * 0.24 + Math.max(-0.22, Math.min(0.22, vy * 0.03));
    const targetPitch = boss.aiState === 'stunned'
      ? Math.sin(anim.dizzyAngle * 1.4) * 0.24
      : boss.aiState === 'lunge_dash'
        ? Math.atan2(vy, Math.abs(vx) + 1.5) * 0.48
        : rawPitch;
    anim.pitch += (targetPitch - anim.pitch) * Math.min(1, dt * 7.5);

    // State-driven anticipation / follow-through squash & stretch targets
    let tgtSX = 1.0 + Math.sin(anim.swimCycle * 0.9) * 0.045;
    let tgtSY = 1.0 - Math.sin(anim.swimCycle * 0.9) * 0.045;
    let tgtCheek = 0;
    let tgtMouth = 0;

    if (boss.defeated) {
      tgtSX = 1.08 + Math.sin(anim.swimCycle * 4) * 0.08;
      tgtSY = 0.88 - Math.sin(anim.swimCycle * 4) * 0.06;
      tgtMouth = 0.5;
    } else if (boss.aiState === 'dormant') {
      const snore = Math.sin((session.simTimeSec || 0) * 1.6);
      tgtSX = 1.06 + snore * 0.05;
      tgtSY = 0.94 - snore * 0.04;
    } else if (boss.aiState === 'awakening') {
      const aw = boss.awakeningTimer || 0;
      if (aw < 0.55) {
        tgtSX = 0.86; tgtSY = 1.18; // Cute startled hop!
      } else if (aw > 1.55) {
        tgtSX = 1.16; tgtSY = 1.12; tgtMouth = 1.0; // Puffed-up roar!
      }
    } else if (boss.aiState === 'lunge_windup') {
      // Cat-pounce coil-back squash!
      tgtSX = 0.78;
      tgtSY = 1.24;
    } else if (boss.aiState === 'lunge_dash') {
      // Plump torpedo stretch!
      tgtSX = 1.28;
      tgtSY = 0.78;
    } else if (boss.aiState === 'slam_windup') {
      tgtSX = 0.88;
      tgtSY = 1.15;
    } else if (boss.aiState === 'slam_strike') {
      tgtSX = 1.22;
      tgtSY = 0.84;
      tgtMouth = 0.7;
    } else if (boss.aiState === 'ink_barrage') {
      // Chubby puffed-up rosy cheeks before spitting ink!
      tgtSX = 1.18;
      tgtSY = 1.10;
      tgtCheek = 1.0;
      tgtMouth = 0.35;
    } else if (boss.aiState === 'vortex') {
      // Kirby inhale stretch!
      tgtSX = 1.14 + Math.sin(anim.swimCycle * 3.5) * 0.05;
      tgtSY = 0.96;
      tgtMouth = 1.0;
    } else if (boss.aiState === 'beam_windup') {
      tgtSX = 0.90 + Math.sin((session.simTimeSec || 0) * 28) * 0.03;
      tgtSY = 1.12;
      tgtMouth = 0.85;
    } else if (boss.aiState === 'beam_sweep') {
      tgtSX = 1.10;
      tgtSY = 0.94;
      tgtMouth = 1.0;
    } else if (boss.aiState === 'stunned') {
      tgtSX = 1.12 + Math.sin(anim.dizzyAngle * 2.2) * 0.05;
      tgtSY = 0.88 - Math.sin(anim.dizzyAngle * 2.2) * 0.05;
      tgtMouth = 0.25;
    } else {
      // Velocity-coupled swim squish
      const vStretch = Math.min(0.14, anim.speed * 0.015);
      tgtSX += vStretch;
      tgtSY -= vStretch * 0.8;
    }

    // Spring-damped mochi-jelly jiggle when hit or stunned!
    if (anim.jiggleAmp > 0.002) {
      anim.jigglePhase += dt * 24;
      anim.jiggleAmp = Math.max(0, anim.jiggleAmp - dt * 0.65);
    }
    const jig = Math.sin(anim.jigglePhase) * anim.jiggleAmp;
    anim.scaleX += (tgtSX + jig - anim.scaleX) * Math.min(1, dt * 11);
    anim.scaleY += (tgtSY - jig - anim.scaleY) * Math.min(1, dt * 11);
    anim.cheekPuff += (tgtCheek - anim.cheekPuff) * Math.min(1, dt * 10);
    anim.mouthOpen += (tgtMouth - anim.mouthOpen) * Math.min(1, dt * 12);
    if (anim.hurtSec > 0) anim.hurtSec = Math.max(0, anim.hurtSec - dt);

    // Limb paddle swim cycle & Dumbo ear flap speed respond smoothly to boss velocity & mood!
    const swimRate = boss.aiState === 'dormant'
      ? 1.1
      : boss.aiState === 'stunned'
        ? 1.8
        : boss.aiState === 'lunge_dash'
          ? 12.5
          : 3.0 + Math.min(5.5, anim.speed * 0.55) + (boss.phase === 3 ? 1.5 : 0);
    anim.swimCycle += dt * swimRate;
    anim.earFlap += dt * (boss.aiState === 'lunge_windup' ? 14 : boss.aiState === 'vortex' ? 11 : swimRate * 1.15);
    anim.dizzyAngle += dt * 4.8;
    // Delayed springy crown bob!
    const targetCrownBob = Math.max(-0.35, Math.min(0.35, -vy * 0.04)) + Math.sin(anim.swimCycle * 1.1 - 0.6) * 0.09;
    anim.crownBob += (targetCrownBob - anim.crownBob) * Math.min(1, dt * 8);
  }

  // 8. Step Enemy Projectiles (blocked by walls & Arena Limestone Cover Pillars!)
  for (let i = lair.enemyProjectiles.length - 1; i >= 0; i--) {
    const pr = lair.enemyProjectiles[i];
    if (!pr) continue;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;

    let blocked = pr.life <= 0 || evaluateCaveSDF(level, pr.x, pr.y) >= -0.05;
    if (!blocked) {
      for (const p of pillars) {
        if (Math.hypot(pr.x - p.x, pr.y - p.y) <= p.radius + pr.radius * 0.6) {
          blocked = true;
          addSparkBurst(lair, pr.x, pr.y, pr.color, 4);
          break;
        }
      }
    }
    if (blocked) {
      lair.enemyProjectiles.splice(i, 1);
      continue;
    }

    if (diveState?.alive && Math.hypot(pr.x - diver.x, pr.y - diver.y) <= pr.radius + 0.62) {
      applyDamageToLocalDiver(session, pr.damage, pr.kind === 'brine' ? 'Brine Spitter' : boss.name, callbacks);
      addSparkBurst(lair, pr.x, pr.y, pr.color, 6);
      if (lair.enemyProjectiles[i] === pr) lair.enemyProjectiles.splice(i, 1);
      if (lair.enemyProjectiles.length === 0) break;
    }
  }

  _stepSparks(lair, dt);
}

function _stepSparks(lair, dt) {
  for (let i = lair.hitSparks.length - 1; i >= 0; i--) {
    const sk = lair.hitSparks[i];
    sk.x += sk.vx * dt;
    sk.y += sk.vy * dt;
    sk.vx *= 0.94;
    sk.vy *= 0.94;
    sk.life -= dt;
    if (sk.life <= 0) lair.hitSparks.splice(i, 1);
  }
}

/**
 * Compact host-authoritative state snapshot for co-op boss synchronization (~6 Hz).
 * Now syncs beam angle, enemy projectiles, and pillar crystal charges so non-host clients see & dodge everything!
 */
export function serializeSecretLairNetState(lair) {
  if (!lair) return null;
  const b = lair.boss;
  return {
    vr: lair.veilRevealed ? 1 : 0,
    vb: lair.veilBreached ? 1 : 0,
    ae: lair.arenaEntered ? 1 : 0,
    sl: lair.sconceLitCount || 0,
    b: b
      ? {
          x: Math.round(b.x * 10) / 10,
          y: Math.round(b.y * 10) / 10,
          hp: b.hp,
          mhp: b.maxHp,
          ph: b.phase,
          ac: b.active ? 1 : 0,
          df: b.defeated ? 1 : 0,
          st: b.aiState,
          wa: Math.round(b.weakAngle * 100) / 100,
          sa: Math.round(b.slamTargetAngle * 100) / 100,
          ba: Math.round((b.beamAngle || 0) * 100) / 100,
          bd: b.beamSweepDir || 1,
          vx: Math.round(b.vortexStrength * 10) / 10,
          ts: b.twinSlam ? 1 : 0,
        }
      : null,
    pc: (lair.pillarCrystals || []).map((c) => [c.charge, Math.round(c.cooldownSec * 10) / 10]),
    pr: (lair.enemyProjectiles || []).slice(0, 14).map((p) => [
      Math.round(p.x * 10) / 10,
      Math.round(p.y * 10) / 10,
      Math.round(p.vx * 10) / 10,
      Math.round(p.vy * 10) / 10,
      p.kind === 'brine' ? 1 : 0,
    ]),
    m: lair.minions
      .filter((mm) => mm.alive)
      .map((mm) => [mm.id, Math.round(mm.x * 10) / 10, Math.round(mm.y * 10) / 10, mm.hp]),
    bc: (lair.batteryCells || []).slice(0, 4).map((c) => [c.id, Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10, c.inArena ? 1 : 0]),
    wu: (lair.weaponUpgrades || []).slice(0, 3).map((u) => [u.id, u.kind, Math.round(u.x * 10) / 10, Math.round(u.y * 10) / 10, u.inArena ? 1 : 0]),
    st: (lair.stalactites || []).map((s) => [s.state === 'falling' ? 1 : s.state === 'broken' ? 2 : 0, Math.round(s.y * 10) / 10, s.hp]),
    hz: (lair.bossHazards || []).slice(0, 6).map((h) => [
      h.kind === 'naval-mine' ? 1
        : h.kind === 'frost-ring' ? 2
        : h.kind === 'star-orb' ? 3
        : h.kind === 'vent-geyser' ? 4
        : h.kind === 'sun-lance' ? 5
        : h.kind === 'crystal-prism' ? 6
        : h.kind === 'homing-torpedo' ? 7
        : h.kind === 'sun-obelisk' ? 8
        : 9,
      Math.round(h.x * 10) / 10,
      Math.round(h.y * 10) / 10,
      Math.round((h.radius || 1.2) * 10) / 10,
      h.hp || 0,
      Math.round(((h.angle || 0) * 100)) / 100,
      (h.erupting || h.firing || h.reversed || h.dropping) ? 1 : 0,
    ]),
  };
}

export function applySecretLairNetState(lairOrSession, snap) {
  const lair = lairOrSession?.secretLair || lairOrSession;
  if (!lair || !snap || !Array.isArray(lair.minions)) return;
  if (snap.vr) lair.veilRevealed = true;
  if (snap.vb) lair.veilBreached = true;
  if (snap.ae) lair.arenaEntered = true;
  if (Number.isFinite(snap.sl)) {
    lair.sconceLitCount = snap.sl;
    const total = (lair.spec.arena.lightSconces || []).length || 6;
    lair.sconceLitFrac = Math.min(1, 0.1 + (snap.sl / total) * 0.9);
  }
  if (snap.b && lair.boss) {
    const b = lair.boss;
    b.x += (snap.b.x - b.x) * 0.45;
    b.y += (snap.b.y - b.y) * 0.45;
    b.maxHp = Math.max(1, snap.b.mhp || b.maxHp);
    b.hp = Math.max(0, Math.min(b.maxHp, snap.b.hp));
    b.phase = snap.b.ph || b.phase;
    b.active = Boolean(snap.b.ac);
    if (snap.b.df && !b.defeated) {
      b.defeated = true;
      lair.bossDefeated = true;
      lair.weaponEquipped = false;
      lair.spears.length = 0;
    }
    b.aiState = snap.b.st || b.aiState;
    b.weakAngle = Number.isFinite(snap.b.wa) ? snap.b.wa : b.weakAngle;
    b.slamTargetAngle = Number.isFinite(snap.b.sa) ? snap.b.sa : b.slamTargetAngle;
    if (Number.isFinite(snap.b.ba)) b.beamAngle = snap.b.ba;
    if (Number.isFinite(snap.b.bd)) b.beamSweepDir = snap.b.bd;
    b.vortexStrength = Number.isFinite(snap.b.vx) ? snap.b.vx : 0;
    b.twinSlam = Boolean(snap.b.ts);
  }
  if (Array.isArray(snap.pc) && Array.isArray(lair.pillarCrystals)) {
    for (let i = 0; i < Math.min(snap.pc.length, lair.pillarCrystals.length); i++) {
      lair.pillarCrystals[i].charge = snap.pc[i][0] || 0;
      lair.pillarCrystals[i].cooldownSec = snap.pc[i][1] || 0;
    }
  }
  if (Array.isArray(snap.pr)) {
    lair.enemyProjectiles = snap.pr.map(([x, y, vx, vy, isBrine]) => ({
      x,
      y,
      vx,
      vy,
      radius: isBrine ? 0.46 : 0.62,
      damage: (isBrine ? 14 : 16) * (lair.scaling?.damageMult || 1),
      life: 2.0,
      color: isBrine ? '#a3e635' : lair.boss?.phase === 3 ? '#fb7185' : '#c084fc',
      kind: isBrine ? 'brine' : 'ink',
    }));
  }
  if (Array.isArray(snap.m)) {
    const liveIds = new Set();
    for (const [id, x, y, hp] of snap.m) {
      liveIds.add(id);
      const found = lair.minions.find((mm) => mm.id === id);
      if (found) {
        found.x += (x - found.x) * 0.45;
        found.y += (y - found.y) * 0.45;
        found.hp = hp;
        found.alive = hp > 0;
      }
    }
    for (const mm of lair.minions) {
      if (!liveIds.has(mm.id)) {
        mm.alive = false;
        mm.hp = 0;
      }
    }
  }
  if (Array.isArray(snap.bc)) {
    lair.batteryCells = snap.bc.map(([id, x, y, inArena]) => ({
      id,
      x,
      y,
      vx: 0,
      vy: 0,
      chargePct: BOSS_BATTERY_RECHARGE_PCT,
      life: 25,
      phase: 0,
      inArena: Boolean(inArena),
    }));
  }
  if (Array.isArray(snap.wu)) {
    lair.weaponUpgrades = snap.wu.map(([id, kind, x, y, inArena]) => ({
      id,
      kind: BOSS_WEAPON_UPGRADES[kind] ? kind : 'twin',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 25,
      phase: 0,
      inArena: Boolean(inArena),
    }));
  }
  if (Array.isArray(snap.st) && Array.isArray(lair.stalactites)) {
    for (let i = 0; i < Math.min(snap.st.length, lair.stalactites.length); i++) {
      const [code, sy, hp] = snap.st[i];
      lair.stalactites[i].state = code === 1 ? 'falling' : code === 2 ? 'broken' : 'hanging';
      lair.stalactites[i].y = Number.isFinite(sy) ? sy : lair.stalactites[i].homeY;
      lair.stalactites[i].hp = Number.isFinite(hp) ? hp : lair.stalactites[i].maxHp;
    }
  }
  if (Array.isArray(snap.hz)) {
    lair.bossHazards = snap.hz.map(([code, hx, hy, hr, hp, ang, activeFlag], idx) => ({
      id: `net-hz-${idx}`,
      kind: code === 1 ? 'naval-mine'
        : code === 2 ? 'frost-ring'
        : code === 3 ? 'star-orb'
        : code === 4 ? 'vent-geyser'
        : code === 5 ? 'sun-lance'
        : code === 6 ? 'crystal-prism'
        : code === 7 ? 'homing-torpedo'
        : code === 8 ? 'sun-obelisk'
        : 'ore-gate',
      x: hx,
      y: hy,
      radius: hr,
      maxRadius: 17.5,
      hp,
      angle: ang || 0,
      erupting: code === 4 && Boolean(activeFlag),
      firing: code === 5 && Boolean(activeFlag),
      reversed: code === 7 && Boolean(activeFlag),
      dropping: code === 9 && Boolean(activeFlag),
      halfWidth: 1.65,
      height: 18.0,
      length: 25.0,
      fuseSec: 6,
      age: 0.5,
      phase: idx * 1.4,
    }));
  }
}

function _detonateNavalMine(session, lair, idx, { triggeredByPlayer = false } = {}, callbacks = {}) {
  const mine = lair.bossHazards?.[idx];
  if (!mine) return;
  lair.bossHazards.splice(idx, 1);
  const blastR = 7.6;
  addShockwave(lair, mine.x, mine.y, blastR, '#fb923c', 0.58);
  addSparkBurst(lair, mine.x, mine.y, '#fde047', 16, triggeredByPlayer ? '💥 MINE BLAST!' : '💥 DETONATION!', triggeredByPlayer);
  if (session.cameraShake !== undefined) {
    session.cameraShake = Math.max(session.cameraShake || 0, 0.52);
  }
  if (triggeredByPlayer && session.hitstopSec !== undefined) {
    session.hitstopSec = Math.max(session.hitstopSec || 0, 0.04);
  }
  callbacks.onMineBlast?.(mine);

  // Clear enemy projectiles inside blast zone
  for (let i = (lair.enemyProjectiles || []).length - 1; i >= 0; i--) {
    const pr = lair.enemyProjectiles[i];
    if (Math.hypot(pr.x - mine.x, pr.y - mine.y) <= blastR) {
      lair.enemyProjectiles.splice(i, 1);
    }
  }

  // Damage boss heavily if caught in the mine blast!
  const boss = lair.boss;
  if (boss && boss.active && !boss.defeated && Math.hypot(boss.x - mine.x, boss.y - mine.y) <= blastR + boss.radius) {
    lair.mineBlasts = (lair.mineBlasts || 0) + 1;
    applyBossDamage(session, 185, { crit: true, hitX: mine.x, hitY: mine.y }, callbacks);
    addSparkBurst(lair, boss.x, boss.y - 2.2, '#fde047', 10, '💥 CHAIN BLAST -185!', true);
  }

  // Damage diver if too close & not triggered safely from afar
  const diver = session.diver;
  if (!triggeredByPlayer && diver && session.diveState?.alive && Math.hypot(diver.x - mine.x, diver.y - mine.y) <= 4.4) {
    applyDamageToLocalDiver(session, 18 * (lair.scaling?.damageMult || 1), 'Naval Depth-Charge Mine', callbacks);
  }

  // Chain-detonate any adjacent naval mine!
  for (let j = (lair.bossHazards || []).length - 1; j >= 0; j--) {
    const other = lair.bossHazards[j];
    if (other?.kind === 'naval-mine' && Math.hypot(other.x - mine.x, other.y - mine.y) <= blastR) {
      _detonateNavalMine(session, lair, j, { triggeredByPlayer }, callbacks);
      break;
    }
  }
}

/**
 * Spawn biome-unique signature Boss Hazards for Iron Leviathan, Borealis Wyrm, and Abyssal Empress (v192).
 */
export function spawnBossSignatureHazard(session, lair, boss, primaryTarget = null, callbacks = {}) {
  if (!lair || !boss || boss.defeated) return null;
  if (!Array.isArray(lair.bossHazards)) lair.bossHazards = [];
  const ar = lair.spec.arena;

  if (boss.kind === 'iron-leviathan') {
    const count = boss.phase >= 2 ? 2 : 1;
    const spawned = [];
    for (let k = 0; k < count; k++) {
      if (lair.bossHazards.filter((h) => h.kind === 'naval-mine').length >= 3) break;
      const ang = (Math.PI * 0.65) + k * 1.15 + (Math.random() - 0.5) * 0.5;
      const mx = Math.max(ar.cx - ar.rx + 6, Math.min(ar.cx + ar.rx - 6, boss.x + Math.cos(ang) * 7.2));
      const my = Math.max(ar.cy - ar.ry + 4, Math.min(ar.cy + ar.ry - 4, boss.y + Math.sin(ang) * 5.2));
      const mine = {
        id: `mine_${++lair._hazardSeq}`,
        kind: 'naval-mine',
        x: mx,
        y: my,
        radius: 1.35,
        hp: 2,
        fuseSec: 8.5,
        age: 0,
        phase: Math.random() * Math.PI * 2,
        hitFlash: 0,
      };
      lair.bossHazards.push(mine);
      addShockwave(lair, mx, my, 3.2, '#fb923c', 0.35);
      spawned.push(mine);
    }
    return spawned[0] || null;
  }

  if (boss.kind === 'frost-wyrm') {
    const ring = {
      id: `frost_${++lair._hazardSeq}`,
      kind: 'frost-ring',
      x: boss.x,
      y: boss.y,
      radius: 2.6,
      maxRadius: 17.5,
      expandSpeed: boss.phase >= 3 ? 8.2 : 6.8,
      age: 0,
      hitLocal: false,
      shatteredByLocal: false,
    };
    lair.bossHazards.push(ring);
    callbacks.onCrystalChime?.(2);
    return ring;
  }

  if (boss.kind === 'abyssal-empress') {
    const existingOrbs = lair.bossHazards.filter((h) => h.kind === 'star-orb').length;
    const toSpawn = Math.min(boss.phase >= 3 ? 2 : 1, 3 - existingOrbs);
    let lastOrb = null;
    for (let k = 0; k < toSpawn; k++) {
      const startAng = Math.random() * Math.PI * 2 + k * Math.PI;
      const orb = {
        id: `orb_turret_${++lair._hazardSeq}`,
        kind: 'star-orb',
        x: ar.cx + Math.cos(startAng) * 12.0,
        y: ar.cy + Math.sin(startAng) * 6.4,
        radius: 1.05,
        hp: 2,
        orbitAngle: startAng,
        orbitSpeed: (k % 2 === 0 ? 1 : -1) * (boss.phase >= 3 ? 0.92 : 0.68),
        orbitRx: 12.0,
        orbitRy: 6.4,
        fireCd: 1.35 + k * 0.45,
        life: 12.5,
        age: 0,
        hitFlash: 0,
      };
      lair.bossHazards.push(orb);
      addShockwave(lair, orb.x, orb.y, 3.6, '#fde047', 0.38);
      lastOrb = orb;
    }
    return lastOrb;
  }

  if (boss.kind === 'thermal-nautilus') {
    const existingVents = lair.bossHazards.filter((h) => h.kind === 'vent-geyser').length;
    const toSpawn = Math.min(boss.phase >= 2 ? 2 : 1, 3 - existingVents);
    let lastVent = null;
    for (let k = 0; k < toSpawn; k++) {
      const targetX = k === 0 && session?.diver
        ? Math.max(ar.cx - ar.rx + 9, Math.min(ar.cx + ar.rx - 9, session.diver.x + (Math.random() - 0.5) * 4))
        : ar.cx + (Math.random() - 0.5) * (ar.rx * 0.9);
      const vent = {
        id: `vent_${++lair._hazardSeq}`,
        kind: 'vent-geyser',
        x: targetX,
        y: ar.cy + ar.ry - 3.8,
        radius: 1.35,
        halfWidth: 1.65,
        height: ar.ry * 1.48,
        hp: 2,
        warnSec: boss.phase >= 3 ? 1.15 : 1.45,
        life: 4.3,
        erupting: false,
        hitCd: 0,
        age: 0,
        hitFlash: 0,
      };
      lair.bossHazards.push(vent);
      addShockwave(lair, vent.x, vent.y, 3.4, '#fb923c', 0.36);
      lastVent = vent;
    }
    return lastVent;
  }

  if (boss.kind === 'solar-leviathan') {
    const existingLances = lair.bossHazards.filter((h) => h.kind === 'sun-lance').length;
    const toSpawn = Math.min(boss.phase >= 2 ? 2 : 1, 3 - existingLances);
    let lastLance = null;
    for (let k = 0; k < toSpawn; k++) {
      const px = ar.cx + (k === 0 ? -10 : 10) + (Math.random() - 0.5) * 6;
      const py = ar.cy - ar.ry + 4.4 + (Math.random() * 2.5);
      const aimX = session?.diver?.x ?? ar.cx;
      const aimY = session?.diver?.y ?? ar.cy;
      const angle = Math.atan2(aimY - py, aimX - px);
      const lance = {
        id: `lance_${++lair._hazardSeq}`,
        kind: 'sun-lance',
        x: px,
        y: py,
        radius: 1.25,
        hp: 2,
        angle,
        length: 25.0,
        warnSec: boss.phase >= 3 ? 1.1 : 1.35,
        life: 2.3,
        firing: false,
        hitLocal: false,
        age: 0,
        hitFlash: 0,
      };
      lair.bossHazards.push(lance);
      addShockwave(lair, px, py, 3.4, '#fde047', 0.36);
      lastLance = lance;
    }
    callbacks.onCrystalChime?.(2);
    return lastLance;
  }

  if (boss.kind === 'crystal-basilisk') {
    const existingPrisms = lair.bossHazards.filter((h) => h.kind === 'crystal-prism').length;
    const toSpawn = Math.min(boss.phase >= 2 ? 2 : 1, 3 - existingPrisms);
    let lastPrism = null;
    for (let k = 0; k < toSpawn; k++) {
      const px = ar.cx + (k === 0 ? -9.5 : 9.5) + (Math.random() - 0.5) * 5;
      const py = ar.cy + (Math.random() - 0.5) * 9.0;
      const prism = {
        id: `prism_${++lair._hazardSeq}`,
        kind: 'crystal-prism',
        x: px,
        y: py,
        radius: 1.25,
        hp: 2,
        fireCd: 1.4 + k * 0.5,
        life: 11.5,
        age: 0,
        phase: Math.random() * Math.PI * 2,
        hitFlash: 0,
      };
      lair.bossHazards.push(prism);
      addShockwave(lair, px, py, 3.4, '#e879f9', 0.36);
      lastPrism = prism;
    }
    callbacks.onCrystalChime?.(2);
    return lastPrism;
  }

  if (boss.kind === 'phantom-uboat') {
    const existingTorps = lair.bossHazards.filter((h) => h.kind === 'homing-torpedo').length;
    const toSpawn = Math.min(boss.phase >= 3 ? 2 : 1, 2 - existingTorps);
    let lastTorp = null;
    for (let k = 0; k < toSpawn; k++) {
      const aimX = session?.diver?.x ?? (ar.cx - 10);
      const aimY = session?.diver?.y ?? ar.cy;
      const spawnX = boss.x + (boss.facing || -1) * (boss.radius * 0.85);
      const spawnY = boss.y + (k === 0 ? -1.4 : 1.4);
      const ang = Math.atan2(aimY - spawnY, aimX - spawnX);
      const torp = {
        id: `torp_${++lair._hazardSeq}`,
        kind: 'homing-torpedo',
        x: spawnX,
        y: spawnY,
        radius: 1.12,
        hp: 2,
        angle: ang,
        speed: boss.phase >= 3 ? 8.0 : 7.0,
        reversed: false,
        life: 9.0,
        age: 0,
        hitFlash: 0,
      };
      lair.bossHazards.push(torp);
      addShockwave(lair, spawnX, spawnY, 3.0, '#5eead4', 0.34);
      lastTorp = torp;
    }
    callbacks.onCrystalChime?.(1);
    return lastTorp;
  }

  if (boss.kind === 'orichalcum-colossus') {
    const existingObelisks = lair.bossHazards.filter((h) => h.kind === 'sun-obelisk').length;
    const toSpawn = Math.min(boss.phase >= 2 ? 2 : 1, 3 - existingObelisks);
    let lastObelisk = null;
    for (let k = 0; k < toSpawn; k++) {
      const ox = ar.cx + (k === 0 ? -10.5 : 10.5) + (Math.random() - 0.5) * 4.5;
      const oy = ar.cy + (Math.random() - 0.5) * 8.0;
      const obelisk = {
        id: `obelisk_${++lair._hazardSeq}`,
        kind: 'sun-obelisk',
        x: ox,
        y: oy,
        radius: 1.35,
        hp: 2,
        angle: Math.random() * Math.PI * 2,
        fireCd: 1.5 + k * 0.5,
        life: 12.0,
        age: 0,
        hitFlash: 0,
      };
      lair.bossHazards.push(obelisk);
      addShockwave(lair, ox, oy, 3.6, '#fde047', 0.38);
      lastObelisk = obelisk;
    }
    callbacks.onCrystalChime?.(2);
    return lastObelisk;
  }

  if (boss.kind === 'drill-wyrm') {
    const existingGates = lair.bossHazards.filter((h) => h.kind === 'ore-gate').length;
    const toSpawn = Math.min(boss.phase >= 2 ? 2 : 1, 2 - existingGates);
    let lastGate = null;
    for (let k = 0; k < toSpawn; k++) {
      const gx = k === 0
        ? Math.max(ar.cx - ar.rx + 9, Math.min(ar.cx + ar.rx - 9, boss.x + (Math.random() - 0.5) * 3.5))
        : ar.cx + (Math.random() - 0.5) * 16.0;
      const gy = ar.cy - ar.ry + 4.2;
      const gate = {
        id: `oregate_${++lair._hazardSeq}`,
        kind: 'ore-gate',
        x: gx,
        y: gy,
        radius: 1.55,
        hp: 2,
        dropping: false,
        vy: 0,
        life: 14.0,
        age: 0,
        phase: Math.random() * Math.PI * 2,
        hitFlash: 0,
      };
      lair.bossHazards.push(gate);
      addShockwave(lair, gx, gy, 3.5, '#f97316', 0.36);
      lastGate = gate;
    }
    callbacks.onCrystalChime?.(1);
    return lastGate;
  }

  if (boss.kind === 'coral-dragon') {
    const existingOrbs = lair.bossHazards.filter((h) => h.kind === 'star-orb').length;
    const toSpawn = Math.min(boss.phase >= 2 ? 2 : 1, 3 - existingOrbs);
    let lastOrb = null;
    for (let k = 0; k < toSpawn; k++) {
      const ang = (Math.PI * 2 * k) / Math.max(1, toSpawn) + Math.random() * 0.6;
      const ox = Math.max(ar.cx - ar.rx + 6, Math.min(ar.cx + ar.rx - 6, boss.x + Math.cos(ang) * 9.5));
      const oy = Math.max(ar.cy - ar.ry + 4, Math.min(ar.cy + ar.ry - 4, boss.y + Math.sin(ang) * 6.5));
      const orb = {
        id: `dragonorb_${++lair._hazardSeq}`,
        kind: 'star-orb',
        x: ox,
        y: oy,
        radius: 1.35,
        hp: 2,
        life: 14.0,
        age: 0,
        phase: Math.random() * Math.PI * 2,
        hitFlash: 0,
      };
      lair.bossHazards.push(orb);
      addShockwave(lair, ox, oy, 3.8, '#2dd4bf', 0.36);
      lastOrb = orb;
    }
    callbacks.onCrystalChime?.(1);
    return lastOrb;
  }

  if (boss.kind === 'spectral-dreadnought') {
    const existingMines = lair.bossHazards.filter((h) => h.kind === 'naval-mine').length;
    const toSpawn = Math.min(boss.phase >= 2 ? 2 : 1, 3 - existingMines);
    let lastMine = null;
    for (let k = 0; k < toSpawn; k++) {
      const mx = Math.max(ar.cx - ar.rx + 7, Math.min(ar.cx + ar.rx - 7, boss.x - 6 + (Math.random() - 0.5) * 14));
      const my = Math.max(ar.cy - ar.ry + 5, Math.min(ar.cy + ar.ry - 5, boss.y + (Math.random() - 0.5) * 10));
      const mine = {
        id: `dreadmine_${++lair._hazardSeq}`,
        kind: 'naval-mine',
        x: mx,
        y: my,
        radius: 1.45,
        hp: 2,
        life: 16.0,
        age: 0,
        phase: Math.random() * Math.PI * 2,
        hitFlash: 0,
      };
      lair.bossHazards.push(mine);
      addShockwave(lair, mx, my, 3.6, '#34d399', 0.34);
      lastMine = mine;
    }
    callbacks.onCrystalChime?.(1);
    return lastMine;
  }
  return null;
}

/**
 * Gentle Touch Right-Stick Aim Magnetism (~8.5° soft lock cone onto nearest boss, minion, mine, orb, or stalactite) (v192).
 */
export function computeTouchAimMagnetAngle(session, rawAngle, maxConeRad = 0.15) {
  const lair = session?.secretLair;
  const diver = session?.diver;
  if (!lair?.combatMode || !diver || !Number.isFinite(rawAngle)) return rawAngle;
  const ox = diver.x;
  const oy = diver.y;
  const candidates = [];
  if (lair.boss?.active && !lair.boss.defeated) {
    const b = lair.boss;
    candidates.push({ x: b.x + Math.cos(b.weakAngle) * (b.radius * 1.05), y: b.y + Math.sin(b.weakAngle) * (b.radius * 1.05), prio: 1.0 });
    candidates.push({ x: b.x, y: b.y, prio: 0.9 });
  }
  for (const m of lair.minions || []) {
    if (m.alive) candidates.push({ x: m.x, y: m.y, prio: 0.85 });
  }
  for (const hz of lair.bossHazards || []) {
    if (hz.kind === 'naval-mine' || hz.kind === 'star-orb' || hz.kind === 'vent-geyser' || hz.kind === 'sun-lance' || hz.kind === 'crystal-prism' || hz.kind === 'homing-torpedo' || hz.kind === 'sun-obelisk' || (hz.kind === 'ore-gate' && !hz.dropping)) {
      candidates.push({ x: hz.x, y: hz.y, prio: 0.95 });
    }
  }
  for (const st of lair.stalactites || []) {
    if (st.state === 'hanging') candidates.push({ x: st.x, y: st.y + 1.1, prio: 0.8 });
  }
  let bestAng = rawAngle;
  let bestScore = Infinity;
  for (const c of candidates) {
    const d = Math.hypot(c.x - ox, c.y - oy);
    if (d < 1.2 || d > 28) continue;
    const ang = Math.atan2(c.y - oy, c.x - ox);
    const diff = Math.abs(Math.atan2(Math.sin(ang - rawAngle), Math.cos(ang - rawAngle)));
    if (diff <= maxConeRad) {
      const score = diff / (c.prio || 1);
      if (score < bestScore) {
        bestScore = score;
        bestAng = ang;
      }
    }
  }
  return bestAng;
}

export function applyRemoteBossEvent(session, msg, callbacks = {}) {
  const lair = session?.secretLair;
  if (!lair || !msg) return false;
  if (msg.kind === 'veil_breach') {
    breachSecretLairVeil(session, callbacks, { fromRemote: true });
    return true;
  }
  if (msg.kind === 'spear_shot') {
    // Visual-only bolt on remote clients & host (damage arrives cleanly via `boss_hit` — zero double-damage!)
    fireSpeargun(
      session,
      {
        aimAngle: msg.aimAngle,
        chargeFrac: msg.chargeFrac || 0,
        ownerId: msg.playerId || 'peer',
        isLocal: false,
        isRemoteVisual: true,
        originX: msg.x,
        originY: msg.y,
      },
      callbacks
    );
    return true;
  }
  if (msg.kind === 'boss_hit') {
    applyBossDamage(session, msg.damage || 20, { crit: Boolean(msg.crit), hitX: msg.x, hitY: msg.y, fromRemote: true }, callbacks);
    return true;
  }
  if (msg.kind === 'boss_sync' && msg.snap) {
    applySecretLairNetState(lair, msg.snap);
    return true;
  }
  if (msg.kind === 'scooter_dash' && Number.isFinite(msg.x) && Number.isFinite(msg.y)) {
    addShockwave(lair, msg.x, msg.y, 3.8, '#22d3ee', 0.34);
    if (!Array.isArray(lair.dashTrail)) lair.dashTrail = [];
    lair.dashTrail.push({ x: msg.x, y: msg.y, angle: Number(msg.angle) || 0, life: 0.3, maxLife: 0.3 });
    return true;
  }
  return false;
}
