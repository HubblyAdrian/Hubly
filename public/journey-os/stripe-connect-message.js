/**
 * THE owner-facing sentence for a Stripe Connect failure. One copy, for every
 * surface that has a "Connect Stripe" button.
 *
 * WHY THIS FILE EXISTS
 *
 * On 2026-09-05 the same button failed four different ways in three files:
 *
 *   platform-home.html:4237   catch(e){}            -> SILENCE
 *   platform-home.html:4247   catch(e){}            -> SILENCE
 *   marketplace-lite.html:985 no catch at all       -> SILENCE (unhandled rejection)
 *   marketplace-lite.html:1006 setStatus(err.message) -> RAW API STRING
 *   hubly.html:31367          toast(e.message)      -> RAW API STRING
 *
 * The silence is prohibition 6: an owner clicked Connect Stripe, watched the
 * button say "Opening…" and go back to "Connect Stripe", and was told nothing
 * while the request 500'd. The raw string is the other half of the same defect —
 * Stripe's reply that day was ~500 characters of developer prose instructing the
 * READER to call POST /v2/core/accounts and run `npx skills add stripe/ai`. A
 * business owner cannot act on either one.
 *
 * THE RULE, BOTH WAYS: a plain sentence about what happened and what to do.
 * Never silence. Never a stack trace, an error code, or an API string.
 *
 * So this file owns the mapping and nothing else owns it. An unmapped failure
 * still gets a real sentence — never the raw text — and the raw text goes to the
 * console for us. Adding a case here fixes every surface at once, which is the
 * entire point: this bug was written once and shipped four times.
 */
(function (global) {
  'use strict';

  // Each rule: match the raw text (or our own error code), return what the OWNER
  // needs. `ours` marks the failures that are Hubly's or Stripe's to fix rather
  // than the owner's — the sentence has to say so, or they will keep clicking.
  var RULES = [
    {
      code: 'connect_platform_incomplete',
      test: /signed up for Connect|Connect platform|platform profile/i,
      text: 'Stripe still needs Hubly to finish its own Connect setup before your account can be created. This one is on us — we have been told, and you do not need to do anything.',
      ours: true
    },
    {
      // Stripe deprecating Accounts v1. If the compatibility flag is ever turned
      // off, or the deprecation lands, every owner hits this at once.
      test: /Accounts v1|v2\/core\/accounts/i,
      text: 'Stripe has changed how new payment accounts are created, and Hubly has not caught up yet. Nothing you did caused this and there is nothing to retry — we have been told and are fixing it.',
      ours: true
    },
    {
      test: /not configured|isn.t configured|STRIPE_SECRET_KEY/i,
      text: 'Card payments are not switched on in Hubly yet, so there is nothing to connect to. This is ours to fix — we have been told.',
      ours: true
    },
    {
      test: /session expired|Sign in required|not signed in|JWT|401/i,
      text: 'Your session has expired. Refresh the page, sign in again, and the Connect Stripe button will work.'
    },
    {
      test: /Business not found|business_id required/i,
      text: 'Hubly could not match this to your business. Reload the page and try again — if it happens twice, tell us.'
    },
    {
      test: /Could not save Stripe account/i,
      text: 'Stripe created your account but Hubly could not save it. Try Connect Stripe once more; if it fails again, tell us before entering anything else.',
      ours: true
    },
    {
      test: /No Stripe onboarding URL/i,
      text: 'Stripe did not return a setup link. Try Connect Stripe again in a minute.'
    },
    {
      test: /Failed to fetch|NetworkError|network|offline/i,
      text: 'Hubly could not reach Stripe. Check your connection and try Connect Stripe again.'
    },
    {
      test: /rate limit|too many requests|429/i,
      text: 'Stripe is asking us to slow down. Wait a minute, then try Connect Stripe again.'
    }
  ];

  // The last resort. It says what happened, what to do, and admits we do not know
  // more — which is honest, and is not the same thing as "something went wrong".
  var FALLBACK = 'Hubly could not start Stripe setup just now. Try Connect Stripe again in a minute — if it keeps failing, tell us and we will look; nothing has been charged or changed.';

  /**
   * describe(err) -> { text, ours, raw }
   *   text : the sentence to put in front of the owner. Always non-empty.
   *   ours : true when the owner cannot fix it by retrying.
   *   raw  : the original text, for the console. NEVER render this.
   */
  function describe(err) {
    var raw = '';
    var code = '';
    try {
      if (err) {
        raw = String(err.message || err.error || err || '');
        code = String(err.code || '');
      }
    } catch (e) { raw = ''; }

    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      if ((r.code && code === r.code) || (r.test && r.test.test(raw))) {
        return { text: r.text, ours: !!r.ours, raw: raw };
      }
    }
    return { text: FALLBACK, ours: false, raw: raw };
  }

  /** The sentence alone, for callers that only have somewhere to put a string. */
  function message(err) { return describe(err).text; }

  /**
   * report(err, show) — describe it, log the raw text for us, and hand the
   * sentence to whatever this surface uses to show things (toast, status line,
   * inline node). `show` is called exactly once, always. That "always" is the
   * whole fix: there is no path through here that says nothing.
   */
  function report(err, show) {
    var d = describe(err);
    try { console.warn('[stripe-connect]', d.raw || '(no message)', err); } catch (e) {}
    try { if (typeof show === 'function') show(d.text, d); } catch (e) {}
    return d;
  }

  global.HublyStripeConnectError = { describe: describe, message: message, report: report };
})(typeof window !== 'undefined' ? window : globalThis);
