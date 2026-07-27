-- Phase 9.5b: Align gain/loss counts with Vimeo event semantics.
-- Vimeo "Gained" ≈ count of created + free_trial_created + free_trial_converted webhooks.
-- Our Combined Gain = created + trial_started + trial_converted on subscription_events.
-- Switch from count(distinct subscription_id) → count(*) (one row per processed webhook).
-- Keep rows even when subscriptions.product_id is null.
-- Expand platform aliases toward Vimeo OTT labels.

create or replace function analytics.normalize_report_platform(p_platform text)
returns text
language sql
immutable
as $$
  select case
    when p_platform is null or trim(p_platform) = '' then 'OTHER'
    when lower(p_platform) in (
      'web', 'www', 'browser', 'desktop', 'vhx', 'api'
    ) then 'Web'
    when lower(p_platform) in ('ios', 'iphone', 'ipad') then 'iOS'
    when lower(p_platform) in ('android') then 'Android'
    when lower(p_platform) in (
      'apple_tv', 'appletv', 'tvos', 'apple tv'
    ) then 'Apple TV'
    when lower(p_platform) in (
      'fire_tv', 'firetv', 'amazon', 'amazon fire tv', 'amazon_fire_tv'
    ) then 'Fire TV'
    when lower(p_platform) in (
      'google_tv', 'googletv', 'android_tv', 'android tv', 'androidtv'
    ) then 'Google TV'
    when lower(p_platform) in ('roku') then 'Roku'
    when lower(p_platform) in (
      'vizio', 'vizio_tv', 'vizio tv',
      'amazon fire tablet', 'amazon_fire_tablet', 'fire_tablet', 'fire tablet'
    ) then 'OTHER'
    else 'OTHER'
  end;
$$;

comment on function analytics.normalize_report_platform(text) is
  'Maps platform strings into report buckets (Web, iOS, Android, Apple TV, Fire TV, Google TV, Roku, OTHER). Aliases include Vimeo OTT labels (tvOS, Android TV, Amazon Fire TV, API→Web).';

create or replace view analytics.v_daily_subscription_metrics as
with base as (
  select
    (e.event_created_at at time zone 'utc')::date as report_date,
    analytics.normalize_report_platform(
      coalesce(
        nullif(trim(e.payload ->> 'platform'), ''),
        nullif(trim(c.platform), '')
      )
    ) as platform,
    coalesce(nullif(trim(c.country), ''), 'unknown') as country,
    s.product_id,
    e.event_type,
    e.id as event_id,
    e.subscription_id,
    e.customer_id,
    analytics.is_store_platform(
      analytics.normalize_report_platform(
        coalesce(
          nullif(trim(e.payload ->> 'platform'), ''),
          nullif(trim(c.platform), '')
        )
      )
    ) as is_store
  from public.subscription_events e
  join public.subscriptions s on s.id = e.subscription_id
  join public.customers c on c.id = e.customer_id
  where e.event_created_at is not null
),
classified as (
  select
    report_date,
    platform,
    country,
    product_id,
    event_id,
    subscription_id,
    customer_id,
    event_type,
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
  -- Event counts (align with Vimeo webhook/event totals), not distinct subscriptions
  count(*) filter (where is_subscription_gain)::bigint as subscription_gain,
  count(*) filter (where is_subscription_loss)::bigint as subscription_loss,
  count(*) filter (where is_trial_gain)::bigint as trial_gain,
  count(*) filter (where is_trial_loss)::bigint as trial_loss,
  count(*) filter (where is_trial_conversion)::bigint as trial_conversion,
  count(*) filter (where is_subscription_gain or is_trial_gain)::bigint
    as combined_gain,
  count(*) filter (where is_subscription_loss or is_trial_loss)::bigint
    as combined_loss,
  count(distinct customer_id) filter (
    where is_subscription_gain or is_trial_gain
  )::bigint as unique_customers_gain,
  count(distinct customer_id) filter (
    where is_subscription_loss or is_trial_loss
  )::bigint as unique_customers_loss
from classified
group by report_date, platform, country, product_id;

comment on view analytics.v_daily_subscription_metrics is
  'Gain/loss daily grain from subscription_events.event_created_at. Combined Gain = count of created + trial_started + trial_converted events (Vimeo Gained-equivalent). Never reads vott_events.';

-- Recreate RPC so PostgREST picks up view column semantics (signature unchanged).
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

notify pgrst, 'reload schema';
