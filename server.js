import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { DEFAULT_LEVEL_ID, isValidLevelId } from './public/js/levels/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);

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

  if (urlPath === '/healthz') {
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
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
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
  const trimmed = String(raw || '').trim().slice(0, 18);
  return trimmed || fallback;
}

function sanitizeLoadStatus(raw) {
  return raw === 'loading' || raw === 'ready' || raw === 'idle' ? raw : 'ready';
}

function sanitizePlayerState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
  const pct = (v) => Math.max(0, Math.min(100, num(v, 0)));
  return {
    x: num(raw.x),
    y: num(raw.y),
    vx: num(raw.vx),
    vy: num(raw.vy),
    angle: num(raw.angle),
    depthM: Math.max(0, num(raw.depthM)),
    gasId: typeof raw.gasId === 'string' ? raw.gasId.slice(0, 12) : 'EAN32',
    activeBar: Math.max(0, Math.min(250, num(raw.activeBar, 200))),
    cnsPercent: pct(raw.cnsPercent),
    dcsStress: pct(raw.dcsStress),
    hypoxiaStress: pct(raw.hypoxiaStress),
    narcosisLevel: Math.max(0, Math.min(1, num(raw.narcosisLevel, 0))),
    heartRateBpm: Math.max(0, Math.min(220, Math.round(num(raw.heartRateBpm, 68)))),
    cardiacStress: pct(raw.cardiacStress),
    ceilingM: Math.max(0, num(raw.ceilingM, 0)),
    condition: typeof raw.condition === 'string' ? raw.condition.slice(0, 16) : 'NOMINAL',
    surfaced: Boolean(raw.surfaced),
    healthPct: pct(raw.healthPct ?? 100),
    gasRemainingPct: pct(raw.gasRemainingPct ?? 100),
    diveTimeSec: Math.max(0, num(raw.diveTimeSec, 0)),
    collectiblesFound: Math.max(0, Math.round(num(raw.collectiblesFound, 0))),
    exploredPct: pct(raw.exploredPct ?? 0),
    totalScore: Math.max(0, Math.round(num(raw.totalScore, 0))),
    torchOn: Boolean(raw.torchOn),
    alive: raw.alive !== false,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 18) : 'Diver',
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
        const requestedMax = Number.isInteger(msg.maxPlayers) ? msg.maxPlayers : 2;
        const maxPlayers = Math.max(2, Math.min(4, requestedMax));
        const levelId = sanitizeLevelId(msg.levelId);
        const token = crypto.randomBytes(8).toString('hex');
        const room = {
          code,
          levelId,
          maxPlayers,
          started: false,
          phase: 'lobby',
          diveSeq: 0,
          sharedCheckpoints: new Set(),
          sharedCollectibles: new Set(),
          players: new Map(),
        };
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
        if (room.started) {
          sendJson(ws, {
            type: 'error',
            message: `Dive in room "${code}" is already underway. Wait for return to lobby or create a new room.`,
          });
          return;
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
        broadcastRoom(room, { type: 'room_update', room: serializeRoom(room) }, client.id);
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
        const signal = typeof msg.signal === 'string' ? msg.signal.trim().slice(0, 28) : '';
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

  ws.on('close', () => {
    leaveCurrentRoom(client, { immediate: false });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = getLanAddresses();
  console.log('\n🤿  CAVE DIVER — LAN Server Ready');
  console.log(`   Local:   http://localhost:${PORT}`);
  for (const item of lan) {
    console.log(`   LAN (${item.interface}): http://${item.address}:${PORT}`);
  }
  console.log('\n   Open a LAN URL on your phone (same Wi-Fi) to play!\n');
});
