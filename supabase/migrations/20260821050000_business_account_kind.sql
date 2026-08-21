-- "How many actual customers do we have?" must be one query.
--
-- Founder accounts, test accounts and real signups are indistinguishable in the
-- data today. Working out whether six email addresses were customers or
-- colleagues took an evening; it gets worse the moment real signups arrive mixed
-- in with our own testing.
--
-- account_kind:
--   'real'      a genuine outside signup. THE DEFAULT, so nothing new is
--               miscounted by omission -- a signup we forget to tag counts as a
--               customer, which is the safe direction to be wrong in.
--   'internal'  a founder / team account.
--   'test'      a throwaway, a demo, or a QA account.
--
-- Only 'real' counts as a customer. The default being 'real' means the honest
-- count can only ever be an OVER-count until we tag, never a flattering
-- under-count.

alter table public.businesses
  add column if not exists account_kind text not null default 'real';

alter table public.businesses
  drop constraint if exists businesses_account_kind_check;
alter table public.businesses
  add constraint businesses_account_kind_check
  check (account_kind in ('real', 'internal', 'test'));

comment on column public.businesses.account_kind is
  'Who owns this: real (outside customer, the default), internal (founder/team), '
  'or test (throwaway/demo/QA). Only real counts as a customer. Defaults to real '
  'so an untagged account over-counts rather than hides.';

create index if not exists businesses_account_kind_idx
  on public.businesses (account_kind);
