/**
 * The assertions for scripts/check-guess-row-insert.mjs, in Deno because the registry is
 * a Deno module (https: imports; Node's loader refuses it — the first run of this check
 * exited 2 CANNOT RUN for exactly that reason, which is the correct answer and not a pass).
 */
import { insertServiceIntoFreeform } from "../../supabase/functions/_shared/hubly_capability_registry.ts";

if (typeof insertServiceIntoFreeform !== "function") { console.error("CANNOT RUN — insertServiceIntoFreeform is not exported"); Deno.exit(2); }
const insert = insertServiceIntoFreeform as (h: string, n: string, p?: number, d?: string, g?: boolean) => any;

// Markup copied from the shape a real generated page has (aviation-business, v1).
const GUESS_PAGE = `<body><section class="services"><div class="section-head"><h2>Services</h2></div>
<div class="services-list">
  <div class="service-row" data-hubly-guess="editable service row">
    <h3 data-hc="section.1.item.1.title">Aviation services</h3>
    <p data-hc="section.1.item.1.body">Use this row for the primary work the company wants to be known for.</p>
  </div>
  <div class="service-row" data-hubly-guess="editable service row">
    <h3 data-hc="section.1.item.2.title">Consulting or operational support</h3>
    <p data-hc="section.1.item.2.body">Use this row for advisory work once the owner confirms what's actually offered.</p>
  </div>
</div></section></body>`;

const REAL_PAGE = `<body><section class="services"><div class="services-list">
  <div class="service-row"><h3 data-hubly-service="Full Detail">Full Detail</h3><p data-hubly-price="">$85</p></div>
</div></section></body>`;

const NO_SECTION = `<body><section class="about"><h2>About us</h2><p>We are a business.</p></section></body>`;

const fails = [];
const t = (name, cond, detail) => { if (!cond) fails.push(`${name} — ${detail}`); };

// ── (b) guess rows: REPLACE, don't append ───────────────────────────────────
const b1 = insert(GUESS_PAGE, "1st Flight", 250, undefined, true);
t("(b) inserts", b1 && b1.ok === true, `expected ok, got ${JSON.stringify(b1 && b1.reason)}`);
if (b1 && b1.ok) {
  const h = b1.html;
  t("(b) replaced not appended", b1.replacedGuess === true, "replacedGuess was not true");
  t("(b) placeholder copy gone", !/Use this row for the primary work/.test(h), "the first placeholder's instructional sentence is still on the page");
  t("(b) row count unchanged", (h.match(/class="service-row"/g) || []).length === 2, `expected 2 rows (one overwritten), got ${(h.match(/class="service-row"/g) || []).length}`);
  t("(b) real name present", /1st Flight/.test(h), "the service name is not on the page");
  t("(b) name is the VISIBLE title", /<h3[^>]*>1st Flight<\/h3>/.test(h), "the placeholder's own title text is still what a visitor reads");
  t("(b) THE PRICE LANDS", /250/.test(h), "ok was reported but no price reached the page — the row shape has no price slot and the price was dropped");
  t("(b) anchor stamped", /data-hubly-service="1st Flight"/.test(h), "the new row carries no data-hubly-service anchor");
  t("(b) guess mark removed", !/data-hubly-guess="editable service row">\s*<h3[^>]*>1st Flight/.test(h) && (h.match(/data-hubly-guess/g) || []).length === 1,
    `expected exactly 1 remaining guess row, got ${(h.match(/data-hubly-guess/g) || []).length}`);
  t("(b) second placeholder untouched", /Consulting or operational support/.test(h), "the second placeholder was destroyed");

  // second service consumes the SECOND placeholder, in order
  const b2 = insert(h, "Classes", 300, undefined, true);
  t("(b2) second insert ok", b2 && b2.ok === true, `expected ok, got ${JSON.stringify(b2 && b2.reason)}`);
  if (b2 && b2.ok) {
    t("(b2) replaced the second placeholder", b2.replacedGuess === true, "appended instead of replacing");
    t("(b2) its copy gone", !/once the owner confirms/.test(b2.html), "the second placeholder's instructional sentence survived");
    t("(b2) no guess rows left", (b2.html.match(/data-hubly-guess/g) || []).length === 0, "guess marks remain");
  }
}

// ── (a) real anchors: behaviour must be IDENTICAL to today ──────────────────
// Called exactly as the caller now calls it for a page that HAS anchors (flag false).
const a1 = insert(REAL_PAGE, "Ceramic Coating", 600, undefined, false);
t("(a) still inserts", a1 && a1.ok === true, `expected ok, got ${JSON.stringify(a1 && a1.reason)}`);
if (a1 && a1.ok) {
  t("(a) appended, not replaced", a1.replacedGuess !== true, "a real-anchor page took the guess-row path");
  t("(a) original service kept", /data-hubly-service="Full Detail"/.test(a1.html), "the existing real service was overwritten");
  t("(a) two rows now", (a1.html.match(/class="service-row"/g) || []).length === 2, "the clone did not append");
}

// ── (c) neither: the honest handoff, and only then ──────────────────────────
const c1 = insert(NO_SECTION, "Anything", 10, undefined, true);
t("(c) refuses", c1 && c1.ok === false && c1.reason === "no_section", `expected no_section, got ${JSON.stringify(c1)}`);

if (fails.length) {
  console.error(`FAIL — ${fails.length}:`);
  for (const f of fails) console.error("  " + f);
  Deno.exit(1);
}
console.log("PASS — (a) real anchors unchanged, (b) guess rows replaced in order and stamped, (c) honest handoff only when there is genuinely no section.");
Deno.exit(0);
