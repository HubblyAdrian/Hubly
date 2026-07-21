-- Hubly Runtime Phase 7.5 — Execution history
-- Every Orchestrator run is stored for debugging, analytics, replay, and AI learning.

create table if not exists public.hubly_execution_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  prompt text,
  status text not null default 'started'
    check (status in ('started', 'running', 'completed', 'failed', 'cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms int,
  memory_snapshot jsonb,
  execution_plan jsonb not null default '{"version":1,"steps":[]}'::jsonb,
  executor_results jsonb,
  progress_events jsonb not null default '[]'::jsonb,
  errors jsonb,
  created_at timestamptz not null default now()
);

comment on table public.hubly_execution_runs is
  'Hubly Runtime execution history. Planner WHAT + Orchestrator HOW results for replay/debug/analytics.';

create index if not exists hubly_execution_runs_business_id_idx
  on public.hubly_execution_runs (business_id, started_at desc);

create index if not exists hubly_execution_runs_started_at_idx
  on public.hubly_execution_runs (started_at desc);

alter table public.hubly_execution_runs enable row level security;

drop policy if exists hubly_execution_runs_select_owner on public.hubly_execution_runs;
create policy hubly_execution_runs_select_owner
  on public.hubly_execution_runs for select
  using (
    business_id is null
    or business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists hubly_execution_runs_insert_owner on public.hubly_execution_runs;
create policy hubly_execution_runs_insert_owner
  on public.hubly_execution_runs for insert
  with check (
    business_id is null
    or business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists hubly_execution_runs_update_owner on public.hubly_execution_runs;
create policy hubly_execution_runs_update_owner
  on public.hubly_execution_runs for update
  using (
    business_id is null
    or business_id in (select id from public.businesses where owner_id = auth.uid())
  )
  with check (
    business_id is null
    or business_id in (select id from public.businesses where owner_id = auth.uid())
  );
