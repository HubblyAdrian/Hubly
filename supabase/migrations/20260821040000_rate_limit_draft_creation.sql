-- Rate-limit draft creation. Abuse needs volume; a real person needs a handful.
--
-- WHY IN THE RPC AND NOT THE EDGE FUNCTION
--
-- start_business_in_progress is granted to anon, so a limit enforced in
-- hubly-conversation is bypassed by calling the RPC directly with the
-- publishable key. The check has to live where the row is written.
--
-- WHERE THE IP COMES FROM
--
-- PostgREST exposes the request headers to the function as the `request.headers`
-- GUC. Confirmed live: the function sees cf-connecting-ip (Cloudflare's single
-- trusted client IP) and x-forwarded-for. We prefer cf-connecting-ip because it
-- is one address set by our own edge, not a client-controllable comma list;
-- x-forwarded-for's FIRST hop is the fallback. An attacker can still rotate real
-- IPs, but that raises the cost from "a for-loop" to "a botnet", which is the
-- point of a modest limit.
--
-- THE LIMIT
--
-- 10 drafts per IP per hour. A genuine person building one site, retrying a
-- failed build, or trying two directions is nowhere near it. A script hosting
-- phishing pages hits it on the eleventh call. Deliberately generous: this is a
-- volume brake, not an identity check (that is the verified-account gate, which
-- is separate work).
--
-- FAILURE IS NON-FATAL TO A LEGITIMATE USER
--
-- If the header is missing entirely (some internal caller, a health check) the
-- limit does not apply — an absent IP is not evidence of abuse, and blocking on
-- it would break server-side callers. The counting table is the record.

create table if not exists public.draft_creation_events (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);
-- The only query this table serves: recent count for one IP.
create index if not exists draft_creation_events_ip_time_idx
  on public.draft_creation_events (ip, created_at desc);

alter table public.draft_creation_events enable row level security;
revoke all on public.draft_creation_events from anon, authenticated;

-- Resolve the caller IP the same way everywhere.
create or replace function public._caller_ip()
returns text
language plpgsql
stable
as $$
declare
  h jsonb;
  ip text;
begin
  begin
    h := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  exception when others then
    return null;
  end;
  -- cf-connecting-ip is a single address set by our edge; prefer it.
  ip := nullif(trim(h->>'cf-connecting-ip'), '');
  if ip is null then
    -- x-forwarded-for is "client, proxy, proxy"; the first hop is the client.
    ip := nullif(trim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), '');
  end if;
  return ip;
end;
$$;
revoke all on function public._caller_ip() from public, anon, authenticated;

-- Rebuilt from the LIVE body (pg_get_functiondef, read immediately before this
-- file) with only the rate-limit preamble and the event-record line added.
-- Nothing else in the body changes.
create or replace function public.start_business_in_progress(p_name text, p_business_type text default null::text)
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
begin
  if coalesce(trim(p_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_name');
  end if;

  -- RATE LIMIT: at most 10 drafts per IP per hour. Only enforced when we can
  -- identify the caller; an absent IP is not proof of abuse.
  v_ip := _caller_ip();
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
    else null
  end;

  v_base := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if v_base = '' then v_base := 'business'; end if;
  v_base := left(v_base, 40);

  loop
    v_slug := v_base || case when v_tries = 0 then '' else '-' || substr(md5(random()::text), 1, 5) end;
    begin
      if v_type is null then
        insert into businesses (name, slug, owner_id, draft_token)
        values (trim(p_name), v_slug, null, v_token)
        returning id into v_id;
      else
        insert into businesses (name, slug, business_type, owner_id, draft_token, meta)
        values (trim(p_name), v_slug, v_type, null, v_token, v_meta)
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

  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug, 'draft_token', v_token);
end;
$function$;

-- Grants unchanged from the live acl: the browser still starts drafts.
grant execute on function public.start_business_in_progress(text, text) to anon, authenticated, service_role;
