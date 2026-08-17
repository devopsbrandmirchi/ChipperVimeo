-- Quick smoke test after applying migration 031
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
