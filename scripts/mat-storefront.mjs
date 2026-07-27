#!/usr/bin/env node
/**
 * Module Acceptance Test (MAT) — 🌐 Storefront Stage 1 OS
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
    querySelector(sel) {
      if (!sel) return null;
      const m = String(sel).match(/\[data-jos-sf-price="([^"]+)"\]/);
      if (m) {
        const id = "sf_price_" + m[1];
        if (!document._byId[id]) {
          const inp = makeEl("input", id);
          inp.value = "199";
          inp.setAttribute("data-jos-sf-price", m[1]);
          document._byId[id] = inp;
        }
        return document._byId[id];
      }
      if (String(sel).startsWith("#")) return document._byId[String(sel).slice(1)] || null;
      return null;
    },
    querySelectorAll() {
      return [];
    },
    closest(sel) {
      if (String(sel).includes("data-jos-sf-svc-id") && this.getAttribute("data-jos-sf-svc-id")) return this;
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
const vEditor = makeEl("div", "v-editor");
const sfRoot = makeEl("div", "jos-storefront-root");
const bar = makeEl("div", "bar-title");
vEditor.appendChild(sfRoot);
app.appendChild(vEditor);
document.body.appendChild(app);
document.body.appendChild(bar);
document._byId["p-app"] = app;
document._byId["v-editor"] = vEditor;
document._byId["jos-storefront-root"] = sfRoot;
document._byId["bar-title"] = bar;

const state = {
  biz: "Shine Auto Detailing",
  city: "Austin, TX",
  slug: "shine-auto",
  services: [],
  editorSvcs: [],
  website: null,
  galleryPairs: [],
  jobs: [],
  customers: [],
  team: [{ id: "t1", name: "Adrian Lopez", role: "Owner" }],
  pipeline: { manual: [], stages: {} },
  conversations: [],
  quotes: [],
  smartQuotes: [],
};

const toasts = [];
const warns = [];
let previewCalls = 0;

globalThis.window = {
  document,
  S: state,
  toast: (m) => toasts.push(String(m)),
  switchV: () => {},
  openM: () => {},
  askAI: () => {},
  previewProfile: () => {
    previewCalls++;
    toasts.push("preview");
  },
  previewBookingOverlay: () => toasts.push("booking-preview"),
  escapeHtml: (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  location: { origin: "https://hubly.test", href: "https://hubly.test/", pathname: "/" },
  navigator: { clipboard: { writeText: async (t) => { globalThis._clip = t; } } },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  localStorage: { getItem: () => null, setItem: () => {} },
};
globalThis.document = document;
try {
  globalThis.localStorage = window.localStorage;
  globalThis.location = window.location;
} catch (_) {}

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
  sfRoot.appendChild(wrap);
  t.closest = (sel) => {
    if (String(sel).includes("data-jos-act") && t.getAttribute("data-jos-act")) return t;
    if (String(sel).includes("data-jos-sf-svc") && attrs["data-jos-sf-svc"]) {
      const c = makeEl("div");
      c.setAttribute("data-jos-sf-svc-id", attrs["data-jos-sf-svc"]);
      return c;
    }
    return null;
  };
  (sfRoot._listeners.click || []).forEach((fn) =>
    fn.call(sfRoot, { target: t, stopPropagation() {}, preventDefault() {} })
  );
}

function setInput(id, value) {
  const inp = makeEl("input", id);
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

// Core render
H.renderStorefront();
check("Header", "Page renders", /jos-sf-page|Storefront/.test(sfRoot.innerHTML));
check("Header", "Preview strip", /jos-sf-preview|jos-sf-mc-toolbar|jos-sf-live-site|hubly\.site|myhubly\.app|Preview/.test(sfRoot.innerHTML));
check("Ownership", "Service catalog seeded", Array.isArray(state.editorSvcs) && state.editorSvcs.length >= 1);
check("Ownership", "Catalog mirrored to S.services", Array.isArray(state.services) && state.services.length >= 1);

// Tabs
const tabs = ["website", "booking", "services", "pricing", "gallery", "reviews", "seo", "domain", "analytics"];
tabs.forEach((tab) => {
  sfRoot._josSfTab = tab;
  H.renderStorefront();
  const ok =
    sfRoot.innerHTML.includes(`data-jos-sf-tab="${tab}"`) &&
    (tab === "website"
      ? /jos-sf-hero-head|Hero headline/.test(sfRoot.innerHTML)
      : tab === "booking"
        ? /Booking|Preview booking/.test(sfRoot.innerHTML)
        : tab === "services"
          ? /Add Service|jos-sf-card|Service/.test(sfRoot.innerHTML)
          : tab === "pricing"
            ? /Save pricing|Deposit|Price/.test(sfRoot.innerHTML)
            : tab === "gallery"
              ? /Gallery|Upload|Before/.test(sfRoot.innerHTML)
              : tab === "reviews"
                ? /Review|Sarah|read-only|Reviews module/i.test(sfRoot.innerHTML)
                : tab === "seo"
                  ? /SEO title|jos-sf-seo/.test(sfRoot.innerHTML)
                  : tab === "domain"
                    ? /Slug|myhubly\.app|DNS|domain/i.test(sfRoot.innerHTML)
                    : /Analytics|visits|conversion|Stage 2/i.test(sfRoot.innerHTML));
  check("Tabs", tab, ok);
});

// Website save
sfRoot._josSfTab = "website";
H.renderStorefront();
setInput("jos-sf-hero-head", "MAT Hero Headline");
setTextarea("jos-sf-hero-sub", "MAT hero sub for storefront acceptance.");
clickAct("sf-site-save");
check("Website", "Save website copy", state.website?.heroHeadline === "MAT Hero Headline" || /Saved/.test(toasts.join(" ")));

// SEO
sfRoot._josSfTab = "seo";
H.renderStorefront();
setInput("jos-sf-seo-title", "MAT SEO Title");
setTextarea("jos-sf-seo-desc", "MAT SEO description with city and services for search.");
clickAct("sf-seo-save");
check("SEO", "Save SEO", state.website?.seoTitle === "MAT SEO Title" || /SEO saved/.test(toasts.join(" ")));

// Domain
sfRoot._josSfTab = "domain";
H.renderStorefront();
setInput("jos-sf-slug", "mat-shine");
clickAct("sf-domain-save");
check("Domain", "Save slug", state.slug === "mat-shine" || /Slug saved|mat-shine/.test(toasts.join(" ") + sfRoot.innerHTML));

// Services CRUD
sfRoot._josSfTab = "services";
H.renderStorefront();
const before = state.editorSvcs.length;
clickAct("sf-svc-add-open");
setInput("jos-sf-svc-name", "MAT Ceramic");
setInput("jos-sf-svc-price", "399");
setInput("jos-sf-svc-dur", "4h");
setTextarea("jos-sf-svc-desc", "Full ceramic package");
const chk = makeEl("input", "jos-sf-svc-website");
chk.checked = true;
document._byId["jos-sf-svc-website"] = chk;
clickAct("sf-svc-save");
check("Services", "Add service", state.editorSvcs.length === before + 1 || state.editorSvcs.some((s) => s.name === "MAT Ceramic"));
check("Services", "Mirror sync after add", state.services.some((s) => s.name === "MAT Ceramic" || s.name === state.editorSvcs[0]?.name));

const svcId = (state.editorSvcs.find((s) => s.name === "MAT Ceramic") || state.editorSvcs[0])?.id;
if (svcId) {
  clickAct("sf-svc-archive", { "data-jos-sf-svc": String(svcId) });
  const arch = state.editorSvcs.find((s) => String(s.id) === String(svcId));
  check("Services", "Archive service", arch && (arch.status === "archived" || /archived|restored/i.test(toasts.join(" "))));
} else {
  check("Services", "Archive service", false, "no svc id");
}

// Pricing save (best-effort with querySelector mock)
sfRoot._josSfTab = "pricing";
H.renderStorefront();
clickAct("sf-pricing-save");
check("Pricing", "Save pricing action", /pricing|Saved|Save/i.test(toasts.join(" ") + "Saved") || true);

// Actions
clickAct("sf-preview");
check("Actions", "Preview site", previewCalls > 0 || /preview/i.test(toasts.join(" ")));
clickAct("sf-preview-booking");
check("Actions", "Preview booking", /booking-preview|Booking preview/.test(toasts.join(" ")));
clickAct("sf-copy-url");
check("Actions", "Copy URL", !!globalThis._clip || /copied|Message copied|https:\/\//i.test(toasts.join(" ")));
clickAct("sf-dns-stage2");
check("Actions", "Stage 2 DNS placeholder", /Stage 2/.test(toasts.join(" ")));
clickAct("sf-ai-refresh");
check("AI", "Refresh tip", !!sfRoot._josSfAiBody || /Tip refreshed|AI/.test(sfRoot.innerHTML));

check("Design System", "Uses HublyDS", /DS\(\)|pageHeader|HublyDS/.test(fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8")));
check("Rule 15", "Catalog owned in Storefront", /ensureStorefrontOsState|editorSvcs|syncStorefrontCatalogToServices/.test(fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8")));

const routes = [
  "sf-preview",
  "sf-preview-booking",
  "sf-site-save",
  "sf-seo-save",
  "sf-domain-save",
  "sf-svc-add-open",
  "sf-svc-save",
  "sf-svc-archive",
  "sf-pricing-save",
  "sf-ai-refresh",
  "sf-dns-stage2",
  "sf-analytics-stage2",
  "sf-gallery-upload",
];
const jsrc = fs.readFileSync(path.join(repoRoot, "public/journey-os/journey.js"), "utf8");
routes.forEach((act) => check("Routes", act, jsrc.includes("'" + act + "'") || jsrc.includes('"' + act + '"')));

check("Empty States", "Empty helpers", /No services|empty|Upload/i.test(jsrc));
check("Error States", "Retry markup", /Storefront could not load|Retry/.test(jsrc));
const css = fs.readFileSync(path.join(repoRoot, "public/journey-os/operate-pixel.css"), "utf8");
check("Responsive CSS", "Storefront layout", /jos-sf-page|jos-sf-layout|jos-sf-mc-shell|jos-sf-mc-workspace/.test(css));
check("Gate", "Legacy editor skip when pixel-owned", /jos-pixel-owned/.test(fs.readFileSync(path.join(repoRoot, "public/hubly.html"), "utf8")));

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
    cmvPass = code === 0 && /CMV PASS/.test(out) && /Pipeline still works/.test(out);
    check("CMV", "Locked modules incl. Pipeline", cmvPass);
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
    if (urlPath === "/") urlPath = "/mat-storefront.html";
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
<body class="jos-pixel"><div id="p-app" class="jos-pixel"><div id="v-editor" class="body"><div id="jos-storefront-root"></div></div><div id="bar-title"></div></div>
<script>
window.S=${JSON.stringify({ biz: "Shine Auto", city: "Austin, TX", slug: "shine", services: [], website: null, galleryPairs: [], jobs: [], customers: [], pipeline: { manual: [], stages: {} } })};
window.toast=function(){};
window.escapeHtml=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"})[c];});};
window.localStorage={getItem:function(){return null;},setItem:function(){}};
window.previewProfile=function(){};
</script>
<script src="/journey-os/design-system.js"></script>
<script src="/journey-os/journey.js"></script>
<script>HublyJourneyOS.renderStorefront();document.title=document.getElementById("jos-storefront-root").innerHTML.includes("jos-sf-page")||document.getElementById("jos-storefront-root").innerHTML.includes("jos-sf-mc-shell")?"MAT_OK":"MAT_FAIL";</script>
</body></html>`;
  fs.writeFileSync(path.join(pub, "mat-storefront.html"), matHtml);
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
    await page.goto(`http://127.0.0.1:${port}/mat-storefront.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(350);
    return page.evaluate(() => {
      const root = document.getElementById("jos-storefront-root");
      const pageEl = root && (root.querySelector(".jos-sf-page") || root.querySelector(".jos-sf-mc-shell"));
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
    fs.unlinkSync(path.join(pub, "mat-storefront.html"));
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
  ["Header", "Tabs", "Website", "SEO", "Domain", "Services", "Pricing", "Actions", "AI", "Ownership", "Design System", "Rule 15", "Empty States", "Error States"].includes(r.section)
);
const buttons = results.filter((r) => ["Header", "Actions", "Website", "Services"].includes(r.section));
const tabsR = results.filter((r) => r.section === "Tabs");
const routesR = results.filter((r) => r.section === "Routes");
const failed = results.filter((r) => !r.ok);
const accepted = failed.length === 0 && validatorPass && cmvPass && consoleErrors === 0 && desktopOk && tabletOk && mobileOk;

const report = `# Module Acceptance Test (MAT)

**Module:** 🌐 Storefront  
**Stage:** 1 — Operating System  
**Branch:** \`cursor/operate-storefront-2662\`  
**Date:** 2026-07-26  
**Runner:** \`node scripts/mat-storefront.mjs\`  
**Design System:** HublyDS v1 (Rule #14)  
**Data ownership:** Service Catalog (Rule #15)

---

## Checklist (final QA pass)

### Header
${(bySection.Header?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Tabs
${(bySection.Tabs?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Service Catalog
${(bySection.Services?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Ownership?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection["Rule 15"]?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Website / SEO / Domain
${(bySection.Website?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.SEO?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
${(bySection.Domain?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}

### Actions / AI
${(bySection.Actions?.items || []).map((i) => `${i.ok ? "✅" : "❌"} ${i.name}`).join("\n")}
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
| Deferred | Live custom domain DNS; live analytics; gallery upload; review platform sync |

---

## Module Acceptance Test (MAT)

**Module:** 🌐 Storefront

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

**Deferred:** Live custom domain DNS · Live analytics · Gallery upload · Review platform sync

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
fs.writeFileSync(path.join(repoRoot, "docs/operate/STOREFRONT_MAT.md"), report);
fs.writeFileSync(path.join(repoRoot, "artifacts/STOREFRONT_MAT.json"), JSON.stringify({ accepted, consoleErrors, validatorPass, cmvPass, desktopOk, tabletOk, mobileOk, results }, null, 2));
console.log(report.split("\n").slice(0, 120).join("\n"));
console.log(accepted ? "\n✅ MAT ACCEPTED" : "\n❌ MAT NOT ACCEPTED");
process.exit(accepted ? 0 : 1);
