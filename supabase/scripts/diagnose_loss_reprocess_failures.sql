-- Diagnose a failing loss reprocess row (paste a vottEventId from failures[])
select
  id,
  topic,
  platform,
  customer_id,
  product_id,
  product_name,
  subscription_status,
  event_created_at,
  payload -> '_embedded' -> 'customer' ->> 'id' as embedded_customer_id,
  jsonb_typeof(
    payload -> '_embedded' -> 'customer' -> '_embedded' -> 'products'
  ) as products_json_type,
  jsonb_array_length(
    coalesce(
      payload -> '_embedded' -> 'customer' -> '_embedded' -> 'products',
      '[]'::jsonb
    )
  ) as embedded_product_count
from public.vott_events
where id = '9f3f9dba-c88a-47a0-82f1-1bed50ea4a9a';

-- Failure mix for unprocessed loss on 2026-07-24
select
  v.topic,
  count(*) as n,
  count(*) filter (where v.product_id is null) as null_product_id,
  count(*) filter (where v.customer_id is null) as null_customer_id
from public.vott_events v
left join public.subscription_events se on se.vott_event_id = v.id
where se.id is null
  and (v.event_created_at at time zone 'utc')::date = date '2026-07-24'
  and (
    v.topic in (
      'customer.product.set_cancellation',
      'customer.product.cancelled',
      'customer.product.expired',
      'customer.product.disabled',
      'customer.product.free_trial_expired'
    )
    or (
      v.topic = 'customer.product.charge_failed'
      and lower(coalesce(v.subscription_status, '')) = 'expired'
    )
  )
group by v.topic
order by n desc;
