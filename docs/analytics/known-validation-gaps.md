# Known validation gaps (Phase 10.5)

Catalog of **expected** differences between this app and Vimeo OTT admin analytics.  
Do not treat these as code bugs unless coverage or definition rules are wrong.

## 1. History window / incomplete catalog

Webhook capture may begin mid-life (example: ~2026-07-23). Subscriptions that existed before ingest are absent or incomplete.

| Affected | Impact |
|----------|--------|
| Active subscribers, MRR, ARR | App under-counts vs Vimeo stock |
| Lifetime LTV | Incomplete payment history |
| Churn denominator | Missing prior-day actives for early days |

**Mitigation:** Historical import (product decision). Phase 10.5 only documents the delta.

## 2. Timezone day boundaries

| Source | Day grain |
|--------|-----------|
| This app | `(event_created_at at time zone 'utc')::date` |
| Vimeo UI | Often site / account timezone |

Edge events near midnight can land on adjacent calendar days (±1 day). Prefer single-day comparisons after aligning both sides to UTC, or accept small day-shift noise on range totals.

## 3. Ingest vs normalize gap

`vott_events` can contain gain/loss topics that never produced `subscription_events` (processor failure, handler gap, or never processed).

Reporting **must** use `subscription_events`. If `vott ≫ se` for a day, dashboards under-count vs Vimeo (which effectively reflects those webhooks).

**Mitigation:** Phase 10.5 coverage scripts + gain/loss reprocess Edge Functions / cron scripts under `supabase/scripts/`.

## 4. Platform label buckets

| Vimeo examples | Our bucket |
|----------------|------------|
| tvOS / Apple TV | Apple TV |
| Amazon Fire TV | Fire TV |
| Android TV | Google TV |
| Vizio / API / unknown | OTHER |

**Totals** should align; per-platform rows may not.

## 5. Subscription Loss rules (Web vs store)

Authoritative rules: [`business-metrics.md`](business-metrics.md) + migration `027`.

- **Web:** `set_cancellation` \| `expired` \| (`charge_failed` ∧ status=`expired`)
- **Non-Web:** `cancelled` \| `expired` \| `disabled`
- **Trial Loss:** `trial_expired` only

Vimeo “cancel” charts may attribute on access-end date rather than `set_cancellation` event day.

## 6. Counting semantics

Gain/loss KPIs are **event counts**, not distinct subscriptions. Combined Gain ≈ count of `created` + `trial_started` + `trial_converted`.

Do **not** compare widgets to `analytics.daily_subscription_metrics.new_subscriptions` (that column uses `started_at` stock logic).

## 7. Snapshot freshness

Dashboard MRR / MTD / stock cards come from `analytics.mv_dashboard`. If `refreshed_at` is before today UTC, numbers lag. Use “Refresh snapshot” or `select analytics.refresh_dashboard();`.

Today’s live counters (when migration 035 is applied) come from `analytics.get_dashboard_today_kpis()` and are independent of the MV for those fields.

## 8. Validation doc staleness (fixed in 10.5)

Older copies of `subscription-metrics-validation.md` said Web Subscription Loss = `set_cancellation` **only**. That is outdated — follow `business-metrics.md` / migration 027.

---

## What Phase 10.5 does / does not do

| Does | Does not |
|------|----------|
| Provide runnable SQL packs + runbook | Rebuild Phase 9.5 gain/loss |
| Document pass/warn/fail thresholds | Guarantee bit-identical Vimeo match |
| Point to reprocess tooling | Ship historical catalog import |
| Sample stock/MRR validation | Implement Phase 12 cohort churn |
