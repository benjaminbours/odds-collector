/**
 * Service for managing value bets in D1 database
 */

import type {
  ValueBet,
  ValueBetStatus,
  ValueBetOutcome,
  TrackRecordResponse,
} from '@odds-collector/shared';
import type { CreateValueBetRequest } from '../config/types';

export interface ValueBetServiceConfig {
  db: D1Database;
}

export interface CreateValueBetParams {
  modelId: string;
  eventId: string;
  matchId?: string;
  leagueId: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  kickoffTime: string;
  valueBet: CreateValueBetRequest;
}

export interface UpdateClvParams {
  closingOdds: number;
  closingImpliedProb: number;
  clv: number;
}

export interface UpdateOutcomeParams {
  actualOutcome: ValueBetOutcome;
  betWon: boolean;
  profitFlat: number;
  profitKelly: number;
}

export interface ListValueBetsParams {
  status?: ValueBetStatus;
  leagueId?: string;
  modelId?: string;
  limit?: number;
  offset?: number;
}

// Allowed status values for validation
const VALID_STATUSES: ValueBetStatus[] = ['pending', 'clv_updated', 'settled'];

// Validate and sanitize parameters
function validateStatus(status: string | undefined): ValueBetStatus | undefined {
  if (!status) return undefined;
  if (VALID_STATUSES.includes(status as ValueBetStatus)) {
    return status as ValueBetStatus;
  }
  throw new Error(`Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
}

function validateLimit(limit: number): number {
  const sanitized = Math.floor(limit);
  if (sanitized < 1 || sanitized > 100) {
    return 20; // Default to safe value
  }
  return sanitized;
}

function validateOffset(offset: number): number {
  const sanitized = Math.floor(offset);
  if (sanitized < 0) {
    return 0;
  }
  return sanitized;
}

export class ValueBetService {
  private db: D1Database;

  constructor(config: ValueBetServiceConfig) {
    this.db = config.db;
  }

  /**
   * Create a new value bet record
   */
  async createValueBet(params: CreateValueBetParams): Promise<ValueBet> {
    const { modelId, eventId, matchId, leagueId, season, homeTeam, awayTeam, matchDate, kickoffTime, valueBet } = params;

    await this.db
      .prepare(`
        INSERT INTO value_bets (
          id, model_id, event_id, match_id, league_id, season,
          home_team, away_team, match_date, kickoff_time,
          market, outcome, model_probability, model_xg_home, model_xg_away,
          opening_odds, opening_implied_prob, opening_ev, bookmaker_name,
          kelly_stake, status, was_posted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        valueBet.id,
        modelId,
        eventId,
        matchId || null,
        leagueId,
        season,
        homeTeam,
        awayTeam,
        matchDate,
        kickoffTime,
        'h2h',
        valueBet.outcome,
        valueBet.modelProbability,
        valueBet.modelXgHome || null,
        valueBet.modelXgAway || null,
        valueBet.openingOdds,
        valueBet.openingImpliedProb,
        valueBet.openingEv,
        valueBet.bookmakerName,
        valueBet.kellyStake || null,
        'pending',
        0
      )
      .run();

    const created = await this.getValueBetById(valueBet.id);
    if (!created) {
      throw new Error('Failed to create value bet');
    }
    return created;
  }

  /**
   * Get a value bet by ID
   */
  async getValueBetById(id: string): Promise<ValueBet | null> {
    const row = await this.db
      .prepare('SELECT * FROM value_bets WHERE id = ?')
      .bind(id)
      .first();

    if (!row) return null;
    return this.mapRowToValueBet(row);
  }

  /**
   * Get value bets by event ID
   */
  async getValueBetsByEventId(eventId: string): Promise<ValueBet[]> {
    const result = await this.db
      .prepare('SELECT * FROM value_bets WHERE event_id = ?')
      .bind(eventId)
      .all();

    return result.results.map(row => this.mapRowToValueBet(row));
  }

  /**
   * Update CLV for a value bet (called at closing timing)
   */
  async updateClv(id: string, params: UpdateClvParams): Promise<void> {
    await this.db
      .prepare(`
        UPDATE value_bets SET
          closing_odds = ?,
          closing_implied_prob = ?,
          clv = ?,
          status = 'clv_updated'
        WHERE id = ?
      `)
      .bind(params.closingOdds, params.closingImpliedProb, params.clv, id)
      .run();
  }

  /**
   * Update outcome for a value bet (called after match settles)
   */
  async updateOutcome(id: string, params: UpdateOutcomeParams): Promise<void> {
    await this.db
      .prepare(`
        UPDATE value_bets SET
          actual_outcome = ?,
          bet_won = ?,
          profit_flat = ?,
          profit_kelly = ?,
          status = 'settled'
        WHERE id = ?
      `)
      .bind(
        params.actualOutcome,
        params.betWon ? 1 : 0,
        params.profitFlat,
        params.profitKelly,
        id
      )
      .run();
  }

  /**
   * Mark a value bet as posted to Twitter
   */
  async markAsPosted(id: string): Promise<void> {
    await this.db
      .prepare(`
        UPDATE value_bets SET
          was_posted = 1,
          posted_at = datetime('now')
        WHERE id = ?
      `)
      .bind(id)
      .run();
  }

  /**
   * List value bets with optional filters
   *
   * All parameters are validated and sanitized before use in queries.
   * Queries use parameterized statements to prevent SQL injection.
   */
  async listValueBets(params: ListValueBetsParams = {}): Promise<{ valueBets: ValueBet[]; total: number }> {
    // Validate and sanitize all inputs
    const validatedStatus = validateStatus(params.status);
    const validatedLimit = validateLimit(params.limit ?? 20);
    const validatedOffset = validateOffset(params.offset ?? 0);

    // Build WHERE clause with parameterized queries
    const conditions: string[] = [];
    const bindings: (string | number)[] = [];

    if (validatedStatus) {
      conditions.push('status = ?');
      bindings.push(validatedStatus);
    }
    if (params.leagueId) {
      conditions.push('league_id = ?');
      bindings.push(params.leagueId);
    }
    if (params.modelId) {
      conditions.push('model_id = ?');
      bindings.push(params.modelId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count (parameterized query)
    const countResult = await this.db
      .prepare(`SELECT COUNT(*) as count FROM value_bets ${whereClause}`)
      .bind(...bindings)
      .first() as any;
    const total = countResult?.count || 0;

    // Get paginated results (parameterized query)
    const result = await this.db
      .prepare(`
        SELECT * FROM value_bets
        ${whereClause}
        ORDER BY kickoff_time DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...bindings, validatedLimit, validatedOffset)
      .all();

    return {
      valueBets: result.results.map(row => this.mapRowToValueBet(row)),
      total,
    };
  }

  /**
   * Get value bets pending CLV update (kickoff within 2 hours)
   */
  async getPendingClvUpdates(): Promise<ValueBet[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM value_bets
        WHERE status = 'pending'
        AND kickoff_time <= datetime('now', '+2 hours')
        ORDER BY kickoff_time ASC
      `)
      .all();

    return result.results.map(row => this.mapRowToValueBet(row));
  }

  /**
   * Get unsettled value bets (for outcome updates)
   */
  async getUnsettledValueBets(): Promise<ValueBet[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM value_bets
        WHERE status IN ('pending', 'clv_updated')
        AND kickoff_time < datetime('now')
        ORDER BY kickoff_time ASC
      `)
      .all();

    return result.results.map(row => this.mapRowToValueBet(row));
  }

  /**
   * Get track record statistics
   */
  async getTrackRecord(modelId: string = 'oddslab_default'): Promise<TrackRecordResponse> {
    const stats = await this.db
      .prepare(`
        SELECT
          COUNT(*) as total_bets,
          SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END) as settled_bets,
          SUM(CASE WHEN bet_won = 1 THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN bet_won = 0 THEN 1 ELSE 0 END) as losses,
          AVG(CASE WHEN status = 'settled' THEN CAST(bet_won AS REAL) ELSE NULL END) as win_rate,
          SUM(CASE WHEN status = 'settled' THEN profit_flat ELSE 0 END) as total_profit_flat,
          SUM(CASE WHEN status = 'settled' THEN 1.0 ELSE 0 END) as total_staked_flat,
          SUM(CASE WHEN status = 'settled' THEN profit_kelly ELSE 0 END) as total_profit_kelly,
          SUM(CASE WHEN status = 'settled' THEN kelly_stake ELSE 0 END) as total_staked_kelly,
          AVG(CASE WHEN clv IS NOT NULL THEN clv ELSE NULL END) as avg_clv,
          AVG(CASE WHEN clv IS NOT NULL THEN CASE WHEN clv > 0 THEN 1.0 ELSE 0.0 END ELSE NULL END) as positive_clv_rate
        FROM value_bets
        WHERE model_id = ?
      `)
      .bind(modelId)
      .first() as any;

    const totalStakedFlat = stats.total_staked_flat || 0;
    const totalStakedKelly = stats.total_staked_kelly || 0;

    return {
      modelId,
      totalBets: stats.total_bets || 0,
      settledBets: stats.settled_bets || 0,
      wins: stats.wins || 0,
      losses: stats.losses || 0,
      winRate: stats.win_rate || 0,
      roiFlat: totalStakedFlat > 0 ? (stats.total_profit_flat || 0) / totalStakedFlat : 0,
      roiKelly: totalStakedKelly > 0 ? (stats.total_profit_kelly || 0) / totalStakedKelly : 0,
      avgClv: stats.avg_clv || 0,
      positiveCmvRate: stats.positive_clv_rate || 0,
    };
  }

  /**
   * Get value bets ready to post (high EV, not yet posted)
   */
  async getPostableValueBets(minEv: number = 0.05): Promise<ValueBet[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM value_bets
        WHERE was_posted = 0
        AND status = 'pending'
        AND opening_ev >= ?
        AND kickoff_time > datetime('now')
        ORDER BY opening_ev DESC
        LIMIT 10
      `)
      .bind(minEv)
      .all();

    return result.results.map(row => this.mapRowToValueBet(row));
  }

  /**
   * Map database row to ValueBet interface
   */
  private mapRowToValueBet(row: any): ValueBet {
    return {
      id: row.id,
      modelId: row.model_id,
      eventId: row.event_id,
      matchId: row.match_id || undefined,
      leagueId: row.league_id,
      season: row.season,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      matchDate: row.match_date,
      kickoffTime: row.kickoff_time,
      market: row.market,
      outcome: row.outcome as ValueBetOutcome,
      modelProbability: row.model_probability,
      modelXgHome: row.model_xg_home || undefined,
      modelXgAway: row.model_xg_away || undefined,
      openingOdds: row.opening_odds,
      openingImpliedProb: row.opening_implied_prob,
      openingEv: row.opening_ev,
      bookmakerName: row.bookmaker_name,
      closingOdds: row.closing_odds || undefined,
      closingImpliedProb: row.closing_implied_prob || undefined,
      clv: row.clv || undefined,
      actualOutcome: row.actual_outcome || undefined,
      betWon: row.bet_won !== null ? row.bet_won === 1 : undefined,
      profitFlat: row.profit_flat || undefined,
      profitKelly: row.profit_kelly || undefined,
      kellyStake: row.kelly_stake || undefined,
      status: row.status as ValueBetStatus,
      wasPosted: row.was_posted === 1,
      postedAt: row.posted_at || undefined,
      createdAt: row.created_at,
    };
  }
}
