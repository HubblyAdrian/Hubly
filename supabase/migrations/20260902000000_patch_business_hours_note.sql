-- hours_note reaches the record. And ok:true stops being proof.
--
-- THE BUG (found live 2026-09-02, as the owner on evergreen-yard-care).
-- The owner said "Weekends are by appointment." Extraction read it correctly and
-- classified it as hoursNote. applyExtractedFacts staged it. This function then
-- DISCARDED it — `hours_note` was in neither v_known nor the UPDATE — raised its
-- allowlist-drop warning, returned dropped_keys:['hours_note'], and returned
-- **ok:true**. The caller read ok:true as proof, counted the field as written,
-- and told the model: "saved from what they typed — hoursNote. Do NOT ask for any
-- of these again." businesses.hours_note was still null. The owner was told a
-- fact was saved that had been thrown away, and Hubly was instructed never to ask
-- for it again — the exact false-success this codebase is built to prevent.
--
-- The same column is written by the Edit-details panel's Note field
-- (applyOwnerRecordEdit, kind:"hours"), which has therefore been answering
-- "Saved." over a discarded write for as long as it has existed. Two paths, one
-- missing column.
--
-- THE FIX IS TWO-PART AND THE SECOND PART IS THE IMPORTANT ONE.
--   1. Here: hours_note joins v_known and the UPDATE. (This alone would close the
--      symptom and leave the class untouched.)
--   2. In hubly_capability_registry.ts: every caller now reads `dropped_keys` off
--      the response and reports those keys as FAILED, not written. `ok:true` is no
--      longer evidence a field landed. Without that, the whole "a fact write
--      always produces a truth" seam rests on a function that says yes while
--      throwing fields away, and instance six is only a new column away.
--
-- This is the FIFTH instance of the documented allowlist-drop family
-- (_shared/hubly_allowlist.ts). The drop REPORT that this function already emits
-- was added in 20260821000000 precisely so a drop would be visible — and no
-- caller read it. A report nobody reads is not a safeguard.
--
-- AUDITED, not assumed: every key any caller can place in p_patch was collected
-- from the source (applyExtractedFacts, applyOwnerRecordEdit contact+hours,
-- updateDraft's column map, uploadDraftLogo, uploadDraftHeroImage, the header
-- chrome action) and diffed against v_known. `hours_note` was the only key sent
-- and not covered. Six keys are covered and sent by nobody (bg_color,
-- section_order, gen_about, gen_seo_description, gen_why_choose, gen_faq) —
-- over-permissive, harmless, left alone. `header_mode` is covered and writes to
-- meta.headerMode rather than a column, which is correct.
--
-- Rebuilt verbatim from 20260831070000 (the owner-authorised version, which is
-- what is live): signature, authorise block, drop-report and every other column
-- are byte-identical. Only the two hours_note lines are new.

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
