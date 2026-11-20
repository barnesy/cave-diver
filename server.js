import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { DEFAULT_LEVEL_ID, isValidLevelId } from './public/js/levels/index.js';
import {
  mergeLeaderboardEntries,
  normalizeLeaderboardSubmission,
  pruneLeaderboardEntries,
  queryLeaderboardEntries,
} from './public/js/game/leaderboardModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const LEADERBOARD_FILE = process.env.LEADERBOARD_FILE || '';
let leaderboardStore = [];
let persistLbChain = Promise.resolve();

async function initLeaderboardStore() {
  if (!LEADERBOARD_FILE) return;
  try {
    const raw = await fs.readFile(LEADERBOARD_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      leaderboardStore = parsed;
    }
  } catch {
    // fresh store
  }
}

function scheduleLeaderboardPersist() {
  if (!LEADERBOARD_FILE) return;
  const snapshot = JSON.stringify(leaderboardStore);
  const tmpFile = `${LEADERBOARD_FILE}.tmp.${process.pid}`;
  persistLbChain = persistLbChain
    .then(async () => {
      await fs.writeFile(tmpFile, snapshot, 'utf8');
      await fs.rename(tmpFile, LEADERBOARD_FILE);
    })
    .catch(() => {});
}

function upsertLeaderboardEntries(incomingEntries) {
  const { entries, changed } = mergeLeaderboardEntries(leaderboardStore, incomingEntries);
  if (changed) {
    leaderboardStore = pruneLeaderboardEntries(entries);
    scheduleLeaderboardPersist();
  }
  return changed;
}

initLeaderboardStore();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function isVirtualInterface(name = '') {
  return /vethernet|wsl|hyper-v|virtual|vmware|vbox|docker|loopback|tailscale|zerotier|hamachi|tun|tap/i.test(name);
}

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ interface: name, address: net.address });
      }
    }
  }
  addresses.sort((a, b) => {
    const score = (entry) => {
      let s = 0;
      if (!isVirtualInterface(entry.interface)) s += 4;
      if (/^192\.168\./.test(entry.address)) s += 2;
      else if (/^10\./.test(entry.address)) s += 1;
      if (/wi-?fi|wlan|ethernet/i.test(entry.interface)) s += 2;
      return s;
    };
    return score(b) - score(a);
  });
  return addresses;
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  if (urlPath === '/healthz' || urlPath === '/api/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, uptimeSec: Math.round(process.uptime()) }));
    return;
  }

  if (urlPath === '/api/lan-info') {
    const payload = {
      port: PORT,
      urls: getLanAddresses().map((a) => `http://${a.address}:${PORT}`),
    };
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
    return;
  }

  if (urlPath === '/api/leaderboard') {
    const corsHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }
    if (req.method === 'GET') {
      const parsedUrl = new URL(req.url || '/api/leaderboard', `http://127.0.0.1:${PORT}`);
      const mode = parsedUrl.searchParams.get('mode') === 'team' ? 'team' : 'solo';
      const level = parsedUrl.searchParams.get('level') || 'overall';
      const limit = Number(parsedUrl.searchParams.get('limit')) || 20;
      const entries = queryLeaderboardEntries(leaderboardStore, { mode, levelId: level, limit });
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ mode, levelId: level, entries }));
      return;
    }
    if (req.method === 'POST') {
      let bodyText = '';
      for await (const chunk of req) {
        bodyText += chunk;
        if (bodyText.length > 131072) {
          res.writeHead(413, corsHeaders);
          res.end(JSON.stringify({ error: 'Payload too large' }));
          return;
        }
      }
      let raw;
      try {
        raw = JSON.parse(bodyText);
      } catch {
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      if (Array.isArray(raw?.entries)) {
        if (raw.entries.length === 0 || raw.entries.length > 50) {
          res.writeHead(400, corsHeaders);
          res.end(JSON.stringify({ error: 'Batch entries must contain 1..50 submissions.' }));
          return;
        }
        const valid = [];
        for (const item of raw.entries) {
          const parsedItem = normalizeLeaderboardSubmission(item);
          if (!parsedItem.ok) {
            res.writeHead(400, corsHeaders);
            res.end(JSON.stringify({ error: parsedItem.error }));
            return;
          }
          valid.push(parsedItem.entry);
        }
        const changed = upsertLeaderboardEntries(valid);
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify({ ok: true, count: valid.length, synced: changed }));
        return;
      }
      const parsed = normalizeLeaderboardSubmission(raw);
      if (!parsed.ok) {
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({ error: parsed.error }));
        return;
      }
      upsertLeaderboardEntries([parsed.entry]);
      const boardAll = queryLeaderboardEntries(leaderboardStore, {
        mode: parsed.entry.mode,
        levelId: parsed.entry.levelId,
        limit: 500,
      });
      const idx = boardAll.findIndex((e) => e.entryKey === parsed.entry.entryKey);
      const rank = idx >= 0 ? idx + 1 : boardAll.length + 1;
      res.writeHead(200, corsHeaders);
      res.end(
        JSON.stringify({
          ok: true,
          entry: parsed.entry,
          rank,
          total: boardAll.length,
          entries: boardAll.slice(0, 20),
        })
      );
      return;
    }
    res.writeHead(405, corsHeaders);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const joinPathMatch = urlPath.match(/^\/join\/([A-Za-z0-9]{1,8})\/?$/);
  if (joinPathMatch) {
    res.writeHead(302, { Location: `/?room=${encodeURIComponent(joinPathMatch[1].toUpperCase())}` });
    res.end();
    return;
  }

  let filePath = path.normalize(path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

// --- LAN Multiplayer Room Manager (2-4 Player Co-op) ---
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });
const rooms = new Map(); // code -> { code, levelId, maxPlayers, started, diveSeq, players: Map<clientId, playerMeta> }
let nextClientSeq = 1;
const REJOIN_GRACE_MS = 60000;
const LOBBY_REJOIN_GRACE_MS = 10 * 60 * 1000;

