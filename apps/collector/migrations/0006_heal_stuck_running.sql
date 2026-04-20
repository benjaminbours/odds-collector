-- Heal scheduled_jobs rows stuck in status='running'. Root cause: the worker
-- flips a job to 'running' before fetch/save, then on Workers free tier the
-- 10ms CPU budget can kill the isolate before the terminal UPDATE runs, so
-- the row never reaches completed/failed. The per-run healStuckJobs() sweep
-- (added alongside this migration) prevents new rows from accumulating, but
-- the backlog has to be cleared once.
--
-- Safety: every existing 'running' row has last_attempt older than 60 min
-- (confirmed via D1 query 2026-04-20). The cron fires every 5 min, so any
-- legitimately in-flight job would have last_attempt within the last few
-- minutes. The 15-minute cutoff used here is 3x the cron interval and
-- leaves a wide margin over normal execution time.

UPDATE scheduled_jobs
   SET status       = 'failed',
       error        = COALESCE(error, 'timeout: stuck in running, healed by migration 0006'),
       completed_at = CURRENT_TIMESTAMP
 WHERE status       = 'running'
   AND last_attempt < datetime('now', '-15 minutes');
