-- Resets the tier-fix test business back to 'starter' (it was left at
-- 'pro' by the earlier service-role verification test) so the live
-- re-test of the escalation-bypass case starts from a real starter
-- baseline, not a no-op. Runs as postgres, unaffected by the new
-- protect_business_tier trigger. Test data only.
update businesses set tier = 'starter' where id = 'a4468f93-7eeb-4ae9-a979-ca3461485c97';
