/**
 * Capture Reviews screenshot for visual review.
 * Usage: node scripts/screenshot-reviews.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir, readFile } from 'fs/promises';
import { createServer } from 'http';
import { extname } from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = '/opt/cursor/artifacts/screenshots';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2',
};

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/hubly.html';
      const file = path.join(ROOT, 'public', p.replace(/^\//, ''));
      if (!file.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403); res.end(); return; }
      const buf = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(buf);
    } catch (e) { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

await mkdir(OUT, { recursive: true });
const { server, base } = await serve();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
await page.goto(`${base}/hubly.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof HublyJourneyOS !== 'undefined', null, { timeout: 30000 });
await sleep(500);

await page.evaluate(() => {
  try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
  window.__HUBLY_ALLOW_DEMO_SEED__ = true;
  const st = (typeof S === 'function' ? S() : (window.S = window.S || {}));
  Object.assign(st, {
    _ceoDemo: true,
    biz: "Adrian's Lawn Service",
    businessName: "Adrian's Lawn Service",
    ownerName: 'Adrian Lopez',
    ownerFirst: 'Adrian',
    reviewsOs: {},
  });
  ['p-boot', 'p-landing', 'p-auth'].forEach((id) => {
    const n = document.getElementById(id);
    if (n) { n.style.display = 'none'; n.hidden = true; }
  });
  const app = document.getElementById('p-app');
  if (app) {
    app.hidden = false;
    app.classList.remove('hidden');
    app.classList.add('jos-pixel');
    app.style.cssText = 'display:flex!important;visibility:visible!important;opacity:1!important;position:fixed;inset:0;z-index:9999;';
  }
  document.querySelectorAll('.view, [id^="v-"]').forEach((v) => { v.classList.add('hidden'); v.hidden = true; });
  const rev = document.getElementById('v-reviews');
  if (rev) {
    rev.classList.remove('hidden');
    rev.hidden = false;
    rev.style.cssText = 'display:block!important;visibility:visible!important;opacity:1!important;height:100vh;overflow:auto;';
  }
  if (typeof showPage === 'function') showPage('p-app');
  document.querySelectorAll('.app-nav .ni[data-v]').forEach((n) => {
    n.classList.toggle('active', n.getAttribute('data-v') === 'reviews');
  });
  HublyJourneyOS.renderReviews();
});

await page.waitForSelector('.jos-rev-shot', { state: 'attached', timeout: 15000 });
await page.evaluate(() => {
  const app = document.getElementById('p-app');
  if (app) {
    app.classList.add('jos-pixel', 'jos-reviews-mode');
    app.style.cssText = 'display:flex!important;visibility:visible!important;opacity:1!important;position:fixed;inset:0;z-index:9999;';
  }
  const v = document.getElementById('v-reviews');
  if (v) v.style.cssText = 'display:block!important;visibility:visible!important;opacity:1!important;height:100vh;overflow:auto;';
});
await sleep(900);
const shot = path.join(OUT, 'reviews-screenshot-exact.png');
await page.screenshot({ path: shot, fullPage: false });
const debug = await page.evaluate(() => {
  const text = document.body.innerText || '';
  return {
    hasReviews: text.includes('Reviews'),
    hasTrust: text.includes('Build trust, grow your reputation'),
    hasAsk: text.includes('Ask Hubly'),
    hasExport: text.includes('Export reviews'),
    hasThisMonth: text.includes('This month'),
    hasRating50: text.includes('5.0'),
    hasFiveStar45: text.includes('45'),
    hasNew8: /\b8\b/.test(text),
    hasResponse100: text.includes('100%'),
    hasExcellent: text.includes('Excellent'),
    hasAiSummary: text.includes('AI Reputation Summary'),
    hasTakeAction: text.includes('Take Action'),
    hasPending10: text.includes('10 waiting'),
    hasAlex: text.includes('Alex Rivera'),
    hasSam: text.includes('Sam R.'),
    hasJordan: text.includes('Jordan Lee'),
    hasGrowth: text.includes('Review Growth'),
    hasGetMore: text.includes('Get More Reviews'),
    hasLink: text.includes('hubly.app/review/AdriansLawnService'),
    hasTabs: !!document.querySelector('.jos-rev-mc-tab'),
    hasRequestCta: text.includes('Request Review'),
    kpis: document.querySelectorAll('.jos-rev-shot-kpi').length,
    latest: document.querySelectorAll('.jos-rev-shot-item').length,
    reviewsMode: !!document.getElementById('p-app')?.classList.contains('jos-reviews-mode'),
  };
});
console.log(JSON.stringify(debug, null, 2));
console.log('Wrote', shot);
await browser.close();
server.close();
