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
  // state.ast = the saved Storefront AST (presentation config). null → render the deterministic
  // default (HublyStorefrontAst.buildDefault) so /store and the Builder preview always agree.
  var state = { businessId: null, brand: {}, os: null, ast: null, view: 'grid', collectionId: null, productId: null, container: null };

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
  var AST = function () { return global.HublyStorefrontAst; };

  function injectStyle(brandColor) {
    var css =
      '.hub-store-page{--sp-brand:' + (brandColor || '#D9632D') + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#141B2B;background:#fff;min-height:100vh;}' +
      // ---- Storefront AST blocks (shared by /store and the Builder preview) ----
      '.hub-store-page .sp-block{padding:0 20px;}' +
      '.sp-hero{padding:40px 20px 16px;}' +
      '.sp-hero--tall{padding:72px 20px 24px;}' +
      '.sp-hero--compact{padding:22px 20px 10px;}' +
      '.sp-hero h1{margin:0 0 6px;font-size:30px;letter-spacing:-.02em;line-height:1.1;}' +
      '.sp-hero--tall h1{font-size:40px;}' +
      '.sp-hero p{margin:0;color:#5b6472;font-size:16px;max-width:640px;}' +
      '.sp-sec{padding:22px 20px 10px;}' +
      '.sp-sec-title{margin:0 0 12px;font-size:20px;font-weight:700;letter-spacing:-.01em;}' +
      '.sp-prod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;}' +
      '.sp-prod-grid.sp-lg{grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;}' +
      '.sp-prod-grid.sp-sm{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}' +
      '.sp-col-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;}' +
      '.sp-col-card{border:1px solid #E6E8EC;border-radius:14px;padding:18px;cursor:pointer;background:#fff;transition:border-color .15s;}' +
      '.sp-col-card:hover{border-color:var(--sp-brand);}' +
      '.sp-col-card .sp-col-name{font-weight:700;font-size:16px;}' +
      '.sp-col-card .sp-col-count{color:#8a9099;font-size:13px;margin-top:4px;}' +
      '.sp-promo{margin:16px 20px;border-radius:14px;padding:16px 20px;background:#F4F5F7;display:flex;align-items:center;gap:12px;justify-content:center;flex-wrap:wrap;}' +
      '.sp-promo--bold{background:var(--sp-brand);color:#fff;}' +
      '.sp-promo .sp-promo-cta{font-weight:700;text-decoration:underline;}' +
      '.sp-story{padding:28px 20px;max-width:760px;}' +
      '.sp-story h2{margin:0 0 8px;font-size:22px;}' +
      '.sp-story p{margin:0;color:#4b5563;line-height:1.6;}' +
      '.sp-cta{margin:20px;padding:32px 20px;border-radius:16px;background:#141B2B;color:#fff;text-align:center;}' +
      '.sp-cta h2{margin:0 0 14px;font-size:24px;}' +
      '.sp-cta .sp-cta-btn{background:var(--sp-brand);color:#fff;border:0;border-radius:999px;padding:11px 24px;font-weight:700;font-size:15px;cursor:pointer;}' +
      '.sp-foot{padding:28px 20px;border-top:1px solid #E6E8EC;color:#8a9099;font-size:14px;margin-top:24px;}' +
      '.sp-empty-mini{color:#8a9099;font-size:14px;padding:8px 0;}' +
      // Theme treatments (theme.style) — light-touch differentiation, accent still leads.
      '.hub-store-page.sp-theme-premium{background:#0E1116;color:#F3F4F6;}' +
      '.hub-store-page.sp-theme-premium .hub-store-head{background:#0E1116;border-bottom-color:#232833;}' +
      '.hub-store-page.sp-theme-premium .sp-hero p,.hub-store-page.sp-theme-premium .sp-story p{color:#c4c9d4;}' +
      '.hub-store-page.sp-theme-premium .sp-col-card,.hub-store-page.sp-theme-premium .hub-commerce-product-card{background:#161B22;border-color:#232833;}' +
      '.hub-store-page.sp-theme-premium .sp-promo{background:#161B22;color:#F3F4F6;}' +
      '.hub-store-page.sp-theme-bold .sp-hero h1{font-weight:900;text-transform:uppercase;letter-spacing:-.01em;}' +
      '.hub-store-page.sp-theme-minimal .sp-sec-title{font-weight:600;}' +
      '.hub-store-page.sp-theme-minimal .hub-commerce-product-card{border-color:#EEF0F2;}' +
      '.hub-store-page.sp-theme-warm{background:#FBF7F2;}' +
      '.hub-store-page.sp-theme-warm .hub-store-head{background:#FBF7F2;}' +
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
  function productById(id) { return ((state.os && state.os.products) || []).filter(function (p) { return p.id === id; })[0] || null; }
  function collectionById(id) { return ((state.os && state.os.collections) || []).filter(function (c) { return c.id === id; })[0] || null; }

  // ---- Storefront AST rendering (Commerce ids resolved live; never copied) ----

  // The AST that actually drives the layout: the saved one if usable, else the deterministic
  // default built from the live catalog — so /store and the Builder preview always match.
  function effectiveAst() {
    var a = AST();
    if (a && state.ast && a.isUsable(state.ast)) return a.validate(state.ast).ast;
    var os = state.os || {};
    if (a) return a.buildDefault({
      businessName: state.brand.name,
      accent: state.brand.brandColor || null,
      products: (os.products || []).map(function (p) { return { id: p.id, status: 'active', featured: !!p.featured }; }),
      collections: (os.collections || []).map(function (c) { return { id: c.id }; })
    });
    return { version: 1, theme: { style: 'clean', accent: null }, blocks: [] };
  }

  // Resolve productIds → live product objects, preserving AST order, dropping ids not in catalog.
  function resolveProducts(ids) {
    return (ids || []).map(productById).filter(Boolean);
  }
  function productsInCollection(collectionId) {
    var col = collectionById(collectionId);
    var pids = (col && col.productIds) || [];
    return ((state.os && state.os.products) || []).filter(function (p) { return pids.indexOf(p.id) > -1; });
  }
  function prodGridHtml(list, variant) {
    if (!list.length) return '<div class="sp-empty-mini">No products to show here yet.</div>';
    var cls = variant === 'large' ? ' sp-lg' : (variant === 'compact' ? ' sp-sm' : '');
    return '<div class="sp-prod-grid' + cls + '">' + list.map(function (p) { return C() ? C().ProductCard(p) : ''; }).join('') + '</div>';
  }
  function sectionHtml(title, inner) {
    return '<section class="sp-block sp-sec">' + (title ? '<h2 class="sp-sec-title">' + esc(title) + '</h2>' : '') + inner + '</section>';
  }

  function blockHtml(b) {
    if (!b || b.visible === false) return '';
    var cfg = b.config || {};
    switch (b.type) {
      case 'storeHero':
        return '<section class="sp-block sp-hero sp-hero--' + esc(b.variant) + '">' +
          '<h1>' + esc(cfg.headline || (state.brand.name ? state.brand.name + ' Store' : 'Shop')) + '</h1>' +
          (cfg.sub ? '<p>' + esc(cfg.sub) + '</p>' : '') + '</section>';
      case 'featuredProducts':
        return sectionHtml(cfg.title || 'Featured', prodGridHtml(resolveProducts(cfg.productIds), b.variant));
      case 'bestSellers':
        return sectionHtml(cfg.title || 'Best sellers', prodGridHtml(resolveProducts(cfg.productIds), b.variant));
      case 'productGrid': {
        // A block-scoped collection filter wins; otherwise honor the visitor's chip selection.
        var list = cfg.collectionId ? productsInCollection(cfg.collectionId)
          : (state.collectionId ? productsInCollection(state.collectionId) : ((state.os && state.os.products) || []));
        return sectionHtml(cfg.title || 'Shop all', prodGridHtml(list, b.variant));
      }
      case 'featuredCollection': {
        var col = collectionById(cfg.collectionId);
        return sectionHtml(cfg.title || (col ? col.name : 'Collection'), prodGridHtml(productsInCollection(cfg.collectionId), b.variant === 'banner' ? 'large' : b.variant));
      }
      case 'collectionGrid': {
        var cols = (state.os && state.os.collections) || [];
        if (!cols.length) return '';
        var cards = cols.map(function (c) {
          var n = productsInCollection(c.id).length;
          return '<div class="sp-col-card" data-store-page="col" data-col="' + esc(c.id) + '">' +
            '<div class="sp-col-name">' + esc(c.name) + '</div>' +
            '<div class="sp-col-count">' + n + ' product' + (n === 1 ? '' : 's') + '</div></div>';
        }).join('');
        return sectionHtml(cfg.title || 'Shop by category', '<div class="sp-col-grid">' + cards + '</div>');
      }
      case 'promoBanner':
        return '<div class="sp-block sp-promo sp-promo--' + esc(b.variant) + '"><span>' + esc(cfg.text || '') + '</span>' +
          (cfg.ctaText ? '<span class="sp-promo-cta">' + esc(cfg.ctaText) + '</span>' : '') + '</div>';
      case 'brandStory':
        return '<section class="sp-block sp-story">' + (cfg.title ? '<h2>' + esc(cfg.title) + '</h2>' : '') +
          (cfg.body ? '<p>' + esc(cfg.body) + '</p>' : '') + '</section>';
      case 'cta':
        return '<section class="sp-block sp-cta"><h2>' + esc(cfg.title || 'Ready to shop?') + '</h2>' +
          '<button type="button" class="sp-cta-btn" data-store-page="cta-top">' + esc(cfg.buttonText || 'Shop now') + '</button></section>';
      case 'footer':
        return '<footer class="sp-foot">' + esc(cfg.text || state.brand.name || '') + '</footer>';
      default:
        return '';
    }
  }

  // The store home = the AST blocks in order. Detail view is shared/unchanged below.
  function renderHome() {
    var ast = effectiveAst();
    applyTheme(ast.theme);
    return (ast.blocks || []).map(blockHtml).join('');
  }

  // theme.style → container class; theme.accent (or brand color) → --sp-brand.
  function applyTheme(theme) {
    theme = theme || {};
    if (!state.container) return;
    var el = state.container;
    ['clean', 'premium', 'bold', 'minimal', 'warm'].forEach(function (s) { el.classList.remove('sp-theme-' + s); });
    el.classList.add('sp-theme-' + (theme.style || 'clean'));
    var accent = theme.accent || state.brand.brandColor || '#D9632D';
    el.style.setProperty('--sp-brand', accent);
  }

  function headerHtml() {
    var b = state.brand || {};
    var logo = b.logoUrl ? '<img src="' + esc(b.logoUrl) + '" alt="' + esc(b.name || '') + '">' : '';
    return '<header class="hub-store-head">' + logo +
      '<span class="hub-store-biz">' + esc(b.name || 'Store') + '</span>' +
      '<button type="button" class="hub-store-cartbtn" data-store-page="cart">Cart (' + (Cart() ? Cart().count() : 0) + ')</button>' +
      '</header>';
  }

  function detailHtml() {
    var p = productById(state.productId);
    if (!p) { state.view = 'grid'; return renderHome(); }
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
    state.container.innerHTML = headerHtml() + (state.view === 'detail' ? detailHtml() : renderHome());
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
        if (a === 'cta-top') { var g = container.querySelector('.sp-prod-grid'); if (g && g.scrollIntoView) g.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
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
    // Presentation config (from businesses.meta.storefront). null → deterministic default.
    state.ast = opts.ast || null;
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

  /**
   * Render the store home into an element using the SAME renderer as /store — for the Builder's
   * live preview. Non-interactive (no cart mount, no routing side effects): the owner is designing,
   * not shopping. opts = { ast, os, brand }. If `os` is omitted, loads it once for businessId.
   * This is the guarantee that "what the owner sees == what the customer sees after publish."
   */
  function renderInto(el, opts) {
    if (!el) return Promise.resolve();
    opts = opts || {};
    state.container = el;
    state.brand = opts.brand || {};
    state.businessId = opts.businessId || state.businessId;
    state.ast = opts.ast || null;
    state.view = 'grid'; state.collectionId = null; state.productId = null; state.selectedVariant = null;
    injectStyle(state.brand.brandColor);
    el.classList.add('hub-store-page');
    var paint = function () { el.innerHTML = headerHtml() + renderHome(); };
    if (opts.os) { state.os = opts.os; paint(); return Promise.resolve(state.os); }
    var sf = global.HublyCommerceStorefront;
    if (!sf || typeof sf.loadPublic !== 'function' || !state.businessId) { state.os = state.os || { settings: { enabled: true }, products: [], collections: [] }; paint(); return Promise.resolve(state.os); }
    paint(); // loading frame with whatever os we have
    return sf.loadPublic(state.businessId, 'store').then(function (os) { state.os = os || {}; paint(); return state.os; });
  }

  // Expose the loaded projection so the Builder can reuse it (e.g. product/collection pickers)
  // without a second fetch. Read-only snapshot.
  function currentOs() { return state.os; }

  global.HublyStorePage = { open: open, renderInto: renderInto, currentOs: currentOs };
})(typeof window !== 'undefined' ? window : globalThis);
