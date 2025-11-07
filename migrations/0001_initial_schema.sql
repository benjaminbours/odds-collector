-- Create scheduled_jobs table
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id TEXT PRIMARY KEY,
  league_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  match_date TEXT NOT NULL,
  kickoff_time TEXT NOT NULL,
  timing_offset TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt TEXT,
  snapshot_path TEXT,
  error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

-- Create indexes for scheduled_jobs
CREATE INDEX IF NOT EXISTS idx_scheduled_time
  ON scheduled_jobs(scheduled_time, status);

CREATE INDEX IF NOT EXISTS idx_event_offset
  ON scheduled_jobs(event_id, timing_offset);

CREATE INDEX IF NOT EXISTS idx_match_date
  ON scheduled_jobs(league_id, match_date);

-- Create collection_metrics table
CREATE TABLE IF NOT EXISTS collection_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  league_id TEXT NOT NULL,
  jobs_scheduled INTEGER DEFAULT 0,
  jobs_completed INTEGER DEFAULT 0,
  jobs_failed INTEGER DEFAULT 0,
  api_requests INTEGER DEFAULT 0,
  api_cost_tokens INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
