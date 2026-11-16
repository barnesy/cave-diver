import { evaluateCaveSDF, evaluateCaveNormal } from './collision.js';

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function makeJoint(x, y) {
  return { x, y, vx: 0, vy: 0 };
}

/**
 * Creates an articulated physics body anchored to a diver's torso (x, y, angle).
 */
export function createDiverBody(x, y, angle = 0) {
  const bx = -Math.cos(angle);
  const by = -Math.sin(angle);
  const facing = Math.cos(angle) >= 0 ? 1 : -1;
  const ux = Math.sin(angle) * facing;
  const uy = -Math.cos(angle) * facing;

  return {
    kickPhase: 0,
    kickPower: 0,
    kickSurge: 0, // 0..1 forward thrust surge produced during frog-kick power snap
    facingSign: facing,
    rollVisual: facing,
    breathPhase: 0,
    pelvis: makeJoint(x + bx * 0.42, y + by * 0.42),
    legs: [
      {
        knee: makeJoint(x + bx * 0.78 - ux * 0.04, y + by * 0.78 - uy * 0.04),
        ankle: makeJoint(x + bx * 1.06 + ux * 0.16, y + by * 1.06 + uy * 0.16),
        finTip: makeJoint(x + bx * 1.48 + ux * 0.14, y + by * 1.48 + uy * 0.14),
        finOpen: 0.55,
      },
      {
        knee: makeJoint(x + bx * 0.78 + ux * 0.03, y + by * 0.78 + uy * 0.03),
        ankle: makeJoint(x + bx * 1.06 + ux * 0.21, y + by * 1.06 + uy * 0.21),
        finTip: makeJoint(x + bx * 1.48 + ux * 0.19, y + by * 1.48 + uy * 0.19),
        finOpen: 0.55,
      },
    ],
    hand: makeJoint(x + Math.cos(angle) * 0.48 - ux * 0.18, y + Math.sin(angle) * 0.48 - uy * 0.18),
  };
}

function constrainJoint(
  parent,
  child,
  targetX,
  targetY,
  length,
  springK,
  dt,
  level,
  radius = 0.14,
  minBackDir = null,
  upDir = null
) {
  const fx = (targetX - child.x) * springK;
  const fy = (targetY - child.y) * springK;
  child.vx = (child.vx + fx * dt) * Math.exp(-10.5 * dt);
  child.vy = (child.vy + fy * dt) * Math.exp(-10.5 * dt);

  child.x += child.vx * dt;
  child.y += child.vy * dt;

  // Blend angle around parent directly toward target so sharp 180° turns never lock joints backwards
  const curAng = Math.atan2(child.y - parent.y, child.x - parent.x);
  const tarAng = Math.atan2(targetY - parent.y, targetX - parent.x);
  const angErr = normalizeAngle(tarAng - curAng);
  const followAlpha = Math.min(1, dt * (springK * 0.42));
  const newAng = curAng + angErr * followAlpha;

  let dirX = Math.cos(newAng);
  let dirY = Math.sin(newAng);

  const clampDirection = () => {
    if (!minBackDir) return;
    const dot = dirX * minBackDir.x + dirY * minBackDir.y;
    if (dot < minBackDir.minDot) {
      const clampedUp = Math.sqrt(Math.max(0, 1 - minBackDir.minDot * minBackDir.minDot));
      if (upDir) {
        const side = dirX * upDir.x + dirY * upDir.y;
        const sign = side >= 0 ? 1 : -1;
        dirX = minBackDir.x * minBackDir.minDot + upDir.x * clampedUp * sign;
        dirY = minBackDir.y * minBackDir.minDot + upDir.y * clampedUp * sign;
      } else {
        const tx = targetX - parent.x;
        const ty = targetY - parent.y;
        const tLen = Math.hypot(tx, ty) || 1;
        dirX = tx / tLen;
        dirY = ty / tLen;
      }
      child.vx = 0;
      child.vy = 0;
    }
  };

  clampDirection();
  child.x = parent.x + dirX * length;
  child.y = parent.y + dirY * length;

  if (child.y < 0.18) {
    child.y = 0.18;
    if (child.vy < 0) child.vy = 0;
  }
  if (level) {
    const sdf = evaluateCaveSDF(level, child.x, child.y);
    if (sdf + radius > 0) {
      const n = evaluateCaveNormal(level, child.x, child.y);
      const pen = sdf + radius;
      child.x -= n.nx * pen;
      child.y -= n.ny * pen;
      const rdx = child.x - parent.x;
      const rdy = child.y - parent.y;
      const rdist = Math.hypot(rdx, rdy) || 1e-4;
      dirX = rdx / rdist;
      dirY = rdy / rdist;
      clampDirection();
      child.x = parent.x + dirX * length;
      child.y = parent.y + dirY * length;
    }
  }
}

