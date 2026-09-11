CREATE OR REPLACE FUNCTION public.set_business_slug(p_business_id uuid, p_owner_id uuid, p_slug text, p_confirmed boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b record; want text; avail jsonb;
begin
  select id, slug, owner_id into b from public.businesses where id = p_business_id;
  if b.id is null then return jsonb_build_object('ok', false, 'error', 'no_business'); end if;
  -- A claimed business is owner-authorised; an unclaimed draft is reachable by the
  -- conversation that owns it (the caller has already checked the draft token).
  if b.owner_id is not null and (p_owner_id is null or b.owner_id <> p_owner_id) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;

  want := public.hubly_slugify(p_slug);
  if want is null then return jsonb_build_object('ok', false, 'error', 'not_a_slug'); end if;
  if want = b.slug then return jsonb_build_object('ok', true, 'slug', b.slug, 'unchanged', true); end if;

  avail := public.hubly_slug_available(want, p_business_id);
  if (avail->>'taken')::boolean then
    return jsonb_build_object('ok', false, 'error', 'taken', 'slug', want, 'suggestion', avail->>'suggestion');
  end if;

  -- The claimed case needs the owner to have seen and accepted the cost.
  if b.owner_id is not null and not p_confirmed then
    return jsonb_build_object('ok', false, 'error', 'needs_confirm', 'slug', want, 'old_slug', b.slug);
  end if;

  insert into public.business_slug_history (business_id, old_slug, new_slug, renamed_by, was_claimed)
  values (p_business_id, b.slug, want, p_owner_id, b.owner_id is not null);
  -- AND RECORD THAT THEY CHOSE IT. Without this the address they asked for is
  -- indistinguishable from one we derived, and the next name change would silently
  -- overwrite it — which is the whole reason this column exists.
  update public.businesses set slug = want, slug_chosen = true where id = p_business_id;
  return jsonb_build_object('ok', true, 'slug', want, 'old_slug', b.slug, 'was_claimed', b.owner_id is not null);
end;
$function$
;