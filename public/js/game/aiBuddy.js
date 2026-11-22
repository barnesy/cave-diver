/**
 * Autonomous Technical Dive Buddy ("Solo Co-op" Wingman) — v134.
 *
 * Swims realistic SDF-safe formation alongside solo divers, sweeps an intelligent
 * secondary ray-cast torch across dark passages & nearby collectibles, responds to
 * player scuba hand-signals (OK / HOLD / LOOK / LOW GAS / ASCEND / SHARE AIR),
 * cuts snagged players free, and performs automatic emergency gas shares with live
 * air-share hose VFX.
 */

import { evaluateCaveSDF, evaluateCaveNormal, resolveDiverCollision, resolveDiverPeerCollisions } from './collision.js';
import { createDiverBody, stepDiverBody } from './diverBody.js';
import { getScubaSignalById, triggerDiverSignal } from './diveSignals.js';
import { GAS_MIXES, getRecommendedGas, receiveGasIntoState } from '../physics/diveModel.js';
import { pushAirShareBeam } from './diveSession.js';

export const AI_BUDDY_ID = 'ai-wingman-01';
export const AI_BUDDY_DEFAULT_NAME = '🤖 APEX-2';

export const AI_SQUAD_ROSTER = Object.freeze([
  {
    id: 'ai-wingman-01',
    name: '🤖 APEX-2',
    role: 'Lead Wingman',
    livery: { suitId: 'arctic-cobalt', torchId: 'amber-silt', patchId: 'cenote-explorer' },
  },
  {
    id: 'ai-wingman-02',
    name: '🤖 COBRA-3',
    role: 'Flank Scout',
    livery: { suitId: 'expedition-amber', torchId: 'warm-halogen', patchId: 'wreck-penetrator' },
  },
  {
    id: 'ai-wingman-03',
    name: '🤖 ORCA-4',
    role: 'Tail Guard',
    livery: { suitId: 'wreck-titanium', torchId: 'emerald-spot', patchId: 'abyss-veteran' },
  },
]);

const _normScratch = { nx: 0, ny: 0 };

