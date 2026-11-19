import { stepDiverBody } from '../game/diverBody.js';
import { evaluateCaveSDF } from '../game/collision.js';
import { P2pRoomCoordinator, pickNextP2pHostId, compareHostAuthority } from './p2pRoomHost.js';

/**
 * Dual-transport Multiplayer Client (WebSocket relay when a Node server is present,
 * or serverless WebRTC P2P mesh DataChannels via Trystero Nostr relays + automatic
 * Nostr ephemeral WS relay bridge on symmetric NATs).
 */

const SESSION_STORAGE_KEY = 'caveDiverLanSession_v1';
const SESSION_MAX_AGE_MS = 10 * 60 * 1000;
const TRYSTERO_APP_ID = 'cave-diver-coop-v1';
const TRYSTERO_RELAYS = [
  'wss://nostr.bitcoiner.social',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://nostr.mom',
];
const P2P_RTC_CONFIG = {
  config: {
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun.cloudflare.com:3478',
          'stun:global.stun.twilio.com:3478',
        ],
      },
    ],
    iceCandidatePoolSize: 4,
    sdpSemantics: 'unified-plan',
  },
};
const P2P_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

let trysteroModulePromise = null;
function loadTrystero() {
  if (!trysteroModulePromise) {
    trysteroModulePromise = import('../vendor/trystero-nostr.min.js?v=83');
  }
  return trysteroModulePromise;
}

