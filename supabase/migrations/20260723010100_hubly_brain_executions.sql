-- Hubly Brain Section 1 — durable execution log (every AI interaction)

create table if not exists public.hubly_brain_executions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  run_id text,
  kind text not null check (kind in ('think', 'complete')),
  feature text not null default 'unknown',
  task text,
  intent text,
  experts_selected jsonb not null default '[]'::jsonb,
  merged_response boolean not null default false,
  memory_updated boolean not null default false,
  confidence int check (confidence is null or (confidence >= 0 and confidence <= 100)),
  ok boolean not null default true,
  latency_ms int not null default 0,
  provider text,
  model text,
  error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.hubly_brain_executions is
  'Hubly Brain execution log — every AI request that enters Brain is recorded here.';

create index if not exists hubly_brain_executions_created_idx
  on public.hubly_brain_executions (created_at desc);

create index if not exists hubly_brain_executions_business_idx
  on public.hubly_brain_executions (business_id, created_at desc);

alter table public.hubly_brain_executions enable row level security;

drop policy if exists hubly_brain_executions_select_owner on public.hubly_brain_executions;
create policy hubly_brain_executions_select_owner on public.hubly_brain_executions for select
  using (
    business_id is null
    or business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists hubly_brain_executions_insert_owner on public.hubly_brain_executions;
create policy hubly_brain_executions_insert_owner on public.hubly_brain_executions for insert
  with check (
    business_id is null
    or business_id in (select id from public.businesses where owner_id = auth.uid())
  );
