-- THE EVENT STREAM. DERIVED, NOT WRITTEN. (Stage A, ruled 2026-09-08.)
--
-- A written stream is a second copy maintained in parallel with the truth, and when the
-- writer misses one the stream silently lacks it and NOTHING REPORTS THE GAP. That is the
-- defect class behind the fabricated cards, the chrome value nothing read, and the canvas
-- repaint that saved nothing. A view cannot drift because there is nothing to drift from,
-- and it makes "one reader" structural instead of a rule somebody has to keep enforcing.
--
-- THE RULE FOR FUTURE SOURCES, written down so it is not relitigated:
--   1. Every event is a row somewhere real. There is no third category. An event with no
--      obvious source row ("your site went down") gets a real source table when it exists;
--      a health-check row is a source row like any other.
--   2. Every source nominates an IMMUTABLE occurred_at. Never a mutable "updated" column —
--      ordering that can change under the reader is not ordering.
--   3. Card fields are joined from the source AT READ TIME, never copied into the event.
--      A booking later cancelled must render as cancelled, not as a stale "new booking".

-- ── 1. THE DEAD TIMELINE TABLE GOES ─────────────────────────────────────────────
-- business_timeline_events: 0 rows, 0 businesses, never written. Its only reader
-- (mission_control.ts) selected a column `body` THAT DOES NOT EXIST — the table has
-- `detail` — so it has been erroring or empty for its whole life, feeding payload.timeline
-- of an edge function no client calls. Not a visible surface; verified before dropping.
-- Left in place, an empty right-shaped table beside a working stream is exactly how a
-- second event system gets built next year by someone who assumes it is the real one.
drop table if exists public.business_timeline_events;

-- ── 2. READ STATE: A HIGH-WATER MARK, PER OWNER ─────────────────────────────────
-- Per OWNER, not per business. Every business has one owner today; the day someone adds a
-- partner, a shared marker means whoever opens the app first clears the stream for the
-- other and the second person never learns a booking arrived. That is the swallow.
--
-- A high-water mark, not per-event receipts: one row per owner instead of one per
-- (owner, event) forever plus a retention policy. The cost is that a single item cannot be
-- marked unread while later ones stay read. Accepted deliberately — owners glance, they do
-- not triage.
create table if not exists public.business_event_reads (
  business_id  uuid not null references public.businesses(id) on delete cascade,
  owner_uid    uuid not null,
  last_seen_at timestamptz not null,
  updated_at   timestamptz not null default now(),
  primary key (business_id, owner_uid)
);
alter table public.business_event_reads enable row level security;
revoke all on public.business_event_reads from anon, authenticated;

-- ── 3. THE STREAM ───────────────────────────────────────────────────────────────
-- Two sources today, both bookings, because a booking arrives by two different doors:
--   booking_requests — the public booking wizard
--   jobs             — the chat booking path (from_booking = true). Measured 2026-09-08:
--                      a chat booking writes jobs and NOT booking_requests, which is why a
--                      check of booking_requests alone came back empty and nearly produced
--                      a false "nothing was recorded".
-- Jobs that came FROM a booking_request are excluded, or one booking would appear twice.
create or replace view public.business_events as
  select
    b.business_id,
    'booking_request:' || b.id::text  as event_id,
    'booking.created'                 as kind,
    b.created_at                      as occurred_at,
    'booking_request'                 as subject_type,
    b.id                              as subject_id,
    b.customer_name, b.customer_phone, b.customer_email,
    b.service_name,
    b.requested_date                  as event_date,
    b.requested_time::text            as event_time,
    b.address, b.vehicle_type         as vehicle,
    b.notes,
    b.status,
    (b.amount_due_cents / 100.0)      as amount
  from public.booking_requests b
  union all
  select
    j.business_id,
    'job:' || j.id::text,
    'booking.created',
    j.created_at,
    'job',
    j.id,
    j.customer_name, j.phone, j.email,
    j.service_name,
    j.scheduled_date,
    j.scheduled_time::text,
    j.address, j.vehicle,
    j.notes,
    j.status,
    j.amount::numeric
  from public.jobs j
  where j.from_booking = true and j.booking_request_id is null;

-- ── 4. THE READS. Ownership re-checked in SQL; the caller's claim proves nothing. ──
create or replace function public.get_business_events(
  p_business_id uuid, p_owner_id uuid, p_limit int default 30
) returns table (
  event_id text, kind text, occurred_at timestamptz, subject_type text, subject_id uuid,
  customer_name text, customer_phone text, customer_email text, service_name text,
  event_date date, event_time text, address text, vehicle text, notes text, status text,
  amount numeric, is_new boolean
) language plpgsql security definer set search_path = public as $$
declare seen timestamptz;
begin
  if p_owner_id is null or not exists (
    select 1 from public.businesses where id = p_business_id and owner_id = p_owner_id
  ) then return; end if;

  -- A FAILED OR ABSENT MARKER MEANS "NOTHING SEEN", NEVER "EVERYTHING SEEN". A repeated
  -- card is an annoyance; a swallowed booking is a lost customer. The tie does not go to
  -- the expensive error.
  select r.last_seen_at into seen from public.business_event_reads r
    where r.business_id = p_business_id and r.owner_uid = p_owner_id;

  return query
    select e.event_id, e.kind, e.occurred_at, e.subject_type, e.subject_id,
           e.customer_name, e.customer_phone, e.customer_email, e.service_name,
           e.event_date, e.event_time, e.address, e.vehicle, e.notes, e.status,
           e.amount,
           (seen is null or e.occurred_at > seen) as is_new
    from public.business_events e
    where e.business_id = p_business_id
    order by e.occurred_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 100));
end; $$;

create or replace function public.mark_business_events_seen(
  p_business_id uuid, p_owner_id uuid, p_seen_at timestamptz
) returns timestamptz language plpgsql security definer set search_path = public as $$
declare result timestamptz;
begin
  if p_owner_id is null or not exists (
    select 1 from public.businesses where id = p_business_id and owner_id = p_owner_id
  ) then return null; end if;

  -- NEVER BACKWARDS. greatest() in SQL, not in the client: a stale tab must not be able
  -- to un-see a booking a newer one already showed.
  insert into public.business_event_reads (business_id, owner_uid, last_seen_at, updated_at)
  values (p_business_id, p_owner_id, coalesce(p_seen_at, now()), now())
  on conflict (business_id, owner_uid) do update
    set last_seen_at = greatest(public.business_event_reads.last_seen_at, excluded.last_seen_at),
        updated_at = now()
  returning last_seen_at into result;
  return result;
end; $$;

revoke all on function public.get_business_events(uuid, uuid, int) from public, anon;
revoke all on function public.mark_business_events_seen(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.get_business_events(uuid, uuid, int) to authenticated, service_role;
grant execute on function public.mark_business_events_seen(uuid, uuid, timestamptz) to authenticated, service_role;
