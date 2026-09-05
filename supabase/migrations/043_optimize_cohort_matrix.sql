-- Speed up analytics.fn_cohort_revenue_churn_matrix (~16s → target <3s).
-- 1) Index-friendly first_seen / payment filters
-- 2) Avoid cells × customers cartesian for churn (precompute churn relative month)

create index if not exists payments_customer_id_payment_date_idx
  on public.payments (customer_id, payment_date)
  where payment_date is not null;

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
set statement_timeout = '45s'
as $$
  with bounds as (
    select
      date_trunc('month', p_from::timestamp)::date as from_month,
      date_trunc('month', p_to::timestamp)::date as to_month,
      greatest(1, least(coalesce(p_horizon, 6), 24)) as horizon,
      date_trunc('month', timezone('utc', now()))::date as current_month,
      -- timestamptz bounds so customers.first_seen_at index can be used
      (date_trunc('month', p_from::timestamp)::timestamp at time zone 'utc') as from_ts,
      ((date_trunc('month', p_to::timestamp) + interval '1 month')::timestamp at time zone 'utc') as to_ts_exclusive,
      ((date_trunc('month', p_to::timestamp) + (greatest(1, least(coalesce(p_horizon, 6), 24)) || ' months')::interval)::timestamp at time zone 'utc') as pay_to_ts_exclusive
  ),
  cohort_months as (
    select generate_series(b.from_month, b.to_month, interval '1 month')::date as cohort_month
    from bounds b
  ),
  cohorts as (
    select
      c.id as customer_id,
      (date_trunc('month', c.first_seen_at at time zone 'utc'))::date as cohort_month
    from public.customers c
    cross join bounds b
    where c.first_seen_at is not null
      and c.first_seen_at >= b.from_ts
      and c.first_seen_at < b.to_ts_exclusive
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
    cross join bounds b
    cross join lateral generate_series(1, b.horizon) as rel(relative_month)
    where (cm.cohort_month + ((rel.relative_month - 1) * interval '1 month'))::date
      <= b.current_month
  ),
  revenue_by_period as (
    select
      co.cohort_month,
      (date_trunc('month', p.payment_date at time zone 'utc'))::date as period_month,
      sum(p.amount_cents)::numeric as revenue_cents
    from cohorts co
    join public.payments p on p.customer_id = co.customer_id
    cross join bounds b
    where p.amount_cents is not null
      and (p.status is null or lower(p.status) in ('succeeded', 'paid', 'success', 'completed'))
      and p.payment_date is not null
      and p.payment_date >= b.from_ts
      and p.payment_date < b.pay_to_ts_exclusive
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
  -- Earliest cancel only for customers already in the cohort set
  first_cancel as (
    select s.customer_id, min(s.cancelled_at) as cancelled_at
    from cohorts co
    join public.subscriptions s on s.customer_id = co.customer_id
    where s.cancelled_at is not null
    group by s.customer_id
  ),
  customer_churn_rel as (
    select
      co.cohort_month,
      co.customer_id,
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
  -- Compact: how many customers first-churn in each relative month
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
  )
  select metric, cohort_month, relative_month, value from revenue_cells
  union all
  select metric, cohort_month, relative_month, value from churn_cells
  union all
  select metric, cohort_month, relative_month, value from size_rows
  order by 1, 2, 3;
$$;

comment on function analytics.fn_cohort_revenue_churn_matrix(date, date, int) is
  'Cohort matrix (optimized): revenue_cents + churn_pct by first_seen month x relative month.';

grant execute on function analytics.fn_cohort_revenue_churn_matrix(date, date, int)
  to service_role, authenticated;

notify pgrst, 'reload schema';
