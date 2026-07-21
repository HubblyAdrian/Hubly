-- Business Timeline — Hubly signature story of AI actions + recommendations
create table if not exists public.business_timeline_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('action', 'recommendation', 'milestone', 'learning')),
  title text not null,
  detail text,
  capability text,
  meta jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.business_timeline_events is
  'Hubly signature Business Timeline — what Hubly did and what it recommends next.';

create index if not exists business_timeline_business_idx
  on public.business_timeline_events (business_id, occurred_at desc);

alter table public.business_timeline_events enable row level security;

drop policy if exists business_timeline_owner_all on public.business_timeline_events;
create policy business_timeline_owner_all
  on public.business_timeline_events for all
  using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  )
  with check (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );
