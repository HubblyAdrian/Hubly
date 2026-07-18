-- Public brand assets (logos, banners). Paths: {owner_id}/{kind}-{ts}.jpg
-- Owners may upload/update/delete only under their own auth.uid() folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read (site + booking pages need the URL without auth)
drop policy if exists "brand_assets_public_read" on storage.objects;
create policy "brand_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'brand-assets');

drop policy if exists "brand_assets_owner_insert" on storage.objects;
create policy "brand_assets_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "brand_assets_owner_update" on storage.objects;
create policy "brand_assets_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "brand_assets_owner_delete" on storage.objects;
create policy "brand_assets_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
