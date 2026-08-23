-- COUNTABLE MISS-DETECTION (the ②-guard instrument).
--
-- When Hubly asks for a fact (services/hours/area/phone) and the person answers but
-- nothing was recorded, the client detects the miss and re-asks. This table makes that
-- countable: one row per detected miss, so we can measure capture before/after the guard
-- ships — the same discipline as the auth diagnostic. It is an instrument, not a feature;
-- nothing reads it in the product, we query it.
create table if not exists public.capture_miss_events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid,
  asked_for   text not null check (asked_for in ('services','hours','area','phone')),
  created_at  timestamptz not null default now()
);

alter table public.capture_miss_events enable row level security;
-- No direct table access; writes go only through the security-definer RPC below.
revoke all on public.capture_miss_events from anon, authenticated;

-- The anon builder client calls this on a detected miss. Security definer so it can
-- insert past RLS; it validates the fact name and records nothing sensitive (just which
-- kind of fact went uncaptured, and for which business).
create or replace function public.record_capture_miss(p_business_id uuid, p_asked_for text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_asked_for not in ('services','hours','area','phone') then
    return;  -- ignore anything outside the known vocabulary, never error the client
  end if;
  insert into public.capture_miss_events (business_id, asked_for)
  values (p_business_id, p_asked_for);
end;
$$;

grant execute on function public.record_capture_miss(uuid, text) to anon, authenticated;
