#!/usr/bin/env node
/**
 * [RULE] THE EDITING SURFACE SURVIVES A RE-RENDER — THE SECOND EDIT IS STILL AN EDIT.
 *
 *   node scripts/check-a-second-edit-still-works.mjs
 *
 * ══ WHAT ADRIAN HIT ══════════════════════════════════════════════════════════════════════════
 *
 * 2026-09-18: *"They saved, I refreshed, THEY STAYED — so the first three steps of the save test
 * pass. Then I could not edit them again. Not 'the edit failed' — I could not get back into the field
 * at all."*
 *
 * The function is `wireHcEditingSurface` (public/hubly.html). `data-hc-wired` is set once and cleared
 * NOWHERE, on a root whose CHILDREN are replaced — on a classic page `#p-classic-site #ws-page`,
 * whose contents renderWebsite() rewrites. After the first wire the flag stays forever, so every
 * later call returned at the guard and the PER-ELEMENT marking never ran again on the new elements.
 * Document-level listeners survived (they live on `doc`); the per-element ones did not.
 *
 * ══ WHY EVERY LEG HERE MARKS TWICE ═══════════════════════════════════════════════════════════
 *
 * L98, exactly: the defect is about the SECOND attempt, so a leg that wires once and checks the
 * result cannot fail on it. Every leg below runs the surface, REPLACES the content the way a
 * re-render does, runs the surface again, and asserts on the state AFTER that — which is the only
 * state the bug lives in. Leg 1 would have passed before the fix; legs 2 and 3 would not.
 *
 * SCOPED, and the scope is the honest half of this: it drives `wireHcEditingSurface` against a real
 * DOM through the real shell, with a root whose children are replaced between calls. It does NOT
 * perform a real SAVE — that needs an owner session, which this environment may never create — so it
 * does not settle the FREEFORM case, where a save loads a whole new document and the root's `body` is
 * therefore new. That half is argued from the code path and recorded as open.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

const srv = await servePublic(ROOT);
let rig;
try { rig = await openRig({ width: 1440, height: 900, quiet: true }); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }

let m;
try {
  // hcEditable=1 is the gate the whole surface sits behind — without it wireHcEditingSurface
  // returns before doing anything, and every leg here would be vacuous.
  await rig.load(srv.url("hubly.html") + "?hcEditable=1");
  m = await rig.page.evaluate(async () => {
    const out = { reached: false };
    const ui = window.hublyEditSurfaceUI;
    if (!ui || typeof ui.wire !== "function") return { reached: false, why: "no hublyEditSurfaceUI.wire seam" };
    out.reached = true;
    // A root whose CHILDREN get replaced, which is the shape of the real classic root.
    const root = document.createElement("div");
    root.id = "hc-second-edit-probe";
    document.body.appendChild(root);
    const fill = () => { root.innerHTML = '<p data-hc="a.b.c">one</p><p data-hc="a.b.d">two</p>'; };

    fill();
    ui.wire(document, root);
    const firstMarked = root.querySelectorAll("[data-hc-editable-marked]").length;
    const firstChildren = root.children.length;

    // THE RE-RENDER. Exactly what renderWebsite() does: the root survives, its children do not.
    fill();
    const afterRenderMarked = root.querySelectorAll("[data-hc-editable-marked]").length;

    // THE SECOND WIRE, which is what showP -> wireHublyDocumentClickToEdit does after a render.
    ui.wire(document, root);
    const secondMarked = root.querySelectorAll("[data-hc-editable-marked]").length;
    const wiredFlag = root.getAttribute("data-hc-wired");
    root.remove();
    return { reached: true, firstMarked, firstChildren, afterRenderMarked, secondMarked, wiredFlag };
  });
} catch (e) { console.error("CANNOT RUN — " + e.message); await rig.close(); srv.close(); process.exit(2); }
await rig.close(); srv.close();

if (!m || !m.reached) { console.error("CANNOT RUN — " + ((m && m.why) || "the probe did not run")); process.exit(2); }
console.log(`  first wire: ${m.firstMarked} of ${m.firstChildren} element(s) marked · after the re-render: ` +
  `${m.afterRenderMarked} · after the SECOND wire: ${m.secondMarked} · data-hc-wired=${JSON.stringify(m.wiredFlag)}\n`);

/* ── LEG 1 WAS HERE, AND IT IS NOW A DIAGNOSTIC LINE, NOT A LEG ─────────────────────────────
 *
 * It asserted "the FIRST wire marks the elements". Its break — make markAllEditable do nothing —
 * came back COMPOUND, and correctly: leg 1 is a PRECONDITION of leg 3, so nothing can break the
 * first wire without breaking the second, and no narrower break exists that is not contrived.
 *
 * A leg that cannot fail independently of another cannot be red-proofed, and it inflates a green
 * count without testing anything. Its real job — "so a red on leg 2 or 3 is not misread as 'the
 * editor never worked'" — is done by the measurement PRINTED above (`first wire: 2 of 2`), and leg 2
 * already encodes it: marks cannot be LOST unless they existed. So it is a number in the output and
 * not a leg, which is the honest place for a precondition. */

/* ── LEG 2 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "2 a re-render really does strip the marks",
  why: "make the probe's re-render reuse the same children instead of replacing them. The leg then " +
       "passes for the wrong reason — nothing was invalidated — and leg 3 would be asserting that a " +
       "surface which never lost its marks still has them. This is the leg that keeps leg 3 honest.",
  file: "scripts/check-a-second-edit-still-works.mjs",
  find: "    fill();\n    const afterRenderMarked",
  with: "    const afterRenderMarked",
});
leg("RULE", "2 a re-render really does strip the marks",
  m.afterRenderMarked === 0 && m.firstMarked > 0,
  `after replacing the root's children the marked count is ${m.afterRenderMarked} (was ${m.firstMarked}). ` +
  `Asserted explicitly, because leg 3 means nothing unless the marks were genuinely LOST first — a ` +
  `probe that never invalidated anything would let leg 3 pass on a surface that was never re-wired.`);

/* ── LEG 3 — THE SECOND EDIT ───────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 the SECOND wire marks the new elements — the second edit is still an edit",
  why: "put the guard back to a bare `return`, which is the shipped defect: data-hc-wired is set once " +
       "and never cleared, so the second call returns before the per-element marking and the owner " +
       "cannot get back into the field at all. This is the exact line Adrian's report was about.",
  file: "public/hubly.html",
  find: "  if(root.getAttribute('data-hc-wired') === '1'){ markAllEditable(); return; }",
  with: "  if(root.getAttribute('data-hc-wired') === '1') return;",
});
leg("RULE", "3 the SECOND wire marks the new elements — the second edit is still an edit",
  m.secondMarked === m.firstChildren && m.secondMarked > 0,
  `${m.secondMarked} of ${m.firstChildren} marked after the SECOND wire, with data-hc-wired still ` +
  `${JSON.stringify(m.wiredFlag)} — so the once-only binding stayed once-only while the per-element ` +
  `marking ran again. Bind ONCE, mark EVERY TIME. The guard governing both is what made the second ` +
  `edit impossible.`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
