// Exhaustive /store renderer proof: seed a PUBLISHED AST containing ALL 11 catalog blocks + a
// DIFFERENT draft, load the real /store route, and verify every block renders, productSpotlight +
// theme.font/density apply, Commerce refs resolve, and /store serves the PUBLISHED (not draft) AST.
// Boot-retries so a transient network blip (ENOTFOUND) can't be mistaken for an app failure.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs'; import path from 'node:path';
const SUPA = process.env.SUPABASE_URL, SR = process.env.SERVICE_ROLE_KEY, ANON = process.env.ANON_KEY;
const admin = createClient(SUPA, SR);
const PUBLIC = '/Users/adriansmithee/Projects/Hubly/public';
const BIZ = 'e8f9aabb-8009-4000-8000-000000000902';
const SLUG = 'sfb-ab-' + Date.now();
const localHtml = fs.readFileSync(path.join(PUBLIC, 'hubly.html'), 'utf8');
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
function serve(host) { return async (route) => { const req = route.request(); const u = new URL(req.url()); if (u.hostname !== host) return route.continue(); if (req.resourceType() === 'document') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: localHtml }); const fp = path.join(PUBLIC, decodeURIComponent(u.pathname)); if (fp.startsWith(PUBLIC) && fs.existsSync(fp) && fs.statSync(fp).isFile()) return route.fulfill({ status: 200, contentType: MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(fp) }); return route.fulfill({ status: 200, contentType: 'text/plain', body: '' }); }; }
async function cleanup() { for (const t of ['commerce_collection_products', 'commerce_products', 'commerce_collections', 'commerce_store_settings']) await admin.from(t).delete().eq('business_id', BIZ); await admin.from('businesses').delete().eq('id', BIZ); }
const R = []; const ck = (t, p, d = '') => { R.push({ t, p }); console.log((p ? 'PASS' : 'FAIL') + ' · ' + t + (d ? '  [' + String(d).slice(0, 120) + ']' : '')); };
(async () => {
  await cleanup();
  const mk = (p) => admin.from('commerce_products').insert({ business_id: BIZ, slug: 'p-' + Math.random().toString(36).slice(2, 8), status: 'active', product_type: 'physical', visibility: { website: true }, ...p }).select('*').single();
  await admin.from('businesses').insert({ id: BIZ, owner_id: null, name: 'AllBlocks', slug: SLUG, business_type: 'detailing', brand_color: '#0F172A', meta: '{}', capabilities: { website: true, storefront: true } });
  const ceramic = (await mk({ name: 'Ceramic Coating Kit', price_cents: 12999, featured: true })).data;
  const towel = (await mk({ name: 'Microfiber Towel', price_cents: 2499 })).data;
  const wax = (await mk({ name: 'Carnauba Wax', price_cents: 1999 })).data;
  const coll = (await admin.from('commerce_collections').insert({ business_id: BIZ, name: 'Coatings', slug: 'coatings', published: true }).select('*').single()).data;
  await admin.from('commerce_collection_products').insert({ collection_id: coll.id, product_id: ceramic.id, business_id: BIZ, sort_order: 0 });
  await admin.from('commerce_store_settings').insert({ business_id: BIZ, enabled: true });
  // PUBLISHED AST: every catalog block, premium/serif/roomy theme.
  const ord = (t, v, cfg, i) => ({ id: 'b' + i, type: t, order: 10 + i, visible: true, variant: v, config: cfg });
  const published = { version: 1, theme: { style: 'premium', accent: '#1F4D5A', font: 'serif', density: 'roomy' }, blocks: [
    ord('storeHero', 'tall', { headline: 'ALLBLOCKS HERO', sub: 'everything', showSearch: false }, 0),
    ord('featuredProducts', 'large', { title: 'Featured Row', productIds: [ceramic.id, wax.id] }, 1),
    ord('productGrid', 'standard', { title: 'Shop All', collectionId: null, columns: 3 }, 2),
    ord('collectionGrid', 'standard', { title: 'Categories' }, 3),
    ord('featuredCollection', 'banner', { title: 'Coatings Feature', collectionId: coll.id }, 4),
    ord('bestSellers', 'standard', { title: 'Top Sellers', productIds: [towel.id] }, 5),
    ord('productSpotlight', 'split', { productId: ceramic.id, title: 'Spotlight', blurb: 'Our hero product.' }, 6),
    ord('promoBanner', 'bold', { text: 'Free shipping', ctaText: 'Shop' }, 7),
    ord('brandStory', 'standard', { title: 'Our Story', body: 'We detail cars.' }, 8),
    ord('cta', 'standard', { title: 'Ready?', buttonText: 'Shop now' }, 9),
    ord('footer', 'standard', { text: 'AllBlocks Co' }, 10),
  ] };
  // DRAFT is DIFFERENT (1 block) — /store must NOT show this.
  const draft = { version: 1, theme: { style: 'clean', accent: null, font: 'sans', density: 'cozy' }, blocks: [ ord('storeHero', 'standard', { headline: 'DRAFT ONLY — SHOULD NOT SHOW', sub: '', showSearch: false }, 0) ] };
  await admin.from('businesses').update({ meta: JSON.stringify({ website: { heroHeadline: 'W' }, storefront: published, storefrontDraft: draft }) }).eq('id', BIZ);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = []; page.on('console', m => { if (m.type() === 'error') logs.push('CE:' + m.text()); }); page.on('pageerror', e => logs.push('EX:' + e.message));
  await page.route(`https://${SLUG}.myhubly.app/**`, serve(`${SLUG}.myhubly.app`));
  // Boot with retry — a transient network failure must not be read as an app failure.
  let html = '', booted = false;
  for (let attempt = 0; attempt < 3 && !booted; attempt++) {
    await page.goto(`https://${SLUG}.myhubly.app/store`, { waitUntil: 'domcontentloaded' });
    try { await page.waitForFunction(() => { const r = document.getElementById('hub-store-page-root'); return r && (r.innerHTML.match(/sp-block/g) || []).length >= 8; }, null, { timeout: 25000 }); booted = true; }
    catch (e) { console.log('   boot attempt ' + (attempt + 1) + ' incomplete, retrying…'); }
  }
  html = await page.evaluate(() => document.getElementById('hub-store-page-root').innerHTML);
  const has = (s) => html.includes(s);
  const rootCls = await page.evaluate(() => document.getElementById('hub-store-page-root').className);

  ck('render booted (>=8 blocks)', booted, 'sp-block=' + (html.match(/sp-block/g) || []).length);
  ck('block storeHero (tall)', has('sp-hero--tall') && has('ALLBLOCKS HERO'));
  ck('block featuredProducts (large) resolves ceramic+wax', has('sp-prod-grid sp-lg') && has('Ceramic Coating') && has('Carnauba Wax'));
  ck('block productGrid', has('Shop All'));
  ck('block collectionGrid resolves Coatings', has('Categories') && has('Coatings') && has('sp-col-card'));
  ck('block featuredCollection (banner)', has('Coatings Feature'));
  ck('block bestSellers resolves towel', has('Top Sellers') && has('Microfiber Towel'));
  ck('block productSpotlight (split) resolves ceramic + blurb', has('sp-spotlight--split') && has('Our hero product.'));
  ck('block promoBanner (bold)', has('sp-promo--bold') && has('Free shipping'));
  ck('block brandStory', has('Our Story') && has('We detail cars.'));
  ck('block cta', has('sp-cta') && has('Ready?'));
  ck('block footer', has('sp-foot') && has('AllBlocks Co'));
  ck('theme premium/serif/roomy classes applied to /store', /sp-theme-premium/.test(rootCls) && /sp-font-serif/.test(rootCls) && /sp-density-roomy/.test(rootCls), rootCls);
  ck('/store serves PUBLISHED, NOT the draft', !has('DRAFT ONLY'));
  ck('no product NAMES in the AST were needed — resolved live (real cards present)', has('data-product-id="' + ceramic.id + '"'));
  ck('no console/page errors during /store render', logs.length === 0, logs.slice(0, 3).join(' | '));

  await browser.close();
  await cleanup();
  const passed = R.filter(r => r.p).length;
  console.log(`\n==== /store ALL-BLOCKS RENDER: ${passed}/${R.length} passed ====`);
  if (passed !== R.length) R.filter(r => !r.p).forEach(r => console.log('  FAIL · ' + r.t));
})().catch(async e => { console.error('FATAL', e); await cleanup(); process.exit(1); });
