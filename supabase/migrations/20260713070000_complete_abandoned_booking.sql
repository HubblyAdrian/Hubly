-- Phase 1 item C: narrow SECURITY DEFINER function for the one specific
-- transition an anonymous customer needs -- flipping their own abandoned
-- booking_requests row to 'pending' on real completion -- instead of a
-- broad anon UPDATE grant on the table (exactly the shape of risk
-- tonight's tier-column bug already proved out: a table-level grant is
-- inherited by every future column/use case silently; a purpose-built
-- function only ever does the one thing it was written for).
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
    -- Deliberately uniform failure across all three rejection reasons
    -- (row doesn't exist, phone doesn't match, status isn't 'abandoned')
    -- -- an anonymous caller must not be able to distinguish "that id
    -- doesn't exist" from "that id exists but you got the phone wrong",
    -- which would let IDs be enumerated/probed.
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

grant execute on function complete_abandoned_booking(uuid,text,text,text,text,text) to anon, authenticated;
revoke all on function complete_abandoned_booking(uuid,text,text,text,text,text) from public;
