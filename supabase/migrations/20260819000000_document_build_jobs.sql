-- A build that nobody recorded cannot be missed.
--
-- generateDocument runs as a background task: ~100-150s of model call, dispatched
-- and not awaited. When the isolate carrying it is recycled -- which Supabase is
-- free to do the moment the response is sent -- the work vanishes. Measured on
-- 2026-08-18: three of eight real builds never wrote a document. A person types
-- a sentence, watches a skeleton for ninety seconds, and no site is ever built.
--
-- The silence was structural. NOTHING was persisted when a build started, so no
-- code could tell "still working" from "died forty seconds ago", nothing could
-- retry it, and nothing could count how often it happened. The 37% figure came
-- from watching, not from the system.
--
-- This table is the missing fact. One row per build attempt, written BEFORE the
-- work is dispatched, so it survives whatever happens to the isolate.

create table if not exists public.document_build_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  tag text not null default 'website',

  -- running -> succeeded | failed. A row left in `running` past expected_by is
  -- the isolate-death case: nothing wrote a terminal status, because nothing
  -- was alive to write one.
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),

  attempts integer not null default 1,

  -- The brief the build was started from. Kept so a retry costs one model call
  -- (the generation) rather than two (reconstructing what was asked for first),
  -- and so a retry rebuilds the SAME page rather than a different one.
  brief text,

  -- Why it failed, when something was alive to say. Distinguishes the two real
  -- causes -- validation refused the document twice, vs the isolate died -- which
  -- could not be told apart at all before this table existed.
  error text,

  started_at timestamptz not null default now(),
  -- Generation is a 100-150s job; three minutes is comfortably past the slowest
  -- real build observed, so a job past this really is stuck rather than slow.
  expected_by timestamptz not null default (now() + interval '3 minutes'),
  finished_at timestamptz
);

create index if not exists document_build_jobs_business_idx
  on public.document_build_jobs (business_id, tag, started_at desc);

-- Stuck jobs, for whoever comes looking. Partial so it stays small.
create index if not exists document_build_jobs_running_idx
  on public.document_build_jobs (expected_by)
  where status = 'running';

alter table public.document_build_jobs enable row level security;

-- No policies, deliberately. The edge function writes with the service role,
-- which bypasses RLS; everyone else reads through the RPC below. Consistent
-- with the sweep of 2026-08-18: a table anon can select is a table anon can
-- enumerate, and this one is keyed by business_id.
revoke all on public.document_build_jobs from anon, authenticated;


-- The one public question: is the build for THIS slug still coming?
--
-- Keyed by slug, like get_public_business_document, so it cannot be walked by
-- id. Returns a verdict rather than the row -- no brief (it can contain
-- everything the owner told us), no raw error text, no ids.
create or replace function public.get_document_build_status(
  p_slug text,
  p_tag text default 'website'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_job record;
  v_has_doc boolean;
begin
  select id into v_business_id from businesses where slug = p_slug;
  if v_business_id is null then
    return jsonb_build_object('status', 'unknown');
  end if;

  select exists(
    select 1 from business_documents
    where business_id = v_business_id and tag = p_tag
  ) into v_has_doc;

  select * into v_job
  from document_build_jobs
  where business_id = v_business_id and tag = p_tag
  order by started_at desc
  limit 1;

  if v_job is null then
    -- No job row: either nothing was ever asked for, or the page predates this
    -- table. An existing document means the second, and "done" is the honest
    -- answer to "is a build still coming".
    return jsonb_build_object('status', case when v_has_doc then 'succeeded' else 'none' end,
                              'hasDocument', v_has_doc);
  end if;

  return jsonb_build_object(
    -- A document that exists beats whatever the job says. A build can succeed
    -- and lose its status write; the page is the outcome, the row is the record.
    'status', case
                when v_has_doc then 'succeeded'
                when v_job.status = 'running' and now() > v_job.expected_by then 'stalled'
                else v_job.status
              end,
    'hasDocument', v_has_doc,
    'attempts', v_job.attempts,
    'startedAt', v_job.started_at,
    'expectedBy', v_job.expected_by,
    -- Coarse, and only for terminal failures the build itself reported. Never
    -- the raw error, which can carry model output.
    'reason', case when v_job.status = 'failed' then coalesce(v_job.error, 'unknown') else null end
  );
end;
$$;

revoke all on function public.get_document_build_status(text, text) from public;
grant execute on function public.get_document_build_status(text, text) to anon, authenticated;
