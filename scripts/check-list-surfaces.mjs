#!/usr/bin/env node
/**
 * [RULE] ONE LIST ENGINE · ONE ROW SPEC PER KIND · AND THEY NEVER LOOK ALIKE.
 *
 *   node scripts/check-list-surfaces.mjs
 *
 * ADRIAN, 2026-09-16: "THEY SHARE THE MECHANISM, THEY MUST NEVER LOOK ALIKE … ONE LIST ENGINE. SIX
 * SURFACES THAT ARE NEVER CONFUSED … one row spec per kind with per-kind status words."
 *
 * WHAT THIS ASSERTS, and all of it is that sentence:
 *   · a kind is described ONCE (HC_THREAD_VIEWS) and a room is a PROJECTION of that spec, never a
 *     second implementation with its own idea of what a row of that kind looks like;
 *   · no two kinds share a status WORD, because the words are the only thing keeping the lists from
 *     reading the same;
 *   · a status value we have never seen is ECHOED, never renamed into a friendly guess;
 *   · a kind with no records has NO vocabulary at all — quotes and memberships are absent on
 *     purpose, and this check asserts the absence so that adding words for a record that has never
 *     existed goes red;
 *   · every place that can be EARNED into the rail has somewhere to go and its own icon.
 *
 * [RULE], not [SHAPE]: no leg asserts a count of kinds or a layout. Adding a fifth list is expected
 * and goes green as long as it brings its own words, its own icon and a destination — which is the
 * cost this check exists to impose.
 *
 * RED-PROOFED, SIX BREAKS, EACH RUN (table in docs/LIST_SURFACES.md):
 *   leads says "Booked" like jobs            -> legs 2, 6
 *   hcStatusWord invents "In progress"       -> leg 4
 *   a `quote` vocabulary is added            -> legs 3, 4
 *   leads added to HC_RAIL_DEFAULT           -> leg 9
 *   HC_ROOMS.leads removed                   -> leg 7
 *   leads reuses the jobs icon               -> leg 8
 * Legs 1, 5, 10-14 were seen red while being written (the accepted-request filter, the projection
 * comparison and the scoped absence each failed before the code they describe existed).
 *
 * SIMULATED AND SAID SO: no session, no network. The spec, the engine and the renderer are the
 * shipping product's; the booking requests and jobs are declared fakes.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { openRig } from "./lib/browser-rig.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";
import { codeOf, bodyOf } from "./lib/absence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "public/platform-home.html");
const PAGE = "file://" + FILE;
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture", name: "Hubly Classic Fixture" };
const REQS = [
  { id: "r1", business_id: BIZ.id, customer_name: "Dana", customer_phone: "8015551212",
    customer_email: null, service_name: "Full Detail", status: "pending", created_at: "2026-09-14T10:00:00Z" },
  { id: "r2", business_id: BIZ.id, customer_name: "Marcus", customer_phone: null,
    customer_email: null, service_name: "Express Wash", status: "abandoned", created_at: "2026-09-13T10:00:00Z" },
  { id: "r3", business_id: BIZ.id, customer_name: "Already booked", customer_phone: "8015559999",
    customer_email: null, service_name: "Full Detail", status: "accepted", created_at: "2026-09-12T10:00:00Z" },
  { id: "r4", business_id: BIZ.id, customer_name: "Odd one", customer_phone: "8015557777",
    customer_email: null, service_name: null, status: "snoozed", created_at: "2026-09-11T10:00:00Z" },
];

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  console.log("SIMULATED — no session, no network. The spec, the engine and the renderer are the product's.\n");
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "sim@example.com", displayName: "Adrian",
    tables: { jobs: [], tasks: [], booking_requests: REQS },
  });

  const seam = await rig.page.evaluate(() => {
    const L = window.hublyListUI || {};
    return {
      ok: !!(L.views && L.statusWords && L.surfaces && L.rooms),
      kinds: Object.keys(L.views || {}),
      complete: Object.entries(L.views || {}).filter(([, v]) =>
        typeof v.load === "function" && typeof v.parts === "function" &&
        typeof v.open === "function" && typeof v.title === "string" && !!v.empty).map(([k]) => k),
      words: L.statusWords || {},
      surfaces: Object.keys(L.surfaces || {}),
      railDefault: Object.keys(L.railDefault || {}),
      rooms: Object.keys(L.rooms || {}),
      // THE WHOLE ICON, NOT A PREFIX. Slicing to 60 chars measured the shared
      // `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" st` boilerplate and reported
      // "4 places, 1 distinct icons" against four genuinely different drawings — the probe failing
      // in the flattering-alarm direction, which is the one that gets acted on. A probe that cannot
      // tell identical from same-prefixed is measuring its own truncation.
      icons: Object.fromEntries(Object.entries(L.surfaces || {}).map(([k, v]) => [k, String(v.icon || "")])),
    };
  });
  if (!seam.ok) { console.error("CANNOT RUN — platform-home.html publishes no hublyListUI seam"); await rig.close(); process.exit(2); }

  say("1 every kind carries a COMPLETE spec — load, parts, open, title, emptiness",
      seam.complete.length === seam.kinds.length,
      `${seam.complete.length}/${seam.kinds.length}: ${seam.kinds.join(", ")}`);

  // ── NO TWO KINDS SHARE A STATUS WORD ────────────────────────────────────────────────────
  const byWord = {};
  for (const [kind, map] of Object.entries(seam.words))
    for (const w of Object.values(map)) (byWord[String(w).toLowerCase()] ||= []).push(kind);
  const shared = Object.entries(byWord).filter(([, ks]) => ks.length > 1);
  say("2 no status word is used by two kinds — the words are what keep the lists apart",
      shared.length === 0,
      shared.length ? shared.map(([w, ks]) => `"${w}" in ${ks.join("+")}`).join("; ") : `${Object.keys(byWord).length} distinct words`);

  // ── A KIND WITH NO RECORDS HAS NO VOCABULARY ────────────────────────────────────────────
  say("3 no vocabulary exists for a record that has never existed (no quote, no membership words)",
      !seam.words.quote && !seam.words.membership && !seam.words.quotes && !seam.words.memberships,
      `kinds with words: ${Object.keys(seam.words).join(", ")}`);

  // ── ECHO, NEVER RENAME ──────────────────────────────────────────────────────────────────
  const words = await rig.page.evaluate(() => ({
    known: window.hublyListUI.statusWord("job", "scheduled"),
    done: window.hublyListUI.statusWord("job", "completed"),
    lead: window.hublyListUI.statusWord("lead", "pending"),
    unseen: window.hublyListUI.statusWord("job", "snoozed"),
    noKind: window.hublyListUI.statusWord("quote", "sent"),
    empty: window.hublyListUI.statusWord("job", ""),
    nul: window.hublyListUI.statusWord("job", null),
  }));
  say("4 a known value is translated; an UNSEEN one is echoed, never renamed",
      words.known === "Booked" && words.done === "Done" && words.unseen === "snoozed" && words.noKind === "sent",
      JSON.stringify(words));
  say("5 nothing in, nothing out — an absent status produces null, not a word",
      words.empty === null && words.nul === null, `"${words.empty}" / "${words.nul}"`);
  say("6 a lead and a job never say the same thing about themselves",
      words.lead !== words.known && /waiting/i.test(words.lead), `lead="${words.lead}" job="${words.known}"`);

  // ── AN EARNABLE PLACE HAS SOMEWHERE TO GO AND ITS OWN PICTURE ───────────────────────────
  const needRoom = seam.surfaces.filter((k) => k !== "website");
  const missingRoom = needRoom.filter((k) => !seam.rooms.includes(k));
  say("7 every place that can be earned into the rail has a room to open",
      missingRoom.length === 0, missingRoom.length ? `no room for: ${missingRoom.join(", ")}` : needRoom.join(", ") + " + website");
  const iconVals = Object.values(seam.icons);
  const dupIcon = Object.entries(seam.icons).filter(([k, v]) =>
    Object.entries(seam.icons).some(([k2, v2]) => k2 !== k && v2 === v)).map(([k]) => k);
  say("8 every place has its OWN icon — no two share a drawing, and none is empty",
      new Set(iconVals).size === iconVals.length && iconVals.every((v) => v.length > 40),
      dupIcon.length ? `same drawing on: ${dupIcon.join(", ")}` : `${iconVals.length} places, ${new Set(iconVals).size} distinct icons`);
  say("9 leads is EARNABLE but not shown by default — progressive navigation, unchanged",
      seam.surfaces.includes("leads") && !seam.railDefault.includes("leads"),
      `surfaces: ${seam.surfaces.join(",")} · default rail: ${seam.railDefault.join(",")}`);

  // ── THE LEAD LIST ITSELF, LOADED AND RENDERED BY THE PRODUCT ────────────────────────────
  const leads = await rig.page.evaluate(async ({ biz }) => {
    const v = window.hublyListUI.views.leads;
    const rows = await v.load(biz);
    const host = document.createElement("div");
    document.body.appendChild(host);
    await window.hublyListUI.room("leads")(host, biz);
    const out = {
      loaded: rows.map((r) => r.customer_name),
      parts: rows.map((r) => v.parts(r)),
      rowTitles: [...host.querySelectorAll(".hc-row .hc-row-t")].map((e) => e.textContent),
      rowSubs: [...host.querySelectorAll(".hc-row .hc-row-s")].map((e) => e.textContent),
      rowTails: [...host.querySelectorAll(".hc-row .hc-row-tail")].map((e) => e.textContent),
      count: (host.textContent.match(/\d+ (person|people)/) || [""])[0],
    };
    host.remove();
    return out;
  }, { biz: BIZ });
  say("10 an ACCEPTED request is not a lead — it is a job, and it appears in one list only",
      !leads.loaded.includes("Already booked") && leads.loaded.length === 3,
      `loaded: ${leads.loaded.join(", ")}`);
  say("11 the room renders exactly what the SPEC says — it is a projection, not a second list",
      JSON.stringify(leads.rowTitles) === JSON.stringify(leads.parts.map((p) => p[0])) &&
      JSON.stringify(leads.rowSubs) === JSON.stringify(leads.parts.map((p) => p[1])),
      `${leads.rowTitles.length} rows, titles and subs both from parts()`);
  say("12 a lead with no phone and no email SAYS so — the space is never left blank",
      leads.rowSubs.some((t) => /no phone or email/i.test(t)),
      JSON.stringify(leads.rowSubs));
  say("13 the count is his own rows in his own words, never a corpus figure",
      leads.count === "3 people", `"${leads.count}"`);

  // ── AND THE JOBS ROOM NO LONGER SHOWS A COLUMN VALUE. Scoped to its own function body. ──
  const jobsBody = codeOf(bodyOf(readFileSync(FILE, "utf8"), "async function hcRenderJobs(canvas, biz){"));
  say("14 the jobs room puts no raw status column in front of the owner (scoped to its body)",
      !!jobsBody && !/j\.status\s*\|\|/.test(jobsBody) && /hcStatusWord\('job'/.test(jobsBody),
      jobsBody ? `scope = hcRenderJobs body, ${jobsBody.length} chars of code` : "could not slice the room's body");
} finally { await rig.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — one engine, one spec per kind, and no two lists speak the same words.\n");
process.exit(failed ? 1 : 0);
