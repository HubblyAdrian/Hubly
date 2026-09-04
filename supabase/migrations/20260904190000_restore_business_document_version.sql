-- UNDO THAT WALKS BACK, not a toggle that looks like one.
--
-- restore_prev_business_document restores the SECOND-latest version. Press it twice and
-- the second press restores what you just undid — a redo — because "second latest" has
-- moved. That was recorded as deliberate for v1, and it is survivable only while the
-- control admits it. It did not: the button retired after one press, which asserts
-- "nothing left to undo" over a page that still carried an earlier change. An owner made
-- two edits, pressed Undo once, and had no way to reach the state before the first.
--
-- This takes an explicit version, so the CLIENT can hold a cursor and step back through
-- real history one change at a time. Same shape as the original: it never destroys
-- anything, it appends the chosen version's content as a new latest version, so the
-- walk-back is itself undoable and the history stays complete.
--
-- p_version null keeps the old behaviour (the second-latest), so the first press needs
-- no knowledge of where it is.
create or replace function public.restore_business_document_version(
  p_business_id uuid,
  p_version int default null
)
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

  if p_version is null then
    select document, rendered_html, format, version
      into v_prev
    from public.business_documents
    where business_id = p_business_id and tag = 'website'
    order by version desc
    offset 1 limit 1;
  else
    select document, rendered_html, format, version
      into v_prev
    from public.business_documents
    where business_id = p_business_id and tag = 'website' and version = p_version
    limit 1;
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'nothing_to_undo');
  end if;

  select coalesce(max(version), 0) + 1 into v_next
  from public.business_documents
  where business_id = p_business_id and tag = 'website';

  -- ASSERT THE STEP IS REAL. Restoring content identical to what is already published
  -- writes a version and changes nothing — the owner presses Undo, is told it worked,
  -- and watches the page not move. Say so instead, and let the caller step further back.
  if exists (
    select 1 from public.business_documents
    where business_id = p_business_id and tag = 'website'
      and version = v_next - 1
      and rendered_html is not distinct from v_prev.rendered_html
  ) then
    return jsonb_build_object('ok', false, 'error', 'no_change', 'restored_from', v_prev.version);
  end if;

  insert into public.business_documents (business_id, tag, version, document, rendered_html, created_by, format)
  values (p_business_id, 'website', v_next, v_prev.document, v_prev.rendered_html, 'patch', v_prev.format);

  return jsonb_build_object('ok', true, 'version', v_next, 'restored_from', v_prev.version);
end;
$$;

grant execute on function public.restore_business_document_version(uuid, int) to authenticated;
revoke all on function public.restore_business_document_version(uuid, int) from public;
