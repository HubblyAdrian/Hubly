-- ONE SOURCE OF TRUTH FOR "UNNAMED", AND A ROW THAT SAYS WHEN IT CHANGED.
--
-- (a) site-0d4b70 held name = 'James famous photography' AND name_unset = true. Two
-- sources of truth for one fact, disagreeing. The bug is not the missing write that would
-- have cleared the flag — it is that a second source exists at all, so somebody has to
-- remember to clear it in a fifth place and one day will not. A business is unnamed if and
-- only if its name is null or blank, so DERIVE it and the disagreement becomes impossible.
--
-- If we ever need "we asked and they declined" — a genuinely different fact — that gets
-- its own honestly-named column. Overloading one flag with two meanings is how this drifted.
--
-- (d) businesses had no updated_at, so "when did this row last change" was unanswerable —
-- the first question the site-0d4b70 forensics needed.

-- Writers must go before the column can be derived.
drop function if exists public.set_business_name_unset(uuid, uuid, uuid, boolean);
drop function if exists public.set_business_name_unset(uuid, uuid, boolean);

alter table public.businesses drop column if exists name_unset;
alter table public.businesses
  add column name_unset boolean
  generated always as (name is null or btrim(name) = '') stored;

-- (d) When did this row last change?
alter table public.businesses add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists businesses_touch_updated_at on public.businesses;
create trigger businesses_touch_updated_at
  before update on public.businesses
  for each row execute function public.touch_updated_at();

-- start_business_in_progress must stop writing the now-generated column.
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
  v_id uuid; v_token uuid := gen_random_uuid();
  v_base text; v_slug text; v_type text; v_meta text;
  v_tries int := 0; v_ip text; v_recent int; v_global int; v_named boolean;
begin
  v_named := coalesce(trim(p_name), '') <> '';

  -- THE REAL BRAKE: 35 generations/hour is one top-up's worth. Ours, not theirs.
  select count(*) into v_global from draft_creation_events where created_at > now() - interval '1 hour';
  if v_global >= 35 then
    return jsonb_build_object('ok', false, 'error', 'at_capacity',
      'detail', 'Hubly is at capacity for new sites this hour.');
  end if;

  -- THE COARSE NET: 30/IP/hour, crude hammering only. At 10 it refused a real visitor on
  -- a carrier address because test scripts had spent the allowance.
  v_ip := coalesce(nullif(trim(coalesce(p_client_ip, '')), ''), _caller_ip());
  if v_ip is not null then
    select count(*) into v_recent from draft_creation_events
     where ip = v_ip and created_at > now() - interval '1 hour';
    if v_recent >= 30 then
      return jsonb_build_object('ok', false, 'error', 'rate_limited',
        'detail', 'Too many new sites from this connection in the last hour.');
    end if;
  end if;

  v_type := nullif(trim(coalesce(p_business_type, '')), '');
  v_meta := case when v_type is not null then jsonb_build_object('businessType', v_type)::text else null end;

  if v_named then
    v_base := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
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
      -- name_unset is DERIVED now; writing it would error. It follows from name alone.
      if v_type is null then
        insert into businesses (name, slug, owner_id, draft_token)
        values (case when v_named then trim(p_name) else null end, v_slug, null, v_token)
        returning id into v_id;
      else
        insert into businesses (name, slug, business_type, owner_id, draft_token, meta)
        values (case when v_named then trim(p_name) else null end, v_slug, v_type, null, v_token, v_meta)
        returning id into v_id;
      end if;
      exit;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 6 then return jsonb_build_object('ok', false, 'error', 'slug_unavailable'); end if;
    end;
  end loop;

  -- Only a brand-new draft consumes allowance; continuations never reach here.
  if v_ip is not null then insert into draft_creation_events (ip) values (v_ip); end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug,
    'draft_token', v_token, 'name_unset', not v_named);
end;
$function$;
