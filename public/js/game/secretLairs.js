/**
 * Hidden Sonar-Only Secret Lairs, Pneumatic Speargun Combat & Multi-Diver Boss Encounters (v179).
 *
 * Data-driven per-level registry (`SECRET_LAIRS`) so any of the 33 campaign sites can declare:
 *   - A Sonar-only false rock veil (`veil`) that masks the entrance until pinged (`[Q]`) & breached (`[E]`)
 *   - An Expedition Armory Rack (`armory`) granting the Pneumatic Speargun (tap rapid / hold piercing shot)
 *   - A gauntlet of lesser cavern enemies (`minions`) leading to a vaulted underwater boss arena (`arena`)
 *   - Natural limestone cover pillars, emergency rim bailout stage cylinders & a 3-phase boss (`boss`)
 *   - Dynamic difficulty tuning for 1–4 divers (human co-op + AI wingmen) & host-authoritative co-op sync
 *
 * Pure ES module with zero DOM dependencies.
 */

import { evaluateCaveSDF } from './collision.js';
import { spawnSiltPlume } from './silt.js';

export const SPEARGUN_RELOAD_SEC = 0.48;
export const SPEARGUN_MAX_CHARGE_SEC = 1.05;
export const SPEARGUN_BASE_DAMAGE = 24;
export const SPEARGUN_MAX_CHARGE_MULT = 2.45;
export const SPEARGUN_WEAKPOINT_MULT = 1.65;

