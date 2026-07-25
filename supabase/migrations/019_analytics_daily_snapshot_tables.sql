-- Phase 9.5: historical daily snapshot tables (analytics schema).
-- Source of truth for date-based reporting. Does not replace analytics.mv_* KPI caches.

-- 1. Subscriptions
create table if not exists analytics.daily_subscription_metrics (
  date date primary key,
  new_subscriptions bigint not null default 0,
  renewals bigint not null default 0,
  cancellations bigint not null default 0,
  expirations bigint not null default 0,
  paused bigint not null default 0,
  resumed bigint not null default 0,
  active_subscriptions bigint not null default 0,
  net_growth bigint not null default 0,
  churn_rate numeric(8, 2) not null default 0,
  built_at timestamptz not null default timezone('utc', now())
);

comment on table analytics.daily_subscription_metrics is
  'Daily subscription lifecycle snapshot. Built by analytics.build_daily_snapshots.';

-- 2. Trials
create table if not exists analytics.daily_trial_metrics (
  date date primary key,
  trials_started bigint not null default 0,
  trials_converted bigint not null default 0,
  trials_expired bigint not null default 0,
  conversion_rate numeric(8, 2) not null default 0,
  built_at timestamptz not null default timezone('utc', now())
);

-- 3. Payments
create table if not exists analytics.daily_payment_metrics (
  date date primary key,
  successful_payments bigint not null default 0,
  failed_payments bigint not null default 0,
  recovered_payments bigint not null default 0,
  payment_success_rate numeric(8, 2) not null default 0,
  revenue_cents bigint not null default 0,
  built_at timestamptz not null default timezone('utc', now())
);

-- 4. Customers
create table if not exists analytics.daily_customer_metrics (
  date date primary key,
  new_customers bigint not null default 0,
  active_customers bigint not null default 0,
  returning_customers bigint not null default 0,
  built_at timestamptz not null default timezone('utc', now())
);

-- 5. Products
create table if not exists analytics.daily_product_metrics (
  date date not null,
  product_id uuid not null,
  product_name text,
  active_subscribers bigint not null default 0,
  new_subscribers bigint not null default 0,
  revenue bigint not null default 0,
  built_at timestamptz not null default timezone('utc', now()),
  primary key (date, product_id)
);

-- 6. Countries
create table if not exists analytics.daily_country_metrics (
  date date not null,
  country text not null,
  active_subscribers bigint not null default 0,
  new_subscribers bigint not null default 0,
  revenue bigint not null default 0,
  built_at timestamptz not null default timezone('utc', now()),
  primary key (date, country)
);

-- 7. Platforms
create table if not exists analytics.daily_platform_metrics (
  date date not null,
  platform text not null,
  active_subscribers bigint not null default 0,
  new_subscribers bigint not null default 0,
  revenue bigint not null default 0,
  built_at timestamptz not null default timezone('utc', now()),
  primary key (date, platform)
);

grant select on analytics.daily_subscription_metrics to service_role, authenticated;
grant select on analytics.daily_trial_metrics to service_role, authenticated;
grant select on analytics.daily_payment_metrics to service_role, authenticated;
grant select on analytics.daily_customer_metrics to service_role, authenticated;
grant select on analytics.daily_product_metrics to service_role, authenticated;
grant select on analytics.daily_country_metrics to service_role, authenticated;
grant select on analytics.daily_platform_metrics to service_role, authenticated;
