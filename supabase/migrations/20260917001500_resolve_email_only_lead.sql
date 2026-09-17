-- ════════════════════════════════════════════════════════════════════════════════════════════
-- AN EMAIL-ONLY LEAD MUST RESOLVE INTO ITS BOOKING. Adrian, 2026-09-16: "resolve into the booking
-- if they finish."
--
-- THE DEFECT THE LEAD GATE CREATES IF THIS IS NOT FIXED. `complete_abandoned_booking` matches the
-- row on PHONE DIGITS:
--
--     regexp_replace(v_row.customer_phone,'\D','','g')
--       is distinct from regexp_replace(coalesce(p_phone,''),'\D','','g')
--
-- Now that a visitor can get through on an email alone, the row's `customer_phone` holds the marker
-- `email:someone@example.com` — which has NO DIGITS. Two consequences, and the second is the bad one:
--
--   · If they finish WITHOUT adding a phone, both sides reduce to the empty string and the guard
--     passes BY ACCIDENT. It works, but it works by luck about two blanks being equal, which is not
--     a thing to build a resolution path on.
--   · If they come back and DO add a phone — the same field, one step later — `p_phone` has digits,
--     the stored marker has none, the guard REJECTS, and the caller falls back to a fresh insert.
--     The abandoned row stays abandoned and the owner now has TWO records for one customer: a lead
--     he chases and a booking she already made. That is the duplicate-lead defect, manufactured by
--     the gate we just widened.
--
-- So the match becomes: the phone digits agree (unchanged for every existing row), OR the row is an
-- email-only row and THIS EMAIL is the one it holds. Still a match on something the visitor
-- supplied; still narrow; nothing else about the guard moves.
--
-- WHY NOT DROP THE PHONE MATCH. The row id is generated in the visitor's browser and
-- booking_requests has no anon SELECT policy, so the id is not enumerable — but "not enumerable" is
-- an argument about difficulty, and the second factor costs nothing to keep.
-- ════════════════════════════════════════════════════════════════════════════════════════════
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
  p_address text default null,
  p_deposit_cents integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row booking_requests%rowtype;
  v_digits_match boolean;
  v_email_match boolean;
begin
  select * into v_row from booking_requests where id = p_id;

  if not found or v_row.status is distinct from 'abandoned' or v_row.customer_phone is null then
    return jsonb_build_object('ok', false, 'error', 'not_resumable');
  end if;

  v_digits_match := regexp_replace(v_row.customer_phone, '\D', '', 'g')
                    = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
                    and regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') <> '';

  -- THE EMAIL-ONLY ROW, MATCHED ON THE EMAIL IT ACTUALLY HOLDS. Compared case-insensitively and
  -- trimmed, because an email address is not case-sensitive in its domain and a visitor who types
  -- "Dana@Example.com" on the way back is the same person. Never matched on an empty value: two
  -- blanks agreeing is not evidence of anything.
  v_email_match := v_row.customer_phone like 'email:%'
                   and nullif(btrim(lower(coalesce(p_customer_email, ''))), '') is not null
                   and btrim(lower(substring(v_row.customer_phone from 7))) = btrim(lower(coalesce(p_customer_email, '')))
                   ;

  -- AND THE ACCIDENTAL BLANK MATCH IS NOW EXPLICIT INSTEAD OF IMPLICIT. A row with a digit-less
  -- phone and a caller with no phone resolves only when the row is an email row AND the email
  -- agrees; "both empty" on its own no longer opens the door.
  if not (v_digits_match or v_email_match) then
    return jsonb_build_object('ok', false, 'error', 'contact_mismatch');
  end if;

  update booking_requests set
    status = 'pending',
    customer_email = coalesce(p_customer_email, customer_email),
    -- IF THEY ADDED A REAL PHONE ON THE WAY BACK, THE MARKER IS REPLACED BY IT. Leaving
    -- `email:someone@example.com` in the phone column of a CONFIRMED booking would hand the owner a
    -- booking he cannot call, with a string that looks like a bug.
    customer_phone = case
      when regexp_replace(coalesce(p_phone,''), '\D', '', 'g') <> '' then p_phone
      else customer_phone end,
    service_name = coalesce(p_service_name, service_name),
    addons = coalesce(p_addons, addons),
    vehicle_color = coalesce(p_vehicle_color, vehicle_color),
    condition = coalesce(p_condition, condition),
    notes = coalesce(p_notes, notes),
    requested_date = coalesce(p_requested_date::date, requested_date),
    requested_time = coalesce(p_requested_time, requested_time),
    address = coalesce(p_address, address),
    deposit_cents = p_deposit_cents
  where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function complete_abandoned_booking(uuid,text,text,text,text[],text,text,text,text,text,text,integer) to anon, authenticated;
revoke all on function complete_abandoned_booking(uuid,text,text,text,text[],text,text,text,text,text,text,integer) from public;
