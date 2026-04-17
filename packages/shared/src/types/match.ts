/**
 * Match metadata types.
 *
 * The `MatchRecord` / `SnapshotRecord` pair backs the D1 tables (matches, snapshots)
 * that replace the older R2 JSON indexes. `MatchIndex` / `DateIndex` below remain
 * until the Phase 4 retirement removes the last R2-index consumers.
 */

/**
 * A single match row from D1 `matches`, optionally joined with its snapshots.
 */
export interface MatchRecord {
  matchKey: string;
  leagueId: string;
  season: string;
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  kickoffTime: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * A single snapshot row from D1 `snapshots`.
 */
export interface SnapshotRecord {
  matchKey: string;
  timing: string;
  r2Path: string;
  collectedAt: string;
}

/**
 * Match with its snapshot map keyed by timing — convenience shape for callers
 * that used to read `MatchIndexEntry.snapshots`.
 */
export interface MatchWithSnapshots extends MatchRecord {
  snapshots: Record<string, string>;
}

/**
 * Legacy: Match index types for R2 storage lookups.
 * Retained until the dashboard finishes migrating off `by_match.json` / `by_date.json`.
 */

/**
 * Index entry for a match
 */
export interface MatchIndexEntry {
  /** Home team */
  homeTeam: string;
  /** Away team */
  awayTeam: string;
  /** Match date (YYYY-MM-DD) */
  matchDate: string;
  /** Event ID */
  eventId: string;
  /** Available snapshots (timing -> file path) */
  snapshots: Record<string, string>;
  /** Kickoff time */
  kickoffTime: string;
}

/**
 * Match index file structure
 */
export interface MatchIndex {
  /** Index version */
  version: string;
  /** League ID */
  leagueId: string;
  /** Season */
  season: string;
  /** Last update timestamp */
  lastUpdated: string;
  /** Match entries indexed by key */
  matches: Record<string, MatchIndexEntry>;
}

/**
 * Date index entry
 */
export interface DateIndexEntry {
  /** Number of matches on this date */
  matchCount: number;
  /** Match keys for this date */
  matches: string[];
  /** Available snapshot timings */
  snapshotTimingsAvailable: string[];
}

/**
 * Date index file structure (by_date.json)
 */
export interface DateIndex {
  /** Index version */
  version: string;
  /** League ID */
  leagueId: string;
  /** Season */
  season: string;
  /** Last update timestamp */
  lastUpdated: string;
  /** Empty matches object (for compatibility) */
  matches: Record<string, never>;
  /** Date entries indexed by date string (YYYY-MM-DD) */
  dates: Record<string, DateIndexEntry>;
}
