-- The browser must never be able to store page HTML.
--
-- THE HOLE
--
-- create_business_document was granted to anon. Anyone could create a draft by
-- typing a sentence (which returns a draft_token), then call this RPC directly
-- with any p_rendered_html they liked — served publicly on a *.myhubly.app
-- subdomain over Hubly's own TLS. A phishing host, two API calls away.
--
-- Proven immediately before this migration: an anon request with a real draft
-- token and a fake bank-login form returned {ok:true} and stored the page.
--
-- WHY REVOKE IS SAFE
--
-- Every legitimate caller authenticates as service_role, which keeps its grant:
--
--   * 11 call sites in _shared/hubly_capability_registry.ts, all via
--     callBusinessRpc -> adminHeaders() -> the secret key. Generation, inline
--     edit, rerender, newPage, chrome, record-sync — all server-side.
--   * scripts/rerender-business-document.ts, run with SUPABASE_SERVICE_ROLE_KEY.
--
-- NO browser path calls it. The inline editor posts {label, text} to
-- hubly-conversation; the server reads the stored HTML and splices. The browser
-- never supplies markup and never needs to.
--
-- So anon and authenticated lose EXECUTE and nothing legitimate changes. The
-- function is SECURITY DEFINER and still checks the draft token internally;
-- this removes the ability to REACH it without our own secret key.

revoke execute on function public.create_business_document(uuid, uuid, text, jsonb, text, text, text, text) from anon, authenticated;

-- Leave service_role and postgres exactly as they were. Stated explicitly so a
-- future "grant it back to anon" has to argue with this line.
grant execute on function public.create_business_document(uuid, uuid, text, jsonb, text, text, text, text) to service_role;

-- Confirm who can execute it now.
select array_to_string(p.proacl, ' | ') as acl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_business_document';
