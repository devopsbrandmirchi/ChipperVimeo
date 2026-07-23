-- Vimeo OTT webhook event store (Phase 1 ingest + Phase 2 admin browse/filter)

create extension if not exists "pgcrypto";

create table if not exists public.vott_events (
  id uuid primary key default gen_random_uuid(),
  topic text,
  event_created_at timestamptz,
  customer_id bigint,
  customer_email text,
  customer_name text,
  product_id bigint,
  product_name text,
  subscription_status text,
  platform text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

comment on table public.vott_events is
  'Normalized Vimeo OTT webhook deliveries; payload keeps the raw JSON.';

create index if not exists vott_events_received_at_idx
  on public.vott_events (received_at desc);

create index if not exists vott_events_topic_idx
  on public.vott_events (topic);

create index if not exists vott_events_customer_id_idx
  on public.vott_events (customer_id);

create index if not exists vott_events_customer_email_idx
  on public.vott_events (customer_email);

create index if not exists vott_events_event_created_at_idx
  on public.vott_events (event_created_at desc);

create index if not exists vott_events_product_id_idx
  on public.vott_events (product_id);

alter table public.vott_events enable row level security;

-- Service role bypasses RLS (used by webhook route).
-- No policies for anon/authenticated → client keys cannot read/write.
-- Phase 2: add SELECT policies for authenticated admins if needed.
