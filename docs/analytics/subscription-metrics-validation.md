# Subscription Metrics Validation

How to validate Phase 9.5 gain/loss widgets against Vimeo OTT reporting.

**Source of truth:** `public.subscription_events.event_created_at` (UTC day) via `analytics.v_daily_subscription_metrics` / `analytics.fn_subscription_metrics`.  
**Never** use `vott_events` or `subscription_events.created_at` for these KPIs.

API: `GET /api/v1/analytics/subscription-metrics?preset=last7|today|yesterday|last30`

---

## Per-metric checklist

| Metric | Business definition | Event types | SQL / view logic | Known Vimeo differences | Expected Vimeo result |
|--------|---------------------|-------------|------------------|-------------------------|------------------------|
| **Subscription Gain** | Paying starts only | `created` (paid path) + `trial_converted` | `COUNT` where those types; trial journeys do **not** also emit paid `created` | Vimeo “Gain” may use site TZ and a limited history window; our grain is UTC | Match Vimeo Gain within TZ/history gaps |
| **Subscription Loss** | Lost paid entitlement | **Web:** `set_cancellation` only. **Store:** `cancelled` \| `expired` \| `disabled` | Platform via `normalize_report_platform` + `is_store_platform` | Web may show cancel on schedule date vs set_cancellation event day | Match after platform rule applied |
| **Trial Gain** | Free trial started | `trial_started` only | Count `trial_started` | `created` with trial payload is routed to `trial_started` at ingest | Match Vimeo trial starts |
| **Trial Conversion** | Trial → paid | `trial_converted` only | Count `trial_converted` | Also counted in Subscription Gain (intentional) | Match Vimeo conversions |
| **Trial Loss** | Trial ended w/o convert | `trial_expired` | Count `trial_expired` | Requires `free_trial_expired` handler (Phase A) | Match expired trials |
| **Combined Gain** | Sub Gain + Trial Gain event rows | `created` ∪ `trial_started` ∪ `trial_converted` | `count(*)` of those types (not distinct subscriptions) | Vimeo chart sums platform series; platform labels differ (tvOS→Apple TV, etc.) | Match Vimeo day total within ingest/TZ gaps |
| **Combined Loss** | Sub Loss + Trial Loss | Derived | `count(*)` of loss types | Same | Sum of the two |

---

## Paid-created / no double-count

1. `customer.product.created` with free-trial payload → `startTrial` → `trial_started` only (Trial Gain).
2. Immediately paid create → `created` only (Subscription Gain).
3. Conversion → `trial_converted` (Subscription Gain + Trial Conversion). Do **not** expect a second paid `created` for the same journey.

Validate with unit tests in `subscription-metrics.mappers.test.ts` and ingest helpers (`isFreeTrialCustomer`).

---

## Date presets (UTC)

| Preset | Range |
|--------|--------|
| `today` | Today UTC |
| `yesterday` | Previous UTC day |
| `last7` | Today − 6 days through today |
| `last30` | Today − 29 days through today |
| `custom` | `startDate` / `endDate` query params |

---

## Platform breakdown

Normalized buckets: Web, iOS, Android, Apple TV, Fire TV, Google TV, Roku, OTHER.  
API response `byPlatform` includes a **TOTAL** row.

---

## Common gaps vs Vimeo UI

1. **History window** — Vimeo admin charts may truncate older events; local DB retains what was ingested.
2. **Timezone** — Vimeo site TZ vs our UTC day bucketing can shift day boundaries (±1 day on edge events). Prefer `(event_created_at at time zone 'utc')::date`, not `event_created_at::date` (session TZ).
3. **Backfill / ingest coverage** — Compare Vimeo-matching `vott_events` topic counts to `subscription_events` event_type counts for the same UTC day. Reporting uses only `subscription_events`; missing timeline rows will under-count Combined Gain.
4. **Old `new_subscriptions`** — `analytics.daily_subscription_metrics.new_subscriptions` (from `started_at`) is **not** Subscription Gain; do not compare widgets to that column.
5. **Platform labels** — Vimeo uses Amazon Fire TV / tvOS / Android TV / Vizio / API; we normalize into Web / iOS / Android / Apple TV / Fire TV / Google TV / Roku / OTHER. Totals should align; per-bucket rows may not.

### Coverage check (2026-07-24 example)

```sql
-- Ingest audit only (not for dashboard SoT)
select count(*) as vott_gain_events
from public.vott_events
where (event_created_at at time zone 'utc')::date = '2026-07-24'
  and topic in (
    'customer.product.created',
    'customer.product.free_trial_created',
    'customer.product.free_trial_converted'
  );

-- Dashboard SoT
select count(*) as se_combined_gain
from public.subscription_events
where (event_created_at at time zone 'utc')::date = '2026-07-24'
  and event_type in ('created', 'trial_started', 'trial_converted');
```

If `vott_gain_events` ≈ Vimeo and `se_combined_gain` is lower, those webhooks were never normalized.

**Observed (after migration 023):** vott ≈ 6905, subscription_events ≈ 3628 on 2026-07-24 — ~47% missing `subscription_events` rows (failed processing or never processed). Migration 023 only fixed counting; it cannot invent missing timeline rows.

### Classify the gap

```sql
select
  case when se.id is null then 'no_subscription_event' else 'has_se' end as class,
  count(*)
from public.vott_events v
left join public.subscription_events se on se.vott_event_id = v.id
where (v.event_created_at at time zone 'utc')::date = date '2026-07-24'
  and v.topic in (
    'customer.product.created',
    'customer.product.free_trial_created',
    'customer.product.free_trial_converted'
  )
group by 1;
```

### Reprocess (ADMIN)

1. Apply migration `024_unprocessed_gain_events_fn.sql`.
2. Call repeatedly until `attempted` is 0:

```http
POST /api/v1/webhook-events/reprocess
{ "startDate": "2026-07-24", "endDate": "2026-07-24", "limit": 500 }
```

Handlers now fall back to denormalized `vott_events.product_id` / customer columns when the embedded payload is thin, and `free_trial_converted` writes the timeline before payment.

---

## Smoke SQL

```sql
select *
from analytics.fn_subscription_metrics(
  date '2026-07-24',
  date '2026-07-24',
  null, null, null
);
```

Related: [`business-metrics.md`](business-metrics.md), [`event-mapping.md`](event-mapping.md).
