-- Phase 9: analytics materialized views.
-- Source: normalized public tables only. Never public.vott_events.
--
-- Created WITH NO DATA so this migration stays under SQL-editor timeouts.
-- Populate after indexes (015) via 018 or: select analytics.refresh_all();
-- First fill must be non-concurrent (018); later refreshes can use concurrently.

-- ---------------------------------------------------------------------------
-- mv_dashboard — single-row KPI snapshot
-- ---------------------------------------------------------------------------
drop materialized view if exists analytics.mv_dashboard cascade;
create materialized view analytics.mv_dashboard as
with cust as (
  select
    count(*)::bigint as total_customers,
    count(*) filter (
      where subscription_status is not null
        and lower(subscription_status) in ('active', 'enabled', 'subscribed')
    )::bigint as active_subscribers,
    count(*) filter (
      where first_seen_at is not null
        and first_seen_at::date = (timezone('utc', now()))::date
    )::bigint as new_customers_today
  from public.customers
),
subs as (
  select
    count(*)::bigint as total_subscriptions,
    count(*) filter (
      where cancelled_at is null and expired_at is null
        and coalesce(free_trial, false) is not true
        and (status is null or lower(status) not like '%pause%')
    )::bigint as active_subscriptions,
    count(*) filter (
      where status is not null and lower(status) like '%pause%'
    )::bigint as paused_subscriptions,
    count(*) filter (where cancelled_at is not null)::bigint as cancelled_subscriptions,
    count(*) filter (where expired_at is not null)::bigint as expired_subscriptions,
    count(*) filter (where free_trial is true)::bigint as free_trial_subscriptions,
    count(*) filter (
      where cancelled_at is null
        and renewal_date is not null
        and renewal_date::date = (timezone('utc', now()))::date
    )::bigint as renewals_today
  from public.subscriptions
),
mrr as (
  select coalesce(sum(mrr_cents), 0)::bigint as mrr_cents
  from analytics.vw_subscription_mrr_cents
  where mrr_cents > 0
),
pay as (
  select
    coalesce(sum(amount_cents) filter (
      where (status is null or lower(status) in ('succeeded', 'paid', 'success', 'completed'))
        and payment_date::date = (timezone('utc', now()))::date
    ), 0)::bigint as revenue_today_cents,
    coalesce(sum(amount_cents) filter (
      where (status is null or lower(status) in ('succeeded', 'paid', 'success', 'completed'))
        and payment_date >= date_trunc('week', timezone('utc', now()))
    ), 0)::bigint as revenue_week_cents,
    coalesce(sum(amount_cents) filter (
      where (status is null or lower(status) in ('succeeded', 'paid', 'success', 'completed'))
        and payment_date >= date_trunc('month', timezone('utc', now()))
    ), 0)::bigint as revenue_month_cents,
    coalesce(sum(amount_cents) filter (
      where (status is null or lower(status) in ('succeeded', 'paid', 'success', 'completed'))
        and payment_date >= date_trunc('year', timezone('utc', now()))
    ), 0)::bigint as revenue_year_cents,
    count(*) filter (
      where status is not null
        and lower(status) in ('failed', 'failure', 'declined', 'charge_failed')
    )::bigint as charge_failures,
    count(*) filter (
      where status is null or lower(status) in ('succeeded', 'paid', 'success', 'completed')
    )::bigint as successful_payments,
    count(*) filter (
      where status is not null and lower(status) like '%recover%'
    )::bigint as recovered_payments,
    coalesce(sum(amount_cents) filter (
      where status is null or lower(status) in ('succeeded', 'paid', 'success', 'completed')
    ), 0)::bigint as lifetime_revenue_cents
  from public.payments
),
trial_conv as (
  select
    count(*) filter (where free_trial is true)::bigint as trials,
    count(*) filter (
      where free_trial is true
        and cancelled_at is null
        and expired_at is null
        and (status is null or lower(status) in ('active', 'enabled', 'subscribed'))
    )::bigint as converted_or_active_trials
  from public.subscriptions
)
select
  1::int as id,
  cust.total_customers,
  cust.new_customers_today,
  cust.active_subscribers,
  subs.paused_subscriptions,
  subs.cancelled_subscriptions,
  subs.expired_subscriptions,
  subs.free_trial_subscriptions,
  subs.renewals_today,
  pay.charge_failures,
  pay.recovered_payments,
  pay.revenue_today_cents,
  pay.revenue_week_cents,
  pay.revenue_month_cents,
  pay.revenue_year_cents,
  mrr.mrr_cents,
  (mrr.mrr_cents * 12)::bigint as arr_cents,
  case
    when cust.active_subscribers > 0
      then (mrr.mrr_cents::numeric / cust.active_subscribers)::numeric(18, 4)
    else 0
  end as arpu_cents,
  case
    when pay.successful_payments > 0 and cust.total_customers > 0
      then (pay.lifetime_revenue_cents::numeric / nullif(cust.total_customers, 0))::numeric(18, 4)
    else 0
  end as arppu_proxy_cents,
  case
    when trial_conv.trials > 0
      then (trial_conv.converted_or_active_trials::numeric / trial_conv.trials * 100)::numeric(8, 2)
    else 0
  end as trial_conversion_pct,
  case
    when (subs.active_subscriptions + subs.cancelled_subscriptions) > 0
      then (
        subs.cancelled_subscriptions::numeric
        / (subs.active_subscriptions + subs.cancelled_subscriptions)
        * 100
      )::numeric(8, 2)
    else 0
  end as churn_rate_pct,
  case
    when (subs.active_subscriptions + subs.cancelled_subscriptions) > 0
      then (
        100 - (
          subs.cancelled_subscriptions::numeric
          / (subs.active_subscriptions + subs.cancelled_subscriptions)
          * 100
        )
      )::numeric(8, 2)
    else 100
  end as retention_rate_pct,
  case
    when pay.charge_failures + pay.recovered_payments > 0
      then (
        pay.recovered_payments::numeric
        / (pay.charge_failures + pay.recovered_payments)
        * 100
      )::numeric(8, 2)
    else 0
  end as payment_recovery_rate_pct,
  timezone('utc', now()) as refreshed_at
