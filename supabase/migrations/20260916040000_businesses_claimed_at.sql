-- WHEN A BUSINESS WAS CLAIMED — the fact we already hold, finally recorded.
--
-- ══ WHY THIS EXISTS ═══════════════════════════════════════════════════════════════════════
--
-- "A pre-account message is one written BEFORE the business was claimed." That is a timestamp
-- comparison. Today it is a CONTENT REGEX — /reserved for you/i and two siblings — deciding which
-- of an owner's own messages they are allowed to see, and on 2026-09-16 it was measured wrong 1
-- time in 3 on the market set: it hid `window-washing` seq 10, a message that explains how to edit
-- and merely contains the phrase "that takes an account".
--
-- A heuristic standing in for a fact we already hold is CHECKER_LESSONS Lesson 87's twelfth
-- instance. The fix is always the same: derive the set, or make membership structural.
--
-- ══ WHY NOT draft_claims.claimed_at ═══════════════════════════════════════════════════════
--
-- It exists, and it holds ZERO rows against 41 claimed businesses, because claim_draft_business
-- never writes it — the table belongs to a superseded claim path. A dated claim we never recorded.
-- Measured, not assumed.
--
-- ══ WHY ON businesses AND NOT ON EVERY MESSAGE ════════════════════════════════════════════
--
-- One column per business, written by ONE function, at the ONE moment the fact becomes true —
-- rather than one column on every conversation row that every future writer has to remember to
-- set. A writer can forget; a claim cannot happen without this update, because it IS the update.
--
-- ══ NULL MEANS UNKNOWN AND IS NEVER GUESSED ═══════════════════════════════════════════════
--
-- The 41 businesses claimed before today have no honest date, and nothing here invents one. What
-- the READER does with null is a separate decision (Adrian's), deliberately not encoded here.

alter table public.businesses
  add column if not exists claimed_at timestamptz;

comment on column public.businesses.claimed_at is
  'When owner_id was first set, written by claim_draft_business. NULL = claimed before this column existed, or never claimed; it is never inferred.';

-- The claim writes it, in the SAME statement that sets owner_id, so the two cannot disagree.
-- Everything else about this function is unchanged: the preconditions are repeated in the WHERE
-- so a concurrent claim cannot slip between the read and the write.
create or replace function public.claim_draft_business(p_draft_id uuid, p_draft_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_owner uuid;
  v_token uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_draft_id is null or p_draft_token is null then
    return jsonb_build_object('ok', false, 'error', 'missing_input');
  end if;

  select owner_id, draft_token into v_owner, v_token
  from public.businesses where id = p_draft_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Already owned. Theirs -> idempotent success; anyone else -> refuse, never reassign.
  if v_owner is not null then
    if v_owner = v_uid then
      return jsonb_build_object('ok', true, 'claimed', false, 'alreadyYours', true);
    end if;
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;

  -- Unowned: the token must match the stored one, or this caller has no claim.
  if v_token is null or v_token <> p_draft_token then
    return jsonb_build_object('ok', false, 'error', 'bad_token');
  end if;

  -- The claim. The WHERE repeats every precondition so a concurrent claim can't
  -- slip between the check above and this write.
  -- claimed_at rides the SAME update as owner_id: one statement, so a claim can never exist
  -- without its date, and the date can never exist without the claim.
  update public.businesses
     set owner_id = v_uid,
         claimed_at = now()
   where id = p_draft_id
     and owner_id is null
     and draft_token = p_draft_token;

  if not found then
    -- Lost the race (claimed between the read and the write). Re-read to answer
    -- honestly rather than reporting a claim that didn't happen.
    select owner_id into v_owner from public.businesses where id = p_draft_id;
    if v_owner = v_uid then
      return jsonb_build_object('ok', true, 'claimed', false, 'alreadyYours', true);
    end if;
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;

  return jsonb_build_object('ok', true, 'claimed', true);
end;
$$;
