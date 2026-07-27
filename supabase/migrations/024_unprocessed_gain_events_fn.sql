-- Unprocessed gain webhooks for reprocess (no matching subscription_events row).
-- Used by admin reprocess API; not for dashboard reporting.

create or replace function public.fn_unprocessed_gain_events(
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
      'customer.product.created',
      'customer.product.free_trial_created',
      'customer.product.free_trial_converted'
    )
  order by v.event_created_at asc, v.received_at asc
  limit greatest(1, least(coalesce(p_limit, 500), 2000));
$$;

comment on function public.fn_unprocessed_gain_events(date, date, integer) is
  'Gain-topic vott_events in UTC date range with no subscription_events row. For admin reprocess only.';

grant execute on function public.fn_unprocessed_gain_events(date, date, integer)
  to service_role;

notify pgrst, 'reload schema';
