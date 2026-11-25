import { evaluateCaveSDF } from './collision.js';
import { clamp as clampVal } from '../util/common.js';

function clamp(min, max, v) {
  return clampVal(v, min, max);
}

/**
 * Sample walkable open-water grid cells along a level's cavern segments
 * so exploration completeness can be tracked deterministically at 2.6m resolution.
 */
export function buildExploreCells(level, stepM = 2.6) {
  const seenKeys = new Set();
  const cells = [];

  for (const seg of level.segments || []) {
    if (seg.secretLair) continue; // Secret sonar-only lairs never spoil minimap or penalize standard cave %
    const segLen = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
    const stepsAlong = Math.max(1, Math.ceil(segLen / (stepM * 0.75)));
    const maxR = Math.max(seg.ra, seg.rb) + 0.5;

    for (let i = 0; i <= stepsAlong; i++) {
      const t = i / stepsAlong;
      const cx = seg.ax + (seg.bx - seg.ax) * t;
      const cy = seg.ay + (seg.by - seg.ay) * t;
      const rSpan = Math.ceil(maxR / stepM) * stepM;

      for (let gx = Math.floor((cx - rSpan) / stepM) * stepM; gx <= cx + rSpan; gx += stepM) {
        for (let gy = Math.floor((cy - rSpan) / stepM) * stepM; gy <= cy + rSpan; gy += stepM) {
          if (gy < 0.6) continue;
          const kx = Math.round(gx / stepM);
          const ky = Math.round(gy / stepM);
          const key = `${kx}:${ky}`;
          if (seenKeys.has(key)) continue;
          if (evaluateCaveSDF(level, gx, gy) < -0.35) {
            seenKeys.add(key);
            cells.push({ x: gx, y: gy });
          }
        }
      }
    }
  }

  return cells;
}

export const EXPLORE_GRID_CELL_M = 4;

/**
 * Pack coarse 4m spatial grid coordinates into a zero-allocation integer key for O(1) fog-of-war queries.
 */
export function exploreGridKey(wx, wy) {
  const gx = Math.round(wx / EXPLORE_GRID_CELL_M) + 8192;
  const gy = Math.round(wy / EXPLORE_GRID_CELL_M) + 8192;
  return gx * 16384 + gy;
}

/**
 * Mark cave exploration cells within sonar/light range around a diver position.
 * Optionally populates an O(1) spatial hash Set (`exploredGrid`) for fast minimap fog-of-war checks.
 * Returns the number of newly uncovered cells.
 */
export function markExploredAround(exploreCells, exploredSet, wx, wy, radiusM = 4.2, exploredGrid = null) {
  if (!exploreCells || !exploredSet) return 0;
  const r2 = radiusM * radiusM;
  let added = 0;
  for (let i = 0; i < exploreCells.length; i++) {
    if (exploredSet.has(i)) continue;
    const c = exploreCells[i];
    const dx = c.x - wx;
    const dy = c.y - wy;
    if (dx * dx + dy * dy <= r2) {
      exploredSet.add(i);
      if (exploredGrid) exploredGrid.add(exploreGridKey(c.x, c.y));
      added++;
    }
  }
  return added;
}

export function computeHealthPct(diveState) {
  if (!diveState || diveState.alive === false) return 0;
  const tox = diveState.cnsPercent || 0;
  const dcs = diveState.dcsStress || 0;
  const hyp = diveState.hypoxiaStress || 0;
  const narc = (diveState.narcosisLevel || 0) * 100;
  const cardiac = diveState.cardiacStress || 0;
  const peak = (diveState.peakStress || 0) * 0.22;
  const penalty = Math.max(peak, tox * 0.45 + dcs * 0.45 + hyp * 0.48 + narc * 0.22 + cardiac * 0.25);
  return Math.round(clamp(0, 100, 100 - penalty));
}

export function computeGasRemainingPct(diveState) {
  if (!diveState?.tanks) return 0;
  const ids = Object.keys(diveState.tanks);
  if (ids.length === 0) return 0;
  let sum = 0;
  for (const id of ids) {
    sum += clamp(0, 100, ((diveState.tanks[id]?.bar || 0) / 200) * 100);
  }
  return Math.round(sum / ids.length);
}

