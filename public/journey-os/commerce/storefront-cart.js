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

  // ── THE DRAWER'S OWN STYLES ────────────────────────────────────────────────
  // These class names were written here from the day the cart shipped and NOTHING
  // ever styled them — not store-commerce.css, not an injected block, nowhere. So
  // `.hub-commerce-cart-drawer` computed to `position: static` and laid out as an
  // ordinary block AFTER the footer: on /store that put the cart at y=890 in a
  // 792px viewport. Clicking "Cart (1)" looked like it did nothing.
  //
  // It also hid an honest message. When Connect isn't ready, create-store-checkout
  // returns 503 and this file correctly writes "Online checkout isn't set up for
  // this store yet." into #hub-store-cart-msg — which rendered one pixel below the
  // fold. The copy was right; the layout was hiding it. Fixed here, in the layout.
  //
  // Owned by this file because this file writes the markup, exactly as store-page.js
  // owns its own. A layout that cannot be read is a defect, not a style choice.
  var CART_STYLE_ID = 'hub-commerce-cart-style';
  function injectCartStyle() {
    var d = global.document;
    if (!d || d.getElementById(CART_STYLE_ID)) return;
    var css = [
      '.hub-commerce-cart-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.42);z-index:9998;}',
      '.hub-commerce-cart-drawer{position:fixed;top:0;right:0;bottom:0;width:min(400px,100vw);z-index:9999;',
      '  background:#fff;color:#0f172a;box-shadow:-8px 0 32px rgba(15,23,42,.18);',
      '  display:flex;flex-direction:column;gap:0;overflow-y:auto;padding:18px 20px 24px;',
      '  font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;}',
      '.hub-commerce-cart-drawer header{display:flex;align-items:center;justify-content:space-between;',
      '  gap:12px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;margin-bottom:12px;}',
      '.hub-commerce-cart-drawer header strong{font-size:16px;}',
      '.hub-commerce-cart-drawer header button{background:none;border:0;font-size:18px;line-height:1;',
      '  cursor:pointer;color:#64748b;padding:4px;}',
      '.hub-commerce-cart-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;}',
      '.hub-commerce-cart-line{display:grid;grid-template-columns:1fr auto auto auto;align-items:center;',
      '  gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;}',
      '.hub-commerce-cart-qty{display:inline-flex;align-items:center;gap:8px;}',
      '.hub-commerce-cart-qty button{width:26px;height:26px;border:1px solid #cbd5e1;background:#fff;',
      '  border-radius:6px;cursor:pointer;font-size:14px;line-height:1;color:#0f172a;}',
      '.hub-commerce-cart-x{background:none;border:0;color:#94a3b8;cursor:pointer;font-size:14px;padding:4px;}',
      '.hub-commerce-cart-subtotal{display:flex;justify-content:space-between;align-items:baseline;',
      '  margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:15px;}',
      '.hub-commerce-cart-note{margin:6px 0 0;font-size:12px;color:#64748b;}',
      '.hub-commerce-cart-form{display:flex;flex-direction:column;gap:8px;margin-top:16px;}',
      '.hub-commerce-cart-form input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;',
      '  border-radius:8px;font:inherit;color:#0f172a;background:#fff;}',
      '.hub-commerce-cart-form .hub-commerce-btn{padding:11px 16px;border:0;border-radius:8px;cursor:pointer;',
      '  background:#0f172a;color:#fff;font:inherit;font-weight:600;}',
      // The refusal line. It must be impossible to miss and impossible to mistake
      // for success -- it is the only thing standing between a customer and a
      // checkout that cannot happen.
      '.hub-commerce-cart-msg{margin:10px 0 0;font-size:13px;line-height:1.5;color:#991b1b;',
      '  background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:9px 11px;}',
      '.hub-commerce-cart-msg:empty{display:none;}',
      '.hub-commerce-empty{color:#64748b;margin:12px 0;}',
      '@media (max-width:520px){.hub-commerce-cart-drawer{width:100vw;}}'
    ].join('');
    var st = d.createElement('style');
    st.id = CART_STYLE_ID;
    st.textContent = css;
    d.head.appendChild(st);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Money formatting lives in ONE place: public/journey-os/money.js. This used to be
  // a local copy with maximumFractionDigits: 0, which rounded a $24.99 product to
  // "$25" while checkout charged $24.99. Five files had that same copy. Do not
  // reintroduce a local formatter here — see money.js for why.
  function money(n) {
    var M = global.HublyMoney;
    return M ? M.format(n) : ('$' + (Number(n) || 0).toFixed(2));
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
    b.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9997;padding:10px 16px;'
      + 'border:0;border-radius:999px;background:#0f172a;color:#fff;font:600 14px/1 system-ui,sans-serif;'
      + 'cursor:pointer;box-shadow:0 6px 20px rgba(15,23,42,.22);';
    b.addEventListener('click', function () { state.drawerOpen = true; refresh(); });
    b.textContent = 'Cart (0)';
    return b;
  }
  // ONE cart control per surface, and it never appears or disappears.
  //
  // Before 2026-09-06 there were two that disagreed: the header chip rendered by
  // store-page.js baked its count in at render time and sat at "Cart (0)" forever,
  // while this floating button was display:none until the first add and then popped
  // into existence showing the true count. Two of almost everything, plus an
  // interface changing shape silently (prohibition 4).
  //
  // Now: the header chip is updated here too when it exists, and the floating button
  // is only used on surfaces that have no header chip (the website store embed).
  // Whichever one a surface has is present from the start and always correct.
  function headerChip() {
    try { return global.document.querySelector('.hub-store-cartbtn'); } catch (e) { return null; }
  }
  function updateBadge() {
    var label = 'Cart (' + count() + ')';
    var chip = headerChip();
    if (chip) chip.textContent = label;
    var b = global.document.getElementById('hub-store-cart-btn');
    if (b) {
      b.textContent = label;
      // Hidden only when the surface already has a cart control of its own — never
      // hidden merely because the cart is empty.
      b.style.display = chip ? 'none' : '';
    }
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
    injectCartStyle();
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
