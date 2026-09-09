/**
 * Assertions for scripts/check-services-block.mjs.
 *
 * 38 of 120 generated pages have no services area and no placeholder rows. Their owners
 * were offered a full page rebuild for typing their prices. This checks the small answer:
 * add the area, from real services, and leave the rest of the page alone.
 */
import { addServicesBlock, servicesBlockHtml } from "../../supabase/functions/_shared/hubly_services_block.ts";

const fails: string[] = [];
const t = (n: string, c: boolean, d: string) => { if (!c) fails.push(`${n} — ${d}`); };
const visible = (h: string) => h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const NO_SERVICES = `<body><header><nav>Home</nav></header><main>
<section class="hero"><h1>Ridgeline Roofing</h1><p>Roofing in Boise.</p></section>
<section class="about"><h2>About</h2><p>Family run since forever.</p></section>
</main><footer><p>Call 555-0100</p></footer></body>`;

const HAS_SERVICES = `<body><main><section class="s"><h3 data-hubly-service="Full Detail">Full Detail</h3></section></main><footer>x</footer></body>`;

const SVCS = [
  { name: "Roof Replacement", price: 8500 },
  { name: "Gutter Clearing", price: 120, description: "Twice a year keeps it clear." },
  { name: "Storm Repair" },
];

// ── inserts, with the real services and nothing invented ────────────────────
const r = addServicesBlock(NO_SERVICES, SVCS, "#c2410c");
t("inserts", r.changed === true && r.via === "inserted", `via=${r.via} detail=${r.detail}`);
if (r.changed) {
  const h = r.html;
  t("stamped at insertion", /<section[^>]*data-hubly-section="services"/.test(h), "the new section carries no services stamp");
  t("every name present", SVCS.every((s) => h.includes(s.name)), "a service name is missing from the output");
  t("prices present", h.includes("$8500") && h.includes("$120"), "a stated price is missing");
  t("no price invented", !/\$\s?0\b/.test(h) && (h.match(/\$/g) || []).length === 2, "a price appeared for a service that had none");
  t("anchors on names", /data-hubly-service="Roof Replacement"/.test(h), "the name element carries no anchor");
  // THE RULE THAT COST TWO DAYS.
  t("NO PLACEHOLDER ROWS", !/data-hubly-guess/i.test(h), "the new block contains a guess row");
  t("no instructional copy", !/Use this row|once the owner confirms|wants to be known for/i.test(h), "the block contains copy addressed to the owner");
  t("page's own content untouched", h.includes("Family run since forever.") && h.includes("Ridgeline Roofing"), "existing page text was altered");
  t("inserted before the footer", h.indexOf("data-hubly-services-block") < h.lastIndexOf("<footer"), "the block landed after the footer");
  t("no marker leaked into visible text", !/data-hubly-/.test(visible(h)), "one of our attributes is readable on the page");
  t("reports what it added", r.inserted.length === 3, `inserted=${JSON.stringify(r.inserted)}`);
  // idempotent: it refuses to add a second one
  const again = addServicesBlock(h, SVCS);
  t("refuses a second area", again.changed === false && again.via === "anchor", `via=${again.via}`);
}

// ── refuses when the page already has services ──────────────────────────────
const r2 = addServicesBlock(HAS_SERVICES, SVCS);
t("refuses on a page that has services", r2.changed === false && r2.via === "anchor", `via=${r2.via}`);

// ── refuses with nothing real to add ────────────────────────────────────────
const r3 = addServicesBlock(NO_SERVICES, []);
t("refuses with no services", r3.changed === false && r3.via === "missed", `via=${r3.via}`);
t("empty block is empty", servicesBlockHtml([]) === "", "an empty services list produced markup");

if (fails.length) {
  console.error(`FAIL — ${fails.length}:`);
  for (const f of fails) console.error("  " + f);
  Deno.exit(1);
}
console.log("PASS — adds a real services area, stamped, no placeholder rows, page untouched, refuses when it shouldn't run.");
Deno.exit(0);
