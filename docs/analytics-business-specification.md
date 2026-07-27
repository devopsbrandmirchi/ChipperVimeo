# Analytics Business Specification

**Status:** Official Analytics Contract — Phase 9.7 (final documentation pass)  
**Effective:** 2026-07-25  
**Supersedes:** [`docs/analytics-metric-specification.md`](analytics-metric-specification.md) (Phase 9.5A audit — retained as historical forensic record only)

This document is the **permanent Analytics Contract** for every KPI in the Vimeo OTT Customer Subscription Analytics Platform.

All future SQL, services, repositories, APIs, dashboards, charts, reports, exports, scheduled jobs, materialized views, daily snapshots, BI tools, and AI reporting **must** follow these definitions. No implementation may invent its own KPI meaning.

Comparable reference products: Stripe Billing Analytics, Chargebee, ChartMogul, ProfitWell, Recurly.

**Phase 9.7 additions:** §14 Provider Event Mapping · §15 Snapshot Build Pipeline · §16 Metric Dependency Graph · §17 Snapshot Immutability · §18 Rebuild Process · §19 Metric Confidence · §20 Business Terminology · §21 Future Providers · §22 Implementation Checklist · §23 Architecture Decision Records (ADR)

---

## 1. Business Principles

### 1.1 Philosophy

1. **One definition per KPI.** Names like “Active Subscribers” or “Subscription Gain” mean exactly one thing across the product.
2. **Never analytics from the raw webhook log.** `vott_events` is an immutable audit store only.
3. **Never increment counters in the webhook hot path.** Handlers write normalized operational rows; the snapshot engine derives history later.
4. **Idempotent rebuilds.** Rebuilding day D always overwrites only `analytics.daily_*` for that day and yields the same result from the same operational inputs.
5. **Separate historical from current.** Trends and period reports use snapshots; live KPI cards use current caches.
6. **Provider-agnostic business language.** Definitions stay valid if Stripe, Apple IAP, or another OTT provider is added later.
7. **UTC calendar days** are the default reporting grain unless a product decision changes the reporting timezone.
8. **Rates are recomputed from totals** on rollup (week/month/year). Never average daily percentages.

### 1.2 Architecture

```text
Vimeo Webhooks
      ↓
Immutable Event Store          public.vott_events
      ↓
Normalized Operational Tables  customers, products, subscriptions,
                               payments, subscription_events
      ↓
Business Services              Customer / Product / Subscription /
                               Payment / Timeline (domain rules)
      ↓
Analytics Snapshot Engine      MetricsBuilder + build_daily_snapshots
      ↓
analytics.daily_*              Historical source of truth
      ↓
analytics.mv_*                 Current point-in-time KPI cache
      ↓
Versioned APIs                 /api/v1/analytics/*
      ↓
Dashboard / Reports / BI
```

### 1.3 Layer responsibilities

| Layer | Responsibility | Must not |
|-------|----------------|----------|
| Webhooks | Authenticate, accept, persist raw payload | Compute KPIs |
| `vott_events` | Immutable audit / replay / diagnostics | Feed dashboards directly |
| Operational tables | Canonical business state and history columns | Store rolled-up analytics |
| Domain services | Lifecycle rules, idempotent writes | Query analytics schema for business decisions |
| Snapshot engine | Derive daily facts from operational tables | Write to operational tables or `vott_events` |
| `analytics.daily_*` | Historical SoT for trends, charts, exports, cohorts | Act as live entitlement registry |
| `analytics.mv_*` | Fast current KPI cards (MRR, actives today, etc.) | Be the SoT for multi-day history |
| APIs | Enforce filters, map DTOs, auth | Contain SQL or invent KPI math |
| Dashboard | Present KPIs with source labels (Current vs Historical) | Query Supabase tables directly |

### 1.4 Two analytics stores

| Store | Role |
|-------|------|
| `analytics.daily_*` | **Historical** — every date-based report, chart, cohort, export |
| `analytics.mv_*` | **Current** — dashboard summary cards for “now” |

---

## 2. Business Dates

### 2.1 Definition

A **Business Date** is the UTC calendar date (`YYYY-MM-DD`) of the authoritative timestamp for a KPI. Every KPI must name exactly one authoritative timestamp. Implementations must not mix timestamps inside one KPI.

### 2.2 Timestamp catalog

| Timestamp | Table / context | Meaning |
|-----------|-----------------|---------|
| `business_start_at` | `subscriptions` (target field; see §11) | True subscription start for Gain; preferred over first-observed |
| `started_at` | `subscriptions` | First time this platform created the row (today often = first observed) |
| `free_trial_start` | `subscriptions` | Trial begin |
| `free_trial_end` | `subscriptions` | Trial end (convert or natural end — interpret carefully) |
| `cancelled_at` | `subscriptions` | Cancellation effective / recorded |
| `expired_at` | `subscriptions` | Expiration recorded |
| `event_created_at` | `subscription_events` | Lifecycle event business time from webhook |
| `payment_date` | `payments` | When the charge occurred (business) |
| `first_seen_at` | `customers` | First observed in this platform |
| `customer_created_at` | `customers` / payload | Provider customer create (preferred for New Customers when present) |
| `renewal_date` | `subscriptions` | **Next** expected bill — **not** a renewal event timestamp |
| `received_at` / ingest time | `vott_events` | Arrival time — **never** a KPI Business Date |
| `built_at` / `refreshed_at` | analytics tables | Audit of when snapshot/MV was built — not a business event |

### 2.3 Rules

1. Historical daily builders convert timestamps with `(ts AT TIME ZONE 'utc')::date`.
2. `renewal_date` must never drive “Renewals today.”
3. Webhook arrival / `vott_events` ingest time must never drive Gain, Revenue, or Churn.
4. When a better provider business date exists, prefer it over first-observed stamps (implementation phase).

---

## 3. Subscription Lifecycle

### 3.1 Canonical state machine

```text
NONE
  ↓  (product subscribed / trial created)
TRIAL
  ↓  (trial converted)          ↘ (trial ends without convert → CANCELLED / EXPIRED)
ACTIVE
  ⇄  PAUSED
  ↓  (cancel)
CANCELLED
  ↓  (term ends / expire webhook)
EXPIRED

Optional: ACTIVE ⇄ charge_failed (billing distress) → RECOVERED (success after fail) → ACTIVE
```

Canonical states used in analytics language:

| State | Meaning |
|-------|---------|
| `NONE` | No open subscription for customer+product |
| `TRIAL` | Free trial in progress (`free_trial = true`, open) |
| `ACTIVE` | Paid (or entitled) open subscription, not paused |
| `PAUSED` | Open but paused |
| `CANCELLED` | Cancellation recorded; may still have access until expire |
| `EXPIRED` | Access ended |
| `RECOVERED` | Transition label (billing recovered), not a durable state |

### 3.2 Legal transitions

