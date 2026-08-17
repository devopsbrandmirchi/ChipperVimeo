-- Phase 9.5h: Speed up gain/loss RPC — push date filter to subscription_events,
-- avoid scanning the full view + avoid joining all of vott_events.
-- Platform/status come from timeline payload + customers (handlers already store them).

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
set statement_timeout = '60s'
as $$
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
      e.customer_id,
      lower(coalesce(
        nullif(trim(e.new_status), ''),
        nullif(trim(e.payload ->> 'subscription_status'), '')
      )) as status_at_event,
      analytics.is_web_platform(
        analytics.normalize_report_platform(
          coalesce(
            nullif(trim(e.payload ->> 'platform'), ''),
            nullif(trim(c.platform), '')
          )
        )
      ) as is_web
    from public.subscription_events e
    join public.subscriptions s on s.id = e.subscription_id
    join public.customers c on c.id = e.customer_id
    where e.event_created_at is not null
      and (p_start_date is null or e.event_created_at >= (p_start_date::timestamp at time zone 'utc'))
      and (p_end_date is null or e.event_created_at < ((p_end_date + 1)::timestamp at time zone 'utc'))
  ),
  classified as (
    select
      report_date,
      platform,
      country,
      product_id,
      customer_id,
      (event_type = 'created' or event_type = 'trial_converted') as is_subscription_gain,
      (event_type = 'trial_started') as is_trial_gain,
      (event_type = 'trial_converted') as is_trial_conversion,
      (event_type = 'trial_expired') as is_trial_loss,
      (
        (
          is_web
          and (
            event_type = 'set_cancellation'
            or event_type = 'expired'
            or (event_type = 'charge_failed' and status_at_event = 'expired')
          )
        )
        or (
          not is_web
          and event_type in ('cancelled', 'expired', 'disabled')
        )
      ) as is_subscription_loss
    from base
  ),
  aggregated as (
    select
      c.report_date,
      c.platform,
      c.country,
      c.product_id,
      count(*) filter (where c.is_subscription_gain)::bigint as subscription_gain,
      count(*) filter (where c.is_subscription_loss)::bigint as subscription_loss,
      count(*) filter (where c.is_trial_gain)::bigint as trial_gain,
      count(*) filter (where c.is_trial_loss)::bigint as trial_loss,
      count(*) filter (where c.is_trial_conversion)::bigint as trial_conversion,
      count(*) filter (where c.is_subscription_gain or c.is_trial_gain)::bigint
        as combined_gain,
      count(*) filter (where c.is_subscription_loss or c.is_trial_loss)::bigint
        as combined_loss,
      count(distinct c.customer_id) filter (
        where c.is_subscription_gain or c.is_trial_gain
      )::bigint as unique_customers_gain,
      count(distinct c.customer_id) filter (
        where c.is_subscription_loss or c.is_trial_loss
      )::bigint as unique_customers_loss
    from classified c
    group by c.report_date, c.platform, c.country, c.product_id
  )
  select
    a.report_date,
    a.platform,
    a.country,
    a.product_id,
    a.subscription_gain,
    a.subscription_loss,
    a.trial_gain,
    a.trial_loss,
    a.trial_conversion,
    a.combined_gain,
    a.combined_loss,
    a.unique_customers_gain,
    a.unique_customers_loss
  from aggregated a
  where (
      p_platform is null
      or a.platform = analytics.normalize_report_platform(p_platform)
      or a.platform = p_platform
    )
    and (p_country is null or a.country = p_country)
    and (p_product_id is null or a.product_id = p_product_id)
  order by a.report_date, a.platform, a.country, a.product_id;
$$;

comment on function analytics.fn_subscription_metrics(date, date, text, text, uuid) is
  'Gain/loss metrics with date filter pushed to subscription_events.event_created_at. No vott_events join.';

