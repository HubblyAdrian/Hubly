-- Hubly Brain Milestone 1 — Workspace Memory, Conversation Memory, Reasoning log

create table if not exists public.workspace_memories (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  memory jsonb not null default '{"version":1}'::jsonb,
  memory_version int not null default 1,
  source text not null default 'client' check (source in ('client', 'brain', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workspace_memories is
  'Hubly Brain Workspace Memory — sidebar, dashboard, pins. Separate from Business Memory.';

create index if not exists workspace_memories_updated_at_idx
  on public.workspace_memories (updated_at desc);

create or replace function public.touch_workspace_memories_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_touch_workspace_memories_updated_at on public.workspace_memories;
create trigger trg_touch_workspace_memories_updated_at
  before update on public.workspace_memories
  for each row execute function public.touch_workspace_memories_updated_at();

alter table public.workspace_memories enable row level security;

drop policy if exists workspace_memories_select_owner on public.workspace_memories;
create policy workspace_memories_select_owner on public.workspace_memories for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists workspace_memories_insert_owner on public.workspace_memories;
create policy workspace_memories_insert_owner on public.workspace_memories for insert
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists workspace_memories_update_owner on public.workspace_memories;
create policy workspace_memories_update_owner on public.workspace_memories for update
  using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists workspace_memories_delete_owner on public.workspace_memories;
create policy workspace_memories_delete_owner on public.workspace_memories for delete
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

-- Conversation Memory
create table if not exists public.hubly_conversation_memories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  session_id text,
  memory jsonb not null default '{"version":1,"turns":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hubly_conversation_memories is
  'Hubly Brain Conversation Memory — turns, summaries, pending tasks across sessions.';

create index if not exists hubly_conversation_memories_business_idx
  on public.hubly_conversation_memories (business_id, updated_at desc);

create or replace function public.touch_hubly_conversation_memories_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_touch_hubly_conversation_memories_updated_at on public.hubly_conversation_memories;
create trigger trg_touch_hubly_conversation_memories_updated_at
  before update on public.hubly_conversation_memories
  for each row execute function public.touch_hubly_conversation_memories_updated_at();

alter table public.hubly_conversation_memories enable row level security;

drop policy if exists hubly_conversation_memories_select_owner on public.hubly_conversation_memories;
create policy hubly_conversation_memories_select_owner on public.hubly_conversation_memories for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists hubly_conversation_memories_insert_owner on public.hubly_conversation_memories;
create policy hubly_conversation_memories_insert_owner on public.hubly_conversation_memories for insert
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists hubly_conversation_memories_update_owner on public.hubly_conversation_memories;
create policy hubly_conversation_memories_update_owner on public.hubly_conversation_memories for update
  using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists hubly_conversation_memories_delete_owner on public.hubly_conversation_memories;
create policy hubly_conversation_memories_delete_owner on public.hubly_conversation_memories for delete
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

-- Reasoning / decision log (Brain Console + future learning)
create table if not exists public.hubly_reasoning_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  run_id text,
  domain text not null default 'general',
  decision text not null,
  reason text not null,
  evidence jsonb not null default '[]'::jsonb,
  confidence int not null default 0 check (confidence >= 0 and confidence <= 100),
  expected_impact text,
  expert_id text,
  source text not null default 'brain',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.hubly_reasoning_events is
  'Hubly Brain Reasoning Engine — every important decision stores why + confidence.';

create index if not exists hubly_reasoning_events_business_idx
  on public.hubly_reasoning_events (business_id, created_at desc);

alter table public.hubly_reasoning_events enable row level security;

drop policy if exists hubly_reasoning_events_select_owner on public.hubly_reasoning_events;
create policy hubly_reasoning_events_select_owner on public.hubly_reasoning_events for select
  using (
    business_id is null
    or business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists hubly_reasoning_events_insert_owner on public.hubly_reasoning_events;
create policy hubly_reasoning_events_insert_owner on public.hubly_reasoning_events for insert
  with check (
    business_id is null
    or business_id in (select id from public.businesses where owner_id = auth.uid())
  );
