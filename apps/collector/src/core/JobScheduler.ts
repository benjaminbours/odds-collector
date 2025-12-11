/**
 * Job scheduler with D1 persistence
 *
 * Manages scheduled odds collection jobs with retry logic
 */

import { ScheduledJob, CollectionMetrics } from "../config/types";

export interface JobSchedulerConfig {
  /** D1 database binding */
  db: D1Database;
}

export class JobScheduler {
  private db: D1Database;

  constructor(config: JobSchedulerConfig) {
    this.db = config.db;
  }

  /**
   * Schedule a new job
   */
  async scheduleJob(
    job: Omit<ScheduledJob, "attempts" | "status" | "createdAt">
  ): Promise<void> {
    await this.db
      .prepare(
        `
      INSERT INTO scheduled_jobs (
        id, league_id, event_id, home_team, away_team, match_date,
        kickoff_time, timing_offset, scheduled_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
      )
      .bind(
        job.id,
        job.leagueId,
        job.eventId,
        job.homeTeam,
        job.awayTeam,
        job.matchDate,
        job.kickoffTime,
        job.timingOffset,
        job.scheduledTime
      )
      .run();
  }

  /**
   * Get jobs that are due for execution
   */
  async getDueJobs(maxJobs: number = 100): Promise<ScheduledJob[]> {
    const result = await this.db
      .prepare(
        `
      SELECT * FROM scheduled_jobs
      WHERE status = 'pending'
        AND scheduled_time <= datetime('now')
      ORDER BY scheduled_time ASC
      LIMIT ?
    `
      )
      .bind(maxJobs)
      .all();

    return result.results.map(this.mapRowToJob);
  }

  /**
   * Get jobs due within a time window
   */
  async getJobsDueWithin(
    minutes: number,
    maxJobs: number = 100
  ): Promise<ScheduledJob[]> {
    const result = await this.db
      .prepare(
        `
      SELECT * FROM scheduled_jobs
      WHERE status = 'pending'
        AND datetime(scheduled_time) <= datetime('now', '+' || ? || ' minutes')
      ORDER BY scheduled_time ASC
      LIMIT ?
    `
      )
      .bind(minutes, maxJobs)
      .all();

    return result.results.map(this.mapRowToJob);
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: "running" | "completed" | "failed",
    snapshotPath?: string,
    error?: string
  ): Promise<void> {
    await this.db
      .prepare(
        `
      UPDATE scheduled_jobs
      SET status = ?,
          attempts = attempts + 1,
          last_attempt = CURRENT_TIMESTAMP,
          snapshot_path = COALESCE(?, snapshot_path),
          error = ?,
          completed_at = CASE WHEN ? IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END
      WHERE id = ?
    `
      )
      .bind(status, snapshotPath || null, error || null, status, jobId)
      .run();
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string, newScheduledTime: string): Promise<void> {
    await this.db
      .prepare(
        `
      UPDATE scheduled_jobs
      SET status = 'pending',
          scheduled_time = ?,
          error = NULL
      WHERE id = ?
    `
      )
      .bind(newScheduledTime, jobId)
      .run();
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<ScheduledJob | null> {
    const result = await this.db
      .prepare(
        `
      SELECT * FROM scheduled_jobs
      WHERE id = ?
    `
      )
      .bind(jobId)
      .first();

    return result ? this.mapRowToJob(result) : null;
  }

  /**
   * Get jobs for a specific event and timing
   */
  async getJobsForEvent(
    eventId: string,
    timingOffset?: string
  ): Promise<ScheduledJob[]> {
    let query = `SELECT * FROM scheduled_jobs WHERE event_id = ?`;
    const params: any[] = [eventId];

    if (timingOffset) {
      query += ` AND timing_offset = ?`;
      params.push(timingOffset);
    }

    const stmt = this.db.prepare(query);
    const result = await stmt.bind(...params).all();
    return result.results.map(this.mapRowToJob);
  }

  /**
   * Record metrics for a collection run
   */
  async recordMetrics(metrics: Omit<CollectionMetrics, "id">): Promise<void> {
    await this.db
      .prepare(
        `
      INSERT INTO collection_metrics (
        date, league_id, jobs_scheduled, jobs_completed, jobs_failed,
        api_requests, api_cost_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
      )
      .bind(
        metrics.date,
        metrics.leagueId,
        metrics.jobsScheduled,
        metrics.jobsCompleted,
        metrics.jobsFailed,
        metrics.apiRequests,
        metrics.apiCostTokens
      )
      .run();
  }

  /**
   * Get metrics for a date range
   */
  async getMetrics(
    startDate: string,
    endDate: string
  ): Promise<CollectionMetrics[]> {
    const result = await this.db
      .prepare(
        `
      SELECT * FROM collection_metrics
      WHERE date >= ? AND date <= ?
      ORDER BY date DESC
    `
      )
      .bind(startDate, endDate)
      .all<CollectionMetrics>();

    return result.results;
  }

  /**
   * Get summary statistics
   */
  async getSummary(): Promise<{
    totalPending: number;
    totalCompleted: number;
    totalFailed: number;
    nextJobTime: string | null;
  }> {
    const stats = (await this.db
      .prepare(
        `
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as total_pending,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as total_completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        MIN(CASE WHEN status = 'pending' THEN scheduled_time ELSE NULL END) as next_job_time
      FROM scheduled_jobs
    `
      )
      .first()) as any;

    return {
      totalPending: stats.total_pending || 0,
      totalCompleted: stats.total_completed || 0,
      totalFailed: stats.total_failed || 0,
      nextJobTime: stats.next_job_time,
    };
  }

  // Get completed jobs for index building
  async getCompletedJobs(leagueId: string): Promise<ScheduledJob[]> {
    const result = await this.db
      .prepare(
        `
          SELECT * FROM scheduled_jobs
          WHERE league_id = ? AND status = 'completed' AND snapshot_path IS NOT NULL
          ORDER BY completed_at DESC
        `
      )
      .bind(leagueId)
      .all();

    return result.results.map(this.mapRowToJob);
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(daysOld: number = 90): Promise<number> {
    const result = await this.db
      .prepare(
        `
      DELETE FROM scheduled_jobs
      WHERE status IN ('completed', 'failed')
        AND completed_at < datetime('now', '-' || ? || ' days')
    `
      )
      .bind(daysOld)
      .run();

    return result.meta.changes;
  }

  /**
   * Map database row to ScheduledJob object
   */
  private mapRowToJob(row: any): ScheduledJob {
    return {
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
    };
  }
}
