import { getAscentConfig } from '../levels/index.js';
import { createDiveState, stepDivePhysiology } from '../physics/diveModel.js';
import { resolveDiverCollision, evaluateCaveSDF } from './collision.js';
import { createDiverBody, stepDiverBody, computeTargetSwimAngle } from './diverBody.js';
import { stirFloorSilt, spawnSiltPlume, stepSiltPhysics } from './silt.js';
import { buildExploreCells, markExploredAround, computeDiverScoreSummary } from './scoring.js';

/**
 * Create a self-contained dive simulation session for any registered level.
 */
export function createDiveSession(
  level,
  { diverName = 'Diver 1', spawnOffsetX = 0, spawnOffsetY = 0 } = {}
) {
  const spawnX = level.spawn.x + spawnOffsetX;
  const spawnY = level.spawn.y + spawnOffsetY;
  const exploreCells = buildExploreCells(level);
  const exploredCells = new Set();
  markExploredAround(exploreCells, exploredCells, spawnX, spawnY, 5.2);
  const exploredPct = Math.round((exploredCells.size / Math.max(1, exploreCells.length)) * 100);

  return {
    level,
    ascentConfig: getAscentConfig(level),
    diver: {
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      angle: 0.15,
      angVel: 0,
      torchOn: true,
      name: diverName,
      body: createDiverBody(spawnX, spawnY),
    },
    diveState: createDiveState({ mixOverrides: level.gasOverrides }),
    checkpointsHit: new Set(),
    collectedIds: new Set(),
    collectBursts: [],
    bodyRecovered: false,
    carryingBody: false,
    rescueTargetId: '',
    rescuedBy: '',
    rescued: false,
    recoveryWarnCooldown: 0,
    exploreCells,
    exploredCells,
    exploredPct,
    surfaced: false,
    siltClouds: [],
    siltStirTimer: { accum: 0, warnCooldown: 0 },
    hrWarnCooldown: 0,
    restrictWarnCooldown: 0,
    thirdWarned: false,
    stuckDuration: 0,
    reelMaxMeters: level.reelMetersPerDiver || 0,
    reelRemainingM: level.reelMetersPerDiver || 0,
    reelingActive: false,
    guidelineChains: [],
    localSiltDensity: 0,
    bubbles: [],
    bubbleTimer: 0,
    simTimeSec: 0,
  };
}

/**
 * Compute remaining reel meters minus any currently paid-out live tension wire.
 */
export function getEffectiveReelRemainingM(session) {
  if (!session || session.reelMaxMeters <= 0) return 0;
  let liveLen = 0;
  if (session.reelingActive && session.guidelineChains.length > 0) {
    const chain = session.guidelineChains[session.guidelineChains.length - 1];
    const last = chain[chain.length - 1];
    if (last) {
      liveLen = Math.hypot(session.diver.x - last.x, session.diver.y - last.y);
    }
  }
  return Math.max(0, session.reelRemainingM - liveLen);
}

/**
 * Start laying a deployable cave guideline from the diver's position, or tie off and stop reeling.
 */
export function toggleGuidelineReel(session) {
  if (!session || session.reelMaxMeters <= 0 || !session.diveState?.alive) {
    return { action: 'none' };
  }
  const { diver } = session;
  if (session.reelingActive) {
    session.reelingActive = false;
    const chain = session.guidelineChains[session.guidelineChains.length - 1];
    if (chain && chain.length > 0) {
      const last = chain[chain.length - 1];
      const dx = diver.x - last.x;
      const dy = diver.y - last.y;
      const segLen = Math.hypot(dx, dy);
      if (segLen >= 0.4) {
        const used = Math.min(segLen, session.reelRemainingM);
        const ratio = segLen > 0 ? used / segLen : 0;
        chain.push({ x: last.x + dx * ratio, y: last.y + dy * ratio });
        session.reelRemainingM = Math.max(0, session.reelRemainingM - used);
      } else if (chain.length < 2) {
        session.guidelineChains.pop();
      }
    }
    return { action: 'tie_off', chains: session.guidelineChains };
  }

  if (session.reelRemainingM < 1.2) {
    return { action: 'empty' };
  }
  session.guidelineChains.push([{ x: diver.x, y: diver.y }]);
  session.reelingActive = true;
  return { action: 'start_reel', chains: session.guidelineChains };
}

