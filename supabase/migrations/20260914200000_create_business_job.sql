-- ONE JOB, WRITTEN FROM WHAT SOMEBODY PASTED, AND HANDED BACK.
--
-- 255 job rows exist and there is no function that creates one: every job in the database
-- arrived through the booking path (hubly_booking_execution inserts with the admin key) or by
-- hand in the operator app. An owner who is handed a job in a text message — which is how most
-- of them actually arrive — has no way to put it in Hubly except to retype it into a form he
-- has not been shown.
--
-- THE PREDICATE IS set_business_service_catalog's, COPIED RATHER THAN INVENTED. Same shape,
-- same return codes, so an unclaimed draft is authorised by its token and a claimed business by
-- its owner, and the caller never gets to make that decision differently:
--
--     if v_owner is null then          -- unclaimed draft: the token is the credential
--       ... p_draft_token must match
--     else                             -- claimed: the verified owner, and nothing else
--       ... hubly_owns_business(p_business_id, p_owner_id)
--     end if;
--
-- IT RETURNS THE ROW IT WROTE, not a boolean. The caller has to be able to read the job back to
-- say anything true about it — and "read it back" is the difference between a write that
-- happened and a write we assume happened (prohibition 3). A caller that only gets `ok` has to
-- take our word for it, and so does the owner.
--
-- Returns one row. `id` null with `error` set means nothing was written:
--   not_found · not_owner · bad_token · no_content (nothing worth saving in what was pasted)
create or replace function public.create_business_job(
  p_business_id uuid, p_owner_id uuid, p_job jsonb, p_draft_token uuid default null
) returns table (
  id uuid, customer_name text, service_name text, scheduled_date date, scheduled_time time,
  address text, phone text, amount numeric, notes text, status text, error text
) language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_token uuid; v_found boolean; v_id uuid;
begin
  -- ALIASED, because the OUT parameter `id` shadows the column of the same name and Postgres
  -- refuses the ambiguity (42702). Caught on the first real call rather than by reading it.
  select b.owner_id, b.draft_token, true into v_owner, v_token, v_found
    from public.businesses b where b.id = p_business_id;
  if not coalesce(v_found, false) then
    return query select null::uuid, null::text, null::text, null::date, null::time, null::text, null::text, null::numeric, null::text, null::text, 'not_found'::text;
    return;
  end if;

  if v_owner is null then
    if p_draft_token is null or v_token is null or v_token is distinct from p_draft_token then
      return query select null::uuid, null::text, null::text, null::date, null::time, null::text, null::text, null::numeric, null::text, null::text, 'bad_token'::text;
      return;
    end if;
  else
    if p_owner_id is null or not public.hubly_owns_business(p_business_id, p_owner_id) then
      return query select null::uuid, null::text, null::text, null::date, null::time, null::text, null::text, null::numeric, null::text, null::text, 'not_owner'::text;
      return;
    end if;
  end if;

  -- A JOB WITH NOTHING IN IT IS NOT A JOB. At least one of: who it is for, what the work is,
  -- when it is, or where. A row of nulls on a planner is worse than no row: it looks like
  -- something the owner has to deal with and there is nothing there to deal with.
  if p_job is null or jsonb_typeof(p_job) <> 'object' then
    return query select null::uuid, null::text, null::text, null::date, null::time, null::text, null::text, null::numeric, null::text, null::text, 'no_content'::text;
    return;
  end if;
  if coalesce(nullif(btrim(p_job->>'customer_name'), ''), nullif(btrim(p_job->>'service_name'), ''),
              nullif(btrim(p_job->>'scheduled_date'), ''), nullif(btrim(p_job->>'address'), '')) is null then
    return query select null::uuid, null::text, null::text, null::date, null::time, null::text, null::text, null::numeric, null::text, null::text, 'no_content'::text;
    return;
  end if;

  insert into public.jobs (
    business_id, customer_name, service_name, scheduled_date, scheduled_time, address,
    phone, email, amount, notes, status, from_booking
  ) values (
    p_business_id,
    nullif(btrim(coalesce(p_job->>'customer_name','')), ''),
    nullif(btrim(coalesce(p_job->>'service_name','')), ''),
    -- A DATE WE CANNOT PARSE IS NO DATE. Never today-by-default: a job silently scheduled for
    -- today is a job the owner will miss tomorrow.
    (case when nullif(btrim(coalesce(p_job->>'scheduled_date','')), '') is null then null
          else (p_job->>'scheduled_date')::date end),
    (case when nullif(btrim(coalesce(p_job->>'scheduled_time','')), '') is null then null
          else (p_job->>'scheduled_time')::time end),
    nullif(btrim(coalesce(p_job->>'address','')), ''),
    nullif(btrim(coalesce(p_job->>'phone','')), ''),
    nullif(btrim(coalesce(p_job->>'email','')), ''),
    (case when nullif(btrim(coalesce(p_job->>'amount','')), '') is null then null
          else (p_job->>'amount')::numeric end),
    nullif(btrim(coalesce(p_job->>'notes','')), ''),
    'scheduled',
    false
  ) returning jobs.id into v_id;   -- qualified for the same reason

  return query
    select j.id, j.customer_name, j.service_name, j.scheduled_date, j.scheduled_time,
           j.address, j.phone, j.amount, j.notes, j.status, null::text
    from public.jobs j where j.id = v_id;
end;
$$;

revoke all on function public.create_business_job(uuid, uuid, jsonb, uuid) from public;
grant execute on function public.create_business_job(uuid, uuid, jsonb, uuid) to anon, authenticated, service_role;

comment on function public.create_business_job(uuid, uuid, jsonb, uuid) is
  'Creates one job from parsed text and RETURNS THE ROW. Authorised exactly as '
  'set_business_service_catalog: an unclaimed draft by its token, a claimed business by its '
  'verified owner. Refuses a job with no customer, service, date or address (no_content).';
