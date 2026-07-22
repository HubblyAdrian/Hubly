-- Hubly Mission Control — platform admin identity + audit (read-first).
-- Not customer-facing. Service-role only from the mission-control edge.

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text not null unique,
  display_name text,
  role text not null default 'admin'
    check (role in ('viewer', 'admin', 'owner')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.platform_admins is
  'Hubly staff for Mission Control. Prefer Supabase Auth linkage; secret gate remains for bootstrap.';

create table if not exists public.admin_audit_log (
  id bigserial primary key,
  admin_email text,
  admin_user_id uuid,
  action text not null,
  resource_type text,
  resource_id text,
  meta jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

comment on table public.admin_audit_log is
  'Append-only Mission Control audit trail. Never store customer secrets.';

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

create index if not exists admin_audit_log_resource_idx
  on public.admin_audit_log (resource_type, resource_id);

alter table public.platform_admins enable row level security;
alter table public.admin_audit_log enable row level security;

-- No client policies — Mission Control edge uses service role only.
