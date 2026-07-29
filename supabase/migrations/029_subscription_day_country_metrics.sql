-- Phase 9.5f: Day-by-day country gain/loss + unique customers (normalized; no raw vott_events).
-- Business date = subscription_events.event_created_at (UTC).

create or replace view analytics.v_daily_subscription_country_metrics as
with base as (
  select
    (e.event_created_at at time zone 'utc')::date as report_date,
    coalesce(nullif(trim(c.country), ''), 'unknown') as country,
    e.event_type,
    e.customer_id,
    -- Used only for charge_failed rule: count only when subscription_status at event is 'expired'
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
),
classified as (
  select
    report_date,
    country,
    event_type,
    customer_id,
    (event_type = 'created' or event_type = 'trial_converted') as is_subscription_gain,
    (event_type = 'trial_started') as is_trial_gain,
    (event_type = 'trial_converted') as is_trial_conversion,
    (event_type = 'trial_expired') as is_trial_loss,
    (
      (is_web and (
        event_type = 'set_cancellation'
        or event_type = 'expired'
        or (event_type = 'charge_failed' and status_at_event = 'expired')
      ))
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
  )::bigint as unique_customers_loss
from classified
group by report_date, country;

comment on view analytics.v_daily_subscription_country_metrics is
  'Day-by-day country grain of gain/loss from subscription_events.event_created_at (UTC). Unique customers counted at (report_date,country) distinct customer_id grain.';

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
  unique_customers_loss bigint
)
language sql
stable
security definer
set search_path = analytics, public
as $$
  select
    v.report_date,
    v.country,
    v.subscription_gain,
    v.subscription_loss,
    v.trial_gain,
    v.trial_loss,
    v.trial_conversion,
    v.combined_gain,
    v.combined_loss,
    v.unique_customers_gain,
    v.unique_customers_loss
  from analytics.v_daily_subscription_country_metrics v
  where (p_start_date is null or v.report_date >= p_start_date)
    and (p_end_date is null or v.report_date <= p_end_date)
    and (p_country is null or v.country = p_country)
  order by v.report_date asc, v.country asc;
$$;

grant execute on function analytics.fn_subscription_metrics_day_country(
  date,
  date,
  text
) to service_role;
grant select on analytics.v_daily_subscription_country_metrics to service_role, authenticated;

notify pgrst, 'reload schema';

