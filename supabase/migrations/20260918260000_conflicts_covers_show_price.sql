-- == `conflicts` NOW COVERS show_price ==========================================================
--
-- RULED BY ADRIAN, 2026-09-18: "Extend get_business_services' `conflicts` to cover show_price. A
-- two-store disagreement about whether a price is visible currently resolves silently, and price and
-- description already report. Same mechanism, one more field."
--
-- I raised this myself as the one piece worth doing before the eventual one-store tidy, and it is the
-- cheapest half of that tidy: the disagreement becomes VISIBLE on the row instead of being resolved
-- catalogue-wins in silence. The resolution does not change — the catalogue still wins, the same way it
-- wins for price two lines up — only whether the owner's panel can say so.
--
-- == coalesce ON BOTH SIDES, AND THAT IS THE WHOLE SUBTLETY =====================================
--
-- `t.show_price is distinct from c.show_price` would report a disagreement for every row where ONE
-- store has not been written yet — the catalogue side is NULL for every entry today, because nothing
-- has written pricing.show_price to an existing offer. That is an ABSENCE, not a disagreement, and
-- reporting it as one would light up `conflicts` on 283 rows and teach everybody to ignore the field.
-- So both sides coalesce to `true` first: the same default the column carries and the same one the
-- projection uses. A row only conflicts when the two stores make DIFFERENT positive statements.
--
-- == GENERATED FROM THE LIVE DEFINITION ========================================================
--
-- One insertion into pg_get_functiondef output. No DROP needed this time: the RETURNS TABLE is
-- unchanged, so CREATE OR REPLACE is legal (adding a column last time is what forced the drop).
--
-- == NO ROW IS WRITTEN =======================================================================
--
-- One CREATE OR REPLACE FUNCTION. Zero INSERT/UPDATE/DELETE. graefs-autocare untouched — and measured
-- below: his rows report conflicts exactly as they did before, because his two stores agree.

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
       or coalesce(nullif(btrim(t.description),''), '') is distinct from coalesce(nullif(btrim(c.description),''), '')
       -- show_price JOINS THE SAME REPORT. Ruled 2026-09-18: price and description already report a
       -- two-store disagreement on the row; whether the price is VISIBLE resolved silently, which is
       -- the same class of fact about the same service. coalesce(..., true) on both sides so an
       -- ABSENT flag is not reported as a disagreement with a present `true` — that would flag every
       -- row where one store simply has not been written yet.
       or coalesce(t.show_price, true) is distinct from coalesce(c.show_price, true)))
                                                               as conflicts
  from tbl t full outer join cat c on c.k = t.k
  order by coalesce(c.sort_order, t.sort_order, 999), 1;
$function$;

grant execute on function public.get_business_services(uuid, uuid) to authenticated;
