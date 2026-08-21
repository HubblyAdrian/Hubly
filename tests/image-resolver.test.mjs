/**
 * The image resolver: the model marks where images go and what for; this pass
 * decides with what. The properties below are the guarantees the session was
 * built to make structural, not a hope about a prompt.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = join(root, 'supabase/functions/_shared/hubly_image_resolver.ts');

// Run resolveImages under Deno with an injected stock fetcher, return the result.
function resolve(html, ctxJs) {
  const script = `
import { resolveImages } from "${mod}";
const html = ${JSON.stringify(html)};
${ctxJs}
const r = await resolveImages(html, ctx);
console.log(JSON.stringify({ html: r.html, placed: r.placed, blanks: r.blanks, decisions: r.decisions }));
`;
  const out = execFileSync('deno', ['eval', '--quiet', script], { encoding: 'utf8' });
  return JSON.parse(out);
}

const PAGE = `<body>
<header><img src="#hubly-logo" alt="logo"></header>
<section class="hero"><img src="#hubly-image" data-role="hero" data-subject="dark premium car, no people" alt="hero"></section>
<section class="work"><h2>Our work</h2>
<img src="#hubly-image" data-role="gallery" data-subject="finished detail" alt="j1">
<img src="#hubly-image" data-role="gallery" data-subject="finished detail" alt="j2"></section>
<section class="about"><img src="#hubly-image" data-role="background" data-subject="clean garage, no people" alt="bg"></section>
</body>`;

const STOCK = `const stock = async (q) => ({ url:"https://pexels.test/a.jpg", assetId:"12345", photographer:"Jane", sourceUrl:"https://pexels.com/photo/12345", license:"Pexels License", description:"an empty clean garage" });`;

describe('image resolver', () => {
  it('never puts stock in a work section', () => {
    const r = resolve(PAGE, `${STOCK}
const placed=[];
const ctx = { businessId:"b", brandColor:"#0f766e", logoUrl:"https://s/logo.png", photos:[{url:"https://s/van.jpg",kind:"portfolio"}], businessType:"detailing", businessName:"Acme", fetchStock:stock, recordPlacement:(x)=>placed.push(x) };`);
    const workBlock = /class="work"[\s\S]*?<\/section>/.exec(r.html)[0];
    assert.ok(!/pexels\.test/.test(workBlock), 'no stock url in the work section');
    // the customer photo went to the work section, not the hero
    assert.ok(/van\.jpg/.test(workBlock), "the business's own photo is in its work section");
    assert.equal(r.decisions.find(d => d.role === 'gallery').outcome, 'customer');
  });

  it('reserves the customer photo for work over the hero', () => {
    const r = resolve(PAGE, `${STOCK}
const ctx = { businessId:"b", brandColor:"#0f766e", logoUrl:null, photos:[{url:"https://s/van.jpg",kind:"portfolio"}], fetchStock:stock };`);
    const gal = r.decisions.filter(d => d.role === 'gallery').map(d => d.outcome);
    assert.ok(gal.includes('customer'), 'a gallery slot gets the real photo');
    assert.equal(r.decisions.find(d => d.role === 'hero').outcome, 'pexels', 'hero falls to atmosphere stock');
  });

  it('uses the real logo, never leaves a monogram when a logo exists', () => {
    const r = resolve(PAGE, `${STOCK}
const ctx = { businessId:"b", brandColor:"#0f766e", logoUrl:"https://s/logo.png", photos:[], fetchStock:stock };`);
    assert.match(r.html, /<header><img src="https:\/\/s\/logo\.png"/);
    assert.ok(!/#hubly-logo/.test(r.html));
  });

  it('rejects a stock candidate that names a person', () => {
    const r = resolve('<body><section><img src="#hubly-image" data-role="hero" data-subject="a car" alt="h"></section></body>',
      `const stock = async () => ({ url:"x", assetId:"9", photographer:"P", sourceUrl:"s", license:"L", description:"a smiling man washing a car" });
const ctx = { businessId:"b", brandColor:"#123456", photos:[], fetchStock:stock };`);
    assert.equal(r.placed.filter(p=>p.provider==='pexels').length, 0);
    assert.equal(r.blanks, 1);
  });

  it('falls to a brand colour field, never a grey box or a live marker', () => {
    const r = resolve(PAGE, `const ctx = { businessId:"b", brandColor:"#c25a3a", logoUrl:null, photos:[], fetchStock: undefined };`);
    assert.ok(!/#hubly-image/.test(r.html), 'no unresolved marker survives');
    assert.match(r.html, /hubly-img-blank/);
    assert.match(r.html, /c25a3a/, 'the field uses the brand colour');
    assert.ok(!/background:#(ccc|ddd|eee|grey|gray)/i.test(r.html), 'never a grey box');
  });

  it('records provenance for every placed image', () => {
    const r = resolve(PAGE, `${STOCK}
const ctx = { businessId:"b", brandColor:"#0f766e", logoUrl:"https://s/logo.png", photos:[{url:"https://s/van.jpg",kind:"portfolio"}], fetchStock:stock };`);
    const byProvider = r.placed.map(p => `${p.provider}:${p.slot}`);
    assert.ok(byProvider.includes('customer:logo'));
    assert.ok(byProvider.includes('customer:gallery'));
    assert.ok(r.placed.some(p => p.provider === 'pexels' && p.assetId === '12345' && p.photographer === 'Jane' && p.license.includes('Pexels')));
  });
});
