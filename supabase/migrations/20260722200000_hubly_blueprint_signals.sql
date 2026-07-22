-- Living Blueprints — community learning signals (Blueprint Intelligence)
-- Aggregates owner edits / removals / market behaviors per industry.
-- When enough businesses teach Hubly the same lesson, future blueprints improve.

create table if not exists public.hubly_blueprint_signals (
  id uuid primary key default gen_random_uuid(),
  industry text not null,
  signal_type text not null,
  signal_key text not null,
  hit_count integer not null default 1,
  weight numeric not null default 1,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hubly_blueprint_signals_type_chk check (
    signal_type in (
      'service_removed',
      'service_added',
      'service_renamed',
      'cta_changed',
      'pricing_changed',
      'messaging_changed',
      'promotion_candidate',
      'review_weak_section'
    )
  ),
  unique (industry, signal_type, signal_key)
);

comment on table public.hubly_blueprint_signals is
  'Blueprint Intelligence — community learnings that improve Living Blueprints over time.';

create index if not exists hubly_blueprint_signals_industry_idx
  on public.hubly_blueprint_signals (industry, signal_type, hit_count desc);

create or replace function public.touch_hubly_blueprint_signals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_hubly_blueprint_signals on public.hubly_blueprint_signals;
create trigger trg_touch_hubly_blueprint_signals
  before update on public.hubly_blueprint_signals
  for each row execute function public.touch_hubly_blueprint_signals_updated_at();

-- Upsert helper: increment hit_count when the same lesson repeats
create or replace function public.hubly_record_blueprint_signal(
  p_industry text,
  p_signal_type text,
  p_signal_key text,
  p_weight numeric default 1,
  p_meta jsonb default '{}'::jsonb
)
returns public.hubly_blueprint_signals
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.hubly_blueprint_signals;
begin
  insert into public.hubly_blueprint_signals (industry, signal_type, signal_key, hit_count, weight, meta)
  values (
    lower(trim(p_industry)),
    p_signal_type,
    trim(p_signal_key),
    1,
    coalesce(p_weight, 1),
    coalesce(p_meta, '{}'::jsonb)
  )
  on conflict (industry, signal_type, signal_key) do update set
    hit_count = public.hubly_blueprint_signals.hit_count + 1,
    weight = greatest(public.hubly_blueprint_signals.weight, excluded.weight),
    meta = public.hubly_blueprint_signals.meta || excluded.meta,
    updated_at = now()
  returning * into row;
  return row;
end;
$$;

revoke all on function public.hubly_record_blueprint_signal from public;
grant execute on function public.hubly_record_blueprint_signal to service_role;

alter table public.hubly_blueprint_signals enable row level security;

-- Staff / service role only for reads in HQ; no public client writes (edge records signals)
drop policy if exists hubly_blueprint_signals_service_all on public.hubly_blueprint_signals;
create policy hubly_blueprint_signals_service_all
  on public.hubly_blueprint_signals
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
