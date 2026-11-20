import { getAscentConfig } from '../levels/index.js';
import { createDiveState, stepDivePhysiology } from '../physics/diveModel.js';
import { resolveDiverCollision, evaluateCaveSDF, evaluateCaveNormal } from './collision.js';
import { createDiverBody, stepDiverBody, computeTargetSwimAngle } from './diverBody.js';
import { stirFloorSilt, spawnSiltPlume, stepSiltPhysics } from './silt.js';
import { buildExploreCells, markExploredAround, computeDiverScoreSummary } from './scoring.js';

const MAX_BUBBLES = 240;
const _bubbleNormalScratch = { nx: 0, ny: -1 };

/**
 * Compute realistic scuba breathing cadence & intensity from heart rate, panic, stress, and exertion.
 * Calm divers breathe slowly (~10.5 breaths/min with a relaxed pause); elevated HR or panic accelerates
 * into rapid, high-volume gasps (~28-40 breaths/min) with minimal rest between breaths.
 */
export function computeBreathProfile(diveState, exertion = 0) {
  const hrBpm = diveState?.heartRateBpm ?? 68;
  const panicLevel = diveState?.panicLevel ?? 0;
  const hypoxiaStress = diveState?.hypoxiaStress ?? 0;
  const dcsStress = diveState?.dcsStress ?? 0;
  const cardiacStress = diveState?.cardiacStress ?? 0;

  const hrNorm = Math.max(0, Math.min(1, (hrBpm - 65) / 115));
  const panicStress = Math.max(
    0,
    Math.min(1, Math.max(panicLevel, hypoxiaStress / 75, dcsStress / 115, cardiacStress / 90))
  );
  const exNorm = Math.max(0, Math.min(1.2, exertion));
  const drive = Math.max(0, Math.min(1.35, hrNorm * 0.62 + panicStress * 0.56 + exNorm * 0.24));
  const clampedDrive = Math.min(1, drive);

  // Calm: ~10.5 BPM (5.7s cycle) -> Hard finning: ~18 BPM -> Elevated HR/panic: 26-39 BPM (1.5-2.3s cycle)
  const breathsPerMin = 10.5 + drive * 21.5;
  const cycleSec = 60 / breathsPerMin;

  // Phase boundaries over [0, 1): inhale -> brief hold -> exhale -> end-expiratory rest
  const inhaleEnd = 0.27 + clampedDrive * 0.08;
  const holdDur = 0.08 - clampedDrive * 0.06;
  const holdEnd = inhaleEnd + holdDur;
  const exhaleDur = 0.42 + clampedDrive * 0.12;
  const exhaleEnd = Math.min(0.95, holdEnd + exhaleDur);

  const intensity = Math.max(0.32, Math.min(1.4, 0.35 + drive * 0.78));

  return {
    breathsPerMin,
    cycleSec,
    inhaleEnd,
    holdEnd,
    exhaleEnd,
    inhaleSec: cycleSec * inhaleEnd,
    exhaleSec: cycleSec * (exhaleEnd - holdEnd),
    intensity,
    drive,
    panic: panicStress,
    hrBpm,
  };
}

/**
 * Create a self-contained dive simulation session for any registered level.
 */
export function createDiveSession(
  level,
  { diverName = 'Diver 1', spawnOffsetX = 0, spawnOffsetY = 0, difficulty = 'standard' } = {}
) {
  const spawnX = level.spawn.x + spawnOffsetX;
  const spawnY = level.spawn.y + spawnOffsetY;
  const exploreCells = buildExploreCells(level);
  const exploredCells = new Set();
  markExploredAround(exploreCells, exploredCells, spawnX, spawnY, 5.2);
  const exploredPct = Math.round((exploredCells.size / Math.max(1, exploreCells.length)) * 100);
  const cleanDiff = difficulty === 'guided' || difficulty === 'hardcore' ? difficulty : 'standard';

  return {
    level,
    difficulty: cleanDiff,
    ascentConfig: getAscentConfig(level),
    diver: {
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      angle: 0.15,
      angVel: 0,
      torchAngle: 0.15,
      torchManualAim: false,
      torchOn: true,
      name: diverName,
      body: createDiverBody(spawnX, spawnY),
    },
    diveState: createDiveState({ mixOverrides: level.gasOverrides }),
    diveProfile: [{ t: 0, d: Math.max(0, Number(spawnY.toFixed(1))), gas: 'EAN32', deco: 0 }],
    _lastProfileSampleAt: 0,
    _lastProfileGas: 'EAN32',
    ghostTrack: [[0, Math.round(spawnX * 10), Math.round(spawnY * 10), 2]],
    _lastGhostSampleAt: 0,
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
    snagWarnCooldown: 0,
    surgeWarnCooldown: 0,
    rustPercolateCooldown: 0,
    hullGroanTimer: 8.5 + Math.random() * 9.0,
    clippedToShotLine: false,
    cutSnagIds: new Set(),
    activeSnagIndex: -1,
    buddySnagIndex: -1,
    buddySnagName: '',
    openedHatchIds: new Set(),
    crankingHatchId: null,
    crankingHatchProgress: 0,
    crankTickAccum: 0,
    hatchBonusScore: 0,
    wreckActionPrompt: null,
    thirdWarned: false,
    stuckDuration: 0,
    reelMaxMeters: level.reelMetersPerDiver || 0,
    reelRemainingM: level.reelMetersPerDiver || 0,
    reelingActive: false,
    guidelineChains: [],
    localSiltDensity: 0,
    bubbles: [],
    bubbleTimer: 0,
    breath: {
      phase: 0.34, // starts near end of first inhale/hold so diver exhales soon after submerging
      state: 'hold', // 'inhale' | 'hold' | 'exhale' | 'rest'
      breathsPerMin: 10.5,
      intensity: 0.35,
      lungFill: 0.85,
      emitAccum: 0,
      exhaleCount: 0,
      inhaleCount: 0,
    },
    simTimeSec: 0,
  };
}

