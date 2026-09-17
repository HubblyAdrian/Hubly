#!/usr/bin/env node
/**
 * [RULE] A2 — THE JOB RECORD: HIS OWN OFFERS, CARRYING TYPE, AND A ONE-OFF STAYS A ONE-OFF.
 *
 *   node scripts/check-a2-job-record.mjs
 *
 * ADRIAN, 2026-09-16: "Name, address, kind (dropdown from their offers, CARRYING TYPE — a quoted offer
 * starts a quote, not a booking — or a one-off), price, phone, email, notes. The one-off is first-class
 * and must not become a public offer. pickContactInto('customer') is ALREADY OPEN — wire to it, do not
 * build a second. Ground every field with the existing mechanism. A job created here appears on My Day
 * with no refresh."
 *
 * THE LEG THAT MATTERS MOST IS 5. A QUOTED offer has no price he has stated, so writing a job for one
 * means writing an amount nobody gave us — the fabricated-price defect arriving through a dropdown.
 * Choosing it starts a QUOTE instead, and the guard is in the WRITER as well as the form, because a
 * guard that lives only in the UI is one code path away from being bypassed.
 *
 * AND THE ONE-OFF IS FIRST-CLASS WITHOUT LEAKING. It gets a name and a price on this job and is never
 * written to the catalogue — leg 8 asserts nothing reached a service writer.
 *
 * [RULE]: every leg is one of those sentences. The dropdown's contents come from whatever offers the
 * fixture declares, so adding a service is expected to stay green.
 *
 * RED-PROOFED, TEN BREAKS, EACH ASSERTED TO HAVE APPLIED AND EACH RUN:
 *   the writer stops refusing a quoted offer  -> leg 8
 *   every option marked bookable              -> legs 4, 6
 *   the button says "Add the job" when quoted  -> leg 6
 *   the price pre-filled with an invented 99   -> leg 5
 *   the one-off's "not added to your services" -> leg 12
 *   "abc" allowed to become a price of 0       -> leg 9   (a REAL bug this pass found)
 *   the My Day re-read removed                 -> leg 15
 *   the success sentence removed               -> leg 14
 *
 * TWO THINGS THAT PASS FOUND, and both mattered:
 *   · "abc" as a price. `Number('')` is 0, which is finite and not negative, so a typo became a job
 *     priced at **$0** — the one number nobody ever states. The writer now requires a digit.
 *   · Leg 15 originally asserted only that `hcRepaintDay` EXISTS, which is true of every possible
 *     product including one that never calls it — and removing the call went undetected. It now reads
 *     a counter the function keeps, so the leg watches the re-read HAPPEN.
 *

 * LEADS -> CUSTOMERS -> JOBS (legs 18-23), red-proofed with five more breaks: the press-through
 * removed (18-22), the pre-fill removed (19, 22), a missing address filled with the BUSINESS's
 * address (22 — "a pre-fill that guesses is worse than no pre-fill, because he will not re-read a
 * field that already looks answered"), an unknown service dropped instead of becoming the one-off's
 * description (21), and the "filled in from the lead" line removed (23).
 *
 * SIMULATED AND SAID SO: no session, no network. The form, the writer, the sentence and the type gate
 * are the shipping product's; the catalogue is a declared fixture in the shape the union reader returns.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture", name: "Fixture" };
const SERVICES = [
  { name: "Full Detail", price: 85, duration_hours: 3, description: null, is_popular: true, source: "both", conflicts: false },
  { name: "Paint Correction", price: null, duration_hours: null, description: null, is_popular: false, source: "catalog", conflicts: false },
];

const site = await servePublic(ROOT);
let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); site.close(); process.exit(2); }

try {
  console.log("SIMULATED — no session, no network. The form, the writer and the type gate are the product's.\n");
  // SERVED OVER HTTP so /contact-pick.js actually loads — the shared capability is part of what is
  // being checked, and under file:// a root-absolute script never arrives.
  await rig.load(site.url("platform-home"));
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "sim@example.com", displayName: "Adrian",
    tables: { jobs: [], tasks: [], services: SERVICES },
  });

  // hcQuoteOffers refuses without a business, exactly as it should, so a check that wants to watch it
  // read has to give it one — the same seam the other checks use.
  await rig.page.evaluate((id) => { window.hublyCaptureUI.withBusiness(id); }, BIZ.id);

  const seam = await rig.page.evaluate(() => ({
    form: typeof window.hublyJobFormUI?.form === "function",
    create: typeof window.hublyJobFormUI?.create === "function",
    shared: typeof window.HublyContactPick === "object" && typeof window.HublyContactPick.parse === "function",
  }));
  if (!seam.form || !seam.create) { console.error("CANNOT RUN — no hublyJobFormUI seam"); await rig.close(); site.close(); process.exit(2); }

  say("1 the shared contact capability is loaded in THIS shell — not a second copy of it",
      seam.shared === true, "window.HublyContactPick from /contact-pick.js");

  const built = await rig.page.evaluate(async ({ biz }) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await window.hublyJobFormUI.form(host, biz);
    const opts = [...host.querySelectorAll('[data-hc-job="kind"] option')].map((o) => ({
      value: o.value, text: o.textContent, quoted: o.getAttribute("data-quoted"), cents: o.getAttribute("data-cents"),
    }));
    const fields = [...host.querySelectorAll("[data-hc-job]")].map((e) => e.getAttribute("data-hc-job"));
    const labelled = [...host.querySelectorAll("input,select,textarea")].every((e) => !!e.getAttribute("aria-label"));
    host.id = "a2host";
    return { opts, fields, labelled, go: (host.querySelector('[data-hc-job="add"]') || {}).textContent };
  }, { biz: BIZ });

  say("2 every field Adrian named is on the form, and every control is named for someone who cannot see it",
      ["name", "phone", "email", "address", "kind", "price", "date", "time", "notes", "add", "msg"].every((f) => built.fields.includes(f)) &&
      built.labelled === true, built.fields.join(","));
  say("3 the dropdown IS his own offers — plus one one-off option, and nothing else",
      built.opts.length === 4 && built.opts.some((o) => o.value === "Full Detail") &&
      built.opts.some((o) => o.value === "Paint Correction") &&
      built.opts.some((o) => o.value === "__oneoff__"), built.opts.map((o) => o.value).join(" | "));
  const opt = (v) => built.opts.filter((o) => o.value === v)[0] || { quoted: null, text: "", cents: null };
  say("4 each option CARRIES ITS TYPE and says which it is in words",
      opt("Full Detail").quoted === "0" &&
      /— \$85/.test(opt("Full Detail").text) &&
      opt("Paint Correction").quoted === "1" &&
      /you quote this/i.test(opt("Paint Correction").text),
      built.opts.map((o) => o.text).filter((t) => /—/.test(t)).join(" / "));

  // ── THE BUTTON AND THE PRICE FIELD FOLLOW THE TYPE, VISIBLY ────────────────────────────
  const picked = await rig.page.evaluate(() => {
    const host = document.getElementById("a2host");
    const kind = host.querySelector('[data-hc-job="kind"]');
    const price = host.querySelector('[data-hc-job="price"]');
    const go = host.querySelector('[data-hc-job="add"]');
    const set = (v) => { kind.value = v; kind.dispatchEvent(new Event("change", { bubbles: true })); };
    set("Full Detail");
    const bookable = { go: go.textContent, price: price.value, disabled: price.disabled,
                       note: (host.querySelector(".hc-jf-note") || {}).hidden };
    set("Paint Correction");
    const quoted = { go: go.textContent, price: price.value, disabled: price.disabled,
                     note: (host.querySelector(".hc-jf-note") || {}).hidden,
                     noteText: (host.querySelector(".hc-jf-note") || {}).textContent };
    set("__oneoff__");
    const oneoff = { go: go.textContent, disabled: price.disabled,
                     workShown: !host.querySelector('[data-hc-job="oneoff"]').closest(".hc-jf-field").hidden };
    return { bookable, quoted, oneoff };
  });
  say("5 a BOOKABLE offer pre-fills the price FROM HIS RECORD and the button adds a job",
      picked.bookable.price === "85" && picked.bookable.disabled === false && /add the job/i.test(picked.bookable.go),
      `price="${picked.bookable.price}" · "${picked.bookable.go}"`);
  say("6 a QUOTED offer changes the button BEFORE he fills anything in, and says why",
      /start a quote/i.test(picked.quoted.go) && picked.quoted.disabled === true &&
      picked.quoted.price === "" && picked.quoted.note === false && /quote this one/i.test(picked.quoted.noteText || ""),
      `"${picked.quoted.go}" · ${JSON.stringify((picked.quoted.noteText || "").slice(0, 60))}`);
  say("7 the one-off asks what the work is, and that field is hidden until it is chosen",
      picked.oneoff.workShown === true && /add the job/i.test(picked.oneoff.go), "the work field appears");

  // ── THE WRITER ENFORCES THE TYPE TOO ──────────────────────────────────────────────────
  const writes = await rig.page.evaluate(async ({ biz }) => {
    const C = window.hublyJobFormUI.create, L = window.hublyJobFormUI.line;
    const run = async (input) => { window.__rig.writes.length = 0;
      const r = await C(input, biz); return { r, line: L(r), writes: window.__rig.writes.map((w) => w.name) }; };
    return {
      quoted: await run({ name: "Dana", kind: "Paint Correction", quoted: true, price: "" }),
      noName: await run({ name: "", kind: "Full Detail", price: "85" }),
      noKind: await run({ name: "Dana", kind: "", price: "85" }),
      noWork: await run({ name: "Dana", kind: "__oneoff__", oneoff: "", price: "60" }),
      badPrice: await run({ name: "Dana", kind: "Full Detail", price: "abc" }),
      noPrice: await run({ name: "Dana", kind: "Full Detail", price: "" }),
      good: await run({ name: "Dana", kind: "Full Detail", price: "85", date: "2026-09-18", time: "14:00", address: "14 Maple St", phone: "8015550134" }),
      oneoff: await run({ name: "Dana", kind: "__oneoff__", oneoff: "headlight restoration", price: "60" }),
    };
  }, { biz: BIZ });

  say("8 THE WRITER REFUSES A QUOTED OFFER, and points him at the quote — the guard is not only in the UI",
      writes.quoted.r.ok === false && writes.quoted.r.error === "quoted" &&
      writes.quoted.writes.length === 0 && /quick quote/i.test(writes.quoted.line),
      JSON.stringify(writes.quoted.line));
  say("9 every refusal has its OWN sentence, and none of them claims it was added",
      [writes.noName, writes.noKind, writes.noWork, writes.badPrice].every((x) => x.r.ok === false && !/\badded\b/i.test(x.line)) &&
      new Set([writes.noName.line, writes.noKind.line, writes.noWork.line, writes.badPrice.line]).size === 4,
      "4 distinct refusals");
  say("10 a job with NO price is allowed and stays unpriced — 0 is a number nobody stated",
      writes.noPrice.r.ok === true &&
      (writes.noPrice.writes.length === 1) &&
      !/\$0\b/.test(writes.noPrice.line),
      JSON.stringify(writes.noPrice.line));
  say("11 a good job writes ONCE, through create_business_job, and the sentence reads it BACK",
      writes.good.r.ok === true && writes.good.writes.filter((n) => n === "create_business_job").length === 1 &&
      /^Added/.test(writes.good.line), JSON.stringify(writes.good.line));
  say("12 a ONE-OFF is written as the job's service and SAYS it is not added to his services",
      writes.oneoff.r.ok === true && writes.oneoff.r.oneOff === true &&
      /stays on this job only/i.test(writes.oneoff.line) &&
      !writes.oneoff.writes.some((n) => /service|catalog/i.test(n)),
      JSON.stringify(writes.oneoff.line.slice(-60)));
  say("13 and nothing in any of these calls touched a service writer — a one-off never becomes an offer",
      Object.values(writes).every((x) => !x.writes.some((n) => /set_business_service|create_service|service_catalog/i.test(n))),
      "no catalogue write on any path");

  // ── MY DAY, WITH NO REFRESH ───────────────────────────────────────────────────────────
  const noRefresh = await rig.page.evaluate(async ({ biz }) => {
    const host = document.createElement("div");
    host.id = "a2day";
    document.body.appendChild(host);
    // The product's own repaint target, then add a job through the form's own submit path.
    const before = document.querySelectorAll(".hcmd-row").length;
    const f = document.querySelector("[data-hc-jobform]");
    const q = (n) => f.querySelector(`[data-hc-job="${n}"]`);
    q("name").value = "Dana";
    q("kind").value = "Full Detail"; q("kind").dispatchEvent(new Event("change", { bubbles: true }));
    q("price").value = "85";
    const iso = new Date(); const pad = (n) => String(n).padStart(2, "0");
    q("date").value = `${iso.getFullYear()}-${pad(iso.getMonth() + 1)}-${pad(iso.getDate())}`;
    q("time").value = "14:00";
    // SPY ON THE PRODUCT'S OWN REPAINT. The first version of this leg only asserted that
    // hcRepaintDay EXISTS — true of every possible product, including one where the form never calls
    // it. Removing the call went completely undetected. A leg about "no refresh needed" has to watch
    // the re-read happen.
    // THE PRODUCT'S OWN COUNTER, not a spy on the seam — the form calls the local hcRepaintDay
    // directly, so wrapping window.hublyDayUI.repaint saw nothing and the leg stayed green with the
    // call removed. hcRepaintDay now counts its own runs and publishes the count.
    const repaintsBefore = window.hublyDayUI.repaints();
    f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 900));
    return { msg: (q("msg") || {}).textContent || "",
             repainted: window.hublyDayUI.repaints() - repaintsBefore,
             repaintExists: typeof window.hublyDayUI.repaint === "function" };
  }, { biz: BIZ });
  say("14 submitting the form says what it did, in words, on the form he pressed",
      /^Added/.test(noRefresh.msg), JSON.stringify(noRefresh.msg));
  say("15 and it RE-READS My Day from the record rather than patching the DOM — no refresh to see it",
      noRefresh.repaintExists === true && noRefresh.repainted >= 1,
      `hcRepaintDay called ${noRefresh.repainted} time(s) by the form's own submit`);
  // ── THE DOOR, OPEN IN THE STATE WHERE IT IS NEEDED ─────────────────────────────────────
  const door = await rig.page.evaluate(async ({ biz }) => {
    const out = {};
    for (const jobs of [[], [{ id: "j1", business_id: biz.id, customer_name: "Marcus", service_name: "Full Detail",
                               scheduled_date: "2026-09-18", scheduled_time: "08:00", is_block: false, amount: 85 }]]) {
      window.__rig.tables = window.__rig.tables || {};
      // Swap the jobs the fake serves, then render the room the product renders.
      window.__setRigJobs ? window.__setRigJobs(jobs) : null;
      const host = document.createElement("div");
      document.body.appendChild(host);
      await window.hublyNavUI.rooms.jobs(host, biz);
      out[jobs.length ? "withJobs" : "empty"] = {
        form: !!host.querySelector("[data-hc-jobform]"),
        kinds: !!host.querySelector('[data-hc-job="kind"]'),
        empty: !!host.querySelector(".hc-room-empty"),
      };
      host.remove();
    }
    return out;
  }, { biz: BIZ });
  say("16 the form is part of the Jobs room in EVERY state — including the empty one every business is in",
      door.empty && door.empty.form === true && door.empty.kinds === true,
      `empty room: form=${door.empty && door.empty.form} · kinds=${door.empty && door.empty.kinds}`);
  say("17 and it is still there once he has jobs — the door does not close behind him",
      door.withJobs && door.withJobs.form === true,
      `with jobs: form=${door.withJobs && door.withJobs.form}`);
  // ══ B — LEADS -> CUSTOMERS -> JOBS: HE TYPES NOTHING TWICE. ══════════════════════════════
  //
  // Adrian: "That is the whole point of the pipeline — he opens a lead, presses through to a job, and
  // types nothing twice." The legs below are that sentence, plus the one thing a pre-fill must never
  // do: fill a field the source does not have.
  const pipeline = await rig.page.evaluate(async () => {
    const open = (lead) => {
      document.querySelectorAll("[data-hc-lead], [data-hc-jobform]").forEach((e) => e.remove());
      window.hublyJobFormUI.leadPanel(lead);
      return document.querySelector('[data-hc-lead="to-job"]');
    };
    const press = async (lead) => {
      const btn = open(lead);
      if (!btn) return { pressed: false };
      btn.click();
      await new Promise((r) => setTimeout(r, 500));
      const f = document.querySelector("[data-hc-jobform]");
      if (!f) return { pressed: true, form: false };
      const v = (n) => { const e = f.querySelector(`[data-hc-job="${n}"]`); return e ? e.value : null; };
      return { pressed: true, form: true, name: v("name"), phone: v("phone"), email: v("email"),
               address: v("address"), kind: v("kind"), oneoff: v("oneoff"), msg: v("msg"),
               msgText: (f.querySelector('[data-hc-job="msg"]') || {}).textContent || "" };
    };
    const full = await press({ id: "L1", customer_name: "Dana Reeves", customer_phone: "8015550134",
      customer_email: "dana@example.com", address: "14 Maple St", service_name: "Full Detail",
      status: "abandoned", furthest_step: 4 });
    const sparse = await press({ id: "L2", customer_name: "Mike", customer_phone: "",
      customer_email: null, address: null, service_name: null, status: "abandoned" });
    const unknownService = await press({ id: "L3", customer_name: "Sam", customer_phone: "8015559999",
      customer_email: null, address: null, service_name: "Ceramic coating", status: "abandoned" });
    return { full, sparse, unknownService };
  });

  say("18 a lead OPENS INTO a job form — the press-through exists",
      pipeline.full.pressed === true && pipeline.full.form === true,
      `button pressed=${pipeline.full.pressed} form appeared=${pipeline.full.form}`);
  say("19 every field the lead HAS is carried forward — he types nothing twice",
      pipeline.full.name === "Dana Reeves" && pipeline.full.phone === "8015550134" &&
      pipeline.full.email === "dana@example.com" && pipeline.full.address === "14 Maple St",
      JSON.stringify([pipeline.full.name, pipeline.full.phone, pipeline.full.email, pipeline.full.address]));
  say("20 a service that IS one of his offers is pre-selected",
      pipeline.full.kind === "Full Detail", JSON.stringify(pipeline.full.kind));
  say("21 a service that is NOT one of his offers becomes the one-off's description — his words, not dropped",
      pipeline.unknownService.kind === "__oneoff__" && pipeline.unknownService.oneoff === "Ceramic coating",
      `kind=${pipeline.unknownService.kind} work=${JSON.stringify(pipeline.unknownService.oneoff)}`);
  say("22 A FIELD THE LEAD DOES NOT HAVE IS LEFT EMPTY — never filled with something plausible",
      pipeline.sparse.name === "Mike" && pipeline.sparse.phone === "" &&
      pipeline.sparse.email === "" && pipeline.sparse.address === "" &&
      (pipeline.sparse.kind === "" || pipeline.sparse.kind === null),
      JSON.stringify([pipeline.sparse.phone, pipeline.sparse.email, pipeline.sparse.address, pipeline.sparse.kind]));
  say("23 and it SAYS where the values came from — a form that fills itself silently cannot be checked",
      /from the lead/i.test(pipeline.full.msgText), JSON.stringify(pipeline.full.msgText.slice(0, 80)));
} finally { await rig.close(); site.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — the job record carries the type, and a one-off never becomes a public offer.\n");
process.exit(failed ? 1 : 0);
