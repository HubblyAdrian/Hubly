-- Adobe Lightroom provider — cache catalog id + last token refresh for status().
alter table public.adobe_lightroom_connections
  add column if not exists catalog_id text,
  add column if not exists last_token_refresh_at timestamptz;

comment on column public.adobe_lightroom_connections.catalog_id is
  'Cached Lightroom catalog id from GET /v2/catalog (service-role only).';
comment on column public.adobe_lightroom_connections.last_token_refresh_at is
  'When the access token was last refreshed via IMS.';
