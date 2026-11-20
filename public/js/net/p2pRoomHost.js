import { DEFAULT_LEVEL_ID, isValidLevelId } from '../levels/index.js';

const LOBBY_GRACE_MS = 10 * 60 * 1000;
const DIVE_GRACE_MS = 60 * 1000;

function sanitizeLevelId(raw) {
  const s = typeof raw === 'string' ? raw.trim().slice(0, 48) : '';
  return isValidLevelId(s) ? s : DEFAULT_LEVEL_ID;
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

function randomToken() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
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
    name: sanitizeName(raw.name, 'Diver'),
  };
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

export function compareHostAuthority(a = {}, b = {}) {
  const aStarted = Boolean(a.started);
  const bStarted = Boolean(b.started);
  if (aStarted !== bStarted) return aStarted ? 1 : -1;

  const aEpoch = Number.isFinite(a.hostEpoch) ? a.hostEpoch : 1;
  const bEpoch = Number.isFinite(b.hostEpoch) ? b.hostEpoch : 1;
  if (aEpoch !== bEpoch) return aEpoch - bEpoch;

  const aCount = Number.isFinite(a.playerCount) ? a.playerCount : 0;
  const bCount = Number.isFinite(b.playerCount) ? b.playerCount : 0;
  if (aCount !== bCount) return aCount - bCount;

  const aid = String(a.hostId || '');
  const bid = String(b.hostId || '');
  if (aid === bid) return 0;
  return aid.localeCompare(bid) < 0 ? 1 : -1;
}

export function pickNextP2pHostId(players, excludeId = null) {
  const candidates = (players || [])
    .filter((p) => p && p.id !== excludeId && p.connected !== false)
    .slice()
    .sort((a, b) => {
      const ja = Number.isFinite(a.joinSeq) ? a.joinSeq : Number.MAX_SAFE_INTEGER;
      const jb = Number.isFinite(b.joinSeq) ? b.joinSeq : Number.MAX_SAFE_INTEGER;
      if (ja !== jb) return ja - jb;
      const na = parseInt(String(a.id).replace(/\D+/g, ''), 10);
      const nb = parseInt(String(b.id).replace(/\D+/g, ''), 10);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return String(a.id).localeCompare(String(b.id));
    });
  return candidates[0]?.id || null;
}

/**
 * In-browser authoritative room coordinator for serverless WebRTC P2P co-op.
 * Implements the exact same room/dive/sync envelope protocol as server.js so
 * UI, reconnect logic, and gameplay behave identically without a backend server.
 */
