/**
 * Dedicated Technical Rescue Drills Mode (v174).
 *
 * Four tight, replayable, timed technical-diving emergency procedures that drop the diver
 * straight into a realistic overhead crisis with drill-specific grading (S+ through C)
 * and Career Logbook Drill Mastery tracking.
 *
 * Pure ES module with zero DOM dependencies.
 */

import { switchGas } from '../physics/diveModel.js';
import { spawnSiltPlume } from './silt.js';

export const RESCUE_DRILLS = Object.freeze([
  Object.freeze({
    id: 'silt-line-recovery',
    icon: '🌫️',
    name: 'Zero-Vis Silt-Out Line Recovery',
    shortName: 'Silt-Out Line',
    levelId: 'cenote-el-abismo',
    difficulty: 'standard',
    parTimeSec: 65,
    accent: '#fbbf24',
    summary: 'Dropped at 24m inside a blinding floor silt-out. Re-acquire the golden guideline, stay calm, and exit cleanly.',
    briefing: '🌫️ DRILL LIVE: Blinding silt-out at 24m! Follow the guideline & surface cleanly (<65s par)!',
    objectives: Object.freeze([
      'Locate & follow the main guideline out of the silt-out',
      'Maintain calm frog-kick trim with minimal extra blowouts',
      'Surface safely at the exit basin under 65s par',
    ]),
    needsAiBuddy: false,
  }),
  Object.freeze({
    id: 'freeflow-bailout',
    icon: '💨',
    name: 'Manifold Free-Flow Bailout',
    shortName: 'Free-Flow Bailout',
    levelId: 'eagles-nest-sink',
    difficulty: 'standard',
    parTimeSec: 75,
    accent: '#ef4444',
    summary: 'Your primary regulator jams in violent 3× free-flow at 32m. Feather the valve ([E]/[Space]), manage gas, and exit.',
    briefing: '💨 DRILL LIVE: Regulator FREE-FLOW at 32m! Isolate valve [E]/[Space], switch gas cleanly & exit!',
    objectives: Object.freeze([
      'Resolve the active Regulator Free-Flow emergency drill',
      'Manage EAN32 / Trimix / O₂ gas switches cleanly',
      'Complete safe extraction under 75s par',
    ]),
    needsAiBuddy: false,
  }),
  Object.freeze({
    id: 'buddy-ooa-share',
    icon: '🎁',
    name: 'Out-of-Air Buddy Share & Escort',
    shortName: 'Buddy OOA Rescue',
    levelId: 'cenote-el-abismo',
    difficulty: 'hardcore',
    parTimeSec: 85,
    accent: '#38bdf8',
    summary: 'Crewmate Maya suffers a catastrophic valve failure at 26m (12 bar left). Reach her, share gas, and escort her home.',
    briefing: '🎁 DRILL LIVE: Maya is OUT OF AIR at 26m! Reach her, SHARE GAS & escort her to the exit!',
    objectives: Object.freeze([
      'Intercept Crewmate Maya & donate reserve breathing gas',
      'Keep both divers alive without gas starvation',
      'Escort Maya safely back to the surface exit under 85s par',
    ]),
    needsAiBuddy: true,
  }),
  Object.freeze({
    id: 'net-cut-deco',
    icon: '✂️',
    name: 'Entangled Net Cut Under Deco',
    shortName: 'Net Cut + Deco',
    levelId: 'uss-oriskany-carrier',
    difficulty: 'standard',
    parTimeSec: 95,
    accent: '#a855f7',
    summary: 'Snagged in a derelict trawl net at 30m with an active 6m O₂ decompression ceiling. Cut free ([E]), switch to O₂, clear deco.',
    briefing: '✂️ DRILL LIVE: Snagged at 30m with 6m O₂ DECO! Cut free [E], ascend smoothly & clear your O₂ stop!',
    objectives: Object.freeze([
      'Slice free from entanglement using shears [E]',
      'Switch to 100% O₂ [3] at 6m & clear decompression ceiling',
      'Surface safely at the boat without DCS violation (<95s par)',
    ]),
    needsAiBuddy: false,
  }),
]);

const DRILL_BY_ID = new Map(RESCUE_DRILLS.map((d) => [d.id, d]));

export function getRescueDrillById(id) {
  return (id && DRILL_BY_ID.get(id)) || null;
}