export function assignScoreRank(totalScore, alive = true, maxPossible = 3200) {
  if (!alive) return { grade: 'DNF', label: 'DIVE INCIDENT' };
  const ratio = totalScore / Math.max(1, maxPossible);
  if (ratio >= 0.92) return { grade: 'S+', label: 'MASTER EXPLORER' };
  if (ratio >= 0.80) return { grade: 'S', label: 'ELITE TECH DIVER' };
  if (ratio >= 0.66) return { grade: 'A', label: 'TECH EXPEDITIONIST' };
  if (ratio >= 0.50) return { grade: 'B', label: 'CERTIFIED TECH DIVER' };
  return { grade: 'C', label: 'SAFE SURVIVOR' };
}

export const MAX_PHOTO_BONUS = 300;
export const MAX_ENCOUNTER_BONUS = 180;
export const MAX_DRILL_BONUS = 600;
export const MAX_WEATHER_BONUS = 250;
export const MAX_TRIM_BONUS = 250;
export const MAX_EXPEDITION_BONUS = 950;

/**
 * Score a single diver's completed (or aborted) cave traverse across:
 * health vitals, run speed, collectibles recovered, cave explored completeness, hatches, wildlife photos, beacons, emergency drills & weather conditions.
 */
export function computeDiverScoreSummary({
  name = 'Diver 1',
  level,
  diveState,
  checkpointsHit,
  collectedIds,
  exploredCount = 0,
  totalExploreCells = 1,
  diveTimeSec = diveState?.diveTimeSec || 0,
  hatchBonusScore = 0,
  photoBonusScore = 0,
  encounterBonusScore = 0,
  drillBonusScore = 0,
  weatherBonusScore = 0,
  trimBonusScore = 0,
  expeditionBonusScore = 0,
  mutatorId = '',
}) {
  const alive = diveState?.alive !== false;
  const cpCount = checkpointsHit instanceof Set ? checkpointsHit.size : Number(checkpointsHit) || 0;
  const totalCps = Math.max(1, level?.checkpoints?.length || 1);
  const routeRatio = clamp(0, 1, cpCount / totalCps);

  const healthPct = computeHealthPct(diveState);
  const healthScore = alive ? Math.round(healthPct * 10) : Math.round(routeRatio * 120);

  const basePar = level?.parTimeSec || 160;
  const parTimeSec = mutatorId === 'turbo-par' ? Math.round(basePar * 0.75) : basePar;
  const speedPct = alive
    ? Math.round(clamp(15, 100, (parTimeSec / Math.max(parTimeSec * 0.72, diveTimeSec || parTimeSec)) * 100))
    : 0;
  const speedScore = alive ? Math.round(speedPct * 8) : 0;

  const list = level?.collectibles || [];
  const collectedSet = collectedIds instanceof Set ? collectedIds : new Set(collectedIds || []);
  let collectiblesPoints = 0;
  let collectiblesFound = 0;
  let maxCollectiblePoints = 0;
  for (const item of list) {
    maxCollectiblePoints += item.points || 200;
    if (collectedSet.has(item.id)) {
      collectiblesFound++;
      collectiblesPoints += item.points || 200;
    }
  }
  const collectiblesSetBonus = list.length > 0 && collectiblesFound === list.length ? 400 : 0;
  const collectiblesScore = collectiblesPoints + collectiblesSetBonus;

  const exploredPct = Math.round(clamp(0, 100, (exploredCount / Math.max(1, totalExploreCells)) * 100));
  const explorationScore = Math.round((exploredPct / 100) * 700);
  const cartographerBonus = alive && exploredPct >= 92 ? 250 : 0;

  const gasRemainingPct = computeGasRemainingPct(diveState);
  const maxHatchBonus = (level?.watertightHatches || []).reduce((s, h) => s + (Number(h.bonusPoints) || 150), 0);
  const cleanHatchBonus = alive ? Math.min(maxHatchBonus, Math.max(0, Math.round(Number(hatchBonusScore) || 0))) : 0;
  const cleanPhotoBonus = alive ? Math.min(MAX_PHOTO_BONUS, Math.max(0, Math.round(Number(photoBonusScore) || 0))) : 0;
  const cleanEncounterBonus = alive ? Math.min(MAX_ENCOUNTER_BONUS, Math.max(0, Math.round(Number(encounterBonusScore) || 0))) : 0;
  const cleanDrillBonus = alive ? Math.min(MAX_DRILL_BONUS, Math.max(0, Math.round(Number(drillBonusScore) || 0))) : 0;
  const cleanWeatherBonus = alive ? Math.min(MAX_WEATHER_BONUS, Math.max(0, Math.round(Number(weatherBonusScore) || 0))) : 0;
  const cleanTrimBonus = alive ? Math.min(MAX_TRIM_BONUS, Math.max(0, Math.round(Number(trimBonusScore) || 0))) : 0;
  const cleanExpeditionBonus = alive ? Math.min(MAX_EXPEDITION_BONUS, Math.max(0, Math.round(Number(expeditionBonusScore) || 0))) : 0;
  const totalScore =
    healthScore +
    speedScore +
    collectiblesScore +
    explorationScore +
    cartographerBonus +
    cleanHatchBonus +
    cleanPhotoBonus +
    cleanEncounterBonus +
    cleanDrillBonus +
    cleanWeatherBonus +
    cleanTrimBonus +
    cleanExpeditionBonus;
  const baseMaxPossible = 1000 + 800 + maxCollectiblePoints + 400 + 700 + 250 + maxHatchBonus;
  const maxPossible =
    baseMaxPossible +
    MAX_PHOTO_BONUS +
    MAX_ENCOUNTER_BONUS +
    MAX_DRILL_BONUS +
    MAX_WEATHER_BONUS +
    MAX_TRIM_BONUS +
    MAX_EXPEDITION_BONUS;
  const rank = assignScoreRank(totalScore, alive, baseMaxPossible);

  return {
    name,
    alive,
    diveTimeSec,
    parTimeSec,
    maxDepthM: diveState?.maxDepthM || 0,
    healthPct,
    speedPct,
    gasRemainingPct,
    checkpointsHit: cpCount,
    totalCheckpoints: totalCps,
    collectiblesFound,
    collectiblesTotal: list.length,
    collectiblesPoints,
    collectiblesSetBonus,
    collectiblesScore,
    exploredPct,
    explorationScore,
    cartographerBonus,
    hatchBonusScore: cleanHatchBonus,
    photoBonusScore: cleanPhotoBonus,
    encounterBonusScore: cleanEncounterBonus,
    drillBonusScore: cleanDrillBonus,
    weatherBonusScore: cleanWeatherBonus,
    trimBonusScore: cleanTrimBonus,
    expeditionBonusScore: cleanExpeditionBonus,
    healthScore,
    speedScore,
    totalScore,
    maxPossible,
    rank,
  };
}

