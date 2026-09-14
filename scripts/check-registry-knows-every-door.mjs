#!/usr/bin/env node
/**
 * A CAPABILITY THE CODE EXPOSES THAT THE REGISTRY DOES NOT KNOW ABOUT IS ONE THE ASSISTANT
 * WILL REFUSE TO DO.
 *
 * `hubly-conversation` handles structured owner actions as `body.<x>` branches — a canvas
 * control posts `{ sectionMove: … }` and the server runs it. The MODEL's list of what it can
 * do is the capability registry, and nothing connects the two. Measured 2026-09-14: six
 * capabilities the product has and the model has never been told about, including moving a
 * section and deleting a block. Ask Hubly to move a section and it declines — correctly, by
 * its own rules, because nothing in its list says it can.
 *
 * Every `body.<x>` branch therefore needs one of two things:
 *   · a registry ACTION the model can invoke, or
 *   · an explicit entry in NOT_FOR_MODEL below, with a reason.
 *
 * "It is a canvas control" is a legitimate reason and several are. What is NOT legitimate is
 * silence — a capability nobody decided about, which is what all six were.
 *
 *   node scripts/check-registry-knows-every-door.mjs
 *
 * Exit: 0 every door is accounted for · 1 an undeclared door · 2 cannot run.
 *
 * ── ON REACHABILITY, WHICH IS THE OTHER HALF AND IS NOT ASSERTED HERE ─────────────────────
 *
 * Adrian asked whether a capability in the registry with no DOOR for the owner can be checked
 * the same way. **Partly, and the honest answer is mostly no.**
 *
 * What IS assertable, and this check does it: that every server branch is declared. That is a
 * static fact about two files.
 *
 * What is NOT: whether an owner can REACH a capability. Reachability is a path through a
 * rendered UI — a control that exists, is visible in this state, is not covered by something
 * else, is wired to a handler, and whose handler is not gated on a flag that is false. Every
 * one of tonight's four unlit capabilities failed at a different point on that path:
 *   · `moveFreeformSection`     — no control at all
 *   · `applyOwnerDesignEdit`    — a control covered by the account chip
 *   · `hcMountAddService`       — mounted, then destroyed by a re-render
 *   · `applyServicesToClassic`  — wired into one of two call sites
 * A static check sees none of those. The only instrument that does is a browser that clicks,
 * which is what `scripts/lib/browser-rig.mjs` is for — and a rig run is per-surface, not a
 * corpus sweep.
 *
 * So: **we keep finding unreachable capabilities by walking, and that is stated rather than
 * pretended otherwise.** What this check buys is that the LIST of things to walk is complete.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONV = resolve(ROOT, "supabase/functions/hubly-conversation/index.ts");

/**
 * DOORS THE MODEL IS DELIBERATELY NOT TOLD ABOUT, each with the reason.
 * Adding a name here is a decision someone made; leaving one out is a decision nobody made.
 */
const NOT_FOR_MODEL = {
  context:                 "a request field, not an action",
  draftBusiness:           "a request field, not an action",
  understanding:           "a request field, not an action",
  selection:               "a request field — what the owner has clicked on the canvas",
  entryIntent:             "a request field set by the shell",
  event:                   "telemetry ingest, not an owner action",
  logoUpload:              "a file the owner dropped; the model must never invoke an upload it cannot supply bytes for",
  photoUpload:             "same — a file arrives with the request or not at all",
  directImageEdit:         "same",
  directDocumentImageEdit: "same",
  directFreeformImageEdit: "same",
  directEdit:              "click-to-edit on the canvas: the owner typed into their own page",
  directFreeformEdit:      "click-to-edit on the canvas",
  directDocumentPatch:     "click-to-edit on the canvas",
  directRecordEdit:        "the Edit details panel — a form, not a sentence",
  styleEdit:               "the contextual toolbar on a selected element",
  designKnobs:             "the Design panel READS its knobs; the model has no use for the read",
  restampPage:             "housekeeping the shell triggers on mount",
  retryBuild:              "a retry of work already requested",
  messages:                "the conversation itself",
  businessId:              "a request field",
  conversationId:          "a request field",
  conversationKey:         "a request field",
  storeContext:            "a request field — the storefront shell's state",
  storefrontState:         "a request field — the storefront shell's state",
};

/**
 * DOORS THE MODEL SHOULD PROBABLY HAVE AND DOES NOT. Declared so the check passes, listed
 * SEPARATELY so they are printed on every run rather than disappearing into the not-for-model
 * pile. These are the ones an owner would plainly ask for in words — "move the services
 * section above the gallery", "delete that block", "make the text bigger" — and today the
 * assistant declines, correctly by its own rules, because nothing in its list says it can.
 *
 * Promoting one is a product decision with a wording decision inside it, not a declaration,
 * so none is promoted here. What this buys is that the list of four is visible every run
 * instead of being rediscovered by reading.
 */
