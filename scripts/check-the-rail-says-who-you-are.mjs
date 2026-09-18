#!/usr/bin/env node
/**
 * [RULE] THE RAIL CHIP NAMES THE PERSON ABOVE THE BUSINESS — OR NAMES NOBODY AT ALL.
 *
 *   node scripts/check-the-rail-says-who-you-are.mjs
 *
 * ══ WHAT ADRIAN RULED, 2026-09-17 ═══════════════════════════════════════════════════════
 *
 * The owner's first name goes on its own line ABOVE the business name in the rail chip,
 * sourced from `hcOwnerFirstName()`. When that returns null, render NOTHING — no placeholder,
 * no "there", no initial.
 *
 * ══ WHY THE NULL CASE IS THE HALF THAT NEEDS A CHECK ════════════════════════════════════
 *
 * The happy path fails visibly: no name on screen and Adrian sees it. The null path fails
 * INVISIBLY and in the expensive direction — a placeholder reads as a fact. On 2026-09-15 the
 * account chip showed "adriansmithee+ever…" as his name for a whole session, because a surface
 * that could not establish a name filled the space from the email rather than leaving it empty.
 * That is the same defect as the phone number lifted from the transcript, one fact over:
 * something a customer-visible surface states that the owner never said.
 *
 * So leg 2 is the point of this file, and leg 3 guards the road back to the 2026-09-15 bug:
 * the rendered text must be EXACTLY what the one reader returns, never a second opinion
 * assembled locally out of an email prefix or the auth provider's guess.
 *
 * SCOPED: this drives the real renderer in the real shell against a SIMULATED owner (there is
 * no service key here and no way to hold a real JWT). It is evidence about what the renderer
 * does with a given identity — NOT that the identity load itself works against the live
 * database, and NOT what the chip looks like on a phone. The rail is not rendered below 901px
 * at all; mobile needs a person (docs/OWNER_VERIFICATIONS.md).
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
const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Fixture Detailing", hasPage: true, url: "https://hubly-classic-fixture.myhubly.app" };
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/** Render the rail for one simulated owner and read the chip back out of the DOM. */
async function railFor(srv, displayName) {
  const rig = await openRig({ width: 1440, height: 900, quiet: true });
  await rig.load(srv.url("platform-home.html"));
  await rig.page.evaluate(installOwnerFake, { uid: "sim", email: "adriansmithee+ever@gmail.com",
    displayName, places: [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }],
    tables: { jobs: [], tasks: [], customers: [], events: [] } });
  const bad = await rig.page.evaluate(fakeIntact);
  if (bad && !/never took a client/.test(bad)) { await rig.close(); throw new Error(bad); }
  const m = await rig.page.evaluate(async ({ biz }) => {
    await window.hublyArrivalUI.simulate(biz, true, []);
    window.hublyNavUI.openWorkspace("website");
    await new Promise((r) => setTimeout(r, 900));
    const el = document.getElementById("hcRailBiz");
    if (!el) return { missing: "no #hcRailBiz node" };
    const txt = el.querySelector(".hc-rail-biz-txt");
    if (!txt) return { missing: "the rail chip rendered no text block" };
    const who = txt.querySelector(".hc-rail-biz-who");
    const nm = txt.querySelector(".hc-rail-biz-nm");
    const r = (n) => { const b = n.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left }; };
    return {
      hidden: !!el.hidden,
      order: Array.from(txt.children).map((c) => c.className),
      whoText: who ? who.textContent : null,
      nmText: nm ? nm.textContent : null,
      whoBox: who ? r(who) : null,
      nmBox: nm ? r(nm) : null,
      // What the ONE reader says, for leg 3 — read through the published seam, not recomputed here.
      readerSays: (window.hublyOwnerName && window.hublyOwnerName.first()) ?? null,
      // Every scrap of text in the chip, so "renders nothing" can be checked as nothing at
      // all rather than as "no node with the class I happened to look for".
      //
      // textContent, NOT innerText — L96, fourth instance. innerText EXCLUDES a
      // visibility:hidden subtree by specification, so an instrument built on it reports a
      // HIDDEN placeholder as an ABSENT one: the exact silence that made ".hc-rail-acct
      // innerText was empty" read as "the name is not rendered". This leg claims an absence,
      // so it may not be measured with an instrument that is blind to the present-but-hidden
      // case. (The structural clause below carries the absence on its own; this one adds the
      // email-string test, and now it can see a hidden one too.)
      allText: (el.textContent || "").replace(/\s+/g, " ").trim(),
    };
  }, { biz: BIZ });
  await rig.close();
  return m;
}

const srv = await servePublic(ROOT);
let named, anon;
try {
  named = await railFor(srv, "adrian smithee");   // lower-case on purpose: stored as typed, shown capitalised
  anon = await railFor(srv, null);                // nothing but a login — the reader must return null
} catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }

console.log(`  named owner  order=[${(named.order || []).join(", ")}] who=${JSON.stringify(named.whoText)} name=${JSON.stringify(named.nmText)}`);
console.log(`  login only   order=[${(anon.order || []).join(", ")}] who=${JSON.stringify(anon.whoText)} reader=${JSON.stringify(anon.readerSays)}`);
console.log(`               everything the chip says: ${JSON.stringify(anon.allText)}`);
console.log();

/* ── LEG 1 ─────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "1 a known first name is on its own line ABOVE the business name",
  why: "put the business name FIRST instead — the owner line is still there, still says exactly " +
       "what the reader says, still on its own line. Only the order Adrian ruled on is gone, which " +
       "is the narrowest break that can reach this leg: legs 2 and 3 cannot see it at all.",
  file: "public/platform-home.html",
  find: "n.className = 'hc-rail-biz-nm'; n.textContent = name; txt.appendChild(n); }",
  with: "n.className = 'hc-rail-biz-nm'; n.textContent = name; txt.insertBefore(n, txt.firstChild); }",
});
const orderOk = named.order && named.order.indexOf("hc-rail-biz-who") === 0 &&
  named.order.indexOf("hc-rail-biz-nm") === 1;
const aboveOk = named.whoBox && named.nmBox && named.whoBox.bottom <= named.nmBox.top + 0.5;
// ORDER AND GEOMETRY ONLY. Whether the text is the RIGHT text is leg 3's claim, and asserting it
// here too is what made leg 3's break register as a leg 1 failure — a COMPOUND that proves nothing
// about either leg (L98). One claim per leg is what makes a break aimable.
leg("RULE", "1 a known first name is on its own line ABOVE the business name",
  orderOk && aboveOk,
  `the chip's text block is [${(named.order || []).join(", ")}] — the owner line first — and it is ` +
  `geometrically above, not merely before it in the markup: its bottom is ` +
  `${named.whoBox ? Math.round(named.whoBox.bottom) : "?"}px and the business name starts at ` +
  `${named.nmBox ? Math.round(named.nmBox.top) : "?"}px. Text ${JSON.stringify(named.whoText)} from ` +
  `stored "adrian smithee". WHAT the text says is leg 3's claim, not this one.`);

/* ── LEG 2 ─────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "2 no name established renders NOTHING — no node, no placeholder, no email",
  why: "fall back to the email's local part when the reader returns null, which is exactly the " +
       "2026-09-15 bug: a login credential shown to the owner as his name, in the one place he " +
       "looks to confirm Hubly knows who he is",
  file: "public/platform-home.html",
  find: "    var who = hcOwnerFirstName();\n    var w = null;",
  with: "    var who = hcOwnerFirstName() || (hcIdentity.email || '').split('@')[0];\n    var w = null;",
});
const nothing = anon.readerSays === null && anon.whoText === null &&
  !(anon.order || []).includes("hc-rail-biz-who") &&
  !/adriansmithee|gmail|@/i.test(anon.allText || "");
leg("RULE", "2 no name established renders NOTHING — no node, no placeholder, no email",
  nothing,
  `the reader returned ${JSON.stringify(anon.readerSays)}, no .hc-rail-biz-who node exists, and the ` +
  `whole chip's text is ${JSON.stringify(anon.allText)} — checked for an absence of ANY node and of ` +
  `the login string, not merely for an empty node, because a placeholder is a node that is present.`);

/* ── LEG 3 ─────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 the line is EXACTLY what the one reader returns — no second opinion",
  why: "restyle the name locally after reading it — one line of 'presentation', which is how every " +
       "second opinion about a person's name starts. It keeps the node, the order, the geometry and " +
       "the null decision identical, so ONLY the claim that the surface shows what the reader said " +
       "can detect it. (The real bug it stands for is larger — an email prefix or the auth " +
       "provider's guess — but a wider break would take legs 1 and 2 down with it and prove nothing.)",
  file: "public/platform-home.html",
  find: "    var who = hcOwnerFirstName();\n    var w = null;",
  with: "    var who = hcOwnerFirstName(); if(who) who = who.toUpperCase();\n    var w = null;",
});
leg("RULE", "3 the line is EXACTLY what the one reader returns — no second opinion",
  named.whoText !== null && named.whoText === named.readerSays,
  `rendered ${JSON.stringify(named.whoText)} and window.hublyOwnerName.first() says ` +
  `${JSON.stringify(named.readerSays)} — read through the published seam in the same page, so this ` +
  `compares the surface against the reader rather than against a constant I chose.`);

srv.close();
const bad = legs.filter((l) => !l.pass);
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
