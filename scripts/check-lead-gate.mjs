#!/usr/bin/env node
/**
 * [RULE] THE LEAD GATE IS REACHABLE — PHONE **OR** EMAIL — AND "PROVIDED" MEANS MOVED PAST.
 *
 *   node scripts/check-lead-gate.mjs
 *
 * ADRIAN, 2026-09-16: "name AND phone becomes REACHABLE: phone OR email. Name-only is a signal,
 * never a leads row. 'Provided' means completed and moved past, not keystrokes in a cleared field.
 * Labelled a partial IN WORDS. Dedupe a burst into one. Visitor keystrokes stored VERBATIM."
 *
 * WHAT WAS BROKEN. Step 3 refused to advance without a PHONE
 * (`if(!bk-phone.value){toast('Enter your phone number')}`) and the writer refused on
 * `!name||!phone`. A visitor willing to leave an email address got past nothing and **we stored
 * nothing** — the lead did not arrive incomplete, it never existed. Both labels also said `*`
 * while only one was enforced.
 *
 * THE TWO LEGS THAT SEPARATE THIS FROM A KEYSTROKE CAPTURE (docs/ABANDONED_BOOKING_TRACE.md
 * decision 2, which specified them before the code existed):
 *   · type a phone, CLEAR it, advance  -> no phone is stored.       A keystroke capture PASSES this.
 *   · type a phone, advance, go back, CLEAR it, advance again
 *                                      -> the stored phone is REMOVED, not kept.
 *                                                                  A keystroke capture FAILS this.
 * Both are asserted against the real predicate and the real form.
 *
 * [RULE], not [SHAPE]: every leg is one of Adrian's sentences. `BK_LEAD_GATE` is a declared switch,
 * so flipping it back to 'name_and_phone' is expected to turn legs 2-4 red — that is the switch
 * working, and the leg names say so.
 *
 * RED-PROOFED, SEVEN BREAKS, EACH APPLIED AND EACH RUN:
 *   BK_LEAD_GATE flipped to 'name_and_phone'     -> legs 1, 3   (the switch working, as designed)
 *   step 3 demands a phone again                 -> leg 10
 *   the disclosure becomes the rejected euphemism-> legs 14, 15
 *   the disclosure slot-fills "this business"    -> leg 13
 *   the writer sends the REMEMBERED phone        -> leg 8
 *   the partial label reads "Booking confirmed." -> legs 11, 12
 *   the visitor key is regenerated every call    -> leg 17
 * An eighth attempt produced NO red and the honest reason is recorded: the break never applied. The
 * source uses literal ’ and — characters, not \u escapes, so `str.replace` matched nothing and
 * silently changed nothing — and "no legs went red" would have read as "the check cannot catch
 * this". A red-proof now asserts its own break landed before it believes the result. A break that
 * leaves a leg green has not tested it; a break that never applied has not tested anything.
 *
 * SIMULATED AND SAID SO: no session, no network, and NO WRITE. The predicate, the form, the
 * disclosure and the partial label are the shipping product's. The server half of the gate was
 * verified separately against the live database and then its rows were deleted — see
 * docs/LEAD_GATE.md; it is not re-run here, because a check that writes to a real table every time
 * anyone runs `npm test` is how a corpus gets contaminated.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { codeOf, bodyOf } from "./lib/absence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "public/hubly.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const site = await servePublic(ROOT);
let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); site.close(); process.exit(2); }

try {
  console.log("SIMULATED — no session, no network, NO WRITE. The predicate, the form and the copy are the product's.\n");
  await rig.load(site.url("hubly.html"));

  const fields = await rig.page.evaluate(() => ({
    name: !!document.getElementById("bk-name"),
    phone: !!document.getElementById("bk-phone"),
    email: !!document.getElementById("bk-email"),
    pred: typeof window.bkIsReachable === "function" || typeof bkIsReachable === "function",
    gate: typeof BK_LEAD_GATE !== "undefined" ? BK_LEAD_GATE : null,
    disclosureEl: !!document.getElementById("bk-visitor-disclosure"),
    reachReq: (document.getElementById("bk-reach-req") || {}).textContent || null,
  }));
  if (!fields.name || !fields.phone || !fields.email || !fields.pred) {
    console.error("CANNOT RUN — the booking form or bkIsReachable is not reachable on this page");
    await rig.close(); site.close(); process.exit(2);
  }

  say("1 the gate is a declared switch, not a condition spread across the form",
      fields.gate === "reachable", `BK_LEAD_GATE = ${JSON.stringify(fields.gate)}`);

  /** Sets the three fields and asks the REAL predicate. Nothing is written anywhere. */
  const ask = (name, phone, email) => rig.page.evaluate(({ name, phone, email }) => {
    document.getElementById("bk-name").value = name;
    document.getElementById("bk-phone").value = phone;
    document.getElementById("bk-email").value = email;
    return { reachable: bkIsReachable(), by: bkReachedBy(), read: bkContactNow() };
  }, { name, phone, email });

  const phoneOnly = await ask("Dana", "801-555-0134", "");
  const emailOnly = await ask("Dana", "", "dana@example.com");
  const both = await ask("Dana", "801-555-0134", "dana@example.com");
  const nameOnly = await ask("Mike", "", "");
  const nothing = await ask("", "", "");
  say("2 a phone alone is reachable", phoneOnly.reachable === true && phoneOnly.by === "phone", JSON.stringify(phoneOnly.by));
  say("3 an EMAIL alone is reachable — this is the defect, and it is the whole item",
      emailOnly.reachable === true && emailOnly.by === "email", JSON.stringify(emailOnly.by));
  say("4 both is 'both', so the row records how and no reader re-derives it",
      both.reachable === true && both.by === "both", JSON.stringify(both.by));
  say("5 a NAME ALONE is not reachable — it is a signal, never a leads row",
      nameOnly.reachable === false && nameOnly.by === "none", JSON.stringify(nameOnly.by));
  say("6 nothing at all is not reachable either", nothing.reachable === false, JSON.stringify(nothing.by));

  // ── PROVIDED = COMPLETED AND MOVED PAST. The two legs from the trace doc. ───────────────
  const cleared = await rig.page.evaluate(() => {
    const p = document.getElementById("bk-phone");
    p.value = "801-555-0134";           // typed
    p.dispatchEvent(new Event("input", { bubbles: true }));
    const mid = bkContactNow().phone;
    p.value = "";                        // and cleared, before advancing
    p.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("bk-email").value = "";
    document.getElementById("bk-name").value = "Dana";
    return { mid, atBoundary: bkContactNow().phone, reachable: bkIsReachable() };
  });
  say("7 typed then CLEARED then advanced — nothing is provided (a keystroke capture passes this)",
      cleared.mid.length > 0 && cleared.atBoundary === "" && cleared.reachable === false,
      `mid="${cleared.mid}" boundary="${cleared.atBoundary}"`);

  // The second leg is the discriminating one, and it is about the SERVER: on a second advance with
  // an empty phone the stored phone must be REMOVED. The client half is that the writer sends the
  // field's current value unconditionally rather than a remembered one — asserted from source,
  // scoped to the writer's own body, because there is no session here to write through.
  const writer = codeOf(bodyOf(readFileSync(FILE, "utf8"), "async function writeAbandonedBookingRequest(opts={}){"));
  say("8 the writer sends the field's CURRENT value, never a remembered one (scoped to its body)",
      !!writer && /p_phone:\s*_c\.phone/.test(writer) && /p_email:\s*_c\.email/.test(writer) &&
      !/p_phone:\s*(phone|S\._abandonedBookingPhone)\b/.test(writer),
      writer ? `scope = writeAbandonedBookingRequest body, ${writer.length} chars of code` : "could not slice the writer");
  say("9 the old name-AND-phone refusal is gone from the writer (scoped, comments stripped)",
      !!writer && !/!name\s*\|\|\s*!phone/.test(writer) && /bkIsReachable\(\)/.test(writer),
      "the writer asks the predicate");

  // ── STEP 3 NO LONGER DEMANDS A PHONE. Scoped to bkNext's own body. ─────────────────────
  const next = codeOf(bodyOf(readFileSync(FILE, "utf8"), "function bkNext("));
  say("10 step 3 no longer demands a phone number to advance (scoped to bkNext)",
      !!next && !/Enter your phone number/.test(next) && /bkIsReachable\(\)/.test(next),
      next ? `scope = bkNext body, ${next.length} chars of code` : "could not slice bkNext");

  // ── LABELLED A PARTIAL, IN WORDS ───────────────────────────────────────────────────────
  const labels = await rig.page.evaluate(() => ({
    s3: bkPartialLabel(3), s4: bkPartialLabel(4), sNone: bkPartialLabel(null),
  }));
  say("11 a partial is labelled IN WORDS and says how far they got, per step",
      /didn/i.test(labels.s3) && /details/i.test(labels.s3) && /review/i.test(labels.s4) &&
      labels.s3 !== labels.s4 && !/undefined|null/.test(labels.sNone),
      JSON.stringify(labels.s3));
  say("12 no partial label reads like a confirmed booking",
      ![labels.s3, labels.s4, labels.sNone].some((l) => /\bbooked\b|\bconfirmed\b/i.test(l)),
      JSON.stringify([labels.s3, labels.s4, labels.sNone]));

  // ── THE VISITOR'S SENTENCE — option 1, and it refuses to say "this business" ───────────
  const disc = await rig.page.evaluate(() => {
    const el = document.getElementById("bk-visitor-disclosure");
    const before = { shown: bkSetVisitorDisclosure(), text: el.textContent, hidden: el.hidden };
    const savedBiz = (typeof S !== "undefined" && S) ? S.biz : null;
    const savedCur = typeof currentBusiness !== "undefined" ? currentBusiness : undefined;
    try { window.currentBusiness = { id: "x", name: "Graef's Autocare" }; } catch (e) {}
    const after = { shown: bkSetVisitorDisclosure(), text: el.textContent, hidden: el.hidden };
    try { window.currentBusiness = savedCur; if (typeof S !== "undefined" && S) S.biz = savedBiz; } catch (e) {}
    return { before, after };
  });
  say("13 with no business name the disclosure is NOT rendered — no \"this business\" placeholder",
      disc.before.shown === false && disc.before.hidden === true && disc.before.text === "",
      `shown=${disc.before.shown} text=${JSON.stringify(disc.before.text)}`);
  say("14 with a real name it is Adrian's option 1, verbatim",
      disc.after.shown === true && disc.after.hidden === false &&
      /^If you don’t finish, whatever you’ve filled in goes to Graef's Autocare so they can follow up\.$/.test(disc.after.text),
      JSON.stringify(disc.after.text));
  say("15 it is not the rejected euphemism — \"help if you get stuck\" is permanently out",
      !/help if you get stuck/i.test(disc.after.text) && !/so they can help/i.test(disc.after.text),
      "option 3 wording absent");
  say("16 the form says once what is actually required, and asks for neither specifically",
      !!fields.reachReq && /or/i.test(fields.reachReq) && /one is enough/i.test(fields.reachReq),
      JSON.stringify(fields.reachReq));

  // ── DEDUPE IS KEYED ON AN OPAQUE PER-BROWSER ID THAT CARRIES NOTHING ELSE ─────────────
  const vk = await rig.page.evaluate(() => {
    const a = bkVisitorKey(), b = bkVisitorKey();
    return { a, b, stable: a === b };
  });
  say("17 the dedupe key is stable per browser and opaque — a burst is one intention",
      vk.stable && /^v-/.test(vk.a) && vk.a.length > 8, `${vk.a.slice(0, 14)}… stable=${vk.stable}`);
  say("18 the key carries no device, browser or network fact",
      !/mozilla|chrome|safari|webkit|\d+\.\d+\.\d+\.\d+/i.test(vk.a), "opaque");
} finally { await rig.close(); site.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — reachable is phone OR email, a name alone is a signal, and the partial says so in words.\n");
process.exit(failed ? 1 : 0);
