#!/usr/bin/env node
/**
 * [RULE] IF THE CUSTOMER IS TOLD, THE OWNER IS TOLD — OR WE SAY SO, TO BOTH OF THEM.
 *
 *   node scripts/check-owner-told-when-customer-is.mjs
 *
 * ══ THE DEFECT, 2026-09-01, FOUND IN THE LEDGER 2026-09-17 ══════════════════════════════════
 *
 * Two rows, ONE SECOND APART, on the same booking:
 *
 *     owner    -> skipped   "no recipient address"
 *     customer -> sent
 *
 * The customer was told *"They'll confirm your appointment shortly."* The business had not been
 * told a booking existed. **A stranger would have been promised a call that nobody knew to make,**
 * and the owner would never have learned there was anything to call about.
 *
 * (That booking turned out to be the owner testing his own page. The MECHANISM was live on every
 * booking, which is what this guards. See Lesson 96 for the other half of that story.)
 *
 * ══ TWO LEGS, TWO KINDS OF EVIDENCE ═════════════════════════════════════════════════════════
 *
 * 1. [RULE, SOURCE] the customer's sentence is composed from whether the owner was reachable —
 *    it cannot promise a confirmation on a path where the owner send was skipped.
 * 2. [RULE, DATA] in the live ledger, no booking has a `sent` customer row and a non-sent owner
 *    row without an `unreachable_owner` operator row beside it. This is the one that would have
 *    caught 2026-09-01 on the day.
 *
 * ══ THE DETECTOR IS RED-PROOFED ON ITS OWN FIXTURES, EVERY RUN ══════════════════════════════
 *
 * Leg 2 reads a database that is currently clean, so a green leg proves nothing about the
 * detector. Before it reads anything real it is run against a synthetic pair that HAS the
 * asymmetry and a pair that does not, and it refuses to report if it cannot tell them apart —
 * which is Adrian's "red-proof it by skipping the owner send", done where a production write is
 * not available.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

// ── LEG 1: the promise is conditional on the owner being reachable ────────────────────
const src = readFileSync(join(ROOT, "supabase/functions/booking-notify/index.ts"), "utf8");
const promises = [...src.matchAll(/They'll confirm your appointment shortly/g)].length;
const gated = /const ownerWasTold\s*=\s*!!ownerEmail/.test(src) &&
              /ownerWasTold\s*\n?\s*\?/.test(src);
say("1 [RULE] the customer's sentence is composed from whether the owner was reachable",
    gated && promises === 1,
    `ownerWasTold gate: ${gated} · "they'll confirm shortly" appears ${promises}×, on the reachable branch only`);
say("1b [RULE] and the unreachable branch offers something the customer can actually do",
    /could not reach them by email/.test(src) && /call them on/.test(src),
    "the truth, plus the business's phone when we have it");
// A MISSING ADDRESS AND A FAILED SEND ARE THE SAME THING TO THE OWNER. The operator alert used to
// fire only on the first; calder-vane-roofing, 2026-08-20, was the second — Resend 422 on a present
// address, customer told in the same second, nobody alerted.
say("1c [RULE] the alert fires on the OUTCOME of the sends, not on whether an address existed",
    /customerOutcome === 'sent' && ownerOutcome !== 'sent'/.test(src),
    "asymmetry is checked against what the sends returned");

/** THE DETECTOR: given delivery rows for one booking, is the customer told while the owner is not? */
function asymmetric(rows) {
  const sentTo = (role) => rows.some((r) => r.recipient_role === role && r.status === "sent");
  const ownerRow = rows.some((r) => r.recipient_role === "owner");
  const operatorTold = rows.some((r) => r.subject_type === "unreachable_owner" || r.recipient_role === "operator");
  if (!sentTo("customer")) return null;                       // nobody was promised anything
  if (sentTo("owner")) return null;                           // both told
  if (!ownerRow) return "the customer was told and there is NO owner row at all";
  if (operatorTold) return null;                              // told, and we know: visible, not silent
  return "the customer was told, the owner was not, and nothing recorded that we knew";
}

