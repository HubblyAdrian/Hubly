-- A deterministic, system-authored document version needs its own provenance.
--
-- Until now created_by was one of ('ai', 'user', 'patch'): model-generated, a human
-- authoring, or a human edit. A backfill written by a deterministic post-processing
-- pass (e.g. the svh-companion repair) is none of those. Labelling it 'ai' would be a
-- lie; labelling it 'patch' or 'user' would corrupt the owner-edit signal the signup
-- email counts (created_by='patch') and the hand-edit detector both read.
--
-- Add 'system' for exactly this: a change Hubly made to the page mechanically, with no
-- model call and no human. Idempotent so it can run alongside a direct ALTER already
-- applied to the live database.
alter table public.business_documents
  drop constraint if exists business_documents_created_by_check;
alter table public.business_documents
  add constraint business_documents_created_by_check
  check (created_by in ('ai', 'user', 'patch', 'system'));

comment on constraint business_documents_created_by_check on public.business_documents is
  'ai = model-generated; user = human authored; patch = human edit (counts as engagement); '
  'system = deterministic pass Hubly ran mechanically (no model, no human) — excluded from edit counts.';
