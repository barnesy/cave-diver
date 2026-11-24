/**
 * Hidden Sonar-Only Secret Lairs, Twin-Stick Speargun Combat & Multi-Diver Boss Encounters (v180).
 *
 * Data-driven per-level registry (`SECRET_LAIRS`) so any of the 33 campaign sites can declare:
 *   - A subtle Sonar-only tight-squeeze offshoot at the bottom of the cave (zero direct callout!)
 *   - A quiet Armory Anteroom granting the Mounted-Torch Titanium Speargun BEFORE any enemies
 *   - Pure Combat Mode (`combatMode`): hides diving telemetry/controls & freezes gas/DCS/tox physiology
 *   - Twin-stick hold autofire (`0.30s`) + faster tap-to-fire (`0.14s`) + automatic 5th-shot Hyper-Tip pierce
 *   - A long atmospheric corridor gauntlet of escalating enemies dropping emerald Bio-Heal Orbs
 *   - A massive, dynamically lit underwater cathedral arena with cover pillars & a 3-phase Kraken boss
 *   - Dynamic difficulty tuning for 1–4 divers (human co-op + AI wingmen) & host-authoritative co-op sync
 *
 * Pure ES module with zero DOM dependencies.
 */

import { evaluateCaveSDF } from './collision.js';
import { spawnSiltPlume } from './silt.js';

export const SPEARGUN_AUTOFIRE_SEC = 0.30;
export const SPEARGUN_TAP_COOLDOWN_SEC = 0.14;
export const SPEARGUN_RELOAD_SEC = SPEARGUN_AUTOFIRE_SEC;
export const SPEARGUN_MAX_CHARGE_SEC = 1.05;
export const SPEARGUN_BASE_DAMAGE = 22;
export const SPEARGUN_HYPER_MULT = 1.55;
export const SPEARGUN_MAX_CHARGE_MULT = 2.45;
export const SPEARGUN_WEAKPOINT_MULT = 1.65;
export const COMBAT_MAX_HP = 100;

