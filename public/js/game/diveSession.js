import { getAscentConfig } from '../levels/index.js';
import { createDiveState, stepDivePhysiology, receiveGasIntoState, computeTissueCompartmentStatus } from '../physics/diveModel.js';
import { resolveDiverCollision, resolveDiverPeerCollisions, evaluateCaveSDF, evaluateCaveNormal } from './collision.js';
import { createDynamicHazards, stepDynamicHazards } from './dynamicHazards.js';
import { createDiverBody, stepDiverBody, computeTargetSwimAngle } from './diverBody.js';
import { stirFloorSilt, spawnSiltPlume, stepSiltPhysics } from './silt.js';
import { buildExploreCells, markExploredAround, computeDiverScoreSummary, MAX_PHOTO_BONUS, MAX_ENCOUNTER_BONUS, MAX_DRILL_BONUS } from './scoring.js';
import { getFieldGuideEntry } from './logbookModel.js';
import { castLightRay } from './lighting.js';
import { getScubaSignalById, computeTorchSignalGesture } from './diveSignals.js';
import { resolveEffectiveWeather, computeWeatherSwellForce } from './weather.js';
import {
  createSalvageState,
  isHatchPressurized,
  computeSalvageBuoyancy,
  toggleLiftBag,
  stepSalvageBuoyancy,
} from './salvagePhysics.js';
import {
  createMechanicalFxState,
  recordMechanicalEvent,
  stepMechanicalFx,
} from './mechanicalFx.js';
import {
  createSubmergedStories,
  stepSubmergedStories,
} from './submergedStories.js';

export { toggleLiftBag, isHatchPressurized, computeSalvageBuoyancy };

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
  {
    diverName = 'Diver 1',
    spawnOffsetX = 0,
    spawnOffsetY = 0,
    difficulty = 'standard',
    gear = null,
    mutatorId = '',
    dailyDateKey = '',
    customMixOverrides = null,
    drillsEnabled = false,
    weatherId = 'clear-day',
    livery = null,
  } = {}
) {
  const spawnX = level.spawn.x + spawnOffsetX;
  const spawnY = level.spawn.y + spawnOffsetY;
  const exploreCells = buildExploreCells(level);
  const exploredCells = new Set();
  const exploredGrid = new Set();
  markExploredAround(exploreCells, exploredCells, spawnX, spawnY, 5.2, exploredGrid);
  const exploredPct = Math.round((exploredCells.size / Math.max(1, exploreCells.length)) * 100);
  const cleanDiff = difficulty === 'guided' || difficulty === 'hardcore' ? difficulty : 'standard';
  const cleanMutator = typeof mutatorId === 'string' ? mutatorId.trim() : '';
  const cleanDailyKey = typeof dailyDateKey === 'string' ? dailyDateKey.trim() : '';
  const isPurist = cleanMutator === 'purist';
  const cleanGear = isPurist
    ? { sonar: false, dpv: false, ccr: false }
    : {
        sonar: Boolean(gear?.sonar),
        dpv: Boolean(gear?.dpv),
        ccr: Boolean(gear?.ccr),
      };
  const mergedMixOverrides =
    customMixOverrides && typeof customMixOverrides === 'object'
      ? { ...(level.gasOverrides || {}), ...customMixOverrides }
      : level.gasOverrides;
  const resolvedWeather = resolveEffectiveWeather(weatherId, { level });

  return {
    level,
    difficulty: cleanDiff,
    mutatorId: cleanMutator,
    dailyDateKey: cleanDailyKey,
    weather: resolvedWeather,
    weatherBonusScore: resolvedWeather?.scoreBonus || 0,
    forceHideCompass: isPurist,
    gear: cleanGear,
    dpv: {
      equipped: cleanGear.dpv,
      active: false,
      batteryPct: 100,
      thrusting: false,
      humAccum: 0,
    },
    sonar: {
      equipped: cleanGear.sonar,
      cooldownSec: 0,
      maxCooldownSec: 9.0,
      activePulse: null,
    },
    camera: {
      cooldownSec: 0,
      maxCooldownSec: 1.25,
      activeFlash: null,
      photoCount: 0,
      photoBonusScore: 0,
      photographedIds: new Set(),
      photos: [],
    },
    encounters: createDynamicEncounters(level),
    hazards: createDynamicHazards(level),
    bioWake: [],
    _bioWakeAccum: 0,
    surfaceRipples: [],
    _rippleAccum: 0,
    buddyPing: null,
    airShareBeams: [],
    peerProfiles: new Map(),
    _lastPeerProfileSampleAt: -99,
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
      strobeMod: 1.0,
      hasCcr: cleanGear.ccr,
      hasDpv: cleanGear.dpv,
      dpvActive: false,
      dpvThrusting: false,
      livery: livery ? { ...livery } : null,
      name: diverName,
      body: createDiverBody(spawnX, spawnY),
    },
    diveState: createDiveState({ mixOverrides: mergedMixOverrides, ccrEnabled: cleanGear.ccr }),
    droppedStages: [],
    spareStageDropped: false,
    drills: {
      enabled: Boolean(drillsEnabled),
      active: null, // { kind: 'mask-flood' | 'torch-fail' | 'free-flow', elapsedSec, severity, hissAccum }
      cooldownSec: 22,
      completedCount: 0,
      bonusScore: 0,
      history: [],
      backupTorchActive: false,
    },
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
    exploredGrid,
    exploredPct,
    surfaced: false,
    siltClouds: [],
    siltStirTimer: { accum: 0, warnCooldown: 0 },
    hrWarnCooldown: 0,
    restrictWarnCooldown: 0,
    snagWarnCooldown: 0,
    surgeWarnCooldown: 0,
    caveFlowWarnCooldown: 0,
    rustPercolateCooldown: 0,
    hullGroanTimer: 8.5 + Math.random() * 9.0,
    clippedToShotLine: false,
    cutSnagIds: new Set(),
    claimedStageIds: new Set(),
    placedMarkerIds: new Set(),
    activeSnagIndex: -1,
    buddySnagIndex: -1,
    buddySnagName: '',
    openedHatchIds: new Set(),
    equalizedHatchIds: new Set(),
    crankingHatchId: null,
    crankingHatchProgress: 0,
    crankTickAccum: 0,
    hatchBonusScore: 0,
    salvage: createSalvageState(),
    mechFx: createMechanicalFxState(),
    stories: createSubmergedStories(level),
    spaceClearanceM: 4.0,
    runMilestones: {
      usedLiftBagWithHeavySalvage: false,
      floatUpIncident: false,
      heavySiltEvents: 0,
    },
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
    _wasSubmerged: (level.spawn?.y ?? 2) > 0.75,
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
 * Toggle equipped DPV underwater scooter cruise propulsion on/off.
 */
export function toggleDpvScooter(session) {
  if (!session?.dpv?.equipped || !session.diveState?.alive || session.surfaced) {
    return { ok: false, active: false, reason: 'unavailable' };
  }
  if (!session.dpv.active && (session.dpv.batteryPct || 0) <= 0.5) {
    return { ok: false, active: false, reason: 'empty' };
  }
  session.dpv.active = !session.dpv.active;
  if (!session.dpv.active) session.dpv.thrusting = false;
  if (session.diver) {
    session.diver.dpvActive = session.dpv.active;
    session.diver.dpvThrusting = session.dpv.thrusting;
  }
  return { ok: true, active: session.dpv.active, batteryPct: session.dpv.batteryPct };
}

/**
 * Emit a 360-degree Cave Sonar hydrophone pulse (28m range, 9s cooldown).
 * Maps rock-wall echo contours & highlights nearby relics, hatches, stage caches, markers & targets through darkness/silt.
 */
export function triggerSonarPing(session, callbacks = {}) {
  if (!session?.sonar?.equipped || !session.diveState?.alive || session.surfaced) {
    return { ok: false, reason: 'unavailable' };
  }
  if ((session.sonar.cooldownSec || 0) > 0.05) {
    return { ok: false, reason: 'cooldown', remainingSec: session.sonar.cooldownSec };
  }

  const { level, diver } = session;
  const maxRadiusM = 28.0;
  const rayCount = 48;
  const wallHits = [];
  for (let i = 0; i < rayCount; i++) {
    const ang = (i / rayCount) * Math.PI * 2;
    const hit = castLightRay(level, diver.x, diver.y, ang, maxRadiusM, []);
    if (hit && hit.hitWall && hit.dist > 0.6 && hit.dist <= maxRadiusM) {
      wallHits.push({ x: hit.x, y: hit.y, dist: hit.dist });
    }
  }

  const contacts = [];
  const addContact = (x, y, kind, icon, label, extra = null) => {
    const dist = Math.hypot(x - diver.x, y - diver.y);
    if (dist <= maxRadiusM && dist >= 0.4) {
      contacts.push(extra ? { x, y, dist, kind, icon, label, ...extra } : { x, y, dist, kind, icon, label });
    }
  };
  for (const c of level.collectibles || []) {
    if (!session.collectedIds?.has(c.id)) addContact(c.x, c.y, 'collectible', '💎', c.name);
  }
  for (const h of level.watertightHatches || []) {
    if (!session.openedHatchIds?.has(h.id)) addContact(h.x, h.y, 'hatch', '⚙️', h.label);
  }
  for (const st of level.stageCaches || []) {
    if (!session.claimedStageIds?.has(st.id)) addContact(st.x, st.y, 'stage', '⛽', st.label);
  }
  for (const a of level.lineAnchors || []) {
    if (!session.placedMarkerIds?.has(a.id)) addContact(a.x, a.y, 'marker', '📍', a.label);
  }
  if (level.recoveryTarget && !session.bodyRecovered) {
    addContact(level.recoveryTarget.x, level.recoveryTarget.y, 'recovery', '🎯', level.recoveryTarget.name);
  }
  if (session.encounters?.beacon && !session.encounters.beacon.claimed) {
    const bc = session.encounters.beacon;
    addContact(bc.x, bc.y, 'beacon', '📡', bc.label);
  }
  // v142 Acoustic Hazard Echoes: tag shifting surge hatches, fragile percolation ceilings & thermoclines through silt
  if (session.hazards) {
    for (const sh of session.hazards.shiftingHatches || []) {
      addContact(sh.x, sh.y, 'shifting-hatch', '🚪', sh.label, { hatchRef: sh, radius: sh.radius });
    }
    for (const pz of session.hazards.percolationZones || []) {
      addContact(pz.x, pz.ceilY + 0.4, 'percolation', '🌫️', 'Fragile Ceiling', {
        ceilY: pz.ceilY,
        halfWidth: pz.halfWidth,
      });
    }
    for (const th of session.hazards.thermoclines || []) {
      addContact(th.x, th.y, 'thermocline', '❄️', `-${th.tempDropC}°C Thermocline`, {
        tempDropC: th.tempDropC,
        rx: th.rx,
        ry: th.ry,
      });
    }
  }

  // Wide sonar sweep also charts nearby unexplored cells cleanly
  const newlyMapped = markExploredAround(session.exploreCells, session.exploredCells, diver.x, diver.y, 12.0, session.exploredGrid);
  if (newlyMapped > 0 && session.exploreCells?.length > 0) {
    session.exploredPct = Math.round((session.exploredCells.size / session.exploreCells.length) * 100);
  }

  const pulse = {
    x: diver.x,
    y: diver.y,
    ageSec: 0,
    durationSec: 3.8,
    maxRadiusM,
    wallHits,
    contacts,
    summary: {
      collectibles: contacts.filter((c) => c.kind === 'collectible').length,
      hatches: contacts.filter((c) => c.kind === 'shifting-hatch' || c.kind === 'hatch').length,
      percolation: contacts.filter((c) => c.kind === 'percolation').length,
      thermoclines: contacts.filter((c) => c.kind === 'thermocline').length,
    },
  };
  session.sonar.activePulse = pulse;
  session.sonar.cooldownSec = session.sonar.maxCooldownSec || 9.0;
  callbacks.onSonarPing?.(pulse);
  return { ok: true, pulse };
}

const RARITY_WEIGHT = { epic: 4, rare: 3, uncommon: 2, common: 1 };

/**
 * Trigger the underwater twin-strobe camera along the diver's torch/heading vector,
 * capturing visible wildlife, cave formations, or geothermal landmarks for the Field Guide.
 */
export function captureCameraPhoto(session, ecosystem = null, { knownIds = null } = {}, callbacks = {}) {
  if (!session?.camera || !session.diveState?.alive || session.surfaced) {
    return { ok: false, reason: 'unavailable' };
  }
  if ((session.camera.cooldownSec || 0) > 0.05) {
    return { ok: false, reason: 'cooldown', remainingSec: session.camera.cooldownSec };
  }

  const { level, diver } = session;
  const aimAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : (diver.angle || 0);
  const maxRangeM = 12.5;
  const halfConeRad = 0.86;
  const silt = session.localSiltDensity || 0;
  const candidates = [];

  const consider = (entryId, tx, ty) => {
    const entry = getFieldGuideEntry(entryId);
    if (!entry) return;
    const dx = tx - diver.x;
    const dy = ty - diver.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.35 || dist > maxRangeM) return;
    const angTo = Math.atan2(dy, dx);
    let angDiff = Math.abs(angTo - aimAng);
    while (angDiff > Math.PI) angDiff = Math.abs(angDiff - Math.PI * 2);
    if (angDiff > halfConeRad) return;
    const ray = castLightRay(level, diver.x, diver.y, angTo, dist, []);
    if (ray && ray.hitWall && ray.dist < dist - 0.85) return;

    let q = 0;
    q += angDiff <= 0.34 ? 1.0 : angDiff <= 0.62 ? 0.6 : 0.2;
    q += dist >= 1.2 && dist <= 8.5 ? 1.0 : dist <= 11.0 ? 0.6 : 0.3;
    q += silt < 0.22 ? 1.0 : silt < 0.48 ? 0.5 : 0.15;
    const stars = Math.max(1, Math.min(3, Math.round(q)));

    const isNewInGuide = knownIds instanceof Set ? !knownIds.has(entry.id) : false;
    const isNewThisDive = !session.camera.photographedIds.has(entry.id);
    const rarityW = RARITY_WEIGHT[entry.rarity] || 1;
    const priority =
      (isNewInGuide ? 1000 : 0) +
      (isNewThisDive ? 400 : 0) +
      rarityW * 80 +
      stars * 25 -
      dist * 3 -
      angDiff * 15;

    candidates.push({ entry, tx, ty, dist, stars, isNewInGuide, isNewThisDive, priority });
  };

  if (ecosystem) {
    for (const m of ecosystem.megafauna || []) consider(m.kind, m.x, m.y);
    for (const t of ecosystem.turtles || []) consider('slider', t.x, t.y);
    for (const j of ecosystem.jellies || []) consider('jellyfish', j.x, j.y);
    for (const f of ecosystem.fish || []) {
      const id = f.kind === 'molly' ? 'cichlid' : f.kind;
      consider(id, f.x, f.y);
    }
    for (const r of ecosystem.remipedes || []) consider(r.kind, r.x, r.y);
    for (const a of ecosystem.anchored || []) {
      if (a.kind === 'seafan' || a.kind === 'rusticle' || a.kind === 'sodastraw' || a.kind === 'crystal') {
        consider(a.kind, a.x, a.y);
      }
    }
  }
  for (const v of level.geothermalVents || []) {
    consider('hydrovent', v.x, v.y - Math.min(3.5, (v.height || 10) * 0.3));
  }
  for (const c of level.collectibles || []) {
    if (c.kind === 'crystal' && !session.collectedIds?.has(c.id)) {
      consider('crystal', c.x, c.y);
    }
  }
  // Dynamic Pelagic Visitors (Whale Sharks, Manta Rays, Bioluminescent Swarms) — extended 19m wide-angle lens reach!
  if (Array.isArray(session.encounters?.visitors)) {
    for (const v of session.encounters.visitors) {
      const entryId = v.kind === 'whaleshark' || v.kind === 'mantaray' ? v.kind : 'jellyfish';
      const entry = getFieldGuideEntry(entryId);
      if (!entry) continue;
      const dx = v.x - diver.x;
      const dy = v.y - diver.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.5 || dist > 19.5) continue;
      const angTo = Math.atan2(dy, dx);
      let angDiff = Math.abs(angTo - aimAng);
      while (angDiff > Math.PI) angDiff = Math.abs(angDiff - Math.PI * 2);
      if (angDiff > halfConeRad + 0.14) continue;
      const ray = castLightRay(level, diver.x, diver.y, angTo, dist, []);
      if (ray && ray.hitWall && ray.dist < dist - 1.2) continue;
      let q = 0;
      q += angDiff <= 0.38 ? 1.0 : angDiff <= 0.68 ? 0.65 : 0.25;
      q += dist <= 13.0 ? 1.0 : 0.6;
      q += silt < 0.25 ? 1.0 : 0.5;
      const stars = Math.max(1, Math.min(3, Math.round(q)));
      const isNewInGuide = knownIds instanceof Set ? !knownIds.has(entry.id) : false;
      const isNewThisDive = !session.camera.photographedIds.has(entry.id);
      const priority = (isNewInGuide ? 1200 : 0) + (isNewThisDive ? 500 : 0) + (RARITY_WEIGHT[entry.rarity] || 3) * 100 + stars * 25;
      candidates.push({ entry, tx: v.x, ty: v.y, dist, stars, isNewInGuide, isNewThisDive, priority });
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const best = candidates[0] || null;

  let points = 0;
  let subject = null;
  let stars = 0;
  let isNewInGuide = false;
  let isNewThisDive = false;
  let depthM = Math.max(0, diver.y);

  if (best) {
    subject = best.entry;
    stars = best.stars;
    isNewInGuide = best.isNewInGuide;
    isNewThisDive = best.isNewThisDive;
    depthM = Math.max(0, best.ty);
    if (isNewThisDive) {
      session.camera.photographedIds.add(subject.id);
      const starMult = stars === 3 ? 1.0 : stars === 2 ? 0.8 : 0.6;
      const room = Math.max(0, MAX_PHOTO_BONUS - (session.camera.photoBonusScore || 0));
      points = Math.min(room, Math.round((subject.points || 60) * starMult));
      session.camera.photoBonusScore = (session.camera.photoBonusScore || 0) + points;
      callbacks.onWreckSync?.('photo', `${subject.id}:${stars}`);
    }
    session.camera.photoCount += 1;
    session.camera.photos.push({
      entryId: subject.id,
      name: subject.name,
      icon: subject.icon,
      stars,
      points,
      isNewInGuide,
      depthM: Math.round(depthM * 10) / 10,
    });
    if (points > 0 && Array.isArray(session.collectBursts)) {
      session.collectBursts.push({
        x: best.tx,
        y: best.ty,
        points,
        kind: 'photo',
        age: 0,
        duration: 1.4,
      });
    }
  }

  const flash = {
    x: diver.x,
    y: diver.y,
    angle: aimAng,
    targetX: best ? best.tx : null,
    targetY: best ? best.ty : null,
    subject,
    stars,
    isNewInGuide,
    points,
    ageSec: 0,
    durationSec: 0.72,
  };
  session.camera.activeFlash = flash;
  session.camera.cooldownSec = session.camera.maxCooldownSec || 1.25;
  const result = { ok: true, flash, subject, stars, isNewInGuide, isNewThisDive, points, depthM };
  callbacks.onCameraSnap?.(result);
  return result;
}

/**
 * Create dynamic underwater encounters for a dive session:
 * - Shifting thermocline / halocline visibility banks
 * - An optional open-water Survey / Distress Beacon mini-objective (+180 pts, +18 bar pony reserve & 15m sonar sweep)
 * - Periodic rare pelagic visitors (Whale Sharks & Manta Rays on ocean wrecks; Bioluminescent Swarms in deep caves)
 */
export function createDynamicEncounters(level) {
  const segs = Array.isArray(level?.segments) ? level.segments : [];
  const spawnX = level?.spawn?.x ?? 0;
  const spawnY = level?.spawn?.y ?? 2;
  const exitX = level?.exitZone?.x ?? spawnX;
  const exitY = level?.exitZone?.y ?? 2;

  // Deterministic pseudo-random helper keyed by level id
  let seed = 2166136261;
  const idStr = String(level?.id || 'dive');
  for (let i = 0; i < idStr.length; i++) {
    seed ^= idStr.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  const nextRand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // 1. Shifting Visibility / Thermocline Haze Banks (2-3 spaced wide chambers)
  const candidates = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const mx = (s.ax + s.bx) * 0.5;
    const my = (s.ay + s.by) * 0.5;
    const minR = Math.min(s.ra || 2, s.rb || 2);
    if (my >= 10 && minR >= 2.5 && evaluateCaveSDF(level, mx, my) < -1.5) {
      candidates.push({ x: mx, y: my, r: minR });
    }
  }
  const fogBanks = [];
  const wantBanks = Math.min(3, Math.max(1, Math.floor(candidates.length / 4)));
  for (let i = 0; i < candidates.length && fogBanks.length < wantBanks; i++) {
    const pickIdx = Math.floor(((i + 0.5) / Math.max(1, wantBanks)) * candidates.length);
    const c = candidates[Math.min(candidates.length - 1, pickIdx)];
    if (!c) continue;
    if (fogBanks.some((f) => Math.hypot(f.baseX - c.x, f.baseY - c.y) < 18)) continue;
    fogBanks.push({
      id: `fog_${fogBanks.length + 1}`,
      baseX: c.x,
      baseY: c.y,
      x: c.x,
      y: c.y,
      radiusX: Math.min(9.5, Math.max(4.8, c.r * 1.9)),
      radiusY: Math.min(4.8, Math.max(2.6, c.r * 0.95)),
      driftAmpX: 2.2 + nextRand() * 2.4,
      driftAmpY: 0.7 + nextRand() * 0.9,
      driftSpeed: 0.16 + nextRand() * 0.14,
      phase: nextRand() * Math.PI * 2,
      density: 0.32 + nextRand() * 0.14,
      tint: level?.isWreck ? 'ocean' : 'halocline',
    });
  }

  // 2. Optional Mid-Dive Survey / Emergency Distress Beacon in open water away from spawn/exit
  let beacon = null;
  let bestBeaconScore = -Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const dSpawn = Math.hypot(c.x - spawnX, c.y - spawnY);
    const dExit = Math.hypot(c.x - exitX, c.y - exitY);
    if (dSpawn < 18 || dExit < 16 || c.y < 14) continue;
    const score = Math.min(dSpawn, dExit) + c.r * 2.5 + nextRand() * 14;
    if (score > bestBeaconScore) {
      bestBeaconScore = score;
      beacon = {
        id: 'survey_beacon',
        x: c.x,
        y: c.y,
        label: level?.isWreck ? 'Distress Transponder' : 'Lost Survey Beacon',
        points: MAX_ENCOUNTER_BONUS,
        claimed: false,
        pingPhase: nextRand() * Math.PI * 2,
      };
    }
  }

  const isOceanWreck = Boolean(level?.isWreck && level?.theme?.id !== 'superior-memorial-wreck');
  return {
    fogBanks,
    beacon,
    visitors: [],
    isOceanWreck,
    nextVisitorInSec: isOceanWreck ? 12 + nextRand() * 8 : 16 + nextRand() * 10,
    visitorCount: 0,
    inFogBank: false,
    fogDensity: 0,
    fogWarnCooldown: 0,
    encounterBonusScore: 0,
  };
}

