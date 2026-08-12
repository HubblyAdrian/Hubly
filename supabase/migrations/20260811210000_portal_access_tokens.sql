-- #189: Customer Portal magic-link tokens. The raw token is never
-- stored — only its SHA-256 hash — and verification is always an exact
-- hash comparison, never an existence check (this is the direct fix for
-- the pattern that made the now-removed customers.recurring_token
-- policy unsafe, see the prior migration/commit ba460a8).
--
-- Reusable until expiry (30 days, enforced in application code at
-- issuance) rather than single-use — MVP has no self-serve resend flow,
-- so a single-use token would permanently lock a customer out after
-- their first visit.
--
-- RLS is enabled with deliberately ZERO policies: this table is only
-- ever touched by the customer-portal Edge Function's service-role
-- client, never by an anon or authenticated browser client directly.
create table portal_access_tokens (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  customer_id uuid not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz
);

create index portal_access_tokens_business_id_idx on public.portal_access_tokens using btree (business_id);
create index portal_access_tokens_customer_id_idx on public.portal_access_tokens using btree (customer_id);

alter table portal_access_tokens enable row level security;
-- No policies — default-deny for anon/authenticated. Only the
-- service-role key (used exclusively server-side) can read or write.
