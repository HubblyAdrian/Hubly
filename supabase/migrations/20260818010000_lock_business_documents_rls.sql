-- P0. Anonymous key could read every business's documents, and every draft_token.
--
-- FOUND BY INSPECTION, NOT ASSUMED. pg_policies showed:
--   business_documents  "Public can read business documents"  SELECT  {anon}  USING (true)
--   businesses          "Public can read businesses"          SELECT  {anon}  USING (true)
--
-- Measured before this migration, with the public anon key and no filter:
--   * 62 business_documents rows readable across all businesses, full rendered_html
--   * businesses.draft_token readable for every unclaimed draft
--
-- The second is the more serious of the two and was found while inspecting the
-- first. draft_token authorises EVERY draft mutation -- patch_business_in_progress,
-- create_business_document, logo upload, and the claim flow. The anon key ships in
-- the browser by design, so any visitor could read every draft's token and rewrite
-- or claim those businesses.
--
-- WHY RLS ALONE CANNOT FIX THE DOCUMENT CASE. Every public visitor is the same
-- `anon` role. There is no per-visitor identity, so any USING clause anon can
-- satisfy for its own business it can also satisfy for someone else's. "Read the
-- site I am visiting" and "list every site" are indistinguishable at the row level.
-- The fix is therefore to remove direct table access and expose a single
-- slug-scoped function that can only ever return one business's document.
--
-- PUBLIC SITES STAY PUBLIC. Generated sites are intentionally reachable by slug;
-- that is the product. What is removed is the ability to LIST across businesses.

-- ---------------------------------------------------------------------------
-- 1. business_documents: no direct anon reads at all
-- ---------------------------------------------------------------------------

drop policy if exists "Public can read business documents" on public.business_documents;
revoke select on public.business_documents from anon;

-- Owners keep direct access to their own documents. There was previously NO
-- authenticated policy at all, so a signed-in owner reading their own document
-- fell through to a deny; this is additive and fixes that too.
drop policy if exists "Owners can read their own business documents" on public.business_documents;
create policy "Owners can read their own business documents"
  on public.business_documents for select to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_documents.business_id and b.owner_id = auth.uid()
  ));

-- The only public read path. Takes a SLUG, returns at most one row, and cannot
-- be made to enumerate: there is no way to ask it for "all documents".
create or replace function public.get_public_business_document(
  p_slug text,
  p_tag  text default 'website'
)
returns table (rendered_html text, version integer)
language sql
security definer
stable
set search_path = public
as $FN$
  select d.rendered_html, d.version
  from public.business_documents d
  join public.businesses b on b.id = d.business_id
  where b.slug = p_slug
    and d.tag = coalesce(nullif(p_tag, ''), 'website')
  order by d.version desc
  limit 1;
$FN$;

revoke all on function public.get_public_business_document(text, text) from public;
grant execute on function public.get_public_business_document(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. businesses: same row policy, but draft_token is no longer readable by anon
-- ---------------------------------------------------------------------------
--
-- Column-level rather than row-level, because the row policy is correct: public
-- sites SHOULD be readable by slug. It is one column that must not be. Every
-- other column already renders on the public page.
--
-- `authenticated` is deliberately untouched -- its row policy is
-- owner_id = auth.uid(), so an owner sees only their own row.

revoke select on public.businesses from anon;
grant select (id, owner_id, name, tagline, slug, phone, email, city, about, brand_color, bg_color, logo_url, banner_url, ig_handle, fb_url, tiktok_handle, google_url, review_embed_code, payment_setting, deposit_type, deposit_value, deposit_message, section_order, created_at, meta, timezone, buffer_before_min, buffer_after_min, site_mode, hero_photos, service_area_cities, gen_hero_headline, gen_hero_subhead, gen_about, gen_faq, gen_seo_title, gen_seo_description, gen_why_choose, site_theme, tier, travel_radius_miles, years_in_business, gen_hero_headline_options, business_type, capabilities, address, zip, state, latitude, longitude, location_source) on public.businesses to anon;

select 'business_documents locked to slug-scoped RPC; draft_token no longer anon-readable' as status;
