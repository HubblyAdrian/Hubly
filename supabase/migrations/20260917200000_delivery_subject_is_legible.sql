-- ══ ONE LABEL FOR ONE THING, AND AN ORPHAN THAT CAN STILL BE READ ═══════════════════════════
--
-- TWO DEFECTS IN THE DELIVERY LEDGER, both found on 2026-09-17 by the ledger failing to answer
-- a question it exists to answer.
--
-- 1. TWO LABELS FOR ONE THING. The pre-call row written by this trigger says
--    subject_type='booking'; booking-notify's own insert says 'booking_request'. One writer pair,
--    two names for the same subject. It made a count wrong in exactly the way a hand-maintained
--    vocabulary always does: a sweep filtered on one label and reported "no booking email has ever
--    been sent" while FOUR were recorded sent under the other.
--
--    The canonical label is the TABLE THE SUBJECT LIVES IN: 'booking_request'. It is what
--    business_events already uses for the same subject, so this is aligning with the existing
--    answer rather than inventing a third.
--
-- 2. subject_id IS NOT A FOREIGN KEY, SO THE LEDGER OUTLIVES ITS SUBJECT. It cannot become one:
--    the column is polymorphic (a booking_requests id for a booking, a businesses id for a
--    signup), and a polymorphic column cannot reference one table. Adrian: "make it one, or make
--    the orphan legible. Do not leave it as a silent unattributable row."
--
--    So it is made LEGIBLE. Two rows on adrians-lawn-service from 2026-09-17 02:35 point at
--    booking_requests ids that exist in no table — the bookings were deleted afterwards (the
--    table carries an owner-delete policy) — and NOTHING about those rows says what they were
--    about. subject_label is written AT THE SAME MOMENT as the row, from the subject that is in
--    hand, so a deleted subject leaves a readable record instead of a uuid pointing at nothing.
--
--    It records only what the trigger can see on the row it is firing for. It is not a summary
--    and it is not looked up later: a label assembled after the fact would be exactly the
--    fabricated record this table exists to prevent.

alter table public.notification_deliveries
  add column if not exists subject_label text;

comment on column public.notification_deliveries.subject_label is
  'What this row was about, in words, captured when the row was written. The ledger outlives its '
  'subject (subject_id is polymorphic and cannot be a foreign key), so without this an orphaned '
  'row is an unattributable uuid. Written once, never recomputed.';

-- The trigger, unchanged except for the canonical label and the new column.
-- Everything else is verbatim from 20260822140000_notification_pending_status.sql.
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
  --
  -- AND IT SAYS WHAT IT IS ABOUT. A row whose booking is later deleted is otherwise a uuid
  -- pointing at nothing; this is the one moment the subject is in hand.
  insert into public.notification_deliveries
    (business_id, subject_type, subject_id, recipient_role, channel, provider, status, subject_label)
  values (new.business_id, 'booking_request', new.id, 'owner', 'email', 'resend', 'pending',
          left(concat_ws(' · ',
               nullif(new.customer_name, ''),
               nullif(new.service_name, ''),
               nullif(new.requested_date::text, ''),
               nullif(new.requested_time, '')), 200))
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

-- HISTORY IS NOT REWRITTEN. The three rows already carrying subject_type='booking' stay as they
-- are: they are what happened, and relabelling them would make the ledger say something it did not
-- say at the time. Readers accept both and scripts/check-one-delivery-label.mjs asserts that no NEW
-- writer introduces a third.
