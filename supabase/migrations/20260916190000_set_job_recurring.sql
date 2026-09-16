-- THE OWNER CAN MAKE A JOB RECURRING — and it reuses the engine rather than becoming one.
--
-- Measured 2026-09-16 (docs/RECURRING_DOORS_MEASURED.md): recurring_schedules holds 0 rows, and
-- NOT because the engine is missing. hubly_booking_execution.ts already inserts a schedule when a
-- booking carries a frequency, and createBooking already passes it. The only live door is a
-- CUSTOMER volunteering "every month" in chat, and none ever has. The owner — the person with the
-- standing weekly mow — has no way to say it at all.
--
-- ══ NO NEW INTERVAL MATH, AND THAT IS THE WHOLE DESIGN ═══════════════════════════════════
--
-- The cadence arithmetic (month-overflow clamping: Jan 31 + 1 month lands on Feb 28, never rolls
-- into March) already exists TWICE by documented necessity — the Deno module
-- _shared/recurring_schedule_engine.ts, and journey.js's mirror, which cannot import it. A third
-- copy in SQL is exactly the "second engine" this is forbidden to build, and it is the copy most
-- likely to drift because nobody reads migrations when they change a date rule.
--
-- So this function computes NOTHING. It sets:
--
--     start_date            = the job's own date
--     next_occurrence_date  = the job's own date
--
-- and stamps jobs.recurring_schedule_id on that job. On the next run, hubly-recurring-maintain
-- sees the schedule is due, finds the job that already exists for that schedule+date through its
-- OWN belt-and-suspenders check, declines to generate a duplicate, and advances
-- next_occurrence_date by one step USING THE ENGINE. The existing job becomes occurrence #1 —
-- which is exactly what the booking path means when it sets next_occurrence_date to the day after.
--
-- The difference is that the booking path is creating the job in the same breath and can do the
-- step itself; here the job already exists, so handing the step to the worker that owns it costs
-- one cron cycle and buys zero duplicated math.

create or replace function public.set_job_recurring(
  p_business_id uuid,
  p_job_id uuid,
  p_owner_id uuid,
  p_frequency text,
  p_custom_interval_days int default null,
  p_draft_token uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_token uuid; v_found boolean;
  j record; v_freq text; v_existing record; v_id uuid;
begin
  select b.owner_id, b.draft_token, true into v_owner, v_token, v_found
    from public.businesses b where b.id = p_business_id;
  if not coalesce(v_found, false) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  if v_owner is null then
    if p_draft_token is null or v_token is null or v_token is distinct from p_draft_token then
      return jsonb_build_object('ok', false, 'error', 'bad_token');
    end if;
  else
    if p_owner_id is null or not public.hubly_owns_business(p_business_id, p_owner_id) then
      return jsonb_build_object('ok', false, 'error', 'not_owner');
    end if;
  end if;

  -- NEVER INFERRED, NEVER DEFAULTED. The same instruction createBooking already carries; an
  -- unrecognised cadence is refused here rather than quietly becoming weekly.
  v_freq := lower(btrim(coalesce(p_frequency, '')));
  if v_freq not in ('weekly','biweekly','monthly','quarterly','custom') then
    return jsonb_build_object('ok', false, 'error', 'bad_frequency');
  end if;
  if v_freq = 'custom' and coalesce(p_custom_interval_days, 0) < 1 then
    return jsonb_build_object('ok', false, 'error', 'needs_interval');
  end if;

  select * into j from public.jobs where id = p_job_id and business_id = p_business_id;
  if j.id is null then return jsonb_build_object('ok', false, 'error', 'no_job'); end if;
  if j.scheduled_date is null then return jsonb_build_object('ok', false, 'error', 'no_date'); end if;
  if j.recurring_schedule_id is not null then
    select * into v_existing from public.recurring_schedules where id = j.recurring_schedule_id;
    return jsonb_build_object('ok', false, 'error', 'already_recurring',
                              'frequency', v_existing.frequency,
                              'next_occurrence_date', v_existing.next_occurrence_date);
  end if;

  -- THE SAME CONFLICT CHECK THE BOOKING PATH MAKES, for the same reason: one active schedule per
  -- customer+service, or the owner gets two sets of generated jobs and no way to tell them apart.
  select * into v_existing from public.recurring_schedules r
   where r.business_id = p_business_id and r.status = 'active'
     and (
       (j.customer_id is not null and r.customer_id = j.customer_id)
       or (j.customer_id is null and coalesce(r.customer_name,'') = coalesce(j.customer_name,''))
     )
     and coalesce(lower(r.service_name),'') = coalesce(lower(j.service_name),'')
   limit 1;
  if v_existing.id is not null then
    return jsonb_build_object('ok', false, 'error', 'already_scheduled',
                              'frequency', v_existing.frequency,
                              'service_name', v_existing.service_name,
                              'next_occurrence_date', v_existing.next_occurrence_date);
  end if;

  insert into public.recurring_schedules (
    business_id, customer_id, customer_name, service_name, service_id,
    frequency, custom_interval_days, status, start_date, next_occurrence_date,
    preferred_time, amount, address, notes
  ) values (
    p_business_id, j.customer_id, j.customer_name, j.service_name, j.service_id,
    v_freq, case when v_freq = 'custom' then p_custom_interval_days else null end,
    'active', j.scheduled_date, j.scheduled_date,
    j.scheduled_time, j.amount, j.address, j.notes
  ) returning id into v_id;

  update public.jobs
     set recurring_schedule_id = v_id,
         updated_by = p_owner_id,
         updated_via = 'model'
   where id = p_job_id and business_id = p_business_id;

  return jsonb_build_object('ok', true, 'schedule_id', v_id, 'frequency', v_freq,
                            'custom_interval_days', case when v_freq = 'custom' then p_custom_interval_days else null end,
                            'service_name', j.service_name, 'customer_name', j.customer_name,
                            'start_date', j.scheduled_date);
end;
$$;

revoke all on function public.set_job_recurring(uuid, uuid, uuid, text, int, uuid) from public;
grant execute on function public.set_job_recurring(uuid, uuid, uuid, text, int, uuid) to anon, authenticated, service_role;

comment on function public.set_job_recurring(uuid, uuid, uuid, text, int, uuid) is
  'Makes an EXISTING job the first occurrence of a recurring schedule. Computes no interval math: '
  'next_occurrence_date is the job''s own date, and hubly-recurring-maintain advances it with the '
  'shared engine while declining to duplicate the job that already exists for that date.';