| From | To | Trigger |
|------|-----|---------|
| NONE | TRIAL | Free trial created |
| NONE | ACTIVE | Paid subscription created (no trial) |
| TRIAL | ACTIVE | Trial converted |
| TRIAL | CANCELLED / EXPIRED | Trial ended without convert / cancel / expire |
| ACTIVE | PAUSED | Paused |
| PAUSED | ACTIVE | Resumed |
| ACTIVE / PAUSED | CANCELLED | Cancelled |
| CANCELLED / ACTIVE | EXPIRED | Expired |
| ACTIVE (billing fail) | ACTIVE | Charge failed (status may mark distress) |
| Distress | ACTIVE | Recovered payment / recovered event |

### 3.3 Vimeo webhook topic → lifecycle map

| Vimeo topic | Lifecycle transition | Timeline `event_type` |
|-------------|----------------------|------------------------|
| `customer.created` | Customer identity upsert | — (customer row) |
| `customer.updated` | Customer profile upsert | — |
| `customer.product.created` | NONE → ACTIVE (or TRIAL if trial flags) | `created` |
| `customer.product.updated` | Snapshot update; may create missing open row | `updated` |
| `customer.product.renewed` | ACTIVE stays ACTIVE; renewal event + payment | `renewed` |
| `customer.product.cancelled` | → CANCELLED | `cancelled` |
| `customer.product.expired` | → EXPIRED | `expired` |
| `customer.product.paused` | ACTIVE → PAUSED | `paused` |
| `customer.product.resumed` | PAUSED → ACTIVE | `resumed` |
| `customer.product.charge_failed` | Billing fail + failed payment | `charge_failed` |
| `customer.product.free_trial_created` | NONE → TRIAL | `trial_started` |
| `customer.product.free_trial_converted` | TRIAL → ACTIVE | `trial_converted` |
| Unknown topics | No lifecycle / no KPI | — |

Idempotency: at most one `subscription_events` row per `vott_event_id`; payments keyed by `vimeo:{vottEventId}`.

---

## 4. Official KPI Definitions

**Legend**

- **Source of Truth** = primary operational or analytics table used to compute the KPI.
- **Snapshot Table** = where historical daily values live (target after conformance).
- **Current MV** = where “now” cards live (target after conformance).
- **SQL Aggregation** = required aggregation shape (implementation must match).

| KPI | Business Definition | Source of Truth | Timestamp | SQL Aggregation | Snapshot Table | Current MV | Dashboard Usage |
|-----|---------------------|-----------------|-----------|-----------------|----------------|------------|-----------------|
| New Customers | Customers whose provider create (or first observed) falls on day D | `customers` | Prefer `customer_created_at`; else `first_seen_at` | `COUNT(*)` | `daily_customer_metrics.new_customers` | `mv_dashboard.new_customers_today` | Card “New customers today”; trends from daily |
| Active Customers | Distinct customers with ≥1 **Active Paid Subscription EOD** on D | `subscriptions` | EOD reconstruction via start/cancel/expire | `COUNT(DISTINCT customer_id)` | `daily_customer_metrics.active_customers` | Derived from open paid or `mv_dashboard` after align | Card + trends |
| Returning Customers | Prior customers with **successful payment** activity on D | `payments` + `customers` | `payment_date`; `first_seen_at` &lt; D | `COUNT(DISTINCT customer_id)` | `daily_customer_metrics.returning_customers` | — | Trends / engagement |
| Trial Starts | Free trials that began on D | `subscription_events` (preferred) or `subscriptions.free_trial_start` | `event_created_at` / `free_trial_start` | `COUNT(DISTINCT subscription_id)` | `daily_trial_metrics.trials_started` | Count open trials on `mv_trial_metrics` / dashboard | Card “Trials started today”; series |
| Trial Conversions | Trials that became paid on D | `subscription_events` | `event_created_at` where `trial_converted` | `COUNT(DISTINCT subscription_id)` | `daily_trial_metrics.trials_converted` | — | Trends |
| Trial Expired | Trials ending on D without conversion on/before D | `subscriptions` + anti-join events | `free_trial_end` | `COUNT(DISTINCT subscription_id)` | `daily_trial_metrics.trials_expired` | — | Trends |
| Trial Conversion Rate | Cohort: converted within trial window ÷ starts in cohort | events + subscriptions | Cohort start date | Ratio of counts | Derived from daily / cohort tables | Must **not** use current-state MV ratio | Charts; not a naive “today” card |
| Subscription Gain | New **paid** starts on D: paid `created` **or** `trial_converted` (trials alone excluded) | `subscription_events` | `event_created_at` (until trusted `business_start_at`) | `COUNT(DISTINCT subscription_id)` | `daily_subscription_metrics` (gain column — target rename from `new_subscriptions`) | Today’s gain on dashboard from daily or aligned MV | **Primary Vimeo “Subscription Gain” counterpart** |
| Renewals | Distinct subscriptions with a renewal **and** succeeded payment on D | `subscription_events` + `payments` | `event_created_at` + `payment_date` | `COUNT(DISTINCT subscription_id)` | `daily_subscription_metrics.renewals` | Today’s renewals (not `renewal_date`) | Card + series |
| Subscription Loss | Paid open subs that cancelled or expired on D | `subscriptions` | `cancelled_at` / `expired_at` | `COUNT(*)` cancel + expire (or distinct union) | daily subscription metrics | — | Net growth companion |
| Immediate Cancellation | Cancel recorded on D with no remaining paid access window (product rule: cancel implies end access same day, or flag when available) | `subscriptions` (+ payload flags when ingested) | `cancelled_at` | `COUNT(*)` filtered | daily (sub-metric) | — | Ops detail |
| Scheduled Cancellation | Cancel recorded but access continues until a future expire | `subscriptions` | `cancelled_at` + future `expired_at` / next_payment | `COUNT(*)` filtered | daily (sub-metric) | — | Ops detail |
| Expired | Subscriptions expired on D | `subscriptions` | `expired_at` | `COUNT(*)` | `daily_subscription_metrics.expirations` | Lifetime expired on MV labeled as total | Trends + totals |
| Paused | Distinct subscriptions paused on D | `subscription_events` | `event_created_at` `paused` | `COUNT(DISTINCT subscription_id)` | `daily_subscription_metrics.paused` | Current paused count on MV | Card / trends |
| Resumed | Distinct subscriptions resumed on D | `subscription_events` | `event_created_at` `resumed` | `COUNT(DISTINCT subscription_id)` | `daily_subscription_metrics.resumed` | — | Trends |
| Recovered (billing) | Billing recovered on D after prior failure | `payments` lag (primary) | `payment_date` | `COUNT(*)` recovered successes | `daily_payment_metrics.recovered_payments` | Align MV; drop `%recover%` status filter | Card / trends |
| Successful Payments | Succeeded charge attempts on D | `payments` | `payment_date` | `COUNT(*)` | `daily_payment_metrics.successful_payments` | Lifetime / windows on MV | Trends |
| Failed Payments | Failed charge attempts on D | `payments` | `payment_date` | `COUNT(*)` | `daily_payment_metrics.failed_payments` | Failures today/lifetime labeled clearly | Trends |
| Recovered Payments | Same as Recovered (billing) | `payments` | `payment_date` | Lag definition only | `daily_payment_metrics` | — | Trends |
| Payment Success Rate | Successful ÷ (successful + failed) on D | `payments` | `payment_date` | Recomputed rate | `daily_payment_metrics.payment_success_rate` | — | Charts |
| Revenue | Sum of successful `amount_cents` on D (gross; no refunds until modeled) | `payments` | `payment_date` | `SUM(amount_cents)` | `daily_payment_metrics.revenue_cents` | Today/week/month/year on `mv_dashboard` | Cards + charts |
| MRR | Monthly recurring revenue of **open paid** subscriptions at refresh | `subscriptions` via MRR view | Point-in-time open | `SUM(mrr_cents)` monthly-normalized | Optional daily MRR snapshot later | `mv_dashboard.mrr_cents` | Card |
| ARR | `MRR × 12` | Derived from MRR | Point-in-time | — | — | `mv_dashboard.arr_cents` | Card |
| ARPU | MRR ÷ Active Paid Subscribers (same population) | Derived | Point-in-time | — | — | `mv_dashboard` after align | Card |
| ARPPU | Lifetime (or period) revenue ÷ **paying** customers | `payments` + customers | Point or period | — | Optional | Proxy only until defined | Advanced |
| LTV | Average lifetime revenue per customer (paying) | `mv_customer_metrics` / daily aggs | Point-in-time | `AVG` / percentile | From customer metrics | `mv_ltv_metrics` | Card |
| Customer Lifetime | Avg days from start to cancel/expire (or now if open) | `subscriptions` | start vs end | `AVG(duration)` | subscription metrics | `mv_subscription_metrics` | Detail |
| Churn Rate | Cancels on D ÷ Active Paid EOD on D−1 × 100 | daily actives + cancels | Day D and D−1 | Recomputed | `daily_subscription_metrics.churn_rate` | Period churn only — not lifetime ratio | Charts |
| Retention Rate | `100 − Churn Rate` (same period definition) | Derived | Same | — | daily | — | Charts |
| Active Subscribers | Distinct customers with ≥1 **open paid** subscription EOD (exclude pure trial; product decision on paused: **exclude paused** from “Active”) | `subscriptions` | EOD | `COUNT(DISTINCT customer_id)` | `daily_customer_metrics` / subscription EOD | `mv_dashboard.active_subscribers` **must match this** | Primary live card |
| Active Paid Subscriptions | Open paid subscription rows EOD | `subscriptions` | EOD | `COUNT(*)` | `daily_subscription_metrics.active_subscriptions` (paid filter) | MV open paid | Series |
| Net Subscription Growth | Gain − cancellations − expirations (paid) | Derived | Day | Arithmetic | daily | — | Charts |
| Revenue by Country | Successful revenue on D by customer country | `payments` ⋈ `customers` | `payment_date` | `SUM` group by country | `daily_country_metrics.revenue` | `mv_country_metrics` current | Breakdown |
| Revenue by Platform | Same by platform | payments ⋈ customers | `payment_date` | `SUM` | `daily_platform_metrics` | `mv_platform_metrics` | Breakdown |
| Revenue by Product | Same by product | `payments` | `payment_date` | `SUM` | `daily_product_metrics.revenue` | `mv_product_metrics` | Breakdown |
| Subscribers by Country | Active paid EOD by country | subscriptions ⋈ customers | EOD | `COUNT` / distinct | `daily_country_metrics.active_subscribers` | MV | Breakdown |
| Subscribers by Platform | Active paid EOD by platform | same | EOD | — | `daily_platform_metrics` | MV | Breakdown |
| Subscribers by Product | Active paid EOD by product | subscriptions | EOD | — | `daily_product_metrics` | MV | Breakdown |
| Top Products | Rank products by revenue or actives in period | daily product | Range | `ORDER BY` limit | daily rollup | MV list | Tables |
| Top Countries | Rank countries by revenue or actives | daily country | Range | — | daily | MV | Tables |
| Top Platforms | Rank platforms by revenue or actives | daily platform | Range | — | daily | MV | Tables |

