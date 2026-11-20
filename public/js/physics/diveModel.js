/**
 * Technical Cave Diving Physiology & Gas Physics Model.
 * Pure ES module shared between browser simulation and Node unit tests.
 */

export const GAS_MIXES = {
  EAN32: {
    id: 'EAN32',
    name: 'EAN32',
    shortLabel: '32/00',
    role: 'Travel (0–33m)',
    fO2: 0.32,
    fHe: 0.0,
    fN2: 0.68,
    tankVolumeL: 11.1, // AL80 stage cylinder
    startBar: 200,
    modM: 33.7,
    minM: 0,
    color: '#38bdf8',
  },
  TMX1455: {
    id: 'TMX1455',
    name: 'TMX 14/55',
    shortLabel: '14/55',
    role: 'Bottom (3–65m)',
    fO2: 0.14,
    fHe: 0.55,
    fN2: 0.31,
    tankVolumeL: 24.0, // Twin 12L backgas
    startBar: 200,
    modM: 90.0,
    minM: 1.5,
    color: '#c084fc',
  },
  O2: {
    id: 'O2',
    name: 'O2 100%',
    shortLabel: '100/0',
    role: 'Deco (0–6m)',
    fO2: 1.0,
    fHe: 0.0,
    fN2: 0.0,
    tankVolumeL: 5.7, // AL40 deco bottle
    startBar: 200,
    modM: 6.0,
    minM: 0,
    color: '#4ade80',
  },
};

export const GAS_ORDER = ['EAN32', 'TMX1455', 'O2'];

// 4-compartment ZH-L16C-inspired inert gas tissue table (game-scaled half-times in seconds)
const COMPARTMENTS = [
  { halfN2: 42, halfHe: 16, aN2: 1.1696, bN2: 0.5578, aHe: 1.6189, bHe: 0.4770 },
  { halfN2: 95, halfHe: 36, aN2: 0.8618, bN2: 0.7222, aHe: 1.3830, bHe: 0.5747 },
  { halfN2: 210, halfHe: 80, aN2: 0.6200, bN2: 0.8126, aHe: 1.1919, bHe: 0.6527 },
  { halfN2: 460, halfHe: 175, aN2: 0.4947, bN2: 0.8434, aHe: 1.0458, bHe: 0.7223 },
];

const WATER_VAPOR_BAR = 0.0627;
const SURFACE_N2_BAR = (1.0 - WATER_VAPOR_BAR) * 0.79;
const GF_LOW = 0.45;
const GF_HIGH = 0.85;

export function depthToBar(depthM) {
  return 1.0 + Math.max(0, depthM) / 10.0;
}

export function barToDepth(bar) {
  return Math.max(0, (bar - 1.0) * 10.0);
}

export function computePPO2(depthM, gas) {
  return depthToBar(depthM) * gas.fO2;
}

export function computeEND(depthM, gas) {
  const pAmb = depthToBar(depthM);
  return Math.max(0, (pAmb * (1 - gas.fHe) - 1.0) * 10.0);
}

export function computeDiverImpairment(state) {
  const cns = state.cnsPercent || 0;
  const dcs = state.dcsStress || 0;
  const hyp = state.hypoxiaStress || 0;
  const narc = state.narcosisLevel || 0;
  const cardiac = state.cardiacStress || 0;
  const hrBpm = state.heartRateBpm || 68;

  const cnsFrac = cns > 25 ? Math.min(1, (cns - 25) / 75) : 0;
  const dcsFrac = dcs > 20 ? Math.min(1, (dcs - 20) / 80) : 0;
  const hypFrac = hyp > 20 ? Math.min(1, (hyp - 20) / 80) : 0;
  const cardiacFrac = cardiac > 25 ? Math.min(1, (cardiac - 25) / 75) : 0;

  // Mild/moderate DCS, hypoxia & cardiac panic thicken drag and raise breathing rate; calming & recovery restores it
  const swimMultiplier = Math.max(
    0.42,
    1 - dcsFrac * 0.36 - hypFrac * 0.42 - cnsFrac * 0.22 - narc * 0.1 - cardiacFrac * 0.2
  );
  const sacMultiplier = 1 + dcsFrac * 0.35 + cnsFrac * 0.3 + hypFrac * 0.25 + cardiacFrac * 0.32;
  const tremor = Math.min(1, cnsFrac * 0.9 + cardiacFrac * 0.35 + (state.ppo2 > 1.65 ? 0.2 : 0));

  let primaryCondition = 'NOMINAL';
  if (state.alive === false) {
    primaryCondition = 'DOWN';
  } else if (state.tanks && state.tanks[state.activeGasId]?.bar <= 0.5) {
    primaryCondition = 'NO GAS';
  } else if (hyp >= 25) {
    primaryCondition = 'HYPOXIA';
  } else if (cns >= 30 || state.ppo2 > 1.6) {
    primaryCondition = 'O2 TOX';
  } else if (dcs >= 22) {
    primaryCondition = 'DCS';
  } else if (cardiac >= 35 || hrBpm >= 150) {
    primaryCondition = 'HIGH HR';
  } else if (narc >= 0.28) {
    primaryCondition = 'NARC';
  } else if (state.tanks && state.tanks[state.activeGasId]?.bar < 50) {
    primaryCondition = 'LOW GAS';
  }

  const severity = Math.max(cnsFrac, dcsFrac, hypFrac, cardiacFrac, narc * 0.7);
  return {
    swimMultiplier,
    sacMultiplier,
    tremor,
    blackout: hypFrac,
    primaryCondition,
    severity,
  };
}

