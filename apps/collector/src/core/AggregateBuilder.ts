/**
 * Aggregate builder for dashboard pre-computation
 *
 * Generates pre-computed JSON files for:
 * - Steam moves (per league with caching for past matches)
 * - Homepage data (cross-league aggregation)
 *
 * This offloads expensive computation from the dashboard to the cron job,
 * allowing the dashboard to just read pre-computed files.
 */

import { R2Storage } from "../storage/R2Storage";
import {
  MatchIndexEntry,
  OddsSnapshot,
  BookmakerMarket,
} from "@odds-collector/shared";
import { LEAGUES } from "@odds-collector/shared";

// Steam move detection configuration
const STEAM_THRESHOLD = 5; // Minimum percentage change to be considered a steam move
const TIMING_ORDER = ["opening", "mid_week", "day_before", "closing"];

// Markets to include
const ALLOWED_MARKETS = [
  "h2h",
  "spreads",
  "alternate_spreads",
  "totals",
  "alternate_totals",
  "btts",
  "double_chance",
];

const MARKET_LABELS: Record<string, string> = {
  h2h: "Money Line",
  spreads: "Spread",
  alternate_spreads: "Spread",
  totals: "Totals",
  alternate_totals: "Totals",
  btts: "Both Teams to Score",
  double_chance: "Double Chance",
};

// Interfaces for aggregate data
export interface SteamMove {
  leagueId: string;
  matchKey: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  market: string;
  marketLabel: string;
  outcome: string;
  point?: number;
  fromTiming: string;
  toTiming: string;
  bookmaker: string;
  fromOdds: number;
  toOdds: number;
  movement: number;
  direction: "shortening" | "drifting";
}

export interface MatchSteamMovesCache {
  matchKey: string;
  steamMoves: SteamMove[];
  generatedAt: string;
}

export interface LeagueSteamMovesAggregate {
  leagueId: string;
  season: string;
  steamMoves: SteamMove[];
  generatedAt: string;
  availableMarkets: string[];
}

export interface UpcomingMatch {
  key: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  matchDate: string;
  snapshots: Record<string, string>;
  leagueId: string;
  leagueName: string;
}

export interface HomepageAggregate {
  upcomingMatches: UpcomingMatch[];
  recentSteamMoves: SteamMove[];
  generatedAt: string;
}

export interface AggregateBuilderConfig {
  storage: R2Storage;
}

export class AggregateBuilder {
  private storage: R2Storage;

  constructor(config: AggregateBuilderConfig) {
    this.storage = config.storage;
  }

  /**
   * Build steam moves for a single league with caching for past matches
   *
   * Past matches are cached permanently (steam moves never change after match ends)
   * Upcoming matches are always recomputed (odds may have changed)
   */
  async buildLeagueSteamMoves(leagueId: string, season: string): Promise<void> {
    console.log(`\n📊 Building steam moves for ${leagueId}/${season}...`);

    const now = new Date();
    const matchIndex = await this.storage.getIndex(
      leagueId,
      season,
      "by_match"
    );

    if (!matchIndex) {
      console.log(`  ⚠️  No match index found for ${leagueId}/${season}`);
      return;
    }

    const allSteamMoves: SteamMove[] = [];
    const marketsFound = new Set<string>();
    let cachedCount = 0;
    let computedCount = 0;

    const matchEntries = Object.entries(matchIndex.matches);
    console.log(`  📋 Processing ${matchEntries.length} matches...`);

    for (const [matchKey, match] of matchEntries) {
      const isPast = new Date(match.kickoffTime) < now;

      if (isPast) {
        // Try to use cached steam moves for past matches
        const cached = await this.getSteamMovesCache(
          leagueId,
          season,
          matchKey
        );
        if (cached) {
          allSteamMoves.push(...cached.steamMoves);
          cached.steamMoves.forEach((m) => marketsFound.add(m.marketLabel));
          cachedCount++;
          continue;
        }
      }

      // Compute steam moves for this match
      const moves = await this.computeMatchSteamMoves(
        leagueId,
        season,
        matchKey,
        match
      );
      allSteamMoves.push(...moves);
      moves.forEach((m) => marketsFound.add(m.marketLabel));
      computedCount++;

      // Cache if match is past (final data that won't change)
      if (isPast && moves.length >= 0) {
        await this.saveSteamMovesCache(leagueId, season, matchKey, moves);
      }
    }

    // Sort by kickoff time (chronologically)
    allSteamMoves.sort(
      (a, b) =>
        new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime()
    );

    // Save aggregated steam moves file
    const aggregate: LeagueSteamMovesAggregate = {
      leagueId,
      season,
      steamMoves: allSteamMoves,
      generatedAt: new Date().toISOString(),
      availableMarkets: Array.from(marketsFound).sort(),
    };

    await this.saveLeagueSteamMoves(leagueId, season, aggregate);

    console.log(`  ✅ Steam moves built: ${allSteamMoves.length} moves`);
    console.log(`     (${cachedCount} cached, ${computedCount} computed)`);
  }

