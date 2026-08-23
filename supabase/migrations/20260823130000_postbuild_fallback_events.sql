-- COUNTABLE POST-BUILD FALLBACK (instrument, not a feature).
--
-- The post-build first message is now the model's turn (services-first). Handing it to
-- the model adds a call that can fail or hang; when it does, the client falls back to one
-- honest deterministic line. This table counts how often that fallback fires — the same
-- discipline as capture_miss_events — so we know whether the model turn is reliable at the
-- single biggest moment in the product. Nothing reads it in the product; we query it.
create table if not exists public.postbuild_fallback_events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid,
  created_at  timestamptz not null default now()
);

alter table public.postbuild_fallback_events enable row level security;
revoke all on public.postbuild_fallback_events from anon, authenticated;

create or replace function public.record_postbuild_fallback(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.postbuild_fallback_events (business_id) values (p_business_id);
end;
$$;

grant execute on function public.record_postbuild_fallback(uuid) to anon, authenticated;
