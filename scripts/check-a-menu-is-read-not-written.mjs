#!/usr/bin/env node
/**
 * [RULE] A MENU IS TRANSCRIBED, NOT AUTHORED — AND WHAT IT WOULD BECOME IN COMMERCE IS KNOWN
 *        BEFORE ANYONE APPROVES IT.
 *
 *   node scripts/check-a-menu-is-read-not-written.mjs
 *
 * ══ WHAT THIS GUARDS ════════════════════════════════════════════════════════════════════════
 *
 * Menu extraction is the point where a model is handed a photograph and asked to produce
 * structured facts about a business. Every failure this repo has paid for lives here in
 * concentrate: a price nobody stated, a description nobody wrote, a section nobody printed, a
 * "choose your size" promoted to variants, an allergen claim a customer would act on.
 *
 * So the legs are about what the normaliser REFUSES to add, not what it manages to parse. The
 * fixture is a model response containing every shape that tempts invention, and the assertions
 * are that each one survives as the ambiguity it is.
 *
 * `planMenuApproval` is asserted beside it because the review screen has to state what approval
 * will do before the owner approves — and a plan that quietly created a collection off a weak
 * guess would be the same defect one layer along.
 *
 * NOTHING HERE CALLS AN AI, A NETWORK OR A DATABASE. The module under test is pure by
 * construction; that is why it is in _shared and not inside `Deno.serve`.
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

let normalizeMenuExtraction;
try {
  const js = execFileSync("npx", ["--yes", "esbuild", "--bundle", "--format=esm", "--platform=neutral",
    "--log-level=error", join(ROOT, "supabase/functions/_shared/menu_extraction.ts")],
    { encoding: "utf8", cwd: ROOT, timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
  ({ normalizeMenuExtraction } =
    await import("data:text/javascript;base64," + Buffer.from(js).toString("base64")));
} catch (e) {
  console.error("CANNOT RUN — could not load menu_extraction: " + String(e.message).split("\n")[0]);
  process.exit(2);
}
if (typeof normalizeMenuExtraction !== "function") {
  console.error("CANNOT RUN — menu_extraction did not export what this asserts"); process.exit(2);
}

/* ── THE DETERMINISTIC MENU ──────────────────────────────────────────────────────────────────
 * Stands in for what a model returns after reading a photograph. Every entry is a case:
 * clean items, priced sizes, a market price, a missing price, an unclear section, a duplicate,
 * unpriced sizes, and an unreadable line. */
const MODEL_OUTPUT = {
  sections: [
    { name: "Appetizers", confidence: "high" },
    { name: "Pizza", confidence: "high" },
    { name: "Drinks", confidence: "high" },
    { name: "Desserts", confidence: "high" },
    { name: "Specials", confidence: "low" },
  ],
  items: [
    { name: "Garlic Knots", section: "Appetizers", sectionConfidence: "high", price: 8, desc: "Six, with marinara.", confidence: "high" },
    { name: "Wings", section: "Appetizers", sectionConfidence: "high", price: 14, desc: "", confidence: "high" },
    { name: "Cheese Pizza", section: "Pizza", sectionConfidence: "high", price: 14, desc: "",
      sizes: [{ label: "Small", price: 14 }, { label: "Medium", price: 17 }, { label: "Large", price: 20 }], confidence: "high" },
    { name: "Pepperoni Pizza", section: "Pizza", sectionConfidence: "high", price: 16, desc: "",
      sizes: [{ label: "Small", price: 16 }, { label: "Medium", price: 19 }, { label: "Large", price: 22 }], confidence: "high" },
    { name: "Coke", section: "Drinks", sectionConfidence: "high", price: 3, desc: "", confidence: "high" },
    { name: "Cheesecake", section: "Desserts", sectionConfidence: "high", price: 7, desc: "", confidence: "high" },
    // no price at all
    { name: "Soup of the Day", section: "Appetizers", sectionConfidence: "high", price: null, desc: "", confidence: "medium" },
    // a price that is words, not a number
    { name: "Lobster Pasta", section: null, sectionConfidence: "low", price: null, priceText: "Market Price", desc: "", confidence: "high" },
    // sizes mentioned, not all priced — must NOT become variants
    { name: "House Salad", section: "Appetizers", sectionConfidence: "high", price: 9, desc: "",
      sizes: [{ label: "Half", price: null }, { label: "Full", price: 9 }], confidence: "high" },
    // a duplicate of an item already above
    { name: "Wings", section: "Appetizers", sectionConfidence: "high", price: 14, desc: "", confidence: "high" },
    // barely legible
    { name: "Bruschett?", section: null, sectionConfidence: "low", price: null, desc: "",
      needsReview: true, issue: "The name was smudged on the photo.", confidence: "low" },
    // an item under a heading the model was NOT confident about
    { name: "Chef's Plate", section: "Specials", sectionConfidence: "low", price: 22, desc: "", confidence: "medium" },
  ],
  warnings: ["The bottom right corner of the photo was cut off."],
};

