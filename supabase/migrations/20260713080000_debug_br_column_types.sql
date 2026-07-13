create or replace function _debug_br_column_types()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('column_name', column_name, 'data_type', data_type)), '[]'::jsonb)
  from information_schema.columns
  where table_schema='public' and table_name='booking_requests'
    and column_name in ('requested_date','requested_time','address','notes','customer_phone');
$$;
grant execute on function _debug_br_column_types() to authenticated;