/**
 * Claim the optional Survey / Distress Beacon (+180 bonus pts, +18 bar reserve pony & 15m sonar map burst).
 */
export function claimSurveyBeacon(session, callbacks = {}) {
  const bc = session?.encounters?.beacon;
  if (!bc || bc.claimed) return { ok: false };
  bc.claimed = true;
  const pts = Math.min(MAX_ENCOUNTER_BONUS, bc.points || MAX_ENCOUNTER_BONUS);
  session.encounters.encounterBonusScore = Math.min(
    MAX_ENCOUNTER_BONUS,
    (session.encounters.encounterBonusScore || 0) + pts
  );
  // Clip spare pony reserve (+18 bar) onto active cylinder if not already full
  let addedBar = 0;
  const activeGas = session.diveState?.activeGasId;
  if (activeGas && session.diveState?.tanks?.[activeGas]?.bar < 185) {
    addedBar = receiveGasIntoState(session.diveState, activeGas, 18);
  }
  // Wide 15m acoustic telemetry sweep reveals surrounding passages on the Sonar Minimap
  const newlyMapped = markExploredAround(
    session.exploreCells,
    session.exploredCells,
    bc.x,
    bc.y,
    15.0,
    session.exploredGrid
  );
  if (newlyMapped > 0 && session.exploreCells?.length > 0) {
    session.exploredPct = Math.round((session.exploredCells.size / session.exploreCells.length) * 100);
  }
  if (Array.isArray(session.collectBursts)) {
    session.collectBursts.push({
      x: bc.x,
      y: bc.y,
      points: pts,
      kind: 'beacon',
      age: 0,
      duration: 1.6,
    });
  }
  callbacks.onBeaconClaimed?.(bc, addedBar);
  if (session.mechFx) recordMechanicalEvent(session.mechFx, 'claim-beacon', { x: bc.x, y: bc.y, targetId: bc.id });
  callbacks.onWreckSync?.('beacon', bc.id || 'beacon');
  const gasTxt = addedBar >= 1 ? ` · +${Math.round(addedBar)}b reserve` : '';
  callbacks.onToast?.(`📡 ${bc.label} salvaged! (+${pts} pts · 15m sonar map${gasTxt})`, 3.4);
  return { ok: true, beacon: bc, points: pts, addedBar };
}

/**
 * Spawn a passing Whale Shark, Manta Ray, or Bioluminescent Swarm near the diver cleanly in open water.
 */
