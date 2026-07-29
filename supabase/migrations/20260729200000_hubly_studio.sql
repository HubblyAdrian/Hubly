-- Hubly Studio — creative OS (replaces Operate Marketing tab SSOT for designs/publish).
-- Business-scoped. Reads Jobs/Reviews/Brand via client context — does not duplicate Memory/DNA.

-- ─── Settings ───────────────────────────────────────────────────────────────

create table if not exists public.studio_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  enabled boolean not null default true,
  storage_used_bytes bigint not null default 0,
  storage_quota_bytes bigint not null default 10737418240, -- 10 GB
  canva_linked boolean not null default false,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.studio_settings is
  'Per-business Hubly Studio settings. Canva link is informational until Connected Apps OAuth is live.';

-- ─── Brand kit ────────────────────────────────────────────────────────────

create table if not exists public.studio_brand_kit (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  logos jsonb not null default '[]'::jsonb,
  colors jsonb not null default '[]'::jsonb,
  typography jsonb not null default '{}'::jsonb,
  voice_tones jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.studio_brand_kit is
  'Studio Brand Kit — logos, palette, fonts, copywriting tones. Interpretive voice may mirror DNA but stays Studio-owned for creative output.';

-- ─── Projects & pages ─────────────────────────────────────────────────────

create table if not exists public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft','ready','scheduled','published','archived')),
  format_primary text not null default 'instagram_post',
  thumbnail_url text,
  prompt text not null default '',
  platform text not null default 'instagram',
  style text not null default 'bold',
  tone text not null default 'expert',
  source jsonb not null default '{}'::jsonb, -- job ids, review refs, etc.
  canvas jsonb not null default '{}'::jsonb, -- Stage 1 editor document
  metadata jsonb not null default '{}'::jsonb,
  last_edited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_projects_business_idx
  on public.studio_projects (business_id, last_edited_at desc);
create index if not exists studio_projects_status_idx
  on public.studio_projects (business_id, status);

create table if not exists public.studio_project_pages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  format text not null
    check (format in (
      'instagram_post','facebook_feed','instagram_story','print_flyer',
      'google_business','email_header','facebook_post'
    )),
  label text not null default '',
  width int not null default 1080,
  height int not null default 1080,
  canvas jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, format)
);

create index if not exists studio_project_pages_project_idx
  on public.studio_project_pages (project_id, sort_order);

-- ─── Assets ───────────────────────────────────────────────────────────────

create table if not exists public.studio_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null default '',
  kind text not null default 'image'
    check (kind in ('image','graphic','upload','job_photo','logo')),
  url text not null,
  thumb_url text,
  bytes bigint not null default 0,
  width int,
  height int,
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists studio_assets_business_idx
  on public.studio_assets (business_id, created_at desc);

-- ─── Templates (catalog — platform or business-scoped) ────────────────────

create table if not exists public.studio_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade, -- null = global catalog
  title text not null,
  category text not null default 'social',
  format text not null default 'instagram_post',
  industry text not null default 'home_services',
  thumbnail_url text,
  preview jsonb not null default '{}'::jsonb,
  featured boolean not null default false,
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists studio_templates_cat_idx
  on public.studio_templates (category, featured desc, sort_order);

-- ─── Publish queue ────────────────────────────────────────────────────────

create table if not exists public.studio_publish_queue (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  project_id uuid references public.studio_projects(id) on delete set null,
  title text not null,
  caption text not null default '',
  channels text[] not null default '{}',
  scheduled_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft','ready','scheduled','publishing','published','failed')),
  thumbnail_url text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_publish_queue_business_idx
  on public.studio_publish_queue (business_id, scheduled_at nulls last);

-- ─── Social accounts (honest connection status) ───────────────────────────

create table if not exists public.studio_social_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null
    check (provider in ('instagram','facebook','google_business')),
  handle text not null default '',
  display_name text not null default '',
  status text not null default 'not_connected'
    check (status in ('not_connected','connected','sync_active','error')),
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (business_id, provider)
);

-- ─── Analytics snapshots (Stage 1 cache — no fabricated live metrics) ─────

create table if not exists public.studio_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  period_days int not null default 30,
  metrics jsonb not null default '{}'::jsonb,
  insights jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists studio_analytics_business_idx
  on public.studio_analytics_snapshots (business_id, captured_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────

alter table public.studio_settings enable row level security;
alter table public.studio_brand_kit enable row level security;
alter table public.studio_projects enable row level security;
alter table public.studio_project_pages enable row level security;
alter table public.studio_assets enable row level security;
alter table public.studio_templates enable row level security;
alter table public.studio_publish_queue enable row level security;
alter table public.studio_social_accounts enable row level security;
alter table public.studio_analytics_snapshots enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'studio_settings',
    'studio_brand_kit',
    'studio_projects',
    'studio_project_pages',
    'studio_assets',
    'studio_publish_queue',
    'studio_social_accounts',
    'studio_analytics_snapshots'
  ]
  loop
    execute format('drop policy if exists %I_owner_all on public.%I', t, t);
    execute format($f$
      create policy %I_owner_all on public.%I
        for all using (
          business_id in (select id from public.businesses where owner_id = auth.uid())
        )
        with check (
          business_id in (select id from public.businesses where owner_id = auth.uid())
        )
    $f$, t, t);
  end loop;
end $$;

drop policy if exists studio_templates_owner_all on public.studio_templates;
create policy studio_templates_owner_all on public.studio_templates
  for all using (
    business_id is null
    or business_id in (select id from public.businesses where owner_id = auth.uid())
  )
  with check (
    business_id is null
    or business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists studio_templates_public_read on public.studio_templates;
create policy studio_templates_public_read on public.studio_templates
  for select using (published = true and business_id is null);
