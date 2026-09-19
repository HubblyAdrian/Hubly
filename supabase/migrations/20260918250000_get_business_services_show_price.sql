-- == get_business_services RETURNS show_price ==================================================
--
-- RULED BY ADRIAN, 2026-09-18: the owner's control for hiding a price "goes beside the price field in
-- the panel" — and a control cannot show its current state if the reader the panel uses does not
-- return it. 20260918240000 added `services.show_price`; this is the read half.
--
-- == GENERATED FROM THE LIVE DEFINITION, NOT RETYPED ==========================================
--
-- Four insertions into `pg_get_functiondef` output: the RETURNS TABLE signature, the `tbl` CTE, the
-- `cat` CTE, and the projection. Nothing else is touched. The last migration I typed out by hand
-- reproduced a 55-entry list as 72 and would have silently dropped ~30 meta subtrees off every public
-- page; that is not a mistake worth making twice, so the base is what production actually runs.
--
-- == THE UNION HAS TO PICK A WINNER, AND IT PICKS THE ONE PRICE ALREADY PICKS ==================
--
-- This reader is a FULL OUTER JOIN of two stores — `services` rows and `meta.service_catalog` — and it
-- already resolves a disagreement about PRICE by preferring the catalogue, on the stated grounds that
-- the catalogue is "what the page renders and what a customer is quoted". show_price is the same kind
-- of fact about the same service, so it resolves the same way. Choosing differently for one field than
-- for its own price would make the panel show a number from one store and its visibility from the
-- other.
--
-- `true` is the LAST resort, not the first: a service nobody has said anything about has always shown
-- its price, so the default preserves every owner's current behaviour. 283 rows, all true, measured
-- before this shipped.
--
-- == AND THE DUPLICATION IS STILL OPEN ========================================================
--
-- `services.show_price` and `pricing.show_price` now both exist, which is two-of-everything and is
-- recorded in docs/OPEN_FINDINGS.md with the failure it can produce (one business holding both, and
-- the two disagreeing). This reader is where that disagreement would surface, which is the best place
-- for it to surface — `conflicts` already exists two lines down for exactly this class of problem, and
-- extending it to cover show_price is the obvious next step and is NOT done here.
--
-- == NO ROW IS WRITTEN =======================================================================
--
-- One CREATE OR REPLACE FUNCTION. Zero INSERT/UPDATE/DELETE. graefs-autocare is read-only and
-- untouched; what he reads back gains a column whose value for him is `true`, which is what his page
-- already does.

-- == WHY A DROP, AND WHAT THE WINDOW IS ======================================================
--
-- Postgres refuses CREATE OR REPLACE when the RETURN TYPE changes: "Row type defined by OUT
-- parameters is different." Adding a column to a RETURNS TABLE is exactly that, so the function has
-- to be dropped and recreated.
--
-- BOTH STATEMENTS ARE IN THIS ONE FILE, applied together, so the window in which the function does not
-- exist is the gap between two statements in a single command — not a deploy step somebody could stop
-- half way. The grant is re-issued below because DROP takes the privilege with it; a recreated reader
-- that `authenticated` cannot execute would fail for every signed-in owner and would look exactly like
-- an authorisation bug.
--
-- `if exists` so re-running this file is safe.

drop function if exists public.get_business_services(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_business_services(p_business_id uuid, p_owner_id uuid)
 RETURNS TABLE(name text, price numeric, duration_hours numeric, description text, is_popular boolean, show_price boolean, source text, conflicts boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with owned as (select public.hubly_owns_business(p_business_id, p_owner_id) as ok),
  tbl as (
    select lower(btrim(s.name)) as k, s.name, s.price, s.duration_hours, s.description,
           coalesce(s.is_popular, false) as is_popular, coalesce(s.show_price, true) as show_price, s.sort_order
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
           -- The catalogue's own flag, which service_engine.ts already computes and stores as
           -- pricing.show_price. NULL when absent, so the coalesce below falls to the table.
           (x->'pricing'->>'show_price')::boolean as show_price,
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
    -- THE CATALOGUE WINS, exactly as it does for price two lines up, and for the same reason: it is
    -- what the page renders. TRUE is the last resort, because a service whose visibility nobody has
    -- stated has always shown its price and must keep doing so.
    coalesce(c.show_price, t.show_price, true)                 as show_price,
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
$function$;


grant execute on function public.get_business_services(uuid, uuid) to authenticated;
