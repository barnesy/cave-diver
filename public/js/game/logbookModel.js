/**
 * Persistent Career Diver Logbook & Campaign Medal Tracker.
 * Pure helpers shared cleanly between browser UI and Node tests.
 */

const GRADE_RANK = { 'S+': 6, S: 5, A: 4, B: 3, C: 2, DNF: 1 };

export function createEmptyLogbook() {
  return {
    totalDives: 0,
    totalTimeSec: 0,
    deepestM: 0,
    bestScore: 0,
    cleared: {}, // levelId -> { score, grade, bestTimeSec, clears }
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
      base.cleared[lid] = {
        score: Math.max(0, Math.round(Number(rec.score) || 0)),
        grade: typeof rec.grade === 'string' ? rec.grade : 'B',
        bestTimeSec: Math.max(0, Number(rec.bestTimeSec) || 0),
        clears: Math.max(1, Math.round(Number(rec.clears) || 1)),
      };
    }
  }
  return base;
}

export function recordDiveInLogbook(rawBook, { levelId, success, score = 0, grade = 'C', maxDepthM = 0, diveTimeSec = 0 }) {
  const book = normalizeBook(rawBook);
  book.totalDives += 1;
  book.totalTimeSec = Math.round((book.totalTimeSec + Math.max(0, Number(diveTimeSec) || 0)) * 10) / 10;
  book.deepestM = Math.max(book.deepestM, Math.round((Number(maxDepthM) || 0) * 10) / 10);

  if (success && levelId) {
    const cleanScore = Math.max(0, Math.round(Number(score) || 0));
    const cleanTime = Math.max(0, Math.round((Number(diveTimeSec) || 0) * 10) / 10);
    if (cleanScore > book.bestScore) book.bestScore = cleanScore;
    const prev = book.cleared[levelId];
    if (!prev) {
      book.cleared[levelId] = {
        score: cleanScore,
        grade: grade || 'B',
        bestTimeSec: cleanTime,
        clears: 1,
      };
    } else {
      prev.clears += 1;
      if (cleanScore > prev.score) prev.score = cleanScore;
      if ((GRADE_RANK[grade] || 0) > (GRADE_RANK[prev.grade] || 0)) prev.grade = grade;
      if (cleanTime > 0 && (prev.bestTimeSec <= 0 || cleanTime < prev.bestTimeSec)) {
        prev.bestTimeSec = cleanTime;
      }
    }
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
    if (s > book.bestScore) book.bestScore = s;
    if (!prev) {
      book.cleared[e.levelId] = {
        score: s,
        grade: e.grade || 'B',
        bestTimeSec: Math.round((Number(e.timeSec) || 0) * 10) / 10,
        clears: 1,
      };
      book.totalDives = Math.max(book.totalDives, Object.keys(book.cleared).length);
    } else {
      if (s > prev.score) prev.score = s;
      if ((GRADE_RANK[e.grade] || 0) > (GRADE_RANK[prev.grade] || 0)) prev.grade = e.grade;
    }
  }
  return book;
}

export function formatLogbookSummary(rawBook, totalSites = 25) {
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
    if (lvl?.isWreck || lid.includes('oriskany') || lid.includes('andrea-doria') || lid.includes('britannic') || lid.includes('victoria') || lid.includes('fitzgerald')) {
      wrecksCleared++;
    }
    if (lvl && !lvl.lined) unlinedCleared++;
  }

  const certs = [
    {
      id: 'open-water',
      icon: '🤿',
      title: 'Open Water',
      requirement: 'Clear 1 expedition',
      earned: clearedCount >= 1,
    },
    {
      id: 'cavern',
      icon: '🕳️',
      title: 'Cavern Diver',
      requirement: 'Clear 3 sites',
      earned: clearedCount >= 3,
    },
    {
      id: 'trimix-normoxic',
      icon: '🧪',
      title: 'Normoxic Trimix',
      requirement: 'Reach 60m+ depth',
      earned: book.deepestM >= 60,
    },
    {
      id: 'full-cave',
      icon: '🔦',
      title: 'Full Cave',
      requirement: 'Clear 6 sites (incl. unlined reel)',
      earned: clearedCount >= 6 && (unlinedCleared >= 1 || levels.length === 0),
    },
    {
      id: 'wreck-penetration',
      icon: '🚢',
      title: 'Wreck Penetration',
      requirement: 'Clear 2 shipwrecks',
      earned: wrecksCleared >= 2,
    },
    {
      id: 'hypoxic-120',
      icon: '🌊',
      title: 'Hypoxic 120m',
      requirement: 'Reach 120m+ depth',
      earned: book.deepestM >= 120,
    },
    {
      id: 'master-explorer',
      icon: '🧭',
      title: 'Master Explorer',
      requirement: 'Clear 15+ sites & 5+ S-ranks',
      earned: clearedCount >= 15 && sGrades >= 5,
    },
  ];

  const earned = certs.filter((c) => c.earned);
  const next = certs.find((c) => !c.earned) || null;
  const highest = earned.length > 0 ? earned[earned.length - 1] : null;
  return { certs, earned, highest, next, wrecksCleared, sGrades };
}
