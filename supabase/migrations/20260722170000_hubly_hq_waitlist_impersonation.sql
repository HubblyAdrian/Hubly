-- Hubly HQ waitlist + impersonation audit support

create table if not exists public.hubly_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  business_idea text,
  industry text,
  city text,
  status text not null default 'waiting'
    check (status in ('waiting', 'invited', 'signed_up', 'activated', 'published', 'subscribed', 'rejected')),
  batch_id text,
  invited_at timestamptz,
  signed_up_at timestamptz,
  activated_at timestamptz,
  published_at timestamptz,
  subscribed_at timestamptz,
  business_id uuid references public.businesses(id) on delete set null,
  notes text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hubly_waitlist_email_uidx
  on public.hubly_waitlist (email);

create index if not exists hubly_waitlist_status_idx
  on public.hubly_waitlist (status, created_at desc);

create index if not exists hubly_waitlist_batch_idx
  on public.hubly_waitlist (batch_id);

comment on table public.hubly_waitlist is
  'Hubly HQ waitlist — invite in batches; track Invited → Signed up → Activated → Published → Subscribed.';

alter table public.hubly_waitlist enable row level security;
-- No client policies — Hubly HQ edge (service role) only.

create table if not exists public.hubly_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  admin_email text not null,
  token_hash text not null,
  reason text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hubly_impersonation_business_idx
  on public.hubly_impersonation_sessions (business_id, created_at desc);

comment on table public.hubly_impersonation_sessions is
  'Hubly HQ impersonation — view-as-customer sessions. All creates logged in admin_audit_log. Read-first; no secret tokens stored plaintext.';

alter table public.hubly_impersonation_sessions enable row level security;
