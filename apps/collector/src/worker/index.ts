/**
 * Cloudflare Worker for Automated Live Odds Collection
 *
 * This worker runs on a cron schedule to:
 * 1. Discover upcoming matches daily (6 AM UTC)
 * 2. Execute scheduled odds collection jobs every 15 minutes
 * 3. Store snapshots in Cloudflare R2
 * 4. Build indexes for fast lookups
 *
 * Deployment:
 * 1. Install dependencies: npm install
 * 2. Configure wrangler.toml with your settings
 * 3. Set secrets: wrangler secret put ODDS_API_KEY
 * 4. Deploy: npm run deploy
 */

import { OddsCollector } from "../core/OddsCollector";
import { TheOddsApiProvider } from "../providers/TheOddsApiProvider";
import { R2Storage } from "../storage/R2Storage";
import { TimingPresets } from "../config/timingPresets";
import { IndexBuilder } from "../core/IndexBuilder";
import { AggregateBuilder } from "../core/AggregateBuilder";
import { normalizeTeamName } from "@odds-collector/team-normalization";
import { getLeagueConfig } from "../config/leagues";
import { ValueBetService } from "../core/ValueBetService";
import type { ValueBetStatus, ValueBetOutcome } from "@odds-collector/shared";
import type { CreateValueBetRequest } from "../config/types";

export interface Env {
  // R2 bucket binding
  ODDS_BUCKET: R2Bucket;

  // D1 database binding
  odds_collector_db: D1Database;

  // Environment variables
  ODDS_API_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  LEAGUES: string; // JSON array of league IDs
  TIMING_PRESET: "MINIMAL" | "BASIC" | "STANDARD" | "COMPREHENSIVE";

  // Value bet detection (optional - for track record)
  BACKEND_URL?: string;
  BACKEND_API_KEY?: string;
  ENABLE_VALUE_BET_DETECTION?: string; // "true" or "false"
}

/**
 * Infer current season based on current date
 * Seasons typically start in August/September
 */
function inferCurrentSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed

  // If before August, use previous year as season start
  if (month < 8) {
    return `${year - 1}-${year}`;
  }

  return `${year}-${year + 1}`;
}

/**
 * Main scheduled event handler
 * Runs on cron schedule:
 * - Daily at 6 AM UTC (discovery)
 * - Every 15 minutes (execution)
 */
