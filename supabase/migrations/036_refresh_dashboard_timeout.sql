-- Raise statement_timeout for dashboard MV refresh (API default ~8s is too short).
-- Safe to re-run if 035 already applied without the timeout setting.

create or replace function analytics.refresh_dashboard()
returns void
language plpgsql
security definer
set search_path = analytics, public
set statement_timeout = '600s'
as $$
begin
  begin
    refresh materialized view concurrently analytics.mv_dashboard;
  exception
    when others then
      refresh materialized view analytics.mv_dashboard;
  end;
end;
$$;

comment on function analytics.refresh_dashboard() is
  'Refresh analytics.mv_dashboard. statement_timeout=600s for large subscriber bases.';

notify pgrst, 'reload schema';
