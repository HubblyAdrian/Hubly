-- == THE SITEMAP'S MEMBERSHIP, DERIVED FROM THE PUBLIC READER ITSELF ==========================
--
-- WHY THIS EXISTS. Adrian verified in Google Search Console (2026-09-18, a new DOMAIN property for
-- myhubly.app) that graefs-autocare.myhubly.app has NEVER been fetched by Google — every crawl field
-- reads N/A and the URL is "unknown to Google". A Live Test on the same URL renders his real site and
-- says "Page can be indexed". So rendering is fine, the noindex fix is confirmed live by Google's own
-- tooling, and the reason customer sites are not findable is DISCOVERY: nothing tells Google the URLs
-- exist. There is no sitemap, and /sitemap.xml currently returns HTTP 200 with 3MB of text/html
-- because the catch-all answers it -- the same silent-undefined route failure robots.txt was created
-- to fix, still open one filename over.
--
-- == MEMBERSHIP IS NOT A SECOND OPINION ABOUT WHO IS INDEXABLE ================================
--
-- Adrian: "Unclaimed drafts and test accounts must not appear -- that is the same distinction
-- hcNoIndex() encodes, so derive it from the same place and say so at the line."
--
-- hcNoIndex() stamps <meta name="robots" content="noindex, nofollow"> when
--
--     !hcRowIsClaimed(row) || row.account_kind === 'test'
--
-- and `row` there is exactly what get_public_business(slug) returned. So this function asks the SAME
-- function the SAME question rather than re-deriving it from the table:
--
--   * get_public_business(slug) IS NOT NULL   -- its own WHERE requires owner_id is not null, and
--                                               when it returns nothing the page renders
--                                               "This page isn't live yet" (p-public-unavailable).
--                                               So this IS the "has a live page" test, not a proxy
--                                               for it: a row here means a visitor sees a site.
--   * ->>'account_kind' <> 'test'             -- read off the reader's OWN output, not off b.account_kind
--
-- Reading `b.account_kind` directly would be the second-opinion bug: the sitemap and the page could
-- then disagree about the same business, and the sitemap would win in Google while the page wins in
-- the browser. Two readers of one fact is how the account chip came to show a login as a name.
--
-- INTERNAL ACCOUNTS ARE INCLUDED, deliberately and visibly. account_kind has three values (test,
-- internal, market) and hcNoIndex excludes only 'test', so internal pages are indexable TODAY. This
-- function matches that exactly. If including internal is wrong it is wrong in BOTH places, and the
-- fix belongs in the shared predicate rather than in one of the two -- which is the whole point of
-- deriving it here instead of restating it.
--
-- == WHAT IS EXPOSED, STATED RATHER THAN ASSUMED ==============================================
--
-- This is granted to anon, so anyone may enumerate the slugs of every claimed non-test business.
-- That is a NEW anonymous enumeration endpoint and it deserves to be named as one. The incremental
-- exposure is nil: the sitemap it feeds publishes precisely this list at a public URL, which is what
-- a sitemap is for. It returns slug and updated_at and NOTHING else -- no owner, no email, no phone,
-- no meta. Vercel holds no Supabase service key (checked), so the serverless route can only call
-- this with the publishable key; a grant to service_role alone would make the route return nothing
-- and the sitemap empty, which is worse than the exposure.
--
-- == NO ROW IS WRITTEN =======================================================================
--
-- One CREATE FUNCTION. Zero INSERT/UPDATE/DELETE. graefs-autocare is read-only and untouched.

create or replace function public.get_indexable_business_slugs()
returns table (slug text, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.slug, b.updated_at
    from public.businesses b
    cross join lateral (select public.get_public_business(b.slug) as pub) g
   where g.pub is not null
     and coalesce(g.pub ->> 'account_kind', '') <> 'test'
   order by b.slug
$fn$;

grant execute on function public.get_indexable_business_slugs() to anon, authenticated;
