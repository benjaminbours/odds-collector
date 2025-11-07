/**
 * Main orchestrator for automated odds collection
 *
 * Coordinates event discovery, job scheduling, and execution
 */

import { TheOddsApiProvider } from '../providers/TheOddsApiProvider';
import { R2Storage } from '../storage/R2Storage';
import { JobScheduler } from './JobScheduler';
import {
  LeagueConfig,
  TimingOffset,
  OddsSnapshot,
  CollectionMetrics,
} from '../config/types';
import {
  generateSnapshotPath,
  generateJobId,
  calculateScheduledTime,
  inferSeasonFromDate,
} from '../utils/pathUtils';

export interface OddsCollectorConfig {
  /** Odds provider instance */
  provider: TheOddsApiProvider;

  /** Storage backend instance */
  storage: R2Storage;

  /** Timing offsets to use for collection */
  timings: TimingOffset[];

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
}

export class OddsCollector {
  private provider: TheOddsApiProvider;
  private storage: R2Storage;
  private scheduler: JobScheduler;
  private timings: TimingOffset[];
  private leagues: Map<string, LeagueConfig> = new Map();

  private maxJobsPerRun: number;
  private maxConcurrentRequests: number;
  private requestDelay: number;
  private enableDiscovery: boolean;
  private discoveryDaysAhead: number;

  constructor(config: OddsCollectorConfig) {
    this.provider = config.provider;
    this.storage = config.storage;
    this.timings = config.timings;
    this.scheduler = new JobScheduler({ db: config.db });

    this.maxJobsPerRun = config.maxJobsPerRun ?? 100;
    this.maxConcurrentRequests = config.maxConcurrentRequests ?? 1;
    this.requestDelay = config.requestDelay ?? 1100;
    this.enableDiscovery = config.enableDiscovery ?? true;
    this.discoveryDaysAhead = config.discoveryDaysAhead ?? 14;
  }

  /**
   * Add a league to collect odds for
   */
  addLeague(league: LeagueConfig): void {
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
    console.log('🚀 Odds Collector starting...');
    console.log(`📊 Configured leagues: ${this.leagues.size}`);
    console.log(`⏰ Timing offsets: ${this.timings.map(t => t.name).join(', ')}`);

    const startTime = Date.now();

    // Phase 1: Event Discovery
    if (this.enableDiscovery) {
      console.log('\n📡 Phase 1: Event Discovery');
      await this.discoverEvents();
    } else {
      console.log('\n⏭️  Phase 1: Event Discovery (disabled)');
    }

    // Phase 2: Job Execution
    console.log('\n⚙️  Phase 2: Job Execution');
    await this.executeJobs();

    // Phase 3: Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n📊 Summary:');
    const summary = await this.scheduler.getSummary();
    console.log(`  ✅ Completed jobs: ${summary.totalCompleted}`);
    console.log(`  ⏳ Pending jobs: ${summary.totalPending}`);
    console.log(`  ❌ Failed jobs: ${summary.totalFailed}`);
    console.log(`  ⏱️  Duration: ${duration}s`);

    if (summary.nextJobTime) {
      console.log(`  📅 Next job: ${summary.nextJobTime}`);
    }

    console.log('\n✅ Odds Collector finished!');
  }

