-- Fix loss coverage: unprocessed was capped at 2000 by fn_unprocessed_loss_events limit.

create or replace function public.fn_unprocessed_loss_event_count(
  p_start_date date,
  p_end_date date
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.vott_events v
  left join public.subscription_events se on se.vott_event_id = v.id
  where se.id is null
    and v.event_created_at is not null
    and (v.event_created_at at time zone 'utc')::date >= p_start_date
    and (v.event_created_at at time zone 'utc')::date <= p_end_date
    and (
      v.topic in (
        'customer.product.set_cancellation',
        'customer.product.cancelled',
        'customer.product.expired',
        'customer.product.disabled',
        'customer.product.free_trial_expired'
      )
      or (
        v.topic = 'customer.product.charge_failed'
        and lower(coalesce(v.subscription_status, '')) = 'expired'
      )
    );
$$;

create or replace function public.fn_unprocessed_gain_event_count(
  p_start_date date,
  p_end_date date
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.vott_events v
  left join public.subscription_events se on se.vott_event_id = v.id
  where se.id is null
    and v.event_created_at is not null
    and (v.event_created_at at time zone 'utc')::date >= p_start_date
    and (v.event_created_at at time zone 'utc')::date <= p_end_date
    and v.topic in (
      'customer.product.created',
      'customer.product.free_trial_created',
      'customer.product.free_trial_converted'
    );
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
          and (
            v.topic = 'customer.product.set_cancellation'
            or v.topic = 'customer.product.expired'
            or (
              v.topic = 'customer.product.charge_failed'
              and lower(coalesce(v.subscription_status, '')) = 'expired'
            )
          )
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
    select coalesce(sum(m.combined_loss), 0)::bigint as n
    from analytics.v_daily_subscription_metrics m
    where m.report_date = p_date
  ),
  pending as (
    select public.fn_unprocessed_loss_event_count(p_date, p_date) as n
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

create or replace function public.fn_combined_gain_coverage(
  p_date date
)
returns table (
  vott_gain_events bigint,
  subscription_events_gain bigint,
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
      and v.topic in (
        'customer.product.created',
        'customer.product.free_trial_created',
        'customer.product.free_trial_converted'
      )
  ),
  se as (
    select count(*)::bigint as n
    from public.subscription_events e
    where (e.event_created_at at time zone 'utc')::date = p_date
      and e.event_type in ('created', 'trial_started', 'trial_converted')
  ),
  pending as (
    select public.fn_unprocessed_gain_event_count(p_date, p_date) as n
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

grant execute on function public.fn_unprocessed_loss_event_count(date, date)
  to service_role, postgres;
grant execute on function public.fn_unprocessed_gain_event_count(date, date)
  to service_role, postgres;

notify pgrst, 'reload schema';
