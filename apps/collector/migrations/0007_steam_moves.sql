-- Steam moves — canonical store for detected bookmaker line movements between
-- consecutive timings. Replaces the six R2 JSON shapes (steam_moves/,
-- steam_moves_upcoming.json, steam_moves_recent.json, steam_moves_dates.json,
-- steam_moves_by_date/, legacy steam_moves.json) that the offline cache script
-- produces today; the dashboard fan-out across those per-league files is the
-- main read-path cost the dashboard pays.
--
-- `point_key` is a TEXT companion to the nullable `point` column and is the
-- one that participates in the composite PK. SQLite treats NULL as distinct
-- in composite PKs, so a nullable `point` would let duplicate h2h/btts rows
-- through ON CONFLICT.
--
-- `steam_moves_processed` is a tiny marker table so the offline script can
-- skip past matches whose snapshots were already compared — including those
-- where zero moves were detected, which EXISTS-over-steam_moves cannot
-- express.

CREATE TABLE IF NOT EXISTS steam_moves (
  match_key     TEXT NOT NULL,
  market        TEXT NOT NULL,
  outcome       TEXT NOT NULL,
  point_key     TEXT NOT NULL DEFAULT '',   -- '' for h2h/btts/double_chance, else String(point)
  bookmaker     TEXT NOT NULL,
  from_timing   TEXT NOT NULL,
  to_timing     TEXT NOT NULL,

  league_id     TEXT NOT NULL,               -- denormalized for range queries
  kickoff_time  TEXT NOT NULL,               -- denormalized for range queries

  market_label  TEXT NOT NULL,
  point         REAL,                        -- numeric form; NULL for h2h/btts/double_chance
  from_odds     REAL NOT NULL,
  to_odds       REAL NOT NULL,
  movement      REAL NOT NULL,               -- signed %
  direction     TEXT NOT NULL,               -- 'shortening' | 'drifting'

  detected_at   TEXT DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (match_key, market, outcome, point_key, bookmaker, from_timing, to_timing),
  FOREIGN KEY (match_key) REFERENCES matches(match_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sm_league_kickoff ON steam_moves(league_id, kickoff_time);
CREATE INDEX IF NOT EXISTS idx_sm_kickoff        ON steam_moves(kickoff_time);
CREATE INDEX IF NOT EXISTS idx_sm_market         ON steam_moves(market);

CREATE TABLE IF NOT EXISTS steam_moves_processed (
  match_key    TEXT PRIMARY KEY,
  processed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_key) REFERENCES matches(match_key) ON DELETE CASCADE
);
