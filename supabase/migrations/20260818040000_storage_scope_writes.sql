-- Cross-tenant write hole on site-media and business-assets.
--
-- FOUND during the 2026-08-18 storage audit, fixed here before the buckets have
-- customer content in them rather than after.
--
--   site-media        INSERT/UPDATE/DELETE gated on bucket_id ALONE
--   business-assets   INSERT/DELETE gated on auth.uid() IS NOT NULL
--
-- Either lets ANY signed-in user overwrite or delete ANY other business's
-- objects. Not exploitable today only because both buckets are empty: nothing
-- in public/, api/ or supabase/functions/ references either one. The next
-- feature to ship -- wiring up "Your photos" -- is exactly what fills them, so
-- the window between "has content" and "is scoped" should be zero.
--
-- brand-assets already models the fix: (storage.foldername(name))[1] must equal
-- the caller's auth.uid(), i.e. a folder per user, and the client writes
-- `${ownerId}/${kind}-${ts}.jpg` to match. The same shape is applied here.
--
-- The service role is unaffected -- it bypasses RLS entirely, which is how the
-- server-side uploader writes drafts/${draftId}/... in brand-assets today.
--
-- Public READ is not restored by this migration: 20260818030000 removed bucket
-- enumeration and public object reads continue to work through the CDN route,
-- which does not consult RLS.

-- ---------------------------------------------------------------------------
-- site-media
-- ---------------------------------------------------------------------------

drop policy if exists "authenticated can upload site media" on storage.objects;
drop policy if exists "authenticated can update own site medi" on storage.objects;
drop policy if exists "authenticated can update own site media" on storage.objects;
drop policy if exists "authenticated can delete own site medi" on storage.objects;
drop policy if exists "authenticated can delete own site media" on storage.objects;

create policy "site_media_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-media' and (storage.foldername(name))[1] = (auth.uid())::text);

create policy "site_media_owner_update" on storage.objects
  for update to authenticated
  using      (bucket_id = 'site-media' and (storage.foldername(name))[1] = (auth.uid())::text)
  with check (bucket_id = 'site-media' and (storage.foldername(name))[1] = (auth.uid())::text);

create policy "site_media_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-media' and (storage.foldername(name))[1] = (auth.uid())::text);

-- ---------------------------------------------------------------------------
-- business-assets
-- ---------------------------------------------------------------------------

drop policy if exists "owner can upload assets" on storage.objects;
drop policy if exists "owner can delete their assets" on storage.objects;

create policy "business_assets_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'business-assets' and (storage.foldername(name))[1] = (auth.uid())::text);

create policy "business_assets_owner_update" on storage.objects
  for update to authenticated
  using      (bucket_id = 'business-assets' and (storage.foldername(name))[1] = (auth.uid())::text)
  with check (bucket_id = 'business-assets' and (storage.foldername(name))[1] = (auth.uid())::text);

create policy "business_assets_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'business-assets' and (storage.foldername(name))[1] = (auth.uid())::text);

select 'site-media and business-assets writes scoped to the caller''s own folder' as status;
