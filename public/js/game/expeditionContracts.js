/**
 * Dynamic Expedition Contracts & Technical Crew Specialty Roles (v156).
 *
 * Rolls 2 site-calibrated bonus contracts per dive (e.g. illuminating submerged lore
 * landmarks, equalizing deep bulkheads, clean heavy salvage lifts, zero-silt cave trim,
 * underwater photography) and provides 4 balanced Crew Specialty Roles.
 *
 * Pure zero-DOM ES module for seamless browser + Node unit testing.
 */

export const CONTRACT_REWARD_PTS = 150;

export const CREW_ROLES = Object.freeze([
  {
    id: 'balanced',
    icon: '🤿',
    name: 'Standard Diver',
    shortLabel: 'Standard',
    perkText: 'Balanced technical diving profile',
    torchRangeMult: 1.0,
    sonarRangeMult: 1.0,
    crankSpeedMult: 1.0,
    salvageDragBonus: 0,
    gasBurnMult: 1.0,
    decoClearMult: 1.0,
  },
  {
    id: 'navigator',
    icon: '🧭',
    name: 'Point Navigator',
    shortLabel: 'Navigator',
    perkText: '+10% torch reach · +20% sonar scan range',
    torchRangeMult: 1.1,
    sonarRangeMult: 1.2,
    crankSpeedMult: 1.0,
    salvageDragBonus: 0,
    gasBurnMult: 1.0,
    decoClearMult: 1.0,
  },
  {
    id: 'engineer',
    icon: '⚙️',
    name: 'Salvage Engineer',
    shortLabel: 'Engineer',
    perkText: '+25% hatch crank speed · lighter heavy salvage trim',
    torchRangeMult: 1.0,
    sonarRangeMult: 1.0,
    crankSpeedMult: 1.25,
    salvageDragBonus: 0.06,
    gasBurnMult: 1.0,
    decoClearMult: 1.0,
  },
  {
    id: 'safety',
    icon: '🩺',
    name: 'Gas & Deco Safety',
    shortLabel: 'Safety',
    perkText: '-8% gas burn · +15% deco stop clearing speed',
    torchRangeMult: 1.0,
    sonarRangeMult: 1.0,
    crankSpeedMult: 1.0,
    salvageDragBonus: 0,
    gasBurnMult: 0.92,
    decoClearMult: 1.15,
  },
]);

const ROLE_BY_ID = new Map(CREW_ROLES.map((r) => [r.id, r]));

export function getCrewRole(roleId) {
  return (roleId && ROLE_BY_ID.get(roleId)) || CREW_ROLES[0];
}

export function cycleCrewRoleId(currentId) {
  const idx = CREW_ROLES.findIndex((r) => r.id === currentId);
  return CREW_ROLES[(idx + 1) % CREW_ROLES.length].id;
}

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Roll 2 deterministic, site-appropriate bonus Expedition Contracts for a dive session.
 */
export function rollDiveContracts(level, seedKey = '') {
  if (!level) return [];
  const pool = [];
  const isWreck = Boolean(level.isWreck);
  const maxD = Number(level.maxDepthM || level.bounds?.yMax || 40);
  const hasHatches = Array.isArray(level.watertightHatches) && level.watertightHatches.length > 0;
  const hasCollectibles = Array.isArray(level.collectibles) && level.collectibles.length >= 2;
  const collectTarget = hasCollectibles ? Math.max(2, Math.ceil(level.collectibles.length * 0.5)) : 0;

  // Lore landmark discovery contract fits every single site
  pool.push({
    id: 'lore-scout',
    icon: '🧭',
    title: 'Submerged Historian',
    description: 'Illuminate 2 submerged lore landmarks',
    target: 2,
    progress: 0,
    completed: false,
    rewardPts: CONTRACT_REWARD_PTS,
  });

  if (hasCollectibles) {
    pool.push({
      id: 'artifact-hunter',
      icon: '💎',
      title: isWreck ? 'Wreck Salvager' : 'Specimen Collector',
      description: `Recover ${collectTarget}+ expedition artifacts`,
      target: collectTarget,
      progress: 0,
      completed: false,
      rewardPts: CONTRACT_REWARD_PTS,
    });
  }

  pool.push({
    id: 'field-photographer',
    icon: '📸',
    title: 'Expedition Photographer',
    description: 'Capture 1 underwater Field Guide photo',
    target: 1,
    progress: 0,
    completed: false,
    rewardPts: CONTRACT_REWARD_PTS,
  });

  if (isWreck && hasHatches && maxD >= 62) {
    pool.push({
      id: 'bulkhead-specialist',
      icon: '⚙️',
      title: 'Bulkhead Specialist',
      description: 'Equalize a pressurized deep bulkhead valve',
      target: 1,
      progress: 0,
      completed: false,
      rewardPts: CONTRACT_REWARD_PTS,
    });
  } else if (!isWreck) {
    pool.push({
      id: 'clean-trim',
      icon: '🫧',
      title: 'Zero-Silt Fin Trim',
      description: 'Reach 50% exploration with zero heavy silt-outs',
      target: 1,
      progress: 0,
      completed: false,
      rewardPts: CONTRACT_REWARD_PTS,
    });
  }

  if (pool.length <= 2) return pool;
  const h = hashStr(`${level.id || 'site'}:${seedKey || 'run'}`);
  const firstIdx = h % pool.length;
  const secondIdx = (firstIdx + 1 + ((h >>> 4) % (pool.length - 1))) % pool.length;
  return [pool[firstIdx], pool[secondIdx]];
}

