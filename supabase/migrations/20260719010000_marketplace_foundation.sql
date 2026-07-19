-- Marketplace foundation: provider profiles extend businesses (no data duplication).
-- Availability/score engines + marketplace book/request tables live here.
-- Does not alter Hubly CRM tables (jobs/customers) beyond optional FK links.

create table if not exists public.marketplace_providers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,

  -- Listing
  marketplace_enabled boolean not null default false,
  marketplace_status text not null default 'draft'
    check (marketplace_status in ('draft', 'active', 'paused', 'suspended')),
  provider_kind text not null default 'hubly'
    check (provider_kind in ('hubly', 'marketplace_only')),
  category text,

  -- Verification
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  verification_notes text,
  insurance_verified boolean not null default false,
  license_verified boolean not null default false,
  background_check_status text not null default 'none'
    check (background_check_status in ('none', 'pending', 'passed', 'failed')),

  -- Ops signals (calendar_connected is a cache; source of truth is google_calendar_connections)
  calendar_connected boolean not null default false,
  marketplace_score integer not null default 0
    check (marketplace_score >= 0 and marketplace_score <= 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  accepting_new_jobs boolean not null default true,
  instant_booking boolean not null default false,
  accept_quote_requests boolean not null default true,
  featured boolean not null default false,

  -- Performance metrics (updated by scoring / future jobs)
  response_time_minutes integer,
  completion_rate numeric(5,2),
  cancellation_rate numeric(5,2),

  -- Marketplace-specific settings (travel_radius null → businesses.travel_radius_miles)
  travel_radius_miles integer,
  emergency_jobs boolean not null default false,
  weekend_jobs boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settings_updated_at timestamptz,

  constraint marketplace_providers_business_unique unique (business_id)
);

create index if not exists marketplace_providers_enabled_idx
  on public.marketplace_providers (marketplace_enabled, marketplace_status)
  where marketplace_enabled = true;

create index if not exists marketplace_providers_owner_idx
  on public.marketplace_providers (owner_id);

create index if not exists marketplace_providers_score_idx
  on public.marketplace_providers (marketplace_score desc);

create index if not exists marketplace_providers_category_idx
  on public.marketplace_providers (category)
  where category is not null;

comment on table public.marketplace_providers is
  'Marketplace provider profile. References businesses for name/logo/packages/reviews/hours — one source of truth.';

-- Instant book leads (independent of CRM jobs until a later sync step)
create table if not exists public.marketplace_bookings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.marketplace_providers(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  service_name text,
  requested_date date,
  requested_time text,
  address text,
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  booking_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_bookings_provider_idx
  on public.marketplace_bookings (provider_id, created_at desc);

create index if not exists marketplace_bookings_business_idx
  on public.marketplace_bookings (business_id, created_at desc);

-- Quote / contact requests from marketplace
create table if not exists public.marketplace_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.marketplace_providers(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  service_interest text,
  preferred_date date,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'responded', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_requests_provider_idx
  on public.marketplace_requests (provider_id, created_at desc);

-- RLS: owners manage their provider row; public listing goes through edge functions (service role).
alter table public.marketplace_providers enable row level security;
alter table public.marketplace_bookings enable row level security;
alter table public.marketplace_requests enable row level security;

drop policy if exists marketplace_providers_owner_select on public.marketplace_providers;
create policy marketplace_providers_owner_select
  on public.marketplace_providers for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists marketplace_providers_owner_update on public.marketplace_providers;
create policy marketplace_providers_owner_update
  on public.marketplace_providers for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists marketplace_providers_owner_insert on public.marketplace_providers;
create policy marketplace_providers_owner_insert
  on public.marketplace_providers for insert
  to authenticated
  with check (owner_id = auth.uid());

-- Bookings/requests: owners can read their own; inserts via service role (edge).
drop policy if exists marketplace_bookings_owner_select on public.marketplace_bookings;
create policy marketplace_bookings_owner_select
  on public.marketplace_bookings for select
  to authenticated
  using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists marketplace_requests_owner_select on public.marketplace_requests;
create policy marketplace_requests_owner_select
  on public.marketplace_requests for select
  to authenticated
  using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

-- Auto-create a draft provider row when a business is created.
create or replace function public.ensure_marketplace_provider_for_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.marketplace_providers (business_id, owner_id, provider_kind)
  values (new.id, new.owner_id, 'hubly')
  on conflict (business_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_businesses_ensure_marketplace_provider on public.businesses;
create trigger trg_businesses_ensure_marketplace_provider
  after insert on public.businesses
  for each row
  execute function public.ensure_marketplace_provider_for_business();

-- Backfill existing businesses
insert into public.marketplace_providers (business_id, owner_id, provider_kind)
select b.id, b.owner_id, 'hubly'
from public.businesses b
where b.owner_id is not null
on conflict (business_id) do nothing;
