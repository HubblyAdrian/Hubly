-- Two reads/writes the builder needs once a draft is CLAIMED — so a signed-in
-- owner can get back to their page AND edit it. Diagnosed after sign-in worked,
-- persisted ownership, and then the page vanished on reload and edits froze.
--
-- The claim RPC (claim_draft_business) is deliberately NOT touched here — the
-- write side of claiming works. This is the read/edit side.

-- ── 1. THE OWNER READ PATH ──────────────────────────────────────────────────
-- Scoped to auth.uid() and NOTHING ELSE. No slug, no draft token, no argument
-- the client supplies — an authenticated user can load businesses they own and
-- nothing else. SECURITY DEFINER so it can read the businesses table, but the
-- WHERE clause is the whole gate.
--
-- MULTI-BUSINESS: a user may own more than one. This returns the MOST RECENT one
-- (created_at desc). That is a deliberate simplification for now — the moment a
-- user genuinely runs two businesses, "most recent" is wrong and this is the
-- point where a real dashboard (pick which business) stops being optional.
--
-- draft_token is returned because the owner already owns it; it is now INERT for
-- editing a claimed business (see create_business_document below — a claimed
-- business is authorised by ownership, not by the token), so returning it is not
-- re-handing out a working credential.
create or replace function public.get_my_business()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case when b.id is null then null else jsonb_build_object(
    'id', b.id,
    'slug', b.slug,
    'name', b.name,
    'draftToken', b.draft_token,
    'url', 'https://' || b.slug || '.myhubly.app',
    'hasPage', exists (select 1 from public.business_documents d where d.business_id = b.id)
  ) end
  from (
    select id, slug, name, draft_token
    from public.businesses
    where owner_id = auth.uid()
    order by created_at desc
    limit 1
  ) b;
$$;

revoke all on function public.get_my_business() from public, anon;
grant execute on function public.get_my_business() to authenticated;

-- ── 2. OWNERSHIP-AUTHORISED EDIT ────────────────────────────────────────────
-- The bug: create_business_document rejected every write once owner_id was set
-- (the old body did `or v_row.owner_id is not null`), so a claimed business
-- could not be edited at all. And the only credential it accepted was the draft
-- token — a permanent bearer credential that should stop being the auth
-- mechanism the moment the business is owned.
--
-- New rule: an UNCLAIMED draft is authorised by its token (as before). A CLAIMED
-- business is authorised by OWNERSHIP: p_owner_id must equal owner_id. The token
-- is not accepted once claimed. p_owner_id is trusted because this function is
-- SECURITY DEFINER and granted to service_role ONLY (locked in
-- 20260821030000) — the ONLY caller is our edge function, which sets p_owner_id
-- exclusively after verifying the caller's JWT against owner_id. The browser
-- cannot reach this function to forge p_owner_id.
--
-- Backward compatible: p_owner_id defaults null, so every existing anon-draft
-- write (token path) is unchanged.
drop function if exists public.create_business_document(uuid, uuid, text, jsonb, text, text, text, text);

create or replace function public.create_business_document(
  p_business_id uuid,
  p_draft_token uuid,
  p_tag text default 'website',
  p_document jsonb default '{}'::jsonb,
  p_rendered_html text default null,
  p_created_by text default 'ai',
  p_design_rationale text default null,
  p_format text default 'ast',
  p_owner_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $FN$
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

  if p_created_by not in ('ai', 'user', 'patch') then
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
$FN$;

-- service_role only, exactly as 20260821030000 left it. The browser never reaches
-- this; the edge function is the only caller and the only setter of p_owner_id.
revoke all on function public.create_business_document(uuid, uuid, text, jsonb, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_business_document(uuid, uuid, text, jsonb, text, text, text, text, uuid) to service_role;
