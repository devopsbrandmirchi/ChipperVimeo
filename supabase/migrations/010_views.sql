-- Phase 2: placeholder analytics views.
-- Plain views only (NOT materialized). Query normalized tables only — never vott_events.
-- Future phases will extend metrics (LTV, cohorts, retention, recovered payments, etc.).

-- ---------------------------------------------------------------------------
-- vw_customer_metrics
-- Snapshot counts by subscription_status / country / platform.
-- ---------------------------------------------------------------------------
create or replace view public.vw_customer_metrics as
select
  count(*)::bigint as total_customers,
  count(*) filter (
    where subscription_status is not null
      and lower(subscription_status) in ('active', 'enabled', 'subscribed')
  )::bigint as active_subscribers,
  count(*) filter (
    where subscription_status is not null
      and lower(subscription_status) like '%trial%'
  )::bigint as trial_customers,
  count(distinct country) filter (where country is not null)::bigint as countries_with_customers,
  count(distinct platform) filter (where platform is not null)::bigint as platforms_with_customers,
  count(*) filter (
    where marketing_opt_in is true
  )::bigint as marketing_opt_in_count,
  now() as computed_at
from public.customers;

comment on view public.vw_customer_metrics is
  'Placeholder customer aggregates. Extended in later analytics phases.';

-- ---------------------------------------------------------------------------
-- vw_subscription_metrics
-- Counts by status and billing_frequency.
-- ---------------------------------------------------------------------------
create or replace view public.vw_subscription_metrics as
select
  count(*)::bigint as total_subscriptions,
  count(*) filter (
    where cancelled_at is null and expired_at is null
  )::bigint as open_subscriptions,
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
  coalesce(sum(price_cents) filter (
    where cancelled_at is null and expired_at is null
  ), 0)::bigint as open_mrr_proxy_cents,
  now() as computed_at
from public.subscriptions;

comment on view public.vw_subscription_metrics is
  'Placeholder subscription aggregates. open_mrr_proxy_cents is a rough sum of open price_cents (not true MRR).';

-- ---------------------------------------------------------------------------
-- vw_product_metrics
-- Per-product subscription counts and revenue stubs.
-- ---------------------------------------------------------------------------
create or replace view public.vw_product_metrics as
select
  p.id as product_id,
  p.vimeo_product_id,
  p.name as product_name,
  p.currency,
  p.active,
  count(s.id)::bigint as subscription_count,
  count(s.id) filter (
    where s.cancelled_at is null and s.expired_at is null
  )::bigint as open_subscription_count,
  coalesce(sum(pay.amount_cents) filter (
    where pay.status is null
       or lower(pay.status) in ('succeeded', 'paid', 'success', 'completed')
  ), 0)::bigint as revenue_cents,
  now() as computed_at
from public.products p
left join public.subscriptions s on s.product_id = p.id
left join public.payments pay on pay.product_id = p.id
group by p.id, p.vimeo_product_id, p.name, p.currency, p.active;

comment on view public.vw_product_metrics is
  'Placeholder per-product metrics. Revenue is sum of successful payment amount_cents when present.';

-- ---------------------------------------------------------------------------
-- vw_country_metrics
-- ---------------------------------------------------------------------------
create or replace view public.vw_country_metrics as
select
  coalesce(c.country, 'unknown') as country,
  count(distinct c.id)::bigint as customer_count,
  count(distinct s.id) filter (
    where s.cancelled_at is null and s.expired_at is null
  )::bigint as open_subscription_count,
  coalesce(sum(pay.amount_cents) filter (
    where pay.status is null
       or lower(pay.status) in ('succeeded', 'paid', 'success', 'completed')
  ), 0)::bigint as revenue_cents,
  now() as computed_at
from public.customers c
left join public.subscriptions s on s.customer_id = c.id
left join public.payments pay on pay.customer_id = c.id
group by coalesce(c.country, 'unknown');

comment on view public.vw_country_metrics is
  'Placeholder country-level customer and revenue metrics.';

-- ---------------------------------------------------------------------------
-- vw_platform_metrics
-- ---------------------------------------------------------------------------
create or replace view public.vw_platform_metrics as
select
  coalesce(c.platform, 'unknown') as platform,
  count(distinct c.id)::bigint as customer_count,
  count(distinct s.id) filter (
    where s.cancelled_at is null and s.expired_at is null
  )::bigint as open_subscription_count,
  coalesce(sum(pay.amount_cents) filter (
    where pay.status is null
       or lower(pay.status) in ('succeeded', 'paid', 'success', 'completed')
  ), 0)::bigint as revenue_cents,
  now() as computed_at
from public.customers c
left join public.subscriptions s on s.customer_id = c.id
left join public.payments pay on pay.customer_id = c.id
group by coalesce(c.platform, 'unknown');

comment on view public.vw_platform_metrics is
  'Placeholder platform-level customer and revenue metrics.';

-- ---------------------------------------------------------------------------
-- vw_daily_metrics
-- Day buckets from payment_date (fallback: subscription started_at / customer first_seen).
-- ---------------------------------------------------------------------------
create or replace view public.vw_daily_metrics as
with payment_days as (
  select
    (payment_date at time zone 'utc')::date as metric_date,
    count(*)::bigint as payment_attempts,
    count(*) filter (
      where status is null
         or lower(status) in ('succeeded', 'paid', 'success', 'completed')
    )::bigint as successful_payments,
    count(*) filter (
      where status is not null
        and lower(status) in ('failed', 'failure', 'declined', 'charge_failed')
    )::bigint as failed_payments,
    coalesce(sum(amount_cents) filter (
      where status is null
         or lower(status) in ('succeeded', 'paid', 'success', 'completed')
    ), 0)::bigint as revenue_cents
  from public.payments
  where payment_date is not null
  group by (payment_date at time zone 'utc')::date
),
new_customers as (
  select
    (first_seen_at at time zone 'utc')::date as metric_date,
    count(*)::bigint as new_customers
  from public.customers
  where first_seen_at is not null
  group by (first_seen_at at time zone 'utc')::date
),
new_subscriptions as (
  select
    (started_at at time zone 'utc')::date as metric_date,
    count(*)::bigint as new_subscriptions
  from public.subscriptions
  where started_at is not null
  group by (started_at at time zone 'utc')::date
),
all_dates as (
  select metric_date from payment_days
  union
  select metric_date from new_customers
  union
  select metric_date from new_subscriptions
)
select
  d.metric_date,
  coalesce(nc.new_customers, 0)::bigint as new_customers,
  coalesce(ns.new_subscriptions, 0)::bigint as new_subscriptions,
  coalesce(pd.payment_attempts, 0)::bigint as payment_attempts,
  coalesce(pd.successful_payments, 0)::bigint as successful_payments,
  coalesce(pd.failed_payments, 0)::bigint as failed_payments,
  coalesce(pd.revenue_cents, 0)::bigint as revenue_cents,
  now() as computed_at
from all_dates d
left join payment_days pd on pd.metric_date = d.metric_date
left join new_customers nc on nc.metric_date = d.metric_date
left join new_subscriptions ns on ns.metric_date = d.metric_date
order by d.metric_date;

comment on view public.vw_daily_metrics is
  'Placeholder daily metrics from normalized tables. Empty until Phase 3 populates data.';

notify pgrst, 'reload schema';
