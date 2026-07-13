-- Item 6 investigation: how many real businesses have null gen_* fields,
-- and does Todds show any other sign of having completed onboarding
-- (which does call generate-site, per hubly.html completeOnboard()) --
-- to distinguish "onboarding never ran/completed" from "it ran and
-- generate-site failed silently, falling back to local copy".
create or replace function _debug_generate_site_coverage()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total_businesses', (select count(*) from businesses),
    'businesses_with_all_gen_null', (
      select count(*) from businesses
      where gen_hero_headline is null and gen_hero_subhead is null and gen_about is null
    ),
    'businesses_with_any_gen_populated', (
      select count(*) from businesses
      where gen_hero_headline is not null or gen_hero_subhead is not null or gen_about is not null
    ),
    'per_business', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'created_at', created_at,
        'gen_hero_headline_is_null', gen_hero_headline is null,
        'about_field_populated', about is not null and about != '',
        'meta_is_null', meta is null,
        'meta_length', length(meta::text)
      ) order by created_at), '[]'::jsonb)
      from businesses
    )
  );
$$;

grant execute on function _debug_generate_site_coverage() to authenticated;
revoke all on function _debug_generate_site_coverage() from public, anon;
