-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ACCEPTING A QUOTE. It CARRIES FORWARD; it is never retyped.
--
-- ADRIAN, 2026-09-16: "A quote is a lead with a price on it; an accepted one carries forward, it is
-- never retyped."
--
-- ══ WHY THE JOB IS BUILT HERE AND NOT IN THE BROWSER ═════════════════════════════════════════
--
-- "Never retyped" is not a UI convenience, it is a guarantee about WHERE THE VALUES COME FROM. A
-- client that reads the quote, builds a job object and posts it has re-entered every field — and
-- anything it drops, reformats or rounds on the way is a difference between what he quoted and what
-- he is about to do. Building the job FROM THE QUOTE ROW, in one statement, means the customer name,
-- the work and the money are the same bytes.
--
-- And it is ATOMIC. A client doing this in two calls can create the job and fail to mark the quote,
-- leaving a quote he chases and a job he already has — the duplicate-lead defect, one table over.
--
-- ══ WHAT THE JOB GETS, AND WHAT IT REFUSES TO INVENT ════════════════════════════════════════
--
--   customer_name / phone / email   the quote's own
--   service_name                    the quote's LINES, joined — his own words, in his own order
--   amount                          total_cents / 100, the number he read aloud AFTER the discount
--   notes                           the arithmetic, written out, so the job can be read aloud too
--   scheduled_date / time           NULL. **He has not said when.** A job dated today because a
--                                   quote was accepted today is a date nobody stated, and it would
--                                   land on My Day as work a customer is expecting.
--
-- ══ IT REFUSES MORE THAN IT ACCEPTS ═════════════════════════════════════════════════════════
--
-- A quote already accepted cannot be accepted again (that is how one quote becomes two jobs). A
-- declined one cannot be accepted without being re-opened first — silently reviving it would hide a
-- decision he made. And a quote with no lines has nothing to carry.
-- ════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.accept_quote(
  p_quote_id uuid, p_owner_id uuid, p_as text default 'job'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  q public.quotes;
  v_service text;
  v_notes text;
  v_job_id uuid;
begin
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null or not public.hubly_owns_business(q.business_id, p_owner_id) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  if q.status = 'accepted' then
    return jsonb_build_object('ok', false, 'error', 'already_accepted',
                              'became', q.became, 'job_id', q.became_job_id);
  end if;
  if q.status = 'declined' then
    return jsonb_build_object('ok', false, 'error', 'declined');
  end if;
  if coalesce(jsonb_array_length(q.lines), 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_lines');
  end if;
  if coalesce(p_as, 'job') <> 'job' then
    -- BOOKING IS NOT BUILT AND SAYS SO, rather than quietly making a job and calling it a booking.
    return jsonb_build_object('ok', false, 'error', 'only_job');
  end if;

  -- HIS OWN WORDS, IN HIS OWN ORDER. jsonb_array_elements preserves array order.
  select string_agg(x->>'name', ' + ' order by ord)
    into v_service
    from jsonb_array_elements(q.lines) with ordinality as t(x, ord);

  -- THE ARITHMETIC TRAVELS WITH THE JOB. He read it aloud once; the job should be readable aloud too,
  -- and "why is this $193.50" must not require opening the quote.
  v_notes := 'From a quote. ' ||
    case when q.discount_cents > 0
      then 'Usual price $' || trim(to_char(q.subtotal_cents / 100.0, 'FM999999990.00')) || '. ' ||
           coalesce(q.discount_words, 'Discount') || ' is $' ||
           trim(to_char(q.discount_cents / 100.0, 'FM999999990.00')) || ' off. Total $' ||
           trim(to_char(q.total_cents / 100.0, 'FM999999990.00')) || '.'
      else 'Total $' || trim(to_char(q.total_cents / 100.0, 'FM999999990.00')) || '.'
    end;

  insert into public.jobs
    (business_id, customer_name, service_name, amount, notes, phone, email, status,
     scheduled_date, scheduled_time)
  values
    (q.business_id, coalesce(q.customer_name, 'Someone'), coalesce(v_service, 'Quoted work'),
     (q.total_cents / 100.0)::numeric, v_notes, q.customer_phone, q.customer_email, 'scheduled',
     null, null)
  returning id into v_job_id;

  update public.quotes
     set status = 'accepted', became = 'job', became_job_id = v_job_id,
         decided_at = now(), updated_at = now()
   where id = p_quote_id;

  return jsonb_build_object('ok', true, 'job_id', v_job_id, 'became', 'job',
                            'service_name', v_service, 'amount_cents', q.total_cents,
                            'customer_name', q.customer_name);
end;
$$;

grant execute on function public.accept_quote(uuid,uuid,text) to authenticated, service_role;
