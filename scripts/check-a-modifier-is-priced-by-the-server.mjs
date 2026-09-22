#!/usr/bin/env node
/**
 * A CHOICE THE CUSTOMER MAKES IS PRICED BY THE SERVER, AND SURVIVES INTO THE ORDER.
 *
 *   node scripts/check-a-modifier-is-priced-by-the-server.mjs
 *
 * ══ WHAT A MODIFIER IS, AND WHY IT IS NOT A VARIANT ═════════════════════════════════════════
 *
 * A VARIANT is a sellable version of a product — Standard $100, Premium $125 — and Phase 1E
 * proved it end to end. A MODIFIER is a constrained choice applied to a LINE: rush service +$25,
 * protection +$15, gift packaging +$5. Grouping, min/max constraints, and a selection recorded on
 * the line are the three things variants cannot express.
 *
 * Nothing in this file knows what trade the business is in. The fixture sells a "Premium Service"
 * with "Extras" and a "Required Choice" precisely so that no leg can quietly become a restaurant
 * leg. Leg 16 fails if a restaurant entity appears anywhere in Commerce.
 *
 * ══ THE RULE THIS EXISTS TO HOLD ════════════════════════════════════════════════════════════
 *
 * The client sends OPTION IDS. It does not send a name, a price or a total, and if it tries, the
 * resolver refuses the selection by shape before any field can be read off it. Every figure comes
 * from `commerce_modifier_options.price_adjustment_cents` reloaded at pricing time.
 *
 * `required` IS NOT A FIELD — it is `min_select >= 1`. Two fields for one idea can disagree, and a
 * disagreement here either blocks a customer at checkout or lets a required choice be skipped.
 *
 * ══ WHAT IS REAL HERE AND WHAT IS NOT ═══════════════════════════════════════════════════════
 *
 * The DECISIONS are the shipping code's:
 *   - `_shared/commerce_modifiers.ts` and `_shared/commerce_checkout.ts` are bundled with esbuild
 *     and EXECUTED (legs 1–12), so these legs judge the real resolver and the real pricing loop.
 *   - `money.js`, `components.js`, `storefront-renderer.js` and `storefront-cart.js` are loaded
 *     into a sandbox `global` (legs 13–15), so the identity and the controls are the real ones.
 *
 * What is DECLARED: the rows. There is no database here — the supabase client is a stand-in that
 * answers from the fixture below, so a leg cannot pass against a rewrite of the rules but also
 * cannot prove anything about persistence or authorisation. Those were exercised live against the
 * deployed commerce-api and are recorded in docs/PHASE1F_MODIFIER_PROOF.md.
 *
 * Existing coverage NOT duplicated: check-a-variant-survives-from-shelf-to-order.mjs already holds
 * the variant/draft/collection/cart-identity invariants; this file adds only what modifiers bring.
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

/* ── THE REAL MODULES ─────────────────────────────────────────────────────────────────────── */
function bundle(entry) {
  return execFileSync("npx", ["--yes", "esbuild", "--bundle", "--format=esm", "--platform=neutral",
    "--log-level=error", join(ROOT, entry)],
    { encoding: "utf8", cwd: ROOT, timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
}
let computeAuthoritativeOrder, canonicalModifierIds, describeModifierSnapshot;
try {
  ({ computeAuthoritativeOrder } = await import(
    "data:text/javascript;base64," + Buffer.from(bundle("supabase/functions/_shared/commerce_checkout.ts")).toString("base64")));
  ({ canonicalModifierIds, describeModifierSnapshot } = await import(
    "data:text/javascript;base64," + Buffer.from(bundle("supabase/functions/_shared/commerce_modifiers.ts")).toString("base64")));
} catch (e) {
  console.error("CANNOT RUN — could not load the commerce modules: " + String(e.message).split("\n")[0]);
  process.exit(2);
}
if (typeof computeAuthoritativeOrder !== "function" || typeof canonicalModifierIds !== "function") {
  console.error("CANNOT RUN — expected exports missing"); process.exit(2);
}

/* ── THE REAL BROWSER MODULES ─────────────────────────────────────────────────────────────── */
const store = new Map();
const sandbox = {
  window: null,
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  document: {
    getElementById: () => null,
    querySelector: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, appendChild() {} }),
    head: { appendChild() {} },
    body: { appendChild() {} },
  },
  location: { origin: "https://example.invalid", search: "" },
  Intl, Date, Math, JSON, Number, String, Object, Array, console,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
try {
  const ctx = vm.createContext(sandbox);
  for (const f of [
    "public/journey-os/money.js",
    "public/journey-os/commerce/components.js",
    "public/journey-os/commerce/storefront-renderer.js",
    "public/journey-os/commerce/storefront-cart.js",
  ]) vm.runInContext(readFileSync(join(ROOT, f), "utf8"), ctx, { filename: f });
} catch (e) {
  console.error("CANNOT RUN — could not load the storefront client modules: " + String(e.message).split("\n")[0]);
  process.exit(2);
}
const Storefront = sandbox.HublyCommerceStorefront;
const Components = sandbox.HublyCommerceComponents;
const Cart = sandbox.HublyStorefrontCart;
if (!Storefront || !Components || !Cart || typeof Components.ModifierGroups !== "function") {
  console.error("CANNOT RUN — storefront globals missing after load"); process.exit(2);
}

/* ══ THE FIXTURE — the generic one from the phase brief, not a menu ═══════════════════════════ */
const BIZ = "biz-fixture";
const OTHER_BIZ = "biz-someone-else";
const PREMIUM = "prod-premium-service";
const BARE = "prod-plain-widget";
const V_STD = "var-standard";
const V_PRE = "var-premium";
const G_EXTRAS = "grp-extras";       // min 0, max 2
const G_REQUIRED = "grp-required";   // min 1, max 1
const O_RUSH = "opt-rush";           // +2500
const O_PROTECT = "opt-protect";     // +1500
const O_GIFT = "opt-gift";           // +500
const O_A = "opt-a";                 // +0
const O_B = "opt-b";                 // +1000
const O_DEAD = "opt-dead";           // archived, +9900
const O_ARCHIVED_GRP = "opt-in-archived-group";
const O_FOREIGN = "opt-foreign";     // another business entirely

const NOGROUP = "prod-no-groups";
const ARCHIVED_HOST = "prod-archived-host";
const G_ARCHIVED_O = "grp-archived-other";

// EACH GUARD GETS ITS OWN SUBJECT. A fixture where every leg orders the same product means one
// break reddens four legs and proves nothing about any of them (L98) — so the zero-modifier
// product lives on a business with no modifier data at all, and the archived group hangs off a
// product nothing else touches.
const PRODUCTS = {
  [PREMIUM]: { id: PREMIUM, business_id: BIZ, name: "Premium Service", sku: "PS", price_cents: 10000, product_type: "physical", status: "active", inventory: null, track_inventory: false, visibility: { website: true } },
  [NOGROUP]: { id: NOGROUP, business_id: BIZ, name: "Unconfigured Item", sku: null, price_cents: 400, product_type: "physical", status: "active", inventory: null, track_inventory: false, visibility: { website: true } },
  // On the OTHER business on purpose: this is the existing-customer case — a catalog that has
  // never heard of a modifier — and no break scoped to BIZ may be able to disturb it.
  [BARE]: { id: BARE, business_id: OTHER_BIZ, name: "Plain Widget", sku: null, price_cents: 900, product_type: "physical", status: "active", inventory: null, track_inventory: false, visibility: { website: true } },
  [ARCHIVED_HOST]: { id: ARCHIVED_HOST, business_id: OTHER_BIZ, name: "Legacy Item", sku: null, price_cents: 10000, product_type: "physical", status: "active", inventory: null, track_inventory: false, visibility: { website: true } },
};
const VARIANTS = {
  [V_STD]: { id: V_STD, business_id: BIZ, product_id: PREMIUM, name: "Standard", sku: null, price_cents: 10000, inventory: null },
  [V_PRE]: { id: V_PRE, business_id: BIZ, product_id: PREMIUM, name: "Premium", sku: null, price_cents: 12500, inventory: null },
};
const GROUPS = {
  [G_EXTRAS]: { id: G_EXTRAS, business_id: BIZ, name: "Extras", min_select: 0, max_select: 2, status: "active" },
  [G_REQUIRED]: { id: G_REQUIRED, business_id: BIZ, name: "Required Choice", min_select: 1, max_select: 1, status: "active" },
  [G_ARCHIVED_O]: { id: G_ARCHIVED_O, business_id: OTHER_BIZ, name: "Retired Group", min_select: 1, max_select: 1, status: "archived" },
};
const OPTIONS = {
  [O_RUSH]: { id: O_RUSH, business_id: BIZ, modifier_group_id: G_EXTRAS, name: "Rush Service", price_adjustment_cents: 2500, status: "active", sort_order: 0 },
  [O_PROTECT]: { id: O_PROTECT, business_id: BIZ, modifier_group_id: G_EXTRAS, name: "Protection", price_adjustment_cents: 1500, status: "active", sort_order: 1 },
  [O_GIFT]: { id: O_GIFT, business_id: BIZ, modifier_group_id: G_EXTRAS, name: "Gift Packaging", price_adjustment_cents: 500, status: "active", sort_order: 2 },
  [O_DEAD]: { id: O_DEAD, business_id: BIZ, modifier_group_id: G_EXTRAS, name: "Retired Extra", price_adjustment_cents: 9900, status: "archived", sort_order: 3 },
  [O_A]: { id: O_A, business_id: BIZ, modifier_group_id: G_REQUIRED, name: "Option A", price_adjustment_cents: 0, status: "active", sort_order: 0 },
  [O_B]: { id: O_B, business_id: BIZ, modifier_group_id: G_REQUIRED, name: "Option B", price_adjustment_cents: 1000, status: "active", sort_order: 1 },
  [O_ARCHIVED_GRP]: { id: O_ARCHIVED_GRP, business_id: OTHER_BIZ, modifier_group_id: G_ARCHIVED_O, name: "Old Thing", price_adjustment_cents: 100, status: "active", sort_order: 0 },
  [O_FOREIGN]: { id: O_FOREIGN, business_id: OTHER_BIZ, modifier_group_id: "grp-foreign", name: "Foreign Option", price_adjustment_cents: 100, status: "active", sort_order: 0 },
};
const ATTACH = [
  { product_id: PREMIUM, modifier_group_id: G_EXTRAS, business_id: BIZ, sort_order: 0 },
  { product_id: PREMIUM, modifier_group_id: G_REQUIRED, business_id: BIZ, sort_order: 1 },
  { product_id: ARCHIVED_HOST, modifier_group_id: G_ARCHIVED_O, business_id: OTHER_BIZ, sort_order: 0 },
];

/** A stand-in for the supabase client: `.eq()` narrows, `.in()` selects a set, and a row only
 *  comes back if EVERY filter matches — which is what makes the business/product scoping real. */
function admin() {
  const TABLES = {
    commerce_products: Object.values(PRODUCTS),
    commerce_product_variants: Object.values(VARIANTS),
    commerce_modifier_groups: Object.values(GROUPS),
    commerce_modifier_options: Object.values(OPTIONS),
    commerce_product_modifier_groups: ATTACH,
  };
  return {
    from(table) {
      const rows = TABLES[table] || [];
      const eq = {};
      const ins = {};
      const q = {
        select() { return q; },
        eq(c, v) { eq[c] = v; return q; },
        in(c, vs) { ins[c] = new Set(vs); return q; },
        order() { return q; },
        then(res) { return Promise.resolve(run()).then(res); },
        async maybeSingle() { const r = run(); return { data: r.data[0] || null }; },
      };
      function run() {
        const out = rows.filter((r) => {
          for (const [c, v] of Object.entries(eq)) if (r[c] !== v) return false;
          for (const [c, s] of Object.entries(ins)) if (!s.has(r[c])) return false;
          return true;
        });
        return { data: out, error: null };
      }
      return q;
    },
  };
}
const order = (items) => computeAuthoritativeOrder(admin(), BIZ, items);
const line = (extra) => [Object.assign({ product_id: PREMIUM, qty: 1, selected_modifiers: [O_A] }, extra)];

/* ══ LEGS 1–12 — THE SERVER IS THE AUTHORITY ══════════════════════════════════════════════ */

declareBreak({
  leg: "a product with no modifier groups prices exactly as before",
  why: "every existing Commerce product takes this path and must be untouched by the feature",
  file: "supabase/functions/_shared/commerce_modifiers.ts",
  find: "    return { ok: true, option_ids: [], snapshot: [], adjustment_cents: 0 };",
  with: "    return fail(\"modifier_option_not_found\", \"no groups\");",
});
{
  const r = await computeAuthoritativeOrder(admin(), OTHER_BIZ, [{ product_id: BARE, qty: 2 }]);
  const it = r.items && r.items[0];
  leg("RULE", "a product with no modifier groups prices exactly as before",
    r.ok && it && it.unit_price_cents === 900 && it.total_cents === 1800 && it.selected_modifiers.length === 0,
    `2 × $9 → ${it && it.total_cents}¢ with ${it && it.selected_modifiers.length} modifiers (want 1800/0)`);
}

declareBreak({
  leg: "an optional group may be left empty",
  why: "min_select 0 must mean optional; enforcing min on every group would block a plain purchase",
  file: "supabase/functions/_shared/commerce_modifiers.ts",
  find: "    if (n < min) {",
  with: "    if (n < Math.max(1, min)) {",
});
{
  const r = await order(line({ selected_modifiers: [O_A] }));
  const it = r.items && r.items[0];
  leg("RULE", "an optional group may be left empty",
    r.ok && it && it.unit_price_cents === 10000,
    `Extras skipped, Required answered → ${it && it.unit_price_cents}¢ (want 10000)`);
}

declareBreak({
  leg: "the adjustment is added to the line's base",
  why: "if the sum stops coming off the real rows, the customer is charged for a choice they did not get",
  file: "supabase/functions/_shared/commerce_modifiers.ts",
  find: "  const adjustment = snapshot.reduce((s, e) => s + e.price_adjustment_cents, 0);",
  with: "  const adjustment = 0;",
});
{
  // The PRODUCT-base case only. The variant case is the next leg's subject, stated as a
  // difference — asserting $165 here too would make one break redden both, and a break that
  // reddens two legs proves nothing about either (L98). The absolute $165 was asserted against
  // the deployed API and is recorded in docs/PHASE1F_MODIFIER_PROOF.md.
  const r = await order(line({ selected_modifiers: [O_RUSH, O_A] }));
  const it = r.items && r.items[0];
  leg("RULE", "the adjustment is added to the line's base — $100 + Rush $25 = $125",
    r.ok && it && it.unit_price_cents === 12500,
    `${it && it.unit_price_cents}¢ (want 12500), from the row's own price_adjustment_cents`);
}

declareBreak({
  leg: "the base the adjustment applies to is the VARIANT's price",
  why: "adding the adjustment to the product price instead of the variant's is a different, wrong number",
  file: "supabase/functions/_shared/commerce_checkout.ts",
  find: "      if (variant.price_cents != null) unitPrice = Number(variant.price_cents) || 0;",
  with: "      if (false) unitPrice = Number(variant.price_cents) || 0;",
});
{
  // Stated as a DIFFERENCE so this leg is about the base and nothing else: whatever the
  // adjustment happens to be, swapping Standard for Premium must move the line by exactly the
  // variant's own $25 — which is false the moment the variant price stops being the base.
  const pre = await order(line({ variant_id: V_PRE, selected_modifiers: [O_RUSH, O_PROTECT, O_A] }));
  const std = await order(line({ variant_id: V_STD, selected_modifiers: [O_RUSH, O_PROTECT, O_A] }));
  const d = (pre.items?.[0]?.unit_price_cents ?? 0) - (std.items?.[0]?.unit_price_cents ?? 0);
  leg("RULE", "the base the adjustment applies to is the VARIANT's price",
    pre.ok && std.ok && d === 2500 && pre.items[0].variant_id === V_PRE,
    `Premium ${pre.items?.[0]?.unit_price_cents}¢ (the phase's $165) − Standard ${std.items?.[0]?.unit_price_cents}¢ = ${d}¢ (want the variant's own 2500)`);
}

declareBreak({
  leg: "a required group refuses an empty selection",
  why: "min_select is the only thing standing between a customer and an unconfigured order",
  file: "supabase/functions/_shared/commerce_modifiers.ts",
  find: "      return fail(\n        \"modifier_group_required\",",
  with: "      return fail(\n        \"\" || \"modifier_group_ok\",",
});
{
  const r = await order(line({ selected_modifiers: [O_RUSH] }));
  leg("RULE", "a required group refuses an empty selection",
    !r.ok && r.error === "modifier_group_required" && r.items.length === 0,
    `ok=${r.ok} error=${r.error} · ${r.detail}`);
}

declareBreak({
  leg: "max_select refuses one selection too many",
  why: "without the ceiling a line can carry any number of paid extras the group never offered",
  file: "supabase/functions/_shared/commerce_modifiers.ts",
  find: "    if (n > max) {",
  with: "    if (n > max + 99) {",
});
{
  const r = await order(line({ selected_modifiers: [O_RUSH, O_PROTECT, O_GIFT, O_A] }));
  leg("RULE", "max_select refuses one selection too many",
    !r.ok && r.error === "modifier_group_max_exceeded",
    `3 picks in a max-2 group → ${r.error} · ${r.detail}`);
}

declareBreak({
  leg: "a selection that is not a list of ids is refused by shape",
  why: "this is the gate that stops a client sending {name, price} and having a field read off it",
  file: "supabase/functions/_shared/commerce_modifiers.ts",
  find: "    if (typeof v !== \"string\" || !v.trim()) {",
  with: "    if (false) {",
});
{
  // The tampering attempt, in the shape a client would actually try it.
  const r = await order(line({ selected_modifiers: [{ id: O_RUSH, name: "Rush Service", price_adjustment_cents: 99900 }, O_A] }));
  leg("RULE", "a selection that is not a list of ids is refused by shape",
    !r.ok && r.error === "modifier_selection_invalid",
    `client sent an object carrying a price → ${r.error} · ${r.detail}`);
}

declareBreak({
  leg: "an option that is not attached to this product is refused",
  why: "without the product scope any option id prices any product",
  file: "supabase/functions/_shared/commerce_modifiers.ts",
  find: "    .eq(\"product_id\", productId)\n    .eq(\"business_id\", businessId)\n    .order(\"sort_order\");",
  with: "    .eq(\"business_id\", businessId)\n    .order(\"sort_order\");",
});
{
  const r = await order([{ product_id: NOGROUP, qty: 1, selected_modifiers: [O_RUSH] }]);
  leg("RULE", "an option that is not attached to this product is refused",
    !r.ok && r.error === "modifier_option_not_found",
    `Rush against another product of the same business → ${r.error}`);
}

declareBreak({
  leg: "an option belonging to another business is refused",
  why: "business isolation is the one boundary a multi-tenant catalog cannot get wrong",
  file: "supabase/functions/_shared/commerce_modifiers.ts",
  find: "    .in(\"modifier_group_id\", groupIds)\n    .eq(\"business_id\", businessId)\n    .order(\"sort_order\");",
  with: "    .in(\"modifier_group_id\", groupIds)\n    .order(\"sort_order\");",
});
{
  // Belt and braces: the foreign option's group is not attached here either, so this leg is
  // specifically about the business filter on the OPTION query.
  OPTIONS[O_FOREIGN].modifier_group_id = G_EXTRAS;      // pretend it hangs off an attached group
  const r = await order(line({ selected_modifiers: [O_FOREIGN, O_A] }));
  OPTIONS[O_FOREIGN].modifier_group_id = "grp-foreign"; // put the fixture back
  leg("RULE", "an option belonging to another business is refused",
    !r.ok && r.error === "modifier_option_not_found",
    `foreign-business option on an attached group → ${r.error}`);
}

declareBreak({
  leg: "an archived option cannot be bought",
  why: "archiving is how an owner withdraws an option; if it still sells, archiving means nothing",
  file: "supabase/functions/_shared/commerce_modifiers.ts",
  find: "    if (opt.status !== \"active\") return fail(\"modifier_option_inactive\", opt.name || id);",
  with: "    if (false) return fail(\"modifier_option_inactive\", opt.name || id);",
});
{
  const r = await order(line({ selected_modifiers: [O_DEAD, O_A] }));
  leg("RULE", "an archived option cannot be bought",
    !r.ok && r.error === "modifier_option_inactive",
    `archived $99 option → ${r.error} · ${r.detail}`);
}

declareBreak({
  leg: "an archived group cannot be picked from",
  why: "a retired group's options must go with it, or the group's status is decorative",
  file: "supabase/functions/_shared/commerce_modifiers.ts",
  find: "    if (grp.status !== \"active\") return fail(\"modifier_group_inactive\", grp.name || grp.id);",
  with: "    if (false) return fail(\"modifier_group_inactive\", grp.name || grp.id);",
});
{
  const r = await computeAuthoritativeOrder(admin(), OTHER_BIZ,
    [{ product_id: ARCHIVED_HOST, qty: 1, selected_modifiers: [O_ARCHIVED_GRP] }]);
  leg("RULE", "an archived group cannot be picked from",
    !r.ok && r.error === "modifier_group_inactive",
    `option inside a retired group → ${r.error} · ${r.detail}`);
}

// AND THE OTHER DIRECTION, which is the one that would be found by a customer rather than by us.
declareBreak({
  leg: "an archived REQUIRED group does not block the sale",
  why: "enforcing min on an archived group makes every product it touched unpurchasable",
  file: "supabase/functions/_shared/commerce_modifiers.ts",
  find: "    if (!g || g.status !== \"active\") continue;",
  with: "    if (!g) continue;",
});
{
  // The retired group is min 1 and is the ONLY group attached to this product. If its min were
  // enforced, the product could never be bought again — which is a defect a customer finds.
  const r = await computeAuthoritativeOrder(admin(), OTHER_BIZ,
    [{ product_id: ARCHIVED_HOST, qty: 1, selected_modifiers: [] }]);
  const it = r.items && r.items[0];
  leg("RULE", "an archived REQUIRED group does not block the sale",
    r.ok && it && it.unit_price_cents === 10000,
    `a retired min-1 group is its only group, and it still sells at ${it && it.unit_price_cents}¢`);
}

/* ══ LEGS 13–15 — IDENTITY, THE SNAPSHOT AND THE CONTROLS ═════════════════════════════════ */

declareBreak({
  leg: "the order line freezes group and option NAMES and the adjustment",
  why: "an order that stores only ids becomes unreadable the moment a modifier is renamed or deleted",
  file: "supabase/functions/_shared/commerce_modifiers.ts",
  find: "    group_name: c.group.name,",
  with: "    group_name: \"\",",
});
{
  const r = await order(line({ selected_modifiers: [O_PROTECT, O_RUSH, O_B] }));
  const snap = (r.items && r.items[0] && r.items[0].selected_modifiers) || [];
  const shaped = snap.length === 3 &&
    snap.every((e) => e.group_id && e.group_name && e.option_id && e.option_name && typeof e.price_adjustment_cents === "number");
  // Ordered by the group's attachment order, then the option's own — not by what the client sent.
  const ordered = snap.map((e) => e.option_name).join(" · ") === "Rush Service · Protection · Option B";
  leg("RULE", "the order line freezes group and option NAMES and the adjustment, in display order",
    shaped && ordered && describeModifierSnapshot(snap) === "Rush Service +$25.00, Protection +$15.00, Option B +$10.00",
    `${snap.length} entries · ${describeModifierSnapshot(snap)}`);
}

declareBreak({
  leg: "the same choices in a different order are ONE cart line",
  why: "array order as identity splits one configuration into two lines and charges twice",
  file: "public/journey-os/commerce/storefront-cart.js",
  find: "    return out.sort();",
  with: "    return out;",
});
{
  Cart.mount(BIZ, null);
  Cart.clear();
  Cart.add({ productId: PREMIUM, variantId: V_PRE, modifiers: [O_RUSH, O_PROTECT], qty: 1, name: "a", price: 165 });
  Cart.add({ productId: PREMIUM, variantId: V_PRE, modifiers: [O_PROTECT, O_RUSH], qty: 1, name: "a", price: 165 });
  const afterSame = Cart.items().length;
  Cart.add({ productId: PREMIUM, variantId: V_PRE, modifiers: [O_RUSH], qty: 1, name: "b", price: 150 });
  Cart.add({ productId: PREMIUM, variantId: V_STD, modifiers: [O_RUSH, O_PROTECT], qty: 1, name: "c", price: 140 });
  Cart.add({ productId: PREMIUM, variantId: V_PRE, modifiers: [], qty: 1, name: "d", price: 125 });
  const lines = Cart.items();
  const merged = lines.find((l) => l.variantId === V_PRE && (l.modifiers || []).length === 2);
  leg("RULE", "the same choices in a different order are ONE cart line; different choices are not",
    afterSame === 1 && merged && merged.qty === 2 && lines.length === 4,
    `reordered pair merged to ${afterSame} line (qty ${merged && merged.qty}); 4 distinct configurations → ${lines.length} lines`);
}

declareBreak({
  leg: "the cart sends ids only",
  why: "a price in the payload is a price the server could be tempted to trust",
  file: "public/journey-os/commerce/storefront-cart.js",
  find: "      if (m.length) li.selected_modifiers = m;",
  with: "      if (m.length) li.selected_modifiers = m.map(function (x) { return { id: x, price: i.price }; });",
});
{
  const payload = Cart.buildLineItems();
  const withMods = payload.filter((l) => l.selected_modifiers);
  // Plain id STRINGS and nothing else. The canonical ORDER is the identity leg's claim, asserted
  // there — a leg that made both claims would go red for two different reasons and prove neither.
  const idsOnly = withMods.length > 0 && withMods.every((l) =>
    Array.isArray(l.selected_modifiers) && l.selected_modifiers.every((x) => typeof x === "string"));
  const keys = [...new Set(payload.flatMap((l) => Object.keys(l)))].sort().join(",");
  leg("RULE", "the cart sends ids only — no name, no price, no total",
    idsOnly && keys === "product_id,qty,selected_modifiers,variant_id",
    `payload keys = [${keys}]; ${withMods.length} line(s) carry a selection, every entry a bare id`);
  Cart.clear();
}

declareBreak({
  leg: "the page states each group's rule and carries option ids",
  why: "a control that does not say 'choose 1' lets a customer discover the rule by being refused",
  file: "public/journey-os/commerce/components.js",
  find: "      var required = Number(g.min) >= 1;",
  with: "      var required = false;",
});
{
  const os = Storefront.payloadToOs({
    settings: {}, collections: [], bundles: [],
    products: [{
      id: PREMIUM, name: "Premium Service", price_cents: 10000, variants: [], images: [],
      modifier_groups: [
        { id: G_EXTRAS, name: "Extras", min_select: 0, max_select: 2, options: [
          { id: O_RUSH, name: "Rush Service", price_adjustment_cents: 2500 },
          { id: O_PROTECT, name: "Protection", price_adjustment_cents: 1500 }] },
        { id: G_REQUIRED, name: "Required Choice", min_select: 1, max_select: 1, options: [
          { id: O_A, name: "Option A", price_adjustment_cents: 0 },
          { id: O_B, name: "Option B", price_adjustment_cents: 1000 }] },
      ],
    }],
  });
  const html = Components.ProductCard(os.products[0]);
  const optionValues = [...html.matchAll(/data-mod-option="([^"]+)"/g)].map((m) => m[1]);
  const saysRules = html.includes("Choose up to 2") && html.includes("Choose 1");
  const radiosForSingle = /type="radio"[^>]*data-mod-option="opt-a"/.test(html);
  const checkboxesForMulti = /type="checkbox"[^>]*data-mod-option="opt-rush"/.test(html);
  leg("RULE", "the page states each group's rule and carries option ids, never names",
    saysRules && radiosForSingle && checkboxesForMulti &&
    optionValues.join(",") === [O_RUSH, O_PROTECT, O_A, O_B].join(","),
    `rules shown: ${saysRules}; radios for max-1: ${radiosForSingle}; checkboxes for max-2: ${checkboxesForMulti}; ids = [${optionValues.join(", ")}]`);
}

/* ══ LEG 16 — NOTHING RESTAURANT-SHAPED WAS INTRODUCED ════════════════════════════════════ */
declareBreak({
  leg: "no restaurant-specific table, renderer or cart exists",
  why: "the leg must fire on a restaurant entity anywhere in Commerce",
  file: "public/journey-os/commerce/components.js",
  find: "  function CollectionCard(c) {",
  with: "  function CollectionCard(c) { /* menu_items */",
});
{
  const banned = "restaurant_[a-z_]+|menu_items|menu_sections|restaurant_menu|restaurant_product|restaurant_variant|restaurant_cart|pizza_modifiers|menu_modifiers";
  const hit = (dirs) => execFileSync("bash", ["-lc",
    `grep -rlE '${banned}' ${dirs.map((d) => JSON.stringify(join(ROOT, d))).join(" ")} 2>/dev/null || true`],
    { encoding: "utf8" }).trim();
  const migrations = hit(["supabase/migrations"]);
  const code = hit([
    "public/journey-os/commerce",
    "supabase/functions/commerce-api",
    "supabase/functions/create-store-checkout",
    "supabase/functions/_shared/commerce_checkout.ts",
    "supabase/functions/_shared/commerce_modifiers.ts",
  ]);
  leg("RULE", "no restaurant-specific table, renderer or cart exists",
    !migrations && !code,
    migrations || code
      ? `found in: ${[migrations, code].filter(Boolean).join(" ")}`
      : "clean across migrations, the storefront client, commerce-api, checkout and the resolver");
}

/* ── VERDICT ──────────────────────────────────────────────────────────────────────────────── */
const failed = legs.filter((l) => !l.pass);
console.log(`\n${legs.length - failed.length}/${legs.length} legs passed.`);
if (failed.length) {
  console.log("FAILED: " + failed.map((l) => l.name).join(" · "));
  process.exit(1);
}
console.log("PASS — a modifier is priced by the server, and survives into the order.");
process.exit(0);
