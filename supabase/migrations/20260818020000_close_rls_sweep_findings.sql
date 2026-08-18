-- Closes the three findings from the 2026-08-18 RLS sweep.
--
-- (a) businesses was enumerable. The row policy was USING (true), so the anon
--     key could list all 64 businesses -- 15 of them with email and phone. A
--     public site showing ITS OWN contact details is the product; a downloadable
--     directory of everyone's is not. Session 1 removed draft_token from anon
--     reach but never examined enumeration.
--
--     Same pattern as Session 1, not a second approach: direct anon SELECT is
--     removed and a slug-scoped security-definer function returns exactly one
--     business. RLS cannot express "only when filtered by slug" -- every visitor
--     is the same anon role -- so a function is the only place that distinction
--     can live.
--
--     anon keeps column-level SELECT on (id, slug) ALONE. Several client paths
--     test slug availability with select('id').eq('slug', x); revoking outright
--     would make those queries error, and the calling code reads a failed lookup
--     as "slug is free", which silently invites collisions. id and slug are
--     already public -- a slug IS the site URL.
--
-- (b) duplicate policies. services, addons and portfolio_photos each carried two
--     identical USING (true) SELECT policies, booking_requests two identical
--     anon INSERTs. Postgres ORs them, so they were harmless -- but a future fix
--     that drops one leaves the other live and looks like it worked. That is the
--     false-success shape in policy form.
--
-- (c) hubly_brain_executions exposed 936 telemetry rows to anon. No PII (payload
--     is {at, executionId}, no row carries a business_id) so this was not
--     urgent, but nothing reads it from a browser.

-- ---------------------------------------------------------------------------
-- (a) businesses
-- ---------------------------------------------------------------------------

drop policy if exists "Public can read businesses" on public.businesses;
revoke select on public.businesses from anon;
grant select (id, slug) on public.businesses to anon;

-- Returns jsonb with draft_token EXPLICITLY stripped.
--
-- The first draft of this function was `returns setof public.businesses`, which
-- would have handed back every column -- and because SECURITY DEFINER runs as
-- the owner, it bypasses the column grant above. That would have reopened the
-- exact draft_token hole Session 1 closed, through the function written to
-- close a different one. Caught before it was applied.
--
-- `- 'draft_token'` is a visible, auditable removal rather than a column list
-- that silently gains new secrets as the table grows.
create or replace function public.get_public_business(p_slug text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $FN$
  select to_jsonb(b) - 'draft_token'
  from public.businesses b
  where b.slug = p_slug
  limit 1;
$FN$;

revoke all on function public.get_public_business(text) from public;
grant execute on function public.get_public_business(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- (b) duplicate policies -- keep one of each pair
-- ---------------------------------------------------------------------------

drop policy if exists "public can read addons" on public.addons;
drop policy if exists "public can read portfolio" on public.portfolio_photos;
drop policy if exists "public can read services" on public.services;
drop policy if exists "Public can insert booking_requests" on public.booking_requests;

-- ---------------------------------------------------------------------------
-- (c) hubly_brain_executions
-- ---------------------------------------------------------------------------

revoke select on public.hubly_brain_executions from anon;

select 'sweep findings a/b/c closed' as status;
-- The column grant on (id, slug) is necessary but NOT sufficient: dropping the
-- row policy left RLS with nothing to allow, so anon reads returned zero rows
-- and every slug-availability check reported "free". That silently invites slug
-- collisions. Caught by testing a slug that definitely exists and getting [].
--
-- Restores a row policy for anon SELECT. Exposure is bounded by the column
-- grant, not by this predicate: anon can see id and slug and nothing else, and
-- a slug is already public -- it is the site's URL.
drop policy if exists "Public can read business slugs" on public.businesses;
create policy "Public can read business slugs"
  on public.businesses for select to anon
  using (true);

select 'anon row policy restored (columns still limited to id, slug)' as status;