from cust, subs, mrr, pay, trial_conv
with no data;

comment on materialized view analytics.mv_dashboard is
  'Single-row KPI snapshot. Refresh via analytics.refresh_dashboard().';

-- ---------------------------------------------------------------------------
-- mv_daily_metrics
-- ---------------------------------------------------------------------------
drop materialized view if exists analytics.mv_daily_metrics cascade;
create materialized view analytics.mv_daily_metrics as
with payment_days as (
  select
    (payment_date at time zone 'utc')::date as metric_date,
    count(*)::bigint as payment_attempts,
    count(*) filter (
      where status is null or lower(status) in ('succeeded', 'paid', 'success', 'completed')
    )::bigint as successful_payments,
    count(*) filter (
      where status is not null
        and lower(status) in ('failed', 'failure', 'declined', 'charge_failed')
    )::bigint as failed_payments,
    coalesce(sum(amount_cents) filter (
      where status is null or lower(status) in ('succeeded', 'paid', 'success', 'completed')
    ), 0)::bigint as revenue_cents
  from public.payments
  where payment_date is not null
  group by 1
),
new_customers as (
  select
    (first_seen_at at time zone 'utc')::date as metric_date,
    count(*)::bigint as new_customers
  from public.customers
  where first_seen_at is not null
  group by 1
),
new_subscriptions as (
  select
    (started_at at time zone 'utc')::date as metric_date,
    count(*)::bigint as new_subscriptions,
    count(*) filter (where free_trial is true)::bigint as new_trials,
    count(*) filter (where cancelled_at is not null)::bigint as cancellations
  from public.subscriptions
  where started_at is not null
  group by 1
),
all_dates as (
  select metric_date from payment_days
  union select metric_date from new_customers
  union select metric_date from new_subscriptions
)
select
  d.metric_date,
  coalesce(nc.new_customers, 0)::bigint as new_customers,
  coalesce(ns.new_subscriptions, 0)::bigint as new_subscriptions,
  coalesce(ns.new_trials, 0)::bigint as new_trials,
  coalesce(ns.cancellations, 0)::bigint as cancellations,
  coalesce(pd.payment_attempts, 0)::bigint as payment_attempts,
  coalesce(pd.successful_payments, 0)::bigint as successful_payments,
  coalesce(pd.failed_payments, 0)::bigint as failed_payments,
  coalesce(pd.revenue_cents, 0)::bigint as revenue_cents,
  timezone('utc', now()) as refreshed_at
