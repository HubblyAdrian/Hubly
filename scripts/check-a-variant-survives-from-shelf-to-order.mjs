#!/usr/bin/env node
/**
 * THE SIZE A CUSTOMER PICKED IS THE SIZE HE IS CHARGED FOR — SHELF → CARD → CART → ORDER.
 *
 *   node scripts/check-a-variant-survives-from-shelf-to-order.mjs
 *
 * ══ WHY THIS EXISTS ═════════════════════════════════════════════════════════════════════════
 *
 * Phase 1E asked one question: can the EXISTING generic Commerce → Storefront → Cart → Order
 * architecture sell what the AI menu import produces (Products, Collections, Variants)? The
 * answer is yes, and the three places it could have been no are the three places a variant can
 * be dropped between the shelf and the charge. All three are asserted here.
 *
 * The defect that produced the check: `commerce-api` POST /cart (action=add) — the PERSISTED
 * cart, the second of Hubly's two — read neither `body.variant_id` nor the variant's price. A
 * Large pizza went in and came back out as a Small, silently, at the base product's price. The
 * guest cart (storefront-cart.js) had always been right; the fix had landed on one of two
 * writers. `commerce_cart_items.variant_id` existed the whole time, and
 * `computeAuthoritativeOrder` was reading it.
 *
 * ══ WHAT IS REAL HERE AND WHAT IS NOT ═══════════════════════════════════════════════════════
 *
 * The DECISIONS are the shipping code's, not a copy of them:
 *   - `_shared/commerce_checkout.ts` is bundled with esbuild and executed, so legs 1–7 judge the
 *     real pricing/availability rules.
 *   - `public/journey-os/commerce/{storefront-renderer,components,storefront-cart}.js` and
 *     `money.js` are loaded into a sandbox `global`, so legs 8–14 judge the real projection, the
 *     real card builder and the real guest cart.
 *
 * What is DECLARED: the rows. There is no database here. Each fixture row is written in the shape
 * the live tables return, and the fixture numbers are the ones a real three-size menu produces.
 * The persistence, authorisation and HTTP shape of commerce-api are NOT what this file asserts —
 * leg 15 is a [SHAPE] leg over its source, and the RULE-level proof for that endpoint is the live
 * run recorded in docs/PHASE1E_STOREFRONT_PROOF.md.
 *
 * Existing coverage NOT duplicated here: tests/storefront_store_render.mjs already proves all 11
 * AST blocks render and that /store serves the published AST rather than the draft.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import vm from "node:vm";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const legs = [];
const leg = (kind, name, pass, detail) => {
  legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`);
};

/* ── THE REAL PRICING MODULE ──────────────────────────────────────────────────────────────── */
let computeAuthoritativeOrder;
try {
  const js = execFileSync("npx", ["--yes", "esbuild", "--bundle", "--format=esm", "--platform=neutral",
    "--log-level=error", join(ROOT, "supabase/functions/_shared/commerce_checkout.ts")],
    { encoding: "utf8", cwd: ROOT, timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
  ({ computeAuthoritativeOrder } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64")));
} catch (e) {
  console.error("CANNOT RUN — could not load commerce_checkout: " + String(e.message).split("\n")[0]);
  process.exit(2);
}
if (typeof computeAuthoritativeOrder !== "function") {
  console.error("CANNOT RUN — computeAuthoritativeOrder not exported"); process.exit(2);
}

/* ── THE REAL BROWSER MODULES ─────────────────────────────────────────────────────────────── */
const CLIENT_FILES = [
  "public/journey-os/money.js",
  "public/journey-os/commerce/components.js",
  "public/journey-os/commerce/storefront-renderer.js",
  "public/journey-os/commerce/storefront-cart.js",
];
const store = new Map();
const sandbox = {
  window: null,
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  // The narrowest document that lets the REAL cart module run its storage paths. Every lookup
  // answers "not on this page", so injectCartStyle/updateBadge/refresh short-circuit exactly the
  // way they do on a surface that has not mounted a drawer. Nothing about the DOM is asserted
  // here — the drawer itself was exercised in a browser and is recorded in the proof doc.
  document: {
    getElementById: () => null,
    querySelector: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, appendChild() {} }),
    head: { appendChild() {} },
    body: { appendChild() {} },
  },
  location: { origin: "https://example.invalid", search: "" },
  Intl,
  Date,
  Math,
  JSON,
  Number,
  String,
  Object,
  Array,
  console,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
try {
  const ctx = vm.createContext(sandbox);
  for (const f of CLIENT_FILES) {
    vm.runInContext(readFileSync(join(ROOT, f), "utf8"), ctx, { filename: f });
  }
} catch (e) {
  console.error("CANNOT RUN — could not load the storefront client modules: " + String(e.message).split("\n")[0]);
  process.exit(2);
}
const Storefront = sandbox.HublyCommerceStorefront;
const Components = sandbox.HublyCommerceComponents;
const Cart = sandbox.HublyStorefrontCart;
if (!Storefront || !Components || !Cart) {
  console.error("CANNOT RUN — storefront globals missing after load"); process.exit(2);
}

/* ── THE FIXTURE: a three-size menu item, an unsized one, and one product nobody may buy ────
 * Ids are stable strings, not names — asserting on them is the point of legs 3, 9 and 11.    */
const BIZ = "biz-fixture";
const CHEESE = "prod-cheese";
const COKE = "prod-coke";
const KNOTS = "prod-knots-draft";
const HIDDEN = "prod-hidden";
const V_SMALL = "var-cheese-small";
const V_MED = "var-cheese-medium";
const V_LARGE = "var-cheese-large";
const V_UNPRICED = "var-cheese-unpriced";
const V_OTHER_PRODUCT = "var-pepperoni-large";

const PRODUCTS = {
  [CHEESE]: { id: CHEESE, business_id: BIZ, name: "Cheese Pizza", sku: "CHZ", price_cents: 1400, product_type: "physical", status: "active", inventory: null, track_inventory: false, visibility: { website: true } },
  [COKE]: { id: COKE, business_id: BIZ, name: "Coke", sku: null, price_cents: 300, product_type: "physical", status: "active", inventory: null, track_inventory: false, visibility: { website: true } },
  [KNOTS]: { id: KNOTS, business_id: BIZ, name: "Garlic Knots", sku: null, price_cents: 600, product_type: "physical", status: "draft", inventory: null, track_inventory: false, visibility: { website: true } },
  [HIDDEN]: { id: HIDDEN, business_id: BIZ, name: "Staff Meal", sku: null, price_cents: 100, product_type: "physical", status: "active", inventory: null, track_inventory: false, visibility: { website: false } },
};
const VARIANTS = {
  [V_SMALL]: { id: V_SMALL, business_id: BIZ, product_id: CHEESE, name: "Small", sku: null, price_cents: 1400, inventory: null },
  [V_MED]: { id: V_MED, business_id: BIZ, product_id: CHEESE, name: "Medium", sku: null, price_cents: 1700, inventory: null },
  [V_LARGE]: { id: V_LARGE, business_id: BIZ, product_id: CHEESE, name: "Large", sku: "CHZ-L", price_cents: 2000, inventory: null },
  // A variant that prices nothing of its own — generic Commerce allows it; it must inherit.
  [V_UNPRICED]: { id: V_UNPRICED, business_id: BIZ, product_id: CHEESE, name: "Standard", sku: null, price_cents: null, inventory: null },
  // Belongs to a DIFFERENT product. Asking for it against Cheese Pizza must be refused.
  [V_OTHER_PRODUCT]: { id: V_OTHER_PRODUCT, business_id: BIZ, product_id: "prod-pepperoni", name: "Large", sku: null, price_cents: 2200, inventory: null },
};

/** The narrowest possible stand-in for the supabase client: whatever `.eq()` chain is built,
 *  the row is looked up by id and every other `.eq()` must also match, or nothing comes back. */
function admin() {
  const TABLES = { commerce_products: PRODUCTS, commerce_product_variants: VARIANTS };
  return {
    from(table) {
      const rows = TABLES[table] || {};
      const filters = {};
      const q = {
        select() { return q; },
        eq(col, val) { filters[col] = val; return q; },
        async maybeSingle() {
          const row = rows[filters.id];
          if (!row) return { data: null };
          for (const [c, v] of Object.entries(filters)) {
            if (row[c] !== v) return { data: null };
          }
          return { data: row };
        },
      };
      return q;
    },
  };
}

const order = (lineItems) => computeAuthoritativeOrder(admin(), BIZ, lineItems);

/* ══ LEGS 1–7 — THE SERVER IS AUTHORITATIVE ════════════════════════════════════════════════ */

declareBreak({
  leg: "the selected variant's price is the line price",
  why: "if a variant stops determining the charge, a Large is billed as a Small",
  file: "supabase/functions/_shared/commerce_checkout.ts",
  find: "      if (variant.price_cents != null) unitPrice = Number(variant.price_cents) || 0;",
  with: "      if (false) unitPrice = Number(variant.price_cents) || 0;",
});
{
  const r = await order([{ product_id: CHEESE, variant_id: V_MED, qty: 1 }]);
  const it = r.items && r.items[0];
  leg("RULE", "the selected variant's price is the line price",
    r.ok && it && it.unit_price_cents === 1700 && r.subtotal_cents === 1700,
    `Medium selected on a $14 product → unit ${it && it.unit_price_cents}¢, subtotal ${r.subtotal_cents}¢ (want 1700/1700)`);
}

declareBreak({
  leg: "quantity multiplies the line's own unit price",
  why: "a line that ignores qty charges for one of everything",
  file: "supabase/functions/_shared/commerce_checkout.ts",
  find: "title, sku, qty, unit_price_cents: unitPrice, total_cents: unitPrice * qty,",
  with: "title, sku, qty, unit_price_cents: unitPrice, total_cents: unitPrice,",
});
{
  const r = await order([{ product_id: CHEESE, variant_id: V_LARGE, qty: 3 }]);
  const it = r.items && r.items[0];
  leg("RULE", "quantity multiplies the line's own unit price",
    r.ok && it && it.total_cents === it.unit_price_cents * 3 && r.subtotal_cents === it.total_cents,
    `3 × a ${it && it.unit_price_cents}¢ line → ${it && it.total_cents}¢, subtotal ${r.subtotal_cents}¢`);
}

declareBreak({
  leg: "a variant that prices nothing inherits the product price",
  why: "a variant may legitimately carry no price of its own; it must fall back, not go free",
  file: "supabase/functions/_shared/commerce_checkout.ts",
  find: "    let unitPrice = Number(product.price_cents) || 0;",
  with: "    let unitPrice = 0;",
});
{
  const r = await order([{ product_id: CHEESE, variant_id: V_UNPRICED, qty: 1 }]);
  const it = r.items && r.items[0];
  leg("RULE", "a variant that prices nothing inherits the product price",
    r.ok && it && it.unit_price_cents === 1400 && it.variant_id === V_UNPRICED,
    `unpriced variant → ${it && it.unit_price_cents}¢ and variant_id still ${it && it.variant_id}`);
}

// IDENTITY IS THE ID. The title is derived for display; it is never what resolves the line.
declareBreak({
  leg: "the order line carries the stable product id AND variant id",
  why: "a line identified by name cannot survive a rename, and names are not unique",
  file: "supabase/functions/_shared/commerce_checkout.ts",
  find: "      product_id: productId, variant_id: variantId, bundle_id: null,",
  with: "      product_id: title, variant_id: variantId, bundle_id: null,",
});
{
  const r = await order([{ product_id: CHEESE, variant_id: V_LARGE, qty: 1 }]);
  const it = r.items && r.items[0];
  leg("RULE", "the order line carries the stable product id AND variant id",
    r.ok && it && it.product_id === CHEESE && it.variant_id === V_LARGE && it.sku === "CHZ-L",
    `product_id=${it && it.product_id} variant_id=${it && it.variant_id} sku=${it && it.sku}`);
}

declareBreak({
  leg: "a variant that is not this product's is refused",
  why: "without the product scope, any variant id prices any product — and silently",
  file: "supabase/functions/_shared/commerce_checkout.ts",
  find: "        .eq(\"id\", rawVariant)\n        .eq(\"product_id\", productId)",
  with: "        .eq(\"id\", rawVariant)",
});
{
  const r = await order([{ product_id: CHEESE, variant_id: V_OTHER_PRODUCT, qty: 1 }]);
  leg("RULE", "a variant that is not this product's is refused, never downgraded",
    !r.ok && r.error === "variant_not_found" && r.items.length === 0,
    `ok=${r.ok} error=${r.error} (a silent fallback to $14 would be the defect)`);
}

// The AI menu import writes DRAFTS. This is the wall between an unreviewed menu and a customer.
declareBreak({
  leg: "a draft product cannot be purchased",
  why: "an AI-imported draft the owner has not approved must not be sellable",
  file: "supabase/functions/_shared/commerce_checkout.ts",
  find: "    if (product.status !== \"active\" || vis.website === false) {",
  with: "    if (vis.website === false) {",
});
{
  const r = await order([{ product_id: KNOTS, qty: 1 }]);
  leg("RULE", "a draft product cannot be purchased",
    !r.ok && r.error === "product_unavailable" && r.items.length === 0,
    `draft product → ok=${r.ok} error=${r.error}`);
}

declareBreak({
  leg: "a product hidden from the website cannot be purchased",
  why: "visibility is the second half of the same gate and has its own way of being lost",
  file: "supabase/functions/_shared/commerce_checkout.ts",
  find: "    if (product.status !== \"active\" || vis.website === false) {",
  with: "    if (product.status !== \"active\") {",
});
{
  const r = await order([{ product_id: HIDDEN, qty: 1 }]);
  leg("RULE", "a product hidden from the website cannot be purchased",
    !r.ok && r.error === "product_unavailable",
    `visibility.website=false → ok=${r.ok} error=${r.error}`);
}

/* ══ LEGS 8–14 — WHAT THE CUSTOMER SEES AND WHAT THE CUSTOMER SENDS ════════════════════════ */

// The public payload, in the shape commerce-api /public/storefront actually returns.
const PAYLOAD = {
  settings: { enabled: true, showOnWebsite: true, store_path: "/store", currency: "usd" },
  products: [
    { id: CHEESE, name: "Cheese Pizza", slug: "cheese-pizza", description: "", short_description: "", price_cents: 1400, product_type: "physical", inventory: null, track_inventory: false, images: [], variants: [
      { id: V_SMALL, name: "Small", price_cents: 1400, inventory: null, options: {} },
      { id: V_MED, name: "Medium", price_cents: 1700, inventory: null, options: {} },
      { id: V_LARGE, name: "Large", price_cents: 2000, inventory: null, options: {} },
    ] },
    { id: COKE, name: "Coke", slug: "coke", description: "", short_description: "", price_cents: 300, product_type: "physical", inventory: null, track_inventory: false, images: [], variants: [] },
  ],
  collections: [
    { id: "col-pizza", name: "Pizza", slug: "pizza", description: "", product_ids: [CHEESE] },
    { id: "col-drinks", name: "Drinks", slug: "drinks", description: "", product_ids: [COKE] },
  ],
  bundles: [],
};
const os = Storefront.payloadToOs(PAYLOAD);
const cheeseOs = os.products.find((p) => p.id === CHEESE);
const cokeOs = os.products.find((p) => p.id === COKE);
const money = (n) => sandbox.HublyMoney.format(n);

declareBreak({
  leg: "the public payload projects the product price and every variant id",
  why: "the projection is read-through; a price it invents is a price the server will not charge",
  file: "public/journey-os/commerce/storefront-renderer.js",
  find: "        price: (Number(p.price_cents) || 0) / 100,",
  with: "        price: 0,",
});
{
  const v = (cheeseOs && cheeseOs.variants) || [];
  leg("RULE", "the public payload projects the product price and every variant id",
    v.length === 3 && v[0].id === V_SMALL && v[1].id === V_MED && v[2].id === V_LARGE && cheeseOs.price === 14,
    `${v.length} variants, ids intact; base price $${cheeseOs && cheeseOs.price} (want $14)`);
}

declareBreak({
  leg: "a variant's own price survives the projection",
  why: "cents → dollars is where a price has already been silently rounded once (money.js)",
  file: "public/journey-os/commerce/storefront-renderer.js",
  find: "            price: v.price_cents != null ? Number(v.price_cents) / 100 : null,",
  with: "            price: v.price_cents != null ? Number(v.price_cents) / 10 : null,",
});
{
  const v = (cheeseOs && cheeseOs.variants) || [];
  leg("RULE", "a variant's own price survives the projection, in dollars",
    v.length === 3 && v[1].price === 17 && v[2].price === 20,
    `medium $${v[1] && v[1].price}, large $${v[2] && v[2].price} (want $17, $20)`);
}

declareBreak({
  leg: "collections project in Commerce order",
  why: "the owner's collection order is the only ordering Commerce states; the client may not re-sort",
  file: "public/journey-os/commerce/storefront-renderer.js",
  find: "    var collections = (d.collections || []).map(function (c) {",
  with: "    var collections = (d.collections || []).slice().reverse().map(function (c) {",
});
{
  const names = os.collections.map((c) => c.name).join(" → ");
  leg("RULE", "collections project in Commerce order and reference products by id",
    os.collections.length === 2 && names === "Pizza → Drinks" &&
    os.collections[0].productIds.length === 1 && os.collections[0].productIds[0] === CHEESE,
    `${names}; Pizza holds [${os.collections[0].productIds.join(",")}]`);
}

// Every option the customer can pick carries the VARIANT ID as its value. If a name ever becomes
// the value, this leg is what catches it.
declareBreak({
  leg: "the variant selector's values are variant ids",
  why: "a name in the option value is name-based identity arriving through the UI",
  file: "public/journey-os/commerce/components.js",
  find: "          return '<option value=\"' + esc(v.id) + '\" data-price=\"' + esc(vp) + '\"'",
  with: "          return '<option value=\"' + esc(v.name) + '\" data-price=\"' + esc(vp) + '\"'",
});
{
  const html = Components.ProductCard(cheeseOs);
  const values = [...html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
  const idsOnly = values.length === 3 && values[0] === V_SMALL && values[1] === V_MED && values[2] === V_LARGE;
  leg("RULE", "the variant selector's values are variant ids, never names",
    idsOnly && html.includes('data-product-id="' + CHEESE + '"'),
    `option values = [${values.join(", ")}]`);
}

declareBreak({
  leg: "a product whose variants differ in price is labelled from its lowest",
  why: "one number on a card that has three is a price the customer may not be able to get",
  file: "public/journey-os/commerce/components.js",
  find: "      priceLabel = minP !== maxP ? ('from ' + money(minP)) : money(minP);",
  with: "      priceLabel = money(minP);",
});
{
  const html = Components.ProductCard(cheeseOs);
  const flat = Components.ProductCard(cokeOs);
  const lowest = Math.min(...cheeseOs.variants.map((v) => v.price));
  leg("RULE", "a product whose variants differ in price is labelled from its lowest",
    html.includes("from " + money(lowest)) && !flat.includes("from "),
    `cheese label carries "from ${money(lowest)}": ${html.includes("from " + money(lowest))}; coke shows a flat price: ${!flat.includes("from ")}`);
}

// TWO SIZES OF ONE PIZZA ARE TWO LINES. Keyed by product+variant, not by product.
declareBreak({
  leg: "two variants of one product are two cart lines",
  why: "a cart keyed by product alone collapses a Large onto a Medium and charges one of them",
  file: "public/journey-os/commerce/storefront-cart.js",
  find: "  function lineKey(pid, vid) { return String(pid) + '::' + (vid || ''); }",
  with: "  function lineKey(pid, vid) { return String(pid); }",
});
{
  Cart.mount(BIZ, null);   // real mount: businessId scopes the storage key
  Cart.clear();
  Cart.add({ productId: CHEESE, variantId: V_MED, qty: 1, name: "Cheese Pizza — Medium", price: 17 });
  Cart.add({ productId: CHEESE, variantId: V_LARGE, qty: 1, name: "Cheese Pizza — Large", price: 20 });
  Cart.add({ productId: CHEESE, variantId: V_MED, qty: 1, name: "Cheese Pizza — Medium", price: 17 });
  const items = Cart.items();
  const med = items.find((i) => i.variantId === V_MED);
  leg("RULE", "two variants of one product are two cart lines; the same variant merges",
    items.length === 2 && med && med.qty === 2 && Cart.count() === 3,
    `${items.length} lines, medium qty=${med && med.qty}, total count=${Cart.count()}`);
}

// The client sends IDS AND QUANTITIES ONLY. A price in this payload is the defect.
declareBreak({
  leg: "checkout sends ids and quantities only",
  why: "a price the client sends is a price the server could be tempted to trust",
  file: "public/journey-os/commerce/storefront-cart.js",
  find: "      var li = { product_id: i.productId, qty: Number(i.qty) || 1 };",
  with: "      var li = { product_id: i.productId, qty: Number(i.qty) || 1, price: i.price };",
});
{
  const line = Cart.buildLineItems();
  const keys = [...new Set(line.flatMap((l) => Object.keys(l)))].sort();
  const clean = keys.join(",") === "product_id,qty,variant_id";
  leg("RULE", "checkout sends ids and quantities only — never a price the server could trust",
    clean && line.every((l) => typeof l.product_id === "string" && typeof l.variant_id === "string"),
    `payload keys = [${keys.join(", ")}]`);
  Cart.clear();
}

/* ══ LEG 15 — THE PERSISTED CART'S WRITER ══════════════════════════════════════════════════
 * [SHAPE], and labelled so on purpose: commerce-api/index.ts calls Deno.serve at import time and
 * cannot be executed here, so this reads its source. It legitimately goes red if that handler is
 * restructured — when it does, confirm the change was intended and update the leg; do not undo
 * the improvement. The RULE-level proof is the live run against the deployed function.          */
declareBreak({
  leg: "the persisted cart writer reads, validates, prices and stores the variant",
  why: "this is the writer that dropped variant_id, and it is the one Hubly cannot execute offline",
  file: "supabase/functions/commerce-api/index.ts",
  find: "          variant_id: variantId,\n          title,",
  with: "          title,",
});
{
  const src = readFileSync(join(ROOT, "supabase/functions/commerce-api/index.ts"), "utf8");
  const addBlock = src.slice(src.indexOf('body.action === "add"'), src.indexOf('body.action === "merge"'));
  const readsVariant = /body\.variant_id/.test(addBlock);
  const writesVariant = /variant_id:\s*variantId/.test(addBlock);
  const pricesFromVariant = /variant\.price_cents/.test(addBlock);
  const refuses = /variant_not_found/.test(addBlock);
  leg("SHAPE", "the persisted cart writer reads, validates, prices and stores the variant",
    readsVariant && writesVariant && pricesFromVariant && refuses,
    `reads=${readsVariant} writes=${writesVariant} prices=${pricesFromVariant} refuses=${refuses}`);
}

/* ══ LEG 16 — NO RESTAURANT ENTITY WAS INTRODUCED ══════════════════════════════════════════
 * [RULE]. A menu is a presentation of Commerce data. The moment a table, a renderer or a cart
 * learns the word "restaurant", the architecture this phase was asked to prove has been abandoned. */
declareBreak({
  leg: "no restaurant-specific table, renderer or cart exists",
  why: "the leg must fire on a restaurant entity anywhere in the storefront or the schema",
  file: "public/journey-os/commerce/components.js",
  find: "  function CollectionCard(c) {",
  with: "  function CollectionCard(c) { /* menu_items */",
});
{
  const banned = "restaurant_[a-z_]+|menu_items|menu_sections|restaurant_menu|restaurant_product|restaurant_variant|restaurant_cart";
  const hit = (dirs) => execFileSync("bash", ["-lc",
    `grep -rlE '${banned}' ${dirs.map((d) => JSON.stringify(join(ROOT, d))).join(" ")} 2>/dev/null || true`],
    { encoding: "utf8" }).trim();
  const migrations = hit(["supabase/migrations"]);
  const storefront = hit([
    "public/journey-os/commerce",
    "supabase/functions/commerce-api",
    "supabase/functions/create-store-checkout",
    "supabase/functions/_shared/commerce_checkout.ts",
  ]);
  leg("RULE", "no restaurant-specific table, renderer or cart exists",
    !migrations && !storefront,
    migrations || storefront
      ? `found in: ${[migrations, storefront].filter(Boolean).join(" ")}`
      : "clean across migrations, the storefront client, commerce-api and checkout");
}

/* ── VERDICT ──────────────────────────────────────────────────────────────────────────────── */
const failed = legs.filter((l) => !l.pass);
console.log(`\n${legs.length - failed.length}/${legs.length} legs passed.`);
if (failed.length) {
  console.log("FAILED: " + failed.map((l) => l.name).join(" · "));
  process.exit(1);
}
console.log("PASS — a variant survives from shelf to order.");
process.exit(0);
