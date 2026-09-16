#!/usr/bin/env node
/**
 * OUR COLUMN NAMES NEVER REACH AN OWNER.
 *
 *   node scripts/check-no-machine-words.mjs
 *
 * ADRIAN, 2026-09-15: *"'Band B' and 'Lane: Work' are our column names and must never reach an
 * owner. The words are A — Must Do / B — Important / C — Nice to Do. One place, routed
 * everywhere, checked — same treatment as the date, phone and time formatters."*
 *
 * `tasks.band` and `tasks.lane` are STORAGE. The words in
 * docs/design/my-day-2026-09-15-approved.png are the product.
 *
 * It executes the mappers and then renders the real surfaces, because a source grep passes on a
 * string built at runtime — the shape-of-the-answer mistake (Lesson 83).
 *
 * SIMULATED AND SAID SO: no session; the backend is the declared fake in lib/owner-rig.mjs.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "file://" + join(ROOT, "public/platform-home.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

/** The machine vocabulary. Each is a COLUMN NAME or a raw column VALUE. */
const MACHINE = [
  { re: /\bBand\s+[ABC]\b/, what: '"Band B" — the column and its letter' },
  { re: /\bLane:/i, what: '"Lane:" — a column name as a label' },
  { re: /\bLane\b\s*[·|]/i, what: '"Lane ·" — the column in a detail line' },
  { re: /\bband_source\b|\bband_reason\b|\brolled_from\b|\broll_count\b/, what: "a raw column identifier" },
  { re: /(?:^|[^A-Za-z])Work(?:$|[^A-Za-z])/, what: '"Work" — the lane VALUE; the word is Business' },
];

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  console.log("SIMULATED — no session. The mappers and the surfaces are the product's.\n");
  await rig.load(PAGE);
  const seam = await rig.page.evaluate(() => !!(window.hublyWords && window.hublyWords.band));
  if (!seam) { console.error("CANNOT RUN — window.hublyWords is not exposed."); await rig.close(); process.exit(2); }

  // ── 1. THE MAPPERS, EXECUTED. ───────────────────────────────────────────────────────
  const w = await rig.page.evaluate(() => {
    const W = window.hublyWords;
    return {
      a: W.band("A"), b: W.band("b"), c: W.band("C"), junk: W.band("Z"), none: W.band(null),
      words: W.bandWords("B"),
      lanePersonal: W.lane("personal"), laneWork: W.lane("work"), laneJob: W.lane("job"), laneJunk: W.lane("zzz"),
    };
  });
  say("1 a band reads as its words, with the letter",
    w.a === "A — Must Do" && w.b === "B — Important" && w.c === "C — Nice to Do",
    `${w.a} · ${w.b} · ${w.c}`);
  say("2 an unknown band gets NO label rather than 'Band ?'", w.junk === null && w.none === null,
    `junk=${w.junk} none=${w.none}`);
  // THE LANE VALUE 'work' IS NOT THE WORD "Work" — the design's pill says Business.
  say("3 the lane pill says Job / Business / Personal, never the column value",
    w.lanePersonal === "Personal" && w.laneWork === "Business" && w.laneJob === "Job" && w.laneJunk === null,
    `${w.lanePersonal} · ${w.laneWork} · ${w.laneJob} · junk=${w.laneJunk}`);

  // ── 4. THE SURFACES, RENDERED — because a mapper can be right and unused. ───────────
  const TASK = { id: "t1", title: "Order glass cleaner", band: "B", band_source: "auto",
                 band_reason: "due tomorrow", lane: "work", due_date: null, due_time: null,
                 roll_count: 0, notes: null, status: "open" };
  const rendered = await rig.page.evaluate((task) => {
    const out = {};
    try { window.hublyTaskUI ? window.hublyTaskUI.panel(task) : null; } catch (_) {}
    const p = document.getElementById("hcPanel") || document.querySelector(".hc-panel");
    out.panel = p ? p.innerText.replace(/\s+/g, " ").trim() : "";
    return out;
  }, TASK);

  // hcTaskPanel has no seam, so this leg is HONEST ABOUT WHAT IT COULD NOT DRIVE rather than
  // asserting over an empty string and calling it clean.
  const drove = rendered.panel && rendered.panel.length > 10;
  say("4 the task panel was reachable to measure", !!drove,
    drove ? `${rendered.panel.length} chars` : "NOT DRIVEN — no seam for hcTaskPanel; leg 5 is source-only below");
  if (drove) {
    const hits = MACHINE.filter((m) => m.re.test(rendered.panel));
    say("5 no machine vocabulary in the rendered task panel", hits.length === 0,
      hits.length ? hits.map((h) => h.what).join(" | ") + " in " + JSON.stringify(rendered.panel.slice(0, 120)) : "clean");
    // AND THE POSITIVE, because absence is not presence: a panel that dropped the row entirely
    // would pass leg 5 and tell the owner nothing. Leg 5 alone stayed green under a restored
    // "Band B" defect once; this is the half that would have caught it.
    say("5a and it SAYS the words — the band and the lane are actually on screen",
      /B — Important/.test(rendered.panel) && /Business/.test(rendered.panel) && !/\bBand\b/.test(rendered.panel),
      JSON.stringify(rendered.panel.slice(0, 140)));
  }

  // ── 5b. MY DAY, RENDERED. Home's own surface, added 2026-09-16, and every string on it is
  //        new — so it is scanned here rather than trusted. Adrian's instruction with the
  //        ruling: "Run check-no-machine-words over every string you add." ─────────────────
  const day = await rig.page.evaluate(async () => {
    if (!(window.hublyDayUI && window.hublyDayUI.render)) return null;
    const host = document.createElement("div");
    host.className = "hc-inthread-day";
    document.body.appendChild(host);
    try {
      await window.hublyDayUI.render(host, { id: "sim-biz", slug: "sim", name: "Sim", url: "https://sim.myhubly.app" });
    } catch (_) { /* reported by the leg below, never swallowed into a pass */ }
    const text = host.innerText.replace(/\s+/g, " ").trim();
    host.remove();
    return text;
  });
  const dayDrove = !!(day && day.length > 20);
  say("5b My Day was reachable to measure", dayDrove,
    dayDrove ? `${day.length} chars` : "NOT DRIVEN — window.hublyDayUI.render did not produce a surface");
  if (dayDrove) {
    const dayHits = MACHINE.filter((m) => m.re.test(day));
    say("5c no machine vocabulary anywhere on My Day", dayHits.length === 0,
      dayHits.length ? dayHits.map((h) => h.what).join(" | ") + " in " + JSON.stringify(day.slice(0, 140)) : "clean");
    // AND THE POSITIVE HALF. Absence is not presence: a My Day that rendered no bands at all
    // would pass the scan above and show the owner nothing. Every day has an A, a B and a C.
    say("5d and it SAYS the band words — every day has an A, a B and a C",
      /Must Do/.test(day) && /Important/.test(day) && /Nice to Do/.test(day),
      JSON.stringify(day.slice(0, 120)));
  }

  // ── 6. SOURCE: the strings that build those lines go through the mappers. ───────────
  const src = readFileSync(resolve(ROOT, "public/platform-home.html"), "utf8");
  const bad = [];
  src.split("\n").forEach((l, i) => {
    if (l.trim().startsWith("//") || l.trim().startsWith("*")) return;
    // A LITERAL band/lane string being BUILT, not the mapper's own table.
    if (/['"]Band\s*['"]\s*\+|['"]Band\s+[ABC]/.test(l)) bad.push(`${i + 1}: ${l.trim().slice(0, 90)}`);
    if (/\[\s*['"]Lane['"]\s*,/.test(l)) bad.push(`${i + 1}: ${l.trim().slice(0, 90)}`);
    if (/\?\s*['"]Personal['"]\s*:\s*['"]Work['"]/.test(l)) bad.push(`${i + 1}: ${l.trim().slice(0, 90)}`);
  });
  say("6 no owner-facing string builds a band or lane label by hand", bad.length === 0,
    bad.length ? bad.join("  ||  ") : "every one goes through hcBandLabel / hcLaneLabel");

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally { try { await rig.close(); } catch (_) {} }

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nBands and lanes reach an owner as words, never as column names.");
process.exit(failed ? 1 : 0);
