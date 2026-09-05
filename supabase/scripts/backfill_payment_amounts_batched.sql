-- Fill blank payment amounts WITHOUT DO loops (SQL Editor gateway times out on long sessions).
-- Run ONE statement at a time. Re-run a week if it succeeds; skip weeks that return 0.
--
-- How to use in Supabase SQL Editor:
-- 1) Highlight ONLY one WITH ... UPDATE ... block
-- 2) Run
-- 3) Repeat for the next week

-- Progress check (safe / read-only):
-- select count(*) filter (where amount_cents is null) as still_null from public.payments;

-- =============================================================================
-- Step A: from subscription.price_cents (covers ~99% of blanks)
-- =============================================================================

-- July
with batch as (
  select p.id, s.price_cents, coalesce(s.currency, p.currency) as currency
  from public.payments p
  join public.subscriptions s on s.id = p.subscription_id
  where p.amount_cents is null
    and s.price_cents is not null
    and p.created_at >= '2026-07-01' and p.created_at < '2026-08-01'
)
update public.payments pay
set amount_cents = batch.price_cents,
    currency = coalesce(pay.currency, batch.currency)
from batch where pay.id = batch.id;

-- Aug 1–7
with batch as (
  select p.id, s.price_cents, coalesce(s.currency, p.currency) as currency
  from public.payments p
  join public.subscriptions s on s.id = p.subscription_id
  where p.amount_cents is null
    and s.price_cents is not null
    and p.created_at >= '2026-08-01' and p.created_at < '2026-08-08'
)
update public.payments pay
set amount_cents = batch.price_cents,
    currency = coalesce(pay.currency, batch.currency)
from batch where pay.id = batch.id;

-- Aug 8–14
with batch as (
  select p.id, s.price_cents, coalesce(s.currency, p.currency) as currency
  from public.payments p
  join public.subscriptions s on s.id = p.subscription_id
  where p.amount_cents is null
    and s.price_cents is not null
    and p.created_at >= '2026-08-08' and p.created_at < '2026-08-15'
)
update public.payments pay
set amount_cents = batch.price_cents,
    currency = coalesce(pay.currency, batch.currency)
from batch where pay.id = batch.id;

-- Aug 15–21
with batch as (
  select p.id, s.price_cents, coalesce(s.currency, p.currency) as currency
  from public.payments p
  join public.subscriptions s on s.id = p.subscription_id
  where p.amount_cents is null
    and s.price_cents is not null
    and p.created_at >= '2026-08-15' and p.created_at < '2026-08-22'
)
update public.payments pay
set amount_cents = batch.price_cents,
    currency = coalesce(pay.currency, batch.currency)
from batch where pay.id = batch.id;

-- Aug 22–31  << still needed if not applied yet
with batch as (
  select p.id, s.price_cents, coalesce(s.currency, p.currency) as currency
  from public.payments p
  join public.subscriptions s on s.id = p.subscription_id
  where p.amount_cents is null
    and s.price_cents is not null
    and p.created_at >= '2026-08-22' and p.created_at < '2026-09-01'
)
update public.payments pay
set amount_cents = batch.price_cents,
    currency = coalesce(pay.currency, batch.currency)
from batch where pay.id = batch.id;

-- September
with batch as (
  select p.id, s.price_cents, coalesce(s.currency, p.currency) as currency
  from public.payments p
  join public.subscriptions s on s.id = p.subscription_id
  where p.amount_cents is null
    and s.price_cents is not null
    and p.created_at >= '2026-09-01' and p.created_at < '2026-10-01'
)
update public.payments pay
set amount_cents = batch.price_cents,
    currency = coalesce(pay.currency, batch.currency)
from batch where pay.id = batch.id;

-- =============================================================================
-- Step B: product catalog (only if still_null remains and sub price is null)
-- =============================================================================
/*
with batch as (
  select
    p.id,
    case
      when lower(coalesce(s.billing_frequency, '')) ~ '(year|annual|^yr$|^y$)'
        then coalesce(pr.yearly_price_cents, pr.monthly_price_cents)
      else coalesce(pr.monthly_price_cents, pr.yearly_price_cents)
    end as amount_cents,
    coalesce(pr.currency, s.currency) as currency
  from public.payments p
  join public.subscriptions s on s.id = p.subscription_id
  join public.products pr on pr.id = coalesce(p.product_id, s.product_id)
  where p.amount_cents is null
    and coalesce(pr.monthly_price_cents, pr.yearly_price_cents) is not null
  limit 5000
)
update public.payments pay
set amount_cents = batch.amount_cents,
    currency = coalesce(pay.currency, batch.currency)
from batch where pay.id = batch.id;
*/
