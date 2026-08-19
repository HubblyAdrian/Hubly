-- Writers for the fields the generator already reads.
--
-- loadBusinessRecord was built to feed the generator real data. Five of the
-- columns it reads had no way to be written from the conversational path at
-- all: state, address, service_area_cities, travel_radius_miles,
-- years_in_business. patch_business_in_progress is a whitelist -- it names
-- every column it will set -- and these were not on it, so a patch containing
-- them was accepted, returned ok, and silently changed nothing.
--
-- The consequence was a permanently empty SERVICE AREA block on every
-- generated page's prompt, and a map query that could only ever fall back to
-- the city.
--
-- Opening hours get their own RPC rather than a column: settings_business_hours
-- is one row per weekday with an owner-only policy, and a draft has no owner.

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
  v_cities text[];
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

  -- service_area_cities arrives as a JSON array. Empty arrays are treated as
  -- "no change" rather than "clear the list": every caller that has nothing to
  -- say sends nothing, and a caller that genuinely wants it emptied is not a
  -- case that exists yet.
  if jsonb_typeof(p_patch->'service_area_cities') = 'array'
     and jsonb_array_length(p_patch->'service_area_cities') > 0 then
    select array_agg(value::text)
      into v_cities
      from jsonb_array_elements_text(p_patch->'service_area_cities') as value
     where length(trim(value)) > 0;
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
    -- NEW, and the reason this migration exists.
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


-- Opening hours for an UNCLAIMED draft.
--
-- settings_business_hours is owner-scoped, and a draft has no owner yet, so the
-- normal policy cannot authorise this write. The draft_token is the credential,
-- exactly as it is for every other draft mutation.
--
-- Takes the whole week at once. Hours are only meaningful as a set -- five rows
-- and two silences is a business that might be closed at the weekend or might
-- simply not have said -- and a per-day writer makes that ambiguity permanent.
create or replace function set_business_hours_in_progress(
  p_id uuid,
  p_draft_token uuid,
  p_hours jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row businesses%rowtype;
  v_entry jsonb;
  v_weekday smallint;
  v_written int := 0;
begin
  select * into v_row from businesses where id = p_id;

  if not found
     or v_row.owner_id is not null
     or v_row.draft_token is null
     or v_row.draft_token is distinct from p_draft_token
  then
    return jsonb_build_object('ok', false, 'error', 'not_an_open_draft');
  end if;

  if jsonb_typeof(p_hours) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'hours_not_an_array');
  end if;

  for v_entry in select * from jsonb_array_elements(p_hours) loop
    v_weekday := (v_entry->>'weekday')::smallint;
    if v_weekday is null or v_weekday < 0 or v_weekday > 6 then
      continue;
    end if;
    insert into settings_business_hours (business_id, weekday, open_time, close_time, closed)
    values (
      p_id,
      v_weekday,
      nullif(v_entry->>'open', '')::time,
      nullif(v_entry->>'close', '')::time,
      coalesce((v_entry->>'closed')::boolean, false)
    )
    on conflict (business_id, weekday) do update
      set open_time = excluded.open_time,
          close_time = excluded.close_time,
          closed = excluded.closed;
    v_written := v_written + 1;
  end loop;

  return jsonb_build_object('ok', true, 'written', v_written);
end;
$$;

grant execute on function set_business_hours_in_progress(uuid, uuid, jsonb) to anon, authenticated;
revoke all on function set_business_hours_in_progress(uuid, uuid, jsonb) from public;
