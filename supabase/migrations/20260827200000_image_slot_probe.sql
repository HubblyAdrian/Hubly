-- IMAGE-SLOT TELEMETRY (measurement, additive; no behaviour change).
-- One row per image slot per build: what the model asked for, what query we
-- sent, how many stock results came back, how many survived filtering, and
-- what the slot became. Same discipline as planner_fallback_events: a countable
-- table so "how often does an image slot end empty, and why" is a query.
create table if not exists public.image_slot_probe (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid,
  role                  text,
  subject               text,   -- the model's art-direction phrase, verbatim
  query                 text,   -- the query we actually sent to Pexels
  wants_no_people       boolean,
  is_work_role          boolean,-- stock forbidden for work roles: never queried
  stock_queried         boolean,
  raw_count             integer,-- results from Pexels (landscape, per_page 30)
  raw_count_any_orient  integer,-- shadow: same query WITHOUT the landscape filter
  eligible_count        integer,-- survivors after the person filter
  outcome               text,   -- 'customer' | 'pexels' | 'blank'
  created_at            timestamptz not null default now()
);
alter table public.image_slot_probe enable row level security;
-- No policies: service role (the build) bypasses RLS to insert; nobody else reads.
create index if not exists image_slot_probe_business_idx on public.image_slot_probe(business_id);
create index if not exists image_slot_probe_created_idx on public.image_slot_probe(created_at);
