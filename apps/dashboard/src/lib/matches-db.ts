/**
 * Dashboard-side D1 query helpers for the `matches` + `snapshots` tables.
 *
 * Thin read layer — pages and API routes should talk through this rather than
 * bucket reads on `by_match.json` / `by_date.json`. R2 is only hit for snapshot
 * payloads (the large JSON blobs), not for metadata lookups.
 */

import type { MatchWithSnapshots } from "@odds-collector/shared";

export interface MatchWithKey extends MatchWithSnapshots {
  key: string; // alias of matchKey; keeps component callsites terse
}

export interface UpcomingMatchRow extends MatchWithKey {
  leagueName: string;
}

interface MatchRow {
  match_key: string;
  league_id: string;
  season: string;
  event_id: string;
  home_team: string;
  away_team: string;
  match_date: string;
  kickoff_time: string;
}

interface SnapshotRow {
  match_key: string;
  timing: string;
  r2_path: string;
}

function hydrate(matches: MatchRow[], snapshots: SnapshotRow[]): MatchWithKey[] {
  const byKey = new Map<string, MatchWithKey>();
  for (const m of matches) {
    byKey.set(m.match_key, {
      matchKey: m.match_key,
      key: m.match_key,
      leagueId: m.league_id,
      season: m.season,
      eventId: m.event_id,
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      matchDate: m.match_date,
      kickoffTime: m.kickoff_time,
      snapshots: {},
    });
  }
  for (const s of snapshots) {
    const match = byKey.get(s.match_key);
    if (match) match.snapshots[s.timing] = s.r2_path;
  }
  return Array.from(byKey.values());
}

/**
 * All matches for one league/season, with their snapshot paths attached.
 * Caller derives date groupings client-side — cheap for ~400 rows.
 */
export async function getLeagueMatches(
  db: D1Database,
  leagueId: string,
  season: string
): Promise<MatchWithKey[]> {
  const [matchesResult, snapshotsResult] = await Promise.all([
    db
      .prepare(
        `SELECT * FROM matches
         WHERE league_id = ? AND season = ?
         ORDER BY kickoff_time ASC`
      )
      .bind(leagueId, season)
      .all<MatchRow>(),
    db
      .prepare(
        `SELECT s.* FROM snapshots s
         INNER JOIN matches m ON m.match_key = s.match_key
         WHERE m.league_id = ? AND m.season = ?`
      )
      .bind(leagueId, season)
      .all<SnapshotRow>(),
  ]);

  return hydrate(matchesResult.results, snapshotsResult.results);
}

/**
 * Single match lookup + its snapshot paths.
 */
export async function getMatchByKey(
  db: D1Database,
  leagueId: string,
  season: string,
  matchKey: string
): Promise<MatchWithKey | null> {
  const [matchResult, snapshotsResult] = await Promise.all([
    db
      .prepare(
        `SELECT * FROM matches
         WHERE league_id = ? AND season = ? AND match_key = ?
         LIMIT 1`
      )
      .bind(leagueId, season, matchKey)
      .first<MatchRow>(),
    db
      .prepare(`SELECT * FROM snapshots WHERE match_key = ?`)
      .bind(matchKey)
      .all<SnapshotRow>(),
  ]);

  if (!matchResult) return null;
  const [match] = hydrate([matchResult], snapshotsResult.results);
  return match ?? null;
}

/**
 * Upcoming matches across all leagues, sorted by kickoff. Used by homepage.
 *
 * `leagueName` is resolved by the caller (usually from the static LEAGUES list)
 * so this module stays free of config imports.
 */
export async function getUpcomingMatchesAcrossLeagues(
  db: D1Database,
  options: { limit?: number; hoursAhead?: number } = {}
): Promise<MatchWithKey[]> {
  const limit = options.limit ?? 6;
  const hoursAhead = options.hoursAhead ?? 24 * 7;

  const [matchesResult, snapshotsResult] = await Promise.all([
    db
      .prepare(
        `SELECT * FROM matches
         WHERE datetime(kickoff_time) >= datetime('now')
           AND datetime(kickoff_time) <= datetime('now', '+' || ? || ' hours')
         ORDER BY kickoff_time ASC
         LIMIT ?`
      )
      .bind(hoursAhead, limit)
      .all<MatchRow>(),
    // Fetch snapshots for the upcoming window once — cheaper than N lookups.
    db
      .prepare(
        `SELECT s.* FROM snapshots s
         INNER JOIN matches m ON m.match_key = s.match_key
         WHERE datetime(m.kickoff_time) >= datetime('now')
           AND datetime(m.kickoff_time) <= datetime('now', '+' || ? || ' hours')`
      )
      .bind(hoursAhead)
      .all<SnapshotRow>(),
  ]);

  return hydrate(matchesResult.results, snapshotsResult.results);
}

/**
 * Derive the shape that `DateGroupedMatches` expects from a flat match list.
 * Kept here so pages/components don't duplicate the grouping logic.
 */
export interface DateGroup {
  matchCount: number;
  matches: string[]; // match keys
  snapshotTimingsAvailable: string[];
}

export function groupMatchesByDate(
  matches: MatchWithKey[]
): Record<string, DateGroup> {
  const grouped: Record<string, DateGroup> = {};
  for (const m of matches) {
    const group =
      grouped[m.matchDate] ??
      (grouped[m.matchDate] = {
        matchCount: 0,
        matches: [],
        snapshotTimingsAvailable: [],
      });
    group.matchCount += 1;
    group.matches.push(m.key);
    for (const timing of Object.keys(m.snapshots)) {
      if (!group.snapshotTimingsAvailable.includes(timing)) {
        group.snapshotTimingsAvailable.push(timing);
      }
    }
  }
  return grouped;
}
