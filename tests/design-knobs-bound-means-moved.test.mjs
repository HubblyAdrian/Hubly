/**
 * BOUND MUST MEAN MOVED — the contract half. The cascade half is a browser harness:
 * `scripts/knob-bind-audit/`. Read that path before you trust anything here.
 *
 * WHY THIS FILE EXISTS. On 2026-09-02 the design-knob gate reported
 *
 *     ok: true, real: true, "Changed the header size."
 *
 * over a real owner's page that did not move a pixel. The gate was built to enforce
 * "bound is not moved" and was itself caught by "a passing measurement of the wrong
 * thing". FOUR predicates were tried; three were wrong:
 *
 *   P1  "does `var(--hubly-hero-scale)` appear in the HTML?"  -> 106/106 pages. It was
 *       matching the `[data-hc^="hero"]` rule WE inject at stamp time. Own footprint.
 *   P2  "does an element match `[data-hc^=\"hero\"]`?"         -> 106/106. Matching the
 *       scope says nothing about whether anything inside it carries a wrapped font-size.
 *   P3  flip the variable, diff the COMPUTED styles.           -> the truth.
 *   P4  P3 under jsdom.                                        -> WRONG, and measured:
 *       jsdom's getComputedStyle returns `calc(16px * var(--s,1))` verbatim and never
 *       resolves it, so it reports "nothing moved" for every knob, working ones included.
 *       Do not put the cascade check here. It needs a real engine.
 *
 * So this file asserts the CONTRACT — what the gate records, and what it refuses to guess
 * when the record is absent. Those are the properties that made the fix worth deploying,
 * and they are checkable without a cascade. The "does it actually move" question lives in
 * scripts/knob-bind-audit/, which drives a real browser, for the same reason
 * scripts/hero-fold-audit exists.
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
const q = (s) => JSON.stringify(s);

/** A page stamped by an OLDER pass: our block is present (so hasDesignKnobs is true and it
 *  is never re-stamped) but the wrappers and the recorded counts are not. This is
 *  evergreen, and every page stamped before the counts existed. */
function staleStamped() {
  const stamped = call(`m.stampDesignKnobs(${P})`).html;
  return stamped
    .replace(/calc\(\s*([^()]*?)\s*\*\s*var\(\s*--hubly-[a-z-]+-scale\s*,\s*1\s*\)\s*\)/g, '$1')
    .replace(/\sdata-hubly-bound="[^"]*"/, '');
}

describe('counts are recorded at stamp time, not re-derived at read time', () => {
  const stamped = call(`m.stampDesignKnobs(${P})`);

  it('the knob style block carries the counts stamping computed', () => {
    const recorded = call(`m.readRecordedBound(${q(stamped.html)})`);
    assert.ok(recorded, 'the block must carry data-hubly-bound');
    for (const [k, n] of Object.entries(stamped.bound)) {
      assert.equal(recorded[k], n, `recorded ${k} must equal what stamping computed`);
    }
  });

  it('records a zero rather than omitting it — missing must mean "older pass"', () => {
    const recorded = call(`m.readRecordedBound(${q(stamped.html)})`);
    for (const k of ['typeScale', 'heroScale', 'spaceScale', 'measureScale', 'radiusScale', 'mediaRatio', 'background', 'ink']) {
      assert.ok(k in recorded, `${k} must appear even when it is 0`);
    }
  });

  it('a recorded page is read from the record, with nothing unknown', () => {
    const b = call(`m.knobBinding(${q(stamped.html)})`);
    assert.deepEqual(b.unknown, []);
    assert.deepEqual(b.bound, call(`m.readRecordedBound(${q(stamped.html)})`));
  });

  it('a first-time value knob can still be written into our :root block', () => {
    // The block now carries an attribute. An exact-tag regex would stop finding :root and
    // the write would silently no-op — the same shape as the bug being fixed here.
    const r = call(`m.setDesignKnob(${q(stamped.html)}, "radiusScale", "0")`);
    assert.equal(r.ok, true);
    assert.match(r.html, /--hubly-radius-scale:\s*0/);
  });
});

describe('a page stamped by an OLDER pass — the case that shipped the lie', () => {
  const html = staleStamped();

  it('is recognised as stamped, and carries no counts', () => {
    assert.equal(call(`m.hasDesignKnobs(${q(html)})`), true);
    assert.equal(call(`m.readRecordedBound(${q(html)})`), null);
  });

  it('the OLD read-time predicate is still fooled — this is the bug, pinned', () => {
    // Deliberately asserting the broken behaviour of readDesignKnobs, so that if someone
    // "fixes" it here without fixing knobBinding, this test tells them where the gate is.
    const bound = call(`m.readDesignKnobs(${q(html)})`).bound;
    assert.ok((bound.heroScale || 0) > 0,
      'readDesignKnobs matches the [data-hc^="hero"] rule we inject ourselves');
  });

  it('the GATE does not repeat it: heroScale is UNKNOWN', () => {
    const b = call(`m.knobBinding(${q(html)})`);
    assert.deepEqual(b.unknown, ['heroScale']);
    assert.ok(!((b.bound.heroScale || 0) > 0), 'the gate must not report it bound');
  });

  it('UNKNOWN is not zero — "nothing would change" is also a claim we cannot support', () => {
    const b = call(`m.knobBinding(${q(html)})`);
    assert.equal(b.bound.heroScale, undefined,
      'reporting 0 would let the writer say "there is nothing on your page that header size would change"');
  });

  it('the four declaration-anchored knobs are still counted, not blanket-refused', () => {
    // Measured on the stale repro (2026-09-02): type 0/moved 0, space 0/moved 0,
    // measure 5/moved 8, radius 4/moved 8. Their predicate counts declarations the
    // GENERATOR wrote, so it stays truthful on an old stamp. Refusing all five would
    // have broken four working controls for every existing owner.
    const b = call(`m.knobBinding(${q(html)})`);
    assert.deepEqual(b.unknown, ['heroScale'], 'only heroScale is unknowable from markup');
    for (const k of ['typeScale', 'spaceScale', 'measureScale', 'radiusScale']) {
      assert.ok(!b.unknown.includes(k), `${k} must still be answerable on an old stamp`);
    }
  });
});

describe('what the owner is told', () => {
  it('a withheld knob explains itself instead of saying "not yet"', () => {
    for (const k of ['mediaRatio', 'background', 'ink']) {
      const r = call(`m.setDesignKnob(${P}, ${q(k)}, "1")`);
      assert.equal(r.ok, false);
      assert.equal(r.error, 'not_offered');
      assert.ok(r.summary.length > 60, `${k} must say WHY, not "I can't change that one yet"`);
    }
  });

  it('stepping past the end reports the end rather than clamping silently', () => {
    const stamped = call(`m.stampDesignKnobs(${P})`).html;
    const top = call(`m.setDesignKnob(${q(stamped)}, "typeScale", "1.25")`).html;
    const past = call(`m.stepKnob(${q(top)}, "typeScale", "up")`);
    assert.equal(past.atEnd, true, 'must report atEnd, not silently return the same step');
  });
});
