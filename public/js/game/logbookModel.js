/**
 * Persistent Career Diver Logbook & Campaign Medal Tracker.
 * Pure helpers shared cleanly between browser UI and Node tests.
 */

const GRADE_RANK = { 'S+': 6, S: 5, A: 4, B: 3, C: 2, DNF: 1 };
const DIFFICULTY_RANK = { guided: 1, standard: 2, hardcore: 3 };

function normalizeDifficulty(raw) {
  if (raw === 'guided' || raw === 'standard' || raw === 'hardcore') return raw;
  return '';
}

export function createEmptyLogbook() {
  return {
    totalDives: 0,
    totalTimeSec: 0,
    deepestM: 0,
    bestScore: 0,
    cleared: {}, // levelId -> { score, grade, bestTimeSec, clears, bestDifficulty, lastDifficulty }
    daily: {
      currentStreak: 0,
      bestStreak: 0,
      totalClears: 0,
      lastClearedDate: '',
      clearedDates: [],
      records: {},
    },
    fieldGuide: {}, // entryId -> { count, bestStars, firstSiteId, bestSiteName, bestDepthM }
    milestones: {
      pressurizedEqualizations: 0,
      cleanSalvageLifts: 0,
      drillsCompleted: 0,
      zeroSiltClears: 0,
      contractsCompleted: 0,
    },
    loreArchive: {}, // storyKind -> { title, count, sampleLore, firstSiteName }
    completedCampaigns: [], // unlocked multi-dive expedition campaign IDs (v160)
    crewBonds: {}, // aiBuddyId -> { dives, clears, rescues } (v161 zero-config passive veteran bond)
  };
}

function normalizeBook(raw) {
  const base = createEmptyLogbook();
  if (!raw || typeof raw !== 'object') return base;
  base.totalDives = Math.max(0, Math.round(Number(raw.totalDives) || 0));
  base.totalTimeSec = Math.max(0, Number(raw.totalTimeSec) || 0);
  base.deepestM = Math.max(0, Number(raw.deepestM) || 0);
  base.bestScore = Math.max(0, Math.round(Number(raw.bestScore) || 0));
  if (raw.cleared && typeof raw.cleared === 'object') {
    for (const [lid, rec] of Object.entries(raw.cleared)) {
      if (!rec || typeof rec !== 'object') continue;
      const bestDiff = normalizeDifficulty(rec.bestDifficulty || rec.difficulty);
      const lastDiff = normalizeDifficulty(rec.lastDifficulty || rec.difficulty || bestDiff);
      base.cleared[lid] = {
        score: Math.max(0, Math.round(Number(rec.score) || 0)),
        grade: typeof rec.grade === 'string' ? rec.grade : 'B',
        bestTimeSec: Math.max(0, Number(rec.bestTimeSec) || 0),
        clears: Math.max(1, Math.round(Number(rec.clears) || 1)),
        ...(bestDiff ? { bestDifficulty: bestDiff } : {}),
        ...(lastDiff ? { lastDifficulty: lastDiff } : {}),
      };
    }
  }
  if (raw.daily && typeof raw.daily === 'object') {
    const d = raw.daily;
    base.daily.currentStreak = Math.max(0, Math.round(Number(d.currentStreak) || 0));
    base.daily.bestStreak = Math.max(base.daily.currentStreak, Math.round(Number(d.bestStreak) || 0));
    base.daily.totalClears = Math.max(0, Math.round(Number(d.totalClears) || 0));
    base.daily.lastClearedDate = typeof d.lastClearedDate === 'string' ? d.lastClearedDate.slice(0, 10) : '';
    base.daily.clearedDates = Array.isArray(d.clearedDates)
      ? Array.from(new Set(d.clearedDates.filter((k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k)))).slice(-90)
      : [];
    if (d.records && typeof d.records === 'object') {
      const keys = Object.keys(d.records).slice(-30);
      for (const dk of keys) {
        const r = d.records[dk];
        if (!r || typeof r !== 'object') continue;
        base.daily.records[dk] = {
          levelId: typeof r.levelId === 'string' ? r.levelId : '',
          mutatorId: typeof r.mutatorId === 'string' ? r.mutatorId : '',
          score: Math.max(0, Math.round(Number(r.score) || 0)),
          grade: typeof r.grade === 'string' ? r.grade : 'B',
          timeSec: Math.max(0, Number(r.timeSec) || 0),
        };
      }
    }
  }
  if (raw.fieldGuide && typeof raw.fieldGuide === 'object') {
    for (const [eid, rec] of Object.entries(raw.fieldGuide)) {
      if (!rec || typeof rec !== 'object') continue;
      base.fieldGuide[eid] = {
        count: Math.max(1, Math.round(Number(rec.count) || 1)),
        bestStars: Math.max(1, Math.min(3, Math.round(Number(rec.bestStars) || 1))),
        firstSiteId: typeof rec.firstSiteId === 'string' ? rec.firstSiteId : '',
        bestSiteName: typeof rec.bestSiteName === 'string' ? rec.bestSiteName : '',
        bestDepthM: Math.max(0, Math.round((Number(rec.bestDepthM) || 0) * 10) / 10),
      };
    }
  }
  if (raw.milestones && typeof raw.milestones === 'object') {
    const m = raw.milestones;
    base.milestones.pressurizedEqualizations = Math.max(0, Math.round(Number(m.pressurizedEqualizations) || 0));
    base.milestones.cleanSalvageLifts = Math.max(0, Math.round(Number(m.cleanSalvageLifts) || 0));
    base.milestones.drillsCompleted = Math.max(0, Math.round(Number(m.drillsCompleted) || 0));
    base.milestones.zeroSiltClears = Math.max(0, Math.round(Number(m.zeroSiltClears) || 0));
    base.milestones.contractsCompleted = Math.max(0, Math.round(Number(m.contractsCompleted) || 0));
  }
  if (raw.loreArchive && typeof raw.loreArchive === 'object') {
    for (const [k, rec] of Object.entries(raw.loreArchive)) {
      if (!rec || typeof rec !== 'object') continue;
      base.loreArchive[k] = {
        title: typeof rec.title === 'string' ? rec.title.slice(0, 64) : k,
        count: Math.max(1, Math.round(Number(rec.count) || 1)),
        sampleLore: typeof rec.sampleLore === 'string' ? rec.sampleLore.slice(0, 180) : '',
        firstSiteName: typeof rec.firstSiteName === 'string' ? rec.firstSiteName.slice(0, 64) : '',
      };
    }
  }
  if (Array.isArray(raw.completedCampaigns)) {
    base.completedCampaigns = Array.from(
      new Set(raw.completedCampaigns.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))
    ).slice(0, 24);
  }
  if (raw.crewBonds && typeof raw.crewBonds === 'object') {
    for (const [cid, rec] of Object.entries(raw.crewBonds)) {
      if (!rec || typeof rec !== 'object') continue;
      base.crewBonds[cid] = {
        dives: Math.max(0, Math.round(Number(rec.dives) || 0)),
        clears: Math.max(0, Math.round(Number(rec.clears) || 0)),
        rescues: Math.max(0, Math.round(Number(rec.rescues) || 0)),
      };
    }
  }
  return base;
}

export function normalizeCareerLogbook(raw) {
  return normalizeBook(raw);
}

/**
 * Commutative, idempotent merge of two career logbooks (e.g. local device + GitHub Private Gist).
 * Never overwrites higher scores, better grades, faster times, field guide captures, or daily streaks.
 */
