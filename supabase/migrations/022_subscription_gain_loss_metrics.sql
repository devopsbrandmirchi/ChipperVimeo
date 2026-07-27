-- Phase 9.5: Subscription / Trial Gain-Loss metrics from subscription_events.
-- Never reads public.vott_events. Business date = event_created_at (UTC).

create or replace function analytics.normalize_report_platform(p_platform text)
returns text
language sql
immutable
as $$
  select case
    when p_platform is null or trim(p_platform) = '' then 'OTHER'
    when lower(p_platform) in ('web', 'www', 'browser', 'desktop', 'vhx') then 'Web'
    when lower(p_platform) in ('ios', 'iphone', 'ipad') then 'iOS'
    when lower(p_platform) in ('android') then 'Android'
    when lower(p_platform) in ('apple_tv', 'appletv', 'tvos') then 'Apple TV'
    when lower(p_platform) in ('fire_tv', 'firetv', 'amazon') then 'Fire TV'
    when lower(p_platform) in ('google_tv', 'googletv', 'android_tv') then 'Google TV'
    when lower(p_platform) in ('roku') then 'Roku'
    else 'OTHER'
  end;
$$;

comment on function analytics.normalize_report_platform(text) is
  'Maps customers.platform into report buckets: Web, iOS, Android, Apple TV, Fire TV, Google TV, Roku, OTHER.';

-- Store platforms use cancelled/expired/disabled for Subscription Loss.
-- Web/direct use set_cancellation only.
create or replace function analytics.is_store_platform(p_normalized text)
returns boolean
language sql
immutable
as $$
  select p_normalized in (
    'iOS', 'Android', 'Apple TV', 'Fire TV', 'Google TV', 'Roku'
  );
$$;

create or replace view analytics.v_daily_subscription_metrics as
with base as (
  select
    (e.event_created_at at time zone 'utc')::date as report_date,
    analytics.normalize_report_platform(c.platform) as platform,
    coalesce(nullif(trim(c.country), ''), 'unknown') as country,
    s.product_id,
    e.event_type,
    e.subscription_id,
    e.customer_id,
    analytics.is_store_platform(
      analytics.normalize_report_platform(c.platform)
    ) as is_store
  from public.subscription_events e
  join public.subscriptions s on s.id = e.subscription_id
  join public.customers c on c.id = e.customer_id
  where e.event_created_at is not null
    and s.product_id is not null
),
classified as (
  select
    report_date,
    platform,
    country,
    product_id,
    subscription_id,
    customer_id,
    event_type,
    -- Subscription Gain: paid created + trial_converted
    (event_type = 'created' or event_type = 'trial_converted') as is_subscription_gain,
    (event_type = 'trial_started') as is_trial_gain,
    (event_type = 'trial_converted') as is_trial_conversion,
    (event_type = 'trial_expired') as is_trial_loss,
    (
      (not is_store and event_type = 'set_cancellation')
      or (is_store and event_type in ('cancelled', 'expired', 'disabled'))
    ) as is_subscription_loss
  from base
)
select
  report_date,
  platform,
  country,
  product_id,
  count(distinct subscription_id) filter (where is_subscription_gain)::bigint
    as subscription_gain,
  count(distinct subscription_id) filter (where is_subscription_loss)::bigint
    as subscription_loss,
  count(distinct subscription_id) filter (where is_trial_gain)::bigint
    as trial_gain,
  count(distinct subscription_id) filter (where is_trial_loss)::bigint
    as trial_loss,
  count(distinct subscription_id) filter (where is_trial_conversion)::bigint
    as trial_conversion,
  (
    count(distinct subscription_id) filter (where is_subscription_gain)
    + count(distinct subscription_id) filter (where is_trial_gain)
  )::bigint as combined_gain,
  (
    count(distinct subscription_id) filter (where is_subscription_loss)
    + count(distinct subscription_id) filter (where is_trial_loss)
  )::bigint as combined_loss,
  count(distinct customer_id) filter (
    where is_subscription_gain or is_trial_gain
  )::bigint as unique_customers_gain,
  count(distinct customer_id) filter (
    where is_subscription_loss or is_trial_loss
  )::bigint as unique_customers_loss
from classified
group by report_date, platform, country, product_id;

comment on view analytics.v_daily_subscription_metrics is
  'Gain/loss daily grain by platform/country/product from subscription_events.event_created_at. See docs/analytics/business-metrics.md.';

create or replace function analytics.fn_subscription_metrics(
  p_start_date date,
  p_end_date date,
  p_platform text default null,
  p_country text default null,
  p_product_id uuid default null
)
returns table (
  report_date date,
  platform text,
  country text,
  product_id uuid,
  subscription_gain bigint,
  subscription_loss bigint,
  trial_gain bigint,
  trial_loss bigint,
  trial_conversion bigint,
  combined_gain bigint,
  combined_loss bigint,
  unique_customers_gain bigint,
  unique_customers_loss bigint
)
language sql
stable
security definer
set search_path = analytics, public
as $$
  select
    v.report_date,
    v.platform,
    v.country,
    v.product_id,
    v.subscription_gain,
    v.subscription_loss,
    v.trial_gain,
    v.trial_loss,
    v.trial_conversion,
    v.combined_gain,
    v.combined_loss,
    v.unique_customers_gain,
    v.unique_customers_loss
  from analytics.v_daily_subscription_metrics v
  where (p_start_date is null or v.report_date >= p_start_date)
    and (p_end_date is null or v.report_date <= p_end_date)
    and (
      p_platform is null
      or v.platform = analytics.normalize_report_platform(p_platform)
      or v.platform = p_platform
    )
    and (p_country is null or v.country = p_country)
    and (p_product_id is null or v.product_id = p_product_id)
  order by v.report_date, v.platform, v.country, v.product_id;
$$;

grant execute on function analytics.normalize_report_platform(text) to service_role;
grant execute on function analytics.is_store_platform(text) to service_role;
grant execute on function analytics.fn_subscription_metrics(date, date, text, text, uuid)
  to service_role;
grant select on analytics.v_daily_subscription_metrics to service_role, authenticated;

notify pgrst, 'reload schema';
