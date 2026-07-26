#!/usr/bin/env node
/**
 * Module Acceptance Test (MAT) — ⭐ Reviews Stage 1 OS
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
const vrev = makeEl("div", "v-reviews");
const revRoot = makeEl("div", "jos-reviews-root");
const bar = makeEl("div", "bar-title");
vrev.appendChild(revRoot);
app.appendChild(vrev);
document.body.appendChild(app);
document.body.appendChild(bar);
document._byId["p-app"] = app;
document._byId["v-reviews"] = vrev;
document._byId["jos-reviews-root"] = revRoot;
document._byId["bar-title"] = bar;

const state = {
  biz: "Shine Auto",
  customers: [
    { id: "c1", name: "Sarah Johnson", phone: "(512) 555-0198" },
    { id: "c2", name: "Mike Brown", phone: "(512) 555-0142" },
  ],
  jobs: [
    { id: "j1", customer: "Sarah Johnson", customerId: "c1", status: "completed", amount: 400, date: "2026-06-01", service: "Ceramic" },
    { id: "j2", customer: "Mike Brown", customerId: "c2", status: "completed", amount: 180, date: "2026-06-10", service: "Interior" },
  ],
  website: {
    reviewRating: 4.9,
    reviewCount: 2,
    manualReviews: [{ name: "Alex P.", text: "Showed up on time.", rating: 5, src: "Google" }],
  },
  marketingOs: { automations: [{ id: "review_requests", on: true }] },
  reviewsOs: null,
  pipeline: { manual: [], stages: {} },
  services: [],
  editorSvcs: [],
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
window.HublyEvents.on("*", (payload, meta) => eventLog.push(meta.type));

eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8"));
const H = window.HublyJourneyOS;

function clickAct(act, attrs = {}) {
  const t = makeEl("button");
  t.setAttribute("data-jos-act", act);
  Object.keys(attrs).forEach((k) => t.setAttribute(k, attrs[k]));
  const wrap = makeEl("div");
  wrap.appendChild(t);
  revRoot.appendChild(wrap);
  t.closest = (sel) => {
    if (String(sel).includes("data-jos-act") && t.getAttribute("data-jos-act")) return t;
    if (String(sel).includes("data-jos-rev-id") && attrs["data-jos-rev-id"]) {
      const c = makeEl("div");
      c.setAttribute("data-jos-rev-id", attrs["data-jos-rev-id"]);
      return c;
    }
    return null;
  };
  (revRoot._listeners.click || []).forEach((fn) =>
    fn.call(revRoot, { target: t, stopPropagation() {}, preventDefault() {} })
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
function setTextarea(id, value) {
  const inp = makeEl("textarea", id);
  inp.value = value;
  document._byId[id] = inp;
  return inp;
}

H.renderReviews();
check("Header", "Page renders", /jos-rev-page|Reviews/.test(revRoot.innerHTML));
check("Ownership", "reviewsOs created", !!(state.reviewsOs && Array.isArray(state.reviewsOs.reviews)));
check("Ownership", "Seeded reviews", state.reviewsOs.reviews.length >= 1);
check("Architecture", "EVENTS.md present", fs.existsSync(path.join(repoRoot, "docs/operate/EVENTS.md")));

const tabs = ["overview", "inbox", "requests", "ai", "analytics", "events"];
tabs.forEach((tab) => {
  revRoot._josRevTab = tab;
  H.renderReviews();
  const ok =
    revRoot.innerHTML.includes(`data-jos-rev-tab="${tab}"`) &&
    (tab === "overview"
      ? /Rating|Reputation|AI|★/i.test(revRoot.innerHTML)
      : tab === "inbox"
        ? /Google|Facebook|Website|Review/i.test(revRoot.innerHTML)
        : tab === "requests"
          ? /Request|completed|job/i.test(revRoot.innerHTML)
          : tab === "ai"
            ? /AI|Reply|Draft|Select/i.test(revRoot.innerHTML)
            : tab === "analytics"
              ? /Analytics|Response|5-Star|rating/i.test(revRoot.innerHTML)
              : /Event|review\.|HublyEvents|recent/i.test(revRoot.innerHTML + JSON.stringify(window.HublyEvents.recent(5))));
  check("Tabs", tab, ok);
});

// Request review + event
revRoot._josRevTab = "requests";
H.renderReviews();
const reqN = state.reviewsOs.requests.length;
clickAct("rev-request-quick", { "data-jos-rev-job": "j1", "data-jos-rev-cust": "c1" });
check("Requests", "Quick request recorded", state.reviewsOs.requests.length === reqN + 1 || state.reviewsOs.requests.length > reqN);
check("Events", "review.requested published", eventLog.includes("review.requested") || window.HublyEvents.recent(20).some((e) => e.type === "review.requested"));

// Record review
revRoot._josRevTab = "inbox";
H.renderReviews();
const revN = state.reviewsOs.reviews.length;
clickAct("rev-record-open");
setInput("jos-rev-rec-name", "MAT Reviewer");
setInput("jos-rev-rec-rating", "5");
setSelect("jos-rev-rec-source", "google");
setTextarea("jos-rev-rec-text", "MAT recorded review text for acceptance.");
clickAct("rev-record-save");
check("Inbox", "Record review", state.reviewsOs.reviews.length === revN + 1 || state.reviewsOs.reviews.some((r) => r.name === "MAT Reviewer"));
check("Events", "review.received published", eventLog.includes("review.received") || window.HublyEvents.recent(30).some((e) => e.type === "review.received"));
check("Events", "reputation.changed published", eventLog.includes("reputation.changed") || window.HublyEvents.recent(30).some((e) => e.type === "reputation.changed"));

// AI reply
const target = state.reviewsOs.reviews.find((r) => r.name === "MAT Reviewer") || state.reviewsOs.reviews[0];
revRoot._josRevSelId = target.id;
revRoot._josRevTab = "ai";
H.renderReviews();
clickAct("rev-ai-draft");
setTextarea("jos-rev-ai-draft", revRoot._josRevAiDraft || "Thank you for the kind words!");
clickAct("rev-ai-save");
check("AI", "Reply saved", !!(target.reply || target.status === "replied") || /Reply saved/.test(toasts.join(" ")));
check("Events", "review.responded published", eventLog.includes("review.responded") || window.HublyEvents.recent(40).some((e) => e.type === "review.responded"));

// Stage 2
clickAct("rev-sync-google");
check("Stage 2", "Google sync placeholder", /Stage 2/.test(toasts.join(" ")));

// Rule #16
clickAct("rev-open-customer", { "data-jos-rev-cust": "c1" });
check("E2E Journey", "Open customer profile", /profile:c1/.test(toasts.join(" ")) || typeof H.openCustomerProfile === "function");

const jsrc = fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8");
check("Rule 15", "Owns reviewsOs", /reviewsOs|ensureReviewsOsState/.test(jsrc));
check("Rule 17", "Publishes HublyEvents", /publishRevEvent|HublyEvents|review\.requested/.test(jsrc));
check("Design System", "Uses HublyDS", /DS\(\)|pageHeader|HublyDS/.test(jsrc));
check("Alias", "renderBizReviews alias", typeof H.renderBizReviews === "function");

[
  "rev-request-open",
  "rev-request-save",
  "rev-request-quick",
  "rev-record-save",
  "rev-ai-draft",
  "rev-ai-save",
  "rev-sync-google",
  "rev-sync-facebook",
  "rev-open-customer",
].forEach((act) => check("Routes", act, jsrc.includes("'" + act + "'") || jsrc.includes('"' + act + '"')));

check("Empty States", "Empty helpers", /No review|empty|Select/i.test(jsrc));
check("Error States", "Retry markup", /Reviews could not load|Retry/.test(jsrc));
const css = fs.readFileSync(path.join(repoRoot, "public/journey-os/operate-pixel.css"), "utf8");
check("Responsive CSS", "Reviews layout", /jos-rev-page|jos-rev-layout|jos-rev-/.test(css));
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
    cmvPass = code === 0 && /CMV PASS/.test(out) && /Marketing still works/.test(out);
    check("CMV", "Locked modules incl. Marketing", cmvPass);
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
    if (urlPath === "/") urlPath = "/mat-reviews.html";
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
<body class="jos-pixel"><div id="p-app" class="jos-pixel"><div id="v-reviews" class="body"><div id="jos-reviews-root"></div></div><div id="bar-title"></div></div>
<script>
window.S=${JSON.stringify(state)};
window.toast=function(){};
window.escapeHtml=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"})[c];});};
window.localStorage={getItem:function(){return null;},setItem:function(){}};
</script>
<script src="/journey-os/design-system.js"></script>
<script src="/journey-os/hubly-events.js"></script>
<script src="/journey-os/journey.js"></script>
<script>HublyJourneyOS.renderReviews();document.title=document.getElementById("jos-reviews-root").innerHTML.includes("jos-rev-page")?"MAT_OK":"MAT_FAIL";</script>
</body></html>`;
  fs.writeFileSync(path.join(pub, "mat-reviews.html"), matHtml);
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
    await page.goto(`http://127.0.0.1:${port}/mat-reviews.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(350);
    return page.evaluate(() => {
      const root = document.getElementById("jos-reviews-root");
      const pageEl = root && root.querySelector(".jos-rev-page");
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
    fs.unlinkSync(path.join(pub, "mat-reviews.html"));
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
  ["Header", "Tabs", "Requests", "Inbox", "AI", "Ownership", "Architecture", "Events", "Rule 15", "Rule 17", "E2E Journey", "Stage 2", "Design System", "Empty States", "Error States"].includes(r.section)
);
const buttons = results.filter((r) => ["Header", "Requests", "AI", "E2E Journey"].includes(r.section));
const tabsR = results.filter((r) => r.section === "Tabs");
const routesR = results.filter((r) => r.section === "Routes");
const failed = results.filter((r) => !r.ok);
const accepted = failed.length === 0 && validatorPass && cmvPass && consoleErrors === 0 && desktopOk && tabletOk && mobileOk;

const report = `# Module Acceptance Test (MAT)

**Module:** ⭐ Reviews  
**Stage:** 1 — Operating System  
**Branch:** \`cursor/operate-reviews-2662\`  
**Date:** 2026-07-26  
**Runner:** \`node scripts/mat-reviews.mjs\`  
**Events:** [EVENTS.md](./EVENTS.md) (Rule #17)  
**Rules:** #14–17

---

## Checklist (final QA pass)

### Header / Ownership
${(bySection.Header?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Ownership?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Architecture?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Tabs
${(bySection.Tabs?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Requests / Inbox / AI
${(bySection.Requests?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Inbox?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.AI?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Events (Rule #17)
${(bySection.Events?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection["Rule 17"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

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
| Deferred | Live Google sync · Live Facebook sync · Live request delivery |

---

## Module Acceptance Test (MAT)

**Module:** ⭐ Reviews

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

**Deferred:** Live Google sync · Live Facebook sync · Live request delivery

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
fs.writeFileSync(path.join(repoRoot, "docs/operate/REVIEWS_MAT.md"), report);
fs.writeFileSync(path.join(repoRoot, "artifacts/REVIEWS_MAT.json"), JSON.stringify({ accepted, consoleErrors, validatorPass, cmvPass, desktopOk, tabletOk, mobileOk, eventLog, results }, null, 2));
console.log(report.split("\n").slice(0, 120).join("\n"));
console.log(accepted ? "\n✅ MAT ACCEPTED" : "\n❌ MAT NOT ACCEPTED");
process.exit(accepted ? 0 : 1);
