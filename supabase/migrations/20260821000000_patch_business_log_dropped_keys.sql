-- The column whitelist now says what it dropped.
--
-- WHY
--
-- This function is an allow-list: it reads a fixed set of keys out of p_patch
-- and ignores everything else. Ignoring is its normal behaviour, so a key it
-- does not know is indistinguishable from a key it deliberately skips — which
-- is how six real columns (state, address, service_area_cities,
-- travel_radius_miles, years_in_business, settings_business_hours) sat
-- unwritten for months while every caller got `ok: true`.
--
-- It is the fourth list in this codebase to do that, so the fix is the rule
-- rather than another entry: A LIST THAT SILENTLY DROPS UNKNOWN ENTRIES MUST
-- LOG THE DROP. See _shared/hubly_allowlist.ts for the same rule in TypeScript
-- and docs/KNOWN_ISSUES.md for all four instances.
--
-- Reported TWO ways, on purpose:
--   * `raise warning` — lands in the Postgres log for anything watching.
--   * `dropped_keys` in the returned jsonb — visible to the caller in the same
--     round trip, and therefore testable by CALLING the function, which is the
--     only verification this codebase trusts for a plpgsql body.
--
-- NOT an error. A patch carrying one stray key is usually a model inventing a
-- field, not an outage; failing the whole write would turn a small mistake into
-- a lost draft. Say it and carry on.
--
-- Rebuilt from the LIVE body, read back with pg_get_functiondef immediately
-- before writing this file and diffed against 20260819030000 — identical apart
-- from the dollar-quote tag pg_get_functiondef normalises. Nothing is reverted.

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
  -- Every key this function actually reads. If you add a column above, add it
  -- here too -- otherwise a working write reports itself as dropped.
  v_known text[] := array[
    'name','tagline','about','phone','email','city','state','address',
    'service_area_cities','travel_radius_miles','years_in_business',
    'business_type','header_mode','brand_color','bg_color','section_order',
    'logo_url','banner_url','gen_hero_headline','gen_hero_subhead','gen_about',
    'gen_seo_title','gen_seo_description','gen_why_choose','gen_faq'
  ];
  v_dropped text[];
begin
  select * into v_row from businesses where id = p_id;

  if not found
     or v_row.owner_id is not null
     or v_row.draft_token is null
     or v_row.draft_token is distinct from p_draft_token
  then
    return jsonb_build_object('ok', false);
  end if;

  -- THE DROP REPORT. Everything in the patch that this function will ignore.
  select array_agg(k order by k) into v_dropped
  from jsonb_object_keys(p_patch) k
  where k <> all(v_known);

  if v_dropped is not null and array_length(v_dropped, 1) > 0 then
    raise warning 'allowlist-drop [patch_business_in_progress] % not covered: % | consequence: silently not written, caller still gets ok:true | fix at: v_known in this function',
      array_length(v_dropped, 1), array_to_string(v_dropped, ', ');
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

  return jsonb_build_object('ok', true, 'id', p_id, 'slug', v_row.slug)
    || case when v_dropped is null then '{}'::jsonb
            else jsonb_build_object('dropped_keys', to_jsonb(v_dropped)) end;
end;
$FN$;

grant execute on function patch_business_in_progress(uuid, uuid, jsonb, jsonb) to anon, authenticated;
revoke all on function patch_business_in_progress(uuid, uuid, jsonb, jsonb) from public;
