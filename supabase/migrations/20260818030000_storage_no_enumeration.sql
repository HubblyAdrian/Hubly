-- Storage audit, 2026-08-18. All three buckets are public=true, and each carried
-- a SELECT policy on storage.objects for role `public` gated on bucket_id alone.
--
-- MEASURED BEFORE THE CHANGE, with the public anon key:
--   * brand-assets listed 5 top-level folders, and every folder could be walked
--   * 72 files enumerable -- names, sizes, and paths
--   * folder names are real auth.uid() values and draft business ids
--   * filenames include logo-*, banner-*, portfolio-*, and owner-*.jpg
--   * any enumerated object then downloaded fine (HTTP 200, 81907 bytes)
--
-- That is the businesses/directory distinction again, in a bucket: a logo on a
-- public site should be readable by URL, and the bucket should not be a listing
-- of everyone's assets. A photo of a business owner is not something a stranger
-- should reach without ever visiting that business's site.
--
-- WHY DROPPING THE POLICY DOES NOT BREAK RENDERING. For a public bucket the CDN
-- route /storage/v1/object/public/{bucket}/{path} does not consult RLS. These
-- policies govern the authenticated API -- list, signed URLs, and
-- /object/{bucket}/{path}. Every read in this codebase goes through
-- getPublicUrl, uploads run server-side with the service role, and nothing calls
-- .list() anywhere in public/, api/ or supabase/functions/ (checked before
-- changing). Verified on brand-assets before applying to the other two:
-- enumeration 5 entries -> 0, public URL read still HTTP 200 at full size.
--
-- business-assets and site-media are empty today. They are included because the
-- same policy shape would enumerate them the moment they hold anything.

drop policy if exists "brand_assets_public_read" on storage.objects;
drop policy if exists "public can read assets" on storage.objects;
drop policy if exists "public can read site media" on storage.objects;

select 'storage: bucket enumeration closed on all three buckets' as status;
