import { LEVELS, isValidLevelId, getLevelById } from '../levels/index.js';

export const LEADERBOARD_MODES = new Set(['solo', 'team', 'daily']);
export const CALLSIGN_MAX_LEN = 16;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const GH_LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

export function sanitizeGitHubAvatarUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' && u.hostname === 'avatars.githubusercontent.com') {
      return u.toString().slice(0, 260);
    }
  } catch {}
  return '';
}

export function sanitizeGitHubLogin(raw) {
  const s = String(raw || '').trim();
  return GH_LOGIN_RE.test(s) ? s : '';
}

export function sanitizeCallsign(raw, fallback = 'Diver', maxLen = CALLSIGN_MAX_LEN) {
  const cleaned = String(raw || '')
    .replace(/[\r\n\t<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
  return cleaned || fallback;
}

export function sanitizeIdToken(raw, maxLen = 48) {
  return String(raw || '')
    .replace(/[^A-Za-z0-9_:-]/g, '')
    .slice(0, maxLen);
}

/**
 * Deterministic maximum achievable score ceiling per level for sanity validation.
 */
export function computeLevelMaxScore(levelId, isTeam = false) {
  if (!isValidLevelId(levelId)) return 0;
  const level = getLevelById(levelId);
  const list = level.collectibles || [];
  const collectiblePts = list.reduce(
    (sum, c) => sum + (Number(c.points) || 200),
    0
  );
  const allCollectiblesBonus = list.length > 0 ? 400 : 0;
  const maxHatchBonus = (level.watertightHatches || []).reduce((sum, h) => sum + (Number(h.bonusPoints) || 150), 0);
  // Match scoring.js maxPossible: Health (1000) + Speed (800) + Collectibles + All Bonus (400) + Explore (700) + Cartographer (250) + Hatches + Photos (300) + Survey Beacon (180) + Emergency Drills (600) + Weather Bonus (250) + Zero-Silt Trim Bonus (250)
  const soloCeiling = 1000 + 800 + collectiblePts + allCollectiblesBonus + 700 + 250 + maxHatchBonus + 300 + 180 + 600 + 250 + 250;
  return isTeam ? soloCeiling + 600 : soloCeiling;
}

/**
 * Validate and normalize a solo, co-op team, or daily expedition dive submission.
 * Returns { ok: true, entry } or { ok: false, error }.
 * Cryptographically verified GitHub identity is stamped ONLY when `verifiedGitHubUser` is provided.
 */
export function normalizeLeaderboardSubmission(raw, { verifiedGitHubUser = null } = {}) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid submission payload.' };
  }
  const mode =
    raw.mode === 'team' ? 'team' : raw.mode === 'daily' ? 'daily' : raw.mode === 'solo' ? 'solo' : null;
  if (!mode) {
    return { ok: false, error: 'Leaderboard mode must be "solo", "team", or "daily".' };
  }
  const levelId = typeof raw.levelId === 'string' ? raw.levelId.trim() : '';
  if (!isValidLevelId(levelId)) {
    return { ok: false, error: 'Unknown dive site levelId.' };
  }

  const isTeam = mode === 'team';
  const isDaily = mode === 'daily';
  const rawDateKey = typeof raw.dailyDateKey === 'string' ? raw.dailyDateKey.trim().slice(0, 10) : '';
  const dailyDateKey = isDaily
    ? DATE_KEY_RE.test(rawDateKey)
      ? rawDateKey
      : new Date().toISOString().slice(0, 10)
    : '';
  const mutatorId = isDaily ? sanitizeIdToken(raw.mutatorId, 32) : '';

  const teamSize = isTeam
    ? Math.max(2, Math.min(4, Math.round(Number(raw.teamSize) || 2)))
    : 1;
  const maxAllowed = computeLevelMaxScore(levelId, isTeam);
  const score = Math.round(Number(raw.score));
  if (!Number.isFinite(score) || score < 0 || score > maxAllowed) {
    return { ok: false, error: `Score out of valid bounds (0..${maxAllowed}).` };
  }

  const timeSec = Math.round(Number(raw.timeSec) * 10) / 10;
  if (!Number.isFinite(timeSec) || timeSec < 0.1 || timeSec > 7200) {
    return { ok: false, error: 'Invalid dive duration.' };
  }

  const exploredPct = Math.max(0, Math.min(100, Math.round(Number(raw.exploredPct) || 0)));
  const level = getLevelById(levelId);
  const maxCollect = (level.collectibles || []).length;
  const collectiblesFound = Math.max(0, Math.min(maxCollect, Math.round(Number(raw.collectiblesFound) || 0)));
  const allowedGrades = new Set(['S+', 'S', 'A', 'B', 'C', 'DNF']);
  const grade = allowedGrades.has(raw.grade) ? raw.grade : 'B';
  if (grade === 'DNF') {
    return { ok: false, error: 'Only completed dives qualify for the global leaderboard.' };
  }

  // Verified GitHub identity is ONLY accepted from a trusted server/session source
  const ghLogin = verifiedGitHubUser ? sanitizeGitHubLogin(verifiedGitHubUser.login) : '';
  const ghAvatar = ghLogin ? sanitizeGitHubAvatarUrl(verifiedGitHubUser.avatarUrl) : '';
  const githubVerified = Boolean(ghLogin);

  const playerId = ghLogin
    ? `gh_${ghLogin.toLowerCase().slice(0, 32)}`
    : sanitizeIdToken(raw.playerId, 36) || `anon_${Date.now().toString(36)}`;
  const rawCrew = Array.isArray(raw.crew) ? raw.crew.slice(0, 4) : [];
  const crew = rawCrew.map((m, idx) => {
    const member = {
      name: sanitizeCallsign(m?.name, `Diver ${idx + 1}`),
      score: Math.max(0, Math.min(maxAllowed, Math.round(Number(m?.score) || score))),
      alive: m?.alive !== false,
    };
    if (Number.isFinite(Number(m?.healthPct))) {
      member.healthPct = Math.max(0, Math.min(100, Math.round(Number(m.healthPct))));
    }
    if (Number.isFinite(Number(m?.gasRemainingPct))) {
      member.gasRemainingPct = Math.max(0, Math.min(100, Math.round(Number(m.gasRemainingPct))));
    }
    if (Number.isFinite(Number(m?.diveTimeSec))) {
      member.diveTimeSec = Math.max(0, Math.min(7200, Math.round(Number(m.diveTimeSec) * 10) / 10));
    }
    if (m?.rescued) member.rescued = true;
    return member;
  });

  const stats = sanitizeLeaderboardStats(raw.stats, level);
  const rawDiff = raw.difficulty ?? raw.stats?.difficulty;
  const difficulty =
    rawDiff === 'guided' || rawDiff === 'standard' || rawDiff === 'hardcore' ? rawDiff : undefined;

  const diverName = sanitizeCallsign(raw.diverName || crew[0]?.name, 'Diver 1');
  if (crew.length === 0) {
    crew.push({ name: diverName, score, alive: true });
  }

  const displayName = isTeam
    ? crew.map((m) => m.name).join(' + ').slice(0, 80)
    : diverName;

  const runId =
    sanitizeIdToken(raw.runId, 48) ||
    `${playerId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  // Solo deduplicates per (playerId, levelId); Daily per (playerId, dailyDateKey); Team per shared runId
  const entryKey = isTeam
    ? runId
    : isDaily
      ? `${playerId}:${dailyDateKey}`
      : `${playerId}:${levelId}`;

  return {
    ok: true,
    entry: {
      mode,
      levelId,
      ...(isDaily ? { dailyDateKey } : {}),
      ...(mutatorId ? { mutatorId } : {}),
      entryKey,
      playerId,
      runId,
      displayName,
      ...(githubVerified ? { githubLogin: ghLogin, githubVerified: true } : {}),
      ...(ghAvatar ? { githubAvatar: ghAvatar } : {}),
      crew,
      teamSize,
      score,
      grade,
      timeSec,
      exploredPct,
      collectiblesFound,
      collectiblesTotal: maxCollect,
      ...(difficulty ? { difficulty } : {}),
      ...(stats ? { stats } : {}),
      createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : Date.now(),
    },
  };
}

function sanitizeLeaderboardStats(raw, level) {
  if (!raw || typeof raw !== 'object') return null;
  const clamp = (v, min, max, dec = 0) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return undefined;
    const bounded = Math.max(min, Math.min(max, n));
    if (dec <= 0) return Math.round(bounded);
    const f = Math.pow(10, dec);
    return Math.round(bounded * f) / f;
  };
  const cpTotal = Math.max(0, (level?.checkpoints || []).length);
  const out = {};
  const assign = (k, val) => {
    if (val !== undefined) out[k] = val;
  };
  assign('maxDepthM', clamp(raw.maxDepthM, 0, 300, 1));
  assign('avgHealthPct', clamp(raw.avgHealthPct, 0, 100));
  assign('avgSpeedPct', clamp(raw.avgSpeedPct, 0, 100));
  assign('avgGasRemainingPct', clamp(raw.avgGasRemainingPct, 0, 100));
  assign('peakHeartRateBpm', clamp(raw.peakHeartRateBpm, 40, 220));
  assign('checkpointsHit', clamp(raw.checkpointsHit, 0, cpTotal || 20));
  assign('totalCheckpoints', clamp(raw.totalCheckpoints ?? cpTotal, 0, cpTotal || 20));
  assign('healthScore', clamp(raw.healthScore, 0, 1200));
  assign('speedScore', clamp(raw.speedScore, 0, 1000));
  assign('collectiblesScore', clamp(raw.collectiblesScore, 0, 12000));
  assign('explorationScore', clamp(raw.explorationScore, 0, 1200));
  assign('rescueBonus', clamp(raw.rescueBonus, 0, 1200));
  assign('teamSurvivalBonus', clamp(raw.teamSurvivalBonus, 0, 1200));
  assign('eanBar', clamp(raw.eanBar, 0, 260));
  assign('tmxBar', clamp(raw.tmxBar, 0, 260));
  assign('o2Bar', clamp(raw.o2Bar, 0, 260));
  if (raw.difficulty === 'guided' || raw.difficulty === 'standard' || raw.difficulty === 'hardcore') {
    out.difficulty = raw.difficulty;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function sortLeaderboardEntries(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (a.timeSec !== b.timeSec) return a.timeSec - b.timeSec;
  return a.createdAt - b.createdAt;
}

/**
 * Aggregate best-per-level (or per-date for daily) scores into a campaign-wide ranking.
 */
export function buildOverallStandings(entries, mode = 'solo', limit = 20) {
  const safeMode = mode === 'team' ? 'team' : mode === 'daily' ? 'daily' : 'solo';
  const buckets = new Map();
  for (const e of entries || []) {
    if (!e || e.mode !== safeMode) continue;
    const ownerKey =
      safeMode === 'team'
        ? (e.crew || []).map((c) => c.name.toLowerCase()).sort().join('|') || e.displayName.toLowerCase()
        : e.githubVerified && e.githubLogin
          ? `gh:${e.githubLogin.toLowerCase()}`
          : e.playerId || e.displayName.toLowerCase();
    let agg = buckets.get(ownerKey);
    if (!agg) {
      agg = {
        playerId: e.playerId,
        displayName: e.displayName,
        githubLogin: e.githubVerified && e.githubLogin ? e.githubLogin : '',
        githubAvatar: e.githubVerified && e.githubAvatar ? e.githubAvatar : '',
        githubVerified: Boolean(e.githubVerified && e.githubLogin),
        teamSize: e.teamSize,
        crew: e.crew,
        bestBySlot: new Map(),
        latestAt: e.createdAt,
      };
      buckets.set(ownerKey, agg);
    }
    const slotKey = safeMode === 'daily' ? e.dailyDateKey || e.levelId : e.levelId;
    const prev = agg.bestBySlot.get(slotKey);
    if (!prev || sortLeaderboardEntries(e, prev) < 0) {
      agg.bestBySlot.set(slotKey, e);
    }
    if (e.githubVerified && e.githubLogin) {
      agg.githubVerified = true;
      agg.githubLogin = e.githubLogin;
      if (e.githubAvatar) agg.githubAvatar = e.githubAvatar;
    }
    if (e.createdAt >= agg.latestAt) {
      agg.latestAt = e.createdAt;
      agg.displayName = e.displayName;
    }
  }

  const rows = [];
  for (const agg of buckets.values()) {
    let totalScore = 0;
    let totalTime = 0;
    let exploredSum = 0;
    let totalCollectFound = 0;
    let totalCollectAvail = 0;
    const rankOrder = new Map(LEVELS.map((l, i) => [l.id, i]));
    const siteRuns = Array.from(agg.bestBySlot.values())
      .map((best) => ({
        levelId: best.levelId,
        ...(best.dailyDateKey ? { dailyDateKey: best.dailyDateKey } : {}),
        ...(best.mutatorId ? { mutatorId: best.mutatorId } : {}),
        score: best.score,
        grade: best.grade,
        timeSec: best.timeSec,
        exploredPct: best.exploredPct,
        collectiblesFound: best.collectiblesFound || 0,
        collectiblesTotal: best.collectiblesTotal || 0,
        createdAt: best.createdAt,
        ...(best.difficulty || best.stats?.difficulty
          ? { difficulty: best.difficulty || best.stats?.difficulty }
          : {}),
        ...(best.stats ? { stats: best.stats } : {}),
      }))
      .sort((a, b) =>
        safeMode === 'daily'
          ? String(b.dailyDateKey || '').localeCompare(String(a.dailyDateKey || ''))
          : (rankOrder.get(a.levelId) ?? 999) - (rankOrder.get(b.levelId) ?? 999)
      );

    for (const best of agg.bestBySlot.values()) {
      totalScore += best.score;
      totalTime += best.timeSec;
      exploredSum += best.exploredPct;
      totalCollectFound += best.collectiblesFound || 0;
      totalCollectAvail += best.collectiblesTotal || 0;
    }
    const sitesCompleted = agg.bestBySlot.size;
    rows.push({
      mode: safeMode,
      levelId: 'overall',
      playerId: agg.playerId,
      displayName: agg.displayName,
      ...(agg.githubVerified ? { githubLogin: agg.githubLogin, githubVerified: true } : {}),
      ...(agg.githubAvatar ? { githubAvatar: agg.githubAvatar } : {}),
      crew: agg.crew,
      teamSize: agg.teamSize,
      sitesCompleted,
      totalSites: safeMode === 'daily' ? sitesCompleted : LEVELS.length,
      collectiblesFound: totalCollectFound,
      collectiblesTotal: totalCollectAvail,
      siteRuns,
      score: totalScore,
      grade:
        safeMode === 'daily'
          ? `${sitesCompleted} DAILY`
          : sitesCompleted >= LEVELS.length
            ? 'CAMPAIGN'
            : `${sitesCompleted}/${LEVELS.length} SITES`,
      timeSec: Math.round(totalTime * 10) / 10,
      exploredPct: Math.round(exploredSum / Math.max(1, sitesCompleted)),
      createdAt: agg.latestAt,
    });
  }

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.sitesCompleted !== a.sitesCompleted) return b.sitesCompleted - a.sitesCompleted;
    return a.timeSec - b.timeSec;
  });
  return rows.slice(0, limit);
}

export function mergeLeaderboardEntries(existingList, incomingEntries) {
  const items = Array.isArray(existingList) ? existingList.slice() : [];
  const indexByKey = new Map();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it && it.mode && it.entryKey) {
      indexByKey.set(`${it.mode}|${it.entryKey}`, i);
    }
  }
  let changed = false;
  for (const entry of incomingEntries || []) {
    if (!entry || !entry.mode || !entry.entryKey) continue;
    const mapKey = `${entry.mode}|${entry.entryKey}`;
    const idx = indexByKey.get(mapKey);
    if (idx !== undefined) {
      const prev = items[idx];
      const better = sortLeaderboardEntries(entry, prev) < 0;
      const upgradedVerify = !prev.githubVerified && Boolean(entry.githubVerified) && entry.score >= prev.score;
      if (better || upgradedVerify) {
        items[idx] = entry;
        changed = true;
      }
    } else {
      indexByKey.set(mapKey, items.length);
      items.push(entry);
      changed = true;
    }
  }
  return { entries: items, changed };
}

export function pruneLeaderboardEntries(entries, maxTotal = 2500, minPerBoard = 60) {
  const list = Array.isArray(entries) ? entries.slice() : [];
  if (list.length <= maxTotal) return list;

  // Preserve at least top minPerBoard entries per board so one popular cave or day cannot evict another
  const byBoard = new Map();
  for (const e of list) {
    if (!e) continue;
    const bKey = e.mode === 'daily' ? `daily|${e.dailyDateKey || e.levelId}` : `${e.mode}|${e.levelId}`;
    let bucket = byBoard.get(bKey);
    if (!bucket) {
      bucket = [];
      byBoard.set(bKey, bucket);
    }
    bucket.push(e);
  }

  const protectedSet = new Set();
  for (const bucket of byBoard.values()) {
    bucket.sort(sortLeaderboardEntries);
    for (let i = 0; i < Math.min(minPerBoard, bucket.length); i++) {
      protectedSet.add(bucket[i]);
    }
  }

  const kept = Array.from(protectedSet).sort(sortLeaderboardEntries);
  if (kept.length >= maxTotal) {
    return kept.slice(0, maxTotal);
  }

  const extras = list
    .filter((e) => e && !protectedSet.has(e))
    .sort(sortLeaderboardEntries);
  return kept.concat(extras.slice(0, maxTotal - kept.length));
}

export function queryLeaderboardEntries(allEntries, { mode = 'solo', levelId = 'overall', limit = 20 } = {}) {
  const safeMode = mode === 'team' ? 'team' : mode === 'daily' ? 'daily' : 'solo';
  const safeLimit = Math.max(1, Math.min(50, Math.round(Number(limit) || 20)));
  if (levelId === 'overall') {
    return buildOverallStandings(allEntries, safeMode, safeLimit);
  }
  if (safeMode === 'daily') {
    const targetDate = DATE_KEY_RE.test(String(levelId || ''))
      ? String(levelId)
      : new Date().toISOString().slice(0, 10);
    return (allEntries || [])
      .filter((e) => e && e.mode === 'daily' && e.dailyDateKey === targetDate)
      .slice()
      .sort(sortLeaderboardEntries)
      .slice(0, safeLimit);
  }
  if (!isValidLevelId(levelId)) {
    return [];
  }
  return (allEntries || [])
    .filter((e) => e && e.mode === safeMode && e.levelId === levelId)
    .slice()
    .sort(sortLeaderboardEntries)
    .slice(0, safeLimit);
}
