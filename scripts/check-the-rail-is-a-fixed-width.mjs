#!/usr/bin/env node
/**
 * [RULE] THE SHELL'S COLUMN WIDTHS ARE DECLARATIONS, NOT FUNCTIONS OF THE OWNER'S EMAIL.
 *
 *   node scripts/check-the-rail-is-a-fixed-width.mjs
 *
 * ══ WHAT HAPPENED ═══════════════════════════════════════════════════════════════════════════
 *
 * `.hc-rail` declared `flex:0 0 180px` and rendered **389px** on the live app. A flex item
 * defaults to `min-width:auto` — it may not shrink below its CONTENT's min-content width — and
 * the widest unbreakable thing in the rail is the owner's email address, one token with no
 * break opportunity. The rail's width was therefore a function of how long that address is, and
 * the extra 209px came straight off the website workspace (941px instead of 1150).
 *
 * ══ WHY THIS IS MEASURED IN A BROWSER AND NOT GREPPED ═══════════════════════════════════════
 *
 * A grep can confirm `min-width:0` is present in the file. It cannot confirm the rail is 180px:
 * that is the product of a cascade, the flex algorithm and the actual content, and only a layout
 * engine knows it. So every leg here renders the real shell and reads getBoundingClientRect.
 *
 * And the decisive move is rendering it TWICE — once with a long email, once with a short one.
 * A single measurement would pass on a rail that happens to be the right size for one address;
 * only the COMPARISON distinguishes "180 because we said so" from "180 because this particular
 * owner has a short email". That is the whole leg.
 *
 * ══ WHY THE WORKSPACE WIDTH HAS NO LEG OF ITS OWN ═══════════════════════════════════════════
 *
 * The workspace is the surface the regression actually hurt, so the instinct is to assert its
 * width directly. It gets no leg because it CANNOT be broken alone: it is `flex:1 1 auto` and
 * takes whatever the rail and the chat panel leave, so every break that moves it moves one of
 * those two first, and the leg would be COMPOUND every time — proving nothing about itself
 * (L98). Legs 1 and 2 pin the two columns that consume width; the workspace figure is printed
 * on every run as the consequence, and checked for invariance inside leg 1 rather than pinned
 * to a number that a legitimate chat-width change would turn red.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { installOwnerFake, fakeIntact } from "./lib/owner-rig.mjs";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Fixture", hasPage: true, url: "https://hubly-classic-fixture.myhubly.app" };
const LONG = "adriansmithee+evergreen@gmail.com";   // the address on the live account
const SHORT = "a@b.co";

/**
 * Render the claimed shell in website mode for one account email and measure the columns.
 *
 * THE EMAIL IS SUPPLIED THROUGH THE AUTH SHIM, NOT TYPED INTO THE CHIP. An earlier version of
 * this check set `.hc-chip-nm` textContent by hand and measured 50px for both addresses — the
 * chip is rebuilt from `hcIdentity` by `hcReflectAuthState`, which is registered as a live
 * redraw, so the hand-written text was overwritten before the measurement. Driving it through
 * `getUser()` means the product's own code path puts the address in the chip, and `chipText`
 * below is asserted to actually contain it so this can never silently go hollow again.
 */
async function measure(rig, srv, email) {
  await rig.load(srv.url("platform-home.html"));
  await rig.page.evaluate(installOwnerFake, { uid: "sim", email, displayName: email,
    places: [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }],
    tables: { jobs: [], tasks: [], customers: [], events: [], services: [] },
    edge: { "hubly-conversation": { ok: true, reply: "Saved.", capability_results: [] } } });
  const bad = await rig.page.evaluate(fakeIntact);
  if (bad && !/never took a client/.test(bad)) throw new Error(bad);
  return await rig.page.evaluate(async ({ biz }) => {
    await window.hublyArrivalUI.simulate(biz, true, []);
    document.querySelector(".hc-app").classList.add("hc-claimed");
    window.hublyNavUI.openWorkspace("website");
    await new Promise((r) => setTimeout(r, 1000));
    const q = (s) => document.querySelector(s);
    const W = (n) => (n ? Math.round(n.getBoundingClientRect().width) : null);
    const nm = q(".hc-rail-acct .hc-chip-nm");
    return {
      windowW: window.innerWidth,
      rail: W(q(".hc-rail")),
      chat: W(q(".hc-app-left")),
      workspace: W(q("#hcCanvasFrameWrap")),
      chipText: (q(".hc-rail-acct #navSignin") || {}).textContent || "",
      nameW: W(nm),
      // scrollWidth > clientWidth is how you tell "ellipsis engaged" from "fits".
      nameContentW: nm ? nm.scrollWidth : null,
      // THE CAPACITY to truncate, which is what leg 3 asserts — see the note there.
      nameTrunc: nm ? (function (cs) {
        // `display` is NOT pinned to a value here: the name is a flex item, so whatever the rule
        // says, the computed value is blockified to `block`. What matters is only that it is not
        // `none` — which is exactly the shortcut leg 3's break takes.
        return cs.overflow + "|" + cs.textOverflow + "|" + cs.whiteSpace +
               (cs.display === "none" ? "|GONE" : "|shown");
      })(getComputedStyle(nm)) : null,
      docScrollW: document.documentElement.scrollWidth,
    };
  }, { biz: BIZ });
}

