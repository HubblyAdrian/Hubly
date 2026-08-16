-- ============================================================================
-- PASTE-INTO-SQL-EDITOR: remove the 'detailing' default from businesses.business_type
--
-- Mirrors supabase/migrations/20260815170000_business_type_no_detailing_default.sql.
-- Safe to run by hand: both ALTERs are idempotent (dropping an absent default or
-- an absent NOT NULL is a no-op, not an error), so re-running this, or later
-- running `supabase db push` with the migration file, does nothing further.
--
-- This does NOT touch a single existing row. It only stops NEW inserts from
-- silently asserting that a business details cars.
-- ============================================================================

begin;

alter table public.businesses
  alter column business_type drop default;

alter table public.businesses
  alter column business_type drop not null;

comment on column public.businesses.business_type is
  'Trade/industry id, matching a Business Blueprint (detailing, photography, hvac, ...). '
  'NULL means NOT KNOWN — never guess a value here and never default it to a real trade. '
  'Clients resolve NULL to the neutral "generic" blueprint; the server resolves it to no '
  'Business DNA at all, which makes the AI say it does not know the industry.';

commit;
