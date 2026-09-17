-- ════════════════════════════════════════════════════════════════════════════════════════════
-- EVERY PRICE BAKED ONTO A LIVE PAGE, BESIDE WHAT THE STORE SAYS IT SHOULD BE.
--
-- Feeds scripts/check-page-price-drift.mjs. A freeform page is a single generation with no update
-- path, so the price a customer reads is HTML written at build time — and the record can move
-- underneath it. This is the export that makes that difference countable.
--
-- THE PAIRING IS EXACT, NOT A WINDOW. `placeOneServicePrice` writes
-- `<span data-hubly-price="SERVICE NAME">$85</span>`, so the span carries the service it belongs to
-- as an attribute. No "look forward 400 characters" guess is involved — a containment window sized
-- to a guess has already produced two false greens this week, and here there is no need for one.
--
-- ONLY THE LATEST VERSION PER TAG. business_documents holds 633 rows across 179 businesses (403 of
-- them patched versions); an older version is history, not a live page, and comparing one would
-- report drift that no customer can see.
--
--   supabase db query --linked -f scripts/sql/export-page-prices.sql
-- ════════════════════════════════════════════════════════════════════════════════════════════
with latest as (
  select distinct on (business_id, tag) business_id, tag, version, rendered_html
  from public.business_documents
  where rendered_html is not null
  order by business_id, tag, version desc, created_at desc
),
onpage as (
  select l.business_id, l.tag, l.version,
         (m.pair)[1] as key,
         (m.pair)[2] as shown
  from latest l,
       lateral regexp_matches(
         l.rendered_html,
         '<span[^>]*\sdata-hubly-price="([^"]*)"[^>]*>([^<]*)</span>',
         'g'
       ) as m(pair)
),
cat as (
  select b.id as business_id,
         c.svc ->> 'name'                        as name,
         c.svc -> 'pricing' ->> 'mode'           as mode,
         c.svc -> 'pricing' ->> 'price_cents'    as price_cents,
         c.svc -> 'pricing' ->> 'show_price'     as show_price,
         (c.svc -> 'pricing' -> 'variable_prices')::text as variable_prices
  from public.businesses b,
       lateral jsonb_array_elements(
         case when jsonb_typeof((case when b.meta is null or btrim(b.meta)='' then '{}'::jsonb else b.meta::jsonb end)
                                -> 'service_catalog' -> 'services') = 'array'
              then (case when b.meta is null or btrim(b.meta)='' then '{}'::jsonb else b.meta::jsonb end)
                   -> 'service_catalog' -> 'services'
              else '[]'::jsonb end
       ) as c(svc)
)
select b.slug, b.account_kind, o.tag, o.version,
       o.key            as page_key,
       o.shown          as page_shows,
       c.name           as store_name,
       c.mode           as store_mode,
       c.price_cents    as store_price_cents,
       c.show_price     as store_show_price,
       c.variable_prices as store_variable_prices
from onpage o
join public.businesses b on b.id = o.business_id
-- The join is on the NORMALISED name, exactly as findServiceAnchor normalises it: lowercased and
-- trimmed. NOT fuzzy — "Full Detail" and "Full Detail (Truck)" are two services at two prices, and a
-- fuzzy join silently merges two real ones with no visible failure.
left join cat c on c.business_id = o.business_id
              and lower(btrim(c.name)) = lower(btrim(o.key))
order by b.account_kind, b.slug, o.tag, o.key;
