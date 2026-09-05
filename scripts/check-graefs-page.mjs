#!/usr/bin/env node
/**
 * REGRESSION BASELINE — graefs-autocare.myhubly.app
 *
 * WHY THIS EXISTS
 *
 * Graef's AutoCare is our one real detailer's live site, and on 2026-09-04 it was
 * carrying four visible defects at once: five "Why Choose Us" cards that were a
 * checkmark and nothing else, a blank third card in the hero trust row, an
 * Instagram chip with no logo in it, and — worst — three headings he had edited by
 * clicking them, including a real pricing term ("Some Higher Level Services may
 * require Deposits and Quotes"), that were saved to his record and never rendered
 * again. Nothing in the suite noticed any of them, because everything in the suite
 * asks whether the code is right rather than what a visitor can read.
 *
 * So this asks the only question that matters for his page: is every word, link,
 * card and price a customer could read yesterday still there today?
 *
 * WHAT IT DOES
 *
 *   node scripts/check-graefs-page.mjs            # PASS, or names what changed
 *   node scripts/check-graefs-page.mjs --update   # re-record the baseline (deliberate)
 *   node scripts/check-graefs-page.mjs --slug X   # same check, another business
 *
 * It serves the working tree's public/ over https, points Chromium's host resolver
 * at it so <slug>.myhubly.app resolves locally, and loads the page exactly as a
 * visitor does — real record, real Supabase, local code. Then it compares the full
 * visible text, every link target, and the counts and contents of the repeated
 * elements against scripts/baselines/<slug>.json.
 *
 * WHAT IT DOES NOT PROVE: it renders the code in THIS working tree, not what is
 * deployed. A green run here means "this tree does not break his page"; it does not
 * mean production is fine. And it reads his live record, so a change HE makes will
 * show up as a diff — that is correct, and the fix is --update, never a code change.
 */
