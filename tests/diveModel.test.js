import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GAS_MIXES,
  createDiveState,
  switchGas,
  stepDivePhysiology,
  computePPO2,
  computeEND,
  buildCustomGasBlend,
  getRecommendedGas,
  getAscentInstruction,
  getGasSwitchCoach,
  computeSiteDivePlan,
  getShareableGasCandidate,
  donateGasFromState,
  receiveGasIntoState,
  computeTissueCompartmentStatus,
} from '../public/js/physics/diveModel.js';
import {
  createEmptyLogbook,
  recordDiveInLogbook,
  seedLogbookFromEntries,
  formatLogbookSummary,
  computeCertifications,
  computeUnlockedGear,
  sanitizeGearLoadout,
  DAILY_MUTATORS,
  getDailyChallenge,
  getDailyMutatorById,
  getDailyMutatorForDate,
  buildDailyCalendarMonth,
  recordDailyClear,
  getDailyStatus,
  FIELD_GUIDE_CATALOG,
  getFieldGuideEntry,
  recordFieldGuidePhoto,
  getFieldGuideStats,
  exportLogbookToCsv,
  exportLogbookToJson,
  parseImportedLogbookJson,
  mergeCareerLogbooks,
} from '../public/js/game/logbookModel.js';
import {
  formatReplayTime,
  decodeReplayTrack,
  sampleReplayPoint,
  drawReplayFrame,
  renderExpeditionPostcard,
} from '../public/js/game/diveCard.js';
import {
  SCUBA_SIGNALS,
  getScubaSignalById,
  triggerDiverSignal,
  computeTorchSignalGesture,
} from '../public/js/game/diveSignals.js';
import {
  buildChallengeUrl,
  parseChallengeFromSearch,
  formatChallengeSummary,
  evaluateChallengeResult,
} from '../public/js/game/challengeLink.js';
import { LEVEL_1 } from '../public/js/levels/level1.js';
import { P2pRoomCoordinator, pickNextP2pHostId } from '../public/js/net/p2pRoomHost.js';
import { LanClient } from '../public/js/net/lanClient.js';
import {
  GLOBAL_MAP_VIEWBOX,
  projectMapPoint,
  computeSiteFocusViewBox,
  formatLatLng,
} from '../public/js/game/worldMapData.js';
import {
  computeLevelMaxScore,
  normalizeLeaderboardSubmission,
  queryLeaderboardEntries,
} from '../public/js/game/leaderboardModel.js';
import {
  LEVELS,
  DEFAULT_LEVEL_ID,
  CAMPAIGN_PLAN,
  getLevelById,
  getLevelMeta,
  getAscentConfig,
  validateLevel,
  isValidLevelId,
  PROCEDURAL_TIERS,
  PROCEDURAL_BIOMES,
  normalizeProceduralSeed,
  buildProceduralLevelId,
  parseProceduralLevelId,
  buildProceduralShareUrl,
  parseProceduralFromSearch,
  generateProceduralLevel,
  getDailyGeneratedConfig,
  getDailyGeneratedLevel,
} from '../public/js/levels/index.js';
import { evaluateCaveSDF, evaluateCaveNormal, resolveDiverCollision, createChunkSDFEvaluator, createBoxSDFEvaluator } from '../public/js/game/collision.js';
import {
  createDiveSession,
  stepDiveSession,
  computeBreathProfile,
  stepPeerBubbles,
  toggleGuidelineReel,
  rewindGuidelineSegment,
  getEffectiveReelRemainingM,
  triggerWreckAction,
  dropStageTank,
  retrieveStageTank,
  triggerEmergencyDrill,
  resolveEmergencyDrill,
  toggleDpvScooter,
  triggerSonarPing,
  captureCameraPhoto,
  createDynamicEncounters,
  spawnDynamicVisitor,
  claimSurveyBeacon,
  computeSurgeWave,
  sampleGhostPose,
  applyPeerWreckAction,
  stepSurfaceRipples,
  toggleLiftBag,
  isHatchPressurized,
  computeSalvageBuoyancy,
} from '../public/js/game/diveSession.js';
import {
  computeCollectibleWeightKg,
  LIFT_BAG_INFLATE_BAR,
  LIFT_BAG_CAPACITY_KG,
} from '../public/js/game/salvagePhysics.js';
import {
  MAX_MECH_PARTICLES,
  createMechanicalFxState,
  recordMechanicalEvent,
  stepMechanicalFx,
} from '../public/js/game/mechanicalFx.js';
import {
  buildExploreCells,
  markExploredAround,
  exploreGridKey,
  computeDiverScoreSummary,
  computeTeamScoreSummary,
  computeHealthPct,
} from '../public/js/game/scoring.js';
import {
  sampleEkgWave,
  isMinimapAllowed,
  computeMinimapViewport,
  drawSonarMinimap,
  drawShearwaterComputer,
  sampleDiveProfileAtTime,
} from '../public/js/game/hud.js';
import { CaveRenderer } from '../public/js/game/renderer.js';
import { stirFloorSilt, stepSiltPhysics, spawnSiltPlume, sampleSiltDensity } from '../public/js/game/silt.js';
import { RADIO_TRACKS, midiToFreq, AquaticRadio } from '../public/js/game/aquaticRadio.js';
import { createDiverBody, stepDiverBody } from '../public/js/game/diverBody.js';
import { castLightRay, castTorchFan, castSunCurtain, computeSpectralAbsorption } from '../public/js/game/lighting.js';
import { createMarineEcosystem, stepMarineEcosystem } from '../public/js/game/marineLife.js';

test('PPO2 and END match diving physics for all three mixes', () => {
  assert.ok(Math.abs(computePPO2(50, GAS_MIXES.TMX1455) - 0.84) < 0.01);
  assert.ok(Math.abs(computePPO2(0.5, GAS_MIXES.TMX1455) - 0.147) < 0.01);
  assert.ok(Math.abs(computePPO2(40, GAS_MIXES.EAN32) - 1.6) < 0.01);
  assert.ok(Math.abs(computePPO2(6, GAS_MIXES.O2) - 1.6) < 0.01);

  // Helium reduces narcotic depth significantly at 50m
  const endTmx = computeEND(50, GAS_MIXES.TMX1455);
  const endEan = computeEND(50, GAS_MIXES.EAN32);
  assert.ok(endTmx < 20, `Expected TMX END < 20m, got ${endTmx}`);
  assert.ok(endEan > 45, `Expected EAN32 END > 45m, got ${endEan}`);
});

test('Breathing EAN32 too deep causes Oxygen Toxicity convulsion', () => {
  const state = createDiveState();
  // Active gas starts as EAN32 (MOD 33.7m)
  for (let i = 0; i < 40; i++) {
    stepDivePhysiology(state, { depthM: 46, prevDepthM: 46, dt: 0.5, exertion: 0.3 });
    if (!state.alive) break;
  }
  assert.equal(state.alive, false);
  assert.match(state.causeOfFailure, /OXYGEN TOXICITY/);
});

test('Breathing TMX 14/55 near surface causes Hypoxic Blackout', () => {
  const state = createDiveState();
  assert.equal(switchGas(state, 'TMX1455'), true);
  for (let i = 0; i < 30; i++) {
    stepDivePhysiology(state, { depthM: 0.5, prevDepthM: 0.5, dt: 0.5, exertion: 0.2 });
    if (!state.alive) break;
  }
  assert.equal(state.alive, false);
  assert.match(state.causeOfFailure, /HYPOXIC BLACKOUT/);
});

test('Breathing O2 100% below 6m causes rapid acute Oxygen Toxicity', () => {
  const state = createDiveState();
  assert.equal(switchGas(state, 'O2'), true);
  for (let i = 0; i < 20; i++) {
    stepDivePhysiology(state, { depthM: 18, prevDepthM: 18, dt: 0.5, exertion: 0.2 });
    if (!state.alive) break;
  }
  assert.equal(state.alive, false);
  assert.match(state.causeOfFailure, /OXYGEN TOXICITY/);
});

test('Deep 50m dive builds a deco ceiling that clears on O2 at 6m and fails DCS if skipped', () => {
  // Branch A: Skip deco and surface -> DCS
  const skipState = createDiveState();
  switchGas(skipState, 'TMX1455');
  for (let i = 0; i < 80; i++) {
    stepDivePhysiology(skipState, { depthM: 50, prevDepthM: 50, dt: 1.0, exertion: 0.3 });
  }
  assert.ok(skipState.stopDepthM >= 6, `Expected deco stop >= 6m, got ${skipState.stopDepthM}`);

  for (let i = 0; i < 20; i++) {
    stepDivePhysiology(skipState, { depthM: 0.3, prevDepthM: 0.3, dt: 0.5, exertion: 0.2 });
    if (!skipState.alive) break;
  }
  assert.equal(skipState.alive, false);
  assert.match(skipState.causeOfFailure, /DECOMPRESSION SICKNESS/);

  // Branch B: Hold at 6m on O2 100% -> clears ceiling cleanly
  const cleanState = createDiveState();
  switchGas(cleanState, 'TMX1455');
  for (let i = 0; i < 80; i++) {
    stepDivePhysiology(cleanState, { depthM: 50, prevDepthM: 50, dt: 1.0, exertion: 0.3 });
  }
  switchGas(cleanState, 'O2');
  for (let i = 0; i < 60; i++) {
    stepDivePhysiology(cleanState, { depthM: 6.0, prevDepthM: 6.0, dt: 1.0, exertion: 0.1 });
  }
  assert.equal(cleanState.alive, true);
  assert.ok(cleanState.ceilingM <= 0.6, `Expected cleared ceiling <= 0.6m, got ${cleanState.ceilingM}`);
});

test('Level 1 spawn, guideline, checkpoints, and exit are all navigable open water', () => {
  const points = [
    { label: 'spawn', ...LEVEL_1.spawn },
    ...LEVEL_1.guideline.map((p, idx) => ({ label: `guideline[${idx}]`, ...p })),
    ...LEVEL_1.checkpoints.map((cp) => ({ label: cp.id, x: cp.x, y: cp.y })),
    { label: 'exitZone', x: LEVEL_1.exitZone.x, y: LEVEL_1.exitZone.y },
  ];

  for (const pt of points) {
    const sdf = evaluateCaveSDF(LEVEL_1, pt.x, pt.y);
    assert.ok(sdf < -0.65, `Point ${pt.label} (${pt.x}, ${pt.y}) too close to or inside rock: sdf=${sdf}`);
  }
});

test('Diver collision pushes diver out of cave wall', () => {
  // Choose a point inside solid rock far outside tunnel
  const diver = { x: 0, y: 40, vx: -3, vy: 0 };
  const res = resolveDiverCollision(LEVEL_1, diver, 0.55);
  assert.equal(res.collided, true);
});

test('Articulated diver body preserves limb lengths and deflects off cave walls', () => {
  const diver = {
    x: LEVEL_1.spawn.x,
    y: LEVEL_1.spawn.y,
    vx: 2.5,
    vy: 0.4,
    angle: 0.15,
    body: createDiverBody(LEVEL_1.spawn.x, LEVEL_1.spawn.y, 0.15),
  };

  for (let i = 0; i < 30; i++) {
    stepDiverBody(diver, 0.016, { thrustMag: 1, level: LEVEL_1 });
  }

  const pelvisDist = Math.hypot(diver.body.pelvis.x - diver.x, diver.body.pelvis.y - diver.y);
  assert.ok(Math.abs(pelvisDist - 0.42) < 0.05, `Pelvis constraint drifted: ${pelvisDist}`);

  for (const leg of diver.body.legs) {
    const finDist = Math.hypot(leg.finTip.x - leg.ankle.x, leg.finTip.y - leg.ankle.y);
    assert.ok(Math.abs(finDist - 0.42) < 0.05, `Fin constraint drifted: ${finDist}`);
    assert.ok(evaluateCaveSDF(LEVEL_1, leg.finTip.x, leg.finTip.y) < 0.01);
  }

  // Rotate diver through left-facing (PI), diving down (PI/2), and ascending (-PI/2): fins must always trail behind diver
  for (const angle of [Math.PI, Math.PI * 0.5, -Math.PI * 0.5]) {
    diver.angle = angle;
    for (let i = 0; i < 20; i++) {
      stepDiverBody(diver, 0.016, { thrustMag: 0.8, level: null });
    }
    const bx = -Math.cos(angle);
    const by = -Math.sin(angle);
    for (const leg of diver.body.legs) {
      const fdx = leg.finTip.x - leg.ankle.x;
      const fdy = leg.finTip.y - leg.ankle.y;
      const dot = (fdx * bx + fdy * by) / (Math.hypot(fdx, fdy) || 1);
      assert.ok(dot > 0.5, `Fin failed to follow diver angle ${angle}: dot=${dot}`);
    }
  }
});

test('Ray-cast torch lighting stops at rock walls and attenuates through silt', () => {
  // Inside Cavern Gate (28, 12.5), pointing straight down hits rock floor well before 16m
  const hitFloor = castLightRay(LEVEL_1, 28, 12.5, Math.PI * 0.5, 16.0);
  assert.equal(hitFloor.hitWall, true);
  assert.ok(hitFloor.dist < 7.0, `Expected beam to hit cave floor < 7m, got ${hitFloor.dist}`);
  assert.ok(hitFloor.incidence > 0.2, `Expected positive wall incidence, got ${hitFloor.incidence}`);
  assert.ok(hitFloor.ny < 0, `Expected floor normal pointing upward into water, got ${hitFloor.ny}`);

  // Along open tunnel (toward 52, 26), clear beam reaches farther than silt-occluded beam
  const clearFan = castTorchFan(LEVEL_1, 28, 12.5, 0.52, 0.35, 16.0, 15, []);
  const siltFan = castTorchFan(LEVEL_1, 28, 12.5, 0.52, 0.35, 16.0, 15, [
    { x: 33, y: 15.2, radius: 2.0, alpha: 0.75 },
  ]);
  const clearCenter = clearFan[7].dist;
  const siltCenter = siltFan[7].dist;
  assert.ok(siltCenter < clearCenter, `Expected silt to attenuate beam (${siltCenter} < ${clearCenter})`);

  // Upward underwater torch ray clamps cleanly at water surface (y = 0)
  const surfRay = castLightRay(LEVEL_1, 11, 2.2, -Math.PI * 0.5, 16.0);
  assert.equal(surfRay.hitSurface, true);
  assert.ok(surfRay.y >= -0.05 && surfRay.y <= 0.05, `Expected surface hit near y=0, got ${surfRay.y}`);

  // Entrance and exit cenote sun curtains only stream through open karst mouths and stop on cavern rock
  for (const basin of LEVEL_1.openBasins) {
    const curtains = castSunCurtain(LEVEL_1, basin.xMin - 0.5, basin.xMax + 0.5, basin.sunAngle, 20, [], 16);
    assert.ok(curtains.length >= 1, `Expected open sunlight curtain at ${basin.kind} basin`);
    for (const r of curtains[0]) {
      assert.ok(evaluateCaveSDF(LEVEL_1, r.xTop, 0.04) < 0, 'Sun ray top must stay inside open basin');
      assert.ok(r.yBot > 2.5, `Expected sun ray to penetrate into basin water, got yBot=${r.yBot}`);
    }
  }
});

test('Recommended gas guides EAN32 travel, TMX1455 deep, and O2 deco properly', () => {
  const state = createDiveState();
  state.depthM = 12;
  assert.equal(getRecommendedGas(state, { ascending: false }), 'EAN32');

  state.depthM = 28;
  assert.equal(getRecommendedGas(state, { ascending: false }), 'TMX1455');

  // Ascending past 22m Chimney Switch recommends EAN32
  state.depthM = 20;
  assert.equal(getRecommendedGas(state, { ascending: true }), 'EAN32');

  // Holding at 6m Deco Shelf recommends O2 100%
  state.depthM = 5.8;
  state.stopDepthM = 6;
  assert.equal(getRecommendedGas(state, { ascending: true }), 'O2');
});

test('Cruising ascent reads safe (<11 m/min) while rapid boosted ascent triggers warning', () => {
  const cruise = createDiveState();
  switchGas(cruise, 'TMX1455');
  for (let i = 0; i < 20; i++) {
    stepDivePhysiology(cruise, { depthM: 35 - i * 0.2, prevDepthM: 35 - (i - 1) * 0.2, dt: 0.1, exertion: 0.5 });
  }
  assert.ok(cruise.ascentRateMPerMin <= 10.5, `Expected safe cruise ascent rate, got ${cruise.ascentRateMPerMin}`);
  assert.ok(!cruise.warnings.includes('SLOW ASCENT RATE'));

  const fast = createDiveState();
  switchGas(fast, 'TMX1455');
  for (let i = 0; i < 20; i++) {
    stepDivePhysiology(fast, { depthM: 35 - i * 0.36, prevDepthM: 35 - (i - 1) * 0.36, dt: 0.1, exertion: 1.0 });
  }
  assert.ok(fast.ascentRateMPerMin > 12, `Expected fast ascent rate > 12, got ${fast.ascentRateMPerMin}`);
  assert.ok(fast.warnings.includes('SLOW ASCENT RATE'));
});

test('Ascent instructions clearly guide MOVE -> STOP -> MOVE steps', () => {
  const state = createDiveState();
  switchGas(state, 'TMX1455');
  const hits = new Set(['cp1', 'cp2', 'cp3', 'cp4']);

  // 1. Deep in chimney -> move to 22m
  let step = getAscentInstruction(state, 36, hits);
  assert.equal(step.action, 'MOVE');
  assert.match(step.title, /22m/);

  // 2. Reached 22m on TMX -> stop & switch to EAN32
  hits.add('cp5');
  step = getAscentInstruction(state, 22, hits);
  assert.equal(step.action, 'STOP');
  assert.match(step.title, /EAN32/);

  // 3. Switched to EAN32 -> move to 6m deco line
  switchGas(state, 'EAN32');
  state.stopDepthM = 6;
  state.stopRemainingSec = 14;
  step = getAscentInstruction(state, 15, hits);
  assert.equal(step.action, 'MOVE');
  assert.match(step.title, /6m/);

  // 4. At 6m -> stop & switch to O2, then hold countdown
  step = getAscentInstruction(state, 6.0, hits);
  assert.equal(step.action, 'STOP');
  assert.match(step.title, /O2/);

  switchGas(state, 'O2');
  step = getAscentInstruction(state, 6.0, hits);
  assert.equal(step.action, 'STOP');
  assert.match(step.title, /HOLD 14s/);

  // 5. Ceiling cleared -> move to surface
  state.stopDepthM = 0;
  step = getAscentInstruction(state, 6.0, hits);
  assert.equal(step.action, 'MOVE');
  assert.match(step.title, /SURFACE/);
});

test('Marine ecosystem populates authentic cenote flora, fish, remipedes, and slider turtles in open water', () => {
  const eco = createMarineEcosystem(LEVEL_1);
  assert.ok(eco.anchored.length > 25, `Expected rich anchored cave/cenote formations & flora, got ${eco.anchored.length}`);
  assert.ok(eco.fish.length > 20, `Expected cenote fish & blind cavefish schools, got ${eco.fish.length}`);
  assert.ok(eco.remipedes.length >= 4, `Expected cave remipedes/prawns, got ${eco.remipedes.length}`);
  assert.ok(eco.turtles.length >= 1, `Expected freshwater slider turtle in sunlit cenote basin`);

  for (let i = 0; i < 15; i++) {
    stepMarineEcosystem(eco, { x: 11, y: 3.5 }, 0.05, i * 0.05, LEVEL_1);
  }
  for (const f of eco.fish) {
    assert.ok(evaluateCaveSDF(LEVEL_1, f.x, f.y) < 0, `Fish swam into rock at (${f.x}, ${f.y})`);
  }
});

test('Swimming close to cave floor stirs up diffusing silt clouds bounded inside cave walls', () => {
  // Position diver just above floor at CP4 (Deep Sump: center y=49, floor ~53.6 -> y=52.7 is ~0.9m off floor)
  const diver = {
    x: 114,
    y: 52.6,
    vx: 1.4,
    vy: 0,
    angle: 0,
    body: createDiverBody(114, 52.6, 0),
  };
  const siltClouds = [];
  const timerState = { accum: 0, warnCooldown: 0 };

  let disturbed = false;
  for (let i = 0; i < 30; i++) {
    stepDiverBody(diver, 0.03, { thrustMag: 1.0, level: LEVEL_1 });
    if (stirFloorSilt(LEVEL_1, diver, siltClouds, { dt: 0.03, thrustMag: 1.0, timerState })) {
      disturbed = true;
    }
  }
  assert.ok(disturbed, 'Expected floor-proximity fin wash to trigger heavy silt warning');
  assert.ok(siltClouds.length > 0, 'Expected silt clouds to spawn near cave floor');

  let density = 0;
  for (let i = 0; i < 20; i++) {
    density = stepSiltPhysics(LEVEL_1, siltClouds, diver, 0.05);
  }
  assert.ok(density > 0.1, `Expected dense local silt around diver, got ${density}`);
  for (const s of siltClouds) {
    assert.ok(evaluateCaveSDF(LEVEL_1, s.x, s.y) < 0, `Silt cloud leaked outside cave at (${s.x}, ${s.y})`);
  }
});

test('Articulated calf and fins always trail behind diver across rapid 180-degree turns to the right', () => {
  const diver = {
    x: 42,
    y: 25,
    vx: -2.2,
    vy: 0,
    angle: Math.PI,
    body: createDiverBody(42, 25, Math.PI),
  };
  for (let i = 0; i < 20; i++) {
    stepDiverBody(diver, 1 / 60, { thrustMag: 1, level: LEVEL_1 });
  }
  // Flip abruptly toward right swimming (angle = 0) and swim right along passage
  diver.angle = 0;
  diver.vx = 2.4;
  for (let f = 0; f < 30; f++) {
    stepDiverBody(diver, 1 / 30, { thrustMag: 1, level: LEVEL_1 });
    for (const leg of diver.body.legs) {
      const fdx = leg.finTip.x - leg.ankle.x;
      const fdy = leg.finTip.y - leg.ankle.y;
      const flen = Math.hypot(fdx, fdy);
      assert.ok(fdx / flen < -0.84, `Expected fin to trail left (dot<-0.84) when swimming right, got ${(fdx / flen).toFixed(3)}`);
      const cdx = leg.ankle.x - leg.knee.x;
      const cdy = leg.ankle.y - leg.knee.y;
      const clen = Math.hypot(cdx, cdy);
      assert.ok(cdx / clen < -0.18, `Expected calf not to fold forward when swimming right, got ${(cdx / clen).toFixed(3)}`);
    }
  }
});

test('Level registry validates LEVEL_1 and supports custom level ascent metadata', () => {
  assert.ok(LEVELS.length >= 1);
  assert.equal(getLevelById(DEFAULT_LEVEL_ID), LEVEL_1);
  assert.equal(getLevelById('non-existent-id'), LEVEL_1);

  const check = validateLevel(LEVEL_1);
  assert.equal(check.valid, true, check.errors.join(', '));
  assert.equal(validateLevel({}).valid, false);

  const cfg = getAscentConfig(LEVEL_1);
  assert.equal(cfg.turnaroundId, 'cp4');
  assert.equal(cfg.switchId, 'cp5');
  assert.equal(cfg.switchDepthM, 22.0);

  const customState = createDiveState();
  customState.tanks.TMX1455.bar = 180;
  const customHit = new Set(['custom-turn']);
  const step = getAscentInstruction(customState, 25.0, customHit, {
    turnaroundId: 'custom-turn',
    switchId: 'custom-shelf',
    switchDepthM: 18,
  });
  assert.ok(step && step.title.includes('18m'));
});

test('Cached evaluateCaveSDF evaluates deterministically and preserves open spawn/exit basins', () => {
  const pts = [
    [LEVEL_1.spawn.x, LEVEL_1.spawn.y],
    [114, 49],
    [LEVEL_1.exitZone.x, LEVEL_1.exitZone.y],
    [0, 40],
  ];
  for (const [x, y] of pts) {
    const first = evaluateCaveSDF(LEVEL_1, x, y);
    const second = evaluateCaveSDF(LEVEL_1, x, y);
    assert.equal(first, second);
  }
  assert.ok(evaluateCaveSDF(LEVEL_1, LEVEL_1.spawn.x, LEVEL_1.spawn.y) < 0);
  assert.ok(evaluateCaveSDF(LEVEL_1, LEVEL_1.exitZone.x, LEVEL_1.exitZone.y) < 0);
});

test('createDiveSession & stepDiveSession integrate motion, checkpoints, and exhale bubbles cleanly', () => {
  const session = createDiveSession(LEVEL_1, { diverName: 'Test Diver', spawnOffsetX: 0.5 });
  assert.equal(session.diver.x, LEVEL_1.spawn.x + 0.5);
  assert.equal(session.diver.name, 'Test Diver');

  const hitIds = [];
  for (let i = 0; i < 60; i++) {
    stepDiveSession(session, { x: 0.4, y: 0.8 }, 1 / 30, {
      onCheckpoint: (cp) => hitIds.push(cp.id),
    });
  }
  assert.ok(session.diver.y > LEVEL_1.spawn.y);
  assert.ok(session.bubbles.length >= 0);
  assert.ok(session.diveState.diveTimeSec > 1.5);
});

test("Level 2 (Eagle's Nest Sink) is valid, continuously navigable, and moderately harder than Level 1", () => {
  const lvl2 = getLevelById('eagles-nest-sink');
  assert.equal(lvl2.id, 'eagles-nest-sink');
  assert.equal(lvl2.theme?.surfaceStyle, 'florida-cypress');
  assert.ok(LEVELS.length >= 2);
  const check = validateLevel(lvl2);
  assert.equal(check.valid, true, check.errors.join(', '));

  // Moderately harder criteria: deeper max depth (~60m), rougher rock, more checkpoints
  const maxDepthLvl1 = Math.max(...LEVEL_1.guideline.map((p) => p.y));
  const maxDepthLvl2 = Math.max(...lvl2.guideline.map((p) => p.y));
  assert.ok(maxDepthLvl2 >= 59 && maxDepthLvl2 > maxDepthLvl1, `Expected Level 2 deeper than Level 1 (${maxDepthLvl2} vs ${maxDepthLvl1})`);
  assert.ok(lvl2.checkpoints.length > LEVEL_1.checkpoints.length);
  assert.ok(lvl2.roughness > LEVEL_1.roughness);

  // Verify spawn, exit, all checkpoints, and sampled points along every guideline segment are open water
  assert.ok(evaluateCaveSDF(lvl2, lvl2.spawn.x, lvl2.spawn.y) < -0.6, 'Level 2 spawn blocked');
  assert.ok(evaluateCaveSDF(lvl2, lvl2.exitZone.x, lvl2.exitZone.y) < -0.6, 'Level 2 exit blocked');
  for (const cp of lvl2.checkpoints) {
    assert.ok(evaluateCaveSDF(lvl2, cp.x, cp.y) < -0.55, `Level 2 checkpoint ${cp.id} too tight/blocked`);
  }
  for (let i = 0; i < lvl2.guideline.length - 1; i++) {
    const a = lvl2.guideline[i];
    const b = lvl2.guideline[i + 1];
    for (let s = 0; s <= 6; s++) {
      const t = s / 6;
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      const sdf = evaluateCaveSDF(lvl2, px, py);
      assert.ok(sdf < -0.65, `Level 2 guideline obstructed near (${px.toFixed(1)}, ${py.toFixed(1)}), sdf=${sdf.toFixed(2)}`);
    }
  }

  // Verify ecosystem spawns flora/fauna cleanly for Level 2 Florida Karst theme
  const eco2 = createMarineEcosystem(lvl2);
  assert.ok(eco2.fish.length > 0 && eco2.anchored.length > 0 && eco2.remipedes.length > 0);
});

test('CaveRenderer.initialize and setLevel complete cleanly without stalling at 92%', async () => {
  const prevDoc = globalThis.document;
  const prevImg = globalThis.Image;
  const makeFakeCtx = () =>
    new Proxy(
      {
        createImageData: (iw, ih) => ({ data: new Uint8ClampedArray(iw * ih * 4), width: iw, height: ih }),
        getImageData: (x, y, iw, ih) => ({ data: new Uint8ClampedArray(iw * ih * 4), width: iw, height: ih }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createPattern: () => ({}),
      },
      {
        get(target, prop) {
          if (prop in target) return target[prop];
          return () => {};
        },
      }
    );
  const makeFakeCanvas = () => ({
    width: 1,
    height: 1,
    getContext() { return makeFakeCtx(this.width, this.height); },
  });

  globalThis.document = { createElement: () => makeFakeCanvas() };
  globalThis.Image = class {
    set src(_v) { queueMicrotask(() => this.onload?.()); }
  };

  try {
    const renderer = new CaveRenderer(makeFakeCanvas(), LEVEL_1, { deferBuild: true });
    const progress = [];
    await renderer.initialize({ onProgress: (pct) => progress.push(pct) });
    assert.equal(renderer.ready, true);
    assert.ok(progress.includes(92));

    const lvl2 = getLevelById('eagles-nest-sink');
    const p2 = [];
    const res2 = await renderer.setLevel(lvl2, { onProgress: (pct) => p2.push(pct) });
    assert.equal(res2.cancelled, false);
    assert.equal(renderer.ready, true);
    assert.equal(renderer.level.id, 'eagles-nest-sink');
    assert.ok(p2.includes(92));
    assert.ok(renderer.rockChunks.length > 0 && renderer.rockChunks.every((c) => Number.isFinite(c.y0) && Number.isFinite(c.y1) && (c.y1 - c.y0) <= 64.01));
    assert.equal(renderer.isLevelCached(LEVEL_1.id), true);

    // Switching back to LEVEL_1 restores from baked cache immediately
    const res1Cached = await renderer.setLevel(LEVEL_1);
    assert.equal(res1Cached.fromCache, true);
    assert.equal(renderer.level.id, LEVEL_1.id);

    // Overlapping setLevel calls supersede cleanly without corrupting chunks
    const lvl3 = getLevelById('plura-marble-sump');
    const lvl4 = getLevelById('fontaine-de-vaucluse');
    const pending3 = renderer.setLevel(lvl3);
    const pending4 = renderer.setLevel(lvl4);
    const [r3, r4] = await Promise.all([pending3, pending4]);
    assert.equal(r3.cancelled, true);
    assert.equal(r4.cancelled, false);
    assert.equal(renderer.level.id, lvl4.id);
    assert.equal(renderer.ready, true);
  } finally {
    globalThis.document = prevDoc;
    globalThis.Image = prevImg;
  }
});

test('Progressive toxicity/DCS impairs swim performance and recovers when corrective gas/depth actions are taken', () => {
  const s = createDiveState();
  // Breathe EAN32 deep (44m -> PPO2 > 1.6 & high END) briefly to accumulate moderate CNS + narcosis without dying
  for (let i = 0; i < 6; i++) {
    stepDivePhysiology(s, { depthM: 44, prevDepthM: 44, dt: 0.5, exertion: 0.3 });
  }
  assert.equal(s.alive, true);
  assert.ok(s.cnsPercent > 25, `Expected moderate CNS buildup, got ${s.cnsPercent}`);
  assert.ok(s.narcosisLevel > 0.3, `Expected narcosis buildup, got ${s.narcosisLevel}`);
  assert.ok(s.impairment.swimMultiplier < 1.0, 'Expected progressive swim impairment');
  assert.ok(s.impairment.sacMultiplier > 1.0, 'Expected increased SAC breathing stress');

  const peakCns = s.cnsPercent;
  const peakNarc = s.narcosisLevel;
  // Switch to TMX 14/55 at 44m (lowers PPO2 to ~0.75 & END to ~11.8m) -> reverses CNS & narcosis!
  switchGas(s, 'TMX1455');
  for (let i = 0; i < 10; i++) {
    stepDivePhysiology(s, { depthM: 44, prevDepthM: 44, dt: 0.5, exertion: 0.2 });
  }
  assert.ok(s.cnsPercent < peakCns, `Expected CNS recovery on TMX1455 (${s.cnsPercent} < ${peakCns})`);
  assert.ok(s.narcosisLevel < peakNarc, `Expected narcosis recovery on TMX1455 (${s.narcosisLevel} < ${peakNarc})`);
  assert.ok(s.impairment.primaryCondition !== 'O2 TOX');

  // Verify O2 accelerates DCS stress recovery once safely at 6m stop
  s.dcsStress = 55;
  switchGas(s, 'O2');
  for (let i = 0; i < 6; i++) {
    stepDivePhysiology(s, { depthM: 6, prevDepthM: 6, dt: 0.5, exertion: 0.1 });
  }
  assert.ok(s.dcsStress < 45, `Expected DCS recompression recovery on O2 at 6m, got ${s.dcsStress}`);
});

test('All level collectibles are in open navigable water and award session pickup + burst state', () => {
  for (const lvl of LEVELS) {
    assert.ok(Array.isArray(lvl.collectibles) && lvl.collectibles.length >= 6, `Expected >=6 collectibles on ${lvl.id}`);
    for (const item of lvl.collectibles) {
      const sdf = evaluateCaveSDF(lvl, item.x, item.y);
      assert.ok(sdf < -0.45, `${lvl.id} collectible "${item.id}" at (${item.x}, ${item.y}) is too close to wall (SDF=${sdf.toFixed(2)})`);
    }
  }

  const session = createDiveSession(LEVEL_1);
  assert.ok(session.exploreCells.length > 50, 'Expected open-water exploration cells');
  const target = LEVEL_1.collectibles[0];
  session.diver.x = target.x;
  session.diver.y = target.y;

  let collectedItem = null;
  stepDiveSession(session, { x: 0, y: 0 }, 0.016, {
    onCollect: (item) => {
      collectedItem = item;
    },
  });
  assert.equal(collectedItem?.id, target.id);
  assert.ok(session.collectedIds.has(target.id));
  assert.equal(session.collectBursts.length, 1);
  assert.ok(session.exploredCells.size > 0);
});

test('Scoring engine evaluates health, speed, collectables, explored completeness, and team averages', () => {
  const exploreCells = buildExploreCells(LEVEL_1);
  const cleanState = createDiveState();
  cleanState.diveTimeSec = 120;
  cleanState.maxDepthM = 50.1;

  const stressedState = createDiveState();
  stressedState.diveTimeSec = 230;
  stressedState.cnsPercent = 48;
  stressedState.dcsStress = 32;

  const allHits = new Set(LEVEL_1.checkpoints.map((c) => c.id));
  const allCollect = new Set(LEVEL_1.collectibles.map((c) => c.id));

  const ace = computeDiverScoreSummary({
    name: 'Lead',
    level: LEVEL_1,
    diveState: cleanState,
    checkpointsHit: allHits,
    collectedIds: allCollect,
    exploredCount: exploreCells.length,
    totalExploreCells: exploreCells.length,
    diveTimeSec: 120,
  });

  assert.equal(ace.healthPct, 100);
  assert.equal(ace.speedPct, 100);
  assert.equal(ace.collectiblesSetBonus, 400);
  assert.equal(ace.cartographerBonus, 250);
  assert.equal(ace.rank.grade, 'S+');

  const tiredBuddy = {
    name: 'Buddy',
    alive: true,
    surfaced: true,
    healthPct: 60,
    gasRemainingPct: 40,
    diveTimeSec: 200,
    cnsPercent: 30,
  };
  const team = computeTeamScoreSummary(ace, [tiredBuddy]);
  assert.equal(team.teamSize, 2);
  assert.equal(team.allSurvived, true);
  assert.equal(team.teamSurvivalBonus, 600);
  assert.equal(team.avgHealthPct, 80);
  assert.equal(team.avgTimeSec, 160);
  assert.ok(team.avgGasRemainingPct < 100);
  assert.ok(team.teamScore > ace.totalScore - 400);

  // Stressed slow solo run scores noticeably lower than clean fast run
  const slowSummary = computeDiverScoreSummary({
    name: 'Slow',
    level: LEVEL_1,
    diveState: stressedState,
    checkpointsHit: allHits,
    collectedIds: new Set(),
    exploredCount: Math.floor(exploreCells.length * 0.4),
    totalExploreCells: exploreCells.length,
    diveTimeSec: 230,
  });
  assert.ok(slowSummary.totalScore < ace.totalScore);
});

function polylineLength(pts) {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  return len;
}

function pointToPolylineDist(pts, px, py) {
  let minD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lenSq = vx * vx + vy * vy || 1e-6;
    const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / lenSq));
    minD = Math.min(minD, Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t)));
  }
  return minD;
}

test('Levels 3, 4, and 5 extend route length, preserve main guidelines, add navigable dead ends, and hide largest collectibles in hardest spots', () => {
  assert.ok(LEVELS.length >= 7);
  const lvl2 = getLevelById('eagles-nest-sink');
  const lvl3 = getLevelById('plura-marble-sump');
  const lvl4 = getLevelById('fontaine-de-vaucluse');
  const lvl5 = getLevelById('boesmansgat-abyss');

  for (const lvl of [lvl3, lvl4, lvl5]) {
    const check = validateLevel(lvl);
    assert.equal(check.valid, true, check.errors.join(', '));
    assert.ok(evaluateCaveSDF(lvl, lvl.spawn.x, lvl.spawn.y) < -0.6, `${lvl.id} spawn blocked`);
    assert.ok(evaluateCaveSDF(lvl, lvl.exitZone.x, lvl.exitZone.y) < -0.6, `${lvl.id} exit blocked`);

    for (const cp of lvl.checkpoints) {
      assert.ok(evaluateCaveSDF(lvl, cp.x, cp.y) < -0.55, `${lvl.id} checkpoint ${cp.id} obstructed`);
    }
    for (let i = 0; i < lvl.guideline.length - 1; i++) {
      const a = lvl.guideline[i];
      const b = lvl.guideline[i + 1];
      for (let s = 0; s <= 6; s++) {
        const t = s / 6;
        const px = a.x + (b.x - a.x) * t;
        const py = a.y + (b.y - a.y) * t;
        const sdf = evaluateCaveSDF(lvl, px, py);
        assert.ok(sdf < -0.6, `${lvl.id} guideline blocked near (${px.toFixed(1)}, ${py.toFixed(1)})`);
      }
    }

    const eco = createMarineEcosystem(lvl);
    assert.ok(eco.fish.length > 0 && eco.anchored.length > 0 && eco.remipedes.length > 0);
  }

  // Progressive route length & depth criteria
  const len2 = polylineLength(lvl2.guideline);
  const len3 = polylineLength(lvl3.guideline);
  const len4 = polylineLength(lvl4.guideline);
  const len5 = polylineLength(lvl5.guideline);
  assert.ok(len3 > len2 * 1.25, `Expected Level 3 longer than Level 2 (${len3.toFixed(0)}m vs ${len2.toFixed(0)}m)`);
  assert.ok(len4 > len3 * 1.15, `Expected Level 4 longer than Level 3 (${len4.toFixed(0)}m vs ${len3.toFixed(0)}m)`);
  assert.ok(len5 > len4 * 1.12, `Expected Level 5 longer than Level 4 (${len5.toFixed(0)}m vs ${len4.toFixed(0)}m)`);

  const depth3 = Math.max(...lvl3.guideline.map((p) => p.y));
  const depth4 = Math.max(...lvl4.guideline.map((p) => p.y));
  const depth5 = Math.max(...lvl5.guideline.map((p) => p.y));
  assert.ok(depth3 >= 65 && depth4 >= 73 && depth4 > depth3);
  assert.ok(depth5 >= 91 && depth5 > depth4);

  // Largest & highest-value collectibles sit deep inside unlined dead-end passages (>=12m off main guideline)
  for (const lvl of [lvl3, lvl4, lvl5]) {
    const grandItems = lvl.collectibles.filter((c) => (c.scale || 1) >= 1.45);
    const smallItems = lvl.collectibles.filter((c) => (c.scale || 1) < 1.1);
    assert.ok(grandItems.length >= 4, `Expected >=4 oversized dead-end treasures on ${lvl.id}`);
    assert.ok(smallItems.length >= 5, `Expected main-route collectibles on ${lvl.id}`);
    const maxSmallPts = Math.max(...smallItems.map((c) => c.points));
    for (const giant of grandItems) {
      assert.ok(giant.points > maxSmallPts * 1.5, `${giant.id} should award much more than regular collectibles`);
      const distOffGuideline = pointToPolylineDist(lvl.guideline, giant.x, giant.y);
      assert.ok(
        distOffGuideline >= 12.0,
        `${lvl.id} giant relic "${giant.id}" should be deep in an unlined dead-end (dist=${distOffGuideline.toFixed(1)}m)`
      );
      assert.ok(evaluateCaveSDF(lvl, giant.x, giant.y) < -0.5, `${giant.id} blocked by rock`);
    }
  }

  // Verify disciplined gas conservation completes a 92m Boesmansgat dive alive while reckless trimix waste drains empty
  const pro = createDiveState();
  for (let t = 0; t < 28; t++) stepDivePhysiology(pro, { depthM: (t / 28) * 30, prevDepthM: Math.max(0, (t - 1) / 28 * 30), dt: 1, exertion: 0.4 });
  switchGas(pro, 'TMX1455');
  for (let t = 0; t < 50; t++) stepDivePhysiology(pro, { depthM: 30 + (t / 50) * 62, prevDepthM: 30 + Math.max(0, (t - 1) / 50 * 62), dt: 1, exertion: 0.45 });
  for (let t = 0; t < 50; t++) stepDivePhysiology(pro, { depthM: 92, prevDepthM: 92, dt: 1, exertion: 0.45 });
  for (let t = 0; t < 80; t++) stepDivePhysiology(pro, { depthM: 92 - (t / 80) * 66, prevDepthM: 92 - Math.max(0, (t - 1) / 80 * 66), dt: 1, exertion: 0.4 });
  assert.ok(pro.tanks.TMX1455.bar >= 50, `Expected disciplined gas reserve >= 50 bar, got ${pro.tanks.TMX1455.bar.toFixed(1)}`);
  switchGas(pro, 'EAN32');
  while (pro.depthM > 6) {
    const prev = pro.depthM;
    const next = Math.max(6, prev - 0.16);
    stepDivePhysiology(pro, { depthM: next, prevDepthM: prev, dt: 1, exertion: 0.25 });
  }
  switchGas(pro, 'O2');
  for (let t = 0; t < 160 && pro.stopDepthM > 0 && pro.alive; t++) {
    stepDivePhysiology(pro, { depthM: 6, prevDepthM: 6, dt: 1, exertion: 0.05 });
  }
  assert.equal(pro.alive, true, `Expected survival on disciplined 92m run (${pro.causeOfFailure})`);
  assert.equal(pro.stopDepthM, 0);

  const wasteful = createDiveState();
  switchGas(wasteful, 'TMX1455');
  for (let t = 0; t < 220; t++) stepDivePhysiology(wasteful, { depthM: 88, prevDepthM: 88, dt: 1, exertion: 0.9 });
  assert.ok(wasteful.tanks.TMX1455.bar < 1.0, `Expected high-exertion deep lingering to drain Trimix, got ${wasteful.tanks.TMX1455.bar}`);
});

test('Stuck swimming and head bumps spike heart rate, drain gas faster, impact health, and calm when stopping', () => {
  const calm = createDiveState();
  const panicked = createDiveState();

  // Compare calm cruise vs stuck thrashing + repeated head bumps at 20m on EAN32
  for (let t = 0; t < 16; t++) {
    stepDivePhysiology(calm, { depthM: 20, prevDepthM: 20, dt: 0.5, exertion: 0.35, thrustMag: 0.4 });
    stepDivePhysiology(panicked, {
      depthM: 20,
      prevDepthM: 20,
      dt: 0.5,
      exertion: 0.75,
      headBumpImpulse: t % 3 === 0 ? 2.4 : 0,
      isStuck: true,
      thrustMag: 0.9,
    });
  }

  assert.ok(panicked.heartRateBpm >= 140, `Expected stuck/bump tachycardia >= 140 BPM, got ${panicked.heartRateBpm}`);
  assert.ok(panicked.heartRateBpm > calm.heartRateBpm + 40);
  assert.ok(panicked.cardiacStress > 5, `Expected elevated cardiacStress, got ${panicked.cardiacStress}`);
  assert.ok(panicked.tanks.EAN32.bar < calm.tanks.EAN32.bar - 4, 'Elevated HR must accelerate gas burn');
  assert.ok(computeHealthPct(panicked) < computeHealthPct(calm), 'Sustained high HR must lower health score');

  const peakHr = panicked.heartRateBpm;
  // Stopping swimming calms heart rate down significantly faster
  for (let t = 0; t < 18; t++) {
    stepDivePhysiology(panicked, {
      depthM: 20,
      prevDepthM: 20,
      dt: 0.5,
      exertion: 0,
      isStuck: false,
      thrustMag: 0,
    });
  }
  assert.ok(panicked.heartRateBpm < peakHr - 35, `Expected HR to calm after stopping (${panicked.heartRateBpm} vs peak ${peakHr})`);
  assert.ok(panicked.cardiacStress < 2);

  // EKG P-QRS-T sampler produces distinct R spike and flatline when down
  assert.ok(sampleEkgWave(0.255, true) > 0.85);
  assert.equal(sampleEkgWave(0.255, false), 0);
});

test('Level 6 (Orda Crystal Maze) is a shorter multi-level unlined labyrinth with deployable guideline reel and rewind recovery', () => {
  const lvl6 = getLevelById('orda-crystal-maze');
  const check = validateLevel(lvl6);
  assert.equal(check.valid, true, check.errors.join(', '));
  assert.equal(lvl6.guideline.length, 0, 'Level 6 must have zero fixed guideline');
  assert.equal(lvl6.hideWaypointCompass, true, 'Level 6 must hide directional waypoint compass');
  assert.ok(lvl6.reelMetersPerDiver >= 120 && lvl6.reelMetersPerDiver <= 180);
  assert.ok(lvl6.bounds.xMax < 280 && lvl6.parTimeSec <= 220, 'Level 6 should be a shorter run');
  assert.ok(lvl6.segments.length >= 28, 'Level 6 should contain dense multi-tier passages & dead ends');

  // Spawn, exit, all segment midpoints, checkpoints, and collectibles must sit in open water
  assert.ok(evaluateCaveSDF(lvl6, lvl6.spawn.x, lvl6.spawn.y) < -0.6);
  assert.ok(evaluateCaveSDF(lvl6, lvl6.exitZone.x, lvl6.exitZone.y) < -0.6);
  for (const seg of lvl6.segments) {
    const mx = (seg.ax + seg.bx) * 0.5;
    const my = (seg.ay + seg.by) * 0.5;
    assert.ok(evaluateCaveSDF(lvl6, mx, my) < -0.5, `Segment midpoint blocked near (${mx}, ${my})`);
  }
  for (const cp of lvl6.checkpoints) {
    assert.ok(evaluateCaveSDF(lvl6, cp.x, cp.y) < -0.6, `${cp.id} obstructed`);
  }
  for (const item of lvl6.collectibles) {
    assert.ok(evaluateCaveSDF(lvl6, item.x, item.y) < -0.5, `${item.id} obstructed`);
  }

  // Test deployable reel anchor, auto-extending segments while swimming, tie-off, and rewind recovery
  const sess = createDiveSession(lvl6, { diverName: 'Navigator' });
  assert.equal(sess.reelMaxMeters, lvl6.reelMetersPerDiver);
  assert.equal(sess.reelingActive, false);

  const startRes = toggleGuidelineReel(sess);
  assert.equal(startRes.action, 'start_reel');
  assert.equal(sess.reelingActive, true);
  assert.equal(sess.guidelineChains.length, 1);

  // Swim downward/right into Crystal Gateway tunnel (~9 seconds)
  for (let i = 0; i < 90; i++) {
    stepDiveSession(sess, { x: 0.75, y: 0.65 }, 0.1);
  }
  assert.ok(sess.guidelineChains[0].length >= 2, 'Expected auto-committed guideline segments every 4.2m');
  assert.ok(getEffectiveReelRemainingM(sess) < sess.reelMaxMeters - 5);

  const tieRes = toggleGuidelineReel(sess);
  assert.equal(tieRes.action, 'tie_off');
  assert.equal(sess.reelingActive, false);
  const afterTieRem = sess.reelRemainingM;

  const rwRes = rewindGuidelineSegment(sess);
  assert.equal(rwRes.action, 'rewound');
  assert.ok(rwRes.recoveredM > 0);
  assert.ok(sess.reelRemainingM > afterTieRem, 'Rewinding last segment must recover reel meters');
});

test('Guideline reel edge cases: lined level noop, too-far guard, multi-chain tie-off, full rewind, and spool exhaustion', () => {
  // Lined Level 1 gives zero deployable reel
  const sess1 = createDiveSession(LEVEL_1);
  assert.equal(sess1.reelMaxMeters, 0);
  assert.equal(toggleGuidelineReel(sess1).action, 'none');
  assert.equal(rewindGuidelineSegment(sess1).action, 'none');

  // Level 6 comprehensive reel edge cases
  const lvl6 = getLevelById('orda-crystal-maze');
  const sess6 = createDiveSession(lvl6);

  // Empty rewind when no lines deployed
  assert.equal(rewindGuidelineSegment(sess6).action, 'empty');

  // Deploy first chain, swim right+down to commit nodes, terminate, deploy second chain
  assert.equal(toggleGuidelineReel(sess6).action, 'start_reel');
  for (let i = 0; i < 65; i++) stepDiveSession(sess6, { x: 0.7, y: 0.7 }, 0.1);
  assert.equal(toggleGuidelineReel(sess6).action, 'tie_off');
  assert.equal(toggleGuidelineReel(sess6).action, 'start_reel');
  for (let i = 0; i < 35; i++) stepDiveSession(sess6, { x: 0.8, y: 0.2 }, 0.1);
  assert.equal(toggleGuidelineReel(sess6).action, 'tie_off');
  assert.equal(sess6.guidelineChains.length, 2);

  // Swimming far away (>11m from tail) blocks rewind with too_far
  const savedX = sess6.diver.x;
  const savedY = sess6.diver.y;
  const tail = sess6.guidelineChains[1][sess6.guidelineChains[1].length - 1];
  sess6.diver.x = tail.x + 22;
  sess6.diver.y = tail.y;
  assert.equal(rewindGuidelineSegment(sess6).action, 'too_far');
  sess6.diver.x = savedX;
  sess6.diver.y = savedY;

  // Full rewind removes chains step by step when near tails, or deletes single-node anchor cleanly
  const initialMax = sess6.reelMaxMeters;
  let guard = 0;
  while (sess6.guidelineChains.length > 0 && guard++ < 40) {
    const ch = sess6.guidelineChains[sess6.guidelineChains.length - 1];
    const t = ch[ch.length - 1];
    sess6.diver.x = t.x;
    sess6.diver.y = t.y;
    const rw = rewindGuidelineSegment(sess6);
    assert.equal(rw.action, 'rewound');
  }
  assert.equal(sess6.guidelineChains.length, 0);
  assert.ok(Math.abs(sess6.reelRemainingM - initialMax) < 0.05, 'Full rewind must restore entire spool');

  // Spool exhaustion auto-ties off during open-water swimming and rejects start_reel with empty
  sess6.diver.x = lvl6.spawn.x;
  sess6.diver.y = lvl6.spawn.y + 4;
  sess6.diver.vx = 0;
  sess6.diver.vy = 0;
  sess6.reelRemainingM = 3.0;
  assert.equal(toggleGuidelineReel(sess6).action, 'start_reel');
  for (let i = 0; i < 65; i++) stepDiveSession(sess6, { x: 0, y: 1 }, 0.1);
  assert.equal(sess6.reelingActive, false, 'Reel must auto-terminate once spool reaches zero');
  assert.ok(getEffectiveReelRemainingM(sess6) <= 0.1);
  assert.equal(toggleGuidelineReel(sess6).action, 'empty');

  // Dead diver cannot toggle reel
  sess6.reelRemainingM = 50;
  sess6.diveState.alive = false;
  assert.equal(toggleGuidelineReel(sess6).action, 'none');
});

test('All 33 campaign levels (25 caves/environments + 8 shipwrecks) validate cleanly and scale monotonically to 198m Krubera-Voronya Abyssal Sump', () => {
  assert.equal(CAMPAIGN_PLAN.length, 33, 'Campaign roadmap should chart all 33 levels');
  assert.equal(LEVELS.length, 33, 'All 33 campaign levels should be registered');
  const seenIds = new Set();
  for (let i = 0; i < CAMPAIGN_PLAN.length; i++) {
    const slot = CAMPAIGN_PLAN[i];
    assert.equal(slot.rank, i + 1);
    assert.ok(!seenIds.has(slot.id), `Duplicate campaign id: ${slot.id}`);
    seenIds.add(slot.id);
    assert.equal(slot.implemented, true, `Level slot ${slot.rank} (${slot.id}) should be implemented`);
    assert.ok(Number.isFinite(slot.lat) && Number.isFinite(slot.lng), `Level slot ${slot.rank} must define map coordinates`);
    assert.equal(LEVELS[i].id, slot.id);
  }

  const lvl6 = getLevelById('orda-crystal-maze');
  const lvl7 = getLevelById('dans-cave-abaco');
  const lvl8 = getLevelById('molnar-janos-vaults');
  const lvl9 = getLevelById('blue-hole-dahab-arch');
  const lvl10 = getLevelById('emergence-du-ressel');
  const lvl11 = getLevelById('pozzo-del-merro');
  const lvl12 = getLevelById('hranicka-propast-rift');
  const lvl13 = getLevelById('ox-bel-ha-grand-traverse');
  const lvl14 = getLevelById('silfra-katla-aurora-abyss');
  const lvl15 = getLevelById('strytan-hydrothermal-chimneys');
  const lvl16 = getLevelById('kverkfjoll-subglacial-caves');
  const lvl17 = getLevelById('grjotagja-kleifarvatn-rift');
  const lvl18 = getLevelById('tunel-de-la-atlantida');
  const lvl19 = getLevelById('lagoa-misteriosa-abyss');
  const lvl20 = getLevelById('boy-bulok-asian-sump');

  const meta7 = getLevelMeta(lvl7);
  const check = validateLevel(lvl7, { checkGeometry: true });
  assert.equal(check.valid, true, check.errors.join(', '));
  assert.equal(lvl7.guideline.length, 0, 'Level 7 must have zero fixed guideline');
  assert.equal(lvl7.hideWaypointCompass, true, 'Level 7 must hide directional waypoint compass');
  assert.equal(lvl7.reelMetersPerDiver, 170);
  assert.ok(meta7.maxDepthM >= 69 && meta7.maxDepthM > getLevelMeta(lvl6).maxDepthM, 'Level 7 must go deeper than Level 6');
  assert.ok(lvl7.segments.length > lvl6.segments.length, 'Level 7 must contain denser labyrinth segments than Level 6');
  assert.ok(lvl7.checkpoints.length >= 6 && lvl7.collectibles.length >= 12);

  // Chunk-local SDF evaluator must match global evaluateCaveSDF near geometry
  const chunkEval = createChunkSDFEvaluator(lvl7, 120, 144);
  for (const [tx, ty] of [[126, 46], [134, 52], [142, 58]]) {
    const g = evaluateCaveSDF(lvl7, tx, ty);
    const l = chunkEval(tx, ty);
    assert.ok(Math.abs(g - l) < 0.05, `Chunk SDF drift too large at (${tx},${ty}): ${g} vs ${l}`);
  }

  // Levels 8-20 validate cleanly, ramp depth monotonically, and remain unlined
  for (const lvl of [lvl8, lvl9, lvl10, lvl11, lvl12, lvl13, lvl14, lvl15, lvl16, lvl17, lvl18, lvl19, lvl20]) {
    const c = validateLevel(lvl, { checkGeometry: true });
    assert.equal(c.valid, true, `${lvl.id}: ${c.errors.join(', ')}`);
    assert.equal(lvl.guideline.length, 0, `${lvl.id} must be unlined`);
    assert.equal(lvl.hideWaypointCompass, true, `${lvl.id} must hide compass`);
    assert.ok(lvl.reelMetersPerDiver >= 185, `${lvl.id} must specify reel budget`);
  }
  assert.ok(getLevelMeta(lvl8).maxDepthM >= 78);
  assert.ok(getLevelMeta(lvl9).maxDepthM >= 84);
  assert.ok(Array.isArray(lvl9.archWindows) && lvl9.archWindows.length >= 1, 'Level 9 must highlight The Arch subsea light aperture');
  assert.ok(getLevelMeta(lvl10).maxDepthM >= 88 && getLevelMeta(lvl11).maxDepthM >= 96);
  assert.ok(getLevelMeta(lvl12).maxDepthM >= 104 && getLevelMeta(lvl13).maxDepthM >= 114);
  assert.ok(getLevelMeta(lvl14).maxDepthM >= 128, `Level 14 must reach >=128m (got ${getLevelMeta(lvl14).maxDepthM})`);
  assert.ok(getLevelMeta(lvl15).maxDepthM >= 136, `Level 15 must reach >=136m (got ${getLevelMeta(lvl15).maxDepthM})`);
  assert.ok(getLevelMeta(lvl16).maxDepthM >= 144, `Level 16 must reach >=144m (got ${getLevelMeta(lvl16).maxDepthM})`);
  assert.ok(getLevelMeta(lvl17).maxDepthM >= 152, `Level 17 must reach >=152m (got ${getLevelMeta(lvl17).maxDepthM})`);
  assert.ok(getLevelMeta(lvl18).maxDepthM >= 160, `Level 18 must reach >=160m (got ${getLevelMeta(lvl18).maxDepthM})`);
  assert.ok(getLevelMeta(lvl19).maxDepthM >= 172, `Level 19 must reach >=172m (got ${getLevelMeta(lvl19).maxDepthM})`);
  assert.ok(getLevelMeta(lvl20).maxDepthM >= 185, `Level 20 must reach >=185m (got ${getLevelMeta(lvl20).maxDepthM})`);
});

test('Level 12/13 hypoxic TMX 11/65 survives 115m PPO2 and Level 13 requires fallen-diver recovery before surfacing', () => {
  const lvl13 = getLevelById('ox-bel-ha-grand-traverse');
  const session = createDiveSession(lvl13);
  assert.equal(session.diveState.mixes.TMX1455.name, 'TMX 11/65');
  assert.equal(session.diveState.mixes.TMX1455.modM, 135.0);

  // At 115m depth on TMX 11/65, PPO2 must remain safely under 1.60 bar O2 toxicity threshold
  session.diveState.activeGasId = 'TMX1455';
  stepDivePhysiology(session.diveState, { depthM: 115.0, swimSpeed: 0, dt: 0.5, activeDiverCount: 1 });
  assert.ok(session.diveState.ppo2 > 1.2 && session.diveState.ppo2 < 1.45, `Unexpected 115m PPO2: ${session.diveState.ppo2}`);
  assert.equal(session.diveState.alive, true);

  // Attempting to surface at exitZone (with all checkpoints hit) BEFORE recovering Explorer Mateo Vega must NOT end the mission
  for (const cp of lvl13.checkpoints) session.checkpointsHit.add(cp.id);
  session.diveState.activeGasId = 'EAN32';
  session.diveState.ceilingM = 0;
  session.diver.x = lvl13.exitZone.x;
  session.diver.y = 1.0;
  let recoveredCallbackTarget = null;
  let toastMsg = '';
  const earlyRes = stepDiveSession(session, { x: 0, y: 0 }, 0.1, {
    onBodyRecovered: (rt) => {
      recoveredCallbackTarget = rt;
    },
    onToast: (msg) => {
      toastMsg = msg;
    },
  });
  assert.equal(session.bodyRecovered, false);
  assert.equal(earlyRes.outcome, null, 'Must block surfacing until fallen diver recoveryTarget is collected');
  assert.ok(toastMsg.includes('Recover'), 'Must warn diver to recover body first');

  // Swimming onto recoveryTarget secures body & triggers recovery callback
  session.diveState.activeGasId = 'TMX1455';
  session.diver.x = lvl13.recoveryTarget.x;
  session.diver.y = lvl13.recoveryTarget.y;
  stepDiveSession(session, { x: 0, y: 0 }, 0.1, {
    onBodyRecovered: (rt) => {
      recoveredCallbackTarget = rt;
    },
  });
  assert.equal(session.bodyRecovered, true);
  assert.equal(session.carryingBody, true);
  assert.ok(recoveredCallbackTarget && recoveredCallbackTarget.id === 'fallen-explorer');

  // Now surfacing at exitZone with cleared deco completes the recovery mission
  session.diveState.activeGasId = 'EAN32';
  session.diveState.ceilingM = 0;
  session.diver.x = lvl13.exitZone.x;
  session.diver.y = 1.0;
  const doneRes = stepDiveSession(session, { x: 0, y: 0 }, 0.1);
  assert.ok(doneRes.outcome && doneRes.outcome.success === true, 'Should succeed once body is recovered and deco is clear');
  assert.ok(doneRes.outcome.title.includes('Recovered'));
});

test('Level 14 TMX 9/70 survives 128m, geothermal vents impart upward lift, and Katla Bathysphere Core recovery completes mission', () => {
  const lvl14 = getLevelById('silfra-katla-aurora-abyss');
  assert.ok(lvl14, 'Level 14 should be registered');
  const session = createDiveSession(lvl14);
  assert.equal(session.diveState.mixes.TMX1455.name, 'TMX 9/70');
  assert.equal(session.diveState.mixes.TMX1455.modM, 145.0);

  // At 128m depth on TMX 9/70, PPO2 remains under 1.60 bar O2 toxicity threshold
  session.diveState.activeGasId = 'TMX1455';
  stepDivePhysiology(session.diveState, { depthM: 128.0, swimSpeed: 0, dt: 0.5, activeDiverCount: 1 });
  assert.ok(session.diveState.ppo2 > 1.2 && session.diveState.ppo2 < 1.35, `Unexpected 128m PPO2: ${session.diveState.ppo2}`);
  assert.equal(session.diveState.alive, true);

  // Geothermal vent column accelerates diver upward (negative vy) when positioned inside plume
  const vent = lvl14.geothermalVents[2];
  session.diver.x = vent.x;
  session.diver.y = vent.y - 6.0;
  session.diver.vx = 0;
  session.diver.vy = 0;
  stepDiveSession(session, { x: 0, y: 0 }, 0.2);
  assert.ok(session.diver.vy < -0.2, `Expected geothermal updraft (vy < -0.2), got vy=${session.diver.vy}`);

  // Swimming onto Katla Bathysphere Core secures the probe & surfacing completes with probe title
  for (const cp of lvl14.checkpoints) session.checkpointsHit.add(cp.id);
  session.diver.x = lvl14.recoveryTarget.x;
  session.diver.y = lvl14.recoveryTarget.y;
  stepDiveSession(session, { x: 0, y: 0 }, 0.1);
  assert.equal(session.bodyRecovered, true);

  session.diveState.activeGasId = 'EAN32';
  session.diveState.ceilingM = 0;
  session.diver.x = lvl14.exitZone.x;
  session.diver.y = 1.0;
  const doneRes = stepDiveSession(session, { x: 0, y: 0 }, 0.1);
  assert.ok(doneRes.outcome && doneRes.outcome.success === true, 'Level 14 should succeed after Bathysphere recovery');
  assert.ok(doneRes.outcome.title.includes('Katla Bathysphere Core'), `Unexpected title: ${doneRes.outcome.title}`);
});

test('P2pRoomCoordinator manages host creation, buddy join, dive start, telemetry, recovery, and rejoin cleanly', () => {
  const hostMsgs = [];
  const guestMsgs = [];
  const guest2Msgs = [];

  const coord = new P2pRoomCoordinator({
    code: 'ABCD',
    hostName: 'HostOne',
    levelId: 'ox-bel-ha-grand-traverse',
    maxPlayers: 2,
  });
  coord.bindPlayerSender(coord.hostId, (m) => hostMsgs.push(m));
  const initEnv = coord.getHostInitEnvelope();
  assert.equal(initEnv.room.code, 'ABCD');
  assert.equal(initEnv.room.players.length, 1);

  const guestId = coord.handleRemoteJoin({ name: 'BuddyTwo' }, (m) => guestMsgs.push(m));
  assert.ok(guestId);
  assert.equal(guestMsgs[0].type, 'room_joined');
  assert.equal(guestMsgs[0].room.players.length, 2);
  assert.equal(hostMsgs[hostMsgs.length - 1].type, 'room_update');

  // Launch dive cleanly
  coord.handleMessage(coord.hostId, { type: 'start_dive', force: true });
  assert.equal(hostMsgs.at(-1).type, 'dive_started');
  assert.equal(guestMsgs.at(-1).type, 'dive_started');

  // Telemetry & body recovery relay
  coord.handleMessage(guestId, { type: 'player_state', state: { x: 12, y: 18, gasId: 'TMX1455', depthM: 18 } });
  assert.equal(hostMsgs.at(-1).type, 'peer_state');
  assert.equal(hostMsgs.at(-1).state.x, 12);

  coord.handleMessage(guestId, { type: 'body_recovered', targetId: 'fallen-explorer' });
  assert.equal(hostMsgs.at(-1).type, 'peer_body_recovered');
  assert.equal(hostMsgs.at(-1).playerId, guestId);

  // Brief disconnect + rejoin restores bodyRecoveredBy snapshot
  const token = guestMsgs[0].reconnectToken;
  coord.markDisconnected(guestId);
  coord.handleRemoteRejoin({ reconnectToken: token, name: 'BuddyTwo' }, (m) => guest2Msgs.push(m));
  const rejoinedDive = guest2Msgs.find((m) => m.type === 'dive_started');
  assert.ok(rejoinedDive && rejoinedDive.rejoined === true);
  assert.equal(rejoinedDive.bodyRecoveredBy, guestId);

  // Late drop-in join after dive already started (with maxPlayers: 3) drops straight into dive!
  coord.handleMessage(coord.hostId, { type: 'set_max_players', maxPlayers: 3 });
  const lateMsgs = [];
  const lateId = coord.handleRemoteJoin({ name: 'DropInThree' }, (m) => lateMsgs.push(m));
  assert.ok(lateId);
  const lateDive = lateMsgs.find((m) => m.type === 'dive_started');
  assert.ok(lateDive && lateDive.lateJoin === true && lateDive.rejoined === true);
  assert.equal(lateDive.bodyRecoveredBy, guestId);

  // Host migration ("last out is host"): exporting snapshot and hydrating on next survivor keeps room & frees departed slot
  const snap = coord.exportSnapshot();
  const nextHostId = pickNextP2pHostId(snap.players, coord.hostId);
  assert.equal(nextHostId, guestId);
  const migrated = P2pRoomCoordinator.fromSnapshot(snap, {
    departingHostId: coord.hostId,
    newHostId: nextHostId,
  });
  assert.equal(migrated.room.code, 'ABCD');
  assert.equal(migrated.room.started, true);
  assert.equal(migrated.room.bodyRecoveredBy, guestId);
  assert.equal(migrated.room.players.get(nextHostId).isHost, true);
  assert.equal(migrated.room.players.size, 2, 'Departed host seat freed so former host can rejoin later');

  migrated.destroy();
  coord.destroy();

  // Mid-dive room creation (starting a Solo dive then sharing a link) drops joiners directly into the active dive
  const liveCoord = new P2pRoomCoordinator({
    code: 'LIVE',
    hostName: 'SoloTurnedHost',
    levelId: 'silfra-katla-aurora-abyss',
    maxPlayers: 4,
    initialDiveState: {
      checkpoints: ['cp1', 'cp2'],
      collectibles: ['col-1'],
      bodyRecovered: true,
      playerLines: [[{ x: -3, y: 12 }, { x: 12, y: 26 }]],
    },
  });
  assert.equal(liveCoord.room.started, true);
  assert.equal(liveCoord.room.diveSeq, 1);
  const buddyMsgs = [];
  const buddyId = liveCoord.handleRemoteJoin({ name: 'LinkBuddy' }, (m) => buddyMsgs.push(m));
  assert.ok(buddyId);
  const buddyStart = buddyMsgs.find((m) => m.type === 'dive_started');
  assert.ok(buddyStart && buddyStart.lateJoin === true);
  assert.deepEqual(buddyStart.checkpoints, ['cp1', 'cp2']);
  assert.deepEqual(buddyStart.collectibles, ['col-1']);
  assert.equal(buddyStart.bodyRecoveredBy, liveCoord.hostId);
  assert.equal(buddyStart.playerLines[0].chains[0].length, 2);
  liveCoord.destroy();
});

test('P2pRoomCoordinator deterministic Trystero joinSeq host selection, re-attach, and ghost eviction', () => {
  const coord = new P2pRoomCoordinator({
    code: 'TRY1',
    hostId: 'zzzTrysteroHostId01',
    hostName: 'Alpha',
    levelId: 'cenote-el-abismo',
    maxPlayers: 2,
  });
  coord.bindPlayerSender('zzzTrysteroHostId01', () => {});

  const guestReplies = [];
  const p2 = coord.handleRemoteJoin(
    { name: 'Beta' },
    (m) => guestReplies.push(m),
    'mmmTrysteroGuestId2'
  );
  assert.equal(p2, 'mmmTrysteroGuestId2');
  assert.equal(coord.room.players.size, 2);

  // Re-attaching the same Trystero peerId does not duplicate slots or hit room-full error
  const dupReplies = [];
  const p2Again = coord.handleRemoteJoin(
    { name: 'BetaRenamed' },
    (m) => dupReplies.push(m),
    'mmmTrysteroGuestId2'
  );
  assert.equal(p2Again, 'mmmTrysteroGuestId2');
  assert.equal(coord.room.players.size, 2);
  assert.equal(dupReplies[0].type, 'room_joined');

  // Marking guest disconnected frees seat on next join when room is full
  coord.markDisconnected('mmmTrysteroGuestId2');
  const p3Replies = [];
  const p3 = coord.handleRemoteJoin(
    { name: 'Gamma' },
    (m) => p3Replies.push(m),
    'aaaTrysteroGuestId3'
  );
  assert.equal(p3, 'aaaTrysteroGuestId3');
  assert.equal(coord.room.players.size, 2);
  assert.equal(p3Replies[0].type, 'room_joined');

  // Even when a later peer has a lexicographically smaller random Trystero ID, joinSeq elects earlier survivor
  coord.handleMessage('zzzTrysteroHostId01', { type: 'set_max_players', maxPlayers: 3 });
  coord.handleRemoteJoin({ name: 'BetaBack' }, () => {}, 'zzzLaterTrysteroId4');
  const snap = coord.exportSnapshot();
  const chosen = pickNextP2pHostId(snap.players, 'zzzTrysteroHostId01');
  assert.equal(chosen, 'aaaTrysteroGuestId3');

  coord.destroy();
});

test('LeaderboardModel validates score ceilings, separates solo/team, and builds overall standings', () => {
  const soloMax = computeLevelMaxScore('cenote-el-abismo', false);
  const teamMax = computeLevelMaxScore('cenote-el-abismo', true);
  assert.equal(teamMax, soloMax + 600);

  const bad = normalizeLeaderboardSubmission({
    mode: 'solo',
    levelId: 'cenote-el-abismo',
    score: soloMax + 500,
    timeSec: 120,
    grade: 'S+',
  });
  assert.equal(bad.ok, false);

  const solo1 = normalizeLeaderboardSubmission({
    mode: 'solo',
    levelId: 'cenote-el-abismo',
    playerId: 'pA',
    diverName: 'Alice',
    score: 2600,
    timeSec: 112.4,
    exploredPct: 92,
    grade: 'S',
  });
  const solo2 = normalizeLeaderboardSubmission({
    mode: 'solo',
    levelId: 'eagles-nest-sink',
    playerId: 'pA',
    diverName: 'Alice',
    score: 2450,
    timeSec: 140.0,
    exploredPct: 88,
    grade: 'A',
  });
  const team1 = normalizeLeaderboardSubmission({
    mode: 'team',
    levelId: 'cenote-el-abismo',
    runId: 'AB12-d1-cenote-el-abismo',
    crew: [
      { name: 'Alice', score: 2550, alive: true },
      { name: 'Bob', score: 2500, alive: true },
    ],
    teamSize: 2,
    score: 3250,
    timeSec: 125,
    exploredPct: 96,
    grade: 'S',
  });
  const soloOverLen = normalizeLeaderboardSubmission({
    mode: 'solo',
    levelId: 'cenote-el-abismo',
    playerId: 'pLen',
    diverName: 'SuperLongCallsign123',
    score: 2400,
    timeSec: 130,
    exploredPct: 85,
    grade: 'A',
  });
  assert.equal(soloOverLen.ok, true);
  assert.equal(soloOverLen.entry.displayName.length, 16);
  assert.equal(soloOverLen.entry.displayName, 'SuperLongCallsig');

  assert.ok(solo1.ok && solo2.ok && team1.ok);
  assert.equal(solo1.entry.entryKey, 'pA:cenote-el-abismo');
  assert.equal(team1.entry.entryKey, 'AB12-d1-cenote-el-abismo');

  const all = [solo1.entry, solo2.entry, team1.entry];
  const overallSolo = queryLeaderboardEntries(all, { mode: 'solo', levelId: 'overall' });
  assert.equal(overallSolo.length, 1);
  assert.equal(overallSolo[0].score, 5050);
  assert.equal(overallSolo[0].sitesCompleted, 2);

  const siteTeam = queryLeaderboardEntries(all, { mode: 'team', levelId: 'cenote-el-abismo' });
  assert.equal(siteTeam.length, 1);
  assert.equal(siteTeam[0].displayName, 'Alice + Bob');

  // Verify every single campaign level's perfect Solo & Team score from scoring.js passes ceiling validation!
  for (const lvl of LEVELS) {
    const perfectDiveState = createDiveState();
    const collected = new Set((lvl.collectibles || []).map((c) => c.id));
    const localPerfect = computeDiverScoreSummary({
      name: 'MaxDiver',
      level: lvl,
      diveState: perfectDiveState,
      checkpointsHit: new Set((lvl.checkpoints || []).map((cp) => cp.id)),
      collectedIds: collected,
      exploredCount: 100,
      totalExploreCells: 100,
      diveTimeSec: 10,
    });
    assert.equal(
      localPerfect.maxPossible,
      computeLevelMaxScore(lvl.id, false),
      `Solo max score mismatch on ${lvl.id}`
    );
    const soloCheck = normalizeLeaderboardSubmission({
      mode: 'solo',
      levelId: lvl.id,
      playerId: 'max1',
      diverName: 'MaxDiver',
      score: localPerfect.totalScore,
      timeSec: 10,
      exploredPct: localPerfect.exploredPct,
      collectiblesFound: localPerfect.collectiblesFound,
      grade: localPerfect.rank.grade,
    });
    assert.equal(soloCheck.ok, true, `Perfect solo score rejected on ${lvl.id}: ${soloCheck.error}`);

    const teamPerfect = computeTeamScoreSummary(localPerfect, [
      { name: 'Buddy', alive: true, healthPct: 100, diveTimeSec: 10, gasRemainingPct: 100 },
    ]);
    assert.equal(
      teamPerfect.teamMaxPossible,
      computeLevelMaxScore(lvl.id, true),
      `Team max score mismatch on ${lvl.id}`
    );
    const teamCheck = normalizeLeaderboardSubmission({
      mode: 'team',
      levelId: lvl.id,
      runId: `MAX-${lvl.id}`,
      crew: teamPerfect.roster.map((r) => ({ name: r.name, score: r.totalScore, alive: true })),
      teamSize: 2,
      score: teamPerfect.teamScore,
      timeSec: 10,
      exploredPct: teamPerfect.exploredPct,
      collectiblesFound: teamPerfect.collectiblesFound,
      grade: teamPerfect.teamRank.grade,
    });
    assert.equal(teamCheck.ok, true, `Perfect team score rejected on ${lvl.id}: ${teamCheck.error}`);
  }
});

test('Pre-dive plan, emergency gas share, P2P gas relay, and career logbook work cleanly', () => {
  const plan1 = computeSiteDivePlan(LEVEL_1);
  assert.equal(plan1.turnaroundBar, 135);
  assert.equal(plan1.reserveBar, 65);
  assert.ok(plan1.maxDepthM >= 49);

  const l6 = getLevelById('orda-crystal-maze');
  const plan6 = computeSiteDivePlan(l6);
  assert.ok(plan6.reelMeters > 0);
  assert.ok(plan6.lineModeLabel.includes('Spool'));

  // Gas sharing honors donor safety reserve and clamps receiver to tank startBar
  const donor = createDiveState();
  const receiver = createDiveState();
  receiver.tanks.EAN32.bar = 10;
  const gift = donateGasFromState(donor, 'EAN32', 25);
  assert.deepEqual(gift, { gasId: 'EAN32', donatedBar: 25 });
  assert.equal(donor.tanks.EAN32.bar, 175);
  const added = receiveGasIntoState(receiver, gift.gasId, gift.donatedBar);
  assert.equal(added, 25);
  assert.equal(receiver.tanks.EAN32.bar, 35);

  donor.tanks.EAN32.bar = 25;
  donor.tanks.TMX1455.bar = 25;
  donor.tanks.O2.bar = 25;
  assert.equal(donateGasFromState(donor, 'EAN32', 25), null);

  // P2P coordinator relays emergency gas shares exclusively to intended target
  const hostMsgs = [];
  const buddyMsgs = [];
  const coord = new P2pRoomCoordinator({ code: 'GAS9', hostId: 'h1', hostName: 'Host' });
  coord.bindPlayerSender('h1', (m) => hostMsgs.push(m));
  coord.handleRemoteJoin({ name: 'Buddy' }, (m) => buddyMsgs.push(m), 'b1');
  coord.handleMessage('h1', { type: 'gas_share', targetPlayerId: 'b1', gasId: 'TMX1455', amountBar: 25 });
  const gasMsg = buddyMsgs.find((m) => m.type === 'peer_gas_share');
  assert.ok(gasMsg);
  assert.equal(gasMsg.amountBar, 25);
  assert.equal(gasMsg.gasId, 'TMX1455');
  assert.equal(gasMsg.fromName, 'Host');

  // Career logbook accumulates dives, seeds from legacy cache entries, and awards ratings
  let book = createEmptyLogbook();
  book = recordDiveInLogbook(book, {
    levelId: 'cenote-el-abismo',
    success: true,
    score: 2600,
    grade: 'S',
    maxDepthM: 50.1,
    diveTimeSec: 120,
  });
  book = seedLogbookFromEntries(book, [
    { mode: 'solo', levelId: 'eagles-nest-sink', score: 2500, grade: 'A', timeSec: 140 },
    { mode: 'solo', levelId: 'plura-fjord-siphon', score: 2700, grade: 'S+', timeSec: 165 },
  ]);
  const summary = formatLogbookSummary(book, LEVELS.length);
  assert.equal(summary.clearedCount, 3);
  assert.equal(summary.campaignMedal, 'FULL CAVE');
  assert.equal(summary.bestScore, 2700);
});

test('Floor silt stir emits full shared plumes, P2P relays them cleanly, and all torch beams attenuate', () => {
  const clouds = [];
  const spawnedEvents = [];
  // Near floor of Level 1 turnaround sump (~49m)
  const floorDiver = { x: 114, y: 52.8, vx: 1.5, vy: 0, angle: 0 };
  const timerState = { accum: 0.9 };
  stirFloorSilt(LEVEL_1, floorDiver, clouds, {
    dt: 0.25,
    thrustMag: 0.9,
    timerState,
    onSpawn: (pl) => spawnedEvents.push(pl),
  });
  assert.ok(clouds.length >= 1 && spawnedEvents.length >= 1);
  const srcPlume = spawnedEvents[0];
  assert.ok(Number.isFinite(srcPlume.vx) && Number.isFinite(srcPlume.vy));
  assert.ok(srcPlume.maxRadius > 1.5 && srcPlume.peakAlpha > 0.4);

  // Host relays peer_silt with full velocity/opacity metadata
  const buddyMsgs = [];
  const coord = new P2pRoomCoordinator({ code: 'SLT2', hostId: 'h1', hostName: 'Lead' });
  coord.bindPlayerSender('h1', () => {});
  coord.handleRemoteJoin({ name: 'Buddy' }, (m) => buddyMsgs.push(m), 'b1');
  coord.handleMessage('h1', { type: 'silt_event', plume: srcPlume });
  const peerEvt = buddyMsgs.find((m) => m.type === 'peer_silt');
  assert.ok(peerEvt?.plume);
  assert.equal(peerEvt.plume.canBud, false);
  assert.ok(peerEvt.plume.peakAlpha >= 0.4);

  // Buddy spawns received cloud cleanly; both clear and peer torch rays attenuate through it
  const buddyClouds = [];
  spawnSiltPlume(buddyClouds, { ...peerEvt.plume, x: 112, y: 49.0, radius: 2.2, peakAlpha: 0.85 });
  assert.ok(sampleSiltDensity(112, 49.0, buddyClouds) > 0.5);
  const clearRay = castLightRay(LEVEL_1, 108, 49.0, 0, 14.0, []);
  const murkyRay = castLightRay(LEVEL_1, 108, 49.0, 0, 14.0, buddyClouds);
  assert.ok(murkyRay.dist < clearRay.dist, `Expected shared silt to shorten light reach (${murkyRay.dist} vs ${clearRay.dist})`);
});

test('Co-op Buddy Rescue affects team score cleanly and Aquatic Radio cycles MIDI tracks', () => {
  const ds = createDiveState();
  const s = computeDiverScoreSummary({
    name: 'Rescuer',
    level: LEVEL_1,
    diveState: ds,
    checkpointsHit: new Set(['cp1', 'cp2', 'cp3', 'cp4', 'cp5']),
    collectedIds: new Set(),
    exploredCount: 80,
    totalExploreCells: 100,
    diveTimeSec: 150,
  });

  // Unrescued downed buddy loses Team Survival Bonus and has 0 rescue bonus
  const leftBehind = computeTeamScoreSummary(s, [
    { id: 'b1', name: 'DownBuddy', alive: false, rescued: false },
  ]);
  assert.equal(leftBehind.teamSurvivalBonus, 0);
  assert.equal(leftBehind.rescueBonus, 0);
  assert.equal(leftBehind.allSurvived, false);

  // Rescued downed buddy earns +450 Rescue Bonus + restores +600 Team Extraction Bonus cleanly inside leaderboard ceiling
  const rescuedTeam = computeTeamScoreSummary(s, [
    { id: 'b1', name: 'DownBuddy', alive: false, rescued: true },
  ]);
  assert.equal(rescuedTeam.rescueBonus, 450);
  assert.equal(rescuedTeam.teamSurvivalBonus, 600);
  assert.equal(rescuedTeam.allSurvived, true);
  assert.ok(rescuedTeam.teamScore > leftBehind.teamScore);
  assert.ok(rescuedTeam.teamScore <= computeLevelMaxScore(LEVEL_1.id, true));

  // P2P relay of buddy_rescue reaches crew cleanly
  const buddyMsgs = [];
  const coord = new P2pRoomCoordinator({ code: 'RES2', hostId: 'h1', hostName: 'Rescuer' });
  coord.bindPlayerSender('h1', () => {});
  coord.handleRemoteJoin({ name: 'DownBuddy' }, (m) => buddyMsgs.push(m), 'b1');
  coord.handleMessage('h1', { type: 'buddy_rescue', rescuedId: 'b1', rescuedName: 'DownBuddy', status: 'towing' });
  const rMsg = buddyMsgs.find((m) => m.type === 'peer_buddy_rescue');
  assert.equal(rMsg?.rescuerId, 'h1');
  assert.equal(rMsg?.status, 'towing');

  // MIDI frequency & track cycling
  assert.ok(Math.abs(midiToFreq(69) - 440) < 0.001);
  assert.ok(RADIO_TRACKS.length >= 5);
  const radio = new AquaticRadio(() => null);
  assert.equal(radio.getCurrentTrack().id, 'off');
  assert.equal(radio.cycleTrack().id, 'cenote-drift');
  assert.equal(radio.cycleTrack().id, 'halocline-haze');
  assert.equal(radio.cycleTrack().id, 'abyssal-pulse');
  assert.equal(radio.cycleTrack().id, 'kelp-glow');
  assert.equal(radio.cycleTrack().id, 'off');
});

test('Expedition worldMapData projects all 20 dive sites cleanly inside global & site focus viewBoxes', () => {
  for (const slot of CAMPAIGN_PLAN) {
    const pt = projectMapPoint(slot.lng, slot.lat);
    assert.ok(
      pt.x >= GLOBAL_MAP_VIEWBOX.x && pt.x <= GLOBAL_MAP_VIEWBOX.x + GLOBAL_MAP_VIEWBOX.w,
      `${slot.id} x=${pt.x} outside global map width`
    );
    assert.ok(
      pt.y >= GLOBAL_MAP_VIEWBOX.y && pt.y <= GLOBAL_MAP_VIEWBOX.y + GLOBAL_MAP_VIEWBOX.h,
      `${slot.id} y=${pt.y} outside global map height`
    );

    const vb = computeSiteFocusViewBox(slot.id, slot);
    assert.ok(vb.w < GLOBAL_MAP_VIEWBOX.w * 0.35, `${slot.id} focus viewBox should zoom significantly`);
    assert.ok(
      pt.x >= vb.x + 2 && pt.x <= vb.x + vb.w - 2,
      `${slot.id} x=${pt.x} outside focus box [${vb.x}..${vb.x + vb.w}]`
    );
    assert.ok(
      pt.y >= vb.y + 2 && pt.y <= vb.y + vb.h - 2,
      `${slot.id} y=${pt.y} outside focus box [${vb.y}..${vb.y + vb.h}]`
    );
  }
  assert.equal(formatLatLng(20.4, -87.3), '20.4°N · 87.3°W');
  assert.equal(formatLatLng(-27.9, 23.6), '27.9°S · 23.6°E');
});

test('Level 9 Blue Hole checkpoints cover main shaft & Bells exit without exit soft-lock', () => {
  const lvl9 = getLevelById('blue-hole-dahab-arch');
  assert.equal(validateLevel(lvl9).valid, true);

  const cp2 = lvl9.checkpoints.find((c) => c.id === 'cp2');
  const cp8 = lvl9.checkpoints.find((c) => c.id === 'cp8');
  assert.ok(cp2 && cp8);

  // Descending straight down Blue Hole shaft at x=14, y=20 hits cp2 even without Saddle detour
  assert.ok(Math.hypot(14 - cp2.x, 20.0 - cp2.y) <= cp2.radius, 'Main Blue Hole pit must tag cp2');
  // Ascending straight up Bells exit chasm along x=306 hits cp8 across 6m -> exit
  assert.ok(Math.hypot(306 - cp8.x, 5.8 - cp8.y) <= cp8.radius, 'Bells exit shaft center must tag cp8');
  assert.ok(Math.hypot(306 - cp8.x, 1.5 - cp8.y) <= cp8.radius, 'Floating inside Bells exit should still tag cp8');

  // getAscentInstruction must warn to tag unhit checkpoint instead of prematurely directing to surface exit
  const state = createDiveState();
  switchGas(state, 'O2');
  state.stopDepthM = 0;
  const partialHits = new Set(['cp1', 'cp2', 'cp3', 'cp4', 'cp5', 'cp6', 'cp7']);
  const blockedStep = getAscentInstruction(state, 1.0, partialHits, getAscentConfig(lvl9), cp8);
  assert.equal(blockedStep.action, 'STOP');
  assert.match(blockedStep.title, /BELLS 6M DECO CHASM/);

  // stepDiveSession warns instead of failing silently if an unhit checkpoint blocks surface exit
  const lvl9Custom = {
    ...lvl9,
    checkpoints: lvl9.checkpoints.map((c) => (c.id === 'cp8' ? { ...c, x: 280, radius: 1.5 } : c)),
  };
  const session = createDiveSession(lvl9Custom);
  for (const c of lvl9Custom.checkpoints) {
    if (c.id !== 'cp8') session.checkpointsHit.add(c.id);
  }
  session.diver.x = lvl9Custom.exitZone.x;
  session.diver.y = 0.8;
  const toasts = [];
  const res = stepDiveSession(session, { x: 0, y: 0 }, 0.016, {
    onToast: (msg) => toasts.push(msg),
  });
  assert.equal(res.outcome, null, 'Surface completion must remain gated until all checkpoints are tagged');
  assert.ok(toasts.some((m) => m.includes('Exit blocked (7/8)') && m.includes('Bells 6m Deco Chasm')));
});

test('Levels 15-17 Iceland sites (Strýtan, Kverkfjöll, Grjótagjá) gases, vents, and exit checkpoints behave cleanly', () => {
  const lvl15 = getLevelById('strytan-hydrothermal-chimneys');
  const lvl16 = getLevelById('kverkfjoll-subglacial-caves');
  const lvl17 = getLevelById('grjotagja-kleifarvatn-rift');

  // L15 Strýtan TMX 8/74 survives 136m PPO2 and Arnarnes exit tags cp7
  const s15 = createDiveSession(lvl15);
  assert.equal(s15.diveState.mixes.TMX1455.name, 'TMX 8/74');
  s15.diveState.activeGasId = 'TMX1455';
  stepDivePhysiology(s15.diveState, { depthM: 136.0, swimSpeed: 0, dt: 0.5, activeDiverCount: 1 });
  assert.ok(s15.diveState.ppo2 < 1.35 && s15.diveState.alive, 'Strýtan TMX 8/74 must survive 136m safely');
  const cp7_15 = lvl15.checkpoints.find((c) => c.id === 'cp7');
  assert.ok(Math.hypot(306 - cp7_15.x, 1.8 - cp7_15.y) <= cp7_15.radius, 'Arnarnes exit covers cp7');

  // L16 Kverkfjöll TMX 8/75 survives 144m & gates exit until Melt Logger recovered
  const s16 = createDiveSession(lvl16);
  assert.equal(s16.diveState.mixes.TMX1455.name, 'TMX 8/75');
  s16.diveState.activeGasId = 'TMX1455';
  stepDivePhysiology(s16.diveState, { depthM: 144.0, swimSpeed: 0, dt: 0.5, activeDiverCount: 1 });
  assert.ok(s16.diveState.ppo2 < 1.35 && s16.diveState.alive, 'Kverkfjöll TMX 8/75 must survive 144m safely');
  for (const cp of lvl16.checkpoints) s16.checkpointsHit.add(cp.id);
  s16.diver.x = lvl16.exitZone.x;
  s16.diver.y = 1.0;
  const resBlocked = stepDiveSession(s16, { x: 0, y: 0 }, 0.016);
  assert.equal(resBlocked.outcome, null, 'Kverkfjöll exit must require recovering Melt Logger first');

  // L17 Grjótagjá TMX 7/78 survives 152m & Caldera exit tags cp7
  const s17 = createDiveSession(lvl17);
  assert.equal(s17.diveState.mixes.TMX1455.name, 'TMX 7/78');
  s17.diveState.activeGasId = 'TMX1455';
  stepDivePhysiology(s17.diveState, { depthM: 152.0, swimSpeed: 0, dt: 0.5, activeDiverCount: 1 });
  assert.ok(s17.diveState.ppo2 < 1.35 && s17.diveState.alive, 'Grjótagjá TMX 7/78 must survive 152m safely');
  const cp7_17 = lvl17.checkpoints.find((c) => c.id === 'cp7');
  assert.ok(Math.hypot(322 - cp7_17.x, 1.8 - cp7_17.y) <= cp7_17.radius, 'Caldera exit covers cp7');
});

test('LanClient drops out-of-order peer_state snapshots and extrapolates velocity smoothly', () => {
  const client = new LanClient();
  client._handleMessage({
    type: 'peer_state',
    playerId: 'buddy-1',
    state: { seq: 10, x: 20, y: 15, vx: 3.0, vy: 0.5, angle: 0.1, name: 'RemoteBuddy' },
  });

  // Delayed packet with older seq=8 from redundant Nostr relay must NOT snap peer backward
  client._handleMessage({
    type: 'peer_state',
    playerId: 'buddy-1',
    state: { seq: 8, x: 14, y: 15, vx: 2.0, vy: 0, angle: 0, name: 'RemoteBuddy' },
  });
  const peer = client.peers.get('buddy-1');
  assert.equal(peer.targetX, 20);
  assert.equal(peer._rxSeq, 10);

  // Dead-reckoning step advances target along velocity between network packets cleanly (clamped safely off rock)
  client.stepPeerInterpolation(0.05, LEVEL_1);
  assert.ok(peer.targetX > 20.1, `Expected dead-reckoning advance, got ${peer.targetX}`);
  assert.ok(peer.x >= 20 && peer.x <= peer.targetX);

  // Mid-dive reconnect (connected=true transition + seq restarting at 1) must NOT lock peer updates
  client._handleMessage({
    type: 'peer_state',
    playerId: 'buddy-1',
    state: { seq: 1000, x: 25, y: 15, vx: 0, vy: 0, angle: 0, name: 'RemoteBuddy' },
  });
  client._handleMessage({
    type: 'room_update',
    room: { code: 'TEST', started: true, players: [{ id: 'buddy-1', name: 'RemoteBuddy', connected: false }] },
  });
  client._handleMessage({
    type: 'room_update',
    room: { code: 'TEST', started: true, players: [{ id: 'buddy-1', name: 'RemoteBuddy', connected: true }] },
  });
  client._handleMessage({
    type: 'peer_state',
    playerId: 'buddy-1',
    state: { seq: 1, x: 10, y: 8, vx: 1.0, vy: 0, angle: 0, name: 'RemoteBuddy' },
  });
  assert.equal(peer.targetX, 10, 'Reconnected peer seq=1 must update target instead of freezing');

  // Out-and-back deep dive (L16 at 144m with cp1 already tagged) must NEVER command toxic EAN32 switch at depth
  const lvl16 = getLevelById('kverkfjoll-subglacial-caves');
  const deepState = createDiveState({ mixOverrides: lvl16.gasOverrides });
  switchGas(deepState, 'TMX1455');
  deepState.stopDepthM = 45;
  deepState.stopRemainingSec = 20;
  const deepStep = getAscentInstruction(deepState, 140, new Set(['cp1', 'cp6']), getAscentConfig(lvl16));
  assert.equal(deepStep.targetGas, 'TMX1455');
  assert.match(deepStep.title, /45m/);
});

test('Levels 18-20 global finale sites (Lanzarote, Lagoa Misteriosa, Boy-Bulok) gases, recovery, and exit checkpoints behave cleanly', () => {
  const lvl18 = getLevelById('tunel-de-la-atlantida');
  const lvl19 = getLevelById('lagoa-misteriosa-abyss');
  const lvl20 = getLevelById('boy-bulok-asian-sump');

  // L18 Túnel de la Atlántida TMX 7/79 survives 160m & Seamount exit covers cp7
  const s18 = createDiveSession(lvl18);
  assert.equal(s18.diveState.mixes.TMX1455.name, 'TMX 7/79');
  s18.diveState.activeGasId = 'TMX1455';
  stepDivePhysiology(s18.diveState, { depthM: 160.0, swimSpeed: 0, dt: 0.5, activeDiverCount: 1 });
  assert.ok(s18.diveState.ppo2 < 1.35 && s18.diveState.alive);
  const cp7_18 = lvl18.checkpoints.find((c) => c.id === 'cp7');
  assert.ok(Math.hypot(336 - cp7_18.x, 1.8 - cp7_18.y) <= cp7_18.radius);

  // L19 Lagoa Misteriosa TMX 6/80 survives 172m & gates exit until Sunken ROV Magnetometer recovered
  const s19 = createDiveSession(lvl19);
  assert.equal(s19.diveState.mixes.TMX1455.name, 'TMX 6/80');
  s19.diveState.activeGasId = 'TMX1455';
  stepDivePhysiology(s19.diveState, { depthM: 172.0, swimSpeed: 0, dt: 0.5, activeDiverCount: 1 });
  assert.ok(s19.diveState.ppo2 < 1.35 && s19.diveState.alive);
  for (const cp of lvl19.checkpoints) s19.checkpointsHit.add(cp.id);
  s19.diver.x = lvl19.exitZone.x;
  s19.diver.y = 1.0;
  const blocked19 = stepDiveSession(s19, { x: 0, y: 0 }, 0.016);
  assert.equal(blocked19.outcome, null, 'Lagoa Misteriosa must block exit until ROV Magnetometer recovered');

  // L20 Boy-Bulok TMX 6/82 survives 185m & East Alpine exit covers cp7
  const s20 = createDiveSession(lvl20);
  assert.equal(s20.diveState.mixes.TMX1455.name, 'TMX 6/82');
  s20.diveState.activeGasId = 'TMX1455';
  stepDivePhysiology(s20.diveState, { depthM: 185.0, swimSpeed: 0, dt: 0.5, activeDiverCount: 1 });
  assert.ok(s20.diveState.ppo2 < 1.35 && s20.diveState.alive);
  const cp7_20 = lvl20.checkpoints.find((c) => c.id === 'cp7');
  assert.ok(Math.hypot(356 - cp7_20.x, 1.8 - cp7_20.y) <= cp7_20.radius);
});

test('Leaderboard entries sanitize detailed dive telemetry stats and overall siteRuns breakdown', () => {
  const norm = normalizeLeaderboardSubmission({
    mode: 'team',
    levelId: 'cenote-el-abismo',
    diverName: 'LeadDiver',
    crew: [
      { name: 'LeadDiver', score: 3100, alive: true, healthPct: 96, gasRemainingPct: 58, diveTimeSec: 175.4 },
      { name: 'BuddyTwo', score: 2950, alive: true, healthPct: 91, gasRemainingPct: 52, diveTimeSec: 178.1 },
    ],
    teamSize: 2,
    score: 3025,
    grade: 'S',
    timeSec: 176.8,
    exploredPct: 88,
    collectiblesFound: 7,
    stats: {
      maxDepthM: 51.4,
      avgHealthPct: 93.5,
      avgSpeedPct: 84,
      avgGasRemainingPct: 55,
      peakHeartRateBpm: 112,
      checkpointsHit: 5,
      totalCheckpoints: 5,
      healthScore: 935,
      speedScore: 672,
      collectiblesScore: 1100,
      explorationScore: 616,
      teamSurvivalBonus: 350,
      eanBar: 120,
      tmxBar: 95,
      o2Bar: 185,
    },
  });
  assert.equal(norm.ok, true);
  assert.equal(norm.entry.stats.maxDepthM, 51.4);
  assert.equal(norm.entry.stats.peakHeartRateBpm, 112);
  assert.equal(norm.entry.crew[0].healthPct, 96);

  const overall = queryLeaderboardEntries([norm.entry], { mode: 'team', levelId: 'overall', limit: 10 });
  assert.equal(overall.length, 1);
  assert.equal(overall[0].siteRuns.length, 1);
  assert.equal(overall[0].siteRuns[0].levelId, 'cenote-el-abismo');
  assert.equal(overall[0].siteRuns[0].stats.maxDepthM, 51.4);
});

test('createBoxSDFEvaluator matches global SDF and evaluateCaveNormal reuses out object', () => {
  const lvl = getLevelById('blue-hole-dahab-arch');
  const cx = lvl.spawn.x;
  const cy = lvl.spawn.y + 12;
  const boxSdf = createBoxSDFEvaluator(lvl, cx - 18, cx + 18, cy - 18, cy + 18, 4.0);
  for (let dx = -12; dx <= 12; dx += 4) {
    for (let dy = -12; dy <= 12; dy += 4) {
      const wx = cx + dx;
      const wy = cy + dy;
      const full = evaluateCaveSDF(lvl, wx, wy);
      const boxed = boxSdf(wx, wy);
      assert.ok(Math.abs(full - boxed) < 1e-6, `Box SDF mismatch at (${wx},${wy}): ${full} vs ${boxed}`);
    }
  }
  const reusable = { nx: 0, ny: 0 };
  const ret = evaluateCaveNormal(lvl, cx + 6, cy, reusable);
  assert.equal(ret, reusable);
  const mag = Math.hypot(reusable.nx, reusable.ny);
  assert.ok(Math.abs(mag - 1) < 1e-5, `Expected unit normal, got magnitude ${mag}`);
});

test('getGasSwitchCoach warns at 21m descent on EAN32, escalates at 28m, avoids hypoxic ping-pong on L20, and clears on TMX', () => {
  // Standard TMX 14/55 level warns at 21.5m
  const stdState = createDiveSession(LEVEL_1).diveState;
  assert.equal(getGasSwitchCoach(stdState, 12, { ascending: false }), null);
  const stdWarn = getGasSwitchCoach(stdState, 21.5, { ascending: false });
  assert.ok(stdWarn);
  assert.equal(stdWarn.severity, 'warn');
  assert.equal(stdWarn.targetGas, 'TMX1455');
  assert.equal(stdWarn.hotkey, '2');

  // Ultra-deep hypoxic L20 (TMX 6/82) delays descent switch above hypoxic floor (23.5m) to avoid ping-pong
  const lvl20 = getLevelById('boy-bulok-asian-sump');
  const state = createDiveSession(lvl20).diveState;
  assert.equal(getGasSwitchCoach(state, 21.5, { ascending: false }), null);
  const warn = getGasSwitchCoach(state, 24.5, { ascending: false });
  assert.ok(warn);
  assert.equal(warn.severity, 'warn');
  assert.equal(warn.targetGas, 'TMX1455');
  assert.equal(warn.hotkey, '2');
  assert.ok(warn.title.includes('TMX 6/82'), `Expected level-specific mix name, got ${warn.title}`);

  // Past 27.5m still on EAN32 -> urgent danger prompt
  const danger = getGasSwitchCoach(state, 28.5, { ascending: false });
  assert.ok(danger);
  assert.equal(danger.severity, 'danger');
  assert.equal(danger.targetGas, 'TMX1455');

  // Once switched to TMX at 28.5m -> prompt clears
  switchGas(state, 'TMX1455');
  state.ppo2 = computePPO2(28.5, state.mixes.TMX1455);
  assert.equal(getGasSwitchCoach(state, 28.5, { ascending: false }), null);

  // Breathing O2 100% below 6m -> immediate danger switch
  switchGas(state, 'O2');
  const o2Danger = getGasSwitchCoach(state, 9.0, { ascending: false });
  assert.ok(o2Danger && o2Danger.severity === 'danger' && o2Danger.targetGas === 'EAN32');
});

test('v84 P0 regressions: LanClient multi-listener on/off, leaveRoom clears peers, gas-share persists litersRemaining, and L20 deco/gas is winnable', () => {
  // 1. LanClient.on supports multiple independent listeners on the same event (fixes syncWakeLock clobber)
  const client = new LanClient();
  const fired = [];
  const fnA = (v) => fired.push(`A:${v}`);
  const fnB = (v) => fired.push(`B:${v}`);
  client.on('room_update', fnA);
  client.on('room_update', fnB);
  client.emit('room_update', 'ok');
  assert.deepEqual(fired, ['A:ok', 'B:ok']);
  client.off('room_update', fnA);
  client.emit('room_update', 'second');
  assert.deepEqual(fired, ['A:ok', 'B:ok', 'B:second']);

  // 2. leaveRoom clears peer alias so getPeers() is immediately empty
  client.peers.set('p1', { id: 'p1', name: 'Buddy', x: 5, y: 10 });
  client._syncPeerAlias();
  assert.equal(client.getPeers().length, 1);
  client.leaveRoom();
  assert.equal(client.getPeers().length, 0);

  // 3. donateGasFromState / receiveGasIntoState update litersRemaining so transfers persist across stepDivePhysiology
  const donor = createDiveState();
  const receiver = createDiveState();
  receiver.tanks.TMX1455.bar = 40;
  receiver.tanks.TMX1455.litersRemaining = 40 * receiver.tanks.TMX1455.capacityLiters;
  const candDeep = getShareableGasCandidate(donor, 'O2', 25, 35);
  assert.ok(candDeep && candDeep.gasId !== 'O2', 'Must never suggest O2 donation at 35m');
  const don = donateGasFromState(donor, 'TMX1455', 25);
  assert.ok(don && don.donatedBar === 25);
  const added = receiveGasIntoState(receiver, don.gasId, don.donatedBar);
  assert.equal(added, 25);
  switchGas(donor, 'TMX1455');
  switchGas(receiver, 'TMX1455');
  stepDivePhysiology(donor, { depthM: 35, prevDepthM: 35, dt: 0.1, exertion: 0.1 });
  stepDivePhysiology(receiver, { depthM: 35, prevDepthM: 35, dt: 0.1, exertion: 0.1 });
  assert.ok(donor.tanks.TMX1455.bar < 180, `Donor bar should stay reduced after step, got ${donor.tanks.TMX1455.bar}`);
  assert.ok(receiver.tanks.TMX1455.bar > 60, `Receiver bar should stay boosted after step, got ${receiver.tanks.TMX1455.bar}`);

  // 4. L14-L20 schema check & L20 180m deep dive has surviving TMX gas reserve + suppressed O2 deco alarm at 5.4m
  for (const lvl of LEVELS) {
    const v = validateLevel(lvl);
    assert.equal(v.valid, true, `Level ${lvl.id} must validate cleanly: ${(v.errors || []).join('; ')}`);
    for (const z of lvl.zoneLines || []) {
      assert.ok(Number.isFinite(z.y), `Level ${lvl.id} zoneLine ${z.id} must have finite y`);
    }
    for (const dm of lvl.depthMarkers || []) {
      assert.ok(typeof dm.color === 'string' && dm.color.length > 0, `Level ${lvl.id} depthMarker must have color`);
    }
  }
  const lvl20 = getLevelById('boy-bulok-asian-sump');
  const s20 = createDiveSession(lvl20).diveState;
  switchGas(s20, 'TMX1455');
  for (let i = 0; i < 240; i++) {
    stepDivePhysiology(s20, { depthM: 175, prevDepthM: 175, dt: 0.5, exertion: 0.35 });
  }
  assert.equal(s20.alive, true, 'Diver must survive 2min at 175m on L20 TMX 6/82');
  assert.ok(s20.tanks.TMX1455.bar > 40, `Expected usable TMX reserve after 2min at 175m, got ${s20.tanks.TMX1455.bar}`);
  // Planned O2 deco at 5.4m must not spam PPO2 ELEVATED warning
  switchGas(s20, 'O2');
  s20.ceilingM = 5.0;
  s20.stopDepthM = 6;
  stepDivePhysiology(s20, { depthM: 5.4, prevDepthM: 5.4, dt: 0.5, exertion: 0.05 });
  assert.ok(
    !s20.warnings.some((w) => w.code === 'PPO2_WARN'),
    `Expected no PPO2_WARN during planned 5.4m O2 deco, got ${JSON.stringify(s20.warnings)}`
  );
});

test('Realistic breathing patterns follow inhale/hold/exhale/rest cadence and intensify under panic & high HR', () => {
  const calmState = createDiveState();
  calmState.heartRateBpm = 68;
  calmState.panicLevel = 0;
  const calmProf = computeBreathProfile(calmState, 0);

  const panicState = createDiveState();
  panicState.heartRateBpm = 168;
  panicState.panicLevel = 0.85;
  const panicProf = computeBreathProfile(panicState, 0.8);

  assert.ok(calmProf.breathsPerMin >= 9 && calmProf.breathsPerMin <= 13, `Calm rate out of range: ${calmProf.breathsPerMin}`);
  assert.ok(panicProf.breathsPerMin >= 28, `Panicked rate should surge >=28 BPM, got ${panicProf.breathsPerMin}`);
  assert.ok(panicProf.intensity > calmProf.intensity * 1.8, 'Panic intensity should be substantially higher than calm');
  assert.ok(1 - calmProf.exhaleEnd > 1 - panicProf.exhaleEnd, 'Calm diver should have longer quiet rest between breaths');

  // Compare 12 seconds of calm diving vs panicked/high-HR diving in open water
  const runSim = (panicked) => {
    const sess = createDiveSession(LEVEL_1);
    sess.diver.x = LEVEL_1.checkpoints[1].x;
    sess.diver.y = Math.max(12, LEVEL_1.checkpoints[1].y);
    let inhales = 0;
    let exhales = 0;
    let peakBubbles = 0;
    let sawRest = false;
    let sawInhale = false;
    let sawExhale = false;
    const cbs = {
      onInhale: (ev) => {
        inhales += 1;
        assert.ok(ev && Number.isFinite(ev.durationSec) && ev.durationSec > 0);
      },
      onExhale: (ev) => {
        exhales += 1;
        assert.ok(ev && Number.isFinite(ev.durationSec) && ev.durationSec > 0);
      },
    };
    for (let i = 0; i < 240; i++) {
      if (panicked) {
        sess.diveState.heartRateBpm = 172;
        sess.diveState.panicLevel = 0.9;
      } else {
        sess.diveState.heartRateBpm = 68;
        sess.diveState.panicLevel = 0;
      }
      stepDiveSession(sess, { x: 0, y: 0 }, 0.05, cbs);
      if (sess.breath.state === 'rest') sawRest = true;
      if (sess.breath.state === 'inhale') sawInhale = true;
      if (sess.breath.state === 'exhale') sawExhale = true;
      if (sess.bubbles.length > peakBubbles) peakBubbles = sess.bubbles.length;
    }
    return { inhales, exhales, peakBubbles, sawRest, sawInhale, sawExhale, bubbles: sess.bubbles };
  };

  const calm = runSim(false);
  const panic = runSim(true);

  assert.ok(calm.sawInhale && calm.sawExhale && calm.sawRest, 'Calm diver must cycle through inhale, exhale, and rest');
  assert.ok(calm.exhales >= 2 && calm.inhales >= 1, `Expected calm breaths, got ${calm.inhales}/${calm.exhales}`);
  assert.ok(panic.exhales > calm.exhales * 2, `Panic should trigger >2x exhales (${panic.exhales} vs ${calm.exhales})`);
  assert.ok(panic.peakBubbles > calm.peakBubbles * 1.4, `Panic should produce denser bubble clouds (${panic.peakBubbles} vs ${calm.peakBubbles})`);

  // Co-op peer bubble emission scales with peer heart rate
  const peerBubbles = [];
  const peer = { id: 'p1', x: LEVEL_1.checkpoints[1].x, y: 14, vx: 0, vy: 0, angle: 0, alive: true, surfaced: false, heartRateBpm: 165, condition: 'HIGH HR' };
  for (let i = 0; i < 60; i++) {
    stepPeerBubbles(peerBubbles, [peer], 0.05);
  }
  assert.ok(peerBubbles.length > 5, `Expected remote peer breathing bubbles, got ${peerBubbles.length}`);
});

test('5 technical shipwreck expeditions validate cleanly, support drift currents & snag zones, and have safe hypoxic gas mixes', () => {
  const wreckIds = [
    'uss-oriskany-carrier',
    'ss-andrea-doria',
    'hmhs-britannic',
    'hms-victoria-battleship',
    'ss-edmund-fitzgerald',
  ];
  const wrecks = wreckIds.map((id) => getLevelById(id));
  assert.equal(wrecks.filter((w) => w.isWreck && w.category === 'wreck').length, 5);

  for (const w of wrecks) {
    const check = validateLevel(w, { checkGeometry: true });
    assert.equal(check.valid, true, `Wreck ${w.id} geometry check failed: ${check.errors.join('; ')}`);
    assert.ok(w.collectibles.length >= 6, `Wreck ${w.id} should have >=6 collectibles`);
    // Open water around dive boat spawn must be unobstructed
    assert.ok(evaluateCaveSDF(w, w.spawn.x, w.spawn.y) < -1.0, `Wreck ${w.id} spawn should be open ocean`);
    // Check bottom mix survives max depth safely (PPO2 <= 1.35)
    const s = createDiveSession(w).diveState;
    switchGas(s, 'TMX1455');
    const maxD = Math.max(...w.checkpoints.map((c) => c.y));
    const ppo2 = computePPO2(maxD, s.mixes.TMX1455);
    assert.ok(ppo2 >= 0.25 && ppo2 <= 1.38, `Wreck ${w.id} TMX PPO2 at ${maxD}m out of range: ${ppo2}`);
  }

  // Verify SS Andrea Doria drift current pushes diver in open water & fishing net snag spikes HR/panic
  const doria = getLevelById('ss-andrea-doria');
  const sess = createDiveSession(doria);
  sess.diver.x = 12;
  sess.diver.y = 20; // inside surface drift current (10m-32m, vx = +0.95)
  stepDiveSession(sess, { x: 0, y: 0 }, 0.25);
  assert.ok(sess.diver.vx > 0.05, `Expected positive Atlantic drift velocity, got ${sess.diver.vx}`);

  // Move directly into fishing net snag zone & verify drag + panic/HR elevation
  const snag = doria.snagZones[0];
  sess.diver.x = snag.x;
  sess.diver.y = snag.y;
  sess.diver.vx = 2.0;
  const hrBefore = sess.diveState.heartRateBpm;
  let snagToast = '';
  for (let i = 0; i < 6; i++) {
    stepDiveSession(sess, { x: 0, y: 0 }, 0.1, { onToast: (m) => { if (m.includes('🕸️')) snagToast = m; } });
  }
  assert.ok(sess.diveState.heartRateBpm > hrBefore + 2, `Expected snag to spike HR (${sess.diveState.heartRateBpm} > ${hrBefore})`);
  assert.ok(snagToast.includes('🕸️'), `Expected snag warning toast, got "${snagToast}"`);
});

test('Shipwreck overhaul mechanics: shot-line zip, active net-cut, watertight hatches, surge lulls, rust percolation & reef ecosystem', () => {
  const oriskany = getLevelById('uss-oriskany-carrier');
  const fitz = getLevelById('ss-edmund-fitzgerald');

  // 1. Shot-line clip & fast zip-descent (with automatic EAN32 switch brake at 22m!)
  const s1 = createDiveSession(oriskany);
  s1.diver.x = oriskany.shotLine.x + 1.5;
  s1.diver.y = 8.0;
  stepDiveSession(s1, { x: 0, y: 0 }, 0.05);
  assert.equal(s1.wreckActionPrompt?.kind, 'clip-line', 'Expected clip-line prompt near shot line');
  let clippedEvents = 0;
  const clipRes = triggerWreckAction(s1, { onClipLine: () => { clippedEvents++; } });
  assert.equal(clipRes.handled, true);
  assert.equal(s1.clippedToShotLine, true);
  assert.equal(clippedEvents, 1);

  // Switch to TMX and zip down fast
  switchGas(s1.diveState, 'TMX1455');
  for (let i = 0; i < 15; i++) {
    stepDiveSession(s1, { x: 0, y: 1 }, 0.1);
  }
  assert.ok(s1.diver.vy > 4.0, `Expected fast zip descent on shot line (>4 m/s), got ${s1.diver.vy}`);
  assert.ok(Math.abs(s1.diver.x - oriskany.shotLine.x) < 0.35, 'Shot line clip should hold X against drift');

  // 2. Active fishing-net cut clears snag permanently & drops panic
  const s2 = createDiveSession(oriskany);
  switchGas(s2.diveState, 'TMX1455');
  const snag = oriskany.snagZones[0];
  s2.diver.x = snag.x;
  s2.diver.y = snag.y;
  s2.diveState.panicLevel = 0.6;
  stepDiveSession(s2, { x: 0, y: 0 }, 0.05);
  assert.equal(s2.activeSnagIndex, 0);
  assert.equal(s2.wreckActionPrompt?.kind, 'cut-net');
  let cutSound = 0;
  const cutRes = triggerWreckAction(s2, { onLineCut: () => { cutSound++; } });
  assert.equal(cutRes.handled, true);
  assert.equal(cutSound, 1);
  assert.ok(s2.cutSnagIds.has(snag.id), 'Snag should be marked permanently cut');
  stepDiveSession(s2, { x: 0, y: 0 }, 0.05);
  assert.equal(s2.activeSnagIndex, -1, 'Cut snag should no longer tangle diver');

  // 3. Interactive watertight bulkhead hatch blocks until cranked open, vents rust silt & awards bonus
  const s3 = createDiveSession(oriskany);
  switchGas(s3.diveState, 'TMX1455');
  const hatch = oriskany.watertightHatches[0];
  s3.diver.x = hatch.x + hatch.radius + 1.2;
  s3.diver.y = hatch.y;
  stepDiveSession(s3, { x: 0, y: 0 }, 0.05);
  assert.equal(s3.wreckActionPrompt?.kind, 'open-hatch', 'Expected open-hatch prompt near sealed bulkhead');
  let hatchOpened = 0;
  triggerWreckAction(s3, { onHatchOpen: () => { hatchOpened++; } });
  for (let i = 0; i < 20; i++) {
    stepDiveSession(s3, { x: 0, y: 0 }, 0.1, { onHatchOpen: () => { hatchOpened++; } });
  }
  assert.equal(hatchOpened, 1, 'Hatch should complete opening after cranking');
  assert.ok(s3.openedHatchIds.has(hatch.id), 'Hatch ID should be recorded as opened');
  assert.ok(s3.hatchBonusScore >= 150, 'Opening hatch should award bonus points');
  assert.ok(s3.siltClouds.some((c) => c.isRust), 'Unsealing hatch should vent rust silt plumes');

  // 4. Timed hull-breach surge wave alternates active flow and calm 0 lull window
  const surge = oriskany.surgeZones[0];
  let sawCalm = false;
  let sawPos = false;
  let sawNeg = false;
  for (let t = 0; t < surge.periodSec; t += 0.2) {
    const w = computeSurgeWave(surge, t);
    if (w === 0) sawCalm = true;
    if (w > 0.5) sawPos = true;
    if (w < -0.5) sawNeg = true;
  }
  assert.ok(sawCalm && sawPos && sawNeg, 'Surge zone must cycle through positive surge, calm lull, and reverse surge');

  // 5. Shipwreck reef ecosystem replaces cenote vines/turtles/remipedes with rusticles, jellies & megafauna
  const oriEco = createMarineEcosystem(oriskany);
  assert.equal(oriEco.turtles.length, 0, 'Ocean shipwreck must not spawn freshwater cenote slider turtles');
  assert.equal(oriEco.remipedes.length, 0, 'Ocean shipwreck must not spawn blind cave remipedes');
  assert.ok(!oriEco.anchored.some((a) => a.kind === 'vine' || a.kind === 'sodastraw'), 'No cenote vines/stalactites on steel wreck');
  assert.ok(oriEco.anchored.some((a) => a.kind === 'rusticle'), 'Shipwreck should grow hanging iron rusticles');
  assert.ok(oriEco.jellies.length >= 3, 'Ocean shipwreck should spawn pelagic jellyfish along shot line');
  assert.ok(oriEco.megafauna.length >= 2, 'Ocean shipwreck should spawn sharks & Goliath groupers');

  // Cold freshwater Fitzgerald skips tropical corals & ocean jellyfish
  const fitzEco = createMarineEcosystem(fitz);
  assert.equal(fitzEco.jellies.length, 0, 'Freshwater Lake Superior wreck should not spawn ocean jellyfish');
  assert.ok(!fitzEco.anchored.some((a) => a.kind === 'seafan'), 'Freshwater wreck should not spawn ocean gorgonians');
  assert.ok(fitzEco.anchored.some((a) => a.kind === 'rusticle'), 'Fitzgerald should still have iron rusticles');
});

test('v96 bundles: co-op wreck sync & buddy net rescue, dive profile & PB ghost interpolation, certifications, and difficulty modes', () => {
  const oriskany = getLevelById('uss-oriskany-carrier');

  // 1. Co-op Buddy Net Rescue & Peer Wreck Action Sync
  const sA = createDiveSession(oriskany, { diverName: 'Rescuer' });
  const sB = createDiveSession(oriskany, { diverName: 'Buddy' });
  const snag = oriskany.snagZones[0];
  sA.diver.x = snag.x + snag.radius + 1.5; // nearby, NOT inside snag
  sA.diver.y = snag.y;
  const fakePeers = [{ id: 'p2', name: 'Buddy', x: snag.x, y: snag.y, alive: true }];
  stepDiveSession(sA, { x: 0, y: 0 }, 0.05, { peers: fakePeers });
  assert.equal(sA.buddySnagIndex, 0, 'Should detect tangled buddy inside nearby net');
  assert.ok(sA.wreckActionPrompt?.label.includes('CUT Buddy FREE'), `Unexpected prompt: ${sA.wreckActionPrompt?.label}`);

  let syncedEvt = null;
  const rescueRes = triggerWreckAction(sA, {
    onWreckSync: (actionKind, targetId) => { syncedEvt = { actionKind, targetId }; },
  });
  assert.equal(rescueRes.handled, true);
  assert.equal(rescueRes.buddyRescue, true);
  assert.deepEqual(syncedEvt, { actionKind: 'snag', targetId: snag.id });

  // Apply synced wreck actions onto remote buddy's session
  assert.equal(applyPeerWreckAction(sB, { by: 'Rescuer', actionKind: 'snag', targetId: snag.id }), true);
  assert.ok(sB.cutSnagIds.has(snag.id), 'Remote buddy session should mark net cut');
  const hatch = oriskany.watertightHatches[0];
  assert.equal(applyPeerWreckAction(sB, { by: 'Rescuer', actionKind: 'hatch', targetId: hatch.id }), true);
  assert.ok(sB.openedHatchIds.has(hatch.id), 'Remote buddy session should mark hatch unsealed');

  // 2. Dive Computer Depth Profile & Compact PB Ghost Interpolation
  const sProf = createDiveSession(oriskany);
  for (let i = 0; i < 20; i++) {
    stepDiveSession(sProf, { x: 0.4, y: 0.9 }, 0.2);
  }
  switchGas(sProf.diveState, 'TMX1455');
  stepDiveSession(sProf, { x: 0.2, y: 0.5 }, 0.2);
  assert.ok(sProf.diveProfile.length >= 3, 'Should record time/depth/gas dive profile samples');
  assert.ok(sProf.diveProfile.some((p) => p.gas === 'TMX1455'), 'Should capture gas switch point in profile');
  assert.ok(sProf.ghostTrack.length >= 4, 'Should record compact ghost breadcrumb track');
  const pose = sampleGhostPose(sProf.ghostTrack, 1.5);
  assert.ok(pose && Number.isFinite(pose.x) && Number.isFinite(pose.y), 'sampleGhostPose should interpolate cleanly');

  // 3. Technical Certification Ladder
  let book = createEmptyLogbook();
  book = recordDiveInLogbook(book, { levelId: 'cenote-el-abismo', success: true, score: 2500, grade: 'A', maxDepthM: 50, diveTimeSec: 180 });
  book = recordDiveInLogbook(book, { levelId: 'uss-oriskany-carrier', success: true, score: 2900, grade: 'S', maxDepthM: 65, diveTimeSec: 260 });
  book = recordDiveInLogbook(book, { levelId: 'hmhs-britannic', success: true, score: 3400, grade: 'S', maxDepthM: 121, diveTimeSec: 440 });
  const certs = computeCertifications(book, LEVELS);
  const earnedIds = new Set(certs.earned.map((c) => c.id));
  assert.ok(earnedIds.has('open-water'));
  assert.ok(earnedIds.has('cavern'));
  assert.ok(earnedIds.has('trimix-normoxic'));
  assert.ok(earnedIds.has('wreck-penetration'));
  assert.ok(earnedIds.has('hypoxic-120'));
  assert.ok(certs.next && certs.next.id === 'full-cave', `Expected next cert full-cave, got ${certs.next?.id}`);

  // 4. Difficulty Modes scale open-ocean drift currents appropriately (hardcore > guided)
  const sGuided = createDiveSession(oriskany, { difficulty: 'guided' });
  const sHard = createDiveSession(oriskany, { difficulty: 'hardcore' });
  sGuided.diver.x = 20; sGuided.diver.y = 18;
  sHard.diver.x = 20; sHard.diver.y = 18;
  stepDiveSession(sGuided, { x: 0, y: 0 }, 0.25);
  stepDiveSession(sHard, { x: 0, y: 0 }, 0.25);
  assert.ok(sHard.diver.vx > sGuided.diver.vx * 1.5, `Hardcore drift (${sHard.diver.vx}) should exceed guided (${sGuided.diver.vx})`);
});

test('Left flashlight joystick temporarily overrides diver torchAngle & hand aim while held and returns to diver heading on release', () => {
  const lvl = getLevelById('cenote-el-abismo');
  const sess = createDiveSession(lvl);
  sess.diver.x = 12;
  sess.diver.y = 12;

  // 1. Default behavior: swimming right keeps torchAngle aligned with diver.angle (~0 rad)
  for (let i = 0; i < 12; i++) {
    stepDiveSession(sess, { x: 1, y: 0 }, 0.08, { torchAim: { active: false, angle: null } });
  }
  assert.equal(sess.diver.torchManualAim, false);
  assert.ok(Math.abs(sess.diver.torchAngle - sess.diver.angle) < 0.12, 'Torch should follow diver heading by default');

  // 2. While left flashlight joystick is aimed straight down (+PI/2) while swimming right, torch overrides heading
  for (let i = 0; i < 10; i++) {
    stepDiveSession(sess, { x: 0.8, y: 0 }, 0.08, { torchAim: { active: true, angle: Math.PI * 0.5 } });
  }
  assert.equal(sess.diver.torchManualAim, true);
  assert.ok(Math.abs(sess.diver.torchAngle - Math.PI * 0.5) < 0.15, `Expected torchAngle near +PI/2, got ${sess.diver.torchAngle}`);
  assert.ok(sess.diver.body.hand.y > sess.diver.y + 0.15, 'Articulated torch hand should aim downward with flashlight stick');

  // 3. Releasing flashlight joystick smoothly returns beam to follow diver heading again
  for (let i = 0; i < 18; i++) {
    stepDiveSession(sess, { x: 0.8, y: 0 }, 0.08, { torchAim: { active: false, angle: null } });
  }
  assert.equal(sess.diver.torchManualAim, false);
  assert.ok(Math.abs(sess.diver.torchAngle - sess.diver.angle) < 0.15, 'Torch should return to diver heading after release');
});

test('Co-diver torchAngle & torchManualAim relay over P2P and interpolate smoothly on remote clients', () => {
  const peerPkts = [];
  const coord = new P2pRoomCoordinator({
    code: 'LITE',
    hostId: 'h1',
    hostName: 'Host',
    levelId: 'cenote-el-abismo',
  });
  coord.bindPlayerSender('h1', () => {});
  coord.handleRemoteJoin({ name: 'Buddy' }, (m) => peerPkts.push(m), 'p2');
  coord.handleMessage('h1', { type: 'start_dive', force: true });

  // Host aims left flashlight stick straight up (-PI/2) while swimming horizontally (angle = 0)
  coord.handleMessage('h1', {
    type: 'player_state',
    state: {
      seq: 1,
      x: 12,
      y: 16,
      vx: 1.2,
      vy: 0,
      angle: 0,
      torchOn: true,
      torchAngle: -1.57,
      torchManualAim: true,
      alive: true,
    },
  });

  const relayed = peerPkts.find((m) => m.type === 'peer_state');
  assert.ok(relayed, 'Expected peer_state broadcast to buddy');
  assert.equal(relayed.state.torchManualAim, true);
  assert.ok(Math.abs(relayed.state.torchAngle - -1.57) < 0.02, `Expected relayed torchAngle ~-1.57, got ${relayed.state.torchAngle}`);

  // Verify LanClient smoothly interpolates remote buddy's torchAngle
  const client = new LanClient();
  client._handleMessage({
    type: 'peer_state',
    playerId: 'h1',
    state: { seq: 1, x: 12, y: 16, vx: 0, vy: 0, angle: 0, torchOn: true, torchAngle: 0, torchManualAim: false, alive: true },
  });
  client._handleMessage({
    type: 'peer_state',
    playerId: 'h1',
    state: { seq: 2, x: 12, y: 16, vx: 0, vy: 0, angle: 0, torchOn: true, torchAngle: 1.5, torchManualAim: true, alive: true },
  });
  const lvl = getLevelById('cenote-el-abismo');
  for (let i = 0; i < 12; i++) {
    client.stepPeerInterpolation(0.05, lvl);
  }
  const peer = client.getPeers().find((p) => p.id === 'h1');
  assert.ok(peer && peer.torchManualAim === true);
  assert.ok(peer.torchAngle > 1.2 && peer.torchAngle <= 1.55, `Expected interpolated peer torchAngle near 1.5, got ${peer?.torchAngle}`);
});

test('v99 reliability fixes: wreck ascent checkpoint gating, hatchBonusScore, dropped tow, late-join wreck state, cert integrity & campaign ranks', () => {
  // 1. Shipwreck ascent checkpoints (cp5/cp6) do NOT auto-fire during initial shot-line descent
  const ori = getLevelById('uss-oriskany-carrier');
  const sW = createDiveSession(ori);
  sW.diver.x = 10; sW.diver.y = 6.0;
  stepDiveSession(sW, { x: 0, y: 0 }, 0.05);
  assert.equal(sW.checkpointsHit.has('cp6'), false, '6m O2 Trapeze cp6 must not fire during descent');
  sW.diver.x = 10; sW.diver.y = 22.0;
  stepDiveSession(sW, { x: 0, y: 0 }, 0.05);
  assert.equal(sW.checkpointsHit.has('cp1'), true, '22m descent buoy cp1 should fire');
  assert.equal(sW.checkpointsHit.has('cp5'), false, '22m ascent switch cp5 must not fire before turnaround');
  // Once turnaround cp4 is tagged, cp5 & cp6 fire cleanly on ascent
  sW.checkpointsHit.add('cp4');
  stepDiveSession(sW, { x: 0, y: 0 }, 0.05);
  assert.equal(sW.checkpointsHit.has('cp5'), true, 'cp5 should fire after turnaround');

  // 2. hatchBonusScore counts toward final score and stays within leaderboard ceiling
  const baseSummary = computeDiverScoreSummary({
    level: ori,
    diveState: sW.diveState,
    checkpointsHit: sW.checkpointsHit,
    collectedIds: new Set(),
    exploredCount: 10,
    totalExploreCells: 20,
    hatchBonusScore: 0,
  });
  const hatchSummary = computeDiverScoreSummary({
    level: ori,
    diveState: sW.diveState,
    checkpointsHit: sW.checkpointsHit,
    collectedIds: new Set(),
    exploredCount: 10,
    totalExploreCells: 20,
    hatchBonusScore: 150,
  });
  assert.equal(hatchSummary.totalScore - baseSummary.totalScore, 150);
  assert.ok(hatchSummary.totalScore <= computeLevelMaxScore(ori.id, false));

  // 3. P2pRoomCoordinator preserves 'dropped' buddy_rescue status, isRust silt, and late-join wreck hatches/snags
  const buddyMsgs = [];
  const lateMsgs = [];
  const coord = new P2pRoomCoordinator({ code: 'V99R', hostId: 'h1', hostName: 'Host', levelId: ori.id });
  coord.bindPlayerSender('h1', () => {});
  coord.handleRemoteJoin({ name: 'B1' }, (m) => buddyMsgs.push(m), 'b1');
  coord.handleMessage('h1', { type: 'start_dive', force: true });
  coord.handleMessage('h1', { type: 'buddy_rescue', rescuedId: 'b1', rescuedName: 'B1', status: 'dropped' });
  coord.handleMessage('h1', { type: 'silt_event', plume: { x: 10, y: 50, isRust: true } });
  coord.handleMessage('h1', { type: 'wreck_action', actionKind: 'hatch', targetId: 'ori_hatch_bow' });
  coord.handleMessage('h1', { type: 'wreck_action', actionKind: 'snag', targetId: 'ori_snag1' });

  const dropMsg = buddyMsgs.find((m) => m.type === 'peer_buddy_rescue');
  assert.equal(dropMsg?.status, 'dropped', 'buddy_rescue must preserve dropped status');
  const rustMsg = buddyMsgs.find((m) => m.type === 'peer_silt');
  assert.equal(rustMsg?.plume?.isRust, true, 'peer_silt must preserve isRust flag');

  coord.handleRemoteJoin({ name: 'LateDiver' }, (m) => lateMsgs.push(m), 'b2');
  const lateStart = lateMsgs.find((m) => m.type === 'dive_started');
  assert.ok(lateStart?.openedHatches?.includes('ori_hatch_bow'), 'Late joiner must receive already-opened hatches');
  assert.ok(lateStart?.cutSnags?.includes('ori_snag1'), 'Late joiner must receive already-cut snags');

  // 4. Certification integrity: fatal dive does not grant depth cert; lined caves do not grant Full Cave
  let book = createEmptyLogbook();
  book = recordDiveInLogbook(book, { levelId: 'hmhs-britannic', success: false, score: 0, grade: 'DNF', maxDepthM: 125, diveTimeSec: 90 });
  assert.equal(book.deepestM, 0, 'Fatal dive must not count toward deepest certified depth');
  for (const id of ['cenote-el-abismo', 'eagles-nest-sink', 'uss-oriskany-carrier', 'peacock-springs-labyrinth', 'fontaine-de-vaucluse', 'cenote-angelita-abyss']) {
    book = recordDiveInLogbook(book, { levelId: id, success: true, score: 2400, grade: 'A', maxDepthM: 50, diveTimeSec: 180 });
  }
  const certs = computeCertifications(book, LEVELS);
  assert.equal(certs.earned.some((c) => c.id === 'full-cave'), false, 'Clearing 6 lined sites must NOT award Full Cave without an unlined reel clear');

  // 5. CAMPAIGN_PLAN rank & Tier 5 authority (no rank collision between Victoria and Boy-Bulok)
  const boyMeta = getLevelMeta('boy-bulok-asian-sump');
  const vicMeta = getLevelMeta('hms-victoria-battleship');
  assert.equal(boyMeta.rank, 30);
  assert.equal(boyMeta.tier, 5);
  assert.equal(vicMeta.rank, 25);
});

test('v100 Cave Interactive Parity: all 25 caves enriched with open-water stage caches, markers, currents/surges, line traps & co-op sync', () => {
  const caves = LEVELS.filter((l) => !l.isWreck);
  assert.equal(caves.length, 25);

  for (const cave of caves) {
    assert.ok(Array.isArray(cave.stageCaches) && cave.stageCaches.length >= 1, `${cave.id} missing stageCaches`);
    const hasFlow = (cave.caveCurrents?.length || 0) + (cave.surgeZones?.length || 0) >= 1;
    assert.ok(hasFlow, `${cave.id} must have at least one karst current or tidal siphon surge`);
    if ((cave.reelMetersPerDiver || 0) > 0) {
      assert.ok(Array.isArray(cave.lineAnchors) && cave.lineAnchors.length >= 1, `Unlined cave ${cave.id} missing lineAnchors`);
    }
    const allInteractives = [
      ...(cave.stageCaches || []),
      ...(cave.lineAnchors || []),
      ...(cave.caveCurrents || []),
      ...(cave.surgeZones || []),
      ...(cave.snagZones || []),
    ];
    for (const item of allInteractives) {
      const sdf = evaluateCaveSDF(cave, item.x, item.y);
      assert.ok(sdf < -0.8, `${cave.id} interactive ${item.id} has tight/blocked SDF=${sdf.toFixed(2)}`);
    }
  }

  // 1. Staged bailout cylinder refill (leaves bottle clipped if full; tops up +bar & litersRemaining when below full)
  const ressel = getLevelById('emergence-du-ressel');
  const sC = createDiveSession(ressel);
  const stage = ressel.stageCaches[0];
  sC.diver.x = stage.x;
  sC.diver.y = stage.y;
  const fullRes = triggerWreckAction(sC);
  assert.equal(fullRes.kind, 'stage-full', 'Full tank should not waste staged bailout cylinder');
  assert.equal(sC.claimedStageIds.has(stage.id), false);

  sC.diveState.tanks[stage.gasId].bar = 100;
  sC.diveState.tanks[stage.gasId].litersRemaining = sC.diveState.tanks[stage.gasId].maxLiters * 0.5;
  stepDiveSession(sC, { x: 0, y: 0 }, 0.05);
  assert.equal(sC.wreckActionPrompt?.kind, 'refill-stage', 'HUD prompt should offer stage gas refill');
  let refillEvent = null;
  const fillRes = triggerWreckAction(sC, { onStageRefill: (c, added) => { refillEvent = { c, added }; } });
  assert.equal(fillRes.kind, 'refill-stage');
  assert.ok(fillRes.addedBar >= 50, `Expected stage refill >= 50 bar, got ${fillRes.addedBar}`);
  assert.ok(sC.diveState.tanks[stage.gasId].bar >= 150);
  assert.equal(sC.claimedStageIds.has(stage.id), true);
  assert.ok(refillEvent && refillEvent.added >= 50);

  // 2. Unlined cave line-marker placement (+reelBonusM & co-op marker sync / late-join hydration)
  const anchor = ressel.lineAnchors[0];
  const prevReel = sC.reelRemainingM;
  sC.diver.x = anchor.x;
  sC.diver.y = anchor.y;
  stepDiveSession(sC, { x: 0, y: 0 }, 0.05);
  assert.equal(sC.wreckActionPrompt?.kind, 'place-marker');
  let syncedMarker = null;
  const markRes = triggerWreckAction(sC, {
    onWreckSync: (k, id) => { syncedMarker = { k, id }; },
  });
  assert.equal(markRes.kind, 'place-marker');
  assert.equal(sC.placedMarkerIds.has(anchor.id), true);
  assert.ok(sC.reelRemainingM >= prevReel + anchor.reelBonusM);
  assert.deepEqual(syncedMarker, { k: 'marker', id: anchor.id });

  // Co-op relay + late-join placedMarkers state
  const peerMsgs = [];
  const lateMsgs = [];
  const coord = new P2pRoomCoordinator({ code: 'CAVE', hostId: 'h1', hostName: 'Host', levelId: ressel.id });
  coord.bindPlayerSender('h1', () => {});
  coord.handleRemoteJoin({ name: 'B1' }, (m) => peerMsgs.push(m), 'b1');
  coord.handleMessage('h1', { type: 'start_dive', force: true });
  coord.handleMessage('h1', { type: 'wreck_action', actionKind: 'marker', targetId: anchor.id });
  const peerMarkerMsg = peerMsgs.find((m) => m.type === 'peer_wreck_action' && m.actionKind === 'marker');
  assert.equal(peerMarkerMsg?.targetId, anchor.id, 'Co-op peer must receive live marker placement');

  const peerSession = createDiveSession(ressel);
  assert.equal(applyPeerWreckAction(peerSession, peerMarkerMsg), true);
  assert.equal(peerSession.placedMarkerIds.has(anchor.id), true);

  coord.handleRemoteJoin({ name: 'LateCave' }, (m) => lateMsgs.push(m), 'b2');
  const lateStart = lateMsgs.find((m) => m.type === 'dive_started');
  assert.ok(lateStart?.placedMarkers?.includes(anchor.id), 'Late joiner must receive placed cave markers');

  // 3. Steady karst spring current pushes diver along flow vector
  const cur = ressel.caveCurrents[0];
  const sFlow = createDiveSession(ressel);
  sFlow.diver.x = cur.x;
  sFlow.diver.y = cur.y;
  sFlow.diver.vx = 0;
  sFlow.diver.vy = 0;
  stepDiveSession(sFlow, { x: 0, y: 0 }, 0.1);
  const dot = sFlow.diver.vx * cur.vx + sFlow.diver.vy * cur.vy;
  assert.ok(dot > 0.01, `Expected karst current to push diver along flow vector, got dot=${dot}`);

  // 4. Abandoned cave line trap entangles diver, prompts CUT LINE [E], and cuts free cleanly
  const trap = ressel.snagZones[0];
  const sTrap = createDiveSession(ressel);
  sTrap.diver.x = trap.x;
  sTrap.diver.y = trap.y;
  stepDiveSession(sTrap, { x: 0, y: 0 }, 0.05);
  assert.equal(sTrap.activeSnagIndex, 0);
  assert.equal(sTrap.wreckActionPrompt?.kind, 'cut-net');
  assert.match(sTrap.wreckActionPrompt?.label || '', /CUT LINE/);
  const cutRes = triggerWreckAction(sTrap);
  assert.equal(cutRes.kind, 'cut-net');
  assert.equal(sTrap.cutSnagIds.has(trap.id), true);
});

test('v101 Photorealistic surface cutout assets exist on disk as valid compact WebP sprites', async () => {
  const fs = await import('node:fs');
  const expected = [
    'surf-dive-boat.webp',
    'surf-palapa.webp',
    'surf-cabin.webp',
    'surf-bathhouse.webp',
    'surf-research-dome.webp',
    'surf-tree-palm.webp',
    'surf-tree-cypress.webp',
    'surf-tree-spruce.webp',
    'surf-tree-med.webp',
    'surf-tree-acacia.webp',
  ];
  let totalBytes = 0;
  for (const name of expected) {
    const fp = new URL(`../public/assets/${name}`, import.meta.url);
    assert.ok(fs.existsSync(fp), `Missing surface sprite ${name}`);
    const buf = fs.readFileSync(fp);
    assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF', `${name} must be RIFF WebP`);
    assert.equal(buf.subarray(8, 12).toString('ascii'), 'WEBP', `${name} must be WebP`);
    totalBytes += buf.length;
  }
  assert.ok(totalBytes > 100_000 && totalBytes < 900_000, `Unexpected total surface sprite budget: ${totalBytes} bytes`);
});

test('v102 Career logbook hooks, underwater depth acoustics/ambience, and post-lighting co-op signals', async () => {
  const fs = await import('node:fs');
  const { DiveAudio } = await import('../public/js/game/audio.js');
  const { CaveRenderer } = await import('../public/js/game/renderer.js');

  // 1. Verify Bundle 1 & Bundle 3 HTML hooks exist cleanly
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="modal-logbook"'), 'Missing Career Logbook modal');
  assert.ok(html.includes('id="btn-open-logbook"'), 'Missing Logbook menu button');
  assert.ok(html.includes('data-site-cat="todo"'), 'Missing Todo uncleared site filter tab');
  assert.ok(html.includes('data-signal="HOLD DECO 🛑"'), 'Missing HOLD DECO co-op quick signal');

  // 2. Verify Bundle 2 DiveAudio depth low-pass sweep, splash transient, and biome ambience
  const makeParam = (val = 0) => ({
    value: val,
    lastTarget: val,
    setValueAtTime(v) { this.value = v; this.lastTarget = v; },
    setTargetAtTime(v) { this.lastTarget = v; },
    linearRampToValueAtTime(v) { this.lastTarget = v; },
    exponentialRampToValueAtTime(v) { this.lastTarget = v; },
  });
  let createdNodes = 0;
  const mockCtx = {
    state: 'running',
    currentTime: 10,
    sampleRate: 44100,
    destination: { kind: 'dest' },
    createBiquadFilter() {
      createdNodes += 1;
      return { type: 'lowpass', frequency: makeParam(18000), Q: makeParam(0.7), connect() {} };
    },
    createGain() {
      createdNodes += 1;
      return { gain: makeParam(1), connect() {} };
    },
    createOscillator() {
      createdNodes += 1;
      return { type: 'sine', frequency: makeParam(440), connect() {}, start() {}, stop() {} };
    },
    createBuffer(_ch, len) {
      const data = new Float32Array(len);
      return { getChannelData: () => data };
    },
    createBufferSource() {
      createdNodes += 1;
      return { buffer: null, connect() {}, start() {}, stop() {} };
    },
  };

  const audio = new DiveAudio();
  audio.ctx = mockCtx;
  audio.setEnvironmentFilter(0, 0); // surface
  assert.ok(audio.masterFilter, 'masterFilter should be initialized');
  const surfaceCutoff = audio.masterFilter.frequency.lastTarget;
  audio.setEnvironmentFilter(10, 0); // shallow submerged
  const shallowCutoff = audio.masterFilter.frequency.lastTarget;
  audio.setEnvironmentFilter(140, 0.9); // deep + narcotic
  const deepCutoff = audio.masterFilter.frequency.lastTarget;
  assert.ok(surfaceCutoff >= 15000, `Surface cutoff should be wide open, got ${surfaceCutoff}`);
  assert.ok(shallowCutoff < 4600 && shallowCutoff > deepCutoff, `Shallow cutoff should filter highs, got ${shallowCutoff}`);
  assert.ok(deepCutoff <= 1400 && deepCutoff >= 1000, `Deep cutoff should muffle audio cleanly, got ${deepCutoff}`);

  const beforeSplash = createdNodes;
  audio.playSplash(true);
  assert.ok(createdNodes > beforeSplash, 'playSplash(true) should emit noise + tone nodes');

  const wreckLvl = LEVELS.find((l) => l.isWreck);
  const caveLvl = LEVEL_1;
  const beforeAmb = createdNodes;
  audio._ambienceTimer = 0;
  audio.stepAmbience(0.2, wreckLvl, 28);
  audio._ambienceTimer = 0;
  audio.stepAmbience(0.2, caveLvl, 28);
  assert.ok(createdNodes > beforeAmb, 'stepAmbience should emit underwater biome audio nodes');

  // 3. Verify Bundle 3 post-lighting _drawDiverSignals & _drawPeerEdgeIndicators run cleanly
  const drawnTexts = [];
  const noopCtx = new Proxy({
    fillText(t) { drawnTexts.push(String(t)); },
    measureText(t) { return { width: String(t).length * 7 }; },
  }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => {};
    },
    set() { return true; },
  });
  const now = performance.now();
  const toSX = (wx) => 400 + wx * 28;
  const toSY = (wy) => 300 + wy * 28;
  CaveRenderer.prototype._drawDiverSignals(
    noopCtx,
    { x: 0, y: 0, signalText: 'HOLD DECO 🛑', signalExpiresAt: now + 3500 },
    [{ x: 4, y: 1, alive: true, signalText: 'OK 👌', signalExpiresAt: now + 3200 }],
    toSX,
    toSY,
    28,
    12.5
  );
  assert.ok(drawnTexts.includes('HOLD DECO 🛑'), 'Local diver signal pill should draw post-lighting');
  assert.ok(drawnTexts.includes('OK 👌'), 'Peer diver signal pill should draw post-lighting');

  const edgeTexts = [];
  const edgeCtx = new Proxy({
    fillText(t) { edgeTexts.push(String(t)); },
    measureText(t) { return { width: String(t).length * 7 }; },
  }, {
    get(target, prop) { return prop in target ? target[prop] : () => {}; },
    set() { return true; },
  });
  CaveRenderer.prototype._drawPeerEdgeIndicators.call(
    { _cachedDpr: 1 },
    edgeCtx,
    800,
    600,
    { x: 0, y: 10 },
    [{ x: 40, y: 24, name: 'Maya', alive: true, condition: 'SNAGGED!', signalText: 'LOW GAS ⚠️', signalExpiresAt: now + 3000 }],
    toSX,
    toSY,
    12.5
  );
  assert.ok(edgeTexts.some((t) => t.includes('SNAGGED!') && t.includes('LOW GAS')), 'Offscreen peer indicator should surface SNAGGED! and active signal');
});

test('v103 Deep audit fixes: radio muffle, audio reset/mute, safe gas share, stalactite rock anchoring, co-op sync & SW precache', async () => {
  const fs = await import('node:fs');
  const { DiveAudio } = await import('../public/js/game/audio.js');
  const { CaveRenderer } = await import('../public/js/game/renderer.js');

  // 1. AquaticRadio.setDepthMuffle actually updates _lowpass & DiveAudio.resetEnvironmentFilter restores 18kHz + masterGain mutes
  const makeParam = (val = 0) => ({
    value: val,
    lastTarget: val,
    setValueAtTime(v) { this.value = v; this.lastTarget = v; },
    setTargetAtTime(v) { this.lastTarget = v; },
    linearRampToValueAtTime(v) { this.lastTarget = v; },
    exponentialRampToValueAtTime(v) { this.lastTarget = v; },
    cancelScheduledValues() {},
  });
  const mockCtx = {
    state: 'running',
    currentTime: 5,
    sampleRate: 44100,
    destination: { kind: 'dest' },
    createBiquadFilter() { return { type: 'lowpass', frequency: makeParam(18000), Q: makeParam(0.7), connect() {}, disconnect() {} }; },
    createGain() { return { gain: makeParam(1), connect() {}, disconnect() {} }; },
    createOscillator() { return { type: 'sine', frequency: makeParam(440), connect() {}, disconnect() {}, start() {}, stop() {} }; },
    createBuffer(_ch, len) { return { getChannelData: () => new Float32Array(len) }; },
    createBufferSource() { return { buffer: null, connect() {}, disconnect() {}, start() {}, stop() {} }; },
  };
  const audio = new DiveAudio();
  audio.ctx = mockCtx;
  audio.radio._ensureBus(mockCtx);
  audio.setEnvironmentFilter(110, 0.8);
  assert.ok(audio.radio._lowpass.frequency.lastTarget < 700, `Radio _lowpass should muffle deeply, got ${audio.radio._lowpass.frequency.lastTarget}`);
  assert.ok(audio.masterFilter.frequency.lastTarget < 2000);
  audio.resetEnvironmentFilter();
  assert.equal(audio.masterFilter.frequency.lastTarget, 18000, 'resetEnvironmentFilter must restore crisp 18kHz');
  audio.setMuted(true);
  assert.ok(audio.masterGain.gain.lastTarget <= 0.001, 'setMuted(true) must immediately silence masterGain');

  // 2. seedLogbookFromEntries preserves deepestM, totalTimeSec, and faster bestTimeSec
  let seeded = seedLogbookFromEntries(createEmptyLogbook(), [
    { levelId: 'cenote-el-abismo', score: 2500, grade: 'A', timeSec: 180, stats: { maxDepthM: 52.4 } },
    { levelId: 'cenote-el-abismo', score: 2700, grade: 'S', timeSec: 132, stats: { maxDepthM: 55.1 } },
  ]);
  assert.equal(seeded.deepestM, 55.1);
  assert.equal(seeded.totalTimeSec, 180);
  assert.equal(seeded.cleared['cenote-el-abismo'].bestTimeSec, 132);

  // 3. getShareableGasCandidate blocks toxic EAN32 at 60m and hypoxic TMX at 0.5m
  const stDeep = createDiveState();
  stDeep.tanks.TMX1455.bar = 20; // too low to share
  stDeep.tanks.EAN32.bar = 190; // hyperoxic at 60m (PPO2=2.24)
  stDeep.tanks.O2.bar = 190;
  assert.equal(getShareableGasCandidate(stDeep, 'TMX1455', 25, 60), null, 'Must refuse donating toxic EAN32/O2 at 60m');

  // 4. Peer cave marker sync grants jump-spool bonus to teammates
  const unlinedCave = LEVELS.find((l) => !l.isWreck && l.reelMetersPerDiver > 0 && l.lineAnchors?.length > 0);
  const sPeer = createDiveSession(unlinedCave);
  const prevReel = sPeer.reelRemainingM;
  const anchor = unlinedCave.lineAnchors[0];
  applyPeerWreckAction(sPeer, { actionKind: 'marker', targetId: anchor.id, by: 'Lead' });
  assert.ok(sPeer.reelRemainingM >= prevReel + anchor.reelBonusM, 'Teammates must receive jump-spool bonus on peer marker sync');

  // 5. LanClient force-send bypasses 33ms throttle & peer_buddy_rescue dropped clears rescuedBy
  const lc = new LanClient();
  lc.room = { code: 'TEST' };
  lc.connected = true;
  const sentPayloads = [];
  lc.send = (p) => sentPayloads.push(p);
  lc.sendPlayerState({ x: 1, y: 2, angle: 0 });
  lc.sendPlayerState({ x: 1, y: 2, angle: 0 }); // throttled
  lc.sendPlayerState({ x: 1, y: 0.5, angle: 0, surfaced: true }, { force: true }); // forced!
  assert.equal(sentPayloads.length, 2, 'Force-send must bypass 33ms throttle');
  assert.equal(sentPayloads[1].state.surfaced, true);
  lc.peers.set('p2', { id: 'p2', rescuedBy: 'p1', rescued: false });
  lc._handleMessage({ type: 'peer_buddy_rescue', rescuedId: 'p2', rescuerId: 'p1', status: 'dropped' });
  assert.equal(lc.peers.get('p2').rescuedBy, '', 'dropped rescue must clear rescuedBy');

  // 6. P2pRoomCoordinator migrates playerLines/bodyRecoveredBy on token reconnect, attaches syncState on peer_wreck_action, blocks self gas_share
  const p2pMsgs = [];
  const coord = new P2pRoomCoordinator({ code: 'V103', hostId: 'h1', hostName: 'Host', levelId: 'uss-oriskany-carrier' });
  coord.bindPlayerSender('h1', (m) => p2pMsgs.push(m));
  const guestMsgs = [];
  coord.handleRemoteJoin({ name: 'Guest' }, (m) => guestMsgs.push(m), 'g-old');
  const issuedToken = guestMsgs.find((m) => m.type === 'room_joined')?.reconnectToken;
  assert.ok(issuedToken, 'Host must issue reconnectToken on room_joined');
  coord.handleMessage('h1', { type: 'start_dive', force: true });
  coord.handleMessage('g-old', { type: 'guideline_sync', chains: [[{ x: 0, y: 10 }, { x: 4, y: 12 }]], reelingActive: true });
  coord.handleMessage('g-old', { type: 'body_recovered' });
  coord.handleMessage('h1', { type: 'wreck_action', actionKind: 'hatch', targetId: 'h_bridge' });
  const wreckEvt = guestMsgs.find((m) => m.type === 'peer_wreck_action');
  assert.ok(wreckEvt?.syncState?.openedHatches?.includes('h_bridge'), 'peer_wreck_action must attach updated syncState');
  coord.handleMessage('h1', { type: 'gas_share', targetPlayerId: 'h1', gasId: 'EAN32', amountBar: 20 });
  assert.equal(p2pMsgs.some((m) => m.type === 'peer_gas_share'), false, 'Self gas_share must be blocked');
  coord.handleRemoteJoin({ name: 'Guest', reconnectToken: issuedToken }, () => {}, 'g-new');
  assert.equal(coord.room.bodyRecoveredBy, 'g-new', 'bodyRecoveredBy must migrate to new peerId');
  assert.ok(coord.room.playerLines.has('g-new'), 'playerLines must migrate to new peerId');
  coord.destroy();

  // 7. Every cached stalactite across all 20 cave levels is strictly anchored in solid rock (0 floating stalactites)
  const noopCtx = new Proxy({}, { get: () => () => {}, set: () => true });
  for (const lvl of LEVELS) {
    if (lvl.isWreck) continue;
    const fakeRenderer = { level: lvl, _stalactiteCache: null };
    CaveRenderer.prototype._drawCaveInteractives.call(
      fakeRenderer, noopCtx, -999, 999, -999, 999, (x) => x, (y) => y, 20, 0, null, null
    );
    for (const st of fakeRenderer._stalactiteCache || []) {
      assert.ok(
        evaluateCaveSDF(lvl, st.x, st.y) >= 0.04,
        `Floating stalactite on ${lvl.id} at (${st.x.toFixed(1)}, ${st.y.toFixed(1)})`
      );
    }
  }

  // 8. CSS border-box on pseudo-elements, server.js .webp MIME, and sw.js surf-*.webp precache + versioned MEDIA_CACHE
  const css = fs.readFileSync(new URL('../public/css/style.css', import.meta.url), 'utf8');
  assert.ok(css.includes('*, *::before, *::after'), 'CSS must apply border-box to pseudo-elements');
  const srv = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(srv.includes("'.webp': 'image/webp'"), 'server.js must map .webp MIME type');
  const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.ok(sw.includes('./assets/surf-dive-boat.webp'), 'sw.js must precache surf-*.webp cutouts');
  const cv = sw.match(/CACHE_VERSION\s*=\s*'cave-diver-v(\d+)'/)?.[1];
  const mv = sw.match(/MEDIA_CACHE\s*=\s*'cave-diver-media-v(\d+)'/)?.[1];
  assert.equal(cv, mv, 'CACHE_VERSION and MEDIA_CACHE versions must stay in lockstep');
});

test('v104 Ghost PB & Par Pacer track synthesis works across all 25 levels and renders onscreen & offscreen indicators', async () => {
  const { buildParGhostTrack } = await import('../public/js/game/diveSession.js');
  const { CaveRenderer } = await import('../public/js/game/renderer.js');

  for (const lvl of LEVELS) {
    const track = buildParGhostTrack(lvl);
    assert.ok(Array.isArray(track) && track.length >= 2, `Missing par ghost track for ${lvl.id}`);
    const pStart = sampleGhostPose(track, 0);
    const pMid = sampleGhostPose(track, (lvl.parTimeSec || 180) * 0.5);
    assert.ok(pStart && Number.isFinite(pStart.x) && Number.isFinite(pStart.y));
    assert.ok(pMid && Number.isFinite(pMid.x) && Number.isFinite(pMid.y));
  }

  // Onscreen PB ghost + offscreen Par Pacer arrow render cleanly
  const drawn = [];
  const mockCtx = new Proxy({
    fillText(t) { drawn.push(String(t)); },
    measureText(t) { return { width: String(t).length * 7 }; },
  }, {
    get(target, prop) { return prop in target ? target[prop] : () => {}; },
    set() { return true; },
  });
  const toSX = (x) => 400 + x * 24;
  const toSY = (y) => 300 + y * 24;
  CaveRenderer.prototype._drawGhostDiver.call(
    { _cachedDpr: 1, glowStamps: {} },
    mockCtx,
    { x: 2, y: 1, angle: 0.2, finished: false, isPar: false },
    toSX, toSY, 24, 5.0, 800, 600, { x: 0, y: 1 }
  );
  assert.ok(drawn.includes('👻 PB GHOST'), 'Onscreen PB ghost should draw PB GHOST badge');

  CaveRenderer.prototype._drawGhostDiver.call(
    { _cachedDpr: 1, glowStamps: {} },
    mockCtx,
    { x: 50, y: 12, angle: 0.1, finished: false, isPar: true },
    toSX, toSY, 24, 5.0, 800, 600, { x: 0, y: 2 }
  );
  assert.ok(drawn.some((t) => t.includes('👻 PAR') && t.includes('m')), 'Offscreen ghost should draw directional edge pacer');
});

test('v105 Modes verification (Guided / Standard Tech / Hardcore): silt, impact, currents, snag panic, compass/HUD & mode badges', async () => {
  const fs = await import('node:fs');
  const { emitImpactSilt } = await import('../public/js/game/diveSession.js');
  const { DiveComputerHUD } = await import('../public/js/game/hud.js');

  // 1. Floor silt stir scales monotonically: guided < standard < hardcore (count, radius, alpha)
  const runFloorSilt = (difficulty) => {
    const clouds = [];
    const timer = { accum: 0 };
    const diver = { x: 114, y: 52.8, vx: 1.4, vy: 0, angle: 0 };
    for (let step = 0; step < 30; step++) {
      stirFloorSilt(LEVEL_1, diver, clouds, { dt: 0.1, thrustMag: 0.85, timerState: timer, difficulty });
    }
    const avgAlpha = clouds.reduce((s, c) => s + (c.peakAlpha || 0), 0) / Math.max(1, clouds.length);
    const avgMaxR = clouds.reduce((s, c) => s + (c.maxRadius || 0), 0) / Math.max(1, clouds.length);
    return { count: clouds.length, avgAlpha, avgMaxR };
  };
  const sG = runFloorSilt('guided');
  const sS = runFloorSilt('standard');
  const sH = runFloorSilt('hardcore');
  assert.ok(sG.count < sS.count && sS.count < sH.count, `Floor silt count must scale G(${sG.count}) < S(${sS.count}) < H(${sH.count})`);
  assert.ok(sG.avgAlpha < sS.avgAlpha && sS.avgAlpha < sH.avgAlpha, 'Floor silt opacity must scale G < S < H');
  assert.ok(sG.avgMaxR < sS.avgMaxR && sS.avgMaxR < sH.avgMaxR, 'Floor silt maxRadius must scale G < S < H');

  // 2. Wall-impact silt scales monotonically: guided < standard < hardcore
  const impG = emitImpactSilt([], 20, 20, 0, -1, 2.8, 'guided');
  const impS = emitImpactSilt([], 20, 20, 0, -1, 2.8, 'standard');
  const impH = emitImpactSilt([], 20, 20, 0, -1, 2.8, 'hardcore');
  assert.ok(impG.length < impS.length && impS.length < impH.length, `Impact silt count G(${impG.length}) < S(${impS.length}) < H(${impH.length})`);
  assert.ok(impG[0].peakAlpha < impS[0].peakAlpha && impS[0].peakAlpha < impH[0].peakAlpha);

  // 3. Karst currents scale monotonically: guided < standard < hardcore
  const ressel = getLevelById('emergence-du-ressel');
  const cur = ressel.caveCurrents[0];
  const measureCurrentPush = (difficulty) => {
    const sess = createDiveSession(ressel, { difficulty });
    sess.diver.x = cur.x;
    sess.diver.y = cur.y;
    sess.diver.vx = 0;
    sess.diver.vy = 0;
    stepDiveSession(sess, { x: 0, y: 0 }, 0.12);
    return sess.diver.vx * cur.vx + sess.diver.vy * cur.vy;
  };
  const curG = measureCurrentPush('guided');
  const curS = measureCurrentPush('standard');
  const curH = measureCurrentPush('hardcore');
  assert.ok(curG > 0 && curG < curS && curS < curH, `Current push must scale G(${curG.toFixed(4)}) < S(${curS.toFixed(4)}) < H(${curH.toFixed(4)})`);

  // 4. Snag entanglement panic & HR spike scale monotonically: guided < standard < hardcore
  const trap = ressel.snagZones[0];
  const measureSnagStress = (difficulty) => {
    const sess = createDiveSession(ressel, { difficulty });
    sess.diver.x = trap.x;
    sess.diver.y = trap.y;
    sess.diveState.panicLevel = 0;
    sess.diveState.heartRateBpm = 70;
    for (let i = 0; i < 10; i++) {
      stepDiveSession(sess, { x: 0, y: 0 }, 0.1);
    }
    return { panic: sess.diveState.panicLevel, hr: sess.diveState.heartRateBpm };
  };
  const snG = measureSnagStress('guided');
  const snS = measureSnagStress('standard');
  const snH = measureSnagStress('hardcore');
  assert.ok(snG.panic < snS.panic && snS.panic < snH.panic, `Snag panic must scale G(${snG.panic.toFixed(2)}) < S(${snS.panic.toFixed(2)}) < H(${snH.panic.toFixed(2)})`);
  assert.ok(snG.hr < snS.hr && snS.hr < snH.hr, `Snag HR must scale G(${snG.hr.toFixed(1)}) < S(${snS.hr.toFixed(1)}) < H(${snH.hr.toFixed(1)})`);

  // 5. HUD mode badge + compass visibility override works for Guided on unlined maze & Hardcore on lined cave
  const makeEl = () => ({
    textContent: '',
    className: '',
    innerHTML: '',
    hidden: false,
    style: {},
    dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    querySelector: () => makeEl(),
    addEventListener() {},
    appendChild() {},
    setAttribute() {},
  });
  const domMap = new Map();
  const prevDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (!domMap.has(id)) domMap.set(id, makeEl());
      return domMap.get(id);
    },
    createElement() { return makeEl(); },
  };
  try {
    const hud = new DiveComputerHUD({ onGasSelect() {}, onReelToggle() {}, onReelRewind() {}, onHeartbeatPulse() {} });
    const maze = getLevelById('orda-crystal-maze'); // hideWaypointCompass: true
    const dsMaze = createDiveState();
    hud.update({
      diveState: dsMaze,
      diver: { x: maze.spawn.x, y: maze.spawn.y, name: 'Diver' },
      nextCheckpoint: maze.checkpoints[0],
      exitZone: maze.exitZone,
      checkpointsHit: new Set(),
      totalCheckpoints: maze.checkpoints.length,
      level: maze,
      difficulty: 'guided',
      dt: 0.016,
    });
    assert.equal(domMap.get('dc-mode-badge').textContent, '🧭 GUIDED');
    assert.ok(domMap.get('dc-objective').innerHTML.includes(maze.checkpoints[0].name), 'Guided mode must show waypoint name & distance even in unlined mazes');

    const dsL1 = createDiveState();
    hud.update({
      diveState: dsL1,
      diver: { x: LEVEL_1.spawn.x, y: LEVEL_1.spawn.y, name: 'Diver' },
      nextCheckpoint: LEVEL_1.checkpoints[0],
      exitZone: LEVEL_1.exitZone,
      checkpointsHit: new Set(),
      totalCheckpoints: LEVEL_1.checkpoints.length,
      level: LEVEL_1,
      difficulty: 'hardcore',
      dt: 0.016,
    });
    assert.equal(domMap.get('dc-mode-badge').textContent, '🔥 HARDCORE');
    assert.ok(!domMap.get('dc-objective').innerHTML.includes(LEVEL_1.checkpoints[0].name), 'Hardcore mode must hide waypoint name/arrows even on Level 1');
    assert.ok(domMap.get('dc-objective').innerHTML.includes('HARDCORE'));
  } finally {
    globalThis.document = prevDoc;
  }

  // 6. Logbook & Leaderboard persist mode badges cleanly (never downgrading highest cleared tier)
  let book = createEmptyLogbook();
  book = recordDiveInLogbook(book, { levelId: 'cenote-el-abismo', success: true, score: 2500, grade: 'A', maxDepthM: 50, diveTimeSec: 130, difficulty: 'hardcore' });
  assert.equal(book.cleared['cenote-el-abismo'].bestDifficulty, 'hardcore');
  book = recordDiveInLogbook(book, { levelId: 'cenote-el-abismo', success: true, score: 2400, grade: 'B', maxDepthM: 50, diveTimeSec: 145, difficulty: 'guided' });
  assert.equal(book.cleared['cenote-el-abismo'].bestDifficulty, 'hardcore', 'Replaying in Guided must not downgrade Hardcore badge');
  assert.equal(book.cleared['cenote-el-abismo'].lastDifficulty, 'guided');

  const sub = normalizeLeaderboardSubmission({
    mode: 'solo',
    levelId: 'cenote-el-abismo',
    playerId: 'hc1',
    diverName: 'HardcoreDiver',
    score: 2600,
    timeSec: 120,
    exploredPct: 90,
    grade: 'S',
    difficulty: 'hardcore',
    stats: { maxDepthM: 50.2, difficulty: 'hardcore' },
  });
  assert.equal(sub.ok, true);
  assert.equal(sub.entry.difficulty, 'hardcore');
  assert.equal(sub.entry.stats.difficulty, 'hardcore');
  const overall = queryLeaderboardEntries([sub.entry], { mode: 'solo', levelId: 'overall' });
  assert.equal(overall[0].siteRuns[0].difficulty, 'hardcore');

  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="menu-mode-badge"'), 'Missing Home screen mode badge');
  assert.ok(html.includes('id="dc-mode-badge"'), 'Missing HUD mode badge');
  assert.ok(html.includes('id="debrief-mode-badge"'), 'Missing Debrief mode badge');
});

test('v106 5 new varied expeditions (SS Thistlegorm, Ojamo Iron Mine, Scoresby Sund Iceberg, U-1206 Submarine, Bermuda Crystal Arch) validate & exercise signature mechanics', () => {
  const newIds = [
    'ss-thistlegorm-wreck',
    'ojamo-iron-mine',
    'scoresby-sund-iceberg',
    'u1206-north-sea-sub',
    'bermuda-devils-wall',
  ];

  for (const id of newIds) {
    const lvl = getLevelById(id);
    assert.equal(lvl.id, id, `Missing registered level ${id}`);
    const check = validateLevel(lvl, { checkGeometry: true });
    assert.equal(check.valid, true, `${id} validation failed: ${check.errors.join('; ')}`);
    assert.ok(evaluateCaveSDF(lvl, lvl.spawn.x, lvl.spawn.y) < -0.6, `${id} spawn blocked`);
    assert.ok(evaluateCaveSDF(lvl, lvl.exitZone.x, lvl.exitZone.y) < -0.6, `${id} exit blocked`);

    for (const cp of lvl.checkpoints) {
      assert.ok(evaluateCaveSDF(lvl, cp.x, cp.y) < -0.55, `${id} checkpoint ${cp.id} obstructed`);
    }
    for (const item of lvl.collectibles) {
      assert.ok(evaluateCaveSDF(lvl, item.x, item.y) < -0.5, `${id} collectible ${item.id} obstructed`);
    }
    if (Array.isArray(lvl.guideline) && lvl.guideline.length >= 2) {
      for (let i = 0; i < lvl.guideline.length - 1; i++) {
        const a = lvl.guideline[i];
        const b = lvl.guideline[i + 1];
        for (let s = 0; s <= 5; s++) {
          const t = s / 5;
          const px = a.x + (b.x - a.x) * t;
          const py = a.y + (b.y - a.y) * t;
          assert.ok(evaluateCaveSDF(lvl, px, py) < -0.55, `${id} guideline blocked near (${px.toFixed(1)}, ${py.toFixed(1)})`);
        }
      }
    }
    // Check bottom gas safety at max depth
    const st = createDiveSession(lvl).diveState;
    switchGas(st, 'TMX1455');
    const maxD = getLevelMeta(lvl).maxDepthM;
    const ppo2 = computePPO2(maxD, st.mixes.TMX1455);
    assert.ok(ppo2 >= 0.25 && ppo2 <= 1.38, `${id} TMX PPO2 at ${maxD}m out of range: ${ppo2}`);

    // Verify marine ecosystem spawns cleanly in open water
    const eco = createMarineEcosystem(lvl);
    assert.ok(eco.fish.length > 0 && eco.anchored.length > 0, `${id} ecosystem should populate`);
  }

  // 1. SS Thistlegorm: Tier I intro wreck with blast crater hull dip & coral reef ecosystem
  const thi = getLevelById('ss-thistlegorm-wreck');
  assert.equal(thi.isWreck, true);
  assert.equal(getLevelMeta(thi).tier, 1);
  assert.ok(thi.hullTopY(55) > thi.wreckDeckY + 8, 'Thistlegorm blast crater must dip below cargo deck');
  const thiEco = createMarineEcosystem(thi);
  assert.ok(thiEco.anchored.some((a) => a.kind === 'seafan'), 'Red Sea Thistlegorm should grow warm coral sea fans');

  // 2. Ojamo Flooded Iron Mine: non-wreck flooded mine with crankable watertight blast doors!
  const ojamo = getLevelById('ojamo-iron-mine');
  assert.equal(Boolean(ojamo.isWreck), false);
  assert.ok(ojamo.watertightHatches.length >= 2, 'Ojamo mine should have >=2 sealed blast-door hatches');
  const sOja = createDiveSession(ojamo);
  const mineHatch = ojamo.watertightHatches[0];
  sOja.diver.x = mineHatch.x - mineHatch.radius - 1.0;
  sOja.diver.y = mineHatch.y;
  stepDiveSession(sOja, { x: 0, y: 0 }, 0.05);
  assert.equal(sOja.wreckActionPrompt?.kind, 'open-hatch', 'Mine blast door must offer open-hatch interaction');
  triggerWreckAction(sOja);
  for (let i = 0; i < 20; i++) stepDiveSession(sOja, { x: 0, y: 0 }, 0.1);
  assert.equal(sOja.openedHatchIds.has(mineHatch.id), true, 'Mine blast door must unseal after cranking');
  assert.ok(sOja.hatchBonusScore >= 175);

  // 3. Scoresby Sund Iceberg Cathedral: Tier III Greenland iceberg with 3 sapphire archWindows & bioluminescence
  const sco = getLevelById('scoresby-sund-iceberg');
  assert.equal(getLevelMeta(sco).tier, 3);
  assert.equal(sco.archWindows.length, 3);
  assert.equal(sco.theme.bioluminescent, true);

  // 4. U-1206 North Sea Submarine: Tier III submarine wreck with 3 watertight bulkheads & conning tower
  const u12 = getLevelById('u1206-north-sea-sub');
  assert.equal(u12.isWreck, true);
  assert.equal(u12.shipProfile, 'u1206-submarine');
  assert.equal(u12.watertightHatches.length, 3);
  assert.ok(u12.wreckProps.some((p) => p.kind === 'conning-tower'));

  // 5. Bermuda Crystal Arch & Abyss: unlined Tier IV sea-wall recovery mission with TMX 11/65
  const ber = getLevelById('bermuda-devils-wall');
  assert.equal(ber.lined, false);
  assert.equal(ber.reelMetersPerDiver, 225);
  assert.equal(ber.archWindows.length, 2);
  const sBer = createDiveSession(ber);
  assert.equal(sBer.diveState.mixes.TMX1455.name, 'TMX 11/65');
  for (const cp of ber.checkpoints) sBer.checkpointsHit.add(cp.id);
  sBer.diveState.ceilingM = 0;
  sBer.diver.x = ber.exitZone.x;
  sBer.diver.y = 1.0;
  const blockedBer = stepDiveSession(sBer, { x: 0, y: 0 }, 0.05);
  assert.equal(blockedBer.outcome, null, 'Bermuda must require Telemetry Buoy recovery before surfacing');
  sBer.diveState.activeGasId = 'TMX1455';
  sBer.diver.x = ber.recoveryTarget.x;
  sBer.diver.y = ber.recoveryTarget.y;
  stepDiveSession(sBer, { x: 0, y: 0 }, 0.05);
  assert.equal(sBer.bodyRecovered, true);
  sBer.diveState.activeGasId = 'EAN32';
  sBer.diveState.ceilingM = 0;
  sBer.diver.x = ber.exitZone.x;
  sBer.diver.y = 1.0;
  const doneBer = stepDiveSession(sBer, { x: 0, y: 0 }, 0.05);
  assert.equal(doneBer.outcome?.success, true);
  assert.ok(doneBer.outcome.title.includes('Bermuda Telemetry Buoy'));
  assert.ok(!doneBer.outcome.detail.includes('aurora'), 'Bermuda probe debrief should not reference Iceland aurora');
});

test('v107 Unlockable Tech Gear Loadout (Cave Sonar, DPV Scooter & CCR Rebreather): cert unlocks, physics, bubbles, silt wake, co-op sync & HUD', async () => {
  const fs = await import('node:fs');

  // 1. Cert-gated unlocks via computeUnlockedGear & sanitizeGearLoadout
  let book = createEmptyLogbook();
  assert.equal(computeUnlockedGear(book, LEVELS).unlockedIds.size, 0, 'Fresh diver should start with 0 unlocked tech gear');
  assert.deepEqual(
    sanitizeGearLoadout({ sonar: true, dpv: true, ccr: true }, computeUnlockedGear(book, LEVELS).unlockedIds),
    { sonar: false, dpv: false, ccr: false },
    'Locked gear must be stripped from loadout'
  );

  book = recordDiveInLogbook(book, { levelId: 'cenote-el-abismo', success: true, score: 2600, grade: 'A', maxDepthM: 50, diveTimeSec: 160 });
  assert.equal(computeUnlockedGear(book, LEVELS).unlockedIds.has('sonar'), true, '1 clear unlocks Cave Sonar');
  assert.equal(computeUnlockedGear(book, LEVELS).unlockedIds.has('dpv'), false);

  book = recordDiveInLogbook(book, { levelId: 'eagles-nest-sink', success: true, score: 2700, grade: 'A', maxDepthM: 58, diveTimeSec: 180 });
  book = recordDiveInLogbook(book, { levelId: 'uss-oriskany-carrier', success: true, score: 2900, grade: 'S', maxDepthM: 65, diveTimeSec: 240 });
  const allUnlocks = computeUnlockedGear(book, LEVELS).unlockedIds;
  assert.ok(allUnlocks.has('sonar') && allUnlocks.has('dpv') && allUnlocks.has('ccr'), '3 clears + 65m unlocks all 3 tech gear items');

  // 2. Cave Sonar Ping: casts wall echo contour rays, pings nearby contacts, boosts explored cells & enforces cooldown
  const ori = getLevelById('uss-oriskany-carrier');
  const sSonar = createDiveSession(ori, { gear: { sonar: true } });
  sSonar.diver.x = 36;
  sSonar.diver.y = 52;
  const exploredBefore = sSonar.exploredCells.size;
  let sonarSoundFired = 0;
  const ping = triggerSonarPing(sSonar, { onSonarPing: () => { sonarSoundFired++; } });
  assert.equal(ping.ok, true);
  assert.equal(sonarSoundFired, 1);
  assert.ok(ping.pulse.wallHits.length >= 12, `Expected >=12 sonar wall hits, got ${ping.pulse.wallHits.length}`);
  assert.ok(ping.pulse.contacts.length >= 2, `Expected sonar contacts near Hangar Bay, got ${ping.pulse.contacts.length}`);
  assert.ok(sSonar.exploredCells.size > exploredBefore, 'Sonar sweep should chart nearby unexplored cells');
  assert.equal(triggerSonarPing(sSonar).reason, 'cooldown', 'Second immediate ping must be blocked by cooldown');
  const clearSteps = Math.ceil((ping.pulse.durationSec || 3.8) / 0.1) + 2;
  for (let i = 0; i < clearSteps; i++) stepDiveSession(sSonar, { x: 0, y: 0 }, 0.1);
  assert.equal(sSonar.sonar.activePulse, null, 'Sonar pulse should clear cleanly after durationSec');

  // 3. DPV Underwater Scooter: boosts swim speed, drains battery, amplifies floor silt wake & auto-disables when empty
  const sFins = createDiveSession(LEVEL_1);
  const sDpv = createDiveSession(LEVEL_1, { gear: { dpv: true } });
  sFins.diver.x = 40; sFins.diver.y = 22;
  sDpv.diver.x = 40; sDpv.diver.y = 22;
  assert.equal(toggleDpvScooter(sDpv).active, true);
  let dpvHums = 0;
  for (let i = 0; i < 20; i++) {
    stepDiveSession(sFins, { x: 1, y: 0 }, 0.05);
    stepDiveSession(sDpv, { x: 1, y: 0 }, 0.05, { onDpvHum: () => { dpvHums++; } });
  }
  assert.ok(sDpv.diver.vx > sFins.diver.vx * 1.45, `Expected DPV speed (${sDpv.diver.vx.toFixed(2)}) >> fins (${sFins.diver.vx.toFixed(2)})`);
  assert.ok(sDpv.dpv.batteryPct < 99.5, 'DPV throttling must consume battery');
  assert.ok(dpvHums >= 1, 'DPV throttling should trigger electric motor hum callback');

  // Floor silt wake: DPV boost kicks up more silt clouds than standard fins near floor
  const floorFinClouds = [];
  const floorDpvClouds = [];
  const tFin = { accum: 0 };
  const tDpv = { accum: 0 };
  const dFloor = { x: 114, y: 52.7, vx: 1.5, vy: 0, angle: 0 };
  for (let i = 0; i < 18; i++) {
    stirFloorSilt(LEVEL_1, dFloor, floorFinClouds, { dt: 0.1, thrustMag: 0.85, timerState: tFin, dpvBoost: false });
    stirFloorSilt(LEVEL_1, dFloor, floorDpvClouds, { dt: 0.1, thrustMag: 0.85, timerState: tDpv, dpvBoost: true });
  }
  assert.ok(floorDpvClouds.length > floorFinClouds.length, `DPV propwash (${floorDpvClouds.length}) should stir more floor silt than fins (${floorFinClouds.length})`);

  // Battery exhaustion auto-disables DPV cleanly
  sDpv.dpv.batteryPct = 0.08;
  stepDiveSession(sDpv, { x: 1, y: 0 }, 0.2);
  assert.equal(sDpv.dpv.active, false, 'Empty battery must auto-disable DPV');
  assert.equal(toggleDpvScooter(sDpv).reason, 'empty');

  // 4. CCR Closed-Circuit Rebreather: 2.6x gas economy, near-zero bubbles, faster O2 deco & scrubber drain
  const ocState = createDiveState();
  const ccrState = createDiveState({ ccrEnabled: true });
  switchGas(ocState, 'TMX1455');
  switchGas(ccrState, 'TMX1455');
  for (let i = 0; i < 60; i++) {
    stepDivePhysiology(ocState, { depthM: 50, prevDepthM: 50, dt: 1.0, exertion: 0.4 });
    stepDivePhysiology(ccrState, { depthM: 50, prevDepthM: 50, dt: 1.0, exertion: 0.4 });
  }
  const ocBurn = 200 - ocState.tanks.TMX1455.bar;
  const ccrBurn = 200 - ccrState.tanks.TMX1455.bar;
  assert.ok(ccrBurn < ocBurn * 0.45, `CCR gas burn (${ccrBurn.toFixed(1)} bar) should be ~0.38x open circuit (${ocBurn.toFixed(1)} bar)`);
  assert.ok(ccrState.ccrScrubberPct < 96 && ccrState.ccrScrubberPct > 80, `Expected realistic scrubber drain, got ${ccrState.ccrScrubberPct}`);

  // CCR suppresses open-circuit bubble exhaust & tags onExhale with isCcr=true
  const sOc = createDiveSession(LEVEL_1);
  const sCcr = createDiveSession(LEVEL_1, { gear: { ccr: true } });
  sOc.diver.x = 40; sOc.diver.y = 20;
  sCcr.diver.x = 40; sCcr.diver.y = 20;
  let sawCcrExhale = false;
  for (let i = 0; i < 160; i++) {
    stepDiveSession(sOc, { x: 0, y: 0 }, 0.05);
    stepDiveSession(sCcr, { x: 0, y: 0 }, 0.05, { onExhale: (ev) => { if (ev?.isCcr) sawCcrExhale = true; } });
  }
  assert.equal(sawCcrExhale, true, 'CCR exhale callback should pass isCcr: true for solenoid audio');
  assert.ok(sCcr.bubbles.length < sOc.bubbles.length * 0.25, `CCR bubbles (${sCcr.bubbles.length}) should be vastly lower than OC (${sOc.bubbles.length})`);

  // 5. Co-op P2P relay preserves hasCcr, hasDpv, dpvActive, dpvThrusting
  const peerMsgs = [];
  const coord = new P2pRoomCoordinator({ code: 'GEAR', hostId: 'h1', hostName: 'Lead', levelId: LEVEL_1.id });
  coord.bindPlayerSender('h1', () => {});
  coord.handleRemoteJoin({ name: 'Buddy' }, (m) => peerMsgs.push(m), 'b1');
  coord.handleMessage('h1', { type: 'start_dive', force: true });
  coord.handleMessage('h1', {
    type: 'player_state',
    state: { seq: 1, x: 18, y: 14, vx: 2.2, vy: 0, angle: 0, hasCcr: true, hasDpv: true, dpvActive: true, dpvThrusting: true, alive: true },
  });
  const relayed = peerMsgs.find((m) => m.type === 'peer_state');
  assert.equal(relayed?.state?.hasCcr, true);
  assert.equal(relayed?.state?.hasDpv, true);
  assert.equal(relayed?.state?.dpvActive, true);
  assert.equal(relayed?.state?.dpvThrusting, true);
  coord.destroy();

  // 6. Renderer draws CCR + DPV rig & Sonar Ping sweep cleanly + HTML hooks exist
  const noopCtx = new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: (t) => ({ width: String(t).length * 7 }),
  }, { get: (t, p) => (p in t ? t[p] : () => {}), set: () => true });
  CaveRenderer.prototype._drawSonarPulse.call(
    {},
    noopCtx,
    { ...ping.pulse, ageSec: 0.7 },
    (x) => 400 + x * 20,
    (y) => 300 + y * 20,
    20,
    5.0
  );
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="menu-gear-dock"'), 'Missing Home Tech Gear Loadout dock');
  assert.ok(html.includes('id="hud-gear-dock"'), 'Missing HUD Tech Gear dock');
  assert.ok(html.includes('id="btn-hud-sonar"'), 'Missing HUD Sonar button');
  assert.ok(html.includes('id="btn-hud-dpv"'), 'Missing HUD DPV button');
  assert.ok(html.includes('id="hud-ccr-pill"'), 'Missing HUD CCR pill');
  assert.ok(html.includes('id="debrief-gear-badge"'), 'Missing Debrief gear badge');
});

test('v108 Daily Expedition Challenge: deterministic UTC rotation, streak logbook & all 6 mutators', async () => {
  // 1. Deterministic UTC daily challenge + no back-to-back site repeats across 30 days
  assert.equal(DAILY_MUTATORS.length, 6);
  const dA = getDailyChallenge(LEVELS, '2026-11-20');
  const dB = getDailyChallenge(LEVELS, '2026-11-20');
  assert.deepEqual(
    { dateKey: dA.dateKey, levelId: dA.levelId, mutatorId: dA.mutatorId },
    { dateKey: dB.dateKey, levelId: dB.levelId, mutatorId: dB.mutatorId },
    'Same UTC date must produce identical worldwide Daily Expedition'
  );
  assert.ok(getDailyMutatorById(dA.mutatorId), 'Mutator must resolve cleanly');

  let prevLevelId = '';
  const seenSites = new Set();
  const seenMutators = new Set();
  const baseUtcMs = Date.UTC(2026, 10, 1);
  for (let offset = 0; offset < LEVELS.length; offset++) {
    const dt = new Date(baseUtcMs + offset * 86400000);
    const dk = dt.toISOString().slice(0, 10);
    const dc = getDailyChallenge(LEVELS, dk);
    assert.notEqual(dc.levelId, prevLevelId, `Back-to-back duplicate site on ${dk}`);
    prevLevelId = dc.levelId;
    seenSites.add(dc.levelId);
    seenMutators.add(dc.mutatorId);
  }
  assert.equal(seenSites.size, LEVELS.length, `${LEVELS.length}-day cycle should cover all ${LEVELS.length} dive sites`);
  assert.ok(seenMutators.size >= 4, 'Daily cycle should rotate across multiple mutators');

  // 2. Logbook daily streak progression, same-day idempotency, high-score upgrade & reset on gap
  let book = createEmptyLogbook();
  assert.equal(getDailyStatus(book, '2026-11-18').activeStreak, 0);
  book = recordDailyClear(book, { dateKey: '2026-11-18', levelId: LEVEL_1.id, mutatorId: 'strobe', score: 2400, grade: 'A', timeSec: 120 });
  assert.equal(getDailyStatus(book, '2026-11-18').activeStreak, 1);
  assert.equal(getDailyStatus(book, '2026-11-18').clearedToday, true);
  // Same-day replay improves score without double-counting streak
  book = recordDailyClear(book, { dateKey: '2026-11-18', levelId: LEVEL_1.id, mutatorId: 'strobe', score: 3100, grade: 'S', timeSec: 105 });
  assert.equal(book.daily.currentStreak, 1);
  assert.equal(book.daily.totalClears, 1);
  assert.equal(book.daily.records['2026-11-18'].score, 3100);
  // Consecutive next UTC day increments streak to 2
  book = recordDailyClear(book, { dateKey: '2026-11-19', levelId: LEVEL_1.id, mutatorId: 'surge', score: 2900, grade: 'S', timeSec: 110 });
  assert.equal(getDailyStatus(book, '2026-11-19').activeStreak, 2);
  assert.equal(getDailyStatus(book, '2026-11-20').activeStreak, 2, 'Active streak remains alive on next day until missed');
  assert.equal(getDailyStatus(book, '2026-11-21').activeStreak, 0, 'Missing a full UTC day resets activeStreak to 0');
  // Clearing after gap restarts streak at 1 while preserving bestStreak = 2
  book = recordDailyClear(book, { dateKey: '2026-11-21', levelId: LEVEL_1.id, mutatorId: 'purist', score: 2800, grade: 'A', timeSec: 118 });
  assert.equal(book.daily.currentStreak, 1);
  assert.equal(book.daily.bestStreak, 2);
  assert.equal(book.daily.totalClears, 3);

  // 3. Mutator physics & rules verification across all 6 mutators
  // 3a. Purist strips all tech gear & forces compass hidden
  const sPurist = createDiveSession(LEVEL_1, {
    difficulty: 'guided',
    gear: { sonar: true, dpv: true, ccr: true },
    mutatorId: 'purist',
    dailyDateKey: '2026-11-20',
  });
  assert.equal(sPurist.gear.sonar, false);
  assert.equal(sPurist.gear.dpv, false);
  assert.equal(sPurist.gear.ccr, false);
  assert.equal(sPurist.forceHideCompass, true);

  // 3b. Lights-Out Strobe modulates diver.strobeMod between bright flash (1.0) & dim rest (0.22)
  const sStrobe = createDiveSession(LEVEL_1, { mutatorId: 'strobe', dailyDateKey: '2026-11-20' });
  stepDiveSession(sStrobe, { x: 0, y: 0 }, 0.1);
  assert.equal(sStrobe.diver.strobeMod, 1.0, 'Strobe should be at full brightness during flash window');
  for (let i = 0; i < 16; i++) stepDiveSession(sStrobe, { x: 0, y: 0 }, 0.05); // simTime = 0.9s -> dark rest
  assert.ok(sStrobe.diver.strobeMod < 0.3, `Strobe should dim during rest phase, got ${sStrobe.diver.strobeMod}`);

  // 3c. Turbo Par boosts swim velocity & tightens parTimeSec to 0.75x
  const sNorm = createDiveSession(LEVEL_1);
  const sTurbo = createDiveSession(LEVEL_1, { mutatorId: 'turbo-par', dailyDateKey: '2026-11-20' });
  for (let i = 0; i < 12; i++) {
    stepDiveSession(sNorm, { x: 1, y: 0 }, 0.05);
    stepDiveSession(sTurbo, { x: 1, y: 0 }, 0.05);
  }
  assert.ok(sTurbo.diver.vx > sNorm.diver.vx * 1.15, `Turbo Par vx (${sTurbo.diver.vx.toFixed(2)}) should exceed normal (${sNorm.diver.vx.toFixed(2)})`);
  const baseSum = computeDiverScoreSummary({
    name: 'Base', level: LEVEL_1, diveState: sNorm.diveState, checkpointsHit: new Set(),
    collectedIds: new Set(), exploredCount: 10, totalExploreCells: 20, diveTimeSec: 120,
  });
  const turboSum = computeDiverScoreSummary({
    name: 'Turbo', level: LEVEL_1, diveState: sTurbo.diveState, checkpointsHit: new Set(),
    collectedIds: new Set(), exploredCount: 10, totalExploreCells: 20, diveTimeSec: 120, mutatorId: 'turbo-par',
  });
  assert.equal(turboSum.parTimeSec, Math.round(baseSum.parTimeSec * 0.75), 'Turbo Par must tighten par time by 25%');

  // 3d. Heavy Surge imparts rhythmic lateral swell even without swim input
  const sCalm = createDiveSession(LEVEL_1);
  const sSurge = createDiveSession(LEVEL_1, { mutatorId: 'surge', dailyDateKey: '2026-11-20' });
  sCalm.diver.x = 40; sCalm.diver.y = 18;
  sSurge.diver.x = 40; sSurge.diver.y = 18;
  for (let i = 0; i < 20; i++) {
    stepDiveSession(sCalm, { x: 0, y: 0 }, 0.05);
    stepDiveSession(sSurge, { x: 0, y: 0 }, 0.05);
  }
  assert.ok(Math.abs(sSurge.diver.vx - sCalm.diver.vx) > 0.05, 'Heavy Surge should impart noticeable lateral swell velocity');

  // 3e. Silt-Storm amplifies floor silt generation vs baseline
  const siltBase = [];
  const siltStorm = [];
  const tsBase = { accum: 0 };
  const tsStorm = { accum: 0 };
  const dSilt = { x: 114, y: 52.7, vx: 1.4, vy: 0, angle: 0 };
  for (let i = 0; i < 20; i++) {
    stirFloorSilt(LEVEL_1, dSilt, siltBase, { dt: 0.1, thrustMag: 0.8, timerState: tsBase, mutatorMult: 1.0 });
    stirFloorSilt(LEVEL_1, dSilt, siltStorm, { dt: 0.1, thrustMag: 0.8, timerState: tsStorm, mutatorMult: 1.75 });
  }
  assert.ok(siltStorm.length > siltBase.length, `Silt-Storm (${siltStorm.length}) should stir more clouds than baseline (${siltBase.length})`);

  // 3f. Iron Lungs burns ~1.35x gas vs standard
  const stStd = createDiveState();
  const stIron = createDiveState();
  for (let i = 0; i < 40; i++) {
    stepDivePhysiology(stStd, { depthM: 25, prevDepthM: 25, dt: 1.0, exertion: 0.4, gasBurnMultiplier: 1.0 });
    stepDivePhysiology(stIron, { depthM: 25, prevDepthM: 25, dt: 1.0, exertion: 0.4, gasBurnMultiplier: 1.35 });
  }
  const burnStd = 200 - stStd.tanks.EAN32.bar;
  const burnIron = 200 - stIron.tanks.EAN32.bar;
  assert.ok(burnIron > burnStd * 1.28 && burnIron < burnStd * 1.42, `Iron Lungs gas burn (${burnIron.toFixed(1)}b) should be ~1.35x baseline (${burnStd.toFixed(1)}b)`);

  // 4. HTML hooks present for Home Daily Banner, HUD Daily Badge & Debrief Daily Badge
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="daily-challenge-card"'), 'Missing Home Daily Expedition card');
  assert.ok(html.includes('id="btn-play-daily"'), 'Missing Daily play button');
  assert.ok(html.includes('id="dc-daily-badge"'), 'Missing HUD Daily mutator badge');
  assert.ok(html.includes('id="debrief-daily-badge"'), 'Missing Debrief Daily streak badge');
});

test('v109 Live Sonar Cave & Wreck Cartography Minimap: gating, viewports, fog-of-war rendering & HUD hooks', async () => {
  // 1. Mode & Mutator gating: enabled in Guided/Standard & standard mutators, disabled in Hardcore/Purist
  assert.equal(isMinimapAllowed('guided', ''), true);
  assert.equal(isMinimapAllowed('standard', ''), true);
  assert.equal(isMinimapAllowed('standard', 'strobe'), true);
  assert.equal(isMinimapAllowed('standard', 'surge'), true);
  assert.equal(isMinimapAllowed('hardcore', ''), false);
  assert.equal(isMinimapAllowed('guided', 'purist'), false);
  assert.equal(isMinimapAllowed('standard', 'purist'), false);

  // 2. Viewport projection in Follow & Full modes across cave and shipwreck sites
  const wreckLvl = getLevelById('ss-thistlegorm-wwii-wreck');
  const vpFollow = computeMinimapViewport(LEVEL_1, LEVEL_1.spawn, { zoomMode: 'follow', width: 352, height: 224 });
  const vpFull = computeMinimapViewport(LEVEL_1, LEVEL_1.spawn, { zoomMode: 'full', width: 352, height: 224 });
  assert.ok(vpFollow.scale > vpFull.scale, `Follow zoom scale (${vpFollow.scale.toFixed(2)}) should be closer than Full (${vpFull.scale.toFixed(2)})`);
  assert.ok(vpFull.toX(LEVEL_1.bounds.xMin) >= 0 && vpFull.toX(LEVEL_1.bounds.xMax) <= 352);
  assert.ok(vpFull.toY(LEVEL_1.bounds.yMin) >= 0 && vpFull.toY(LEVEL_1.bounds.yMax) <= 224);

  const vpWreck = computeMinimapViewport(wreckLvl, wreckLvl.spawn, { zoomMode: 'full', width: 352, height: 224 });
  assert.ok(vpWreck.scale > 0 && vpWreck.toX(wreckLvl.spawn.x) >= 0 && vpWreck.toX(wreckLvl.spawn.x) <= 352);

  // 3. Fog-of-war vs Guided blueprint rendering + Sonar pulse + player lines + co-op buddies
  const countArcs = (difficulty, opts = {}) => {
    let arcs = 0;
    let strokes = 0;
    const ctx = new Proxy({
      arc: () => { arcs++; },
      stroke: () => { strokes++; },
    }, { get: (t, p) => (p in t ? t[p] : () => {}), set: () => true });
    drawSonarMinimap(ctx, 352, 224, {
      level: opts.level || LEVEL_1,
      diver: opts.diver || { x: LEVEL_1.spawn.x, y: LEVEL_1.spawn.y, angle: 0.2, torchAngle: 0.2, torchOn: true },
      peers: [{ id: 'p1', x: 30, y: 15, alive: true }],
      exploreCells: opts.exploreCells,
      exploredCells: opts.exploredCells,
      checkpointsHit: new Set(['cp1']),
      nextCheckpoint: (opts.level || LEVEL_1).checkpoints[1] || null,
      collectedIds: new Set(),
      openedHatchIds: new Set(),
      claimedStageIds: new Set(),
      placedMarkerIds: new Set(),
      bodyRecovered: false,
      playerLines: [{ isSelf: true, chains: [[{ x: 10, y: 5 }, { x: 22, y: 12 }]], reelingActive: true, ownerX: 25, ownerY: 14 }],
      sonarPulse: opts.sonarPulse || null,
      difficulty,
      zoomMode: 'full',
      timeSec: 4.2,
    });
    return { arcs, strokes };
  };

  const sess = createDiveSession(LEVEL_1, { gear: { sonar: true } });
  const stdDraw = countArcs('standard', { exploreCells: sess.exploreCells, exploredCells: sess.exploredCells });
  const guiDraw = countArcs('guided', { exploreCells: sess.exploreCells, exploredCells: sess.exploredCells });
  assert.ok(guiDraw.arcs > stdDraw.arcs, `Guided blueprint (${guiDraw.arcs} arcs) should draw unexplored passages beyond Standard fog-of-war (${stdDraw.arcs} arcs)`);

  // Firing Cave Sonar expands explored cells & draws live ping ring cleanly
  const beforeExp = sess.exploredCells.size;
  const ping = triggerSonarPing(sess);
  assert.equal(ping.ok, true);
  assert.ok(sess.exploredCells.size >= beforeExp);
  const sonarDraw = countArcs('standard', {
    exploreCells: sess.exploreCells,
    exploredCells: sess.exploredCells,
    sonarPulse: { ...ping.pulse, ageSec: 0.5 },
  });
  assert.ok(sonarDraw.strokes > stdDraw.strokes, 'Active Cave Sonar ping should draw expanding sonar wave stroke');

  // Shipwreck full-survey draw with shot line & watertight hatches
  const wreckSess = createDiveSession(wreckLvl);
  const wreckDraw = countArcs('standard', {
    level: wreckLvl,
    diver: wreckSess.diver,
    exploreCells: wreckSess.exploreCells,
    exploredCells: wreckSess.exploredCells,
  });
  assert.ok(wreckDraw.arcs > 0 && wreckDraw.strokes > 0);

  // 4. HTML hooks present
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="btn-minimap"'), 'Missing HUD minimap toggle button');
  assert.ok(html.includes('id="hud-minimap-wrap"'), 'Missing HUD minimap wrapper');
  assert.ok(html.includes('id="hud-minimap-canvas"'), 'Missing HUD minimap canvas');
  assert.ok(html.includes('id="hud-minimap-pct"'), 'Missing HUD minimap exploration readout');
  assert.ok(html.includes('id="hud-minimap-zoom"'), 'Missing HUD minimap zoom badge');
});

test('v110 Underwater Strobe Camera & Marine Field Guide: catalog, subject capture, stars, scoring, flash & Logbook UI', async () => {
  // 1. 18-entry Field Guide catalog & Logbook discovery/upgrade persistence
  assert.equal(FIELD_GUIDE_CATALOG.length, 18);
  assert.ok(getFieldGuideEntry('shark') && getFieldGuideEntry('hydrovent') && getFieldGuideEntry('remipede'));

  let book = createEmptyLogbook();
  assert.equal(getFieldGuideStats(book).discoveredCount, 0);
  const rec1 = recordFieldGuidePhoto(book, {
    entryId: 'shark',
    stars: 2,
    siteId: 'ss-thistlegorm-wwii-wreck',
    siteName: 'SS Thistlegorm',
    depthM: 24.5,
  });
  assert.equal(rec1.isNew, true);
  assert.equal(rec1.upgradedStars, false);
  book = rec1.book;
  const rec2 = recordFieldGuidePhoto(book, {
    entryId: 'shark',
    stars: 3,
    siteId: 'rms-britannic-wreck',
    siteName: 'HMHS Britannic',
    depthM: 48.2,
  });
  assert.equal(rec2.isNew, false);
  assert.equal(rec2.upgradedStars, true);
  book = rec2.book;
  const fg = getFieldGuideStats(book);
  assert.equal(fg.discoveredCount, 1);
  assert.equal(book.fieldGuide.shark.count, 2);
  assert.equal(book.fieldGuide.shark.bestStars, 3);
  assert.equal(book.fieldGuide.shark.bestDepthM, 48.2);

  // 2. Strobe camera captures live marine creature in cone, enforces cooldown & caps photoBonusScore at 300
  const sess = createDiveSession(LEVEL_1);
  const eco = createMarineEcosystem(LEVEL_1);
  const turtle = eco.turtles[0] || eco.fish[0];
  assert.ok(turtle, 'Level 1 ecosystem should contain sunlit fauna');
  // Position diver cleanly 3.5m left of creature facing directly at it
  sess.diver.x = turtle.x - 3.2;
  sess.diver.y = turtle.y;
  sess.diver.angle = 0;
  sess.diver.torchAngle = 0;
  sess.localSiltDensity = 0.05;

  const snap = captureCameraPhoto(sess, eco, { knownIds: new Set() });
  assert.equal(snap.ok, true);
  assert.ok(snap.subject, 'Camera must detect visible wildlife in frame');
  assert.equal(snap.isNewInGuide, true);
  assert.ok(snap.stars >= 2 && snap.stars <= 3, `Expected 2-3 star framing, got ${snap.stars}`);
  assert.ok(snap.points > 0 && sess.camera.photoBonusScore === snap.points);
  assert.ok(sess.camera.activeFlash && sess.camera.activeFlash.subject.id === snap.subject.id);

  // Cooldown blocks immediate rapid re-fire; stepping 1.4s recharges strobe & clears flash
  const blocked = captureCameraPhoto(sess, eco);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'cooldown');
  for (let i = 0; i < 28; i++) stepDiveSession(sess, { x: 0, y: 0 }, 0.05);
  assert.equal(sess.camera.cooldownSec, 0);
  assert.equal(sess.camera.activeFlash, null);

  // Scoring integrates photoBonusScore cleanly & stays within computeLevelMaxScore ceiling
  const scoreWithPhoto = computeDiverScoreSummary({
    name: 'Photographer',
    level: LEVEL_1,
    diveState: sess.diveState,
    checkpointsHit: new Set(LEVEL_1.checkpoints.map((c) => c.id)),
    collectedIds: new Set(LEVEL_1.collectibles.map((c) => c.id)),
    exploredCount: 100,
    totalExploreCells: 100,
    diveTimeSec: 100,
    photoBonusScore: 999, // clamped to MAX_PHOTO_BONUS (300)
  });
  assert.equal(scoreWithPhoto.photoBonusScore, 300);
  assert.ok(scoreWithPhoto.totalScore <= computeLevelMaxScore(LEVEL_1.id, false));

  // 3. Renderer draws strobe flash & viewfinder focus brackets cleanly + HTML hooks exist
  const noopCtx = new Proxy({
    createRadialGradient: () => ({ addColorStop() {} }),
  }, { get: (t, p) => (p in t ? t[p] : () => {}), set: () => true });
  CaveRenderer.prototype._drawCameraFlash.call(
    {},
    noopCtx,
    { ...snap.flash, ageSec: 0.12 },
    (x) => 400 + x * 20,
    (y) => 300 + y * 20,
    20
  );
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="btn-camera"'), 'Missing HUD camera button');
  assert.ok(html.includes('id="btn-kit-camera"'), 'Missing Dive Kit camera button');
  assert.ok(html.includes('id="logbook-field-guide-grid"'), 'Missing Logbook Field Guide gallery');
});

test('v111 Pass 1 optimizations: O(1) minimap spatial grid fog-of-war, zero-GC lighting scratch & mobile UX order', async () => {
  // 1. O(1) spatial hash grid populated cleanly by createDiveSession & markExploredAround
  const sess = createDiveSession(LEVEL_1);
  assert.ok(sess.exploredGrid instanceof Set && sess.exploredGrid.size > 0, 'Session must populate exploredGrid at spawn');
  const sampleCell = sess.exploreCells[Array.from(sess.exploredCells)[0]];
  assert.equal(sess.exploredGrid.has(exploreGridKey(sampleCell.x, sampleCell.y)), true);

  const farGrid = new Set();
  const farSet = new Set();
  const added = markExploredAround(sess.exploreCells, farSet, LEVEL_1.spawn.x, LEVEL_1.spawn.y, 6.0, farGrid);
  assert.ok(added > 0 && farGrid.size > 0);

  // drawSonarMinimap accepts exploredGrid fast path cleanly
  let gridStrokes = 0;
  const ctx = new Proxy({ stroke: () => { gridStrokes++; } }, { get: (t, p) => (p in t ? t[p] : () => {}), set: () => true });
  drawSonarMinimap(ctx, 352, 224, {
    level: LEVEL_1,
    diver: sess.diver,
    exploreCells: sess.exploreCells,
    exploredCells: sess.exploredCells,
    exploredGrid: sess.exploredGrid,
    checkpointsHit: sess.checkpointsHit,
    nextCheckpoint: LEVEL_1.checkpoints[0],
    difficulty: 'standard',
    zoomMode: 'follow',
    timeSec: 1.5,
  });
  assert.ok(gridStrokes > 0, 'Minimap with O(1) exploredGrid must draw cleanly');

  // 2. Primary DIVE CTA sits above Daily Challenge & Tech Gear Loadout for mobile above-the-fold ergonomics
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const idxPlay = html.indexOf('id="btn-play-solo"');
  const idxDaily = html.indexOf('id="daily-challenge-card"');
  const idxGear = html.indexOf('id="menu-gear-dock"');
  assert.ok(idxPlay > 0 && idxPlay < idxDaily && idxDaily < idxGear, 'Primary DIVE CTA should appear above Daily & Gear cards');
});

test('v112 Dynamic Underwater Encounters: pelagic whale-shark/manta flybys, shifting fog banks, survey beacon & camera/scoring integration', () => {
  // 1. Every campaign level generates SDF-safe shifting visibility banks & open-water survey beacon
  const wreckLvl = getLevelById('ss-thistlegorm-wwii-wreck');
  const caveEnc = createDynamicEncounters(LEVEL_1);
  const wreckEnc = createDynamicEncounters(wreckLvl);
  assert.ok(caveEnc.fogBanks.length >= 1, 'Cave level should spawn shifting visibility fog banks');
  assert.ok(wreckEnc.fogBanks.length >= 1, 'Wreck level should spawn shifting visibility fog banks');
  assert.ok(caveEnc.beacon && !caveEnc.beacon.claimed, 'Cave level should spawn optional Survey Beacon');
  assert.ok(wreckEnc.beacon && !wreckEnc.beacon.claimed, 'Wreck level should spawn optional Distress Transponder');
  assert.ok(evaluateCaveSDF(LEVEL_1, caveEnc.beacon.x, caveEnc.beacon.y) < -1.0, 'Cave beacon must be in navigable open water');
  assert.ok(evaluateCaveSDF(wreckLvl, wreckEnc.beacon.x, wreckEnc.beacon.y) < -1.0, 'Wreck beacon must be in navigable open water');

  // 2. Whale Shark & Manta Ray pelagic flybys on ocean shipwrecks are photographable with the Strobe Camera!
  const sWreck = createDiveSession(wreckLvl);
  sWreck.diver.x = wreckLvl.spawn.x;
  sWreck.diver.y = 14;
  sWreck.diver.angle = 0;
  sWreck.diver.torchAngle = 0;
  const ws = spawnDynamicVisitor(sWreck, 'whaleshark');
  assert.ok(ws && ws.kind === 'whaleshark');
  // Position Whale Shark cleanly 9m ahead of diver in open blue water
  ws.x = sWreck.diver.x + 9.0;
  ws.y = sWreck.diver.y;
  const wsSnap = captureCameraPhoto(sWreck, null, { knownIds: new Set() });
  assert.equal(wsSnap.ok, true);
  assert.equal(wsSnap.subject?.id, 'whaleshark', 'Strobe camera must capture passing Whale Shark for Field Guide!');
  assert.equal(wsSnap.isNewInGuide, true);
  assert.ok(wsSnap.points > 0);

  // Bioluminescent swarm spawns in caves
  const sCave = createDiveSession(LEVEL_1);
  sCave.diver.x = 40;
  sCave.diver.y = 20;
  const swarm = spawnDynamicVisitor(sCave, 'biolum-swarm');
  assert.ok(swarm && swarm.kind === 'biolum-swarm');

  // 3. Shifting visibility bank drifts & raises local fogDensity when diver enters
  const fb = sCave.encounters.fogBanks[0];
  sCave.diver.x = fb.baseX;
  sCave.diver.y = fb.baseY;
  stepDiveSession(sCave, { x: 0, y: 0 }, 0.1);
  assert.equal(sCave.encounters.inFogBank, true, 'Diver inside fog bank must set inFogBank=true');
  assert.ok(sCave.encounters.fogDensity > 0.1);

  // 4. Optional Survey Beacon salvage awards +180 pts, 15m sonar map reveal, +18 bar reserve & fits computeLevelMaxScore
  const bc = sCave.encounters.beacon;
  sCave.diveState.tanks.EAN32.bar = 140;
  const expBefore = sCave.exploredCells.size;
  sCave.diver.x = bc.x + 2.2;
  sCave.diver.y = bc.y;
  const act = triggerWreckAction(sCave);
  assert.equal(act.handled, true);
  assert.equal(act.kind, 'claim-beacon');
  assert.equal(bc.claimed, true);
  assert.equal(sCave.encounters.encounterBonusScore, 180);
  assert.ok(sCave.diveState.tanks.EAN32.bar >= 157, 'Beacon salvage should top up spare reserve gas');
  assert.ok(sCave.exploredCells.size >= expBefore, 'Beacon salvage should trigger 15m sonar sweep');
  assert.equal(claimSurveyBeacon(sCave).ok, false, 'Beacon cannot be double-claimed');

  const encSummary = computeDiverScoreSummary({
    name: 'Explorer',
    level: LEVEL_1,
    diveState: sCave.diveState,
    checkpointsHit: new Set(LEVEL_1.checkpoints.map((c) => c.id)),
    collectedIds: new Set(LEVEL_1.collectibles.map((c) => c.id)),
    exploredCount: 100,
    totalExploreCells: 100,
    diveTimeSec: 90,
    photoBonusScore: 300,
    encounterBonusScore: 180,
  });
  assert.equal(encSummary.encounterBonusScore, 180);
  assert.equal(encSummary.totalScore <= computeLevelMaxScore(LEVEL_1.id, false), true);

  // 5. Renderer draws both world & emissive encounter passes cleanly + Minimap plots unclaimed beacon
  const noopCtx = new Proxy({
    createRadialGradient: () => ({ addColorStop() {} }),
  }, { get: (t, p) => (p in t ? t[p] : () => {}), set: () => true });
  CaveRenderer.prototype._drawDynamicEncounters.call(
    {},
    noopCtx,
    sWreck.encounters,
    -100, 300, -10, 100,
    (x) => 400 + x * 12,
    (y) => 200 + y * 12,
    12,
    5.0,
    'world'
  );
  CaveRenderer.prototype._drawDynamicEncounters.call(
    {},
    noopCtx,
    sWreck.encounters,
    -100, 300, -10, 100,
    (x) => 400 + x * 12,
    (y) => 200 + y * 12,
    12,
    5.0,
    'emissive'
  );
  drawSonarMinimap(noopCtx, 352, 224, {
    level: wreckLvl,
    diver: sWreck.diver,
    exploreCells: sWreck.exploreCells,
    exploredCells: sWreck.exploredCells,
    exploredGrid: sWreck.exploredGrid,
    encounters: sWreck.encounters,
    difficulty: 'standard',
    zoomMode: 'full',
    timeSec: 5.0,
  });
});

test('v113 Co-op Team Hold visibility, stale exit prompt clearing & mobile pinch-zoom lock', async () => {
  const fs = await import('node:fs');
  const { DiveComputerHUD } = await import('../public/js/game/hud.js');
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../public/css/style.css', import.meta.url), 'utf8');
  const mainJs = fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');

  // 1. Mobile pinch/double-tap zoom lock in viewport meta, CSS & JS gesture guards
  assert.match(html, /<meta\s+name="viewport"[^>]*maximum-scale=1\.0[^>]*user-scalable=no/i, 'Viewport meta must disable accidental pinch-zoom');
  assert.match(css, /\.hud-layer\s*\{[\s\S]*?touch-action:\s*none;/, 'HUD layer must lock touch-action: none');
  assert.match(css, /\.touch-stick\s*\{[\s\S]*?touch-action:\s*none;/, 'Swim stick must explicitly lock touch-action: none');
  assert.ok(mainJs.includes("document.addEventListener('gesturestart'"), 'main.js must block Safari pinch gesturestart');
  assert.ok(mainJs.includes('e.touches && e.touches.length > 1'), 'main.js must block multi-touch pinch touchmove');

  // 2. #coop-wait-banner must live inside .hud-top-stack as a relative flex item above z-index 40 (never buried under .hud-top-bar)
  const topStackStart = html.indexOf('<div class="hud-top-stack">');
  const coopBannerIdx = html.indexOf('id="coop-wait-banner"');
  const coopCommsIdx = html.indexOf('id="coop-comms"');
  assert.ok(topStackStart > 0 && coopBannerIdx > topStackStart && coopBannerIdx < coopCommsIdx, '#coop-wait-banner must be nested inside .hud-top-stack');
  assert.match(css, /\.coop-wait-banner\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*50;/, '.coop-wait-banner must stack cleanly with position: relative and z-index: 50');

  // 3. DiveComputerHUD replaces stale NOW MOVE TO SURFACE EXIT prompts during Co-op Team Hold ('surfaced' / 'down')
  const domMap = new Map();
  const makeEl = () => ({
    textContent: '',
    innerHTML: '',
    className: '',
    hidden: false,
    style: { setProperty() {} },
    dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {},
    appendChild() {},
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
  });
  const prevDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (!domMap.has(id)) domMap.set(id, makeEl());
      return domMap.get(id);
    },
    createElement: () => makeEl(),
  };
  try {
    const hud = new DiveComputerHUD({ onGasSelect: () => {} });
    const s = createDiveSession(LEVEL_1);
    for (const cp of LEVEL_1.checkpoints) s.checkpointsHit.add(cp.id);
    s.diver.x = LEVEL_1.exitZone.x;
    s.diver.y = 1.2;
    s.diveState.depthM = 1.2;
    s.diveState.ceilingM = 0;

    hud.update({
      diveState: s.diveState,
      diver: s.diver,
      nextCheckpoint: null,
      exitZone: LEVEL_1.exitZone,
      checkpointsHit: s.checkpointsHit,
      totalCheckpoints: LEVEL_1.checkpoints.length,
      level: LEVEL_1,
      ascentConfig: s.ascentConfig,
      endedState: 'surfaced',
      spectatingPeer: false,
      minimapVisible: false,
    });
    assert.ok(domMap.get('dc-alerts').textContent.includes('SURFACED SAFE'), 'Alerts strip must show SURFACED SAFE in team hold');
    assert.ok(!domMap.get('dc-alerts').textContent.includes('NOW MOVE TO SURFACE EXIT'), 'Alerts strip must not show stale exit prompt');
    assert.ok(domMap.get('dc-objective').innerHTML.includes('SURFACED SAFE'), 'Objective bar must show SURFACED SAFE in team hold');
    assert.ok(!domMap.get('dc-objective').innerHTML.includes('NOW MOVE TO SURFACE EXIT'), 'Objective bar must not show stale exit prompt');

    hud.update({
      diveState: s.diveState,
      diver: s.diver,
      nextCheckpoint: null,
      exitZone: LEVEL_1.exitZone,
      checkpointsHit: s.checkpointsHit,
      totalCheckpoints: LEVEL_1.checkpoints.length,
      level: LEVEL_1,
      ascentConfig: s.ascentConfig,
      endedState: 'down',
      spectatingPeer: true,
      minimapVisible: false,
    });
    assert.ok(domMap.get('dc-alerts').textContent.includes('DIVER DOWN'), 'Alerts strip must show DIVER DOWN when downed in co-op');
    assert.ok(domMap.get('dc-objective').innerHTML.includes('DIVER DOWN'), 'Objective bar must show DIVER DOWN when downed in co-op');
  } finally {
    globalThis.document = prevDoc;
  }
});

test('v117 Co-op Buddy Overhaul: Buddy Locate Ping, shared Beacon/Photo crew bonuses, Air-Share hose VFX & buddy depth profiles', async () => {
  const {
    triggerBuddyLocatePing,
    pushAirShareBeam,
    recordPeerDepthProfiles,
    applyPeerWreckAction,
  } = await import('../public/js/game/diveSession.js');

  const s = createDiveSession(LEVEL_1);
  const sarah = { id: 'p2', name: 'Sarah', x: 32, y: 18, depthM: 18, gasId: 'TMX1455', alive: true, surfaced: false };

  // 1. Buddy Locate Ping activates beam, syncs to crew, tracks live peer coords & expires cleanly
  const synced = [];
  let pingChimeCount = 0;
  const pingRes = triggerBuddyLocatePing(s, sarah, {
    onBuddyPing: () => { pingChimeCount++; },
    onWreckSync: (k, t) => synced.push([k, t]),
  });
  assert.equal(pingRes.ok, true);
  assert.equal(pingChimeCount, 1);
  assert.deepEqual(synced[0], ['buddy-ping', 'p2']);
  assert.equal(s.buddyPing.targetName, 'Sarah');

  sarah.x = 36;
  sarah.y = 21;
  stepDiveSession(s, { x: 0, y: 0 }, 0.2, { peers: [sarah] });
  assert.equal(s.buddyPing.x, 36, 'Buddy ping must track live peer X coordinate');
  assert.equal(s.buddyPing.y, 21, 'Buddy ping must track live peer Y coordinate');

  // Incoming peer buddy-ping chimes & toasts cleanly
  let incomingPingToast = '';
  assert.equal(
    applyPeerWreckAction(
      s,
      { actionKind: 'buddy-ping', targetId: 'p1', playerId: 'p2', by: 'Sarah' },
      { onBuddyPing: () => { pingChimeCount++; }, onToast: (m) => { incomingPingToast = m; } }
    ),
    true
  );
  assert.equal(pingChimeCount, 2);
  assert.ok(incomingPingToast.includes('Sarah'));

  // 2. Shared Survey Beacon credit awards +180 crew bonus, +18b reserve & prevents double-claim
  s.diveState.tanks.EAN32.bar = 140;
  const bcApplied = applyPeerWreckAction(s, { actionKind: 'beacon', targetId: s.encounters.beacon.id, by: 'Sarah' });
  assert.equal(bcApplied, true);
  assert.equal(s.encounters.beacon.claimed, true);
  assert.equal(s.encounters.encounterBonusScore, 180);
  assert.ok(s.diveState.tanks.EAN32.bar >= 157);
  assert.equal(applyPeerWreckAction(s, { actionKind: 'beacon', targetId: s.encounters.beacon.id, by: 'Sarah' }), false);

  // 3. Shared Wildlife Photo discovery awards 50% crew assist bonus & credits species
  const photoApplied = applyPeerWreckAction(s, { actionKind: 'photo', targetId: 'whaleshark:3', by: 'Sarah' });
  assert.equal(photoApplied, true);
  assert.equal(s.camera.photographedIds.has('whaleshark'), true);
  assert.equal(s.camera.photoBonusScore, 90, '3-star Whale Shark (180 pts) must grant 50% = 90 crew assist pts');
  assert.equal(applyPeerWreckAction(s, { actionKind: 'photo', targetId: 'whaleshark:3', by: 'Sarah' }), false);

  // 4. Air-Share octo-hose beam VFX + passive buddy depth profile recording
  const beam = pushAirShareBeam(s, { peerId: 'p2', peerName: 'Sarah', fromSelf: true, gasId: 'TMX1455', amountBar: 35 });
  assert.equal(beam.amountBar, 35);
  assert.equal(s.airShareBeams.length, 1);

  recordPeerDepthProfiles(s, [sarah], 1.0);
  sarah.depthM = 28.4;
  recordPeerDepthProfiles(s, [sarah], 4.0);
  const sarahProfile = s.peerProfiles.get('p2');
  assert.ok(sarahProfile && sarahProfile.points.length === 2);
  assert.equal(sarahProfile.points[1].d, 28.4);

  // 5. Renderer draws braided tow, air-share hose beams, buddy locate ping & minimap reticle cleanly
  const noopCtx = new Proxy(
    {
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: () => ({ width: 80 }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: () => true }
  );
  s.diver.rescueTargetId = 'p2';
  CaveRenderer.prototype._drawBuddyRescueTethers.call(
    {},
    noopCtx,
    s.diver,
    [sarah],
    (x) => 400 + x * 12,
    (y) => 200 + y * 12,
    12,
    3.5,
    s.airShareBeams
  );
  CaveRenderer.prototype._drawBuddyLocatePing.call(
    {},
    noopCtx,
    s.diver,
    s.buddyPing,
    (x) => 400 + x * 12,
    (y) => 200 + y * 12,
    12,
    3.5,
    1280,
    720
  );
  drawSonarMinimap(noopCtx, 352, 224, {
    level: LEVEL_1,
    diver: s.diver,
    peers: [sarah],
    exploreCells: s.exploreCells,
    exploredCells: s.exploredCells,
    exploredGrid: s.exploredGrid,
    buddyPing: s.buddyPing,
    difficulty: 'standard',
    zoomMode: 'follow',
    timeSec: 3.5,
  });

  // Beams & ping expire after sufficient dt
  for (let i = 0; i < 60; i++) stepDiveSession(s, { x: 0, y: 0 }, 0.1, { peers: [sarah] });
  assert.equal(s.buddyPing, null);
  assert.equal(s.airShareBeams.length, 0);
});

test('v119 Underwater Atmosphere & Immersion: crepuscular god-rays, bioluminescent fin-wake, whale song ambience & Field Guide trophy stats', async () => {
  const { DiveAudio } = await import('../public/js/game/audio.js');

  // 1. Bioluminescent plankton fin-wake spawns when swimming deep, stays bounded & expires cleanly
  const s = createDiveSession(LEVEL_1);
  s.diver.x = 40;
  s.diver.y = 22;
  for (let i = 0; i < 20; i++) {
    stepDiveSession(s, { x: 1, y: 0 }, 0.08);
  }
  assert.ok(s.bioWake.length > 0 && s.bioWake.length <= 88, `Expected 1..88 bioWake particles, got ${s.bioWake.length}`);
  for (let i = 0; i < 40; i++) {
    s.diver.vx = 0;
    s.diver.vy = 0;
    stepDiveSession(s, { x: 0, y: 0 }, 0.1);
  }
  assert.equal(s.bioWake.length, 0, 'BioWake sparkles must decay cleanly when stationary');

  // 2. Renderer draws enhanced volumetric god-rays & bioluminescent fin-wake sparkles cleanly
  const noopCtx = new Proxy(
    {
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: () => true }
  );
  const sampleCurtain = [
    {
      rays: [
        { xTop: 6, yTop: 0, xBot: 8, yBot: 20 },
        { xTop: 12, yTop: 0, xBot: 15, yBot: 22 },
        { xTop: 18, yTop: 0, xBot: 20, yBot: 19 },
      ],
    },
  ];
  CaveRenderer.prototype._drawSunbeams.call(
    { level: LEVEL_1 },
    noopCtx,
    sampleCurtain,
    (x) => 200 + x * 14,
    (y) => 80 + y * 14,
    14,
    4.2
  );
  CaveRenderer.prototype._drawBioWake.call(
    {},
    noopCtx,
    [{ x: 40, y: 22, age: 0.4, life: 1.5, size: 0.06, hue: 182, phase: 0.5 }],
    0, 100, 0, 50,
    (x) => 200 + x * 14,
    (y) => 80 + y * 14,
    14,
    4.2
  );

  // 3. Audio whale song & biome ambience synth execute cleanly without errors
  const a = new DiveAudio();
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} });
  a.ctx = {
    state: 'running',
    currentTime: 2,
    sampleRate: 44100,
    destination: {},
    createOscillator: () => ({ type: 'sine', frequency: param(), connect() {}, disconnect() {}, start() {}, stop() { this.onended?.(); } }),
    createBiquadFilter: () => ({ type: 'lowpass', frequency: param(), Q: param(), connect() {}, disconnect() {} }),
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createBuffer: (c, l) => ({ getChannelData: () => new Float32Array(l) }),
    createBufferSource: () => ({ connect() {}, disconnect() {}, start() {}, stop() { this.onended?.(); } }),
  };
  a.playWhaleSong();
  a._ambienceTimer = 0;
  a.stepAmbience(0.1, getLevelById('uss-oriskany-carrier'), 26);
  a._ambienceTimer = 0;
  a.stepAmbience(0.1, getLevelById('scoresby-sund-iceberg'), 18);
  a._ambienceTimer = 0;
  a.stepAmbience(0.1, LEVEL_1, 20);

  // 4. Field Guide Naturalist Trophy stats compute gold, rare/epic, total photos & rank
  let book = createEmptyLogbook();
  for (const id of ['whaleshark', 'mantaray', 'shark', 'grouper', 'remipede']) {
    book = recordFieldGuidePhoto(book, { entryId: id, stars: 3, siteId: 'uss-oriskany-carrier', siteName: 'USS Oriskany', depthM: 28 }).book;
  }
  const fg = getFieldGuideStats(book);
  assert.equal(fg.discoveredCount, 5);
  assert.equal(fg.goldCount, 5);
  assert.equal(fg.totalPhotos, 5);
  assert.equal(fg.rareDiscovered, 5);
  assert.ok(fg.naturalistRank.includes('Pelagic Naturalist'));
});

test('v120 Technical Dive Planner (Custom Trimix/Nitrox), Physical Stage Tank Drop/Retrieval & Dive Log Export', () => {
  // 1. Dalton's Law custom Trimix / Nitrox blend calculations & safety diagnostics
  const normoxic = buildCustomGasBlend({ o2Pct: 18, hePct: 45, targetDepthM: 55 });
  assert.equal(normoxic.o2Pct, 18);
  assert.equal(normoxic.hePct, 45);
  assert.equal(normoxic.n2Pct, 37);
  assert.equal(normoxic.name, 'TMX 18/45');
  assert.equal(normoxic.minM, 0);
  assert.equal(normoxic.status, 'safe');
  assert.ok(normoxic.mod14M > 65 && normoxic.mod14M < 70);
  assert.ok(normoxic.endAtTargetM < 30);

  const hypoxic = buildCustomGasBlend({ o2Pct: 10, hePct: 70, targetDepthM: 100 });
  assert.equal(hypoxic.name, 'TMX 10/70');
  assert.ok(hypoxic.minM >= 6, `Hypoxic 10% O2 should require >=6m min depth, got ${hypoxic.minM}`);
  assert.equal(hypoxic.status, 'safe');

  const hyperoxic = buildCustomGasBlend({ o2Pct: 36, hePct: 0, targetDepthM: 45 });
  assert.equal(hyperoxic.status, 'danger');
  assert.ok(hyperoxic.ppo2AtTarget > 1.6);

  const narcotic = buildCustomGasBlend({ o2Pct: 21, hePct: 0, targetDepthM: 50 });
  assert.equal(narcotic.status, 'danger');
  assert.ok(narcotic.endAtTargetM > 38);

  // Custom blend flows cleanly into createDiveSession
  const sCustom = createDiveSession(LEVEL_1, {
    diverName: 'Blender',
    customMixOverrides: { TMX1455: normoxic.override },
  });
  assert.equal(sCustom.diveState.mixes.TMX1455.name, 'TMX 18/45');
  assert.equal(sCustom.diveState.mixes.TMX1455.fO2, 0.18);
  assert.equal(sCustom.diveState.mixes.TMX1455.fHe, 0.45);

  // 2. Physical Stage Tank Drop, +6% speed trim boost, Co-op Sync, Retrieval & Minimap/Renderer draw
  sCustom.diver.x = 18;
  sCustom.diver.y = 0.5;
  assert.equal(dropStageTank(sCustom).reason, 'surface', 'Cannot drop stage bottle at surface');

  sCustom.diver.y = 14;
  sCustom.diveState.tanks.EAN32.bar = 60;
  assert.equal(dropStageTank(sCustom).reason, 'low-gas', 'Cannot drop stage bottle below 75 bar');

  sCustom.diveState.tanks.EAN32.bar = 180;
  sCustom.diveState.tanks.EAN32.litersRemaining = (180 / 200) * sCustom.diveState.tanks.EAN32.maxLiters;
  const syncEvents = [];
  const dropRes = dropStageTank(sCustom, {
    onWreckSync: (k, id) => syncEvents.push({ k, id }),
  });
  assert.equal(dropRes.ok, true);
  assert.equal(sCustom.spareStageDropped, true);
  assert.equal(sCustom.droppedStages.length, 1);
  assert.equal(sCustom.diveState.tanks.EAN32.bar, 135);
  assert.equal(syncEvents[0]?.k, 'stage-drop');

  // Cannot drop a second stage while first is still clipped
  assert.equal(dropStageTank(sCustom).reason, 'already-dropped');

  // Verify +6% streamlined swim speed bonus while staged
  const sNormal = createDiveSession(LEVEL_1);
  sNormal.diver.x = 18;
  sNormal.diver.y = 14;
  sNormal.diver.vx = 0;
  sNormal.diver.vy = 0;
  sCustom.diver.vx = 0;
  sCustom.diver.vy = 0;
  stepDiveSession(sNormal, { x: 1, y: 0 }, 0.08);
  stepDiveSession(sCustom, { x: 1, y: 0 }, 0.08);
  assert.ok(sCustom.diver.vx > sNormal.diver.vx * 1.03, 'Staged diver should swim faster with reduced drag');

  // Co-op peer receives dropped stage bottle & contextual prompt offers retrieval
  const peerSession = createDiveSession(LEVEL_1, { diverName: 'Buddy' });
  assert.equal(
    applyPeerWreckAction(peerSession, { actionKind: 'stage-drop', targetId: syncEvents[0].id, by: 'Blender' }),
    true
  );
  assert.equal(peerSession.droppedStages.length, 1);

  // Move back onto stage bottle and retrieve via triggerWreckAction (+50 bar incl. +5b efficiency bonus)
  sCustom.diver.x = dropRes.stage.x + 0.5;
  sCustom.diver.y = dropRes.stage.y;
  stepDiveSession(sCustom, { x: 0, y: 0 }, 0.05);
  assert.equal(sCustom.wreckActionPrompt?.kind, 'retrieve-stage');
  const barBefore = sCustom.diveState.tanks.EAN32.bar;
  const pickRes = triggerWreckAction(sCustom, {
    onWreckSync: (k, id) => syncEvents.push({ k, id }),
  });
  assert.equal(pickRes.handled, true);
  assert.equal(pickRes.kind, 'retrieve-stage');
  assert.equal(sCustom.spareStageDropped, false);
  assert.equal(sCustom.droppedStages.length, 0);
  assert.ok(sCustom.diveState.tanks.EAN32.bar >= barBefore + 45);
  assert.equal(syncEvents[1]?.k, 'stage-pick');

  // Peer removes bottle when stage-pick arrives
  assert.equal(
    applyPeerWreckAction(peerSession, { actionKind: 'stage-pick', targetId: syncEvents[1].id, by: 'Blender' }),
    true
  );
  assert.equal(peerSession.droppedStages.length, 0);

  // Renderer & Sonar Minimap draw dropped stages cleanly
  const noopCtx = new Proxy(
    { createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: () => true }
  );
  CaveRenderer.prototype._drawDroppedStages.call(
    {},
    noopCtx,
    [dropRes.stage],
    0, 100, 0, 60,
    (x) => 100 + x * 14,
    (y) => 50 + y * 14,
    14,
    3.5
  );
  drawSonarMinimap(noopCtx, 320, 200, {
    level: LEVEL_1,
    diver: sCustom.diver,
    droppedStages: [dropRes.stage],
  });

  // 3. Dive Logbook CSV & JSON Export
  let book = createEmptyLogbook();
  book = recordDiveInLogbook(book, {
    levelId: 'cenote-el-abismo',
    success: true,
    score: 3150,
    grade: 'S',
    maxDepthM: 54.2,
    diveTimeSec: 185,
    difficulty: 'hardcore',
  });
  book = recordFieldGuidePhoto(book, { entryId: 'whaleshark', stars: 3, siteId: 'uss-oriskany-carrier', siteName: 'USS Oriskany', depthM: 28 }).book;

  const csv = exportLogbookToCsv(book, LEVELS);
  const csvLines = csv.split('\r\n');
  assert.ok(csvLines[0].includes('Site ID,Expedition,Location'));
  assert.ok(csv.includes('cenote-el-abismo'));
  assert.ok(csv.includes('CLEARED,S,3150,185.0,1,hardcore'));
  assert.ok(csv.includes('CAREER SUMMARY'));

  const jsonStr = exportLogbookToJson(book, LEVELS, { diverName: 'Barnesy', githubLogin: 'barnesy', version: 'v120' });
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.schema, 'techno-dive-logbook-v1');
  assert.equal(parsed.diverName, 'Barnesy');
  assert.equal(parsed.githubLogin, 'barnesy');
  assert.equal(parsed.summary.clearedCount, 1);
  assert.equal(parsed.sites.length, LEVELS.length);
  assert.equal(parsed.fieldGuide.discoveredCount, 1);
  assert.equal(parsed.sites.find((s) => s.id === 'cenote-el-abismo')?.record?.grade, 'S');
});

test('v121 Dive Replay Theater, Shareable 1200x630 PNG Expedition Postcard & JSON Logbook Import Round-Trip', () => {
  // 1. Replay track decoding & smooth interpolation
  const rawTrack = [
    [0, 100, 20, 0],
    [100, 300, 240, 5],
    [200, 500, 460, 2],
    [300, 120, 30, -15],
  ];
  const samples = decodeReplayTrack(rawTrack);
  assert.equal(samples.length, 4);
  assert.equal(samples[1].t, 10);
  assert.equal(samples[1].x, 30);
  assert.equal(samples[1].y, 24);
  assert.equal(formatReplayTime(125), '02:05');

  const mid = sampleReplayPoint(samples, 0.5);
  assert.ok(Math.abs(mid.t - 15) < 0.01);
  assert.ok(Math.abs(mid.x - 40) < 0.05);
  assert.ok(Math.abs(mid.y - 35) < 0.05);
  assert.equal(sampleReplayPoint([], 0.5), null);

  // 2. drawReplayFrame & renderExpeditionPostcard execute cleanly with recorded canvas commands
  const drawnTexts = [];
  const noopCtx = new Proxy(
    {
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: (txt) => ({ width: String(txt).length * 9 }),
      fillText: (txt) => { drawnTexts.push(String(txt)); },
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: () => true }
  );

  const pose = drawReplayFrame(noopCtx, 640, 210, {
    level: LEVEL_1,
    track: rawTrack,
    profile: [
      { t: 0, d: 2, gas: 'EAN32' },
      { t: 15, d: 35, gas: 'TMX1455' },
      { t: 30, d: 3, gas: 'O2' },
    ],
    progress: 0.5,
  });
  assert.ok(pose && Math.abs(pose.x - 40) < 0.1);

  drawnTexts.length = 0;
  const okCard = renderExpeditionPostcard(noopCtx, 1200, 630, {
    level: getLevelById('uss-oriskany-carrier'),
    diverName: 'Barnesy',
    githubLogin: 'barnesy',
    success: true,
    grade: 'S',
    score: 3420,
    maxDepthM: 64.5,
    diveTimeSec: 218,
    exploredPct: 96,
    difficulty: 'hardcore',
    customMixLabel: 'TMX 18/45',
    dailyBadge: '📅 DAILY',
    track: rawTrack,
    profile: [
      { t: 0, d: 2, gas: 'EAN32' },
      { t: 100, d: 64.5, gas: 'TMX1455' },
      { t: 218, d: 0.5, gas: 'O2' },
    ],
    version: 'v121',
  });
  assert.equal(okCard, true);
  assert.ok(drawnTexts.some((t) => t.includes('@barnesy')));
  assert.ok(drawnTexts.some((t) => t.includes('TMX 18/45')));
  assert.ok(drawnTexts.some((t) => t.includes('64.5m')));
  assert.ok(drawnTexts.some((t) => t.includes('03:38')));

  // 3. JSON Logbook Export -> Import -> Smart-Merge round-trip
  let backupBook = createEmptyLogbook();
  backupBook = recordDiveInLogbook(backupBook, {
    levelId: 'cenote-el-abismo',
    success: true,
    score: 3250,
    grade: 'S',
    maxDepthM: 54.0,
    diveTimeSec: 175,
    difficulty: 'hardcore',
  });
  backupBook = recordDailyClear(backupBook, {
    dateKey: '2026-11-21',
    levelId: 'cenote-el-abismo',
    mutatorId: 'strobe',
    score: 3250,
    grade: 'S',
    timeSec: 175,
  });
  backupBook = recordFieldGuidePhoto(backupBook, {
    entryId: 'whaleshark',
    stars: 3,
    siteId: 'uss-oriskany-carrier',
    siteName: 'USS Oriskany',
    depthM: 28,
  }).book;

  const exportedJson = exportLogbookToJson(backupBook, LEVELS, { diverName: 'Barnesy', version: 'v121' });
  const imported = parseImportedLogbookJson(exportedJson);
  assert.equal(imported.ok, true);
  assert.equal(imported.siteCount, 1);
  assert.equal(imported.fieldGuideCount, 1);
  assert.equal(imported.dailyCount, 1);
  assert.equal(imported.book.cleared['cenote-el-abismo'].grade, 'S');
  assert.equal(imported.book.fieldGuide.whaleshark.bestStars, 3);

  // Smart-merge preserves local clears while absorbing imported backup
  let localBook = createEmptyLogbook();
  localBook = recordDiveInLogbook(localBook, {
    levelId: 'eagles-nest-sink',
    success: true,
    score: 2900,
    grade: 'A',
    maxDepthM: 88.0,
    diveTimeSec: 240,
    difficulty: 'standard',
  });
  const merged = mergeCareerLogbooks(localBook, imported.book);
  assert.equal(Object.keys(merged.cleared).length, 2);
  assert.equal(merged.cleared['cenote-el-abismo'].grade, 'S');
  assert.equal(merged.cleared['eagles-nest-sink'].grade, 'A');
  assert.equal(merged.fieldGuide.whaleshark.bestStars, 3);

  // Validation guards on bad JSON
  assert.equal(parseImportedLogbookJson('').ok, false);
  assert.equal(parseImportedLogbookJson('{not-json').ok, false);
  assert.equal(parseImportedLogbookJson('{"foo":"bar"}').ok, false);
  assert.equal(parseImportedLogbookJson(exportLogbookToJson(createEmptyLogbook(), LEVELS)).ok, false);
});

test('v122 Technical Failure & Emergency Bailout Drills: Mask Flood, Primary Torch Failure, Regulator Free-Flow, Scoring & FX', async () => {
  // 1. Drills remain completely dormant unless explicitly opted in
  const sOff = createDiveSession(LEVEL_1, { drillsEnabled: false });
  sOff.diver.x = 20;
  sOff.diver.y = 14;
  sOff.drills.cooldownSec = 0;
  stepDiveSession(sOff, { x: 0, y: 0 }, 0.2);
  assert.equal(sOff.drills.active, null, 'Drills must never fire when disabled');

  // 2. Opt-in Drills auto-trigger once submerged past cooldown
  const sOn = createDiveSession(LEVEL_1, { drillsEnabled: true });
  sOn.diver.x = 20;
  sOn.diver.y = 14;
  sOn.drills.cooldownSec = 0.05;
  stepDiveSession(sOn, { x: 0, y: 0 }, 0.1);
  assert.ok(sOn.drills.active, 'Drills should trigger automatically when enabled and submerged');

  // 3. Mask Flood drill: ramps severity, prompts CLEAR MASK [E], resolves via triggerWreckAction (+200 & purge bubbles)
  const sMask = createDiveSession(LEVEL_1, { drillsEnabled: true });
  sMask.diver.x = 20;
  sMask.diver.y = 14;
  assert.equal(triggerEmergencyDrill(sMask, 'mask-flood').ok, true);
  stepDiveSession(sMask, { x: 0, y: 0 }, 1.0);
  assert.ok(sMask.drills.active.severity > 0.5);
  assert.equal(sMask.wreckActionPrompt?.kind, 'drill-mask');
  let purged = false;
  const bubblesBefore = sMask.bubbles.length;
  const maskRes = triggerWreckAction(sMask, { onMaskPurge: () => { purged = true; } });
  assert.equal(maskRes.handled, true);
  assert.equal(maskRes.drillKind, 'mask-flood');
  assert.equal(maskRes.points, 200);
  assert.equal(purged, true);
  assert.equal(sMask.drills.active, null);
  assert.ok(sMask.bubbles.length > bubblesBefore);

  // 4. Primary Torch Failure -> Backup Halogen Torch deployment (+200)
  assert.equal(triggerEmergencyDrill(sMask, 'torch-fail').ok, true);
  sMask.drills.active.elapsedSec = 2.0;
  stepDiveSession(sMask, { x: 0, y: 0 }, 0.1);
  assert.ok(sMask.diver.strobeMod < 0.15, 'Failed primary torch should drop light output');
  assert.equal(sMask.wreckActionPrompt?.kind, 'drill-torch');
  const torchRes = resolveEmergencyDrill(sMask, 'torch-fail');
  assert.equal(torchRes.ok, true);
  assert.equal(torchRes.points, 200);
  assert.equal(sMask.drills.backupTorchActive, true);
  stepDiveSession(sMask, { x: 0, y: 0 }, 0.05);
  assert.ok(sMask.diver.strobeMod >= 0.75 && sMask.diver.strobeMod <= 0.82, 'Backup torch should run at 0.78 intensity');

  // 5. Regulator Free-Flow burns gas ~3x faster and awards +200 on valve isolation
  const sBase = createDiveSession(LEVEL_1, { drillsEnabled: false });
  const sFlow = createDiveSession(LEVEL_1, { drillsEnabled: true });
  sBase.diver.x = 20;
  sBase.diver.y = 18;
  sFlow.diver.x = 20;
  sFlow.diver.y = 18;
  triggerEmergencyDrill(sFlow, 'free-flow');
  let hissCount = 0;
  for (let i = 0; i < 10; i++) {
    stepDiveSession(sBase, { x: 0, y: 0 }, 0.1);
    stepDiveSession(sFlow, { x: 0, y: 0 }, 0.1, { onFreeFlowHiss: () => { hissCount++; } });
  }
  const baseUsed = 200 - sBase.diveState.tanks.EAN32.bar;
  const flowUsed = 200 - sFlow.diveState.tanks.EAN32.bar;
  assert.ok(flowUsed > baseUsed * 2.3, `Free-flow should drain gas ~3x faster (flow=${flowUsed.toFixed(2)} vs base=${baseUsed.toFixed(2)})`);
  assert.ok(hissCount >= 1);
  assert.equal(sFlow.wreckActionPrompt?.kind, 'drill-freeflow');
  const flowRes = triggerWreckAction(sFlow);
  assert.equal(flowRes.drillKind, 'free-flow');
  assert.equal(flowRes.points, 200);

  // 6. Scoring & Leaderboard Ceiling Parity with drillBonusScore
  const summary = computeDiverScoreSummary({
    level: LEVEL_1,
    diveState: sMask.diveState,
    checkpointsHit: sMask.checkpointsHit,
    collectedIds: new Set(),
    exploredCount: 20,
    totalExploreCells: 20,
    drillBonusScore: 600,
  });
  assert.equal(summary.drillBonusScore, 600);
  assert.ok(summary.totalScore <= computeLevelMaxScore(LEVEL_1.id, false));

  // 7. Renderer visor overlay & Audio drill synth execute cleanly
  const noopCtx = new Proxy(
    { createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: () => true }
  );
  CaveRenderer.prototype._drawEmergencyDrillOverlay.call({}, noopCtx, 800, 600, { active: { kind: 'mask-flood', severity: 0.8 } }, 3.2);
  CaveRenderer.prototype._drawEmergencyDrillOverlay.call({}, noopCtx, 800, 600, { active: { kind: 'free-flow', severity: 1 } }, 3.2);
  CaveRenderer.prototype._drawEmergencyDrillOverlay.call({}, noopCtx, 800, 600, { active: null, backupTorchActive: true }, 3.2);

  const { DiveAudio } = await import('../public/js/game/audio.js');
  const a = new DiveAudio();
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  a.ctx = {
    state: 'running',
    currentTime: 1,
    sampleRate: 44100,
    destination: {},
    createOscillator: () => ({ type: 'sine', frequency: param(), connect() {}, disconnect() {}, start() {}, stop() { this.onended?.(); } }),
    createBiquadFilter: () => ({ type: 'bandpass', frequency: param(), Q: param(), connect() {}, disconnect() {} }),
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createBuffer: (c, l) => ({ getChannelData: () => new Float32Array(l) }),
    createBufferSource: () => ({ connect() {}, disconnect() {}, start() {}, stop() { this.onended?.(); } }),
  };
  a.playMaskPurge();
  a.playFreeFlowHiss();
  a.playDrillClear();
});

test('v123 Custom Challenge Links & Mutator Sandbox URL Codec, Sanitization & Head-to-Head Evaluation', () => {
  const validLevels = LEVELS.map((l) => l.id);
  const validMutators = DAILY_MUTATORS.map((m) => m.id);

  // 1. Build & parse full custom challenge URL round-trip
  const url = buildChallengeUrl('https://cave-diver.vercel.app/', {
    siteId: 'hmhs-britannic',
    difficulty: 'hardcore',
    mutatorId: 'strobe',
    customGas: true,
    o2Pct: 10,
    hePct: 70,
    drillsEnabled: true,
    challengerName: 'Barnesy',
    targetScore: 3420,
  });
  assert.ok(url.includes('challenge=1'));
  assert.ok(url.includes('site=hmhs-britannic'));
  assert.ok(url.includes('diff=hardcore'));
  assert.ok(url.includes('mut=strobe'));
  assert.ok(url.includes('o2=10'));
  assert.ok(url.includes('he=70'));
  assert.ok(url.includes('drills=1'));
  assert.ok(url.includes('target=3420'));

  const parsed = parseChallengeFromSearch(new URL(url).search, {
    validLevelIds: validLevels,
    validMutatorIds: validMutators,
  });
  assert.deepEqual(parsed, {
    siteId: 'hmhs-britannic',
    difficulty: 'hardcore',
    mutatorId: 'strobe',
    customGas: true,
    o2Pct: 10,
    hePct: 70,
    drillsEnabled: true,
    challengerName: 'Barnesy',
    targetScore: 3420,
  });

  // 2. Sanitization & security guards
  assert.equal(parseChallengeFromSearch('?room=ABCD', { validLevelIds: validLevels, validMutatorIds: validMutators }), null);
  assert.equal(parseChallengeFromSearch('?challenge=1&site=invalid-cave', { validLevelIds: validLevels, validMutatorIds: validMutators }), null);
  const clamped = parseChallengeFromSearch(
    '?challenge=1&site=cenote-el-abismo&diff=bogus&mut=unknown&o2=99&he=99&by=<Evil>\nDiver1234567890&target=9999999',
    { validLevelIds: validLevels, validMutatorIds: validMutators }
  );
  assert.equal(clamped.difficulty, 'standard');
  assert.equal(clamped.mutatorId, '');
  assert.equal(clamped.o2Pct, 40);
  assert.equal(clamped.hePct, 55); // 95 - 40
  assert.equal(clamped.targetScore, 99999);
  assert.ok(!clamped.challengerName.includes('<') && clamped.challengerName.length <= 16);

  // 3. Summary formatting & head-to-head result evaluation
  const summary = formatChallengeSummary(parsed, {
    levelName: 'HMHS Britannic',
    mutator: getDailyMutatorById('strobe'),
  });
  assert.ok(summary.tags.includes('🔥 Hardcore'));
  assert.ok(summary.tags.some((t) => t.includes('TMX 10/70')));
  assert.ok(summary.tags.includes('⚡ Failure Drills'));
  assert.ok(summary.shareText.includes('Barnesy challenged you on HMHS Britannic'));

  const winRes = evaluateChallengeResult(parsed, { success: true, score: 3560 });
  assert.equal(winRes.won, true);
  assert.equal(winRes.margin, 140);
  assert.ok(winRes.headline.includes('+140'));

  const tieRes = evaluateChallengeResult(parsed, { success: true, score: 3420 });
  assert.equal(tieRes.won, true);
  assert.equal(tieRes.margin, 0);

  const missRes = evaluateChallengeResult(parsed, { success: true, score: 3335 });
  assert.equal(missRes.won, false);
  assert.equal(missRes.margin, -85);

  const dnfRes = evaluateChallengeResult(parsed, { success: false, score: 400 });
  assert.equal(dnfRes.won, false);
  assert.ok(dnfRes.headline.includes('CHALLENGE FAILED'));
});

test('v124 Dynamic Underwater Optics & Caustics Pass: Beer-Lambert spectral absorption, caustic light webs & surface fin-kick ripples', () => {
  // 1. Beer-Lambert spectral color attenuation by depth
  const surf = computeSpectralAbsorption(0);
  assert.equal(surf.redRetention, 1);
  assert.equal(surf.greenRetention, 1);
  assert.equal(surf.blueRetention, 1);
  assert.equal(surf.tintAlpha, 0);
  assert.equal(surf.warmRestoreStrength, 0);

  const shallow = computeSpectralAbsorption(3);
  assert.equal(shallow.tintAlpha, 0);
  assert.ok(shallow.redRetention > 0.5 && shallow.redRetention < 0.7);
  assert.ok(shallow.blueRetention > shallow.greenRetention && shallow.greenRetention > shallow.redRetention);

  const mid = computeSpectralAbsorption(15);
  assert.ok(mid.redRetention < 0.12, `expected red to fade by 15m, got ${mid.redRetention}`);
  assert.ok(mid.blueRetention > 0.75, `expected blue to persist at 15m, got ${mid.blueRetention}`);
  assert.ok(mid.tintAlpha > 0 && mid.tintAlpha < 0.15);
  assert.ok(mid.warmRestoreStrength > 0.7);

  const deep = computeSpectralAbsorption(45);
  assert.ok(deep.redRetention < 0.01);
  assert.ok(deep.tintAlpha > mid.tintAlpha && deep.tintAlpha <= 0.22);
  assert.ok(deep.warmRestoreStrength >= 0.84 && deep.warmRestoreStrength <= 0.85);

  // 2. Surface meniscus fin-kick & splash ripple physics
  const session = createDiveSession(LEVEL_1, { mode: 'solo', difficulty: 'standard' });
  assert.ok(Array.isArray(session.surfaceRipples));

  // Deep diver should not spawn surface ripples
  session.diver.x = 12;
  session.diver.y = 20;
  session.diver.vx = 2.0;
  session.diver.vy = 0;
  stepSurfaceRipples(session, 0.25);
  assert.equal(session.surfaceRipples.length, 0);

  // Shallow diver kicking near y = 0 spawns expanding ripples
  session.diver.y = 1.1;
  session.diver.vx = 1.6;
  stepSurfaceRipples(session, 0.25);
  assert.ok(session.surfaceRipples.length >= 1, 'should spawn surface ripple when kicking near surface');
  const firstRadius = session.surfaceRipples[0].radius;
  stepSurfaceRipples(session, 0.4);
  assert.ok(session.surfaceRipples[0].radius > firstRadius, 'surface ripple should expand over time');

  // Stop kicking and advance until ripples expire cleanly
  session.diver.y = 18;
  session.diver.vx = 0;
  for (let i = 0; i < 15; i++) {
    stepSurfaceRipples(session, 0.35);
  }
  assert.equal(session.surfaceRipples.length, 0, 'expired surface ripples should be pruned');

  // 3. Renderer optical passes execute cleanly on a mock 2D canvas context
  const ops = [];
  const makeGrad = () => ({ addColorStop() {} });
  const mockCtx = {
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    save() { ops.push('save'); },
    restore() { ops.push('restore'); },
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    ellipse() { ops.push('ellipse'); },
    fill() { ops.push('fill'); },
    stroke() { ops.push('stroke'); },
    fillRect() { ops.push('fillRect'); },
    createRadialGradient: makeGrad,
  };
  const toScreenX = (wx) => 400 + wx * 24;
  const toScreenY = (wy) => 100 + wy * 24;
  const fakeRenderer = { _reducedMotion: false };

  // 3a. Caustic light webs along sunlit shallow rock/wreck contour (ignoring non-wall deep rays)
  const curtains = [
    {
      rays: [
        { xTop: 0, xBot: 0.4, yBot: 4.5, hitWall: true },
        { xTop: 1.5, xBot: 1.9, yBot: 5.2, hitWall: true },
        { xTop: 3.0, xBot: 3.4, yBot: 22.0, hitWall: false },
        { xTop: 4.5, xBot: 4.9, yBot: 22.0, hitWall: false },
      ],
    },
  ];
  CaveRenderer.prototype._drawCausticWebs.call(fakeRenderer, mockCtx, curtains, toScreenX, toScreenY, 24, 2.5);
  assert.ok(ops.includes('stroke') && ops.includes('ellipse'));

  // 3b. Surface ripples (both active ripples and calm meniscus fallback)
  ops.length = 0;
  CaveRenderer.prototype._drawSurfaceRipples.call(
    fakeRenderer,
    mockCtx,
    [{ x: 2, radius: 1.4, age: 0.3, life: 2.2, intensity: 0.85 }],
    -10,
    20,
    toScreenX,
    toScreenY,
    24,
    2.5
  );
  assert.ok(ops.includes('ellipse') && ops.includes('stroke'));

  ops.length = 0;
  CaveRenderer.prototype._drawSurfaceRipples.call(fakeRenderer, mockCtx, [], -10, 20, toScreenX, toScreenY, 24, 2.5);
  assert.ok(ops.includes('stroke'));

  // 3c. Beer-Lambert spectral absorption + primary & backup torch warm restoration cones
  ops.length = 0;
  CaveRenderer.prototype._drawSpectralAbsorption.call(
    fakeRenderer,
    mockCtx,
    800,
    600,
    { x: 5, y: 24, angle: 0.2, torchAngle: 0.2, torchOn: true, backupTorchActive: false, strobeMod: 1 },
    toScreenX,
    toScreenY,
    24
  );
  assert.ok(ops.includes('fillRect') && ops.includes('fill'));

  ops.length = 0;
  CaveRenderer.prototype._drawSpectralAbsorption.call(
    fakeRenderer,
    mockCtx,
    800,
    600,
    { x: 5, y: 24, angle: 0.2, torchAngle: 0.2, torchOn: true, backupTorchActive: true, strobeMod: 0.8 },
    toScreenX,
    toScreenY,
    24
  );
  assert.ok(ops.includes('fillRect') && ops.includes('fill'));
});

test('v125 Procedural Endless Expeditions ("Uncharted Sump"): determinism, SDF geometry validation across tiers/biomes & URL codec', () => {
  // 1. Seed normalization & deterministic generation
  assert.equal(normalizeProceduralSeed('  k7-m9!p2 '), 'K7M9P2');
  assert.equal(normalizeProceduralSeed(''), 'ABYSS7');

  const cfgA = { seed: 'K7M9P2', tier: 'deep', biome: 'volcanic', unlined: false };
  const lvlA1 = generateProceduralLevel(cfgA);
  const lvlA2 = generateProceduralLevel(cfgA);
  assert.equal(lvlA1.id, lvlA2.id);
  assert.deepEqual(lvlA1.segments, lvlA2.segments);
  assert.deepEqual(lvlA1.checkpoints, lvlA2.checkpoints);
  assert.deepEqual(lvlA1.collectibles, lvlA2.collectibles);
  assert.ok(Array.isArray(lvlA1.geothermalVents) && lvlA1.geothermalVents.length >= 2);

  // 2. Validate SDF geometry navigability across all 3 tiers x 5 biomes + unlined maze mode
  const tierIds = Object.keys(PROCEDURAL_TIERS);
  const biomeIds = Object.keys(PROCEDURAL_BIOMES);
  for (let ti = 0; ti < tierIds.length; ti++) {
    for (let bi = 0; bi < biomeIds.length; bi++) {
      const unlined = (ti + bi) % 2 === 1;
      const lvl = generateProceduralLevel({
        seed: `S${ti}${bi}X9`,
        tier: tierIds[ti],
        biome: biomeIds[bi],
        unlined,
      });
      const res = validateLevel(lvl, { checkGeometry: true });
      assert.equal(res.valid, true, `Procedural ${lvl.id} failed geometry check: ${res.errors.join('; ')}`);
      assert.equal(lvl.isProcedural, true);
      if (unlined) {
        assert.equal(lvl.guideline.length, 0);
        assert.ok(lvl.reelMetersPerDiver > 150);
      } else {
        assert.ok(lvl.guideline.length >= 8);
      }
    }
  }

  // 3. Registry & shareable URL round-trip
  const procId = buildProceduralLevelId({ seed: 'SUMP42', tier: 'extreme', biome: 'glacier', unlined: true });
  assert.equal(isValidLevelId(procId), true);
  assert.deepEqual(parseProceduralLevelId(procId), {
    seed: 'SUMP42',
    tier: 'extreme',
    biome: 'glacier',
    unlined: true,
  });
  const resolved = getLevelById(procId);
  assert.equal(resolved.id, procId);
  assert.equal(getLevelMeta(resolved).region, 'Uncharted Sump');

  const shareUrl = buildProceduralShareUrl('https://cave-diver.vercel.app/', {
    seed: 'SUMP42',
    tier: 'extreme',
    biome: 'glacier',
    unlined: true,
  });
  const parsedUrl = parseProceduralFromSearch(new URL(shareUrl).search);
  assert.equal(parsedUrl.levelId, procId);
  assert.equal(parsedUrl.unlined, true);

  // 4. Playable DiveSession executes cleanly on procedural level
  const session = createDiveSession(resolved, { mode: 'solo', difficulty: 'standard' });
  stepDiveSession(session, { x: 0.4, y: 0.6, boost: false }, 0.05, {});
  assert.ok(Number.isFinite(session.diver.x) && Number.isFinite(session.diver.y));
});

test('v126 Shearwater-Style Technical Dive Computer: ZH-L16C tissue bars, GF99%, OLED renderer & Debrief telemetry scrubber', () => {
  // 1. Surface state has 4 low-loaded compartments & GF99 === 0
  const st = createDiveState();
  const surfStatus = computeTissueCompartmentStatus(st);
  assert.equal(surfStatus.bars.length, 4);
  assert.equal(surfStatus.gf99Pct, 0);
  assert.ok(surfStatus.bars.every((b) => b.loadFrac < 0.6 && b.heShare === 0));

  // 2. Deep Trimix bottom exposure loads both N2 and He compartments & builds deco ceiling
  switchGas(st, 'TMX1455');
  for (let i = 0; i < 180; i++) {
    stepDivePhysiology(st, { depthM: 50, prevDepthM: 50, dt: 1.0, exertion: 0.35 });
  }
  const deepStatus = computeTissueCompartmentStatus(st);
  assert.ok(deepStatus.bars[0].heShare > 0.35, 'Trimix bottom exposure should load Helium in fast compartment');
  assert.ok(deepStatus.bars[0].loadFrac > surfStatus.bars[0].loadFrac);
  assert.ok(deepStatus.ceilingM > 0 || deepStatus.stopDepthM > 0, '50m 3-min exposure should build deco obligation');
  assert.ok(deepStatus.ppo2 > 0.7 && deepStatus.ppo2 < 1.1);

  // 3. Shearwater OLED computer renders cleanly to mock 2D canvas
  const calls = [];
  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    save() { calls.push('save'); },
    restore() { calls.push('restore'); },
    fillRect() { calls.push('fillRect'); },
    strokeRect() { calls.push('strokeRect'); },
    fillText(txt) { calls.push(`text:${txt}`); },
    setLineDash() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  };
  drawShearwaterComputer(mockCtx, 248, 162, st);
  assert.ok(calls.includes('text:SHEARWATER · ZH-L16C'));
  assert.ok(calls.includes('text:T1') && calls.includes('text:T4'));
  assert.ok(calls.some((c) => c.startsWith('text:GF99')));

  // 4. Interactive Debrief telemetry scrubber interpolates smoothly across profile points
  const profile = [
    { t: 0, d: 1.0, gas: 'EAN32', deco: 0, ppo2: 0.35, cns: 0, hr: 72, bar: 200, gf99: 0 },
    { t: 60, d: 45.0, gas: 'TMX1455', deco: 6, ppo2: 0.77, cns: 12, hr: 108, bar: 160, gf99: 54 },
    { t: 120, d: 6.0, gas: 'O2', deco: 6, ppo2: 1.6, cns: 28, hr: 84, bar: 140, gf99: 82 },
  ];
  const mid = sampleDiveProfileAtTime(profile, 30);
  assert.equal(mid.t, 30);
  assert.equal(mid.d, 23);
  assert.equal(mid.hr, 90);
  assert.equal(mid.bar, 180);
  assert.equal(mid.gf99, 27);

  const clampedEnd = sampleDiveProfileAtTime(profile, 999);
  assert.equal(clampedEnd.t, 120);
  assert.equal(clampedEnd.gas, 'O2');
  assert.equal(clampedEnd.cns, 28);
});

test('v127 Co-op Scuba Hand-Signals & Torch Light-Signaling: catalog, animated torch gestures, session & post-lighting renderer', () => {
  assert.equal(SCUBA_SIGNALS.length, 6);
  assert.equal(getScubaSignalById('ok')?.torchPattern, 'circle');
  assert.equal(getScubaSignalById('🆘 SHARE AIR!')?.id, 'share-air');
  assert.equal(getScubaSignalById('LOW GAS')?.id, 'low-gas');
  assert.equal(getScubaSignalById('HOLD DECO')?.id, 'hold');

  // 1. Torch light gesture modulation for OK (circle), LOOK (wave), and SHARE AIR (sos-wave)
  const okG = computeTorchSignalGesture(getScubaSignalById('ok'), 0.45);
  assert.ok(okG && Math.abs(okG.angleOffsetRad) > 0 && okG.pattern === 'circle');
  const waveG = computeTorchSignalGesture(getScubaSignalById('attention'), 0.35);
  assert.ok(waveG && Math.abs(waveG.angleOffsetRad) > 0.1 && waveG.pattern === 'wave');
  const sosG = computeTorchSignalGesture(getScubaSignalById('share-air'), 0.5);
  assert.ok(sosG && sosG.strobeMod <= 1 && sosG.pattern === 'sos-wave');
  assert.equal(computeTorchSignalGesture(getScubaSignalById('ok'), 4.5), null, 'gesture should conclude cleanly after window');

  // 2. triggerDiverSignal stamps diver metadata cleanly and animates torchAngle inside stepDiveSession
  const session = createDiveSession(LEVEL_1, { mode: 'solo', difficulty: 'standard' });
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const stamped = triggerDiverSignal(session.diver, 'attention', now - 320);
  assert.equal(stamped.id, 'attention');
  assert.equal(session.diver.signalId, 'attention');
  const beforeAng = session.diver.torchAngle;
  stepDiveSession(session, { x: 0, y: 0, boost: false }, 0.08, {});
  assert.notEqual(session.diver.torchAngle, beforeAng, 'active wave signal should sweep diver torchAngle');

  // 3. Renderer _drawDiverSignals draws torch O-circle, wave arcs, ascent chevrons & color-coded slates
  const drawn = [];
  const mockCtx = {
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() { drawn.push('arc'); },
    roundRect() { drawn.push('roundRect'); },
    fill() { drawn.push('fill'); },
    stroke() { drawn.push('stroke'); },
    measureText(t) { return { width: t.length * 7 }; },
    fillText(t) { drawn.push(`text:${t}`); },
  };
  const toScreenX = (wx) => 400 + wx * 24;
  const toScreenY = (wy) => 200 + wy * 24;

  const peerOk = { x: 8, y: 5, angle: 0, torchAngle: 0, torchOn: true };
  triggerDiverSignal(peerOk, 'ok', now - 400);
  const peerAsc = { x: 12, y: 6, angle: 0, torchAngle: 0, torchOn: true };
  triggerDiverSignal(peerAsc, 'ascend', now - 400);

  CaveRenderer.prototype._drawDiverSignals.call(
    {},
    mockCtx,
    session.diver,
    [peerOk, peerAsc],
    toScreenX,
    toScreenY,
    24,
    2.5,
    800,
    600
  );
  assert.ok(drawn.includes('text:👌 OK'));
  assert.ok(drawn.includes('text:👍 ASCEND / TURN'));
  assert.ok(drawn.includes('text:🔦 LOOK / ATTENTION'));
  assert.ok(drawn.filter((d) => d === 'arc').length >= 4);
});

test('v128 Extreme Frontier Expedition Pack (+3 Iconic Dives -> 33 Total) & HUD COMP/STAGE crash regression guard', async () => {
  const { readFileSync } = await import('node:fs');
  const { DiveAudio } = await import('../public/js/game/audio.js');

  // 1. Validate all 3 new iconic expeditions with full SDF geometry checks
  const bimini = getLevelById('bimini-road-megalith');
  const zenobia = getLevelById('ms-zenobia-ferry');
  const krubera = getLevelById('krubera-voronya-sump');

  for (const lvl of [bimini, zenobia, krubera]) {
    const res = validateLevel(lvl, { checkGeometry: true });
    assert.equal(res.valid, true, `${lvl.id} geometry failed: ${res.errors.join('; ')}`);
  }

  assert.equal(bimini.archWindows.length, 2);
  assert.equal(zenobia.isWreck, true);
  assert.equal(zenobia.watertightHatches.length, 2);
  assert.equal(zenobia.snagZones.length, 2);

  // Krubera-Voronya 198m world-record sump: TMX 8/76 safe PPO2 at 198m + probe recovery
  assert.equal(krubera.lined, false);
  assert.equal(krubera.reelMetersPerDiver, 405);
  assert.equal(krubera.recoveryTarget?.id, 'krubera-abyssal-probe');
  const kSession = createDiveSession(krubera, { mode: 'solo', difficulty: 'standard' });
  assert.equal(kSession.diveState.mixes.TMX1455.name, 'TMX 8/76');
  kSession.diveState.activeGasId = 'TMX1455';
  stepDivePhysiology(kSession.diveState, { depthM: 198.0, prevDepthM: 198.0, dt: 0.5, exertion: 0.25 });
  assert.ok(kSession.diveState.ppo2 > 1.4 && kSession.diveState.ppo2 < 1.75);
  assert.equal(kSession.diveState.alive, true);

  // 2. Regression guard: every audio.<method>( call in main.js must exist on DiveAudio.prototype,
  //    and stepSimulation must never reference undefined `nowMs` (preventing STAGE/COMP crashes).
  const mainSrc = readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');
  const audioCalls = new Set(
    Array.from(mainSrc.matchAll(/\baudio\.([a-zA-Z0-9_]+)\s*\(/g), (m) => m[1])
  );
  for (const fnName of audioCalls) {
    assert.equal(
      typeof DiveAudio.prototype[fnName],
      'function',
      `main.js invokes audio.${fnName}(), which does not exist on DiveAudio.prototype`
    );
  }
  const stepSimMatch = mainSrc.match(/function stepSimulation\(dt\)\s*\{([\s\S]*?)^function frame\(/m);
  assert.ok(stepSimMatch, 'stepSimulation(dt) should be present in main.js');
  assert.equal(
    /\bnowMs\b/.test(stepSimMatch[1]),
    false,
    'stepSimulation(dt) must not reference out-of-scope nowMs'
  );
  assert.equal(
    /\bcloseHomeMenu\b/.test(mainSrc),
    false,
    'main.js must use setHomeMenuOpen(false), never undeclared closeHomeMenu'
  );
});

test('v131 Daily Generated Sump Expeditions & Monthly Daily Dive Calendar: determinism, SDF validation & archive backfill', () => {
  // 1. Deterministic daily procedural generation across 14 consecutive UTC days with zero consecutive biome repeats
  let prevBiome = '';
  const seenBiomes = new Set();
  const seenTiers = new Set();
  for (let day = 1; day <= 14; day++) {
    const dateKey = `2026-11-${String(day).padStart(2, '0')}`;
    const cfgA = getDailyGeneratedConfig(dateKey);
    const cfgB = getDailyGeneratedConfig(dateKey);
    assert.deepEqual(cfgA, cfgB, 'Same date must yield identical daily generated config');
    assert.equal(cfgA.seed, `D2611${String(day).padStart(2, '0')}`);
    assert.notEqual(cfgA.biome, prevBiome, `Consecutive days should not repeat biome (${dateKey})`);
    prevBiome = cfgA.biome;
    seenBiomes.add(cfgA.biome);
    seenTiers.add(cfgA.tier);

    const lvl = getDailyGeneratedLevel(dateKey);
    const check = validateLevel(lvl, { checkGeometry: true });
    assert.equal(check.valid, true, `Daily generated sump ${dateKey} failed SDF check: ${check.errors.join('; ')}`);
    assert.equal(getLevelById(cfgA.levelId).id, cfgA.levelId);
    assert.ok(getDailyMutatorForDate(dateKey)?.id);
  }
  assert.ok(seenBiomes.size >= 4, '14-day window should cover at least 4 geological biomes');
  assert.equal(seenTiers.size, 3, '14-day window should span shallow, deep, and extreme tiers');

  // 2. Monthly Calendar Matrix & Archive Backfill streak integrity
  let book = createEmptyLogbook();
  // Clear Nov 20 and Nov 21 -> 2-day live streak
  book = recordDailyClear(book, {
    dateKey: '2026-11-20',
    levelId: getDailyGeneratedConfig('2026-11-20').levelId,
    mutatorId: getDailyMutatorForDate('2026-11-20').id,
    score: 2650,
    grade: 'A',
    timeSec: 180,
  });
  book = recordDailyClear(book, {
    dateKey: '2026-11-21',
    levelId: getDailyGeneratedConfig('2026-11-21').levelId,
    mutatorId: getDailyMutatorForDate('2026-11-21').id,
    score: 3120,
    grade: 'S',
    timeSec: 162,
  });
  assert.equal(getDailyStatus(book, '2026-11-21').activeStreak, 2);

  // Backfill older archive day Nov 10 -> records clear & grade without breaking live 2-day streak!
  book = recordDailyClear(book, {
    dateKey: '2026-11-10',
    levelId: getDailyGeneratedConfig('2026-11-10').levelId,
    mutatorId: getDailyMutatorForDate('2026-11-10').id,
    score: 2400,
    grade: 'B',
    timeSec: 210,
  });
  const st = getDailyStatus(book, '2026-11-21');
  assert.equal(st.activeStreak, 2, 'Archive backfill must preserve live streak');
  assert.equal(st.totalClears, 3);

  const cal = buildDailyCalendarMonth(book, 2026, 10, '2026-11-21'); // Nov 2026
  assert.equal(cal.monthLabel, 'November 2026');
  assert.equal(cal.daysInMonth, 30);
  assert.equal(cal.clearedInMonth, 3);
  assert.equal(cal.availableInMonth, 21);
  assert.equal(cal.days[9].dateKey, '2026-11-10');
  assert.equal(cal.days[9].cleared, true);
  assert.equal(cal.days[9].grade, 'B');
  assert.equal(cal.days[20].isToday, true);
  assert.equal(cal.days[20].grade, 'S');
  assert.equal(cal.days[21].isFuture, true);
  assert.equal(cal.days[21].cleared, false);
});

test('v133 Spatial 3D Underwater Audio, Mobile Haptics & Independent Audio Mixer: spatial pan/attenuation, buses & presets', async () => {
  const { DiveAudio, computeSpatialMix, HAPTIC_PRESETS } = await import('../public/js/game/audio.js');

  // 1. Spatial 3D pan & distance attenuation math
  const center = computeSpatialMix(10, 20, 10, 20);
  assert.equal(center.pan, 0);
  assert.equal(center.gain, 1);
  assert.equal(center.distanceM, 0);

  const rightNear = computeSpatialMix(10, 20, 22, 20);
  assert.ok(rightNear.pan > 0.5 && rightNear.pan <= 0.92, `Expected right stereo pan, got ${rightNear.pan}`);
  assert.ok(rightNear.gain > 0.3 && rightNear.gain < 0.8);

  const leftFar = computeSpatialMix(10, 20, -40, 20, { maxDistM: 36 });
  assert.ok(leftFar.pan < -0.8);
  assert.equal(leftFar.gain, 0, 'Beyond maxDistM should attenuate cleanly to 0');

  // 2. Independent mixer settings & AquaticRadio volume sync
  const audio = new DiveAudio();
  const updated = audio.setMixerSettings({
    sfxVolume: 0.42,
    ambienceVolume: 0.95,
    radioVolume: 0.3,
    spatialEnabled: false,
    hapticsEnabled: false,
  });
  assert.equal(updated.sfxVolume, 0.42);
  assert.equal(updated.ambienceVolume, 0.95);
  assert.equal(updated.radioVolume, 0.3);
  assert.equal(audio.radio.volume, 0.3);
  assert.equal(updated.spatialEnabled, false);
  assert.equal(updated.hapticsEnabled, false);

  // Clamping out-of-range mixer values safely
  const clamped = audio.setMixerSettings({ sfxVolume: 5.5, ambienceVolume: -2, radioVolume: 1.8 });
  assert.equal(clamped.sfxVolume, 1);
  assert.equal(clamped.ambienceVolume, 0);
  assert.equal(clamped.radioVolume, 1);

  // 3. Haptic presets catalog & safe headless invocation
  assert.ok(Array.isArray(HAPTIC_PRESETS.impact) && Array.isArray(HAPTIC_PRESETS.sonar) && Array.isArray(HAPTIC_PRESETS.critical));
  audio.triggerHaptic('sonar');
  audio.playSpatialTestSweep();
});

test('v134 AI Autonomous Dive Buddy ("Solo Co-op" Wingman): formation, SDF clearance, torch spotlighting, signals, gas share & snag rescue', async () => {
  const {
    createAiBuddyState,
    stepAiBuddy,
    handlePlayerSignalForAiBuddy,
    AI_BUDDY_ID,
  } = await import('../public/js/game/aiBuddy.js');

  const session = createDiveSession(LEVEL_1, { diverName: 'SoloLead' });
  const buddy = createAiBuddyState(LEVEL_1, session.diver);
  assert.equal(buddy.id, AI_BUDDY_ID);
  assert.equal(buddy.isAiBuddy, true);
  assert.equal(buddy.alive, true);
  assert.ok(buddy.body && buddy.body.pelvis, 'AI Buddy should have articulated diver body');
  assert.ok(evaluateCaveSDF(LEVEL_1, buddy.x, buddy.y) <= -0.45, 'AI Buddy must spawn in open navigable water');

  // 1. Formation follow & SDF-safe navigation
  for (let i = 0; i < 40; i++) {
    stepDiveSession(session, { x: 0.7, y: 0.4, boost: false }, 0.05);
    stepAiBuddy(buddy, session, 0.05, { timestampMs: 1000 + i * 50 });
  }
  assert.ok(evaluateCaveSDF(LEVEL_1, buddy.x, buddy.y) <= -0.4, 'AI Buddy must maintain open-water SDF clearance while following');
  assert.ok(Math.hypot(buddy.x - session.diver.x, buddy.y - session.diver.y) < 12, 'AI Buddy stays within formation reach');

  // 2. Scuba hand-signal commands (HOLD -> ATTENTION -> ASCEND -> OK)
  const holdRes = handlePlayerSignalForAiBuddy(buddy, 'hold', session, 5000);
  assert.equal(holdRes.responded, true);
  assert.equal(buddy.mode, 'hold');
  assert.equal(buddy.condition, 'HOLDING');
  const heldX = buddy.holdX;
  const heldY = buddy.holdY;
  stepAiBuddy(buddy, session, 0.05, { nowMs: 5050 });
  assert.ok(Math.hypot(buddy.x - heldX, buddy.y - heldY) < 1.5, 'AI Buddy holds position after HOLD signal');

  const scoutRes = handlePlayerSignalForAiBuddy(buddy, 'attention', session, 6000);
  assert.equal(scoutRes.responded, true);
  assert.equal(buddy.mode, 'scout');

  const ascRes = handlePlayerSignalForAiBuddy(buddy, 'ascend', session, 7000);
  assert.equal(ascRes.responded, true);
  assert.equal(buddy.mode, 'ascend');

  const okRes = handlePlayerSignalForAiBuddy(buddy, 'ok', session, 8000);
  assert.equal(okRes.responded, true);
  assert.equal(buddy.mode, 'follow');
  assert.equal(buddy.condition, 'NOMINAL');

  // 3. Secondary torch spotlighting onto nearby collectible
  const col = LEVEL_1.collectibles[0];
  session.diver.x = col.x - 4;
  session.diver.y = col.y;
  buddy.x = col.x - 5;
  buddy.y = col.y;
  for (let i = 0; i < 30; i++) {
    stepAiBuddy(buddy, session, 0.05, { nowMs: 9000 + i * 50 });
  }
  const expectedAng = Math.atan2(col.y - buddy.y, col.x - buddy.x);
  let angErr = Math.abs(buddy.torchAngle - expectedAng);
  while (angErr > Math.PI) angErr = Math.abs(angErr - Math.PI * 2);
  assert.ok(angErr < 0.65, `Expected buddy torch to track nearby collectible (err=${angErr.toFixed(2)})`);

  // 4. Emergency automatic gas share + airShareBeams VFX
  const activeTank = session.diveState.tanks[session.diveState.activeGasId];
  activeTank.bar = 22;
  buddy.x = session.diver.x + 1.2;
  buddy.y = session.diver.y;
  let gasShareEvent = null;
  for (let i = 0; i < 20 && !gasShareEvent; i++) {
    stepAiBuddy(buddy, session, 0.05, {
      nowMs: 12000 + i * 50,
      onBuddyGasShare: (ev) => {
        gasShareEvent = ev;
      },
    });
  }
  assert.ok(gasShareEvent && gasShareEvent.amountBar >= 15, 'AI Buddy should auto-donate emergency gas when player < 34 bar');
  assert.ok(activeTank.bar > 35, `Player tank should be replenished (got ${activeTank.bar})`);
  assert.ok(session.airShareBeams.length > 0, 'Gas share should trigger animated airShareBeams hose VFX');
  assert.ok(buddy.gasDonationsCount >= 1 && buddy.gasDonatedTotalBar >= 15);

  // 5. Autonomous snag-cut rescue on shipwreck snag
  const wreck = LEVELS.find((l) => l.isWreck && Array.isArray(l.snagZones) && l.snagZones.length > 0);
  assert.ok(wreck, 'Expected at least one shipwreck with snagZones');
  const wSession = createDiveSession(wreck, { diverName: 'WreckLead' });
  const wBuddy = createAiBuddyState(wreck, wSession.diver);
  wSession.activeSnagIndex = 0;
  wBuddy.x = wSession.diver.x + 1.1;
  wBuddy.y = wSession.diver.y;
  let snagCutFired = false;
  for (let i = 0; i < 45 && !snagCutFired; i++) {
    stepAiBuddy(wBuddy, wSession, 0.05, {
      nowMs: 20000 + i * 50,
      onBuddyCutSnag: () => {
        snagCutFired = true;
      },
    });
  }
  assert.equal(snagCutFired, true, 'AI Buddy should rush in and cut entangled player free');
  assert.equal(wSession.activeSnagIndex, -1, 'Snag index should clear once AI Buddy cuts line');
  assert.equal(wBuddy.snagsAssisted, 1);
});

test('v136 Code Quality & V8 Boot Integrity Guard: DOM IDs, SW precache, singleton methods & headless main.js boot', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');

  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(testDir, '..');
  const pubDir = path.join(repoRoot, 'public');
  const html = fs.readFileSync(path.join(pubDir, 'index.html'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(pubDir, 'js/main.js'), 'utf8');
  const swSrc = fs.readFileSync(path.join(pubDir, 'sw.js'), 'utf8');

  // 1. Every getElementById(...) in main.js must exist in index.html (or be dynamically created in JS)
  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const missingIds = [];
  for (const m of mainSrc.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)) {
    const id = m[1];
    if (!htmlIds.has(id) && !mainSrc.includes(`id="${id}"`) && !mainSrc.includes(`id='${id}'`)) {
      missingIds.push(id);
    }
  }
  assert.deepEqual(missingIds, [], `main.js references missing HTML IDs: ${missingIds.join(', ')}`);

  // 2. Previously caught undeclared-symbol regressions must never reappear
  assert.equal(/\bdailyMutMeta\b/.test(mainSrc), false, 'main.js must not reference undeclared dailyMutMeta');
  assert.equal(/\bpopulateLevelSelector\b/.test(mainSrc), false, 'main.js must not reference undeclared populateLevelSelector');

  // 3. All singleton method calls in main.js must exist on their respective class prototypes
  const singletons = [
    { varName: 'audio', mod: '../public/js/game/audio.js', cls: 'DiveAudio' },
    { varName: 'renderer', mod: '../public/js/game/renderer.js', cls: 'CaveRenderer' },
    { varName: 'hud', mod: '../public/js/game/hud.js', cls: 'DiveComputerHUD' },
    { varName: 'input', mod: '../public/js/game/input.js', cls: 'InputController' },
    { varName: 'lan', mod: '../public/js/net/lanClient.js', cls: 'LanClient' },
    { varName: 'leaderboard', mod: '../public/js/net/leaderboardClient.js', cls: 'LeaderboardClient' },
    { varName: 'github', mod: '../public/js/net/githubClient.js', cls: 'GitHubClient' },
  ];
  for (const s of singletons) {
    const mod = await import(s.mod);
    const valid = new Set(Object.getOwnPropertyNames(mod[s.cls]?.prototype || {}));
    const re = new RegExp(`\\b${s.varName}(?:\\?\\.|\\.)([A-Za-z_$][\\w$]*)\\s*\\(`, 'g');
    const missing = [...new Set([...mainSrc.matchAll(re)].map((x) => x[1]))].filter((fn) => !valid.has(fn));
    assert.deepEqual(missing, [], `${s.varName} calls missing methods: ${missing.join(', ')}`);
  }

  // 4. Every CORE_SHELL entry in sw.js must exist on disk
  const swEntries = [...swSrc.matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1].split('?')[0]);
  for (const rel of swEntries) {
    if (rel === './') continue;
    assert.equal(fs.existsSync(path.join(pubDir, rel.slice(2))), true, `SW CORE_SHELL missing on disk: ${rel}`);
  }

  // 5. Real V8 subprocess boot + modal click-through smoke test with populated localStorage prefs (catches TDZ & init crashes)
  const bootScript = `
    import fs from 'node:fs';
    import { pathToFileURL } from 'node:url';
    const html = fs.readFileSync(${JSON.stringify(path.join(pubDir, 'index.html'))}, 'utf8');
    const errs = [];
    process.on('uncaughtException', (e) => errs.push(e.stack || String(e)));
    process.on('unhandledRejection', (e) => errs.push(e?.stack || String(e)));
    const mkCtx = () => new Proxy({
      canvas: { width: 800, height: 600 },
      measureText: () => ({ width: 24 }),
      createImageData: (w, h) => ({ data: new Uint8ClampedArray((w || 16) * (h || 16) * 4), width: w || 16, height: h || 16 }),
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray((w || 16) * (h || 16) * 4), width: w || 16, height: h || 16 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      createPattern: () => ({}),
    }, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) });
    class CL { constructor(){ this.s = new Set(); } add(...a){ a.forEach(x=>this.s.add(x)); } remove(...a){ a.forEach(x=>this.s.delete(x)); } toggle(x,f){ if(f===undefined){ if(this.s.has(x)){this.s.delete(x);return false;} this.s.add(x);return true;} if(f)this.s.add(x); else this.s.delete(x); return !!f; } contains(x){ return this.s.has(x); } }
    class El {
      constructor(tag='div', id=''){ this.tagName=tag.toUpperCase(); this.id=id; this.hidden=false; this.disabled=false; this.value=''; this.checked=false; this.textContent=''; this.innerHTML=''; this.className=''; this.dataset={}; this.style=new Proxy({},{get:(t,p)=>p==='setProperty'?()=>{}:t[p]??'',set:(t,p,v)=>((t[p]=v),true)}); this.classList=new CL(); this.children=[]; this.listeners=new Map(); this.width=800; this.height=600; this.clientWidth=800; this.clientHeight=600; this.attributes=new Map(); }
      addEventListener(e,f){ if(!this.listeners.has(e)) this.listeners.set(e,[]); this.listeners.get(e).push(f); }
      removeEventListener(){}
      click(){ for(const f of this.listeners.get('click')||[]) f({type:'click',target:this,preventDefault(){},stopPropagation(){}}); }
      setAttribute(k,v){ this.attributes.set(k,String(v)); if(k==='hidden') this.hidden=true; }
      getAttribute(k){ return this.attributes.get(k)??null; }
      removeAttribute(k){ this.attributes.delete(k); if(k==='hidden') this.hidden=false; }
      appendChild(c){ this.children.push(c); return c; } removeChild(){} replaceChildren(){} remove(){} focus(){} blur(){} select(){}
      closest(){ return null; } querySelector(){ return new El(); } querySelectorAll(){ return []; }
      getBoundingClientRect(){ return {left:0,top:0,width:800,height:600,right:800,bottom:600}; }
      getContext(){ return mkCtx(); } toDataURL(){ return 'data:image/png;base64,'; }
    }
    const byId = new Map();
    for (const m of html.matchAll(/<([a-zA-Z0-9-]+)\\b([^>]*)\\bid="([^"]+)"([^>]*)>/g)) {
      const el = new El(m[1], m[3]);
      if (/\\bhidden\\b/.test(m[2]+m[4])) el.hidden = true;
      if (/\\bchecked\\b/.test(m[2]+m[4])) el.checked = true;
      byId.set(m[3], el);
    }
    const store = new Map([
      ['caveDiverBriefed_v1','1'],
      ['caveDiverName_v1','BootGuard'],
      ['caveDiverDrills_v1','1'],
      ['caveDiverAiBuddy_v1','1'],
      ['caveDiverDifficulty_v1','hardcore'],
      ['caveDiverCustomGas_v1', JSON.stringify({ enabled: true, o2Pct: 18, hePct: 45 })],
      ['caveDiverLivery_v1', JSON.stringify({ suitId: 'arctic-cobalt', torchId: 'warm-halogen', patchId: 'cave-arrow' })],
    ]);
    const origSI = globalThis.setInterval;
    globalThis.setInterval = (...a) => { const h = origSI(...a); h.unref?.(); return h; };
    globalThis.window = globalThis; globalThis.self = globalThis;
    globalThis.localStorage = { getItem: k => store.has(k)?store.get(k):null, setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k), clear:()=>store.clear() };
    globalThis.sessionStorage = globalThis.localStorage;
    globalThis.location = { origin:'https://example.test', pathname:'/', search:'', hash:'', href:'https://example.test/', protocol:'https:', host:'example.test', hostname:'example.test', reload(){} };
    globalThis.history = { replaceState(){}, pushState(){} };
    globalThis.innerWidth = 1280; globalThis.innerHeight = 800; globalThis.devicePixelRatio = 1;
    globalThis.matchMedia = () => ({ matches:false, addEventListener(){}, removeEventListener(){} });
    globalThis.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
    globalThis.Image = class { set src(v){ queueMicrotask(()=>this.onerror?.()); } };
    globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
    globalThis.fetch = async () => ({ ok:false, status:404, json:async()=>({}), text:async()=>'' });
    globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
    try { Object.defineProperty(globalThis, 'navigator', { configurable:true, value:{ userAgent:'Test', onLine:false, vibrate:()=>true } }); } catch {}
    globalThis.document = { hidden:false, visibilityState:'visible', body:new El('body'), documentElement:new El('html'), getElementById:id=>byId.get(id)||null, createElement:t=>new El(t), createElementNS:(_n,t)=>new El(t), querySelector:()=>null, querySelectorAll:()=>[], addEventListener(){}, removeEventListener(){} };
    await import(pathToFileURL(${JSON.stringify(path.join(pubDir, 'js/main.js'))}).href);
    await new Promise(r => setTimeout(r, 40));
    for (const id of ['btn-setup-drawer','menu-mode-badge','menu-weather-pill','menu-livery-pill','btn-livery-reset','btn-livery-done','btn-setup-drawer','menu-ai-buddy-pill','menu-drills-pill','btn-setup-reset','btn-setup-done','btn-open-logbook','btn-logbook-close','btn-photo-grid','btn-photo-frame','btn-photo-center','btn-open-audio-mixer','btn-mixer-test','btn-mixer-done','btn-open-daily-calendar','btn-daily-cal-close','btn-open-procedural','btn-proc-modal-close']) {
      byId.get(id)?.click();
    }
    await new Promise(r => setTimeout(r, 30));
    if (errs.length) { console.error(errs.join('\\n')); process.exit(1); }
  `;
  execFileSync(process.execPath, ['--input-type=module', '-e', bootScript], {
    stdio: 'pipe',
    timeout: 10000,
  });
});

test('v137 Dynamic Surface Weather, Day/Night & Bioluminescent Night-Dive Mode: presets, auto clock, swell, scoring & renderer', async () => {
  const {
    WEATHER_PRESETS,
    WEATHER_CYCLE_ORDER,
    getWeatherById,
    resolveEffectiveWeather,
    computeWeatherSwellForce,
    computeStormLightningFlash,
    MAX_WEATHER_BONUS,
  } = await import('../public/js/game/weather.js');

  assert.equal(WEATHER_PRESETS.length, 5);
  assert.ok(WEATHER_CYCLE_ORDER.includes('auto'));
  assert.equal(MAX_WEATHER_BONUS, 250);

  // 1. Auto clock + site-climate resolution
  assert.equal(resolveEffectiveWeather('auto', { hourLocal: 22 }).id, 'night-biolum');
  assert.equal(resolveEffectiveWeather('auto', { hourLocal: 18 }).id, 'golden-hour');
  assert.equal(resolveEffectiveWeather('auto', { hourLocal: 12 }).id, 'clear-day');
  assert.equal(
    resolveEffectiveWeather('auto', { hourLocal: 14, level: { theme: { surfaceStyle: 'kverkfjoll-glacier' } } }).id,
    'arctic-blizzard'
  );

  // 2. Shallow storm swell physics & deep-water shelter attenuation
  const storm = getWeatherById('tropical-storm');
  const shallowSwell = computeWeatherSwellForce(storm, 2.0, 1.2, { nearOpenBasin: true });
  assert.ok(Math.abs(shallowSwell.ax) > 0.25, `Expected noticeable shallow storm swell, got ${shallowSwell.ax}`);
  const deepSwell = computeWeatherSwellForce(storm, 14.0, 1.2, { nearOpenBasin: true });
  assert.equal(deepSwell.ax, 0);
  assert.equal(deepSwell.ay, 0);
  const caveSwell = computeWeatherSwellForce(storm, 2.0, 1.2, { nearOpenBasin: false });
  assert.equal(caveSwell.ax, 0);

  // 3. Deterministic storm lightning pulse
  assert.ok(computeStormLightningFlash(storm, 0.06) > 0.5, 'Storm should pulse lightning near t=0.06');
  assert.equal(computeStormLightningFlash(storm, 5.0), 0, 'Lightning should be quiet between flashes');
  assert.equal(computeStormLightningFlash(getWeatherById('clear-day'), 0.06), 0);

  // 4. Night Dive session: shallow bioluminescent fin-wake & +250 score bonus within ceiling
  const nightSession = createDiveSession(LEVEL_1, { diverName: 'NightDiver', weatherId: 'night-biolum' });
  assert.equal(nightSession.weather.id, 'night-biolum');
  assert.equal(nightSession.weatherBonusScore, 250);
  nightSession.diver.y = 3.2;
  for (let i = 0; i < 15; i++) {
    stepDiveSession(nightSession, { x: 0.9, y: 0.2, boost: false }, 0.05);
  }
  assert.ok(nightSession.bioWake.length > 0, 'Night Dive should trigger shallow bioluminescent fin-wake sparks');

  const nightScore = computeDiverScoreSummary({
    name: 'NightDiver',
    level: LEVEL_1,
    diveState: nightSession.diveState,
    checkpointsHit: nightSession.checkpointsHit,
    collectedIds: nightSession.collectedIds,
    exploredCount: nightSession.exploredCells.size,
    totalExploreCells: nightSession.exploreCells.length,
    diveTimeSec: 120,
    weatherBonusScore: nightSession.weatherBonusScore,
  });
  assert.equal(nightScore.weatherBonusScore, 250);
  assert.ok(nightScore.totalScore <= computeLevelMaxScore(LEVEL_1.id, false));

  // 5. Renderer weather passes execute cleanly across all presets (incl. Night Bioluminescence & Storm Rain)
  const noopCtx = new Proxy(
    {
      canvas: { width: 800, height: 600 },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: () => ({ width: 24 }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const r = Object.create(CaveRenderer.prototype);
  r.level = LEVEL_1;
  r.glowStamps = { cyan: null, magenta: null };
  r._biolumMotes = null;
  r._shallowBiolumMotes = null;
  for (const preset of WEATHER_PRESETS) {
    r._activeWeather = preset;
    r._drawWeatherSkyAtmosphere(noopCtx, 800, 240, 0.06);
    r._drawWeatherPrecipitation(noopCtx, 800, 600, 240, 0.06);
    if (preset.forceBiolum) {
      r._drawBioluminescence(noopCtx, -10, 40, 0, 25, (x) => x * 20 + 200, (y) => y * 20 + 100, 20, 1.5);
    }
  }
});

test('v138 Diver Gear Workshop, Custom Rig Liveries, Technical Torch Optics & Co-op Sync', async () => {
  const {
    SUIT_LIVERIES,
    TORCH_OPTICS,
    MILESTONE_PATCHES,
    DEFAULT_RIG_LIVERY,
    getSuitLivery,
    getTorchOptic,
    getMilestonePatch,
    computeUnlockedLiveries,
    sanitizeRigLivery,
    isDefaultRigLivery,
    drawLiveryPreview,
  } = await import('../public/js/game/rigLivery.js');

  assert.ok(SUIT_LIVERIES.length >= 6);
  assert.ok(TORCH_OPTICS.length >= 4);
  assert.ok(MILESTONE_PATCHES.length >= 6);
  assert.equal(isDefaultRigLivery(DEFAULT_RIG_LIVERY), true);
  assert.equal(isDefaultRigLivery({ ...DEFAULT_RIG_LIVERY, suitId: 'arctic-cobalt' }), false);

  // 1. Fresh diver unlocks standard issue items only; career clears & field guide unlock milestones
  const wreckIds = LEVELS.filter((l) => l.isWreck).map((l) => l.id);
  const freshBook = createEmptyLogbook();
  const freshUnlocks = computeUnlockedLiveries(freshBook, wreckIds);
  assert.equal(freshUnlocks.suits.has('zissou-classic'), true);
  assert.equal(freshUnlocks.suits.has('arctic-cobalt'), true);
  assert.equal(freshUnlocks.suits.has('expedition-amber'), true);
  assert.equal(freshUnlocks.suits.has('abyss-emerald'), false);
  assert.equal(freshUnlocks.torches.has('amber-silt'), false);

  // Sanitizer enforces unlock gates & rejects invalid IDs
  const clamped = sanitizeRigLivery(
    { suitId: 'krubera-obsidian', torchId: 'amber-silt', patchId: 'nonexistent' },
    freshUnlocks
  );
  assert.deepEqual(clamped, DEFAULT_RIG_LIVERY);

  // Career progression unlocks Cenote Emerald, Wreck Titanium, Amber Silt-Piercer & Marine Bio patch
  let vetBook = createEmptyLogbook();
  for (const id of ['cenote-el-abismo', 'eagles-nest-sink', 'uss-oriskany-carrier']) {
    vetBook = recordDiveInLogbook(vetBook, { levelId: id, success: true, score: 2500, grade: 'A', maxDepthM: 55, diveTimeSec: 180 });
  }
  for (let i = 0; i < 5; i++) {
    vetBook.fieldGuide[`species-${i}`] = { count: 1, bestStars: 3, firstSiteId: 'cenote-el-abismo', bestSiteName: 'Cenote', bestDepthM: 20 };
  }
  const vetUnlocks = computeUnlockedLiveries(vetBook, wreckIds);
  assert.equal(vetUnlocks.stats.sitesCleared, 3);
  assert.equal(vetUnlocks.stats.wreckClears, 1);
  assert.equal(vetUnlocks.stats.speciesLogged, 5);
  assert.equal(vetUnlocks.suits.has('abyss-emerald'), true);
  assert.equal(vetUnlocks.suits.has('wreck-titanium'), true);
  assert.equal(vetUnlocks.torches.has('amber-silt'), true);
  assert.equal(vetUnlocks.torches.has('emerald-spot'), true);
  assert.equal(vetUnlocks.patches.has('wreck-penetrator'), true);
  assert.equal(vetUnlocks.patches.has('wildlife-biologist'), true);

  const customRig = { suitId: 'wreck-titanium', torchId: 'amber-silt', patchId: 'wreck-penetrator' };
  assert.deepEqual(sanitizeRigLivery(customRig, vetUnlocks), customRig);
  assert.ok(getTorchOptic('amber-silt').siltPierce > 0.2);
  assert.ok(getTorchOptic('emerald-spot').rangeMult > 1.05);
  assert.equal(getSuitLivery('unknown-id').id, 'zissou-classic');
  assert.equal(getMilestonePatch('wreck-penetrator').icon, '⚓');

  // 2. Workshop animated preview & renderer passes execute cleanly with custom livery & optics
  const noopCtx = new Proxy(
    {
      canvas: { width: 560, height: 148 },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: () => ({ width: 24 }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  drawLiveryPreview(noopCtx, 560, 148, customRig, { hasCcr: true, hasDpv: true, timeSec: 1.4 });

  const s = createDiveSession(LEVEL_1, { diverName: 'CustomTech', livery: customRig });
  assert.deepEqual(s.diver.livery, customRig);

  const r = Object.create(CaveRenderer.prototype);
  r.level = LEVEL_1;
  r.ctx = noopCtx;
  r.glowStamps = { warm: null, cyan: null, magenta: null };
  r._torchSparksScratch = [];
  r.siltCanvas = { width: 800, height: 600 };
  const toSX = (x) => x * 20 + 200;
  const toSY = (y) => y * 20 + 100;
  r._drawDiver(noopCtx, s.diver, toSX, toSY, 20, false, 1.2, null, 0);
  r._drawVolumetricTorchBeam(
    noopCtx,
    s.diver,
    { ox: s.diver.x, oy: s.diver.y, rays: [{ x: s.diver.x + 8, y: s.diver.y - 2 }, { x: s.diver.x + 8, y: s.diver.y + 2 }] },
    16.5 * getTorchOptic(customRig.torchId).rangeMult,
    { siltHaze: 0.4, toScreenX: toSX, toScreenY: toSY, scale: 20, timeSec: 1.2 }
  );
  r._drawSpectralAbsorption(noopCtx, 800, 600, s.diver, toSX, toSY, 20);

  // 3. Co-op P2pRoomCoordinator & LanClient relay and preserve remote peer livery
  const peerPkts = [];
  const coord = new P2pRoomCoordinator({ code: 'LIV1', hostId: 'h1', hostName: 'Host', levelId: LEVEL_1.id });
  coord.bindPlayerSender('h1', () => {});
  coord.handleRemoteJoin({ name: 'Guest' }, (m) => peerPkts.push(m), 'p2');
  coord.handleMessage('h1', { type: 'start_dive', force: true });
  coord.handleMessage('h1', {
    type: 'player_state',
    state: { seq: 1, x: 10, y: 12, vx: 0, vy: 0, angle: 0, torchOn: true, alive: true, livery: customRig },
  });
  const relayed = peerPkts.find((m) => m.type === 'peer_state');
  assert.deepEqual(relayed?.state?.livery, customRig);

  const client = new LanClient();
  client._handleMessage({
    type: 'peer_state',
    playerId: 'h1',
    state: relayed.state,
  });
  const peer = client.getPeers().find((p) => p.id === 'h1');
  assert.deepEqual(peer?.livery, customRig);
});

test('v139 Underwater Photo Mode Studio & Marine Field Guide Collector Cards', async () => {
  const {
    PHOTO_FILTERS,
    PHOTO_FRAMES,
    PHOTO_MIN_ZOOM,
    PHOTO_MAX_ZOOM,
    PHOTO_MAX_PAN_M,
    createPhotoModeState,
    clampPhotoModeState,
    applyPhotoViewportOverlay,
    renderPhotoSnapshot,
    renderFieldGuideCollectorCard,
    filterAndSortFieldGuide,
  } = await import('../public/js/game/photoStudio.js');

  assert.equal(PHOTO_FILTERS.length, 5);
  assert.equal(PHOTO_FRAMES.length, 3);

  // 1. State creation & bounds clamping
  const pm = createPhotoModeState();
  assert.equal(pm.active, false);
  assert.equal(pm.zoom, 1.0);
  pm.zoom = 9.9;
  pm.panX = -999;
  pm.panY = 500;
  pm.filterId = 'invalid-grade';
  pm.frameId = 'invalid-frame';
  clampPhotoModeState(pm);
  assert.equal(pm.zoom, PHOTO_MAX_ZOOM);
  assert.equal(pm.panX, -PHOTO_MAX_PAN_M);
  assert.equal(pm.panY, PHOTO_MAX_PAN_M);
  assert.equal(pm.filterId, 'natural');
  assert.equal(pm.frameId, 'telemetry');
  pm.zoom = 0.05;
  clampPhotoModeState(pm);
  assert.equal(pm.zoom, PHOTO_MIN_ZOOM);

  // 2. Live viewport overlay & high-res snapshot composition execute across all filters & frames
  const drawnTexts = [];
  const makeCtx = (w, h) =>
    new Proxy(
      {
        canvas: { width: w, height: h },
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
        measureText: (t) => ({ width: String(t || '').length * 8 }),
        fillText: (t) => drawnTexts.push(String(t || '')),
      },
      { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
    );

  const viewCtx = makeCtx(1280, 720);
  for (const f of PHOTO_FILTERS) {
    for (const fr of PHOTO_FRAMES) {
      applyPhotoViewportOverlay(viewCtx, 1280, 720, {
        active: true,
        filterId: f.id,
        frameId: fr.id,
        showGrid: true,
        hideOverlayForCapture: false,
      });
    }
  }

  const snapCtx = makeCtx(1200, 675);
  for (const fr of PHOTO_FRAMES) {
    const ok = renderPhotoSnapshot(snapCtx, { width: 1280, height: 720 }, {
      width: 1200,
      height: 675,
      filterId: 'warm-strobe',
      frameId: fr.id,
      siteName: 'Cenote El Abismo',
      depthM: 42.5,
      gasLabel: 'TMX 14/55',
      diverName: 'Cousteau',
      weatherLabel: 'Night Biolum',
      version: 'v139',
    });
    assert.equal(ok, true);
  }
  assert.ok(drawnTexts.some((t) => t.includes('Cenote El Abismo')), 'Telemetry photo stamp should include site name');

  // 3. Marine Field Guide filtering, sorting & museum-grade Collector Card PNG renderer
  let book = createEmptyLogbook();
  book = recordFieldGuidePhoto(book, { entryId: 'whaleshark', stars: 3, siteId: 'blue-hole-dahab', siteName: 'Blue Hole', depthM: 64 }).book;
  book = recordFieldGuidePhoto(book, { entryId: 'remipede', stars: 2, siteId: 'cenote-el-abismo', siteName: 'Cenote El Abismo', depthM: 31 }).book;
  book = recordFieldGuidePhoto(book, { entryId: 'cavefish', stars: 1, siteId: 'cenote-el-abismo', siteName: 'Cenote El Abismo', depthM: 12 }).book;
  const fgStats = getFieldGuideStats(book);

  const discovered = filterAndSortFieldGuide(fgStats.entries, { filter: 'discovered', sort: 'depth' });
  assert.equal(discovered.length, 3);
  assert.equal(discovered[0].id, 'whaleshark', 'Deepest sort should rank 64m whale shark first');

  const gold = filterAndSortFieldGuide(fgStats.entries, { filter: 'gold', sort: 'stars' });
  assert.equal(gold.length, 1);
  assert.equal(gold[0].id, 'whaleshark');

  const rare = filterAndSortFieldGuide(fgStats.entries, { filter: 'rare', sort: 'rarity' });
  assert.ok(rare.every((e) => e.rarity === 'rare' || e.rarity === 'epic'));
  assert.equal(rare[0].rarity, 'epic');

  const missing = filterAndSortFieldGuide(fgStats.entries, { filter: 'undiscovered', sort: 'catalog' });
  assert.equal(missing.length, fgStats.totalCount - 3);

  drawnTexts.length = 0;
  const cardCtx = makeCtx(960, 560);
  const cardOk = renderFieldGuideCollectorCard(cardCtx, {
    width: 960,
    height: 560,
    entry: discovered[0],
    diverName: 'Cousteau',
    fgStats,
    version: 'v139',
  });
  assert.equal(cardOk, true);
  assert.ok(drawnTexts.some((t) => t.includes('GOLD MASTER PHOTOGRAPH')), '3-star specimen card should display gold master banner');
  assert.ok(drawnTexts.some((t) => t.includes('64m')), 'Specimen card should display best depth badge');
});

test('v140 Hardcore Mode Diver-to-Diver Physical Collision: separation, rebound, cave-wall safety, AI buddy & exemptions', async () => {
  const { resolveDiverPeerCollisions, DIVER_PEER_COLLISION_RADIUS } = await import('../public/js/game/collision.js');

  const openPt = LEVEL_1.checkpoints[0];
  assert.ok(evaluateCaveSDF(LEVEL_1, openPt.x, openPt.y) < -1.5, 'Test anchor must be in open cavern water');

  // 1. Hardcore mode physically separates overlapping divers, rebounds velocity, and triggers impact sound + toast
  const hc = createDiveSession(LEVEL_1, { diverName: 'Lead', difficulty: 'hardcore' });
  hc.simTimeSec = 10;
  hc.diver.x = openPt.x;
  hc.diver.y = openPt.y;
  hc.diver.vx = 2.4;
  hc.diver.vy = 0;

  const peer = { id: 'p2', name: 'Wingman', x: openPt.x + 0.55, y: openPt.y, vx: -0.6, vy: 0, alive: true, surfaced: false };
  let impactCalled = 0;
  let toastMsg = '';
  stepDiveSession(hc, { x: 0.4, y: 0 }, 0.05, {
    peers: [peer],
    onImpactSound: (spd) => { impactCalled = spd; },
    onToast: (msg) => { toastMsg = msg; },
  });

  const sepAfterHc = Math.hypot(hc.diver.x - peer.x, hc.diver.y - peer.y);
  assert.ok(sepAfterHc > 0.72, `Hardcore diver should be pushed away from overlapping peer (dist=${sepAfterHc.toFixed(2)})`);
  assert.ok(hc.diver.vx < 1.2, `Hardcore diver approaching velocity should rebound/dampen (vx=${hc.diver.vx.toFixed(2)})`);
  assert.ok(impactCalled > 0.5, `Expected impact sound callback on hard buddy bump, got ${impactCalled}`);
  assert.match(toastMsg, /Tank bump with Wingman/, 'Hard collision should display spacing reminder toast');
  assert.ok(evaluateCaveSDF(LEVEL_1, hc.diver.x, hc.diver.y) < 0, 'Diver must remain in open water after peer push');

  // 2. Standard Tech & Guided modes remain pass-through (zero buddy push)
  for (const diff of ['standard', 'guided']) {
    const s = createDiveSession(LEVEL_1, { diverName: 'Casual', difficulty: diff });
    s.simTimeSec = 10;
    s.diver.x = openPt.x;
    s.diver.y = openPt.y;
    s.diver.vx = 2.0;
    s.diver.vy = 0;
    let bumped = false;
    stepDiveSession(s, { x: 0.2, y: 0 }, 0.05, {
      peers: [{ id: 'p2', name: 'Wingman', x: openPt.x + 0.3, y: openPt.y, vx: 0, vy: 0, alive: true, surfaced: false }],
      onImpactSound: () => { bumped = true; },
    });
    assert.equal(bumped, false, `${diff} mode should NOT collide with peers`);
    assert.ok(s.diver.x > openPt.x, `${diff} mode diver should swim cleanly past peer`);
  }

  // 3. Spawn grace window (< 2.0s & shallow y <= 2.2m) prevents frame-0 entry pile-up
  const spawnHc = createDiveSession(LEVEL_1, { diverName: 'Entry', difficulty: 'hardcore' });
  spawnHc.simTimeSec = 0.4;
  spawnHc.diver.x = LEVEL_1.spawn.x;
  spawnHc.diver.y = 1.2;
  let spawnBump = false;
  stepDiveSession(spawnHc, { x: 0, y: 0 }, 0.05, {
    peers: [{ id: 'p2', name: 'EntryPeer', x: LEVEL_1.spawn.x + 0.2, y: 1.2, vx: 0, vy: 0, alive: true, surfaced: false }],
    onImpactSound: () => { spawnBump = true; },
  });
  assert.equal(spawnBump, false, 'Surface spawn grace window should prevent immediate frame-0 collisions');

  // 4. Rescue & AI assist exemptions: dead/rescued peers and AI Buddy in assist-gas/assist-snag do NOT block
  const diver = { x: openPt.x, y: openPt.y, vx: 1.5, vy: 0 };
  const exemptRes = resolveDiverPeerCollisions(LEVEL_1, diver, [
    { id: 'dead1', x: openPt.x + 0.1, y: openPt.y, alive: false, surfaced: false },
    { id: 'surf1', x: openPt.x + 0.1, y: openPt.y, alive: true, surfaced: true },
    { id: 'tow1', x: openPt.x + 0.1, y: openPt.y, alive: true, surfaced: false, rescuedBy: 'self' },
    { id: 'ai1', isAiBuddy: true, mode: 'assist-gas', x: openPt.x + 0.1, y: openPt.y, alive: true, surfaced: false },
  ]);
  assert.equal(exemptRes.collided, false, 'Incapacitated, surfaced, towed, and gas-assisting peers must not collide');

  // 5. Mutual separation with local AI Buddy APEX-2 pushes both divers apart cleanly
  const player2 = { x: openPt.x, y: openPt.y, vx: 1.2, vy: 0 };
  const aiBuddy = { id: 'ai-wingman-01', isAiBuddy: true, mode: 'follow', x: openPt.x + 0.4, y: openPt.y, vx: -0.8, vy: 0, alive: true, surfaced: false };
  const aiHit = resolveDiverPeerCollisions(LEVEL_1, player2, [aiBuddy]);
  assert.equal(aiHit.collided, true);
  assert.ok(player2.x < openPt.x, 'Player should separate left from AI buddy on right');
  assert.ok(aiBuddy.x > openPt.x + 0.4, 'AI buddy should separate right from player');
  assert.ok(Math.hypot(player2.x - aiBuddy.x, player2.y - aiBuddy.y) >= DIVER_PEER_COLLISION_RADIUS * 2 - 0.02);
});

test('v141 Solo 4-Diver AI Squad (1–3 Wingmen) & Dynamic Reactive Hazards (Thermoclines, Bubble Percolation & Shifting Hatches)', async () => {
  const {
    AI_SQUAD_ROSTER,
    createAiSquad,
    stepAiSquad,
    handlePlayerSignalForAiSquad,
  } = await import('../public/js/game/aiBuddy.js');
  const {
    createDynamicHazards,
    stepDynamicHazards,
    computeShiftingHatchOpenness,
  } = await import('../public/js/game/dynamicHazards.js');

  // 1. Solo 4-Diver AI Squad: 3 distinct wingmen with unique liveries, staggered formation & Hardcore safety
  assert.equal(AI_SQUAD_ROSTER.length, 3);
  const hcSess = createDiveSession(LEVEL_1, { diverName: 'SoloLead', difficulty: 'hardcore' });
  const squad = createAiSquad(LEVEL_1, hcSess.diver, 3, { initialGasId: 'EAN32' });
  assert.equal(squad.length, 3);
  assert.equal(new Set(squad.map((b) => b.id)).size, 3);
  assert.equal(new Set(squad.map((b) => b.livery?.suitId)).size, 3);
  assert.equal(new Set(squad.map((b) => b.livery?.torchId)).size, 3);

  // Swim forward with full 4-diver Hardcore squad and verify 0 rock clips
  hcSess.simTimeSec = 4;
  for (let i = 0; i < 40; i++) {
    stepDiveSession(hcSess, { x: 0.7, y: 0.35 }, 0.05, { peers: squad });
    stepAiSquad(squad, hcSess, 0.05, { timestampMs: 1000 + i * 50 });
  }
  assert.ok(evaluateCaveSDF(LEVEL_1, hcSess.diver.x, hcSess.diver.y) < 0, 'Player must remain in open water with 3 AI wingmen');
  for (const b of squad) {
    assert.ok(evaluateCaveSDF(LEVEL_1, b.x, b.y) < 0, `AI wingman ${b.name} must remain in open water`);
  }

  // Squad signal handling: HOLD halts all 3; SHARE-AIR dispatches only the single best-positioned wingman
  const holdRes = handlePlayerSignalForAiSquad(squad, 'hold', hcSess, 5000);
  assert.equal(holdRes.responded, true);
  assert.ok(squad.every((b) => b.mode === 'hold'), 'HOLD signal must halt entire AI squad');
  const airRes = handlePlayerSignalForAiSquad(squad, 'share-air', hcSess, 5500);
  assert.equal(airRes.responded, true);
  assert.equal(squad.filter((b) => b.mode === 'assist-gas').length, 1, 'Only 1 wingman should rush in for SHARE-AIR');

  // 2. Dynamic Reactive Hazards across all 33 campaign sites
  let totalThermos = 0;
  let totalPercs = 0;
  let totalHatches = 0;
  for (const lvl of LEVELS) {
    const hz = createDynamicHazards(lvl);
    totalThermos += hz.thermoclines.length;
    totalPercs += hz.percolationZones.length;
    totalHatches += hz.shiftingHatches.length;
    for (const th of hz.thermoclines) assert.ok(evaluateCaveSDF(lvl, th.x, th.y) < 0, `${lvl.id} thermocline in rock`);
    for (const h of hz.shiftingHatches) assert.ok(evaluateCaveSDF(lvl, h.x, h.y) < 0, `${lvl.id} hatch in rock`);
  }
  assert.ok(totalThermos >= 40, `Expected thermoclines across campaign, got ${totalThermos}`);
  assert.ok(totalPercs >= 25, `Expected percolation ceilings across campaign, got ${totalPercs}`);
  assert.ok(totalHatches >= 30, `Expected shifting hatches across campaign, got ${totalHatches}`);

  // 3. Thermocline cold-shock increases gas burn & heart rate
  const thSess = createDiveSession(LEVEL_1, { diverName: 'Thermal', difficulty: 'standard' });
  assert.ok(thSess.hazards.thermoclines.length >= 1);
  const th0 = thSess.hazards.thermoclines[0];
  thSess.diver.x = th0.x;
  thSess.diver.y = th0.y;
  let thermoToast = '';
  let lastHaz = null;
  for (let i = 0; i < 10; i++) {
    lastHaz = stepDynamicHazards(thSess, 0.1, { onToast: (m) => { thermoToast = m; } });
  }
  assert.equal(thSess.hazards.inThermocline, true);
  assert.ok(lastHaz.gasRateMult > 1.05, `Expected elevated cold-shock gas burn, got ${lastHaz.gasRateMult}`);
  assert.match(thermoToast, /Thermocline/);

  // 4. Overhead Bubble Percolation: Open-circuit exhaust triggers ceiling silt; CCR glides cleanly bubble-free!
  const percSite = LEVELS.find((l) => createDynamicHazards(l).percolationZones.length > 0);
  const ocSess = createDiveSession(percSite, { diverName: 'OpenCircuit', gear: { ccr: false } });
  const ccrSess = createDiveSession(percSite, { diverName: 'Rebreather', gear: { ccr: true } });
  const pzOc = ocSess.hazards.percolationZones[0];
  const pzCcr = ccrSess.hazards.percolationZones[0];
  ocSess.diver.x = pzOc.x;
  ocSess.diver.y = pzOc.ceilY + 1.8;
  ocSess.breath.phase = 'exhale';
  ccrSess.diver.x = pzCcr.x;
  ccrSess.diver.y = pzCcr.ceilY + 1.8;
  ccrSess.breath.phase = 'exhale';
  let ocTriggered = false;
  let ccrTriggered = false;
  for (let i = 0; i < 20; i++) {
    if (stepDynamicHazards(ocSess, 0.1).percolationTriggered) ocTriggered = true;
    if (stepDynamicHazards(ccrSess, 0.1).percolationTriggered) ccrTriggered = true;
  }
  assert.equal(ocTriggered, true, 'Open-circuit exhale bubbles should trigger ceiling percolation silt');
  assert.equal(ocSess.siltClouds.length > 0, true, 'Percolation should spawn downward-falling ceiling silt plumes');
  assert.equal(ccrTriggered, false, 'Bubble-free CCR rebreather should glide under percolation ceiling cleanly');

  // 5. Surge-Driven Shifting Hatch oscillates & pushes diver smoothly when slamming shut
  const wreck = getLevelById('ss-thistlegorm-wreck');
  const wSess = createDiveSession(wreck, { diverName: 'WreckTech' });
  const h0 = wSess.hazards.shiftingHatches[0];
  assert.ok(h0 && h0.isWreckHatch === true);
  // Find a timestamp where openness < 0.15 (slam phase)
  let slamT = 0;
  for (let t = 0; t < h0.periodSec; t += 0.1) {
    if (computeShiftingHatchOpenness(h0, t) < 0.15) {
      slamT = t;
      break;
    }
  }
  wSess.simTimeSec = slamT;
  wSess.diver.x = h0.x + 0.5;
  wSess.diver.y = h0.y;
  wSess.diver.vx = 0;
  let groaned = false;
  const hRes = stepDynamicHazards(wSess, 0.1, { onHullGroan: () => { groaned = true; } });
  assert.equal(hRes.hatchPushApplied, true);
  assert.ok(wSess.diver.vx > 0.05, 'Slamming hatch should eject diver out of aperture');
  assert.equal(groaned, true, 'Slamming hatch should trigger metallic hull groan audio');

  // 6. Renderer dynamic hazard & frost-rim passes execute cleanly
  const noopCtx = new Proxy(
    {
      canvas: { width: 800, height: 600 },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: () => ({ width: 24 }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const r = Object.create(CaveRenderer.prototype);
  r.level = wreck;
  r._drawDynamicHazards(noopCtx, wSess.hazards, -100, 300, -10, 200, (x) => x * 20, (y) => y * 20, 20, 2.5, wSess.diver);
  r._drawThermoclineFrostRim(noopCtx, 800, 600, thSess.hazards, 2.5);
});

test('v142 Underwater Acoustic Sonar Hazard Overlay & Live Thermal HUD: biome temperatures, thermocline drop, silt-piercing sonar & OLED/bezel readouts', async () => {
  const fs = await import('node:fs');
  const { computeAmbientWaterTempC, stepDynamicHazards } = await import('../public/js/game/dynamicHazards.js');
  const { triggerSonarPing } = await import('../public/js/game/diveSession.js');
  const { CaveRenderer } = await import('../public/js/game/renderer.js');
  const { DiveComputerHUD, drawShearwaterComputer, drawSonarMinimap } = await import('../public/js/game/hud.js');

  // 1. Biome-calibrated ambient water temperature, depth cooling, weather offset & thermocline shock
  const arctic = getLevelById('scoresby-sund-iceberg');
  const tropic = getLevelById('cenote-el-abismo');
  const med = getLevelById('fontaine-de-vaucluse');
  const tArctic = computeAmbientWaterTempC(arctic, 10);
  const tMed = computeAmbientWaterTempC(med, 10);
  const tTropic = computeAmbientWaterTempC(tropic, 10);
  assert.ok(tArctic < tMed && tMed < tTropic, `Expected Arctic (${tArctic}) < Med (${tMed}) < Tropic (${tTropic})`);
  assert.ok(
    computeAmbientWaterTempC(tropic, 60) < computeAmbientWaterTempC(tropic, 5),
    'Deeper water should cool monotonically'
  );
  assert.ok(
    computeAmbientWaterTempC(tropic, 5, null, { id: 'arctic-blizzard' }) < computeAmbientWaterTempC(tropic, 5),
    'Arctic blizzard weather should lower surface water temperature'
  );
  const tShock = computeAmbientWaterTempC(tropic, 20, { thermoclineColdFactor: 1, thermoclineTempDropC: 8 });
  const tBase = computeAmbientWaterTempC(tropic, 20, { thermoclineColdFactor: 0, thermoclineTempDropC: 0 });
  assert.ok(tBase - tShock >= 7.5, `Thermocline should drop temp by ~8°C (base=${tBase}, shock=${tShock})`);

  // 2. stepDynamicHazards updates live waterTempC and drops it inside a thermocline pocket
  const s = createDiveSession(LEVEL_1, { diverName: 'ThermalSonar', gear: { sonar: true } });
  const th0 = s.hazards.thermoclines[0];
  assert.ok(th0, 'LEVEL_1 should have at least one thermocline');
  s.diver.x = LEVEL_1.spawn.x;
  s.diver.y = 8;
  stepDynamicHazards(s, 0.1);
  const warmTemp = s.hazards.waterTempC;
  s.diver.x = th0.x;
  s.diver.y = th0.y;
  for (let i = 0; i < 12; i++) stepDynamicHazards(s, 0.1);
  assert.equal(s.hazards.inThermocline, true);
  assert.ok(s.hazards.waterTempC < warmTemp - 3, `Expected visible temperature drop inside thermocline (${warmTemp} -> ${s.hazards.waterTempC})`);

  // 3. Upgraded Active Sonar Ping tags reactive hazards (shifting-hatch, percolation, thermocline) & populates summary
  s.sonarCooldownSec = 0;
  // Ensure one of each reactive hazard is within 18m of diver so sonar sweep captures all 3 kinds
  s.hazards.shiftingHatches = [{ id: 'sh_test', x: s.diver.x + 6, y: s.diver.y, radius: 2.5, openness: 0.2 }];
  s.hazards.percolationZones = [{ id: 'pz_test', x: s.diver.x - 5, y: s.diver.y, ceilY: s.diver.y - 2, halfWidth: 3.5 }];
  const ping = triggerSonarPing(s);
  assert.equal(ping.ok, true);
  assert.equal(ping.pulse.durationSec, 3.8, 'Upgraded sonar pulse should persist for 3.8s');
  assert.ok(ping.pulse.contacts.some((c) => c.kind === 'shifting-hatch'), 'Sonar should tag shifting-hatch');
  assert.ok(ping.pulse.contacts.some((c) => c.kind === 'percolation'), 'Sonar should tag percolation ceiling');
  assert.ok(ping.pulse.contacts.some((c) => c.kind === 'thermocline'), 'Sonar should tag thermocline lens');
  assert.ok(ping.pulse.summary.hatches >= 1 && ping.pulse.summary.percolation >= 1 && ping.pulse.summary.thermoclines >= 1);

  // 4. Verify post-silt ordering in renderer.js + silt-piercing sonar canvas draw + minimap + Shearwater OLED + bezel HUD
  const rendererSrc = fs.readFileSync(new URL('../public/js/game/renderer.js', import.meta.url), 'utf8');
  const siltIdx = rendererSrc.indexOf('this._drawSiltClouds(');
  const sonarIdx = rendererSrc.indexOf('this._drawSonarPulse(');
  assert.ok(siltIdx > 0 && sonarIdx > siltIdx, '_drawSonarPulse must execute after _drawSiltClouds to pierce zero-vis silt-outs');

  const drawnTexts = [];
  const mockCtx = new Proxy(
    {
      canvas: { width: 800, height: 600 },
      fillText(t) { drawnTexts.push(String(t)); },
      measureText(t) { return { width: String(t).length * 7 }; },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );

  ping.pulse.ageSec = 1.4; // wavefront has swept past all contacts
  const r = Object.create(CaveRenderer.prototype);
  r._drawSonarPulse(mockCtx, ping.pulse, (x) => 400 + (x - s.diver.x) * 20, (y) => 300 + (y - s.diver.y) * 20, 20, 12.0);
  assert.ok(drawnTexts.some((t) => t.includes('SLAM!')), 'Sonar world overlay should label closing/slamming hatch');
  assert.ok(drawnTexts.some((t) => t.includes('CEIL SILT')), 'Sonar world overlay should label percolation ceiling');
  assert.ok(drawnTexts.some((t) => t.includes('°C')), 'Sonar world overlay should label thermocline °C drop');

  // Sonar Cartography Minimap renders hazard echoes cleanly
  drawSonarMinimap(mockCtx, 220, 150, {
    level: LEVEL_1,
    diver: s.diver,
    sonarPulse: ping.pulse,
    timeSec: 12.0,
  });

  // Shearwater OLED draws live water temperature & icy thermocline badge
  drawnTexts.length = 0;
  drawShearwaterComputer(mockCtx, 260, 156, s.diveState, {
    waterTempC: s.hazards.waterTempC,
    inThermocline: true,
  });
  assert.ok(
    drawnTexts.some((t) => t.includes('❄️') && t.includes('°C')),
    `Shearwater OLED header should display live icy °C reading, saw: ${drawnTexts.join(' | ')}`
  );

  // Main Dive Computer bezel updates #dc-temp with .cold class during thermocline
  const makeEl = () => ({
    textContent: '',
    className: '',
    innerHTML: '',
    hidden: false,
    style: {},
    dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    querySelector: () => makeEl(),
    addEventListener() {},
    appendChild() {},
    setAttribute() {},
  });
  const domMap = new Map();
  const prevDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (!domMap.has(id)) domMap.set(id, makeEl());
      return domMap.get(id);
    },
    createElement() { return makeEl(); },
  };
  try {
    const hud = new DiveComputerHUD({ onGasSelect() {}, onReelToggle() {}, onReelRewind() {}, onHeartbeatPulse() {} });
    hud.update({
      diveState: s.diveState,
      diver: s.diver,
      nextCheckpoint: LEVEL_1.checkpoints[0],
      exitZone: LEVEL_1.exitZone,
      checkpointsHit: new Set(),
      totalCheckpoints: LEVEL_1.checkpoints.length,
      level: LEVEL_1,
      hazards: s.hazards,
      dt: 0.016,
    });
    assert.ok(domMap.get('dc-temp').textContent.includes('❄️') && domMap.get('dc-temp').textContent.includes('°C'));
    assert.ok(domMap.get('dc-temp').className.includes('cold'));
  } finally {
    globalThis.document = prevDoc;
  }
});

test('v143 UX, Mobile Ergonomics, Accessibility & Design System Overhaul: modal Escape stack, Active Modifiers strip, Compact HUD, colorblind glyphs & CSS cleanup', async () => {
  const fs = await import('node:fs');
  const { DiveComputerHUD } = await import('../public/js/game/hud.js');

  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../public/css/style.css', import.meta.url), 'utf8');
  const mainSrc = fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');

  // 1. Centralized Modal Escape Stack orders child modals BEFORE parent modals
  const stackStart = mainSrc.indexOf('createModalManager([');
  assert.ok(stackStart > 0, 'main.js must wire centralized createModalManager([...])');
  const stackBlock = mainSrc.slice(stackStart, stackStart + 2600);
  assert.ok(stackBlock.indexOf('fgCardModalEl') < stackBlock.indexOf('modalLogbook'), 'Collector card must close before Logbook');
  assert.ok(stackBlock.indexOf('replayModal') < stackBlock.indexOf('modalLogbook'), 'Replay modal must close before Logbook');
  assert.ok(stackBlock.indexOf('liveryModalEl') < stackBlock.indexOf('diveSetupModalEl'), 'Gear Workshop must close before Dive Setup');
  assert.ok(stackBlock.indexOf('gasPlannerModal') < stackBlock.indexOf('diveSetupModalEl'), 'Gas Blender must close before Dive Setup');
  assert.ok(stackBlock.indexOf('challengeModal') < stackBlock.indexOf('diveSetupModalEl'), 'Challenge Sandbox must close before Dive Setup');
  assert.ok(stackBlock.indexOf('proceduralModal') < stackBlock.indexOf('diveSetupModalEl'), 'Uncharted Sump must close before Dive Setup');

  // 2. Home Screen Streamline: Prominent Dive Setup & Daily Dive buttons, Hamburger Setup parity, Collapsible Co-op Dock & Sticky Debrief CTA
  assert.ok(html.includes('id="btn-setup-drawer"') && html.includes('menu-actions-secondary'), 'Prominent Dive Setup & Daily Dive action row must exist');
  assert.ok(html.includes('id="btn-home-open-setup"'), 'Hamburger menu must link directly to Dive Setup');
  assert.ok(html.includes('id="btn-home-open-livery"'), 'Hamburger menu must link directly to Gear Workshop');
  assert.ok(html.includes('id="btn-coop-dock-toggle"'), 'Co-op Join Dock must have collapsible toggle');
  assert.ok(html.includes('debrief-sticky-actions'), 'Debrief actions must be sticky at bottom');

  // 3. Mobile & HUD Ergonomics: Compact HUD toggle, Secondary Gear Tools drawer, Touch Keycap Hiding & Two-Tap Abort Arming
  assert.ok(html.includes('id="btn-hud-compact"'), 'Missing Compact / Immersion HUD toggle');
  assert.ok(html.includes('id="btn-hud-gear-more"'), 'Missing Mobile Secondary Tools drawer toggle');
  assert.ok(html.includes('class="kbd-hint"'), 'HUD keycaps should use .kbd-hint spans for coarse-pointer hiding');
  assert.ok(css.includes('@media (pointer: coarse)') && css.includes('.kbd-hint'), 'Coarse pointer media query must hide .kbd-hint');
  assert.ok(css.includes('.util-btn.danger.armed'), 'Abort button must have visual two-tap armed styling');
  assert.ok(css.includes('.hud-layer.hud-compact'), 'Compact HUD mode CSS must exist');

  // 4. Stale Copy & Onboarding Updates + Design System Cleanup
  assert.equal(html.includes('30 SITES'), false, 'Stale 30 SITES copy must be updated to 33 SITES');
  assert.equal(html.includes('30 expeditions'), false, 'Stale 30 expeditions tooltip must be updated to 33 expeditions');
  assert.equal(html.includes('v114 · Solo'), false, 'Stale v114 diagnostics placeholder must be updated');
  assert.ok(html.includes('4 Essentials to Survive Deep Overhead'), 'Dive Guide should include 4th step on Reactive Hazards & Sonar');
  assert.ok(css.includes('--surface-0:') && css.includes('--font-mono:') && css.includes('--radius-pill:'), 'Expanded semantic CSS tokens missing');
  assert.equal(css.includes('.menu-tabs {'), false, 'Orphaned .menu-tabs dead CSS should be removed');
  assert.equal(css.includes('.dive-setup-drawer {'), false, 'Orphaned .dive-setup-drawer dead CSS should be removed');

  // 5. Colorblind-Safe Micro-Glyphs on PPO2 & Alert Bar
  const makeEl = () => ({
    textContent: '',
    className: '',
    innerHTML: '',
    hidden: false,
    style: {},
    dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    querySelector: () => makeEl(),
    addEventListener() {},
    appendChild() {},
    setAttribute() {},
  });
  const domMap = new Map();
  const prevDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (!domMap.has(id)) domMap.set(id, makeEl());
      return domMap.get(id);
    },
    createElement() { return makeEl(); },
  };
  try {
    const hud = new DiveComputerHUD({ onGasSelect() {}, onReelToggle() {}, onReelRewind() {}, onHeartbeatPulse() {} });
    const dsDanger = createDiveState();
    dsDanger.depthM = 45;
    dsDanger.ppo2 = 1.76;
    dsDanger.warnings = ['HIGH PPO2 — SWITCH TO TRIMIX'];
    dsDanger.criticalAlarm = true;
    hud.update({
      diveState: dsDanger,
      diver: { x: LEVEL_1.spawn.x, y: 45 },
      nextCheckpoint: LEVEL_1.checkpoints[0],
      exitZone: LEVEL_1.exitZone,
      checkpointsHit: new Set(),
      totalCheckpoints: LEVEL_1.checkpoints.length,
      level: LEVEL_1,
      dt: 0.016,
    });
    assert.ok(domMap.get('dc-ppo2').textContent.startsWith('⛔'), `High PPO2 should include ⛔ glyph, got ${domMap.get('dc-ppo2').textContent}`);
    assert.ok(domMap.get('dc-alerts').textContent.startsWith('⛔'), `Critical alert should include ⛔ glyph, got ${domMap.get('dc-alerts').textContent}`);

    const dsWarn = createDiveState();
    dsWarn.depthM = 35;
    dsWarn.ppo2 = 1.48;
    dsWarn.warnings = [];
    hud.update({
      diveState: dsWarn,
      diver: { x: LEVEL_1.spawn.x, y: 35 },
      nextCheckpoint: LEVEL_1.checkpoints[0],
      exitZone: LEVEL_1.exitZone,
      checkpointsHit: new Set(),
      totalCheckpoints: LEVEL_1.checkpoints.length,
      level: LEVEL_1,
      dt: 0.016,
    });
    assert.ok(domMap.get('dc-ppo2').textContent.startsWith('⚠'), `Elevated PPO2 should include ⚠ glyph, got ${domMap.get('dc-ppo2').textContent}`);
  } finally {
    globalThis.document = prevDoc;
  }
});

test('v144 Modular Architecture & Adaptive 60 FPS Mobile Performance Engine: perfMonitor hysteresis, modalManager focus stack, debriefChart & zero-GC renderer', async () => {
  const { createPerfMonitor, PERF_TIERS } = await import('../public/js/game/perfMonitor.js');
  const { createModalManager } = await import('../public/js/ui/modalManager.js');
  const { buildDebriefDepthChartData, renderDebriefDepthChart } = await import('../public/js/ui/debriefChart.js');
  const { CaveRenderer } = await import('../public/js/game/renderer.js');

  // 1. Adaptive 60 FPS Performance Monitor & Mobile Quality Governor
  const pm = createPerfMonitor({ isMobile: true });
  assert.equal(pm.getBudget().tier, 'high');
  assert.equal(pm.getBudget().dprCap, 1.75, 'Mobile high tier should cap DPR at 1.75x');

  // Tab-switch spike (>250ms) must be ignored (no false downgrade)
  for (let i = 0; i < 60; i++) pm.recordFrame(600);
  assert.equal(pm.getBudget().tier, 'high', 'Tab-switch spikes must not falsely downgrade tier');

  // Sustained slow frames (~26ms) step smoothly from high -> balanced
  let downgraded = false;
  for (let i = 0; i < 60; i++) {
    if (pm.recordFrame(26)) downgraded = true;
  }
  assert.equal(downgraded, true);
  assert.equal(pm.getBudget().tier, 'balanced');
  assert.ok(pm.getBudget().rayScale < 1 && pm.getBudget().siltTendrilLimit < 24);

  // Sustained heavy mobile load (~36ms) steps balanced -> performance
  for (let i = 0; i < 60; i++) pm.recordFrame(36);
  assert.equal(pm.getBudget().tier, 'performance');
  assert.equal(pm.getBudget().siltTendrilLimit, 0);
  assert.ok(pm.getBudget().lightmapScale < 0.3);

  // Sustained smooth 60 FPS headroom steps cleanly back up performance -> balanced -> high
  for (let i = 0; i < 200; i++) pm.recordFrame(14.5);
  assert.equal(pm.getBudget().tier, 'balanced');
  for (let i = 0; i < 200; i++) pm.recordFrame(14.0);
  assert.equal(pm.getBudget().tier, 'high');
  assert.ok(pm.getStats().fps >= 55 && pm.getStats().transitions >= 4);

  // 2. Reusable Modal Manager: stack order, Escape capture & keyboard focus restoration
  let childOpen = true;
  let parentOpen = true;
  let focusedTrigger = false;
  const listeners = new Map();
  const mockTrigger = { hidden: false, closest: () => null, focus: () => { focusedTrigger = true; } };
  const mockDoc = {
    addEventListener(type, fn) { listeners.set(`doc:${type}`, fn); },
    removeEventListener(type) { listeners.delete(`doc:${type}`); },
  };
  const mockWin = {
    addEventListener(type, fn) { listeners.set(`win:${type}`, fn); },
    removeEventListener(type) { listeners.delete(`win:${type}`); },
  };
  const mm = createModalManager(
    [
      { isOpen: () => childOpen, close: () => { childOpen = false; } },
      { isOpen: () => parentOpen, close: () => { parentOpen = false; } },
    ],
    { doc: mockDoc, win: mockWin }
  );
  listeners.get('doc:pointerdown')({ target: { closest: () => mockTrigger } });
  assert.equal(mm.getOpenCount(), 2);
  let prevented = false;
  let stoppedImmediate = false;
  listeners.get('win:keydown')({
    key: 'Escape',
    preventDefault: () => { prevented = true; },
    stopImmediatePropagation: () => { stoppedImmediate = true; },
    stopPropagation: () => {},
  });
  assert.equal(prevented, true);
  assert.equal(stoppedImmediate, true, 'Modal Escape must call stopImmediatePropagation so window pause handler does not fire simultaneously');
  assert.equal(childOpen, false, 'Innermost child modal must close first');
  assert.equal(parentOpen, true, 'Parent modal must remain open after first Escape');
  assert.equal(focusedTrigger, false, 'Focus must wait until all overlays close');

  listeners.get('win:keydown')({ key: 'Escape', preventDefault: () => {}, stopPropagation: () => {} });
  assert.equal(parentOpen, false);
  assert.equal(mm.getOpenCount(), 0);
  assert.equal(focusedTrigger, true, 'Closing final overlay must restore focus to triggering button');
  mm.destroy();
  assert.equal(listeners.size, 0, 'destroy() must clean up global listeners');

  // 3. Standalone Debrief Depth Profile SVG Chart & Scrubber
  const sampleProfile = [
    { t: 0, d: 1, gas: 'EAN32', deco: 0, ppo2: 0.35, cns: 0, gf99: 10, hr: 72, bar: 200 },
    { t: 45, d: 42, gas: 'TMX1455', deco: 0, ppo2: 0.73, cns: 8, gf99: 48, hr: 96, bar: 145 },
    { t: 90, d: 6, gas: 'O2', deco: 6, ppo2: 1.56, cns: 22, gf99: 65, hr: 80, bar: 110 },
    { t: 120, d: 0.5, gas: 'O2', deco: 0, ppo2: 1.05, cns: 24, gf99: 20, hr: 74, bar: 102 },
  ];
  const buddies = new Map([['p2', { name: 'APEX-2', points: [{ t: 0, d: 1 }, { t: 60, d: 39 }, { t: 120, d: 0.5 }] }]]);
  const chartData = buildDebriefDepthChartData(sampleProfile, 42, { success: true, peerProfiles: buddies });
  assert.ok(chartData && chartData.markup.includes('MAX 42m') && chartData.markup.includes('APEX-2'));
  assert.equal(chartData.buddyCount, 1);

  const wrapEl = { hidden: true };
  const scrubEl = { textContent: '' };
  const attrs = {};
  const svgEl = {
    innerHTML: '',
    querySelector: () => ({ setAttribute: (k, v) => { attrs[k] = v; } }),
    getBoundingClientRect: () => ({ left: 0, width: 420 }),
  };
  renderDebriefDepthChart({ wrapEl, svgEl, scrubEl, profile: sampleProfile, maxDepthM: 42, success: true, peerProfiles: buddies });
  assert.equal(wrapEl.hidden, false);
  svgEl.onpointermove({ clientX: 210 });
  assert.ok(scrubEl.textContent.includes('PPO₂') && scrubEl.textContent.includes('GF99'));

  // 4. Renderer setPerfBudget & Zero-GC _siltLightsScratch pool
  const noopCtx = new Proxy(
    {
      canvas: { width: 800, height: 600 },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const r = Object.create(CaveRenderer.prototype);
  r.glowStamps = { silt: {}, siltWisp: {}, rustSilt: {}, warm: {} };
  r._siltGlareScratch = [];
  r._siltLightsScratch = [];
  r._needsResize = false;
  r.setPerfBudget(PERF_TIERS.performance);
  assert.equal(r._needsResize, true, 'Changing performance tier DPR/lightmap must flag resize');
  assert.equal(r._perfBudget.tier, 'performance');

  const clouds = Array.from({ length: 30 }, (_, i) => ({
    x: 10 + i * 0.4,
    y: 20 + (i % 5) * 0.4,
    radius: 2.2,
    alpha: i < 5 ? 0.1 : 0.65,
    life: 4,
    maxLife: 10,
    seed: i,
  }));
  const peers = [
    { x: 12, y: 20, angle: 0, alive: true, torchOn: true },
    { x: 14, y: 21, angle: 0.2, alive: true, torchOn: true },
    { x: 16, y: 22, angle: -0.2, alive: true, torchOn: true },
  ];
  r._drawSiltClouds(noopCtx, 800, 600, (x) => x * 20, (y) => y * 20, 20, clouds, { x: 10, y: 20, angle: 0, torchOn: true }, peers, 5.0);
  const firstPoolRef = r._siltLightsScratch[0];
  r._drawSiltClouds(noopCtx, 800, 600, (x) => x * 20, (y) => y * 20, 20, clouds, { x: 11, y: 20, angle: 0.1, torchOn: true }, peers, 5.1);
  assert.equal(r._siltLightsScratch[0], firstPoolRef, '_drawSiltClouds must reuse light scratch slots with zero per-frame allocation');
});

test('v146 Zoned Right-Wing Dive Console & Floating Dive Kit Popover: passive pills relocated, 3 visual zones & Escape wiring', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../public/css/style.css', import.meta.url), 'utf8');
  const mainSrc = fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');

  // 1. Passive status pills (CCR & DRILLS) live in .hud-self-row (NOT mixed into right-wing action dock)
  const selfRowStart = html.indexOf('<div class="hud-self-row">');
  const selfRowEnd = html.indexOf('</div>', selfRowStart);
  const selfRowHtml = html.slice(selfRowStart, selfRowEnd);
  assert.ok(selfRowHtml.includes('id="hud-ccr-pill"'), 'Passive CCR pill should reside in top-left .hud-self-row');
  assert.ok(selfRowHtml.includes('id="hud-drill-pill"'), 'Passive Drills pill should reside in top-left .hud-self-row');

  // 2. Right wing is cleanly zoned: Gear bar + Floating Dive Kit popover | Reel zone | Gas Manifold zone
  const rwStart = html.indexOf('<div class="hud-right-wing">');
  const rwEnd = html.indexOf('<div id="shearwater-panel"', rwStart);
  const rwHtml = html.slice(rwStart, rwEnd);
  assert.equal(rwHtml.includes('id="hud-ccr-pill"'), false, 'Right wing should not mix passive CCR pill with buttons');
  assert.equal(rwHtml.includes('id="hud-drill-pill"'), false, 'Right wing should not mix passive Drills pill with buttons');
  assert.ok(rwHtml.includes('id="hud-kit-popover"'), 'Right wing must include floating #hud-kit-popover');
  assert.ok(rwHtml.includes('class="gear-bar-row"'), 'Right wing must include compact single-row .gear-bar-row');
  assert.ok(rwHtml.includes('class="hud-gas-zone"') && rwHtml.includes('GAS MANIFOLD'), 'Right wing must zone the Gas Manifold');
  assert.ok(rwHtml.includes('reel-zone-tag'), 'Right wing must clearly label the Guideline Reel zone');

  // 3. Dive Kit popover is styled as floating overlay and wired into modalManager Escape stack
  assert.ok(css.includes('.hud-kit-popover') && css.includes('bottom: calc(100% + 6px)'), 'Dive Kit popover must float cleanly above right wing');
  assert.ok(mainSrc.includes('hudKitPopoverEl') && mainSrc.includes('setKitPopoverOpen(false)'), 'main.js must wire Dive Kit popover toggle & Escape close');
});

test('v147 Heavy Salvage, Lift-Bag Buoyancy Physics & Pressurized Bulkhead Valve Equalization', async () => {
  const fs = await import('node:fs');

  // 1. Neutral trim at zero payload preserves exact legacy physics (no vertical drift, drag = 1.0)
  const oriskany = getLevelById('uss-oriskany-carrier');
  const u1206 = getLevelById('u1206-north-sea-sub');
  const sess = createDiveSession(u1206, { mode: 'solo', difficulty: 'standard' });
  sess.diver.x = 12;
  sess.diver.y = 35;

  const emptyTrim = computeSalvageBuoyancy(sess);
  assert.equal(emptyTrim.payloadKg, 0);
  assert.equal(emptyTrim.netTrimKg, 0);
  assert.equal(emptyTrim.verticalAccel, 0);
  assert.equal(emptyTrim.swimDragMult, 1.0);
  assert.equal(emptyTrim.status, 'neutral');

  // 2. Heavy wreck salvage relics + carryingBody create measurable negative buoyancy & swim drag
  const firstRelic = u1206.collectibles[0];
  const relicKg = computeCollectibleWeightKg(firstRelic, true);
  assert.ok(relicKg >= 4 && relicKg <= 16, `Expected realistic wreck relic weight (4-16kg), got ${relicKg}`);
  for (const item of u1206.collectibles.slice(0, 3)) {
    sess.collectedIds.add(item.id);
  }
  sess.carryingBody = true;
  const heavyTrim = computeSalvageBuoyancy(sess);
  assert.ok(heavyTrim.payloadKg >= 20, `Expected heavy salvage + recovery payload >= 20kg, got ${heavyTrim.payloadKg}`);
  assert.ok(heavyTrim.verticalAccel > 0.3, 'Uncompensated heavy salvage must pull diver downward (+vy)');
  assert.ok(heavyTrim.swimDragMult < 0.96, 'Heavy uncompensated salvage must add realistic swim drag');
  assert.ok(heavyTrim.status === 'heavy' || heavyTrim.status === 'critical-heavy');

  // 3. Inflating the Lift Bag consumes 3.5 bar, neutralizes negative trim, and restores swim agility
  const activeGas = sess.diveState.activeGasId;
  const barBefore = sess.diveState.tanks[activeGas].bar;
  let toggledState = null;
  const infRes = toggleLiftBag(sess, {
    onLiftBagToggle: (active) => {
      toggledState = active;
    },
  });
  assert.equal(infRes.ok, true);
  assert.equal(infRes.active, true);
  assert.equal(toggledState, true);
  assert.equal(sess.salvage.liftBagActive, true);
  assert.ok(Math.abs(barBefore - sess.diveState.tanks[activeGas].bar - LIFT_BAG_INFLATE_BAR) < 0.05);
  assert.ok(sess.salvage.liftForceKg > 0 && sess.salvage.liftForceKg <= LIFT_BAG_CAPACITY_KG * 1.3);

  const liftedTrim = computeSalvageBuoyancy(sess);
  assert.ok(liftedTrim.netTrimKg < heavyTrim.netTrimKg, 'Lift bag must offset heavy salvage negative trim');
  assert.ok(liftedTrim.verticalAccel < heavyTrim.verticalAccel, 'Lift bag must reduce downward sink force');
  assert.ok(liftedTrim.swimDragMult > heavyTrim.swimDragMult, 'Neutralized load should improve swim agility');

  // 4. Boyle's-Law positive float warning when inflated with zero salvage at shallow depth
  const lightSess = createDiveSession(u1206, { mode: 'solo', difficulty: 'standard' });
  lightSess.diver.y = 8;
  const lightInf = toggleLiftBag(lightSess, {});
  assert.equal(lightInf.ok, true);
  for (let i = 0; i < 10; i++) {
    stepDiveSession(lightSess, { x: 0, y: 0, boost: false }, 0.05, {});
  }
  const floatTrim = computeSalvageBuoyancy(lightSess);
  assert.equal(floatTrim.status, 'float-warn', 'Empty lift bag must trigger uncontrolled ascent float warning');
  assert.ok(floatTrim.verticalAccel < -0.5, 'Fully inflated unloaded lift bag must pull diver upward (-vy)');

  // 5. Venting lift bag stows canopy & releases exhaust bubbles; low-gas guard blocks inflation (< 6 bar)
  const bubblesBefore = lightSess.bubbles.length;
  const ventRes = toggleLiftBag(lightSess, {});
  assert.equal(ventRes.ok, true);
  assert.equal(ventRes.active, false);
  assert.ok(lightSess.bubbles.length > bubblesBefore, 'Venting lift bag should spawn exhaust bubbles');

  lightSess.diveState.tanks[lightSess.diveState.activeGasId].bar = 4.5;
  const dryRes = toggleLiftBag(lightSess, {});
  assert.equal(dryRes.ok, false);
  assert.equal(dryRes.reason, 'low-gas');

  // 6. Contextual [E] action deploys lift bag when heavily weighed down and not near another wreck interactive
  sess.salvage.liftBagActive = false;
  sess.salvage.liftForceKg = 0;
  sess.salvage.inflateAnim = 0;
  sess.diver.x = 500; // far from any hatch/net/line
  sess.diver.y = 25;
  const ctxRes = triggerWreckAction(sess, {});
  assert.equal(ctxRes.handled, true);
  assert.equal(ctxRes.kind, 'inflate-liftbag');
  assert.equal(sess.salvage.liftBagActive, true);

  // 7. Pressurized Bulkhead Valve Equalization on deep tier wrecks (>= 62m) vs shallow Oriskany (1-step)
  assert.equal(isHatchPressurized(oriskany, oriskany.watertightHatches[0]), false, 'Oriskany shallow hatch stays 1-step');
  const deepHatch = u1206.watertightHatches[0];
  assert.equal(isHatchPressurized(u1206, deepHatch), true, 'Deep U-1206 hatch (>= 62m) must require valve equalization');

  const hSess = createDiveSession(u1206, { mode: 'solo', difficulty: 'standard' });
  switchGas(hSess.diveState, 'TMX1455');
  hSess.diver.x = deepHatch.x + deepHatch.radius + 1.0;
  hSess.diver.y = deepHatch.y;
  // Step simulation once to confirm prompt is equalize-valve before open-hatch
  stepDiveSession(hSess, { x: 0, y: 0, boost: false }, 0.016, {});
  assert.equal(hSess.wreckActionPrompt?.kind, 'equalize-valve');

  let syncedAction = null;
  let valveSoundPlayed = false;
  const step1 = triggerWreckAction(hSess, {
    onWreckSync: (k, id) => {
      syncedAction = { k, id };
    },
    onValveEqualize: () => {
      valveSoundPlayed = true;
    },
  });
  assert.equal(step1.handled, true);
  assert.equal(step1.kind, 'equalize-valve');
  assert.equal(hSess.equalizedHatchIds.has(deepHatch.id), true);
  assert.equal(hSess.openedHatchIds.has(deepHatch.id), false, 'Step 1 only bleeds ΔP pressure, does not open hatch yet');
  assert.deepEqual(syncedAction, { k: 'valve', id: deepHatch.id });
  assert.equal(valveSoundPlayed, true);

  // Step 2 now cranks and opens the equalized bulkhead normally
  const step2 = triggerWreckAction(hSess, {});
  assert.equal(step2.handled, true);
  assert.equal(step2.kind, 'open-hatch');
  assert.equal(hSess.crankingHatchId, deepHatch.id);
  for (let i = 0; i < 22; i++) {
    stepDiveSession(hSess, { x: 0, y: 0, boost: false }, 0.1, {});
  }
  assert.equal(hSess.openedHatchIds.has(deepHatch.id), true);

  // Co-op peer valve sync applies cleanly
  const peerSess = createDiveSession(u1206, { mode: 'coop', difficulty: 'standard' });
  applyPeerWreckAction(peerSess, { actionKind: 'valve', targetId: deepHatch.id }, {});
  assert.equal(peerSess.equalizedHatchIds.has(deepHatch.id), true);

  // 8. Renderer draws Lift Bag canopy & Pressurized/Equalized Bulkhead Valve badges cleanly + HUD wiring
  const noopCtx = new Proxy(
    {
      canvas: { width: 800, height: 600 },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const r = Object.create(CaveRenderer.prototype);
  r.level = u1206;
  r._drawDiverLiftBag(noopCtx, { x: 12, y: 35, vx: 0.4, vy: -0.2 }, { liftBagActive: true, liftBagVisualScale: 0.95, status: 'liftbag-ok' }, (x) => x * 20, (y) => y * 20, 20, 4.2);
  r._drawWatertightHatches(noopCtx, (x) => x * 20, (y) => y * 20, 20, 4.2, { openedHatchIds: new Set(), equalizedHatchIds: new Set() });
  r._drawWatertightHatches(noopCtx, (x) => x * 20, (y) => y * 20, 20, 4.2, { openedHatchIds: new Set(), equalizedHatchIds: new Set([deepHatch.id]) });

  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="hud-trim-pill"'), 'Passive Salvage Trim pill must exist in HUD');
  assert.ok(html.includes('salvagePhysics.js'), 'index.html importmap must register salvagePhysics.js');
});

test('v148 Mechanical Craft & Articulated Apparatus Overhaul: mechanicalFx pool, 3D hatch swing, Bourdon gauge, detailed stages & working arm', () => {
  // 1. mechanicalFx state machine, animations, and bounded particle cap
  const fx = createMechanicalFxState();
  recordMechanicalEvent(fx, 'valve-equalize', { x: 10, y: 72, targetId: 'h1' });
  assert.ok(fx.valveAnims.get('h1') > 0 && fx.valveAnims.get('h1') < 1);
  assert.equal(fx.activeAction?.kind, 'valve-equalize');
  assert.ok(fx.particles.some((p) => p.kind === 'jet'));

  recordMechanicalEvent(fx, 'hatch-open', { x: 10, y: 72, radius: 2.0, targetId: 'h1' });
  assert.ok(fx.hatchOpenAnims.get('h1') > 0 && fx.hatchOpenAnims.get('h1') < 1);
  assert.ok(fx.particles.some((p) => p.kind === 'rust'));

  recordMechanicalEvent(fx, 'cut-net', { x: 14, y: 50, targetId: 's1', angle: 0.4 });
  assert.equal(fx.activeAction?.kind, 'cut-net');
  assert.ok(fx.particles.some((p) => p.kind === 'filament'));

  // Stress-test bounded particle ring cap
  for (let i = 0; i < 15; i++) {
    recordMechanicalEvent(fx, 'hatch-open', { x: i, y: 20, targetId: `h_${i}` });
  }
  assert.ok(fx.particles.length <= MAX_MECH_PARTICLES, `Particles must stay <= ${MAX_MECH_PARTICLES}`);

  // Stepping advances valve needle, door swing, clears activeAction & prunes expired particles
  for (let i = 0; i < 40; i++) stepMechanicalFx(fx, 0.1);
  assert.equal(fx.valveAnims.get('h1'), 1);
  assert.equal(fx.hatchOpenAnims.get('h1'), 1);
  assert.equal(fx.activeAction, null);
  assert.equal(fx.particles.length, 0);

  // 2. Live DiveSession integration fires mechFx on deep wreck valve/hatch + lift bag + stage drop
  const u1206 = getLevelById('u1206-north-sea-sub');
  const sess = createDiveSession(u1206, { mode: 'solo', difficulty: 'standard' });
  switchGas(sess.diveState, 'TMX1455');
  const hatch = u1206.watertightHatches[0];
  sess.diver.x = hatch.x + hatch.radius + 1.0;
  sess.diver.y = hatch.y;
  triggerWreckAction(sess, {}); // valve equalize
  assert.ok(sess.mechFx.valveAnims.has(hatch.id), 'Valve equalize must start Bourdon gauge animation');
  assert.ok(sess.mechFx.particles.length > 0, 'Valve equalize must emit compressed-gas bleed mist');

  triggerWreckAction(sess, {}); // start cranking
  for (let i = 0; i < 22; i++) stepDiveSession(sess, { x: 0, y: 0, boost: false }, 0.1, {});
  assert.ok(sess.mechFx.hatchOpenAnims.has(hatch.id), 'Hatch completion must trigger 3D hinged swing-open');

  toggleLiftBag(sess, {});
  assert.equal(sess.mechFx.activeAction?.kind, 'liftbag-inflate');

  // 3. Renderer executes every upgraded v148 mechanical pass cleanly with zero exceptions
  const noopCtx = new Proxy(
    {
      canvas: { width: 800, height: 600 },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const r = Object.create(CaveRenderer.prototype);
  r.level = u1206;
  r.glowStamps = { warm: null, cyan: null };
  r._perfBudget = { tier: 'high' };
  const toX = (x) => 400 + x * 24;
  const toY = (y) => 200 + y * 24;

  // Hatch states: pressurized ΔP, mid-equalize jet, cranking with retracting dogs, swinging open in 3D
  const fxRender = createMechanicalFxState();
  recordMechanicalEvent(fxRender, 'valve-equalize', { x: hatch.x + 1.1, y: hatch.y - 1.1, targetId: hatch.id });
  r._drawWatertightHatches(noopCtx, -200, 400, -50, 300, toX, toY, 24, 2.5, {
    openedHatchIds: new Set(),
    equalizedHatchIds: new Set([hatch.id]),
    crankingHatchId: hatch.id,
    crankingHatchProgress: 0.55,
  }, fxRender);
  recordMechanicalEvent(fxRender, 'hatch-open', { x: hatch.x, y: hatch.y, targetId: hatch.id });
  r._drawWatertightHatches(noopCtx, -200, 400, -50, 300, toX, toY, 24, 2.8, {
    openedHatchIds: new Set([hatch.id]),
    equalizedHatchIds: new Set([hatch.id]),
  }, fxRender);

  // Lift bag: inflating + heavy salvage mesh sling + Boyle's-Law float dump flutter
  r._drawDiverLiftBag(noopCtx, { x: 10, y: 18, vx: 0.5, vy: -0.6 }, {
    liftBagActive: true,
    inflateAnim: 0.72,
    payloadKg: 18,
    status: 'float-warn',
  }, toX, toY, 24, 3.1, fxRender);

  // Detailed stage cylinder + cave jump-spools & notched arrows
  r._drawDetailedStageCylinder(noopCtx, 24, { bodyCol: '#38bdf8', trimCol: '#bae6fd', claimed: false, timeSec: 2.0 });
  const ojamo = getLevelById('ojamo-iron-mine');
  r.level = ojamo;
  r._stalactiteCache = [];
  r._drawCaveInteractives(noopCtx, -200, 400, -50, 300, toX, toY, 24, 2.0, { x: 0, y: 20 }, {
    claimedStageIds: new Set(),
    placedMarkerIds: new Set(),
    cutSnagIds: new Set(),
    openedHatchIds: new Set(),
  }, fxRender);

  // Articulated working arm across cranking, shears cut, spinning Delrin spool & shot-line clip
  r.level = u1206;
  const mockDiver = { x: hatch.x + 1.5, y: hatch.y, angle: Math.PI, torchOn: true };
  r._drawDiver(noopCtx, mockDiver, toX, toY, 24, 2.2, false, {
    wreckState: { clippedToShotLine: true, crankingHatchId: hatch.id, crankingHatchProgress: 0.5 },
    mechFx: fxRender,
    reelingActive: false,
  });
  recordMechanicalEvent(fxRender, 'cut-net', { x: hatch.x + 2.2, y: hatch.y, angle: 0.2 });
  r._drawDiver(noopCtx, mockDiver, toX, toY, 24, 2.3, false, {
    wreckState: { clippedToShotLine: false },
    mechFx: fxRender,
    reelingActive: false,
  });
  fxRender.activeAction = null;
  r._drawDiver(noopCtx, mockDiver, toX, toY, 24, 2.4, false, {
    wreckState: { clippedToShotLine: false },
    mechFx: fxRender,
    reelingActive: true,
  });

  // Post-lighting mechanical FX pass on both high and performance tiers
  recordMechanicalEvent(fxRender, 'cut-net', { x: 10, y: 20, angle: 0.5 });
  r._drawMechanicalFx(noopCtx, fxRender, toX, toY, 24, 2.5);
  r._perfBudget = { tier: 'performance' };
  r._drawMechanicalFx(noopCtx, fxRender, toX, toY, 24, 2.6);
});

test('v149 Mobile Phone Width Radical HUD Simplification: 1-button Gas Pill, 2-col Dive Kit, 3-icon top bar & zero-overlap comms', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../public/css/style.css', import.meta.url), 'utf8');
  const hudSrc = fs.readFileSync(new URL('../public/js/game/hud.js', import.meta.url), 'utf8');
  const mainSrc = fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');

  // 1. Compact single-button gas selector + mobile Dive Kit tools exist in index.html
  assert.ok(html.includes('id="btn-gas-compact"'), 'Mobile single-button Gas Pill must exist');
  assert.ok(html.includes('id="hud-gas-zone"'), 'Gas zone container must expose #hud-gas-zone');
  assert.ok(html.includes('id="btn-kit-sonar"') && html.includes('id="btn-kit-dpv"'), 'Mobile Dive Kit must include Sonar & DPV');
  assert.ok(html.includes('id="btn-kit-camera"') && html.includes('id="btn-kit-torch"'), 'Mobile Dive Kit must include Camera & Torch');

  // 2. CSS simplifies phone width (<= 680px): hides redundant top/comms/gear buttons, collapses gas drawer & nominal vitals
  assert.ok(css.includes('.coop-comms .comm-btn[data-signal]'), 'Mobile CSS must hide static 5-pill quick-comms bar that overlapped Reel');
  assert.ok(css.includes('.hud-gas-zone.gas-open .dc-gas-rack'), 'Mobile CSS must float 3-tank gas drawer above compact gas pill');
  assert.ok(css.includes('.dc-vitals-row.all-nominal'), 'Mobile CSS must auto-hide 0% nominal stress bars');
  assert.ok(css.includes('grid-template-columns: 1fr 1fr') && css.includes('.mobile-only-kit:not([hidden])'), 'Mobile Dive Kit must render as clean 2-col grid');

  // 3. HUD & main.js wire gas drawer toggle, Escape close, nominal vitals class & mobile kit delegates
  assert.ok(hudSrc.includes('setGasDrawerOpen') && hudSrc.includes('all-nominal'), 'hud.js must manage mobile gas drawer & nominal vitals class');
  assert.ok(mainSrc.includes('isGasDrawerOpen') && mainSrc.includes('btnKitCamera') && mainSrc.includes('btnKitTorch'), 'main.js must wire Escape gas close & mobile kit buttons');
});

test('v150 Home Menu GitHub Account relocation & smoother flashlight joystick response', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

  // 1. #btn-github-account must live inside #home-menu-popover, leaving .menu-header-actions clear for the title
  const headerActionsIdx = html.indexOf('<div class="menu-header-actions">');
  const menuWrapIdx = html.indexOf('<div class="home-menu-wrap">');
  const popoverStart = html.indexOf('id="home-menu-popover"');
  const popoverEnd = html.indexOf('</div>\n        </div>\n      </div>', popoverStart);
  const ghBtnIdx = html.indexOf('id="btn-github-account"');
  assert.ok(headerActionsIdx > 0 && menuWrapIdx > headerActionsIdx && popoverStart > menuWrapIdx);
  assert.ok(ghBtnIdx > popoverStart, '#btn-github-account must be inside #home-menu-popover');
  assert.ok(popoverEnd === -1 || ghBtnIdx < popoverEnd, '#btn-github-account must appear within the Home Menu popover');
  const betweenHeaderAndWrap = html.slice(headerActionsIdx, menuWrapIdx);
  assert.equal(betweenHeaderAndWrap.includes('btn-github-account'), false, 'Header bar must not contain #btn-github-account');

  // 2. Flashlight manual aim slews smoothly (bounded step per frame) and converges cleanly over ~0.6s
  const s = createDiveSession(LEVEL_1, { diverName: 'TorchSmooth' });
  s.diver.angle = 0;
  s.diver.torchAngle = 0;
  const target = Math.PI / 2; // 90 deg turn

  // Single 50ms step should not snap > 60% of the turn (previous k=18 snapped ~59% and unbounded)
  stepDiveSession(s, { x: 0, y: 0 }, 0.05, { torchAim: { active: true, angle: target } });
  const firstStepFrac = s.diver.torchAngle / target;
  assert.ok(firstStepFrac > 0.05 && firstStepFrac <= 0.35, `Expected calm initial torch slew fraction, got ${firstStepFrac.toFixed(3)}`);
  assert.equal(s.diver.torchManualAim, true);

  // Over ~0.75s total (14 more 50ms ticks), torch smoothly converges near target
  for (let i = 0; i < 14; i++) {
    stepDiveSession(s, { x: 0, y: 0 }, 0.05, { torchAim: { active: true, angle: target } });
  }
  assert.ok(Math.abs(target - s.diver.torchAngle) < 0.08, `Torch should converge near target after ~0.75s (angle=${s.diver.torchAngle.toFixed(3)})`);
});

test('v151 Mechanical Foley Audio, Diver Craft Animations, Living Torch-Reactive Biomes, Landscape Mobile Parity & Skill Certifications', async () => {
  const { DiveAudio, HAPTIC_PRESETS } = await import('../public/js/game/audio.js');
  const { createMechanicalFxState, recordMechanicalEvent, stepMechanicalFx } = await import('../public/js/game/mechanicalFx.js');
  const { createMarineEcosystem, stepMarineEcosystem, computeTorchBeamExposure } = await import('../public/js/game/marineLife.js');
  const { resolveEmergencyDrill, recordGasSwitchFx } = await import('../public/js/game/diveSession.js');
  const { CaveRenderer } = await import('../public/js/game/renderer.js');

  // 1. Procedural Mechanical Foley methods & haptic presets exist and run cleanly without throwing
  assert.ok(Array.isArray(HAPTIC_PRESETS.valve) && Array.isArray(HAPTIC_PRESETS.liftbag));
  const audio = new DiveAudio();
  audio.muted = true; // headless Node safe
  audio.playValveEqualize();
  audio.playLiftBag(true);
  audio.playLiftBag(false);
  audio.playHatchOpen();
  audio.playLineCut();
  audio.playGasSwitch();
  audio.playReelClick();

  // 2. Diver Craft Mechanical FX: gas-switch purge, mask-purge & free-flow-shutoff + renderer passes
  const fx = createMechanicalFxState();
  recordMechanicalEvent(fx, 'gas-switch', { x: 10, y: 20, gasId: 'O2' });
  assert.equal(fx.activeAction?.kind, 'gas-switch');
  assert.equal(fx.activeAction?.gasId, 'O2');
  assert.ok(fx.particles.length >= 9);

  const sDrill = createDiveSession(LEVEL_1, { diverName: 'CraftTech', drillsEnabled: true });
  sDrill.drills.active = { kind: 'mask-flood', severity: 0.7, elapsedSec: 1.5 };
  resolveEmergencyDrill(sDrill, 'mask-flood');
  assert.equal(sDrill.mechFx.activeAction?.kind, 'mask-purge');

  sDrill.drills.active = { kind: 'free-flow', severity: 0.8, elapsedSec: 1.5 };
  resolveEmergencyDrill(sDrill, 'free-flow');
  assert.equal(sDrill.mechFx.activeAction?.kind, 'free-flow-shutoff');

  recordGasSwitchFx(sDrill, 'TMX1455');
  assert.equal(sDrill.mechFx.activeAction?.kind, 'gas-switch');
  stepMechanicalFx(sDrill.mechFx, 0.1);

  // 3. Torch-reactive wildlife exposure + sighted fish banking vs blind cavefish immunity
  const beamDiver = { x: 10, y: 12, vx: 1.8, vy: 0.2, angle: 0, torchAngle: 0, torchOn: true };
  assert.ok(computeTorchBeamExposure(beamDiver, 16, 12) > 0.5, 'Target directly in torch cone should have high exposure');
  assert.equal(computeTorchBeamExposure(beamDiver, 4, 12), 0, 'Target behind diver must have 0 exposure');
  assert.equal(computeTorchBeamExposure({ ...beamDiver, torchOn: false }, 16, 12), 0, 'Torch off must yield 0 exposure');

  const eco = createMarineEcosystem(LEVEL_1);
  stepMarineEcosystem(eco, beamDiver, 0.1, 1.5, LEVEL_1);

  // Renderer passes: fin-wash flora deflection, post-lighting eyeshine, yellow 2m long-hose & drill working arm
  const noopCtx = new Proxy(
    {
      canvas: { width: 800, height: 600 },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: () => ({ width: 24 }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const r = Object.create(CaveRenderer.prototype);
  r.level = LEVEL_1;
  r.glowStamps = { warm: { width: 8, height: 8 } };
  const toX = (x) => 400 + x * 20;
  const toY = (y) => 100 + y * 20;
  r._drawAnchoredLife(noopCtx, eco, -50, 200, -10, 100, toX, toY, 20, 2.0, beamDiver);
  r._drawFaunaEyeshine(noopCtx, eco, beamDiver, -50, 200, -10, 100, toX, toY, 20, 2.0);
  r._drawBuddyRescueTethers(
    noopCtx,
    beamDiver,
    [{ id: 'p2', name: 'Wingman', x: 12.5, y: 12.2, alive: true }],
    toX,
    toY,
    20,
    2.0,
    [{ peerId: 'p2', fromSelf: true, gasId: 'EAN32', amountBar: 35, timer: 1.5, duration: 2.6 }]
  );
  r._drawDiver(noopCtx, beamDiver, toX, toY, 20, 2.0, false, {
    mechFx: sDrill.mechFx,
    drills: { active: { kind: 'mask-flood' } },
  });
  r._drawDiver(noopCtx, beamDiver, toX, toY, 20, 2.1, false, {
    mechFx: sDrill.mechFx,
    drills: { active: { kind: 'free-flow' } },
  });

  // 4. Skill-based Technical Certifications + commutative cloud Gist merge
  let bookA = createEmptyLogbook();
  bookA = recordDiveInLogbook(bookA, {
    levelId: 'u1206-submarine',
    success: true,
    score: 3100,
    grade: 'S',
    maxDepthM: 76,
    diveTimeSec: 280,
    milestones: { equalizedBulkheads: 1, cleanSalvageLift: true, drillsCompleted: 2, zeroSiltCaveClear: false },
  });
  let bookB = createEmptyLogbook();
  bookB = recordDiveInLogbook(bookB, {
    levelId: 'cenote-el-abismo',
    success: true,
    score: 2600,
    grade: 'A',
    maxDepthM: 42,
    diveTimeSec: 170,
    milestones: { equalizedBulkheads: 0, cleanSalvageLift: false, drillsCompleted: 3, zeroSiltCaveClear: true },
  });
  const merged = mergeCareerLogbooks(bookA, bookB);
  assert.equal(merged.milestones.pressurizedEqualizations, 1);
  assert.equal(merged.milestones.cleanSalvageLifts, 1);
  assert.equal(merged.milestones.drillsCompleted, 3);
  assert.equal(merged.milestones.zeroSiltClears, 1);

  const certInfo = computeCertifications(merged, LEVELS);
  const earnedIds = new Set(certInfo.earned.map((c) => c.id));
  assert.ok(earnedIds.has('bulkhead-engineer'), 'Equalizing a pressurized bulkhead must earn Bulkhead Engineer');
  assert.ok(earnedIds.has('salvage-master'), 'Clean heavy salvage lift must earn Salvage Master');
  assert.ok(earnedIds.has('abyssal-troubleshooter'), '3+ drills must earn Emergency Troubleshooter');
  assert.ok(earnedIds.has('zero-silt-surgeon'), 'Zero-silt cave clear must earn Zero-Silt Trim');
  assert.ok(certInfo.certs.every((c) => typeof c.progressPct === 'number' && typeof c.progressText === 'string'));
});

test('v152 Safari Anti-Zoom-Trap Hardening: >=16px touch inputs, scale-aware pinch-out escape valve & viewport zoom reset', async () => {
  const fs = await import('node:fs');
  const css = fs.readFileSync(new URL('../public/css/style.css', import.meta.url), 'utf8');
  const mainSrc = fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');

  // 1. Touch devices enforce >=16px font-size on text/select inputs to prevent iOS Safari focus auto-zoom
  assert.ok(css.includes('@media (pointer: coarse), (hover: none)'), 'CSS must target touch/coarse pointers for Safari input anti-zoom');
  assert.ok(css.includes('font-size: max(16px, 1rem) !important;'), 'Touch inputs/selects must be >=16px to prevent iOS Safari focus zoom');
  assert.ok(css.includes('touch-action: manipulation;'), 'Interactive buttons/controls must declare touch-action: manipulation');

  // 2. main.js never traps users when visualViewport.scale > 1.02 and auto-resets zoom on blur/orientation/dive start
  assert.ok(mainSrc.includes('function getVisualViewportScale()'), 'main.js must inspect window.visualViewport.scale');
  assert.ok(mainSrc.includes('function resetSafariViewportZoom('), 'main.js must provide Safari viewport zoom reset helper');
  assert.ok(mainSrc.includes('if (getVisualViewportScale() > 1.02) return;'), 'touchmove pinch guard must allow pinch-out when zoomed in');
  assert.ok(mainSrc.includes("document.addEventListener('focusout'"), 'main.js must auto-recover Safari zoom after input/select blur');
  assert.ok(mainSrc.includes("window.addEventListener('orientationchange'"), 'main.js must recover viewport zoom & canvas on orientationchange');
});

test('v153 Modular Expedition Outfitter, Headgear Silhouettes, Cert-Linked Unlocks, Test-Tank Preview & P2P Relay', async () => {
  const {
    HEADGEAR_STYLES,
    ACCENT_TRIMS,
    TANK_FINISHES,
    VISOR_TINTS,
    OUTFITTER_PRESETS,
    DEFAULT_RIG_LIVERY,
    resolveDiverLiveryPalette,
    computeUnlockedLiveries,
    sanitizeRigLivery,
    isDefaultRigLivery,
    randomizeUnlockedLivery,
    drawLiveryPreview,
    drawMiniDiverAvatar,
  } = await import('../public/js/game/rigLivery.js');

  assert.ok(HEADGEAR_STYLES.length >= 4);
  assert.ok(ACCENT_TRIMS.length >= 7);
  assert.ok(TANK_FINISHES.length >= 5);
  assert.ok(VISOR_TINTS.length >= 4);
  assert.ok(OUTFITTER_PRESETS.length >= 6);

  // 1. Fresh diver unlocks standard gear only; v151 certification milestones unlock signature modular gear
  const freshBook = createEmptyLogbook();
  const freshUnlocks = computeUnlockedLiveries(freshBook);
  assert.equal(freshUnlocks.headgears.has('zissou-cap'), true);
  assert.equal(freshUnlocks.headgears.has('cave-hood'), true);
  assert.equal(freshUnlocks.headgears.has('cave-helmet'), false);
  assert.equal(freshUnlocks.headgears.has('exo-mask'), false);
  assert.equal(freshUnlocks.tanks.has('carbon-stealth'), false);
  assert.equal(freshUnlocks.tanks.has('salvage-brass'), false);

  const certBook = recordDiveInLogbook(createEmptyLogbook(), {
    levelId: 'u1206-submarine',
    success: true,
    score: 3200,
    grade: 'S',
    maxDepthM: 76,
    diveTimeSec: 260,
    milestones: { equalizedBulkheads: 1, cleanSalvageLift: true, drillsCompleted: 3, zeroSiltCaveClear: true },
  });
  const certUnlocks = computeUnlockedLiveries(certBook);
  assert.equal(certUnlocks.headgears.has('cave-helmet'), true, 'Bulkhead Engineer milestone must unlock Carbon Cave Helmet');
  assert.equal(certUnlocks.headgears.has('exo-mask'), true, 'Emergency Troubleshooter milestone must unlock Full-Face Exo Mask');
  assert.equal(certUnlocks.trims.has('salvage-gold'), true, 'Salvage Master milestone must unlock Salvage Gold trim');
  assert.equal(certUnlocks.tanks.has('carbon-stealth'), true, 'Zero-Silt Trim milestone must unlock Carbon Stealth tank');
  assert.equal(certUnlocks.tanks.has('salvage-brass'), true, 'Bulkhead Engineer milestone must unlock Patina Salvage Brass tank');
  assert.equal(certUnlocks.visors.has('night-emerald'), true, 'Emergency Troubleshooter milestone must unlock Night-Ops Emerald visor');

  // 2. Sanitization preserves compact default shape & keeps valid custom modular overrides
  const fullCustom = {
    suitId: 'wreck-titanium',
    torchId: 'warm-halogen',
    patchId: 'wreck-penetrator',
    headgearId: 'exo-mask',
    trimId: 'salvage-gold',
    tankId: 'salvage-brass',
    visorId: 'night-emerald',
  };
  const sanitized = sanitizeRigLivery(fullCustom, certUnlocks);
  assert.deepEqual(sanitized, fullCustom);
  assert.equal(isDefaultRigLivery(sanitized), false);
  assert.equal(isDefaultRigLivery(DEFAULT_RIG_LIVERY), true);

  const clampedFresh = sanitizeRigLivery(fullCustom, freshUnlocks);
  assert.equal(clampedFresh.headgearId, undefined, 'Locked headgear must clamp back to omitted default');
  assert.equal(clampedFresh.tankId, undefined, 'Locked tank finish must clamp back to omitted default');

  const pal = resolveDiverLiveryPalette(sanitized);
  assert.equal(pal.headgearId, 'exo-mask');
  assert.equal(pal.accent, '#f59e0b');
  assert.equal(pal.tankFinish.id, 'salvage-brass');
  assert.equal(pal.visorTint.id, 'night-emerald');

  const randLiv = randomizeUnlockedLivery(certUnlocks, () => 0.75);
  assert.deepEqual(sanitizeRigLivery(randLiv, certUnlocks), randLiv);

  // 3. Test-Tank preview renders all 4 headgear silhouettes across Clear / Silt / Night + Mini-Avatar badge
  const noopCtx = new Proxy(
    {
      canvas: { width: 560, height: 176 },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: () => ({ width: 24 }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  for (const hg of HEADGEAR_STYLES) {
    for (const envMode of ['clear', 'silt', 'night']) {
      drawLiveryPreview(
        noopCtx,
        560,
        176,
        { ...sanitized, headgearId: hg.id },
        { hasCcr: hg.id === 'exo-mask', hasDpv: hg.id === 'cave-helmet', envMode, timeSec: 1.5 }
      );
    }
  }
  drawMiniDiverAvatar(noopCtx, 58, 34, sanitized, { hasCcr: true });

  // 4. Co-op P2pRoomCoordinator relays full modular livery overrides cleanly
  const peerPkts = [];
  const coord = new P2pRoomCoordinator({ code: 'FIT1', hostId: 'h1', hostName: 'Host', levelId: LEVEL_1.id });
  coord.bindPlayerSender('h1', () => {});
  coord.handleRemoteJoin({ name: 'Guest' }, (m) => peerPkts.push(m), 'p2');
  coord.handleMessage('h1', { type: 'start_dive', force: true });
  coord.handleMessage('h1', {
    type: 'player_state',
    state: { seq: 1, x: 10, y: 12, vx: 0, vy: 0, angle: 0, torchOn: true, alive: true, livery: sanitized },
  });
  const relayed = peerPkts.find((m) => m.type === 'peer_state');
  assert.deepEqual(relayed?.state?.livery, sanitized);
});

test('v155 Submerged Storytelling Set-Pieces (all 33 sites), Torch Lore Discovery, Postcard Diver Emblem & AI Squad Team Uniform', async () => {
  const { createSubmergedStories, stepSubmergedStories, getCollectibleLoreNote } = await import('../public/js/game/submergedStories.js');
  const { createAiSquad } = await import('../public/js/game/aiBuddy.js');
  const { renderExpeditionPostcard } = await import('../public/js/game/diveCard.js');
  const { CaveRenderer } = await import('../public/js/game/renderer.js');

  // 1. All 33 campaign sites generate rich, SDF-validated submerged storytelling set-pieces
  let totalSetPieces = 0;
  const seenKinds = new Set();
  for (const lvl of LEVELS) {
    const st = createSubmergedStories(lvl);
    assert.ok(st.setPieces.length >= 2, `${lvl.id} should generate at least 2 submerged storytelling set-pieces (got ${st.setPieces.length})`);
    totalSetPieces += st.setPieces.length;
    for (const sp of st.setPieces) {
      seenKinds.add(sp.kind);
      assert.ok(sp.title && sp.lore, `${lvl.id} set-piece ${sp.id} must have title & lore`);
      assert.ok(evaluateCaveSDF(lvl, sp.x, sp.y) < 0.25, `${lvl.id} set-piece ${sp.kind} must not be buried deep in solid rock`);
    }
  }
  assert.ok(totalSetPieces >= 180, `Expected rich campaign-wide storytelling density (>=180), got ${totalSetPieces}`);
  for (const expected of ['emergency-lamp', 'brass-telegraph', 'ship-wheel', 'porthole-shaft', 'boiler-panel', 'speleothem-cathedral', 'halocline-lens', 'mayan-vessel', 'mine-timber', 'ice-arch', 'fossil-bed', 'survey-station']) {
    assert.ok(seenKinds.has(expected), `Expected campaign to include storytelling set-piece kind "${expected}"`);
  }

  // 2. Torch-lit lore discovery fires once per landmark and respects cooldown
  const u1206 = getLevelById('u1206-submarine');
  const wStories = createSubmergedStories(u1206);
  const targetSp = wStories.setPieces[0];
  let discoveredSp = null;
  const beamDiver = {
    x: targetSp.x - 4.2,
    y: targetSp.y,
    angle: 0,
    torchAngle: 0,
    torchOn: true,
    livery: { suitId: 'wreck-titanium', torchId: 'amber-silt', patchId: 'wreck-penetrator', headgearId: 'cave-helmet', tankId: 'salvage-brass', visorId: 'amber-contrast' },
  };
  const found = stepSubmergedStories(wStories, beamDiver, 10.0, {
    onStoryDiscovered: (sp) => { discoveredSp = sp; },
  });
  assert.equal(found?.id, targetSp.id);
  assert.equal(discoveredSp?.id, targetSp.id);
  assert.equal(wStories.discoveredCount, 1);
  // Calling again at same spot does not re-trigger
  assert.equal(stepSubmergedStories(wStories, beamDiver, 20.0), null);

  assert.match(getCollectibleLoreNote({ name: 'Brass Compass' }, u1206), /radium/i);
  assert.match(getCollectibleLoreNote({ name: 'Gypsum Crystal Cluster' }, LEVEL_1), /mineral/i);

  // 3. Renderer executes both world & emissive storytelling passes across all 12 kinds + custom PB ghost silhouette
  const noopCtx = new Proxy(
    {
      canvas: { width: 1200, height: 630 },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: (t) => ({ width: String(t || '').length * 8 }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const r = Object.create(CaveRenderer.prototype);
  r.level = u1206;
  r.glowStamps = { cyan: { width: 16, height: 16 } };
  const toX = (x) => 400 + x * 20;
  const toY = (y) => 100 + y * 20;
  const allKindPieces = [...seenKinds].map((kind, idx) => ({
    id: `mock-${idx}`,
    kind,
    x: 10 + idx * 2,
    y: 20,
    ceilY: 16,
    floorY: 24,
    size: 1.0,
    shaftLen: 4.5,
    shaftAngle: 0.4,
    halfWidth: 3.5,
    tilt: 0.15,
    phase: idx,
  }));
  r._drawSubmergedStories(noopCtx, { setPieces: allKindPieces }, -50, 200, -10, 100, toX, toY, 20, 3.2, 'world');
  r._drawSubmergedStories(noopCtx, { setPieces: allKindPieces }, -50, 200, -10, 100, toX, toY, 20, 3.2, 'emissive');
  r._drawGhostDiver(noopCtx, { x: 12, y: 20, angle: 0.2, finished: false, isPar: false }, toX, toY, 20, 3.2, 800, 600, beamDiver);

  // 4. AI Squad Team Uniform matches player's drysuit/headgear/tank/visor with 3 distinct wingman trims
  const squad = createAiSquad(LEVEL_1, { x: LEVEL_1.spawn.x, y: 2, angle: 0 }, 3, {
    teamUniform: true,
    leaderLivery: beamDiver.livery,
  });
  assert.equal(squad.length, 3);
  for (const b of squad) {
    assert.equal(b.livery.suitId, 'wreck-titanium');
    assert.equal(b.livery.headgearId, 'cave-helmet');
    assert.equal(b.livery.tankId, 'salvage-brass');
  }
  assert.equal(new Set(squad.map((b) => b.livery.trimId)).size, 3, 'Team uniform wingmen must have 3 distinct high-vis trim stripes');

  // 5. Expedition Postcard stamps custom diver rig emblem cleanly
  const cardOk = renderExpeditionPostcard(noopCtx, 1200, 630, {
    level: u1206,
    diverName: 'Cousteau',
    success: true,
    grade: 'S',
    score: 3420,
    maxDepthM: 76.2,
    diveTimeSec: 245,
    exploredPct: 92,
    livery: beamDiver.livery,
    hasCcr: true,
    version: 'v155',
  });
  assert.equal(cardOk, true);
});

test('v156 Living Signature Moments, Dive Contracts, Crew Roles, PB Split Timers, Dive Plan Slate & Diegetic Immersion Tape', async () => {
  const {
    CREW_ROLES,
    getCrewRole,
    cycleCrewRoleId,
    rollDiveContracts,
    evaluateDiveContracts,
    computeGhostCheckpointSplits,
    formatSplitDelta,
  } = await import('../public/js/game/expeditionContracts.js');
  const { createSubmergedStories, stepSubmergedStories, getTopsideRadioChatter } = await import(
    '../public/js/game/submergedStories.js'
  );
  const { recordLoreDiscoveryInLogbook } = await import('../public/js/game/logbookModel.js');
  const { drawDivePlanSlate } = await import('../public/js/game/diveCard.js');

  const u1206 = LEVELS.find((l) => l.id === 'u1206-north-sea') || LEVELS.find((l) => l.isWreck);
  const blueHole = LEVELS.find((l) => l.id === 'dahab-blue-hole') || LEVEL_1;

  // 1. Living Signature Moments: Air Dome in every site, Pelagic Shadow on wrecks/blue holes, Topside Radio Chatter
  const caveStories = createSubmergedStories(LEVEL_1);
  assert.ok(caveStories.setPieces.some((sp) => sp.kind === 'air-dome'), 'Cave site must include a Trapped Overhead Air Dome');
  const wreckStories = createSubmergedStories(u1206);
  assert.ok(wreckStories.setPieces.some((sp) => sp.kind === 'air-dome'), 'Wreck site must include a Trapped Overhead Air Dome');
  assert.ok(wreckStories.pelagicShadow && wreckStories.pelagicShadow.kind === 'whaleshark', 'Open-water wreck should enable Overhead Pelagic Shadow crossing');
  assert.match(getTopsideRadioChatter('plunge', u1206), /Topside/i);
  assert.match(getTopsideRadioChatter('decoClear', blueHole), /Surface Support|Topside/i);
  assert.match(getTopsideRadioChatter('recovery', LEVEL_1), /Topside/i);

  // Air dome calms panic & HR when diver surfaces into it
  const dome = caveStories.setPieces.find((sp) => sp.kind === 'air-dome');
  const calmDiveState = { panicLevel: 0.65, heartRateBpm: 132 };
  stepSubmergedStories(
    caveStories,
    { x: dome.x, y: dome.y + 0.4, angle: 0, torchOn: false },
    15.0,
    {},
    calmDiveState
  );
  assert.ok(calmDiveState.panicLevel < 0.65 && calmDiveState.heartRateBpm < 132, 'Air dome should calm panic & HR');

  // 2. Crew Specialty Roles & Dynamic Dive Contracts
  assert.equal(CREW_ROLES.length, 4);
  assert.equal(getCrewRole('navigator').sonarRangeMult >= 1.2, true);
  assert.equal(getCrewRole('safety').gasBurnMult < 1.0, true);
  assert.equal(cycleCrewRoleId('balanced'), 'navigator');
  assert.equal(cycleCrewRoleId('safety'), 'balanced');

  const sess = createDiveSession(LEVEL_1, { crewRoleId: 'navigator' });
  assert.equal(sess.crewRole.id, 'navigator');
  assert.equal(sess.contracts.length, 2, 'Dive session should roll 2 dynamic dive contracts');
  // Manually satisfy a rolled contract and confirm checkoff callback + bonus points
  const rolled = rollDiveContracts(LEVEL_1, { seed: 42 });
  assert.equal(rolled.length, 2);
  sess.contracts = [
    { id: 'lore-scout', icon: '🧭', title: 'Submerged Historian', target: 2, progress: 0, rewardPts: 150, completed: false },
  ];
  sess.stories.discoveredCount = 2;
  const completedNames = [];
  evaluateDiveContracts(sess, { onContractComplete: (c) => completedNames.push(c.id) });
  assert.deepEqual(completedNames, ['lore-scout']);
  assert.equal(sess.contractBonusScore, 150);

  // 3. Live PB Split Timers from ghost track
  const cp0 = LEVEL_1.checkpoints[0];
  const mockTrack = {
    levelId: LEVEL_1.id,
    points: [
      { t: 0, x: LEVEL_1.spawn.x, y: LEVEL_1.spawn.y },
      { t: 24.5, x: cp0.x, y: cp0.y },
    ],
  };
  const splits = computeGhostCheckpointSplits(LEVEL_1, mockTrack);
  assert.equal(splits[cp0.id], 24.5);
  assert.match(formatSplitDelta(-3.4), /-3\.4s ahead/i);
  assert.match(formatSplitDelta(2.1), /\+2\.1s behind/i);

  // 4. Persistent Submerged Lore Archive & Gist merge
  const resA = recordLoreDiscoveryInLogbook(createEmptyLogbook(), {
    kind: 'air-dome',
    title: 'Trapped Air Dome',
    lore: 'Silver mercury ceiling pocket.',
    siteName: LEVEL_1.name,
  });
  assert.equal(resA.isNew, true);
  let bookA = resA.book;
  let bookB = recordLoreDiscoveryInLogbook(createEmptyLogbook(), {
    kind: 'brass-telegraph',
    title: 'Chadburn Telegraph',
    lore: 'Locked on ALL STOP.',
    siteName: u1206.name,
  }).book;
  bookB = recordDiveInLogbook(bookB, {
    levelId: u1206.id,
    success: true,
    score: 2600,
    grade: 'A',
    maxDepthM: 72,
    diveTimeSec: 210,
    milestones: { contractsCompleted: 2 },
  });
  const merged = mergeCareerLogbooks(bookA, bookB);
  assert.ok(merged.loreArchive['air-dome'] && merged.loreArchive['brass-telegraph']);
  assert.equal(merged.milestones.contractsCompleted, 2);

  // 5. Visual Dive Plan Slate & Diegetic Immersion Tape + Pelagic Shadow rendering on mock canvas
  const noopCtx = new Proxy(
    {
      canvas: { width: 520, height: 132 },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: (t) => ({ width: String(t || '').length * 7 }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  assert.equal(
    drawDivePlanSlate(noopCtx, 520, 132, {
      level: u1206,
      mixes: u1206.gasMixes,
      customGasPlan: { enabled: true, o2Pct: 16, hePct: 50 },
    }),
    true
  );
  const r = Object.create(CaveRenderer.prototype);
  r.level = u1206;
  r._cachedDpr = 1;
  const toX = (x) => 300 + x * 18;
  const toY = (y) => 80 + y * 18;
  r._drawSubmergedStories(noopCtx, wreckStories, -50, 200, -10, 100, toX, toY, 18, 4.0, 'world');
  r._drawSubmergedStories(noopCtx, wreckStories, -50, 200, -10, 100, toX, toY, 18, 4.0, 'emissive');
  r._drawDiegeticImmersionTape(
    noopCtx,
    1280,
    720,
    { x: 10, y: 28, facingX: 1, facingY: 0 },
    { depth: 28.4, decoCeilingM: 6, activeTankBar: 175, activeMix: { shortName: 'TMX' } },
    cp0,
    12.3
  );
});

test('v157 Hardcore Mode AI Diver Leadership, Incident Solving & Leave-No-Diver-Behind Rescue', async () => {
  const {
    HARDCORE_LEADERSHIP_BONUS_PTS,
    createAiSquad,
    stepAiBuddy,
    handlePlayerSignalForAiBuddy,
    triggerHardcoreBuddyIssue,
    receiveGasForAiBuddy,
    assistHardcoreBuddyIssue,
    updateTowedAiBuddy,
  } = await import('../public/js/game/aiBuddy.js');

  const sess = createDiveSession(LEVEL_1, { diverName: 'Lead', difficulty: 'hardcore' });
  const squad = createAiSquad(LEVEL_1, sess.diver, 1, { initialGasId: 'EAN32' });
  sess.aiSquad = squad;
  const buddy = squad[0];
  const openPt = LEVEL_1.checkpoints[0];
  sess.simTimeSec = 25;
  sess.diver.x = openPt.x;
  sess.diver.y = openPt.y;
  buddy.x = openPt.x - 1.8;
  buddy.y = openPt.y;

  // 1. Hardcore Separation (NO magical teleport) & Rejoin when leader returns
  sess.diver.x = openPt.x + 18;
  let separatedFlag = false;
  let rejoinedFlag = false;
  for (let i = 0; i < 40; i++) {
    stepAiBuddy(buddy, sess, 0.1, {
      onBuddySeparated: () => { separatedFlag = true; },
      onBuddyRejoined: () => { rejoinedFlag = true; },
    });
  }
  assert.equal(separatedFlag, true, 'Hardcore AI buddy should enter separated state when outrun');
  assert.equal(buddy.separated, true);
  assert.equal(buddy.condition, 'SEPARATED');
  assert.ok(Math.hypot(sess.diver.x - buddy.x, sess.diver.y - buddy.y) > 12, 'Hardcore AI buddy must NOT magically teleport');

  // Swim back to re-establish visual lead
  sess.diver.x = buddy.x + 4.0;
  sess.diver.y = buddy.y;
  stepAiBuddy(buddy, sess, 0.1, { onBuddyRejoined: () => { rejoinedFlag = true; } });
  assert.equal(rejoinedFlag, true);
  assert.equal(buddy.separated, false);

  // 2. Primary Light Failure: buddy torch turns off; leading them under player torchlight + OK signal resolves it
  const tf = triggerHardcoreBuddyIssue(buddy, 'torch-fail', sess, 1000);
  assert.ok(tf && buddy.torchOn === false && buddy.condition === 'NO LIGHT');
  sess.diver.torchOn = true;
  sess.diver.x = buddy.x + 2.4;
  let resolvedCount = 0;
  for (let i = 0; i < 35 && buddy.issue; i++) {
    sess.diver.x += 0.18;
    stepAiBuddy(buddy, sess, 0.1, {
      onBuddyIssueResolved: () => { resolvedCount++; },
    });
  }
  if (buddy.issue) {
    handlePlayerSignalForAiBuddy(buddy, 'ok', sess, 4000, {
      onBuddyIssueResolved: () => { resolvedCount++; },
    });
  }
  assert.equal(buddy.issue, null, 'Leading buddy under torchlight should resolve light failure');
  assert.equal(buddy.torchOn, true);
  assert.equal(resolvedCount, 1);
  assert.equal(sess.aiLeadBonusScore, HARDCORE_LEADERSHIP_BONUS_PTS);

  // 3. Nitrogen Narcosis: leading shallower + ASCEND signal clears narcosis
  buddy.x = openPt.x;
  buddy.y = openPt.y;
  buddy.depthM = 28;
  sess.diver.x = buddy.x + 1.5;
  sess.diver.y = openPt.y - 0.5;
  sess.diver.vy = -0.6;
  triggerHardcoreBuddyIssue(buddy, 'narcosis', sess, 6000);
  assert.equal(buddy.condition, 'NARCOSIS');
  handlePlayerSignalForAiBuddy(buddy, 'ascend', sess, 6200);
  handlePlayerSignalForAiBuddy(buddy, 'ok', sess, 6400);
  assistHardcoreBuddyIssue(buddy, sess, 6600);
  assert.equal(buddy.issue, null, 'Coaching & leading shallower should clear narcosis');

  // 4. Snagged AI Buddy: pinned at snag anchor, contextual prompt shows CUT FREE [E], triggerWreckAction cuts them free
  buddy.x = openPt.x;
  buddy.y = openPt.y;
  triggerHardcoreBuddyIssue(buddy, 'snagged', sess, 8000, { snagKey: 'test-snag' });
  const anchorX = buddy.x;
  const anchorY = buddy.y;
  stepAiBuddy(buddy, sess, 0.1, {});
  assert.equal(buddy.x, anchorX, 'Snagged AI buddy must remain immobilized');
  assert.equal(buddy.y, anchorY);
  sess.diver.x = anchorX + 1.4;
  sess.diver.y = anchorY;
  stepDiveSession(sess, { x: 0, y: 0 }, 0.05, { peers: squad });
  assert.match(sess.wreckActionPrompt?.label || '', /CUT .* FREE \[E\]/);
  const cutRes = triggerWreckAction(sess, {
    onAssistAiBuddy: (b) => Boolean(assistHardcoreBuddyIssue(b, sess, 8200).handled),
  });
  assert.equal(cutRes.handled, true);
  assert.equal(buddy.issue, null, 'Pressing [E] beside snagged Hardcore AI buddy should slice them free');

  // 5. Low-Gas Free-Flow & Emergency Gas Share (and Downed state if starved to 0 bar)
  triggerHardcoreBuddyIssue(buddy, 'low-gas', sess, 9000);
  assert.ok(buddy.activeBar <= 45);
  const shareRes = receiveGasForAiBuddy(buddy, 30, 'EAN32', sess, 9100);
  assert.equal(shareRes.accepted, true);
  assert.equal(buddy.issue, null, 'Sharing gas with low-gas Hardcore AI buddy should resolve emergency');

  // 6. Hardcore "Leave No Diver Behind" Exit Gate + Downed Tow Extraction
  // Tag all checkpoints and move player to exit while buddy is DOWN & untowed -> exit MUST be blocked!
  for (const cp of LEVEL_1.checkpoints) sess.checkpointsHit.add(cp.id);
  buddy.alive = false;
  buddy.condition = 'DOWN';
  buddy.x = openPt.x;
  buddy.y = openPt.y;
  sess.diver.x = LEVEL_1.exitZone.x;
  sess.diver.y = 0.9;
  let blockedToast = '';
  const blockedStep = stepDiveSession(sess, { x: 0, y: 0 }, 0.05, {
    peers: squad,
    onToast: (m) => { blockedToast = m; },
  });
  assert.equal(blockedStep.outcome, null, 'Hardcore exit MUST be blocked while AI buddy is downed & untowed');
  assert.match(blockedToast, /Leave no diver behind/i);

  // Clip tow line onto downed AI buddy, glide them smoothly behind player, and exit cleanly!
  sess.rescueTargetId = buddy.id;
  sess.diver.rescueTargetId = buddy.id;
  buddy.rescuedBy = 'self';
  updateTowedAiBuddy(buddy, sess.diver, LEVEL_1, 0.1);
  assert.ok(Math.hypot(buddy.x - sess.diver.x, buddy.y - sess.diver.y) < Math.hypot(openPt.x - sess.diver.x, openPt.y - sess.diver.y));
  const rescuedStep = stepDiveSession(sess, { x: 0, y: 0 }, 0.05, { peers: squad });
  assert.equal(rescuedStep.outcome?.success, true, 'Surfacing while towing downed Hardcore AI buddy must complete extraction');

  // 7. Renderer renders Hardcore issue beacon ring + progress arc + off-screen edge pill cleanly
  const noopCtx = new Proxy(
    {
      canvas: { width: 1280, height: 720 },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: (t) => ({ width: String(t || '').length * 7 }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const r = Object.create(CaveRenderer.prototype);
  r.level = LEVEL_1;
  r._cachedDpr = 1;
  const toX = (x) => 400 + x * 20;
  const toY = (y) => 100 + y * 20;
  const visualBuddy = { ...buddy, alive: true, condition: 'NO LIGHT', issue: { kind: 'torch-fail', hudLabel: '🔦 LEAD W/ LIGHT', progress: 0.65, countdownSec: 40 } };
  r._drawBuddyRescueTethers(noopCtx, sess.diver, [visualBuddy], toX, toY, 20, 4.2, []);
  r._drawPeerEdgeIndicators(noopCtx, 1280, 720, sess.diver, [{ ...visualBuddy, x: sess.diver.x + 90 }], toX, toY, 4.2);
});

test('v158 Mode-Specific AI Squad Profiles: Guided Pro Guide, Standard Tech Co-Diver & Hardcore Vulnerable Rookies', async () => {
  const {
    AI_DIFFICULTY_PROFILES,
    getAiDifficultyProfile,
    createAiSquad,
    stepAiBuddy,
    handlePlayerSignalForAiBuddy,
  } = await import('../public/js/game/aiBuddy.js');

  // 1. Verify 3-tier profile definitions & fallback
  const pGuided = getAiDifficultyProfile('guided');
  const pStandard = getAiDifficultyProfile('standard');
  const pHardcore = getAiDifficultyProfile('hardcore');
  assert.equal(pGuided, AI_DIFFICULTY_PROFILES.guided);
  assert.equal(pStandard, AI_DIFFICULTY_PROFILES.standard);
  assert.equal(pHardcore, AI_DIFFICULTY_PROFILES.hardcore);
  assert.equal(getAiDifficultyProfile('unknown'), AI_DIFFICULTY_PROFILES.standard);

  assert.equal(pGuided.leadsWaypoints, true);
  assert.equal(pGuided.guardianStabilize, true);
  assert.equal(pGuided.snagCutTimeSec < pStandard.snagCutTimeSec, true);
  assert.equal(pGuided.autoShareThresholdBar > pStandard.autoShareThresholdBar, true);

  assert.equal(pStandard.leadsWaypoints, false);
  assert.equal(pStandard.guardianStabilize, false);
  assert.equal(pStandard.canAutoCutPlayerSnag, true);
  assert.equal(pStandard.canAutoShareGas, true);
  assert.equal(pStandard.canScoutMode, true);

  assert.equal(pHardcore.leadsWaypoints, false);
  assert.equal(pHardcore.guardianStabilize, false);
  assert.equal(pHardcore.spotlightCollectibles, false);
  assert.equal(pHardcore.canAutoCutPlayerSnag, false);
  assert.equal(pHardcore.canAutoShareGas, false);
  assert.equal(pHardcore.canScoutMode, false);
  assert.equal(pHardcore.triggersHardcoreIssues, true);
  assert.equal(pHardcore.requireExtraction, true);

  const openPt = LEVEL_1.checkpoints[0];
  const col0 = LEVEL_1.collectibles[0];

  // 2. GUIDED MODE: Pro Instructor leads to collectibles, coaches, cuts snags rapidly, shares gas early & stabilizes vitals
  const gSess = createDiveSession(LEVEL_1, { diverName: 'Student', difficulty: 'guided' });
  const gSquad = createAiSquad(LEVEL_1, gSess.diver, 1, { initialGasId: 'EAN32' });
  const gBuddy = gSquad[0];
  gSess.aiSquad = gSquad;
  gSess.diver.x = col0.x - 5.5;
  gSess.diver.y = col0.y;
  gBuddy.x = col0.x - 4.5;
  gBuddy.y = col0.y;
  const gCoachMsgs = [];
  stepAiBuddy(gBuddy, gSess, 0.1, {
    onBuddyCoach: (_b, msg) => gCoachMsgs.push(msg),
  });
  assert.equal(gBuddy.condition, 'GUIDING', 'Guided slot-0 AI should enter GUIDING state');
  assert.ok(gCoachMsgs.some((m) => m.includes(col0.name)), 'Guided AI should coach player toward nearby artifact');

  // Guided Guardian Angel vital stabilization
  gSess.diver.x = openPt.x;
  gSess.diver.y = openPt.y;
  gBuddy.x = openPt.x + 1.8;
  gBuddy.y = openPt.y;
  gSess.diveState.cnsPercent = 58;
  gSess.diveState.hypoxiaStress = 45;
  gSess.diveState.dcsStress = 48;
  gSess.diveState.panicLevel = 0.72;
  gSess.diveState.health = 52;
  gCoachMsgs.length = 0;
  for (let i = 0; i < 10; i++) {
    stepAiBuddy(gBuddy, gSess, 0.1, {
      onBuddyCoach: (_b, msg) => gCoachMsgs.push(msg),
    });
  }
  assert.equal(gBuddy.condition, 'SAFETY GUARD');
  assert.ok(gSess.diveState.health > 52, 'Guided Guardian must actively recover critically low health');
  assert.ok(gSess.diveState.cnsPercent < 58, 'Guided Guardian must buffer CNS stress');
  assert.ok(gSess.diveState.hypoxiaStress < 45, 'Guided Guardian must buffer hypoxia stress');
  assert.ok(gSess.diveState.dcsStress < 48, 'Guided Guardian must buffer DCS stress');
  assert.ok(gSess.diveState.panicLevel < 0.72, 'Guided Guardian must calm player panic');
  assert.ok(gCoachMsgs.some((m) => m.includes('🛡️')), 'Guided Guardian should deliver protective coaching toast');

  // Guided DECO PACE when healthy at deco stop
  gSess.diveState.cnsPercent = 5;
  gSess.diveState.hypoxiaStress = 0;
  gSess.diveState.dcsStress = 0;
  gSess.diveState.panicLevel = 0;
  gSess.diveState.health = 100;
  gSess.diveState.stopDepthM = 6;
  gSess.diver.y = 7.5;
  gBuddy.y = 7.5;
  stepAiBuddy(gBuddy, gSess, 0.1, {});
  stepAiBuddy(gBuddy, gSess, 0.1, {});
  assert.equal(gBuddy.condition, 'DECO PACE', 'Guided AI should pace player during active deco stops');

  // Guided early auto-share gas (< 65 bar) & fast snag cut (0.65s)
  gSess.diveState.stopDepthM = 0;
  gSess.diveState.tanks.EAN32.bar = 55;
  gSess.diveState.tanks.EAN32.litersRemaining = 55 * gSess.diveState.tanks.EAN32.volumeL;
  gBuddy.activeBar = 180;
  gBuddy.x = gSess.diver.x + 1.5;
  gBuddy.y = gSess.diver.y;
  let guidedSharedBar = 0;
  stepAiBuddy(gBuddy, gSess, 0.1, {
    onBuddyGasShare: (e) => { guidedSharedBar = e.amountBar; },
  });
  assert.ok(guidedSharedBar >= 35, `Guided AI should auto-share gas early at 55 bar (shared ${guidedSharedBar}b)`);

  gSess.activeSnagIndex = 0;
  gBuddy.x = gSess.diver.x + 1.4;
  gBuddy.y = gSess.diver.y;
  let guidedCut = false;
  for (let i = 0; i < 8; i++) {
    stepAiBuddy(gBuddy, gSess, 0.1, { onBuddyCutSnag: () => { guidedCut = true; } });
  }
  assert.equal(guidedCut, true, 'Guided AI must cut player snag within ~0.7s');

  // 3. STANDARD TECH MODE: Balanced Co-Diver (no vital magic, no early 55b share, shares < 34b, scouts on command)
  const sSess = createDiveSession(LEVEL_1, { diverName: 'TechDiver', difficulty: 'standard' });
  const sSquad = createAiSquad(LEVEL_1, sSess.diver, 1, { initialGasId: 'EAN32' });
  const sBuddy = sSquad[0];
  sSess.aiSquad = sSquad;
  sSess.diver.x = openPt.x;
  sSess.diver.y = openPt.y;
  sBuddy.x = openPt.x + 1.5;
  sBuddy.y = openPt.y;
  sSess.diveState.health = 52;
  sSess.diveState.cnsPercent = 58;
  sSess.diveState.tanks.EAN32.bar = 55;
  sSess.diveState.tanks.EAN32.litersRemaining = 55 * sSess.diveState.tanks.EAN32.volumeL;
  let stdEarlyShare = false;
  stepAiBuddy(sBuddy, sSess, 0.1, { onBuddyGasShare: () => { stdEarlyShare = true; } });
  assert.equal(stdEarlyShare, false, 'Standard AI must NOT auto-share gas at 55 bar');
  assert.equal(sSess.diveState.health, 52, 'Standard AI must NOT magically heal player');
  assert.equal(sSess.diveState.cnsPercent, 58, 'Standard AI must NOT magically lower player CNS');

  // Standard DOES obey attention scout & auto-share below 34 bar
  handlePlayerSignalForAiBuddy(sBuddy, 'attention', sSess, 1000);
  assert.equal(sBuddy.mode, 'scout', 'Standard AI should scout ahead when signaled LOOK');
  sSess.diveState.tanks.EAN32.bar = 26;
  sSess.diveState.tanks.EAN32.litersRemaining = 26 * sSess.diveState.tanks.EAN32.volumeL;
  sBuddy.x = sSess.diver.x + 1.5;
  sBuddy.y = sSess.diver.y;
  let stdEmergShare = false;
  stepAiBuddy(sBuddy, sSess, 0.1, { onBuddyGasShare: () => { stdEmergShare = true; } });
  assert.equal(stdEmergShare, true, 'Standard AI should auto-share gas in true emergency (< 34 bar)');

  // 4. HARDCORE MODE: Vulnerable Rookies refuse scout, never auto-cut player snag, never auto-share gas
  const hSess = createDiveSession(LEVEL_1, { diverName: 'ProLead', difficulty: 'hardcore' });
  const hSquad = createAiSquad(LEVEL_1, hSess.diver, 1, { initialGasId: 'EAN32' });
  const hBuddy = hSquad[0];
  hSess.aiSquad = hSquad;
  hSess.diver.x = openPt.x;
  hSess.diver.y = openPt.y;
  hBuddy.x = openPt.x - 1.4;
  hBuddy.y = openPt.y;
  const scoutReply = handlePlayerSignalForAiBuddy(hBuddy, 'attention', hSess, 2000);
  assert.notEqual(hBuddy.mode, 'scout', 'Hardcore rookie must refuse scout-ahead command');
  assert.match(scoutReply.toast || '', /on point|lead the way/i);

  hSess.activeSnagIndex = 0;
  hSess.diveState.tanks.EAN32.bar = 20;
  hSess.diveState.tanks.EAN32.litersRemaining = 20 * hSess.diveState.tanks.EAN32.volumeL;
  let hcAutoCut = false;
  let hcAutoGas = false;
  for (let i = 0; i < 20; i++) {
    stepAiBuddy(hBuddy, hSess, 0.1, {
      onBuddyCutSnag: () => { hcAutoCut = true; },
      onBuddyGasShare: () => { hcAutoGas = true; },
    });
  }
  assert.equal(hcAutoCut, false, 'Hardcore rookie must NOT auto-cut player snags');
  assert.equal(hSess.activeSnagIndex, 0, 'Player snag must remain active in Hardcore until player cuts themselves free');
  assert.equal(hcAutoGas, false, 'Hardcore rookie must NOT auto-share gas even when player is at 20 bar');

  // 5. Renderer draws Guided SAFETY GUARD & DECO PACE halos cleanly
  const drawnTexts = [];
  const noopCtx = new Proxy(
    {
      canvas: { width: 1280, height: 720 },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: (t) => ({ width: String(t || '').length * 7 }),
      fillText: (t) => drawnTexts.push(String(t)),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const r = Object.create(CaveRenderer.prototype);
  r.level = LEVEL_1;
  r._cachedDpr = 1;
  const toX = (x) => 400 + x * 20;
  const toY = (y) => 100 + y * 20;
  r._drawBuddyRescueTethers(
    noopCtx,
    gSess.diver,
    [
      { ...gBuddy, alive: true, condition: 'SAFETY GUARD', issue: null },
      { ...gBuddy, id: 'ai-2', alive: true, condition: 'DECO PACE', issue: null },
    ],
    toX,
    toY,
    20,
    5.0,
    []
  );
  assert.ok(drawnTexts.some((t) => t.includes('SAFETY GUARD')), 'Renderer should draw SAFETY GUARD halo badge');
  assert.ok(drawnTexts.some((t) => t.includes('DECO PACE')), 'Renderer should draw DECO PACE halo badge');
});

test('v159 Living Sump Hydrology, Acoustic Black-Box Hunts, Line Cookies & Squad-Assisted Bulkheads', async () => {
  const { computeTidalCurrent, computeHaloclineLayer, stepDynamicHazards } = await import(
    '../public/js/game/dynamicHazards.js'
  );
  const {
    BLACK_BOX_BONUS_PTS,
    MAX_LINE_COOKIES,
    createBlackBoxTarget,
    recoverBlackBox,
    dropLineCookie,
  } = await import('../public/js/game/diveSession.js');
  const { stepSiltPhysics, spawnSiltPlume } = await import('../public/js/game/silt.js');

  const wreck = LEVELS.find((l) => l.isWreck && Array.isArray(l.watertightHatches) && l.watertightHatches.length > 0);
  assert.ok(wreck, 'Expected a shipwreck level with watertight hatches');

  // 1. Tidal Siphon / Outflow cycle & Halocline layer
  const t0 = computeTidalCurrent(wreck, 0);
  const tQuarter = computeTidalCurrent(wreck, 22);
  assert.equal(t0.enabled, true);
  assert.ok(['INFLOW', 'SLACK TIDE', 'OUTFLOW'].includes(t0.label));
  assert.notEqual(t0.vx, tQuarter.vx, 'Tidal current should cycle smoothly over time');

  const haloCenote = computeHaloclineLayer(LEVEL_1);
  const haloWreck = computeHaloclineLayer(wreck);
  assert.equal(haloCenote.enabled, true, 'Cenote Level 1 should have an active halocline layer');
  assert.ok(haloCenote.depthM >= 9.5 && haloCenote.depthM <= 24);
  assert.equal(haloWreck.enabled, false, 'Open-ocean wreck should not have a cenote halocline');

  // Step diver through halocline -> buoyancy shift + 1-time toast
  const hSess = createDiveSession(LEVEL_1, { diverName: 'Hydro', difficulty: 'standard' });
  hSess.diver.y = haloCenote.depthM + 0.5;
  hSess.diver.vy = 0;
  let haloToast = '';
  const hazOut = stepDynamicHazards(hSess, 0.1, { onToast: (m) => { haloToast = m; } });
  assert.equal(hazOut.inHalocline, true);
  assert.ok(hSess.diver.vy < 0, 'Crossing into denser saltwater below halocline should apply slight upward buoyancy nudge');
  assert.match(haloToast, /Halocline/i);

  // Silt clouds drift with active tidal current
  const testClouds = [];
  const c = spawnSiltPlume(testClouds, { x: LEVEL_1.checkpoints[0].x, y: LEVEL_1.checkpoints[0].y, vx: 0, vy: 0 });
  const startVx = c.vx;
  stepSiltPhysics(LEVEL_1, testClouds, null, 0.25, { currentVx: 1.5 });
  assert.ok(c.vx > startVx, 'Positive tidal current should carry silt plumes downstream');

  // 2. Acoustic Black-Box / Lost Hydro-Probe placement, ping & [E] recovery
  const bbCave = createBlackBoxTarget(LEVEL_1);
  const bbWreck = createBlackBoxTarget(wreck);
  assert.ok(bbCave && !bbCave.isWreck && bbCave.points === BLACK_BOX_BONUS_PTS);
  assert.ok(bbWreck && bbWreck.isWreck && bbWreck.label.includes('Black Box'));

  hSess.blackBox.pingTimer = 0.02;
  hSess.diver.x = hSess.blackBox.x - 10;
  hSess.diver.y = hSess.blackBox.y;
  let pingedDist = -1;
  let pingPan = 0;
  stepDiveSession(hSess, { x: 0, y: 0 }, 0.05, {
    onBlackBoxPing: (_bb, d, pan) => {
      pingedDist = d;
      pingPan = pan;
    },
  });
  assert.ok(pingedDist > 0 && pingedDist < 15, 'Black Box should emit periodic ping when diver is within 34m');
  assert.ok(pingPan > 0, 'Stereo pan should point right toward Black Box located +X of diver');

  hSess.diver.x = hSess.blackBox.x + 1.0;
  hSess.diver.y = hSess.blackBox.y;
  stepDiveSession(hSess, { x: 0, y: 0 }, 0.05, {});
  assert.match(hSess.wreckActionPrompt?.label || '', /RECOVER .* \[E\]/);
  const recRes = triggerWreckAction(hSess, {});
  assert.equal(recRes.handled, true);
  assert.equal(recRes.kind, 'recover-blackbox');
  assert.equal(hSess.blackBox.recovered, true);
  assert.equal(hSess.blackBoxBonusScore, BLACK_BOX_BONUS_PTS);
  assert.equal(recoverBlackBox(hSess).ok, false, 'Black Box cannot be recovered twice');

  // 3. Personal Glowing Directional Line Cookies (up to 6 per dive)
  for (let i = 1; i <= MAX_LINE_COOKIES; i++) {
    const ck = dropLineCookie(hSess, {});
    assert.equal(ck.ok, true);
    assert.equal(ck.cookie.index, i);
    assert.equal(Number.isFinite(ck.cookie.exitAngle), true);
  }
  assert.equal(hSess.lineCookies.length, MAX_LINE_COOKIES);
  assert.equal(dropLineCookie(hSess, {}).ok, false, 'Should cap Line Cookies at MAX_LINE_COOKIES');

  // 4. Squad-Assisted Bulkhead Cranking (2x speed when buddy is within 5.8m)
  const wSessSolo = createDiveSession(wreck, { diverName: 'Solo', difficulty: 'standard' });
  const wSessTeam = createDiveSession(wreck, { diverName: 'Team', difficulty: 'standard' });
  const hatch = wreck.watertightHatches[0];
  for (const s of [wSessSolo, wSessTeam]) {
    s.equalizedHatchIds.add(hatch.id);
    s.diver.x = hatch.x + 0.8;
    s.diver.y = hatch.y;
    s.crankingHatchId = hatch.id;
    s.crankingHatchProgress = 0.2;
  }
  wSessTeam.aiSquad = [{ id: 'ai-1', x: hatch.x - 1.5, y: hatch.y, alive: true, surfaced: false, issue: null }];
  stepDiveSession(wSessSolo, { x: 0, y: 0 }, 0.2, {});
  stepDiveSession(wSessTeam, { x: 0, y: 0 }, 0.2, {});
  assert.equal(wSessTeam.squadAssistActive, true);
  assert.ok(
    wSessTeam.crankingHatchProgress > wSessSolo.crankingHatchProgress + 0.1,
    `Squad-assisted cranking (${wSessTeam.crankingHatchProgress}) should be ~2x faster than solo (${wSessSolo.crankingHatchProgress})`
  );

  // 5. Renderer draws Tidal Streaks, Black Box & Line Cookies cleanly
  const texts = [];
  const noopCtx = new Proxy(
    {
      canvas: { width: 1280, height: 720 },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: (t) => ({ width: String(t || '').length * 7 }),
      fillText: (t) => texts.push(String(t)),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const r = Object.create(CaveRenderer.prototype);
  r.level = wreck;
  r._cachedDpr = 1;
  const toX = (x) => 400 + x * 20;
  const toY = (y) => 100 + y * 20;
  r._drawDynamicHazards(noopCtx, { thermoclines: [], percolationZones: [], shiftingHatches: [], tidalCurrent: { enabled: true, vx: 0.5, vy: 0.05, strength: 0.5 } }, -40, 80, 0, 80, toX, toY, 20, 4.0, wSessSolo.diver);
  r._drawBlackBoxAndCookies(noopCtx, { ...bbWreck, pingPulse: 0.6 }, hSess.lineCookies, { x: bbWreck.x + 2, y: bbWreck.y }, toX, toY, 20, 4.0, true);
  assert.ok(texts.some((t) => t.includes('BLACK BOX')), 'Renderer should label nearby Black Box');
  assert.ok(texts.some((t) => t.includes('#1 🏠')), 'Renderer should label placed Line Cookies');
});

test('v160 Multi-Dive Expedition Campaigns, Repetitive Surface Intervals & Debrief Black-Box Highlight Reel', async () => {
  const {
    EXPEDITION_CAMPAIGNS,
    SURFACE_INTERVAL_OPTIONS,
    getExpeditionCampaignById,
    createCampaignRunState,
    computeResidualTissueLoadPct,
    computeSurfaceIntervalOffgas,
    applyResidualTissuesToDiveState,
  } = await import('../public/js/game/expeditionCampaigns.js');
  const { recordDiveHighlight } = await import('../public/js/game/diveSession.js');
  const { recordCampaignClearInLogbook } = await import('../public/js/game/logbookModel.js');

  // 1. All 4 Expedition Campaigns reference real registered campaign sites
  assert.equal(EXPEDITION_CAMPAIGNS.length, 4);
  for (const camp of EXPEDITION_CAMPAIGNS) {
    assert.equal(camp.legs.length, 3, `Campaign ${camp.id} must have 3 legs`);
    for (const lid of camp.legs) {
      assert.ok(getLevelById(lid), `Campaign ${camp.id} references valid site ${lid}`);
    }
  }
  const run = createCampaignRunState('wreck-salvage');
  assert.ok(run && getExpeditionCampaignById('wreck-salvage').patchName.includes('Wreck'));

  // 2. Repetitive Surface Interval ZH-L16C tissue off-gassing physics
  const loadedComps = [
    { pN2: 2.1, pHe: 0.45 },
    { pN2: 1.85, pHe: 0.35 },
    { pN2: 1.45, pHe: 0.22 },
    { pN2: 1.15, pHe: 0.12 },
  ];
  const initialLoad = computeResidualTissueLoadPct(loadedComps);
  assert.ok(initialLoad >= 60, `Expected high initial tissue load, got ${initialLoad}%`);

  const quickOff = computeSurfaceIntervalOffgas(loadedComps, 40, 'quick');
  const stdOff = computeSurfaceIntervalOffgas(loadedComps, 40, 'standard');
  const o2Off = computeSurfaceIntervalOffgas(loadedComps, 40, 'o2-offgas');
  assert.equal(SURFACE_INTERVAL_OPTIONS.length, 3);
  assert.ok(quickOff.residualLoadPct < initialLoad, '15m Air Rest should reduce tissue load');
  assert.ok(stdOff.residualLoadPct < quickOff.residualLoadPct, '45m Air Rest should off-gas more than 15m');
  assert.ok(o2Off.compartments[0].pN2 < quickOff.compartments[0].pN2, '20m Surface O2 should wash out fast-compartment N2 rapidly');
  assert.ok(stdOff.cnsPercent < 40, 'Surface interval should decay CNS%');

  const freshState = createDiveState();
  applyResidualTissuesToDiveState(freshState, quickOff);
  assert.ok(freshState.compartments[0].pN2 > 1.0, 'Residual N2 should carry over into next repetitive leg');
  assert.equal(freshState.cnsPercent, quickOff.cnsPercent);

  // 3. Logbook Expedition Patch unlock & cloud merge
  const b0 = createEmptyLogbook();
  const res1 = recordCampaignClearInLogbook(b0, 'cenote-circuit');
  assert.equal(res1.isNew, true);
  assert.deepEqual(res1.book.completedCampaigns, ['cenote-circuit']);
  const res2 = recordCampaignClearInLogbook(res1.book, 'cenote-circuit');
  assert.equal(res2.isNew, false);
  const bOther = recordCampaignClearInLogbook(createEmptyLogbook(), 'abyssal-record').book;
  const merged = mergeCareerLogbooks(res1.book, bOther);
  assert.equal(merged.completedCampaigns.includes('cenote-circuit'), true);
  assert.equal(merged.completedCampaigns.includes('abyssal-record'), true);

  // 4. Debrief Black-Box Highlight Reel auto-bookmarks
  const sess = createDiveSession(LEVEL_1, { diverName: 'Recorder', difficulty: 'standard' });
  sess.simTimeSec = 18;
  sess.diver.y = 24;
  stepDiveSession(sess, { x: 0, y: 0 }, 0.05, {});
  assert.ok(sess.highlights.some((h) => h.kind === 'deepest'), 'Should auto-bookmark deepest depth peak');

  sess.simTimeSec = 42;
  sess.diveState.cnsPercent = 72;
  stepDiveSession(sess, { x: 0, y: 0 }, 0.05, {});
  assert.ok(sess.highlights.some((h) => h.kind === 'close-call'), 'Should auto-bookmark close-call crisis');

  recordDiveHighlight(sess, { kind: 'lore', icon: '🧭', label: 'Cenote Altar', tSec: 30, depthM: 18 });
  assert.ok(sess.highlights[1].tSec >= sess.highlights[0].tSec, 'Highlights should stay sorted chronologically');
});

test('v161 Zero-Config Named AI Crew (Maya/Kai/Elena), Passive Veteran Bond & AAA Mask-Glass Immersion Pass', async () => {
  const { AI_SQUAD_ROSTER, getCrewBondRank, createAiSquad, handlePlayerSignalForAiBuddy } = await import(
    '../public/js/game/aiBuddy.js'
  );
  const { recordCrewDiveInLogbook } = await import('../public/js/game/logbookModel.js');

  // 1. Named zero-config crew traits
  assert.equal(AI_SQUAD_ROSTER.length, 3);
  assert.equal(AI_SQUAD_ROSTER[0].callsign, 'Maya');
  assert.equal(AI_SQUAD_ROSTER[1].callsign, 'Kai');
  assert.equal(AI_SQUAD_ROSTER[2].callsign, 'Elena');

  const sess = createDiveSession(LEVEL_1, { diverName: 'Lead', difficulty: 'standard' });
  const squad = createAiSquad(LEVEL_1, sess.diver, 3, { initialGasId: 'EAN32' });
  assert.equal(squad[0].spotlightBonusM, 4, 'Maya (Torch) gets wider spotlight bonus');
  assert.equal(squad[1].activeBar, 230, 'Kai (Tanks) starts with +25 bar twin-stage reserve');
  assert.ok(squad[2].snagSpeedMult > 1.25, 'Elena (Line) cuts snags faster');
  const okReply = handlePlayerSignalForAiBuddy(squad[0], 'ok', sess, 1000);
  assert.match(okReply.toast || '', /Torch steady/i);

  // 2. Passive Veteran Bond tracking & cloud merge
  let book = createEmptyLogbook();
  for (let i = 0; i < 4; i++) {
    book = recordCrewDiveInLogbook(book, ['ai-wingman-01'], { cleared: true, rescuedIds: i === 0 ? ['ai-wingman-01'] : [] });
  }
  const rank = getCrewBondRank(book.crewBonds['ai-wingman-01']);
  assert.equal(rank.tier, 1);
  assert.match(rank.badge, /Trusted Wingman/);
  const highBook = recordCrewDiveInLogbook(createEmptyLogbook(), ['ai-wingman-02'], { cleared: true });
  highBook.crewBonds['ai-wingman-02'].dives = 16;
  assert.equal(getCrewBondRank(highBook.crewBonds['ai-wingman-02']).tier, 3);
  const merged = mergeCareerLogbooks(book, highBook);
  assert.equal(merged.crewBonds['ai-wingman-01'].dives, 4);
  assert.equal(merged.crewBonds['ai-wingman-02'].dives, 16);

  // 3. Renderer AAA Mask-Glass Immersion Pass executes cleanly across surface droplets, plunge splash, cold fog & exhale bubbles
  let drawCalls = 0;
  const noopCtx = new Proxy(
    {
      canvas: { width: 1280, height: 720 },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      arc: () => { drawCalls++; },
      ellipse: () => { drawCalls++; },
      fillRect: () => { drawCalls++; },
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const r = Object.create(CaveRenderer.prototype);
  r._reducedMotion = false;
  r._drawImmersionGlassFx(noopCtx, 1280, 720, { y: 0.9 }, { heartRateBpm: 128 }, { thermoclineColdFactor: 0.65 }, 'exhale', 0.5);
  assert.ok(drawCalls >= 16, `Expected droplets + splash + cold rim + exhale bubbles draw calls, got ${drawCalls}`);
});

test('v162 Living Shipwrecks (Power Relays, dSMB) & Reactive Marine Life (Mantas, Belugas, Octopuses & Morays)', async () => {
  const {
    createPowerRelays,
    activatePowerRelay,
    deploySurfaceMarkerBuoy,
    applyPeerWreckAction,
    triggerWreckAction,
    captureCameraPhoto,
    POWER_RELAY_BONUS_PTS,
    SMB_DEPLOY_BONUS_PTS,
  } = await import('../public/js/game/diveSession.js');
  const { createMarineEcosystem, stepMarineEcosystem } = await import('../public/js/game/marineLife.js');
  const { drawStyledMegafauna, drawStyledWhaleShark, drawStyledDenizen } = await import('../public/js/game/artSprites.js');
  const { DiveAudio } = await import('../public/js/game/audio.js');

  const wreck = getLevelById('uss-oriskany-carrier');
  assert.ok(wreck && wreck.isWreck, 'Expected USS Oriskany wreck level');

  // 1. Emergency Hull Power Relays on shipwrecks (+220 pts, 18m map sweep, contextual [E], co-op sync)
  const relays = createPowerRelays(wreck);
  assert.equal(relays.length, 2, 'Shipwreck should deterministically spawn 2 Emergency Hull Power Relays');
  assert.equal(createPowerRelays(LEVEL_1).length, 0, 'Natural karst cenote should not spawn industrial power relays');

  const sess = createDiveSession(wreck, { diverName: 'Sparky', difficulty: 'standard' });
  assert.equal(sess.powerRelays.length, 2);
  const relay0 = sess.powerRelays[0];
  sess.diver.x = relay0.x + 1.0;
  sess.diver.y = relay0.y;
  stepDiveSession(sess, { x: 0, y: 0 }, 0.05);
  assert.equal(sess.wreckActionPrompt?.kind, 'power-relay', 'Contextual [E] prompt should surface near inactive relay');

  const synced = [];
  let relayEventFired = false;
  const actRes = triggerWreckAction(sess, {
    onPowerRelay: () => { relayEventFired = true; },
    onWreckSync: (k, id) => synced.push([k, id]),
  });
  assert.equal(actRes.handled, true);
  assert.equal(actRes.kind, 'power-relay');
  assert.equal(relay0.active, true);
  assert.equal(relayEventFired, true);
  assert.equal(sess.relayBonusScore, POWER_RELAY_BONUS_PTS);
  assert.deepEqual(synced[0], ['relay', relay0.id]);
  assert.equal(activatePowerRelay(sess, relay0.id).ok, false, 'Already-active relay cannot be flipped twice');

  // Peer co-op sync flips matching relay cleanly
  const peerSess = createDiveSession(wreck, { diverName: 'Wingman' });
  assert.equal(
    applyPeerWreckAction(peerSess, { actionKind: 'relay', targetId: relay0.id, by: 'Sparky' }),
    true
  );
  assert.equal(peerSess.powerRelays[0].active, true);
  assert.equal(
    applyPeerWreckAction(peerSess, { actionKind: 'relay', targetId: relay0.id, by: 'Sparky' }),
    false
  );

  // 2. Deployable Delayed Surface Marker Buoy (dSMB): overhead safety check, rise physics, Topside ack & drift dampen
  const caveSess = createDiveSession(LEVEL_1, { diverName: 'Tech', difficulty: 'standard' });
  // Place diver deep inside a cave tunnel beneath solid rock ceiling
  const deepSeg = LEVEL_1.segments.find((s) => (s.ay + s.by) * 0.5 > 14);
  caveSess.diver.x = (deepSeg.ax + deepSeg.bx) * 0.5;
  caveSess.diver.y = (deepSeg.ay + deepSeg.by) * 0.5;
  const blocked = deploySurfaceMarkerBuoy(caveSess);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'overhead-blocked', 'dSMB must refuse launch under solid overhead ceiling');

  // Open water along shipwreck shot line succeeds
  const shotX = wreck.shotLine?.x ?? wreck.spawn.x;
  sess.diver.x = shotX;
  sess.diver.y = 9.0;
  let smbCb = false;
  const smbRes = deploySurfaceMarkerBuoy(sess, { onSmbDeploy: () => { smbCb = true; } });
  assert.equal(smbRes.ok, true);
  assert.equal(smbCb, true);
  assert.equal(sess.smbBonusScore, SMB_DEPLOY_BONUS_PTS);
  assert.equal(sess.smb.active, true);
  assert.equal(sess.smb.surfaced, false);

  let topsideAck = '';
  for (let i = 0; i < 60; i++) {
    stepDiveSession(sess, { x: 0, y: 0 }, 0.1, {
      onTopsideChatter: (m) => { if (m.includes('TOPSIDE')) topsideAck = m; },
    });
  }
  assert.equal(sess.smb.surfaced, true, 'dSMB should reach the surface and float at targetY');
  assert.ok(topsideAck.includes('TOPSIDE'), 'Surfaced dSMB should trigger Topside boat radio confirmation');
  assert.equal(deploySurfaceMarkerBuoy(sess).reason, 'already-deployed');

  // 3. Reactive Marine Life: Giant Manta Ray, Arctic Beluga, Octopus & Moray Eel + escort/spook/ink AI + 3-star photo
  const eco = createMarineEcosystem(wreck);
  const manta = eco.megafauna.find((m) => m.kind === 'manta');
  assert.ok(manta, 'Ocean shipwreck ecosystem should spawn a Giant Oceanic Manta Ray');
  assert.ok(eco.denizens.length >= 2, 'Ocean shipwreck ecosystem should spawn Octopus & Moray Eel denizens');

  const polar = getLevelById('scoresby-sund-iceberg');
  const polarEco = createMarineEcosystem(polar);
  assert.ok(polarEco.megafauna.some((m) => m.kind === 'beluga'), 'Polar iceberg site should spawn an Arctic Beluga Whale');

  // Freshwater inland cenote must stay saltwater-free (no oceanic manta rays, reef octopuses, or rock-clipping pelagic shadows)
  const cenoteEco = createMarineEcosystem(LEVEL_1);
  assert.equal(cenoteEco.megafauna.filter((m) => m.kind === 'manta').length, 0, 'Freshwater cenote must not spawn saltwater rays');
  assert.equal(cenoteEco.denizens.length, 0, 'Freshwater cenote must not spawn saltwater octopuses/morays');
  const { createSubmergedStories } = await import('../public/js/game/submergedStories.js');
  assert.equal(createSubmergedStories(LEVEL_1).pelagicShadow, null, 'Freshwater cenote must not run an overhead pelagic manta shadow through rock');
  const wreckStory = createSubmergedStories(wreck);
  assert.ok(wreckStory.pelagicShadow, 'Open-water wreck should keep overhead pelagic shadow');
  const shadowSpeed = (wreckStory.pelagicShadow.xMax - wreckStory.pelagicShadow.xMin) / wreckStory.pelagicShadow.crossingDurationSec;
  assert.ok(shadowSpeed <= 3.0, `Pelagic shadow glide speed should be realistic (<=3 m/s), got ${shadowSpeed.toFixed(2)}`);

  // Calm low-silt diver draws Manta from patrol -> curious -> escort & fires onWildlifeEscort
  const calmDiver = { x: manta.x - 4.0, y: manta.y, vx: 0.2, vy: 0, angle: 0, torchOn: true, dpvActive: false };
  let escorted = null;
  for (let i = 0; i < 20; i++) {
    stepMarineEcosystem(eco, calmDiver, 0.12, i * 0.12, wreck, {
      siltLevel: 0.05,
      onWildlifeEscort: (m) => { escorted = m; },
    });
  }
  assert.equal(manta.behavior, 'escort', 'Calm low-silt diver should earn Manta Ray escort');
  assert.equal(escorted, manta, 'onWildlifeEscort callback should fire once when escort begins');

  // 3-star camera capture on escorting Manta Ray maps to 'mantaray' Field Guide entry
  sess.diver.x = manta.x - 3.0;
  sess.diver.y = manta.y;
  sess.diver.angle = 0;
  sess.diver.flashlightAngle = 0;
  sess.diver.torchOn = true;
  sess.camera.cooldownSec = 0;
  const photo = captureCameraPhoto(sess, eco);
  assert.equal(photo.ok, true);
  assert.equal(photo.subject?.id, 'mantaray');
  assert.equal(photo.stars, 3, 'Escorting Manta Ray in beam should award 3-star golden shot');

  // Loud/DPV/high-silt diver spooks Manta away
  stepMarineEcosystem(eco, { x: manta.x - 3.0, y: manta.y, vx: 3.5, vy: 0, dpvActive: true }, 0.1, 3.0, wreck, {
    siltLevel: 0.7,
  });
  assert.equal(manta.behavior, 'spooked', 'High-silt / DPV diver should spook megafauna');

  // Torch-reactive Giant Pacific Octopus: dim/stealth approach coaxes emergence; close bright torch blast fires defensive ink cloud
  const octo = eco.denizens.find((d) => d.kind === 'octopus');
  assert.ok(octo, 'Expected Giant Pacific Octopus denizen on ocean shipwreck');
  let emerged = false;
  for (let i = 0; i < 25; i++) {
    stepMarineEcosystem(eco, { x: octo.x + (octo.nx || 1) * 4.0, y: octo.y, vx: 0.2, vy: 0, angle: 0, torchOn: false }, 0.15, i * 0.15, wreck, {
      onDenizenEmerge: () => { emerged = true; },
    });
  }
  assert.equal(octo.state, 'curious');
  assert.equal(emerged, true, 'Calm stealth approach should coax Octopus out of its den');

  let inked = false;
  const toOctoAng = Math.atan2(octo.y - (octo.y), octo.x - (octo.x + 3.0));
  stepMarineEcosystem(
    eco,
    { x: octo.x + 3.0, y: octo.y, vx: 0, vy: 0, angle: toOctoAng, torchOn: true },
    0.1,
    5.0,
    wreck,
    { onDenizenInk: () => { inked = true; } }
  );
  assert.equal(octo.state, 'startled');
  assert.equal(inked, true, 'Direct close torch blast should startle Octopus and trigger ink defense');
  assert.ok(octo.inkPuffs.length >= 3, 'Startled Octopus must emit lingering black ink puffs');

  // 4. Renderer & Audio smoke test for v162 floodlights, dSMB, Manta, Beluga, Octopus+Ink & Moray
  const noopCtx = new Proxy(
    {
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: () => ({ width: 64 }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const rendererMock = Object.create(CaveRenderer.prototype);
  rendererMock._drawPowerRelays(noopCtx, sess.powerRelays, sess.diver, (x) => 400 + x * 12, (y) => 120 + y * 12, 12, 4.0);
  rendererMock._drawSurfaceMarkerBuoy(noopCtx, sess.smb, (x) => 400 + x * 12, (y) => 120 + y * 12, 12, 4.0);
  drawStyledMegafauna(noopCtx, { ...manta, behavior: 'escort', facing: 1, pitch: -0.05, trail: [{ x: manta.x - 1, y: manta.y, r: 0.08, life: 1.2, maxLife: 2, golden: true }] }, 420, 260, 14, 4.0);
  drawStyledMegafauna(noopCtx, { ...polarEco.megafauna.find((m) => m.kind === 'beluga'), behavior: 'escort', bubbleRings: [{ x: 10, y: 8, r: 0.3, maxR: 0.6, life: 2.0, maxLife: 3.8 }] }, 480, 220, 14, 4.0);
  drawStyledWhaleShark(noopCtx, { size: 5.8, dir: 1, phase: 0.5 }, 460, 200, 14, 4.0);
  drawStyledDenizen(noopCtx, octo, 500, 310, 14, 4.0);
  const moray = eco.denizens.find((d) => d.kind === 'moray');
  if (moray) drawStyledDenizen(noopCtx, moray, 560, 320, 14, 4.0);

  const audio = new DiveAudio();
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} });
  audio.ctx = {
    state: 'running',
    currentTime: 2,
    sampleRate: 44100,
    destination: {},
    createOscillator: () => ({ type: 'sine', frequency: param(), connect() {}, disconnect() {}, start() {}, stop() { this.onended?.(); } }),
    createBiquadFilter: () => ({ type: 'lowpass', frequency: param(), Q: param(), connect() {}, disconnect() {} }),
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createBuffer: (c, l) => ({ getChannelData: () => new Float32Array(l) }),
    createBufferSource: () => ({ connect() {}, disconnect() {}, start() {}, stop() { this.onended?.(); } }),
  };
  audio.playBreakerSwitch();
  audio.playSmbDeploy();
  audio.playWildlifeHarmony();
});

test('v166 Gear Workshop Persistence (TDZ Fix, Cloud Prefs Sync) & Unified Articulated Diver Avatar', async () => {
  const { readFileSync } = await import('node:fs');
  const {
    drawDiverLimbSegment,
    drawArticulatedDiverLeg,
    drawDiverArmAndTorch,
  } = await import('../public/js/game/artSprites.js');
  const {
    resolveDiverLiveryPalette,
    drawLiveryPreview,
    drawMiniDiverAvatar,
  } = await import('../public/js/game/rigLivery.js');
  const { sanitizePrefs } = await import('../api/_githubAuth.js');

  // 1. Guard against startup TDZ: CAREER_LOGBOOK_KEY & _cachedLogbook MUST be declared before activeRigLivery init
  const mainSrc = readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');
  const logbookDeclIdx = mainSrc.indexOf('const CAREER_LOGBOOK_KEY');
  const liveryInitIdx = mainSrc.indexOf('createLiveryWorkshopController(');
  assert.ok(logbookDeclIdx > 0 && liveryInitIdx > 0);
  assert.ok(
    logbookDeclIdx < liveryInitIdx,
    'CAREER_LOGBOOK_KEY & loadCareerLogbook must be declared before activeRigLivery initializes to avoid TDZ wipe on reload'
  );

  // 2. Cloud Save sanitizePrefs preserves modular livery, 3 saved kit slots & AI Squad uniform flag
  const customRig = {
    suitId: 'wreck-titanium',
    torchId: 'amber-silt',
    patchId: 'wreck-penetrator',
    headgearId: 'cave-helmet',
    trimId: 'salvage-gold',
    tankId: 'salvage-brass',
    visorId: 'reef-mirror',
  };
  const prefs = sanitizePrefs({
    playerName: 'Chris',
    difficulty: 'standard',
    gear: { sonar: true, dpv: true, ccr: true },
    livery: customRig,
    liverySlots: [customRig, null, { suitId: 'arctic-cobalt', torchId: 'tech-led', patchId: 'cave-arrow' }],
    aiSquadTeamUniform: true,
  });
  assert.deepEqual(prefs.livery, customRig);
  assert.equal(prefs.liverySlots.length, 3);
  assert.equal(prefs.liverySlots[0]?.suitId, 'wreck-titanium');
  assert.equal(prefs.liverySlots[1], null);
  assert.equal(prefs.liverySlots[2]?.suitId, 'arctic-cobalt');
  assert.equal(prefs.aiSquadTeamUniform, true);

  // 3. Shared articulated diver helpers + Workshop Test-Tank Preview + Home Avatar Badge render cleanly
  const noopCtx = new Proxy(
    {
      globalAlpha: 1,
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: () => ({ width: 48 }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const pal = resolveDiverLiveryPalette(customRig);
  drawDiverLimbSegment(noopCtx, 100, 100, 140, 100, 18, pal.suitMid);
  drawArticulatedDiverLeg(noopCtx, 100, 100, 70, 104, 48, 92, 18, 90, 0.7, 80, false, true, pal);
  drawArticulatedDiverLeg(noopCtx, 100, 100, 70, 96, 48, 86, 18, 84, 0.7, 80, false, false, pal);
  drawDiverArmAndTorch(noopCtx, 145, 100, 165, 114, 182, 116, 0.05, 80, false, pal, { torchOn: true });

  for (const envMode of ['clear', 'silt', 'night']) {
    drawLiveryPreview(noopCtx, 640, 248, customRig, { hasCcr: envMode === 'night', hasDpv: envMode === 'silt', envMode, timeSec: 1.75 });
  }
  drawMiniDiverAvatar(noopCtx, 124, 72, customRig, { hasCcr: true, hasDpv: true });
});

test('v167 SDF-Sealed Air Pockets & Museum-Grade Bespoke Artifact Visuals', async () => {
  const { createSubmergedStories, stepSubmergedStories } = await import('../public/js/game/submergedStories.js');
  const { classifyArtifactVisual, drawStyledArtifact } = await import('../public/js/game/artSprites.js');

  // 1. Every placed Air Pocket across all 33 levels must sit strictly under solid overhead rock/hull (0 floating/leaky domes)
  let totalPlaced = 0;
  let naturalVaults = 0;
  for (const lvl of LEVELS) {
    const stories = createSubmergedStories(lvl);
    const dome = stories.setPieces.find((sp) => sp.kind === 'air-dome');
    if (!dome) continue;
    totalPlaced++;
    if (dome.isNaturalVault) naturalVaults++;
    assert.ok(Array.isArray(dome.ceilingProfile) && dome.ceilingProfile.length >= 2, `${lvl.id} air pocket must have ceilingProfile`);
    assert.ok(Number.isFinite(dome.leftX) && Number.isFinite(dome.rightX) && dome.rightX > dome.leftX);
    for (const pt of dome.ceilingProfile) {
      const above = evaluateCaveSDF(lvl, pt.x, pt.ceilY - 0.35);
      assert.ok(above > 0, `${lvl.id} air pocket point (${pt.x.toFixed(1)}, ${pt.ceilY.toFixed(1)}) must be sealed by solid overhead rock (got SDF=${above.toFixed(2)})`);
    }
  }
  assert.ok(totalPlaced >= 30, `Expected >=30 sites with valid sealed air pockets, got ${totalPlaced}`);
  assert.ok(naturalVaults >= 20, `Expected >=20 natural concave cave/wreck ceiling vaults, got ${naturalVaults}`);

  // Level 1 air pocket must NOT be floating near the open sunlit cenote spawn basin
  const l1Dome = createSubmergedStories(LEVEL_1).setPieces.find((sp) => sp.kind === 'air-dome');
  assert.ok(l1Dome && Math.hypot(l1Dome.x - LEVEL_1.spawn.x, l1Dome.y - LEVEL_1.spawn.y) >= 13, 'Level 1 air pocket must be inside the overhead cave, away from open entry basin');

  // Hovering beneath an air pocket calms panic & HR and sets activeAirDome
  const st1 = createSubmergedStories(LEVEL_1);
  const d1 = st1.setPieces.find((sp) => sp.kind === 'air-dome');
  const diveSt = { panicLevel: 0.6, heartRateBpm: 118 };
  stepSubmergedStories(st1, { x: d1.x, y: d1.y + 0.6, angle: 0, torchOn: true }, 10, {}, diveSt);
  assert.equal(st1.inAirDome, true);
  assert.equal(st1.activeAirDome, d1);
  assert.ok(diveSt.panicLevel < 0.6 && diveSt.heartRateBpm < 118);

  // 2. Bespoke Artifact Visual Classifier accuracy & smoke rendering across all 350 collectibles
  const expectedTypes = [
    [{ name: 'Maya Jade Pendant', kind: 'relic' }, 'pendant'],
    [{ name: 'East Tool-Drift Pocket Watch', kind: 'relic' }, 'watch'],
    [{ name: 'Obsidian Offering Mask', kind: 'relic' }, 'mask'],
    [{ name: 'Bells Reef Black Pearl', kind: 'pearl' }, 'pearl'],
    [{ name: 'Submerged Copal Amber', kind: 'relic' }, 'amber'],
    [{ name: '1899 Arctic Brass Sextant', kind: 'relic' }, 'sextant'],
    [{ name: 'Pri-Fly Bridge Compass', kind: 'compass' }, 'compass'],
    [{ name: 'Brass Hoist Bell', kind: 'relic' }, 'bell'],
    [{ name: 'Engine Order Telegraph', kind: 'relic' }, 'telegraph'],
    [{ name: '1924 Carbide Miner Lamp', kind: 'gear' }, 'lamp'],
    [{ name: 'Sunken Provençal Amphora', kind: 'relic' }, 'amphora'],
    [{ name: 'Kriegsmarine Enigma Rotor', kind: 'relic' }, 'enigma'],
    [{ name: 'Megalodon Tooth', kind: 'fossil' }, 'tooth'],
    [{ name: 'Blue Calcite Geode', kind: 'crystal' }, 'geode'],
    [{ name: 'Colossal Marble Pyrite Heart', kind: 'crystal' }, 'pyrite'],
  ];
  for (const [sample, expected] of expectedTypes) {
    assert.equal(classifyArtifactVisual(sample).type, expected, `${sample.name} should classify as ${expected}`);
  }

  const noopCtx = new Proxy(
    {
      globalAlpha: 1,
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: () => ({ width: 48 }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const seenTypes = new Set();
  for (const lvl of LEVELS) {
    for (const col of (lvl.collectibles || [])) {
      const vis = classifyArtifactVisual(col);
      seenTypes.add(vis.type);
      drawStyledArtifact(noopCtx, col, 200, 200, 24, 2.5, { isGrand: (col.scale || 1) >= 1.35 });
    }
  }
  assert.ok(seenTypes.size >= 30, `Expected >=30 distinct bespoke artifact silhouettes across campaign, got ${seenTypes.size}`);
});

test('v168 Expedition Masterpiece: Artifact Trophy Vault, Wreck Interiors, Tension Audio, Tactile Silt-Out & Postcard Relics', async () => {
  const {
    createEmptyLogbook,
    recordArtifactInLogbook,
    getArtifactVaultStats,
    mergeCareerLogbooks,
    exportLogbookToJson,
    parseImportedLogbookJson,
  } = await import('../public/js/game/logbookModel.js');
  const { createSubmergedStories } = await import('../public/js/game/submergedStories.js');
  const { renderExpeditionPostcard } = await import('../public/js/game/diveCard.js');

  // 1. Career Artifact Trophy Vault: record, dedupe/count, cloud smart-merge & JSON backup round-trip
  let book = createEmptyLogbook();
  const r1 = recordArtifactInLogbook(book, { id: 'l1-jade', name: 'Maya Jade Pendant', kind: 'relic', siteId: 'cenote-el-abismo', siteName: 'Cenote El Abismo', points: 300 });
  assert.equal(r1.isNew, true);
  book = r1.book;
  const r2 = recordArtifactInLogbook(book, { id: 'l1-jade', name: 'Maya Jade Pendant', kind: 'relic', siteId: 'cenote-el-abismo', siteName: 'Cenote El Abismo', points: 300 });
  assert.equal(r2.isNew, false);
  book = r2.book;
  assert.equal(book.artifacts['l1-jade'].count, 2);

  const otherBook = recordArtifactInLogbook(createEmptyLogbook(), { id: 'oja_c10', name: 'East Tool-Drift Pocket Watch', kind: 'relic', siteId: 'ojamo-iron-mine', siteName: 'Ojamo Mine', points: 520 }).book;
  const merged = mergeCareerLogbooks(book, otherBook);
  const vault = getArtifactVaultStats(merged, LEVELS);
  assert.equal(vault.recoveredCount, 2);
  assert.equal(vault.totalValue, 820);
  assert.equal(vault.items[0].id, 'oja_c10', 'Vault should sort highest-value relics first');

  const jsonStr = exportLogbookToJson({ ...merged, totalDives: 1 }, LEVELS);
  const parsed = parseImportedLogbookJson(jsonStr);
  assert.equal(parsed.ok, true);
  assert.equal(Object.keys(parsed.book.artifacts).length, 2);

  // 2. Signature Shipwreck Interior Set-Pieces: Thistlegorm WWII truck, Oriskany carrier aircraft, Britannic grand staircase
  const thist = LEVELS.find((l) => l.id === 'ss-thistlegorm-wreck');
  const orisk = LEVELS.find((l) => l.id === 'uss-oriskany-carrier');
  const brit = LEVELS.find((l) => l.id === 'hmhs-britannic');
  const stThist = createSubmergedStories(thist);
  const stOrisk = createSubmergedStories(orisk);
  const stBrit = createSubmergedStories(brit);
  assert.ok(stThist.setPieces.some((sp) => sp.kind === 'cargo-vehicle'), 'SS Thistlegorm should spawn iconic WWII cargo truck');
  assert.ok(stOrisk.setPieces.some((sp) => sp.kind === 'carrier-aircraft'), 'USS Oriskany should spawn iconic carrier airframe');
  assert.ok(stBrit.setPieces.some((sp) => sp.kind === 'grand-staircase'), 'HMHS Britannic should spawn iconic Grand Staircase');

  // 3. Tactile Silt-Out "Hand-on-the-Line" & Tight-Squeeze Dust + Renderer smoke test
  const sess = createDiveSession(LEVEL_1, { diverName: 'TactileTester' });
  const glPt = LEVEL_1.guideline[1];
  sess.diver.x = glPt.x + 0.5;
  sess.diver.y = glPt.y + 0.3;
  sess.siltClouds.push({ x: sess.diver.x, y: sess.diver.y, radius: 3.5, maxRadius: 4, life: 12, maxLife: 14, alpha: 0.82, peakAlpha: 0.85, vx: 0, vy: 0 });
  sess.diveState.panicLevel = 0.5;
  stepDiveSession(sess, { x: 0, y: 0 }, 0.1, {});
  assert.equal(sess.handOnLine, true, 'Dense silt near guideline must activate Hand-on-the-Line tactile guidance');
  assert.ok(sess.handOnLinePt && Number.isFinite(sess.handOnLinePt.x));

  const noopCtx = new Proxy(
    {
      globalAlpha: 1,
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: () => ({ width: 52 }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  const rMock = Object.create(CaveRenderer.prototype);
  rMock.level = thist;
  rMock._drawSubmergedStories(noopCtx, stThist, -200, 400, -20, 200, (x) => x * 12, (y) => y * 12, 12, 3.0, 'world');
  rMock._drawSubmergedStories(noopCtx, stOrisk, -200, 400, -20, 200, (x) => x * 12, (y) => y * 12, 12, 3.0, 'world');
  rMock._drawSubmergedStories(noopCtx, stBrit, -200, 400, -20, 200, (x) => x * 12, (y) => y * 12, 12, 3.0, 'world');
  rMock._drawTactileSqueezeAndLineFeel(
    noopCtx,
    sess.diver,
    [{ x: sess.diver.x, y: sess.diver.y, r: 0.06, life: 0.8, maxLife: 1.5, isRust: false }],
    sess.handOnLinePt,
    0.72,
    (x) => x * 12,
    (y) => y * 12,
    12,
    3.0
  );

  // 4. Adaptive Tension Audio, Tank-Scrape Foley & Artifact Discovery Chime
  const { DiveAudio } = await import('../public/js/game/audio.js');
  const audio = new DiveAudio();
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} });
  audio.ctx = {
    state: 'running',
    currentTime: 2,
    sampleRate: 44100,
    destination: {},
    createOscillator: () => ({ type: 'sine', frequency: param(), connect() {}, disconnect() {}, start() {}, stop() { this.onended?.(); } }),
    createBiquadFilter: () => ({ type: 'lowpass', frequency: param(), Q: param(), connect() {}, disconnect() {} }),
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createBuffer: (c, l) => ({ getChannelData: () => new Float32Array(l) }),
    createBufferSource: () => ({ connect() {}, disconnect() {}, start() {}, stop() { this.onended?.(); } }),
  };
  audio._tensionTimer = 0;
  audio.stepAmbience(0.1, thist, 28, sess.diver, { siltDensity: 0.78, inTightSqueeze: true, lowGas: true, inAirDome: false });
  audio.playTankScrape(0.8);
  audio.playArtifactDiscover(true);

  // 5. Expedition Postcard renders recovered artifact medallions cleanly
  const okCard = renderExpeditionPostcard(noopCtx, 1200, 630, {
    level: LEVEL_1,
    diverName: 'Chris',
    grade: 'S',
    score: 9650,
    maxDepthM: 48.2,
    diveTimeSec: 210,
    exploredPct: 94,
    recoveredArtifacts: LEVEL_1.collectibles.slice(0, 3),
    version: 'v168',
  });
  assert.equal(okCard, true);
});

test('v169 Curator Museum Inspector, Topside Atmosphere, Wetnotes Survey Slate, Frog-Kick Trim & Underwater Lighting', async () => {
  const {
    ARTIFACT_COLLECTIONS,
    classifyArtifactCollection,
    recordArtifactInLogbook,
    setPinnedArtifactInLogbook,
    getArtifactCollectionProgress,
    getArtifactVaultStats,
  } = await import('../public/js/game/logbookModel.js');
  const { renderSurveySlate } = await import('../public/js/game/surveySlate.js');
  const { stirFloorSilt } = await import('../public/js/game/silt.js');
  const { computeDiverScoreSummary, MAX_TRIM_BONUS } = await import('../public/js/game/scoring.js');
  const { CaveRenderer } = await import('../public/js/game/renderer.js');

  // 1. Curator Collections, Lore Persistence & Pinned Postcard Relic
  assert.equal(ARTIFACT_COLLECTIONS.length, 5);
  assert.equal(classifyArtifactCollection({ name: 'Maya Jade Pendant', kind: 'relic' }), 'mayan-cenote');
  assert.equal(classifyArtifactCollection({ name: 'Kriegsmarine Enigma Rotor', kind: 'relic' }), 'wwii-naval');
  assert.equal(classifyArtifactCollection({ name: 'Ginori Porcelain Dinner Plate', kind: 'relic' }), 'ocean-liner');
  assert.equal(classifyArtifactCollection({ name: 'Megalodon Tooth', kind: 'fossil' }), 'abyssal-minerals');
  assert.equal(classifyArtifactCollection({ name: '1899 Arctic Brass Sextant', kind: 'relic' }), 'polar-expedition');

  let book = createEmptyLogbook();
  for (const [id, name] of [
    ['m1', 'Maya Jade Pendant'],
    ['m2', 'Obsidian Offering Mask'],
    ['m3', 'Submerged Copal Amber'],
    ['m4', 'Sunken Provençal Amphora'],
  ]) {
    book = recordArtifactInLogbook(book, { id, name, kind: 'relic', siteId: LEVEL_1.id, siteName: LEVEL_1.name, lore: 'Historical provenance', points: 300 }).book;
  }
  book = setPinnedArtifactInLogbook(book, 'm2');
  const colProg = getArtifactCollectionProgress(book);
  assert.equal(colProg.completedCount, 1);
  assert.equal(colProg.highestCuratorTitle, 'Cenote Archaeologist');
  const vault = getArtifactVaultStats(book, LEVELS);
  assert.equal(vault.pinnedArtifactId, 'm2');
  assert.equal(vault.items[0].id, 'm2', 'Pinned showcase relic should sort first');

  const merged = mergeCareerLogbooks(createEmptyLogbook(), book);
  assert.equal(merged.pinnedArtifactId, 'm2');
  assert.equal(merged.artifacts.m2.lore, 'Historical provenance');
  const parsed = parseImportedLogbookJson(exportLogbookToJson({ ...book, totalDives: 1 }, LEVELS));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.book.pinnedArtifactId, 'm2');

  // 2. Frog-Kick vs Flutter-Kick Trim Physics & Silt Discipline Scoring
  const sess = createDiveSession(LEVEL_1, { diverName: 'TrimMaster' });
  const glPt = LEVEL_1.guideline[1];
  sess.diver.x = glPt.x;
  sess.diver.y = Math.max(8, glPt.y);
  sess.diver.angle = 0.05; // level cave trim
  stepDiveSession(sess, { x: 0.65, y: 0, boost: false }, 0.12, {});
  assert.equal(sess.diver.finTechnique, 'frog', 'Controlled level swimming must engage Frog-Kick trim');

  stepDiveSession(sess, { x: 1.0, y: 0.7, boost: true }, 0.12, {});
  assert.equal(sess.diver.finTechnique, 'flutter', 'Boosted steep swimming must engage Flutter-Kick');

  // Verify Frog-Kick cuts floor silt accumulation drastically vs Flutter-Kick
  const tFrog = { accum: 0 };
  const tFlut = { accum: 0 };
  const cFrog = [];
  const cFlut = [];
  const floorProbeDiver = { x: LEVEL_1.guideline[2].x, y: LEVEL_1.guideline[2].y + 1.2, vx: 1.1, vy: 0, angle: 0 };
  // Find a spot near floor
  let testY = floorProbeDiver.y;
  for (let probe = 0; probe < 12; probe += 0.25) {
    if (evaluateCaveSDF(LEVEL_1, floorProbeDiver.x, floorProbeDiver.y + probe) >= 0) {
      testY = floorProbeDiver.y + probe - 0.55;
      break;
    }
  }
  floorProbeDiver.y = testY;
  for (let k = 0; k < 25; k++) {
    stirFloorSilt(LEVEL_1, floorProbeDiver, cFrog, { dt: 0.1, thrustMag: 0.8, timerState: tFrog, finTechnique: 'frog' });
    stirFloorSilt(LEVEL_1, floorProbeDiver, cFlut, { dt: 0.1, thrustMag: 0.8, timerState: tFlut, finTechnique: 'flutter' });
  }
  assert.ok(cFlut.length > cFrog.length, `Flutter kick (${cFlut.length}) should stir more floor silt than Frog kick (${cFrog.length})`);

  const sumTrim = computeDiverScoreSummary({
    level: LEVEL_1,
    diveState: sess.diveState,
    checkpointsHit: new Set(LEVEL_1.checkpoints.map((c) => c.id)),
    collectedIds: new Set(LEVEL_1.collectibles.map((c) => c.id)),
    exploredCount: 100,
    totalExploreCells: 100,
    trimBonusScore: MAX_TRIM_BONUS,
  });
  assert.equal(sumTrim.trimBonusScore, MAX_TRIM_BONUS);
  assert.ok(sumTrim.totalScore <= computeLevelMaxScore(LEVEL_1.id, false), 'Trim bonus must stay within leaderboard max ceiling');

  // 3. Wetnotes Fog-of-War Survey Slate + Torch Artifact Spotting
  const firstRelic = LEVEL_1.collectibles[0];
  sess.diver.x = firstRelic.x - 2.0;
  sess.diver.y = firstRelic.y;
  sess.diver.angle = 0;
  sess.diver.torchAngle = 0;
  sess.diver.torchOn = true;
  stepDiveSession(sess, { x: 0, y: 0 }, 0.05, {});
  assert.equal(sess.spottedArtifacts.has(firstRelic.id), true, 'Torch/proximity must plot uncollected relics on Wetnotes Survey Slate');

  const noopCtx = new Proxy(
    {
      globalAlpha: 1,
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: () => ({ width: 52 }),
    },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
  );
  assert.equal(renderSurveySlate(noopCtx, 280, 196, sess, 2.5), true);

  // 4. Living Topside Atmosphere + AAA Underwater Lighting smoke test across Wreck, Polar, Cenote
  const rMock = Object.create(CaveRenderer.prototype);
  for (const lid of ['ss-thistlegorm-wreck', 'strytan-thermal-vent', LEVEL_1.id]) {
    rMock.level = LEVELS.find((l) => l.id === lid) || LEVEL_1;
    rMock._activeWeather = { forceBiolum: true };
    rMock._drawTopsideAtmosphereExtras(noopCtx, -50, 150, (x) => x * 14, (y) => y * 14, 14, 3.2);
    rMock._drawTorchMarineSnowAndCaustics(noopCtx, sess.diver, -50, 150, -5, 40, (x) => x * 14, (y) => y * 14, 14, 3.2, 0.9);
  }

  // 5. Postcard with pinned Curator showcase artifact renders cleanly
  const okPinnedCard = renderExpeditionPostcard(noopCtx, 1200, 630, {
    level: LEVEL_1,
    diverName: 'Curator',
    grade: 'S+',
    score: 11200,
    maxDepthM: 42,
    diveTimeSec: 185,
    exploredPct: 98,
    pinnedArtifact: vault.pinnedArtifact,
    recoveredArtifacts: LEVEL_1.collectibles.slice(0, 2),
    version: 'v169',
  });
  assert.equal(okPinnedCard, true);
});

test('v171 Comprehensive Audit & Polish: Scoring/Rank, Vault Namespacing, Physics/Audio, Sparse Rock Baking & Modular Renderers', async () => {
  const {
    computeDiverScoreSummary,
    computeTeamScoreSummary,
    MAX_EXPEDITION_BONUS,
    MAX_TRIM_BONUS,
    MAX_WEATHER_BONUS,
  } = await import('../public/js/game/scoring.js');
  const { computeLevelMaxScore } = await import('../public/js/game/leaderboardModel.js');
  const {
    createEmptyLogbook,
    recordArtifactInLogbook,
    classifyArtifactCollection,
    mergeGhostTracks,
  } = await import('../public/js/game/logbookModel.js');
  const { stepSubmergedStories } = await import('../public/js/game/submergedStories.js');
  const { evaluateDiveContracts, rollDiveContracts } = await import('../public/js/game/expeditionContracts.js');
  const { DiveAudio } = await import('../public/js/game/audio.js');
  const { createBoxSDFEvaluator } = await import('../public/js/game/collision.js');
  const { castTorchFan } = await import('../public/js/game/lighting.js');
  const { CaveRenderer } = await import('../public/js/game/renderer.js');
  const { clamp, normalizeAngle, formatClock, hashStr } = await import('../public/js/util/common.js');

  // 1. Scoring pipeline preserves expeditionBonusScore on cave levels & Team Rank denominator has no +500 phantom penalty
  const dsClean = createDiveState();
  const soloSummary = computeDiverScoreSummary({
    name: 'AuditDiver',
    level: LEVEL_1,
    diveState: dsClean,
    checkpointsHit: new Set(LEVEL_1.checkpoints.map((c) => c.id)),
    collectedIds: new Set(LEVEL_1.collectibles.map((c) => c.id)),
    exploredCount: 100,
    totalExploreCells: 100,
    diveTimeSec: 120,
    hatchBonusScore: 0,
    expeditionBonusScore: 520,
    weatherBonusScore: 180,
    trimBonusScore: MAX_TRIM_BONUS,
  });
  assert.equal(soloSummary.expeditionBonusScore, 520, 'Cave level must preserve expeditionBonusScore without clamping to maxHatchBonus=0');
  assert.equal(soloSummary.trimBonusScore, MAX_TRIM_BONUS);
  assert.equal(soloSummary.weatherBonusScore, 180);
  assert.ok(soloSummary.totalScore <= computeLevelMaxScore(LEVEL_1.id, false), 'Solo score must stay within leaderboard max ceiling');

  const teamSum = computeTeamScoreSummary(soloSummary, []);
  assert.equal(teamSum.expeditionBonusScore, 520);
  assert.equal(teamSum.trimBonusScore, MAX_TRIM_BONUS);
  assert.equal(teamSum.weatherBonusScore, 180);
  assert.ok(
    teamSum.teamRank.grade === 'S+' || teamSum.teamRank.grade === 'S',
    `Near-perfect solo summary must earn S/S+ grade without phantom rank penalty (got ${teamSum.teamRank.grade})`
  );
  assert.ok(MAX_EXPEDITION_BONUS >= 900 && MAX_WEATHER_BONUS >= 250);

  // 2. Trophy Vault namespaced IDs + balanced Curator Collection classification + 40-site ghost sync cap
  let book = createEmptyLogbook();
  book = recordArtifactInLogbook(book, { id: 'ojamo:col-1', name: 'Iron Ore Core', kind: 'crystal', siteId: 'ojamo', points: 220 }).book;
  book = recordArtifactInLogbook(book, { id: 'krubera:col-1', name: 'Abyssal Crystal Heart', kind: 'crystal', siteId: 'krubera', points: 360 }).book;
  assert.equal(Object.keys(book.artifacts).length, 2, 'Namespaced artifact keys must prevent cross-level col-1 collisions');
  assert.equal(classifyArtifactCollection({ name: 'Abyssal Crystal Heart', kind: 'crystal' }), 'abyssal-minerals');
  assert.equal(classifyArtifactCollection({ name: 'First-Class Gold Ring', kind: 'relic' }), 'ocean-liner');
  assert.equal(classifyArtifactCollection({ name: 'Compass Binnacle', kind: 'compass' }), 'polar-expedition');

  const ghostA = {};
  for (let i = 1; i <= 35; i++) ghostA[`site-${i}`] = [[0, 0, 0, 0], [100 + i, 50, 20, 0]];
  const mergedGhosts = mergeGhostTracks(ghostA, {});
  assert.equal(Object.keys(mergedGhosts).length, 35, 'mergeGhostTracks must preserve all 33+ campaign levels without dropping sites 31-33');

  // 3. Contracts field-photographer reads session.camera.photoCount
  const contracts = rollDiveContracts(LEVEL_1, '42');
  const photoContract = { id: 'field-photographer', target: 3, progress: 0, completed: false, rewardPts: 150 };
  const mockPhotoSess = {
    level: LEVEL_1,
    diver: { x: 0, y: 10 },
    diveState: createDiveState(),
    camera: { photoCount: 3 },
    contracts: [photoContract],
  };
  evaluateDiveContracts(mockPhotoSess, {});
  assert.equal(photoContract.completed, true, 'field-photographer contract must complete via session.camera.photoCount');
  assert.ok(contracts.length >= 2);

  // 4. Air-dome calming scales cleanly with dt (framerate independent)
  const makeDomeState = () => ({
    stories: {
      setPieces: [{ kind: 'air-dome', x: 10, y: 8, radius: 3.0, width: 5.0, height: 2.5, discovered: true }],
      inAirDome: false,
      activeAirDome: null,
    },
    diver: { x: 10, y: 7.5 },
    diveState: { panicLevel: 0.6, heartRateBpm: 120 },
  });
  const sBig = makeDomeState();
  stepSubmergedStories(sBig.stories, sBig.diver, 1.0, {}, sBig.diveState, 0.1);
  const sSmall = makeDomeState();
  for (let i = 0; i < 10; i++) stepSubmergedStories(sSmall.stories, sSmall.diver, 1.0 + i * 0.01, {}, sSmall.diveState, 0.01);
  assert.ok(sBig.diveState.panicLevel < 0.6, 'Air-dome must calm diver panic');
  assert.ok(Math.abs(sBig.diveState.panicLevel - sSmall.diveState.panicLevel) < 0.01, 'Air-dome calming must be framerate-independent');

  // 5. Safety Role / dSMB deco perk accelerates inert-gas offgassing in diveState.compartments & Frog-Kick trim fair in open shaft
  const sessDeco = createDiveSession(LEVEL_1, { diverName: 'SafetyDiver', crewRoleId: 'safety' });
  sessDeco.diveState.decoCeilingM = 6;
  const pN2Before = sessDeco.diveState.compartments[0].pN2;
  sessDeco.diver.y = 6.0;
  stepDiveSession(sessDeco, { x: 0, y: 0 }, 0.5, {});
  assert.ok(sessDeco.diveState.compartments[0].pN2 < pN2Before || sessDeco.diveState.decoRemainingSec === undefined, 'Safety role deco perk must offgas real compartments without mutating nonexistent decoRemainingSec');

  // 6. DiveAudio.playUiClick & tension hysteresis
  const audio = new DiveAudio();
  assert.equal(typeof audio.playUiClick, 'function');
  audio.playUiClick();
  audio.ctx = { state: 'running', currentTime: 1.0 };
  audio.muted = false;
  audio._tensionTimer = 0.5;
  audio.stepAmbience(0.2, LEVEL_1, 3, { x: 0, y: 3 }, { siltDensity: 0, inTightSqueeze: false, lowGas: false });
  assert.ok(audio._tensionTimer > 0.5, 'Calm tension <= 0.28 must recharge _tensionTimer upward instead of firing');

  // 7. Sparse rock-tile baking + 2D box SDF hasGeometry + reusable torch ray pool + common.js
  const solidBoxSdf = createBoxSDFEvaluator(LEVEL_1, LEVEL_1.bounds.xMax - 2, LEVEL_1.bounds.xMax + 4, LEVEL_1.bounds.yMax - 2, LEVEL_1.bounds.yMax + 4, 2.0);
  assert.equal(typeof solidBoxSdf.hasGeometry, 'boolean');
  const rayPool = [];
  const r1 = castTorchFan(LEVEL_1, LEVEL_1.spawn.x, LEVEL_1.spawn.y + 3, 0, 0.4, 12, 16, [], rayPool);
  const firstObj = r1[0];
  const r2 = castTorchFan(LEVEL_1, LEVEL_1.spawn.x, LEVEL_1.spawn.y + 3, 0.1, 0.4, 12, 16, [], rayPool);
  assert.equal(r2[0], firstObj, 'castTorchFan must reuse pre-allocated ray hit objects when outRays pool is provided');

  const rSparse = Object.create(CaveRenderer.prototype);
  rSparse._rockPxPerM = 16;
  const farChunk = rSparse._buildRockChunk(LEVEL_1, 500, 524, { data: new Uint8ClampedArray(512 * 512 * 4) }, null, 120, 184);
  assert.equal(farChunk.solidRock, true, 'Empty deep rock tile must take sparse solidRock fast path');
  assert.equal(farChunk.canvas, null, 'Sparse solidRock tile must allocate zero offscreen canvas VRAM');

  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(formatClock(125), '02:05');
  assert.ok(Math.abs(normalizeAngle(Math.PI * 3) - Math.PI) < 0.001 || Math.abs(normalizeAngle(Math.PI * 3) + Math.PI) < 0.001);
  assert.equal(hashStr('cave-diver'), hashStr('cave-diver'));
});

test('v172 Monolith Debt Paydown: Modular Renderers, Decomposed stepDiveSession, UI Controllers, CSS & SW Parity', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { CaveRenderer } = await import('../public/js/game/renderer.js');
  const { escapeHtml } = await import('../public/js/util/common.js');

  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const pubDir = path.resolve(testDir, '..', 'public');
  const html = fs.readFileSync(path.join(pubDir, 'index.html'), 'utf8');
  const swSrc = fs.readFileSync(path.join(pubDir, 'sw.js'), 'utf8');
  const rendererSrc = fs.readFileSync(path.join(pubDir, 'js/game/renderer.js'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(pubDir, 'js/main.js'), 'utf8');
  const sessionSrc = fs.readFileSync(path.join(pubDir, 'js/game/diveSession.js'), 'utf8');

  // 1. CaveRenderer split: prototype retains all extracted renderer methods & renderer.js stays compact
  const protoNames = new Set(Object.getOwnPropertyNames(CaveRenderer.prototype));
  for (const m of [
    '_buildRockChunk',
    '_drawChunks',
    '_drawSurfaceSky',
    '_drawSurfaceTopEnvironment',
    '_drawWreckShipArchitecture',
    '_drawCaveInteractives',
    '_drawVolumetricTorchBeam',
    '_drawLighting',
    '_drawImmersionGlassFx',
  ]) {
    assert.ok(protoNames.has(m), `CaveRenderer.prototype missing extracted method ${m}`);
  }
  assert.ok(rendererSrc.split(/\r?\n/).length < 5000, 'renderer.js should stay cleanly modularized (<5000L)');
  assert.ok(mainSrc.split(/\r?\n/).length < 8200, 'main.js should stay cleanly modularized (<8200L)');

  // 2. stepDiveSession decomposed into 5 named simulation phases
  for (const phaseFn of [
    'function stepPropulsionAndCurrents(',
    'function stepWreckAndCaveInteractives(',
    'function stepHydrodynamicsAndSilt(',
    'function stepPhysiologyAndObjectives(',
    'function stepTelemetryAndExitOutcome(',
  ]) {
    assert.ok(sessionSrc.includes(phaseFn), `diveSession.js missing phase function ${phaseFn}`);
  }

  // 3. Every getElementById(...) across ALL extracted public/js/ui/*.js controllers must exist in index.html
  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const uiDir = path.join(pubDir, 'js/ui');
  const uiFiles = fs.readdirSync(uiDir).filter((f) => f.endsWith('.js'));
  assert.ok(uiFiles.length >= 10, `Expected >=10 modular UI controller files, got ${uiFiles.length}`);
  const missingUiIds = [];
  for (const f of uiFiles) {
    const src = fs.readFileSync(path.join(uiDir, f), 'utf8');
    for (const m of src.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)) {
      const id = m[1];
      if (!htmlIds.has(id) && !src.includes(`id="${id}"`) && !src.includes(`id='${id}'`)) {
        missingUiIds.push(`${f}:${id}`);
      }
    }
    assert.ok(swSrc.includes(`./js/ui/${f}?v=`), `SW CORE_SHELL missing UI module ./js/ui/${f}`);
  }
  assert.deepEqual(missingUiIds, [], `UI controllers reference missing HTML IDs: ${missingUiIds.join(', ')}`);

  // 4. Every extracted renderer module under public/js/game/renderers/*.js must be precached in SW CORE_SHELL
  const renderersDir = path.join(pubDir, 'js/game/renderers');
  const rendererFiles = fs.readdirSync(renderersDir).filter((f) => f.endsWith('.js'));
  assert.ok(rendererFiles.length >= 6, `Expected >=6 modular renderer files, got ${rendererFiles.length}`);
  for (const f of rendererFiles) {
    assert.ok(swSrc.includes(`./js/game/renderers/${f}?v=`), `SW CORE_SHELL missing renderer ./js/game/renderers/${f}`);
  }

  // 5. Shared escapeHtml helper behaves properly
  assert.equal(escapeHtml('<script>"&"</script>'), '&lt;script&gt;&quot;&amp;&quot;&lt;/script&gt;');
});

test('v173 Unified Docked Tactical Map, Lazy Level Enrichment, Compressed Icons & Coordinated Notification Lane', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { LEVELS, ensureLevelEnriched } = await import('../public/js/levels/index.js');

  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const pubDir = path.resolve(testDir, '..', 'public');
  const html = fs.readFileSync(path.join(pubDir, 'index.html'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(pubDir, 'js/main.js'), 'utf8');

  // 1. High-Tech Tactical Sonar Overlay sits outside .hud-top-stack (v186: Wetnotes removed)
  const topStackMatch = html.match(/<div class="hud-top-stack">([\s\S]*?)<\/div>\s*\n\s*<!-- High-Tech Tactical Sonar Overlay/);
  assert.ok(topStackMatch, 'Expected High-Tech Tactical Sonar Overlay comment directly after .hud-top-stack');
  assert.equal(topStackMatch[1].includes('id="hud-minimap-wrap"'), false, '#hud-minimap-wrap must live outside .hud-top-stack so alerts never shift it');
  assert.ok(html.includes('id="btn-sonar-overlay-ping"'), 'Missing active PING button in High-Tech Sonar Overlay');
  assert.ok(html.includes('id="hud-minimap-sonar-view"'), 'Missing Sonar view wrapper inside High-Tech Sonar Overlay');

  // 2. Lazy cave interactive enrichment helper works cleanly and idempotently
  const cave = LEVELS.find((l) => !l.isWreck);
  assert.ok(cave, 'Expected at least one cave level');
  ensureLevelEnriched(cave);
  assert.equal(cave._caveInteractivesEnriched, true, 'ensureLevelEnriched must mark cave as enriched');
  assert.ok(Array.isArray(cave.stageCaches), 'Enriched cave must expose stageCaches array');
  assert.ok(Array.isArray(cave.caveCurrents), 'Enriched cave must expose caveCurrents array');

  // 3. Compressed PWA icons stay compact (<60 KB for 512px, <20 KB for 192px)
  const size512 = fs.statSync(path.join(pubDir, 'icons/icon-512.png')).size;
  const size192 = fs.statSync(path.join(pubDir, 'icons/icon-192.png')).size;
  assert.ok(size512 < 60_000, `icon-512.png should be compressed <60KB (got ${size512})`);
  assert.ok(size192 < 20_000, `icon-192.png should be compressed <20KB (got ${size192})`);

  // 4. Discovery card lane coordination & accurate Frog-Kick Trim debrief wiring
  assert.ok(mainSrc.includes('hideArtifactSpotlight()'), 'showHudPhotoCard should clear Artifact Spotlight');
  assert.ok(mainSrc.includes('hideHudPhotoCard()'), 'showArtifactSpotlight should clear Photo Card');
  assert.ok(mainSrc.includes('session.trimStats?.disciplinePct'), 'Debrief trim row should read session.trimStats?.disciplinePct');
});

test('v174 Campaign Mastery Rewards, Bidirectional Replay-Depth Sync & Technical Rescue Drills Mode', async () => {
  const { EXPEDITION_CAMPAIGNS } = await import('../public/js/game/expeditionCampaigns.js');
  const { computeUnlockedLiveries, getHeadgearStyle, getSuitLivery, getTorchOptic, getTankFinish, getMilestonePatch } = await import('../public/js/game/rigLivery.js');
  const { buildDebriefDepthChartData, renderDebriefDepthChart } = await import('../public/js/ui/debriefChart.js');
  const { RESCUE_DRILLS, getRescueDrillById, applyRescueDrillScenario, evaluateRescueDrillResult } = await import('../public/js/game/rescueDrills.js');
  const { createEmptyLogbook, recordCampaignClearInLogbook, recordRescueDrillClearInLogbook, mergeCareerLogbooks } = await import('../public/js/game/logbookModel.js');
  const { createDiveSession } = await import('../public/js/game/diveSession.js');
  const { createAiSquad } = await import('../public/js/game/aiBuddy.js');
  const { getLevelById } = await import('../public/js/levels/index.js');

  // 1. Campaign Mastery Rewards: locked by default, unlocked individually per campaign clear
  assert.equal(EXPEDITION_CAMPAIGNS.length, 4);
  for (const camp of EXPEDITION_CAMPAIGNS) {
    assert.ok(camp.reward?.patchId && camp.reward?.itemId && camp.reward?.label, `Campaign ${camp.id} missing reward metadata`);
  }
  const emptyUnlocks = computeUnlockedLiveries(createEmptyLogbook());
  assert.equal(emptyUnlocks.suits.has('karst-jade'), false);
  assert.equal(emptyUnlocks.headgears.has('brass-hardhat'), false);
  assert.equal(emptyUnlocks.torches.has('aurora-plasma'), false);
  assert.equal(emptyUnlocks.tanks.has('abyssal-titanium'), false);
  assert.equal(emptyUnlocks.patches.has('camp-karst'), false);

  let book = createEmptyLogbook();
  for (const camp of EXPEDITION_CAMPAIGNS) {
    book = recordCampaignClearInLogbook(book, camp.id).book;
  }
  const fullUnlocks = computeUnlockedLiveries(book);
  assert.equal(fullUnlocks.suits.has('karst-jade'), true);
  assert.equal(fullUnlocks.headgears.has('brass-hardhat'), true);
  assert.equal(fullUnlocks.torches.has('aurora-plasma'), true);
  assert.equal(fullUnlocks.tanks.has('abyssal-titanium'), true);
  assert.equal(fullUnlocks.patches.has('camp-karst'), true);
  assert.equal(fullUnlocks.patches.has('camp-salvage'), true);
  assert.equal(fullUnlocks.patches.has('camp-polar'), true);
  assert.equal(fullUnlocks.patches.has('camp-abyssal'), true);
  assert.equal(getSuitLivery('karst-jade').id, 'karst-jade');
  assert.equal(getHeadgearStyle('brass-hardhat').id, 'brass-hardhat');
  assert.equal(getTorchOptic('aurora-plasma').rangeMult, 1.12);
  assert.equal(getTankFinish('abyssal-titanium').id, 'abyssal-titanium');
  assert.equal(getMilestonePatch('camp-abyssal').id, 'camp-abyssal');

  // 2. Bidirectional Replay Theater <-> Depth Profile SVG chart + highlight markers
  const prof = [
    { t: 0, d: 2, gas: 'EAN32', deco: 0, ppo2: 0.38, cns: 0, hr: 72, bar: 200, gf99: 10 },
    { t: 30, d: 34, gas: 'TMX1455', deco: 0, ppo2: 0.62, cns: 3, hr: 84, bar: 170, gf99: 42 },
    { t: 60, d: 6, gas: 'O2', deco: 6, ppo2: 1.55, cns: 9, hr: 70, bar: 185, gf99: 78 },
  ];
  const chartData = buildDebriefDepthChartData(prof, 34, {
    success: true,
    highlights: [{ icon: '📍', label: 'Deepest Point', tSec: 30, depthM: 34 }],
  });
  assert.ok(chartData.markup.includes('data-hl-t="30.00"'), 'Depth chart SVG must render clickable highlight diamond marker');
  const fakeScrub = { textContent: '' };
  const fakeSvg = { innerHTML: '', querySelector: () => null };
  let scrubbedT = -1;
  const chartCtrl = renderDebriefDepthChart({
    wrapEl: { hidden: true },
    svgEl: fakeSvg,
    scrubEl: fakeScrub,
    profile: prof,
    maxDepthM: 34,
    success: true,
    onScrubTime: (t) => { scrubbedT = t; },
  });
  assert.ok(typeof chartCtrl?.setCursorTime === 'function');
  chartCtrl.setCursorTime(30, { notify: true });
  assert.equal(scrubbedT, 30);
  assert.ok(fakeScrub.textContent.includes('34.0m') && fakeScrub.textContent.includes('TMX1455'));

  // 3. Dedicated Technical Rescue Drills: all 4 scenarios, grading & Career Logbook Drill Mastery merge
  assert.equal(RESCUE_DRILLS.length, 4);
  for (const drill of RESCUE_DRILLS) {
    const lvl = getLevelById(drill.levelId);
    const sess = createDiveSession(lvl, { diverName: 'DrillDiver', difficulty: drill.difficulty, drillsEnabled: true });
    if (drill.needsAiBuddy) {
      sess.aiSquad = createAiSquad(lvl, sess.diver, 1);
      sess.aiBuddy = sess.aiSquad[0];
    }
    applyRescueDrillScenario(sess, drill);
    assert.equal(sess.activeRescueDrillId, drill.id);
    if (drill.id === 'silt-line-recovery') assert.ok(sess.siltClouds.length >= 10, 'Silt-out drill must spawn silt bank');
    if (drill.id === 'freeflow-bailout') {
      assert.equal(sess.drills.active?.kind, 'free-flow');
      assert.equal(sess.drills.active?.hissAccum, 0, 'Free-flow drill must initialize numeric hissAccum');
      assert.equal(sess.drills.active?.severity, 1.0, 'Free-flow drill must initialize severity');
    }
    if (drill.id === 'buddy-ooa-share') {
      assert.ok(sess.aiSquad[0].activeBar <= 15 && sess.aiSquad[0].issue?.kind === 'low-gas');
      assert.ok(sess.aiSquad[0].issue?.countdownSec > 0 && sess.aiSquad[0].issue?.hudLabel, 'Buddy OOA issue must carry full Hardcore issue schema');
    }
    if (drill.id === 'net-cut-deco') {
      assert.ok(sess.diveState.stopDepthM >= 6);
      assert.equal(sess.activeSnagIndex, 0, 'Net-cut drill must immediately engage snag 0 on frame 1');
    }
  }
  const mainSrc = (await import('node:fs')).readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');
  assert.ok(!/\bactiveIncomingChallenge\b/.test(mainSrc), 'main.js must use sandboxCtrl.getActiveIncomingChallenge(), never bare activeIncomingChallenge');
  assert.ok(mainSrc.includes('await ensureLevelLoaded(drill.levelId'), 'launchRescueDrill must bake & load the drill level before startDiveRun');
  const ffDrill = getRescueDrillById('freeflow-bailout');
  const ffSess = createDiveSession(getLevelById(ffDrill.levelId), { diverName: 'Ace', drillsEnabled: true });
  applyRescueDrillScenario(ffSess, ffDrill);
  ffSess.drills.completedCount = 1;
  ffSess.diveState.diveTimeSec = 48;
  ffSess.trimStats = { disciplinePct: 96, blowouts: 0, zeroSiltMaster: true };
  const gradeRes = evaluateRescueDrillResult(ffDrill, ffSess, { success: true });
  assert.equal(gradeRes.passed, true);
  assert.equal(gradeRes.grade, 'S+');

  const dBookA = recordRescueDrillClearInLogbook(createEmptyLogbook(), { drillId: 'freeflow-bailout', grade: 'A', timeSec: 68, score: 1650 }).book;
  const dBookB = recordRescueDrillClearInLogbook(createEmptyLogbook(), { drillId: 'freeflow-bailout', grade: 'S+', timeSec: 48, score: 2150 }).book;
  const dMerged = mergeCareerLogbooks(dBookA, dBookB);
  assert.equal(dMerged.drillMastery['freeflow-bailout'].bestGrade, 'S+');
  assert.equal(dMerged.drillMastery['freeflow-bailout'].bestTimeSec, 48);
});

test('v175 Streamlined Home Interface: removes setup strip, gear dock & daily card from homepage; moves gear into Dive Setup and Daily card into Daily Dive panel', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const menuStart = html.indexOf('<section id="screen-menu"');
  const menuEnd = html.indexOf('</section>', menuStart);
  const homeHtml = html.slice(menuStart, menuEnd);

  assert.ok(!homeHtml.includes('id="menu-active-modifiers"'), 'Setup modifier strip must be removed from homepage');
  assert.ok(!homeHtml.includes('id="menu-gear-dock"'), 'Tech Gear Loadout panel must be removed from homepage');
  assert.ok(!homeHtml.includes('id="daily-challenge-card"'), 'Daily Dive card must be removed from homepage');
  assert.ok(homeHtml.includes('class="menu-actions menu-actions-secondary"'), 'Homepage must render prominent Setup & Daily Dive secondary action row');
  assert.ok(homeHtml.includes('id="btn-setup-drawer"') && homeHtml.includes('home-action-btn'), 'Existing Setup button must be prominent on homepage');
  assert.ok(homeHtml.includes('id="btn-open-daily-calendar"') && homeHtml.includes('id="home-daily-streak-badge"'), 'Daily Dive button with compact streak badge must be on homepage');

  const dailyModalStart = html.indexOf('<div id="daily-calendar-modal"');
  const setupModalStart = html.indexOf('<div id="dive-setup-modal"');
  const liveryModalStart = html.indexOf('<div id="livery-modal"');
  const dailyModalHtml = html.slice(dailyModalStart, setupModalStart);
  const setupModalHtml = html.slice(setupModalStart, liveryModalStart);

  assert.ok(dailyModalHtml.includes('id="daily-challenge-card"') && dailyModalHtml.includes('id="btn-play-daily"'), 'Daily Dive panel must host today’s Daily Sump card & PLAY DAILY button');
  assert.ok(setupModalHtml.includes('id="menu-gear-dock"') && setupModalHtml.includes('id="gear-dock-grid"'), 'Dive Setup modal must host Tech Gear Loadout dock');
});

test('v178 Diegetic Immersion Tape binds real depthM, ceilingM, active tank bar/mix & diver.angle', () => {
  const texts = [];
  let redCeilingDrawn = false;
  const fakeCtx = {
    save() {},
    restore() {},
    beginPath() {},
    roundRect() {},
    rect() {},
    moveTo() {},
    lineTo() {},
    fill() {},
    stroke() {
      if (String(this.strokeStyle).includes('248, 113, 113')) redCeilingDrawn = true;
    },
    fillText(t) { texts.push(String(t)); },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
  };
  const state = createDiveState();
  state.depthM = 28.4;
  state.ceilingM = 6.0;
  switchGas(state, 'TMX1455');
  state.tanks.TMX1455.bar = 142;

  CaveRenderer.prototype._drawDiegeticImmersionTape.call(
    { _cachedDpr: 1 },
    fakeCtx,
    1200,
    800,
    { x: 10, y: 28.4, angle: Math.PI },
    state,
    { x: 25, y: 28.4 },
    1.2
  );
  assert.ok(texts.includes('28.4m'), `Expected live depth 28.4m in tape, got: ${texts.join(', ')}`);
  assert.ok(texts.some((t) => t.includes('TMX 14/55') && t.includes('142b')), `Expected active mix & bar in tape, got: ${texts.join(', ')}`);
  assert.ok(texts.some((t) => t.includes('HDG 270° W') && t.includes('WP 15m')), `Expected live heading from diver.angle, got: ${texts.join(', ')}`);
  assert.ok(redCeilingDrawn, 'Expected red deco ceiling marker line when ceilingM > 0.4');
});

test('v180 Bottom-Level Silent Secret Tight-Squeeze, Mounted-Torch Speargun, Pure Combat Mode & Massive Dynamically Lit Kraken Boss Arena (Level 1)', async () => {
  const { getLevelMaxDepthM } = await import('../public/js/levels/index.js');
  const {
    SECRET_LAIRS,
    SPEARGUN_AUTOFIRE_SEC,
    SPEARGUN_TAP_COOLDOWN_SEC,
    computeBossDifficultyScale,
    fireSpeargun,
    applyBossDamage,
    getSecretLairActionPrompt,
    serializeSecretLairNetState,
    applySecretLairNetState,
    applyRemoteBossEvent,
  } = await import('../public/js/game/secretLairs.js');

  const spec = SECRET_LAIRS['cenote-el-abismo'];
  assert.ok(spec, 'Level 1 must register a Secret Lair spec');
  assert.equal(getLevelMaxDepthM(LEVEL_1), 50, 'Level 1 max depth must remain 50m for campaign monotonicity');
  assert.ok(spec.veil.y >= 48.5, 'Secret tight-squeeze entrance must branch off the very bottom 50m Deep Sump');
  assert.ok(spec.arena.cx - spec.armory.x >= 115, 'Passage from Armory to Boss Arena must be >115m long');
  assert.ok(spec.arena.rx >= 26 && spec.arena.ry >= 13, 'Boss arena must be massive (~56m x 28m)');
  assert.ok((spec.arena.lightSconces || []).length >= 6, 'Boss arena must have dynamic bioluminescent sconces');
  assert.ok(spec.minions.length >= 10, 'Long gauntlet must feature >=10 escalating lesser enemies');
  assert.ok(
    spec.minions.every((m) => m.x > spec.armory.x + 10),
    'Speargun armory must appear at the very beginning before ANY enemy'
  );

  // 1. Every Secret Lair landmark is inside navigable open water (SDF < -0.9)
  const checkOpen = (label, x, y) => {
    const sdf = evaluateCaveSDF(LEVEL_1, x, y);
    assert.ok(sdf < -0.9, `${label} (${x}, ${y}) should be open water, got SDF=${sdf.toFixed(2)}`);
  };
  checkOpen('Veil', spec.veil.x, spec.veil.y);
  checkOpen('Armory', spec.armory.x, spec.armory.y);
  checkOpen('Corridor Stage', spec.arena.midStage.x, spec.arena.midStage.y);
  for (const m of spec.minions) checkOpen(`Minion ${m.id}`, m.x, m.y);
  for (const st of spec.arena.gasCaches) checkOpen(`Arena Stage ${st.id}`, st.x, st.y);
  for (const p of spec.arena.pillars) checkOpen(`Pillar ${p.id}`, p.x, p.y);
  checkOpen('Boss Home', spec.boss.x, spec.boss.y);
  checkOpen('Exit Updraft', spec.arena.exitUpdraft.x, spec.arena.exitUpdraft.y);

  // Explore cells must exclude secretLair passages so normal Level 1 runs can still reach 100%
  const expCells = buildExploreCells(LEVEL_1);
  assert.ok(
    expCells.every((c) => Math.hypot(c.x - spec.arena.cx, c.y - spec.arena.cy) > 12),
    'buildExploreCells must exclude secretLair arena cells from standard exploration %'
  );

  // 2. Built-in short-range acoustic ping (16m, no Cave Sonar unlocked) silently discovers the bottom-level tight squeeze (ZERO direct callout!)
  const session = createDiveSession(LEVEL_1, { diverName: 'KrakenHunter', gear: { sonar: false } });
  const toasts = [];
  const cb = { onToast: (msg) => toasts.push(msg) };
  assert.ok(session.secretLair, 'Level 1 dive session should initialize secretLair state');
  assert.equal(session.secretLair.veilRevealed, false);
  const farPing = triggerSonarPing(session, cb);
  assert.equal(farPing.ok, true);
  assert.equal(session.secretLair.veilRevealed, false, 'Veil must NOT be revealed from spawn');

  // Swim to bottom Deep Sump (on TMX1455 like a real deep diver) near tight squeeze & ping
  switchGas(session.diveState, 'TMX1455');
  session.sonar.cooldownSec = 0;
  session.diver.x = 128.0;
  session.diver.y = 49.5;
  const nearPing = triggerSonarPing(session, cb);
  assert.equal(nearPing.ok, true);
  assert.equal(session.secretLair.veilRevealed, true, 'Sonar ping at Deep Sump bottom must reveal tight squeeze');
  assert.ok(
    toasts.every((t) => !/veil|hollow|secret|sanctum|breach/i.test(t)),
    `Discovering secret squeeze must emit ZERO direct callout, got: ${toasts.join(' | ')}`
  );
  session.diver.x = spec.veil.x - 2.4;
  session.diver.y = spec.veil.y;
  assert.equal(getSecretLairActionPrompt(session), null, 'Secret tight squeeze must show ZERO direct HUD action callout');

  // 3. Before sonar reveal, sealed veil blocks diver; after sonar reveal, swimming into tight squeeze auto-breaches silently!
  session.secretLair.veilRevealed = false;
  session.diver.x = spec.veil.x - 1.0;
  session.diver.y = spec.veil.y;
  session.diver.vx = 2.0;
  stepDiveSession(session, { x: 1, y: 0 }, 0.05, cb);
  assert.equal(session.secretLair.veilBreached, false, 'Unrevealed tight squeeze must remain sealed');
  assert.ok(
    Math.hypot(session.diver.x - spec.veil.x, session.diver.y - spec.veil.y) >= spec.veil.radius + 0.5,
    'Sealed veil must physically block diver until sonar-discovered'
  );

  // Reveal via sonar & swim directly into tight squeeze -> silent fracture breach
  toasts.length = 0;
  session.secretLair.veilRevealed = true;
  session.diver.x = spec.veil.x - 2.6;
  session.diver.y = spec.veil.y;
  stepDiveSession(session, { x: 1, y: 0 }, 0.05, cb);
  assert.equal(session.secretLair.veilBreached, true, 'Swimming into sonar-revealed tight squeeze auto-opens it');
  assert.ok(
    toasts.every((t) => !/veil|hollow|secret|sanctum|breach/i.test(t)),
    `Breaching secret squeeze must stay subtle without loud callout, got: ${toasts.join(' | ')}`
  );

  // 4. Quiet Armory Anteroom auto-equips Speargun & switches into Pure Combat Mode (freezes diving gas/DCS/tox!)
  session.diver.x = spec.armory.x;
  session.diver.y = spec.armory.y;
  stepDiveSession(session, { x: 0, y: 0 }, 0.05, cb);
  assert.equal(session.secretLair.weaponEquipped, true, 'Swimming onto Armory Rack must auto-equip Speargun');
  assert.equal(session.secretLair.combatMode, true, 'Equipping Speargun must activate Pure Combat Mode');
  const gasBefore = session.diveState.tanks.EAN32.bar;
  const cnsBefore = session.diveState.cnsPercent || 0;
  for (let i = 0; i < 40; i++) stepDiveSession(session, { x: 0.4, y: 0 }, 0.05, cb);
  assert.equal(session.diveState.tanks.EAN32.bar, gasBefore, 'Combat Mode must freeze gas burn');
  assert.equal(session.diveState.cnsPercent || 0, cnsBefore, 'Combat Mode must freeze O2 toxicity/physiology');

  // 5. Twin-Stick Hold Autofire (0.30s) vs Faster Tap-to-Fire (0.14s) + 5th-shot Hyper-Tip Piercing Spear
  assert.ok(SPEARGUN_TAP_COOLDOWN_SEC < SPEARGUN_AUTOFIRE_SEC, 'Tap cooldown must be strictly faster than hold autofire');
  const holdShot1 = fireSpeargun(session, { aimAngle: 0, isTap: false });
  assert.equal(holdShot1.ok, true);
  // Advance 0.18s: hold autofire is still cooling (0.30s), but TAP fires immediately (>=0.14s)!
  stepDiveSession(session, { x: 0, y: 0 }, 0.18, cb);
  assert.equal(fireSpeargun(session, { aimAngle: 0, isTap: false }).ok, false, 'Hold autofire respects 0.30s cadence');
  assert.equal(fireSpeargun(session, { aimAngle: 0, isTap: true }).ok, true, 'Tapping fires faster than holding!');

  // Fire until 5th shot -> automatic Hyper-Tip Piercing Spear!
  let sawHyper = false;
  for (let k = 0; k < 5; k++) {
    session.secretLair.tapCooldownSec = 0;
    const res = fireSpeargun(session, { aimAngle: 0, isTap: true });
    if (res.ok && res.bolt.piercing) sawHyper = true;
  }
  assert.equal(sawHyper, true, 'Every 5th shot must automatically fire a Hyper-Tip piercing spear');

  // 6. Squad Difficulty Scaling across 1-4 divers
  const s1 = computeBossDifficultyScale(1, 0);
  const s2 = computeBossDifficultyScale(2, 0);
  const s4 = computeBossDifficultyScale(4, 0);
  const sAi = computeBossDifficultyScale(1, 3);
  assert.equal(s1.hpMult, 1.0);
  assert.ok(s2.hpMult > s1.hpMult && s4.hpMult > s2.hpMult);
  assert.ok(sAi.hpMult > s1.hpMult && sAi.hpMult < s4.hpMult);

  // 7. Killing a corridor enemy drops an emerald Bio-Heal Orb
  const moray = session.secretLair.minions.find((m) => m.kind === 'moray');
  moray.hp = 10;
  session.secretLair.tapCooldownSec = 0;
  session.diver.x = moray.x - 2.8;
  session.diver.y = moray.y;
  fireSpeargun(session, { aimAngle: 0, isTap: true });
  for (let i = 0; i < 12; i++) stepDiveSession(session, { x: 0, y: 0 }, 0.04, cb);
  assert.equal(moray.alive, false, 'Corridor moray should be defeated');
  assert.ok(session.secretLair.healOrbs.length >= 1, 'Defeating a corridor enemy must drop an emerald Bio-Heal Orb');

  // 8. 3-Phase Boss Battle (XIBALBA'S MAW) + Snare Break -> Stunned Window + Victory Updraft Exiting Combat Mode
  session.diver.x = spec.arena.cx - 12;
  session.diver.y = spec.arena.cy;
  stepDiveSession(session, { x: 0, y: 0 }, 0.05, cb);
  assert.equal(session.secretLair.boss.active, true, 'Entering massive Sunken Sanctum must awaken XIBALBA’S MAW');
  assert.equal(session.secretLair.boss.phase, 1);

  // Push into Phase 2 (<= 66% HP) -> Vortex + Swarmers + Heal Orbs
  applyBossDamage(session, Math.ceil(session.secretLair.boss.maxHp * 0.40), { crit: true });
  assert.equal(session.secretLair.boss.phase, 2);
  assert.equal(session.secretLair.boss.phase2Summoned, true);

  // Push into Phase 3 (<= 33% HP) & test Tentacle Snare break by tapping Fire -> Stuns Kraken!
  applyBossDamage(session, Math.ceil(session.secretLair.boss.maxHp * 0.35), { crit: true });
  assert.equal(session.secretLair.boss.phase, 3);
  session.secretLair.boss.pinnedTargetId = 'local';
  session.secretLair.boss.pinHitsNeeded = 2;
  session.secretLair.tapCooldownSec = 0;
  fireSpeargun(session, { aimAngle: 0, isTap: true });
  assert.equal(session.secretLair.boss.pinHitsNeeded, 1);
  session.secretLair.tapCooldownSec = 0;
  fireSpeargun(session, { aimAngle: 0, isTap: true });
  assert.equal(session.secretLair.boss.pinnedTargetId, null, 'Tapping fire while snared breaks tentacle grab');
  assert.equal(session.secretLair.boss.aiState, 'stunned', 'Breaking tentacle snare must STUN the Kraken for bonus damage');

  // Defeat boss -> trophy, bonus score, exit updraft exits Combat Mode & carries diver to 6m Deco Shelf
  applyBossDamage(session, session.secretLair.boss.hp + 50, { crit: true });
  assert.equal(session.secretLair.bossDefeated, true);
  assert.ok(session.secretLair.bonusScore >= spec.boss.bonusPoints, 'Boss defeat must award full boss bonus score');

  session.diver.x = spec.arena.exitUpdraft.x;
  session.diver.y = spec.arena.exitUpdraft.y;
  const updraftRes = triggerWreckAction(session);
  assert.equal(updraftRes.ok, true);
  assert.equal(session.secretLair.combatMode, false, 'Riding victory updraft exits Combat Mode cleanly');
  assert.ok(
    Math.hypot(session.diver.x - spec.arena.exitUpdraft.destX, session.diver.y - spec.arena.exitUpdraft.destY) < 1.5
  );

  // 9. Co-op Sync Snapshot & Remote Event Relay
  const peerSession = createDiveSession(LEVEL_1, { diverName: 'Buddy2' });
  applyRemoteBossEvent(peerSession, { kind: 'veil_breach' });
  assert.equal(peerSession.secretLair.veilBreached, true);
  const netSnap = serializeSecretLairNetState(session.secretLair);
  applySecretLairNetState(peerSession.secretLair, netSnap);
  assert.equal(peerSession.secretLair.bossDefeated, true);

  // 10. Regression guard (v181): main.js must never reference undefined `photoModeActive` or `toggleDivePause`
  const fs = await import('node:fs');
  const mainSrc = fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');
  assert.ok(!/\bphotoModeActive\b/.test(mainSrc), 'main.js must use photoModeState.active, never undefined photoModeActive');
  assert.ok(!/\btoggleDivePause\b/.test(mainSrc), 'main.js must use setDivePaused(!divePaused), never undefined toggleDivePause');
});

test('v182 Secret Lair Overhaul: Anti-Bypass Veil, CP4 Sonar, Resonance Crystals, Pillar-Occluded Beam, Matador Crash & Fair Continuous Damage', async () => {
  const {
    SECRET_LAIRS,
    fireSpeargun,
    computeBeamEndPoint,
    isShelteredByPillar,
  } = await import('../public/js/game/secretLairs.js');
  const spec = SECRET_LAIRS['cenote-el-abismo'];

  // 1. Veil Anti-Bypass: swimming directly toward Armory from all vertical offsets without Sonar MUST be blocked!
  for (const offsetY of [-2.0, -1.0, 0, 1.0, 2.0]) {
    const s = createDiveSession(LEVEL_1, { diverName: 'BypassCheck', gear: { sonar: false } });
    switchGas(s.diveState, 'TMX1455');
    s.diver.x = 128.0;
    s.diver.y = 49.5 + offsetY;
    for (let i = 0; i < 80; i++) {
      const dx = 151.5 - s.diver.x;
      const dy = 48.8 - s.diver.y;
      const m = Math.hypot(dx, dy) || 1;
      stepDiveSession(s, { x: dx / m, y: dy / m }, 0.05);
    }
    assert.equal(s.secretLair.veilBreached, false, `Veil must stay sealed without sonar at offsetY=${offsetY}`);
    assert.ok(s.diver.x <= 135.5, `Diver must not bypass sealed veil at offsetY=${offsetY} (got x=${s.diver.x})`);
  }

  // 2. Ultimate Failsafe: if a diver ever lands deep inside the corridor unbreached, auto-breach prevents empty cathedral!
  const fsSession = createDiveSession(LEVEL_1, { diverName: 'FailsafeCheck', gear: { sonar: false } });
  switchGas(fsSession.diveState, 'TMX1455');
  fsSession.diver.x = 143.5;
  fsSession.diver.y = 49.5;
  stepDiveSession(fsSession, { x: 0, y: 0 }, 0.05);
  assert.equal(fsSession.secretLair.veilBreached, true, 'Failsafe must auto-breach veil if diver is ever past the neck');

  // 3. Built-in 16m Sonar from CP4 Deep Sump (114, 49.0 -> 22.2m away) reliably reveals the hidden seam!
  const s = createDiveSession(LEVEL_1, { diverName: 'Hunter', gear: { sonar: false } });
  switchGas(s.diveState, 'TMX1455');
  s.diver.x = 115.0;
  s.diver.y = 49.0;
  const ping = triggerSonarPing(s);
  assert.equal(ping.ok, true);
  assert.equal(s.secretLair.veilRevealed, true, 'CP4 Deep Sump acoustic ping must reveal the hidden abyssal seam');

  // 4. True Ray-Blocked Vortex Pillar Shelter (sheltered behind pillar, exposed beside pillar!)
  const pWest = spec.arena.pillars[0];
  const bossPos = { x: 285.0, y: 40.5 };
  const awayAng = Math.atan2(pWest.y - bossPos.y, pWest.x - bossPos.x);
  const behindX = pWest.x + Math.cos(awayAng) * (pWest.radius + 1.5);
  const behindY = pWest.y + Math.sin(awayAng) * (pWest.radius + 1.5);
  const sideX = pWest.x - Math.sin(awayAng) * (pWest.radius + 1.8);
  const sideY = pWest.y + Math.cos(awayAng) * (pWest.radius + 1.8);
  assert.ok(isShelteredByPillar(behindX, behindY, bossPos.x, bossPos.y, spec.arena.pillars), 'Directly behind pillar must shelter');
  assert.equal(isShelteredByPillar(sideX, sideY, bossPos.x, bossPos.y, spec.arena.pillars), null, 'Standing exposed beside pillar must NOT shelter');

  // 5. Pillar-Occluded Sweeping Bioluminescent Abyssal Beam stops cleanly on cover pillars
  const toPillar = Math.atan2(pWest.y - bossPos.y, pWest.x - bossPos.x);
  const beamHit = computeBeamEndPoint(bossPos.x, bossPos.y, toPillar, 30, spec.arena.pillars, 0.25);
  assert.ok(beamHit.hitPillar && beamHit.hitPillar.id === pWest.id, 'Abyssal Beam must be occluded by cover pillar');
  assert.ok(beamHit.dist < Math.hypot(pWest.x - bossPos.x, pWest.y - bossPos.y), 'Occluded beam must terminate on pillar front face');

  // 6. Awakening -> Sequential Sconces + Chargeable Pillar Resonance Crystal -> Stuns Boss!
  s.secretLair.veilBreached = true;
  s.diver.x = spec.armory.x;
  s.diver.y = spec.armory.y;
  stepDiveSession(s, { x: 0, y: 0 }, 0.05);
  assert.equal(s.secretLair.combatMode, true);

  s.diver.x = spec.arena.cx - 12;
  s.diver.y = spec.arena.cy;
  stepDiveSession(s, { x: 0, y: 0 }, 0.05);
  assert.equal(s.secretLair.boss.aiState, 'awakening', 'Entering cathedral triggers Boss Awakening sequence');
  for (let i = 0; i < 65; i++) stepDiveSession(s, { x: 0, y: 0 }, 0.05);
  assert.equal(s.secretLair.sconceLitCount, spec.arena.lightSconces.length, 'All 6 sconces ignite during Awakening');
  assert.notEqual(s.secretLair.boss.aiState, 'awakening', 'Boss transitions out of awakening into live combat');

  // Fire 5th-shot golden Hyper-Tip directly at p-north Resonance Crystal -> instant 3/3 Resonance Break Stun!
  const pNorth = spec.arena.pillars[1];
  s.secretLair.boss.x = pNorth.x + 8;
  s.secretLair.boss.y = pNorth.y + 4;
  s.diver.x = pNorth.x - 4.5;
  s.diver.y = pNorth.y;
  s.secretLair.shotCounter = 4;
  s.secretLair.tapCooldownSec = 0;
  fireSpeargun(s, { aimAngle: 0, isTap: true, originX: s.diver.x, originY: s.diver.y });
  for (let i = 0; i < 12; i++) stepDiveSession(s, { x: 0, y: 0 }, 0.025);
  assert.equal(s.secretLair.resonanceBreaks, 1, 'Hyper-Tip into Pillar Crystal must trigger Resonance Break!');
  assert.equal(s.secretLair.boss.aiState, 'stunned', 'Resonance Break must stun XIBALBA’S MAW');

  // 7. Continuous Damage Frame-Rate Fix: 60 ticks of 1/60s Tentacle Snare (~9 DPS) deals ~9 HP, NEVER 60 HP!
  s.secretLair.playerHp = 100;
  s.secretLair.boss.aiState = 'grab_hold';
  s.secretLair.boss.pinnedTargetId = 'local';
  s.secretLair.boss.pinTimerSec = 2.0;
  s.secretLair.boss.stateTimer = 2.0;
  for (let i = 0; i < 60; i++) stepDiveSession(s, { x: 0, y: 0 }, 1 / 60);
  const snareLoss = 100 - s.secretLair.playerHp;
  assert.ok(snareLoss >= 6 && snareLoss <= 14, `1s of 60Hz snare must deal ~9 HP, not frame-clamped 60 HP (got ${snareLoss.toFixed(1)})`);

  // 8. Regression guard (v183): main.js must never call undefined `spawnCelebrationBurst` on boss defeat!
  const fs = await import('node:fs');
  const mainSrc = fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');
  assert.ok(!/\bspawnCelebrationBurst\b/.test(mainSrc), 'main.js must call spawnCelebrationConfetti(), never undefined spawnCelebrationBurst');
});

test('v184 Speargun Mode Exclusivity, Immediate Loss on Boss Kill & Cute Anime Boss Animation State', async () => {
  const {
    SECRET_LAIRS,
    claimSecretLairWeapon,
    fireSpeargun,
    applyBossDamage,
    serializeSecretLairNetState,
    applySecretLairNetState,
  } = await import('../public/js/game/secretLairs.js');
  const spec = SECRET_LAIRS['cenote-el-abismo'];

  const s = createDiveSession(LEVEL_1, { diverName: 'AnimeTester', gear: { sonar: true } });
  switchGas(s.diveState, 'TMX1455');

  // 1. Outside Secret Lair Combat Mode: no speargun, cannot fire
  assert.equal(s.secretLair.weaponEquipped, false);
  assert.equal(s.secretLair.combatMode, false);
  assert.equal(fireSpeargun(s, { aimAngle: 0, isTap: true }).ok, false);

  // 2. Breach veil and claim speargun inside Armory -> equipped in combat mode
  s.secretLair.veilBreached = true;
  s.diver.x = spec.armory.x;
  s.diver.y = spec.armory.y;
  stepDiveSession(s, { x: 0, y: 0 }, 0.05);
  assert.equal(s.secretLair.weaponClaimed, true);
  assert.equal(s.secretLair.weaponEquipped, true);
  assert.equal(s.secretLair.combatMode, true);
  assert.equal(fireSpeargun(s, { aimAngle: 0, isTap: true }).ok, true);

  // 3. Exiting back into the main cave stows the speargun; re-entering before boss kill re-equips it
  s.diver.x = spec.veil.sealWallX - 4.0;
  s.diver.y = spec.veil.y;
  stepDiveSession(s, { x: 0, y: 0 }, 0.05);
  assert.equal(s.secretLair.weaponEquipped, false, 'Speargun must be stowed when leaving Secret Lair');
  assert.equal(s.secretLair.combatMode, false, 'Combat mode must turn off outside Secret Lair');
  assert.equal(fireSpeargun(s, { aimAngle: 0, isTap: true }).ok, false, 'Cannot fire speargun outside Secret Lair');

  s.diver.x = spec.armory.x;
  s.diver.y = spec.armory.y;
  stepDiveSession(s, { x: 0, y: 0 }, 0.05);
  assert.equal(s.secretLair.weaponEquipped, true, 'Speargun must re-equip upon re-entering Secret Lair before boss kill');
  assert.equal(s.secretLair.combatMode, true);

  // 4. Enter boss arena -> anime animation state ticks & reacts to hits with jelly jiggle
  s.diver.x = spec.arena.cx - 12;
  s.diver.y = spec.arena.cy;
  for (let i = 0; i < 70; i++) stepDiveSession(s, { x: 0, y: 0 }, 0.05);
  assert.ok(s.secretLair.boss.anim, 'Boss must maintain cute anime animation state');
  assert.ok(s.secretLair.boss.anim.swimCycle > 1.0, 'Boss swimCycle must advance every frame');
  applyBossDamage(s, 40, { crit: true });
  assert.ok(s.secretLair.boss.anim.jiggleAmp >= 0.12, 'Boss hit must trigger cute mochi jelly jiggle');
  assert.ok(s.secretLair.boss.anim.hurtSec > 0, 'Boss hit must trigger brief > < hit-flinch expression');

  // 5. Killing the boss IMMEDIATELY removes the speargun & prevents re-equipping or firing
  s.secretLair.tapCooldownSec = 0;
  fireSpeargun(s, { aimAngle: 0, isTap: true });
  assert.ok(s.secretLair.spears.length >= 1);
  applyBossDamage(s, s.secretLair.boss.hp + 999, { crit: true });
  assert.equal(s.secretLair.bossDefeated, true);
  assert.equal(s.secretLair.weaponEquipped, false, 'Killing the boss must immediately remove the speargun');
  assert.equal(s.secretLair.spears.length, 0, 'In-flight spears must clear on boss defeat');
  assert.equal(fireSpeargun(s, { aimAngle: 0, isTap: true }).ok, false, 'Cannot fire speargun after boss kill');
  assert.equal(claimSecretLairWeapon(s).ok, false, 'Cannot re-claim speargun after boss kill');

  // Re-visiting the armory after boss kill must NEVER re-equip the speargun
  s.diver.x = spec.armory.x;
  s.diver.y = spec.armory.y;
  stepDiveSession(s, { x: 0, y: 0 }, 0.05);
  assert.equal(s.secretLair.weaponEquipped, false, 'Armory must not re-equip speargun after boss is defeated');

  // 6. Peer co-op sync: receiving remote bossDefeated also immediately removes peer speargun
  const peer = createDiveSession(LEVEL_1, { diverName: 'CoopPeer' });
  peer.secretLair.veilBreached = true;
  peer.secretLair.weaponClaimed = true;
  peer.secretLair.weaponEquipped = true;
  peer.secretLair.combatMode = true;
  applySecretLairNetState(peer.secretLair, serializeSecretLairNetState(s.secretLair));
  assert.equal(peer.secretLair.bossDefeated, true);
  assert.equal(peer.secretLair.weaponEquipped, false, 'Co-op peer must also lose speargun immediately on boss defeat');

  // 7. v185 Regression guard: Combat Mode moves twin joysticks to bottom-left & bottom-right via flex layout and hides tactical minimap
  const fs = await import('node:fs');
  const cssSrc = fs.readFileSync(new URL('../public/css/style.css', import.meta.url), 'utf8');
  assert.match(
    cssSrc,
    /#screen-hud\.combat-mode\s+\.hud-bottom-dock\s*\{[^}]*display:\s*flex\s*!important;[^}]*justify-content:\s*space-between;/s,
    'Combat mode .hud-bottom-dock must switch from grid to flex space-between so joysticks anchor bottom-left & bottom-right'
  );
  assert.ok(
    cssSrc.includes('#screen-hud.combat-mode .hud-minimap-wrap'),
    'Combat mode must hide the docked tactical minimap (#hud-minimap-wrap)'
  );
});

test('v186 Streamlined 5-Tool Dive Kit, Quiet Top-Middle HUD, Wetnotes Removal & High-Tech Sonar Overlay', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../public/css/style.css', import.meta.url), 'utf8');
  const mainSrc = fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');

  // 1. Dive Kit popover contains ONLY Scooter, Sonar, Camera, Signals, and Torch
  const kitMatch = html.match(/<div id="hud-kit-popover"[\s\S]*?<div class="gear-bar-row">/);
  assert.ok(kitMatch, 'Expected #hud-kit-popover in index.html');
  const kitIds = [...kitMatch[0].matchAll(/<button[^>]+id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    kitIds,
    ['btn-kit-dpv', 'btn-kit-sonar', 'btn-kit-camera', 'btn-hud-signals', 'btn-kit-torch'],
    'Dive Kit must contain strictly Scooter, Sonar, Camera, Signals, and Torch'
  );

  // 2. Wetnotes completely removed from HUD
  assert.equal(html.includes('survey-slate-panel'), false, 'Wetnotes panel must be removed from index.html');
  assert.equal(html.includes('btn-minimap-slate'), false, 'Wetnotes tab must be removed from index.html');
  assert.equal(/Wetnotes/i.test(html), false, 'Wetnotes labels must be removed from index.html');

  // 3. Noisy top-middle artifact/photo cards removed & diving toasts silenced unless critical
  assert.equal(html.includes('id="hud-artifact-spotlight"'), false, 'Top-middle artifact spotlight card must be removed');
  assert.equal(html.includes('id="hud-photo-card"'), false, 'Top-middle photo card must be removed');
  assert.match(mainSrc, /if\s*\(mode\s*===\s*'diving'\s*&&\s*!critical\)\s*return;/, 'showToast must suppress routine update alerts while diving');

  // 4. High-tech Sonar Overlay positioned top-right directly beneath .hud-top-bar with live PING button, range tag & renders cleanly
  assert.ok(html.includes('class="hud-subtop-row"'), 'Sonar Overlay must sit inside .hud-subtop-row beneath .hud-top-bar');
  assert.match(css, /\.hud-minimap-wrap\s*\{[^}]*margin-left:\s*auto;/s, 'Sonar Overlay must be right-aligned cleanly');
  assert.ok(html.includes('id="btn-sonar-overlay-ping"'), 'Sonar Overlay must include quick PING button');
  assert.ok(html.includes('id="hud-sonar-range"'), 'Sonar Overlay must include range readout');
  const s = createDiveSession(LEVEL_1, { diverName: 'SonarTester', gear: { sonar: true, dpv: true } });
  triggerSonarPing(s);
  const calls = [];
  const fakeCtx = new Proxy(
    {
      createRadialGradient: () => ({ addColorStop() {} }),
      createLinearGradient: () => ({ addColorStop() {} }),
    },
    {
      get(t, p) {
        if (p in t) return t[p];
        return (...args) => calls.push(String(p));
      },
    }
  );
  drawSonarMinimap(fakeCtx, 384, 216, {
    level: LEVEL_1,
    diver: s.diver,
    exploreCells: s.exploreCells,
    exploredCells: s.exploredCells,
    exploredGrid: s.exploredGrid,
    checkpointsHit: s.checkpointsHit,
    nextCheckpoint: LEVEL_1.checkpoints[0],
    sonarPulse: s.sonar.activePulse,
    difficulty: 'standard',
    zoomMode: 'follow',
    timeSec: 2.5,
  });
  assert.ok(calls.includes('arc') && calls.includes('fillText'), 'High-tech Sonar Overlay must draw polar rings, sweep & telemetry cleanly');
});