function normalizeAngle(a) {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

function lerpAngle(cur, target, t) {
  const diff = normalizeAngle(target - cur);
  return cur + diff * Math.min(1, Math.max(0, t));
}

function openWaterClearance(level, x, y) {
  if (!level) return 4;
  // evaluateCaveSDF: < 0 is open water, >= 0 is solid rock
  return -evaluateCaveSDF(level, x, y);
}

function findSafeSpawnOffset(level, diver, slotIndex = 0) {
  const baseX = Number(diver?.x) || 0;
  const baseY = Number(diver?.y) || 1.2;
  const candidatesBySlot = [
    [
      { dx: -1.7, dy: 0.3 },
      { dx: 1.7, dy: 0.3 },
      { dx: -1.2, dy: 1.1 },
      { dx: 1.2, dy: 1.1 },
      { dx: 0, dy: 1.3 },
      { dx: 0, dy: 0.2 },
    ],
    [
      { dx: 1.85, dy: 0.4 },
      { dx: -2.85, dy: 0.5 },
      { dx: 1.3, dy: 1.45 },
      { dx: -1.3, dy: 1.45 },
      { dx: 0.6, dy: 1.8 },
    ],
    [
      { dx: -2.95, dy: 0.55 },
      { dx: 2.95, dy: 0.55 },
      { dx: 0, dy: 2.25 },
      { dx: -1.5, dy: 2.1 },
      { dx: 1.5, dy: 2.1 },
    ],
  ];
  const candidates = candidatesBySlot[slotIndex % candidatesBySlot.length];
  for (let i = 0; i < candidates.length; i++) {
    const cx = baseX + candidates[i].dx;
    const cy = Math.max(0.85, baseY + candidates[i].dy);
    if (openWaterClearance(level, cx, cy) >= 0.72) {
      return { x: cx, y: cy };
    }
  }
  return { x: baseX + (slotIndex - 1) * 0.4, y: Math.max(0.85, baseY + 0.35 + slotIndex * 0.45) };
}

/**
 * Create a new AI Autonomous Dive Buddy state anchored cleanly near the diver spawn.
 */
export function createAiBuddyState(level, diver, opts = {}) {
  const slotIndex = Math.max(0, Math.min(2, Math.floor(Number(opts.slotIndex) || 0)));
  const roster = AI_SQUAD_ROSTER[slotIndex] || AI_SQUAD_ROSTER[0];
  const spawn = findSafeSpawnOffset(level, diver, slotIndex);
  const angle = Number(diver?.angle) || 0;
  const buddy = {
    id: opts.id || roster.id,
    name: opts.name || roster.name,
    role: roster.role,
    slotIndex,
    isAiBuddy: true,
    livery: opts.livery ? { ...opts.livery } : { ...roster.livery },
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    angle,
    depthM: Math.max(0, spawn.y),
    torchOn: true,
    torchAngle: angle,
    torchManualAim: true,
    alive: true,
    surfaced: false,
    rescued: false,
    rescuedBy: '',
    rescueTargetId: '',
    gasId: opts.initialGasId || 'EAN32',
    activeBar: 205,
    maxBar: 205,
    heartRateBpm: 72,
    cnsPercent: 0,
    dcsStress: 0,
    hypoxiaStress: 0,
    cardiacStress: 0,
    narcosisLevel: 0,
    condition: 'NOMINAL',
    hasCcr: false,
    signalId: '',
    signalText: '',
    signalStartedAt: 0,
    signalExpiresAt: 0,
    body: createDiverBody(spawn.x, spawn.y, angle),

    // AI Wingman tactical state
    mode: 'follow', // 'follow' | 'hold' | 'scout' | 'ascend' | 'assist-gas' | 'assist-snag'
    modeTimer: 0,
    holdX: spawn.x,
    holdY: spawn.y,
    sweepPhase: slotIndex * 2.1,
    gasShareCooldown: 0,
    snagAssistTimer: 0,
    strandedTimer: 0,
    calloutCooldowns: {
      lowGas: 0,
      deco: 0,
      collectible: 0,
      snag: 0,
    },
    spottedCollectibleIds: new Set(),
    playerTrail: [{ x: Number(diver?.x) || 0, y: Number(diver?.y) || 1.2 }],
    _lastTrailX: Number(diver?.x) || 0,
    _lastTrailY: Number(diver?.y) || 1.2,

    // Telemetry counters for debrief summary
    gasDonatedTotalBar: 0,
    gasDonationsCount: 0,
    snagsAssisted: 0,
    signalsExchanged: 0,
  };

  if (level) {
    resolveDiverCollision(level, buddy, 0.52);
    buddy.depthM = Math.max(0, buddy.y);
  }
  return buddy;
}

const SQUAD_UNIFORM_TRIMS = Object.freeze(['tech-cyan', 'safety-orange', 'cavern-yellow']);

/**
 * Create a full solo AI Dive Squad of 1 to 3 distinct wingmen (2-diver up to 4-diver squad).
 * When `opts.teamUniform` is enabled with `opts.leaderLivery`, wingmen share the player's
 * drysuit, headgear, tank finish & visor with distinct high-vis wingman trim stripes (v155).
 */
export function createAiSquad(level, diver, count = 1, opts = {}) {
  const cleanCount = Math.max(0, Math.min(AI_SQUAD_ROSTER.length, Math.floor(Number(count) || 0)));
  const useUniform = Boolean(opts.teamUniform && opts.leaderLivery && typeof opts.leaderLivery === 'object');
  const squad = [];
  for (let i = 0; i < cleanCount; i++) {
    const roster = AI_SQUAD_ROSTER[i] || AI_SQUAD_ROSTER[0];
    const buddyLivery = useUniform
      ? {
          ...opts.leaderLivery,
          trimId: SQUAD_UNIFORM_TRIMS[i % SQUAD_UNIFORM_TRIMS.length],
          patchId: roster.livery?.patchId || opts.leaderLivery.patchId || 'cave-arrow',
        }
      : undefined;
    squad.push(
      createAiBuddyState(level, diver, {
        ...opts,
        slotIndex: i,
        ...(buddyLivery ? { livery: buddyLivery } : {}),
      })
    );
  }
  return squad;
}

/**
 * React immediately when the local diver flashes a scuba hand-signal / torch gesture.
 */
export function handlePlayerSignalForAiBuddy(buddy, idOrText, session, nowMs = Date.now()) {
  if (!buddy || buddy.alive === false) return { responded: false };
  const spec = getScubaSignalById(idOrText);
  const sigId = spec?.id || 'ok';
  buddy.signalsExchanged = (buddy.signalsExchanged || 0) + 1;

  if (sigId === 'ok') {
    buddy.mode = 'follow';
    buddy.modeTimer = 0;
    buddy.condition = 'NOMINAL';
    triggerDiverSignal(buddy, 'ok', nowMs);
    return {
      responded: true,
      replySignalId: 'ok',
      mode: buddy.mode,
      toast: `${buddy.name}: 👌 OK — back on your wing`,
    };
  }

  if (sigId === 'hold') {
    buddy.mode = 'hold';
    buddy.modeTimer = 30;
    buddy.holdX = buddy.x;
    buddy.holdY = buddy.y;
    buddy.condition = 'HOLDING';
    triggerDiverSignal(buddy, 'hold', nowMs);
    return {
      responded: true,
      replySignalId: 'hold',
      mode: buddy.mode,
      toast: `${buddy.name}: ✋ Holding position & holding light`,
    };
  }

  if (sigId === 'low-gas' || sigId === 'share-air') {
    buddy.mode = 'assist-gas';
    buddy.modeTimer = 14;
    buddy.condition = 'GAS ASSIST';
    const hasReserve = buddy.activeBar >= 55;
    triggerDiverSignal(buddy, hasReserve ? 'share-air' : 'low-gas', nowMs);
    return {
      responded: true,
      replySignalId: hasReserve ? 'share-air' : 'low-gas',
      mode: buddy.mode,
      toast: hasReserve
        ? `${buddy.name}: 🆘 Closing in to share emergency gas!`
        : `${buddy.name}: ⛽ Low reserve (${Math.round(buddy.activeBar)}b) — turn dive!`,
    };
  }

  if (sigId === 'attention') {
    buddy.mode = 'scout';
    buddy.modeTimer = 9;
    buddy.condition = 'SCOUTING';
    triggerDiverSignal(buddy, 'attention', nowMs);
    return {
      responded: true,
      replySignalId: 'attention',
      mode: buddy.mode,
      toast: `${buddy.name}: 🔦 Sweeping passage & scanning targets`,
    };
  }

  if (sigId === 'ascend') {
    buddy.mode = 'ascend';
    buddy.modeTimer = 16;
    buddy.condition = 'ASCEND';
    triggerDiverSignal(buddy, 'ascend', nowMs);
    return {
      responded: true,
      replySignalId: 'ascend',
      mode: buddy.mode,
      toast: `${buddy.name}: 👍 Leading controlled ascent`,
    };
  }

  triggerDiverSignal(buddy, 'ok', nowMs);
  return { responded: true, replySignalId: 'ok', mode: buddy.mode, toast: `${buddy.name}: 👌 Copy` };
}

function findNearestUncollected(level, collectedIds, x, y, maxRangeM) {
  const list = level?.collectibles;
  if (!Array.isArray(list) || list.length === 0) return null;
  let best = null;
  let bestD = maxRangeM;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (!c || collectedIds?.has(c.id)) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best ? { item: best, dist: bestD } : null;
}

function chooseFormationTarget(level, diver, buddy, hardcore = false) {
  const backX = -Math.cos(diver.angle || 0);
  const backY = -Math.sin(diver.angle || 0);
  const perpX = -backY;
  const perpY = backX;

  if (buddy.mode === 'assist-gas' || buddy.mode === 'assist-snag') {
    // Pull right alongside diver (1.35m) for hose transfer or line-shears assist
    const closeCandidates = [
      { x: diver.x + perpX * 1.35, y: Math.max(0.75, diver.y + perpY * 1.35) },
      { x: diver.x - perpX * 1.35, y: Math.max(0.75, diver.y - perpY * 1.35) },
      { x: diver.x + backX * 1.4, y: Math.max(0.75, diver.y + backY * 1.4) },
    ];
    let best = closeCandidates[0];
    let bestClear = -Infinity;
    for (let i = 0; i < closeCandidates.length; i++) {
      const c = openWaterClearance(level, closeCandidates[i].x, closeCandidates[i].y);
      if (c > bestClear) {
        bestClear = c;
        best = closeCandidates[i];
      }
    }
    return best;
  }

  if (buddy.mode === 'hold') {
    return { x: buddy.holdX, y: buddy.holdY };
  }

  if (buddy.mode === 'ascend') {
    const exit = level?.exitZone;
    const dx = exit ? exit.x - diver.x : 0;
    const dy = exit ? exit.y - diver.y : -4;
    const len = Math.max(0.01, Math.hypot(dx, dy));
    const tx = diver.x + (dx / len) * 2.15;
    const ty = Math.max(0.9, diver.y + (dy / len) * 2.15 - 0.35);
    if (openWaterClearance(level, tx, ty) >= 0.72) {
      return { x: tx, y: ty };
    }
  }

  // Standard wingman formation: evaluate flanking & staggered single-file slots for 1..3 AI wingmen
  // In Hardcore mode, trail slightly wider to avoid bumping tanks during diver-to-diver collisions
  const slot = Math.max(0, Number(buddy?.slotIndex) || 0);
  const hcPad = hardcore ? 0.55 : 0;
  const trailStep = slot * (hardcore ? 1.85 : 1.5);
  const sideSign = slot % 2 === 0 ? 1 : -1;
  const slots = [
    {
      x: diver.x + backX * (2.25 + hcPad + trailStep) + perpX * sideSign * (0.95 + hcPad * 0.35),
      y: Math.max(0.8, diver.y + backY * (2.25 + hcPad + trailStep) + perpY * sideSign * (0.95 + hcPad * 0.35) - 0.3),
      bonus: 0.35,
    },
    {
      x: diver.x + backX * (2.25 + hcPad + trailStep) - perpX * sideSign * (0.95 + hcPad * 0.35),
      y: Math.max(0.8, diver.y + backY * (2.25 + hcPad + trailStep) - perpY * sideSign * (0.95 + hcPad * 0.35) - 0.3),
      bonus: 0.25,
    },
    {
      x: diver.x + backX * (2.15 + hcPad + trailStep),
      y: Math.max(0.8, diver.y + backY * (2.15 + hcPad + trailStep)),
      bonus: 0.22,
    },
    {
      x: diver.x + backX * (1.35 + hcPad * 0.85 + trailStep * 0.85),
      y: Math.max(0.8, diver.y + backY * (1.35 + hcPad * 0.85 + trailStep * 0.85)),
      bonus: 0.1,
    },
  ];
  let bestSlot = slots[2];
  let bestScore = -Infinity;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const clear = openWaterClearance(level, s.x, s.y);
    const score = Math.min(2.4, clear) + s.bonus;
    if (score > bestScore) {
      bestScore = score;
      bestSlot = s;
    }
  }
  return { x: bestSlot.x, y: bestSlot.y };
}

