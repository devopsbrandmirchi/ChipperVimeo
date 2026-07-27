-- Ops helpers for gain-event reprocess (run in Supabase SQL Editor).
-- Full lifecycle reprocess still runs in the app handlers (via Edge Function or API).

create or replace function public.fn_unprocessed_gain_event_stats(
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
      'customer.product.created',
      'customer.product.free_trial_created',
      'customer.product.free_trial_converted'
    )
  group by 1, 2
  order by 1, 2;
$$;

comment on function public.fn_unprocessed_gain_event_stats(date, date) is
  'Per-day/topic coverage: vott gain topics vs subscription_events. Use in SQL Editor before/after reprocess.';

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
    select count(*)::bigint as n
    from public.vott_events v
    left join public.subscription_events se2 on se2.vott_event_id = v.id
    where se2.id is null
      and (v.event_created_at at time zone 'utc')::date = p_date
      and v.topic in (
        'customer.product.created',
        'customer.product.free_trial_created',
        'customer.product.free_trial_converted'
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

comment on function public.fn_combined_gain_coverage(date) is
  'One-row Combined Gain coverage for a UTC day (vott vs subscription_events).';

grant execute on function public.fn_unprocessed_gain_event_stats(date, date)
  to service_role, postgres;
grant execute on function public.fn_combined_gain_coverage(date)
  to service_role, postgres;
grant execute on function public.fn_unprocessed_gain_events(date, date, integer)
  to postgres;

notify pgrst, 'reload schema';
