#!/usr/bin/env node
/**
 * [RULE] AN EMPTY SECTION NEVER REACHES A CUSTOMER. IT ABSOLUTELY REACHES THE OWNER.
 *
 *   node scripts/check-slot-never-reaches-a-customer.mjs
 *
 * ══ THE RULE THIS EXISTS FOR — ADRIAN, 2026-09-17 ═══════════════════════════════════════════
 *
 * *"PLACEHOLDER SLOTS… A section the AI wants but cannot ground renders as an empty slot the owner
 * fills or deletes. AN EMPTY SECTION NEVER REACHES A CUSTOMER; IT ABSOLUTELY REACHES THE OWNER, AS
 * AN OFFER. Ride the builder-preview / live split that already exists and PRESS IT to confirm it
 * separates them. RED-PROOF THIS HARDEST — a placeholder on a live page is the defect, and it is
 * the direction that looks fine in testing because the tester is signed in."*
 *
 * So the check is written from the CUSTOMER'S side first. Both paths are driven in a real browser
 * against the real mount code in public/hubly.html:
 *
 *   ?hcEdit=1   the builder preview  -> the slot is there, and says it is only for him
 *   (no flag)   what a stranger gets -> the slot is gone, AND the section it was alone in is gone
 *
 * ══ WHY THE SLOT EXISTS AT ALL ══════════════════════════════════════════════════════════════
 *
 * The Content Value Rule rejects a section carrying no concrete content. A model that wants the
 * section and has no data had two ways out: delete it, or INVENT A NUMBER — and nothing in the
 * rule asks whether the number is true. The rule manufactured fabrication. The slot is the third
 * option, and leg 1 asserts the validator accepts it as one.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require_ = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require_("playwright")); }
catch (e) { console.error("CANNOT RUN — playwright not loadable: " + e.message); process.exit(2); }

let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

// ── LEG 1: the validator's third option, exercised through the real validator ─────────
//
// ALWAYS THROUGH DENO, NEVER THROUGH A NODE IMPORT. The first version tried `await import()` first
// and fell back to deno — and node DID import the .ts file (stripping the types), so the fallback
// never ran and legs 1–4 SILENTLY DID NOT EXECUTE while the check still exited green on the rest.
// A check that skips four legs without saying so is the vacuous-green defect in its purest form.
// Deno is also the runtime the edge function actually uses, so it is the right answer twice.
{
  const { execFileSync } = await import("node:child_process");
  const probe = `
    import { validateHublyDocument, renderHublyDocument } from "${join(ROOT, "supabase/functions/_shared/hubly_document.ts")}";
    const section = (kids) => ({ tag: "section", id: "why-us", children: kids });
    const meta = { businessId: "b1", version: 1, generatedBy: "ai" };
    const doc = (kids) => ({ root: { tag: "main", id: "root", children: [
      { tag: "section", id: "hero", children: [{ tag: "h1", id: "h", children: "A Business" }] },
      section(kids)] } });
    const hollow = validateHublyDocument(doc([{ tag: "h2", id: "t", children: "Why us" },
                                              { tag: "p", id: "p", children: "We care about quality work." }]), meta);
    const invented = validateHublyDocument(doc([{ tag: "h2", id: "t2", children: "Why us" },
                                              { tag: "p", id: "p2", children: "Serving the area for 12 years." }]), meta);
    const slotted = validateHublyDocument(doc([{ tag: "h2", id: "t3", children: "Why us" },
                                              { tag: "HublySlot", id: "s3", attrs: { for: "photos of your work", kind: "photos" }, children: [] }]), meta);
    const html = slotted.ok ? renderHublyDocument(slotted.document, {}) : "";
    console.log(JSON.stringify({
      hollowRejected: !hollow.ok,
      inventedAccepted: invented.ok,
      slotAccepted: slotted.ok,
      slotErrors: (slotted.errors || []).map((e) => e.message).slice(0, 2),
      renderedSlot: /data-hd-placeholder/.test(html) && /hd-slot/.test(html),
      html,
    }));
  `;
  const tmp = join(ROOT, "scripts", ".slot-probe.ts");
  const { writeFileSync, unlinkSync } = await import("node:fs");
  writeFileSync(tmp, probe);
  let out;
  try { out = execFileSync("deno", ["run", "--allow-read", "--allow-env", tmp], { encoding: "utf8", cwd: ROOT }); }
  catch (e) { console.error("CANNOT RUN — deno could not run the validator: " + String(e.message).slice(0, 200)); unlinkSync(tmp); process.exit(2); }
  unlinkSync(tmp);
  const r = JSON.parse(out.trim().split("\n").pop());
  say("1 [RULE] a section with nothing in it is still rejected — the rule is not weakened",
      r.hollowRejected === true, "prose-only section rejected");
  say("2 [RULE] AND A MADE-UP FIGURE STILL GETS IT THROUGH — this is the defect, asserted so it cannot be forgotten",
      r.inventedAccepted === true,
      '"Serving the area for 12 years." passes: the rule asks for a figure, never whether it is true');
  say("3 [RULE] a slot is the honest third option, and the validator takes it",
      r.slotAccepted === true, r.slotAccepted ? "HublySlot accepted" : JSON.stringify(r.slotErrors));
  say("4 [RULE] and it renders as owner-only scaffolding, not as content",
      r.renderedSlot === true, "data-hd-placeholder + hd-slot present in the rendered html");
  if (!r.html) { console.error("CANNOT RUN — the validator produced no html to press"); process.exit(2); }
  globalThis.__slotHtml = r.html;
}

// ── LEGS 5–7: PRESS BOTH PATHS IN A REAL BROWSER ─────────────────────────────────────
// The mount and the strip are public/hubly.html's, not a copy: the check pulls the two functions
// out of the shipping file and runs them over the rendered document.
const shell = readFileSync(join(ROOT, "public/hubly.html"), "utf8");
const stripFn = shell.slice(shell.indexOf("function hcStripPlaceholders(root)"));
const stripSrc = stripFn.slice(0, stripFn.indexOf("\n}\n") + 3);
if (!/querySelectorAll\('\[data-hd-placeholder\]/.test(stripSrc)) {
  console.error("CANNOT RUN — hcStripPlaceholders was not found in public/hubly.html in the expected shape");
  process.exit(2);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const seen = await page.evaluate(({ html, stripSrc }) => {
  const mk = () => {
    const root = document.createElement("div");
    root.id = "hc-doc-root";
    root.innerHTML = `<div class="hd-doc-body">${html}</div>`;
    document.body.appendChild(root);
    return root;
  };
  const count = (root) => ({
    slots: root.querySelectorAll("[data-hd-empty='slot']").length,
    // ANY section, anywhere. The strip used to look for `.hd-doc-body > section` and so did this
    // probe; no mounted page has that element, which is precisely the defect it was supposed to be
    // measuring. Counting the same wrong thing as the code under test is how a check agrees with a
    // bug (Lesson 85: establish what two measurements SHARE before calling it corroboration).
    sections: root.querySelectorAll("section, article").length,
    saysOwnerOnly: /only you can see this/i.test(root.textContent || ""),
    text: (root.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
  });
  const owner = mk();
  const ownerSeen = count(owner);
  const pub = mk();
  // eslint-disable-next-line no-new-func
  new Function(stripSrc + "; hcStripPlaceholders(arguments[0]);")(pub);
  const publicSeen = count(pub);
  return { ownerSeen, publicSeen };
}, { html: globalThis.__slotHtml, stripSrc });
await browser.close();

say("5 [RULE] THE OWNER SEES THE SLOT — it is an offer, and it says it is only for him",
    seen.ownerSeen.slots >= 1 && seen.ownerSeen.saysOwnerOnly === true,
    `${seen.ownerSeen.slots} slot(s) in the builder preview`);
say("6 [RULE] A CUSTOMER SEES NOTHING — the slot is gone from the public page",
    seen.publicSeen.slots === 0, `${seen.publicSeen.slots} slot(s) survived the public strip`);
say("7 [RULE] and the SECTION it was alone in is gone too — no empty frame with a heading over it",
    seen.publicSeen.sections < seen.ownerSeen.sections,
    `sections: ${seen.ownerSeen.sections} for the owner, ${seen.publicSeen.sections} for a customer`);

// ══ AND THE FORMAT 187 OF 188 PAGES ACTUALLY USE ════════════════════════════════════════════
//
// Legs 5–7 drive the strip directly. That is not where the defect was: hcStripPlaceholders is
// CALLED with the mount root, and for a full document (format='html' — 187 of the 188 stored
// pages) that root holds one thing, an iframe, so the strip matched nothing and was a no-op on
// every page but one. These legs mount a full document through the REAL hcMountDocumentHtml and
// look inside the frame, the way a visitor's browser does.
{
  const fnSrc = (name) => {
    const at = shell.indexOf(`function ${name}(`);
    if (at < 0) return null;
    const rest = shell.slice(at);
    return rest.slice(0, rest.indexOf("\n}\n") + 3);
  };
  const mountSrc = fnSrc("hcMountDocumentHtml"), isFullSrc = fnSrc("hcIsFullDocument");
  if (!mountSrc || !isFullSrc) { console.error("CANNOT RUN — the mount functions were not found in public/hubly.html"); process.exit(2); }
  const fullDoc = `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <section id="real"><h2>Our prices</h2><p>Full detail $180.</p></section>
    <section id="wanted"><h2>Our work</h2>
      <div class="hd-empty-island hd-slot" data-hd-empty="slot" data-hd-placeholder="1"><p>Space for photos of your work</p></div>
    </section></body></html>`;
  const b2 = await chromium.launch();
  const p2 = await b2.newPage();
  const inFrame = await p2.evaluate(async ({ mountSrc, isFullSrc, stripSrc, fullDoc }) => {
    const out = {};
    for (const builder of [true, false]) {
      const root = document.createElement("div");
      document.body.appendChild(root);
      const run = new Function("root", "html", "isBuilder",
        isFullSrc + "\n" + stripSrc + "\nfunction hcBuilderPreview(){ return isBuilder; }\n" +
        "var hcPendingScrollY=null, hcUserScrolled=false;\n" +
        mountSrc + "\nreturn hcMountDocumentHtml(root, html);");
      const frame = run(root, fullDoc, builder);
      await new Promise((r) => setTimeout(r, 600));
      const d = frame && frame.contentDocument;
      out[builder ? "owner" : "customer"] = d
        ? { slots: d.querySelectorAll("[data-hd-placeholder]").length,
            sections: d.querySelectorAll("section").length,
            text: (d.body.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80) }
        : { slots: -1, sections: -1, text: "(no frame)" };
      root.remove();
    }
    return out;
  }, { mountSrc, isFullSrc, stripSrc, fullDoc });
  await b2.close();
  say("8 [RULE] on the format every page uses, the OWNER still sees the slot INSIDE the frame",
      inFrame.owner.slots === 1 && inFrame.owner.sections === 2,
      `builder preview: ${inFrame.owner.slots} slot(s), ${inFrame.owner.sections} section(s)`);
  say("9 [RULE] and a CUSTOMER gets neither the slot nor the section — inside the iframe, where the pages are",
      inFrame.customer.slots === 0 && inFrame.customer.sections === 1,
      `public: ${inFrame.customer.slots} slot(s), ${inFrame.customer.sections} section(s) — "${inFrame.customer.text}"`);
}

console.log(failed ? `\n${failed} FAILED\n` : "\nPASS — the slot is an offer to the owner and is not on the page a stranger loads.\n");
process.exit(failed ? 1 : 0);
