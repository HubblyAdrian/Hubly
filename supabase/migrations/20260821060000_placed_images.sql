-- Every image placed on a page, and where it came from.
--
-- WHY
--
-- We put third-party stock on customer pages. A takedown, a licence dispute, or
-- "where did this photo come from?" must be answerable with a query and
-- actionable without a scavenger hunt. This records provenance for every image
-- the resolver places, customer-owned or stock, at the moment it places it.
--
-- 'provider' is the crux:
--   'customer'  the business's own uploaded photo (portfolio_photos / logo).
--               No external licence; theirs to use.
--   'pexels'    stock. The asset_id, photographer and source_url are the
--               takedown handle; license names the terms.
--
-- 'slot' is where on the page it landed (hero, section.2, footer, logo…), so a
-- takedown can be located visually, not just by URL.

create table if not exists public.placed_images (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  document_version int,
  provider text not null,
  asset_id text,
  photographer text,
  source_url text,
  license text,
  image_url text not null,
  slot text,
  role text,
  alt text,
  placed_at timestamptz not null default now(),
  constraint placed_images_provider_check check (provider in ('customer', 'pexels'))
);

comment on table public.placed_images is
  'Provenance for every image placed on a generated page. provider=customer is '
  'the business''s own upload (no external licence); provider=pexels is stock, '
  'and asset_id/photographer/source_url/license are the takedown handle. slot is '
  'where on the page it sits.';

create index if not exists placed_images_business_idx on public.placed_images (business_id, placed_at desc);
create index if not exists placed_images_provider_idx on public.placed_images (provider, placed_at desc);
-- The query a takedown needs: find every page using one stock asset.
create index if not exists placed_images_asset_idx on public.placed_images (provider, asset_id);

alter table public.placed_images enable row level security;
revoke all on public.placed_images from anon, authenticated;