export function createDiveState({ mixOverrides } = {}) {
  const mixes = {};
  const tanks = {};
  for (const id of GAS_ORDER) {
    const base = GAS_MIXES[id];
    const mix = mixOverrides?.[id] ? { ...base, ...mixOverrides[id] } : base;
    mixes[id] = mix;
    tanks[id] = {
      id,
      bar: mix.startBar,
      litersRemaining: mix.tankVolumeL * mix.startBar,
      maxLiters: mix.tankVolumeL * mix.startBar,
    };
  }

  return {
    mixes,
    activeGasId: 'EAN32',
    tanks,
    depthM: 0,
    maxDepthM: 0,
    diveTimeSec: 0,
    ascentRateMPerMin: 0,
    ppo2: mixes.EAN32.fO2,
    endM: 0,
    cnsPercent: 0, // 0..100+
    hypoxiaStress: 0, // 0..100
    narcosisLevel: 0, // 0..1
    dcsStress: 0, // 0..100
    heartRateBpm: 68,
    maxHeartRateBpm: 68,
    panicLevel: 0, // 0..1
    cardiacStress: 0, // 0..100
    ceilingM: 0,
    ndlMin: 99,
    ttsSec: 0,
    stopDepthM: 0,
    stopRemainingSec: 0,
    compartments: COMPARTMENTS.map(() => ({ pN2: SURFACE_N2_BAR, pHe: 0 })),
    warnings: [],
    criticalAlarm: null,
    alive: true,
    causeOfFailure: null,
    failureDetail: null,
    surfaceViolationsSec: 0,
    impairment: {
      swimMultiplier: 1,
      sacMultiplier: 1,
      tremor: 0,
      blackout: 0,
      primaryCondition: 'NOMINAL',
      severity: 0,
    },
  };
}

export function switchGas(state, gasId) {
  if (!GAS_MIXES[gasId] || !state.alive) return false;
  if (state.tanks[gasId].litersRemaining <= 0.1) return false;
  state.activeGasId = gasId;
  return true;
}

function schrienerUpdate(p0, pAlv, dt, halfTime) {
  if (dt <= 0) return p0;
  const k = Math.LN2 / halfTime;
  return pAlv + (p0 - pAlv) * Math.exp(-k * dt);
}

function calcCeilingBar(compartments, gf) {
  let maxTolBar = 1.0;
  for (let i = 0; i < compartments.length; i++) {
    const c = compartments[i];
    const spec = COMPARTMENTS[i];
    const pTotal = c.pN2 + c.pHe;
    if (pTotal <= 0.001) continue;
    const a = (spec.aN2 * c.pN2 + spec.aHe * c.pHe) / pTotal;
    const b = (spec.bN2 * c.pN2 + spec.bHe * c.pHe) / pTotal;
    const tolBar = (pTotal - a * gf) / (gf / b + 1.0 - gf);
    if (tolBar > maxTolBar) maxTolBar = tolBar;
  }
  return maxTolBar;
}

function estimateNDLMinutes(compartments, gas, depthM) {
  const pAmb = depthToBar(depthM);
  const pAlvN2 = Math.max(0, pAmb - WATER_VAPOR_BAR) * gas.fN2;
  const pAlvHe = Math.max(0, pAmb - WATER_VAPOR_BAR) * gas.fHe;

  // Binary / step simulation forward up to 99 game minutes (at 5s steps)
  const sim = compartments.map((c) => ({ pN2: c.pN2, pHe: c.pHe }));
  for (let step = 1; step <= 60; step++) {
    const dt = 10; // 10 seconds per step -> up to 600s (~10 real mins)
    for (let i = 0; i < sim.length; i++) {
      sim[i].pN2 = schrienerUpdate(sim[i].pN2, pAlvN2, dt, COMPARTMENTS[i].halfN2);
      sim[i].pHe = schrienerUpdate(sim[i].pHe, pAlvHe, dt, COMPARTMENTS[i].halfHe);
    }
    const ceilM = barToDepth(calcCeilingBar(sim, GF_HIGH));
    if (ceilM > 0.4) {
      return Math.max(0, Math.round(((step - 1) * dt) / 10));
    }
  }
  return 99;
}

