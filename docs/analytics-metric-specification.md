# Analytics Metric Specification (Phase 9.5A Audit)

> **SUPERSEDED.** The official analytics contract is now  
> [`docs/analytics-business-specification.md`](analytics-business-specification.md) (Phase 9.6).  
> Keep this file only as a forensic audit of how metrics were calculated before conformance.

**Status:** Audit only — no code, SQL, migrations, or schema changes in this phase.  
**Purpose:** Historical forensic record of KPI calculation gaps (pre–business specification).  
**Date:** 2026-07-25

---

## Executive summary

Dashboard and daily-snapshot numbers can diverge from Vimeo OTT for structural reasons, not only “bugs.”

**Primary finding (New Subscriptions ≈ 9,551 vs Vimeo Subscription Gain ≈ 877):**

| Ours | Vimeo (typical) |
|------|-----------------|
| `COUNT(*)` of `subscriptions` where `started_at` falls on the day | “Subscription Gain” ≈ **new paid starts** in Vimeo’s reporting calendar |
| `started_at` is set when **this platform first creates** the subscription row (`ensureOpen`), using webhook/`event_created_at` time | Vimeo uses **their** subscription start / gain definition, often excluding trials or counting differently |

Any first-touch webhook (`customer.product.created`, `renewed`, `updated`, trial, etc.) that finds no open row **creates** a subscription with `started_at = coalesce(eventCreatedAt)`. Historical backfill or the first days of webhook capture therefore stamp thousands of **pre-existing** Vimeo subscriptions as “new” on that calendar day. That alone can produce ~9k “new” vs Vimeo’s ~877 true gains.

Additional issues: **inconsistent definitions** between `analytics.mv_*` (dashboard cards) and `analytics.daily_*` (historical); **trial conversion %** on the dashboard MV is a current-state ratio, not a conversion rate; **renewals_today** on the MV uses `renewal_date` (often next billing date), while daily renewals use `subscription_events.event_type = 'renewed'`.

---

## Data flow (current)

```text
Vimeo webhook
  → vott_events (immutable; NEVER used for KPIs)
  → EventRouter → topic handlers
  → Customer / Product / Subscription / Payment / Timeline services
  → public.customers | subscriptions | payments | subscription_events
  → analytics.build_daily_snapshots(date) → analytics.daily_*
  → analytics.refresh_* → analytics.mv_*
  → AnalyticsService / MetricsBuilderService → /api/v1/analytics/*
```

**Rules already in code:**

- Analytics must not read `vott_events` for KPIs.
- Webhook pipeline does not increment analytics counters.
- `subscription_events.vott_event_id` is UNIQUE → same webhook cannot create two timeline rows.
- Payments use `transaction_reference = vimeo:{vottEventId}` → duplicate payment inserts are suppressed.

---

## How `started_at` is written (critical)

Source: [`SubscriptionService.ensureOpen`](../src/services/subscription/subscription.service.ts)

- If `findCurrent(customer, product)` is null → `subscriptions.create({ started_at: now })` where `now = coalesceTimestamp(eventCreatedAt)`.
- Handlers that can create a row via `ensureOpen` / lifecycle:  
  `customer.product.created`, `updated` (updateSnapshot), `renewed`, `paused`, `resumed`, `cancelled`, `expired`, `free_trial_created`, `free_trial_converted`, charge_failed paths that sync state, etc.
- There is **no** mapping of a Vimeo “original subscription start date” field into `started_at` in current code.
- Therefore **`started_at` = first observation time in our system**, not necessarily Vimeo business “subscription start.”

---

## Per-metric audit tables

### A. Daily subscription metrics (`analytics.daily_subscription_metrics`)

Built by `analytics.build_daily_snapshots` in [`021_analytics_daily_build_functions.sql`](../supabase/migrations/021_analytics_daily_build_functions.sql).

