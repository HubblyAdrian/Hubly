-- Google → Hubly inbound sync metadata (webhooks + polling).
-- jobs.google_etag / hubly_push_at prevent Hubly↔Google sync loops.

alter table public.google_calendar_connections
  add column if not exists sync_token text,
  add column if not exists watch_channel_id text,
  add column if not exists watch_resource_id text,
  add column if not exists watch_expiration timestamptz,
  add column if not exists last_inbound_at timestamptz;

comment on column public.google_calendar_connections.sync_token is
  'Google Calendar events.list nextSyncToken for incremental inbound sync.';
comment on column public.google_calendar_connections.watch_channel_id is
  'Active Google push-notification channel id (events.watch).';

alter table public.jobs
  add column if not exists google_etag text,
  add column if not exists hubly_push_at timestamptz;

comment on column public.jobs.google_etag is
  'Last known Google Calendar event etag — skip inbound apply when unchanged.';
comment on column public.jobs.hubly_push_at is
  'When Hubly last wrote this event to Google — short window skips inbound to prevent loops.';
