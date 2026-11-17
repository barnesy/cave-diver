import { DEFAULT_LEVEL_ID, isValidLevelId } from '../public/js/levels/index.js';
import {
  CORS_HEADERS,
  jsonResponse,
  readBlobJson,
  mutateBlobJson,
} from './_blobJson.js';

const ROOMS_BLOB_PATH = 'rooms/active-v1.json';
const ROOM_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

function cleanCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

function pruneExpiredRooms(map, now = Date.now()) {
  const out = {};
  for (const [k, rec] of Object.entries(map || {})) {
    if (!rec || typeof rec !== 'object') continue;
    if (now - (rec.updatedAt || 0) <= ROOM_TTL_MS && Array.isArray(rec.players) && rec.players.length > 0) {
      out[k] = rec;
    }
  }
  return out;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const code = cleanCode(url.searchParams.get('code'));
    const { data } = await readBlobJson(ROOMS_BLOB_PATH, {});
    const active = pruneExpiredRooms(data);

    if (code) {
      const rec = active[code] || null;
      if (!rec) {
        return jsonResponse({ ok: false, error: `Room "${code}" not found or expired.` }, 404);
      }
      return jsonResponse({ ok: true, room: rec.room, snapshot: rec.snapshot });
    }

    const list = Object.values(active)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 20)
      .map((rec) => {
        const host = rec.players.find((p) => p.isHost) || rec.players[0];
        return {
          code: rec.code,
          levelId: rec.levelId,
          started: Boolean(rec.started),
          playerCount: rec.players.length,
          maxPlayers: rec.maxPlayers || 2,
          hostName: host?.name || 'Diver 1',
          updatedAt: rec.updatedAt,
        };
      });
    return jsonResponse({ ok: true, rooms: list });
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Failed to read rooms.' }, 500);
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const action = String(body?.action || 'sync');
  const code = cleanCode(body?.code || body?.room?.code);
  if (!code) {
    return jsonResponse({ error: 'Valid room code required.' }, 400);
  }

  try {
    let resultPayload = { ok: true, code };
    await mutateBlobJson(
      ROOMS_BLOB_PATH,
      () => ({}),
      (rawMap) => {
        const map = pruneExpiredRooms(rawMap);
        const now = Date.now();

        if (action === 'close') {
          delete map[code];
          return map;
        }

        if (action === 'leave') {
          const existing = map[code];
          if (!existing) return map;
          const pid = String(body.playerId || '');
          const remaining = (existing.players || []).filter((p) => p.id !== pid);
          if (remaining.length === 0) {
            delete map[code];
            return map;
          }
          if (!remaining.some((p) => p.isHost)) {
            remaining[0].isHost = true;
          }
          existing.players = remaining;
          if (existing.room) existing.room.players = remaining;
          if (existing.snapshot?.room) existing.snapshot.room.players = remaining;
          if (existing.snapshot?.players) existing.snapshot.players = remaining;
          existing.updatedAt = now;
          resultPayload = { ok: true, room: existing.room, snapshot: existing.snapshot };
          return map;
        }

        if (action === 'join') {
          const existing = map[code];
          if (!existing) {
            resultPayload = null;
            return map;
          }
          resultPayload = { ok: true, room: existing.room, snapshot: existing.snapshot };
          return map;
        }

        // 'sync': host creates or updates room + snapshot metadata cleanly
        const r = body.room || {};
        const players = Array.isArray(r.players)
          ? r.players.slice(0, 4).map((p, i) => ({
              id: String(p?.id || `p${i + 1}`).slice(0, 48),
              name: String(p?.name || `Diver ${i + 1}`).slice(0, 18),
              isHost: Boolean(p?.isHost),
              ready: p?.ready !== false,
              connected: p?.connected !== false,
              loadStatus: p?.loadStatus || 'ready',
              loadPct: Number.isFinite(p?.loadPct) ? p.loadPct : 100,
              loadedLevelId: p?.loadedLevelId || DEFAULT_LEVEL_ID,
              joinSeq: Number.isFinite(p?.joinSeq) ? p.joinSeq : i + 1,
            }))
          : [];
        if (players.length === 0) {
          delete map[code];
          return map;
        }
        const levelId = isValidLevelId(r.levelId) ? r.levelId : DEFAULT_LEVEL_ID;
        const maxPlayers = Math.max(2, Math.min(4, Number(r.maxPlayers) || 2));
        const roomClean = {
          code,
          levelId,
          maxPlayers,
          started: Boolean(r.started),
          phase: r.phase || (r.started ? 'diving' : 'lobby'),
          diveSeq: Number(r.diveSeq) || 0,
          players,
        };
        map[code] = {
          code,
          levelId,
          maxPlayers,
          started: roomClean.started,
          players,
          room: roomClean,
          snapshot: body.snapshot || null,
          updatedAt: now,
        };
        resultPayload = { ok: true, room: roomClean };
        return map;
      }
    );

    if (!resultPayload) {
      return jsonResponse({ ok: false, error: `Room "${code}" not found or expired.` }, 404);
    }
    return jsonResponse(resultPayload);
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Failed to update cloud room.' }, 500);
  }
}