/**
 * Deterministic hull-breach surge wave (-1..+1) shared between physics and renderer.
 * Returns 0 during the calm lull window (|raw| <= 0.35) so divers can time clean crossings.
 */
export function computeSurgeWave(zone, timeSec = 0) {
  const period = Math.max(2.5, zone?.periodSec || 7.5);
  const phase = zone?.phase || 0;
  const raw = Math.sin((timeSec * Math.PI * 2) / period + phase);
  if (Math.abs(raw) <= 0.35) return 0;
  const sign = raw >= 0 ? 1 : -1;
  return sign * ((Math.abs(raw) - 0.35) / 0.65);
}

/**
 * Smoothly interpolates a compact PB ghost track [[t10, x10, y10, a10], ...] at timeSec.
 * Returns null if track is empty or finished.
 */
export function sampleGhostPose(track, timeSec) {
  if (!Array.isArray(track) || track.length < 2) return null;
  const t10 = Math.max(0, timeSec * 10);
  const last = track[track.length - 1];
  if (t10 >= last[0]) {
    if (t10 > last[0] + 60) return null; // Fade out 6s after PB surfaced
    return { x: last[1] / 10, y: last[2] / 10, angle: last[3] / 10, finished: true };
  }
  // Binary search for bracketing frames
  let lo = 0;
  let hi = track.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (track[mid][0] <= t10) lo = mid;
    else hi = mid;
  }
  const a = track[lo];
  const b = track[hi];
  const span = Math.max(1, b[0] - a[0]);
  const f = Math.min(1, Math.max(0, (t10 - a[0]) / span));
  const angA = a[3] / 10;
  const angB = b[3] / 10;
  let dAng = angB - angA;
  while (dAng > Math.PI) dAng -= Math.PI * 2;
  while (dAng < -Math.PI) dAng += Math.PI * 2;
  return {
    x: (a[1] + (b[1] - a[1]) * f) / 10,
    y: (a[2] + (b[2] - a[2]) * f) / 10,
    angle: angA + dAng * f,
    finished: false,
  };
}

/**
 * Applies a remote co-op buddy's wreck action (opening a hatch or slicing a net) to local state.
 */
export function applyPeerWreckAction(session, msg, callbacks = {}) {
  if (!session || !msg || !msg.actionKind || !msg.targetId) return false;
  const by = msg.by || 'Buddy';
  if (msg.actionKind === 'hatch') {
    if (session.openedHatchIds.has(msg.targetId)) return false;
    session.openedHatchIds.add(msg.targetId);
    if (session.crankingHatchId === msg.targetId) {
      session.crankingHatchId = null;
      session.crankingHatchProgress = 0;
    }
    const hatch = session.level?.watertightHatches?.find((h) => h.id === msg.targetId);
    callbacks.onHatchOpen?.(hatch);
    callbacks.onToast?.(`🔓 ${by} unsealed ${hatch?.label || 'Watertight Hatch'}!`, 2.6);
    return true;
  }
  if (msg.actionKind === 'snag') {
    if (session.cutSnagIds.has(msg.targetId)) return false;
    session.cutSnagIds.add(msg.targetId);
    const snIdx = session.level?.snagZones?.findIndex((s, i) => (s.id || `snag_${i}`) === msg.targetId);
    if (snIdx === session.activeSnagIndex) {
      session.activeSnagIndex = -1;
      session.diveState.panicLevel = Math.max(0, (session.diveState.panicLevel || 0) - 0.25);
    }
    const snag = snIdx >= 0 ? session.level.snagZones[snIdx] : null;
    callbacks.onLineCut?.(snag);
    callbacks.onToast?.(`✂️ ${by} cut ${snag?.label || 'fishing net'} clear!`, 2.6);
    return true;
  }
  return false;
}

/**
 * Triggers the active contextual shipwreck action:
 * 1) Slice free from a tangled fishing net / cable (or rescue a tangled co-op buddy!)
 * 2) Crank open a sealed watertight bulkhead hatch (unlocks shortcut/vault + bonus)
 * 3) Clip onto or unclip from the open-water shot line for fast controlled zip-descent/ascent
 */
