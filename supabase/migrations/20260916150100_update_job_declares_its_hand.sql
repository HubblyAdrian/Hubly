-- THE WRITER DECLARES WHICH HAND IT IS.
--
-- Companion to 20260916150000_jobs_trace.sql. The trigger there fills `updated_at` on every
-- UPDATE and cannot be forgotten. `updated_via` is the one field the database cannot know: the
-- model path and the owner's own job editor call THIS SAME FUNCTION with the same arguments, so
-- the only place the difference exists is in the caller.
--
-- p_via DEFAULTS TO 'unknown'. A category that describes who did something may not default to
-- the flattering value — an unlabelled write is unknown, never 'model'. A caller that forgets
-- to declare produces an honest gap rather than a wrong attribution.
--
-- THE OLD EIGHT-ARGUMENT FUNCTION IS DROPPED rather than left beside this one. Two overloads
-- both satisfiable by an eight-argument call is a PostgREST ambiguity error that would take the
-- whole capability down; a client still running the old page sends eight arguments, lands here,
-- and is recorded as 'unknown' — which is exactly what it is.

drop function if exists public.update_business_job(uuid, uuid, uuid, text, text, text, text, uuid);

create or replace function public.update_business_job(
  p_business_id uuid,
  p_job_id uuid,
  p_owner_id uuid,
  p_scheduled_time text default null,
  p_scheduled_date text default null,
  p_address text default null,
  p_amount text default null,
  p_draft_token uuid default null,
  p_via text default 'unknown'
) returns table (
  id uuid, customer_name text, service_name text, scheduled_date date, scheduled_time time,
  address text, phone text, amount numeric, notes text, status text, error text
) language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_token uuid; v_found boolean; v_belongs boolean;
  v_new_time time; v_new_date date; v_new_addr text; v_new_amt numeric;
  v_set_time boolean := false; v_set_date boolean := false;
  v_set_addr boolean := false; v_set_amt boolean := false;
  v_via text;
begin
  v_via := case when p_via in ('model','hand','booking','calendar','script') then p_via else 'unknown' end;

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
  -- alone would let anyone who owns one business edit a job on another.
  select true into v_belongs from public.jobs j
    where j.id = p_job_id and j.business_id = p_business_id;
  if not coalesce(v_belongs, false) then
    return query select null::uuid, null::text, null::text, null::date, null::time, null::text, null::text, null::numeric, null::text, null::text, 'no_job'::text;
    return;
  end if;

  -- null = leave alone. '' = clear, deliberately. Anything else = parse it.
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
  if p_amount is not null then
    v_set_amt := true;
    v_new_amt := (case when btrim(p_amount) = '' then null else (btrim(p_amount))::numeric end);
  end if;

  if not (v_set_time or v_set_date or v_set_addr or v_set_amt) then
    return query select null::uuid, null::text, null::text, null::date, null::time, null::text, null::text, null::numeric, null::text, null::text, 'no_change'::text;
    return;
  end if;

  -- updated_at is NOT set here: the trigger owns it, so no writer can forget it and no writer
  -- can lie about it. Only the two things the database cannot know are set by hand.
  update public.jobs j set
    scheduled_time = (case when v_set_time then v_new_time else j.scheduled_time end),
    scheduled_date = (case when v_set_date then v_new_date else j.scheduled_date end),
    address        = (case when v_set_addr then v_new_addr else j.address end),
    amount         = (case when v_set_amt  then v_new_amt  else j.amount end),
    updated_by     = p_owner_id,
    updated_via    = v_via
  where j.id = p_job_id and j.business_id = p_business_id;

  return query
    select j.id, j.customer_name, j.service_name, j.scheduled_date, j.scheduled_time,
           j.address, j.phone, j.amount, j.notes, j.status, null::text
    from public.jobs j where j.id = p_job_id;
end;
$$;

revoke all on function public.update_business_job(uuid, uuid, uuid, text, text, text, text, uuid, text) from public;
grant execute on function public.update_business_job(uuid, uuid, uuid, text, text, text, text, uuid, text) to anon, authenticated, service_role;

comment on function public.update_business_job(uuid, uuid, uuid, text, text, text, text, uuid, text) is
  'update_business_job; returns zero rows rather than an error for a non-owner. p_via records '
  'WHICH HAND wrote the row (model | hand | booking | calendar | script), because the model path '
  'and the owner''s own editor are otherwise indistinguishable — the gap that made a one-line '
  'question about one row unanswerable on 2026-09-16.';
