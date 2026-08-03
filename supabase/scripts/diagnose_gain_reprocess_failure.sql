-- Diagnose a single failed gain reprocess event
-- Event: 90456bdb-563b-46ed-a71c-099f2c481291 (free_trial_created)

-- 1) Raw event shape
select
  id,
  topic,
  platform,
  customer_id as vimeo_customer_id,
  product_id as vimeo_product_id,
  product_name,
  subscription_status,
  event_created_at,
  payload -> '_embedded' -> 'customer' ->> 'email' as email,
  payload -> '_embedded' -> 'customer' -> '_embedded' -> 'products' -> 0 ->> 'id' as embedded_product_id
from public.vott_events
where id = '90456bdb-563b-46ed-a71c-099f2c481291';

-- 2) Normalized customer / product / open subscription
select
  c.id as customer_uuid,
  c.vimeo_customer_id,
  c.email,
  c.country,
  c.subscription_status as customer_status,
  p.id as product_uuid,
  p.vimeo_product_id,
  p.name as product_name,
  s.id as subscription_uuid,
  s.status as subscription_status,
  s.free_trial,
  s.cancelled_at,
  s.expired_at
from public.customers c
left join public.products p on p.vimeo_product_id = 18721
left join public.subscriptions s
  on s.customer_id = c.id
 and s.product_id = p.id
 and s.cancelled_at is null
 and s.expired_at is null
where c.vimeo_customer_id = 80541604;

-- 3) Any timeline rows for this customer (other events)
select
  se.id,
  se.event_type,
  se.vott_event_id,
  se.event_created_at,
  se.created_at
from public.subscription_events se
join public.customers c on c.id = se.customer_id
where c.vimeo_customer_id = 80541604
order by se.event_created_at nulls last
limit 20;
