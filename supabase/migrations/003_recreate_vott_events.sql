-- Recreate vott_events to match the app insert shape.
-- Safe during Phase 1 Send-test; drops existing rows.

drop table if exists public.vott_events cascade;

create extension if not exists "pgcrypto";

create table public.vott_events (
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
  received_at timestamptz not null default now(),
  received_date date generated always as ((received_at at time zone 'utc')::date) stored
);

comment on table public.vott_events is
  'Normalized Vimeo OTT webhook deliveries; payload keeps the raw JSON.';

create index vott_events_received_at_idx
  on public.vott_events (received_at desc);

create index vott_events_received_date_idx
  on public.vott_events (received_date desc);

create index vott_events_topic_idx
  on public.vott_events (topic);

create index vott_events_customer_id_idx
  on public.vott_events (customer_id);

create index vott_events_customer_email_idx
  on public.vott_events (customer_email);

create index vott_events_event_created_at_idx
  on public.vott_events (event_created_at desc);

create index vott_events_product_id_idx
  on public.vott_events (product_id);

alter table public.vott_events enable row level security;

notify pgrst, 'reload schema';
