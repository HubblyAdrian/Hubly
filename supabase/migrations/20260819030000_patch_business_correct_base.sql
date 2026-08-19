-- THE CORRECT VERSION. Rebuilt from 20260817040000, which was the real latest.
--
-- WHAT WENT WRONG, TWICE
--
-- 20260819010000 added five columns to this function by copying its body from
-- 20260805130000 -- a version that was already TWO revisions old. That did two
-- things at once, and only one of them was visible:
--
--   1. It silently REVERTED the section_order validation added by
--      20260817040000. That version builds a text[] through array_agg, keeps
--      only the four real section names, deduplicates, and preserves order,
--      because "this array drives rendering and an invented or misspelled
--      section name would render a page with a hole in it". The copied-forward
--      body had none of that; it wrote `coalesce(p_patch->'section_order', ...)`
--      instead, which is jsonb against a text[] column.
--
--   2. It declared v_cities as text[] against service_area_cities, which is
--      jsonb.
--
-- Both are COALESCE type mismatches, both are rejected at PLAN time rather than
-- run time, and so the whole function failed for every caller regardless of
-- what the patch contained. 20260819020000 fixed (2) and the error simply
-- swapped ends -- "text[] and jsonb" became "jsonb and text[]" -- because (1)
-- was still there. Two bugs presenting as one message.
--
-- THE ACTUAL LESSON
--
-- Never rebuild a `create or replace` from a migration you found by name. Find
-- the LATEST definition first:
--
--   grep -rln "create or replace function <name>" supabase/migrations/ | sort | tail -1
--
-- A create-or-replace silently reverts everything added between the version you
-- copied and the version that is live, and reports "Success" while doing it.
--
-- And: verify a function by CALLING it. "Success. No rows returned" is what a
-- create-or-replace says even when the body can never execute, because a
-- plpgsql body is not planned until something calls it. One real call would
-- have caught both of these immediately.

create or replace function patch_business_in_progress(
  p_id uuid,
  p_draft_token uuid,
  p_patch jsonb default '{}'::jsonb,
  p_website_meta jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $FN$

declare
  v_row businesses%rowtype;
  v_meta jsonb;
  v_sections text[];
  v_business_type text;
  v_header_mode text;
  -- jsonb, matching the service_area_cities column.
  v_cities jsonb;
begin
  select * into v_row from businesses where id = p_id;

  if not found
     or v_row.owner_id is not null
     or v_row.draft_token is null
     or v_row.draft_token is distinct from p_draft_token
  then
    return jsonb_build_object('ok', false);
  end if;

  v_business_type := nullif(p_patch->>'business_type', '');
  v_header_mode := nullif(p_patch->>'header_mode', '');

  if p_website_meta is not null or v_business_type is not null or v_header_mode is not null then
    v_meta := coalesce(nullif(v_row.meta, '')::jsonb, '{}'::jsonb);
    if p_website_meta is not null then
      v_meta := jsonb_set(
        v_meta,
        '{website}',
        coalesce(v_meta->'website', '{}'::jsonb) || p_website_meta,
        true
      );
    end if;
    if v_business_type is not null then
      v_meta := jsonb_set(v_meta, '{businessType}', to_jsonb(v_business_type), true);
    end if;
    if v_header_mode is not null then
      v_meta := jsonb_set(v_meta, '{headerMode}', to_jsonb(v_header_mode), true);
    end if;
  end if;

  -- PRESERVED FROM 20260817040000, verbatim. Only the four real sections,
  -- deduplicated, order preserved. Anything else is dropped rather than
  -- trusted: this array drives rendering, and an invented or misspelled
  -- section name would render a page with a hole in it.
  if p_patch ? 'section_order' then
    select array_agg(s order by ord)
      into v_sections
      from (
        select distinct on (s) s, ord
        from (
          select value::text as s, ordinality as ord
          from jsonb_array_elements_text(p_patch->'section_order') with ordinality as t(value, ordinality)
        ) raw
        where s in ('services', 'portfolio', 'reviews', 'about')
        order by s, ord
      ) dedup;
  end if;

  -- An empty array means "no change", not "clear the list": every caller with
  -- nothing to say sends nothing, and a caller that genuinely wants it emptied
  -- is not a case that exists yet.
  if jsonb_typeof(p_patch->'service_area_cities') = 'array'
     and jsonb_array_length(p_patch->'service_area_cities') > 0 then
    v_cities := p_patch->'service_area_cities';
  end if;

  update businesses set
    name = coalesce(nullif(p_patch->>'name', ''), name),
    tagline = coalesce(p_patch->>'tagline', tagline),
    about = coalesce(p_patch->>'about', about),
    phone = coalesce(p_patch->>'phone', phone),
    email = coalesce(p_patch->>'email', email),
    city = coalesce(p_patch->>'city', city),
    -- The five this migration series exists to add.
    state = coalesce(nullif(p_patch->>'state', ''), state),
    address = coalesce(nullif(p_patch->>'address', ''), address),
    service_area_cities = coalesce(v_cities, service_area_cities),
    travel_radius_miles = coalesce((nullif(p_patch->>'travel_radius_miles', ''))::numeric, travel_radius_miles),
    years_in_business = coalesce((nullif(p_patch->>'years_in_business', ''))::int, years_in_business),
    business_type = coalesce(v_business_type, business_type),
    brand_color = coalesce(p_patch->>'brand_color', brand_color),
    bg_color = coalesce(p_patch->>'bg_color', bg_color),
    -- Only when at least one valid section survived validation above.
    section_order = case
      when v_sections is not null and array_length(v_sections, 1) > 0 then v_sections
      else section_order
    end,
    logo_url = coalesce(p_patch->>'logo_url', logo_url),
    banner_url = coalesce(p_patch->>'banner_url', banner_url),
    gen_hero_headline = coalesce(p_patch->>'gen_hero_headline', gen_hero_headline),
    gen_hero_subhead = coalesce(p_patch->>'gen_hero_subhead', gen_hero_subhead),
    gen_about = coalesce(p_patch->>'gen_about', gen_about),
    gen_seo_title = coalesce(p_patch->>'gen_seo_title', gen_seo_title),
    gen_seo_description = coalesce(p_patch->>'gen_seo_description', gen_seo_description),
    gen_why_choose = coalesce(p_patch->'gen_why_choose', gen_why_choose),
    gen_faq = coalesce(p_patch->'gen_faq', gen_faq),
    meta = coalesce(v_meta::text, meta)
  where id = p_id;

  return jsonb_build_object('ok', true, 'id', p_id, 'slug', v_row.slug);
end;
$FN$;

grant execute on function patch_business_in_progress(uuid, uuid, jsonb, jsonb) to anon, authenticated;
revoke all on function patch_business_in_progress(uuid, uuid, jsonb, jsonb) from public;
