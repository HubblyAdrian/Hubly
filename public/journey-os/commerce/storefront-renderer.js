/**
 * Storefront renderer — Website Engine embeds this on the Instant Site Store section.
 * Reads Store settings → collections → products → theme → widgets.
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

  function settingsFromOs(os, st) {
    os = os || {};
    var s = os.settings || {};
    return {
      enabled: s.enabled !== false,
      path: s.storePath || s.store_path || '/store',
      heroTitle: s.heroTitle || s.hero_title || ((st && st.biz) ? (st.biz + ' Store') : 'Store'),
      heroSubtitle: s.heroSubtitle || s.hero_subtitle || 'Products, kits, and care — from the same team that does the work.',
      theme: s.theme || {},
      widgets: s.widgets || { aiCoach: true, learningCenter: true },
      showOnWebsite: s.showOnWebsite !== false
    };
  }

  function featuredProducts(os) {
    var list = (os.products || []).filter(function (p) {
      return p.status === 'active' && (p.featured || (p.visibility && p.visibility.website !== false));
    });
    if (!list.length) list = (os.products || []).filter(function (p) { return p.status === 'active'; });
    return list.slice(0, 8);
  }

  function renderHero(settings, opts) {
    if (opts && opts.websiteEmbed) {
      // Website section already has title/sub — only render product grid chrome.
      return '';
    }
    return '<section class="hub-storefront-hero">' +
      '<div class="hub-storefront-brand"><span class="hub-wm-hub">hub</span><span class="hub-wm-ly">ly</span> Store</div>' +
      '<h1>' + esc(settings.heroTitle) + '</h1>' +
      '<p>' + esc(settings.heroSubtitle) + '</p>' +
      '<a class="hub-commerce-btn" href="#hub-store-featured">Shop featured</a>' +
      '</section>';
  }

  function renderFeatured(products, C, opts) {
    C = C || global.HublyCommerceComponents;
    if (!products.length) {
      return '<div class="hub-commerce-empty">' +
        (opts && opts.websiteEmbed
          ? 'No products yet — add them in Store.'
          : 'No products published yet.') +
        '</div>';
    }
    return '<section id="hub-store-featured" class="hub-storefront-section' +
      (opts && opts.websiteEmbed ? ' hub-storefront-section--embed' : '') + '">' +
      (opts && opts.websiteEmbed ? '' : '<h2>Featured products</h2>') +
      (C ? C.ProductGrid(products) : '<div class="hub-commerce-empty">Catalog loading…</div>') +
      '</section>';
  }

  function renderCollections(os, C, opts) {
    C = C || global.HublyCommerceComponents;
    var cols = (os.collections || []).filter(function (c) { return c.published !== false; });
    if (!cols.length) return '';
    return '<section class="hub-storefront-section' +
      (opts && opts.websiteEmbed ? ' hub-storefront-section--embed' : '') + '">' +
      '<h2>Collections</h2>' +
      '<div class="hub-commerce-collection-grid">' +
      cols.map(function (c) { return C ? C.CollectionCard(c) : esc(c.name); }).join('') +
      '</div></section>';
  }

  function renderAiCoach(settings, C, opts) {
    if (opts && opts.websiteEmbed) return '';
    if (settings.widgets && settings.widgets.aiCoach === false) return '';
    C = C || global.HublyCommerceComponents;
    return '<section class="hub-storefront-section hub-storefront-ai">' +
      (C ? C.AIProductCoach({}) : '') + '</section>';
  }

  function renderLearning(settings, opts) {
    if (opts && opts.websiteEmbed) return '';
    if (settings.widgets && settings.widgets.learningCenter === false) return '';
    return '<section class="hub-storefront-section">' +
      '<h2>Learning Center</h2>' +
      '<p>Guides from your product knowledge base — answers stay specific to this business.</p>' +
      '</section>';
  }

  function renderFooter(st, opts) {
    if (opts && opts.websiteEmbed) return '';
    var name = (st && (st.biz || st.businessName)) || 'Business';
    return '<footer class="hub-storefront-footer">' +
      '<div><span class="hub-wm-hub">hub</span><span class="hub-wm-ly">ly</span></div>' +
      '<p>© ' + new Date().getFullYear() + ' ' + esc(name) + '</p></footer>';
  }

  /**
   * @param {object} opts
   * @param {object} [opts.storeOs] S.storeOs
   * @param {object} [opts.state] global S
   * @param {'desktop'|'tablet'|'mobile'} [opts.device]
   * @param {boolean} [opts.websiteEmbed] — render inside Instant Site Store section
   */
  function render(opts) {
    opts = opts || {};
    var st = opts.state || global.S || {};
    var os = opts.storeOs || st.storeOs || {};
    var settings = settingsFromOs(os, st);
    if (!settings.enabled) {
      return '<div class="hub-storefront hub-storefront--off"><p>Store is not enabled for this business.</p></div>';
    }
    var C = global.HublyCommerceComponents;
    var featured = featuredProducts(os);
    var cls = 'hub-storefront device-' + esc(opts.device || 'desktop') +
      (opts.websiteEmbed ? ' hub-storefront--website' : '');
    var body = '<div class="' + cls + '">' +
      renderHero(settings, opts) +
      renderFeatured(featured, C, opts) +
      renderCollections(os, C, opts) +
      renderAiCoach(settings, C, opts) +
      renderLearning(settings, opts) +
      renderFooter(st, opts) +
      '</div>';
    if (opts.preview && !opts.websiteEmbed && C && C.StorePreview) {
      return C.StorePreview(body, opts.device || 'desktop');
    }
    return body;
  }

  // Map the commerce-api /public/storefront payload → the `os` shape render() consumes.
  // Commerce DB is the single source of truth; this is a read-through projection only.
  function payloadToOs(d) {
    d = d || {};
    var products = (d.products || []).map(function (p) {
      var giftCard = p.product_type === 'gift_card';
      return {
        id: p.id, name: p.name, slug: p.slug, sku: p.sku || '',
        status: 'active',
        price: (Number(p.price_cents) || 0) / 100,
        compareAt: p.compare_at_cents != null ? Number(p.compare_at_cents) / 100 : 0,
        type: p.product_type || 'physical',
        stock: giftCard ? null : (p.inventory != null ? Number(p.inventory) : null),
        description: p.description || '',
        shortDescription: p.short_description || '',
        featured: !!p.featured,
        category: (p.metadata && p.metadata.category) || '',
        visibility: { website: true },
        images: (p.images || []).map(function (im) { return { url: im.url, alt: im.alt || '' }; }),
        variants: (p.variants || []).map(function (v) {
          return {
            id: v.id, name: v.name, sku: v.sku || '',
            price: v.price_cents != null ? Number(v.price_cents) / 100 : null,
            stock: v.inventory != null ? Number(v.inventory) : null
          };
        })
      };
    });
    var collections = (d.collections || []).map(function (c) {
      return { id: c.id, name: c.name, slug: c.slug, description: c.description || '', published: true, productIds: c.product_ids || [] };
    });
    var bundles = (d.bundles || []).map(function (b) {
      return {
        id: b.id, title: b.title, description: b.description || '',
        price: (Number(b.price_cents) || 0) / 100, status: 'active', productIds: []
      };
    });
    var s = d.settings || {};
    return {
      products: products, collections: collections, bundles: bundles,
      settings: {
        enabled: s.enabled !== false,
        showOnWebsite: s.showOnWebsite !== false,
        storePath: s.store_path || '/store',
        heroTitle: s.hero_title || '',
        heroSubtitle: s.hero_subtitle || '',
        currency: s.currency || 'usd'
      }
    };
  }

  /**
   * Load the public catalog for a business from the Commerce DB (via commerce-api
   * /public/storefront). Returns an `os`-shaped object for render(). Never touches S.storeOs.
   */
  function loadPublic(businessId, surface) {
    var api = global.HublyCommerceApi;
    if (!api || typeof api.getPublicStorefront !== 'function' || !businessId) {
      return Promise.resolve({ error: 'not_ready', settings: {}, products: [], collections: [], bundles: [] });
    }
    return api.getPublicStorefront(businessId, surface).then(function (res) {
      if (!res || !res.ok || !res.data) {
        return { error: (res && res.error) || 'load_failed', settings: {}, products: [], collections: [], bundles: [] };
      }
      return payloadToOs(res.data);
    }).catch(function (e) {
      return { error: String((e && e.message) || e), settings: {}, products: [], collections: [], bundles: [] };
    });
  }

  /** Match Instant Site path — default /store */
  function matchesPath(pathname, os) {
    var settings = settingsFromOs(os || (global.S && global.S.storeOs), global.S);
    var want = String(settings.path || '/store').replace(/\/$/, '') || '/store';
    var got = String(pathname || '').replace(/\/$/, '') || '/';
    return got === want || got.endsWith(want);
  }

  global.HublyCommerceStorefront = {
    render: render,
    loadPublic: loadPublic,
    payloadToOs: payloadToOs,
    matchesPath: matchesPath,
    settingsFromOs: settingsFromOs
  };
})(typeof window !== 'undefined' ? window : globalThis);
