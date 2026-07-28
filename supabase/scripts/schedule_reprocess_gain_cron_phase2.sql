-- =============================================================================
-- Cron GAIN — Phase 2: rolling last 7 UTC days
-- Run ONLY after 2026-07-24 gain coverage unprocessed ≈ 0
-- =============================================================================

select cron.unschedule(jobid)
from cron.job
where jobname = 'reprocess-gain-events-every-5-min';

select
  cron.schedule(
    'reprocess-gain-events-every-5-min',
    '*/5 * * * *',
    $cron$
    select
      net.http_post(
        url := (
          select trim(decrypted_secret)
          from vault.decrypted_secrets
          where name = 'project_url'
          limit 1
        ) || '/functions/v1/reprocess-gain-events',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select trim(decrypted_secret)
            from vault.decrypted_secrets
            where name = 'publishable_key'
            limit 1
          ),
          'apikey', (
            select trim(decrypted_secret)
            from vault.decrypted_secrets
            where name = 'publishable_key'
            limit 1
          )
        ),
        body := jsonb_build_object(
          'startDate', to_char((timezone('utc', now()) - interval '6 days')::date, 'YYYY-MM-DD'),
          'endDate', to_char((timezone('utc', now()))::date, 'YYYY-MM-DD'),
          'limit', 25
        ),
        timeout_milliseconds := 60000
      ) as request_id;
    $cron$
  );

select jobid, jobname, schedule, active
from cron.job
where jobname = 'reprocess-gain-events-every-5-min';
