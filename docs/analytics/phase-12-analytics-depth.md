# Phase 12 — Analytics Depth

## Already shipped before this phase
- Phase 9.5 gain/loss (do not rebuild)
- Cohort revenue + churn matrix (migrations 042–044) + Dashboard/Analytics UI
- MRR / ARR / revenue cards and APIs

## Delivered in Phase 12
| Area | Change |
|------|--------|
| Period churn | `daily_subscription_metrics.churn_rate` = cancels(D) ÷ active paid EOD(D−1) |
| Subscription gain (daily) | From `created` + `trial_converted` events (not `started_at`) |
| Renewals | Event + succeeded payment same UTC day (daily + live “Renewals today”) |
| Active paid EOD | `analytics.active_paid_subscribers_eod(date)` — exclude trial + paused |
| Cohort retention | UI block = `100 − churn` on same matrix |
| Cohort trial conversion | `fn_cohort_trial_conversion` + `/analytics/cohort-trials` |
| LTV / customers UI | Wired `/analytics/customers` + `/analytics/ltv` on Dashboard & Analytics |
| Charts | Empty-state copy cleaned |
| Export | `GET /analytics/cohorts/export` (`analytics:export`) |
| Scheduled refresh | `supabase/scripts/schedule_analytics_refresh_cron.sql` (ops run once) |

## Ops after deploy
1. Apply migration `045_phase12_analytics_depth.sql`
2. Rebuild recent days: `select analytics.build_daily_snapshots(d::date);` for needed range (oldest → newest)
3. `select analytics.refresh_dashboard(); select analytics.refresh_cohort_matrix();`
4. Optionally schedule: run `schedule_analytics_refresh_cron.sql` in SQL Editor

## Still out of scope / later
- Full §22 checklist as a release gate for every KPI
- Report builder UI
- Replacing stock MV churn card with a live prior-day series chart (daily rate is available after rebuild)
