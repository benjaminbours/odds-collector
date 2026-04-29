/**
 * Generate Steam Moves Cache Script
 *
 * This script generates split steam moves files for optimal dashboard loading:
 *
 * Output structure per league:
 *   leagues/{leagueId}/{season}/
 *   ├── steam_moves_upcoming.json   # Next 7 days (loaded on page load)
 *   ├── steam_moves_recent.json     # Last 14 days (loaded on "show recent")
 *   ├── steam_moves_dates.json      # Index of available dates
 *   └── steam_moves_by_date/
 *       ├── 2025-12-19.json         # Per-date files for historical browsing
 *       ├── 2025-12-18.json
 *       └── ...
 *
 * Usage:
 *   # Dry run - show what would be generated
 *   npx tsx scripts/generate-steam-moves-cache.ts --dry-run
 *
 *   # Generate for all leagues
 *   npx tsx scripts/generate-steam-moves-cache.ts
 *
 *   # Generate for a specific league
 *   npx tsx scripts/generate-steam-moves-cache.ts --league=england_premier_league
 *
 *   # Force regenerate (ignore existing match cache)
 *   npx tsx scripts/generate-steam-moves-cache.ts --force
 */

import "dotenv/config";
import { R2Storage } from "../src/storage/R2Storage";
import {
  MatchIndex,
  MatchIndexEntry,
  OddsSnapshot,
  BookmakerMarket,
} from "@odds-collector/shared";
import { LEAGUES, CURRENT_SEASON, TIMING_ORDER } from "@odds-collector/shared";

// Configuration from environment variables
const CONFIG = {
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID!,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY!,
  BUCKET_NAME: "soccer-predictor",
  BASE_PATH: "odds_data_v2",
};

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const LEAGUE_ARG = args.find((a) => a.startsWith("--league="));
const SPECIFIC_LEAGUE = LEAGUE_ARG?.split("=")[1];

// Steam move detection configuration. TIMING_ORDER is imported from
// @odds-collector/shared so the curve stays in sync with the live detector.
const STEAM_THRESHOLD = 5;

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

