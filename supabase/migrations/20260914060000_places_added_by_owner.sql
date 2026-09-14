-- PRESERVE EVERY EXISTING OWNER'S TABS WHEN THE EARNING RULE CHANGES.
--
-- Ruled 2026-09-13 (Option A, docs/MY_DAY_ARCHITECTURE.md §5). Under the new predicate a place
-- paints only when the OWNER put it there or it was earned; every row in business_places today
-- was put there by the insert trigger or the backfill, so all of them would stop painting and
-- every current owner would lose tabs they have been using.
--
-- THE NUMBER MOVED, AND THAT IS PART OF THE RECORD. The architecture doc said 75 rows / 51
-- businesses; at execution it is 76 / 52. The extra row is `hubly-classic-fixture`'s `website`
-- place, created 2026-09-13 22:19:17 by our own fixture work earlier the same night — a test
-- business, created after the count was taken. The migration is defined by a PREDICATE, not by
-- a count, so the intent is unaffected; the discrepancy is recorded because a number quoted
-- from a document is a memory of a measurement, and this one was four hours old.
--
-- REVERSIBLE BY CONSTRUCTION: the prior value is written into `config` before the update, so
-- the rollback is exact rather than reconstructed. `visible` and `earned_by` are not touched.
update public.business_places
   set config     = coalesce(config, '{}'::jsonb) || jsonb_build_object('pre_2026_09_13_added_by', added_by),
       added_by   = 'owner',
       updated_at = now()
 where added_by in ('system', 'backfill');

-- ROLLBACK (not run here; kept with the migration so it cannot drift from it):
--   update public.business_places
--      set added_by = config->>'pre_2026_09_13_added_by',
--          config   = config - 'pre_2026_09_13_added_by'
--    where config ? 'pre_2026_09_13_added_by';
