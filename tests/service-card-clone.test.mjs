/**
 * Adding a service to a freeform page clones a sibling card. What the clone may and
 * may not carry over is the whole test.
 *
 * The fixture is not invented markup — it is the real services section of
 * evergreen-yard-care.myhubly.app (document v15), the page the two defects were found
 * on, so a passing test here is a statement about a page that actually exists.
 *
 *   1. NEVER the sibling's photograph. A photo is a claim about the work; a new card
 *      wearing its neighbour's picture states something no one said. (Gutter Cleaning
 *      shipped showing Basic Mow's photo.)
 *   2. But the <img> ELEMENT STAYS, emptied — the page's own CSS renders the empty
 *      slot, and it is the owner's door to adding a photo. Deleting it would be
 *      another missing door.
 *   3. The layout's FIXED LABELS survive ("per visit"); only the sibling's per-service
 *      values are cleared. (Clones shipped with an empty unit span beside the price.)
 *   4. Nothing with a digit in it carries over — a leftover figure is the sibling's
 *      data, and a number nobody stated is the one thing that must never be published.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = join(root, 'supabase/functions/_shared/hubly_capability_registry.ts');
const PAGE = readFileSync(join(root, 'tests/fixtures/evergreen-cards.html'), 'utf8');

function insert(html, name, price, description) {
  const expr = `console.log(JSON.stringify(m.insertServiceIntoFreeform(${JSON.stringify(html)}, ${JSON.stringify(name)}, ${JSON.stringify(price ?? null) === 'null' ? 'undefined' : JSON.stringify(price)}, ${JSON.stringify(description ?? null) === 'null' ? 'undefined' : JSON.stringify(description)})));`;
  const out = execFileSync('deno', ['eval', '--quiet', `import * as m from "${mod}";\n${expr}`], { encoding: 'utf8' });
  return JSON.parse(out);
}
/** The markup of the entry that was appended — everything after the last original card. */
function addedEntry(html) {
  const last = html.lastIndexOf('<article');
  return html.slice(last, html.indexOf('</article>', last) + '</article>'.length);
}
const imgUrls = (h) => [...h.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/gi)].map((m) => m[1]);

describe('a cloned service card', () => {
  const r = insert(PAGE, 'Gutter Cleaning', 150, undefined);
  const card = r.ok ? addedEntry(r.html) : '';

  it('is added at all', () => {
    assert.equal(r.ok, true);
    assert.match(card, /data-hubly-service="Gutter Cleaning"/);
    assert.match(card, /data-hubly-price="Gutter Cleaning">\$150</);
  });

  it('carries NONE of the sibling photographs on the page', () => {
    const originals = imgUrls(PAGE);
    assert.ok(originals.length >= 3, 'fixture should have real photos to borrow');
    assert.deepEqual(imgUrls(card), [], 'the added card must have no image src at all');
    for (const url of originals) assert.ok(!card.includes(url), `borrowed ${url}`);
    assert.ok(!/<source\b/i.test(card), 'a <picture> source would serve the photo anyway');
    assert.ok(!/url\(/i.test(card), 'an inline background photo would too');
  });

  it('keeps the <img> element as the owner\'s door, marked as an empty slot', () => {
    const img = /<img\b[^>]*>/i.exec(card);
    assert.ok(img, 'the slot element must survive — with no <img> there is nothing to click');
    assert.match(img[0], /data-hubly-photo-slot="card"/);
    assert.match(img[0], /data-hc="[^"]+\.image"/, 'the label is what the editor resolves a click by');
    assert.ok(!/\bsrc=/i.test(img[0]), 'src="" would re-request the page itself');
    assert.match(img[0], /alt=""/, 'an empty slot depicts nothing');
  });

  it('keeps the layout\'s fixed unit label, which is not per-service data', () => {
    assert.match(card, />per visit</, 'the sibling card reads "$40 per visit"; the clone must read "$150 per visit"');
  });

  it('carries over no figure of the sibling\'s', () => {
    const text = card.replace(/<[^>]+>/g, ' ');
    assert.ok(!/\$\s?40\b/.test(text), "the sibling's price must not survive");
    assert.match(text, /\$150/);
  });

  it('does not carry the sibling\'s description when none was given', () => {
    assert.ok(!/A weekly mow/.test(card), "the sibling's blurb is its own");
    assert.match(card, /data-hubly-desc="Gutter Cleaning"[^>]*display:none/, 'an empty blurb slot is hidden, not shown empty');
    assert.equal(r.hadDesc, true, 'the layout has a blurb per card, so Hubly should ask for one');
  });

  it('fills the description when the owner did give one', () => {
    const r2 = insert(PAGE, 'Gutter Cleaning', 150, 'Downspouts flushed and gutters cleared.');
    const c2 = addedEntry(r2.html);
    assert.match(c2, /Downspouts flushed and gutters cleared\./);
    assert.ok(!/display:none/.test(c2));
  });

  it('leaves every original card untouched', () => {
    const before = PAGE.slice(0, PAGE.lastIndexOf('</article>') + 10);
    assert.ok(r.html.includes(before), 'an insert may not rewrite what is already on the page');
  });

  it('is numbered next, not a duplicate of the sibling', () => {
    assert.equal(r.labeled, true);
    assert.match(card, /data-hc="hero\.item\.7\./);
    assert.equal((r.html.match(/data-hc="hero\.item\.7\.title"/g) || []).length, 1);
  });
});
