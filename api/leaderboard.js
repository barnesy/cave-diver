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

const LEADERBOARD_BLOB_PATH = 'leaderboard/entries-v1.json';
const LEADERBOARD_BACKUP_PATH = 'leaderboard/backup-v1.json';

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
    const mode = url.searchParams.get('mode') === 'team' ? 'team' : 'solo';
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
    raw = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const isBatch = Array.isArray(raw?.entries);
  if (isBatch) {
    if (raw.entries.length === 0 || raw.entries.length > 25) {
      return jsonResponse({ error: 'Batch entries must contain 1..25 submissions.' }, 400);
    }
    const validEntries = [];
    for (const item of raw.entries) {
      const parsed = normalizeLeaderboardSubmission(item);
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

  const parsed = normalizeLeaderboardSubmission(raw);
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
      levelId: entry.levelId,
      limit: 50,
    });
    const rank = boardAll.findIndex((e) => e.entryKey === entry.entryKey) + 1;
    return jsonResponse({
      ok: true,
      entry,
      rank: rank > 0 ? rank : 1,
      total: boardAll.length,
      entries: boardAll.slice(0, 20),
    });
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Failed to save leaderboard entry.' }, 500);
  }
}
