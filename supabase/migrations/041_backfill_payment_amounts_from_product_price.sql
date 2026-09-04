-- Fill blank payment amounts when Vimeo omits customer.subscription_price.
-- 1) Backfill product catalog prices from raw_product.price.monthly/yearly
-- 2) Backfill subscription.price_cents from product catalog
-- 3) Backfill payment.amount_cents from event payload / subscription / product

-- 1) Products: subscription catalog uses monthly/yearly (not purchase/rental).
update public.products p
set
  monthly_price_cents = coalesce(
    p.monthly_price_cents,
    (p.raw_product #>> '{price,monthly,cents}')::integer,
    (p.raw_product #>> '{price,purchase,cents}')::integer
  ),
  yearly_price_cents = coalesce(
    p.yearly_price_cents,
    (p.raw_product #>> '{price,yearly,cents}')::integer,
    (p.raw_product #>> '{price,rental,cents}')::integer
  ),
  monthly_price_formatted = coalesce(
    p.monthly_price_formatted,
    p.raw_product #>> '{price,monthly,formatted}',
    p.raw_product #>> '{price,purchase,formatted}'
  ),
  yearly_price_formatted = coalesce(
    p.yearly_price_formatted,
    p.raw_product #>> '{price,yearly,formatted}',
    p.raw_product #>> '{price,rental,formatted}'
  ),
  currency = coalesce(
    p.currency,
    p.raw_product #>> '{price,monthly,currency}',
    p.raw_product #>> '{price,yearly,currency}',
    p.raw_product #>> '{price,purchase,currency}'
  )
where p.raw_product is not null
  and (
    p.monthly_price_cents is null
    or p.yearly_price_cents is null
    or p.currency is null
  );

-- 2) Subscriptions missing price → product catalog by billing frequency.
update public.subscriptions s
set
  price_cents = case
    when lower(coalesce(s.billing_frequency, '')) ~ '(year|annual|^yr$|^y$)'
      then coalesce(pr.yearly_price_cents, pr.monthly_price_cents)
    else coalesce(pr.monthly_price_cents, pr.yearly_price_cents)
  end,
  currency = coalesce(s.currency, pr.currency)
from public.products pr
where s.product_id = pr.id
  and s.price_cents is null
  and coalesce(pr.monthly_price_cents, pr.yearly_price_cents) is not null;

-- 3a) Payments: recover from linked vott_event customer.subscription_price.
update public.payments pay
set
  amount_cents = round(
    (ve.payload #>> '{_embedded,customer,subscription_price}')::numeric
  )::integer,
  currency = coalesce(
    pay.currency,
    nullif(upper(ve.payload #>> '{_embedded,customer,subscription_currency}'), '')
  )
from public.vott_events ve
where pay.amount_cents is null
  and pay.transaction_reference = 'vimeo:' || ve.id::text
  and (ve.payload #>> '{_embedded,customer,subscription_price}') ~ '^[0-9]+(\.[0-9]+)?$'
  and (ve.payload #>> '{_embedded,customer,subscription_price}')::numeric > 0;

-- 3b + 3c: use batched updates (full-table joins time out in SQL Editor).
-- Prefer 3c first (subscription/product catalog), then 3b (event embedded price).
-- Same logic lives in supabase/scripts/backfill_payment_amounts_batched.sql for re-runs.

set statement_timeout = '120s';

-- 3c: null payments ← subscription.price_cents / product catalog
do $$
declare
  updated int;
  total int := 0;
  batch_size int := 20000;
begin
  loop
    with batch as (
      select
        p.id,
        coalesce(
          s.price_cents,
          case
            when lower(coalesce(s.billing_frequency, '')) ~ '(year|annual|^yr$|^y$)'
              then coalesce(pr.yearly_price_cents, pr.monthly_price_cents)
            else coalesce(pr.monthly_price_cents, pr.yearly_price_cents)
          end
        ) as resolved_amount,
        coalesce(s.currency, pr.currency) as resolved_currency
      from public.payments p
      join public.subscriptions s on s.id = p.subscription_id
      left join public.products pr on pr.id = coalesce(p.product_id, s.product_id)
      where p.amount_cents is null
        and coalesce(
          s.price_cents,
          pr.monthly_price_cents,
          pr.yearly_price_cents
        ) is not null
      limit batch_size
    )
    update public.payments pay
    set
      amount_cents = batch.resolved_amount,
      currency = coalesce(pay.currency, batch.resolved_currency)
    from batch
    where pay.id = batch.id;

    get diagnostics updated = row_count;
    total := total + updated;
    exit when updated = 0;
  end loop;
  raise notice '041 3c updated % payment rows', total;
end $$;

-- 3b: remaining nulls ← embedded product price on linked vott_event (PK join)
do $$
declare
  updated int;
  total int := 0;
  batch_size int := 10000;
begin
  loop
    with batch as (
      select
        p.id,
        case
          when lower(coalesce(
            ve.payload #>> '{_embedded,customer,subscription_frequency}',
            s.billing_frequency,
            ''
          )) ~ '(year|annual|^yr$|^y$)'
            then coalesce(
              (ve.payload #>> '{_embedded,customer,_embedded,products,0,price,yearly,cents}')::integer,
              (ve.payload #>> '{_embedded,customer,_embedded,products,0,price,monthly,cents}')::integer
            )
          else coalesce(
            (ve.payload #>> '{_embedded,customer,_embedded,products,0,price,monthly,cents}')::integer,
            (ve.payload #>> '{_embedded,customer,_embedded,products,0,price,yearly,cents}')::integer
          )
        end as resolved_amount,
        coalesce(
          ve.payload #>> '{_embedded,customer,_embedded,products,0,price,monthly,currency}',
          ve.payload #>> '{_embedded,customer,_embedded,products,0,price,yearly,currency}',
          s.currency
        ) as resolved_currency
      from public.payments p
      join public.vott_events ve
        on ve.id = substring(p.transaction_reference from 7)::uuid
      left join public.subscriptions s on s.id = p.subscription_id
      where p.amount_cents is null
        and p.transaction_reference ~ '^vimeo:[0-9a-fA-F-]{36}$'
      limit batch_size
    )
    update public.payments pay
    set
      amount_cents = batch.resolved_amount,
      currency = coalesce(pay.currency, batch.resolved_currency)
    from batch
    where pay.id = batch.id
      and batch.resolved_amount is not null;

    get diagnostics updated = row_count;
    total := total + updated;
    exit when updated = 0;
  end loop;
  raise notice '041 3b updated % payment rows', total;
end $$;