export function mergeCareerLogbooks(rawA, rawB) {
  const a = normalizeBook(rawA);
  const b = normalizeBook(rawB);
  const out = createEmptyLogbook();

  out.totalDives = Math.max(a.totalDives, b.totalDives);
  out.totalTimeSec = Math.round(Math.max(a.totalTimeSec, b.totalTimeSec) * 10) / 10;
  out.deepestM = Math.round(Math.max(a.deepestM, b.deepestM) * 10) / 10;
  out.bestScore = Math.max(a.bestScore, b.bestScore);

  const siteIds = new Set([...Object.keys(a.cleared), ...Object.keys(b.cleared)]);
  for (const lid of siteIds) {
    const ra = a.cleared[lid];
    const rb = b.cleared[lid];
    if (ra && !rb) {
      out.cleared[lid] = { ...ra };
      continue;
    }
    if (rb && !ra) {
      out.cleared[lid] = { ...rb };
      continue;
    }
    const bestScore = Math.max(ra.score || 0, rb.score || 0);
    const bestGrade = (GRADE_RANK[rb.grade] || 0) > (GRADE_RANK[ra.grade] || 0) ? rb.grade : ra.grade;
    const bestTimeSec =
      ra.bestTimeSec > 0 && rb.bestTimeSec > 0
        ? Math.min(ra.bestTimeSec, rb.bestTimeSec)
        : Math.max(ra.bestTimeSec || 0, rb.bestTimeSec || 0);
    const bestDiff =
      (DIFFICULTY_RANK[rb.bestDifficulty] || 0) > (DIFFICULTY_RANK[ra.bestDifficulty] || 0)
        ? rb.bestDifficulty
        : ra.bestDifficulty || rb.bestDifficulty || '';
    const lastDiff = rb.lastDifficulty || ra.lastDifficulty || bestDiff;
    out.cleared[lid] = {
      score: bestScore,
      grade: bestGrade,
      bestTimeSec,
      clears: Math.max(ra.clears || 1, rb.clears || 1),
      ...(bestDiff ? { bestDifficulty: bestDiff } : {}),
      ...(lastDiff ? { lastDifficulty: lastDiff } : {}),
    };
    if (bestScore > out.bestScore) out.bestScore = bestScore;
  }
  out.totalDives = Math.max(out.totalDives, Object.keys(out.cleared).length);

  // Merge Daily Expedition cleared dates & recalculate exact streak continuity
  const allDates = Array.from(new Set([...(a.daily.clearedDates || []), ...(b.daily.clearedDates || [])])).sort();
  out.daily.clearedDates = allDates.slice(-90);
  out.daily.totalClears = Math.max(a.daily.totalClears || 0, b.daily.totalClears || 0, allDates.length);
  out.daily.lastClearedDate = allDates.length > 0 ? allDates[allDates.length - 1] : '';

  let bestStreak = Math.max(a.daily.bestStreak || 0, b.daily.bestStreak || 0);
  let curRun = 0;
  let prevDay = '';
  for (const d of allDates) {
    if (prevDay && prevUtcDateKey(d) === prevDay) {
      curRun += 1;
    } else {
      curRun = 1;
    }
    if (curRun > bestStreak) bestStreak = curRun;
    prevDay = d;
  }
  out.daily.currentStreak = curRun;
  out.daily.bestStreak = Math.max(bestStreak, curRun);

  const recDates = Array.from(
    new Set([...Object.keys(a.daily.records || {}), ...Object.keys(b.daily.records || {})])
  )
    .sort()
    .slice(-30);
  for (const dk of recDates) {
    const ra = a.daily.records?.[dk];
    const rb = b.daily.records?.[dk];
    if (ra && !rb) {
      out.daily.records[dk] = { ...ra };
    } else if (rb && !ra) {
      out.daily.records[dk] = { ...rb };
    } else if (ra && rb) {
      const winner = (rb.score || 0) > (ra.score || 0) ? rb : ra;
      out.daily.records[dk] = {
        ...winner,
        timeSec:
          ra.timeSec > 0 && rb.timeSec > 0 ? Math.min(ra.timeSec, rb.timeSec) : winner.timeSec || 0,
      };
    }
  }

  // Merge Expedition Field Guide species captures
  const fgIds = new Set([...Object.keys(a.fieldGuide || {}), ...Object.keys(b.fieldGuide || {})]);
  for (const eid of fgIds) {
    const ra = a.fieldGuide?.[eid];
    const rb = b.fieldGuide?.[eid];
    if (ra && !rb) {
      out.fieldGuide[eid] = { ...ra };
    } else if (rb && !ra) {
      out.fieldGuide[eid] = { ...rb };
    } else if (ra && rb) {
      out.fieldGuide[eid] = {
        count: Math.max(ra.count || 1, rb.count || 1),
        bestStars: Math.max(ra.bestStars || 1, rb.bestStars || 1),
        firstSiteId: ra.firstSiteId || rb.firstSiteId || '',
        bestSiteName: (rb.bestStars || 0) > (ra.bestStars || 0) ? rb.bestSiteName || ra.bestSiteName : ra.bestSiteName || rb.bestSiteName,
        bestDepthM: Math.round(Math.max(ra.bestDepthM || 0, rb.bestDepthM || 0) * 10) / 10,
      };
    }
  }

  // Merge technical skill milestones (v151)
  out.milestones.pressurizedEqualizations = Math.max(
    a.milestones?.pressurizedEqualizations || 0,
    b.milestones?.pressurizedEqualizations || 0
  );
  out.milestones.cleanSalvageLifts = Math.max(
    a.milestones?.cleanSalvageLifts || 0,
    b.milestones?.cleanSalvageLifts || 0
  );
  out.milestones.drillsCompleted = Math.max(
    a.milestones?.drillsCompleted || 0,
    b.milestones?.drillsCompleted || 0
  );
  out.milestones.zeroSiltClears = Math.max(
    a.milestones?.zeroSiltClears || 0,
    b.milestones?.zeroSiltClears || 0
  );
  out.milestones.contractsCompleted = Math.max(
    a.milestones?.contractsCompleted || 0,
    b.milestones?.contractsCompleted || 0
  );

  // Merge Submerged Lore Archive (v156)
  const loreKeys = new Set([...Object.keys(a.loreArchive || {}), ...Object.keys(b.loreArchive || {})]);
  for (const lk of loreKeys) {
    const la = a.loreArchive?.[lk];
    const lb = b.loreArchive?.[lk];
    if (la && !lb) out.loreArchive[lk] = { ...la };
    else if (lb && !la) out.loreArchive[lk] = { ...lb };
    else if (la && lb) {
      out.loreArchive[lk] = {
        title: la.title || lb.title,
        count: Math.max(la.count || 1, lb.count || 1),
        sampleLore: la.sampleLore || lb.sampleLore,
        firstSiteName: la.firstSiteName || lb.firstSiteName,
      };
    }
  }

  out.completedCampaigns = Array.from(
    new Set([...(a.completedCampaigns || []), ...(b.completedCampaigns || [])])
  ).slice(0, 24);
  const bondIds = new Set([...Object.keys(a.crewBonds || {}), ...Object.keys(b.crewBonds || {})]);
  for (const bid of bondIds) {
    const ba = a.crewBonds?.[bid] || {};
    const bb = b.crewBonds?.[bid] || {};
    out.crewBonds[bid] = {
      dives: Math.max(ba.dives || 0, bb.dives || 0),
      clears: Math.max(ba.clears || 0, bb.clears || 0),
      rescues: Math.max(ba.rescues || 0, bb.rescues || 0),
    };
  }

  return out;
}

