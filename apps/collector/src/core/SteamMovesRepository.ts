/**
 * Canonical steam-moves store, backed by D1 (`steam_moves` + `steam_moves_processed`).
 *
 * Replaces the six R2 JSON shapes produced by the offline cache script
 * (steam_moves/, steam_moves_upcoming.json, steam_moves_recent.json,
 * steam_moves_dates.json, steam_moves_by_date/, legacy steam_moves.json).
 *
 * Today the only writer is the offline `populateSteamMoves` backfill script;
 * when detection eventually moves into the worker, the same upserts fire at
 * job completion. Reads live on the dashboard side in `lib/steam-moves-db.ts`.
 */

import type { SteamMove } from "@odds-collector/shared";

/**
 * Shape the repository accepts for an upsert. Mirrors the public `SteamMove`
 * domain type but drops the joined `homeTeam`/`awayTeam` fields (those come
 * from `matches` via JOIN on read), since the D1 row doesn't carry them.
 */
export type UpsertSteamMoveInput = Omit<SteamMove, "homeTeam" | "awayTeam">;

/**
 * SQLite treats NULL as distinct in composite PKs, so the nullable `point`
 * column cannot participate in the PK directly. `point_key` is its TEXT
 * companion: empty string for h2h/btts/double_chance, stringified number
 * otherwise. Keep this derivation in one place.
 */
export function toPointKey(point: number | undefined | null): string {
  return point === undefined || point === null ? "" : String(point);
}

export class SteamMovesRepository {
  constructor(private db: D1Database) {}

  async upsertMove(input: UpsertSteamMoveInput): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO steam_moves (
           match_key, market, outcome, point_key, bookmaker, from_timing, to_timing,
           league_id, kickoff_time,
           market_label, point, from_odds, to_odds, movement, direction,
           detected_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(match_key, market, outcome, point_key, bookmaker, from_timing, to_timing)
         DO UPDATE SET
           league_id    = excluded.league_id,
           kickoff_time = excluded.kickoff_time,
           market_label = excluded.market_label,
           point        = excluded.point,
           from_odds    = excluded.from_odds,
           to_odds      = excluded.to_odds,
           movement     = excluded.movement,
           direction    = excluded.direction,
           detected_at  = CURRENT_TIMESTAMP`
      )
      .bind(
        input.matchKey,
        input.market,
        input.outcome,
        toPointKey(input.point),
        input.bookmaker,
        input.fromTiming,
        input.toTiming,
        input.leagueId,
        input.kickoffTime,
        input.marketLabel,
        input.point ?? null,
        input.fromOdds,
        input.toOdds,
        input.movement,
        input.direction
      )
      .run();
  }

  async markProcessed(matchKey: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO steam_moves_processed (match_key, processed_at)
         VALUES (?, CURRENT_TIMESTAMP)
         ON CONFLICT(match_key) DO UPDATE SET
           processed_at = CURRENT_TIMESTAMP`
      )
      .bind(matchKey)
      .run();
  }

  async isProcessed(matchKey: string): Promise<boolean> {
    const row = await this.db
      .prepare(`SELECT 1 AS x FROM steam_moves_processed WHERE match_key = ?`)
      .bind(matchKey)
      .first();
    return row !== null;
  }

  async countMoves(): Promise<number> {
    const row = await this.db
      .prepare(`SELECT COUNT(*) AS c FROM steam_moves`)
      .first<{ c: number }>();
    return row?.c ?? 0;
  }

  async countProcessed(): Promise<number> {
    const row = await this.db
      .prepare(`SELECT COUNT(*) AS c FROM steam_moves_processed`)
      .first<{ c: number }>();
    return row?.c ?? 0;
  }
}
