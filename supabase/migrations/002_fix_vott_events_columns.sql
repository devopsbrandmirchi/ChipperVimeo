-- Fix: ensure vott_events has the full Phase 1 column set.
-- Safe to re-run. Needed when the table was created earlier with a thinner schema.

create extension if not exists "pgcrypto";

create table if not exists public.vott_events (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

alter table public.vott_events
  add column if not exists topic text,
  add column if not exists event_created_at timestamptz,
  add column if not exists customer_id bigint,
  add column if not exists customer_email text,
  add column if not exists customer_name text,
  add column if not exists product_id bigint,
  add column if not exists product_name text,
  add column if not exists subscription_status text,
  add column if not exists platform text,
  add column if not exists payload jsonb,
  add column if not exists received_at timestamptz;

-- Ensure non-null defaults for required columns if they were added nullable
update public.vott_events
set payload = '{}'::jsonb
where payload is null;

alter table public.vott_events
  alter column payload set default '{}'::jsonb;

alter table public.vott_events
  alter column payload set not null;

alter table public.vott_events
  alter column received_at set default now();

update public.vott_events
set received_at = now()
where received_at is null;

alter table public.vott_events
  alter column received_at set not null;

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

notify pgrst, 'reload schema';
