-- One-Off Sessions — a temporary/event booking primitive layered on top of the
-- engines Hubly already has. NOT a second booking system.
--
-- Verified against the real code before writing a line of this:
--   * A calendar "block" in Hubly today is a real `jobs` row whose
--     customer_name = 'Blocked' (public/hubly.html submitBlockTime, and
--     isBlock: j.customer_name==='Blocked' at the read side). Availability —
--     both the get_busy_windows RPC used by the website booking wizard and
--     jobBlocks() in _shared/marketplace_availability.ts — reads `jobs`. So a
--     session's 8am–2pm hold is ONE ordinary block job, and every existing
--     availability path excludes it for free. No availability logic is
--     duplicated or forked anywhere for this feature.
--   * `jobs` has no CREATE TABLE migration in this repo (created outside
--     version control — see 20260806150000's note); columns are therefore
--     added with `add column if not exists`, same as every prior migration
--     that touched it.
--   * Services live in businesses.meta.service_catalog (Service Engine), so
--     service_id here is a text reference into that catalog, not an FK. A
--     session may reference a Service for reporting/continuity, but it owns
--     its own duration/price/payment for the event — that is the whole point
--     of it being temporary and not polluting the permanent catalog.
--
--   Business
--     ├── Permanent Services (Service Engine — untouched)
--     ├── Normal Bookings (jobs / booking_requests / marketplace_bookings)
--     └── One-Off Sessions            <- this migration
--           ├── calendar block         -> one jobs row (customer_name='Blocked')
--           ├── session bookings       -> one_off_session_bookings + one jobs row each
--           └── private booking URL    -> booking_token (opaque, not an id)

create table if not exists public.one_off_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,

  name text not null,
  description text,

  -- draft is the default on purpose: a session must be explicitly published
  -- before it can ever be booked or hold the calendar.
  status text not null default 'draft'
    check (status in ('draft','published','sold_out','closed','cancelled','completed')),

  -- link_only is the default on purpose (§3): a session never appears in the
  -- normal services list, public catalog, website nav, or AI recommendations
  -- unless somebody deliberately makes it public.
  visibility text not null default 'link_only'
    check (visibility in ('link_only','public')),

  -- Optional Service Engine reference (businesses.meta.service_catalog id) —
  -- text, not an FK, because the catalog is versioned JSON, not a table.
  service_id text,
  service_name text,

  session_date date not null,
  start_time time not null,
  end_time time not null,
  timezone text,

  appointment_duration_minutes integer not null default 30
    check (appointment_duration_minutes > 0 and appointment_duration_minutes <= 720),
  buffer_minutes integer not null default 0 check (buffer_minutes >= 0),

  location_type text not null default 'in_person'
    check (location_type in ('in_person','virtual','customer_address')),
  location text,

  capacity_per_slot integer not null default 1
    check (capacity_per_slot >= 1 and capacity_per_slot <= 100),
  -- Null = limited only by the slot grid itself.
  total_capacity integer check (total_capacity is null or total_capacity >= 1),

  -- Integer cents + lowercase currency, the same money convention as
  -- marketplace_bookings / commerce_orders / booking_requests.
  price_cents integer check (price_cents is null or price_cents >= 0),
  currency text not null default 'usd',

  payment_mode text not null default 'none'
    check (payment_mode in ('none','deposit','full')),
  deposit_type text check (deposit_type is null or deposit_type in ('flat','percentage')),
  deposit_cents integer check (deposit_cents is null or deposit_cents >= 0),
  deposit_percentage numeric
    check (deposit_percentage is null or (deposit_percentage > 0 and deposit_percentage <= 100)),

  -- [{ id, label, type, required, options[] }] — the questions this session asks.
  booking_questions jsonb not null default '[]'::jsonb,

  -- The private booking URL's opaque token. NOT an id and not derived from
  -- one: /session/<token> must never leak a business id, a session id, or a
  -- guessable sequence. Generated with gen_random_bytes in the app layer.
  booking_token text not null unique,

  -- Where this session is promoted, if anywhere: { storefront: true }. The
  -- promotional banner stores only a REFERENCE to the session id, so session
  -- state (active/sold out/closed) always flows through to the CTA — this
  -- column is the reverse index so a session knows it is being promoted.
  website_promotion jsonb not null default '{}'::jsonb,

  -- The provider's calendar hold: one real jobs row (customer_name='Blocked')
  -- covering start_time..end_time. Created at publish, removed on close/cancel.
  calendar_block_job_id uuid,
  -- Google Calendar event for the block, created through the existing sync
  -- engine. One event per session — never one per generated slot.
  google_event_id text,

  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  closed_at timestamptz,

  -- §17, enforced by the database and not only by the app or the AI.
  constraint one_off_sessions_window_ordered check (end_time > start_time),
  constraint one_off_sessions_appointment_fits
    check ((extract(epoch from (end_time - start_time)) / 60) >= appointment_duration_minutes),
  constraint one_off_sessions_deposit_not_over_price
    check (
      deposit_cents is null or price_cents is null or deposit_cents <= price_cents
    ),
  constraint one_off_sessions_paid_needs_price
    check (payment_mode = 'none' or coalesce(price_cents, 0) > 0)
);

comment on table public.one_off_sessions is
  'A temporary, event-specific booking opportunity (photography mini sessions, a detailer''s wash day, a lawn crew''s neighborhood service day). Private/link-only by default and deliberately separate from the permanent Service Engine catalog — it must never appear in normal services, normal booking, or public discovery. Its calendar hold is one ordinary jobs row (customer_name=''Blocked''), so every existing availability path excludes the window with no new logic.';
comment on column public.one_off_sessions.booking_token is
  'Opaque public token for /session/<token>. Never derived from any internal id — the public URL must not expose business_id or session id.';