/**
 * Validate and compact a PB ghost replay track ([t10, x10, y10, ang10] tuples)
 * for lightweight Private Gist cloud storage while preserving exact start & finish timestamps.
 */
export function normalizeGhostTrack(rawTrack, maxPoints = 360) {
  if (!Array.isArray(rawTrack) || rawTrack.length < 2) return null;
  const cleaned = [];
  let lastT = -Infinity;
  for (let i = 0; i < rawTrack.length; i++) {
    const pt = rawTrack[i];
    if (!Array.isArray(pt) || pt.length < 3) continue;
    const t = Math.round(Number(pt[0]));
    const x = Math.round(Number(pt[1]));
    const y = Math.round(Number(pt[2]));
    const a = Number.isFinite(Number(pt[3])) ? Math.round(Number(pt[3])) : 0;
    if (!Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(y) || t < 0) continue;
    if (t < lastT) continue;
    lastT = t;
    cleaned.push([t, x, y, a]);
  }
  if (cleaned.length < 2) return null;
  const cap = Math.max(16, Math.min(600, Math.round(maxPoints) || 360));
  if (cleaned.length <= cap) return cleaned;

  // Uniformly downsample interior points while keeping exact start (0) and finish (length - 1)
  const out = [cleaned[0]];
  const span = cleaned.length - 1;
  const interiorSlots = cap - 2;
  for (let i = 1; i <= interiorSlots; i++) {
    const idx = Math.min(span - 1, Math.max(1, Math.round((i / (interiorSlots + 1)) * span)));
    if (out[out.length - 1][0] !== cleaned[idx][0]) {
      out.push(cleaned[idx]);
    }
  }
  out.push(cleaned[span]);
  return out;
}

/**
 * Merge two maps of { [levelId]: ghostTrack }, keeping the faster completed PB ghost per site.
 */
export function mergeGhostTracks(rawA, rawB, { maxSites = 30, maxPoints = 360 } = {}) {
  const out = {};
  const keys = new Set([
    ...(rawA && typeof rawA === 'object' ? Object.keys(rawA) : []),
    ...(rawB && typeof rawB === 'object' ? Object.keys(rawB) : []),
  ]);
  for (const lid of keys) {
    if (!lid || typeof lid !== 'string' || lid.length > 64) continue;
    const a = normalizeGhostTrack(rawA?.[lid], maxPoints);
    const b = normalizeGhostTrack(rawB?.[lid], maxPoints);
    if (a && !b) {
      out[lid] = a;
    } else if (b && !a) {
      out[lid] = b;
    } else if (a && b) {
      const durA = a[a.length - 1][0];
      const durB = b[b.length - 1][0];
      if (durA > 0 && durB > 0) {
        out[lid] = durB < durA ? b : a;
      } else {
        out[lid] = b.length > a.length ? b : a;
      }
    }
    if (Object.keys(out).length >= maxSites) break;
  }
  return out;
}

export function recordDiveInLogbook(
  rawBook,
  {
    levelId,
    success,
    score = 0,
    grade = 'C',
    maxDepthM = 0,
    diveTimeSec = 0,
    difficulty = 'standard',
    milestones = null,
  }
) {
  const book = normalizeBook(rawBook);
  book.totalDives += 1;
  book.totalTimeSec = Math.round((book.totalTimeSec + Math.max(0, Number(diveTimeSec) || 0)) * 10) / 10;

  if (milestones && typeof milestones === 'object') {
    const eq = Math.max(0, Math.round(Number(milestones.equalizedBulkheads) || 0));
    const dr = Math.max(0, Math.round(Number(milestones.drillsCompleted) || 0));
    if (eq > 0) book.milestones.pressurizedEqualizations += eq;
    if (dr > 0) book.milestones.drillsCompleted += dr;
    const cc = Math.max(0, Math.round(Number(milestones.contractsCompleted) || 0));
    if (cc > 0) book.milestones.contractsCompleted += cc;
    if (success && milestones.cleanSalvageLift) book.milestones.cleanSalvageLifts += 1;
    if (success && milestones.zeroSiltCaveClear) book.milestones.zeroSiltClears += 1;
  }

  if (success && levelId) {
    book.deepestM = Math.max(book.deepestM, Math.round((Number(maxDepthM) || 0) * 10) / 10);
    const cleanScore = Math.max(0, Math.round(Number(score) || 0));
    const cleanTime = Math.max(0, Math.round((Number(diveTimeSec) || 0) * 10) / 10);
    const cleanDiff = normalizeDifficulty(difficulty) || 'standard';
    if (cleanScore > book.bestScore) book.bestScore = cleanScore;
    const prev = book.cleared[levelId];
    if (!prev) {
      book.cleared[levelId] = {
        score: cleanScore,
        grade: grade || 'B',
        bestTimeSec: cleanTime,
        clears: 1,
        bestDifficulty: cleanDiff,
        lastDifficulty: cleanDiff,
      };
    } else {
      prev.clears += 1;
      prev.lastDifficulty = cleanDiff;
      if ((DIFFICULTY_RANK[cleanDiff] || 0) >= (DIFFICULTY_RANK[prev.bestDifficulty] || 0)) {
        prev.bestDifficulty = cleanDiff;
      }
      if (cleanScore > prev.score) prev.score = cleanScore;
      if ((GRADE_RANK[grade] || 0) > (GRADE_RANK[prev.grade] || 0)) prev.grade = grade;
      if (cleanTime > 0 && (prev.bestTimeSec <= 0 || cleanTime < prev.bestTimeSec)) {
        prev.bestTimeSec = cleanTime;
      }
    }
  }
  return book;
}

export function recordLoreDiscoveryInLogbook(rawBook, { kind, title, lore, siteName = '' } = {}) {
  const book = normalizeBook(rawBook);
  if (!kind) return { book, isNew: false };
  const prev = book.loreArchive[kind];
  if (!prev) {
    book.loreArchive[kind] = {
      title: String(title || kind).slice(0, 64),
      count: 1,
      sampleLore: String(lore || '').slice(0, 180),
      firstSiteName: String(siteName || '').slice(0, 64),
    };
    return { book, isNew: true };
  }
  prev.count = (prev.count || 1) + 1;
  return { book, isNew: false };
}

export function recordCampaignClearInLogbook(rawBook, campaignId) {
  const book = normalizeBook(rawBook);
  const cleanId = typeof campaignId === 'string' ? campaignId.trim() : '';
  if (!cleanId) return { book, isNew: false };
  const existed = book.completedCampaigns.includes(cleanId);
  if (!existed) book.completedCampaigns.push(cleanId);
  return { book, isNew: !existed };
}

/**
 * Passively increment zero-config AI Crewmate Veteran Bond counters after each squad dive (v161).
 */
export function recordCrewDiveInLogbook(rawBook, squadIds = [], { cleared = false, rescuedIds = [] } = {}) {
  const book = normalizeBook(rawBook);
  const rescSet = new Set(Array.isArray(rescuedIds) ? rescuedIds : []);
  for (const cid of Array.isArray(squadIds) ? squadIds : []) {
    if (!cid || typeof cid !== 'string') continue;
    const prev = book.crewBonds[cid] || { dives: 0, clears: 0, rescues: 0 };
    book.crewBonds[cid] = {
      dives: prev.dives + 1,
      clears: prev.clears + (cleared ? 1 : 0),
      rescues: prev.rescues + (rescSet.has(cid) ? 1 : 0),
    };
  }
  return book;
}