export function triggerWreckAction(session, callbacks = {}) {
  if (!session || !session.level?.isWreck || session.diveState?.alive === false) {
    return { handled: false, kind: null };
  }
  const { level, diver, diveState, siltClouds, bubbles } = session;

  // 1. Priority 1: Slice free from active fishing-net / cable snag (self or tangled co-op buddy!)
  const snagIdx = session.activeSnagIndex >= 0 ? session.activeSnagIndex : session.buddySnagIndex;
  if (snagIdx >= 0 && Array.isArray(level.snagZones)) {
    const isBuddyRescue = session.activeSnagIndex < 0 && session.buddySnagIndex >= 0;
    const snag = level.snagZones[snagIdx];
    if (snag) {
      const snagKey = snag.id || `snag_${snagIdx}`;
      session.cutSnagIds.add(snagKey);
      session.activeSnagIndex = -1;
      session.buddySnagIndex = -1;
      diveState.panicLevel = Math.max(0, (diveState.panicLevel || 0) - 0.28);
      diveState.heartRateBpm = Math.max(72, (diveState.heartRateBpm || 80) - 14);
      callbacks.onLineCut?.(snag);
      callbacks.onWreckSync?.('snag', snagKey);
      callbacks.onToast?.(
        isBuddyRescue
          ? `✂️ Cut ${session.buddySnagName || 'your buddy'} free from ${snag.label || 'net snag'}!`
          : `✂️ Cut free from ${snag.label || 'net snag'}! Path cleared.`,
        2.6
      );
      return { handled: true, kind: 'cut-net', targetId: snagKey, buddyRescue: isBuddyRescue };
    }
  }

  // 2. Priority 2: Crank open a nearby sealed watertight bulkhead hatch
  if (Array.isArray(level.watertightHatches)) {
    for (let i = 0; i < level.watertightHatches.length; i++) {
      const hatch = level.watertightHatches[i];
      if (!hatch || session.openedHatchIds.has(hatch.id)) continue;
      const dist = Math.hypot(diver.x - hatch.x, diver.y - hatch.y);
      const reach = (hatch.radius || 2.0) + 2.5;
      if (dist <= reach) {
        if (session.crankingHatchId !== hatch.id) {
          session.crankingHatchId = hatch.id;
          session.crankingHatchProgress = Math.max(0.18, session.crankingHatchProgress || 0);
          session.crankTickAccum = 0;
          callbacks.onHatchCrank?.(session.crankingHatchProgress, hatch);
          callbacks.onToast?.(`⚙️ Cranking ${hatch.label || 'Watertight Hatch'}... hold steady!`, 2.0);
        } else {
          // Repeated taps boost cranking speed!
          session.crankingHatchProgress = Math.min(1, session.crankingHatchProgress + 0.24);
          callbacks.onHatchCrank?.(session.crankingHatchProgress, hatch);
        }
        if (session.crankingHatchProgress >= 1) {
          _completeHatchOpen(session, hatch, callbacks, siltClouds, bubbles);
        }
        return { handled: true, kind: 'open-hatch', targetId: hatch.id };
      }
    }
  }

  // 3. Priority 3: Clip onto / unclip from the open-water shot line
  if (level.shotLine) {
    if (session.clippedToShotLine) {
      session.clippedToShotLine = false;
      callbacks.onClipLine?.(false);
      callbacks.onToast?.('🔓 Unclipped from shot line — free swimming.', 1.8);
      return { handled: true, kind: 'unclip-line' };
    }
    const shotX = level.shotLine.x ?? level.spawn?.x ?? 0;
    const shotBottom = level.shotLine.bottomY ?? level.wreckDeckY ?? 40;
    if (Math.abs(diver.x - shotX) <= 5.0 && diver.y >= 1.8 && diver.y <= shotBottom - 0.8) {
      session.clippedToShotLine = true;
      callbacks.onClipLine?.(true);
      callbacks.onToast?.('⚓ Clipped to shot line! Hold Down to zip-descend or Up for steady ascent.', 2.8);
      return { handled: true, kind: 'clip-line' };
    }
  }

  return { handled: false, kind: null };
}