function sanitizeLevelId(raw) {
  const s = typeof raw === 'string' ? raw.trim().slice(0, 48) : '';
  return isValidLevelId(s) ? s : DEFAULT_LEVEL_ID;
}

function sanitizeRoomCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

function sanitizeName(raw, fallback = 'Diver') {
  const trimmed = String(raw || '')
    .replace(/[\r\n\t<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return trimmed || fallback;
}

function sanitizeLoadStatus(raw) {
  return raw === 'loading' || raw === 'ready' || raw === 'idle' ? raw : 'ready';
}

function sanitizePlayerState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
  const r2 = (v) => Math.round(v * 100) / 100;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const pct = (v) => Math.round(Math.max(0, Math.min(100, num(v, 0))) * 10) / 10;
  return {
    seq: Number.isFinite(raw.seq) ? Math.max(0, Math.round(raw.seq)) : 0,
    x: r2(num(raw.x)),
    y: r2(num(raw.y)),
    vx: r2(num(raw.vx)),
    vy: r2(num(raw.vy)),
    angle: r3(num(raw.angle)),
    depthM: Math.max(0, r2(num(raw.depthM))),
    gasId: typeof raw.gasId === 'string' ? raw.gasId.slice(0, 12) : 'EAN32',
    activeBar: Math.max(0, Math.min(250, Math.round(num(raw.activeBar, 200) * 10) / 10)),
    cnsPercent: pct(raw.cnsPercent),
    dcsStress: pct(raw.dcsStress),
    hypoxiaStress: pct(raw.hypoxiaStress),
    narcosisLevel: Math.max(0, Math.min(1, r2(num(raw.narcosisLevel, 0)))),
    heartRateBpm: Math.max(0, Math.min(220, Math.round(num(raw.heartRateBpm, 68)))),
    cardiacStress: pct(raw.cardiacStress),
    ceilingM: Math.max(0, Math.round(num(raw.ceilingM, 0) * 10) / 10),
    condition:
      typeof raw.condition === 'string'
        ? raw.condition.replace(/[\r\n\t<>]/g, ' ').trim().slice(0, 16) || 'NOMINAL'
        : 'NOMINAL',
    surfaced: Boolean(raw.surfaced),
    healthPct: pct(raw.healthPct ?? 100),
    gasRemainingPct: pct(raw.gasRemainingPct ?? 100),
    diveTimeSec: Math.max(0, Math.round(num(raw.diveTimeSec, 0) * 10) / 10),
    collectiblesFound: Math.max(0, Math.round(num(raw.collectiblesFound, 0))),
    exploredPct: pct(raw.exploredPct ?? 0),
    totalScore: Math.max(0, Math.round(num(raw.totalScore, 0))),
    torchOn: Boolean(raw.torchOn),
    torchAngle: Number.isFinite(Number(raw.torchAngle)) ? r2(Number(raw.torchAngle)) : r2(num(raw.angle, 0)),
    torchManualAim: Boolean(raw.torchManualAim),
    hasCcr: Boolean(raw.hasCcr),
    hasDpv: Boolean(raw.hasDpv),
    dpvActive: Boolean(raw.dpvActive),
    dpvThrusting: Boolean(raw.dpvThrusting),
    alive: raw.alive !== false,
    carryingBody: Boolean(raw.carryingBody),
    rescueTargetId: typeof raw.rescueTargetId === 'string' ? raw.rescueTargetId.slice(0, 48) : '',
    rescuedBy: typeof raw.rescuedBy === 'string' ? raw.rescuedBy.slice(0, 48) : '',
    rescued: Boolean(raw.rescued),
    name: sanitizeName(raw.name),
  };
}

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function sendJson(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastRoom(room, msg, excludeId = null) {
  const raw = JSON.stringify(msg);
  for (const [cid, p] of room.players.entries()) {
    if (cid !== excludeId && p.ws && p.ws.readyState === p.ws.OPEN) {
      p.ws.send(raw);
    }
  }
}

function serializeRoom(room) {
  return {
    code: room.code,
    levelId: room.levelId,
    maxPlayers: room.maxPlayers,
    started: room.started,
    phase: room.phase || (room.started ? 'diving' : 'lobby'),
    diveSeq: room.diveSeq || 0,
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      ready: Boolean(p.ready),
      isHost: Boolean(p.isHost),
      connected: p.connected !== false,
      loadStatus: p.loadStatus || 'ready',
      loadPct: Number.isFinite(p.loadPct) ? p.loadPct : 100,
      loadedLevelId: p.loadedLevelId || room.levelId,
    })),
  };
}

