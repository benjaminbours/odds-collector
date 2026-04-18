/**
 * Main orchestrator for automated odds collection
 *
 * Coordinates event discovery, job scheduling, and execution
 */

import { TheOddsApiProvider } from "../providers/TheOddsApiProvider";
import { R2Storage } from "../storage/R2Storage";
import { JobScheduler } from "./JobScheduler";
import { MatchMetadataRepository } from "./MatchMetadataRepository";
import { ValueBetOrchestrator } from "./ValueBetOrchestrator";
import { TimingOffset, OddsSnapshot } from "@odds-collector/shared";
import { CollectionMetrics, CollectorLeagueConfig } from "../config/types";
import {
  generateJobId,
  generateMatchKey,
  calculateScheduledTime,
  inferSeasonFromDate,
} from "../utils/pathUtils";

export interface OddsCollectorConfig {
  /** Odds provider instance */
  provider: TheOddsApiProvider;

  /** Storage backend instance */
  storage: R2Storage;

  /** Timing offsets to use for collection */
  timings: TimingOffset[];

  /** Comma-separated regions passed to the-odds-api event-odds endpoint (e.g. "eu,uk"). Defaults to "eu". */
  regions?: string;

  /** D1 database binding for job scheduling */
  db: D1Database;

  /** Maximum number of jobs to execute per run (default: 100) */
  maxJobsPerRun?: number;

  /** Maximum concurrent API requests (default: 1 for rate limiting) */
  maxConcurrentRequests?: number;

  /** Delay between requests in ms (default: 1100) */
  requestDelay?: number;

  /** Enable auto-discovery of new events (default: true) */
  enableDiscovery?: boolean;

  /** Discovery window: days ahead to look for events (default: 14) */
  discoveryDaysAhead?: number;

  /** Backend URL for value bet detection (optional - enables track record) */
  backendUrl?: string;

  /** Backend API key for value bet detection */
  backendApiKey?: string;

  /** Enable value bet detection at opening timing (default: false) */
  enableValueBetDetection?: boolean;
}

export class OddsCollector {
  private provider: TheOddsApiProvider;
  private storage: R2Storage;
  private scheduler: JobScheduler;
  private matchRepo: MatchMetadataRepository;
  private timings: TimingOffset[];
  private regions: string;
  private regionCount: number;
  private leagues: Map<string, CollectorLeagueConfig> = new Map();

  private maxJobsPerRun: number;
  private maxConcurrentRequests: number;
  private requestDelay: number;
  private enableDiscovery: boolean;
  private discoveryDaysAhead: number;

  // Value bet detection (optional - for track record)
  private valueBetOrchestrator: ValueBetOrchestrator | null = null;
  private enableValueBetDetection: boolean;

  constructor(config: OddsCollectorConfig) {
    this.provider = config.provider;
    this.storage = config.storage;
    this.timings = config.timings;
    this.regions = config.regions ?? "eu";
    this.regionCount = this.regions.split(",").filter(Boolean).length;
    this.scheduler = new JobScheduler({ db: config.db });
    this.matchRepo = new MatchMetadataRepository(config.db);

    this.maxJobsPerRun = config.maxJobsPerRun ?? 100;
    this.maxConcurrentRequests = config.maxConcurrentRequests ?? 1;
    this.requestDelay = config.requestDelay ?? 1100;
    this.enableDiscovery = config.enableDiscovery ?? true;
    this.discoveryDaysAhead = config.discoveryDaysAhead ?? 14;
    this.enableValueBetDetection = config.enableValueBetDetection ?? false;

    // Initialize value bet orchestrator if configured
    if (config.backendUrl && config.backendApiKey && this.enableValueBetDetection) {
      this.valueBetOrchestrator = new ValueBetOrchestrator({
        backendUrl: config.backendUrl,
        backendApiKey: config.backendApiKey,
        db: config.db,
      });
      console.log("✅ Value bet detection enabled");
    }
  }

  /**
   * Add a league to collect odds for
   */
  addLeague(league: CollectorLeagueConfig): void {
    this.leagues.set(league.id, league);
  }

  /**
   * Remove a league from collection
   */
  removeLeague(leagueId: string): void {
    this.leagues.delete(leagueId);
  }

  /**
   * Main execution loop
   *
   * 1. Discover new events (if enabled)
   * 2. Execute scheduled jobs
   * 3. Record metrics
   */
  async run(): Promise<void> {
    console.log("🚀 Odds Collector starting...");
    console.log(`📊 Configured leagues: ${this.leagues.size}`);
    console.log(
      `⏰ Timing offsets: ${this.timings.map((t) => t.name).join(", ")}`
    );

    const startTime = Date.now();

    // Phase 1: Event Discovery
    if (this.enableDiscovery) {
      console.log("\n📡 Phase 1: Event Discovery");
      await this.discoverEvents();
    } else {
      console.log("\n⏭️  Phase 1: Event Discovery (disabled)");
    }

    // Phase 2: Job Execution
    console.log("\n⚙️  Phase 2: Job Execution");
    await this.executeJobs();

    // Phase 3: Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n📊 Summary:");
    const summary = await this.scheduler.getSummary();
    console.log(`  ✅ Completed jobs: ${summary.totalCompleted}`);
    console.log(`  ⏳ Pending jobs: ${summary.totalPending}`);
    console.log(`  ❌ Failed jobs: ${summary.totalFailed}`);
    console.log(`  ⏱️  Duration: ${duration}s`);

    if (summary.nextJobTime) {
      console.log(`  📅 Next job: ${summary.nextJobTime}`);
    }

    console.log("\n✅ Odds Collector finished!");
  }

