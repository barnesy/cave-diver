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
  computeSiteDivePlan,
  donateGasFromState,
  receiveGasIntoState,
} from '../public/js/physics/diveModel.js';
import {
  createEmptyLogbook,
  recordDiveInLogbook,
  seedLogbookFromEntries,
  formatLogbookSummary,
} from '../public/js/game/logbookModel.js';
import { LEVEL_1 } from '../public/js/levels/level1.js';
import { P2pRoomCoordinator, pickNextP2pHostId } from '../public/js/net/p2pRoomHost.js';
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
import { evaluateCaveSDF, resolveDiverCollision, createChunkSDFEvaluator } from '../public/js/game/collision.js';
import {
  createDiveSession,
  stepDiveSession,
  toggleGuidelineReel,
  rewindGuidelineSegment,
  getEffectiveReelRemainingM,
} from '../public/js/game/diveSession.js';
import {
  buildExploreCells,
  computeDiverScoreSummary,
  computeTeamScoreSummary,
  computeHealthPct,
} from '../public/js/game/scoring.js';
import { sampleEkgWave } from '../public/js/game/hud.js';
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
    assert.ok(renderer.rockChunks.length > 0 && renderer.dustMotes.length > 0);
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

test('All 13 campaign levels validate cleanly and scale monotonically to 115m recovery', () => {
  assert.equal(CAMPAIGN_PLAN.length, 13, 'Campaign roadmap should chart all 13 levels');
  assert.equal(LEVELS.length, 13, 'All 13 campaign levels should be registered');
  const seenIds = new Set();
  for (let i = 0; i < CAMPAIGN_PLAN.length; i++) {
    const slot = CAMPAIGN_PLAN[i];
    assert.equal(slot.rank, i + 1);
    assert.ok(!seenIds.has(slot.id), `Duplicate campaign id: ${slot.id}`);
    seenIds.add(slot.id);
    assert.equal(slot.implemented, true, `Level slot ${slot.rank} (${slot.id}) should be implemented`);
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

  // Levels 8-13 validate cleanly, ramp depth monotonically, and remain unlined
  for (const lvl of [lvl8, lvl9, lvl10, lvl11, lvl12, lvl13]) {
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
