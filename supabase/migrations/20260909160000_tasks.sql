-- ═══════════════════════════════════════════════════════════════════════════════
-- TASKS — the third thing in the owner's day.
--
-- There was no tasks table among the 131; this is the only genuinely greenfield part
-- of the planner. It exists because of Graef: "Leslie", "Alexandria" and "Dentist Appt"
-- in his CUSTOMER table are not broken data — he was planning his day in the only place
-- Hubly gave him. A task and a job and a block belong in one list because a detailer
-- does not keep his jobs and his errands in separate apps, and asking him to is why he
-- uses neither.
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  notes text,
  -- A task captured in four words has no date, and that is fine. Capture takes what it
  -- is given; it never interrogates. An undated task is "still open", not "overdue".
  due_date date,
  due_time time,
  duration_minutes integer,
  -- A/B/C. One question decides it: can he move this himself without telling anyone?
  -- No -> A. Yes but it matters -> B. Yes and nothing happens -> C.
  band text not null default 'B' check (band in ('A','B','C')),
  -- WHO decided the band. Hubly proposes with a reason; the owner overrides and the
  -- override STICKS — a proposal that silently re-decides itself next morning is worse
  -- than no proposal.
  band_source text not null default 'proposed' check (band_source in ('proposed','owner')),
  band_reason text,
  -- Work / Personal is a FILTER ON ONE LIST, never two lists. Hubly holding personal
  -- items is deliberate: it is what makes this a planner rather than a job board.
  lane text not null default 'work' check (lane in ('work','personal')),
  status text not null default 'open' check (status in ('open','done','dropped')),
  done_at timestamptz,
  -- NEVER A GROWING PILE OF RED. An undone task is ROLLED, not accumulated as overdue
  -- shame: rolled_from records where it came from and roll_count how many times, so
  -- Hubly can ask "this didn't happen three days running — today, tomorrow, or drop it?"
  -- rather than showing a monument to failure. This user has abandoned planners for
  -- exactly that reason.
  rolled_from date,
  roll_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_business_day on public.tasks (business_id, status, due_date);
alter table public.tasks enable row level security;
drop policy if exists tasks_owner_all on public.tasks;
create policy tasks_owner_all on public.tasks for all
  using (exists (select 1 from public.businesses b where b.id = tasks.business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = tasks.business_id and b.owner_id = auth.uid()));

create or replace function public.create_task(
  p_business_id uuid, p_owner_id uuid, p_title text,
  p_due_date date default null, p_due_time time default null,
  p_duration_minutes integer default null,
  p_band text default 'B', p_band_reason text default null,
  p_lane text default 'work', p_notes text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.tasks;
begin
  if not public.hubly_owns_business(p_business_id, p_owner_id) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  if coalesce(btrim(p_title), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'no_title');
  end if;
  insert into public.tasks (business_id, title, notes, due_date, due_time, duration_minutes,
                            band, band_source, band_reason, lane)
  values (p_business_id, btrim(p_title), nullif(btrim(coalesce(p_notes,'')), ''),
          p_due_date, p_due_time, p_duration_minutes,
          case when p_band in ('A','B','C') then p_band else 'B' end, 'proposed',
          nullif(btrim(coalesce(p_band_reason,'')), ''),
          case when p_lane in ('work','personal') then p_lane else 'work' end)
  returning * into r;
  return jsonb_build_object('ok', true, 'id', r.id, 'title', r.title, 'band', r.band,
                            'lane', r.lane, 'due_date', r.due_date, 'due_time', r.due_time);
end;
$$;

create or replace function public.get_business_tasks(
  p_business_id uuid, p_owner_id uuid, p_from date default null, p_to date default null
) returns table (
  id uuid, title text, notes text, due_date date, due_time time, duration_minutes integer,
  band text, band_source text, band_reason text, lane text, status text, roll_count integer
) language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.notes, t.due_date, t.due_time, t.duration_minutes,
         t.band, t.band_source, t.band_reason, t.lane, t.status, t.roll_count
  from public.tasks t
  where t.business_id = p_business_id
    and public.hubly_owns_business(p_business_id, p_owner_id)
    and t.status = 'open'
    -- An UNDATED task is always shown: it has not failed to happen, it simply has no day.
    and (t.due_date is null
         or (p_from is null or t.due_date >= p_from)
         and (p_to is null or t.due_date <= p_to))
  order by t.band, t.due_date nulls last, t.due_time nulls last, t.created_at;
$$;

-- COMPLETION IS VISIBLE AND REAL: completed over total, nothing invented. At 7am with
-- nothing done this returns 0 of N — which the surface must render as the start of a
-- day, never as failure.
create or replace function public.get_task_progress(p_business_id uuid, p_owner_id uuid, p_day date)
returns table (done integer, total integer) language sql stable security definer set search_path = public as $$
  select count(*) filter (where status = 'done')::int,
         count(*)::int
  from public.tasks
  where business_id = p_business_id
    and public.hubly_owns_business(p_business_id, p_owner_id)
    and (due_date = p_day or (due_date is null and status = 'open'));
$$;

create or replace function public.set_task_status(p_task_id uuid, p_owner_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  select business_id into b from public.tasks where id = p_task_id;
  if b is null or not public.hubly_owns_business(b, p_owner_id) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  if p_status not in ('open','done','dropped') then
    return jsonb_build_object('ok', false, 'error', 'bad_status');
  end if;
  update public.tasks
     set status = p_status,
         done_at = case when p_status = 'done' then now() else null end,
         updated_at = now()
   where id = p_task_id;
  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- ROLL, never accumulate. The task moves to a new day and remembers that it moved.
create or replace function public.roll_task(p_task_id uuid, p_owner_id uuid, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b uuid; oldd date; n integer;
begin
  select business_id, due_date into b, oldd from public.tasks where id = p_task_id;
  if b is null or not public.hubly_owns_business(b, p_owner_id) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  update public.tasks
     set due_date = p_to, rolled_from = coalesce(oldd, rolled_from),
         roll_count = roll_count + 1, updated_at = now()
   where id = p_task_id
  returning roll_count into n;
  return jsonb_build_object('ok', true, 'due_date', p_to, 'roll_count', n);
end;
$$;

grant execute on function public.create_task(uuid,uuid,text,date,time,integer,text,text,text,text) to authenticated, service_role;
grant execute on function public.get_business_tasks(uuid,uuid,date,date) to authenticated, service_role;
grant execute on function public.get_task_progress(uuid,uuid,date) to authenticated, service_role;
grant execute on function public.set_task_status(uuid,uuid,text) to authenticated, service_role;
grant execute on function public.roll_task(uuid,uuid,date) to authenticated, service_role;
