-- Phase 9: helper views in analytics schema (over normalized public tables only).

create or replace view analytics.vw_successful_payments as
select *
from public.payments p
where p.status is null
   or lower(p.status) in ('succeeded', 'paid', 'success', 'completed');

comment on view analytics.vw_successful_payments is
  'Normalized successful payment filter shared by MVs.';

create or replace view analytics.vw_failed_payments as
select *
from public.payments p
where p.status is not null
  and lower(p.status) in ('failed', 'failure', 'declined', 'charge_failed');

create or replace view analytics.vw_open_subscriptions as
select *
from public.subscriptions s
where s.cancelled_at is null
  and s.expired_at is null;

create or replace view analytics.vw_subscription_mrr_cents as
select
  s.id as subscription_id,
  s.customer_id,
  s.product_id,
  s.status,
  s.billing_frequency,
  s.price_cents,
  s.currency,
  case
    when s.cancelled_at is not null or s.expired_at is not null then 0
    when s.billing_frequency is not null
      and lower(s.billing_frequency) in ('yearly', 'annual', 'annually', 'year', 'yr')
      then coalesce(s.price_cents, 0) / 12
    else coalesce(s.price_cents, 0)
  end::bigint as mrr_cents
from public.subscriptions s;

comment on view analytics.vw_subscription_mrr_cents is
  'MRR proxy: monthly price as-is; yearly price_cents / 12; cancelled/expired = 0.';
