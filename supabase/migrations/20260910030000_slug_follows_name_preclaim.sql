-- THE SLUG FOLLOWS THE NAME. AS A CONSEQUENCE, NOT AS A DECISION.
--
-- "The address follows the name" was implemented as an instruction telling the model it
-- MAY call setAddress after a rename. A consequence the model has to remember is a
-- consequence that happens sometimes: on 2026-09-09 Adrian named site-0d4b70 "James
-- famous photography" and the address stayed site-0d4b70, because nothing called it.
--
-- So it moves to the data layer, where it cannot be routed around by a new write path, a
-- forgotten capability call, or a model that had other priorities.
--
-- PRE-CLAIM ONLY, and that is the whole justification for having no ceremony: an
-- unclaimed draft's URL has been seen by nobody and linked from nowhere, so changing it
-- costs nothing and asking about it is the ceremony ruling 4 removed.
--
-- POST-CLAIM IS UNTOUCHED. Once owner_id is set, the old address stops working the moment
-- the slug changes and someone may hold that link — so it stays an explicit, confirmed
-- rename through setAddress, which states that consequence before it commits.
create or replace function public.slug_follows_name()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_base text;
  v_try text;
  v_n int := 0;
begin
  -- Claimed: never. A live address with links pointing at it is not ours to change
  -- silently. setAddress keeps its handshake for exactly this case.
  if new.owner_id is not null then return new; end if;

  -- Only when the name actually became something.
  if coalesce(btrim(new.name), '') = '' then return new; end if;
  if new.name is not distinct from old.name then return new; end if;

  -- Only while the address is still a system-issued placeholder. If the owner has
  -- deliberately chosen an address, a later name edit must not silently overwrite it —
  -- that would be the destructive default, and the tie never goes to destruction.
  if new.slug !~ '^site-[0-9a-f]{6}$' then return new; end if;

  v_base := left(trim(both '-' from regexp_replace(lower(btrim(new.name)), '[^a-z0-9]+', '-', 'g')), 40);
  if v_base = '' then return new; end if;

  v_try := v_base;
  while exists (select 1 from businesses b where b.slug = v_try and b.id <> new.id) loop
    v_n := v_n + 1;
    if v_n > 6 then return new; end if;   -- keep the placeholder rather than fail the name write
    v_try := v_base || '-' || substr(md5(random()::text), 1, 5);
  end loop;

  new.slug := v_try;
  return new;
end;
$$;

drop trigger if exists businesses_slug_follows_name on public.businesses;
create trigger businesses_slug_follows_name
  before update of name on public.businesses
  for each row execute function public.slug_follows_name();
