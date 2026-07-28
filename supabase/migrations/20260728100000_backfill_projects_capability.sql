-- Re-run photo-led projects capability backfill (idempotent).
-- Fixes businesses that still lack capabilities.projects after 20260728050000.
-- Note: non-photo trades (e.g. detailing) intentionally stay without Photography nav
-- until capabilities.projects is set true for that business.

update public.businesses
set capabilities = coalesce(capabilities, '{}'::jsonb) ||
  jsonb_build_object('projects', true, 'lightroom', true),
  updated_at = coalesce(updated_at, now())
where
  coalesce((capabilities->>'projects')::boolean, false) is not true
  and (
    lower(coalesce(business_type, '')) in ('photography', 'weddings', 'wedding', 'videography', 'drone')
    or lower(coalesce(business_type, '')) like '%photo%'
    or lower(coalesce(business_type, '')) like '%wedding%'
    or lower(coalesce(business_type, '')) like '%real%estate%photo%'
  );
