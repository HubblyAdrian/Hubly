-- Per-business Google Calendar OAuth connection (auth only — no event sync yet).
-- Tokens are service-role only; the client reads status via edge functions.

create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  google_user_id text not null,
  google_email text,
  calendar_id text not null default 'primary',
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint google_calendar_connections_business_unique unique (business_id)
);

create index if not exists google_calendar_connections_owner_idx
  on public.google_calendar_connections (owner_id);

comment on table public.google_calendar_connections is
  'Owner Google Calendar OAuth tokens. Never expose refresh/access tokens to the browser.';

-- Short-lived CSRF states for the OAuth redirect round-trip.
create table if not exists public.google_calendar_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  return_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists google_calendar_oauth_states_expires_idx
  on public.google_calendar_oauth_states (expires_at);

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_oauth_states enable row level security;

-- RLS on, zero policies for anon/authenticated.
-- Browsers never read refresh/access tokens; status/connect/disconnect go through edge functions
-- that use the service role. Service role bypasses RLS.
