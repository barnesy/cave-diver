import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GAS_MIXES,
  createDiveState,
  switchGas,
  stepDivePhysiology,
  computePPO2,
  computeEND,
  getRecommendedGas,
  getAscentInstruction,
  getGasSwitchCoach,
  computeSiteDivePlan,
  getShareableGasCandidate,
  donateGasFromState,
  receiveGasIntoState,
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
  recordDailyClear,
  getDailyStatus,
  FIELD_GUIDE_CATALOG,
  getFieldGuideEntry,
  recordFieldGuidePhoto,
  getFieldGuideStats,
} from '../public/js/game/logbookModel.js';
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
  toggleDpvScooter,
  triggerSonarPing,
  captureCameraPhoto,
  computeSurgeWave,
  sampleGhostPose,
  applyPeerWreckAction,
} from '../public/js/game/diveSession.js';
import {
  buildExploreCells,
  computeDiverScoreSummary,
  computeTeamScoreSummary,
  computeHealthPct,
} from '../public/js/game/scoring.js';
import {
  sampleEkgWave,
  isMinimapAllowed,
  computeMinimapViewport,
  drawSonarMinimap,
} from '../public/js/game/hud.js';
import { CaveRenderer } from '../public/js/game/renderer.js';
import { stirFloorSilt, stepSiltPhysics, spawnSiltPlume, sampleSiltDensity } from '../public/js/game/silt.js';
import { RADIO_TRACKS, midiToFreq, AquaticRadio } from '../public/js/game/aquaticRadio.js';
import { createDiverBody, stepDiverBody } from '../public/js/game/diverBody.js';
import { castLightRay, castTorchFan, castSunCurtain } from '../public/js/game/lighting.js';
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

test('All 30 campaign levels (23 caves/environments + 7 shipwrecks) validate cleanly and scale monotonically to 185m Boy-Bulok Asian Karst Sump', () => {
  assert.equal(CAMPAIGN_PLAN.length, 30, 'Campaign roadmap should chart all 30 levels');
  assert.equal(LEVELS.length, 30, 'All 30 campaign levels should be registered');
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

test('v100 Cave Interactive Parity: all 23 caves enriched with open-water stage caches, markers, currents/surges, line traps & co-op sync', () => {
  const caves = LEVELS.filter((l) => !l.isWreck);
  assert.equal(caves.length, 23);

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
  for (let i = 0; i < 30; i++) stepDiveSession(sSonar, { x: 0, y: 0 }, 0.1);
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
  for (let day = 1; day <= 30; day++) {
    const dk = `2026-11-${String(day).padStart(2, '0')}`;
    const dc = getDailyChallenge(LEVELS, dk);
    assert.notEqual(dc.levelId, prevLevelId, `Back-to-back duplicate site on ${dk}`);
    prevLevelId = dc.levelId;
    seenSites.add(dc.levelId);
    seenMutators.add(dc.mutatorId);
  }
  assert.equal(seenSites.size, LEVELS.length, '30-day cycle should cover all 30 dive sites');
  assert.ok(seenMutators.size >= 4, '30-day cycle should rotate across multiple mutators');

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
  // 1. 16-entry Field Guide catalog & Logbook discovery/upgrade persistence
  assert.equal(FIELD_GUIDE_CATALOG.length, 16);
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
  assert.ok(html.includes('id="hud-photo-card"'), 'Missing HUD photo discovery card');
  assert.ok(html.includes('id="logbook-field-guide-grid"'), 'Missing Logbook Field Guide gallery');
});
