-- Projects is a core Hubly module for every business.
-- Gate features (lightroom, galleries, before/after) — not the whole module.
-- businesses has no updated_at / specialty columns — do not reference them.

-- 1) Every business gets Projects.
update public.businesses
set capabilities = coalesce(capabilities, '{}'::jsonb) ||
  jsonb_build_object('projects', true)
where coalesce((capabilities->>'projects')::boolean, false) is not true;

-- 2) Lightroom remains photography-led (plus explicit capability).
update public.businesses
set capabilities = coalesce(capabilities, '{}'::jsonb) ||
  jsonb_build_object('lightroom', true)
where
  coalesce((capabilities->>'lightroom')::boolean, false) is not true
  and (
    lower(coalesce(business_type, '')) in ('photography', 'weddings', 'wedding', 'videography', 'drone')
    or lower(coalesce(business_type, '')) like '%photo%'
    or lower(coalesce(business_type, '')) like '%wedding%'
    or lower(coalesce(business_type, '')) like '%real%estate%photo%'
  );

comment on column public.businesses.capabilities is
  'Product capabilities. projects=true for every Hubly business (core module). lightroom and other feature flags unlock tools inside Projects / Connected Apps.';
