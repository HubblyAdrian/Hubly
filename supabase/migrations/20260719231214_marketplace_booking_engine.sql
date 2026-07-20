-- Phase 4 — Booking Engine (provider-agnostic).
-- Extends marketplace_bookings for real appointments + payment rules.
-- Statuses: requested | confirmed | in_progress | completed | cancelled

-- Customer records created at booking time (lightweight; CRM sync later)
create table if not exists public.marketplace_customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_customers_business_idx
  on public.marketplace_customers (business_id, created_at desc);

create index if not exists marketplace_customers_email_idx
  on public.marketplace_customers (business_id, lower(email))
  where email is not null;

-- Conversation thread stub per booking (messages can expand later)
create table if not exists public.marketplace_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider_id uuid references public.marketplace_providers(id) on delete set null,
  booking_id uuid,
  customer_id uuid references public.marketplace_customers(id) on delete set null,
  subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_conversations_booking_idx
  on public.marketplace_conversations (booking_id)
  where booking_id is not null;

alter table public.marketplace_customers enable row level security;
alter table public.marketplace_conversations enable row level security;

drop policy if exists marketplace_customers_owner_select on public.marketplace_customers;
create policy marketplace_customers_owner_select
  on public.marketplace_customers for select
  to authenticated
  using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists marketplace_conversations_owner_select on public.marketplace_conversations;
create policy marketplace_conversations_owner_select
  on public.marketplace_conversations for select
  to authenticated
  using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

-- Evolve marketplace_bookings toward the single Booking Engine
alter table public.marketplace_bookings
  add column if not exists service_id text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists duration_minutes integer,
  add column if not exists price_cents integer,
  add column if not exists currency text not null default 'usd',
  add column if not exists payment_rule text not null default 'pay_after_service'
    check (payment_rule in ('pay_in_full', 'deposit', 'card_on_file', 'pay_after_service')),
  add column if not exists payment_status text not null default 'none'
    check (payment_status in ('none', 'pending', 'authorized', 'paid', 'failed', 'refunded')),
  add column if not exists deposit_cents integer,
  add column if not exists amount_paid_cents integer not null default 0,
  add column if not exists confirmation_code text,
  add column if not exists channel text not null default 'marketplace'
    check (channel in ('marketplace', 'website', 'ai', 'crm')),
  add column if not exists customer_id uuid references public.marketplace_customers(id) on delete set null,
  add column if not exists conversation_id uuid references public.marketplace_conversations(id) on delete set null,
  add column if not exists job_id uuid,
  add column if not exists calendar_event_id text,
  add column if not exists add_ons jsonb not null default '[]'::jsonb,
  add column if not exists what_happens_next text,
  add column if not exists instant_book boolean not null default false,
  add column if not exists service_snapshot jsonb not null default '{}'::jsonb;

-- Migrate legacy pending → requested; widen status check
update public.marketplace_bookings
  set status = 'requested'
  where status = 'pending';

alter table public.marketplace_bookings drop constraint if exists marketplace_bookings_status_check;
alter table public.marketplace_bookings
  add constraint marketplace_bookings_status_check
  check (status in ('requested', 'confirmed', 'in_progress', 'completed', 'cancelled'));

alter table public.marketplace_bookings
  alter column status set default 'requested';

create unique index if not exists marketplace_bookings_confirmation_code_uidx
  on public.marketplace_bookings (confirmation_code)
  where confirmation_code is not null;

create index if not exists marketplace_bookings_starts_at_idx
  on public.marketplace_bookings (business_id, starts_at)
  where starts_at is not null and status in ('requested', 'confirmed', 'in_progress');

comment on table public.marketplace_bookings is
  'Hubly Booking Engine appointments. Provider-agnostic: service_id + duration + pricing + rules. Catalog lives on businesses.meta.';

comment on table public.marketplace_customers is
  'Lightweight customer records created at marketplace booking time.';

comment on table public.marketplace_conversations is
  'Conversation thread stubs linked to bookings (expand with messages later).';
