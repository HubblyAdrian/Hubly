-- URGENT FIX for 20260819010000.
--
-- That migration declared `v_cities text[]` and assigned it to
-- service_area_cities, which is JSONB. Postgres rejects the resulting
--
--   coalesce(v_cities, service_area_cities)
--
-- with 42804 "COALESCE types text[] and jsonb cannot be matched" -- and it does
-- so at PLAN time, not at run time. So the function failed for EVERY caller,
-- whatever the patch contained: a patch of {"phone": ...} broke exactly as hard
-- as one touching the new column.
--
-- Blast radius while it was live: every draft update, every logo upload,
-- setChrome, and the identity patch startDraft applies immediately after
-- creating a business. All of them call this one function.
--
-- How it got through: the migration was verified by reading, and by the fact
-- that the SQL editor reported "Success. No rows returned" -- which a
-- create-or-replace does even when the body can never execute, because the
-- function body is not planned until it is called. The lesson is the same one
-- this repo keeps relearning: run the thing, do not read it. A single call
-- against a real draft would have caught it in one second.

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
as $$
declare
  v_row businesses%rowtype;
  v_meta jsonb;
  v_business_type text;
  v_header_mode text;
  -- JSONB, matching the column. The whole bug was this one declaration.
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

  -- An empty array means "no change", not "clear the list": every caller with
  -- nothing to say sends nothing, and a caller that genuinely wants it emptied
  -- is not a case that exists yet.
  if jsonb_typeof(p_patch->'service_area_cities') = 'array'
     and jsonb_array_length(p_patch->'service_area_cities') > 0 then
    v_cities := p_patch->'service_area_cities';
  end if;

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

  update businesses set
    name = coalesce(nullif(p_patch->>'name', ''), name),
    tagline = coalesce(p_patch->>'tagline', tagline),
    about = coalesce(p_patch->>'about', about),
    phone = coalesce(p_patch->>'phone', phone),
    email = coalesce(p_patch->>'email', email),
    city = coalesce(p_patch->>'city', city),
    state = coalesce(nullif(p_patch->>'state', ''), state),
    address = coalesce(nullif(p_patch->>'address', ''), address),
    service_area_cities = coalesce(v_cities, service_area_cities),
    travel_radius_miles = coalesce((nullif(p_patch->>'travel_radius_miles', ''))::numeric, travel_radius_miles),
    years_in_business = coalesce((nullif(p_patch->>'years_in_business', ''))::int, years_in_business),
    business_type = coalesce(v_business_type, business_type),
    brand_color = coalesce(p_patch->>'brand_color', brand_color),
    bg_color = coalesce(p_patch->>'bg_color', bg_color),
    section_order = coalesce(p_patch->'section_order', section_order),
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
$$;

grant execute on function patch_business_in_progress(uuid, uuid, jsonb, jsonb) to anon, authenticated;
revoke all on function patch_business_in_progress(uuid, uuid, jsonb, jsonb) from public;
