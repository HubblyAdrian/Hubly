-- ════════════════════════════════════════════════════════════════════════════════════════════
-- EVERY MEMBERSHIP PLAN ON EVERY BUSINESS, WITH WHAT IT PUBLISHES.
--
-- Feeds scripts/measure-seeded-memberships.mjs, which compares each published field against the
-- SEEDED DEFAULT FOR THAT TRADE — read out of public/hubly.html at run time, never transcribed.
--
-- `businesses.meta` is TEXT holding JSON, not jsonb. The first version of this query used `?` on
-- it and failed with "operator does not exist: text ? unknown" — worth recording, because a cast
-- that is forgotten silently changes what a later query can see.
--
-- RE-EXPORT EVERY SWEEP. A reused export silently undercounts (standing rule).
--   supabase db query --linked -f scripts/sql/export-membership-offers.sql
-- ════════════════════════════════════════════════════════════════════════════════════════════
with m as (
  select id, slug, account_kind, business_type,
         (owner_id is not null) as has_owner,
         claimed_at, created_at, updated_at,
         case when meta is null or btrim(meta) = '' then '{}'::jsonb else meta::jsonb end as j
  from public.businesses
)
select m.slug,
       m.account_kind,
       m.business_type,
       m.has_owner,
       (m.claimed_at is not null) as claimed_at_set,
       o.ord                      as plan_index,
       o.plan ->> 'name'          as plan_name,
       o.plan ->> 'price'         as plan_price,
       o.plan ->> 'enabled'       as plan_enabled,
       o.plan ->> 'cadence'       as plan_cadence,
       o.plan ->> 'description'   as plan_description,
       o.plan ->> 'serviceName'   as plan_linked_service,
       coalesce((select jsonb_agg(v) from jsonb_array_elements_text(
           case when jsonb_typeof(o.plan -> 'includes') = 'array' then o.plan -> 'includes' else '[]'::jsonb end
         ) v), '[]'::jsonb)       as plan_includes
from m,
     lateral jsonb_array_elements(
       case when jsonb_typeof(m.j -> 'website' -> 'membershipOffers') = 'array'
            then m.j -> 'website' -> 'membershipOffers' else '[]'::jsonb end
     ) with ordinality as o(plan, ord)
order by m.account_kind, m.slug, o.ord;
