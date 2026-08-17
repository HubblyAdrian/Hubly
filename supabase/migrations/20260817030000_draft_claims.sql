-- draft_claims — the server-side binding that lets a claim survive the round trip.
--
-- A stranger builds a live site by talking to Hubly. It exists with a
-- draft_token and no owner. To keep it they give an email, click a magic link,
-- and come back — possibly on a different device, which is the common case:
-- build on a laptop, open the mail on a phone.
--
-- Nothing in the browser can carry the claim across that gap. The httpOnly
-- cookie is host-only on myhubly.app and does not exist on the phone. So the
-- binding lives here instead: at the moment the email is requested, the server
-- records "this email may claim this business", and completing it later needs
-- only a verified session for that address.
--
-- This is also what makes the flow safe. Two independent facts are required:
--   1. possession of the draft session cookie  -> you built this
--   2. control of the email inbox              -> the address is yours
-- Neither alone claims anything.

create table if not exists public.draft_claims (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  email        text not null,
  created_at   timestamptz not null default now(),
  -- Short by design. A claim link that still works next week is a claim link
  -- someone else can find in a forwarded email.
  expires_at   timestamptz not null default (now() + interval '24 hours'),
  claimed_at   timestamptz,
  claimed_by   uuid
);

comment on table public.draft_claims is
  'Pending claims of unowned draft businesses. Written when the magic link is '
  'requested, consumed when the verified user returns. Exists because the claim '
  'must survive opening the email on a different device, where no browser state '
  'from the build can reach.';

comment on column public.draft_claims.email is
  'Lower-cased. Matched against the authenticated user''s verified email at '
  'finish — never trusted from the client at that point.';

comment on column public.draft_claims.claimed_at is
  'Set once. A row with claimed_at is spent and cannot claim again, so a '
  'forwarded or replayed link does nothing.';

create index if not exists draft_claims_email_open_idx
  on public.draft_claims (lower(email))
  where claimed_at is null;

create index if not exists draft_claims_business_idx
  on public.draft_claims (business_id);

-- No RLS policies are granted to anon or authenticated on purpose: this table is
-- touched exclusively by the service role inside the claim Edge Function. A
-- client that could read it could enumerate which businesses are claimable and
-- by whom.
alter table public.draft_claims enable row level security;

select 'draft_claims created' as status,
       (select count(*) from public.draft_claims) as rows;
