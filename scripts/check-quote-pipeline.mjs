#!/usr/bin/env node
/**
 * [RULE] A QUOTE IS A LEAD WITH A PRICE ON IT: ONE RECORD, TWO VIEWS, AND ACCEPTING CARRIES FORWARD.
 *
 *   node scripts/check-quote-pipeline.mjs
 *
 * ADRIAN, 2026-09-16: "The Quotes tab contents — the list, through hcRoomShell/hcRoomRow with the
 * quote row spec, and the SAME RECORD visible from the chat and the tab. ACCEPTING a quote into a
 * booking or a job — an accepted one carries forward, it is never retyped. SENDING — permission
 * first: that is a message on his behalf to his customer, so the door hands it to him ready rather
 * than sending for him."
 *
 * ══ WHICH SEND I BUILT, AND WHY ═══════════════════════════════════════════════════════════════
 *
 * **The handoff.** `sms:` / `mailto:` prefilled with his own lines and his own arithmetic. It does
 * not send. Three reasons, and the first decides it:
 *   1. **It is his message to his customer.** Hubly dispatching it means a stranger receives a text
 *      from us about a price we did not set.
 *   2. **We have no consent for it.** The SMS consent we store is the CUSTOMER consenting to THE
 *      BUSINESS about a booking they started — not consent for us to message someone who has only
 *      been quoted. Using it that way is the "reporting a fact the system never captured" defect
 *      pointed at a person's phone.
 *   3. It works offline, in a driveway, on one bar, with no carrier setup.
 *
 * AND OPENING A COMPOSER IS NOT SENDING. `status='sent'` is set only when HE says it went — leg 12.
 * Marking it on the tap would be a checkmark for something nobody watched.
 *
 * ══ NEVER RETYPED IS A GUARANTEE ABOUT WHERE THE VALUES COME FROM ════════════════════════════
 *
 * `accept_quote` builds the job FROM THE QUOTE ROW in one statement. A client that read the quote and
 * posted a job object would have re-entered every field, and anything it dropped or rounded is a
 * difference between what he quoted and what he is about to do. It is also atomic: two calls could
 * create the job and fail to mark the quote, leaving a quote he chases and a job he already has.
 *
 * [RULE]: the legs are Adrian's sentences. None asserts a count of quotes or any markup beyond the
 * controls' own identity, which is what is being asserted.
 *
 * SIMULATED AND SAID SO: no session, no network, and NO WRITE. The row spec, the panel, the message
 * and the sentences are the shipping product's. The SERVER half — accept_quote's carry-forward and
 * its refusals — was verified once against the live database on the TEST business and its rows
 * deleted (docs/THE_QUOTE.md); it is not re-run here, because a check that writes to a real table on
 * every run is how a corpus gets contaminated.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "file://" + join(ROOT, "public/platform-home.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture", name: "Graef's Autocare" };
const QUOTES = [
  { id: "q1", customer_name: "Dana", customer_phone: "8015550134", customer_email: null,
    lines: [{ name: "Full Detail", qty: 1, unit_cents: 8500, source: "offer:Full Detail" },
            { name: "Headlight restoration", qty: 1, unit_cents: 6000, source: "said" }],
    subtotal_cents: 14500, discount_kind: "pct", discount_value: 10, discount_words: "10% off",
    discount_cents: 1450, total_cents: 13050, status: "draft", became: null, created_at: "2026-09-16T10:00:00Z", sent_at: null },
  { id: "q2", customer_name: "Marcus", customer_phone: null, customer_email: "m@example.com",
    lines: [{ name: "Premium Detail", qty: 1, unit_cents: 13000, source: "offer:Premium Detail" }],
    subtotal_cents: 13000, discount_kind: null, discount_value: null, discount_words: null,
    discount_cents: 0, total_cents: 13000, status: "sent", became: null, created_at: "2026-09-15T10:00:00Z", sent_at: "2026-09-15T11:00:00Z" },
  { id: "q3", customer_name: "Nobody reachable", customer_phone: null, customer_email: null,
    lines: [{ name: "Clay & Seal", qty: 1, unit_cents: 7500, source: "offer:Clay & Seal" }],
    subtotal_cents: 7500, discount_kind: null, discount_value: null, discount_words: null,
    discount_cents: 0, total_cents: 7500, status: "accepted", became: "job", created_at: "2026-09-14T10:00:00Z", sent_at: null },
];

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  console.log("SIMULATED — no session, no network, NO WRITE. The spec, the panel and the sentences are the product's.\n");
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "sim@example.com", displayName: "Adrian",
    tables: { jobs: [], tasks: [] }, quotes: QUOTES,
  });
  await rig.page.evaluate((id) => { window.hublyCaptureUI.withBusiness(id); }, BIZ.id);

  const seam = await rig.page.evaluate(() => ({
    view: !!(window.hublyListUI && window.hublyListUI.views && window.hublyListUI.views.quotes),
    room: !!(window.hublyNavUI && window.hublyNavUI.rooms && window.hublyNavUI.rooms.quotes),
    place: !!(window.hublyNavUI && window.hublyNavUI.surfaces && window.hublyNavUI.surfaces.quotes),
    panel: typeof window.hublyQuoteUI?.panel === "function",
    accept: typeof window.hublyQuoteUI?.accept === "function",
  }));
  if (!seam.view || !seam.panel) { console.error("CANNOT RUN — the quotes view or panel is not on this page"); await rig.close(); process.exit(2); }

  say("1 quotes is a kind in the SAME list engine as every other — one spec, one renderer",
      seam.view && seam.room && seam.place, `view=${seam.view} room=${seam.room} place=${seam.place}`);
  const railDefault = await rig.page.evaluate(() => Object.keys(window.hublyNavUI.railDefault || {}));
  say("2 and it is EARNABLE, not shown by default — progressive navigation, unchanged",
      !railDefault.includes("quotes"), `default rail: ${railDefault.join(",")}`);

  const rendered = await rig.page.evaluate(async ({ biz }) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await window.hublyNavUI.rooms.quotes(host, biz);
    const rows = [...host.querySelectorAll(".hc-row")].map((r) => ({
      t: (r.querySelector(".hc-row-t") || {}).textContent || "",
      s: (r.querySelector(".hc-row-s") || {}).textContent || "",
      tail: (r.querySelector(".hc-row-tail") || {}).textContent || "",
    }));
    const count = (host.textContent.match(/\d+ quotes?/) || [""])[0];
    host.remove();
    return { rows, count };
  }, { biz: BIZ });
  say("3 every quote is a row, named for the person, with the money in the middle",
      rendered.rows.length === 3 && rendered.rows[0].t === "Dana" && /Full Detail \+ Headlight/.test(rendered.rows[0].s),
      JSON.stringify(rendered.rows[0]));
  say("4 a discounted row SHOWS the discount — a lower total with no reason is what he gets asked about",
      /\$130\.50 \(\$145 less \$14\.50\)/.test(rendered.rows[0].s), JSON.stringify(rendered.rows[0].s));
  say("5 the state is in the tail, in words, per kind — never the column value",
      rendered.rows.map((r) => r.tail).join("|") === "Not sent yet|Waiting on them|They said yes",
      rendered.rows.map((r) => r.tail).join(" · "));
  say("6 the count is his own rows in his own words", rendered.count === "3 quotes", JSON.stringify(rendered.count));

  // ── THE PANEL: the two things he can do, and only the ones that exist for THIS quote ────
  const panels = await rig.page.evaluate(() => {
    const open = (q) => {
      document.querySelectorAll("[data-hc-quote]").forEach((e) => e.remove());
      window.hublyQuoteUI.panel(q);
      const btn = (k) => document.querySelector(`[data-hc-quote="${k}"]`);
      return { sms: !!btn("sms"), email: !!btn("email"), accept: !!btn("accept"),
               smsHref: btn("sms") ? btn("sms").getAttribute("href") : null,
               mailHref: btn("email") ? btn("email").getAttribute("href") : null };
    };
    const qs = window.__rig.quotes;
    return { draft: open(qs[0]), sent: open(qs[1]), accepted: open(qs[2]),
             message: window.hublyQuoteUI.message(qs[0]) };
  });
  say("7 a quote with a phone offers TEXT, one with an email offers EMAIL — every way that exists, none that do not",
      panels.draft.sms === true && panels.draft.email === false &&
      panels.sent.sms === false && panels.sent.email === true,
      `phone-only: sms=${panels.draft.sms} email=${panels.draft.email} · email-only: sms=${panels.sent.sms} email=${panels.sent.email}`);
  say("8 a quote with neither offers no send control at all",
      panels.accepted.sms === false && panels.accepted.email === false, "no unusable controls");
  say("9 ACCEPT is offered while it can be accepted, and is GONE once it is a job",
      panels.draft.accept === true && panels.sent.accept === true && panels.accepted.accept === false,
      `draft=${panels.draft.accept} sent=${panels.sent.accept} accepted=${panels.accepted.accept}`);
  say("10 the handoff PREFILLS his own lines and his own arithmetic — it is a composer, not a send",
      /^sms:8015550134\?&body=/.test(panels.draft.smsHref || "") &&
      /Full Detail/.test(panels.message) && /10% off/.test(panels.message) &&
      /Total \$130\.50/.test(panels.message),
      JSON.stringify(panels.message.replace(/\n/g, " | ")));
  say("11 and it invents NOTHING — no greeting we wrote for him, no validity period, no signature",
      !/valid for|expires|30 days|Hi |Hello |Thanks|Regards|Best,/i.test(panels.message),
      "his lines and his numbers only");

  // ── OPENING A COMPOSER IS NOT SENDING ─────────────────────────────────────────────────
  const afterTap = await rig.page.evaluate(async () => {
    document.querySelectorAll("[data-hc-quote]").forEach((e) => e.remove());
    const q = window.__rig.quotes[0];
    window.hublyQuoteUI.panel(q);
    window.__rig.writes.length = 0;
    document.querySelector('[data-hc-quote="sms"]').click();
    await new Promise((r) => setTimeout(r, 200));
    const asked = !!document.querySelector('[data-hc-quote="sent-yes"]');
    const wroteOnTap = window.__rig.writes.filter((w) => w.name === "set_quote_status").length;
    // A MISSING BUTTON IS A FAILURE, NOT A CRASH. The first version called .click() unguarded, so a
    // break that sent on the tap (and therefore never asked) threw inside the page and took the whole
    // check down with an unhandled rejection — no FAIL line, no leg red, and the break read as
    // "nothing was caught". A probe that dies cannot report.
    const yesBtn = document.querySelector('[data-hc-quote="sent-yes"]');
    if (yesBtn) yesBtn.click();
    await new Promise((r) => setTimeout(r, 250));
    const wroteOnYes = window.__rig.writes.filter((w) => w.name === "set_quote_status").length;
    return { asked, wroteOnTap, wroteOnYes, status: q.status };
  });
  say("12 tapping the composer writes NOTHING — it asks whether it went, and only \"yes\" marks it sent",
      afterTap.asked === true && afterTap.wroteOnTap === 0 && afterTap.wroteOnYes === 1,
      `on tap: ${afterTap.wroteOnTap} writes · after "yes": ${afterTap.wroteOnYes}`);

  // ── THE SENTENCES. Pure, so every outcome is asserted without writing anything. ────────
  const lines = await rig.page.evaluate(() => {
    const L = window.hublyQuoteUI.acceptLine;
    return {
      ok: L({ ok: true, jobId: "j1", service: "Full Detail + Headlight restoration", cents: 13050, name: "Dana" }),
      already: L({ ok: false, error: "already_accepted" }),
      declined: L({ ok: false, error: "declined" }),
      noLines: L({ ok: false, error: "no_lines" }),
      onlyJob: L({ ok: false, error: "only_job" }),
      signedOut: L({ ok: false, error: "not_signed_in" }),
      nul: L(null),
    };
  });
  say("13 accepting says what it made, with the money he quoted",
      /that.s a job now/i.test(lines.ok) && /Dana/.test(lines.ok) && /\$130\.50/.test(lines.ok),
      JSON.stringify(lines.ok.slice(0, 90)));
  say("14 and it SAYS it put no day on it, because he has not told us one",
      /haven.t put a day on it/i.test(lines.ok), "no invented date, and it says so");
  say("15 a booking is NOT built and says so rather than making a job and calling it one",
      /isn.t built yet/i.test(lines.onlyJob) && /not going to pretend/i.test(lines.onlyJob),
      JSON.stringify(lines.onlyJob));
  say("16 every failure has its own sentence and none claims something was created",
      [lines.already, lines.declined, lines.noLines, lines.onlyJob, lines.signedOut, lines.nul]
        .every((l) => l && !/that.s a job now/i.test(l)) &&
      new Set([lines.already, lines.declined, lines.noLines, lines.onlyJob, lines.signedOut, lines.nul]).size === 6,
      "6 distinct refusals");
  // ── ONE RECORD, TWO VIEWS — asserted across the two SHELLS, from source. ───────────────
  //
  // The two surfaces live in two documents, so no single browser session holds both. What makes
  // "one record" structural is that there is ONE READER and both call it — which is a fact about the
  // source, and is where this leg looks.
  const { readFileSync } = await import("node:fs");
  const shells = {
    "platform-home.html (the chat)": readFileSync(join(ROOT, "public/platform-home.html"), "utf8"),
    "hubly.html (the tab)": readFileSync(join(ROOT, "public/hubly.html"), "utf8"),
  };
  const readers = Object.entries(shells).map(([k, v]) => [k, (v.match(/rpc\('get_business_quotes'/g) || []).length]);
  say("17 BOTH shells read the quotes through the SAME RPC — the tab and the chat cannot disagree",
      readers.every(([, n]) => n >= 1), readers.map(([k, n]) => `${k}: ${n}`).join(" · "));
  const tabUsesOwnStore = /sq-record-list/.test(shells["hubly.html (the tab)"]) &&
    /get_business_quotes/.test(shells["hubly.html (the tab)"]);
  say("18 the tab renders the RECORD, so removing the old 177KB leaves the rail row with contents",
      tabUsesOwnStore, "#sq-record-list is fed by get_business_quotes");
} finally { await rig.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — one record, two views; accepting carries it forward; sending is handed to him.\n");
process.exit(failed ? 1 : 0);
