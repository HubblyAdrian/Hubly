-- REBUILD-OUTCOME TELEMETRY (loud + countable, same discipline as planner_fallback_events).
-- Every time a record change triggers a rebuild, record what the rebuild actually
-- did. A rebuild that was triggered but produced NO new version (status
-- not_applicable/failed/skipped) is the invisible failure we are chasing: a photo
-- that stores and never appears. Now it is a row, not a guess.
create table if not exists public.rebuild_outcome_events (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid,
  changes      text,     -- the recordChange list, comma-joined (e.g. "photos")
  status       text,     -- rebuilt | rerendered | patched | not_applicable | skipped_owner_edited | no_document | failed
  detail       text,
  landed       boolean,  -- did a NEW document version actually result?
  created_at   timestamptz not null default now()
);
alter table public.rebuild_outcome_events enable row level security;
create index if not exists rebuild_outcome_business_idx on public.rebuild_outcome_events(business_id);
create index if not exists rebuild_outcome_created_idx on public.rebuild_outcome_events(created_at);

create or replace function public.record_rebuild_outcome(
  p_business_id uuid, p_changes text, p_status text, p_detail text, p_landed boolean
) returns void language sql security definer set search_path = public as $$
  insert into public.rebuild_outcome_events(business_id, changes, status, detail, landed)
  values (p_business_id, p_changes, p_status, p_detail, p_landed);
$$;
grant execute on function public.record_rebuild_outcome(uuid, text, text, text, boolean) to anon, authenticated, service_role;
