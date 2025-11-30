#!/usr/bin/env ts-node
/**
 * Backfill missing historical odds to R2
 *
 * Checks R2 for existing snapshots and fetches missing event+timing combinations
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { R2Storage } from "../storage/R2Storage";
import { TimingPresets } from "../config/timingPresets";
import { getLeagueConfig } from "../config/leagues";
import { IndexBuilder } from "../core/IndexBuilder";
import { TheOddsApiProvider } from "../providers/TheOddsApiProvider";
import { normalizeTeamName } from "@footdata/shared";
import type { OddsSnapshot, EventOdds } from "../config/types";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

if (
  !process.env.ODDS_API_KEY ||
  !process.env.R2_ACCOUNT_ID ||
  !process.env.R2_ACCESS_KEY_ID ||
  !process.env.R2_SECRET_ACCESS_KEY
) {
  console.error("Missing required environment variables");
  process.exit(1);
}

function inferSeasonFromDate(matchDate: string): string {
  const date = new Date(matchDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("=".repeat(60));
  console.log(
    `Backfilling R2 Odds for Premier League ${dryRun ? "(DRY RUN)" : ""}`,
  );
  console.log("=".repeat(60));

  const league = getLeagueConfig("england_premier_league");
  if (!league) {
    console.error("League config not found");
    process.exit(1);
  }
  const timingOffsets = TimingPresets.COMPREHENSIVE;
  const provider = new TheOddsApiProvider({ apiKey: process.env.ODDS_API_KEY! });

  // Initialize R2
  const storage = new R2Storage({
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucketName: "soccer-predictor",
    basePath: "odds_data_v2",
  });

  // Check both seasons
  const seasons = ["2025-2026"];
  const existingEventTimings = new Set<string>();

  console.log("\n📋 Checking existing R2 snapshots...");
  for (const season of seasons) {
    const snapshots = await storage.listSnapshots(
      "england_premier_league",
      season,
    );
    console.log(`${season}: ${snapshots.length} snapshots`);

    for (const snapshotId of snapshots) {
      // Format: eventId_timing_date
      // Example: 04a7592aee6053a0cc6034d8c87e38e2_closing_2025-11-30
      // Example: 04a7592aee6053a0cc6034d8c87e38e2_day_before_2025-11-30

      // Split by underscore
      const parts = snapshotId.split("_");

      // Event ID is always the first part (32 char hex)
      const eventId = parts[0];

      // Date is always the last part (YYYY-MM-DD)
      const date = parts[parts.length - 1];

      // Timing is everything in between
      const timingParts = parts.slice(1, -1);
      const timing = timingParts.join("_");

      const key = `${eventId}_${timing}`;
      existingEventTimings.add(key);
    }
  }

  console.log(
    `Total unique event+timing combinations: ${existingEventTimings.size}\n`,
  );

  // Generate weekly batches from August 2024 to now
  const startDate = new Date("2025-08-01");
  const endDate = new Date();
  const weeklyBatches: Array<{ start: string; end: string }> = [];

  let currentDate = new Date(startDate);
  while (currentDate < endDate) {
    const weekStart = currentDate.toISOString().split("T")[0];
    const weekEnd = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weekEndStr = (weekEnd > endDate ? endDate : weekEnd)
      .toISOString()
      .split("T")[0];

    weeklyBatches.push({ start: weekStart, end: weekEndStr });
    currentDate = weekEnd;
  }

  console.log(`📅 Processing ${weeklyBatches.length} weekly batches\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let apiCalls = 0;

  for (const batch of weeklyBatches) {
    console.log(`\n📦 Batch: ${batch.start} to ${batch.end}`);

    // Fetch events visible at the start of this week
    try {
      apiCalls++;
      const events = await provider.getHistoricalEvents(
        league.oddsApiKey,
        `${batch.start}T00:00:00Z`,
        `${batch.start}T00:00:00Z`,
        `${batch.end}T23:59:59Z`,
      );
      console.log(`   Found ${events.length} events`);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      for (const event of events) {
        const eventId = event.id;
        const commenceTime = new Date(event.commence_time);
        const matchDate = event.commence_time.split("T")[0];
        const season = inferSeasonFromDate(matchDate);

        console.log(
          `\n   📅 ${event.home_team} vs ${event.away_team} (${matchDate})`,
        );

        for (const timing of timingOffsets) {
          const key = `${eventId}_${timing.name}`;

          if (existingEventTimings.has(key)) {
            console.log(`      ⏭️  ${timing.name} - exists`);
            skipped++;
            continue;
          }

          const fetchTime = new Date(
            commenceTime.getTime() - timing.hoursBeforeKickoff * 60 * 60 * 1000,
          );
          const fetchTimeISO = fetchTime.toISOString().slice(0, -5) + "Z";

          console.log(`      📥 ${timing.name} (fetch: ${fetchTimeISO})`);

          if (dryRun) {
            uploaded++;
            continue;
          }

          try {
            apiCalls++;
            const oddsData = await provider.getHistoricalEventOdds(
              league.oddsApiKey,
              eventId,
              fetchTimeISO,
              "eu",
              timing.markets,
            );

            const snapshot: OddsSnapshot = {
              metadata: {
                timestamp: new Date().toISOString(),
                date: matchDate,
                league: "england_premier_league",
                season,
                collectionMethod: "event_based",
                snapshotTiming: timing.name as any,
                eventMetadata: {
                  eventId,
                  kickoffTime: oddsData.commence_time,
                },
              },
              odds: {
                id: eventId,
                sportKey: oddsData.sport_key,
                homeTeam: normalizeTeamName("england_premier_league", oddsData.home_team),
                awayTeam: normalizeTeamName("england_premier_league", oddsData.away_team),
                commenceTime: oddsData.commence_time,
                bookmakers: oddsData.bookmakers || [],
              } as EventOdds,
            };

            await storage.saveSnapshot(
              "england_premier_league",
              season,
              snapshot,
            );
            console.log(`         ✅ Uploaded`);
            uploaded++;

            await new Promise((resolve) => setTimeout(resolve, 1100));
          } catch (error: any) {
            console.error(`         ❌ ${error.message}`);
            failed++;
          }
        }
      }
    } catch (error: any) {
      console.error(`   ❌ Failed to fetch events for batch: ${error.message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Summary:");
  console.log(`API calls: ${apiCalls}`);
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log("=".repeat(60));

  // Rebuild indexes if we uploaded anything
  if (uploaded > 0 && !dryRun) {
    console.log("\n📚 Rebuilding indexes...");

    const indexBuilder = new IndexBuilder({ storage, leagueId: "england_premier_league" });

    for (const season of seasons) {
      try {
        console.log(`\n  Building indexes for ${season}...`);

        // Get all snapshots for this season
        const snapshotIds = await storage.listSnapshots(
          "england_premier_league",
          season,
        );

        if (snapshotIds.length === 0) {
          console.log(`    ⏭️  No snapshots, skipping`);
          continue;
        }

        console.log(`    📇 Processing ${snapshotIds.length} snapshots...`);

        // Build snapshot metadata for index
        const snapshotMetadata = [];
        for (const snapshotId of snapshotIds) {
          try {
            const snapshot = await storage.getSnapshot(
              "england_premier_league",
              season,
              snapshotId,
            );
            if (!snapshot) continue;

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
              eventId:
                snapshot.metadata.eventMetadata?.eventId || snapshot.odds.id,
              timing: snapshot.metadata.snapshotTiming,
              path: `england_premier_league/${season}/${snapshotId}.json`,
              markets: Array.from(marketsSet),
              kickoffTime: snapshot.odds.commenceTime,
            });
          } catch (error: any) {
            console.warn(
              `    ⚠️  Could not load snapshot ${snapshotId}: ${error.message}`,
            );
            continue;
          }
        }

        if (snapshotMetadata.length > 0) {
          // Update match index
          await indexBuilder.updateMatchIndex(
            "england_premier_league",
            season,
            snapshotMetadata,
          );

          // Build derived indexes (by_date, by_team)
          await indexBuilder.buildAllIndexes("england_premier_league", season);

          console.log(`    ✅ Indexes built for ${season}`);
        }
      } catch (error: any) {
        console.error(
          `    ❌ Failed to build indexes for ${season}: ${error.message}`,
        );
      }
    }

    console.log("\n✅ Index building completed");
  }
}

main().catch(console.error);
