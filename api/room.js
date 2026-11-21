import { DEFAULT_LEVEL_ID, isValidLevelId } from '../public/js/levels/index.js';
import {
  CORS_HEADERS,
  jsonResponse,
  readBlobJson,
  writeBlobJson,
  mutateBlobJson,
  NO_BLOB_MUTATION,
  deleteBlobPath,
  listBlobPaths,
} from './_blobJson.js';

const ROOMS_PREFIX = 'rooms/';
const ROOM_TTL_MS = 25 * 60 * 1000; // 25 minutes — prevents dead tabs polluting Active Dives
const MAX_ROOM_BODY_BYTES = 128 * 1024;

function stripSnapshotSecrets(snap) {
  if (!snap || typeof snap !== 'object') return null;
  const copy = { ...snap };
  if (Array.isArray(copy.players)) {
    copy.players = copy.players.map((p) => {
      if (!p || typeof p !== 'object') return p;
      const { reconnectToken, ...safe } = p;
      return safe;
    });
  }
  return copy;
}

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

    const blobs = await listBlobPaths(ROOMS_PREFIX, 60);
    const roomBlobs = blobs.filter((b) => /^rooms\/[A-Z0-9]{4,8}\.json$/i.test(b.pathname));
    const expiredPaths = [];
    const records = await Promise.all(
      roomBlobs.map(async (b) => {
        try {
          const { data } = await readBlobJson(b.pathname, null);
          if (!isLiveRoomRecord(data, now)) {
            expiredPaths.push(b.pathname);
            return null;
          }
          return data;
        } catch {
          // Skip unreadable or revoked legacy blobs cleanly instead of failing the entire room list
          return null;
        }
      })
    );
    // Opportunistically clean up expired room blobs so list cap never starves new rooms
    if (expiredPaths.length > 0) {
      await Promise.all(expiredPaths.slice(0, 12).map((p) => deleteBlobPath(p).catch(() => {})));
    }
    const list = records
      .filter(Boolean)
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
  let rawText;
  let body;
  try {
    rawText = await request.text();
    if (rawText.length > MAX_ROOM_BODY_BYTES) {
      return jsonResponse({ error: 'Room payload too large.' }, 413);
    }
    body = JSON.parse(rawText);
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
      let deleted = false;
      const pid = String(body.playerId || '');
      const updated = await mutateBlobJson(
        blobPath,
        () => null,
        (existing) => {
          if (!isLiveRoomRecord(existing, now)) return NO_BLOB_MUTATION;
          const remaining = (existing.players || []).filter((p) => p.id !== pid);
          if (remaining.length === 0) {
            deleted = true;
            return NO_BLOB_MUTATION;
          }
          if (!remaining.some((p) => p.isHost)) {
            remaining[0].isHost = true;
          }
          const next = {
            ...existing,
            players: remaining,
            updatedAt: now,
          };
          if (next.room) next.room = { ...next.room, players: remaining };
          if (next.snapshot && typeof next.snapshot === 'object') {
            const snapPlayers = Array.isArray(next.snapshot.players)
              ? next.snapshot.players.filter((p) => p.id !== pid)
              : remaining;
            if (snapPlayers.length > 0 && !snapPlayers.some((p) => p.isHost)) {
              snapPlayers[0] = { ...snapPlayers[0], isHost: true };
            }
            next.snapshot = {
              ...next.snapshot,
              ...(next.snapshot.room ? { room: { ...next.snapshot.room, players: remaining } } : {}),
              players: snapPlayers,
            };
          }
          return next;
        },
        8,
        { ttlSec: Math.ceil(ROOM_TTL_MS / 1000) }
      );
      if (deleted) {
        await deleteBlobPath(blobPath);
        return jsonResponse({ ok: true, code });
      }
      return jsonResponse({ ok: true, code, room: updated?.room || null, snapshot: updated?.snapshot || null });
    }

    // 'sync': host creates or updates room + snapshot metadata cleanly with monotonic hostEpoch guard
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
      snapshot: stripSnapshotSecrets(body.snapshot),
      updatedAt: now,
    };
    const saved = await mutateBlobJson(
      blobPath,
      () => null,
      (existing) => {
        if (isLiveRoomRecord(existing, now) && (existing.hostEpoch || 1) > hostEpoch) {
          return NO_BLOB_MUTATION;
        }
        return record;
      },
      8,
      { ttlSec: Math.ceil(ROOM_TTL_MS / 1000) }
    );
    return jsonResponse({ ok: true, room: saved?.room || roomClean });
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Failed to update cloud room.' }, 500);
  }
}
