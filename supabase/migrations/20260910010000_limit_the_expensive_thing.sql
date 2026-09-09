-- LIMIT THE EXPENSIVE THING, NOT THE ROW.
--
-- A businesses row costs nothing. A document generation costs about a thirty-fifth of an
-- OpenAI top-up. The per-IP row cap was standing in for the real cost, and the moment it
-- started working it started hurting: at 10/hour it refused Adrian on his phone at
-- 20:37 because test scripts had spent the ten on that address. Mobile carriers put
-- thousands of subscribers behind one CGNAT address, so ten strangers signing up locks
-- out a whole carrier segment — the better the IP cap works, the more it costs.
--
-- So the per-IP cap becomes a coarse net for crude hammering (30/hour, meant almost never
-- to be felt), and the REAL brake is a global ceiling on generations, set so a full hour
-- at the ceiling costs at most one top-up: 35/hour on today's number.
--
-- The symmetry that falls out: the burn alert fires at 12/hour and the brake engages at
-- 35, so a human hears about it about a third of the way to the wall. That is what an
-- alert is for.

create or replace function public.start_business_in_progress(
  p_name text,
  p_business_type text default null,
  p_client_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_token uuid := gen_random_uuid();
  v_base text;
  v_slug text;
  v_type text;
  v_meta text;
  v_tries int := 0;
  v_ip text;
  v_recent int;
  v_global int;
  v_named boolean;
begin
  v_named := coalesce(trim(p_name), '') <> '';

  -- THE REAL BRAKE: global generations per hour. Every draft created here becomes a
  -- document generation, so the count of brand-new drafts IS the count of generations.
  -- 35/hour is one top-up's worth. Above it we are at capacity — and that is OUR
  -- problem, not the visitor's connection, so it gets its own error and its own words.
  select count(*) into v_global
  from draft_creation_events
  where created_at > now() - interval '1 hour';
  if v_global >= 35 then
    return jsonb_build_object('ok', false, 'error', 'at_capacity',
      'detail', 'Hubly is at capacity for new sites this hour.');
  end if;

  -- THE COARSE NET: 30 per IP per hour. Crude hammering only; its job is to be almost
  -- never felt by a real person, including everyone sharing one carrier address.
  v_ip := coalesce(nullif(trim(coalesce(p_client_ip, '')), ''), _caller_ip());
  if v_ip is not null then
    select count(*) into v_recent
    from draft_creation_events
    where ip = v_ip and created_at > now() - interval '1 hour';
    if v_recent >= 30 then
      return jsonb_build_object('ok', false, 'error', 'rate_limited',
        'detail', 'Too many new sites from this connection in the last hour.');
    end if;
  end if;

  v_type := nullif(trim(coalesce(p_business_type, '')), '');
  v_meta := case when v_type is not null
    then jsonb_build_object('businessType', v_type)::text
    else null end;

  if v_named then
    v_base := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
    v_base := trim(both '-' from v_base);
    if v_base = '' then v_base := 'business'; end if;
    v_base := left(v_base, 40);
  end if;

  loop
    if v_named then
      v_slug := v_base || case when v_tries = 0 then '' else '-' || substr(md5(random()::text), 1, 5) end;
    else
      v_slug := 'site-' || substr(md5(random()::text), 1, 6);
    end if;
    begin
      if v_type is null then
        insert into businesses (name, slug, owner_id, draft_token, name_unset)
        values (case when v_named then trim(p_name) else null end, v_slug, null, v_token, not v_named)
        returning id into v_id;
      else
        insert into businesses (name, slug, business_type, owner_id, draft_token, meta, name_unset)
        values (case when v_named then trim(p_name) else null end, v_slug, v_type, null, v_token, v_meta, not v_named)
        returning id into v_id;
      end if;
      exit;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 6 then
        return jsonb_build_object('ok', false, 'error', 'slug_unavailable');
      end if;
    end;
  end loop;

  -- ONLY A BRAND-NEW DRAFT CONSUMES ALLOWANCE. This row is written only here, at
  -- creation; refining an existing draft never reaches this function, so continuing work
  -- on one site can never exhaust anyone's allowance or the global ceiling.
  if v_ip is not null then
    insert into draft_creation_events (ip) values (v_ip);
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug,
    'draft_token', v_token, 'name_unset', not v_named);
end;
$function$;