/**
 * Aggregate local diver + LAN buddies into a shared team score breakdown and averages table.
 */
export function computeTeamScoreSummary(localSummary, peerStats = [], { localRescued = false } = {}) {
  const localAlive = localSummary.alive !== false;
  const localExtracted = localAlive || Boolean(localRescued || localSummary.rescued);
  const roster = [
    {
      ...localSummary,
      rescued: !localAlive && Boolean(localRescued || localSummary.rescued),
    },
  ];
  for (const p of peerStats) {
    if (!p) continue;
    const pAlive = p.alive !== false;
    const pRescued = !pAlive && Boolean(p.rescued);
    const pHealth = Number.isFinite(p.healthPct)
      ? p.healthPct
      : pAlive
        ? Math.round(clamp(0, 100, 100 - ((p.cnsPercent || 0) * 0.45 + (p.dcsStress || 0) * 0.45 + (p.hypoxiaStress || 0) * 0.48 + (p.narcosisLevel || 0) * 22)))
        : 0;
    const pPar = localSummary.parTimeSec || 160;
    const pTime = Number.isFinite(p.diveTimeSec) && p.diveTimeSec > 0 ? p.diveTimeSec : localSummary.diveTimeSec;
    const pSpeedPct = pAlive
      ? Math.round(clamp(15, 100, (pPar / Math.max(pPar * 0.72, pTime)) * 100))
      : 0;
    const pGas = Number.isFinite(p.gasRemainingPct)
      ? p.gasRemainingPct
      : Math.round(clamp(0, 100, ((p.activeBar ?? 120) / 200) * 100));
    const pHealthScore = pAlive ? Math.round(pHealth * 10) : 0;
    const pSpeedScore = pAlive ? Math.round(pSpeedPct * 8) : 0;

    roster.push({
      name: p.name || 'Buddy Diver',
      alive: pAlive,
      rescued: pRescued,
      surfaced: Boolean(p.surfaced || pRescued),
      diveTimeSec: pTime,
      healthPct: pHealth,
      speedPct: pSpeedPct,
      gasRemainingPct: pGas,
      healthScore: pHealthScore,
      speedScore: pSpeedScore,
      totalScore:
        pHealthScore +
        pSpeedScore +
        localSummary.collectiblesScore +
        localSummary.explorationScore +
        localSummary.cartographerBonus,
    });
  }

  const teamSize = roster.length;
  const survivorsCount = roster.filter((r) => r.alive).length;
  const rescuedCount = roster.filter((r) => !r.alive && r.rescued).length;
  const extractedCount = roster.filter((r) => r.alive || r.rescued).length;
  const allSurvived = extractedCount === teamSize;
  const avgHealthPct = Math.round(roster.reduce((a, r) => a + r.healthPct, 0) / teamSize);
  const avgSpeedPct = Math.round(roster.reduce((a, r) => a + r.speedPct, 0) / teamSize);
  const avgTimeSec = roster.reduce((a, r) => a + r.diveTimeSec, 0) / teamSize;
  const avgGasRemainingPct = Math.round(roster.reduce((a, r) => a + r.gasRemainingPct, 0) / teamSize);

  const avgHealthScore = Math.round(roster.reduce((a, r) => a + r.healthScore, 0) / teamSize);
  const avgSpeedScore = Math.round(roster.reduce((a, r) => a + r.speedScore, 0) / teamSize);
  const rescueBonus = teamSize > 1 && rescuedCount > 0 ? rescuedCount * 450 : 0;
  const teamSurvivalBonus = teamSize > 1 && allSurvived ? 600 : 0;

  const teamMaxPossible = localSummary.maxPossible + (teamSize > 1 ? 600 : 0);
  const rawTeamScore =
    avgHealthScore +
    avgSpeedScore +
    localSummary.collectiblesScore +
    localSummary.explorationScore +
    localSummary.cartographerBonus +
    (localSummary.hatchBonusScore || 0) +
    (localSummary.photoBonusScore || 0) +
    (localSummary.encounterBonusScore || 0) +
    (localSummary.drillBonusScore || 0) +
    (localSummary.weatherBonusScore || 0) +
    (localSummary.trimBonusScore || 0) +
    (localSummary.expeditionBonusScore || 0) +
    rescueBonus +
    teamSurvivalBonus;
  const teamScore = Math.min(teamMaxPossible, rawTeamScore);
  const teamRank = assignScoreRank(
    teamScore,
    survivorsCount > 0 && localExtracted,
    Math.max(
      1,
      teamMaxPossible -
        MAX_PHOTO_BONUS -
        MAX_ENCOUNTER_BONUS -
        MAX_DRILL_BONUS -
        MAX_WEATHER_BONUS -
        MAX_TRIM_BONUS -
        MAX_EXPEDITION_BONUS
    )
  );

  return {
    teamSize,
    isTeam: teamSize > 1,
    survivorsCount,
    rescuedCount,
    extractedCount,
    allSurvived,
    roster,
    avgHealthPct,
    avgSpeedPct,
    avgTimeSec,
    avgGasRemainingPct,
    avgHealthScore,
    avgSpeedScore,
    collectiblesScore: localSummary.collectiblesScore,
    collectiblesFound: localSummary.collectiblesFound,
    collectiblesTotal: localSummary.collectiblesTotal,
    collectiblesSetBonus: localSummary.collectiblesSetBonus,
    exploredPct: localSummary.exploredPct,
    explorationScore: localSummary.explorationScore,
    cartographerBonus: localSummary.cartographerBonus,
    hatchBonusScore: localSummary.hatchBonusScore || 0,
    photoBonusScore: localSummary.photoBonusScore || 0,
    encounterBonusScore: localSummary.encounterBonusScore || 0,
    drillBonusScore: localSummary.drillBonusScore || 0,
    weatherBonusScore: localSummary.weatherBonusScore || 0,
    trimBonusScore: localSummary.trimBonusScore || 0,
    expeditionBonusScore: localSummary.expeditionBonusScore || 0,
    rescueBonus,
    teamSurvivalBonus,
    teamScore,
    teamMaxPossible,
    teamRank,
  };
}

