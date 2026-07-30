/**
 * Commerce Engine domain types (JSDoc) — industry-agnostic product commerce.
 */
(function (global) {
  'use strict';

  /**
   * @typedef {Object} ProductVisibility
   * @property {boolean} website
   * @property {boolean} booking
   * @property {boolean} customerPortal
   * @property {boolean} quoteBuilder
   * @property {boolean} email
   * @property {boolean} memberships
   */

  /**
   * @typedef {Object} Product
   * @property {string} id
   * @property {string} businessId
   * @property {string} name
   * @property {string} slug
   * @property {string} [description]
   * @property {string} [shortDescription]
   * @property {number} price
   * @property {number} [compareAtPrice]
   * @property {number} [cost]
   * @property {string} [sku]
   * @property {string} [barcode]
   * @property {'draft'|'active'|'archived'} status
   * @property {number|null} [inventory]
   * @property {boolean} [trackInventory]
   * @property {number} [weight]
   * @property {string} [brand]
   * @property {boolean} [featured]
   * @property {Object} [seo]
   * @property {ProductVisibility} [visibility]
   * @property {string} [createdAt]
   * @property {string} [updatedAt]
   */

  /** @type {ProductVisibility} */
  var DEFAULT_VISIBILITY = Object.freeze({
    website: true,
    booking: true,
    customerPortal: true,
    quoteBuilder: true,
    email: true,
    memberships: false
  });

  var ORDER_STATUSES = Object.freeze([
    'pending', 'paid', 'packed', 'ready', 'shipped', 'delivered', 'refunded', 'cancelled'
  ]);

  var SHIPPING_MODES = Object.freeze(['pickup', 'flat_rate', 'local_delivery', 'free']);

  /** Shared Commerce product kinds — one engine for retail, photo, creator, service. */
  var PRODUCT_TYPES = Object.freeze([
    'physical',
    'digital',
    'gift_card',
    'service_addon',
    'print',
  ]);

  var ARCHITECTURE_READY = Object.freeze({
    gift_cards: true,
    digital_downloads: true,
    print_sales: true,
    categories: true,
  });

  function centsToDollars(cents) {
    return (Number(cents) || 0) / 100;
  }

  function dollarsToCents(dollars) {
    return Math.round((Number(dollars) || 0) * 100);
  }

  /** Map DB row → Product model used by Operate UI + storefront. */
  function productFromRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      businessId: row.business_id || row.businessId,
      name: row.name,
      slug: row.slug,
      description: row.description || '',
      shortDescription: row.short_description || row.shortDescription || '',
      price: row.price != null ? Number(row.price) : centsToDollars(row.price_cents),
      compareAtPrice: row.compareAt != null || row.compareAtPrice != null
        ? Number(row.compareAt != null ? row.compareAt : row.compareAtPrice)
        : (row.compare_at_cents != null ? centsToDollars(row.compare_at_cents) : 0),
      cost: row.cost != null ? Number(row.cost) : (row.cost_cents != null ? centsToDollars(row.cost_cents) : 0),
      sku: row.sku || '',
      barcode: row.barcode || '',
      status: row.status || 'draft',
      inventory: row.inventory != null ? row.inventory : (row.stock != null ? row.stock : null),
      stock: row.stock != null ? row.stock : row.inventory,
      trackInventory: row.track_inventory !== false && row.trackInventory !== false,
      weight: row.weight != null ? row.weight : row.weight_grams,
      brand: row.brand || '',
      featured: !!row.featured,
      seo: row.seo || {},
      visibility: Object.assign({}, DEFAULT_VISIBILITY, row.visibility || {}),
      type: row.product_type || row.type || 'physical',
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt
    };
  }

  global.HublyCommerceTypes = {
    DEFAULT_VISIBILITY: DEFAULT_VISIBILITY,
    ORDER_STATUSES: ORDER_STATUSES,
    SHIPPING_MODES: SHIPPING_MODES,
    PRODUCT_TYPES: PRODUCT_TYPES,
    ARCHITECTURE_READY: ARCHITECTURE_READY,
    centsToDollars: centsToDollars,
    dollarsToCents: dollarsToCents,
    productFromRow: productFromRow
  };
})(typeof window !== 'undefined' ? window : globalThis);