export function seedLogbookFromEntries(rawBook, entries) {
  const book = normalizeBook(rawBook);
  if (!Array.isArray(entries)) return book;
  for (const e of entries) {
    if (!e || !e.levelId || e.levelId === 'overall' || e.grade === 'DNF') continue;
    const prev = book.cleared[e.levelId];
    const s = Math.max(0, Math.round(Number(e.score) || 0));
    const tSec = Math.max(0, Math.round((Number(e.timeSec) || 0) * 10) / 10);
    const maxD = Math.max(0, Math.round((Number(e.stats?.maxDepthM) || Number(e.maxDepthM) || 0) * 10) / 10);
    const diff = normalizeDifficulty(e.difficulty || e.stats?.difficulty);
    if (s > book.bestScore) book.bestScore = s;
    if (maxD > book.deepestM) book.deepestM = maxD;
    if (!prev) {
      book.cleared[e.levelId] = {
        score: s,
        grade: e.grade || 'B',
        bestTimeSec: tSec,
        clears: 1,
        ...(diff ? { bestDifficulty: diff, lastDifficulty: diff } : {}),
      };
      if (tSec > 0) book.totalTimeSec = Math.round((book.totalTimeSec + tSec) * 10) / 10;
      book.totalDives = Math.max(book.totalDives, Object.keys(book.cleared).length);
    } else {
      if (s > prev.score) prev.score = s;
      if ((GRADE_RANK[e.grade] || 0) > (GRADE_RANK[prev.grade] || 0)) prev.grade = e.grade;
      if (tSec > 0 && (prev.bestTimeSec <= 0 || tSec < prev.bestTimeSec)) {
        prev.bestTimeSec = tSec;
      }
      if (diff && (DIFFICULTY_RANK[diff] || 0) > (DIFFICULTY_RANK[prev.bestDifficulty] || 0)) {
        prev.bestDifficulty = diff;
      }
      if (diff && !prev.lastDifficulty) prev.lastDifficulty = diff;
    }
  }
  return book;
}

export function formatLogbookSummary(rawBook, totalSites = 30) {
  const book = normalizeBook(rawBook);
  const clearedCount = Object.keys(book.cleared).length;
  let campaignMedal = 'TRAINEE';
  if (clearedCount >= totalSites) campaignMedal = 'MASTER EXPLORER';
  else if (clearedCount >= Math.ceil(totalSites * 0.6)) campaignMedal = 'CAVE SPECIALIST';
  else if (clearedCount >= 3) campaignMedal = 'FULL CAVE';
  else if (clearedCount >= 1) campaignMedal = 'CAVERN DIVER';

  return {
    clearedCount,
    totalSites,
    totalDives: book.totalDives,
    totalTimeSec: book.totalTimeSec,
    deepestM: book.deepestM,
    bestScore: book.bestScore,
    campaignMedal,
  };
}

/**
 * Technical Diving Certification Ladder computed from the player's career logbook.
 */
export function computeCertifications(rawBook, levels = []) {
  const book = normalizeBook(rawBook);
  const clearedIds = Object.keys(book.cleared);
  const clearedCount = clearedIds.length;

  const levelMap = new Map();
  for (const lvl of levels || []) {
    if (lvl?.id) levelMap.set(lvl.id, lvl);
  }
  let wrecksCleared = 0;
  let unlinedCleared = 0;
  let sGrades = 0;
  for (const lid of clearedIds) {
    const rec = book.cleared[lid];
    if (rec?.grade === 'S' || rec?.grade === 'S+') sGrades++;
    const lvl = levelMap.get(lid);
    if (
      lvl?.isWreck ||
      lid.includes('thistlegorm') ||
      lid.includes('oriskany') ||
      lid.includes('u1206') ||
      lid.includes('andrea-doria') ||
      lid.includes('britannic') ||
      lid.includes('victoria') ||
      lid.includes('fitzgerald')
    ) {
      wrecksCleared++;
    }
    if (lvl && (lvl.reelMetersPerDiver || 0) > 0) unlinedCleared++;
  }

  const ms = book.milestones || {};
  const eqCount = ms.pressurizedEqualizations || 0;
  const liftCount = ms.cleanSalvageLifts || 0;
  const drillCount = ms.drillsCompleted || 0;
  const zeroSiltCount = ms.zeroSiltClears || 0;
  const pct = (cur, goal) => Math.max(0, Math.min(100, Math.round((cur / Math.max(1, goal)) * 100)));

  const certs = [
    {
      id: 'open-water',
      icon: '🤿',
      title: 'Open Water',
      requirement: 'Clear 1 expedition',
      earned: clearedCount >= 1,
      progressPct: pct(clearedCount, 1),
      progressText: `${Math.min(clearedCount, 1)}/1 site`,
    },
    {
      id: 'cavern',
      icon: '🕳️',
      title: 'Cavern Diver',
      requirement: 'Clear 3 sites',
      earned: clearedCount >= 3,
      progressPct: pct(clearedCount, 3),
      progressText: `${Math.min(clearedCount, 3)}/3 sites`,
    },
    {
      id: 'trimix-normoxic',
      icon: '🧪',
      title: 'Normoxic Trimix',
      requirement: 'Reach 60m+ depth',
      earned: book.deepestM >= 60,
      progressPct: pct(book.deepestM, 60),
      progressText: `${Math.min(Math.round(book.deepestM), 60)}/60m`,
    },
    {
      id: 'full-cave',
      icon: '🔦',
      title: 'Full Cave',
      requirement: 'Clear 6 sites (incl. unlined reel)',
      earned: clearedCount >= 6 && (unlinedCleared >= 1 || levels.length === 0),
      progressPct: Math.min(
        100,
        Math.round((Math.min(clearedCount, 6) / 6) * 80 + (unlinedCleared >= 1 || levels.length === 0 ? 20 : 0))
      ),
      progressText: `${Math.min(clearedCount, 6)}/6 sites${unlinedCleared >= 1 ? ' · reel ✓' : ' · +1 unlined'}`,
    },
    {
      id: 'wreck-penetration',
      icon: '🚢',
      title: 'Wreck Penetration',
      requirement: 'Clear 2 shipwrecks',
      earned: wrecksCleared >= 2,
      progressPct: pct(wrecksCleared, 2),
      progressText: `${Math.min(wrecksCleared, 2)}/2 wrecks`,
    },
    {
      id: 'hypoxic-120',
      icon: '🌊',
      title: 'Hypoxic 120m',
      requirement: 'Reach 120m+ depth',
      earned: book.deepestM >= 120,
      progressPct: pct(book.deepestM, 120),
      progressText: `${Math.min(Math.round(book.deepestM), 120)}/120m`,
    },
    {
      id: 'master-explorer',
      icon: '🧭',
      title: 'Master Explorer',
      requirement: 'Clear 15+ sites & 5+ S-ranks',
      earned: clearedCount >= 15 && sGrades >= 5,
      progressPct: Math.min(100, Math.round((Math.min(clearedCount, 15) / 15) * 65 + (Math.min(sGrades, 5) / 5) * 35)),
      progressText: `${Math.min(clearedCount, 15)}/15 sites · ${Math.min(sGrades, 5)}/5 S`,
    },
    {
      id: 'bulkhead-engineer',
      icon: '⚙️',
      title: 'Bulkhead Engineer',
      requirement: 'Equalize a pressurized deep bulkhead',
      earned: eqCount >= 1,
      progressPct: pct(eqCount, 1),
      progressText: `${Math.min(eqCount, 1)}/1 valve`,
      specialty: true,
    },
    {
      id: 'salvage-master',
      icon: '🎈',
      title: 'Salvage Master',
      requirement: 'Extract heavy salvage cleanly with lift bag',
      earned: liftCount >= 1,
      progressPct: pct(liftCount, 1),
      progressText: `${Math.min(liftCount, 1)}/1 clean lift`,
      specialty: true,
    },
    {
      id: 'abyssal-troubleshooter',
      icon: '🩺',
      title: 'Emergency Troubleshooter',
      requirement: 'Resolve 3+ technical failure drills',
      earned: drillCount >= 3,
      progressPct: pct(drillCount, 3),
      progressText: `${Math.min(drillCount, 3)}/3 drills`,
      specialty: true,
    },
    {
      id: 'zero-silt-surgeon',
      icon: '🫧',
      title: 'Zero-Silt Trim',
      requirement: 'Clear a cave dive with zero heavy silt-outs',
      earned: zeroSiltCount >= 1,
      progressPct: pct(zeroSiltCount, 1),
      progressText: `${Math.min(zeroSiltCount, 1)}/1 clean cave`,
      specialty: true,
    },
  ];

  const earned = certs.filter((c) => c.earned);
  const next = certs.find((c) => !c.earned) || null;
  const highest = earned.length > 0 ? earned[earned.length - 1] : null;
  return { certs, earned, highest, next, wrecksCleared, sGrades };
}