/**
 * Compute celebratory post-dive Expedition & Squad Superlative awards from real run telemetry (v197).
 * Returns up to 3 earned award badges ({ id, icon, title, detail, color }).
 */
export function computeSquadSuperlatives(session, peers = []) {
  if (!session) return [];
  const awards = [];
  const trim = session.trimStats || {};
  const collectedCount = session.collectedIds?.size || 0;
  const totalCollectibles = (session.level?.collectibles || []).length;
  const photoCount = (session.photosTaken || 0) + (session.photoCompositionBonus > 0 ? 1 : 0);
  const ccrActive = Boolean(session.diveState?.ccrEnabled);
  const rescuedAny = (session.aiBuddiesRescued || 0) > 0 || (Array.isArray(peers) && peers.some((p) => p && p.rescued));
  const resolvedIssues = session.aiIssuesResolved || 0;
  const dashes = session.secretLair?.dashesUsed || 0;

  if (rescuedAny || resolvedIssues >= 1) {
    awards.push({
      id: 'guardian-angel',
      icon: '🛡️',
      title: 'Guardian Angel',
      detail: rescuedAny ? 'Brought an incapacitated buddy home alive' : `Resolved ${resolvedIssues} squad emergency`,
      color: '#38bdf8',
    });
  }
  if (trim.zeroSiltMaster && (trim.disciplinePct ?? 0) >= 88) {
    awards.push({
      id: 'master-trim',
      icon: '🏆',
      title: 'Master Trim',
      detail: `${Math.round(trim.disciplinePct ?? 100)}% frog-kick trim · Zero silt blowouts`,
      color: '#fde047',
    });
  }
  if (totalCollectibles > 0 && collectedCount >= Math.max(3, Math.ceil(totalCollectibles * 0.75))) {
    awards.push({
      id: 'relic-hunter',
      icon: '💎',
      title: 'Relic Hunter',
      detail: `Recovered ${collectedCount}/${totalCollectibles} site relics`,
      color: '#c084fc',
    });
  }
  if (ccrActive && !session.diveState?.ccrBailedOut) {
    awards.push({
      id: 'silent-ghost',
      icon: '♻️',
      title: 'Silent CCR Ghost',
      detail: `Zero-bubble closed-circuit run (${Math.round(session.diveState?.ccrScrubberPct ?? 100)}% scrubber left)`,
      color: '#4ade80',
    });
  }
  if (photoCount >= 2 || (session.photoCompositionBonus || 0) > 0) {
    awards.push({
      id: 'wildlife-master',
      icon: '📸',
      title: 'Expedition Photographer',
      detail: session.photoCompositionBonus > 0 ? `Nat-Geo composition (+${session.photoCompositionBonus} pts)` : `${photoCount} underwater frames logged`,
      color: '#fb923c',
    });
  }
  if (dashes >= 3 || session.secretLair?.bossDefeated) {
    awards.push({
      id: 'slipstream-ace',
      icon: '⚡',
      title: 'Slipstream Ace',
      detail: `${dashes} combat Hydro-Dashes executed`,
      color: '#22d3ee',
    });
  }
  return awards.slice(0, 3);
}
