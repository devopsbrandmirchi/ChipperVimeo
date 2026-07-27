# Reprocess unprocessed gain webhooks (Supabase ops)

Lifecycle handlers live in the Next.js app. Supabase provides **coverage SQL**
and an **Edge Function** that calls the app reprocess API.

## 1. Apply migrations

- `024_unprocessed_gain_events_fn.sql`
- `025_gain_reprocess_ops_functions.sql`

## 2. Inspect coverage (SQL Editor)

Open [`scripts/reprocess_gain_coverage.sql`](../scripts/reprocess_gain_coverage.sql)
in **Supabase Dashboard → SQL → New query**, or run:

```sql
select * from public.fn_combined_gain_coverage(date '2026-07-24');

select * from public.fn_unprocessed_gain_event_stats(
  date '2026-07-24',
  date '2026-07-24'
);
```

## 3. Configure secrets

### Vercel (Next.js app)

```env
REPROCESS_SECRET=<long-random-string-at-least-16-chars>
```

### Supabase Edge Function secrets

Dashboard → **Edge Functions** → **Secrets**:

| Name | Value |
|------|--------|
| `APP_REPROCESS_URL` | `https://chipper-vimeo.vercel.app` (no trailing slash) |
| `REPROCESS_SECRET` | **same** as Vercel `REPROCESS_SECRET` |

## 4. Deploy the Edge Function

```bash
supabase functions deploy reprocess-gain-events
```

## 5. Invoke from Supabase (repeat until `attempted` is 0)

**Dashboard:** Edge Functions → `reprocess-gain-events` → Invoke with body:

```json
{
  "startDate": "2026-07-24",
  "endDate": "2026-07-24",
  "limit": 500
}
```

**curl:**

```bash
curl -X POST "$SUPABASE_URL/functions/v1/reprocess-gain-events" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2026-07-24","endDate":"2026-07-24","limit":500}'
```

## 6. Verify again in SQL Editor

```sql
select * from public.fn_combined_gain_coverage(date '2026-07-24');
```

`unprocessed` should trend to `0`; `subscription_events_gain` should approach `vott_gain_events`.
