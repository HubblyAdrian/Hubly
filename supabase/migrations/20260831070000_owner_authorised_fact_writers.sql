-- Facts stated by talking must reach the record on a CLAIMED site too.
--
-- THE BUG (2026-08-31): patch_business_in_progress, set_business_hours_in_progress
-- and set_business_draft_services all refuse the write the moment a business is
-- claimed (`v_row.owner_id is not null`), because the only credential they accept
-- is the draft token, which is nulled at claim. So on any claimed site NO fact
-- stated in chat — phone, email, city, state, address, hours, hours_note,
-- services — ever reached the record. All the placement work sat behind a locked
-- door. Found when the owner of evergreen-yard-care said "add my phone number"
-- and got "may already have been claimed".
--
-- THE FIX — identical to what create_business_document already does
-- (20260822030000): an UNCLAIMED draft is authorised by its token (unchanged); a
-- CLAIMED business is authorised by OWNERSHIP — p_owner_id must equal owner_id.
-- p_owner_id defaults null, so every existing anon-draft write is byte-for-byte
-- unchanged. This ADDS a route; it does not replace one.
--
-- SECURITY — p_owner_id is TRUSTED, so it must be unforgeable. These functions
-- were granted to anon/authenticated (for the anon draft-token path). An
-- anon-callable function that trusts p_owner_id would let the browser forge
-- another owner's uid. So, exactly like create_business_document, all three are
-- now **service_role only**: the browser cannot reach them, and the ONLY caller
-- is the edge function (callBusinessRpc, service-role), which sets p_owner_id
-- ONLY after verifying the caller's JWT against /auth/v1/user (resolveOwnerUid).
-- Confirmed before writing this: no public/*.html or api/*.js calls these RPCs
-- directly; the sole caller is _shared/hubly_capability_registry.ts. The token
-- path is unchanged for the edge; only the browser's (unused) grant is removed.

-- ── 1. patch_business_in_progress ───────────────────────────────────────────
-- Rebuilt verbatim from 20260821000000 (the drop-report version) — only the
-- signature (+ p_owner_id) and the authorise block change; the whitelist,
-- drop-report and UPDATE are untouched.
drop function if exists public.patch_business_in_progress(uuid, uuid, jsonb, jsonb);

create or replace function public.patch_business_in_progress(
  p_id uuid,
  p_draft_token uuid,
  p_patch jsonb default '{}'::jsonb,
  p_website_meta jsonb default null,
  p_owner_id uuid default null
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
  v_cities jsonb;
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
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  -- Authorise: unclaimed -> the draft token; claimed -> the verified owner.
  if v_row.owner_id is null then
    if v_row.draft_token is null or v_row.draft_token is distinct from p_draft_token then
      return jsonb_build_object('ok', false);
    end if;
  else
    if p_owner_id is null or v_row.owner_id is distinct from p_owner_id then
      return jsonb_build_object('ok', false);
    end if;
  end if;

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
      v_meta := jsonb_set(v_meta, '{website}', coalesce(v_meta->'website', '{}'::jsonb) || p_website_meta, true);
    end if;
    if v_business_type is not null then
      v_meta := jsonb_set(v_meta, '{businessType}', to_jsonb(v_business_type), true);
    end if;
    if v_header_mode is not null then
      v_meta := jsonb_set(v_meta, '{headerMode}', to_jsonb(v_header_mode), true);
    end if;
  end if;

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
    state = coalesce(nullif(p_patch->>'state', ''), state),
    address = coalesce(nullif(p_patch->>'address', ''), address),
    service_area_cities = coalesce(v_cities, service_area_cities),
    travel_radius_miles = coalesce((nullif(p_patch->>'travel_radius_miles', ''))::numeric, travel_radius_miles),
    years_in_business = coalesce((nullif(p_patch->>'years_in_business', ''))::int, years_in_business),
    business_type = coalesce(v_business_type, business_type),
    brand_color = coalesce(p_patch->>'brand_color', brand_color),
    bg_color = coalesce(p_patch->>'bg_color', bg_color),
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

revoke all on function public.patch_business_in_progress(uuid, uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.patch_business_in_progress(uuid, uuid, jsonb, jsonb, uuid) to service_role;

-- ── 2. set_business_hours_in_progress ───────────────────────────────────────
drop function if exists public.set_business_hours_in_progress(uuid, uuid, jsonb);

create or replace function public.set_business_hours_in_progress(
  p_id uuid,
  p_draft_token uuid,
  p_hours jsonb,
  p_owner_id uuid default null
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
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_row.owner_id is null then
    if v_row.draft_token is null or v_row.draft_token is distinct from p_draft_token then
      return jsonb_build_object('ok', false, 'error', 'not_an_open_draft');
    end if;
  else
    if p_owner_id is null or v_row.owner_id is distinct from p_owner_id then
      return jsonb_build_object('ok', false, 'error', 'not_owner');
    end if;
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

revoke all on function public.set_business_hours_in_progress(uuid, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.set_business_hours_in_progress(uuid, uuid, jsonb, uuid) to service_role;

-- ── 3. set_business_draft_services ──────────────────────────────────────────
drop function if exists public.set_business_draft_services(uuid, uuid, jsonb);

create or replace function public.set_business_draft_services(
  p_id uuid,
  p_draft_token uuid,
  p_services jsonb,
  p_owner_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row businesses%rowtype;
  v_item jsonb;
  v_count int := 0;
  v_sort int := 0;
begin
  select * into v_row from businesses where id = p_id;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  if v_row.owner_id is null then
    if v_row.draft_token is null or v_row.draft_token is distinct from p_draft_token then
      return jsonb_build_object('ok', false);
    end if;
  else
    if p_owner_id is null or v_row.owner_id is distinct from p_owner_id then
      return jsonb_build_object('ok', false);
    end if;
  end if;
  if jsonb_typeof(p_services) is distinct from 'array' then
    return jsonb_build_object('ok', false);
  end if;

  delete from services where business_id = p_id;

  for v_item in select * from jsonb_array_elements(p_services)
  loop
    if coalesce(trim(v_item->>'name'), '') = '' then
      continue;
    end if;
    insert into services (business_id, name, description, price, duration_hours, sort_order)
    values (
      p_id,
      trim(v_item->>'name'),
      nullif(v_item->>'description', ''),
      coalesce((v_item->>'price')::numeric, 0),
      nullif(v_item->>'durationHours', '')::numeric,
      v_sort
    );
    v_count := v_count + 1;
    v_sort := v_sort + 1;
  end loop;

  return jsonb_build_object('ok', true, 'id', p_id, 'slug', v_row.slug, 'count', v_count);
end;
$$;

revoke all on function public.set_business_draft_services(uuid, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.set_business_draft_services(uuid, uuid, jsonb, uuid) to service_role;