/**
 * Pick an open-water waypoint along the level's checkpoints/guideline closest to `targetDepthM`.
 */
function pickDrillSpawnPoint(level, targetDepthM) {
  const candidates = [];
  if (Array.isArray(level?.checkpoints)) {
    for (const cp of level.checkpoints) {
      if (Number.isFinite(cp?.x) && Number.isFinite(cp?.y) && cp.y >= 10) {
        candidates.push({ x: cp.x, y: cp.y });
      }
    }
  }
  if (Array.isArray(level?.guideline)) {
    for (const pt of level.guideline) {
      if (Number.isFinite(pt?.x) && Number.isFinite(pt?.y) && pt.y >= 10) {
        candidates.push({ x: pt.x, y: pt.y });
      }
    }
  }
  if (candidates.length === 0) {
    return { x: level?.spawn?.x || 0, y: Math.min(20, (level?.spawn?.y || 2) + 12) };
  }
  candidates.sort((a, b) => Math.abs(a.y - targetDepthM) - Math.abs(b.y - targetDepthM));
  return candidates[0];
}

/**
 * Configure a freshly-created DiveSession into one of the 4 timed Technical Rescue Drill scenarios.
 * Marks pre-turnaround descent checkpoints as hit so the diver focuses immediately on the rescue & extraction!
 */
export function applyRescueDrillScenario(session, drill) {
  if (!session || !drill) return session;
  const { level, diver, diveState, checkpointsHit, siltClouds } = session;

  // Mark descent checkpoints up through turnaround so exit extraction is immediately active once crisis is solved
  if (Array.isArray(level?.checkpoints) && checkpointsHit) {
    const keepLast = Math.max(1, level.checkpoints.length - 1);
    for (let i = 0; i < keepLast; i++) {
      checkpointsHit.add(level.checkpoints[i].id);
    }
    // Always include turnaround checkpoint so ascent coaching activates naturally
    if (session.ascentConfig?.turnaroundId) {
      checkpointsHit.add(session.ascentConfig.turnaroundId);
    }
  }

  session.activeRescueDrillId = drill.id;
  session.rescueDrillMeta = {
    id: drill.id,
    name: drill.name,
    parTimeSec: drill.parTimeSec,
    sharedGasWithBuddy: false,
    cutSnag: false,
    resolvedFreeFlow: false,
  };

  if (drill.id === 'silt-line-recovery') {
    const pt = pickDrillSpawnPoint(level, 24);
    diver.x = pt.x;
    diver.y = pt.y;
    diveState.depthM = pt.y;
    diveState.maxDepthM = Math.max(diveState.maxDepthM || 0, pt.y);
    // Spawn dense surrounding silt-out cloud bank
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2;
      const rad = 0.8 + (i % 3) * 1.1;
      spawnSiltPlume(siltClouds, {
        x: pt.x + Math.cos(ang) * rad,
        y: pt.y + Math.sin(ang) * rad * 0.7,
        vx: 0,
        vy: -0.05,
        radius: 2.2,
        maxRadius: 4.2,
        life: 32,
        peakAlpha: 0.92,
      });
    }
  } else if (drill.id === 'freeflow-bailout') {
    const pt = pickDrillSpawnPoint(level, 32);
    diver.x = pt.x;
    diver.y = pt.y;
    diveState.depthM = pt.y;
    diveState.maxDepthM = Math.max(diveState.maxDepthM || 0, pt.y);
    switchGas(diveState, 'TMX1455');
    if (session.drills) {
      session.drills.enabled = true;
      session.drills.active = {
        kind: 'free-flow',
        title: 'REGULATOR FREE-FLOW',
        prompt: 'Feather valve & swap to backup regulator [E / Space]',
        elapsedSec: 0,
        durationSec: 22,
      };
    }
  } else if (drill.id === 'buddy-ooa-share') {
    const pt = pickDrillSpawnPoint(level, 26);
    diver.x = pt.x;
    diver.y = pt.y;
    diveState.depthM = pt.y;
    diveState.maxDepthM = Math.max(diveState.maxDepthM || 0, pt.y);
    if (Array.isArray(session.aiSquad) && session.aiSquad.length > 0) {
      const maya = session.aiSquad[0];
      maya.x = pt.x + 2.4;
      maya.y = Math.max(8, pt.y - 0.6);
      maya.activeBar = 12;
      maya.gasRemainingPct = 6;
      maya.condition = 'LOW GAS';
      maya.issue = {
        kind: 'low-gas',
        title: 'OUT OF AIR',
        detail: 'Share gas immediately!',
        elapsedSec: 0,
      };
    }
  } else if (drill.id === 'net-cut-deco') {
    const snag = Array.isArray(level?.snagZones) && level.snagZones.length > 0
      ? level.snagZones[0]
      : pickDrillSpawnPoint(level, 30);
    diver.x = snag.x;
    diver.y = snag.y;
    diveState.depthM = snag.y;
    diveState.maxDepthM = Math.max(diveState.maxDepthM || 0, snag.y);
    if (snag.y >= 24) switchGas(diveState, 'TMX1455');
    // Load fast/mid Bühlmann compartments so a realistic 6m O2 decompression stop is required
    if (Array.isArray(diveState.compartments)) {
      for (let i = 0; i < diveState.compartments.length; i++) {
        diveState.compartments[i].pN2 = Math.max(diveState.compartments[i].pN2 || 0.75, 2.38);
      }
    }
    diveState.ceilingM = Math.max(diveState.ceilingM || 0, 4.2);
    diveState.stopDepthM = Math.max(diveState.stopDepthM || 0, 6);
  }

  return session;
}