/**
 * Unlockable Technical Gear Catalog tied directly to the Career Certification Ladder.
 */
export const TECH_GEAR_CATALOG = [
  {
    id: 'sonar',
    icon: '📡',
    name: 'Cave Sonar',
    shortName: 'SONAR',
    hotkey: 'Q',
    certId: 'open-water',
    certName: 'Open Water',
    requirement: 'Clear 1 site',
    summary: 'Pulse [Q] for a 28m wireframe wall & relic echo sweep through darkness and silt.',
  },
  {
    id: 'dpv',
    icon: '🛴',
    name: 'DPV Scooter',
    shortName: 'DPV',
    hotkey: 'V',
    certId: 'cavern',
    certName: 'Cavern Diver',
    requirement: 'Clear 3 sites',
    summary: 'Toggle [V] for 1.8× motorized propulsion & calmer BPM — watch battery & floor silt wake.',
  },
  {
    id: 'ccr',
    icon: '🫁',
    name: 'CCR Rebreather',
    shortName: 'CCR',
    hotkey: '',
    certId: 'trimix-normoxic',
    certName: 'Normoxic Trimix',
    requirement: 'Reach 60m+',
    summary: 'Closed-circuit loop: 92% fewer bubbles, 2.6× gas endurance, zero rust rain & 20% faster deco.',
  },
];

export function computeUnlockedGear(rawBook, levels = []) {
  const certInfo = computeCertifications(rawBook, levels);
  const earnedIds = new Set(certInfo.earned.map((c) => c.id));
  const items = TECH_GEAR_CATALOG.map((g) => ({
    ...g,
    unlocked: earnedIds.has(g.certId),
  }));
  const unlockedIds = new Set(items.filter((g) => g.unlocked).map((g) => g.id));
  return { items, unlockedIds, certInfo };
}

export function sanitizeGearLoadout(rawLoadout, unlockedIds) {
  const src = rawLoadout && typeof rawLoadout === 'object' ? rawLoadout : {};
  const canUse = (id) => (unlockedIds instanceof Set ? unlockedIds.has(id) : Boolean(unlockedIds));
  return {
    sonar: Boolean(src.sonar) && canUse('sonar'),
    dpv: Boolean(src.dpv) && canUse('dpv'),
    ccr: Boolean(src.ccr) && canUse('ccr'),
  };
}

/**
 * Deterministic Worldwide Daily Expedition Challenge & Mutator Engine.
 * Uses UTC YYYY-MM-DD date keys so every diver globally plays the exact same daily dive & modifier.
 */
export const DAILY_MUTATORS = [
  {
    id: 'strobe',
    icon: '⚡',
    name: 'Lights-Out Strobe',
    badge: '⚡ STROBE',
    summary: 'Primary torch pulses in rhythmic emergency strobe flashes — time your moves & sonar sweeps!',
  },
  {
    id: 'surge',
    icon: '🌊',
    name: 'Heavy Surge',
    badge: '🌊 SURGE',
    summary: '1.75× currents & siphon surges plus rhythmic open-tunnel swells — ride the lulls!',
  },
  {
    id: 'silt-storm',
    icon: '🌫️',
    name: 'Silt-Storm',
    badge: '🌫️ SILT-STORM',
    summary: '1.75× denser floor & impact silt plumes with drifting dust — trim high off the bed!',
  },
  {
    id: 'purist',
    icon: '🧭',
    name: 'Zero-Gear Purist',
    badge: '🧭 PURIST',
    summary: 'No Tech Gear (Sonar/DPV/CCR disabled) and compass hidden — pure classic technical diving!',
  },
  {
    id: 'turbo-par',
    icon: '⏱️',
    name: 'Speedrun Par',
    badge: '⏱️ SPEEDRUN',
    summary: '1.22× swim boost with a tight 0.75× par-time target — sprint smart without blowing ascent limits!',
  },
  {
    id: 'iron-lungs',
    icon: '🫧',
    name: 'High-Pressure Burn',
    badge: '🫧 HIGH-BURN',
    summary: '1.35× gas burn under exertion — breathe calm, respect Rule of Thirds & hit stage bottles!',
  },
];

export function getDailyMutatorById(mutatorId) {
  return DAILY_MUTATORS.find((m) => m.id === mutatorId) || null;
}

export function getUtcDateKey(date = new Date()) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function prevUtcDateKey(dateKey) {
  const clean = getUtcDateKey(dateKey);
  const [y, m, d] = clean.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return getUtcDateKey(dt);
}

