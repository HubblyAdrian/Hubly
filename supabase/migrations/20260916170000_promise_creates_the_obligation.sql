-- THE PROMISE CREATES THE OBLIGATION, NOT THE CLAIM.
--
-- Adrian's ruling, 2026-09-16: "Before we put an address in writing, a draft slug moves freely —
-- nobody has been told anything. The moment we say 'apollow.myhubly.app is reserved for you,' it
-- stops being free. Arm the same needs_confirm the claimed path has, from the promise onward, and
-- THE CONFIRM NAMES THE COST IN WORDS: the old address stops working. The gate's trigger is
-- DERIVED FROM WHETHER WE PROMISED, not from a draft/claimed flag."
--
-- THE REASONING WAS ALREADY IN THE CODE, WITH THE WRONG TRIGGER ATTACHED TO IT. slug_follows_name
-- carries this comment verbatim:
--
--     "POST-CLAIM: never, whoever authored the slug. Sharing is what makes an address
--      load-bearing, not authorship — by now someone may hold the link."
--
-- Exactly right, and then it used `owner_id is not null` as the proxy for "shared". Claiming is
-- not when an address becomes load-bearing. WRITING IT DOWN FOR SOMEONE IS.
--
-- MEASURED, 2026-09-16. apollo-weeds: Hubly wrote "The address apollow.myhubly.app is reserved for
-- you" at 03:07:08, and the slug was apolloweeds by 03:07:20 and apollo-weeds by 03:08:52. Three
-- renames in 108 seconds, none confirmed, none mentioned. Across the whole corpus, THREE turns
-- named an address that is not the address today, and none of the three old addresses resolves:
-- site-e888ea, toms-clean-gutters, apollow. Zero rows hold any of them.
--
-- (Not keystrokes — that hypothesis was tested and disproved: three DISTINCT user messages, each
-- ~5s before its rename. See docs/SETTLED.md entry 15.)

-- ── THE PREDICATE, DERIVED FROM THE CONVERSATION ─────────────────────────────────────────
--
-- NOT A FLAG ON THE ROW. A boolean someone must remember to set is a boolean that gets forgotten,
-- and this one would be forgotten on exactly the path that composes the promise client-side. The
-- conversation IS the record of what we told him, so the question is asked of the record:
-- has any assistant turn for this business ever named a *.myhubly.app address?
--
-- It answers about HIM, not about our bookkeeping (Lesson 86): "did we put an address in writing"
-- is a fact about the transcript, and an empty transcript honestly means we never did.
create or replace function public.hubly_address_promised(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_conversations c
     where c.business_id = p_business_id
       and c.role = 'assistant'
       and c.content::text ~* '[a-z0-9][a-z0-9-]*\.myhubly\.app'
  );
$$;

comment on function public.hubly_address_promised(uuid) is
  'True once Hubly has named a *.myhubly.app address to this owner in the conversation. The moment '
  'an address is in writing it stops being free to move — sharing is what makes an address '
  'load-bearing, not authorship, and not claiming.';

-- ── 1. THE NAME NO LONGER DRAGS THE ADDRESS AFTER A PROMISE ──────────────────────────────
create or replace function public.slug_follows_name()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_base text; v_try text; v_n int := 0;
begin
  -- POST-CLAIM: never, whoever authored the slug.
  if new.owner_id is not null then return new; end if;

  -- POST-PROMISE: never either, and for the SAME reason the line above exists. Once we have
  -- written "{slug}.myhubly.app is reserved for you", someone may hold that link — it is on their
  -- screen, in their transcript, and it is the address they will type. A rename after this point
  -- is still allowed; it just stops being SILENT. It goes through business.setAddress, which
  -- refuses without confirmation and states the cost first.
  if public.hubly_address_promised(new.id) then return new; end if;

  -- CHOSEN, EVER: never silently overwritten, pre-claim or not. They asked for it.
  if coalesce(new.slug_chosen, false) then return new; end if;

  if coalesce(btrim(new.name), '') = '' then return new; end if;
  if new.name is not distinct from old.name then return new; end if;

  v_base := trim(both '-' from coalesce(hubly_derive_slug(new.name), ''));
  if v_base = '' then return new; end if;
  if v_base = new.slug then return new; end if;

  v_try := v_base;
  while exists (select 1 from businesses b where b.slug = v_try and b.id <> new.id) loop
    v_n := v_n + 1;
    if v_n > 6 then return new; end if;
    v_try := v_base || '-' || substr(md5(random()::text), 1, 5);
  end loop;

  -- PROVENANCE, best-effort by design: a failure to record the rename must never fail the rename.
  begin
    insert into public.business_slug_history (business_id, old_slug, new_slug, renamed_by, was_claimed)
    values (new.id, new.slug, v_try, null, false);
  exception when others then
    raise warning 'slug_follows_name: history not recorded for % (% -> %): %', new.id, new.slug, v_try, sqlerrm;
  end;

  new.slug := v_try;
  return new;
end;
$$;

-- ── 2. AND THE EXPLICIT WRITER ASKS FIRST, ON A PROMISED DRAFT TOO ───────────────────────
--
-- set_business_slug already refuses a CLAIMED rename without p_confirmed, and the capability's
-- needs_confirm summary already names the cost in words:
--   "Their current address {old}.myhubly.app STOPS WORKING the moment it changes — anyone holding
--    the old link will not reach them. Say exactly that, then ask if they want it."
-- That sentence is reused, not rewritten. Only the condition that reaches it changes.
create or replace function public.set_business_slug(
  p_business_id uuid, p_owner_id uuid, p_slug text, p_confirmed boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare b record; want text; avail jsonb; v_promised boolean;
begin
  select id, slug, owner_id into b from public.businesses where id = p_business_id;
  if b.id is null then return jsonb_build_object('ok', false, 'error', 'no_business'); end if;
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

  -- CLAIMED **OR PROMISED** needs the owner to have seen and accepted the cost.
  v_promised := public.hubly_address_promised(p_business_id);
  if (b.owner_id is not null or v_promised) and not p_confirmed then
    return jsonb_build_object('ok', false, 'error', 'needs_confirm',
                              'slug', want, 'old_slug', b.slug, 'promised', v_promised);
  end if;

  insert into public.business_slug_history (business_id, old_slug, new_slug, renamed_by, was_claimed)
  values (p_business_id, b.slug, want, p_owner_id, b.owner_id is not null);
  update public.businesses set slug = want where id = p_business_id;
  return jsonb_build_object('ok', true, 'slug', want, 'old_slug', b.slug,
                            'was_claimed', b.owner_id is not null, 'was_promised', v_promised);
end;
$$;

grant execute on function public.hubly_address_promised(uuid) to anon, authenticated, service_role;
grant execute on function public.set_business_slug(uuid, uuid, text, boolean) to authenticated, service_role;
