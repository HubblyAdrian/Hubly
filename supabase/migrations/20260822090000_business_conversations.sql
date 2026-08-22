-- The builder conversation survives a reload. (Block 3 — persistence.)
--
-- Until now the whole conversation lived in the client's in-memory hc.messages,
-- POSTed to hubly-conversation every turn and never stored. Reload the builder
-- and everything vanished except one welcome line. That is fine for a one-shot
-- build and fatal for a setup conversation that stretches over days — someone
-- sends photos Tuesday and comes back Thursday, and Hubly has to still be
-- mid-sentence.
--
-- WHAT THIS STORES, AND WHAT IT DELIBERATELY DOES NOT
--
-- The DISPLAY transcript only: the person's own messages and Hubly's final
-- natural-language reply, one row each, in order. NOT what the edge ships to the
-- model (that array is truncated to MAX_HISTORY=40 and padded with injected
-- role:"system" CAPABILITY RESULT lines and interim status). NOT the build-steps
-- card — that described a build that finished; it is not a message and is never
-- resurrected. Messages only.
--
-- OWNED BY THE BUSINESS, NOT THE USER
--
-- A conversation starts before any account exists (an anonymous draft, keyed by
-- draft_token). Keying rows to business_id is what lets the SAME conversation be
-- anonymous first and owner-read after a claim, and it is why an owner sees it on
-- a different device — it is keyed to the business they own, not to the browser.
--
-- READ RULES MIRROR THE DOCUMENT GATES EXACTLY (20260821070000 / 20260822030000):
--   * before a claim  -> the draft token  (get_draft_business_conversation, anon)
--   * after a claim    -> the owner, and nobody else (get_my_business_conversation)
-- There is deliberately NO get_public_* variant: a conversation holds the owner's
-- business details and must never be reachable from the public page path.

create table if not exists public.business_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,

  -- Monotonic order within a business. Allocated by the write RPC as max+1 under
  -- a per-business advisory lock — never supplied by the caller — so two open
  -- tabs or a retry can never collide on the unique index below.
  seq integer not null,

  role text not null check (role in ('user', 'assistant')),

  -- jsonb, not text: a user turn is usually a string but a photo turn is an
  -- array of parts ({type:'text'|'image_url', ...}). jsonb holds either without
  -- a second column or a format flag.
  content jsonb not null,

  created_at timestamptz not null default now(),

  unique (business_id, seq)
);

create index if not exists business_conversations_business_idx
  on public.business_conversations (business_id, seq);

-- Locked table: RLS on, NO policies. Every read goes through a security-definer
-- RPC below; the write goes through a service_role-only RPC. Direct table access
-- from anon/authenticated returns nothing. Same posture as business_documents
-- after 20260818010000, one step stricter (no direct owner select policy — the
-- owner reads through the RPC so the gate lives in exactly one place).
alter table public.business_conversations enable row level security;
revoke all on public.business_conversations from anon, authenticated;

-- ── WRITE: append a turn. service_role only (the edge is the only caller). ────
-- Takes the turn's messages as a jsonb array of {role, content}; allocates seq
-- itself. The advisory lock serialises concurrent appends for the same business
-- so max(seq)+1 is always correct — ordering is the database's job, not the
-- caller's. Returns the number of rows inserted.
create or replace function public.append_business_conversation(
  p_business_id uuid,
  p_messages jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $FN$
declare
  v_exists boolean;
  v_base int;
  v_inserted int;
begin
  if p_messages is null or jsonb_typeof(p_messages) <> 'array' then
    return 0;
  end if;

  select true into v_exists from public.businesses where id = p_business_id;
  if not found then
    return 0;   -- no business to attach to (e.g. the deterministic opening path)
  end if;

  -- Serialise appends for THIS business only. Two tabs or a retry queue here
  -- rather than both reading the same max(seq) and colliding on unique(seq).
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

revoke all on function public.append_business_conversation(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.append_business_conversation(uuid, jsonb) to service_role;

-- ── READ (pre-claim): the draft token is the credential. ─────────────────────
-- Mirrors get_draft_business_document: unclaimed business, token must match.
-- Never applies once claimed (draft_token is null then).
create or replace function public.get_draft_business_conversation(
  p_business_id uuid,
  p_draft_token uuid
)
returns table(seq integer, role text, content jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select c.seq, c.role, c.content
  from public.business_conversations c
  join public.businesses b on b.id = c.business_id
  where c.business_id = p_business_id
    and b.owner_id is null
    and b.draft_token is not null
    and b.draft_token = p_draft_token
  order by c.seq asc;
$$;

-- ── READ (post-claim): the owner, scoped to auth.uid() and nothing else. ─────
-- Mirrors get_my_business: no slug, no token, no client-supplied trust — the
-- WHERE clause is the whole gate.
create or replace function public.get_my_business_conversation(
  p_business_id uuid
)
returns table(seq integer, role text, content jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select c.seq, c.role, c.content
  from public.business_conversations c
  join public.businesses b on b.id = c.business_id
  where c.business_id = p_business_id
    and b.owner_id = auth.uid()
  order by c.seq asc;
$$;

-- The builder authenticates with the publishable (anon) key before a claim, so
-- the draft read must be callable by anon — the draft_token is the credential,
-- not the role. The owner read is authenticated-only.
revoke all on function public.get_draft_business_conversation(uuid, uuid) from public;
grant execute on function public.get_draft_business_conversation(uuid, uuid) to anon, authenticated;

revoke all on function public.get_my_business_conversation(uuid) from public, anon;
grant execute on function public.get_my_business_conversation(uuid) to authenticated;
