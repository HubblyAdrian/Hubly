/**
 * Capture Jobs & Calendar screenshot for visual review.
 * Usage: node scripts/screenshot-jobs.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname } from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = '/opt/cursor/artifacts/screenshots';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/hubly.html';
      const file = path.join(ROOT, 'public', p.replace(/^\//, ''));
      if (!file.startsWith(path.join(ROOT, 'public'))) {
        res.writeHead(403); res.end(); return;
      }
      const buf = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(buf);
    } catch (e) {
      res.writeHead(404); res.end('not found');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return { server, base: `http://127.0.0.1:${port}` };
}

await mkdir(OUT, { recursive: true });
const { server, base } = await serve();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

await page.goto(`${base}/hubly.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof HublyJourneyOS !== 'undefined', null, { timeout: 30000 });
await sleep(600);

await page.evaluate(() => {
  try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
  window.__HUBLY_ALLOW_DEMO_SEED__ = true;
  const st = (typeof S === 'function' ? S() : (window.S = window.S || {}));
  Object.assign(st, {
    _ceoDemo: true,
    biz: "John's Detailing",
    ownerName: 'John Doe',
    ownerFirst: 'John',
    jobs: [],
    jobNotifications: [1, 2, 3, 4, 5, 6],
  });
  const app = document.getElementById('p-app');
  if (app) {
    app.classList.remove('hidden');
    app.hidden = false;
    app.style.display = '';
  }
  document.querySelectorAll('.view, [id^="v-"]').forEach((v) => {
    v.classList.add('hidden');
    v.hidden = true;
  });
  const jobs = document.getElementById('v-jobs');
  if (jobs) {
    jobs.classList.remove('hidden');
    jobs.hidden = false;
    jobs.style.display = '';
  }
  if (typeof showPage === 'function') showPage('p-app');
  HublyJourneyOS.renderJobs();
});

await page.waitForSelector('.jos-jobs-shot', { state: 'attached', timeout: 15000 });
const debug = await page.evaluate(() => {
  const shell = document.querySelector('.jos-jobs-shot');
  const v = document.getElementById('v-jobs');
  const app = document.getElementById('p-app');
  const cs = (n) => n ? getComputedStyle(n) : null;
  return {
    shell: shell ? { htmlLen: shell.innerHTML.length, display: cs(shell).display, vis: cs(shell).visibility, h: cs(shell).height, w: cs(shell).width } : null,
    vJobs: v ? { className: v.className, hidden: v.hidden, display: cs(v).display, vis: cs(v).visibility, h: cs(v).height } : null,
    app: app ? { className: app.className, hidden: app.hidden, display: cs(app).display } : null,
    hasRoot: !!document.getElementById('jos-jobs-root'),
    kpis: document.querySelectorAll('.jos-jobs-kpi').length,
    rows: document.querySelectorAll('.jos-jobs-row').length,
  };
});
console.log(JSON.stringify(debug, null, 2));
await page.evaluate(() => {
  document.body.style.background = '#F7F8FA';
  ['p-boot','p-landing','p-auth'].forEach((id) => {
    const n = document.getElementById(id);
    if (n) { n.style.display = 'none'; n.hidden = true; }
  });
  const app = document.getElementById('p-app');
  if (app) {
    app.hidden = false;
    app.classList.remove('hidden');
    app.style.cssText = 'display:flex!important;visibility:visible!important;opacity:1!important;position:fixed;inset:0;z-index:9999;background:#F7F8FA;';
  }
  const v = document.getElementById('v-jobs');
  if (v) {
    v.hidden = false;
    v.classList.remove('hidden');
    v.style.cssText = 'display:block!important;visibility:visible!important;opacity:1!important;height:100vh;overflow:auto;';
  }
  const shell = document.querySelector('.jos-jobs-shot');
  if (shell) shell.style.cssText += ';display:flex!important;visibility:visible!important;opacity:1!important;height:100vh;';
});
await sleep(500);
const shot = path.join(OUT, 'jobs-screenshot-exact.png');
await page.screenshot({ path: shot, fullPage: false });
console.log('Wrote', shot);

await browser.close();
server.close();
