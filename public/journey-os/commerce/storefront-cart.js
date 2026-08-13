/**
 * Public Storefront guest cart (Storefront Phase 3).
 *
 * The cart lives in localStorage (no anonymous persistent cart-table writes). It stores only
 * product/variant IDs + quantities (plus name/price for display); prices are NEVER trusted by
 * the server. Checkout sends line_items = [{product_id, variant_id?, qty}] to
 * create-store-checkout, which reloads the real Commerce data and computes the authoritative
 * order. On Stripe success we clear the cart and show a confirmation. Never touches S.storeOs.
 */
(function (global) {
  'use strict';

  var KEY_PREFIX = 'hubly_store_cart_';
  var state = { businessId: null, mount: null, drawerOpen: false };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money(n) {
    var v = Number(n) || 0;
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v); }
    catch (e) { return '$' + Math.round(v); }
  }
  function key() { return KEY_PREFIX + (state.businessId || 'x'); }
  function read() { try { return JSON.parse(global.localStorage.getItem(key()) || '[]') || []; } catch (e) { return []; } }
  function persist(items) { try { global.localStorage.setItem(key(), JSON.stringify(items)); } catch (e) {} }
  function lineKey(pid, vid) { return String(pid) + '::' + (vid || ''); }

  function items() { return read(); }
  function count() { return read().reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0); }
  function subtotal() { return read().reduce(function (s, i) { return s + ((Number(i.price) || 0) * (Number(i.qty) || 0)); }, 0); }

  function add(item) {
    if (!item || !item.productId) return;
    var its = read();
    var k = lineKey(item.productId, item.variantId);
    var ex = its.filter(function (i) { return lineKey(i.productId, i.variantId) === k; })[0];
    if (ex) ex.qty = (Number(ex.qty) || 0) + (Number(item.qty) || 1);
    else its.push({
      productId: item.productId, variantId: item.variantId || null,
      qty: Math.max(1, Number(item.qty) || 1),
      name: item.name || '', price: item.price != null ? Number(item.price) : null
    });
    persist(its); refresh();
  }
  function setQty(k, qty) {
    var its = read();
    var i = its.filter(function (x) { return lineKey(x.productId, x.variantId) === k; })[0];
    if (i) i.qty = Math.max(1, Number(qty) || 1);
    persist(its); refresh();
  }
  function removeLine(k) { persist(read().filter(function (i) { return lineKey(i.productId, i.variantId) !== k; })); refresh(); }
  function clear() { persist([]); refresh(); }

  /** The exact payload sent to the server — IDs + quantities only, no prices. */
  function buildLineItems() {
    return read().map(function (i) {
      var li = { product_id: i.productId, qty: Number(i.qty) || 1 };
      if (i.variantId) li.variant_id = i.variantId;
      return li;
    });
  }

  function checkout(customer) {
    var api = global.HublyCommerceApi;
    if (!api || typeof api.createCheckout !== 'function') return Promise.resolve({ ok: false, error: 'no_api' });
    var line = buildLineItems();
    if (!line.length) return Promise.resolve({ ok: false, error: 'cart_empty' });
    var base = (global.location && global.location.origin) || '';
    var body = {
      business_id: state.businessId,
      line_items: line,
      customer_name: (customer && customer.name) || null,
      customer_email: (customer && customer.email) || null,
      success_url: base + '/?store_checkout=success',
      cancel_url: base + '/?store_checkout=cancel'
    };
    return api.createCheckout(body).then(function (res) {
      if (res && res.ok && res.data && res.data.url) {
        if (!(customer && customer.noRedirect)) global.location.href = res.data.url;
        return { ok: true, url: res.data.url, order_number: res.data.order_number };
      }
      return { ok: false, error: (res && res.error) || 'checkout_failed', message: (res && res.message) || null };
    });
  }

  // ── UI ──────────────────────────────────────────────────────────────────
  function ensureUi() {
    if (global.document.getElementById('hub-store-cart-root')) return;
    var root = global.document.createElement('div');
    root.id = 'hub-store-cart-root';
    global.document.body.appendChild(root);
    root.addEventListener('click', onRootClick);
    global.document.body.appendChild(makeButton());
  }
  function makeButton() {
    var b = global.document.createElement('button');
    b.type = 'button';
    b.id = 'hub-store-cart-btn';
    b.className = 'hub-commerce-cart-fab';
    b.setAttribute('data-store-cart', 'open');
    b.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9998;';
    b.addEventListener('click', function () { state.drawerOpen = true; refresh(); });
    b.textContent = 'Cart (0)';
    return b;
  }
  function updateBadge() {
    var b = global.document.getElementById('hub-store-cart-btn');
    if (b) { b.textContent = 'Cart (' + count() + ')'; b.style.display = count() ? '' : 'none'; }
  }
  function onRootClick(e) {
    var actEl = e.target.closest('[data-store-cart]');
    if (!actEl) return;
    var act = actEl.getAttribute('data-store-cart');
    if (act === 'close') { state.drawerOpen = false; refresh(); }
    else if (act === 'remove') { removeLine(actEl.getAttribute('data-line')); }
    else if (act === 'inc') { adjust(actEl.getAttribute('data-line'), 1); }
    else if (act === 'dec') { adjust(actEl.getAttribute('data-line'), -1); }
    else if (act === 'checkout') { submitCheckout(); }
  }
  function adjust(k, d) {
    var i = read().filter(function (x) { return lineKey(x.productId, x.variantId) === k; })[0];
    if (i) setQty(k, (Number(i.qty) || 1) + d);
  }
  function submitCheckout() {
    var out = global.document.getElementById('hub-store-cart-msg');
    var name = (global.document.getElementById('hub-store-cart-name') || {}).value || '';
    var email = (global.document.getElementById('hub-store-cart-email') || {}).value || '';
    if (out) out.textContent = 'Redirecting to secure checkout…';
    checkout({ name: name, email: email }).then(function (r) {
      if (!r.ok && out) {
        out.textContent = r.error === 'not_configured'
          ? 'Online checkout isn’t set up for this store yet.'
          : ('Could not start checkout' + (r.message ? ': ' + r.message : '.') );
      }
    });
  }
  function drawerHtml() {
    var its = read();
    var lines = its.map(function (i) {
      var k = lineKey(i.productId, i.variantId);
      return '<li class="hub-commerce-cart-line">' +
        '<span>' + esc(i.name || 'Item') + '</span>' +
        '<span class="hub-commerce-cart-qty">' +
        '<button type="button" data-store-cart="dec" data-line="' + esc(k) + '">−</button>' +
        '<b>' + esc(i.qty) + '</b>' +
        '<button type="button" data-store-cart="inc" data-line="' + esc(k) + '">+</button>' +
        '</span>' +
        '<span>' + esc(money((Number(i.price) || 0) * (Number(i.qty) || 0))) + '</span>' +
        '<button type="button" class="hub-commerce-cart-x" data-store-cart="remove" data-line="' + esc(k) + '">✕</button>' +
        '</li>';
    }).join('');
    return '<div class="hub-commerce-cart-backdrop" data-store-cart="close"></div>' +
      '<aside class="hub-commerce-cart-drawer" role="dialog" aria-label="Cart">' +
      '<header><strong>Your cart</strong><button type="button" data-store-cart="close" aria-label="Close">✕</button></header>' +
      (its.length
        ? '<ul class="hub-commerce-cart-list">' + lines + '</ul>' +
          '<div class="hub-commerce-cart-subtotal"><span>Subtotal</span><strong>' + esc(money(subtotal())) + '</strong></div>' +
          '<p class="hub-commerce-cart-note">Taxes and shipping are calculated at checkout.</p>' +
          '<div class="hub-commerce-cart-form">' +
          '<input id="hub-store-cart-name" type="text" placeholder="Your name" autocomplete="name">' +
          '<input id="hub-store-cart-email" type="email" placeholder="Email for your receipt" autocomplete="email">' +
          '<button type="button" class="hub-commerce-btn" data-store-cart="checkout">Pay with card</button>' +
          '<p id="hub-store-cart-msg" class="hub-commerce-cart-msg"></p>' +
          '</div>'
        : '<p class="hub-commerce-empty">Your cart is empty.</p>') +
      '</aside>';
  }
  function refresh() {
    updateBadge();
    var root = global.document.getElementById('hub-store-cart-root');
    if (!root) return;
    root.innerHTML = state.drawerOpen ? drawerHtml() : '';
  }

  function showConfirmation() {
    var params = String((global.location && global.location.search) || '');
    if (params.indexOf('store_checkout=success') === -1) return;
    clear();
    if (global.document.getElementById('hub-store-confirm')) return;
    var el = global.document.createElement('div');
    el.id = 'hub-store-confirm';
    el.className = 'hub-commerce-confirm';
    el.style.cssText = 'position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:9999;';
    el.innerHTML = '<strong>✓ Order confirmed</strong><span>Thank you for your purchase — your order has been recorded.</span>' +
      '<button type="button" aria-label="Dismiss">✕</button>';
    el.querySelector('button').addEventListener('click', function () { el.remove(); });
    global.document.body.appendChild(el);
  }

  // Wire cart-add buttons inside the storefront mount (data-commerce-act="cart-add").
  function wire(mountEl) {
    if (!mountEl || mountEl._hublyCartWired) return;
    mountEl._hublyCartWired = true;
    mountEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-commerce-act="cart-add"]');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      var card = btn.closest('.hub-commerce-product-card');
      if (!card) return;
      var sel = card.querySelector('[data-variant-select]');
      var variantId = sel ? sel.value : null;
      var price = card.getAttribute('data-base-price');
      if (sel && sel.selectedOptions && sel.selectedOptions[0]) price = sel.selectedOptions[0].getAttribute('data-price');
      add({
        productId: card.getAttribute('data-product-id'),
        variantId: variantId || null,
        qty: 1,
        name: card.getAttribute('data-product-name') + (sel ? (' — ' + (sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.split(' · ')[0] : '')) : ''),
        price: Number(price) || 0
      });
      state.drawerOpen = true; refresh();
    });
  }

  function mount(businessId, mountEl) {
    state.businessId = businessId || state.businessId;
    state.mount = mountEl || state.mount;
    ensureUi();
    if (state.mount) wire(state.mount);
    updateBadge();
    showConfirmation();
  }

  function openDrawer() { ensureUi(); state.drawerOpen = true; refresh(); }

  global.HublyStorefrontCart = {
    mount: mount, openDrawer: openDrawer,
    add: add, items: items, count: count, subtotal: subtotal,
    setQty: setQty, remove: removeLine, clear: clear,
    buildLineItems: buildLineItems, checkout: checkout
  };
})(typeof window !== 'undefined' ? window : globalThis);
