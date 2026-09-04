-- Fix 100x-inflated money: Vimeo OTT subscription_price is already in cents.
-- Historical ingest used priceToCents(price * 100), so payments/subscriptions
-- stored e.g. 59900 for a $5.99 plan (raw subscription_price = 599).
-- Product catalog monthly/yearly_price_cents are correct (API .cents) — leave alone.

update public.payments
set amount_cents = (amount_cents / 100)::integer
where amount_cents is not null
  and amount_cents <> 0;

update public.subscriptions
set price_cents = (price_cents / 100)::integer
where price_cents is not null
  and price_cents <> 0;

-- Sparse daily snapshots derived from the same inflated amounts.
update analytics.daily_payment_metrics
set revenue_cents = (revenue_cents / 100)::bigint
where revenue_cents is not null
  and revenue_cents <> 0;

comment on column public.payments.amount_cents is
  'Payment amount in integer cents. Vimeo subscription_price is already cents.';

comment on column public.subscriptions.price_cents is
  'Subscription price in integer cents. Vimeo subscription_price is already cents.';