export class P2pRoomCoordinator {
  constructor({
    code,
    hostId = 'p2p-1',
    hostName = 'Lead Diver',
    levelId = DEFAULT_LEVEL_ID,
    maxPlayers = 4,
    loadStatus = {},
    initialDiveState = null,
    hostEpoch = 1,
  }) {
    this.seq = 2;
    this.hostId = hostId;
    const initStarted = Boolean(initialDiveState && typeof initialDiveState === 'object');
    this.room = {
      code,
      levelId: sanitizeLevelId(levelId),
      maxPlayers: Math.max(2, Math.min(4, Number(maxPlayers) || 4)),
      started: initStarted,
      phase: initStarted ? 'diving' : 'lobby',
      diveSeq: initStarted ? 1 : 0,
      hostEpoch: Number.isFinite(hostEpoch) ? hostEpoch : 1,
      sharedCheckpoints: new Set(
        initStarted && Array.isArray(initialDiveState.checkpoints)
          ? initialDiveState.checkpoints.filter((id) => typeof id === 'string').slice(0, 64)
          : []
      ),
      sharedCollectibles: new Set(
        initStarted && Array.isArray(initialDiveState.collectibles)
          ? initialDiveState.collectibles.filter((id) => typeof id === 'string').slice(0, 64)
          : []
      ),
      openedHatches: new Set(
        initStarted && Array.isArray(initialDiveState.openedHatches)
          ? initialDiveState.openedHatches.filter((id) => typeof id === 'string').slice(0, 32)
          : []
      ),
      cutSnags: new Set(
        initStarted && Array.isArray(initialDiveState.cutSnags)
          ? initialDiveState.cutSnags.filter((id) => typeof id === 'string').slice(0, 32)
          : []
      ),
      placedMarkers: new Set(
        initStarted && Array.isArray(initialDiveState.placedMarkers)
          ? initialDiveState.placedMarkers.filter((id) => typeof id === 'string').slice(0, 32)
          : []
      ),
      playerLines: new Map(),
      bodyRecoveredBy: initStarted && initialDiveState.bodyRecovered ? hostId : null,
      players: new Map(),
    };
    if (initStarted && Array.isArray(initialDiveState.playerLines)) {
      const chains = sanitizeGuidelineChains(initialDiveState.playerLines);
      if (chains.length > 0) {
        this.room.playerLines.set(hostId, {
          name: sanitizeName(hostName, 'Lead Diver'),
          chains,
          reelingActive: false,
        });
      }
    }
    this.senders = new Map(); // playerId -> (msg) => void

    const token = randomToken();
    this.room.players.set(this.hostId, {
      id: this.hostId,
      joinSeq: 1,
      name: sanitizeName(hostName, 'Lead Diver'),
      ready: true,
      isHost: true,
      connected: true,
      hasLoadTracking: Boolean(loadStatus.loadStatus || loadStatus.loadedLevelId),
      loadStatus: sanitizeLoadStatus(loadStatus.loadStatus),
      loadPct: Number.isFinite(loadStatus.loadPct) ? Math.max(0, Math.min(100, loadStatus.loadPct)) : 100,
      loadedLevelId: sanitizeLevelId(loadStatus.loadedLevelId || this.room.levelId),
      reconnectToken: token,
      disconnectTimer: null,
    });
    this.hostToken = token;
  }

  bindPlayerSender(playerId, sendFn) {
    this.senders.set(playerId, sendFn);
  }

  getHostInitEnvelope() {
    return {
      type: 'room_joined',
      room: this.serializeRoom(),
      clientId: this.hostId,
      reconnectToken: this.hostToken,
    };
  }

  getAuthorityInfo() {
    let connectedCount = 0;
    for (const p of this.room.players.values()) {
      if (p.connected !== false) connectedCount += 1;
    }
    return {
      hostId: this.hostId,
      hostEpoch: this.room.hostEpoch || 1,
      started: Boolean(this.room.started),
      playerCount: connectedCount || this.room.players.size,
    };
  }