function estimateDecoStopTimeSec(compartments, gas, stopDepthM) {
  const sim = compartments.map((c) => ({ pN2: c.pN2, pHe: c.pHe }));
  const pAmb = depthToBar(stopDepthM);
  const pAlvN2 = Math.max(0, pAmb - WATER_VAPOR_BAR) * gas.fN2;
  const pAlvHe = Math.max(0, pAmb - WATER_VAPOR_BAR) * gas.fHe;
  const targetCeilingM = Math.max(0, stopDepthM - 3.0);

  let sec = 0;
  const deepHeOffgasMult = stopDepthM > 9.0 ? 2.2 : 1.0;
  while (sec < 300) {
    const ceilM = barToDepth(calcCeilingBar(sim, GF_HIGH));
    if (ceilM <= targetCeilingM + 0.1) break;
    sec += 2;
    for (let i = 0; i < sim.length; i++) {
      sim[i].pN2 = schrienerUpdate(sim[i].pN2, pAlvN2, 2, COMPARTMENTS[i].halfN2);
      sim[i].pHe = schrienerUpdate(sim[i].pHe, pAlvHe, 2 * deepHeOffgasMult, COMPARTMENTS[i].halfHe);
    }
  }
  return sec;
}

/**
 * Advances diving physiology by dt seconds.
 * @param {object} state - Dive state created via createDiveState()
 * @param {object} input - { depthM, prevDepthM, dt, exertion (0..1) }
 */
