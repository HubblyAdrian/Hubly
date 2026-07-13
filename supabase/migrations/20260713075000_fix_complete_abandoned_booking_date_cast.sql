-- Fix for 20260713070000: requested_date is a real `date` column, not
-- text -- COALESCE(p_requested_date, requested_date) failed with
-- "COALESCE types text and date cannot be matched" on the very first live
-- test. Caught before approval, not after.
create or replace function complete_abandoned_booking(
  p_id uuid,
  p_phone text,
  p_notes text default null,
  p_requested_date text default null,
  p_requested_time text default null,
  p_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row booking_requests%rowtype;
begin
  select * into v_row from booking_requests where id = p_id;

  if not found
     or v_row.status is distinct from 'abandoned'
     or v_row.customer_phone is null
     or regexp_replace(v_row.customer_phone, '\D', '', 'g') is distinct from regexp_replace(coalesce(p_phone,''), '\D', '', 'g')
  then
    return jsonb_build_object('ok', false);
  end if;

  update booking_requests set
    status = 'pending',
    notes = coalesce(p_notes, notes),
    requested_date = coalesce(p_requested_date::date, requested_date),
    requested_time = coalesce(p_requested_time, requested_time),
    address = coalesce(p_address, address)
  where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;