| Metric | Business Meaning (intended) | Current Data Source | Current SQL / Logic | Potential Issues | Recommended Formula |
|--------|----------------------------|---------------------|---------------------|------------------|---------------------|
| New Subscriptions | Subscriptions that **began** on the day | `subscriptions` | `COUNT(*)` where `(started_at AT TIME ZONE 'utc')::date = p_date` | `started_at` = first local create time, not Vimeo gain; includes trials; backfill inflates day; not DISTINCT needed (PK) but semantic wrong vs Vimeo | See **Recommended** section: paid first `created`/`trial_converted` day, or Vimeo start field if available |
| Renewals | Successful recurring billings | `subscription_events` | `COUNT(*)` where `event_type = 'renewed'` and `event_created_at::date = p_date` | Counts events not subscriptions; retries of *different* vott ids can double-count same sub; does not require successful payment | `COUNT(DISTINCT subscription_id)` where `event_type = 'renewed'` **and** matching succeeded payment that day (optional) |
| Cancellations | Subs cancelled that day | `subscriptions` | `COUNT(*)` where `cancelled_at::date = p_date` | Uses cancel timestamp from webhook handling; scheduled cancel vs immediate not distinguished; one row per subscription (OK) | Keep `COUNT(*)` on `cancelled_at`; document scheduled vs immediate |
| Expirations | Subs expired that day | `subscriptions` | `COUNT(*)` where `expired_at::date = p_date` | Same as cancel — event-time stamp | Keep |
| Paused | Pause events that day | `subscription_events` | `event_type = 'paused'` on `event_created_at` | Event count; multiple pauses possible | Prefer `COUNT(DISTINCT subscription_id)` |
| Resumed | Resume events that day | `subscription_events` | `event_type = 'resumed'` | Same as paused | Prefer `COUNT(DISTINCT subscription_id)` |
| Active Subscriptions (EOD) | Open at end of day | `subscriptions` | `started_at::date <= d` AND cancel/expire null or `::date > d` | Includes trials + paused; **differs** from dashboard MV “active”; incomplete history → undercount before webhook window | Document: open EOD including trial/paused; optionally exclude `free_trial` for “paid active” |
| Net Growth | Day’s delta | Derived | `new_subscriptions - cancellations - expirations` | Inherits inflated “new”; ignores pause; not Vimeo “gain” | Align numerator with corrected New / Gain definition |
| Churn Rate | Daily cancel intensity | Derived | `cancellations / (active_eod + cancellations) * 100` | Denominator mixes EOD actives with same-day cancels; not cohort churn | Prefer cancels / actives_at_start_of_day |

**Per-metric Q&A (daily subscriptions)**

| Metric | SoT table | Timestamp | Current vs Historical | Duplicate webhooks inflate? | Aggregation today |
|--------|-----------|-----------|----------------------|----------------------------|-------------------|
| New Subscriptions | `subscriptions` | `started_at` | Historical (date of first local create) | **Indirect YES** — replay of *different* first-touch topics can create many rows on ingest day; same `vott_event_id` does not recreate timeline but first create still stamps `started_at` | `COUNT(*)` (= row count) |
| Renewals | `subscription_events` | `event_created_at` | Historical events | **No** for identical webhook (`vott_event_id` unique); **Yes** if multiple distinct renew webhooks same day | `COUNT(*)` events |
| Cancellations | `subscriptions` | `cancelled_at` | Current-state column stamped historically | No (idempotent update of same row) | `COUNT(*)` |
| Expirations | `subscriptions` | `expired_at` | Same | No | `COUNT(*)` |
| Paused / Resumed | `subscription_events` | `event_created_at` | Historical events | No identical webhook; yes distinct repeats | `COUNT(*)` |
| Active EOD | `subscriptions` | `started_at` / `cancelled_at` / `expired_at` | Current-state reconstructed historically | No | `COUNT(*)` |
| Net Growth / Churn | Derived from above | — | Derived | Inherits upstream | Arithmetic |

---

### B. Daily trial metrics (`analytics.daily_trial_metrics`)