from all_dates d
left join payment_days pd on pd.metric_date = d.metric_date
left join new_customers nc on nc.metric_date = d.metric_date
left join new_subscriptions ns on ns.metric_date = d.metric_date
with no data;

-- ---------------------------------------------------------------------------
-- mv_monthly_metrics
-- ---------------------------------------------------------------------------
drop materialized view if exists analytics.mv_monthly_metrics cascade;
create materialized view analytics.mv_monthly_metrics as
select
  date_trunc('month', metric_date)::date as metric_month,
  sum(new_customers)::bigint as new_customers,
  sum(new_subscriptions)::bigint as new_subscriptions,
  sum(new_trials)::bigint as new_trials,
  sum(cancellations)::bigint as cancellations,
  sum(payment_attempts)::bigint as payment_attempts,
  sum(successful_payments)::bigint as successful_payments,
  sum(failed_payments)::bigint as failed_payments,
  sum(revenue_cents)::bigint as revenue_cents,
  timezone('utc', now()) as refreshed_at
from analytics.mv_daily_metrics
group by 1
with no data;

-- ---------------------------------------------------------------------------
-- mv_customer_metrics (pre-aggregated joins — no per-row correlated subqueries)
-- ---------------------------------------------------------------------------
drop materialized view if exists analytics.mv_customer_metrics cascade;
create materialized view analytics.mv_customer_metrics as
with pay_agg as (
  select
    customer_id,
    coalesce(sum(amount_cents) filter (
      where status is null or lower(status) in ('succeeded', 'paid', 'success', 'completed')
    ), 0)::bigint as lifetime_revenue_cents,
    count(*) filter (
      where status is null or lower(status) in ('succeeded', 'paid', 'success', 'completed')
    )::bigint as successful_payment_count,
    count(*) filter (
      where status is not null
        and lower(status) in ('failed', 'failure', 'declined', 'charge_failed')
    )::bigint as failed_payment_count
  from public.payments
  where customer_id is not null
  group by customer_id
),
sub_agg as (
  select
    customer_id,
    count(*)::bigint as subscription_count,
    count(*) filter (
      where cancelled_at is null and expired_at is null
    )::bigint as open_subscription_count,
    bool_or(
      free_trial is true and cancelled_at is null and expired_at is null
    ) as in_trial,
    bool_or(
      cancelled_at is not null
      and cancelled_at > timezone('utc', now()) - interval '30 days'
    ) as recently_cancelled
  from public.subscriptions
  where customer_id is not null
  group by customer_id
)
select
  c.id as customer_id,
  c.vimeo_customer_id,
  c.email,
  c.full_name,
  c.country,
  c.platform,
  c.plan,
  c.subscription_status,
  c.first_seen_at,
  c.last_seen_at,
  coalesce(p.lifetime_revenue_cents, 0)::bigint as lifetime_revenue_cents,
  coalesce(s.subscription_count, 0)::bigint as subscription_count,
  coalesce(s.open_subscription_count, 0)::bigint as open_subscription_count,
  coalesce(p.successful_payment_count, 0)::bigint as successful_payment_count,
  coalesce(p.failed_payment_count, 0)::bigint as failed_payment_count,
  coalesce(s.in_trial, false) as in_trial,
  coalesce(s.recently_cancelled, false) as recently_cancelled,
  timezone('utc', now()) as refreshed_at
