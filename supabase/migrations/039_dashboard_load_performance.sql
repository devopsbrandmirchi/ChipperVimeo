-- Phase: speed up dashboard load paths
-- 1) Index-friendly live today KPIs (timestamptz ranges, not ::date)
-- 2) Single-scan multi-grain gain/loss RPC (replaces 4 parallel scans)

create index if not exists subscriptions_renewal_date_idx
  on public.subscriptions (renewal_date)
  where renewal_date is not null and cancelled_at is null;

create or replace function analytics.get_dashboard_today_kpis()
returns table (
  new_customers_today bigint,
  renewals_today bigint,
  cancelled_today bigint,
  revenue_today_cents bigint,
  as_of timestamptz
)
language sql
stable
security definer
set search_path = analytics, public
set statement_timeout = '15s'
as $$
  with bounds as (
    select
      (timezone('utc', now()))::date as d,
      ((timezone('utc', now()))::date)::timestamp at time zone 'utc' as day_start,
      (((timezone('utc', now()))::date + 1)::timestamp at time zone 'utc') as day_end
  )
  select
    (
      select count(*)::bigint
      from public.customers c, bounds b
      where c.first_seen_at is not null
        and c.first_seen_at >= b.day_start
        and c.first_seen_at < b.day_end
    ) as new_customers_today,
    (
      select count(*)::bigint
      from public.subscriptions s, bounds b
      where s.cancelled_at is null
        and s.renewal_date is not null
        and s.renewal_date >= b.day_start
        and s.renewal_date < b.day_end
    ) as renewals_today,
    (
      select count(*)::bigint
      from public.subscriptions s, bounds b
      where s.cancelled_at is not null
        and s.cancelled_at >= b.day_start
        and s.cancelled_at < b.day_end
    ) as cancelled_today,
    (
      select coalesce(sum(p.amount_cents), 0)::bigint
      from public.payments p, bounds b
      where (p.status is null or lower(p.status) in ('succeeded', 'paid', 'success', 'completed'))
        and p.payment_date is not null
        and p.payment_date >= b.day_start
        and p.payment_date < b.day_end
    ) as revenue_today_cents,
    timezone('utc', now()) as as_of;
$$;

comment on function analytics.get_dashboard_today_kpis() is
  'Live UTC-day KPIs using timestamptz range predicates (index-friendly).';

-- One classified scan → four grains (day / platform / country / product).
create or replace function analytics.fn_subscription_metrics_all_grains(
  p_start_date date,
  p_end_date date,
  p_platform text default null,
  p_country text default null,
  p_product_id uuid default null
)
returns table (
  grain text,
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
  with base as materialized (
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
  classified as materialized (
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
    'day'::text,
    c.report_date,
    null::text,
    null::text,
    null::uuid,
    count(*) filter (where c.is_subscription_gain)::bigint,
    count(*) filter (where c.is_subscription_loss)::bigint,
    count(*) filter (where c.is_trial_gain)::bigint,
    count(*) filter (where c.is_trial_loss)::bigint,
    count(*) filter (where c.is_trial_conversion)::bigint,
    count(*) filter (where c.is_subscription_gain or c.is_trial_gain)::bigint,
    count(*) filter (where c.is_subscription_loss or c.is_trial_loss)::bigint,
    count(distinct c.customer_id) filter (
      where c.is_subscription_gain or c.is_trial_gain
    )::bigint,
    count(distinct c.customer_id) filter (
      where c.is_subscription_loss or c.is_trial_loss
    )::bigint
  from classified c
  group by c.report_date

  union all

  select
    'platform'::text,
    null::date,
    c.platform,
    null::text,
    null::uuid,
    count(*) filter (where c.is_subscription_gain)::bigint,
    count(*) filter (where c.is_subscription_loss)::bigint,
    count(*) filter (where c.is_trial_gain)::bigint,
    count(*) filter (where c.is_trial_loss)::bigint,
    count(*) filter (where c.is_trial_conversion)::bigint,
    count(*) filter (where c.is_subscription_gain or c.is_trial_gain)::bigint,
    count(*) filter (where c.is_subscription_loss or c.is_trial_loss)::bigint,
    count(distinct c.customer_id) filter (
      where c.is_subscription_gain or c.is_trial_gain
    )::bigint,
    count(distinct c.customer_id) filter (
      where c.is_subscription_loss or c.is_trial_loss
    )::bigint
  from classified c
  group by c.platform

  union all

  select
    'country'::text,
    null::date,
    null::text,
    c.country,
    null::uuid,
    count(*) filter (where c.is_subscription_gain)::bigint,
    count(*) filter (where c.is_subscription_loss)::bigint,
    count(*) filter (where c.is_trial_gain)::bigint,
    count(*) filter (where c.is_trial_loss)::bigint,
    count(*) filter (where c.is_trial_conversion)::bigint,
    count(*) filter (where c.is_subscription_gain or c.is_trial_gain)::bigint,
    count(*) filter (where c.is_subscription_loss or c.is_trial_loss)::bigint,
    count(distinct c.customer_id) filter (
      where c.is_subscription_gain or c.is_trial_gain
    )::bigint,
    count(distinct c.customer_id) filter (
      where c.is_subscription_loss or c.is_trial_loss
    )::bigint
  from classified c
  group by c.country

  union all

  select
    'product'::text,
    null::date,
    null::text,
    null::text,
    c.product_id,
    count(*) filter (where c.is_subscription_gain)::bigint,
    count(*) filter (where c.is_subscription_loss)::bigint,
    count(*) filter (where c.is_trial_gain)::bigint,
    count(*) filter (where c.is_trial_loss)::bigint,
    count(*) filter (where c.is_trial_conversion)::bigint,
    count(*) filter (where c.is_subscription_gain or c.is_trial_gain)::bigint,
    count(*) filter (where c.is_subscription_loss or c.is_trial_loss)::bigint,
    count(distinct c.customer_id) filter (
      where c.is_subscription_gain or c.is_trial_gain
    )::bigint,
    count(distinct c.customer_id) filter (
      where c.is_subscription_loss or c.is_trial_loss
    )::bigint
  from classified c
  where c.product_id is not null
  group by c.product_id;
$$;

comment on function analytics.fn_subscription_metrics_all_grains(date, date, text, text, uuid) is
  'Single-scan gain/loss metrics for day+platform+country+product grains.';

grant execute on function analytics.get_dashboard_today_kpis() to service_role, authenticated;
grant execute on function analytics.fn_subscription_metrics_all_grains(date, date, text, text, uuid)
  to service_role, authenticated;

notify pgrst, 'reload schema';
