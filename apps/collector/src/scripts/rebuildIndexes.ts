#!/usr/bin/env ts-node
/**
 * Rebuild R2 Indexes
 *
 * Rebuilds all indexes (by_match, by_date, by_team) for a league/season
 * from existing R2 snapshots.
 *
 * Usage:
 *   npx ts-node src/scripts/rebuildR2Indexes.ts [--league=LEAGUE_ID] [--season=SEASON]
 *
 * Examples:
 *   npx ts-node src/scripts/rebuildR2Indexes.ts
 *   npx ts-node src/scripts/rebuildR2Indexes.ts --league=england_premier_league --season=2025-2026
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { R2Storage } from "../storage/R2Storage";
import { IndexBuilder } from "../core/IndexBuilder";
import { CURRENT_SEASON } from "../config/leagues";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

if (
  !process.env.R2_ACCOUNT_ID ||
  !process.env.R2_ACCESS_KEY_ID ||
  !process.env.R2_SECRET_ACCESS_KEY
) {
  console.error("Missing R2 credentials in .env");
  process.exit(1);
}

async function rebuildIndexes(leagueId: string, season: string) {
  console.log("=".repeat(60));
  console.log("Rebuilding R2 Indexes");
  console.log("=".repeat(60));
  console.log(`League: ${leagueId}`);
  console.log(`Season: ${season}`);
  console.log("=".repeat(60));

  // Initialize R2 storage
  const storage = new R2Storage({
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucketName: "soccer-predictor",
    basePath: "odds_data_v2",
  });

  const indexBuilder = new IndexBuilder({ storage, leagueId });

  try {
    console.log(`\n📋 Listing snapshots...`);

    // Get all snapshots for this season
    const snapshotIds = await storage.listSnapshots(leagueId, season);

    if (snapshotIds.length === 0) {
      console.log(`❌ No snapshots found for ${leagueId}/${season}`);
      return;
    }

    console.log(`✅ Found ${snapshotIds.length} snapshots\n`);

    console.log(`📇 Loading snapshot metadata...`);

    // Build snapshot metadata for index
    const snapshotMetadata = [];
    let loaded = 0;
    let failed = 0;

    for (const snapshotId of snapshotIds) {
      try {
        const snapshot = await storage.getSnapshot(leagueId, season, snapshotId);
        if (!snapshot) {
          console.warn(`  ⚠️  Snapshot not found: ${snapshotId}`);
          failed++;
          continue;
        }

        // Extract markets from bookmakers
        const marketsSet = new Set<string>();
        snapshot.odds.bookmakers?.forEach((bookmaker: any) => {
          bookmaker.markets?.forEach((market: any) => {
            marketsSet.add(market.key);
          });
        });

        snapshotMetadata.push({
          homeTeam: snapshot.odds.homeTeam,
          awayTeam: snapshot.odds.awayTeam,
          matchDate: snapshot.metadata.date,
          eventId: snapshot.metadata.eventMetadata?.eventId || snapshot.odds.id,
          timing: snapshot.metadata.snapshotTiming,
          // Full path from bucket root - consistent across dashboard, Rust backend, and collector
          path: `odds_data_v2/leagues/${leagueId}/${season}/${snapshotId}.json`,
          markets: Array.from(marketsSet),
          kickoffTime: snapshot.odds.commenceTime,
        });

        loaded++;

        // Progress indicator
        if (loaded % 50 === 0) {
          console.log(`  Loaded ${loaded}/${snapshotIds.length}...`);
        }
      } catch (error: any) {
        console.warn(`  ⚠️  Failed to load ${snapshotId}: ${error.message}`);
        failed++;
      }
    }

    console.log(
      `\n✅ Loaded ${loaded} snapshots (${failed} failed)\n`,
    );

    if (snapshotMetadata.length === 0) {
      console.log(`❌ No valid snapshots to build indexes from`);
      return;
    }

    console.log(`🔨 Building match index (fresh rebuild)...`);
    await indexBuilder.updateMatchIndex(leagueId, season, snapshotMetadata, {
      rebuild: true,
    });
    console.log(`✅ Match index built\n`);

    console.log(`🔨 Building derived indexes (by_date, by_team)...`);
    await indexBuilder.buildAllIndexes(leagueId, season);
    console.log(`✅ Derived indexes built\n`);

    console.log("=".repeat(60));
    console.log("✅ Index rebuilding completed successfully");
    console.log("=".repeat(60));
  } catch (error: any) {
    console.error(`\n❌ Failed to rebuild indexes: ${error.message}`);
    throw error;
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  let leagueId = "england_premier_league";
  let season = CURRENT_SEASON;

  for (const arg of args) {
    if (arg.startsWith("--league=")) {
      leagueId = arg.split("=")[1];
    } else if (arg.startsWith("--season=")) {
      season = arg.split("=")[1];
    }
  }

  return { leagueId, season };
}

// Main
async function main() {
  const { leagueId, season } = parseArgs();
  await rebuildIndexes(leagueId, season);
}

if (require.main === module) {
  main().catch(console.error);
}
