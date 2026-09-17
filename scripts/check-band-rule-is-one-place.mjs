#!/usr/bin/env node
/**
 * [RULE] A/B/C IS ONE STATED RULE, IN ONE PLACE, AND IT NEVER FALLS THROUGH TO C IN SILENCE.
 *
 *   node scripts/check-band-rule-is-one-place.mjs
 *
 * THE RULE, ADRIAN, 2026-09-16, VERBATIM:
 *   "A — work a CUSTOMER IS EXPECTING TODAY. He committed to it; must-do by definition.
 *    B — his own work WITH A DEADLINE. Important, but nobody is waiting on him.
 *    C — everything else."
 *   "BUILD THE ASSIGNMENT IN ONE PLACE so changing the rule costs a line, not a rebuild."
 *   "hcDayAddRow must set a band. An unbanded thing must not silently become C — if it genuinely
 *    cannot be derived, say so on the row rather than defaulting in silence."
 *
 * [RULE], NOT [SHAPE]: every leg below is one of those four sentences. None of them asserts a
 * count, a class name or a layout, so a red leg here is a product defect and never a stale
 * expectation about markup. (Lesson 92 / the write-time declaration rule.)
 *
 * WHAT WAS ACTUALLY BROKEN WHEN THIS WAS WRITTEN, and what each leg was seen RED against:
 *   hcItemBand was `if(kind==='job') return 'A'; ... : 'C'` — three defects in two lines.
 *     · A BLOCK became an A. "doctor's appointment" lives in the jobs table, so his own
 *       appointment was rendered as work a customer is expecting. (leg 3)
 *     · EVERYTHING ELSE became a C by fall-through, including items we failed to read —
 *       and C *means* "completely okay if it doesn't happen", so an unreadable row was
 *       silently labelled optional. (legs 5, 6)
 *     · hcAddDayTask wrote `p_band:'B'` as a literal with no reason, which is how every task
 *       in the corpus carries the pre-rule default. (legs 8, 9)
 *
 * THE FAILURE IS SILENT IN EVERY DIRECTION, which is why the legs are derivation legs and not
 * presence legs: a mis-banded item renders perfectly, in the wrong section, and looks like a
 * decision somebody made.
 *
 * NEGATIVE ASSERTIONS ARE SCOPED (the rule added to SETTLED.md as 31): the two absence legs here
 * are anchored to a FUNCTION BODY sliced out of the file, never to the whole file and never to a
 * bare identifier — this comment names both `p_band: 'B'` and `: 'C'`, and a file-wide search
 * would trip on this very paragraph.
 *
 * SIMULATED AND SAID SO: no session, no network. The rule, the writer and the renderer are the
 * shipping product's; the jobs and tasks are declared fakes.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { openRig } from "./lib/browser-rig.mjs";
import { codeOf, bodyOf } from "./lib/absence.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "public/platform-home.html");
const PAGE = "file://" + FILE;
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Hubly Classic Fixture", url: "https://hubly-classic-fixture.myhubly.app" };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TODAY = iso(new Date());
const TOMORROW = iso(new Date(Date.now() + 864e5));

// The two absence disciplines live in scripts/lib/absence.mjs (SETTLED 31), because the fix
// belongs where the next check will find it rather than as a third private copy: bodyOf() anchors
// the claim to a brace-counted function body, codeOf() strips the comments that explain the
// deletion. Leg 10 went red against the CORRECT product until codeOf() was applied — the comment
// inside hcAddDayTask names the very string the leg says is gone.
const fnBody = (src, decl) => bodyOf(src, decl);

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  console.log("SIMULATED — no session, no network. The rule, the writer and the renderer are the product's.\n");
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "sim@example.com", displayName: "Adrian", tables: { jobs: [], tasks: [] },
  });

  // ── LEG 1: THE RULE IS REACHABLE AS A RULE. ──────────────────────────────────────────────
  const seam = await rig.page.evaluate(() => ({
    derive: typeof window.hublyDayUI?.deriveBand === "function",
    rule: window.hublyDayUI?.bandRule || null,
    band: typeof window.hublyDayUI?.band === "function",
  }));
  say("1 the rule is one reachable function, and it publishes its own three sentences",
      seam.derive && seam.band && seam.rule && seam.rule.A && seam.rule.B && seam.rule.C,
      seam.rule ? `A=${seam.rule.A}` : "no bandRule on the seam");

  const derive = (it, day) => rig.page.evaluate(
    ({ it, day }) => window.hublyDayUI.deriveBand(it, day), { it, day });

  const job = (over) => ({ kind: "job", what: "x", raw: Object.assign(
    { id: "j1", scheduled_date: TODAY, customer_name: "Leslie", is_block: false }, over || {}) });
  const task = (over) => ({ kind: "task", what: "x", raw: Object.assign(
    { id: "t1", due_date: null, band: null, band_source: "proposed" }, over || {}) });

  // ── LEG 2: A — WORK A CUSTOMER IS EXPECTING TODAY. ───────────────────────────────────────
  const a = await derive(job({}), TODAY);
  say("2 a customer's job today is an A, and says why", a.band === "A" && a.source === "rule" && /customer/i.test(a.why || ""),
      `${a.band} · ${a.source} · ${a.why}`);

  // ── LEG 3: A BLOCK IS NOT AN A. Seen red on `if(kind==='job') return 'A'`. ────────────────
  const blk = await derive(job({ is_block: true, customer_name: null }), TODAY);
  say("3 his own blocked time today is a B, never an A — nobody is waiting on him",
      blk.band === "B" && blk.source === "rule", `${blk.band} · ${blk.why}`);

  // ── LEG 4: B AND C ARE SEPARATED BY THE DEADLINE, which is the rule's own wording. ───────
  const withDue = await derive(task({ due_date: TODAY }), TODAY);
  const noDue = await derive(task({ due_date: null }), TODAY);
  say("4 his own work with a deadline is a B; without one it is a C",
      withDue.band === "B" && noDue.band === "C" && noDue.source === "rule",
      `due=${withDue.band} · undated=${noDue.band} (${noDue.why})`);

  // ── LEG 5: UNREADABLE IS NOT C. Seen red on the `: 'C'` fall-through. ────────────────────
  const dateless = await derive(job({ scheduled_date: null }), TODAY);
  say("5 a job with no date is UNPLACED with a reason — not quietly a C",
      dateless.band === null && dateless.source === "unknown" && (dateless.why || "").length > 20,
      `${dateless.band} · ${dateless.why}`);

  // ── LEG 6: NOTHING AT ALL IS NOT C EITHER. ───────────────────────────────────────────────
  const nothing = await derive(null, TODAY);
  say("6 an item we have no record for is UNPLACED, not a C",
      nothing.band === null && nothing.source === "unknown", `${nothing.band} · ${nothing.why}`);

  // ── LEG 7: HIS WORD WINS AND STICKS. ─────────────────────────────────────────────────────
  const his = await derive(job({ band: "C", band_source: "owner" }), TODAY);
  say("7 when he has moved it himself, his band wins over the rule and says so",
      his.band === "C" && his.source === "owner", `${his.band} · ${his.source} · ${his.why}`);

  // ── LEG 8: THE OLD STORED DEFAULT DOES NOT. ──────────────────────────────────────────────
  // Every task in the corpus carries band='B', band_source='proposed' — the default stamped
  // before this rule existed. If a 'proposed' value won, changing the rule would cost a
  // migration over the whole corpus, which is precisely what Adrian ruled out.
  const stale = await derive(job({ band: "C", band_source: "proposed" }), TODAY);
  say("8 a 'proposed' band is OUR old word and is re-derived, so changing the rule costs a line",
      stale.band === "A" && stale.source === "rule", `${stale.band} · ${stale.source}`);

  // ── LEG 9: THE WRITER STAMPS WHAT THE RULE DECIDED, with a reason. ───────────────────────
  const wrote = await rig.page.evaluate(async ({ biz }) => {
    window.__rig.writes.length = 0;
    // THE REAL STATE, THROUGH THE SEAM THE PRODUCT ALREADY PUBLISHES. hcAddDayTask refuses
    // without a business, exactly as it should, so a check that wants to watch it write has to
    // give it one (the same seam check-no-contradicting-reask uses).
    window.hublyCaptureUI.withBusiness(biz.id);
    const res = await window.hublyDayUI.add({ title: "order glass cleaner", time: "", place: "", date: null });
    const w = window.__rig.writes.filter((x) => x.name === "create_task");
    return { res, args: w.length ? w[0].args : null };
  }, { biz: BIZ });
  const wargs = wrote.args;
  say("9 the writer sends the band the RULE derived, with its reason attached",
      !!wargs && (wargs.p_band === "B" || wargs.p_band === "C") && typeof wargs.p_band_reason === "string" && wargs.p_band_reason.length > 3,
      wargs ? `p_band=${wargs.p_band} · reason=${wargs.p_band_reason}` : `no create_task write (res=${JSON.stringify(wrote.res)})`);

  // ── LEG 10: THE WRITER HAS NO LITERAL BAND LEFT IN IT. Scoped to its own function body. ──
  const src = readFileSync(FILE, "utf8");
  const writerBody = fnBody(src, "async function hcAddDayTask(input){");
  const writerCode = codeOf(writerBody);
  say("10 no hardcoded band survives inside hcAddDayTask's own body (scoped to the body, comments stripped)",
      !!writerBody && !/p_band\s*:\s*['"][ABC]['"]/.test(writerCode) && /p_band\s*:\s*band\.band/.test(writerCode),
      writerBody ? "scope = hcAddDayTask body, " + writerCode.length + " chars of code" : "could not slice the writer's body");

  // ── LEG 11: THE RENDER HAS NO C FALL-THROUGH. Scoped to hcDeriveBand's own body. ─────────
  const ruleBody = fnBody(src, "function hcDeriveBand(it, dayISO){");
  const cReturns = (ruleBody || "").match(/hcBandResult\(\s*'C'/g) || [];
  say("11 exactly ONE place in the rule can produce a C, and it is a derivation not a default",
      cReturns.length === 1, `${cReturns.length} C-returns inside hcDeriveBand`);

  // ── LEG 12: AN UNPLACED ITEM SAYS SO ON THE ROW, on the real rendered day. ───────────────
  const rendered = await rig.page.evaluate(async ({ biz, today }) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await window.hublyDayUI.render(host, biz);
    const sections = [...host.querySelectorAll(".hcmd-band")].map((s) => s.getAttribute("data-band"));
    const unsure = host.querySelector('.hcmd-band[data-band="?"]');
    const rows = unsure ? [...unsure.querySelectorAll(".hcmd-row")].map((r) => ({
      why: (r.querySelector(".hcmd-whatsub") || {}).textContent || "",
      attr: r.getAttribute("data-band-why") || "",
    })) : [];
    const cRows = [...host.querySelectorAll('.hcmd-band[data-band="C"] .hcmd-row')].length;
    host.remove();
    return { sections, rows, cRows };
  }, { biz: BIZ, today: TODAY });
  // Re-render with a dateless job in the fixture so the unplaced case is a real render.
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "sim@example.com", displayName: "Adrian",
    // THE UNDATED JOB IS A DECLARED FIXTURE THE LIVE READER CANNOT CURRENTLY PRODUCE, AND THIS
    // SAYS SO. `jobs.scheduled_date` is nullable and 0 rows carry a null today; hcLoadJobs
    // filters with .gte/.lte, which in real Postgres excludes a null row outright, so an undated
    // job would not come back from the database at all. What legs 13-14 prove is therefore the
    // RENDERER's half — handed such an item, it places it in "?" with a reason instead of in C —
    // not that the read produces one. The read-side gap is written down with its line numbers in
    // docs/BAND_RULE.md rather than claimed as covered here. (The rig's fake ignores range
    // filters, which is what makes the fixture reach the renderer at all.)
    tables: { jobs: [{ id: "j0", business_id: BIZ.id, scheduled_date: null, scheduled_time: "09:00",
                       customer_name: "Leslie", service_name: "Full Detail", is_block: false,
                       amount: 180, address: "14 Maple St" },
                     { id: "j1", business_id: BIZ.id, scheduled_date: TODAY, scheduled_time: "08:00",
                       customer_name: "Marcus", service_name: "Full Detail", is_block: false,
                       amount: 180, address: "2 Oak Ave" }],
              tasks: [] },
  });
  const withUnsure = await rig.page.evaluate(async ({ biz }) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await window.hublyDayUI.render(host, biz);
    const sections = [...host.querySelectorAll(".hcmd-band")].map((s) => s.getAttribute("data-band"));
    const unsure = host.querySelector('.hcmd-band[data-band="?"]');
    const rows = unsure ? [...unsure.querySelectorAll(".hcmd-row")].map((r) => ({
      sub: (r.querySelector(".hcmd-whatsub") || {}).textContent || "",
      src: r.getAttribute("data-band-source") || "",
    })) : [];
    const cRows = [...host.querySelectorAll('.hcmd-band[data-band="C"] .hcmd-row')].length;
    const aRows = [...host.querySelectorAll('.hcmd-band[data-band="A"] .hcmd-row')].length;
    host.remove();
    return { sections, rows, cRows, aRows };
  }, { biz: BIZ });
  say("12 A, B and C are on every day — all three, always (Adrian: \"Not some days\")",
      ["A", "B", "C"].every((b) => rendered.sections.includes(b)) &&
      ["A", "B", "C"].every((b) => withUnsure.sections.includes(b)),
      `empty day: ${rendered.sections.join(",")} · with items: ${withUnsure.sections.join(",")}`);
  say("13 the unplaced item gets its own announced section and says WHY on its row",
      withUnsure.sections.includes("?") && withUnsure.rows.length === 1 &&
      withUnsure.rows[0].src === "unknown" && /date/i.test(withUnsure.rows[0].sub),
      withUnsure.rows.length ? `"${withUnsure.rows[0].sub}"` : `sections=${withUnsure.sections.join(",")}`);
  say("14 and it did NOT land in C, which is what the fall-through used to do",
      withUnsure.cRows === 0 && withUnsure.aRows === 1,
      `C rows=${withUnsure.cRows} · A rows=${withUnsure.aRows}`);
  say("15 the \"?\" section is absent on a day where nothing failed to read — it is not a band",
      !rendered.sections.includes("?"), `empty day sections: ${rendered.sections.join(",")}`);
} finally { await rig.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — the band rule is one place, and it never guesses a C.\n");
process.exit(failed ? 1 : 0);