  /**
   * Phase 1: Discover upcoming events and schedule collection jobs
   */
  private async discoverEvents(): Promise<void> {
    const now = new Date();
    let totalEventsFound = 0;
    let totalJobsScheduled = 0;

    for (const [leagueId, league] of this.leagues) {
      try {
        console.log(`\n  🔍 Discovering events for ${leagueId}...`);

        const events = await this.provider.fetchEvents(league.providerKey);

        console.log(`     Found ${events.length} upcoming events`);
        totalEventsFound += events.length;

        // Schedule jobs for each event at each timing offset
        for (const event of events) {
          const matchDate = event.commenceTime.split("T")[0];

          // Apply team name normalization if provided
          const homeTeam = league.normalizeTeamName
            ? league.normalizeTeamName(event.homeTeam)
            : event.homeTeam;
          const awayTeam = league.normalizeTeamName
            ? league.normalizeTeamName(event.awayTeam)
            : event.awayTeam;

          for (const timing of this.timings) {
            const scheduledTime = calculateScheduledTime(
              event.commenceTime,
              timing.hoursBeforeKickoff
            );

            // Skip if already past the scheduled time
            if (new Date(scheduledTime) < now) {
              console.log("Job past scheduled time, skipped: ", {
                homeTeam,
                awayTeam,
                date: event.commenceTime,
              });
              continue;
            }

            const jobId = generateJobId(event.id, timing.name);

            // Check if job already exists
            const existingJob = await this.scheduler.getJob(jobId);
            if (existingJob) {
              console.log("Job already scheduled:", jobId);
              continue; // Already scheduled
            }

            // Schedule the job
            await this.scheduler.scheduleJob({
              id: jobId,
              leagueId: league.id,
              eventId: event.id,
              homeTeam,
              awayTeam,
              matchDate,
              kickoffTime: event.commenceTime,
              timingOffset: timing.name,
              scheduledTime,
            });

            totalJobsScheduled++;
          }
        }

        // Rate limiting between leagues
        await this.delay(this.requestDelay);
      } catch (error) {
        console.error(
          `     ❌ Failed to discover events for ${leagueId}:`,
          error
        );
      }
    }

    console.log(`\n  📊 Discovery Summary:`);
    console.log(`     Events found: ${totalEventsFound}`);
    console.log(`     Jobs scheduled: ${totalJobsScheduled}`);
  }

