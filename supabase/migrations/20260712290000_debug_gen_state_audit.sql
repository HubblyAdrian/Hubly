-- Item 6 follow-up: three checks before approving the choke-point fix.
-- 1. "Adrian's" vs "Adrian's Detail" -- same business or different, and how
--    did the pre-2026-07-10 one get real gen content?
-- 2. Does the self-destruct bug (missing custom-flag) affect anything
--    besides heroHeadline? (checked separately via source grep, not SQL)
-- 3. Real businesses where gen_hero_headline is populated but the
--    persisted meta.website.heroHeadline still shows a generic default --
--    the exact broken state a re-sync would need to fix.
create or replace function _debug_gen_state_audit()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'adrians_businesses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'created_at', created_at,
        'gen_hero_headline', gen_hero_headline,
        'gen_about', gen_about,
        'meta_website_hero_headline', (meta::jsonb)->'website'->>'heroHeadline',
        'meta_website_owner_bio', left((meta::jsonb)->'website'->>'ownerBio', 80)
      ) order by created_at), '[]'::jsonb)
      from businesses where name ilike 'adrian%'
    ),
    'gen_populated_vs_applied', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name,
        'gen_hero_headline', gen_hero_headline,
        'meta_hero_headline', (meta::jsonb)->'website'->>'heroHeadline',
        'headline_mismatch', (gen_hero_headline is not null and (meta::jsonb)->'website'->>'heroHeadline' != gen_hero_headline),
        'gen_about', left(gen_about,40),
        'meta_owner_bio', left((meta::jsonb)->'website'->>'ownerBio',40),
        'about_mismatch', (gen_about is not null and (meta::jsonb)->'website'->>'ownerBio' != gen_about),
        'gen_seo_title', gen_seo_title,
        'meta_seo_title', (meta::jsonb)->'website'->>'seoTitle',
        'seo_title_mismatch', (gen_seo_title is not null and (meta::jsonb)->'website'->>'seoTitle' != gen_seo_title)
      )), '[]'::jsonb)
      from businesses where gen_hero_headline is not null
    )
  );
$$;

grant execute on function _debug_gen_state_audit() to authenticated;
revoke all on function _debug_gen_state_audit() from public, anon;
