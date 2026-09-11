-- RECORD THE FACT INSTEAD OF PATTERN-MATCHING IT.
--
-- slug_follows_name only fired while the slug matched ^site-[0-9a-f]{6}$. That regex was a
-- HEURISTIC STANDING IN FOR A FACT: it recognised our own output rather than recording it,
-- and it stopped being true the moment we derived a real-looking slug. After one rename
-- the address is bright-windows, the pattern no longer matches, and a second rename would
-- not follow — even though nobody chose bright-windows either. We derived it from a name
-- they gave, so it is exactly as much our invention as site-a1b2c3 was.
--
-- Same shape as re-recognising a services section by its markup: the answer is to stamp
-- the fact while we still know it, not to infer it afterwards.
--
-- The question the guard is actually asking is: DID WE MAKE THIS ADDRESS UP, OR DID THEY
-- CHOOSE IT?
alter table public.businesses
  add column if not exists slug_chosen boolean not null default false;

comment on column public.businesses.slug_chosen is
'TRUE only when the OWNER explicitly asked for this address ("make my address X"), set by set_business_slug. FALSE when Hubly derived it — minted at draft creation, or followed a name change. It decides whether a later rename may move the address silently: a derived address is ours to correct, an address someone asked for is theirs. BACKFILL CAVEAT: every row existing before 2026-09-11 defaults to FALSE, because we did not record this at the time and cannot now reconstruct it. If a business DID choose its address before that date we have no way to know, so a pre-2026-09-11 row reading false means "not recorded", not "definitely derived". Post-claim this column does not matter — see slug_follows_name, which never moves a claimed address regardless of who authored it, because by then someone may have shared the link and that outranks authorship.';

-- THE TRIGGER, reading the fact.
create or replace function public.slug_follows_name()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_base text; v_try text; v_n int := 0;
begin
  -- POST-CLAIM: never, whoever authored the slug. Sharing is what makes an address
  -- load-bearing, not authorship — by now someone may hold the link. A claimed rename is
  -- explicit, through setAddress, with the consequence stated before it commits.
  if new.owner_id is not null then return new; end if;

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

  new.slug := v_try;
  return new;
end;
$fn$;