from public.customers c
left join pay_agg p on p.customer_id = c.id
left join sub_agg s on s.customer_id = c.id
with no data;

-- ---------------------------------------------------------------------------
-- mv_subscription_metrics
-- ---------------------------------------------------------------------------
drop materialized view if exists analytics.mv_subscription_metrics cascade;
create materialized view analytics.mv_subscription_metrics as
select
  1::int as id,
  count(*)::bigint as total_subscriptions,
  count(*) filter (
    where cancelled_at is null and expired_at is null
  )::bigint as open_subscriptions,
  count(*) filter (
    where status is not null and lower(status) like '%pause%'
  )::bigint as paused_subscriptions,
  count(*) filter (where cancelled_at is not null)::bigint as cancelled_subscriptions,
  count(*) filter (where expired_at is not null)::bigint as expired_subscriptions,
  count(*) filter (where free_trial is true)::bigint as free_trial_subscriptions,
  count(*) filter (
    where billing_frequency is not null
      and lower(billing_frequency) in ('monthly', 'month', 'mo')
  )::bigint as monthly_subscriptions,
  count(*) filter (
    where billing_frequency is not null
      and lower(billing_frequency) in ('yearly', 'annual', 'annually', 'year', 'yr')
  )::bigint as yearly_subscriptions,
  coalesce((select sum(mrr_cents) from analytics.vw_subscription_mrr_cents where mrr_cents > 0), 0)::bigint as mrr_cents,
  coalesce(avg(
    extract(epoch from (coalesce(cancelled_at, expired_at, timezone('utc', now())) - started_at)) / 86400.0
  ) filter (where started_at is not null), 0)::numeric(12, 2) as avg_subscription_duration_days,
  timezone('utc', now()) as refreshed_at
from public.subscriptions
with no data;

-- ---------------------------------------------------------------------------
-- mv_product_metrics (separate sub/payment aggs — no subscription×payment fan-out)
-- ---------------------------------------------------------------------------
drop materialized view if exists analytics.mv_product_metrics cascade;
create materialized view analytics.mv_product_metrics as
with sub_agg as (
  select
    s.product_id,
    count(s.id)::bigint as subscribers,
    count(s.id) filter (
      where s.cancelled_at is null and s.expired_at is null
    )::bigint as open_subscribers,
    count(s.id) filter (where s.free_trial is true)::bigint as trials,
    count(s.id) filter (where s.cancelled_at is not null)::bigint as cancellations,
    coalesce(sum(m.mrr_cents) filter (where m.mrr_cents > 0), 0)::bigint as mrr_contribution_cents
  from public.subscriptions s
  left join analytics.vw_subscription_mrr_cents m on m.subscription_id = s.id
  where s.product_id is not null
  group by s.product_id
),
pay_agg as (
  select
    product_id,
    coalesce(sum(amount_cents), 0)::bigint as revenue_cents
  from analytics.vw_successful_payments
  where product_id is not null
  group by product_id
)
select
  p.id as product_id,
  p.vimeo_product_id,
  p.name as product_name,
  p.sku,
  p.currency,
  p.active,
  coalesce(sa.subscribers, 0)::bigint as subscribers,
  coalesce(sa.open_subscribers, 0)::bigint as open_subscribers,
  coalesce(sa.trials, 0)::bigint as trials,
  coalesce(sa.cancellations, 0)::bigint as cancellations,
  coalesce(sa.mrr_contribution_cents, 0)::bigint as mrr_contribution_cents,
  (coalesce(sa.mrr_contribution_cents, 0) * 12)::bigint as arr_contribution_cents,
  coalesce(pa.revenue_cents, 0)::bigint as revenue_cents,
  case
    when coalesce(sa.subscribers, 0) > 0
      then (sa.cancellations::numeric / sa.subscribers * 100)
    else 0
  end::numeric(8, 2) as cancellation_pct,
  timezone('utc', now()) as refreshed_at
