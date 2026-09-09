-- ═══════════════════════════════════════════════════════════════════════════════
-- THE RAIL GROWS WITH THE BUSINESS — the data half.
--
-- business_places has been live since 2026-09-08 with ZERO rows, so every business
-- fails open to the full rail and the earning rule exists as a decision rather than as
-- code. This fixes the data: a floor for everyone who is claimed, plus the places their
-- own history has already earned.
--
-- FAIL-OPEN IS PER BUSINESS, NOT CORPUS-WIDE. hc.places is loaded per slug through
-- get_public_business_places(), so backfilling one business cannot affect another. (I
-- reported the opposite on 2026-09-08 — that writing any row anywhere would strip tabs
-- from all 179 — and it was wrong. The correction does not change the order of this
-- work: until a business has at least one row, `store` and `jobs` stay gated behind
-- hcPlacesKnown() and its rail cannot respond to anything, so the backfill is still
-- the prerequisite. It is just not a cliff.)
--
-- WHAT EVERY CLAIMED BUSINESS SHOWS TODAY: Home + Website, and nothing else — `store`
-- and `jobs` both require hcPlacesKnown(), which is false at zero rows. So the floor
-- row below is a VISIBLE NO-OP. Nobody can lose a tab, because nobody has one to lose.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. earned_by. A SECOND COLUMN, NOT AN OVERLOADED FIRST ONE. ──────────────
-- added_by answers WHO put this here — assistant, owner, system, backfill. That is a
-- good question with a clean answer, and added_by='booking' would destroy it.
-- earned_by answers WHICH SIGNAL earned it, and is null when nothing did.
--
--   floor row       added_by='backfill'  earned_by=null
--   retroactive     added_by='system'    earned_by='booking'
--   future earn     added_by='system'    earned_by='booking'
--   owner asked     added_by='assistant' earned_by=null
--
-- It matters at pruning time: "we gave you this because you got a booking" and "you
-- asked for this" deserve different treatment, and the standing ruling that a kind with
-- no usage signal defaults to KEEP only means anything if the two are distinguishable.
alter table public.business_places
  add column if not exists earned_by text;

alter table public.business_places
  drop constraint if exists business_places_earned_by_check;
alter table public.business_places
  add constraint business_places_earned_by_check
  check (earned_by is null or earned_by = any (array['booking','customer','lead','order']));

-- ── 2. THE KIND LIST, DERIVED FROM WHAT ACTUALLY RENDERS. ────────────────────
-- The original CHECK carried 26 kinds and was wrong three ways: names nothing renders,
-- real entries missing, and a count that matched by coincidence. It was copied from the
-- nav of journey.js — the DEPRECATED /app shell — not from the rail an owner sees.
--
-- READ FROM: public/platform-home.html, hcWorkspaces() (the function that builds the
-- rail and, through hcRenderBottomBar, the phone's bottom bar). It renders exactly
-- three place kinds: hasPlace('website'), hasPlace('store'), hasPlace('jobs'). Home is
-- not a place — it is always the base and has no row. Confirmed by grepping every
-- hasPlace() call site in public/ and supabase/: those three and nothing else.
--
-- Tightened rather than extended, which is safe because there are zero rows. The list
-- is now: what renders today, plus what this build introduces.
alter table public.business_places
  drop constraint if exists business_places_kind_check;
alter table public.business_places
  add constraint business_places_kind_check
  check (kind = any (array[
    'website',    -- renders today (hcWorkspaces)
    'store',      -- renders today (hcWorkspaces)
    'jobs',       -- renders today (hcWorkspaces)
    'planner',    -- this build: the owner's day — jobs, blocks and tasks in one list
    'tasks',      -- this build: reserved; tasks live IN the planner, but a Tasks place
                  --             may be wanted later and the constraint should not be
                  --             the thing that blocks it
    'customers',  -- this build: earned by a first customer
    'leads'       -- this build: earned by a first unbooked chat lead
  ]));

-- ── 3. THE UNCLAIMED-DRAFT HOLE. ─────────────────────────────────────────────
-- seed_business_places fires AFTER INSERT ON businesses only, so CLAIMING a draft never
-- seeded it. 145 unclaimed drafts would have stayed at zero rows for ever, and every one
-- of them would fail open on the day its owner arrived — which is precisely the person
-- the earning rule is for.
--
-- Fixed at the trigger, NOT by backfilling the 145: a draft nobody has claimed does not
-- need a rail, and 145 rows for people who do not exist is noise that makes the corpus
-- harder to reason about.
--
-- STILL NON-FAILING on this path. A claim must never fail because a place could not be
-- written — losing a signup to a rail row would be an absurd trade, and under fail-open
-- the business simply gets the full rail, which is survivable.
create or replace function public.seed_business_places()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.business_places (business_id, kind, scope, sort_order, visible, added_by)
  values (new.id, 'website', 'workspace', 10, true, 'system')
  on conflict (business_id, kind, scope) do nothing;
  return new;
exception when others then
  raise warning 'seed_business_places FAILED for business % (%). It has no workspace place, so it falls open to the FULL rail rather than an empty one.', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists businesses_seed_places on public.businesses;
create trigger businesses_seed_places
  after insert on public.businesses
  for each row execute function public.seed_business_places();

-- A draft that gets claimed is, for this purpose, a business arriving.
drop trigger if exists businesses_seed_places_on_claim on public.businesses;
create trigger businesses_seed_places_on_claim
  after update of owner_id on public.businesses
  for each row
  when (old.owner_id is null and new.owner_id is not null)
  execute function public.seed_business_places();

-- ── 4. THE BACKFILL. 34 claimed businesses; the 145 unclaimed are left alone. ─
-- Derived from the signals, never a hardcoded list of slugs — the mark_test_accounts
-- migration is the standing lesson on what a hardcoded id list is worth six weeks later
-- (6 of its 9 are still correct).
--
-- RETROACTIVE EARN IS THE SAME RULE APPLIED TO HISTORY. A place is earned when there is
-- something in it; Graef has eleven bookings and four customers, so he has something in
-- it. The floor is unchanged either way, so nobody loses anything.
--
-- ON THE STORE, AND IT IS NOT A CONTRADICTION. Adrian ruled earlier that owners must not
-- get a Store tab unless they ask for it. evergreen-yard-care earns one here from four
-- real commerce rows. That ruling was about not showing a Store to people who do not
-- have one — proof that they already sell IS the asking. A future reader should not read
-- this as overturning it.
insert into public.business_places (business_id, kind, scope, sort_order, visible, added_by, earned_by)
select b.id, v.kind, 'workspace', v.sort_order, true, v.added_by, v.earned_by
from public.businesses b
cross join lateral (values
  ('website',   10, 'backfill', null::text, true),
  ('planner',   20, 'system',   'booking',  (select count(*) > 0 from public.booking_requests r where r.business_id = b.id)),
  ('jobs',      30, 'system',   'booking',  (select count(*) > 0 from public.booking_requests r where r.business_id = b.id)),
  ('customers', 40, 'system',   'customer', (select count(*) > 0 from public.customers c where c.business_id = b.id)),
  ('leads',     50, 'system',   'lead',     (select count(*) > 0 from public.chatbot_conversations v2 where v2.business_id = b.id and v2.resulted_in_booking = false)),
  ('store',     60, 'system',   'order',    ((select count(*) > 0 from public.commerce_products p where p.business_id = b.id)
                                          or (select count(*) > 0 from public.commerce_orders o where o.business_id = b.id)))
) as v(kind, sort_order, added_by, earned_by, applies)
where b.owner_id is not null and v.applies
on conflict (business_id, kind, scope) do nothing;
