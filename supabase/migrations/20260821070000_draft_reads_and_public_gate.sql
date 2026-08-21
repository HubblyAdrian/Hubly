-- A public address requires an owner. And the builder can still preview a draft.
--
-- THE HOLE
--
-- get_public_business_document(slug) and get_public_business(slug) served ANY
-- business by slug, claimed or not. So an unclaimed draft's {slug}.myhubly.app
-- was live to any stranger with the link — the read-time half of the phishing
-- exposure, and the reason an unfinished, unowned page was public as fact.
--
-- THE GATE
--
-- Both public RPCs now require owner_id IS NOT NULL. A stranger hitting an
-- unclaimed draft's URL gets nothing -> the client shows "unavailable".
--
-- WHAT HAPPENS TO EXISTING PAGES (checked before writing this):
--   * 10 claimed businesses — all on the CLASSIC renderer, owner_id set. They
--     keep serving: get_public_business returns them, and they never depended on
--     get_public_business_document (0 stored documents among them).
--   * 30 unclaimed businesses with a stored freeform page — all test businesses.
--     Their public URLs go dark to strangers, which is the whole point. Their
--     owners (us) can still preview via the draft RPCs below.
--
-- THE BUILDER STILL PREVIEWS
--
-- The builder loads {slug}.myhubly.app?hcEdit=1, which is the public page. With
-- the gate, that page can no longer read an unclaimed draft anonymously. So two
-- draft-scoped reads take a draft_token — the bearer credential the builder
-- already holds — and return the SAME data for an UNCLAIMED business when the
-- token matches. Claimed businesses have no draft_token, so these never apply to
-- them; the public RPCs serve those.

-- 1. Gate the public row.
create or replace function public.get_public_business(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select to_jsonb(b) - 'draft_token'
  from public.businesses b
  where b.slug = p_slug
    and b.owner_id is not null   -- a public address requires an owner
  limit 1;
$$;

-- 2. Gate the public document.
create or replace function public.get_public_business_document(p_slug text, p_tag text default 'website')
returns table(rendered_html text, version integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select d.rendered_html, d.version
  from public.business_documents d
  join public.businesses b on b.id = d.business_id
  where b.slug = p_slug
    and b.owner_id is not null   -- a public address requires an owner
    and d.tag = coalesce(nullif(p_tag, ''), 'website')
  order by d.version desc
  limit 1;
$$;

-- 3. Draft-scoped row read: the owner previewing their UNCLAIMED draft, proven by
--    the draft_token. Never applies to a claimed business (draft_token is null
--    once claimed, and the token predicate would never match).
create or replace function public.get_draft_business(p_slug text, p_draft_token uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select to_jsonb(b) - 'draft_token'
  from public.businesses b
  where b.slug = p_slug
    and b.owner_id is null
    and b.draft_token is not null
    and b.draft_token = p_draft_token
  limit 1;
$$;

-- 4. Draft-scoped document read.
create or replace function public.get_draft_business_document(p_slug text, p_tag text, p_draft_token uuid)
returns table(rendered_html text, version integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select d.rendered_html, d.version
  from public.business_documents d
  join public.businesses b on b.id = d.business_id
  where b.slug = p_slug
    and b.owner_id is null
    and b.draft_token is not null
    and b.draft_token = p_draft_token
    and d.tag = coalesce(nullif(p_tag, ''), 'website')
  order by d.version desc
  limit 1;
$$;

-- The builder authenticates with the publishable key (anon), so the draft reads
-- must be callable by anon — the draft_token is the credential, not the role.
revoke all on function public.get_draft_business(text, uuid) from public;
revoke all on function public.get_draft_business_document(text, text, uuid) from public;
grant execute on function public.get_draft_business(text, uuid) to anon, authenticated;
grant execute on function public.get_draft_business_document(text, text, uuid) to anon, authenticated;
