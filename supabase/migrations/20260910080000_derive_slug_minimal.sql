-- DERIVE AN ADDRESS BY TAKING THE NAME, NOT BY DECIDING WHAT IT SHOULD BE.
--
-- A cleverer version of this existed for about an hour (hubly_short_slug: two-word cap,
-- filler stripping, a preference for trade nouns) and it is dropped below. Measured over
-- the corpus it produced dangling modifiers (black-gold-auto, pike-holloway-tree) and,
-- worse, dropped the trade entirely — "Sebastian Roesler Flight Instruction" became
-- sebastian-roesler, which reads as a person rather than a flight school. Reaching the
-- targets that motivated it ("georges-windows") needs semantics it cannot have honestly:
-- pluralising a trade noun, or dropping a modifier while keeping the noun, both of which
-- need a closed list of trades — and a closed list always misses the one a real owner types.
--
-- TRUNCATION IS FABRICATION IN MINIATURE. Every word dropped is us deciding what someone's
-- business is called: bright-clear-window drops "Care" and stops being their name;
-- bellweather-books drops half of a bookshop-café. The shortening should come from the
-- OWNER ASKING, in five words, after which it is theirs — not from us guessing well.
-- The actual complaint was "george-s-", and that was an apostrophe bug, not a length one.
--
-- So: collapse apostrophes (hubly_slugify, the ONE character normaliser), strip only words
-- that carry no identity, cap generously, and when the cap bites cut at a WORD BOUNDARY —
-- today's corpus contains "mobile-auto-detailing-in-los-ange", severed mid-word, which was
-- the ugliest string in the measurement.
drop function if exists public.hubly_short_slug(text);

create or replace function public.hubly_derive_slug(p_name text)
returns text language plpgsql immutable as $$
declare
  v_words text[];
  v_kept text[] := '{}';
  w text;
  v_out text;
  -- ONLY words that distinguish no business from any other. Nobody's business is
  -- distinguished by "Company". Deliberately short: every addition here is a word we have
  -- decided is not part of somebody's name.
  v_filler text[] := array['company','co','llc','inc','ltd','the','and','in'];
begin
  if coalesce(btrim(p_name), '') = '' then return null; end if;
  -- Characters first, through the one normaliser, so ' collapses (georges, not george-s).
  v_words := regexp_split_to_array(coalesce(hubly_slugify(p_name), ''), '-');
  foreach w in array v_words loop
    if w <> '' and not (w = any(v_filler)) then v_kept := v_kept || w; end if;
  end loop;
  -- Everything was filler ("The Company"): keep the faithful transcription over nothing.
  if array_length(v_kept, 1) is null then return hubly_slugify(p_name); end if;

  v_out := array_to_string(v_kept, '-');
  -- 40 characters, generous on purpose — it should almost never bite. When it does, drop
  -- whole words from the end. Never sever one.
  while length(v_out) > 40 and position('-' in v_out) > 0 loop
    v_out := left(v_out, length(v_out) - position('-' in reverse(v_out)));
  end loop;
  -- A single word longer than 40 chars is the one case with nothing to drop.
  return nullif(trim(both '-' from left(v_out, 40)), '');
end;
$$;

-- The trigger derives; set_business_slug still transcribes, because an address the owner
-- TYPED is not ours to edit — they said what they want.
create or replace function public.slug_follows_name()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_base text; v_try text; v_n int := 0;
begin
  if new.owner_id is not null then return new; end if;
  if coalesce(btrim(new.name), '') = '' then return new; end if;
  if new.name is not distinct from old.name then return new; end if;
  if new.slug !~ '^site-[0-9a-f]{6}$' then return new; end if;

  v_base := trim(both '-' from coalesce(hubly_derive_slug(new.name), ''));
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
