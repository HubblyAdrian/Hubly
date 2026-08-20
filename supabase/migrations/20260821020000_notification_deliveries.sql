-- "Did the owner get told?" must be answerable with a query.
--
-- WHY
--
-- booking-notify returned {ok:true} whether or not the mail provider accepted
-- the message. sendEmail swallowed failures:
--
--   if (!res.ok) console.error('Resend error', await res.text());
--
-- and the handler carried on and reported success. So the HTTP 200 recorded in
-- net._http_response after a real booking proved the notify PATH ran — it
-- proved nothing about whether anything was delivered. The single step the
-- business owner actually cares about was the only one with no success signal,
-- and the only trace of a failure would have been a log line in a system whose
-- log query API was returning backend errors that same afternoon.
--
-- This table is the answer: one row per recipient per attempt, written whether
-- the send succeeded or failed.
--
-- WHAT 'sent' HONESTLY MEANS
--
-- It means the provider ACCEPTED the message and returned an id. It does not
-- mean it reached an inbox — that is a webhook (delivered/bounced/complained)
-- we do not consume yet, and pretending otherwise would repeat the exact sin
-- this table exists to end. The status vocabulary is deliberately small and
-- deliberately honest:
--
--   sent      the provider accepted it, and provider_message_id is its receipt
--   failed    the provider rejected it, or the call threw; `error` says why
--   skipped   there was no address to send to at all
--
-- 'skipped' is not a failure and is not a success. A business with no email on
-- file cannot be notified, and that is a fact worth being able to count —
-- before this migration it was indistinguishable from a delivered message.

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  -- The thing being notified about. Deliberately loose: booking is the first
  -- caller, not the only intended one.
  subject_type text not null,
  subject_id uuid,
  -- Who this particular row is about. One send = one row, so an owner email
  -- that fails and a customer email that succeeds are never conflated.
  recipient_role text not null,
  recipient text,
  channel text not null default 'email',
  provider text,
  provider_message_id text,
  status text not null,
  error text,
  attempted_at timestamptz not null default now(),
  constraint notification_deliveries_status_check
    check (status in ('sent', 'failed', 'skipped'))
);

comment on table public.notification_deliveries is
  'One row per notification recipient per attempt. Exists so "did the owner get '
  'told?" is a query rather than a mailbox search. status=sent means the '
  'provider ACCEPTED the message (provider_message_id is the receipt), not that '
  'it reached an inbox — delivery/bounce webhooks are not consumed yet.';

create index if not exists notification_deliveries_subject_idx
  on public.notification_deliveries (subject_type, subject_id, attempted_at desc);
create index if not exists notification_deliveries_business_idx
  on public.notification_deliveries (business_id, attempted_at desc);
-- The query this table is FOR: what failed, most recent first.
create index if not exists notification_deliveries_failures_idx
  on public.notification_deliveries (attempted_at desc) where status <> 'sent';

alter table public.notification_deliveries enable row level security;

-- No anon access at all. A delivery log names customer email addresses; the
-- only readers are the service role (which bypasses RLS) and, later, an owner
-- looking at their own notifications through a scoped RPC.
revoke all on public.notification_deliveries from anon, authenticated;
