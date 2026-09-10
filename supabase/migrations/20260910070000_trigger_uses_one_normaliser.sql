-- ONE NORMALISER FOR THE CHARACTER RULES.
--
-- "George's Window Cleaning Company" became george-s-window-cleaning-company. The
-- apostrophe fix from this morning lives in hubly_slugify, which strips ' before anything
-- splits on it — and the slug_follows_name trigger, written this afternoon, carried its
-- own inline regexp_replace instead of calling it. Two normalisers, one of them missing a
-- fix the other already had: the same "two of almost everything" shape as the two edit
-- lanes and the two booking exits.
--
-- The trigger now calls hubly_slugify. Deriving a SHORT address from a name is a separate
-- question (hubly_short_slug, measured but deliberately NOT wired here) — but whatever
-- decides the words, the CHARACTER rules are one function from now on.
create or replace function public.slug_follows_name()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_base text;
  v_try text;
  v_n int := 0;
begin
  if new.owner_id is not null then return new; end if;
  if coalesce(btrim(new.name), '') = '' then return new; end if;
  if new.name is not distinct from old.name then return new; end if;
  if new.slug !~ '^site-[0-9a-f]{6}$' then return new; end if;

  -- ONE normaliser. Apostrophes collapse here (georges, not george-s).
  v_base := left(hubly_slugify(new.name), 40);
  v_base := trim(both '-' from coalesce(v_base, ''));
  if v_base = '' then return new; end if;

  v_try := v_base;
  while exists (select 1 from businesses b where b.slug = v_try and b.id <> new.id) loop
    v_n := v_n + 1;
    if v_n > 6 then return new; end if;
    v_try := v_base || '-' || substr(md5(random()::text), 1, 5);
  end loop;

  new.slug := v_try;
  return new;
end;
$$;
