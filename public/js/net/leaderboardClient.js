import {
  normalizeLeaderboardSubmission,
  queryLeaderboardEntries,
} from '../game/leaderboardModel.js';

const PLAYER_ID_KEY = 'caveDiverGlobalPlayerId_v1';
const CUSTOM_ENDPOINT_KEY = 'caveDiverLeaderboardApiUrl_v1';
const LOCAL_CACHE_KEY = 'caveDiverLeaderboardCache_v1';

// Populate once Cloudflare Worker is deployed (falls back to ./api/leaderboard on Node LAN server)
export const GLOBAL_LEADERBOARD_URL = '';

function getOrCreatePlayerId() {
  try {
    const existing = globalThis.localStorage?.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    const fresh = globalThis.crypto?.randomUUID
      ? `d_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`
      : `d_${Math.random().toString(36).slice(2, 12)}`;
    globalThis.localStorage?.setItem(PLAYER_ID_KEY, fresh);
    return fresh;
  } catch {
    return `d_${Math.random().toString(36).slice(2, 12)}`;
  }
}

export class LeaderboardClient {
  constructor() {
    this.playerId = getOrCreatePlayerId();
    this._resolvedEndpoint = undefined;
    this._localEntries = this._loadLocalCache();
  }

  _loadLocalCache() {
    try {
      const raw = globalThis.localStorage?.getItem(LOCAL_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  _saveLocalCache(entries) {
    try {
      const trimmed =
        entries.length > 120
          ? entries.slice().sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 120)
          : entries;
      globalThis.localStorage?.setItem(LOCAL_CACHE_KEY, JSON.stringify(trimmed));
    } catch {
      // ignore storage restriction
    }
  }

  _cacheLocalEntry(entry) {
    if (!entry) return;
    const idx = this._localEntries.findIndex(
      (e) => e.mode === entry.mode && e.entryKey === entry.entryKey
    );
    if (idx >= 0) {
      const prev = this._localEntries[idx];
      if (
        entry.score > prev.score ||
        (entry.score === prev.score && entry.timeSec < prev.timeSec)
      ) {
        this._localEntries[idx] = entry;
      }
    } else {
      this._localEntries.push(entry);
    }
    this._saveLocalCache(this._localEntries);
  }

  async resolveEndpoint() {
    if (this._resolvedEndpoint !== undefined) return this._resolvedEndpoint;
    try {
      const params = new URLSearchParams(globalThis.location?.search || '');
      const fromParam = params.get('leaderboard');
      if (fromParam) {
        this._resolvedEndpoint = fromParam.replace(/\/+$/, '');
        return this._resolvedEndpoint;
      }
      const saved = globalThis.localStorage?.getItem(CUSTOM_ENDPOINT_KEY);
      if (saved) {
        this._resolvedEndpoint = saved.replace(/\/+$/, '');
        return this._resolvedEndpoint;
      }
    } catch {}

    if (GLOBAL_LEADERBOARD_URL) {
      this._resolvedEndpoint = GLOBAL_LEADERBOARD_URL.replace(/\/+$/, '');
      return this._resolvedEndpoint;
    }

    const host = globalThis.location?.hostname || '';
    const proto = globalThis.location?.protocol || '';
    if (host.endsWith('.github.io') || proto === 'file:') {
      this._resolvedEndpoint = '';
      return '';
    }

    // On local / LAN Node server, probe same-origin /api/leaderboard
    try {
      const res = await fetch('./api/lan-info', { cache: 'no-store' });
      if (res.ok) {
        this._resolvedEndpoint = './api/leaderboard';
        return this._resolvedEndpoint;
      }
    } catch {}

    this._resolvedEndpoint = '';
    return '';
  }

  async fetchBoard({ mode = 'solo', levelId = 'overall', limit = 20 } = {}) {
    this._localEntries = this._loadLocalCache();
    const endpoint = await this.resolveEndpoint();
    if (!endpoint) {
      return {
        source: 'local',
        mode,
        levelId,
        entries: queryLeaderboardEntries(this._localEntries, { mode, levelId, limit }),
      };
    }

    try {
      const url = `${endpoint}?mode=${encodeURIComponent(mode)}&level=${encodeURIComponent(levelId)}&limit=${encodeURIComponent(limit)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return {
        source: 'global',
        mode: json.mode || mode,
        levelId: json.levelId || levelId,
        entries: Array.isArray(json.entries) ? json.entries : [],
      };
    } catch {
      this._localEntries = this._loadLocalCache();
      return {
        source: 'local-fallback',
        mode,
        levelId,
        entries: queryLeaderboardEntries(this._localEntries, { mode, levelId, limit }),
      };
    }
  }

  async submitRun(submission) {
    this._localEntries = this._loadLocalCache();
    const payload = {
      ...submission,
      playerId: submission.playerId || this.playerId,
    };

    const parsedLocal = normalizeLeaderboardSubmission(payload);
    if (!parsedLocal.ok) {
      return { ok: false, error: parsedLocal.error };
    }
    this._cacheLocalEntry(parsedLocal.entry);

    const buildLocalResult = (source = 'local') => {
      const board = queryLeaderboardEntries(this._localEntries, {
        mode: parsedLocal.entry.mode,
        levelId: parsedLocal.entry.levelId,
        limit: 50,
      });
      const rank = board.findIndex((e) => e.entryKey === parsedLocal.entry.entryKey) + 1;
      return {
        ok: true,
        source,
        entry: parsedLocal.entry,
        rank: rank > 0 ? rank : 1,
        total: board.length,
        entries: board.slice(0, 20),
      };
    };

    const endpoint = await this.resolveEndpoint();
    if (!endpoint) {
      return buildLocalResult('local');
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };
      if (json.entry) this._cacheLocalEntry(json.entry);
      return {
        ok: true,
        source: 'global',
        entry: json.entry,
        rank: json.rank || null,
        total: json.total || null,
        entries: Array.isArray(json.entries) ? json.entries : [],
      };
    } catch {
      return buildLocalResult('local-fallback');
    }
  }
}
