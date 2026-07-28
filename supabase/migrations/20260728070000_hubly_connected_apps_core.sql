-- Hubly Core — Connected Apps (business-level OAuth / connection state)
-- Product: Connected Apps. Projects attach providers via photography_project_workspaces
-- (and future generic project connection tables). Reusable across all industries.

create table if not exists public.hubly_app_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected'
    check (status in (
      'disconnected', 'pending', 'connected', 'error', 'revoked'
    )),
  account_label text,
  scopes text[] not null default '{}',
  last_sync_at timestamptz,
  health text not null default 'disconnected'
    check (health in (
      'healthy', 'degraded', 'not_configured', 'disconnected', 'error'
    )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, provider)
);

comment on table public.hubly_app_connections is
  'Hubly Core Connected Apps — business-level provider connections (Canva, Adobe, Dropbox, Meta, …). Projects link via project workspace tables.';

comment on column public.hubly_app_connections.provider is
  'Connected App id matching ConnectedAppProvider.id (adobe_lightroom, canva, dropbox, …).';

create index if not exists hubly_app_connections_business_idx
  on public.hubly_app_connections (business_id);

create or replace function public.touch_hubly_app_connections_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_hubly_app_connections_updated_at on public.hubly_app_connections;
create trigger trg_touch_hubly_app_connections_updated_at
  before update on public.hubly_app_connections
  for each row execute function public.touch_hubly_app_connections_updated_at();

alter table public.hubly_app_connections enable row level security;

drop policy if exists hubly_app_connections_select_owner on public.hubly_app_connections;
create policy hubly_app_connections_select_owner
  on public.hubly_app_connections for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists hubly_app_connections_insert_owner on public.hubly_app_connections;
create policy hubly_app_connections_insert_owner
  on public.hubly_app_connections for insert
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists hubly_app_connections_update_owner on public.hubly_app_connections;
create policy hubly_app_connections_update_owner
  on public.hubly_app_connections for update
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists hubly_app_connections_delete_owner on public.hubly_app_connections;
create policy hubly_app_connections_delete_owner
  on public.hubly_app_connections for delete
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

-- Expand project workspace provider check to include Canva / Meta / Google Business.
-- Recreate check by dropping and adding a broader constraint if present.
do $$
begin
  alter table public.photography_project_workspaces
    drop constraint if exists photography_project_workspaces_provider_check;
exception when undefined_object then
  null;
end $$;

alter table public.photography_project_workspaces
  drop constraint if exists photography_project_workspaces_provider_check;

alter table public.photography_project_workspaces
  add constraint photography_project_workspaces_provider_check
  check (provider in (
    'adobe_lightroom',
    'capture_one',
    'dropbox',
    'google_drive',
    'canva',
    'frame_io',
    'meta',
    'google_business',
    'stripe',
    'twilio',
    'other'
  ));

comment on table public.photography_project_workspaces is
  'Project-scoped Connected Apps links (internal workspace rows). Product UI: Connected Apps. Hubly Core engine is industry-agnostic; photography is the first project surface.';
