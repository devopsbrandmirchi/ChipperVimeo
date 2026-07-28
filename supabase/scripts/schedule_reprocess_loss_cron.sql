-- =============================================================================
-- Cron: drain unprocessed LOSS webhooks (limit 25 per run)
-- Requires: migration 026, Edge Function reprocess-loss-events, Vault secrets
--   project_url + publishable_key (same as gain cron)
-- =============================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into v_key
  from vault.decrypted_secrets where name = 'publishable_key' limit 1;

  if v_url is null or v_key is null then
    raise exception
      'Vault secrets project_url / publishable_key missing. Create them first (see schedule_reprocess_gain_cron.sql section A).';
  end if;
end $$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'reprocess-loss-events-every-5-min';

select
  cron.schedule(
    'reprocess-loss-events-every-5-min',
    '*/5 * * * *',
    $$
    select
      net.http_post(
        url := (
          select trim(decrypted_secret)
          from vault.decrypted_secrets
          where name = 'project_url'
          limit 1
        ) || '/functions/v1/reprocess-loss-events',
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
          'startDate', to_char((timezone('utc', now()) - interval '7 days')::date, 'YYYY-MM-DD'),
          'endDate', to_char((timezone('utc', now()))::date, 'YYYY-MM-DD'),
          'limit', 25
        ),
        timeout_milliseconds := 60000
      ) as request_id;
    $$
  );

select jobid, jobname, schedule, active
from cron.job
where jobname = 'reprocess-loss-events-every-5-min';