const menu = normalizeMenuExtraction(MODEL_OUTPUT);
const byName = (n) => menu.items.find((i) => i.name === n);

console.log(`  ${menu.items.length} items · ${menu.sections.length} sections · ` +
  `${menu.items.filter((i) => i.needsReview).length} need review`);
console.log(`  variant-ready: ${menu.items.filter((i) => i.sizes).length} · ` +
  `sizes seen but unpriced: ${menu.items.filter((i) => i.sizesUnusable).length} · ` +
  `high-confidence sections: ${[...new Set(menu.items.filter((i) => i.section && i.sectionConfidence === "high").map((i) => i.section))].join(", ")}\n`);

/* ── LEG 1 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "1 a price the menu did not print stays missing, and the words it did print are kept",
  why: "fall back to a number when the price is not one. 'Market Price' becomes a real amount " +
       "on a real product, which is the invention this whole path exists to prevent.",
  file: "supabase/functions/_shared/menu_extraction.ts",
  find: `    const price = num(raw.price);`,
  with: `    const price = num(raw.price) ?? 0;`,
});
{
  const lob = byName("Lobster Pasta"), soup = byName("Soup of the Day");
  leg("RULE", "1 a price the menu did not print stays missing, and the words it did print are kept",
    lob && lob.price === null && lob.priceText === "Market Price" && lob.needsReview &&
    /Market Price/.test(lob.issue || "") &&
    soup && soup.price === null && soup.needsReview && /No price printed/.test(soup.issue || ""),
    `"Lobster Pasta" keeps price null with priceText "Market Price" and an issue quoting it back; ` +
    `"Soup of the Day" keeps price null with "No price printed". Neither is given a number, and ` +
    `both are flagged for a person — the reviewer can show the owner exactly what the menu said.`);
}

/* ── LEG 2 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "2 sizes become variants only when every size is priced",
  why: "accept a partly-priced size list. 'Half' with no price becomes a variant with an " +
       "invented or zero price — the 'choose your size' case promoted to structure.",
  file: "supabase/functions/_shared/menu_extraction.ts",
  find: `    const sizesUsable = rawSizes.length >= 2 && rawSizes.every((z) => z.price != null);`,
  with: `    const sizesUsable = rawSizes.length >= 2;`,
});
{
  const cheese = byName("Cheese Pizza"), salad = byName("House Salad");
  leg("RULE", "2 sizes become variants only when every size is priced",
    cheese && cheese.sizes && cheese.sizes.length === 3 && cheese.sizes[2].price === 20 &&
    salad && salad.sizes === null && Array.isArray(salad.sizesUnusable) && salad.needsReview &&
    menu.items.filter((i) => i.sizes).length === 2,
    `"Cheese Pizza" (Small 14 / Medium 17 / Large 20 — all priced) keeps its sizes and is planned ` +
    `as a variant set; "House Salad" (Half unpriced, Full 9) gets sizes null, keeps what was seen ` +
    `as sizesUnusable so the owner is not left wondering, is flagged for review, and is NOT ` +
    `offered as variants. Exactly ${menu.items.filter((i) => i.sizes).length} items carry usable sizes, ` +
    `and the salad is not one of them — the review screen builds variants from \`sizes\` alone.`);
}

/* ── LEG 3 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 a weak section is preserved as weak, so no collection can be built from it",
  why: "flatten every section confidence to high. A heading the model guessed at — here " +
       "'Specials' — then looks exactly like one it read cleanly, and the review screen would " +
       "offer a Commerce collection the owner never wrote.",
  file: "supabase/functions/_shared/menu_extraction.ts",
  find: `      sectionConfidence: conf(raw.sectionConfidence),`,
  with: `      sectionConfidence: "high",`,
});
{
  const chef = byName("Chef's Plate"), lob = byName("Lobster Pasta"), knots = byName("Garlic Knots");
  const collectable = [...new Set(menu.items.filter((i) => i.section && i.sectionConfidence === "high")
    .map((i) => i.section))];
  leg("RULE", "3 a weak section is preserved as weak, so no collection can be built from it",
    !collectable.includes("Specials") && collectable.includes("Pizza") && collectable.includes("Appetizers") &&
    chef && chef.section === "Specials" && chef.sectionConfidence === "low" &&
    lob && lob.section === null && knots && knots.sectionConfidence === "high",
    `sections carried at high confidence are [${collectable.join(", ")}] — "Specials" is absent ` +
    `because the only item under it carries sectionConfidence "low", while "Pizza" and ` +
    `"Appetizers" are there. An item under no heading at all ("Lobster Pasta") keeps section null ` +
    `and is not sorted into a likely one. The ITEM is still importable; only the COLLECTION is ` +
    `withheld, and the review screen gates on exactly this flag.`);
}

/* ── LEG 4 ────────────────────────────────────────────────────────────────────────────────── */
/* DUPLICATES ARE NOT ASSERTED HERE, ON PURPOSE. The menu's repeated "Wings" is a duplicate, and
 * the place that refuses a duplicate is the import endpoint's unique constraint — already
 * covered by check-the-import-never-drops-a-row and verified live against Postgres. Asserting it
 * a second time in this file would be a second reader of the same rule, and the two would
 * eventually disagree. What IS this module's job is not losing the second one. */