/**
 * Advances articulated limbs with a cave-diver frog kick cycle and wall deflection.
 */
export function stepDiverBody(diver, dt, { thrustMag = 0, level = null } = {}) {
  if (!diver.body) {
    diver.body = createDiverBody(diver.x, diver.y, diver.angle);
  }
  const body = diver.body;
  const speed = Math.hypot(diver.vx || 0, diver.vy || 0);

  const cosA = Math.cos(diver.angle);
  if (Math.abs(cosA) > 0.15) {
    body.facingSign = cosA >= 0 ? 1 : -1;
  }
  body.rollVisual += (body.facingSign - body.rollVisual) * Math.min(1, dt * 10);

  // Frog kick cadence: built directly into swimming; settles into trim glide when coasting
  const targetPower = clamp(thrustMag * 1.12 + speed * 0.08, 0, 1.25);
  body.kickPower += (targetPower - body.kickPower) * Math.min(1, dt * 5.5);

  const cycleSpeed = body.kickPower > 0.08 ? 0.95 + body.kickPower * 0.85 : 0.25;
  body.kickPhase = (body.kickPhase + cycleSpeed * dt) % 1.0;
  body.breathPhase += dt * 1.4;

  // Frog kick envelope over normalized cycle u in [0, 1)
  const u = body.kickPhase;
  const p = clamp(body.kickPower, 0, 1.15);

  // 0.00..0.38: glide | 0.38..0.68: draw heels up (recovery) | 0.68..0.92: power sweep & snap | 0.92..1.00: settle
  const recoveryAmt = (smoothstep(0.35, 0.62, u) * (1 - smoothstep(0.68, 0.86, u))) * p;
  const sweepSpread = (smoothstep(0.56, 0.74, u) * (1 - smoothstep(0.84, 0.97, u))) * p;
  const powerSnap = (smoothstep(0.66, 0.82, u) * (1 - smoothstep(0.86, 0.99, u))) * p;

  body.kickSurge = powerSnap;

  const fx = Math.cos(diver.angle);
  const fy = Math.sin(diver.angle);
  const upSign = body.facingSign;
  const ux = fy * upSign;
  const uy = -fx * upSign;
  const pelvisGuard = { x: -fx, y: -fy, minDot: 0.78 };
  const calfGuard = { x: -fx, y: -fy, minDot: 0.45 };
  const finGuard = { x: -fx, y: -fy, minDot: 0.91 };
  const upVec = { x: ux, y: uy };

  // 1. Pelvis trails behind shoulders in flat cave trim
  const torsoAnchor = { x: diver.x, y: diver.y };
  const targetPelvisX = diver.x - fx * 0.42 + ux * 0.03;
  const targetPelvisY = diver.y - fy * 0.42 + uy * 0.03;
  constrainJoint(torsoAnchor, body.pelvis, targetPelvisX, targetPelvisY, 0.42, 56, dt, level, 0.26, pelvisGuard, upVec);

  // 2. Frog-kick legs (symmetrical in horizontal plane; staggered vertically in 2D side-view)
  for (let i = 0; i < 2; i++) {
    const leg = body.legs[i];
    const sideSign = i === 0 ? -1 : 1; // -1 = near/lower leg, +1 = far/upper leg

    // Base high-heel cave trim: thighs straight back, knees bent upward so fins never drag silt
    const kneeBack = 0.37 - recoveryAmt * 0.05;
    const kneeUp = 0.01 + sideSign * (0.035 + sweepSpread * 0.10) - recoveryAmt * 0.02;
    const kneeTargetX = body.pelvis.x - fx * kneeBack + ux * kneeUp;
    const kneeTargetY = body.pelvis.y - fy * kneeBack + uy * kneeUp;
    constrainJoint(body.pelvis, leg.knee, kneeTargetX, kneeTargetY, 0.38, 52, dt, level, 0.15, pelvisGuard, upVec);

    // Calf lifts gently in recovery and extends streamlined in power snap
    const calfBack = 0.31 - recoveryAmt * 0.08 + powerSnap * 0.05;
    const calfUp = 0.13 + recoveryAmt * 0.09 + sideSign * (0.03 + sweepSpread * 0.11) - powerSnap * 0.06;
    const ankleTargetX = leg.knee.x - fx * calfBack + ux * calfUp;
    const ankleTargetY = leg.knee.y - fy * calfBack + uy * calfUp;
    constrainJoint(leg.knee, leg.ankle, ankleTargetX, ankleTargetY, 0.36, 48, dt, level, 0.13, calfGuard, upVec);

    // Fin trails smoothly behind ankle aligned with swim direction
    const finBack = 0.42;
    const finPitch = (recoveryAmt * 0.04 - powerSnap * 0.06) + sideSign * sweepSpread * 0.05;
    const finTargetX = leg.ankle.x - fx * finBack + ux * finPitch;
    const finTargetY = leg.ankle.y - fy * finBack + uy * finPitch;
    constrainJoint(leg.ankle, leg.finTip, finTargetX, finTargetY, 0.42, 54, dt, level, 0.09, finGuard, upVec);

    // Blade feathering: thin edge-on during recovery, wide cupped paddle during power snap
    const targetOpen = clamp(0.55 - recoveryAmt * 0.32 + powerSnap * 0.55, 0.22, 1.1);
    leg.finOpen += (targetOpen - leg.finOpen) * Math.min(1, dt * 12);
  }

  // 3. Torch hand floats naturally ahead/below chest with subtle breathing sway
  const breath = Math.sin(body.breathPhase) * 0.025;
  const targetHandX = diver.x + fx * 0.48 - ux * (0.19 + breath);
  const targetHandY = diver.y + fy * 0.48 - uy * (0.19 + breath);
  constrainJoint(torsoAnchor, body.hand, targetHandX, targetHandY, 0.52, 52, dt, level, 0.14);
}

/**
 * Computes natural swim angle from velocity & thrust with horizontal trim bias.
 */
export function computeTargetSwimAngle(diver, thrustX, thrustY) {
  const vx = diver.vx || 0;
  const vy = diver.vy || 0;
  const speed = Math.hypot(vx, vy);
  const tMag = Math.hypot(thrustX, thrustY);

  if (tMag > 0.15) {
    const bx = thrustX * 0.65 + (vx / Math.max(1, speed)) * 0.35;
    const by = thrustY * 0.65 + (vy / Math.max(1, speed)) * 0.35;
    return Math.atan2(by, bx);
  }

  if (speed > 0.25) {
    return Math.atan2(vy, vx);
  }

  const facingRight = Math.cos(diver.angle) >= 0;
  const flatAngle = facingRight ? 0 : Math.PI;
  const diff = normalizeAngle(flatAngle - diver.angle);
  return diver.angle + diff * 0.25;
}
