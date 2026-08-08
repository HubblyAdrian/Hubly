-- Technician assignment on jobs has never been persisted. j.assignedTo is
-- mutated in a dozen places in journey.js (the "Assign Technician" row
-- action, bulk assign, drag-to-technician-column on the calendar) but no
-- migration or update call anywhere in the repo ever wrote it to Supabase
-- — confirmed by introspecting the live jobs table (information_schema),
-- same discipline as 20260806150000: it genuinely has no assigned_to
-- column today. Every assignment has been silently client-only and lost
-- on refresh, same bug class as the status/delete persistence gap fixed
-- in journey.js this session, just never noticed because nothing failed
-- loudly — it just quietly reverted.
--
-- Text, not a foreign key to a team-members table, because jobsTeam() in
-- journey.js currently resolves the team from S().team (business settings
-- state), not a normalized DB table — matching how the column is actually
-- used today rather than inventing a relation that doesn't exist yet.

alter table public.jobs
  add column if not exists assigned_to text;
comment on column public.jobs.assigned_to is
  'Technician/team-member name assigned to this job. Free text matching jobsTeam() entries in the app, not a foreign key — there is no normalized team-members table yet.';
