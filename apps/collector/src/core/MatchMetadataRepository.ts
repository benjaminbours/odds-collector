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
    await this.db
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
      )
      .run();
  }

  async upsertSnapshot(input: UpsertSnapshotInput): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO snapshots (match_key, timing, r2_path, collected_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(match_key, timing) DO UPDATE SET
           r2_path      = excluded.r2_path,
           collected_at = excluded.collected_at`
      )
      .bind(input.matchKey, input.timing, input.r2Path, input.collectedAt)
      .run();
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
