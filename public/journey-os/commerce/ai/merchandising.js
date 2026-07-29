/**
 * AI Merchandising — nightly job writes commerce_merchandising_recs.
 * Client helper reads local/demo recs for Store Overview.
 */
(function (global) {
  'use strict';

  function analyzeLocal(os) {
    os = os || (global.S && global.S.storeOs) || {};
    var recs = [];
    (os.products || []).forEach(function (p) {
      if (p.stock != null && p.lowStock != null && p.stock <= p.lowStock) {
        recs.push({
          kind: 'restock',
          title: 'Restock ' + p.name,
          detail: 'Only ' + p.stock + ' left (low at ' + p.lowStock + ').',
          productId: p.id
        });
      }
      if (p.status === 'active' && p.featured !== true && Number(p.price) > 50) {
        recs.push({
          kind: 'feature',
          title: 'Feature ' + p.name,
          detail: 'Higher-ticket active SKU — consider featuring on /store.',
          productId: p.id
        });
      }
    });
    var paid = (os.orders || []).filter(function (o) { return o.status === 'paid'; });
    if (paid.length >= 2) {
      recs.push({
        kind: 'bundle',
        title: 'Suggest a kit bundle',
        detail: 'Multiple paid product orders — try a maintenance kit bundle.',
        productId: null
      });
    }
    return recs.slice(0, 8);
  }

  global.HublyCommerceMerchandising = {
    analyzeLocal: analyzeLocal
  };
})(typeof window !== 'undefined' ? window : globalThis);
