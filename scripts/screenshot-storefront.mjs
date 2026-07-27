/**
 * Capture Storefront screenshot for visual review.
 * Usage: node scripts/screenshot-storefront.mjs
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
    biz: "Adrian's Lawn Service",
    businessName: "Adrian's Lawn Service",
    ownerName: 'Adrian Lopez',
    ownerFirst: 'Adrian',
    slug: 'adrians-lawn-service',
    city: 'Salt Lake City, UT',
    website: {},
    editorSvcs: [],
    services: [],
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
  const editor = document.getElementById('v-editor');
  if (editor) {
    editor.classList.remove('hidden');
    editor.hidden = false;
    editor.style.cssText = 'display:block!important;visibility:visible!important;opacity:1!important;height:100vh;overflow:hidden;';
  }
  if (typeof showPage === 'function') showPage('p-app');
  HublyJourneyOS.renderStorefront();
});

await page.waitForSelector('.jos-sf-mc-shell', { state: 'attached', timeout: 15000 });
await page.evaluate(() => {
  const app = document.getElementById('p-app');
  if (app) {
    app.classList.add('jos-pixel', 'jos-storefront-mode');
    app.style.cssText = 'display:flex!important;visibility:visible!important;opacity:1!important;position:fixed;inset:0;z-index:9999;';
  }
  const v = document.getElementById('v-editor');
  if (v) v.style.cssText = 'display:block!important;visibility:visible!important;opacity:1!important;height:100vh;overflow:hidden;';
});
await sleep(1200);
const shot = path.join(OUT, 'storefront-screenshot-exact.png');
await page.screenshot({ path: shot, fullPage: false });
const debug = await page.evaluate(() => {
  const text = document.body.innerText || '';
  return {
    hasBack: text.includes('Back to dashboard'),
    hasUrl: text.includes('adrians-lawn-service.hubly.site'),
    hasPublished: text.includes('Published'),
    hasPublish: text.includes('Publish changes'),
    hasWebsiteTab: !!document.querySelector('.jos-sf-mc-tab.on'),
    websiteOn: (document.querySelector('.jos-sf-mc-tab.on') || {}).textContent || '',
    hasHero: text.includes('Your Lawn. Our Passion.'),
    hasSaltLake: text.includes('Salt Lake City'),
    hasServices: text.includes('Complete Lawn Care Solutions'),
    hasMowing: text.includes('Lawn Mowing'),
    hasLandscaping: text.includes('Landscaping'),
    hasHedge: text.includes('Hedge Trimming'),
    hasSpring: text.includes('Spring Clean Up'),
    hasEditing: text.includes('Editing: Hero Section'),
    hasContent: !!document.querySelector('.jos-sf-mc-ctx-tab.on'),
    contentOn: (document.querySelector('.jos-sf-mc-ctx-tab.on') || {}).textContent || '',
    hasBookLink: !!(document.getElementById('jos-sf-hero-primary-link') || {}).value,
    primaryLink: (document.getElementById('jos-sf-hero-primary-link') || {}).value || '',
    badges: document.querySelectorAll('.jos-sf-mc-badge-row').length,
    svcCards: document.querySelectorAll('.sf-live-svc').length,
    storefrontMode: !!document.getElementById('p-app')?.classList.contains('jos-storefront-mode'),
    navHidden: getComputedStyle(document.querySelector('.app-nav') || document.body).display === 'none',
  };
});
console.log(JSON.stringify(debug, null, 2));
console.log('Wrote', shot);
await browser.close();
server.close();
