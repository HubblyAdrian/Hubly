-- Phase 5 architecture lock: one Business, multiple capabilities.
-- marketplace_providers remains a 1:1 extension row (listing/lifecycle),
-- NOT a second business profile. Upgrading Lite → Pro enables capabilities;
-- it does not migrate or copy business data.

comment on table public.businesses is
  'Canonical Hubly Business. One record per company. Experiences (Marketplace Lite, Hubly Pro, website, AI) are capabilities — never duplicate profile/services/stripe into parallel business tables.';

comment on table public.marketplace_providers is
  'Marketplace capability + lifecycle for a Business (1:1). Listing status, Instant Book, scores. Profile/services/hours/stripe live on businesses — no data duplication.';

comment on column public.marketplace_providers.marketplace_enabled is
  'Capability flag: business participates in the Hubly marketplace. Enabling Hubly Pro does not copy this row — Pro is a separate capability on the same Business.';

comment on column public.marketplace_providers.provider_kind is
  'hubly = also uses Hubly Pro/storefront tools; marketplace_only = Provider Experience (Marketplace Lite) packaging without implying a second business entity.';

-- Soft capability mirror on businesses for product routing (non-authoritative for lifecycle).
-- Source of truth for marketplace listing remains marketplace_providers.
alter table public.businesses
  add column if not exists capabilities jsonb not null default '{}'::jsonb;

comment on column public.businesses.capabilities is
  'Product capabilities for this Business, e.g. {"marketplace":true,"hubly_pro":true}. Upgrade Lite→Pro = flip hubly_pro. Do not copy customers/services/bookings.';

-- Backfill marketplace capability from existing provider rows
update public.businesses b
set capabilities = coalesce(b.capabilities, '{}'::jsonb) ||
  jsonb_build_object(
    'marketplace', coalesce(p.marketplace_enabled, false),
    'hubly_pro', case
      when coalesce(p.provider_kind, 'hubly') = 'marketplace_only' then false
      else true
    end
  )
from public.marketplace_providers p
where p.business_id = b.id;

-- Keep marketplace capability in sync when provider listing flag changes
create or replace function public.sync_business_marketplace_capability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.businesses
  set capabilities = coalesce(capabilities, '{}'::jsonb) ||
    jsonb_build_object(
      'marketplace', coalesce(new.marketplace_enabled, false),
      'hubly_pro', case
        when coalesce(new.provider_kind, 'hubly') = 'marketplace_only' then
          coalesce((capabilities->>'hubly_pro')::boolean, false)
        else
          coalesce((capabilities->>'hubly_pro')::boolean, true)
      end
    )
  where id = new.business_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_business_marketplace_capability on public.marketplace_providers;
create trigger trg_sync_business_marketplace_capability
  after insert or update of marketplace_enabled, provider_kind
  on public.marketplace_providers
  for each row
  execute function public.sync_business_marketplace_capability();
