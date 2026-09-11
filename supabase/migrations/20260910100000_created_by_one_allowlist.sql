CREATE OR REPLACE FUNCTION public.create_business_document(p_business_id uuid, p_draft_token uuid, p_tag text DEFAULT 'website'::text, p_document jsonb DEFAULT '{}'::jsonb, p_rendered_html text DEFAULT NULL::text, p_created_by text DEFAULT 'ai'::text, p_design_rationale text DEFAULT NULL::text, p_format text DEFAULT 'ast'::text, p_owner_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row businesses%rowtype;
  v_next_version int;
  v_id uuid;
  v_format text;
begin
  select * into v_row from businesses where id = p_business_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Authorise: unclaimed -> the draft token; claimed -> the verified owner.
  if v_row.owner_id is null then
    if v_row.draft_token is null or v_row.draft_token is distinct from p_draft_token then
      return jsonb_build_object('ok', false, 'error', 'not_a_draft_or_token_mismatch');
    end if;
  else
    if p_owner_id is null or v_row.owner_id is distinct from p_owner_id then
      return jsonb_build_object('ok', false, 'error', 'not_owner');
    end if;
  end if;

  -- ALIGNED with business_documents_created_by_check. 'system' is an AUTOMATIC write (the
  -- wordmark following a name), which must not be counted as an owner edit by
  -- documentHasOwnerEdits — and had no valid value until this list matched the table's.
  if p_created_by not in ('ai', 'user', 'patch', 'system') then
    return jsonb_build_object('ok', false, 'error', 'invalid_created_by');
  end if;

  v_format := coalesce(nullif(p_format, ''), 'ast');
  if v_format not in ('ast', 'html') then
    return jsonb_build_object('ok', false, 'error', 'invalid_format');
  end if;

  if v_format = 'html' and coalesce(length(btrim(p_rendered_html)), 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'freeform_requires_rendered_html');
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version
  from business_documents
  where business_id = p_business_id and tag = coalesce(p_tag, 'website');

  insert into business_documents (business_id, tag, version, document, rendered_html, created_by, design_rationale, format)
  values (p_business_id, coalesce(p_tag, 'website'), v_next_version, p_document, p_rendered_html, p_created_by, p_design_rationale, v_format)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'version', v_next_version, 'slug', v_row.slug, 'format', v_format);
end;
$function$
;