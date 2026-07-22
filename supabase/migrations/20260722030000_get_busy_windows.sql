-- Calendar trust: busy windows for booking conflict detection.
-- Callable by anon (public Instant Site) and authenticated owners.
-- Returns only time + duration + kind — no customer PII.

create or replace function public.get_busy_windows(
  p_business_id uuid,
  p_date date
)
returns table (
  scheduled_time time,
  duration_hours numeric,
  kind text,
  job_id uuid
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (j.scheduled_time)::time as scheduled_time,
    coalesce(j.duration_hours, 2)::numeric as duration_hours,
    case
      when coalesce(j.customer_name, '') = 'Blocked' then 'block'
      else 'booking'
    end as kind,
    j.id as job_id
  from public.jobs j
  where j.business_id = p_business_id
    and j.scheduled_date = p_date
    and j.scheduled_time is not null
    and coalesce(j.status, '') not in ('cancelled', 'canceled', 'completed', 'pending')

  union all

  select
    coalesce(g.local_start_time, time '08:00') as scheduled_time,
    coalesce(g.duration_hours, 1)::numeric as duration_hours,
    'block'::text as kind,
    null::uuid as job_id
  from public.google_calendar_events g
  where g.business_id = p_business_id
    and g.local_date = p_date
    and coalesce(g.status, '') <> 'cancelled';
$$;

comment on function public.get_busy_windows(uuid, date) is
  'Busy slots for a business on a date (Hubly jobs + imported Google events). Used by Instant Site booking.';

revoke all on function public.get_busy_windows(uuid, date) from public;
grant execute on function public.get_busy_windows(uuid, date) to anon, authenticated, service_role;
