import { stepDiverBody } from '../game/diverBody.js';
import { P2pRoomCoordinator, pickNextP2pHostId } from './p2pRoomHost.js';

/**
 * Dual-transport Multiplayer Client (WebSocket relay when a Node server is present,
 * or serverless WebRTC P2P DataChannels via PeerJS signaling on static hosts / GitHub Pages).
 */

const SESSION_STORAGE_KEY = 'caveDiverLanSession_v1';
const SESSION_MAX_AGE_MS = 10 * 60 * 1000;
const P2P_PREFIX = 'cavediver-v1-';
const P2P_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const P2P_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class LanClient {
  constructor() {
    this.ws = null;
    this.transport = 'auto'; // 'auto' | 'ws' | 'p2p'
    this.clientId = null;
    this.room = null;
    this.rooms = [];
    this.connected = false;
    this.reconnecting = false;
    this.peers = new Map(); // playerId -> interpolated diver state
    this.peer = null; // Primary peer diver alias for 2-player HUD/renderer
    this.handlers = {};
    this.lastSendAt = 0;
    this.lastSiltAt = 0;

    this._outbox = [];
    this._shouldReconnect = false;
    this._reconnectAttempt = 0;
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
    this._activeSession = this._loadPersistedSession(); // { code, reconnectToken, name, isHost, savedAt }
    this._latestLoadStatus = { loadStatus: 'idle', loadPct: 0, loadedLevelId: '' };

    this._transportPromise = null;
    this._p2pPeer = null;
    this._p2pConn = null;
    this._p2pHost = null;
    this._p2pGuestConns = new Map();
    this._lastRoomSnapshot = null;
    this._manualLeave = false;
    this._migrating = false;
    this._pendingLeaveTimer = null;
    this._migrateTimer = null;
  }

  getTransportMode() {
    return this.transport;
  }

  _loadPersistedSession() {
    try {
      const raw = globalThis.sessionStorage?.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.code || !parsed?.reconnectToken) return null;
      if (parsed.savedAt && Date.now() - parsed.savedAt > SESSION_MAX_AGE_MS) {
        globalThis.sessionStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  _savePersistedSession(session) {
    this._activeSession = session ? { ...session, savedAt: Date.now() } : null;
    try {
      if (!this._activeSession) {
        globalThis.sessionStorage?.removeItem(SESSION_STORAGE_KEY);
      } else {
        globalThis.sessionStorage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(this._activeSession));
      }
    } catch {
      // ignore storage restriction
    }
  }

  getSavedSession() {
    return this._activeSession;
  }

  clearSavedSession() {
    this._savePersistedSession(null);
  }

  isHost() {
    if (!this.room || !this.clientId) return false;
    const me = this.room.players.find((p) => p.id === this.clientId);
    return Boolean(me && me.isHost);
  }

  getMyPlayer() {
    if (!this.room || !this.clientId) return null;
    return this.room.players.find((p) => p.id === this.clientId) || null;
  }

  getPlayerSlotIndex() {
    if (!this.room || !this.clientId) return 0;
    const idx = this.room.players.findIndex((p) => p.id === this.clientId);
    return idx >= 0 ? idx : 0;
  }

  _syncPeerAlias() {
    const first = this.peers.values().next();
    this.peer = first.done ? null : first.value;
  }

  getPeers() {
    return Array.from(this.peers.values());
  }

  on(event, fn) {
    this.handlers[event] = fn;
  }

  emit(event, payload) {
    this.handlers[event]?.(payload);
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
      }
    }, 15000);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  _scheduleReconnect() {
    if (!this._shouldReconnect || this._reconnectTimer) return;
    this.reconnecting = true;
    const delay = Math.min(5000, 800 * Math.pow(1.6, this._reconnectAttempt));
    this._reconnectAttempt += 1;
    this.emit('reconnecting', { attempt: this._reconnectAttempt, delayMs: delay });
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (this._shouldReconnect) {
        this.connect();
      }
    }, delay);
  }

  async _detectTransport() {
    if (this.transport === 'ws' || this.transport === 'p2p') {
      return this.transport;
    }
    if (this._transportPromise) return this._transportPromise;

    this._transportPromise = (async () => {
      try {
        const params = new URLSearchParams(globalThis.location?.search || '');
        const forced = (params.get('transport') || '').toLowerCase();
        if (forced === 'p2p' || params.get('p2p') === '1') {
          this.transport = 'p2p';
          this.emit('transport_changed', 'p2p');
          return 'p2p';
        }
        if (forced === 'ws') {
          this.transport = 'ws';
          this.emit('transport_changed', 'ws');
          return 'ws';
        }
        const host = globalThis.location?.hostname || '';
        const proto = globalThis.location?.protocol || '';
        if (host.endsWith('.github.io') || proto === 'file:') {
          this.transport = 'p2p';
          this.emit('transport_changed', 'p2p');
          return 'p2p';
        }

        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), 1400) : null;
        try {
          const res = await fetch('./api/lan-info', {
            cache: 'no-store',
            signal: ctrl?.signal,
          });
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json?.urls)) {
              this.transport = 'ws';
              this.emit('transport_changed', 'ws');
              return 'ws';
            }
          }
        } finally {
          if (timer) clearTimeout(timer);
        }
      } catch {
        // No Node server backend reachable on this origin
      }
      this.transport = 'p2p';
      this.emit('transport_changed', 'p2p');
      return 'p2p';
    })();

    return this._transportPromise;
  }

  _cleanupP2p() {
    if (this._pendingLeaveTimer) {
      clearTimeout(this._pendingLeaveTimer);
      this._pendingLeaveTimer = null;
    }
    if (this._migrateTimer) {
      clearTimeout(this._migrateTimer);
      this._migrateTimer = null;
    }
    this._migrating = false;
    if (this._p2pHost) {
      this._p2pHost.destroy();
      this._p2pHost = null;
    }
    if (this._p2pConn) {
      try {
        this._p2pConn.close();
      } catch {}
      this._p2pConn = null;
    }
    for (const conn of this._p2pGuestConns.values()) {
      try {
        conn.close();
      } catch {}
    }
    this._p2pGuestConns.clear();
    if (this._p2pPeer) {
      try {
        this._p2pPeer.destroy();
      } catch {}
      this._p2pPeer = null;
    }
  }

  _genRoomCode() {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += P2P_CODE_CHARS[Math.floor(Math.random() * P2P_CODE_CHARS.length)];
    }
    return code;
  }

  _makePeer(peerId = undefined) {
    const PeerCtor = globalThis.Peer;
    if (!PeerCtor) {
      throw new Error('WebRTC PeerJS library failed to load.');
    }
    const opts = {
      debug: 0,
      config: { iceServers: P2P_ICE_SERVERS },
    };
    return peerId ? new PeerCtor(peerId, opts) : new PeerCtor(opts);
  }

  _bindHostedCoordinator(coordinator, { onRetryNewCode = null, retryOnTaken = false, attempt = 0 } = {}) {
    this._cleanupP2p();
    const code = coordinator.room.code;
    let peer;
    try {
      peer = this._makePeer(P2P_PREFIX + code);
    } catch (err) {
      this.emit('error', err.message);
      return;
    }
    this._p2pPeer = peer;

    peer.on('open', () => {
      if (this._p2pPeer !== peer) return;
      this.connected = true;
      this.reconnecting = false;
      this._migrating = false;
      this._p2pHost = coordinator;
      coordinator.bindPlayerSender(coordinator.hostId, (outMsg) => {
        this._handleMessage(outMsg);
      });
      this._handleMessage(coordinator.getHostInitEnvelope());
      this.emit('connected');
    });

    peer.on('connection', (conn) => {
      let boundPlayerId = null;
      conn.on('data', (raw) => {
        if (!this._p2pHost || this._p2pPeer !== peer) return;
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'join_room') {
          const pid = this._p2pHost.handleRemoteJoin(data, (reply) => {
            if (conn.open) conn.send(reply);
          });
          if (pid) {
            boundPlayerId = pid;
            this._p2pGuestConns.set(pid, conn);
          }
          return;
        }
        if (data.type === 'rejoin_room') {
          const pid = this._p2pHost.handleRemoteRejoin(data, (reply) => {
            if (conn.open) conn.send(reply);
          });
          if (pid) {
            boundPlayerId = pid;
            this._p2pGuestConns.set(pid, conn);
          }
          return;
        }
        if (boundPlayerId) {
          this._p2pHost.handleMessage(boundPlayerId, data);
        }
      });
      const onDrop = () => {
        if (boundPlayerId && this._p2pHost) {
          this._p2pGuestConns.delete(boundPlayerId);
          this._p2pHost.markDisconnected(boundPlayerId);
        }
      };
      conn.on('close', onDrop);
      conn.on('error', onDrop);
    });

    peer.on('disconnected', () => {
      if (this._p2pPeer !== peer || peer.destroyed) return;
      this.emit('reconnecting', { attempt: 1, delayMs: 800 });
      try {
        peer.reconnect();
      } catch {}
    });

    peer.on('error', (err) => {
      if (this._p2pPeer !== peer) return;
      if (err?.type === 'unavailable-id') {
        if (retryOnTaken && attempt < 12) {
          this._migrateTimer = setTimeout(() => {
            this._bindHostedCoordinator(coordinator, { onRetryNewCode, retryOnTaken, attempt: attempt + 1 });
          }, 380);
          return;
        }
        if (onRetryNewCode && attempt < 4) {
          onRetryNewCode(attempt + 1);
          return;
        }
      }
      this.emit('error', `P2P host error: ${err?.message || err?.type || 'Signaling unavailable'}`);
    });
  }

  _p2pCreateRoom(msg, preferredCode = null, attempt = 0) {
    this._manualLeave = false;
    const code = preferredCode || this._genRoomCode();
    const coordinator = new P2pRoomCoordinator({
      code,
      hostName: msg.name || 'Lead Diver',
      levelId: msg.levelId,
      maxPlayers: msg.maxPlayers || 2,
      loadStatus: this._latestLoadStatus,
    });
    this._bindHostedCoordinator(coordinator, {
      attempt,
      retryOnTaken: false,
      onRetryNewCode: (nextAttempt) => this._p2pCreateRoom(msg, null, nextAttempt),
    });
  }

  _buildFallbackSnapshot(departingHostId) {
    if (this._lastRoomSnapshot && this._lastRoomSnapshot.code === this.room?.code) {
      return this._lastRoomSnapshot;
    }
    const r = this.room;
    if (!r) return null;
    return {
      code: r.code,
      levelId: r.levelId,
      maxPlayers: r.maxPlayers,
      started: Boolean(r.started),
      phase: r.phase || (r.started ? 'diving' : 'lobby'),
      diveSeq: r.diveSeq || 0,
      seq: 10,
      bodyRecoveredBy: null,
      checkpoints: [],
      collectibles: [],
      playerLines: [],
      players: (r.players || [])
        .filter((p) => p.id !== departingHostId)
        .map((p) => ({
          ...p,
          reconnectToken: p.id === this.clientId ? this._activeSession?.reconnectToken : undefined,
        })),
    };
  }

  _handleHostMigration({ snapshot = null, nextHostId = null, departingHostId = null } = {}) {
    if (this._manualLeave || this._migrating || !this.room) return;
    this._migrating = true;

    const snap = snapshot || this._buildFallbackSnapshot(departingHostId);
    if (!snap) {
      this._migrating = false;
      return;
    }
    const resolvedNextHost =
      nextHostId || pickNextP2pHostId(snap.players || this.room.players, departingHostId);
    if (!resolvedNextHost) {
      this._migrating = false;
      return;
    }

    if (resolvedNextHost === this.clientId) {
      // I am the lowest-remaining survivor ("last out is the host") — seamlessly claim host!
      const coordinator = P2pRoomCoordinator.fromSnapshot(snap, {
        departingHostId,
        newHostId: this.clientId,
      });
      this._lastRoomSnapshot = coordinator.exportSnapshot();
      this.emit('host_promoted', { code: coordinator.room.code });
      this._migrateTimer = setTimeout(() => {
        this._bindHostedCoordinator(coordinator, { retryOnTaken: true, attempt: 0 });
      }, 260);
      return;
    }

    // Another survivor is taking over host — reconnect to them cleanly while staying in room/dive
    const rejoinMsg = {
      type: 'rejoin_room',
      code: snap.code,
      reconnectToken: this._activeSession?.reconnectToken || '',
      name: this._activeSession?.name || 'Buddy Diver',
    };
    this._migrateTimer = setTimeout(() => {
      this._migrating = false;
      this._p2pJoinRoom(rejoinMsg, true, 0);
    }, 650);
  }

  _p2pJoinRoom(msg, isRejoin = false, retryAttempt = 0) {
    this._manualLeave = false;
    this._cleanupP2p();
    const cleanCode = String(msg.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!cleanCode) {
      this.emit('error', 'Enter a valid room code.');
      return;
    }

    let peer;
    try {
      peer = this._makePeer();
    } catch (err) {
      this.emit('error', err.message);
      return;
    }
    this._p2pPeer = peer;
    let opened = false;
    const timeout = setTimeout(() => {
      if (!opened && this._p2pPeer === peer) {
        this._cleanupP2p();
        this.emit('error', `Room "${cleanCode}" unreachable via WebRTC P2P. Ask host to keep lobby open.`);
      }
    }, 12000);

    peer.on('open', () => {
      if (this._p2pPeer !== peer) return;
      const conn = peer.connect(P2P_PREFIX + cleanCode, { reliable: true });
      this._p2pConn = conn;
      conn.on('open', () => {
        if (this._p2pConn !== conn) return;
        opened = true;
        clearTimeout(timeout);
        this.connected = true;
        this.reconnecting = false;
        this._migrating = false;
        conn.send({
          ...msg,
          type: isRejoin ? 'rejoin_room' : 'join_room',
          code: cleanCode,
          ...this._latestLoadStatus,
        });
        this.emit('connected');
      });
      conn.on('data', (raw) => {
        if (this._p2pConn !== conn) return;
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'host_handoff') {
          clearTimeout(timeout);
          this._handleHostMigration({
            snapshot: data.snapshot,
            nextHostId: data.nextHostId,
            departingHostId: data.departingHostId,
          });
          return;
        }
        this._handleMessage(data);
      });
      conn.on('close', () => {
        clearTimeout(timeout);
        if (this._p2pConn !== conn) return;
        this._p2pConn = null;
        if (this._manualLeave || !this.room || this._migrating) return;
        // Host vanished abruptly -> promote surviving diver ("last out is host")
        const oldHost = (this.room.players || []).find((p) => p.isHost);
        this._handleHostMigration({ departingHostId: oldHost?.id || null });
      });
      conn.on('error', () => {
        clearTimeout(timeout);
      });
    });

    peer.on('error', (err) => {
      clearTimeout(timeout);
      if (this._p2pPeer !== peer) return;
      if (err?.type === 'peer-unavailable' && isRejoin && retryAttempt < 8) {
        this._migrateTimer = setTimeout(() => {
          this._p2pJoinRoom(msg, true, retryAttempt + 1);
        }, 550);
        return;
      }
      const detail =
        err?.type === 'peer-unavailable'
          ? `Room "${cleanCode}" not found or all divers left.`
          : `P2P connection error: ${err?.message || err?.type || 'Signaling error'}`;
      if (isRejoin) {
        this.clearSavedSession();
        this.room = null;
        this.emit('session_expired', detail);
      }
      this.emit('error', detail);
    });
  }

  _flushOutbox() {
    if (this.transport === 'p2p') {
      const pending = this._outbox.splice(0, this._outbox.length);
      for (const msg of pending) {
        if (msg.type === 'create_room') this._p2pCreateRoom(msg);
        else if (msg.type === 'join_room') this._p2pJoinRoom(msg, false);
        else this.send(msg);
      }
      return;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this._outbox.length > 0) {
      const msg = this._outbox.shift();
      this.ws.send(JSON.stringify(msg));
    }
  }

  async connect() {
    this._shouldReconnect = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    const mode = await this._detectTransport();
    if (mode === 'p2p') {
      this.connected = true;
      this.reconnecting = false;
      this.emit('connected');
      const hasPendingRoomCmd = this._outbox.some(
        (m) => m.type === 'create_room' || m.type === 'join_room' || m.type === 'leave_room'
      );
      if (this._activeSession && !this.room && !hasPendingRoomCmd) {
        if (this._activeSession.isHost) {
          this._p2pCreateRoom(
            {
              type: 'create_room',
              name: this._activeSession.name,
              levelId: this._activeSession.levelId,
              maxPlayers: this._activeSession.maxPlayers || 2,
            },
            this._activeSession.code
          );
        } else {
          this._p2pJoinRoom(
            {
              type: 'rejoin_room',
              code: this._activeSession.code,
              reconnectToken: this._activeSession.reconnectToken,
              name: this._activeSession.name,
            },
            true
          );
        }
      }
      this._flushOutbox();
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener('open', () => {
      if (this.ws !== ws) return;
      this.connected = true;
      this.reconnecting = false;
      this._reconnectAttempt = 0;
      this._startHeartbeat();

      // Reattach dropped active session before sending queued room updates
      const hasPendingRoomCmd = this._outbox.some(
        (m) => m.type === 'create_room' || m.type === 'join_room' || m.type === 'leave_room'
      );
      if (this._activeSession && !hasPendingRoomCmd) {
        ws.send(
          JSON.stringify({
            type: 'rejoin_room',
            code: this._activeSession.code,
            reconnectToken: this._activeSession.reconnectToken,
            name: this._activeSession.name,
          })
        );
      }

      this._flushOutbox();
      this.emit('connected');
    });

    ws.addEventListener('close', () => {
      if (this.ws !== ws) return;
      this.connected = false;
      this._stopHeartbeat();
      this.emit('disconnected');
      if (this._shouldReconnect) {
        this._scheduleReconnect();
      }
    });

    ws.addEventListener('error', () => {
      // Close event handles reconnect scheduling cleanly
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      this._handleMessage(msg);
    });
  }

  _handleMessage(msg) {
      if (msg?.syncState) {
        this._lastRoomSnapshot = msg.syncState;
      }

      switch (msg.type) {
        case 'welcome':
          this.clientId = msg.clientId;
          break;
        case 'rooms_list':
          this.rooms = Array.isArray(msg.rooms) ? msg.rooms : [];
          this.emit('rooms_list', this.rooms);
          break;
        case 'room_joined': {
          this.room = msg.room;
          this.clientId = msg.clientId;
          const myPlayer = this.room?.players?.find((p) => p.id === this.clientId);
          this._savePersistedSession({
            code: msg.room.code,
            reconnectToken: msg.reconnectToken || this._activeSession?.reconnectToken || '',
            name: myPlayer?.name || this._activeSession?.name || 'Diver',
            isHost: Boolean(myPlayer?.isHost),
            levelId: msg.room.levelId,
            maxPlayers: msg.room.maxPlayers,
          });
          if (!msg.rejoined) {
            this.peers.clear();
            this._syncPeerAlias();
          }
          // Report our actual client load progress immediately upon joining
          if (this._latestLoadStatus) {
            this.send({
              type: 'set_player_status',
              ...this._latestLoadStatus,
            });
          }
          this.emit('room_update', msg.room);
          break;
        }
        case 'room_update': {
          this.room = msg.room;
          if (msg.leftPlayerId) {
            this.peers.delete(msg.leftPlayerId);
            this._syncPeerAlias();
            this.emit('peer_left', msg.leftPlayerId);
          }
          const activeIds = new Set((msg.room?.players || []).map((p) => p.id));
          for (const pid of this.peers.keys()) {
            if (!activeIds.has(pid)) this.peers.delete(pid);
          }
          this._syncPeerAlias();
          this.emit('room_update', msg.room);
          if (msg.joinedMidDiveName) {
            this.emit('peer_joined_mid_dive', msg.joinedMidDiveName);
          }
          break;
        }
        case 'dive_preparing':
          this.room = msg.room;
          this.emit('dive_preparing', msg);
          break;
        case 'dive_started':
          this.room = msg.room;
          this.peers.clear();
          this.peer = null;
          this.emit('dive_started', msg);
          break;
        case 'returned_to_lobby':
          this.room = msg.room;
          this.peers.clear();
          this.peer = null;
          this.emit('returned_to_lobby', msg.room);
          this.emit('room_update', msg.room);
          break;
        case 'peer_state': {
          const pid = msg.playerId || 'peer';
          let p = this.peers.get(pid);
          if (!p) {
            p = {
              id: pid,
              ...msg.state,
              targetX: msg.state.x,
              targetY: msg.state.y,
              targetAngle: msg.state.angle,
            };
            this.peers.set(pid, p);
          } else {
            p.targetX = msg.state.x;
            p.targetY = msg.state.y;
            p.targetAngle = msg.state.angle;
            p.vx = msg.state.vx;
            p.vy = msg.state.vy;
            p.gasId = msg.state.gasId;
            p.activeBar = msg.state.activeBar;
            p.cnsPercent = msg.state.cnsPercent;
            p.dcsStress = msg.state.dcsStress;
            p.hypoxiaStress = msg.state.hypoxiaStress;
            p.narcosisLevel = msg.state.narcosisLevel;
            p.heartRateBpm = msg.state.heartRateBpm;
            p.cardiacStress = msg.state.cardiacStress;
            p.ceilingM = msg.state.ceilingM;
            p.condition = msg.state.condition;
            p.surfaced = msg.state.surfaced;
            p.healthPct = msg.state.healthPct;
            p.gasRemainingPct = msg.state.gasRemainingPct;
            p.diveTimeSec = msg.state.diveTimeSec;
            p.collectiblesFound = msg.state.collectiblesFound;
            p.exploredPct = msg.state.exploredPct;
            p.totalScore = msg.state.totalScore;
            p.depthM = msg.state.depthM;
            p.torchOn = msg.state.torchOn;
            p.alive = msg.state.alive;
            p.carryingBody = Boolean(msg.state.carryingBody);
            p.name = msg.state.name;
          }
          this._syncPeerAlias();
          break;
        }
        case 'peer_checkpoint':
          this.emit('peer_checkpoint', msg);
          break;
        case 'peer_collectible':
          this.emit('peer_collectible', msg);
          break;
        case 'peer_body_recovered':
          this.emit('peer_body_recovered', msg);
          break;
        case 'peer_signal': {
          const pid = msg.playerId || 'peer';
          const p = this.peers.get(pid);
          if (p) {
            p.signalText = msg.signal;
            p.signalExpiresAt = performance.now() + 4500;
          }
          this.emit('peer_signal', msg);
          break;
        }
        case 'peer_silt':
          this.emit('peer_silt', msg);
          break;
        case 'peer_guideline': {
          const pid = msg.playerId || 'peer';
          const p = this.peers.get(pid);
          if (p) {
            p.guidelineChains = msg.chains || [];
            p.reelingActive = Boolean(msg.reelingActive);
          }
          this.emit('peer_guideline', msg);
          break;
        }
        case 'error':
          if (
            typeof msg.message === 'string' &&
            (msg.message.includes('no longer active') || msg.message.includes('expired'))
          ) {
            this.clearSavedSession();
            this.room = null;
            this.emit('session_expired', msg.message);
          }
          this.emit('error', msg.message);
          break;
      }
  }

  send(payload) {
    if (this.transport === 'p2p') {
      if (this._p2pHost && this.clientId) {
        this._p2pHost.handleMessage(this.clientId, payload);
        return true;
      }
      if (this._p2pConn && this._p2pConn.open) {
        this._p2pConn.send(payload);
        return true;
      }
      return false;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  sendReliable(payload, { replaceType = null } = {}) {
    if (this.send(payload)) return;
    if (replaceType) {
      this._outbox = this._outbox.filter((item) => item.type !== replaceType);
    }
    this._outbox.push(payload);
    this.connect();
  }

  listRooms() {
    if (this.transport === 'p2p') {
      this.rooms = [];
      this.emit('rooms_list', this.rooms);
      return;
    }
    this.sendReliable({ type: 'list_rooms' }, { replaceType: 'list_rooms' });
  }

  ensureConnected() {
    if (!this._shouldReconnect) {
      this.connect();
      return;
    }
    if (this.transport === 'p2p') {
      if (this._p2pPeer && !this._p2pPeer.destroyed && this._p2pPeer.disconnected) {
        try {
          this._p2pPeer.reconnect();
        } catch {}
      }
      if (this._activeSession && !this.room) {
        this.connect();
      }
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this._activeSession && !this.room) {
        this.send({
          type: 'rejoin_room',
          code: this._activeSession.code,
          reconnectToken: this._activeSession.reconnectToken,
          name: this._activeSession.name,
        });
      } else {
        this.send({ type: 'ping', t: Date.now() });
      }
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return;
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnectAttempt = 0;
    this.connect();
  }

  createRoom(name, levelId = 'cenote-el-abismo', maxPlayers = 2) {
    this.clearSavedSession();
    const msg = {
      type: 'create_room',
      name,
      levelId,
      maxPlayers,
      ...this._latestLoadStatus,
    };
    if (this.transport === 'p2p') {
      this._p2pCreateRoom(msg);
      return;
    }
    this.sendReliable(msg, { replaceType: 'create_room' });
  }

  setLevel(levelId) {
    if (!this.room) return;
    this.sendReliable({ type: 'set_level', levelId }, { replaceType: 'set_level' });
  }

  setMaxPlayers(maxPlayers) {
    if (!this.room) return;
    this.sendReliable({ type: 'set_max_players', maxPlayers }, { replaceType: 'set_max_players' });
  }

  joinRoom(code, name) {
    const cleanCode = String(code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    this.clearSavedSession();
    const msg = {
      type: 'join_room',
      code: cleanCode,
      name,
      ...this._latestLoadStatus,
    };
    if (this.transport === 'p2p') {
      this._p2pJoinRoom(msg, false);
      return;
    }
    this.sendReliable(msg, { replaceType: 'join_room' });
  }

  setReady(ready) {
    this.sendReliable({ type: 'set_ready', ready }, { replaceType: 'set_ready' });
  }

  setPlayerStatus(status) {
    this._latestLoadStatus = { ...this._latestLoadStatus, ...status };
    if (!this.room) return;
    this.sendReliable(
      { type: 'set_player_status', ...status },
      { replaceType: 'set_player_status' }
    );
  }

  prepareDive() {
    this.sendReliable({ type: 'prepare_dive' }, { replaceType: 'prepare_dive' });
  }

  cancelPrepare() {
    this.sendReliable({ type: 'cancel_prepare' }, { replaceType: 'cancel_prepare' });
  }

  startDive(force = false) {
    this.sendReliable({ type: 'start_dive', force }, { replaceType: 'start_dive' });
  }

  sendSignal(signal) {
    if (!this.room || !this.connected || !signal) return;
    this.send({ type: 'diver_signal', signal });
  }

  returnToLobby() {
    if (!this.room) return;
    this.sendReliable({ type: 'return_to_lobby' }, { replaceType: 'return_to_lobby' });
  }

  leaveRoom() {
    this._manualLeave = true;
    this.clearSavedSession();
    this._outbox = this._outbox.filter(
      (m) => m.type === 'list_rooms'
    );
    if (this.transport === 'p2p') {
      const currentRoom = this.room;
      const myId = this.clientId;
      if (this._p2pHost && currentRoom) {
        const nextHostId = pickNextP2pHostId(currentRoom.players, myId);
        if (nextHostId) {
          const snapshot = this._p2pHost.exportSnapshot();
          for (const conn of this._p2pGuestConns.values()) {
            try {
              if (conn.open) {
                conn.send({
                  type: 'host_handoff',
                  nextHostId,
                  departingHostId: myId,
                  snapshot,
                });
              }
            } catch {}
          }
          this.room = null;
          this.peers.clear();
          this.peer = null;
          this._lastRoomSnapshot = null;
          this._pendingLeaveTimer = setTimeout(() => this._cleanupP2p(), 160);
          return;
        }
      } else if (this._p2pConn && this._p2pConn.open) {
        try {
          this._p2pConn.send({ type: 'leave_room' });
        } catch {}
        this.room = null;
        this.peers.clear();
        this.peer = null;
        this._lastRoomSnapshot = null;
        this._pendingLeaveTimer = setTimeout(() => this._cleanupP2p(), 90);
        return;
      }
      this.room = null;
      this.peers.clear();
      this.peer = null;
      this._lastRoomSnapshot = null;
      this._cleanupP2p();
      return;
    }

    this.send({ type: 'leave_room' });
    this.room = null;
    this.peers.clear();
    this.peer = null;
    this._lastRoomSnapshot = null;
  }

  sendPlayerState(state) {
    if (!this.room || !this.connected) return;
    const now = performance.now();
    if (now - this.lastSendAt < 50) return; // 20 Hz sync
    this.lastSendAt = now;
    this.send({ type: 'player_state', state });
  }

  sendCheckpoint(checkpointId) {
    if (!this.room || !this.connected) return;
    this.send({ type: 'checkpoint_hit', checkpointId });
  }

  sendCollectible(collectibleId) {
    if (!this.room || !this.connected) return;
    this.send({ type: 'collectible_hit', collectibleId });
  }

  sendBodyRecovered() {
    if (!this.room || !this.connected) return;
    this.send({ type: 'body_recovered' });
  }

  sendGuidelineSync(chains, reelingActive = false) {
    if (!this.room || !this.connected) return;
    this.send({ type: 'guideline_sync', chains, reelingActive });
  }

  sendSiltEvent(plume) {
    if (!this.room || !this.connected || !plume) return;
    const now = performance.now();
    if (now - this.lastSiltAt < 250) return; // Throttle silt propagation
    this.lastSiltAt = now;
    this.send({ type: 'silt_event', plume });
  }

  stepPeerInterpolation(dt) {
    for (const p of this.peers.values()) {
      const alpha = Math.min(1, dt * 14);
      p.x += (p.targetX - p.x) * alpha;
      p.y += (p.targetY - p.y) * alpha;
      // Shortest angle interpolation
      let diff = p.targetAngle - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.angle += diff * alpha;
      const peerSpeed = Math.hypot(p.vx || 0, p.vy || 0);
      stepDiverBody(p, dt, { thrustMag: Math.min(1, peerSpeed / 3.5) });
    }
  }
}
