/**
 * Shareable Custom Challenge Links & Mutator Sandbox URL codec.
 * Pure ES module shared between browser UI and Node unit tests.
 */

const VALID_DIFFS = new Set(['guided', 'standard', 'hardcore']);

function sanitizeShortText(raw, maxLen = 16) {
  return String(raw || '')
    .replace(/[\r\n\t<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Encode a custom expedition sandbox / head-to-head challenge configuration into a shareable URL.
 */
export function buildChallengeUrl(baseUrl, config = {}) {
  const originBase = baseUrl || 'https://cave-diver.vercel.app/';
  const url = new URL(originBase);
  url.search = '';
  url.hash = '';

  const p = url.searchParams;
  p.set('challenge', '1');
  if (config.siteId) p.set('site', String(config.siteId).trim());
  const diff = VALID_DIFFS.has(config.difficulty) ? config.difficulty : 'standard';
  if (diff !== 'standard') p.set('diff', diff);
  if (config.mutatorId) p.set('mut', String(config.mutatorId).trim());
  if (config.customGas && Number.isFinite(Number(config.o2Pct))) {
    const o2 = Math.max(8, Math.min(40, Math.round(Number(config.o2Pct))));
    const maxHe = Math.min(75, Math.max(0, 95 - o2));
    const he = Math.max(0, Math.min(maxHe, Math.round(Number(config.hePct) || 0)));
    p.set('o2', String(o2));
    p.set('he', String(he));
  }
  if (config.drillsEnabled) p.set('drills', '1');
  const by = sanitizeShortText(config.challengerName || config.by, 16);
  if (by) p.set('by', by);
  const target = Math.max(0, Math.min(99999, Math.round(Number(config.targetScore) || 0)));
  if (target > 0) p.set('target', String(target));

  return url.toString();
}

/**
 * Parse and strictly validate a `?challenge=1...` query string into a normalized challenge object.
 * Returns null if no valid challenge is present.
 */
export function parseChallengeFromSearch(
  searchStr,
  { validLevelIds = null, validMutatorIds = null } = {}
) {
  const raw = String(searchStr || '').trim();
  if (!raw) return null;
  const query = raw.startsWith('?') ? raw.slice(1) : raw.includes('?') ? raw.split('?')[1] : raw;
  const p = new URLSearchParams(query);

  const hasChallengeFlag = p.get('challenge') === '1' || p.get('challenge') === 'true';
  const siteRaw = String(p.get('site') || '').trim();
  const hasModifier = Boolean(p.get('mut') || p.get('diff') || p.get('o2') || p.get('drills') || p.get('target'));
  if (!hasChallengeFlag && !(siteRaw && hasModifier)) return null;

  const levelSet =
    validLevelIds instanceof Set
      ? validLevelIds
      : Array.isArray(validLevelIds)
        ? new Set(validLevelIds)
        : null;
  const siteId = siteRaw && (!levelSet || levelSet.has(siteRaw)) ? siteRaw : '';
  if (!siteId) return null;

  const diffRaw = String(p.get('diff') || 'standard').trim().toLowerCase();
  const difficulty = VALID_DIFFS.has(diffRaw) ? diffRaw : 'standard';

  const mutSet =
    validMutatorIds instanceof Set
      ? validMutatorIds
      : Array.isArray(validMutatorIds)
        ? new Set(validMutatorIds)
        : null;
  const mutRaw = String(p.get('mut') || '').trim();
  const mutatorId = mutRaw && (!mutSet || mutSet.has(mutRaw)) ? mutRaw : '';

  const hasO2 = p.has('o2') && p.get('o2') !== '';
  let customGas = false;
  let o2Pct = 18;
  let hePct = 45;
  if (hasO2) {
    const parsedO2 = Number(p.get('o2'));
    const parsedHe = Number(p.get('he') || 0);
    if (Number.isFinite(parsedO2)) {
      customGas = true;
      o2Pct = Math.max(8, Math.min(40, Math.round(parsedO2)));
      const maxHe = Math.min(75, Math.max(0, 95 - o2Pct));
      hePct = Math.max(0, Math.min(maxHe, Math.round(Number.isFinite(parsedHe) ? parsedHe : 0)));
    }
  }

  const drillsEnabled = p.get('drills') === '1' || p.get('drills') === 'true';
  const challengerName = sanitizeShortText(p.get('by') || '', 16);
  const targetScore = Math.max(0, Math.min(99999, Math.round(Number(p.get('target')) || 0)));

  return {
    siteId,
    difficulty,
    mutatorId,
    customGas,
    o2Pct,
    hePct,
    drillsEnabled,
    challengerName,
    targetScore,
  };
}

/**
 * Format compact modifier tags & shareable invite text for a challenge configuration.
 */
export function formatChallengeSummary(ch, { levelName = 'Expedition', mutator = null } = {}) {
  if (!ch) return { tags: [], shareText: '' };
  const tags = [];
  if (ch.difficulty === 'hardcore') tags.push('🔥 Hardcore');
  else if (ch.difficulty === 'guided') tags.push('🧭 Guided');
  else tags.push('🤿 Tech');

  if (mutator) tags.push(`${mutator.icon} ${mutator.shortName}`);
  if (ch.customGas) {
    tags.push(ch.hePct > 0 ? `🧪 TMX ${ch.o2Pct}/${ch.hePct}` : `🧪 EAN${ch.o2Pct}`);
  }
  if (ch.drillsEnabled) tags.push('⚡ Failure Drills');
  if (ch.targetScore > 0) tags.push(`🎯 Beat ${ch.targetScore.toLocaleString()} pts`);

  const who = ch.challengerName ? `${ch.challengerName} challenged you on` : 'Techno Dive Challenge:';
  const shareText = `${who} ${levelName} (${tags.join(' · ')})`;
  return { tags, shareText };
}

/**
 * Evaluate a finished dive run against an active incoming friend challenge.
 */
export function evaluateChallengeResult(ch, { success = false, score = 0 } = {}) {
  if (!ch) return null;
  const cleanScore = Math.max(0, Math.round(Number(score) || 0));
  const target = Math.max(0, Math.round(Number(ch.targetScore) || 0));
  const who = ch.challengerName || 'the Challenger';

  if (!success) {
    return {
      won: false,
      margin: target > 0 ? -target : 0,
      headline: `💀 CHALLENGE FAILED — ${who}'s expedition claimed you!`,
    };
  }
  if (target <= 0) {
    return {
      won: true,
      margin: cleanScore,
      headline: `🏆 CHALLENGE CLEARED! (${cleanScore.toLocaleString()} pts)`,
    };
  }
  const margin = cleanScore - target;
  if (margin > 0) {
    return {
      won: true,
      margin,
      headline: `🏆 BEAT ${who.toUpperCase()} BY +${margin.toLocaleString()} PTS!`,
    };
  }
  if (margin === 0) {
    return {
      won: true,
      margin: 0,
      headline: `🤝 TIED ${who.toUpperCase()}'S ${target.toLocaleString()} PT RECORD!`,
    };
  }
  return {
    won: false,
    margin,
    headline: `🎯 ${Math.abs(margin).toLocaleString()} PTS SHORT OF ${who.toUpperCase()}'S ${target.toLocaleString()} PT TARGET`,
  };
}