  /**
   * Compute steam moves for a single match
   */
  private async computeMatchSteamMoves(
    leagueId: string,
    season: string,
    matchKey: string,
    match: MatchIndexEntry
  ): Promise<SteamMove[]> {
    const steamMoves: SteamMove[] = [];

    // Get available timings for this match
    const availableTimings = TIMING_ORDER.filter((t) => match.snapshots[t]);

    if (availableTimings.length < 2) {
      return steamMoves; // Need at least 2 snapshots to compare
    }

    // Fetch all snapshots for this match
    const snapshots: Record<string, OddsSnapshot> = {};

    for (const timing of availableTimings) {
      const snapshotPath = match.snapshots[timing];
      const snapshot = await this.getSnapshotByPath(snapshotPath);
      if (snapshot) {
        snapshots[timing] = snapshot;
      }
    }

    // Compare consecutive timings
    for (let i = 0; i < availableTimings.length - 1; i++) {
      const fromTiming = availableTimings[i];
      const toTiming = availableTimings[i + 1];
      const fromSnapshot = snapshots[fromTiming];
      const toSnapshot = snapshots[toTiming];

      if (!fromSnapshot || !toSnapshot) continue;

      const fromBookmakers = new Map(
        fromSnapshot.odds.bookmakers.map((b) => [b.key, b])
      );

      for (const toBookmaker of toSnapshot.odds.bookmakers) {
        const fromBookmaker = fromBookmakers.get(toBookmaker.key);
        if (!fromBookmaker) continue;

        for (const toMarket of toBookmaker.markets) {
          if (!ALLOWED_MARKETS.includes(toMarket.key)) continue;

          const fromMarket = fromBookmaker.markets.find(
            (m: BookmakerMarket) => m.key === toMarket.key
          );
          if (!fromMarket) continue;

          for (const toOutcome of toMarket.outcomes) {
            const fromOutcome = fromMarket.outcomes.find(
              (o: { name: string; point?: number }) =>
                o.name === toOutcome.name &&
                (toOutcome.point === undefined || o.point === toOutcome.point)
            );

            if (!fromOutcome) continue;

            const movement =
              ((toOutcome.price - fromOutcome.price) / fromOutcome.price) * 100;

            if (Math.abs(movement) >= STEAM_THRESHOLD) {
              steamMoves.push({
                leagueId,
                matchKey,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                kickoffTime: match.kickoffTime,
                market: toMarket.key,
                marketLabel: MARKET_LABELS[toMarket.key] || toMarket.key,
                outcome: toOutcome.name,
                point: toOutcome.point,
                fromTiming,
                toTiming,
                bookmaker: toBookmaker.title,
                fromOdds: fromOutcome.price,
                toOdds: toOutcome.price,
                movement,
                direction: movement < 0 ? "shortening" : "drifting",
              });
            }
          }
        }
      }
    }

    return steamMoves;
  }

  /**
   * Build homepage aggregate data (cross-league)
   */
  async buildHomepageData(season: string): Promise<void> {
    console.log(`\n🏠 Building homepage data...`);

    const now = new Date();
    const futureCutoff = new Date(now);
    futureCutoff.setDate(futureCutoff.getDate() + 7); // Next 7 days

    const upcomingMatches: UpcomingMatch[] = [];
    const allSteamMoves: SteamMove[] = [];

    for (const league of LEAGUES) {
      try {
        const matchIndex = await this.storage.getIndex(
          league.id,
          season,
          "by_match"
        );
        if (!matchIndex) continue;

        // Get upcoming matches
        for (const [matchKey, match] of Object.entries(matchIndex.matches)) {
          const kickoff = new Date(match.kickoffTime);
          if (kickoff >= now && kickoff <= futureCutoff) {
            upcomingMatches.push({
              key: matchKey,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              kickoffTime: match.kickoffTime,
              matchDate: match.matchDate,
              snapshots: match.snapshots,
              leagueId: league.id,
              leagueName: league.name,
            });
          }
        }

        // Read pre-computed steam moves for this league
        const steamMovesAggregate = await this.getLeagueSteamMoves(
          league.id,
          season
        );
        if (steamMovesAggregate) {
          // Filter to only upcoming matches' steam moves
          const upcomingSteamMoves = steamMovesAggregate.steamMoves.filter(
            (m) => {
              const kickoff = new Date(m.kickoffTime);
              return kickoff >= now && kickoff <= futureCutoff;
            }
          );
          allSteamMoves.push(...upcomingSteamMoves);
        }
      } catch (error) {
        console.error(`  ⚠️  Error processing ${league.id}:`, error);
      }
    }

    // Sort upcoming matches by kickoff time
    upcomingMatches.sort(
      (a, b) =>
        new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime()
    );

    // Sort steam moves by magnitude and take top 5
    allSteamMoves.sort((a, b) => Math.abs(b.movement) - Math.abs(a.movement));

    const homepage: HomepageAggregate = {
      upcomingMatches: upcomingMatches.slice(0, 6),
      recentSteamMoves: allSteamMoves.slice(0, 5),
      generatedAt: new Date().toISOString(),
    };

    await this.saveHomepageData(homepage);

    console.log(`  ✅ Homepage data built:`);
    console.log(`     ${homepage.upcomingMatches.length} upcoming matches`);
    console.log(`     ${homepage.recentSteamMoves.length} steam moves`);
  }