| Metric | Business Meaning | Current Data Source | Current SQL / Logic | Potential Issues | Recommended Formula |
|--------|------------------|---------------------|---------------------|------------------|---------------------|
| Trials Started | Trials beginning that day | `subscriptions` | `free_trial_start::date = p_date` | `free_trial_start` set from event time on `startTrial`; backfill same issue | Count distinct subs with `trial_started` event **or** trusted Vimeo trial start |
| Trials Converted | Trial → paid | `subscription_events` | `event_type = 'trial_converted'` on day | Event count; conversion_rate uses same-day starts only (mismatched cohorts) | `COUNT(DISTINCT subscription_id)`; rate = converted / started in cohort window |
| Trials Expired | Trial ended without convert | `subscriptions` | `free_trial_end::date = d` AND no `trial_converted` on/before d | `free_trial_end` set on **convert** path too (convertTrial sets end); expired-without-convert may be rare/wrong | Define expire as trial end without paid convert; may need cancel/expire topics |
| Conversion Rate | Started→converted same day | Derived | `converted / started * 100` | Not a true conversion rate | Cohort: convert within N days of start |

| Metric | SoT | Timestamp | State vs Events | Dup inflate? | Aggregation |
|--------|-----|-----------|-----------------|--------------|-------------|
| Trials Started | `subscriptions` | `free_trial_start` | Historical stamp | Indirect via backfill | `COUNT(*)` |
| Trials Converted | `subscription_events` | `event_created_at` | Events | No identical webhook | `COUNT(*)` |
| Trials Expired | `subscriptions` + events | `free_trial_end` | Hybrid | No | `COUNT(*)` |

---

### C. Daily payment metrics (`analytics.daily_payment_metrics`)

| Metric | Business Meaning | Current Data Source | Current SQL / Logic | Potential Issues | Recommended Formula |
|--------|------------------|---------------------|---------------------|------------------|---------------------|
| Successful Payments | Succeeded charges that day | `payments` | Status null or in succeeded/paid/success/completed; `payment_date::date = d` | Status null counted as success; retries = multiple rows | `COUNT(*)` of successful payment rows (or DISTINCT id); document retries |
| Failed Payments | Failed charges | `payments` | Status in failed/failure/declined/charge_failed | Retries inflate | Same |
| Recovered Payments | Fail then succeed | LAG over payments **or** max with `subscription_events.recovered` | Hybrid max of lag vs events | Can overcount; recovered timeline may be sparse | Prefer one definition: lag **or** events, not max |
| Payment Success Rate | Success / (success+fail) | Derived | Same day | Ignores “other” statuses | Keep with documented statuses |
| Revenue (cents) | Gross successful amount | `payments.amount_cents` | Sum successful on day | Refunds not modeled | Sum successful; document no refunds |

| Metric | SoT | Timestamp | State vs Events | Dup inflate? | Aggregation |
|--------|-----|-----------|-----------------|--------------|-------------|
| Successful / Failed | `payments` | `payment_date` | Historical rows | No same `vott_event_id` reference; yes multiple attempts | `COUNT(*)` |
| Recovered | `payments` + `subscription_events` | `payment_date` / `event_created_at` | Hybrid | Possible overcount | `COUNT(*)` of recovered definition |
| Revenue | `payments` | `payment_date` | Historical | Same as successful | `SUM(amount_cents)` |

Payments are written with `status = 'succeeded'` / `'failed'` by [`PaymentService`](../src/services/payment/payment.service.ts); idempotent on `transaction_reference`.

---

### D. Daily customer metrics (`analytics.daily_customer_metrics`)

| Metric | Business Meaning | Current Data Source | Current SQL / Logic | Potential Issues | Recommended Formula |
|--------|------------------|---------------------|---------------------|------------------|---------------------|
| New Customers | First seen that day | `customers` | `first_seen_at::date = d` | `first_seen_at` = first upsert into our DB, not Vimeo `created_at` | Prefer Vimeo customer created_at if present; else document “first observed” |
| Active Customers EOD | Customers with ≥1 open sub EOD | `subscriptions` | `COUNT(DISTINCT customer_id)` open EOD | Incomplete history undercounts | Same open definition as active subs |
| Returning Customers | Prior customers with activity today | payments ∪ subscription_events | Activity on d AND `first_seen_at < d` | “Activity” ≠ Vimeo returning; includes any event | Define activity (paid renew vs any event) |

---

### E. Daily product / country / platform

| Metric | Business Meaning | Current Logic | Potential Issues | Recommended |
|--------|------------------|---------------|------------------|-------------|
| Active subscribers (dim) | Open EOD attributed to product / customer.country / platform | Join subscriptions↔ customers/products | Country/platform null → `'unknown'`; product rows only if activity | Keep; document unknown bucket |
| New subscribers (dim) | `started_at` on day by dim | Same inflate as New Subscriptions | Same as New | Align with corrected Gain |
| Revenue (dim) | Successful payment amount that day | By `product_id` or customer country/platform | Attribution if product_id null on payment | Require product_id; else unknown |

