-- Batched replacement for migration 041 steps 3b + 3c.
-- Run this in Supabase SQL Editor (re-runnable). Prefer 3c first (fast), then 3b.
-- Each loop processes LIMIT rows so the editor timeout is avoided.

set statement_timeout = '120s';

-- ---------------------------------------------------------------------------
-- 3c first: null payments ← subscription.price_cents / product catalog
-- (no vott_events join — much cheaper)
-- ---------------------------------------------------------------------------
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
    raise notice '3c batch updated % (running total %)', updated, total;
  end loop;
  raise notice '3c done, total updated %', total;
end $$;

-- ---------------------------------------------------------------------------
-- 3b: remaining nulls ← embedded product price on linked vott_event
-- Join via extracted UUID so vott_events PK is used (not 'vimeo:' || id).
-- ---------------------------------------------------------------------------
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
    raise notice '3b batch updated % (running total %)', updated, total;
  end loop;
  raise notice '3b done, total updated %', total;
end $$;

-- Sanity check
select
  count(*) filter (where amount_cents is null) as still_null,
  count(*) filter (where amount_cents is not null) as has_amount
from public.payments;
