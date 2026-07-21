-- Hubly Brain Phase 7.6 — Business DNA (interpretive identity)
-- Permanent rule: Memory = facts; DNA = identity. Never combine.

create table if not exists public.business_dna (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  dna jsonb not null default '{"version":1,"identity":{},"brand":{},"services":{},"pricing":{},"customerProfile":{},"goals":[],"personality":{},"operations":{},"marketing":{}}'::jsonb,
  dna_version int not null default 1,
  source text not null default 'system'
    check (source in ('understanding', 'client', 'weekly_learning', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.business_dna is
  'Hubly Business DNA — interpretive identity (personality, goals, ideal customer). Separate from business_memories facts.';

comment on column public.business_dna.dna is
  'Canonical HublyBusinessDNA JSON. Never store raw conversation or Memory facts here.';

create index if not exists business_dna_updated_at_idx
  on public.business_dna (updated_at desc);

create or replace function public.touch_business_dna_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_business_dna_updated_at on public.business_dna;
create trigger trg_touch_business_dna_updated_at
  before update on public.business_dna
  for each row
  execute function public.touch_business_dna_updated_at();

alter table public.business_dna enable row level security;

drop policy if exists business_dna_select_owner on public.business_dna;
create policy business_dna_select_owner
  on public.business_dna for select
  using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists business_dna_insert_owner on public.business_dna;
create policy business_dna_insert_owner
  on public.business_dna for insert
  with check (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists business_dna_update_owner on public.business_dna;
create policy business_dna_update_owner
  on public.business_dna for update
  using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  )
  with check (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists business_dna_delete_owner on public.business_dna;
create policy business_dna_delete_owner
  on public.business_dna for delete
  using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );
