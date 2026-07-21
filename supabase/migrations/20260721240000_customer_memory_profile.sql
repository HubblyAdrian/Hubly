-- Hubly Customer Runtime Phase 7.8 — Customer Memory (facts) + Customer Profile (identity)
-- Mirror of business_memories / business_dna. Never combine the two.

create table if not exists public.customer_memories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  session_key text,
  memory jsonb not null default '{"version":1}'::jsonb,
  memory_version int not null default 1,
  source text not null default 'system'
    check (source in ('understanding', 'client', 'system', 'booking')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  session_key text,
  profile jsonb not null default '{"version":1}'::jsonb,
  profile_version int not null default 1,
  source text not null default 'system'
    check (source in ('understanding', 'client', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customer_memories is
  'Customer Runtime facts SSOT (name, address, job). Separate from customer_profiles identity.';
comment on table public.customer_profiles is
  'Customer Runtime identity (premium preference, weekend books, carefulness). Never merge into Memory.';

create index if not exists customer_memories_owner_idx on public.customer_memories (owner_user_id, updated_at desc);
create index if not exists customer_memories_session_idx on public.customer_memories (session_key, updated_at desc);
create index if not exists customer_profiles_owner_idx on public.customer_profiles (owner_user_id, updated_at desc);
create index if not exists customer_profiles_session_idx on public.customer_profiles (session_key, updated_at desc);

alter table public.customer_memories enable row level security;
alter table public.customer_profiles enable row level security;

drop policy if exists customer_memories_owner_all on public.customer_memories;
create policy customer_memories_owner_all
  on public.customer_memories for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists customer_profiles_owner_all on public.customer_profiles;
create policy customer_profiles_owner_all
  on public.customer_profiles for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
