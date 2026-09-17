-- ════════════════════════════════════════════════════════════════════════════════════════════
-- THE TEXT OF EVERY LIVE GENERATED PAGE, BESIDE THE ROWS THAT COULD GROUND IT.
--
-- Feeds scripts/measure-page-claims.mjs, which asks the question nothing in the product asks:
-- does every factual assertion on a generated page trace to a row?
--
-- LATEST VERSION PER (business, tag) ONLY. The corpus SIZE IS NOT WRITTEN HERE ON PURPOSE: a count in
-- a comment goes stale silently and this one had (633 -> 648 across 179 -> 188 businesses between
-- 2026-09-15 and 2026-09-17). Re-derive it when you need it:
--   select count(*), count(distinct business_id), created_by from business_documents group by created_by;
-- versions; an older version is history, not a page anyone can read.
--
-- THE HTML IS FLATTENED TO TEXT HERE so the measurer never parses markup: tags out, entities for the
-- few that matter, whitespace collapsed. A claim lives in the text a visitor reads.
--
--   supabase db query --linked -f scripts/sql/export-page-claims.sql
-- ════════════════════════════════════════════════════════════════════════════════════════════
with latest as (
  select distinct on (business_id, tag) business_id, tag, version, rendered_html
  from public.business_documents
  where rendered_html is not null and length(rendered_html) > 200
  order by business_id, tag, version desc, created_at desc
),
m as (
  select id, slug, account_kind, business_type, name, phone, email, city,
         (owner_id is not null) as has_owner,
         case when meta is null or btrim(meta) = '' then '{}'::jsonb else meta::jsonb end as j
  from public.businesses
)
select m.slug, m.account_kind, m.business_type, m.name, m.phone, m.email, m.city,
       l.tag, l.version,
       -- THE VISIBLE TEXT. <script>/<style> bodies dropped first so their contents are never read as
       -- page copy — a CSS rule with a number in it is not a claim to a customer.
       regexp_replace(
         regexp_replace(
           regexp_replace(l.rendered_html, '<(script|style)[^>]*>.*?</\1>', ' ', 'gis'),
           '<[^>]+>', ' ', 'g'),
         '\s+', ' ', 'g') as page_text,
       -- THE ROWS THAT COULD GROUND IT.
       coalesce((select jsonb_agg(jsonb_build_object(
                   'name', s.svc->>'name',
                   'cents', s.svc->'pricing'->>'price_cents',
                   'mode', s.svc->'pricing'->>'mode',
                   'variable', s.svc->'pricing'->'variable_prices'))
                 from jsonb_array_elements(
                   case when jsonb_typeof(m.j->'service_catalog'->'services') = 'array'
                        then m.j->'service_catalog'->'services' else '[]'::jsonb end) s(svc)), '[]'::jsonb) as catalog,
       coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'price', t.price))
                 from public.services t where t.business_id = m.id), '[]'::jsonb) as table_services,
       (m.j->'website'->>'address') as meta_address,
       (m.j->>'address') as meta_address2,
       coalesce((select count(*) from public.settings_business_hours h where h.business_id = m.id), 0) as hours_rows,
       coalesce((select jsonb_agg(jsonb_build_object('name', o->>'name', 'price', o->>'price', 'includes', o->'includes'))
                 from jsonb_array_elements(
                   case when jsonb_typeof(m.j->'website'->'membershipOffers') = 'array'
                        then m.j->'website'->'membershipOffers' else '[]'::jsonb end) o), '[]'::jsonb) as memberships,
       (m.j->'website'->>'reviewEmbedCode') is not null as has_review_embed,
       -- COUNTS THAT COULD GROUND A COUNT CLAIM. A "trusted by N customers" line is checkable only
       -- against these, and a derivation may not OVERSTATE them (47 -> "dozens" holds, 47 ->
       -- "hundreds" does not). Added after the first run, where the customer test could not run at
       -- all because the export did not carry the number — a measurement gap, stated rather than
       -- reported as "no claims found".
       coalesce((select count(*) from public.customers c where c.business_id = m.id), 0) as customer_rows,
       coalesce((select count(*) from public.jobs jb where jb.business_id = m.id), 0) as job_rows
from latest l join m on m.id = l.business_id
order by m.account_kind, m.slug, l.tag;
