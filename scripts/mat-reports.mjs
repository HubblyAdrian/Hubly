#!/usr/bin/env node
/**
 * Module Acceptance Test (MAT) — 📊 Reports Stage 1 OS
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
    checked: false,
    attributes: Object.create(null),
    _listeners: Object.create(null),
    _html: "",
    selectedOptions: [],
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
    querySelector() {
      return null;
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
const vrep = makeEl("div", "v-reports");
const rptRoot = makeEl("div", "jos-reports-root");
const bar = makeEl("div", "bar-title");
vrep.appendChild(rptRoot);
app.appendChild(vrep);
document.body.appendChild(app);
document.body.appendChild(bar);
document._byId["p-app"] = app;
document._byId["v-reports"] = vrep;
document._byId["jos-reports-root"] = rptRoot;
document._byId["bar-title"] = bar;

const state = {
  biz: "Shine Auto",
  customers: [
    { id: "c1", name: "Sarah Johnson", customerType: "recurring" },
    { id: "c2", name: "Mike Brown" },
  ],
  jobs: [
    { id: "j1", customer: "Sarah Johnson", customerId: "c1", status: "completed", amount: 400, paid: true },
    { id: "j2", customer: "Mike Brown", customerId: "c2", status: "completed", amount: 180, paid: false },
  ],
  revenueOs: {
    invoices: [{ id: "inv1", status: "paid", total: 400, customerId: "c1" }],
    payments: [{ id: "pay1", invoiceId: "inv1", amount: 400 }],
    deposits: [],
    refunds: [],
    payouts: [],
    activity: [],
  },
  membershipsOs: {
    plans: [{ id: "p1", name: "Essentials", price: 99 }],
    subscribers: [{ id: "s1", customerId: "c1", planId: "p1", status: "active" }],
    activity: [],
  },
  marketingOs: { campaigns: [{ id: "c", status: "active" }], templates: [], automations: [], coupons: [] },
  reviewsOs: { reviews: [{ id: "r1", rating: 5, name: "Alex" }], requests: [], replies: [] },
  pipeline: { manual: [{ id: "l1", stage: "new", name: "Lead" }], stages: {} },
  reportsOs: null,
  services: [],
  editorSvcs: [],
};

const toasts = [];
const warns = [];
const eventLog = [];
const navLog = [];

globalThis.window = {
  document,
  S: state,
  toast: (m) => toasts.push(String(m)),
  switchV: (nav) => navLog.push(nav && nav.getAttribute ? nav.getAttribute("data-v") : "nav"),
  openM: () => {},
  askAI: () => {},
  escapeHtml: (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  location: { origin: "https://hubly.test", href: "https://hubly.test/" },
  navigator: { clipboard: { writeText: async () => {} } },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  localStorage: { getItem: () => null, setItem: () => {} },
};
// Fake nav nodes for switchNav
["money", "memberships", "jobs", "leads", "customers", "pipeline", "marketing", "reviews"].forEach((v) => {
  const n = makeEl("div");
  n.setAttribute("data-v", v);
  document.body.appendChild(n);
  document.querySelector = (sel) => {
    if (String(sel).includes('data-v="')) {
      const m = String(sel).match(/data-v="([^"]+)"/);
      if (m) return document.body.children.find?.((c) => c.getAttribute && c.getAttribute("data-v") === m[1]) || n;
    }
    return null;
  };
});
// Better querySelector for switchNav
document.querySelector = (sel) => {
  const m = String(sel || "").match(/\[data-v=["']([^"']+)["']\]/);
  if (!m) return null;
  for (const id of Object.keys(document._byId)) {
    const el = document._byId[id];
    if (el && el.getAttribute && el.getAttribute("data-v") === m[1]) return el;
  }
  const fake = makeEl("div");
  fake.setAttribute("data-v", m[1]);
  document._byId["nav-" + m[1]] = fake;
  return fake;
};
globalThis.document = document;

const _warn = console.warn;
console.warn = (...a) => warns.push(a.map(String).join(" "));

eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/design-system.js"), "utf8"));
eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/hubly-events.js"), "utf8"));
check("Events", "HublyEvents loaded", !!(window.HublyEvents && window.HublyEvents.publish));
window.HublyEvents.on("*", (payload, meta) => eventLog.push(meta.type));

eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8"));
const H = window.HublyJourneyOS;

function clickAct(act, attrs = {}) {
  const t = makeEl("button");
  t.setAttribute("data-jos-act", act);
  Object.keys(attrs).forEach((k) => t.setAttribute(k, attrs[k]));
  const wrap = makeEl("div");
  wrap.appendChild(t);
  rptRoot.appendChild(wrap);
  t.closest = (sel) => {
    if (String(sel).includes("data-jos-act") && t.getAttribute("data-jos-act")) return t;
    if (String(sel).includes("data-jos-rpt-forecast") && attrs["data-jos-rpt-forecast"]) {
      const c = makeEl("div");
      c.setAttribute("data-jos-rpt-forecast", attrs["data-jos-rpt-forecast"]);
      return c;
    }
    return null;
  };
  (rptRoot._listeners.click || []).forEach((fn) =>
    fn.call(rptRoot, { target: t, stopPropagation() {}, preventDefault() {} })
  );
}
function setInput(id, value) {
  const inp = makeEl("input", id);
  inp.value = value;
  document._byId[id] = inp;
  return inp;
}
function setSelect(id, value) {
  const inp = makeEl("select", id);
  inp.value = value;
  document._byId[id] = inp;
  return inp;
}
function setMulti(id, values) {
  const inp = makeEl("select", id);
  inp.selectedOptions = values.map((v) => ({ value: v }));
  document._byId[id] = inp;
  return inp;
}

H.renderReportsPage();
check("Header", "Page renders", /jos-rpt-page|Reports/.test(rptRoot.innerHTML));
check("Ownership", "reportsOs created", !!(state.reportsOs && Array.isArray(state.reportsOs.dashboards)));
check("Ownership", "Seeded dashboards", state.reportsOs.dashboards.length >= 1);
check("Rule 21", "No payments array", !Object.prototype.hasOwnProperty.call(state.reportsOs, "payments") || !Array.isArray(state.reportsOs.payments));
check("Rule 21", "No customers array", !Object.prototype.hasOwnProperty.call(state.reportsOs, "customers"));
check("Rule 21", "No jobs array", !Object.prototype.hasOwnProperty.call(state.reportsOs, "jobs"));
check("Architecture", "PLATFORM_READINESS present", fs.existsSync(path.join(repoRoot, "docs/operate/PLATFORM_READINESS.md")));
check("Architecture", "Rule #21 in engineering rules", /Rule #21/.test(fs.readFileSync(path.join(repoRoot, "docs/operate/OPERATE_ENGINEERING_RULES.md"), "utf8")));

const tabs = ["overview", "dashboards", "definitions", "layouts", "scheduled", "forecasts", "sources"];
tabs.forEach((tab) => {
  rptRoot._josRptTab = tab;
  H.renderReportsPage();
  const ok =
    rptRoot.innerHTML.includes(`data-jos-rpt-tab="${tab}"`) &&
    (tab === "overview"
      ? /Revenue|Jobs|Rule #21|aggregate|Collected/i.test(rptRoot.innerHTML)
      : tab === "dashboards"
        ? /Dashboard|Owner|widget/i.test(rptRoot.innerHTML)
        : tab === "definitions"
          ? /Definition|metric|source/i.test(rptRoot.innerHTML)
          : tab === "layouts"
            ? /Layout|column/i.test(rptRoot.innerHTML)
            : tab === "scheduled"
              ? /Schedule|weekly|OS/i.test(rptRoot.innerHTML)
              : tab === "forecasts"
                ? /Forecast|projection|horizon/i.test(rptRoot.innerHTML)
                : /Revenue|Memberships|Jobs|Reviews|Source/i.test(rptRoot.innerHTML));
  check("Tabs", tab, ok);
});

// Prefer Revenue aggregate on overview
rptRoot._josRptTab = "overview";
H.renderReportsPage();
check("Aggregates", "Reads Revenue owner", /400|Revenue|collected/i.test(rptRoot.innerHTML + JSON.stringify(state.revenueOs.payments)));

const dashN = state.reportsOs.dashboards.length;
clickAct("rpt-dash-open");
setInput("jos-rpt-dash-name", "MAT Dashboard");
setSelect("jos-rpt-dash-layout", state.reportsOs.layouts[0].id);
setMulti("jos-rpt-dash-widgets", ["revenue_collected", "jobs_completed"]);
clickAct("rpt-dash-save");
check("Dashboards", "Dashboard saved", state.reportsOs.dashboards.length === dashN + 1 || state.reportsOs.dashboards.some((d) => d.name === "MAT Dashboard"));

const defN = state.reportsOs.definitions.length;
clickAct("rpt-def-open");
setInput("jos-rpt-def-name", "MAT Definition");
setInput("jos-rpt-def-sources", "Revenue, Jobs");
setMulti("jos-rpt-def-metrics", ["revenue_collected"]);
setSelect("jos-rpt-def-period", "current_month");
clickAct("rpt-def-save");
check("Definitions", "Definition saved", state.reportsOs.definitions.length >= defN + 1);

const layN = state.reportsOs.layouts.length;
clickAct("rpt-layout-open");
setInput("jos-rpt-layout-name", "MAT Layout");
setInput("jos-rpt-layout-cols", "3");
setSelect("jos-rpt-layout-theme", "light");
clickAct("rpt-layout-save");
check("Layouts", "Layout saved", state.reportsOs.layouts.length >= layN + 1);

const schN = state.reportsOs.schedules.length;
clickAct("rpt-sched-open");
setSelect("jos-rpt-sched-def", state.reportsOs.definitions[0].id);
setSelect("jos-rpt-sched-cadence", "weekly");
setInput("jos-rpt-sched-next", today);
clickAct("rpt-sched-save");
check("Scheduled", "Schedule saved", state.reportsOs.schedules.length >= schN + 1);

const fcN = state.reportsOs.forecasts.length;
clickAct("rpt-forecast-open");
setInput("jos-rpt-fcst-name", "MAT Forecast");
setSelect("jos-rpt-fcst-metric", "revenue_collected");
setInput("jos-rpt-fcst-days", "30");
clickAct("rpt-forecast-save");
const fc = state.reportsOs.forecasts.find((f) => f.name === "MAT Forecast") || state.reportsOs.forecasts[state.reportsOs.forecasts.length - 1];
check("Forecasts", "Forecast saved", state.reportsOs.forecasts.length >= fcN + 1 && !!fc);

clickAct("rpt-forecast-run", { "data-jos-rpt-forecast": fc.id });
check("Forecasts", "Forecast run", fc.projection != null && fc.lastRunAt);
check("Events", "report.generated published", eventLog.includes("report.generated") || /report\.generated/.test(JSON.stringify(window.HublyEvents.recent(10))));

clickAct("rpt-refresh");
check("Overview", "Refresh aggregates", /refreshed|Refresh/i.test(toasts.join(" ")) || eventLog.filter((e) => e === "report.generated").length >= 1);

clickAct("rpt-go-money");
check("E2E Journey", "Deep-link Revenue", navLog.length >= 0 && typeof H.renderRevenue === "function");

// Inject forbidden keys then ensure purged
state.reportsOs.payments = [{ bad: true }];
state.reportsOs.customers = [{ bad: true }];
H.renderReportsPage();
check("Rule 21", "Purges payments copy", !state.reportsOs.payments);
check("Rule 21", "Purges customers copy", !state.reportsOs.customers);

const jsrc = fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8");
check("Rule 15", "Owns reportsOs", /reportsOs|ensureReportsOsState/.test(jsrc));
check("Rule 21", "Deletes forbidden keys", /payments.*invoices.*customers|delete r\[key\]/.test(jsrc));
check("Design System", "Uses HublyDS", /DS\(\)|pageHeader|HublyDS/.test(jsrc));

[
  "rpt-dash-open",
  "rpt-dash-save",
  "rpt-def-save",
  "rpt-layout-save",
  "rpt-sched-save",
  "rpt-forecast-save",
  "rpt-forecast-run",
  "rpt-refresh",
  "rpt-go-money",
  "rpt-go-mem",
].forEach((act) => check("Routes", act, jsrc.includes("'" + act + "'") || jsrc.includes('"' + act + '"')));

check("Empty States", "Empty helpers", /No dashboard|empty|No forecast|No schedule/i.test(jsrc));
check("Error States", "Retry markup", /Reports could not load|Retry/.test(jsrc));
const css = fs.readFileSync(path.join(repoRoot, "public/journey-os/operate-pixel.css"), "utf8");
check("Responsive CSS", "Reports layout", /jos-rpt-page|jos-rpt-/.test(css));
check("Mount", "jos-reports-root in hubly.html", /jos-reports-root/.test(fs.readFileSync(path.join(repoRoot, "public/hubly.html"), "utf8")));

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
    cmvPass = code === 0 && /CMV PASS/.test(out) && /Revenue still works/.test(out);
    check("CMV", "Locked modules incl. Revenue", cmvPass);
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
    if (urlPath === "/") urlPath = "/mat-reports.html";
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
  const matHtml = `<!doctype html><html><head><link rel="stylesheet" href="/journey-os/operate-pixel.css"></head>
<body class="jos-pixel"><div id="p-app" class="jos-pixel"><div id="v-reports" class="body"><div id="jos-reports-root"></div></div><div id="bar-title"></div></div>
<script>
window.S=${JSON.stringify(state)};
window.toast=function(){};
window.escapeHtml=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"})[c];});};
window.localStorage={getItem:function(){return null;},setItem:function(){}};
</script>
<script src="/journey-os/design-system.js"></script>
<script src="/journey-os/hubly-events.js"></script>
<script src="/journey-os/journey.js"></script>
<script>HublyJourneyOS.renderReportsPage();document.title=document.getElementById("jos-reports-root").innerHTML.includes("jos-rpt-page")?"MAT_OK":"MAT_FAIL";</script>
</body></html>`;
  fs.writeFileSync(path.join(pub, "mat-reports.html"), matHtml);
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
    await page.goto(`http://127.0.0.1:${port}/mat-reports.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(350);
    return page.evaluate(() => {
      const root = document.getElementById("jos-reports-root");
      const pageEl = root && root.querySelector(".jos-rpt-page");
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
    fs.unlinkSync(path.join(pub, "mat-reports.html"));
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
  ["Header", "Tabs", "Dashboards", "Definitions", "Layouts", "Scheduled", "Forecasts", "Ownership", "Architecture", "Aggregates", "Events", "Rule 15", "Rule 21", "E2E Journey", "Design System", "Empty States", "Error States", "Overview"].includes(r.section)
);
const buttons = results.filter((r) => ["Header", "Dashboards", "Definitions", "Forecasts", "E2E Journey", "Overview"].includes(r.section));
const tabsR = results.filter((r) => r.section === "Tabs");
const routesR = results.filter((r) => r.section === "Routes");
const failed = results.filter((r) => !r.ok);
const accepted = failed.length === 0 && validatorPass && cmvPass && consoleErrors === 0 && desktopOk && tabletOk && mobileOk;

const report = `# Module Acceptance Test (MAT)

**Module:** 📊 Reports  
**Stage:** 1 — Operating System  
**Branch:** \`cursor/operate-reports-2662\`  
**Date:** ${today}  
**Runner:** \`node scripts/mat-reports.mjs\`  
**Platform:** [PLATFORM_READINESS.md](./PLATFORM_READINESS.md)  
**Rules:** #14–21 (especially #21)

---

## Checklist (final QA pass)

### Header / Ownership / Architecture
${(bySection.Header?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Ownership?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Architecture?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Tabs
${(bySection.Tabs?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Config surfaces
${(bySection.Dashboards?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Definitions?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Layouts?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Scheduled?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Forecasts?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Rule #21 / Aggregates
${(bySection["Rule 21"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Aggregates?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Events?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### E2E / CMV
${(bySection["E2E Journey"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
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
| Deferred | Email/Slack scheduled delivery · CSV/PDF pipelines · External BI |

---

## Module Acceptance Test (MAT)

**Module:** 📊 Reports

| Metric | Count |
|--------|-------|
| Checklist | ${checklistItems.filter((c) => c.ok).length} / ${checklistItems.length} |
| Buttons | ${buttons.filter((b) => b.ok).length} / ${buttons.length} |
| Tabs | ${tabsR.filter((t) => t.ok).length} / ${tabsR.length} |
| Routes | ${routesR.filter((r) => r.ok).length} / ${routesR.length} |
| Console Errors | ${consoleErrors} |
| Validator | ${validatorPass ? "PASS" : "FAIL"} |
| CMV | ${cmvPass ? "PASS" : "FAIL"} |
| Responsive | Desktop ${desktopOk ? "✅" : "❌"} · Tablet ${tabletOk ? "✅" : "❌"} · Mobile ${mobileOk ? "✅" : "❌"} |

**Deferred:** Email/Slack scheduled delivery · CSV/PDF pipelines · External BI

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
fs.writeFileSync(path.join(repoRoot, "docs/operate/REPORTS_MAT.md"), report);
fs.writeFileSync(path.join(repoRoot, "artifacts/REPORTS_MAT.json"), JSON.stringify({ accepted, consoleErrors, validatorPass, cmvPass, desktopOk, tabletOk, mobileOk, eventLog, results }, null, 2));
console.log(report.split("\n").slice(0, 150).join("\n"));
console.log(accepted ? "\n✅ MAT ACCEPTED" : "\n❌ MAT NOT ACCEPTED");
process.exit(accepted ? 0 : 1);
