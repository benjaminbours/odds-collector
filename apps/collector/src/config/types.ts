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

// ============================================
// Value Bet Track Record Types
// ============================================

/**
 * Value bet status
 */
export type ValueBetStatus = 'pending' | 'clv_updated' | 'settled';

/**
 * Value bet outcome
 */
export type ValueBetOutcome = 'home' | 'draw' | 'away';

/**
 * Value bet record stored in D1
 */
export interface ValueBet {
  /** Unique ID */
  id: string;
  /** Model that made the prediction */
  modelId: string;

  // Match identification
  /** Event ID from odds provider */
  eventId: string;
  /** Match ID from backend */
  matchId?: string;
  /** League ID */
  leagueId: string;
  /** Season */
  season: string;
  /** Home team name */
  homeTeam: string;
  /** Away team name */
  awayTeam: string;
  /** Match date (YYYY-MM-DD) */
  matchDate: string;
  /** Kickoff time (ISO8601) */
  kickoffTime: string;

  // Prediction details
  /** Market type */
  market: string;
  /** Predicted outcome */
  outcome: ValueBetOutcome;
  /** Model's probability */
  modelProbability: number;
  /** Model's xG for home team */
  modelXgHome?: number;
  /** Model's xG for away team */
  modelXgAway?: number;

  // Opening odds (at detection)
  /** Opening odds */
  openingOdds: number;
  /** Implied probability from opening odds */
  openingImpliedProb: number;
  /** Expected value at detection */
  openingEv: number;
  /** Bookmaker name */
  bookmakerName: string;

  // Closing odds (updated at closing timing)
  /** Closing odds */
  closingOdds?: number;
  /** Implied probability from closing odds */
  closingImpliedProb?: number;
  /** Closing Line Value */
  clv?: number;

  // Outcome (updated after match)
  /** Actual match outcome */
  actualOutcome?: ValueBetOutcome;
  /** Whether the bet won */
  betWon?: boolean;
  /** Profit with flat 1 unit stake */
  profitFlat?: number;
  /** Profit with Half Kelly stake */
  profitKelly?: number;
  /** Calculated Half Kelly stake */
  kellyStake?: number;

  // Status tracking
  /** Current status */
  status: ValueBetStatus;
  /** Whether posted to Twitter */
  wasPosted: boolean;
  /** When posted to Twitter */
  postedAt?: string;

  /** Creation timestamp */
  createdAt: string;
}

/**
 * Stats scope type
 */
export type StatsScopeType = 'overall' | 'weekly' | 'monthly';

/**
 * Aggregated value bet statistics
 */
export interface ValueBetStats {
  /** Unique ID */
  id: string;
  /** Model ID */
  modelId: string;
  /** Scope type */
  scopeType: StatsScopeType;
  /** Scope value (e.g., '2024-W48', '2024-12', null for overall) */
  scopeValue?: string;

  // Counts
  /** Total bets */
  totalBets: number;
  /** Settled bets */
  settledBets: number;
  /** Wins */
  wins: number;
  /** Losses */
  losses: number;
  /** Win rate (0-1) */
  winRate: number;

  // Flat staking
  /** Total units staked (flat) */
  totalStakedFlat: number;
  /** Total profit (flat) */
  totalProfitFlat: number;
  /** ROI (flat) */
  roiFlat: number;

  // Kelly staking
  /** Total units staked (Kelly) */
  totalStakedKelly: number;
  /** Total profit (Kelly) */
  totalProfitKelly: number;
  /** ROI (Kelly) */
  roiKelly: number;

  // CLV stats
  /** Average CLV */
  avgClv: number;
  /** Positive CLV rate (0-1) */
  positiveCmvRate: number;

  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Track record response for API
 */
export interface TrackRecordResponse {
  /** Model ID */
  modelId: string;
  /** Total bets */
  totalBets: number;
  /** Settled bets */
  settledBets: number;
  /** Wins */
  wins: number;
  /** Losses */
  losses: number;
  /** Win rate (0-1) */
  winRate: number;
  /** ROI with flat staking */
  roiFlat: number;
  /** ROI with Kelly staking */
  roiKelly: number;
  /** Average CLV */
  avgClv: number;
  /** Positive CLV rate */
  positiveCmvRate: number;
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
