-- Imported Google Calendar events (read-only busy blocks in Hubly).
-- Unique on (business_id, google_event_id) prevents duplicates across syncs.

create table if not exists public.google_calendar_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  google_event_id text not null,
  calendar_id text not null default 'primary',
  summary text,
  description text,
  location text,
  html_link text,
  status text,
  all_day boolean not null default false,
  start_at timestamptz,
  end_at timestamptz,
  local_date date not null,
  local_start_time time,
  duration_hours numeric(6,2),
  google_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint google_calendar_events_business_event_unique unique (business_id, google_event_id)
);

create index if not exists google_calendar_events_business_date_idx
  on public.google_calendar_events (business_id, local_date);

create index if not exists google_calendar_events_business_start_idx
  on public.google_calendar_events (business_id, start_at);

comment on table public.google_calendar_events is
  'Google Calendar events imported into Hubly as blocked time. Hubly jobs are not pushed to Google.';

alter table public.google_calendar_events enable row level security;

-- Owners can read imported events; writes are service-role only (edge sync).
drop policy if exists "Owners can read their google calendar events" on public.google_calendar_events;
create policy "Owners can read their google calendar events"
  on public.google_calendar_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = google_calendar_events.business_id
        and b.owner_id = auth.uid()
    )
  );
