/**
 * Assertions for check-facts-are-grounded.mjs — run under Deno so the registry and the
 * grounding library are the REAL modules, not their source text.
 *
 * THE RULE (CLAUDE.md): **never publish a fact the owner did not state.** A fact write requires
 * a value sourced from the CURRENT turn's user message. The scar: on 2026-09-01, a re-asked
 * "add my phone number" with no number in it made the model lift `801-888-8888` from an earlier
 * turn, on a page a customer could call.
 *
 * `hubly_grounding.ts` was written for exactly this and **nothing asserted that any writer calls
 * it** until 2026-09-14 — the bandage was in the drawer. Of 31 product rules in CLAUDE.md and
 * SETTLED, 13 had no check; this is the one whose violation reaches a customer's screen.
 *
 * THREE LEGS, and leg 1 is the one that matters:
 *   1. BEHAVIOUR — the library is RUN against the scar itself and against a lifted service.
 *      A grounding library that cannot refuse a lift is decoration, and no amount of call-site
 *      coverage fixes it. (Lesson 83: assert the behaviour, not the shape.)
 *   2. COVERAGE — every owner-fact writer in the registry calls a grounding entry point, or is
 *      named here with a reason.
 *   3. THE FROZEN BASELINE — the facts each writer does NOT ground today, listed one by one.
 *      A new ungrounded fact fails. The list shrinking is the work; the list growing is the bug.
 *
 * WHAT THIS DOES NOT ASSERT, said rather than implied:
 *   · that a service the model OMITS survives. `set_business_draft_services` is replace-all and
 *     the reconciler only walks the list it is given, so a service dropped from the model's
 *     list is deleted. The convention "pass the COMPLETE current list every time" lives in the
 *     action's description — a prompt, not a structure. Recorded in OPEN_FINDINGS; it is a
 *     different rule (a default that destroys work) and it needs its own fix.
 *   · that hours are grounded. There is no hoursGrounded(); see the frozen baseline.
 *   · anything about the CLIENT-side write paths in public/ — this reads the server registry.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { HUBLY_CAPABILITY_REGISTRY as REGISTRY } from "../../supabase/functions/_shared/hubly_capability_registry.ts";
import {
  addressGrounded, emailGrounded, phoneGrounded, priceGrounded, serviceGrounded, reconcileServices,
} from "../../supabase/functions/_shared/hubly_grounding.ts";
import { composeServicesTruth } from "../../supabase/functions/_shared/hubly_owner_replies.ts";

const fails: string[] = [];

// ── LEG 1 — THE LIBRARY, RUN ─────────────────────────────────────────────────────────────
// Each case is a real failure or a real answer, not a synthetic one. A library that passed
// only the happy cases would refuse the owner's own phone number and be removed within a week.
const CASES: [string, boolean, boolean][] = [
  // [what it is, actual, expected]
  ["THE SCAR — a number from an earlier turn, on a message that names none",
    phoneGrounded("801-888-8888", "add my phone number"), false],
  ["the same number, typed this turn, formatted differently",
    phoneGrounded("801-888-8888", "sure, it's (801) 888 8888"), true],
  ["the same number, spelled out in words",
    phoneGrounded("8018888888", "eight oh one, eight eight eight, eight eight eight eight"), true],
  ["a DIFFERENT number in the message does not ground this one",
    phoneGrounded("801-888-8888", "call the shop on 801 555 1234"), false],
  ["an email nobody typed", emailGrounded("adrian@graefs.com", "add my email"), false],
  ["an email typed this turn", emailGrounded("adrian@graefs.com", "it's Adrian@Graefs.com"), true],
  ["an address nobody typed", addressGrounded("742 Evergreen Terrace", "put my address on the page"), false],
  ["an address typed this turn", addressGrounded("742 Evergreen Terrace", "we're at 742 evergreen terrace, lehi"), true],
  ["a price nobody stated", priceGrounded(600, "add ceramic coating"), false],
  ["a price stated this turn", priceGrounded(600, "ceramic coating is $600"), true],
  ["a price that is a FRAGMENT of another number", priceGrounded(150, "we did 1500 cars last year"), false],
  ["a service nobody named this turn", serviceGrounded("Ceramic Coating", 600, "add my services"), false],
  ["a service named this turn", serviceGrounded("Ceramic Coating", 600, "ceramic coating, six hundred"), true],
];
for (const [what, got, want] of CASES) {
  if (got !== want) fails.push(`GROUNDING IS WRONG — ${what}: got ${got}, must be ${want}`);
}

// The reconciler is the one an owner's whole list passes through, and its job is subtler: keep
// what the RECORD already holds, use what THIS message states, and drop only a new-and-unstated
// lift. Getting this wrong deletes services off a live page — the 2026-09-01 filter defect.
{
  const existing = [{ name: "Express Wash", price: 60 }, { name: "Full Detail", price: 180 }];

  // A NEW SERVICE THE MESSAGE NAMES NOWHERE — the lift. "add my services" states nothing.
  const lift = reconcileServices(
    [{ name: "Express Wash", price: 60 }, { name: "Ceramic Coating", price: 600 }], existing, "add my services",
  );
  if (lift.droppedLift.length !== 1 || lift.droppedLift[0] !== "Ceramic Coating") {
    fails.push(`RECONCILER — a new service stated nowhere in the message must be dropped as a lift; dropped ${JSON.stringify(lift.droppedLift)}`);
  }
  if (!lift.allowed.some((s) => s.name === "Express Wash" && s.price === 60)) {
    fails.push("RECONCILER — an ungrounded entry that already EXISTS on the record must be preserved at the record's value, not dropped. Dropping it is how a filter deletes services off a live page.");
  }

  const stated = reconcileServices([{ name: "Ceramic Coating", price: 600 }], existing, "ceramic coating is $600");
  if (!stated.allowed.some((s) => s.name === "Ceramic Coating" && s.price === 600)) {
    fails.push("RECONCILER — a service stated in this message must be allowed through.");
  }

  // THE EMPTY MESSAGE. Nothing can be grounded against nothing, so nothing new may be written.
  const noMsg = reconcileServices([{ name: "Ceramic Coating", price: 600 }], existing, "");
  if (noMsg.droppedLift.length !== 1) {
    fails.push("RECONCILER — with NO message there is nothing to ground against, so a new service must be dropped, not written.");
  }

  // THE HOLE, ASSERTED AS IT IS RATHER THAN AS IT SHOULD BE. `serviceGrounded` accepts a
  // service when its NAME is in the message OR its price is — so "add ceramic coating" grounds
  // the name and lets whatever price the model attached ride in with it. That is a price the
  // owner did not state, on a page a customer reads, and CLAUDE.md names this case exactly:
  // "if a phone can be lifted unstated, so can a price." It is in the frozen baseline below.
  // This asserts the CURRENT behaviour so that closing the hole is a deliberate act that
  // updates this fixture, not a silent drift either way.
  const namedNotPriced = reconcileServices([{ name: "Ceramic Coating", price: 600 }], [], "add ceramic coating");
  const rode = namedNotPriced.allowed.find((s) => s.name === "Ceramic Coating");
  if (!rode || rode.price !== 600) {
    fails.push("BASELINE MOVED — a name-grounded service no longer carries an unstated price through. If that was deliberate, delete the business.setServices::price-when-only-the-name-is-stated baseline entry; it is a hole closing.");
  }
}

// ── LEG 1b — THE SILENTLY SHORT LIST ─────────────────────────────────────────────────────
//
// THE SHAPE THAT MATTERS IS NOT AN EMPTY LIST — that case every layer already refuses. It is a
// list that is SHORT: the owner says "add ceramic coating", the model returns two of five, and
// the replace-all deletes the difference in silence. Nobody invoked a delete, and the owner
// finds out when a customer asks for a service that is no longer on the page.
{
  const five = [
    { name: "Gutter Clearing", price: 120 },
    { name: "Window Washing", price: 90 },
    { name: "Pressure Washing", price: 200 },
    { name: "Roof Moss Removal", price: 250 },
    { name: "Solar Panel Clean", price: 80 },
  ];
  const nameOf = (s: { name: string }) => s.name;

  // 1. SILENTLY SHORT — the message names none of the missing three.
  const short = reconcileServices(
    [{ name: "Gutter Clearing", price: 120 }, { name: "Ceramic Coating", price: 600 }],
    five, "add ceramic coating, six hundred",
  );
  const kept = short.allowed.map(nameOf);
  for (const missing of ["Window Washing", "Pressure Washing", "Roof Moss Removal", "Solar Panel Clean"]) {
    if (!kept.includes(missing)) {
      fails.push(`SILENTLY SHORT — "${missing}" is on the record, was absent from the model's list, and the message never mentions it. It must be KEPT; the write is replace-all, so dropping it deletes it from a live page.`);
    }
  }
  if ((short.keptBack || []).length !== 4) {
    fails.push(`SILENTLY SHORT — four omissions were unmentioned; keptBack reports ${JSON.stringify(short.keptBack)}. What was refused must be named, or the owner cannot tell a correct write from one we corrected.`);
  }
  if ((short.removed || []).length !== 0) {
    fails.push(`SILENTLY SHORT — nothing was asked to be removed; removed reports ${JSON.stringify(short.removed)}.`);
  }

  // 2. A REMOVAL THE OWNER ACTUALLY ASKED FOR still works, and is named.
  const asked = reconcileServices(
    five.filter((s) => s.name !== "Window Washing"), five, "drop the window washing please",
  );
  if (!(asked.removed || []).includes("Window Washing")) {
    fails.push(`ASKED REMOVAL — "drop the window washing" must remove it; removed reports ${JSON.stringify(asked.removed)}. A guard that cannot let go of anything is a different defect, not a fix.`);
  }
  if (asked.allowed.map(nameOf).includes("Window Washing")) {
    fails.push("ASKED REMOVAL — the service the owner asked to remove is still in the write.");
  }
  if (!asked.changed) fails.push("ASKED REMOVAL — a removal IS a change; without that flag a removal-only turn writes nothing and reports nothing.");

  // 3. THE SENTENCE. A refusal nobody hears about is indistinguishable from a correct write,
  //    and a removal nobody hears about is the defect wearing a fix.
  const placement = { status: "placed", placed: [{ name: "Ceramic Coating", price: 600 }], verifiedPlaced: [{ name: "Ceramic Coating", price: 600 }], missing: [] } as any;
  const said = composeServicesTruth(placement, "https://x.myhubly.app", null, { removed: ["Window Washing"], keptBack: ["Pressure Washing", "Roof Moss Removal"] });
  for (const must of ["Window Washing", "Pressure Washing", "Roof Moss Removal"]) {
    if (!said.includes(must)) fails.push(`THE SENTENCE — "${must}" was removed or kept back and the owner's sentence never names it: ${JSON.stringify(said.slice(0, 200))}`);
  }
  // And it may not fabricate one when there is nothing to say.
  const quiet = composeServicesTruth(placement, "https://x.myhubly.app", null, { removed: [], keptBack: [] });
  if (/kept|off your list/i.test(quiet)) fails.push(`THE SENTENCE — nothing was removed or kept, and the sentence talks about it anyway: ${JSON.stringify(quiet)}`);
}

// ── LEG 2 + 3 — WHO CALLS IT, AND WHAT IS STILL UNGROUNDED ───────────────────────────────
/** The owner-fact writers. A capability that writes a fact a customer could act on belongs
 *  here; adding one without adding it here is what this list exists to make loud. */
