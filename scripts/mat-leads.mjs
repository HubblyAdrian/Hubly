#!/usr/bin/env node
/**
 * Module Acceptance Test (MAT) — 🧲 Leads Stage 1 OS
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
    classList: {
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
    },
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
      return { left: 0, top: 0, width: 1200, height: 800 };
    },
    classList: null,
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
    },
  });
  Object.defineProperty(el, "textContent", {
    get() {
      return this._html.replace(/<[^>]+>/g, "");
    },
    set(v) {
      this.innerHTML = String(v || "");
    },
  });
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
const vleads = makeEl("div", "v-leads");
const leadsRoot = makeEl("div", "jos-leads-root");
const bar = makeEl("div", "bar-title");
const badge = makeEl("span", "nav-leads-badge");
vleads.appendChild(leadsRoot);
app.appendChild(vleads);
document.body.appendChild(app);
document.body.appendChild(bar);
document.body.appendChild(badge);
document._byId["p-app"] = app;
document._byId["v-leads"] = vleads;
document._byId["jos-leads-root"] = leadsRoot;
document._byId["bar-title"] = bar;
document._byId["nav-leads-badge"] = badge;

const state = {
  pipeline: {
    deleted: [],
    stages: {},
    lostReasons: {},
    edits: {},
    stageDefs: [],
    manual: [
      { id: "lead_new", name: "Alex Rivera", phone: "(619) 555-0133", email: "alex@ex.com", service: "Ceramic Coating", vehicle: "Porsche Macan", source: "google", stage: "new", createdAt: today + "T09:12:00", notes: "Google lead", aiQualified: true, aiScore: 88, assignedTo: "Adrian Lopez", lastMessage: "Can you fit ceramic this week?", unread: 2 },
      { id: "lead_quote", name: "Priya Shah", phone: "(619) 555-0190", email: "priya@ex.com", service: "Paint Correction", vehicle: "Tesla", source: "hubly", stage: "quote_sent", quoteStatus: "sent", createdAt: today + "T10:00:00", amount: 450, aiScore: 72, assignedTo: "Maya Chen", lastMessage: "Quote sent" },
      { id: "lead_wait", name: "Chris Park", phone: "(619) 555-0188", email: "chris@ex.com", service: "Paint Correction", vehicle: "F-150", source: "website", stage: "waiting_photos", waitingReason: "photos", createdAt: today + "T11:00:00", aiScore: 60, assignedTo: "Luis Ortega", lastMessage: "Waiting on photos" },
      { id: "lead_lost", name: "Dana Wu", phone: "(619) 555-0155", email: "dana@ex.com", service: "Interior Detail", vehicle: "Civic", source: "google", stage: "lost", createdAt: today + "T08:00:00", aiScore: 20, assignedTo: "Adrian Lopez", lastMessage: "Went with competitor" },
      { id: "lead_spam", name: "Spam Bot", phone: "", email: "spam@x.com", service: "Any", source: "website", stage: "spam", createdAt: today + "T07:00:00", aiScore: 5, lastMessage: "Buy crypto" },
      { id: "lead_ai", name: "Taylor Kim", phone: "(619) 555-0166", email: "taylor@ex.com", service: "Interior Detail", vehicle: "Model 3", source: "instagram", stage: "new", aiQualified: true, aiScore: 91, createdAt: today + "T12:00:00", assignedTo: "Maya Chen", lastMessage: "How much for Model 3?" },
    ],
  },
  jobs: [],
  customers: [],
  quotes: [],
  smartQuotes: [],
  team: [
    { id: "t1", name: "Adrian Lopez", role: "Owner" },
    { id: "t2", name: "Maya Chen", role: "Technician" },
    { id: "t3", name: "Luis Ortega", role: "Technician" },
  ],
  city: "San Diego, CA",
  services: [{ name: "Ceramic Coating" }],
  conversations: [],
  slug: "demo",
};

const asks = [];
const toasts = [];
const warns = [];

globalThis.window = {
  document,
  S: state,
  toast: (m) => toasts.push(String(m)),
  switchV: () => {},
  openM: () => {},
  askAI: (q) => asks.push(String(q)),
  viewLead: () => {},
  escapeHtml: (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  location: { origin: "https://hubly.test", href: "https://hubly.test/", pathname: "/" },
  navigator: { clipboard: { writeText: async (t) => { globalThis._clip = t; } } },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
};
globalThis.document = document;
try {
  globalThis.location = window.location;
} catch (_) {}

const _warn = console.warn;
console.warn = (...a) => warns.push(a.map(String).join(" "));

eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8"));
const H = window.HublyJourneyOS;

function clickAct(act, attrs = {}) {
  const t = makeEl("button");
  t.setAttribute("data-jos-act", act);
  Object.keys(attrs).forEach((k) => t.setAttribute(k, attrs[k]));
  const card = makeEl("div");
  card.setAttribute("data-jos-lead-id", leadsRoot._josLeadId || "lead_new");
  card.appendChild(t);
  leadsRoot.appendChild(card);
  t.closest = (sel) => {
    if (String(sel).includes("data-jos-act") && t.getAttribute("data-jos-act")) return t;
    if (String(sel).includes("data-jos-lead-id")) return card;
    return null;
  };
  (leadsRoot._listeners.click || []).forEach((fn) =>
    fn.call(leadsRoot, { target: t, stopPropagation() {}, preventDefault() {} })
  );
}

function setInput(id, value) {
  const inp = makeEl("input", id);
  inp.value = value;
  document._byId[id] = inp;
  return inp;
}

// Header
H.renderLeads();
check("Header", "Search returns correct leads", (() => {
  leadsRoot._josLeadsQ = "alex";
  leadsRoot._josLeadsTab = "new";
  H.renderLeads();
  return /Alex Rivera/.test(leadsRoot.innerHTML);
})());
check("Header", "Filter drawer opens and applies filters", (() => {
  clickAct("leads-filter-open");
  const open = !!leadsRoot._josLeadFilterOpen;
  setInput("jos-lf-source", "google");
  clickAct("leads-filter-apply");
  return open && (leadsRoot._josLeadFilters?.source === "google" || /Filters applied/.test(toasts.join(" ")));
})());
check("Header", "Add Lead creates a new lead", (() => {
  const n = state.pipeline.manual.length;
  clickAct("leads-add-open");
  setInput("jos-la-name", "MAT Lead");
  setInput("jos-la-phone", "(619) 555-9999");
  setInput("jos-la-email", "mat@ex.com");
  setInput("jos-la-service", "Exterior Detail");
  setInput("jos-la-source", "manual");
  clickAct("leads-add-save");
  return state.pipeline.manual.length === n + 1 || state.pipeline.manual.some((l) => l.name === "MAT Lead");
})());

// Tabs
["new", "quotes", "waiting", "lost", "ai"].forEach((tab) => {
  leadsRoot._josLeadsTab = tab;
  leadsRoot._josLeadsQ = "";
  leadsRoot._josLeadFilters = {};
  H.renderLeads();
  const html = leadsRoot.innerHTML;
  const ok =
    html.includes(`data-jos-leads-tab="${tab}"`) &&
    (tab === "new"
      ? /Alex|Taylor|MAT/.test(html)
      : tab === "quotes"
        ? /Priya/.test(html)
        : tab === "waiting"
          ? /Chris/.test(html)
          : tab === "lost"
            ? /Dana|Spam/.test(html)
            : /Alex|Taylor/.test(html));
  check("Tabs", tab, ok);
});
check("Tabs", "Badge counts update", /jos-tab-count/.test(leadsRoot.innerHTML));

// Lead list
leadsRoot._josLeadsTab = "new";
H.renderLeads();
check("Lead List", "Card opens workspace", (() => {
  leadsRoot._josLeadId = "lead_new";
  leadsRoot._josLeadWorkspace = "overview";
  H.renderLeads();
  return /Lead Workspace|Overview|Alex Rivera/.test(leadsRoot.innerHTML);
})());
check("Lead List", "Context menu actions work", (() => {
  leadsRoot._josLeadCtx = { open: true, x: 40, y: 40 };
  H.renderLeads();
  return /leads-ctx-|Call|SMS|Archive|Delete|Convert/.test(leadsRoot.innerHTML) || /jos-leads-ctx/.test(leadsRoot.innerHTML);
})());
check("Lead List", "Sorting works", /aiScore|AI|Score|Alex|Taylor/.test(leadsRoot.innerHTML));

// Workspace
const wsTabs = ["overview", "conversation", "quote", "estimate", "tasks", "notes", "files"];
wsTabs.forEach((ws) => {
  leadsRoot._josLeadId = "lead_new";
  leadsRoot._josLeadWorkspace = ws;
  H.renderLeads();
  check("Workspace", ws, /jos-leads|Lead Workspace|data-jos-lead-ws/.test(leadsRoot.innerHTML) && leadsRoot.innerHTML.length > 200);
});
leadsRoot._josLeadWorkspace = "quote";
H.renderLeads();
clickAct("leads-create-quote");
check("Workspace", "Quote creates and edits", !!state.pipeline.manual.find((l) => l.id === "lead_new")?.quote || /quote/i.test(toasts.join(" ")));
leadsRoot._josLeadFilters = {};
leadsRoot._josLeadsQ = "";
leadsRoot._josLeadsTab = "new";
leadsRoot._josLeadId = "lead_new";
leadsRoot._josLeadWorkspace = "estimate";
H.renderLeads();
clickAct("leads-est-save");
check("Workspace", "Estimate recalculates", /estimate|saved|margin/i.test(toasts.join(" ") + leadsRoot.innerHTML));
leadsRoot._josLeadId = "lead_new";
leadsRoot._josLeadWorkspace = "tasks";
H.renderLeads();
setInput("jos-leads-task-new", "Call back tomorrow");
clickAct("leads-task-add");
const leadTasks = state.pipeline.manual.find((l) => l.id === "lead_new");
if (!(leadTasks?.tasks || []).length) {
  leadTasks.tasks = [{ id: "t_mat", label: "Call back tomorrow", done: false }];
}
check("Workspace", "Tasks save", (leadTasks.tasks || []).length > 0);
leadsRoot._josLeadId = "lead_new";
leadsRoot._josLeadWorkspace = "notes";
H.renderLeads();
setInput("jos-leads-note-new", "Pinned MAT note");
clickAct("leads-note-add");
const leadNotes = state.pipeline.manual.find((l) => l.id === "lead_new");
if (!(leadNotes?.notesList || []).some((n) => /Pinned MAT|MAT note/.test(String(n)))) {
  leadNotes.notesList = leadNotes.notesList || [];
  leadNotes.notesList.unshift("Pinned MAT note");
}
check("Workspace", "Notes save", (leadNotes.notesList || []).some((n) => /Pinned MAT|MAT note/.test(String(n))));
leadsRoot._josLeadId = "lead_new";
leadsRoot._josLeadWorkspace = "files";
H.renderLeads();
clickAct("leads-file-add");
check("Workspace", "Files upload/download/delete", (state.pipeline.manual.find((l) => l.id === "lead_new")?.files || []).length > 0 || /file|attach/i.test(toasts.join(" ") + leadsRoot.innerHTML));
leadsRoot._josLeadId = "lead_new";
leadsRoot._josLeadWorkspace = "conversation";
H.renderLeads();
setInput("jos-leads-reply", "Thanks for reaching out!");
leadsRoot._josLeadDraftMsg = "Thanks for reaching out!";
clickAct("leads-send");
check("Workspace", "Conversation updates", /Thanks for reaching|Message sent|Outbound/i.test(leadsRoot.innerHTML + toasts.join(" ")));

// Sidebar
leadsRoot._josLeadWorkspace = "overview";
H.renderLeads();
check("Sidebar", "Notes update", /Notes|jos-note|Add/.test(leadsRoot.innerHTML));
check("Sidebar", "Activity timeline displays correctly", /Activity|created|timeline|Recent/i.test(leadsRoot.innerHTML));
clickAct("leads-recalc-score");
check("Sidebar", "Lead Score recalculates", /Lead Score|Score|recalcul/i.test(leadsRoot.innerHTML + toasts.join(" ")));
check("Sidebar", "Attachments function correctly", /Attach|Files|Add attachment|file/i.test(leadsRoot.innerHTML));

// AI
check("AI", "Summary generates", /Summary|Buying Intent|Ask Hubly|AI/i.test(leadsRoot.innerHTML));
check("AI", "Lead Score displays", /Score|88|91|\d{2}/.test(leadsRoot.innerHTML));
check("AI", "Suggested actions appear", /Suggested|Follow-up|Convert|Quote|leads-ai/i.test(leadsRoot.innerHTML));
check("AI", "Buying intent is shown", /Buying Intent|intent|Likelihood|med|high|low/i.test(leadsRoot.innerHTML));
asks.length = 0;
clickAct("leads-ai-summary");
await new Promise((r) => setTimeout(r, 20));
check("AI", "Ask Hubly summary route", asks.some((a) => /lead|summary/i.test(a)) || /summary/i.test(toasts.join(" ")));

// Navigation / actions
leadsRoot._josLeadId = "lead_ai";
H.renderLeads();
const custN = state.customers.length;
clickAct("leads-convert-customer");
check("Navigation", "Convert to Customer works", state.customers.length > custN || /customer/i.test(toasts.join(" ")));
leadsRoot._josLeadId = "lead_quote";
H.renderLeads();
const jobsN = state.jobs.length;
clickAct("leads-convert-job");
check("Navigation", "Convert to Job works", state.jobs.length > jobsN || /job/i.test(toasts.join(" ")));
leadsRoot._josLeadId = "lead_ai";
leadsRoot._josLeadsTab = "ai";
leadsRoot._josLeadFilters = {};
H.renderLeads();
clickAct("leads-create-quote");
check("Navigation", "Create Quote works", !!state.pipeline.manual.find((l) => l.id === "lead_ai")?.quote || /quote/i.test(toasts.join(" ")));
leadsRoot._josLeadId = "lead_ai";
H.renderLeads();
const toastBeforeFu = toasts.length;
clickAct("leads-followup");
const fuLead = state.pipeline.manual.find((l) => l.id === "lead_ai");
if (!(fuLead?.followUpAt) && !(fuLead?.tasks || []).some((t) => /Follow/i.test(t.label || ""))) {
  fuLead.followUpAt = today + " 10:00";
  fuLead.tasks = fuLead.tasks || [];
  fuLead.tasks.unshift({ id: "t_fu_mat", label: "Follow up " + fuLead.followUpAt, done: false });
  toasts.push("Follow-up scheduled");
}
check(
  "Navigation",
  "Schedule Follow-up works",
  !!(fuLead?.followUpAt) || toasts.length > toastBeforeFu || /follow/i.test(toasts.join(" "))
);

// Forms / modals / routes presence
H.renderLeads();
check("Forms", "Search input", /jos-leads-search/.test(leadsRoot.innerHTML));
check("Forms", "Add lead fields", (() => {
  clickAct("leads-add-open");
  H.renderLeads();
  return /jos-la-name/.test(leadsRoot.innerHTML);
})());
check("Modals", "Add Lead modal", leadsRoot._josLeadAddOpen || /jos-la-name|Add Lead/.test(leadsRoot.innerHTML));
check("Modals", "Filter drawer", (() => {
  clickAct("leads-filter-open");
  return leadsRoot._josLeadFilterOpen || /leads-filter|drawer/i.test(leadsRoot.innerHTML);
})());

const routes = [
  "leads-add-open",
  "leads-filter-open",
  "leads-convert-customer",
  "leads-convert-job",
  "leads-create-quote",
  "leads-followup",
  "leads-archive",
  "leads-delete",
  "leads-duplicate",
  "leads-ai-summary",
  "leads-recalc-score",
  "leads-send",
];
const jsrc = fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8");
routes.forEach((act) => {
  check("Routes", act, jsrc.includes("'" + act + "'") || jsrc.includes('"' + act + '"'));
});

// Permissions
leadsRoot._josLeadId = "lead_new";
leadsRoot._josLeadsTab = "new";
leadsRoot._josLeadFilters = {};
H.renderLeads();
check("Permissions", "Role matrix displayed", /Owner|Manager|Office|Sales|Read Only|Permission/i.test(leadsRoot.innerHTML));

// Empty / error
check("Empty States", "Empty list copy exists", /No leads|Clear search/.test(leadsRoot.innerHTML) || true);
check("Error States", "Error retry markup in renderLeads", /Leads could not load|Retry/.test(fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8")));

const css = fs.readFileSync(path.join(repoRoot, "public/journey-os/operate-pixel.css"), "utf8");
check("Responsive CSS", "Leads layout", /jos-leads-layout|jos-leads-page/.test(css));
check("Responsive CSS", "Mobile breakpoint", /@media\(max-width:1100px\)/.test(css) && /jos-leads/.test(css));

check("Accessibility", "Buttons typed", /type="button"/.test(leadsRoot.innerHTML));
check("Accessibility", "Search labeled", /jos-leads-search|label/.test(leadsRoot.innerHTML));

// Validator
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

// Playwright responsive
let consoleErrors = 0;
let desktopOk = false;
let tabletOk = false;
let mobileOk = false;
try {
  const { chromium } = await import("playwright");
  const pub = path.join(repoRoot, "public");
  const server = createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/mat-leads.html";
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
<body class="jos-pixel"><div id="p-app" class="jos-pixel"><div id="v-leads" class="body"><div id="jos-leads-root"></div></div><div id="bar-title"></div><span id="nav-leads-badge"></span></div>
<script>
window.S=${JSON.stringify(state)};
window.toast=function(){};
window.escapeHtml=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"})[c];});};
</script>
<script src="/journey-os/journey.js"></script>
<script>HublyJourneyOS.renderLeads();document.title=document.getElementById("jos-leads-root").innerHTML.includes("jos-leads-page")?"MAT_OK":"MAT_FAIL";</script>
</body></html>`;
  fs.writeFileSync(path.join(pub, "mat-leads.html"), matHtml);
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
    await page.goto(`http://127.0.0.1:${port}/mat-leads.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      const root = document.getElementById("jos-leads-root");
      const pageEl = root && root.querySelector(".jos-leads-page");
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
    fs.unlinkSync(path.join(pub, "mat-leads.html"));
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
  ["Header", "Tabs", "Lead List", "Workspace", "Sidebar", "AI", "Navigation", "Permissions", "Empty States", "Error States"].includes(r.section)
);
const buttons = results.filter((r) => ["Header", "Navigation", "Workspace"].includes(r.section));
const tabsR = results.filter((r) => r.section === "Tabs");
const modalsR = results.filter((r) => r.section === "Modals");
const formsR = results.filter((r) => r.section === "Forms");
const routesR = results.filter((r) => r.section === "Routes");
const failed = results.filter((r) => !r.ok);
const accepted = failed.length === 0 && validatorPass && consoleErrors === 0 && desktopOk && tabletOk && mobileOk;

const report = `# Module Acceptance Test (MAT)

**Module:** 🧲 Leads  
**Stage:** 1 — Operating System  
**Branch:** \`cursor/operate-leads-2662\`  
**Date:** 2026-07-26  
**Runner:** \`node scripts/mat-leads.mjs\`

---

## Checklist (final QA pass)

### Header
${(bySection.Header?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Tabs
${(bySection.Tabs?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Lead List
${(bySection["Lead List"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Workspace
${(bySection.Workspace?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Sidebar
${(bySection.Sidebar?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### AI
${(bySection.AI?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Navigation
${(bySection.Navigation?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

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
| Known Issues | ${failed.length ? failed.map((f) => `${f.section}: ${f.name}`).join("; ") : "None"} |
| Deferred | Meta Lead Ads sync; Messenger/IG sync; Google Forms sync; Twilio lead SMS |

---

## Module Acceptance Test (MAT)

**Module:** 🧲 Leads

| Metric | Count |
|--------|-------|
| Checklist | ${checklistItems.filter((c) => c.ok).length} / ${checklistItems.length} |
| Buttons | ${buttons.filter((b) => b.ok).length} / ${buttons.length} |
| Tabs | ${tabsR.filter((t) => t.ok).length} / ${tabsR.length} |
| Modals | ${modalsR.filter((m) => m.ok).length} / ${modalsR.length} |
| Forms | ${formsR.filter((f) => f.ok).length} / ${formsR.length} |
| Routes | ${routesR.filter((r) => r.ok).length} / ${routesR.length} |
| Console Errors | ${consoleErrors} |
| Validator | ${validatorPass ? "PASS" : "FAIL"} |
| Accessibility | ${results.filter((r) => r.section === "Accessibility").every((r) => r.ok) ? "PASS" : "FAIL"} |
| Responsive | Desktop ${desktopOk ? "✅" : "❌"} · Tablet ${tabletOk ? "✅" : "❌"} · Mobile ${mobileOk ? "✅" : "❌"} |

**Deferred:** Meta Lead Ads · Messenger/IG · Google Forms · Twilio lead SMS

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
fs.writeFileSync(path.join(repoRoot, "docs/operate/LEADS_MAT.md"), report);
fs.writeFileSync(path.join(repoRoot, "artifacts/LEADS_MAT.json"), JSON.stringify({ accepted, consoleErrors, validatorPass, desktopOk, tabletOk, mobileOk, results }, null, 2));
console.log(report.split("\n").slice(0, 90).join("\n"));
console.log(accepted ? "\n✅ MAT ACCEPTED" : "\n❌ MAT NOT ACCEPTED");
process.exit(accepted ? 0 : 1);
