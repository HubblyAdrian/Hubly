-- Hubly HQ Proof Mode board — per-vertical lifecycle evidence.
create table if not exists public.hubly_proof_runs (
  id uuid primary key default gen_random_uuid(),
  vertical text not null unique check (vertical in ('cleaning', 'detailing', 'lawn_care')),
  business_id uuid,
  business_name text,
  steps jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'partial', 'pass', 'fail')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hubly_proof_runs_status_idx on public.hubly_proof_runs (status);

alter table public.hubly_proof_runs enable row level security;

comment on table public.hubly_proof_runs is
  'Hubly HQ Proof Mode — Cleaning / Detailing / Lawn Care lifecycle evidence. Closed Beta Ready only when all three status=pass.';
