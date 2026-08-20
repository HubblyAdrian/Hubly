-- Tell the business owner when a booking actually becomes a booking.
--
-- THE FACT THIS FIXES
--
-- No booking made through a Hubly site has ever notified its owner. Proven on
-- 2026-08-20 by completing a real one: booking-notify compares the caller's
-- credential to the SECRET key, the only caller on the pay-in-person path is the
-- browser (public/hubly.html, dbClient.functions.invoke), and a browser can only
-- ever send the publishable key. It returns
--
--   {"ok":false,"error":"forbidden"}   HTTP 403
--
-- every time, into a `.catch(e => console.warn(...))` that nobody reads.
--
-- WHY A TRIGGER AGAIN, WHEN ONE WAS DELETED FOR THIS
--
-- 20260817020000 dropped `booking_request_notify` for two reasons. Only one of
-- them was about triggers.
--
--   SIN 1 -- THE EVENT. It fired AFTER INSERT with no status filter. The row is
--   inserted at STEP 3 as an 'abandoned' LEAD while the customer is still typing
--   their name, so owners were emailed "New booking request" three minutes
--   before any payment, and again for every visitor who reached step 3 and left.
--   That is a bug in WHEN it fired, not in the mechanism. This trigger fires on
--   status BECOMING 'pending' -- which happens exactly once, at completion, and
--   never on a lead row.
--
--   SIN 2 -- THE INVISIBLE CALLER. A row in pg_trigger that no codebase search
--   can find. That is genuine and does not fully go away; it is mitigated, not
--   waved off. The trigger and its function are in this committed migration, the
--   browser call site now carries a comment pointing here, and it is written up
--   in docs/KNOWN_ISSUES.md. If you are hunting for who sends the owner email,
--   this file is the answer.
--
-- WHY NOT PUT THE CALL IN complete_abandoned_booking INSTEAD
--
-- Because that RPC is only the PRIMARY path. When it fails, the browser falls
-- back to a direct INSERT with status='pending'. Notifying on one path and not
-- the other is precisely how this broke the first time, so the trigger covers
-- both: the UPDATE that completes a lead, and the INSERT that skips the lead.
--
-- WHY THE CRON SECRET AND NOT THE SERVICE KEY
--
-- booking-notify's secret-key check exists because an unauthenticated caller
-- could otherwise trigger an email to a business owner. That check is NOT
-- loosened here. Postgres presents `x-hubly-cron-secret` from Vault -- the same
-- pattern hubly-recurring-maintain already uses -- which is server-only and
-- never reaches a browser. The alternative, copying the service key into the
-- database, would duplicate the most privileged credential we have.

create or replace function public.notify_owner_on_booking_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  -- Nothing to say about a lead. This is the whole of Sin 1, in one line.
  if new.status is distinct from 'pending' then
    return new;
  end if;
  -- On UPDATE, only the TRANSITION into 'pending' is news. Editing the address
  -- on an already-pending booking must not re-email the owner.
  if tg_op = 'UPDATE' and old.status is not distinct from 'pending' then
    return new;
  end if;

  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'hubly_cron_secret';
  if v_secret is null then
    -- Loud, not silent: a missing secret here means owners stop being told, and
    -- that is exactly the failure this migration exists to end.
    raise warning 'notify_owner_on_booking_completion: hubly_cron_secret missing; owner NOT notified for booking %', new.id;
    return new;
  end if;

  -- Fire and forget by design: net.http_post queues the request and returns
  -- immediately. An email problem must never roll back a completed booking.
  perform net.http_post(
    url := 'https://rtwxxkxpkqdrhclkozma.supabase.co/functions/v1/booking-notify',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-hubly-cron-secret', v_secret
    ),
    -- booking-notify expects the old trigger's payload shape ({ record }); see
    -- _shared/booking_notify_call.ts, which sends the same thing.
    body := jsonb_build_object(
      'record', to_jsonb(new),
      'hubly_notify_reason', case when tg_op = 'INSERT' then 'created' else 'completed' end
    )
  );
  return new;
end;
$$;

revoke all on function public.notify_owner_on_booking_completion() from public, anon, authenticated;

drop trigger if exists booking_request_completed_notify on public.booking_requests;
create trigger booking_request_completed_notify
  after insert or update of status on public.booking_requests
  for each row
  execute function public.notify_owner_on_booking_completion();

-- What is now attached to this table, so the next person does not have to guess.
select t.tgname,
       case when t.tgtype::int & 4 > 0 then 'INSERT ' else '' end ||
       case when t.tgtype::int & 16 > 0 then 'UPDATE ' else '' end as fires_on
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
 where c.relname = 'booking_requests' and not t.tgisinternal;
