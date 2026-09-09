#!/usr/bin/env node
/**
 * OWNER ROOMS — Planner, Jobs and Customers, at desktop and phone
 *
 * ══ WHAT THIS IS, AND WHAT IT IS NOT ══════════════════════════════════════════
 *
 * It runs the REAL renderers from public/platform-home.html against the REAL CSS,
 * producing the REAL DOM. What it does NOT have is a real owner session: there is no
 * service key in this environment and no way to hold a real JWT, so the claimed state
 * and the rows are SIMULATED.
 *
 * Every image it writes carries a banner saying exactly that, burned into the frame.
 * A screenshot of hand-set state renders like the product and behaves differently in
 * the ways that matter, and one handed over unlabelled has already cost two rounds of
 * reasoning about defects that did not exist. So it is labelled on its face, and this
 * harness is evidence about LAYOUT ONLY — never about what the server returns, what a
 * card's count really is, or what any of the eight promises actually does when clicked.
 * Those need Adrian signed in on the real thing.
 *
 * The injection is done at SERVE time on a copy in memory. public/platform-home.html
 * is never modified and ships no test hook.
 *
 * Exit codes:  0 shots taken and layout assertions passed · 1 a layout assertion failed
 *              2 CANNOT RUN (no browser, no server, injection point gone)
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require_('playwright')); }
catch (e) { console.error('CANNOT RUN — playwright not loadable: ' + e.message); process.exit(2); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'docs', 'shots', 'owner-rooms');
const PORT = 8795;

// ── The hook, injected into a served COPY. Last line inside the IIFE. ─────────
const HOOK = `
  window.__hcHarness = {
    hc: hc,
    identity: hcIdentity,
    events: hcEvents,
    counts: function(c){ hcHomeCounts = c; },
    renderRail: hcRenderRail,
    openWorkspace: function(id){ return hcOpenWorkspace(id); },
    renderHome: hcRenderHome,
    openEventPanel: hcOpenEventPanel,
    reflectAuth: hcReflectAuthState,
    forceAuthed: function(){ hcIsAuthed = function(){ return true; }; },
    loadIdentity: function(){ hcLoadIdentity = async function(){ hcIdentity.loaded = true; return hcIdentity; }; },
    loadEvents: function(list){ hcLoadEvents = async function(){ hcEvents.loaded = true; hcEvents.list = list; return list; }; },
    loadCounts: function(c){ hcLoadHomeCounts = async function(){ hcHomeCounts = c; return c; }; },
    rooms: function(){ return HC_ROOMS; },
    seedRooms: function(jobs, customers){
      authGetClient = async function(){
        return {
          rpc: async function(n){
            if (n === 'get_business_customers') return { data: customers };
            if (n === 'get_business_tasks') return { data: window.__seedTasks || [] };
            return { data: null };
          },
          from: function(t){
            var q = { select:function(){ return q; }, eq:function(){ return q; }, gte:function(){ return q; },
                      lte:function(){ return q; }, order:function(){ return q; },
                      then:function(res){ return res({ data: (t === 'jobs' ? jobs : []), error: null }); } };
            return q;
          },
          auth: { getUser: async function(){ return { data:{ user:{ id:'00000000-0000-0000-0000-0000000000aa', email:'owner@example.com' } } }; } }
        };
      };
    },
    stubs: function(){
      hcBuildGreeting = async function(){ return window.__hcNews || []; };
      hcSubscribeEvents = function(){};
      hcThreadScrollToEnd = function(){};
      hcSend = function(inp){ window.__lastAsk = inp && inp.value; if(inp) inp.value = ''; };
      window.__rpcCalls = [];
      authGetClient = async function(){ return { rpc: async function(n, a){ window.__rpcCalls.push({ n: n, a: a }); return { data: null }; },
        from: function(){ return { select: function(){ return { eq: function(){ return this; }, neq: function(){ return this; }, then: function(r){ return r({ count: 0, error: null }); } }; } }; },
        auth: { getUser: async function(){ return { data: { user: { id: '00000000-0000-0000-0000-0000000000aa', email: 'owner@example.com' } } }; } } }; };
    }
  };
`;

const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2' };
let injected = false;
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/platform-home.html';
  try {
    let buf = await readFile(path.join(PUBLIC, p));
    if (p === '/platform-home.html') {
      let html = buf.toString('utf8');
      const marker = '\n})();';
      const at = html.lastIndexOf(marker);
      if (at < 0) { res.writeHead(500); res.end('no injection point'); return; }
      html = html.slice(0, at) + '\n' + HOOK + html.slice(at);
      injected = true;
      buf = Buffer.from(html, 'utf8');
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
await mkdir(OUT, { recursive: true });


// Deliberately adversarial day: a real job, a BLOCK (a dentist appointment, which must
// not read as a customer), and a THIRD thing overlapping the first — because two things
// at 2pm is the highest-value thing this screen can say and nothing said it before.
const D0 = new Date();
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
const TODAY = iso(D0), TOMORROW = iso(new Date(D0.getTime() + 864e5));
const JOBS = [
  { id:'j1', customer_name:'Leslie Ammons', service_name:'Full Detail', scheduled_date:TODAY,
    scheduled_time:'12:00:00', duration_hours:3, amount:180, status:'scheduled', paid:false,
    phone:'(801) 555-0142', address:'488 W Center St', vehicle:'2019 F-150', is_block:false },
  { id:'j2', customer_name:null, service_name:'Dentist appointment', scheduled_date:TODAY,
    scheduled_time:'14:00:00', duration_hours:2, amount:null, status:'scheduled', paid:false,
    phone:null, is_block:true },
  { id:'j3', customer_name:'Marcus Reed', service_name:'Express Wash', scheduled_date:TOMORROW,
    scheduled_time:'08:30:00', duration_hours:1, amount:60, status:'scheduled', paid:true,
    phone:'(801) 555-0155', is_block:false }
];
const CUSTOMERS = [
  { identity_key:'8015550142', name:'Leslie Ammons', phone:'(801) 555-0142', email:null,
    vehicle:'2019 F-150', last_seen:TODAY, last_service:'Full Detail', visits:3, total_billed:540, merged_rows:2 },
  { identity_key:'8015550155', name:'Marcus Reed', phone:'(801) 555-0155', email:'m@example.com',
    vehicle:null, last_seen:TOMORROW, last_service:'Express Wash', visits:1, total_billed:60, merged_rows:1 },
  { identity_key:'row-3', name:'Walk-in (no details)', phone:null, email:null, vehicle:null,
    last_seen:null, last_service:null, visits:0, total_billed:0, merged_rows:1 }
];

const TASKS = [
  { id:'t1', title:'Order glass cleaner', due_date:null, due_time:null, band:'C',
    band_source:'proposed', band_reason:'nothing breaks if it slips', lane:'work', status:'open', roll_count:0, notes:null },
  { id:'t2', title:'Gym', due_date:TODAY, due_time:'18:00:00', band:'C',
    band_source:'owner', band_reason:null, lane:'personal', status:'open', roll_count:2, notes:null }
];

const VIEWS = [
  { id:'desktop', w:1440, h:900, label:'Desktop · 1440×900' },
  { id:'phone',   w:390,  h:844, label:'Phone · 390×844' }
];
const ROOMS = ['planner', 'jobs', 'customers'];

let browser;
try { browser = await chromium.launch(); }
catch (e) { console.error('CANNOT RUN — chromium would not launch: ' + e.message); server.close(); process.exit(2); }

const failures = [];
for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport:{ width:v.w, height:v.h }, deviceScaleFactor:2 });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/platform-home.html`, { waitUntil:'networkidle' });
  if (!await page.evaluate(() => !!window.__hcHarness)) {
    console.error('CANNOT RUN — hook did not install'); await browser.close(); server.close(); process.exit(2);
  }
  await page.evaluate(({ jobs, customers, tasks }) => {
    window.__seedTasks = tasks;
    const H = window.__hcHarness;
    H.stubs(); H.forceAuthed(); H.loadIdentity(); H.loadEvents([]); H.loadCounts({});
    Object.assign(H.identity, { loaded:true, logoUrl:null, brandColor:'#1f6f4a', city:'Lehi', state:'UT', owner:'Bruce', email:'owner@example.com' });
    window.__hcNews = [];
    // The room readers go through supabase; hand them the seeded rows.
    H.seedRooms(jobs, customers);
    Object.assign(H.hc, {
      active:true, draftClaimed:true, mode:'home', hasDocument:false,
      draftBusiness:{ id:'00000000-0000-0000-0000-000000000000', name:'Graef’s AutoCare', slug:'example-detailer', url:'https://example-detailer.myhubly.app' },
      messages:[],
      // The rail rows Graef actually holds after the backfill.
      places:[ { kind:'website', scope:'workspace', sort_order:10, visible:true },
               { kind:'planner', scope:'workspace', sort_order:20, visible:true },
               { kind:'jobs', scope:'workspace', sort_order:30, visible:true },
               { kind:'customers', scope:'workspace', sort_order:40, visible:true } ]
    });
    const app = document.getElementById('hcApp');
    app.hidden = false; app.removeAttribute('aria-hidden'); app.classList.add('is-active');
    document.body.classList.add('hc-active');
    H.reflectAuth(); H.renderRail();
  }, { jobs: JOBS, customers: CUSTOMERS, tasks: TASKS });
  await page.waitForTimeout(250);

  const tabs = await page.evaluate(() => [...document.querySelectorAll('.hc-rail-tab')].map(b => b.textContent.trim()));
  console.log(`${v.id}: rail = ${tabs.join(' · ')}`);
  if (v.w > 900 && tabs.length !== 5) failures.push(`${v.id}: expected Home + 4 earned places, got ${tabs.length}: ${tabs.join(', ')}`);

  for (const room of ROOMS) {
    await page.evaluate((r) => window.__hcHarness.openWorkspace(r), room);
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const canvas = document.getElementById('hcCanvas');
      const pane = document.querySelector('.hc-app-right');
      const rows = [...canvas.querySelectorAll('.hc-row')];
      const empty = canvas.querySelector('.hc-room-empty');
      return {
        mode: document.getElementById('hcApp').getAttribute('data-mode'),
        paneVisible: pane ? getComputedStyle(pane).display !== 'none' : false,
        title: (canvas.querySelector('.hc-room-hd h2') || {}).textContent || null,
        nRows: rows.length,
        clashes: canvas.querySelectorAll('.hc-row.is-clash').length,
        blocks: canvas.querySelectorAll('.hc-row.is-block').length,
        emptyText: empty ? empty.textContent.trim().slice(0, 60) : null,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    });
    if (m.mode !== room) failures.push(`${v.id}/${room}: data-mode is "${m.mode}"`);
    if (!m.paneVisible) failures.push(`${v.id}/${room}: the workspace pane is not visible — the room does not take the centre`);
    if (!m.title) failures.push(`${v.id}/${room}: room has no heading`);
    if (m.overflow) failures.push(`${v.id}/${room}: page scrolls sideways`);
    if (!m.nRows && !m.emptyText) failures.push(`${v.id}/${room}: no rows AND no empty-state sentence — an empty frame`);
    // A TITLE AND ITS SUBTITLE MUST NOT SHARE A LINE. "Leslie AmmonsFull Detail" passed
    // every measurement and was the first thing the eye caught — the second time today,
    // after the action cards this morning. So the check is general, not per-component.
    const weld = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('#hcCanvas .hc-row').forEach(r => {
        const t = r.querySelector('.hc-row-t'), sub = r.querySelector('.hc-row-s');
        if (!t || !sub) return;
        const a = t.getBoundingClientRect(), b = sub.getBoundingClientRect();
        if (b.top < a.bottom - 1) bad.push((t.textContent || '') + '|' + (sub.textContent || ''));
      });
      return bad;
    });
    for (const w of weld) failures.push(`${v.id}/${room}: title and subtitle share a line: "${w}"`);
    // And nothing in the floating header may sit inside the room's content.
    const chip = await page.evaluate(() => {
      const c = document.querySelector('.nav-signin'), h = document.querySelector('#hcCanvas .hc-room-hd');
      if (!c || !h) return false;
      const a = c.getBoundingClientRect(), b = h.getBoundingClientRect();
      return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
    });
    if (chip) failures.push(`${v.id}/${room}: the account chip overlaps the room heading`);
    console.log(`  ${room.padEnd(10)} rows=${m.nRows} clashes=${m.clashes} blocks=${m.blocks}${m.emptyText ? ' empty="' + m.emptyText + '"' : ''}`);
    if (room === 'planner') {
      // THE UNION IS THE POINT: 3 timed things + 2 tasks in ONE list.
      if (m.nRows !== 5) failures.push(`${v.id}/planner: expected 3 jobs/blocks AND 2 tasks in one list, got ${m.nRows} rows`);
      if (m.clashes !== 2) failures.push(`${v.id}/planner: expected 2 rows marked as clashing (12–15 vs 14–16), got ${m.clashes}`);
      if (m.blocks !== 1) failures.push(`${v.id}/planner: expected the dentist appointment to render as a block, got ${m.blocks}`);
    }
    // Open the first row as a record: a workspace takes the centre, a record takes the panel.
    if (m.nRows) {
      await page.evaluate(() => document.querySelector('#hcCanvas .hc-row').click());
      await page.waitForTimeout(220);
      const pan = await page.evaluate(() => {
        const el = document.getElementById('hcPanel');
        return { open: el && !el.hidden, title: (document.getElementById('hcPanelTitle')||{}).textContent || null,
                 rows: document.querySelectorAll('#hcPanelBody .hc-event-row').length };
      });
      if (!pan.open) failures.push(`${v.id}/${room}: clicking a row did not open the record panel`);
      if (pan.open && !pan.rows) failures.push(`${v.id}/${room}: record panel opened empty`);
      console.log(`             record panel: "${pan.title}" (${pan.rows} fields)`);
    }
    await page.evaluate((label) => {
      const st = document.createElement('style');
      st.textContent = '#hcApp{bottom:26px !important;height:auto !important} .hc-panel{bottom:26px !important}';
      document.head.appendChild(st);
      const b = document.createElement('div');
      b.textContent = 'SIMULATED CLAIMED STATE — not a real owner session. Layout evidence only. ' + label;
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:26px;z-index:99999;background:#7a1020;color:#fff;'
        + 'font:700 11px/26px -apple-system,system-ui,sans-serif;padding:0 10px;text-align:center;white-space:nowrap;overflow:hidden;box-sizing:border-box';
      document.body.appendChild(b);
    }, `${v.label} · ${room}`);
    await page.screenshot({ path: path.join(OUT, `${v.id}-${room}.png`) });
    await page.evaluate(() => { document.querySelectorAll('div[style*="7a1020"]').forEach(e => e.remove());
      document.querySelectorAll('style').forEach(s => { if (s.textContent.includes('bottom:26px')) s.remove(); });
      const x = document.getElementById('hcPanelX'); if (x) x.click(); });
  }
  await ctx.close();
}
await browser.close();
server.close();
if (failures.length) {
  console.error('\nFAIL:'); for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('\nPASS — three rooms render, take the centre, open records in the panel, and say');
console.log('something true when empty. SIMULATED session: what the server returns is not proved here.');
process.exit(0);
