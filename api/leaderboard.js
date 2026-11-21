import {
  mergeLeaderboardEntries,
  normalizeLeaderboardSubmission,
  pruneLeaderboardEntries,
  queryLeaderboardEntries,
} from '../public/js/game/leaderboardModel.js';
import {
  CORS_HEADERS,
  NO_BLOB_MUTATION,
  jsonResponse,
  mutateBlobJson,
  readBlobJson,
  writeBlobJson,
} from './_blobJson.js';
import {
  SESSION_COOKIE_NAME,
  decryptSessionPayload,
  getGitHubConfig,
  parseCookies,
} from './_githubAuth.js';

const LEADERBOARD_BLOB_PATH = 'leaderboard/entries-v1.json';
const LEADERBOARD_BACKUP_PATH = 'leaderboard/backup-v1.json';

function readVerifiedGitHubUser(request) {
  try {
    const cfg = getGitHubConfig(process.env);
    if (!cfg.configured) return null;
    const cookies = parseCookies(request.headers.get('cookie') || '');
    const raw = cookies[SESSION_COOKIE_NAME];
    if (!raw) return null;
    const sess = decryptSessionPayload(raw, cfg);
    if (!sess?.user?.login) return null;
    return {
      login: sess.user.login,
      avatarUrl: sess.user.avatarUrl || '',
      name: sess.user.name || sess.user.login,
    };
  } catch {
    return null;
  }
}

async function readAllWithBackupFallback() {
  let primaryErr = null;
  let primaryNotFound = false;
  try {
    const primary = await readBlobJson(LEADERBOARD_BLOB_PATH, []);
    if (!primary.notFound && Array.isArray(primary.data)) {
      return primary.data;
    }
    primaryNotFound = Boolean(primary.notFound);
  } catch (err) {
    primaryErr = err;
    // Fall through to backup mirror
  }
  try {
    const backup = await readBlobJson(LEADERBOARD_BACKUP_PATH, []);
    if (!backup.notFound && Array.isArray(backup.data)) {
      return backup.data;
    }
    return [];
  } catch (backupErr) {
    if (primaryErr && !primaryNotFound) {
      throw primaryErr;
    }
    if (backupErr && !primaryNotFound) {
      throw backupErr;
    }
    return [];
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const rawMode = url.searchParams.get('mode');
    const mode = rawMode === 'team' ? 'team' : rawMode === 'daily' ? 'daily' : 'solo';
    const level = url.searchParams.get('level') || 'overall';
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit')) || 20));

    const allEntries = await readAllWithBackupFallback();
    const entries = queryLeaderboardEntries(allEntries, { mode, levelId: level, limit });
    return jsonResponse({ mode, levelId: level, entries });
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Failed to read leaderboard.' }, 500);
  }
}

export async function POST(request) {
  let raw;
  try {
    const text = await request.text();
    if (text.length > 131072) {
      return jsonResponse({ error: 'Payload too large.' }, 413);
    }
    raw = JSON.parse(text);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const verifiedGitHubUser = readVerifiedGitHubUser(request);

  const isBatch = Array.isArray(raw?.entries);
  if (isBatch) {
    if (raw.entries.length === 0 || raw.entries.length > 50) {
      return jsonResponse({ error: 'Batch entries must contain 1..50 submissions.' }, 400);
    }
    const validEntries = [];
    for (const item of raw.entries) {
      const parsed = normalizeLeaderboardSubmission(item, { verifiedGitHubUser });
      if (!parsed.ok) {
        return jsonResponse({ error: parsed.error }, 400);
      }
      validEntries.push(parsed.entry);
    }

    try {
      let didWrite = false;
      let backupSeed = null;
      const allEntries = await mutateBlobJson(
        LEADERBOARD_BLOB_PATH,
        () => [],
        async (list, { notFound }) => {
          let base = Array.isArray(list) ? list : [];
          if (notFound) {
            if (!backupSeed) {
              const bk = await readBlobJson(LEADERBOARD_BACKUP_PATH, []).catch(() => ({ data: [] }));
              backupSeed = Array.isArray(bk.data) ? bk.data : [];
            }
            base = backupSeed;
          }
          const { entries, changed } = mergeLeaderboardEntries(base, validEntries);
          if (!changed && !notFound) return NO_BLOB_MUTATION;
          didWrite = true;
          return pruneLeaderboardEntries(entries);
        }
      );
      if (didWrite && Array.isArray(allEntries) && allEntries.length > 0) {
        await writeBlobJson(LEADERBOARD_BACKUP_PATH, allEntries).catch(() => {});
      }
      return jsonResponse({ ok: true, count: validEntries.length, synced: didWrite });
    } catch (err) {
      return jsonResponse({ error: err?.message || 'Failed to sync leaderboard batch.' }, 500);
    }
  }

  const parsed = normalizeLeaderboardSubmission(raw, { verifiedGitHubUser });
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, 400);
  }

  try {
    const entry = parsed.entry;
    let didWrite = false;
    let backupSeed = null;
    const allEntries = await mutateBlobJson(
      LEADERBOARD_BLOB_PATH,
      () => [],
      async (list, { notFound }) => {
        let base = Array.isArray(list) ? list : [];
        if (notFound) {
          if (!backupSeed) {
            const bk = await readBlobJson(LEADERBOARD_BACKUP_PATH, []).catch(() => ({ data: [] }));
            backupSeed = Array.isArray(bk.data) ? bk.data : [];
          }
          base = backupSeed;
        }
        const { entries, changed } = mergeLeaderboardEntries(base, [entry]);
        if (!changed && !notFound) return NO_BLOB_MUTATION;
        didWrite = true;
        return pruneLeaderboardEntries(entries);
      }
    );

    if (didWrite && Array.isArray(allEntries) && allEntries.length > 0) {
      await writeBlobJson(LEADERBOARD_BACKUP_PATH, allEntries).catch(() => {});
    }

    const boardAll = queryLeaderboardEntries(allEntries, {
      mode: entry.mode,
      levelId: entry.mode === 'daily' ? entry.dailyDateKey : entry.levelId,
      limit: 500,
    });
    const idx = boardAll.findIndex((e) => e.entryKey === entry.entryKey);
    const rank = idx >= 0 ? idx + 1 : boardAll.length + 1;
    return jsonResponse({
      ok: true,
      entry,
      rank,
      total: boardAll.length,
      entries: boardAll.slice(0, 20),
    });
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Failed to save leaderboard entry.' }, 500);
  }
}
