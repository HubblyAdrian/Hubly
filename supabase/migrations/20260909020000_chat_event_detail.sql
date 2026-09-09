-- Give the chat-lead card what the rows honestly hold, and nothing they do not.
--
-- ADDED: message_count (how many times they wrote), other_asks (their questions after the
-- first), consented (they agreed to be contacted). All read from chatbot_messages /
-- chatbot_conversations.
--
-- DELIBERATELY NOT ADDED: which page they were on. chatbot_conversations has no page or
-- referrer column and there is no join key to page_loads, so there is no honest way to say
-- it. A field invented to make the card look fuller is the card lying about its own depth.
-- If the card is thin because the data is thin, thin is the answer.
--
-- topics exists and is non-null on the 12 legacy rows, but the concierge writer never sets
-- it, so it would be present for old conversations and absent for every new one. A field
-- that is populated only by history reads as missing data rather than as no data. Left out.
drop function if exists public.get_business_events(uuid, uuid, int);

create or replace view public.business_events as
  select b.business_id, 'booking_request:' || b.id::text as event_id, 'booking.created' as kind,
    b.created_at as occurred_at, 'booking_request' as subject_type, b.id as subject_id,
    b.customer_name, b.customer_phone, b.customer_email, b.service_name,
    b.requested_date as event_date, b.requested_time::text as event_time,
    b.address, b.vehicle_type as vehicle, b.notes, b.status,
    (b.amount_due_cents / 100.0) as amount,
    null::bigint as message_count, null::text as other_asks, null::boolean as consented
  from public.booking_requests b where coalesce(b.status,'') <> 'abandoned'
  union all
  select b.business_id, 'booking_abandoned:' || b.id::text, 'booking.abandoned',
    b.created_at, 'booking_request', b.id,
    b.customer_name, b.customer_phone, b.customer_email, b.service_name,
    b.requested_date, b.requested_time::text, b.address, b.vehicle_type, b.notes, b.status,
    (b.amount_due_cents / 100.0), null::bigint, null::text, null::boolean
  from public.booking_requests b where b.status = 'abandoned'
  union all
  select j.business_id, 'job:' || j.id::text, 'booking.created', j.created_at, 'job', j.id,
    j.customer_name, j.phone, j.email, j.service_name,
    j.scheduled_date, j.scheduled_time::text, j.address, j.vehicle, j.notes, j.status,
    j.amount::numeric, null::bigint, null::text, null::boolean
  from public.jobs j where j.from_booking = true and j.booking_request_id is null
  union all
  select c.business_id, 'chat:' || c.id::text, 'chat.asked', c.started_at,
    'chat_conversation', c.id,
    c.customer_name, c.customer_phone, c.customer_email,
    null::text, null::date, null::text, null::text, null::text,
    (select m.content from public.chatbot_messages m
      where m.conversation_id = c.id and m.role = 'customer'
      order by m.created_at asc limit 1),
    null::text, null::numeric,
    (select count(*) from public.chatbot_messages m
      where m.conversation_id = c.id and m.role = 'customer'),
    (select string_agg(q.content, ' · ' order by q.created_at)
       from (select m.content, m.created_at from public.chatbot_messages m
             where m.conversation_id = c.id and m.role = 'customer'
             order by m.created_at asc offset 1 limit 3) q),
    c.consented_to_followup
  from public.chatbot_conversations c where c.resulted_in_booking = false;

create or replace function public.get_business_events(
  p_business_id uuid, p_owner_id uuid, p_limit int default 30
) returns table (
  event_id text, kind text, occurred_at timestamptz, subject_type text, subject_id uuid,
  customer_name text, customer_phone text, customer_email text, service_name text,
  event_date date, event_time text, address text, vehicle text, notes text, status text,
  amount numeric, message_count bigint, other_asks text, consented boolean, is_new boolean
) language plpgsql security definer set search_path = public as $$
declare seen timestamptz;
begin
  if p_owner_id is null or not exists (
    select 1 from public.businesses where id = p_business_id and owner_id = p_owner_id
  ) then return; end if;
  select r.last_seen_at into seen from public.business_event_reads r
    where r.business_id = p_business_id and r.owner_uid = p_owner_id;
  return query
    select e.event_id, e.kind, e.occurred_at, e.subject_type, e.subject_id,
           e.customer_name, e.customer_phone, e.customer_email, e.service_name,
           e.event_date, e.event_time, e.address, e.vehicle, e.notes, e.status, e.amount,
           e.message_count, e.other_asks, e.consented,
           (seen is null or e.occurred_at > seen) as is_new
    from public.business_events e
    where e.business_id = p_business_id
    order by e.occurred_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 100));
end; $$;
revoke all on function public.get_business_events(uuid, uuid, int) from public, anon;
grant execute on function public.get_business_events(uuid, uuid, int) to authenticated, service_role;
