-- COUNTABLE FREEFORM-PLANNER FALLBACK (instrument, not a feature).
--
-- The freeform build runs a cheap planning call first (commit the page's shape in plain
-- words), then the generation executes it. If the planner fails, the build falls back to
-- single-pass -- the generation still runs, just WITHOUT a plan. A page built without a plan
-- must be visible as such, never indistinguishable from one built with it. This counts how
-- often the planner did not run, same discipline as postbuild_fallback_events. Nothing reads
-- it in the product; we query it. The error text is kept so a spike names its own cause.
create table if not exists public.planner_fallback_events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid,
  error       text,
  created_at  timestamptz not null default now()
);

alter table public.planner_fallback_events enable row level security;
revoke all on public.planner_fallback_events from anon, authenticated;

create or replace function public.record_planner_fallback(p_business_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.planner_fallback_events (business_id, error) values (p_business_id, left(coalesce(p_error,''), 300));
end;
$$;

grant execute on function public.record_planner_fallback(uuid, text) to anon, authenticated;