const FACT_WRITERS: Record<string, string[]> = {
  "business.updateDraft": ["phone", "email", "city"],
  "business.setHours": ["hours"],
  "business.setServices": ["services", "prices"],
  // Added with the writer (2026-09-14), not after someone noticed. A job carries a customer's
  // phone, address and price: the same facts, about someone else, on a planner the owner acts
  // from. It grounds each one and DROPS what it cannot match rather than refusing the job —
  // a job with a name and a date is worth having; one with an invented phone number is not.
  "business.addJob": ["phone", "email", "address", "price"],
  "business.addServicesSection": ["services", "prices"],   // covered: reconcileServices
};

/** NOT fact writers, with the reason, so the exclusion is arguable rather than invisible. */
const NOT_A_FACT_WRITER: Record<string, string> = {
  "business.setAddress": "writes the myhubly.app SUBDOMAIN, not a street address, and reads the exact final value back before it commits",
  "booking.recordContact": "records the CUSTOMER's own contact details, given by that customer in that form — a different rule from publishing the owner's facts",
  "business.capture": "writes a planner item in the owner's words; it is not published to a page",
};

/** THE FROZEN BASELINE — facts a writer does NOT ground today. Every line is a hole with a
 *  reason and a cost. A new entry fails this check; removing one is the work.
 *  Recorded 2026-09-14, from the handlers as they stand. */
