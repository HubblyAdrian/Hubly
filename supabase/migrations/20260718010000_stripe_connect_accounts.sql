-- Stripe Connect Express accounts per Hubly business + booking payment columns.
-- Account rows are service-role only; the browser talks to edge functions.

create table if not exists public.stripe_connect_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  stripe_account_id text not null,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  email text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text,
  constraint stripe_connect_accounts_business_unique unique (business_id),
  constraint stripe_connect_accounts_stripe_unique unique (stripe_account_id)
);

create index if not exists stripe_connect_accounts_owner_idx
  on public.stripe_connect_accounts (owner_id);

comment on table public.stripe_connect_accounts is
  'Per-business Stripe Connect Express account. Never expose secret keys; status via edge functions.';

alter table public.stripe_connect_accounts enable row level security;
-- RLS on, zero policies for anon/authenticated. Edge functions use service role.

-- Payment fields on booking requests (notes tags remain for backward compatibility).
alter table public.booking_requests
  add column if not exists payment_status text not null default 'none',
  add column if not exists amount_due_cents integer,
  add column if not exists amount_paid_cents integer,
  add column if not exists currency text not null default 'usd',
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz;

create index if not exists booking_requests_stripe_session_idx
  on public.booking_requests (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

comment on column public.booking_requests.payment_status is
  'none | pending_checkout | paid | failed | refunded';
