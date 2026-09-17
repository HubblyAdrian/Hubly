-- ════════════════════════════════════════════════════════════════════════════════════════════
-- BOTH SERVICE STORES, SIDE BY SIDE, FOR EVERY BUSINESS THAT HAS ANYTHING IN EITHER.
--
--   the TABLE    public.services
--   the CATALOG  businesses.meta.service_catalog.services   (what the page and the wizard read)
--
-- `businesses.meta` is TEXT holding JSON, so it is cast. Re-export every sweep: a reused export
-- silently undercounts (standing rule).
--   supabase db query --linked -f scripts/sql/export-service-stores.sql
-- ════════════════════════════════════════════════════════════════════════════════════════════
with m as (
  select id, slug, account_kind, business_type,
         case when meta is null or btrim(meta) = '' then '{}'::jsonb else meta::jsonb end as j
  from public.businesses
),
cat as (
  select m.id, m.slug, m.account_kind,
         c.ord,
         c.svc ->> 'name'                             as name,
         (c.svc -> 'pricing' ->> 'mode')              as mode,
         (c.svc -> 'pricing' ->> 'price_cents')       as price_cents,
         (c.svc -> 'pricing' ->> 'show_price')        as show_price,
         (c.svc -> 'pricing' -> 'variable_prices')::text as variable_prices,
         c.svc ->> 'status'                           as status,
         (c.svc -> 'offer')::text                     as offer
  from m, lateral jsonb_array_elements(
         case when jsonb_typeof(m.j -> 'service_catalog' -> 'services') = 'array'
              then m.j -> 'service_catalog' -> 'services' else '[]'::jsonb end
       ) with ordinality as c(svc, ord)
),
tbl as (
  select s.business_id as id, b.slug, b.account_kind,
         row_number() over (partition by s.business_id order by s.created_at, s.id) as ord,
         -- `services` PREDATES the catalog and speaks a different vocabulary: `price` is NUMERIC
         -- DOLLARS, not cents, and there is no status column at all (`is_popular` is the only flag).
         -- Converted to cents here so the two stores can be compared at all — and the conversion is
         -- named, because "the table says 85 and the catalog says 8500" is not a conflict.
         s.name, (round(s.price * 100))::text as price_cents, null as status
  from public.services s join public.businesses b on b.id = s.business_id
)
select 'catalog' as store, slug, account_kind, ord, name, mode, price_cents, show_price,
       variable_prices, status, offer
from cat
union all
select 'table', slug, account_kind, ord, name, null, price_cents, null, null, status, null
from tbl
order by slug, store, ord;
