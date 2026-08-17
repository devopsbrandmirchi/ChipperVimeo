-- Fix dashboard Trials / Cancelled / Active stock definitions.
-- Previous bug (migration 014):
--   free_trial_subscriptions = ALL rows with free_trial=true (includes ended trials)
--   cancelled_subscriptions  = ALL rows with cancelled_at set (lifetime)
--   active_subscribers       = customers.subscription_status text (different grain)
-- Correct current-stock definitions (business spec):
--   Active  = distinct customers with ≥1 open paid (non-trial, non-paused) subscription
--   Trials  = open free-trial subscriptions (cancelled_at/expired_at null, free_trial=true)
--   Cancelled = subscriptions currently cancelled (cancelled_at set, not expired)

drop materialized view if exists analytics.mv_dashboard cascade;

create materialized view analytics.mv_dashboard as
with cust as (
  select
    count(*)::bigint as total_customers,
    count(*) filter (
      where first_seen_at is not null
        and first_seen_at::date = (timezone('utc', now()))::date
    )::bigint as new_customers_today
  from public.customers
),
subs as (
  select
    count(*)::bigint as total_subscriptions,
    -- Open paid subscriptions (row count)
    count(*) filter (
      where cancelled_at is null
        and expired_at is null
        and coalesce(free_trial, false) is not true
        and (status is null or lower(status) not like '%pause%')
    )::bigint as active_subscriptions,
    -- Distinct customers with ≥1 open paid subscription (dashboard "Active subscribers")
    count(distinct customer_id) filter (
      where cancelled_at is null
        and expired_at is null
        and coalesce(free_trial, false) is not true
        and (status is null or lower(status) not like '%pause%')
    )::bigint as active_subscribers,
    count(*) filter (
      where cancelled_at is null
        and expired_at is null
        and status is not null
        and lower(status) like '%pause%'
    )::bigint as paused_subscriptions,
    -- Current cancelled stock (not lifetime): cancelled, not expired
    count(*) filter (
      where cancelled_at is not null
        and expired_at is null
    )::bigint as cancelled_subscriptions,
    count(*) filter (
      where expired_at is not null
    )::bigint as expired_subscriptions,
    -- Current open trials only (not lifetime free_trial flag)
    count(*) filter (
      where cancelled_at is null
        and expired_at is null
        and free_trial is true
    )::bigint as free_trial_subscriptions,
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
    -- Cohort-ish proxy: all rows that ever had a trial start stamp
    count(*) filter (where free_trial_start is not null)::bigint as trials_ever,
    count(*) filter (
      where free_trial_start is not null
        and free_trial is not true
        and cancelled_at is null
        and expired_at is null
    )::bigint as converted_still_open
  from public.subscriptions
)
select
  1::int as id,
  cust.total_customers,
  cust.new_customers_today,
  subs.active_subscribers,
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
    when subs.active_subscribers > 0
      then (mrr.mrr_cents::numeric / subs.active_subscribers)::numeric(18, 4)
    else 0
  end as arpu_cents,
  case
    when pay.successful_payments > 0 and cust.total_customers > 0
      then (pay.lifetime_revenue_cents::numeric / nullif(cust.total_customers, 0))::numeric(18, 4)
    else 0
  end as arppu_proxy_cents,
  case
    when trial_conv.trials_ever > 0
      then (trial_conv.converted_still_open::numeric / trial_conv.trials_ever * 100)::numeric(8, 2)
    else 0
  end as trial_conversion_pct,
  -- Period churn is not this MV's job; keep placeholder ratio on current stocks
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
  'KPI snapshot. Active=distinct open paid customers; Trials=open free trials; Cancelled=cancelled_at set & not expired. Refresh: analytics.refresh_dashboard() (non-concurrent first fill).';

create unique index if not exists mv_dashboard_id_uidx
  on analytics.mv_dashboard (id);

-- First fill must be non-concurrent
refresh materialized view analytics.mv_dashboard;

grant select on analytics.mv_dashboard to service_role, authenticated;

notify pgrst, 'reload schema';