export const SECRET_LAIRS = Object.freeze({
  'cenote-el-abismo': Object.freeze({
    id: 'cenote-sunken-sanctum',
    levelId: 'cenote-el-abismo',
    name: 'The Sunken Sanctum',
    veil: Object.freeze({
      id: 'l1-sanctum-veil',
      x: 134.8,
      y: 49.6,
      radius: 2.05,
      label: 'Narrow Abyssal Seam',
      silent: true,
    }),
    armory: Object.freeze({
      id: 'l1-speargun-rack',
      x: 151.5,
      y: 48.8,
      radius: 2.9,
      weaponName: 'Pneumatic Titanium Speargun',
      hint: '',
    }),
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
        Object.freeze({ x: 271.0, y: 29.5, color: '#22d3ee', radius: 15.0 }),
        Object.freeze({ x: 289.0, y: 29.8, color: '#a78bfa', radius: 15.0 }),
        Object.freeze({ x: 300.5, y: 37.5, color: '#38bdf8', radius: 13.5 }),
        Object.freeze({ x: 266.0, y: 50.5, color: '#2dd4bf', radius: 14.5 }),
        Object.freeze({ x: 289.5, y: 50.2, color: '#c084fc', radius: 14.5 }),
      ]),
      bossAnchors: Object.freeze([
        Object.freeze({ x: 286.0, y: 40.5 }),
        Object.freeze({ x: 269.0, y: 37.0 }),
        Object.freeze({ x: 290.5, y: 36.5 }),
        Object.freeze({ x: 277.0, y: 44.5 }),
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
      Object.freeze({ id: 'm-moray-1', kind: 'moray', name: 'Abyssal Cave Moray', x: 165.5, y: 47.6, hp: 56, radius: 1.15 }),
      Object.freeze({ id: 'm-moray-2', kind: 'moray', name: 'Abyssal Cave Moray', x: 173.5, y: 47.2, hp: 56, radius: 1.15 }),
      // Chamber 2: Bioluminescent Brine Grotto
      Object.freeze({ id: 'm-swarmer-1', kind: 'swarmer', name: 'Brine Spitter Swarmer', x: 183.0, y: 45.2, hp: 46, radius: 0.98 }),
      Object.freeze({ id: 'm-swarmer-2', kind: 'swarmer', name: 'Brine Spitter Swarmer', x: 190.0, y: 44.0, hp: 46, radius: 0.98 }),
      Object.freeze({ id: 'm-swarmer-3', kind: 'swarmer', name: 'Brine Spitter Swarmer', x: 194.5, y: 43.4, hp: 46, radius: 0.98 }),
      // Chamber 3: Sunken Ossuary Bend
      Object.freeze({ id: 'm-moray-3', kind: 'moray', name: 'Abyssal Cave Moray', x: 204.5, y: 44.8, hp: 62, radius: 1.18 }),
      Object.freeze({ id: 'm-swarmer-4', kind: 'swarmer', name: 'Brine Spitter Swarmer', x: 210.0, y: 45.6, hp: 50, radius: 0.98 }),
      Object.freeze({ id: 'm-moray-4', kind: 'moray', name: 'Abyssal Cave Moray', x: 215.0, y: 46.5, hp: 62, radius: 1.18 }),
      // Chamber 4: The Guardian Gate
      Object.freeze({ id: 'm-stalker-1', kind: 'stalker', name: 'Armored Cenote Stalker', x: 225.5, y: 45.6, hp: 115, radius: 1.5 }),
      Object.freeze({ id: 'm-stalker-2', kind: 'stalker', name: 'Armored Cenote Stalker', x: 234.5, y: 44.0, hp: 120, radius: 1.5 }),
    ]),
    boss: Object.freeze({
      id: 'boss-xibalba-kraken',
      kind: 'cave-kraken',
      name: "XIBALBA'S MAW",
      title: 'Colossal Bioluminescent Cave Kraken',
      x: 285.0,
      y: 40.5,
      radius: 4.4,
      baseHp: 680,
      trophyRelicId: 'l1-kraken-crown',
      trophyName: 'Abyssal Kraken Crown',
      bonusPoints: 2500,
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
 * Tune boss HP, attack cadence, reinforcements & arena bailout stages to active diver count (1–4).
 * Human divers contribute 1.0 weight; AI wingmen contribute 0.55 weight so solo + AI feels heroic and fair.
 */
export function computeBossDifficultyScale(humanDivers = 1, aiWingmen = 0) {
  const humans = Math.max(1, Math.min(4, Math.round(Number(humanDivers) || 1)));
  const ai = Math.max(0, Math.min(3, Math.round(Number(aiWingmen) || 0)));
  const totalDivers = Math.max(1, Math.min(4, humans + ai));
  const effWeight = Math.max(1, Math.min(4, humans + ai * 0.55));
  const hpMult = Math.round((1 + (effWeight - 1) * 0.72) * 100) / 100;
  const attackRateMult = Math.round((1 + (effWeight - 1) * 0.14) * 100) / 100;
  const damageMult = Math.round((1 + (effWeight - 1) * 0.08) * 100) / 100;
  const phase2Adds = effWeight >= 3.1 ? 3 : effWeight >= 1.75 ? 2 : 1;
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
  const scaledHp = Math.round((spec.hp || 50) * (0.85 + (hpMult - 1) * 0.45));
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
    cooldown: 0.6,
    hitFlash: 0,
    wigglePhase: Math.random() * Math.PI * 2,
    lungeDirX: -1,
    lungeDirY: 0,
  };
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
    weaponEquipped: false,
    combatMode: false, // Pure combat HUD & frozen diving vitals once Speargun is picked up!
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
    spears: [], // { id, x, y, vx, vy, originX, originY, ownerId, damage, piercing, charged, life, maxLife, hitIds }
    enemyProjectiles: [], // { x, y, vx, vy, radius, damage, life, color, kind }
    healOrbs: [], // { id, x, y, vx, vy, heal, life, phase }
    hitSparks: [], // { x, y, vx, vy, life, maxLife, color, text, crit }
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
      hitFlash: 0,
      weakAngle: Math.PI * 0.8,
      aiState: 'idle', // 'idle'|'slam_windup'|'slam_strike'|'vortex'|'ink_barrage'|'lunge_windup'|'lunge_dash'|'grab_windup'|'grab_hold'|'stunned'
      stateTimer: 1.4,
      attackSeq: 0,
      slamTargetAngle: Math.PI,
      slamArcHalf: 0.48,
      slamRadius: 14.5,
      twinSlam: false,
      lungeDestX: spec.boss.x,
      lungeDestY: spec.boss.y,
      vortexStrength: 0,
      blackoutAlpha: 0,
      stunTimerSec: 0,
      pinnedTargetId: null,
      pinHitsNeeded: 0,
      pinTimerSec: 0,
      phase2Summoned: false,
      phase3Roared: false,
      tentacles,
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
 * Deliberately SILENT (zero text callout!) so observant divers discover the tight squeeze organically!
 */
export function revealSecretLairVeil(session, originX, originY, rangeM) {
  const lair = session?.secretLair;
  if (!lair || lair.veilBreached) return false;
  const veil = lair.spec.veil;
  const dist = Math.hypot(veil.x - originX, veil.y - originY);
  if (dist > rangeM + veil.radius) return false;
  lair.veilRevealed = true;
  lair.veilRevealPulse = 7.5;
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
  callbacks.onVeilShatter?.(veil, { fromRemote });
  return { ok: true, veilId: veil.id };
}

/**
 * Equip the Pneumatic Titanium Speargun (mounts flashlight on barrel) and enter Pure Combat Mode!
 */
export function claimSecretLairWeapon(session, callbacks = {}) {
  const lair = session?.secretLair;
  if (!lair || lair.weaponEquipped) return { ok: false };
  lair.weaponEquipped = true;
  lair.combatMode = true;
  lair.playerHp = COMBAT_MAX_HP;
  lair.playerMaxHp = COMBAT_MAX_HP;
  lair.playerIframesSec = 0.6;
  lair.combatHintTimer = 7.5;
  lair.reloadSec = 0;
  lair.tapCooldownSec = 0;
  lair.shotCounter = 0;
  // Ensure flashlight is ON since it is mounted on the speargun barrel!
  if (session.diver) session.diver.torchOn = true;
  addSparkBurst(lair, lair.spec.armory.x, lair.spec.armory.y, '#38bdf8', 14, '🔱 SPEARGUN EQUIPPED', true);
  callbacks.onWeaponEquip?.(lair.spec.armory);
  return { ok: true, weaponName: lair.spec.armory.weaponName };
}

function spawnHealOrb(lair, x, y, heal = 26) {
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
    life: 24,
    phase: Math.random() * Math.PI * 2,
  });
}

/**
 * Fire a tethered titanium speargun bolt straight along the flashlight barrel!
 * - Hold joystick / button: steady autofire (`SPEARGUN_AUTOFIRE_SEC = 0.30s`)
 * - Tap joystick / button: faster rapid-fire (`SPEARGUN_TAP_COOLDOWN_SEC = 0.14s`)
 * - Every 5th shot (or high chargeFrac) fires an electric Hyper-Tip Piercing Spear!
 */
export function fireSpeargun(
  session,
  { aimAngle = null, isTap = false, chargeFrac = 0, ownerId = 'local', isLocal = true, originX = null, originY = null } = {},
  callbacks = {}
) {
  const lair = session?.secretLair;
  if (!lair || !session?.diveState?.alive || session.surfaced) return { ok: false, reason: 'inactive' };
  if (isLocal) {
    if (!lair.weaponEquipped) return { ok: false, reason: 'no-weapon' };
    // Tapping uses the faster tap cooldown; holding uses the steady autofire cooldown
    const activeCd = isTap ? lair.tapCooldownSec : lair.reloadSec;
    if (activeCd > 0.015) return { ok: false, reason: 'reloading' };
    lair.reloadSec = SPEARGUN_AUTOFIRE_SEC;
    lair.tapCooldownSec = SPEARGUN_TAP_COOLDOWN_SEC;
    lair.recoilSec = 0.12;
    lair.muzzleFlashSec = 0.09;
    lair.charging = false;
    lair.chargeSec = 0;
    lair.shotCounter = (lair.shotCounter || 0) + 1;

    // If local diver is snared by Phase 3 Tentacle Grab, tapping fire also slashes free!
    if (lair.boss?.pinnedTargetId === 'local' && !lair.boss.defeated) {
      lair.boss.pinHitsNeeded = Math.max(0, (lair.boss.pinHitsNeeded || 1) - 1);
      addSparkBurst(lair, session.diver.x, session.diver.y, '#fde047', 6, 'SNAP!', false);
      if (lair.boss.pinHitsNeeded <= 0) {
        _breakBossGrabAndStun(lair, session.diver, callbacks);
      }
    }
  }

  const diver = session.diver;
  const sx = Number.isFinite(originX) ? originX : (diver.body?.hand ? diver.body.hand.x : diver.x);
  const sy = Number.isFinite(originY) ? originY : (diver.body?.hand ? diver.body.hand.y : diver.y);
  const ang = Number.isFinite(aimAngle) ? aimAngle : (diver.torchAngle ?? diver.angle ?? 0);
  const cFrac = Math.max(0, Math.min(1, Number(chargeFrac) || 0));
  const isHyper = (isLocal && lair.shotCounter % 5 === 0) || cFrac >= 0.72;
  const charged = isHyper || cFrac >= 0.45;
  const speed = isHyper ? 32 : 26 + cFrac * 8;
  const baseDmg = cFrac >= 0.45
    ? Math.round(SPEARGUN_BASE_DAMAGE * (1 + cFrac * (SPEARGUN_MAX_CHARGE_MULT - 1)))
    : Math.round(SPEARGUN_BASE_DAMAGE * (isHyper ? SPEARGUN_HYPER_MULT : 1.0));

  const bolt = {
    id: `sp_${++lair._spearSeq}`,
    x: sx + Math.cos(ang) * 0.95,
    y: sy + Math.sin(ang) * 0.95,
    vx: Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    angle: ang,
    originX: sx,
    originY: sy,
    ownerId,
    isLocal,
    damage: baseDmg,
    charged,
    piercing: isHyper,
    life: isHyper ? 1.3 : 1.05,
    maxLife: isHyper ? 1.3 : 1.05,
    hitIds: new Set(),
  };
  lair.spears.push(bolt);

  // Crisp subtle underwater pneumatic kick
  if (isLocal && diver) {
    const recoil = isHyper ? 0.48 : 0.24;
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

  callbacks.onSpeargunFire?.({ bolt, charged: isHyper, isLocal });
  return { ok: true, bolt, charged: isHyper, aimAngle: ang, chargeFrac: cFrac };
}

function _breakBossGrabAndStun(lair, diver, callbacks) {
  if (!lair?.boss) return;
  lair.boss.pinnedTargetId = null;
  lair.boss.aiState = 'stunned';
  lair.boss.stunTimerSec = 3.5;
  lair.boss.stateTimer = 3.5;
  addSparkBurst(lair, lair.boss.x, lair.boss.y, '#67e8f9', 16, '⚡ STUNNED! 2× CORE', true);
  if (diver) addSparkBurst(lair, diver.x, diver.y, '#4ade80', 8, 'FREE!', false);
  callbacks.onBossRoar?.(1);
}

function addSparkBurst(lair, x, y, color, count = 8, text = '', crit = false) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 1.6 + Math.random() * 3.8;
    lair.hitSparks.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - 0.5,
      life: 0.45 + Math.random() * 0.25,
      maxLife: 0.7,
      color,
      text: i === 0 ? text : '',
      crit: i === 0 && crit,
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
    const dmg = Math.max(continuous ? 1 : 6, amount * diffScale);
    lair.playerHp = Math.max(0, (lair.playerHp ?? COMBAT_MAX_HP) - dmg);
    if (!continuous) {
      lair.playerIframesSec = 0.85;
      lair.playerHitFlash = 0.35;
      if (session.cameraShake !== undefined) {
        session.cameraShake = Math.max(session.cameraShake || 0, 0.38);
      }
      callbacks.onAlarm?.('danger');
    }
    if (lair.playerHp <= 0) {
      // Fair zero-friction combat respawn at the Sanctum Gate (never destroys your whole Level 1 dive!)
      const rx = lair.arenaEntered ? (lair.spec.arena.respawnX ?? lair.spec.armory.x) : lair.spec.armory.x;
      const ry = lair.arenaEntered ? (lair.spec.arena.respawnY ?? lair.spec.armory.y) : lair.spec.armory.y;
      session.diver.x = rx;
      session.diver.y = ry;
      session.diver.vx = 0;
      session.diver.vy = 0;
      lair.playerHp = COMBAT_MAX_HP;
      lair.playerIframesSec = 2.0;
      lair.playerHitFlash = 0.45;
      lair.enemyProjectiles.length = 0;
      if (lair.boss && !lair.boss.defeated && lair.scaling.humans <= 1) {
        // Solo rematch resets boss cleanly so you can dive right back in!
        lair.boss.hp = lair.boss.maxHp;
        lair.boss.phase = 1;
        lair.boss.active = false;
        lair.boss.aiState = 'idle';
        lair.boss.stateTimer = 1.4;
        lair.boss.vortexStrength = 0;
        lair.boss.pinnedTargetId = null;
        lair.boss.phase2Summoned = false;
        lair.boss.x = lair.boss.homeX;
        lair.boss.y = lair.boss.homeY;
      }
      addSparkBurst(lair, rx, ry, '#38bdf8', 14, 'REFORMED · FULL HP', true);
    }
    return;
  }

  // Fallback outside combatMode
  const diffScale = session.difficulty === 'guided' ? 0.6 : session.difficulty === 'hardcore' ? 1.2 : 1.0;
  const dmg = Math.max(2, amount * diffScale);
  ds.health = Math.max(0, (ds.health ?? 100) - dmg);
  if (session.cameraShake !== undefined) {
    session.cameraShake = Math.max(session.cameraShake || 0, 0.35);
  }
  callbacks.onAlarm?.('danger');
  if (ds.health <= 0) {
    ds.alive = false;
    ds.causeOfFailure = `Overwhelmed by ${sourceLabel}`;
    ds.failureDetail = `Overwhelmed by ${sourceLabel} in ${lair.spec?.name || 'the Sunken Sanctum'}.`;
  }
}

/**
 * Apply damage directly to the boss (used both locally and when relaying peer hits).
 */
export function applyBossDamage(session, damage, { crit = false, hitX = null, hitY = null, fromRemote = false } = {}, callbacks = {}) {
  const lair = session?.secretLair;
  const boss = lair?.boss;
  if (!boss || boss.defeated) return { ok: false };
  boss.active = true;
  lair.arenaEntered = true;
  const stunMult = boss.aiState === 'stunned' ? 1.5 : 1.0;
  const finalDmg = Math.max(1, Math.round(damage * stunMult));
  boss.hp = Math.max(0, boss.hp - finalDmg);
  boss.hitFlash = 0.14;
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
  callbacks.onSpearHit?.({ target: 'boss', damage: finalDmg, crit, x: sx, y: sy });

  // Phase transitions
  const hpRatio = boss.maxHp > 0 ? boss.hp / boss.maxHp : 0;
  if (boss.phase === 1 && hpRatio <= 0.66 && boss.hp > 0) {
    boss.phase = 2;
    boss.aiState = 'vortex';
    boss.vortexStrength = 6.2;
    boss.stateTimer = 4.0;
    callbacks.onBossRoar?.(2);
    // Drop 2 glowing Bio-Heal orbs on phase shift so fights feel generous and rhythmic!
    spawnHealOrb(lair, boss.x - 9.0, boss.y - 4.0, 28);
    spawnHealOrb(lair, boss.x - 9.0, boss.y + 4.0, 28);
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
              hp: 40,
              radius: 0.98,
            },
            lair.scaling.hpMult
          )
        );
      }
    }
  } else if (boss.phase < 3 && hpRatio <= 0.33 && boss.hp > 0) {
    boss.phase = 3;
    boss.aiState = 'lunge_windup';
    boss.lungeDestX = lair.spec.arena.cx - 10;
    boss.lungeDestY = lair.spec.arena.cy;
    boss.stateTimer = 1.15;
    boss.blackoutAlpha = 0.45;
    spawnHealOrb(lair, lair.spec.arena.cx, lair.spec.arena.cy - 6.0, 32);
    spawnHealOrb(lair, lair.spec.arena.cx, lair.spec.arena.cy + 6.0, 32);
    callbacks.onBossRoar?.(3);
  }

  // Victory!
  if (boss.hp <= 0 && !boss.defeated) {
    boss.defeated = true;
    boss.active = false;
    boss.pinnedTargetId = null;
    boss.vortexStrength = 0;
    boss.blackoutAlpha = 0;
    boss.defeatAnimSec = 3.5;
    lair.bossDefeated = true;
    lair.trophyClaimed = true;
    lair.bonusScore = (lair.bonusScore || 0) + (lair.spec.boss.bonusPoints || 2500);
    for (const m of lair.minions) {
      if (m.alive && isPointInArena(lair.spec.arena, m.x, m.y, 10)) {
        m.alive = false;
        m.hp = 0;
      }
    }
    lair.enemyProjectiles.length = 0;
    addSparkBurst(lair, boss.x, boss.y, '#67e8f9', 30, `🏆 ${lair.spec.boss.trophyName}!`, true);
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
  const { diver, diveState } = session;

  // 1. Struggle free if pinned by Kraken tentacle
  if (lair.boss?.pinnedTargetId === 'local' && !lair.boss.defeated) {
    lair.boss.pinHitsNeeded = Math.max(0, (lair.boss.pinHitsNeeded || 1) - 1);
    addSparkBurst(lair, diver.x, diver.y, '#fde047', 6, 'SLASH!', false);
    if (lair.boss.pinHitsNeeded <= 0) {
      _breakBossGrabAndStun(lair, diver, callbacks);
    }
    return { handled: true, kind: 'lair-unpin' };
  }

  // 2. Breach sonar-revealed tight squeeze (also triggers automatically on swim-in)
  if (lair.veilRevealed && !lair.veilBreached) {
    const v = lair.spec.veil;
    if (Math.hypot(diver.x - v.x, diver.y - v.y) <= v.radius + 3.2) {
      const res = breachSecretLairVeil(session, callbacks);
      if (res.ok) return { handled: true, kind: 'lair-veil', targetId: v.id };
    }
  }

  // 3. Equip Speargun from Armory Rack (also auto-equips on swim-over)
  if (lair.veilBreached && !lair.weaponEquipped) {
    const a = lair.spec.armory;
    if (Math.hypot(diver.x - a.x, diver.y - a.y) <= a.radius + 2.8) {
      const res = claimSecretLairWeapon(session, callbacks);
      if (res.ok) return { handled: true, kind: 'lair-weapon', targetId: a.id };
    }
  }

  // 4. Post-Victory Bioluminescent Ascent Updraft -> exit Combat Mode & warp cleanly to 6m Deco Shelf!
  if (lair.bossDefeated && lair.spec.arena.exitUpdraft) {
    const up = lair.spec.arena.exitUpdraft;
    if (Math.hypot(diver.x - up.x, diver.y - up.y) <= up.radius + 3.0) {
      return _triggerVictoryUpdraft(session, up, callbacks);
    }
  }

  return { handled: false };
}

