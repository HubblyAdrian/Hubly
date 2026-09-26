#!/usr/bin/env node
/**
 * THE AI WRITES PRODUCTS INTO A ROOM THE OWNER CAN WALK INTO.
 *
 *   node scripts/check-the-owner-can-reach-what-hubly-made.mjs
 *
 * ══ WHAT WAS WRONG ══════════════════════════════════════════════════════════════════════════
 *
 * Hubly writes Commerce records from the claimed shell (public/platform-home.html) — an AI menu
 * import, or a `storefront` capability called in conversation — and the catalog they land in is
 * in the OTHER shell (public/hubly.html at /app, public/journey-os/store-commerce.js). The menu
 * card ended with "Tell me when you have checked them and I will publish them" and there was
 * NOWHERE TO CHECK THEM: the shell has no catalog surface and linked to none.
 *
 * And the room was not merely unmarked, it was SHUT. openOperateHome() sends any arriving owner
 * to location.replace('/'), so even a hand-typed /app#store bounced back to the conversation.
 * That is the worst shape a defect takes here: the link works, the page loads, and the owner
 * ends up where they started with nothing said (prohibition 3's neutral screen).
 *
 * ══ WHAT THIS HOLDS IN PLACE ════════════════════════════════════════════════════════════════
 *
 * Seven legs, each labelled at birth, each red-proofed by a single edit:
 *
 *   1  an owner who NAMES the Store in the URL gets the Store, on the products shelf
 *   2  and a bare or restored arrival still goes to the front door — the exception is narrow
 *   3  an unknown shelf is refused, never guessed at
 *   4  the Store carries a marked way back to the conversation
 *   5  the menu card ends at a door when products were created, and at none when they were not
 *   6  a capability that CHANGED the catalog raises the same door; a read never does
 *   7  the standing door is gated on the catalog's CONTENT, and a failed read is never told as
 *      an empty store
 *
 * ══ SIMULATED, AND SAID SO ══════════════════════════════════════════════════════════════════
 *
 * There is no owner session in this environment and no service key, so: the arrival is simulated
 * by setting window.currentUser and calling the shipping openOperateHome(); commerce-api is
 * answered by a stub so the shipping hcMenuApprove() runs against a known reply. Every function,
 * every registry and every line of markup exercised below is the product's own — what is faked is
 * the SESSION and the NETWORK, never the code under test. This is evidence about the bridge's
 * behaviour; it is NOT evidence that a real owner's real menu reaches a real catalog, which needs
 * Adrian signed in on the real thing.
 *
 * The hook is injected into a COPY served from memory. public/platform-home.html is never
 * modified and ships no test hook (same mechanism as scripts/shot-owner-rooms.mjs).
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { declareBreak } from "./lib/redproof.mjs";

const require_ = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require_("playwright")); }
catch (e) { console.error("CANNOT RUN — playwright not loadable: " + e.message); process.exit(2); }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const PORT = 8791;
let failed = 0;
const say = (n, ok, d) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${n}${d ? "\n        " + d : ""}`); if (!ok) failed++; };

/* The seam into the claimed shell's closure. Exposes the SHIPPING functions — nothing here
   reimplements anything — plus two stubs (token, persist) so the approval path can run without
   a session. */
