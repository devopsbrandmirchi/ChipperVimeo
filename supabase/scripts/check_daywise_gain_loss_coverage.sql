-- Why only some days appear in Day-wise gain/loss for 2026-08-11 .. 2026-08-16
-- The UI only shows days that have subscription_events (no zero-fill).

with days as (
  select d::date as report_date
  from generate_series(date '2026-08-11', date '2026-08-16', interval '1 day') as d
),
vott as (
  select
    (event_created_at at time zone 'utc')::date as report_date,
    count(*) as vott_events
  from public.vott_events
  where event_created_at is not null
    and (event_created_at at time zone 'utc')::date between date '2026-08-11' and date '2026-08-16'
  group by 1
),
se as (
  select
    (event_created_at at time zone 'utc')::date as report_date,
    count(*) as subscription_events,
    count(*) filter (
      where event_type in ('created', 'trial_started', 'trial_converted')
    ) as gain_like,
    count(*) filter (
      where event_type in (
        'set_cancellation', 'cancelled', 'expired', 'disabled',
        'trial_expired', 'charge_failed'
      )
    ) as loss_like
  from public.subscription_events
  where event_created_at is not null
    and (event_created_at at time zone 'utc')::date between date '2026-08-11' and date '2026-08-16'
  group by 1
)
select
  d.report_date,
  coalesce(v.vott_events, 0) as vott_events,
  coalesce(s.subscription_events, 0) as subscription_events,
  coalesce(s.gain_like, 0) as gain_like_events,
  coalesce(s.loss_like, 0) as loss_like_events,
  case
    when coalesce(s.subscription_events, 0) = 0 then 'missing from UI (no subscription_events)'
    else 'shown in day-wise table'
  end as ui_row
from days d
left join vott v on v.report_date = d.report_date
left join se s on s.report_date = d.report_date
order by d.report_date;