/**
 * Grade a completed (or aborted/failed) Technical Rescue Drill run.
 */
export function evaluateRescueDrillResult(drill, session, { success = false } = {}) {
  if (!drill || !session) return null;
  const elapsedSec = Math.max(1, Math.round((session.diveState?.diveTimeSec || session.simTimeSec || 0) * 10) / 10);
  const par = Math.max(20, drill.parTimeSec || 75);
  const meta = session.rescueDrillMeta || {};

  // Check scenario-specific crisis resolution
  let crisisSolved = Boolean(success);
  if (drill.id === 'freeflow-bailout') {
    crisisSolved = Boolean(success && ((session.drills?.completedCount || 0) >= 1 || meta.resolvedFreeFlow));
  } else if (drill.id === 'buddy-ooa-share') {
    const maya = session.aiSquad?.[0];
    crisisSolved = Boolean(success && (meta.sharedGasWithBuddy || (maya && maya.activeBar >= 25 && maya.alive !== false)));
  } else if (drill.id === 'net-cut-deco') {
    crisisSolved = Boolean(success && ((session.cutSnagIds?.size || 0) >= 1 || meta.cutSnag));
  }

  if (!success) {
    return {
      drillId: drill.id,
      passed: false,
      crisisSolved: false,
      grade: 'DNF',
      score: 0,
      elapsedSec,
      parTimeSec: par,
      summary: 'Extraction failed — reset trim, follow procedure, and retry the drill.',
    };
  }

  const speedRatio = par / Math.max(12, elapsedSec);
  const timePts = Math.round(Math.min(1200, Math.max(350, speedRatio * 900)));
  const trimPct = Math.round(session.trimStats?.disciplinePct ?? 90);
  const trimPts = Math.round((trimPct / 100) * 350);
  const crisisPts = crisisSolved ? 650 : 150;
  const totalScore = timePts + trimPts + crisisPts;

  let grade = 'C';
  if (crisisSolved && elapsedSec <= par * 0.82 && totalScore >= 1950) grade = 'S+';
  else if (crisisSolved && elapsedSec <= par && totalScore >= 1700) grade = 'S';
  else if (crisisSolved && elapsedSec <= par * 1.25) grade = 'A';
  else if (crisisSolved) grade = 'B';

  const delta = Math.round(elapsedSec - par);
  const paceStr = delta <= 0 ? `${Math.abs(delta)}s under par` : `${delta}s over par`;
  return {
    drillId: drill.id,
    passed: crisisSolved,
    crisisSolved,
    grade,
    score: totalScore,
    elapsedSec,
    parTimeSec: par,
    summary: crisisSolved
      ? `Procedure executed cleanly in ${elapsedSec.toFixed(1)}s (${paceStr}) · Trim ${trimPct}%`
      : `Surfaced in ${elapsedSec.toFixed(1)}s, but primary drill procedure was bypassed.`,
  };
}
