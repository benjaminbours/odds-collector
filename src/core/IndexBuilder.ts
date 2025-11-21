/**
 * Index builder for fast odds lookup
 *
 * Generates index files for O(1) lookups by match, date, or team
 */

import { IStorage } from "../storage/IStorage";
import { MatchIndex, MatchIndexEntry } from "../config/types";
import { generateMatchKey, formatTeamNameForPath } from "../utils/pathUtils";

export interface IndexBuilderConfig {
  /** Storage backend */
  storage: IStorage;
}

export class IndexBuilder {
  private storage: IStorage;

  constructor(config: IndexBuilderConfig) {
    this.storage = config.storage;
  }

  /**
   * Build or update the match index for a league/season
   *
   * @param leagueId League identifier
   * @param season Season (e.g., '2024-2025')
   * @param snapshots Array of snapshot paths that were collected
   */
  async updateMatchIndex(
    leagueId: string,
    season: string,
    snapshots: Array<{
      homeTeam: string;
      awayTeam: string;
      matchDate: string;
      eventId: string;
      timing: string;
      path: string;
      kickoffTime: string;
    }>
  ): Promise<void> {
    // Load existing index or create new
    let index = await this.storage.getIndex(leagueId, season, "by_match");

    if (!index) {
      index = {
        version: "1.0",
        leagueId,
        season,
        lastUpdated: new Date().toISOString(),
        matches: {},
      };
    }

    // Update index with new snapshots
    for (const snapshot of snapshots) {
      const matchKey = generateMatchKey(
        snapshot.homeTeam,
        snapshot.awayTeam,
        snapshot.matchDate
      );

      // Get or create match entry
      if (!index.matches[matchKey]) {
        index.matches[matchKey] = {
          homeTeam: snapshot.homeTeam,
          awayTeam: snapshot.awayTeam,
          matchDate: snapshot.matchDate,
          eventId: snapshot.eventId,
          snapshots: {},
          kickoffTime: snapshot.kickoffTime,
        };
      }

      const entry = index.matches[matchKey];

      // Add snapshot path for this timing
      entry.snapshots[snapshot.timing] = snapshot.path;
    }

    // Update timestamp
    index.lastUpdated = new Date().toISOString();

    // Save updated index
    await this.storage.saveIndex(leagueId, season, "by_match", index);

    console.log(
      `📇 Updated match index: ${leagueId}/${season} (${Object.keys(index.matches).length} matches)`
    );
  }

  /**
   * Build date index (date -> list of matches)
   *
   * This allows fast lookup of all matches on a specific date
   */
  async buildDateIndex(leagueId: string, season: string): Promise<void> {
    // Load match index
    const matchIndex = await this.storage.getIndex(
      leagueId,
      season,
      "by_match"
    );

    if (!matchIndex) {
      console.warn(`⚠️  No match index found for ${leagueId}/${season}`);
      return;
    }

    // Group matches by date
    const dateMap: Record<string, string[]> = {};

    for (const [matchKey, entry] of Object.entries(matchIndex.matches)) {
      const date = entry.matchDate;

      if (!dateMap[date]) {
        dateMap[date] = [];
      }

      dateMap[date].push(matchKey);
    }

    // Create date index
    const dateIndex = {
      version: "1.0",
      leagueId,
      season,
      lastUpdated: new Date().toISOString(),
      matches: {},
      dates: Object.entries(dateMap).reduce(
        (acc, [date, matches]) => {
          acc[date] = {
            matchCount: matches.length,
            matches,
            snapshotTimingsAvailable: this.getAvailableTimings(
              matchIndex,
              matches
            ),
          };
          return acc;
        },
        {} as Record<string, any>
      ),
    };

    // Save date index
    await this.storage.saveIndex(leagueId, season, "by_date", dateIndex as any);

    console.log(
      `📅 Built date index: ${leagueId}/${season} (${Object.keys(dateMap).length} dates)`
    );
  }