function chooseTorchAimAngle(buddy, session, dt) {
  const { level, diver, collectedIds, checkpointsHit, drills } = session;
  buddy.sweepPhase = (buddy.sweepPhase || 0) + dt * 1.15;

  // 1. Primary torch failure backup: lock beam directly ahead of player
  if (!diver.torchOn || drills?.active?.kind === 'torch-fail') {
    const aheadX = diver.x + Math.cos(diver.angle || 0) * 6.5;
    const aheadY = diver.y + Math.sin(diver.angle || 0) * 6.5;
    return Math.atan2(aheadY - buddy.y, aheadX - buddy.x);
  }

  // 2. Assisting player close-up (snag cut or gas share): illuminate player workspace
  if (buddy.mode === 'assist-snag' || buddy.mode === 'assist-gas') {
    return Math.atan2(diver.y - buddy.y, diver.x - buddy.x);
  }

  // 3. Spotlight nearest uncollected collectible within 14m (24m while actively scouting)
  const searchRange = buddy.mode === 'scout' ? 24 : 14;
  const nearCol = findNearestUncollected(level, collectedIds, buddy.x, buddy.y, searchRange);
  if (nearCol) {
    return Math.atan2(nearCol.item.y - buddy.y, nearCol.item.x - buddy.x);
  }

  // 4. Scout or guide toward next unhit checkpoint (within 18m) or exit during ascent
  if (buddy.mode === 'ascend' && level?.exitZone) {
    return Math.atan2(level.exitZone.y - buddy.y, level.exitZone.x - buddy.x);
  }
  const nextCp = Array.isArray(level?.checkpoints)
    ? level.checkpoints.find((cp) => cp && !checkpointsHit?.has(cp.id))
    : null;
  if (nextCp) {
    const cpDist = Math.hypot(nextCp.x - buddy.x, nextCp.y - buddy.y);
    if (cpDist <= (buddy.mode === 'scout' ? 26 : 16)) {
      return Math.atan2(nextCp.y - buddy.y, nextCp.x - buddy.x);
    }
  }

  // 5. Gentle lateral cave-wall sweep ahead of player's travel direction
  const baseHeading = Number.isFinite(diver.angle) ? diver.angle : buddy.angle;
  return baseHeading + Math.sin(buddy.sweepPhase) * 0.34;
}

