# Reprocess unprocessed LOSS webhooks

Topics:

- `customer.product.set_cancellation` (Web)
- `customer.product.expired` (Web + non-Web)
- `customer.product.charge_failed` when `subscription_status = expired` (Web loss)
- `customer.product.cancelled` / `disabled` (non-Web)
- `customer.product.free_trial_expired` (trial loss)

## Setup

1. Apply migrations `026` + `027_subscription_loss_rules_v2.sql`
2. Redeploy Next.js app
3. Same Edge secrets as gain: `APP_REPROCESS_URL`, `REPROCESS_SECRET`
4. Deploy this function: name `reprocess-loss-events`

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