const SHOULD_BE_MODEL_ACTIONS = {
  // WIRED 2026-09-14 as website.moveSection. Kept listed because the DOOR `body.sectionMove`
  // still exists for the canvas control, and both now reach applyOwnerSectionMove — which is
  // correct (two callers, one capability) and is exactly the shape that must not drift into
  // two capabilities. If a second mover ever appears, this line is where it will be noticed.
  sectionMove: "SERVED — the canvas posts it, and the model invokes website.moveSection; one capability, two callers",
  nodeMove:    "applyOwnerNodeMove takes a NodeAddress (a fingerprint of a rendered element) — the model cannot construct one. Needs the resolver path",
  nodeDelete:  "applyOwnerNodeDelete takes a NodeAddress — same. Needs the resolver path, and the resolution must be reported because a wrong delete is unrecoverable to the owner",
};

/**
 * A DOOR SERVED BY AN ACTION UNDER A DIFFERENT NAME.
 *
 * The name match is deliberately exact — a near name is how a door gets counted as covered
 * when nothing covers it — so a capability the model CAN invoke under a different label needs
 * saying out loud rather than being matched by resemblance.
 *
 * `body.designEdit` was listed as a gap on the first run of this check (2026-09-14). It is not:
 * `website.setDesignKnob` calls `applyOwnerDesignEdit` from inside a model-invocable handler,
 * so the model has had this capability all along. Verified by counting calls inside handler
 * bodies, not by reading names: designEdit 1, sectionMove 0, nodeMove 0, nodeDelete 0.
 *
 * **That correction is the point of checking before wiring.** Adding a `moveDesignKnob` action
 * beside the one that exists would have been a second door to one capability — the drift this
 * whole exercise is about — and it would have looked like progress.
 */
const SERVED_BY_ANOTHER_ACTION = {
  designEdit: "the Design panel's structured POST; the MODEL reaches this capability as website.setDesignKnob",
};

