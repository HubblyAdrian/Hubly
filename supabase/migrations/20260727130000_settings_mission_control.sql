-- Settings Mission Control — Stage 2 schema (config only, Rule #23)
-- Live apply requires authenticated Supabase access. Stage 1 runtime uses S.settingsOs.

create table if not exists public.settings_business (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text,
  address text,
  city text,
  region text,
  postal text,
  country text default 'US',
  time_zone text,
  currency text default 'USD',
  tax_default numeric(8,4) default 0,
  logo_url text,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id)
);

create table if not exists public.settings_team_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  email text,
  role text not null default 'Employee',
  status text not null default 'active',
  invited_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.settings_roles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  modules text not null default 'operate',
  created_at timestamptz not null default now()
);

create table if not exists public.settings_permissions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  role_id uuid references public.settings_roles (id) on delete cascade,
  module_key text not null,
  can_view boolean default true,
  can_create boolean default false,
  can_edit boolean default false,
  can_delete boolean default false,
  can_export boolean default false,
  can_manage_settings boolean default false,
  unique (business_id, role_id, module_key)
);

create table if not exists public.settings_billing (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  plan text not null default 'Grow',
  status text not null default 'active',
  payment_method text,
  usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id)
);

create table if not exists public.settings_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  provider text default 'hubly',
  external_id text,
  plan text,
  status text default 'active',
  renews_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.settings_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  email boolean default true,
  sms boolean default true,
  push boolean default false,
  desktop boolean default true,
  ai boolean default true,
  weekly_reports boolean default true,
  marketing boolean default false,
  automation boolean default true,
  updated_at timestamptz not null default now(),
  unique (business_id)
);

create table if not exists public.settings_branding (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  logo_url text,
  primary_color text,
  accent_color text,
  font_display text,
  font_body text,
  favicon_url text,
  website_defaults text,
  updated_at timestamptz not null default now(),
  unique (business_id)
);

create table if not exists public.settings_integrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  provider text not null,
  status text not null default 'not_connected',
  note text,
  last_sync_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (business_id, provider)
);

create table if not exists public.settings_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  provider text not null,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.settings_security (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  mfa_required boolean default false,
  password_min_length int default 10,
  require_symbol boolean default true,
  updated_at timestamptz not null default now(),
  unique (business_id)
);

create table if not exists public.settings_api_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  label text not null,
  prefix text not null,
  hashed_secret text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.settings_audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  label text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.settings_ai (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  tone text default 'helpful_pro',
  permissions text default 'propose_with_confirm',
  auto_actions_default boolean default false,
  memory_default boolean default true,
  automation_defaults text,
  updated_at timestamptz not null default now(),
  unique (business_id)
);

create table if not exists public.settings_organization (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (business_id)
);

create table if not exists public.settings_business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  open_time time,
  close_time time,
  closed boolean default false,
  unique (business_id, weekday)
);

-- RLS: owner-only via businesses.owner_id
do $$
declare
  t text;
begin
  foreach t in array array[
    'settings_business','settings_team_members','settings_roles','settings_permissions',
    'settings_billing','settings_subscriptions','settings_notifications','settings_branding',
    'settings_integrations','settings_oauth_tokens','settings_security','settings_api_keys',
    'settings_audit_logs','settings_ai','settings_organization','settings_business_hours'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all using (
         exists (
           select 1 from public.businesses b
           where b.id = %I.business_id and b.owner_id = auth.uid()
         )
       ) with check (
         exists (
           select 1 from public.businesses b
           where b.id = %I.business_id and b.owner_id = auth.uid()
         )
       )',
      t || '_owner_all', t, t, t
    );
  end loop;
end $$;
