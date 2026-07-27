#!/usr/bin/env node
/**
 * Module Acceptance Test (MAT) — ✨ Ask Hubly Stage 1 OS
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
  querySelector(sel) {
    const m = String(sel || "").match(/\[data-v=["']([^"']+)["']\]/);
    if (!m) return null;
    const fake = makeEl("div", "nav-" + m[1]);
    fake.setAttribute("data-v", m[1]);
    document._byId["nav-" + m[1]] = fake;
    return fake;
  },
  querySelectorAll() {
    return [];
  },
  addEventListener() {},
};

const app = makeEl("div", "p-app");
app.classList.add("jos-pixel");
const vask = makeEl("div", "v-ask");
const askRoot = makeEl("div", "jos-ask-root");
const bar = makeEl("div", "bar-title");
vask.appendChild(askRoot);
app.appendChild(vask);
document.body.appendChild(app);
document.body.appendChild(bar);
document._byId["p-app"] = app;
document._byId["v-ask"] = vask;
document._byId["jos-ask-root"] = askRoot;
document._byId["bar-title"] = bar;

const state = {
  biz: "Shine Auto",
  customers: [{ id: "c1", name: "Sarah Johnson" }, { id: "c2", name: "Mike Brown" }],
  jobs: [{ id: "j1", customer: "Sarah Johnson", customerId: "c1", status: "completed", amount: 400 }],
  revenueOs: { payments: [{ amount: 400 }], invoices: [], deposits: [], refunds: [], activity: [] },
  membershipsOs: { plans: [{ id: "p1", price: 99 }], subscribers: [{ id: "s1", customerId: "c1", status: "active" }], activity: [] },
  marketingOs: { campaigns: [{ id: "camp1", name: "Win-back", status: "draft" }] },
  reviewsOs: { reviews: [{ rating: 5 }], requests: [] },
  reportsOs: { dashboards: [{ id: "d1" }], definitions: [], layouts: [], schedules: [], forecasts: [] },
  website: { heroHeadline: "Old headline" },
  editorSvcs: [{ id: "svc1", name: "Interior", status: "active" }],
  askHublyOs: null,
  quotes: [],
  smartQuotes: [],
  pipeline: { manual: [], stages: {} },
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
check("Events", "HublyEvents loaded", !!(window.HublyEvents && window.HublyEvents.publish));
check("Rule 22", "AI event constants", !!(window.HublyEvents.EVENTS.AI_ACTION_PROPOSED && window.HublyEvents.EVENTS.AI_ACTION_EXECUTED));
window.HublyEvents.on("*", (payload, meta) => eventLog.push(meta.type));

eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8"));
const H = window.HublyJourneyOS;

function clickAct(act, attrs = {}) {
  const t = makeEl("button");
  t.setAttribute("data-jos-act", act);
  Object.keys(attrs).forEach((k) => t.setAttribute(k, attrs[k]));
  const wrap = makeEl("div");
  wrap.appendChild(t);
  askRoot.appendChild(wrap);
  t.closest = (sel) => {
    if (String(sel).includes("data-jos-act") && t.getAttribute("data-jos-act")) return t;
    if (String(sel).includes("data-jos-ah-pending") && attrs["data-jos-ah-pending"]) {
      const c = makeEl("div");
      c.setAttribute("data-jos-ah-pending", attrs["data-jos-ah-pending"]);
      return c;
    }
    if (String(sel).includes("data-jos-ah-auto") && attrs["data-jos-ah-auto"]) {
      const c = makeEl("div");
      c.setAttribute("data-jos-ah-auto", attrs["data-jos-ah-auto"]);
      return c;
    }
    return null;
  };
  (askRoot._listeners.click || []).forEach((fn) =>
    fn.call(askRoot, { target: t, stopPropagation() {}, preventDefault() {} })
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

H.renderAskHubly();
check("Header", "Page renders", /jos-ah-page|Ask Hubly|hubly-mark/.test(askRoot.innerHTML));
check("Ownership", "askHublyOs created", !!(state.askHublyOs && Array.isArray(state.askHublyOs.conversations)));
check("Ownership", "Seeded conversation", state.askHublyOs.conversations.length >= 1);
check("Architecture", "ASK_HUBLY_ARCHITECTURE present", fs.existsSync(path.join(repoRoot, "docs/operate/ASK_HUBLY_ARCHITECTURE.md")));
check("Architecture", "Rule #22 in engineering rules", /Rule #22/.test(fs.readFileSync(path.join(repoRoot, "docs/operate/OPERATE_ENGINEERING_RULES.md"), "utf8")));

const tabs = ["chat", "actions", "memory", "automations", "context", "activity"];
tabs.forEach((tab) => {
  askRoot._josAhTab = tab;
  H.renderAskHubly();
  const ok =
    askRoot.innerHTML.includes(`data-jos-ah-tab="${tab}"`) &&
    (tab === "chat"
      ? /Ask|prompt|chip|conversation/i.test(askRoot.innerHTML)
      : tab === "actions"
        ? /Action|Confirm|Rule #22|pending|Demo/i.test(askRoot.innerHTML)
        : tab === "memory"
          ? /Memory|note/i.test(askRoot.innerHTML)
          : tab === "automations"
            ? /Automation|allow|rule/i.test(askRoot.innerHTML)
            : tab === "context"
              ? /Customer|Revenue|Marketing|owner/i.test(askRoot.innerHTML)
              : /Activity|Rule|initialized|proposed|executed/i.test(askRoot.innerHTML));
  check("Tabs", tab, ok);
});

// Safe action — no confirm
const jobsBefore = state.jobs.length;
const pendingBefore = state.askHublyOs.pending.length;
clickAct("ah-propose-generate-draft");
check("Safe", "Draft executes without pending", state.askHublyOs.pending.length === pendingBefore);
check("Events", "ai.draft.generated or executed", eventLog.includes("ai.draft.generated") || eventLog.includes("ai.action.executed") || /Draft|draft/.test(toasts.join(" ") + JSON.stringify(state.askHublyOs.actions)));

// High-impact — requires confirm
clickAct("ah-propose-create-job");
const pending = state.askHublyOs.pending.find((p) => p.actionType === "create_job");
check("Rule 22", "Create job queued for confirm", !!(pending && pending.status === "pending"));
check("Events", "ai.action.proposed published", eventLog.includes("ai.action.proposed"));
check("Jobs", "Job not created before confirm", state.jobs.length === jobsBefore);

// Confirm
clickAct("ah-confirm", { "data-jos-ah-pending": pending.id });
check("Rule 22", "Confirmed creates job", state.jobs.length === jobsBefore + 1);
check("Events", "ai.action.confirmed published", eventLog.includes("ai.action.confirmed"));
check("Events", "ai.action.executed published", eventLog.includes("ai.action.executed"));

// Cancel path
clickAct("ah-propose-publish-website");
const pubPending = state.askHublyOs.pending.find((p) => p.actionType === "publish_website");
check("Rule 22", "Publish website pending", !!pubPending);
clickAct("ah-cancel", { "data-jos-ah-pending": pubPending.id });
check("Rule 22", "Cancel removes pending", !state.askHublyOs.pending.some((p) => p.id === pubPending.id));
check("Events", "ai.action.cancelled published", eventLog.includes("ai.action.cancelled"));

// Automation allow-rule auto-confirms
setSelect("jos-ah-auto-action", "create_quote");
setInput("jos-ah-auto-note", "MAT allow create_quote");
clickAct("ah-auto-add");
check("Automations", "Allow-rule saved", state.askHublyOs.automations.some((a) => a.actionType === "create_quote" && a.allowed));
const quotesBefore = state.smartQuotes.length + state.quotes.length;
const pendingMid = state.askHublyOs.pending.length;
clickAct("ah-propose-create-quote");
check("Rule 22", "Automation skips pending", state.askHublyOs.pending.length === pendingMid);
check("Quotes", "Quote created via automation", state.smartQuotes.length + state.quotes.length >= quotesBefore + 1);

// Memory
askRoot._josAhTab = "memory";
H.renderAskHubly();
setInput("jos-ah-memory-input", "MAT memory note");
clickAct("ah-memory-add");
check("Memory", "Memory note added", state.askHublyOs.memory.some((m) => /MAT memory/.test(m.text)));

// Forbidden copies purged
state.askHublyOs.customers = [{ bad: true }];
state.askHublyOs.payments = [{ bad: true }];
H.renderAskHubly();
check("Rule 19", "Purges customers copy", !state.askHublyOs.customers);
check("Rule 19", "Purges payments copy", !state.askHublyOs.payments);

// Hard guards still confirm for refund
clickAct("ah-propose-refund-payment");
check("Hard guards", "Refund requires confirm", state.askHublyOs.pending.some((p) => p.actionType === "refund_payment"));

const jsrc = fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8");
check("Rule 15", "Owns askHublyOs", /askHublyOs|ensureAskHublyOsState/.test(jsrc));
check("Rule 22", "Confirmation engine", /ahProposeAction|requiresConfirm|ahConfirmPending/.test(jsrc));
check("Brand", "Hubly wordmark", /hubly-wordmark-on-dark|hubly-mark/.test(jsrc));
check("Design System", "Uses HublyDS", /DS\(\)|pageHeader|HublyDS/.test(jsrc));

[
  "ah-confirm",
  "ah-cancel",
  "ah-propose-create-job",
  "ah-propose-generate-draft",
  "ah-memory-add",
  "ah-auto-add",
  "ah-go-money",
  "ah-go-reports",
].forEach((act) => check("Routes", act, jsrc.includes("'" + act + "'") || jsrc.includes('"' + act + '"')));

check("Empty States", "Empty helpers", /No pending|empty|No memory|No automation/i.test(jsrc));
check("Error States", "Retry markup", /Ask Hubly could not load|Retry/.test(jsrc));
const css = fs.readFileSync(path.join(repoRoot, "public/journey-os/operate-pixel.css"), "utf8");
check("Responsive CSS", "Ask Hubly layout", /jos-ah-page|jos-ah-/.test(css));
check("Mount", "jos-ask-root in hubly.html", /jos-ask-root/.test(fs.readFileSync(path.join(repoRoot, "public/hubly.html"), "utf8")));

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
    cmvPass = code === 0 && /CMV PASS/.test(out) && /Reports still works/.test(out);
    check("CMV", "Locked modules incl. Reports", cmvPass);
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
    if (urlPath === "/") urlPath = "/mat-ask-hubly.html";
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
<body class="jos-pixel"><div id="p-app" class="jos-pixel"><div id="v-ask" class="body"><div id="jos-ask-root"></div></div><div id="bar-title"></div></div>
<script>
window.S=${JSON.stringify(state)};
window.toast=function(){};
window.escapeHtml=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"})[c];});};
window.localStorage={getItem:function(){return null;},setItem:function(){}};
</script>
<script src="/journey-os/design-system.js"></script>
<script src="/journey-os/hubly-events.js"></script>
<script src="/journey-os/journey.js"></script>
<script>HublyJourneyOS.renderAskHubly();document.title=document.getElementById("jos-ask-root").innerHTML.includes("jos-ah-page")?"MAT_OK":"MAT_FAIL";</script>
</body></html>`;
  fs.writeFileSync(path.join(pub, "mat-ask-hubly.html"), matHtml);
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
    await page.goto(`http://127.0.0.1:${port}/mat-ask-hubly.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(350);
    return page.evaluate(() => {
      const root = document.getElementById("jos-ask-root");
      const pageEl = root && root.querySelector(".jos-ah-page");
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
    fs.unlinkSync(path.join(pub, "mat-ask-hubly.html"));
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
  ["Header", "Tabs", "Safe", "Rule 22", "Hard guards", "Automations", "Memory", "Ownership", "Architecture", "Events", "Rule 15", "Rule 19", "Brand", "Design System", "Empty States", "Error States", "Jobs", "Quotes"].includes(r.section)
);
const buttons = results.filter((r) => ["Header", "Safe", "Rule 22", "Automations", "Memory"].includes(r.section));
const tabsR = results.filter((r) => r.section === "Tabs");
const routesR = results.filter((r) => r.section === "Routes");
const failed = results.filter((r) => !r.ok);
const accepted = failed.length === 0 && validatorPass && cmvPass && consoleErrors === 0 && desktopOk && tabletOk && mobileOk;

const report = `# Module Acceptance Test (MAT)

**Module:** ✨ Ask Hubly  
**Stage:** 1 — Operating System  
**Branch:** \`cursor/operate-ask-hubly-2662\`  
**Date:** ${today}  
**Runner:** \`node scripts/mat-ask-hubly.mjs\`  
**Architecture:** [ASK_HUBLY_ARCHITECTURE.md](./ASK_HUBLY_ARCHITECTURE.md)  
**Rules:** #14–22 (especially #22)

---

## Checklist (final QA pass)

### Header / Ownership / Architecture
${(bySection.Header?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Ownership?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Architecture?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Tabs
${(bySection.Tabs?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Rule #22 confirmation
${(bySection.Safe?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection["Rule 22"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection["Hard guards"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Automations?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Events / Ownership guards
${(bySection.Events?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection["Rule 19"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Memory?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### CMV
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
| Deferred | Live LLM · Live external tool calling · Live publish APIs |

---

## Module Acceptance Test (MAT)

**Module:** ✨ Ask Hubly

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

**Deferred:** Live LLM · Live external tool calling · Live publish APIs

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
fs.writeFileSync(path.join(repoRoot, "docs/operate/ASK_HUBLY_MAT.md"), report);
fs.writeFileSync(path.join(repoRoot, "artifacts/ASK_HUBLY_MAT.json"), JSON.stringify({ accepted, consoleErrors, validatorPass, cmvPass, desktopOk, tabletOk, mobileOk, eventLog, results }, null, 2));
console.log(report.split("\n").slice(0, 160).join("\n"));
console.log(accepted ? "\n✅ MAT ACCEPTED" : "\n❌ MAT NOT ACCEPTED");
process.exit(accepted ? 0 : 1);
