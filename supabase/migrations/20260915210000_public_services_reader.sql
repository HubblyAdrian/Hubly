-- ONE ANSWER TO "WHAT SERVICES DOES THIS BUSINESS OFFER A VISITOR" — reachable by a visitor.
--
-- THE SPLIT THIS CLOSES. On a FREEFORM page the site and the booking wizard read different
-- sources: the site is baked HTML from business_documents, and the wizard calls
-- loadServicesFromDb, whose last-resort branch selects `public.services` directly. On a CLASSIC
-- page the wizard prefers meta.service_catalog. So the booking flow's answer to "what do you
-- offer" depended on which page kind the business happened to have — two stores, two answers,
-- neither of them the shared one.
--
-- Measured 2026-09-15 across the 29 claimed freeform businesses: 4 services on 3 businesses
-- (2 of them market) are offered by booking and never named on the page. Every one is unpriced.
-- NO priced service is missing its price from the page: all 36 appear as "$N". And NO booking
-- has ever been taken for a service the page does not name — 7 freeform bookings, 7 named.
-- So this is a live exposure that has not yet cost anybody anything, which is the moment to fix
-- it rather than after it has.
--
-- ══ THE RULE IS NOT A UNION, AND THAT CORRECTION IS THE WHOLE POINT OF THIS FILE ═════════
--
-- The first version of this reader was `get_business_services` with the owner gate swapped for a
-- slug — a FULL OUTER JOIN of both stores. Run against Graef it returned NINE services, and the
-- ninth was "clay and seal", $0, from the relational table: a service his page does not show and
-- has never shown. Routing the booking wizard through that would have offered a stranger a
-- service the page never advertised, at a price the owner does not charge — WHICH IS THE EXACT
-- HARM THIS FILE EXISTS TO CLOSE, newly introduced by the fix for it.
--
-- So the owner reader and the visitor reader answer DIFFERENT QUESTIONS and must not share a
-- rule:
--
--   get_business_services (owner/model)  "what does this business HAVE on record" -> the UNION,
--                                        with source and conflicts, because an owner needs to
--                                        see the thing that is on file and not showing.
--   this function (visitor)              "what does this business OFFER ME" -> what the page
--                                        shows, and nothing else.
--
-- THE PRECEDENCE: THE CATALOGUE IS THE PAGE; THE TABLE IS THE FALLBACK WHEN THERE IS NO
-- CATALOGUE. A classic page renders meta.service_catalog, so where a catalogue exists it IS what
-- a visitor sees and the relational table is an internal record that no public surface renders.
-- Where the catalogue is empty — 16 of the 29 freeform businesses — the table is what the
-- booking wizard already used, so falling back to it changes nothing and introduces nothing.
--
-- The rest is copied from get_business_services unchanged: the exact lower-trimmed name join,
-- the cents-to-dollars conversion, `source`, and `conflicts` for a value the two stores disagree
-- about. Copying the MECHANICS while deliberately not copying the RULE is the distinction; two
-- readers that answer the same question differently is the defect this ends, and two readers
-- answering different questions is correct.
--
-- WHY THE JOIN STAYS EXACT. Graef has "clay and seal" (relational, 0) and "Clay & Seal Package"
-- (catalogue, $75). They are almost certainly one service. A fuzzy match would tidy them into
-- one and read as a cleanup. It is refused for the same reason as in the owner reader: name
-- similarity is not identity, "Full Detail" and "Full Detail (Truck)" are two services at two
-- prices, and a fuzzy join silently merges two real ones with no visible failure.
--
-- WHAT IT MAY NOT EXPOSE. A visitor gets what a visitor could already read off the page: name,
-- price, duration, description, popularity. No ids, no owner, no internal flags, no counts of
-- anything. Keyed by SLUG, never by business id — a public caller has a slug, and handing out an
-- id lookup invites it to be used as one.
--
-- IT DOES NOT MAKE A BAKED FREEFORM PAGE AGREE WITH BOOKING, and nothing here pretends to. That
-- page is HTML written at generation; the only machine-readable record of what it displays is
-- the anchor set, and anchors are stamped on headings and descriptions too (OPEN_FINDINGS #11),
-- so there is no reliable count to compare against. What this does is give the BOOKING FLOW the
-- same answer the model and the classic page already use, so the divergence has one fewer
-- source and becomes detectable instead of silent.
create or replace function public.get_public_business_services(p_slug text)
returns table (
  name text, price numeric, duration_hours numeric, description text, is_popular boolean,
  source text, conflicts boolean
) language sql stable security definer set search_path = public as $$
  with biz as (
    select b.id, b.meta from public.businesses b
    where b.slug = btrim(p_slug) and b.slug is not null
    limit 1
  ),
  -- ONE ROW PER NAME. The relational table holds genuine duplicates — star-windows has four
  -- services written twice seven seconds apart on 2026-07-18, and adrians-lawn-service four
  -- more. Its "9 services" is five distinct ones; a wizard listing the same service twice shows
  -- a customer a defect carrying no information.
  --
  -- COLLAPSING IS SAFE ONLY WHILE THE DUPLICATES AGREE, AND THAT IS CHECKED RATHER THAN
  -- ASSUMED: measured 2026-09-15, all 8 duplicate names across both businesses agree exactly on
  -- price. If a future pair ever disagrees, the lowest is quoted and `conflicts` is raised —
  -- never quote a customer more than the lowest number the owner has on record, and never
  -- resolve the disagreement quietly.
  tbl_raw as (
    select lower(btrim(s.name)) as k, s.name, s.price, s.duration_hours, s.description,
           coalesce(s.is_popular, false) as is_popular, s.sort_order
    from public.services s join biz on biz.id = s.business_id
    where nullif(btrim(s.name),'') is not null
  ),
  tbl as (
    select k, min(name) as name, min(price) as price, min(duration_hours) as duration_hours,
           min(description) as description, bool_or(is_popular) as is_popular,
           min(sort_order) as sort_order,
           count(distinct price) > 1 as dup_conflict
    from tbl_raw group by k
  ),
  cat as (
    select lower(btrim(x->>'name')) as k,
           x->>'name' as name,
           -- The catalogue stores cents; the relational table stores dollars. One unit out.
           case when (x->'pricing'->>'price_cents') ~ '^[0-9]+$'
                then ((x->'pricing'->>'price_cents')::numeric / 100.0) end as price,
           case when (x->>'duration_minutes') ~ '^[0-9]+$'
                then ((x->>'duration_minutes')::numeric / 60.0) end as duration_hours,
           nullif(btrim(coalesce(x->>'description','')),'') as description,
           coalesce((x->'flags'->>'popular')::boolean, false) as is_popular,
           coalesce((x->>'sort_order')::int, 999) as sort_order
    from biz,
         lateral jsonb_array_elements(
           case when jsonb_typeof((biz.meta::jsonb)->'service_catalog'->'services') = 'array'
                then (biz.meta::jsonb)->'service_catalog'->'services' else '[]'::jsonb end) x
    where nullif(btrim(x->>'name'),'') is not null
      -- A visitor sees what the page shows. A catalogue entry the owner has taken down or
      -- hidden from the website is not on offer, and offering it in the wizard would be the
      -- booking flow re-publishing something the owner removed.
      and coalesce(x->>'status','active') = 'active'
      and coalesce((x->'flags'->>'website')::boolean, true) = true
  )
  select
    c.name                                                     as name,
    -- THE CATALOGUE WINS ON PRICE — it is what the page renders and what a customer is quoted.
    coalesce(c.price, t.price)                                 as price,
    coalesce(c.duration_hours, t.duration_hours)               as duration_hours,
    coalesce(c.description, t.description)                     as description,
    coalesce(c.is_popular, t.is_popular, false)                as is_popular,
    case when t.k is not null then 'both' else 'meta.service_catalog' end as source,
    (coalesce(t.dup_conflict, false)
     or (t.k is not null
         and (coalesce(t.price, -1) is distinct from coalesce(c.price, -1)
           or coalesce(nullif(btrim(t.description),''), '') is distinct from coalesce(nullif(btrim(c.description),''), ''))))
                                                               as conflicts
  -- WHAT THE PAGE SHOWS. The catalogue when there is one; the table only when there is not.
  -- A LEFT join from the catalogue, so the table can supply a missing price or description for a
  -- service the catalogue already lists — but can never ADD one the catalogue does not have.
  from cat c left join tbl t on t.k = c.k
  where exists (select 1 from cat)
  union all
  select t.name, t.price, t.duration_hours, t.description, t.is_popular, 'services'::text,
         t.dup_conflict
  from tbl t where not exists (select 1 from cat)
  order by 1;
$$;

revoke all on function public.get_public_business_services(text) from public;
grant execute on function public.get_public_business_services(text) to anon, authenticated, service_role;

comment on function public.get_public_business_services(text) is
  'What services this business offers a VISITOR, by slug. Reads BOTH stores with the same rule '
  'as get_business_services (exact lower-trimmed name join; the catalogue wins on price; source '
  'and conflicts reported). Public columns only. Hidden or inactive catalogue entries are '
  'excluded: offering one in the booking wizard would re-publish what the owner took down.';
