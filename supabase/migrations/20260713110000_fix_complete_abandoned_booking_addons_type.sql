-- Fix for 20260713100000: booking_requests.addons is text[], not jsonb --
-- COALESCE(p_addons, addons) failed with "COALESCE types jsonb and
-- text[] cannot be matched" on the first live end-to-end wizard test.
-- Caught before approval, not after.
create or replace function complete_abandoned_booking(
  p_id uuid,
  p_phone text,
  p_customer_email text default null,
  p_service_name text default null,
  p_addons text[] default null,
  p_vehicle_color text default null,
  p_condition text default null,
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
    customer_email = coalesce(p_customer_email, customer_email),
    service_name = coalesce(p_service_name, service_name),
    addons = coalesce(p_addons, addons),
    vehicle_color = coalesce(p_vehicle_color, vehicle_color),
    condition = coalesce(p_condition, condition),
    notes = coalesce(p_notes, notes),
    requested_date = coalesce(p_requested_date::date, requested_date),
    requested_time = coalesce(p_requested_time, requested_time),
    address = coalesce(p_address, address)
  where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function complete_abandoned_booking(uuid,text,text,text,text[],text,text,text,text,text,text) to anon, authenticated;
revoke all on function complete_abandoned_booking(uuid,text,text,text,text[],text,text,text,text,text,text) from public;

drop function if exists complete_abandoned_booking(uuid,text,text,text,jsonb,text,text,text,text,text,text);
