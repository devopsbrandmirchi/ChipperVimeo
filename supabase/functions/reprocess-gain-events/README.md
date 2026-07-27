# Reprocess unprocessed gain webhooks (Supabase ops + cron)

Lifecycle handlers live in the Next.js app. Supabase provides coverage SQL,
an Edge Function, and an optional **Cron** job that drains pending events
25 at a time.

## 1. Apply migrations

- `024_unprocessed_gain_events_fn.sql`
- `025_gain_reprocess_ops_functions.sql`

## 2. Secrets

### Vercel

`REPROCESS_SECRET` (16+ chars) → redeploy.

### Supabase Edge Secrets

| Name | Value |
|------|--------|
| `REPROCESS_SECRET` | same as Vercel |
| `APP_REPROCESS_URL` | `https://chipper-vimeo.vercel.app` |

## 3. Deploy Edge Function

Dashboard → Edge Functions → deploy `reprocess-gain-events` (paste `index.ts`).

Cron-friendly body (dates optional):

```json
{ "lookbackDays": 7, "limit": 25 }
```

Omitting dates uses the last 7 UTC days through today. `limit` is hard-capped at 25.

## 4. Schedule a cron (recommended)

### Dashboard (easiest)

1. Supabase → **Integrations** → **Cron** → **Create job**
2. Name: `reprocess-gain-events`
3. Schedule:
   - Catch-up: every **5 minutes**
   - Steady state: every **hour** (`0 * * * *`)
4. Type: **Supabase Edge Function**
5. Function: `reprocess-gain-events`
6. HTTP method: **POST**
7. Body:

```json
{ "lookbackDays": 7, "limit": 25 }
```

8. Save / enable the job

Each run processes up to 25 pending gain events. Repeat runs drain the backlog
(~300/hour at every 5 minutes).

### SQL alternative

See [`../scripts/schedule_reprocess_gain_cron.sql`](../scripts/schedule_reprocess_gain_cron.sql)
(requires `pg_cron`, `pg_net`, and Vault secrets `project_url` + `publishable_key`).
Use `timeout_milliseconds := 60000` — default 5s is too short.

## 5. Verify

```sql
select * from public.fn_combined_gain_coverage(current_date);

select *
from public.fn_unprocessed_gain_event_stats(
  current_date - 7,
  current_date
)
where unprocessed > 0;
```

When `unprocessed` stays near 0, switch cron from every 5 minutes to hourly.
