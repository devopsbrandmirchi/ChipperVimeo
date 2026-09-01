-- =============================================================================
-- Phase 10.5 — Stock / MRR / ARR / actives validation (vs Vimeo OTT snapshot)
-- =============================================================================
-- Compare analytics.mv_dashboard (+ live today KPIs if present) to Vimeo
-- "Subscribers" / revenue cards. Historical import gaps mean absolute match
-- is often impossible — document deltas, do not force equality.
--
-- How to use:
--   1. Ensure snapshot is fresh: select analytics.refresh_dashboard();
--      (may take minutes; see migrations 036/037 for statement_timeout)
--   2. Run this script.
--   3. Record Vimeo UI numbers next to each row in the runbook.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A. Current dashboard snapshot
-- ---------------------------------------------------------------------------
select
  'A_mv_dashboard' as section,
  active_subscribers,
  free_trial_subscriptions as open_trials,
  cancelled_subscriptions,
  mrr_cents,
  round(mrr_cents / 100.0, 2) as mrr_dollars,
  arr_cents,
  round(arr_cents / 100.0, 2) as arr_dollars,
  refreshed_at
from analytics.mv_dashboard;

-- ---------------------------------------------------------------------------
-- B. Recompute open paid / trials from operational subscriptions (spot-check)
-- ---------------------------------------------------------------------------
select
  'B_ops_recompute' as section,
  count(distinct customer_id) filter (
    where cancelled_at is null
      and expired_at is null
      and coalesce(free_trial, false) is not true
      and (status is null or lower(status) not like '%pause%')
  )::bigint as active_subscribers_open_paid,
  count(*) filter (
    where free_trial is true
      and cancelled_at is null
      and expired_at is null
  )::bigint as open_trials,
  count(*) filter (
    where cancelled_at is not null
      and expired_at is null
  )::bigint as cancelled_not_expired
from public.subscriptions;

-- ---------------------------------------------------------------------------
-- C. Live today KPIs (requires migration 035)
-- ---------------------------------------------------------------------------
select
  'C_today_live_kpis' as section,
  *
from analytics.get_dashboard_today_kpis();

-- ---------------------------------------------------------------------------
-- D. MRR source sample (top products by open paid MRR contribution)
-- ---------------------------------------------------------------------------
select
  'D_mrr_by_product' as section,
  p.id as product_id,
  p.name,
  count(*)::bigint as open_subs,
  sum(
    case
      when lower(coalesce(s.billing_frequency, '')) like '%year%'
        then coalesce(s.price_cents, 0) / 12
      else coalesce(s.price_cents, 0)
    end
  )::bigint as approx_mrr_cents
from public.subscriptions s
join public.products p on p.id = s.product_id
where s.cancelled_at is null
  and s.expired_at is null
  and coalesce(s.free_trial, false) is not true
  and (s.status is null or lower(s.status) not like '%pause%')
group by p.id, p.name
order by approx_mrr_cents desc
limit 20;

-- ---------------------------------------------------------------------------
-- E. Freshness gate
-- ---------------------------------------------------------------------------
select
  'E_freshness' as section,
  refreshed_at,
  (refreshed_at at time zone 'utc')::date as refreshed_utc_date,
  current_date as today_utc,
  case
    when refreshed_at is null then 'missing_snapshot'
    when (refreshed_at at time zone 'utc')::date < current_date
      then 'stale_before_today'
    else 'fresh_today'
  end as freshness_status
from analytics.mv_dashboard;
