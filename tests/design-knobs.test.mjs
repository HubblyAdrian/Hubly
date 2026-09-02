/**
 * Design knobs: the anchor pattern applied to design.
 *
 * The fixture is the real evergreen services section (document v15), so these are
 * statements about a page that exists rather than markup written to pass.
 *
 * The properties that matter:
 *   1. An unstamped page renders IDENTICALLY after stamping — every substitution keeps
 *      the generator's value as the fallback. This is what makes a retro-stamp safe.
 *   2. Stamping twice does not square the scales.
 *   3. A knob binds real declarations, and the COUNT is reported — a control is only
 *      offered where its count is > 0.
 *   4. Contrast is computed, not assumed: an unreadable background is refused.
 *   5. Reset returns exactly to what the generator chose.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = join(root, 'supabase/functions/_shared/hubly_design_knobs.ts');
const PAGE = readFileSync(join(root, 'tests/fixtures/evergreen-cards.html'), 'utf8');

function call(expr) {
  const out = execFileSync('deno', ['eval', '--quiet', `import * as m from "${mod}";\nconsole.log(JSON.stringify(${expr}));`], { encoding: 'utf8', maxBuffer: 1e8 });
  return JSON.parse(out);
}
const P = JSON.stringify(PAGE);

describe('stamping a real generated page', () => {
  const res = call(`m.stampDesignKnobs(${P})`);

  it('binds the two knobs the generator never variabilises', () => {
    assert.ok(res.bound.typeScale > 0, 'font-size must bind');
    assert.ok(res.bound.spaceScale > 0, 'padding/margin/gap must bind');
  });

  it('binds the ones it does, without disturbing them', () => {
    assert.ok(res.bound.radiusScale > 0, 'border-radius');
    assert.ok(res.bound.mediaRatio > 0, 'aspect-ratio (16/10 on the cards)');
  });

  it('reports a count per knob — the count is the gate for offering a control', () => {
    for (const [k, n] of Object.entries(res.bound)) assert.ok(n > 0, `${k} reported ${n}`);
  });

  it('keeps the generator value as the fallback everywhere it substitutes', () => {
    // Every var() this pass introduces carries a fallback, so an untouched page renders
    // exactly as before. A bare var(--hubly-…) with no fallback would be a silent change.
    const bare = [...res.html.matchAll(/var\(\s*--hubly-[a-z-]+\s*\)/g)];
    assert.equal(bare.length, 0, 'no hubly var without a fallback');
  });

  it('preserves the designed type scale rather than flattening it', () => {
    // The card heading is a clamp(); each component is multiplied, so the relationship
    // between sizes survives.
    assert.match(res.html, /font-size:\s*clamp\(calc\(1\.35rem \* var\(--hubly-type-scale, 1\)\)/);
  });

  it('scopes the hero without adding a selector to the page', () => {
    assert.match(res.html, /\[data-hc\^="hero"\]\{--hubly-type-scale:var\(--hubly-hero-scale,1\)\}/);
  });

  it('never rewrites a custom property definition', () => {
    assert.ok(!/--radius:\s*calc\(/.test(res.html), "the page's own --radius definition is untouched");
  });

  it('is idempotent — stamping twice does not square the scales', () => {
    const twice = call(`m.stampDesignKnobs(m.stampDesignKnobs(${P}).html)`);
    assert.equal(twice.html, res.html);
    assert.deepEqual(twice.bound, {});
  });
});

describe('setting and resetting', () => {
  it('sets a step and reports it in owner language', () => {
    const r = call(`m.setDesignKnob(${P}, "typeScale", "1.25")`);
    assert.equal(r.ok, true);
    assert.equal(r.label, 'text size');
    assert.match(r.html, /--hubly-type-scale:1\.25/);
  });

  it('stamps a never-stamped page on the way, so an owner never has to know', () => {
    const r = call(`m.setDesignKnob(${P}, "spaceScale", "0.8")`);
    assert.equal(r.ok, true);
    assert.match(r.html, /--hubly-space-scale:0\.8/);
  });

  it('refuses a value that is not one of the steps — the guardrail is the mechanism', () => {
    const r = call(`m.setDesignKnob(${P}, "typeScale", "3.7")`);
    assert.equal(r.ok, false);
    assert.equal(r.error, 'not_a_step');
  });

  it('resets one knob back to what the generator chose', () => {
    const r = call(`m.resetDesignKnob(m.setDesignKnob(${P}, "typeScale", "1.25").html, "typeScale")`);
    assert.match(r.html, /--hubly-type-scale:1(?![\d.])/);
    assert.deepEqual(r.reset, ['text size']);
  });

  it('resets everything at once', () => {
    const r = call(`m.resetDesignKnob(m.setDesignKnob(m.setDesignKnob(${P},"typeScale","1.25").html,"spaceScale","0.8").html)`);
    assert.match(r.html, /--hubly-type-scale:1(?![\d.])/);
    assert.match(r.html, /--hubly-space-scale:1(?![\d.])/);
  });
});

describe('colour: the maths is right, the control is withheld', () => {
  it('knows the ratio', () => {
    assert.ok(call(`m.contrastRatio("#ffffff","#000000")`) > 20);
    assert.ok(call(`m.contrastRatio("#222222","#333333")`) < 2);
  });

  it('resolves a colour through the page own var() chain', () => {
    // evergreen writes `color: var(--hubly-ink, var(--green-deep))`, so the colour that
    // actually paints is two hops away. Reading it wrong is how a contrast check ends up
    // grading a colour the page never uses.
    const pal = call(`m.pagePalette(${P})`);
    assert.ok(pal.some((p) => p.name === '--green-deep'));
  });

  it('offers the page own palette, not colours we invented', () => {
    const pal = call(`m.pagePalette(${P})`);
    assert.ok(pal.length >= 3, 'evergreen defines several colours');
    assert.ok(pal.some((p) => p.name === '--green'), 'its own names, read not assumed');
  });

  it('REFUSES to set a withheld knob at the write, not merely hides it', () => {
    // Hiding a control still leaves it reachable by anything that calls the writer. The
    // background knob binds correctly and is held back because "which text sits on the
    // page background" is structural knowledge the edge runtime does not have — a
    // dark background passed a 5.1:1 BODY check while the h1 rendered invisible at 390px.
    const r = call(`m.setDesignKnob(${P}, "background", "#f2ead8")`);
    assert.equal(r.ok, false);
    assert.equal(r.error, 'not_offered');
  });
});

describe('bound must mean moved — the two ways it did not', () => {
  const res = call(`m.stampDesignKnobs(${P})`);

  it('multiplies a var REFERENCE, not just a literal', () => {
    // The generator writes `border-radius: var(--radius)` and `max-width: var(--max)`
    // on most pages, with the literal in :root where this pass must not go. Matching
    // only numbers counted those as bound and moved nothing.
    assert.match(res.html, /border-radius:\s*calc\(var\(--radius\) \* var\(--hubly-radius-scale, 1\)\)/);
    assert.ok(!/border-radius:\s*var\(--radius\)\s*[;}]/.test(res.html), 'no unwrapped var reference left');
  });

  it('never rewrites the :root definition the reference points at', () => {
    assert.match(res.html, /--radius:\s*22px/);
  });

  it('reaches inside @media — that is where the phone styling lives', () => {
    // evergreen re-declares the card image ratio at narrow widths. If the media query
    // is skipped, the image knob works on desktop and does nothing on a phone.
    const ratios = [...res.html.matchAll(/aspect-ratio:\s*var\(--hubly-media-ratio/g)];
    assert.ok(ratios.length >= 2, `both the desktop and the media-query declaration (found ${ratios.length})`);
  });

  it('leaves keyframes alone', () => {
    assert.ok(!/@keyframes[^}]*calc\([^)]*--hubly-/.test(res.html));
  });
});
