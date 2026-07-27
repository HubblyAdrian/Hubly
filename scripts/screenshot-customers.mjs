/**
 * Capture Customers screenshot for visual review.
 * Usage: node scripts/screenshot-customers.mjs
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
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.goto(`${base}/hubly.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof HublyJourneyOS !== 'undefined', null, { timeout: 30000 });
await sleep(500);

await page.evaluate(() => {
  try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
  window.__HUBLY_ALLOW_DEMO_SEED__ = true;
  const st = (typeof S === 'function' ? S() : (window.S = window.S || {}));
  Object.assign(st, {
    _ceoDemo: true,
    biz: "Adrian's Lawn care",
    businessName: "Adrian's Lawn care",
    ownerName: 'Adrian Lopez',
    ownerFirst: 'Adrian',
    customers: [],
    team: [],
  });
  ['p-boot','p-landing','p-auth'].forEach((id) => {
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
  const cust = document.getElementById('v-customers');
  if (cust) {
    cust.classList.remove('hidden');
    cust.hidden = false;
    cust.style.cssText = 'display:block!important;visibility:visible!important;opacity:1!important;height:100vh;overflow:auto;';
  }
  if (typeof showPage === 'function') showPage('p-app');
  HublyJourneyOS.renderCustomers();
});

await page.waitForSelector('.jos-cm-shell', { state: 'attached', timeout: 15000 });
await page.evaluate(() => {
  const app = document.getElementById('p-app');
  if (app) {
    app.classList.add('jos-pixel', 'jos-customers-mode');
    app.style.cssText = 'display:flex!important;visibility:visible!important;opacity:1!important;position:fixed;inset:0;z-index:9999;';
  }
  const v = document.getElementById('v-customers');
  if (v) v.style.cssText = 'display:block!important;visibility:visible!important;opacity:1!important;height:100vh;';
});
await sleep(900);
const shot = path.join(OUT, 'customers-screenshot-exact.png');
await page.screenshot({ path: shot, fullPage: false });
const debug = await page.evaluate(() => ({
  cards: document.querySelectorAll('.jos-cm-card').length,
  segs: document.querySelectorAll('.jos-cm-seg').length,
  hasJames: !!(document.body.innerText || '').includes('James Anderson'),
  hasAdrianOwner: !!(document.body.innerText || '').includes('Adrian Owner'),
  has1248: !!(document.body.innerText || '').includes('1,248'),
  selected: !!document.querySelector('.jos-cm-card.on'),
}));
console.log(JSON.stringify(debug));
console.log('Wrote', shot);
await browser.close();
server.close();