export function stepDivePhysiology(
  state,
  {
    depthM,
    prevDepthM,
    dt,
    exertion = 0.2,
    headBumpImpulse = 0,
    isStuck = false,
    thrustMag = exertion,
  }
) {
  if (!state.alive || dt <= 0) return state;

  const gas = (state.mixes || GAS_MIXES)[state.activeGasId];
  const tank = state.tanks[state.activeGasId];
  const clampedDepth = Math.max(0, depthM);
  const pAmb = depthToBar(clampedDepth);

  state.depthM = clampedDepth;
  if (clampedDepth > state.maxDepthM) state.maxDepthM = clampedDepth;
  if (clampedDepth > 0.3 || state.diveTimeSec > 0) {
    state.diveTimeSec += dt;
  }

  // Heart rate & Panic response: head-bumps and stuck swimming spike HR until diver stops swimming to calm down
  const isRestingCalm = thrustMag < 0.12 && !isStuck;
  if (headBumpImpulse > 0) {
    state.panicLevel = Math.min(1, (state.panicLevel || 0) + Math.min(0.45, headBumpImpulse * 0.22));
    state.heartRateBpm = Math.min(198, (state.heartRateBpm || 68) + Math.min(22, headBumpImpulse * 8));
  }
  if (isStuck) {
    state.panicLevel = Math.min(1, (state.panicLevel || 0) + dt * 0.34);
  } else if (isRestingCalm) {
    state.panicLevel = Math.max(0, (state.panicLevel || 0) - dt * 0.36);
  } else {
    state.panicLevel = Math.max(0, (state.panicLevel || 0) - dt * 0.08);
  }

  const physStressBpm =
    (state.hypoxiaStress || 0) * 0.32 +
    (state.dcsStress || 0) * 0.22 +
    (state.cnsPercent || 0) * 0.18 +
    (state.narcosisLevel || 0) * 18;
  const targetHr = Math.min(
    198,
    Math.max(58, 68 + Math.min(1.4, exertion) * 32 + (state.panicLevel || 0) * 88 + physStressBpm)
  );
  const curHr = state.heartRateBpm || 68;
  const hrRate = targetHr > curHr ? (isStuck ? 2.2 : 1.35) : isRestingCalm ? 0.55 : 0.16;
  state.heartRateBpm = curHr + (targetHr - curHr) * (1 - Math.exp(-dt * hrRate));
  state.maxHeartRateBpm = Math.max(state.maxHeartRateBpm || 68, state.heartRateBpm);

  const hrExcess = Math.max(0, (state.heartRateBpm - 135) / 55);
  if (state.heartRateBpm > 135) {
    state.cardiacStress = Math.min(100, (state.cardiacStress || 0) + dt * (1.2 + hrExcess * 3.8));
  } else {
    const cardiacRecRate = isRestingCalm ? 10.0 : 4.0;
    state.cardiacStress = Math.max(0, (state.cardiacStress || 0) - dt * cardiacRecRate);
  }

  // Ascent rate scaled to gameplay compression (2.0 m/s steady climb ≈ 9.6 m/min safe cruise)
  const ASCENT_TIME_SCALE = 12.5;
  const verticalDelta = prevDepthM - clampedDepth;
  const instantRateMPerMin = ((verticalDelta / dt) * 60) / ASCENT_TIME_SCALE;
  state.ascentRateMPerMin = state.ascentRateMPerMin * 0.84 + instantRateMPerMin * 0.16;

  // Gas consumption coupled directly to Heart Rate / breathing exertion (rest 16 L/min -> panic ~47 L/min)
  // Above 90m (10 ATA), taper pressure multiplier slightly (semi-closed expedition gas efficiency) so 150–185m traverses stay viable
  const hrNorm = Math.max(0, (state.heartRateBpm - 68) / 100);
  const baseSacLPerMin = (16 + exertion * 11.5) * (1 + hrNorm * 0.85);
  const gasCompressionScale = 5.0;
  const effAmb = pAmb <= 10.0 ? pAmb : 10.0 + (pAmb - 10.0) * 0.48;
  const litersBurned = (baseSacLPerMin / 60) * gasCompressionScale * effAmb * dt;

  if (clampedDepth > 0.3) {
    tank.litersRemaining = Math.max(0, tank.litersRemaining - litersBurned);
    tank.bar = (tank.litersRemaining / tank.maxLiters) * gas.startBar;
  }

  if (tank.litersRemaining <= 0.05 && clampedDepth > 0.5) {
    // Check if another tank has gas, warn urgently; elevated HR burns remaining metabolic O2 faster
    state.hypoxiaStress = Math.min(100, state.hypoxiaStress + dt * (28 + hrExcess * 8));
  }

  // Partial pressure of Oxygen & Equivalent Narcotic Depth
  const ppo2 = computePPO2(clampedDepth, gas);
  const endM = computeEND(clampedDepth, gas);
  state.ppo2 = ppo2;
  state.endM = endM;

  // 1. HYPOXIA (PPO2 < 0.16 bar, e.g., breathing TMX 14/55 near surface)
  if (ppo2 < 0.16 && clampedDepth > 0.2) {
    const severity = (0.16 - ppo2) / 0.04; // 0.5+ at surface on TMX14
    state.hypoxiaStress = Math.min(100, state.hypoxiaStress + dt * (14 + severity * 20 + hrExcess * 6));
  } else if (tank.litersRemaining > 0.1) {
    state.hypoxiaStress = Math.max(0, state.hypoxiaStress - dt * 18);
  }

  // 2. HYPEROXIA / O2 TOXICITY (High HR increases cardiac perfusion / O2 sensitivity slightly)
  // 1.65 bar grace cutoff keeps hovering at 6.0m on O2 safe; cap max burn rate at 28%/s (~3.5s panic-recovery window)
  const hrToxMult = 1 + hrExcess * 0.3;
  if (ppo2 > 1.65) {
    const excess = ppo2 - 1.65;
    const rate = Math.min(28, 8.5 + Math.pow(excess * 4.8, 2) * 10);
    state.cnsPercent = Math.min(100, state.cnsPercent + dt * rate * hrToxMult);
  } else if (ppo2 > 1.4) {
    // Working 1.4-1.65 bar O2 deco window (realistic slow NOAA CNS clock so deep O2 deco is viable)
    state.cnsPercent = Math.min(100, state.cnsPercent + dt * 0.28 * hrToxMult);
  } else if (ppo2 <= 1.25) {
    state.cnsPercent = Math.max(0, state.cnsPercent - dt * 1.4);
  } else {
    state.cnsPercent = Math.max(0, state.cnsPercent - dt * 0.45);
  }

  // 3. NITROGEN NARCOSIS (END > 28m; frame-rate-independent smoothing reverses cleanly on Trimix/ascent)
  const targetNarc = endM > 28 ? Math.min(1, (endM - 28) / 22) : 0;
  const narcAlpha = 1 - Math.exp(-dt * 1.8);
  state.narcosisLevel += (targetNarc - state.narcosisLevel) * narcAlpha;

  // 4. INERT GAS TISSUE LOADING & DECOMPRESSION CEILING
  const pAlvN2 = Math.max(0, pAmb - WATER_VAPOR_BAR) * gas.fN2;
  const pAlvHe = Math.max(0, pAmb - WATER_VAPOR_BAR) * gas.fHe;

  // Gameplay-paced deep helium off-gassing above 9m keeps 120-185m deco stops engaging (1-2 min) rather than 8-11 min idle waiting
  const deepHeOffgasMult = clampedDepth > 9.0 ? 2.2 : 1.0;
  for (let i = 0; i < state.compartments.length; i++) {
    const c = state.compartments[i];
    const spec = COMPARTMENTS[i];
    c.pN2 = schrienerUpdate(c.pN2, pAlvN2, dt, spec.halfN2);
    const heDt = pAlvHe < c.pHe ? dt * deepHeOffgasMult : dt;
    c.pHe = schrienerUpdate(c.pHe, pAlvHe, heDt, spec.halfHe);
  }

  const rawCeilingM = barToDepth(calcCeilingBar(state.compartments, GF_HIGH));
  state.ceilingM = rawCeilingM;

  if (rawCeilingM > 0.4) {
    // Round up to standard 3m stop increments (3m, 6m, 9m, 12m...)
    state.stopDepthM = Math.ceil(rawCeilingM / 3) * 3;
    state.stopRemainingSec = estimateDecoStopTimeSec(state.compartments, gas, state.stopDepthM);
    state.ndlMin = 0;
    state.ttsSec = Math.round(state.stopRemainingSec + Math.max(0, clampedDepth - state.stopDepthM) / 0.15);
  } else {
    state.stopDepthM = 0;
    state.stopRemainingSec = 0;
    state.ndlMin = estimateNDLMinutes(state.compartments, gas, clampedDepth);
    state.ttsSec = Math.round(clampedDepth / 0.15);
  }

  // 5. DECOMPRESSION STRESS (Ceiling violation, excessive ascent, or sustained cardiac panic; O2 recompression accelerates recovery)
  const ceilingViolationM = Math.max(0, state.ceilingM - clampedDepth);
  if (ceilingViolationM > 0.6) {
    state.dcsStress = Math.min(100, state.dcsStress + dt * (5 + ceilingViolationM * 4.5));
    if (clampedDepth < 0.8) {
      state.surfaceViolationsSec += dt;
    }
  } else if (state.ascentRateMPerMin > 12 && clampedDepth > 1) {
    state.dcsStress = Math.min(100, state.dcsStress + dt * ((state.ascentRateMPerMin - 12) * 0.8));
  } else {
    const recoveryRate = state.activeGasId === 'O2' && ppo2 <= 1.65 ? 5.2 : 2.8;
    state.dcsStress = Math.max(0, state.dcsStress - dt * recoveryRate);
  }
  if (state.heartRateBpm > 145 && clampedDepth > 1.5) {
    state.dcsStress = Math.min(100, state.dcsStress + dt * hrExcess * 1.4);
  }

  // Track peak physiological stress across dive for honest health scoring
  const curStress = Math.max(
    state.cnsPercent || 0,
    state.dcsStress || 0,
    state.hypoxiaStress || 0,
    state.cardiacStress || 0,
    (state.narcosisLevel || 0) * 60
  );
  if (curStress > (state.peakStress || 0)) state.peakStress = curStress;

  // Warnings & Alarms
  const warnings = [];
  let critical = null;

  if (tank.litersRemaining <= 0.1) {
    warnings.push('OUT OF GAS — SWITCH TANK');
    critical = 'NO GAS';
  } else if (tank.bar < 50) {
    warnings.push(`LOW GAS (${Math.round(tank.bar)} BAR)`);
  }

  const onPlannedO2Deco = state.activeGasId === 'O2' && state.stopDepthM > 0 && ppo2 <= 1.65;
  if (ppo2 < 0.16 && clampedDepth > 0.2) {
    warnings.push('HYPOXIC MIX — SWITCH TO EAN32');
    critical = 'HYPOXIA';
  } else if (ppo2 > 1.65) {
    warnings.push(`HIGH PPO2 (${ppo2.toFixed(2)}) — O2 TOX!`);
    critical = 'O2 TOXICITY';
  } else if (ppo2 > 1.4 && !onPlannedO2Deco) {
    warnings.push(`PPO2 ELEVATED (${ppo2.toFixed(2)})`);
  }

  if (state.narcosisLevel > 0.35) {
    warnings.push(`NARCOSIS (END ${Math.round(endM)}m)`);
  }

  if (state.heartRateBpm >= 150) {
    warnings.push(`HIGH HR (${Math.round(state.heartRateBpm)} BPM) — STOP & CALM DOWN`);
    if (!critical && state.cardiacStress >= 70) critical = 'TACHYCARDIA';
  }

  if (ceilingViolationM > 0.6) {
    warnings.push(`DESCEND TO ${state.stopDepthM}m STOP`);
    if (!critical) critical = 'DECO VIOLATION';
  } else if (state.ascentRateMPerMin > 11 && clampedDepth > 1) {
    warnings.push('SLOW ASCENT RATE');
  }

  state.warnings = warnings;
  state.criticalAlarm = critical;

  // Check lethal physiology thresholds
  if (state.cnsPercent >= 100) {
    state.alive = false;
    state.heartRateBpm = 0;
    state.causeOfFailure = 'OXYGEN TOXICITY (CNS CONVULSION)';
    state.failureDetail = `Breathed ${gas.name} at ${clampedDepth.toFixed(1)}m (PPO2 ${ppo2.toFixed(2)} bar, MOD ${gas.modM}m). High partial pressure oxygen triggered an underwater CNS seizure.`;
  } else if (state.hypoxiaStress >= 100) {
    state.alive = false;
    state.heartRateBpm = 0;
    if (tank.litersRemaining <= 0.1) {
      state.causeOfFailure = 'OUT OF BREATHING GAS';
      state.failureDetail = `${gas.name} cylinder depleted at ${clampedDepth.toFixed(1)}m without switching to an alternate tank.`;
    } else {
      state.causeOfFailure = 'HYPOXIC BLACKOUT';
      state.failureDetail = `Breathed ${gas.name} (${Math.round(gas.fO2 * 100)}% O2) at ${clampedDepth.toFixed(1)}m (PPO2 ${ppo2.toFixed(2)} bar < 0.16 bar). Switch to EAN32 above 20m.`;
    }
  } else if (state.dcsStress >= 100 || state.surfaceViolationsSec >= 3.5) {
    state.alive = false;
    state.heartRateBpm = 0;
    state.causeOfFailure = 'DECOMPRESSION SICKNESS (TYPE II DCS)';
    state.failureDetail = `Violated mandatory ${state.stopDepthM}m decompression ceiling (ceiling ${state.ceilingM.toFixed(1)}m) or ascended too fast, causing inert gas bubble formation.`;
  } else if (state.cardiacStress >= 100) {
    state.alive = false;
    state.heartRateBpm = 0;
    state.causeOfFailure = 'CARDIAC EXHAUSTION / PANIC';
    state.failureDetail = `Heart rate peaked at ${Math.round(state.maxHeartRateBpm)} BPM while thrashing against cave rock without pausing to calm breathing.`;
  }

  state.impairment = computeDiverImpairment(state);
  return state;
}

