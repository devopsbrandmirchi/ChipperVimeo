-- Cohort revenue + churn % matrix for Analytics UI (Excel-shaped grids).
-- Cohort = UTC month of customers.first_seen_at.
-- Month 1 = cohort calendar month; Month k = cohort + (k-1) months.

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
set statement_timeout = '60s'
as $$
  with bounds as (
    select
      date_trunc('month', p_from::timestamp)::date as from_month,
      date_trunc('month', p_to::timestamp)::date as to_month,
      greatest(1, least(coalesce(p_horizon, 6), 24)) as horizon,
      date_trunc('month', timezone('utc', now()))::date as current_month
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
      and (date_trunc('month', c.first_seen_at at time zone 'utc'))::date
        between b.from_month and b.to_month
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
      (cm.cohort_month + ((rel.relative_month - 1) * interval '1 month'))::date as period_month,
      (cm.cohort_month + (rel.relative_month * interval '1 month')) as period_end_exclusive
    from cohort_months cm
    cross join bounds b
    cross join lateral generate_series(1, b.horizon) as rel(relative_month)
    where (cm.cohort_month + ((rel.relative_month - 1) * interval '1 month'))::date
      <= (select current_month from bounds)
  ),
  revenue_by_period as (
    select
      co.cohort_month,
      (date_trunc('month', p.payment_date at time zone 'utc'))::date as period_month,
      sum(p.amount_cents)::numeric as revenue_cents
    from cohorts co
    join public.payments p on p.customer_id = co.customer_id
    where p.amount_cents is not null
      and (p.status is null or lower(p.status) in ('succeeded', 'paid', 'success', 'completed'))
      and p.payment_date is not null
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
  churn_counts as (
    select
      cell.cohort_month,
      cell.relative_month,
      count(fc.customer_id)::numeric as churned
    from cells cell
    join cohorts co on co.cohort_month = cell.cohort_month
    left join first_cancel fc
      on fc.customer_id = co.customer_id
      and fc.cancelled_at < cell.period_end_exclusive
    group by cell.cohort_month, cell.relative_month
  ),
  churn_cells as (
    select
      'churn_pct'::text as metric,
      cc.cohort_month,
      cc.relative_month,
      case
        when coalesce(cs.cohort_size, 0) = 0 then 0::numeric
        else round(100.0 * cc.churned / cs.cohort_size, 4)
      end as value
    from churn_counts cc
    join cohort_sizes cs on cs.cohort_month = cc.cohort_month
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
  'Cohort matrix: revenue_cents and churn_pct by first_seen month x relative month (1=cohort month).';

grant execute on function analytics.fn_cohort_revenue_churn_matrix(date, date, int)
  to service_role, authenticated;

notify pgrst, 'reload schema';
