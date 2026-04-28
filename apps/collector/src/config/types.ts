/**
 * Collector-specific type definitions
 *
 * Shared types (OddsSnapshot, EventOdds, MatchIndex, ValueBet, etc.)
 * should be imported directly from '@odds-collector/shared'
 */

import type { EventOdds, TimingOffset, ValueBetOutcome } from '@odds-collector/shared';

/**
 * League configuration for the collector
 * Note: This differs from the dashboard's LeagueConfig as it includes
 * normalizeTeamName function which can't be serialized
 */
export interface CollectorLeagueConfig {
  /** Unique league identifier */
  id: string;
  /** Provider-specific league key (e.g., 'soccer_epl' for The Odds API) */
  providerKey: string;
  /** Current season (e.g., '2024-2025') */
  season: string;
  /** Optional team name normalization function */
  normalizeTeamName?: (name: string) => string;
  /**
   * Optional per-league timing offsets. Overrides the collector-level
   * default when set — used for tournaments (e.g. World Cup) that need a
   * denser pre-match curve than league play.
   */
  timings?: TimingOffset[];
  /**
   * Optional fixed season string used at execution time. When set, overrides
   * the date-based `inferSeasonFromDate` inference — required for tournaments
   * like the World Cup whose match dates fall in summer (June/July) and
   * therefore don't fit the European Aug–May season convention.
   */
  seasonOverride?: string;
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
 * Value bet creation request from backend
 */
export interface CreateValueBetRequest {
  id: string;
  outcome: ValueBetOutcome;
  modelProbability: number;
  modelXgHome?: number;
  modelXgAway?: number;
  openingOdds: number;
  openingImpliedProb: number;
  openingEv: number;
  bookmakerName: string;
  kellyStake?: number;
}

/**
 * Detect value bets request (sent to backend)
 */
export interface DetectValueBetsRequest {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  kickoffTime: string;
  leagueId: string;
  season: string;
  oddsSnapshot: EventOdds;
}

/**
 * Detect value bets response (from backend)
 */
export interface DetectValueBetsResponse {
  valueBets: CreateValueBetRequest[];
  predictionTimestamp: string;
}
