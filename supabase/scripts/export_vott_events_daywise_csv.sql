-- =============================================================================
-- Export event log (public.vott_events) to CSV — day-wise (UTC)
--
-- How to download:
--   1) Set dates below
--   2) Run ONE query in Supabase SQL Editor
--   3) Click "Download CSV" on the Results panel
--
-- Tip: For large days, export one day at a time (set start = end).
-- =============================================================================

-- ---------- A) Day-wise SUMMARY (counts per day + topic) ----------
select
  (event_created_at at time zone 'utc')::date as event_date,
  topic,
  platform,
  count(*) as total_events,
  count(distinct customer_id) as unique_customers
from public.vott_events
where event_created_at is not null
  and (event_created_at at time zone 'utc')::date >= date '2026-07-24'
  and (event_created_at at time zone 'utc')::date <= date '2026-07-31'
group by 1, 2, 3
order by event_date desc, total_events desc;


-- ---------- B) Day-wise DETAIL rows (flat columns for CSV) ----------
-- Comment out query A above (or run separately) before downloading this one.
select
  (v.event_created_at at time zone 'utc')::date as event_date,
  v.event_created_at,
  v.received_at,
  v.id as vott_event_id,
  v.topic,
  v.platform,
  v.customer_id as vimeo_customer_id,
  v.customer_email,
  v.customer_name,
  coalesce(
    v.payload -> '_embedded' -> 'customer' -> 'location' ->> 'country',
    'Unknown'
  ) as country,
  v.product_id as vimeo_product_id,
  v.product_name,
  v.subscription_status,
  exists (
    select 1
    from public.subscription_events se
    where se.vott_event_id = v.id
  ) as has_subscription_event
from public.vott_events v
where v.event_created_at is not null
  and (v.event_created_at at time zone 'utc')::date >= date '2026-07-24'
  and (v.event_created_at at time zone 'utc')::date <= date '2026-07-31'
order by event_date desc, v.event_created_at desc;


-- ---------- C) Single day only (example: 2026-07-25) ----------
select
  (v.event_created_at at time zone 'utc')::date as event_date,
  v.event_created_at,
  v.id as vott_event_id,
  v.topic,
  v.platform,
  v.customer_id as vimeo_customer_id,
  v.customer_email,
  coalesce(
    v.payload -> '_embedded' -> 'customer' -> 'location' ->> 'country',
    'Unknown'
  ) as country,
  v.product_id as vimeo_product_id,
  v.product_name,
  v.subscription_status
from public.vott_events v
where (v.event_created_at at time zone 'utc')::date = date '2026-07-25'
order by v.event_created_at desc;
