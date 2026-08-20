/**
 * The data-hc stamping pass.
 *
 * WHY THIS TEST EXISTS
 *
 * Freeform pages are editable only because this pass labels them, and it is a
 * post-processing step precisely so that a page is NEVER rejected and
 * regenerated for being badly labelled. That makes the pass the only thing
 * standing between "the model wrote some HTML" and "the owner can click it", so
 * the properties below are the product, not implementation detail:
 *
 *   1. COVERAGE IS TOTAL. A half-labelled page is worse than an unlabelled one:
 *      the owner clicks two things, one works, and nothing reports it. Coverage
 *      is guaranteed by a catch-all and asserted in the pass itself.
 *
 *   2. COVERAGE IS NOT SUFFICIENT. The first working version of this pass hit
 *      100% coverage while labelling 40 of 51 elements `hero.text.N`, because
 *      <main> was treated as a band and swallowed the page. So these tests
 *      assert the SHAPE of the labels, not just the count.
 *
 *   3. NOTHING ELSE IN THE HTML CHANGES. The pass splices attributes into the
 *      original string rather than parsing to a DOM and serialising back, so
 *      removing the attributes must return the source byte-for-byte.
 *
 *   4. THE MODEL IS NEVER TRUSTED. Labels it emits are stripped and replaced.
 *
 * Runs the REAL exported function under Deno rather than re-deriving it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = join(root, 'supabase/functions/_shared/hubly_document_labels.ts');

function stamp(html) {
  const expr = `console.log(JSON.stringify(m.stampFreeformHtml(${JSON.stringify(html)})));`;
  try {
    const out = execFileSync('deno', ['eval', '--quiet', `import * as m from "${mod}";\n${expr}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(out);
  } catch (err) {
    assert.fail('Could not run under Deno:\n' + String(err.stderr || err.message));
  }
}

const labelsOf = (r) => r.labels.map((l) => l.label);

/** A page shaped like the ones the generator actually produces. */
const REAL_PAGE = `<!doctype html><html><head><style>.grid > .card { content: "<b>"; }</style></head><body>
<header><a href="/"><strong>Kilnwood Bakehouse</strong></a><nav><a href="#menu">Menu</a><a href="#about">About</a></nav></header>
<main>
  <section class="hero"><p>Wood-fired bakery</p><h1>Same-day bread from the fire.</h1><p>We bake in Ogden, Utah.</p><a class="btn" href="#menu">See the menu</a></section>
  <section id="menu"><p>Menu and prices</p><h2>Today's staples.</h2><div class="grid">
    <article class="card"><h3>Sourdough loaf</h3><div class="p">$9</div></article>
    <article class="card"><h3>Seeded rye</h3><div class="p">$11</div></article>
    <article class="card"><h3>Morning bun</h3><div class="p">$5.50</div></article>
  </div></section>
  <section id="visit"><h2>Call the bakehouse.</h2><a href="tel:+18015552200">801-555-2200</a><a href="mailto:hi@kilnwood.test">hi@kilnwood.test</a></section>
</main>
<footer><strong>Kilnwood Bakehouse</strong><a href="tel:+18015552200">801-555-2200</a></footer>
</body></html>`;

