-- =============================================================================
-- Cron: drain unprocessed gain webhooks via Edge Function (limit 25 per run)
-- =============================================================================
-- ERROR you saw:
--   null value in column "url" ... 
-- means Vault secrets `project_url` / `publishable_key` are missing → URL is null.
--
-- Fix: create those secrets FIRST (section A), then schedule (section B).
--
-- Easier alternative (no SQL): Dashboard → Integrations → Cron → Create job
--   Type: Supabase Edge Function → reprocess-gain-events
--   Body: { "lookbackDays": 7, "limit": 25 }
--   Schedule: */5 * * * *
-- =============================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- -----------------------------------------------------------------------------
-- A) ONE-TIME: create Vault secrets (edit the two values, then run this block)
-- -----------------------------------------------------------------------------
-- Replace YOUR_PROJECT_REF and YOUR_ANON_KEY before running.
-- Anon/publishable key: Project Settings → API → anon public

do $$
declare
  v_url text := 'https://YOUR_PROJECT_REF.supabase.co';  -- e.g. https://abcdefgh.supabase.co
  v_key text := 'YOUR_ANON_OR_PUBLISHABLE_KEY';
begin
  if v_url like '%YOUR_PROJECT_REF%' or v_key like 'YOUR_%' then
    raise exception
      'Edit v_url and v_key in section A before running (placeholders still present)';
  end if;

  if not exists (
    select 1 from vault.decrypted_secrets where name = 'project_url'
  ) then
    perform vault.create_secret(v_url, 'project_url');
  end if;

  if not exists (
    select 1 from vault.decrypted_secrets where name = 'publishable_key'
  ) then
    perform vault.create_secret(v_key, 'publishable_key');
  end if;
end $$;

-- Verify secrets exist (url/key should NOT be null)
select
  name,
  left(decrypted_secret, 40) as secret_preview
from vault.decrypted_secrets
where name in ('project_url', 'publishable_key');

-- -----------------------------------------------------------------------------
-- B) Schedule (only after section A succeeds)
-- -----------------------------------------------------------------------------

-- Guard: refuse to schedule if secrets missing
do $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into v_key
  from vault.decrypted_secrets where name = 'publishable_key' limit 1;

  if v_url is null or v_key is null or length(trim(v_url)) = 0 then
    raise exception
      'Vault secrets missing. Run section A first (project_url + publishable_key).';
  end if;
end $$;

-- Remove previous job if re-creating
select cron.unschedule(jobid)
from cron.job
where jobname = 'reprocess-gain-events-every-5-min';

select
  cron.schedule(
    'reprocess-gain-events-every-5-min',
    '*/5 * * * *',
    $$
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
          'lookbackDays', 7,
          'limit', 25
        ),
        timeout_milliseconds := 60000
      ) as request_id;
    $$
  );

-- List job
select jobid, jobname, schedule, active
from cron.job
where jobname = 'reprocess-gain-events-every-5-min';

-- Recent runs (after a few minutes)
-- select * from cron.job_run_details
-- where jobid = (select jobid from cron.job where jobname = 'reprocess-gain-events-every-5-min')
-- order by start_time desc
-- limit 20;