  /**
   * Phase 2: Execute scheduled jobs that are due
   */
  private async executeJobs(): Promise<void> {
    // Get jobs due in the next 5 minutes (allows for clock drift)
    const dueJobs = await this.scheduler.getJobsDueWithin(
      5,
      this.maxJobsPerRun
    );

    if (dueJobs.length === 0) {
      console.log("  ℹ️  No jobs due for execution");
      return;
    }

    console.log(`  📥 Found ${dueJobs.length} jobs to execute`);

    const metricsMap: Map<string, CollectionMetrics> = new Map();

    for (const job of dueJobs) {
      try {
        console.log(
          `\n  ⚙️  Executing: ${job.homeTeam} vs ${job.awayTeam} (${job.timingOffset})`
        );

        // Mark as running
        await this.scheduler.updateJobStatus(job.id, "running");

        // Get league config
        const league = this.leagues.get(job.leagueId);
        if (!league) {
          throw new Error(`League config not found: ${job.leagueId}`);
        }

        // Get timing config
        const timing = this.timings.find((t) => t.name === job.timingOffset);
        if (!timing) {
          throw new Error(`Timing config not found: ${job.timingOffset}`);
        }

        // Fetch odds from provider
        const oddsData = await this.provider.fetchEventOdds(
          league.providerKey,
          job.eventId,
          timing.markets,
          this.regions
        );

        // Create snapshot
        const season = inferSeasonFromDate(job.matchDate);
        const snapshot: OddsSnapshot = {
          metadata: {
            timestamp: new Date().toISOString(),
            date: job.matchDate,
            league: job.leagueId,
            season,
            collectionMethod: "event_based",
            snapshotTiming: job.timingOffset,
            eventMetadata: {
              eventId: job.eventId,
              kickoffTime: job.kickoffTime,
            },
          },
          odds: oddsData,
        };

        // Save snapshot (storage implementation will handle path generation)
        const snapshotPath = await this.storage.saveSnapshot(
          job.leagueId,
          season,
          snapshot
        );

        // Mark as completed
        await this.scheduler.updateJobStatus(job.id, "completed", snapshotPath);

        // Persist canonical match metadata (D1). Team names on the job row are
        // already normalized (see discoverEvents), so reuse them directly.
        const matchKey = generateMatchKey(
          job.homeTeam,
          job.awayTeam,
          job.matchDate
        );
        await this.matchRepo.upsertMatch({
          matchKey,
          leagueId: job.leagueId,
          season,
          eventId: job.eventId,
          homeTeam: job.homeTeam,
          awayTeam: job.awayTeam,
          matchDate: job.matchDate,
          kickoffTime: job.kickoffTime,
        });
        await this.matchRepo.upsertSnapshot({
          matchKey,
          timing: job.timingOffset,
          r2Path: snapshotPath,
          collectedAt: snapshot.metadata.timestamp,
        });

        console.log(`     ✅ Saved to: ${snapshotPath}`);

        // Value bet detection/CLV update (if enabled)
        if (this.valueBetOrchestrator) {
          try {
            if (job.timingOffset === "opening") {
              // Detect value bets at opening timing
              await this.valueBetOrchestrator.detectAndStoreValueBets({
                eventId: job.eventId,
                homeTeam: job.homeTeam,
                awayTeam: job.awayTeam,
                matchDate: job.matchDate,
                kickoffTime: job.kickoffTime,
                leagueId: job.leagueId,
                season,
                oddsSnapshot: oddsData,
              });
            } else if (job.timingOffset === "closing") {
              // Update CLV at closing timing
              await this.valueBetOrchestrator.updateClv(job.eventId, oddsData);
            }
          } catch (vbError) {
            // Log but don't fail the job - odds collection succeeded
            console.error(
              `     ⚠️ Value bet processing error:`,
              vbError instanceof Error ? vbError.message : vbError
            );
          }
        }

        // Update metrics
        const today = new Date().toISOString().split("T")[0];
        const metricsKey = `${job.leagueId}_${today}`;

        if (!metricsMap.has(metricsKey)) {
          metricsMap.set(metricsKey, {
            date: today,
            leagueId: job.leagueId,
            jobsScheduled: 0,
            jobsCompleted: 0,
            jobsFailed: 0,
            apiRequests: 0,
            apiCostTokens: 0,
          });
        }

        const metrics = metricsMap.get(metricsKey)!;
        metrics.jobsCompleted++;
        metrics.apiRequests++;

        // Estimate cost
        const marketCount = timing.markets.split(",").length;
        metrics.apiCostTokens += this.provider.estimateCost(
          "live_odds",
          marketCount,
          this.regionCount
        );

        // Rate limiting
        await this.delay(this.requestDelay);
      } catch (error) {
        console.error(
          `     ❌ Failed:`,
          error instanceof Error ? error.message : error
        );

        // Mark as failed
        await this.scheduler.updateJobStatus(
          job.id,
          "failed",
          undefined,
          error instanceof Error ? error.message : String(error)
        );

        // Update metrics
        const today = new Date().toISOString().split("T")[0];
        const metricsKey = `${job.leagueId}_${today}`;

        if (!metricsMap.has(metricsKey)) {
          metricsMap.set(metricsKey, {
            date: today,
            leagueId: job.leagueId,
            jobsScheduled: 0,
            jobsCompleted: 0,
            jobsFailed: 0,
            apiRequests: 0,
            apiCostTokens: 0,
          });
        }

        const metrics = metricsMap.get(metricsKey)!;
        metrics.jobsFailed++;

        // Rate limiting even on errors
        await this.delay(this.requestDelay);
      }
    }

    // Record metrics
    for (const metrics of metricsMap.values()) {
      await this.scheduler.recordMetrics(metrics);
    }

    console.log(`\n  📊 Execution Summary:`);
    console.log(`     Jobs processed: ${dueJobs.length}`);
    console.log(
      `     Succeeded: ${Array.from(metricsMap.values()).reduce((sum, m) => sum + m.jobsCompleted, 0)}`
    );
    console.log(
      `     Failed: ${Array.from(metricsMap.values()).reduce((sum, m) => sum + m.jobsFailed, 0)}`
    );
    console.log(
      `     API requests: ${Array.from(metricsMap.values()).reduce((sum, m) => sum + m.apiRequests, 0)}`
    );
    console.log(
      `     Estimated cost: ${Array.from(metricsMap.values()).reduce((sum, m) => sum + m.apiCostTokens, 0)} tokens`
    );
  }

  /**
   * Get collection metrics for a date range
   */
  async getMetrics(
    startDate: string,
    endDate: string
  ): Promise<CollectionMetrics[]> {
    return await this.scheduler.getMetrics(startDate, endDate);
  }

  /**
   * Get current scheduler summary
   */
  async getSummary() {
    return await this.scheduler.getSummary();
  }

  /**
   * Cleanup old completed jobs
   */
  async cleanup(daysOld: number = 90): Promise<number> {
    return await this.scheduler.cleanupOldJobs(daysOld);
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