  /**
   * Phase 1: Discover upcoming events and schedule collection jobs
   */
  private async discoverEvents(): Promise<void> {
    const now = new Date();
    // const futureDate = new Date(now.getTime() + this.discoveryDaysAhead * 24 * 60 * 60 * 1000);

    // const commenceTimeFrom = now.toISOString();
    // const commenceTimeTo = futureDate.toISOString();

    let totalEventsFound = 0;
    let totalJobsScheduled = 0;

    for (const [leagueId, league] of this.leagues) {
      try {
        console.log(`\n  🔍 Discovering events for ${leagueId}...`);

        const events = await this.provider.fetchEvents(
          league.providerKey,
          // commenceTimeFrom,
          // commenceTimeTo
        );

        console.log(`     Found ${events.length} upcoming events`);
        totalEventsFound += events.length;

        // Schedule jobs for each event at each timing offset
        for (const event of events) {
          const matchDate = event.commenceTime.split('T')[0];

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
              continue;
            }

            const jobId = generateJobId(event.id, timing.name);

            // Check if job already exists
            const existingJob = await this.scheduler.getJob(jobId);
            if (existingJob) {
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
        console.error(`     ❌ Failed to discover events for ${leagueId}:`, error);
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
    const dueJobs = await this.scheduler.getJobsDueWithin(5, this.maxJobsPerRun);

    if (dueJobs.length === 0) {
      console.log('  ℹ️  No jobs due for execution');
      return;
    }

    console.log(`  📥 Found ${dueJobs.length} jobs to execute`);

    const metricsMap: Map<string, CollectionMetrics> = new Map();

    for (const job of dueJobs) {
      try {
        console.log(`\n  ⚙️  Executing: ${job.homeTeam} vs ${job.awayTeam} (${job.timingOffset})`);

        // Mark as running
        await this.scheduler.updateJobStatus(job.id, 'running');

        // Get league config
        const league = this.leagues.get(job.leagueId);
        if (!league) {
          throw new Error(`League config not found: ${job.leagueId}`);
        }

        // Get timing config
        const timing = this.timings.find(t => t.name === job.timingOffset);
        if (!timing) {
          throw new Error(`Timing config not found: ${job.timingOffset}`);
        }

        // Fetch odds from provider
        const oddsData = await this.provider.fetchEventOdds(
          league.providerKey,
          job.eventId,
          timing.markets
        );

        // Create snapshot
        const season = inferSeasonFromDate(job.matchDate);
        const snapshot: OddsSnapshot = {
          metadata: {
            timestamp: new Date().toISOString(),
            date: job.matchDate,
            league: job.leagueId,
            season,
            collectionMethod: 'event_based',
            snapshotTiming: job.timingOffset,
            eventMetadata: {
              eventId: job.eventId,
              kickoffTime: job.kickoffTime,
            },
          },
          odds: oddsData,
        };

        // Save snapshot (storage implementation will handle path generation)
        await this.storage.saveSnapshot(job.leagueId, season, snapshot);

        // Generate path for tracking/logging
        const snapshotPath = generateSnapshotPath(
          job.leagueId,
          season,
          job.timingOffset,
          job.matchDate,
          job.homeTeam,
          job.awayTeam,
          job.eventId
        );

        // Mark as completed
        await this.scheduler.updateJobStatus(job.id, 'completed', snapshotPath);

        console.log(`     ✅ Saved to: ${snapshotPath}`);

        // Update metrics
        const today = new Date().toISOString().split('T')[0];
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
        const marketCount = timing.markets.split(',').length;
        metrics.apiCostTokens += this.provider.estimateCost('live_odds', marketCount, 1);

        // Rate limiting
        await this.delay(this.requestDelay);
      } catch (error) {
        console.error(`     ❌ Failed:`, error instanceof Error ? error.message : error);

        // Mark as failed
        await this.scheduler.updateJobStatus(
          job.id,
          'failed',
          undefined,
          error instanceof Error ? error.message : String(error)
        );

        // Update metrics
        const today = new Date().toISOString().split('T')[0];
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
    console.log(`     Succeeded: ${Array.from(metricsMap.values()).reduce((sum, m) => sum + m.jobsCompleted, 0)}`);
    console.log(`     Failed: ${Array.from(metricsMap.values()).reduce((sum, m) => sum + m.jobsFailed, 0)}`);
    console.log(`     API requests: ${Array.from(metricsMap.values()).reduce((sum, m) => sum + m.apiRequests, 0)}`);
    console.log(`     Estimated cost: ${Array.from(metricsMap.values()).reduce((sum, m) => sum + m.apiCostTokens, 0)} tokens`);
  }

  /**
   * Get collection metrics for a date range
   */
  async getMetrics(startDate: string, endDate: string): Promise<CollectionMetrics[]> {
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
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