from public.products p
left join sub_agg sa on sa.product_id = p.id
left join pay_agg pa on pa.product_id = p.id
with no data;

-- ---------------------------------------------------------------------------
-- mv_country_metrics / mv_platform_metrics (no customer×sub×payment cartesian)
-- ---------------------------------------------------------------------------
drop materialized view if exists analytics.mv_country_metrics cascade;
create materialized view analytics.mv_country_metrics as
with cust_counts as (
  select
    coalesce(country, 'unknown') as country,
    count(*)::bigint as customer_count
  from public.customers
  group by 1
),
sub_mrr as (
  select
    coalesce(c.country, 'unknown') as country,
    count(distinct s.id) filter (
      where s.cancelled_at is null and s.expired_at is null
    )::bigint as open_subscription_count,
    coalesce(sum(m.mrr_cents) filter (where m.mrr_cents > 0), 0)::bigint as mrr_cents
  from public.customers c
  left join public.subscriptions s on s.customer_id = c.id
  left join analytics.vw_subscription_mrr_cents m on m.subscription_id = s.id
  group by 1
),
rev as (
  select
    coalesce(c.country, 'unknown') as country,
    coalesce(sum(p.amount_cents), 0)::bigint as revenue_cents
  from public.customers c
  inner join analytics.vw_successful_payments p on p.customer_id = c.id
  group by 1
)
select
  cc.country,
  cc.customer_count,
  coalesce(sm.open_subscription_count, 0)::bigint as open_subscription_count,
  coalesce(sm.mrr_cents, 0)::bigint as mrr_cents,
  coalesce(r.revenue_cents, 0)::bigint as revenue_cents,
  timezone('utc', now()) as refreshed_at
from cust_counts cc
left join sub_mrr sm on sm.country = cc.country
left join rev r on r.country = cc.country
with no data;

drop materialized view if exists analytics.mv_platform_metrics cascade;
create materialized view analytics.mv_platform_metrics as
with cust_counts as (
  select
    coalesce(platform, 'unknown') as platform,
    count(*)::bigint as customer_count
  from public.customers
  group by 1
),
sub_mrr as (
  select
    coalesce(c.platform, 'unknown') as platform,
    count(distinct s.id) filter (
      where s.cancelled_at is null and s.expired_at is null
    )::bigint as open_subscription_count,
    coalesce(sum(m.mrr_cents) filter (where m.mrr_cents > 0), 0)::bigint as mrr_cents
  from public.customers c
  left join public.subscriptions s on s.customer_id = c.id
  left join analytics.vw_subscription_mrr_cents m on m.subscription_id = s.id
  group by 1
),
rev as (
  select
    coalesce(c.platform, 'unknown') as platform,
    coalesce(sum(p.amount_cents), 0)::bigint as revenue_cents
  from public.customers c
  inner join analytics.vw_successful_payments p on p.customer_id = c.id
  group by 1
)
select
  cc.platform,
  cc.customer_count,
  coalesce(sm.open_subscription_count, 0)::bigint as open_subscription_count,
  coalesce(sm.mrr_cents, 0)::bigint as mrr_cents,
  coalesce(r.revenue_cents, 0)::bigint as revenue_cents,
  timezone('utc', now()) as refreshed_at
from cust_counts cc
left join sub_mrr sm on sm.platform = cc.platform
left join rev r on r.platform = cc.platform
with no data;

-- ---------------------------------------------------------------------------
-- mv_revenue_metrics
-- ---------------------------------------------------------------------------
drop materialized view if exists analytics.mv_revenue_metrics cascade;
create materialized view analytics.mv_revenue_metrics as
select
  1::int as id,
  coalesce(sum(amount_cents), 0)::bigint as total_revenue_cents,
  count(*)::bigint as successful_payment_count,
  coalesce(avg(amount_cents), 0)::numeric(18, 4) as avg_payment_cents,
  min(payment_date) as first_payment_at,
  max(payment_date) as last_payment_at,
  timezone('utc', now()) as refreshed_at