/**
 * Recommends the optimal cylinder for the diver's current depth and dive phase.
 */
export function getRecommendedGas(state, { ascending = false } = {}) {
  const d = state.depthM;
  const tmxThresholdM = ascending ? 24.5 : 21.5;
  if (d > tmxThresholdM) {
    return state.tanks.TMX1455.bar > 1 ? 'TMX1455' : 'EAN32';
  }
  if (d <= 6.2 && (state.stopDepthM > 0 || ascending) && state.tanks.O2.bar > 1) {
    return 'O2';
  }
  return state.tanks.EAN32.bar > 1 ? 'EAN32' : 'TMX1455';
}

const GAS_HOTKEY = { EAN32: '1', TMX1455: '2', O2: '3' };

/**
 * Returns an unmistakable gas-switch prompt whenever the diver needs to pause
 * and switch regulators (e.g., crossing 21m on EAN32 during descent, taking
 * O2 100% below 6m, or breathing hypoxic Trimix too shallow).
 */
export function getGasSwitchCoach(state, depthM, { ascending = false } = {}) {
  if (!state || state.alive === false) return null;
  const d = Number.isFinite(depthM) ? depthM : state.depthM || 0;
  const mixes = state.mixes || GAS_MIXES;
  const eanMix = mixes.EAN32 || GAS_MIXES.EAN32;
  const tmxMix = mixes.TMX1455 || GAS_MIXES.TMX1455;
  const o2Mix = mixes.O2 || GAS_MIXES.O2;
  const activeId = state.activeGasId;

  // 1. Acute O2 100% toxicity below 5.8m — immediate stop & switch
  if (activeId === 'O2' && d > 5.8) {
    const targetGas = d > 21.5 && state.tanks.TMX1455.bar > 1
      ? 'TMX1455'
      : state.tanks.EAN32.bar > 1
        ? 'EAN32'
        : 'TMX1455';
    const targetName = (mixes[targetGas] || GAS_MIXES[targetGas]).name;
    const hotkey = GAS_HOTKEY[targetGas];
    return {
      severity: 'danger',
      action: 'STOP',
      targetGas,
      gasName: targetName,
      hotkey,
      title: `STOP NOW! SWITCH TO ${targetName}`,
      shortLabel: `⛔ STOP! TAP ${targetName} [${hotkey}]`,
      detail: `${o2Mix.name} turns toxic below 6m — tap here or press [${hotkey}] immediately!`,
    };
  }

  // 2. Hypoxic Trimix too shallow (PPO2 < 0.18 bar)
  if (activeId === 'TMX1455' && d > 0.2 && state.ppo2 < 0.18 && state.tanks.EAN32.bar > 1) {
    const targetGas = d <= 6.0 && state.stopDepthM > 0 && state.tanks.O2.bar > 1 ? 'O2' : 'EAN32';
    const targetName = (mixes[targetGas] || GAS_MIXES[targetGas]).name;
    const hotkey = GAS_HOTKEY[targetGas];
    return {
      severity: 'danger',
      action: 'STOP',
      targetGas,
      gasName: targetName,
      hotkey,
      title: `HYPOXIC GAS! SWITCH TO ${targetName}`,
      shortLabel: `⛔ HYPOXIC! TAP ${targetName} [${hotkey}]`,
      detail: `${tmxMix.name} has too little O2 shallow — switch to ${targetName} [${hotkey}] now!`,
    };
  }

  // 3. Descending (or deep) on EAN32 past safe TMX switch depth (dynamically raised above hypoxic floor for ultra-deep blends like TMX 6/82)
  const tmxMinNormoxicM = Math.max(0, Math.ceil((0.19 / Math.max(0.05, tmxMix.fO2) - 1) * 10));
  const descentSwitchM = Math.max(20.5, Math.min(25.5, tmxMinNormoxicM + 1.5));
  if (activeId === 'EAN32' && state.tanks.TMX1455.bar > 1 && ((!ascending && d >= descentSwitchM) || d >= 26.5)) {
    const urgent = d >= 27.5 || state.ppo2 >= 1.32;
    const ppo2Str = Number.isFinite(state.ppo2) ? state.ppo2.toFixed(2) : '';
    const lineLabelM = Math.round(Math.max(22, descentSwitchM));
    return {
      severity: urgent ? 'danger' : 'warn',
      action: 'STOP',
      targetGas: 'TMX1455',
      gasName: tmxMix.name,
      hotkey: '2',
      title: urgent ? `STOP NOW! SWITCH TO ${tmxMix.name}` : `STOP · SWITCH TO ${tmxMix.name}`,
      shortLabel: urgent ? `⛔ STOP! SWITCH TO ${tmxMix.name} [2]` : `■ STOP · SWITCH TO ${tmxMix.name} [2]`,
      detail: urgent
        ? `${eanMix.name} toxic below 33m (PPO2 ${ppo2Str}) — tap here or press [2] NOW!`
        : `Pause at ${lineLabelM}m & switch from ${eanMix.name} to ${tmxMix.name} before descending deeper`,
    };
  }

  return null;
}