---

### F. Dashboard MV KPIs (`analytics.mv_dashboard` and related)

Source: [`014_analytics_materialized_views.sql`](../supabase/migrations/014_analytics_materialized_views.sql). **Current-state / rolling windows**, not daily snapshots.

| Metric | Business Meaning | Current Data Source | Current SQL / Logic | Potential Issues | Recommended Formula |
|--------|------------------|---------------------|---------------------|------------------|---------------------|
| Total Customers | All customer rows | `customers` | `COUNT(*)` | Includes never-subscribed | Document |
| Active Subscribers (card) | Customers marked active | `customers.subscription_status` in (`active`,`enabled`,`subscribed`) | Filter on denormalized status | **≠** daily active_subscriptions; stale/wrong status; not subscription-row based | Align with open paid subscriptions count |
| New Customers Today | First seen today | `customers.first_seen_at::date = utc today` | Same as daily new customers | Observation bias | Same as recommended new customers |
| Active Subscriptions (MV sub CTE) | Open non-trial non-pause | `subscriptions` cancel/expire null, not free_trial, status not like pause | Third definition of “active” | Three conflicting “active” defs in one system | Single official active definition |
| Paused / Cancelled / Expired / Free Trial (MV) | Lifetime counts on rows | Current columns | Cancelled = ever cancelled, not “today” | Cards look like “today” but are all-time | Label as “total cancelled” or use daily |
| Renewals Today (MV) | ? | `subscriptions.renewal_date::date = today` and not cancelled | `renewal_date` set from **next_payment_date** — upcoming bill, **not** renewal events | **Does not match** daily renewals | Use `subscription_events.renewed` for today |
| Revenue Today/Week/Month/Year | Successful payment sums | `payments.payment_date` windows | UTC truncations | Timezone vs Vimeo account TZ | Document UTC; optional TZ param later |
| Charge Failures (MV) | Lifetime failed payment rows | `payments` failed statuses | All-time, not today | Misleading on dashboard | Use daily or “today” filter |
| Recovered (MV) | Status like `%recover%` | `payments.status` | App writes `succeeded`/`failed` only — **likely always 0** | Dead metric | Use lag/events definition |
| MRR / ARR | Recurring revenue proxy | `vw_subscription_mrr_cents` sum where > 0 | Open subs: monthly = price; yearly = price/12 | Incomplete catalog; cancelled/expired = 0; no proration | Document proxy; exclude trials if desired |
| ARPU | MRR / active_subscribers (customer status) | Derived | Denominator is customer-status active, numerator subscription MRR | Mismatched units | MRR / open paid subscriptions |
| ARPPU proxy | Lifetime revenue / total customers | Derived | Not ARPPU | Misnamed | Paying customers only |
| Trial conversion % (MV) | ? | `free_trial=true` open-ish / all `free_trial=true` | Current-state ratio, **not** conversion | Cannot match Vimeo conversion | Cohort convert / trial starts |
| Churn / Retention % (MV) | Cancelled vs active+cancelled | Lifetime row counts | Not period churn | Cannot match Vimeo period churn | Period cancels / start-of-period actives |
| Payment recovery % (MV) | recovered / (fail+recovered) | Uses broken recovered filter | Likely 0 | Fix definition first | Align with daily recovered |

API mapping: `GET /analytics/dashboard|overview|mrr|arr` → `mv_*` only. Domain GETs without date range → `mv_*`; with `date`/`dateFrom`/`dateTo` → `daily_*`.

---

## Metric matrix (source → snapshot)

