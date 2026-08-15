-- Staging bootstrap — the Hubly objects that exist in production but are NOT in
-- supabase/migrations, and therefore cannot be recreated by `supabase db push`.
--
-- WHY THIS FILE EXISTS
-- --------------------
-- `businesses`, `jobs`, `customers`, `booking_requests` and the `owns_business()`
-- helper were all created outside version control (the repo says so itself in
-- 20260805223000 and 20260811035905). The very first migration in the chain,
-- 20260710010000, opens with `alter table booking_requests ...` — so pushing the
-- migrations at a fresh database fails on statement one. Without this file there
-- is no way to stand up a staging database from this repository at all.
--
-- WHAT THIS FILE IS *NOT*
-- -----------------------
-- It is a RECONSTRUCTION, not a copy of production. It contains the columns this
-- repository demonstrably reads and writes, and nothing else. It is sufficient to
-- exercise One-Off Sessions end to end — schema, constraints, RLS, the calendar
-- block, the customer resolver — against a real PostgreSQL. It is NOT a
-- substitute for a `pg_dump --schema-only` of production, and staging built from
-- it will differ from production in columns no code path touches.
--
-- The authoritative way to build staging remains:
--     pg_dump --schema-only <production> | psql <staging>
-- which needs the production DB password. Use this file when you don't have it,
-- or for a local, zero-cost, zero-contact database.
--
-- Apply order:
--   1. this file
--   2. supabase/migrations/*.sql in filename order

-- ── Supabase runtime shims ────────────────────────────────────────────────────
-- Supabase provides these; a bare PostgreSQL does not. RLS is meaningless
-- without them, so they are recreated faithfully rather than stubbed away.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create schema if not exists auth;

-- Mirrors Supabase's auth.uid(): the subject of the verified JWT, surfaced to
-- SQL through the request.jwt.claims GUC. A test "signs in" by setting that GUC.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''),
    'anon'
  );
$$;

-- Supabase manages these; migrations reference them (auth.users FKs, storage
-- buckets, the realtime publication). Minimal shapes so the chain can apply.
create table if not exists auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz not null default now()
);

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean default false,
  created_at timestamptz not null default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- ── Core tables ───────────────────────────────────────────────────────────────

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text,
  slug text unique,
  email text,
  phone text,
  business_type text,
  brand_color text,
  logo_url text,
  banner_url text,
  tagline text,
  about text,
  timezone text,
  -- text, not jsonb: production stores meta as a JSON *string* — see
  -- _shared/hubly_business_meta.ts, which exists solely because of this.
  meta text default '{}',
  capabilities jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  name text,
  email text,
  phone text,
  address text,
  notes text,
  -- Written by resolveOrCreateCrmCustomer (_shared/crm_customer.ts). Another
  -- column that exists in production but in no migration — omitting it made
  -- every CRM customer insert fail silently, which is exactly the kind of drift
  -- a real `pg_dump --schema-only` of production would rule out.
  customer_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  customer_id uuid,
  customer_name text,
  email text,
  phone text,
  service_name text,
  scheduled_date date,
  scheduled_time time,
  duration_hours numeric,
  address text,
  amount numeric,
  notes text,
  status text default 'scheduled',
  from_booking boolean default false,
  paid boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  customer_name text,
  customer_phone text,
  customer_email text,
  service_name text,
  requested_date date,
  requested_time text,
  address text,
  notes text,
  status text default 'pending',
  payment_status text,
  amount_due_cents integer,
  amount_paid_cents integer,
  currency text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  addons jsonb,
  vehicle_type text, vehicle_year text, vehicle_make text,
  vehicle_model text, vehicle_color text, condition text,
  created_at timestamptz not null default now()
);

create table if not exists public.stripe_connect_accounts (
  business_id uuid primary key,
  stripe_account_id text,
  charges_enabled boolean default false,
  payouts_enabled boolean default false,
  details_submitted boolean default false,
  email text,
  last_error text,
  updated_at timestamptz default now()
);

create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique,
  google_calendar_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.google_calendar_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  google_event_id text,
  summary text,
  start_at timestamptz,
  end_at timestamptz,
  all_day boolean default false,
  local_date date,
  local_start_time time,
  duration_hours numeric,
  status text
);

-- ── owns_business() ───────────────────────────────────────────────────────────
-- Reconstructed from how every policy in the repo uses it: the caller owns the
-- business. SECURITY DEFINER so the lookup itself is not re-filtered by RLS
-- (otherwise the policy could never see the row it is authorising against).
--
-- NOTE: production may additionally grant team members via `memberships`. If it
-- does, staging is STRICTER than production here, never looser — an acceptable
-- direction for a security test.
create or replace function public.owns_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
  );
$$;

-- ── RLS on the core tables, matching the pattern every migration assumes ──────
alter table public.businesses enable row level security;
alter table public.customers enable row level security;
alter table public.jobs enable row level security;
alter table public.booking_requests enable row level security;

drop policy if exists "owner manages own business" on public.businesses;
create policy "owner manages own business" on public.businesses
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "owner manages own customers" on public.customers;
create policy "owner manages own customers" on public.customers
  for all to authenticated
  using (owns_business(business_id)) with check (owns_business(business_id));

drop policy if exists "owner manages own jobs" on public.jobs;
create policy "owner manages own jobs" on public.jobs
  for all to authenticated
  using (owns_business(business_id)) with check (owns_business(business_id));

drop policy if exists "owner manages own booking requests" on public.booking_requests;
create policy "owner manages own booking requests" on public.booking_requests
  for all to authenticated
  using (owns_business(business_id)) with check (owns_business(business_id));

-- PostgREST grants. anon/authenticated get table privileges; RLS then decides
-- what they may actually see. This mirrors Supabase's default grants — without
-- them RLS would never even be consulted.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
