-- Persists the real designRationale text the model already produces on
-- every document_generate call (see buildDesignRationaleInstructions in
-- hubly_document.ts) but which was previously discarded: generateDocument
-- runs as a fire-and-forget background task inside hubly-conversation
-- (EdgeRuntime.waitUntil), and nothing ever read the resolved value --
-- only errors were caught, via bgTask.catch(). Confirmed live before this
-- fix: a real conversation-driven generation produced a real, correctly
-- reasoned document (right reserved elements for the business), but the
-- text explaining *why* was unrecoverable afterward -- the exact debugging
-- tool this design is built around, gone the moment generation finished.
--
-- Same pattern as the per-node "reasoning" field already in the document
-- schema itself (HublyDocumentNode.reasoning) -- this is that same
-- principle one level up, at the whole-page decision level, not a new one.
alter table business_documents
  add column if not exists design_rationale text;

comment on column business_documents.design_rationale is
  'The model''s own real, in-band explanation of its structural/creative choices for this specific version (see buildDesignRationaleInstructions) -- including why any reserved element was or wasn''t included. Null for patch-created versions, which don''t produce one.';

create or replace function create_business_document(
  p_business_id uuid,
  p_draft_token uuid,
  p_tag text default 'website',
  p_document jsonb default '{}'::jsonb,
  p_rendered_html text default null,
  p_created_by text default 'ai',
  p_design_rationale text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row businesses%rowtype;
  v_next_version int;
  v_id uuid;
begin
  select * into v_row from businesses where id = p_business_id;

  if not found
     or v_row.owner_id is not null
     or v_row.draft_token is null
     or v_row.draft_token is distinct from p_draft_token
  then
    return jsonb_build_object('ok', false, 'error', 'not_a_draft_or_token_mismatch');
  end if;

  if p_created_by not in ('ai', 'user', 'patch') then
    return jsonb_build_object('ok', false, 'error', 'invalid_created_by');
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version
  from business_documents
  where business_id = p_business_id and tag = coalesce(p_tag, 'website');

  insert into business_documents (business_id, tag, version, document, rendered_html, created_by, design_rationale)
  values (p_business_id, coalesce(p_tag, 'website'), v_next_version, p_document, p_rendered_html, p_created_by, p_design_rationale)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'version', v_next_version, 'slug', v_row.slug);
end;
$$;

grant execute on function create_business_document(uuid, uuid, text, jsonb, text, text, text) to anon, authenticated;
revoke all on function create_business_document(uuid, uuid, text, jsonb, text, text, text) from public;

drop function if exists create_business_document(uuid, uuid, text, jsonb, text, text);
