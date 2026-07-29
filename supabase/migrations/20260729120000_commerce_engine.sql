-- Commerce Engine — products, collections, bundles, cart, orders, inventory, discounts, shipping.
-- Everything is business-scoped. Store owns product catalog + product orders.
-- Payments/Stripe ledger stays with Revenue (Rule #15). Customers stay with Customers.

-- ─── Store settings ─────────────────────────────────────────────────────────

create table if not exists public.commerce_store_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  enabled boolean not null default true,
  currency text not null default 'usd',
  store_path text not null default '/store',
  hero_title text,
  hero_subtitle text,
  theme jsonb not null default '{}'::jsonb,
  shipping_defaults jsonb not null default '{"modes":["pickup","flat_rate","local_delivery","free"]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.commerce_store_settings is
  'Per-business Store / Commerce Engine settings. Independent of Website service catalog.';

-- ─── Products ───────────────────────────────────────────────────────────────

create table if not exists public.commerce_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  short_description text not null default '',
  price_cents int not null default 0 check (price_cents >= 0),
  compare_at_cents int check (compare_at_cents is null or compare_at_cents >= 0),
  cost_cents int check (cost_cents is null or cost_cents >= 0),
  sku text,
  barcode text,
  status text not null default 'draft'
    check (status in ('draft','active','archived')),
  product_type text not null default 'physical'
    check (product_type in ('physical','digital','gift_card','service_addon')),
  inventory int,
  track_inventory boolean not null default true,
  low_stock_at int not null default 5,
  weight_grams int,
  brand text,
  featured boolean not null default false,
  seo jsonb not null default '{}'::jsonb,
  visibility jsonb not null default jsonb_build_object(
    'website', true,
    'booking', true,
    'customerPortal', true,
    'quoteBuilder', true,
    'email', true,
    'memberships', false
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug)
);

create index if not exists commerce_products_business_idx
  on public.commerce_products (business_id);
create index if not exists commerce_products_status_idx
  on public.commerce_products (business_id, status);
create index if not exists commerce_products_sku_idx
  on public.commerce_products (business_id, sku);

create table if not exists public.commerce_product_images (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.commerce_products(id) on delete cascade,
  url text not null,
  alt text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists commerce_product_images_product_idx
  on public.commerce_product_images (product_id);

create table if not exists public.commerce_product_variants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.commerce_products(id) on delete cascade,
  name text not null,
  sku text,
  price_cents int,
  inventory int,
  options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commerce_product_variants_product_idx
  on public.commerce_product_variants (product_id);

-- ─── Collections ──────────────────────────────────────────────────────────

create table if not exists public.commerce_collections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug)
);

create table if not exists public.commerce_collection_products (
  collection_id uuid not null references public.commerce_collections(id) on delete cascade,
  product_id uuid not null references public.commerce_products(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  sort_order int not null default 0,
  primary key (collection_id, product_id)
);

-- ─── Bundles ──────────────────────────────────────────────────────────────

create table if not exists public.commerce_bundles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  slug text not null,
  description text not null default '',
  price_cents int not null default 0 check (price_cents >= 0),
  discount_cents int not null default 0 check (discount_cents >= 0),
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug)
);

