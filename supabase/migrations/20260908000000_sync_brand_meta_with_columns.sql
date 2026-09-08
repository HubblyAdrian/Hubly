-- Keep businesses.logo_url / banner_url and meta.logoUrl / meta.bannerUrl in step.
--
-- Shipped 2026-09-07 immediately after fixing the claimed-owner upload paths,
-- because that fix was a trap without this one: the owner heard "Your logo is
-- saved" and the next save from the website editor restored the previous logo.
-- A confirmation followed by a quiet revert is worse than the refusal it replaced.
--
-- This is a STOPGAP that keeps two homes in sync. It is not a fix for having two
-- homes; that is one resolver both paths call, filed as the #54 job.
--
-- Only the function body changes: same signature, same authorisation, same
-- allowlist. Verified by the sequence that actually matters — set by chat, then
-- save something unrelated in the editor, then reload.

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
  v_logo text;
  v_banner text;
  v_known text[] := array[
    'name','tagline','about','phone','email','city','state','address',
    'service_area_cities','travel_radius_miles','years_in_business',
    'business_type','header_mode','brand_color','bg_color','section_order',
    'logo_url','banner_url','gen_hero_headline','gen_hero_subhead','gen_about',
    'gen_seo_title','gen_seo_description','gen_why_choose','gen_faq',
    -- Added 2026-09-02. Missing from this list AND the UPDATE since the column
    -- existed, so every hours note ever stated was discarded behind an ok:true.
    'hours_note'
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

  -- STOPGAP, 2026-09-07: KEEP THE TWO HOMES IN SYNC. This is NOT a fix for having
  -- two homes.
  --
  -- The brand images live in BOTH businesses.logo_url/banner_url (columns) and
  -- meta.logoUrl/meta.bannerUrl (top-level meta). This RPC wrote only the columns,
  -- while the website editor LOADS meta over the column (hubly.html:15133) and then
  -- writes the loaded value back through resolveBrandCol (:17118). So a logo set by
  -- talking was invisible in the editor and the next editor save silently restored
  -- the old one — an owner told "Your logo is saved" and then quietly reverted,
  -- which is worse than the refusal this replaced.
  --
  -- Mirroring here rather than in one writer means EVERY caller of this RPC stays
  -- consistent, including ones not yet written. The real fix is ONE RESOLVER both
  -- paths call, so there is a single home — the #54 job, same shape, filed not done.
  v_logo := nullif(p_patch->>'logo_url', '');
  v_banner := nullif(p_patch->>'banner_url', '');

  if p_website_meta is not null or v_business_type is not null or v_header_mode is not null
     or v_logo is not null or v_banner is not null then
    v_meta := coalesce(nullif(v_row.meta, '')::jsonb, '{}'::jsonb);
    if p_website_meta is not null then
      v_meta := jsonb_set(v_meta, '{website}', coalesce(v_meta->'website', '{}'::jsonb) || p_website_meta, true);
    end if;
    if v_logo is not null then
      v_meta := jsonb_set(v_meta, '{logoUrl}', to_jsonb(v_logo), true);
    end if;
    if v_banner is not null then
      v_meta := jsonb_set(v_meta, '{bannerUrl}', to_jsonb(v_banner), true);
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
    -- Free-text hours phrasing, verbatim ("weekends by appointment"). Empty
    -- string CLEARS it: the owner deleting the note in the panel is a real edit,
    -- unlike the other fields here where blank means "not supplied".
    hours_note = case when p_patch ? 'hours_note' then nullif(p_patch->>'hours_note', '') else hours_note end,
    meta = coalesce(v_meta::text, meta)
  where id = p_id;

  return jsonb_build_object('ok', true, 'id', p_id, 'slug', v_row.slug)
    || case when v_dropped is null then '{}'::jsonb
            else jsonb_build_object('dropped_keys', to_jsonb(v_dropped)) end;
end;
$FN$;
-- Grants restated in the SAME order as 20260831070000 (revoke, then grant), so a
-- create-or-replace cannot leave this function reachable by anon/authenticated —
-- p_owner_id is TRUSTED and a browser-callable version would let it be forged.
revoke all on function public.patch_business_in_progress(uuid, uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.patch_business_in_progress(uuid, uuid, jsonb, jsonb, uuid) to service_role;
