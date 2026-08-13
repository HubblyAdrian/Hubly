/**
 * Dedicated standalone Storefront — the shareable /store route (<slug>.myhubly.app/store).
 *
 * A real customer-facing store for selling physical products/supplies. It reads the SAME
 * Commerce public API as the website Store embed (HublyCommerceStorefront.loadPublic, surface
 * 'store'), reuses ProductCard/CollectionCard and the guest cart + checkout (HublyStorefrontCart)
 * — no second catalog, cart, or checkout, and no S.storeOs. commerce_products is the SSOT.
 *
 * Respects: store enabled/disabled (surface=store gate), per-product website visibility,
 * inventory/sold-out, variants, pricing, images, and collections.
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'hub-store-page-style';
  var state = { businessId: null, brand: {}, os: null, view: 'grid', collectionId: null, productId: null, container: null };

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
  var C = function () { return global.HublyCommerceComponents; };
  var Cart = function () { return global.HublyStorefrontCart; };

  function injectStyle(brandColor) {
    var css =
      '.hub-store-page{--sp-brand:' + (brandColor || '#D9632D') + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#141B2B;background:#fff;min-height:100vh;}' +
      '.hub-store-head{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC;position:sticky;top:0;background:#fff;z-index:5;}' +
      '.hub-store-head img{height:36px;width:auto;border-radius:8px;}' +
      '.hub-store-head .hub-store-biz{font-weight:700;font-size:18px;flex:1;}' +
      '.hub-store-head .hub-store-cartbtn{background:var(--sp-brand);color:#fff;border:0;border-radius:999px;padding:9px 16px;font-weight:600;cursor:pointer;}' +
      '.hub-store-hero{padding:28px 20px 8px;}' +
      '.hub-store-hero h1{margin:0 0 4px;font-size:26px;letter-spacing:-.01em;}' +
      '.hub-store-hero p{margin:0;color:#5b6472;}' +
      '.hub-store-chips{display:flex;gap:8px;flex-wrap:wrap;padding:14px 20px;}' +
      '.hub-store-chip{border:1px solid #E6E8EC;background:#fff;border-radius:999px;padding:7px 14px;font-size:13px;cursor:pointer;}' +
      '.hub-store-chip.on{background:var(--sp-brand);color:#fff;border-color:var(--sp-brand);}' +
      '.hub-store-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;padding:8px 20px 40px;}' +
      '.hub-store-page .hub-commerce-product-card{border:1px solid #E6E8EC;border-radius:14px;overflow:hidden;background:#fff;cursor:pointer;display:flex;flex-direction:column;}' +
      '.hub-store-page .hub-commerce-product-card__media{aspect-ratio:1/1;background:#f4f5f7;display:flex;align-items:center;justify-content:center;font-size:34px;color:#c2c7cf;overflow:hidden;}' +
      '.hub-store-page .hub-commerce-product-card__media img{width:100%;height:100%;object-fit:cover;}' +
      '.hub-store-page .hub-commerce-product-card__body{padding:12px;display:flex;flex-direction:column;gap:6px;}' +
      '.hub-store-page .hub-commerce-product-card__row{display:flex;align-items:center;justify-content:space-between;margin-top:auto;}' +
      '.hub-store-page .hub-commerce-price{font-weight:700;}' +
      '.hub-store-page .hub-commerce-variant-select{width:100%;padding:6px;border:1px solid #E6E8EC;border-radius:8px;}' +
      '.hub-store-page .hub-commerce-inv{font-size:12px;color:#8a9099;}' +
      '.hub-store-page .hub-commerce-inv.low{color:#c0392b;}' +
      '.hub-store-page .hub-commerce-btn{background:var(--sp-brand);color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:600;cursor:pointer;}' +
      '.hub-store-page .hub-commerce-btn[disabled]{background:#c2c7cf;cursor:not-allowed;}' +
      '.hub-store-detail{padding:16px 20px 48px;max-width:920px;margin:0 auto;}' +
      '.hub-store-detail .back{background:none;border:0;color:#5b6472;cursor:pointer;padding:8px 0;font-size:14px;}' +
      '.hub-store-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:start;}' +
      '.hub-store-detail-media{aspect-ratio:1/1;background:#f4f5f7;border-radius:16px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:64px;color:#c2c7cf;}' +
      '.hub-store-detail-media img{width:100%;height:100%;object-fit:cover;}' +
      '.hub-store-detail h1{margin:0 0 6px;font-size:24px;}' +
      '.hub-store-detail .price{font-size:22px;font-weight:700;margin:6px 0 12px;}' +
      '.hub-store-detail label{display:block;font-size:13px;color:#5b6472;margin:12px 0 4px;}' +
      '.hub-store-detail select,.hub-store-detail input{padding:9px;border:1px solid #E6E8EC;border-radius:8px;width:100%;max-width:220px;}' +
      '.hub-store-detail .add{margin-top:18px;padding:12px 22px;font-size:15px;}' +
      '.hub-store-empty,.hub-store-off{padding:60px 20px;text-align:center;color:#5b6472;}' +
      '@media(max-width:640px){.hub-store-detail-grid{grid-template-columns:1fr;}}';
    if (global.document.getElementById(STYLE_ID)) { global.document.getElementById(STYLE_ID).textContent = css; return; }
    var st = global.document.createElement('style');
    st.id = STYLE_ID; st.textContent = css;
    global.document.head.appendChild(st);
  }

  function settings() { return (state.os && state.os.settings) || {}; }
  function products() {
    var list = (state.os && state.os.products) || [];
    if (state.collectionId) {
      var col = ((state.os && state.os.collections) || []).filter(function (c) { return c.id === state.collectionId; })[0];
      var ids = (col && col.productIds) || [];
      list = list.filter(function (p) { return ids.indexOf(p.id) > -1; });
    }
    return list;
  }
  function productById(id) { return ((state.os && state.os.products) || []).filter(function (p) { return p.id === id; })[0] || null; }

  function headerHtml() {
    var b = state.brand || {};
    var logo = b.logoUrl ? '<img src="' + esc(b.logoUrl) + '" alt="' + esc(b.name || '') + '">' : '';
    return '<header class="hub-store-head">' + logo +
      '<span class="hub-store-biz">' + esc(b.name || 'Store') + '</span>' +
      '<button type="button" class="hub-store-cartbtn" data-store-page="cart">Cart (' + (Cart() ? Cart().count() : 0) + ')</button>' +
      '</header>';
  }

  function gridHtml() {
    var s = settings();
    var cols = (state.os && state.os.collections) || [];
    var chips = cols.length
      ? '<div class="hub-store-chips">' +
        '<button type="button" class="hub-store-chip' + (!state.collectionId ? ' on' : '') + '" data-store-page="col" data-col="">All</button>' +
        cols.map(function (c) {
          return '<button type="button" class="hub-store-chip' + (state.collectionId === c.id ? ' on' : '') + '" data-store-page="col" data-col="' + esc(c.id) + '">' + esc(c.name) + '</button>';
        }).join('') + '</div>'
      : '';
    var prods = products();
    var grid = prods.length
      ? '<div class="hub-store-grid">' + prods.map(function (p) { return C() ? C().ProductCard(p) : ''; }).join('') + '</div>'
      : '<div class="hub-store-empty">No products in this store yet.</div>';
    return '<section class="hub-store-hero"><h1>' + esc(s.heroTitle || (state.brand.name ? state.brand.name + ' Store' : 'Shop')) + '</h1>' +
      '<p>' + esc(s.heroSubtitle || 'Supplies, products, and add-ons.') + '</p></section>' +
      chips + grid;
  }

  function detailHtml() {
    var p = productById(state.productId);
    if (!p) { state.view = 'grid'; return gridHtml(); }
    var variants = p.variants || [];
    var vsel = state.selectedVariant || (variants[0] && variants[0].id) || null;
    var chosen = variants.filter(function (v) { return v.id === vsel; })[0] || null;
    var price = chosen && chosen.price != null ? chosen.price : (p.price || 0);
    var stock = chosen ? chosen.stock : p.stock;
    var digital = p.type === 'gift_card' || p.type === 'digital';
    var soldOut = !digital && stock != null && Number(stock) <= 0;
    var img = (p.images && p.images.length && p.images[0].url)
      ? '<img src="' + esc(p.images[0].url) + '" alt="' + esc(p.name) + '">'
      : esc((p.name || 'P').slice(0, 1));
    var variantSel = variants.length
      ? '<label>Option</label><select data-store-page="variant">' + variants.map(function (v) {
        var vp = v.price != null ? v.price : p.price;
        var vsold = (v.stock != null && Number(v.stock) <= 0);
        return '<option value="' + esc(v.id) + '"' + (v.id === vsel ? ' selected' : '') + (vsold ? ' disabled' : '') + '>' +
          esc(v.name) + ' · ' + esc(money(vp)) + (vsold ? ' (sold out)' : '') + '</option>';
      }).join('') + '</select>'
      : '';
    var maxQty = (!digital && stock != null) ? Math.max(1, Number(stock)) : 99;
    return '<section class="hub-store-detail">' +
      '<button type="button" class="back" data-store-page="back">← Back to store</button>' +
      '<div class="hub-store-detail-grid">' +
      '<div class="hub-store-detail-media">' + img + '</div>' +
      '<div>' +
      '<h1>' + esc(p.name) + '</h1>' +
      '<div class="price">' + esc(money(price)) + '</div>' +
      (p.description ? '<p>' + esc(p.description) + '</p>' : '') +
      (digital ? '<p class="hub-commerce-inv">Digital item</p>' : (soldOut ? '<p class="hub-commerce-inv low">Sold out</p>' : '')) +
      variantSel +
      (soldOut ? '' : '<label>Quantity</label><input type="number" min="1" max="' + maxQty + '" value="1" data-store-page="qty">') +
      '<div><button type="button" class="hub-commerce-btn add" data-store-page="add"' + (soldOut ? ' disabled' : '') + '>' + (soldOut ? 'Sold out' : 'Add to cart') + '</button></div>' +
      '</div></div></section>';
  }

  function renderView() {
    if (!state.container) return;
    var s = settings();
    if (state.os && state.os.error === 'not_ready') { state.container.innerHTML = headerHtml() + '<div class="hub-store-off">Store is loading…</div>'; return; }
    if (!s.enabled) {
      state.container.innerHTML = headerHtml() + '<div class="hub-store-off"><h2>Store unavailable</h2><p>This store isn’t open right now.</p></div>';
      return;
    }
    state.container.innerHTML = headerHtml() + (state.view === 'detail' ? detailHtml() : gridHtml());
  }

  function wire(container) {
    if (container._hublyStorePageWired) return;
    container._hublyStorePageWired = true;
    container.addEventListener('click', function (e) {
      var act = e.target.closest('[data-store-page]');
      if (act) {
        var a = act.getAttribute('data-store-page');
        if (a === 'cart') { if (Cart()) Cart().openDrawer(); return; }
        if (a === 'col') { state.collectionId = act.getAttribute('data-col') || null; renderView(); return; }
        if (a === 'back') { state.view = 'grid'; state.productId = null; state.selectedVariant = null; renderView(); return; }
        if (a === 'add') { detailAdd(); return; }
        return;
      }
      // Product card click → open detail (but not when clicking add-to-cart or the variant select).
      var card = e.target.closest('.hub-commerce-product-card');
      if (card && !e.target.closest('[data-commerce-act="cart-add"]') && !e.target.closest('[data-variant-select]')) {
        state.productId = card.getAttribute('data-product-id');
        state.selectedVariant = null;
        state.view = 'detail';
        renderView();
      }
    });
    container.addEventListener('change', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-store-page') === 'variant') {
        state.selectedVariant = e.target.value;
        renderView();
      }
    });
  }

  function detailAdd() {
    var p = productById(state.productId);
    if (!p || !Cart()) return;
    var variants = p.variants || [];
    var vsel = state.selectedVariant || (variants[0] && variants[0].id) || null;
    var chosen = variants.filter(function (v) { return v.id === vsel; })[0] || null;
    var price = chosen && chosen.price != null ? chosen.price : (p.price || 0);
    var qtyEl = state.container.querySelector('[data-store-page="qty"]');
    var qty = qtyEl ? Math.max(1, Number(qtyEl.value) || 1) : 1;
    Cart().add({ productId: p.id, variantId: vsel || null, qty: qty, name: p.name + (chosen ? ' — ' + chosen.name : ''), price: price });
    Cart().openDrawer();
  }

  function open(opts) {
    opts = opts || {};
    state.businessId = opts.businessId;
    state.brand = opts.business || {};
    state.container = opts.container;
    state.view = 'grid'; state.collectionId = null; state.productId = null; state.selectedVariant = null;
    injectStyle(state.brand.brandColor);
    if (state.container) state.container.classList.add('hub-store-page');
    if (state.brand.name) { try { global.document.title = state.brand.name + ' · Store'; } catch (e) {} }
    renderView(); // loading frame
    var sf = global.HublyCommerceStorefront;
    if (!sf || typeof sf.loadPublic !== 'function' || !state.businessId) { return; }
    sf.loadPublic(state.businessId, 'store').then(function (os) {
      state.os = os || {};
      renderView();
      wire(state.container);
      // Cart drawer/checkout/confirmation. Pass the container so grid cart-add buttons wire;
      // detail add is handled here. Never touches S.storeOs.
      if (Cart()) Cart().mount(state.businessId, state.container);
    });
  }

  global.HublyStorePage = { open: open };
})(typeof window !== 'undefined' ? window : globalThis);
