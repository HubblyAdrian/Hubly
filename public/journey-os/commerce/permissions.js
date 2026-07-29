/**
 * Commerce permissions — Owner / Manager / Employee.
 * Employees: pack + view orders. Cannot edit pricing or refund.
 */
(function (global) {
  'use strict';

  var CAPS = Object.freeze({
    view_store: true,
    edit_products: true,
    edit_pricing: true,
    manage_inventory: true,
    view_orders: true,
    pack_orders: true,
    refund_orders: true,
    manage_discounts: true,
    manage_settings: true,
    view_analytics: true
  });

  var ROLE_CAPS = Object.freeze({
    owner: Object.assign({}, CAPS),
    manager: Object.assign({}, CAPS, { manage_settings: true }),
    employee: Object.assign({}, CAPS, {
      edit_products: false,
      edit_pricing: false,
      refund_orders: false,
      manage_discounts: false,
      manage_settings: false,
      manage_inventory: true,
      pack_orders: true,
      view_orders: true,
      view_analytics: false
    })
  });

  function normalizeRole(role) {
    var r = String(role || 'owner').toLowerCase();
    if (r === 'owner' || r === 'admin') return 'owner';
    if (r === 'manager') return 'manager';
    if (r === 'employee' || r === 'technician' || r === 'tech' || r === 'staff') return 'employee';
    return 'owner';
  }

  function currentRole() {
    var S = global.S || {};
    var u = S.user || S.currentUser || {};
    return normalizeRole(u.role || S.teamRole || 'owner');
  }

  function can(capability) {
    var role = currentRole();
    var map = ROLE_CAPS[role] || ROLE_CAPS.owner;
    return !!map[capability];
  }

  function assertCan(capability) {
    if (!can(capability)) {
      return { ok: false, error: 'forbidden', message: 'Your role cannot ' + capability.replace(/_/g, ' ') };
    }
    return { ok: true };
  }

  global.HublyCommercePermissions = {
    CAPS: CAPS,
    ROLE_CAPS: ROLE_CAPS,
    normalizeRole: normalizeRole,
    currentRole: currentRole,
    can: can,
    assertCan: assertCan
  };
})(typeof window !== 'undefined' ? window : globalThis);