### 4.1 Paid vs trial (mandatory)

| Term | Definition |
|------|------------|
| **Open** | `started_at::date ≤ D` AND (`cancelled_at` null OR date &gt; D) AND (`expired_at` null OR date &gt; D) |
| **Paid open** | Open AND NOT (`free_trial = true`) |
| **Trial open** | Open AND `free_trial = true` |
| **Active (dashboard)** | Distinct customers with ≥1 paid open; **paused excluded** |

### 4.2 Successful / failed payment statuses

Successful: `status` IS NULL OR lower in (`succeeded`, `paid`, `success`, `completed`).  
Failed: lower in (`failed`, `failure`, `declined`, `charge_failed`).  
Do not treat `%recover%` status as recovered revenue.

---

## 5. Event vs State

### Event metrics

Occur on a day; counted from discrete facts.

- New Customers, Returning Customers (activity)
- Trial Starts, Trial Conversions, Trial Expired
- Subscription Gain, Renewals, Subscription Loss
- Immediate / Scheduled Cancellation, Expired, Paused, Resumed
- Successful / Failed / Recovered Payments
- Revenue (daily sum of events)

### Snapshot metrics

Describe the world at a point in time (EOD or refresh).

- Active Customers, Active Subscribers, Active Paid Subscriptions
- Current open trials
- MRR, ARR
- Dimension active subscriber counts
- LTV / customer metrics snapshot (at refresh)

### Calculated metrics

Derived from event and/or snapshot inputs.

- Net Subscription Growth
- Churn Rate, Retention Rate
- Trial Conversion Rate (cohort)
- Payment Success Rate
- ARPU, ARPPU
- ARR from MRR

---

## 6. Source of Truth

**Rule:** Exactly one primary source of truth per KPI. Secondary joins are allowed for dimensions; they do not become a second primary.

| KPI | Primary SoT | Why |
|-----|-------------|-----|
| Subscription Gain | `subscription_events` | Durable lifecycle facts; avoids inflated `started_at` first-observe |
| Renewals | `subscription_events` + `payments` | Need both renewal intent and money |
| Cancellations / Expired | `subscriptions` | One row per sub; columns are the cancel/expire facts |
| Paused / Resumed / Trial Converted | `subscription_events` | Event stream |
| Payments / Revenue | `payments` | Money facts |
| Active * EOD | `subscriptions` | Reconstructable state from start/cancel/expire |
| New Customers | `customers` | Identity grain |
| MRR / ARR | `subscriptions` (price + billing frequency) | Current entitlement value |
| Historical series | `analytics.daily_*` | Pre-aggregated SoT for APIs/charts |
| Current cards | `analytics.mv_*` | Fast cache of current definitions |

**Forbidden:** Computing the same KPI from `vott_events` and from `subscriptions` in different screens.

---

## 7. Historical vs Current

### Historical (always `analytics.daily_*`)

Daily / weekly / monthly / yearly trends, Subscription Gain over time, revenue charts, trial conversion trends, churn series, dimension breakdowns over ranges, exports, cohorts.

APIs with `date` / `dateFrom` / `dateTo` **must** read daily snapshots (after conformance).

### Current (always `analytics.mv_*`)

Cards: Active Subscribers, Current MRR, Current ARR, Revenue Today / This Month (rolling windows), Current open trials, Current paused — **using the same business definitions as “today” on daily tables**.

### Why

