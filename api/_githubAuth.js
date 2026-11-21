import crypto from 'node:crypto';

export const SESSION_COOKIE_NAME = 'td_gh_session';
export const STATE_COOKIE_NAME = 'td_gh_state';
export const GIST_FILENAME = 'techno-dive-logbook.json';
export const GIST_DESCRIPTION = 'Techno Dive — Career Logbook & Stats (Private Cloud Save)';
export const DEFAULT_ISSUES_REPO = 'barnesy/cave-diver';
export const GITHUB_OAUTH_SCOPES = 'read:user gist public_repo';

export function getGitHubConfig(env = process.env) {
  const clientId = String(env.GITHUB_CLIENT_ID || '').trim();
  const clientSecret = String(env.GITHUB_CLIENT_SECRET || '').trim();
  const sessionSecret = String(env.SESSION_SECRET || '').trim();
  const rawRepo = String(env.GITHUB_ISSUES_REPO || DEFAULT_ISSUES_REPO).trim();
  const repo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(rawRepo) ? rawRepo : DEFAULT_ISSUES_REPO;
  const configured = Boolean(clientId && clientSecret);
  return {
    clientId,
    clientSecret,
    sessionSecret,
    repo,
    configured,
  };
}

function deriveKey(cfg) {
  const material = cfg.sessionSecret || cfg.clientSecret;
  if (!material) {
    throw new Error('GitHub session encryption key is not configured');
  }
  return crypto.createHash('sha256').update(`techno-dive-gh-session-v1:${material}`).digest();
}

export function encryptSessionPayload(payload, cfg) {
  const key = deriveKey(cfg);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptSessionPayload(token, cfg) {
  if (!token || typeof token !== 'string') return null;
  try {
    const key = deriveKey(cfg);
    const buf = Buffer.from(token, 'base64url');
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plaintext);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export function serializeCookie(name, value, { maxAge = 0, secure = true, httpOnly = true, sameSite = 'Lax', path = '/' } = {}) {
  const parts = [`${name}=${value}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (Number.isFinite(maxAge)) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  }
  return parts.join('; ');
}

export function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isHttpsRequest(request) {
  try {
    const proto = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol;
    return String(proto).toLowerCase().startsWith('https');
  } catch {
    return true;
  }
}

export function getPublicOrigin(request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedHost) {
    const proto = forwardedProto
      ? forwardedProto.split(',')[0].trim()
      : url.protocol.replace(':', '');
    return `${proto}://${forwardedHost.split(',')[0].trim()}`;
  }
  return url.origin;
}

export function sanitizePrefs(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  if (typeof raw.playerName === 'string' && raw.playerName.trim()) {
    out.playerName = raw.playerName.trim().slice(0, 16);
  }
  if (raw.difficulty === 'guided' || raw.difficulty === 'standard' || raw.difficulty === 'hardcore') {
    out.difficulty = raw.difficulty;
  }
  if (raw.gear && typeof raw.gear === 'object') {
    out.gear = {
      sonar: Boolean(raw.gear.sonar),
      dpv: Boolean(raw.gear.dpv),
      ccr: Boolean(raw.gear.ccr),
    };
  }
  return out;
}

export function buildGitHubHeaders(accessToken) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${accessToken}`,
    'User-Agent': 'Techno-Dive-App',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export async function findLogbookGist(accessToken, fetchImpl = fetch) {
  const res = await fetchImpl('https://api.github.com/gists?per_page=50', {
    headers: buildGitHubHeaders(accessToken),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw Object.assign(new Error(`GitHub Gists list failed (${res.status}): ${errText.slice(0, 160)}`), {
      status: res.status,
    });
  }
  const list = await res.json();
  if (!Array.isArray(list)) return null;
  for (const g of list) {
    if (g && g.files && Object.prototype.hasOwnProperty.call(g.files, GIST_FILENAME)) {
      return { id: g.id, htmlUrl: g.html_url || '', updatedAt: g.updated_at || '' };
    }
  }
  return null;
}

export async function readLogbookGist(accessToken, gistId, fetchImpl = fetch) {
  if (!gistId) return null;
  const res = await fetchImpl(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, {
    headers: buildGitHubHeaders(accessToken),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw Object.assign(new Error(`GitHub Gist read failed (${res.status}): ${errText.slice(0, 160)}`), {
      status: res.status,
    });
  }
  const gist = await res.json();
  const file = gist?.files?.[GIST_FILENAME];
  if (!file) return null;
  let content = file.content || '';
  if (file.truncated && file.raw_url) {
    const rawRes = await fetchImpl(file.raw_url, { headers: buildGitHubHeaders(accessToken) });
    if (rawRes.ok) content = await rawRes.text();
  }
  let parsed = null;
  try {
    parsed = content ? JSON.parse(content) : null;
  } catch {
    parsed = null;
  }
  return {
    id: gist.id,
    htmlUrl: gist.html_url || '',
    updatedAt: gist.updated_at || '',
    data: parsed,
  };
}

export async function writeLogbookGist(accessToken, gistId, payloadObj, fetchImpl = fetch) {
  const serialized = JSON.stringify(payloadObj, null, 2);
  const body = gistId
    ? {
        description: GIST_DESCRIPTION,
        files: {
          [GIST_FILENAME]: { content: serialized },
        },
      }
    : {
        description: GIST_DESCRIPTION,
        public: false,
        files: {
          [GIST_FILENAME]: { content: serialized },
        },
      };

  const url = gistId
    ? `https://api.github.com/gists/${encodeURIComponent(gistId)}`
    : 'https://api.github.com/gists';
  const res = await fetchImpl(url, {
    method: gistId ? 'PATCH' : 'POST',
    headers: {
      ...buildGitHubHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw Object.assign(new Error(`GitHub Gist save failed (${res.status}): ${errText.slice(0, 160)}`), {
      status: res.status,
    });
  }
  const gist = await res.json();
  return {
    id: gist.id,
    htmlUrl: gist.html_url || '',
    updatedAt: gist.updated_at || new Date().toISOString(),
  };
}

export function formatGitHubIssuePayload({ kind = 'bug', title = '', description = '', context = {} } = {}) {
  const cleanKind = kind === 'feature' || kind === 'feedback' ? kind : 'bug';
  const prefix = cleanKind === 'feature' ? '[Feature]' : cleanKind === 'feedback' ? '[Feedback]' : '[Bug]';
  const rawTitle = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 130);
  const finalTitle = rawTitle.toLowerCase().startsWith(prefix.toLowerCase()) ? rawTitle : `${prefix} ${rawTitle}`;
  const cleanDesc = String(description || '').trim().slice(0, 4000);

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

  const bodyParts = [cleanDesc];
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
  bodyParts.push('', '_Submitted in-app from Techno Dive_');

  return {
    kind: cleanKind,
    title: finalTitle.slice(0, 150),
    body: bodyParts.join('\n'),
  };
}

export function buildPrefilledGitHubIssueUrl({ kind = 'bug', title = '', description = '', context = {}, repo = DEFAULT_ISSUES_REPO } = {}) {
  const formatted = formatGitHubIssuePayload({ kind, title, description, context });
  const params = new URLSearchParams();
  if (formatted.title) params.set('title', formatted.title);
  if (formatted.body) params.set('body', formatted.body);
  return `https://github.com/${repo}/issues/new?${params.toString()}`;
}
