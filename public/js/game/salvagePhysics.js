/**
 * Heavy Salvage Weight, Inflatable Commercial Lift-Bag Buoyancy Physics
 * & Pressurized Deep Bulkhead Valve Equalization (v147).
 *
 * Pure deterministic physics module (zero DOM dependencies).
 */

import { recordMechanicalEvent } from './mechanicalFx.js';

export const LIFT_BAG_CAPACITY_KG = 24;
export const LIFT_BAG_INFLATE_BAR = 3.5;

function spawnLiftBagBubble(bubbles, x, y, vx, vy, baseR) {
  if (!Array.isArray(bubbles) || bubbles.length >= 260) return;
  const maxLife = 3.4 + Math.random() * 1.8;
  bubbles.push({
    x,
    y,
    vx,
    vy,
    targetVy: -(1.25 + baseR * 6.5 + Math.random() * 0.4),
    baseR,
    r: baseR,
    maxR: Math.min(0.24, baseR * 1.85),
    spawnDepth: Math.max(0.5, y),
    wobbleFreq: 4.5 + Math.random() * 3.2,
    wobbleAmp: 0.28 + Math.random() * 0.28,
    wobblePhase: Math.random() * Math.PI * 2,
    age: 0,
    maxLife,
    life: maxLife,
    trapped: false,
    primary: baseR >= 0.085,
  });
}

/**
 * Determine whether a sealed watertight bulkhead requires Step-1 pressure valve equalization
 * before its main dogging wheel can be cranked open (deep shipwreck vaults >= 62m).
 */
export function isHatchPressurized(level, hatch) {
  if (!level?.isWreck || !hatch) return false;
  return Boolean(hatch.pressurized || (Number(hatch.y) || 0) >= 62);
}

/**
 * Estimate underwater negative buoyancy weight (kg) of a recovered artifact or salvage item.
 */
export function computeCollectibleWeightKg(item, isWreck = false) {
  if (!item) return 0;
  if (Number.isFinite(item.weightKg)) return Math.max(0, item.weightKg);
  const name = String(item.name || '');
  const pts = Number(item.points) || 100;
  let base = pts >= 220 ? 7.5 : pts >= 150 ? 5.5 : 3.5;
  if (isWreck) base += 1.5;
  if (/bell|engine|anchor|bullion|safe|vault|recorder|core|torpedo|turbine|brass|cannon|helm|propeller/i.test(name)) {
    base += 3.0;
  }
  return Math.round(Math.min(12, base) * 10) / 10;
}

/**
 * Create initial lift-bag & salvage buoyancy state attached to a dive session.
 */
export function createSalvageState() {
  return {
    liftBagActive: false,
    inflateAnim: 0,
    payloadKg: 0,
    liftForceKg: 0,
    netTrimKg: 0,
    verticalAccel: 0,
    swimDragMult: 1.0,
    status: 'neutral',
    label: '',
    _floatWarnCd: 0,
    _heavyHintShown: false,
    _bubbleAccum: 0,
  };
}

/**
 * Pure computation of diver salvage weight, Boyle's Law lift-bag expansion, net trim, and vertical acceleration.
 */
