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
| **Combined Gain** | Sub Gain + Trial Gain | Derived | `subscription_gain + trial_gain` | Not always shown as one KPI in Vimeo | Sum of the two |
| **Combined Loss** | Sub Loss + Trial Loss | Derived | `subscription_loss + trial_loss` | Same | Sum of the two |

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
2. **Timezone** — Vimeo site TZ vs our UTC day bucketing can shift day boundaries (±1 day on edge events).
3. **Backfill** — Metrics only include events processed after Phase A handlers; historical gaps for `set_cancellation` / `disabled` / `trial_expired` until those webhooks are replayed.
4. **Old `new_subscriptions`** — `analytics.daily_subscription_metrics.new_subscriptions` (from `started_at`) is **not** Subscription Gain; do not compare widgets to that column.

---

## Smoke SQL

```sql
select *
from analytics.fn_subscription_metrics(
  (current_date - 6),
  current_date,
  null, null, null
)
limit 50;
```

Related: [`business-metrics.md`](business-metrics.md), [`event-mapping.md`](event-mapping.md).
