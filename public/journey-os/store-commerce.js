/**
 * Hubly Store — owner Commerce Engine (Operate).
 * UI label: Store. Internally: commerce (products, collections, bundles, orders, inventory).
 * Distinct from Website Storefront (services) and Apps Marketplace (integrations).
 *
 * SSOT (Storefront Phase 1): commerce_products / commerce_collections / commerce_bundles /
 * commerce_orders / commerce_store_settings via HublyCommerceApi (Edge Function commerce-api).
 * The owner admin reads and writes the Commerce DB ONLY. It no longer reads or writes the
 * legacy S.storeOs blob (businesses.meta) — that blob is fenced off and left solely for the
 * public website Store embed until Phase 2 repoints it. `view` below is a read-through
 * projection of the DB; it is never persisted to businesses.meta.
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
  function money(n) {
    var v = Number(n) || 0;
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
    } catch (e) {
      return '$' + Math.round(v);
    }
  }
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }
  function defaultVisibility() {
    var T = global.HublyCommerceTypes;
    return T && T.DEFAULT_VISIBILITY
      ? Object.assign({}, T.DEFAULT_VISIBILITY)
      : { website: true, booking: true, customerPortal: true, quoteBuilder: true, email: true, memberships: false };
  }

  // ── DB-backed view cache (a projection of the Commerce DB — never persisted) ──
  var view = {
    products: [], collections: [], bundles: [], orders: [],
    discounts: [], documents: [], activity: [],
    settings: {
      enabled: true, showOnWebsite: true, storePath: '/store',
      heroTitle: '', heroSubtitle: '', currency: 'usd',
      widgets: { aiCoach: true, learningCenter: true }
    },
    imagesByProduct: {}, variantsByProduct: {},
    loaded: false, loading: false, error: null
  };

  function ensureStoreOsState() { return view; }

  function commerce() { return global.HublyCommerceApi || null; }

  // ── DB row → view shape mappers ─────────────────────────────────────────────
  function productToView(row) {
    var meta = row.metadata || {};
    var giftCard = row.product_type === 'gift_card';
    return {
      id: row.id,
      sku: row.sku || '',
      name: row.name || '',
      type: row.product_type || 'physical',
      status: row.status || 'draft',
      price: (Number(row.price_cents) || 0) / 100,
      compareAt: row.compare_at_cents != null ? Number(row.compare_at_cents) / 100 : 0,
      cost: row.cost_cents != null ? Number(row.cost_cents) / 100 : 0,
      stock: giftCard ? null : (row.inventory != null ? Number(row.inventory) : null),
      lowStock: row.low_stock_at != null ? Number(row.low_stock_at) : 5,
      category: meta.category || row.brand || 'Product',
      description: row.description || '',
      imageTone: meta.imageTone || 'orange',
      featured: !!row.featured,
      visibility: row.visibility || defaultVisibility(),
      collectionIds: [],
      createdAt: String(row.created_at || '').slice(0, 10)
    };
  }
  function orderToView(row) {
    return {
      id: row.id,
      number: row.order_number || String(row.id).slice(0, 8),
      status: row.status || 'pending',
      channel: row.channel || 'website',
      customer: row.customer_name || '—',
      email: row.customer_email || '',
      total: (Number(row.total_cents) || 0) / 100,
      items: (row.commerce_order_items || []).map(function (it) {
        return { productId: it.product_id, qty: Number(it.qty) || 1, price: (Number(it.unit_price_cents) || 0) / 100 };
      }),
      createdAt: String(row.created_at || '').slice(0, 10),
      fulfillment: row.fulfillment || 'unfulfilled'
    };
  }
  function collectionToView(row) {
    return { id: row.id, name: row.name || '', description: row.description || '', productIds: [], published: !!row.published, slug: row.slug };
  }
  function bundleToView(row) {
    return {
      id: row.id, title: row.title || '', description: row.description || '',
      price: (Number(row.price_cents) || 0) / 100,
      discount: (Number(row.discount_cents) || 0) / 100,
      featured: !!row.featured, status: row.status || 'draft', productIds: []
    };
  }
  function settingsToView(row) {
    row = row || {};
    var theme = row.theme || {};
    return {
      enabled: row.enabled !== false,
      showOnWebsite: !(theme.showOnWebsite === false),
      storePath: row.store_path || '/store',
      heroTitle: row.hero_title || '',
      heroSubtitle: row.hero_subtitle || '',
      currency: row.currency || 'usd',
      widgets: { aiCoach: true, learningCenter: true }
    };
  }

  // draft (modal inputs) → commerce-api body
  function productToApiBody(d, isCreate) {
    var body = {
      name: String(d.name || '').trim(),
      sku: d.sku || undefined,
      price: Number(d.price) || 0,
      status: d.status || 'active',
      type: d.type || 'physical',
      description: d.description || '',
      metadata: { category: d.category || '' }
    };
    if (d.type !== 'gift_card') body.stock = d.stock != null ? Number(d.stock) : 0;
    if (isCreate) body.visibility = defaultVisibility();
    return body;
  }

  // ── DB loads ────────────────────────────────────────────────────────────────
  function loadStore(force) {
    var api = commerce();
    if (!api || !S().businessId) { view.error = 'not_ready'; return Promise.resolve(); }
    if (view.loading) return Promise.resolve();
    if (view.loaded && !force) return Promise.resolve();
    view.loading = true;
    return Promise.all([
      api.listProducts(), api.listCollections(), api.listBundles(), api.listOrders(), api.getStoreSettings()
    ]).then(function (res) {
      var pr = res[0], co = res[1], bu = res[2], or = res[3], se = res[4];
      view.products = (pr.ok && pr.data.products ? pr.data.products : []).map(productToView);
      view.collections = (co.ok && co.data.collections ? co.data.collections : []).map(collectionToView);
      view.bundles = (bu.ok && bu.data.bundles ? bu.data.bundles : []).map(bundleToView);
      view.orders = (or.ok && or.data.orders ? or.data.orders : []).map(orderToView);
      if (se.ok && se.data.settings) view.settings = settingsToView(se.data.settings);
      view.error = pr.ok ? null : (pr.error || 'load_failed');
      view.loaded = true;
    }).catch(function (e) {
      view.error = String((e && e.message) || e);
    }).then(function () {
      view.loading = false;
    });
  }

  function loadProductDetail(pid) {
    var api = commerce();
    if (!api || !pid) return Promise.resolve();
    return Promise.all([api.listProductImages(pid), api.listProductVariants(pid)]).then(function (res) {
      view.imagesByProduct[pid] = res[0].ok && res[0].data.images ? res[0].data.images : [];
      view.variantsByProduct[pid] = res[1].ok && res[1].data.variants ? res[1].data.variants : [];
    }).catch(function () {
      view.imagesByProduct[pid] = view.imagesByProduct[pid] || [];
      view.variantsByProduct[pid] = view.variantsByProduct[pid] || [];
    });
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
    var vw = el('v-store');
    if (!vw) return null;
    vw.classList.add('jos-pixel-owned');
    vw.classList.remove('hidden');
    vw.hidden = false;
    var root = el('jos-store-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'jos-store-root';
      vw.appendChild(root);
    }
    Array.prototype.slice.call(vw.children).forEach(function (ch) {
      if (ch.id !== 'jos-store-root') ch.remove();
    });
    return root;
  }

  function productById(idVal) {
    return view.products.find(function (p) { return p.id === idVal; }) || null;
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
      revenue: money(stats.revenue), orders: stats.orders, aov: money(stats.aov),
      conversion: stats.conversion, topProduct: stats.topProduct, lowStock: stats.low,
      repeat: stats.repeat, abandoned: stats.abandoned
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
        revenue: money(stats.revenue), orders: stats.orders, aov: money(stats.aov),
        conversion: stats.conversion, topProduct: stats.topProduct, lowStock: stats.low,
        repeat: stats.repeat, abandoned: stats.abandoned
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
      '<p class="jos-muted full">Store settings are saved to your Commerce database. When enabled, active products appear in a Store section on your Instant Site.</p>' +
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
          '<td><button type="button" class="jos-icon-btn" data-jos-act="store-product-edit" data-jos-id="' + esc(p.id) + '" aria-label="Edit">⋯</button></td></tr>';
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
      : '<div class="jos-store-empty"><h3>No orders yet</h3><p>Orders arrive here from Storefront checkout once a customer buys.</p>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="store-refresh">Refresh</button></div>';
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
    // Discount codes are a later Storefront phase (no commerce endpoint yet). Placeholder
    // only — no writes, so the Store admin never persists a parallel/blob discount store.
    return '<section class="jos-store-card"><div class="jos-store-empty">' +
      '<h3>Discount codes</h3><p>Percentage and fixed discounts arrive in a later Storefront phase, applied at checkout against your Commerce database.</p>' +
      '</div></section>';
  }

  function renderImagesSection(pid) {
    var images = view.imagesByProduct[pid] || [];
    var list = images.length
      ? '<div class="jos-store-img-grid">' + images.map(function (im) {
        return '<div class="jos-store-img-chip"><img src="' + esc(im.url) + '" alt="' + esc(im.alt || '') + '" loading="lazy">' +
          '<button type="button" class="jos-icon-btn" data-jos-act="store-image-remove" data-jos-id="' + esc(im.id) + '" aria-label="Remove image">✕</button></div>';
      }).join('') + '</div>'
      : '<p class="jos-muted">No images yet.</p>';
    return '<div class="jos-store-subsection"><strong>Images</strong>' + list +
      '<div class="jos-store-inline-add"><input id="jos-store-img-url" type="url" placeholder="https://image-url.jpg">' +
      '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="store-image-add">Add image</button></div></div>';
  }

  function renderVariantsSection(pid) {
    var variants = view.variantsByProduct[pid] || [];
    var rowsHtml = variants.map(function (v) {
      var price = v.price_cents != null ? (Number(v.price_cents) / 100) : '';
      var inv = v.inventory != null ? Number(v.inventory) : '';
      return '<div class="jos-store-variant-row">' +
        '<input id="jos-store-v-name-' + esc(v.id) + '" type="text" value="' + esc(v.name || '') + '" placeholder="Variant">' +
        '<input id="jos-store-v-price-' + esc(v.id) + '" type="number" step="0.01" value="' + esc(price) + '" placeholder="Price">' +
        '<input id="jos-store-v-stock-' + esc(v.id) + '" type="number" value="' + esc(inv) + '" placeholder="Stock">' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="store-variant-save" data-jos-id="' + esc(v.id) + '">Save</button>' +
        '<button type="button" class="jos-icon-btn" data-jos-act="store-variant-delete" data-jos-id="' + esc(v.id) + '" aria-label="Delete variant">✕</button>' +
        '</div>';
    }).join('');
    return '<div class="jos-store-subsection"><strong>Variants</strong>' +
      (variants.length ? rowsHtml : '<p class="jos-muted">No variants. Add sizes, colors, or options with their own price and stock.</p>') +
      '<div class="jos-store-variant-row is-new">' +
      '<input id="jos-store-v-new-name" type="text" placeholder="e.g. Large / Blue">' +
      '<input id="jos-store-v-new-price" type="number" step="0.01" placeholder="Price">' +
      '<input id="jos-store-v-new-stock" type="number" placeholder="Stock">' +
      '<button type="button" class="jos-btn jos-btn-sm jos-btn-brand" data-jos-act="store-variant-add">Add variant</button>' +
      '</div></div>';
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
    var detailSections = p
      ? '<div class="jos-store-detail-sections">' + renderImagesSection(editId) + renderVariantsSection(editId) + '</div>'
      : '<p class="jos-muted jos-store-detail-hint">Save the product to add images and variants.</p>';
    return '<div class="jos-store-modal-backdrop" data-jos-act="store-product-close">' +
      '<div class="jos-store-modal" role="dialog" aria-label="Product">' +
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
      detailSections +
      '<div class="jos-btn-row jos-mt">' +
      '<button type="button" class="jos-btn jos-btn-brand" data-jos-act="store-product-save">Save product</button>' +
      (p ? '<button type="button" class="jos-btn jos-btn-danger" data-jos-act="store-product-delete" data-jos-id="' + esc(editId) + '">Delete</button>' : '') +
      '<button type="button" class="jos-btn" data-jos-act="store-product-close">Cancel</button>' +
      '</div></div></div>';
  }

  function renderPage(root) {
    var os = view;
    var tab = root._josStoreTab || 'overview';
    var stats = storeStats(os);
    var body;
    if (!view.loaded) {
      body = '<section class="jos-store-card"><p class="jos-muted">' + (view.error && view.error !== 'not_ready' ? 'Store failed to load — retry.' : 'Loading your store…') + '</p></section>';
    } else {
      body = tab === 'overview' ? renderOverview(root, os)
        : tab === 'products' ? renderProducts(root, os)
          : tab === 'collections' ? renderCollections(root, os)
            : tab === 'bundles' ? renderBundles(root, os)
              : tab === 'orders' ? renderOrders(root, os)
                : tab === 'inventory' ? renderInventory(root, os)
                  : tab === 'discounts' ? renderDiscounts(root, os)
                    : tab === 'analytics' ? renderAnalytics(root, os)
                      : tab === 'ai' ? renderAiTab(root, os)
                        : renderSettings(root, os);
    }

    var primaryAct = tab === 'collections' ? 'store-collection-new'
      : tab === 'bundles' ? 'store-bundle-new'
        : tab === 'orders' ? 'store-refresh'
          : tab === 'inventory' ? 'store-export'
            : tab === 'settings' || tab === 'overview' || tab === 'analytics' || tab === 'ai' || tab === 'discounts' ? 'store-tab-products'
              : 'store-product-new';
    var primaryLabel = tab === 'collections' ? '+ New Collection'
      : tab === 'bundles' ? '+ New Bundle'
        : tab === 'orders' ? 'Refresh orders'
          : tab === 'inventory' ? 'Export inventory'
            : tab === 'settings' || tab === 'overview' || tab === 'analytics' || tab === 'ai' || tab === 'discounts' ? 'Manage products'
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
      '<button type="button" class="jos-store-fab" data-jos-act="store-product-new" aria-label="New Product">+</button>' +
      '</div>';
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
    if (perms && !perms.can('edit_products')) { toast('Your role cannot edit products'); return; }
    if (perms && !perms.can('edit_pricing') && root._josStoreProductEditId) { toast('Your role cannot edit pricing'); return; }
    var api = commerce();
    if (!api) { toast('Commerce API not available'); return; }
    var d = readProductDraft();
    if (!String(d.name || '').trim()) { toast('Product name is required'); return; }
    var editId = root._josStoreProductEditId;
    var req = editId
      ? api.updateProduct(editId, productToApiBody(d, false))
      : api.createProduct(productToApiBody(d, true));
    req.then(function (res) {
      if (!res.ok || !res.data || !res.data.product) { toast((res && res.message) || 'Save failed'); return; }
      var row = res.data.product;
      if (editId) {
        var i = view.products.findIndex(function (x) { return x.id === editId; });
        if (i >= 0) view.products[i] = productToView(row);
        publishCommerce('emitProductUpdated', row);
        toast('Product updated');
        root._josStoreProductModal = false;
        root._josStoreProductEditId = null;
        root._josStoreProductDraft = null;
        root._josStoreProductCreateMode = 'manual';
        render();
      } else {
        view.products.unshift(productToView(row));
        publishCommerce('emitProductCreated', row);
        toast('Product saved');
        // Keep the modal open in edit mode so images/variants can be added.
        root._josStoreProductEditId = row.id;
        root._josStoreProductDraft = null;
        root._josStoreProductCreateMode = 'manual';
        root._josStoreTab = 'products';
        loadProductDetail(row.id).then(render);
      }
    });
  }

  function deleteProduct(root, pid) {
    var api = commerce();
    if (!api || !pid) return;
    if (typeof window.confirm === 'function' && !window.confirm('Delete this product? This cannot be undone.')) return;
    api.deleteProduct(pid).then(function (res) {
      if (!res.ok) { toast((res && res.message) || 'Delete failed'); return; }
      view.products = view.products.filter(function (p) { return p.id !== pid; });
      delete view.imagesByProduct[pid];
      delete view.variantsByProduct[pid];
      root._josStoreProductModal = false;
      root._josStoreProductEditId = null;
      toast('Product deleted');
      render();
    });
  }

  function handleAct(act, t, root) {
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
    if (act === 'store-refresh') { loadStore(true).then(render); return; }
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
      loadProductDetail(root._josStoreProductEditId).then(render);
      return render();
    }
    if (act === 'store-product-close') {
      root._josStoreProductModal = false;
      root._josStoreProductEditId = null;
      return render();
    }
    if (act === 'store-product-save') return saveProduct(root);
    if (act === 'store-product-delete') return deleteProduct(root, t.getAttribute('data-jos-id'));

    if (act === 'store-image-add') {
      var pid = root._josStoreProductEditId;
      var url = String((el('jos-store-img-url') || {}).value || '').trim();
      if (!pid || !url) { toast('Enter an image URL'); return; }
      commerce().addProductImage(pid, { url: url }).then(function (res) {
        if (!res.ok) { toast((res && res.message) || 'Add image failed'); return; }
        (view.imagesByProduct[pid] = view.imagesByProduct[pid] || []).push(res.data.image);
        toast('Image added');
        render();
      });
      return;
    }
    if (act === 'store-image-remove') {
      var imgId = t.getAttribute('data-jos-id');
      var ppid = root._josStoreProductEditId;
      commerce().removeProductImage(imgId).then(function (res) {
        if (!res.ok) { toast((res && res.message) || 'Remove failed'); return; }
        if (ppid) view.imagesByProduct[ppid] = (view.imagesByProduct[ppid] || []).filter(function (im) { return im.id !== imgId; });
        render();
      });
      return;
    }
    if (act === 'store-variant-add') {
      var vpid = root._josStoreProductEditId;
      var vname = String((el('jos-store-v-new-name') || {}).value || '').trim();
      if (!vpid || !vname) { toast('Variant needs a name'); return; }
      var vprice = (el('jos-store-v-new-price') || {}).value;
      var vstock = (el('jos-store-v-new-stock') || {}).value;
      commerce().addProductVariant(vpid, {
        name: vname,
        price: vprice === '' ? undefined : Number(vprice),
        stock: vstock === '' ? undefined : Number(vstock)
      }).then(function (res) {
        if (!res.ok) { toast((res && res.message) || 'Add variant failed'); return; }
        (view.variantsByProduct[vpid] = view.variantsByProduct[vpid] || []).push(res.data.variant);
        toast('Variant added');
        render();
      });
      return;
    }
    if (act === 'store-variant-save') {
      var svid = t.getAttribute('data-jos-id');
      var spid = root._josStoreProductEditId;
      var nm = String((el('jos-store-v-name-' + svid) || {}).value || '').trim();
      var pr = (el('jos-store-v-price-' + svid) || {}).value;
      var stk = (el('jos-store-v-stock-' + svid) || {}).value;
      commerce().updateProductVariant(svid, {
        name: nm || undefined,
        price: pr === '' ? undefined : Number(pr),
        stock: stk === '' ? undefined : Number(stk)
      }).then(function (res) {
        if (!res.ok) { toast((res && res.message) || 'Save variant failed'); return; }
        if (spid) {
          var arr = view.variantsByProduct[spid] || [];
          var idx = arr.findIndex(function (v) { return v.id === svid; });
          if (idx >= 0) arr[idx] = res.data.variant;
        }
        toast('Variant saved');
        render();
      });
      return;
    }
    if (act === 'store-variant-delete') {
      var dvid = t.getAttribute('data-jos-id');
      var dpid = root._josStoreProductEditId;
      commerce().removeProductVariant(dvid).then(function (res) {
        if (!res.ok) { toast((res && res.message) || 'Delete variant failed'); return; }
        if (dpid) view.variantsByProduct[dpid] = (view.variantsByProduct[dpid] || []).filter(function (v) { return v.id !== dvid; });
        render();
      });
      return;
    }

    if (act === 'store-collection-new' || act === 'store-collection-edit') {
      var api = commerce();
      if (!api) { toast('Commerce API not available'); return; }
      if (act === 'store-collection-new') {
        var colName = window.prompt('Collection name', 'New collection');
        if (!colName || !String(colName).trim()) return;
        api.createCollection({ name: String(colName).trim(), published: true }).then(function (res) {
          if (!res.ok || !res.data.collection) { toast((res && res.message) || 'Save failed'); return; }
          view.collections.push(collectionToView(res.data.collection));
          toast('Collection saved');
          render();
        });
      } else {
        var cid = t.getAttribute('data-jos-id');
        var existing = view.collections.find(function (c) { return c.id === cid; });
        var newName = window.prompt('Rename collection', existing ? existing.name : '');
        if (!newName || !String(newName).trim()) return;
        api.updateCollection(cid, { name: String(newName).trim() }).then(function (res) {
          if (!res.ok || !res.data.collection) { toast((res && res.message) || 'Update failed'); return; }
          var i = view.collections.findIndex(function (c) { return c.id === cid; });
          if (i >= 0) view.collections[i] = collectionToView(res.data.collection);
          toast('Collection updated');
          render();
        });
      }
      return;
    }
    if (act === 'store-bundle-new' || act === 'store-bundle-edit') {
      var bapi = commerce();
      if (!bapi) { toast('Commerce API not available'); return; }
      if (act === 'store-bundle-new') {
        var bunTitle = window.prompt('Bundle title', 'New bundle');
        if (!bunTitle || !String(bunTitle).trim()) return;
        bapi.createBundle({ title: String(bunTitle).trim(), price: 0, status: 'active' }).then(function (res) {
          if (!res.ok || !res.data.bundle) { toast((res && res.message) || 'Save failed'); return; }
          view.bundles.unshift(bundleToView(res.data.bundle));
          toast('Bundle saved');
          render();
        });
      } else {
        var bid = t.getAttribute('data-jos-id');
        var bex = view.bundles.find(function (b) { return b.id === bid; });
        var bTitle = window.prompt('Rename bundle', bex ? bex.title : '');
        if (!bTitle || !String(bTitle).trim()) return;
        bapi.updateBundle(bid, { title: String(bTitle).trim() }).then(function (res) {
          if (!res.ok || !res.data.bundle) { toast((res && res.message) || 'Update failed'); return; }
          var bi = view.bundles.findIndex(function (b) { return b.id === bid; });
          if (bi >= 0) view.bundles[bi] = bundleToView(res.data.bundle);
          toast('Bundle updated');
          render();
        });
      }
      return;
    }
    if (act === 'store-discount-new' || act === 'store-discount-edit') {
      toast('Discount codes arrive in a later Storefront phase.');
      return;
    }
    if (act === 'store-settings-save') {
      var sapi = commerce();
      if (!sapi) { toast('Commerce API not available'); return; }
      var enabled = ((el('jos-store-s-enabled') || {}).value || '1') === '1';
      var showWeb = ((el('jos-store-s-website') || {}).value || '1') === '1';
      var patch = {
        enabled: enabled,
        storePath: (el('jos-store-s-path') || {}).value || '/store',
        heroTitle: (el('jos-store-s-hero') || {}).value || '',
        heroSubtitle: (el('jos-store-s-sub') || {}).value || '',
        theme: { showOnWebsite: showWeb }
      };
      sapi.updateStoreSettings(patch).then(function (res) {
        if (!res.ok || !res.data.settings) { toast((res && res.message) || 'Save failed'); return; }
        view.settings = settingsToView(res.data.settings);
        toast('Store settings saved');
        root._josStoreTab = 'overview';
        render();
      });
      return;
    }
    if (act === 'store-stock-inc' || act === 'store-stock-dec') {
      var iapi = commerce();
      var stockPid = t.getAttribute('data-jos-id');
      var prod = productById(stockPid);
      if (!iapi || !prod || prod.stock == null) return;
      var before = Number(prod.stock) || 0;
      var after = Math.max(0, before + (act === 'store-stock-inc' ? 1 : -1));
      if (after === before) return;
      prod.stock = after; // optimistic
      render();
      iapi.updateProduct(stockPid, { inventory: after }).then(function (res) {
        if (!res.ok || !res.data.product) {
          prod.stock = before; // revert
          toast((res && res.message) || 'Stock update failed');
          render();
          return;
        }
        var i = view.products.findIndex(function (p) { return p.id === stockPid; });
        if (i >= 0) view.products[i] = productToView(res.data.product);
        publishCommerce('emitInventoryChanged', { productId: stockPid, before: before, after: after, reason: 'manual.adjust' });
        render();
      });
      return;
    }
    if (act === 'store-import') {
      toast('CSV import — POST /products/import (owner UI coming in a later phase)');
      return;
    }
    if (act === 'store-export') {
      var lines = ['sku,name,status,price,stock'];
      view.products.forEach(function (p) {
        lines.push([p.sku, p.name, p.status, p.price, p.stock == null ? '' : p.stock].join(','));
      });
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lines.join('\n'));
      } catch (e) {}
      toast('Exported ' + view.products.length + ' products');
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
      // The modal backdrop carries the close action; only close on a DIRECT backdrop
      // click, never when the click bubbled up from a control inside the modal.
      if (act === 'store-product-close' && actEl.classList.contains('jos-store-modal-backdrop') && e.target !== actEl) return;
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
    });
    root.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'jos-store-status') {
        root._josStoreStatus = e.target.value;
        render();
      }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root._josStoreProductModal) {
        root._josStoreProductModal = false;
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
    if (!view.loaded && !view.loading) {
      loadStore().then(function () {
        try { renderPage(root); wireRoot(root); } catch (e) {}
      });
    }
  }

  var api = {
    render: render,
    setMode: setStoreMode,
    ensureState: ensureStoreOsState,
    reload: function () { return loadStore(true).then(render); },
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