// Shared Vercel + Blob room coordinator for background-resilient P2P rooms across Vercel & GitHub Pages
export const GLOBAL_ROOM_API_URL = 'https://cave-diver.vercel.app/api/room';

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
    this._peersCache = [];
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
    this._connectPromise = null;
    this._trysteroRoom = null;
    this._relayChannel = null;
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
    this._p2pLastRelayBeatAt = 0;
    this._p2pLastRelayStateAt = 0;
    this._p2pLastRelayPeerAt = new Map();
    this._p2pLastPeerRxAt = new Map();
    this._p2pDirectPeers = new Set();
    this._seenRelayMids = new Set();
    this._relayMidSeq = 0;
    this._stateSeq = 0;
    this._p2pJoinAcked = false;
    this._p2pAckedHostId = null;
    this._p2pPendingJoin = null;
    this._trysteroMod = null;
    this._roomApiUrlPromise = null;
    this._lastCloudSyncAt = 0;
    this._cloudSyncTimer = null;
    this._lastRoomSnapshot = null;
    this._manualLeave = false;
    this._migrating = false;
    this._pendingLeaveTimer = null;
    this._migrateTimer = null;
    this._pendingCreateResolvers = [];
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
    this._peersCache = Array.from(this.peers.values());
    this.peer = this._peersCache[0] || null;
  }

  getPeers() {
    return this._peersCache;
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
        if (host.endsWith('.github.io') || host.endsWith('.vercel.app') || proto === 'file:') {
          this.transport = 'p2p';
          this.emit('transport_changed', 'p2p');
          return 'p2p';
        }

        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), 2800) : null;
        try {
          const healthRes = await fetch('./api/healthz', {
            cache: 'no-store',
            signal: ctrl?.signal,
          });
          if (healthRes.ok) {
            const healthJson = await healthRes.json();
            if (healthJson?.platform === 'vercel') {
              this.transport = 'p2p';
              this.emit('transport_changed', 'p2p');
              return 'p2p';
            }
          }
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
    if (this._cloudSyncTimer) {
      clearTimeout(this._cloudSyncTimer);
      this._cloudSyncTimer = null;
    }
    this._p2pLastHostRxAt = 0;
    this._p2pLastRelayBeatAt = 0;
    this._p2pLastRelayStateAt = 0;
    this._p2pLastRelayPeerAt.clear();
    this._p2pLastPeerRxAt.clear();
    this._p2pDirectPeers.clear();
    this._seenRelayMids.clear();
    this._migrating = false;
    this._p2pHostPeerId = null;
    this._p2pSendPkt = null;
    this._p2pJoinAcked = false;
    this._p2pAckedHostId = null;
    this._p2pPendingJoin = null;
    if (this._relayChannel) {
      try {
        this._relayChannel.close();
      } catch {}
      this._relayChannel = null;
    }
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

  _sendViaRelay(payload, targetPeerId = '*') {
    if (!this._relayChannel || !this.clientId) return false;
    const type = payload?.type || '';
    if (type === 'player_state') {
      const now = Date.now();
      if (now - this._p2pLastRelayStateAt < 90) return true; // ~11Hz relay fallback telemetry
      this._p2pLastRelayStateAt = now;
    } else if (type === 'peer_state') {
      const now = Date.now();
      const key = `${targetPeerId}:${payload.playerId || ''}`;
      const lastAt = this._p2pLastRelayPeerAt.get(key) || 0;
      if (now - lastAt < 90) return true; // Coalesce host->fallback peer_state to ~11Hz per peer
      this._p2pLastRelayPeerAt.set(key, now);
    }
    const mid = `${this.clientId}-${++this._relayMidSeq}`;
    try {
      this._relayChannel.send(
        JSON.stringify({
          v: 1,
          mid,
          from: this.clientId,
          to: targetPeerId || '*',
          msg: payload,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  _sendToPeerOrBroadcast(payload, targetPeerId = null) {
    if (!payload) return false;
    if (targetPeerId) {
      const pc = this._trysteroRoom?.getPeers?.()?.[targetPeerId];
      const directReady =
        this._p2pDirectPeers.has(targetPeerId) &&
        pc &&
        pc.connectionState !== 'failed' &&
        pc.connectionState !== 'closed';
      if (directReady && this._p2pSendPkt) {
        try {
          this._p2pSendPkt(payload, targetPeerId);
          return true;
        } catch {
          this._p2pDirectPeers.delete(targetPeerId);
        }
      }
      return this._sendViaRelay(payload, targetPeerId);
    }

    let sentDirect = false;
    const peersObj = this._trysteroRoom?.getPeers?.() || {};
    const directIds = [];
    for (const pid of this._p2pDirectPeers) {
      if (peersObj[pid] && peersObj[pid].connectionState !== 'failed' && peersObj[pid].connectionState !== 'closed') {
        directIds.push(pid);
      }
    }
    if (directIds.length > 0 && this._p2pSendPkt) {
      try {
        this._p2pSendPkt(payload, directIds);
        sentDirect = true;
      } catch {}
    }
    const hostPlayers = this._p2pHost
      ? Array.from(this._p2pHost.room.players.keys()).filter((id) => id !== this.clientId)
      : [];
    const needsRelayBroadcast =
      !this._p2pHost || hostPlayers.some((id) => !this._p2pDirectPeers.has(id)) || hostPlayers.length === 0;
    if (needsRelayBroadcast) {
      return this._sendViaRelay(payload, '*') || sentDirect;
    }
    return sentDirect;
  }

  _sendJoinToPeer(code, targetPeerId = null, force = false) {
    if (!this._p2pPendingJoin) return;
    if (!force && this._p2pJoinAcked && (!targetPeerId || this._p2pAckedHostId === targetPeerId)) {
      return;
    }
    const pkt = {
      ...this._p2pPendingJoin,
      type: 'join_room',
      code,
      ...this._latestLoadStatus,
    };
    if (targetPeerId && this._p2pDirectPeers.has(targetPeerId)) {
      try {
        this._p2pSendPkt?.(pkt, targetPeerId);
      } catch {}
    }
    this._sendViaRelay(pkt, targetPeerId || '*');
  }

  _demoteToGuest(winnerHostId, code, gen) {
    if (!this._p2pHost || this._p2pGen !== gen || this._manualLeave) return;
    const myPlayer = this._p2pHost.room.players.get(this.clientId);
    const wasStarted = Boolean(this.room?.started);
    const savedName = myPlayer?.name || this._activeSession?.name || 'Buddy Diver';
    const savedToken = myPlayer?.reconnectToken || this._activeSession?.reconnectToken || '';
    this._p2pHost.destroy();
    this._p2pHost = null;
    this._p2pHostPeerId = winnerHostId;
    this._p2pLastHostRxAt = Date.now();
    this._p2pJoinAcked = false;
    this._p2pAckedHostId = null;
    this._p2pPendingJoin = {
      type: 'join_room',
      code,
      name: savedName,
      reconnectToken: savedToken,
      preserveDive: wasStarted,
      ...this._latestLoadStatus,
    };
    if (this._activeSession) {
      this._savePersistedSession({ ...this._activeSession, isHost: false });
    }
    this._sendJoinToPeer(code, winnerHostId, true);
  }

  _attachTrysteroMesh(trysteroRoom, code, gen) {
    const [sendPkt, onPkt] = trysteroRoom.makeAction('coop');
    this._trysteroRoom = trysteroRoom;
    this._p2pSendPkt = sendPkt;
    this._p2pLastHostRxAt = Date.now();
    this._p2pLastPeerRxAt.clear();
    this._p2pDirectPeers.clear();

    const handleInbound = (data, peerId, via) => {
      if (this._p2pGen !== gen || this._trysteroRoom !== trysteroRoom) return;
      if (!data || typeof data !== 'object' || !peerId || peerId === this.clientId) return;
      const now = Date.now();
      if (via === 'webrtc') {
        this._p2pDirectPeers.add(peerId);
      }
      this._p2pLastPeerRxAt.set(peerId, now);
      if (peerId === this._p2pHostPeerId || data.type === 'host_beat' || data.type === 'host_announce') {
        this._p2pLastHostRxAt = now;
      }

      if (data.type === 'peer_hello') {
        return;
      }

      if (data.type === 'host_beat' || data.type === 'host_announce') {
        const remoteHostId = data.hostId || peerId;
        if (this._p2pHost) {
          // Deterministic anti-split-brain host arbitration
          const cmp = compareHostAuthority(this._p2pHost.getAuthorityInfo(), {
            hostId: remoteHostId,
            hostEpoch: data.hostEpoch || 1,
            started: Boolean(data.started),
            playerCount: data.playerCount || 1,
          });
          if (cmp < 0) {
            this._demoteToGuest(remoteHostId, code, gen);
          } else {
            this._sendToPeerOrBroadcast(
              { type: 'host_announce', code, ...this._p2pHost.getAuthorityInfo() },
              peerId
            );
          }
          return;
        }
        this._p2pHostPeerId = remoteHostId;
        this._p2pLastHostRxAt = now;
        if (data.type === 'host_announce') {
          this.emit('join_stage', {
            code,
            pct: 38,
            message: `Host found for Room ${code} — syncing roster...`,
          });
          if (!this._p2pJoinAcked || this._p2pAckedHostId !== remoteHostId) {
            this._sendJoinToPeer(code, remoteHostId, true);
          }
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

      if (this._p2pHost) {
        if (data.type === 'join_room' || data.type === 'rejoin_room') {
          this._p2pHost.handleRemoteJoin(
            { ...data, type: 'join_room' },
            (reply) => {
              if (this._p2pGen === gen) {
                this._sendToPeerOrBroadcast(reply, peerId);
              }
            },
            peerId
          );
          return;
        }
        if (data.type === 'room_joined' && data.room) {
          const remoteHost = (data.room.players || []).find((p) => p.isHost);
          if (remoteHost && remoteHost.id !== this.clientId) {
            const cmp = compareHostAuthority(this._p2pHost.getAuthorityInfo(), {
              hostId: remoteHost.id,
              hostEpoch: data.room.hostEpoch || 1,
              started: Boolean(data.room.started),
              playerCount: data.room.players.length,
            });
            if (cmp < 0) {
              this._demoteToGuest(remoteHost.id, code, gen);
              this._handleMessage(data);
            }
          }
          return;
        }
        this._p2pHost.handleMessage(peerId, data);
        return;
      }

      // Guest branch
      if (data.type === 'room_joined') {
        this._p2pJoinAcked = true;
        this._p2pAckedHostId = peerId;
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
    };

    trysteroRoom.onPeerJoin((peerId) => {
      if (this._p2pGen !== gen || this._trysteroRoom !== trysteroRoom) return;
      this._p2pDirectPeers.add(peerId);
      this._p2pLastPeerRxAt.set(peerId, Date.now());
      if (this._p2pHost) {
        try {
          sendPkt({ type: 'host_announce', code, ...this._p2pHost.getAuthorityInfo() }, peerId);
        } catch {}
      } else {
        try {
          sendPkt({ type: 'peer_hello' }, peerId);
        } catch {}
        this._sendJoinToPeer(code, peerId, !this._p2pJoinAcked);
      }
    });

    trysteroRoom.onPeerLeave((peerId) => {
      if (this._p2pGen !== gen || this._trysteroRoom !== trysteroRoom) return;
      this._p2pDirectPeers.delete(peerId);
      if (this._p2pHost) {
        // Hold diver's seat with grace timer so brief NAT/relay hiccups or relay fallback do not silently drop them
        if (this._p2pHost.room.players.has(peerId)) {
          this._p2pHost.markDisconnected(peerId);
        }
        return;
      }
      if (this._manualLeave || !this.room || this._migrating) return;
      const wasHost =
        peerId === this._p2pHostPeerId ||
        Boolean((this.room.players || []).find((p) => p.id === peerId && p.isHost));
      if (!wasHost) return;
      if (this._migrateTimer) clearTimeout(this._migrateTimer);
      // Grace period lets host_handoff or Nostr relay fallback beat premature split-brain migration
      this._migrateTimer = setTimeout(() => {
        if (this._p2pGen !== gen || this._trysteroRoom !== trysteroRoom) return;
        const stillQuiet = Date.now() - (this._p2pLastHostRxAt || 0) > 4500;
        if (!this._p2pHost && !this._manualLeave && this.room && !this._migrating && stillQuiet) {
          this._handleHostMigration({ departingHostId: peerId });
        }
      }, 4500);
    });

    onPkt((data, peerId) => handleInbound(data, peerId, 'webrtc'));

    if (this._trysteroMod?.subscribeRelay) {
      this._relayChannel = this._trysteroMod.subscribeRelay(`cd-relay-${code}`, TRYSTERO_RELAYS, (raw) => {
        if (this._p2pGen !== gen || this._trysteroRoom !== trysteroRoom) return;
        let env;
        try {
          env = JSON.parse(raw);
        } catch {
          return;
        }
        if (!env || env.v !== 1 || !env.from || env.from === this.clientId) return;
        if (env.to && env.to !== '*' && env.to !== this.clientId) return;
        if (env.mid) {
          if (this._seenRelayMids.has(env.mid)) return;
          this._seenRelayMids.add(env.mid);
          if (this._seenRelayMids.size > 500) {
            const first = this._seenRelayMids.values().next().value;
            this._seenRelayMids.delete(first);
          }
        }
        handleInbound(env.msg, env.from, 'relay');
      });
    }

    // Fast P2P Host beacon & resilient watchdog across both WebRTC and Nostr WS Relay
    this._p2pHeartbeatTimer = setInterval(() => {
      if (this._p2pGen !== gen || this._trysteroRoom !== trysteroRoom || this._manualLeave) return;
      const now = Date.now();
      const peersMap = trysteroRoom.getPeers?.() || {};

      if (this._p2pHost) {
        const beatPkt = { type: 'host_beat', code, ...this._p2pHost.getAuthorityInfo() };
        try {
          const directIds = [];
          for (const pid of this._p2pDirectPeers) {
            if (peersMap[pid] && peersMap[pid].connectionState !== 'failed' && peersMap[pid].connectionState !== 'closed') {
              directIds.push(pid);
            }
          }
          if (directIds.length > 0) {
            sendPkt(beatPkt, directIds);
          }
        } catch {}
        const allJoined = Array.from(this._p2pHost.room.players.keys()).filter((id) => id !== this.clientId);
        const anyNonDirect =
          allJoined.length < (this._p2pHost.room.maxPlayers - 1) ||
          allJoined.some((id) => !this._p2pDirectPeers.has(id));
        if (anyNonDirect && now - this._p2pLastRelayBeatAt >= 2800) {
          this._p2pLastRelayBeatAt = now;
          this._sendViaRelay(beatPkt, '*');
        }
        for (const p of Array.from(this._p2pHost.room.players.values())) {
          if (p.id === this.clientId) continue;
          const pc = peersMap[p.id];
          const silentMs = now - (this._p2pLastPeerRxAt.get(p.id) || now);
          const pcState = pc?.connectionState || '';
          const iceState = pc?.iceConnectionState || '';
          const dead =
            (pcState === 'failed' || pcState === 'closed' || iceState === 'failed' || iceState === 'closed') &&
            silentMs > 12000;
          if (dead && p.connected !== false) {
            this._p2pDirectPeers.delete(p.id);
            this._p2pHost.markDisconnected(p.id);
          }
        }
        return;
      }

      if (this.room && !this._migrating && this._p2pHostPeerId) {
        const pc = peersMap[this._p2pHostPeerId];
        const silentMs = now - (this._p2pLastHostRxAt || now);
        const pcState = pc?.connectionState || '';
        const iceState = pc?.iceConnectionState || '';
        if (pcState === 'failed' || pcState === 'closed' || pcState === 'disconnected') {
          this._p2pDirectPeers.delete(this._p2pHostPeerId);
        }
        const webrtcDead =
          pcState === 'failed' || pcState === 'closed' || iceState === 'failed' || iceState === 'closed';
        const hostLost = (webrtcDead && silentMs > 9000) || silentMs > 16000;
        if (hostLost) {
          this._handleHostMigration({ departingHostId: this._p2pHostPeerId });
        }
      }
    }, 1000);
  }

  async _getRoomApiUrl() {
    if (this._roomApiUrlPromise) return this._roomApiUrlPromise;
    this._roomApiUrlPromise = (async () => {
      try {
        const host = globalThis.location?.hostname || '';
        const proto = globalThis.location?.protocol || '';
        if (!host.endsWith('.github.io') && proto !== 'file:') {
          const res = await fetch('./api/healthz', { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            if (json?.platform === 'vercel') return './api/room';
          }
        }
      } catch {}
      return GLOBAL_ROOM_API_URL ? GLOBAL_ROOM_API_URL.replace(/\/+$/, '') : '';
    })();
    return this._roomApiUrlPromise;
  }

  async _cloudSyncRoom(force = false) {
    if (this.transport !== 'p2p' || !this._p2pHost || !this.room) return;
    const now = Date.now();
    const waitMs = 800 - (now - this._lastCloudSyncAt);
    if (!force && waitMs > 0) {
      if (!this._cloudSyncTimer) {
        this._cloudSyncTimer = setTimeout(() => {
          this._cloudSyncTimer = null;
          this._cloudSyncRoom(true);
        }, waitMs + 20);
      }
      return;
    }
    if (this._cloudSyncTimer) {
      clearTimeout(this._cloudSyncTimer);
      this._cloudSyncTimer = null;
    }
    this._lastCloudSyncAt = now;
    try {
      const apiUrl = await this._getRoomApiUrl();
      if (!apiUrl) return;
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          code: this.room.code,
          room: this.room,
          snapshot: this._p2pHost.exportSnapshot(),
        }),
      });
    } catch {}
  }

  async _cloudNotifyLeave(code, playerId) {
    if (!code) return;
    try {
      const apiUrl = await this._getRoomApiUrl();
      if (!apiUrl) return;
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ action: 'leave', code, playerId }),
      });
    } catch {}
  }

  async _cloudFetchRoom(code) {
    try {
      const apiUrl = await this._getRoomApiUrl();
      if (!apiUrl) return null;
      const res = await fetch(`${apiUrl}?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.ok ? json : null;
    } catch {
      return null;
    }
  }

  async _p2pCreateRoom(msg, preferredCode = null, restoredSnapshot = null) {
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

    const coordinator = restoredSnapshot
      ? P2pRoomCoordinator.fromSnapshot(restoredSnapshot, {
          departingHostId: null,
          newHostId: myId,
          newHostName: msg.name || 'Lead Diver',
          bumpEpoch: true,
        })
      : new P2pRoomCoordinator({
          code,
          hostId: myId,
          hostName: msg.name || 'Lead Diver',
          levelId: msg.levelId,
          maxPlayers: msg.maxPlayers || 4,
          loadStatus: this._latestLoadStatus,
          initialDiveState: msg.initialDiveState || null,
        });
    this._p2pHost = coordinator;
    for (const p of coordinator.room.players.values()) {
      if (p.id === myId) {
        coordinator.bindPlayerSender(myId, (outMsg) => this._handleMessage(outMsg));
      } else {
        coordinator.bindPlayerSender(p.id, (outMsg) => this._sendToPeerOrBroadcast(outMsg, p.id));
        coordinator.markDisconnected(p.id);
      }
    }

    this._trysteroMod = trystero;
    const trysteroRoom = trystero.joinRoom(
      { appId: TRYSTERO_APP_ID, relayUrls: TRYSTERO_RELAYS, rtcConfig: P2P_RTC_CONFIG },
      `room-${code}`
    );
    this._attachTrysteroMesh(trysteroRoom, code, gen);

    this.connected = true;
    this.reconnecting = false;
    this._migrating = false;
    this._handleMessage(coordinator.getHostInitEnvelope());
    this.emit('connected');
    this._sendToPeerOrBroadcast({ type: 'host_announce', code, ...coordinator.getAuthorityInfo() });
    this._cloudSyncRoom(true);
  }

  async _p2pRecoverHostSession(session) {
    const cloud = await this._cloudFetchRoom(session.code).catch(() => null);
    if (this.room || this._manualLeave) return;
    const snap = cloud?.snapshot;
    if (snap && Array.isArray(snap.players) && snap.players.length > 0) {
      const snapHost = snap.players.find((p) => p.isHost);
      const someoneElseIsHost =
        snapHost &&
        snapHost.reconnectToken &&
        session.reconnectToken &&
        snapHost.reconnectToken !== session.reconnectToken;
      if (someoneElseIsHost) {
        await this._p2pJoinRoom(
          {
            type: 'rejoin_room',
            code: session.code,
            reconnectToken: session.reconnectToken,
            name: session.name,
          },
          true
        );
        return;
      }
      await this._p2pCreateRoom(
        {
          type: 'create_room',
          name: session.name,
          levelId: snap.levelId || session.levelId,
          maxPlayers: snap.maxPlayers || session.maxPlayers || 4,
        },
        session.code,
        snap
      );
      if (this.room?.started && this._p2pHost) {
        this._handleMessage({
          type: 'dive_started',
          levelId: this.room.levelId,
          diveSeq: this.room.diveSeq || 1,
          rejoined: true,
          checkpoints: snap.checkpoints || [],
          collectibles: snap.collectibles || [],
          playerLines: snap.playerLines || [],
          bodyRecoveredBy: snap.bodyRecoveredBy || null,
          room: this.room,
        });
      }
      return;
    }
    await this._p2pCreateRoom(
      {
        type: 'create_room',
        name: session.name,
        levelId: session.levelId,
        maxPlayers: session.maxPlayers || 4,
      },
      session.code
    );
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
      hostEpoch: r.hostEpoch || 1,
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
        newHostName: this._activeSession?.name || 'Lead Diver',
        bumpEpoch: true,
      });
      this._p2pHost = coordinator;
      this._p2pHostPeerId = this.clientId;
      coordinator.bindPlayerSender(this.clientId, (pkt) => this._handleMessage(pkt));

      const activePeers = this._trysteroRoom ? this._trysteroRoom.getPeers() : {};
      const now = Date.now();
      for (const p of coordinator.room.players.values()) {
        if (p.id === this.clientId) continue;
        coordinator.bindPlayerSender(p.id, (pkt) => this._sendToPeerOrBroadcast(pkt, p.id));
        const recentlySeen = now - (this._p2pLastPeerRxAt.get(p.id) || 0) < 12000;
        if (activePeers[p.id] || recentlySeen) {
          this._sendToPeerOrBroadcast(
            { type: 'host_announce', code: coordinator.room.code, ...coordinator.getAuthorityInfo() },
            p.id
          );
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

    // Another survivor is promoting in-place on our shared mesh — point sends & re-attach to them
    this._p2pHostPeerId = resolvedNextHost;
    this._p2pLastHostRxAt = Date.now();
    this._p2pJoinAcked = false;
    this._p2pAckedHostId = null;
    if (departingHostId) {
      this.peers.delete(departingHostId);
      this._syncPeerAlias();
      this.emit('peer_left', departingHostId);
    }
    if (this._p2pPendingJoin) {
      this._sendJoinToPeer(this.room.code, resolvedNextHost, true);
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
    if (this._p2pLastLeaveDoneAt > 0 && sinceLeft < 350) {
      await new Promise((r) => setTimeout(r, 350 - sinceLeft));
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

    this.emit('join_stage', {
      code: cleanCode,
      pct: 18,
      message: `Connecting to co-op mesh for Room ${cleanCode}...`,
    });

    let trystero;
    try {
      trystero = await loadTrystero();
    } catch (err) {
      this.emit('error', `WebRTC P2P engine failed to load: ${err?.message || err}`);
      return;
    }
    if (this._p2pGen !== gen) return;

    this._trysteroMod = trystero;
    this.clientId = trystero.selfId;
    this._p2pJoinAcked = false;
    this._p2pAckedHostId = null;
    this._p2pPendingJoin = {
      ...msg,
      type: 'join_room',
      code: cleanCode,
    };

    const trysteroRoom = trystero.joinRoom(
      { appId: TRYSTERO_APP_ID, relayUrls: TRYSTERO_RELAYS, rtcConfig: P2P_RTC_CONFIG },
      `room-${cleanCode}`
    );
    this._attachTrysteroMesh(trysteroRoom, cleanCode, gen);
    this._p2pLastHostRxAt = 0; // Reset until real packet from a live Host arrives
    this.emit('join_stage', {
      code: cleanCode,
      pct: 28,
      message: `Locating Host & active state for Room ${cleanCode}...`,
    });

    this.connected = true;
    this.reconnecting = false;
    this.emit('connected');

    // Broadcast initial join request via relay fallback right away (beats WebRTC cold start & bypasses symmetric NAT!)
    this._sendJoinToPeer(cleanCode, null, true);

    // Cloud Room Keeper fallback: recover from Vercel Storage after 5.0s if Host has not replied
    // with room_joined over WebRTC or Nostr WS Relay (even if stale announcements arrived from cache)
    const cloudFallbackTimer = setTimeout(async () => {
      if (this._p2pGen !== gen || this._p2pJoinAcked || this._p2pHost || this._manualLeave) {
        return;
      }
      this.emit('join_stage', {
        code: cleanCode,
        pct: 35,
        message: `Recovering Room ${cleanCode} from Cloud Room Keeper...`,
      });
      const cloud = await this._cloudFetchRoom(cleanCode);
      if (this._p2pGen !== gen || this._p2pJoinAcked || this._p2pHost || !cloud?.snapshot) {
        return;
      }

      const snap = cloud.snapshot;
      const coordinator = P2pRoomCoordinator.fromSnapshot(snap, {
        departingHostId: null,
        newHostId: this.clientId,
        newHostName: msg.name || 'Buddy Diver',
        bumpEpoch: true,
      });
      for (const p of coordinator.room.players.values()) {
        if (p.id === this.clientId) {
          coordinator.bindPlayerSender(this.clientId, (outMsg) => this._handleMessage(outMsg));
        } else {
          coordinator.bindPlayerSender(p.id, (outMsg) => this._sendToPeerOrBroadcast(outMsg, p.id));
          coordinator.markDisconnected(p.id);
        }
      }
      const me = coordinator.room.players.get(this.clientId);
      this._handleMessage({
        type: 'room_joined',
        room: coordinator.serializeRoom(),
        clientId: this.clientId,
        reconnectToken: me?.reconnectToken || '',
        syncState: coordinator.exportSnapshot(),
      });
      if (coordinator.room.started) {
        this._handleMessage({
          type: 'dive_started',
          levelId: coordinator.room.levelId,
          diveSeq: coordinator.room.diveSeq,
          rejoined: true,
          lateJoin: true,
          checkpoints: Array.from(coordinator.room.sharedCheckpoints),
          collectibles: Array.from(coordinator.room.sharedCollectibles),
          playerLines: Array.from(coordinator.room.playerLines.entries()).map(([pid, d]) => ({
            playerId: pid,
            ...d,
          })),
          bodyRecoveredBy: coordinator.room.bodyRecoveredBy || null,
          room: coordinator.serializeRoom(),
        });
      }
      this._p2pJoinAcked = true;
      this._p2pAckedHostId = this.clientId;
      this._p2pHost = coordinator;
      this._p2pHostPeerId = this.clientId;
      clearTimeout(this._p2pJoinTimer);
      clearInterval(this._p2pJoinRetryTimer);
      this._sendToPeerOrBroadcast({
        type: 'host_announce',
        code: cleanCode,
        ...coordinator.getAuthorityInfo(),
      });
      this._cloudSyncRoom(true);
    }, 5000);

    // Retry sending join_room over both connected WebRTC peers & Nostr WS relay until Host acks
    this._p2pJoinRetryTimer = setInterval(() => {
      if (this._p2pGen !== gen || this._p2pJoinAcked || this._p2pHost) return;
      const peersObj = this._trysteroRoom?.getPeers?.() || {};
      const pkt = {
        ...this._p2pPendingJoin,
        type: 'join_room',
        code: cleanCode,
        ...this._latestLoadStatus,
      };
      for (const pid of Object.keys(peersObj)) {
        try {
          this._p2pSendPkt?.(pkt, pid);
        } catch {}
      }
      this._sendViaRelay(pkt, this._p2pHostPeerId || '*');
    }, 900);

    this._p2pJoinTimer = setTimeout(() => {
      clearTimeout(cloudFallbackTimer);
      if (this._p2pGen === gen && !this._p2pJoinAcked) {
        this._cleanupP2p();
        if (isRejoin) {
          this.clearSavedSession();
          this.room = null;
          this.emit('session_expired', `Room "${cleanCode}" expired or host is offline.`);
        }
        this.emit('error', `Room "${cleanCode}" not found or host is offline.`);
      }
    }, 18000);
  }

  _flushOutbox() {
    if (this.transport === 'p2p') {
      const pending = this._outbox.splice(0, this._outbox.length);
      for (const msg of pending) {
        if (msg.type === 'create_room') this._p2pCreateRoom(msg);
        else if (msg.type === 'join_room' || msg.type === 'rejoin_room') {
          this._p2pJoinRoom(msg, msg.type === 'rejoin_room');
        } else {
          this.send(msg);
        }
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
    if (this._connectPromise) return this._connectPromise;
    this._connectPromise = this._connectImpl();
    try {
      return await this._connectPromise;
    } finally {
      this._connectPromise = null;
    }
  }

  async _connectImpl() {
    this._shouldReconnect = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    const mode = await this._detectTransport();
    if (mode === 'p2p') {
      loadTrystero().catch(() => {});
      this.connected = true;
      this.reconnecting = false;
      this.emit('connected');
      const hasPendingRoomCmd = this._outbox.some(
        (m) =>
          m.type === 'create_room' ||
          m.type === 'join_room' ||
          m.type === 'rejoin_room' ||
          m.type === 'leave_room'
      );
      if (this._activeSession && !this.room && !this._trysteroRoom && !hasPendingRoomCmd) {
        if (this._activeSession.isHost) {
          await this._p2pRecoverHostSession(this._activeSession);
        } else {
          await this._p2pJoinRoom(
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
          const prevCode = this.room?.code;
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
          if (!msg.rejoined && prevCode !== msg.room?.code) {
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
          if (this._pendingCreateResolvers.length > 0) {
            for (const res of this._pendingCreateResolvers.splice(0)) res(msg.room);
          }
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
          for (const rp of msg.room?.players || []) {
            const existingPeer = this.peers.get(rp.id);
            if (existingPeer && rp.connected && existingPeer._wasDisconnected) {
              existingPeer._rxSeq = 0;
            }
            if (existingPeer) existingPeer._wasDisconnected = !rp.connected;
          }
          for (const pid of this.peers.keys()) {
            if (!activeIds.has(pid)) this.peers.delete(pid);
          }
          this._syncPeerAlias();
          // If P2P Host evicted us due to transient drop while we're still alive, auto-rejoin seamlessly
          if (
            this.transport === 'p2p' &&
            !this._p2pHost &&
            !this._manualLeave &&
            this.clientId &&
            activeIds.size > 0 &&
            !activeIds.has(this.clientId) &&
            this._p2pPendingJoin
          ) {
            this._p2pJoinAcked = false;
            this._p2pAckedHostId = null;
            this._sendJoinToPeer(msg.room.code, this._p2pHostPeerId, true);
            break;
          }
          this.emit('room_update', msg.room);
          if (this.transport === 'p2p' && this._p2pHost) {
            this._cloudSyncRoom(false);
          }
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
          if (!msg?.preserveDive) {
            this.peers.clear();
            this._syncPeerAlias();
          }
          this.emit('dive_started', msg);
          if (this.transport === 'p2p' && this._p2pHost) {
            this._cloudSyncRoom(true);
          }
          break;
        case 'returned_to_lobby':
          this.room = msg.room;
          this.peers.clear();
          this._syncPeerAlias();
          this.emit('returned_to_lobby', msg.room);
          this.emit('room_update', msg.room);
          if (this._pendingCreateResolvers.length > 0) {
            for (const res of this._pendingCreateResolvers.splice(0)) res(msg.room);
          }
          break;
        case 'peer_state': {
          const pid = msg.playerId || 'peer';
          const rxSeq = Number.isFinite(msg.state?.seq) ? msg.state.seq : 0;
          const rxNow = nowMs();
          let p = this.peers.get(pid);
          if (!p) {
            p = {
              id: pid,
              ...msg.state,
              targetX: msg.state.x,
              targetY: msg.state.y,
              targetAngle: msg.state.angle,
              _rxSeq: rxSeq,
              _lastRxMs: rxNow,
              _smoothSpeed: Math.hypot(msg.state.vx || 0, msg.state.vy || 0),
            };
            this.peers.set(pid, p);
          } else {
            // Discard delayed out-of-order snapshots, while allowing clean mid-dive reconnect seq resets
            const elapsedMs = p._lastRxMs ? rxNow - p._lastRxMs : 0;
            const looksLikeRestart = elapsedMs > 2500 || (rxSeq > 0 && rxSeq <= 5 && p._rxSeq > 20);
            if (rxSeq > 0 && p._rxSeq > 0 && rxSeq <= p._rxSeq && !looksLikeRestart) {
              break;
            }
            p._rxSeq = rxSeq > 0 ? rxSeq : p._rxSeq;
            p._lastRxMs = rxNow;
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
            p.rescueTargetId = msg.state.rescueTargetId || '';
            p.rescuedBy = msg.state.rescuedBy || '';
            p.rescued = Boolean(msg.state.rescued);
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
        case 'peer_gas_share':
          this.emit('peer_gas_share', msg);
          break;
        case 'peer_buddy_rescue':
          if (msg.rescuedId && this.peers.has(msg.rescuedId)) {
            const rp = this.peers.get(msg.rescuedId);
            rp.rescuedBy = msg.rescuerId;
            if (msg.status === 'extracted') rp.rescued = true;
          }
          this.emit('peer_buddy_rescue', msg);
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
      if (this._p2pHostPeerId) {
        return this._sendToPeerOrBroadcast(payload, this._p2pHostPeerId);
      }
      if (this._relayChannel) {
        return this._sendViaRelay(payload, '*');
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

  async listRooms() {
    if (this.transport === 'auto') {
      await this._detectTransport();
    }
    if (this.transport === 'p2p') {
      try {
        const apiUrl = await this._getRoomApiUrl();
        if (apiUrl) {
          const res = await fetch(apiUrl, { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json?.rooms)) {
              this.rooms = json.rooms;
              this.emit('rooms_list', this.rooms);
              return;
            }
          }
        }
      } catch {}
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
        return;
      }
      // Heal dead Nostr relay WebSockets cleanly without tearing down active WebRTC DataChannels
      if (this._trysteroRoom && this.room && !this._manualLeave) {
        try {
          this._trysteroMod?.reconnectRelays?.();
          this._relayChannel?.reconnect?.();
          if (this._p2pHost) {
            this._sendToPeerOrBroadcast({
              type: 'host_announce',
              code: this.room.code,
              ...this._p2pHost.getAuthorityInfo(),
            });
            this._cloudSyncRoom(true);
          } else if (this._p2pPendingJoin && !this._p2pJoinAcked) {
            this._sendJoinToPeer(this.room.code, this._p2pHostPeerId, true);
          }
        } catch {}
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

  async createRoom(name, levelId = 'cenote-el-abismo', maxPlayers = 4, initialDiveState = null) {
    this.clearSavedSession();
    if (this.transport === 'auto') {
      await this._detectTransport();
    }
    const msg = {
      type: 'create_room',
      name,
      levelId,
      maxPlayers,
      initialDiveState,
      ...this._latestLoadStatus,
    };
    if (this.transport === 'p2p') {
      await this._p2pCreateRoom(msg);
      return this.room;
    }
    return new Promise((resolve) => {
      let settled = false;
      const done = (room) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(room || this.room);
      };
      const timer = setTimeout(() => {
        this._pendingCreateResolvers = this._pendingCreateResolvers.filter((fn) => fn !== done);
        done(this.room);
      }, 5000);
      this._pendingCreateResolvers.push(done);
      this.sendReliable(msg, { replaceType: 'create_room' });
    });
  }

  setLevel(levelId) {
    if (!this.room) return;
    this.sendReliable({ type: 'set_level', levelId }, { replaceType: 'set_level' });
  }

  setMaxPlayers(maxPlayers) {
    if (!this.room) return;
    this.sendReliable({ type: 'set_max_players', maxPlayers }, { replaceType: 'set_max_players' });
  }

  async joinRoom(code, name, { reconnectToken = '' } = {}) {
    const cleanCode = String(code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!reconnectToken) {
      this.clearSavedSession();
    }
    if (this.transport === 'auto') {
      await this._detectTransport();
    }
    const msg = {
      type: reconnectToken ? 'rejoin_room' : 'join_room',
      code: cleanCode,
      name,
      reconnectToken: reconnectToken || undefined,
      ...this._latestLoadStatus,
    };
    if (this.transport === 'p2p') {
      await this._p2pJoinRoom(msg, Boolean(reconnectToken));
      return;
    }
    if (cleanCode) {
      this.emit('join_stage', {
        code: cleanCode,
        pct: 24,
        message: `Joining Room ${cleanCode} on LAN server...`,
      });
    }
    this.sendReliable(msg, { replaceType: msg.type });
  }

  async recoverHostSession(session) {
    if (!session?.code) return;
    if (this.transport === 'auto') {
      await this._detectTransport();
    }
    if (this.transport === 'p2p') {
      await this._p2pRecoverHostSession(session);
      return;
    }
    this.sendReliable(
      {
        type: 'rejoin_room',
        code: session.code,
        reconnectToken: session.reconnectToken,
        name: session.name,
      },
      { replaceType: 'rejoin_room' }
    );
  }

  getP2pDiagnostics() {
    return {
      transport: this.transport,
      clientId: this.clientId,
      isHost: Boolean(this._p2pHost),
      hostPeerId: this._p2pHostPeerId,
      directPeers: Array.from(this._p2pDirectPeers),
      peersCount: this.peers.size,
      relayReady: Boolean(this._relayChannel),
      roomCode: this.room?.code || '',
      hostEpoch: this.room?.hostEpoch || 1,
    };
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

  sendGasShare(targetPlayerId, gasId, amountBar) {
    if (!this.room || !this.connected || !targetPlayerId || !amountBar) return;
    this.send({ type: 'gas_share', targetPlayerId, gasId, amountBar });
  }

  sendBuddyRescue(rescuedId, rescuedName, status = 'towing') {
    if (!this.room || !this.connected || !rescuedId) return;
    this.send({ type: 'buddy_rescue', rescuedId, rescuedName, status });
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
      if (currentRoom?.code) {
        this._cloudNotifyLeave(currentRoom.code, myId);
      }
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
        if (nextHostId) {
          const snapshot = this._p2pHost.exportSnapshot();
          this._sendToPeerOrBroadcast({
            type: 'host_handoff',
            nextHostId,
            departingHostId: myId,
            snapshot,
          });
          this._p2pHost.destroy();
          this._p2pHost = null;
          this.room = null;
          this.peers.clear();
          this.peer = null;
          this._lastRoomSnapshot = null;
          scheduleFlushClose(160);
          return;
        }
      } else if (this._p2pHostPeerId) {
        this._sendToPeerOrBroadcast({ type: 'leave_room' }, this._p2pHostPeerId);
        this.room = null;
        this.peers.clear();
        this.peer = null;
        this._lastRoomSnapshot = null;
        scheduleFlushClose(140);
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

  shouldSendPlayerState() {
    if (!this.room || !this.connected) return false;
    return nowMs() - this.lastSendAt >= 33;
  }

  sendPlayerState(state) {
    if (!this.room || !this.connected || !state) return;
    const now = nowMs();
    if (now - this.lastSendAt < 33) return; // 30 Hz quantized sync (direct WebRTC/WS; relay self-throttles to ~11 Hz)
    this.lastSendAt = now;
    const r1 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);
    const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);
    const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0);
    const compact = {
      ...state,
      seq: ++this._stateSeq,
      x: r2(state.x),
      y: r2(state.y),
      vx: r2(state.vx),
      vy: r2(state.vy),
      angle: r3(state.angle),
      depthM: r2(state.depthM),
      activeBar: r1(state.activeBar ?? 200),
      cnsPercent: r1(state.cnsPercent ?? 0),
      dcsStress: r1(state.dcsStress ?? 0),
      hypoxiaStress: r1(state.hypoxiaStress ?? 0),
      narcosisLevel: r2(state.narcosisLevel ?? 0),
      heartRateBpm: Math.round(state.heartRateBpm ?? 70),
      cardiacStress: r1(state.cardiacStress ?? 0),
      ceilingM: r1(state.ceilingM ?? 0),
      diveTimeSec: r1(state.diveTimeSec ?? 0),
    };
    this.send({ type: 'player_state', state: compact });
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
    if (now - this.lastSiltAt < 140) return; // Smooth throttle for shared floor/impact silt propagation
    this.lastSiltAt = now;
    this.send({
      type: 'silt_event',
      plume: {
        x: Math.round(plume.x * 100) / 100,
        y: Math.round(plume.y * 100) / 100,
        vx: Math.round((plume.vx || 0) * 100) / 100,
        vy: Math.round((plume.vy || -0.22) * 100) / 100,
        radius: Math.round((plume.radius || 0.9) * 100) / 100,
        maxRadius: Math.round((plume.maxRadius || 3.6) * 100) / 100,
        life: Math.round((plume.life || 26) * 10) / 10,
        peakAlpha: Math.round((plume.peakAlpha ?? plume.alpha ?? 0.78) * 100) / 100,
      },
    });
  }

  stepPeerInterpolation(dt, level = null) {
    const safeDt = Math.min(0.1, Math.max(0, Number(dt) || 0));
    if (safeDt <= 0) return;
    const now = nowMs();
    const alphaPos = 1 - Math.exp(-11 * safeDt);
    const alphaAng = 1 - Math.exp(-12 * safeDt);
    const alphaSpd = 1 - Math.exp(-8 * safeDt);

    for (const p of this.peers.values()) {
      const vx = Number.isFinite(p.vx) ? p.vx : 0;
      const vy = Number.isFinite(p.vy) ? p.vy : 0;

      // Velocity dead-reckoning between network packets (full lead up to 140ms, tapers to 0 by 300ms)
      const ageMs = p._lastRxMs ? Math.max(0, now - p._lastRxMs) : 0;
      if (!p.surfaced && p.alive !== false && ageMs < 300) {
        const extFactor = ageMs <= 140 ? 1 : Math.max(0, 1 - (ageMs - 140) / 160);
        const nextTx = p.targetX + vx * extFactor * safeDt;
        const nextTy = p.targetY + vy * extFactor * safeDt;
        if (!level || evaluateCaveSDF(level, nextTx, nextTy) <= -0.52) {
          p.targetX = nextTx;
          p.targetY = nextTy;
        }
      }

      const dist = Math.hypot((p.targetX ?? p.x) - p.x, (p.targetY ?? p.y) - p.y);
      if (dist > 8.0) {
        // Large discontinuity (spawn/rejoin): snap cleanly instead of ghosting across cave
        p.x = p.targetX;
        p.y = p.targetY;
      } else {
        p.x += (p.targetX - p.x) * alphaPos;
        p.y += (p.targetY - p.y) * alphaPos;
      }

      // Shortest angle exponential smoothing
      let diff = (p.targetAngle ?? p.angle) - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.angle += diff * alphaAng;

      const rawSpeed = Math.hypot(vx, vy);
      p._smoothSpeed = Number.isFinite(p._smoothSpeed)
        ? p._smoothSpeed + (rawSpeed - p._smoothSpeed) * alphaSpd
        : rawSpeed;
      stepDiverBody(p, safeDt, { thrustMag: Math.min(1, p._smoothSpeed / 3.5) });
    }
  }
}
