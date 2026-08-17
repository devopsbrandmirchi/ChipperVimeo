-- Fix PostgREST 1000-row truncation of fn_subscription_metrics.
-- Fine grain (day × platform × country × product) exceeded max_rows, so later
-- dates never reached the API (UI showed only early days with undercounted totals).
-- New RPC returns one compact grain per call: day | platform | country | product.

create or replace function analytics.fn_subscription_metrics_grouped(
  p_start_date date,
  p_end_date date,
  p_grain text default 'day',
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
      and (
        p_platform is null
        or analytics.normalize_report_platform(
          coalesce(
            nullif(trim(e.payload ->> 'platform'), ''),
            nullif(trim(c.platform), '')
          )
        ) = analytics.normalize_report_platform(p_platform)
        or analytics.normalize_report_platform(
          coalesce(
            nullif(trim(e.payload ->> 'platform'), ''),
            nullif(trim(c.platform), '')
          )
        ) = p_platform
      )
      and (p_country is null or coalesce(nullif(trim(c.country), ''), 'unknown') = p_country)
      and (p_product_id is null or s.product_id = p_product_id)
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
  )
  select
    case when lower(p_grain) = 'day' then c.report_date else null end as report_date,
    case when lower(p_grain) = 'platform' then c.platform else null end as platform,
    case when lower(p_grain) = 'country' then c.country else null end as country,
    case when lower(p_grain) = 'product' then c.product_id else null end as product_id,
    count(*) filter (where c.is_subscription_gain)::bigint as subscription_gain,
    count(*) filter (where c.is_subscription_loss)::bigint as subscription_loss,
    count(*) filter (where c.is_trial_gain)::bigint as trial_gain,
    count(*) filter (where c.is_trial_loss)::bigint as trial_loss,
    count(*) filter (where c.is_trial_conversion)::bigint as trial_conversion,
    count(*) filter (where c.is_subscription_gain or c.is_trial_gain)::bigint as combined_gain,
    count(*) filter (where c.is_subscription_loss or c.is_trial_loss)::bigint as combined_loss,
    count(distinct c.customer_id) filter (
      where c.is_subscription_gain or c.is_trial_gain
    )::bigint as unique_customers_gain,
    count(distinct c.customer_id) filter (
      where c.is_subscription_loss or c.is_trial_loss
    )::bigint as unique_customers_loss
  from classified c
  group by 1, 2, 3, 4
  order by 1 nulls last, 2 nulls last, 3 nulls last, 4 nulls last;
$$;

comment on function analytics.fn_subscription_metrics_grouped(date, date, text, text, text, uuid) is
  'Compact gain/loss aggregates by grain=day|platform|country|product to stay under PostgREST max_rows.';

grant execute on function analytics.fn_subscription_metrics_grouped(
  date, date, text, text, text, uuid
) to service_role;

notify pgrst, 'reload schema';
