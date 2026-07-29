/**
 * HublyCommerce — public facade for the Commerce Engine.
 */
(function (global) {
  'use strict';

  var api = {
    version: '1.0.0',
    types: function () { return global.HublyCommerceTypes; },
    api: function () { return global.HublyCommerceApi; },
    events: function () { return global.HublyCommerceEvents; },
    permissions: function () { return global.HublyCommercePermissions; },
    components: function () { return global.HublyCommerceComponents; },
    storefront: function () { return global.HublyCommerceStorefront; },
    checkout: function () { return global.HublyCommerceCheckout; },
    ai: function () { return global.HublyCommerceAI; },
    merchandising: function () { return global.HublyCommerceMerchandising; },
    /** Render live /store HTML from S.storeOs (no fakes). */
    renderStorefront: function (opts) {
      var sf = global.HublyCommerceStorefront;
      return sf ? sf.render(opts || {}) : '';
    },
    can: function (cap) {
      var p = global.HublyCommercePermissions;
      return p ? p.can(cap) : true;
    }
  };

  global.HublyCommerce = api;
})(typeof window !== 'undefined' ? window : globalThis);
