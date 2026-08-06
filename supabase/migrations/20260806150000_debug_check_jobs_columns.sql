-- Diagnostic for the deposits feature: check real jobs table columns before
-- deciding whether payment_status/amount_paid_cents/etc need to be added.
-- jobs has no CREATE TABLE migration anywhere in this repo (created outside
-- version control, same situation as customers earlier). Same discipline as
-- before: introspect the live schema rather than guess. Dropped in a
-- follow-up migration once read.
create or replace function _debug_check_jobs_columns()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'column_name', column_name, 'is_nullable', is_nullable, 'data_type', data_type
  )), '[]'::jsonb)
  from information_schema.columns
  where table_schema='public' and table_name='jobs';
$$;

grant execute on function _debug_check_jobs_columns() to authenticated, anon;
