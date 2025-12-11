/**
 * Production Data Repair Script
 *
 * This script repairs production data in R2 and D1 by:
 * 1. Auditing existing R2 objects and D1 job records
 * 2. Mapping old paths to new paths
 * 3. Identifying missing snapshots
 * 4. Fetching missing data for future events (optional)
 * 5. Updating D1 records with correct paths
 * 6. Rebuilding all indexes
 *
 * Usage:
 *   # Dry run (no changes)
 *   npx tsx scripts/repair-production-data.ts --dry-run
 *
 *   # Execute repairs (updates D1 and rebuilds indexes)
 *   npx tsx scripts/repair-production-data.ts
 *
 *   # Clear and rebuild all indexes from scratch
 *   npx tsx scripts/repair-production-data.ts --clear-indexes
 *
 *   # Fetch missing data for future events
 *   npx tsx scripts/repair-production-data.ts --fetch-missing
 */

import "dotenv/config";
import { R2Storage } from "../src/storage/R2Storage";
import { TheOddsApiProvider } from "../src/providers/TheOddsApiProvider";
import { IndexBuilder } from "../src/core/IndexBuilder";
import { OddsSnapshot, ScheduledJob } from "../src/config/types";
import { normalizeTeamName } from "@footdata/shared";
import { getLeagueConfig } from "../src/config/leagues";

// Configuration from environment variables
const CONFIG = {
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID!,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY!,
  BUCKET_NAME: "soccer-predictor",
  BASE_PATH: "odds_data_v2",
  D1_DATABASE_NAME: process.env.D1_DATABASE_NAME || "odds-collector-db",
  ODDS_API_KEY: process.env.ODDS_API_KEY!,
  LEAGUES: (process.env.LEAGUES || '["england_premier_league","italy_serie_a"]'),
};

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FETCH_MISSING = args.includes("--fetch-missing");
const CLEAR_INDEXES = args.includes("--clear-indexes");

interface AuditResult {
  r2Objects: Map<string, R2Object>;
  d1Jobs: ScheduledJob[];
  pathMismatches: PathMismatch[];
  missingSnapshots: MissingSnapshot[];
  orphanedSnapshots: string[];
}

interface PathMismatch {
  job: ScheduledJob;
  oldPath: string;
  newPath: string | null; // null if snapshot doesn't exist
  r2Key: string | null; // actual R2 key where snapshot exists
}

interface MissingSnapshot {
  job: ScheduledJob;
  reason: "not_in_r2" | "failed_job" | "team_mapping_error";
  canRefetch: boolean;
}

interface R2Object {
  key: string;
  size: number;
  uploaded: Date;
}

/**
 * Connect to D1 database using Wrangler CLI
 */
async function queryD1<T = any>(query: string): Promise<T[]> {
  const { execSync } = await import("child_process");

  // Use wrangler d1 execute command with JSON output
  const result = execSync(
    `wrangler d1 execute ${CONFIG.D1_DATABASE_NAME} --command "${query.replace(/"/g, '\\"')}" --json --remote`,
    { encoding: "utf-8" }
  );

  const parsed = JSON.parse(result);
  return parsed[0]?.results || [];
}

/**
 * Update D1 database record
 */
async function updateD1(query: string): Promise<void> {
  const { execSync } = await import("child_process");

  execSync(
    `wrangler d1 execute ${CONFIG.D1_DATABASE_NAME} --command "${query.replace(/"/g, '\\"')}" --remote`,
    { encoding: "utf-8" }
  );
}

/**
 * List all R2 objects in production bucket
 */
