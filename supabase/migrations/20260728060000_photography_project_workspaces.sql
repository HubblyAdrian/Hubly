-- External Workspaces — provider-agnostic links attached to a Photography Project.
-- The Project is always Hubly’s primary record. Adobe Lightroom, Capture One,
-- Dropbox, Google Drive, Canva, etc. are synchronized workspaces — never the source of truth.
-- A project may link one or more external workspaces at the same time.

create table if not exists public.photography_project_workspaces (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.photography_projects(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null
    check (provider in (
      'adobe_lightroom',
      'capture_one',
      'dropbox',
      'google_drive',
      'canva',
      'frame_io',
      'other'
    )),
  external_id text,
  display_name text,
  sync_state text not null default 'unlinked'
    check (sync_state in (
      'unlinked', 'pending', 'linked', 'syncing', 'synced', 'error'
    )),
  last_sync_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.photography_project_workspaces is
  'External Workspace links for a Photography Project. Provider-agnostic (Lightroom, Dropbox, Drive, …). Project remains Hubly primary; workspaces sync to it.';

comment on column public.photography_project_workspaces.provider is
  'External system id, e.g. adobe_lightroom | capture_one | dropbox | google_drive | canva.';

comment on column public.photography_project_workspaces.external_id is
  'Provider-side album/catalog/folder/file id. Opaque to Hubly Project core.';

comment on column public.photography_project_workspaces.sync_state is
  'unlinked | pending | linked | syncing | synced | error';

comment on column public.photography_project_workspaces.metadata is
  'Provider-specific payload (album name, account email, queues, favorites count, etc.).';

create index if not exists photography_project_workspaces_project_idx
  on public.photography_project_workspaces (project_id);

create index if not exists photography_project_workspaces_provider_idx
  on public.photography_project_workspaces (business_id, provider);

-- One primary workspace row per provider per project (additional folders live in metadata or future child rows).
create unique index if not exists photography_project_workspaces_project_provider_uidx
  on public.photography_project_workspaces (project_id, provider);

create or replace function public.touch_photography_project_workspaces_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_photography_project_workspaces_updated_at
  on public.photography_project_workspaces;
create trigger trg_touch_photography_project_workspaces_updated_at
  before update on public.photography_project_workspaces
  for each row execute function public.touch_photography_project_workspaces_updated_at();

alter table public.photography_project_workspaces enable row level security;

drop policy if exists photography_project_workspaces_select_owner
  on public.photography_project_workspaces;
create policy photography_project_workspaces_select_owner
  on public.photography_project_workspaces for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists photography_project_workspaces_insert_owner
  on public.photography_project_workspaces;
create policy photography_project_workspaces_insert_owner
  on public.photography_project_workspaces for insert
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists photography_project_workspaces_update_owner
  on public.photography_project_workspaces;
create policy photography_project_workspaces_update_owner
  on public.photography_project_workspaces for update
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists photography_project_workspaces_delete_owner
  on public.photography_project_workspaces;
create policy photography_project_workspaces_delete_owner
  on public.photography_project_workspaces for delete
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

-- Backfill Lightroom rows into generic External Workspaces when present.
insert into public.photography_project_workspaces (
  project_id, business_id, provider, external_id, display_name,
  sync_state, last_sync_at, metadata
)
select
  lr.project_id,
  lr.business_id,
  'adobe_lightroom',
  coalesce(nullif(lr.album_id, ''), nullif(lr.catalog_id, ''), nullif(lr.twin_key, '')),
  coalesce(lr.album_name, 'Lightroom'),
  case
    when lr.twin_status in ('unlinked','pending','linked','syncing','synced','error') then lr.twin_status
    when lr.connection_status in ('connected','synced','album_ready') then 'linked'
    else 'unlinked'
  end,
  lr.last_sync_at,
  jsonb_build_object(
    'adobe_account_email', lr.adobe_account_email,
    'album_name', lr.album_name,
    'album_id', lr.album_id,
    'catalog_id', lr.catalog_id,
    'photo_count', lr.photo_count,
    'edited_count', lr.edited_count,
    'favorites_count', lr.favorites_count,
    'connection_status', lr.connection_status,
    'upload_queue', coalesce(lr.upload_queue, '[]'::jsonb),
    'import_queue', coalesce(lr.import_queue, '[]'::jsonb),
    'export_queue', coalesce(lr.export_queue, '[]'::jsonb),
    'sync_activity', coalesce(lr.sync_activity, '[]'::jsonb),
    'legacy_twin_key', lr.twin_key,
    'source', 'photography_project_lightroom'
  )
from public.photography_project_lightroom lr
on conflict (project_id, provider) do update set
  external_id = coalesce(excluded.external_id, photography_project_workspaces.external_id),
  display_name = coalesce(excluded.display_name, photography_project_workspaces.display_name),
  sync_state = excluded.sync_state,
  last_sync_at = coalesce(excluded.last_sync_at, photography_project_workspaces.last_sync_at),
  metadata = photography_project_workspaces.metadata || excluded.metadata,
  updated_at = now();

-- Also seed pending Lightroom workspaces from project-level legacy twin columns.
insert into public.photography_project_workspaces (
  project_id, business_id, provider, external_id, display_name, sync_state, metadata
)
select
  p.id,
  p.business_id,
  'adobe_lightroom',
  coalesce(nullif(p.lightroom_album_id, ''), nullif(p.lightroom_catalog_id, ''), nullif(p.twin_key, '')),
  p.name,
  case
    when p.twin_status in ('unlinked','pending','linked','syncing','synced','error') then p.twin_status
    else 'pending'
  end,
  jsonb_build_object(
    'legacy_twin_key', p.twin_key,
    'lightroom_catalog_id', p.lightroom_catalog_id,
    'lightroom_album_id', p.lightroom_album_id,
    'source', 'photography_projects'
  )
from public.photography_projects p
where p.twin_key is not null
   or p.lightroom_album_id is not null
   or p.lightroom_catalog_id is not null
   or coalesce(p.lightroom_status, 'not_connected') <> 'not_connected'
on conflict (project_id, provider) do nothing;

comment on column public.photography_projects.twin_key is
  'DEPRECATED — prefer photography_project_workspaces. Kept for back-compat during External Workspace cutover.';
comment on column public.photography_projects.twin_status is
  'DEPRECATED — prefer photography_project_workspaces.sync_state.';
comment on table public.photography_project_lightroom is
  'DEPRECATED Lightroom-specific link. Use photography_project_workspaces with provider=adobe_lightroom. Kept for back-compat.';
