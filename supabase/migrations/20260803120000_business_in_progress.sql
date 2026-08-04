-- Business in Progress: gives an anonymous Experience 1 visitor a real
-- businesses row (owner_id null) the moment there's enough to build
-- something real with, instead of a disconnected preview. Claiming happens
-- naturally later when they actually sign up (owner_id gets set the normal
-- way) — nothing here changes that path.
--
-- Security shape deliberately mirrors complete_abandoned_booking() (see
-- 20260713070000_complete_abandoned_booking.sql): no broad anon INSERT/
-- UPDATE grant on businesses itself — anon already has table-level SELECT
-- ("Public can read businesses", real and unrelated to this). Instead, two
-- narrow SECURITY DEFINER functions, each doing exactly one thing, with a
-- server-generated draft_token as the only way to keep writing to a row you
-- don't own yet. Uniform failure responses so ids/tokens can't be probed.

alter table businesses add column if not exists draft_token uuid;

-- ---------------------------------------------------------------------
-- start_business_in_progress: creates the row. Only name is required —
-- everything else the conversation learns arrives via patch_business_in_progress.
-- ---------------------------------------------------------------------
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
  v_tries int := 0;
begin
  if coalesce(trim(p_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_name');
  end if;

  v_type := nullif(trim(coalesce(p_business_type, '')), '');

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
        insert into businesses (name, slug, business_type, owner_id, draft_token)
        values (trim(p_name), v_slug, v_type, null, v_token)
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

-- ---------------------------------------------------------------------
-- patch_business_in_progress: the only way to keep writing to a draft row.
-- Requires the exact draft_token handed back at creation AND that the row
-- is still unclaimed (owner_id is null) — the instant a real signup claims
-- it, this function stops accepting writes for it, same as
-- complete_abandoned_booking's phone-match check stops working once a
-- booking is no longer 'abandoned'.
--
-- p_patch is a whitelisted set of top-level text/jsonb fields — never a
-- generic column-name passthrough. p_website_meta merges (not replaces)
-- into meta->'website', for the one field that lives inside the meta blob
-- today: layout choice.
-- ---------------------------------------------------------------------
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
begin
  select * into v_row from businesses where id = p_id;

  if not found
     or v_row.owner_id is not null
     or v_row.draft_token is null
     or v_row.draft_token is distinct from p_draft_token
  then
    return jsonb_build_object('ok', false);
  end if;

  if p_website_meta is not null then
    v_meta := coalesce(nullif(v_row.meta, '')::jsonb, '{}'::jsonb);
    v_meta := jsonb_set(
      v_meta,
      '{website}',
      coalesce(v_meta->'website', '{}'::jsonb) || p_website_meta,
      true
    );
  end if;

  update businesses set
    name = coalesce(nullif(p_patch->>'name', ''), name),
    tagline = coalesce(p_patch->>'tagline', tagline),
    about = coalesce(p_patch->>'about', about),
    phone = coalesce(p_patch->>'phone', phone),
    email = coalesce(p_patch->>'email', email),
    city = coalesce(p_patch->>'city', city),
    business_type = coalesce(nullif(p_patch->>'business_type', ''), business_type),
    brand_color = coalesce(p_patch->>'brand_color', brand_color),
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
