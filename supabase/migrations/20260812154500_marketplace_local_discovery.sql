-- Marketplace Local Discovery: real geographic data for providers + a
-- static ZIP-centroid lookup, so a customer ZIP can become a real
-- geographic search target instead of a freeform city-name string match.
-- Additive only -- no existing column is altered or dropped.

-- Provider (business) location. Nullable/additive: existing rows are
-- unaffected until an owner completes their location in settings.
alter table businesses add column if not exists address text;
alter table businesses add column if not exists zip text;
alter table businesses add column if not exists state text;
alter table businesses add column if not exists latitude numeric(9,6);
alter table businesses add column if not exists longitude numeric(9,6);
-- Tracks how lat/lng was derived ('zip_centroid' today) so a future,
-- more precise source (e.g. real geocoding) can be distinguished from
-- the ZIP-centroid approximation without another schema change.
alter table businesses add column if not exists location_source text;

comment on column businesses.latitude is
  'Derived from zip via zip_centroids (location_source=''zip_centroid''). Null means this business has not completed location setup -- must never be guessed from city text.';
comment on column businesses.longitude is
  'See businesses.latitude.';

-- Partial index: only rows with real coordinates are ever scanned for
-- geographic eligibility, keeping the "no location = excluded" rule cheap
-- to enforce at the query level too, not just in application code.
create index if not exists businesses_geo_idx
  on businesses (latitude, longitude)
  where latitude is not null and longitude is not null;

-- Static US ZIP-centroid reference table. Read-only at runtime, used only
-- from the marketplace edge function (service-role) to convert a ZIP
-- (customer or provider) into approximate coordinates -- no runtime
-- geocoding API dependency. Seeded here with real, verified coordinates
-- for the Marketplace Local Discovery test region (Utah County + one
-- distant control ZIP); full national coverage is a separate, later
-- bulk-import task and is called out as a known limitation, not silently
-- implied by this migration.
create table if not exists public.zip_centroids (
  zip text primary key,
  city text not null,
  state text not null,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null
);

comment on table public.zip_centroids is
  'Static US ZIP -> approximate centroid lookup (city/state/lat/lng). Seeded with a small real, verified test region for Marketplace Local Discovery; NOT a full national dataset yet -- see #Marketplace Local Discovery follow-up for bulk import.';

alter table public.zip_centroids enable row level security;
-- No anon/authenticated policy: this is a backend-only lookup table,
-- read exclusively via the marketplace edge function's service-role
-- client. Nothing in the client ever queries it directly.

insert into public.zip_centroids (zip, city, state, latitude, longitude) values
  ('84043', 'Lehi', 'UT', 40.405967, -111.864611),
  ('84003', 'American Fork', 'UT', 40.392800, -111.794100),
  ('84604', 'Provo', 'UT', 40.267600, -111.657100),
  ('84770', 'Saint George', 'UT', 37.265502, -113.791338)
on conflict (zip) do nothing;
