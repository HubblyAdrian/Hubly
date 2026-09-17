-- ════════════════════════════════════════════════════════════════════════════════════════════
-- record_booking_attempt, WITH EVERY FIELD THE WIZARD ALREADY CAPTURES.
--
-- WHY THIS EXISTS SEPARATELY. 20260916230000 added the gate and a narrow upsert, and then the
-- reason the upsert must be the ONLY write path turned up in a comment in public/hubly.html:
--
--     "sidestepping the RLS-under-RETURNING gap booking_requests has for anon
--      (no SELECT policy, confirmed earlier tonight)"
--
-- **Anon cannot SELECT from booking_requests.** So a browser cannot look for the row it wrote
-- last visit, which means dedupe across reloads is impossible client-side and has to live in a
-- SECURITY DEFINER function. That is not a preference; it is the only place the lookup can happen.
--
-- And if this is the write path, it must carry everything the old insert carried, or moving to it
-- would LOSE the vehicle details and the SMS consent record on every partial attempt — a fix that
-- silently drops facts we already had is worse than the gap it closes.
--
-- The consent columns are written EXACTLY as bkConsentColumns() composes them, including
-- sms_marketing_consent = false always: "text me updates about my booking" cannot authorise
-- promotional sends, and marketing consent is never inferred from the booking box.
-- ════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.record_booking_attempt(
  p_business_id uuid,
  p_visitor_key text,
  p_furthest_step smallint,
  p_name text default null,
  p_phone text default null,
  p_email text default null,
  p_service_name text default null,
  p_requested_date date default null,
  p_requested_time text default null,
  p_address text default null,
  p_notes text default null,
  p_addons text[] default null,
  p_vehicle_type text default null,
  p_vehicle_year text default null,
  p_vehicle_make text default null,
  p_vehicle_model text default null,
  p_vehicle_color text default null,
  p_sms_consent boolean default false,
  p_sms_consent_text text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_existing public.booking_requests;
  v_reach text;
  v_lead boolean;
  v_id uuid;
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_name  text := nullif(btrim(coalesce(p_name , '')), '');
begin
  if p_business_id is null or nullif(btrim(coalesce(p_visitor_key,'')),'') is null then
    return jsonb_build_object('ok', false, 'error', 'no_visitor_key');
  end if;
  if not exists (select 1 from public.businesses b where b.id = p_business_id) then
    return jsonb_build_object('ok', false, 'error', 'no_business');
  end if;

  -- THE GATE, IN ONE PLACE. Reachable = phone OR email. Name is enrichment: he cannot call "Mike".
  v_reach := case
    when v_phone is not null and v_email is not null then 'both'
    when v_phone is not null then 'phone'
    when v_email is not null then 'email'
    else 'none' end;
  v_lead := v_reach <> 'none';

  if v_name is null and not v_lead then
    return jsonb_build_object('ok', false, 'error', 'nothing_provided');
  end if;

  select * into v_existing
    from public.booking_requests
   where business_id = p_business_id
     and visitor_key = p_visitor_key
     and status = 'abandoned'
   order by created_at desc
   limit 1;

  if v_existing.id is not null then
    -- ONE INTENTION, ONE ROW — and what is on the form at the step boundary IS the record. A
    -- visitor who advances, goes back and empties the phone has their stored phone REMOVED, not
    -- left behind; that is the leg a keystroke capture fails.
    update public.booking_requests
       set customer_name  = coalesce(v_name, 'Someone'),
           customer_phone = coalesce(v_phone, case when v_email is not null then 'email:' || v_email else '' end),
           customer_email = v_email,
           -- EARLIER-STEP CHOICES ARE COALESCED, not overwritten: they are not on screen at this
           -- boundary, so a call that does not carry one is not the visitor clearing it. The
           -- contact fields above are the opposite, on purpose, and that is the whole distinction.
           service_name   = coalesce(p_service_name, service_name),
           addons         = coalesce(p_addons, addons),
           vehicle_type   = coalesce(nullif(btrim(coalesce(p_vehicle_type ,'')),''), vehicle_type),
           vehicle_year   = coalesce(nullif(btrim(coalesce(p_vehicle_year ,'')),''), vehicle_year),
           vehicle_make   = coalesce(nullif(btrim(coalesce(p_vehicle_make ,'')),''), vehicle_make),
           vehicle_model  = coalesce(nullif(btrim(coalesce(p_vehicle_model,'')),''), vehicle_model),
           vehicle_color  = coalesce(nullif(btrim(coalesce(p_vehicle_color,'')),''), vehicle_color),
           requested_date = coalesce(p_requested_date, requested_date),
           requested_time = coalesce(nullif(btrim(coalesce(p_requested_time,'')),''), requested_time),
           address        = coalesce(nullif(btrim(coalesce(p_address,'')),''), address),
           notes          = coalesce(p_notes, notes),
           -- CONSENT IS ONLY EVER RAISED, NEVER LOWERED BY AN UPDATE THAT DID NOT ASK. A later call
           -- with the box unticked because the step was not on screen must not revoke a consent the
           -- visitor gave — and a consent we cannot evidence is one we do not claim.
           sms_consent      = coalesce(v_existing.sms_consent, false) or coalesce(p_sms_consent, false),
           sms_consent_at   = case when coalesce(p_sms_consent,false) and v_existing.sms_consent is not true
                                   then now() else v_existing.sms_consent_at end,
           sms_consent_text = case when coalesce(p_sms_consent,false) and v_existing.sms_consent is not true
                                   then nullif(btrim(coalesce(p_sms_consent_text,'')),'') else v_existing.sms_consent_text end,
           furthest_step  = greatest(coalesce(furthest_step, 0), coalesce(p_furthest_step, 0)),
           became_lead    = v_lead,
           reached_by     = v_reach
     where id = v_existing.id
    returning id into v_id;
    return jsonb_build_object('ok', true, 'id', v_id, 'updated', true,
                              'became_lead', v_lead, 'reached_by', v_reach);
  end if;

  insert into public.booking_requests
    (business_id, visitor_key, customer_name, customer_phone, customer_email, service_name,
     addons, vehicle_type, vehicle_year, vehicle_make, vehicle_model, vehicle_color,
     requested_date, requested_time, address, notes, status, furthest_step, became_lead, reached_by,
     sms_consent, sms_consent_at, sms_consent_text, sms_marketing_consent)
  values
    (p_business_id, p_visitor_key, coalesce(v_name, 'Someone'),
     coalesce(v_phone, case when v_email is not null then 'email:' || v_email else '' end),
     v_email, p_service_name,
     p_addons,
     nullif(btrim(coalesce(p_vehicle_type ,'')),''), nullif(btrim(coalesce(p_vehicle_year ,'')),''),
     nullif(btrim(coalesce(p_vehicle_make ,'')),''), nullif(btrim(coalesce(p_vehicle_model,'')),''),
     nullif(btrim(coalesce(p_vehicle_color,'')),''),
     p_requested_date, nullif(btrim(coalesce(p_requested_time,'')),''),
     nullif(btrim(coalesce(p_address,'')),''), p_notes, 'abandoned',
     p_furthest_step, v_lead, v_reach,
     coalesce(p_sms_consent, false),
     case when coalesce(p_sms_consent,false) then now() else null end,
     case when coalesce(p_sms_consent,false) then nullif(btrim(coalesce(p_sms_consent_text,'')),'') else null end,
     false)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'inserted', true,
                            'became_lead', v_lead, 'reached_by', v_reach);
end;
$$;

-- The 11-arg signature from 20260916230000 is dropped so there is ONE function and no chance of a
-- caller binding the short one and silently losing the vehicle and consent fields.
drop function if exists public.record_booking_attempt(uuid,text,smallint,text,text,text,text,date,text,text,text);

grant execute on function public.record_booking_attempt(uuid,text,smallint,text,text,text,text,date,text,text,text,text[],text,text,text,text,text,boolean,text) to anon, authenticated;
revoke all on function public.record_booking_attempt(uuid,text,smallint,text,text,text,text,date,text,text,text,text[],text,text,text,text,text,boolean,text) from public;
