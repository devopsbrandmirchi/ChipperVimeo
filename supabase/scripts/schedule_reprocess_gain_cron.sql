-- =============================================================================
-- Cron: drain unprocessed gain webhooks via Edge Function (limit 25 per run)
-- =============================================================================
-- Prefer Dashboard UI (no SQL secrets in repo):
--   Integrations → Cron → Create job
--   Type: Supabase Edge Function
--   Function: reprocess-gain-events
--   Method: POST
--   Body: { "lookbackDays": 7, "limit": 25 }
--   Schedule: every 5 minutes while catching up, then hourly
--
-- Or use this SQL after enabling extensions + vault secrets.
-- =============================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- One-time: store secrets in Vault (edit values, then run once).
-- select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
-- select vault.create_secret('YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY', 'publishable_key');

-- Unschedule if re-creating
-- select cron.unschedule('reprocess-gain-events-every-5-min');

select
  cron.schedule(
    'reprocess-gain-events-every-5-min',
    '*/5 * * * *', -- every 5 minutes (UTC)
    $$
    select
      net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'project_url'
          limit 1
        ) || '/functions/v1/reprocess-gain-events',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'publishable_key'
            limit 1
          ),
          'apikey', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'publishable_key'
            limit 1
          )
        ),
        -- Empty-ish body: Edge Function defaults to last 7 UTC days, limit 25
        body := jsonb_build_object(
          'lookbackDays', 7,
          'limit', 25
        ),
        -- Must be high enough for Edge → app batch (~30–55s)
        timeout_milliseconds := 60000
      ) as request_id;
    $$
  );

-- Monitor runs:
-- select * from cron.job_run_details
-- where jobid = (select jobid from cron.job where jobname = 'reprocess-gain-events-every-5-min')
-- order by start_time desc
-- limit 20;

-- When backlog is cleared, switch to hourly:
-- select cron.unschedule('reprocess-gain-events-every-5-min');
-- then schedule '0 * * * *' with the same http_post body.
