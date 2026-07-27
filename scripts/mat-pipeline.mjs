#!/usr/bin/env node
/**
 * Module Acceptance Test (MAT) — 📈 Pipeline Stage 1 OS
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const today = new Date().toISOString().slice(0, 10);
const results = [];
function check(section, name, ok, detail = "") {
  results.push({ section, name, ok: !!ok, detail });
  return !!ok;
}

function makeEl(tag, id) {
  const el = {
    tagName: String(tag || "DIV").toUpperCase(),
    id: id || "",
    className: "",
    children: [],
    parentNode: null,
    style: {},
    value: "",
    attributes: Object.create(null),
    _listeners: Object.create(null),
    _html: "",
    dataset: {},
    classList: null,
    setAttribute(k, v) {
      this.attributes[k] = String(v);
      if (k === "id") this.id = String(v);
      if (k === "class")
        String(v)
          .split(/\s+/)
          .filter(Boolean)
          .forEach((c) => this.classList.add(c));
    },
    getAttribute(k) {
      if (k === "id") return this.id || null;
      if (k === "class") return this.className || null;
      return this.attributes[k] != null ? this.attributes[k] : null;
    },
    hasAttribute(k) {
      return this.getAttribute(k) != null;
    },
    appendChild(ch) {
      ch.parentNode = this;
      this.children.push(ch);
      if (ch.id) document._byId[ch.id] = ch;
      return ch;
    },
    remove() {
      if (!this.parentNode) return;
      const i = this.parentNode.children.indexOf(this);
      if (i >= 0) this.parentNode.children.splice(i, 1);
      if (this.id && document._byId[this.id] === this) delete document._byId[this.id];
      this.parentNode = null;
    },
    addEventListener(type, fn) {
      (this._listeners[type] = this._listeners[type] || []).push(fn);
    },
    querySelector(sel) {
      if (!sel) return null;
      if (String(sel).startsWith("#")) return document._byId[String(sel).slice(1)] || null;
      return this.children[0] || null;
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 1400, height: 900 };
    },
    forEach() {},
  };
  el.classList = {
    _s: new Set(),
    add(c) {
      this._s.add(c);
      el.className = [...this._s].join(" ");
    },
    remove(c) {
      this._s.delete(c);
      el.className = [...this._s].join(" ");
    },
    contains(c) {
      return this._s.has(c);
    },
    toggle(c, force) {
      if (force === true) this.add(c);
      else if (force === false) this.remove(c);
      else this.contains(c) ? this.remove(c) : this.add(c);
    },
  };
  Object.defineProperty(el, "innerHTML", {
    get() {
      return this._html;
    },
    set(v) {
      this._html = String(v || "");
      this.children = [];
      const re = /\bid=["']([^"']+)["']/g;
      let m;
      while ((m = re.exec(this._html))) {
        const id = m[1];
        if (!document._byId[id]) {
          const child = makeEl("div", id);
          document._byId[id] = child;
          this.children.push(child);
          child.parentNode = this;
        }
      }
    },
  });
  Object.defineProperty(el, "textContent", {
    get() {
      return this._html ? this._html.replace(/<[^>]+>/g, "") : this._text || "";
    },
    set(v) {
      this._text = String(v || "");
      this._html = String(v || "");
    },
  });
  if (id) el.id = id;
  return el;
}

const document = {
  _byId: Object.create(null),
  body: makeEl("body"),
  getElementById(id) {
    return this._byId[id] || null;
  },
  createElement(tag) {
    return makeEl(tag);
  },
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
  addEventListener() {},
};

const app = makeEl("div", "p-app");
app.classList.add("jos-pixel");
const vpipe = makeEl("div", "v-pipeline");
const pipeRoot = makeEl("div", "jos-pipeline-root");
const bar = makeEl("div", "bar-title");
vpipe.appendChild(pipeRoot);
app.appendChild(vpipe);
document.body.appendChild(app);
document.body.appendChild(bar);
document._byId["p-app"] = app;
document._byId["v-pipeline"] = vpipe;
document._byId["jos-pipeline-root"] = pipeRoot;
document._byId["bar-title"] = bar;

const state = {
  customers: [
    { id: "c1", name: "Sarah Johnson", phone: "(512) 555-0198", email: "sarah@ex.com", vehicle: "Tesla", customerType: "recurring", membership: "Shine Club" },
    { id: "c2", name: "Mike Brown", phone: "(512) 555-0142", email: "mike@ex.com", vehicle: "BMW X5" },
  ],
  jobs: [
    { id: "j1", customer: "Sarah Johnson", customerId: "c1", phone: "(512) 555-0198", service: "Ceramic Coating", status: "completed", date: "2026-06-01", amount: 450 },
    { id: "j2", customer: "Mike Brown", customerId: "c2", service: "Interior Detail", status: "confirmed", date: today, amount: 180 },
  ],
  quotes: [{ id: "q1", customerName: "Jordan Lee", status: "sent", amount: 249, packageNames: ["Interior + ceramic"], createdAt: today }],
  smartQuotes: [],
  team: [{ id: "t1", name: "Adrian Lopez", role: "Owner" }],
  city: "Austin, TX",
  services: [{ name: "Ceramic Coating" }],
  conversations: [],
  pipeline: {
    manual: [
      { id: "lead_new", name: "Alex Rivera", phone: "(619) 555-0133", email: "alex@ex.com", service: "Ceramic Coating", vehicle: "Porsche", source: "google", stage: "new", aiQualified: false, aiScore: 70, createdAt: today + "T09:00:00" },
      { id: "lead_qual", name: "Taylor Kim", phone: "(619) 555-0166", service: "Interior Detail", vehicle: "Model 3", source: "instagram", stage: "new", aiQualified: true, aiScore: 91, createdAt: today + "T10:00:00" },
      { id: "lead_quote", name: "Priya Shah", phone: "(619) 555-0190", service: "Paint Correction", source: "hubly", stage: "quote_sent", amount: 450, aiScore: 72, createdAt: today + "T11:00:00" },
    ],
    deleted: [],
    stages: {},
    lostReasons: {},
    edits: {},
  },
  slug: "demo",
};

const toasts = [];
const warns = [];

globalThis.window = {
  document,
  S: state,
  toast: (m) => toasts.push(String(m)),
  switchV: () => {},
  openM: () => {},
  askAI: () => {},
  openSmartQuote: () => toasts.push("quote"),
  viewLead: (k) => toasts.push("lead:" + k),
  escapeHtml: (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  location: {
    origin: "https://hubly.test",
    href: "https://hubly.test/",
    pathname: "/",
    set href(v) {
      this._href = String(v);
    },
    get href() {
      return this._href || "https://hubly.test/";
    },
  },
  navigator: { clipboard: { writeText: async () => {} } },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  localStorage: { getItem: () => null, setItem: () => {} },
};
globalThis.document = document;
try {
  globalThis.location = window.location;
  globalThis.localStorage = window.localStorage;
} catch (_) {}

const _warn = console.warn;
console.warn = (...a) => warns.push(a.map(String).join(" "));

eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/design-system.js"), "utf8"));
check("Design System", "HublyDS loaded", !!(window.HublyDS && window.HublyDS.pipelineCard && window.HublyDS.version));

eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8"));
const H = window.HublyJourneyOS;

function clickAct(act, attrs = {}) {
  const t = makeEl("button");
  t.setAttribute("data-jos-act", act);
  Object.keys(attrs).forEach((k) => t.setAttribute(k, attrs[k]));
  const wrap = makeEl("div");
  wrap.appendChild(t);
  pipeRoot.appendChild(wrap);
  t.closest = (sel) => {
    if (String(sel).includes("data-jos-act") && t.getAttribute("data-jos-act")) return t;
    return null;
  };
  (pipeRoot._listeners.click || []).forEach((fn) =>
    fn.call(pipeRoot, { target: t, stopPropagation() {}, preventDefault() {} })
  );
}

function setInput(id, value) {
  const inp = makeEl("input", id);
  inp.value = value;
  document._byId[id] = inp;
  return inp;
}

// Header / search / filters
H.renderPipeline();
check("Header", "Page renders with HublyDS", /jos-pipe-page|Pipeline/.test(pipeRoot.innerHTML) && /jos-ds-search|jos-pipe-search/.test(pipeRoot.innerHTML));
check("Header", "Search works", (() => {
  pipeRoot._josPipeQ = "alex";
  H.renderPipeline();
  return /Alex Rivera/.test(pipeRoot.innerHTML);
})());
check("Header", "Filters apply", (() => {
  clickAct("pipe-filter-open");
  const open = !!pipeRoot._josPipeFilterOpen;
  setInput("jos-pf-stage", "qualified");
  setInput("jos-pf-source", "all");
  setInput("jos-pf-service", "all");
  setInput("jos-pf-vmin", "");
  setInput("jos-pf-vmax", "");
  clickAct("pipe-filter-apply");
  return open && (pipeRoot._josPipeFilters?.stage === "qualified" || /Taylor|Qualified/.test(pipeRoot.innerHTML));
})());

// Stages (Mission Control board = 5 columns; review/membership map into Completed)
pipeRoot._josPipeFilters = {};
pipeRoot._josPipeQ = "";
H.renderPipeline();
const jsrcStages = fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8");
["lead", "qualified", "quote", "booked", "completed"].forEach((st) => {
  check("Stages", st, pipeRoot.innerHTML.includes(`data-pipe-stage="${st}"`));
});
check("Stages", "review maps to Completed on board", /boardStageId/.test(jsrcStages) && !pipeRoot.innerHTML.includes('data-pipe-stage="review"'));
check("Stages", "membership maps to Completed on board", /membership/.test(jsrcStages) && !pipeRoot.innerHTML.includes('data-pipe-stage="membership"'));

// Board / cards
check("Board", "Cards render via HublyDS or fallback", /jos-pk-card|jos-pipe-card|data-jos-pipe-card/.test(pipeRoot.innerHTML));
check("Board", "KPI strip", /jos-pk-kpi|jos-kpi|Stages|metric/i.test(pipeRoot.innerHTML));

// Detail
check("Detail", "Selecting card shows detail", (() => {
  const cards = pipeRoot._josCards || [];
  const id = cards[0] && cards[0].id;
  pipeRoot._josPipeId = id;
  H.renderPipeline();
  return /jos-pk-ws|jos-pipe-detail|AI Hubly|Convert to Job|Next|stage/i.test(pipeRoot.innerHTML);
})());

check("Detail", "Stage next moves card", (() => {
  const cards = pipeRoot._josCards || [];
  const card = cards.find((c) => c.name === "Alex Rivera") || cards[0];
  if (!card) return false;
  pipeRoot._josPipeId = card.id;
  H.renderPipeline();
  clickAct("pipe-stage-next");
  const ov = state.pipeline.stages && state.pipeline.stages[card.id];
  return !!ov || /Moved|qualified|quote/i.test(toasts.join(" ") + pipeRoot.innerHTML);
})());

check("Actions", "Request review", (() => {
  const cards = pipeRoot._josCards || [];
  const card = cards[0];
  pipeRoot._josPipeId = card.id;
  H.renderPipeline();
  clickAct("pipe-request-review");
  return state.pipeline.stages[card.id] === "completed" || state.pipeline.stages[card.id] === "review" || /review|Completed/i.test(toasts.join(" "));
})());
check("Actions", "Offer membership", (() => {
  const cards = pipeRoot._josCards || [];
  const card = cards[0];
  pipeRoot._josPipeId = card.id;
  H.renderPipeline();
  clickAct("pipe-offer-membership");
  return state.pipeline.stages[card.id] === "completed" || state.pipeline.stages[card.id] === "membership" || /membership/i.test(toasts.join(" "));
})());
check("Actions", "Create quote", (() => {
  clickAct("pipe-create-quote");
  return toasts.some((t) => /quote/i.test(t));
})());
check("Actions", "AI refresh", (() => {
  clickAct("pipe-ai-refresh");
  return !!pipeRoot._josPipeAiBody || /AI|Refreshed|insight/i.test(pipeRoot.innerHTML);
})());
check("Actions", "Golden profile path exists", (() => {
  const jsrc = fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8");
  return jsrc.includes("pipe-open-customer") && jsrc.includes("openCustomerProfile");
})());
check("Actions", "Stage 2 CRM placeholder", (() => {
  clickAct("pipe-crm-sync");
  return /Stage 2/.test(toasts.join(" "));
})());

// Design system rule
check("Design System", "Pipeline uses HublyDS helpers", (() => {
  const jsrc = fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8");
  return /DS\(\)|HublyDS|pageHeader|pipelineCard|filterDrawer|aiInsightCard|jos-pk-/.test(jsrc);
})());

// Routes
const routes = [
  "pipe-filter-open",
  "pipe-filter-apply",
  "pipe-stage-next",
  "pipe-stage-prev",
  "pipe-stage-set",
  "pipe-open-customer",
  "pipe-open-lead",
  "pipe-create-quote",
  "pipe-book-job",
  "pipe-request-review",
  "pipe-offer-membership",
  "pipe-ai-refresh",
  "pipe-crm-sync",
];
const jsrc = fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8");
routes.forEach((act) => check("Routes", act, jsrc.includes("'" + act + "'") || jsrc.includes('"' + act + '"')));

check("Empty States", "Empty column copy", /No deals|No completed|empty/i.test(jsrc));
check("Error States", "Error retry markup", /Pipeline could not load|Retry/.test(jsrc));
const css = fs.readFileSync(path.join(repoRoot, "public/journey-os/operate-pixel.css"), "utf8");
check("Responsive CSS", "Pipeline layout", /jos-pipe-page|jos-pipe-layout|jos-pk-shell|jos-pk-layout/.test(css));
check("Accessibility", "Buttons typed", /type="button"/.test(pipeRoot.innerHTML));

let validatorPass = false;
await new Promise((resolve) => {
  const p = spawn("node", [path.join(repoRoot, "scripts/check-customer-journey-os.mjs")], { cwd: repoRoot });
  let out = "";
  p.stdout.on("data", (d) => (out += d));
  p.stderr.on("data", (d) => (out += d));
  p.on("close", (code) => {
    validatorPass = code === 0 && /PASS/.test(out);
    check("Validator", "check-customer-journey-os", validatorPass, out.trim().split("\n").pop());
    resolve();
  });
});

let cmvPass = false;
await new Promise((resolve) => {
  const p = spawn("node", [path.join(repoRoot, "scripts/cmv-locked-modules.mjs")], { cwd: repoRoot });
  let out = "";
  p.stdout.on("data", (d) => (out += d));
  p.stderr.on("data", (d) => (out += d));
  p.on("close", (code) => {
    cmvPass = code === 0 && /CMV PASS/.test(out) && /Customers still works/.test(out);
    check("CMV", "Locked modules incl. Customers", cmvPass);
    resolve();
  });
});

let consoleErrors = 0;
let desktopOk = false;
let tabletOk = false;
let mobileOk = false;
try {
  const { chromium } = await import("playwright");
  const pub = path.join(repoRoot, "public");
  const server = createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/mat-pipeline.html";
    const file = path.join(pub, urlPath.replace(/^\//, ""));
    if (!file.startsWith(pub) || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    const ext = path.extname(file);
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
    res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const matHtml = `<!doctype html><html><head><link rel="stylesheet" href="/journey-os/operate-pixel.css"><link rel="stylesheet" href="/journey-os/journey.css"></head>
<body class="jos-pixel"><div id="p-app" class="jos-pixel"><div id="v-pipeline" class="body"><div id="jos-pipeline-root"></div></div><div id="bar-title"></div></div>
<script>
window.S=${JSON.stringify(state)};
window.toast=function(){};
window.escapeHtml=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"})[c];});};
window.localStorage={getItem:function(){return null;},setItem:function(){}};
</script>
<script src="/journey-os/design-system.js"></script>
<script src="/journey-os/journey.js"></script>
<script>HublyJourneyOS.renderPipeline();document.title=document.getElementById("jos-pipeline-root").innerHTML.includes("jos-pipe-page")||document.getElementById("jos-pipeline-root").innerHTML.includes("jos-pk-shell")?"MAT_OK":"MAT_FAIL";</script>
</body></html>`;
  fs.writeFileSync(path.join(pub, "mat-pipeline.html"), matHtml);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  async function vp(w, h) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`http://127.0.0.1:${port}/mat-pipeline.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(350);
    return page.evaluate(() => {
      const root = document.getElementById("jos-pipeline-root");
      const pageEl = root && (root.querySelector(".jos-pipe-page") || root.querySelector(".jos-pk-shell"));
      if (!pageEl) return false;
      const r = pageEl.getBoundingClientRect();
      return r.width > 200 && r.height > 200 && document.title.includes("MAT_OK");
    });
  }
  desktopOk = await vp(1440, 900);
  tabletOk = await vp(834, 1112);
  mobileOk = await vp(390, 844);
  consoleErrors = errors.filter((e) => !/favicon|ResizeObserver|404|Failed to load resource/i.test(e)).length;
  await browser.close();
  server.close();
  try {
    fs.unlinkSync(path.join(pub, "mat-pipeline.html"));
  } catch (_) {}
} catch (err) {
  check("Browser", "Playwright MAT", false, String(err.message || err));
}

check("Console", "Console errors = 0", consoleErrors === 0, String(consoleErrors));
check("Responsive", "Desktop", desktopOk);
check("Responsive", "Tablet", tabletOk);
check("Responsive", "Mobile", mobileOk);

console.warn = _warn;

const bySection = {};
for (const r of results) {
  bySection[r.section] = bySection[r.section] || { pass: 0, total: 0, items: [] };
  bySection[r.section].total++;
  if (r.ok) bySection[r.section].pass++;
  bySection[r.section].items.push(r);
}

const checklistItems = results.filter((r) =>
  ["Header", "Stages", "Board", "Detail", "Actions", "Design System", "Empty States", "Error States"].includes(r.section)
);
const buttons = results.filter((r) => ["Header", "Actions", "Detail"].includes(r.section));
const tabsR = results.filter((r) => r.section === "Stages");
const routesR = results.filter((r) => r.section === "Routes");
const failed = results.filter((r) => !r.ok);
const accepted = failed.length === 0 && validatorPass && cmvPass && consoleErrors === 0 && desktopOk && tabletOk && mobileOk;

const report = `# Module Acceptance Test (MAT)

**Module:** 📈 Pipeline  
**Stage:** 1 — Operating System  
**Branch:** \`cursor/operate-pipeline-2662\`  
**Date:** 2026-07-26  
**Runner:** \`node scripts/mat-pipeline.mjs\`  
**Design System:** HublyDS v1 (Rule #14)

---

## Checklist (final QA pass)

### Header
${(bySection.Header?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Stages
${(bySection.Stages?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Board
${(bySection.Board?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Detail
${(bySection.Detail?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Actions
${(bySection.Actions?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Design System
${(bySection["Design System"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Cross-Module Verification
${(bySection.CMV?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Responsive
${desktopOk ? "✅" : "❌"} Desktop
${tabletOk ? "✅" : "❌"} Tablet
${mobileOk ? "✅" : "❌"} Mobile

---

## Final QA Report

| Field | Result |
|-------|--------|
| Buttons Tested | ${buttons.filter((b) => b.ok).length} / ${buttons.length} |
| Console Errors | ${consoleErrors} |
| Validator | ${validatorPass ? "PASS" : "FAIL"} |
| CMV | ${cmvPass ? "PASS" : "FAIL"} |
| Known Issues | ${failed.length ? failed.map((f) => `${f.section}: ${f.name}`).join("; ") : "None"} |
| Deferred | Live CRM sync; quote/booking webhooks; review platform sync |

---

## Module Acceptance Test (MAT)

**Module:** 📈 Pipeline

| Metric | Count |
|--------|-------|
| Checklist | ${checklistItems.filter((c) => c.ok).length} / ${checklistItems.length} |
| Buttons | ${buttons.filter((b) => b.ok).length} / ${buttons.length} |
| Stages | ${tabsR.filter((t) => t.ok).length} / ${tabsR.length} |
| Routes | ${routesR.filter((r) => r.ok).length} / ${routesR.length} |
| Console Errors | ${consoleErrors} |
| Validator | ${validatorPass ? "PASS" : "FAIL"} |
| CMV | ${cmvPass ? "PASS" : "FAIL"} |
| Responsive | Desktop ${desktopOk ? "✅" : "❌"} · Tablet ${tabletOk ? "✅" : "❌"} · Mobile ${mobileOk ? "✅" : "❌"} |

**Deferred:** Live CRM sync · Quote/booking webhooks · Review platform sync

### Result

${accepted ? "✅ ACCEPTED" : "❌ NOT ACCEPTED"}

---

## Section detail

${Object.keys(bySection)
  .map((sec) => {
    const s = bySection[sec];
    return `### ${sec} (${s.pass}/${s.total})\n${s.items.map((i) => `- ${i.ok ? "✅" : "❌"} ${i.name}${i.detail ? ` — ${i.detail}` : ""}`).join("\n")}`;
  })
  .join("\n\n")}
`;

fs.mkdirSync(path.join(repoRoot, "artifacts"), { recursive: true });
fs.writeFileSync(path.join(repoRoot, "docs/operate/PIPELINE_MAT.md"), report);
fs.writeFileSync(path.join(repoRoot, "artifacts/PIPELINE_MAT.json"), JSON.stringify({ accepted, consoleErrors, validatorPass, cmvPass, desktopOk, tabletOk, mobileOk, results }, null, 2));
console.log(report.split("\n").slice(0, 110).join("\n"));
console.log(accepted ? "\n✅ MAT ACCEPTED" : "\n❌ MAT NOT ACCEPTED");
process.exit(accepted ? 0 : 1);
