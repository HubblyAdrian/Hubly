#!/usr/bin/env node
/**
 * [RULE] EVERY ROW SENT TO THE PRODUCT IMPORT IS ACCOUNTED FOR IN THE ANSWER, AND AN IMPORTED
 *        PRODUCT IS NOT BORN UNSELLABLE.
 *
 *   node scripts/check-the-import-never-drops-a-row.mjs
 *
 * ══ THE TWO DEFECTS ═════════════════════════════════════════════════════════════════════════
 *
 * **Silently dropped duplicates.** `commerce_products` carries `unique (business_id, slug)`, the
 * slug is derived from the name, and the import loop was `if (!error && data) inserted.push(data)`.
 * A rejected insert vanished; the response said `imported: N` and nothing said a row had been
 * dropped or why. Two rows called "House Salad" go in, one product comes out, and the number
 * looks like a success. The slug also collides on case and punctuation — `House Salad`,
 * `house salad` and `HOUSE SALAD!` are all `house-salad`.
 *
 * **Unsellable on arrival.** The import wrote `inventory: 0` and never wrote `track_inventory`,
 * so the column default `true` applied, and checkout refuses
 * `track_inventory !== false && inventory < qty`. Every imported product was `have 0, want 1`
 * the moment it was published — a failure invisible at import time that surfaces to a customer.
 *
 * ══ WHY THE LEGS RUN AGAINST THE REAL MODULE, WITH NO DATABASE ══════════════════════════════
 *
 * The logic used to live inside `Deno.serve` where nothing could call it. It is now
 * `_shared/commerce_import.ts`, a pure function, bundled here with esbuild and executed — so
 * these legs judge the product's own decisions, not a copy of them. Persistence, authorisation
 * and the HTTP contract stay in commerce-api and are NOT what this file asserts.
 *
 * The fixture is a small menu because a menu is the case that produces repeated names naturally;
 * nothing in the module, the endpoint or these legs knows what a restaurant is.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/* THE REAL PLANNER — bundled from the shipping module, so a leg cannot pass against a rewrite. */
