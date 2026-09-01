-- Quick smoke test after applying migration 031 / Phase 9.5 RPCs.
-- For full Vimeo QA (coverage + stock/MRR), use Phase 10.5:
--   supabase/scripts/phase_10_5_validate_gain_loss.sql
--   supabase/scripts/phase_10_5_validate_stock_mrr.sql
--   docs/analytics/phase-10.5-vimeo-validation-runbook.md
--
-- Expect rows in < a few seconds for a 7-day window

select *
from analytics.fn_subscription_metrics(
  (current_date - 6),
  current_date,
  null,
  null,
  null
)
limit 20;

-- Day totals only (sanity)
select
  report_date,
  sum(combined_gain) as combined_gain,
  sum(combined_loss) as combined_loss,
  sum(subscription_gain) as subscription_gain,
  sum(trial_gain) as trial_gain
from analytics.fn_subscription_metrics(
  (current_date - 6),
  current_date,
  null,
  null,
  null
)
group by report_date
order by report_date desc;
