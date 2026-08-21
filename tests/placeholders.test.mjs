/**
 * Placeholder marking + credential stripping.
 *
 * The model marks what it invented (data-hubly-guess); this pass keeps those,
 * strips the never-invent credentials (grounding each against the record), and
 * backstops a narrow class of forgotten guesses. Deterministic, no model call.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = join(root, 'supabase/functions/_shared/hubly_placeholders.ts');

function annotate(html, record) {
  const expr = `console.log(JSON.stringify(m.annotatePlaceholders(${JSON.stringify(html)}, ${JSON.stringify(record)})));`;
  return JSON.parse(execFileSync('deno', ['eval', '--quiet', `import * as m from "${mod}";\n${expr}`], { encoding: 'utf8' }));
}

describe('placeholder marking', () => {
  it("keeps the model's own guess marks", () => {
    const r = annotate('<body><p data-hubly-guess="a suggested tagline">Timeless photographs.</p><h1>Real Name</h1></body>', { services: [] });
    assert.equal(r.placeholders.length, 1);
    assert.equal(r.placeholders[0].source, 'model');
    assert.match(r.placeholders[0].reason, /tagline/);
    assert.match(r.html, /data-hubly-guess="a suggested tagline"/);
  });

  it('backstops a numbered process the model forgot to mark', () => {
    const r = annotate('<body><section><div class="s"><span>01</span><h3>Book</h3></div><div class="s"><span>02</span><h3>Plan</h3></div><div class="s"><span>03</span><h3>Shoot</h3></div></section></body>', { services: [] });
    assert.ok(r.placeholders.some(p => p.source === 'backstop' && /process/i.test(p.reason)));
    assert.ok((r.html.match(/data-hubly-guess/g) || []).length >= 1);
  });

  it('never marks content that comes from the record', () => {
    // a real headline and a grounded price carry no guess mark
    const r = annotate('<body><h1>Redhill Roofing</h1><div>$150</div></body>', { services: [{ name: 'Inspection', price: 150 }] });
    assert.equal(r.placeholders.length, 0);
    assert.ok(!/data-hubly-guess/.test(r.html));
  });
});

describe('credential stripping', () => {
  const REC = { services: [{ name: 'Inspection', price: 150 }], yearsInBusiness: null, reviews: [] };

  it('strips star ratings and review counts', () => {
    const r = annotate('<body><div>★★★★★ 4.9 · 312 reviews</div><div>Trusted by 1,000+ homeowners</div><h1>Roofing</h1></body>', REC);
    assert.ok(!/★|4\.9|312 reviews|1,000\+/.test(r.html));
    assert.match(r.html, /Roofing/);
    assert.ok(r.stripped.some(s => s.kind === 'rating'));
    assert.ok(r.stripped.some(s => s.kind === 'review-count'));
  });

  it('strips licence/insurance/certification/guarantee claims', () => {
    const r = annotate('<body><span>Licensed & Insured</span><span>BBB Accredited</span><span>Satisfaction Guaranteed</span><span>Award-winning</span><h1>ok</h1></body>', REC);
    assert.ok(!/Licensed|Insured|BBB|Guaranteed|Award/i.test(r.html));
    assert.equal(r.stripped.filter(s => s.kind === 'credential').length, 4);
  });

  it('strips an ungrounded price but keeps one that matches the record', () => {
    const r = annotate('<body><div class="c"><h3>Inspection</h3><div>$150</div></div><div class="c"><h3>Upsell</h3><div>$999</div></div></body>', REC);
    assert.match(r.html, /\$150/, 'grounded price kept');
    assert.ok(!/\$999/.test(r.html), 'ungrounded price stripped');
    assert.ok(r.stripped.some(s => s.kind === 'price'));
  });

  it('strips ungrounded years but keeps a matching one', () => {
    const kept = annotate('<body><div>19 years in business</div></body>', { services: [], yearsInBusiness: 19, reviews: [] });
    assert.match(kept.html, /19 years/);
    const cut = annotate('<body><div>25 years in business</div></body>', { services: [], yearsInBusiness: 19, reviews: [] });
    assert.ok(!/25 years/.test(cut.html));
  });

  it('never MARKS a credential — it is stripped, not flagged', () => {
    const r = annotate('<body><div>★★★★★ 200 reviews · Licensed & Insured</div><h1>ok</h1></body>', REC);
    assert.equal(r.placeholders.length, 0, 'credentials produce no placeholder marks');
    assert.ok(r.stripped.length >= 1);
  });
});
