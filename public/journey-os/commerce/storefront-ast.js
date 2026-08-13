/**
 * Storefront AST — CLIENT mirror of supabase/functions/_shared/storefront_ast.ts.
 *
 * The Storefront AST is the presentation config for a business's standalone Store (/store).
 * It is a versioned JSON page of BLOCKS drawn from a CLOSED catalog. The catalog is the contract
 * in both directions: it's the only vocabulary the AI may emit (so it can never invent a block the
 * renderer can't draw), and it's exactly what the /store renderer (store-page.js) knows how to draw.
 *
 * Commerce is the single source of truth. Blocks store only REFERENCES to Commerce
 * (`productIds`, `collectionId`) — never product names/prices/images. Those are resolved against
 * the live Commerce catalog at render time. This module holds zero product data.
 *
 * This file MUST stay in lockstep with storefront_ast.ts. If the server catalog changes, change
 * this too — the validator here is what the Builder trusts for locally-composed/edited ASTs, and
 * the deterministic default here is what /store falls back to when a business has no saved AST.
 */
(function (global) {
  'use strict';

  // The closed catalog — mirrors STOREFRONT_BLOCK_CATALOG in storefront_ast.ts exactly.
  var CATALOG = {
    storeHero: { variants: ['standard', 'tall', 'compact'], config: { headline: { kind: 'string' }, sub: { kind: 'string' }, showSearch: { kind: 'boolean', def: false } } },
    featuredProducts: { variants: ['standard', 'large', 'compact'], config: { title: { kind: 'string', def: 'Featured' }, productIds: { kind: 'productIds' } } },
    productGrid: { variants: ['standard', 'large'], config: { title: { kind: 'string', def: 'Shop all' }, collectionId: { kind: 'collectionId' }, columns: { kind: 'number', def: 4 } } },
    collectionGrid: { variants: ['standard'], config: { title: { kind: 'string', def: 'Shop by category' } } },
    featuredCollection: { variants: ['standard', 'banner'], config: { title: { kind: 'string' }, collectionId: { kind: 'collectionId' } } },
    bestSellers: { variants: ['standard', 'large'], config: { title: { kind: 'string', def: 'Best sellers' }, productIds: { kind: 'productIds' } } },
    promoBanner: { variants: ['standard', 'bold'], config: { text: { kind: 'string' }, ctaText: { kind: 'string' } } },
    brandStory: { variants: ['standard'], config: { title: { kind: 'string' }, body: { kind: 'string' } } },
    cta: { variants: ['standard'], config: { title: { kind: 'string' }, buttonText: { kind: 'string', def: 'Shop now' } } },
    footer: { variants: ['standard'], config: { text: { kind: 'string' } } }
  };
  var BLOCK_TYPES = Object.keys(CATALOG);
  var THEME_STYLES = ['clean', 'premium', 'bold', 'minimal', 'warm'];
  var HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

  function rid() { return 'b_' + Math.random().toString(36).slice(2, 9); }

  /** Sanitize/validate an AST against the catalog. Unknown block types are DROPPED (the AI/editor
   *  can never smuggle in an unsupported block); invalid variants/fields are coerced to defaults.
   *  Mirrors validateStorefrontAst in storefront_ast.ts. Returns {ok, ast, warnings}. */
  function validate(raw) {
    var warnings = [];
    var obj = (raw && typeof raw === 'object') ? raw : {};
    var themeRaw = (obj.theme && typeof obj.theme === 'object') ? obj.theme : {};
    var style = THEME_STYLES.indexOf(themeRaw.style) > -1 ? themeRaw.style : 'clean';
    var accent = (typeof themeRaw.accent === 'string' && HEX.test(themeRaw.accent)) ? themeRaw.accent : null;

    var rawBlocks = Array.isArray(obj.blocks) ? obj.blocks : [];
    var blocks = [];
    rawBlocks.forEach(function (b, i) {
      if (!b || typeof b !== 'object') return;
      var type = String(b.type || '');
      var spec = CATALOG[type];
      if (!spec) { warnings.push('dropped unknown block "' + type + '"'); return; }
      var variant = spec.variants.indexOf(String(b.variant)) > -1 ? String(b.variant) : spec.variants[0];
      var inConfig = (b.config && typeof b.config === 'object') ? b.config : {};
      var config = {};
      Object.keys(spec.config).forEach(function (key) {
        var fs = spec.config[key];
        var v = inConfig[key];
        if (fs.kind === 'string') config[key] = v != null ? String(v).slice(0, 600) : (fs.def != null ? fs.def : '');
        else if (fs.kind === 'number') config[key] = (v != null && isFinite(Number(v))) ? Number(v) : (fs.def != null ? fs.def : 0);
        else if (fs.kind === 'boolean') config[key] = (v === true || v === 'true') || (v == null ? (fs.def != null ? fs.def : false) : false);
        else if (fs.kind === 'productIds') config[key] = Array.isArray(v) ? v.map(function (x) { return String(x); }).filter(Boolean).slice(0, 24) : [];
        else if (fs.kind === 'collectionId') config[key] = (v != null && String(v).trim()) ? String(v).trim() : null;
      });
      blocks.push({
        id: (typeof b.id === 'string' && b.id) ? String(b.id) : rid(),
        type: type,
        order: isFinite(Number(b.order)) ? Number(b.order) : (10 + i),
        visible: b.visible !== false,
        variant: variant,
        config: config
      });
    });
    blocks.sort(function (a, b) { return a.order - b.order; }).forEach(function (b, i) { b.order = 10 + i; });

    return { ok: blocks.length > 0, ast: { version: 1, theme: { style: style, accent: accent }, blocks: blocks }, warnings: warnings };
  }

  /** Deterministic default storefront from the real catalog — the graceful fallback used when a
   *  business has no saved storefront yet. No product data is copied in; only ids are referenced.
   *  Mirrors buildDefaultStorefront in storefront_ast.ts. `ctx` = {businessName, accent, products[], collections[]}. */
  function buildDefault(ctx) {
    ctx = ctx || {};
    var prods = Array.isArray(ctx.products) ? ctx.products : [];
    var colls = Array.isArray(ctx.collections) ? ctx.collections : [];
    var active = prods.filter(function (p) { return (p.status || 'active') === 'active'; });
    var featured = active.filter(function (p) { return p.featured; }).map(function (p) { return p.id; });
    var featIds = (featured.length ? featured : active.map(function (p) { return p.id; })).slice(0, 4);
    var blocks = [];
    var order = 10;
    function add(type, config, variant) {
      var spec = CATALOG[type];
      blocks.push({ id: rid(), type: type, order: order++, visible: true, variant: variant || spec.variants[0], config: config });
    }
    add('storeHero', { headline: ctx.businessName ? (ctx.businessName + ' Store') : 'Shop', sub: 'Supplies and products from our team.', showSearch: false });
    if (featIds.length) add('featuredProducts', { title: 'Featured', productIds: featIds });
    if (colls.length) add('collectionGrid', { title: 'Shop by category' });
    add('productGrid', { title: 'Shop all', collectionId: null, columns: 4 });
    add('footer', { text: ctx.businessName || '' });
    return { version: 1, theme: { style: 'clean', accent: ctx.accent || null }, blocks: blocks };
  }

  /** True if `raw` is a usable saved AST (has at least one valid catalog block). */
  function isUsable(raw) { return validate(raw).ok; }

  global.HublyStorefrontAst = {
    CATALOG: CATALOG,
    BLOCK_TYPES: BLOCK_TYPES,
    THEME_STYLES: THEME_STYLES,
    validate: validate,
    buildDefault: buildDefault,
    isUsable: isUsable
  };
})(typeof window !== 'undefined' ? window : globalThis);