describe('data-hc stamping', () => {
  it('labels every editable element, and says so', () => {
    const r = stamp(REAL_PAGE);
    assert.equal(r.coverage.missed.length, 0, 'nothing may be left unlabelled');
    assert.equal(r.coverage.labelled, r.coverage.editable);
    assert.ok(r.coverage.editable > 10, 'the fixture should have real content in it');
  });

  it('gives the page a MEANINGFUL shape, not just full coverage', () => {
    // The regression this guards: 100% coverage with <main> treated as a band,
    // which put the whole page under hero.text.* and never advanced a section
    // ordinal past zero.
    const got = labelsOf(stamp(REAL_PAGE));
    assert.ok(got.includes('hero.headline'), 'the <h1> is the hero headline');
    assert.ok(got.includes('business.name'), 'the header names the business');
    assert.ok(got.includes('nav.item.1') && got.includes('nav.item.2'), 'nav links are labelled');
    // The hero is a band but is NOT numbered — the ordinals count the sections
    // after it. The fixture has two: the menu and the visit block.
    assert.ok(got.includes('section.1.heading'), 'the menu section is section.1');
    assert.ok(got.includes('section.2.heading'), 'the visit section is section.2');
    assert.ok(!got.some((l) => l.startsWith('section.3.')), 'and there is no third');
    // The card grid must be found as items, not flattened into body.N.
    for (const m of [1, 2, 3]) {
      assert.ok(got.includes(`section.1.item.${m}.title`), `menu item ${m} has a title`);
      assert.ok(got.includes(`section.1.item.${m}.body`), `menu item ${m} has a body`);
    }
    const heroText = got.filter((l) => l.startsWith('hero.text.')).length;
    assert.ok(heroText <= 2, `hero must not swallow the page (got ${heroText} hero.text.* labels)`);
  });

  it('repeats VALUE roles and never repeats positional ones', () => {
    const got = labelsOf(stamp(REAL_PAGE));
    // The phone number appears in the contact section AND the footer. Both are
    // contact.phone on purpose: "change my phone number" should change both.
    assert.equal(got.filter((l) => l === 'contact.phone').length, 2);
    assert.ok(got.includes('contact.email'));
    const positional = got.filter((l) => !l.startsWith('contact.') && !l.startsWith('business.'));
    assert.equal(new Set(positional).size, positional.length, 'positional labels must be unique');
  });

  it('changes nothing in the HTML except the attributes it adds', () => {
    const r = stamp(REAL_PAGE);
    const back = r.html.replace(/ data-hc="[^"]*"/g, '');
    assert.equal(back, REAL_PAGE, 'removing data-hc must return the source byte-for-byte');
  });

  it('is idempotent — re-stamping a stamped page reproduces it exactly', () => {
    const once = stamp(REAL_PAGE);
    const twice = stamp(once.html);
    assert.equal(twice.html, once.html);
    assert.equal(twice.strippedModelLabels, once.coverage.labelled, 're-stamping strips its own labels first');
  });

  it('discards labels the model invented rather than trusting them', () => {
    const r = stamp('<body><header data-hc="totally.bogus"><strong data-hc="hero.headline">Acme</strong></header><section><h1 data-hc="9.9.9">Real headline</h1></section></body>');
    assert.equal(r.strippedModelLabels, 3, 'all three model labels are removed');
    const byLabel = Object.fromEntries(r.labels.map((l) => [l.label, l.sample]));
    // The model put hero.headline on the wrong element. Ours wins.
    assert.match(byLabel['hero.headline'] || '', /Real headline/);
    assert.match(byLabel['business.name'] || '', /Acme/);
    assert.ok(!labelsOf(r).includes('totally.bogus'));
    assert.ok(!labelsOf(r).includes('9.9.9'));
  });

  it('survives HTML that breaks naive scanners', () => {
    const cases = {
      'raw text in <style>': '<body><style>.a > .b{content:"<h1>x</h1>"}</style><section><h1>Safe</h1></section></body>',
      'script containing markup': '<body><script>var s="</div><h1>fake</h1>";</script><section><h1>Safe</h1></section></body>',
      'attribute value containing >': '<body><section><h1>Safe</h1><a href="/a?b>c" title="x>y">Link</a></section></body>',
      'unclosed <p> siblings': '<body><section><h1>H</h1><p>one<p>two<p>three</section></body>',
      'unclosed <li>': '<body><section><h1>H</h1><ul><li>a<li>b<li>c</ul></section></body>',
      'no html or body element': '<h1>Ace Plumbing</h1><p>We fix taps.</p>',
      'empty document': '<body></body>',
    };
    for (const [name, html] of Object.entries(cases)) {
      const r = stamp(html);
      assert.equal(r.coverage.missed.length, 0, `${name}: nothing unlabelled`);
      assert.equal(r.coverage.labelled, r.coverage.editable, `${name}: coverage total`);
      const back = r.html.replace(/ data-hc="[^"]*"/g, '');
      assert.equal(back, html, `${name}: source preserved byte-for-byte`);
    }
    // The <h1> inside the <style> string is text, not an element, and must not
    // be labelled. One real <h1> on the page, one hero.headline.
    const styled = stamp(cases['raw text in <style>']);
    assert.equal(labelsOf(styled).filter((l) => l === 'hero.headline').length, 1);
  });

  it('labels images as images, distinctly from text', () => {
    const r = stamp('<body><header><img src="logo.png"></header><section><h1>H</h1><img src="hero.jpg"></section><section><h2>Gallery</h2><img src="1.jpg"><img src="2.jpg"></section></body>');
    const kinds = Object.fromEntries(r.labels.map((l) => [l.label, l.kind]));
    assert.equal(kinds['business.logo'], 'image');
    assert.equal(kinds['hero.image'], 'image');
    assert.equal(kinds['section.1.image.1'], 'image');
    assert.equal(kinds['section.1.image.2'], 'image');
    assert.equal(kinds['hero.headline'], 'text');
  });
});