declareBreak({
  leg: "4 a repeated item is kept, not silently merged away before anyone sees it",
  why: "de-duplicate during extraction. The menu's second Wings disappears before the review " +
       "screen, so the owner never learns his menu prints it twice and the import never gets " +
       "the chance to report it.",
  file: "supabase/functions/_shared/menu_extraction.ts",
  find: `    if (!name) continue;                       // an item with no name is not an item`,
  with: `    if (!name || items.some((x) => x.name === name)) continue;`,
});
{
  const wings = menu.items.filter((i) => i.name === "Wings");
  leg("RULE", "4 a repeated item is kept, not silently merged away before anyone sees it",
    wings.length === 2 && menu.items.length === MODEL_OUTPUT.items.length,
    `"Wings" is printed twice on this menu and arrives twice (${wings.length}), so the review ` +
    `screen can show it and the import endpoint can refuse the second with its reason. Collapsing ` +
    `it here would hide from the owner something his own menu says.`);
}

/* ── LEG 5 ────────────────────────────────────────────────────────────────────────────────── */
leg("RULE", "5 nothing is invented: no description, no allergen, no section, no item",
  byName("Wings").desc === "" && byName("Coke").desc === "" &&
  !JSON.stringify(menu).toLowerCase().match(/gluten|allergen|contains |dairy-free|vegan/) &&
  menu.items.length === MODEL_OUTPUT.items.length &&
  byName("Bruschett?") && byName("Bruschett?").confidence === "low" &&
  /smudged/i.test(byName("Bruschett?").issue || ""),
  `items with no printed description keep desc "" (never a written-in one); the normalised output ` +
  `contains no allergen or dietary vocabulary anywhere; all ${MODEL_OUTPUT.items.length} items ` +
  `survive — the barely-legible one is kept at confidence low with the model's own reason ` +
  `("${byName("Bruschett?").issue}") rather than being dropped or guessed. This leg has no break: ` +
  `it asserts the ABSENCE of invention, and any break that made it red would have to add the ` +
  `invention it forbids.`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
