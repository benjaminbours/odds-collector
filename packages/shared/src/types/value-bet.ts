/**
 * Value bet types for track record
 */

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
