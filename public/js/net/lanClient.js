import { stepDiverBody } from '../game/diverBody.js';
import { P2pRoomCoordinator, pickNextP2pHostId } from './p2pRoomHost.js';

/**
 * Dual-transport Multiplayer Client (WebSocket relay when a Node server is present,
 * or serverless WebRTC P2P mesh DataChannels via Trystero Nostr relays on static hosts / GitHub Pages).
 */

const SESSION_STORAGE_KEY = 'caveDiverLanSession_v1';
const SESSION_MAX_AGE_MS = 10 * 60 * 1000;
const TRYSTERO_APP_ID = 'cave-diver-coop-v1';
const TRYSTERO_RELAYS = [
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.bitcoiner.social',
  'wss://relay.nostr.bg',
  'wss://nostr.mom',
];
const P2P_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let trysteroModulePromise = null;
function loadTrystero() {
  if (!trysteroModulePromise) {
    trysteroModulePromise = import('../vendor/trystero-nostr.min.js?v=40');
  }
  return trysteroModulePromise;
}

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
    this._trysteroRoom = null;
    this._p2pSendPkt = null;
    this._p2pHostPeerId = null;
    this._p2pHost = null;
    this._p2pGen = 0;
    this._p2pJoinReqId = 0;
    this._p2pPendingFlush = null;
    this._p2pLastLeaveDoneAt = 0;
    this._p2pJoinTimer = null;
    this._p2pJoinRetryTimer = null;
    this._p2pHeartbeatTimer = null;
    this._p2pLastHostRxAt = 0;
    this._p2pLastPeerRxAt = new Map();
    this._p2pJoinAcked = false;
    this._p2pPendingJoin = null;
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
    this._p2pGen += 1;
    if (this._pendingLeaveTimer) {
      clearTimeout(this._pendingLeaveTimer);
      this._pendingLeaveTimer = null;
    }
    if (this._migrateTimer) {
      clearTimeout(this._migrateTimer);
      this._migrateTimer = null;
    }
    if (this._p2pJoinTimer) {
      clearTimeout(this._p2pJoinTimer);
      this._p2pJoinTimer = null;
    }
    if (this._p2pJoinRetryTimer) {
      clearInterval(this._p2pJoinRetryTimer);
      this._p2pJoinRetryTimer = null;
    }
    if (this._p2pHeartbeatTimer) {
      clearInterval(this._p2pHeartbeatTimer);
      this._p2pHeartbeatTimer = null;
    }
    this._p2pLastHostRxAt = 0;
    this._p2pLastPeerRxAt.clear();
    this._migrating = false;
    this._p2pHostPeerId = null;
    this._p2pSendPkt = null;
    this._p2pJoinAcked = false;
    this._p2pPendingJoin = null;
    if (this._p2pHost) {
      this._p2pHost.destroy();
      this._p2pHost = null;
    }
    if (this._trysteroRoom) {
      try {
        this._trysteroRoom.leave();
      } catch {}
      this._trysteroRoom = null;
    }
  }

  _genRoomCode() {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += P2P_CODE_CHARS[Math.floor(Math.random() * P2P_CODE_CHARS.length)];
    }
    return code;
  }

  _attachTrysteroMesh(trysteroRoom, code, gen) {
    const [sendPkt, onPkt] = trysteroRoom.makeAction('coop');
    this._trysteroRoom = trysteroRoom;
    this._p2pSendPkt = sendPkt;
    this._p2pLastHostRxAt = Date.now();
    this._p2pLastPeerRxAt.clear();

    const sendJoinToPeer = (peerId) => {
      if (!this._p2pPendingJoin || this._p2pJoinAcked) return;
      try {
        this._p2pSendPkt?.(
          {
            ...this._p2pPendingJoin,
            type: 'join_room',
            code,
            ...this._latestLoadStatus,
          },
          peerId
        );
      } catch {}
    };

    trysteroRoom.onPeerJoin((peerId) => {
      if (this._p2pGen !== gen || this._trysteroRoom !== trysteroRoom) return;
      this._p2pLastPeerRxAt.set(peerId, Date.now());
      if (this._p2pHost) {
        try {
          sendPkt({ type: 'host_announce', hostId: this.clientId, code }, peerId);
        } catch {}
      } else {
        sendJoinToPeer(peerId);
      }
    });

    trysteroRoom.onPeerLeave((peerId) => {
      if (this._p2pGen !== gen || this._trysteroRoom !== trysteroRoom) return;
      this._p2pLastPeerRxAt.delete(peerId);
      if (this._p2pHost) {
        // Remove dropped/departed diver cleanly once so their slot can be reused on rejoin
        if (this._p2pHost.room.players.has(peerId)) {
          this._p2pHost.removePlayer(peerId);
        }
        return;
      }
      if (this._manualLeave || !this.room || this._migrating) return;
      const wasHost =
        peerId === this._p2pHostPeerId ||
        Boolean((this.room.players || []).find((p) => p.id === peerId && p.isHost));
      if (!wasHost) return;
      if (this._migrateTimer) clearTimeout(this._migrateTimer);
      // Brief grace in case a graceful host_handoff packet is in flight right ahead of drop
      this._migrateTimer = setTimeout(() => {
        if (this._p2pGen !== gen || this._trysteroRoom !== trysteroRoom) return;
        if (!this._p2pHost && !this._manualLeave && this.room && !this._migrating) {
          this._handleHostMigration({ departingHostId: peerId });
        }
      }, 150);
    });

    onPkt((data, peerId) => {
      if (this._p2pGen !== gen || this._trysteroRoom !== trysteroRoom) return;
      if (!data || typeof data !== 'object') return;
      const now = Date.now();
      this._p2pLastPeerRxAt.set(peerId, now);
      if (peerId === this._p2pHostPeerId || data.type === 'host_beat') {
        this._p2pLastHostRxAt = now;
      }

      if (data.type === 'host_beat') {
        if (!this._p2pHost && data.hostId && !this._p2pHostPeerId) {
          this._p2pHostPeerId = data.hostId;
        }
        return;
      }

      if (data.type === 'host_handoff') {
        if (this._migrateTimer) {
          clearTimeout(this._migrateTimer);
          this._migrateTimer = null;
        }
        this._handleHostMigration({
          snapshot: data.snapshot,
          nextHostId: data.nextHostId,
          departingHostId: data.departingHostId || peerId,
        });
        return;
      }

      if (data.type === 'host_announce') {
        if (!this._p2pHost) {
          this._p2pHostPeerId = data.hostId || peerId;
          this._p2pLastHostRxAt = now;
          sendJoinToPeer(this._p2pHostPeerId);
        }
        return;
      }

      if (this._p2pHost) {
        if (data.type === 'join_room' || data.type === 'rejoin_room') {
          this._p2pHost.handleRemoteJoin(
            { ...data, type: 'join_room' },
            (reply) => {
              if (this._p2pGen === gen && this._p2pSendPkt) {
                try {
                  this._p2pSendPkt(reply, peerId);
                } catch {}
              }
            },
            peerId
          );
          return;
        }
        this._p2pHost.handleMessage(peerId, data);
        return;
      }

      // Guest branch
      if (data.type === 'room_joined') {
        this._p2pJoinAcked = true;
        this._p2pHostPeerId = peerId;
        this._p2pLastHostRxAt = now;
        if (this._p2pJoinTimer) {
          clearTimeout(this._p2pJoinTimer);
          this._p2pJoinTimer = null;
        }
        if (this._p2pJoinRetryTimer) {
          clearInterval(this._p2pJoinRetryTimer);
          this._p2pJoinRetryTimer = null;
        }
      } else if (data.type === 'room_update') {
        const hostPlayer = (data.room?.players || []).find((p) => p.isHost);
        if (hostPlayer?.id) {
          this._p2pHostPeerId = hostPlayer.id;
          this._p2pLastHostRxAt = now;
        }
      }
      this._handleMessage(data);
    });

    // Fast P2P Host beacon & dead-peer / crashed-host watchdog (avoids 15-30s WebRTC ICE wait)
    this._p2pHeartbeatTimer = setInterval(() => {
      if (this._p2pGen !== gen || this._trysteroRoom !== trysteroRoom || this._manualLeave) return;
      const now = Date.now();
      const peersMap = trysteroRoom.getPeers?.() || {};

      if (this._p2pHost) {
        try {
          sendPkt({ type: 'host_beat', hostId: this.clientId, code });
        } catch {}
        for (const p of Array.from(this._p2pHost.room.players.values())) {
          if (p.id === this.clientId) continue;
          const pc = peersMap[p.id];
          const silentMs = now - (this._p2pLastPeerRxAt.get(p.id) || now);
          const pcState = pc?.connectionState || '';
          const iceState = pc?.iceConnectionState || '';
          const dead =
            pcState === 'failed' ||
            pcState === 'closed' ||
            iceState === 'failed' ||
            iceState === 'closed' ||
            ((pcState === 'disconnected' || iceState === 'disconnected') && silentMs > 2500);
          if (dead) {
            this._p2pHost.removePlayer(p.id);
          }
        }
        return;
      }

      if (this.room && !this._migrating && this._p2pHostPeerId) {
        const pc = peersMap[this._p2pHostPeerId];
        const silentMs = now - (this._p2pLastHostRxAt || now);
        const pcState = pc?.connectionState || '';
        const iceState = pc?.iceConnectionState || '';
        const hostLost =
          pcState === 'failed' ||
          pcState === 'closed' ||
          iceState === 'failed' ||
          iceState === 'closed' ||
          ((pcState === 'disconnected' || iceState === 'disconnected') && silentMs > 2000) ||
          silentMs > 4200;
        if (hostLost) {
          this._handleHostMigration({ departingHostId: this._p2pHostPeerId });
        }
      }
    }, 1000);
  }

  async _p2pCreateRoom(msg, preferredCode = null) {
    this._manualLeave = false;
    this._p2pJoinReqId += 1;
    this._cleanupP2p();
    const gen = this._p2pGen;
    const code = preferredCode || this._genRoomCode();

    let trystero;
    try {
      trystero = await loadTrystero();
    } catch (err) {
      this.emit('error', `WebRTC P2P engine failed to load: ${err?.message || err}`);
      return;
    }
    if (this._p2pGen !== gen) return;

    const myId = trystero.selfId;
    this.clientId = myId;
    this._p2pHostPeerId = myId;

    const coordinator = new P2pRoomCoordinator({
      code,
      hostId: myId,
      hostName: msg.name || 'Lead Diver',
      levelId: msg.levelId,
      maxPlayers: msg.maxPlayers || 2,
      loadStatus: this._latestLoadStatus,
    });
    this._p2pHost = coordinator;
    coordinator.bindPlayerSender(myId, (outMsg) => {
      this._handleMessage(outMsg);
    });

    const trysteroRoom = trystero.joinRoom(
      { appId: TRYSTERO_APP_ID, relayUrls: TRYSTERO_RELAYS },
      `room-${code}`
    );
    this._attachTrysteroMesh(trysteroRoom, code, gen);

    this.connected = true;
    this.reconnecting = false;
    this._migrating = false;
    this._handleMessage(coordinator.getHostInitEnvelope());
    this.emit('connected');
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
    if (this._manualLeave || this._migrating || !this.room || this._p2pHost) return;
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
      // I am the next remaining survivor ("last out is the host") — promote in-place!
      const coordinator = P2pRoomCoordinator.fromSnapshot(snap, {
        departingHostId,
        newHostId: this.clientId,
      });
      this._p2pHost = coordinator;
      this._p2pHostPeerId = this.clientId;
      coordinator.bindPlayerSender(this.clientId, (pkt) => this._handleMessage(pkt));

      const activePeers = this._trysteroRoom ? this._trysteroRoom.getPeers() : {};
      for (const p of coordinator.room.players) {
        if (p.id === this.clientId) continue;
        if (activePeers[p.id]) {
          coordinator.bindPlayerSender(p.id, (pkt) => {
            try {
              this._p2pSendPkt?.(pkt, p.id);
            } catch {}
          });
          try {
            this._p2pSendPkt?.(
              { type: 'host_announce', hostId: this.clientId, code: coordinator.room.code },
              p.id
            );
          } catch {}
        } else {
          coordinator.markDisconnected(p.id);
        }
      }

      const freshSnap = coordinator.exportSnapshot();
      this._lastRoomSnapshot = freshSnap;
      if (this._activeSession) {
        this._savePersistedSession({ ...this._activeSession, isHost: true });
      }
      this.room = coordinator.serializeRoom();
      this._migrating = false;
      this.emit('host_promoted', { code: coordinator.room.code });
      coordinator._broadcast({
        type: 'room_update',
        room: this.room,
        leftPlayerId: departingHostId || undefined,
      });
      return;
    }

    // Another survivor is promoting in-place on our shared WebRTC mesh — point sends to them
    this._p2pHostPeerId = resolvedNextHost;
    this._p2pLastHostRxAt = Date.now();
    if (departingHostId) {
      this.peers.delete(departingHostId);
      this._syncPeerAlias();
      this.emit('peer_left', departingHostId);
    }
    this._migrating = false;
  }

  async _p2pJoinRoom(msg, isRejoin = false) {
    this._manualLeave = false;
    const joinReqId = ++this._p2pJoinReqId;
    if (this._p2pPendingFlush) {
      await this._p2pPendingFlush;
      if (this._manualLeave || joinReqId !== this._p2pJoinReqId) return;
    }
    const sinceLeft = Date.now() - this._p2pLastLeaveDoneAt;
    if (this._p2pLastLeaveDoneAt > 0 && sinceLeft < 650) {
      await new Promise((r) => setTimeout(r, 650 - sinceLeft));
      if (this._manualLeave || joinReqId !== this._p2pJoinReqId) return;
    }
    this._cleanupP2p();
    const gen = this._p2pGen;
    const cleanCode = String(msg.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!cleanCode) {
      this.emit('error', 'Enter a valid room code.');
      return;
    }

    let trystero;
    try {
      trystero = await loadTrystero();
    } catch (err) {
      this.emit('error', `WebRTC P2P engine failed to load: ${err?.message || err}`);
      return;
    }
    if (this._p2pGen !== gen) return;

    this.clientId = trystero.selfId;
    this._p2pJoinAcked = false;
    this._p2pPendingJoin = {
      ...msg,
      type: 'join_room',
      code: cleanCode,
    };

    const trysteroRoom = trystero.joinRoom(
      { appId: TRYSTERO_APP_ID, relayUrls: TRYSTERO_RELAYS },
      `room-${cleanCode}`
    );
    this._attachTrysteroMesh(trysteroRoom, cleanCode, gen);

    this.connected = true;
    this.reconnecting = false;
    this.emit('connected');

    // Retry sending join_room to any connected mesh peers if host promotion just finished
    this._p2pJoinRetryTimer = setInterval(() => {
      if (this._p2pGen !== gen || this._p2pJoinAcked || !this._trysteroRoom) return;
      const peersObj = this._trysteroRoom.getPeers();
      for (const pid of Object.keys(peersObj)) {
        try {
          this._p2pSendPkt?.(
            {
              ...this._p2pPendingJoin,
              type: 'join_room',
              code: cleanCode,
              ...this._latestLoadStatus,
            },
            pid
          );
        } catch {}
      }
    }, 900);

    this._p2pJoinTimer = setTimeout(() => {
      if (this._p2pGen === gen && !this._p2pJoinAcked) {
        this._cleanupP2p();
        if (isRejoin) {
          this.clearSavedSession();
          this.room = null;
          this.emit('session_expired', `Room "${cleanCode}" expired or host is offline.`);
        }
        this.emit('error', `Room "${cleanCode}" not found or host is offline.`);
      }
    }, 10500);
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
          if (this._lastRoomSnapshot && Array.isArray(this._lastRoomSnapshot.checkpoints)) {
            if (!this._lastRoomSnapshot.checkpoints.includes(msg.checkpointId)) {
              this._lastRoomSnapshot.checkpoints.push(msg.checkpointId);
            }
          }
          this.emit('peer_checkpoint', msg);
          break;
        case 'peer_collectible':
          if (this._lastRoomSnapshot && Array.isArray(this._lastRoomSnapshot.collectibles)) {
            if (!this._lastRoomSnapshot.collectibles.includes(msg.collectibleId)) {
              this._lastRoomSnapshot.collectibles.push(msg.collectibleId);
            }
          }
          this.emit('peer_collectible', msg);
          break;
        case 'peer_body_recovered':
          if (this._lastRoomSnapshot) {
            this._lastRoomSnapshot.bodyRecoveredBy = msg.by || msg.playerId || 'Recovered';
          }
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
          if (this._lastRoomSnapshot) {
            const list = Array.isArray(this._lastRoomSnapshot.playerLines)
              ? this._lastRoomSnapshot.playerLines
              : (this._lastRoomSnapshot.playerLines = []);
            const nextChains = msg.chains || [];
            const entry = list.find((e) => e.playerId === pid);
            if (entry) entry.chains = nextChains;
            else list.push({ playerId: pid, chains: nextChains });
          }
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
      if (this._p2pSendPkt && this._p2pHostPeerId) {
        try {
          this._p2pSendPkt(payload, this._p2pHostPeerId);
          return true;
        } catch {
          return false;
        }
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
      if (this._activeSession && !this.room && !this._trysteroRoom) {
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
    this._p2pJoinReqId += 1;
    this.clearSavedSession();
    this._outbox = this._outbox.filter(
      (m) => m.type === 'list_rooms'
    );
    if (this.transport === 'p2p') {
      const currentRoom = this.room;
      const myId = this.clientId;
      const scheduleFlushClose = (delayMs) => {
        this._p2pPendingFlush = new Promise((resolve) => {
          this._pendingLeaveTimer = setTimeout(() => {
            this._p2pPendingFlush = null;
            this._cleanupP2p();
            this._p2pLastLeaveDoneAt = Date.now();
            resolve();
          }, delayMs);
        });
      };
      if (this._p2pHost && currentRoom) {
        const nextHostId = pickNextP2pHostId(currentRoom.players, myId);
        if (nextHostId && this._p2pSendPkt) {
          const snapshot = this._p2pHost.exportSnapshot();
          try {
            this._p2pSendPkt({
              type: 'host_handoff',
              nextHostId,
              departingHostId: myId,
              snapshot,
            });
          } catch {}
          this._p2pHost.destroy();
          this._p2pHost = null;
          this.room = null;
          this.peers.clear();
          this.peer = null;
          this._lastRoomSnapshot = null;
          scheduleFlushClose(140);
          return;
        }
      } else if (this._p2pSendPkt && this._p2pHostPeerId) {
        try {
          this._p2pSendPkt({ type: 'leave_room' }, this._p2pHostPeerId);
        } catch {}
        this.room = null;
        this.peers.clear();
        this.peer = null;
        this._lastRoomSnapshot = null;
        scheduleFlushClose(110);
        return;
      }
      this.room = null;
      this.peers.clear();
      this.peer = null;
      this._lastRoomSnapshot = null;
      this._cleanupP2p();
      this._p2pLastLeaveDoneAt = Date.now();
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
