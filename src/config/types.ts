/**
 * Core type definitions for the odds collector
 */

/**
 * Timing offset configuration for odds snapshots
 */
export interface TimingOffset {
  /** Human-readable name (e.g., 'opening', 'closing') */
  name: string;
  /** Hours before kickoff to fetch odds */
  hoursBeforeKickoff: number;
  /** Markets to fetch (comma-separated) */
  markets: string;
  /** Priority level for scheduling */
  priority: 'critical' | 'important' | 'normal';
  /** Directory path for storing snapshots */
  directory: string;
}

/**
 * League configuration
 */
export interface LeagueConfig {
  /** Unique league identifier */
  id: string;
  /** Provider-specific league key (e.g., 'soccer_epl' for The Odds API) */
  providerKey: string;
  /** Current season (e.g., '2024-2025') */
  season: string;
  /** Optional team name normalization function */
  normalizeTeamName?: (name: string) => string;
}

/**
 * Event (match) data from provider
 */
export interface OddsEvent {
  /** Unique event ID from provider */
  id: string;
  /** Home team name */
  homeTeam: string;
  /** Away team name */
  awayTeam: string;
  /** Kickoff time (ISO8601) */
  commenceTime: string;
  /** Sport key */
  sportKey?: string;
}

/**
 * Bookmaker odds for a specific market
 */
export interface BookmakerMarket {
  /** Market key (e.g., 'h2h', 'totals') */
  key: string;
  /** Market outcomes with odds */
  outcomes: Array<{
    name: string;
    price: number;
    point?: number;
  }>;
}

/**
 * Odds data from a single bookmaker
 */
export interface BookmakerOdds {
  /** Bookmaker key */
  key: string;
  /** Bookmaker display name */
  title: string;
  /** Last update timestamp */
  lastUpdate: string;
  /** Available markets */
  markets: BookmakerMarket[];
}

/**
 * Complete odds data for an event
 */
export interface EventOdds {
  /** Event ID */
  id: string;
  /** Sport key */
  sportKey: string;
  /** Home team */
  homeTeam: string;
  /** Away team */
  awayTeam: string;
  /** Commence time */
  commenceTime: string;
  /** Odds from multiple bookmakers */
  bookmakers: BookmakerOdds[];
}

/**
 * Snapshot metadata
 */
export interface SnapshotMetadata {
  /** When the snapshot was created */
  timestamp: string;
  /** Match date (YYYY-MM-DD) */
  date: string;
  /** League ID */
  league: string;
  /** Season */
  season: string;
  /** Collection method */
  collectionMethod: 'event_based' | 'bulk';
  /** Snapshot timing type */
  snapshotTiming: string;
  /** Event metadata */
  eventMetadata?: {
    eventId: string;
    kickoffTime: string;
  };
}

/**
 * Complete snapshot with odds and metadata
 */
export interface OddsSnapshot {
  /** Snapshot metadata */
  metadata: SnapshotMetadata;
  /** Event odds data */
  odds: EventOdds;
}

/**
 * Scheduled job for odds collection
 */
export interface ScheduledJob {
  /** Unique job ID */
  id: string;
  /** League ID */
  leagueId: string;
  /** Event ID */
  eventId: string;
  /** Home team name */
  homeTeam: string;
  /** Away team name */
  awayTeam: string;
  /** Match date (YYYY-MM-DD) */
  matchDate: string;
  /** Kickoff time (ISO8601) */
  kickoffTime: string;
  /** Timing offset name */
  timingOffset: string;
  /** When to execute this job (ISO8601) */
  scheduledTime: string;
  /** Job status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Number of attempts */
  attempts: number;
  /** Last attempt timestamp */
  lastAttempt?: string;
  /** Where the snapshot was saved */
  snapshotPath?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Completion timestamp */
  completedAt?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Collection metrics
 */
export interface CollectionMetrics {
  /** Date of metrics */
  date: string;
  /** League ID */
  leagueId: string;
  /** Jobs scheduled */
  jobsScheduled: number;
  /** Jobs completed */
  jobsCompleted: number;
  /** Jobs failed */
  jobsFailed: number;
  /** API requests made */
  apiRequests: number;
  /** API cost in tokens */
  apiCostTokens: number;
}

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
