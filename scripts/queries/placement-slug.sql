-- WHAT HAPPENED ON ONE BUSINESS? Every placement attempt, in order, for a single slug.
--   supabase db query --linked -f scripts/queries/placement-slug.sql
--
-- EDIT ONE LINE: the slug in `target` below. (`\set` is a psql meta-command and the CLI's
-- query path does not run it — a CTE is the portable way to have a single place to change.)
--
-- Written for the walk after the 2026-09-12 deploy. Two branches that could not appear before
-- it can now: addServicesBlock/inserted (its row was inside the save-failure branch) and
-- applyServicesToFreeform/section_added (that path used to ask permission instead of acting).
-- A clean walk should show LANDINGS here, not only refusals.
with target as (select 'ironwood-fence'::text as slug)

select 'timeline' as section,
       to_char(p.occurred_at, 'MM-DD HH24:MI:SS') as at,
       p.fn, p.branch, left(coalesce(p.detail, ''), 70) as detail, null::bigint as n
from placement_outcomes p
join businesses b on b.id = p.business_id
join target t on b.slug = t.slug
union all
select 'totals', null, p.fn, p.branch, null, count(*)
from placement_outcomes p
join businesses b on b.id = p.business_id
join target t on b.slug = t.slug
group by p.fn, p.branch
union all
-- The page itself beside the rows, so "no row" is distinguishable from "no placement".
select 'documents', to_char(d.created_at, 'MM-DD HH24:MI:SS'), 'v' || d.version, d.created_by,
       (case when d.rendered_html like '%data-hubly-services-block%' then 'services ' else '' end) ||
       (case when d.rendered_html like '%data-hubly-contact-block%' then 'hours/contact ' else '' end) ||
       (case when d.rendered_html like '%data-hubly-service=%' then 'anchors' else '' end),
       null
from business_documents d
join businesses b on b.id = d.business_id
join target t on b.slug = t.slug
order by 1, 2 nulls last, 6 desc nulls last;
