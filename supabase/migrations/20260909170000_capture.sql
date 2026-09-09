-- ═══════════════════════════════════════════════════════════════════════════════
-- CAPTURE — one box, three kinds, and identity the owner asserts.
--
-- IDENTITY, AND WHY THIS IS NOT THE CUSTOMER RESOLVER.
-- Name is never a match key: that is what keeps two Chris Alvarezes apart, and it is
-- not negotiable. But an owner typing "Leslie Ammons" KNOWS who he means, and refusing
-- to use that would make manual entry useless.
--
-- So the asymmetry is: THE OWNER MAY ASSERT IDENTITY, THE SYSTEM MAY NOT INFER IT.
-- This function never picks. It reports what it found and the caller asks:
--   one match     -> offer it, he confirms
--   several       -> ask which
--   none          -> create
-- Never a silent match, and never a second Leslie because he typed it differently.
create or replace function public.find_customer_candidates(
  p_business_id uuid, p_owner_id uuid, p_name text
) returns table (id uuid, name text, phone text, email text, last_seen date, visits integer)
language sql stable security definer set search_path = public as $$
  with owned as (select public.hubly_owns_business(p_business_id, p_owner_id) as ok),
  n as (select lower(btrim(coalesce(p_name,''))) as q)
  select c.id, c.name, c.phone, c.email,
         (select max(j.scheduled_date) from public.jobs j
            where j.business_id = p_business_id and not j.is_block and j.customer_id = c.id),
         (select count(*)::int from public.jobs j
            where j.business_id = p_business_id and not j.is_block and j.customer_id = c.id)
  from public.customers c, owned, n
  where owned.ok and c.business_id = p_business_id and n.q <> ''
    -- Exact, then prefix, then contained. All three are the OWNER's assertion being
    -- looked up, not the system deciding two rows are one person.
    and (lower(btrim(c.name)) = n.q
      or lower(btrim(c.name)) like n.q || '%'
      or lower(btrim(c.name)) like '%' || n.q || '%')
  order by (lower(btrim(c.name)) = n.q) desc, length(c.name), c.created_at;
$$;

-- THE WRITER. Job, block or task from one call.
--
-- THE DURATION ASSUMPTION IS RETURNED, NEVER SWALLOWED. When no end is given the job
-- gets 2 hours — the same default the availability engine has always applied silently —
-- and this hands back assumed_duration so the reply can SAY so. Quietly blocking two
-- hours of a man's day without telling him is the defect; assuming and stating it is
-- how capture stays frictionless and honest at the same time.
create or replace function public.capture_planner_item(
  p_business_id uuid, p_owner_id uuid,
  p_kind text,                       -- 'job' | 'block' | 'task'
  p_title text,                      -- service, block reason, or task title
  p_date date default null,
  p_start time default null,
  p_duration_minutes integer default null,
  p_customer_id uuid default null,   -- only when the OWNER confirmed which person
  p_customer_name text default null, -- only used when creating a new customer
  p_amount numeric default null,
  p_band text default 'B',
  p_band_reason text default null,
  p_lane text default 'work',
  p_notes text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dur integer; v_assumed boolean := false; v_id uuid; v_cust uuid := p_customer_id;
begin
  if not public.hubly_owns_business(p_business_id, p_owner_id) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  if coalesce(btrim(p_title), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'no_title');
  end if;

  if p_kind = 'task' then
    return public.create_task(p_business_id, p_owner_id, p_title, p_date, p_start,
                              p_duration_minutes, p_band, p_band_reason, p_lane, p_notes)
           || jsonb_build_object('kind', 'task');
  end if;

  if p_kind not in ('job','block') then
    return jsonb_build_object('ok', false, 'error', 'bad_kind');
  end if;
  -- A job or a block occupies the calendar, so it needs a day. A task does not.
  if p_date is null then
    return jsonb_build_object('ok', false, 'error', 'needs_date');
  end if;

  v_dur := p_duration_minutes;
  if v_dur is null or v_dur <= 0 then
    v_dur := 120;
    v_assumed := true;
  end if;

  -- A NEW customer is created ONLY from a name the owner gave in this capture, and only
  -- when he did not confirm an existing one. This function never searches by name to
  -- decide — find_customer_candidates does the looking and the owner does the deciding.
  if p_kind = 'job' and v_cust is null and coalesce(btrim(p_customer_name), '') <> '' then
    insert into public.customers (business_id, name)
    values (p_business_id, btrim(p_customer_name))
    returning id into v_cust;
  end if;

  insert into public.jobs (business_id, customer_id, customer_name, service_name,
                           scheduled_date, scheduled_time, duration_hours, amount,
                           status, is_block, notes, from_booking)
  values (p_business_id, v_cust,
          case when p_kind = 'block' then null                     -- never a fake person
               else coalesce(btrim(p_customer_name),
                             (select name from public.customers where id = v_cust)) end,
          btrim(p_title), p_date, p_start, v_dur / 60.0, p_amount,
          'scheduled', p_kind = 'block', nullif(btrim(coalesce(p_notes,'')), ''), false)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'kind', p_kind, 'id', v_id, 'title', btrim(p_title),
    'date', p_date, 'start', p_start,
    'duration_minutes', v_dur,
    -- The caller MUST say this back when true.
    'assumed_duration', v_assumed,
    'customer_id', v_cust
  );
end;
$$;

grant execute on function public.find_customer_candidates(uuid,uuid,text) to authenticated, service_role;
grant execute on function public.capture_planner_item(uuid,uuid,text,text,date,time,integer,uuid,text,numeric,text,text,text,text) to authenticated, service_role;
