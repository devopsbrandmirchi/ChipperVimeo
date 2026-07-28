-- =============================================================================
-- Cron LOSS — Phase 1: only 2026-07-24 (limit 25 every 5 min)
-- Run this whole file in SQL Editor.
-- When unprocessed ≈ 0, run schedule_reprocess_loss_cron_phase2.sql
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
      'Vault secrets project_url / publishable_key missing. Create them first.';
  end if;
end $$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'reprocess-loss-events-every-5-min';

select
  cron.schedule(
    'reprocess-loss-events-every-5-min',
    '*/5 * * * *',
    $cron$
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
          'startDate', '2026-07-24',
          'endDate', '2026-07-24',
          'limit', 25
        ),
        timeout_milliseconds := 60000
      ) as request_id;
    $cron$
  );

select jobid, jobname, schedule, active
from cron.job
where jobname = 'reprocess-loss-events-every-5-min';

-- Check progress:
-- select * from public.fn_combined_loss_coverage(date '2026-07-24');