export const SECRET_LAIRS = Object.freeze({
  'cenote-el-abismo': Object.freeze({
    id: 'cenote-sunken-sanctum',
    levelId: 'cenote-el-abismo',
    name: 'The Sunken Sanctum',
    veil: Object.freeze({
      id: 'l1-sanctum-veil',
      x: 55.6,
      y: 24.2,
      radius: 3.05,
      label: 'Hollow Limestone Veil',
      sonarHint: '📡 HOLLOW CAVERN DETECTED! Acoustic void behind the northeast wall at 24m — inspect & breach [E]!',
    }),
    armory: Object.freeze({
      id: 'l1-speargun-rack',
      x: 63.0,
      y: 21.0,
      radius: 2.6,
      weaponName: 'Pneumatic Titanium Speargun',
      hint: '🔱 Pneumatic Speargun equipped! Click / [F] to fire tethered bolts — hold to charge armor-piercing shots!',
    }),
    arena: Object.freeze({
      cx: 108.0,
      cy: 23.8,
      triggerX: 93.0,
      rx: 17.5,
      ry: 9.6,
      pillars: Object.freeze([
        Object.freeze({ id: 'p-west', x: 99.5, y: 26.2, radius: 1.85 }),
        Object.freeze({ id: 'p-east', x: 116.5, y: 21.4, radius: 1.85 }),
      ]),
      gasCaches: Object.freeze([
        Object.freeze({ id: 'l1-arena-stage-1', x: 96.2, y: 20.6, label: 'Sanctum Rim Stage (West)' }),
        Object.freeze({ id: 'l1-arena-stage-2', x: 107.0, y: 29.8, label: 'Sanctum Rim Stage (South)' }),
        Object.freeze({ id: 'l1-arena-stage-3', x: 120.5, y: 26.2, label: 'Sanctum Rim Stage (East)' }),
        Object.freeze({ id: 'l1-arena-stage-4', x: 108.5, y: 17.2, label: 'Sanctum Rim Stage (North)' }),
      ]),
      midStage: Object.freeze({
        id: 'l1-corridor-stage',
        x: 80.0,
        y: 22.0,
        label: 'Salvaged Expedition Bailout Stage',
      }),
      exitUpdraft: Object.freeze({
        x: 108.0,
        y: 17.6,
        radius: 3.1,
        destX: 138.0,
        destY: 7.4,
        label: 'Bioluminescent Thermal Updraft → 6m Deco Shelf',
      }),
    }),
    minions: Object.freeze([
      Object.freeze({ id: 'm-moray-1', kind: 'moray', name: 'Abyssal Cave Moray', x: 69.5, y: 20.0, hp: 52, radius: 1.15 }),
      Object.freeze({ id: 'm-moray-2', kind: 'moray', name: 'Abyssal Cave Moray', x: 74.5, y: 19.8, hp: 52, radius: 1.15 }),
      Object.freeze({ id: 'm-swarmer-1', kind: 'swarmer', name: 'Brine Spitter Swarmer', x: 78.5, y: 20.4, hp: 44, radius: 0.95 }),
      Object.freeze({ id: 'm-swarmer-2', kind: 'swarmer', name: 'Brine Spitter Swarmer', x: 82.8, y: 21.8, hp: 44, radius: 0.95 }),
      Object.freeze({ id: 'm-stalker-1', kind: 'stalker', name: 'Armored Cenote Stalker', x: 87.5, y: 23.0, hp: 110, radius: 1.5 }),
    ]),
    boss: Object.freeze({
      id: 'boss-xibalba-kraken',
      kind: 'cave-kraken',
      name: "XIBALBA'S MAW",
      title: 'Colossal Bioluminescent Cave Kraken',
      x: 110.5,
      y: 23.8,
      radius: 3.85,
      baseHp: 540,
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
  const rx = Math.max(4, (arena.rx || 16) + padM);
  const ry = Math.max(4, (arena.ry || 10) + padM);
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
  const maxHp = Math.round((spec.hp || 50) * Math.min(1.9, 1 + (hpMult - 1) * 0.35));
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
    angle: 0,
    radius: spec.radius || 1.1,
    hp: maxHp,
    maxHp,
    alive: true,
    aggro: false,
    state: 'idle', // 'idle' | 'telegraph' | 'lunge' | 'recover'
    stateTimer: 0,
    cooldown: 0.8 + Math.random() * 0.8,
    hitFlash: 0,
    wigglePhase: Math.random() * Math.PI * 2,
    lungeDirX: 1,
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
      reach: 6.2 + (i % 2) * 1.4,
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
    reloadSec: 0,
    charging: false,
    chargeSec: 0,
    spearAimAngle: 0,
    spears: [], // { id, x, y, vx, vy, originX, originY, ownerId, damage, piercing, charged, life, maxLife, hitIds }
    enemyProjectiles: [], // { x, y, vx, vy, radius, damage, life, color, kind }
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
      x: spec.boss.x,
      y: spec.boss.y,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: spec.boss.radius,
      hp: bossMaxHp,
      maxHp: bossMaxHp,
      phase: 1,
      active: false,
      defeated: false,
      defeatAnimSec: 0,
      hitFlash: 0,
      weakAngle: 0, // Exposed glowing mantle core direction
      aiState: 'idle', // 'idle' | 'slam_windup' | 'slam_strike' | 'vortex' | 'ink_barrage' | 'grab_windup' | 'grab_hold' | 'blackout_charge'
      stateTimer: 1.6,
      attackSeq: 0,
      slamTargetAngle: 0,
      slamArcHalf: 0.55,
      slamRadius: 11.2,
      vortexStrength: 0,
      blackoutAlpha: 0,
      pinnedTargetId: null, // 'local' | peerId | aiId
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
  // Ensure enough arena bailout stages exist for the updated squad size
  const wanted = [lair.spec.arena.midStage, ...lair.spec.arena.gasCaches.slice(0, next.activeStageCount)];
  for (const w of wanted) {
    if (!lair.stages.some((s) => s.id === w.id)) {
      lair.stages.push({ ...w, used: false, cooldownSec: 0 });
    }
  }
}

/**
 * Called by `triggerSonarPing` to detect whether an acoustic wave swept across a hidden limestone veil.
 */
export function revealSecretLairVeil(session, originX, originY, rangeM, callbacks = {}) {
  const lair = session?.secretLair;
  if (!lair || lair.veilBreached) return false;
  const veil = lair.spec.veil;
  const dist = Math.hypot(veil.x - originX, veil.y - originY);
  if (dist > rangeM + veil.radius) return false;
  const firstDiscovery = !lair.veilRevealed;
  lair.veilRevealed = true;
  lair.veilRevealPulse = 6.5;
  if (firstDiscovery) {
    callbacks.onToast?.(veil.sonarHint, 4.4);
  }
  return true;
}

/**
 * Shatter a Sonar-revealed limestone veil when the diver interacts (`[E]`) beside it.
 */
export function breachSecretLairVeil(session, callbacks = {}, { fromRemote = false } = {}) {
  const lair = session?.secretLair;
  if (!lair || lair.veilBreached) return { ok: false };
  lair.veilRevealed = true;
  lair.veilBreached = true;
  const veil = lair.spec.veil;
  if (Array.isArray(session.siltClouds)) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      spawnSiltPlume(session.siltClouds, {
        x: veil.x + Math.cos(a) * 1.4,
        y: veil.y + Math.sin(a) * 1.2,
        vx: Math.cos(a) * 0.55,
        vy: Math.sin(a) * 0.35 - 0.12,
        radius: 1.6,
        maxRadius: 3.4,
        life: 11,
        peakAlpha: 0.72,
      });
    }
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const spd = 2.5 + (i % 4) * 1.3;
    lair.hitSparks.push({
      x: veil.x,
      y: veil.y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life: 0.75,
      maxLife: 0.75,
      color: i % 2 === 0 ? '#7dd3fc' : '#cbd5e1',
      text: '',
      crit: false,
    });
  }
  callbacks.onVeilShatter?.(veil);
  callbacks.onToast?.(
    fromRemote
      ? `💥 Squad breached the ${veil.label}! Secret passage into ${lair.spec.name} is open!`
      : `💥 Breached the ${veil.label}! Explore the hidden passage into ${lair.spec.name}!`,
    4.0
  );
  return { ok: true, veilId: veil.id };
}

/**
 * Equip the Pneumatic Titanium Speargun from the secret Armory Rack.
 */
export function claimSecretLairWeapon(session, callbacks = {}) {
  const lair = session?.secretLair;
  if (!lair || lair.weaponEquipped) return { ok: false };
  lair.weaponEquipped = true;
  lair.reloadSec = 0;
  callbacks.onWeaponEquip?.(lair.spec.armory);
  callbacks.onToast?.(lair.spec.armory.hint, 4.4);
  return { ok: true, weaponName: lair.spec.armory.weaponName };
}

/**
 * Fire a tethered titanium speargun bolt (quick tap or hold-to-charge piercing shot).
 */
export function fireSpeargun(
  session,
  { aimAngle = null, chargeFrac = 0, ownerId = 'local', isLocal = true, originX = null, originY = null } = {},
  callbacks = {}
) {
  const lair = session?.secretLair;
  if (!lair || !session?.diveState?.alive || session.surfaced) return { ok: false, reason: 'inactive' };
  if (isLocal) {
    if (!lair.weaponEquipped) return { ok: false, reason: 'no-weapon' };
    if (lair.reloadSec > 0.02) return { ok: false, reason: 'reloading' };
    lair.reloadSec = SPEARGUN_RELOAD_SEC;
    lair.charging = false;
    lair.chargeSec = 0;
  }

  const diver = session.diver;
  const sx = Number.isFinite(originX) ? originX : diver.x;
  const sy = Number.isFinite(originY) ? originY : diver.y;
  const ang = Number.isFinite(aimAngle) ? aimAngle : (diver.torchAngle ?? diver.angle ?? 0);
  const cFrac = Math.max(0, Math.min(1, Number(chargeFrac) || 0));
  const charged = cFrac >= 0.45;
  const speed = 23 + cFrac * 12;
  const damage = Math.round(SPEARGUN_BASE_DAMAGE * (1 + cFrac * (SPEARGUN_MAX_CHARGE_MULT - 1)));
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
    damage,
    charged,
    piercing: cFrac >= 0.72,
    life: 0.95 + cFrac * 0.35,
    maxLife: 0.95 + cFrac * 0.35,
    hitIds: new Set(),
  };
  lair.spears.push(bolt);

  // Subtle authentic underwater pneumatic recoil kick
  if (isLocal && diver) {
    const recoil = 0.65 + cFrac * 0.75;
    diver.vx = (diver.vx || 0) - Math.cos(ang) * recoil;
    diver.vy = (diver.vy || 0) - Math.sin(ang) * recoil;
    session.diveState.heartRateBpm = Math.min(185, (session.diveState.heartRateBpm || 74) + (charged ? 2.5 : 1.0));
  }

  if (Array.isArray(session.bubbles)) {
    for (let i = 0; i < (charged ? 6 : 3); i++) {
      session.bubbles.push({
        x: bolt.x + (Math.random() - 0.5) * 0.25,
        y: bolt.y + (Math.random() - 0.5) * 0.25,
        vx: Math.cos(ang) * 1.4 + (Math.random() - 0.5) * 0.6,
        vy: -0.5 - Math.random() * 0.6,
        r: 0.055 + Math.random() * 0.04,
        life: 0.9 + Math.random() * 0.5,
      });
    }
  }

  callbacks.onSpeargunFire?.({ bolt, charged, isLocal });
  return { ok: true, bolt, charged, aimAngle: ang, chargeFrac: cFrac };
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

function applyDamageToLocalDiver(session, amount, sourceLabel, callbacks) {
  const ds = session.diveState;
  if (!ds?.alive || session.surfaced) return;
  const diffScale = session.difficulty === 'guided' ? 0.6 : session.difficulty === 'hardcore' ? 1.2 : 1.0;
  const dmg = Math.max(2, amount * diffScale);
  ds.health = Math.max(0, (ds.health ?? 100) - dmg);
  ds.panicLevel = Math.min(1, (ds.panicLevel || 0) + 0.14);
  ds.heartRateBpm = Math.min(192, (ds.heartRateBpm || 85) + 12);
  if (session.cameraShake !== undefined) {
    session.cameraShake = Math.max(session.cameraShake || 0, 0.35);
  }
  callbacks.onAlarm?.('danger');
  if (ds.health <= 0) {
    ds.alive = false;
    ds.causeOfFailure = `Overwhelmed by ${sourceLabel}`;
    ds.failureDetail = `Overwhelmed by ${sourceLabel} in ${session.secretLair?.spec?.name || 'the Sunken Sanctum'}.`;
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
  boss.hp = Math.max(0, boss.hp - Math.max(1, Math.round(damage)));
  boss.hitFlash = 0.16;
  const sx = Number.isFinite(hitX) ? hitX : boss.x;
  const sy = Number.isFinite(hitY) ? hitY : boss.y;
  addSparkBurst(
    lair,
    sx,
    sy,
    crit ? '#fde047' : '#38bdf8',
    crit ? 10 : 6,
    `${crit ? 'CRIT ' : ''}-${Math.round(damage)}`,
    crit
  );
  callbacks.onSpearHit?.({ target: 'boss', damage, crit, x: sx, y: sy });

  // Phase transitions
  const hpRatio = boss.maxHp > 0 ? boss.hp / boss.maxHp : 0;
  if (boss.phase === 1 && hpRatio <= 0.65 && boss.hp > 0) {
    boss.phase = 2;
    boss.aiState = 'vortex';
    boss.stateTimer = 4.2;
    callbacks.onBossRoar?.(2);
    callbacks.onToast?.(`🐙 PHASE 2: ${boss.name} unleashes the Abyssal Vortex & summons cavern swarmers! Take cover behind pillars!`, 4.2);
    if (!boss.phase2Summoned && !fromRemote) {
      boss.phase2Summoned = true;
      for (let i = 0; i < lair.scaling.phase2Adds; i++) {
        const ang = Math.PI * 0.72 + i * 0.52;
        lair.minions.push(
          makeMinionInstance(
            {
              id: `p2-add-${i}-${Math.round(session.simTimeSec || 0)}`,
              kind: 'swarmer',
              name: 'Sanctum Swarmer',
              x: boss.homeX + Math.cos(ang) * 7.2,
              y: boss.homeY + Math.sin(ang) * 4.4,
              hp: 40,
              radius: 0.95,
            },
            lair.scaling.hpMult
          )
        );
      }
    }
  } else if (boss.phase < 3 && hpRatio <= 0.30 && boss.hp > 0) {
    boss.phase = 3;
    boss.aiState = 'blackout_charge';
    boss.stateTimer = 3.2;
    boss.blackoutAlpha = 0.82;
    callbacks.onBossRoar?.(3);
    callbacks.onToast?.(`⚡ PHASE 3: ${boss.name} IS ENRAGED! Aim for its blazing cyan mantle core & watch for Tentacle Grabs!`, 4.4);
  }

  // Victory!
  if (boss.hp <= 0 && !boss.defeated) {
    boss.defeated = true;
    boss.active = false;
    boss.pinnedTargetId = null;
    boss.vortexStrength = 0;
    boss.blackoutAlpha = 0;
    boss.defeatAnimSec = 3.2;
    lair.bossDefeated = true;
    lair.trophyClaimed = true;
    lair.bonusScore = (lair.bonusScore || 0) + (lair.spec.boss.bonusPoints || 2500);
    // Clear remaining arena adds & projectiles dramatically
    for (const m of lair.minions) {
      if (m.alive && isPointInArena(lair.spec.arena, m.x, m.y, 6)) {
        m.alive = false;
        m.hp = 0;
      }
    }
    lair.enemyProjectiles.length = 0;
    addSparkBurst(lair, boss.x, boss.y, '#67e8f9', 26, `🏆 ${lair.spec.boss.trophyName}!`, true);
    callbacks.onBossDefeat?.(boss, lair);
    callbacks.onToast?.(
      `🏆 VICTORY! ${boss.name} defeated (+${lair.spec.boss.bonusPoints} pts)! Ride the glowing Bioluminescent Updraft to the 6m Deco Shelf!`,
      5.5
    );
  }
  return { ok: true, hp: boss.hp, defeated: boss.defeated, phase: boss.phase };
}

/**
 * Handle contextual `[E]` interact inside a Secret Lair (breach veil, claim speargun, break grab, refill stage, ride updraft).
 */
export function handleSecretLairInteract(session, callbacks = {}) {
  const lair = session?.secretLair;
  if (!lair || !session?.diveState?.alive) return { handled: false };
  const { diver, diveState } = session;

  // 1. Struggle free if pinned by Kraken tentacle in solo or co-op
  if (lair.boss?.pinnedTargetId === 'local' && !lair.boss.defeated) {
    lair.boss.pinHitsNeeded = Math.max(0, (lair.boss.pinHitsNeeded || 1) - 1);
    addSparkBurst(lair, diver.x, diver.y, '#fde047', 6, 'SLASH!', false);
    if (lair.boss.pinHitsNeeded <= 0) {
      lair.boss.pinnedTargetId = null;
      lair.boss.aiState = 'idle';
      lair.boss.stateTimer = 1.6;
      callbacks.onToast?.('✂️ Slashed free from Kraken tentacle!', 2.4);
    } else {
      callbacks.onToast?.(`✂️ Keep slashing [E]! (${lair.boss.pinHitsNeeded} left)`, 1.4);
    }
    return { handled: true, kind: 'lair-unpin' };
  }

  // 2. Breach sonar-revealed limestone veil
  if (lair.veilRevealed && !lair.veilBreached) {
    const v = lair.spec.veil;
    if (Math.hypot(diver.x - v.x, diver.y - v.y) <= v.radius + 3.2) {
      const res = breachSecretLairVeil(session, callbacks);
      if (res.ok) return { handled: true, kind: 'lair-veil', targetId: v.id };
    }
  }

  // 3. Equip Pneumatic Speargun from Armory Rack
  if (lair.veilBreached && !lair.weaponEquipped) {
    const a = lair.spec.armory;
    if (Math.hypot(diver.x - a.x, diver.y - a.y) <= a.radius + 2.6) {
      const res = claimSecretLairWeapon(session, callbacks);
      if (res.ok) return { handled: true, kind: 'lair-weapon', targetId: a.id };
    }
  }

  // 4. Refill active tank from an Arena / Corridor Emergency Bailout Stage
  if (lair.veilBreached) {
    for (const st of lair.stages) {
      if (st.cooldownSec > 0) continue;
      if (Math.hypot(diver.x - st.x, diver.y - st.y) <= 3.0) {
        const activeTank = diveState.tanks?.[diveState.activeGasId];
        const tmxTank = diveState.tanks?.TMX1455;
        const targetTank = (tmxTank && tmxTank.bar < 165) ? tmxTank : activeTank;
        if (targetTank && targetTank.bar < 195) {
          const added = Math.min(95, 200 - targetTank.bar);
          targetTank.bar = Math.min(200, targetTank.bar + added);
          targetTank.litersRemaining = Math.min(targetTank.capacityLiters || 2400, (targetTank.bar / 200) * (targetTank.capacityLiters || 2400));
          st.used = true;
          st.cooldownSec = 28; // Recharges after 28s so long 4-diver fights stay sustainable
          callbacks.onStageClaim?.(st);
          callbacks.onToast?.(`⛽ Topped up +${Math.round(added)} bar from ${st.label}!`, 2.6);
          return { handled: true, kind: 'lair-stage', targetId: st.id };
        }
      }
    }
  }

  // 5. Post-Victory Bioluminescent Ascent Updraft -> warp/ride cleanly back to the 6m Deco Shelf!
  if (lair.bossDefeated && lair.spec.arena.exitUpdraft) {
    const up = lair.spec.arena.exitUpdraft;
    if (Math.hypot(diver.x - up.x, diver.y - up.y) <= up.radius + 2.6) {
      diver.x = up.destX;
      diver.y = up.destY;
      diver.vx = 0;
      diver.vy = -0.5;
      diveState.depthM = up.destY;
      // Ensure turnaround & ascent checkpoints are credited so player can finish deco & surface cleanly!
      if (session.checkpointsHit && Array.isArray(session.level?.checkpoints)) {
        for (let i = 0; i < session.level.checkpoints.length - 1; i++) {
          session.checkpointsHit.add(session.level.checkpoints[i].id);
        }
      }
      callbacks.onUpdraftTeleport?.(up);
      callbacks.onToast?.('✨ Rode the Bioluminescent Updraft to the 6m Deco Shelf! Switch to O₂ [3] & surface!', 4.2);
      return { handled: true, kind: 'lair-updraft', targetId: 'updraft' };
    }
  }

  return { handled: false };
}

/**
 * Compute contextual HUD action prompt for the Secret Lair (returns null if none nearby).
 */
export function getSecretLairActionPrompt(session) {
  const lair = session?.secretLair;
  if (!lair || !session?.diveState?.alive) return null;
  const { diver, diveState } = session;

  if (lair.boss?.pinnedTargetId === 'local' && !lair.boss.defeated) {
    return {
      kind: 'lair-unpin',
      label: '✂️ SLASH FREE [E]',
      detail: `Tentacle Grab! Mash [E] (${lair.boss.pinHitsNeeded || 1} hits) or let squad shoot it!`,
      progress: 0,
    };
  }
  if (lair.veilRevealed && !lair.veilBreached) {
    const v = lair.spec.veil;
    if (Math.hypot(diver.x - v.x, diver.y - v.y) <= v.radius + 3.2) {
      return {
        kind: 'lair-veil',
        label: '💥 BREACH VEIL [E]',
        detail: `Hollow acoustic anomaly — break into ${lair.spec.name}`,
        progress: 0,
      };
    }
  }
  if (lair.veilBreached && !lair.weaponEquipped) {
    const a = lair.spec.armory;
    if (Math.hypot(diver.x - a.x, diver.y - a.y) <= a.radius + 2.6) {
      return {
        kind: 'lair-weapon',
        label: '🔱 TAKE SPEARGUN [E]',
        detail: 'Pneumatic Titanium Speargun (Tap / Hold to Charge)',
        progress: 0,
      };
    }
  }
  if (lair.bossDefeated && lair.spec.arena.exitUpdraft) {
    const up = lair.spec.arena.exitUpdraft;
    if (Math.hypot(diver.x - up.x, diver.y - up.y) <= up.radius + 2.6) {
      return {
        kind: 'lair-updraft',
        label: '✨ RIDE UPDRAFT [E]',
        detail: 'Ascend directly to the 6m Deco Shelf',
        progress: 0,
      };
    }
  }
  if (lair.veilBreached) {
    const activeTank = diveState.tanks?.[diveState.activeGasId];
    const tmxTank = diveState.tanks?.TMX1455;
    const lowGas = (activeTank && activeTank.bar < 175) || (tmxTank && tmxTank.bar < 165);
    if (lowGas) {
      for (const st of lair.stages) {
        if (st.cooldownSec > 0) continue;
        if (Math.hypot(diver.x - st.x, diver.y - st.y) <= 3.0) {
          return {
            kind: 'lair-stage',
            label: '⛽ TOP UP STAGE [E]',
            detail: `${st.label} (+95 bar)`,
            progress: 0,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Step Secret Lair barriers, pillars, speargun bolts, lesser enemies, AI wingmen combat & 3-phase Kraken boss.
 */
export function stepSecretLairEncounter(session, dt, { peers = [], isAuthority = true } = {}, callbacks = {}) {
  const lair = session?.secretLair;
  if (!lair || dt <= 0) return;
  const { level, diver, diveState, siltClouds } = session;

  if (lair.veilRevealPulse > 0) lair.veilRevealPulse = Math.max(0, lair.veilRevealPulse - dt);
  if (lair.reloadSec > 0) lair.reloadSec = Math.max(0, lair.reloadSec - dt);
  if (lair.charging && lair.weaponEquipped && diveState?.alive) {
    lair.chargeSec = Math.min(SPEARGUN_MAX_CHARGE_SEC, lair.chargeSec + dt);
  }
  for (const st of lair.stages) {
    if (st.cooldownSec > 0) st.cooldownSec = Math.max(0, st.cooldownSec - dt);
  }

  // 1. Sealed False Limestone Veil barrier (blocks passage until sonar-discovered & breached)
  if (!lair.veilBreached) {
    const v = lair.spec.veil;
    const dx = diver.x - v.x;
    const dy = diver.y - v.y;
    const dist = Math.hypot(dx, dy);
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
    // Also keep hitSparks ticking if any
    _stepSparks(lair, dt);
    return;
  }

  // 2. Arena Natural Limestone Cover Pillar collision (divers & projectiles can use them for cover!)
  const pillars = lair.spec.arena.pillars || [];
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    const dx = diver.x - p.x;
    const dy = diver.y - p.y;
    const dist = Math.hypot(dx, dy);
    const minD = p.radius + 0.52;
    if (dist < minD && dist > 0.001) {
      const push = minD - dist;
      diver.x += (dx / dist) * push;
      diver.y += (dy / dist) * push;
    }
  }

  // Build active target list (local diver + live human peers + live AI wingmen inside the lair)
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

  // Dynamic squad scaling update (counts live human peers + AI wingmen)
  const liveHumans = Math.max(1, 1 + (peers || []).filter((p) => p && p.alive !== false).length);
  const liveAi = (session.aiSquad || []).filter((a) => a && a.alive !== false).length;
  rescaleSecretLairForSquad(lair, liveHumans, liveAi);

  // 3. Activate Boss Arena once any diver enters the vaulted arena bounds
  const boss = lair.boss;
  if (!boss.defeated && !boss.active) {
    const entered = targets.some((t) => isPointInArena(lair.spec.arena, t.x, t.y, 1.5));
    if (entered) {
      lair.arenaEntered = true;
      boss.active = true;
      boss.aiState = 'idle';
      boss.stateTimer = 1.4;
      callbacks.onBossRoar?.(1);
      callbacks.onToast?.(
        `🐙 ${boss.name} AWAKENS! (${lair.scaling.label}) — Aim for its glowing mantle core & use pillars for cover!`,
        4.6
      );
    }
  }

  // 4. AI Wingmen combat support inside the Secret Lair (fire speargun bolts at threats & free pinned player!)
  if (lair.weaponEquipped && Array.isArray(session.aiSquad)) {
    for (const ai of session.aiSquad) {
      if (!ai || ai.alive === false) continue;
      const cd = Math.max(0, (lair._aiFireCooldowns.get(ai.id) || 0) - dt);
      lair._aiFireCooldowns.set(ai.id, cd);
      if (cd > 0) continue;
      let aimTarget = null;
      if (boss.active && !boss.defeated && boss.pinnedTargetId === 'local') {
        aimTarget = { x: boss.x, y: boss.y };
      } else {
        let bestD = 18;
        for (const m of lair.minions) {
          if (!m.alive) continue;
          const d = Math.hypot(m.x - ai.x, m.y - ai.y);
          if (d < bestD) { bestD = d; aimTarget = m; }
        }
        if (!aimTarget && boss.active && !boss.defeated && Math.hypot(boss.x - ai.x, boss.y - ai.y) < 26) {
          aimTarget = boss;
        }
      }
      if (aimTarget) {
        const ang = Math.atan2(aimTarget.y - ai.y, aimTarget.x - ai.x);
        fireSpeargun(session, { aimAngle: ang, chargeFrac: 0.15, ownerId: ai.id, isLocal: false, originX: ai.x, originY: ai.y }, {});
        lair._aiFireCooldowns.set(ai.id, 1.45 + Math.random() * 0.5);
      }
    }
  }

  // 5. Step Speargun Bolts & Hit Detection (Minions, Boss Weak-Point, Pinned Tentacle & Walls)
  for (let i = lair.spears.length - 1; i >= 0; i--) {
    const sp = lair.spears[i];
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.life -= dt;
    // Slight underwater drag
    sp.vx *= Math.pow(0.92, dt * 10);
    sp.vy *= Math.pow(0.92, dt * 10);

    // Wall / pillar stop
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

    // Check Minion hits
    let consumed = false;
    for (const m of lair.minions) {
      if (!m.alive || sp.hitIds.has(m.id)) continue;
      if (Math.hypot(sp.x - m.x, sp.y - m.y) <= m.radius + 0.55) {
        sp.hitIds.add(m.id);
        let dmg = sp.damage;
        let crit = false;
        // Armored Stalker takes reduced frontal damage unless pierced by a charged shot or flanked!
        if (m.kind === 'stalker' && !sp.piercing) {
          const hitAng = Math.atan2(sp.y - m.y, sp.x - m.x);
          const diff = Math.abs(Math.atan2(Math.sin(hitAng - m.angle), Math.cos(hitAng - m.angle)));
          if (diff < 0.95) {
            dmg = Math.max(6, Math.round(dmg * 0.42));
          } else {
            dmg = Math.round(dmg * 1.35);
            crit = true;
          }
        } else if (sp.charged) {
          crit = true;
        }
        m.hp = Math.max(0, m.hp - dmg);
        m.hitFlash = 0.16;
        m.aggro = true;
        addSparkBurst(lair, sp.x, sp.y, crit ? '#fde047' : '#38bdf8', crit ? 8 : 5, `${crit ? 'CRIT ' : ''}-${dmg}`, crit);
        callbacks.onSpearHit?.({ target: 'minion', minionId: m.id, damage: dmg, crit, x: sp.x, y: sp.y });
        if (m.hp <= 0) {
          m.alive = false;
          lair.minionsKilled += 1;
          lair.bonusScore += m.kind === 'stalker' ? 300 : 150;
          addSparkBurst(lair, m.x, m.y, '#34d399', 12, `+${m.kind === 'stalker' ? 300 : 150}`, true);
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

    // Check Boss hits (including mantle weak-point crits & breaking a tentacle grab!)
    if (boss.active && !boss.defeated && !sp.hitIds.has(boss.id)) {
      const distBoss = Math.hypot(sp.x - boss.x, sp.y - boss.y);
      if (distBoss <= boss.radius + 0.65) {
        sp.hitIds.add(boss.id);
        // Glowing mantle core sits at boss.weakAngle around boss rim
        const coreX = boss.x + Math.cos(boss.weakAngle) * (boss.radius * 0.58);
        const coreY = boss.y + Math.sin(boss.weakAngle) * (boss.radius * 0.58);
        const hitCore = Math.hypot(sp.x - coreX, sp.y - coreY) <= 2.35;
        const crit = hitCore || sp.piercing;
        const dmg = Math.round(sp.damage * (hitCore ? SPEARGUN_WEAKPOINT_MULT : 1.0) * (sp.isLocal ? 1.0 : 0.65));

        // Shooting boss while someone is pinned frees them fast!
        if (boss.pinnedTargetId) {
          boss.pinHitsNeeded = Math.max(0, (boss.pinHitsNeeded || 1) - 1);
          if (boss.pinHitsNeeded <= 0) {
            boss.pinnedTargetId = null;
            boss.aiState = 'idle';
            boss.stateTimer = 1.4;
            callbacks.onToast?.('🔱 Squad speargun hit broke the Kraken tentacle grab!', 2.6);
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

  // 6. Step Lesser Enemies along the Hidden Corridor (host-authoritative or solo)
  if (isAuthority) {
    for (const m of lair.minions) {
      if (!m.alive) continue;
      if (m.hitFlash > 0) m.hitFlash = Math.max(0, m.hitFlash - dt);
      m.wigglePhase += dt * (m.state === 'lunge' ? 14 : 5);
      if (m.cooldown > 0) m.cooldown = Math.max(0, m.cooldown - dt);

      // Find nearest target within 16m
      let nearest = null;
      let bestDist = 16.5;
      for (const t of targets) {
        const d = Math.hypot(t.x - m.x, t.y - m.y);
        if (d < bestDist) { bestDist = d; nearest = t; }
      }
      if (!nearest) {
        // Gentle patrol around home
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
          const speed = m.kind === 'stalker' ? 2.5 : 3.2;
          if (bestDist > (m.kind === 'stalker' ? 4.8 : 6.2)) {
            m.vx = Math.cos(toAng) * speed;
            m.vy = Math.sin(toAng) * speed;
          } else if (m.cooldown <= 0) {
            m.state = 'telegraph';
            m.stateTimer = m.kind === 'stalker' ? 0.65 : 0.48;
            m.lungeDirX = Math.cos(toAng);
            m.lungeDirY = Math.sin(toAng);
            m.vx *= 0.2;
            m.vy *= 0.2;
          }
        } else if (m.state === 'telegraph') {
          m.stateTimer -= dt;
          if (m.stateTimer <= 0) {
            m.state = 'lunge';
            m.stateTimer = 0.48;
            const lungeSpd = m.kind === 'stalker' ? 9.2 : 11.4;
            m.vx = m.lungeDirX * lungeSpd;
            m.vy = m.lungeDirY * lungeSpd;
          }
        } else if (m.state === 'lunge') {
          m.stateTimer -= dt;
          // Hit check against local diver
          if (diveState?.alive && Math.hypot(diver.x - m.x, diver.y - m.y) <= m.radius + 0.72) {
            applyDamageToLocalDiver(session, (m.kind === 'stalker' ? 16 : 11) * lair.scaling.damageMult, m.name, callbacks);
            m.state = 'recover';
            m.stateTimer = 0.9;
            m.cooldown = 1.6 / lair.scaling.attackRateMult;
          } else if (m.stateTimer <= 0) {
            m.state = 'recover';
            m.stateTimer = 0.75;
            m.cooldown = 1.4 / lair.scaling.attackRateMult;
          }
        } else {
          m.vx *= Math.pow(0.25, dt * 4);
          m.vy *= Math.pow(0.25, dt * 4);
          m.stateTimer -= dt;
          if (m.stateTimer <= 0) m.state = 'idle';
        }
      } else if (m.kind === 'swarmer') {
        m.angle = toAng;
        // Strafe around target at ~7m & spit brine globs
        const orbitAng = toAng + Math.PI * 0.5;
        const radial = bestDist > 8.5 ? 1 : bestDist < 5.2 ? -1 : 0;
        m.vx = (Math.cos(toAng) * radial * 2.8) + Math.cos(orbitAng) * 2.2;
        m.vy = (Math.sin(toAng) * radial * 2.8) + Math.sin(orbitAng) * 2.2;
        if (m.cooldown <= 0 && bestDist < 14) {
          lair.enemyProjectiles.push({
            x: m.x + Math.cos(toAng) * 0.8,
            y: m.y + Math.sin(toAng) * 0.8,
            vx: Math.cos(toAng) * 9.5,
            vy: Math.sin(toAng) * 9.5,
            radius: 0.42,
            damage: 9 * lair.scaling.damageMult,
            life: 2.2,
            color: '#a3e635',
            kind: 'brine',
          });
          m.cooldown = (2.1 + Math.random() * 0.6) / lair.scaling.attackRateMult;
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

  // 7. Step 3-Phase Cave Kraken Boss (*XIBALBA'S MAW*)
  if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  if (boss.blackoutAlpha > 0) boss.blackoutAlpha = Math.max(0, boss.blackoutAlpha - dt * 0.35);
  if (boss.defeated) {
    if (boss.defeatAnimSec > 0) boss.defeatAnimSec = Math.max(0, boss.defeatAnimSec - dt);
  } else if (boss.active) {
    // Rotate glowing mantle weak-point slowly so divers must maneuver/flank or coordinate in co-op!
    boss.weakAngle += dt * (boss.phase === 3 ? 0.95 : boss.phase === 2 ? 0.65 : 0.45);
    for (const t of boss.tentacles) {
      t.waveOffset += dt * (boss.phase === 3 ? 5.2 : 3.4);
    }

    // Pick aggro target inside arena
    const arenaTargets = targets.filter((t) => isPointInArena(lair.spec.arena, t.x, t.y, 5));
    const primaryTarget =
      arenaTargets.length > 0
        ? arenaTargets[boss.attackSeq % arenaTargets.length]
        : targets[0] || { id: 'local', x: diver.x, y: diver.y };

    // Smooth majestic hover drift around arena center
    const hoverX = boss.homeX + Math.cos(session.simTimeSec * 0.42) * 4.5;
    const hoverY = boss.homeY + Math.sin(session.simTimeSec * 0.58) * 2.4;
    if (isAuthority) {
      boss.x += (hoverX - boss.x) * Math.min(1, dt * 1.1);
      boss.y += (hoverY - boss.y) * Math.min(1, dt * 1.1);
      boss.angle = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
    }

    // Apply Abyssal Vortex suction current to local diver when boss is in 'vortex' state!
    if (boss.aiState === 'vortex' && boss.vortexStrength > 0 && diveState?.alive) {
      const dx = boss.x - diver.x;
      const dy = boss.y - diver.y;
      const dist = Math.hypot(dx, dy);
      if (dist > boss.radius + 0.8 && dist < 24) {
        // Check if sheltered behind an arena limestone pillar!
        let sheltered = false;
        for (const p of pillars) {
          const toPillar = Math.hypot(diver.x - p.x, diver.y - p.y);
          const bossToPillar = Math.hypot(boss.x - p.x, boss.y - p.y);
          if (toPillar < p.radius + 2.8 && bossToPillar < dist) {
            sheltered = true;
            break;
          }
        }
        if (!sheltered) {
          const pull = (boss.vortexStrength / Math.max(4, dist * 0.45)) * dt;
          diver.vx += (dx / dist) * pull * 4.8;
          diver.vy += (dy / dist) * pull * 4.8;
        }
      }
      if (dist <= boss.radius + 1.1) {
        applyDamageToLocalDiver(session, 16 * dt * lair.scaling.damageMult, boss.name, callbacks);
      }
    }

    // Hold local diver if pinned by Kraken tentacle!
    if (boss.pinnedTargetId === 'local' && diveState?.alive) {
      const holdX = boss.x + Math.cos(boss.angle) * (boss.radius + 2.2);
      const holdY = boss.y + Math.sin(boss.angle) * (boss.radius + 2.2);
      diver.x += (holdX - diver.x) * Math.min(1, dt * 8);
      diver.y += (holdY - diver.y) * Math.min(1, dt * 8);
      diver.vx *= 0.15;
      diver.vy *= 0.15;
      applyDamageToLocalDiver(session, 6.5 * dt * lair.scaling.damageMult, `${boss.name}'s Tentacle`, callbacks);
    }

    // Host-authoritative Boss Attack State Machine
    if (isAuthority) {
      boss.stateTimer -= dt * lair.scaling.attackRateMult;
      if (boss.aiState === 'idle') {
        boss.vortexStrength = 0;
        if (boss.stateTimer <= 0 && arenaTargets.length > 0) {
          boss.attackSeq += 1;
          const roll = boss.attackSeq % (boss.phase === 3 ? 4 : boss.phase === 2 ? 3 : 2);
          if (roll === 0) {
            boss.aiState = 'slam_windup';
            boss.slamTargetAngle = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
            boss.stateTimer = boss.phase === 3 ? 0.95 : 1.25;
          } else if (roll === 1) {
            boss.aiState = 'ink_barrage';
            boss.stateTimer = 0.85;
          } else if (roll === 2) {
            boss.aiState = 'vortex';
            boss.vortexStrength = 5.4 + boss.phase * 1.2;
            boss.stateTimer = 3.8;
            callbacks.onBossRoar?.(2);
          } else {
            boss.aiState = 'grab_windup';
            boss.slamTargetAngle = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
            boss.stateTimer = 1.05;
          }
        }
      } else if (boss.aiState === 'slam_windup') {
        if (boss.stateTimer <= 0) {
          boss.aiState = 'slam_strike';
          boss.stateTimer = 0.55;
          // Kick up dramatic silt cloud along tentacle slam arc
          if (Array.isArray(siltClouds)) {
            for (let k = -1; k <= 1; k++) {
              const a = boss.slamTargetAngle + k * 0.35;
              spawnSiltPlume(siltClouds, {
                x: boss.x + Math.cos(a) * 7.2,
                y: boss.y + Math.sin(a) * 6.0,
                vx: Math.cos(a) * 1.1,
                vy: Math.sin(a) * 0.7 - 0.15,
                radius: 2.0,
                maxRadius: 4.0,
                life: 10,
                peakAlpha: 0.74,
              });
            }
          }
          // Check if local diver is inside telegraphed slam cone!
          if (diveState?.alive) {
            const dLocal = Math.hypot(diver.x - boss.x, diver.y - boss.y);
            const aLocal = Math.atan2(diver.y - boss.y, diver.x - boss.x);
            const aDiff = Math.abs(Math.atan2(Math.sin(aLocal - boss.slamTargetAngle), Math.cos(aLocal - boss.slamTargetAngle)));
            if (dLocal <= boss.slamRadius && aDiff <= boss.slamArcHalf) {
              applyDamageToLocalDiver(session, 18 * lair.scaling.damageMult, `${boss.name}'s Tentacle Slam`, callbacks);
              diver.vx += Math.cos(aLocal) * 6.5;
              diver.vy += Math.sin(aLocal) * 6.5;
            }
          }
        }
      } else if (boss.aiState === 'slam_strike') {
        if (boss.stateTimer <= 0) {
          boss.aiState = 'idle';
          boss.stateTimer = boss.phase === 3 ? 1.05 : 1.55;
        }
      } else if (boss.aiState === 'ink_barrage') {
        if (boss.stateTimer <= 0) {
          const count = boss.phase === 1 ? 3 : boss.phase === 2 ? 5 : 7;
          const baseAng = Math.atan2(primaryTarget.y - boss.y, primaryTarget.x - boss.x);
          const spread = 0.24;
          for (let k = 0; k < count; k++) {
            const a = baseAng + (k - (count - 1) * 0.5) * spread;
            lair.enemyProjectiles.push({
              x: boss.x + Math.cos(a) * (boss.radius * 0.8),
              y: boss.y + Math.sin(a) * (boss.radius * 0.8),
              vx: Math.cos(a) * (10.5 + boss.phase * 1.2),
              vy: Math.sin(a) * (10.5 + boss.phase * 1.2),
              radius: 0.56,
              damage: 13 * lair.scaling.damageMult,
              life: 2.8,
              color: '#c084fc',
              kind: 'ink',
            });
          }
          boss.aiState = 'idle';
          boss.stateTimer = boss.phase === 3 ? 1.15 : 1.75;
        }
      } else if (boss.aiState === 'vortex') {
        if (boss.stateTimer <= 0) {
          boss.vortexStrength = 0;
          boss.aiState = 'idle';
          boss.stateTimer = 1.45;
        }
      } else if (boss.aiState === 'grab_windup') {
        if (boss.stateTimer <= 0) {
          const dLocal = Math.hypot(diver.x - boss.x, diver.y - boss.y);
          if (diveState?.alive && dLocal <= 11.5) {
            boss.pinnedTargetId = 'local';
            boss.pinHitsNeeded = lair.scaling.totalDivers > 1 ? 2 : 3;
            boss.pinTimerSec = 3.2;
            boss.aiState = 'grab_hold';
            boss.stateTimer = 3.2;
            callbacks.onToast?.('🐙 TENTACLE GRAB! Mash [E] to slash free — or squad shoot the Kraken!', 3.0);
          } else {
            boss.aiState = 'idle';
            boss.stateTimer = 1.2;
          }
        }
      } else if (boss.aiState === 'grab_hold') {
        boss.pinTimerSec = Math.max(0, boss.pinTimerSec - dt);
        if (boss.stateTimer <= 0 || boss.pinTimerSec <= 0 || !boss.pinnedTargetId) {
          boss.pinnedTargetId = null;
          boss.aiState = 'idle';
          boss.stateTimer = 1.5;
        }
      } else if (boss.aiState === 'blackout_charge') {
        if (boss.stateTimer <= 0) {
          boss.aiState = 'idle';
          boss.stateTimer = 1.1;
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

    if (diveState?.alive && Math.hypot(diver.x - pr.x, diver.y - pr.y) <= pr.radius + 0.62) {
      applyDamageToLocalDiver(session, pr.damage, pr.kind === 'ink' ? boss.name : 'Brine Swarmer', callbacks);
      addSparkBurst(lair, pr.x, pr.y, pr.color, 7);
      lair.enemyProjectiles.splice(i, 1);
    }
  }

  _stepSparks(lair, dt);
}

function _stepSparks(lair, dt) {
  for (let i = lair.hitSparks.length - 1; i >= 0; i--) {
    const s = lair.hitSparks[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= Math.pow(0.2, dt * 3);
    s.vy *= Math.pow(0.2, dt * 3);
    s.life -= dt;
    if (s.life <= 0) lair.hitSparks.splice(i, 1);
  }
}

/**
 * Compact host-authoritative snapshot for 1–4 player co-op synchronization (~6 Hz during boss combat).
 */
export function serializeSecretLairNetState(lair) {
  if (!lair) return null;
  const b = lair.boss;
  return {
    vr: lair.veilRevealed ? 1 : 0,
    vb: lair.veilBreached ? 1 : 0,
    ae: lair.arenaEntered ? 1 : 0,
    b: {
      x: Math.round(b.x * 10) / 10,
      y: Math.round(b.y * 10) / 10,
      hp: Math.round(b.hp),
      mhp: Math.round(b.maxHp),
      ph: b.phase,
      ac: b.active ? 1 : 0,
      df: b.defeated ? 1 : 0,
      st: b.aiState,
      wa: Math.round(b.weakAngle * 100) / 100,
      sa: Math.round(b.slamTargetAngle * 100) / 100,
      vx: Math.round(b.vortexStrength * 10) / 10,
    },
    m: lair.minions
      .filter((m) => m.alive)
      .slice(0, 10)
      .map((m) => [m.id, Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10, Math.round(m.hp)]),
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
