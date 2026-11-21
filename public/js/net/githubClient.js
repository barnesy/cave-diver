/**
 * Browser client for GitHub OAuth sign-in, Private Gist Career Logbook Cloud Sync,
 * and direct in-app GitHub Issue reporting (with pre-filled fallback URL).
 */

export const DEFAULT_GITHUB_REPO = 'barnesy/cave-diver';

export function buildPrefilledIssueUrl({
  kind = 'bug',
  title = '',
  description = '',
  context = {},
  repo = DEFAULT_GITHUB_REPO,
} = {}) {
  const cleanKind = kind === 'feature' || kind === 'feedback' ? kind : 'bug';
  const prefix = cleanKind === 'feature' ? '[Feature]' : cleanKind === 'feedback' ? '[Feedback]' : '[Bug]';
  const rawTitle = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 130);
  const finalTitle = rawTitle
    ? rawTitle.toLowerCase().startsWith(prefix.toLowerCase())
      ? rawTitle
      : `${prefix} ${rawTitle}`
    : `${prefix} `;

  const diagLines = [];
  if (context && typeof context === 'object') {
    if (context.appVersion) diagLines.push(`- **App Version:** ${String(context.appVersion).slice(0, 24)}`);
    if (context.levelName || context.levelId) {
      diagLines.push(`- **Expedition:** ${String(context.levelName || context.levelId).slice(0, 80)}`);
    }
    if (context.difficulty) diagLines.push(`- **Mode:** ${String(context.difficulty).slice(0, 24)}`);
    if (context.multiplayer !== undefined) {
      diagLines.push(`- **Session:** ${context.multiplayer ? 'Co-op Multiplayer' : 'Solo'}`);
    }
    if (context.careerSummary) diagLines.push(`- **Career:** ${String(context.careerSummary).slice(0, 120)}`);
    if (context.viewport) diagLines.push(`- **Viewport:** ${String(context.viewport).slice(0, 48)}`);
    if (context.userAgent) diagLines.push(`- **Device / Browser:** ${String(context.userAgent).slice(0, 180)}`);
  }

  const bodyParts = [String(description || '').trim().slice(0, 4000)];
  if (diagLines.length > 0) {
    bodyParts.push(
      '',
      '<details>',
      '<summary>🤿 Techno Dive Diagnostics</summary>',
      '',
      ...diagLines,
      '</details>'
    );
  }
  bodyParts.push('', '_Submitted from Techno Dive_');

  const params = new URLSearchParams();
  params.set('title', finalTitle.slice(0, 150));
  params.set('body', bodyParts.join('\n'));
  return `https://github.com/${repo}/issues/new?${params.toString()}`;
}

export class GitHubClient {
  constructor() {
    this.configured = false;
    this.authenticated = false;
    this.user = null;
    this.gistId = null;
    this.gistUrl = null;
    this.repo = DEFAULT_GITHUB_REPO;
    this.lastSyncedAt = null;
    this.ghostCount = 0;
    this.syncing = false;
    this._syncInFlight = null;
  }

  _canUseSameOriginApi() {
    if (typeof window === 'undefined' || !window.location) return false;
    const proto = window.location.protocol;
    const host = window.location.hostname || '';
    if (proto !== 'https:' && proto !== 'http:') return false;
    if (host.endsWith('.github.io')) return false;
    return true;
  }

  getLoginUrl() {
    return '/api/github/login';
  }

  async fetchSession() {
    if (!this._canUseSameOriginApi()) {
      this.configured = false;
      this.authenticated = false;
      this.user = null;
      return this.getStatus();
    }
    try {
      const res = await fetch('/api/github/session', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!res.ok) {
        this.configured = false;
        this.authenticated = false;
        this.user = null;
        return this.getStatus();
      }
      const data = await res.json();
      this.configured = Boolean(data?.configured);
      this.authenticated = Boolean(data?.authenticated && data?.user?.login);
      this.user = this.authenticated ? data.user : null;
      this.gistId = data?.gistId || null;
      this.gistUrl = data?.gistUrl || null;
      if (data?.repo) this.repo = data.repo;
    } catch {
      this.configured = false;
      this.authenticated = false;
      this.user = null;
    }
    return this.getStatus();
  }

