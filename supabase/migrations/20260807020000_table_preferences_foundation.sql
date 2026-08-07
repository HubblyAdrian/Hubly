-- Generic table-preferences foundation — one reusable persistence model for
-- every configurable table in Hubly (Leads first; Customers/Jobs/Calendar/
-- Storefront Orders/Products/Invoices later reuse the same two tables by
-- passing a different table_key, no schema changes required per module).
--
-- Two separate concepts, per product direction:
--   user_table_preferences  — belongs to one authenticated user: column
--     order/width/hidden/renamed-label, row density, sort order, saved
--     views. Never shared with teammates.
--   business_table_config   — belongs to the business itself: custom field
--     definitions, business-wide renamed defaults, required fields. Every
--     employee in the business sees the same config. (Not yet written to by
--     any client code — this just reserves the shape so a future custom-
--     fields feature doesn't need its own migration.)
--
-- preferences/config are jsonb, not typed columns, because each table_key's
-- shape differs (Leads cares about column widths, Calendar might care about
-- default view/range) and a generic store shouldn't need a migration every
-- time a module adds a new preference field.

create table if not exists public.user_table_preferences (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  table_key text not null,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id, table_key)
);

comment on table public.user_table_preferences is
  'Per-user, per-business, per-table workspace preferences (column order/width/hidden/labels, density, sort, saved views). Generic across every configurable table in Hubly via table_key.';

create index if not exists user_table_preferences_lookup_idx
  on public.user_table_preferences (business_id, user_id, table_key);

create or replace function public.touch_user_table_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_user_table_preferences_updated_at on public.user_table_preferences;
create trigger trg_touch_user_table_preferences_updated_at
  before update on public.user_table_preferences
  for each row
  execute function public.touch_user_table_preferences_updated_at();

alter table public.user_table_preferences enable row level security;

create policy user_table_preferences_owner_all on public.user_table_preferences for all using (
  user_id = auth.uid()
  and exists (
    select 1 from public.businesses b
    where b.id = user_table_preferences.business_id and b.owner_id = auth.uid()
  )
) with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.businesses b
    where b.id = user_table_preferences.business_id and b.owner_id = auth.uid()
  )
);

create table if not exists public.business_table_config (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  table_key text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, table_key)
);

comment on table public.business_table_config is
  'Business-wide (shared across every employee) table configuration — custom field definitions, renamed defaults, required fields. Distinct from user_table_preferences, which is per-user and never shared.';

create index if not exists business_table_config_lookup_idx
  on public.business_table_config (business_id, table_key);

create or replace function public.touch_business_table_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_business_table_config_updated_at on public.business_table_config;
create trigger trg_touch_business_table_config_updated_at
  before update on public.business_table_config
  for each row
  execute function public.touch_business_table_config_updated_at();

alter table public.business_table_config enable row level security;

create policy business_table_config_owner_all on public.business_table_config for all using (
  exists (
    select 1 from public.businesses b
    where b.id = business_table_config.business_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.businesses b
    where b.id = business_table_config.business_id and b.owner_id = auth.uid()
  )
);