| Metric | Source Table | Timestamp | Aggregation (current) | Snapshot / Cache |
|--------|--------------|-----------|------------------------|------------------|
| New Subscriptions | `subscriptions` | `started_at` | `COUNT(*)` | `daily_subscription_metrics.new_subscriptions` |
| Renewals (daily) | `subscription_events` | `event_created_at` | `COUNT(*)` | `daily_subscription_metrics.renewals` |
| Renewals Today (dashboard) | `subscriptions` | `renewal_date` | `COUNT(*)` | `mv_dashboard.renewals_today` |
| Cancellations | `subscriptions` | `cancelled_at` | `COUNT(*)` | `daily_subscription_metrics` + MV lifetime |
| Expirations | `subscriptions` | `expired_at` | `COUNT(*)` | `daily_subscription_metrics` |
| Paused / Resumed | `subscription_events` | `event_created_at` | `COUNT(*)` | `daily_subscription_metrics` |
| Active Subs EOD | `subscriptions` | start/cancel/expire | `COUNT(*)` | `daily_subscription_metrics.active_subscriptions` |
| Active Subscribers (card) | `customers` | `subscription_status` | `COUNT(*)` filter | `mv_dashboard.active_subscribers` |
| Net Growth | derived | — | arithmetic | `daily_subscription_metrics.net_growth` |
| Churn Rate (daily) | derived | — | rate | `daily_subscription_metrics.churn_rate` |
| Trials Started | `subscriptions` | `free_trial_start` | `COUNT(*)` | `daily_trial_metrics` |
| Trials Converted | `subscription_events` | `event_created_at` | `COUNT(*)` | `daily_trial_metrics` |
| Trials Expired | `subscriptions` | `free_trial_end` | `COUNT(*)` + anti-join | `daily_trial_metrics` |
| Successful / Failed Payments | `payments` | `payment_date` | `COUNT(*)` | `daily_payment_metrics` |
| Recovered Payments | `payments` LAG + `subscription_events` | payment / event | `COUNT(*)` / max | `daily_payment_metrics` |
| Revenue | `payments` | `payment_date` | `SUM(amount_cents)` | `daily_payment_metrics.revenue_cents` + MV windows |
| New Customers | `customers` | `first_seen_at` | `COUNT(*)` | `daily_customer_metrics` + MV today |
| Active Customers | `subscriptions` | EOD open | `COUNT(DISTINCT customer_id)` | `daily_customer_metrics` |
| Returning Customers | payments ∪ events | activity date | `COUNT(*)` distinct | `daily_customer_metrics` |
| Product / Country / Platform | joins | start / pay | counts + sum | `daily_*` dim tables |
| MRR / ARR | `subscriptions` via `vw_subscription_mrr_cents` | current open | `SUM(mrr_cents)` | `mv_dashboard` / `mv_subscription_metrics` |

---

## Vimeo match expectation

| Metric | Match to Vimeo? | Why |
|--------|-----------------|-----|
| New Subscriptions / Subscription Gain | **Cannot Match** (current formula) | We count first-observed `started_at`, often backfill day; Vimeo counts true period gains (often paid-only). Explains ~9,551 vs ~877. |
| Active Subscribers | **Approximate / Cannot Match** early on | Incomplete webhook history; our card uses `customers.subscription_status`, Vimeo uses their live entitlement. |
| Active Subscriptions EOD | **Likely Match** after full history + aligned definition | If both mean “open entitlements EOD” and we exclude/include trials the same way. |
| Renewals | **Approximate Match** | Event-based renewals can match if Vimeo counts renewal events; MV “renewals today” **Cannot Match**. |
| Cancellations / Expirations | **Likely Match** | Same-day business timestamps if Vimeo TZ aligned; we use UTC. |
| Trials Started / Converted | **Approximate Match** | Definitions and cohort windows often differ. |
| Failed Payments | **Likely Match** | Attempt-level counts; retries may differ. |
| Revenue Today / Month | **Likely Match** | Successful amounts by payment date; TZ and refunds may differ. |
| MRR / ARR | **Cannot Match** until complete open catalog + same pricing rules | Proxy only; missing history understates. |
| Churn % / Trial conversion % (dashboard) | **Cannot Match** | Our MV formulas are not period/cohort rates. |
| Net Growth | **Cannot Match** until New is fixed | Follows inflated New. |

**Data window caveat:** If webhook capture started mid-history (e.g. July 23), any current-state reconstruction for earlier days is incomplete. Active EOD and MRR before that window **Cannot Match** Vimeo.

---

## Identified problems (implementation)

