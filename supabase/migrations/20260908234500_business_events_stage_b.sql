-- STAGE B — the other things that come through the front door.
--
-- Two new kinds, NOT three. The brief named "chat, question, and unfinished booking".
-- The reads K6 built support two distinct things:
--   chat.asked        — someone asked on the site and did not book  (chatbot_conversations)
--   booking.abandoned — someone started the booking form and stopped (booking_requests)
-- "Chat" and "question" are the same row read the same way; inventing a third kind to
-- match the count would be a category with no data behind it, which is the thing this
-- whole stream is built to avoid. Said plainly rather than padded.
--
-- THEY ARE NEVER BLENDED. "Someone asked about Saturday and didn't book" and "someone got
-- halfway through booking a Full Detail" are different levels of intent and an owner acts
-- on them differently. Separate kinds here, separate sentences in the reader.
--
-- Same rules as Stage A: every event is a row somewhere real, every source nominates an
-- IMMUTABLE occurred_at, card fields join at read time.
create or replace view public.business_events as
  select
    b.business_id,
    'booking_request:' || b.id::text  as event_id,
    'booking.created'                 as kind,
    b.created_at                      as occurred_at,
    'booking_request'                 as subject_type,
    b.id                              as subject_id,
    b.customer_name, b.customer_phone, b.customer_email,
    b.service_name,
    b.requested_date                  as event_date,
    b.requested_time::text            as event_time,
    b.address, b.vehicle_type         as vehicle,
    b.notes,
    b.status,
    (b.amount_due_cents / 100.0)      as amount
  from public.booking_requests b
  where coalesce(b.status, '') <> 'abandoned'
  union all
  -- An unfinished booking FORM. Higher intent than a question: they were filling it in.
  select
    b.business_id,
    'booking_abandoned:' || b.id::text,
    'booking.abandoned',
    b.created_at,
    'booking_request',
    b.id,
    b.customer_name, b.customer_phone, b.customer_email,
    b.service_name,
    b.requested_date,
    b.requested_time::text,
    b.address, b.vehicle_type,
    b.notes,
    b.status,
    (b.amount_due_cents / 100.0)
  from public.booking_requests b
  where b.status = 'abandoned'
  union all
  select
    j.business_id,
    'job:' || j.id::text,
    'booking.created',
    j.created_at,
    'job',
    j.id,
    j.customer_name, j.phone, j.email,
    j.service_name,
    j.scheduled_date,
    j.scheduled_time::text,
    j.address, j.vehicle,
    j.notes,
    j.status,
    j.amount::numeric
  from public.jobs j
  where j.from_booking = true and j.booking_request_id is null
  union all
  -- SOMEONE ASKED AND DID NOT BOOK. The useful content is what they actually asked, in
  -- their words — carried in `notes` so the card renders it as a field like any other.
  -- Message bodies age out at 90 days (purge_old_visitor_messages), so an old conversation
  -- legitimately has no question text; the reader says the transcript is past retention
  -- rather than implying they asked nothing.
  select
    c.business_id,
    'chat:' || c.id::text,
    'chat.asked',
    c.started_at,
    'chat_conversation',
    c.id,
    c.customer_name, c.customer_phone, c.customer_email,
    null::text,                                   -- no service: they asked, they did not pick
    null::date,
    null::text,
    null::text,
    null::text,
    (select m.content from public.chatbot_messages m
      where m.conversation_id = c.id and m.role = 'customer'
      order by m.created_at asc limit 1),         -- their first question, verbatim
    null::text,
    null::numeric
  from public.chatbot_conversations c
  where c.resulted_in_booking = false;
