import {
  normalizeLeaderboardSubmission,
  queryLeaderboardEntries,
} from '../game/leaderboardModel.js';

const PLAYER_ID_KEY = 'caveDiverGlobalPlayerId_v1';
const CUSTOM_ENDPOINT_KEY = 'caveDiverLeaderboardApiUrl_v1';
const LOCAL_CACHE_KEY = 'caveDiverLeaderboardCache_v1';

// Shared Vercel + Blob global backend used from GitHub Pages and static origins
export const GLOBAL_LEADERBOARD_URL = 'https://cave-diver.vercel.app/api/leaderboard';

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
    this._syncedLocalKeys = new Set();
    this._syncPromise = null;
    this._retryTimer = null;
  }

  async _fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
    if (typeof AbortController === 'undefined') {
      return fetch(url, opts);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  _entrySig(entry) {
    return `${entry.mode}|${entry.entryKey}|${entry.score}`;
  }

  _buildSubmissionBody(entry) {
    return {
      mode: entry.mode,
      levelId: entry.levelId,
      runId: entry.mode === 'team' ? entry.entryKey : undefined,
      playerId: entry.playerId || this.playerId,
      diverName: entry.displayName,
      crew: entry.crew,
      teamSize: entry.teamSize,
      score: entry.score,
      grade: entry.grade,
      timeSec: entry.timeSec,
      exploredPct: entry.exploredPct,
      collectiblesFound: entry.collectiblesFound,
      createdAt: entry.createdAt,
    };
  }

  getPendingSyncCount() {
    this._localEntries = this._loadLocalCache();
    return this._localEntries.filter((e) => {
      if (!e || e.grade === 'DNF' || !(e.score > 0)) return false;
      return !this._syncedLocalKeys.has(this._entrySig(e));
    }).length;
  }

  _scheduleRetry(delayMs = 15000) {
    if (this._retryTimer || typeof setTimeout !== 'function') return;
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      this.syncPendingLocalRuns().catch(() => {});
    }, delayMs);
    this._retryTimer.unref?.();
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

    const host = globalThis.location?.hostname || '';
    const proto = globalThis.location?.protocol || '';
    if (!host.endsWith('.github.io') && proto !== 'file:') {
      // On Vercel or local Node server, prefer same-origin /api/leaderboard when healthy
      try {
        const res = await this._fetchWithTimeout('./api/healthz', { cache: 'no-store' }, 3500);
        if (res.ok) {
          this._resolvedEndpoint = './api/leaderboard';
          return this._resolvedEndpoint;
        }
      } catch {}
    }

    if (GLOBAL_LEADERBOARD_URL) {
      this._resolvedEndpoint = GLOBAL_LEADERBOARD_URL.replace(/\/+$/, '');
      return this._resolvedEndpoint;
    }

    return '';
  }

  async syncPendingLocalRuns() {
    const endpoint = await this.resolveEndpoint();
    if (!endpoint) return 0;
    return this._syncLocalCacheToGlobal(endpoint);
  }

  async _postSingleEntry(endpoint, entry) {
    const sig = this._entrySig(entry);
    try {
      const res = await this._fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this._buildSubmissionBody(entry)),
        },
        8000
      );
      if (res.ok || res.status === 400) {
        this._syncedLocalKeys.add(sig);
        return res.ok ? 1 : 0;
      }
    } catch {
      // Keep pending for retry
    }
    return 0;
  }

  async _syncLocalCacheToGlobal(endpoint) {
    if (!endpoint || !this._localEntries.length) return 0;
    if (this._syncPromise) return this._syncPromise;

    this._syncPromise = (async () => {
      let uploaded = 0;
      const pending = this._localEntries.filter((e) => {
        if (!e || e.grade === 'DNF' || !(e.score > 0)) return false;
        return !this._syncedLocalKeys.has(this._entrySig(e));
      });
      if (pending.length === 0) return 0;

      if (pending.length === 1) {
        uploaded += await this._postSingleEntry(endpoint, pending[0]);
      } else {
        // Sync in atomic batches of 25 to eliminate multi-request ETag contention
        for (let i = 0; i < pending.length; i += 25) {
          const chunk = pending.slice(i, i + 25);
          let batchHandled = false;
          try {
            const res = await this._fetchWithTimeout(
              endpoint,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  entries: chunk.map((e) => this._buildSubmissionBody(e)),
                }),
              },
              9000
            );
            if (res.ok) {
              for (const entry of chunk) this._syncedLocalKeys.add(this._entrySig(entry));
              uploaded += chunk.length;
              batchHandled = true;
            } else if (res.status !== 400) {
              // Transient server error — retry later
              break;
            }
          } catch {
            // Network timeout / offline — stop batch loop cleanly
            break;
          }
          if (!batchHandled) {
            // Legacy/mock endpoint rejected batch array: fall back cleanly to sequential single POSTs
            for (const entry of chunk) {
              uploaded += await this._postSingleEntry(endpoint, entry);
            }
          }
        }
      }
      if (this.getPendingSyncCount() > 0) {
        this._scheduleRetry(20000);
      }
      return uploaded;
    })();

    try {
      return await this._syncPromise;
    } finally {
      this._syncPromise = null;
    }
  }

  async fetchBoard({ mode = 'solo', levelId = 'overall', limit = 20 } = {}) {
    this._localEntries = this._loadLocalCache();
    const endpoint = await this.resolveEndpoint();
    if (!endpoint) {
      return {
        source: 'local',
        mode,
        levelId,
        pendingSync: this.getPendingSyncCount(),
        entries: queryLeaderboardEntries(this._localEntries, { mode, levelId, limit }),
      };
    }

    try {
      await this._syncLocalCacheToGlobal(endpoint);
      const url = `${endpoint}?mode=${encodeURIComponent(mode)}&level=${encodeURIComponent(levelId)}&limit=${encodeURIComponent(limit)}`;
      const res = await this._fetchWithTimeout(url, { cache: 'no-store' }, 8000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const remoteEntries = Array.isArray(json.entries) ? json.entries : [];
      if (levelId !== 'overall' && this._localEntries.length > 0) {
        const byKey = new Map();
        for (const e of [...remoteEntries, ...this._localEntries]) {
          if (!e || e.mode !== mode || e.levelId !== levelId) continue;
          const prev = byKey.get(e.entryKey);
          if (!prev || e.score > prev.score || (e.score === prev.score && e.timeSec < prev.timeSec)) {
            byKey.set(e.entryKey, e);
          }
        }
        return {
          source: 'global',
          mode: json.mode || mode,
          levelId: json.levelId || levelId,
          pendingSync: this.getPendingSyncCount(),
          entries: queryLeaderboardEntries(Array.from(byKey.values()), { mode, levelId, limit }),
        };
      }
      return {
        source: 'global',
        mode: json.mode || mode,
        levelId: json.levelId || levelId,
        pendingSync: this.getPendingSyncCount(),
        entries: remoteEntries,
      };
    } catch {
      this._localEntries = this._loadLocalCache();
      return {
        source: 'local-fallback',
        mode,
        levelId,
        pendingSync: this.getPendingSyncCount(),
        entries: queryLeaderboardEntries(this._localEntries, { mode, levelId, limit }),
      };
    }
  }

  async submitRun(submission) {
    this._localEntries = this._loadLocalCache();
    const payload = {
      ...submission,
      playerId: submission.playerId || this.playerId,
      createdAt: Number.isFinite(Number(submission.createdAt)) ? Number(submission.createdAt) : Date.now(),
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
        pendingSync: source !== 'global',
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

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this._fetchWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
          8000
        );
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          if (json.entry) this._cacheLocalEntry(json.entry);
          this._syncedLocalKeys.add(this._entrySig(json.entry || parsedLocal.entry));
          return {
            ok: true,
            source: 'global',
            pendingSync: false,
            entry: json.entry,
            rank: json.rank || null,
            total: json.total || null,
            entries: Array.isArray(json.entries) ? json.entries : [],
          };
        }
        if (res.status < 500) {
          return { ok: false, error: json.error || `HTTP ${res.status}` };
        }
      } catch {
        // Retry once on transient network error
      }
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 450));
      }
    }

    this._scheduleRetry(15000);
    return buildLocalResult('local-fallback');
  }
}
