import { LEVEL_1 } from './level1.js';
import { LEVEL_2 } from './level2.js';
import { LEVEL_3 } from './level3.js';
import { LEVEL_4 } from './level4.js';
import { LEVEL_5 } from './level5.js';
import { LEVEL_6 } from './level6.js';
import { LEVEL_7 } from './level7.js';
import { LEVEL_8 } from './level8.js';
import { LEVEL_9 } from './level9.js';
import { LEVEL_10 } from './level10.js';
import { LEVEL_11 } from './level11.js';
import { LEVEL_12 } from './level12.js';
import { LEVEL_13 } from './level13.js';
import { LEVEL_14 } from './level14.js';
import { LEVEL_15 } from './level15.js';
import { LEVEL_16 } from './level16.js';
import { LEVEL_17 } from './level17.js';
import { LEVEL_18 } from './level18.js';
import { LEVEL_19 } from './level19.js';
import { LEVEL_20 } from './level20.js';
import { CAMPAIGN_PLAN, CAMPAIGN_TIERS } from './campaign.js';
import { evaluateCaveSDF } from '../game/collision.js';

export { CAMPAIGN_PLAN, CAMPAIGN_TIERS };

/**
 * Registry of all playable cave dive levels, ordered by increasing campaign difficulty.
 * All 20 campaign sites (L1-L20 matching CAMPAIGN_PLAN) are registered here.
 */
export const LEVELS = [
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  LEVEL_4,
  LEVEL_5,
  LEVEL_6,
  LEVEL_7,
  LEVEL_8,
  LEVEL_9,
  LEVEL_10,
  LEVEL_11,
  LEVEL_12,
  LEVEL_13,
  LEVEL_14,
  LEVEL_15,
  LEVEL_16,
  LEVEL_17,
  LEVEL_18,
  LEVEL_19,
  LEVEL_20,
];

export const DEFAULT_LEVEL_ID = LEVEL_1.id;

const LEVEL_MAP = new Map(LEVELS.map((lvl) => [lvl.id, lvl]));
const PLAN_MAP = new Map(CAMPAIGN_PLAN.map((slot) => [slot.id, slot]));

/**
 * Look up a registered level definition by id, falling back to the default level.
 * @param {string} levelId
 * @returns {object}
 */
export function getLevelById(levelId) {
  return LEVEL_MAP.get(levelId) || LEVEL_1;
}

/**
 * Check whether an arbitrary string matches a registered level id.
 * @param {string} levelId
 * @returns {boolean}
 */
export function isValidLevelId(levelId) {
  return typeof levelId === 'string' && LEVEL_MAP.has(levelId);
}

/**
 * Compute max depth (m) across level segments & bounds.
 */
export function getLevelMaxDepthM(level) {
  let maxDepth = 0;
  for (const s of level?.segments || []) {
    if (s.ay > maxDepth) maxDepth = s.ay;
    if (s.by > maxDepth) maxDepth = s.by;
  }
  return Math.round(maxDepth || level?.bounds?.yMax || 50);
}

/**
 * Return standardized campaign & difficulty metadata for UI badges and validation.
 */
export function getLevelMeta(levelOrId, fallbackIndex = 0) {
  const id = typeof levelOrId === 'string' ? levelOrId : levelOrId?.id;
  const plan = PLAN_MAP.get(id);
  const lvl = typeof levelOrId === 'object' ? levelOrId : LEVEL_MAP.get(id);
  const idx = plan ? plan.rank - 1 : LEVELS.findIndex((l) => l.id === id);
  const resolvedIdx = idx >= 0 ? idx : fallbackIndex;
  const rank = lvl?.difficultyRank || plan?.rank || resolvedIdx + 1;
  const tier = lvl?.tier || plan?.tier || (rank <= 2 ? 1 : rank <= 4 ? 2 : rank === 5 ? 3 : 4);
  const reelM = Number.isFinite(lvl?.reelMetersPerDiver) ? lvl.reelMetersPerDiver : plan?.reelMetersPerDiver || 0;
  const maxDepthM = getLevelMaxDepthM(lvl) || plan?.targetDepthM || 50;
  const badge = plan?.badge || (reelM > 0 ? `Unlined ${maxDepthM}m` : `${maxDepthM}m`);
  return {
    rank,
    tier,
    badge,
    region: plan?.region || '',
    maxDepthM,
    lined: reelM <= 0 && (lvl?.guideline?.length ?? 0) > 0,
    reelMetersPerDiver: reelM,
  };
}

