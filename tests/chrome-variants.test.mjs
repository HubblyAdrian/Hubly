/**
 * The page header must not be the same on every business's site.
 *
 * WHY THIS TEST EXISTS
 *
 * The header is chrome, drawn by the shell, so the generator cannot vary it —
 * which was the right call (handing it to the model loses the validated logo
 * handling and the booking CTA) and had a cost nobody priced: the FIRST thing
 * any visitor saw was byte-identical on every site. Three real generated
 * headers pulled from stored rendered_html on 2026-08-18 differed only in two
 * initials and the nav labels.
 *
 * The fix is a vocabulary, not freedom. selectChromeVariant picks between real
 * layouts from real facts. So the assertions here are about the two things that
 * can actually go wrong with that:
 *
 *   1. The rule stops discriminating — every input maps to one variant again,
 *      which is the original bug wearing a variant system as a disguise. A test
 *      that only checked "a variant is chosen" would pass throughout.
 *   2. The rule stops being a rule — the same business renders differently on
 *      two runs, which would make "put the logo in the middle" unanswerable.
 *
 * Runs the REAL exported function under Deno rather than re-deriving it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docModule = join(root, 'supabase/functions/_shared/hubly_document.ts');
const dimsModule = join(root, 'supabase/functions/_shared/hubly_image_dims.ts');

function deno(modulePath, expression) {
  try {
    return execFileSync('deno', ['eval', '--quiet', `import * as m from "${modulePath}";\n${expression}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    assert.fail('Could not run under Deno:\n' + String(err.stderr || err.message));
  }
}

/** A minimal document root with `n` navigable sections and an optional hero class. */
function docWith(n, heroClass = '') {
  const kids = [{ tag: 'section', id: 'hero', attrs: heroClass ? { class: heroClass } : {}, children: [] }];
  const names = ['services', 'pricing', 'about', 'process', 'faq', 'booking'];
  for (let i = 0; i < n; i++) kids.push({ tag: 'section', id: names[i], attrs: {}, children: [] });
  return { tag: 'div', id: 'root', attrs: {}, children: kids };
}

function variantFor({ sections = 4, heroClass = '', logo = '', aspect = undefined, type = undefined, phone = undefined, overrides = undefined, name = 'Test Business' }) {
  const ctx = {
    businessId: 'b1',
    businessName: name,
    ...(phone ? { businessPhone: phone } : {}),
    ...(logo ? { businessLogoUrl: logo } : {}),
    ...(aspect !== undefined ? { businessLogoAspect: aspect } : {}),
    ...(type ? { businessType: type } : {}),
    ...(overrides ? { chromeOverrides: overrides } : {}),
  };
  const out = deno(
    docModule,
    `console.log(JSON.stringify(m.selectChromeVariant(${JSON.stringify(docWith(sections, heroClass))}, ${JSON.stringify(ctx)})));`,
  );
  return JSON.parse(out);
}

// A storage URL the media validator accepts, so `hasLogo` is genuinely true.
const LOGO = 'https://rtwxxkxpkqdrhclkozma.supabase.co/storage/v1/object/public/brand-assets/x.png';

