-- ═══════════════════════════════════════════════════════════════════════════════
-- ANYTHING HUBLY STORES ABOUT A BUSINESS, ITS OWNER MUST BE ABLE TO ASK ABOUT.
--
-- The reader had six slices; the database holds far more, and every gap between the
-- two is a question an owner asks about his own business that Hubly cannot answer.
-- See docs/BACKEND_ANSWERABLE.md for the full map.
--
-- WHY THESE ARE SQL FUNCTIONS AND NOT MORE PostgREST SELECTS
--
-- Because of "what are my most popular services?" — a promise that was answerable
-- and WRONG. The model would have counted the rows it was handed, and it is handed
-- a list truncated at MAX_ROWS, so the ranking would have been computed over a
-- slice of the truth and stated with full confidence.
--
-- So: where the answer is an AGGREGATE — how many, which is most, what is the
-- total, who is the biggest — it is a GROUP BY here, over every row, and the slice
-- returns the computed answer. Rows travel to the model only when rows ARE the
-- answer. A count is either a real count or it is labelled; "you have 40 customers"
-- when the cap is 40 is a lie wearing a number.
--
-- SECURITY: every function takes p_owner_id (already verified against a real JWT by
-- the caller) and re-checks it owns THIS business before reading anything. Same gate
-- as loadOperationalState, restated per function because a function is reachable on
-- its own.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.hubly_owns_business(p_business_id uuid, p_owner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_owner_id is not null and exists (
    select 1 from public.businesses where id = p_business_id and owner_id = p_owner_id
  );
$$;

-- ── CUSTOMERS ────────────────────────────────────────────────────────────────
-- A home-service business IS its customer list, and Hubly held 17 of them while
-- showing an owner none.
--
-- IDENTITY. Two rows that are the same person must not read as two customers, and
-- two people who happen to share a name must never be merged. So rows are folded on
-- normalised PHONE first, then EMAIL, and NAME IS NEVER A MATCH KEY — the same rule
-- the customer resolver uses at write time, restated here because a read that
-- merges differently from the writer invents a person. A row with neither phone nor
-- email folds onto nothing and stands alone: where the data genuinely cannot tell,
-- show what exists rather than guessing.
--
-- last_seen / last_service are JOINED FROM JOBS, because that is where the service
-- and the date actually live. A customer with no job has no last_seen, and the
-- column comes back null rather than being filled with created_at, which would
-- answer "when did I last do their truck" with the day they were added.
create or replace function public.get_business_customers(
  p_business_id uuid, p_owner_id uuid, p_limit integer default 8
) returns table (
  identity_key text, name text, phone text, email text, vehicle text,
  first_added timestamptz, last_seen date, last_service text,
  visits integer, total_billed numeric, merged_rows integer
) language sql stable security definer set search_path = public as $$
  with owned as (select public.hubly_owns_business(p_business_id, p_owner_id) as ok),
  c as (
    select cu.*,
      -- The fold key. digits-only phone, else lowercased email, else the row's own
      -- id cast to text — which can never collide, so an anonymous row stays itself.
      coalesce(
        nullif(regexp_replace(coalesce(cu.phone,''), '\D', '', 'g'), ''),
        nullif(lower(btrim(coalesce(cu.email,''))), ''),
        cu.id::text
      ) as k
    from public.customers cu, owned
    where owned.ok and cu.business_id = p_business_id
  ),
  j as (
    select jb.customer_id, jb.phone, jb.email, jb.service_name, jb.scheduled_date, jb.amount
    from public.jobs jb, owned
    where owned.ok and jb.business_id = p_business_id
  ),
  -- Jobs attach to a customer by customer_id when it is set, and otherwise by the
  -- SAME fold key — a job written from a booking often carries the phone and no id.
  jk as (
    select coalesce(
             (select k from c where c.id = j.customer_id),
             nullif(regexp_replace(coalesce(j.phone,''), '\D', '', 'g'), ''),
             nullif(lower(btrim(coalesce(j.email,''))), '')
           ) as k,
           j.service_name, j.scheduled_date, j.amount
    from j
  ),
  agg as (
    select k,
           count(*)::int as visits,
           coalesce(sum(amount), 0)::numeric as total_billed,
           max(scheduled_date) as last_seen
    from jk where k is not null group by k
  ),
  last_svc as (
    select distinct on (k) k, service_name
    from jk where k is not null and service_name is not null
    order by k, scheduled_date desc nulls last
  ),
  folded as (
    select k as identity_key,
           -- The longest non-empty name across the folded rows: two rows for one
           -- person are usually "Dana" and "Dana Whitfield", and the fuller one is
           -- the more useful thing to say back. Never a name we composed.
           (array_agg(name order by length(coalesce(name,'')) desc nulls last))[1] as name,
           (array_agg(phone order by length(coalesce(phone,'')) desc nulls last))[1] as phone,
           (array_agg(email order by length(coalesce(email,'')) desc nulls last))[1] as email,
           (array_agg(vehicle order by created_at desc))[1] as vehicle,
           min(created_at) as first_added,
           count(*)::int as merged_rows
    from c group by k
  )
  select f.identity_key, f.name, f.phone, f.email, f.vehicle, f.first_added,
         a.last_seen, s.service_name as last_service,
         coalesce(a.visits, 0) as visits,
         coalesce(a.total_billed, 0) as total_billed,
         f.merged_rows
  from folded f
  left join agg a on a.k = f.identity_key
  left join last_svc s on s.k = f.identity_key
  order by a.last_seen desc nulls last, f.first_added desc
  limit greatest(coalesce(p_limit, 8), 1);
$$;

-- The true count, so the slice can say "showing 8 of 41" instead of implying 8 is all.
create or replace function public.get_business_customer_count(p_business_id uuid, p_owner_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((
    select count(distinct coalesce(
      nullif(regexp_replace(coalesce(phone,''), '\D', '', 'g'), ''),
      nullif(lower(btrim(coalesce(email,''))), ''),
      id::text))::int
    from public.customers
    where business_id = p_business_id
      and public.hubly_owns_business(p_business_id, p_owner_id)
  ), 0);
$$;

-- ── SALES ────────────────────────────────────────────────────────────────────
-- "Check my sales" read commerce_orders only, so it was blank for every business
-- without a Store while jobs.amount sat there holding the money he actually earned.
-- Sales means what he EARNED, from jobs and orders both.
--
-- AND IT LOOKS BACKWARDS. The jobs slice filters scheduled_date >= today, which made
-- "what did I make last month" unanswerable in principle rather than merely
-- incomplete. Past and future are both real questions; the period is an argument.
create or replace function public.get_business_sales(
  p_business_id uuid, p_owner_id uuid,
  p_from date default null, p_to date default null
) returns table (
  source text, period_from date, period_to date,
  n integer, gross numeric, paid_gross numeric, unpaid_gross numeric
) language sql stable security definer set search_path = public as $$
  with owned as (select public.hubly_owns_business(p_business_id, p_owner_id) as ok),
  bounds as (select coalesce(p_from, date '1900-01-01') as lo, coalesce(p_to, date '2999-12-31') as hi)
  select 'jobs'::text, b.lo, b.hi,
         count(*)::int,
         coalesce(sum(j.amount), 0)::numeric,
         coalesce(sum(j.amount) filter (where j.paid), 0)::numeric,
         coalesce(sum(j.amount) filter (where not coalesce(j.paid, false)), 0)::numeric
  from public.jobs j, owned, bounds b
  where owned.ok and j.business_id = p_business_id
    and j.scheduled_date between b.lo and b.hi
  group by b.lo, b.hi
  union all
  select 'orders'::text, b.lo, b.hi,
         count(*)::int,
         coalesce(sum(o.total_cents), 0)::numeric / 100,
         coalesce(sum(o.total_cents) filter (where o.paid_at is not null), 0)::numeric / 100,
         coalesce(sum(o.total_cents) filter (where o.paid_at is null), 0)::numeric / 100
  from public.commerce_orders o, owned, bounds b
  where owned.ok and o.business_id = p_business_id
    and (o.created_at at time zone 'utc')::date between b.lo and b.hi
  group by b.lo, b.hi;
$$;

-- ── WHICH SERVICE SELLS MOST ─────────────────────────────────────────────────
-- The promise that was answerable and wrong. Counted here over EVERY job and EVERY
-- booking, never over a truncated list handed to the model.
create or replace function public.get_business_service_stats(
  p_business_id uuid, p_owner_id uuid,
  p_from date default null, p_to date default null
) returns table (service_name text, times_booked integer, gross numeric, last_on date)
language sql stable security definer set search_path = public as $$
  with owned as (select public.hubly_owns_business(p_business_id, p_owner_id) as ok),
  bounds as (select coalesce(p_from, date '1900-01-01') as lo, coalesce(p_to, date '2999-12-31') as hi),
  all_rows as (
    select j.service_name, j.amount, j.scheduled_date as on_date
    from public.jobs j, owned, bounds b
    where owned.ok and j.business_id = p_business_id and j.scheduled_date between b.lo and b.hi
    union all
    -- A booking that never became a job is still demand for that service. Counted,
    -- and its money is not: amount_due_cents is what was asked for, not earned.
    select br.service_name, null::numeric, br.requested_date
    from public.booking_requests br, owned, bounds b
    where owned.ok and br.business_id = p_business_id
      and br.status <> 'abandoned'
      and br.requested_date between b.lo and b.hi
  )
  select coalesce(nullif(btrim(service_name), ''), 'unnamed service') as service_name,
         count(*)::int as times_booked,
         coalesce(sum(amount), 0)::numeric as gross,
         max(on_date) as last_on
  from all_rows
  group by 1
  order by times_booked desc, gross desc;
$$;

drop function if exists public.get_business_hours(uuid, uuid);
-- ── HOURS, AND THERE ARE TWO STORES ──────────────────────────────────────────
-- The inventory found settings_business_hours: 126 rows, 23 businesses. It did not
-- find the second one, and a reader built on the first alone would have told GRAEF —
-- the one customer being saved — "no hours on record" while his own page shows them.
--
--   settings_business_hours   23 businesses   weekday 0..6, open_time/close_time/closed
--   businesses.meta.hours     10 businesses   {"Mon":{"open":"08:00","close":"17:00","closed":false}, …}
--   both                       1 business
--   → 32 distinct businesses have hours SOMEWHERE. Graef is in the meta group.
--
-- This is the "enumerate the harmless side" rule again: a list of the shapes a fact
-- can take undercounts, every time, because the fact turns up wearing a form nobody
-- listed. So the reader reads BOTH and normalises to weekday 0..6, and where the two
-- disagree it says so rather than silently preferring one.
--
-- NO THIRD SHAPE IS INVENTED. weekday 0..6 is the table's own shape; meta's day names
-- are mapped onto it.
create or replace function public.get_business_hours(p_business_id uuid, p_owner_id uuid)
returns table (weekday integer, open_time time, close_time time, closed boolean, source text, conflicts boolean)
language sql stable security definer set search_path = public as $$
  with owned as (select public.hubly_owns_business(p_business_id, p_owner_id) as ok),
  tbl as (
    select h.weekday, h.open_time, h.close_time, coalesce(h.closed,false) as closed
    from public.settings_business_hours h, owned
    where owned.ok and h.business_id = p_business_id
  ),
  meta as (
    select d.idx as weekday,
           nullif(e.value->>'open','')::time  as open_time,
           nullif(e.value->>'close','')::time as close_time,
           coalesce((e.value->>'closed')::boolean, false) as closed
    from public.businesses b, owned,
         lateral jsonb_each(case when jsonb_typeof((b.meta::jsonb)->'hours')='object'
                                 then (b.meta::jsonb)->'hours' else '{}'::jsonb end) e,
         lateral (select idx from (values
            ('Sun',0),('Mon',1),('Tue',2),('Wed',3),('Thu',4),('Fri',5),('Sat',6),
            ('Sunday',0),('Monday',1),('Tuesday',2),('Wednesday',3),('Thursday',4),('Friday',5),('Saturday',6)
         ) as m(nm, idx) where lower(m.nm) = lower(e.key)) d
    where owned.ok and b.id = p_business_id
  )
  select coalesce(t.weekday, m.weekday) as weekday,
         coalesce(t.open_time, m.open_time) as open_time,
         coalesce(t.close_time, m.close_time) as close_time,
         coalesce(t.closed, m.closed) as closed,
         case when t.weekday is not null and m.weekday is not null then 'both'
              when t.weekday is not null then 'settings_business_hours'
              else 'meta.hours' end as source,
         -- Says it rather than picking a winner quietly.
         (t.weekday is not null and m.weekday is not null
          and (t.open_time is distinct from m.open_time
            or t.close_time is distinct from m.close_time
            or t.closed is distinct from m.closed)) as conflicts
  from tbl t full outer join meta m on m.weekday = t.weekday
  order by 1;
$$;

-- THE WRITER WRITES BOTH, and that is not a convenience.
-- A classic page renders its hours from meta.hours. Writing only the table would be a
-- write that reports success and changes nothing the owner or his customers can see —
-- the exact defect prohibition 2 exists for. One statement of hours, both stores.
--
-- A weekday absent from the payload is LEFT ALONE rather than deleted: "we open at 8
-- on Saturdays now" must not silently wipe the rest of the week.
create or replace function public.set_business_hours(
  p_business_id uuid, p_owner_id uuid, p_hours jsonb
) returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; cur jsonb; e jsonb; nm text;
begin
  if not public.hubly_owns_business(p_business_id, p_owner_id) then return -1; end if;
  if p_hours is null or jsonb_typeof(p_hours) <> 'array' then return 0; end if;

  insert into public.settings_business_hours (business_id, weekday, open_time, close_time, closed)
  select p_business_id, (x->>'weekday')::int,
         nullif(x->>'open','')::time, nullif(x->>'close','')::time,
         coalesce((x->>'closed')::boolean, false)
  from jsonb_array_elements(p_hours) x
  where (x->>'weekday') ~ '^[0-6]$'
  on conflict (business_id, weekday) do update
    set open_time = excluded.open_time, close_time = excluded.close_time, closed = excluded.closed;
  get diagnostics n = row_count;

  -- …and the shape the page actually renders from.
  select case when jsonb_typeof((meta::jsonb)->'hours')='object' then (meta::jsonb)->'hours' else '{}'::jsonb end
    into cur from public.businesses where id = p_business_id;
  for e in select * from jsonb_array_elements(p_hours) loop
    if (e->>'weekday') ~ '^[0-6]$' then
      nm := (array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[(e->>'weekday')::int + 1];
      cur := cur || jsonb_build_object(nm, jsonb_build_object(
        'open', e->>'open', 'close', e->>'close',
        'closed', coalesce((e->>'closed')::boolean, false)));
    end if;
  end loop;
  update public.businesses
     set meta = (coalesce(meta::jsonb, '{}'::jsonb) || jsonb_build_object('hours', cur))::text
   where id = p_business_id;

  return n;
end;
$$;

-- ── SERVICES ─────────────────────────────────────────────────────────────────
-- 253 rows across every claimed business. He can change them by talking and cannot
-- ask what they currently are.
create or replace function public.get_business_services(p_business_id uuid, p_owner_id uuid)
returns table (name text, price numeric, duration_hours numeric, description text, is_popular boolean)
language sql stable security definer set search_path = public as $$
  select s.name, s.price, s.duration_hours, s.description, s.is_popular
  from public.services s
  where s.business_id = p_business_id
    and public.hubly_owns_business(p_business_id, p_owner_id)
  order by s.sort_order nulls last, s.name;
$$;

-- ── NOTIFICATIONS ────────────────────────────────────────────────────────────
-- "Did my customer actually get the confirmation?" is a real question with a real
-- table behind it, and it is the kind of thing that erodes trust silently when
-- nobody can check. Delivery is best-effort by design; that makes it MORE important
-- that a failure is askable, not less.
create or replace function public.get_business_notifications(
  p_business_id uuid, p_owner_id uuid, p_limit integer default 8
) returns table (
  subject_type text, recipient_role text, recipient text, channel text,
  status text, error text, attempted_at timestamptz
) language sql stable security definer set search_path = public as $$
  select n.subject_type, n.recipient_role, n.recipient, n.channel, n.status, n.error, n.attempted_at
  from public.notification_deliveries n
  where n.business_id = p_business_id
    and public.hubly_owns_business(p_business_id, p_owner_id)
  order by n.attempted_at desc nulls last
  limit greatest(coalesce(p_limit, 8), 1);
$$;

create or replace function public.get_business_notification_stats(p_business_id uuid, p_owner_id uuid)
returns table (status text, n integer) language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(status), ''), 'unknown'), count(*)::int
  from public.notification_deliveries
  where business_id = p_business_id
    and public.hubly_owns_business(p_business_id, p_owner_id)
  group by 1 order by 2 desc;
$$;

-- JOBS THAT ATTACH TO NOBODY.
-- Found by seeding a clone: a customer with an email and no phone, whose jobs carry
-- neither customer_id nor any contact detail, read back as "never had a job on record"
-- while two of her jobs sat in the table. Matching her on NAME would fix the display
-- and break the rule that produced it — two people called Chris Alvarez are two
-- customers, and the same reasoning is what makes name unusable in the other direction.
--
-- So the count is surfaced instead of the guess. A number an owner can see beats a
-- link we cannot justify.
create or replace function public.get_business_unlinked_jobs(p_business_id uuid, p_owner_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((
    select count(*)::int from public.jobs j
    where j.business_id = p_business_id
      and public.hubly_owns_business(p_business_id, p_owner_id)
      and j.customer_id is null
      and nullif(regexp_replace(coalesce(j.phone,''), '\D', '', 'g'), '') is null
      and nullif(lower(btrim(coalesce(j.email,''))), '') is null
  ), 0);
$$;
grant execute on function public.get_business_unlinked_jobs(uuid, uuid) to authenticated, service_role;

-- The rest of what an owner can ask about. Each is a reader over a table the
-- inventory found owner-facing and unreadable. Several are EMPTY today, and a reader
-- over an empty table is not wasted work — "memberships: none on record" is the
-- answer to a real question, and it is the answer that establishes what the
-- membership cards on a live page actually are.
create or replace function public.get_business_catalogue(p_business_id uuid, p_owner_id uuid)
returns table (kind text, name text, detail text, extra text)
language sql stable security definer set search_path = public as $$
  with owned as (select public.hubly_owns_business(p_business_id, p_owner_id) as ok)
  select 'product', p.name,
         case when p.price_cents is not null then '$'||round(p.price_cents/100.0,2)::text else 'no price' end,
         coalesce(p.status::text,'?')||' · '||coalesce(p.visibility::text,'?')||
           case when p.track_inventory then ' · '||coalesce(p.inventory,0)::text||' in stock' else '' end
  from public.commerce_products p, owned where owned.ok and p.business_id = p_business_id
  union all
  select 'variant', v.name, coalesce('$'||round(v.price_cents/100.0,2)::text,'no price'),
         case when v.inventory is not null then v.inventory::text||' in stock' else null end
  from public.commerce_product_variants v, owned where owned.ok and v.business_id = p_business_id
  union all
  select 'collection', c.name, null, case when c.published then 'published' else 'not published' end
  from public.commerce_collections c, owned where owned.ok and c.business_id = p_business_id
  union all
  select 'sold_item', i.title, coalesce('$'||round(i.total_cents/100.0,2)::text,''), 'qty '||coalesce(i.qty,0)::text
  from public.commerce_order_items i, owned where owned.ok and i.business_id = p_business_id
  union all
  select 'store_setting', 'store', coalesce(s.currency,'?'),
         case when s.enabled then 'enabled' else 'not enabled' end
  from public.commerce_store_settings s, owned where owned.ok and s.business_id = p_business_id;
$$;

-- WHAT IS ON THE PAGE AS A RECORD, vs what is on it as text. This slice is how the
-- Graef question gets answered: his live page shows 2 membership cards and 2 reviews,
-- and both these tables are EMPTY for him — so those cards are text he typed, not
-- records, and "Graef has memberships" is false in every sense the product can act on.
create or replace function public.get_business_page_records(p_business_id uuid, p_owner_id uuid)
returns table (kind text, n integer, sample text)
language sql stable security definer set search_path = public as $$
  with owned as (select public.hubly_owns_business(p_business_id, p_owner_id) as ok)
  select 'memberships', count(*)::int, (array_agg(plan_name order by created_at))[1]
    from public.memberships, owned where owned.ok and business_id = p_business_id
  union all
  select 'reviews', count(*)::int, (array_agg(customer_name order by created_at))[1]
    from public.review_submissions, owned where owned.ok and business_id = p_business_id
  union all
  select 'recurring_schedules', count(*)::int, (array_agg(service_name order by created_at))[1]
    from public.recurring_schedules, owned where owned.ok and business_id = p_business_id
  union all
  select 'own_photos', count(*)::int, null from public.portfolio_photos, owned
    where owned.ok and business_id = p_business_id
  union all
  select 'stock_photos_placed', count(*)::int, (array_agg(provider))[1] from public.placed_images, owned
    where owned.ok and business_id = p_business_id
  union all
  select 'before_after_pairs', count(*)::int, null from public.gallery_items, owned
    where owned.ok and business_id = p_business_id
  union all
  select 'service_photos', count(*)::int, null
    from public.service_photos sp join public.services sv on sv.id::text = sp.service_id::text, owned
    where owned.ok and sv.business_id = p_business_id
  union all
  select 'site_versions', count(*)::int, (array_agg(tag))[1] from public.business_documents, owned
    where owned.ok and business_id = p_business_id
  union all
  select 'rooms_in_sidebar', count(*)::int, (array_agg(kind order by sort_order))[1] from public.business_places, owned
    where owned.ok and business_id = p_business_id
  union all
  select 'calendar_events_synced', count(*)::int, null from public.google_calendar_events, owned
    where owned.ok and business_id = p_business_id;
$$;

-- CAN HE TAKE MONEY YET. Two rows exist across the whole corpus; an owner asking
-- "am I set up to get paid" deserves the real flags, not a guess.
create or replace function public.get_business_payments(p_business_id uuid, p_owner_id uuid)
returns table (mode text, charges_enabled boolean, payouts_enabled boolean, details_submitted boolean, last_error text, connected_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.mode, s.charges_enabled, s.payouts_enabled, s.details_submitted, s.last_error, s.connected_at
  from public.stripe_connect_accounts s
  where s.business_id = p_business_id and public.hubly_owns_business(p_business_id, p_owner_id)
  order by s.connected_at desc nulls last;
$$;

grant execute on function public.get_business_catalogue(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_business_page_records(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_business_payments(uuid, uuid) to authenticated, service_role;

-- has_hours missed the THIRD place hours live. It checked settings_business_hours and
-- businesses.hours_note, and not businesses.meta.hours — which is where Graef's are, and
-- which is the shape a classic page renders from. Restoring the "Set your opening hours"
-- suggestion on top of this would have offered the one customer we are saving a fix for
-- a gap he does not have.
--
-- Three stores for one fact, and the list of "places a fact can hide" has undercounted
-- every single time it has been written. Counted 2026-09-08:
--   settings_business_hours  23 businesses
--   businesses.meta.hours    10
--   businesses.hours_note     (free text)
create or replace function public.get_my_site_gaps(p_business_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when b.id is null then null else jsonb_build_object(
    'has_phone',    coalesce(nullif(btrim(b.phone), ''), '') <> '',
    'has_hours',    (exists (select 1 from public.settings_business_hours h where h.business_id = b.id)
                     or coalesce(nullif(btrim(b.hours_note), ''), '') <> ''
                     -- coalesce: a NULL meta makes the whole OR null, not false, and a
                     -- three-valued 'do they have hours' is a bug waiting for a caller.
                     or coalesce(jsonb_typeof((b.meta::jsonb)->'hours') = 'object', false)),
    'own_photos',   (select count(*) from public.service_photos p join public.services s on s.id = p.service_id where s.business_id = b.id),
    'services',     (select count(*) from public.services s where s.business_id = b.id),
    'services_no_desc', (select count(*) from public.services s where s.business_id = b.id and coalesce(nullif(btrim(s.description), ''), '') = ''),
    'has_priced_services', exists (select 1 from public.services s where s.business_id = b.id and s.price is not null and s.price > 0)
  ) end
  from (
    select id, phone, hours_note, meta from public.businesses
    where id = p_business_id and owner_id = auth.uid()
  ) b;
$$;
grant execute on function public.get_my_site_gaps(uuid) to authenticated, service_role;

revoke all on function public.hubly_owns_business(uuid, uuid) from public;
grant execute on function public.get_business_customers(uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.get_business_customer_count(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_business_sales(uuid, uuid, date, date) to authenticated, service_role;
grant execute on function public.get_business_service_stats(uuid, uuid, date, date) to authenticated, service_role;
grant execute on function public.get_business_hours(uuid, uuid) to authenticated, service_role;
grant execute on function public.set_business_hours(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.get_business_services(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_business_notifications(uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.get_business_notification_stats(uuid, uuid) to authenticated, service_role;