/**
 * Produces a dead-simple "STOP HERE / NOW MOVE HERE" instruction for the ascent phase.
 */
export function getAscentInstruction(state, depthM, checkpointsHit, ascentConfig = {}, nextCheckpoint = null) {
  const turnaroundId = ascentConfig?.turnaroundId ?? 'cp4';
  const switchId = ascentConfig?.switchId ?? 'cp5';
  const switchDepthM = Number.isFinite(ascentConfig?.switchDepthM) ? ascentConfig.switchDepthM : 22.0;

  if (!checkpointsHit || !checkpointsHit.has(turnaroundId)) return null;

  const eanSafeMaxM = Math.max(26.0, switchDepthM + 3.0);
  if ((!checkpointsHit.has(switchId) || depthM > eanSafeMaxM) && depthM > switchDepthM + 0.8) {
    const deepName = state.mixes?.TMX1455?.name || 'TMX 14/55';
    if (state.stopDepthM > switchDepthM + 1.0 && depthM <= state.stopDepthM + 2.2) {
      const rem = Math.max(1, Math.ceil(state.stopRemainingSec));
      return {
        action: 'STOP',
        title: `HOLD ${state.stopDepthM}m DECO · ${rem}s`,
        detail: `Hold ${state.stopDepthM}m ceiling · Stay on ${deepName}`,
        targetY: state.stopDepthM,
        targetGas: 'TMX1455',
      };
    }
    const targetStop = state.stopDepthM > switchDepthM + 1.0 ? state.stopDepthM : Math.round(switchDepthM);
    return {
      action: 'MOVE',
      title: `MOVE TO ${targetStop}m LINE`,
      detail: `Target pace ~9 m/min · Stay on ${deepName}`,
      targetY: targetStop,
      targetGas: 'TMX1455',
    };
  }

  if (
    ((depthM > 16.0 && state.activeGasId !== 'EAN32') || (depthM > 6.5 && state.activeGasId === 'TMX1455')) &&
    state.tanks.EAN32.bar > 1
  ) {
    return {
      action: 'STOP',
      title: 'STOP HERE · SWITCH TO EAN32',
      detail: 'Tap EAN32 on dive computer before ascending',
      targetY: switchDepthM,
      targetGas: 'EAN32',
    };
  }

  if (state.stopDepthM > 6 && depthM <= state.stopDepthM + 2.2) {
    const rem = Math.max(1, Math.ceil(state.stopRemainingSec));
    return {
      action: 'STOP',
      title: `HOLD ${state.stopDepthM}m DECO · ${rem}s`,
      detail: 'Hold depth on EAN32 until intermediate stop clears',
      targetY: state.stopDepthM,
      targetGas: 'EAN32',
    };
  }

  if (state.stopDepthM > 0 && depthM > Math.max(7.4, state.stopDepthM + 1.4)) {
    const stepTarget = state.stopDepthM > 6 ? state.stopDepthM : 6.0;
    return {
      action: 'MOVE',
      title: `NOW MOVE TO ${stepTarget}m LINE`,
      detail: 'Target pace ~9 m/min · On EAN32',
      targetY: stepTarget,
      targetGas: 'EAN32',
    };
  }

  if (state.stopDepthM > 0) {
    if (state.activeGasId !== 'O2' && state.tanks.O2.bar > 1) {
      return {
        action: 'STOP',
        title: 'STOP HERE (6m) · TAP O2 100%',
        detail: 'Switch to O2 100% to clear deco stop',
        targetY: 6.0,
        targetGas: 'O2',
      };
    }
    const rem = Math.max(1, Math.ceil(state.stopRemainingSec));
    return {
      action: 'STOP',
      title: `STOP HERE (6m) · HOLD ${rem}s`,
      detail: 'Hover at 6m line until ceiling clears',
      targetY: 6.0,
      targetGas: 'O2',
    };
  }

  if (nextCheckpoint) {
    const cpDepth = Number.isFinite(nextCheckpoint.y) ? `${Math.round(nextCheckpoint.y)}m` : '';
    return {
      action: 'STOP',
      title: `TAG ${nextCheckpoint.name.toUpperCase()}`,
      detail: cpDepth ? `Required checkpoint at ${cpDepth} before surfacing` : 'Tag remaining checkpoint before surfacing',
      targetY: Number.isFinite(nextCheckpoint.y) ? nextCheckpoint.y : 6.0,
      targetGas: state.activeGasId,
    };
  }

  return {
    action: 'MOVE',
    title: 'NOW MOVE TO SURFACE EXIT',
    detail: 'Ceiling clear ✓ Keep pace ≤10 m/min',
    targetY: 0.5,
    targetGas: state.activeGasId,
  };
}