describe('chrome header variants', () => {
  it('produces genuinely different headers for genuinely different businesses', () => {
    // THE POINT OF THE WHOLE SESSION. Not "a variant is returned" — that would
    // pass with one hardcoded variant. These three are the shape of the real
    // demonstration: a trade with a wordmark, a groomer with a round mark, and
    // a short page with no logo at all.
    const wordmark = variantFor({ logo: LOGO, aspect: 3.4, sections: 5, type: 'roofing', phone: '801-555-0100' });
    const round = variantFor({ logo: LOGO, aspect: 0.62, sections: 4, type: 'mobile dog grooming', phone: '801-555-0101' });
    const bare = variantFor({ sections: 1, type: 'photography' });

    const signature = (v) => [v.placement, v.shape, v.nav, v.cta, v.sticky, v.suppressName].join('|');
    const sigs = [signature(wordmark), signature(round), signature(bare)];
    assert.equal(new Set(sigs).size, 3, 'two or more businesses got the same header:\n  ' + sigs.join('\n  '));

    // And each difference must be the one the rule claims to produce, not an
    // accident that happens to differ.
    assert.equal(wordmark.suppressName, true, 'a wordmark must replace the printed name, not sit beside it');
    assert.equal(wordmark.cta, 'call', 'roofing is a call-first trade');
    // This hero is light, so the header is solid and free to stick. (The
    // transparent case, and why it is never sticky, has its own test below.)
    assert.equal(wordmark.style, 'solid');
    assert.equal(wordmark.sticky, true, '5 navigable sections is a long page');
    assert.equal(round.placement, 'stack', 'a mark taller than it is wide needs its own row');
    assert.equal(round.cta, 'book', 'grooming is a book-first trade');
    assert.equal(bare.placement, 'centre', 'no nav to balance against means centre the brand');
    assert.equal(bare.nav, 'none', 'a 1-section page has no jump list worth showing');
    assert.equal(bare.shape, 'monogram');
  });

  it('never makes a transparent header sticky, even when asked', () => {
    // The combination is illegible past the hero -- white type on white
    // sections, with the CTA floating over the contact form. Not overridable,
    // because an owner asking for both is asking for the broken one.
    const v = variantFor({
      sections: 6, heroClass: 'bg-brand-800',
      overrides: { headerStyle: 'transparent', sticky: true },
    });
    assert.equal(v.style, 'transparent');
    assert.equal(v.sticky, false);

    // And a solid header is still free to stick.
    const solid = variantFor({ sections: 6, overrides: { headerStyle: 'solid', sticky: true } });
    assert.equal(solid.sticky, true);
  });

  it('is a rule, not a roll of the dice', () => {
    // Same inputs, twice, in separate processes. If this ever fails, "put the
    // logo in the middle" stops being answerable.
    const a = variantFor({ logo: LOGO, aspect: 1.6, sections: 3, type: 'plumbing', phone: '801-555-0102' });
    const b = variantFor({ logo: LOGO, aspect: 1.6, sections: 3, type: 'plumbing', phone: '801-555-0102' });
    assert.deepEqual(a, b);
  });

  it('lets the owner override every axis it derives', () => {
    // This is what closes "logo has no controls". The derived answer for this
    // business is left/md/solid/full; every one of those must be overridable,
    // because each maps to a sentence someone will actually say.
    const derived = variantFor({ logo: LOGO, aspect: 1.0, sections: 4, type: 'plumbing', phone: '801-555-0103' });
    assert.equal(derived.placement, 'left');
    assert.equal(derived.scale, 'md');

    const forced = variantFor({
      logo: LOGO, aspect: 1.0, sections: 4, type: 'plumbing', phone: '801-555-0103',
      overrides: { logoPlacement: 'centre', logoScale: 'lg', headerStyle: 'transparent', nav: 'none', cta: 'book', sticky: false },
    });
    assert.equal(forced.placement, 'centre', '"put the logo in the middle"');
    assert.equal(forced.scale, 'lg', '"make the logo bigger"');
    assert.equal(forced.style, 'transparent');
    assert.equal(forced.nav, 'none');
    assert.equal(forced.sticky, false);
  });

  it('reads the trade out of the NAME, because business_type is a bucket', () => {
    // THE REAL RECORDS. Every left-hand value below was written by the model to
    // a real business_type column, and every one of them is wrong about the
    // trade. Before this the CTA was decided from the right-hand column alone,
    // so a chimney sweep -- whose customers phone -- got a booking button.
    const cases = [
      { name: 'Redcliff Chimney Sweep',   type: 'cleaning',          expect: 'call' },
      { name: 'Ridgeline Tree Service',   type: 'landscaping',       expect: 'call' },
      { name: 'Hollybrook Gutter Guards', type: 'windows',           expect: 'call' },
      { name: 'Granite Ridge Roofing',    type: 'roofing',           expect: 'call' },
      // Book-first trades must NOT be dragged along by the same change.
      { name: 'Larkspur Window Cleaning', type: 'windows',           expect: 'book' },
      { name: 'Marigold Dog Grooming',    type: 'grooming',          expect: 'book' },
      { name: 'Ember & Oak Barbershop',   type: 'barber',            expect: 'book' },
      { name: 'Willow Lane Bakery',       type: 'food',              expect: 'book' },
      { name: 'Cedar & Sage Yoga Studio', type: 'fitness',           expect: 'book' },
    ];
    const wrong = [];
    for (const c of cases) {
      const v = variantFor({ name: c.name, type: c.type, phone: '801-555-0100', sections: 4 });
      if (v.cta !== c.expect) wrong.push(`${c.name} (type=${c.type}) -> ${v.cta}, expected ${c.expect}`);
    }
    assert.deepEqual(wrong, [], 'CTA chosen wrongly:\n  ' + wrong.join('\n  '));
  });

  it('falls back to the category when the name does not say the trade', () => {
    // Not every business is named after what it does.
    const v = variantFor({ name: 'Redcliff & Sons', type: 'plumbing', phone: '801-555-0100', sections: 4 });
    assert.equal(v.cta, 'call');
    const b = variantFor({ name: 'Hollybrook Ltd', type: 'photography', phone: '801-555-0100', sections: 4 });
    assert.equal(b.cta, 'book');
  });

  it('never offers a phone CTA to a business with no phone number', () => {
    // A tel: link with nothing after it is a dead button in the most prominent
    // position on the page.
    const v = variantFor({ sections: 4, type: 'roofing' });   // call-first trade, no phone
    assert.equal(v.cta, 'book');
  });

  it('reads real image headers to decide the shape', () => {
    // The shape buckets are only as good as the measurement. A 1x1 PNG built
    // here byte by byte proves the decoder reads the file rather than the
    // filename — the failure mode being that every logo silently reports
    // "square" and every header goes back to being identical.
    const out = deno(dimsModule, `
      // PNG signature + IHDR declaring 300x100.
      const b = new Uint8Array([137,80,78,71,13,10,26,10, 0,0,0,13, 73,72,68,82,
        0,0,1,44, 0,0,0,100, 8,6,0,0,0]);
      const d = m.imageDimensions(b);
      console.log(JSON.stringify({ d, shape: m.logoShapeFor(d ? d.width/d.height : null) }));
    `);
    const { d, shape } = JSON.parse(out);
    assert.deepEqual(d, { width: 300, height: 100 });
    assert.equal(shape, 'wordmark');

    const svg = deno(dimsModule, `
      const b = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 64 64"></svg>');
      console.log(JSON.stringify(m.imageDimensions(b)));
    `);
    // viewBox beats width="100%", which would otherwise read as a 100-unit square.
    assert.deepEqual(JSON.parse(svg), { width: 64, height: 64 });

    const junk = deno(dimsModule, `console.log(JSON.stringify(m.imageDimensions(new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]))));`);
    assert.equal(JSON.parse(junk), null, 'unreadable bytes must return null, never a guess');
  });

  it('emits the variant in the markup so the CSS can act on it', () => {
    // The selection is worthless if the class never reaches the page. Renders
    // a real document and reads the header element back.
    const html = deno(docModule, `
      const doc = { root: ${JSON.stringify(docWith(1))} };
      console.log(JSON.stringify(m.renderHublyDocument(doc, { businessId: 'b', businessName: 'Solo Trader' })));
    `);
    const page = JSON.parse(html);
    const header = /<header class="([^"]+)"/.exec(page);
    assert.ok(header, 'no header rendered');
    for (const token of ['hd-h-centre', 'hd-mark-monogram', 'hd-h-static', 'hd-h-nonav']) {
      assert.ok(header[1].includes(token), `header class missing ${token}: ${header[1]}`);
    }
  });
});
