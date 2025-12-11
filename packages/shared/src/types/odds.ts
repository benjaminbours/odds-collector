/**
 * Core odds types shared between collector and dashboard
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
