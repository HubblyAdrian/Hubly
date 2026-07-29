/**
 * AI Product Coach + knowledge helpers.
 * Uses Hubly AI when configured; never invents generic product advice when KB exists.
 * Stage 2: live embeddings on commerce_documents.
 */
(function (global) {
  'use strict';

  function productsForBiz() {
    var os = (global.S && global.S.storeOs) || {};
    return (os.products || []).filter(function (p) { return p.status === 'active'; });
  }

  function docsForBiz() {
    var os = (global.S && global.S.storeOs) || {};
    return os.documents || [];
  }

  /**
   * Rank local catalog for a customer question (deterministic until Hubly AI wired).
   * Prefer products whose name/description/category match keywords — never generic ChatGPT filler.
   */
  function recommendProducts(question) {
    var q = String(question || '').toLowerCase();
    var tokens = q.split(/[^a-z0-9]+/).filter(function (t) { return t.length > 2; });
    var scored = productsForBiz().map(function (p) {
      var hay = [p.name, p.description, p.category, p.sku].join(' ').toLowerCase();
      var score = 0;
      tokens.forEach(function (t) { if (hay.indexOf(t) > -1) score += 2; });
      if (/swirl|paint|ceramic|coat/.test(q) && /ceramic|coat|paint|polish/.test(hay)) score += 5;
      if (/towel|microfiber|wipe/.test(q) && /towel|microfiber/.test(hay)) score += 5;
      if (/gift/.test(q) && /gift/.test(hay)) score += 5;
      return { product: p, score: score };
    }).filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });

    var docs = docsForBiz().filter(function (d) {
      var body = String(d.body_text || d.body || d.title || '').toLowerCase();
      return tokens.some(function (t) { return body.indexOf(t) > -1; });
    });

    return {
      products: scored.slice(0, 4).map(function (x) { return x.product; }),
      documents: docs.slice(0, 3),
      source: docs.length ? 'knowledge_base+catalog' : (scored.length ? 'catalog' : 'none'),
      message: scored.length
        ? 'Based on your products and knowledge base:'
        : 'No matching products in this business catalog yet. Add products or upload docs so Hubly can answer specifically.'
    };
  }

  async function ask(question) {
    var local = recommendProducts(question);
    // Prefer Hubly AI edge when available — still ground on local catalog ids.
    try {
      if (global.HublyAI && typeof global.HublyAI.ask === 'function' && local.products.length) {
        var grounded = await global.HublyAI.ask({
          prompt: question,
          context: {
            kind: 'commerce_product_coach',
            productIds: local.products.map(function (p) { return p.id; }),
            documentIds: local.documents.map(function (d) { return d.id; })
          }
        });
        if (grounded && grounded.ok) {
          return Object.assign({}, local, { ai: grounded, message: grounded.text || local.message });
        }
      }
    } catch (e) { /* fall through to local */ }
    return local;
  }

  /** AI Product Builder scaffold — Stage 2 when AI provider configured. */
  async function generateProductFromSources(sources) {
    sources = sources || {};
    return {
      ok: false,
      error: 'not_configured',
      message: 'Generate with AI requires Hubly AI + commerce_documents indexing (Stage 2). Use Manual for now.',
      draft: null,
      sources: sources
    };
  }

  global.HublyCommerceAI = {
    recommendProducts: recommendProducts,
    ask: ask,
    generateProductFromSources: generateProductFromSources
  };
})(typeof window !== 'undefined' ? window : globalThis);