from analytics.vw_successful_payments
with no data;

-- ---------------------------------------------------------------------------
-- mv_trial_metrics
-- ---------------------------------------------------------------------------
drop materialized view if exists analytics.mv_trial_metrics cascade;
create materialized view analytics.mv_trial_metrics as
select
  1::int as id,
  count(*) filter (where free_trial is true)::bigint as total_trials,
  count(*) filter (
    where free_trial is true and cancelled_at is null and expired_at is null
  )::bigint as active_trials,
  count(*) filter (
    where free_trial is true
      and free_trial_end is not null
      and free_trial_end::date between (timezone('utc', now()))::date
        and (timezone('utc', now()))::date + 7
  )::bigint as trials_expiring_soon,
  count(*) filter (
    where free_trial is true
      and cancelled_at is null
      and (status is null or lower(status) in ('active', 'enabled', 'subscribed'))
      and coalesce(free_trial, false) is true
  )::bigint as trial_conversions_proxy,
  timezone('utc', now()) as refreshed_at
from public.subscriptions
with no data;

-- ---------------------------------------------------------------------------
-- mv_payment_metrics
-- ---------------------------------------------------------------------------
drop materialized view if exists analytics.mv_payment_metrics cascade;
create materialized view analytics.mv_payment_metrics as
select
  1::int as id,
  count(*)::bigint as total_payments,
  count(*) filter (
    where status is null or lower(status) in ('succeeded', 'paid', 'success', 'completed')
  )::bigint as successful_payments,
  count(*) filter (
    where status is not null
      and lower(status) in ('failed', 'failure', 'declined', 'charge_failed')
  )::bigint as failed_payments,
  count(*) filter (
    where status is not null and lower(status) like '%recover%'
  )::bigint as recovered_payments,
  coalesce(sum(amount_cents) filter (
    where status is null or lower(status) in ('succeeded', 'paid', 'success', 'completed')
  ), 0)::bigint as revenue_cents,
  timezone('utc', now()) as refreshed_at
from public.payments
with no data;

-- ---------------------------------------------------------------------------
-- mv_churn_metrics
-- ---------------------------------------------------------------------------
drop materialized view if exists analytics.mv_churn_metrics cascade;
create materialized view analytics.mv_churn_metrics as
select
  1::int as id,
  count(*) filter (where cancelled_at is not null)::bigint as cancelled_total,
  count(*) filter (
    where cancelled_at is not null
      and cancelled_at >= date_trunc('month', timezone('utc', now()))
  )::bigint as cancelled_this_month,
  count(*) filter (
    where cancelled_at is null and expired_at is null
  )::bigint as retained_open,
  case
    when count(*) > 0
      then (count(*) filter (where cancelled_at is not null))::numeric / count(*) * 100
    else 0
  end::numeric(8, 2) as churn_rate_pct,
  timezone('utc', now()) as refreshed_at
from public.subscriptions
with no data;

-- ---------------------------------------------------------------------------
-- mv_ltv_metrics (depends on mv_customer_metrics definition; populate after that MV)
-- ---------------------------------------------------------------------------
drop materialized view if exists analytics.mv_ltv_metrics cascade;
create materialized view analytics.mv_ltv_metrics as
select
  1::int as id,
  coalesce(avg(lifetime_revenue_cents), 0)::numeric(18, 4) as avg_ltv_cents,
  coalesce(max(lifetime_revenue_cents), 0)::bigint as max_ltv_cents,
  coalesce(percentile_cont(0.5) within group (order by lifetime_revenue_cents), 0)::numeric(18, 4) as median_ltv_cents,
  count(*) filter (where lifetime_revenue_cents > 0)::bigint as paying_customers,
  timezone('utc', now()) as refreshed_at
from analytics.mv_customer_metrics
with no data;
