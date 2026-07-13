-- Phase 1 item C follow-up: found via explicit pre-commit verification
-- that navigating back to Step 3 and changing name/phone left the
-- already-written abandoned row stale (the write-once guard prevented
-- any update), so completion's phone-match check against the STALE
-- stored phone failed and fell back to a fresh insert -- recreating the
-- exact "second stale row" problem this feature exists to avoid.
--
-- Same security shape as complete_abandoned_booking(): SECURITY DEFINER,
-- requires the OLD (already-stored) phone as proof of ownership before
-- allowing any change, only touches rows still in 'abandoned' status
-- (once flipped to 'pending' it's permanently off-limits to this
-- function), one uniform {ok:false} for every rejection reason.
create or replace function update_abandoned_booking_lead(
  p_id uuid,
  p_old_phone text,
  p_name text default null,
  p_phone text default null,
  p_email text default null,
  p_service_name text default null,
  p_vehicle_type text default null,
  p_vehicle_year text default null,
  p_vehicle_make text default null,
  p_vehicle_model text default null,
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
     or regexp_replace(v_row.customer_phone, '\D', '', 'g') is distinct from regexp_replace(coalesce(p_old_phone,''), '\D', '', 'g')
  then
    return jsonb_build_object('ok', false);
  end if;

  update booking_requests set
    customer_name = coalesce(p_name, customer_name),
    customer_phone = coalesce(p_phone, customer_phone),
    customer_email = coalesce(p_email, customer_email),
    service_name = coalesce(p_service_name, service_name),
    vehicle_type = coalesce(p_vehicle_type, vehicle_type),
    vehicle_year = coalesce(p_vehicle_year, vehicle_year),
    vehicle_make = coalesce(p_vehicle_make, vehicle_make),
    vehicle_model = coalesce(p_vehicle_model, vehicle_model),
    requested_date = coalesce(p_requested_date::date, requested_date),
    requested_time = coalesce(p_requested_time, requested_time),
    address = coalesce(p_address, address)
  where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function update_abandoned_booking_lead(uuid,text,text,text,text,text,text,text,text,text,text,text,text) to anon, authenticated;
revoke all on function update_abandoned_booking_lead(uuid,text,text,text,text,text,text,text,text,text,text,text,text) from public;