  // ==========================================
  // Storage helpers
  // ==========================================

  /**
   * Get cached steam moves for a specific match
   */
  private async getSteamMovesCache(
    leagueId: string,
    season: string,
    matchKey: string
  ): Promise<MatchSteamMovesCache | null> {
    const key = this.getSteamMovesCacheKey(leagueId, season, matchKey);

    try {
      const response = await this.storage.getClient().send(
        new (await import("@aws-sdk/client-s3")).GetObjectCommand({
          Bucket: this.storage.getBucketName(),
          Key: key,
        })
      );

      if (!response.Body) return null;

      const body = await response.Body.transformToString("utf-8");
      return JSON.parse(body);
    } catch (error: any) {
      if (
        error.name === "NoSuchKey" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Save cached steam moves for a specific match
   */
  private async saveSteamMovesCache(
    leagueId: string,
    season: string,
    matchKey: string,
    steamMoves: SteamMove[]
  ): Promise<void> {
    const key = this.getSteamMovesCacheKey(leagueId, season, matchKey);

    const cache: MatchSteamMovesCache = {
      matchKey,
      steamMoves,
      generatedAt: new Date().toISOString(),
    };

    await this.storage.getClient().send(
      new (await import("@aws-sdk/client-s3")).PutObjectCommand({
        Bucket: this.storage.getBucketName(),
        Key: key,
        Body: JSON.stringify(cache, null, 2),
        ContentType: "application/json",
      })
    );
  }

  private getSteamMovesCacheKey(
    leagueId: string,
    season: string,
    matchKey: string
  ): string {
    const basePath = this.storage.getBasePath();
    const parts = basePath
      ? [
          basePath,
          "leagues",
          leagueId,
          season,
          "steam_moves",
          `${matchKey}.json`,
        ]
      : ["leagues", leagueId, season, "steam_moves", `${matchKey}.json`];
    return parts.join("/");
  }

  /**
   * Get snapshot by its full path
   */
  private async getSnapshotByPath(path: string): Promise<OddsSnapshot | null> {
    try {
      const response = await this.storage.getClient().send(
        new (await import("@aws-sdk/client-s3")).GetObjectCommand({
          Bucket: this.storage.getBucketName(),
          Key: path,
        })
      );

      if (!response.Body) return null;

      const body = await response.Body.transformToString("utf-8");
      return JSON.parse(body);
    } catch (error: any) {
      if (
        error.name === "NoSuchKey" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Save aggregated steam moves for a league
   */
  private async saveLeagueSteamMoves(
    leagueId: string,
    season: string,
    aggregate: LeagueSteamMovesAggregate
  ): Promise<void> {
    const basePath = this.storage.getBasePath();
    const key = basePath
      ? `${basePath}/leagues/${leagueId}/${season}/steam_moves.json`
      : `leagues/${leagueId}/${season}/steam_moves.json`;

    await this.storage.getClient().send(
      new (await import("@aws-sdk/client-s3")).PutObjectCommand({
        Bucket: this.storage.getBucketName(),
        Key: key,
        Body: JSON.stringify(aggregate, null, 2),
        ContentType: "application/json",
      })
    );
  }

  /**
   * Get aggregated steam moves for a league
   */
  private async getLeagueSteamMoves(
    leagueId: string,
    season: string
  ): Promise<LeagueSteamMovesAggregate | null> {
    const basePath = this.storage.getBasePath();
    const key = basePath
      ? `${basePath}/leagues/${leagueId}/${season}/steam_moves.json`
      : `leagues/${leagueId}/${season}/steam_moves.json`;

    try {
      const response = await this.storage.getClient().send(
        new (await import("@aws-sdk/client-s3")).GetObjectCommand({
          Bucket: this.storage.getBucketName(),
          Key: key,
        })
      );

      if (!response.Body) return null;

      const body = await response.Body.transformToString("utf-8");
      return JSON.parse(body);
    } catch (error: any) {
      if (
        error.name === "NoSuchKey" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Save homepage aggregate data
   */
  private async saveHomepageData(homepage: HomepageAggregate): Promise<void> {
    const basePath = this.storage.getBasePath();
    const key = basePath
      ? `${basePath}/aggregates/homepage.json`
      : `aggregates/homepage.json`;

    await this.storage.getClient().send(
      new (await import("@aws-sdk/client-s3")).PutObjectCommand({
        Bucket: this.storage.getBucketName(),
        Key: key,
        Body: JSON.stringify(homepage, null, 2),
        ContentType: "application/json",
      })
    );
  }
}
