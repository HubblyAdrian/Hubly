/**
 * A nav item is a promise that there is something there.
 *
 * WHY THIS TEST EXISTS
 *
 * Lehi Mobile Dog Grooming shipped, to a real customer-facing URL, with a menu
 * item reading **"Node"** — from a section the model had given `id="node"`.
 * navLabel title-cases whatever it is handed, so an id describing the markup
 * rather than the content became a link in the site's main navigation, pointing
 * at a section about nothing.
 *
 * The fix is a DENY-list, not an allow-list, and that choice is the thing worth
 * protecting. An allow-list would have to enumerate every section a small
 * business might ever have — "warranty", "our-vans", "before-and-after",
 * "meet-the-groomers" — and every one it had not thought of would silently
 * vanish from the nav. That is the worse failure: a missing nav item is
 * invisible, a wrong one at least announces itself. So the last test here is
 * the one that matters most — it asserts that unusual-but-real section names
 * still survive.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docModule = join(root, 'supabase/functions/_shared/hubly_document.ts');

/**
 * Render a document whose sections have the given ids, and read the nav back.
 *
 * `pad` appends three unambiguously-good sections. Without them a case that
 * drops two ids can fall below three survivors, and selectChromeVariant hides
 * the nav entirely at that point -- so the test would read `[]` and "the bad id
 * was dropped" would be indistinguishable from "the whole nav was". The padding
 * keeps the nav switched on so the assertion is about labels, which is what
 * this file is for; the nav on/off rule is tested in chrome-variants.
 *
 * NAV_MAX_ITEMS caps the nav at 5, so the padding is also what the expectations
 * below trail off into.
 */
const PAD = ['pricing', 'booking', 'contact'];

function navFor(ids, pad = true) {
  const all = pad ? ids.concat(PAD) : ids;
  const kids = [{ tag: 'section', id: 'hero', attrs: {}, children: [] }].concat(
    all.map((id) => ({ tag: 'section', id, attrs: {}, children: [] })),
  );
  const doc = { root: { tag: 'main', id: 'root', attrs: {}, children: kids } };
  const expr =
    `const html = m.renderHublyDocument(${JSON.stringify(doc)}, { businessId: 'b', businessName: 'Test' });\n` +
    `const nav = [...html.matchAll(/class="hd-nav-link"[^>]*>([^<]*)</g)].map(x => x[1]);\n` +
    `console.log(JSON.stringify(nav));`;
  try {
    return JSON.parse(
      execFileSync('deno', ['eval', '--quiet', `import * as m from "${docModule}";\n${expr}`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim(),
    );
  } catch (err) {
    assert.fail('Could not render under Deno:\n' + String(err.stderr || err.message));
  }
}

describe('derived nav labels', () => {
  it('drops the id that actually shipped', () => {
    // The exact bug, in the exact shape it reached a customer's site.
    const nav = navFor(['services', 'node', 'about']);
    assert.ok(!nav.includes('Node'), 'the "Node" nav item is still being rendered: ' + nav.join(', '));
    assert.deepEqual(nav, ['Services', 'About', 'Pricing', 'Booking', 'Contact']);
  });

  it('drops structural ids, numbered or not', () => {
    const nav = navFor(['div', 'section-2', 'block_3', 'wrapper', 'container', 'node7']);
    assert.deepEqual(nav, ['Pricing', 'Booking', 'Contact'], 'structural ids leaked into the nav: ' + nav.join(', '));
  });

  it('drops chrome the shell already renders, and the page you are on', () => {
    // A nav link to the header, or to the hero the visitor is looking at, is
    // noise at best and a link to nowhere at worst.
    const nav = navFor(['header', 'footer', 'nav', 'top', 'banner']);
    assert.deepEqual(nav, ['Pricing', 'Booking', 'Contact']);
  });

  it('drops labels too short or too numeric to be a section name', () => {
    const nav = navFor(['a', '3', '42', 'faq']);
    assert.deepEqual(nav, ['FAQ', 'Pricing', 'Booking', 'Contact']);
  });

  it('KEEPS unusual but real section names', () => {
    // THE ASSERTION THAT MATTERS. The deny-list must not become a de facto
    // allow-list of the sections we happened to imagine. Every one of these is
    // a plausible small-business section and none of them would appear in any
    // list I would have written up front.
    const real = [
      'warranty', 'our-vans', 'before-and-after', 'meet-the-groomers',
      'financing', 'emergency-callouts', 'pet-policy', 'what-to-expect',
    ];
    const nav = navFor(real, false);
    // NAV_MAX_ITEMS caps the nav at 5, so check that the survivors are the
    // first five IN ORDER rather than that all eight appear.
    assert.deepEqual(nav, [
      'Warranty', 'Our vans', 'Before and after', 'Meet the groomers', 'Financing',
    ]);
  });

  it('still honours the readability overrides', () => {
    const nav = navFor(['faq', 'how-it-works', 'service-area'], false);
    assert.deepEqual(nav, ['FAQ', 'How it works', 'Service area']);
  });
});
