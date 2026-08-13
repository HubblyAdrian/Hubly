-- Marketplace National ZIP Coverage: zip_centroids is now populated
-- nationally from the GeoNames US postal-code dataset (~40,979 rows,
-- 50 states + DC + Marshall Islands; military APO/FPO ZIPs with foreign
-- coordinates excluded). The data was loaded via a batched, idempotent
-- upsert (not a migration, per plan) -- this migration only corrects the
-- now-stale table comment so the schema self-documents accurately and
-- carries the GeoNames CC-BY 4.0 attribution at the data layer.
-- No structural schema change. See docs/DATA_ATTRIBUTION.md.
comment on table public.zip_centroids is
  'US ZIP -> approximate centroid (city/state/lat/lng). National coverage imported from GeoNames US postal codes (CC-BY 4.0, https://www.geonames.org). 50 states + DC + MH; excludes overseas military APO/FPO ZIPs. Backend-only lookup used by the marketplace edge function (resolveZipCentroid) for geographic provider discovery. PR/GU/VI/AS/MP territories are NOT included (separate GeoNames country files).';
