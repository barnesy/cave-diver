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
  return base;
}

export function recordDiveInLogbook(
  rawBook,
  { levelId, success, score = 0, grade = 'C', maxDepthM = 0, diveTimeSec = 0, difficulty = 'standard' }
) {
  const book = normalizeBook(rawBook);
  book.totalDives += 1;
  book.totalTimeSec = Math.round((book.totalTimeSec + Math.max(0, Number(diveTimeSec) || 0)) * 10) / 10;

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
    const yesterday = prevUtcDateKey(cleanDate);
    if (book.daily.lastClearedDate === yesterday) {
      book.daily.currentStreak += 1;
    } else if (book.daily.lastClearedDate !== cleanDate) {
      book.daily.currentStreak = 1;
    }
    book.daily.bestStreak = Math.max(book.daily.bestStreak, book.daily.currentStreak);
    book.daily.totalClears += 1;
    book.daily.lastClearedDate = cleanDate;
    book.daily.clearedDates.push(cleanDate);
    if (book.daily.clearedDates.length > 90) {
      book.daily.clearedDates = book.daily.clearedDates.slice(-90);
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
