-- Photography Projects — first-class module independent of Jobs.
-- Photographers think in projects (booking → delivery), not jobs.
-- Adobe Lightroom enhances the workflow; it is never required.

-- ─── Core project ───────────────────────────────────────────────────────────

create table if not exists public.photography_projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  project_type text not null default 'Other'
    check (project_type in (
      'Wedding','Portrait','Family','Sports','Commercial','Product',
      'Real Estate','Graduation','Event','Other'
    )),
  status text not null default 'Lead'
    check (status in (
      'Lead','Booked','Scheduled','Shooting','Editing','Proofing','Delivered','Archived'
    )),
  shoot_date date,
  location text,
  estimated_photos int,
  photo_count int not null default 0,
  notes text,
  cover_photo_url text,
  client_id uuid,
  client_name text,
  client_email text,
  client_phone text,
  client_address text,
  client_relationship text,
  revenue_cents int not null default 0,
  outstanding_cents int not null default 0,
  editing_progress int not null default 0 check (editing_progress >= 0 and editing_progress <= 100),
  lightroom_status text not null default 'not_connected'
    check (lightroom_status in (
      'not_connected','connected','album_ready','syncing','synced','error'
    )),
  gallery_status text not null default 'draft'
    check (gallery_status in (
      'draft','private','published','delivered','expired'
    )),
  invoice_status text not null default 'none'
    check (invoice_status in (
      'none','draft','sent','partial','paid','overdue'
    )),
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.photography_projects is
  'Photography Projects OS — independent of jobs. Lightroom is optional enhancement.';

create index if not exists photography_projects_business_id_idx
  on public.photography_projects (business_id);
create index if not exists photography_projects_status_idx
  on public.photography_projects (business_id, status);
create index if not exists photography_projects_shoot_date_idx
  on public.photography_projects (business_id, shoot_date);

create or replace function public.touch_photography_projects_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_photography_projects_updated_at on public.photography_projects;
create trigger trg_touch_photography_projects_updated_at
  before update on public.photography_projects
  for each row execute function public.touch_photography_projects_updated_at();

-- ─── Timeline ───────────────────────────────────────────────────────────────

