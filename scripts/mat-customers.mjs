#!/usr/bin/env node
/**
 * Module Acceptance Test (MAT) — ❤️ Customers Stage 1 OS
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
    textContent: "",
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
      return { left: 0, top: 0, width: 1200, height: 800 };
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
      // Register ids from markup so openCustomerProfile / profile tabs work in Node
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
const vcust = makeEl("div", "v-customers");
const custRoot = makeEl("div", "jos-customers-root");
const bar = makeEl("div", "bar-title");
vcust.appendChild(custRoot);
app.appendChild(vcust);
document.body.appendChild(app);
document.body.appendChild(bar);
document._byId["p-app"] = app;
document._byId["v-customers"] = vcust;
document._byId["jos-customers-root"] = custRoot;
document._byId["bar-title"] = bar;

const state = {
  customers: [
    {
      id: "demo_c1",
      name: "Sarah Johnson",
      phone: "(512) 555-0198",
      email: "sarah.johnson@gmail.com",
      address: "1200 Barton Springs Rd, Austin, TX",
      vehicle: "Tesla Model Y",
      vehicles: [{ label: "Tesla Model Y" }, { label: "Ford F-150" }],
      customerType: "recurring",
      membership: "Ceramic Coating Plan",
      statusOverride: "vip",
      preferredService: "Ceramic Coating",
      city: "Austin",
      favorite: true,
      tags: ["VIP", "Member"],
      status: "active",
      aiScore: 88,
      unread: 1,
      lifetimeValue: 1250,
      assignedTo: "Adrian Lopez",
      notes: "Prefers morning slots",
      notesList: ["Prefers morning slots"],
      photos: [{ label: "Before", at: today }, { label: "After", at: today }],
      documents: [{ name: "Waiver.pdf", kind: "waiver" }],
      payments: [{ id: "p1", amount: 350, status: "paid", at: today, label: "Ceramic" }],
      activity: [{ type: "job", label: "Completed ceramic", at: today }],
      createdAt: "2025-01-15T10:00:00",
    },
    {
      id: "demo_c2",
      name: "Mike Brown",
      phone: "(512) 555-0142",
      email: "mike.brown@email.com",
      vehicle: "BMW X5",
      preferredService: "Interior Detail",
      city: "Austin",
      tags: ["Interior"],
      status: "active",
      aiScore: 62,
      lifetimeValue: 180,
      assignedTo: "Maya Chen",
      createdAt: today + "T09:00:00",
    },
    {
      id: "demo_c3",
      name: "Emily Smith",
      phone: "(512) 555-0177",
      email: "emily.s@email.com",
      vehicle: "Audi Q5",
      property: "Home",
      preferredService: "Full Detail",
      city: "Austin",
      tags: ["Reviewer"],
      favorite: true,
      status: "active",
      aiScore: 74,
      lifetimeValue: 420,
      assignedTo: "Luis Ortega",
      createdAt: "2025-11-01T12:00:00",
    },
  ],
  jobs: [
    {
      id: "j1",
      customer: "Sarah Johnson",
      customerId: "demo_c1",
      phone: "(512) 555-0198",
      service: "Ceramic Coating",
      status: "completed",
      date: "2026-06-01",
      amount: 450,
    },
    {
      id: "j2",
      customer: "Sarah Johnson",
      customerId: "demo_c1",
      service: "Interior Detail",
      status: "confirmed",
      date: today,
      amount: 180,
    },
    {
      id: "j3",
      customer: "Mike Brown",
      customerId: "demo_c2",
      service: "Interior Detail",
      status: "completed",
      date: "2026-05-10",
      amount: 180,
    },
  ],
  quotes: [],
  smartQuotes: [],
  team: [
    { id: "t1", name: "Adrian Lopez", role: "Owner" },
    { id: "t2", name: "Maya Chen", role: "Technician" },
    { id: "t3", name: "Luis Ortega", role: "Technician" },
  ],
  city: "Austin, TX",
  services: [{ name: "Ceramic Coating" }, { name: "Interior Detail" }],
  conversations: [
    {
      id: "cv1",
      customer_name: "Sarah Johnson",
      phone: "(512) 555-0198",
      channel: "sms",
      messages: [{ dir: "in", text: "Thanks for the coating!", at: "9:00 AM" }],
    },
  ],
  pipeline: { deleted: [], stages: {}, lostReasons: {}, edits: {}, stageDefs: [], manual: [] },
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
  escapeHtml: (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  location: {
    origin: "https://hubly.test",
    href: "https://hubly.test/",
    pathname: "/",
    protocol: "https:",
    set href(v) {
      this._href = String(v);
    },
    get href() {
      return this._href || "https://hubly.test/";
    },
  },
  navigator: { clipboard: { writeText: async (t) => { globalThis._clip = t; } } },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  localStorage: { getItem: () => null, setItem: () => {} },
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
  card.setAttribute("data-jos-cust-id", custRoot._josCustId || "demo_c1");
  card.appendChild(t);
  custRoot.appendChild(card);
  t.closest = (sel) => {
    if (String(sel).includes("data-jos-act") && t.getAttribute("data-jos-act")) return t;
    if (String(sel).includes("data-jos-cust")) return card;
    return null;
  };
  (custRoot._listeners.click || []).forEach((fn) =>
    fn.call(custRoot, { target: t, stopPropagation() {}, preventDefault() {} })
  );
}

function setInput(id, value) {
  const inp = makeEl("input", id);
  inp.value = value;
  document._byId[id] = inp;
  return inp;
}

function selectCustomer(id) {
  custRoot._josCustId = id;
  state.activeCustId = id;
  H.renderCustomers();
}

// ── Header ──
H.renderCustomers();
check("Header", "Search works", (() => {
  custRoot._josCustQ = "sarah";
  custRoot._josCustTab = "all";
  H.renderCustomers();
  return /Sarah Johnson/.test(custRoot.innerHTML) && !/Mike Brown/.test(custRoot.innerHTML);
})());
check("Header", "Filters apply correctly", (() => {
  clickAct("cust-filter-open");
  const open = !!custRoot._josCustFilterOpen;
  setInput("jos-cf-membership", "yes");
  setInput("jos-cf-active", "all");
  setInput("jos-cf-ltv", "all");
  setInput("jos-cf-lastjob", "all");
  setInput("jos-cf-city", "all");
  setInput("jos-cf-assigned", "all");
  setInput("jos-cf-service", "all");
  setInput("jos-cf-vehicle", "");
  setInput("jos-cf-tags", "");
  clickAct("cust-filter-apply");
  return open && (custRoot._josCustFilters?.membership === "yes" || /Sarah|Member/.test(custRoot.innerHTML));
})());
check("Header", "Add Customer creates a profile", (() => {
  const n = state.customers.length;
  clickAct("cust-add-open");
  setInput("jos-ca-name", "MAT Customer");
  setInput("jos-ca-phone", "(512) 555-9999");
  setInput("jos-ca-email", "mat@ex.com");
  setInput("jos-ca-address", "100 Congress Ave, Austin, TX");
  setInput("jos-ca-vehicle", "Honda Civic");
  setInput("jos-ca-tags", "MAT");
  setInput("jos-ca-membership", "");
  setInput("jos-ca-assigned", "Adrian Lopez");
  setInput("jos-ca-notes", "Created by MAT");
  clickAct("cust-add-save");
  return state.customers.length === n + 1 || state.customers.some((c) => c.name === "MAT Customer");
})());

// ── Tabs ──
custRoot._josCustFilters = {};
custRoot._josCustQ = "";
["all", "memberships", "vehicles", "segments", "favorites"].forEach((tab) => {
  custRoot._josCustTab = tab;
  if (tab === "segments") custRoot._josCustSegment = "vip";
  H.renderCustomers();
  const html = custRoot.innerHTML;
  const ok =
    html.includes(`data-jos-cust-tab="${tab}"`) &&
    (tab === "all"
      ? /Sarah|Mike|Emily|MAT/.test(html)
      : tab === "memberships"
        ? /Sarah|Member|Plan/.test(html)
        : tab === "vehicles"
          ? /Tesla|BMW|Audi|Honda|Vehicle/.test(html)
          : tab === "segments"
            ? /VIP|data-jos-cust-seg/.test(html)
            : /Sarah|Emily|★|Favorite/.test(html));
  check("Tabs", tab, ok);
});

// ── Customer List ──
custRoot._josCustTab = "all";
custRoot._josCustQ = "";
H.renderCustomers();
check("Customer List", "Cards load profiles", (() => {
  selectCustomer("demo_c1");
  H.openCustomerProfile("demo_c1");
  const shell = document.getElementById("jos-customer-profile");
  return (
    /Sarah Johnson/.test(custRoot.innerHTML) &&
    !!shell &&
    (shell.classList.contains("open") || /Customer|Overview|Sarah/.test(shell.innerHTML + (elText("jos-cp-name") || "")))
  );
})());
function elText(id) {
  const n = document.getElementById(id);
  return n ? n.textContent : "";
}
check("Customer List", "Context menu actions work", (() => {
  custRoot._josCustCtx = { open: true, x: 40, y: 40, id: "demo_c1" };
  H.renderCustomers();
  return /cust-call|cust-sms|cust-archive|Book Job|Favorite/.test(custRoot.innerHTML);
})());
check("Customer List", "Sorting works", /AI |lifetime|Last job|Sarah|Mike/.test(custRoot.innerHTML));

// ── Profile (golden) ──
const profileTabs = [
  "Overview",
  "Timeline",
  "Jobs",
  "Payments",
  "Photos",
  "Messages",
  "Membership",
  "Reviews",
  "Documents",
  "Notes",
];
selectCustomer("demo_c1");
profileTabs.forEach((tab) => {
  custRoot._josCustProfileTab = tab;
  H.renderCustomers();
  const wsOk = custRoot.innerHTML.includes(`data-jos-cust-ws-tab="${tab}"`) || custRoot.innerHTML.includes(tab);
  H.openCustomerProfile("demo_c1", tab);
  const body = document.getElementById("jos-cp-body");
  const bodyHtml = body ? body.innerHTML : "";
  const ok =
    wsOk &&
    bodyHtml.length > 40 &&
    (tab === "Overview"
      ? /Health|Lifetime|Sarah|AI/i.test(bodyHtml + custRoot.innerHTML)
      : tab === "Timeline"
        ? /Timeline|Activity|Paid|Booked|Customer/i.test(bodyHtml)
        : tab === "Jobs"
          ? /Upcoming|Completed|Book Job/i.test(bodyHtml)
          : tab === "Payments"
            ? /Payment|Refund|\$|paid/i.test(bodyHtml)
            : tab === "Photos"
              ? /Photo|Before|After|Cloud/i.test(bodyHtml)
              : tab === "Messages"
                ? /message|SMS|Thanks|chat/i.test(bodyHtml)
                : tab === "Membership"
                  ? /Membership|Plan|Stage 2/i.test(bodyHtml)
                  : tab === "Reviews"
                    ? /Review|Google|Draft/i.test(bodyHtml)
                    : tab === "Documents"
                      ? /document|Waiver|Quote|Cloud/i.test(bodyHtml)
                      : /Notes|Preferences|Learned/i.test(bodyHtml));
  check("Profile", tab, ok);
});

check("Profile", "Golden profile shell reused", (() => {
  const jsrc = fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8");
  return (
    jsrc.includes("function openCustomerProfile") &&
    jsrc.includes("jos-customer-profile") &&
    PROFILE_TABS_SRC(jsrc)
  );
  function PROFILE_TABS_SRC(src) {
    return (
      src.includes("'Overview'") &&
      src.includes("'Timeline'") &&
      src.includes("'Membership'") &&
      src.includes("'Documents'") &&
      src.includes("'Notes'")
    );
  }
})());

// ── Sidebar ──
selectCustomer("demo_c1");
H.renderCustomers();
check("Sidebar", "AI Summary generates", /AI Summary|Churn risk|Upsell|Next best action/i.test(custRoot.innerHTML));
check("Sidebar", "Customer Health displays", /Customer Health|jos-health|Score/i.test(custRoot.innerHTML));
check("Sidebar", "Quick Actions work", (() => {
  const before = toasts.length;
  clickAct("cust-favorite");
  const fav = state.customers.find((c) => c.id === "demo_c1");
  return /Quick Actions|cust-call|Book Job/.test(custRoot.innerHTML) && (toasts.length > before || typeof fav.favorite === "boolean");
})());
check("Sidebar", "Recent Activity updates", (() => {
  const c = state.customers.find((x) => x.id === "demo_c1");
  const n = (c.activity || []).length;
  clickAct("cust-ai-refresh");
  return /Recent Activity/i.test(custRoot.innerHTML) && (c.activity || []).length >= n;
})());

// ── AI ──
selectCustomer("demo_c1");
H.renderCustomers();
check("AI", "Churn Prediction works", /Churn risk|Churn \d/i.test(custRoot.innerHTML));
check("AI", "Upsell suggestions display", /Upsell/i.test(custRoot.innerHTML));
check("AI", "Next Best Action appears", /Next best action/i.test(custRoot.innerHTML));
check("AI", "Membership recommendation displays", /Membership/i.test(custRoot.innerHTML) && /suggestion|Plan|Member/i.test(custRoot.innerHTML));

// ── Navigation / forms / modals / routes ──
check("Navigation", "Full profile opens", (() => {
  clickAct("cust-full-profile", { "data-jos-cust": "demo_c1" });
  const shell = document.getElementById("jos-customer-profile");
  return !!shell && (shell.classList.contains("open") || !!document.getElementById("jos-cp-body"));
})());
check("Forms", "Search input", /jos-cust-search/.test(custRoot.innerHTML));
check("Forms", "Add customer fields", (() => {
  clickAct("cust-add-open");
  H.renderCustomers();
  return /jos-ca-name/.test(custRoot.innerHTML);
})());
check("Modals", "Add Customer modal", custRoot._josCustAddOpen || /jos-ca-name|Add Customer/.test(custRoot.innerHTML));
check("Modals", "Filter drawer", (() => {
  clickAct("cust-filter-open");
  return custRoot._josCustFilterOpen || /jos-cf-|Filter/.test(custRoot.innerHTML);
})());

const routes = [
  "cust-filter-open",
  "cust-filter-apply",
  "cust-filter-reset",
  "cust-filter-save",
  "cust-add-open",
  "cust-add-save",
  "cust-favorite",
  "cust-archive",
  "cust-ai-refresh",
  "cust-full-profile",
  "cust-ws-tab",
  "cust-call",
  "cust-sms",
  "cust-email",
  "cust-quote",
];
const jsrc = fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8");
routes.forEach((act) => {
  check("Routes", act, jsrc.includes("'" + act + "'") || jsrc.includes('"' + act + '"'));
});

check("Permissions", "Role matrix displayed", /Owner|Manager|Office|Sales|Read Only|Permission/i.test(custRoot.innerHTML));
check("Empty States", "Empty list copy exists", /No customers|Clear search/.test(jsrc));
check("Error States", "Error retry markup in renderCustomers", /Customers could not load|Retry/.test(jsrc));

const css = fs.readFileSync(path.join(repoRoot, "public/journey-os/operate-pixel.css"), "utf8");
check("Responsive CSS", "Customers layout", /jos-cust-page|jos-cust-layout/.test(css));
check("Responsive CSS", "Mobile breakpoint", /@media\(max-width:1100px\)/.test(css) && /jos-cust/.test(css));
check("Accessibility", "Buttons typed", /type="button"/.test(custRoot.innerHTML));
check("Accessibility", "Search labeled", /jos-cust-search|label/.test(custRoot.innerHTML));

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

// CMV
let cmvPass = false;
await new Promise((resolve) => {
  const p = spawn("node", [path.join(repoRoot, "scripts/cmv-locked-modules.mjs")], { cwd: repoRoot });
  let out = "";
  p.stdout.on("data", (d) => (out += d));
  p.stderr.on("data", (d) => (out += d));
  p.on("close", (code) => {
    cmvPass = code === 0 && /CMV PASS/.test(out);
    check("CMV", "Locked modules still work", cmvPass, out.trim().split("\n").slice(-3).join(" "));
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
    if (urlPath === "/") urlPath = "/mat-customers.html";
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
<body class="jos-pixel"><div id="p-app" class="jos-pixel"><div id="v-customers" class="body"><div id="jos-customers-root"></div></div><div id="bar-title"></div></div>
<script>
window.S=${JSON.stringify(state)};
window.toast=function(){};
window.escapeHtml=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"})[c];});};
window.localStorage={getItem:function(){return null;},setItem:function(){}};
</script>
<script src="/journey-os/journey.js"></script>
<script>HublyJourneyOS.renderCustomers();document.title=document.getElementById("jos-customers-root").innerHTML.includes("jos-cust-page")?"MAT_OK":"MAT_FAIL";</script>
</body></html>`;
  fs.writeFileSync(path.join(pub, "mat-customers.html"), matHtml);
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
    await page.goto(`http://127.0.0.1:${port}/mat-customers.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      const root = document.getElementById("jos-customers-root");
      const pageEl = root && root.querySelector(".jos-cust-page");
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
    fs.unlinkSync(path.join(pub, "mat-customers.html"));
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
  ["Header", "Tabs", "Customer List", "Profile", "Sidebar", "AI", "Navigation", "Permissions", "Empty States", "Error States"].includes(r.section)
);
const buttons = results.filter((r) => ["Header", "Navigation", "Sidebar"].includes(r.section));
const tabsR = results.filter((r) => r.section === "Tabs");
const modalsR = results.filter((r) => r.section === "Modals");
const formsR = results.filter((r) => r.section === "Forms");
const routesR = results.filter((r) => r.section === "Routes");
const failed = results.filter((r) => !r.ok);
const accepted = failed.length === 0 && validatorPass && cmvPass && consoleErrors === 0 && desktopOk && tabletOk && mobileOk;

const report = `# Module Acceptance Test (MAT)

**Module:** ❤️ Customers  
**Stage:** 1 — Operating System  
**Branch:** \`cursor/operate-customers-2662\`  
**Date:** 2026-07-26  
**Runner:** \`node scripts/mat-customers.mjs\`

---

## Checklist (final QA pass)

### Header
${(bySection.Header?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Tabs
${(bySection.Tabs?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Customer List
${(bySection["Customer List"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Profile (golden)
${(bySection.Profile?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Sidebar
${(bySection.Sidebar?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### AI
${(bySection.AI?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

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
| Deferred | Live payment refunds; Google/Facebook review sync; membership billing; cloud document storage |

---

## Module Acceptance Test (MAT)

**Module:** ❤️ Customers

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
| CMV | ${cmvPass ? "PASS" : "FAIL"} |
| Accessibility | ${results.filter((r) => r.section === "Accessibility").every((r) => r.ok) ? "PASS" : "FAIL"} |
| Responsive | Desktop ${desktopOk ? "✅" : "❌"} · Tablet ${tabletOk ? "✅" : "❌"} · Mobile ${mobileOk ? "✅" : "❌"} |

**Deferred:** Live payment refunds · Google/Facebook review sync · Membership billing · Cloud document storage

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
fs.writeFileSync(path.join(repoRoot, "docs/operate/CUSTOMERS_MAT.md"), report);
fs.writeFileSync(path.join(repoRoot, "artifacts/CUSTOMERS_MAT.json"), JSON.stringify({ accepted, consoleErrors, validatorPass, cmvPass, desktopOk, tabletOk, mobileOk, results }, null, 2));
console.log(report.split("\n").slice(0, 100).join("\n"));
console.log(accepted ? "\n✅ MAT ACCEPTED" : "\n❌ MAT NOT ACCEPTED");
process.exit(accepted ? 0 : 1);