- Daily tables support rebuild, range queries, and BI without rescanning operational data.
- MVs keep dashboard latency low for single-row “now” reads.
- Definitions must stay aligned so “Active Subscribers” on the card equals today’s daily EOD (or live open paid count equivalent).

---

## 8. Metric Classification Matrix

| KPI | Event | Snapshot | Calculated | Current | Historical |
|-----|:-----:|:--------:|:----------:|:-------:|:----------:|
| New Customers | X | | | X (today) | X |
| Active Customers | | X | | X | X |
| Returning Customers | X | | | | X |
| Trial Starts | X | | | X (today) | X |
| Trial Conversions | X | | | | X |
| Trial Expired | X | | | | X |
| Trial Conversion Rate | | | X | | X |
| Subscription Gain | X | | | X (today) | X |
| Renewals | X | | | X (today) | X |
| Subscription Loss | X | | | | X |
| Immediate Cancellation | X | | | | X |
| Scheduled Cancellation | X | | | | X |
| Expired | X | | | | X |
| Paused | X | | | X (stock) | X (flow) |
| Resumed | X | | | | X |
| Recovered Payments | X | | | | X |
| Successful Payments | X | | | | X |
| Failed Payments | X | | | | X |
| Payment Success Rate | | | X | | X |
| Revenue | X | | | X (windows) | X |
| MRR | | X | | X | optional |
| ARR | | | X | X | optional |
| ARPU | | | X | X | |
| ARPPU | | | X | X | |
| LTV | | X | X | X | |
| Customer Lifetime | | | X | X | |
| Churn Rate | | | X | | X |
| Retention Rate | | | X | | X |
| Active Subscribers | | X | | X | X |
| Active Paid Subscriptions | | X | | X | X |
| Net Subscription Growth | | | X | | X |
| Revenue by Country/Platform/Product | X | | | X | X |
| Subscribers by Country/Platform/Product | | X | | X | X |
| Top Products/Countries/Platforms | | | X | X | X |

---

## 9. Customer Timeline

### Canonical journey

```text
Customer Created
      ↓
Trial Started          (optional)
      ↓
Trial Converted        (optional)
      ↓
Subscription Active
      ↓
Renewed  (repeat)
      ↓
Payment Failed         (optional)
      ↓
Recovered              (optional)
      ↓
Paused / Resumed       (optional)
      ↓
Cancelled
      ↓
Expired
```

### Producing tables

| Timeline entry | Operational write | Timeline row |
|----------------|-------------------|--------------|
| Customer Created | `customers` upsert | — |
| Trial Started | `subscriptions` trial fields | `subscription_events.trial_started` |
| Trial Converted | subscription → paid | `trial_converted` |
| Subscription Active / Created | `subscriptions` create | `created` |
| Updated snapshot | `subscriptions` update | `updated` |
| Renewed | payment + status | `renewed` |
| Payment Failed | `payments` failed | `charge_failed` |
| Recovered | succeeded payment after fail | `recovered` (optional) + payment lag |
| Paused / Resumed | status | `paused` / `resumed` |
| Cancelled / Expired | `cancelled_at` / `expired_at` | `cancelled` / `expired` |

Full raw payload remains in `vott_events`; timeline holds typed excerpts only.

---

## 10. Vimeo Compatibility

| KPI | Match class | Reason |
|-----|-------------|--------|
| Subscription Gain | **Expected Close Match** → Exact after conformance | Must use paid gain events, not first-observed `started_at` |
| Revenue Today / Month | **Expected Close Match** | UTC vs Vimeo account TZ; refunds |
| Successful / Failed Payments | **Expected Close Match** | Retry counting may differ |
| Renewals | **Expected Close Match** | After requiring payment + distinct subscription |
| Cancellations / Expired | **Expected Close Match** | TZ and scheduled vs immediate labeling |
| Trial Starts / Conversions | **Expected Close Match** | Cohort windows may differ in Vimeo UI |
| Active Subscribers | **Requires Historical Import** | Incomplete history before webhook window undercounts |
| Active Paid Subscriptions EOD | **Requires Historical Import** | Same |
| MRR / ARR | **Requires Historical Import** | Need full open catalog + pricing |
| ARPU / LTV | **Requires Historical Import** | Depends on MRR / lifetime revenue completeness |
| Churn / Retention (period) | **Expected Close Match** | After using start-of-day denominator |
| Trial Conversion % (current MV formula) | **Cannot Match** | Current implementation is not a conversion rate |
| Dashboard Renewals via `renewal_date` | **Cannot Match** | Wrong timestamp semantics |
| Net Growth using inflated New | **Cannot Match** | Until Gain is fixed |

---

## 11. Known Limitations

1. **Webhook history window** — Capture may begin mid-life (e.g. ~2026-07-23). Pre-window actives/MRR cannot match Vimeo without historical import.
2. **`started_at` = first observed** — Inflates “New Subscriptions” vs Vimeo Gain until Gain uses events / `business_start_at`.
3. **No full historical import** yet of Vimeo’s entire subscription catalog.
4. **Late-arriving webhooks** — Rebuild day D after late events to correct snapshots.
5. **Webhook replay** — Safe for identical `vott_event_id`; distinct historical dumps still create first-touch rows.
6. **Duplicate protection** — Unique `subscription_events.vott_event_id` and payment `transaction_reference`.
7. **Timezone** — Platform reports UTC; Vimeo may use account local time → day boundary drift.
8. **Refunds / credits** — Not modeled; Revenue is gross successful charges.
9. **Scheduled vs immediate cancel** — Not fully distinguished until payload flags are stored.
10. **Paused in Active** — Spec excludes paused from Active Subscribers; older SQL may still include open paused.
11. **Three legacy “active” defs** — Customer status text vs MV open paid vs daily open including trials — **deprecated**; one definition in §4.1.
12. **MV recovered `%recover%`** — Dead filter; lag-based recovered is official.
13. **Rebuild cost** — Large date ranges may time out in SQL editor; use API/psql with extended timeout.
14. **Provider field gaps** — Missing country/platform → `'unknown'` bucket.

---

## 12. Future Extensibility

KPI names and formulas are **provider-agnostic**. Future sources (Stripe, Shopify, Apple IAP, Google Play, Meta Ads, Google Ads, TikTok, other OTT) must:

1. Normalize into the same operational entities (customer, product, subscription, payment, subscription_event).
2. Map provider webhooks/events into the §3 state machine.
3. Set Business Dates from provider business timestamps.
4. Optionally add `provider` / `provider_account_id` columns without renaming KPIs.
5. Continue writing analytics only via the snapshot engine into `analytics.daily_*` / `mv_*`.

Marketing spend integrations feed **acquisition** analytics; they must not redefine Subscription Gain or MRR.

---

## 13. Analytics Glossary