export function spawnDynamicVisitor(session, kindOverride = null, callbacks = {}) {
  const enc = session?.encounters;
  const { level, diver } = session || {};
  if (!enc || !level || !diver) return null;

  const isOcean = enc.isOceanWreck;
  const kind =
    kindOverride ||
    (isOcean ? (enc.visitorCount % 2 === 0 ? 'mantaray' : 'whaleshark') : 'biolum-swarm');
  const dir = enc.visitorCount % 2 === 0 ? 1 : -1;

  let startX = diver.x - dir * (kind === 'biolum-swarm' ? 11 : 22);
  let startY = isOcean
    ? Math.max(7.5, Math.min((level.wreckDeckY || 42) - 4, diver.y - 2.5))
    : Math.max(12, diver.y - 0.8);

  // For cave swarms, verify an open-water spot near the diver
  if (!isOcean) {
    if (evaluateCaveSDF(level, diver.x + dir * 6, diver.y) < -1.0) {
      startX = diver.x + dir * 6;
      startY = diver.y;
    } else if (evaluateCaveSDF(level, diver.x, diver.y) < -1.0) {
      startX = diver.x - dir * 3;
      startY = diver.y;
    } else {
      return null;
    }
  }

  const speed = kind === 'whaleshark' ? 1.55 : kind === 'mantaray' ? 2.45 : 0.65;
  const visitor = {
    id: `vis_${enc.visitorCount + 1}`,
    kind,
    x: startX,
    y: startY,
    vx: dir * speed,
    vy: 0,
    dir,
    size: kind === 'whaleshark' ? 4.4 : kind === 'mantaray' ? 2.6 : 1.9,
    phase: enc.visitorCount * 1.9,
    ageSec: 0,
    durationSec: kind === 'biolum-swarm' ? 22 : 24,
  };
  enc.visitors.push(visitor);
  enc.visitorCount += 1;
  callbacks.onEncounterSpawn?.(visitor);
  if (kind === 'whaleshark') {
    callbacks.onToast?.('🐋 Rare sighting! A Whale Shark is gliding nearby — snap it with [C]!', 3.6);
  } else if (kind === 'mantaray') {
    callbacks.onToast?.('🦅 Oceanic Manta Ray sweeping past the wreck — press [C] to photograph!', 3.4);
  } else {
    callbacks.onToast?.('✨ Bioluminescent comb-jelly swarm drifting through the cavern!', 3.0);
  }
  return visitor;
}

function stepDynamicEncounters(session, dt, callbacks = {}) {
  const enc = session?.encounters;
  if (!enc) return;
  const { diver, simTimeSec } = session;

  // 1. Drift shifting visibility / thermocline haze banks & sample local density
  if (enc.fogWarnCooldown > 0) enc.fogWarnCooldown -= dt;
  let fogDensity = 0;
  for (let i = 0; i < enc.fogBanks.length; i++) {
    const fb = enc.fogBanks[i];
    fb.x = fb.baseX + Math.sin(simTimeSec * fb.driftSpeed + fb.phase) * fb.driftAmpX;
    fb.y = fb.baseY + Math.cos(simTimeSec * fb.driftSpeed * 0.72 + fb.phase) * fb.driftAmpY;
    const nx = (diver.x - fb.x) / fb.radiusX;
    const ny = (diver.y - fb.y) / fb.radiusY;
    const d2 = nx * nx + ny * ny;
    if (d2 < 1) {
      const local = (1 - Math.sqrt(d2)) * fb.density;
      if (local > fogDensity) fogDensity = local;
    }
  }
  const wasInFog = enc.inFogBank;
  enc.fogDensity = fogDensity;
  enc.inFogBank = fogDensity >= 0.08;
  if (enc.inFogBank && !wasInFog && enc.fogWarnCooldown <= 0) {
    enc.fogWarnCooldown = 28;
    callbacks.onToast?.('🌫️ Drifting thermocline haze — watch trim & sonar map!', 2.6);
  }

  // 2. Advance & spawn rare passing visitors (Whale Sharks, Manta Rays, Bioluminescent Swarms)
  for (let i = enc.visitors.length - 1; i >= 0; i--) {
    const v = enc.visitors[i];
    v.ageSec += dt;
    v.x += v.vx * dt;
    v.y += Math.sin(simTimeSec * (v.kind === 'mantaray' ? 1.8 : 0.9) + v.phase) * 0.22 * dt;
    if (v.ageSec >= v.durationSec) {
      enc.visitors.splice(i, 1);
    }
  }
  if (diver.y >= 6.0 && enc.visitors.length === 0) {
    enc.nextVisitorInSec -= dt;
    if (enc.nextVisitorInSec <= 0) {
      const spawned = spawnDynamicVisitor(session, null, callbacks);
      enc.nextVisitorInSec = spawned ? (enc.isOceanWreck ? 36 : 40) : 10;
    }
  }

  // 3. Survey / Distress Beacon pulse & close-range auto-salvage
  const bc = enc.beacon;
  if (bc && !bc.claimed) {
    bc.pingPhase = (bc.pingPhase + dt * 2.2) % (Math.PI * 2);
    if (Math.hypot(diver.x - bc.x, diver.y - bc.y) <= 1.65) {
      claimSurveyBeacon(session, callbacks);
    }
  }
}

const MAX_BIO_WAKE = 88;

/**
 * Stir shimmering bioluminescent plankton / dinoflagellate fin-wake particles behind moving divers
 * in deep caves, shipwrecks, and glacial caverns (v119).
 */
function stepBioWake(session, dt, peers = null) {
  if (!session || !Array.isArray(session.bioWake)) return;
  const wake = session.bioWake;
  const drag = Math.pow(0.28, dt);
  for (let i = wake.length - 1; i >= 0; i--) {
    const p = wake[i];
    p.age += dt;
    if (p.age >= p.life) {
      wake.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= drag;
    p.vy = p.vy * drag - 0.04 * dt;
  }

  const level = session.level;
  const weather = session.weather;
  const isBiolumSite = Boolean(level?.theme?.bioluminescent || weather?.forceBiolum);
  const minDepth = weather?.forceBiolum ? 1.4 : isBiolumSite ? 4.5 : level?.isWreck ? 15.0 : 11.5;
  const hueBase = weather?.forceBiolum ? 186 : isBiolumSite ? 172 : level?.isWreck ? 192 : 184;

  const emitFromDiver = (d, rateMult = 1.0) => {
    if (!d || d.y < minDepth) return;
    const spd = Math.hypot(d.vx || 0, d.vy || 0);
    if (spd < 0.48) return;
    const ang = Number.isFinite(d.angle) ? d.angle : 0;
    const finX = d.x - Math.cos(ang) * 0.85;
    const finY = d.y - Math.sin(ang) * 0.85;
    const count = spd > 2.6 || d.dpvThrusting ? 2 : 1;
    for (let k = 0; k < count; k++) {
      if (wake.length >= MAX_BIO_WAKE) wake.shift();
      const spread = (Math.random() - 0.5) * 0.45;
      const jitter = (Math.random() - 0.5) * 0.6;
      wake.push({
        x: finX + (Math.random() - 0.5) * 0.36,
        y: finY + (Math.random() - 0.5) * 0.36,
        vx: -Math.cos(ang + spread) * (0.45 + spd * 0.18) * rateMult + jitter * 0.25,
        vy: -Math.sin(ang + spread) * (0.45 + spd * 0.18) * rateMult + jitter * 0.25,
        age: 0,
        life: 1.15 + Math.random() * 1.05,
        size: 0.045 + Math.random() * 0.055,
        hue: hueBase + (Math.random() - 0.5) * 34,
        phase: Math.random() * Math.PI * 2,
      });
    }
  };

  session._bioWakeAccum = (session._bioWakeAccum || 0) + dt;
  const interval = weather?.forceBiolum ? 0.042 : isBiolumSite ? 0.055 : 0.095;
  if (session._bioWakeAccum >= interval) {
    session._bioWakeAccum = 0;
    emitFromDiver(session.diver, 1.0);
    if (Array.isArray(peers)) {
      for (let i = 0; i < peers.length; i++) {
        const peer = peers[i];
        if (peer && peer.alive !== false && !peer.surfaced) {
          emitFromDiver(peer, 0.85);
        }
      }
    }
  }
}

/**
 * Advance & spawn expanding surface meniscus fin-kick & splash ripple rings (v124).
 */
export function stepSurfaceRipples(session, dt, peers = null) {
  if (!session || !Array.isArray(session.surfaceRipples)) return;
  const ripples = session.surfaceRipples;

  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.age += dt;
    const t = r.age / Math.max(0.2, r.life);
    if (t >= 1) {
      ripples.splice(i, 1);
      continue;
    }
    r.radius = r.startR + (r.maxR - r.startR) * (1 - Math.pow(1 - t, 2.1));
  }

  const spawnNearSurface = (d, scale = 1.0) => {
    if (!d || ripples.length >= 24) return;
    if (d.y < -0.4 || d.y > 3.6) return;
    const spd = Math.hypot(d.vx || 0, d.vy || 0);
    const nearTop = d.y < 1.15;
    if (spd < 0.35 && !nearTop) return;
    const depthAtten = Math.max(0.25, 1 - Math.max(0, d.y) / 3.8);
    const tailOffset = d.y > 0.7 ? -Math.cos(d.angle || 0) * 0.75 : 0;
    ripples.push({
      x: d.x + tailOffset + (Math.random() - 0.5) * 0.35,
      startR: 0.25,
      radius: 0.25,
      maxR: (1.8 + Math.min(2.4, spd * 0.65)) * depthAtten * scale,
      age: 0,
      life: 1.35 + depthAtten * 0.85,
      intensity: Math.min(1, (0.45 + spd * 0.22) * depthAtten * scale),
    });
  };

  session._rippleAccum = (session._rippleAccum || 0) + dt;
  if (session._rippleAccum >= 0.26) {
    session._rippleAccum = 0;
    spawnNearSurface(session.diver, 1.0);
    if (Array.isArray(peers)) {
      for (let i = 0; i < peers.length; i++) {
        const p = peers[i];
        if (p && p.alive !== false && !p.surfaced) spawnNearSurface(p, 0.85);
      }
    }
    // Storm raindrop impact ripples on open water surface (v137)
    if (session.weather?.precip === 'rain' && ripples.length < 24 && session.diver && session.diver.y < 14) {
      const basins = session.level?.openBasins || [];
      if (basins.length > 0) {
        const b = basins[Math.floor(Math.random() * basins.length)];
        const rx = b.xMin + Math.random() * Math.max(2, b.xMax - b.xMin);
        ripples.push({
          x: rx,
          startR: 0.14,
          radius: 0.14,
          maxR: 0.95 + Math.random() * 0.9,
          age: 0,
          life: 0.85 + Math.random() * 0.45,
          intensity: 0.55,
        });
      }
    }
  }
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
 * Synthesizes a smooth par-time reference pacer ghost track along a level's guideline or
 * checkpoint route so players with Ghost Mode enabled always have a live pacer to race
 * until they record their own Personal Best run on that site.
 */
export function buildParGhostTrack(level) {
  if (!level || !level.spawn) return null;
  const rawPts = [];
  const pushPt = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (rawPts.length > 0) {
      const prev = rawPts[rawPts.length - 1];
      if (Math.hypot(x - prev.x, y - prev.y) < 0.6) return;
    }
    rawPts.push({ x, y });
  };

  pushPt(level.spawn.x, level.spawn.y);
  if (Array.isArray(level.guideline) && level.guideline.length >= 2) {
    for (const pt of level.guideline) {
      if (Array.isArray(pt)) pushPt(pt[0], pt[1]);
      else if (pt) pushPt(pt.x, pt.y);
    }
  } else if (Array.isArray(level.checkpoints) && level.checkpoints.length > 0) {
    for (const cp of level.checkpoints) {
      pushPt(cp.x, cp.y);
    }
    if (level.recoveryTarget) {
      pushPt(level.recoveryTarget.x, level.recoveryTarget.y);
    }
  }
  if (level.exitZone) {
    pushPt(level.exitZone.x, level.exitZone.y);
  }
  if (rawPts.length < 2) return null;

  let totalDist = 0;
  const cumDist = [0];
  for (let i = 1; i < rawPts.length; i++) {
    totalDist += Math.hypot(rawPts[i].x - rawPts[i - 1].x, rawPts[i].y - rawPts[i - 1].y);
    cumDist.push(totalDist);
  }
  if (totalDist < 1) return null;

  const parSec = Math.max(45, Number(level.parTimeSec) || Math.round(totalDist / 1.35));
  const track = [];
  for (let i = 0; i < rawPts.length; i++) {
    const p = rawPts[i];
    const next = rawPts[Math.min(rawPts.length - 1, i + 1)];
    const prev = rawPts[Math.max(0, i - 1)];
    const ang = Math.atan2(next.y - prev.y, next.x - prev.x);
    const tSec = (cumDist[i] / totalDist) * parSec;
    track.push([
      Math.round(tSec * 10),
      Math.round(p.x * 10),
      Math.round(p.y * 10),
      Math.round(ang * 10),
    ]);
  }
  return track;
}

