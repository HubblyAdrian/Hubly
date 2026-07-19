-- Expand marketplace_providers.marketplace_status into full provider lifecycle.
-- Source of truth for public visibility and lead acceptance.

-- Drop old check, migrate legacy values, add new check.
alter table public.marketplace_providers
  drop constraint if exists marketplace_providers_marketplace_status_check;

-- Legacy: active → verified; keep paused/draft/suspended
update public.marketplace_providers
set marketplace_status = 'verified'
where marketplace_status = 'active';

-- Enabled + draft never configured should stay draft; enabled without active was rare.
-- If marketplace_enabled and status paused with no prior verification mirror, leave paused.
-- Hidden: previously disabled listings that were paused → hidden when not intending public.
update public.marketplace_providers
set marketplace_status = 'hidden'
where marketplace_enabled = false
  and marketplace_status = 'paused';

-- Sync verification_status from lifecycle where helpful
update public.marketplace_providers
set verification_status = 'verified'
where marketplace_status in ('verified', 'paused')
  and verification_status is distinct from 'verified';

update public.marketplace_providers
set verification_status = 'rejected'
where marketplace_status = 'rejected'
  and verification_status is distinct from 'rejected';

update public.marketplace_providers
set verification_status = 'pending'
where marketplace_status in ('draft', 'hidden', 'pending_verification', 'suspended')
  and verification_status = 'verified';

alter table public.marketplace_providers
  add constraint marketplace_providers_marketplace_status_check
  check (marketplace_status in (
    'draft',
    'hidden',
    'pending_verification',
    'verified',
    'paused',
    'suspended',
    'rejected'
  ));

-- Track whether the provider has ever been verified (resume from hidden/paused)
alter table public.marketplace_providers
  add column if not exists verified_at timestamptz;

alter table public.marketplace_providers
  add column if not exists status_changed_at timestamptz default now();

update public.marketplace_providers
set verified_at = coalesce(verified_at, updated_at, now())
where marketplace_status in ('verified', 'paused')
  and verified_at is null;

comment on column public.marketplace_providers.marketplace_status is
  'Lifecycle: draft|hidden|pending_verification|verified|paused|suspended|rejected. Only verified is publicly listed.';

-- Index for public listings
drop index if exists marketplace_providers_enabled_idx;
create index if not exists marketplace_providers_public_idx
  on public.marketplace_providers (marketplace_status, marketplace_score desc)
  where marketplace_status = 'verified';