/**
 * Rewind the active wire or most recent laid guideline segment to recover reel meters.
 */
export function rewindGuidelineSegment(session) {
  if (!session || session.reelMaxMeters <= 0) return { action: 'none' };
  if (session.guidelineChains.length === 0) return { action: 'empty' };

  let targetIdx = session.guidelineChains.length - 1;
  let chain = session.guidelineChains[targetIdx];
  if (session.reelingActive) {
    session.reelingActive = false;
    if (chain.length <= 1) {
      session.guidelineChains.pop();
    }
    return { action: 'rewound', recoveredM: 0, chains: session.guidelineChains };
  }

  // Pick whichever chain tail is nearest to the diver so multi-branch lines rewind intuitively
  let distToTail = Infinity;
  for (let i = session.guidelineChains.length - 1; i >= 0; i--) {
    const ch = session.guidelineChains[i];
    const t = ch && ch[ch.length - 1];
    if (!t) continue;
    const d = Math.hypot(session.diver.x - t.x, session.diver.y - t.y);
    if (d < distToTail) {
      distToTail = d;
      targetIdx = i;
      chain = ch;
    }
  }
  if (distToTail > 14.0) {
    return { action: 'too_far', dist: distToTail };
  }

  let recoveredM = 0;
  if (chain.length >= 2) {
    const popped = chain.pop();
    const prev = chain[chain.length - 1];
    recoveredM = Math.hypot(popped.x - prev.x, popped.y - prev.y);
    session.reelRemainingM = Math.min(session.reelMaxMeters, session.reelRemainingM + recoveredM);
  }
  if (chain.length <= 1) {
    session.guidelineChains.splice(targetIdx, 1);
  }
  return { action: 'rewound', recoveredM, chains: session.guidelineChains };
}

/**
 * Emit wall-impact silt plumes along the rebound normal and return newly created clouds.
 */
export function emitImpactSilt(siltClouds, x, y, nx, ny, impactSpeed) {
  const count = impactSpeed > 2.4 ? 6 : 3;
  const spawned = [];
  for (let i = 0; i < count; i++) {
    const opts = {
      x: x + nx * 0.45 + (Math.random() - 0.5) * 0.9,
      y: y + ny * 0.45 + (Math.random() - 0.5) * 0.9,
      vx: -nx * (0.4 + Math.random() * 0.65) + (Math.random() - 0.5) * 0.5,
      vy: -ny * (0.4 + Math.random() * 0.6) - 0.25,
      radius: 0.95 + Math.random() * 0.75,
      maxRadius: 3.4 + Math.random() * 1.2,
      life: 24.0 + Math.random() * 6.0,
      peakAlpha: 0.85,
    };
    const cloud = spawnSiltPlume(siltClouds, opts);
    if (cloud) spawned.push(cloud);
  }
  return spawned;
}

function stepBubbles(session, dt, callbacks = {}, exertion = 0) {
  const { diver, bubbles } = session;
  session.bubbleTimer -= dt;
  if (session.bubbleTimer <= 0 && diver.y > 0.6) {
    session.bubbleTimer = Math.max(0.18, 0.34 - Math.min(0.14, exertion * 0.1) + Math.random() * 0.18);
    callbacks.onExhale?.(exertion);
    const faceSign = diver.body?.facingSign ?? (Math.cos(diver.angle) >= 0 ? 1 : -1);
    const mouthX = diver.x + Math.cos(diver.angle) * 0.52 + Math.sin(diver.angle) * faceSign * 0.08;
    const mouthY = diver.y + Math.sin(diver.angle) * 0.52 - Math.cos(diver.angle) * faceSign * 0.08;
    for (let i = 0; i < 2; i++) {
      bubbles.push({
        x: mouthX + (Math.random() - 0.5) * 0.14,
        y: mouthY + (Math.random() - 0.5) * 0.14,
        vy: -1.6 - Math.random() * 0.8,
        vx: (Math.random() - 0.5) * 0.25,
        r: 0.055 + Math.random() * 0.055,
        life: 3.5,
      });
    }
  }

  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.y <= 0.1) bubbles.splice(i, 1);
  }
}