-- Same treatment for day×country RPC
create or replace function analytics.fn_subscription_metrics_day_country(
  p_start_date date,
  p_end_date date,
  p_country text default null
)
returns table (
  report_date date,
  country text,
  subscription_gain bigint,
  subscription_loss bigint,
  trial_gain bigint,
  trial_loss bigint,
  trial_conversion bigint,
  combined_gain bigint,
  combined_loss bigint,
  unique_customers_gain bigint,
  unique_customers_loss bigint,
  unique_subscription_gain bigint,
  unique_subscription_loss bigint,
  unique_trial_gain bigint,
  unique_trial_loss bigint
)
language sql
stable
security definer
set search_path = analytics, public
set statement_timeout = '60s'
as $$
  with base as (
    select
      (e.event_created_at at time zone 'utc')::date as report_date,
      coalesce(nullif(trim(c.country), ''), 'unknown') as country,
      e.event_type,
      e.customer_id,
      lower(coalesce(
        nullif(trim(e.new_status), ''),
        nullif(trim(e.payload ->> 'subscription_status'), '')
      )) as status_at_event,
      analytics.is_web_platform(
        analytics.normalize_report_platform(
          coalesce(
            nullif(trim(e.payload ->> 'platform'), ''),
            nullif(trim(c.platform), '')
          )
        )
      ) as is_web
    from public.subscription_events e
    join public.subscriptions s on s.id = e.subscription_id
    join public.customers c on c.id = e.customer_id
    where e.event_created_at is not null
      and (p_start_date is null or e.event_created_at >= (p_start_date::timestamp at time zone 'utc'))
      and (p_end_date is null or e.event_created_at < ((p_end_date + 1)::timestamp at time zone 'utc'))
  ),
  classified as (
    select
      report_date,
      country,
      customer_id,
      (event_type = 'created' or event_type = 'trial_converted') as is_subscription_gain,
      (event_type = 'trial_started') as is_trial_gain,
      (event_type = 'trial_converted') as is_trial_conversion,
      (event_type = 'trial_expired') as is_trial_loss,
      (
        (
          is_web
          and (
            event_type = 'set_cancellation'
            or event_type = 'expired'
            or (event_type = 'charge_failed' and status_at_event = 'expired')
          )
        )
        or (
          not is_web
          and event_type in ('cancelled', 'expired', 'disabled')
        )
      ) as is_subscription_loss
    from base
  )
  select
    report_date,
    country,
    count(*) filter (where is_subscription_gain)::bigint as subscription_gain,
    count(*) filter (where is_subscription_loss)::bigint as subscription_loss,
    count(*) filter (where is_trial_gain)::bigint as trial_gain,
    count(*) filter (where is_trial_loss)::bigint as trial_loss,
    count(*) filter (where is_trial_conversion)::bigint as trial_conversion,
    count(*) filter (where is_subscription_gain or is_trial_gain)::bigint as combined_gain,
    count(*) filter (where is_subscription_loss or is_trial_loss)::bigint as combined_loss,
    count(distinct customer_id) filter (
      where is_subscription_gain or is_trial_gain
    )::bigint as unique_customers_gain,
    count(distinct customer_id) filter (
      where is_subscription_loss or is_trial_loss
    )::bigint as unique_customers_loss,
    count(distinct customer_id) filter (where is_subscription_gain)::bigint
      as unique_subscription_gain,
    count(distinct customer_id) filter (where is_subscription_loss)::bigint
      as unique_subscription_loss,
    count(distinct customer_id) filter (where is_trial_gain)::bigint
      as unique_trial_gain,
    count(distinct customer_id) filter (where is_trial_loss)::bigint
      as unique_trial_loss
  from classified
  where (p_country is null or country = p_country)
  group by report_date, country
  order by report_date asc, country asc;
$$;

grant execute on function analytics.fn_subscription_metrics(date, date, text, text, uuid)
  to service_role;
grant execute on function analytics.fn_subscription_metrics_day_country(date, date, text)
  to service_role;

notify pgrst, 'reload schema';