async function listAllR2Objects(storage: R2Storage): Promise<Map<string, R2Object>> {
  console.log("📦 Listing all R2 objects...");

  const client = storage.getClient();
  const bucketName = storage.getBucketName();
  const basePath = storage.getBasePath();

  const objects = new Map<string, R2Object>();
  let continuationToken: string | undefined;
  let totalObjects = 0;

  do {
    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: basePath,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          objects.set(obj.Key, {
            key: obj.Key,
            size: obj.Size || 0,
            uploaded: obj.LastModified || new Date(),
          });
          totalObjects++;
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(`   Found ${totalObjects} objects in R2`);
  return objects;
}

/**
 * Get all jobs from D1 database
 */
async function getAllD1Jobs(): Promise<ScheduledJob[]> {
  console.log("🗄️  Querying all jobs from D1...");

  const rows = await queryD1<any>(`
    SELECT
      id, league_id, event_id, home_team, away_team, match_date,
      kickoff_time, timing_offset, scheduled_time, status, attempts,
      last_attempt, snapshot_path, created_at, completed_at, error
    FROM scheduled_jobs
    ORDER BY created_at DESC
  `);

  const jobs: ScheduledJob[] = rows.map((row) => ({
    id: row.id,
    leagueId: row.league_id,
    eventId: row.event_id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    matchDate: row.match_date,
    kickoffTime: row.kickoff_time,
    timingOffset: row.timing_offset,
    scheduledTime: row.scheduled_time,
    status: row.status,
    attempts: row.attempts,
    lastAttempt: row.last_attempt,
    snapshotPath: row.snapshot_path,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    error: row.error,
  }));

  console.log(`   Found ${jobs.length} jobs in D1`);
  console.log(`   - Completed: ${jobs.filter(j => j.status === "completed").length}`);
  console.log(`   - Failed: ${jobs.filter(j => j.status === "failed").length}`);
  console.log(`   - Pending: ${jobs.filter(j => j.status === "pending").length}`);

  return jobs;
}

/**
 * Generate new snapshot path format from job data
 */
function generateNewPath(job: ScheduledJob): string {
  // New format: {eventId}_{timing}_{date}.json
  return `${job.eventId}_${job.timingOffset}_${job.matchDate}.json`;
}

/**
 * Find R2 key that matches this job (handles path mismatches)
 */
function findMatchingR2Key(
  job: ScheduledJob,
  r2Objects: Map<string, R2Object>,
  basePath: string
): string | null {
  const newPath = generateNewPath(job);
  const fullNewPath = `${basePath}/leagues/${job.leagueId}/${inferSeason(job.matchDate)}/${newPath}`;

  // Check if new path exists
  if (r2Objects.has(fullNewPath)) {
    return fullNewPath;
  }

  // Check if old path exists (from job.snapshotPath)
  if (job.snapshotPath && r2Objects.has(job.snapshotPath)) {
    return job.snapshotPath;
  }

  // Try to find by event ID (in case path format changed)
  for (const [key, obj] of r2Objects.entries()) {
    if (key.includes(job.eventId) &&
        key.includes(job.timingOffset) &&
        key.includes(job.matchDate)) {
      return key;
    }
  }

  return null;
}

/**
 * Infer season from match date
 */
function inferSeason(matchDate: string): string {
  const date = new Date(matchDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (month < 8) {
    return `${year - 1}-${year}`;
  }
  return `${year}-${year + 1}`;
}

/**
 * Phase 1: Audit and map existing data
 */
async function auditData(storage: R2Storage): Promise<AuditResult> {
  console.log("\n=== PHASE 1: AUDIT & MAP ===\n");

  // Get all R2 objects
  const r2Objects = await listAllR2Objects(storage);

  // Get all D1 jobs
  const d1Jobs = await getAllD1Jobs();

  // Analyze jobs for issues
  const pathMismatches: PathMismatch[] = [];
  const missingSnapshots: MissingSnapshot[] = [];
  const foundR2Keys = new Set<string>();

  console.log("\n🔍 Analyzing jobs for issues...\n");

  for (const job of d1Jobs) {
    const newPath = generateNewPath(job);
    const r2Key = findMatchingR2Key(job, r2Objects, CONFIG.BASE_PATH);

    // Track which R2 objects are referenced by jobs
    if (r2Key) {
      foundR2Keys.add(r2Key);
    }

    // Check for path mismatches (completed jobs with wrong path)
    if (job.status === "completed" && job.snapshotPath) {
      const expectedNewPath = `${CONFIG.BASE_PATH}/leagues/${job.leagueId}/${inferSeason(job.matchDate)}/${newPath}`;

      if (job.snapshotPath !== expectedNewPath) {
        pathMismatches.push({
          job,
          oldPath: job.snapshotPath,
          newPath: r2Key ? expectedNewPath : null,
          r2Key,
        });
      }
    }

    // Check for missing snapshots
    if (job.status === "completed" && !r2Key) {
      const kickoffTime = new Date(job.kickoffTime);
      const now = new Date();
      const canRefetch = kickoffTime > now;

      missingSnapshots.push({
        job,
        reason: "not_in_r2",
        canRefetch,
      });
    }

    if (job.status === "failed") {
      const kickoffTime = new Date(job.kickoffTime);
      const now = new Date();
      const canRefetch = kickoffTime > now;

      const isTeamMappingError = job.error?.includes("team") ||
                                  job.error?.includes("normalize") ||
                                  job.error?.includes("mapping");

      missingSnapshots.push({
        job,
        reason: isTeamMappingError ? "team_mapping_error" : "failed_job",
        canRefetch,
      });
    }
  }

  // Find orphaned snapshots (in R2 but no job reference)
  const orphanedSnapshots: string[] = [];
  for (const key of r2Objects.keys()) {
    if (!foundR2Keys.has(key) && key.endsWith(".json") && !key.includes("index")) {
      orphanedSnapshots.push(key);
    }
  }

  // Print summary
  console.log("📊 Audit Results:");
  console.log(`   - Path mismatches: ${pathMismatches.length}`);
  console.log(`   - Missing snapshots: ${missingSnapshots.length}`);
  console.log(`     • Can refetch (future events): ${missingSnapshots.filter(m => m.canRefetch).length}`);
  console.log(`     • Cannot refetch (past events): ${missingSnapshots.filter(m => !m.canRefetch).length}`);
  console.log(`   - Orphaned snapshots: ${orphanedSnapshots.length}`);

  return {
    r2Objects,
    d1Jobs,
    pathMismatches,
    missingSnapshots,
    orphanedSnapshots,
  };
}

/**
 * Phase 2: Fetch missing data for future events
 */
async function fetchMissingData(
  audit: AuditResult,
  storage: R2Storage,
  provider: TheOddsApiProvider
): Promise<number> {
  console.log("\n=== PHASE 2: FETCH MISSING DATA ===\n");

  const refetchable = audit.missingSnapshots.filter(m => m.canRefetch);

  if (refetchable.length === 0) {
    console.log("✅ No missing data to fetch");
    return 0;
  }

  console.log(`🔄 Found ${refetchable.length} snapshots that can be refetched\n`);

  if (DRY_RUN) {
    console.log("⚠️  DRY RUN: Would fetch the following:");
    for (const missing of refetchable) {
      console.log(`   - ${missing.job.homeTeam} vs ${missing.job.awayTeam} (${missing.job.timingOffset})`);
    }
    return 0;
  }

  let fetched = 0;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (const missing of refetchable) {
    const job = missing.job;

    try {
      console.log(`📥 Fetching: ${job.homeTeam} vs ${job.awayTeam} (${job.timingOffset})...`);

      // Fetch odds from provider
      const leagueConfig = getLeagueConfig(job.leagueId);
      if (!leagueConfig) {
        console.log(`   ⚠️  Skip: No league config for ${job.leagueId}`);
        continue;
      }

      const oddsData = await provider.fetchEventOdds(
        leagueConfig.oddsApiKey,
        job.eventId,
        "h2h,spreads,totals", // Default markets
        "uk" // Default region
      );

      if (!oddsData) {
        console.log(`   ⚠️  Skip: No odds data returned`);
        continue;
      }

      // Create snapshot
      const snapshot: OddsSnapshot = {
        metadata: {
          timestamp: new Date().toISOString(),
          date: job.matchDate,
          league: job.leagueId,
          season: inferSeason(job.matchDate),
          collectionMethod: "event_based",
          snapshotTiming: job.timingOffset,
          eventMetadata: {
            eventId: job.eventId,
            kickoffTime: job.kickoffTime,
          },
        },
        odds: oddsData,
      };

      // Save to R2
      const snapshotPath = await storage.saveSnapshot(
        job.leagueId,
        inferSeason(job.matchDate),
        snapshot
      );

      // Update D1 job status
      await updateD1(`
        UPDATE scheduled_jobs
        SET status = 'completed',
            snapshot_path = '${snapshotPath}',
            completed_at = CURRENT_TIMESTAMP,
            error = NULL
        WHERE id = '${job.id}'
      `);

      console.log(`   ✅ Saved to: ${snapshotPath}`);
      fetched++;

      // Rate limiting
      await delay(1100);

    } catch (error) {
      console.error(`   ❌ Error: ${(error as Error).message}`);
    }
  }

  console.log(`\n✅ Fetched ${fetched} missing snapshots`);
  return fetched;
}

/**
 * Clear all index files for a league/season
 */
async function clearIndexes(storage: R2Storage, leagueId: string, season: string): Promise<void> {
  const indexTypes: Array<"by_match" | "by_date" | "by_team"> = ["by_match", "by_date", "by_team"];

  for (const indexType of indexTypes) {
    try {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const client = storage.getClient();
      const bucketName = storage.getBucketName();
      const basePath = storage.getBasePath();
      const key = `${basePath}/leagues/${leagueId}/${season}/${indexType}.json`;

      await client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        })
      );
      console.log(`   ✅ Deleted ${indexType}.json`);
    } catch (error: any) {
      // Ignore if doesn't exist
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        console.log(`   ⚠️  ${indexType}.json not found (already deleted)`);
      } else {
        console.error(`   ❌ Error deleting ${indexType}.json:`, error.message);
      }
    }
  }
}

