/**
 * Hubly's machinery, injected into a freeform page.
 *
 * A freeform page lives in an iframe, so nothing the parent shell wires can
 * reach it. This pass puts the machinery inside the page instead. The
 * properties below are the contract:
 *
 *   1. EXACTLY ONE chat widget, always. Never zero, never two.
 *   2. ALWAYS a way to book. The model's CTA is REWRITTEN, not duplicated;
 *      if it placed none, one is injected.
 *   3. target="_top" on every booking link — without it the click navigates
 *      the iframe and the wizard renders inside a frame on a page that still
 *      thinks it is showing a website.
 *   4. Nothing else in the page changes.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = join(root, 'supabase/functions/_shared/hubly_page_runtime.ts');

const CTX = { businessId: 'b-123', businessName: 'Ridge & Co', slug: 'ridge-co', supabaseUrl: 'https://x.supabase.co', publishableKey: 'sb_publishable_test', accent: '#c25a3a' };

function inject(html, ctx = CTX) {
  const expr = `console.log(JSON.stringify(m.injectHublyRuntime(${JSON.stringify(html)}, ${JSON.stringify(ctx)})));`;
  const out = execFileSync('deno', ['eval', '--quiet', `import * as m from "${mod}";\n${expr}`], { encoding: 'utf8' });
  return JSON.parse(out);
}
function injectThrows(html) {
  try { inject(html); return null; } catch (e) { return String(e.stderr || e.message); }
}

const WITH_CTA = `<!doctype html><html><body><header><a class="btn" href="#hubly-book">Book a survey</a></header><main><h1>Roofing</h1></main></body></html>`;
const NO_CTA  = `<!doctype html><html><body><main><h1>Bread</h1><a href="tel:8015550000">Call us</a></main></body></html>`;

describe('hubly runtime injection', () => {
  it('rewrites the model CTA instead of adding a second one', () => {
    const r = inject(WITH_CTA);
    assert.equal(r.rewrittenCtas, 1);
    assert.equal(r.injectedFallbackCta, false, 'must not add a competing button');
    assert.ok(!r.html.includes('#hubly-book'), 'the sentinel must not survive as a dead link');
    assert.match(r.html, /href="https:\/\/ridge-co\.[^"]*\?book=1"/);
    assert.equal((r.html.match(/data-hubly-runtime="book"/g) || []).length, 0, 'no fallback button was needed');
  });

  it('gives every booking link target="_top"', () => {
    const r = inject(WITH_CTA);
    const link = /<a[^>]*book=1[^>]*>/.exec(r.html)[0];
    assert.match(link, /target="_top"/);
  });

  it('carries a named service through the sentinel', () => {
    const r = inject(`<body><a href="#hubly-book?svc=Half-day%20coverage">Book a half day</a></body>`);
    // '&' is written as '&amp;' in an href -- correct HTML, parsed back to '&'.
    assert.match(r.html, /\?book=1&(amp;)?svc=Half-day%20coverage/);
  });

  it('injects a booking entry when the model placed none', () => {
    const r = inject(NO_CTA);
    assert.equal(r.rewrittenCtas, 0);
    assert.equal(r.injectedFallbackCta, true);
    assert.equal((r.html.match(/data-hubly-runtime="book"/g) || []).length, 1);
    assert.match(r.html, /target="_top"/);
  });

  it('injects exactly one chat widget, every time', () => {
    for (const page of [WITH_CTA, NO_CTA, '<body></body>', 'no body tag at all']) {
      const r = inject(page);
      assert.equal(r.chatWidgets, 1, `one widget for: ${page.slice(0, 24)}`);
      assert.equal((r.html.match(/data-hubly-runtime="chat"/g) || []).length, 1);
    }
  });

  it('wires chat to the real endpoint, with the role the function demands', () => {
    const r = inject(WITH_CTA);
    assert.match(r.html, /functions\/v1\/chatbot-message/);
    assert.match(r.html, /"business_id"|business_id: CFG\.businessId/);
    // chatbot-message 400s on anything but "customer" for the last message.
    assert.match(r.html, /role: 'customer'/);
    assert.ok(!/role: 'user'/.test(r.html), "'user' would be rejected by the function");
  });

  it('leaves the page it was given otherwise untouched', () => {
    const r = inject(WITH_CTA);
    const stripped = r.html
      .replace(/\n<!-- Hubly chat[\s\S]*?<\/script>/, '')
      .replace(/ target="_top"/, '')
      .replace(/href="https:\/\/ridge-co\.[^"]*"/, 'href="#hubly-book"');
    assert.equal(stripped, WITH_CTA);
  });

  it('escapes a business name that would break out of the script', () => {
    const r = inject('<body><h1>x</h1></body>', { ...CTX, businessName: 'Bob\'s "Quote</script><script>alert(1)</script>' });
    assert.ok(!/<script>alert\(1\)<\/script>/.test(r.html), 'must not inject executable markup');
  });
});