function getConnectedLoadingMember(room) {
  return Array.from(room.players.values()).find(
    (m) =>
      m.connected !== false &&
      m.hasLoadTracking &&
      (m.loadedLevelId !== room.levelId || m.loadStatus === 'loading')
  );
}

function launchRoomDive(room) {
  room.phase = 'diving';
  room.started = true;
  room.diveSeq = (room.diveSeq || 0) + 1;
  room.sharedCheckpoints = new Set();
  room.sharedCollectibles = new Set();
  room.openedHatches = new Set();
  room.cutSnags = new Set();
  room.placedMarkers = new Set();
  room.playerLines = new Map();
  room.bodyRecoveredBy = null;
  broadcastRoom(room, {
    type: 'dive_started',
    levelId: room.levelId,
    diveSeq: room.diveSeq,
    room: serializeRoom(room),
  });
  broadcastRoomsList();
}

function sanitizeGuidelineChains(raw) {
  if (!Array.isArray(raw)) return [];
  const chains = [];
  for (let i = 0; i < Math.min(24, raw.length); i++) {
    const ch = raw[i];
    if (!Array.isArray(ch)) continue;
    const pts = [];
    for (let j = 0; j < Math.min(120, ch.length); j++) {
      const pt = ch[j];
      if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
        pts.push({ x: Math.round(pt.x * 100) / 100, y: Math.round(pt.y * 100) / 100 });
      }
    }
    if (pts.length >= 1) chains.push(pts);
  }
  return chains;
}

function serializeRoomsList() {
  return Array.from(rooms.values()).map((room) => {
    const players = Array.from(room.players.values());
    const host = players.find((p) => p.isHost) || players[0];
    return {
      code: room.code,
      levelId: room.levelId,
      hostName: host?.name || 'Lead Diver',
      playerCount: players.length,
      maxPlayers: room.maxPlayers,
      started: Boolean(room.started),
    };
  });
}

function broadcastRoomsList() {
  const raw = JSON.stringify({ type: 'rooms_list', rooms: serializeRoomsList() });
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(raw);
    }
  }
}

function removePlayerFromRoom(room, playerId) {
  const existing = room.players.get(playerId);
  if (existing?.disconnectTimer) {
    clearTimeout(existing.disconnectTimer);
    existing.disconnectTimer = null;
  }
  room.players.delete(playerId);
  if (room.players.size === 0) {
    rooms.delete(room.code);
    broadcastRoomsList();
    return;
  }

  // Promote remaining connected player (or first player) to host if host left
  const remaining = Array.from(room.players.values());
  if (!remaining.some((p) => p.isHost)) {
    const nextHost = remaining.find((p) => p.connected !== false) || remaining[0];
    nextHost.isHost = true;
    nextHost.ready = true;
  }
  broadcastRoom(room, { type: 'room_update', leftPlayerId: playerId, room: serializeRoom(room) });
  broadcastRoomsList();
}

