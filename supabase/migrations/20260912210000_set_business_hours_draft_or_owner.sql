-- HOURS ARE WRITABLE BEFORE CLAIM, NOT ONLY AFTER.
--
-- `business.setHours` shipped 2026-09-08 with an owner-only guard in its handler:
--
--     if (!ownerUid) return { error: "not_signed_in", … }
--
-- and a writer, set_business_hours(business, owner, hours), gated on
-- hubly_owns_business(). Both were correct for a CLAIMED site and wrong for the state
-- most businesses are in when they first say "we open at 8": an unclaimed draft, no
-- account, a token. Measured before this migration: the draft path returns -1 and the
-- handler refuses without attempting a write at all.
--
-- THE OBVIOUS FIX WAS THE WRONG ONE. set_business_hours_in_progress (4 args) already
-- authorises a draft by token — but it writes ONLY settings_business_hours, not
-- businesses.meta.hours, and meta.hours is the shape a CLASSIC page renders from.
-- Routing drafts there would have reported success and changed nothing a customer sees:
-- the exact defect the setHours comment was written to prevent ("writing only the table
-- would report success and change nothing the owner or his customers can see").
--
-- So ONE writer authorises BOTH ways and writes BOTH stores. One predicate, one place.
--
-- DISTINCT FAILURES GET DISTINCT CODES, because "could not be saved" fits every cause
-- equally and that is how the claimed-owner class stayed invisible for a week:
--    -1  a claimed business, and p_owner_id is not its owner
--    -2  an unclaimed draft, and p_draft_token does not match
--    -3  no such business
--   >=0  rows written
drop function if exists public.set_business_hours(uuid, uuid, jsonb);

create or replace function public.set_business_hours(
  p_business_id uuid, p_owner_id uuid, p_hours jsonb, p_draft_token uuid default null
) returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; cur jsonb; e jsonb; nm text; v_owner uuid; v_token uuid; v_found boolean;
begin
  select owner_id, draft_token, true into v_owner, v_token, v_found
    from public.businesses where id = p_business_id;
  if not coalesce(v_found, false) then return -3; end if;

  if v_owner is null then
    -- UNCLAIMED DRAFT: the token is the authorisation, exactly as every other draft
    -- writer treats it. A null token on a tokenless row must never pass, so both sides
    -- are required to be present and equal.
    if p_draft_token is null or v_token is null or v_token is distinct from p_draft_token then
      return -2;
    end if;
  else
    -- CLAIMED: ownership only, through the one ownership predicate.
    if p_owner_id is null or not public.hubly_owns_business(p_business_id, p_owner_id) then
      return -1;
    end if;
  end if;

  if p_hours is null or jsonb_typeof(p_hours) <> 'array' then return 0; end if;

  insert into public.settings_business_hours (business_id, weekday, open_time, close_time, closed)
  select p_business_id, (x->>'weekday')::int,
         nullif(x->>'open','')::time, nullif(x->>'close','')::time,
         coalesce((x->>'closed')::boolean, false)
  from jsonb_array_elements(p_hours) x
  where (x->>'weekday') ~ '^[0-6]$'
  on conflict (business_id, weekday) do update
    set open_time = excluded.open_time, close_time = excluded.close_time, closed = excluded.closed;
  get diagnostics n = row_count;

  -- …and the shape the page actually renders from.
  select case when jsonb_typeof((meta::jsonb)->'hours')='object' then (meta::jsonb)->'hours' else '{}'::jsonb end
    into cur from public.businesses where id = p_business_id;
  for e in select * from jsonb_array_elements(p_hours) loop
    if (e->>'weekday') ~ '^[0-6]$' then
      nm := (array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[(e->>'weekday')::int + 1];
      cur := cur || jsonb_build_object(nm, jsonb_build_object(
        'open', e->>'open', 'close', e->>'close',
        'closed', coalesce((e->>'closed')::boolean, false)));
    end if;
  end loop;
  update public.businesses
     set meta = (coalesce(meta::jsonb, '{}'::jsonb) || jsonb_build_object('hours', cur))::text
   where id = p_business_id;

  return n;
end;
$$;

revoke all on function public.set_business_hours(uuid, uuid, jsonb, uuid) from public, anon;
grant execute on function public.set_business_hours(uuid, uuid, jsonb, uuid) to authenticated, service_role;

comment on function public.set_business_hours(uuid, uuid, jsonb, uuid) is
  'Writes opening hours to BOTH stores (settings_business_hours and businesses.meta.hours). '
  'Authorises an unclaimed draft by p_draft_token and a claimed business by p_owner_id. '
  'Returns rows written, or -1 not owner, -2 draft token mismatch, -3 no such business.';
