-- ════════════════════════════════════════════════════════════════════════════════════════════
-- THE LEAD GATE: name AND phone  ->  REACHABLE (phone OR email).
--
-- THE DEFECT, MEASURED. The booking wizard's step 3 refuses to advance without a PHONE
-- (`if(!bk-phone.value){toast('Enter your phone number')}`), and writeAbandonedBookingRequest
-- refuses without `name && phone`. So a visitor who would have left an EMAIL ADDRESS gets past
-- nothing and we store NOTHING — the lead is not lost in the list, it never existed. The row we
-- surface on the leads list says "no phone or email on this one" for a different reason entirely
-- (an abandoned row written before an email was typed); this migration is about the people who
-- never got a row at all.
--
-- WHAT THIS ADDS, and nothing else (docs/ABANDONED_BOOKING_TRACE.md is the spec):
--
--   visitor_key    an opaque per-browser id. DEDUPE ONLY. One visitor abandoning three times is
--                  ONE lead — the same disease as apollo-weeds renaming three times in 108
--                  seconds: a burst is one intention, not three events.
--   furthest_step  1-4, in the owner's language (Package / When & where / Your info / Review) —
--                  "here is how far they got", which is what makes the call honest.
--   became_lead    whether it passed the reachable gate. A name-only attempt is a SIGNAL and is
--                  recorded as one; it is never a row in the leads list, where it would look
--                  followable. Adrian: "Name-only is a signal, never a leads row."
--   reached_by     'phone' | 'email' | 'both' | 'none' — the gate's own answer, stored, so the
--                  leads reader never re-derives it and cannot disagree with the writer.
--
-- IT DOES NOT ADD: an IP, a device string, a user agent, a page-view history. A notification may
-- not report a fact the system never captured, and the same rule binds the record itself.
--
-- NOTHING IS BACKFILLED. 141 abandoned rows exist (125 of them the paging fixture) and inventing a
-- furthest_step or a reached_by for a row written before either column existed would be exactly the
-- fabricated-field defect. They stay NULL, and a NULL is read as "we did not capture this", never
-- as a zero.
-- ════════════════════════════════════════════════════════════════════════════════════════════

alter table public.booking_requests add column if not exists visitor_key text;
alter table public.booking_requests add column if not exists furthest_step smallint;
alter table public.booking_requests add column if not exists became_lead boolean;
alter table public.booking_requests add column if not exists reached_by text;

-- The dedupe key. Partial, because the overwhelming majority of rows have no visitor_key and never
-- will (every row written before today), and an index over 141 NULLs is a lie about its own cost.
create index if not exists booking_requests_visitor_dedupe
  on public.booking_requests (business_id, visitor_key)
  where visitor_key is not null and status = 'abandoned';

comment on column public.booking_requests.visitor_key is
  'Opaque per-browser id, DEDUPE ONLY. Never a person, never joined to anything.';
comment on column public.booking_requests.became_lead is
  'Passed the reachable gate (phone OR email). false = a signal, not a lead; excluded from the leads list.';
comment on column public.booking_requests.reached_by is
  'phone | email | both | none — the gate''s own answer, stored so no reader re-derives it.';

-- ── THE UPSERT. ONE ATTEMPT, ONE ROW. ──────────────────────────────────────────────────────
--
-- Called by the wizard from the visitor's own browser (anon), same shape as the
-- complete_abandoned_booking / update_abandoned_booking_lead pair that already live here:
-- SECURITY DEFINER, narrow, and it can only ever touch a row it created for this visitor_key.
--
-- VALUES ARE STORED VERBATIM. The visitor typed them; no normalising, no completing, no
-- "cleaning". A phone that looks wrong is stored as typed and shown as typed — a corrected phone
-- number is a number nobody gave us. There is no model in this path and grounding does not apply
-- (docs/ABANDONED_BOOKING_TRACE.md).
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
  p_notes text default null
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
  -- A business that does not exist is not an error to explain to a visitor, but it must not
  -- silently succeed either (no step assumes a previous step succeeded).
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

  -- NOTHING AT ALL IS NOT AN ATTEMPT. No name, no phone, no email — there is nothing to record and
  -- nothing to follow up; writing a row would be recording that a browser existed.
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
    -- ONE INTENTION, ONE ROW. A visitor who advances, goes back, and advances again updates the row
    -- they already have. AND A CLEARED FIELD CLEARS THE STORED VALUE: what is on the form at the
    -- step boundary IS the record, so going back and emptying the phone removes the stored phone
    -- rather than leaving yesterday's value behind. That is the leg that separates this from a
    -- keystroke capture, which passes "typed then cleared" and fails "advanced then cleared".
    update public.booking_requests
       set customer_name  = coalesce(v_name, 'Someone'),
           customer_phone = coalesce(v_phone, case when v_email is not null then 'email:' || v_email else '' end),
           customer_email = v_email,
           -- WHAT THE VISITOR TYPES ON THIS STEP IS OVERWRITTEN UNCONDITIONALLY (name, phone,
           -- email above) — that is the cleared-field rule. What they chose on an EARLIER step is
           -- coalesced, because it is not on screen at this boundary and a call that does not carry
           -- it is not the visitor clearing it. Two different rules on purpose, and this is which.
           service_name   = coalesce(p_service_name, service_name),
           requested_date = coalesce(p_requested_date, requested_date),
           -- NO CAST, AND THE TYPE WAS CHECKED RATHER THAN ASSUMED. `booking_requests.requested_time`
           -- is **text**, not `time` — the `jobs` table's `scheduled_time` is the one that is `time`,
           -- and writing `::time` here because of that neighbour produced
           -- "COALESCE types time without time zone and text cannot be matched" on the first run.
           -- Two tables, two types for one idea; the column was read, not inferred.
           requested_time = coalesce(nullif(btrim(coalesce(p_requested_time,'')),''), requested_time),
           address        = coalesce(nullif(btrim(coalesce(p_address,'')),''), address),
           notes          = coalesce(p_notes, notes),
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
     requested_date, requested_time, address, notes, status, furthest_step, became_lead, reached_by)
  values
    (p_business_id, p_visitor_key, coalesce(v_name, 'Someone'),
     coalesce(v_phone, case when v_email is not null then 'email:' || v_email else '' end),
     v_email, p_service_name, p_requested_date,
     nullif(btrim(coalesce(p_requested_time,'')),''), nullif(btrim(coalesce(p_address,'')),''),
     p_notes, 'abandoned', p_furthest_step, v_lead, v_reach)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'inserted', true,
                            'became_lead', v_lead, 'reached_by', v_reach);
end;
$$;

grant execute on function public.record_booking_attempt(uuid,text,smallint,text,text,text,text,date,text,text,text) to anon, authenticated;
revoke all on function public.record_booking_attempt(uuid,text,smallint,text,text,text,text,date,text,text,text) from public;
