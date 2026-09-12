-- THE RENAME THAT ACTUALLY HAPPENS MUST WRITE ITS OWN HISTORY.
--
-- business_slug_history has held ZERO rows since it was created (2026-09-09). Not because
-- nobody renames — every named draft renames, from site-XXXXXX to a slug derived from the
-- name — but because the rename that happens in the product is the TRIGGER below, and only
-- the explicit RPC (set_business_slug, used when an owner deliberately changes their
-- address) was writing history. Nobody has used that RPC.
--
-- The cost was paid on 2026-09-12: an audit of six pages carrying dead booking links had to
-- infer each page's former slug from the stale link inside the page itself, because the
-- table that exists to record it was empty. With history written, that audit is a join.
--
-- WHAT THIS TABLE IS, AND IS NOT. It is PROVENANCE: a record that a business's address
-- changed, when, and from what. It is NOT a redirect table and nothing honours it —
-- <old-slug>.myhubly.app resolves to nothing today and will keep resolving to nothing. A
-- future alias table could read these rows; none exists. Recorded so the next person does
-- not mistake a log for a safety net, which is how "we recorded the old slugs" became a
-- sentence we believed about an empty table.
comment on table public.business_slug_history is
  'Provenance of every address change: who/when/from what. NOT a redirect or alias table — '
  'nothing resolves an old slug today. Written by slug_follows_name() (derived renames) and '
  'set_business_slug() (owner-initiated ones). Rows with renamed_by = null and '
  'reconstructed = true were rebuilt from evidence after the fact, not recorded at the time.';

-- Rows recovered after the fact are marked, so nobody reads them as contemporaneous.
alter table public.business_slug_history
  add column if not exists reconstructed boolean not null default false;
comment on column public.business_slug_history.reconstructed is
  'true = this row was rebuilt from evidence (a stale link in the stored page) on 2026-09-12, '
  'not written when the rename happened. Its renamed_at is the backfill time, not the rename.';

-- THE TRIGGER, NOW RECORDING. Unchanged in what it decides — same guards, same derivation,
-- same skips — with one insert added on the path that actually changes the slug.
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

  -- PROVENANCE, on the path that renames. Best-effort by design: a failure to record the
  -- rename must never fail the rename itself — the owner's address is the product, the log
  -- is the instrument. It is an exception block rather than a silent one so a broken insert
  -- shows up in the postgres log instead of disappearing.
  begin
    insert into public.business_slug_history (business_id, old_slug, new_slug, renamed_by, was_claimed)
    values (new.id, new.slug, v_try, null, false);
  exception when others then
    raise warning 'slug_follows_name: history not recorded for % (% -> %): %', new.id, new.slug, v_try, sqlerrm;
  end;

  new.slug := v_try;
  return new;
end;
$fn$;
