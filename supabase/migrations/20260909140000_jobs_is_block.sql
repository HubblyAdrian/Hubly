-- ═══════════════════════════════════════════════════════════════════════════════
-- BLOCKED TIME GETS A REAL COLUMN.
--
-- A block was a job row whose customer_name is the literal string 'Blocked'
-- (hubly.html:15752, `isBlock: j.customer_name === 'Blocked'`). 100 references across
-- the client derive from that string — colours, filters, delete wording, counts, travel
-- buffers — and the storage under all of it is a magic value in a person's name column.
--
-- It is the defect class we spent 2026-09-08 removing, and it would corrupt the new
-- readers immediately: a block has no customer_id, phone or email, so it folds onto
-- nobody and lands in get_business_unlinked_jobs as "a job we could not attribute". A
-- dentist appointment is not an unattributed customer.
--
-- ZERO legacy rows (`select count(*) from jobs where customer_name='Blocked'` = 0), so
-- there is nothing to migrate and no back-compat read to keep.
alter table public.jobs add column if not exists is_block boolean not null default false;
create index if not exists jobs_business_block on public.jobs (business_id, is_block, scheduled_date);

-- ── A BLOCK IS IN NO CUSTOMER COUNT AND NO REVENUE FIGURE. ───────────────────
-- Time he set aside for a dentist appointment is not a customer and not money. These
-- three readers all counted every job row; each now excludes blocks explicitly rather
-- than relying on a block happening to have a null amount.

-- Unattributable jobs: a block attaches to nobody BY DESIGN, so counting it as a job we
-- failed to attribute would make the honest "we could not link these" number a lie.
create or replace function public.get_business_unlinked_jobs(p_business_id uuid, p_owner_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((
    select count(*)::int from public.jobs j
    where j.business_id = p_business_id
      and public.hubly_owns_business(p_business_id, p_owner_id)
      and not j.is_block
      and j.customer_id is null
      and nullif(regexp_replace(coalesce(j.phone,''), '\D', '', 'g'), '') is null
      and nullif(lower(btrim(coalesce(j.email,''))), '') is null
  ), 0);
$$;

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
    and not j.is_block                       -- blocked time is not revenue
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
    where owned.ok and j.business_id = p_business_id and not j.is_block
      and j.scheduled_date between b.lo and b.hi
    union all
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

-- get_business_customers folds JOBS onto customers by id/phone/email. A block has none
-- of those, so it already contributes nothing — but it would inflate nothing quietly
-- rather than by rule. Excluded by name here so the intent survives the next edit.
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
    where owned.ok and jb.business_id = p_business_id and not jb.is_block
  ),
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
    select k, count(*)::int as visits, coalesce(sum(amount),0)::numeric as total_billed,
           max(scheduled_date) as last_seen
    from jk where k is not null group by k
  ),
  last_svc as (
    select distinct on (k) k, service_name from jk
    where k is not null and service_name is not null
    order by k, scheduled_date desc nulls last
  ),
  folded as (
    select k as identity_key,
           (array_agg(name order by length(coalesce(name,'')) desc nulls last))[1] as name,
           (array_agg(phone order by length(coalesce(phone,'')) desc nulls last))[1] as phone,
           (array_agg(email order by length(coalesce(email,'')) desc nulls last))[1] as email,
           (array_agg(vehicle order by created_at desc))[1] as vehicle,
           min(created_at) as first_added, count(*)::int as merged_rows
    from c group by k
  )
  select f.identity_key, f.name, f.phone, f.email, f.vehicle, f.first_added,
         a.last_seen, s.service_name, coalesce(a.visits,0), coalesce(a.total_billed,0), f.merged_rows
  from folded f
  left join agg a on a.k = f.identity_key
  left join last_svc s on s.k = f.identity_key
  order by a.last_seen desc nulls last, f.first_added desc
  limit greatest(coalesce(p_limit, 8), 1);
$$;
