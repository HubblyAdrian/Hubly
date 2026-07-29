/**
 * Hubly Store — owner Commerce Engine (Operate).
 * UI label: Store. Internally: commerce (products, collections, orders, inventory, discounts).
 * Distinct from Website Storefront (services) and Apps Marketplace (integrations).
 */
(function (global) {
  'use strict';

  var STORE_TABS = [
    ['products', 'Products'],
    ['collections', 'Collections'],
    ['orders', 'Orders'],
    ['inventory', 'Inventory'],
    ['discounts', 'Discounts']
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
    if (!Array.isArray(os.orders)) os.orders = [];
    if (!Array.isArray(os.discounts)) os.discounts = [];
    if (!Array.isArray(os.activity)) os.activity = [];
    if (!os.seeded) seedDemoStore(os, st);
    return os;
  }

  function seedDemoStore(os, st) {
    if (os.products.length) {
      os.seeded = true;
      return;
    }
    var biz = st.biz || st.businessName || 'Your business';
    os.products = [
      {
        id: 'prod_ceramic_kit', sku: 'CER-KIT-01', name: 'Ceramic Coating Kit',
        type: 'physical', status: 'active', price: 89, compareAt: 119, cost: 42,
        stock: 24, lowStock: 5, collectionIds: ['col_retail', 'col_kits'],
        category: 'Detailing gear', vendor: biz,
        description: 'DIY-friendly ceramic kit for customers who want a maintenance coat between visits.',
        imageTone: 'navy', createdAt: todayStr()
      },
      {
        id: 'prod_microfiber', sku: 'MF-TOWEL-12', name: 'Pro Microfiber Towel Set',
        type: 'physical', status: 'active', price: 28, compareAt: 0, cost: 11,
        stock: 86, lowStock: 15, collectionIds: ['col_retail'],
        category: 'Supplies', vendor: biz,
        description: '12-pack of edge-free microfiber towels — sell from the van or site.',
        imageTone: 'blue', createdAt: todayStr()
      },
      {
        id: 'prod_interior_spray', sku: 'INT-SPRAY-01', name: 'Interior Protectant Spray',
        type: 'physical', status: 'active', price: 18, compareAt: 22, cost: 7,
        stock: 4, lowStock: 8, collectionIds: ['col_retail', 'col_upsell'],
        category: 'Chemicals', vendor: biz,
        description: 'UV protectant for dash and trim. Perfect add-on at checkout.',
        imageTone: 'orange', createdAt: todayStr()
      },
      {
        id: 'prod_gift_100', sku: 'GIFT-100', name: '$100 Gift Card',
        type: 'gift_card', status: 'active', price: 100, compareAt: 0, cost: 0,
        stock: null, lowStock: null, collectionIds: ['col_digital'],
        category: 'Gift cards', vendor: biz,
        description: 'Digital gift card — emailed instantly after purchase.',
        imageTone: 'green', createdAt: todayStr()
      },
      {
        id: 'prod_wheel_cleaner', sku: 'WHL-CLN-01', name: 'Acid-Free Wheel Cleaner',
        type: 'physical', status: 'draft', price: 16, compareAt: 0, cost: 6,
        stock: 0, lowStock: 10, collectionIds: ['col_retail'],
        category: 'Chemicals', vendor: biz,
        description: 'Safe on coated wheels. Draft — not visible on site yet.',
        imageTone: 'slate', createdAt: todayStr()
      }
    ];
    os.collections = [
      { id: 'col_retail', name: 'Retail shelf', description: 'Products you sell from the van or booking site.', productIds: ['prod_ceramic_kit', 'prod_microfiber', 'prod_interior_spray', 'prod_wheel_cleaner'], published: true },
      { id: 'col_kits', name: 'Maintenance kits', description: 'Bundled gear for DIY between appointments.', productIds: ['prod_ceramic_kit'], published: true },
      { id: 'col_upsell', name: 'Job add-ons', description: 'Suggested at booking confirmation.', productIds: ['prod_interior_spray'], published: true },
      { id: 'col_digital', name: 'Digital', description: 'Gift cards and downloadable products.', productIds: ['prod_gift_100'], published: true }
    ];
    os.orders = [
      {
        id: 'ord_1042', number: '#1042', status: 'paid', channel: 'Website',
        customer: 'Sarah Johnson', email: 'sarah.johnson@gmail.com',
        total: 117, items: [{ productId: 'prod_ceramic_kit', qty: 1, price: 89 }, { productId: 'prod_microfiber', qty: 1, price: 28 }],
        createdAt: todayStr(), fulfillment: 'unfulfilled'
      },
      {
        id: 'ord_1041', number: '#1041', status: 'paid', channel: 'In person',
        customer: 'Mike Brown', email: 'mike.brown@email.com',
        total: 36, items: [{ productId: 'prod_interior_spray', qty: 2, price: 18 }],
        createdAt: todayStr(), fulfillment: 'fulfilled'
      },
      {
        id: 'ord_1040', number: '#1040', status: 'pending', channel: 'Website',
        customer: 'Chris Park', email: 'chris.park@email.com',
        total: 100, items: [{ productId: 'prod_gift_100', qty: 1, price: 100 }],
        createdAt: todayStr(), fulfillment: 'digital'
      },
      {
        id: 'ord_1039', number: '#1039', status: 'refunded', channel: 'Website',
        customer: 'Emily Smith', email: 'emily.smith@email.com',
        total: 28, items: [{ productId: 'prod_microfiber', qty: 1, price: 28 }],
        createdAt: todayStr(), fulfillment: 'cancelled'
      }
    ];
    os.discounts = [
      { id: 'disc_spring', code: 'SHINE15', type: 'percent', value: 15, status: 'active', uses: 12, limit: 100, appliesTo: 'all', endsAt: '' },
      { id: 'disc_kit', code: 'KIT10', type: 'fixed', value: 10, status: 'active', uses: 3, limit: 50, appliesTo: 'col_kits', endsAt: '' },
      { id: 'disc_welcome', code: 'WELCOME20', type: 'percent', value: 20, status: 'scheduled', uses: 0, limit: 25, appliesTo: 'all', endsAt: '' },
      { id: 'disc_old', code: 'SUMMER25', type: 'percent', value: 25, status: 'expired', uses: 48, limit: 50, appliesTo: 'all', endsAt: '2025-09-01' }
    ];
    os.activity = [
      { at: todayStr(), label: 'Order #1042 paid · Ceramic Coating Kit + towels' },
      { at: todayStr(), label: 'Low stock · Interior Protectant Spray (4 left)' },
      { at: todayStr(), label: 'Discount SHINE15 used 12 times' }
    ];
    os.seeded = true;
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
    var revenue = os.orders.filter(function (o) { return o.status === 'paid'; }).reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);
    return { active: active, low: low, openOrders: openOrders, revenue: revenue, products: os.products.length };
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
      : '<div class="jos-store-empty"><h3>No orders yet</h3><p>When customers buy products, orders show up here.</p></div>';
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
    var d = root._josStoreProductDraft || p || {
      name: '', sku: '', price: '', stock: '', status: 'active', category: '', description: '', type: 'physical'
    };
    return '<div class="jos-store-modal-backdrop" data-jos-act="store-product-close">' +
      '<div class="jos-store-modal" role="dialog" aria-label="Product" onclick="event.stopPropagation()">' +
      '<div class="jos-between"><div><div class="jos-kicker">Store</div><h2>' + (p ? 'Edit product' : 'New product') + '</h2></div>' +
      '<button type="button" class="jos-icon-btn" data-jos-act="store-product-close" aria-label="Close">✕</button></div>' +
      '<div class="jos-store-form">' +
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
    var tab = root._josStoreTab || 'products';
    var stats = storeStats(os);
    var body = tab === 'products' ? renderProducts(root, os)
      : tab === 'collections' ? renderCollections(root, os)
        : tab === 'orders' ? renderOrders(root, os)
          : tab === 'inventory' ? renderInventory(root, os)
            : renderDiscounts(root, os);

    var primaryAct = tab === 'collections' ? 'store-collection-new'
      : tab === 'discounts' ? 'store-discount-new'
        : tab === 'orders' ? 'store-export'
          : tab === 'inventory' ? 'store-export'
            : 'store-product-new';
    var primaryLabel = tab === 'collections' ? '+ New Collection'
      : tab === 'discounts' ? '+ New Discount'
        : tab === 'orders' ? 'Export orders'
          : tab === 'inventory' ? 'Export inventory'
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
      '<button type="button" class="jos-store-meta-chip revenue" data-jos-act="store-tab-orders"><span>Product revenue</span><strong>' + esc(money(stats.revenue)) + '</strong></button>' +
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
    var os = ensureStoreOsState();
    var d = readProductDraft();
    if (!String(d.name || '').trim()) { toast('Product name is required'); return; }
    var editId = root._josStoreProductEditId;
    if (editId) {
      var existing = productById(editId);
      if (existing) {
        Object.assign(existing, d, {
          stock: d.type === 'gift_card' ? null : d.stock,
          lowStock: existing.lowStock != null ? existing.lowStock : 5
        });
      }
      toast('Product updated');
    } else {
      os.products.unshift({
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
        createdAt: todayStr()
      });
      toast('Product saved');
    }
    root._josStoreProductModal = false;
    root._josStoreProductEditId = null;
    root._josStoreProductDraft = null;
    root._josStoreTab = 'products';
    render();
  }

  function handleAct(act, t, root) {
    var os = ensureStoreOsState();
    if (act === 'store-tab-products') { root._josStoreTab = 'products'; return render(); }
    if (act === 'store-tab-collections') { root._josStoreTab = 'collections'; return render(); }
    if (act === 'store-tab-orders') { root._josStoreTab = 'orders'; return render(); }
    if (act === 'store-tab-inventory') { root._josStoreTab = 'inventory'; return render(); }
    if (act === 'store-tab-discounts') { root._josStoreTab = 'discounts'; return render(); }
    if (act === 'store-product-new') {
      root._josStoreProductModal = true;
      root._josStoreProductEditId = null;
      root._josStoreProductDraft = { name: '', sku: '', price: '', stock: '', status: 'active', type: 'physical', category: '', description: '' };
      return render();
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
      toast('Duplicate · Archive · Share link — coming with live publish');
      return;
    }
    if (act === 'store-collection-new' || act === 'store-collection-edit') {
      toast(act === 'store-collection-new' ? 'Collection builder opening soon' : 'Collection saved locally soon');
      return;
    }
    if (act === 'store-discount-new' || act === 'store-discount-edit') {
      toast(act === 'store-discount-new' ? 'Create a discount code — Stage 2 connect' : 'Discount editor — Stage 2');
      return;
    }
    if (act === 'store-stock-inc' || act === 'store-stock-dec') {
      var pid = t.getAttribute('data-jos-id');
      var prod = productById(pid);
      if (!prod || prod.stock == null) return;
      prod.stock = Math.max(0, (Number(prod.stock) || 0) + (act === 'store-stock-inc' ? 1 : -1));
      toast(prod.name + ' · ' + prod.stock + ' in stock');
      return render();
    }
    if (act === 'store-import') {
      toast('CSV import — Stage 2');
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
