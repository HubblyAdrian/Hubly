-- ═══════════════════════════════════════════════════════════════════════════════
-- THE NAME AND THE ADDRESS.
--
-- Nothing in the product could write a slug. It was minted from the first name at
-- startDraft and was permanent — so "Aviation Business", a category the model invented
-- because two live instructions contradicted each other, became a real person's
-- permanent web address with no way to change it.
--
-- HOW A SLUG RESOLVES, measured 2026-09-09: vercel.json routes everything to
-- api/router.js, which reads the Host header, takes the first label, and always serves
-- the same hubly.html. The slug is then resolved CLIENT-side by get_public_business.
-- There is no DNS record per business, no Vercel config, no lookup table — a slug is a
-- row with a UNIQUE constraint and nothing else. So a rename is an UPDATE, and the old
-- address stops resolving the moment it lands.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Marked, not faked. An owner who would not give a name gets an honest gap they can
-- close in one sentence, never a real-looking name they did not choose.
alter table public.businesses add column if not exists name_unset boolean not null default false;

-- ── HISTORY, EVEN THOUGH NOTHING READS IT YET ────────────────────────────────
-- No redirect, no resolution change, nothing on the public path — that path serves
-- Graef's live site and is not being touched at the end of a long session. But when an
-- alias table is built, every rename that happened in the meantime can be honoured
-- retroactively. Losing that to save one insert would be silly.
create table if not exists public.business_slug_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  old_slug text not null,
  new_slug text not null,
  renamed_at timestamptz not null default now(),
  renamed_by uuid,
  was_claimed boolean not null
);
create index if not exists business_slug_history_old on public.business_slug_history (old_slug);

-- ── NORMALISE ────────────────────────────────────────────────────────────────
-- "Graef's Auto Detailing & Ceramic" is not a subdomain. An apostrophe cannot survive,
-- "&" cannot survive, and the result is a string the owner did not type — which is
-- exactly why it is READ BACK before it commits rather than after.
create or replace function public.hubly_slugify(p_text text)
returns text language sql immutable as $$
  select nullif(
    trim(both '-' from
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(coalesce(p_text, '')), '[''’`]', '', 'g'),
          '[^a-z0-9]+', '-', 'g'),
        '-{2,}', '-', 'g')),
    '');
$$;

/** Is this address free? Returns the slug if it is, else the first free numbered
 *  variant — the CALLER offers that as a choice. It never picks: silently appending a
 *  digit is how aviation-business-1 gets minted a second time in a different way. */
create or replace function public.hubly_slug_available(p_slug text, p_business_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare base text := public.hubly_slugify(p_slug); n int := 1; try text;
begin
  if base is null then return jsonb_build_object('ok', false, 'error', 'not_a_slug'); end if;
  if not exists (select 1 from public.businesses where slug = base and (p_business_id is null or id <> p_business_id)) then
    return jsonb_build_object('ok', true, 'slug', base, 'taken', false);
  end if;
  loop
    n := n + 1;
    try := base || '-' || n;
    exit when not exists (select 1 from public.businesses where slug = try);
    exit when n > 40;
  end loop;
  return jsonb_build_object('ok', true, 'slug', base, 'taken', true, 'suggestion', try);
end;
$$;

-- ── THE WRITER ───────────────────────────────────────────────────────────────
-- BEFORE CLAIM the slug follows the name silently: nobody has seen the URL, nothing
-- links to it, so there is no cost to pay and no question to ask.
--
-- AFTER CLAIM it is explicit, and the consequence is in the confirm itself rather than a
-- footnote after it: the old address STOPS WORKING the moment this runs. That is a real
-- trade and it is the owner's to make — but right now they have no choice at all, which
-- is worse than a choice with a cost.
create or replace function public.set_business_slug(
  p_business_id uuid, p_owner_id uuid, p_slug text, p_confirmed boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
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
  update public.businesses set slug = want where id = p_business_id;
  return jsonb_build_object('ok', true, 'slug', want, 'old_slug', b.slug, 'was_claimed', b.owner_id is not null);
end;
$$;

grant execute on function public.hubly_slugify(text) to authenticated, service_role;
grant execute on function public.hubly_slug_available(text, uuid) to authenticated, service_role;
grant execute on function public.set_business_slug(uuid, uuid, text, boolean) to authenticated, service_role;
-- Its own writer rather than a new key in patch_business_in_progress: that function
-- ignores keys it does not know, so routing name_unset through it would have written
-- nothing and reported success — a false green inside the fix for invented names.
create or replace function public.set_business_name_unset(
  p_id uuid, p_draft_token uuid, p_owner_id uuid, p_value boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select id, owner_id, draft_token into b from public.businesses where id = p_id;
  if b.id is null then return jsonb_build_object('ok', false, 'error', 'no_business'); end if;
  if b.owner_id is not null then
    if p_owner_id is null or b.owner_id <> p_owner_id then
      return jsonb_build_object('ok', false, 'error', 'not_owner');
    end if;
  elsif b.draft_token is not null and (p_draft_token is null or b.draft_token <> p_draft_token) then
    return jsonb_build_object('ok', false, 'error', 'bad_token');
  end if;
  update public.businesses set name_unset = coalesce(p_value, false) where id = p_id;
  return jsonb_build_object('ok', true, 'name_unset', coalesce(p_value, false));
end;
$$;
grant execute on function public.set_business_name_unset(uuid, uuid, uuid, boolean) to anon, authenticated, service_role;