import { createServer } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { chromium } = require_('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const BASE_DIR = path.join(ROOT, 'scripts', 'baselines');

const argv = process.argv.slice(2);
const UPDATE = argv.includes('--update');
const SLUG = (argv[argv.indexOf('--slug') + 1] && argv.includes('--slug')) ? argv[argv.indexOf('--slug') + 1] : 'graefs-autocare';
const PORT = 8791;
const BASELINE = path.join(BASE_DIR, `${SLUG}.json`);

// ── a throwaway cert, regenerated per run; never committed ────────────────────
const TMP = path.join(ROOT, 'node_modules', '.cache', 'hubly-baseline');
mkdirSync(TMP, { recursive: true });
const KEY = path.join(TMP, 'key.pem'), CRT = path.join(TMP, 'cert.pem');
if (!existsSync(KEY) || !existsSync(CRT)) {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', KEY, '-out', CRT,
    '-days', '30', '-nodes', '-subj', '/CN=*.myhubly.app',
    '-addext', 'subjectAltName=DNS:*.myhubly.app,DNS:myhubly.app'], { stdio: 'ignore' });
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const server = createServer({ key: readFileSync(KEY), cert: readFileSync(CRT) }, async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/hubly.html';
  let file = path.join(PUBLIC, p);
  try { if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html'); }
  catch { file = path.join(PUBLIC, 'hubly.html'); }
  try {
    const buf = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

// ── what a visitor can read, see and click ────────────────────────────────────
const CAPTURE = () => {
  const root = document.querySelector('.page.active') || document.body;
  const vis = el => { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const chain = el => { let p = el; while (p && p !== document.documentElement) { if (!vis(p)) return false; p = p.parentElement; } return true; };
  const txt = el => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const text = []; let n;
  while ((n = walker.nextNode())) {
    const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
    if (t && n.parentElement && chain(n.parentElement)) text.push(t);
  }
  const cards = sel => [...root.querySelectorAll(sel)].filter(chain).map(txt);
  return {
    renderer: [...document.querySelectorAll('.page.active')].map(e => e.id).join(','),
    title: document.title,
    text,
    links: [...root.querySelectorAll('a[href]')].filter(chain)
      .map(a => ({ t: txt(a), href: a.getAttribute('href'), soc: a.getAttribute('data-soc') || null }))
      .sort((x, y) => (x.href + x.t).localeCompare(y.href + y.t)),
    why: cards('.ws-why-item'),
    trust: cards('.ws-trust-pill'),
    membership: cards('.ws-membership-card, .ws-mem-card'),
    reviews: cards('.ws-review-card'),
    faq: cards('.ws-faq-item'),
    social: [...root.querySelectorAll('.ws-social-btn')].filter(chain).map(a => ({
      soc: a.getAttribute('data-soc'), href: a.getAttribute('href'),
      // the Instagram defect was a glyph painted the same colour as its chip:
      // record the ink so an invisible logo is a diff, not a shrug.
      fill: (() => { const p = a.querySelector('svg path'); return p ? getComputedStyle(p).fill : null; })(),
      bg: getComputedStyle(a).backgroundImage.slice(0, 60),
    })),
    services: [...root.querySelectorAll('.ws-svc-card')].filter(chain).map(el => ({
      name: txt(el.querySelector('.ws-svc-name') || el.querySelector('h3') || document.createElement('i')),
      meta: txt(el.querySelector('.ws-svc-meta') || document.createElement('i')),
      desc: txt(el.querySelector('.ws-svc-desc') || document.createElement('i')),
    })),
  };
};

const browser = await chromium.launch({ headless: true, args: [`--host-resolver-rules=MAP *.myhubly.app 127.0.0.1:${PORT}`, '--ignore-certificate-errors'] });
let snap, err = null;
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await page.goto(`https://${SLUG}.myhubly.app/`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => {
    const a = [...document.querySelectorAll('.page.active')].map(e => e.id);
    return a.length && !a.includes('p-boot');
  }, null, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(4000);
  snap = await page.evaluate(CAPTURE);
} catch (e) { err = e; }
await browser.close();
server.close();

if (err) { console.error(`FAIL — could not render ${SLUG}: ${err.message}`); process.exit(1); }

// A page that renders almost nothing is a failure, not a new baseline.
if (!snap.text || snap.text.length < 20) {
  console.error(`FAIL — ${SLUG} rendered only ${snap.text ? snap.text.length : 0} text runs. Refusing to treat that as a page.`);
  process.exit(1);
}

if (UPDATE) {
  mkdirSync(BASE_DIR, { recursive: true });
  writeFileSync(BASELINE, JSON.stringify(snap, null, 1));
  console.log(`baseline recorded: ${path.relative(ROOT, BASELINE)}  (${snap.text.length} text runs, ${snap.links.length} links, ${snap.services.length} services)`);
  process.exit(0);
}
if (!existsSync(BASELINE)) {
  console.error(`FAIL — no baseline at ${path.relative(ROOT, BASELINE)}. Record one with --update once the page is known good.`);
  process.exit(1);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const problems = [];
const bag = arr => { const m = new Map(); for (const t of arr) m.set(t, (m.get(t) || 0) + 1); return m; };

// text, both directions
{
  const a = bag(base.text), b = bag(snap.text);
  const lost = [], gained = [];
  for (const [t, n] of a) { const d = n - (b.get(t) || 0); for (let i = 0; i < d; i++) lost.push(t); }
  for (const [t, n] of b) { const d = n - (a.get(t) || 0); for (let i = 0; i < d; i++) gained.push(t); }
  if (lost.length) problems.push(`${lost.length} thing(s) a visitor could read are GONE:\n` + lost.map(t => `      - ${JSON.stringify(t.slice(0, 120))}`).join('\n'));
  if (gained.length) problems.push(`${gained.length} thing(s) are NEW on the page:\n` + gained.map(t => `      + ${JSON.stringify(t.slice(0, 120))}`).join('\n'));
}
// links
{
  const a = base.links.map(l => `${l.href}`), b = snap.links.map(l => `${l.href}`);
  const lost = a.filter(h => !b.includes(h)), gained = b.filter(h => !a.includes(h));
  if (lost.length) problems.push(`link target(s) gone: ${lost.join(', ')}`);
  if (gained.length) problems.push(`link target(s) new: ${gained.join(', ')}`);
}
// the repeated elements, by count and by content
for (const key of ['why', 'trust', 'membership', 'reviews', 'faq']) {
  const a = base[key] || [], b = snap[key] || [];
  if (a.length !== b.length) { problems.push(`${key}: ${a.length} card(s) -> ${b.length}`); continue; }
  a.forEach((t, i) => { if (t !== b[i]) problems.push(`${key}[${i}] changed:\n      was ${JSON.stringify(String(t).slice(0, 110))}\n      now ${JSON.stringify(String(b[i]).slice(0, 110))}`); });
}
// services, field by field — a lost description is the silent one
{
  const a = base.services || [], b = snap.services || [];
  if (a.length !== b.length) problems.push(`services: ${a.length} card(s) -> ${b.length}`);
  else a.forEach((s, i) => {
    for (const f of ['name', 'meta', 'desc']) {
      if (s[f] !== b[i][f]) problems.push(`service[${i}] "${s.name}" ${f} changed:\n      was ${JSON.stringify(String(s[f]).slice(0, 110))}\n      now ${JSON.stringify(String(b[i][f]).slice(0, 110))}`);
    }
  });
}
// social row, including the ink — an invisible glyph must not pass
{
  const a = base.social || [], b = snap.social || [];
  if (a.length !== b.length) problems.push(`social row: ${a.length} icon(s) -> ${b.length}`);
  else a.forEach((s, i) => {
    if (s.soc !== b[i].soc || s.href !== b[i].href) problems.push(`social[${i}] changed: ${s.soc} ${s.href} -> ${b[i].soc} ${b[i].href}`);
    if (s.fill !== b[i].fill) problems.push(`social[${i}] (${s.soc}) glyph colour changed: ${s.fill} -> ${b[i].fill}`);
  });
}
if (base.renderer !== snap.renderer) problems.push(`renderer changed: ${base.renderer} -> ${snap.renderer}`);
if (base.title !== snap.title) problems.push(`page title changed: ${JSON.stringify(base.title)} -> ${JSON.stringify(snap.title)}`);

if (!problems.length) {
  console.log(`PASS — ${SLUG}: ${snap.text.length} text runs, ${snap.links.length} links, ${snap.services.length} services, ` +
    `${snap.why.length} why cards, ${snap.trust.length} trust pills, ${snap.membership.length} membership cards, ` +
    `${snap.reviews.length} reviews, ${snap.social.length} social icons — all match the baseline.`);
  process.exit(0);
}
console.error(`FAIL — ${SLUG} changed in ${problems.length} way(s):\n`);
for (const p of problems) console.error(`  * ${p}`);
console.error(`\nIf every change above is intended, re-record with:  node scripts/check-graefs-page.mjs --update`);
process.exit(1);
