/**
 * Match index types for R2 storage lookups
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