let conv, registryActions;
const reg = (() => { try { return readFileSync(resolve(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts"), "utf8"); } catch { return ""; } })();
try { conv = readFileSync(CONV, "utf8"); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }
try {
  const out = createRequire(import.meta.url)("node:child_process").execFileSync("deno", ["eval", "--no-check",
    'import {HUBLY_CAPABILITY_REGISTRY as R} from "' + resolve(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts") +
    '"; const a=[]; for(const c of R) for(const x of (c.actions||[])) a.push(x.name); console.log(a.join(","));'],
    { encoding: "utf8" });
  registryActions = new Set(out.trim().split(",").filter(Boolean));
} catch (e) { console.error("CANNOT RUN — registry would not load: " + String(e.message).slice(0, 160)); process.exit(2); }

// Every `body.<x>` / `body?.<x>` the conversation function reads.
const doors = [...new Set([...conv.matchAll(/\bbody\??\.([a-zA-Z][a-zA-Z0-9_]*)/g)].map((m) => m[1]))].sort();

let failed = 0;
const undeclared = [];
for (const d of doors) {
  if (NOT_FOR_MODEL[d] || SHOULD_BE_MODEL_ACTIONS[d] || SERVED_BY_ANOTHER_ACTION[d]) continue;
  // A door is "known to the model" if an action of the same name exists, or one whose name
  // differs only by case — `sectionMove` ↔ `moveSection` is NOT a match on purpose: a near
  // name is how a door gets counted as covered when nothing covers it.
  if (registryActions.has(d)) continue;
  undeclared.push(d);
}

console.log(`body.<x> doors found: ${doors.length}   registry actions: ${registryActions.size}   declared not-for-model: ${Object.keys(NOT_FOR_MODEL).length}`);
const gaps = Object.keys(SHOULD_BE_MODEL_ACTIONS).filter((d) => !registryActions.has(d));
for (const [d, why] of Object.entries(SERVED_BY_ANOTHER_ACTION)) console.log(`  body.${d.padEnd(14)} served elsewhere — ${why}`);
if (gaps.length) {
  console.log(`\n${gaps.length} door(s) whose model story is worth printing every run, not filing away:`);
  for (const d of gaps) console.log(`  body.${d.padEnd(14)} ${SHOULD_BE_MODEL_ACTIONS[d]}`);
}
// ── LEG 2 — A DECLARED DOOR MUST BE A REAL DOOR (2026-09-14) ─────────────────────────────
//
// `CapabilityDoors` lets an action declare its three doors: talk · do-it-yourself · show. Leg 1
// above asks whether every server branch is DECLARED; this asks whether every declaration is
// TRUE. Declaring a door is a commitment — the finding of 2026-09-13 was four capabilities whose
// middle door existed and whose others did not, and nothing in the code said so.
//
// The do-it-yourself door is a MARKER IN A FILE, never a sentence, because Hubly may not name a
// control it cannot see (CLAUDE.md). That makes it checkable: the marker is either in the file
// or the door is gone. Otherwise a control renamed in a refactor takes its door with it
// silently — shape 1 of the unlit catalogue, arriving through the back.
//
// Read from the LOADED registry, not from its source text: these are real objects, and parsing
// a literal to learn what a literal says is the kind of indirection that reads a receipt rather
// than the goods (Lesson 83).
{
  let decls = [];
  try {
    const out = createRequire(import.meta.url)("node:child_process").execFileSync("deno", ["eval", "--no-check",
      'import {HUBLY_CAPABILITY_REGISTRY as R} from "' + resolve(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts") +
      '"; const o=[]; for(const c of R) for(const x of (c.actions||[])) if(x.doors) o.push({id:c.name+"."+x.name, name:x.name, doors:x.doors}); console.log(JSON.stringify(o));'],
      { encoding: "utf8" });
    decls = JSON.parse(out.trim().split("\n").pop());
  } catch (e) { console.error("CANNOT RUN — could not read declared doors: " + String(e.message).slice(0, 160)); process.exit(2); }

  for (const d of decls) {
    const { talk, diy, show } = d.doors || {};
    if (talk === undefined || diy === undefined || show === undefined) {
      failed++; console.error(`FAIL  ${d.id} declares doors but not all three of talk/diy/show. A door nobody decided about is what this type exists to prevent.`);
      continue;
    }
    if (!talk && !diy && !show) {
      failed++; console.error(`FAIL  ${d.id} declares three closed doors. Either it has one, or it should not be an action.`);
    }
    if (talk && !registryActions.has(String(talk).split(".").pop())) {
      failed++; console.error(`FAIL  ${d.id} declares talk door "${talk}" and no such action exists in the registry.`);
    }
    if (diy) {
      if (!diy.file || !diy.marker) {
        failed++; console.error(`FAIL  ${d.id} declares a do-it-yourself door without a file and a marker — nothing to verify.`);
      } else {
        let src = null;
        try { src = readFileSync(resolve(ROOT, diy.file), "utf8"); }
        catch { failed++; console.error(`FAIL  ${d.id} declares its do-it-yourself door in ${diy.file}, which does not exist.`); }
        // A COMMENT MENTIONING THE CONTROL IS NOT THE CONTROL. Written the same afternoon as
        // Lesson 82, and this check still made the mistake on its first run: renaming every
        // real `data-pe="add-service"` in public/hubly.html left it green, because a comment
        // three thousand lines away still said the name. Comments are masked before the marker
        // is looked for — HTML and JS, because the file is both.
        if (src !== null) {
          src = src.replace(/<!--[\s\S]*?-->/g, " ")
                   .replace(/\/\*[\s\S]*?\*\//g, " ")
                   .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
        }
        if (src !== null && !src.includes(diy.marker)) {
          failed++;
          console.error(`FAIL  ${d.id} declares a do-it-yourself door — ${diy.marker} in ${diy.file} — and that marker is GONE.\n` +
                        `      The control was renamed or removed, and the capability now claims a door it does not have.`);
        }
      }
    }
    if (show) {
      // THE MECHANISM IS CLIENT-SIDE BY NATURE — it moves a page and marks an element, which
      // no server can do — so it is looked for where it lives, and as a DEFINITION rather than
      // a mention. A string that appears only in a comment or a call is not a mechanism.
      const defined = ["public/platform-home.html", "public/hubly.html"].some((f) => {
        try { return new RegExp(`function\\s+${String(show)}\\s*\\(`).test(readFileSync(resolve(ROOT, f), "utf8")); }
        catch { return false; }
      }) || new RegExp(`function\\s+${String(show)}\\s*\\(`).test(conv) || new RegExp(`function\\s+${String(show)}\\s*\\(`).test(reg);
      if (!defined) {
        failed++;
        console.error(`FAIL  ${d.id} declares a show-me-where door "${show}" and nothing DEFINES it.\n` +
                      `      A declared third door with no mechanism behind it is the exact claim this type exists to stop.`);
      }
    }
    console.log(`  doors  ${d.id.padEnd(24)} talk: ${talk || "—"} · diy: ${diy ? diy.marker + " in " + diy.file : "—"} · show: ${show || "— (no mechanism exists yet, product-wide)"}`);
  }
  console.log(`declared door sets checked: ${decls.length}`);
}

if (undeclared.length) {
  failed += undeclared.length;
  console.error(`\nFAIL — ${undeclared.length} door(s) the code exposes and nobody decided about:`);
  for (const d of undeclared) console.error(`  body.${d}  — no registry action, no NOT_FOR_MODEL entry`);
  console.error(`\nEither give it an action the model can invoke, or add it to NOT_FOR_MODEL with a reason.\nSilence is the one option that is not available: it is how six capabilities came to exist that\nthe assistant refuses to perform.`);
  process.exit(1);
}
if (failed) {
  console.error(`\n${failed} failure(s).`);
  process.exit(1);
}
console.log(`\nPASS — all ${doors.length} doors are accounted for: an action the model can invoke, or an explicit reason it cannot.\nEvery declared door set names a door that is actually there.`);