1. **`started_at` semantics ≠ Vimeo subscription start / gain** — set on first local `ensureOpen` create from webhook time.  
2. **Backfill / first-ingest day inflation** — thousands of existing subs appear as New Subscriptions.  
3. **New Subscriptions includes free trials** — Vimeo Gain often paid-only.  
4. **Three conflicting “active” definitions** — customer status (MV card), open non-trial non-pause (MV CTE), open including trial/pause (daily EOD).  
5. **Dashboard `renewals_today` uses `renewal_date` (next bill)** — not renewal events.  
6. **Dashboard recovered payments filter on status `%recover%`** — writers never set that status.  
7. **Trial conversion % on MV is current-state ratio**, not conversion.  
8. **Churn % on MV is lifetime cancelled/(active+cancelled)**, not period churn.  
9. **Renewals / pause / resume / trial_converted use `COUNT(*)` events** — not `COUNT(DISTINCT subscription_id)`.  
10. **Recovered = max(lag-based, event-based)** — can overstate.  
11. **`first_seen_at` / customer “new” = first observed**, not Vimeo created_at.  
12. **Timezone:** all builder dates use UTC; Vimeo dashboards may use account local TZ.  
13. **Null payment status counted as successful** in SQL filters.  
14. **Net growth ignores pauses and trials-as-new policy.**  
15. **Same metric name, different stores** — UI may mix `mv_*` cards with `daily_*` series without labeling source.  
16. **Duplicate identical webhooks:** generally **do not** inflate timeline/payments (unique keys). **Distinct** webhooks and first-touch creates **do** inflate New.  
17. **`customer.updated` / `customer.product.updated`:** do not increment daily New by themselves unless `ensureOpen` creates a missing subscription row (updated can create).  
18. **Resumed is not counted as New** in daily SQL (good); but first-ever resume that creates a row **does** set `started_at` and counts as New (bad for Gain).

---

## EventRouter topic map (for auditors)

| Topic | Handler effect relevant to metrics |
|-------|-------------------------------------|
| `customer.created` / `customer.updated` | Customer upsert; `first_seen_at` on first insert |
| `customer.product.created` | Subscription create → `started_at` |
| `customer.product.updated` | `updateSnapshot` → may create open sub |
| `customer.product.renewed` | Payment succeeded + renew timeline; may create sub |
| `customer.product.cancelled` / `expired` | Stamps `cancelled_at` / `expired_at` |
| `customer.product.paused` / `resumed` | Timeline + status |
| `customer.product.charge_failed` | Failed payment + timeline |
| `customer.product.free_trial_created` | `free_trial_start` |
| `customer.product.free_trial_converted` | `trial_converted` + optional payment |
| Unknown | Skipped / no metrics |

Timeline `event_type` values: `created`, `updated`, `renewed`, `paused`, `resumed`, `cancelled`, `expired`, `charge_failed`, `trial_started`, `trial_converted`, `recovered`.

---

## Recommended Metric Definitions

**Official business specification for all future reports, dashboards, APIs, and charts.**  
Until implemented, current code remains as audited above.

### Principles

1. **Historical facts** come from immutable business timestamps (or first durable event), never from webhook *arrival* alone when a better business date exists.  
2. **Current KPI cards** (`mv_*`) must use the **same definitions** as daily snapshots for the “today” slice where comparable.  
3. Prefer **`COUNT(DISTINCT subscription_id)`** (or customer_id) for event streams; **`COUNT(*)`** for entity rows that are 1:1 with the entity.  
4. **Paid vs trial** must be explicit in the metric name.  
5. Document **UTC** as the reporting timezone until a product decision says otherwise.  
6. **Never** compute KPIs from `vott_events`; use normalized tables + snapshots only.

### Definitions

