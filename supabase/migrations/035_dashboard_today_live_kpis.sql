-- Live UTC "today" KPIs (not frozen in mv_dashboard) + resilient dashboard refresh.
-- Concurrent refresh on a large mv_dashboard often times out from the API; today cards
-- must not depend on that succeeding.

create or replace function analytics.get_dashboard_today_kpis()
returns table (
  new_customers_today bigint,
  renewals_today bigint,
  cancelled_today bigint,
  revenue_today_cents bigint,
  as_of timestamptz
)
language sql
stable
security definer
set search_path = analytics, public
as $$
  with today as (
    select (timezone('utc', now()))::date as d
  )
  select
    (
      select count(*)::bigint
      from public.customers c, today t
      where c.first_seen_at is not null
        and c.first_seen_at::date = t.d
    ) as new_customers_today,
    (
      select count(*)::bigint
      from public.subscriptions s, today t
      where s.cancelled_at is null
        and s.renewal_date is not null
        and s.renewal_date::date = t.d
    ) as renewals_today,
    (
      select count(*)::bigint
      from public.subscriptions s, today t
      where s.cancelled_at is not null
        and s.cancelled_at::date = t.d
    ) as cancelled_today,
    (
      select coalesce(sum(p.amount_cents), 0)::bigint
      from public.payments p, today t
      where (p.status is null or lower(p.status) in ('succeeded', 'paid', 'success', 'completed'))
        and p.payment_date::date = t.d
    ) as revenue_today_cents,
    timezone('utc', now()) as as_of;
$$;

comment on function analytics.get_dashboard_today_kpis() is
  'Live UTC-day KPIs for executive dashboard today cards. Independent of mv_dashboard freshness.';

grant execute on function analytics.get_dashboard_today_kpis() to service_role, authenticated;

-- Prefer concurrent refresh; fall back to non-concurrent if concurrent fails
-- (lock contention, missing unique index edge cases, etc.).
-- Raise statement_timeout: default API timeout (~8s) cancels large MV refresh.
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

notify pgrst, 'reload schema';