  /**
   * Build team index (team -> list of matches)
   *
   * This allows fast lookup of all matches for a specific team
   */
  async buildTeamIndex(leagueId: string, season: string): Promise<void> {
    // Load match index
    const matchIndex = await this.storage.getIndex(
      leagueId,
      season,
      "by_match"
    );

    if (!matchIndex) {
      console.warn(`⚠️  No match index found for ${leagueId}/${season}`);
      return;
    }

    // Group matches by team
    const teamMap: Record<string, string[]> = {};

    for (const [matchKey, entry] of Object.entries(matchIndex.matches)) {
      // Add to home team's matches
      const homeTeam = formatTeamNameForPath(entry.homeTeam);
      if (!teamMap[homeTeam]) {
        teamMap[homeTeam] = [];
      }
      teamMap[homeTeam].push(matchKey);

      // Add to away team's matches
      const awayTeam = formatTeamNameForPath(entry.awayTeam);
      if (!teamMap[awayTeam]) {
        teamMap[awayTeam] = [];
      }
      teamMap[awayTeam].push(matchKey);
    }

    // Create team index
    const teamIndex = {
      version: "1.0",
      leagueId,
      season,
      lastUpdated: new Date().toISOString(),
      matches: {},
      teams: Object.entries(teamMap).reduce(
        (acc, [team, matches]) => {
          acc[team] = {
            matchCount: matches.length,
            matches,
          };
          return acc;
        },
        {} as Record<string, any>
      ),
    };

    // Save team index
    await this.storage.saveIndex(leagueId, season, "by_team", teamIndex as any);

    console.log(
      `🏟️  Built team index: ${leagueId}/${season} (${Object.keys(teamMap).length} teams)`
    );
  }

  /**
   * Build all indexes for a league/season
   */
  async buildAllIndexes(leagueId: string, season: string): Promise<void> {
    console.log(`\n📚 Building indexes for ${leagueId}/${season}...`);

    // Date and team indexes are derived from match index
    await this.buildDateIndex(leagueId, season);
    await this.buildTeamIndex(leagueId, season);

    console.log(`✅ All indexes built for ${leagueId}/${season}`);
  }

  /**
   * Get available timing offsets across a set of matches
   */
  private getAvailableTimings(
    matchIndex: MatchIndex,
    matchKeys: string[]
  ): string[] {
    const timingsSet = new Set<string>();

    for (const matchKey of matchKeys) {
      const entry = matchIndex.matches[matchKey];
      if (entry) {
        Object.keys(entry.snapshots).forEach((timing) =>
          timingsSet.add(timing)
        );
      }
    }

    return Array.from(timingsSet).sort();
  }

  /**
   * Lookup match odds by team names and date
   *
   * @param leagueId League identifier
   * @param season Season
   * @param homeTeam Home team name
   * @param awayTeam Away team name
   * @param matchDate Match date (YYYY-MM-DD)
   * @returns Match index entry or null if not found
   */
  async lookupMatch(
    leagueId: string,
    season: string,
    homeTeam: string,
    awayTeam: string,
    matchDate: string
  ): Promise<MatchIndexEntry | null> {
    const index = await this.storage.getIndex(leagueId, season, "by_match");

    if (!index) {
      return null;
    }

    const matchKey = generateMatchKey(homeTeam, awayTeam, matchDate);
    return index.matches[matchKey] || null;
  }

  /**
   * Get all matches for a specific date
   *
   * @param leagueId League identifier
   * @param season Season
   * @param date Match date (YYYY-MM-DD)
   * @returns Array of match keys
   */
  async getMatchesForDate(
    leagueId: string,
    season: string,
    date: string
  ): Promise<string[]> {
    const index = await this.storage.getIndex(leagueId, season, "by_date");

    if (!index || !index.matches) {
      return [];
    }

    const dateIndex = index as any;
    return dateIndex.dates[date]?.matches || [];
  }

  /**
   * Get all matches for a specific team
   *
   * @param leagueId League identifier
   * @param season Season
   * @param teamName Team name
   * @returns Array of match keys
   */
  async getMatchesForTeam(
    leagueId: string,
    season: string,
    teamName: string
  ): Promise<string[]> {
    const index = await this.storage.getIndex(leagueId, season, "by_team");

    if (!index || !index.matches) {
      return [];
    }

    const teamIndex = index as any;
    const teamKey = formatTeamNameForPath(teamName);
    return teamIndex.teams[teamKey]?.matches || [];
  }
}
