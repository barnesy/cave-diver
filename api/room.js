import { DEFAULT_LEVEL_ID, isValidLevelId } from '../public/js/levels/index.js';
import {
  CORS_HEADERS,
  jsonResponse,
  readBlobJson,
  writeBlobJson,
  deleteBlobPath,
  listBlobPaths,
} from './_blobJson.js';

const ROOMS_PREFIX = 'rooms/';
const ROOM_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

function cleanCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

function roomBlobPath(code) {
  return `${ROOMS_PREFIX}${code}.json`;
}

function isLiveRoomRecord(rec, now = Date.now()) {
  return Boolean(
    rec &&
      typeof rec === 'object' &&
      rec.code &&
      now - (rec.updatedAt || 0) <= ROOM_TTL_MS &&
      Array.isArray(rec.players) &&
      rec.players.length > 0
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const code = cleanCode(url.searchParams.get('code'));
    const now = Date.now();

    if (code) {
      const { data: rec } = await readBlobJson(roomBlobPath(code), null);
      if (!isLiveRoomRecord(rec, now)) {
        return jsonResponse({ ok: false, error: `Room "${code}" not found or expired.` }, 404);
      }
      return jsonResponse({
        ok: true,
        room: rec.room,
        snapshot: rec.snapshot,
        updatedAt: rec.updatedAt || 0,
        ageMs: Math.max(0, now - (rec.updatedAt || now)),
      });
    }

    const blobs = await listBlobPaths(ROOMS_PREFIX, 40);
    const roomBlobs = blobs.filter((b) => /^rooms\/[A-Z0-9]{4,8}\.json$/i.test(b.pathname));
    const records = await Promise.all(
      roomBlobs.map(async (b) => {
        const { data } = await readBlobJson(b.pathname, null);
        return data;
      })
    );
    const list = records
      .filter((rec) => isLiveRoomRecord(rec, now))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 20)
      .map((rec) => {
        const host = rec.players.find((p) => p.isHost) || rec.players[0];
        return {
          code: rec.code,
          levelId: rec.levelId,
          started: Boolean(rec.started),
          playerCount: rec.players.length,
          maxPlayers: rec.maxPlayers || 4,
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

  const blobPath = roomBlobPath(code);
  const now = Date.now();

  try {
    if (action === 'close') {
      await deleteBlobPath(blobPath);
      return jsonResponse({ ok: true, code });
    }

    if (action === 'join') {
      const { data: existing } = await readBlobJson(blobPath, null);
      if (!isLiveRoomRecord(existing, now)) {
        return jsonResponse({ ok: false, error: `Room "${code}" not found or expired.` }, 404);
      }
      return jsonResponse({
        ok: true,
        room: existing.room,
        snapshot: existing.snapshot,
        updatedAt: existing.updatedAt || 0,
        ageMs: Math.max(0, now - (existing.updatedAt || now)),
      });
    }

    if (action === 'leave') {
      const { data: existing } = await readBlobJson(blobPath, null);
      if (!isLiveRoomRecord(existing, now)) {
        return jsonResponse({ ok: true, code });
      }
      const pid = String(body.playerId || '');
      const remaining = (existing.players || []).filter((p) => p.id !== pid);
      if (remaining.length === 0) {
        await deleteBlobPath(blobPath);
        return jsonResponse({ ok: true, code });
      }
      if (!remaining.some((p) => p.isHost)) {
        remaining[0].isHost = true;
      }
      existing.players = remaining;
      if (existing.room) existing.room.players = remaining;
      if (existing.snapshot?.room) existing.snapshot.room.players = remaining;
      if (existing.snapshot?.players) existing.snapshot.players = remaining;
      existing.updatedAt = now;
      await writeBlobJson(blobPath, existing);
      return jsonResponse({ ok: true, code, room: existing.room, snapshot: existing.snapshot });
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
      await deleteBlobPath(blobPath);
      return jsonResponse({ ok: true, code });
    }

    const levelId = isValidLevelId(r.levelId) ? r.levelId : DEFAULT_LEVEL_ID;
    const maxPlayers = Math.max(2, Math.min(4, Number(r.maxPlayers) || 4));
    const hostEpoch = Number.isFinite(r.hostEpoch)
      ? r.hostEpoch
      : Number.isFinite(body.snapshot?.hostEpoch)
        ? body.snapshot.hostEpoch
        : 1;
    const roomClean = {
      code,
      levelId,
      maxPlayers,
      started: Boolean(r.started),
      phase: r.phase || (r.started ? 'diving' : 'lobby'),
      diveSeq: Number(r.diveSeq) || 0,
      hostEpoch,
      players,
    };
    const record = {
      code,
      levelId,
      maxPlayers,
      started: roomClean.started,
      hostEpoch,
      players,
      room: roomClean,
      snapshot: body.snapshot || null,
      updatedAt: now,
    };
    await writeBlobJson(blobPath, record);
    return jsonResponse({ ok: true, room: roomClean });
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Failed to update cloud room.' }, 500);
  }
}
