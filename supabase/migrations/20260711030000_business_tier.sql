-- Account-level tier, manually set for now (no billing system wired to
-- it). Starts scoped to a single feature: the customer-facing AI
-- chatbot's lead-capture behavior (Starter = aggregate stats only,
-- Pro = full lead capture). Not a general feature-entitlement system.
alter table businesses
  add column if not exists tier text not null default 'starter'
  check (tier in ('starter','pro'));
