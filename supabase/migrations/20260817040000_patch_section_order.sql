-- patch_business_in_progress: accept section_order and bg_color.
--
-- Every AI-built site has looked identical — same navy, same section order,
-- "What we offer / What customers say / Meet X" whatever the trade. The cause was
-- NOT the blueprint (the AI build path never reads one) and NOT the generation
-- prompt (3,897 characters of format spec containing zero trade words). It was
-- that start_business_in_progress sets no visual identity, so every business
-- inherits the same column defaults:
--
--     brand_color   DEFAULT '#1a3a6e'
--     bg_color      DEFAULT '#f0f0ee'
--     section_order DEFAULT ARRAY['services','portfolio','reviews','about']
--
-- brand_color was already patchable. section_order was not, so a photographer
-- could not lead with their portfolio even though that is their whole pitch.
--
-- BUILT BY PATCHING THE LIVE FUNCTION BODY, not by rewriting it. A rewrite from
-- the migration history dropped banner_url, gen_faq and gen_why_choose — three
-- fields the deployed version patches that the last migration in the repo does
-- not mention. create-or-replace would have removed them silently.

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

  -- Only the four real sections, deduplicated, order preserved. Anything else is
  -- dropped rather than trusted: this array drives rendering, and an invented or
  -- misspelled section name would render a page with a hole in it.
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

  update businesses set
    name = coalesce(nullif(p_patch->>'name', ''), name),
    tagline = coalesce(p_patch->>'tagline', tagline),
    about = coalesce(p_patch->>'about', about),
    phone = coalesce(p_patch->>'phone', phone),
    email = coalesce(p_patch->>'email', email),
    city = coalesce(p_patch->>'city', city),
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

select 'patch_business_in_progress: +section_order +bg_color' as status;
