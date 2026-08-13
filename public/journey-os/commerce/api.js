/**
 * Commerce API client — Edge Functions commerce-api + create-store-checkout.
 */
(function (global) {
  'use strict';

  function supabaseUrl() {
    try {
      if (global.HublySupabase && global.HublySupabase.url) return String(global.HublySupabase.url).replace(/\/$/, '');
    } catch (e) {}
    return '';
  }

  function authHeaders() {
    var h = { 'content-type': 'application/json' };
    try {
      var session = global.HublySupabase && global.HublySupabase.session;
      var token = session && (session.access_token || session.accessToken);
      if (token) h.Authorization = 'Bearer ' + token;
      var anon = global.HublySupabase && (global.HublySupabase.anonKey || global.HublySupabase.key);
      if (anon) h.apikey = anon;
    } catch (e) {}
    return h;
  }

  function businessId() {
    var S = global.S || {};
    return S.businessId || S.bizId || S.business_id || '';
  }

  async function call(path, opts) {
    var base = supabaseUrl();
    if (!base) {
      return { ok: false, error: 'not_configured', message: 'Supabase not configured' };
    }
    var method = (opts && opts.method) || 'GET';
    var body = opts && opts.body;
    var url = base + '/functions/v1/commerce-api' + path;
    var res = await fetch(url, {
      method: method,
      headers: authHeaders(),
      body: body != null ? JSON.stringify(body) : undefined
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.error || data.code || 'request_failed',
        message: data.message || data.error || res.statusText,
        data: data
      };
    }
    return { ok: true, data: data, status: res.status };
  }

  function withBiz(extra) {
    return Object.assign({ business_id: businessId() }, extra || {});
  }

  var api = {
    listProducts: function () {
      return call('/products?business_id=' + encodeURIComponent(businessId()), { method: 'GET' });
    },
    createProduct: function (product) {
      return call('/products', { method: 'POST', body: withBiz(product) });
    },
    updateProduct: function (id, patch) {
      return call('/products/' + encodeURIComponent(id), { method: 'PATCH', body: withBiz(patch) });
    },
    deleteProduct: function (id) {
      return call('/products/' + encodeURIComponent(id), { method: 'DELETE', body: withBiz() });
    },
    getProductBySlug: function (slug, biz) {
      var b = biz || businessId();
      return call('/products/by-slug/' + encodeURIComponent(slug) + '?business_id=' + encodeURIComponent(b), { method: 'GET' });
    },
    duplicateProduct: function (productId) {
      return call('/products/duplicate', { method: 'POST', body: withBiz({ product_id: productId }) });
    },
    importProducts: function (rows) {
      return call('/products/import', { method: 'POST', body: withBiz({ rows: rows }) });
    },
    listCollections: function () {
      return call('/collections?business_id=' + encodeURIComponent(businessId()), { method: 'GET' });
    },
    createCollection: function (col) {
      return call('/collections', { method: 'POST', body: withBiz(col) });
    },
    updateCollection: function (id, patch) {
      return call('/collections/' + encodeURIComponent(id), { method: 'PATCH', body: withBiz(patch) });
    },
    deleteCollection: function (id) {
      return call('/collections/' + encodeURIComponent(id), { method: 'DELETE', body: withBiz() });
    },
    setCollectionProducts: function (id, productIds) {
      return call('/collections/' + encodeURIComponent(id) + '/products', {
        method: 'POST',
        body: withBiz({ product_ids: productIds })
      });
    },
    listBundles: function () {
      return call('/bundles?business_id=' + encodeURIComponent(businessId()), { method: 'GET' });
    },
    createBundle: function (bundle) {
      return call('/bundles', { method: 'POST', body: withBiz(bundle) });
    },
    updateBundle: function (id, patch) {
      return call('/bundles/' + encodeURIComponent(id), { method: 'PATCH', body: withBiz(patch) });
    },
    deleteBundle: function (id) {
      return call('/bundles/' + encodeURIComponent(id), { method: 'DELETE', body: withBiz() });
    },
    listOrders: function () {
      return call('/orders?business_id=' + encodeURIComponent(businessId()), { method: 'GET' });
    },
    getOrder: function (id) {
      return call('/orders/' + encodeURIComponent(id) + '?business_id=' + encodeURIComponent(businessId()), { method: 'GET' });
    },
    updateOrder: function (id, patch) {
      return call('/orders/' + encodeURIComponent(id), { method: 'PATCH', body: withBiz(patch) });
    },
    refundOrder: function (id) {
      return call('/orders/' + encodeURIComponent(id) + '/refund', { method: 'POST', body: withBiz() });
    },
    getCart: function (opts) {
      return call('/cart?business_id=' + encodeURIComponent(businessId()), {
        method: 'POST',
        body: withBiz(Object.assign({ action: 'get' }, opts || {}))
      });
    },
    addToCart: function (opts) {
      return call('/cart', { method: 'POST', body: withBiz(Object.assign({ action: 'add' }, opts || {})) });
    },
    updateCartItem: function (itemId, qty) {
      return call('/cart/' + encodeURIComponent(itemId), { method: 'PATCH', body: withBiz({ qty: qty }) });
    },
    removeCartItem: function (itemId) {
      return call('/cart/' + encodeURIComponent(itemId), { method: 'DELETE', body: withBiz() });
    },
    mergeCart: function (guestToken, customerId) {
      return call('/cart', {
        method: 'POST',
        body: withBiz({ action: 'merge', guest_token: guestToken, customer_id: customerId })
      });
    },
    quoteShipping: function (opts) {
      return call('/shipping/quote', { method: 'POST', body: withBiz(opts || {}) });
    },
    // Product images
    listProductImages: function (productId) {
      return call('/products/' + encodeURIComponent(productId) + '/images?business_id=' + encodeURIComponent(businessId()), { method: 'GET' });
    },
    addProductImage: function (productId, image) {
      return call('/products/' + encodeURIComponent(productId) + '/images', { method: 'POST', body: withBiz(image || {}) });
    },
    updateProductImage: function (imageId, patch) {
      return call('/images/' + encodeURIComponent(imageId), { method: 'PATCH', body: withBiz(patch || {}) });
    },
    removeProductImage: function (imageId) {
      return call('/images/' + encodeURIComponent(imageId), { method: 'DELETE', body: withBiz() });
    },
    // Store settings (commerce_store_settings — canonical Store config, PK business_id)
    getStoreSettings: function () {
      return call('/settings?business_id=' + encodeURIComponent(businessId()), { method: 'GET' });
    },
    updateStoreSettings: function (patch) {
      return call('/settings', { method: 'PATCH', body: withBiz(patch || {}) });
    },
    /** Stripe Checkout Session — fails honestly when Connect not ready. */
    createCheckout: async function (opts) {
      var base = supabaseUrl();
      if (!base) return { ok: false, error: 'not_configured', message: 'Provider not configured' };
      var res = await fetch(base + '/functions/v1/create-store-checkout', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(withBiz(opts || {}))
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: data.code || data.error || 'checkout_failed',
          message: data.message || data.error || 'Checkout failed',
          data: data
        };
      }
      return { ok: true, data: data };
    }
  };

  global.HublyCommerceApi = api;
})(typeof window !== 'undefined' ? window : globalThis);
