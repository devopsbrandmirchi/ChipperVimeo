-- Phase 2: subscription_events — append-only lifecycle log.
-- Links each business event back to the immutable vott_events row.
-- Intentionally has created_at only (no updated_at) — immutable audit rows.

create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid not null,
  subscription_id uuid not null,
  vott_event_id uuid not null,

  event_type text not null,
  previous_status text,
  new_status text,

  event_created_at timestamptz,

  payload jsonb,

  created_at timestamptz not null default now(),

  constraint subscription_events_customer_id_fkey
    foreign key (customer_id) references public.customers (id)
    on delete restrict,

  constraint subscription_events_subscription_id_fkey
    foreign key (subscription_id) references public.subscriptions (id)
    on delete restrict,

  constraint subscription_events_vott_event_id_fkey
    foreign key (vott_event_id) references public.vott_events (id)
    on delete restrict,

  -- One webhook delivery → at most one subscription_event (processor idempotency)
  constraint subscription_events_vott_event_id_key unique (vott_event_id)
);

comment on table public.subscription_events is
  'Append-only subscription lifecycle events (created, trial, renewed, cancelled, charge_failed, etc.). Links to vott_events for full payload.';

comment on column public.subscription_events.event_type is
  'Derived lifecycle type: created, trial_started, trial_converted, renewed, cancelled, expired, charge_failed, resumed, paused, etc.';

comment on column public.subscription_events.payload is
  'Event-specific excerpt. Full raw webhook remains in vott_events.payload.';

comment on column public.subscription_events.vott_event_id is
  'FK to immutable event store. UNIQUE so reprocessing the same webhook is idempotent.';

alter table public.subscription_events enable row level security;

notify pgrst, 'reload schema';
