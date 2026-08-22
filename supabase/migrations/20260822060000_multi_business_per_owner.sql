-- One account, many businesses. owner_id had a UNIQUE constraint
-- (businesses_owner_id_key) — a leftover assumption, not a decision. It broke
-- real people: someone who builds a page, doesn't love it, and builds another;
-- anyone testing; and the very common home-services case of one person running
-- two businesses (landscaping + snow removal, a plumber whose partner runs a
-- salon). It also made the SECOND claim fail with a raw constraint error.
--
-- Dependencies checked BEFORE dropping (code that assumed one row per owner):
--   * public/hubly.html — 3 `.eq('owner_id',…).maybeSingle()` sites in the /app
--     (loadBusiness, the upsert helper, ensureDraftBusiness). Made resilient in
--     the same change (order by created_at desc, limit 1) so they pick the most
--     recent instead of erroring / creating a duplicate.
--   * studio-api getBusinessId — already `.limit(1).maybeSingle()` and prefers an
--     explicit id; multi-safe already, left alone.
--   * RLS policies use `owner_id = auth.uid()` — correct for many rows per owner.
--   * claim_draft_business sets owner_id where owner_id is null — untouched; it
--     simply stops hitting the unique violation on a second claim.
alter table public.businesses drop constraint if exists businesses_owner_id_key;

-- The builder's owner read path becomes a LIST. Same auth.uid() scoping, nothing
-- the client supplies — every business the user owns, newest first, with enough
-- to render a picker row: name, slug, url, whether it has a page, and when the
-- page was last updated (max document created_at, else the business's own
-- created_at — avoids depending on a businesses.updated_at column). draftToken is
-- included; it is inert for a claimed business (edits authorise by ownership).
create or replace function public.get_my_businesses()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(obj order by ord desc), '[]'::jsonb)
  from (
    select
      jsonb_build_object(
        'id', b.id,
        'slug', b.slug,
        'name', b.name,
        'url', 'https://' || b.slug || '.myhubly.app',
        'draftToken', b.draft_token,
        'hasPage', exists (select 1 from public.business_documents d where d.business_id = b.id),
        'updatedAt', coalesce(
          (select max(d.created_at) from public.business_documents d where d.business_id = b.id),
          b.created_at
        )
      ) as obj,
      b.created_at as ord
    from public.businesses b
    where b.owner_id = auth.uid()
  ) t;
$$;

revoke all on function public.get_my_businesses() from public, anon;
grant execute on function public.get_my_businesses() to authenticated;
