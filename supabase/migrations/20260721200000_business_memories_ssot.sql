-- Hubly Brain Phase 7.1 — Business Memory SSOT persistence
-- Conversation → Understanding → Memory → Planner → Skills → Executors
-- Memory is the single source of truth for every Brain interaction.

create table if not exists public.business_memories (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  memory jsonb not null default '{"version":1}'::jsonb,
  memory_version int not null default 1,
  source text not null default 'client' check (source in ('client', 'ingest', 'understanding', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.business_memories is
  'Hubly Brain Business Memory SSOT. Structured facts only — Planner reads this, never raw conversation.';

comment on column public.business_memories.memory is
  'Canonical HublyBusinessMemory JSON (versioned). Updated by Understanding / client sync; never by the model writing DB directly.';

create index if not exists business_memories_updated_at_idx
  on public.business_memories (updated_at desc);

create or replace function public.touch_business_memories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_business_memories_updated_at on public.business_memories;
create trigger trg_touch_business_memories_updated_at
  before update on public.business_memories
  for each row
  execute function public.touch_business_memories_updated_at();

alter table public.business_memories enable row level security;

drop policy if exists business_memories_select_owner on public.business_memories;
create policy business_memories_select_owner
  on public.business_memories for select
  using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists business_memories_insert_owner on public.business_memories;
create policy business_memories_insert_owner
  on public.business_memories for insert
  with check (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists business_memories_update_owner on public.business_memories;
create policy business_memories_update_owner
  on public.business_memories for update
  using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  )
  with check (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists business_memories_delete_owner on public.business_memories;
create policy business_memories_delete_owner
  on public.business_memories for delete
  using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );
