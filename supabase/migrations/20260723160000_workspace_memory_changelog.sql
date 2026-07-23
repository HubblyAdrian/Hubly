-- Section 6 — Workspace Memory audit trail (Brain-owned commits)
-- Workspace preferences are separate from Business Memory facts.

create table if not exists public.workspace_memory_changes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  change_id text not null,
  memory_version int not null,
  path text not null,
  previous jsonb,
  next jsonb,
  reason text not null,
  expert_id text not null,
  importance text not null default 'medium'
    check (importance in ('low', 'medium', 'high', 'critical')),
  confidence int not null default 0 check (confidence >= 0 and confidence <= 100),
  source text not null default 'ai_inference'
    check (source in ('user', 'ai_inference', 'external_integration')),
  committed_by text not null default 'hubly_brain',
  created_at timestamptz not null default now()
);

comment on table public.workspace_memory_changes is
  'Hubly Brain Workspace Memory changelog — how the owner likes to work (sidebar, pins, hidden tools). Separate from Business Memory.';

create index if not exists workspace_memory_changes_business_idx
  on public.workspace_memory_changes (business_id, created_at desc);

create index if not exists workspace_memory_changes_path_idx
  on public.workspace_memory_changes (business_id, path);

alter table public.workspace_memory_changes enable row level security;

drop policy if exists workspace_memory_changes_select_owner on public.workspace_memory_changes;
create policy workspace_memory_changes_select_owner on public.workspace_memory_changes for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists workspace_memory_changes_insert_owner on public.workspace_memory_changes;
create policy workspace_memory_changes_insert_owner on public.workspace_memory_changes for insert
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

-- Allow brain source label on workspace_memories
alter table public.workspace_memories drop constraint if exists workspace_memories_source_check;
alter table public.workspace_memories
  add constraint workspace_memories_source_check
  check (source in ('client', 'brain', 'system', 'hubly_brain'));