/**
 * Extract level-specific ascent plan configuration with backwards-compatible defaults.
 * @param {object|null|undefined} level
 * @returns {{ turnaroundId: string, switchId: string, switchDepthM: number }}
 */
export function getAscentConfig(level) {
  return {
    turnaroundId: level?.turnaroundCheckpointId ?? 'cp4',
    switchId: level?.ascentSwitchCheckpointId ?? 'cp5',
    switchDepthM: Number.isFinite(level?.ascentSwitchDepthM) ? level.ascentSwitchDepthM : 22.0,
  };
}

/**
 * Structural + optional SDF navigability validator for authoring and testing cave levels (L1-L13).
 * @param {object} level
 * @param {{ checkGeometry?: boolean }} [opts]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateLevel(level, { checkGeometry = false } = {}) {
  const errors = [];
  if (!level || typeof level !== 'object') {
    return { valid: false, errors: ['Level must be an object'] };
  }
  if (!level.id || typeof level.id !== 'string') errors.push('Missing string level.id');
  if (!level.name || typeof level.name !== 'string') errors.push('Missing string level.name');
  if (!level.bounds || !Number.isFinite(level.bounds.xMin) || !Number.isFinite(level.bounds.xMax)) {
    errors.push('Missing numeric level.bounds {xMin, xMax, yMin, yMax}');
  }
  if (!level.spawn || !Number.isFinite(level.spawn.x) || !Number.isFinite(level.spawn.y)) {
    errors.push('Missing numeric level.spawn {x, y}');
  }
  if (!Array.isArray(level.segments) || level.segments.length === 0) {
    errors.push('level.segments must be a non-empty array');
  }
  if (!Array.isArray(level.openBasins) || level.openBasins.length === 0) {
    errors.push('level.openBasins must be a non-empty array');
  }
  if (!Array.isArray(level.checkpoints) || level.checkpoints.length === 0) {
    errors.push('level.checkpoints must be a non-empty array');
  }
  if (!level.exitZone || !Number.isFinite(level.exitZone.x) || !Number.isFinite(level.exitZone.y)) {
    errors.push('Missing numeric level.exitZone {x, y, radius}');
  }
  if (!Number.isFinite(level.parTimeSec) || level.parTimeSec <= 0) {
    errors.push('Missing positive numeric level.parTimeSec');
  }
  const hasFixedLine = Array.isArray(level.guideline) && level.guideline.length >= 2;
  if (!hasFixedLine && !(Number(level.reelMetersPerDiver) > 0)) {
    errors.push('Unlined levels (guideline.length === 0) must set positive reelMetersPerDiver');
  }

  if (checkGeometry && errors.length === 0) {
    if (evaluateCaveSDF(level, level.spawn.x, level.spawn.y) >= -0.3) {
      errors.push('Spawn lies inside/too close to rock wall');
    }
    if (evaluateCaveSDF(level, level.exitZone.x, level.exitZone.y) >= -0.3) {
      errors.push('Exit zone lies inside/too close to rock wall');
    }
    for (const seg of level.segments) {
      const mx = (seg.ax + seg.bx) * 0.5;
      const my = (seg.ay + seg.by) * 0.5;
      if (evaluateCaveSDF(level, mx, my) >= -0.25) {
        errors.push(`Segment midpoint (${mx}, ${my}) obstructed`);
      }
    }
    for (const cp of level.checkpoints) {
      if (evaluateCaveSDF(level, cp.x, cp.y) >= -0.3) {
        errors.push(`Checkpoint ${cp.id} obstructed`);
      }
    }
    for (const item of level.collectibles || []) {
      if (evaluateCaveSDF(level, item.x, item.y) >= -0.25) {
        errors.push(`Collectible ${item.id} obstructed`);
      }
    }
    if (level.recoveryTarget) {
      if (evaluateCaveSDF(level, level.recoveryTarget.x, level.recoveryTarget.y) >= -0.3) {
        errors.push(`Recovery target ${level.recoveryTarget.id} obstructed`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
