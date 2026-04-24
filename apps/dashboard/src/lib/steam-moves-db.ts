/**
 * Dashboard-side D1 query helpers for the `steam_moves` table.
 *
 * Replaces the six per-league R2 JSON files the offline script used to
 * produce (steam_moves_upcoming.json, steam_moves_recent.json,
 * steam_moves_dates.json, steam_moves_by_date/, legacy steam_moves.json,
 * plus the per-match steam_moves/{matchKey}.json caches). One D1 query
 * per view replaces an N-leagues × 2 R2 fan-out.
 *
 * Rows are joined with `matches` for homeTeam/awayTeam — the only fields
 * on the public `SteamMove` shape that aren't denormalized onto the
 * steam_moves row itself. `point_key` is dropped on read and `point` is
 * converted back to `undefined` for h2h/btts/double_chance.
 */

import type { SteamMove } from "@odds-collector/shared";

interface Row {
  match_key: string;
  league_id: string;
  kickoff_time: string;
  home_team: string;
  away_team: string;
  market: string;
  market_label: string;
  outcome: string;
  point: number | null;
  from_timing: string;
  to_timing: string;
  bookmaker: string;
  from_odds: number;
  to_odds: number;
  movement: number;
  direction: string;
}

function rowToMove(row: Row): SteamMove {
  return {
    leagueId: row.league_id,
    matchKey: row.match_key,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    kickoffTime: row.kickoff_time,
    market: row.market,
    marketLabel: row.market_label,
    outcome: row.outcome,
    point: row.point ?? undefined,
    fromTiming: row.from_timing,
    toTiming: row.to_timing,
    bookmaker: row.bookmaker,
    fromOdds: row.from_odds,
    toOdds: row.to_odds,
    movement: row.movement,
    direction: row.direction as "shortening" | "drifting",
  };
}

const SELECT_BASE = `SELECT sm.match_key, sm.league_id, sm.kickoff_time,
         m.home_team, m.away_team,
         sm.market, sm.market_label, sm.outcome, sm.point,
         sm.from_timing, sm.to_timing, sm.bookmaker,
         sm.from_odds, sm.to_odds, sm.movement, sm.direction
  FROM steam_moves sm
  JOIN matches m ON m.match_key = sm.match_key`;

/**
 * All steam moves for matches kicking off in the next `hoursAhead` hours,
 * sorted by kickoff. Used by `/steam-moves` as the default view; the client
 * applies the league/market/direction/min-movement filters.
 */
export async function getUpcomingSteamMoves(
  db: D1Database,
  options: { hoursAhead?: number } = {}
): Promise<SteamMove[]> {
  const hoursAhead = options.hoursAhead ?? 24 * 7;
  const result = await db
    .prepare(
      `${SELECT_BASE}
       WHERE datetime(sm.kickoff_time) >= datetime('now')
         AND datetime(sm.kickoff_time) < datetime('now', '+' || ? || ' hours')
       ORDER BY sm.kickoff_time ASC, ABS(sm.movement) DESC`
    )
    .bind(hoursAhead)
    .all<Row>();
  return result.results.map(rowToMove);
}

/**
 * Top-N upcoming steam moves by absolute movement. Used by the homepage's
 * "Recent Steam Moves" block — which now shows upcoming 7d moves, not past.
 */
export async function getTopUpcomingSteamMoves(
  db: D1Database,
  options: { hoursAhead?: number; limit?: number } = {}
): Promise<SteamMove[]> {
  const hoursAhead = options.hoursAhead ?? 24 * 7;
  const limit = options.limit ?? 5;
  const result = await db
    .prepare(
      `${SELECT_BASE}
       WHERE datetime(sm.kickoff_time) >= datetime('now')
         AND datetime(sm.kickoff_time) < datetime('now', '+' || ? || ' hours')
       ORDER BY ABS(sm.movement) DESC
       LIMIT ?`
    )
    .bind(hoursAhead, limit)
    .all<Row>();
  return result.results.map(rowToMove);
}

/**
 * Steam moves for matches that kicked off in the last `daysBack` days.
 * Used by the API route on `?type=recent`.
 */
export async function getRecentSteamMoves(
  db: D1Database,
  options: { daysBack?: number } = {}
): Promise<SteamMove[]> {
  const daysBack = options.daysBack ?? 14;
  const result = await db
    .prepare(
      `${SELECT_BASE}
       WHERE datetime(sm.kickoff_time) >= datetime('now', '-' || ? || ' days')
         AND datetime(sm.kickoff_time) < datetime('now')
       ORDER BY sm.kickoff_time DESC, ABS(sm.movement) DESC`
    )
    .bind(daysBack)
    .all<Row>();
  return result.results.map(rowToMove);
}

/**
 * Steam moves for matches kicking off on a specific calendar date.
 * Used by the API route on `?date=YYYY-MM-DD`.
 */
export async function getSteamMovesForDate(
  db: D1Database,
  date: string
): Promise<SteamMove[]> {
  const result = await db
    .prepare(
      `${SELECT_BASE}
       WHERE DATE(sm.kickoff_time) = ?
       ORDER BY sm.kickoff_time ASC, ABS(sm.movement) DESC`
    )
    .bind(date)
    .all<Row>();
  return result.results.map(rowToMove);
}

/**
 * Distinct calendar dates that have at least one detected steam move,
 * newest first. Replaces the per-league `steam_moves_dates.json` index
 * files the client used to check for "load older matches" availability.
 */
export async function getAvailableDates(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT DATE(kickoff_time) AS d
       FROM steam_moves
       ORDER BY d DESC`
    )
    .all<{ d: string }>();
  return result.results.map((r) => r.d);
}

/**
 * Distinct market labels across all detected moves, alphabetical. Drives
 * the Market filter dropdown on the steam-moves page.
 */
export async function getAvailableMarkets(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT market_label AS m
       FROM steam_moves
       ORDER BY m ASC`
    )
    .all<{ m: string }>();
  return result.results.map((r) => r.m);
}
