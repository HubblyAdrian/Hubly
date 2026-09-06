/**
 * THE money formatter. One copy, for everything that shows a customer a price.
 *
 * WHY THIS FILE EXISTS
 *
 * There were FIVE copies of this function, and all five were wrong the same way:
 *
 *   commerce/components.js         product cards
 *   commerce/store-page.js         the /store route
 *   commerce/storefront-cart.js    cart lines and subtotal
 *   commerce/storefront-renderer.js  the website store embed
 *   store-commerce.js              the owner Store admin
 *
 * Every one formatted with `maximumFractionDigits: 0`, which ROUNDS, and every one
 * had a catch-fallback of `'$' + Math.round(v)`, which rounds again. So the
 * storefront displayed a price it was not going to charge. Measured on the live
 * page 2026-09-06: a product at price_cents 2499 rendered "$25" on the card, on the
 * cart line AND in the subtotal, while create-store-checkout charged $24.99.
 *
 * It was not always in the customer's favour, which is the part with teeth: $24.40
 * displayed as "$24" and billed $24.40 — the customer pays MORE than the sticker.
 * A storefront that misquotes is Hubly saying something untrue about someone else's
 * business, on their page, to their customer.
 *
 * THE RULE: a displayed price is the price that will be charged. Never round.
 * Whole amounts stay clean ("$25"); anything with cents shows its cents ("$24.99").
 * Both are exact — $25 and $25.00 are the same number — so the clean look survives
 * without ever lying.
 *
 * A value duplicated five times is a value nobody owns. Same reasoning as
 * journey-os/hubly-public-key.js. Change it here.
 *
 * UNITS. `format(n)` takes DOLLARS, because that is what all five copies took and
 * what the storefront payload carries (storefront-renderer maps price_cents/100).
 * `fromCents(c)` takes CENTS and is what new code should use — cents are the
 * authoritative unit everywhere in commerce_* and in Stripe, and going through
 * dollars invites float dust. Both round to the nearest cent internally so
 * 2499/100 can never render as $24.990000000000002.
 */
(function (global) {
  'use strict';

  function toCents(dollars) {
    var v = Number(dollars);
    if (!isFinite(v)) v = 0;
    return Math.round(v * 100);
  }

  // The one formatting decision, in one place. `cents` is an integer.
  function renderCents(cents, currency) {
    var neg = cents < 0;
    var abs = Math.abs(cents);
    var hasFraction = (abs % 100) !== 0;
    var value = abs / 100;
    var out;
    try {
      out = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: hasFraction ? 2 : 0,
        maximumFractionDigits: hasFraction ? 2 : 0
      }).format(value);
    } catch (e) {
      // Fallback must obey the same rule. The old fallback was Math.round(), which
      // is how the bug survived even where Intl was unavailable.
      out = '$' + (hasFraction ? value.toFixed(2) : String(Math.trunc(value)));
    }
    return neg ? '-' + out : out;
  }

  /** Dollars in, display string out. Never rounds away cents. */
  function format(dollars, currency) {
    return renderCents(toCents(dollars), currency);
  }

  /** Cents in, display string out. Prefer this in new code. */
  function fromCents(cents, currency) {
    var c = Number(cents);
    if (!isFinite(c)) c = 0;
    return renderCents(Math.round(c), currency);
  }

  global.HublyMoney = { format: format, fromCents: fromCents, toCents: toCents };
})(typeof window !== 'undefined' ? window : globalThis);
