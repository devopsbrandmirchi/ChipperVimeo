-- Raise statement_timeout for daily metrics MV refresh (same issue as dashboard).

create or replace function analytics.refresh_daily_metrics()
returns void
language plpgsql
security definer
set search_path = analytics, public
set statement_timeout = '600s'
as $$
begin
  begin
    refresh materialized view concurrently analytics.mv_daily_metrics;
  exception
    when others then
      refresh materialized view analytics.mv_daily_metrics;
  end;
end;
$$;

comment on function analytics.refresh_daily_metrics() is
  'Refresh analytics.mv_daily_metrics. statement_timeout=600s for large bases.';

notify pgrst, 'reload schema';
