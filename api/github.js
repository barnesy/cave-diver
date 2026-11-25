import crypto from 'node:crypto';
import { createEmptyLogbook, mergeCareerLogbooks, mergeGhostTracks, normalizeCareerLogbook } from '../public/js/game/logbookModel.js';
import {
  GITHUB_OAUTH_SCOPES,
  SESSION_COOKIE_NAME,
  STATE_COOKIE_NAME,
  buildGitHubHeaders,
  buildPrefilledGitHubIssueUrl,
  decryptSessionPayload,
  encryptSessionPayload,
  findLogbookGist,
  formatGitHubIssuePayload,
  getGitHubConfig,
  getPublicOrigin,
  isHttpsRequest,
  parseCookies,
  readLogbookGist,
  sanitizePrefs,
  serializeCookie,
  timingSafeEqualStr,
  writeLogbookGist,
} from './_githubAuth.js';

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function jsonWithCookies(payload, status = 200, cookies = []) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  for (const c of cookies) {
    if (c) headers.append('Set-Cookie', c);
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function redirectWithCookies(location, cookies = []) {
  const headers = new Headers({
    Location: location,
    'Cache-Control': 'no-store',
  });
  for (const c of cookies) {
    if (c) headers.append('Set-Cookie', c);
  }
  return new Response(null, { status: 302, headers });
}

function extractAction(request) {
  const url = new URL(request.url);
  const qAction = String(url.searchParams.get('action') || '').trim().toLowerCase();
  if (qAction) return qAction;
  const parts = url.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || '';
  if (last && last !== 'github') return last.toLowerCase();
  return 'session';
}

function readSessionFromRequest(request, cfg) {
  if (!cfg.configured) return null;
  const cookies = parseCookies(request.headers.get('cookie') || '');
  const raw = cookies[SESSION_COOKIE_NAME];
  if (!raw) return null;
  const parsed = decryptSessionPayload(raw, cfg);
  if (!parsed || !parsed.token || !parsed.user?.login) return null;
  return parsed;
}

export function createGitHubHandler({ fetchImpl = fetch, env = process.env } = {}) {
  async function handleGet(request) {
    const cfg = getGitHubConfig(env);
    const action = extractAction(request);
    const secure = isHttpsRequest(request);
    const origin = getPublicOrigin(request);

    if (action === 'session') {
      const sess = readSessionFromRequest(request, cfg);
      return jsonWithCookies({
        configured: cfg.configured,
        authenticated: Boolean(sess),
        user: sess ? sess.user : null,
        gistId: sess?.gistId || null,
        gistUrl: sess?.gistUrl || (sess?.gistId ? `https://gist.github.com/${sess.user.login}/${sess.gistId}` : null),
        repo: cfg.repo,
      });
    }

    if (action === 'login') {
      if (!cfg.configured) {
        return redirectWithCookies(`${origin}/?gh=not_configured`);
      }
      const nonce = crypto.randomBytes(24).toString('base64url');
      const callbackUrl = `${origin}/api/github/callback`;
      const authUrl = new URL('https://github.com/login/oauth/authorize');
      authUrl.searchParams.set('client_id', cfg.clientId);
      authUrl.searchParams.set('redirect_uri', callbackUrl);
      authUrl.searchParams.set('scope', GITHUB_OAUTH_SCOPES);
      authUrl.searchParams.set('state', nonce);
      const stateCookie = serializeCookie(STATE_COOKIE_NAME, nonce, {
        maxAge: 600,
        secure,
      });
      return redirectWithCookies(authUrl.toString(), [stateCookie]);
    }

    if (action === 'callback') {
      const clearState = serializeCookie(STATE_COOKIE_NAME, '', { maxAge: 0, secure });
      if (!cfg.configured) {
        return redirectWithCookies(`${origin}/?gh=not_configured`, [clearState]);
      }
      const url = new URL(request.url);
      const code = url.searchParams.get('code') || '';
      const state = url.searchParams.get('state') || '';
      const ghError = url.searchParams.get('error') || '';
      if (ghError) {
        return redirectWithCookies(`${origin}/?gh=${encodeURIComponent(ghError)}`, [clearState]);
      }

      const cookies = parseCookies(request.headers.get('cookie') || '');
      const expectedState = cookies[STATE_COOKIE_NAME] || '';
      if (!code || !state || !timingSafeEqualStr(state, expectedState)) {
        return redirectWithCookies(`${origin}/?gh=invalid_state`, [clearState]);
      }

      try {
        const callbackUrl = `${origin}/api/github/callback`;
        const tokenRes = await fetchImpl('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Techno-Dive-App',
          },
          body: JSON.stringify({
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
            code,
            redirect_uri: callbackUrl,
          }),
        });
        if (!tokenRes.ok) {
          return redirectWithCookies(`${origin}/?gh=token_error`, [clearState]);
        }
        const tokenJson = await tokenRes.json();
        const accessToken = String(tokenJson?.access_token || '').trim();
        if (!accessToken) {
          return redirectWithCookies(`${origin}/?gh=token_missing`, [clearState]);
        }

        const userRes = await fetchImpl('https://api.github.com/user', {
          headers: buildGitHubHeaders(accessToken),
        });
        if (!userRes.ok) {
          return redirectWithCookies(`${origin}/?gh=user_error`, [clearState]);
        }
        const ghUser = await userRes.json();
        if (!ghUser?.login) {
          return redirectWithCookies(`${origin}/?gh=user_error`, [clearState]);
        }

        let gistMeta = null;
        try {
          gistMeta = await findLogbookGist(accessToken, fetchImpl);
        } catch {
          // Non-fatal: sync will discover or create the private Gist cleanly
        }

        const sessionPayload = {
          token: accessToken,
          user: {
            id: ghUser.id,
            login: String(ghUser.login),
            name: String(ghUser.name || ghUser.login).slice(0, 48),
            avatarUrl: String(ghUser.avatar_url || ''),
            htmlUrl: String(ghUser.html_url || `https://github.com/${ghUser.login}`),
          },
          gistId: gistMeta?.id || null,
          gistUrl: gistMeta?.htmlUrl || null,
          createdAt: Date.now(),
        };

        const sessionCookie = serializeCookie(
          SESSION_COOKIE_NAME,
          encryptSessionPayload(sessionPayload, cfg),
          { maxAge: SESSION_MAX_AGE_SEC, secure }
        );
        return redirectWithCookies(`${origin}/?gh=connected`, [clearState, sessionCookie]);
      } catch {
        return redirectWithCookies(`${origin}/?gh=oauth_failed`, [clearState]);
      }
    }

    if (action === 'sync') {
      const sess = readSessionFromRequest(request, cfg);
      if (!sess) {
        return jsonWithCookies({ error: 'Not signed in with GitHub' }, 401);
      }
      try {
        let gistId = sess.gistId;
        let existing = gistId ? await readLogbookGist(sess.token, gistId, fetchImpl) : null;
        if (!existing) {
          const found = await findLogbookGist(sess.token, fetchImpl);
          if (found?.id) {
            gistId = found.id;
            existing = await readLogbookGist(sess.token, gistId, fetchImpl);
          }
        }
        if (!existing) {
          return jsonWithCookies({
            ok: true,
            found: false,
            gistId: null,
            gistUrl: null,
            logbook: null,
            prefs: {},
            ghosts: {},
          });
        }
        const updatedCookies = [];
        if (existing.id && existing.id !== sess.gistId) {
          const refreshed = { ...sess, gistId: existing.id, gistUrl: existing.htmlUrl || sess.gistUrl };
          updatedCookies.push(
            serializeCookie(SESSION_COOKIE_NAME, encryptSessionPayload(refreshed, cfg), {
              maxAge: SESSION_MAX_AGE_SEC,
              secure,
            })
          );
        }
        return jsonWithCookies(
          {
            ok: true,
            found: true,
            gistId: existing.id,
            gistUrl: existing.htmlUrl || `https://gist.github.com/${sess.user.login}/${existing.id}`,
            updatedAt: existing.updatedAt || existing.data?.updatedAt || null,
            logbook: normalizeCareerLogbook(existing.data?.logbook || existing.data),
            prefs: sanitizePrefs(existing.data?.prefs),
            ghosts: mergeGhostTracks(existing.data?.ghosts, null),
          },
          200,
          updatedCookies
        );
      } catch (err) {
        if (err?.status === 401) {
          const clearSess = serializeCookie(SESSION_COOKIE_NAME, '', { maxAge: 0, secure });
          return jsonWithCookies({ error: 'GitHub session expired. Please sign in again.' }, 401, [clearSess]);
        }
        return jsonWithCookies({ error: err?.message || 'Failed to read GitHub Gist stats' }, 502);
      }
    }

    return jsonWithCookies({ error: `Unknown GitHub action: ${action}` }, 400);
  }

  async function handlePost(request) {
    const cfg = getGitHubConfig(env);
    const action = extractAction(request);
    const secure = isHttpsRequest(request);

    if (action === 'logout') {
      const clearSess = serializeCookie(SESSION_COOKIE_NAME, '', { maxAge: 0, secure });
      const clearState = serializeCookie(STATE_COOKIE_NAME, '', { maxAge: 0, secure });
      return jsonWithCookies({ ok: true }, 200, [clearSess, clearState]);
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    if (action === 'sync') {
      const sess = readSessionFromRequest(request, cfg);
      if (!sess) {
        return jsonWithCookies({ error: 'Not signed in with GitHub' }, 401);
      }
      try {
        let gistId = sess.gistId;
        let existing = gistId ? await readLogbookGist(sess.token, gistId, fetchImpl) : null;
        if (!existing) {
          const found = await findLogbookGist(sess.token, fetchImpl);
          if (found?.id) {
            gistId = found.id;
            existing = await readLogbookGist(sess.token, gistId, fetchImpl);
          } else {
            gistId = null;
          }
        }

        const isExplicitReset = body?.reset === true;
        const remoteBook = existing?.data?.logbook || (existing?.data?.cleared ? existing.data : null);
        const clientBook = body?.logbook || null;
        const mergedLogbook = isExplicitReset ? createEmptyLogbook() : mergeCareerLogbooks(remoteBook, clientBook);
        const mergedPrefs = isExplicitReset
          ? {}
          : {
              ...sanitizePrefs(existing?.data?.prefs),
              ...sanitizePrefs(body?.prefs),
            };
        const mergedGhosts = isExplicitReset ? {} : mergeGhostTracks(existing?.data?.ghosts, body?.ghosts);
        const syncedAt = new Date().toISOString();

        if (isExplicitReset && !gistId) {
          return jsonWithCookies(
            {
              ok: true,
              reset: true,
              gistId: null,
              gistUrl: null,
              syncedAt,
              logbook: mergedLogbook,
              prefs: mergedPrefs,
              ghosts: mergedGhosts,
            },
            200
          );
        }

        const gistPayload = {
          schema: 'techno-dive-logbook-v1',
          updatedAt: syncedAt,
          githubUser: sess.user.login,
          logbook: mergedLogbook,
          prefs: mergedPrefs,
          ghosts: mergedGhosts,
        };

        const saved = await writeLogbookGist(sess.token, gistId, gistPayload, fetchImpl);
        const updatedCookies = [];
        if (saved.id && (saved.id !== sess.gistId || saved.htmlUrl !== sess.gistUrl)) {
          const refreshed = { ...sess, gistId: saved.id, gistUrl: saved.htmlUrl };
          updatedCookies.push(
            serializeCookie(SESSION_COOKIE_NAME, encryptSessionPayload(refreshed, cfg), {
              maxAge: SESSION_MAX_AGE_SEC,
              secure,
            })
          );
        }

        return jsonWithCookies(
          {
            ok: true,
            ...(isExplicitReset ? { reset: true } : {}),
            gistId: saved.id,
            gistUrl: saved.htmlUrl || `https://gist.github.com/${sess.user.login}/${saved.id}`,
            syncedAt,
            logbook: mergedLogbook,
            prefs: mergedPrefs,
            ghosts: mergedGhosts,
          },
          200,
          updatedCookies
        );
      } catch (err) {
        if (err?.status === 401) {
          const clearSess = serializeCookie(SESSION_COOKIE_NAME, '', { maxAge: 0, secure });
          return jsonWithCookies({ error: 'GitHub session expired. Please sign in again.' }, 401, [clearSess]);
        }
        return jsonWithCookies({ error: err?.message || 'Failed to sync stats to GitHub Gist' }, 502);
      }
    }

    if (action === 'issue') {
      const title = String(body?.title || '').trim();
      const description = String(body?.description || '').trim();
      if (title.length < 3 || description.length < 5) {
        return jsonWithCookies({ error: 'Please include a short title and description (min 5 chars).' }, 400);
      }

      const formatted = formatGitHubIssuePayload({
        kind: body?.kind,
        title,
        description,
        context: body?.context,
      });
      const fallbackUrl = buildPrefilledGitHubIssueUrl({
        kind: body?.kind,
        title,
        description,
        context: body?.context,
        repo: cfg.repo,
      });

      const sess = readSessionFromRequest(request, cfg);
      if (!sess) {
        return jsonWithCookies(
          {
            error: 'Sign in with GitHub to submit directly, or use the pre-filled GitHub link.',
            fallbackUrl,
          },
          401
        );
      }

      try {
        const res = await fetchImpl(`https://api.github.com/repos/${cfg.repo}/issues`, {
          method: 'POST',
          headers: {
            ...buildGitHubHeaders(sess.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: formatted.title,
            body: formatted.body,
          }),
        });
        if (res.status === 401) {
          const clearSess = serializeCookie(SESSION_COOKIE_NAME, '', { maxAge: 0, secure });
          return jsonWithCookies(
            { error: 'GitHub session expired. Please sign in again.', fallbackUrl },
            401,
            [clearSess]
          );
        }
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          return jsonWithCookies(
            {
              error: `GitHub rejected issue creation (${res.status}): ${errText.slice(0, 140)}`,
              fallbackUrl,
            },
            502
          );
        }
        const created = await res.json();
        return jsonWithCookies({
          ok: true,
          issue: {
            number: created.number,
            title: created.title,
            url: created.html_url,
          },
        });
      } catch (err) {
        return jsonWithCookies(
          { error: err?.message || 'Failed to submit GitHub issue', fallbackUrl },
          502
        );
      }
    }

    return jsonWithCookies({ error: `Unknown GitHub POST action: ${action}` }, 400);
  }

  return {
    GET: handleGet,
    POST: handlePost,
    OPTIONS: async () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } }),
  };
}

const defaultHandler = createGitHubHandler();
export const GET = defaultHandler.GET;
export const POST = defaultHandler.POST;
export const OPTIONS = defaultHandler.OPTIONS;