// Steam move + aggregate interfaces (kept local to this script after the
// collector-side AggregateBuilder was retired in the R2→D1 migration).
interface SteamMove {
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

interface MatchSteamMovesCache {
  matchKey: string;
  steamMoves: SteamMove[];
  generatedAt: string;
}

interface LeagueSteamMovesAggregate {
  leagueId: string;
  season: string;
  steamMoves: SteamMove[];
  generatedAt: string;
  availableMarkets: string[];
}

// New split file structures
interface SteamMovesUpcoming {
  leagueId: string;
  season: string;
  steamMoves: SteamMove[];
  generatedAt: string;
  availableMarkets: string[];
  // Date range info for client
  fromDate: string;
  toDate: string;
}

interface SteamMovesRecent {
  leagueId: string;
  season: string;
  steamMoves: SteamMove[];
  generatedAt: string;
  availableMarkets: string[];
  fromDate: string;
  toDate: string;
}

interface SteamMovesByDate {
  leagueId: string;
  season: string;
  date: string;
  steamMoves: SteamMove[];
  generatedAt: string;
}

interface SteamMovesDatesIndex {
  leagueId: string;
  season: string;
  availableDates: string[]; // Sorted descending (newest first)
  availableMarkets: string[];
  generatedAt: string;
}

// Configuration
const UPCOMING_DAYS = 7;
const RECENT_DAYS = 14;

/**
 * Get snapshot by path from R2
 */
async function getSnapshotByPath(
  storage: R2Storage,
  path: string
): Promise<OddsSnapshot | null> {
  try {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const response = await storage.getClient().send(
      new GetObjectCommand({
        Bucket: storage.getBucketName(),
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
 * Get cached steam moves for a specific match
 */
async function getSteamMovesCache(
  storage: R2Storage,
  leagueId: string,
  season: string,
  matchKey: string
): Promise<MatchSteamMovesCache | null> {
  const basePath = storage.getBasePath();
  const key = basePath
    ? `${basePath}/leagues/${leagueId}/${season}/steam_moves/${matchKey}.json`
    : `leagues/${leagueId}/${season}/steam_moves/${matchKey}.json`;

  try {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const response = await storage.getClient().send(
      new GetObjectCommand({
        Bucket: storage.getBucketName(),
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
async function saveSteamMovesCache(
  storage: R2Storage,
  leagueId: string,
  season: string,
  matchKey: string,
  steamMoves: SteamMove[]
): Promise<void> {
  const basePath = storage.getBasePath();
  const key = basePath
    ? `${basePath}/leagues/${leagueId}/${season}/steam_moves/${matchKey}.json`
    : `leagues/${leagueId}/${season}/steam_moves/${matchKey}.json`;

  const cache: MatchSteamMovesCache = {
    matchKey,
    steamMoves,
    generatedAt: new Date().toISOString(),
  };

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await storage.getClient().send(
    new PutObjectCommand({
      Bucket: storage.getBucketName(),
      Key: key,
      Body: JSON.stringify(cache, null, 2),
      ContentType: "application/json",
    })
  );
}

/**
 * Save aggregated steam moves for a league (legacy, kept for compatibility)
 */
async function saveLeagueSteamMoves(
  storage: R2Storage,
  leagueId: string,
  season: string,
  aggregate: LeagueSteamMovesAggregate
): Promise<void> {
  const basePath = storage.getBasePath();
  const key = basePath
    ? `${basePath}/leagues/${leagueId}/${season}/steam_moves.json`
    : `leagues/${leagueId}/${season}/steam_moves.json`;

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await storage.getClient().send(
    new PutObjectCommand({
      Bucket: storage.getBucketName(),
      Key: key,
      Body: JSON.stringify(aggregate, null, 2),
      ContentType: "application/json",
    })
  );
}

/**
 * Save upcoming steam moves file
 */
async function saveUpcomingSteamMoves(
  storage: R2Storage,
  leagueId: string,
  season: string,
  data: SteamMovesUpcoming
): Promise<void> {
  const basePath = storage.getBasePath();
  const key = basePath
    ? `${basePath}/leagues/${leagueId}/${season}/steam_moves_upcoming.json`
    : `leagues/${leagueId}/${season}/steam_moves_upcoming.json`;

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await storage.getClient().send(
    new PutObjectCommand({
      Bucket: storage.getBucketName(),
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    })
  );
}

/**
 * Save recent steam moves file
 */
async function saveRecentSteamMoves(
  storage: R2Storage,
  leagueId: string,
  season: string,
  data: SteamMovesRecent
): Promise<void> {
  const basePath = storage.getBasePath();
  const key = basePath
    ? `${basePath}/leagues/${leagueId}/${season}/steam_moves_recent.json`
    : `leagues/${leagueId}/${season}/steam_moves_recent.json`;

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await storage.getClient().send(
    new PutObjectCommand({
      Bucket: storage.getBucketName(),
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    })
  );
}

/**
 * Save steam moves for a specific date
 */
async function saveDateSteamMoves(
  storage: R2Storage,
  leagueId: string,
  season: string,
  date: string,
  data: SteamMovesByDate
): Promise<void> {
  const basePath = storage.getBasePath();
  const key = basePath
    ? `${basePath}/leagues/${leagueId}/${season}/steam_moves_by_date/${date}.json`
    : `leagues/${leagueId}/${season}/steam_moves_by_date/${date}.json`;

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await storage.getClient().send(
    new PutObjectCommand({
      Bucket: storage.getBucketName(),
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    })
  );
}

/**
 * Save dates index
 */
async function saveDatesIndex(
  storage: R2Storage,
  leagueId: string,
  season: string,
  data: SteamMovesDatesIndex
): Promise<void> {
  const basePath = storage.getBasePath();
  const key = basePath
    ? `${basePath}/leagues/${leagueId}/${season}/steam_moves_dates.json`
    : `leagues/${leagueId}/${season}/steam_moves_dates.json`;

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await storage.getClient().send(
    new PutObjectCommand({
      Bucket: storage.getBucketName(),
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    })
  );
}

/**
 * Compute steam moves for a single match
 */
async function computeMatchSteamMoves(
  storage: R2Storage,
  leagueId: string,
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
    const snapshot = await getSnapshotByPath(storage, snapshotPath);
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
 * Process a single league - generates split files for optimal loading
 */
async function processLeague(
  storage: R2Storage,
  leagueId: string,
  season: string
): Promise<{ cached: number; skipped: number; total: number }> {
  console.log(`\n📊 Processing ${leagueId}/${season}...`);

  const matchIndex = (await storage.getIndex(
    leagueId,
    season,
    "by_match"
  )) as MatchIndex | null;

  if (!matchIndex) {
    console.log(`  ⚠️  No match index found`);
    return { cached: 0, skipped: 0, total: 0 };
  }

  const now = new Date();
  const allSteamMoves: SteamMove[] = [];
  const marketsFound = new Set<string>();
  let cachedCount = 0;
  let skippedCount = 0;

  const matchEntries = Object.entries(matchIndex.matches);
  const pastMatches = matchEntries.filter(
    ([, match]) => new Date(match.kickoffTime) < now
  );

  console.log(`  📋 Found ${matchEntries.length} total matches`);
  console.log(`  📋 Processing ${pastMatches.length} past matches...`);

  // Step 1: Process past matches (compute or use cache)
  for (const [matchKey, match] of pastMatches) {
    if (!FORCE) {
      const existingCache = await getSteamMovesCache(
        storage,
        leagueId,
        season,
        matchKey
      );
      if (existingCache) {
        allSteamMoves.push(...existingCache.steamMoves);
        existingCache.steamMoves.forEach((m) => marketsFound.add(m.marketLabel));
        skippedCount++;
        continue;
      }
    }

    if (DRY_RUN) {
      console.log(`  📝 Would cache: ${matchKey}`);
      cachedCount++;
      continue;
    }

    console.log(`  🔄 Computing: ${matchKey}...`);
    const moves = await computeMatchSteamMoves(
      storage,
      leagueId,
      matchKey,
      match
    );

    await saveSteamMovesCache(storage, leagueId, season, matchKey, moves);
    allSteamMoves.push(...moves);
    moves.forEach((m) => marketsFound.add(m.marketLabel));
    cachedCount++;

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Step 2: Include upcoming matches from cache
  const upcomingMatches = matchEntries.filter(
    ([, match]) => new Date(match.kickoffTime) >= now
  );
  for (const [matchKey] of upcomingMatches) {
    const existingCache = await getSteamMovesCache(
      storage,
      leagueId,
      season,
      matchKey
    );
    if (existingCache) {
      allSteamMoves.push(...existingCache.steamMoves);
      existingCache.steamMoves.forEach((m) => marketsFound.add(m.marketLabel));
    }
  }

  // Sort all moves by kickoff time
  allSteamMoves.sort(
    (a, b) =>
      new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime()
  );

  if (DRY_RUN) {
    console.log(`  ✅ Done: ${cachedCount} would be cached, ${skippedCount} skipped`);
    return { cached: cachedCount, skipped: skippedCount, total: pastMatches.length };
  }

  // Step 3: Generate split files
  console.log(`  📁 Generating split files...`);

  const generatedAt = new Date().toISOString();
  const availableMarkets = Array.from(marketsFound).sort();

  // Calculate date boundaries
  const upcomingEnd = new Date(now);
  upcomingEnd.setDate(upcomingEnd.getDate() + UPCOMING_DAYS);
  const recentStart = new Date(now);
  recentStart.setDate(recentStart.getDate() - RECENT_DAYS);

  // Split steam moves into categories
  const upcomingMoves: SteamMove[] = [];
  const recentMoves: SteamMove[] = [];
  const movesByDate = new Map<string, SteamMove[]>();

  for (const move of allSteamMoves) {
    const kickoff = new Date(move.kickoffTime);
    const dateStr = move.kickoffTime.split("T")[0];

    // Categorize
    if (kickoff >= now && kickoff <= upcomingEnd) {
      upcomingMoves.push(move);
    }
    if (kickoff >= recentStart && kickoff < now) {
      recentMoves.push(move);
    }

    // Group by date for per-date files
    if (!movesByDate.has(dateStr)) {
      movesByDate.set(dateStr, []);
    }
    movesByDate.get(dateStr)!.push(move);
  }

  // Save upcoming file
  const upcomingData: SteamMovesUpcoming = {
    leagueId,
    season,
    steamMoves: upcomingMoves,
    generatedAt,
    availableMarkets,
    fromDate: now.toISOString().split("T")[0],
    toDate: upcomingEnd.toISOString().split("T")[0],
  };
  await saveUpcomingSteamMoves(storage, leagueId, season, upcomingData);
  console.log(`    ✅ Upcoming: ${upcomingMoves.length} moves`);

  // Save recent file
  const recentData: SteamMovesRecent = {
    leagueId,
    season,
    steamMoves: recentMoves,
    generatedAt,
    availableMarkets,
    fromDate: recentStart.toISOString().split("T")[0],
    toDate: now.toISOString().split("T")[0],
  };
  await saveRecentSteamMoves(storage, leagueId, season, recentData);
  console.log(`    ✅ Recent: ${recentMoves.length} moves`);

  // Save per-date files
  const sortedDates = Array.from(movesByDate.keys()).sort().reverse();
  for (const date of sortedDates) {
    const moves = movesByDate.get(date)!;
    const dateData: SteamMovesByDate = {
      leagueId,
      season,
      date,
      steamMoves: moves,
      generatedAt,
    };
    await saveDateSteamMoves(storage, leagueId, season, date, dateData);
  }
  console.log(`    ✅ Per-date files: ${sortedDates.length} dates`);

  // Save dates index
  const datesIndex: SteamMovesDatesIndex = {
    leagueId,
    season,
    availableDates: sortedDates,
    availableMarkets,
    generatedAt,
  };
  await saveDatesIndex(storage, leagueId, season, datesIndex);

  // Also save the full aggregate for backward compatibility / homepage
  const aggregate: LeagueSteamMovesAggregate = {
    leagueId,
    season,
    steamMoves: allSteamMoves,
    generatedAt,
    availableMarkets,
  };
  await saveLeagueSteamMoves(storage, leagueId, season, aggregate);

  console.log(`  ✅ Done: ${cachedCount} cached, ${skippedCount} skipped, ${allSteamMoves.length} total moves`);

  return { cached: cachedCount, skipped: skippedCount, total: pastMatches.length };
}

/**
 * Main execution
 */
async function main() {
  console.log("🚀 Generate Steam Moves Cache Script\n");
  console.log("Mode:", DRY_RUN ? "DRY RUN (no changes)" : "LIVE (will write to R2)");
  console.log("Force:", FORCE ? "YES (regenerate all)" : "NO (skip existing)");
  console.log("Season:", CURRENT_SEASON);
  if (SPECIFIC_LEAGUE) {
    console.log("League:", SPECIFIC_LEAGUE);
  }
  console.log("");

  // Validate environment variables
  const missing = [];
  if (!CONFIG.R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!CONFIG.R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!CONFIG.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error("\nMake sure you have a .env file with these variables.");
    process.exit(1);
  }

  // Initialize storage
  const storage = new R2Storage({
    accountId: CONFIG.R2_ACCOUNT_ID,
    accessKeyId: CONFIG.R2_ACCESS_KEY_ID,
    secretAccessKey: CONFIG.R2_SECRET_ACCESS_KEY,
    bucketName: CONFIG.BUCKET_NAME,
    basePath: CONFIG.BASE_PATH,
  });

  const leaguesToProcess = SPECIFIC_LEAGUE
    ? LEAGUES.filter((l) => l.id === SPECIFIC_LEAGUE)
    : LEAGUES;

  if (leaguesToProcess.length === 0) {
    console.error(`❌ League not found: ${SPECIFIC_LEAGUE}`);
    console.error("Available leagues:", LEAGUES.map((l) => l.id).join(", "));
    process.exit(1);
  }

  let totalCached = 0;
  let totalSkipped = 0;
  let totalMatches = 0;

  for (const league of leaguesToProcess) {
    try {
      const result = await processLeague(storage, league.id, CURRENT_SEASON);
      totalCached += result.cached;
      totalSkipped += result.skipped;
      totalMatches += result.total;
    } catch (error) {
      console.error(`❌ Error processing ${league.id}:`, error);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  console.log(`   Total matches processed: ${totalMatches}`);
  console.log(`   Newly cached: ${totalCached}`);
  console.log(`   Already cached (skipped): ${totalSkipped}`);

  if (DRY_RUN) {
    console.log("\n💡 Run without --dry-run to generate cache");
  } else {
    console.log("\n✅ Cache generation complete!");
    console.log("   The cron job will now use cached data for past matches.");
  }
}

main().catch((error) => {
  console.error("\n❌ Script failed:", error);
  process.exit(1);
});
