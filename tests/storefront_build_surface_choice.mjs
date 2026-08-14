// Phase 3 smoke: the "What should we build for you?" first-decision UI renders the three peer
// options, and picking "Online Store" resolves to the store build surface (→ lightweight path).
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const PUBLIC = '/Users/adriansmithee/Projects/Hubly/public';
const localHtml = fs.readFileSync(path.join(PUBLIC, 'hubly.html'), 'utf8');
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
function serve(host) { return async (route) => { const req = route.request(); const u = new URL(req.url()); if (u.hostname !== host) return route.continue(); if (req.resourceType() === 'document') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: localHtml }); const fp = path.join(PUBLIC, decodeURIComponent(u.pathname)); if (fp.startsWith(PUBLIC) && fs.existsSync(fp) && fs.statSync(fp).isFile()) return route.fulfill({ status: 200, contentType: MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(fp) }); return route.fulfill({ status: 200, contentType: 'text/plain', body: '' }); }; }
const R = []; const ck = (t, p, d = '') => { R.push({ t, p }); console.log((p ? 'PASS' : 'FAIL') + ' · ' + t + (d ? '  [' + String(d).slice(0, 160) + ']' : '')); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 950 } });
  const page = await ctx.newPage();
  await page.route('https://myhubly.app/**', serve('myhubly.app'));
  await page.goto('https://myhubly.app/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.isArchitectEnsureBuildSurface === 'function' && typeof window.isShowStep === 'function', null, { timeout: 30000 });

  // Reveal the creative-build shell and clear any stored config, then run the first decision.
  const opts = await page.evaluate(async () => {
    try { localStorage.removeItem('hubly_build_surface'); } catch (e) {}
    window.currentBusiness = null; window.S = window.S || {}; S._is = S._is || {};
    isShowStep('creative-build');
    const exp = { intent: null, live: {} };
    window.__surfacePromise = isArchitectEnsureBuildSurface(exp, '');
    // Let the choice box render.
    await new Promise(r => setTimeout(r, 300));
    const box = document.getElementById('is-creative-choice');
    const btns = box ? Array.from(box.querySelectorAll('button[data-choice]')).map(b => b.getAttribute('data-choice')) : [];
    return { hidden: box ? box.hidden : true, choices: btns, prompt: (box?.querySelector('.cq')?.textContent) || '' };
  });
  ck('1 first decision renders "What should we build for you?"', /what should we build/i.test(opts.prompt), opts.prompt);
  ck('2 three peer options present (website / store / both)', JSON.stringify(opts.choices) === JSON.stringify(['website', 'store', 'both']), JSON.stringify(opts.choices));

  // Pick "Online Store" and await the resolved surface.
  const res = await page.evaluate(async () => {
    const box = document.getElementById('is-creative-choice');
    box.querySelector('button[data-choice="store"]').click();
    const surface = await window.__surfacePromise;
    return { surface, buildSurface: (window.S && S._is && S._is.buildSurface), stored: (() => { try { return localStorage.getItem('hubly_build_surface'); } catch (e) { return null; } })(), storeOnly: (typeof buildSurfaceIsStoreOnly === 'function') ? buildSurfaceIsStoreOnly() : 'nofn' };
  });
  ck('3 picking Online Store resolves surface=store', res.surface === 'store', JSON.stringify(res));
  ck('4 choice persisted (state + localStorage)', res.buildSurface === 'store' && res.stored === 'store', JSON.stringify(res));
  ck('5 store-only intended config detected', res.storeOnly === true, JSON.stringify(res));

  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message)));
  await page.waitForTimeout(300);
  ck('6 no uncaught page errors', errs.length === 0, errs.join(' | '));

  await browser.close();
  const passed = R.filter(r => r.p).length;
  console.log(`\n==== PHASE 3 FIRST-DECISION SMOKE: ${passed}/${R.length} passed ====`);
  if (passed !== R.length) { R.filter(r => !r.p).forEach(r => console.log('  FAIL · ' + r.t)); process.exit(1); }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