// ── THE DETECTOR'S OWN FIXTURES, BEFORE IT READS ANYTHING REAL ───────────────────────
{
  const BAD = [{ recipient_role: "owner", status: "skipped", subject_type: "booking" },
               { recipient_role: "customer", status: "sent", subject_type: "booking_request" }];
  const GOOD = [{ recipient_role: "owner", status: "sent", subject_type: "booking_request" },
                { recipient_role: "customer", status: "sent", subject_type: "booking_request" }];
  const KNOWN = BAD.concat([{ recipient_role: "operator", status: "sent", subject_type: "unreachable_owner" }]);
  const caught = !!asymmetric(BAD), quietOnGood = !asymmetric(GOOD), quietOnKnown = !asymmetric(KNOWN);
  if (!caught || !quietOnGood || !quietOnKnown) {
    console.error("CANNOT RUN — the detector failed its own fixtures:");
    console.error(`  catches owner-skipped + customer-sent : ${caught} (expected true)`);
    console.error(`  quiet when both were sent             : ${quietOnGood} (expected true)`);
    console.error(`  quiet when we alerted ourselves       : ${quietOnKnown} (expected true)`);
    process.exit(2);
  }
  console.log("  (detector red-proofed on its own fixtures this run — the owner-skipped case is caught)");
}

// ── LEG 2: the live ledger ───────────────────────────────────────────────────────────
let rows;
try {
  const out = execFileSync("supabase", ["db", "query", "--linked",
    `select d.subject_id::text as subject_id, d.subject_type, d.recipient_role, d.status,
            coalesce(b.slug,'(no business)') as slug, coalesce(b.account_kind,'?') as account_kind,
            d.attempted_at
     from notification_deliveries d left join businesses b on b.id = d.business_id
     where d.subject_type in ('booking','booking_request','unreachable_owner')`],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let dpt = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") dpt++; else if (out[k] === "]") { dpt--; if (!dpt) { e = k + 1; break; } } }
  rows = JSON.parse(out.slice(s, e));
} catch (err) {
  console.error("CANNOT RUN — could not read the delivery ledger: " + String(err.message).slice(0, 160));
  process.exit(2);
}

const bySubject = new Map();
for (const r of rows) {
  const k = String(r.subject_id || "");
  if (!bySubject.has(k)) bySubject.set(k, []);
  bySubject.get(k).push(r);
}
// ══ HISTORY IS PRINTED, NOT EXEMPTED ════════════════════════════════════════════════════════
//
// Two bookings from August are asymmetric and always will be — the rows are what happened and
// rewriting them would be fabricating a record. They are listed on EVERY run, loudly, so they stay
// visible; they do not fail the check, because a check that is permanently red is a check nobody
// reads (which is exactly how the first of them went unseen for four weeks).
//
// THE BOUNDARY IS ONE TYPED DATE AND IT IS THE ONLY ONE. It is the day the outcome-based alert
// shipped. Anything from that day on is a RECURRENCE and fails. If this ever needs a second date,
// something is being excused rather than fixed.
const GUARD_SHIPPED = "2026-09-17";
const bad = [], history = [];
for (const [subject, rs] of bySubject) {
  const why = asymmetric(rs);
  if (!why) continue;
  const when = rs.map((r) => String(r.attempted_at || "")).filter(Boolean).sort().pop() || "";
  const line = `${rs[0].slug} (${rs[0].account_kind}) booking ${subject.slice(0, 8)} @ ${when.slice(0, 10) || "undated"} — ${why}`;
  (when && when.slice(0, 10) < GUARD_SHIPPED ? history : bad).push(line);
}
if (history.length) {
  console.log(`\n  KNOWN HISTORY — ${history.length} booking(s) from before the guard shipped (${GUARD_SHIPPED}).`);
  console.log("  These are what happened. They are not rewritten and they are not hidden:");
  history.forEach((h) => console.log("      " + h));
  console.log("");
}
say(`2 [RULE] no booking since ${GUARD_SHIPPED} told the customer and left the owner in the dark`,
    bad.length === 0, `${bySubject.size} booking(s) with delivery rows · ${history.length} historical · ${bad.length} since the guard`);
bad.forEach((b) => console.error("      " + b));

console.log(failed ? `\n${failed} FAILED\n` : "\nPASS — nobody is promised a call that the business was never told to make.\n");
process.exit(failed ? 1 : 0);