/**
 * Advance AI Dive Buddy steering, collision avoidance, secondary torch targeting,
 * proactive scuba safety callouts, snag-cut rescue, and emergency gas sharing.
 */
export function stepAiBuddy(buddy, session, dt, callbacks = {}) {
  if (!buddy || buddy.alive === false || !session || !session.level || !session.diver || dt <= 0) {
    return null;
  }
  if (session.endedState || session.diveState?.alive === false) {
    return null;
  }

  const { level, diver, diveState } = session;
  const nowMs = callbacks.timestampMs ?? callbacks.nowMs ?? Date.now();
  const clampedDt = Math.min(0.1, dt);

  // Record breadcrumb trail behind player for anti-stranding follow through tight sumps
  const trailDx = diver.x - (buddy._lastTrailX ?? diver.x);
  const trailDy = diver.y - (buddy._lastTrailY ?? diver.y);
  if (Math.hypot(trailDx, trailDy) >= 1.5) {
    buddy._lastTrailX = diver.x;
    buddy._lastTrailY = diver.y;
    buddy.playerTrail.push({ x: diver.x, y: diver.y });
    if (buddy.playerTrail.length > 24) buddy.playerTrail.shift();
  }

  // Tick cooldowns
  buddy.gasShareCooldown = Math.max(0, (buddy.gasShareCooldown || 0) - clampedDt);
  for (const key of Object.keys(buddy.calloutCooldowns)) {
    buddy.calloutCooldowns[key] = Math.max(0, (buddy.calloutCooldowns[key] || 0) - clampedDt);
  }
  if (buddy.modeTimer > 0) {
    buddy.modeTimer = Math.max(0, buddy.modeTimer - clampedDt);
    if (buddy.modeTimer === 0 && buddy.mode !== 'follow') {
      buddy.mode = 'follow';
      buddy.condition = 'NOMINAL';
    }
  }

  // Keep AI buddy gas mix optimal for its depth & simulate gentle realistic consumption
  const recGas = getRecommendedGas(
    { ...diveState, depthM: buddy.depthM },
    { ascending: buddy.mode === 'ascend' }
  );
  if (recGas && (diveState.mixes?.[recGas] || GAS_MIXES[recGas])) {
    buddy.gasId = recGas;
  } else if (diveState.activeGasId) {
    buddy.gasId = diveState.activeGasId;
  }
  const ata = 1 + Math.max(0, buddy.depthM) / 10;
  buddy.activeBar = Math.max(40, buddy.activeBar - 0.055 * ata * clampedDt);

  const distToPlayer = Math.hypot(diver.x - buddy.x, diver.y - buddy.y);
  const activeTank = diveState.tanks?.[diveState.activeGasId];
  const playerBar = Number.isFinite(activeTank?.bar) ? activeTank.bar : 200;

  // --- Priority 1: Emergency Wreck Snag / Line Entanglement Assist ---
  if (Number.isInteger(session.activeSnagIndex) && session.activeSnagIndex >= 0) {
    buddy.mode = 'assist-snag';
    buddy.modeTimer = 4.0;
    buddy.condition = 'NET ASSIST';
    if (buddy.calloutCooldowns.snag <= 0) {
      buddy.calloutCooldowns.snag = 12;
      triggerDiverSignal(buddy, 'attention', nowMs);
      callbacks.onBuddySignal?.(buddy, 'attention');
    }
    if (distToPlayer <= 2.9) {
      buddy.snagAssistTimer = (buddy.snagAssistTimer || 0) + clampedDt;
      if (buddy.snagAssistTimer >= 1.55) {
        buddy.snagAssistTimer = 0;
        const snags = level.snagZones || [];
        const snag = snags[session.activeSnagIndex];
        if (snag && session.cutSnagIds) {
          session.cutSnagIds.add(snag.id || `snag-${session.activeSnagIndex}`);
        }
        session.activeSnagIndex = -1;
        buddy.snagsAssisted = (buddy.snagsAssisted || 0) + 1;
        buddy.mode = 'follow';
        buddy.modeTimer = 0;
        buddy.condition = 'NOMINAL';
        triggerDiverSignal(buddy, 'ok', nowMs);
        callbacks.onBuddyCutSnag?.(buddy);
      }
    }
  } else {
    buddy.snagAssistTimer = 0;
  }

  // --- Priority 2: Automatic or Requested Emergency Gas Share ---
  const autoGasNeed = playerBar < 34 && buddy.activeBar >= 62 && buddy.gasShareCooldown <= 0;
  const requestedGasNeed =
    buddy.mode === 'assist-gas' && playerBar < 165 && buddy.activeBar >= 58 && buddy.gasShareCooldown <= 0;

  if (autoGasNeed && buddy.mode !== 'assist-gas' && buddy.mode !== 'assist-snag') {
    buddy.mode = 'assist-gas';
    buddy.modeTimer = 14;
    buddy.condition = 'GAS ASSIST';
    triggerDiverSignal(buddy, 'share-air', nowMs);
    callbacks.onBuddySignal?.(buddy, 'share-air');
  }

  if ((autoGasNeed || requestedGasNeed) && distToPlayer <= 3.2) {
    const donateBar = Math.min(35, Math.max(15, Math.round(buddy.activeBar - 42)));
    const safeGasId = diveState.activeGasId || buddy.gasId || 'EAN32';
    const added = receiveGasIntoState(diveState, safeGasId, donateBar);
    if (added > 0) {
      buddy.activeBar = Math.max(40, buddy.activeBar - added);
      buddy.gasShareCooldown = 14;
      buddy.gasDonatedTotalBar = Math.round((buddy.gasDonatedTotalBar + added) * 10) / 10;
      buddy.gasDonationsCount = (buddy.gasDonationsCount || 0) + 1;
      buddy.mode = 'follow';
      buddy.modeTimer = 0;
      buddy.condition = 'NOMINAL';
      pushAirShareBeam(session, {
        peerId: buddy.id,
        peerName: buddy.name,
        fromSelf: false,
        gasId: safeGasId,
        amountBar: Math.round(added),
      });
      triggerDiverSignal(buddy, 'ok', nowMs);
      callbacks.onBuddyGasShare?.({
        buddy,
        gasId: safeGasId,
        amountBar: Math.round(added),
      });
    }
  }

  // --- Auto-rejoin if player swims far past a HOLD position ---
  if (buddy.mode === 'hold' && distToPlayer > 24) {
    buddy.mode = 'follow';
    buddy.modeTimer = 0;
    buddy.condition = 'NOMINAL';
  }

  // --- Proactive Technical Safety & Discovery Callouts ---
  if (buddy.mode === 'follow' || buddy.mode === 'scout') {
    // Low-gas warning before critical auto-share
    if (playerBar < 58 && playerBar >= 34 && buddy.calloutCooldowns.lowGas <= 0) {
      buddy.calloutCooldowns.lowGas = 26;
      triggerDiverSignal(buddy, 'low-gas', nowMs);
      callbacks.onBuddySignal?.(buddy, 'low-gas');
    } else if (diveState.stopDepthM >= 3 && diveState.ascentRateMpm > 8 && buddy.calloutCooldowns.deco <= 0) {
      buddy.calloutCooldowns.deco = 24;
      triggerDiverSignal(buddy, 'hold', nowMs);
      callbacks.onBuddySignal?.(buddy, 'hold');
    } else if (buddy.calloutCooldowns.collectible <= 0) {
      const spotted = findNearestUncollected(level, session.collectedIds, buddy.x, buddy.y, 10.5);
      if (spotted && !buddy.spottedCollectibleIds.has(spotted.item.id)) {
        buddy.spottedCollectibleIds.add(spotted.item.id);
        buddy.calloutCooldowns.collectible = 14;
        triggerDiverSignal(buddy, 'attention', nowMs);
        callbacks.onBuddySignal?.(buddy, 'attention');
      }
    }
  }

  // --- Steering & SDF-Safe Wall Avoidance ---
  let target = chooseFormationTarget(level, diver, buddy, session.difficulty === 'hardcore');
  // If far away, follow the player's recent breadcrumb trail so buddy navigates around rock bends cleanly
  if (buddy.mode !== 'hold' && distToPlayer > 7.5 && buddy.playerTrail.length > 0) {
    let bestTrail = null;
    for (let i = buddy.playerTrail.length - 1; i >= 0; i--) {
      const pt = buddy.playerTrail[i];
      if (Math.hypot(pt.x - buddy.x, pt.y - buddy.y) <= 6.5) {
        bestTrail = buddy.playerTrail[Math.min(buddy.playerTrail.length - 1, i + 2)];
        break;
      }
    }
    if (bestTrail) target = bestTrail;
  }

  const dx = target.x - buddy.x;
  const dy = target.y - buddy.y;
  const distToTarget = Math.hypot(dx, dy);

  const urgent = buddy.mode === 'assist-gas' || buddy.mode === 'assist-snag';
  const maxSpeed = urgent ? 4.35 : distToPlayer > 10 ? 4.1 : 3.1;
  const desiredSpeed =
    distToTarget < 0.35
      ? 0
      : Math.min(maxSpeed, Math.max(0.55, distToTarget * (urgent ? 2.4 : 1.55)));

  let desVx = distToTarget > 0.05 ? (dx / distToTarget) * desiredSpeed : 0;
  let desVy = distToTarget > 0.05 ? (dy / distToTarget) * desiredSpeed : 0;

  // Gentle wall-clearance repulsion using cave SDF gradient (normal points INTO rock, so push along -normal)
  const wallClear = openWaterClearance(level, buddy.x, buddy.y);
  if (wallClear < 1.25) {
    evaluateCaveNormal(level, buddy.x, buddy.y, _normScratch);
    const push = (1.25 - wallClear) * 2.4;
    desVx -= _normScratch.nx * push;
    desVy -= _normScratch.ny * push;
  }

  // Friendly inter-squadmate spacing repulsion so 2–3 AI wingmen hold staggered single-file trim
  const squadPeers = Array.isArray(callbacks.squadPeers) ? callbacks.squadPeers : null;
  if (squadPeers && squadPeers.length > 0) {
    const minSep = session.difficulty === 'hardcore' ? 1.65 : 1.25;
    for (let i = 0; i < squadPeers.length; i++) {
      const other = squadPeers[i];
      if (!other || other === buddy || other.alive === false) continue;
      const sx = buddy.x - other.x;
      const sy = buddy.y - other.y;
      const sd = Math.hypot(sx, sy);
      if (sd > 0.01 && sd < minSep) {
        const rep = ((minSep - sd) / minSep) * 2.6;
        desVx += (sx / sd) * rep;
        desVy += (sy / sd) * rep;
      }
    }
  }

  const accel = Math.min(1, clampedDt * (urgent ? 5.6 : 4.2));
  buddy.vx += (desVx - buddy.vx) * accel;
  buddy.vy += (desVy - buddy.vy) * accel;

  buddy.x += buddy.vx * clampedDt;
  buddy.y = Math.max(0.65, buddy.y + buddy.vy * clampedDt);
  resolveDiverCollision(level, buddy, 0.52);

  // Anti-stranding warp if player zipped far down a shot line or strong surge separated them
  if (buddy.mode !== 'hold' && distToPlayer > 22) {
    buddy.strandedTimer = (buddy.strandedTimer || 0) + clampedDt;
    if (buddy.strandedTimer >= 2.6) {
      buddy.strandedTimer = 0;
      const regroup = findSafeSpawnOffset(level, diver, buddy.slotIndex || 0);
      buddy.x = regroup.x;
      buddy.y = regroup.y;
      buddy.vx = 0;
      buddy.vy = 0;
      resolveDiverCollision(level, buddy, 0.52);
    }
  } else {
    buddy.strandedTimer = 0;
  }

  buddy.depthM = Math.max(0, buddy.y);

  // Smooth swimming orientation + intelligent secondary torch aim
  const speed = Math.hypot(buddy.vx, buddy.vy);
  const desiredBodyAngle =
    speed > 0.32 ? Math.atan2(buddy.vy, buddy.vx) : Math.atan2(diver.y - buddy.y, diver.x - buddy.x);
  buddy.angle = lerpAngle(buddy.angle, desiredBodyAngle, clampedDt * 5.2);

  const desiredTorchAngle = chooseTorchAimAngle(buddy, session, clampedDt);
  buddy.torchAngle = lerpAngle(buddy.torchAngle, desiredTorchAngle, clampedDt * 6.5);
  buddy.torchManualAim = true;
  buddy.torchOn = true;

  // Realistic calm physiological heart rate reflecting exertion
  const targetHr = Math.round(68 + Math.min(1, speed / 3.8) * 32 + (urgent ? 18 : 0));
  buddy.heartRateBpm += (targetHr - buddy.heartRateBpm) * Math.min(1, clampedDt * 2.0);

  // Update articulated limbs & fins
  stepDiverBody(buddy, clampedDt, {
    thrustMag: Math.min(1, speed / 3.0),
    level,
  });

  return {
    mode: buddy.mode,
    distToPlayer,
    torchAngle: buddy.torchAngle,
  };
}

