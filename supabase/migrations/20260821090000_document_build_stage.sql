-- The steps card ticks real stages, not timed guesses.
--
-- The builder shows five stages of a build — understanding, creating your
-- website, finding your photographs, connecting booking, finalizing design — and
-- each must tick only when it GENUINELY completes. Understanding (the
-- conversation turn returned) and the final done-state were already observable
-- from outside; the three middle stages all run inside ONE server-side
-- generation the client only polls, so nothing could tell them apart, and timing
-- them would be claiming progress that hasn't happened.
--
-- This column is the missing fact. generateFreeformPage writes the current stage
-- to the job row the moment the prior stage's work finishes (see
-- updateDocumentBuildStage): 'creating' when the model call starts, 'photos' when
-- it returns a valid page, 'booking' when images are resolved, 'finalizing' when
-- booking/chat injection is done. Best-effort — a build never fails on a stage
-- write — so it may be null, which the client reads as "still creating".

alter table public.document_build_jobs
  add column if not exists stage text
    check (stage is null or stage in ('creating', 'photos', 'booking', 'finalizing'));

-- Surface it through the one public question. Same discipline as the rest of this
-- function: stage is a coarse public code, never anything the model wrote, and a
-- stored document still beats whatever the row says.
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
    return jsonb_build_object('status', case when v_has_doc then 'succeeded' else 'none' end,
                              'hasDocument', v_has_doc);
  end if;

  return jsonb_build_object(
    'status', case
                when v_has_doc then 'succeeded'
                when v_job.status = 'running' and now() > v_job.expected_by then 'stalled'
                else v_job.status
              end,
    'hasDocument', v_has_doc,
    -- Which real stage is running right now, for the steps card. Null before the
    -- first write is read as 'creating'. Irrelevant once the document exists.
    'stage', v_job.stage,
    'attempts', v_job.attempts,
    'startedAt', v_job.started_at,
    'expectedBy', v_job.expected_by,
    'reason', case when v_job.status = 'failed' then coalesce(v_job.error, 'unknown') else null end
  );
end;
$$;

revoke all on function public.get_document_build_status(text, text) from public;
grant execute on function public.get_document_build_status(text, text) to anon, authenticated;