/**
 * Pulse an emissive acoustic locator beam & minimap reticle toward a co-op teammate.
 */
export function triggerBuddyLocatePing(session, peer, callbacks = {}) {
  if (!session || !peer) return { ok: false };
  const ping = {
    targetId: peer.id || '',
    targetName: peer.name || 'Buddy',
    x: Number(peer.x) || 0,
    y: Number(peer.y) || 0,
    timer: 4.6,
    duration: 4.6,
  };
  session.buddyPing = ping;
  callbacks.onBuddyPing?.(ping);
  callbacks.onWreckSync?.('buddy-ping', ping.targetId || ping.targetName);
  const distM = Math.round(Math.hypot(ping.x - (session.diver?.x || 0), ping.y - (session.diver?.y || 0)));
  callbacks.onToast?.(`📡 Pinging ${ping.targetName} (${distM}m · ${Math.max(0, Math.round(ping.y))}m depth)`, 2.4);
  return { ok: true, ping };
}

/**
 * Push a temporary glowing octo-hose transfer stream between donor & recipient divers.
 */
export function pushAirShareBeam(
  session,
  { peerId = '', peerName = 'Buddy', fromSelf = true, gasId = 'EAN32', amountBar = 25 } = {}
) {
  if (!session) return null;
  if (!Array.isArray(session.airShareBeams)) session.airShareBeams = [];
  const beam = {
    peerId,
    peerName,
    fromSelf: Boolean(fromSelf),
    gasId,
    amountBar: Math.round(Number(amountBar) || 25),
    timer: 2.6,
    duration: 2.6,
  };
  session.airShareBeams.push(beam);
  if (session.airShareBeams.length > 6) session.airShareBeams.shift();
  return beam;
}

/**
 * Passively sample co-op buddy depth profiles every ~2.5s for side-by-side debrief comparison.
 */
export function recordPeerDepthProfiles(session, peers, simTimeSec = 0) {
  if (!session || !Array.isArray(peers) || peers.length === 0) return;
  if (!(session.peerProfiles instanceof Map)) session.peerProfiles = new Map();
  const t = Math.max(0, Number(simTimeSec) || 0);
  const lastAt = Number.isFinite(session._lastPeerProfileSampleAt) ? session._lastPeerProfileSampleAt : -99;
  const due = t - lastAt >= 2.5;
  let sampledAny = false;
  for (let i = 0; i < peers.length; i++) {
    const p = peers[i];
    if (!p) continue;
    const pid = p.id || p.name || `peer_${i}`;
    let rec = session.peerProfiles.get(pid);
    if (!rec) {
      rec = { id: pid, name: p.name || 'Buddy', points: [] };
      session.peerProfiles.set(pid, rec);
    } else if (p.name) {
      rec.name = p.name;
    }
    if (!due && rec.points.length > 0) continue;
    if (rec.points.length >= 300) continue;
    const d = Math.max(0, Number((p.depthM ?? p.y ?? 0).toFixed(1)));
    rec.points.push({
      t: Number(t.toFixed(1)),
      d,
      gas: p.gasId || 'EAN32',
    });
    sampledAny = true;
  }
  if (sampledAny && due) {
    session._lastPeerProfileSampleAt = t;
  }
}

/**
 * Applies a remote co-op buddy's action (hatch, snag, marker, shared beacon, shared wildlife photo, buddy ping) to local state.
 */
export function applyPeerWreckAction(session, msg, callbacks = {}) {
  if (!session || !msg || !msg.actionKind || !msg.targetId) return false;
  const by = msg.by || 'Buddy';
  if (msg.actionKind === 'valve') {
    if (!session.equalizedHatchIds) session.equalizedHatchIds = new Set();
    if (session.equalizedHatchIds.has(msg.targetId)) return false;
    session.equalizedHatchIds.add(msg.targetId);
    const hatch = session.level?.watertightHatches?.find((h) => h.id === msg.targetId);
    if (session.mechFx && hatch) {
      recordMechanicalEvent(session.mechFx, 'valve-equalize', {
        x: hatch.x + (hatch.radius || 1.9) * 0.62,
        y: hatch.y - (hatch.radius || 1.9) * 0.62,
        targetId: hatch.id,
      });
    }
    callbacks.onValveEqualize?.(hatch);
    callbacks.onToast?.(`🔧 ${by} equalized pressure on ${hatch?.label || 'Bulkhead'}!`, 2.4);
    return true;
  }
  if (msg.actionKind === 'hatch') {
    if (session.openedHatchIds.has(msg.targetId)) return false;
    session.openedHatchIds.add(msg.targetId);
    session.equalizedHatchIds?.add(msg.targetId);
    if (session.crankingHatchId === msg.targetId) {
      session.crankingHatchId = null;
      session.crankingHatchProgress = 0;
    }
    const hatch = session.level?.watertightHatches?.find((h) => h.id === msg.targetId);
    if (session.mechFx && hatch) {
      recordMechanicalEvent(session.mechFx, 'hatch-open', {
        x: hatch.x,
        y: hatch.y,
        radius: hatch.radius || 1.9,
        targetId: hatch.id,
      });
    }
    session.hatchBonusScore = (session.hatchBonusScore || 0) + (hatch?.bonusPoints || 150);
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
    callbacks.onToast?.(`✂️ ${by} cut ${snag?.label || 'line snag'} clear!`, 2.6);
    return true;
  }
  if (msg.actionKind === 'marker') {
    if (session.placedMarkerIds?.has(msg.targetId)) return false;
    if (!session.placedMarkerIds) session.placedMarkerIds = new Set();
    session.placedMarkerIds.add(msg.targetId);
    const anchor = session.level?.lineAnchors?.find((a) => a.id === msg.targetId);
    const bonusM = anchor?.reelBonusM || 0;
    if (bonusM > 0 && session.reelMaxMeters > 0) {
      session.reelMaxMeters += bonusM;
      session.reelRemainingM += bonusM;
    }
    callbacks.onMarkerPlaced?.(anchor);
    const bonusTxt = bonusM > 0 && session.reelMaxMeters > 0 ? ` (+${bonusM}m team spool!)` : '';
    callbacks.onToast?.(`🪢 ${by} tagged ${anchor?.label || 'cave junction marker'}${bonusTxt}`, 2.6);
    return true;
  }
  if (msg.actionKind === 'beacon') {
    const bc = session.encounters?.beacon;
    if (!bc || bc.claimed) return false;
    bc.claimed = true;
    const pts = Math.min(MAX_ENCOUNTER_BONUS, bc.points || MAX_ENCOUNTER_BONUS);
    session.encounters.encounterBonusScore = Math.min(
      MAX_ENCOUNTER_BONUS,
      (session.encounters.encounterBonusScore || 0) + pts
    );
    let addedBar = 0;
    const activeGas = session.diveState?.activeGasId;
    if (activeGas && session.diveState?.tanks?.[activeGas]?.bar < 185) {
      addedBar = receiveGasIntoState(session.diveState, activeGas, 18);
    }
    const newlyMapped = markExploredAround(
      session.exploreCells,
      session.exploredCells,
      bc.x,
      bc.y,
      15.0,
      session.exploredGrid
    );
    if (newlyMapped > 0 && session.exploreCells?.length > 0) {
      session.exploredPct = Math.round((session.exploredCells.size / session.exploreCells.length) * 100);
    }
    callbacks.onBeaconClaimed?.(bc, addedBar);
    const gasTxt = addedBar >= 1 ? ` · +${Math.round(addedBar)}b reserve` : '';
    callbacks.onToast?.(`📡 ${by} salvaged the Survey Beacon! (+${pts} crew pts${gasTxt})`, 3.4);
    return true;
  }
  if (msg.actionKind === 'photo') {
    const [entryId, starsRaw] = String(msg.targetId).split(':');
    const entry = getFieldGuideEntry(entryId);
    if (!entry || !session.camera) return false;
    if (session.camera.photographedIds.has(entry.id)) return false;
    session.camera.photographedIds.add(entry.id);
    const stars = Math.max(1, Math.min(3, Number(starsRaw) || 2));
    const starMult = stars === 3 ? 1.0 : stars === 2 ? 0.8 : 0.6;
    const room = Math.max(0, MAX_PHOTO_BONUS - (session.camera.photoBonusScore || 0));
    const crewPts = Math.min(room, Math.round((entry.points || 60) * starMult * 0.5));
    session.camera.photoBonusScore = (session.camera.photoBonusScore || 0) + crewPts;
    const starStr = '★'.repeat(stars);
    callbacks.onToast?.(
      `📷 ${by} photographed ${entry.icon} ${entry.name} ${starStr}${crewPts > 0 ? ` (+${crewPts} crew bonus!)` : ''}`,
      3.0
    );
    return true;
  }
  if (msg.actionKind === 'buddy-ping') {
    callbacks.onBuddyPing?.({ targetId: msg.playerId || '', targetName: by, incoming: true });
    callbacks.onToast?.(`📡 ${by} pinged your locator!`, 2.2);
    return true;
  }
  if (msg.actionKind === 'stage-drop') {
    const parts = String(msg.targetId || '').split('|');
    const [stageId, gasId, xStr, yStr, barStr] = parts;
    if (!stageId || !gasId) return false;
    if (!Array.isArray(session.droppedStages)) session.droppedStages = [];
    if (session.droppedStages.some((s) => s.id === stageId)) return false;
    const sx = Number(xStr);
    const sy = Number(yStr);
    const bar = Math.max(10, Math.min(120, Math.round(Number(barStr) || 45)));
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return false;
    const mix = session.diveState?.mixes?.[gasId];
    session.droppedStages.push({
      id: stageId,
      x: sx,
      y: sy,
      gasId,
      gasName: mix?.name || gasId,
      shortLabel: mix?.shortLabel || gasId,
      color: mix?.color || '#38bdf8',
      bar,
      ownerName: by,
      isLocal: false,
    });
    callbacks.onToast?.(`🛢 ${by} clipped a ${bar}b ${mix?.name || gasId} stage bottle at ${Math.max(0, Math.round(sy))}m!`, 2.8);
    return true;
  }
  if (msg.actionKind === 'stage-pick') {
    if (!Array.isArray(session.droppedStages)) return false;
    const idx = session.droppedStages.findIndex((s) => s.id === msg.targetId);
    if (idx < 0) return false;
    const [removed] = session.droppedStages.splice(idx, 1);
    if (removed?.isLocal) session.spareStageDropped = false;
    callbacks.onToast?.(`🛢 ${by} picked up ${removed?.gasName || 'stage'} bottle.`, 2.2);
    return true;
  }
  return false;
}

const STAGE_DROP_BAR = 45;
const STAGE_MIN_RESERVE_BAR = 75;
const STAGE_EFFICIENCY_BONUS_BAR = 5;

/**
 * Physically clip an AL80 stage bottle at the diver's current coordinates for exit bailout.
 * Transfers 45 bar from the active cylinder (requires >= 75 bar) and reduces swim drag (+6% speed).
 */
export function dropStageTank(session, callbacks = {}) {
  if (!session || !session.diveState?.alive || session.surfaced) {
    return { ok: false, reason: 'inactive' };
  }
  if (session.spareStageDropped) {
    callbacks.onToast?.('🛢 Stage bottle already clipped on the line — swim back & press [E] to retrieve it!', 2.4);
    return { ok: false, reason: 'already-dropped' };
  }
  const { diveState, diver } = session;
  const gasId = diveState.activeGasId || 'EAN32';
  const tank = diveState.tanks?.[gasId];
  const mix = diveState.mixes?.[gasId];
  if (!tank || tank.bar < STAGE_MIN_RESERVE_BAR) {
    const have = Math.round(tank?.bar || 0);
    callbacks.onToast?.(
      `⚠️ Need at least ${STAGE_MIN_RESERVE_BAR} bar in ${mix?.name || gasId} to stage a bottle (currently ${have}b).`,
      2.6
    );
    return { ok: false, reason: 'low-gas', bar: have };
  }
  if ((diver.y || 0) < 1.2) {
    callbacks.onToast?.('🛢 Submerge below 1.5m before clipping a stage cylinder.', 2.0);
    return { ok: false, reason: 'surface' };
  }

  const startBar = mix?.startBar || 200;
  tank.bar = Math.max(0, Math.round((tank.bar - STAGE_DROP_BAR) * 10) / 10);
  if (Number.isFinite(tank.maxLiters) && tank.maxLiters > 0) {
    tank.litersRemaining = Math.max(0, (tank.bar / startBar) * tank.maxLiters);
  }
  const stageId = `stg_${Math.round((session.simTimeSec || 0) * 10)}_${Math.floor(Math.random() * 9000 + 1000)}`;
  const stage = {
    id: stageId,
    x: Math.round(diver.x * 100) / 100,
    y: Math.round(diver.y * 100) / 100,
    gasId,
    gasName: mix?.name || gasId,
    shortLabel: mix?.shortLabel || gasId,
    color: mix?.color || '#38bdf8',
    bar: STAGE_DROP_BAR,
    ownerName: diver.name || 'Diver',
    isLocal: true,
  };
  if (!Array.isArray(session.droppedStages)) session.droppedStages = [];
  session.droppedStages.push(stage);
  session.spareStageDropped = true;

  if (Array.isArray(session.bubbles)) {
    for (let k = 0; k < 7; k++) {
      spawnExhaustBubble(
        session.bubbles,
        stage.x + (Math.random() - 0.5) * 0.45,
        stage.y + (Math.random() - 0.5) * 0.35,
        (Math.random() - 0.5) * 0.7,
        -0.55 - Math.random() * 0.6,
        { primary: k < 3, intensity: 0.65, depthM: stage.y }
      );
    }
  }

  const encoded = `${stage.id}|${stage.gasId}|${stage.x.toFixed(1)}|${stage.y.toFixed(1)}|${stage.bar}`;
  if (session.mechFx) recordMechanicalEvent(session.mechFx, 'drop-stage', { x: stage.x, y: stage.y, targetId: stage.id });
  callbacks.onWreckSync?.('stage-drop', encoded);
  callbacks.onStageDrop?.(stage);
  callbacks.onToast?.(
    `🛢 Staged ${stage.bar}b ${stage.gasName} bottle at ${Math.max(0, Math.round(stage.y))}m (+6% streamlined speed)!`,
    3.0
  );
  return { ok: true, stage };
}

