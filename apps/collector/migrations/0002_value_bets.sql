-- Value Bets Track Record System
-- Migration: 0002_value_bets.sql

-- Value bets table - stores individual value bet detections
CREATE TABLE IF NOT EXISTS value_bets (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL DEFAULT 'oddslab_default',

  -- Match identification
  event_id TEXT NOT NULL,
  match_id TEXT,
  league_id TEXT NOT NULL,
  season TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  match_date TEXT NOT NULL,
  kickoff_time TEXT NOT NULL,

  -- Prediction (1X2 market)
  market TEXT NOT NULL DEFAULT 'h2h',
  outcome TEXT NOT NULL,
  model_probability REAL NOT NULL,
  model_xg_home REAL,
  model_xg_away REAL,

  -- Opening odds (at detection)
  opening_odds REAL NOT NULL,
  opening_implied_prob REAL NOT NULL,
  opening_ev REAL NOT NULL,
  bookmaker_name TEXT NOT NULL,

  -- Closing odds (updated at closing timing)
  closing_odds REAL,
  closing_implied_prob REAL,
  clv REAL,

  -- Outcome (updated manually after match)
  actual_outcome TEXT,
  bet_won INTEGER,
  profit_flat REAL,
  profit_kelly REAL,
  kelly_stake REAL,

  -- Status tracking
  status TEXT DEFAULT 'pending',
  was_posted INTEGER DEFAULT 0,
  posted_at TEXT,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_value_bets_status ON value_bets(status);
CREATE INDEX IF NOT EXISTS idx_value_bets_kickoff ON value_bets(kickoff_time);
CREATE INDEX IF NOT EXISTS idx_value_bets_event ON value_bets(event_id);
CREATE INDEX IF NOT EXISTS idx_value_bets_league_date ON value_bets(league_id, match_date);
CREATE INDEX IF NOT EXISTS idx_value_bets_model ON value_bets(model_id);
CREATE INDEX IF NOT EXISTS idx_value_bets_posted ON value_bets(was_posted, status);

-- Value bet stats table - aggregated statistics for fast queries
CREATE TABLE IF NOT EXISTS value_bet_stats (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL DEFAULT 'oddslab_default',
  scope_type TEXT NOT NULL,
  scope_value TEXT,

  total_bets INTEGER DEFAULT 0,
  settled_bets INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_rate REAL DEFAULT 0,

  total_staked_flat REAL DEFAULT 0,
  total_profit_flat REAL DEFAULT 0,
  roi_flat REAL DEFAULT 0,

  total_staked_kelly REAL DEFAULT 0,
  total_profit_kelly REAL DEFAULT 0,
  roi_kelly REAL DEFAULT 0,

  avg_clv REAL DEFAULT 0,
  positive_clv_rate REAL DEFAULT 0,

  last_updated TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Unique index for stats scopes
CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_scope ON value_bet_stats(model_id, scope_type, scope_value);
