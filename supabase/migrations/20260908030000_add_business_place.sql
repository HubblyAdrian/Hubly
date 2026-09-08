-- The writer: an owner asks for a place, the assistant adds it.
--
-- THE THREE OUTCOMES ARE THE POINT. A writer that always reports success is
-- indistinguishable from one that works, so this returns which of the three
-- actually happened and the caller composes from that — never from what it hoped:
--
--   no row              -> 'created'     it did not exist; a row was inserted
--   row, visible=false  -> 're-enabled'  they had it and turned it off; sort_order
--                                        and config survive, so it returns where it was
--   row, visible=true   -> 'already'     nothing was written
--
-- Same seam as servicesTruth: the reply is composed from what the write DID.
--
-- p_owner_id IS NOT OPTIONAL. It has no default, so a caller that omits it fails at
-- the call rather than silently writing for the wrong person — and callBusinessRpc's
-- OWNER_AUTHORISED_RPCS guard plus scripts/check-owner-id-invariant.mjs both cover
-- it from this commit, rather than after someone forgets.
create or replace function public.add_business_place(
  p_id uuid,
  p_owner_id uuid,
  p_kind text,
  p_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $FN$
declare
  v_owner uuid;
  v_row public.business_places%rowtype;
  v_next integer;
begin
  if p_id is null or p_owner_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_credential');
  end if;

  -- AUTHORISE BY OWNERSHIP, re-read here rather than trusted from the caller. The
  -- edge resolves the uid from the JWT; this confirms that uid owns THIS row. Both
  -- halves are required — naming someone else's business id proves nothing.
  select owner_id into v_owner from public.businesses where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_such_business');
  end if;
  if v_owner is null or v_owner is distinct from p_owner_id then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;

  select * into v_row from public.business_places
   where business_id = p_id and kind = p_kind and scope = p_scope;

  if found and v_row.visible then
    return jsonb_build_object('ok', true, 'outcome', 'already', 'kind', p_kind, 'scope', p_scope);
  end if;

  if found then
    update public.business_places set visible = true
     where id = v_row.id;
    return jsonb_build_object('ok', true, 'outcome', 're-enabled', 'kind', p_kind, 'scope', p_scope);
  end if;

  select coalesce(max(sort_order), 0) + 10 into v_next
    from public.business_places where business_id = p_id and scope = p_scope;

  insert into public.business_places (business_id, kind, scope, sort_order, visible, added_by)
  values (p_id, p_kind, p_scope, v_next, true, 'assistant');

  return jsonb_build_object('ok', true, 'outcome', 'created', 'kind', p_kind, 'scope', p_scope);
exception
  when check_violation then
    -- An unknown kind or scope. Say which, rather than "something went wrong".
    return jsonb_build_object('ok', false, 'error', 'unknown_place', 'kind', p_kind, 'scope', p_scope);
end;
$FN$;

revoke all on function public.add_business_place(uuid, uuid, text, text) from public, anon, authenticated;