function _triggerVictoryUpdraft(session, up, callbacks) {
  const { diver, diveState, secretLair: lair } = session;
  lair.combatMode = false;
  diver.x = up.destX;
  diver.y = up.destY;
  diver.vx = 0;
  diver.vy = -0.5;
  diveState.depthM = up.destY;
  diveState.ceilingM = 0;
  diveState.decoStopSec = 0;
  if (session.checkpointsHit && Array.isArray(session.level?.checkpoints)) {
    for (let i = 0; i < session.level.checkpoints.length; i++) {
      session.checkpointsHit.add(session.level.checkpoints[i].id);
    }
  }
  callbacks.onUpdraftTeleport?.(up);
  callbacks.onToast?.('✨ Carried to the Exit Basin — ascend to the surface to claim your Boss Victory!', 4.2);
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

  if (lair.bossDefeated && lair.spec.arena.exitUpdraft) {
    const up = lair.spec.arena.exitUpdraft;
    if (Math.hypot(diver.x - up.x, diver.y - up.y) <= up.radius + 3.0) {
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
 * Step Secret Lair barriers, auto-equip armory, cover pillars, speargun bolts,
 * emerald Bio-Heal Orbs, corridor gauntlet enemies, AI wingmen & 3-phase Kraken boss!
 */
export function stepSecretLairEncounter(session, dt, { peers = [], isAuthority = true } = {}, callbacks = {}) {
  const lair = session?.secretLair;
  if (!lair || dt <= 0) return;
  const { level, diver, diveState, siltClouds } = session;

  if (lair.veilRevealPulse > 0) lair.veilRevealPulse = Math.max(0, lair.veilRevealPulse - dt);
  if (lair.reloadSec > 0) lair.reloadSec = Math.max(0, lair.reloadSec - dt);
  if (lair.tapCooldownSec > 0) lair.tapCooldownSec = Math.max(0, lair.tapCooldownSec - dt);
  if (lair.recoilSec > 0) lair.recoilSec = Math.max(0, lair.recoilSec - dt);
  if (lair.muzzleFlashSec > 0) lair.muzzleFlashSec = Math.max(0, lair.muzzleFlashSec - dt);
  if (lair.playerIframesSec > 0) lair.playerIframesSec = Math.max(0, lair.playerIframesSec - dt);
  if (lair.playerHitFlash > 0) lair.playerHitFlash = Math.max(0, lair.playerHitFlash - dt);
  if (lair.combatHintTimer > 0) lair.combatHintTimer = Math.max(0, lair.combatHintTimer - dt);
  if (lair.charging && lair.weaponEquipped && diveState?.alive) {
    lair.chargeSec = Math.min(SPEARGUN_MAX_CHARGE_SEC, lair.chargeSec + dt);
  }
  for (const st of lair.stages) {
    if (st.cooldownSec > 0) st.cooldownSec = Math.max(0, st.cooldownSec - dt);
  }

  // 1. Sealed False Limestone Tight-Squeeze Barrier
  if (!lair.veilBreached) {
    const v = lair.spec.veil;
    const dx = diver.x - v.x;
    const dy = diver.y - v.y;
    const dist = Math.hypot(dx, dy);
    // If Sonar already revealed the narrow seam, swimming right into it quietly fractures it open!
    if (lair.veilRevealed && dist <= v.radius + 1.05) {
      breachSecretLairVeil(session, callbacks);
    } else {
      const minD = v.radius + 0.55;
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

  // 1b. Frictionless Auto-Equip Speargun when swimming onto the Armory Rack in the quiet anteroom!
  if (!lair.weaponEquipped && lair.spec.armory && diveState?.alive) {
    const a = lair.spec.armory;
    if (Math.hypot(diver.x - a.x, diver.y - a.y) <= a.radius) {
      claimSecretLairWeapon(session, callbacks);
    }
  }

  // 1c. Auto-ride Victory Updraft if swimming directly into the bright vortex core
  if (lair.bossDefeated && lair.spec.arena.exitUpdraft && diveState?.alive) {
    const up = lair.spec.arena.exitUpdraft;
    if (Math.hypot(diver.x - up.x, diver.y - up.y) <= up.radius * 0.72) {
      _triggerVictoryUpdraft(session, up, callbacks);
      return;
    }
  }

  // 2. Arena Natural Limestone Cover Pillar collision
  const pillars = lair.spec.arena.pillars || [];
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    const dx = diver.x - p.x;
    const dy = diver.y - p.y;
    const dist = Math.hypot(dx, dy);
    const minD = p.radius + 0.55;
    if (dist < minD && dist > 0.001) {
      const push = minD - dist;
      diver.x += (dx / dist) * push;
      diver.y += (dy / dist) * push;
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
      lair.healOrbs.splice(i, 1);
      continue;
    }
    if (orb.life <= 0) lair.healOrbs.splice(i, 1);
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

  // Dynamic squad scaling update (1–4 divers)
  const liveHumans = Math.max(1, 1 + (peers || []).filter((p) => p && p.alive !== false).length);
  const liveAi = (session.aiSquad || []).filter((a) => a && a.alive !== false).length;
  rescaleSecretLairForSquad(lair, liveHumans, liveAi);

  // 3. Activate Boss Arena once any diver enters the vaulted cathedral bounds
  const boss = lair.boss;
  if (!boss.defeated && !boss.active) {
    const entered = targets.some((t) => isPointInArena(lair.spec.arena, t.x, t.y, 1.0));
    if (entered) {
      lair.arenaEntered = true;
      boss.active = true;
      boss.aiState = 'idle';
      boss.stateTimer = 1.25;
      callbacks.onBossRoar?.(1);
    }
  }

  // 4. AI Wingmen combat support inside the Secret Lair
  if (lair.weaponEquipped && Array.isArray(session.aiSquad)) {
    for (const ai of session.aiSquad) {
      if (!ai || ai.alive === false) continue;
      const cd = Math.max(0, (lair._aiFireCooldowns.get(ai.id) || 0) - dt);
      lair._aiFireCooldowns.set(ai.id, cd);
      if (cd > 0) continue;
      let targetObj = null;
      let bestD = 24;
      if (boss.active && !boss.defeated && boss.pinnedTargetId === 'local') {
        targetObj = boss;
      } else {
        for (const m of lair.minions) {
          if (!m.alive) continue;
          const d = Math.hypot(m.x - ai.x, m.y - ai.y);
          if (d < bestD) { bestD = d; targetObj = m; }
        }
        if (!targetObj && boss.active && !boss.defeated) {
          const db = Math.hypot(boss.x - ai.x, boss.y - ai.y);
          if (db < 28) targetObj = boss;
        }
      }
      if (targetObj) {
        const aimAng = Math.atan2(targetObj.y - ai.y, targetObj.x - ai.x);
        ai.torchAngle = aimAng;
        fireSpeargun(
          session,
          { aimAngle: aimAng, chargeFrac: 0.25, ownerId: ai.id, isLocal: false, originX: ai.x, originY: ai.y },
          callbacks
        );
        lair._aiFireCooldowns.set(ai.id, 1.15 + Math.random() * 0.45);
      }
    }
  }

  // 5. Step Speargun Bolts & Collisions
  for (let i = lair.spears.length - 1; i >= 0; i--) {
    const sp = lair.spears[i];
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.life -= dt;

    let hitWall = sp.life <= 0 || evaluateCaveSDF(level, sp.x, sp.y) >= -0.05;
    if (!hitWall) {
      for (const p of pillars) {
        if (Math.hypot(sp.x - p.x, sp.y - p.y) <= p.radius) {
          hitWall = true;
          break;
        }
      }
    }
    if (hitWall) {
      if (sp.life > 0) addSparkBurst(lair, sp.x, sp.y, '#94a3b8', 3);
      lair.spears.splice(i, 1);
      continue;
    }

    // Minion hits
    let consumed = false;
    for (const m of lair.minions) {
      if (!m.alive || sp.hitIds.has(m.id)) continue;
      if (Math.hypot(sp.x - m.x, sp.y - m.y) <= m.radius + 0.6) {
        sp.hitIds.add(m.id);
        let dmg = sp.damage;
        let crit = false;
        if (m.kind === 'stalker' && !sp.piercing) {
          const hitAng = Math.atan2(sp.y - m.y, sp.x - m.x);
          const diff = Math.abs(Math.atan2(Math.sin(hitAng - m.angle), Math.cos(hitAng - m.angle)));
          if (diff < 0.85) {
            dmg = Math.max(10, Math.round(dmg * 0.62));
          } else {
            dmg = Math.round(dmg * 1.5);
            crit = true;
          }
        } else if (sp.piercing) {
          crit = true;
        }
        m.hp = Math.max(0, m.hp - dmg);
        m.hitFlash = 0.14;
        m.aggro = true;
        addSparkBurst(lair, sp.x, sp.y, crit ? '#fde047' : '#38bdf8', crit ? 8 : 5, `${crit ? 'CRIT ' : ''}-${dmg}`, crit);
        callbacks.onSpearHit?.({ target: 'minion', minionId: m.id, damage: dmg, crit, x: sp.x, y: sp.y });
        if (m.hp <= 0) {
          m.alive = false;
          lair.minionsKilled += 1;
          lair.bonusScore += m.kind === 'stalker' ? 300 : 150;
          addSparkBurst(lair, m.x, m.y, '#34d399', 12, `+${m.kind === 'stalker' ? 300 : 150}`, true);
          spawnHealOrb(lair, m.x, m.y, m.kind === 'stalker' ? 34 : 22);
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

    // Boss hits (weak-point crits & breaking Phase 3 Tentacle Snare!)
    if (boss.active && !boss.defeated && !sp.hitIds.has(boss.id)) {
      const distBoss = Math.hypot(sp.x - boss.x, sp.y - boss.y);
      if (distBoss <= boss.radius + 0.75) {
        sp.hitIds.add(boss.id);
        const coreX = boss.x + Math.cos(boss.weakAngle) * (boss.radius * 0.56);
        const coreY = boss.y + Math.sin(boss.weakAngle) * (boss.radius * 0.56);
        const hitCore = Math.hypot(sp.x - coreX, sp.y - coreY) <= 2.85 || boss.aiState === 'stunned';
        const crit = hitCore || sp.piercing;
        const dmg = Math.round(sp.damage * (hitCore ? SPEARGUN_WEAKPOINT_MULT : 1.0) * (sp.isLocal ? 1.0 : 0.65));

        if (boss.pinnedTargetId) {
          boss.pinHitsNeeded = Math.max(0, (boss.pinHitsNeeded || 1) - 1);
          if (boss.pinHitsNeeded <= 0) {
            _breakBossGrabAndStun(lair, diver, callbacks);
          }
        }
        applyBossDamage(session, dmg, { crit, hitX: sp.x, hitY: sp.y }, callbacks);
        if (sp.isLocal) {
          callbacks.onLocalBossHit?.({ damage: dmg, crit, x: sp.x, y: sp.y });
        }
        lair.spears.splice(i, 1);
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
          const speed = m.kind === 'stalker' ? 2.6 : 3.4;
          if (bestDist > (m.kind === 'stalker' ? 5.0 : 6.4)) {
            m.vx = Math.cos(toAng) * speed;
            m.vy = Math.sin(toAng) * speed;
          } else if (m.cooldown <= 0) {
            m.state = 'telegraph';
            m.stateTimer = m.kind === 'stalker' ? 0.72 : 0.56;
            m.lungeDirX = Math.cos(toAng);
            m.lungeDirY = Math.sin(toAng);
            m.vx *= 0.2;
            m.vy *= 0.2;
          } else {
            m.vx *= 0.85;
            m.vy *= 0.85;
          }
        } else if (m.state === 'telegraph') {
          m.stateTimer -= dt;
          if (m.stateTimer <= 0) {
            m.state = 'lunge';
            m.stateTimer = 0.44;
            const lSpd = m.kind === 'stalker' ? 8.8 : 10.2;
            m.vx = m.lungeDirX * lSpd;
            m.vy = m.lungeDirY * lSpd;
          }
        } else if (m.state === 'lunge') {
          m.stateTimer -= dt;
          if (nearest.isLocal && Math.hypot(diver.x - m.x, diver.y - m.y) <= m.radius + 0.85) {
            applyDamageToLocalDiver(session, (m.kind === 'stalker' ? 20 : 14) * lair.scaling.damageMult, m.name, callbacks);
            diver.vx += m.lungeDirX * 4.5;
            diver.vy += m.lungeDirY * 4.5;
            m.state = 'idle';
            m.cooldown = 1.4;
          } else if (m.stateTimer <= 0) {
            m.state = 'idle';
            m.cooldown = 1.25;
          }
        }
      } else {
        // Brine Spitter Swarmer: strafes and fires dodgeable acid-brine globules
        m.angle = toAng;
        const desiredDist = 7.8;
        const radial = bestDist < desiredDist - 1.5 ? -2.4 : bestDist > desiredDist + 1.5 ? 2.8 : 0;
        const strafe = Math.sin(m.wigglePhase * 0.4) * 2.2;
        m.vx = Math.cos(toAng) * radial - Math.sin(toAng) * strafe;
        m.vy = Math.sin(toAng) * radial + Math.cos(toAng) * strafe;
        if (m.cooldown <= 0 && bestDist < 16.5) {
          m.cooldown = 1.95 / lair.scaling.attackRateMult;
          lair.enemyProjectiles.push({
            x: m.x + Math.cos(toAng) * 0.9,
            y: m.y + Math.sin(toAng) * 0.9,
            vx: Math.cos(toAng) * 9.5,
            vy: Math.sin(toAng) * 9.5,
            radius: 0.44,
            damage: 14 * lair.scaling.damageMult,
            life: 2.3,
            color: '#a3e635',
            kind: 'brine',
          });
        }
      }

      const nx = m.x + m.vx * dt;
      const ny = m.y + m.vy * dt;
      if (evaluateCaveSDF(level, nx, ny) < -(m.radius * 0.65)) {
        m.x = nx;
        m.y = ny;
      } else {
        m.vx *= -0.35;
        m.vy *= -0.35;
      }
    }
  }

  // 7. Step Dynamic 3-Phase Cave Kraken Boss (*XIBALBA'S MAW*)
  if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  if (boss.blackoutAlpha > 0) boss.blackoutAlpha = Math.max(0, boss.blackoutAlpha - dt * 0.4);
  if (boss.defeated) {
    if (boss.defeatAnimSec > 0) boss.defeatAnimSec = Math.max(0, boss.defeatAnimSec - dt);
  } else if (boss.active) {
    // Rotate glowing mantle weak-point slowly (pauses wide-open when stunned!)
    if (boss.aiState !== 'stunned') {
      boss.weakAngle += dt * (boss.phase === 3 ? 0.85 : boss.phase === 2 ? 0.6 : 0.42);
    }
    for (const t of boss.tentacles) {
      t.waveOffset += dt * (boss.aiState === 'stunned' ? 1.2 : boss.phase === 3 ? 5.2 : 3.4);
    }

    const arenaTargets = targets.filter((t) => isPointInArena(lair.spec.arena, t.x, t.y, 6));
    const primaryTarget =
      arenaTargets.length > 0
        ? arenaTargets[boss.attackSeq % arenaTargets.length]
        : targets[0] || { id: 'local', x: diver.x, y: diver.y };

    // Dynamic gliding across cathedral perches (fast surge during lunge_dash!)
    if (isAuthority) {
      if (boss.aiState === 'lunge_dash') {
        const dx = boss.lungeDestX - boss.x;
        const dy = boss.lungeDestY - boss.y;
        const d = Math.hypot(dx, dy);
        const spd = 22.0;
        if (d > 0.6) {
          boss.x += (dx / d) * Math.min(d, spd * dt);
          boss.y += (dy / d) * Math.min(d, spd * dt);
          boss.angle = Math.atan2(dy, dx);
        }
        // Contact damage if diver stands directly in lunge path
        if (diveState?.alive && Math.hypot(diver.x - boss.x, diver.y - boss.y) <= boss.radius + 0.9) {
          applyDamageToLocalDiver(session, 20 * lair.scaling.damageMult, `${boss.name}'s Lunge`, callbacks);
          const pushA = Math.atan2(diver.y - boss.y, diver.x - boss.x);
          diver.vx += Math.cos(pushA) * 7.5;
          diver.vy += Math.sin(pushA) * 7.5;
        }
      } else if (boss.aiState !== 'stunned') {
        const anchors = lair.spec.arena.bossAnchors || [{ x: boss.homeX, y: boss.homeY }];
        const anc = anchors[boss.anchorIdx % anchors.length];
        const hoverX = anc.x + Math.cos(session.simTimeSec * 0.52) * 3.8;
        const hoverY = anc.y + Math.sin(session.simTimeSec * 0.68) * 2.5;
        boss.x += (hoverX - boss.x) * Math.min(1, dt * 1.4);
        boss.y += (hoverY - boss.y) * Math.min(1, dt * 1.4);
        boss.angle = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
      }
    }

    // Abyssal Vortex suction current (sheltered behind any of the 3 pillars!)
    if (boss.aiState === 'vortex' && boss.vortexStrength > 0 && diveState?.alive) {
      const dx = boss.x - diver.x;
      const dy = boss.y - diver.y;
      const dist = Math.hypot(dx, dy);
      if (dist > boss.radius + 0.8 && dist < 32) {
        let sheltered = false;
        for (const p of pillars) {
          const toPillar = Math.hypot(diver.x - p.x, diver.y - p.y);
          const bossToPillar = Math.hypot(boss.x - p.x, boss.y - p.y);
          if (toPillar < p.radius + 3.2 && bossToPillar < dist) {
            sheltered = true;
            break;
          }
        }
        if (!sheltered) {
          const pull = (boss.vortexStrength / Math.max(4.5, dist * 0.42)) * dt;
          diver.vx += (dx / dist) * pull * 4.5;
          diver.vy += (dy / dist) * pull * 4.5;
        }
      }
      if (dist <= boss.radius + 1.1) {
        applyDamageToLocalDiver(session, 18 * dt * lair.scaling.damageMult, boss.name, callbacks, { continuous: true });
      }
    }

    // Tentacle Snare hold
    if (boss.pinnedTargetId === 'local' && diveState?.alive) {
      const holdX = boss.x + Math.cos(boss.angle) * (boss.radius + 2.6);
      const holdY = boss.y + Math.sin(boss.angle) * (boss.radius + 2.6);
      diver.x += (holdX - diver.x) * Math.min(1, dt * 8);
      diver.y += (holdY - diver.y) * Math.min(1, dt * 8);
      diver.vx *= 0.15;
      diver.vy *= 0.15;
      applyDamageToLocalDiver(session, 8 * dt * lair.scaling.damageMult, `${boss.name}'s Tentacle`, callbacks, { continuous: true });
    }

    // Host-authoritative Boss Attack State Machine
    if (isAuthority) {
      boss.stateTimer -= dt * (boss.aiState === 'stunned' ? 1.0 : lair.scaling.attackRateMult);
      if (boss.aiState === 'stunned') {
        boss.stunTimerSec = Math.max(0, boss.stateTimer);
        if (boss.stateTimer <= 0) {
          boss.aiState = 'idle';
          boss.stateTimer = 0.9;
        }
      } else if (boss.aiState === 'idle') {
        boss.vortexStrength = 0;
        boss.twinSlam = false;
        if (boss.stateTimer <= 0 && arenaTargets.length > 0) {
          boss.attackSeq += 1;
          // Shift cathedral perch every 2 attacks so the boss dynamically owns the 58m arena!
          if (boss.attackSeq % 2 === 0 && lair.spec.arena.bossAnchors?.length) {
            boss.anchorIdx = (boss.anchorIdx + 1) % lair.spec.arena.bossAnchors.length;
          }
          const patternLen = boss.phase === 3 ? 5 : boss.phase === 2 ? 4 : 3;
          const roll = boss.attackSeq % patternLen;
          if (roll === 0) {
            boss.aiState = 'slam_windup';
            boss.slamTargetAngle = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
            boss.twinSlam = boss.phase === 3;
            boss.stateTimer = boss.phase === 3 ? 0.95 : 1.18;
          } else if (roll === 1) {
            boss.aiState = 'ink_barrage';
            boss.stateTimer = 0.72;
          } else if (roll === 2 && boss.phase >= 2) {
            boss.aiState = 'vortex';
            boss.vortexStrength = 5.8 + boss.phase * 1.1;
            boss.stateTimer = 3.6;
            callbacks.onBossRoar?.(2);
          } else if (roll === 3 || (roll === 2 && boss.phase === 1)) {
            // Dynamic Kraken Lunge across the cathedral!
            const anchors = lair.spec.arena.bossAnchors || [{ x: boss.homeX, y: boss.homeY }];
            boss.anchorIdx = (boss.anchorIdx + 1) % anchors.length;
            const dest = anchors[boss.anchorIdx];
            boss.lungeDestX = dest.x;
            boss.lungeDestY = dest.y;
            boss.aiState = 'lunge_windup';
            boss.stateTimer = 0.95;
          } else {
            boss.aiState = 'grab_windup';
            boss.slamTargetAngle = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
            boss.stateTimer = 1.05;
          }
        }
      } else if (boss.aiState === 'lunge_windup') {
        boss.angle = Math.atan2(boss.lungeDestY - boss.y, boss.lungeDestX - boss.x);
        if (boss.stateTimer <= 0) {
          boss.aiState = 'lunge_dash';
          boss.stateTimer = 1.05;
          callbacks.onBossRoar?.(1);
        }
      } else if (boss.aiState === 'lunge_dash') {
        const arrived = Math.hypot(boss.lungeDestX - boss.x, boss.lungeDestY - boss.y) < 1.2;
        if (arrived || boss.stateTimer <= 0) {
          boss.aiState = 'idle';
          boss.stateTimer = boss.phase === 3 ? 0.85 : 1.25;
        }
      } else if (boss.aiState === 'slam_windup') {
        if (boss.stateTimer <= 0) {
          boss.aiState = 'slam_strike';
          boss.stateTimer = 0.5;
          const slamAngles = boss.twinSlam
            ? [boss.slamTargetAngle - 0.58, boss.slamTargetAngle + 0.58]
            : [boss.slamTargetAngle];
          if (diveState?.alive) {
            const dLocal = Math.hypot(diver.x - boss.x, diver.y - boss.y);
            const aLocal = Math.atan2(diver.y - boss.y, diver.x - boss.x);
            const hit = slamAngles.some((sa) => {
              const aDiff = Math.abs(Math.atan2(Math.sin(aLocal - sa), Math.cos(aLocal - sa)));
              return dLocal <= boss.slamRadius && aDiff <= (boss.twinSlam ? 0.36 : boss.slamArcHalf);
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
          boss.stateTimer = boss.phase === 3 ? 0.9 : 1.35;
        }
      } else if (boss.aiState === 'ink_barrage') {
        if (boss.stateTimer <= 0) {
          const count = boss.phase === 1 ? 3 : boss.phase === 2 ? 5 : 7;
          const baseAng = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
          const spread = boss.phase === 3 ? 0.24 : 0.28;
          for (let k = 0; k < count; k++) {
            const a = baseAng + (k - (count - 1) * 0.5) * spread;
            lair.enemyProjectiles.push({
              x: boss.x + Math.cos(a) * (boss.radius * 0.8),
              y: boss.y + Math.sin(a) * (boss.radius * 0.8),
              vx: Math.cos(a) * (9.5 + boss.phase * 1.1),
              vy: Math.sin(a) * (9.5 + boss.phase * 1.1),
              radius: 0.62,
              damage: 16 * lair.scaling.damageMult,
              life: 3.4,
              color: boss.phase === 3 ? '#fb7185' : '#c084fc',
              kind: 'ink',
            });
          }
          boss.aiState = 'idle';
          boss.stateTimer = boss.phase === 3 ? 1.0 : 1.45;
        }
      } else if (boss.aiState === 'vortex') {
        if (boss.stateTimer <= 0) {
          boss.vortexStrength = 0;
          boss.aiState = 'idle';
          boss.stateTimer = 1.25;
        }
      } else if (boss.aiState === 'grab_windup') {
        if (boss.stateTimer <= 0) {
          const dLocal = Math.hypot(diver.x - boss.x, diver.y - boss.y);
          if (diveState?.alive && dLocal <= 15.0) {
            boss.pinnedTargetId = 'local';
            boss.pinHitsNeeded = 3;
            boss.pinTimerSec = 3.6;
            boss.aiState = 'grab_hold';
            boss.stateTimer = 3.6;
          } else {
            boss.aiState = 'idle';
            boss.stateTimer = 1.0;
          }
        }
      } else if (boss.aiState === 'grab_hold') {
        boss.pinTimerSec = Math.max(0, boss.pinTimerSec - dt);
        if (boss.stateTimer <= 0 || boss.pinTimerSec <= 0 || !boss.pinnedTargetId) {
          boss.pinnedTargetId = null;
          boss.aiState = 'idle';
          boss.stateTimer = 1.3;
        }
      }
    }
  }

  // 8. Step Enemy Projectiles (blocked by walls & Arena Limestone Cover Pillars!)
  for (let i = lair.enemyProjectiles.length - 1; i >= 0; i--) {
    const pr = lair.enemyProjectiles[i];
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
      lair.enemyProjectiles.splice(i, 1);
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
 */
export function serializeSecretLairNetState(lair) {
  if (!lair) return null;
  const b = lair.boss;
  return {
    vr: lair.veilRevealed ? 1 : 0,
    vb: lair.veilBreached ? 1 : 0,
    ae: lair.arenaEntered ? 1 : 0,
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
          vx: Math.round(b.vortexStrength * 10) / 10,
          ts: b.twinSlam ? 1 : 0,
        }
      : null,
    m: lair.minions
      .filter((mm) => mm.alive)
      .map((mm) => [mm.id, Math.round(mm.x * 10) / 10, Math.round(mm.y * 10) / 10, mm.hp]),
  };
}

export function applySecretLairNetState(lairOrSession, snap) {
  const lair = lairOrSession?.secretLair || lairOrSession;
  if (!lair || !snap || !Array.isArray(lair.minions)) return;
  if (snap.vr) lair.veilRevealed = true;
  if (snap.vb) lair.veilBreached = true;
  if (snap.ae) lair.arenaEntered = true;
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
    }
    b.aiState = snap.b.st || b.aiState;
    b.weakAngle = Number.isFinite(snap.b.wa) ? snap.b.wa : b.weakAngle;
    b.slamTargetAngle = Number.isFinite(snap.b.sa) ? snap.b.sa : b.slamTargetAngle;
    b.vortexStrength = Number.isFinite(snap.b.vx) ? snap.b.vx : 0;
    b.twinSlam = Boolean(snap.b.ts);
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
}

export function applyRemoteBossEvent(session, msg, callbacks = {}) {
  const lair = session?.secretLair;
  if (!lair || !msg) return false;
  if (msg.kind === 'veil_breach') {
    breachSecretLairVeil(session, callbacks, { fromRemote: true });
    return true;
  }
  if (msg.kind === 'spear_shot') {
    fireSpeargun(
      session,
      {
        aimAngle: msg.aimAngle,
        chargeFrac: msg.chargeFrac || 0,
        ownerId: msg.playerId || 'peer',
        isLocal: false,
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
  return false;
}
