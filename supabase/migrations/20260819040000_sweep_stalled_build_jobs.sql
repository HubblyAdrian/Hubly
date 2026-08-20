-- A stalled build must become a FAILED build, without anyone watching.
--
-- WHY
--
-- Page generation dies at the Edge Function wall-clock limit. Measured across
-- 17 successful builds on 2026-08-19:
--
--   min 60.0s   p50 94.9s   p90 138.8s   max 143.2s
--   over 140s: 1      over 150s: 0
--
-- Nothing above 150s. That is not a tail, it is a cliff — the free-plan limit.
-- Two builds in 19 (10.5%) stalled, which is almost exactly the fraction the
-- successful distribution puts within ten seconds of that ceiling. The builds
-- that stall are the right-hand tail being truncated.
--
-- When the isolate is killed, NOTHING writes a terminal status: no error, no
-- log line, no completed request. The row sits in 'running' forever. The client
-- eventually gives up on its own four-minute timer and offers a retry, but the
-- ROW stays wrong permanently, so nothing can count failures, nothing can
-- report them, and a person who closed the tab is simply never told.
--
-- This sweep is the durable half. It turns "stalls forever" into "fails, and
-- says so".
--
-- WHY NOT ALSO AUTO-RETRY HERE
--
-- Because an identical retry of a genuine timeout fails identically, and does
-- so at full model cost. The business that stalled twice on 2026-08-19 needs
-- MORE than 150s; running it again from cron would burn spend on a loop that
-- cannot converge. Retry stays explicit — the person clicks it, having been
-- told honestly — until generation is fast enough that a retry means something.
--
-- The real fix is a longer limit (a paid plan) or a shorter generation. This
-- makes the failure honest in the meantime, which is worth having either way.

create or replace function public.sweep_stalled_document_builds()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recovered int := 0;
  v_failed int := 0;
begin
  -- FIRST: a build whose document actually landed but whose status write was
  -- lost. The page is the outcome; the row is only the record. Marking this
  -- 'failed' would tell someone their site did not build while they are
  -- looking at it.
  with recovered as (
    update document_build_jobs j
       set status = 'succeeded',
           finished_at = coalesce(j.finished_at, now())
     where j.status = 'running'
       and now() > j.expected_by
       and exists (
         select 1 from business_documents d
          where d.business_id = j.business_id and d.tag = j.tag
       )
    returning 1
  )
  select count(*) into v_recovered from recovered;

  -- THEN: genuinely dead. Past its window, nothing written, no page.
  with failed as (
    update document_build_jobs j
       set status = 'failed',
           error = 'timed_out_or_crashed',
           -- expected_by, NOT now(). The job died at some unknown moment before
           -- its window closed; stamping the sweep's own clock would record a
           -- build that "took" however long it sat unswept -- 11,577 seconds on
           -- the first run -- and silently poison every duration query made
           -- afterwards, including the one that diagnosed this in the first
           -- place. expected_by is the honest upper bound on when it was alive.
           finished_at = j.expected_by
     where j.status = 'running'
       and now() > j.expected_by
       and not exists (
         select 1 from business_documents d
          where d.business_id = j.business_id and d.tag = j.tag
       )
    returning 1
  )
  select count(*) into v_failed from failed;

  return jsonb_build_object('recovered', v_recovered, 'failed', v_failed);
end;
$$;

revoke all on function public.sweep_stalled_document_builds() from public, anon, authenticated;

-- Every two minutes. expected_by is start + 3 minutes, comfortably past the
-- 150s ceiling, so a job this sweep touches is genuinely dead rather than slow.
-- Pure SQL: no net.http_post, no secret, nothing to leak.
select cron.schedule(
  'sweep-stalled-document-builds',
  '*/2 * * * *',
  $$ select public.sweep_stalled_document_builds(); $$
);
