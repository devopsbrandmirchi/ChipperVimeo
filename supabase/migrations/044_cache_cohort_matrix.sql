-- Instant cohort matrix reads via cache (live RPC was 16–25s on ~400k cohort customers).
-- Refresh rebuilds last 24 UTC cohort months × horizon 12 (covers UI defaults + filters).

create table if not exists analytics.cohort_matrix_cache (
  metric text not null,
  cohort_month date not null,
  relative_month int not null,
  value numeric not null,
  primary key (metric, cohort_month, relative_month)
);

comment on table analytics.cohort_matrix_cache is
  'Precomputed cohort revenue_cents / churn_pct / cohort_size rows. Served by fn_cohort_revenue_churn_matrix.';

grant select on analytics.cohort_matrix_cache to service_role, authenticated;

create or replace function analytics.refresh_cohort_matrix()
returns void
language plpgsql
security definer
set search_path = analytics, public
set statement_timeout = '120s'
as $$
declare
  v_from_month date;
  v_to_month date;
  v_horizon int := 12;
  v_from_ts timestamptz;
  v_to_ts_exclusive timestamptz;
  v_pay_to_ts_exclusive timestamptz;
  v_current_month date;
begin
  v_to_month := date_trunc('month', timezone('utc', now()))::date;
  v_from_month := (v_to_month - interval '23 months')::date;
  v_current_month := v_to_month;
  v_from_ts := v_from_month::timestamp at time zone 'utc';
  v_to_ts_exclusive := (v_to_month + interval '1 month')::timestamp at time zone 'utc';
  v_pay_to_ts_exclusive := (v_to_month + (v_horizon || ' months')::interval)::timestamp at time zone 'utc';

  truncate analytics.cohort_matrix_cache;

  with cohort_months as (
    select generate_series(v_from_month, v_to_month, interval '1 month')::date as cohort_month
  ),
  cohorts as (
    select
      c.id as customer_id,
      (date_trunc('month', c.first_seen_at at time zone 'utc'))::date as cohort_month
    from public.customers c
    where c.first_seen_at is not null
      and c.first_seen_at >= v_from_ts
      and c.first_seen_at < v_to_ts_exclusive
  ),
  cohort_sizes as (
    select cohort_month, count(*)::numeric as cohort_size
    from cohorts
    group by 1
  ),
  cells as (
    select
      cm.cohort_month,
      rel.relative_month,
      (cm.cohort_month + ((rel.relative_month - 1) * interval '1 month'))::date as period_month
    from cohort_months cm
    cross join lateral generate_series(1, v_horizon) as rel(relative_month)
    where (cm.cohort_month + ((rel.relative_month - 1) * interval '1 month'))::date
      <= v_current_month
  ),
  -- Payment-first: scan payments in window, hash-join customers (faster than cohort×payments NL)
  revenue_by_period as (
    select
      (date_trunc('month', c.first_seen_at at time zone 'utc'))::date as cohort_month,
      (date_trunc('month', p.payment_date at time zone 'utc'))::date as period_month,
      sum(p.amount_cents)::numeric as revenue_cents
    from public.payments p
    join public.customers c on c.id = p.customer_id
    where p.amount_cents is not null
      and (p.status is null or lower(p.status) in ('succeeded', 'paid', 'success', 'completed'))
      and p.payment_date is not null
      and p.payment_date >= v_from_ts
      and p.payment_date < v_pay_to_ts_exclusive
      and c.first_seen_at is not null
      and c.first_seen_at >= v_from_ts
      and c.first_seen_at < v_to_ts_exclusive
    group by 1, 2
  ),
  revenue_cells as (
    select
      'revenue_cents'::text as metric,
      cell.cohort_month,
      cell.relative_month,
      coalesce(r.revenue_cents, 0)::numeric as value
    from cells cell
    left join revenue_by_period r
      on r.cohort_month = cell.cohort_month
      and r.period_month = cell.period_month
  ),
  first_cancel as (
    select s.customer_id, min(s.cancelled_at) as cancelled_at
    from public.subscriptions s
    where s.cancelled_at is not null
      and exists (
        select 1 from cohorts co where co.customer_id = s.customer_id
      )
    group by s.customer_id
  ),
  customer_churn_rel as (
    select
      co.cohort_month,
      case
        when fc.cancelled_at is null then null
        else greatest(
          1,
          (
            extract(
              year from age(
                date_trunc('month', fc.cancelled_at at time zone 'utc'),
                co.cohort_month::timestamp
              )
            )::int * 12
            + extract(
              month from age(
                date_trunc('month', fc.cancelled_at at time zone 'utc'),
                co.cohort_month::timestamp
              )
            )::int
            + 1
          )
        )
      end as churn_rel
    from cohorts co
    left join first_cancel fc on fc.customer_id = co.customer_id
  ),
  churn_by_onset as (
    select cohort_month, churn_rel, count(*)::numeric as n
    from customer_churn_rel
    where churn_rel is not null
    group by 1, 2
  ),
  churn_cells as (
    select
      'churn_pct'::text as metric,
      cell.cohort_month,
      cell.relative_month,
      case
        when coalesce(cs.cohort_size, 0) = 0 then 0::numeric
        else round(
          100.0 * coalesce(
            sum(cbo.n) filter (where cbo.churn_rel <= cell.relative_month),
            0
          ) / cs.cohort_size,
          4
        )
      end as value
    from cells cell
    join cohort_sizes cs on cs.cohort_month = cell.cohort_month
    left join churn_by_onset cbo on cbo.cohort_month = cell.cohort_month
    group by cell.cohort_month, cell.relative_month, cs.cohort_size
  ),
  size_rows as (
    select
      'cohort_size'::text as metric,
      cs.cohort_month,
      0 as relative_month,
      cs.cohort_size as value
    from cohort_sizes cs
  ),
  all_rows as (
    select metric, cohort_month, relative_month, value from revenue_cells
    union all
    select metric, cohort_month, relative_month, value from churn_cells
    union all
    select metric, cohort_month, relative_month, value from size_rows
  )
  insert into analytics.cohort_matrix_cache (metric, cohort_month, relative_month, value)
  select metric, cohort_month, relative_month, value from all_rows;
