-- Phase 9.5c: Loss reprocess helpers + align Subscription Loss with Vimeo rules.
-- Vimeo/user SQL:
--   Web: set_cancellation
--   Non-web: cancelled | expired | disabled
--   Trial loss: free_trial_expired → trial_expired
-- Prefer vott_events.platform (event-time) for loss platform classification.

create or replace function analytics.is_web_platform(p_normalized text)
returns boolean
language sql
immutable
as $$
  select p_normalized = 'Web';
$$;

comment on function analytics.is_web_platform(text) is
  'True when normalize_report_platform bucket is Web (incl. api/vhx aliases).';

create or replace view analytics.v_daily_subscription_metrics as
with base as (
  select
    (e.event_created_at at time zone 'utc')::date as report_date,
    analytics.normalize_report_platform(
      coalesce(
        nullif(trim(v.platform), ''),
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
    analytics.is_web_platform(
      analytics.normalize_report_platform(
        coalesce(
          nullif(trim(v.platform), ''),
          nullif(trim(e.payload ->> 'platform'), ''),
          nullif(trim(c.platform), '')
        )
      )
    ) as is_web
  from public.subscription_events e
  join public.subscriptions s on s.id = e.subscription_id
  join public.customers c on c.id = e.customer_id
  left join public.vott_events v on v.id = e.vott_event_id
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
    -- Match Vimeo: Web → set_cancellation; non-Web → cancelled/expired/disabled
    (
      (is_web and event_type = 'set_cancellation')
      or (not is_web and event_type in ('cancelled', 'expired', 'disabled'))
    ) as is_subscription_loss
  from base
)
select
  report_date,
  platform,
  country,
  product_id,
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
  'Gain/loss from subscription_events. Loss: Web=set_cancellation; non-Web=cancelled/expired/disabled; Trial=trial_expired. Platform prefers vott_events.platform.';

-- Unprocessed loss-topic webhooks (no subscription_events row)
create or replace function public.fn_unprocessed_loss_events(
  p_start_date date,
  p_end_date date,
  p_limit integer default 500
)
returns setof public.vott_events
language sql
stable
security definer
set search_path = public
as $$
  select v.*
  from public.vott_events v
  left join public.subscription_events se on se.vott_event_id = v.id
  where se.id is null
    and v.event_created_at is not null
    and (v.event_created_at at time zone 'utc')::date >= p_start_date
    and (v.event_created_at at time zone 'utc')::date <= p_end_date
    and v.topic in (
      'customer.product.set_cancellation',
      'customer.product.cancelled',
      'customer.product.expired',
      'customer.product.disabled',
      'customer.product.free_trial_expired'
    )
  order by v.event_created_at asc, v.received_at asc
  limit greatest(1, least(coalesce(p_limit, 500), 2000));
$$;

comment on function public.fn_unprocessed_loss_events(date, date, integer) is
  'Loss-topic vott_events with no subscription_events row. For admin reprocess only.';

create or replace function public.fn_unprocessed_loss_event_stats(
  p_start_date date,
  p_end_date date
)
returns table (
  report_date date,
  topic text,
  vott_count bigint,
  with_subscription_event bigint,
  unprocessed bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (v.event_created_at at time zone 'utc')::date as report_date,
    v.topic,
    count(*)::bigint as vott_count,
    count(se.id)::bigint as with_subscription_event,
    count(*) filter (where se.id is null)::bigint as unprocessed
  from public.vott_events v
  left join public.subscription_events se on se.vott_event_id = v.id
  where v.event_created_at is not null
    and (v.event_created_at at time zone 'utc')::date >= p_start_date
    and (v.event_created_at at time zone 'utc')::date <= p_end_date
    and v.topic in (
      'customer.product.set_cancellation',
      'customer.product.cancelled',
      'customer.product.expired',
      'customer.product.disabled',
      'customer.product.free_trial_expired'
    )
  group by 1, 2
  order by 1, 2;
$$;

create or replace function public.fn_combined_loss_coverage(
  p_date date
)
returns table (
  vott_loss_events bigint,
  subscription_events_loss bigint,
  unprocessed bigint,
  coverage_pct numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with vott as (
    select count(*)::bigint as n
    from public.vott_events v
    where (v.event_created_at at time zone 'utc')::date = p_date
      and (
        (
          lower(coalesce(v.platform, '')) = 'web'
          and v.topic = 'customer.product.set_cancellation'
        )
        or (
          lower(coalesce(v.platform, '')) <> 'web'
          and v.topic in (
            'customer.product.cancelled',
            'customer.product.expired',
            'customer.product.disabled'
          )
        )
        or v.topic = 'customer.product.free_trial_expired'
      )
  ),
  se as (
    select count(*)::bigint as n
    from public.subscription_events e
    join public.customers c on c.id = e.customer_id
    left join public.vott_events v on v.id = e.vott_event_id
    where (e.event_created_at at time zone 'utc')::date = p_date
      and (
        e.event_type = 'trial_expired'
        or (
          analytics.is_web_platform(
            analytics.normalize_report_platform(
              coalesce(v.platform, e.payload ->> 'platform', c.platform)
            )
          )
          and e.event_type = 'set_cancellation'
        )
        or (
          not analytics.is_web_platform(
            analytics.normalize_report_platform(
              coalesce(v.platform, e.payload ->> 'platform', c.platform)
            )
          )
          and e.event_type in ('cancelled', 'expired', 'disabled')
        )
      )
  ),
  pending as (
    select count(*)::bigint as n
    from public.vott_events v
    left join public.subscription_events se2 on se2.vott_event_id = v.id
    where se2.id is null
      and (v.event_created_at at time zone 'utc')::date = p_date
      and v.topic in (
        'customer.product.set_cancellation',
        'customer.product.cancelled',
        'customer.product.expired',
        'customer.product.disabled',
        'customer.product.free_trial_expired'
      )
  )
  select
    vott.n,
    se.n,
    pending.n,
    case
      when vott.n = 0 then 100
      else round((se.n::numeric / vott.n::numeric) * 100, 2)
    end as coverage_pct
  from vott, se, pending;
$$;

grant execute on function analytics.is_web_platform(text) to service_role, postgres;
grant execute on function public.fn_unprocessed_loss_events(date, date, integer)
  to service_role, postgres;
grant execute on function public.fn_unprocessed_loss_event_stats(date, date)
  to service_role, postgres;
grant execute on function public.fn_combined_loss_coverage(date)
  to service_role, postgres;

-- Recreate RPC (signature unchanged) so PostgREST refreshes view deps.
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