describe('label grammar', () => {
  const valid = (l) => {
    const out = execFileSync('deno', ['eval', '--quiet', `import * as m from "${mod}";\nconsole.log(m.isValidHcLabel(${JSON.stringify(l)}));`], { encoding: 'utf8' });
    return out.trim() === 'true';
  };
  it('accepts closed roles with open ordinals', () => {
    for (const l of ['hero.headline', 'contact.phone', 'section.3.heading', 'section.12.item.4.title', 'nav.item.1', 'page.text.9']) {
      assert.ok(valid(l), `${l} should be valid`);
    }
  });
  it('rejects anything outside the vocabulary', () => {
    for (const l of ['', 'totally.bogus', '9.9.9', 'hero.headline.<script>', 'HERO.headline', 'section.0.heading']) {
      assert.ok(!valid(l), `${l} should be rejected`);
    }
  });
});

/**
 * A fact must not survive in two versions on one page.
 *
 * The markup below is taken verbatim from a real generated page. The <a> has an
 * element child, so it is not a leaf, so the editor cannot click it and the
 * stamping pass cannot label it — and the phone number inside it is therefore
 * invisible to a label-driven edit. Changing the phone number updated the two
 * "Call …" buttons and left this one alone, and the page published two
 * different phone numbers with nothing reporting it.
 */
describe('value-role fact sync', () => {
  const edit = (html, e) => {
    const mod = join(root, 'supabase/functions/_shared/hubly_freeform.ts');
    const out = execFileSync('deno', ['eval', '--quiet', `import * as m from "${mod}";\nconsole.log(JSON.stringify(m.applyFreeformEdit(${JSON.stringify(html)}, ${JSON.stringify(e)})));`], { encoding: 'utf8' });
    return JSON.parse(out);
  };

  const PAGE = stamp(`<body>
<header><a class="btn" href="tel:8015552200">Call 801-555-2200</a></header>
<section><h1>Bread</h1></section>
<section class="contact"><h2>Visit us</h2><div class="details">
  <a href="tel:8015552200"><strong>Phone</strong><br />801-555-2200</a>
  <a href="mailto:hi@x.test"><strong>Email</strong><br />hi@x.test</a>
</div></section>
</body>`).html;

  it('updates the number the editor cannot even click', () => {
    const r = edit(PAGE, { label: 'contact.phone', text: '801-555-7777' });
    assert.ok(r.ok);
    const numbers = [...r.html.matchAll(/801-555-\d{4}/g)].map((m) => m[0]);
    assert.deepEqual([...new Set(numbers)], ['801-555-7777'], 'one number, stated once and for all');
    const hrefs = [...new Set([...r.html.matchAll(/href="tel:[^"]*"/g)].map((m) => m[0]))];
    assert.deepEqual(hrefs, ['href="tel:8015557777"'], 'and every link dials it');
  });

  it('keeps the words around the value', () => {
    const r = edit(PAGE, { label: 'contact.phone', text: '801-555-7777' });
    assert.match(r.html, /Call 801-555-7777/, '"Call" must survive the substitution');
  });

  it('does not touch a value it was not asked about', () => {
    const r = edit(PAGE, { label: 'contact.phone', text: '801-555-7777' });
    assert.match(r.html, /hi@x\.test/, 'the email is untouched');
    assert.match(r.html, /href="mailto:hi@x\.test"/);
  });

  it('refuses an edit that changes nothing', () => {
    const r = edit(PAGE, { label: 'contact.phone', text: 'Call 801-555-2200' });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'no_change');
  });
});