create table if not exists public.commerce_bundle_products (
  bundle_id uuid not null references public.commerce_bundles(id) on delete cascade,
  product_id uuid not null references public.commerce_products(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  qty int not null default 1 check (qty > 0),
  primary key (bundle_id, product_id)
);

-- ─── Cart (customer-owned when logged in; guest token when not) ────────────

create table if not exists public.commerce_carts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid,
  guest_token text,
  status text not null default 'open' check (status in ('open','converted','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commerce_carts_business_customer_idx
  on public.commerce_carts (business_id, customer_id);
create index if not exists commerce_carts_guest_idx
  on public.commerce_carts (business_id, guest_token);

create table if not exists public.commerce_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.commerce_carts(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.commerce_products(id) on delete set null,
  variant_id uuid references public.commerce_product_variants(id) on delete set null,
  bundle_id uuid references public.commerce_bundles(id) on delete set null,
  title text not null,
  qty int not null default 1 check (qty > 0),
  unit_price_cents int not null default 0 check (unit_price_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commerce_cart_items_cart_idx
  on public.commerce_cart_items (cart_id);

-- ─── Orders ───────────────────────────────────────────────────────────────

create table if not exists public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid,
  order_number text not null,
  status text not null default 'pending'
    check (status in ('pending','paid','packed','ready','shipped','delivered','refunded','cancelled')),
  fulfillment text not null default 'unfulfilled'
    check (fulfillment in ('unfulfilled','packed','ready','shipped','delivered','digital','pickup','cancelled')),
  channel text not null default 'website',
  currency text not null default 'usd',
  subtotal_cents int not null default 0,
  discount_cents int not null default 0,
  shipping_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int not null default 0,
  shipping_method text,
  customer_name text,
  customer_email text,
  customer_phone text,
  shipping_address jsonb not null default '{}'::jsonb,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  discount_code text,
  notes text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, order_number)
);

create index if not exists commerce_orders_business_idx
  on public.commerce_orders (business_id, created_at desc);
create index if not exists commerce_orders_customer_idx
  on public.commerce_orders (business_id, customer_id);
create index if not exists commerce_orders_stripe_session_idx
  on public.commerce_orders (stripe_checkout_session_id);

create table if not exists public.commerce_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid,
  variant_id uuid,
  bundle_id uuid,
  title text not null,
  sku text,
  qty int not null default 1 check (qty > 0),
  unit_price_cents int not null default 0,
  total_cents int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists commerce_order_items_order_idx
  on public.commerce_order_items (order_id);

-- ─── Discounts / gift cards ───────────────────────────────────────────────

create table if not exists public.commerce_discounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  discount_type text not null check (discount_type in ('percent','fixed')),
  value numeric not null check (value >= 0),
  status text not null default 'active'
    check (status in ('active','scheduled','expired','disabled')),
  uses int not null default 0,
  usage_limit int,
  applies_to text not null default 'all',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

create table if not exists public.commerce_gift_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  initial_cents int not null check (initial_cents >= 0),
  balance_cents int not null check (balance_cents >= 0),
  customer_id uuid,
  status text not null default 'active' check (status in ('active','redeemed','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

-- ─── Inventory logs ───────────────────────────────────────────────────────

create table if not exists public.commerce_inventory_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.commerce_products(id) on delete cascade,
  variant_id uuid references public.commerce_product_variants(id) on delete set null,
  before_qty int,
  after_qty int,
  delta int not null,
  reason text not null,
  order_id uuid references public.commerce_orders(id) on delete set null,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists commerce_inventory_logs_product_idx
  on public.commerce_inventory_logs (product_id, created_at desc);

-- ─── Shipping profiles ────────────────────────────────────────────────────

create table if not exists public.commerce_shipping_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  mode text not null
    check (mode in ('pickup','flat_rate','local_delivery','free')),
  rate_cents int not null default 0 check (rate_cents >= 0),
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commerce_shipping_profiles_business_idx
  on public.commerce_shipping_profiles (business_id);

-- ─── Knowledge docs (AI product coach) ────────────────────────────────────

create table if not exists public.commerce_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.commerce_products(id) on delete set null,
  title text not null,
  source_type text not null
    check (source_type in ('pdf','docx','image','markdown','url','text')),
  source_url text,
  body_text text not null default '',
  embedding jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commerce_documents_business_idx
  on public.commerce_documents (business_id);

-- ─── Merchandising recommendations ────────────────────────────────────────

create table if not exists public.commerce_merchandising_recs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.commerce_products(id) on delete cascade,
  kind text not null,
  title text not null,
  detail text not null default '',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','accepted','dismissed')),
  created_at timestamptz not null default now()
);

-- ─── updated_at triggers ──────────────────────────────────────────────────

create or replace function public.touch_commerce_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'commerce_store_settings',
    'commerce_products',
    'commerce_product_variants',
    'commerce_collections',
    'commerce_bundles',
    'commerce_carts',
    'commerce_cart_items',
    'commerce_orders',
    'commerce_discounts',
    'commerce_gift_cards',
    'commerce_shipping_profiles',
    'commerce_documents'
  ]
  loop
    execute format('drop trigger if exists trg_touch_%s on public.%I', t, t);
    execute format(
      'create trigger trg_touch_%s before update on public.%I for each row execute function public.touch_commerce_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ─── RLS ──────────────────────────────────────────────────────────────────

alter table public.commerce_store_settings enable row level security;
alter table public.commerce_products enable row level security;
alter table public.commerce_product_images enable row level security;
alter table public.commerce_product_variants enable row level security;
alter table public.commerce_collections enable row level security;
alter table public.commerce_collection_products enable row level security;
alter table public.commerce_bundles enable row level security;
alter table public.commerce_bundle_products enable row level security;
alter table public.commerce_carts enable row level security;
alter table public.commerce_cart_items enable row level security;
alter table public.commerce_orders enable row level security;
alter table public.commerce_order_items enable row level security;
alter table public.commerce_discounts enable row level security;
alter table public.commerce_gift_cards enable row level security;
alter table public.commerce_inventory_logs enable row level security;
alter table public.commerce_shipping_profiles enable row level security;
alter table public.commerce_documents enable row level security;
alter table public.commerce_merchandising_recs enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'commerce_store_settings',
    'commerce_products',
    'commerce_product_images',
    'commerce_product_variants',
    'commerce_collections',
    'commerce_collection_products',
    'commerce_bundles',
    'commerce_bundle_products',
    'commerce_carts',
    'commerce_cart_items',
    'commerce_orders',
    'commerce_order_items',
    'commerce_discounts',
    'commerce_gift_cards',
    'commerce_inventory_logs',
    'commerce_shipping_profiles',
    'commerce_documents',
    'commerce_merchandising_recs'
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

-- Public read of active products for Instant Site /store (anon can select active only)
drop policy if exists commerce_products_public_read on public.commerce_products;
create policy commerce_products_public_read on public.commerce_products
  for select using (
    status = 'active'
    and coalesce((visibility->>'website')::boolean, true) = true
  );

drop policy if exists commerce_collections_public_read on public.commerce_collections;
create policy commerce_collections_public_read on public.commerce_collections
  for select using (published = true);

drop policy if exists commerce_bundles_public_read on public.commerce_bundles;
create policy commerce_bundles_public_read on public.commerce_bundles
  for select using (status = 'active');

-- Website Engine page registry — /store is rendered from Commerce, not a separate deploy
create table if not exists public.website_pages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  path text not null,
  page_type text not null default 'custom'
    check (page_type in ('home','services','about','contact','store','custom')),
  title text not null default '',
  published boolean not null default true,
  source_engine text not null default 'website'
    check (source_engine in ('website','commerce','booking')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, path)
);

create index if not exists website_pages_business_idx
  on public.website_pages (business_id);

comment on table public.website_pages is
  'Website Engine pages. page_type=store + source_engine=commerce → Commerce storefront renderer.';

alter table public.website_pages enable row level security;

drop policy if exists website_pages_owner_all on public.website_pages;
create policy website_pages_owner_all on public.website_pages
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  )
  with check (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists website_pages_public_read on public.website_pages;
create policy website_pages_public_read on public.website_pages
  for select using (published = true);
