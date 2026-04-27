-- X (Twitter) post log — one row per steam move that was considered for
-- posting to X. Composite PK mirrors `steam_moves` so dedup is a 1:1 lookup
-- against the move that generated the post.
--
-- `status` lifecycle:
--   'posted' — tweet succeeded; tweet_id + posted_at set.
--   'failed' — X API returned non-2xx; error captured. The orchestrator may
--              retry on a later collection run while attempts < a small cap.
--
-- We intentionally do NOT log moves that were filtered out (wrong bookmaker,
-- wrong direction, below threshold, posting disabled). Filtering happens in
-- the orchestrator before this table is touched, so the table records only
-- decisions to attempt a post.

CREATE TABLE IF NOT EXISTS x_posts (
  match_key     TEXT NOT NULL,
  market        TEXT NOT NULL,
  outcome       TEXT NOT NULL,
  point_key     TEXT NOT NULL DEFAULT '',
  bookmaker     TEXT NOT NULL,
  from_timing   TEXT NOT NULL,
  to_timing     TEXT NOT NULL,

  status        TEXT NOT NULL,                -- 'posted' | 'failed'
  tweet_id      TEXT,                         -- set on success
  posted_at     TEXT,                         -- set on success
  error         TEXT,                         -- set on failure
  attempts      INTEGER NOT NULL DEFAULT 1,

  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (match_key, market, outcome, point_key, bookmaker, from_timing, to_timing),
  FOREIGN KEY (match_key) REFERENCES matches(match_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_xp_status     ON x_posts(status);
CREATE INDEX IF NOT EXISTS idx_xp_posted_at  ON x_posts(posted_at);