comment on column public.one_off_sessions.calendar_block_job_id is
  'The real jobs row (customer_name=''Blocked'') holding start_time..end_time against NORMAL booking. Session bookings deliberately ignore this one block (jobs.one_off_session_id identifies it) — the block is the parent, the session bookings live inside it.';
comment on column public.one_off_sessions.service_id is
  'Optional Service Engine catalog id (businesses.meta.service_catalog). Text, not an FK: the catalog is versioned JSON. A session references a Service; it never becomes one.';

create index if not exists one_off_sessions_business_id_idx
  on public.one_off_sessions(business_id);
create index if not exists one_off_sessions_business_status_idx
  on public.one_off_sessions(business_id, status);
create index if not exists one_off_sessions_date_idx
  on public.one_off_sessions(business_id, session_date);

-- ── Session bookings ────────────────────────────────────────────────────────

create table if not exists public.one_off_session_bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.one_off_sessions(id) on delete cascade,
  -- Denormalized for RLS and for business-scoped queries that never need the
  -- session row — same reasoning as marketplace_bookings.business_id.
  business_id uuid not null,

  -- Wall-clock date/time, matching jobs.scheduled_date / jobs.scheduled_time
  -- exactly. The whole platform stores business-local wall time this way;
  -- introducing a timestamptz here would be a second, conflicting convention.
  slot_date date not null,
  slot_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),

  -- Which of the capacity_per_slot seats at this time this booking holds.
  -- 0-based. See the unique index below — this is the concurrency guarantee.
  seat_no integer not null default 0 check (seat_no >= 0),

  customer_id uuid,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  answers jsonb not null default '{}'::jsonb,

  status text not null default 'pending_payment'
    check (status in ('pending_payment','confirmed','cancelled')),

  payment_status text not null default 'none'
    check (payment_status in ('none','pending','paid','failed','refunded')),
  price_cents integer,
  deposit_cents integer,
  amount_paid_cents integer not null default 0,
  currency text not null default 'usd',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,

  -- The real Hubly job this booking becomes once confirmed. Same table the
  -- owner's calendar, Reports, and Google Calendar sync already read.
  job_id uuid,
  confirmation_code text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz
);

comment on table public.one_off_session_bookings is
  'One customer holding one seat at one time inside a One-Off Session. Becomes a real jobs row on confirmation — this table is the session-specific record (seat, answers, payment), never a parallel calendar.';
comment on column public.one_off_session_bookings.seat_no is
  'Zero-based seat within capacity_per_slot at this slot_time. The partial unique index below makes two simultaneous bookers physically unable to take the same seat: the loser gets a unique violation and retries the next free seat, or is honestly told the slot is gone. Cancelling frees the seat back up.';

-- THE double-booking guarantee (§5). Partial so a cancelled booking releases
-- its seat, and scoped to the session so seats never collide across sessions.
create unique index if not exists one_off_session_bookings_seat_uniq
  on public.one_off_session_bookings(session_id, slot_time, seat_no)
  where status <> 'cancelled';

create index if not exists one_off_session_bookings_session_idx
  on public.one_off_session_bookings(session_id);
create index if not exists one_off_session_bookings_business_idx
  on public.one_off_session_bookings(business_id);
create index if not exists one_off_session_bookings_checkout_idx
  on public.one_off_session_bookings(stripe_checkout_session_id);

-- ── jobs linkage ────────────────────────────────────────────────────────────
-- Both the parent block job and each session booking's job carry this, so:
--   * the session's own slot availability can EXCLUDE its own parent block
--     (otherwise the block would make its own slots unbookable), and
--   * closing/cancelling a session can find and clean up its calendar hold.
alter table public.jobs
  add column if not exists one_off_session_id uuid;

comment on column public.jobs.one_off_session_id is
  'The One-Off Session this job belongs to, if any. Set on the session''s parent calendar block (customer_name=''Blocked'') and on each real appointment booked inside it. Null for every normal job — normal booking behavior is completely unchanged.';

create index if not exists jobs_one_off_session_id_idx
  on public.jobs(one_off_session_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Provider-side: business ownership, via the same owns_business() helper every
-- other business-scoped table uses.
--
-- Public/customer side: NO anon policy at all, deliberately. Customers reach a
-- session only through the one-off-sessions Edge Function, which resolves the
-- opaque booking_token server-side and returns a deliberately narrow public
-- projection (never business internals, never other customers' bookings). A
-- readable-by-anon policy would make every published session enumerable, which
-- is exactly what "private/link-only" must not mean.

alter table public.one_off_sessions enable row level security;
alter table public.one_off_session_bookings enable row level security;

drop policy if exists "owner can manage one-off sessions" on public.one_off_sessions;
create policy "owner can manage one-off sessions"
  on public.one_off_sessions
  for all
  to authenticated
  using (owns_business(business_id))
  with check (owns_business(business_id));

drop policy if exists "owner can manage one-off session bookings" on public.one_off_session_bookings;
create policy "owner can manage one-off session bookings"
  on public.one_off_session_bookings
  for all
  to authenticated
  using (owns_business(business_id))
  with check (owns_business(business_id));

-- ── updated_at ──────────────────────────────────────────────────────────────
create or replace function public.touch_one_off_session_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists one_off_sessions_touch_updated_at on public.one_off_sessions;
create trigger one_off_sessions_touch_updated_at
  before update on public.one_off_sessions
  for each row execute function public.touch_one_off_session_updated_at();

drop trigger if exists one_off_session_bookings_touch_updated_at on public.one_off_session_bookings;
create trigger one_off_session_bookings_touch_updated_at
  before update on public.one_off_session_bookings
  for each row execute function public.touch_one_off_session_updated_at();
