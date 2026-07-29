/**
 * Reusable Commerce UI builders — embeddable in Website Engine + Customer Portal.
 * Not React components; Hubly Operate uses HTML string builders.
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function money(n) {
    var v = Number(n) || 0;
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
    } catch (e) {
      return '$' + Math.round(v);
    }
  }

  function ProductCard(p, opts) {
    opts = opts || {};
    var price = p.price != null ? p.price : 0;
    return '<article class="hub-commerce-product-card" data-product-id="' + esc(p.id) + '">' +
      '<div class="hub-commerce-product-card__media" aria-hidden="true">' + esc((p.name || 'P').slice(0, 1)) + '</div>' +
      '<div class="hub-commerce-product-card__body">' +
      '<strong>' + esc(p.name) + '</strong>' +
      (p.shortDescription || p.description
        ? '<p>' + esc((p.shortDescription || p.description || '').slice(0, 90)) + '</p>' : '') +
      '<div class="hub-commerce-product-card__row">' +
      '<span class="hub-commerce-price">' + esc(money(price)) + '</span>' +
      (opts.addLabel !== false
        ? '<button type="button" class="hub-commerce-btn" data-commerce-act="cart-add" data-product-id="' + esc(p.id) + '">' +
          esc(opts.addLabel || 'Add') + '</button>'
        : '') +
      '</div></div></article>';
  }

  function ProductGrid(products, opts) {
    products = products || [];
    if (!products.length) {
      return '<div class="hub-commerce-empty">No products yet.</div>';
    }
    return '<div class="hub-commerce-product-grid">' +
      products.map(function (p) { return ProductCard(p, opts); }).join('') +
      '</div>';
  }

  function InventoryBadge(p) {
    if (p.type === 'gift_card' || p.stock == null && p.inventory == null) {
      return '<span class="hub-commerce-inv digital">Digital</span>';
    }
    var stock = p.stock != null ? p.stock : p.inventory;
    var low = p.lowStock != null && stock <= p.lowStock;
    return '<span class="hub-commerce-inv' + (low ? ' low' : '') + '">' +
      esc(stock) + (low ? ' · Low' : ' in stock') + '</span>';
  }

  function CollectionCard(c) {
    var count = (c.productIds || c.product_ids || []).length;
    return '<article class="hub-commerce-collection-card" data-collection-id="' + esc(c.id) + '">' +
      '<strong>' + esc(c.name || c.title) + '</strong>' +
      '<p>' + esc(c.description || '') + '</p>' +
      '<span>' + count + ' products</span></article>';
  }

  function CartDrawer(cart) {
    var items = (cart && (cart.items || cart.commerce_cart_items)) || [];
    var total = items.reduce(function (s, it) {
      return s + (Number(it.unit_price_cents || it.price) || 0) * (Number(it.qty) || 1);
    }, 0);
    var isCents = items.some(function (it) { return it.unit_price_cents != null; });
    if (isCents) total = total / 100;
    return '<aside class="hub-commerce-cart-drawer" aria-label="Cart">' +
      '<header><strong>Cart</strong><button type="button" data-commerce-act="cart-close">✕</button></header>' +
      (items.length
        ? '<ul>' + items.map(function (it) {
          return '<li><span>' + esc(it.title || it.name) + ' × ' + esc(it.qty) + '</span>' +
            '<button type="button" data-commerce-act="cart-remove" data-item-id="' + esc(it.id) + '">Remove</button></li>';
        }).join('') + '</ul>'
        : '<p class="hub-commerce-empty">Your cart is empty.</p>') +
      '<footer><strong>' + esc(money(total)) + '</strong>' +
      '<button type="button" class="hub-commerce-btn" data-commerce-act="checkout">Checkout</button></footer></aside>';
  }

  function CheckoutButton(opts) {
    opts = opts || {};
    return '<button type="button" class="hub-commerce-btn hub-commerce-checkout" data-commerce-act="checkout">' +
      esc(opts.label || 'Checkout') + '</button>';
  }

  function OrderTimeline(order) {
    var steps = ['pending', 'paid', 'packed', 'ready', 'shipped', 'delivered'];
    var status = String((order && order.status) || 'pending');
    var idx = steps.indexOf(status);
    if (status === 'refunded' || status === 'cancelled') {
      return '<ol class="hub-commerce-order-timeline terminal"><li class="on">' + esc(status) + '</li></ol>';
    }
    return '<ol class="hub-commerce-order-timeline">' + steps.map(function (s, i) {
      return '<li class="' + (i <= idx ? 'on' : '') + '">' + esc(s) + '</li>';
    }).join('') + '</ol>';
  }

  function StorePreview(html, device) {
    device = device || 'desktop';
    return '<div class="hub-commerce-store-preview device-' + esc(device) + '" data-device="' + esc(device) + '">' +
      '<div class="hub-commerce-store-preview__frame">' + (html || '') + '</div></div>';
  }

  function AIProductCoach(opts) {
    opts = opts || {};
    return '<div class="hub-commerce-ai-coach" data-commerce-widget="ai-coach">' +
      '<h3>What are you trying to accomplish?</h3>' +
      '<p class="hub-commerce-muted">Ask about products, care, or kits — answers use this business’s catalog first.</p>' +
      '<form data-commerce-act="ai-coach-ask">' +
      '<input type="text" name="q" placeholder="' + esc(opts.placeholder || 'My paint has swirl marks.') + '" required>' +
      '<button type="submit" class="hub-commerce-btn">Ask</button></form>' +
      '<div class="hub-commerce-ai-coach__out" data-commerce-ai-out></div></div>';
  }

  function KnowledgeUploader() {
    return '<div class="hub-commerce-knowledge-uploader" data-commerce-widget="knowledge">' +
      '<p>Upload PDFs, images, markdown, or a product URL for the AI Product Coach.</p>' +
      '<input type="file" accept=".pdf,.docx,.md,.txt,image/*" data-commerce-act="knowledge-file">' +
      '<input type="url" placeholder="https://…" data-commerce-act="knowledge-url">' +
      '<button type="button" class="hub-commerce-btn" data-commerce-act="knowledge-upload">Index document</button>' +
      '<p class="hub-commerce-muted">Indexing uses Hubly AI + commerce_documents when configured.</p></div>';
  }

  function StoreAnalytics(stats) {
    stats = stats || {};
    var cells = [
      ['Revenue', stats.revenue],
      ['Orders', stats.orders],
      ['Avg order', stats.aov],
      ['Conversion', stats.conversion],
      ['Top product', stats.topProduct],
      ['Low inventory', stats.lowStock],
      ['Repeat customers', stats.repeat],
      ['Abandoned carts', stats.abandoned]
    ];
    return '<div class="hub-commerce-analytics">' + cells.map(function (c) {
      return '<div class="hub-commerce-analytics__cell"><span>' + esc(c[0]) + '</span><strong>' +
        esc(c[1] != null ? c[1] : '—') + '</strong></div>';
    }).join('') + '</div>';
  }

  function BundleBuilder(bundle, products) {
    bundle = bundle || {};
    products = products || [];
    return '<div class="hub-commerce-bundle-builder">' +
      '<label>Title<input value="' + esc(bundle.title || '') + '" data-field="title"></label>' +
      '<label>Price<input type="number" value="' + esc(bundle.price != null ? bundle.price : '') + '" data-field="price"></label>' +
      '<div class="hub-commerce-bundle-products">' +
      products.map(function (p) {
        var on = (bundle.productIds || []).indexOf(p.id) > -1;
        return '<label><input type="checkbox" data-product-id="' + esc(p.id) + '"' + (on ? ' checked' : '') + '> ' +
          esc(p.name) + '</label>';
      }).join('') + '</div></div>';
  }

  function ProductGallery(images) {
    images = images || [];
    if (!images.length) return '<div class="hub-commerce-gallery empty">No images</div>';
    return '<div class="hub-commerce-gallery">' + images.map(function (img) {
      return '<img src="' + esc(img.url || img) + '" alt="' + esc(img.alt || '') + '">';
    }).join('') + '</div>';
  }

  function ProductEditor(p) {
    p = p || {};
    return '<form class="hub-commerce-product-editor" data-commerce-widget="product-editor">' +
      '<label>Name<input name="name" value="' + esc(p.name || '') + '"></label>' +
      '<label>Price<input name="price" type="number" value="' + esc(p.price != null ? p.price : '') + '"></label>' +
      '<label>SKU<input name="sku" value="' + esc(p.sku || '') + '"></label>' +
      '<label>Description<textarea name="description">' + esc(p.description || '') + '</textarea></label>' +
      '</form>';
  }

  global.HublyCommerceComponents = {
    ProductCard: ProductCard,
    ProductGrid: ProductGrid,
    ProductEditor: ProductEditor,
    ProductGallery: ProductGallery,
    CollectionCard: CollectionCard,
    BundleBuilder: BundleBuilder,
    CartDrawer: CartDrawer,
    CheckoutButton: CheckoutButton,
    OrderTimeline: OrderTimeline,
    InventoryBadge: InventoryBadge,
    StorePreview: StorePreview,
    AIProductCoach: AIProductCoach,
    KnowledgeUploader: KnowledgeUploader,
    StoreAnalytics: StoreAnalytics
  };
})(typeof window !== 'undefined' ? window : globalThis);
