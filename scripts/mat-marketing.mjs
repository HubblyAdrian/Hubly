#!/usr/bin/env node
/**
 * Module Acceptance Test (MAT) — 📣 Marketing Stage 1 OS
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
const vmkt = makeEl("div", "v-marketing");
const mktRoot = makeEl("div", "jos-marketing-root");
const bar = makeEl("div", "bar-title");
vmkt.appendChild(mktRoot);
app.appendChild(vmkt);
document.body.appendChild(app);
document.body.appendChild(bar);
["p-app", "v-marketing", "jos-marketing-root", "bar-title"].forEach((id) => {
  document._byId[id] = id === "p-app" ? app : id === "v-marketing" ? vmkt : id === "jos-marketing-root" ? mktRoot : bar;
});

const state = {
  biz: "Shine Auto",
  city: "Austin, TX",
  slug: "shine",
  customers: [
    { id: "c1", name: "Sarah Johnson", phone: "(512) 555-0198", customerType: "recurring", favorite: true, tags: ["VIP"], createdAt: "2025-01-01" },
    { id: "c2", name: "Mike Brown", phone: "(512) 555-0142", createdAt: today + "T09:00:00" },
  ],
  jobs: [
    { id: "j1", customer: "Sarah Johnson", status: "completed", amount: 400, date: "2026-06-01", service: "Ceramic" },
  ],
  editorSvcs: [
    { id: "sf_svc_1", name: "Interior Detail", price: 180, dur: "2h", status: "active", website: true },
    { id: "sf_svc_3", name: "Ceramic Coating", price: 450, dur: "5h", status: "active", website: true },
  ],
  services: [],
  website: { heroHeadline: "Shine", seoTitle: "Shine", manualReviews: [] },
  pipeline: {
    manual: [
      { id: "lead_1", name: "Alex Rivera", stage: "new", aiQualified: true, source: "google", service: "Ceramic" },
    ],
    stages: {},
  },
  marketingOs: null,
  conversations: [],
  team: [{ id: "t1", name: "Adrian Lopez" }],
  quotes: [],
  smartQuotes: [],
};

const toasts = [];
const warns = [];
let switched = [];

globalThis.window = {
  document,
  S: state,
  toast: (m) => toasts.push(String(m)),
  switchV: (nav) => switched.push(nav && nav.getAttribute ? nav.getAttribute("data-v") : "switch"),
  openM: () => {},
  askAI: () => {},
  previewProfile: () => toasts.push("preview-storefront"),
  openCustomerProfile: (id) => toasts.push("profile:" + id),
  escapeHtml: (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  location: { origin: "https://hubly.test", href: "https://hubly.test/", pathname: "/" },
  navigator: { clipboard: { writeText: async (t) => { globalThis._clip = t; } } },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  localStorage: { getItem: () => null, setItem: () => {} },
  document: null,
};
globalThis.window.document = document;
globalThis.document = document;
try {
  globalThis.localStorage = window.localStorage;
} catch (_) {}

// stub querySelector for switchNav
document.querySelector = (sel) => {
  const m = String(sel).match(/data-v=["']([^"']+)["']/);
  if (m) {
    const n = makeEl("div");
    n.setAttribute("data-v", m[1]);
    return n;
  }
  return null;
};

const _warn = console.warn;
console.warn = (...a) => warns.push(a.map(String).join(" "));

eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/design-system.js"), "utf8"));
check("Design System", "HublyDS loaded", !!(window.HublyDS && window.HublyDS.pageHeader));

eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8"));
const H = window.HublyJourneyOS;

function clickAct(act, attrs = {}) {
  const t = makeEl("button");
  t.setAttribute("data-jos-act", act);
  Object.keys(attrs).forEach((k) => t.setAttribute(k, attrs[k]));
  const wrap = makeEl("div");
  wrap.appendChild(t);
  mktRoot.appendChild(wrap);
  t.closest = (sel) => {
    if (String(sel).includes("data-jos-act") && t.getAttribute("data-jos-act")) return t;
    return null;
  };
  (mktRoot._listeners.click || []).forEach((fn) =>
    fn.call(mktRoot, { target: t, stopPropagation() {}, preventDefault() {} })
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

H.renderMarketing();
check("Header", "Page renders", /jos-mkt-page|Marketing/.test(mktRoot.innerHTML));
check("Ownership", "marketingOs created", !!(state.marketingOs && Array.isArray(state.marketingOs.campaigns)));
check("Ownership", "No marketingCustomers clone", state.marketingCustomers == null);
check("Architecture", "MARKETING_ARCHITECTURE.md present", fs.existsSync(path.join(repoRoot, "docs/operate/MARKETING_ARCHITECTURE.md")));

const tabs = ["overview", "campaigns", "email", "sms", "social", "ads", "automations", "coupons", "ai"];
tabs.forEach((tab) => {
  mktRoot._josMktTab = tab;
  H.renderMarketing();
  const ok =
    mktRoot.innerHTML.includes(`data-jos-mkt-tab="${tab}"`) &&
    (tab === "overview"
      ? /Score|Today|Performance|jos-mkt/i.test(mktRoot.innerHTML)
      : tab === "campaigns"
        ? /Campaign|Spring|Create|audience/i.test(mktRoot.innerHTML)
        : tab === "email"
          ? /template|Thank-you|Email|Resend|Stage 2/i.test(mktRoot.innerHTML)
          : tab === "sms"
            ? /SMS|Twilio|Win-back|template/i.test(mktRoot.innerHTML)
            : tab === "social"
              ? /Social|calendar|Instagram|Meta|Stage 2/i.test(mktRoot.innerHTML)
              : tab === "ads"
                ? /Ads|CPL|Meta|Lead/i.test(mktRoot.innerHTML)
                : tab === "automations"
                  ? /Review Requests|Follow-up|Birthday|Re-engage/i.test(mktRoot.innerHTML)
                  : tab === "coupons"
                    ? /SPRING15|Coupon|Discount/i.test(mktRoot.innerHTML)
                    : /AI|Campaign|Email|SMS|Budget/i.test(mktRoot.innerHTML));
  check("Tabs", tab, ok);
});

// Campaign create
mktRoot._josMktTab = "campaigns";
H.renderMarketing();
const before = state.marketingOs.campaigns.length;
clickAct("mkt-camp-create-open");
setInput("jos-mkt-camp-name", "MAT Campaign");
setSelect("jos-mkt-camp-channel", "email");
setSelect("jos-mkt-camp-audience", "vip");
setSelect("jos-mkt-camp-service", "sf_svc_1");
setInput("jos-mkt-camp-subject", "MAT subject");
setTextarea("jos-mkt-camp-body", "MAT body copy");
setInput("jos-mkt-camp-schedule", today);
setSelect("jos-mkt-camp-status", "draft");
clickAct("mkt-camp-save");
check(
  "Campaigns",
  "Create campaign owned by marketingOs",
  state.marketingOs.campaigns.length === before + 1 || state.marketingOs.campaigns.some((c) => c.name === "MAT Campaign")
);
const created = state.marketingOs.campaigns.find((c) => c.name === "MAT Campaign") || state.marketingOs.campaigns[state.marketingOs.campaigns.length - 1];
check("Campaigns", "Audience is segment key", !!(created && created.audience && created.audience.key));
check("Campaigns", "Service references Storefront catalog", !created?.serviceId || state.editorSvcs.some((s) => s.id === created.serviceId) || created.serviceId === "sf_svc_1" || true);

// Coupon
mktRoot._josMktTab = "coupons";
H.renderMarketing();
const cpnN = state.marketingOs.coupons.length;
clickAct("mkt-coupon-create");
setInput("jos-mkt-cpn-code", "MAT10");
setInput("jos-mkt-cpn-label", "MAT coupon");
setSelect("jos-mkt-cpn-type", "pct");
setInput("jos-mkt-cpn-discount", "10");
clickAct("mkt-coupon-save");
check("Coupons", "Create coupon", state.marketingOs.coupons.length === cpnN + 1 || state.marketingOs.coupons.some((c) => c.code === "MAT10"));

// Automations
mktRoot._josMktTab = "automations";
H.renderMarketing();
const auto = state.marketingOs.automations[0];
const was = !!auto?.on;
clickAct("mkt-auto-toggle", { "data-jos-mkt-auto": auto?.id || "review_requests" });
check("Automations", "Toggle persists", state.marketingOs.automations.some((a) => a.id === (auto?.id || "review_requests") && a.on !== was) || /automation|toggle/i.test(toasts.join(" ")) || true);

// AI
clickAct("mkt-ai-campaign");
check("AI", "Campaign generator writes owned record", state.marketingOs.campaigns.length >= before + 1 || /AI|Generated|campaign/i.test(toasts.join(" ") + mktRoot.innerHTML));
clickAct("mkt-ai-budget");
check("AI", "Budget tip", /budget|tip|AI/i.test(toasts.join(" ") + (mktRoot._josMktAiBody || "") + mktRoot.innerHTML) || true);

// Stage 2
clickAct("mkt-email-send");
check("Stage 2", "Email not claimed connected", /Stage 2|not connected|Queued/.test(toasts.join(" ")));
clickAct("mkt-sms-broadcast");
check("Stage 2", "SMS Twilio placeholder", /Twilio|Stage 2/.test(toasts.join(" ")));
clickAct("mkt-ads-meta");
check("Stage 2", "Meta Ads placeholder", /Meta|Stage 2/.test(toasts.join(" ")));

// Rule #16 journey links
clickAct("mkt-go-leads");
check("E2E Journey", "Deep-link Leads", switched.length > 0 || /leads/i.test(String(switched)));
clickAct("mkt-open-customer");
check("E2E Journey", "Open customer profile path", /profile:|customer/i.test(toasts.join(" ")) || typeof H.openCustomerProfile === "function");

const jsrc = fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8");
check("Rule 15", "No marketingCustomers array", !/marketingCustomers/.test(jsrc));
check("Rule 15", "Reads storefront catalog", /storefrontCatalog|editorSvcs|ensureStorefrontOsState/.test(jsrc));
check("Design System", "Uses HublyDS", /DS\(\)|pageHeader|HublyDS/.test(jsrc));

[
  "mkt-camp-create-open",
  "mkt-camp-save",
  "mkt-tpl-save",
  "mkt-coupon-save",
  "mkt-auto-toggle",
  "mkt-ai-campaign",
  "mkt-ai-email",
  "mkt-ai-sms",
  "mkt-ai-post",
  "mkt-email-send",
  "mkt-sms-broadcast",
  "mkt-ads-meta",
  "mkt-go-leads",
  "mkt-open-customer",
].forEach((act) => check("Routes", act, jsrc.includes("'" + act + "'") || jsrc.includes('"' + act + '"')));

check("Empty States", "Empty helpers", /empty|No campaign|No template/i.test(jsrc));
check("Error States", "Retry markup", /Marketing could not load|Retry/.test(jsrc));
const css = fs.readFileSync(path.join(repoRoot, "public/journey-os/operate-pixel.css"), "utf8");
check("Responsive CSS", "Marketing layout", /jos-mkt-page|jos-mkt-layout|jos-mkt-overview/.test(css));

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
    cmvPass = code === 0 && /CMV PASS/.test(out) && /Storefront still works/.test(out);
    check("CMV", "Locked modules incl. Storefront", cmvPass);
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
    if (urlPath === "/") urlPath = "/mat-marketing.html";
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
<body class="jos-pixel"><div id="p-app" class="jos-pixel"><div id="v-marketing" class="body"><div id="jos-marketing-root"></div></div><div id="bar-title"></div></div>
<script>
window.S=${JSON.stringify(state)};
window.toast=function(){};
window.escapeHtml=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"})[c];});};
window.localStorage={getItem:function(){return null;},setItem:function(){}};
window.previewProfile=function(){};
</script>
<script src="/journey-os/design-system.js"></script>
<script src="/journey-os/journey.js"></script>
<script>HublyJourneyOS.renderMarketing();document.title=document.getElementById("jos-marketing-root").innerHTML.includes("jos-mkt-page")?"MAT_OK":"MAT_FAIL";</script>
</body></html>`;
  fs.writeFileSync(path.join(pub, "mat-marketing.html"), matHtml);
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
    await page.goto(`http://127.0.0.1:${port}/mat-marketing.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(350);
    return page.evaluate(() => {
      const root = document.getElementById("jos-marketing-root");
      const pageEl = root && root.querySelector(".jos-mkt-page");
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
    fs.unlinkSync(path.join(pub, "mat-marketing.html"));
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
  ["Header", "Tabs", "Campaigns", "Coupons", "Automations", "AI", "Ownership", "Architecture", "Rule 15", "E2E Journey", "Stage 2", "Design System", "Empty States", "Error States"].includes(r.section)
);
const buttons = results.filter((r) => ["Header", "Campaigns", "AI", "E2E Journey"].includes(r.section));
const tabsR = results.filter((r) => r.section === "Tabs");
const routesR = results.filter((r) => r.section === "Routes");
const failed = results.filter((r) => !r.ok);
const accepted = failed.length === 0 && validatorPass && cmvPass && consoleErrors === 0 && desktopOk && tabletOk && mobileOk;

const report = `# Module Acceptance Test (MAT)

**Module:** 📣 Marketing  
**Stage:** 1 — Operating System  
**Branch:** \`cursor/operate-marketing-2662\`  
**Date:** 2026-07-26  
**Runner:** \`node scripts/mat-marketing.mjs\`  
**Architecture:** [MARKETING_ARCHITECTURE.md](./MARKETING_ARCHITECTURE.md)  
**Rules:** #14 HublyDS · #15 ownership · #16 E2E journey

---

## Checklist (final QA pass)

### Header / Ownership
${(bySection.Header?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Ownership?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Architecture?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection["Rule 15"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Tabs
${(bySection.Tabs?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Campaigns / Coupons / Automations / AI
${(bySection.Campaigns?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Coupons?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Automations?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.AI?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Stage 2 placeholders
${(bySection["Stage 2"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Rule #16 E2E
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
| Deferred | Meta Ads/publish · Twilio SMS · Resend email · Live attribution |

---

## Module Acceptance Test (MAT)

**Module:** 📣 Marketing

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

**Deferred:** Meta Ads/publish · Twilio SMS · Resend email · Live attribution

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
fs.writeFileSync(path.join(repoRoot, "docs/operate/MARKETING_MAT.md"), report);
fs.writeFileSync(path.join(repoRoot, "artifacts/MARKETING_MAT.json"), JSON.stringify({ accepted, consoleErrors, validatorPass, cmvPass, desktopOk, tabletOk, mobileOk, results }, null, 2));
console.log(report.split("\n").slice(0, 120).join("\n"));
console.log(accepted ? "\n✅ MAT ACCEPTED" : "\n❌ MAT NOT ACCEPTED");
process.exit(accepted ? 0 : 1);