| Metric ID | Official meaning | Formula | Grain | Notes |
|-----------|------------------|---------|-------|-------|
| `subscription_gain` | New **paid** subscriptions that began on day D | Count subscriptions whose **business start** on D is a paid start: preferably Vimeo start date if ingested; else first `subscription_events.event_type = 'created'` on D where not trial, **or** `trial_converted` on D | Day | **Replaces** “New Subscriptions” for Vimeo Gain comparisons. Exclude pure trial starts. |
| `trial_starts` | Free trials that began on D | `COUNT(DISTINCT subscription_id)` with `trial_started` on D **or** `free_trial_start::date = D` once that field is trusted | Day | Do not add into `subscription_gain`. |
| `trial_conversions` | Trials that became paid on D | `COUNT(DISTINCT subscription_id)` where `event_type = 'trial_converted'` on D | Day | |
| `trial_conversion_rate` | Cohort conversion | Conversions within N days / trials started in cohort | Cohort | Default N = trial length or 30 — product decision. |
| `renewals` | Successful recurring charges on D | `COUNT(DISTINCT subscription_id)` with `renewed` on D **and** a succeeded payment on D for that subscription | Day | Align dashboard “Renewals today” to this, not `renewal_date`. |
| `cancellations` | Subscriptions cancelled on D | `COUNT(*)` where `cancelled_at::date = D` | Day | One row per subscription. |
| `expirations` | Subscriptions expired on D | `COUNT(*)` where `expired_at::date = D` | Day | |
| `pauses` / `resumes` | Pause/resume actions on D | `COUNT(DISTINCT subscription_id)` for `paused` / `resumed` | Day | |
| `active_subscriptions_eod` | Open entitlements at end of D | Started on/before D; cancel/expire null or after D | Day | Product must choose: **include trials?** **include paused?** Recommend: `active_paid_eod` excludes `free_trial` and optionally paused. |
| `active_subscribers_eod` | Distinct customers with ≥1 `active_subscriptions_eod` | `COUNT(DISTINCT customer_id)` | Day | Dashboard card must use this, not loose `subscription_status` text. |
| `net_subscription_growth` | Gain − cancel − expire (paid) | `subscription_gain - cancellations - expirations` | Day | Optional: net of pauses. |
| `churn_rate_daily` | Cancels / start-of-day actives | `cancellations / NULLIF(active_eod(D-1), 0) * 100` | Day | |
| `successful_payments` | Succeeded payment attempts on D | `COUNT(*)` payment rows successful on `payment_date` | Day | Document retries. |
| `failed_payments` | Failed attempts on D | `COUNT(*)` failed statuses | Day | |
| `recovered_payments` | Success on D after prior fail for same subscription | Lag definition **only** (drop status-like recover) | Day | |
| `payment_success_rate` | Success / (success + fail) on D | As named | Day | |
| `revenue_cents` | Sum of successful `amount_cents` on D | `SUM` | Day | No refunds until modeled. |
| `new_customers` | Customers whose **Vimeo create** (or first observed) falls on D | Prefer payload `created_at`; else `first_seen_at` labeled “first observed” | Day | |
| `returning_customers` | Customers with paid activity on D and prior first-seen | Distinct customers with successful payment on D and first_seen &lt; D | Day | Tighten vs any event. |
| `mrr_cents` | Monthly recurring revenue of open paid subs at refresh | Sum of monthly-normalized `price_cents` for open paid | Point-in-time | Exclude trials; yearly `/12`. |
| `arr_cents` | `mrr_cents * 12` | Derived | Point-in-time | |
| `arpu_cents` | `mrr_cents / active_paid_subscribers` | Derived | Point-in-time | Same denominator family. |

### Naming for APIs / UI

- Stop labeling `daily_subscription_metrics.new_subscriptions` as “Subscription Gain” until the formula matches `subscription_gain`.  
- Label dashboard fields with source: **Current (MV)** vs **Historical (daily)**.  
- Prefer UTC in UI footnotes.

### Validation checklist (post–definition change; not in this phase)

1. For a single day D, compare `subscription_gain` to Vimeo Subscription Gain.  
2. Confirm backfill days no longer show thousands of “new” legacy subs.  
3. Dashboard Renewals Today = daily renewals for UTC today.  
4. Active Subscribers card = `active_subscribers_eod` for today (or live open paid count).  
5. MRR within tolerance of Vimeo after catalog completeness.

---

## Document control

| Item | Value |
|------|--------|
| Phase | 9.5A — Audit only |
| Code changes | **None** |
| SQL / migrations | **None** |
| Next phase (future) | Implement Recommended Metric Definitions in builder + MVs + API labels |

This document is the authoritative analytics specification until superseded by an explicit product decision.
