-- Phase 9.5: indexes for daily snapshots + builder date scans on public tables.

create index if not exists daily_subscription_metrics_date_idx
  on analytics.daily_subscription_metrics (date desc);

create index if not exists daily_trial_metrics_date_idx
  on analytics.daily_trial_metrics (date desc);

create index if not exists daily_payment_metrics_date_idx
  on analytics.daily_payment_metrics (date desc);

create index if not exists daily_customer_metrics_date_idx
  on analytics.daily_customer_metrics (date desc);

create index if not exists daily_product_metrics_date_idx
  on analytics.daily_product_metrics (date desc);

create index if not exists daily_product_metrics_product_id_idx
  on analytics.daily_product_metrics (product_id);

create index if not exists daily_country_metrics_date_idx
  on analytics.daily_country_metrics (date desc);

create index if not exists daily_country_metrics_country_idx
  on analytics.daily_country_metrics (country);

create index if not exists daily_platform_metrics_date_idx
  on analytics.daily_platform_metrics (date desc);

create index if not exists daily_platform_metrics_platform_idx
  on analytics.daily_platform_metrics (platform);

-- Supporting indexes on operational tables for builder date filters
create index if not exists subscriptions_cancelled_at_idx
  on public.subscriptions (cancelled_at)
  where cancelled_at is not null;

create index if not exists subscriptions_expired_at_idx
  on public.subscriptions (expired_at)
  where expired_at is not null;

create index if not exists subscriptions_free_trial_start_idx
  on public.subscriptions (free_trial_start)
  where free_trial_start is not null;

create index if not exists subscriptions_free_trial_end_idx
  on public.subscriptions (free_trial_end)
  where free_trial_end is not null;

create index if not exists customers_first_seen_at_idx
  on public.customers (first_seen_at)
  where first_seen_at is not null;