export function computeSalvageBuoyancy(session) {
  if (!session?.diver || !session?.level) {
    return {
      payloadKg: 0,
      liftBagActive: false,
      liftForceKg: 0,
      netTrimKg: 0,
      verticalAccel: 0,
      swimDragMult: 1.0,
      status: 'neutral',
      label: '',
    };
  }

  const level = session.level;
  const diver = session.diver;
  const isWreck = Boolean(level.isWreck);
  const salvage = session.salvage || createSalvageState();

  // 1. Sum collected artifact salvage load
  let collectiblesKg = 0;
  if (session.collectedIds && session.collectedIds.size > 0 && Array.isArray(level.collectibles)) {
    for (let i = 0; i < level.collectibles.length; i++) {
      const c = level.collectibles[i];
      if (c && session.collectedIds.has(c.id)) {
        collectiblesKg += computeCollectibleWeightKg(c, isWreck);
      }
    }
  }

  // 2. Heavy recovery target (probe core / fallen diver) or live co-op buddy tow
  let recoveryKg = 0;
  if (session.carryingBody) {
    recoveryKg = level.recoveryTarget?.kind === 'probe' ? 18 : 16;
  }
  const towKg = session.rescueTargetId ? 14 : 0;

  const payloadKg = Math.round(Math.min(32, collectiblesKg + recoveryKg + towKg) * 10) / 10;
  const liftBagActive = Boolean(salvage.liftBagActive);
  const depthM = Math.max(0, Number(diver.y) || 0);

  // 3. Boyle's Law expansion: lift bag grows slightly more buoyant as hydrostatic pressure drops near surface
  let liftForceKg = 0;
  if (liftBagActive) {
    const shallowExpansion = 1 + Math.max(0, 1 - depthM / 55) * 0.26;
    const animFrac = Math.max(0.25, Math.min(1, salvage.inflateAnim || 1));
    // Auto-vent partial excess when carrying real salvage so neutral trim is comfortable,
    // while still creating authentic positive float when empty or rising shallow!
    const rawLift = LIFT_BAG_CAPACITY_KG * shallowExpansion * animFrac;
    liftForceKg = payloadKg >= 6 ? Math.min(rawLift, payloadKg + 2.2 * shallowExpansion) : rawLift * 0.68;
    liftForceKg = Math.round(liftForceKg * 10) / 10;
  }

  const netTrimKg = Math.round((payloadKg - liftForceKg) * 10) / 10;

  // Difficulty scaling (guided gentle, hardcore demands active lift-bag & trim discipline)
  const diffMult = session.difficulty === 'hardcore' ? 1.32 : session.difficulty === 'guided' ? 0.48 : 1.0;

  // No buoyancy pull at surface entry ladder (y <= 1.2m)
  let verticalAccel = 0;
  if (depthM > 1.2) {
    if (netTrimKg > 2.5) {
      // Negative buoyancy pulls downward (+vy)
      verticalAccel = Math.min(1.65, ((netTrimKg - 2.0) / 18) * 1.15 * diffMult);
    } else if (netTrimKg < -3.5) {
      // Positive float pulls upward (-vy)
      verticalAccel = -Math.min(1.45, ((Math.abs(netTrimKg) - 3.0) / 16) * 1.05 * diffMult);
    }
  }

  // Heavy uncompensated load slows finning slightly; lift bag restores full trim agility
  const uncompHeavy = Math.max(0, netTrimKg - 4);
  const swimDragMult = uncompHeavy > 0 ? Math.max(0.84, 1 - (uncompHeavy / 26) * 0.14 * diffMult) : 1.0;

  let status = 'neutral';
  let label = '';
  if (liftBagActive && netTrimKg < -5.0) {
    status = 'float-warn';
    label = `🎈 FLOAT +${Math.abs(Math.round(netTrimKg))}kg · VENT`;
  } else if (liftBagActive) {
    status = 'neutral';
    label = payloadKg > 0 ? `🎈 LIFT BAG · ${Math.round(payloadKg)}kg OK` : '🎈 LIFT BAG · OPEN';
  } else if (netTrimKg >= 14) {
    status = 'critical-heavy';
    label = `⚓ -${Math.round(netTrimKg)}kg HEAVY`;
  } else if (netTrimKg >= 6) {
    status = 'heavy';
    label = `⚓ -${Math.round(netTrimKg)}kg LOAD`;
  }

  return {
    payloadKg,
    liftBagActive,
    liftForceKg,
    netTrimKg,
    verticalAccel,
    swimDragMult,
    status,
    label,
  };
}

/**
 * Inflate or vent/stow the diver's commercial Lift Bag.
 * Inflating draws ~3.5 bar from the active cylinder; venting releases a rising bubble plume.
 */
export function toggleLiftBag(session, callbacks = {}) {
  if (!session?.diver || !session?.diveState || session.diveState.alive === false) {
    return { ok: false, reason: 'inactive' };
  }
  if (!session.salvage) session.salvage = createSalvageState();
  const s = session.salvage;

  if (s.liftBagActive) {
    s.liftBagActive = false;
    s.inflateAnim = 0;
    if (Array.isArray(session.bubbles)) {
      for (let i = 0; i < 12; i++) {
        spawnLiftBagBubble(
          session.bubbles,
          session.diver.x + (Math.random() - 0.5) * 0.55,
          session.diver.y - 1.1 - Math.random() * 0.4,
          (Math.random() - 0.5) * 0.7,
          -1.2 - Math.random() * 0.9,
          0.11 + Math.random() * 0.08
        );
      }
    }
    const buo = computeSalvageBuoyancy(session);
    Object.assign(s, buo);
    if (session.mechFx) {
      recordMechanicalEvent(session.mechFx, 'liftbag-vent', { x: session.diver.x, y: session.diver.y });
    }
    callbacks.onLiftBagToggle?.(false, buo);
    callbacks.onToast?.('🎈 Lift Bag vented & stowed.', 1.8);
    return { ok: true, active: false, buoyancy: buo };
  }

  const ds = session.diveState;
  const activeTank = ds.tanks?.[ds.activeGasId];
  if (!activeTank || activeTank.bar < 6) {
    callbacks.onToast?.('⚠️ Cylinder pressure too low to inflate Lift Bag!', 2.2);
    return { ok: false, reason: 'low-gas' };
  }

  // Deduct realistic small gas burst to fill lift bag
  const barRatio = Math.min(1, LIFT_BAG_INFLATE_BAR / Math.max(1, activeTank.bar));
  activeTank.bar = Math.max(0, activeTank.bar - LIFT_BAG_INFLATE_BAR);
  if (Number.isFinite(activeTank.litersRemaining)) {
    activeTank.litersRemaining = Math.max(0, activeTank.litersRemaining * (1 - barRatio));
  }

  s.liftBagActive = true;
  s.inflateAnim = 0.35;
  if (Array.isArray(session.bubbles)) {
    for (let i = 0; i < 8; i++) {
      spawnLiftBagBubble(
        session.bubbles,
        session.diver.x + (Math.random() - 0.5) * 0.35,
        session.diver.y - 0.8,
        (Math.random() - 0.5) * 0.4,
        -0.9 - Math.random() * 0.6,
        0.09 + Math.random() * 0.06
      );
    }
  }
  const buo = computeSalvageBuoyancy(session);
  Object.assign(s, buo);
  if (session.mechFx) {
    recordMechanicalEvent(session.mechFx, 'liftbag-inflate', { x: session.diver.x, y: session.diver.y });
  }
  callbacks.onLiftBagToggle?.(true, buo);
  const msg =
    buo.payloadKg >= 6
      ? `🎈 Lift Bag inflated (-${LIFT_BAG_INFLATE_BAR}b) — ${Math.round(buo.payloadKg)}kg salvage neutralized!`
      : `🎈 Lift Bag inflated (-${LIFT_BAG_INFLATE_BAR}b) — watch positive float!`;
  callbacks.onToast?.(msg, 2.5);
  return { ok: true, active: true, buoyancy: buo };
}

