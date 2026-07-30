import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hubly = readFileSync(join(root, 'public/hubly.html'), 'utf8');
const journey = readFileSync(join(root, 'public/journey-os/journey.js'), 'utf8');
const store = readFileSync(join(root, 'public/journey-os/store-commerce.js'), 'utf8');
const css = readFileSync(join(root, 'public/journey-os/store-commerce.css'), 'utf8');

describe('Hubly Store commerce module', () => {
  it('adds Store nav between Memberships and Revenue', () => {
    const mem = hubly.indexOf('data-v="memberships"');
    const storeNav = hubly.indexOf('data-v="store"');
    const money = hubly.indexOf('data-v="money"');
    assert.ok(mem > -1 && storeNav > mem && money > storeNav);
    assert.match(hubly, /id="v-store"/);
    assert.match(hubly, /id="jos-store-root"/);
    assert.match(hubly, /store-commerce\.js\?v=store-4/);
    assert.match(hubly, /store-commerce\.css\?v=store-3/);
    assert.match(hubly, /store:'Store'/);
  });

  it('wires journey onSwitchView and chrome for store', () => {
    assert.match(journey, /store: \{ title: 'Store'/);
    assert.match(journey, /HublyStoreCommerce\.setMode\(v === 'store'\)/);
    assert.match(journey, /store: function \(\) \{/);
    assert.match(journey, /moduleAccess: \{[^}]*store: true/);
    assert.match(journey, /store: \{ label: 'Store AI'/);
  });

  it('exposes Commerce Engine tabs without Marketplace naming', () => {
    assert.match(store, /HublyStoreCommerce/);
    assert.match(store, /\['overview', 'Overview'\]/);
    assert.match(store, /\['products', 'Products'\]/);
    assert.match(store, /\['collections', 'Collections'\]/);
    assert.match(store, /\['bundles', 'Bundles'\]/);
    assert.match(store, /\['orders', 'Orders'\]/);
    assert.match(store, /\['inventory', 'Inventory'\]/);
    assert.match(store, /\['discounts', 'Discounts'\]/);
    assert.match(store, /hub-page-title">Commerce</);
    assert.doesNotMatch(store, /Online Store/);
    assert.doesNotMatch(store, /data-v="marketplace"/);
    assert.match(store, /ensureStoreOsState/);
    assert.match(store, /storeOs/);
    assert.match(store, /store-order-save/);
    assert.match(store, /persistStoreOs/);
    assert.match(store, /Do not invent demo catalog/);
  });

  it('styles Store like Jobs Operate chrome', () => {
    assert.match(css, /\.jos-store-mode/);
    assert.match(css, /\.jos-store-header/);
    assert.match(css, /\.jos-store-tab\.on/);
    assert.match(css, /#D9632D/);
    assert.match(css, /\.hub-storefront--website/);
  });

  it('loads store-commerce stylesheet with cache bust', () => {
    assert.match(hubly, /store-commerce\.css\?v=store-3/);
    assert.match(hubly, /store-commerce\.js\?v=store-4/);
  });

  it('embeds storefront into Instant Site and persists storeOs', () => {
    assert.match(hubly, /id="ws-sec-store"/);
    assert.match(hubly, /renderWsStoreSection/);
    assert.match(hubly, /websiteEmbed:\s*true/);
    assert.match(hubly, /storeOs:S\.storeOs/);
    assert.match(hubly, /if\(meta\.storeOs/);
    const sf = readFileSync(join(root, 'public/journey-os/commerce/storefront-renderer.js'), 'utf8');
    assert.match(sf, /websiteEmbed/);
    assert.match(sf, /hub-storefront--website/);
  });
});
