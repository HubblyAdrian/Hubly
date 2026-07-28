-- Adobe Lightroom OAuth — service-role token storage (never expose tokens to the browser).
-- Mirrors google_calendar_connections. Public status via hubly_app_connections + Edge Functions.

create table if not exists public.adobe_lightroom_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  adobe_user_id text not null,
  adobe_email text,
  adobe_display_name text,
  refresh_token text,
  access_token text,
  access_token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  constraint adobe_lightroom_connections_business_unique unique (business_id)
);

create index if not exists adobe_lightroom_connections_owner_idx
  on public.adobe_lightroom_connections (owner_id);

comment on table public.adobe_lightroom_connections is
  'Owner Adobe Lightroom OAuth tokens (IMS). Never expose refresh/access tokens to the browser.';

create table if not exists public.adobe_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  return_to text,
  project_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists adobe_oauth_states_expires_idx
  on public.adobe_oauth_states (expires_at);

alter table public.adobe_lightroom_connections enable row level security;
alter table public.adobe_oauth_states enable row level security;

-- RLS on, zero policies for anon/authenticated.
-- Tokens are service-role only; connect/status/disconnect go through Edge Functions.
