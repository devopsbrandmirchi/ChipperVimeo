-- Phase 11: Auth audit log for admin user / role actions.
-- Written only via service role from AdminUserService.

create table if not exists public.auth_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  target_user_id uuid,
  target_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists auth_audit_events_created_at_idx
  on public.auth_audit_events (created_at desc);

create index if not exists auth_audit_events_actor_id_idx
  on public.auth_audit_events (actor_id);

comment on table public.auth_audit_events is
  'Phase 11 admin auth audit: invite, create, role_change. Service-role writes only.';

alter table public.auth_audit_events enable row level security;

-- No policies for anon/authenticated — API uses service role.
grant select, insert on public.auth_audit_events to service_role;
