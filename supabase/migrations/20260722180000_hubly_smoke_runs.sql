-- Hubly deployment smoke results → Release Gate (RED on fail).
-- Written by scripts/smoke-release.mjs via mission-control action smoke_report.

create table if not exists public.hubly_smoke_runs (
  id uuid primary key default gen_random_uuid(),
  passed boolean not null,
  gate_status text not null check (gate_status in ('green', 'red')),
  checks jsonb not null default '[]'::jsonb,
  failed_ids text[] not null default '{}',
  environment text,
  commit_sha text,
  reported_by text,
  created_at timestamptz not null default now()
);

create index if not exists hubly_smoke_runs_created_at_idx
  on public.hubly_smoke_runs (created_at desc);

alter table public.hubly_smoke_runs enable row level security;

comment on table public.hubly_smoke_runs is
  'Deployment smoke results. Release Gate turns RED when latest run failed or is stale.';
