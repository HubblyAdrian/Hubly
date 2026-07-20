-- Phase 5 — Marketplace Ops control center (staff-only notes & flags)

create table if not exists public.marketplace_ops_notes (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.marketplace_providers(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  author text not null default 'ops',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_ops_notes_provider_idx
  on public.marketplace_ops_notes (provider_id, created_at desc);

create table if not exists public.marketplace_ops_flags (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.marketplace_providers(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  booking_id uuid references public.marketplace_bookings(id) on delete set null,
  flag_type text not null default 'general'
    check (flag_type in (
      'general',
      'customer_report',
      'provider_report',
      'suspicious',
      'fraud',
      'verification'
    )),
  severity text not null default 'low'
    check (severity in ('low', 'medium', 'high')),
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  summary text not null,
  details text,
  created_by text not null default 'ops',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists marketplace_ops_flags_status_idx
  on public.marketplace_ops_flags (status, created_at desc);

alter table public.marketplace_ops_notes enable row level security;
alter table public.marketplace_ops_flags enable row level security;

-- Staff access via service role only (no authenticated policies by design)

comment on table public.marketplace_ops_notes is
  'Internal Hubly notes on marketplace providers — never shown to providers/customers.';
comment on table public.marketplace_ops_flags is
  'Trust & Safety flags for Marketplace Ops (architecture ready for future moderation).';