  getStatus() {
    return {
      configured: this.configured,
      authenticated: this.authenticated,
      user: this.user,
      gistId: this.gistId,
      gistUrl: this.gistUrl,
      repo: this.repo,
      lastSyncedAt: this.lastSyncedAt,
      ghostCount: this.ghostCount,
      syncing: this.syncing,
    };
  }

  async logout() {
    try {
      if (this._canUseSameOriginApi()) {
        await fetch('/api/github/logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
      }
    } catch {
      // ignore network error on sign out
    }
    this.authenticated = false;
    this.user = null;
    this.gistId = null;
    this.gistUrl = null;
    this.lastSyncedAt = null;
    this.ghostCount = 0;
    return this.getStatus();
  }

  /**
   * Smart-merge local career logbook, loadout preferences & PB ghost replays with the user's private GitHub Gist.
   */
  async syncStats(logbook, prefs = {}, ghosts = null) {
    if (!this.authenticated) {
      return { ok: false, error: 'Not signed in with GitHub' };
    }
    if (this._syncInFlight) {
      return this._syncInFlight;
    }
    this.syncing = true;
    this._syncInFlight = (async () => {
      try {
        const res = await fetch('/api/github/sync', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logbook, prefs, ...(ghosts ? { ghosts } : {}) }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          this.authenticated = false;
          this.user = null;
          return { ok: false, expired: true, error: data?.error || 'GitHub session expired' };
        }
        if (!res.ok || !data?.ok) {
          return { ok: false, error: data?.error || `Sync failed (${res.status})` };
        }
        this.gistId = data.gistId || this.gistId;
        this.gistUrl = data.gistUrl || this.gistUrl;
        this.lastSyncedAt = data.syncedAt || new Date().toISOString();
        const syncedGhosts = data.ghosts && typeof data.ghosts === 'object' ? data.ghosts : {};
        this.ghostCount = Object.keys(syncedGhosts).length;
        return {
          ok: true,
          gistId: this.gistId,
          gistUrl: this.gistUrl,
          syncedAt: this.lastSyncedAt,
          logbook: data.logbook,
          prefs: data.prefs || {},
          ghosts: syncedGhosts,
        };
      } catch (err) {
        return { ok: false, error: err?.message || 'Network error syncing GitHub Gist' };
      } finally {
        this.syncing = false;
        this._syncInFlight = null;
      }
    })();
    return this._syncInFlight;
  }

  /**
   * Submit a GitHub Issue directly to barnesy/cave-diver under the signed-in user's account.
   */
  async submitIssue({ kind = 'bug', title, description, context = {} }) {
    const fallbackUrl = buildPrefilledIssueUrl({
      kind,
      title,
      description,
      context,
      repo: this.repo,
    });
    if (!this.authenticated) {
      return {
        ok: false,
        needsAuth: true,
        fallbackUrl,
        error: 'Sign in with GitHub to submit directly, or open the pre-filled form.',
      };
    }
    try {
      const res = await fetch('/api/github/issue', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, title, description, context }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        this.authenticated = false;
        this.user = null;
        return {
          ok: false,
          needsAuth: true,
          fallbackUrl: data?.fallbackUrl || fallbackUrl,
          error: data?.error || 'GitHub session expired',
        };
      }
      if (!res.ok || !data?.ok) {
        return {
          ok: false,
          fallbackUrl: data?.fallbackUrl || fallbackUrl,
          error: data?.error || `Issue submission failed (${res.status})`,
        };
      }
      return {
        ok: true,
        issue: data.issue,
      };
    } catch (err) {
      return {
        ok: false,
        fallbackUrl,
        error: err?.message || 'Network error submitting GitHub issue',
      };
    }
  }
}
