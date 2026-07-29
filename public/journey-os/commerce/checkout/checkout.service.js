/**
 * Checkout service — Cart → create-store-checkout → Stripe redirect.
 * Never fakes payment success.
 */
(function (global) {
  'use strict';

  async function startCheckout(opts) {
    opts = opts || {};
    var api = global.HublyCommerceApi;
    if (!api || typeof api.createCheckout !== 'function') {
      return { ok: false, error: 'not_configured', message: 'Commerce API not loaded' };
    }
    var cartId = opts.cartId || opts.cart_id;
    if (!cartId) {
      return { ok: false, error: 'cart_required', message: 'cart_id required' };
    }
    var result = await api.createCheckout({
      cart_id: cartId,
      customer_id: opts.customerId || opts.customer_id,
      customer_email: opts.customerEmail || opts.customer_email,
      customer_name: opts.customerName || opts.customer_name,
      customer_phone: opts.customerPhone || opts.customer_phone,
      shipping_mode: opts.shippingMode || opts.shipping_mode || 'pickup',
      shipping_rate_cents: opts.shippingRateCents || opts.shipping_rate_cents || 0,
      shipping_address: opts.shippingAddress || opts.shipping_address || {},
      channel: opts.channel || 'website',
      success_url: opts.successUrl || opts.success_url || (global.location && global.location.href),
      cancel_url: opts.cancelUrl || opts.cancel_url
    });
    if (!result.ok) return result;
    var url = result.data && result.data.url;
    if (!url) {
      return { ok: false, error: 'no_session_url', message: 'Provider not configured' };
    }
    if (opts.redirect !== false && typeof global.location !== 'undefined') {
      global.location.href = url;
    }
    return result;
  }

  global.HublyCommerceCheckout = {
    startCheckout: startCheckout
  };
})(typeof window !== 'undefined' ? window : globalThis);