function hashDateKey(dateKey) {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getDailyChallenge(levels = [], dateOrKey = new Date()) {
  const dateKey = getUtcDateKey(dateOrKey);
  if (!Array.isArray(levels) || levels.length === 0) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  const dayNum = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  // Coprime stride guarantees every site rotates without consecutive-day repeats
  const n = levels.length;
  const stride = n % 7 === 0 ? 11 : 7;
  const levelIndex = (((dayNum * stride) % n) + n) % n;
  const level = levels[levelIndex];
  const mutHash = hashDateKey(`${dateKey}:mutator`);
  const mutator = DAILY_MUTATORS[mutHash % DAILY_MUTATORS.length];
  return {
    dateKey,
    level,
    levelId: level.id,
    levelIndex,
    mutator,
    mutatorId: mutator.id,
  };
}

export function recordDailyClear(rawBook, { dateKey, levelId, mutatorId, score = 0, grade = 'B', timeSec = 0 }) {
  const book = normalizeBook(rawBook);
  const cleanDate = getUtcDateKey(dateKey || new Date());
  const cleanScore = Math.max(0, Math.round(Number(score) || 0));
  const cleanTime = Math.max(0, Math.round((Number(timeSec) || 0) * 10) / 10);
  const alreadyCleared = book.daily.clearedDates.includes(cleanDate);

  if (!alreadyCleared) {
    const prevLast = book.daily.lastClearedDate || '';
    const isArchiveBackfill = Boolean(prevLast && cleanDate < prevLast);
    if (!isArchiveBackfill) {
      const yesterday = prevUtcDateKey(cleanDate);
      if (prevLast === yesterday) {
        book.daily.currentStreak += 1;
      } else if (prevLast !== cleanDate) {
        book.daily.currentStreak = 1;
      }
      book.daily.bestStreak = Math.max(book.daily.bestStreak, book.daily.currentStreak);
      book.daily.lastClearedDate = cleanDate;
    }
    book.daily.totalClears += 1;
    book.daily.clearedDates.push(cleanDate);
    book.daily.clearedDates.sort();
    if (book.daily.clearedDates.length > 366) {
      book.daily.clearedDates = book.daily.clearedDates.slice(-366);
    }
  }

  const prevRec = book.daily.records[cleanDate];
  if (!prevRec || cleanScore > prevRec.score) {
    book.daily.records[cleanDate] = {
      levelId: String(levelId || ''),
      mutatorId: String(mutatorId || ''),
      score: cleanScore,
      grade: grade || 'B',
      timeSec: cleanTime,
    };
  }
  return book;
}

export function getDailyStatus(rawBook, dateOrKey = new Date()) {
  const book = normalizeBook(rawBook);
  const dateKey = getUtcDateKey(dateOrKey);
  const yesterday = prevUtcDateKey(dateKey);
  const clearedToday = book.daily.clearedDates.includes(dateKey);
  const streakAlive = book.daily.lastClearedDate === dateKey || book.daily.lastClearedDate === yesterday;
  return {
    dateKey,
    clearedToday,
    activeStreak: streakAlive ? book.daily.currentStreak : 0,
    bestStreak: book.daily.bestStreak,
    totalClears: book.daily.totalClears,
    todayRecord: book.daily.records[dateKey] || null,
  };
}

const CALENDAR_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Deterministic Daily Mutator lookup for any UTC date key (shared by Daily Card & Calendar, v131).
 */
export function getDailyMutatorForDate(dateOrKey = new Date()) {
  const dateKey = getUtcDateKey(dateOrKey);
  const mutHash = hashDateKey(`${dateKey}:mutator`);
  return DAILY_MUTATORS[mutHash % DAILY_MUTATORS.length];
}

/**
 * Build a complete UTC calendar month matrix with per-day completion records, grades & lock states (v131).
 * @param {object} rawBook
 * @param {number} year - full year e.g. 2026
 * @param {number} month0 - 0-based month (0 = Jan .. 11 = Dec)
 * @param {Date|string} [todayOrKey]
 */
export function buildDailyCalendarMonth(rawBook, year, month0, todayOrKey = new Date()) {
  const book = normalizeBook(rawBook);
  const todayKey = getUtcDateKey(todayOrKey);
  const cleanYear = Math.max(2020, Math.min(2099, Math.trunc(Number(year) || Number(todayKey.slice(0, 4)))));
  const cleanMonth0 = Math.max(0, Math.min(11, Math.trunc(Number(month0) ?? (Number(todayKey.slice(5, 7)) - 1))));
  const firstDate = new Date(Date.UTC(cleanYear, cleanMonth0, 1));
  const firstWeekday = firstDate.getUTCDay(); // 0=Sun..6=Sat
  const daysInMonth = new Date(Date.UTC(cleanYear, cleanMonth0 + 1, 0)).getUTCDate();
  const clearedSet = new Set(book.daily.clearedDates || []);

  const days = [];
  let clearedInMonth = 0;
  let availableInMonth = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${cleanYear}-${String(cleanMonth0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateKey === todayKey;
    const isFuture = dateKey > todayKey;
    const isPast = dateKey < todayKey;
    const rec = book.daily.records?.[dateKey] || null;
    const cleared = clearedSet.has(dateKey) || Boolean(rec);
    if (!isFuture) availableInMonth += 1;
    if (cleared) clearedInMonth += 1;
    days.push({
      day: d,
      dateKey,
      isToday,
      isFuture,
      isPast,
      cleared,
      record: rec,
      grade: rec?.grade || (cleared ? '✓' : ''),
      score: rec?.score || 0,
      mutator: getDailyMutatorForDate(dateKey),
    });
  }

  return {
    year: cleanYear,
    month0: cleanMonth0,
    monthLabel: `${CALENDAR_MONTH_NAMES[cleanMonth0]} ${cleanYear}`,
    firstWeekday,
    daysInMonth,
    todayKey,
    days,
    clearedInMonth,
    availableInMonth,
  };
}

/**
 * Expedition Marine Life & Underwater Landmark Field Guide (v110).
 * Every entry maps to real live fauna, formations, or geothermal landmarks across the 30 dive sites.
 */
export const FIELD_GUIDE_CATALOG = [
  {
    id: 'shark',
    icon: '🦈',
    name: 'Pelagic Reef Shark',
    latin: 'Carcharhinus perezi',
    category: 'wildlife',
    rarity: 'rare',
    points: 130,
    habitat: 'Open ocean blue water above deep shipwrecks',
    bio: 'Patrols artificial reef superstructures along warm Gulf, Aegean, and Red Sea wrecks.',
  },
  {
    id: 'grouper',
    icon: '🐟',
    name: 'Giant Goliath Grouper',
    latin: 'Epinephelus itajara',
    category: 'wildlife',
    rarity: 'rare',
    points: 130,
    habitat: 'Dark cavernous interior holds of sunken ships',
    bio: 'Territorial 300 kg ambush predator that hovers silently inside flooded engine rooms and cargo bays.',
  },
  {
    id: 'laketrout',
    icon: '🐟',
    name: 'Abyssal Lake Trout',
    latin: 'Salvelinus namaycush',
    category: 'wildlife',
    rarity: 'rare',
    points: 130,
    habitat: 'Frigid freshwater hulls (SS Edmund Fitzgerald)',
    bio: 'Cold-water Great Lakes apex fish thriving in 4°C lightless freshwater depths.',
  },
  {
    id: 'jellyfish',
    icon: '🪼',
    name: 'Pelagic Moon Jelly',
    latin: 'Aurelia aurita',
    category: 'wildlife',
    rarity: 'uncommon',
    points: 90,
    habitat: 'Mid-water shot lines on ocean shipwrecks',
    bio: 'Translucent bioluminescent medusae drifting gracefully past decompression stops.',
  },
  {
    id: 'barracuda',
    icon: '🐠',
    name: 'Great Barracuda',
    latin: 'Sphyraena barracuda',
    category: 'wildlife',
    rarity: 'uncommon',
    points: 90,
    habitat: 'Upper wreck decks & reef baitball edges',
    bio: 'Silver torpedo hunter hovering motionless near dive-boat shot lines.',
  },
  {
    id: 'slider',
    icon: '🐢',
    name: 'Cenote Slider Turtle',
    latin: 'Trachemys venusta',
    category: 'wildlife',
    rarity: 'uncommon',
    points: 90,
    habitat: 'Sunlit karst entrance pools & springs',
    bio: 'Freshwater turtle gliding through shafts of surface daylight above limestone sinkholes.',
  },
  {
    id: 'cavefish',
    icon: '👻',
    name: 'Dama Blanca Cavefish',
    latin: 'Typhliasina pearsei',
    category: 'wildlife',
    rarity: 'rare',
    points: 130,
    habitat: 'Deep lightless cave galleries (≥32m)',
    bio: 'Eyeless translucent troglobite endemic to flooded karst caverns, navigating via lateral-line vibrations.',
  },
  {
    id: 'remipede',
    icon: '🦐',
    name: 'Blind Cave Remipede',
    latin: 'Xibalbanus tulumensis',
    category: 'wildlife',
    rarity: 'rare',
    points: 130,
    habitat: 'Saline halocline cave conduits (22–60m)',
    bio: 'Venomous living-fossil crustacean that swims upside-down through oxygen-poor halocline tunnels.',
  },
  {
    id: 'prawn',
    icon: '🦐',
    name: 'Ghost Cave Prawn',
    latin: 'Creaseria morleyi',
    category: 'wildlife',
    rarity: 'uncommon',
    points: 90,
    habitat: 'Phreatic limestone passages & shelves',
    bio: 'Albino cave shrimp with elongated antennae sweeping silty ledges for organic detritus.',
  },
  {
    id: 'catfish',
    icon: '🐟',
    name: 'Pale Twilight Catfish',
    latin: 'Rhamdia guatemalensis',
    category: 'wildlife',
    rarity: 'common',
    points: 60,
    habitat: 'Cavern twilight zones (10–24m) & freshwater wrecks',
    bio: 'Whiskered cavern-dweller sheltering beneath overhanging rock ledges at the edge of darkness.',
  },
  {
    id: 'cichlid',
    icon: '🐠',
    name: 'Cenote Cichlid & Molly',
    latin: 'Mayaheros urophthalmus',
    category: 'wildlife',
    rarity: 'common',
    points: 60,
    habitat: 'Sunlit surface basins & cenote mouths',
    bio: 'Vibrant shoaling fish darting among submerged roots and emerald sunbeams.',
  },
  {
    id: 'seafan',
    icon: '🪸',
    name: 'Gorgonian Sea Fan',
    latin: 'Gorgonia ventalina',
    category: 'landmark',
    rarity: 'common',
    points: 60,
    habitat: 'Current-swept upper steel decks on ocean wrecks',
    bio: 'Delicate branching soft-coral colonies turning sunken steel into living artificial reefs.',
  },
  {
    id: 'rusticle',
    icon: '🔩',
    name: 'Deep Hull Rusticles',
    latin: 'Halomonas titanicae',
    category: 'landmark',
    rarity: 'common',
    points: 60,
    habitat: 'Flooded steel overheads on historic shipwrecks',
    bio: 'Fragile iron-oxide stalactites spun by iron-eating bacteria — diver exhaust bubbles rain rust snow.',
  },
  {
    id: 'sodastraw',
    icon: '🪨',
    name: 'Calcite Soda Straws',
    latin: 'Submerged Speleothems',
    category: 'landmark',
    rarity: 'common',
    points: 60,
    habitat: 'Flooded limestone cavern ceilings (≥11m)',
    bio: 'Hollow dripstone needles formed in air during Ice Age low-sea-level epochs before caves flooded.',
  },
  {
    id: 'crystal',
    icon: '💎',
    name: 'Phreatic Calcite Crystal',
    latin: 'Dogtooth Spar Cluster',
    category: 'landmark',
    rarity: 'uncommon',
    points: 90,
    habitat: 'Deep mineral-saturated karst & glacial walls (≥26m)',
    bio: 'Razor-faceted calcite and quartz prisms glittering brilliantly under high-lumen primary torches.',
  },
  {
    id: 'hydrovent',
    icon: '🌋',
    name: 'Hydrothermal Vent Chimney',
    latin: 'Geothermal Mineral Plume',
    category: 'landmark',
    rarity: 'epic',
    points: 180,
    habitat: 'Icelandic tectonic rifts & subglacial fissures',
    bio: 'Towering superheated mineral chimneys venting buoyant geothermal updrafts into freezing abyssal waters.',
  },
  {
    id: 'whaleshark',
    icon: '🐋',
    name: 'Whale Shark',
    latin: 'Rhincodon typus',
    category: 'wildlife',
    rarity: 'epic',
    points: 180,
    habitat: 'Rare pelagic blue-water visitor above ocean shipwrecks',
    bio: 'Gentle 12-meter filter-feeding leviathan gliding silently across sunken decks in open ocean currents.',
  },
  {
    id: 'mantaray',
    icon: '🦅',
    name: 'Oceanic Manta Ray',
    latin: 'Mobula birostris',
    category: 'wildlife',
    rarity: 'rare',
    points: 130,
    habitat: 'Pelagic open-water flybys along shipwreck reefs',
    bio: 'Graceful giant ray soaring effortlessly on 6-meter wingspans through mid-water thermoclines.',
  },
];

const FIELD_GUIDE_BY_ID = new Map(FIELD_GUIDE_CATALOG.map((e) => [e.id, e]));

export function getFieldGuideEntry(entryId) {
  return FIELD_GUIDE_BY_ID.get(entryId) || null;
}

export function recordFieldGuidePhoto(rawBook, { entryId, stars = 1, siteId = '', siteName = '', depthM = 0 } = {}) {
  const book = normalizeBook(rawBook);
  const entry = getFieldGuideEntry(entryId);
  if (!entry) return { book, isNew: false, upgradedStars: false };
  const cleanStars = Math.max(1, Math.min(3, Math.round(Number(stars) || 1)));
  const cleanDepth = Math.max(0, Math.round((Number(depthM) || 0) * 10) / 10);
  const prev = book.fieldGuide[entry.id];
  if (!prev) {
    book.fieldGuide[entry.id] = {
      count: 1,
      bestStars: cleanStars,
      firstSiteId: String(siteId || ''),
      bestSiteName: String(siteName || ''),
      bestDepthM: cleanDepth,
    };
    return { book, isNew: true, upgradedStars: false };
  }
  prev.count += 1;
  let upgradedStars = false;
  if (cleanStars > prev.bestStars) {
    prev.bestStars = cleanStars;
    upgradedStars = true;
    if (siteName) prev.bestSiteName = String(siteName);
  }
  if (cleanDepth > prev.bestDepthM) {
    prev.bestDepthM = cleanDepth;
  }
  return { book, isNew: false, upgradedStars };
}

export function getFieldGuideStats(rawBook) {
  const book = normalizeBook(rawBook);
  const entries = FIELD_GUIDE_CATALOG.map((entry) => {
    const rec = book.fieldGuide[entry.id] || null;
    return {
      ...entry,
      discovered: Boolean(rec),
      count: rec?.count || 0,
      bestStars: rec?.bestStars || 0,
      firstSiteId: rec?.firstSiteId || '',
      bestSiteName: rec?.bestSiteName || '',
      bestDepthM: rec?.bestDepthM || 0,
    };
  });
  const discoveredCount = entries.filter((e) => e.discovered).length;
  const totalCount = entries.length;
  const pct = totalCount > 0 ? Math.round((discoveredCount / totalCount) * 100) : 0;
  const goldCount = entries.filter((e) => e.bestStars >= 3).length;
  const totalPhotos = entries.reduce((sum, e) => sum + (e.count || 0), 0);
  const rareEntries = entries.filter((e) => e.rarity === 'rare' || e.rarity === 'epic');
  const rareTotal = rareEntries.length;
  const rareDiscovered = rareEntries.filter((e) => e.discovered).length;
  const naturalistRank =
    discoveredCount >= totalCount && goldCount >= Math.ceil(totalCount * 0.5)
      ? '🏆 Master Marine Photographer'
      : discoveredCount >= 12 || rareDiscovered >= 5
        ? '🐋 Pelagic Naturalist'
        : discoveredCount >= 5
          ? '📷 Reef Observer'
          : '🔍 Field Spotter';
  return {
    discoveredCount,
    totalCount,
    pct,
    goldCount,
    totalPhotos,
    rareDiscovered,
    rareTotal,
    naturalistRank,
    entries,
  };
}

function csvEscape(val) {
  const s = val == null ? '' : String(val);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Export the player's career dive logbook across all expeditions as an RFC-4180 CSV string.
 */
export function exportLogbookToCsv(rawBook, levels = []) {
  const book = normalizeBook(rawBook);
  const summary = formatLogbookSummary(book, Math.max(1, (levels || []).length || 30));
  const fg = getFieldGuideStats(book);
  const headers = [
    'Site ID',
    'Expedition',
    'Location',
    'Category',
    'Max Depth (m)',
    'Status',
    'Best Grade',
    'Best Score',
    'Best Time (s)',
    'Clears',
    'Best Difficulty',
  ];
  const rows = [headers.map(csvEscape).join(',')];
  const listedIds = new Set();

  for (const lvl of levels || []) {
    if (!lvl?.id) continue;
    listedIds.add(lvl.id);
    const rec = book.cleared[lvl.id] || null;
    rows.push(
      [
        lvl.id,
        lvl.name || lvl.id,
        lvl.location || '',
        lvl.isWreck ? 'Shipwreck' : 'Cave',
        lvl.maxDepthM ?? '',
        rec ? 'CLEARED' : 'UNEXPLORED',
        rec?.grade || '',
        rec ? rec.score : '',
        rec && rec.bestTimeSec > 0 ? rec.bestTimeSec.toFixed(1) : '',
        rec ? rec.clears : 0,
        rec?.bestDifficulty || '',
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  for (const [lid, rec] of Object.entries(book.cleared)) {
    if (listedIds.has(lid) || !rec) continue;
    rows.push(
      [
        lid,
        lid,
        '',
        'Expedition',
        '',
        'CLEARED',
        rec.grade || '',
        rec.score ?? '',
        rec.bestTimeSec > 0 ? rec.bestTimeSec.toFixed(1) : '',
        rec.clears ?? 1,
        rec.bestDifficulty || '',
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  rows.push('');
  rows.push(
    [
      'CAREER SUMMARY',
      summary.campaignMedal,
      `Sites ${summary.clearedCount}/${summary.totalSites}`,
      `Total Dives: ${summary.totalDives}`,
      `Deepest: ${summary.deepestM}m`,
      `Total Bottom Time: ${Math.round(summary.totalTimeSec)}s`,
      `Best Score: ${summary.bestScore}`,
      `Daily Streak: ${book.daily?.currentStreak || 0} (Best ${book.daily?.bestStreak || 0})`,
      `Field Guide: ${fg.discoveredCount}/${fg.totalCount} (${fg.naturalistRank})`,
      '',
      '',
    ]
      .map(csvEscape)
      .join(',')
  );

  return rows.join('\r\n');
}

/**
 * Export a rich, structured JSON snapshot of the player's career dive logbook, certifications, and field guide.
 */
export function exportLogbookToJson(rawBook, levels = [], meta = {}) {
  const book = normalizeBook(rawBook);
  const summary = formatLogbookSummary(book, Math.max(1, (levels || []).length || 30));
  const certs = computeCertifications(book, levels);
  const fieldGuide = getFieldGuideStats(book);
  const sites = (levels || []).map((lvl) => {
    const rec = book.cleared[lvl.id] || null;
    return {
      id: lvl.id,
      name: lvl.name || lvl.id,
      location: lvl.location || '',
      category: lvl.isWreck ? 'shipwreck' : 'cave',
      maxDepthM: lvl.maxDepthM ?? null,
      cleared: Boolean(rec),
      record: rec ? { ...rec } : null,
    };
  });

  return JSON.stringify(
    {
      schema: 'techno-dive-logbook-v1',
      exportedAt: new Date().toISOString(),
      diverName: meta.diverName || 'Diver',
      githubLogin: meta.githubLogin || '',
      version: meta.version || '',
      summary,
      daily: {
        currentStreak: book.daily?.currentStreak || 0,
        bestStreak: book.daily?.bestStreak || 0,
        totalClears: book.daily?.totalClears || 0,
        lastClearedDate: book.daily?.lastClearedDate || '',
        clearedDates: Array.isArray(book.daily?.clearedDates) ? [...book.daily.clearedDates] : [],
        records: book.daily?.records ? { ...book.daily.records } : {},
      },
      certifications: {
        earnedCount: certs.earnedCount,
        total: certs.total,
        highestTitle: certs.highestTitle,
        earned: certs.certs.filter((c) => c.earned).map((c) => c.id),
      },
      fieldGuide: {
        discoveredCount: fieldGuide.discoveredCount,
        totalCount: fieldGuide.totalCount,
        goldCount: fieldGuide.goldCount,
        totalPhotos: fieldGuide.totalPhotos,
        naturalistRank: fieldGuide.naturalistRank,
        entries: book.fieldGuide,
      },
      sites,
    },
    null,
    2
  );
}

/**
 * Parse and validate an exported JSON logbook backup (`techno-dive-logbook-v1`)
 * or raw career logbook object into a canonical normalized CareerLogbook ready for smart-merge.
 */
export function parseImportedLogbookJson(rawInput) {
  let data = rawInput;
  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (!trimmed) return { ok: false, error: 'Empty JSON file.' };
    if (trimmed.length > 2_000_000) return { ok: false, error: 'Backup file exceeds 2 MB limit.' };
    try {
      data = JSON.parse(trimmed);
    } catch {
      return { ok: false, error: 'Invalid JSON syntax.' };
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'JSON backup must be an object.' };
  }

  let candidate = null;
  if (data.schema === 'techno-dive-logbook-v1' || Array.isArray(data.sites)) {
    const cleared = {};
    if (Array.isArray(data.sites)) {
      for (const s of data.sites) {
        if (!s || typeof s.id !== 'string' || !s.cleared || !s.record || typeof s.record !== 'object') continue;
        cleared[s.id] = { ...s.record };
      }
    }
    const sum = data.summary && typeof data.summary === 'object' ? data.summary : {};
    const daily = data.daily && typeof data.daily === 'object' ? data.daily : {};
    const fgEntries =
      data.fieldGuide && typeof data.fieldGuide.entries === 'object' ? data.fieldGuide.entries : {};
    candidate = {
      cleared,
      totalDives: sum.totalDives ?? Object.keys(cleared).length,
      totalTimeSec: sum.totalTimeSec ?? 0,
      deepestM: sum.deepestM ?? 0,
      bestScore: sum.bestScore ?? 0,
      daily: {
        currentStreak: daily.currentStreak ?? 0,
        bestStreak: daily.bestStreak ?? 0,
        totalClears: daily.totalClears ?? (Array.isArray(daily.clearedDates) ? daily.clearedDates.length : 0),
        lastClearedDate: daily.lastClearedDate || daily.lastDailyDate || '',
        clearedDates: Array.isArray(daily.clearedDates) ? daily.clearedDates : [],
        records: daily.records && typeof daily.records === 'object' ? daily.records : {},
      },
      fieldGuide: fgEntries,
    };
  } else if (data.cleared && typeof data.cleared === 'object' && !Array.isArray(data.cleared)) {
    candidate = data;
  } else if (data.logbook && typeof data.logbook === 'object') {
    candidate = data.logbook;
  } else {
    return { ok: false, error: 'Unrecognized Techno Dive logbook backup format.' };
  }

  const book = normalizeBook(candidate);
  const siteCount = Object.keys(book.cleared).length;
  const fieldGuideCount = Object.keys(book.fieldGuide).length;
  const dailyCount = Math.max(book.daily.totalClears || 0, book.daily.clearedDates.length);
  if (siteCount === 0 && fieldGuideCount === 0 && dailyCount === 0 && book.totalDives === 0) {
    return { ok: false, error: 'Backup contains no dive records to import.' };
  }

  return {
    ok: true,
    book,
    siteCount,
    fieldGuideCount,
    dailyCount,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    diverName: typeof data.diverName === 'string' ? data.diverName : '',
  };
}
