-- Production hardening for Google Calendar sync (webhook auth, locks, indexes).

alter table public.google_calendar_connections
  add column if not exists watch_channel_token text,
  add column if not exists watch_resource_id text,
  add column if not exists sync_lock_until timestamptz,
  add column if not exists last_webhook_at timestamptz,
  add column if not exists last_error text;

-- watch_resource_id may already exist from inbound migration; keep idempotent.
comment on column public.google_calendar_connections.watch_channel_token is
  'Random secret sent as X-Goog-Channel-Token. Never equal to business_id.';
comment on column public.google_calendar_connections.sync_lock_until is
  'Single-flight lock for inbound/import sync. Holders skip concurrent runs.';
comment on column public.google_calendar_connections.last_webhook_at is
  'Debounce timestamp for Google push notifications.';
comment on column public.google_calendar_connections.last_error is
  'Last non-fatal sync/watch error message for owner UI (never tokens).';

create unique index if not exists google_calendar_connections_watch_channel_uidx
  on public.google_calendar_connections (watch_channel_id)
  where watch_channel_id is not null;

create index if not exists google_calendar_connections_watch_exp_idx
  on public.google_calendar_connections (watch_expiration)
  where watch_expiration is not null;

create index if not exists google_calendar_connections_inbound_idx
  on public.google_calendar_connections (last_inbound_at nulls first);

-- Acquire a short sync lock for one business. Returns true if this caller won.
create or replace function public.try_acquire_gcal_sync_lock(
  p_business_id uuid,
  p_ttl_seconds integer default 45
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  if p_business_id is null then
    return false;
  end if;
  update public.google_calendar_connections
  set
    sync_lock_until = now() + make_interval(secs => greatest(5, least(coalesce(p_ttl_seconds, 45), 120))),
    updated_at = now()
  where business_id = p_business_id
    and (
      sync_lock_until is null
      or sync_lock_until < now()
    );
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke all on function public.try_acquire_gcal_sync_lock(uuid, integer) from public;
grant execute on function public.try_acquire_gcal_sync_lock(uuid, integer) to service_role;

create or replace function public.release_gcal_sync_lock(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.google_calendar_connections
  set sync_lock_until = null, updated_at = now()
  where business_id = p_business_id;
end;
$$;

revoke all on function public.release_gcal_sync_lock(uuid) from public;
grant execute on function public.release_gcal_sync_lock(uuid) to service_role;

-- Debounce webhooks: true if we should process (updated last_webhook_at).
create or replace function public.try_gcal_webhook_debounce(
  p_business_id uuid,
  p_min_seconds integer default 15
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  update public.google_calendar_connections
  set
    last_webhook_at = now(),
    updated_at = now()
  where business_id = p_business_id
    and (
      last_webhook_at is null
      or last_webhook_at < now() - make_interval(secs => greatest(1, least(coalesce(p_min_seconds, 15), 120)))
    );
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke all on function public.try_gcal_webhook_debounce(uuid, integer) from public;
grant execute on function public.try_gcal_webhook_debounce(uuid, integer) to service_role;