/**
 * Advance diver propulsion, collisions, silt clouds, physiology, checkpoints, and exit state by dt seconds.
 */
export function stepDiveSession(session, thrust, dt, callbacks = {}) {
  const { level, ascentConfig, diver, diveState, checkpointsHit, siltClouds, siltStirTimer } = session;
  session.simTimeSec += dt;
  const imp = diveState.impairment || { swimMultiplier: 1, sacMultiplier: 1, tremor: 0 };
  const exertion = Math.min(1.4, Math.hypot(thrust.x, thrust.y) * 0.65 * imp.sacMultiplier);

  // Progressive narcosis sluggishness & O2 tox / stress tremor before acute failure
  let ctrlX = thrust.x;
  let ctrlY = thrust.y;
  if (diveState.narcosisLevel > 0.15) {
    const sway = Math.sin(session.simTimeSec * 2.4) * diveState.narcosisLevel * 0.28;
    ctrlX += sway;
    ctrlY -= sway * 0.55;
  }
  if (imp.tremor > 0.12) {
    ctrlX += (Math.random() - 0.5) * imp.tremor * 0.45;
    ctrlY += (Math.random() - 0.5) * imp.tremor * 0.45;
  }

  const thrustMag = Math.min(1, Math.hypot(ctrlX, ctrlY));
  const kickPulse = thrustMag > 0.1 && diver.body ? 0.68 + 0.72 * diver.body.kickSurge : 1.0;
  const towDrag = session.carryingBody || session.rescueTargetId ? 0.9 : 1.0;
  const swimMult = (imp.swimMultiplier ?? 1) * towDrag;
  const horizAccel = 6.2 * kickPulse * swimMult;
  const vertAccel = (ctrlY < 0 ? 4.1 : 5.3) * kickPulse * swimMult;
  diver.vx += ctrlX * horizAccel * dt;
  diver.vy += ctrlY * vertAccel * dt;

  // Subtle neutral-buoyancy breathing hover & deep-restriction karst siphon micro-current
  diver.vy += Math.sin(session.simTimeSec * 1.6) * 0.16 * dt;
  const clearanceM = -evaluateCaveSDF(level, diver.x, diver.y);
  if (diver.y > 10.5 && clearanceM > 0.5 && clearanceM < 2.2) {
    const squeezeRatio = 1 - Math.max(0, clearanceM - 0.5) / 1.7;
    const flowPhase = Math.sin(diver.x * 0.14 + session.simTimeSec * 0.85);
    diver.vx += flowPhase * 0.26 * squeezeRatio * dt;
    diver.vy += Math.cos(diver.x * 0.1 + session.simTimeSec * 0.6) * 0.12 * squeezeRatio * dt;
  }

  // Geothermal hydrothermal vent updraft columns (buoyant warm thermal chimneys)
  if (Array.isArray(level.geothermalVents)) {
    for (let v = 0; v < level.geothermalVents.length; v++) {
      const vent = level.geothermalVents[v];
      const hw = vent.halfWidth || 2.8;
      const vh = vent.height || 14;
      const dx = Math.abs(diver.x - vent.x);
      if (dx <= hw && diver.y <= vent.y && diver.y >= vent.y - vh) {
        const horizFalloff = 1 - dx / hw;
        const vertFalloff = 1 - (vent.y - diver.y) / (vh * 1.15);
        const lift = (vent.strength ?? vent.updraft ?? 2.8) * Math.max(0.18, horizFalloff * vertFalloff);
        diver.vy -= lift * dt;
        diver.vx += Math.sin(session.simTimeSec * 2.2 + v + diver.y * 0.3) * 0.24 * horizFalloff * dt;
      }
    }
  }

  // Tight cave restriction wash penalty if thrusting aggressively in narrow squeezes
  if (session.restrictWarnCooldown > 0) session.restrictWarnCooldown -= dt;
  if (clearanceM > 0 && clearanceM < 1.5 && diver.y > 6 && thrustMag > 0.72 && siltClouds.length < 130) {
    if (Math.random() < dt * 2.2) {
      const cloud = spawnSiltPlume(siltClouds, {
        x: diver.x - Math.cos(diver.angle) * 0.45,
        y: diver.y - Math.sin(diver.angle) * 0.45,
        vx: -diver.vx * 0.35 + (Math.random() - 0.5) * 0.4,
        vy: -0.25,
        radius: 0.75,
        maxRadius: 2.8,
        life: 16,
        peakAlpha: 0.62,
      });
      if (cloud) callbacks.onSiltSpawn?.(cloud);
    }
    if (session.restrictWarnCooldown <= 0) {
      session.restrictWarnCooldown = 7.0;
      callbacks.onToast?.('Tight restriction — fin gently to keep tunnel clear!', 2.4);
    }
  }

  // Gentle auto-buoyancy hover assist at ANY active deco stop depth (5.4m for 6m O2 stops for safe PPO2 1.54)
  if (diveState.stopDepthM > 0 && thrustMag < 0.15) {
    const hoverTargetY = diveState.stopDepthM <= 6 ? 5.4 : diveState.stopDepthM - 0.35;
    if (Math.abs(diver.y - hoverTargetY) < 1.5) {
      diver.vy += (hoverTargetY - diver.y) * 1.85 * dt;
      diver.vy *= Math.exp(-3.2 * dt);
    }
  }

  // Hydrodynamic anisotropic drag (glides smoothly along body axis, resists sideways drift)
  const fx = Math.cos(diver.angle);
  const fy = Math.sin(diver.angle);
  const vForward = diver.vx * fx + diver.vy * fy;
  const vSide = -diver.vx * fy + diver.vy * fx;
  const forwardDrag = Math.exp(-1.9 * dt);
  const sideDrag = Math.exp(-3.8 * dt);
  const newForward = vForward * forwardDrag;
  const newSide = vSide * sideDrag;
  diver.vx = fx * newForward - fy * newSide;
  diver.vy = fy * newForward + fx * newSide;

  const prevX = diver.x;
  const prevDepthM = Math.max(0, diver.y);
  diver.x += diver.vx * dt;
  diver.y += diver.vy * dt;

  // Spring-damped rotational inertia toward swim direction / horizontal trim
  const targetAng = computeTargetSwimAngle(diver, ctrlX, ctrlY);
  let diff = targetAng - diver.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turnStiffness = thrustMag > 0.1 ? 18 : 5;
  diver.angVel = (diver.angVel + diff * turnStiffness * dt) * Math.exp(-6.5 * dt);
  diver.angle += diver.angVel * dt;

  // Cave Wall Collision & Floor/Impact Silt-Out + Stuck / Head-Bump Stress Detection
  const hit = resolveDiverCollision(level, diver, 0.52);
  stepDiverBody(diver, dt, { thrustMag, level });

  const netSpeed = dt > 0 ? Math.hypot(diver.x - prevX, diver.y - prevDepthM) / dt : 0;
  const pushingAgainstRock = hit.collided && thrustMag > 0.2 && netSpeed < 1.25 * thrustMag;
  if (pushingAgainstRock) {
    session.stuckDuration = Math.min(6, (session.stuckDuration || 0) + dt);
  } else {
    session.stuckDuration = Math.max(0, (session.stuckDuration || 0) - dt * 2.5);
  }
  const isStuck = pushingAgainstRock || (session.stuckDuration > 0.25 && thrustMag > 0.15);

  let headBumpImpulse = 0;
  if (hit.collided && hit.impactSpeed > 0.85) {
    // Ceiling/overhead rock bump spikes adrenaline extra hard
    headBumpImpulse = hit.impactSpeed * (hit.ny < -0.25 ? 1.4 : 1.0);
  }

  if (siltStirTimer.warnCooldown > 0) siltStirTimer.warnCooldown -= dt;
  const heavyWash = stirFloorSilt(level, diver, siltClouds, {
    dt,
    thrustMag,
    timerState: siltStirTimer,
    onSpawn: callbacks.onSiltSpawn,
  });
  if (heavyWash && siltStirTimer.warnCooldown <= 0) {
    siltStirTimer.warnCooldown = 5.5;
    callbacks.onToast?.('Fin wash stirring floor silt! Lift off the bottom for visibility.', 2.2);
  }

  if (hit.collided && hit.impactSpeed > 1.1) {
    callbacks.onImpactSound?.(hit.impactSpeed);
    const spawned = emitImpactSilt(siltClouds, diver.x, diver.y, hit.nx, hit.ny, hit.impactSpeed);
    if (spawned.length > 0) {
      callbacks.onSiltSpawn?.(spawned[0]);
    }
    if (hit.impactSpeed > 2.4 && siltStirTimer.warnCooldown <= 0) {
      siltStirTimer.warnCooldown = 4.5;
      callbacks.onToast?.('Cave impact! Dense silt cloud reducing visibility.', 2.4);
    }
  }

  // Step physiology & dive computer (including HR & gas-burn coupling)
  stepDivePhysiology(diveState, {
    depthM: Math.max(0, diver.y),
    prevDepthM,
    dt,
    exertion,
    headBumpImpulse,
    isStuck,
    thrustMag,
  });

  if (session.hrWarnCooldown > 0) session.hrWarnCooldown -= dt;
  if (diveState.heartRateBpm >= 145 && session.hrWarnCooldown <= 0) {
    session.hrWarnCooldown = 6.5;
    callbacks.onToast?.('Heart rate spiking! Stop swimming & calm down to conserve gas.', 3.0);
  }

  const curDepthM = Math.max(0, diver.y);
  const ascendingPhase = checkpointsHit.has(ascentConfig.turnaroundId);

  // Early descent gas-switch coaching (well before 33.7m EAN32 MOD / 40m acute O2 toxicity)
  if (curDepthM < 16.0) {
    session.tmxSwitchWarned = false;
    session.tmxDangerWarned = false;
  } else if (!ascendingPhase && diveState.activeGasId === 'EAN32' && diveState.tanks?.TMX1455?.bar > 1) {
    const deepMixName = diveState.mixes?.TMX1455?.name || 'TMX 14/55';
    if (!session.tmxSwitchWarned && curDepthM >= 21.0) {
      session.tmxSwitchWarned = true;
      callbacks.onAlarm?.('warn');
      callbacks.onToast?.(`⛔ STOP at 22m! Switch to ${deepMixName} [2] before descending deeper!`, 4.2);
    } else if (!session.tmxDangerWarned && curDepthM >= 27.5) {
      session.tmxDangerWarned = true;
      callbacks.onAlarm?.('critical');
      callbacks.onToast?.(`⚠️ DANGER at ${Math.round(curDepthM)}m on EAN32! Tap ${deepMixName} [2] NOW!`, 4.2);
    }
  }

  if (!session.thirdWarned && diver.y > 8 && !ascendingPhase) {
    const activeTank = diveState.tanks?.[diveState.activeGasId];
    if (activeTank && diveState.activeGasId !== 'O2' && activeTank.bar <= 133) {
      session.thirdWarned = true;
      callbacks.onToast?.(`Rule of Thirds (${Math.round(activeTank.bar)} bar on ${diveState.activeGasId}) — verify return reserve!`, 3.2);
    }
  }

  if (diveState.criticalAlarm) {
    callbacks.onAlarm?.('critical');
  } else if (diveState.warnings.length > 0) {
    callbacks.onAlarm?.('warn');
  }

  // Checkpoints
  for (const cp of level.checkpoints) {
    if (!checkpointsHit.has(cp.id) && Math.hypot(diver.x - cp.x, diver.y - cp.y) <= cp.radius) {
      checkpointsHit.add(cp.id);
      callbacks.onCheckpoint?.(cp);
    }
  }

  // Optional Fallen Diver Recovery Mission Target (e.g. Level 13 115m Abyss)
  const rt = level.recoveryTarget;
  if (rt && !session.bodyRecovered && Math.hypot(diver.x - rt.x, diver.y - rt.y) <= (rt.radius || 3.8)) {
    session.bodyRecovered = true;
    session.carryingBody = true;
    session.collectBursts.push({
      x: rt.x,
      y: rt.y,
      points: rt.points || 1500,
      kind: 'recovery',
      age: 0,
      duration: 1.8,
    });
    callbacks.onBodyRecovered?.(rt);
  }

  // Cave exploration grid completeness (shared vision/light sweep, movement-gated to avoid 60Hz O(cells) scans)
  if (session.exploreCells && session.exploredCells) {
    const dxExp = diver.x - (session._lastExploreX ?? -9999);
    const dyExp = diver.y - (session._lastExploreY ?? -9999);
    if (dxExp * dxExp + dyExp * dyExp >= 1.0) {
      session._lastExploreX = diver.x;
      session._lastExploreY = diver.y;
      if (markExploredAround(session.exploreCells, session.exploredCells, diver.x, diver.y, 4.4) > 0) {
        session.exploredPct = Math.round(
          (session.exploredCells.size / Math.max(1, session.exploreCells.length)) * 100
        );
      }
    }
  }

  // Cave collectibles pickup & burst popup particles
  const collectibles = level.collectibles || [];
  for (const item of collectibles) {
    const pickupR = Number.isFinite(item.radius) ? item.radius : 1.35;
    if (!session.collectedIds.has(item.id) && Math.hypot(diver.x - item.x, diver.y - item.y) <= pickupR) {
      session.collectedIds.add(item.id);
      session.collectBursts.push({
        x: item.x,
        y: item.y,
        points: item.points || 200,
        kind: item.kind || 'crystal',
        age: 0,
        duration: 1.35,
      });
      callbacks.onCollect?.(item);
    }
  }
  if (session.collectBursts && session.collectBursts.length > 0) {
    for (let i = session.collectBursts.length - 1; i >= 0; i--) {
      session.collectBursts[i].age += dt;
      if (session.collectBursts[i].age >= session.collectBursts[i].duration) {
        session.collectBursts.splice(i, 1);
      }
    }
  }

  // Auto-commit deployable guideline reel vertices every 4.2m while reeling
  if (session.reelingActive && session.guidelineChains.length > 0) {
    const chain = session.guidelineChains[session.guidelineChains.length - 1];
    const last = chain[chain.length - 1];
    if (last) {
      const dx = diver.x - last.x;
      const dy = diver.y - last.y;
      const segLen = Math.hypot(dx, dy);
      if (segLen >= session.reelRemainingM && session.reelRemainingM > 0) {
        const ratio = segLen > 0 ? session.reelRemainingM / segLen : 0;
        chain.push({ x: last.x + dx * ratio, y: last.y + dy * ratio });
        session.reelRemainingM = 0;
        session.reelingActive = false;
        callbacks.onToast?.('Guideline spool empty! End anchor set.', 2.8);
        callbacks.onGuidelineSync?.(session.guidelineChains);
      } else if (segLen >= 4.2 || (segLen >= 1.6 && evaluateCaveSDF(level, (last.x + diver.x) * 0.5, (last.y + diver.y) * 0.5) > -0.55)) {
        chain.push({ x: diver.x, y: diver.y });
        session.reelRemainingM = Math.max(0, session.reelRemainingM - segLen);
        callbacks.onGuidelineSync?.(session.guidelineChains);
      }
    }
  }

  stepBubbles(session, dt, callbacks, exertion);
  session.localSiltDensity = stepSiltPhysics(level, siltClouds, diver, dt);

  const nextCheckpoint = level.checkpoints.find((cp) => !checkpointsHit.has(cp.id)) || null;
  const buildSummary = () =>
    computeDiverScoreSummary({
      name: diver.name,
      level,
      diveState,
      checkpointsHit,
      collectedIds: session.collectedIds,
      exploredCount: session.exploredCells?.size || 0,
      totalExploreCells: session.exploreCells?.length || 1,
      diveTimeSec: diveState.diveTimeSec,
    });

  if (!diveState.alive) {
    return {
      nextCheckpoint,
      outcome: {
        success: false,
        title: diveState.causeOfFailure,
        detail: diveState.failureDetail,
        scoreSummary: buildSummary(),
      },
      blockedExitDecoDepthM: 0,
    };
  }

  if (session.recoveryWarnCooldown > 0) session.recoveryWarnCooldown -= dt;
  const allHit = checkpointsHit.size === level.checkpoints.length;
  const inExit = Math.hypot(diver.x - level.exitZone.x, diver.y - level.exitZone.y) <= level.exitZone.radius;
  if (inExit && diver.y <= 1.2 && level.recoveryTarget && !session.bodyRecovered) {
    if (session.recoveryWarnCooldown <= 0) {
      session.recoveryWarnCooldown = 3.5;
      callbacks.onToast?.(`Mission incomplete! Recover ${level.recoveryTarget.name} at ${Math.round(level.recoveryTarget.y)}m first.`, 3.2);
    }
  } else if (inExit && diver.y <= 1.2 && !allHit) {
    if (session.recoveryWarnCooldown <= 0) {
      session.recoveryWarnCooldown = 3.5;
      const missedCp = level.checkpoints.find((c) => !checkpointsHit.has(c.id));
      const cpDetail = missedCp ? `${missedCp.name} (${Math.round(missedCp.y)}m)` : 'remaining checkpoint';
      callbacks.onToast?.(`Exit blocked (${checkpointsHit.size}/${level.checkpoints.length})! Tag ${cpDetail} first.`, 3.5);
    }
  }
  const recoveryReady = !level.recoveryTarget || session.bodyRecovered;
  if (allHit && recoveryReady && inExit && diver.y <= 1.2) {
    if (diveState.ceilingM > 0.6) {
      return {
        nextCheckpoint,
        outcome: null,
        blockedExitDecoDepthM: diveState.stopDepthM,
      };
    }
    session.surfaced = true;
    return {
      nextCheckpoint,
      outcome: {
        success: true,
        title: level.recoveryTarget ? `${level.recoveryTarget.name} Recovered!` : `${level.name} Traversed!`,
        detail: level.recoveryTarget
          ? level.recoveryTarget.kind === 'probe'
            ? `You reached ${Math.round(level.recoveryTarget.y)}m beneath the aurora, recovered ${level.recoveryTarget.name}, rode geothermal updrafts through Trimix & O2 deco, and surfaced safely.`
            : `You reached ${Math.round(level.recoveryTarget.y)}m, secured ${level.recoveryTarget.name} on tow, completed deep trimix & oxygen decompression, and brought them home to the surface.`
          : 'You managed trimix bottom gas, avoided silt-outs, completed your oxygen decompression stop, and surfaced safely.',
        scoreSummary: buildSummary(),
      },
      blockedExitDecoDepthM: 0,
    };
  }

  return { nextCheckpoint, outcome: null, blockedExitDecoDepthM: 0 };
}
