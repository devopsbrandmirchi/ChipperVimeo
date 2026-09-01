# Phase 10.5 — Vimeo metric validation runbook

Ops / QA track to compare this app’s analytics to **Vimeo OTT admin** reporting.

**Does not** change product UI. Uses SQL scripts + this checklist.

## Prerequisites

1. Migrations through **037** applied (gain/loss views + dashboard timeout helpers).
2. Access to Supabase SQL Editor (service role / authenticated as needed).
3. Access to Vimeo OTT admin analytics for the same site.
4. Read:
   - [`business-metrics.md`](business-metrics.md)
   - [`event-mapping.md`](event-mapping.md)
   - [`subscription-metrics-validation.md`](subscription-metrics-validation.md)
   - [`known-validation-gaps.md`](known-validation-gaps.md)

## Scripts

| Script | Purpose |
|--------|---------|
| [`supabase/scripts/phase_10_5_validate_gain_loss.sql`](../../supabase/scripts/phase_10_5_validate_gain_loss.sql) | Gain/loss smoke, day totals, ingest coverage, platform sanity |
| [`supabase/scripts/phase_10_5_validate_stock_mrr.sql`](../../supabase/scripts/phase_10_5_validate_stock_mrr.sql) | Actives / trials / MRR / ARR / freshness |
| [`supabase/scripts/smoke_subscription_metrics.sql`](../../supabase/scripts/smoke_subscription_metrics.sql) | Quick 7-day RPC smoke |
| [`supabase/scripts/check_daywise_gain_loss_coverage.sql`](../../supabase/scripts/check_daywise_gain_loss_coverage.sql) | Day-wise UI presence vs events |
| [`supabase/scripts/reprocess_gain_coverage.sql`](../../supabase/scripts/reprocess_gain_coverage.sql) | Gain reprocess helpers |
| [`supabase/scripts/reprocess_loss_coverage.sql`](../../supabase/scripts/reprocess_loss_coverage.sql) | Loss reprocess helpers |

Edit `start_date` / `end_date` in the `params` CTE of the Phase 10.5 scripts before running.

---

## Part 1 — Gain / Loss (priority)

### Steps

1. In Vimeo, open **Subscriptions & trials** (or equivalent Gain/Loss chart) for a fixed UTC-aligned window (prefer **Yesterday** or a single historical day).
2. Note Vimeo Combined Gain / Combined Loss (and platform series if available).
3. Run `phase_10_5_validate_gain_loss.sql` for the **same calendar dates in UTC**.
4. Compare section **B_day_totals** to Vimeo day totals.
5. If our Combined Gain is lower, run section **C_gain_coverage** / **D_missing_gain_by_topic**.
6. If missing `subscription_events` rows, reprocess (gain/loss Edge Functions + cron scripts) then re-run.

### Pass criteria (gain/loss)

| Check | Pass | Warn | Fail |
|-------|------|------|------|
| Combined Gain vs Vimeo (same UTC day) | within ±5% or ±20 events | ±5–15% | >15% after reprocess |
| Gain coverage `se / vott` | ≥95% | 80–95% | <80% |
| Platform TOTAL ≈ sum of buckets | exact | — | mismatch |
| RPC returns in a few seconds (7d) | yes | slow | timeout |

### Worksheet (fill per validation day)

| UTC date | Vimeo Combined Gain | App Combined Gain | Vimeo Combined Loss | App Combined Loss | Coverage status | Notes |
|----------|---------------------|-------------------|---------------------|-------------------|-----------------|-------|
| | | | | | | |

API cross-check (optional):

`GET /api/v1/analytics/subscription-metrics?preset=yesterday`

---

## Part 2 — Stock / MRR / ARR

### Steps

1. Refresh snapshot if stale: `select analytics.refresh_dashboard();` (long-running).
2. Run `phase_10_5_validate_stock_mrr.sql`.
3. Compare **A_mv_dashboard** to Vimeo current subscribers / MRR (if shown).
4. Confirm **E_freshness** is `fresh_today` before trusting MTD/MRR cards.
5. Compare **B_ops_recompute** to MV — large gaps mean MV definition drift or refresh failure.

### Pass criteria (stock)

| Check | Pass | Notes |
|-------|------|-------|
| `refreshed_at` UTC date = today | required for “current” cards | |
| Active subscribers vs Vimeo | document delta | Pre-ingest history cannot match without historical import |
| MRR vs Vimeo | document delta | Pricing / billing-frequency normalization differences expected |
| Open trials vs Vimeo | document delta | Lifetime trial flags must not be used (see check_dashboard_trials_cancelled.sql) |

### Worksheet

| Metric | Vimeo | App (mv_dashboard) | Ops recompute | Delta | Acceptable? |
|--------|-------|--------------------|---------------|-------|-------------|
| Active subscribers | | | | | |
| Open trials | | | | | |
| MRR | | | | | |
| ARR | | | | | |
| Snapshot refreshed_at | — | | — | | |

---

## Part 3 — When validation fails

1. **Coverage fail** → run gain/loss reprocess; see `diagnose_gain_reprocess_failure.sql` / `diagnose_loss_reprocess_failures.sql`.
2. **TZ mismatch (±1 day)** → compare using the same UTC day boundaries; do not use session-local `::date` on timestamptz.
3. **Stock far below Vimeo** → expected if webhook history started mid-life; see [`known-validation-gaps.md`](known-validation-gaps.md). Escalate historical import only as a product decision (not Phase 10.5 scope).
4. **Stale MRR** → refresh dashboard; if timeout, use SQL Editor with raised `statement_timeout` (migrations 036/037).

---

## Sign-off

| Item | Owner | Date | Result |
|------|-------|------|--------|
| Gain/loss Part 1 | | | Pass / Warn / Fail |
| Stock/MRR Part 2 | | | Pass / Warn / Fail |
| Known gaps reviewed | | | Yes / No |

Related Phase 9.5 API: `GET /api/v1/analytics/subscription-metrics`.  
Related Phase 12: deeper 9.7 churn/cohort conformance (not required for 10.5 sign-off).
