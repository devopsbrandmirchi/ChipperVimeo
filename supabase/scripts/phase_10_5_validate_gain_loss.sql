-- =============================================================================
-- Phase 10.5 — Gain / Loss validation pack (vs Vimeo OTT)
-- =============================================================================
-- How to use (Supabase SQL Editor):
--   1. Edit start_date / end_date in the params CTE below.
--   2. Run section A → F in order (or the whole file).
--   3. Record results in docs/analytics/phase-10.5-vimeo-validation-runbook.md
--
-- Reporting SoT = public.subscription_events (event_created_at UTC day).
-- public.vott_events is used ONLY for ingest-coverage audits, never as KPI SoT.
-- =============================================================================

with params as (
  select
    (current_date - 6)::date as start_date,
    current_date::date as end_date
)

-- ---------------------------------------------------------------------------
-- A. Smoke: daily metrics from analytics.fn_subscription_metrics
-- ---------------------------------------------------------------------------
select
  'A_smoke_fn_subscription_metrics' as section,
  m.*
from params p
cross join lateral analytics.fn_subscription_metrics(
  p.start_date,
  p.end_date,
  null,
  null,
  null
) m
order by m.report_date desc, m.platform
limit 200;

-- ---------------------------------------------------------------------------
-- B. Day totals (compare Combined Gain/Loss to Vimeo day totals)
-- ---------------------------------------------------------------------------
with params as (
  select
    (current_date - 6)::date as start_date,
    current_date::date as end_date
)
select
  'B_day_totals' as section,
  m.report_date,
  sum(m.combined_gain)::bigint as combined_gain,
  sum(m.combined_loss)::bigint as combined_loss,
  sum(m.subscription_gain)::bigint as subscription_gain,
  sum(m.subscription_loss)::bigint as subscription_loss,
  sum(m.trial_gain)::bigint as trial_gain,
  sum(m.trial_loss)::bigint as trial_loss,
  sum(m.trial_conversion)::bigint as trial_conversion
from params p
cross join lateral analytics.fn_subscription_metrics(
  p.start_date,
  p.end_date,
  null,
  null,
  null
) m
group by m.report_date
order by m.report_date desc;

-- ---------------------------------------------------------------------------
-- C. Ingest coverage: vott_events (gain topics) vs subscription_events
--    If vott >> se, timeline rows are missing → under-count vs Vimeo.
-- ---------------------------------------------------------------------------
with params as (
  select
    (current_date - 6)::date as start_date,
    current_date::date as end_date
),
days as (
  select d::date as report_date
  from params p
  cross join lateral generate_series(p.start_date, p.end_date, interval '1 day') as d
),
vott_gain as (
  select
    (v.event_created_at at time zone 'utc')::date as report_date,
    count(*)::bigint as vott_gain_topics
  from public.vott_events v
  cross join params p
  where v.event_created_at is not null
    and (v.event_created_at at time zone 'utc')::date between p.start_date and p.end_date
    and v.topic in (
      'customer.product.created',
      'customer.product.free_trial_created',
      'customer.product.free_trial_converted'
    )
  group by 1
),
se_gain as (
  select
    (e.event_created_at at time zone 'utc')::date as report_date,
    count(*)::bigint as se_combined_gain
  from public.subscription_events e
  cross join params p
  where e.event_created_at is not null
    and (e.event_created_at at time zone 'utc')::date between p.start_date and p.end_date
    and e.event_type in ('created', 'trial_started', 'trial_converted')
  group by 1
)
select
  'C_gain_coverage' as section,
  d.report_date,
  coalesce(vg.vott_gain_topics, 0) as vott_gain_topics,
  coalesce(sg.se_combined_gain, 0) as se_combined_gain,
  coalesce(vg.vott_gain_topics, 0) - coalesce(sg.se_combined_gain, 0) as missing_se_rows,
  case
    when coalesce(vg.vott_gain_topics, 0) = 0 then 'no_vott_gain'
    when coalesce(sg.se_combined_gain, 0) = 0 then 'critical_no_se'
    when coalesce(sg.se_combined_gain, 0)::numeric
         / nullif(vg.vott_gain_topics, 0) >= 0.95 then 'ok_ge_95pct'
    when coalesce(sg.se_combined_gain, 0)::numeric
         / nullif(vg.vott_gain_topics, 0) >= 0.80 then 'warn_80_95pct'
    else 'fail_lt_80pct'
  end as coverage_status
from days d
left join vott_gain vg on vg.report_date = d.report_date
left join se_gain sg on sg.report_date = d.report_date
order by d.report_date desc;

-- ---------------------------------------------------------------------------
-- D. Classify missing gain webhooks (no subscription_events row)
-- ---------------------------------------------------------------------------
with params as (
  select
    (current_date - 6)::date as start_date,
    current_date::date as end_date
)
select
  'D_missing_gain_by_topic' as section,
  v.topic,
  count(*)::bigint as missing_count
from public.vott_events v
cross join params p
left join public.subscription_events se on se.vott_event_id = v.id
where v.event_created_at is not null
  and (v.event_created_at at time zone 'utc')::date between p.start_date and p.end_date
  and v.topic in (
    'customer.product.created',
    'customer.product.free_trial_created',
    'customer.product.free_trial_converted'
  )
  and se.id is null
group by v.topic
order by missing_count desc;

-- ---------------------------------------------------------------------------
-- E. Loss coverage (ingest audit)
-- ---------------------------------------------------------------------------
with params as (
  select
    (current_date - 6)::date as start_date,
    current_date::date as end_date
),
days as (
  select d::date as report_date
  from params p
  cross join lateral generate_series(p.start_date, p.end_date, interval '1 day') as d
),
vott_loss as (
  select
    (v.event_created_at at time zone 'utc')::date as report_date,
    count(*)::bigint as vott_loss_topics
  from public.vott_events v
  cross join params p
  where v.event_created_at is not null
    and (v.event_created_at at time zone 'utc')::date between p.start_date and p.end_date
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
    )
  group by 1
),
se_loss as (
  select
    m.report_date,
    sum(m.combined_loss)::bigint as combined_loss
  from params p
  cross join lateral analytics.fn_subscription_metrics(
    p.start_date,
    p.end_date,
    null,
    null,
    null
  ) m
  group by m.report_date
)
select
  'E_loss_coverage' as section,
  d.report_date,
  coalesce(vl.vott_loss_topics, 0) as vott_loss_topics,
  coalesce(sl.combined_loss, 0) as se_combined_loss,
  note.note
from days d
left join vott_loss vl on vl.report_date = d.report_date
left join se_loss sl on sl.report_date = d.report_date
cross join (
  select
    'Loss SoT uses platform rules — vott topic count is not 1:1 with Combined Loss'
      as note
) note
order by d.report_date desc;

-- ---------------------------------------------------------------------------
-- F. Platform TOTAL vs sum of buckets (sanity)
-- ---------------------------------------------------------------------------
with params as (
  select
    (current_date - 6)::date as start_date,
    current_date::date as end_date
),
raw as (
  select *
  from params p
  cross join lateral analytics.fn_subscription_metrics(
    p.start_date,
    p.end_date,
    null,
    null,
    null
  ) m
),
by_platform as (
  select
    platform,
    sum(combined_gain)::bigint as combined_gain,
    sum(combined_loss)::bigint as combined_loss
  from raw
  group by platform
)
select
  'F_platform_totals' as section,
  platform,
  combined_gain,
  combined_loss
from by_platform
union all
select
  'F_platform_totals',
  'TOTAL_SUM',
  sum(combined_gain),
  sum(combined_loss)
from by_platform
order by 2;
