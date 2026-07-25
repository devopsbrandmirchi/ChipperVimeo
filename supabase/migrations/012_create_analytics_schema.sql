-- Phase 9: analytics reporting schema (additive).
-- Operational data stays in public.*; never use public.vott_events for reporting.

create schema if not exists analytics;

comment on schema analytics is
  'Reporting layer: materialized views, refresh functions, and query RPCs. Single source of truth for dashboards, exports, and BI.';

grant usage on schema analytics to postgres, anon, authenticated, service_role;