const UNGROUNDED_TODAY: Record<string, string> = {
  "business.updateDraft::city":
    "city is written from the model's argument with no grounding call. It is one of the two highest-value facts we capture, and a city lifted from an earlier turn publishes a service area nobody stated.",
  "business.setHours::hours":
    "there is no hoursGrounded(); the rule lives in the action's DESCRIPTION ('ONLY pass hours the owner stated IN THIS MESSAGE'), which is a prompt, not a writer-side refusal. Seven pages shipped with invented hours on 2026-08-27.",
  // NOT HERE, AND THE CHECK IS WHY: I listed business.addServicesSection::services as a hole
  // from reading the action's name. It calls reconcileServices against the same message, exactly
  // as setServices does. The first run printed it as covered AND as a hole, which is how the
  // wrong claim surfaced in under a minute. A baseline is a claim about the product and gets
  // checked like one.
  "business.setServices::price-when-only-the-name-is-stated":
    "serviceGrounded passes on the NAME or the price, so 'add ceramic coating' grounds the name and an unstated price rides in with it. Asserted as current behaviour in leg 1 so closing it is deliberate.",
};

const GROUNDING_CALL = /Grounded\s*\(|groundedInMessage|reconcileServices\s*\(|groundOrNull\s*\(/;
let checked = 0;
const covered: string[] = [];
const recordedHoles: string[] = [];
for (const cap of REGISTRY) {
  for (const action of cap.actions || []) {
    const id = `${cap.name}.${action.name}`;
    if (NOT_A_FACT_WRITER[id]) continue;
    const expected = FACT_WRITERS[id];
    if (!expected) continue;
    checked++;
    let src = "";
    try { src = action.handler.toString(); } catch { /* handled below */ }
    if (!src) { fails.push(`${id} — handler source unreadable, so its grounding cannot be verified`); continue; }
    if (!GROUNDING_CALL.test(src)) {
      // A writer with NO grounding call at all is a failure unless every fact it writes is
      // already in the frozen baseline — in which case it is a hole we have named, with a
      // reason, and the check's job is to stop it growing rather than to re-report it daily.
      const unbaselined = expected.filter((f) => !UNGROUNDED_TODAY[`${id}::${f}`]);
      if (unbaselined.length) {
        fails.push(`${id} writes ${unbaselined.join(", ")} and calls NO grounding function.\n` +
                   `      A fact write needs a value from THIS message. This one takes whatever it is handed.`);
      } else {
        recordedHoles.push(`${id} (${expected.join(", ")}) — no grounding call at all; every fact it writes is in the baseline below`);
      }
      continue;
    }
    covered.push(id);
  }
}

// Every baseline entry must still name a real writer — a stale hole is a lie about coverage.
for (const key of Object.keys(UNGROUNDED_TODAY)) {
  const id = key.split("::")[0];
  if (!FACT_WRITERS[id]) fails.push(`the frozen baseline names ${id}, which is no longer a fact writer. Delete the entry or restore the writer.`);
}

console.log(`grounding behaviours exercised : ${CASES.length + 4} + 10 on the silently short list`);
console.log(`owner-fact writers checked     : ${checked}  (${covered.join(", ")})`);
for (const h of recordedHoles) console.log(`  recorded hole: ${h}`);
console.log(`facts still ungrounded, frozen : ${Object.keys(UNGROUNDED_TODAY).length}`);
for (const [k, why] of Object.entries(UNGROUNDED_TODAY)) console.log(`  ${k.padEnd(38)} ${why.slice(0, 96)}…`);

if (fails.length) {
  console.error(`\nFAIL — ${fails.length}:`);
  for (const f of fails) console.error("  " + f);
  Deno.exit(1);
}
console.log(`\nPASS — the grounding library refuses every lift it is shown, and ${covered.length} of ${checked} owner-fact writers call it.`);
console.log(`The ${Object.keys(UNGROUNDED_TODAY).length} facts still ungrounded are listed above rather than implied: they are holes we have named, not coverage.`);
Deno.exit(0);
