-- Sanity check after migration 032
-- Compare old (wrong) vs new (stock) definitions

select
  -- OLD (wrong): lifetime free_trial flag
  count(*) filter (where free_trial is true) as trials_lifetime_flag,
  -- NEW: open trials only
  count(*) filter (
    where free_trial is true
      and cancelled_at is null
      and expired_at is null
  ) as trials_open,
  -- OLD (wrong): any cancelled_at
  count(*) filter (where cancelled_at is not null) as cancelled_lifetime,
  -- NEW: cancelled, not expired
  count(*) filter (
    where cancelled_at is not null
      and expired_at is null
  ) as cancelled_current,
  -- Active distinct customers (open paid)
  count(distinct customer_id) filter (
    where cancelled_at is null
      and expired_at is null
      and coalesce(free_trial, false) is not true
      and (status is null or lower(status) not like '%pause%')
  ) as active_subscribers_open_paid
from public.subscriptions;

-- What the dashboard MV currently shows
select
  active_subscribers,
  free_trial_subscriptions as trials,
  cancelled_subscriptions as cancelled,
  refreshed_at
from analytics.mv_dashboard;
