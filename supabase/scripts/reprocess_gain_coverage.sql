-- =============================================================================
-- Combined Gain reprocess — run in Supabase Dashboard → SQL Editor
-- =============================================================================
-- Handlers live in the Next.js app. From Supabase you can:
--   1) Inspect coverage / pending rows (this file)
--   2) Invoke Edge Function `reprocess-gain-events` (Dashboard → Edge Functions)
--   3) Or call the app API with REPROCESS_SECRET (see docs)
-- =============================================================================

-- 1) Coverage for one UTC day
select * from public.fn_combined_gain_coverage(date '2026-07-24');

-- 2) Per-topic breakdown
select * from public.fn_unprocessed_gain_event_stats(
  date '2026-07-24',
  date '2026-07-24'
);

-- 3) Sample unprocessed gain webhooks (limit 50)
select
  id,
  topic,
  event_created_at,
  customer_id,
  product_id,
  platform
from public.fn_unprocessed_gain_events(
  date '2026-07-24',
  date '2026-07-24',
  50
);

-- 4) After Edge Function / API batches finish, re-run (1) until unprocessed ≈ 0
--    and subscription_events_gain ≈ vott_gain_events.
