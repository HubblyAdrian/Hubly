/**
 * Commerce domain events → HublyEvents (Rule #17 / #18).
 */
(function (global) {
  'use strict';

  var NAMES = Object.freeze({
    PRODUCT_CREATED: 'product.created',
    PRODUCT_UPDATED: 'product.updated',
    INVENTORY_CHANGED: 'inventory.changed',
    ORDER_CREATED: 'order.created',
    ORDER_PAID: 'order.paid',
    ORDER_REFUNDED: 'order.refunded',
    BUNDLE_CREATED: 'bundle.created',
    GIFTCARD_USED: 'giftcard.used',
    DISCOUNT_CREATED: 'discount.created',
    LOW_STOCK: 'inventory.low_stock',
    CART_ABANDONED: 'cart.abandoned'
  });

  function publish(type, payload) {
    try {
      if (global.HublyEvents && typeof global.HublyEvents.publish === 'function') {
        return global.HublyEvents.publish(type, payload || {});
      }
    } catch (e) {
      console.warn('HublyCommerce events', e);
    }
    return null;
  }

  function emitProductCreated(product) {
    return publish(NAMES.PRODUCT_CREATED, {
      productId: product && product.id,
      businessId: product && (product.businessId || product.business_id),
      name: product && product.name
    });
  }

  function emitProductUpdated(product) {
    return publish(NAMES.PRODUCT_UPDATED, {
      productId: product && product.id,
      businessId: product && (product.businessId || product.business_id)
    });
  }

  function emitInventoryChanged(opts) {
    return publish(NAMES.INVENTORY_CHANGED, {
      productId: opts && opts.productId,
      before: opts && opts.before,
      after: opts && opts.after,
      reason: opts && opts.reason,
      orderId: opts && opts.orderId
    });
  }

  function emitOrderPaid(order) {
    return publish(NAMES.ORDER_PAID, {
      orderId: order && order.id,
      customerId: order && order.customer_id,
      total: order && (order.total_cents != null ? order.total_cents : order.total),
      number: order && (order.order_number || order.number)
    });
  }

  function emitOrderCreated(order) {
    return publish(NAMES.ORDER_CREATED, {
      orderId: order && order.id,
      customerId: order && order.customer_id,
      number: order && (order.order_number || order.number)
    });
  }

  function emitOrderRefunded(order) {
    return publish(NAMES.ORDER_REFUNDED, {
      orderId: order && order.id,
      customerId: order && order.customer_id
    });
  }

  function emitBundleCreated(bundle) {
    return publish(NAMES.BUNDLE_CREATED, {
      bundleId: bundle && bundle.id,
      title: bundle && bundle.title
    });
  }

  function emitDiscountCreated(discount) {
    return publish(NAMES.DISCOUNT_CREATED, {
      discountId: discount && discount.id,
      code: discount && discount.code
    });
  }

  global.HublyCommerceEvents = {
    NAMES: NAMES,
    publish: publish,
    emitProductCreated: emitProductCreated,
    emitProductUpdated: emitProductUpdated,
    emitInventoryChanged: emitInventoryChanged,
    emitOrderCreated: emitOrderCreated,
    emitOrderPaid: emitOrderPaid,
    emitOrderRefunded: emitOrderRefunded,
    emitBundleCreated: emitBundleCreated,
    emitDiscountCreated: emitDiscountCreated
  };
})(typeof window !== 'undefined' ? window : globalThis);
