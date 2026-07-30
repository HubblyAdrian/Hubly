/**
 * Hubly Commerce Runtime — single shared engine for sellable catalog.
 *
 * Storefront editor = presentation only (layout, branding, nav, sections, colors).
 * Business data (products, services-as-products, collections, orders, discounts…)
 * lives here and connects to Business Context, Customers, Media, Studio, Analytics, AI.
 *
 * Filter: partner experience, not a standalone storefront SaaS module.
 */
(function (global) {
  'use strict';

  var CAPABILITIES = Object.freeze({
    products: true,
    services: true, // sellable service SKUs in commerce (booking packages stay Service Engine)
    collections: true,
    categories: true,
    orders: true,
    customers: true, // via Customer Engine refs
    discounts: true,
    gift_cards: 'architecture_ready',
    digital_downloads: 'architecture_ready',
    print_sales: 'architecture_ready',
  });

  function S() {
    return global.S || (global.S = {});
  }

  function ensureLocalCache() {
    var st = S();
    if (!st.storeOs || typeof st.storeOs !== 'object') st.storeOs = {};
    var os = st.storeOs;
    if (!Array.isArray(os.products)) os.products = [];
    if (!Array.isArray(os.collections)) os.collections = [];
    if (!Array.isArray(os.categories)) os.categories = [];
    if (!Array.isArray(os.orders)) os.orders = [];
    if (!Array.isArray(os.discounts)) os.discounts = [];
    if (!Array.isArray(os.giftCards)) os.giftCards = [];
    if (!Array.isArray(os.digitalAssets)) os.digitalAssets = [];
    if (!Array.isArray(os.printSkus)) os.printSkus = [];
    if (!os.presentation || typeof os.presentation !== 'object') {
      os.presentation = {
        layout: 'grid',
        branding: {},
        navigation: ['Shop', 'Collections', 'About'],
        sections: ['hero', 'featured', 'collections', 'trust'],
        colors: { brand: '#D9632D', ink: '#141B2B' },
      };
    }
    return os;
  }

  function capabilityStatus(key) {
    var v = CAPABILITIES[key];
    if (v === true) return { ready: true, status: 'live' };
    if (v === 'architecture_ready') {
      return {
        ready: false,
        status: 'architecture_ready',
        message: 'Architecture ready — provider / executor not wired yet (fail honestly).',
      };
    }
    return { ready: false, status: 'missing' };
  }

  async function syncFromApi() {
    var Api = global.HublyCommerceApi;
    var os = ensureLocalCache();
    if (!Api || typeof Api.listProducts !== 'function') {
      return { ok: false, error: 'not_configured', cache: os };
    }
    try {
      var products = await Api.listProducts();
      var collections = await Api.listCollections();
      var orders = Api.listOrders ? await Api.listOrders() : { ok: false };
      if (products.ok && products.data) {
        var rows = products.data.products || products.data.items || products.data || [];
        if (Array.isArray(rows)) {
          var Types = global.HublyCommerceTypes;
          os.products = rows.map(function (r) {
            return Types && Types.productFromRow ? Types.productFromRow(r) : r;
          }).filter(Boolean);
        }
      }
      if (collections.ok && collections.data) {
        var cols = collections.data.collections || collections.data.items || collections.data || [];
        if (Array.isArray(cols)) os.collections = cols;
      }
      if (orders && orders.ok && orders.data) {
        var orows = orders.data.orders || orders.data.items || orders.data || [];
        if (Array.isArray(orows)) os.orders = orows;
      }
      os._syncedAt = new Date().toISOString();
      return { ok: true, cache: os, source: 'commerce-api' };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e), cache: os };
    }
  }

  async function upsertProduct(product) {
    var Api = global.HublyCommerceApi;
    var os = ensureLocalCache();
    if (Api && typeof Api.createProduct === 'function' && !product.id) {
      var created = await Api.createProduct(product);
      if (created.ok) {
        await syncFromApi();
        return created;
      }
      /* fall through to local cache — honest dual-write until SSOT complete */
    }
    if (Api && product.id && typeof Api.updateProduct === 'function') {
      var updated = await Api.updateProduct(product.id, product);
      if (updated.ok) {
        await syncFromApi();
        return updated;
      }
    }
    if (!product.id) product.id = 'local_' + Math.random().toString(36).slice(2, 9);
    var idx = os.products.findIndex(function (p) { return p.id === product.id; });
    if (idx >= 0) os.products[idx] = Object.assign({}, os.products[idx], product);
    else os.products.push(product);
    return { ok: true, data: product, source: 'local_cache' };
  }

  /** Live Workspace HTML — commerce as Hubly surface, not a separate app. */
  function workspaceHtml(opts) {
    opts = opts || {};
    var os = ensureLocalCache();
    var mode = opts.mode || 'storefront';
    var Types = global.HublyCommerceTypes;
    var esc = function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    if (mode === 'products' || mode === 'editor') {
      var list = (os.products || []).slice(0, 8).map(function (p) {
        return '<div class="aw-chip' + (p.status === 'active' ? ' is-on' : '') + '">' +
          esc(p.name || 'Untitled') + ' · ' + esc(String(p.price != null ? p.price : '—')) +
          '</div>';
      }).join('');
      return (
        '<div class="aw-surface-panel" data-commerce-runtime="products">' +
        '<h2>Product editor</h2>' +
        '<p>Shared Commerce Runtime — retailers, photographers, creators, and service businesses use the same catalog.</p>' +
        '<div class="aw-chips">' + (list || '<span class="aw-chip is-on">Ready for your first product</span>') + '</div>' +
        '<div class="aw-chips" style="margin-top:10px">' +
        '<span class="aw-chip">Collections</span><span class="aw-chip">Categories</span>' +
        '<span class="aw-chip">Gift Cards · arch</span><span class="aw-chip">Digital · arch</span>' +
        '<span class="aw-chip">Print · arch</span></div></div>'
      );
    }

    if (mode === 'storefront' || mode === 'commerce') {
      var Sf = global.HublyCommerceStorefront;
      if (Sf && typeof Sf.renderPreviewFragment === 'function') {
        return Sf.renderPreviewFragment({ storeOs: os });
      }
      var title = (os.settings && os.settings.heroTitle) || (S().biz || 'Your storefront');
      return (
        '<div class="aw-surface-panel" data-commerce-runtime="storefront">' +
        '<h2>' + esc(title) + '</h2>' +
        '<p>Presentation only in the storefront editor. Catalog, orders, and discounts come from Commerce Runtime.</p>' +
        '<div class="aw-chips"><span class="aw-chip is-on">' + esc(String((os.products || []).length)) + ' products</span>' +
        '<span class="aw-chip">' + esc(String((os.collections || []).length)) + ' collections</span>' +
        '<span class="aw-chip">' + esc(String((os.orders || []).length)) + ' orders</span></div></div>'
      );
    }

    return '<div class="aw-surface-panel"><h2>Commerce</h2><p>Shared Hubly Commerce Runtime.</p></div>';
  }

  var api = {
    version: '1.0.0',
    capabilities: CAPABILITIES,
    capabilityStatus: capabilityStatus,
    ensureLocalCache: ensureLocalCache,
    syncFromApi: syncFromApi,
    upsertProduct: upsertProduct,
    workspaceHtml: workspaceHtml,
  };

  global.HublyCommerceRuntime = api;
  if (global.HublyCommerce) {
    global.HublyCommerce.runtime = function () { return api; };
    global.HublyCommerce.capabilities = CAPABILITIES;
  }
})(typeof window !== 'undefined' ? window : globalThis);
