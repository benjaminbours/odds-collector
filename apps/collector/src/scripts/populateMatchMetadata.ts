#!/usr/bin/env tsx
/**
 * One-time backfill: populate D1 `matches` + `snapshots` from existing
 * completed scheduled_jobs. Idempotent (uses ON CONFLICT DO UPDATE).
 *
 * Usage:
 *   # Local DB (default)
 *   npx tsx src/scripts/populateMatchMetadata.ts --dry-run
 *   npx tsx src/scripts/populateMatchMetadata.ts
 *
 *   # Production DB
 *   npx tsx src/scripts/populateMatchMetadata.ts --remote
 *   npx tsx src/scripts/populateMatchMetadata.ts --remote --dry-run
 *
 * Safe to rerun: match/snapshot rows are upserted on primary-key conflict.
 */

import "dotenv/config";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { generateMatchKey, inferSeasonFromDate } from "../utils/pathUtils";

const D1_DATABASE_NAME = process.env.D1_DATABASE_NAME || "odds-collector-db";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const REMOTE = args.includes("--remote");
const TARGET_FLAG = REMOTE ? "--remote" : "--local";

// D1 + wrangler has a hard statement limit per execute; keep chunks conservative.
const CHUNK_SIZE = 200;

interface JobRow {
  id: string;
  league_id: string;
  event_id: string;
  home_team: string;
  away_team: string;
  match_date: string;
  kickoff_time: string;
  timing_offset: string;
  snapshot_path: string | null;
  completed_at: string | null;
}

