-- Phase 12 ops: schedule daily analytics refresh (UTC).
-- Requires pg_cron. Run once in SQL Editor after migration 045.
-- Builds yesterday's daily_* snapshots, then refreshes dashboard MV + daily MV + cohort cache.

create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid)
from cron.job
where jobname = 'analytics-daily-refresh-utc';

select
  cron.schedule(
    'analytics-daily-refresh-utc',
    '20 1 * * *',
    $cron$
    select analytics.build_daily_snapshots((timezone('utc', now()))::date - 1);
    select analytics.refresh_dashboard();
    select analytics.refresh_daily_metrics();
    select analytics.refresh_cohort_matrix();
    $cron$
  );

-- Verify:
-- select jobid, jobname, schedule, active from cron.job where jobname = 'analytics-daily-refresh-utc';
