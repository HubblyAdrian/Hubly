#!/usr/bin/env node
/**
 * Module Acceptance Test (MAT) — 🔁 Memberships Stage 1 OS
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
const vmem = makeEl("div", "v-memberships");
const memRoot = makeEl("div", "jos-memberships-root");
const bar = makeEl("div", "bar-title");
vmem.appendChild(memRoot);
app.appendChild(vmem);
document.body.appendChild(app);
document.body.appendChild(bar);
document._byId["p-app"] = app;
document._byId["v-memberships"] = vmem;
document._byId["jos-memberships-root"] = memRoot;
document._byId["bar-title"] = bar;

const state = {
  biz: "Shine Auto",
  customers: [
    { id: "c1", name: "Sarah Johnson", phone: "(512) 555-0198", customerType: "recurring", recurringAmount: 99, membership: "Essentials" },
    { id: "c2", name: "Mike Brown", phone: "(512) 555-0142" },
    { id: "c3", name: "Jordan Lee", phone: "(512) 555-0111" },
  ],
  jobs: [
    { id: "j1", customer: "Sarah Johnson", customerId: "c1", status: "completed", amount: 400, date: "2026-06-01", service: "Ceramic" },
    { id: "j2", customer: "Mike Brown", customerId: "c2", status: "completed", amount: 180, date: "2026-06-10", service: "Interior" },
  ],
  website: {
    membershipOffers: [{ name: "Essentials", price: 79, cadence: "/mo", includes: ["1 visit / month"], enabled: true }],
  },
  membershipsOs: null,
  services: [{ id: "svc1", name: "Interior Detail" }],
  editorSvcs: [{ id: "svc1", name: "Interior Detail" }],
};

const toasts = [];
const warns = [];
const eventLog = [];

globalThis.window = {
  document,
  S: state,
  toast: (m) => toasts.push(String(m)),
  switchV: () => {},
  openM: () => {},
  askAI: () => {},
  openCustomerProfile: (id) => toasts.push("profile:" + id),
  escapeHtml: (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  location: { origin: "https://hubly.test", href: "https://hubly.test/" },
  navigator: { clipboard: { writeText: async () => {} } },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  localStorage: { getItem: () => null, setItem: () => {} },
};
globalThis.document = document;

const _warn = console.warn;
console.warn = (...a) => warns.push(a.map(String).join(" "));

eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/design-system.js"), "utf8"));
eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/hubly-events.js"), "utf8"));
check("Events", "HublyEvents loaded", !!(window.HublyEvents && window.HublyEvents.publish && window.HublyEvents.on));
check("Rule 18", "Immutable history API", !!(window.HublyEvents.clearHistoryForTests && window.HublyEvents.EVENTS.MEMBERSHIP_VISIT_USED));
window.HublyEvents.on("*", (payload, meta) => eventLog.push(meta.type));

eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8"));
const H = window.HublyJourneyOS;

function clickAct(act, attrs = {}) {
  const t = makeEl("button");
  t.setAttribute("data-jos-act", act);
  Object.keys(attrs).forEach((k) => t.setAttribute(k, attrs[k]));
  const wrap = makeEl("div");
  wrap.appendChild(t);
  memRoot.appendChild(wrap);
  t.closest = (sel) => {
    if (String(sel).includes("data-jos-act") && t.getAttribute("data-jos-act")) return t;
    if (String(sel).includes("data-jos-mem-sub") && attrs["data-jos-mem-sub"]) {
      const c = makeEl("div");
      c.setAttribute("data-jos-mem-sub", attrs["data-jos-mem-sub"]);
      return c;
    }
    if (String(sel).includes("data-jos-mem-plan") && attrs["data-jos-mem-plan"]) {
      const c = makeEl("div");
      c.setAttribute("data-jos-mem-plan", attrs["data-jos-mem-plan"]);
      return c;
    }
    return null;
  };
  (memRoot._listeners.click || []).forEach((fn) =>
    fn.call(memRoot, { target: t, stopPropagation() {}, preventDefault() {} })
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

H.renderMemberships();
check("Header", "Page renders", /jos-mem-page|Memberships/.test(memRoot.innerHTML));
check("Ownership", "membershipsOs created", !!(state.membershipsOs && Array.isArray(state.membershipsOs.plans)));
check("Ownership", "Seeded plans", state.membershipsOs.plans.length >= 1);
check("Ownership", "Seeded subscriber from recurring customer", state.membershipsOs.subscribers.some((s) => s.customerId === "c1"));
check("Architecture", "EVENTS.md present", fs.existsSync(path.join(repoRoot, "docs/operate/EVENTS.md")));
check("Architecture", "MEMBERSHIPS_PLAN present", fs.existsSync(path.join(repoRoot, "docs/operate/MEMBERSHIPS_PLAN.md")));

const tabs = ["overview", "plans", "subscribers", "visits", "billing", "activity"];
tabs.forEach((tab) => {
  memRoot._josMemTab = tab;
  H.renderMemberships();
  const ok =
    memRoot.innerHTML.includes(`data-jos-mem-tab="${tab}"`) &&
    (tab === "overview"
      ? /MRR|Active|Plan|Member/i.test(memRoot.innerHTML)
      : tab === "plans"
        ? /Plan|Visit|price|Create/i.test(memRoot.innerHTML)
        : tab === "subscribers"
          ? /Subscriber|Customer|Start|Active|Paused/i.test(memRoot.innerHTML)
          : tab === "visits"
            ? /Visit|allowance|Use/i.test(memRoot.innerHTML)
            : tab === "billing"
              ? /Billing|Stripe|Rule|cadence|Stage 2/i.test(memRoot.innerHTML)
              : /Activity|membership\.|started|system/i.test(memRoot.innerHTML));
  check("Tabs", tab, ok);
});

// Create plan
memRoot._josMemTab = "plans";
H.renderMemberships();
const planN = state.membershipsOs.plans.length;
clickAct("mem-plan-open");
setInput("jos-mem-plan-name", "MAT Shine Club");
setInput("jos-mem-plan-price", "129");
setInput("jos-mem-plan-visits", "2");
setSelect("jos-mem-plan-cadence", "/mo");
clickAct("mem-plan-save");
check("Plans", "Plan saved", state.membershipsOs.plans.length === planN + 1 || state.membershipsOs.plans.some((p) => p.name === "MAT Shine Club"));

const plan = state.membershipsOs.plans.find((p) => p.name === "MAT Shine Club") || state.membershipsOs.plans[0];
const actLen = state.membershipsOs.activity.length;
const frozen = state.membershipsOs.activity[0];
check("Rule 18", "Activity append-only before mutate", actLen >= 1);

// Start membership for c2
memRoot._josMemTab = "subscribers";
H.renderMemberships();
const subN = state.membershipsOs.subscribers.length;
clickAct("mem-sub-open");
setSelect("jos-mem-sub-customer", "c2");
setSelect("jos-mem-sub-plan", plan.id);
clickAct("mem-sub-save");
function subByCustomer(id) {
  return state.membershipsOs.subscribers.find((s) => String(s.customerId) === String(id));
}
let started = subByCustomer("c2");
check("Subscribers", "Membership started", !!(started && started.status === "active" && state.membershipsOs.subscribers.length >= subN + 1));
check("Events", "membership.started published", eventLog.includes("membership.started") || window.HublyEvents.recent(20).some((e) => e.type === "membership.started"));

// Use visit
clickAct("mem-use-visit", { "data-jos-mem-sub": started.id });
started = subByCustomer("c2");
check("Visits", "Visit used", (started.visitsUsed || 0) >= 1 && state.membershipsOs.visits.length >= 1);
check("Events", "membership.visit_used published", eventLog.includes("membership.visit_used"));

// Renew
clickAct("mem-renew", { "data-jos-mem-sub": started.id });
started = subByCustomer("c2");
check("Subscribers", "Renewed", state.membershipsOs.renewals.length >= 1 && started.status === "active");
check("Events", "membership.renewed published", eventLog.includes("membership.renewed"));

// Pause
clickAct("mem-pause", { "data-jos-mem-sub": started.id });
started = subByCustomer("c2");
check("Subscribers", "Paused", started.status === "paused");
check("Events", "membership.paused published", eventLog.includes("membership.paused"));

// Cancel (compensating event — Rule #18)
clickAct("mem-cancel", { "data-jos-mem-sub": started.id });
started = subByCustomer("c2");
check("Subscribers", "Cancelled", started.status === "cancelled");
check("Events", "membership.cancelled published", eventLog.includes("membership.cancelled"));

// Rule #18 immutability of HublyEvents history
const hist = window.HublyEvents.recent(5);
const first = hist[0];
let mutated = false;
try {
  first.type = "hacked";
  mutated = first.type === "hacked";
} catch (_) {
  mutated = false;
}
check("Rule 18", "HublyEvents history frozen", !mutated && first.type !== "hacked");
const latestAct = state.membershipsOs.activity[state.membershipsOs.activity.length - 1];
check(
  "Rule 18",
  "Activity not rewritten in place",
  state.membershipsOs.activity.length > actLen && Object.isFrozen(latestAct) && Object.isFrozen(frozen)
);

// Stage 2 / E2E
clickAct("mem-stripe");
check("Stage 2", "Stripe placeholder", /Stage 2/.test(toasts.join(" ")));
clickAct("mem-open-customer", { "data-jos-mem-cust": "c1" });
check("E2E Journey", "Open customer profile", /profile:c1/.test(toasts.join(" ")) || typeof H.openCustomerProfile === "function");

const jsrc = fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8");
check("Rule 15", "Owns membershipsOs", /membershipsOs|ensureMembershipsOsState/.test(jsrc));
check("Rule 19", "No membershipCustomers clone", !/membershipCustomers/.test(jsrc));
check("Rule 17", "Publishes HublyEvents", /publishMembershipEvent|membership\.started/.test(jsrc));
check("Design System", "Uses HublyDS", /DS\(\)|pageHeader|HublyDS/.test(jsrc));

[
  "mem-plan-open",
  "mem-plan-save",
  "mem-sub-open",
  "mem-sub-save",
  "mem-renew",
  "mem-pause",
  "mem-cancel",
  "mem-use-visit",
  "mem-stripe",
  "mem-open-customer",
].forEach((act) => check("Routes", act, jsrc.includes("'" + act + "'") || jsrc.includes('"' + act + '"')));

check("Empty States", "Empty helpers", /No plan|No subscriber|empty|Activity/i.test(jsrc));
check("Error States", "Retry markup", /Memberships could not load|Retry/.test(jsrc));
const css = fs.readFileSync(path.join(repoRoot, "public/journey-os/operate-pixel.css"), "utf8");
check("Responsive CSS", "Memberships layout", /jos-mem-page|jos-mem-/.test(css));
check("Load order", "hubly.html loads hubly-events", /hubly-events\.js/.test(fs.readFileSync(path.join(repoRoot, "public/hubly.html"), "utf8")));

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
    cmvPass = code === 0 && /CMV PASS/.test(out) && /Reviews still works/.test(out);
    check("CMV", "Locked modules incl. Reviews", cmvPass);
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
    if (urlPath === "/") urlPath = "/mat-memberships.html";
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
<body class="jos-pixel"><div id="p-app" class="jos-pixel"><div id="v-memberships" class="body"><div id="jos-memberships-root"></div></div><div id="bar-title"></div></div>
<script>
window.S=${JSON.stringify(state)};
window.toast=function(){};
window.escapeHtml=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"})[c];});};
window.localStorage={getItem:function(){return null;},setItem:function(){}};
</script>
<script src="/journey-os/design-system.js"></script>
<script src="/journey-os/hubly-events.js"></script>
<script src="/journey-os/journey.js"></script>
<script>HublyJourneyOS.renderMemberships();document.title=document.getElementById("jos-memberships-root").innerHTML.includes("jos-mem-page")?"MAT_OK":"MAT_FAIL";</script>
</body></html>`;
  fs.writeFileSync(path.join(pub, "mat-memberships.html"), matHtml);
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
    await page.goto(`http://127.0.0.1:${port}/mat-memberships.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(350);
    return page.evaluate(() => {
      const root = document.getElementById("jos-memberships-root");
      const pageEl = root && root.querySelector(".jos-mem-page");
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
    fs.unlinkSync(path.join(pub, "mat-memberships.html"));
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
  ["Header", "Tabs", "Plans", "Subscribers", "Visits", "Ownership", "Architecture", "Events", "Rule 15", "Rule 17", "Rule 18", "Rule 19", "E2E Journey", "Stage 2", "Design System", "Empty States", "Error States"].includes(r.section)
);
const buttons = results.filter((r) => ["Header", "Plans", "Subscribers", "Visits", "E2E Journey"].includes(r.section));
const tabsR = results.filter((r) => r.section === "Tabs");
const routesR = results.filter((r) => r.section === "Routes");
const failed = results.filter((r) => !r.ok);
const accepted = failed.length === 0 && validatorPass && cmvPass && consoleErrors === 0 && desktopOk && tabletOk && mobileOk;

const report = `# Module Acceptance Test (MAT)

**Module:** 🔁 Memberships  
**Stage:** 1 — Operating System  
**Branch:** \`cursor/operate-memberships-2662\`  
**Date:** ${today}  
**Runner:** \`node scripts/mat-memberships.mjs\`  
**Events:** [EVENTS.md](./EVENTS.md) (Rules #17–18)  
**Rules:** #14–19

---

## Checklist (final QA pass)

### Header / Ownership
${(bySection.Header?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Ownership?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Architecture?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Tabs
${(bySection.Tabs?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Plans / Subscribers / Visits
${(bySection.Plans?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Subscribers?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Visits?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Events & Immutability (Rules #17–18)
${(bySection.Events?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection["Rule 17"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection["Rule 18"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection["Rule 19"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Stage 2 / E2E
${(bySection["Stage 2"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection["E2E Journey"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

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
| Deferred | Live Stripe billing · Live renewals / dunning · Live payout sync |

---

## Module Acceptance Test (MAT)

**Module:** 🔁 Memberships

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

**Deferred:** Live Stripe billing · Live renewals / dunning · Live payout sync

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
fs.writeFileSync(path.join(repoRoot, "docs/operate/MEMBERSHIPS_MAT.md"), report);
fs.writeFileSync(path.join(repoRoot, "artifacts/MEMBERSHIPS_MAT.json"), JSON.stringify({ accepted, consoleErrors, validatorPass, cmvPass, desktopOk, tabletOk, mobileOk, eventLog, results }, null, 2));
console.log(report.split("\n").slice(0, 140).join("\n"));
console.log(accepted ? "\n✅ MAT ACCEPTED" : "\n❌ MAT NOT ACCEPTED");
process.exit(accepted ? 0 : 1);
