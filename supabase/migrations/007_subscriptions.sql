-- Phase 2: subscriptions — customer × product subscription lifecycle rows.
-- Vimeo OTT does not provide a native subscription ID; our UUID is the identity.
-- Phase 3 matching: find open row for (customer_id, product_id); on re-subscribe
-- after cancel/expire, INSERT a new row.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid not null,
  product_id uuid not null,

  status text,
  billing_frequency text,
  currency text,
  price_cents integer,

  started_at timestamptz,
  renewal_date timestamptz,
  last_payment_date timestamptz,
  next_payment_date timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  pause_end_date timestamptz,

  free_trial boolean,
  free_trial_start timestamptz,
  free_trial_end timestamptz,

  promotion_code text,

  subscription_created_at timestamptz,
  subscription_updated_at timestamptz,

  raw_subscription jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subscriptions_customer_id_fkey
    foreign key (customer_id) references public.customers (id)
    on delete restrict,

  constraint subscriptions_product_id_fkey
    foreign key (product_id) references public.products (id)
    on delete restrict,

  constraint subscriptions_price_cents_nonneg
    check (price_cents is null or price_cents >= 0)
);

comment on table public.subscriptions is
  'Customer subscriptions over time. No Vimeo subscription ID — UUID is the PK. Re-subscribe after terminal status creates a new row.';

comment on column public.subscriptions.raw_subscription is
  'Subscription-relevant slice from the webhook (customer subscription fields + product context).';

comment on column public.subscriptions.status is
  'Business status snapshot (e.g. active, cancelled, expired, paused, free_trial). Free-form text for Vimeo variance.';

-- Circular FK: customers.active_subscription_id → subscriptions.id
alter table public.customers
  add constraint customers_active_subscription_id_fkey
  foreign key (active_subscription_id) references public.subscriptions (id)
  on delete set null;

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row
  execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

notify pgrst, 'reload schema';
