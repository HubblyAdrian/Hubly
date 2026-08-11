-- Canonical Service Engine reference on jobs/recurring_schedules.
--
-- service_id is a soft reference into a business's Service Engine catalog
-- (businesses.meta.service_catalog — a JSON document, not a relational
-- table; see supabase/functions/_shared/service_engine.ts). There is no
-- `services` table to hold a real FOREIGN KEY against, so this is
-- deliberately `text`, unconstrained, validated only at the application
-- layer (getService(business, serviceId)) — the same pattern
-- marketplace_bookings.service_id already uses.
--
-- Nullable by design: blank-draft jobs, freeform/no-catalog-match
-- services, and every historical job created before this column existed
-- must all remain valid rows. service_name is untouched and remains the
-- historical/display snapshot — this column is purely additive.
--
-- No backfill here. Historical jobs.service_id/recurring_schedules.service_id
-- stay NULL until a separate, explicitly-approved backfill pass runs.

alter table jobs
  add column if not exists service_id text;

alter table recurring_schedules
  add column if not exists service_id text;

comment on column jobs.service_id is
  'Soft reference to businesses.meta.service_catalog services[].id (Service Engine). No FK — the catalog is JSON, not a relational table. Nullable: blank drafts, freeform services, and historical jobs have none. Always written together with service_name from the same resolved Service Engine object — never independently.';

comment on column recurring_schedules.service_id is
  'Soft reference to businesses.meta.service_catalog services[].id (Service Engine). No FK. Nullable, same rules as jobs.service_id. Every occurrence job generated from a schedule should carry the same service_id as the schedule.';