export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    console.log(
      "Odds collection worker triggered:",
      new Date(event.scheduledTime),
      "Cron:",
      event.cron
    );

    // Determine if this is a discovery run (6 AM) or execution run (every 15 min)
    const isDiscoveryRun = event.cron === "0 6 * * *";

    try {
      // Parse league configuration from environment variable
      const leagueIds = JSON.parse(env.LEAGUES) as string[];
      console.log(`Processing ${leagueIds.length} leagues:`, leagueIds);

      // Initialize collector with R2 storage and D1 database
      const collector = new OddsCollector({
        provider: new TheOddsApiProvider({
          apiKey: env.ODDS_API_KEY,
        }),
        storage: new R2Storage({
          accountId: env.R2_ACCOUNT_ID,
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          bucketName: "soccer-predictor", // Your existing bucket
          basePath: "odds_data_v2", // Path within bucket
        }),
        timings:
          TimingPresets[env.TIMING_PRESET] || TimingPresets.COMPREHENSIVE,
        db: env.odds_collector_db, // Use D1 database binding
        enableDiscovery: isDiscoveryRun, // Only enable discovery on 6 AM run
        // Value bet detection configuration
        backendUrl: env.BACKEND_URL,
        backendApiKey: env.BACKEND_API_KEY,
        enableValueBetDetection: env.ENABLE_VALUE_BET_DETECTION === "true",
      });

      // Add all configured leagues with team name normalization
      for (const leagueId of leagueIds) {
        const leagueConfig = getLeagueConfig(leagueId);
        if (!leagueConfig) {
          console.warn(`League config not found for: ${leagueId}`);
          continue;
        }

        const season = inferCurrentSeason();
        collector.addLeague({
          id: leagueConfig.id,
          providerKey: leagueConfig.oddsApiKey,
          season,
          // Use footdata's team name normalization
          normalizeTeamName: (teamName: string) =>
            normalizeTeamName(leagueId, teamName),
        });
      }

      // Run collection (discovery + execution)
      await collector.run();

      // Build indexes for all leagues
      const scheduler = collector["scheduler"];

      for (const leagueId of leagueIds) {
        // Create IndexBuilder with leagueId for proper team name normalization
        const indexBuilder = new IndexBuilder({
          storage: collector["storage"],
          leagueId,
        });
        const season = inferCurrentSeason();
        try {
          // Step 1: Get completed jobs for this league
          const completedJobs = await scheduler.getCompletedJobs(leagueId);

          if (completedJobs.length > 0) {
            console.log(
              `📇 Building match index from ${completedJobs.length} completed jobs for ${leagueId}/${season}...`
            );

            // Step 2: Transform jobs into snapshot metadata for index building
            const snapshotsMetadata = completedJobs.map((job) => {
              return {
                homeTeam: job.homeTeam,
                awayTeam: job.awayTeam,
                matchDate: job.matchDate,
                eventId: job.eventId,
                timing: job.timingOffset,
                path: job.snapshotPath!,
                kickoffTime: job.kickoffTime,
              };
            });

            // Step 3: Update match index with all completed snapshots
            await indexBuilder.updateMatchIndex(
              leagueId,
              season,
              snapshotsMetadata
            );
          }

          // Step 4: Build derived indexes (date, team)
          await indexBuilder.buildAllIndexes(leagueId, season);
          console.log(`✅ Indexes built for ${leagueId}/${season}`);
        } catch (error) {
          console.error(`Failed to build indexes for ${leagueId}:`, error);
          // Continue with other leagues even if one fails
        }
      }

      // Phase 4: Build homepage aggregate for dashboard
      // Note: Steam moves are built separately via local script (generate-steam-moves-cache.ts)
      // to avoid hitting Cloudflare's 50 subrequest limit
      console.log("\n📊 Phase 4: Building Homepage Aggregate");
      const aggregateBuilder = new AggregateBuilder({
        storage: new R2Storage({
          accountId: env.R2_ACCOUNT_ID,
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          bucketName: "soccer-predictor",
          basePath: "odds_data_v2",
        }),
      });

      const season = inferCurrentSeason();

      // Build homepage aggregate (reads pre-computed steam_moves.json files)
      try {
        await aggregateBuilder.buildHomepageData(season);
      } catch (error) {
        console.error("Failed to build homepage data:", error);
      }

      console.log("Odds collection completed successfully");
    } catch (error) {
      console.error("Odds collection failed:", error);
      throw error; // Let Cloudflare retry on failure
    }
  },

  /**
   * HTTP handler for manual triggers and status checks
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // CORS configuration
    const allowedOrigins = [
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      "https://app.oddslab.gg",
      "https://oddslab.gg",
    ];

    const origin = request.headers.get("Origin") || "";
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Internal-Key",
      "Access-Control-Max-Age": "86400",
    };

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Helper to add CORS headers to responses
    const withCors = (response: Response): Response => {
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    };

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          timestamp: new Date().toISOString(),
          leagues: JSON.parse(env.LEAGUES),
          timingPreset: env.TIMING_PRESET,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Manual trigger endpoint (requires auth)
    if (url.pathname === "/trigger" && request.method === "POST") {
      const authHeader = request.headers.get("Authorization");
      if (authHeader !== `Bearer ${env.ODDS_API_KEY}`) {
        return new Response("Unauthorized", { status: 401 });
      }

      // Trigger collection in background
      ctx.waitUntil(
        this.scheduled(
          { scheduledTime: Date.now(), cron: "manual" } as ScheduledEvent,
          env,
          ctx
        )
      );

      return new Response(
        JSON.stringify({
          message: "Collection triggered",
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Dashboard endpoint - comprehensive view of worker status
    if (url.pathname === "/dashboard" || url.pathname === "/") {
      try {
        const leagueIds = JSON.parse(env.LEAGUES) as string[];
        const season = inferCurrentSeason();
        const now = new Date();

        // Calculate next cron runs
        const nextDiscoveryRun = new Date(now);
        nextDiscoveryRun.setUTCHours(6, 0, 0, 0);
        if (nextDiscoveryRun <= now) {
          nextDiscoveryRun.setUTCDate(nextDiscoveryRun.getUTCDate() + 1);
        }

        const nextExecutionRun = new Date(now);
        const currentMinute = now.getUTCMinutes();
        const nextMinute = Math.ceil((currentMinute + 1) / 15) * 15;
        if (nextMinute >= 60) {
          nextExecutionRun.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
        } else {
          nextExecutionRun.setUTCMinutes(nextMinute, 0, 0);
        }

        const storage = new R2Storage({
          accountId: env.R2_ACCOUNT_ID,
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          bucketName: "soccer-predictor",
          basePath: "odds_data_v2",
        });

        // Get job statistics from D1
        const jobStats = await env.odds_collector_db
          .prepare(
            `
          SELECT
            status,
            COUNT(*) as count
          FROM scheduled_jobs
          GROUP BY status
        `
          )
          .all();

        const jobsByStatus: Record<string, number> = {};
        jobStats.results.forEach((row: any) => {
          jobsByStatus[row.status] = row.count;
        });

        // Get recent jobs (last 20)
        const recentJobs = await env.odds_collector_db
          .prepare(
            `
          SELECT
            id,
            league_id,
            home_team,
            away_team,
            match_date,
            timing_offset,
            scheduled_time,
            status,
            attempts,
            error,
            created_at,
            completed_at
          FROM scheduled_jobs
          ORDER BY created_at DESC
          LIMIT 20
        `
          )
          .all();

        // Get next upcoming jobs
        const upcomingJobs = await env.odds_collector_db
          .prepare(
            `
          SELECT
            id,
            league_id,
            home_team,
            away_team,
            match_date,
            timing_offset,
            scheduled_time,
            status,
            attempts
          FROM scheduled_jobs
          WHERE status = 'pending' AND scheduled_time > datetime('now')
          ORDER BY scheduled_time ASC
          LIMIT 10
        `
          )
          .all();

        // Collect league statistics
        const leagueStats = [];
        let totalSnapshots = 0;
        let totalEvents = 0;

        for (const leagueId of leagueIds) {
          const leagueConfig = getLeagueConfig(leagueId);
          try {
            const snapshots = await storage.listSnapshots(leagueId, season);
            totalSnapshots += snapshots.length;

            // Get recent snapshots (last 5)
            const recentSnapshots = snapshots.slice(-5).reverse();

            // Try to get upcoming events from match index
            let upcomingEvents: any[] = [];
            const matchIndex = await storage.getIndex(
              leagueId,
              season,
              "by_match"
            );
            if (matchIndex?.matches) {
              const matches = Object.values(matchIndex.matches);
              const futureMatches = matches
                .filter((m) => new Date(m.kickoffTime) > now)
                .sort(
                  (a, b) =>
                    new Date(a.kickoffTime).getTime() -
                    new Date(b.kickoffTime).getTime()
                )
                .slice(0, 5);

              upcomingEvents = futureMatches.map((m) => ({
                home: m.homeTeam,
                away: m.awayTeam,
                commence_time: m.kickoffTime,
                snapshot_count: Object.keys(m.snapshots).length,
              }));

              totalEvents += matches.filter(
                (m) => new Date(m.kickoffTime) > now
              ).length;
            }

            leagueStats.push({
              id: leagueId,
              name: leagueConfig?.name || leagueId,
              season,
              snapshotCount: snapshots.length,
              recentSnapshots: recentSnapshots.map((id) => ({
                id,
                timestamp: id.split("_")[0], // Assuming format: YYYYMMDDTHHMMSS_type
              })),
              upcomingEvents,
              latestSnapshot:
                snapshots.length > 0 ? snapshots[snapshots.length - 1] : null,
            });
          } catch (error) {
            leagueStats.push({
              id: leagueId,
              name: leagueConfig?.name || leagueId,
              error: (error as Error).message,
            });
          }
        }

        const dashboard = {
          status: "operational",
          timestamp: now.toISOString(),
          season,
          configuration: {
            timingPreset: env.TIMING_PRESET,
            activeLeagues: leagueIds.length,
            leagues: leagueIds,
          },
          schedule: {
            discoveryJob: {
              cron: "0 6 * * *",
              description: "Daily discovery - Find upcoming matches",
              nextRun: nextDiscoveryRun.toISOString(),
              frequency: "Daily at 6:00 AM UTC",
            },
            executionJob: {
              cron: "*/15 * * * *",
              description: "Execute collection jobs every 15 minutes",
              nextRun: nextExecutionRun.toISOString(),
              frequency: "Every 15 minutes",
            },
          },
          statistics: {
            totalSnapshots,
            totalUpcomingEvents: totalEvents,
            activeLeagues: leagueIds.length,
          },
          jobs: {
            summary: {
              pending: jobsByStatus["pending"] || 0,
              running: jobsByStatus["running"] || 0,
              completed: jobsByStatus["completed"] || 0,
              failed: jobsByStatus["failed"] || 0,
              total: Object.values(jobsByStatus).reduce(
                (a: number, b: number) => a + b,
                0
              ),
            },
            recent: recentJobs.results,
            upcoming: upcomingJobs.results,
          },
          leagues: leagueStats,
        };

        // Check if client wants HTML response
        const acceptHeader = request.headers.get("Accept") || "";
        if (acceptHeader.includes("text/html")) {
          return new Response(generateDashboardHTML(dashboard), {
            headers: { "Content-Type": "text/html" },
          });
        }

        return new Response(JSON.stringify(dashboard, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: "Failed to fetch dashboard data",
            message: (error as Error).message,
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Status endpoint - simple JSON status (legacy, redirects to dashboard)
    if (url.pathname === "/status") {
      return Response.redirect(new URL("/dashboard", url).toString(), 302);
    }

    // Download specific snapshot endpoint
    if (url.pathname.startsWith("/download/")) {
      // Path format: /download/{league}/{season}/{snapshotId}
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length !== 4) {
        return new Response(
          "Invalid path format. Use: /download/{league}/{season}/{snapshotId}",
          {
            status: 400,
          }
        );
      }

      const [, leagueId, season, snapshotId] = parts;

      try {
        const storage = new R2Storage({
          accountId: env.R2_ACCOUNT_ID,
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          bucketName: "soccer-predictor",
          basePath: "odds_data",
        });

        const snapshot = await storage.getSnapshot(
          leagueId,
          season,
          snapshotId
        );

        if (!snapshot) {
          return new Response("Snapshot not found", { status: 404 });
        }

        return new Response(JSON.stringify(snapshot, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${leagueId}_${snapshotId}.json"`,
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: "Failed to download snapshot",
            message: (error as Error).message,
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // ===========================================
    // Value Bet Track Record API
    // ===========================================

    // GET /api/track-record - Get track record statistics
    if (url.pathname === "/api/track-record" && request.method === "GET") {
      try {
        const modelId = url.searchParams.get("model_id") || "oddslab_default";
        const valueBetService = new ValueBetService({ db: env.odds_collector_db });
        const trackRecord = await valueBetService.getTrackRecord(modelId);

        return withCors(new Response(JSON.stringify(trackRecord), {
          headers: { "Content-Type": "application/json" },
        }));
      } catch (error) {
        return withCors(new Response(
          JSON.stringify({ error: "Failed to get track record", message: (error as Error).message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ));
      }
    }

    // GET /api/value-bets - List value bets with optional filters
    if (url.pathname === "/api/value-bets" && request.method === "GET") {
      try {
        const status = url.searchParams.get("status") as ValueBetStatus | null;
        const leagueId = url.searchParams.get("league_id");
        const modelId = url.searchParams.get("model_id");
        const limit = parseInt(url.searchParams.get("limit") || "20", 10);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);

        const valueBetService = new ValueBetService({ db: env.odds_collector_db });
        const result = await valueBetService.listValueBets({
          status: status || undefined,
          leagueId: leagueId || undefined,
          modelId: modelId || undefined,
          limit,
          offset,
        });

        return withCors(new Response(
          JSON.stringify({
            valueBets: result.valueBets,
            pagination: {
              total: result.total,
              limit,
              offset,
              hasMore: offset + result.valueBets.length < result.total,
            },
          }),
          { headers: { "Content-Type": "application/json" } }
        ));
      } catch (error) {
        return withCors(new Response(
          JSON.stringify({ error: "Failed to list value bets", message: (error as Error).message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ));
      }
    }

    // GET /api/value-bets/:id - Get single value bet
    if (url.pathname.match(/^\/api\/value-bets\/[^/]+$/) && request.method === "GET") {
      try {
        const id = url.pathname.split("/").pop()!;
        const valueBetService = new ValueBetService({ db: env.odds_collector_db });
        const valueBet = await valueBetService.getValueBetById(id);

        if (!valueBet) {
          return withCors(new Response(JSON.stringify({ error: "Value bet not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }));
        }

        return withCors(new Response(JSON.stringify(valueBet), {
          headers: { "Content-Type": "application/json" },
        }));
      } catch (error) {
        return withCors(new Response(
          JSON.stringify({ error: "Failed to get value bet", message: (error as Error).message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ));
      }
    }

    // POST /api/value-bets - Create value bet (called by backend after detection)
    if (url.pathname === "/api/value-bets" && request.method === "POST") {
      // Verify internal API key
      const authHeader = request.headers.get("X-Internal-Key");
      if (authHeader !== env.ODDS_API_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const body = await request.json() as {
          modelId: string;
          eventId: string;
          matchId?: string;
          leagueId: string;
          season: string;
          homeTeam: string;
          awayTeam: string;
          matchDate: string;
          kickoffTime: string;
          valueBet: CreateValueBetRequest;
        };

        const valueBetService = new ValueBetService({ db: env.odds_collector_db });
        const created = await valueBetService.createValueBet(body);

        return new Response(JSON.stringify(created), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Failed to create value bet", message: (error as Error).message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // PATCH /api/value-bets/:id/clv - Update CLV (called internally after closing odds)
    if (url.pathname.match(/^\/api\/value-bets\/[^/]+\/clv$/) && request.method === "PATCH") {
      const authHeader = request.headers.get("X-Internal-Key");
      if (authHeader !== env.ODDS_API_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const parts = url.pathname.split("/");
        const id = parts[parts.length - 2];
        const body = await request.json() as {
          closingOdds: number;
          closingImpliedProb: number;
          clv: number;
        };

        const valueBetService = new ValueBetService({ db: env.odds_collector_db });
        await valueBetService.updateClv(id, body);

        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Failed to update CLV", message: (error as Error).message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // PATCH /api/value-bets/:id/outcome - Update outcome (called by backend after match)
    if (url.pathname.match(/^\/api\/value-bets\/[^/]+\/outcome$/) && request.method === "PATCH") {
      const authHeader = request.headers.get("X-Internal-Key");
      if (authHeader !== env.ODDS_API_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const parts = url.pathname.split("/");
        const id = parts[parts.length - 2];
        const body = await request.json() as {
          actualOutcome: ValueBetOutcome;
          betWon: boolean;
          profitFlat: number;
          profitKelly: number;
        };

        const valueBetService = new ValueBetService({ db: env.odds_collector_db });
        await valueBetService.updateOutcome(id, body);

        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Failed to update outcome", message: (error as Error).message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // PATCH /api/value-bets/:id/posted - Mark as posted to Twitter
    if (url.pathname.match(/^\/api\/value-bets\/[^/]+\/posted$/) && request.method === "PATCH") {
      const authHeader = request.headers.get("X-Internal-Key");
      if (authHeader !== env.ODDS_API_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const parts = url.pathname.split("/");
        const id = parts[parts.length - 2];

        const valueBetService = new ValueBetService({ db: env.odds_collector_db });
        await valueBetService.markAsPosted(id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Failed to mark as posted", message: (error as Error).message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      "Not Found\n\nAvailable endpoints:\n" +
      "- GET / or /dashboard (HTML or JSON based on Accept header)\n" +
      "- GET /health\n" +
      "- POST /trigger (requires auth)\n" +
      "- GET /status (redirects to /dashboard)\n" +
      "- GET /download/{league}/{season}/{snapshotId}\n" +
      "- GET /api/track-record\n" +
      "- GET /api/value-bets\n" +
      "- GET /api/value-bets/:id\n" +
      "- POST /api/value-bets (internal)\n" +
      "- PATCH /api/value-bets/:id/clv (internal)\n" +
      "- PATCH /api/value-bets/:id/outcome (internal)\n" +
      "- PATCH /api/value-bets/:id/posted (internal)",
      {
        status: 404,
      }
    );
  },
};

/**
 * Generate HTML dashboard view
 */
function generateDashboardHTML(dashboard: any): string {
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      dateStyle: "short",
      timeStyle: "short",
      hour12: false,
    });
  };

  const formatTimeUntil = (isoString: string) => {
    const target = new Date(isoString);
    const now = new Date(dashboard.timestamp);
    const diff = target.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const statusColor =
    dashboard.status === "operational" ? "#10b981" : "#ef4444";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Odds Collection Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #1f2937;
      padding: 2rem;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      color: #111827;
    }
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
      background: ${statusColor};
      color: white;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .stat-card h3 {
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .stat-card .value {
      font-size: 2rem;
      font-weight: 700;
      color: #111827;
    }
    .section {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .section h2 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: #111827;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 0.5rem;
    }
    .schedule-item {
      background: #f9fafb;
      border-left: 4px solid #667eea;
      padding: 1rem;
      margin-bottom: 1rem;
      border-radius: 4px;
    }
    .schedule-item h4 {
      font-size: 1rem;
      margin-bottom: 0.5rem;
      color: #111827;
    }
    .schedule-item .cron {
      font-family: 'Courier New', monospace;
      background: #e5e7eb;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.875rem;
    }
    .schedule-item .next-run {
      color: #6b7280;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
    .league-card {
      background: #f9fafb;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border: 1px solid #e5e7eb;
    }
    .league-card h3 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      color: #111827;
    }
    .league-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .league-stat {
      background: white;
      padding: 0.75rem;
      border-radius: 4px;
    }
    .league-stat .label {
      font-size: 0.75rem;
      color: #6b7280;
      text-transform: uppercase;
    }
    .league-stat .value {
      font-size: 1.5rem;
      font-weight: 600;
      color: #111827;
    }
    .event-list {
      margin-top: 1rem;
    }
    .event-item {
      background: white;
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      border-radius: 4px;
      border-left: 3px solid #667eea;
    }
    .event-item .teams {
      font-weight: 600;
      color: #111827;
    }
    .event-item .time {
      font-size: 0.875rem;
      color: #6b7280;
    }
    .error {
      color: #ef4444;
      background: #fee;
      padding: 1rem;
      border-radius: 4px;
      border-left: 4px solid #ef4444;
    }
    .footer {
      text-align: center;
      color: white;
      margin-top: 2rem;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚽ Odds Collection Dashboard</h1>
      <p style="color: #6b7280; margin-top: 0.5rem;">
        <span class="status-badge">${dashboard.status.toUpperCase()}</span>
        <span style="margin-left: 1rem;">Season: ${dashboard.season}</span>
        <span style="margin-left: 1rem;">Updated: ${formatDate(dashboard.timestamp)}</span>
      </p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Snapshots</h3>
        <div class="value">${dashboard.statistics.totalSnapshots}</div>
      </div>
      <div class="stat-card">
        <h3>Upcoming Events</h3>
        <div class="value">${dashboard.statistics.totalUpcomingEvents}</div>
      </div>
      <div class="stat-card">
        <h3>Active Leagues</h3>
        <div class="value">${dashboard.statistics.activeLeagues}</div>
      </div>
      <div class="stat-card">
        <h3>Timing Preset</h3>
        <div class="value" style="font-size: 1.25rem;">${dashboard.configuration.timingPreset}</div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <h3>⏳ Pending Jobs</h3>
        <div class="value">${dashboard.jobs.summary.pending}</div>
      </div>
      <div class="stat-card">
        <h3>✅ Completed Jobs</h3>
        <div class="value">${dashboard.jobs.summary.completed}</div>
      </div>
      <div class="stat-card">
        <h3>❌ Failed Jobs</h3>
        <div class="value">${dashboard.jobs.summary.failed}</div>
      </div>
      <div class="stat-card">
        <h3>📊 Total Jobs</h3>
        <div class="value">${dashboard.jobs.summary.total}</div>
      </div>
    </div>

    <div class="section">
      <h2>📅 Cron Schedule</h2>
      <div class="schedule-item">
        <h4>🔍 ${dashboard.schedule.discoveryJob.description}</h4>
        <p><span class="cron">${dashboard.schedule.discoveryJob.cron}</span> - ${dashboard.schedule.discoveryJob.frequency}</p>
        <p class="next-run">Next run: ${formatDate(dashboard.schedule.discoveryJob.nextRun)} (in ${formatTimeUntil(dashboard.schedule.discoveryJob.nextRun)})</p>
      </div>
      <div class="schedule-item">
        <h4>⚡ ${dashboard.schedule.executionJob.description}</h4>
        <p><span class="cron">${dashboard.schedule.executionJob.cron}</span> - ${dashboard.schedule.executionJob.frequency}</p>
        <p class="next-run">Next run: ${formatDate(dashboard.schedule.executionJob.nextRun)} (in ${formatTimeUntil(dashboard.schedule.executionJob.nextRun)})</p>
      </div>
    </div>

    <div class="section">
      <h2>🔜 Upcoming Jobs (Next 10)</h2>
      ${
        dashboard.jobs.upcoming.length > 0
          ? `
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #e5e7eb; text-align: left;">
              <th style="padding: 0.75rem;">Match</th>
              <th style="padding: 0.75rem;">League</th>
              <th style="padding: 0.75rem;">Timing</th>
              <th style="padding: 0.75rem;">Scheduled</th>
              <th style="padding: 0.75rem;">Attempts</th>
            </tr>
          </thead>
          <tbody>
            ${dashboard.jobs.upcoming
              .map(
                (job: any) => `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 0.75rem; font-weight: 600;">${job.home_team} vs ${job.away_team}</td>
                <td style="padding: 0.75rem;">${job.league_id}</td>
                <td style="padding: 0.75rem;"><span style="background: #dbeafe; color: #1e40af; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${job.timing_offset}</span></td>
                <td style="padding: 0.75rem;">${formatDate(job.scheduled_time)}</td>
                <td style="padding: 0.75rem;">${job.attempts}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      `
          : '<p style="color: #6b7280;">No upcoming jobs scheduled</p>'
      }
    </div>

    <div class="section">
      <h2>📋 Recent Jobs (Last 20)</h2>
      ${
        dashboard.jobs.recent.length > 0
          ? `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
          <thead>
            <tr style="border-bottom: 2px solid #e5e7eb; text-align: left;">
              <th style="padding: 0.75rem;">Match</th>
              <th style="padding: 0.75rem;">League</th>
              <th style="padding: 0.75rem;">Timing</th>
              <th style="padding: 0.75rem;">Status</th>
              <th style="padding: 0.75rem;">Created</th>
              <th style="padding: 0.75rem;">Completed</th>
            </tr>
          </thead>
          <tbody>
            ${dashboard.jobs.recent
              .map((job: any) => {
                const statusColors: Record<string, string> = {
                  pending: "background: #fef3c7; color: #92400e;",
                  running: "background: #dbeafe; color: #1e40af;",
                  completed: "background: #d1fae5; color: #065f46;",
                  failed: "background: #fee2e2; color: #991b1b;",
                };
                return `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 0.75rem;">${job.home_team} vs ${job.away_team}</td>
                <td style="padding: 0.75rem;">${job.league_id}</td>
                <td style="padding: 0.75rem;"><span style="background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${job.timing_offset}</span></td>
                <td style="padding: 0.75rem;"><span style="${statusColors[job.status]}; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; text-transform: uppercase;">${job.status}</span></td>
                <td style="padding: 0.75rem;">${formatDate(job.created_at)}</td>
                <td style="padding: 0.75rem;">${job.completed_at ? formatDate(job.completed_at) : "-"}</td>
              </tr>
              ${
                job.error
                  ? `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td colspan="6" style="padding: 0.5rem 0.75rem; background: #fef2f2; color: #991b1b; font-size: 0.75rem;">
                  <strong>Error:</strong> ${job.error}
                </td>
              </tr>
              `
                  : ""
              }
            `;
              })
              .join("")}
          </tbody>
        </table>
      `
          : '<p style="color: #6b7280;">No recent jobs</p>'
      }
    </div>

    <div class="section">
      <h2>🏆 League Status</h2>
      ${dashboard.leagues
        .map((league: any) => {
          if (league.error) {
            return `
            <div class="league-card">
              <h3>${league.name}</h3>
              <div class="error">
                <strong>Error:</strong> ${league.error}
              </div>
            </div>
          `;
          }
          return `
          <div class="league-card">
            <h3>${league.name}</h3>
            <div class="league-stats">
              <div class="league-stat">
                <div class="label">Snapshots</div>
                <div class="value">${league.snapshotCount}</div>
              </div>
              <div class="league-stat">
                <div class="label">Upcoming Events</div>
                <div class="value">${league.upcomingEvents.length}</div>
              </div>
            </div>
            ${
              league.upcomingEvents.length > 0
                ? `
              <h4 style="margin-top: 1rem; margin-bottom: 0.5rem; color: #6b7280;">Next Matches:</h4>
              <div class="event-list">
                ${league.upcomingEvents
                  .map(
                    (event: any) => `
                  <div class="event-item">
                    <div class="teams">${event.home} vs ${event.away}</div>
                    <div class="time">${formatDate(event.commence_time)} • ${event.snapshot_count} snapshots</div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            `
                : '<p style="color: #6b7280; margin-top: 1rem;">No upcoming events</p>'
            }
          </div>
        `;
        })
        .join("")}
    </div>

    <div class="footer">
      <p>FootData Odds Collector • <a href="/dashboard" style="color: white;">JSON View</a></p>
    </div>
  </div>
</body>
</html>`;
}
