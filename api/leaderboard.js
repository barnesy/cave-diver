import {
  normalizeLeaderboardSubmission,
  queryLeaderboardEntries,
  sortLeaderboardEntries,
} from '../public/js/game/leaderboardModel.js';
import {
  CORS_HEADERS,
  jsonResponse,
  readBlobJson,
  mutateBlobJson,
} from './_blobJson.js';

const LEADERBOARD_BLOB_PATH = 'leaderboard/entries-v1.json';

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') === 'team' ? 'team' : 'solo';
    const level = url.searchParams.get('level') || 'overall';
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit')) || 20));

    const { data } = await readBlobJson(LEADERBOARD_BLOB_PATH, []);
    const allEntries = Array.isArray(data) ? data : [];
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

  const parsed = normalizeLeaderboardSubmission(raw);
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, 400);
  }

  try {
    const entry = parsed.entry;
    const allEntries = await mutateBlobJson(
      LEADERBOARD_BLOB_PATH,
      () => [],
      (list) => {
        const items = Array.isArray(list) ? list : [];
        const idx = items.findIndex(
          (item) => item.mode === entry.mode && item.entryKey === entry.entryKey
        );
        if (idx >= 0) {
          if (sortLeaderboardEntries(entry, items[idx]) < 0) {
            items[idx] = entry;
          }
        } else {
          items.push(entry);
        }
        // Keep generous sorted archive safely inside single JSON blob limits
        if (items.length > 2000) {
          items.sort(sortLeaderboardEntries);
          items.length = 2000;
        }
        return items;
      }
    );

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
