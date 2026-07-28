# Reprocess unprocessed LOSS webhooks

Topics:

- `customer.product.set_cancellation` (Web subscription loss)
- `customer.product.cancelled` / `expired` / `disabled` (non-Web subscription loss)
- `customer.product.free_trial_expired` (trial loss)

## Setup

1. Apply migration `026_subscription_loss_reprocess.sql`
2. Redeploy Next.js app (reprocess API accepts `kind: "loss"`)
3. Same Edge secrets as gain: `APP_REPROCESS_URL`, `REPROCESS_SECRET`
4. Deploy this function in Dashboard → Edge Functions → Via Editor  
   Name: `reprocess-loss-events`

## Invoke / cron body

```json
{
  "startDate": "2026-07-21",
  "endDate": "2026-07-28",
  "limit": 25
}
```

Or `{ "lookbackDays": 7, "limit": 25 }`.

## Cron (Dashboard)

Integrations → Cron → Create job:

- Schedule: `*/5 * * * *` while catching up
- Type: Supabase Edge Function → `reprocess-loss-events`
- Body: include **startDate** and **endDate** (or redeploy function with lookback defaults)

## SQL cron

See `supabase/scripts/schedule_reprocess_loss_cron.sql`.

## Coverage

```sql
select * from public.fn_combined_loss_coverage(date '2026-07-24');
select * from public.fn_unprocessed_loss_event_stats(date '2026-07-24', date '2026-07-28');
```
