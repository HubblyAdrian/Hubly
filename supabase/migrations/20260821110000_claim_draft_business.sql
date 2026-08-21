-- Sign-in claims the draft. One RPC, and it refuses everything else.
--
-- Someone watched a page get built for their business; the account they just made
-- is what keeps it. On successful auth in the builder the anonymous draft becomes
-- theirs: owner_id = the authenticated user. This is the ONE privileged step that
-- turns "I made this" into "this is mine", so it is written to do exactly that and
-- nothing more -- it is a privilege-escalation surface if it is sloppy.
--
-- RULES, each enforced below:
--   * Authenticated only. auth.uid() must be present; revoked from anon.
--   * Sets owner_id ONLY where owner_id is null AND the supplied draft token
--     matches the stored one. The token is the proof they are the person who
--     created it -- the same token the builder already holds to authorise edits.
--   * Refuses outright if owner_id is already set to someone else. It NEVER
--     reassigns an owned business.
--   * Idempotent: if it is already theirs, that is a no-op success, not an error,
--     so a double-claim (two tabs, a retry) doesn't fail.
--   * Returns whether it actually claimed, so the client can tell "claimed" from
--     "already yours" from a real refusal.

create or replace function public.claim_draft_business(
  p_draft_id uuid,
  p_draft_token uuid
)
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

  -- Already owned. Theirs -> idempotent success; anyone else -> refuse, never
  -- reassign.
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
  update public.businesses
     set owner_id = v_uid
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

-- Authenticated only. A signed-in JWT is the whole premise; anon must never reach
-- it, or the token alone would be enough to take ownership without an account.
revoke all on function public.claim_draft_business(uuid, uuid) from public, anon;
grant execute on function public.claim_draft_business(uuid, uuid) to authenticated;
