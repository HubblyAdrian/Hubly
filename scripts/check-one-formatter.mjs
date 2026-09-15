#!/usr/bin/env node
/**
 * ONE DATE FORMAT AND ONE PHONE FORMAT, AND NO RAW VALUE REACHES A HUMAN.
 *
 *   node scripts/check-one-formatter.mjs
 *
 * WHAT WENT WRONG. An owner was shown "One person looked at your page on 2026-09-13" on
 * 2026-09-15. The cause was `'on ' + top.day` — a date column concatenated into a sentence —
 * and there were four more sites with four more opinions about format (two toLocaleString, two
 * toLocaleDateString with no year). The same night, a job's phone was displayed exactly as it
 * arrived.
 *
 * WHY THIS CHECK IS SHAPED THIS WAY. It would be easy to grep for the five strings we already
 * found; that is the mistake CLAUDE.md names four times over — enumerating the FORMS of a
 * thing, and being beaten by the sixth form. So the primary leg RENDERS THE REAL SURFACES in
 * the real page with deliberately raw rows, and then asks the rendered text one question:
 *
 *     does anything an owner can read look like an ISO date or an unformatted phone number?
 *
 * That catches a sixth site nobody listed, because it does not care where the text came from.
 * The source sweep that follows is a SECONDARY signal and it prints what it finds rather than
 * pretending to be exhaustive.
 *
 * SIMULATED AND SAID SO: no session; window.supabase is a declared fake and the rows are
 * fixtures. What renders them is the shipping code in public/platform-home.html.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "file://" + join(ROOT, "public/platform-home.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

// ── \b IS THE WRONG ANCHOR HERE, AND GETTING IT WRONG MAKES THIS CHECK PASS BLIND ──────
//
// Rendered DOM text is CONCATENATED: a field label and its value come back as "Phone801-888-
// 8566", with no space between them. `\b` needs a word/non-word transition, and "e" to "8" is
// word-to-word — so every `\b\d{3}` pattern below silently failed to match a number that was
// plainly there. The first version of this file used \b throughout: leg 10 went red on a panel
// that was correct, and legs 8 and 9 were PASSING WITHOUT LOOKING. A detector that cannot see
// the defect is worse than no detector, so the anchors are digit lookarounds, and leg 0 proves
// the detectors fire before any of them is trusted.
/** An ISO date anywhere in text an owner reads. The one form we will never accept. */
const ISO = /(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/;
/** A phone that is NOT in house format: ten digits run together, parens, or dots. */
const UGLY_PHONE = /(\(\d{3}\)\s*\d{3}[-.\s]?\d{4})|((?<!\d)\d{10}(?!\d))|((?<!\d)\d{3}\.\d{3}\.\d{4}(?!\d))/;
/** The house format, for the positive assertion. */
const HOUSE = /(?<!\d)\d{3}-\d{3}-\d{4}(?!\d)/;

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  console.log("SIMULATED — no session; rows are fixtures, the renderers are the product's.\n");
  await rig.load(PAGE);
  const has = await rig.page.evaluate(() => !!(window.hublyFormat && window.hublyFormat.date && window.hublyFormat.phone));
  if (!has) { console.error("CANNOT RUN — window.hublyFormat is not exposed."); await rig.close(); process.exit(2); }

  // ── 0. RED-PROOF THE DETECTORS. Nothing below may be trusted until these fire. ───────
  //
  // Written against the EXACT shape rendered DOM text takes — a label welded to its value —
  // because that is the shape that defeated the first version of this file.
  say("0a the ISO detector fires on concatenated DOM text",
    ISO.test("When2026-09-17 at 14:00") && ISO.test("on 2026-09-13.") && !ISO.test("09/13/2026"),
    "fires on Phone-style concatenation, not on 09/13/2026");
  say("0b the unformatted-phone detector fires on concatenated DOM text",
    UGLY_PHONE.test("Phone8018888566") && UGLY_PHONE.test("Call (801) 888-8566") &&
    UGLY_PHONE.test("801.888.8566") && !UGLY_PHONE.test("Phone801-888-8566"),
    "fires on run-together/parens/dots, not on the house format");
  say("0c the house detector fires on concatenated DOM text",
    HOUSE.test("Phone801-888-8566") && HOUSE.test("Call 555-0134".replace("555-0134", "555-888-0134")),
    "matches a house-format number with no preceding space");

  // ── 1. THE TWO FUNCTIONS THEMSELVES, EXECUTED. ───────────────────────────────────────
  const f = await rig.page.evaluate(() => {
    const F = window.hublyFormat;
    return {
      day: F.date("2026-09-13"),
      stamp: F.date("2026-09-13T22:01:24.826016+00:00"),
      dObj: F.date(new Date(2026, 8, 13)),
      empty: [F.date(null), F.date(""), F.date("not a date"), F.phone(null), F.phone("")],
      phones: [F.phone("8018888888"), F.phone("(801) 888-8888"), F.phone("+1 801 888 8888"),
               F.phone("801.888.8888"), F.phone("1-801-888-8888")],
      short: F.phone("5550134"),
      dt: F.dateTime("2026-09-13T14:30:00"),
    };
  });
  say("1 a date-only column formats month/day/year", f.day === "09/13/2026", f.day);
  say("2 an ISO timestamp formats the same way", f.stamp === "09/13/2026", f.stamp);
  // THE OFF-BY-ONE THIS GUARDS. new Date('2026-09-13') is UTC midnight, which is the 12th in
  // every US timezone — the owner's Thursday quietly becoming Wednesday.
  say("3 a date-only string is not shifted a day by the timezone", f.day === f.dObj, `${f.day} vs ${f.dObj}`);
  say("4 nothing produces nothing, never a guess and never today", f.empty.every((v) => v === ""), JSON.stringify(f.empty));
  say("5 every phone shape lands on 888-888-8888", f.phones.every((p) => p === "801-888-8888"), JSON.stringify(f.phones));
  say("6 a partial number is formatted, not invented", f.short === "555-0134", f.short);
  say("7 a moment reads month/day/year with a time", /^09\/13\/2026 at 2:30 PM$/.test(f.dt), f.dt);

  // ── 2. THE REAL SURFACES, RENDERED WITH RAW ROWS. THE LEG THAT CATCHES A SIXTH SITE. ──
  //
  // Every renderer that shows a date or a phone, driven with values in their rawest stored
  // form, and then one question asked of the rendered text.
  const rendered = await rig.page.evaluate(() => {
    const out = {};
    const host = document.createElement("div");
    host.id = "hcFormatProbe";
    document.body.appendChild(host);
    const readPanel = () => {
      const p = document.getElementById("hcPanel") || document.querySelector(".hc-panel");
      return p ? p.innerText : "";
    };
    // A job, with a raw ISO date and a run-together phone.
    const job = { id: "j1", customer_name: "Bob Jones", service_name: "driveway",
                  scheduled_date: "2026-09-17", scheduled_time: "14:00:00", address: "14 Maple St",
                  phone: "8018888566", email: null, amount: 180, paid: false, status: "scheduled",
                  is_block: false, duration_hours: 2, notes: null, vehicle: null };
    try { window.hublyJobUI.panel(job); out.jobPanel = readPanel(); } catch (e) { out.jobPanel = "ERR " + e.message; }
    // The job card line in the thread.
    try { out.jobCard = (window.hublyJobUI.line(job) || []).join(" · "); } catch (e) { out.jobCard = "ERR " + e.message; }
    // The day-row sentence for a job that was just edited by hand.
    try { out.editLine = window.hublyJobEditUI.line({ ok: true, job: job }); } catch (e) { out.editLine = "ERR " + e.message; }
    // The add-to-my-day sentence.
    try { out.dayLine = window.hublyDayUI.line({ ok: true, task: { title: "Order glass cleaner", due_date: "2026-09-17", due_time: "14:30:00" } }); }
    catch (e) { out.dayLine = "ERR " + e.message; }
    return out;
  });

  const surfaces = Object.entries(rendered);
  // ONE DETECTOR, NOT A SECOND OPINION. These used to be re-declared inline with \b anchors
  // while the constants above were something else — two definitions of "is this wrong", which
  // is the same defect as two readers of one fact.
  const isoHits = surfaces.filter(([, v]) => typeof v === "string" && ISO.test(v));
  const phoneHits = surfaces.filter(([, v]) => typeof v === "string" && UGLY_PHONE.test(v));

  say("8 no owner-facing surface shows a raw ISO date", isoHits.length === 0,
    isoHits.length ? isoHits.map(([k, v]) => `${k}: ${JSON.stringify(String(v).slice(0, 120))}`).join(" | ")
                   : `${surfaces.length} surfaces rendered clean`);
  say("9 no owner-facing surface shows an unformatted phone", phoneHits.length === 0,
    phoneHits.length ? phoneHits.map(([k, v]) => `${k}: ${JSON.stringify(String(v).slice(0, 120))}`).join(" | ")
                     : `${surfaces.length} surfaces rendered clean`);
  // AND THE POSITIVE. Absence of the bad format is not presence of the good one — a renderer
  // that dropped the phone entirely would pass leg 9 and lose the number.
  say("10 the job panel actually SHOWS the number, in house format",
    HOUSE.test(rendered.jobPanel) && /801-888-8566/.test(rendered.jobPanel),
    (String(rendered.jobPanel).match(/\d{3}-\d{3}-\d{4}/g) || []).join(", ") || "no phone found");
  say("11 the day sentence names the day in month/day/year",
    /09\/17\/2026|Today|Tomorrow/.test(rendered.editLine), JSON.stringify(String(rendered.editLine).slice(0, 120)));

  // ── 3. SOURCE SWEEP — a SECONDARY signal, printed honestly. ───────────────────────────
  //
  // Not a claim of exhaustiveness. It looks for the one shape that is always wrong in
  // platform-home.html: a date or phone COLUMN concatenated into a displayed string without
  // passing through a formatter. Reported so the next reader sees the remaining surface area.
  const src = readFileSync(resolve(ROOT, "public/platform-home.html"), "utf8");
  const lines = src.split("\n");
  const COLS = /(scheduled_date|due_date|occurred_at|created_at|paid_at|\.day\b)/;
  const FORMATTED = /(hcDateUS|hcDateTimeUS|hcDayLabel|hcAgo)/;
  const DISPLAYS = /(textContent|innerText|hcAppendMessage|\['[A-Z][a-z]+',)/;
  const suspects = [];
  lines.forEach((l, i) => {
    if (l.trim().startsWith("//") || l.trim().startsWith("*")) return;
    if (COLS.test(l) && DISPLAYS.test(l) && !FORMATTED.test(l)) suspects.push(i + 1);
  });
  say("12 no date column is concatenated into a displayed string unformatted",
    suspects.length === 0, suspects.length ? `platform-home.html lines ${suspects.join(", ")}` : "source sweep clean");

  // A PHONE VALUE IS A PROPERTY READ, never the English word in a sentence. The first version
  // matched `\bphone\b` and flagged three lines whose only "phone" was the word inside
  // "No phone or email on record" — three false positives, and a checker that cries wolf is a
  // checker that gets muted. Enumerate the harmless side: prose cannot carry a number; a
  // property access can.
  const phoneSuspects = [];
  lines.forEach((l, i) => {
    if (l.trim().startsWith("//") || l.trim().startsWith("*")) return;
    if (!/\.[a-z_]*phone\b/i.test(l)) return;                  // a VALUE, not the word
    if (!/(textContent|innerText|hcAppendMessage)/.test(l)) return;
    if (/hcPhoneHouse|replace\(\/\[\^0-9/.test(l)) return;    // formatted, or a tel: href
    phoneSuspects.push(i + 1);
  });
  say("13 no phone is displayed without the house formatter",
    phoneSuspects.length === 0, phoneSuspects.length ? `platform-home.html lines ${phoneSuspects.join(", ")}` : "source sweep clean");

  // ── 4. THE THREE RUNTIMES AGREE. One format, three implementations that MUST match. ───
  const edge = readFileSync(resolve(ROOT, "supabase/functions/_shared/hubly_contact.ts"), "utf8");
  const pub = readFileSync(resolve(ROOT, "public/hubly.html"), "utf8");
  say("14 the edge and the public page both still hold a house formatter",
    /export function formatPhoneHouse/.test(edge) && /function formatPhoneValue/.test(pub),
    "formatPhoneHouse (edge) · formatPhoneValue (public/hubly.html)");

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nOne date format, one phone format, and no raw value reaches a human.");
process.exit(failed ? 1 : 0);
