/**
 * Canonical match metadata store, backed by D1 (`matches` + `snapshots`).
 *
 * Replaces the R2 JSON indexes (by_match / by_date / by_team). Writes happen on
 * job completion in OddsCollector.executeJobs; reads are used by the backfill
 * script and by the dashboard via a parallel helper module.
 */

import type {
  MatchRecord,
  SnapshotRecord,
  MatchWithSnapshots,
} from "@odds-collector/shared";
import { TIMING_ORDER } from "@odds-collector/shared";

export interface UpsertMatchInput {
  matchKey: string;
  leagueId: string;
  season: string;
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  kickoffTime: string;
}

export interface UpsertSnapshotInput {
  matchKey: string;
  timing: string;
  r2Path: string;
  collectedAt: string;
}

export class MatchMetadataRepository {
  constructor(private db: D1Database) {}

  async upsertMatch(input: UpsertMatchInput): Promise<void> {
    await this.buildUpsertMatchStatement(input).run();
  }

  buildUpsertMatchStatement(input: UpsertMatchInput): D1PreparedStatement {
    return this.db
      .prepare(
        `INSERT INTO matches (
           match_key, league_id, season, event_id,
           home_team, away_team, match_date, kickoff_time,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(match_key) DO UPDATE SET
           league_id    = excluded.league_id,
           season       = excluded.season,
           event_id     = excluded.event_id,
           home_team    = excluded.home_team,
           away_team    = excluded.away_team,
           match_date   = excluded.match_date,
           kickoff_time = excluded.kickoff_time,
           updated_at   = CURRENT_TIMESTAMP`
      )
      .bind(
        input.matchKey,
        input.leagueId,
        input.season,
        input.eventId,
        input.homeTeam,
        input.awayTeam,
        input.matchDate,
        input.kickoffTime
      );
  }

  async upsertSnapshot(input: UpsertSnapshotInput): Promise<void> {
    await this.buildUpsertSnapshotStatement(input).run();
  }

  buildUpsertSnapshotStatement(input: UpsertSnapshotInput): D1PreparedStatement {
    return this.db
      .prepare(
        `INSERT INTO snapshots (match_key, timing, r2_path, collected_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(match_key, timing) DO UPDATE SET
           r2_path      = excluded.r2_path,
           collected_at = excluded.collected_at`
      )
      .bind(input.matchKey, input.timing, input.r2Path, input.collectedAt);
  }

  async getMatch(matchKey: string): Promise<MatchRecord | null> {
    const row = await this.db
      .prepare(`SELECT * FROM matches WHERE match_key = ?`)
      .bind(matchKey)
      .first();
    return row ? rowToMatch(row) : null;
  }

  async getSnapshots(matchKey: string): Promise<SnapshotRecord[]> {
    const result = await this.db
      .prepare(`SELECT * FROM snapshots WHERE match_key = ? ORDER BY timing`)
      .bind(matchKey)
      .all();
    return result.results.map(rowToSnapshot);
  }

  async getSnapshotPath(
    matchKey: string,
    timing: string,
  ): Promise<string | null> {
    const row = await this.db
      .prepare(
        `SELECT r2_path FROM snapshots WHERE match_key = ? AND timing = ?`,
      )
      .bind(matchKey, timing)
      .first<{ r2_path: string }>();
    return row?.r2_path ?? null;
  }

  /**
   * Return the most recent stored snapshot for `matchKey` whose timing comes
   * before `currentTiming` in `TIMING_ORDER`, or null if none exists.
   *
   * One D1 query instead of the per-timing walk in `findPrecedingAvailableTiming`
   * (which can be up to 12 sequential queries on a closing snapshot in dense
   * presets like WORLD_CUP).
   */
  async getPrecedingSnapshot(
    matchKey: string,
    currentTiming: string,
  ): Promise<{ timing: string; r2Path: string } | null> {
    const idx = TIMING_ORDER.indexOf(currentTiming as (typeof TIMING_ORDER)[number]);
    if (idx <= 0) return null;

    const earlierTimings = TIMING_ORDER.slice(0, idx);
    const placeholders = earlierTimings.map(() => "?").join(", ");

    const result = await this.db
      .prepare(
        `SELECT timing, r2_path FROM snapshots
         WHERE match_key = ? AND timing IN (${placeholders})`,
      )
      .bind(matchKey, ...earlierTimings)
      .all<{ timing: string; r2_path: string }>();

    if (result.results.length === 0) return null;

    let bestIdx = -1;
    let best: { timing: string; r2Path: string } | null = null;
    for (const row of result.results) {
      const i = TIMING_ORDER.indexOf(row.timing as (typeof TIMING_ORDER)[number]);
      if (i > bestIdx) {
        bestIdx = i;
        best = { timing: row.timing, r2Path: row.r2_path };
      }
    }
    return best;
  }

  async getMatchWithSnapshots(
    matchKey: string
  ): Promise<MatchWithSnapshots | null> {
    const match = await this.getMatch(matchKey);
    if (!match) return null;

    const snapshots = await this.getSnapshots(matchKey);
    const snapshotMap: Record<string, string> = {};
    for (const s of snapshots) snapshotMap[s.timing] = s.r2Path;

    return { ...match, snapshots: snapshotMap };
  }

  async listMatchesForLeague(
    leagueId: string,
    season: string
  ): Promise<MatchRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM matches
         WHERE league_id = ? AND season = ?
         ORDER BY kickoff_time DESC`
      )
      .bind(leagueId, season)
      .all();
    return result.results.map(rowToMatch);
  }

  async countMatches(): Promise<number> {
    const row = await this.db
      .prepare(`SELECT COUNT(*) AS c FROM matches`)
      .first<{ c: number }>();
    return row?.c ?? 0;
  }

  async countSnapshots(): Promise<number> {
    const row = await this.db
      .prepare(`SELECT COUNT(*) AS c FROM snapshots`)
      .first<{ c: number }>();
    return row?.c ?? 0;
  }
}

function rowToMatch(row: any): MatchRecord {
  return {
    matchKey: row.match_key,
    leagueId: row.league_id,
    season: row.season,
    eventId: row.event_id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    matchDate: row.match_date,
    kickoffTime: row.kickoff_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSnapshot(row: any): SnapshotRecord {
  return {
    matchKey: row.match_key,
    timing: row.timing,
    r2Path: row.r2_path,
    collectedAt: row.collected_at,
  };
}