function shellEscape(sql: string): string {
  // Escape double quotes for the --command path; we mostly use --file below.
  return sql.replace(/"/g, '\\"');
}

function queryD1<T = any>(sql: string): T[] {
  const result = execSync(
    `wrangler d1 execute ${D1_DATABASE_NAME} --command "${shellEscape(sql)}" --json ${TARGET_FLAG}`,
    { encoding: "utf-8", stdio: ["ignore", "pipe", "inherit"] }
  );
  const parsed = JSON.parse(result);
  return parsed[0]?.results || [];
}

function applyD1File(filePath: string): void {
  execSync(
    `wrangler d1 execute ${D1_DATABASE_NAME} --file="${filePath}" ${TARGET_FLAG}`,
    { encoding: "utf-8", stdio: ["ignore", "pipe", "inherit"] }
  );
}

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

function buildMatchUpsert(job: JobRow): {
  matchKey: string;
  matchSql: string;
  snapshotSql: string;
} {
  const matchKey = generateMatchKey(
    job.home_team,
    job.away_team,
    job.match_date
  );
  const season = inferSeasonFromDate(job.match_date);
  const collectedAt = job.completed_at || job.kickoff_time; // best-effort fallback

  const matchSql = `INSERT INTO matches (match_key, league_id, season, event_id, home_team, away_team, match_date, kickoff_time, updated_at) VALUES ('${sqlEscape(matchKey)}', '${sqlEscape(job.league_id)}', '${sqlEscape(season)}', '${sqlEscape(job.event_id)}', '${sqlEscape(job.home_team)}', '${sqlEscape(job.away_team)}', '${sqlEscape(job.match_date)}', '${sqlEscape(job.kickoff_time)}', CURRENT_TIMESTAMP) ON CONFLICT(match_key) DO UPDATE SET league_id=excluded.league_id, season=excluded.season, event_id=excluded.event_id, home_team=excluded.home_team, away_team=excluded.away_team, match_date=excluded.match_date, kickoff_time=excluded.kickoff_time, updated_at=CURRENT_TIMESTAMP;`;

  const snapshotSql = `INSERT INTO snapshots (match_key, timing, r2_path, collected_at) VALUES ('${sqlEscape(matchKey)}', '${sqlEscape(job.timing_offset)}', '${sqlEscape(job.snapshot_path!)}', '${sqlEscape(collectedAt)}') ON CONFLICT(match_key, timing) DO UPDATE SET r2_path=excluded.r2_path, collected_at=excluded.collected_at;`;

  return { matchKey, matchSql, snapshotSql };
}

async function main() {
  console.log("=".repeat(60));
  console.log(
    `populateMatchMetadata — ${REMOTE ? "REMOTE" : "LOCAL"} ${DRY_RUN ? "(dry run)" : ""}`
  );
  console.log("=".repeat(60));

  console.log("🗄️  Loading completed jobs from D1...");
  const jobs = queryD1<JobRow>(
    `SELECT id, league_id, event_id, home_team, away_team, match_date, kickoff_time, timing_offset, snapshot_path, completed_at FROM scheduled_jobs WHERE status = 'completed' AND snapshot_path IS NOT NULL`
  );
  console.log(`   ${jobs.length} completed jobs with snapshot_path`);

  if (jobs.length === 0) {
    console.log("Nothing to backfill. Exiting.");
    return;
  }

  // Derive expected match count for validation.
  const matchKeys = new Set<string>();
  const statements: string[] = [];
  for (const job of jobs) {
    const { matchKey, matchSql, snapshotSql } = buildMatchUpsert(job);
    matchKeys.add(matchKey);
    statements.push(matchSql, snapshotSql);
  }
  console.log(
    `   ${matchKeys.size} unique matches, ${jobs.length} snapshot rows to upsert`
  );

  if (DRY_RUN) {
    console.log("\nDry run — first 5 SQL statements that would execute:");
    statements.slice(0, 5).forEach((s) => console.log(`  ${s}`));
    return;
  }

  const tmp = mkdtempSync(join(tmpdir(), "populate-"));
  const chunkCount = Math.ceil(statements.length / CHUNK_SIZE);
  console.log(
    `📤 Applying ${statements.length} statements in ${chunkCount} chunk(s) of ${CHUNK_SIZE}...`
  );

  for (let i = 0; i < chunkCount; i++) {
    const chunk = statements.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const file = join(tmp, `chunk-${i}.sql`);
    writeFileSync(file, chunk.join("\n"), "utf-8");
    process.stdout.write(`  chunk ${i + 1}/${chunkCount}... `);
    applyD1File(file);
    unlinkSync(file);
    console.log("ok");
  }

  // Validation
  console.log("\n🔎 Validating...");
  const [{ c: matchCount }] = queryD1<{ c: number }>(
    `SELECT COUNT(*) AS c FROM matches`
  );
  const [{ c: snapshotCount }] = queryD1<{ c: number }>(
    `SELECT COUNT(*) AS c FROM snapshots`
  );
  console.log(`   matches rows:   ${matchCount}`);
  console.log(`   snapshots rows: ${snapshotCount}`);

  const expectedMatches = matchKeys.size;
  const expectedSnapshots = jobs.length;
  const matchOk = matchCount >= expectedMatches;
  const snapshotOk = snapshotCount >= expectedSnapshots;
  console.log(
    `   expected ≥ matches=${expectedMatches}, snapshots=${expectedSnapshots}`
  );
  console.log(
    `   ${matchOk && snapshotOk ? "✅" : "❌"} counts ${matchOk && snapshotOk ? "consistent" : "off"}`
  );

  // Surface matches missing snapshot timings — useful diagnostic.
  const incomplete = queryD1<{ match_key: string; c: number }>(
    `SELECT match_key, COUNT(*) AS c FROM snapshots GROUP BY match_key HAVING c < 4 ORDER BY c ASC LIMIT 10`
  );
  if (incomplete.length > 0) {
    console.log("\n   Matches with <4 snapshots (first 10):");
    for (const row of incomplete) {
      console.log(`     ${row.match_key}: ${row.c} snapshot(s)`);
    }
  } else {
    console.log("   All matches have 4 snapshots ✨");
  }

  console.log("\n✅ Backfill complete.");
}

main().catch((err) => {
  console.error("\n❌ Backfill failed:", err);
  process.exit(1);
});
