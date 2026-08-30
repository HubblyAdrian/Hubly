-- PRICE-EXTRACTION MISS TELEMETRY (loud + countable, same discipline as
-- rebuild_outcome_events). When an intake message plausibly stated a price for a
-- service ("Prices: Express Wash $60, ...") but extraction wrote NO structured
-- priced service, the page ships priceless and Hubly ends up asking for a price it
-- was already given. That failure was invisible until Adrian noticed a bare page
-- two days later; now it is a row. We learn it from a table, not from a person.
--
-- A row here is not a claim that a real customer did anything — it is an internal
-- signal about our own extraction. It carries NO identity and no reading of who the
-- owner is; it exists only so the miss rate is measurable as build-time capture lands.
create table if not exists public.price_extraction_miss_events (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid,
  had_signal    boolean,   -- the message carried a price token ($N / "N dollars")
  structured    integer,   -- how many priced services extraction actually wrote (the miss is when this is 0)
  detail        text,      -- short, non-PII note (e.g. "intake; names=3 priced=0")
  created_at    timestamptz not null default now()
);
alter table public.price_extraction_miss_events enable row level security;
create index if not exists price_extraction_miss_business_idx on public.price_extraction_miss_events(business_id);
create index if not exists price_extraction_miss_created_idx on public.price_extraction_miss_events(created_at);

create or replace function public.record_price_extraction_miss(
  p_business_id uuid, p_had_signal boolean, p_structured integer, p_detail text
) returns void language sql security definer set search_path = public as $$
  insert into public.price_extraction_miss_events(business_id, had_signal, structured, detail)
  values (p_business_id, p_had_signal, p_structured, p_detail);
$$;
grant execute on function public.record_price_extraction_miss(uuid, boolean, integer, text) to anon, authenticated, service_role;
