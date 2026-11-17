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

export function formatLogbookSummary(rawBook, totalSites = 13) {
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