create table if not exists public.photography_project_timeline (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.photography_projects(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_key text not null,
  label text not null,
  occurred_at timestamptz,
  completed boolean not null default false,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photography_project_timeline_project_idx
  on public.photography_project_timeline (project_id, sort_order);

-- ─── Deliverables ───────────────────────────────────────────────────────────

create table if not exists public.photography_project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.photography_projects(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  kind text not null default 'gallery'
    check (kind in ('gallery','print','album','usb','cloud','other')),
  status text not null default 'pending'
    check (status in ('pending','in_progress','ready','delivered')),
  due_at timestamptz,
  delivered_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photography_project_deliverables_project_idx
  on public.photography_project_deliverables (project_id);

-- ─── Gallery ────────────────────────────────────────────────────────────────

create table if not exists public.photography_project_galleries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.photography_projects(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null default 'Client Gallery',
  visibility text not null default 'private'
    check (visibility in ('private','client','public')),
  delivery_status text not null default 'draft'
    check (delivery_status in ('draft','ready','published','delivered','expired')),
  share_url text,
  watermark_enabled boolean not null default true,
  watermark_text text,
  expires_at timestamptz,
  download_enabled boolean not null default false,
  ai_favorites jsonb not null default '[]'::jsonb,
  albums jsonb not null default '[]'::jsonb,
  photo_count int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photography_project_galleries_project_idx
  on public.photography_project_galleries (project_id);

-- ─── Contracts ──────────────────────────────────────────────────────────────

create table if not exists public.photography_project_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.photography_projects(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null default 'Photography Agreement',
  status text not null default 'draft'
    check (status in ('draft','sent','viewed','signed','void')),
  sent_at timestamptz,
  signed_at timestamptz,
  document_url text,
  signer_name text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photography_project_contracts_project_idx
  on public.photography_project_contracts (project_id);

-- ─── Invoices ───────────────────────────────────────────────────────────────

create table if not exists public.photography_project_invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.photography_projects(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  label text not null default 'Invoice',
  kind text not null default 'balance'
    check (kind in ('deposit','balance','retainer','addon','other')),
  status text not null default 'draft'
    check (status in ('draft','sent','partial','paid','overdue','void')),
  amount_cents int not null default 0,
  paid_cents int not null default 0,
  due_at timestamptz,
  paid_at timestamptz,
  stripe_invoice_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photography_project_invoices_project_idx
  on public.photography_project_invoices (project_id);

-- ─── Questionnaire ──────────────────────────────────────────────────────────

create table if not exists public.photography_project_questionnaires (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.photography_projects(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null default 'Client Questionnaire',
  status text not null default 'draft'
    check (status in ('draft','sent','in_progress','completed')),
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photography_project_questionnaires_project_idx
  on public.photography_project_questionnaires (project_id);

-- ─── Team ───────────────────────────────────────────────────────────────────

create table if not exists public.photography_project_team (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.photography_projects(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role text not null
    check (role in ('lead_photographer','second_shooter','assistant','editor','other')),
  member_name text not null,
  member_email text,
  member_user_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photography_project_team_project_idx
  on public.photography_project_team (project_id);

-- ─── Lightroom link (optional — never required) ─────────────────────────────

create table if not exists public.photography_project_lightroom (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.photography_projects(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  adobe_account_email text,
  album_name text,
  album_id text,
  photo_count int not null default 0,
  edited_count int not null default 0,
  favorites_count int not null default 0,
  connection_status text not null default 'not_connected'
    check (connection_status in (
      'not_connected','connected','syncing','synced','error'
    )),
  last_sync_at timestamptz,
  upload_queue jsonb not null default '[]'::jsonb,
  import_queue jsonb not null default '[]'::jsonb,
  export_queue jsonb not null default '[]'::jsonb,
  sync_activity jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

comment on table public.photography_project_lightroom is
  'Optional Adobe Lightroom link per project. Projects work fully without this row.';

-- ─── Marketing placeholders ─────────────────────────────────────────────────

create table if not exists public.photography_project_marketing (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.photography_projects(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel text not null
    check (channel in (
      'instagram','facebook','pinterest','blog','website',
      'email','review_request','referral','before_after'
    )),
  status text not null default 'idle'
    check (status in ('idle','ready','queued','published','skipped')),
  title text,
  body text,
  asset_urls jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photography_project_marketing_project_idx
  on public.photography_project_marketing (project_id);

-- ─── Activity log ───────────────────────────────────────────────────────────

create table if not exists public.photography_project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.photography_projects(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_name text,
  action text not null,
  detail text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists photography_project_activity_project_idx
  on public.photography_project_activity (project_id, created_at desc);

-- ─── RLS — owner via businesses.owner_id ────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'photography_projects',
    'photography_project_timeline',
    'photography_project_deliverables',
    'photography_project_galleries',
    'photography_project_contracts',
    'photography_project_invoices',
    'photography_project_questionnaires',
    'photography_project_team',
    'photography_project_lightroom',
    'photography_project_marketing',
    'photography_project_activity'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'drop policy if exists %I on public.%I',
      t || '_select_owner', t
    );
    execute format(
      'create policy %I on public.%I for select using (
        business_id in (select id from public.businesses where owner_id = auth.uid())
      )',
      t || '_select_owner', t
    );

    execute format(
      'drop policy if exists %I on public.%I',
      t || '_insert_owner', t
    );
    execute format(
      'create policy %I on public.%I for insert with check (
        business_id in (select id from public.businesses where owner_id = auth.uid())
      )',
      t || '_insert_owner', t
    );

    execute format(
      'drop policy if exists %I on public.%I',
      t || '_update_owner', t
    );
    execute format(
      'create policy %I on public.%I for update using (
        business_id in (select id from public.businesses where owner_id = auth.uid())
      )',
      t || '_update_owner', t
    );

    execute format(
      'drop policy if exists %I on public.%I',
      t || '_delete_owner', t
    );
    execute format(
      'create policy %I on public.%I for delete using (
        business_id in (select id from public.businesses where owner_id = auth.uid())
      )',
      t || '_delete_owner', t
    );
  end loop;
end $$;
