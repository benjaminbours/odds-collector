-- Match metadata + snapshots — canonical store, derived from completed scheduled_jobs.
-- Replaces the R2 JSON indexes (by_match, by_date, by_team) that drifted from D1 and
-- forced costly whole-file rewrites on every cron cycle.

CREATE TABLE IF NOT EXISTS matches (
  match_key     TEXT PRIMARY KEY,
  league_id     TEXT NOT NULL,
  season        TEXT NOT NULL,
  event_id      TEXT NOT NULL,
  home_team     TEXT NOT NULL,
  away_team     TEXT NOT NULL,
  match_date    TEXT NOT NULL,
  kickoff_time  TEXT NOT NULL,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_matches_league_kickoff ON matches(league_id, kickoff_time);
CREATE INDEX IF NOT EXISTS idx_matches_league_date    ON matches(league_id, match_date);
CREATE INDEX IF NOT EXISTS idx_matches_event          ON matches(event_id);
CREATE INDEX IF NOT EXISTS idx_matches_kickoff        ON matches(kickoff_time);

CREATE TABLE IF NOT EXISTS snapshots (
  match_key     TEXT NOT NULL,
  timing        TEXT NOT NULL,
  r2_path       TEXT NOT NULL,
  collected_at  TEXT NOT NULL,
  PRIMARY KEY (match_key, timing),
  FOREIGN KEY (match_key) REFERENCES matches(match_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_timing ON snapshots(timing);
