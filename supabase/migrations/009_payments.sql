-- Phase 2: payments — provider-agnostic payment attempts.
-- Designed so Stripe / Shopify / Recharge / custom billing need no redesign:
-- use payment_provider + transaction_reference for external identity.

create table public.payments (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid not null,
  subscription_id uuid,
  product_id uuid,

  amount_cents integer,
  currency text,
  status text,

  payment_date timestamptz,

  -- e.g. vimeo | stripe | shopify | recharge | custom
  payment_provider text,

  -- External charge / PaymentIntent / order id
  transaction_reference text,

  failure_reason text,
  promotion_code text,

  raw_payment jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_customer_id_fkey
    foreign key (customer_id) references public.customers (id)
    on delete restrict,

  constraint payments_subscription_id_fkey
    foreign key (subscription_id) references public.subscriptions (id)
    on delete restrict,

  constraint payments_product_id_fkey
    foreign key (product_id) references public.products (id)
    on delete restrict,

  constraint payments_amount_cents_nonneg
    check (amount_cents is null or amount_cents >= 0)
);

comment on table public.payments is
  'Payment attempts across providers. Vimeo webhooks may synthesize rows from renewed/charge_failed; Stripe etc. use payment_provider + transaction_reference.';

comment on column public.payments.payment_provider is
  'Billing source: vimeo, stripe, shopify, recharge, custom, etc.';

comment on column public.payments.transaction_reference is
  'Provider-native payment id. Combined with payment_provider for idempotent upserts.';

comment on column public.payments.raw_payment is
  'Provider payload excerpt for audit/debug.';

create trigger payments_set_updated_at
  before update on public.payments
  for each row
  execute function public.set_updated_at();

alter table public.payments enable row level security;

notify pgrst, 'reload schema';