/**
 * Evaluate live contract progress on an active DiveSession; invokes `callbacks.onContractComplete`
 * the moment any contract is fulfilled.
 */
export function evaluateDiveContracts(session, callbacks = {}) {
  const list = session?.contracts;
  if (!Array.isArray(list) || list.length === 0) return [];
  const newlyCompleted = [];
  const totalCells = Math.max(1, session.exploreCells?.length || 1);
  const exploredPct = ((session.exploredCells?.size || 0) / totalCells) * 100;

  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (!c || c.completed) continue;
    let cur = 0;
    if (c.id === 'lore-scout') {
      cur = session.stories?.discoveredCount || 0;
    } else if (c.id === 'artifact-hunter') {
      cur = session.collectedIds?.size || 0;
    } else if (c.id === 'field-photographer') {
      cur = session.camera?.photoCount || session.camera?.photosTaken || 0;
    } else if (c.id === 'bulkhead-specialist') {
      cur = session.equalizedHatchIds?.size || 0;
    } else if (c.id === 'clean-trim') {
      cur = exploredPct >= 50 && (session.runMilestones?.heavySiltEvents || 0) === 0 ? 1 : 0;
    }
    c.progress = Math.min(c.target, cur);
    if (c.progress >= c.target) {
      c.completed = true;
      session.contractBonusScore = (session.contractBonusScore || 0) + (c.rewardPts || CONTRACT_REWARD_PTS);
      newlyCompleted.push(c);
      callbacks.onContractComplete?.(c);
    }
  }
  return newlyCompleted;
}

/**
 * Compute PB Ghost checkpoint crossing timestamps [sec] from a recorded ghost track
 * so live checkpoint split deltas (-3.4s ahead / +1.2s behind) can flash mid-dive (v156).
 */
export function computeGhostCheckpointSplits(level, ghostTrack) {
  const splits = {};
  const pts = Array.isArray(ghostTrack)
    ? ghostTrack
    : Array.isArray(ghostTrack?.points)
      ? ghostTrack.points
      : Array.isArray(ghostTrack?.samples)
        ? ghostTrack.samples
        : null;
  if (!level || !Array.isArray(level.checkpoints) || !pts || pts.length < 2) {
    return splits;
  }
  for (let c = 0; c < level.checkpoints.length; c++) {
    const cp = level.checkpoints[c];
    if (!cp || !cp.id) continue;
    const rad = Math.max(3.2, Number(cp.radius) || 3.8);
    const radSq = rad * rad;
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      let gt, gx, gy;
      if (Array.isArray(pt) && pt.length >= 3) {
        gt = pt[0] / 10;
        gx = pt[1] / 10;
        gy = pt[2] / 10;
      } else if (pt && Number.isFinite(pt.t) && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
        gt = pt.t;
        gx = pt.x;
        gy = pt.y;
      } else {
        continue;
      }
      const dx = gx - cp.x;
      const dy = gy - cp.y;
      if (dx * dx + dy * dy <= radSq) {
        splits[cp.id] = gt;
        break;
      }
    }
  }
  return splits;
}

export function formatSplitDelta(deltaSec) {
  if (!Number.isFinite(deltaSec)) return '';
  const abs = Math.abs(deltaSec).toFixed(1);
  if (deltaSec <= -0.15) return `⚡ -${abs}s ahead of PB`;
  if (deltaSec >= 0.15) return `⏱ +${abs}s behind PB`;
  return '🎯 Dead even with PB';
}