  serializeRoom() {
    return {
      code: this.room.code,
      levelId: this.room.levelId,
      maxPlayers: this.room.maxPlayers,
      started: this.room.started,
      phase: this.room.phase || (this.room.started ? 'diving' : 'lobby'),
      diveSeq: this.room.diveSeq || 0,
      hostEpoch: this.room.hostEpoch || 1,
      players: Array.from(this.room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        ready: Boolean(p.ready),
        isHost: Boolean(p.isHost),
        connected: p.connected !== false,
        loadStatus: p.loadStatus || 'ready',
        loadPct: Number.isFinite(p.loadPct) ? p.loadPct : 100,
        loadedLevelId: p.loadedLevelId || this.room.levelId,
      })),
    };
  }

  exportSnapshot() {
    return {
      code: this.room.code,
      levelId: this.room.levelId,
      maxPlayers: this.room.maxPlayers,
      started: this.room.started,
      phase: this.room.phase || (this.room.started ? 'diving' : 'lobby'),
      diveSeq: this.room.diveSeq || 0,
      hostEpoch: this.room.hostEpoch || 1,
      seq: this.seq,
      bodyRecoveredBy: this.room.bodyRecoveredBy || null,
      checkpoints: Array.from(this.room.sharedCheckpoints),
      collectibles: Array.from(this.room.sharedCollectibles),
      openedHatches: Array.from(this.room.openedHatches || []),
      cutSnags: Array.from(this.room.cutSnags || []),
      placedMarkers: Array.from(this.room.placedMarkers || []),
      playerLines: Array.from(this.room.playerLines.entries()).map(([pid, d]) => ({
        playerId: pid,
        ...d,
      })),
      players: Array.from(this.room.players.values()).map((p) => ({
        id: p.id,
        joinSeq: p.joinSeq || 1,
        name: p.name,
        ready: Boolean(p.ready),
        isHost: Boolean(p.isHost),
        connected: p.connected !== false,
        hasLoadTracking: Boolean(p.hasLoadTracking),
        loadStatus: p.loadStatus || 'ready',
        loadPct: Number.isFinite(p.loadPct) ? p.loadPct : 100,
        loadedLevelId: p.loadedLevelId || this.room.levelId,
        reconnectToken: p.reconnectToken,
      })),
    };
  }

  static fromSnapshot(snapshot, { departingHostId = null, newHostId, newHostName = 'Lead Diver', bumpEpoch = false } = {}) {
    const baseEpoch = Number.isFinite(snapshot.hostEpoch) ? snapshot.hostEpoch : 1;
    const coord = new P2pRoomCoordinator({
      code: snapshot.code,
      hostId: newHostId,
      hostName: newHostName,
      levelId: snapshot.levelId,
      maxPlayers: snapshot.maxPlayers,
      hostEpoch: bumpEpoch ? baseEpoch + 1 : baseEpoch,
    });
    coord.room.players.clear();
    coord.senders.clear();
    coord.room.started = Boolean(snapshot.started);
    coord.room.phase = snapshot.phase || (coord.room.started ? 'diving' : 'lobby');
    coord.room.diveSeq = snapshot.diveSeq || 0;
    coord.room.bodyRecoveredBy = snapshot.bodyRecoveredBy || null;
    coord.room.sharedCheckpoints = new Set(snapshot.checkpoints || []);
    coord.room.sharedCollectibles = new Set(snapshot.collectibles || []);
    coord.room.openedHatches = new Set(snapshot.openedHatches || []);
    coord.room.cutSnags = new Set(snapshot.cutSnags || []);
    coord.room.placedMarkers = new Set(snapshot.placedMarkers || []);
    coord.room.playerLines = new Map();
    for (const pl of snapshot.playerLines || []) {
      if (pl?.playerId && pl.playerId !== departingHostId) {
        coord.room.playerLines.set(pl.playerId, {
          chains: pl.chains || [],
          reelingActive: Boolean(pl.reelingActive),
        });
      }
    }

    let maxSeq = snapshot.seq || 2;
    for (const p of snapshot.players || []) {
      if (!p || p.id === departingHostId) continue;
      const js = p.joinSeq || maxSeq;
      if (js >= maxSeq) maxSeq = js + 1;
      const becameHost = p.id === newHostId;
      coord.room.players.set(p.id, {
        id: p.id,
        joinSeq: js,
        name: becameHost && newHostName && newHostName !== 'Lead Diver' ? sanitizeName(newHostName, p.name) : p.name,
        ready: becameHost ? true : Boolean(p.ready),
        isHost: becameHost,
        connected: becameHost ? true : p.connected !== false,
        hasLoadTracking: Boolean(p.hasLoadTracking),
        loadStatus: p.loadStatus || 'ready',
        loadPct: Number.isFinite(p.loadPct) ? p.loadPct : 100,
        loadedLevelId: p.loadedLevelId || coord.room.levelId,
        reconnectToken: p.reconnectToken || randomToken(),
        disconnectTimer: null,
      });
    }
    if (newHostId && !coord.room.players.has(newHostId)) {
      coord.room.players.set(newHostId, {
        id: newHostId,
        joinSeq: maxSeq++,
        name: sanitizeName(newHostName, 'Lead Diver'),
        ready: true,
        isHost: true,
        connected: true,
        hasLoadTracking: true,
        loadStatus: 'ready',
        loadPct: 100,
        loadedLevelId: coord.room.levelId,
        reconnectToken: randomToken(),
        disconnectTimer: null,
      });
    }
    coord.seq = maxSeq;
    coord.hostId = newHostId;
    coord.hostToken = coord.room.players.get(newHostId)?.reconnectToken || randomToken();
    return coord;
  }

  _sendTo(playerId, msg) {
    try {
      this.senders.get(playerId)?.(msg);
    } catch {
      // ignore transient peer transport close
    }
  }

  _broadcast(msg, excludeId = null) {
    const attachSnapshot =
      msg?.type === 'room_update' ||
      msg?.type === 'dive_preparing' ||
      msg?.type === 'dive_started' ||
      msg?.type === 'returned_to_lobby' ||
      msg?.type === 'peer_checkpoint' ||
      msg?.type === 'peer_collectible' ||
      msg?.type === 'peer_wreck_action' ||
      msg?.type === 'peer_body_recovered' ||
      msg?.type === 'peer_guideline';
    const payload = attachSnapshot ? { ...msg, syncState: this.exportSnapshot() } : msg;
    for (const pid of this.room.players.keys()) {
      if (pid !== excludeId) {
        this._sendTo(pid, payload);
      }
    }
  }

  _getConnectedLoadingMember() {
    return Array.from(this.room.players.values()).find(
      (m) =>
        m.connected !== false &&
        m.hasLoadTracking &&
        (m.loadedLevelId !== this.room.levelId || m.loadStatus === 'loading')
    );
  }

  _launchDive() {
    this.room.phase = 'diving';
    this.room.started = true;
    this.room.diveSeq = (this.room.diveSeq || 0) + 1;
    this.room.sharedCheckpoints = new Set();
    this.room.sharedCollectibles = new Set();
    this.room.openedHatches = new Set();
    this.room.cutSnags = new Set();
    this.room.placedMarkers = new Set();
    this.room.playerLines = new Map();
    this.room.bodyRecoveredBy = null;
    this._broadcast({
      type: 'dive_started',
      levelId: this.room.levelId,
      diveSeq: this.room.diveSeq,
      room: this.serializeRoom(),
    });
  }

  markDisconnected(playerId) {
    const p = this.room.players.get(playerId);
    if (!p || p.isHost) return;
    p.connected = false;
    if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    const graceMs = this.room.started ? DIVE_GRACE_MS : LOBBY_GRACE_MS;
    p.disconnectTimer = setTimeout(() => {
      if (this.room.players.get(playerId)?.connected === false) {
        this.removePlayer(playerId);
      }
    }, graceMs);
    p.disconnectTimer.unref?.();
    this._broadcast({ type: 'room_update', room: this.serializeRoom() });
  }

  removePlayer(playerId) {
    const existing = this.room.players.get(playerId);
    if (existing?.disconnectTimer) clearTimeout(existing.disconnectTimer);
    this.room.players.delete(playerId);
    this.senders.delete(playerId);
    this._broadcast({ type: 'room_update', leftPlayerId: playerId, room: this.serializeRoom() });
  }

  handleRemoteJoin(msg, sendFn, explicitPlayerId = null) {
    // Migrate existing slot seamlessly if a refreshed client presents its reconnectToken under a new peerId
    const reqToken = typeof msg.reconnectToken === 'string' && msg.reconnectToken ? msg.reconnectToken : '';
    if (explicitPlayerId && reqToken && !this.room.players.has(explicitPlayerId)) {
      for (const [oldId, oldMember] of this.room.players.entries()) {
        if (!oldMember.isHost && oldMember.reconnectToken === reqToken) {
          if (oldMember.disconnectTimer) {
            clearTimeout(oldMember.disconnectTimer);
            oldMember.disconnectTimer = null;
          }
          this.room.players.delete(oldId);
          this.senders.delete(oldId);
          oldMember.id = explicitPlayerId;
          oldMember.connected = true;
          this.room.players.set(explicitPlayerId, oldMember);
          if (this.room.playerLines?.has(oldId)) {
            this.room.playerLines.set(explicitPlayerId, this.room.playerLines.get(oldId));
            this.room.playerLines.delete(oldId);
          }
          if (this.room.bodyRecoveredBy === oldId) {
            this.room.bodyRecoveredBy = explicitPlayerId;
          }
          break;
        }
      }
    }

    // Re-attach cleanly if an existing player with this peerId reconnects
    if (explicitPlayerId && this.room.players.has(explicitPlayerId)) {
      const existing = this.room.players.get(explicitPlayerId);
      if (existing.disconnectTimer) {
        clearTimeout(existing.disconnectTimer);
        existing.disconnectTimer = null;
      }
      existing.connected = true;
      existing.name = sanitizeName(msg.name, existing.name);
      this.senders.set(explicitPlayerId, sendFn);
      sendFn({
        type: 'room_joined',
        room: this.serializeRoom(),
        clientId: explicitPlayerId,
        reconnectToken: existing.reconnectToken,
        syncState: this.exportSnapshot(),
      });
      this._broadcast({ type: 'room_update', room: this.serializeRoom() }, explicitPlayerId);
      if (this.room.started) {
        sendFn({
          type: 'dive_started',
          levelId: this.room.levelId,
          diveSeq: this.room.diveSeq,
          rejoined: true,
          lateJoin: !msg.preserveDive,
          preserveDive: Boolean(msg.preserveDive),
          checkpoints: Array.from(this.room.sharedCheckpoints),
          collectibles: Array.from(this.room.sharedCollectibles),
          openedHatches: Array.from(this.room.openedHatches || []),
          cutSnags: Array.from(this.room.cutSnags || []),
          placedMarkers: Array.from(this.room.placedMarkers || []),
          playerLines: Array.from(this.room.playerLines.entries()).map(([pid, data]) => ({
            playerId: pid,
            ...data,
          })),
          bodyRecoveredBy: this.room.bodyRecoveredBy || null,
          room: this.serializeRoom(),
        });
      }
      return explicitPlayerId;
    }

    // Evict stale disconnected slots if room appears full from ungraceful drops
    if (this.room.players.size >= this.room.maxPlayers) {
      const disconnectedEntry = Array.from(this.room.players.values()).find((m) => !m.isHost && m.connected === false);
      if (disconnectedEntry) {
        if (disconnectedEntry.disconnectTimer) clearTimeout(disconnectedEntry.disconnectTimer);
        this.room.players.delete(disconnectedEntry.id);
        this.senders.delete(disconnectedEntry.id);
      }
    }

    if (this.room.players.size >= this.room.maxPlayers) {
      sendFn({ type: 'error', message: `Room "${this.room.code}" already has ${this.room.maxPlayers} divers.` });
      return null;
    }

    const joinSeq = this.seq++;
    const playerId = explicitPlayerId || `p2p-${joinSeq}`;
    const token = randomToken();
    const hasJoinTracking = Boolean(msg.loadStatus || msg.loadedLevelId);
    const loadedLevelId = msg.loadedLevelId ? sanitizeLevelId(msg.loadedLevelId) : this.room.levelId;
    const loadStatus = msg.loadStatus === 'loading' ? 'loading' : 'ready';
    const member = {
      id: playerId,
      joinSeq,
      name: sanitizeName(msg.name, 'Buddy Diver'),
      ready: true,
      isHost: false,
      connected: true,
      hasLoadTracking: hasJoinTracking,
      loadStatus,
      loadPct: loadStatus === 'ready' ? 100 : 0,
      loadedLevelId,
      reconnectToken: token,
      disconnectTimer: null,
    };
    this.room.players.set(playerId, member);
    this.senders.set(playerId, sendFn);

    sendFn({
      type: 'room_joined',
      room: this.serializeRoom(),
      clientId: playerId,
      reconnectToken: token,
      syncState: this.exportSnapshot(),
    });
    this._broadcast(
      {
        type: 'room_update',
        room: this.serializeRoom(),
        joinedMidDiveName: this.room.started ? member.name : undefined,
      },
      playerId
    );

    // Drop late joiners directly into the start of an active dive (or crew sync screen)
    if (this.room.started) {
      sendFn({
        type: 'dive_started',
        levelId: this.room.levelId,
        diveSeq: this.room.diveSeq,
        rejoined: true,
        lateJoin: true,
        checkpoints: Array.from(this.room.sharedCheckpoints),
        collectibles: Array.from(this.room.sharedCollectibles),
        openedHatches: Array.from(this.room.openedHatches || []),
        cutSnags: Array.from(this.room.cutSnags || []),
        placedMarkers: Array.from(this.room.placedMarkers || []),
        playerLines: Array.from(this.room.playerLines.entries()).map(([pid, data]) => ({
          playerId: pid,
          ...data,
        })),
        bodyRecoveredBy: this.room.bodyRecoveredBy || null,
        room: this.serializeRoom(),
      });
    } else if (this.room.phase === 'preparing') {
      sendFn({
        type: 'dive_preparing',
        levelId: this.room.levelId,
        diveSeq: this.room.diveSeq,
        room: this.serializeRoom(),
      });
    }
    return playerId;
  }

  handleRemoteRejoin(msg, sendFn) {
    const token = typeof msg.reconnectToken === 'string' ? msg.reconnectToken : '';
    let target = null;
    for (const p of this.room.players.values()) {
      if (token && p.reconnectToken === token) {
        target = p;
        break;
      }
    }
    if (!target) {
      sendFn({ type: 'error', message: `Session in room "${this.room.code}" expired.` });
      return null;
    }
    if (target.disconnectTimer) {
      clearTimeout(target.disconnectTimer);
      target.disconnectTimer = null;
    }
    target.connected = true;
    if (typeof msg.name === 'string' && msg.name.trim()) {
      target.name = sanitizeName(msg.name, target.name);
    }
    this.senders.set(target.id, sendFn);

    sendFn({
      type: 'room_joined',
      room: this.serializeRoom(),
      clientId: target.id,
      reconnectToken: target.reconnectToken,
      rejoined: true,
    });
    this._broadcast({ type: 'room_update', room: this.serializeRoom() }, target.id);

    if (this.room.started) {
      sendFn({
        type: 'dive_started',
        levelId: this.room.levelId,
        diveSeq: this.room.diveSeq,
        rejoined: true,
        checkpoints: Array.from(this.room.sharedCheckpoints),
        collectibles: Array.from(this.room.sharedCollectibles),
        openedHatches: Array.from(this.room.openedHatches || []),
        cutSnags: Array.from(this.room.cutSnags || []),
        placedMarkers: Array.from(this.room.placedMarkers || []),
        playerLines: Array.from(this.room.playerLines.entries()).map(([pid, data]) => ({
          playerId: pid,
          ...data,
        })),
        bodyRecoveredBy: this.room.bodyRecoveredBy || null,
        room: this.serializeRoom(),
      });
    } else if (this.room.phase === 'preparing') {
      sendFn({
        type: 'dive_preparing',
        levelId: this.room.levelId,
        diveSeq: this.room.diveSeq,
        room: this.serializeRoom(),
      });
    }
    return target.id;
  }

  handleMessage(playerId, msg) {
    if (!msg || typeof msg !== 'object') return;
    const p = this.room.players.get(playerId);
    if (!p) return;

    switch (msg.type) {
      case 'set_level': {
        if (!p.isHost) return;
        const nextLevelId = sanitizeLevelId(msg.levelId);
        if (this.room.levelId === nextLevelId) return;
        this.room.levelId = nextLevelId;
        this.room.started = false;
        this.room.phase = 'lobby';
        for (const member of this.room.players.values()) {
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
        this._broadcast({ type: 'room_update', room: this.serializeRoom() });
        break;
      }

      case 'set_max_players': {
        if (!p.isHost) return;
        const nextMax = Math.max(2, Math.min(4, Number(msg.maxPlayers) || 4));
        this.room.maxPlayers = Math.max(nextMax, this.room.players.size);
        this._broadcast({ type: 'room_update', room: this.serializeRoom() });
        break;
      }

      case 'set_ready': {
        p.ready = Boolean(msg.ready);
        this._broadcast({ type: 'room_update', room: this.serializeRoom() });
        break;
      }

      case 'set_player_status': {
        const prevStatus = p.loadStatus;
        const prevPct = p.loadPct;
        const prevLvl = p.loadedLevelId;
        const prevTracked = p.hasLoadTracking;
        p.hasLoadTracking = true;
        if (typeof msg.loadStatus === 'string') p.loadStatus = sanitizeLoadStatus(msg.loadStatus);
        if (Number.isFinite(msg.loadPct)) p.loadPct = Math.max(0, Math.min(100, Math.round(msg.loadPct)));
        if (typeof msg.loadedLevelId === 'string') p.loadedLevelId = sanitizeLevelId(msg.loadedLevelId);
        if (
          !prevTracked ||
          prevStatus !== p.loadStatus ||
          prevPct !== p.loadPct ||
          prevLvl !== p.loadedLevelId
        ) {
          this._broadcast({ type: 'room_update', room: this.serializeRoom() });
        }
        if (this.room.phase === 'preparing' && !this._getConnectedLoadingMember()) {
          this._launchDive();
        }
        break;
      }

      case 'prepare_dive': {
        if (!p.isHost) return;
        if (!this._getConnectedLoadingMember()) {
          this._launchDive();
        } else {
          this.room.phase = 'preparing';
          this._broadcast({
            type: 'dive_preparing',
            levelId: this.room.levelId,
            diveSeq: this.room.diveSeq || 0,
            room: this.serializeRoom(),
          });
        }
        break;
      }

      case 'cancel_prepare': {
        if (!p.isHost) return;
        this.room.phase = 'lobby';
        this._broadcast({ type: 'returned_to_lobby', room: this.serializeRoom() });
        break;
      }

      case 'start_dive': {
        if (!p.isHost) return;
        const waitingMember = !msg.force ? this._getConnectedLoadingMember() : null;
        if (waitingMember) {
          this.room.phase = 'preparing';
          this._broadcast({
            type: 'dive_preparing',
            levelId: this.room.levelId,
            diveSeq: this.room.diveSeq || 0,
            room: this.serializeRoom(),
          });
          return;
        }
        this._launchDive();
        break;
      }

      case 'return_to_lobby': {
        if (!p.isHost) return;
        this.room.started = false;
        this.room.phase = 'lobby';
        this.room.sharedCheckpoints.clear();
        this.room.sharedCollectibles.clear();
        this.room.openedHatches?.clear();
        this.room.cutSnags?.clear();
        this.room.placedMarkers?.clear();
        this.room.playerLines.clear();
        this.room.bodyRecoveredBy = null;
        this._broadcast({ type: 'returned_to_lobby', room: this.serializeRoom() });
        break;
      }

      case 'player_state': {
        const clean = sanitizePlayerState(msg.state);
        if (!clean) return;
        this._broadcast({ type: 'peer_state', playerId: p.id, state: clean }, p.id);
        break;
      }

      case 'diver_signal': {
        const now = Date.now();
        if (now - (p._lastSignalAt || 0) < 600) return;
        p._lastSignalAt = now;
        const rawSig = typeof msg.signal === 'string' ? msg.signal.replace(/[\r\n\t<>]/g, ' ').trim() : '';
        const sig = Array.from(rawSig).slice(0, 24).join('');
        if (!sig) return;
        this._broadcast({ type: 'peer_signal', playerId: p.id, name: p.name, signal: sig }, p.id);
        break;
      }

      case 'silt_event': {
        const pl = msg.plume;
        if (!pl || !Number.isFinite(pl.x) || !Number.isFinite(pl.y)) return;
        this._broadcast(
          {
            type: 'peer_silt',
            playerId: p.id,
            plume: {
              x: pl.x,
              y: pl.y,
              vx: Number.isFinite(pl.vx) ? Math.max(-4, Math.min(4, pl.vx)) : 0,
              vy: Number.isFinite(pl.vy) ? Math.max(-4, Math.min(4, pl.vy)) : -0.22,
              radius: Number.isFinite(pl.radius) ? Math.min(2.5, Math.max(0.4, pl.radius)) : 0.9,
              maxRadius: Number.isFinite(pl.maxRadius) ? Math.min(5.5, Math.max(1.2, pl.maxRadius)) : 3.6,
              life: Number.isFinite(pl.life) ? Math.min(36, Math.max(4, pl.life)) : 26,
              peakAlpha: Number.isFinite(pl.peakAlpha ?? pl.opacity)
                ? Math.min(0.92, Math.max(0.2, pl.peakAlpha ?? pl.opacity))
                : 0.78,
              canBud: false,
              isRust: Boolean(pl.isRust),
            },
          },
          p.id
        );
        break;
      }

      case 'guideline_sync': {
        const chains = sanitizeGuidelineChains(msg.chains);
        const reelingActive = Boolean(msg.reelingActive);
        this.room.playerLines.set(p.id, { chains, reelingActive });
        this._broadcast(
          { type: 'peer_guideline', playerId: p.id, chains, reelingActive },
          p.id
        );
        break;
      }

      case 'checkpoint_hit': {
        const cid = typeof msg.checkpointId === 'string' ? msg.checkpointId.trim().slice(0, 24) : '';
        if (!cid) return;
        this.room.sharedCheckpoints.add(cid);
        this._broadcast({ type: 'peer_checkpoint', playerId: p.id, checkpointId: cid }, p.id);
        break;
      }

      case 'collectible_hit': {
        const colId = typeof msg.collectibleId === 'string' ? msg.collectibleId.trim().slice(0, 32) : '';
        if (!colId) return;
        this.room.sharedCollectibles.add(colId);
        this._broadcast({ type: 'peer_collectible', playerId: p.id, collectibleId: colId }, p.id);
        break;
      }

      case 'wreck_action': {
        const actionKind =
          msg.actionKind === 'hatch' || msg.actionKind === 'snag' || msg.actionKind === 'marker'
            ? msg.actionKind
            : '';
        const targetId = typeof msg.targetId === 'string' ? msg.targetId.slice(0, 48) : '';
        if (actionKind && targetId) {
          if (actionKind === 'hatch') this.room.openedHatches?.add(targetId);
          else if (actionKind === 'snag') this.room.cutSnags?.add(targetId);
          else if (actionKind === 'marker') this.room.placedMarkers?.add(targetId);
          this._broadcast(
            { type: 'peer_wreck_action', playerId: p.id, by: p.name, actionKind, targetId },
            p.id
          );
        }
        break;
      }

      case 'body_recovered': {
        if (!this.room.bodyRecoveredBy) this.room.bodyRecoveredBy = p.id;
        this._broadcast(
          { type: 'peer_body_recovered', playerId: p.id, name: p.name },
          p.id
        );
        break;
      }

      case 'gas_share': {
        const targetPlayerId = typeof msg.targetPlayerId === 'string' ? msg.targetPlayerId.slice(0, 48) : '';
        const gasId = ['EAN32', 'TMX1455', 'O2'].includes(msg.gasId) ? msg.gasId : 'EAN32';
        const amountBar = Math.max(1, Math.min(40, Math.round(Number(msg.amountBar) || 0)));
        if (!targetPlayerId || targetPlayerId === p.id || !this.room.players.has(targetPlayerId) || amountBar <= 0) return;
        this._sendTo(targetPlayerId, {
          type: 'peer_gas_share',
          fromPlayerId: p.id,
          fromName: p.name,
          targetPlayerId,
          gasId,
          amountBar,
        });
        break;
      }

      case 'buddy_rescue': {
        const rescuedId = typeof msg.rescuedId === 'string' ? msg.rescuedId.slice(0, 48) : '';
        if (!rescuedId) return;
        this._broadcast(
          {
            type: 'peer_buddy_rescue',
            rescuerId: p.id,
            rescuerName: p.name,
            rescuedId,
            rescuedName: sanitizeName(msg.rescuedName, 'Buddy'),
            status: msg.status === 'extracted' || msg.status === 'dropped' ? msg.status : 'towing',
          },
          p.id
        );
        break;
      }

      case 'leave_room': {
        if (!p.isHost) {
          this.removePlayer(p.id);
        }
        break;
      }

      case 'ping': {
        this._sendTo(p.id, { type: 'pong', t: msg.t });
        break;
      }
    }
  }

  destroy() {
    for (const p of this.room.players.values()) {
      if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    }
    this.room.players.clear();
    this.senders.clear();
  }
}
