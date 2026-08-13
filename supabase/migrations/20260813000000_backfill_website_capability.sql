-- Storefront Builder: surface capability flags on businesses.capabilities.
--
-- The `capabilities` JSONB column already exists (20260720060000_business_capabilities.sql). The
-- Storefront Builder introduces two surface flags that decide what the Hubly Builder exposes and
-- how the public site routes:
--   capabilities.website    = true  → the business has a traditional Website (served at "/")
--   capabilities.storefront = true  → the business has a standalone Storefront (served at "/store")
--
-- Every EXISTING business uses the Website Builder today, so backfill website=true for any row that
-- hasn't got the flag yet. Storefront is opt-in and set by the app the first time an owner builds a
-- storefront (see ensureStorefrontCapabilityOnBusiness in hubly.html) — never backfilled here.
--
-- Merge semantics (`||`) preserve existing keys such as marketplace / hubly_pro / projects / lightroom.

update public.businesses
set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"website": true}'::jsonb
where coalesce(capabilities ->> 'website', '') = '';

comment on column public.businesses.capabilities is
  'Per-business capability flags, e.g. {"marketplace":true,"hubly_pro":true,"projects":true,"lightroom":true,"website":true,"storefront":true}. website/storefront gate the Hubly Builder surfaces and public routing (/ vs /store).';