| Business Name | Plain English | How calculated | Why it matters | Example |
|---------------|---------------|----------------|----------------|---------|
| New Customers | People we first recognize as customers that day | Count customers by create / first-seen date | Top of funnel | 120 new customers on Monday |
| Active Customers | People with at least one paid open subscription | Distinct customers, paid open EOD | Reach of paying base | 8,400 active customers |
| Returning Customers | Existing customers who paid again today | Distinct payers with prior first-seen | Loyalty / repeat billing | 45 returning |
| Trial Starts | Free trials that began | Distinct trial-start events that day | Top of trial funnel | 200 trials started |
| Trial Conversions | Trials that became paying | Distinct convert events | Monetization of trials | 60 converted |
| Trial Expired | Trials that ended without paying | Trial end without convert | Leakage | 40 expired |
| Trial Conversion Rate | Share of a trial cohort that paid | Converts in window ÷ cohort starts | Funnel health | 30% |
| Subscription Gain | New paying subscriptions that day | Distinct paid creates + converts | Growth (Vimeo “gain”) | 877 |
| Renewals | Paying subscribers who successfully renewed | Distinct renew + succeeded payment | Retention of revenue | 1,200 |
| Subscription Loss | Paying subs cancelled or expired | Cancels + expires that day | Contraction | 90 |
| Immediate Cancellation | Cancel that ends access now | Cancels with immediate end rule | Urgency of churn | 25 |
| Scheduled Cancellation | Cancel now, access later | Cancels with future end | Pending churn | 15 |
| Expired | Access ended | `expired_at` that day | Hard stops | 50 |
| Paused | Temporarily stopped | Distinct pause events | Soft churn | 12 |
| Resumed | Came back from pause | Distinct resume events | Win-back | 8 |
| Recovered Payments | Failed then succeeded | Success after prior fail | Dunning health | 10 |
| Successful Payments | Charges that worked | Count succeeded payments | Cash events | 1,500 |
| Failed Payments | Charges that failed | Count failed payments | Risk | 80 |
| Payment Success Rate | Success share of attempts | Success ÷ (success+fail) | Billing quality | 95% |
| Revenue | Money collected (gross) | Sum successful amounts | Top-line | $42,000 |
| MRR | Monthly recurring revenue | Sum normalized open paid prices | Run-rate | $180,000 |
| ARR | Annual run-rate | MRR × 12 | Board metric | $2.16M |
| ARPU | Revenue per active subscriber | MRR ÷ active paid subscribers | Monetization | $21.40 |
| ARPPU | Revenue per paying customer | Revenue ÷ paying customers | Depth of spend | $55 |
| LTV | Lifetime value | Avg lifetime revenue per paying customer | Unit economics | $240 |
| Customer Lifetime | How long people stay | Avg days start→end | Retention length | 14 months |
| Churn Rate | Share lost from yesterday’s base | Cancels ÷ prior EOD actives | Leakage | 1.2% |
| Retention Rate | Share kept | 100 − churn | Stickiness | 98.8% |
| Active Subscribers | Paying customers right now / EOD | Distinct paid open (not paused) | Headline KPI | 8,400 |
| Net Subscription Growth | Gain minus loss | Gain − cancel − expire | Net adds | +787 |
| Revenue by Country/Platform/Product | Where money comes from | Sum revenue by dimension | Mix | US 60% |
| Subscribers by Country/Platform/Product | Where subscribers sit | Actives by dimension | Mix | iOS 45% |
| Top Products / Countries / Platforms | Leaders in a period | Rank by revenue or actives | Focus | Plan Pro #1 |

---

## 14. Provider Event Mapping

Maps every supported Vimeo webhook into an internal business event, a lifecycle transition, and the analytics KPIs it can affect.

**Rules**

- Analytics never reads `vott_events` for KPI math; topics only matter because they write operational rows / timeline events that the snapshot engine later aggregates.
- Topics marked **Informational** update identity or snapshots but do not, by themselves, define Subscription Gain.
- Topics marked **Not implemented** are reserved for future handlers; they must not be assumed present in production until routed.

| Vimeo Webhook Topic | Internal Business Event | Lifecycle Transition | Analytics Impact | Class |
|---------------------|-------------------------|----------------------|------------------|-------|
| `customer.created` | Customer Created | — (identity) | New Customers (when create/first-seen falls on D) | Affects analytics |
| `customer.updated` | Customer Profile Updated | — | Dimension attrs (country/platform/plan); may affect later attribution; not Gain | Informational / attribute |
| `customer.product.created` | Subscription Created | NONE → ACTIVE (or TRIAL if trial flags) | Subscription Gain (if paid create); Active stock; product/country/platform actives | Affects analytics |
| `customer.product.updated` | Subscription Snapshot Updated | State refresh; may create missing open row | Usually informational; **can** create first-touch row (Gain risk until Gain uses events) | Mostly informational |
| `customer.product.renewed` | Subscription Renewed | ACTIVE → ACTIVE | Renewals; Successful Payments; Revenue; Recovered (if after fail) | Affects analytics |
| `customer.product.cancelled` | Subscription Cancelled | → CANCELLED | Cancellations; Subscription Loss; Churn; Active stock ↓ | Affects analytics |
| `customer.product.expired` | Subscription Expired | → EXPIRED | Expirations; Subscription Loss; Active stock ↓ | Affects analytics |
| `customer.product.paused` | Subscription Paused | ACTIVE → PAUSED | Paused (flow); Active Subscribers (paused excluded from Active) | Affects analytics |
| `customer.product.resumed` | Subscription Resumed | PAUSED → ACTIVE | Resumed; Active stock ↑ | Affects analytics |
| `customer.product.charge_failed` | Payment Failed | ACTIVE (billing distress) | Failed Payments; Payment Success Rate; may precede Recovered | Affects analytics |
| `customer.product.free_trial_created` | Trial Started | NONE → TRIAL | Trial Starts; open trials; **not** Subscription Gain | Affects analytics |
| `customer.product.free_trial_converted` | Trial Converted | TRIAL → ACTIVE | Trial Conversions; **Subscription Gain**; optional Successful Payment / Revenue | Affects analytics |
| `customer.product.set_cancellation` | Scheduled Cancellation Requested | ACTIVE → CANCELLED (scheduled) | Scheduled Cancellation (when implemented) | **Not implemented** today |
| Unknown / `*` | Ignored | — | None | Informational only |

### 14.1 Analytics vs informational (summary)

| Affects KPI snapshots | Informational / attribute only | Not implemented |
|-----------------------|--------------------------------|-----------------|
| created, renewed, cancelled, expired, paused, resumed, charge_failed, free_trial_created, free_trial_converted, customer.created | customer.updated, product.updated (usually), unknown | `customer.product.set_cancellation` |

---

## 15. Snapshot Build Pipeline

### 15.1 Required order

```text
Webhook received
      ↓
Persist vott_events (immutable)
      ↓
Normalize via domain services
      ↓
Customers  →  Products  →  Subscriptions  →  Payments  →  Timeline (subscription_events)
      ↓
Analytics Snapshot Engine (per UTC day D)
      ↓
daily_customer_metrics
daily_subscription_metrics
daily_trial_metrics
daily_payment_metrics          (revenue lives here)
daily_product_metrics
daily_country_metrics
daily_platform_metrics
      ↓
Materialized views (mv_*) refresh   ← current KPI cache only
      ↓
Versioned APIs / Dashboard
```

Within a single day build (`build_daily_snapshots(D)`), logical compute order:

