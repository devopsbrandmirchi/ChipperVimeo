-- Loss coverage checks (SQL Editor)
-- Apply migration 026 first.

select * from public.fn_combined_loss_coverage(date '2026-07-24');

select *
from public.fn_unprocessed_loss_event_stats(
  date '2026-07-22',
  date '2026-07-28'
)
order by report_date, topic;

-- Sample pending loss webhooks
select id, topic, platform, event_created_at
from public.fn_unprocessed_loss_events(
  date '2026-07-22',
  date '2026-07-28',
  50
);