/**
 * Compute pre-dive Rule-of-Thirds planning metrics for an expedition level.
 */
export function computeSiteDivePlan(level) {
  let maxDepthM = 50;
  if (Array.isArray(level?.checkpoints) && level.checkpoints.length > 0) {
    maxDepthM = Math.max(...level.checkpoints.map((c) => Number(c.y) || 0), level.recoveryTarget?.y || 0);
  }
  const bottomMix = level?.gasOverrides?.TMX1455
    ? { ...GAS_MIXES.TMX1455, ...level.gasOverrides.TMX1455 }
    : GAS_MIXES.TMX1455;
  const bottomGasName = maxDepthM <= 33 ? GAS_MIXES.EAN32.name : bottomMix.name;
  const reelMeters = Math.round(Number(level?.reelMetersPerDiver) || 0);
  const switchDepthM = Number.isFinite(level?.ascentSwitchDepthM) ? Math.round(level.ascentSwitchDepthM) : 22;

  return {
    maxDepthM: Math.round(maxDepthM),
    bottomGasName,
    switchDepthM,
    turnaroundBar: 135,
    reserveBar: 65,
    reelMeters,
    lineModeLabel: reelMeters > 0 ? `Unlined · ${reelMeters}m Spool` : 'Fixed Guideline',
  };
}

