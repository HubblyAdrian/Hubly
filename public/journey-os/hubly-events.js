/**
 * Hubly Event Bus (Rule #17) — in-process publish / subscribe.
 * Modules react to business events; they do not call each other's internals.
 *
 * Global: window.HublyEvents
 */
(function (global) {
  'use strict';

  var listeners = Object.create(null);
  var history = [];
  var MAX_HISTORY = 80;

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
    var meta = { type: key, at: new Date().toISOString() };
    var body = payload && typeof payload === 'object' ? payload : { value: payload };
    history.unshift({ type: key, payload: body, at: meta.at });
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

  function clearHistory() {
    history = [];
  }

  global.HublyEvents = {
    version: '1.0.0',
    on: on,
    once: once,
    publish: publish,
    emit: publish,
    recent: recent,
    clearHistory: clearHistory,
    /** Canonical event name helpers */
    EVENTS: {
      LEAD_CREATED: 'lead.created',
      LEAD_QUALIFIED: 'lead.qualified',
      QUOTE_SENT: 'quote.sent',
      QUOTE_ACCEPTED: 'quote.accepted',
      JOB_BOOKED: 'job.booked',
      JOB_STARTED: 'job.started',
      JOB_COMPLETED: 'job.completed',
      PAYMENT_RECEIVED: 'payment.received',
      MEMBERSHIP_STARTED: 'membership.started',
      MEMBERSHIP_RENEWED: 'membership.renewed',
      REVIEW_REQUESTED: 'review.requested',
      REVIEW_RECEIVED: 'review.received',
      REVIEW_RESPONDED: 'review.responded',
      REPUTATION_CHANGED: 'reputation.changed',
      CAMPAIGN_SENT: 'campaign.sent',
      CUSTOMER_CREATED: 'customer.created'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