let planProductImport;
try {
  const js = execFileSync("npx", ["--yes", "esbuild", "--bundle", "--format=esm", "--platform=neutral",
    "--log-level=error", join(ROOT, "supabase/functions/_shared/commerce_import.ts")],
    { encoding: "utf8", cwd: ROOT, timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
  ({ planProductImport } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64")));
} catch (e) {
  console.error("CANNOT RUN — could not load commerce_import: " + String(e.message).split("\n")[0]);
  process.exit(2);
}
if (typeof planProductImport !== "function") {
  console.error("CANNOT RUN — planProductImport not exported"); process.exit(2);
}

/* ── THE FIXTURE: a small menu, with the duplicate the defect was found on ──────────────────── */
const MENU = [
  { name: "Burger", price: 12.5, description: "Quarter pound, cheddar, house pickles." },
  { name: "House Salad", price: 8, description: "Leaves, radish, lemon dressing." },
  { name: "Coke", price: 3 },
  { name: "Burger", slug: "burger-double", price: 16, description: "Double patty." },
  { name: "House Salad", price: 9, description: "Dinner portion." },
  { price: 5, description: "a row whose name never made it through the caller" },
];
const EXISTING = { "coke-zero": "11111111-1111-1111-1111-111111111111" };

const plan = planProductImport(MENU, { existingSlugs: EXISTING });
const bySource = (i) => plan.create.find((c) => c.sourceIndex === i) ||
                        plan.skipped.find((s) => s.sourceIndex === i);

console.log(`  ${MENU.length} rows in → ${plan.create.length} create, ${plan.skipped.length} skipped`);
plan.create.forEach((c) => console.log(`    create  [${c.sourceIndex}] ${c.name} → ${c.slug} ` +
  `· ${c.row.status} · track_inventory=${c.row.track_inventory} · inventory=${JSON.stringify(c.row.inventory)}`));
plan.skipped.forEach((s) => console.log(`    skip    [${s.sourceIndex}] ${s.name} → ${s.reason}`));
console.log("");

/* ── LEG 1 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "1 every row sent is accounted for, as a create or as a skip with a reason",
  why: "restore the endpoint's original `if (!name) continue;` — a row the caller sent is " +
       "discarded without appearing anywhere in the answer, which is the whole defect, reached " +
       "through the nameless row rather than the duplicate so that leg 2 is untouched.",
  file: "supabase/functions/_shared/commerce_import.ts",
  find: `      skipped.push({
        sourceIndex, name: null, slug: null,
        reason: "missing_name",`,
  with: `      if (true) return;
      skipped.push({
        sourceIndex, name: null, slug: null,
        reason: "missing_name",`,
});
{
  const accounted = plan.create.length + plan.skipped.length;
  const everyIndex = MENU.every((_, i) => bySource(i) != null);
  const everySkipHasReason = plan.skipped.every((s) => !!s.reason && !!s.detail && s.detail.length > 20);
  leg("RULE", "1 every row sent is accounted for, as a create or as a skip with a reason",
    accounted === MENU.length && everyIndex && everySkipHasReason,
    `${MENU.length} rows in, ${plan.create.length} creates + ${plan.skipped.length} skips = ${accounted} out; ` +
    `every sourceIndex present: ${everyIndex}; every skip carries a reason AND a sentence a person ` +
    `can act on: ${everySkipHasReason}. Before the fix the second "House Salad" was discarded by ` +
    `\`if (!error && data)\` and the response reported a smaller number with no explanation.`);
}

/* ── LEG 2 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "2 a duplicate is refused rather than guessed at, and nothing existing is overwritten",
  why: "report the collision without saying WHICH product already holds the address. The row is " +
       "still refused, so leg 1 is untouched — but 'something already has that name' with no id " +
       "is not something a caller can act on, and the owner is left to guess which product.\n" +
       "A first attempt auto-suffixed the slug and BROKE THE CHECK instead of failing a leg: it " +
       "assigned to a const. A break that stops the module compiling has tested nothing.",
  file: "supabase/functions/_shared/commerce_import.ts",
  find: `        existingProductId: existing[slug],`,
  with: `        existingProductId: undefined,`,
});
{
  const dup = plan.skipped.find((s) => s.reason === "duplicate_in_request");
  const existingHit = planProductImport([{ name: "Coke Zero", price: 3 }], { existingSlugs: EXISTING });
  const exSkip = existingHit.skipped.find((s) => s.reason === "duplicate_existing");
  leg("RULE", "2 a duplicate is refused rather than guessed at, and nothing existing is overwritten",
    !!dup && dup.sourceIndex === 4 && dup.conflictsWithSourceIndex === 1 && dup.slug === "house-salad" &&
    !!exSkip && exSkip.existingProductId === EXISTING["coke-zero"] && existingHit.create.length === 0,
    `the second "House Salad" (row 5) is skipped as duplicate_in_request naming row 2 and the slug ` +
    `they collide on; a row colliding with a product the business ALREADY has is skipped as ` +
    `duplicate_existing carrying that product's id (${exSkip ? exSkip.existingProductId : "—"}), and ` +
    `produces no create. Neither guesses a new slug and neither overwrites the existing product — ` +
    `the caller is told and decides.`);
}

/* ── LEG 3 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 an imported product with no stock declared is not stock-tracked",
  why: "restore the shipped behaviour — inventory 0 with tracking left to the column default of " +
       "true. Checkout then refuses every imported product the moment it is published, with " +
       "`insufficient_stock (have 0, want 1)`.",
  file: "supabase/functions/_shared/commerce_import.ts",
  find: `        inventory: invRaw,
        track_inventory: track,`,
  with: `        inventory: invRaw == null ? 0 : invRaw,
        track_inventory: track || invRaw == null,`,
});
{
  const burger = bySource(0);
  const noStock = plan.create.every((c) => c.row.track_inventory === false && c.row.inventory === null);
  // …and a caller who DOES count stock keeps tracking, unchanged.
  const counted = planProductImport([{ name: "Branded Mug", price: 12, inventory: 24 }]);
  const mug = counted.create[0];
  leg("RULE", "3 an imported product with no stock declared is not stock-tracked",
    noStock && !!burger && burger.row.track_inventory === false && burger.row.inventory === null &&
    !!mug && mug.row.track_inventory === true && mug.row.inventory === 24,
    `no row in the menu declares stock, and every one imports track_inventory=false / inventory=null, ` +
    `so checkout's \`track_inventory !== false\` gate does not bind. A row that DOES declare stock ` +
    `(inventory 24) keeps track_inventory=true and inventory=24 — legitimate inventory-controlled ` +
    `products are unaffected, which is the half a blanket "never track" fix would have broken.`);
}

/* ── LEG 4 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "4 an imported product is a draft unless the caller says otherwise",
  why: "publish on import. Anything imported — including anything a model produced — reaches " +
       "customers with nobody having looked at it.",
  file: "supabase/functions/_shared/commerce_import.ts",
  find: `        status: raw.status ? String(raw.status) : "draft",`,
  with: `        status: raw.status ? String(raw.status) : "active",`,
});
leg("RULE", "4 an imported product is a draft unless the caller says otherwise",
  plan.create.every((c) => c.row.status === "draft"),
  `all ${plan.create.length} created rows carry status "draft". Checkout refuses a non-active ` +
  `product (\`status !== "active"\` → product_unavailable) and the storefront does not show one, so ` +
  `an import cannot put anything in front of a customer on its own.`);

/* ── LEG 5 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "5 a price that cannot be read is refused, not silently turned into free",
  why: "coerce an unreadable price to 0 the way `Number(raw.price) || 0` did. A product whose " +
       "price nobody could read is created at $0.00 and is one publish away from being sold for " +
       "nothing.",
  file: "supabase/functions/_shared/commerce_import.ts",
  find: `      const d = num(raw.price);
      if (d == null || d < 0) {`,
  with: `      const d = num(raw.price) ?? 0;
      if (d == null || d < 0) {`,
});
{
  const messy = planProductImport([
    { name: "Market Fish", price: "market price" },
    { name: "Soup", price: 6 },
  ]);
  const bad = messy.skipped.find((s) => s.reason === "invalid_price");
  leg("RULE", "5 a price that cannot be read is refused, not silently turned into free",
    !!bad && bad.name === "Market Fish" && messy.create.length === 1 &&
    messy.create[0].row.price_cents === 600,
    `"market price" is refused as invalid_price and creates nothing; the readable row beside it ` +
    `still imports at 600 cents. A missing price is still 0 — that is the column's own default and ` +
    `was not changed — but an UNREADABLE one is reported rather than published as free.`);
}

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
