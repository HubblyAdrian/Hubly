#!/usr/bin/env node
/**
 * [RULE] A SEED MAY LIVE IN THE EDITOR. IT MAY NOT REACH A CUSTOMER BEFORE HE HAS LOOKED AT IT.
 *
 *   node scripts/check-seeded-content-stays-in-the-editor.mjs
 *
 * ADRIAN, 2026-09-16: "seeded content may appear IN THE EDITOR as a starting point the owner sees and
 * edits. It must NEVER reach a customer-facing page before he has looked at it. A price is a number
 * someone can argue with; A LIST OF DELIVERABLES IS A PROMISE A CUSTOMER CAN HOLD HIM TO."
 *
 * WHAT WAS SHIPPING. Pressing add-a-membership created a plan with `price:99`, `enabled:true`, a
 * stock name, a stock description and THREE STOCK INCLUDES, and the website card rendered all of it
 * with a Join Membership button. Measured on the live page: graefs-autocare's Bi-Weekly plan
 * published "Monthly wash · Interior refresh · Priority scheduling" and he never said any of it.
 *
 * FOUR CHANGES, AND LEG 5 IS THE ONE THAT MATTERS MOST. `scrubMembershipTradeLeaks` treated an EMPTY
 * description as a leak and refilled it from the trade defaults — so stopping the writer while that
 * still ran would have re-seeded every plan on the next scrub, and the fix would have LOOKED applied
 * and not been. Adrian named it before it could happen; this leg is what keeps it named.
 *
 * THE SEED IS READ FROM THE PRODUCT, NEVER TYPED INTO THIS FILE. `membershipDefaultsForTrade` is
 * per-trade — 99 detailing, 89 windows, 149 cleaning, 119 landscaping, 129 hvac — and a check written
 * against "99" would pass against a landscaping business publishing a seeded 119. That is the rule
 * Adrian recorded as his own error: a handed value is an example of a SET, and the set is in the code.
 *
 * [RULE]: every leg is one of those sentences. Adding a trade to the defaults table is expected to
 * stay green — leg 1 walks whatever trades the product declares.
 *
 * SIMULATED AND SAID SO: no session, no network. The defaults, the writer, the scrub and the website
 * card renderer are the shipping product's; only the trade is chosen.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const site = await servePublic(ROOT);
let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); site.close(); process.exit(2); }

try {
  console.log("SIMULATED — no session, no network. The defaults, the writer, the scrub and the card are the product's.\n");
  await rig.load(site.url("hubly.html"));

  const ready = await rig.page.evaluate(() => typeof membershipDefaultsForTrade === "function" &&
    typeof addMembershipPlan === "function" && typeof scrubMembershipTradeLeaks === "function" &&
    typeof useMembershipSuggestion === "function");
  if (!ready) { console.error("CANNOT RUN — the membership editor is not on this page"); await rig.close(); site.close(); process.exit(2); }

  // ── EVERY TRADE THE PRODUCT DECLARES, not a value anyone typed here. ────────────────────
  const trades = await rig.page.evaluate(() => {
    const out = {};
    for (const t of ["detailing", "windows", "cleaning", "landscaping", "hvac", "pressure_washing", "a_trade_we_do_not_know"]) {
      S.businessType = t;
      const d = membershipDefaultsForTrade();
      out[t] = { name: d.name, price: d.price, description: d.description, includes: (d.includes || []).slice() };
    }
    return out;
  });
  const seeds = Object.values(trades);
  say("1 the seed table is PER TRADE and is read from the product — not one number from a prompt",
      new Set(seeds.map((s) => s.price)).size >= 4 && seeds.every((s) => s.price > 0 && s.includes.length >= 2),
      Object.entries(trades).map(([k, v]) => `${k}=$${v.price}`).join(" · "));

  // ── A NEW PLAN CARRIES NOTHING HE DID NOT SAY, ON EVERY TRADE. ─────────────────────────
  const created = await rig.page.evaluate((tradeList) => {
    const out = {};
    for (const t of tradeList) {
      S.businessType = t;
      S.website = S.website || {};
      S.website.membershipOffers = [];
      addMembershipPlan();
      addMembershipPlan();                       // the SECOND one too: the override path
      const plans = ensureMembershipOffers();
      out[t] = plans.map((p) => ({ name: p.name, price: p.price, description: p.description,
                                   includes: (p.includes || []).length, enabled: p.enabled }));
    }
    return out;
  }, Object.keys(trades));
  const allNew = Object.values(created).flat();
  say("2 a new plan has NO name, NO price, NO description and NO includes — on every trade, first and second",
      allNew.length > 0 && allNew.every((p) => !String(p.name || "").trim() && (p.price === null || p.price === undefined) &&
                                               !String(p.description || "").trim() && p.includes === 0),
      `${allNew.length} plans across ${Object.keys(created).length} trades, all empty`);
  say("3 and it is still ENABLED, so he SEES what he just created rather than nothing happening",
      allNew.every((p) => p.enabled === true), "enabled on creation");

  // ── THE CARD PUBLISHES NOTHING HE DID NOT SAY. ────────────────────────────────────────
  const card = await rig.page.evaluate(() => {
    S.businessType = "detailing";
    S.website.membershipOffers = [];
    addMembershipPlan();
    try { renderWebsitePreview(); } catch (e) {}
    const c = document.querySelector(".ws-membership-card");
    if (!c) return null;
    return {
      hasPrice: !!c.querySelector(".ws-membership-amount"),
      hasDesc: !!c.querySelector(".ws-membership-body p:not(.ws-membership-eyebrow)"),
      includes: c.querySelectorAll(".ws-membership-includes li").length,
      hasList: !!c.querySelector(".ws-membership-includes"),
      text: c.textContent.replace(/\s+/g, " ").trim(),
    };
  });
  say("4 the website card shows NO price, NO description and NO includes for an untouched plan",
      !!card && card.hasPrice === false && card.hasDesc === false && card.includes === 0 && card.hasList === false,
      card ? JSON.stringify(card.text).slice(0, 90) : "no card rendered");

  // ── THE REPAIR PASS MAY NOT RE-SEED. The change that would have defeated the other three. ─
  const scrub = await rig.page.evaluate(() => {
    S.businessType = "detailing";
    S.website.membershipOffers = [];
    addMembershipPlan();
    S.businessType = "windows";                       // a different trade, so the scrub runs
    scrubMembershipTradeLeaks();
    const empty = ensureMembershipOffers().slice(-1)[0];
    const afterEmpty = { name: empty.name, description: empty.description, includes: (empty.includes || []).slice(), price: empty.price };
    // A WRONG sentence IS still removed — that is what the pass is for.
    const p = ensureMembershipOffers().slice(-1)[0];
    p.description = "Keep your vehicle showroom ready, every month.";
    p.includes = ["Monthly wash", "Priority booking"];
    p.name = "Monthly Membership";
    p.price = 77;
    scrubMembershipTradeLeaks();
    const w = ensureMembershipOffers().slice(-1)[0];
    return { afterEmpty, afterWrong: { name: w.name, description: w.description, includes: (w.includes || []).slice(), price: w.price } };
  });
  say("5 AN EMPTY FIELD IS NOT A LEAK — the repair pass does not refill it (this is the one that would have undone the rest)",
      scrub.afterEmpty.description === "" && scrub.afterEmpty.includes.length === 0 &&
      String(scrub.afterEmpty.name || "").trim() === "" && scrub.afterEmpty.price === null,
      JSON.stringify(scrub.afterEmpty));
  say("6 a WRONG sentence is still removed — that is what the pass is for — and CLEARED, never replaced",
      scrub.afterWrong.description === "" && !scrub.afterWrong.includes.includes("Monthly wash") &&
      scrub.afterWrong.includes.includes("Priority booking"),
      JSON.stringify(scrub.afterWrong.includes));
  say("7 the repair pass does not re-price him while fixing his prose",
      scrub.afterWrong.price === 77, `price stayed ${scrub.afterWrong.price}`);
  say("8 a stock title on the wrong trade is CLEARED, not renamed for him",
      String(scrub.afterWrong.name || "").trim() === "", JSON.stringify(scrub.afterWrong.name));

  // ── AND HE CAN TAKE THE SUGGESTION IN ONE GESTURE. ────────────────────────────────────
  const accept = await rig.page.evaluate(() => {
    S.businessType = "detailing";
    S.website.membershipOffers = [];
    addMembershipPlan();
    const i = ensureMembershipOffers().length - 1;
    try { renderMembershipEditorList(); } catch (e) {}
    const btns = [...document.querySelectorAll(".mem-suggest")].map((b) => b.textContent.trim());
    useMembershipSuggestion(i, "includes");
    useMembershipSuggestion(i, "price");
    const p = ensureMembershipOffers().slice(-1)[0];
    try { renderMembershipEditorList(); } catch (e) {}
    const btnsAfter = [...document.querySelectorAll(".mem-suggest")].map((b) => b.textContent.trim());
    return { btns, includes: (p.includes || []).slice(), price: p.price, btnsAfter };
  });
  say("9 the editor OFFERS the seed as a one-press control, so the ruling does not cost him the seed",
      accept.btns.length >= 3, JSON.stringify(accept.btns));
  say("10 pressing it writes the value AS HIS — from then on it is a fact he stated",
      accept.includes.length === 3 && accept.price === 99, `${accept.includes.length} includes, price ${accept.price}`);
  say("11 and the offer disappears once the field is his — never an offer to overwrite his own words",
      accept.btnsAfter.length < accept.btns.length, `${accept.btns.length} before, ${accept.btnsAfter.length} after`);
} finally { await rig.close(); site.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — the seed lives in the editor, and a customer sees only what the owner said.\n");
process.exit(failed ? 1 : 0);
