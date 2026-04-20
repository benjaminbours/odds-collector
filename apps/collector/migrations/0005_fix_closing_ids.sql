-- Fix fallout from 0004 running as its initial version (timing_offset rewrite
-- only, no id rewrite). After that ran, every pre-existing closing row ended
-- up with id='{eid}_closing' but timing_offset='t_minus_90m'. The first
-- post-deploy discovery then inserted duplicate {eid}_t_minus_90m pending
-- rows and skipped new {eid}_closing (T-10m) rows because the old misnamed
-- id still existed in the dedupe lookup.
--
-- Cleanup has to run delete-first, rename-second. Rewriting historical ids
-- before dropping the pending duplicates would collide on the PK.

-- 1. Drop pending duplicates. The canonical {eid}_t_minus_90m rows that
--    discovery inserted today already cover these kickoffs.
DELETE FROM scheduled_jobs
 WHERE id LIKE '%_closing'
   AND timing_offset = 't_minus_90m'
   AND status = 'pending';

-- 2. Rename id on historical rows (completed / failed / running) so the
--    {eventId}_{timing} convention holds across the table. No PK conflict:
--    new {eid}_t_minus_90m rows from today's discovery are all pending and
--    were removed above.
UPDATE scheduled_jobs
   SET id = SUBSTR(id, 1, LENGTH(id) - LENGTH('_closing')) || '_t_minus_90m'
 WHERE id LIKE '%_closing'
   AND timing_offset = 't_minus_90m'
   AND status != 'pending';
