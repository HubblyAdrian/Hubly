-- A fire-and-forget net.http_post can never report its own outcome. When the call
-- is rejected at booking-notify's secret gate (a 403), booking-notify never runs, so
-- it never records anything — the notification vanishes with no trace. That is the
-- blind spot that made the cron-secret mismatch invisible.
--
-- Fix: the CALLER writes a 'pending' delivery row BEFORE the call; booking-notify
-- flips it to sent/failed by id when it runs. A row left at 'pending' is itself the
-- failure signal — the call never landed. It surfaces in the existing
-- "status <> 'sent'" index.

-- 1. Widen the vocabulary. 'pending' = written before the call, not yet resolved.
alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_status_check;
alter table public.notification_deliveries
  add constraint notification_deliveries_status_check
  check (status in ('pending', 'sent', 'failed', 'skipped'));

comment on constraint notification_deliveries_status_check on public.notification_deliveries is
  'pending = row written by the caller before the notify call; the callee flips it to '
  'sent/failed. A row stuck at pending means the call never landed (403, gateway, network).';

-- 2. The completion trigger now writes the pending row and hands its id to
--    booking-notify. Everything else is unchanged from 20260821010000.
create or replace function public.notify_owner_on_booking_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_delivery_id uuid;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from 'pending' then
    return new;
  end if;

  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'hubly_cron_secret';
  if v_secret is null then
    raise warning 'notify_owner_on_booking_completion: hubly_cron_secret missing; owner NOT notified for booking %', new.id;
    return new;
  end if;

  -- PENDING BEFORE THE CALL. If the POST is rejected at the gate, this row stays
  -- 'pending' and that is the evidence.
  insert into public.notification_deliveries
    (business_id, subject_type, subject_id, recipient_role, channel, provider, status)
  values (new.business_id, 'booking', new.id, 'owner', 'email', 'resend', 'pending')
  returning id into v_delivery_id;

  perform net.http_post(
    url := 'https://rtwxxkxpkqdrhclkozma.supabase.co/functions/v1/booking-notify',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-hubly-cron-secret', v_secret
    ),
    body := jsonb_build_object(
      'record', to_jsonb(new),
      'hubly_notify_reason', case when tg_op = 'INSERT' then 'created' else 'completed' end,
      'delivery_id', v_delivery_id
    )
  );
  return new;
end;
$$;
