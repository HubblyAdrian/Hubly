#!/usr/bin/env node
/**
 * Module Acceptance Test (MAT) — ⚙️ Settings Stage 1 OS
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
const vset = makeEl("div", "v-settings");
const setRoot = makeEl("div", "jos-settings-root");
const bar = makeEl("div", "bar-title");
vset.appendChild(setRoot);
app.appendChild(vset);
document.body.appendChild(app);
document.body.appendChild(bar);
document._byId["p-app"] = app;
document._byId["v-settings"] = vset;
document._byId["jos-settings-root"] = setRoot;
document._byId["bar-title"] = bar;

const state = {
  biz: "Shine Auto",
  city: "San Diego, CA",
  team: [
    { id: "t1", name: "Adrian Lopez", role: "Owner" },
    { id: "t2", name: "Maya Chen", role: "Technician" },
  ],
  customers: [{ id: "c1", name: "Sarah Johnson" }],
  jobs: [{ id: "j1", customer: "Sarah Johnson", status: "completed", amount: 400 }],
  revenueOs: { payments: [], invoices: [], deposits: [], refunds: [], activity: [] },
  membershipsOs: { plans: [], subscribers: [], activity: [] },
  marketingOs: { campaigns: [] },
  reviewsOs: { reviews: [], requests: [] },
  reportsOs: { dashboards: [], definitions: [], layouts: [], schedules: [], forecasts: [] },
  askHublyOs: null,
  settingsOs: null,
  website: {},
  editorSvcs: [],
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
check("Rule 23", "Settings event constants", !!(window.HublyEvents.EVENTS.SETTINGS_UPDATED && window.HublyEvents.EVENTS.SETTINGS_TEAM_INVITED));
window.HublyEvents.on("*", (payload, meta) => eventLog.push(meta.type));

eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8"));
const H = window.HublyJourneyOS;

function clickAct(act, attrs = {}) {
  const t = makeEl("button");
  t.setAttribute("data-jos-act", act);
  Object.keys(attrs).forEach((k) => t.setAttribute(k, attrs[k]));
  const wrap = makeEl("div");
  if (attrs["data-jos-set-integration"]) wrap.setAttribute("data-jos-set-integration", attrs["data-jos-set-integration"]);
  wrap.appendChild(t);
  setRoot.appendChild(wrap);
  t.closest = (sel) => {
    if (String(sel).includes("data-jos-act") && t.getAttribute("data-jos-act")) return t;
    if (String(sel).includes("data-jos-set-integration")) {
      const c = makeEl("div");
      c.setAttribute("data-jos-set-integration", attrs["data-jos-set-integration"] || "stripe");
      return c;
    }
    return null;
  };
  (setRoot._listeners.click || []).forEach((fn) =>
    fn.call(setRoot, { target: t, stopPropagation() {}, preventDefault() {} })
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
function setCheck(id, on) {
  const inp = makeEl("input", id);
  inp.checked = !!on;
  document._byId[id] = inp;
  return inp;
}

H.renderSettings();
check("Header", "Page renders", /jos-set-page|jos-set-mc-shell|Settings|hubly-mark|Rule #23/.test(setRoot.innerHTML));
check("Ownership", "settingsOs created", !!(state.settingsOs && state.settingsOs.business));
check("Ownership", "Seeded team users", state.settingsOs.team.users.length >= 1);
check("Architecture", "SETTINGS_ARCHITECTURE present", fs.existsSync(path.join(repoRoot, "docs/operate/SETTINGS_ARCHITECTURE.md")));
check("Architecture", "Rule #23 in engineering rules", /Rule #23/.test(fs.readFileSync(path.join(repoRoot, "docs/operate/OPERATE_ENGINEERING_RULES.md"), "utf8")));

const tabs = ["overview", "business", "team", "billing", "integrations", "notifications", "branding", "ai", "security", "permissions"];
tabs.forEach((tab) => {
  setRoot._josSetTab = tab;
  H.renderSettings();
  const ok =
    setRoot.innerHTML.includes(`data-jos-set-tab="${tab}"`) &&
    (tab === "overview"
      ? /Control center|Rule #23/i.test(setRoot.innerHTML)
      : tab === "business"
        ? /Business name|Time zone|Tax/i.test(setRoot.innerHTML)
        : tab === "team"
          ? /Invite|Users|Technician/i.test(setRoot.innerHTML)
          : tab === "billing"
            ? /Subscription|Platform invoices|Grow|Start/i.test(setRoot.innerHTML)
            : tab === "integrations"
              ? /Stripe|Twilio|Webhook|Stage 2/i.test(setRoot.innerHTML)
              : tab === "notifications"
                ? /Email|SMS|Push|AI notifications/i.test(setRoot.innerHTML)
                : tab === "branding"
                  ? /Primary color|Accent|Font|Favicon/i.test(setRoot.innerHTML)
                  : tab === "ai"
                    ? /AI tone|permissions|Automation defaults/i.test(setRoot.innerHTML)
                    : tab === "security"
                      ? /MFA|API keys|Audit|Password/i.test(setRoot.innerHTML)
                      : /Roles|Module access|Feature access/i.test(setRoot.innerHTML));
  check("Tabs", tab, ok);
});

// Business save
setRoot._josSetTab = "business";
H.renderSettings();
setInput("jos-set-biz-name", "MAT Detail Co");
setInput("jos-set-biz-address", "1 Test Way");
setInput("jos-set-biz-city", "San Diego");
setInput("jos-set-biz-region", "CA");
setInput("jos-set-biz-postal", "92101");
setInput("jos-set-biz-country", "US");
setInput("jos-set-biz-tz", "America/Los_Angeles");
setInput("jos-set-biz-currency", "USD");
setInput("jos-set-biz-tax", "8.5");
setInput("jos-set-biz-logo", "assets/hubly-wordmark.png");
setInput("jos-set-biz-email", "mat@hubly.test");
setInput("jos-set-biz-phone", "(619) 555-0199");
clickAct("set-business-save");
check("Business", "Name saved", state.settingsOs.business.name === "MAT Detail Co");
check("Events", "settings.updated published", eventLog.includes("settings.updated"));

// Team invite
setRoot._josSetTab = "team";
H.renderSettings();
const usersBefore = state.settingsOs.team.users.length;
setInput("jos-set-invite-email", "new.tech@hubly.test");
setSelect("jos-set-invite-role", "Technician");
clickAct("set-team-invite");
check("Team", "Invitation created", state.settingsOs.team.invitations.some((i) => i.email === "new.tech@hubly.test"));
check("Team", "User added", state.settingsOs.team.users.length === usersBefore + 1);
check("Team", "Mirrors S.team", Array.isArray(state.team) && state.team.some((u) => /new\.tech/i.test(u.email || u.name || "")));
check("Events", "settings.team.invited published", eventLog.includes("settings.team.invited"));

// Billing
setRoot._josSetTab = "billing";
H.renderSettings();
setSelect("jos-set-plan", "Scale");
setInput("jos-set-pay-method", "Visa ···· 1111");
clickAct("set-billing-save");
check("Billing", "Plan saved", state.settingsOs.billing.plan === "Scale");

// Integrations
setRoot._josSetTab = "integrations";
H.renderSettings();
const beforeStatus = state.settingsOs.integrations.google.status;
clickAct("set-integration-toggle", { "data-jos-set-integration": "google" });
check("Integrations", "Toggle OS status", state.settingsOs.integrations.google.status !== beforeStatus);
check("Events", "settings.integration.toggled published", eventLog.includes("settings.integration.toggled"));
setInput("jos-set-hook-url", "https://example.test/hooks/hubly");
setSelect("jos-set-hook-event", "settings.updated");
clickAct("set-webhook-add");
check("Integrations", "Webhook added", state.settingsOs.integrations.webhooks.some((w) => /example\.test/.test(w.url)));

// Notifications
setRoot._josSetTab = "notifications";
H.renderSettings();
setCheck("jos-set-n-email", true);
setCheck("jos-set-n-sms", false);
setCheck("jos-set-n-push", true);
setCheck("jos-set-n-desktop", true);
setCheck("jos-set-n-ai", true);
clickAct("set-notifications-save");
check("Notifications", "SMS off saved", state.settingsOs.notifications.sms === false);

// Branding
setRoot._josSetTab = "branding";
H.renderSettings();
setInput("jos-set-brand-logo", "assets/hubly-wordmark.png");
setInput("jos-set-brand-primary", "#141B2B");
setInput("jos-set-brand-accent", "#D9632D");
setInput("jos-set-brand-font-d", "Plus Jakarta Sans");
setInput("jos-set-brand-font-b", "DM Sans");
setInput("jos-set-brand-favicon", "/favicon.ico");
setInput("jos-set-brand-web", "Hero first");
clickAct("set-branding-save");
check("Branding", "Accent saved", state.settingsOs.branding.accentColor === "#D9632D");

// AI
setRoot._josSetTab = "ai";
H.renderSettings();
setSelect("jos-set-ai-tone", "concise");
setSelect("jos-set-ai-perm", "propose_with_confirm");
setSelect("jos-set-ai-auto", "false");
setSelect("jos-set-ai-memory", "true");
setInput("jos-set-ai-automations", "exact_allow_rules");
clickAct("set-ai-save");
check("AI", "Tone saved", state.settingsOs.ai.tone === "concise");

// Security
setRoot._josSetTab = "security";
H.renderSettings();
setCheck("jos-set-mfa", true);
setInput("jos-set-pw-len", "12");
setCheck("jos-set-pw-symbol", true);
clickAct("set-security-save");
check("Security", "MFA enabled", state.settingsOs.security.mfaRequired === true);
check("Events", "settings.security.audited published", eventLog.includes("settings.security.audited"));
clickAct("set-api-create");
check("Security", "API key created", state.settingsOs.security.apiKeys.length >= 2);

// Permissions
setRoot._josSetTab = "permissions";
H.renderSettings();
setInput("jos-set-custom-perm", "export_reports");
clickAct("set-perm-custom-add");
check("Permissions", "Custom permission added", state.settingsOs.permissions.custom.includes("export_reports"));
clickAct("set-perm-modules-save");
clickAct("set-perm-features-save");
check("Permissions", "Module access saveable", !!state.settingsOs.permissions.moduleAccess.jobs);

// Rule #23 purge
state.settingsOs.customers = [{ bad: true }];
state.settingsOs.payments = [{ bad: true }];
state.settingsOs.jobs = [{ bad: true }];
state.settingsOs.campaigns = [{ bad: true }];
H.renderSettings();
check("Rule 23", "Purges customers copy", !state.settingsOs.customers);
check("Rule 23", "Purges payments copy", !state.settingsOs.payments);
check("Rule 23", "Purges jobs copy", !state.settingsOs.jobs);
check("Rule 23", "Purges campaigns copy", !state.settingsOs.campaigns);

const jsrc = fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8");
check("Rule 15", "Owns settingsOs", /settingsOs|ensureSettingsOsState/.test(jsrc));
check("Rule 23", "Config-only guard", /Rule #23|Never Own Business Data|purge/i.test(jsrc));
check("Brand", "Hubly wordmark", /hubly-wordmark|hubly-mark/.test(jsrc));
check("Design System", "Uses HublyDS", /DS\(\)|pageHeader|HublyDS/.test(jsrc));

[
  "set-business-save",
  "set-team-invite",
  "set-billing-save",
  "set-integration-toggle",
  "set-webhook-add",
  "set-notifications-save",
  "set-branding-save",
  "set-ai-save",
  "set-security-save",
  "set-api-create",
  "set-perm-custom-add",
  "set-go-ask",
].forEach((act) => check("Routes", act, jsrc.includes("'" + act + "'") || jsrc.includes('"' + act + '"')));

check("Routes", "set-checklist-open", jsrc.includes("'set-checklist-open'") || jsrc.includes('"set-checklist-open"'));
check("Routes", "set-next-step", jsrc.includes("'set-next-step'") || jsrc.includes('"set-next-step"'));
check("Empty States", "Empty helpers", /No users|No pending|No webhooks|No audit|Config only/i.test(jsrc));
check("Error States", "Retry markup", /Settings could not load|Retry/.test(jsrc));
const css = fs.readFileSync(path.join(repoRoot, "public/journey-os/operate-pixel.css"), "utf8");
check("Responsive CSS", "Settings layout", /jos-set-page|jos-set-mc-|jos-settings-mode/.test(css));
check("Mount", "jos-settings-root in hubly.html", /jos-settings-root/.test(fs.readFileSync(path.join(repoRoot, "public/hubly.html"), "utf8")));

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
    cmvPass = code === 0 && /CMV PASS/.test(out) && /Ask Hubly still works/.test(out);
    check("CMV", "Locked modules incl. Ask Hubly", cmvPass);
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
    if (urlPath === "/") urlPath = "/mat-settings.html";
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
<body class="jos-pixel"><div id="p-app" class="jos-pixel"><div id="v-settings" class="body"><div id="jos-settings-root"></div></div><div id="bar-title"></div></div>
<script>
window.S=${JSON.stringify({ city: "San Diego, CA", team: [{ id: "t1", name: "Adrian", role: "Owner" }], jobs: [], customers: [], settingsOs: null })};
window.toast=function(){};
window.escapeHtml=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"})[c];});};
window.localStorage={getItem:function(){return null;},setItem:function(){}};
</script>
<script src="/journey-os/design-system.js"></script>
<script src="/journey-os/hubly-events.js"></script>
<script src="/journey-os/journey.js"></script>
<script>HublyJourneyOS.renderSettings();document.title=document.getElementById("jos-settings-root").innerHTML.includes("jos-set-page")?"MAT_OK":"MAT_FAIL";</script>
</body></html>`;
  fs.writeFileSync(path.join(pub, "mat-settings.html"), matHtml);
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
    await page.goto(`http://127.0.0.1:${port}/mat-settings.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(350);
    return page.evaluate(() => {
      const root = document.getElementById("jos-settings-root");
      const pageEl = root && root.querySelector(".jos-set-page");
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
    fs.unlinkSync(path.join(pub, "mat-settings.html"));
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
  ["Header", "Tabs", "Business", "Team", "Billing", "Integrations", "Notifications", "Branding", "AI", "Security", "Permissions", "Ownership", "Architecture", "Events", "Rule 15", "Rule 23", "Brand", "Design System", "Empty States", "Error States"].includes(r.section)
);
const buttons = results.filter((r) => ["Header", "Business", "Team", "Billing", "Integrations", "Notifications", "Branding", "AI", "Security", "Permissions"].includes(r.section));
const tabsR = results.filter((r) => r.section === "Tabs");
const routesR = results.filter((r) => r.section === "Routes");
const failed = results.filter((r) => !r.ok);
const accepted = failed.length === 0 && validatorPass && cmvPass && consoleErrors === 0 && desktopOk && tabletOk && mobileOk;

const report = `# Module Acceptance Test (MAT)

**Module:** ⚙️ Settings  
**Stage:** 1 — Operating System  
**Branch:** \`cursor/operate-settings-2662\`  
**Date:** ${today}  
**Runner:** \`node scripts/mat-settings.mjs\`  
**Architecture:** [SETTINGS_ARCHITECTURE.md](./SETTINGS_ARCHITECTURE.md)  
**Rules:** #14–23 (especially #23)

---

## Checklist (final QA pass)

### Header / Ownership / Architecture
${(bySection.Header?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Ownership?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Architecture?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Tabs
${(bySection.Tabs?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Areas
${(bySection.Business?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Team?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Billing?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Integrations?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Notifications?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Branding?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.AI?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Security?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Permissions?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Rule #23 / Events
${(bySection["Rule 23"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Events?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

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
| Deferred | Live Stripe/Google/Meta/Twilio/Resend · Live webhooks · Live subscription billing |

---

## Module Acceptance Test (MAT)

**Module:** ⚙️ Settings

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

**Deferred:** Live Stripe/Google/Meta/Twilio/Resend · Live webhooks · Live subscription billing

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
fs.writeFileSync(path.join(repoRoot, "docs/operate/SETTINGS_MAT.md"), report);
fs.writeFileSync(path.join(repoRoot, "artifacts/SETTINGS_MAT.json"), JSON.stringify({ accepted, consoleErrors, validatorPass, cmvPass, desktopOk, tabletOk, mobileOk, eventLog, results }, null, 2));
console.log(report.split("\n").slice(0, 180).join("\n"));
console.log(accepted ? "\n✅ MAT ACCEPTED" : "\n❌ MAT NOT ACCEPTED");
process.exit(accepted ? 0 : 1);
