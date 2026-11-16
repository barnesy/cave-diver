import {
  normalizeLeaderboardSubmission,
  buildOverallStandings,
} from '../../../public/js/game/leaderboardModel.js';
import { isValidLevelId } from '../../../public/js/levels/index.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function mapRow(r) {
  let crew = [];
  try {
    crew = JSON.parse(r.crew_json || '[]');
  } catch {}
  return {
    mode: r.mode,
    levelId: r.level_id,
    entryKey: r.entry_key,
    playerId: r.player_id,
    runId: r.run_id,
    displayName: r.display_name,
    crew,
    teamSize: r.team_size,
    score: r.score,
    grade: r.grade,
    timeSec: r.time_sec,
    exploredPct: r.explored_pct,
    collectiblesFound: r.collectibles_found,
    collectiblesTotal: r.collectibles_total,
    createdAt: r.created_at,
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (url.pathname === '/healthz') {
      return jsonResponse({ ok: true, service: 'cave-diver-leaderboard' });
    }

    if (url.pathname !== '/api/leaderboard') {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    if (request.method === 'GET') {
      const mode = url.searchParams.get('mode') === 'team' ? 'team' : 'solo';
      const level = url.searchParams.get('level') || 'overall';
      const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit')) || 20));

      if (level === 'overall') {
        const res = await env.DB.prepare(
          'SELECT * FROM leaderboard_entries WHERE mode = ? ORDER BY score DESC LIMIT 600'
        )
          .bind(mode)
          .all();
        const rows = (res.results || []).map(mapRow);
        return jsonResponse({
          mode,
          levelId: 'overall',
          entries: buildOverallStandings(rows, mode, limit),
        });
      }

      if (!isValidLevelId(level)) {
        return jsonResponse({ error: 'Invalid dive site levelId.' }, 400);
      }

      const res = await env.DB.prepare(
        `SELECT * FROM leaderboard_entries
         WHERE mode = ? AND level_id = ?
         ORDER BY score DESC, time_sec ASC, created_at ASC
         LIMIT ?`
      )
        .bind(mode, level, limit)
        .all();

      return jsonResponse({
        mode,
        levelId: level,
        entries: (res.results || []).map(mapRow),
      });
    }

    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON body.' }, 400);
      }

      const parsed = normalizeLeaderboardSubmission(body);
      if (!parsed.ok) {
        return jsonResponse({ error: parsed.error }, 400);
      }

      const e = parsed.entry;
      await env.DB.prepare(
        `INSERT INTO leaderboard_entries (
          mode, level_id, entry_key, player_id, run_id, display_name,
          crew_json, team_size, score, grade, time_sec, explored_pct,
          collectibles_found, collectibles_total, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (mode, entry_key) DO UPDATE SET
          display_name = excluded.display_name,
          crew_json = excluded.crew_json,
          team_size = excluded.team_size,
          score = excluded.score,
          grade = excluded.grade,
          time_sec = excluded.time_sec,
          explored_pct = excluded.explored_pct,
          collectibles_found = excluded.collectibles_found,
          collectibles_total = excluded.collectibles_total,
          created_at = excluded.created_at
        WHERE excluded.score > leaderboard_entries.score
           OR (excluded.score = leaderboard_entries.score AND excluded.time_sec < leaderboard_entries.time_sec)`
      )
        .bind(
          e.mode,
          e.levelId,
          e.entryKey,
          e.playerId,
          e.runId,
          e.displayName,
          JSON.stringify(e.crew),
          e.teamSize,
          e.score,
          e.grade,
          e.timeSec,
          e.exploredPct,
          e.collectiblesFound,
          e.collectiblesTotal,
          e.createdAt
        )
        .run();

      const rankRes = await env.DB.prepare(
        `SELECT COUNT(*) AS better_count FROM leaderboard_entries
         WHERE mode = ? AND level_id = ?
           AND (score > ? OR (score = ? AND time_sec < ?))`
      )
        .bind(e.mode, e.levelId, e.score, e.score, e.timeSec)
        .first();
      const totalRes = await env.DB.prepare(
        `SELECT COUNT(*) AS total_count FROM leaderboard_entries WHERE mode = ? AND level_id = ?`
      )
        .bind(e.mode, e.levelId)
        .first();

      const topRes = await env.DB.prepare(
        `SELECT * FROM leaderboard_entries
         WHERE mode = ? AND level_id = ?
         ORDER BY score DESC, time_sec ASC, created_at ASC
         LIMIT 20`
      )
        .bind(e.mode, e.levelId)
        .all();

      return jsonResponse({
        ok: true,
        entry: e,
        rank: Number(rankRes?.better_count || 0) + 1,
        total: Number(totalRes?.total_count || 1),
        entries: (topRes.results || []).map(mapRow),
      });
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  },
};
