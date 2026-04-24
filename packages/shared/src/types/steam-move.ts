/**
 * Steam move types.
 *
 * A steam move is a bookmaker line movement between two consecutive collection
 * timings that exceeds the detection threshold (|movement| ≥ 5%). Backed by the
 * D1 `steam_moves` table from migration 0007.
 */

/**
 * Canonical steam move shape shared by the collector (detection + upsert) and
 * the dashboard (query results). The D1 row carries the same fields plus the
 * `point_key` PK companion; `homeTeam`/`awayTeam` are joined in from `matches`.
 */
export interface SteamMove {
  leagueId: string;
  matchKey: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  market: string;
  marketLabel: string;
  outcome: string;
  /** Present for spreads/totals; undefined for h2h/btts/double_chance. */
  point?: number;
  fromTiming: string;
  toTiming: string;
  bookmaker: string;
  fromOdds: number;
  toOdds: number;
  /** Signed %, e.g. -12.5 for a shortening price. */
  movement: number;
  direction: "shortening" | "drifting";
}
