-- Store Google Calendar event id on Hubly jobs (Hubly → Google push).
alter table public.jobs
  add column if not exists google_event_id text;

create unique index if not exists jobs_business_google_event_id_uidx
  on public.jobs (business_id, google_event_id)
  where google_event_id is not null;

comment on column public.jobs.google_event_id is
  'Google Calendar event id created for this Hubly job. Prevents duplicate pushes.';