/**
 * Find the best safe cylinder a donor can share with a teammate without risking toxic fallback gas.
 */
export function getShareableGasCandidate(state, preferredGasId = null, maxDonateBar = 25, depthM = state?.depthM || 0) {
  if (!state?.tanks || state.alive === false) return null;
  const mixes = state.mixes || GAS_MIXES;
  const candidates = [];
  if (preferredGasId && state.tanks[preferredGasId]) candidates.push(preferredGasId);
  if (state.activeGasId && state.tanks[state.activeGasId]) candidates.push(state.activeGasId);
  for (const id of GAS_ORDER) candidates.push(id);

  const tried = new Set();
  for (const gasId of candidates) {
    if (tried.has(gasId)) continue;
    tried.add(gasId);
    const tank = state.tanks[gasId];
    if (!tank || tank.bar <= 38) continue;
    // Never donate O2 100% below 6.5m (hyperoxic seizure risk at depth)
    if (gasId === 'O2' && depthM > 6.5) continue;
    const donatedBar = Math.min(maxDonateBar, Math.floor(tank.bar - 25));
    if (donatedBar < 8) continue;
    const mix = mixes[gasId] || GAS_MIXES[gasId];
    return { gasId, donatedBar, gasName: mix?.name || gasId };
  }
  return null;
}

/**
 * Donate emergency cylinder gas to an out-of-gas teammate while preserving donor safety reserve.
 */
export function donateGasFromState(state, preferredGasId = null, maxDonateBar = 25) {
  const candidate = getShareableGasCandidate(state, preferredGasId, maxDonateBar, state?.depthM || 0);
  if (!candidate) return null;
  const tank = state.tanks[candidate.gasId];
  const mix = state.mixes?.[candidate.gasId] || GAS_MIXES[candidate.gasId] || GAS_MIXES.EAN32;
  const startBar = mix.startBar || 200;
  tank.bar = Math.max(0, tank.bar - candidate.donatedBar);
  if (Number.isFinite(tank.maxLiters) && tank.maxLiters > 0) {
    tank.litersRemaining = Math.max(0, (tank.bar / startBar) * tank.maxLiters);
  }
  return { gasId: candidate.gasId, donatedBar: candidate.donatedBar };
}

/**
 * Receive emergency gas into a matching cylinder, restoring breathing reserve.
 */
export function receiveGasIntoState(state, gasId, amountBar) {
  if (!state?.tanks || !Number.isFinite(amountBar) || amountBar <= 0) return 0;
  const resolvedId = state.tanks[gasId] ? gasId : state.activeGasId || 'EAN32';
  const tank = state.tanks[resolvedId];
  const mix = state.mixes?.[resolvedId] || GAS_MIXES[resolvedId] || GAS_MIXES.EAN32;
  if (!tank) return 0;
  const startBar = mix.startBar || 200;
  const prev = tank.bar;
  tank.bar = Math.min(startBar, prev + amountBar);
  if (Number.isFinite(tank.maxLiters) && tank.maxLiters > 0) {
    tank.litersRemaining = Math.min(tank.maxLiters, (tank.bar / startBar) * tank.maxLiters);
  }
  return Math.max(0, Math.round((tank.bar - prev) * 10) / 10);
}