/**
 * Phase 3: Repair D1 paths and rebuild indexes
 */
async function repairAndRebuild(
  audit: AuditResult,
  storage: R2Storage
): Promise<void> {
  console.log("\n=== PHASE 3: REPAIR & REBUILD ===\n");

  // Step 1: Update D1 paths
  if (audit.pathMismatches.length > 0) {
    console.log(`🔧 Updating ${audit.pathMismatches.length} job paths in D1...\n`);

    if (DRY_RUN) {
      console.log("⚠️  DRY RUN: Would update the following:");
      for (const mismatch of audit.pathMismatches.slice(0, 10)) {
        console.log(`   - Job ${mismatch.job.id}`);
        console.log(`     Old: ${mismatch.oldPath}`);
        console.log(`     New: ${mismatch.newPath || "NOT FOUND"}`);
      }
      if (audit.pathMismatches.length > 10) {
        console.log(`   ... and ${audit.pathMismatches.length - 10} more`);
      }
    } else {
      let updated = 0;
      for (const mismatch of audit.pathMismatches) {
        if (mismatch.newPath) {
          await updateD1(`
            UPDATE scheduled_jobs
            SET snapshot_path = '${mismatch.newPath}'
            WHERE id = '${mismatch.job.id}'
          `);
          updated++;
        }
      }
      console.log(`   ✅ Updated ${updated} job paths`);
    }
  }

  // Step 2: Clear indexes if requested
  if (CLEAR_INDEXES) {
    console.log("\n🗑️  Clearing existing indexes...\n");
    const leagueIds = JSON.parse(CONFIG.LEAGUES) as string[];

    for (const leagueId of leagueIds) {
      const seasons = new Set<string>();
      for (const job of audit.d1Jobs) {
        if (job.leagueId === leagueId) {
          seasons.add(inferSeason(job.matchDate));
        }
      }

      for (const season of seasons) {
        console.log(`🗑️  Clearing indexes for ${leagueId}/${season}...`);
        if (!DRY_RUN) {
          await clearIndexes(storage, leagueId, season);
        } else {
          console.log(`   ⚠️  DRY RUN: Would clear indexes`);
        }
      }
    }
  }

  // Step 3: Rebuild indexes
  console.log("\n🔨 Rebuilding indexes...\n");

  // IMPORTANT: Re-query D1 to get fresh data with updated paths
  console.log("🔄 Re-querying D1 to get updated job data...\n");
  const freshD1Jobs = await getAllD1Jobs();

  const leagueIds = JSON.parse(CONFIG.LEAGUES) as string[];
  const indexBuilder = new IndexBuilder({ storage });

  for (const leagueId of leagueIds) {
    // Get all completed jobs for this league (using fresh data)
    const completedJobs = freshD1Jobs.filter(
      j => j.leagueId === leagueId && j.status === "completed" && j.snapshotPath
    );

    if (completedJobs.length === 0) {
      console.log(`⚠️  ${leagueId}: No completed jobs, skipping`);
      continue;
    }

    // Group jobs by season
    const jobsBySeason = new Map<string, typeof completedJobs>();
    for (const job of completedJobs) {
      const season = inferSeason(job.matchDate);
      if (!jobsBySeason.has(season)) {
        jobsBySeason.set(season, []);
      }
      jobsBySeason.get(season)!.push(job);
    }

    for (const [season, jobs] of jobsBySeason.entries()) {
      console.log(`📇 Building index for ${leagueId}/${season} (${jobs.length} snapshots)...`);

      if (DRY_RUN) {
        console.log(`   ⚠️  DRY RUN: Would rebuild index`);
        continue;
      }

      try {
        // Transform jobs into snapshot metadata (lowercase team names for consistent keys)
        const snapshotsMetadata = jobs.map((job) => ({
          homeTeam: job.homeTeam.toLowerCase(),
          awayTeam: job.awayTeam.toLowerCase(),
          matchDate: job.matchDate,
          eventId: job.eventId,
          timing: job.timingOffset,
          path: job.snapshotPath!,
          kickoffTime: job.kickoffTime,
        }));

        // Update match index
        await indexBuilder.updateMatchIndex(leagueId, season, snapshotsMetadata);

        // Build derived indexes
        await indexBuilder.buildAllIndexes(leagueId, season);

        console.log(`   ✅ Index rebuilt successfully`);
      } catch (error) {
        console.error(`   ❌ Error: ${(error as Error).message}`);
      }
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("🚀 Production Data Repair Script\n");
  console.log("Mode:", DRY_RUN ? "DRY RUN (no changes)" : "LIVE (will modify data)");
  console.log("Fetch missing:", FETCH_MISSING ? "YES" : "NO");
  console.log("Clear indexes:", CLEAR_INDEXES ? "YES" : "NO");
  console.log("");

  // Validate environment variables
  const missing = [];
  if (!CONFIG.R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!CONFIG.R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!CONFIG.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (FETCH_MISSING && !CONFIG.ODDS_API_KEY) missing.push("ODDS_API_KEY");

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach(v => console.error(`   - ${v}`));
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

  // Initialize provider (if fetching missing data)
  const provider = FETCH_MISSING
    ? new TheOddsApiProvider({ apiKey: CONFIG.ODDS_API_KEY })
    : null;

  try {
    // Phase 1: Audit
    const audit = await auditData(storage);

    // Phase 2: Fetch missing (if requested)
    if (FETCH_MISSING && provider) {
      await fetchMissingData(audit, storage, provider);
      // Re-audit after fetching to update counts
      const updatedAudit = await auditData(storage);
      await repairAndRebuild(updatedAudit, storage);
    } else {
      // Phase 3: Repair and rebuild
      await repairAndRebuild(audit, storage);
    }

    console.log("\n✅ Repair script completed successfully!\n");

    if (DRY_RUN) {
      console.log("💡 Run without --dry-run to apply changes");
    }

  } catch (error) {
    console.error("\n❌ Repair script failed:", error);
    process.exit(1);
  }
}

main();