function leaveCurrentRoom(client, { immediate = true } = {}) {
  if (!client.roomCode) return;
  const code = client.roomCode;
  const room = rooms.get(code);
  if (!room) {
    client.roomCode = null;
    return;
  }

  const p = room.players.get(client.id);
  if (!p) {
    client.roomCode = null;
    return;
  }

  if (!immediate) {
    // Preserve player seat across app-switching, tab backgrounding, navigation, or brief drops.
    // Explicit Leave/Abort passes immediate=true and removes immediately.
    const graceMs = room.started ? REJOIN_GRACE_MS : LOBBY_REJOIN_GRACE_MS;
    p.connected = false;
    p.ws = null;
    if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    p.disconnectTimer = setTimeout(() => {
      const liveRoom = rooms.get(code);
      if (liveRoom?.players.get(p.id)?.connected === false) {
        removePlayerFromRoom(liveRoom, p.id);
      }
    }, graceMs);
    p.disconnectTimer.unref?.();
    client.roomCode = null;
    broadcastRoom(room, { type: 'room_update', room: serializeRoom(room) });
    broadcastRoomsList();
    return;
  }

  client.roomCode = null;
  removePlayerFromRoom(room, client.id);
}

wss.on('connection', (ws) => {
  const client = {
    id: `diver-${nextClientSeq++}`,
    name: 'Diver',
    roomCode: null,
    ws,
  };

  sendJson(ws, { type: 'welcome', clientId: client.id });
  sendJson(ws, { type: 'rooms_list', rooms: serializeRoomsList() });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'list_rooms': {
        sendJson(ws, { type: 'rooms_list', rooms: serializeRoomsList() });
        break;
      }

      case 'create_room': {
        leaveCurrentRoom(client, { immediate: true });
        const code = makeRoomCode();
        client.name = sanitizeName(msg.name, 'Lead Diver');
        const requestedMax = Number.isInteger(msg.maxPlayers) ? msg.maxPlayers : 4;
        const maxPlayers = Math.max(2, Math.min(4, requestedMax));
        const levelId = sanitizeLevelId(msg.levelId);
        const token = crypto.randomBytes(8).toString('hex');
        const initDive =
          msg.initialDiveState && typeof msg.initialDiveState === 'object' ? msg.initialDiveState : null;
        const initStarted = Boolean(initDive);
        const room = {
          code,
          levelId,
          maxPlayers,
          started: initStarted,
          phase: initStarted ? 'diving' : 'lobby',
          diveSeq: initStarted ? 1 : 0,
          sharedCheckpoints: new Set(
            initStarted && Array.isArray(initDive.checkpoints)
              ? initDive.checkpoints.filter((id) => typeof id === 'string').slice(0, 64)
              : []
          ),
          sharedCollectibles: new Set(
            initStarted && Array.isArray(initDive.collectibles)
              ? initDive.collectibles.filter((id) => typeof id === 'string').slice(0, 64)
              : []
          ),
          openedHatches: new Set(
            initStarted && Array.isArray(initDive.openedHatches)
              ? initDive.openedHatches.filter((id) => typeof id === 'string').slice(0, 32)
              : []
          ),
          cutSnags: new Set(
            initStarted && Array.isArray(initDive.cutSnags)
              ? initDive.cutSnags.filter((id) => typeof id === 'string').slice(0, 32)
              : []
          ),
          placedMarkers: new Set(
            initStarted && Array.isArray(initDive.placedMarkers)
              ? initDive.placedMarkers.filter((id) => typeof id === 'string').slice(0, 32)
              : []
          ),
          playerLines: new Map(),
          bodyRecoveredBy: initStarted && initDive.bodyRecovered ? client.id : null,
          players: new Map(),
        };
        if (initStarted && Array.isArray(initDive.playerLines)) {
          const chains = sanitizeGuidelineChains(initDive.playerLines);
          if (chains.length > 0) {
            room.playerLines.set(client.id, {
              name: client.name,
              chains,
              reelingActive: false,
            });
          }
        }
        const hasHostTracking = Boolean(msg.loadStatus || msg.loadedLevelId);
        room.players.set(client.id, {
          id: client.id,
          name: client.name,
          ready: true,
          isHost: true,
          connected: true,
          hasLoadTracking: hasHostTracking,
          loadStatus: sanitizeLoadStatus(msg.loadStatus),
          loadPct: Number.isFinite(msg.loadPct) ? Math.max(0, Math.min(100, msg.loadPct)) : 100,
          loadedLevelId: sanitizeLevelId(msg.loadedLevelId || levelId),
          reconnectToken: token,
          disconnectTimer: null,
          ws,
        });
        rooms.set(code, room);
        client.roomCode = code;
        sendJson(ws, {
          type: 'room_joined',
          room: serializeRoom(room),
          clientId: client.id,
          reconnectToken: token,
        });
        broadcastRoomsList();
        break;
      }

      case 'join_room': {
        const code = sanitizeRoomCode(msg.code);
        if (!code) {
          sendJson(ws, { type: 'error', message: 'Enter a valid room code.' });
          return;
        }
        const room = rooms.get(code);
        if (!room) {
          sendJson(ws, { type: 'error', message: `Room "${code}" not found on LAN.` });
          broadcastRoomsList();
          return;
        }
        if (room.players.size >= room.maxPlayers) {
          const disconnectedEntry = Array.from(room.players.values()).find(
            (m) => !m.isHost && m.connected === false
          );
          if (disconnectedEntry) {
            if (disconnectedEntry.disconnectTimer) clearTimeout(disconnectedEntry.disconnectTimer);
            room.players.delete(disconnectedEntry.id);
          }
        }
        if (room.players.size >= room.maxPlayers) {
          sendJson(ws, { type: 'error', message: `Room "${code}" already has ${room.maxPlayers} divers.` });
          return;
        }
        leaveCurrentRoom(client, { immediate: true });
        client.name = sanitizeName(msg.name, 'Buddy Diver');
        const token = crypto.randomBytes(8).toString('hex');
        const hasJoinTracking = Boolean(msg.loadStatus || msg.loadedLevelId);
        const loadedLevelId = msg.loadedLevelId ? sanitizeLevelId(msg.loadedLevelId) : room.levelId;
        const loadStatus = msg.loadStatus === 'loading' ? 'loading' : 'ready';
        room.players.set(client.id, {
          id: client.id,
          name: client.name,
          ready: true,
          isHost: false,
          connected: true,
          hasLoadTracking: hasJoinTracking,
          loadStatus,
          loadPct: loadStatus === 'ready' ? 100 : 0,
          loadedLevelId,
          reconnectToken: token,
          disconnectTimer: null,
          ws,
        });
        client.roomCode = code;
        sendJson(ws, {
          type: 'room_joined',
          room: serializeRoom(room),
          clientId: client.id,
          reconnectToken: token,
        });
        broadcastRoom(
          room,
          {
            type: 'room_update',
            room: serializeRoom(room),
            joinedMidDiveName: room.started ? client.name : undefined,
          },
          client.id
        );
        if (room.started) {
          sendJson(ws, {
            type: 'dive_started',
            levelId: room.levelId,
            diveSeq: room.diveSeq,
            rejoined: true,
            lateJoin: true,
            checkpoints: Array.from(room.sharedCheckpoints || []),
            collectibles: Array.from(room.sharedCollectibles || []),
            openedHatches: Array.from(room.openedHatches || []),
            cutSnags: Array.from(room.cutSnags || []),
            placedMarkers: Array.from(room.placedMarkers || []),
            playerLines: Array.from((room.playerLines || new Map()).entries()).map(([pid, data]) => ({
              playerId: pid,
              ...data,
            })),
            bodyRecoveredBy: room.bodyRecoveredBy || null,
            room: serializeRoom(room),
          });
        } else if (room.phase === 'preparing') {
          sendJson(ws, {
            type: 'dive_preparing',
            levelId: room.levelId,
            diveSeq: room.diveSeq,
            room: serializeRoom(room),
          });
        }
        broadcastRoomsList();
        break;
      }

      case 'rejoin_room': {
        const code = sanitizeRoomCode(msg.code);
        const token = typeof msg.reconnectToken === 'string' ? msg.reconnectToken : '';
        const room = rooms.get(code);
        if (!room) {
          sendJson(ws, { type: 'error', message: `Room "${code}" is no longer active.` });
          broadcastRoomsList();
          return;
        }
        let targetPlayer = null;
        for (const p of room.players.values()) {
          if (token && p.reconnectToken === token) {
            targetPlayer = p;
            break;
          }
        }
        if (!targetPlayer) {
          sendJson(ws, { type: 'error', message: `Session in room "${code}" expired.` });
          return;
        }
        if (targetPlayer.disconnectTimer) {
          clearTimeout(targetPlayer.disconnectTimer);
          targetPlayer.disconnectTimer = null;
        }
        client.id = targetPlayer.id;
        client.name = targetPlayer.name;
        client.roomCode = room.code;
        targetPlayer.ws = ws;
        targetPlayer.connected = true;
        if (typeof msg.name === 'string' && msg.name.trim()) {
          targetPlayer.name = sanitizeName(msg.name, targetPlayer.name);
          client.name = targetPlayer.name;
        }
        sendJson(ws, {
          type: 'room_joined',
          room: serializeRoom(room),
          clientId: client.id,
          reconnectToken: targetPlayer.reconnectToken,
          rejoined: true,
        });
        broadcastRoom(room, { type: 'room_update', room: serializeRoom(room) }, client.id);
        broadcastRoomsList();
        if (room.started) {
          sendJson(ws, {
            type: 'dive_started',
            levelId: room.levelId,
            diveSeq: room.diveSeq,
            rejoined: true,
            checkpoints: Array.from(room.sharedCheckpoints || []),
            collectibles: Array.from(room.sharedCollectibles || []),
            openedHatches: Array.from(room.openedHatches || []),
            cutSnags: Array.from(room.cutSnags || []),
            placedMarkers: Array.from(room.placedMarkers || []),
            playerLines: Array.from((room.playerLines || new Map()).entries()).map(([pid, data]) => ({
              playerId: pid,
              ...data,
            })),
            bodyRecoveredBy: room.bodyRecoveredBy || null,
            room: serializeRoom(room),
          });
        } else if (room.phase === 'preparing') {
          sendJson(ws, {
            type: 'dive_preparing',
            levelId: room.levelId,
            diveSeq: room.diveSeq,
            room: serializeRoom(room),
          });
        }
        break;
      }

      case 'set_level': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const p = room.players.get(client.id);
        if (!p || !p.isHost) return;
        const nextLevelId = sanitizeLevelId(msg.levelId);
        if (room.levelId === nextLevelId) return;
        room.levelId = nextLevelId;
        room.started = false;
        room.phase = 'lobby';
        for (const member of room.players.values()) {
          if (!member.hasLoadTracking) {
            member.loadedLevelId = nextLevelId;
            member.loadStatus = 'ready';
            member.loadPct = 100;
          } else if (member.loadedLevelId === nextLevelId && member.loadStatus === 'ready') {
            member.loadPct = 100;
          } else {
            member.loadStatus = 'idle';
            member.loadPct = 0;
          }
        }
        broadcastRoom(room, { type: 'room_update', room: serializeRoom(room) });
        broadcastRoomsList();
        break;
      }

      case 'set_max_players': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const p = room.players.get(client.id);
        if (!p || !p.isHost) return;
        const requested = Number.isInteger(msg.maxPlayers) ? msg.maxPlayers : room.maxPlayers;
        room.maxPlayers = Math.max(Math.max(2, room.players.size), Math.min(4, requested));
        broadcastRoom(room, { type: 'room_update', room: serializeRoom(room) });
        broadcastRoomsList();
        break;
      }

      case 'set_player_status': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const p = room.players.get(client.id);
        if (!p) return;
        p.hasLoadTracking = true;
        if (typeof msg.ready === 'boolean') p.ready = msg.ready;
        if (msg.loadStatus) p.loadStatus = sanitizeLoadStatus(msg.loadStatus);
        if (Number.isFinite(msg.loadPct)) p.loadPct = Math.max(0, Math.min(100, Math.round(msg.loadPct)));
        if (msg.loadedLevelId) p.loadedLevelId = sanitizeLevelId(msg.loadedLevelId);
        if (room.phase === 'preparing' && !getConnectedLoadingMember(room)) {
          launchRoomDive(room);
        } else {
          broadcastRoom(room, { type: 'room_update', room: serializeRoom(room) });
        }
        break;
      }

      case 'set_ready': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const p = room.players.get(client.id);
        if (!p) return;
        p.ready = Boolean(msg.ready);
        broadcastRoom(room, { type: 'room_update', room: serializeRoom(room) });
        break;
      }

      case 'prepare_dive': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const p = room.players.get(client.id);
        if (!p || !p.isHost) return;
        const loadingMember = getConnectedLoadingMember(room);
        if (!loadingMember) {
          launchRoomDive(room);
          return;
        }
        room.phase = 'preparing';
        room.started = false;
        room.diveSeq = (room.diveSeq || 0) + 1;
        for (const member of room.players.values()) {
          if (member.hasLoadTracking && (member.loadedLevelId !== room.levelId || member.loadStatus !== 'ready')) {
            member.loadStatus = 'loading';
            member.loadPct = 0;
          }
        }
        broadcastRoom(room, {
          type: 'dive_preparing',
          levelId: room.levelId,
          diveSeq: room.diveSeq,
          room: serializeRoom(room),
        });
        break;
      }

      case 'cancel_prepare': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const p = room.players.get(client.id);
        if (!p || !p.isHost) return;
        room.phase = 'lobby';
        room.started = false;
        broadcastRoom(room, {
          type: 'returned_to_lobby',
          room: serializeRoom(room),
        });
        break;
      }

      case 'start_dive': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const p = room.players.get(client.id);
        if (!p || !p.isHost) return;
        if (!msg.force) {
          const loadingMember = getConnectedLoadingMember(room);
          if (loadingMember) {
            sendJson(ws, {
              type: 'error',
              message: `Waiting for ${loadingMember.name} to finish loading dive site (${loadingMember.loadPct ?? 0}%)...`,
            });
            return;
          }
        }
        launchRoomDive(room);
        break;
      }

      case 'return_to_lobby': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const p = room.players.get(client.id);
        if (!p) return;
        if (p.isHost) {
          room.started = false;
          room.phase = 'lobby';
          room.sharedCheckpoints?.clear?.();
          room.sharedCollectibles?.clear?.();
          room.openedHatches?.clear?.();
          room.cutSnags?.clear?.();
          room.placedMarkers?.clear?.();
          room.playerLines?.clear?.();
          room.bodyRecoveredBy = null;
          broadcastRoom(room, {
            type: 'returned_to_lobby',
            room: serializeRoom(room),
          });
          broadcastRoomsList();
        }
        break;
      }

      case 'player_state': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const cleanState = sanitizePlayerState(msg.state);
        if (!cleanState) return;
        broadcastRoom(
          room,
          {
            type: 'peer_state',
            playerId: client.id,
            state: cleanState,
          },
          client.id
        );
        break;
      }

      case 'diver_signal': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const p = room.players.get(client.id);
        const now = Date.now();
        if (p && now - (p._lastSignalAt || 0) < 600) return;
        if (p) p._lastSignalAt = now;
        const rawSig = typeof msg.signal === 'string' ? msg.signal.replace(/[\r\n\t<>]/g, ' ').trim() : '';
        const signal = Array.from(rawSig).slice(0, 24).join('');
        if (!signal) return;
        broadcastRoom(
          room,
          {
            type: 'peer_signal',
            playerId: client.id,
            name: p?.name || 'Buddy',
            signal,
          },
          client.id
        );
        break;
      }

      case 'guideline_sync': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const p = room.players.get(client.id);
        const chains = sanitizeGuidelineChains(msg.chains);
        const reelingActive = Boolean(msg.reelingActive);
        if (!room.playerLines) room.playerLines = new Map();
        room.playerLines.set(client.id, {
          name: p?.name || 'Buddy',
          chains,
          reelingActive,
        });
        broadcastRoom(
          room,
          {
            type: 'peer_guideline',
            playerId: client.id,
            name: p?.name || 'Buddy',
            chains,
            reelingActive,
          },
          client.id
        );
        break;
      }

      case 'silt_event': {
        const room = rooms.get(client.roomCode);
        if (!room || !msg.plume || typeof msg.plume !== 'object') return;
        const p = msg.plume;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
        broadcastRoom(
          room,
          {
            type: 'peer_silt',
            playerId: client.id,
            plume: {
              x: p.x,
              y: p.y,
              vx: Number.isFinite(p.vx) ? p.vx : 0,
              vy: Number.isFinite(p.vy) ? p.vy : -0.2,
              radius: Number.isFinite(p.radius) ? Math.min(2.5, Math.max(0.4, p.radius)) : 1.0,
              maxRadius: Number.isFinite(p.maxRadius) ? Math.min(5.0, Math.max(1.2, p.maxRadius)) : 3.4,
              life: Number.isFinite(p.life) ? Math.min(32, Math.max(4, p.life)) : 22,
              peakAlpha: Number.isFinite(p.peakAlpha) ? Math.min(0.9, Math.max(0.2, p.peakAlpha)) : 0.78,
              isRust: Boolean(p.isRust),
            },
          },
          client.id
        );
        break;
      }

      case 'checkpoint_hit': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        if (typeof msg.checkpointId === 'string') {
          room.sharedCheckpoints?.add(msg.checkpointId.slice(0, 24));
        }
        broadcastRoom(
          room,
          {
            type: 'peer_checkpoint',
            playerId: client.id,
            checkpointId: msg.checkpointId,
          },
          client.id
        );
        break;
      }

      case 'collectible_hit': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        if (typeof msg.collectibleId === 'string') {
          room.sharedCollectibles?.add(msg.collectibleId.slice(0, 32));
        }
        broadcastRoom(
          room,
          {
            type: 'peer_collectible',
            playerId: client.id,
            collectibleId: msg.collectibleId,
          },
          client.id
        );
        break;
      }

      case 'wreck_action': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const actionKind =
          msg.actionKind === 'hatch' || msg.actionKind === 'snag' || msg.actionKind === 'marker'
            ? msg.actionKind
            : '';
        const targetId = typeof msg.targetId === 'string' ? msg.targetId.slice(0, 48) : '';
        if (!actionKind || !targetId) break;
        if (actionKind === 'hatch') room.openedHatches?.add(targetId);
        else if (actionKind === 'snag') room.cutSnags?.add(targetId);
        else if (actionKind === 'marker') room.placedMarkers?.add(targetId);
        broadcastRoom(
          room,
          {
            type: 'peer_wreck_action',
            playerId: client.id,
            by: client.name,
            actionKind,
            targetId,
          },
          client.id
        );
        break;
      }

      case 'body_recovered': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const p = room.players.get(client.id);
        if (!room.bodyRecoveredBy) room.bodyRecoveredBy = client.id;
        broadcastRoom(
          room,
          {
            type: 'peer_body_recovered',
            playerId: client.id,
            name: p?.name || 'Buddy',
          },
          client.id
        );
        break;
      }

      case 'gas_share': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const sender = room.players.get(client.id);
        const targetPlayerId = typeof msg.targetPlayerId === 'string' ? msg.targetPlayerId.slice(0, 48) : '';
        if (!targetPlayerId || targetPlayerId === client.id) return;
        const target = room.players.get(targetPlayerId);
        const gasId = ['EAN32', 'TMX1455', 'O2'].includes(msg.gasId) ? msg.gasId : 'EAN32';
        const amountBar = Math.max(1, Math.min(40, Math.round(Number(msg.amountBar) || 0)));
        if (!target || !target.ws || amountBar <= 0) return;
        sendJson(target.ws, {
          type: 'peer_gas_share',
          fromPlayerId: client.id,
          fromName: sender?.name || 'Buddy',
          targetPlayerId,
          gasId,
          amountBar,
        });
        break;
      }

      case 'buddy_rescue': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const rescuer = room.players.get(client.id);
        const rescuedId = typeof msg.rescuedId === 'string' ? msg.rescuedId.slice(0, 48) : '';
        if (!rescuedId) return;
        broadcastRoom(
          room,
          {
            type: 'peer_buddy_rescue',
            rescuerId: client.id,
            rescuerName: rescuer?.name || 'Buddy',
            rescuedId,
            rescuedName: sanitizeName(msg.rescuedName || 'Buddy'),
            status: msg.status === 'extracted' || msg.status === 'dropped' ? msg.status : 'towing',
          },
          client.id
        );
        break;
      }

      case 'leave_room': {
        leaveCurrentRoom(client, { immediate: true });
        break;
      }

      case 'ping': {
        sendJson(ws, { type: 'pong', t: msg.t });
        break;
      }
    }
  });

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('close', () => {
    leaveCurrentRoom(client, { immediate: false });
  });
});

const wsPingSweep = setInterval(() => {
  for (const sock of wss.clients) {
    if (sock.isAlive === false) {
      try { sock.terminate(); } catch {}
      continue;
    }
    sock.isAlive = false;
    try { sock.ping(); } catch {}
  }
}, 20000);
wsPingSweep.unref?.();

server.listen(PORT, '0.0.0.0', () => {
  const lan = getLanAddresses();
  console.log('\n🤿  TECHNO DIVE — LAN Server Ready');
  console.log(`   Local:   http://localhost:${PORT}`);
  for (const item of lan) {
    console.log(`   LAN (${item.interface}): http://${item.address}:${PORT}`);
  }
  console.log('\n   Open a LAN URL on your phone (same Wi-Fi) to play!\n');
});
