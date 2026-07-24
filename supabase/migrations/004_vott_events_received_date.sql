-- Add calendar date column for efficient day-range queries.
-- Derived from received_at (UTC) so inserts stay unchanged.

alter table public.vott_events
  add column if not exists received_date date
  generated always as ((received_at at time zone 'utc')::date) stored;

create index if not exists vott_events_received_date_idx
  on public.vott_events (received_date desc);

notify pgrst, 'reload schema';