1. **Subscription flows & EOD stock** (gain/renew/cancel/expire/pause/resume/active EOD)  
2. **Trial flows** (starts/converts/expires — uses subscription + events)  
3. **Payment flows & revenue** (success/fail/recovered/revenue)  
4. **Customer metrics** (new / active customers / returning — uses subs + payments + events)  
5. **Dimension tables** (product / country / platform — uses customers + subs + payments)  
6. **Derived rates for day D** (churn needs **prior day** active EOD; rebuild ranges oldest → newest)

After daily tables for the needed dates exist (or are rebuilt):

7. **Refresh `analytics.mv_*`** for current cards (does not replace historical SoT)

### 15.2 Why order matters

| Dependency | Why |
|------------|-----|
| Customers before subscriptions | Subscriptions FK to customers; country/platform attribution |
| Products before subscriptions | Product FK; product revenue/actives |
| Subscriptions before payments timeline | Payments/events attach to `subscription_id` |
| Payments before recovered / revenue / returning | Lag recovery and revenue sums need payment rows |
| Timeline events before Gain / renewals / pause | Event metrics read `subscription_events` |
| Prior-day subscription EOD before churn on D | Churn denominator = active paid EOD on D−1 |
| Daily tables before MV refresh for “today” parity | Cards should match today’s daily definitions after conformance |
| Never build analytics from `vott_events` | Operational tables are the only input to the snapshot engine |

### 15.3 Rebuild rules

- Rebuild day D by re-running the snapshot engine for D (overwrite `daily_*` for D only).
- For a range, build **ascending by date** so churn on D sees correct D−1 actives.
- MV refresh is **independent** and does not mutate `daily_*`.
- Webhook handlers must not write analytics tables.

---

## 16. Metric Dependency Graph

### 16.1 Graph (conceptual)

```text
Successful Payments ──► Revenue ──► (period revenue charts)
                         │
Open paid prices ───────► MRR ──► ARR
                         │
Active Paid Subscribers ─┴──► ARPU

Paying customers + lifetime revenue ──► LTV / ARPPU

Subscription Gain ──┐
Cancellations ──────┼──► Net Subscription Growth
Expirations ────────┘

Active Paid EOD (D−1) ──┐
Cancellations (D) ──────┴──► Churn Rate ──► Retention Rate

Trial Starts (cohort) ──┐
Trial Conversions ──────┴──► Trial Conversion Rate

Successful + Failed ──► Payment Success Rate

Failed then Successful (lag) ──► Recovered Payments
```

### 16.2 Dependency matrix

| KPI | Depends on | Calculation order |
|-----|------------|-------------------|
| Revenue | Successful Payments (amounts) | After payment facts for D |
| MRR | Open paid subscription prices / billing frequency | After subscription EOD stock |
| ARR | MRR | After MRR |
| ARPU | MRR, Active Paid Subscribers | After MRR + actives |
| ARPPU | Revenue (lifetime or period), paying customers | After revenue + customer paying set |
| LTV | Lifetime revenue per customer | After customer revenue aggregates |
| Net Subscription Growth | Subscription Gain, Cancellations, Expirations | After those three event metrics |
| Churn Rate | Cancellations (D), Active Paid EOD (D−1) | After D−1 snapshot and D cancels |
| Retention Rate | Churn Rate | After churn |
| Trial Conversion Rate | Trial Starts (cohort), Trial Conversions (window) | After cohort window closes / as-of report |
| Payment Success Rate | Successful Payments, Failed Payments | After payment counts |
| Recovered Payments | Ordered payments per subscription | After payment history |
| Active Subscribers | Paid open EOD (exclude paused) | After subscription state as of D |
| Top * rankings | Dimension revenue or actives | After dimension daily tables |
| Dimension revenue | Successful payments ⋈ customer/product dims | After payments + dims |
| Dimension subscribers | Paid open EOD ⋈ dims | After subscription EOD |

### 16.3 Build / report calculation order (summary)

1. Raw event & state facts (customers, subscriptions, payments, events)  
2. Daily stock & flow metrics (actives, gain, cancel, expire, trials, payments, revenue)  
3. Cross-day derived (churn, retention)  
4. Point-in-time value metrics (MRR → ARR → ARPU)  
5. Rankings / tops from dimension tables  
6. Current MV cache refresh  

---

## 17. Snapshot Immutability

### 17.1 Policy

**Snapshots are treated as immutable published history.** Once day D is built and accepted, historical analytics for day D should not drift under normal operations. Readers (APIs, dashboards, exports, BI) must treat `analytics.daily_*` rows as the fixed historical record for that Business Date.

Immutability here means: **no silent or partial edits**. Corrections happen only through an authorized **full-day rebuild** from operational sources (§18), not by hand-editing KPI cells.

### 17.2 What is immutable vs replaceable

| Object | Immutability rule |
|--------|-------------------|
| `vott_events` | Append-only audit. Never update payload for analytics convenience. Never delete to “fix” KPIs. |
| `subscription_events` | Append-only lifecycle facts (unique per `vott_event_id`). |
| Operational money / entitlement rows | Not rewritten to change history for analytics; corrections are new facts or controlled ops repairs outside the snapshot engine. |
| `analytics.daily_*` for day D | **Published history.** Change only via full rebuild of D (replace derived rows). Same operational inputs ⇒ same outputs. |
| `analytics.mv_*` | **Replaceable current cache**, not a historical ledger. |

### 17.3 Exceptions (when history may change)

Historical analytics **may** change only under these controlled exceptions:

| Exception | When allowed | Scope |
|-----------|--------------|-------|
| **Manual rebuild** | ADMIN / ops explicitly rebuilds date or range after late data or investigation | Selected `daily_*` days only |
| **Bug fixes** | Spec or builder formula was wrong; after code/SQL fix, rebuild affected days | Affected date range |
| **Historical import** | Bulk load of pre-webhook catalog into operational tables | Rebuild from earliest imported Business Date forward |
| **Backfill** | First populate or catch-up after outage | Contiguous date range, ascending |

Outside these cases, published daily rows must not be mutated.

### 17.4 When rebuilding is allowed

Rebuild is **allowed** when:

1. Late webhooks arrived for day D after the prior build.  
2. Operational data was corrected or historically imported.  
3. A KPI definition / builder bug was fixed (post–conformance changes).  
4. Initial backfill or disaster recovery.  
5. QA validation requires a clean recompute.

Rebuild is **not** allowed as a substitute for:

- Fixing bad webhook payloads by deleting `vott_events`  
- Patching a single metric column without recomputing the day  
- Changing “today’s card” by editing MVs by hand  

### 17.5 Guarantees

1. Rebuild must not modify `vott_events`, `customers`, `subscriptions`, `payments`, or `subscription_events`.  
2. Historical reports must read `analytics.daily_*`.  
3. Late data is fixed by rebuilding D (and dependents such as D+1 churn), not cell edits.  
4. `built_at` audits when derivation ran — it is not a Business Date.  

### 17.6 Anti-patterns (forbidden)

- Incrementing counters inside webhook handlers  
- Editing yesterday’s `daily_*` without a full day rebuild  
- Using MV refresh as a substitute for historical backfill  
- Deleting `vott_events` to remove a KPI  
- Mixing `received_at` into Business Dates  

---

## 18. Rebuild Process

### 18.1 Standard procedure

