-- Photography Projects: Supabase is SSOT. localStorage may only cache UI prefs.
-- Digital twin: Hubly project ↔ Lightroom catalog/album share twin_key.
-- Capabilities: businesses.capabilities.projects | lightroom gate the module.

alter table public.photography_projects
  add column if not exists workspace jsonb not null default '{}'::jsonb;

comment on column public.photography_projects.workspace is
  'Nested project OS state (timeline, gallery, team, marketing, activity, shot list, questionnaire). Core columns stay queryable; related tables mirror for future server workflows.';

alter table public.photography_projects
  add column if not exists twin_key text;

alter table public.photography_projects
  add column if not exists lightroom_catalog_id text;

alter table public.photography_projects
  add column if not exists lightroom_album_id text;

alter table public.photography_projects
  add column if not exists twin_status text not null default 'unlinked'
    check (twin_status in ('unlinked', 'pending', 'linked', 'syncing', 'synced', 'error'));

create unique index if not exists photography_projects_twin_key_uidx
  on public.photography_projects (business_id, twin_key)
  where twin_key is not null;

alter table public.photography_project_lightroom
  add column if not exists twin_key text;

alter table public.photography_project_lightroom
  add column if not exists catalog_id text;

alter table public.photography_project_lightroom
  add column if not exists twin_status text not null default 'unlinked'
    check (twin_status in ('unlinked', 'pending', 'linked', 'syncing', 'synced', 'error'));

comment on column public.photography_projects.twin_key is
  'Stable digital-twin id shared with Lightroom album/catalog. Same project in Hubly and Adobe.';

comment on column public.photography_project_lightroom.twin_key is
  'Mirrors photography_projects.twin_key — Hubly always knows they are the same project.';

-- Enable Projects capability for photo-led verticals (Photography, Wedding, etc.)
update public.businesses
set capabilities = coalesce(capabilities, '{}'::jsonb) ||
  jsonb_build_object('projects', true, 'lightroom', true)
where
  lower(coalesce(business_type, '')) in ('photography', 'weddings', 'wedding', 'videography', 'drone')
  or lower(coalesce(business_type, '')) like '%photo%'
  or lower(coalesce(business_type, '')) like '%wedding%'
  or lower(coalesce(business_type, '')) like '%real%estate%photo%';

comment on column public.businesses.capabilities is
  'Product capabilities for this Business, e.g. {"marketplace":true,"hubly_pro":true,"projects":true,"lightroom":true}. Photography Projects nav requires capabilities.projects.';
