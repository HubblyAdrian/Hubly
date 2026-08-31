-- UNDO = step back one version. The substrate already exists: every edit writes a new
-- `website` document version. Undo restores the SECOND-latest version's content as a NEW
-- latest version — a step FORWARD that happens to carry an earlier state, so history is
-- never destroyed (you can always step back again). Owner-scoped to auth.uid(); there is
-- no draft-token path because undo only exists inside the claimed editor.
--
-- Deliberately single-step for v1: it undoes the last change. Pressing it again would
-- restore the state before THAT (a redo of the first change) — a toggle, not a stack.
-- A real multi-level history is future work, noted in docs/PRODUCT_SHAPE.md.
create or replace function public.restore_prev_business_document(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev record;
  v_next int;
begin
  if not exists (select 1 from public.businesses where id = p_business_id and owner_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  -- the state BEFORE the last change: the second-latest website version.
  select document, rendered_html, format, version
    into v_prev
  from public.business_documents
  where business_id = p_business_id and tag = 'website'
  order by version desc
  offset 1 limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'nothing_to_undo');
  end if;
  select coalesce(max(version), 0) + 1 into v_next
  from public.business_documents
  where business_id = p_business_id and tag = 'website';
  insert into public.business_documents (business_id, tag, version, document, rendered_html, created_by, format)
  values (p_business_id, 'website', v_next, v_prev.document, v_prev.rendered_html, 'patch', v_prev.format);
  return jsonb_build_object('ok', true, 'version', v_next, 'restored_from', v_prev.version);
end;
$$;
grant execute on function public.restore_prev_business_document(uuid) to authenticated;
revoke all on function public.restore_prev_business_document(uuid) from public;
