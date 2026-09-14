-- THE ASSISTANT WAS BEING TOLD THE PAYING CUSTOMER HAS ONE SERVICE. HE HAS EIGHT.
--
-- `get_business_services` selected from `public.services` alone. Graef has ONE row there —
-- "clay and seal", price 0, no description — and EIGHT in `businesses.meta.service_catalog`,
-- which is what his page actually renders. The services slice of the operational state feeds
-- that answer into the model on every single owner turn, so every recommendation ever made
-- about his business was reasoned from a confident false answer, with nothing to flag it.
--
-- THIS IS THE FIFTH SURFACING OF THE TWO-STORE SPLIT (docs/SETTLED.md #2), and the fix already
-- existed twelve lines away. `get_business_hours` reads BOTH stores and its comment says why,
-- in the words of the failure it prevented:
--
--     "A reader built on the first alone would have told Graef 'no hours on record' while his
--      own page showed them. Both are read; a disagreement between them is stated, never
--      quietly resolved."
--
-- That is copied here exactly — same full outer join, same `source`, same `conflicts` column.
-- A lesson written in one comment and not carried across is a preference, not a rule; the
-- rule is now also `scripts/check-two-store-readers.mjs`.
--
-- PURE REPLACE OF ONE READER. Same name, same argument list, same authorisation predicate.
-- The return type GAINS two columns (`source`, `conflicts`) exactly as the hours reader has,
-- so the shape a caller destructures is unchanged.
drop function if exists public.get_business_services(uuid, uuid);

create or replace function public.get_business_services(p_business_id uuid, p_owner_id uuid)
returns table (
  name text, price numeric, duration_hours numeric, description text, is_popular boolean,
  source text, conflicts boolean
) language sql stable security definer set search_path = public as $$
  with owned as (select public.hubly_owns_business(p_business_id, p_owner_id) as ok),
  tbl as (
    select lower(btrim(s.name)) as k, s.name, s.price, s.duration_hours, s.description,
           coalesce(s.is_popular, false) as is_popular, s.sort_order
    from public.services s, owned
    where owned.ok and s.business_id = p_business_id and nullif(btrim(s.name),'') is not null
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
    from public.businesses b, owned,
         lateral jsonb_array_elements(
           case when jsonb_typeof((b.meta::jsonb)->'service_catalog'->'services') = 'array'
                then (b.meta::jsonb)->'service_catalog'->'services' else '[]'::jsonb end) x
    where owned.ok and b.id = p_business_id and nullif(btrim(x->>'name'),'') is not null
  )
  select
    coalesce(c.name, t.name)                                   as name,
    -- THE CATALOGUE WINS ON PRICE, and deliberately: it is what the page renders and what a
    -- customer is quoted. Graef's one relational row says 0 for a service his page prices at
    -- $75. Preferring the table would keep telling the model the wrong number.
    coalesce(c.price, t.price)                                 as price,
    coalesce(c.duration_hours, t.duration_hours)               as duration_hours,
    coalesce(c.description, t.description)                     as description,
    coalesce(c.is_popular, t.is_popular, false)                as is_popular,
    case when t.k is not null and c.k is not null then 'both'
         when c.k is not null then 'meta.service_catalog'
         else 'services' end                                   as source,
    -- Stated, never quietly resolved — the hours reader's rule, applied to price and text.
    (t.k is not null and c.k is not null
     and (coalesce(t.price, -1) is distinct from coalesce(c.price, -1)
       or coalesce(nullif(btrim(t.description),''), '') is distinct from coalesce(nullif(btrim(c.description),''), '')))
                                                               as conflicts
  from tbl t full outer join cat c on c.k = t.k
  order by coalesce(c.sort_order, t.sort_order, 999), 1;
$$;

grant execute on function public.get_business_services(uuid, uuid) to authenticated, service_role;

comment on function public.get_business_services(uuid, uuid) is
  'Services as the OWNER would describe them, read from BOTH stores: the relational services '
  'table and businesses.meta.service_catalog (what a classic page renders). Reports source and '
  'conflicts rather than picking a winner silently. See get_business_hours — same shape, same reason.';
