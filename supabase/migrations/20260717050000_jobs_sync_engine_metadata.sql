-- Sync Engine metadata on jobs.
-- hubly_job_id mirrors jobs.id for sync payloads / Google extended properties.
-- Conflict rule: newest of last_hubly_update vs last_google_update wins for linked jobs.
-- Personal Google events (no hubly link) stay Google-owned in google_calendar_events.

alter table public.jobs
  add column if not exists hubly_job_id uuid,
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_google_update timestamptz,
  add column if not exists last_hubly_update timestamptz,
  add column if not exists sync_status text default 'idle',
  add column if not exists sync_origin text;

-- Backfill
update public.jobs
set hubly_job_id = id
where hubly_job_id is null;

update public.jobs
set last_hubly_update = coalesce(last_hubly_update, hubly_push_at, now())
where last_hubly_update is null;

update public.jobs
set sync_status = coalesce(nullif(sync_status, ''), case
  when google_event_id is not null then 'synced'
  else 'idle'
end);

create index if not exists jobs_hubly_job_id_idx on public.jobs (hubly_job_id);
create index if not exists jobs_sync_status_idx on public.jobs (business_id, sync_status);

comment on column public.jobs.hubly_job_id is
  'Canonical Hubly job id for sync (equals jobs.id). Stored on Google as private hublyJobId.';
comment on column public.jobs.last_synced_at is
  'When Hubly↔Google last successfully reconciled this job.';
comment on column public.jobs.last_google_update is
  'Google event.updated timestamp last applied or observed.';
comment on column public.jobs.last_hubly_update is
  'When Hubly last changed sync-relevant job fields (trigger).';
comment on column public.jobs.sync_status is
  'idle | pending | synced | conflict | error | local_only';
comment on column public.jobs.sync_origin is
  'Transient: set to google when Sync Engine writes from Google (skips last_hubly_update bump).';

create or replace function public.jobs_sync_metadata_touch()
returns trigger
language plpgsql
as $$
begin
  -- Always keep hubly_job_id aligned with primary key
  if new.id is not null then
    new.hubly_job_id := new.id;
  end if;

  if tg_op = 'INSERT' then
    if new.last_hubly_update is null then
      new.last_hubly_update := now();
    end if;
    if new.sync_status is null or new.sync_status = '' then
      new.sync_status := 'idle';
    end if;
    return new;
  end if;

  -- UPDATE: Sync Engine Google→Hubly writes set sync_origin = 'google'
  if new.sync_origin is not null and lower(new.sync_origin) = 'google' then
    new.sync_origin := null;
    return new;
  end if;

  -- Hubly-origin change to schedule / location / notes / status
  if (new.scheduled_date, new.scheduled_time, new.address, new.notes,
      new.duration_hours, new.status, new.customer_name, new.service_name, new.phone)
     is distinct from
     (old.scheduled_date, old.scheduled_time, old.address, old.notes,
      old.duration_hours, old.status, old.customer_name, old.service_name, old.phone)
  then
    new.last_hubly_update := now();
    if new.google_event_id is not null and coalesce(new.sync_status, '') not in ('error') then
      new.sync_status := 'pending';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobs_sync_metadata_touch on public.jobs;
create trigger trg_jobs_sync_metadata_touch
  before insert or update on public.jobs
  for each row
  execute function public.jobs_sync_metadata_touch();
