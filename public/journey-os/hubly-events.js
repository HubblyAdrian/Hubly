/**
 * Hubly Event Bus (Rule #17) — in-process publish / subscribe.
 * Rule #18 — Business events are immutable (append-only frozen history).
 * Modules react to business events; they do not call each other's internals.
 *
 * Global: window.HublyEvents
 */
(function (global) {
  'use strict';

  var listeners = Object.create(null);
  var history = [];
  var MAX_HISTORY = 120;

  function freezeEntry(entry) {
    try {
      if (entry && typeof entry === 'object') {
        if (entry.payload && typeof entry.payload === 'object') Object.freeze(entry.payload);
        Object.freeze(entry);
      }
    } catch (_) { /* ignore freeze failures in exotic hosts */ }
    return entry;
  }

  function on(type, fn) {
    if (!type || typeof fn !== 'function') return function () {};
    var key = String(type);
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(fn);
    return function off() {
      listeners[key] = (listeners[key] || []).filter(function (f) { return f !== fn; });
    };
  }

  function once(type, fn) {
    var off = on(type, function (payload, meta) {
      off();
      fn(payload, meta);
    });
    return off;
  }

  function publish(type, payload) {
    var key = String(type || '');
    if (!key) return;
    var meta = Object.freeze({ type: key, at: new Date().toISOString() });
    var body = payload && typeof payload === 'object' ? Object.assign({}, payload) : { value: payload };
    var entry = freezeEntry({ type: key, payload: body, at: meta.at });
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    var list = (listeners[key] || []).slice();
    var wild = (listeners['*'] || []).slice();
    list.concat(wild).forEach(function (fn) {
      try { fn(body, meta); } catch (err) { console.warn('HublyEvents listener', key, err); }
    });
    return meta;
  }

  function recent(limit) {
    return history.slice(0, limit || 20);
  }

  /** Test-only — product modules must never clear business event history (Rule #18). */
  function clearHistoryForTests() {
    history = [];
  }

  global.HublyEvents = {
    version: '1.1.0',
    on: on,
    once: once,
    publish: publish,
    emit: publish,
    recent: recent,
    /** @deprecated test-only alias — prefer clearHistoryForTests */
    clearHistory: clearHistoryForTests,
    clearHistoryForTests: clearHistoryForTests,
    /** Canonical event name helpers */
    EVENTS: Object.freeze({
      LEAD_CREATED: 'lead.created',
      LEAD_QUALIFIED: 'lead.qualified',
      QUOTE_SENT: 'quote.sent',
      QUOTE_ACCEPTED: 'quote.accepted',
      JOB_BOOKED: 'job.booked',
      JOB_STARTED: 'job.started',
      JOB_COMPLETED: 'job.completed',
      PAYMENT_RECEIVED: 'payment.received',
      DEPOSIT_PAID: 'deposit.paid',
      INVOICE_SENT: 'invoice.sent',
      INVOICE_PAID: 'invoice.paid',
      INVOICE_VOIDED: 'invoice.voided',
      REFUND_ISSUED: 'refund.issued',
      PAYOUT_COMPLETED: 'payout.completed',
      MEMBERSHIP_STARTED: 'membership.started',
      MEMBERSHIP_RENEWED: 'membership.renewed',
      MEMBERSHIP_CANCELLED: 'membership.cancelled',
      MEMBERSHIP_PAUSED: 'membership.paused',
      MEMBERSHIP_VISIT_USED: 'membership.visit_used',
      REVIEW_REQUESTED: 'review.requested',
      REVIEW_RECEIVED: 'review.received',
      REVIEW_RESPONDED: 'review.responded',
      REPUTATION_CHANGED: 'reputation.changed',
      CAMPAIGN_SENT: 'campaign.sent',
      CUSTOMER_CREATED: 'customer.created',
      AI_ACTION_PROPOSED: 'ai.action.proposed',
      AI_ACTION_CONFIRMED: 'ai.action.confirmed',
      AI_ACTION_CANCELLED: 'ai.action.cancelled',
      AI_ACTION_EXECUTED: 'ai.action.executed',
      AI_DRAFT_GENERATED: 'ai.draft.generated',
      REPORT_GENERATED: 'report.generated',
      SETTINGS_UPDATED: 'settings.updated',
      SETTINGS_TEAM_INVITED: 'settings.team.invited',
      SETTINGS_INTEGRATION_TOGGLED: 'settings.integration.toggled',
      SETTINGS_SECURITY_AUDITED: 'settings.security.audited',
      /* Projects + Connected Apps (Hubly Core) */
      PROJECT_CREATED: 'project.created',
      PROJECT_BOOKED: 'project.booked',
      PROJECT_EDITING_COMPLETE: 'project.editing_complete',
      PROJECT_DELIVERED: 'project.delivered',
      GALLERY_PUBLISHED: 'gallery.published',
      GALLERY_DELIVERED: 'gallery.delivered',
      APP_CONNECTED: 'app.connected',
      APP_DISCONNECTED: 'app.disconnected',
      CREATIVE_ASSET_PLANNED: 'creative.asset_planned',
      CREATIVE_ASSET_CREATED: 'creative.asset_created',
      /* Commerce Engine (Store) */
      PRODUCT_CREATED: 'product.created',
      PRODUCT_UPDATED: 'product.updated',
      INVENTORY_CHANGED: 'inventory.changed',
      INVENTORY_LOW_STOCK: 'inventory.low_stock',
      ORDER_CREATED: 'order.created',
      ORDER_PAID: 'order.paid',
      ORDER_REFUNDED: 'order.refunded',
      BUNDLE_CREATED: 'bundle.created',
      GIFTCARD_USED: 'giftcard.used',
      DISCOUNT_CREATED: 'discount.created',
      CART_ABANDONED: 'cart.abandoned'
    })
  };
})(typeof window !== 'undefined' ? window : globalThis);
