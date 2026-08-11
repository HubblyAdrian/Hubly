-- Structured, server-readable projection of the customer membership fact
-- that already lives in customers.notes as a [RP]{json} tag (parsed by
-- parseRecurringMetaFromNotes in hubly.html). The browser-side system is
-- unchanged by this migration — this table exists so the AI/edge functions
-- can read real membership state without ever parsing notes-tags
-- server-side. upsertCustomer() becomes the single synchronization point
-- that keeps both representations in agreement (see hubly.html).
--
-- Deliberately independent of recurring_schedules: no FK, no shared
-- primary key, related only through customer_id, exactly as Phase 3
-- (commit 51266a0) already established for the client-side relationship.
-- Membership = commercial plan; Recurring Schedule = operational
-- automation. Pausing/cancelling one must never touch the other.
--
-- unique(customer_id) enforces "one membership per customer" at the DB
-- level per the current product decision — dropping this constraint is
-- the only migration needed if that decision changes later.
create table memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  customer_id uuid not null,
  plan_name text not null,
  service_name text,
  cadence text,
  price numeric,
  default_duration numeric,
  status text not null default 'active',
  next_due_date date,
  -- Verbatim passthrough of [RP].includes (real inclusions text, when a
  -- plan was created via a booking-wizard membership signup) — stored so
  -- the AI can state them if asked, never used to infer service coverage
  -- or pricing.
  includes jsonb,
  -- Verbatim passthrough of [RP].membershipPlanId (only set by the
  -- booking-signup writer today; saveManagedRecurringPlan's edit path
  -- doesn't preserve it, a pre-existing gap in the current system, not
  -- something this migration changes or fixes). Lossless capture only —
  -- no logic reads this column yet.
  source_plan_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id)
);

create index memberships_business_id_idx on public.memberships using btree (business_id);
create index memberships_customer_id_idx on public.memberships using btree (customer_id);

alter table memberships enable row level security;

-- Same shape as recurring_schedules' own policy: both real write paths
-- (saveManagedRecurringPlan, and the owner accepting a membership-signup
-- booking request) run in an authenticated owner session — no anonymous
-- write path exists for this table.
create policy "owner can manage memberships"
  on memberships
  for all
  to authenticated
  using (owns_business(business_id))
  with check (owns_business(business_id));
