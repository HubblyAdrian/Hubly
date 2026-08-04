-- Root cause of the cross-industry content leak: the public renderer
-- (loadPublicProfile in hubly.html) never reads businesses.business_type
-- at all -- it only reads meta.businessType (applyBizMeta:
-- "if(meta.businessType)S.businessType=meta.businessType;"), a separate
-- top-level field inside the meta JSON blob. patch_business_in_progress
-- was only ever writing the real business_type column, never
-- meta.businessType, so S.businessType stayed permanently unset for every
-- anonymous draft -- getActiveBlueprint() then always fell back to the
-- 'detailing' default blueprint (trust badges, services/reviews copy, the
-- bottom CTA), regardless of what the real column correctly said.
--
-- Verified live before this fix: a real business with business_type
-- correctly set to 'photography' in the column still rendered "Insured /
-- Mobile / Pro products", "Professional detailing packages...", and
-- "Book your detail today" on the actual live page.
--
-- Fix: keep meta.businessType in sync with the real column, the same way
-- layout already lives in meta.website.layout -- one authoritative write
-- path, not a second field nobody populates.

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

  if p_website_meta is not null or v_business_type is not null then
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
    logo_url = coalesce(p_patch->>'logo_url', logo_url),
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

-- start_business_in_progress also needs to seed meta.businessType at
-- creation time -- it already sets the real column, this keeps both in
-- sync from the very first paint, not just after the first update.
create or replace function start_business_in_progress(
  p_name text,
  p_business_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_token uuid := gen_random_uuid();
  v_base text;
  v_slug text;
  v_type text;
  v_meta text;
  v_tries int := 0;
begin
  if coalesce(trim(p_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_name');
  end if;

  v_type := nullif(trim(coalesce(p_business_type, '')), '');
  v_meta := case when v_type is not null
    then jsonb_build_object('businessType', v_type)::text
    else null
  end;

  v_base := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if v_base = '' then v_base := 'business'; end if;
  v_base := left(v_base, 40);

  loop
    v_slug := v_base || case when v_tries = 0 then '' else '-' || substr(md5(random()::text), 1, 5) end;
    begin
      if v_type is null then
        insert into businesses (name, slug, owner_id, draft_token)
        values (trim(p_name), v_slug, null, v_token)
        returning id into v_id;
      else
        insert into businesses (name, slug, business_type, owner_id, draft_token, meta)
        values (trim(p_name), v_slug, v_type, null, v_token, v_meta)
        returning id into v_id;
      end if;
      exit;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 6 then
        return jsonb_build_object('ok', false, 'error', 'slug_unavailable');
      end if;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug, 'draft_token', v_token);
end;
$$;

grant execute on function start_business_in_progress(text, text) to anon, authenticated;
revoke all on function start_business_in_progress(text, text) from public;