/**
 * Retrieve a previously clipped physical stage bottle (own or buddy's) within 2.8m.
 */
export function retrieveStageTank(session, stageId = null, callbacks = {}) {
  if (!session || !session.diveState?.alive || !Array.isArray(session.droppedStages) || session.droppedStages.length === 0) {
    return { ok: false, reason: 'none' };
  }
  const { diver, diveState } = session;
  let idx = -1;
  if (stageId) {
    idx = session.droppedStages.findIndex((s) => s.id === stageId);
  } else {
    let bestD = 2.85;
    for (let i = 0; i < session.droppedStages.length; i++) {
      const s = session.droppedStages[i];
      const d = Math.hypot(diver.x - s.x, diver.y - s.y);
      if (d <= bestD) {
        bestD = d;
        idx = i;
      }
    }
  }
  if (idx < 0) return { ok: false, reason: 'out-of-range' };
  const stage = session.droppedStages[idx];
  if (Math.hypot(diver.x - stage.x, diver.y - stage.y) > 3.1) {
    return { ok: false, reason: 'out-of-range' };
  }
  const totalFill = (stage.bar || STAGE_DROP_BAR) + STAGE_EFFICIENCY_BONUS_BAR;
  const added = receiveGasIntoState(diveState, stage.gasId, totalFill);
  session.droppedStages.splice(idx, 1);
  if (stage.isLocal) session.spareStageDropped = false;
  if (session.mechFx) recordMechanicalEvent(session.mechFx, 'retrieve-stage', { x: stage.x, y: stage.y, targetId: stage.id });

  if (Array.isArray(session.bubbles)) {
    for (let k = 0; k < 8; k++) {
      spawnExhaustBubble(
        session.bubbles,
        stage.x + (Math.random() - 0.5) * 0.5,
        stage.y + (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.8,
        -0.65 - Math.random() * 0.7,
        { primary: k < 4, intensity: 0.75, depthM: stage.y }
      );
    }
  }
  callbacks.onWreckSync?.('stage-pick', stage.id);
  callbacks.onStageRefill?.(stage, added);
  callbacks.onToast?.(
    `🛢 Retrieved ${stage.gasName} stage bottle (+${Math.round(added)} bar recovered)!`,
    2.8
  );
  return { ok: true, stage, addedBar: added };
}

export const EMERGENCY_DRILL_KINDS = ['mask-flood', 'torch-fail', 'free-flow'];
const DRILL_POINTS_EACH = 200;

/**
 * Trigger an authentic mid-dive technical emergency drill (`mask-flood`, `torch-fail`, or `free-flow`).
 */
export function triggerEmergencyDrill(session, requestedKind = null, callbacks = {}) {
  if (!session?.drills || !session.diveState?.alive || session.surfaced) {
    return { ok: false, reason: 'inactive' };
  }
  if (session.drills.active) {
    return { ok: false, reason: 'already-active', active: session.drills.active };
  }
  let kind = EMERGENCY_DRILL_KINDS.includes(requestedKind) ? requestedKind : null;
  if (!kind) {
    const unseen = EMERGENCY_DRILL_KINDS.filter((k) => {
      if (k === 'torch-fail' && session.drills.backupTorchActive) return false;
      return !session.drills.history.includes(k);
    });
    const pool = unseen.length > 0
      ? unseen
      : EMERGENCY_DRILL_KINDS.filter((k) => !(k === 'torch-fail' && session.drills.backupTorchActive));
    kind = pool[Math.floor(Math.random() * pool.length)] || 'mask-flood';
  }
  const drill = {
    kind,
    elapsedSec: 0,
    severity: kind === 'mask-flood' ? 0.3 : 1.0,
    hissAccum: 0,
  };
  session.drills.active = drill;
  session.drills.history.push(kind);
  callbacks.onDrillStart?.(drill);
  callbacks.onAlarm?.('warn');
  if (kind === 'mask-flood') {
    callbacks.onToast?.('🫧 MASK FLOODING! Stay calm — press [E] / Clear Mask to purge water!', 3.6);
  } else if (kind === 'torch-fail') {
    callbacks.onToast?.('🔦 PRIMARY LIGHT FAILING! Press [L] or [E] to deploy your Backup Torch!', 3.6);
  } else if (kind === 'free-flow') {
    callbacks.onToast?.('🔧 REGULATOR FREE-FLOW (3× gas burn)! Press [E] to feather valve or switch gas [1/2/3]!', 3.8);
  }
  return { ok: true, drill };
}

/**
 * Resolve an active emergency failure drill and award +200 Emergency Mastery points (up to MAX_DRILL_BONUS).
 */
export function resolveEmergencyDrill(session, expectedKind = null, callbacks = {}) {
  const active = session?.drills?.active;
  if (!active || !session.diveState?.alive) {
    return { ok: false, reason: 'none' };
  }
  if (expectedKind && active.kind !== expectedKind) {
    return { ok: false, reason: 'mismatch' };
  }
  const resolvedKind = active.kind;
  session.drills.active = null;
  session.drills.cooldownSec = 32 + Math.random() * 18;
  session.drills.completedCount = (session.drills.completedCount || 0) + 1;
  const room = Math.max(0, MAX_DRILL_BONUS - (session.drills.bonusScore || 0));
  const points = Math.min(room, DRILL_POINTS_EACH);
  session.drills.bonusScore = (session.drills.bonusScore || 0) + points;

  const { diver, diveState, bubbles } = session;
  diveState.panicLevel = Math.max(0, (diveState.panicLevel || 0) - 0.2);
  diveState.heartRateBpm = Math.max(70, (diveState.heartRateBpm || 84) - 10);

  if (resolvedKind === 'mask-flood') {
    if (Array.isArray(bubbles)) {
      for (let k = 0; k < 14; k++) {
        spawnExhaustBubble(
          bubbles,
          diver.x + Math.cos(diver.angle) * 0.45 + (Math.random() - 0.5) * 0.3,
          diver.y + Math.sin(diver.angle) * 0.35,
          (Math.random() - 0.5) * 1.1,
          -0.9 - Math.random() * 1.1,
          { primary: k < 7, intensity: 1.0, depthM: diver.y }
        );
      }
    }
    callbacks.onMaskPurge?.();
    callbacks.onToast?.(`🫧 Mask purged crystal clear! (+${points} Emergency Mastery)`, 3.0);
  } else if (resolvedKind === 'torch-fail') {
    session.drills.backupTorchActive = true;
    diver.torchOn = true;
    diver.backupTorchActive = true;
    callbacks.onDrillClear?.(resolvedKind, points);
    callbacks.onToast?.(`🔦 Backup halogen torch deployed! (+${points} Emergency Mastery)`, 3.0);
  } else if (resolvedKind === 'free-flow') {
    callbacks.onDrillClear?.(resolvedKind, points);
    callbacks.onToast?.(`🔧 Regulator free-flow isolated! (+${points} Emergency Mastery)`, 3.0);
  }
  if (session.mechFx) {
    const fxKind =
      resolvedKind === 'mask-flood'
        ? 'mask-purge'
        : resolvedKind === 'free-flow'
          ? 'free-flow-shutoff'
          : 'drill-clear';
    recordMechanicalEvent(session.mechFx, fxKind, {
      x: diver.x,
      y: diver.y,
      angle: diver.angle || 0,
    });
  }
  return { ok: true, kind: resolvedKind, points, totalBonus: session.drills.bonusScore };
}

/**
 * Trigger tactile working-arm + 2nd-stage regulator purge bubble FX when switching breathing gas (v151).
 */
export function recordGasSwitchFx(session, gasId = 'EAN32') {
  if (!session?.mechFx || !session?.diver) return;
  recordMechanicalEvent(session.mechFx, 'gas-switch', {
    x: session.diver.x,
    y: session.diver.y,
    angle: session.diver.angle || 0,
    gasId,
  });
}

/**
 * Advance active emergency failure drills & trigger cooldowns during stepDiveSession.
 */
export function stepEmergencyDrills(session, dt, callbacks = {}) {
  const drills = session?.drills;
  if (!drills || !session.diveState?.alive || session.surfaced) return;
  const { diver, diveState, bubbles } = session;
  diver.backupTorchActive = Boolean(drills.backupTorchActive);

  if (drills.active) {
    const active = drills.active;
    active.elapsedSec += dt;
    if (active.kind === 'mask-flood') {
      active.severity = Math.min(1, 0.3 + active.elapsedSec / 3.2);
      diveState.heartRateBpm = Math.min(175, (diveState.heartRateBpm || 74) + dt * 4.2);
      diveState.panicLevel = Math.min(1, (diveState.panicLevel || 0) + dt * 0.045);
    } else if (active.kind === 'torch-fail') {
      diveState.heartRateBpm = Math.min(175, (diveState.heartRateBpm || 74) + dt * 3.8);
      diveState.panicLevel = Math.min(1, (diveState.panicLevel || 0) + dt * 0.04);
    } else if (active.kind === 'free-flow') {
      diveState.heartRateBpm = Math.min(180, (diveState.heartRateBpm || 76) + dt * 5.2);
      diveState.panicLevel = Math.min(1, (diveState.panicLevel || 0) + dt * 0.055);
      active.hissAccum = (active.hissAccum || 0) + dt;
      if (active.hissAccum >= 0.42) {
        active.hissAccum = 0;
        callbacks.onFreeFlowHiss?.();
      }
      if (Array.isArray(bubbles) && Math.random() < dt * 24) {
        spawnExhaustBubble(
          bubbles,
          diver.x + Math.cos(diver.angle) * 0.42,
          diver.y + Math.sin(diver.angle) * 0.32,
          (Math.random() - 0.5) * 1.2,
          -1.1 - Math.random() * 1.2,
          { primary: true, intensity: 1.15, depthM: diver.y }
        );
      }
    }
    return;
  }

  if (!drills.enabled) return;
  if ((drills.completedCount || 0) >= 3) return;
  if ((diver.y || 0) < 7.0 || session.activeSnagIndex >= 0 || (diveState.panicLevel || 0) > 0.65) return;

  drills.cooldownSec = Math.max(0, (drills.cooldownSec ?? 22) - dt);
  if (drills.cooldownSec <= 0) {
    triggerEmergencyDrill(session, null, callbacks);
  }
}

/**
 * Triggers the active contextual cave or shipwreck action:
 * 1) Slice free from a tangled fishing net / abandoned cave line trap (self or co-op buddy!)
 * 2) Crank open a sealed watertight bulkhead hatch (shipwrecks)
 * 3) Top up gas from a clipped staged bailout / deco cylinder cache (caves)
 * 4) Clip a glowing directional cave arrow & recover jump-spool line at an unlined junction (caves)
 * 5) Clip onto or unclip from the open-water shot line (shipwrecks)
 */
export function triggerWreckAction(session, callbacks = {}) {
  if (!session || !session.level || session.diveState?.alive === false) {
    return { handled: false, kind: null };
  }
  const { level, diver, diveState, siltClouds, bubbles } = session;

  // 1. Priority 1: Slice free from active fishing-net / abandoned cave-line snag (self or tangled co-op buddy!)
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
      if (session.mechFx) {
        recordMechanicalEvent(session.mechFx, 'cut-net', {
          x: snag.x,
          y: snag.y,
          targetId: snagKey,
          angle: Math.atan2(snag.y - diver.y, snag.x - diver.x),
          isLineTrap: snag.kind === 'linetrap',
        });
      }
      callbacks.onLineCut?.(snag);
      callbacks.onWreckSync?.('snag', snagKey);
      const snagTitle = snag.label || (snag.kind === 'linetrap' ? 'tangled cave line' : 'net snag');
      callbacks.onToast?.(
        isBuddyRescue
          ? `✂️ Cut ${session.buddySnagName || 'your buddy'} free from ${snagTitle}!`
          : `✂️ Cut free from ${snagTitle}! Path cleared.`,
        2.6
      );
      return { handled: true, kind: 'cut-net', targetId: snagKey, buddyRescue: isBuddyRescue };
    }
  }

  // 1b. Priority 1b: Resolve active technical emergency drill (Mask Flood / Primary Torch Fail / Regulator Free-Flow)
  if (session.drills?.active) {
    const res = resolveEmergencyDrill(session, null, callbacks);
    if (res.ok) {
      return { handled: true, kind: `drill-${res.kind}`, drillKind: res.kind, points: res.points };
    }
  }

  // 2. Priority 2: Crank open a nearby sealed watertight bulkhead hatch (shipwrecks)
  if (Array.isArray(level.watertightHatches)) {
    for (let i = 0; i < level.watertightHatches.length; i++) {
      const hatch = level.watertightHatches[i];
      if (!hatch || session.openedHatchIds.has(hatch.id)) continue;
      const dist = Math.hypot(diver.x - hatch.x, diver.y - hatch.y);
      const reach = (hatch.radius || 2.0) + 2.5;
      if (dist <= reach) {
        if (!session.equalizedHatchIds) session.equalizedHatchIds = new Set();
        // Step 1 on deep pressurized shipwreck bulkheads (>=62m): bleed ΔP pressure valve before cranking!
        if (isHatchPressurized(level, hatch) && !session.equalizedHatchIds.has(hatch.id)) {
          session.equalizedHatchIds.add(hatch.id);
          if (Array.isArray(bubbles)) {
            for (let k = 0; k < 14; k++) {
              spawnExhaustBubble(
                bubbles,
                hatch.x + (Math.random() - 0.5) * 0.6,
                hatch.y + (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 1.4,
                -1.0 - Math.random() * 1.1,
                0.08 + Math.random() * 0.08
              );
            }
          }
          if (session.mechFx) {
            const hr = hatch.radius || 1.9;
            recordMechanicalEvent(session.mechFx, 'valve-equalize', {
              x: hatch.x + hr * 0.62,
              y: hatch.y - hr * 0.62,
              targetId: hatch.id,
              angle: -Math.PI * 0.25,
            });
          }
          callbacks.onValveEqualize?.(hatch);
          callbacks.onWreckSync?.('valve', hatch.id);
          callbacks.onToast?.(`🔧 Pressure equalized on ${hatch.label || 'Bulkhead'} — press [E] again to crank open!`, 2.6);
          return { handled: true, kind: 'equalize-valve', targetId: hatch.id };
        }
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

  // 3. Priority 3: Top up reserve gas from a nearby staged bailout / deco cave cylinder
  if (Array.isArray(level.stageCaches)) {
    if (!session.claimedStageIds) session.claimedStageIds = new Set();
    for (let i = 0; i < level.stageCaches.length; i++) {
      const cache = level.stageCaches[i];
      if (!cache || session.claimedStageIds.has(cache.id)) continue;
      const dist = Math.hypot(diver.x - cache.x, diver.y - cache.y);
      if (dist <= 3.6) {
        const added = receiveGasIntoState(diveState, cache.gasId, cache.barBonus || 65);
        const gasName = diveState.mixes?.[cache.gasId]?.shortName || cache.gasId || 'Gas';
        if (added < 0.5) {
          callbacks.onToast?.(`⛽ ${gasName} tank already full — bottle left clipped for exit!`, 2.4);
          return { handled: true, kind: 'stage-full', targetId: cache.id, addedBar: 0 };
        }
        session.claimedStageIds.add(cache.id);
        if (Array.isArray(bubbles)) {
          for (let k = 0; k < 10; k++) {
            spawnExhaustBubble(
              bubbles,
              cache.x + (Math.random() - 0.5) * 0.6,
              cache.y + (Math.random() - 0.5) * 0.5,
              (Math.random() - 0.5) * 0.9,
              -0.7 - Math.random() * 0.8,
              { primary: k < 5, intensity: 0.85, depthM: cache.y }
            );
          }
        }
        callbacks.onStageRefill?.(cache, added);
        if (session.mechFx) {
          recordMechanicalEvent(session.mechFx, 'refill-stage', { x: cache.x, y: cache.y, targetId: cache.id });
        }
        callbacks.onToast?.(`⛽ Topped up ${gasName} (+${Math.round(added)} bar) from ${cache.label}!`, 3.0);
        return { handled: true, kind: 'refill-stage', targetId: cache.id, gasId: cache.gasId, addedBar: added };
      }
    }
  }

  // 3b. Priority 3b: Retrieve a player-clipped physical stage bottle (own or co-op buddy's)
  if (Array.isArray(session.droppedStages) && session.droppedStages.length > 0) {
    const res = retrieveStageTank(session, null, callbacks);
    if (res.ok) {
      return {
        handled: true,
        kind: 'retrieve-stage',
        targetId: res.stage.id,
        gasId: res.stage.gasId,
        addedBar: res.addedBar,
      };
    }
  }

  // 4. Priority 4: Clip a glowing directional cave arrow & collect jump-spool line at an unlined junction
  if (Array.isArray(level.lineAnchors)) {
    if (!session.placedMarkerIds) session.placedMarkerIds = new Set();
    for (let i = 0; i < level.lineAnchors.length; i++) {
      const anchor = level.lineAnchors[i];
      if (!anchor || session.placedMarkerIds.has(anchor.id)) continue;
      const dist = Math.hypot(diver.x - anchor.x, diver.y - anchor.y);
      if (dist <= 3.6) {
        session.placedMarkerIds.add(anchor.id);
        const bonusM = anchor.reelBonusM || 40;
        session.reelRemainingM = (session.reelRemainingM || 0) + bonusM;
        session.reelMaxMeters = (session.reelMaxMeters || 0) + bonusM;
        callbacks.onMarkerPlaced?.(anchor, bonusM);
        if (session.mechFx) {
          recordMechanicalEvent(session.mechFx, 'place-marker', { x: anchor.x, y: anchor.y, targetId: anchor.id });
        }
        callbacks.onWreckSync?.('marker', anchor.id);
        callbacks.onToast?.(`🪢 Tagged ${anchor.label} & clipped +${bonusM}m jump spool!`, 3.0);
        return { handled: true, kind: 'place-marker', targetId: anchor.id, reelBonusM: bonusM };
      }
    }
  }

  // 4b. Priority 4b: Salvage optional mid-dive Survey / Distress Beacon
  if (session.encounters?.beacon && !session.encounters.beacon.claimed) {
    const bc = session.encounters.beacon;
    if (Math.hypot(diver.x - bc.x, diver.y - bc.y) <= 4.0) {
      const res = claimSurveyBeacon(session, callbacks);
      if (res.ok) {
        return { handled: true, kind: 'claim-beacon', targetId: bc.id, points: res.points, addedBar: res.addedBar };
      }
    }
  }

  // 5. Priority 5: Clip onto / unclip from the open-water shot line (shipwrecks)
  if (level.shotLine) {
    if (session.clippedToShotLine) {
      session.clippedToShotLine = false;
      if (session.mechFx) recordMechanicalEvent(session.mechFx, 'unclip-line', { x: diver.x, y: diver.y });
      callbacks.onClipLine?.(false);
      callbacks.onToast?.('🔓 Unclipped from shot line — free swimming.', 1.8);
      return { handled: true, kind: 'unclip-line' };
    }
    const shotX = level.shotLine.x ?? level.spawn?.x ?? 0;
    const shotBottom = level.shotLine.bottomY ?? level.wreckDeckY ?? 40;
    if (Math.abs(diver.x - shotX) <= 5.0 && diver.y >= 1.8 && diver.y <= shotBottom - 0.8) {
      session.clippedToShotLine = true;
      if (session.mechFx) recordMechanicalEvent(session.mechFx, 'clip-line', { x: shotX, y: diver.y });
      callbacks.onClipLine?.(true);
      callbacks.onToast?.('⚓ Clipped to shot line! Hold Down to zip-descend or Up for steady ascent.', 2.8);
      return { handled: true, kind: 'clip-line' };
    }
  }

  // 6. Priority 6: Deploy commercial Lift Bag when weighed down by heavy salvage (>=10kg uncompensated)
  if (!session.salvage?.liftBagActive && (session.salvage?.netTrimKg || 0) >= 10 && diver.y > 4) {
    const lbRes = toggleLiftBag(session, callbacks);
    if (lbRes.ok) {
      return { handled: true, kind: 'inflate-liftbag', buoyancy: lbRes.buoyancy };
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
  if (session.mechFx) {
    recordMechanicalEvent(session.mechFx, 'hatch-open', {
      x: hatch.x,
      y: hatch.y,
      radius: hatch.radius || 1.9,
      targetId: hatch.id,
    });
  }
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
export function emitImpactSilt(siltClouds, x, y, nx, ny, impactSpeed, difficulty = 'standard') {
  const isHard = difficulty === 'hardcore';
  const isGuided = difficulty === 'guided';
  const count = isHard
    ? (impactSpeed > 2.4 ? 8 : 5)
    : isGuided
      ? (impactSpeed > 2.4 ? 3 : 2)
      : (impactSpeed > 2.4 ? 6 : 3);
  const radScale = isHard ? 1.18 : isGuided ? 0.78 : 1.0;
  const peakAlpha = isHard ? 0.94 : isGuided ? 0.6 : 0.85;
  const spawned = [];
  for (let i = 0; i < count; i++) {
    const opts = {
      x: x + nx * 0.45 + (Math.random() - 0.5) * 0.9,
      y: y + ny * 0.45 + (Math.random() - 0.5) * 0.9,
      vx: -nx * (0.4 + Math.random() * 0.65) + (Math.random() - 0.5) * 0.5,
      vy: -ny * (0.4 + Math.random() * 0.6) - 0.25,
      radius: (0.95 + Math.random() * 0.75) * radScale,
      maxRadius: (3.4 + Math.random() * 1.2) * radScale,
      life: (24.0 + Math.random() * 6.0) * (isGuided ? 0.78 : isHard ? 1.15 : 1.0),
      peakAlpha,
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
    // CCR Closed-Circuit Rebreather scrubs CO2 silently (~92% fewer bubbles & no rust percolation!)
    const ccrSilent = Boolean(diveState?.ccrEnabled) && (diveState?.ccrScrubberPct ?? 0) > 0.1;
    if (nextState === 'exhale' && prevState !== 'exhale') {
      breath.exhaleCount += 1;
      breath.emitAccum = 0;
      callbacks.onExhale?.({ ...audioPayload, durationSec: profile.exhaleSec, isCcr: ccrSilent });

      const { mouthX, mouthY, perpX, perpY } = getDiverMouthPos(diver);
      if (ccrSilent) {
        // Only emit an occasional whisper-quiet loop-purge micro-bubble on ascent or every 3rd breath
        if ((diver.vy || 0) < -0.5 || breath.exhaleCount % 3 === 0) {
          spawnExhaustBubble(bubbles, mouthX, mouthY, (diver.vx || 0) * 0.25, (diver.vy || 0) * 0.15, {
            primary: false,
            panic: 0,
            intensity: 0.2,
            depthM: diver.y,
            portSign: 1,
          });
        }
      } else {
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
    }

    // Continuous shaped bubble plume during exhale phase (bell-curve flow envelope; suppressed on CCR)
    if (nextState === 'exhale' && !ccrSilent) {
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
    if (!p || p.alive === false || p.surfaced || (p.y ?? 0) <= 0.6 || p.hasCcr) continue;
    const hrBpm = p.heartRateBpm ?? 78;
    const hrNorm = Math.max(0, Math.min(1, (hrBpm - 65) / 115));
    const isCalmCond = !p.condition || p.condition === 'NOMINAL' || p.condition.startsWith('DECO ');
    const panic = !isCalmCond ? 0.55 : hrNorm * 0.6;
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
  const mutatorId = session.mutatorId || '';
  stepEmergencyDrills(session, dt, callbacks);
  let torchMod = 1.0;
  if (mutatorId === 'strobe') {
    const phase = session.simTimeSec % 1.7;
    torchMod = phase < 0.36 ? 1.0 : phase < 0.55 ? 1.0 - ((phase - 0.36) / 0.19) * 0.78 : 0.22;
  }
  if (session.drills?.active?.kind === 'torch-fail') {
    const el = session.drills.active.elapsedSec || 0;
    const sputter = el < 1.3 ? (Math.sin(el * 42) > 0.15 ? 0.75 : 0.08) : 0.06;
    torchMod = Math.min(torchMod, sputter);
  } else if (session.drills?.backupTorchActive) {
    torchMod = Math.min(torchMod, 0.78);
  }
  diver.strobeMod = torchMod;
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

  // DPV Underwater Scooter motorized propulsion (1.82x thrust, lower physical exertion, battery drain & propwash!)
  const dpv = session.dpv;
  let dpvThrusting = false;
  if (dpv?.equipped && dpv.active && !session.clippedToShotLine && diveState.alive) {
    if (dpv.batteryPct <= 0.05) {
      dpv.active = false;
      dpv.batteryPct = 0;
      callbacks.onToast?.('🔋 DPV scooter battery depleted — switching to fins!', 2.6);
    } else if (thrustMag > 0.08) {
      dpvThrusting = true;
      dpv.batteryPct = Math.max(0, dpv.batteryPct - dt * (1.45 * thrustMag));
      dpv.humAccum = (dpv.humAccum || 0) + dt;
      if (dpv.humAccum >= 0.28) {
        dpv.humAccum = 0;
        callbacks.onDpvHum?.(thrustMag);
      }
      if (diver.y > 0.6 && Math.random() < dt * 14) {
        const bx = diver.x + Math.cos(diver.angle) * 0.42;
        const by = diver.y + Math.sin(diver.angle) * 0.42;
        spawnExhaustBubble(session.bubbles, bx, by, -Math.cos(diver.angle) * 2.4, -Math.sin(diver.angle) * 1.4, {
          primary: false,
          panic: 0,
          intensity: 0.35,
          depthM: diver.y,
          portSign: Math.random() < 0.5 ? 1 : -1,
        });
      }
      if (dpv.batteryPct <= 0.05) {
        dpv.active = false;
        dpvThrusting = false;
        dpv.batteryPct = 0;
        callbacks.onToast?.('🔋 DPV scooter battery depleted — switching to fins!', 2.6);
      }
    }
  }
  if (dpv) dpv.thrusting = dpvThrusting;
  diver.dpvActive = Boolean(dpv?.active);
  diver.dpvThrusting = dpvThrusting;

  // Advance Cave Sonar Ping & Strobe Camera cooldown/flash timers
  if (session.sonar) {
    if (session.sonar.cooldownSec > 0) {
      session.sonar.cooldownSec = Math.max(0, session.sonar.cooldownSec - dt);
    }
    if (session.sonar.activePulse) {
      session.sonar.activePulse.ageSec += dt;
      if (session.sonar.activePulse.ageSec >= session.sonar.activePulse.durationSec) {
        session.sonar.activePulse = null;
      }
    }
  }
  if (session.camera) {
    if (session.camera.cooldownSec > 0) {
      session.camera.cooldownSec = Math.max(0, session.camera.cooldownSec - dt);
    }
    if (session.camera.activeFlash) {
      session.camera.activeFlash.ageSec += dt;
      if (session.camera.activeFlash.ageSec >= session.camera.activeFlash.durationSec) {
        session.camera.activeFlash = null;
      }
    }
  }

  const salvageBuo = stepSalvageBuoyancy(session, dt, callbacks);
  if (session.runMilestones && salvageBuo) {
    if (session.salvage?.liftBagActive && (salvageBuo.payloadKg || 0) >= 8) {
      session.runMilestones.usedLiftBagWithHeavySalvage = true;
    }
    if (salvageBuo.status === 'float-warn') {
      session.runMilestones.floatUpIncident = true;
    }
  }
  stepMechanicalFx(session.mechFx, dt);
  const effectiveExertion = dpvThrusting ? exertion * 0.52 : exertion;
  const kickPulse = dpvThrusting ? 1.0 : (thrustMag > 0.1 && diver.body ? 0.68 + 0.72 * diver.body.kickSurge : 1.0);
  const towDrag = session.carryingBody || session.rescueTargetId ? 0.9 : 1.0;
  const stageTrimMult = session.spareStageDropped ? 1.06 : 1.0;
  const salvageDragMult = salvageBuo?.swimDragMult ?? 1.0;
  const swimMult = (imp.swimMultiplier ?? 1) * towDrag * stageTrimMult * salvageDragMult;
  const dpvHorizMult = dpvThrusting ? 1.82 : 1.0;
  const dpvVertMult = dpvThrusting ? (ctrlY < 0 ? 1.38 : 1.68) : 1.0;
  const mutHorizMult = mutatorId === 'turbo-par' ? 1.22 : 1.0;
  const mutVertMult = mutatorId === 'turbo-par' ? 1.16 : 1.0;
  const horizAccel = 6.2 * kickPulse * swimMult * dpvHorizMult * mutHorizMult;
  const vertAccel = (ctrlY < 0 ? 4.1 : 5.3) * kickPulse * swimMult * dpvVertMult * mutVertMult;
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
  const mutCurrentMult = mutatorId === 'surge' ? 1.75 : 1.0;
  const diffCurrentMult = (session.difficulty === 'hardcore' ? 1.28 : session.difficulty === 'guided' ? 0.7 : 1.0) * mutCurrentMult;
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

  // Steady underground karst spring / resurgence currents inside cave conduits
  if (session.caveFlowWarnCooldown > 0) session.caveFlowWarnCooldown -= dt;
  if (Array.isArray(level.caveCurrents)) {
    for (let c = 0; c < level.caveCurrents.length; c++) {
      const cur = level.caveCurrents[c];
      const cr = cur.radius || 4.0;
      const dist = Math.hypot(diver.x - cur.x, diver.y - cur.y);
      if (dist <= cr) {
        const falloff = 0.48 + 0.52 * (1 - dist / cr);
        const pulse = 0.88 + 0.12 * Math.sin(session.simTimeSec * 1.15 + c * 2.3);
        diver.vx += (cur.vx || 0) * falloff * pulse * diffCurrentMult * dt;
        diver.vy += (cur.vy || 0) * falloff * pulse * diffCurrentMult * dt;
        if (session.caveFlowWarnCooldown <= 0) {
          session.caveFlowWarnCooldown = 9.0;
          callbacks.onToast?.(`💧 ${cur.label || 'Karst spring current'} — hug the wall or ride the flow!`, 2.4);
        }
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
  if (mutatorId === 'surge' && diver.y > 4.0 && clearanceM > 1.4 && !session.clippedToShotLine) {
    diver.vx += Math.sin(session.simTimeSec * 0.95) * 0.72 * dt;
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
          const isLineTrap = snag.kind === 'linetrap';
          callbacks.onToast?.(
            isLineTrap
              ? `🪢 Snagged in ${snag.label || 'abandoned cave line'} — press [E] / Cut Free!`
              : `🕸️ Tangled in ${snag.label || 'fishing net'} — press [E] / Cut Net!`,
            2.8
          );
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

  // Check nearby cave stage bailout cylinder & unlined junction line-marker stations
  let nearbyStage = null;
  if (Array.isArray(level.stageCaches)) {
    for (let i = 0; i < level.stageCaches.length; i++) {
      const cache = level.stageCaches[i];
      if (!cache || session.claimedStageIds?.has(cache.id)) continue;
      if (Math.hypot(diver.x - cache.x, diver.y - cache.y) <= 3.6) {
        const tank = diveState.tanks?.[cache.gasId];
        const mix = diveState.mixes?.[cache.gasId];
        const maxBar = mix?.startBar || 200;
        if (!tank || tank.bar < maxBar - 1) {
          nearbyStage = cache;
          break;
        }
      }
    }
  }
  let nearbyDroppedStage = null;
  if (Array.isArray(session.droppedStages) && session.droppedStages.length > 0) {
    let bestD = 2.85;
    for (let i = 0; i < session.droppedStages.length; i++) {
      const st = session.droppedStages[i];
      const d = Math.hypot(diver.x - st.x, diver.y - st.y);
      if (d <= bestD) {
        bestD = d;
        nearbyDroppedStage = st;
      }
    }
  }

  let nearbyAnchor = null;
  if (Array.isArray(level.lineAnchors)) {
    for (let i = 0; i < level.lineAnchors.length; i++) {
      const anchor = level.lineAnchors[i];
      if (!anchor || session.placedMarkerIds?.has(anchor.id)) continue;
      if (Math.hypot(diver.x - anchor.x, diver.y - anchor.y) <= 3.6) {
        nearbyAnchor = anchor;
        break;
      }
    }
  }

  const bc = session.encounters?.beacon;
  const nearBeacon = Boolean(bc && !bc.claimed && Math.hypot(diver.x - bc.x, diver.y - bc.y) <= 4.0);

  // Publish contextual cave / shipwreck action prompt for HUD button
  if (session.activeSnagIndex >= 0) {
    const sn = level.snagZones?.[session.activeSnagIndex];
    session.wreckActionPrompt = {
      kind: 'cut-net',
      label: sn?.kind === 'linetrap' ? `✂️ CUT LINE [E]` : `✂️ CUT FREE [E]`,
      detail: sn?.label || (sn?.kind === 'linetrap' ? 'Abandoned Cave Line' : 'Tangled Net'),
      progress: 0,
    };
  } else if (session.buddySnagIndex >= 0) {
    const sn = level.snagZones?.[session.buddySnagIndex];
    session.wreckActionPrompt = {
      kind: 'cut-net',
      label: `✂️ CUT ${session.buddySnagName || 'BUDDY'} FREE [E]`,
      detail: sn?.label || 'Buddy Entangled',
      progress: 0,
    };
  } else if (session.drills?.active) {
    const ak = session.drills.active.kind;
    if (ak === 'mask-flood') {
      session.wreckActionPrompt = {
        kind: 'drill-mask',
        label: '🫧 CLEAR MASK [E]',
        detail: 'Exhale through nose to purge flood (+200)',
        progress: 0,
      };
    } else if (ak === 'torch-fail') {
      session.wreckActionPrompt = {
        kind: 'drill-torch',
        label: '🔦 BACKUP TORCH [L / E]',
        detail: 'Primary light failed — deploy backup (+200)',
        progress: 0,
      };
    } else {
      session.wreckActionPrompt = {
        kind: 'drill-freeflow',
        label: '🔧 ISOLATE VALVE [E]',
        detail: 'Free-flow 3× gas burn — feather or switch gas (+200)',
        progress: 0,
      };
    }
  } else if (nearbyHatch) {
    const needsValve = isHatchPressurized(level, nearbyHatch) && !session.equalizedHatchIds?.has(nearbyHatch.id);
    const isCranking = session.crankingHatchId === nearbyHatch.id;
    if (needsValve) {
      session.wreckActionPrompt = {
        kind: 'equalize-valve',
        label: '🔧 EQUALIZE VALVE [E]',
        detail: `Bleed hull ΔP pressure · ${nearbyHatch.label || 'Pressurized Bulkhead'}`,
        progress: 0,
      };
    } else {
      session.wreckActionPrompt = {
        kind: 'open-hatch',
        label: isCranking ? `⚙️ CRANKING ${Math.round((session.crankingHatchProgress || 0) * 100)}%` : `⚙️ OPEN HATCH [E]`,
        detail: nearbyHatch.label || 'Watertight Hatch',
        progress: isCranking ? session.crankingHatchProgress : 0,
      };
    }
  } else if (nearbyStage) {
    const gasShort = diveState.mixes?.[nearbyStage.gasId]?.shortName || nearbyStage.gasId || 'GAS';
    session.wreckActionPrompt = {
      kind: 'refill-stage',
      label: `⛽ REFILL ${gasShort} [E]`,
      detail: `+${nearbyStage.barBonus || 65} bar · ${nearbyStage.label}`,
      progress: 0,
    };
  } else if (nearbyDroppedStage) {
    session.wreckActionPrompt = {
      kind: 'retrieve-stage',
      label: `🛢 RETRIEVE ${nearbyDroppedStage.shortLabel || nearbyDroppedStage.gasId} [E]`,
      detail: `+${(nearbyDroppedStage.bar || 45) + 5} bar · ${nearbyDroppedStage.isLocal ? 'Your Staged Bottle' : `${nearbyDroppedStage.ownerName}'s Stage`}`,
      progress: 0,
    };
  } else if (nearbyAnchor) {
    session.wreckActionPrompt = {
      kind: 'place-marker',
      label: `🪢 TAG MARKER [E]`,
      detail: `+${nearbyAnchor.reelBonusM || 40}m Spool · ${nearbyAnchor.label}`,
      progress: 0,
    };
  } else if (nearBeacon) {
    session.wreckActionPrompt = {
      kind: 'claim-beacon',
      label: `📡 SALVAGE BEACON [E]`,
      detail: `+${bc.points || MAX_ENCOUNTER_BONUS} pts · 15m Sonar & Reserve`,
      progress: 0,
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
  } else if (!session.salvage?.liftBagActive && (session.salvage?.netTrimKg || 0) >= 12 && diver.y > 4) {
    session.wreckActionPrompt = {
      kind: 'inflate-liftbag',
      label: '🎈 DEPLOY LIFT BAG [E / Y]',
      detail: `Neutralize ${Math.round(session.salvage.payloadKg)}kg heavy salvage trim`,
      progress: 0,
    };
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

  // Flashlight direction: follows diver heading by default, smoothly & deliberately overridden while left torch stick is aimed
  const torchAim = callbacks.torchAim;
  const curTorchAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : diver.angle;
  if (torchAim?.active && Number.isFinite(torchAim.angle)) {
    let tDiff = torchAim.angle - curTorchAng;
    while (tDiff > Math.PI) tDiff -= Math.PI * 2;
    while (tDiff < -Math.PI) tDiff += Math.PI * 2;
    const step = tDiff * (1 - Math.exp(-6.2 * dt));
    const maxStep = 4.8 * dt;
    diver.torchAngle = curTorchAng + Math.max(-maxStep, Math.min(maxStep, step));
    diver.torchManualAim = true;
  } else {
    let targetAng = diver.angle;
    const nowSigMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (diver.signalText && diver.signalExpiresAt > nowSigMs && Number.isFinite(diver.signalStartedAt)) {
      const sigSpec = getScubaSignalById(diver.signalId || diver.signalText);
      const gest = computeTorchSignalGesture(sigSpec, (nowSigMs - diver.signalStartedAt) / 1000);
      if (gest) {
        targetAng = diver.angle + gest.angleOffsetRad;
        diver.strobeMod = Math.min(diver.strobeMod ?? 1, gest.strobeMod);
      }
    }
    let tDiff = targetAng - curTorchAng;
    while (tDiff > Math.PI) tDiff -= Math.PI * 2;
    while (tDiff < -Math.PI) tDiff += Math.PI * 2;
    diver.torchAngle = curTorchAng + tDiff * (1 - Math.exp(-7.5 * dt));
    diver.torchManualAim = false;
  }

  // Cave Wall Collision & Hardcore Diver-to-Diver Physical Collision (v140)
  const hit = resolveDiverCollision(level, diver, 0.52);
  if ((session._peerBumpSoundCooldown || 0) > 0) session._peerBumpSoundCooldown = Math.max(0, session._peerBumpSoundCooldown - dt);
  if ((session._peerBumpToastCooldown || 0) > 0) session._peerBumpToastCooldown = Math.max(0, session._peerBumpToastCooldown - dt);
  let peerHit = { collided: false, impactSpeed: 0, hitPeer: null, nx: 0, ny: 0, pushCount: 0 };
  if (
    session.difficulty === 'hardcore' &&
    peerList &&
    peerList.length > 0 &&
    !diver.surfaced &&
    diveState.alive &&
    (session.simTimeSec >= 2.0 || diver.y > 2.2)
  ) {
    peerHit = resolveDiverPeerCollisions(level, diver, peerList, {
      excludePeerId: session.rescueTargetId || '',
    });
  }
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
  if (peerHit.collided && peerHit.impactSpeed > 0.75) {
    headBumpImpulse = Math.max(headBumpImpulse, peerHit.impactSpeed * 0.75);
    if ((session._peerBumpSoundCooldown || 0) <= 0) {
      session._peerBumpSoundCooldown = 0.45;
      callbacks.onImpactSound?.(Math.min(2.8, peerHit.impactSpeed * 0.9));
    }
    if (peerHit.impactSpeed > 1.15 && diver.y > 4.0) {
      const puff = emitImpactSilt(siltClouds, diver.x, diver.y, -peerHit.nx, -peerHit.ny, peerHit.impactSpeed * 0.75, 'hardcore');
      if (puff.length > 0) callbacks.onSiltSpawn?.(puff[0]);
    }
    if (peerHit.impactSpeed > 1.35 && (session._peerBumpToastCooldown || 0) <= 0) {
      session._peerBumpToastCooldown = 5.5;
      callbacks.onToast?.(
        `⚠️ Tank bump with ${peerHit.hitPeer?.name || 'Buddy'}! Hold single-file spacing in Hardcore.`,
        2.4
      );
    }
  }

  if (siltStirTimer.warnCooldown > 0) siltStirTimer.warnCooldown -= dt;
  const isSiltStorm = mutatorId === 'silt-storm';
  const heavyWash = stirFloorSilt(level, diver, siltClouds, {
    dt,
    thrustMag,
    timerState: siltStirTimer,
    onSpawn: callbacks.onSiltSpawn,
    difficulty: session.difficulty || 'standard',
    dpvBoost: dpvThrusting,
    mutatorMult: isSiltStorm ? 1.75 : 1.0,
  });
  if (isSiltStorm && diver.y > 5.0 && thrustMag > 0.18 && siltClouds.length < 135 && Math.random() < dt * 0.85) {
    const wisp = spawnSiltPlume(siltClouds, {
      x: diver.x - Math.cos(diver.angle) * 0.65 + (Math.random() - 0.5) * 0.7,
      y: diver.y - Math.sin(diver.angle) * 0.45 + 0.35,
      vx: -diver.vx * 0.3 + (Math.random() - 0.5) * 0.35,
      vy: -0.22 - Math.random() * 0.25,
      radius: 0.72,
      maxRadius: 2.9,
      life: 18,
      peakAlpha: 0.58,
    });
    if (wisp) callbacks.onSiltSpawn?.(wisp);
  }
  if (heavyWash && siltStirTimer.warnCooldown <= 0) {
    siltStirTimer.warnCooldown = 5.5;
    if (session.runMilestones) session.runMilestones.heavySiltEvents += 1;
    callbacks.onToast?.(
      dpvThrusting
        ? 'DPV propwash stirring heavy silt! Lift off bottom or toggle DPV off [V].'
        : 'Fin wash stirring floor silt! Lift off the bottom for visibility.',
      2.2
    );
  }

  if (hit.collided && hit.impactSpeed > 1.1) {
    callbacks.onImpactSound?.(hit.impactSpeed);
    const spawned = emitImpactSilt(
      siltClouds,
      diver.x,
      diver.y,
      hit.nx,
      hit.ny,
      hit.impactSpeed,
      isSiltStorm ? 'hardcore' : (session.difficulty || 'standard')
    );
    if (spawned.length > 0) {
      callbacks.onSiltSpawn?.(spawned[0]);
    }
    if (hit.impactSpeed > 2.4 && siltStirTimer.warnCooldown <= 0) {
      siltStirTimer.warnCooldown = 4.5;
      if (session.runMilestones) session.runMilestones.heavySiltEvents += 1;
      callbacks.onToast?.('Cave impact! Dense silt cloud reducing visibility.', 2.4);
    }
  }

  // Reactive Cave & Wreck Hazards: Cold Thermoclines, Overhead Bubble Percolation & Shifting Surge Hatches (v141)
  const hazRes = stepDynamicHazards(session, dt, callbacks);
  // Submerged Storytelling Set-Pieces: Torch-lit lore discovery & cavern wall clearance tracking (v155)
  session.spaceClearanceM = Math.max(0.5, -evaluateCaveSDF(level, diver.x, diver.y));
  if (session.stories) {
    stepSubmergedStories(session.stories, diver, session.simTimeSec, callbacks);
  }

  // Step physiology & dive computer (including HR & gas-burn coupling; DPV lowers physical fin exertion)
  stepDivePhysiology(diveState, {
    depthM: Math.max(0, diver.y),
    prevDepthM,
    dt,
    exertion: effectiveExertion,
    headBumpImpulse,
    isStuck,
    thrustMag,
    gasBurnMultiplier:
      (mutatorId === 'iron-lungs' ? 1.35 : 1.0) *
      (session.drills?.active?.kind === 'free-flow' ? 3.0 : 1.0) *
      (hazRes.gasRateMult || 1.0),
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

  // Checkpoints (on shipwrecks, gate post-turnaround ascent checkpoints so shot-line cp5/cp6 don't auto-fire during descent!)
  const turnaroundIdx = level.isWreck
    ? level.checkpoints.findIndex((c) => c.id === ascentConfig.turnaroundId)
    : -1;
  for (let i = 0; i < level.checkpoints.length; i++) {
    const cp = level.checkpoints[i];
    if (turnaroundIdx >= 0 && i > turnaroundIdx && !ascendingPhase) continue;
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
      if (markExploredAround(session.exploreCells, session.exploredCells, diver.x, diver.y, 4.4, session.exploredGrid) > 0) {
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
  stepDynamicEncounters(session, dt, callbacks);
  // Shallow-water surface weather swell near open basins / shipwrecks (v137)
  if (session.weather?.swellStrength > 0 && diver.y < 9.5 && diveState.alive) {
    let nearOpenBasin = Boolean(level.isWreck);
    if (!nearOpenBasin && Array.isArray(level.openBasins)) {
      for (let i = 0; i < level.openBasins.length; i++) {
        const b = level.openBasins[i];
        if (diver.x >= b.xMin - 4 && diver.x <= b.xMax + 4) {
          nearOpenBasin = true;
          break;
        }
      }
    }
    if (nearOpenBasin) {
      const swell = computeWeatherSwellForce(session.weather, diver.y, session.simTimeSec, { nearOpenBasin });
      diver.vx += swell.ax * dt;
      diver.vy += swell.ay * dt;
    }
  }
  stepBioWake(session, dt, callbacks.peers);
  stepSurfaceRipples(session, dt, callbacks.peers);
  if (session.buddyPing) {
    session.buddyPing.timer = Math.max(0, session.buddyPing.timer - dt);
    if (Array.isArray(callbacks.peers) && session.buddyPing.targetId) {
      const livePeer = callbacks.peers.find((p) => p && p.id === session.buddyPing.targetId);
      if (livePeer) {
        session.buddyPing.x = livePeer.x;
        session.buddyPing.y = livePeer.y;
      }
    }
    if (session.buddyPing.timer <= 0) session.buddyPing = null;
  }
  if (Array.isArray(session.airShareBeams) && session.airShareBeams.length > 0) {
    for (let i = session.airShareBeams.length - 1; i >= 0; i--) {
      session.airShareBeams[i].timer -= dt;
      if (session.airShareBeams[i].timer <= 0) session.airShareBeams.splice(i, 1);
    }
  }
  const rawSilt = stepSiltPhysics(level, siltClouds, diver, dt);
  session.localSiltDensity = Math.min(1, rawSilt + (session.encounters?.fogDensity || 0) * 0.65);

  // Record Dive Computer Depth Profile (every 1.5s or immediately on gas switch) & PB Ghost track (every 0.6s)
  const tDive = diveState.diveTimeSec || session.simTimeSec;
  if (session.diveProfile && session.diveProfile.length < 450) {
    const gasChanged = diveState.activeGasId !== session._lastProfileGas;
    if (gasChanged || tDive - (session._lastProfileSampleAt || 0) >= 1.5) {
      session._lastProfileSampleAt = tDive;
      session._lastProfileGas = diveState.activeGasId;
      const tissueSnap = computeTissueCompartmentStatus(diveState);
      session.diveProfile.push({
        t: Number(tDive.toFixed(1)),
        d: Number(Math.max(0, diver.y).toFixed(1)),
        gas: diveState.activeGasId,
        deco: diveState.stopDepthM || 0,
        ppo2: Number((diveState.ppo2 || 0).toFixed(2)),
        cns: Math.round(diveState.cnsPercent || 0),
        hr: Math.round(diveState.heartRateBpm || 68),
        bar: Math.round(diveState.tanks?.[diveState.activeGasId]?.bar || 0),
        gf99: tissueSnap.gf99Pct,
      });
    }
  }
  if (session.ghostTrack && session.ghostTrack.length < 1200 && session.simTimeSec - (session._lastGhostSampleAt || 0) >= 0.6) {
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
      hatchBonusScore: session.hatchBonusScore || 0,
      photoBonusScore: session.camera?.photoBonusScore || 0,
      encounterBonusScore: session.encounters?.encounterBonusScore || 0,
      drillBonusScore: session.drills?.bonusScore || 0,
      mutatorId: session.mutatorId || '',
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
            ? level.theme?.id === 'aurora-glacial' || (Array.isArray(level.geothermalVents) && level.geothermalVents.length > 0)
              ? `You reached ${Math.round(level.recoveryTarget.y)}m beneath the aurora, recovered ${level.recoveryTarget.name}, rode geothermal updrafts through Trimix & O2 deco, and surfaced safely.`
              : `You reached ${Math.round(level.recoveryTarget.y)}m, recovered ${level.recoveryTarget.name}, cleared Trimix & O2 decompression, and surfaced safely.`
            : `You reached ${Math.round(level.recoveryTarget.y)}m, secured ${level.recoveryTarget.name} on tow, completed deep trimix & oxygen decompression, and brought them home to the surface.`
          : 'You managed trimix bottom gas, avoided silt-outs, completed your oxygen decompression stop, and surfaced safely.',
        scoreSummary: buildSummary(),
      },
      blockedExitDecoDepthM: 0,
    };
  }

  return { nextCheckpoint, outcome: null, blockedExitDecoDepthM: 0 };
}
