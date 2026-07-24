-- Phase 2: secondary indexes for frequent analytics / lookup filters.
-- PK and UNIQUE constraints already create their indexes.
-- Partial uniques enforce business rules (one open sub; provider payment idempotency).

-- ---------------------------------------------------------------------------
-- Partial unique: one open subscription per customer + product
-- ---------------------------------------------------------------------------
create unique index if not exists subscriptions_one_open_per_customer_product_idx
  on public.subscriptions (customer_id, product_id)
  where cancelled_at is null and expired_at is null;

-- ---------------------------------------------------------------------------
-- Partial unique: multi-provider payment idempotency
-- ---------------------------------------------------------------------------
create unique index if not exists payments_provider_transaction_reference_idx
  on public.payments (payment_provider, transaction_reference)
  where transaction_reference is not null;

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create index if not exists customers_email_idx
  on public.customers (email);

create index if not exists customers_country_idx
  on public.customers (country);

create index if not exists customers_platform_idx
  on public.customers (platform);

create index if not exists customers_subscription_status_idx
  on public.customers (subscription_status);

create index if not exists customers_last_seen_at_idx
  on public.customers (last_seen_at desc);

create index if not exists customers_active_subscription_id_idx
  on public.customers (active_subscription_id)
  where active_subscription_id is not null;

create index if not exists customers_created_at_idx
  on public.customers (created_at desc);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create index if not exists products_active_idx
  on public.products (active);

create index if not exists products_name_idx
  on public.products (name);

create index if not exists products_created_at_idx
  on public.products (created_at desc);

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create index if not exists subscriptions_customer_id_idx
  on public.subscriptions (customer_id);

create index if not exists subscriptions_product_id_idx
  on public.subscriptions (product_id);

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

create index if not exists subscriptions_billing_frequency_idx
  on public.subscriptions (billing_frequency);

create index if not exists subscriptions_started_at_idx
  on public.subscriptions (started_at desc);

create index if not exists subscriptions_next_payment_date_idx
  on public.subscriptions (next_payment_date);

create index if not exists subscriptions_created_at_idx
  on public.subscriptions (created_at desc);

-- ---------------------------------------------------------------------------
-- subscription_events
-- ---------------------------------------------------------------------------
create index if not exists subscription_events_customer_id_idx
  on public.subscription_events (customer_id);

create index if not exists subscription_events_subscription_id_idx
  on public.subscription_events (subscription_id);

create index if not exists subscription_events_event_type_idx
  on public.subscription_events (event_type);

create index if not exists subscription_events_event_created_at_idx
  on public.subscription_events (event_created_at desc);

create index if not exists subscription_events_created_at_idx
  on public.subscription_events (created_at desc);

-- vott_event_id already has a UNIQUE constraint index

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create index if not exists payments_customer_id_idx
  on public.payments (customer_id);

create index if not exists payments_subscription_id_idx
  on public.payments (subscription_id);

create index if not exists payments_product_id_idx
  on public.payments (product_id);

create index if not exists payments_status_idx
  on public.payments (status);

create index if not exists payments_payment_date_idx
  on public.payments (payment_date desc);

create index if not exists payments_payment_provider_idx
  on public.payments (payment_provider);

create index if not exists payments_created_at_idx
  on public.payments (created_at desc);

notify pgrst, 'reload schema';
