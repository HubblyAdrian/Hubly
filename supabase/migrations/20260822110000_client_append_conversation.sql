-- Client-written transcript. (Block 3 correction.)
--
-- The first cut had the EDGE persist each turn's user message + the reply field.
-- Two problems surfaced in use:
--   1. A build turn spends its rounds on capabilities and never produces a
--      natural-language reply, so it falls through to an internal fallback
--      ("I've gathered what I can for now…"). The person never sees that — the
--      client shows the design NARRATION instead, which arrives as an interim
--      message. So the edge stored the wrong line.
--   2. The post-build follow-up (shaping suggestions + the "keep it to your
--      account" offer) is generated CLIENT-side and never touches the edge, so
--      it was never stored at all — yet those are the first setup asks Hubly
--      makes, which the next block's state engine must know about.
--
-- The rule is now: the transcript stores what the person SAW as Hubly's voice,
-- wherever it was generated. The client is the only place that knows that, so the
-- client writes the transcript. These are the client-callable append RPCs,
-- gated EXACTLY like the reads (20260822090000): the draft token before a claim,
-- the owner (auth.uid()) after. Seq is allocated server-side under a per-business
-- advisory lock so two tabs or a retry can't collide — identical to the
-- service-role append.

-- Shared allocator: append rows to a business's conversation, seq = max+1 under a
-- per-business advisory lock. SECURITY DEFINER; callers below have already proven
-- the gate, so this internal helper trusts p_business_id.
create or replace function public._append_conversation_rows(
  p_business_id uuid,
  p_messages jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $FN$
declare
  v_base int;
  v_inserted int;
begin
  if p_messages is null or jsonb_typeof(p_messages) <> 'array' then
    return 0;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));

  select coalesce(max(seq), 0) into v_base
  from public.business_conversations
  where business_id = p_business_id;

  with valid as (
    select elem->>'role' as role, elem->'content' as content, ord
    from jsonb_array_elements(p_messages) with ordinality as t(elem, ord)
    where (elem->>'role') in ('user', 'assistant')
      and (elem->'content') is not null
  ),
  numbered as (
    select role, content, row_number() over (order by ord) as rn
    from valid
  )
  insert into public.business_conversations (business_id, seq, role, content)
  select p_business_id, v_base + rn, role, content
  from numbered;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$FN$;

revoke all on function public._append_conversation_rows(uuid, jsonb) from public, anon, authenticated;
-- internal only: reachable solely through the two gated wrappers below (both
-- SECURITY DEFINER, so they run as the owner and can call it regardless of grant).

-- ── APPEND (pre-claim): the draft token is the credential. ───────────────────
create or replace function public.append_draft_business_conversation(
  p_business_id uuid,
  p_draft_token uuid,
  p_messages jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $FN$
declare
  v_ok boolean;
begin
  select true into v_ok
  from public.businesses b
  where b.id = p_business_id
    and b.owner_id is null
    and b.draft_token is not null
    and b.draft_token = p_draft_token;
  if not found then
    return 0;   -- wrong token, or already claimed: the draft path is closed
  end if;
  return public._append_conversation_rows(p_business_id, p_messages);
end;
$FN$;

-- ── APPEND (post-claim): the owner, scoped to auth.uid(). ────────────────────
create or replace function public.append_my_business_conversation(
  p_business_id uuid,
  p_messages jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $FN$
declare
  v_ok boolean;
begin
  select true into v_ok
  from public.businesses b
  where b.id = p_business_id
    and b.owner_id = auth.uid();
  if not found then
    return 0;   -- not the owner
  end if;
  return public._append_conversation_rows(p_business_id, p_messages);
end;
$FN$;

revoke all on function public.append_draft_business_conversation(uuid, uuid, jsonb) from public;
grant execute on function public.append_draft_business_conversation(uuid, uuid, jsonb) to anon, authenticated;

revoke all on function public.append_my_business_conversation(uuid, jsonb) from public, anon;
grant execute on function public.append_my_business_conversation(uuid, jsonb) to authenticated;