const srv = await servePublic(ROOT);
let rig, L = null, S = null;
try { rig = await openRig({ width: 1710, height: 900, quiet: true }); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }
try {
  L = await measure(rig, srv, LONG);
  S = await measure(rig, srv, SHORT);
} catch (e) {
  console.error("CANNOT RUN — " + String(e.message).split("\n")[0]);
  try { await rig.close(); } catch (_) {}
  srv.close(); process.exit(2);
}
await rig.close(); srv.close();

/* THE FIXTURE ANSWERS FOR ITSELF BEFORE ANY LEG READS IT. If the long address never reached the
 * chip, every leg below is measuring a shell with no long token in it and all three pass
 * vacuously — which is exactly what happened once already. */
if (!L.chipText.includes(LONG) || !S.chipText.includes(SHORT)) {
  console.error(`CANNOT RUN — the account chip does not hold the address under test ` +
                `(long run chip text: ${JSON.stringify(L.chipText)}). Every leg would pass vacuously.`);
  process.exit(2);
}

console.log(`  window ${L.windowW}`);
console.log(`  long  email (${LONG.length} chars) → rail ${L.rail}  chat ${L.chat}  workspace ${L.workspace}  name ${L.nameW} (content ${L.nameContentW})`);
console.log(`  short email (${SHORT.length} chars) → rail ${S.rail}  chat ${S.chat}  workspace ${S.workspace}  name ${S.nameW} (content ${S.nameContentW})\n`);

/* ── LEG 1 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "1 the rail is the same width for a long email and a short one",
  why: "restore min-width:auto on the rail, which is the state that shipped. The declared 180px " +
       "becomes a suggestion again, the owner's email address sets the rail's min-content, and " +
       "the width of the navigation becomes a function of how long that address is.",
  file: "public/platform-home.html",
  find: ".hc-rail{display:none;flex:0 0 180px;min-width:0;flex-direction:column;",
  with: ".hc-rail{display:none;flex:0 0 180px;min-width:auto;flex-direction:column;",
});
leg("RULE", "1 the rail is the same width for a long email and a short one",
  L.rail === S.rail && L.rail <= 200 && L.workspace === S.workspace,
  `rail ${L.rail}px (long) vs ${S.rail}px (short) — equal: ${L.rail === S.rail}, within the declared ` +
  `180+tolerance: ${L.rail <= 200}. Workspace ${L.workspace} vs ${S.workspace}. The COMPARISON is the ` +
  `leg: a single number would pass on a rail that is accidentally right for one address. Before the ` +
  `fix this pair measured 389 and 180, and the workspace 941 and 1150.`);

/* ── LEG 2 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "2 the chat panel holds its declared 380px in website mode, for either address",
  why: "let the chat column share the leftover width instead of declaring 380px. The rail stays " +
       "180 so leg 1 is untouched, but the chat panel and the canvas start negotiating and the " +
       "work surface stops being a known size.",
  file: "public/platform-home.html",
  find: '.hc-app.hc-claimed[data-mode="website"] .hc-app-left{flex:0 0 380px;min-width:0;',
  with: '.hc-app.hc-claimed[data-mode="website"] .hc-app-left{flex:1 1 auto;min-width:0;',
});
leg("RULE", "2 the chat panel holds its declared 380px in website mode, for either address",
  L.chat === 380 && S.chat === 380,
  `chat ${L.chat}px (long) / ${S.chat}px (short) against a declared 380. This was measured correct ` +
  `BEFORE any change — the Phase 0.5 brief expected it to be part of the defect and it was not — so ` +
  `the leg exists to keep that true rather than to record a fix.`);

/* ── LEG 3 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 the account name is present in the rail and able to truncate",
  why: "hide the name in the rail instead of truncating it. That is the cheap fix for this class " +
       "and it does hold the rail at 180 — legs 1 and 2 stay green — by removing the owner's " +
       "account control from the navigation, trading a layout bug for an unreadable chip.",
  file: "public/platform-home.html",
  find: ".hc-rail-acct .nav-signin.is-chip .hc-chip-nm{color:#fff;max-width:none}",
  with: ".hc-rail-acct .nav-signin.is-chip .hc-chip-nm{color:#fff;max-width:none;display:none}",
});
/* WHY THIS ASSERTS THE CAPACITY TO TRUNCATE AND NOT THE TRUNCATION ITSELF. The obvious wording —
 * "a long address is ellipsised" — is red whenever the rail is wide, because a wide rail fits the
 * whole address and nothing truncates. That made it a second casualty of leg 1's break (COMPOUND,
 * proving nothing) while describing a different property. The properties that must hold no matter
 * how wide the rail is: the name is THERE, it occupies real width, and it is configured so that
 * when it does not fit it ellipsises rather than pushing the column open. The ellipsis actually
 * engaging at 1710px is printed above as evidence, not asserted here. */
const TRUNC = "hidden|ellipsis|nowrap|shown";
leg("RULE", "3 the account name is present in the rail and able to truncate",
  L.nameW > 40 && S.nameW > 0 && L.nameTrunc === TRUNC && S.nameTrunc === TRUNC,
  `long address occupies ${L.nameW}px (content ${L.nameContentW}px, so the ellipsis is engaged here: ` +
  `${L.nameContentW > L.nameW}); short address ${S.nameW}px. Computed overflow|text-overflow|` +
  `white-space|displayed = ${L.nameTrunc}. Asserting only "name width <= rail width" was VACUOUS — ` +
  `50 <= 180 holds however the rule is written, including with the name removed entirely.`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