function _completeHatchOpen(session, hatch, callbacks, siltClouds, bubbles) {
  session.openedHatchIds.add(hatch.id);
  session.crankingHatchId = null;
  session.crankingHatchProgress = 0;
  session.crankTickAccum = 0;
  session.hatchBonusScore = (session.hatchBonusScore || 0) + (hatch.bonusPoints || 150);
  callbacks.onHatchOpen?.(hatch);
  callbacks.onWreckSync?.('hatch', hatch.id);
  callbacks.onToast?.(`🔓 ${hatch.label || 'Watertight Hatch'} unsealed! (+${hatch.bonusPoints || 150} pts)`, 3.0);

  // Dramatic burst of trapped pressurized bubbles & rust silt when the seal breaks
  if (Array.isArray(bubbles)) {
    for (let k = 0; k < 14; k++) {
      spawnExhaustBubble(
        bubbles,
        hatch.x + (Math.random() - 0.5) * 1.1,
        hatch.y + (Math.random() - 0.5) * 0.9,
        (Math.random() - 0.5) * 1.4,
        -0.8 - Math.random() * 1.1,
        { primary: k < 8, intensity: 0.9, depthM: hatch.y, portSign: k % 2 === 0 ? 1 : -1 }
      );
    }
  }
  if (Array.isArray(siltClouds) && siltClouds.length < 135) {
    for (let k = 0; k < 3; k++) {
      const cloud = spawnSiltPlume(siltClouds, {
        x: hatch.x + (Math.random() - 0.5) * 0.9,
        y: hatch.y + (Math.random() - 0.5) * 0.7,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 0.15 + Math.random() * 0.25,
        radius: 0.75,
        maxRadius: 2.9,
        life: 16,
        peakAlpha: 0.65,
        isRust: true,
      });
      if (cloud) callbacks.onSiltSpawn?.(cloud);
    }
  }
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

function spawnExhaustBubble(bubbles, x, y, vx, vy, { primary = true, panic = 0, intensity = 0.5, depthM = 10, portSign = 1 } = {}) {
  if (bubbles.length >= MAX_BUBBLES) {
    // Drop oldest bubble cleanly to keep particle count bounded during frantic panic bursts
    bubbles.shift();
  }
  const baseR = primary
    ? 0.068 + Math.random() * (0.056 + panic * 0.028)
    : 0.024 + Math.random() * 0.032;
  const targetVy = primary
    ? -(1.45 + (baseR - 0.06) * 8.5 + Math.random() * 0.45)
    : -(0.62 + Math.random() * 0.58);
  const spread = (primary ? 0.42 : 0.68) * (1 + panic * 0.65);
  bubbles.push({
    x: x + (Math.random() - 0.5) * 0.08,
    y: y + (Math.random() - 0.5) * 0.07,
    vx: vx + portSign * (0.28 + Math.random() * 0.38) * (0.75 + intensity * 0.45) + (Math.random() - 0.5) * spread,
    vy: vy - (0.35 + Math.random() * 0.55) * (0.8 + intensity * 0.35),
    targetVy,
    baseR,
    r: baseR,
    maxR: Math.min(0.24, baseR * 1.95),
    spawnDepth: Math.max(0.5, depthM),
    wobbleFreq: primary ? 5.2 + Math.random() * 3.8 : 3.2 + Math.random() * 2.5,
    wobbleAmp: primary ? 0.34 + Math.random() * 0.36 : 0.16 + Math.random() * 0.18,
    wobblePhase: Math.random() * Math.PI * 2,
    age: 0,
    maxLife: primary ? 4.4 + Math.random() * 2.0 : 3.0 + Math.random() * 1.8,
    life: primary ? 4.4 + Math.random() * 2.0 : 3.0 + Math.random() * 1.8,
    trapped: false,
    primary,
  });
}

function getDiverMouthPos(diver) {
  const angle = diver.angle || 0;
  const faceSign = diver.body?.facingSign ?? (Math.cos(angle) >= 0 ? 1 : -1);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const mouthX = diver.x + cosA * 0.52 + sinA * faceSign * 0.06;
  const mouthY = diver.y + sinA * 0.52 - cosA * faceSign * 0.06;
  // Perpendicular axis for twin-port regulator exhaust tee
  const perpX = -sinA;
  const perpY = cosA;
  return { mouthX, mouthY, perpX, perpY };
}

function stepBubbles(session, dt, callbacks = {}, exertion = 0) {
  const { diver, diveState, bubbles, level } = session;
  if (!session.breath) {
    session.breath = {
      phase: 0.34,
      state: 'hold',
      breathsPerMin: 10.5,
      intensity: 0.35,
      lungFill: 0.85,
      emitAccum: 0,
      exhaleCount: 0,
      inhaleCount: 0,
    };
  }
  const breath = session.breath;
  const profile = computeBreathProfile(diveState, exertion);
  breath.breathsPerMin = profile.breathsPerMin;
  breath.intensity = profile.intensity;

  const activeTank = diveState?.tanks?.[diveState?.activeGasId];
  const hasGas = !activeTank || activeTank.bar > 0.05;
  const canBreathe = diveState?.alive !== false && diver.y > 0.55 && hasGas;

  if (canBreathe) {
    const prevState = breath.state;
    const prevPhase = breath.phase;
    breath.phase = (breath.phase + dt / profile.cycleSec) % 1.0;

    let nextState = 'rest';
    if (breath.phase < profile.inhaleEnd) {
      nextState = 'inhale';
      const u = breath.phase / Math.max(0.05, profile.inhaleEnd);
      breath.lungFill = 0.15 + 0.85 * Math.sin(u * Math.PI * 0.5);
    } else if (breath.phase < profile.holdEnd) {
      nextState = 'hold';
      breath.lungFill = 1.0;
    } else if (breath.phase < profile.exhaleEnd) {
      nextState = 'exhale';
      const u = (breath.phase - profile.holdEnd) / Math.max(0.05, profile.exhaleEnd - profile.holdEnd);
      breath.lungFill = 0.15 + 0.85 * Math.cos(u * Math.PI * 0.5);
    } else {
      nextState = 'rest';
      breath.lungFill = 0.15;
    }
    breath.state = nextState;

    const audioPayload = {
      intensity: profile.intensity,
      panic: profile.panic,
      hrBpm: profile.hrBpm,
      depthM: Math.max(0, diver.y),
      exertion,
    };

    // Detect clean cycle transition into inhale (including wrap-around)
    if (nextState === 'inhale' && (prevState !== 'inhale' || breath.phase < prevPhase)) {
      breath.inhaleCount += 1;
      callbacks.onInhale?.({ ...audioPayload, durationSec: profile.inhaleSec });
    }

    // Detect transition into exhale -> trigger regulator exhaust sound & initial twin-port burst
    if (nextState === 'exhale' && prevState !== 'exhale') {
      breath.exhaleCount += 1;
      breath.emitAccum = 0;
      callbacks.onExhale?.({ ...audioPayload, durationSec: profile.exhaleSec });

      const { mouthX, mouthY, perpX, perpY } = getDiverMouthPos(diver);
      const initCount = Math.round(2 + profile.drive * 2.6);
      for (let i = 0; i < initCount; i++) {
        const portSign = i % 2 === 0 ? 1 : -1;
        spawnExhaustBubble(
          bubbles,
          mouthX + perpX * portSign * 0.06,
          mouthY + perpY * portSign * 0.06,
          (diver.vx || 0) * 0.34,
          (diver.vy || 0) * 0.18,
          {
            primary: i < Math.ceil(initCount * 0.65),
            panic: profile.panic,
            intensity: profile.intensity,
            depthM: diver.y,
            portSign,
          }
        );
      }
    }

    // Continuous shaped bubble plume during exhale phase (bell-curve flow envelope)
    if (nextState === 'exhale') {
      const exhaleProgress = Math.max(
        0,
        Math.min(1, (breath.phase - profile.holdEnd) / Math.max(0.05, profile.exhaleEnd - profile.holdEnd))
      );
      const flowEnvelope = Math.pow(Math.sin(Math.PI * exhaleProgress), 0.72) * (1.18 - 0.32 * exhaleProgress);
      // Calm exhale: ~9-12 bubbles/sec peak (~13-16/breath); Panic/high HR: up to ~34 bubbles/sec dense frothy blast
      const emitRate = (8.5 + profile.drive * 22.0) * flowEnvelope;
      breath.emitAccum += emitRate * dt;

      if (breath.emitAccum >= 1) {
        const { mouthX, mouthY, perpX, perpY } = getDiverMouthPos(diver);
        while (breath.emitAccum >= 1) {
          breath.emitAccum -= 1;
          const portSign = Math.random() < 0.5 ? 1 : -1;
          // Early-to-mid exhale produces larger primary lens bubbles; tail end produces trailing micro-bubbles
          const primaryChance = (0.58 - exhaleProgress * 0.32) + profile.panic * 0.14;
          spawnExhaustBubble(
            bubbles,
            mouthX + perpX * portSign * (0.05 + Math.random() * 0.04),
            mouthY + perpY * portSign * (0.05 + Math.random() * 0.04),
            (diver.vx || 0) * 0.32,
            (diver.vy || 0) * 0.18,
            {
              primary: Math.random() < primaryChance,
              panic: profile.panic,
              intensity: profile.intensity,
              depthM: diver.y,
              portSign,
            }
          );
        }
      }
    } else if (nextState === 'inhale' && profile.panic > 0.35 && Math.random() < dt * (1.2 + profile.panic * 2.5)) {
      // Occasional tiny mask-skirt/valve micro-bubble leak under panicked breathing
      const { mouthX, mouthY } = getDiverMouthPos(diver);
      spawnExhaustBubble(bubbles, mouthX, mouthY, (diver.vx || 0) * 0.25, (diver.vy || 0) * 0.15, {
        primary: false,
        panic: profile.panic,
        intensity: 0.4,
        depthM: diver.y,
        portSign: Math.random() < 0.5 ? 1 : -1,
      });
    }
  } else {
    breath.state = 'rest';
    breath.lungFill += (0.2 - breath.lungFill) * Math.min(1, dt * 3);
  }

  // Advance bubble buoyancy, sinusoidal vortex wobble, Boyle's law expansion, and cave ceiling trapping
  const vents = Array.isArray(level?.geothermalVents) ? level.geothermalVents : null;
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.age = (b.age || 0) + dt;

    if (!b.trapped) {
      // Water drag damps horizontal jet velocity; buoyancy accelerates toward terminal rise speed
      b.vx *= Math.exp(-3.4 * dt);
      const tVy = b.targetVy ?? -1.6;
      b.vy += (tVy - b.vy) * Math.min(1, dt * 4.5);

      // Geothermal vent updraft acceleration
      if (vents) {
        for (let v = 0; v < vents.length; v++) {
          const vent = vents[v];
          const hw = vent.halfWidth || 2.8;
          const vh = vent.height || 14;
          if (Math.abs(b.x - vent.x) <= hw && b.y <= vent.y && b.y >= vent.y - vh) {
            b.vy -= 1.8 * dt;
            break;
          }
        }
      }

      const wobbleVx = b.wobbleFreq
        ? Math.sin(b.age * b.wobbleFreq + (b.wobblePhase || 0)) * (b.wobbleAmp || 0.2)
        : 0;
      b.x += (b.vx + wobbleVx) * dt;
      b.y += b.vy * dt;

      // Boyle's law expansion as ambient hydrostatic pressure drops during ascent
      if (b.baseR && b.spawnDepth) {
        const pressureRatio = (b.spawnDepth + 10) / (Math.max(0.1, b.y) + 10);
        b.r = Math.min(b.maxR || b.baseR * 1.9, b.baseR * Math.cbrt(Math.max(0.5, pressureRatio)));
      }

      // Ceiling rock trap: flatten & percolate sideways along overhead cave limestone instead of clipping through rock
      if (level && b.y > 0.45 && evaluateCaveSDF(level, b.x, b.y) > -0.08) {
        const norm = evaluateCaveNormal(level, b.x, b.y, _bubbleNormalScratch);
        // Push gently back into open water below ceiling
        b.x -= norm.nx * 0.08;
        b.y -= norm.ny * 0.08;
        b.trapped = true;
        // Slide along ceiling slope toward shallower pocket
        const tx = -norm.ny;
        const ty = norm.nx;
        const slopeDir = ty <= 0 ? 1 : -1;
        b.vx = tx * slopeDir * (0.28 + Math.random() * 0.25) + (Math.random() - 0.5) * 0.14;
        b.vy = ty * slopeDir * 0.14;
        b.life = Math.min(b.life, 0.9 + Math.random() * 0.85);

        // Shipwreck "Percolation": exhaust bubbles striking overhead rusted steel plates dislodge
        // sinking orange-brown rust-snow plumes that cloud visibility behind panicked divers!
        if (
          level.isWreck &&
          b.y > (level.wreckDeckY ?? 30) - 2.0 &&
          session.siltClouds &&
          session.siltClouds.length < 132 &&
          (session.rustPercolateCooldown || 0) <= 0
        ) {
          const diffMult = session.difficulty === 'hardcore' ? 1.38 : session.difficulty === 'guided' ? 0.55 : 1.0;
          const panicBoost = diveState?.panicLevel || 0;
          const intensity = profile.intensity || 0.3;
          // Calm breathing rarely dislodges rust; heavy/panicked exhaust drops steady curtains
          if (Math.random() < (0.18 + panicBoost * 0.45 + intensity * 0.22) * diffMult) {
            session.rustPercolateCooldown = Math.max(0.32, (1.55 - panicBoost * 0.95 - intensity * 0.35) / diffMult);
            const rustCloud = spawnSiltPlume(session.siltClouds, {
              x: b.x + (Math.random() - 0.5) * 0.35,
              y: b.y + 0.18,
              vx: (Math.random() - 0.5) * 0.22,
              vy: 0.28 + Math.random() * 0.24,
              radius: 0.55 + panicBoost * 0.35,
              maxRadius: 2.3 + panicBoost * 1.4,
              life: 16 + Math.random() * 8,
              peakAlpha: 0.48 + panicBoost * 0.28,
              isRust: true,
            });
            if (rustCloud) callbacks.onSiltSpawn?.(rustCloud);
          }
        }
      }
    } else {
      // Silver ceiling-trapped percolation slide
      b.vx *= Math.exp(-1.5 * dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (level && evaluateCaveSDF(level, b.x, b.y) > -0.02) {
        b.vx *= -0.35;
        b.vy = 0;
      }
    }

    b.life -= dt;
    if (b.life <= 0 || b.y <= 0.1) bubbles.splice(i, 1);
  }
}

/**
 * Emit realistic breathing-pattern bubbles for remote co-op peers driven by their synced heart rate.
 */
export function stepPeerBubbles(bubbles, peers, dt) {
  if (!Array.isArray(bubbles) || !Array.isArray(peers) || peers.length === 0 || dt <= 0) return;
  for (let i = 0; i < peers.length; i++) {
    const p = peers[i];
    if (!p || p.alive === false || p.surfaced || (p.y ?? 0) <= 0.6) continue;
    const hrBpm = p.heartRateBpm ?? 78;
    const hrNorm = Math.max(0, Math.min(1, (hrBpm - 65) / 115));
    const panic = p.condition && p.condition !== 'NOMINAL' ? 0.55 : hrNorm * 0.6;
    const drive = Math.max(0, Math.min(1.2, hrNorm * 0.72 + panic * 0.45));
    const cycleSec = 60 / (10.5 + drive * 20);
    if (!Number.isFinite(p._breathPhase)) p._breathPhase = (i * 0.37) % 1;
    p._breathPhase = (p._breathPhase + dt / cycleSec) % 1.0;

    const holdEnd = 0.34;
    const exhaleEnd = 0.78 + Math.min(0.14, drive * 0.12);
    if (p._breathPhase >= holdEnd && p._breathPhase < exhaleEnd) {
      const exU = (p._breathPhase - holdEnd) / Math.max(0.05, exhaleEnd - holdEnd);
      const env = Math.sin(Math.PI * exU);
      const rate = (5.5 + drive * 14) * env;
      p._bubbleAccum = (p._bubbleAccum || 0) + rate * dt;
      if (p._bubbleAccum >= 1) {
        const ang = p.angle || 0;
        const mx = p.x + Math.cos(ang) * 0.5;
        const my = p.y + Math.sin(ang) * 0.5;
        while (p._bubbleAccum >= 1) {
          p._bubbleAccum -= 1;
          spawnExhaustBubble(bubbles, mx, my, (p.vx || 0) * 0.25, (p.vy || 0) * 0.15, {
            primary: Math.random() < 0.48,
            panic,
            intensity: 0.35 + drive * 0.65,
            depthM: p.y,
            portSign: Math.random() < 0.5 ? 1 : -1,
          });
        }
      }
    }
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

  // Subtle lung-volume neutral buoyancy oscillation (rises slightly on inhale, settles on exhale)
  const lungFill = session.breath?.lungFill ?? 0.5;
  diver.vy -= (lungFill - 0.5) * 0.28 * dt;
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

  // Rust percolation throttle & eerie periodic sunken-hull metallic groans
  if (session.rustPercolateCooldown > 0) session.rustPercolateCooldown -= dt;
  if (level.isWreck && diver.y > 12) {
    session.hullGroanTimer = (session.hullGroanTimer ?? 12) - dt;
    if (session.hullGroanTimer <= 0) {
      session.hullGroanTimer = 15 + Math.random() * 14;
      const depthRatio = Math.min(1, diver.y / Math.max(40, level.wreckSeabedY || 90));
      callbacks.onHullGroan?.(depthRatio);
    }
  }

  // Layered open-ocean drift currents on shipwreck dives (sheltered inside steel hull or when clipped to shot line)
  const diffCurrentMult = session.difficulty === 'hardcore' ? 1.28 : session.difficulty === 'guided' ? 0.7 : 1.0;
  if (Array.isArray(level.driftCurrents) && clearanceM > 1.75 && !session.clippedToShotLine) {
    const shelter = Math.min(1, (clearanceM - 1.75) / 2.6);
    for (let c = 0; c < level.driftCurrents.length; c++) {
      const cur = level.driftCurrents[c];
      if (diver.y >= cur.yMin && diver.y <= cur.yMax) {
        const pulse = 0.82 + 0.18 * Math.sin(session.simTimeSec * 0.65 + c * 1.9);
        diver.vx += (cur.vx || 0) * shelter * pulse * diffCurrentMult * dt;
        diver.vy += (cur.vy || 0) * shelter * pulse * diffCurrentMult * dt;
      }
    }
  }

  // Timed hull-breach surge currents (rhythmic ocean swell pulsing through torn hatches — time the calm lull!)
  if (session.surgeWarnCooldown > 0) session.surgeWarnCooldown -= dt;
  if (Array.isArray(level.surgeZones)) {
    for (let z = 0; z < level.surgeZones.length; z++) {
      const zone = level.surgeZones[z];
      const zr = zone.radius || 4.0;
      const dist = Math.hypot(diver.x - zone.x, diver.y - zone.y);
      if (dist <= zr) {
        const wave = computeSurgeWave(zone, session.simTimeSec);
        if (wave !== 0) {
          const falloff = 0.45 + 0.55 * (1 - dist / zr);
          diver.vx += (zone.vx || 0) * wave * falloff * diffCurrentMult * dt;
          diver.vy += (zone.vy || 0) * wave * falloff * diffCurrentMult * dt;
          if (Math.abs(wave) > 0.65 && session.surgeWarnCooldown <= 0) {
            session.surgeWarnCooldown = 6.0;
            callbacks.onToast?.(`🌊 ${zone.label || 'Hull-breach surge'} — wait for the lull or ride the flow!`, 2.6);
          }
        }
      }
    }
  }

  // Shipwreck fishing-net & dangling cable entanglement hazards (cuttable with shears [E] — self or co-op buddy!)
  if (session.snagWarnCooldown > 0) session.snagWarnCooldown -= dt;
  session.activeSnagIndex = -1;
  session.buddySnagIndex = -1;
  session.buddySnagName = '';
  const peerList = Array.isArray(callbacks.peers) ? callbacks.peers : null;
  if (Array.isArray(level.snagZones)) {
    for (let s = 0; s < level.snagZones.length; s++) {
      const snag = level.snagZones[s];
      const snagKey = snag.id || `snag_${s}`;
      if (session.cutSnagIds?.has(snagKey)) continue;
      const sr = snag.radius || 2.4;
      const dist = Math.hypot(diver.x - snag.x, diver.y - snag.y);
      if (dist <= sr) {
        session.activeSnagIndex = s;
        const grip = 1 - dist / sr;
        const drag = Math.exp(-(2.6 + grip * 2.5) * dt);
        diver.vx *= drag;
        diver.vy *= drag;
        const panicScale = session.difficulty === 'hardcore' ? 1.25 : session.difficulty === 'guided' ? 0.65 : 1.0;
        diveState.panicLevel = Math.min(1, (diveState.panicLevel || 0) + dt * (0.22 + grip * 0.25) * panicScale);
        diveState.heartRateBpm = Math.min(192, (diveState.heartRateBpm || 68) + dt * (11 + grip * 12) * panicScale);
        if (session.snagWarnCooldown <= 0) {
          session.snagWarnCooldown = 5.5;
          callbacks.onToast?.(`🕸️ Tangled in ${snag.label || 'fishing net'} — press [E] / Cut Net!`, 2.8);
        }
        break;
      }
      // Buddy Net Rescue: check if a co-op buddy is tangled inside this snag and we're close enough to slice them free!
      if (peerList && session.buddySnagIndex < 0 && dist <= sr + 3.4) {
        for (let pIdx = 0; pIdx < peerList.length; pIdx++) {
          const peer = peerList[pIdx];
          if (!peer || peer.alive === false) continue;
          if (Math.hypot(peer.x - snag.x, peer.y - snag.y) <= sr + 0.3) {
            session.buddySnagIndex = s;
            session.buddySnagName = peer.name || 'Buddy';
            break;
          }
        }
      }
    }
  }

  // Interactive Watertight Bulkhead Hatches (physical barrier until cranked open + smooth progress)
  let nearbyHatch = null;
  if (Array.isArray(level.watertightHatches)) {
    for (let h = 0; h < level.watertightHatches.length; h++) {
      const hatch = level.watertightHatches[h];
      if (!hatch || session.openedHatchIds?.has(hatch.id)) continue;
      const hr = hatch.radius || 2.0;
      const dx = diver.x - hatch.x;
      const dy = diver.y - hatch.y;
      const dist = Math.hypot(dx, dy);
      if (dist < hr + 0.45 && dist > 0.001) {
        // Push diver cleanly back from the sealed steel door
        const push = hr + 0.45 - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        diver.x += nx * push;
        diver.y += ny * push;
        const vn = diver.vx * nx + diver.vy * ny;
        if (vn < 0) {
          diver.vx -= nx * vn * 1.1;
          diver.vy -= ny * vn * 1.1;
        }
      }
      if (dist <= hr + 2.5 && !nearbyHatch) {
        nearbyHatch = hatch;
      }
    }
  }

  if (session.crankingHatchId) {
    const activeHatch = Array.isArray(level.watertightHatches)
      ? level.watertightHatches.find((h) => h.id === session.crankingHatchId)
      : null;
    if (!activeHatch || session.openedHatchIds?.has(activeHatch.id)) {
      session.crankingHatchId = null;
      session.crankingHatchProgress = 0;
    } else {
      const dist = Math.hypot(diver.x - activeHatch.x, diver.y - activeHatch.y);
      if (dist > (activeHatch.radius || 2.0) + 3.2) {
        // Swam away before unsealing
        session.crankingHatchId = null;
        session.crankingHatchProgress = 0;
      } else {
        session.crankingHatchProgress = Math.min(1, (session.crankingHatchProgress || 0) + dt / 1.35);
        session.crankTickAccum = (session.crankTickAccum || 0) + dt;
        if (session.crankTickAccum >= 0.28) {
          session.crankTickAccum = 0;
          callbacks.onHatchCrank?.(session.crankingHatchProgress, activeHatch);
        }
        if (session.crankingHatchProgress >= 1) {
          _completeHatchOpen(session, activeHatch, callbacks, siltClouds, session.bubbles);
        }
      }
    }
  }

  // Open-Water Shot-Line Clip & Fast Controlled Zip-Descent / Safe-Rate Ascent
  let nearShotLine = false;
  if (level.isWreck && level.shotLine) {
    const shotX = level.shotLine.x ?? level.spawn?.x ?? 0;
    const shotBottom = level.shotLine.bottomY ?? level.wreckDeckY ?? 40;
    const dxLine = Math.abs(diver.x - shotX);
    const inDepthSpan = diver.y >= 1.8 && diver.y <= shotBottom - 0.8;
    nearShotLine = dxLine <= 5.0 && inDepthSpan;

    if (session.clippedToShotLine) {
      // Unclip automatically if steering hard laterally or reaching deck / surface
      if (Math.abs(ctrlX) > 0.62 || diver.y < 1.5 || diver.y >= shotBottom - 0.7) {
        session.clippedToShotLine = false;
        callbacks.onClipLine?.(false);
      } else {
        // Lock cleanly onto shot line X (immune to drift current!)
        diver.x += (shotX - diver.x) * Math.min(1, dt * 8.0);
        diver.vx *= Math.exp(-9.0 * dt);

        if (ctrlY > 0.15) {
          // Fast zip-descent (up to 7.2 m/s), auto-braking gently at gas switch buoy if still on EAN32
          const switchDepth = level.ascentSwitchDepthM ?? 22.0;
          const needTmxBrake = diveState.activeGasId === 'EAN32' && diver.y >= switchDepth - 1.5 && diver.y <= switchDepth + 3.5;
          const targetVy = needTmxBrake ? 0.25 : Math.min(7.2, 2.2 + ctrlY * 5.2);
          diver.vy += (targetVy - diver.vy) * Math.min(1, dt * 7.5);
        } else if (ctrlY < -0.15) {
          // Controlled safe-rate ascent (~9.6 m/min = 2.0 m/s), auto-holding at any active deco ceiling!
          const decoFloor = diveState.stopDepthM > 0 ? (diveState.stopDepthM <= 6 ? 5.3 : diveState.stopDepthM - 0.2) : 0;
          if (decoFloor > 0 && diver.y <= decoFloor + 0.5) {
            diver.vy += (decoFloor - diver.y) * 2.4 * dt;
            diver.vy *= Math.exp(-5.0 * dt);
          } else {
            const targetVy = Math.max(-2.05, ctrlY * 2.05);
            diver.vy += (targetVy - diver.vy) * Math.min(1, dt * 6.5);
          }
        } else {
          // Clipped hover hold against current
          diver.vy *= Math.exp(-6.5 * dt);
        }
      }
    }
  }

  // Publish contextual wreck action prompt for HUD button (zero-allocation when unchanged)
  if (level.isWreck) {
    if (session.activeSnagIndex >= 0) {
      const sn = level.snagZones?.[session.activeSnagIndex];
      session.wreckActionPrompt = {
        kind: 'cut-net',
        label: `✂️ CUT FREE [E]`,
        detail: sn?.label || 'Tangled Net',
        progress: 0,
      };
    } else if (session.buddySnagIndex >= 0) {
      const sn = level.snagZones?.[session.buddySnagIndex];
      session.wreckActionPrompt = {
        kind: 'cut-net',
        label: `✂️ CUT ${session.buddySnagName || 'BUDDY'} FREE [E]`,
        detail: sn?.label || 'Buddy Tangled in Net',
        progress: 0,
      };
    } else if (nearbyHatch) {
      const isCranking = session.crankingHatchId === nearbyHatch.id;
      session.wreckActionPrompt = {
        kind: 'open-hatch',
        label: isCranking ? `⚙️ CRANKING ${Math.round((session.crankingHatchProgress || 0) * 100)}%` : `⚙️ OPEN HATCH [E]`,
        detail: nearbyHatch.label || 'Watertight Hatch',
        progress: isCranking ? session.crankingHatchProgress : 0,
      };
    } else if (session.clippedToShotLine) {
      session.wreckActionPrompt = {
        kind: 'unclip-line',
        label: '🔓 UNCLIP LINE [E]',
        detail: 'Shot Line Zip Active',
        progress: 0,
      };
    } else if (nearShotLine) {
      session.wreckActionPrompt = {
        kind: 'clip-line',
        label: '⚓ CLIP SHOT LINE [E]',
        detail: 'Fast Zip Descent / Deco Hold',
        progress: 0,
      };
    } else {
      session.wreckActionPrompt = null;
    }
  } else {
    session.wreckActionPrompt = null;
  }

  // Soft open-ocean lateral boundary nudge on shipwrecks so divers stay near the boat & wreck site
  if (level.isWreck && level.bounds) {
    const padX = 5.5;
    if (diver.x < level.bounds.xMin + padX) {
      diver.vx += (level.bounds.xMin + padX - diver.x) * 2.4 * dt;
    } else if (diver.x > level.bounds.xMax - padX) {
      diver.vx -= (diver.x - (level.bounds.xMax - padX)) * 2.4 * dt;
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

  // Flashlight direction: follows diver heading by default, smoothly overridden while left torch stick is aimed
  const torchAim = callbacks.torchAim;
  const curTorchAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : diver.angle;
  if (torchAim?.active && Number.isFinite(torchAim.angle)) {
    let tDiff = torchAim.angle - curTorchAng;
    while (tDiff > Math.PI) tDiff -= Math.PI * 2;
    while (tDiff < -Math.PI) tDiff += Math.PI * 2;
    diver.torchAngle = curTorchAng + tDiff * (1 - Math.exp(-18 * dt));
    diver.torchManualAim = true;
  } else {
    let tDiff = diver.angle - curTorchAng;
    while (tDiff > Math.PI) tDiff -= Math.PI * 2;
    while (tDiff < -Math.PI) tDiff += Math.PI * 2;
    diver.torchAngle = curTorchAng + tDiff * (1 - Math.exp(-10 * dt));
    diver.torchManualAim = false;
  }

  // Cave Wall Collision & Floor/Impact Silt-Out + Stuck / Head-Bump Stress Detection
  const hit = resolveDiverCollision(level, diver, 0.52);
  stepDiverBody(diver, dt, { thrustMag, level, lungFill: session.breath?.lungFill });

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

  // Record Dive Computer Depth Profile (every 1.5s or immediately on gas switch) & PB Ghost track (every 0.6s)
  const tDive = diveState.diveTimeSec || session.simTimeSec;
  if (session.diveProfile && session.diveProfile.length < 450) {
    const gasChanged = diveState.activeGasId !== session._lastProfileGas;
    if (gasChanged || tDive - (session._lastProfileSampleAt || 0) >= 1.5) {
      session._lastProfileSampleAt = tDive;
      session._lastProfileGas = diveState.activeGasId;
      session.diveProfile.push({
        t: Number(tDive.toFixed(1)),
        d: Number(Math.max(0, diver.y).toFixed(1)),
        gas: diveState.activeGasId,
        deco: diveState.stopDepthM || 0,
      });
    }
  }
  if (session.ghostTrack && session.ghostTrack.length < 280 && session.simTimeSec - (session._lastGhostSampleAt || 0) >= 0.6) {
    session._lastGhostSampleAt = session.simTimeSec;
    session.ghostTrack.push([
      Math.round(session.simTimeSec * 10),
      Math.round(diver.x * 10),
      Math.round(diver.y * 10),
      Math.round(diver.angle * 10),
    ]);
  }

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
