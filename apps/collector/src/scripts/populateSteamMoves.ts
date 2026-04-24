#!/usr/bin/env tsx
/**
 * Offline steam-moves computation → D1. Replaces the R2-JSON cache script
 * (`apps/collector/scripts/generate-steam-moves-cache.ts`) with a single
 * writer that upserts into the `steam_moves` table added in migration 0007.
 *
 * Reads the match list + snapshot paths from D1 (not the retired
 * `by_match.json` R2 index), pulls snapshot payloads from R2 as before, runs
 * the exact same detection (|movement| ≥ 5% between consecutive timings, per
 * bookmaker × market × outcome × point), and upserts results via chunked
 * `wrangler d1 execute --file=…` — same pattern as populateMatchMetadata.ts.
 *
 * Past matches are marked in `steam_moves_processed` and skipped on
 * subsequent runs; upcoming matches are always recomputed (new snapshots
 * still arrive for them).
 *
 * Usage:
 *   # Local DB, preview what would run
 *   npx tsx src/scripts/populateSteamMoves.ts --dry-run
 *
 *   # Local DB, real write (uses .env R2 creds for snapshot reads either way)
 *   npx tsx src/scripts/populateSteamMoves.ts
 *
 *   # Production D1
 *   npx tsx src/scripts/populateSteamMoves.ts --remote
 *   npx tsx src/scripts/populateSteamMoves.ts --remote --dry-run
 *
 *   # Scope to one league
 *   npx tsx src/scripts/populateSteamMoves.ts --remote --league=england_premier_league
 *
 *   # Ignore steam_moves_processed markers and recompute everything
 *   npx tsx src/scripts/populateSteamMoves.ts --remote --force
 *
 * Safe to rerun: every row is upserted via ON CONFLICT DO UPDATE.
 */

import "dotenv/config";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import {
  CURRENT_SEASON,
  LEAGUES,
  OddsSnapshot,
} from "@odds-collector/shared";
import { R2Storage } from "../storage/R2Storage";
import { toPointKey, UpsertSteamMoveInput } from "../core/SteamMovesRepository";
import {
  TIMING_ORDER,
  detectMoves as detectMovePair,
} from "../core/steamMoveDetector";

const D1_DATABASE_NAME = process.env.D1_DATABASE_NAME || "odds-collector-db";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const REMOTE = args.includes("--remote");
const FORCE = args.includes("--force");
const LEAGUE_ARG = args.find((a) => a.startsWith("--league="));
const SPECIFIC_LEAGUE = LEAGUE_ARG?.split("=")[1];
const TARGET_FLAG = REMOTE ? "--remote" : "--local";

// D1 + wrangler has a per-execute statement limit; keep chunks conservative.
const CHUNK_SIZE = 200;

// Detection constants imported from shared steamMoveDetector (STEAM_THRESHOLD, TIMING_ORDER, MARKET_LABELS)

interface MatchRow {
  match_key: string;
  league_id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
}

interface SnapshotRow {
  match_key: string;
  timing: string;
  r2_path: string;
}

