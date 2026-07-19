-- AI-ready provider document cache + ops audit fields on marketplace_providers.

alter table public.marketplace_providers
  add column if not exists status_reason text;

alter table public.marketplace_providers
  add column if not exists reviewed_at timestamptz;

alter table public.marketplace_providers
  add column if not exists reviewed_by text;

-- Cached canonical AI document (rebuilt on settings/ops/score refresh)
alter table public.marketplace_providers
  add column if not exists ai_document jsonb;

alter table public.marketplace_providers
  add column if not exists ai_document_updated_at timestamptz;

comment on column public.marketplace_providers.ai_document is
  'Cached hubly.marketplace.provider.v1 document for AI agents. Rebuild via marketplace API.';

comment on column public.marketplace_providers.status_reason is
  'Human/ops reason for current lifecycle status (reject/suspend/pause notes).';
