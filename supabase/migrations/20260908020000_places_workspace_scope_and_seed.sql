-- Widen business_places for the front-door work, and seed new businesses.
-- The table from 20260908010000 is already applied and empty, so the CHECK
-- constraints are replaced rather than the table recreated.

alter table public.business_places drop constraint if exists business_places_scope_check;
alter table public.business_places add constraint business_places_scope_check
  check (scope in ('workspace','tab','section'));

alter table public.business_places drop constraint if exists business_places_kind_check;
alter table public.business_places add constraint business_places_kind_check
  check (kind in (
    -- workspaces — hcWorkspaces ids, public/platform-home.html:3985.
    -- 'website' exists ONLY here; it is not a hubly.html data-v.
    'website',
    -- tabs — hubly.html data-v. Vocabulary kept because it costs nothing; NOTHING
    -- seeds or reads it. /app is a deprecation target.
    'activity','apps','calendar','chats','customers','growth','jobs','leads',
    'marketing','marketplace','memberships','money','opportunities',
    'photo-projects','pipeline','projects','quotes','reports','reviews','store','studio',
    -- sections — SECTION_DEFS, public/hubly.html:50388
    'portfolio','services','about','story'
  ));
-- Seed the minimum workspace set at business creation.
--
-- WHY A TRIGGER AND NOT THE CREATE PATH: there are FIVE paths that insert a
-- business — start_business_in_progress (the front door), two client inserts in
-- hubly.html, hubly_brain_website.ts:495, and marketplace-lite.html:353. Seeding in
-- one of them leaves four creating businesses with no places, which under the
-- fail-open rule means the full rail. The trigger is the one choke point all five
-- already pass through, and it covers paths written after this one.
--
-- WHY EXACTLY ONE ROW, when the seed was meant to vary by entry path: a trigger
-- sees the ROW, not the intent, and the row does not carry the intent.
-- start_business_in_progress inserts only (name, slug, business_type, owner_id,
-- draft_token, meta) — no capabilities, no account_kind. The ONE path that does
-- set something usable is marketplace-lite, which writes
-- capabilities.marketplace=true inside its insert (:374) — and that path has ZERO
-- examples in the data. Designing a branch for a population we have never seen is
-- the speculative work this project keeps paying for, so: one row for everyone.
-- The signal is recorded here for whoever needs it.
--
-- AND ONE ROW IS THE MINIMUM THAT WORKS: zero rows means UNKNOWN, which fails open
-- to the full rail. A business seeded with "nothing" would be indistinguishable
-- from one that was never seeded. The seed must say something.
create or replace function public.seed_business_places()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_places (business_id, kind, scope, sort_order, visible, added_by)
  values (new.id, 'website', 'workspace', 10, true, 'system')
  on conflict (business_id, kind, scope) do nothing;
  return new;
exception when others then
  -- Never fail a business creation because a place could not be seeded. A business
  -- with no places falls open to the full rail, which is survivable; a signup that
  -- errors is not.
  -- WORDING MATTERS AT 2AM: under fail-open, no places row means the business gets
  -- the FULL rail, not an empty one. Say the consequence, not the mechanism.
  raise warning 'seed_business_places FAILED for business % (%). It has no workspace place, so it will show the FULL rail instead of the minimal one. scripts/check-places-seeded.mjs counts these.', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists businesses_seed_places on public.businesses;
create trigger businesses_seed_places
  after insert on public.businesses
  for each row execute function public.seed_business_places();
