-- Loss coverage (updated rules — apply migration 027 first)

select * from public.fn_combined_loss_coverage(date '2026-07-24');

select *
from public.fn_unprocessed_loss_event_stats(
  date '2026-07-24',
  date '2026-07-28'
)
order by report_date, topic;

-- Apples-to-apples vs research SQL (UTC)
select
  (event_created_at at time zone 'utc')::date as event_date,
  count(*) as total_events
from public.vott_events
where (event_created_at at time zone 'utc')::date between '2026-07-24' and '2026-07-28'
  and (
    (lower(coalesce(platform, '')) = 'web' and (
      topic = 'customer.product.set_cancellation'
      or topic = 'customer.product.expired'
      or (topic = 'customer.product.charge_failed' and lower(coalesce(subscription_status, '')) = 'expired')
    ))
    or (lower(coalesce(platform, '')) <> 'web' and topic in (
      'customer.product.cancelled', 'customer.product.expired', 'customer.product.disabled'
    ))
    or topic = 'customer.product.free_trial_expired'
  )
group by 1
order by 1;
