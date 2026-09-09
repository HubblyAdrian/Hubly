#!/usr/bin/env node
/**
 * OWNER HOME — LAYOUT HARNESS (four real device widths, panel open and closed)
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
const OUT = path.join(ROOT, 'docs', 'shots', 'owner-home');
const PORT = 8793;

// ── The hook, injected into a served COPY. Last line inside the IIFE. ─────────
const HOOK = `
  window.__hcHarness = {
    hc: hc,
    identity: hcIdentity,
    events: hcEvents,
    counts: function(c){ hcHomeCounts = c; },
    renderRail: hcRenderRail,
    renderHome: hcRenderHome,
    openEventPanel: hcOpenEventPanel,
    reflectAuth: hcReflectAuthState,
    forceAuthed: function(){ hcIsAuthed = function(){ return true; }; },
    loadIdentity: function(){ hcLoadIdentity = async function(){ hcIdentity.loaded = true; return hcIdentity; }; },
    loadEvents: function(list){ hcLoadEvents = async function(){ hcEvents.loaded = true; hcEvents.list = list; return list; }; },
    loadCounts: function(c){ hcLoadHomeCounts = async function(){ hcHomeCounts = c; return c; }; },
    stubs: function(){
      hcBuildGreeting = async function(){ return window.__hcNews || []; };
      hcSubscribeEvents = function(){};
      hcThreadScrollToEnd = function(){};
      hcSend = function(inp){ window.__lastAsk = inp && inp.value; if(inp) inp.value = ''; };
      hcOpenWorkspace = function(id){ hc.mode = id; };
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

// ── Row shapes copied from the real tables, values obviously fictional. ──────
const EVENTS = [
  { kind:'booking.created', is_new:true, occurred_at:new Date(Date.now()-36e5).toISOString(),
    customer_name:'Marcus Reed', customer_phone:'(801) 555-0147', service_name:'Full Detail',
    event_date:'2026-09-12', event_time:'10:00', amount:85, status:'pending', vehicle:'2019 F-150',
    address:'488 W Center St, Lehi UT', notes:'Water spots on the hood.' },
  { kind:'chat.asked', is_new:true, occurred_at:new Date(Date.now()-90*6e4).toISOString(),
    customer_name:null, notes:'Do you do ceramic coating on a truck this size?',
    other_asks:'How long does it take?', message_count:4, consented:false },
  { kind:'booking.abandoned', is_new:false, occurred_at:new Date(Date.now()-26*36e5).toISOString(),
    customer_name:'Dana Whitfield', customer_email:'dana@example.com', service_name:'Express Wash',
    event_date:'2026-09-14', event_time:'14:00', status:'abandoned' }
];

const VIEWS = [
  { id:'phone',            w:390,  h:844,  label:'Phone · 390×844' },
  { id:'tablet-portrait',  w:834,  h:1112, label:'Tablet portrait · 834×1112' },
  { id:'tablet-landscape', w:1194, h:834,  label:'Tablet landscape · 1194×834' },
  { id:'desktop',          w:1440, h:900,  label:'Desktop · 1440×900' }
];

let browser;
try { browser = await chromium.launch(); }
catch (e) { console.error('CANNOT RUN — chromium would not launch: ' + e.message); server.close(); process.exit(2); }

const failures = [];
const shots = [];
for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/platform-home.html`, { waitUntil: 'networkidle' });
  const ok = await page.evaluate(() => !!window.__hcHarness);
  if (!ok) { console.error('CANNOT RUN — the harness hook did not install'); await browser.close(); server.close(); process.exit(2); }

  await page.evaluate((events) => {
    const H = window.__hcHarness;
    H.stubs(); H.forceAuthed(); H.loadIdentity(); H.loadEvents(events);
    H.loadCounts({ jobsToday: 3, openBookings: 2, openLeads: 4 });
    Object.assign(H.identity, {
      loaded:true, logoUrl:null, brandColor:'#1f6f4a', city:'Lehi', state:'UT',
      owner:'Bruce', email:'owner@example.com'
    });
    window.__hcNews = ['Someone asked about ceramic coating an hour ago and didn’t book.'];
    Object.assign(H.hc, {
      active:true, draftClaimed:true, mode:'home', hasDocument:false,
      draftBusiness:{ id:'00000000-0000-0000-0000-000000000000', name:'Graef’s AutoCare',
                      slug:'example-detailer', url:'https://example-detailer.myhubly.app' },
      messages:[{ role:'user', content:'hi' }]
    });
    // .is-active is how the app is ACTUALLY revealed (display AND opacity). Setting
    // style.display alone leaves opacity:0 — every rect measures fine and the screenshot
    // is blank. That happened on the first run of this harness and is the reason the
    // paint assertion below exists.
    const app = document.getElementById('hcApp');
    app.hidden = false; app.removeAttribute('aria-hidden');
    app.classList.add('is-active');
    document.body.classList.add('hc-active');
    H.reflectAuth(); H.renderRail();
    return H.renderHome();
  }, EVENTS);
  await page.waitForTimeout(350);

  // ── Layout assertions, closed. ──────────────────────────────────────────────
  const m = await page.evaluate(() => {
    const r = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
    const vis = (sel) => { const e = document.querySelector(sel); if (!e) return false;
      const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false;
      const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    return {
      bodyScrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth, innerH: window.innerHeight,
      rail: r('.hc-rail'), railVis: vis('.hc-rail'),
      bottom: r('.hc-bottom'), bottomVis: vis('.hc-bottom'),
      greet: r('.hc-idw'), news: r('.hc-news'),
      acts: r('.hc-acts'), nActs: document.querySelectorAll('.hc-act').length,
      suggs: r('.hc-suggs'), nSuggs: document.querySelectorAll('.hc-sugg').length,
      composer: r('.hc-input-bar'),
      chip: vis('.nav-signin.is-chip'), chipText: (document.querySelector('.hc-chip-nm')||{}).textContent || null,
      railMark: vis('.hc-rail-mark'), railBiz: vis('.hc-rail-biz'),
      promises: [...document.querySelectorAll('[data-promise]')].map(e => e.getAttribute('data-promise'))
    };
  });
  const fail = (why) => failures.push(`${v.id}: ${why}`);
  // IS IT ACTUALLY PAINTED? Every other assertion here reads a rect, and a rect is
  // non-zero on an element at opacity:0. Ask the question a person asks first.
  const painted = await page.evaluate(() => {
    const el = document.getElementById('hcApp'); const s = getComputedStyle(el);
    return { op: Number(s.opacity), disp: s.display, vis: s.visibility };
  });
  if (painted.op < 0.99 || painted.disp === 'none' || painted.vis === 'hidden')
    fail(`the app is not painted (opacity ${painted.op}, display ${painted.disp}, visibility ${painted.vis})`);
  if (m.bodyScrollW > m.innerW + 1) fail(`page scrolls sideways (${m.bodyScrollW} > ${m.innerW})`);
  if (v.w > 900) {
    if (!m.railVis) fail('sidebar missing on a wide viewport');
    else if (Math.round(m.rail.width) < 240) fail(`sidebar is ${Math.round(m.rail.width)}px, not the 260px sidebar`);
    if (!m.railMark) fail('sidebar carries no wordmark');
    if (!m.railBiz) fail('sidebar carries no business block');
    if (m.railVis && Math.round(m.rail.height) < m.innerH - 1) fail(`sidebar is not full height (${Math.round(m.rail.height)} of ${m.innerH})`);
  }
  if (v.w <= 900) {
    if (m.railVis) fail('sidebar rendered on a phone');
    if (!m.bottomVis) fail('no bottom bar on a phone');
    // The greeting and the news must be readable without scrolling.
    if (m.news && m.news.bottom > m.innerH) fail(`news line is below the fold (${Math.round(m.news.bottom)} > ${m.innerH})`);
  }
  if (!m.greet) fail('no greeting block');
  if (m.nActs < 1) fail('no action cards rendered');
  if (m.nSuggs < 1) fail('no suggested questions rendered');
  if (!m.composer) fail('no composer');
  else if (Math.round(m.composer.bottom) > m.innerH + 1) fail('composer is below the viewport');
  if (!m.chip) fail('no account chip');
  // IS THE READ MARKER ACTUALLY REACHED? business_event_reads had 0 rows the day the
  // event stream shipped, and "nobody has looked yet" and "the writer is never called"
  // are indistinguishable from the database. This distinguishes them: render home and
  // assert the client issues the RPC. The function itself was proved separately by
  // calling it and reading the row back.
  if (v.id === 'desktop') {
    const rpcs = await page.evaluate(() => (window.__rpcCalls || []).map(c => c.n));
    if (!rpcs.includes('mark_business_events_seen'))
      fail(`rendering home never called mark_business_events_seen (called: ${rpcs.join(', ') || 'nothing'})`);
  }
  // A NAV ITEM WITHOUT ITS WORD IS A GUESS. Icons alone were the old 72px rail's problem
  // on desktop; the bottom bar must not reproduce it on the device that matters most.
  if (v.w <= 900) {
    const labs = await page.evaluate(() => {
      const bar = document.getElementById('hcBottom'); if (!bar) return null;
      const br = bar.getBoundingClientRect();
      return [...bar.querySelectorAll('.hc-btab')].map(b => {
        const l = b.querySelector('.hc-rail-lbl');
        const r = l ? l.getBoundingClientRect() : null;
        return { t: l ? (l.textContent || '').trim() : null, w: r ? r.width : 0, h: r ? r.height : 0,
                 inside: r ? (r.bottom <= br.bottom + 1 && r.top >= br.top - 1) : false };
      });
    });
    if (!labs || !labs.length) fail('bottom bar has no tabs');
    else for (const l of labs) {
      if (!l.t) fail('a bottom-bar tab has no label');
      else if (l.w < 1 || l.h < 1) fail(`bottom-bar label "${l.t}" has no box`);
      else if (!l.inside) fail(`bottom-bar label "${l.t}" is clipped out of the bar`);
    }
  }
  // THE COUNT MUST NOT WELD ITSELF TO THE LABEL. "View my schedule3 jobs today" passed
  // every measurement on the first run and was the first thing the eye caught.
  const weld = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('.hc-act').forEach(a => {
      const nm = a.querySelector('.hc-act-nm'), ct = a.querySelector('.hc-act-ct');
      if (!nm || !ct) return;
      const n = nm.getBoundingClientRect(), c = ct.getBoundingClientRect();
      if (c.top < n.bottom - 1) bad.push((nm.textContent || '') + '|' + (ct.textContent || ''));
    });
    return bad;
  });
  for (const w of weld) fail(`count sits on the same line as its label: "${w}"`);

  // ── The label, burned in. Not a caption someone can drop when they paste it. ──
  await page.evaluate((label) => {
    const st = document.createElement('style');
    st.textContent = '#hcApp{bottom:26px !important;height:auto !important} .hc-panel{bottom:26px !important}';
    document.head.appendChild(st);
    const b = document.createElement('div');
    b.textContent = 'SIMULATED CLAIMED STATE — not a real owner session. Layout evidence only. ' + label;
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:26px;z-index:99999;background:#7a1020;color:#fff;'
      + 'font:700 11px/26px -apple-system,system-ui,sans-serif;padding:0 10px;letter-spacing:.02em;text-align:center;'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box';
    document.body.appendChild(b);
  }, v.label);

  if (v.w <= 900) {
    const bar = await page.$('#hcBottom');
    if (bar) await bar.screenshot({ path: path.join(OUT, `${v.id}-bottombar.png`) });
  }
  const shotClosed = path.join(OUT, `${v.id}-closed.png`);
  await page.screenshot({ path: shotClosed });
  shots.push(shotClosed);

  // NOTHING IN THE HEADER MAY OVERLAP THE ACCOUNT CHIP. On a phone the wordmark comes
  // back and, under the desktop's flex-end, landed on top of it.
  const clash = await page.evaluate(() => {
    const chip = document.querySelector('.nav-signin'); if (!chip) return null;
    const c = chip.getBoundingClientRect();
    for (const el of document.querySelectorAll('.nav > a, .nav .hubly-lockup')) {
      const r = el.getBoundingClientRect();
      if (r.width && c.x < r.right && c.right > r.x && c.y < r.bottom && c.bottom > r.y)
        return (el.textContent || 'header element').trim();
    }
    return null;
  });
  if (clash) fail(`"${clash}" in the header overlaps the account chip`);

  // ── Open the panel and measure again. It must NARROW, not cover. ────────────
  const widthBefore = await page.evaluate(() => document.querySelector('.hc-app-left').getBoundingClientRect().width);
  await page.evaluate(() => { document.querySelector('.hc-event-acts .hc-arrival-act').click(); });
  await page.waitForTimeout(300);
  const p2 = await page.evaluate(() => {
    const left = document.querySelector('.hc-app-left').getBoundingClientRect();
    const pan = document.querySelector('.hc-panel').getBoundingClientRect();
    const body = document.getElementById('hcPanelBody');
    const rows = [...body.querySelectorAll('.hc-event-row')];
    const last = rows.length ? rows[rows.length - 1].getBoundingClientRect() : null;
    const bb = body.getBoundingClientRect();
    return {
      leftW: left.width, panX: pan.x, panW: pan.width, panBottom: pan.bottom,
      title: document.getElementById('hcPanelTitle').textContent,
      nRows: rows.length,
      lastRowBottom: last ? last.bottom : null,
      bodyBottom: bb.bottom,
      bodyScrollH: body.scrollHeight, bodyClientH: body.clientHeight,
      composerVisible: (() => { const c = document.querySelector('.hc-input-bar').getBoundingClientRect();
        const pr = pan; return !(c.x < pr.right && c.right > pr.x && c.y < pr.bottom && c.bottom > pr.y); })(),
      overlapsCard: (() => {
        const card = document.querySelector('.hc-event-card'); if (!card) return false;
        const c = card.getBoundingClientRect(); const pr = pan;
        return c.x < pr.right && c.right > pr.x && c.y < pr.bottom && c.bottom > pr.y;
      })()
    };
  });
  if (p2.title !== 'Booking') fail(`panel title is "${p2.title}", expected the kind-derived "Booking"`);
  if (v.w > 900) {
    if (p2.leftW >= widthBefore) fail('opening the panel did not narrow the stream');
    if (p2.overlapsCard) fail('panel overlaps the card it came from');
    if (!p2.composerVisible) fail('panel covers the composer');
  }
  // THE CLIPPED-CONTENT DEFECT THE MODAL HAD. Scroll the panel to its end, then require
  // the LAST thing in it — usually the Call button — to be fully inside the visible box.
  // "It scrolls" is not the same as "it can be reached".
  if (p2.nRows < 1) fail('panel rendered no rows');
  const tail = await page.evaluate(async () => {
    const body = document.getElementById('hcPanelBody');
    body.scrollTop = body.scrollHeight;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const last = body.lastElementChild; if (!last) return null;
    const l = last.getBoundingClientRect();
    // AGAINST THE PANEL, NOT THE BODY. The first version of this check compared the last
    // element to the SCROLLER's rect and passed while the button was visibly cut in half:
    // when the body overflows and the PANEL clips it, the element is inside the body and
    // outside the panel. The clipping box is the one that has overflow:hidden.
    const b = document.getElementById('hcPanel').getBoundingClientRect();
    return { text: (last.textContent || '').trim().slice(0, 40), lb: l.bottom, bb: b.bottom, lt: l.top, bt: b.top };
  });
  if (v.w <= 900) console.log(`  [panel] last="${tail && tail.text}" lastBottom=${tail && Math.round(tail.lb)} panelBottom=${tail && Math.round(tail.bb)} panelTop=${tail && Math.round(tail.bt)}`);
  if (tail && (tail.lb > tail.bb + 1 || tail.lt < tail.bt - 1))
    fail(`panel clips its last element even scrolled to the end: "${tail.text}"`);
  const panelClash = await page.evaluate(() => {
    const chip = document.querySelector('.nav-signin'); const hd = document.querySelector('.hc-panel-hd');
    if (!chip || !hd) return { over: false, back: false };
    const c = chip.getBoundingClientRect(), h = hd.getBoundingClientRect();
    const back = document.getElementById('hcPanelBack');
    const bs = back ? getComputedStyle(back) : null;
    return {
      over: c.x < h.right && c.right > h.x && c.y < h.bottom && c.bottom > h.y,
      back: !!(back && back.hidden && bs && bs.display !== 'none')
    };
  });
  if (panelClash.over) fail('the account chip sits on top of the panel header');
  if (panelClash.back) fail('the back arrow is painted at the first level of the stack');
  if (p2.lastRowBottom !== null && p2.bodyScrollH <= p2.bodyClientH && p2.lastRowBottom > p2.bodyBottom + 1)
    fail('panel clips its last row with nothing to scroll');

  await page.evaluate((label) => {
    const st = document.createElement('style');
    st.textContent = '#hcApp{bottom:26px !important;height:auto !important} .hc-panel{bottom:26px !important}';
    document.head.appendChild(st);
    const b = document.createElement('div');
    b.textContent = 'SIMULATED CLAIMED STATE — not a real owner session. Layout evidence only. ' + label;
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:26px;z-index:99999;background:#7a1020;color:#fff;'
      + 'font:700 11px/26px -apple-system,system-ui,sans-serif;padding:0 10px;letter-spacing:.02em;text-align:center;'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box';
    document.body.appendChild(b);
  }, v.label);
  const shotOpen = path.join(OUT, `${v.id}-panel.png`);
  await page.screenshot({ path: shotOpen });
  shots.push(shotOpen);

  console.log(`${v.id.padEnd(17)} rail=${m.railVis ? Math.round(m.rail.width)+'px' : '—'} bottom=${m.bottomVis ? 'yes' : '—'} cards=${m.nActs} chips=${m.nSuggs} panel="${p2.title}" ${Math.round(p2.panW)}px`);
  if (v.w >= 900) console.log(`  promises rendered: ${m.promises.join(', ')}`);
  // ── CLICK EVERY PROMISE and record what it actually does. ──────────────────
  // Not "does the handler exist" — press it and read back which of the two things it
  // did: switched the centre to a workspace, or put a specific sentence in the composer
  // and sent it. What the SERVER then answers is not knowable here (see the note at the
  // foot of this file) and is reported separately.
  if (v.id === 'desktop') {
    await page.evaluate(() => { document.getElementById('hcPanelX').click(); });
    const rows = await page.evaluate(async () => {
      const H = window.__hcHarness;
      const out = [];
      const ids = [...document.querySelectorAll('[data-promise]')].map(e => e.getAttribute('data-promise'));
      for (const id of ids) {
        let sent = null, mode = null;
        window.hcSendSpy = null;
        // Record instead of send: the conversation endpoint needs a real owner JWT.
        const el = document.querySelector(`[data-promise="${id}"]`);
        const inp = document.getElementById('hcInput');
        const before = H.hc.mode;
        // Intercept by reading the input immediately after the click — hcSend clears it,
        // so capture on the next microtask before any async work completes.
        const orig = inp.value;
        el.click();
        await new Promise(r => setTimeout(r, 30));
        mode = H.hc.mode;
        sent = window.__lastAsk || null;
        out.push({ id, label: (el.textContent || '').trim(), modeBefore: before, modeAfter: mode, sent });
        window.__lastAsk = null;
        if (mode !== 'home') { H.hc.mode = 'home'; }
      }
      return out;
    });
    // NO TWO PROMISES MAY SEND THE SAME SENTENCE. A card and a chip that ask the
    // identical thing are one promise wearing two hats, and it happened three times
    // while assembling this registry by hand — each caught by reading the output, which
    // is exactly the kind of thing that stops being read.
    const sent = rows.map(r => r.sent).filter(Boolean);
    const dupes = sent.filter((x, i) => sent.indexOf(x) !== i);
    for (const d of [...new Set(dupes)]) failures.push(`two promises send the same message: "${d}"`);
    console.log('\n  ── the eight promises, clicked ──');
    for (const r of rows) {
      console.log(`  ${r.id.padEnd(10)} ${r.modeAfter !== r.modeBefore ? 'opens workspace "' + r.modeAfter + '"' : 'asks: "' + (r.sent || '(nothing captured)') + '"'}`);
    }
  }
  await ctx.close();
}
await browser.close();
server.close();

console.log(`\n${shots.length} shots -> docs/shots/owner-home/`);
if (failures.length) {
  console.error('\nFAIL — layout:');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('PASS — layout assertions held at all four widths, panel closed and open.');
console.log('NOT PROVED HERE: anything that needs a real owner session (counts, the real logo,');
console.log('what the eight promises actually do). That needs Adrian signed in on the real thing.');
process.exit(0);
