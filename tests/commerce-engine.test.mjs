import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hubly = readFileSync(join(root, 'public/hubly.html'), 'utf8');
const store = readFileSync(join(root, 'public/journey-os/store-commerce.js'), 'utf8');
const events = readFileSync(join(root, 'public/journey-os/hubly-events.js'), 'utf8');
const migration = readFileSync(join(root, 'supabase/migrations/20260729120000_commerce_engine.sql'), 'utf8');
const commerceApi = readFileSync(join(root, 'supabase/functions/commerce-api/index.ts'), 'utf8');
const checkout = readFileSync(join(root, 'supabase/functions/create-store-checkout/index.ts'), 'utf8');
const webhook = readFileSync(join(root, 'supabase/functions/stripe-webhook/index.ts'), 'utf8');
const shipping = readFileSync(join(root, 'supabase/functions/_shared/hubly_provider_shipping.ts'), 'utf8');
const inventory = readFileSync(join(root, 'supabase/functions/_shared/hubly_commerce_inventory.ts'), 'utf8');
const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8');

describe('Commerce Engine foundation', () => {
  it('ships modular public/journey-os/commerce (not React /src)', () => {
    const files = [
      'public/journey-os/commerce/index.js',
      'public/journey-os/commerce/types.js',
      'public/journey-os/commerce/api.js',
      'public/journey-os/commerce/events.js',
      'public/journey-os/commerce/permissions.js',
      'public/journey-os/commerce/components.js',
      'public/journey-os/commerce/storefront-renderer.js',
      'public/journey-os/commerce/checkout/checkout.service.js',
      'public/journey-os/commerce/ai/product-coach.js',
      'public/journey-os/commerce/ai/merchandising.js',
      'docs/operate/COMMERCE_ENGINE.md'
    ];
    files.forEach((f) => assert.ok(existsSync(join(root, f)), f));
    assert.match(hubly, /commerce\/index\.js\?v=commerce-1/);
    assert.match(hubly, /store-commerce\.js\?v=store-2/);
  });

  it('migration is business-scoped with core commerce tables', () => {
    [
      'commerce_products',
      'commerce_product_images',
      'commerce_product_variants',
      'commerce_collections',
      'commerce_collection_products',
      'commerce_bundles',
      'commerce_bundle_products',
      'commerce_orders',
      'commerce_order_items',
      'commerce_carts',
      'commerce_cart_items',
      'commerce_discounts',
      'commerce_gift_cards',
      'commerce_inventory_logs',
      'commerce_shipping_profiles',
      'commerce_store_settings',
      'commerce_documents',
      'website_pages'
    ].forEach((t) => assert.match(migration, new RegExp(t)));
    assert.match(migration, /business_id/);
    assert.match(migration, /customerPortal/);
    assert.match(migration, /page_type in \('home','services','about','contact','store','custom'\)/);
  });

  it('exposes Store tabs including Overview and Bundles', () => {
    assert.match(store, /\['overview', 'Overview'\]/);
    assert.match(store, /\['bundles', 'Bundles'\]/);
    assert.match(store, /\['analytics', 'Analytics'\]/);
    assert.match(store, /\['ai', 'AI'\]/);
    assert.match(store, /\['settings', 'Settings'\]/);
    assert.match(store, /Live preview/);
    assert.match(store, /Generate with AI/);
    assert.match(store, /HublyCommerceStorefront/);
  });

  it('registers commerce domain events', () => {
    assert.match(events, /PRODUCT_CREATED: 'product\.created'/);
    assert.match(events, /ORDER_PAID: 'order\.paid'/);
    assert.match(events, /INVENTORY_CHANGED: 'inventory\.changed'/);
    assert.match(events, /BUNDLE_CREATED: 'bundle\.created'/);
  });

  it('wires Stripe checkout + webhook inventory path', () => {
    assert.match(checkout, /hubly_commerce_order_id/);
    assert.match(checkout, /createDestinationCheckout/);
    assert.match(webhook, /commerce_orders/);
    assert.match(webhook, /applyOrderInventoryDeduction/);
    assert.match(webhook, /payment_intent\.succeeded/);
    assert.match(webhook, /charge\.refunded/);
    assert.match(inventory, /commerce_inventory_logs/);
    assert.match(shipping, /ShippingProvider/);
    assert.match(shipping, /pickup/);
    assert.match(config, /create-store-checkout/);
    assert.match(config, /commerce-api/);
    assert.match(config, /commerce-merchandising/);
  });

  it('commerce-api covers products collections bundles cart orders import', () => {
    assert.match(commerceApi, /resource === "products"/);
    assert.match(commerceApi, /id === "import"/);
    assert.match(commerceApi, /resource === "collections"/);
    assert.match(commerceApi, /resource === "bundles"/);
    assert.match(commerceApi, /resource === "cart"/);
    assert.match(commerceApi, /action === "merge"/);
    assert.match(commerceApi, /sub === "refund"/);
  });
});
