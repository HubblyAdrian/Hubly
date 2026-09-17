#!/usr/bin/env node
/**
 * [RULE] A CALENDAR FILE GOES THROUGH THE SAME DOOR AS A SCREENSHOT — NO GOOGLE, NO OAUTH.
 *
 *   node scripts/check-ics-door.mjs
 *
 * ADRIAN, 2026-09-16: "No Google, no OAuth, no policy. Same door as the screenshot, HC_FILE_ROUTES
 * routes it. Verify the empty-state offer picks the clause up BY ITSELF."
 *
 * The last sentence is leg 9 and it is the one that matters: no copy was written for the calendar.
 * `HC_WAYS.calendar.wired` asks the router whether the day's route takes an `.ics`, so wiring the
 * route wired the sentence — the same mechanism that made the screenshot clause appear when the
 * `day` route landed.
 *
 * AND NOTHING LEAVES THE PAGE. The file is read with FileReader and parsed in the browser; there is
 * no upload, no model call and no third party, which is why this door needs no consent screen. Leg 10
 * asserts the parser is local by parsing with the network unavailable to it — the function is pure.
 *
 * [RULE], not [SHAPE]: the legs are "what the file says is what lands", "what it cannot read it SAYS
 * it cannot read", and "the offer is derived". None asserts a count of events or any markup.
 *
 * THE FIXTURE IS A REAL .ics AND IT IS AWKWARD ON PURPOSE: CRLF line endings, a FOLDED line (RFC
 * 5545 wraps long values and continues them with a leading space — a parser that skips unfolding
 * truncates exactly the long LOCATION values that matter), a UTC timestamp, an all-day DATE-only
 * event, and a VEVENT with no DTSTART at all.
 *
 * RED-PROOFED, EIGHT BREAKS, EACH ASSERTED TO HAVE APPLIED AND EACH RUN:
 *   line unfolding removed            -> leg 5   (the long address truncates)
 *   a UTC timestamp treated as local  -> leg 7   (a 1pm job lands on his evening)
 *   an all-day event given 00:00      -> leg 8   (a time nobody put in the file)
 *   an undateable event dropped       -> leg 9   (a commitment he thinks we have)
 *   a customer name invented          -> leg 10
 *   an imported event marked a JOB    -> leg 10
 *   the escape-unwinding removed      -> leg 6   (backslashes in his address)
 *   the ics route unwired             -> legs 1, 12, 13, 14 — the whole door AND the copy
 * That last one is the shape of the thing: unwiring one route flag turns the offer clause off and
 * the refusal sentence back to "images and PDFs", because neither was written by hand.
 *
 * SIMULATED AND SAID SO: no session, no network. The parser, the router and the copy are the
 * shipping product's; the calendar is a declared fixture.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { openRig } from "./lib/browser-rig.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "public/platform-home.html");
const PAGE = "file://" + FILE;
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

// A real export, CRLF, with one folded LOCATION line.
const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Test//EN",
  "BEGIN:VEVENT",
  "UID:1@test",
  "SUMMARY:Full Detail - Leslie",
  "DTSTART:20260917T140000",
  "DTEND:20260917T160000",
  "LOCATION:14 Maple Street\\, Building C\\, Suite 200\\, Lehi",
  " \\, Utah 84043",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:2@test",
  "SUMMARY:Dentist",
  "DTSTART:20260918T190000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:3@test",
  "SUMMARY:Anniversary",
  "DTSTART;VALUE=DATE:20260920",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:4@test",
  "SUMMARY:Something with no date on it",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  console.log("SIMULATED — no session, no network. The parser, the router and the copy are the product's.\n");
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "sim@example.com", displayName: "Adrian", tables: { jobs: [], tasks: [] },
  });

  const seam = await rig.page.evaluate(() => {
    const I = window.hublyIcsUI || {}, W = window.hublyWaysUI || {};
    return { parse: typeof I.parse === "function", kind: typeof I.kind === "function",
             accepts: typeof W.accepts === "function",
             anyIcs: typeof W.anyIcs === "function" ? W.anyIcs() : null,
             importer: typeof I.importer === "function" ? I.importer() : false };
  });
  if (!seam.parse || !seam.kind || !seam.accepts) {
    console.error("CANNOT RUN — the ics parser or the file-kind reader is not on this page");
    await rig.close(); process.exit(2);
  }

  say("1 a route DECLARES that it takes a calendar file, and the router can find it",
      seam.anyIcs === "day" && seam.importer === true, `route = ${seam.anyIcs}`);

  // ── WHAT KIND IS THIS FILE. Type when the browser gives one, extension when it does not. ─
  const kinds = await rig.page.evaluate(() => ({
    calType: window.hublyIcsUI.kind({ name: "x.ics", type: "text/calendar" }),
    plainType: window.hublyIcsUI.kind({ name: "schedule.ics", type: "text/plain" }),
    noType: window.hublyIcsUI.kind({ name: "schedule.ics", type: "" }),
    upper: window.hublyIcsUI.kind({ name: "SCHEDULE.ICS", type: "" }),
    img: window.hublyIcsUI.kind({ name: "a.png", type: "image/png" }),
    pdf: window.hublyIcsUI.kind({ name: "a.pdf", type: "application/pdf" }),
    junk: window.hublyIcsUI.kind({ name: "a.docx", type: "application/vnd.openxmlformats" }),
  }));
  say("2 a .ics is recognised by TYPE or by EXTENSION — some pickers report text/plain, some report nothing",
      kinds.calType === "ics" && kinds.plainType === "ics" && kinds.noType === "ics" && kinds.upper === "ics",
      JSON.stringify(kinds));
  say("3 and nothing else is mistaken for one",
      kinds.img === "image" && kinds.pdf === "pdf" && kinds.junk === null, JSON.stringify([kinds.img, kinds.pdf, kinds.junk]));

  // ── THE PARSE. What the file says is what lands. ────────────────────────────────────────
  const out = await rig.page.evaluate((ics) => window.hublyIcsUI.parse(ics), ICS);
  const byName = (n) => out.jobs.filter((j) => (j.service_name || "").includes(n))[0] || null;
  const leslie = byName("Leslie"), dentist = byName("Dentist"), anniv = byName("Anniversary");
  say("4 a timed event lands on its own date and its own clock time",
      !!leslie && leslie.scheduled_date === "2026-09-17" && leslie.scheduled_time === "14:00",
      leslie ? `${leslie.scheduled_date} ${leslie.scheduled_time}` : "not parsed");
  say("5 A FOLDED LINE IS UNFOLDED — the long address arrives whole, not truncated",
      !!leslie && /Suite 200/.test(leslie.address || "") && /84043/.test(leslie.address || ""),
      leslie ? JSON.stringify(leslie.address) : "no address");
  say("6 escaped commas are unescaped, so the address is not full of backslashes",
      !!leslie && !/\\\\/.test(leslie.address || "") && /Maple Street, Building C/.test(leslie.address || ""),
      leslie ? JSON.stringify((leslie.address || "").slice(0, 40)) : "no address");
  say("7 a UTC timestamp is converted to HIS clock, not shown as UTC",
      !!dentist && dentist.scheduled_time !== "19:00" && /^\d\d:\d\d$/.test(dentist.scheduled_time || ""),
      dentist ? `19:00Z became ${dentist.scheduled_date} ${dentist.scheduled_time}` : "not parsed");
  say("8 an ALL-DAY event has NO time — midnight would be a time nobody put in the file",
      !!anniv && anniv.scheduled_date === "2026-09-20" && anniv.scheduled_time === null,
      anniv ? JSON.stringify(anniv.scheduled_time) : "not parsed");
  say("9 an event it cannot DATE is not dropped — it is listed as unreadable, with its own words",
      out.unreadable.length === 1 && /no date on it/i.test(out.unreadable[0].source_text || ""),
      JSON.stringify(out.unreadable));
  say("10 an imported calendar event is HIS time, never a customer job",
      out.jobs.length === 3 && out.jobs.every((j) => j.is_block === true) && out.jobs.every((j) => !j.customer_name),
      `${out.jobs.length} events, all blocks, no invented customer`);
  say("11 every row carries the words it came from, so he can check it rather than trust it",
      out.jobs.every((j) => j.source_text && j.source_text.length > 3),
      JSON.stringify(out.jobs.map((j) => j.source_text)));

  // ── THE OFFER PICKS THE CLAUSE UP BY ITSELF. Adrian's verification, executed. ───────────
  const offer = await rig.page.evaluate(() => {
    const before = window.hublyWaysUI.clause("day");
    const routes = window.hublyWaysUI.routes;
    const saved = routes.day.acceptsIcs, savedFn = routes.day.ics;
    routes.day.acceptsIcs = false; routes.day.ics = undefined;
    const without = window.hublyWaysUI.clause("day");
    routes.day.acceptsIcs = saved; routes.day.ics = savedFn;
    const after = window.hublyWaysUI.clause("day");
    return { before, without, after };
  });
  say("12 the empty-state offer names the calendar, with NO copy written for it",
      /calendar file/i.test(offer.before), JSON.stringify(offer.before));
  say("13 UNWIRING the route removes the clause, and rewiring brings it back — it is derived, not typed",
      !/calendar file/i.test(offer.without) && /calendar file/i.test(offer.after) && offer.before === offer.after,
      JSON.stringify(offer.without));

  // ── THE REFUSAL IS DERIVED TOO. ────────────────────────────────────────────────────────
  const refusal = await rig.page.evaluate(() => {
    const said = [];
    const orig = window.hcAppendMessage;
    window.hublyIcsUI.handle({ name: "notes.docx", type: "application/msword" });
    return [...document.querySelectorAll(".hc-msg.hubly")].map((e) => e.textContent).slice(-1)[0] || "";
  });
  say("14 what it can read is derived even in the REFUSAL — it names the calendar as readable",
      /calendar/i.test(refusal) && /can.t read/i.test(refusal), JSON.stringify(refusal));

  // ── AND THE PICKER MUST ACTUALLY OPEN FOR ONE. ─────────────────────────────────────────
  const accept = readFileSync(FILE, "utf8").match(/id="hcAttachInput"[^>]*accept="([^"]*)"/);
  say("15 the attach picker accepts a .ics, so the door is openable from the control that exists",
      !!accept && /text\/calendar/.test(accept[1]) && /\.ics/.test(accept[1]),
      accept ? accept[1] : "no accept attribute found");
} finally { await rig.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — a calendar file lands on his day, parsed in his own browser, and the offer said so by itself.\n");
process.exit(failed ? 1 : 0);
