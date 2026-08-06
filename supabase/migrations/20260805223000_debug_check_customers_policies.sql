-- Diagnostic for the "Could not save customer" silent-failure bug reported
-- by the user (real screenshot: booking confirmation shows, then a black
-- toast fires). Reproduced directly: an anon insert into public.customers
-- with the exact payload shape upsertCustomer() sends returns
-- 42501 "new row violates row-level security policy for table customers".
-- customers has no CREATE TABLE/policy migration anywhere in this repo
-- (created outside version control), so introspecting the live policy set
-- before writing a fix rather than guessing — same discipline already
-- established in this repo for booking_requests (see
-- 20260712200000_debug_booking_requests_insert_policy.sql). Dropped in a
-- follow-up migration once read.
create or replace function _debug_check_customers_policies()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'policies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'policyname', policyname, 'cmd', cmd, 'roles', roles,
        'permissive', permissive, 'qual', qual, 'with_check', with_check
      )), '[]'::jsonb)
      from pg_policies where schemaname='public' and tablename='customers'
    ),
    'rls_enabled', (
      select relrowsecurity from pg_class where relname='customers' and relnamespace='public'::regnamespace
    ),
    'columns', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'column_name', column_name, 'is_nullable', is_nullable, 'data_type', data_type, 'column_default', column_default
      )), '[]'::jsonb)
      from information_schema.columns
      where table_schema='public' and table_name='customers'
    )
  );
$$;

grant execute on function _debug_check_customers_policies() to authenticated, anon;