/**
 * Step an entire 1..3 wingman AI Dive Squad cleanly, including Hardcore mutual collision among squadmates.
 */
export function stepAiSquad(squad, session, dt, callbacks = {}) {
  if (!Array.isArray(squad) || squad.length === 0 || !session) return [];
  const results = [];
  for (let i = 0; i < squad.length; i++) {
    const buddy = squad[i];
    if (!buddy) continue;
    results.push(stepAiBuddy(buddy, session, dt, { ...callbacks, squadPeers: squad }));
  }
  if (session.difficulty === 'hardcore' && squad.length > 1 && (session.simTimeSec >= 2.0 || (session.diver?.y || 0) > 2.2)) {
    for (let i = 0; i < squad.length; i++) {
      const a = squad[i];
      if (!a || a.alive === false) continue;
      const others = squad.slice(i + 1);
      resolveDiverPeerCollisions(session.level, a, others);
    }
  }
  return results;
}

/**
 * Dispatch a player hand-signal across an AI Dive Squad (closest wingman handles emergency gas/snag assists;
 * full squad responds to OK / HOLD / ATTENTION / ASCEND).
 */
export function handlePlayerSignalForAiSquad(squad, idOrText, session, nowMs = Date.now()) {
  if (!Array.isArray(squad) || squad.length === 0) return { responded: false };
  const spec = getScubaSignalById(idOrText);
  const sigId = spec?.id || 'ok';
  const diver = session?.diver;

  if (sigId === 'low-gas' || sigId === 'share-air') {
    let best = squad[0];
    let bestScore = -Infinity;
    for (let i = 0; i < squad.length; i++) {
      const b = squad[i];
      const d = diver ? Math.hypot(b.x - diver.x, b.y - diver.y) : 0;
      const score = (b.activeBar || 0) - d * 6;
      if (score > bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return handlePlayerSignalForAiBuddy(best, idOrText, session, nowMs);
  }

  let primaryRes = null;
  for (let i = 0; i < squad.length; i++) {
    const res = handlePlayerSignalForAiBuddy(squad[i], idOrText, session, nowMs);
    if (!primaryRes && res.responded) primaryRes = res;
  }
  if (!primaryRes) return { responded: false };
  if (squad.length > 1) {
    const names = squad.map((b) => b.name.replace(/^🤖\s*/, '')).join(', ');
    primaryRes = {
      ...primaryRes,
      toast: `🤖 Squad (${names}): ${primaryRes.toast.replace(/^[^:]+:\s*/, '')}`,
    };
  }
  return primaryRes;
}