const HOOK = `
  window.__bridge = {
    doorNode: hcStoreDoorNode,
    wrote: hcStorefrontWroteThisTurn,
    openSettings: hcOpenSettings,
    renderSettingsStore: hcSettingsRenderStore,
    setDraft: function(d){ hc.menuDraft = d; },
    renderMenuCard: hcMenuRenderCard,
    setBiz: function(b){ hc.draftBusiness = b; },
    stubToken: function(t){ hcFreshToken = async function(){ return t; }; },
    stubPersist: function(){ hcPersist = function(){}; }
  };
`;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".ico": "image/x-icon", ".woff2": "font/woff2" };
let injected = false;
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/" || p === "") p = "/platform-home.html";
  if (p === "/app") p = "/hubly.html";                 // what api/router.js does for this path
  try {
    let buf = await readFile(join(PUBLIC, p));
    if (p === "/platform-home.html") {
      const html = buf.toString("utf8");
      const at = html.lastIndexOf("\n})();");
      if (at < 0) { res.writeHead(500); res.end("no injection point"); return; }
      buf = Buffer.from(html.slice(0, at) + "\n" + HOOK + html.slice(at), "utf8");
      injected = true;
    }
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(buf);
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${PORT}`;

let browser;
try { browser = await chromium.launch(); }
catch (e) { console.error("CANNOT RUN — no browser: " + e.message); server.close(); process.exit(2); }

const newPage = async () => {
  const pg = await browser.newPage();
  // The Supabase SDK is the only external asset either shell asks for. Blocking it keeps this
  // offline; nothing under test needs it, and every call that would use it is stubbed.
  await pg.route("https://cdn.jsdelivr.net/**", (r) => r.abort());
  return pg;
};

console.log("SIMULATED — no owner session, no network. The session and commerce-api are stubbed;");
console.log("every function, registry and line of markup exercised below is the shipping one.\n");

try {
  /* ── THE ARRIVAL TRIALS. The shipping openOperateHome(), with an owner simulated the only way
       it asks about one: window.currentUser. Navigation is observed, never predicted. ───────── */
  async function arrive(hash) {
    const pg = await newPage();
    const threw = [];
    pg.on("pageerror", (e) => threw.push(String(e).slice(0, 160)));
    await pg.goto(BASE + "/app" + hash, { waitUntil: "domcontentloaded" });
    await pg.waitForFunction(() => typeof window.openOperateHome === "function", null, { timeout: 8000 }).catch(() => {});
    const ran = await pg.evaluate(() => {
      try { window.currentUser = { id: "simulated-owner" }; openOperateHome({ restore: true }); return "ran"; }
      catch (e) { return "THREW " + e.message; }
    });
    // Poll until the URL stops moving rather than waiting a fixed time: the redirect is a
    // location.replace() that may be a tick away, and a fixed delay would encode a guess.
    let url = pg.url(), stable = 0;
    for (let i = 0; i < 40 && stable < 5; i++) {
      await pg.waitForTimeout(50);
      const now = pg.url();
      stable = now === url ? stable + 1 : 0;
      url = now;
    }
    const shelf = await pg.evaluate(() => {
      const v = document.getElementById("v-store");
      const on = document.querySelector("#v-store .jos-store-tab.on");
      return { storeShown: !!v && !v.hidden && !v.classList.contains("hidden"), tab: on ? on.textContent.trim() : null };
    });
    await pg.close();
    return { ran, url, threw, ...shelf };
  }

  const named = await arrive("#store/products");
  declareBreak({
    leg: "1 [RULE] an owner who names the Store",
    why: "remove the explicit-view exception from the arriver gate, so an owner who typed " +
         "/app#store/products is bounced to the front door — the link works, the page loads, and " +
         "he ends up back where he started with nothing said",
    file: "public/hubly.html",
    find: "    if(_ownerArriving && !_explicitView){",
    with: "    if(_ownerArriving){",
  });
  say("1 [RULE] an owner who names the Store in the URL gets the Store, on the shelf he named",
    named.ran === "ran" && named.url.indexOf("/app") > -1 && named.storeShown && named.tab === "Products",
    `openOperateHome ${named.ran}; ended at ${named.url}; store shown=${named.storeShown}; ` +
    `active tab=${named.tab === null ? "none" : '"' + named.tab + '"'}` +
    (named.threw.length ? `; page errors: ${named.threw.join(" | ")}` : "; no page errors"));

  const bare = await arrive("");
  const dash = await arrive("#dashboard");
  declareBreak({
    leg: "2 [RULE] a bare or dashboard arrival",
    why: "disable the arriver gate entirely, so the retired front door opens for everyone again " +
         "— the exception stops being narrow and becomes the rule",
    file: "public/hubly.html",
    find: "    if(_ownerArriving && !_explicitView){",
    with: "    if(false){",
  });
  const home = (u) => new URL(u).pathname === "/";
  say("2 [RULE] a bare or dashboard arrival still goes to the front door — the exception is NARROW",
    bare.ran === "ran" && dash.ran === "ran" && home(bare.url) && home(dash.url),
    `/app ended at ${bare.url}; /app#dashboard ended at ${dash.url} — both trials ran ` +
    `(${bare.ran}/${dash.ran}), so this is two observed redirects and not two pages that failed to boot`);

  /* ── THE STORE ITSELF. No owner simulated here on purpose: these legs are about the Store
       module, and routing them through the arrival would make one break turn three legs red. ── */
  const store = await newPage();
  await store.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await store.waitForFunction(() => !!(window.HublyStoreCommerce && window.HublyStoreCommerce.openTab), null, { timeout: 8000 })
    .catch(() => {});
  const shelves = await store.evaluate(() => {
    const api = window.HublyStoreCommerce;
    if (!api || typeof api.openTab !== "function") return { loaded: false };
    const known = api.openTab("collections");
    const afterKnown = (document.querySelector("#v-store .jos-store-tab.on") || {}).textContent;
    const unknown = api.openTab("everything");
    const afterUnknown = (document.querySelector("#v-store .jos-store-tab.on") || {}).textContent;
    const back = document.querySelector("#v-store .jos-store-back");
    return { loaded: true, known, afterKnown, unknown, afterUnknown,
      backHref: back ? back.getAttribute("href") : null, backText: back ? back.textContent.trim() : null,
      backIsAnchor: !!back && back.tagName === "A" };
  });
  declareBreak({
    leg: "3 [RULE] the Store opens a shelf it knows",
    why: "drop the tab-name guard from openTab, so an unrecognised shelf falls through renderPage's " +
         "chain and silently renders SETTINGS — a deep link quietly landing somewhere else",
    file: "public/journey-os/store-commerce.js",
    find: "      if (!STORE_TABS.some(function (t) { return t[0] === name; })) return false;",
    with: "      if (false) return false;",
  });
  say("3 [RULE] the Store opens a shelf it knows and REFUSES one it does not, rather than guessing",
    shelves.loaded === true && shelves.known === true && shelves.afterKnown === "Collections" &&
    shelves.unknown === false && shelves.afterUnknown === "Collections",
    shelves.loaded
      ? `openTab("collections") -> ${shelves.known}, active tab "${shelves.afterKnown}"; ` +
        `openTab("everything") -> ${shelves.unknown}, active tab still "${shelves.afterUnknown}"`
      : "the Store module never loaded — nothing was exercised");

  /* ── LEG 8 lives here, on the same page: the AI's draft, opened in the canonical editor. ──
       commerce-api is stubbed at fetch level so public/journey-os/commerce/api.js composes the
       real requests and the real store-commerce.js renders and saves them. What is asserted is
       the METHOD and the URL: an edit to an AI-made draft must be an UPDATE of that row, and a
       create would be the duplicate this phase must not introduce. */
  const editing = await store.evaluate(async () => {
    const calls = [];
    const realFetch = window.fetch;
    window.S = window.S || {}; window.S.businessId = "biz-1";
    window.HublySupabase = { url: "https://stub.invalid", anonKey: "anon", session: { access_token: "tok" } };
    window.fetch = async function (u, o) {
      const url = String(u), method = (o && o.method) || "GET";
      calls.push(method + " " + url.split("/functions/v1/commerce-api")[1]);
      const body = (j) => ({ ok: true, status: 200, json: async () => j });
      if (url.indexOf("/products/p1/images") > -1) return body({ images: [] });
      if (url.indexOf("/products/p1/variants") > -1) return body({ variants: [{ id: "v1", name: "Large", price_cents: 2000 }] });
      if (method === "PATCH" && url.indexOf("/products/p1") > -1) {
        const sent = JSON.parse(o.body);
        return body({ product: { id: "p1", name: sent.name, status: sent.status,
          price_cents: Math.round(sent.price * 100), metadata: { source: "ai" } } });
      }
      if (url.indexOf("/products") > -1 && method === "GET")
        return body({ products: [{ id: "p1", name: "Margherita", status: "draft", price_cents: 1400,
          metadata: { source: "ai", category: "Pizza" } }] });
      if (url.indexOf("/collections") > -1) return body({ collections: [] });
      if (url.indexOf("/bundles") > -1) return body({ bundles: [] });
      if (url.indexOf("/orders") > -1) return body({ orders: [] });
      if (url.indexOf("/settings") > -1) return body({ settings: {} });
      return realFetch.apply(this, arguments);
    };
    await window.HublyStoreCommerce.reload();
    window.HublyStoreCommerce.openTab("products");
    const row = document.querySelector('#v-store [data-jos-store-product="p1"]');
    const listed = row ? row.textContent.replace(/\s+/g, " ").trim() : null;
    if (row) row.querySelector('[data-jos-act="store-product-edit"]').click();
    await new Promise((r) => setTimeout(r, 300));
    const opened = {
      name: (document.getElementById("jos-store-p-name") || {}).value,
      price: (document.getElementById("jos-store-p-price") || {}).value,
      status: (document.getElementById("jos-store-p-status") || {}).value,
      variantFields: document.querySelectorAll("#v-store .jos-store-detail-sections input").length,
    };
    const sel = document.getElementById("jos-store-p-status");
    if (sel) sel.value = "active";
    const before = calls.length;
    document.querySelector('#v-store [data-jos-act="store-product-save"]').click();
    await new Promise((r) => setTimeout(r, 300));
    const onSave = calls.slice(before);
    const after = document.querySelector('#v-store [data-jos-store-product="p1"]');
    window.fetch = realFetch;
    return { listed, opened, onSave, afterSave: after ? after.textContent.replace(/\s+/g, " ").trim() : null };
  });

  declareBreak({
    leg: "4 [RULE] the Store carries a marked way back",
    why: "delete the way back out of the Store header. On a phone the store-mode rule pushes " +
         ".app-nav off-screen, so this link is the ONLY navigation on the page and removing it " +
         "is a dead end with no marked exit",
    file: "public/journey-os/store-commerce.js",
    find: "      '<a class=\"jos-btn jos-store-back\" href=\"/\">\\u2190 Back to Hubly</a>' +",
    with: "      '' +",
  });
  say("4 [RULE] the Store carries a marked way back to the conversation, and it is a real link",
    shelves.loaded === true && shelves.backHref === "/" && shelves.backIsAnchor === true && !!shelves.backText,
    shelves.loaded
      ? `${shelves.backIsAnchor ? "<a>" : "not an anchor"} href=${JSON.stringify(shelves.backHref)} ` +
        `reading ${JSON.stringify(shelves.backText)} — an anchor so it survives a script error and ` +
        `opens in a tab on a middle-click`
      : "the Store module never loaded — nothing was exercised");
  declareBreak({
    leg: "8 [RULE] the draft the AI made opens",
    why: "save an EDIT as a create, so correcting the price on an AI-made draft leaves the " +
         "original behind and puts a second copy of the same product in the catalog — the " +
         "duplicate this phase exists to not introduce",
    file: "public/journey-os/store-commerce.js",
    find: "    var req = editId\n      ? api.updateProduct(editId, productToApiBody(d, false))\n      : api.createProduct(productToApiBody(d, true));",
    with: "    var req = api.createProduct(productToApiBody(d, true));",
  });
  const saves = editing.onSave.filter((c) => c.indexOf("/products") > -1);
  say("8 [RULE] the draft the AI made opens in the canonical editor, and saving it UPDATES that row rather than creating a second one",
    /Margherita/.test(editing.listed || "") && /draft/i.test(editing.listed || "") &&
    editing.opened.name === "Margherita" && editing.opened.price === "14" &&
    editing.opened.status === "draft" && editing.opened.variantFields > 0 &&
    saves.length === 1 && saves[0].indexOf("PATCH /products/p1") === 0 &&
    /active/i.test(editing.afterSave || ""),
    "the row lists as " + JSON.stringify((editing.listed || "").slice(0, 40)) + "; the editor opened on " +
    "name=" + JSON.stringify(editing.opened.name) + " price=" + JSON.stringify(editing.opened.price) +
    " status=" + JSON.stringify(editing.opened.status) + " with " + editing.opened.variantFields +
    " variant field(s) — so the sizes the AI posted are there to correct; saving made exactly " +
    saves.length + " product call (" + (saves.join(", ") || "none") + "), and the row now reads " +
    JSON.stringify((editing.afterSave || "").slice(0, 40)));
  await store.close();


  /* ── THE CLAIMED SHELL: the two write paths, and the standing door. ───────────────────────── */
  const shell = await newPage();
  const shellErrors = [];
  shell.on("pageerror", (e) => shellErrors.push(String(e).slice(0, 160)));
  await shell.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await shell.waitForFunction(() => !!window.__bridge, null, { timeout: 8000 }).catch(() => {});
  if (!injected || !(await shell.evaluate(() => !!window.__bridge))) {
    console.error("CANNOT RUN — the hook was not injected into the served copy.");
    await browser.close(); server.close(); process.exit(2);
  }

  /** Runs the SHIPPING hcMenuApprove() against a stubbed commerce-api that creates `made` of
   *  the two rows and refuses the rest. */
  const approve = (made) => shell.evaluate(async (made) => {
    document.querySelectorAll(".hc-menu,[data-hc-store-door]").forEach((n) => n.remove());
    const realFetch = window.fetch;
    window.fetch = async function (u, o) {
      const url = String(u);
      if (url.indexOf("/products/import") > -1) {
        const rows = JSON.parse(o.body).rows;
        return { ok: true, status: 201, json: async () => ({
          products: rows.slice(0, made).map((r, i) => ({ id: "p" + i, name: r.name })),
          rejected: rows.slice(made).map((r) => ({ name: r.name, reason: "duplicate_slug", detail: "already there" })) }) };
      }
      if (url.indexOf("/variants") > -1) return { ok: true, status: 201, json: async () => ({ variant: { id: "v1" } }) };
      if (url.indexOf("/collections") > -1) return { ok: true, status: 201, json: async () => ({ collection: { id: "c1" } }) };
      return realFetch.apply(this, arguments);
    };
    window.__bridge.setBiz({ id: "biz-1", slug: "fixture", name: "Fixture" });
    window.__bridge.stubToken("simulated-token");
    window.__bridge.stubPersist();
    window.__bridge.setDraft({ items: [
      { name: "Margherita", price: 14, section: "Pizza", sectionConfidence: "high", sizes: [{ label: "Small", price: 14 }, { label: "Large", price: 20 }] },
      { name: "Caesar Salad", price: 9, section: "Salads", sectionConfidence: "high" } ], warnings: [] });
    window.__bridge.renderMenuCard();
    document.querySelector(".hc-menu-open").click();
    const rows = document.querySelectorAll(".hc-menu-row").length;
    document.querySelector(".hc-menu-add").click();
    await new Promise((r) => setTimeout(r, 400));
    const foot = document.querySelector(".hc-menu-foot");
    const door = foot && foot.querySelector("a.hc-arrival-act");
    const said = Array.prototype.map.call(document.querySelectorAll(".hc-msg.hubly"), (n) => n.textContent);
    window.fetch = realFetch;
    return { rows, foot: foot ? foot.textContent : null, href: door ? door.getAttribute("href") : null,
      last: said[said.length - 1] || "" };
  }, made);

  const created = await approve(2);
  const refused = await approve(0);
  declareBreak({
    leg: "5 [RULE] the card ends at a door",
    why: "hand out the door even when the import created NOTHING — a way into a catalog to review " +
         "products that were all refused, which is the unearned checkmark wearing a helpful face",
    file: "public/platform-home.html",
    find: "    if(made.length) foot.appendChild(hcStoreDoorNode('Review your products'));",
    with: "    foot.appendChild(hcStoreDoorNode('Review your products'));",
  });
  say("5 [RULE] the card ends at a door into the catalog when products were created — and at NONE when they were not",
    created.rows === 2 && created.href === "/app#store/products" &&
    refused.rows === 2 && refused.href === null && /unchanged/.test(refused.last),
    `two rows reviewed in both trials (${created.rows}/${refused.rows}, so neither is an empty card ` +
    `satisfying an absence); created -> door to ${JSON.stringify(created.href)}; all-refused -> ` +
    `door ${refused.href === null ? "absent" : JSON.stringify(refused.href)} and the shell said ` +
    `${JSON.stringify(refused.last.slice(0, 80))}`);

  const receipts = await shell.evaluate(() => {
    const w = window.__bridge.wrote;
    return {
      read: w([{ capability: "storefront", capabilityAction: "listCatalog", ok: true, real: true }]),
      wrote: w([{ capability: "storefront", capabilityAction: "createProduct", ok: true, real: true }]),
      unbuilt: w([{ capability: "storefront", capabilityAction: "createModifierGroup", ok: true, real: true }]),
      refused: w([{ capability: "storefront", capabilityAction: "createProduct", ok: false, real: true }]),
      other: w([{ capability: "business", capabilityAction: "recordFacts", ok: true, real: true }]),
      href: window.__bridge.doorNode("Open your store").getAttribute("href"),
    };
  });
  declareBreak({
    leg: "6 [RULE] a capability that CHANGED",
    why: "raise the door on any storefront action at all, reading included, so merely asking what " +
         "is in the catalog produces a door as if something had been written",
    file: "public/platform-home.html",
    find: "  var HC_STOREFRONT_READS = { listCatalog: true };",
    with: "  var HC_STOREFRONT_READS = {};",
  });
  say("6 [RULE] a capability that CHANGED the catalog raises the same door; a read, a refusal and another capability never do",
    receipts.wrote === true && receipts.unbuilt === true && receipts.read === false &&
    receipts.refused === false && receipts.other === false && receipts.href === "/app#store/products",
    `createProduct(ok,real) -> ${receipts.wrote}; createModifierGroup — an action nobody has ` +
    `written yet — -> ${receipts.unbuilt} (the set is enumerated from the harmless side, so a ` +
    `future write needs no edit here); listCatalog -> ${receipts.read}; a REFUSED write -> ` +
    `${receipts.refused}; business.recordFacts -> ${receipts.other}; the door points at ${receipts.href}`);

  const settings = await shell.evaluate(async () => {
    async function trial(reply) {
      document.getElementById("hcSetOv")?.remove();
      window.__bridge.setBiz({ id: "biz-1", slug: "fixture", name: "Fixture" });
      window.__bridge.stubToken("simulated-token");
      const realFetch = window.fetch;
      window.fetch = async function (u) {
        if (String(u).indexOf("commerce-api/products") > -1) {
          if (reply === "fail") return { ok: false, status: 500, json: async () => ({}) };
          return { ok: true, status: 200, json: async () => ({ products: reply }) };
        }
        return realFetch.apply(this, arguments);
      };
      window.__bridge.openSettings();
      await window.__bridge.renderSettingsStore("biz-1");
      const sec = document.getElementById("hcSetStoreSec");
      const cnt = document.getElementById("hcSetStoreCount");
      const link = sec && sec.querySelector("a");
      window.fetch = realFetch;
      return { shown: !!sec && !sec.hidden, count: cnt ? cnt.textContent : null,
        href: link ? link.getAttribute("href") : null };
    }
    return {
      has: await trial([{ status: "draft" }, { status: "active" }]),
      empty: await trial([]),
      broken: await trial("fail"),
    };
  });
  declareBreak({
    leg: "7 [RULE] the standing door",
    why: "let a FAILED catalog read leave the section hidden, exactly as an empty catalog does, so " +
         "a business whose store could not be reached is silently told it has no store — our " +
         "bookkeeping reported as his data (Lesson 86)",
    file: "public/platform-home.html",
    find: "      out.textContent = 'couldn\\u2019t read just now';\n      sec.hidden = false;\n      return;",
    with: "      return;",
  });
  say("7 [RULE] the standing door is gated on the catalog's CONTENT, and a read that FAILED is never told as an empty store",
    settings.has.shown === true && /2/.test(settings.has.count || "") && /draft/.test(settings.has.count || "") &&
    settings.empty.shown === false &&
    settings.broken.shown === true && /read/.test(settings.broken.count || "") &&
    settings.has.href === "/app#store/products",
    `two products (one draft) -> section shown, reading ${JSON.stringify(settings.has.count)}, ` +
    `door to ${settings.has.href}; an empty catalog -> section ${settings.empty.shown ? "SHOWN" : "hidden"} ` +
    `(nothing earned, no door into an empty room); a failed read -> section ` +
    `${settings.broken.shown ? "shown" : "HIDDEN"}, reading ${JSON.stringify(settings.broken.count)} — ` +
    `three outcomes, three behaviours, and the failure is never dressed as a zero`);

  if (shellErrors.length) say("0 the claimed shell threw nothing while being exercised", false, shellErrors.join(" | "));

  console.log(`\n  ${failed ? "FAIL" : "PASS"} — ${8 - failed}/8 legs`);
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