function shellEscape(sql: string): string {
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

function nullOrReal(value: number | undefined | null): string {
  return value === undefined || value === null ? "NULL" : String(value);
}

async function fetchSnapshot(
  storage: R2Storage,
  r2Path: string
): Promise<OddsSnapshot | null> {
  try {
    const response = await storage.getClient().send(
      new GetObjectCommand({
        Bucket: storage.getBucketName(),
        Key: r2Path,
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

function detectMoves(
  match: MatchRow,
  snapshots: Record<string, OddsSnapshot>
): UpsertSteamMoveInput[] {
  const moves: UpsertSteamMoveInput[] = [];
  const availableTimings = TIMING_ORDER.filter((t) => snapshots[t]);
  if (availableTimings.length < 2) return moves;

  for (let i = 0; i < availableTimings.length - 1; i++) {
    const fromTiming = availableTimings[i];
    const toTiming = availableTimings[i + 1];
    const fromSnapshot = snapshots[fromTiming];
    const toSnapshot = snapshots[toTiming];
    if (!fromSnapshot || !toSnapshot) continue;

    moves.push(
      ...detectMovePair(
        fromTiming,
        fromSnapshot,
        toTiming,
        toSnapshot,
        match.match_key,
        match.league_id,
        match.kickoff_time,
      ),
    );
  }
  return moves;
}

function buildMoveUpsert(move: UpsertSteamMoveInput): string {
  const pointKey = toPointKey(move.point);
  return `INSERT INTO steam_moves (match_key, market, outcome, point_key, bookmaker, from_timing, to_timing, league_id, kickoff_time, market_label, point, from_odds, to_odds, movement, direction, detected_at) VALUES ('${sqlEscape(move.matchKey)}', '${sqlEscape(move.market)}', '${sqlEscape(move.outcome)}', '${sqlEscape(pointKey)}', '${sqlEscape(move.bookmaker)}', '${sqlEscape(move.fromTiming)}', '${sqlEscape(move.toTiming)}', '${sqlEscape(move.leagueId)}', '${sqlEscape(move.kickoffTime)}', '${sqlEscape(move.marketLabel)}', ${nullOrReal(move.point)}, ${move.fromOdds}, ${move.toOdds}, ${move.movement}, '${move.direction}', CURRENT_TIMESTAMP) ON CONFLICT(match_key, market, outcome, point_key, bookmaker, from_timing, to_timing) DO UPDATE SET league_id=excluded.league_id, kickoff_time=excluded.kickoff_time, market_label=excluded.market_label, point=excluded.point, from_odds=excluded.from_odds, to_odds=excluded.to_odds, movement=excluded.movement, direction=excluded.direction, detected_at=CURRENT_TIMESTAMP;`;
}

function buildProcessedUpsert(matchKey: string): string {
  return `INSERT INTO steam_moves_processed (match_key, processed_at) VALUES ('${sqlEscape(matchKey)}', CURRENT_TIMESTAMP) ON CONFLICT(match_key) DO UPDATE SET processed_at=CURRENT_TIMESTAMP;`;
}

async function main() {
  console.log("=".repeat(60));
  console.log(
    `populateSteamMoves — ${REMOTE ? "REMOTE" : "LOCAL"} ${DRY_RUN ? "(dry run)" : ""}`
  );
  console.log("=".repeat(60));
  console.log(`Season:  ${CURRENT_SEASON}`);
  console.log(`Force:   ${FORCE ? "YES (recompute processed)" : "no (skip processed past matches)"}`);
  if (SPECIFIC_LEAGUE) console.log(`League:  ${SPECIFIC_LEAGUE}`);
  console.log("");

  // R2 creds — needed to fetch snapshot payloads. Same .env as the old script.
  const missing = [];
  if (!process.env.R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!process.env.R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!process.env.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (missing.length > 0) {
    console.error("❌ Missing env vars:", missing.join(", "));
    process.exit(1);
  }

  const storage = new R2Storage({
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucketName: "soccer-predictor",
    basePath: "odds_data_v2",
  });

  const leaguesToProcess = SPECIFIC_LEAGUE
    ? LEAGUES.filter((l) => l.id === SPECIFIC_LEAGUE)
    : LEAGUES;
  if (leaguesToProcess.length === 0) {
    console.error(`❌ League not found: ${SPECIFIC_LEAGUE}`);
    console.error("Available:", LEAGUES.map((l) => l.id).join(", "));
    process.exit(1);
  }

  // Bulk-load matches + snapshots per league in two queries total per league,
  // then index by match_key. Earlier revision issued one D1 query per match
  // for its snapshot paths, which fired N wrangler processes against the
  // Cloudflare API in rapid succession and tripped a rate-limited auth error
  // (code 10000) around ~50 matches in.
  const allMatches: MatchRow[] = [];
  const snapshotsByMatch = new Map<string, SnapshotRow[]>();
  for (const league of leaguesToProcess) {
    const matchRows = queryD1<MatchRow>(
      `SELECT match_key, league_id, home_team, away_team, kickoff_time FROM matches WHERE season = '${sqlEscape(CURRENT_SEASON)}' AND league_id = '${sqlEscape(league.id)}' ORDER BY kickoff_time`
    );
    const snapshotRows = queryD1<SnapshotRow>(
      `SELECT s.match_key, s.timing, s.r2_path FROM snapshots s JOIN matches m ON m.match_key = s.match_key WHERE m.season = '${sqlEscape(CURRENT_SEASON)}' AND m.league_id = '${sqlEscape(league.id)}' ORDER BY s.match_key, s.timing`
    );
    for (const row of snapshotRows) {
      const list = snapshotsByMatch.get(row.match_key);
      if (list) list.push(row);
      else snapshotsByMatch.set(row.match_key, [row]);
    }
    allMatches.push(...matchRows);
    console.log(
      `  ${league.id}: ${matchRows.length} matches, ${snapshotRows.length} snapshot rows`
    );
  }
  console.log(`\nTotal: ${allMatches.length} matches to consider\n`);

  if (allMatches.length === 0) {
    console.log("Nothing to process. Exiting.");
    return;
  }

  // Already-processed set (single query, in-memory lookup cheap enough).
  const processedSet = new Set<string>();
  if (!FORCE) {
    const processedRows = queryD1<{ match_key: string }>(
      `SELECT match_key FROM steam_moves_processed`
    );
    for (const r of processedRows) processedSet.add(r.match_key);
    console.log(`${processedSet.size} match(es) already in steam_moves_processed\n`);
  }

  const now = new Date();
  const statements: string[] = [];
  let processedCount = 0;
  let skippedCount = 0;
  let movesFound = 0;
  let unchangedPastCount = 0;

  for (const match of allMatches) {
    const kickoff = new Date(match.kickoff_time);
    const isPast = kickoff < now;

    if (isPast && !FORCE && processedSet.has(match.match_key)) {
      skippedCount++;
      continue;
    }

    const snapshotRows = snapshotsByMatch.get(match.match_key) ?? [];
    if (snapshotRows.length < 2) {
      // Not enough snapshots to detect a move — still mark past matches
      // processed so we don't keep re-querying them forever.
      if (isPast) {
        unchangedPastCount++;
        if (!DRY_RUN) statements.push(buildProcessedUpsert(match.match_key));
      }
      continue;
    }

    // Fetch snapshot payloads from R2 (parallel within a match).
    const entries = await Promise.all(
      snapshotRows.map(async (row) => {
        const snap = await fetchSnapshot(storage, row.r2_path);
        return [row.timing, snap] as const;
      })
    );
    const snapshots: Record<string, OddsSnapshot> = {};
    for (const [timing, snap] of entries) {
      if (snap) snapshots[timing] = snap;
    }

    const moves = detectMoves(match, snapshots);
    movesFound += moves.length;

    for (const move of moves) statements.push(buildMoveUpsert(move));
    if (isPast) statements.push(buildProcessedUpsert(match.match_key));

    processedCount++;
    if (processedCount % 50 === 0) {
      console.log(`  …processed ${processedCount} matches, ${movesFound} moves so far`);
    }
  }

  console.log("");
  console.log(`Processed:        ${processedCount} match(es)`);
  console.log(`Skipped:          ${skippedCount} already-processed past match(es)`);
  console.log(`Past <2 snaps:    ${unchangedPastCount}`);
  console.log(`Moves detected:   ${movesFound}`);
  console.log(`SQL statements:   ${statements.length}`);

  if (DRY_RUN) {
    console.log("\nDry run — first 3 SQL statements that would execute:");
    statements.slice(0, 3).forEach((s) => console.log(`  ${s.slice(0, 200)}${s.length > 200 ? "…" : ""}`));
    return;
  }

  if (statements.length === 0) {
    console.log("\nNo statements to apply. Done.");
    return;
  }

  const tmp = mkdtempSync(join(tmpdir(), "populate-steam-"));
  const chunkCount = Math.ceil(statements.length / CHUNK_SIZE);
  console.log(`\n📤 Applying in ${chunkCount} chunk(s) of ${CHUNK_SIZE}...`);

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
  const [{ c: moveCount }] = queryD1<{ c: number }>(
    `SELECT COUNT(*) AS c FROM steam_moves`
  );
  const [{ c: processedTotal }] = queryD1<{ c: number }>(
    `SELECT COUNT(*) AS c FROM steam_moves_processed`
  );
  console.log(`  steam_moves rows:           ${moveCount}`);
  console.log(`  steam_moves_processed rows: ${processedTotal}`);
  console.log("\n✅ Done.");
}

main().catch((err) => {
  console.error("\n❌ Failed:", err);
  process.exit(1);
});