end;
$$;

comment on function analytics.refresh_cohort_matrix() is
  'Rebuild analytics.cohort_matrix_cache (last 24 UTC months × horizon 12). Run after ingest / with refresh_all.';

grant execute on function analytics.refresh_cohort_matrix() to service_role;

-- Fast path: filter precomputed cache (ms). Empty cache returns no rows (UI shows empty / note).
create or replace function analytics.fn_cohort_revenue_churn_matrix(
  p_from date,
  p_to date,
  p_horizon int default 6
)
returns table (
  metric text,
  cohort_month date,
  relative_month int,
  value numeric
)
language sql
stable
security definer
set search_path = analytics, public
set statement_timeout = '15s'
as $$
  with bounds as (
    select
      date_trunc('month', p_from::timestamp)::date as from_month,
      date_trunc('month', p_to::timestamp)::date as to_month,
      greatest(1, least(coalesce(p_horizon, 6), 24)) as horizon
  )
  select c.metric, c.cohort_month, c.relative_month, c.value
  from analytics.cohort_matrix_cache c
  cross join bounds b
  where c.cohort_month between b.from_month and b.to_month
    and (
      c.metric = 'cohort_size'
      or (c.relative_month >= 1 and c.relative_month <= b.horizon)
    )
  order by 1, 2, 3;
$$;

comment on function analytics.fn_cohort_revenue_churn_matrix(date, date, int) is
  'Cohort matrix from cohort_matrix_cache. Call analytics.refresh_cohort_matrix() to rebuild.';

grant execute on function analytics.fn_cohort_revenue_churn_matrix(date, date, int)
  to service_role, authenticated;

create or replace function analytics.refresh_all()
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  perform analytics.refresh_dashboard();
  perform analytics.refresh_daily_metrics();
  perform analytics.refresh_monthly_metrics();
  perform analytics.refresh_customer_metrics();
  perform analytics.refresh_subscription_metrics();
  perform analytics.refresh_product_metrics();
  perform analytics.refresh_country_metrics();
  perform analytics.refresh_platform_metrics();
  perform analytics.refresh_revenue_metrics();
  perform analytics.refresh_trial_metrics();
  perform analytics.refresh_payment_metrics();
  perform analytics.refresh_churn_metrics();
  perform analytics.refresh_ltv_metrics();
  perform analytics.refresh_cohort_matrix();
end;
$$;

notify pgrst, 'reload schema';
