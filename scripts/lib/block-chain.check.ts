/**
 * THE TWO BLOCKS TAKE ONE PATH. Red-proof for the chain clone, both sides of it.
 *
 * Adrian walked ridgeline-pressure-washing on 2026-09-12 and found the services block and
 * the hours block carrying the IDENTICAL fault — set at x=0 while the page's own content
 * began at 80px, price column flush against the viewport edge. It was never a services
 * bug: two blocks, one defect, because they shared a donor rule that cloned a single tag
 * and therefore missed the wrapper the page's inset actually lives on.
 *
 * So this asserts the property rather than the symptom: BOTH blocks put their content
 * inside the donor's own wrapper chain, and a later edit that adds a fact puts it inside
 * that wrapper too.
 *
 *   deno run -A scripts/lib/block-chain.check.ts
 *
 * Exit: 0 PASS · 1 FAIL
 */
import { addServicesBlock, pickChainDonor } from "../../supabase/functions/_shared/hubly_services_block.ts";
import { placeContactHoursInFreeform } from "../../supabase/functions/_shared/hubly_contact.ts";

const fails: string[] = [];
const ok = (cond: unknown, msg: string) => { if (!cond) fails.push(msg); };

// ── RED-PROOF, EVERY RUN (Lesson 40) ────────────────────────────────────────
// A check's first green is meaningless. The assertions below ask whether a block carries
// the wrapper that holds the page's inset; this proves that question can answer NO, by
// asking it of a block that plainly does not — the shape that shipped on
// ridgeline-pressure-washing, where both blocks sat at x=0 while the page's content began
// at 80px. If it cannot tell them apart, every assertion under it is decoration.
{
  const WITH_WRAP = `<section data-hubly-services-block class="process"><div data-hubly-sv-list class="wrap"><h3>X</h3></div></section>`;
  const WITHOUT = `<section data-hubly-services-block class="process"><div data-hubly-sv-list class="steps"><h3>X</h3></div></section>`;
  const carriesWrap = (b: string) => /class="[^"]*\bwrap\b/i.test(b);
  if (!carriesWrap(WITH_WRAP) || carriesWrap(WITHOUT)) {
    console.error("CANNOT RUN — the inset assertion failed its own fixtures:");
    console.error(`  block WITH the wrapper recognised : ${carriesWrap(WITH_WRAP)} (expected true)`);
    console.error(`  block WITHOUT it recognised       : ${carriesWrap(WITHOUT)} (expected false)`);
    Deno.exit(2);
  }
}

/** A page shaped like the ones we generate: the inset lives on an inner wrapper, and the
 *  item grid is three-up because the page had three things to say. */
const PAGE = `<!doctype html><html><head><style>
  .wrap{max-width:1120px;margin:0 auto}
  .steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
  .step{background:#123;padding:22px}
  .step:before{content:counter(steps);display:block}
</style></head><body>
<header><a href="#">Ridgeline</a></header>
<main>
  <section class="hero"><div class="wrap"><h1>Ridgeline Pressure Washing</h1></div></section>
  <section class="process"><div class="wrap"><h2>How it works</h2>
    <div class="steps">
      <div class="step"><h3>Open the request</h3><p>One.</p></div>
      <div class="step"><h3>Describe the surface</h3><p>Two.</p></div>
      <div class="step"><h3>Send the location</h3><p>Three.</p></div>
    </div></div></section>
</main>
<footer><p>Provo</p></footer></body></html>`;

const donor = pickChainDonor(PAGE);
ok(!!donor, "pickChainDonor found no chain on a page that plainly has one");
ok(donor?.opens.length === 2, `the chain should be <section> + .wrap, got ${donor?.opens.length}`);
ok((donor?.containerOpen || "").includes("steps"), "the item container is not the .steps grid");
ok((donor?.itemOpen || "").includes("step"), "the item template is not a .step card");

