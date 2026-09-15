-- THE MODEL CAN CHANGE A JOB NOW — the writer gains a price, and a way to say WHICH job.
--
-- 2026-09-15: "change the driveway job to 3 PM" was typed twice and the owner got NOTHING
-- back either time. update_business_job (20260915040000) had been written and live-tested the
-- night before and appeared nowhere in supabase/functions — the writer existed and the model
-- could not reach it. Wiring business.updateJob needs two things this adds.
--
-- 1. p_amount. The original writer took time, date and address. An owner correcting a job says
--    "the Maple St one is $200 now" as readily as "move it to 3" — leaving price out would ship
--    a capability that refuses a third of what it is asked.
--
--    IT KEEPS THE SAME CONTRACT AS THE OTHER THREE: null leaves the field alone, the empty
--    string clears it. A partial statement is a partial change, never a replace-all.
--
-- 2. get_business_jobs_for_match. The model has never seen a job id and must never be trusted
--    to invent one, so it names the job the way the owner did ("the driveway job") and the
--    handler resolves that against the business's OWN rows. This returns only the fields a
--    match needs — who, what, where, when — and nothing else: it is a lookup for disambiguation,
--    not a data export, and it must not become the way job details leak into a prompt.
--
--    Authorised exactly as create_business_job and update_business_job: an unclaimed draft by
--    its token, a claimed business by its verified owner. Returns zero rows for anyone else
--    rather than an error, because "you have no jobs" and "these are not your jobs" must not be
--    distinguishable to a caller who is not the owner.

-- ── 1. THE WRITER GAINS A PRICE ──────────────────────────────────────────────────────────
create or replace function public.update_business_job(
  p_business_id uuid,
  p_job_id uuid,
  p_owner_id uuid,
  p_scheduled_time text default null,
  p_scheduled_date text default null,
  p_address text default null,
  p_amount text default null,
  p_draft_token uuid default null
) returns table (
  id uuid, customer_name text, service_name text, scheduled_date date, scheduled_time time,
  address text, phone text, amount numeric, notes text, status text, error text
) language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_token uuid; v_found boolean; v_belongs boolean;
  v_new_time time; v_new_date date; v_new_addr text; v_new_amt numeric;
  v_set_time boolean := false; v_set_date boolean := false;
  v_set_addr boolean := false; v_set_amt boolean := false;
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

  update public.jobs j set
    scheduled_time = (case when v_set_time then v_new_time else j.scheduled_time end),
    scheduled_date = (case when v_set_date then v_new_date else j.scheduled_date end),
    address        = (case when v_set_addr then v_new_addr else j.address end),
    amount         = (case when v_set_amt  then v_new_amt  else j.amount end)
  where j.id = p_job_id and j.business_id = p_business_id;

  return query
    select j.id, j.customer_name, j.service_name, j.scheduled_date, j.scheduled_time,
           j.address, j.phone, j.amount, j.notes, j.status, null::text
    from public.jobs j where j.id = p_job_id;
end;
$$;

revoke all on function public.update_business_job(uuid, uuid, uuid, text, text, text, text, uuid) from public;
grant execute on function public.update_business_job(uuid, uuid, uuid, text, text, text, text, uuid) to anon, authenticated, service_role;

-- The 6-argument shape from 20260915040000 is dropped: two overloads differing only by a
-- defaulted trailing argument make every call ambiguous (PostgreSQL 42725), and the client
-- passes named arguments. One signature, one writer.
drop function if exists public.update_business_job(uuid, uuid, uuid, text, text, text, uuid);

-- ── 2. WHICH JOB DID THEY MEAN ───────────────────────────────────────────────────────────
create or replace function public.get_business_jobs_for_match(
  p_business_id uuid, p_owner_id uuid, p_draft_token uuid default null
) returns table (
  id uuid, customer_name text, service_name text, address text, scheduled_date date, scheduled_time time
) language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_token uuid; v_found boolean;
begin
  select b.owner_id, b.draft_token, true into v_owner, v_token, v_found
    from public.businesses b where b.id = p_business_id;
  if not coalesce(v_found, false) then return; end if;

  if v_owner is null then
    if p_draft_token is null or v_token is null or v_token is distinct from p_draft_token then return; end if;
  else
    if p_owner_id is null or not public.hubly_owns_business(p_business_id, p_owner_id) then return; end if;
  end if;

  -- SCHEDULED WORK ONLY, and a bounded window. A completed job from March is not what
  -- "the driveway job" means, and handing the whole history to a matcher turns a typo into a
  -- change to a year-old row.
  return query
    select j.id, j.customer_name, j.service_name, j.address, j.scheduled_date, j.scheduled_time
    from public.jobs j
    where j.business_id = p_business_id
      and coalesce(j.status, 'scheduled') = 'scheduled'
      and (j.scheduled_date is null or j.scheduled_date >= (current_date - interval '7 days'))
    order by j.scheduled_date asc nulls last, j.scheduled_time asc nulls last
    limit 50;
end;
$$;

revoke all on function public.get_business_jobs_for_match(uuid, uuid, uuid) from public;
grant execute on function public.get_business_jobs_for_match(uuid, uuid, uuid) to anon, authenticated, service_role;

comment on function public.get_business_jobs_for_match(uuid, uuid, uuid) is
  'Resolves the owner''s own words for a job ("the driveway job") to a row. Who/what/where/when '
  'only — a lookup for disambiguation, never a data export. Authorised exactly as '
  'update_business_job; returns zero rows rather than an error for a non-owner.';
