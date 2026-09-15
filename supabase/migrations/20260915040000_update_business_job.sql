-- A TIME OR A PLACE ALREADY ON THE DAY CAN BE CHANGED BY HAND — My Day floor (c).
--
-- WHAT WAS MISSING WAS THE WRITER, AND IT WAS MISSING IN BOTH LANES AT ONCE.
--
-- 2026-09-15, on a real walk: the owner typed "on the job change it instead of drive way change
-- it Bob jones quarterly Job phone number 8018888566" and Hubly answered "I can't change an
-- existing job from here yet." That was TRUE — create_business_job (20260914200000) is the only
-- job writer that exists, and it only inserts. So a job could be put on the day by talking and
-- then could not be corrected by talking OR by hand: one missing function, both doors dark.
--
-- THE PREDICATE IS create_business_job's, COPIED RATHER THAN INVENTED — same shape, same return
-- codes, so an unclaimed draft is authorised by its token and a claimed business by its verified
-- owner, and this caller does not get to decide that differently.
--
-- ONLY THE FIELDS THAT WERE PASSED CHANGE. Every argument defaults to null and null means
-- "leave it exactly as it was", so correcting a time cannot blank an address. That is the same
-- asymmetry that governs setHours (a weekday not mentioned is not touched) and the services
-- reconcile (an omission is not a deletion): a partial statement is a partial change, never a
-- replace-all. To CLEAR a field deliberately, pass the empty string — stated, not inferred.
--
-- IT RETURNS THE ROW IT WROTE. A caller that only gets `ok` has to take our word for it, and so
-- does the owner (prohibition 3). `id` null with `error` set means nothing was written:
--   not_found · not_owner · bad_token · no_job (this job is not on this business) · no_change
create or replace function public.update_business_job(
  p_business_id uuid,
  p_job_id uuid,
  p_owner_id uuid,
  p_scheduled_time text default null,
  p_scheduled_date text default null,
  p_address text default null,
  p_draft_token uuid default null
) returns table (
  id uuid, customer_name text, service_name text, scheduled_date date, scheduled_time time,
  address text, phone text, amount numeric, notes text, status text, error text
) language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_token uuid; v_found boolean; v_belongs boolean;
  v_new_time time; v_new_date date; v_new_addr text;
  v_set_time boolean := false; v_set_date boolean := false; v_set_addr boolean := false;
begin
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

  -- THE JOB MUST BE ON THIS BUSINESS. Authorising the BUSINESS and then updating by job id
  -- alone would let anyone who owns one business edit a job on another — the owner_id
  -- invariant one table over. Checked, not assumed.
  select true into v_belongs from public.jobs j
    where j.id = p_job_id and j.business_id = p_business_id;
  if not coalesce(v_belongs, false) then
    return query select null::uuid, null::text, null::text, null::date, null::time, null::text, null::text, null::numeric, null::text, null::text, 'no_job'::text;
    return;
  end if;

  -- null = leave alone. '' = clear, deliberately. Anything else = parse it, and a value we
  -- cannot parse is NOT silently dropped: it leaves the field untouched and the caller reads
  -- the row back and sees it did not take.
  if p_scheduled_time is not null then
    v_set_time := true;
    v_new_time := (case when btrim(p_scheduled_time) = '' then null else (btrim(p_scheduled_time))::time end);
  end if;
  if p_scheduled_date is not null then
    v_set_date := true;
    v_new_date := (case when btrim(p_scheduled_date) = '' then null else (btrim(p_scheduled_date))::date end);
  end if;
  if p_address is not null then
    v_set_addr := true;
    v_new_addr := nullif(btrim(p_address), '');
  end if;

  if not (v_set_time or v_set_date or v_set_addr) then
    return query select null::uuid, null::text, null::text, null::date, null::time, null::text, null::text, null::numeric, null::text, null::text, 'no_change'::text;
    return;
  end if;

  update public.jobs j set
    scheduled_time = (case when v_set_time then v_new_time else j.scheduled_time end),
    scheduled_date = (case when v_set_date then v_new_date else j.scheduled_date end),
    address        = (case when v_set_addr then v_new_addr else j.address end)
  where j.id = p_job_id and j.business_id = p_business_id;

  return query
    select j.id, j.customer_name, j.service_name, j.scheduled_date, j.scheduled_time,
           j.address, j.phone, j.amount, j.notes, j.status, null::text
    from public.jobs j where j.id = p_job_id;
end;
$$;

revoke all on function public.update_business_job(uuid, uuid, uuid, text, text, text, uuid) from public;
grant execute on function public.update_business_job(uuid, uuid, uuid, text, text, text, uuid) to anon, authenticated, service_role;

comment on function public.update_business_job(uuid, uuid, uuid, text, text, text, uuid) is
  'Changes the time, date or address of ONE existing job and RETURNS THE ROW. Authorised exactly '
  'as create_business_job. null leaves a field alone; the empty string clears it. Refuses a job '
  'that is not on this business (no_job) and a call that asks for nothing (no_change).';
