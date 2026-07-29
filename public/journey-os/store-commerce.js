/**
 * Hubly Store — owner Commerce Engine (Operate).
 * UI label: Store. Internally: commerce (products, collections, orders, inventory, discounts).
 * Distinct from Website Storefront (services) and Apps Marketplace (integrations).
 */
(function (global) {
  'use strict';

  var STORE_TABS = [
    ['overview', 'Overview'],
    ['products', 'Products'],
    ['collections', 'Collections'],
    ['bundles', 'Bundles'],
    ['orders', 'Orders'],
    ['inventory', 'Inventory'],
    ['discounts', 'Discounts'],
    ['analytics', 'Analytics'],
    ['ai', 'AI'],
    ['settings', 'Settings']
  ];

  function el(id) { return document.getElementById(id); }
  function S() { return global.S || {}; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg) {
    if (typeof global.toast === 'function') return global.toast(msg);
    try { console.log('[Hubly Store]', msg); } catch (e) {}
  }
  function persistStoreOs() {
    try {
      if (typeof global.saveStorefront === 'function') {
        clearTimeout(persistStoreOs._t);
        persistStoreOs._t = setTimeout(function () {
          try { global.saveStorefront().catch(function () {}); } catch (e) {}
        }, 400);
        return;
      }
    } catch (e) {}
    try {
      if (typeof global.buildBizMeta === 'function' && global.currentBusiness) {
        global.currentBusiness.meta = global.buildBizMeta();
      }
    } catch (e2) {}
  }
  function money(n) {
    var v = Number(n) || 0;
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
    } catch (e) {
      return '$' + Math.round(v);
    }
  }
  function id(prefix) {
    return (prefix || 'sto') + '_' + Math.random().toString(36).slice(2, 9);
  }
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function ensureStoreOsState() {
    var st = S();
    if (!st.storeOs || typeof st.storeOs !== 'object') st.storeOs = {};
    var os = st.storeOs;
    if (!Array.isArray(os.products)) os.products = [];
    if (!Array.isArray(os.collections)) os.collections = [];
    if (!Array.isArray(os.bundles)) os.bundles = [];
    if (!Array.isArray(os.orders)) os.orders = [];
    if (!Array.isArray(os.discounts)) os.discounts = [];
    if (!Array.isArray(os.documents)) os.documents = [];
    if (!Array.isArray(os.activity)) os.activity = [];
    if (!os.settings || typeof os.settings !== 'object') {
      os.settings = {
        enabled: true,
        showOnWebsite: true,
        storePath: '/store',
        heroTitle: '',
        heroSubtitle: '',
        widgets: { aiCoach: true, learningCenter: true }
      };
    }
    if (os.settings.showOnWebsite == null) os.settings.showOnWebsite = true;
    // Do not invent demo catalog — empty until the owner adds products.
    if (!os.seeded) os.seeded = true;
    return os;
  }

  function seedDemoStore(os, st) {
    // Kept for optional manual seeding — not called automatically.
    if (os.products.length) {
      os.seeded = true;
      return;
    }
    var biz = st.biz || st.businessName || 'Your business';
    os.products = [
      {
        id: 'prod_starter', sku: 'STARTER-01', name: biz + ' Starter Kit',
        type: 'physical', status: 'active', price: 49, compareAt: 0, cost: 0,
        stock: 12, lowStock: 3, collectionIds: [], category: 'Retail',
        vendor: biz, description: 'A starter product you can edit or replace.',
        imageTone: 'orange', featured: true,
        visibility: { website: true, booking: true, customerPortal: true, quoteBuilder: true, email: true, memberships: false },
        createdAt: todayStr()
      }
    ];
    os.seeded = true;
  }

  function publishCommerce(fnName, payload) {
    try {
      var ev = global.HublyCommerceEvents;
      if (ev && typeof ev[fnName] === 'function') ev[fnName](payload);
    } catch (e) {}
  }

  function setStoreMode(on) {
    var app = el('p-app');
    if (!app) return;
    if (on) {
      app.classList.add('jos-pixel');
      try { document.body.classList.add('jos-pixel'); } catch (e) {}
    }
    app.classList.toggle('jos-store-mode', !!on);
  }

  function ownRoot() {
    var view = el('v-store');
    if (!view) return null;
    view.classList.add('jos-pixel-owned');
    view.classList.remove('hidden');
    view.hidden = false;
    var root = el('jos-store-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'jos-store-root';
      view.appendChild(root);
    }
    Array.prototype.slice.call(view.children).forEach(function (ch) {
      if (ch.id !== 'jos-store-root') ch.remove();
    });
    return root;
  }

  function productById(idVal) {
    return ensureStoreOsState().products.find(function (p) { return p.id === idVal; }) || null;
  }

  function storeStats(os) {
    var active = os.products.filter(function (p) { return p.status === 'active'; }).length;
    var low = os.products.filter(function (p) {
      return p.type !== 'gift_card' && p.stock != null && p.lowStock != null && p.stock <= p.lowStock;
    }).length;
    var openOrders = os.orders.filter(function (o) { return o.status === 'paid' || o.status === 'pending'; }).length;
    var paidOrders = os.orders.filter(function (o) { return o.status === 'paid'; });
    var revenue = paidOrders.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);
    var aov = paidOrders.length ? Math.round(revenue / paidOrders.length) : 0;
    var counts = Object.create(null);
    paidOrders.forEach(function (o) {
      (o.items || []).forEach(function (it) {
        counts[it.productId] = (counts[it.productId] || 0) + (Number(it.qty) || 1);
      });
    });
    var topId = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    var topProduct = topId ? productById(topId) : null;
    return {
      active: active, low: low, openOrders: openOrders, revenue: revenue,
      products: os.products.length, orders: paidOrders.length, aov: aov,
      topProduct: topProduct ? topProduct.name : '—',
      conversion: '—', repeat: '—', abandoned: 0
    };
  }

  function statusPill(status) {
    var map = {
      active: 'ok', paid: 'ok', fulfilled: 'ok',
      draft: 'mute', pending: 'info', scheduled: 'info', unfulfilled: 'warn',
      expired: 'mute', refunded: 'warn', cancelled: 'mute', digital: 'info'
    };
    var tone = map[status] || 'mute';
    return '<span class="jos-pill jos-store-pill tone-' + tone + '">' + esc(String(status || '').replace(/_/g, ' ')) + '</span>';
  }

  function productThumb(p) {
    return '<span class="jos-store-thumb tone-' + esc(p.imageTone || 'navy') + '" aria-hidden="true">' +
      esc((p.name || 'P').slice(0, 1).toUpperCase()) + '</span>';
  }

  function renderTabs(active) {
    return '<div class="jos-store-tabs">' + STORE_TABS.map(function (t) {
      return '<button type="button" class="jos-store-tab' + (active === t[0] ? ' on' : '') + '" data-jos-store-tab="' + t[0] + '">' +
        esc(t[1]) + '</button>';
    }).join('') + '</div>';
  }

  function renderOverview(root, os) {
    var stats = storeStats(os);
    var device = root._josStorePreviewDevice || 'desktop';
    var sf = global.HublyCommerceStorefront;
    var C = global.HublyCommerceComponents;
    var Merch = global.HublyCommerceMerchandising;
    var previewHtml = sf ? sf.render({ storeOs: os, state: S(), device: device, preview: true }) : '<p class="jos-muted">Storefront renderer loading…</p>';
    var recs = Merch ? Merch.analyzeLocal(os) : [];
    var analytics = C ? C.StoreAnalytics({
      revenue: money(stats.revenue),
      orders: stats.orders,
      aov: money(stats.aov),
      conversion: stats.conversion,
      topProduct: stats.topProduct,
      lowStock: stats.low,
      repeat: stats.repeat,
      abandoned: stats.abandoned
    }) : '';
    return '<div class="jos-store-overview">' +
      '<section class="jos-store-overview-kpis">' +
      '<div class="jos-store-kpi"><span>Today\'s revenue</span><strong>' + esc(money(stats.revenue)) + '</strong></div>' +
      '<div class="jos-store-kpi"><span>Orders</span><strong>' + esc(stats.openOrders) + '</strong></div>' +
      '<div class="jos-store-kpi"><span>Average order</span><strong>' + esc(money(stats.aov)) + '</strong></div>' +
      '<div class="jos-store-kpi"><span>Top product</span><strong>' + esc(stats.topProduct) + '</strong></div>' +
      '</section>' +
      '<div class="jos-store-overview-grid">' +
      '<section class="jos-store-card jos-store-preview-card">' +
      '<div class="jos-between"><strong>Live preview</strong>' +
      '<div class="jos-store-device-toggles">' +
      ['desktop', 'tablet', 'mobile'].map(function (d) {
        return '<button type="button" class="jos-btn jos-btn-sm' + (device === d ? ' on' : '') + '" data-jos-act="store-preview-device" data-device="' + d + '">' + d + '</button>';
      }).join('') +
      '</div></div>' +
      '<p class="jos-muted jos-store-preview-note">Actual storefront component · edits update instantly</p>' +
      previewHtml +
      '</section>' +
      '<section class="jos-store-card">' +
      '<strong>AI suggestions</strong>' +
      (recs.length
        ? '<ul class="jos-store-ai-recs">' + recs.map(function (r) {
          return '<li><strong>' + esc(r.title) + '</strong><span class="jos-muted">' + esc(r.detail) + '</span></li>';
        }).join('') + '</ul>'
        : '<p class="jos-muted">No merchandising suggestions yet.</p>') +
      analytics +
      '</section></div></div>';
  }

  function renderBundles(root, os) {
    if (!os.bundles.length) {
      return '<div class="jos-store-empty"><h3>No bundles</h3><p>Bundle products with a kit price for checkout upsells.</p>' +
        '<button type="button" class="jos-btn jos-btn-brand" data-jos-act="store-bundle-new">+ New Bundle</button></div>';
    }
    return '<section class="jos-store-card"><div class="jos-store-coll-grid">' + os.bundles.map(function (b) {
      var count = (b.productIds || []).length;
      return '<article class="jos-store-coll">' +
        '<div class="jos-between"><strong>' + esc(b.title) + '</strong>' + statusPill(b.status || 'draft') + '</div>' +
        '<p class="jos-muted">' + esc(b.description || '') + '</p>' +
        '<div class="jos-store-coll-foot"><span>' + count + ' products · ' + esc(money(b.price)) +
        (b.discount ? ' · save ' + esc(money(b.discount)) : '') + '</span>' +
        '<button type="button" class="jos-linkish" data-jos-act="store-bundle-edit" data-jos-id="' + esc(b.id) + '">Edit</button></div></article>';
    }).join('') + '</div></section>';
  }

  function renderAnalytics(root, os) {
    var stats = storeStats(os);
    var C = global.HublyCommerceComponents;
    return '<section class="jos-store-card jos-store-analytics-wrap">' +
      '<strong>Store analytics</strong>' +
      '<p class="jos-muted">Product revenue from Store orders — payment ledger stays in Revenue.</p>' +
      (C ? C.StoreAnalytics({
        revenue: money(stats.revenue),
        orders: stats.orders,
        aov: money(stats.aov),
        conversion: stats.conversion,
        topProduct: stats.topProduct,
        lowStock: stats.low,
        repeat: stats.repeat,
        abandoned: stats.abandoned
      }) : '') +
      '</section>';
  }

  function renderAiTab(root, os) {
    var C = global.HublyCommerceComponents;
    return '<div class="jos-store-ai-grid">' +
      '<section class="jos-store-card">' + (C ? C.AIProductCoach({}) : '') + '</section>' +
      '<section class="jos-store-card">' + (C ? C.KnowledgeUploader() : '') +
      '<ul class="jos-store-doc-list">' + (os.documents || []).map(function (d) {
        return '<li><strong>' + esc(d.title) + '</strong><span class="jos-muted">' + esc(d.source_type || 'doc') + '</span></li>';
      }).join('') + '</ul></section></div>';
  }

  function renderSettings(root, os) {
    var s = os.settings || {};
    return '<section class="jos-store-card"><div class="jos-store-form jos-store-settings-form">' +
      '<label class="full">Store enabled<select id="jos-store-s-enabled"><option value="1"' + (s.enabled !== false ? ' selected' : '') + '>On</option><option value="0"' + (s.enabled === false ? ' selected' : '') + '>Off</option></select></label>' +
      '<label class="full">Show on website<select id="jos-store-s-website"><option value="1"' + (s.showOnWebsite !== false ? ' selected' : '') + '>Yes — embed Store section</option><option value="0"' + (s.showOnWebsite === false ? ' selected' : '') + '>No</option></select></label>' +
      '<label>URL path<input id="jos-store-s-path" type="text" value="' + esc(s.storePath || '/store') + '"></label>' +
      '<label class="full">Hero title<input id="jos-store-s-hero" type="text" value="' + esc(s.heroTitle || '') + '"></label>' +
      '<label class="full">Hero subtitle<textarea id="jos-store-s-sub" rows="2">' + esc(s.heroSubtitle || '') + '</textarea></label>' +
      '<p class="jos-muted full">When enabled, active products appear in a Store section on your Instant Site — same look as the Website editor.</p>' +
      '<div class="jos-btn-row full"><button type="button" class="jos-btn jos-btn-brand" data-jos-act="store-settings-save">Save settings</button></div>' +
      '</div></section>';
  }

  function renderProducts(root, os) {
    var q = String(root._josStoreQ || '').trim().toLowerCase();
    var status = root._josStoreStatus || 'all';
    var rows = os.products.filter(function (p) {
      if (status !== 'all' && p.status !== status) return false;
      if (!q) return true;
      return [p.name, p.sku, p.category, p.description].join(' ').toLowerCase().indexOf(q) > -1;
    });
    var table = rows.length ? '<div class="jos-store-table-wrap"><table class="jos-store-table"><thead><tr>' +
      '<th>Product</th><th>Status</th><th>Inventory</th><th>Price</th><th></th></tr></thead><tbody>' +
      rows.map(function (p) {
        var stockLabel = p.type === 'gift_card' || p.stock == null ? 'Digital' : (String(p.stock) + ' in stock');
        var low = p.stock != null && p.lowStock != null && p.stock <= p.lowStock;
        return '<tr data-jos-store-product="' + esc(p.id) + '">' +
          '<td><button type="button" class="jos-store-prod" data-jos-act="store-product-edit" data-jos-id="' + esc(p.id) + '">' +
          productThumb(p) + '<span><strong>' + esc(p.name) + '</strong><span class="jos-muted">' + esc(p.sku) + ' · ' + esc(p.category || 'Product') + '</span></span></button></td>' +
          '<td>' + statusPill(p.status) + '</td>' +
          '<td><span class="' + (low ? 'jos-store-low' : '') + '">' + esc(stockLabel) + (low ? ' · Low' : '') + '</span></td>' +
          '<td><strong>' + esc(money(p.price)) + '</strong>' + (p.compareAt ? '<span class="jos-muted jos-store-compare">' + esc(money(p.compareAt)) + '</span>' : '') + '</td>' +
          '<td><button type="button" class="jos-icon-btn" data-jos-act="store-product-menu" data-jos-id="' + esc(p.id) + '" aria-label="Actions">⋯</button></td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<div class="jos-store-empty"><h3>No products yet</h3><p>Add gear, retail, gift cards, or digital products your customers can buy.</p>' +
        '<button type="button" class="jos-btn jos-btn-brand" data-jos-act="store-product-new">+ New Product</button></div>';

    return '<section class="jos-store-toolbar">' +
      '<label class="jos-store-search"><input id="jos-store-search" type="search" placeholder="Search products, SKUs, categories..." value="' + esc(root._josStoreQ || '') + '"></label>' +
      '<select id="jos-store-status" class="jos-store-dd" aria-label="Status"><option value="all"' + (status === 'all' ? ' selected' : '') + '>All statuses</option>' +
      ['active', 'draft'].map(function (s) {
        return '<option value="' + s + '"' + (status === s ? ' selected' : '') + '>' + s + '</option>';
      }).join('') + '</select>' +
      '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="store-import">Import</button>' +
      '</section>' +
      '<section class="jos-store-card">' + table + '</section>';
  }

  function renderCollections(root, os) {
    if (!os.collections.length) {
      return '<div class="jos-store-empty"><h3>No collections</h3><p>Group products for your site, van shelf, or booking upsells.</p>' +
        '<button type="button" class="jos-btn jos-btn-brand" data-jos-act="store-collection-new">+ New Collection</button></div>';
    }
    return '<section class="jos-store-card"><div class="jos-store-coll-grid">' + os.collections.map(function (c) {
      var count = (c.productIds || []).length;
      return '<article class="jos-store-coll">' +
        '<div class="jos-between"><strong>' + esc(c.name) + '</strong>' + statusPill(c.published ? 'active' : 'draft') + '</div>' +
        '<p class="jos-muted">' + esc(c.description || '') + '</p>' +
        '<div class="jos-store-coll-foot"><span>' + count + ' product' + (count === 1 ? '' : 's') + '</span>' +
        '<button type="button" class="jos-linkish" data-jos-act="store-collection-edit" data-jos-id="' + esc(c.id) + '">Edit</button></div></article>';
    }).join('') + '</div></section>';
  }

  function renderOrders(root, os) {
    var rows = os.orders.slice();
    var table = rows.length ? '<div class="jos-store-table-wrap"><table class="jos-store-table"><thead><tr>' +
      '<th>Order</th><th>Customer</th><th>Channel</th><th>Fulfillment</th><th>Status</th><th>Total</th></tr></thead><tbody>' +
      rows.map(function (o) {
        return '<tr>' +
          '<td><strong>' + esc(o.number) + '</strong><span class="jos-muted">' + esc(o.createdAt) + '</span></td>' +
          '<td><strong>' + esc(o.customer) + '</strong><span class="jos-muted">' + esc(o.email) + '</span></td>' +
          '<td>' + esc(o.channel) + '</td>' +
          '<td>' + statusPill(o.fulfillment) + '</td>' +
          '<td>' + statusPill(o.status) + '</td>' +
          '<td><strong>' + esc(money(o.total)) + '</strong></td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<div class="jos-store-empty"><h3>No orders yet</h3><p>Create a manual order or wait for website checkout.</p>' +
        '<button type="button" class="jos-btn jos-btn-brand" data-jos-act="store-order-new">+ New Order</button></div>';
    return '<section class="jos-store-card">' + table + '</section>';
  }

  function renderInventory(root, os) {
    var physical = os.products.filter(function (p) { return p.type !== 'gift_card' && p.stock != null; });
    var low = physical.filter(function (p) { return p.stock <= (p.lowStock || 0); });
    var alert = low.length
      ? '<div class="jos-store-alert"><strong>' + low.length + ' product' + (low.length === 1 ? '' : 's') + ' low on stock</strong><span>Reorder before jobs run out of retail add-ons.</span></div>'
      : '<div class="jos-store-alert ok"><strong>Inventory looks healthy</strong><span>No SKUs under their low-stock threshold.</span></div>';
    var table = '<div class="jos-store-table-wrap"><table class="jos-store-table"><thead><tr>' +
      '<th>Product</th><th>SKU</th><th>On hand</th><th>Low at</th><th>Adjust</th></tr></thead><tbody>' +
      physical.map(function (p) {
        var isLow = p.stock <= (p.lowStock || 0);
        return '<tr>' +
          '<td>' + productThumb(p) + '<strong>' + esc(p.name) + '</strong></td>' +
          '<td>' + esc(p.sku) + '</td>' +
          '<td class="' + (isLow ? 'jos-store-low' : '') + '"><strong>' + esc(p.stock) + '</strong></td>' +
          '<td>' + esc(p.lowStock) + '</td>' +
          '<td><div class="jos-store-adj">' +
          '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="store-stock-dec" data-jos-id="' + esc(p.id) + '">−</button>' +
          '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="store-stock-inc" data-jos-id="' + esc(p.id) + '">+</button>' +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
    return alert + '<section class="jos-store-card">' + (physical.length ? table : '<div class="jos-store-empty"><h3>No tracked inventory</h3><p>Physical products with stock levels appear here.</p></div>') + '</section>';
  }

  function renderDiscounts(root, os) {
    var table = os.discounts.length ? '<div class="jos-store-table-wrap"><table class="jos-store-table"><thead><tr>' +
      '<th>Code</th><th>Type</th><th>Value</th><th>Uses</th><th>Status</th><th></th></tr></thead><tbody>' +
      os.discounts.map(function (d) {
        var val = d.type === 'percent' ? (d.value + '%') : money(d.value);
        return '<tr>' +
          '<td><strong>' + esc(d.code) + '</strong></td>' +
          '<td>' + esc(d.type) + '</td>' +
          '<td>' + esc(val) + '</td>' +
          '<td>' + esc(d.uses) + (d.limit ? ' / ' + esc(d.limit) : '') + '</td>' +
          '<td>' + statusPill(d.status) + '</td>' +
          '<td><button type="button" class="jos-linkish" data-jos-act="store-discount-edit" data-jos-id="' + esc(d.id) + '">Edit</button></td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<div class="jos-store-empty"><h3>No discounts</h3><p>Create codes for kits, seasonal gear, or first-time buyers.</p>' +
        '<button type="button" class="jos-btn jos-btn-brand" data-jos-act="store-discount-new">+ New Discount</button></div>';
    return '<section class="jos-store-card">' + table + '</section>';
  }

  function renderProductModal(root, os) {
    if (!root._josStoreProductModal) return '';
    var editId = root._josStoreProductEditId;
    var p = editId ? productById(editId) : null;
    var mode = root._josStoreProductCreateMode || 'manual';
    var d = root._josStoreProductDraft || p || {
      name: '', sku: '', price: '', stock: '', status: 'active', category: '', description: '', type: 'physical'
    };
    var createChooser = !p
      ? '<div class="jos-store-create-modes">' +
        [['manual', 'Manual'], ['import', 'Import'], ['ai', 'Generate with AI']].map(function (m) {
          return '<button type="button" class="jos-btn jos-btn-sm' + (mode === m[0] ? ' on' : '') + '" data-jos-act="store-product-mode" data-mode="' + m[0] + '">' + m[1] + '</button>';
        }).join('') + '</div>'
      : '';
    var aiPane = (!p && mode === 'ai')
      ? '<div class="jos-store-ai-gen"><p class="jos-muted">Upload images, a manufacturer PDF, or a product URL. Hubly AI fills name, SEO, FAQs, and pricing when configured.</p>' +
        '<label class="full">Website URL<input id="jos-store-p-ai-url" type="url" placeholder="https://…"></label>' +
        '<label class="full">Notes / PDF text<textarea id="jos-store-p-ai-notes" rows="3" placeholder="Paste specs…"></textarea></label>' +
        '<button type="button" class="jos-btn jos-btn-brand" data-jos-act="store-product-ai-generate">Generate draft</button></div>'
      : '';
    var formHidden = !p && mode !== 'manual' && mode !== 'ai';
    return '<div class="jos-store-modal-backdrop" data-jos-act="store-product-close">' +
      '<div class="jos-store-modal" role="dialog" aria-label="Product" onclick="event.stopPropagation()">' +
      '<div class="jos-between"><div><div class="jos-kicker">Store</div><h2>' + (p ? 'Edit product' : 'New product') + '</h2></div>' +
      '<button type="button" class="jos-icon-btn" data-jos-act="store-product-close" aria-label="Close">✕</button></div>' +
      createChooser + aiPane +
      (mode === 'import' && !p
        ? '<p class="jos-muted">CSV import uses POST /products/import when Commerce API is connected.</p><button type="button" class="jos-btn" data-jos-act="store-import">Import CSV</button>'
        : '') +
      '<div class="jos-store-form"' + (formHidden ? ' hidden' : '') + '>' +
      '<label>Name<input id="jos-store-p-name" type="text" value="' + esc(d.name || '') + '" placeholder="Ceramic Coating Kit"></label>' +
      '<label>SKU<input id="jos-store-p-sku" type="text" value="' + esc(d.sku || '') + '" placeholder="CER-KIT-01"></label>' +
      '<label>Price<input id="jos-store-p-price" type="number" step="0.01" value="' + esc(d.price != null ? d.price : '') + '" placeholder="0"></label>' +
      '<label>Stock<input id="jos-store-p-stock" type="number" value="' + esc(d.stock != null ? d.stock : '') + '" placeholder="0"></label>' +
      '<label>Type<select id="jos-store-p-type"><option value="physical"' + ((d.type || 'physical') === 'physical' ? ' selected' : '') + '>Physical</option><option value="gift_card"' + (d.type === 'gift_card' ? ' selected' : '') + '>Gift card</option><option value="digital"' + (d.type === 'digital' ? ' selected' : '') + '>Digital</option></select></label>' +
      '<label>Status<select id="jos-store-p-status"><option value="active"' + ((d.status || 'active') === 'active' ? ' selected' : '') + '>Active</option><option value="draft"' + (d.status === 'draft' ? ' selected' : '') + '>Draft</option></select></label>' +
      '<label class="full">Category<input id="jos-store-p-cat" type="text" value="' + esc(d.category || '') + '" placeholder="Detailing gear"></label>' +
      '<label class="full">Description<textarea id="jos-store-p-desc" rows="3" placeholder="What customers get…">' + esc(d.description || '') + '</textarea></label>' +
      '</div>' +
      '<div class="jos-btn-row jos-mt">' +
      '<button type="button" class="jos-btn jos-btn-brand" data-jos-act="store-product-save">Save product</button>' +
      '<button type="button" class="jos-btn" data-jos-act="store-product-close">Cancel</button>' +
      '</div></div></div>';
  }

  function renderPage(root) {
    var os = ensureStoreOsState();
    var tab = root._josStoreTab || 'overview';
    var stats = storeStats(os);
    var body = tab === 'overview' ? renderOverview(root, os)
      : tab === 'products' ? renderProducts(root, os)
        : tab === 'collections' ? renderCollections(root, os)
          : tab === 'bundles' ? renderBundles(root, os)
            : tab === 'orders' ? renderOrders(root, os)
              : tab === 'inventory' ? renderInventory(root, os)
                : tab === 'discounts' ? renderDiscounts(root, os)
                  : tab === 'analytics' ? renderAnalytics(root, os)
                    : tab === 'ai' ? renderAiTab(root, os)
                      : renderSettings(root, os);

    var primaryAct = tab === 'collections' ? 'store-collection-new'
      : tab === 'bundles' ? 'store-bundle-new'
        : tab === 'discounts' ? 'store-discount-new'
          : tab === 'orders' ? 'store-order-new'
            : tab === 'inventory' ? 'store-export'
              : tab === 'settings' || tab === 'overview' || tab === 'analytics' || tab === 'ai' ? 'store-tab-products'
                : 'store-product-new';
    var primaryLabel = tab === 'collections' ? '+ New Collection'
      : tab === 'bundles' ? '+ New Bundle'
        : tab === 'discounts' ? '+ New Discount'
          : tab === 'orders' ? '+ New Order'
            : tab === 'inventory' ? 'Export inventory'
              : tab === 'settings' || tab === 'overview' || tab === 'analytics' || tab === 'ai' ? 'Manage products'
                : '+ New Product';

    root.innerHTML =
      '<div class="jos-store-shell">' +
      '<div class="jos-store-page">' +
      '<header class="jos-store-header hub-page-header">' +
      '<div><h1 class="hub-page-title">Store</h1><p class="hub-page-sub">Sell products, kits, gift cards, and add-ons — alongside your services.</p></div>' +
      '<div class="jos-store-header-actions hub-page-actions">' +
      '<button type="button" class="jos-btn jos-store-export" data-jos-act="store-export">Export</button>' +
      '<button type="button" class="jos-btn jos-btn-brand jos-store-new" data-jos-act="' + primaryAct + '">' + esc(primaryLabel) + '</button>' +
      '</div></header>' +
      '<div class="jos-store-meta" aria-label="Store summary">' +
      '<button type="button" class="jos-store-meta-chip" data-jos-act="store-tab-products"><span>Products</span><strong>' + stats.products + '</strong></button>' +
      '<button type="button" class="jos-store-meta-chip" data-jos-act="store-tab-orders"><span>Open orders</span><strong>' + stats.openOrders + '</strong></button>' +
      '<button type="button" class="jos-store-meta-chip" data-jos-act="store-tab-inventory"><span>Low stock</span><strong>' + stats.low + '</strong></button>' +
      '<button type="button" class="jos-store-meta-chip revenue" data-jos-act="store-tab-analytics"><span>Product revenue</span><strong>' + esc(money(stats.revenue)) + '</strong></button>' +
      '</div>' +
      renderTabs(tab) +
      body +
      '</div>' +
      renderProductModal(root, os) +
      renderOrderModal(root, os) +
      '<button type="button" class="jos-store-fab" data-jos-act="store-product-new" aria-label="New Product">+</button>' +
      '</div>';
  }

  function renderOrderModal(root, os) {
    if (!root._josStoreOrderModal) return '';
    var products = (os.products || []).filter(function (p) { return p.status === 'active'; });
    var opts = products.length
      ? products.map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.name) + ' · ' + esc(money(p.price)) + '</option>';
      }).join('')
      : '<option value="">Add a product first</option>';
    return '<div class="jos-store-modal-backdrop" data-jos-act="store-order-close">' +
      '<div class="jos-store-modal" role="dialog" aria-label="New order" onclick="event.stopPropagation()">' +
      '<div class="jos-between"><div><div class="jos-kicker">Store</div><h2>New order</h2></div>' +
      '<button type="button" class="jos-icon-btn" data-jos-act="store-order-close" aria-label="Close">✕</button></div>' +
      '<div class="jos-store-form">' +
      '<label class="full">Customer name<input id="jos-store-o-name" type="text" placeholder="Jordan Lee" required></label>' +
      '<label class="full">Email<input id="jos-store-o-email" type="email" placeholder="jordan@email.com"></label>' +
      '<label>Product<select id="jos-store-o-product">' + opts + '</select></label>' +
      '<label>Qty<input id="jos-store-o-qty" type="number" min="1" value="1"></label>' +
      '<label>Channel<select id="jos-store-o-channel"><option>In person</option><option>Website</option><option>Phone</option></select></label>' +
      '<label>Status<select id="jos-store-o-status"><option value="paid">Paid</option><option value="pending">Pending</option></select></label>' +
      '</div>' +
      '<div class="jos-btn-row jos-mt">' +
      '<button type="button" class="jos-btn jos-btn-brand" data-jos-act="store-order-save">Save order</button>' +
      '<button type="button" class="jos-btn" data-jos-act="store-order-close">Cancel</button>' +
      '</div></div></div>';
  }

  function readProductDraft() {
    return {
      name: (el('jos-store-p-name') || {}).value || '',
      sku: (el('jos-store-p-sku') || {}).value || '',
      price: Number((el('jos-store-p-price') || {}).value) || 0,
      stock: (el('jos-store-p-stock') || {}).value === '' ? null : Number((el('jos-store-p-stock') || {}).value) || 0,
      type: (el('jos-store-p-type') || {}).value || 'physical',
      status: (el('jos-store-p-status') || {}).value || 'active',
      category: (el('jos-store-p-cat') || {}).value || '',
      description: (el('jos-store-p-desc') || {}).value || ''
    };
  }

  function saveProduct(root) {
    var perms = global.HublyCommercePermissions;
    if (perms && !perms.can('edit_products')) {
      toast('Your role cannot edit products');
      return;
    }
    if (perms && !perms.can('edit_pricing') && root._josStoreProductEditId) {
      toast('Your role cannot edit pricing');
      return;
    }
    var os = ensureStoreOsState();
    var d = readProductDraft();
    if (!String(d.name || '').trim()) { toast('Product name is required'); return; }
    var editId = root._josStoreProductEditId;
    if (editId) {
      var existing = productById(editId);
      if (existing) {
        Object.assign(existing, d, {
          stock: d.type === 'gift_card' ? null : d.stock,
          lowStock: existing.lowStock != null ? existing.lowStock : 5,
          visibility: existing.visibility || (global.HublyCommerceTypes && global.HublyCommerceTypes.DEFAULT_VISIBILITY)
        });
        publishCommerce('emitProductUpdated', existing);
      }
      toast('Product updated');
    } else {
      var created = {
        id: id('prod'),
        sku: d.sku || ('SKU-' + Math.floor(Math.random() * 9000 + 1000)),
        name: d.name.trim(),
        type: d.type,
        status: d.status,
        price: d.price,
        compareAt: 0,
        cost: 0,
        stock: d.type === 'gift_card' ? null : (d.stock != null ? d.stock : 0),
        lowStock: d.type === 'gift_card' ? null : 5,
        collectionIds: [],
        category: d.category || 'Product',
        vendor: S().biz || 'Hubly',
        description: d.description,
        imageTone: 'orange',
        featured: false,
        visibility: global.HublyCommerceTypes
          ? Object.assign({}, global.HublyCommerceTypes.DEFAULT_VISIBILITY)
          : { website: true, booking: true, customerPortal: true, quoteBuilder: true, email: true, memberships: false },
        createdAt: todayStr()
      };
      os.products.unshift(created);
      publishCommerce('emitProductCreated', created);
      toast('Product saved');
    }
    root._josStoreProductModal = false;
    root._josStoreProductEditId = null;
    root._josStoreProductDraft = null;
    root._josStoreProductCreateMode = 'manual';
    root._josStoreTab = 'products';
    persistStoreOs();
    render();
  }

  function handleAct(act, t, root) {
    var os = ensureStoreOsState();
    if (act === 'store-tab-overview') { root._josStoreTab = 'overview'; return render(); }
    if (act === 'store-tab-products') { root._josStoreTab = 'products'; return render(); }
    if (act === 'store-tab-collections') { root._josStoreTab = 'collections'; return render(); }
    if (act === 'store-tab-bundles') { root._josStoreTab = 'bundles'; return render(); }
    if (act === 'store-tab-orders') { root._josStoreTab = 'orders'; return render(); }
    if (act === 'store-tab-inventory') { root._josStoreTab = 'inventory'; return render(); }
    if (act === 'store-tab-discounts') { root._josStoreTab = 'discounts'; return render(); }
    if (act === 'store-tab-analytics') { root._josStoreTab = 'analytics'; return render(); }
    if (act === 'store-tab-ai') { root._josStoreTab = 'ai'; return render(); }
    if (act === 'store-tab-settings') { root._josStoreTab = 'settings'; return render(); }
    if (act === 'store-preview-device') {
      root._josStorePreviewDevice = t.getAttribute('data-device') || 'desktop';
      return render();
    }
    if (act === 'store-product-new') {
      root._josStoreProductModal = true;
      root._josStoreProductEditId = null;
      root._josStoreProductCreateMode = 'manual';
      root._josStoreProductDraft = { name: '', sku: '', price: '', stock: '', status: 'active', type: 'physical', category: '', description: '' };
      return render();
    }
    if (act === 'store-product-mode') {
      root._josStoreProductCreateMode = t.getAttribute('data-mode') || 'manual';
      return render();
    }
    if (act === 'store-product-ai-generate') {
      var ai = global.HublyCommerceAI;
      if (!ai) { toast('AI module not loaded'); return; }
      ai.generateProductFromSources({
        url: (el('jos-store-p-ai-url') || {}).value,
        notes: (el('jos-store-p-ai-notes') || {}).value
      }).then(function (res) {
        toast(res.message || 'Generate with AI — Stage 2');
        root._josStoreProductCreateMode = 'manual';
        render();
      });
      return;
    }
    if (act === 'store-product-edit') {
      root._josStoreProductModal = true;
      root._josStoreProductEditId = t.getAttribute('data-jos-id');
      root._josStoreProductDraft = null;
      return render();
    }
    if (act === 'store-product-close') {
      root._josStoreProductModal = false;
      root._josStoreProductEditId = null;
      return render();
    }
    if (act === 'store-product-save') return saveProduct(root);
    if (act === 'store-product-menu') {
      var menuId = t.getAttribute('data-jos-id');
      if (menuId && global.HublyCommerceApi) {
        toast('Duplicate · Archive · Share link — connect Commerce API to publish live');
      } else {
        toast('Duplicate · Archive · Share link — coming with live publish');
      }
      return;
    }
    if (act === 'store-collection-new' || act === 'store-collection-edit') {
      var colName = window.prompt(act === 'store-collection-new' ? 'Collection name' : 'Rename collection', 'New collection');
      if (!colName || !String(colName).trim()) return;
      if (act === 'store-collection-new') {
        os.collections.push({
          id: id('col'),
          name: String(colName).trim(),
          description: '',
          productIds: [],
          published: true
        });
        toast('Collection saved');
      } else {
        var col = os.collections.find(function (c) { return c.id === t.getAttribute('data-jos-id'); });
        if (col) { col.name = String(colName).trim(); toast('Collection updated'); }
      }
      persistStoreOs();
      return render();
    }
    if (act === 'store-bundle-new' || act === 'store-bundle-edit') {
      var bunTitle = window.prompt(act === 'store-bundle-new' ? 'Bundle title' : 'Rename bundle', 'New bundle');
      if (!bunTitle || !String(bunTitle).trim()) return;
      if (act === 'store-bundle-new') {
        os.bundles.push({
          id: id('bun'),
          title: String(bunTitle).trim(),
          description: '',
          price: 0,
          discount: 0,
          featured: false,
          status: 'active',
          productIds: []
        });
        toast('Bundle saved');
      } else {
        var bun = os.bundles.find(function (b) { return b.id === t.getAttribute('data-jos-id'); });
        if (bun) { bun.title = String(bunTitle).trim(); toast('Bundle updated'); }
      }
      persistStoreOs();
      return render();
    }
    if (act === 'store-discount-new' || act === 'store-discount-edit') {
      var code = window.prompt(act === 'store-discount-new' ? 'Discount code' : 'Update code', 'SAVE10');
      if (!code || !String(code).trim()) return;
      if (act === 'store-discount-new') {
        os.discounts.push({
          id: id('disc'),
          code: String(code).trim().toUpperCase(),
          type: 'percent',
          value: 10,
          status: 'active',
          uses: 0,
          limit: 100,
          appliesTo: 'all',
          endsAt: ''
        });
        toast('Discount saved');
      } else {
        var disc = os.discounts.find(function (d) { return d.id === t.getAttribute('data-jos-id'); });
        if (disc) { disc.code = String(code).trim().toUpperCase(); toast('Discount updated'); }
      }
      persistStoreOs();
      return render();
    }
    if (act === 'store-order-new') {
      root._josStoreOrderModal = true;
      root._josStoreTab = 'orders';
      return render();
    }
    if (act === 'store-order-close') {
      root._josStoreOrderModal = false;
      return render();
    }
    if (act === 'store-order-save') {
      var oName = String((el('jos-store-o-name') || {}).value || '').trim();
      var oEmail = String((el('jos-store-o-email') || {}).value || '').trim();
      var oPid = (el('jos-store-o-product') || {}).value || '';
      var oQty = Math.max(1, Number((el('jos-store-o-qty') || {}).value) || 1);
      var oChannel = (el('jos-store-o-channel') || {}).value || 'In person';
      var oStatus = (el('jos-store-o-status') || {}).value || 'paid';
      if (!oName) { toast('Customer name is required'); return; }
      var prod = productById(oPid);
      if (!prod) { toast('Add an active product before creating an order'); return; }
      var total = (Number(prod.price) || 0) * oQty;
      var nextNum = 1000 + os.orders.length + 1;
      var order = {
        id: id('ord'),
        number: '#' + nextNum,
        status: oStatus,
        channel: oChannel,
        customer: oName,
        email: oEmail,
        total: total,
        items: [{ productId: prod.id, qty: oQty, price: Number(prod.price) || 0 }],
        createdAt: todayStr(),
        fulfillment: prod.type === 'gift_card' || prod.type === 'digital' ? 'digital' : 'unfulfilled'
      };
      os.orders.unshift(order);
      if (prod.stock != null && prod.type !== 'gift_card') {
        prod.stock = Math.max(0, (Number(prod.stock) || 0) - oQty);
      }
      publishCommerce('emitOrderCreated', order);
      root._josStoreOrderModal = false;
      toast('Order ' + order.number + ' saved');
      persistStoreOs();
      return render();
    }
    if (act === 'store-settings-save') {
      os.settings.enabled = ((el('jos-store-s-enabled') || {}).value || '1') === '1';
      os.settings.showOnWebsite = ((el('jos-store-s-website') || {}).value || '1') === '1';
      os.settings.storePath = (el('jos-store-s-path') || {}).value || '/store';
      os.settings.heroTitle = (el('jos-store-s-hero') || {}).value || '';
      os.settings.heroSubtitle = (el('jos-store-s-sub') || {}).value || '';
      toast('Store settings saved');
      persistStoreOs();
      try {
        if (typeof global.renderWebsite === 'function') global.renderWebsite();
        if (typeof global.renderWebsitePreview === 'function') global.renderWebsitePreview();
      } catch (eWs) {}
      root._josStoreTab = 'overview';
      return render();
    }
    if (act === 'store-stock-inc' || act === 'store-stock-dec') {
      var pid = t.getAttribute('data-jos-id');
      var prod = productById(pid);
      if (!prod || prod.stock == null) return;
      var before = Number(prod.stock) || 0;
      prod.stock = Math.max(0, before + (act === 'store-stock-inc' ? 1 : -1));
      publishCommerce('emitInventoryChanged', {
        productId: prod.id, before: before, after: prod.stock, reason: 'manual.adjust'
      });
      toast(prod.name + ' · ' + prod.stock + ' in stock');
      persistStoreOs();
      return render();
    }
    if (act === 'store-import') {
      toast('CSV import — POST /products/import when Commerce API is connected');
      return;
    }
    if (act === 'store-export') {
      var lines = ['sku,name,status,price,stock'];
      os.products.forEach(function (p) {
        lines.push([p.sku, p.name, p.status, p.price, p.stock == null ? '' : p.stock].join(','));
      });
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lines.join('\n'));
      } catch (e) {}
      toast('Exported ' + os.products.length + ' products');
    }
  }

  function wireRoot(root) {
    if (root._josStoreBound) return;
    root._josStoreBound = true;
    root.addEventListener('click', function (e) {
      var tabBtn = e.target.closest('[data-jos-store-tab]');
      if (tabBtn) {
        root._josStoreTab = tabBtn.getAttribute('data-jos-store-tab');
        render();
        e.stopPropagation();
        return;
      }
      var actEl = e.target.closest('[data-jos-act]');
      if (!actEl) return;
      var act = actEl.getAttribute('data-jos-act') || '';
      if (act.indexOf('store-') !== 0) return;
      e.preventDefault();
      handleAct(act, actEl, root);
    });
    root.addEventListener('submit', function (e) {
      var form = e.target.closest('[data-commerce-act="ai-coach-ask"]');
      if (!form) return;
      e.preventDefault();
      var q = (form.querySelector('[name="q"]') || {}).value || '';
      var out = root.querySelector('[data-commerce-ai-out]');
      var ai = global.HublyCommerceAI;
      if (!ai) {
        if (out) out.innerHTML = '<p class="jos-muted">AI coach not loaded.</p>';
        return;
      }
      ai.ask(q).then(function (res) {
        if (!out) return;
        var C = global.HublyCommerceComponents;
        out.innerHTML = '<p>' + esc(res.message) + '</p>' +
          (C && res.products && res.products.length ? C.ProductGrid(res.products) : '<p class="jos-muted">Source: ' + esc(res.source) + '</p>');
      });
    });
    root.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'jos-store-search') {
        root._josStoreQ = e.target.value;
        clearTimeout(root._josStoreSearchT);
        root._josStoreSearchT = setTimeout(function () { render(); }, 140);
      }
      if (e.target && (e.target.id === 'jos-store-s-hero' || e.target.id === 'jos-store-s-sub' || e.target.id === 'jos-store-s-path')) {
        var osLive = ensureStoreOsState();
        if (e.target.id === 'jos-store-s-hero') osLive.settings.heroTitle = e.target.value;
        if (e.target.id === 'jos-store-s-sub') osLive.settings.heroSubtitle = e.target.value;
        if (e.target.id === 'jos-store-s-path') osLive.settings.storePath = e.target.value;
      }
    });
    root.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'jos-store-status') {
        root._josStoreStatus = e.target.value;
        render();
      }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && (root._josStoreProductModal || root._josStoreOrderModal)) {
        root._josStoreProductModal = false;
        root._josStoreOrderModal = false;
        render();
      }
    });
  }

  function render() {
    var root = ownRoot();
    if (!root) return;
    setStoreMode(true);
    if (typeof global.HublyJourneyOS?.updateChrome === 'function') {
      try { global.HublyJourneyOS.updateChrome('store'); } catch (e) {}
    }
    try {
      renderPage(root);
      wireRoot(root);
    } catch (err) {
      console.warn('Hubly Store', err);
      root.innerHTML = '<div class="jos-store-shell"><div class="jos-empty jos-error-state"><strong>Store could not load</strong><p class="jos-muted">Refresh and try again.</p><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="store-tab-products">Retry</button></div></div>';
      wireRoot(root);
    }
  }

  var api = {
    render: render,
    setMode: setStoreMode,
    ensureState: ensureStoreOsState,
    handleAct: function (act, elNode) {
      var root = el('jos-store-root');
      if (root) handleAct(act, elNode || document.body, root);
    }
  };
  global.HublyStoreCommerce = api;
  if (global.HublyJourneyOS) {
    global.HublyJourneyOS.renderStore = render;
    global.HublyJourneyOS.setStoreMode = setStoreMode;
  }
})(typeof window !== 'undefined' ? window : this);
