-- THE RATE LIMIT WAS COUNTING OUR OWN ADDRESS.
--
-- start_business_in_progress caps drafts at 10 per IP per hour, reading the address from
-- _caller_ip(), which parses PostgREST's `request.headers` GUC. Those headers belong to
-- the EDGE FUNCTION's connection to PostgREST — not to the visitor. So the guard was
-- counting hubly-conversation's own egress address, which the runtime rotates per
-- invocation.
--
-- MEASURED 2026-09-09: 52 drafts created in two hours carried 52 distinct "IPs", maximum
-- 3 apiece — the signature of an address that changes per call, never reaching 10. The
-- limit capped nothing while reporting success, which is the same false-green shape as an
-- unearned checkmark, except this one has a bill attached: a draft is a full site
-- generation, and roughly 35 of them drained a complete OpenAI top-up. Anyone with a
-- script could empty the account in minutes, and per the outage finding the same day,
-- nothing would have said so until a customer hit the error.
--
-- THE ADDRESS IS AVAILABLE, JUST NOT HERE. The edge runtime receives it on the inbound
-- request; page-view has been reading it correctly all along. So the caller now passes it
-- in, and _caller_ip() becomes the fallback rather than the source.
--
-- IT IS NOT SPOOFABLE. Two forged x-forwarded-for values sent through page-view left its
-- visitor_hash unchanged, so the platform overwrites the header rather than appending to
-- it: the first hop is the real client, not something the client chose. That is why
-- taking the value from the caller is safe here — it is our edge function reporting what
-- the platform told it, not the browser asserting who it is.
--
-- p_client_ip is added LAST with a default so existing callers keep working.

create or replace function public.start_business_in_progress(
  p_name text,
  p_business_type text default null,
  p_client_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_token uuid := gen_random_uuid();
  v_base text;
  v_slug text;
  v_type text;
  v_meta text;
  v_tries int := 0;
  v_ip text;
  v_recent int;
  v_named boolean;
begin
  -- A NULL OR EMPTY NAME IS A VALID STATE, not an error. The refusal that used to sit
  -- here is why the model constructed "Mobile Detailing in Los Angeles" and minted it as
  -- a real person's permanent address: it had to pass something.
  v_named := coalesce(trim(p_name), '') <> '';

  -- RATE LIMIT: at most 10 drafts per IP per hour. The caller's value wins because only
  -- the edge function can see the visitor; _caller_ip() stays as the fallback for any
  -- direct PostgREST caller, where it IS the right answer. An absent IP is still not
  -- proof of abuse — it does not block, exactly as before.
  v_ip := coalesce(nullif(trim(coalesce(p_client_ip, '')), ''), _caller_ip());
  if v_ip is not null then
    select count(*) into v_recent
    from draft_creation_events
    where ip = v_ip and created_at > now() - interval '1 hour';
    if v_recent >= 10 then
      return jsonb_build_object('ok', false, 'error', 'rate_limited',
        'detail', 'Too many drafts from this connection in the last hour. Try again later.');
    end if;
  end if;

  v_type := nullif(trim(coalesce(p_business_type, '')), '');
  v_meta := case when v_type is not null
    then jsonb_build_object('businessType', v_type)::text
    else null end;

  if v_named then
    v_base := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
    v_base := trim(both '-' from v_base);
    if v_base = '' then v_base := 'business'; end if;
    v_base := left(v_base, 40);
  end if;

  loop
    -- THE ONLY BRANCH. A named draft keeps its readable slug; an unnamed one gets a
    -- temporary address that cannot be mistaken for a name somebody chose.
    if v_named then
      v_slug := v_base || case when v_tries = 0 then '' else '-' || substr(md5(random()::text), 1, 5) end;
    else
      v_slug := 'site-' || substr(md5(random()::text), 1, 6);
    end if;
    begin
      if v_type is null then
        insert into businesses (name, slug, owner_id, draft_token, name_unset)
        values (case when v_named then trim(p_name) else null end, v_slug, null, v_token, not v_named)
        returning id into v_id;
      else
        insert into businesses (name, slug, business_type, owner_id, draft_token, meta, name_unset)
        values (case when v_named then trim(p_name) else null end, v_slug, v_type, null, v_token, v_meta, not v_named)
        returning id into v_id;
      end if;
      exit;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 6 then
        return jsonb_build_object('ok', false, 'error', 'slug_unavailable');
      end if;
    end;
  end loop;

  -- Record the successful creation for the next caller's count. After the insert,
  -- so a failed attempt does not consume the allowance.
  if v_ip is not null then
    insert into draft_creation_events (ip) values (v_ip);
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug,
    'draft_token', v_token, 'name_unset', not v_named);
end;
$function$;

-- The two-argument signature is gone: every caller passes the IP now, and leaving an
-- overload that silently skips the rate limit is how the guard would quietly come back.
drop function if exists public.start_business_in_progress(text, text);