```text
Select Business Date(s) D … Dₙ  (ascending if range)
      ↓
Delete or UPSERT-replace snapshot rows for those dates
  (analytics.daily_* only — never operational tables)
      ↓
Recompute from operational tables
  (customers, products, subscriptions, payments, subscription_events)
      ↓
Validate totals
  (spot-check Gain, Revenue, Actives vs expected ranges / prior build)
      ↓
Commit transaction
      ↓
Refresh materialized views (analytics.mv_*)
      ↓
Confirm APIs / dashboard cards
```

Preferred entry points (after conformance tooling exists):

- `POST /api/v1/analytics/daily/build` with `{ "date" }`, `{ "dateFrom","dateTo" }`, or `{ "mode":"all" }`  
- SQL: `select analytics.build_daily_snapshots(d::date);` then `select analytics.refresh_all();` for MV cache  

### 18.2 Duplicate prevention

| Layer | Mechanism |
|-------|-----------|
| Timeline | `subscription_events.vott_event_id` **UNIQUE** — same webhook cannot create two lifecycle rows |
| Payments | `transaction_reference = vimeo:{vottEventId}` unique — duplicate charge inserts suppressed |
| Daily grain tables | Primary key on `date` (or `date` + dimension) — rebuild uses `ON CONFLICT DO UPDATE` or delete-then-insert for that key |
| Dimension days | Delete all rows for `date = D` then insert fresh set (product/country/platform) |

### 18.3 Idempotency

- Building day D twice with unchanged operational data must yield the **same KPI values** (only `built_at` may differ).  
- Range rebuilds must continue day-by-day; failures for one day must not corrupt other days’ committed rows.  
- MV refresh is idempotent relative to current operational + daily inputs at refresh time.  
- Webhook reprocessing of the same `vott_event_id` must not create duplicate timeline/payment facts; therefore rebuilds remain stable.

### 18.4 Validation checklist (before treating rebuild as done)

- [ ] Row exists for each requested day in core daily tables (subscription, trial, payment, customer)  
- [ ] Subscription Gain / Revenue for a sample day are finite and non-absurd vs Vimeo or prior build  
- [ ] Churn for D was built only after D−1 actives exist (when rebuilding ranges)  
- [ ] `mv_dashboard` refreshed if current cards must match “today”  
- [ ] No operational table row counts changed as a side effect of the rebuild  

---

## 19. Metric Confidence Level

Confidence reflects **expected accuracy vs Vimeo / ground truth** given current data completeness—not whether the formula is defined.

| KPI | Expected Accuracy | Reason |
|-----|-------------------|--------|
| Revenue Today / period | **High** | Driven by `payments.payment_date` and amounts; complete for events after webhook start |
| Successful / Failed Payments | **High** | Direct payment rows; retries are real attempts |
| Subscription Gain | **High** (after conformance) | Event-based paid create + trial convert; **Medium/Low today** if still using first-observed `started_at` |
| Trial Starts | **High** | Trial-start events / `free_trial_start` after capture window |
| Trial Conversions | **High** | Distinct `trial_converted` events |
| Renewals | **High** (after conformance) | Renew event + succeeded payment; Medium if counting events without payment join |
| Cancellations / Expirations | **High** | Column stamps on subscription rows |
| Active Subscribers (current) | **Medium** | Needs full open catalog; undercounts before history window |
| MRR | **Medium** | Requires complete open paid set + correct price/frequency; incomplete import lowers accuracy |
| ARR | **Medium** | Derived from MRR — same limitations |
| ARPU | **Medium** | Depends on MRR and active paid denominator alignment |
| Churn / Retention (period) | **Low–Medium** | Needs consistent prior-day actives; window edge days weak |
| LTV | **Low** | Needs long complete payment history per customer; truncated by webhook start |
| Customer Lifetime | **Low** | Same history truncation; open subs censor duration |
| Returning Customers | **Medium** | Depends on first-seen vs true create date |

### 19.1 Historical limitation (mandatory disclosure)

**Webhook history begins on or about 2026-07-25 / mid-July 2026 (ops: treat ~July 23 as the practical start of capture).**  

Subscriptions, payments, and lifecycle events **before** that window generally **cannot be reconstructed** from webhooks alone. Therefore:

- Pre-window **MRR, Active Subscribers, LTV, Retention** cannot reliably match Vimeo until a **historical import** lands in operational tables and days are rebuilt.  
- Post-window **Revenue, Gain (conforming), Trials, Renewals** can reach **High** confidence.  
- Always disclose the capture start date on executive dashboards when comparing to Vimeo.

---

## 20. Business Terminology

Executive companion to §13 (Glossary). Focus: **definition, business meaning, example, and common misunderstandings.**

### Subscription Gain

| | |
|--|--|
| **Definition** | Number of **paid** subscriptions that became ACTIVE on the Business Date (paid `created` or `trial_converted`). |
| **Business meaning** | True growth in paying entitlements that day (Vimeo “Subscription Gain” counterpart). |
| **Example** | 877 paid starts on Monday. |
| **This is NOT** | Trial Started · Renewal · Recovered Payment · Paused · first-observed backfill “new row” · customer.updated |

### Trials (Trial Starts)

| | |
|--|--|
| **Definition** | Distinct subscriptions that began a free trial on the Business Date. |
| **Business meaning** | Top of the trial funnel. |
| **Example** | 200 trials started. |
| **This is NOT** | Subscription Gain · Trial Conversion · Active Paid Subscribers |

### Renewals

| | |
|--|--|
| **Definition** | Distinct subscriptions with a renewal lifecycle event **and** a succeeded payment on that Business Date. |
| **Business meaning** | Existing paid relationships that billed successfully again. |
| **Example** | 1,200 renewals. |
| **This is NOT** | Subscription Gain · `renewal_date` / next bill date · failed charge · trial convert |

### MRR

| | |
|--|--|
| **Definition** | Monthly recurring revenue of **open paid** subscriptions at the refresh point (yearly normalized ÷ 12). |
| **Business meaning** | Run-rate of subscription income if nothing changes. |
| **Example** | $180,000 MRR. |
| **This is NOT** | Revenue today · one-time fees · ARR (ARR = MRR × 12) · trial-only inventory |

### ARR

| | |
|--|--|
| **Definition** | `MRR × 12`. |
| **Business meaning** | Annualized run-rate for planning and boards. |
| **Example** | $2.16M ARR. |
| **This is NOT** | Trailing twelve-month cash collected · Revenue YTD |

### ARPU

| | |
|--|--|
| **Definition** | MRR ÷ Active Paid Subscribers (same population). |
| **Business meaning** | Average monetization per active paying subscriber. |
| **Example** | $21.40 ARPU. |
| **This is NOT** | ARPPU · revenue per trial · ticket size of one payment |

### LTV

| | |
|--|--|
| **Definition** | Average lifetime revenue per paying customer (from successful payments over known history). |
| **Business meaning** | How much a customer is worth over their relationship. |
| **Example** | $240 LTV. |
| **This is NOT** | MRR · one month’s revenue · accurate for customers acquired before webhook history without import |

### Retention

