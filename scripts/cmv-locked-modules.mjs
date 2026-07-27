#!/usr/bin/env node
/**
 * Cross-Module Verification (CMV) — locked Operate modules still render.
 * Confirm only — do not modify locked module implementations.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const today = new Date().toISOString().slice(0, 10);

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
    },
    getAttribute(k) {
      if (k === "id") return this.id || null;
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

function mount(id, parent) {
  const n = makeEl("div", id);
  parent.appendChild(n);
  document._byId[id] = n;
  return n;
}

const app = mount("p-app", document.body);
app.classList.add("jos-pixel");
const dash = mount("v-dashboard", app);
mount("jos-dash-root", dash);
const chats = mount("v-chats", app);
mount("jos-inbox-root", chats);
const jobs = mount("v-jobs", app);
mount("jos-jobs-root", jobs);
const leads = mount("v-leads", app);
mount("jos-leads-root", leads);
const cust = mount("v-customers", app);
mount("jos-customers-root", cust);
const pipe = mount("v-pipeline", app);
mount("jos-pipeline-root", pipe);
const editor = mount("v-editor", app);
mount("jos-storefront-root", editor);
const marketing = mount("v-marketing", app);
mount("jos-marketing-root", marketing);
const reviews = mount("v-reviews", app);
mount("jos-reviews-root", reviews);
const memberships = mount("v-memberships", app);
mount("jos-memberships-root", memberships);
mount("bar-title", document.body);
mount("bar-sub", document.body);
mount("nav-leads-badge", document.body);

const state = {
  jobs: [
    { id: "j1", customer: "Sarah Johnson", service: "Interior Detail", amount: 260, date: today, time: "9:00 AM", status: "scheduled", assignedTo: "Maya Chen", address: "Mission Blvd" },
    { id: "j2", customer: "Mike Brown", service: "Exterior Detail", amount: 180, date: today, time: "11:00 AM", status: "completed", assignedTo: "Luis Ortega", address: "Harbor" },
  ],
  customers: [
    { id: "c1", name: "Sarah Johnson", phone: "(619) 555-0198", email: "sarah@ex.com", vehicle: "Tesla Model Y", customerType: "recurring" },
    { id: "c2", name: "Mike Brown", phone: "(619) 555-0142", email: "mike@ex.com", vehicle: "BMW X5" },
  ],
  team: [
    { id: "t1", name: "Adrian Lopez", role: "Owner" },
    { id: "t2", name: "Maya Chen", role: "Technician" },
    { id: "t3", name: "Luis Ortega", role: "Technician" },
  ],
  pipeline: {
    manual: [
      { id: "lead_new", name: "Alex Rivera", phone: "(619) 555-0133", email: "alex@ex.com", service: "Ceramic Coating", vehicle: "Porsche", source: "google", stage: "new", aiQualified: true, aiScore: 88, createdAt: today + "T09:00:00", lastMessage: "Hi" },
    ],
  },
  conversations: [
    { id: "conv1", customer_name: "Alex Rivera", channel: "sms", last_message: "Hello", unread: 1, updated_at: today + "T09:00:00", phone: "(619) 555-0133", messages: [{ dir: "in", text: "Hello", at: "9:00 AM" }] },
  ],
  quotes: [],
  smartQuotes: [],
  city: "San Diego, CA",
  services: [{ name: "Detail" }],
  slug: "demo",
  website: { reviewRating: 4.9 },
};

globalThis.window = {
  document,
  S: state,
  toast() {},
  switchV() {},
  openM() {},
  askAI() {},
  escapeHtml: (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  location: { origin: "https://hubly.test", href: "https://hubly.test/" },
  navigator: { clipboard: { writeText: async () => {} } },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  localStorage: { getItem() { return null; }, setItem() {} },
};
globalThis.document = document;
try {
  globalThis.localStorage = window.localStorage;
} catch (_) {}

const warns = [];
const _warn = console.warn;
console.warn = (...a) => warns.push(a.map(String).join(" "));

eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/design-system.js"), "utf8"));
eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/hubly-events.js"), "utf8"));
eval(fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8"));
const H = window.HublyJourneyOS;

const checks = [];
function ok(name, pass, detail = "") {
  checks.push({ name, pass: !!pass, detail });
}

try {
  H.enhanceDashboard();
  const homeHtml = document.getElementById("jos-dash-root").innerHTML;
  ok("🏠 Home still works", /jos-|Home|KPI|dashboard|Today/i.test(homeHtml) && homeHtml.length > 200, "len=" + homeHtml.length);
} catch (e) {
  ok("🏠 Home still works", false, String(e.message || e));
}

try {
  H.renderInbox();
  const inboxHtml = document.getElementById("jos-inbox-root").innerHTML;
  ok("📥 Inbox still works", /jos-inbox|Inbox|conversation|SMS|Needs/i.test(inboxHtml) && inboxHtml.length > 200, "len=" + inboxHtml.length);
} catch (e) {
  ok("📥 Inbox still works", false, String(e.message || e));
}

try {
  H.renderJobs();
  const jobsHtml = document.getElementById("jos-jobs-root").innerHTML;
  ok("📅 Jobs still works", /jos-jobs|Jobs &|Calendar|Route|Availability/i.test(jobsHtml) && jobsHtml.length > 200, "len=" + jobsHtml.length);
} catch (e) {
  ok("📅 Jobs still works", false, String(e.message || e));
}

try {
  H.renderLeads();
  const leadsHtml = document.getElementById("jos-leads-root").innerHTML;
  ok("🧲 Leads still works", /jos-leads|Leads|New Leads|AI Qualified/i.test(leadsHtml) && leadsHtml.length > 200, "len=" + leadsHtml.length);
} catch (e) {
  ok("🧲 Leads still works", false, String(e.message || e));
}

try {
  H.renderCustomers();
  const custHtml = document.getElementById("jos-customers-root").innerHTML;
  ok("❤️ Customers still works", /jos-cust|Customers|golden|profile/i.test(custHtml) && custHtml.length > 200, "len=" + custHtml.length);
} catch (e) {
  ok("❤️ Customers still works", false, String(e.message || e));
}

try {
  H.renderPipeline();
  const pipeHtml = document.getElementById("jos-pipeline-root").innerHTML;
  ok("🧭 Pipeline still works", /jos-pipe|Pipeline|Lead|Qualified/i.test(pipeHtml) && pipeHtml.length > 200, "len=" + pipeHtml.length);
} catch (e) {
  ok("🧭 Pipeline still works", false, String(e.message || e));
}

try {
  H.renderStorefront();
  const sfHtml = document.getElementById("jos-storefront-root").innerHTML;
  ok("🌐 Storefront still works", /jos-sf|Storefront|Website|Preview/i.test(sfHtml) && sfHtml.length > 200, "len=" + sfHtml.length);
} catch (e) {
  ok("🌐 Storefront still works", false, String(e.message || e));
}

try {
  H.renderMarketing();
  const mktHtml = document.getElementById("jos-marketing-root").innerHTML;
  ok("📣 Marketing still works", /jos-mkt|Marketing|Campaign/i.test(mktHtml) && mktHtml.length > 200, "len=" + mktHtml.length);
} catch (e) {
  ok("📣 Marketing still works", false, String(e.message || e));
}

try {
  H.renderReviews();
  const revHtml = document.getElementById("jos-reviews-root").innerHTML;
  ok("⭐ Reviews still works", /jos-rev|Reviews|Reputation|Inbox/i.test(revHtml) && revHtml.length > 200, "len=" + revHtml.length);
} catch (e) {
  ok("⭐ Reviews still works", false, String(e.message || e));
}

try {
  H.renderMemberships();
  const memHtml = document.getElementById("jos-memberships-root").innerHTML;
  ok("🔁 Memberships still works", /jos-mem|Membership|Plan|Subscriber/i.test(memHtml) && memHtml.length > 200, "len=" + memHtml.length);
} catch (e) {
  ok("🔁 Memberships still works", false, String(e.message || e));
}

console.warn = _warn;
const failed = checks.filter((c) => !c.pass);
const report = `# Cross-Module Verification (CMV)

**Date:** ${today}  
**Runner:** \`node scripts/cmv-locked-modules.mjs\`

| Module | Result |
|--------|--------|
${checks.map((c) => `| ${c.name} | ${c.pass ? "✅" : "❌"}${c.detail ? ` · ${c.detail}` : ""} |`).join("\n")}

**Console warns during CMV:** ${warns.length}

### Result

${failed.length ? "❌ CMV FAIL" : "✅ CMV PASS"}
`;

fs.mkdirSync(path.join(repoRoot, "artifacts"), { recursive: true });
fs.writeFileSync(path.join(repoRoot, "docs/operate/CMV_LOCKED.md"), report);
fs.writeFileSync(path.join(repoRoot, "artifacts/CMV_LOCKED.json"), JSON.stringify({ pass: !failed.length, checks, warns }, null, 2));
console.log(report);
process.exit(failed.length ? 1 : 0);
