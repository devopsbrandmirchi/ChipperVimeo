-- Phase 9: parameterized query RPCs for filtered / time-series analytics reads.

create or replace function analytics.get_daily_metrics(
  p_date_from date default null,
  p_date_to date default null
)
returns setof analytics.mv_daily_metrics
language sql
stable
security definer
set search_path = analytics, public
as $$
  select *
  from analytics.mv_daily_metrics d
  where (p_date_from is null or d.metric_date >= p_date_from)
    and (p_date_to is null or d.metric_date <= p_date_to)
  order by d.metric_date;
$$;

create or replace function analytics.get_monthly_metrics(
  p_date_from date default null,
  p_date_to date default null
)
returns setof analytics.mv_monthly_metrics
language sql
stable
security definer
set search_path = analytics, public
as $$
  select *
  from analytics.mv_monthly_metrics m
  where (p_date_from is null or m.metric_month >= date_trunc('month', p_date_from)::date)
    and (p_date_to is null or m.metric_month <= date_trunc('month', p_date_to)::date)
  order by m.metric_month;
$$;

create or replace function analytics.get_top_ltv_customers(p_limit int default 25)
returns setof analytics.mv_customer_metrics
language sql
stable
security definer
set search_path = analytics, public
as $$
  select *
  from analytics.mv_customer_metrics
  order by lifetime_revenue_cents desc nulls last
  limit greatest(coalesce(p_limit, 25), 1);
$$;

create or replace function analytics.get_customers_in_trial(p_limit int default 100)
returns setof analytics.mv_customer_metrics
language sql
stable
security definer
set search_path = analytics, public
as $$
  select *
  from analytics.mv_customer_metrics
  where in_trial is true
  order by last_seen_at desc nulls last
  limit greatest(coalesce(p_limit, 100), 1);
$$;

create or replace function analytics.get_customers_failed_payments(p_limit int default 100)
returns setof analytics.mv_customer_metrics
language sql
stable
security definer
set search_path = analytics, public
as $$
  select *
  from analytics.mv_customer_metrics
  where failed_payment_count > 0
  order by failed_payment_count desc, last_seen_at desc nulls last
  limit greatest(coalesce(p_limit, 100), 1);
$$;

create or replace function analytics.get_recently_cancelled_customers(p_limit int default 100)
returns setof analytics.mv_customer_metrics
language sql
stable
security definer
set search_path = analytics, public
as $$
  select *
  from analytics.mv_customer_metrics
  where recently_cancelled is true
  order by last_seen_at desc nulls last
  limit greatest(coalesce(p_limit, 100), 1);
$$;

grant execute on function analytics.get_daily_metrics(date, date) to service_role;
grant execute on function analytics.get_monthly_metrics(date, date) to service_role;
grant execute on function analytics.get_top_ltv_customers(int) to service_role;
grant execute on function analytics.get_customers_in_trial(int) to service_role;
grant execute on function analytics.get_customers_failed_payments(int) to service_role;
grant execute on function analytics.get_recently_cancelled_customers(int) to service_role;
