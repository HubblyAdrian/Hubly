-- Profile picture + friendly calendar name for Settings → Calendar Connections UI.

alter table public.google_calendar_connections
  add column if not exists google_picture_url text,
  add column if not exists calendar_summary text;

comment on column public.google_calendar_connections.google_picture_url is
  'Google account avatar URL from OpenID userinfo (safe to expose to client).';
comment on column public.google_calendar_connections.calendar_summary is
  'Display name of the connected calendar (e.g. Primary).';
