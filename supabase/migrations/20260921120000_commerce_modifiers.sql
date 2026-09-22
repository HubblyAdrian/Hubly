-- == COMMERCE MODIFIERS — A CONSTRAINED CHOICE APPLIED TO A LINE ==============================
--
-- A VARIANT is a sellable version of a Product: Small $14, Medium $17, Large $20. It has its own
-- price, sku and stock, and `commerce_product_variants` already carries it.
--
-- A MODIFIER is a constrained choice applied to a cart LINE: bacon +$2, rush service +$25, gift
-- wrap +$5. Three things separate it from a variant, and the existing model can express none of
-- them:
--
--   GROUPING      "Choose a sauce" is a group; bacon and ranch are not interchangeable
--   CONSTRAINTS   how many may be picked, and whether any must be
--   SELECTION     `commerce_cart_items` and `commerce_order_items` have NO column for a choice,
--                 so an order cannot record "no onions" today
--
-- THIS IS NOT A RESTAURANT FEATURE, and it must never be built as one. "Add bacon" is structurally
-- identical to a detailer's "add a wax", a printer's "upgrade the paper", a shop's "gift wrap".
-- There is no restaurant vocabulary anywhere in this file, and there must never be.
--
-- == WHY NOT REUSE `addons` ==================================================================
--
-- Measured 2026-09-21 (docs/PHASE1F_MODIFIER_DISCOVERY.md): the relational `public.addons` table
-- holds ZERO rows on ZERO businesses and was explicitly abandoned. The LIVING addon model is
-- `businesses.meta.service_catalog.addons` (4 businesses) — but that is the OFFERINGS store, held
-- as JSON, attached to a service by `HublyService.addon_ids`, and carrying `duration_delta_minutes`.
-- Putting Commerce product data there would be a second representation of one thing, which is the
-- two-stores disease this repo has already paid for once (SETTLED #2).
--
-- == min_select / max_select, AND NO `required` COLUMN ========================================
--
-- RULED BY ADRIAN, 2026-09-21: "Use min_select and max_select only. Do NOT store a separate
-- required boolean. Required is derived as min_select >= 1."
--
-- Three fields for two ideas invite a disagreement, and a disagreement here is either a customer
-- blocked from checking out or a required choice silently skipped. One source of truth:
--
--   optional, up to 3     min 0  max 3
--   required, exactly 1   min 1  max 1
--   required, 1 to 3      min 1  max 3
--
-- == THE UPPER BOUND ==========================================================================
--
-- `max_select <= 50` mirrors the only comparable bound Commerce already states: the 100-line cap in
-- computeAuthoritativeOrder. It exists so a malformed group cannot make a single line unbounded, and
-- 50 is far above any real group.
--
-- == LIFECYCLE ================================================================================
--
-- `status text check (status in ('active','archived'))` is `commerce_products`' own vocabulary minus
-- 'draft' — a modifier group has no unreviewed state to be in; it is attached or it is not. Default
-- 'active', because a group an owner just created and attached is meant to be pickable, and the
-- draft boundary that matters (is the PRODUCT live) already exists one level up.
--
-- == ADDITIVE, AND NOTHING IS BACKFILLED ======================================================
--
-- Three new tables and two new columns, both `jsonb not null default '[]'`. No existing column is
-- altered, no row is written, nothing is dropped. Every existing product keeps working with zero
-- modifier groups, and every existing cart and order line reads as "no selections" without being
-- touched. Measured before writing this: the entire live Commerce catalogue is 2 ARCHIVED products
-- on 1 business whose account_kind is TEST, 0 variants, 0 cart items, 2 pending test orders, and
-- ZERO market businesses with a product. There is no live customer exposure to backfill.

-- ─── Modifier groups ────────────────────────────────────────────────────────

create table if not exists public.commerce_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  min_select int not null default 0 check (min_select >= 0),
  max_select int not null default 1 check (max_select >= 1 and max_select <= 50),
  status text not null default 'active'
    check (status in ('active','archived')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The one cross-field rule, enforced by the database rather than by whoever writes next.
  constraint commerce_modifier_groups_span check (max_select >= min_select)
);

comment on table public.commerce_modifier_groups is
  'Generic Commerce modifier group — a constrained choice applied to a cart line. Required is DERIVED as min_select >= 1; there is deliberately no required column. Not restaurant-specific.';

create index if not exists commerce_modifier_groups_business_idx
  on public.commerce_modifier_groups (business_id, sort_order);

-- ─── Modifier options ───────────────────────────────────────────────────────
--
-- `business_id` is denormalised here exactly as `commerce_collection_products` denormalises it:
-- it is what the RLS policy and every server-side scope check read, and reaching it through the
-- group on every query would make the cheapest safety check the most expensive one.
--
-- `price_adjustment_cents` is SIGNED on purpose. "No cheese −$1" is the same field as "bacon +$2",
-- and a check constraint forbidding it would buy nothing.

create table if not exists public.commerce_modifier_options (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  modifier_group_id uuid not null references public.commerce_modifier_groups(id) on delete cascade,
  name text not null,
  price_adjustment_cents int not null default 0,
  status text not null default 'active'
    check (status in ('active','archived')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.commerce_modifier_options is
  'One pickable option inside a commerce_modifier_group. price_adjustment_cents is server-owned and signed; a client never supplies it.';

create index if not exists commerce_modifier_options_group_idx
  on public.commerce_modifier_options (modifier_group_id, sort_order);
create index if not exists commerce_modifier_options_business_idx
  on public.commerce_modifier_options (business_id);

-- ─── Product ↔ modifier group ───────────────────────────────────────────────
--
-- This is `commerce_collection_products` copied: same composite primary key (which is what makes a
-- duplicate attachment impossible rather than merely unlikely), same denormalised business_id, same
-- sort_order. That table already works and its ordering already survives the public read.
--
-- Many-to-many on purpose: "Gift Wrap +$5" is defined once and attached to forty products.

create table if not exists public.commerce_product_modifier_groups (
  product_id uuid not null references public.commerce_products(id) on delete cascade,
  modifier_group_id uuid not null references public.commerce_modifier_groups(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  primary key (product_id, modifier_group_id)
);

comment on table public.commerce_product_modifier_groups is
  'Attaches a modifier group to a product. Shape copied from commerce_collection_products; the composite PK is what makes a duplicate attachment impossible.';

create index if not exists commerce_product_modifier_groups_group_idx
  on public.commerce_product_modifier_groups (modifier_group_id);
create index if not exists commerce_product_modifier_groups_business_idx
  on public.commerce_product_modifier_groups (business_id, product_id, sort_order);

-- ─── The selection, on the line ─────────────────────────────────────────────
--
-- TWO COLUMNS, TWO DIFFERENT JOBS, AND THEY ARE NOT THE SAME SHAPE.
--
-- CART — identity only. An array of option ids:
--     ["b1f…", "c04…"]
--   The server re-resolves the name and the price on every read anyway, so storing either here
--   would create a second copy that can disagree with the first. Ids, sorted, nothing else.
--
-- ORDER — the immutable snapshot, and it must stay readable when the modifier is gone:
--     [{"group_id":…,"group_name":"Extras","option_id":…,"option_name":"Rush Service",
--       "price_adjustment_cents":2500}]
--   `commerce_order_items` is ALREADY the snapshot layer — title, sku and unit_price_cents are
--   frozen there for exactly this reason. A rename, a reprice, an archive or a delete must not be
--   able to rewrite what someone bought, so the names and the money are frozen beside the ids.
--   The ids stay for traceability; they are not what makes the row readable.

alter table public.commerce_cart_items
  add column if not exists selected_modifiers jsonb not null default '[]'::jsonb;

comment on column public.commerce_cart_items.selected_modifiers is
  'Canonical array of commerce_modifier_options.id, sorted. IDENTITY ONLY — never a name, never a price. The server resolves the real rows on every read.';

alter table public.commerce_order_items
  add column if not exists selected_modifiers jsonb not null default '[]'::jsonb;

comment on column public.commerce_order_items.selected_modifiers is
  'IMMUTABLE snapshot of what was bought: [{group_id, group_name, option_id, option_name, price_adjustment_cents}]. Historical source of truth — never reconstructed from the live modifier tables.';

-- ─── RLS ────────────────────────────────────────────────────────────────────
--
-- The owner policy is the same one every other commerce_* table carries, generated by the same
-- loop shape as 20260729120000_commerce_engine.sql so the three new tables cannot drift from the
-- eighteen existing ones.

alter table public.commerce_modifier_groups enable row level security;
alter table public.commerce_modifier_options enable row level security;
alter table public.commerce_product_modifier_groups enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'commerce_modifier_groups',
    'commerce_modifier_options',
    'commerce_product_modifier_groups'
  ]
  loop
    execute format('drop policy if exists %I_owner_all on public.%I', t, t);
    execute format($f$
      create policy %I_owner_all on public.%I
        for all using (
          business_id in (select id from public.businesses where owner_id = auth.uid())
        )
        with check (
          business_id in (select id from public.businesses where owner_id = auth.uid())
        )
    $f$, t, t);
  end loop;
end $$;

-- Public read of ACTIVE modifier data, mirroring commerce_products_public_read. The storefront
-- read in commerce-api uses the service role and does not depend on these, but a table that is
-- readable by the owner and by nobody else would be the wrong default the first time anything
-- anonymous needs it — and `status = 'active'` is the same gate the rest of the catalog states.
drop policy if exists commerce_modifier_groups_public_read on public.commerce_modifier_groups;
create policy commerce_modifier_groups_public_read on public.commerce_modifier_groups
  for select using (status = 'active');

drop policy if exists commerce_modifier_options_public_read on public.commerce_modifier_options;
create policy commerce_modifier_options_public_read on public.commerce_modifier_options
  for select using (status = 'active');

drop policy if exists commerce_product_modifier_groups_public_read on public.commerce_product_modifier_groups;
create policy commerce_product_modifier_groups_public_read on public.commerce_product_modifier_groups
  for select using (true);
