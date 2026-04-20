-- Rename old "closing" (90m snapshot) to "t_minus_90m" so CLOSING can
-- semantically mean the true last snapshot (now at T-10m). Existing R2
-- object paths are not moved — snapshots.r2_path stores the exact key,
-- so old objects under /snapshots/closing/... stay resolvable while new
-- CLOSING snapshots at T-10m write to the same directory going forward.
--
-- scheduled_jobs.id follows the `{eventId}_{timing}` convention (see
-- pathUtils.generateJobId), so the id column must be rewritten alongside
-- timing_offset. Otherwise new discovery would (a) insert duplicate
-- t_minus_90m rows and (b) skip new closing (T-10m) rows because the
-- old `{eventId}_closing` id still exists.

UPDATE scheduled_jobs
   SET id            = SUBSTR(id, 1, LENGTH(id) - LENGTH('_closing')) || '_t_minus_90m',
       timing_offset = 't_minus_90m'
 WHERE timing_offset = 'closing';

UPDATE snapshots      SET timing        = 't_minus_90m' WHERE timing        = 'closing';
