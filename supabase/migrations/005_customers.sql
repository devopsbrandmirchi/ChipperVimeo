-- Phase 2: customers — one row per Vimeo customer (current business state).
-- Populated from vott_events by the Phase 3 event processor.
-- Does NOT duplicate product catalog fields.

create extension if not exists "pgcrypto";

-- Shared trigger: keep updated_at current on mutable normalized tables.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger helper: sets updated_at = now() on mutable tables.';

create table public.customers (
  id uuid primary key default gen_random_uuid(),

  -- Vimeo natural key (maps to _embedded.customer.id)
  vimeo_customer_id bigint not null,

  email text,
  first_name text,
  last_name text,
  full_name text,

  country text,
  region text,
  city text,

  -- Current snapshot fields (denormalized for analytics; not product catalog)
  platform text,
  plan text,
  subscription_status text,

  marketing_opt_in boolean,
  promotion_code text,
  most_recent_promotion_code text,
  coupon_code text,

  registered_to_site boolean,
  subscribed_to_site boolean,
  external_user_id text,

  -- Timestamps from Vimeo payload
  customer_created_at timestamptz,
  customer_updated_at timestamptz,

  -- Observed by our processor
  first_seen_at timestamptz,
  last_seen_at timestamptz,

  last_payment_date timestamptz,
  next_payment_date timestamptz,

  -- FK to subscriptions added in 007 (circular dependency)
  active_subscription_id uuid,

  raw_customer jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customers_vimeo_customer_id_key unique (vimeo_customer_id)
);

comment on table public.customers is
  'Normalized Vimeo customers. One row per vimeo_customer_id. Snapshot of latest business state; product details live in products/subscriptions.';

comment on column public.customers.vimeo_customer_id is
  'Vimeo OTT customer id from webhook _embedded.customer.id. Unique for idempotent upserts.';

comment on column public.customers.active_subscription_id is
  'Pointer to the current open subscription row. FK added in 007_subscriptions.sql.';

comment on column public.customers.raw_customer is
  'Last-seen _embedded.customer object (or excerpt) for audit/debug.';

create trigger customers_set_updated_at
  before update on public.customers
  for each row
  execute function public.set_updated_at();

alter table public.customers enable row level security;

notify pgrst, 'reload schema';