// ── THE SERVICES BLOCK ─────────────────────────────────────────────────────────
const sv = addServicesBlock(PAGE, [
  { name: "Driveway washing", price: 150 },
  { name: "House soft wash", price: 300 },
], "#176a8a", 0);
ok(sv.changed && sv.via === "inserted", `services block did not insert: ${sv.via} ${sv.detail}`);
ok(sv.detail === "chain", `services block took the ${sv.detail} path, not the chain`);
const svBlock = /<section[^>]*data-hubly-services-block[\s\S]*?<\/section>/i.exec(sv.html)?.[0] ?? "";
ok(/class="[^"]*\bwrap\b/i.test(svBlock), "THE INSET IS MISSING — the services block did not clone the .wrap that carries it");
ok(/data-hubly-sv-list/i.test(svBlock), "the cloned container is not stamped, so the column override binds to nothing");
ok(/data-hubly-sv-row/i.test(svBlock), "the cloned rows are not stamped");
ok(/grid-template-columns:1fr!important/i.test(sv.html), "the column override is not in the emitted CSS");
ok(/\[data-hubly-sv-row\]::before/i.test(sv.html), "the donor's counter badge is not suppressed on our rows");
ok(!/How it works/i.test(svBlock), "THE DONOR'S TEXT WAS CLONED — the block carries the donor's heading copy");
ok(!/One\.|Two\.|Three\./.test(svBlock), "THE DONOR'S ITEM TEXT WAS CLONED into our rows");
ok(svBlock.includes("Driveway washing") && svBlock.includes("$150"), "the owner's own services are not in the block");

// ── THE HOURS/CONTACT BLOCK — same page, same chain ────────────────────────────
const ch = placeContactHoursInFreeform(PAGE, {
  hoursRows: [
    { weekday: 1, open: "08:00", close: "17:00", closed: false },
    { weekday: 6, open: "09:00", close: "13:00", closed: false },
  ],
  phone: null, email: null, address: null, accent: "#176a8a",
});
const chBlock = /<section[^>]*data-hubly-contact-block[\s\S]*?<\/section>/i.exec(ch.html)?.[0] ?? "";
ok(ch.changed, "contact/hours block did not insert");
ok(/class="[^"]*\bwrap\b/i.test(chBlock), "THE INSET IS MISSING — the hours block did not clone the .wrap that carries it. This is the ridgeline fault, back on the other block.");
ok(/data-hubly-ch-body/i.test(chBlock), "the hours block's body wrapper is not stamped, so a later append lands outside the chain");
ok(!/How it works/i.test(chBlock), "the hours block cloned the donor's heading copy");

// ── A LATER EDIT LANDS INSIDE THE CHAIN ────────────────────────────────────────
const added = placeContactHoursInFreeform(ch.html, {
  hoursRows: [], phone: "801-555-0301", email: null, address: null, accent: null,
});
// MEASURED INSIDE THE BLOCK, not against the first </section> in the document — that one
// belongs to the hero, several sections earlier, and comparing against it passed a block
// whose list had landed in the wrong place. The landmark has to be the thing you mean.
const addedBlock = /<section[^>]*data-hubly-contact-block[\s\S]*?<\/section>/i.exec(added.html)?.[0] ?? "";
const bodyOpen = addedBlock.search(/data-hubly-ch-body/i);
const listAt = addedBlock.search(/class="hubly-ch-list"/i);
ok(added.changed, "the later phone append did nothing");
ok(bodyOpen >= 0 && listAt > bodyOpen,
  "A LATER APPEND LANDED OUTSIDE THE WRAPPER — the added row is full-bleed while the rest of the block is inset");
ok(!/<dl[^>]*data-hubly-hours[\s\S]*?<ul class="hubly-ch-list"[\s\S]*?<\/dl>/i.test(addedBlock),
  "the contact list landed INSIDE the hours <dl> — a non-greedy regex stopped at the first </div>");

if (fails.length) {
  console.error(`FAIL — ${fails.length} assertion(s):`);
  for (const f of fails) console.error("  " + f);
  Deno.exit(1);
}
console.log("PASS — both blocks clone the donor's chain, keep their own content, stamp what the CSS binds to, and a later append stays inside the wrapper. (detector red-proofed this run)");