/**
 * Advance lift-bag animation, apply buoyancy vertical force to diver velocity & emit skirt bubbles.
 */
export function stepSalvageBuoyancy(session, dt, callbacks = {}) {
  if (!session?.diver || !session?.level) return null;
  if (!session.salvage) session.salvage = createSalvageState();
  const s = session.salvage;

  if (s.liftBagActive) {
    s.inflateAnim = Math.min(1, (s.inflateAnim || 0) + dt / 0.42);
  } else {
    s.inflateAnim = Math.max(0, (s.inflateAnim || 0) - dt / 0.25);
  }
  if (s._floatWarnCd > 0) s._floatWarnCd = Math.max(0, s._floatWarnCd - dt);

  const buo = computeSalvageBuoyancy(session);
  s.payloadKg = buo.payloadKg;
  s.liftForceKg = buo.liftForceKg;
  s.netTrimKg = buo.netTrimKg;
  s.verticalAccel = buo.verticalAccel;
  s.swimDragMult = buo.swimDragMult;
  s.status = buo.status;
  s.label = buo.label;

  // Apply buoyancy trim force underwater (unless clipped tightly to a shot line)
  if (!session.clippedToShotLine && buo.verticalAccel !== 0) {
    session.diver.vy += buo.verticalAccel * dt;
  }

  // Auto-stow lift bag gracefully upon reaching the surface boat ladder
  if (s.liftBagActive && session.diver.y <= 1.0) {
    s.liftBagActive = false;
    s.inflateAnim = 0;
  }

  // Emit occasional Boyle's-Law skirt dump bubbles when inflated & ascending
  if (s.liftBagActive && Array.isArray(session.bubbles)) {
    s._bubbleAccum = (s._bubbleAccum || 0) + dt * (session.diver.vy < -0.25 ? 3.2 : 1.0);
    if (s._bubbleAccum >= 0.45) {
      s._bubbleAccum = 0;
      spawnLiftBagBubble(
        session.bubbles,
        session.diver.x + (Math.random() - 0.5) * 0.28,
        session.diver.y - 1.35,
        (Math.random() - 0.5) * 0.25,
        -0.9 - Math.random() * 0.5,
        0.07 + Math.random() * 0.05
      );
    }
  }

  // One-time helpful hint when first weighed down by heavy salvage
  if (!s.liftBagActive && !s._heavyHintShown && buo.netTrimKg >= 10 && session.diver.y > 4) {
    s._heavyHintShown = true;
    callbacks.onToast?.(`⚓ Heavy salvage (-${Math.round(buo.netTrimKg)}kg) pulling trim down — deploy Lift Bag [Y] or Dive Kit!`, 3.2);
  }

  // Over-buoyant ascent caution if floating rapidly with empty bag
  if (buo.status === 'float-warn' && s._floatWarnCd <= 0 && session.diver.vy < -0.45 && session.diver.y > 4) {
    s._floatWarnCd = 7.5;
    callbacks.onToast?.('🎈 Positive Lift Bag float — press [Y] to vent before exceeding ascent limit!', 2.6);
  }

  return buo;
}
