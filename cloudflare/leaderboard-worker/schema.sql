CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL CHECK (mode IN ('solo', 'team')),
  level_id TEXT NOT NULL,
  entry_key TEXT NOT NULL,
  player_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  crew_json TEXT NOT NULL,
  team_size INTEGER NOT NULL,
  score INTEGER NOT NULL,
  grade TEXT NOT NULL,
  time_sec REAL NOT NULL,
  explored_pct INTEGER NOT NULL,
  collectibles_found INTEGER NOT NULL,
  collectibles_total INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (mode, entry_key)
);

CREATE INDEX IF NOT EXISTS idx_lb_mode_level_score
  ON leaderboard_entries (mode, level_id, score DESC, time_sec ASC);

CREATE INDEX IF NOT EXISTS idx_lb_mode_created
  ON leaderboard_entries (mode, created_at DESC);