| | |
|--|--|
| **Definition** | `100 − Churn Rate` for the same period definition. |
| **Business meaning** | Share of the base retained. |
| **Example** | 98.8% daily retention. |
| **This is NOT** | Logo retention in a different cohort · “active forever” count · 100 − lifetime cancel ratio on MV |

### Churn

| | |
|--|--|
| **Definition** | Cancellations on D ÷ Active Paid EOD on D−1 × 100. |
| **Business meaning** | How fast the paying base is shrinking that day. |
| **Example** | 1.2% daily churn. |
| **This is NOT** | Failed payments · pauses · lifetime cancelled ÷ (active+cancelled) stock ratio |

### Revenue

| | |
|--|--|
| **Definition** | Sum of successful payment amounts on the Business Date (gross; refunds not modeled yet). |
| **Business meaning** | Cash events recognized that day. |
| **Example** | $42,000 revenue today. |
| **This is NOT** | MRR · ARR · unpaid invoices · trial starts |

---

## 21. Future Providers

Extends §12. Analytics must remain **provider-agnostic at the KPI layer**.

### 21.1 Supported integration pattern

| Future provider (examples) | Integration duty |
|----------------------------|------------------|
| Stripe | Map invoices/subscriptions/charges → internal events |
| Apple App Store | Map IAP notifications → internal events |
| Google Play Billing | Map RTDN / purchase states → internal events |
| Shopify | Map subscription apps / orders → internal events |
| Other OTT platforms | Map their webhooks → same state machine (§3) |

### 21.2 Hard rules

1. Provider-specific events **must** map into **internal business events** (§14 style tables per provider).  
2. Analytics SQL, APIs, and dashboards must **NEVER** branch on provider webhook topic strings (e.g. must not `WHERE topic = 'customer.product.renewed'` inside KPI math).  
3. KPI math reads only operational tables + `analytics.*` derived stores.  
4. Optional `provider` / `provider_account_id` columns may filter or segment reports without renaming KPIs.  
5. Marketing platforms (Meta, Google Ads, TikTok) may feed acquisition metrics; they must not redefine Subscription Gain, MRR, or Revenue.

---

## 22. Implementation Checklist

**Mandatory for every future analytics KPI** before merge / release:

| # | Gate | Done |
|---|------|:----:|
| 1 | KPI definition exists in this contract (§4 / §20) | ☐ |
| 2 | Single Source of Truth identified (§6) | ☐ |
| 3 | Business timestamp / Business Date defined (§2) | ☐ |
| 4 | Event vs Snapshot vs Calculated classified (§5, §8) | ☐ |
| 5 | Historical vs Current path decided (`daily_*` vs `mv_*`) (§7) | ☐ |
| 6 | Snapshot destination table/column defined | ☐ |
| 7 | Dependency order respected (§16) | ☐ |
| 8 | Provider mapping updated if new webhook (§14 / §21) | ☐ |
| 9 | API endpoint / query params defined (or explicitly N/A) | ☐ |
| 10 | Dashboard widget / report placement defined (or explicitly N/A) | ☐ |
| 11 | Rebuild / immutability impact reviewed (§17–§18) | ☐ |
| 12 | Confidence level documented (§19) | ☐ |
| 13 | Unit/integration tests for formula + idempotent rebuild | ☐ |
| 14 | This documentation updated in the same PR | ☐ |

No KPI ships without clearing this checklist.

---

## 23. Architecture Decision Records (ADR)

Short ADRs explaining **why** the architecture exists.

### ADR-001 — Raw webhook events are immutable

**Decision:** Persist every accepted webhook in `vott_events` as append-only.  
**Why:** Replay, dispute, compliance, and debugging require an unaltered audit trail. Analytics must never mutate or delete these rows to “fix” KPIs.

### ADR-002 — Operational tables are the business source of truth

**Decision:** Customers, products, subscriptions, payments, and subscription_events hold business facts.  
**Why:** Normalized entities support lifecycle rules, FKs, and idempotent upserts. KPIs derive from these facts, not from raw JSON in the event store.

### ADR-003 — Historical reporting uses `analytics.daily_*`

**Decision:** Date-based trends, charts, exports, and cohorts read daily snapshot tables.  
**Why:** Pre-aggregated, rebuildable, query-stable history without rescanning operational tables for every chart.

### ADR-004 — Current KPIs use `analytics.mv_*`

**Decision:** Dashboard “now” cards read materialized views (current cache).  
**Why:** Low-latency single-row/point-in-time reads; must use the **same definitions** as today’s daily snapshot after conformance.

### ADR-005 — Business logic belongs in services, not routes

**Decision:** API routes parse input and call services; they contain no KPI formulas or SQL.  
**Why:** Keeps HTTP thin, testable, and reusable for jobs/workers.

### ADR-006 — Repositories never contain business rules

**Decision:** Repositories persist and query; services own rules and orchestration.  
**Why:** Prevents duplicated “business math” across data-access paths; analytics builders remain the only place that rolls KPIs into snapshots.

### ADR-007 — Versioned APIs (`/api/v1`) are mandatory

**Decision:** External and UI analytics traffic goes through `/api/v1/...`.  
**Why:** Stable contracts, auth, and evolution without breaking clients when KPI payloads gain fields.

### ADR-008 — Provider events map to internal business events

**Decision:** Every provider webhook is translated into internal lifecycle/payment events before analytics.  
**Why:** Multi-provider readiness; KPI engine stays independent of Vimeo (or Stripe/IAP) topic strings (§14, §21).

### ADR-009 — Snapshot rebuilds never write operational data

**Decision:** Rebuild/backfill may only replace `analytics.daily_*` (and refresh `mv_*`).  
**Why:** Protects transactional truth while allowing idempotent historical correction (§17–§18).

### ADR-010 — UTC Business Dates are the default reporting grain

**Decision:** KPI days use `(timestamp AT TIME ZONE 'utc')::date` unless product adopts another TZ.  
**Why:** One unambiguous grain across builders, APIs, and exports; TZ mismatches with Vimeo are documented, not silently mixed.

---

## Implementation contract (for next phase)

When the Metrics Engine and APIs are updated, they must:

1. Implement **Subscription Gain** (not first-observed `started_at` “new subscriptions”) as the Vimeo-comparable growth KPI.  
2. Unify **Active Subscribers** to §4.1.  
3. Drive **Renewals today** from renew events + payments, never `renewal_date`.  
4. Use **lag-based recovered payments** only.  
5. Compute **churn** with prior-day active denominator.  
6. Serve historical queries from `analytics.daily_*` and current cards from `analytics.mv_*` with identical definitions for “today.”  
7. Label UI fields **Current** vs **Historical**.  
8. Respect §15 build order and §17–§18 immutability / rebuild process.  
9. Pass the §22 checklist for every new or changed KPI.  

Until that conformance phase ships, production numbers may still follow the Phase 9.5A audit behavior; this document remains the **target and acceptance criteria**.

**No further documentation phases are planned.** Future work implements the engine against this contract.

---

## Document control

| Item | Value |
|------|--------|
| Phase | 9.7 (final documentation pass — complete) |
| Type | Permanent Analytics Contract |
| Audience | Developers, analysts, QA, business stakeholders |
| Owner | Analytics / Product |
| Next phase | Implement / conform Metrics Engine + MVs + APIs to this contract |
