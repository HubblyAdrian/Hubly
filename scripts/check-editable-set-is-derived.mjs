#!/usr/bin/env node
/**
 * IF AN OWNER CAN SEE IT ON THEIR PAGE, THEY CAN CHANGE IT FROM THEIR PAGE.
 *
 *   node scripts/check-editable-set-is-derived.mjs
 *
 * ADRIAN WALKED INTO THIS ONE: he added a service and could not set its price.
 *
 * THE CAUSE. The page renders `data-pe="svc-price"`, `svc-name` and `svc-dur` on the parts of a
 * service card. `handleWsPeClick` is an if-chain — a HAND-MAINTAINED LIST of editable types — with
 * a branch for `service` and none for any of the three parts. It also ended with a bare `}`, so an
 * unhandled marker returned in silence. Pressing the price did nothing and said nothing.
 *
 * His ruling: "The editable set is DERIVED FROM WHAT THE CARD RENDERS. Not a list — a list is how
 * this broke."
 *
 * SO THIS CHECK IS THE DERIVATION. It reads every `data-pe` marker the source renders and requires
 * each one to be reachable — either handled by name, or resolvable as a PART of a record whose own
 * editor opens. A new marker added to the page with no way to edit it fails here, which is the
 * whole point: the list cannot silently fall behind the page again.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

let src;
try { src = readFileSync(resolve(ROOT, "public/hubly.html"), "utf8"); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

// WHAT THE PAGE RENDERS, discovered rather than listed.
const rendered = [...new Set([...src.matchAll(/data-pe="([a-z-]+)"/g)].map((m) => m[1]))].sort();
// WHAT THE HANDLER ANSWERS TO, discovered the same way.
const handler = src.slice(src.indexOf("function handleWsPeClick("));
const handled = new Set([...handler.matchAll(/type===?'([a-z-]+)'/g)].map((m) => m[1]));
// AND THE DERIVED ROUTE: a `svc-*` marker resolves to the service card that contains it.
const partRule = /function wsPeResolvePart\(/.test(src) && /\^svc-/.test(src);

say("0 [RULE] the scan found markers and branches to compare — a zero means the shape moved",
  rendered.length > 5 && handled.size > 5, `${rendered.length} rendered · ${handled.size} handled by name`);

const unreachable = rendered.filter((m) => {
  if (handled.has(m)) return false;
  if (partRule && /^svc-/.test(m)) return false;      // resolved to its record's editor
  return true;
});
/* ══ L98 — "EVERYTHING IS EDITABLE" IS GREEN OVER AN EMPTY SET ═══════════════════════════════════
 * `unreachable.length === 0` is satisfied when `rendered` is empty, i.e. when the marker scan found
 * NOTHING. Leg 0 above measures that the scan found some, and that is the right instinct — but a leg
 * must not depend on its neighbour having run: the guarantee belongs inside the assertion making the
 * claim, or deleting leg 0 silently makes this one vacuous. */
declareBreak({
  leg: "1 [RULE] the markers were found",
  // A MARKER THE `svc-*` PART RULE DOES NOT COVER. `svc-price` is exempt by design (it resolves to
  // its record's editor), so breaking it changes nothing here and fires leg 2 instead — the first
  // two attempts at this break found that out: `case'svc-price':` matched nothing at all, and
  // `if(pe==='svc-price'){` matched twice. `footer-tag` is handled by name and by nothing else.
  why: "remove one marker's editor branch — `footer-tag` — so a marker the page renders has nowhere " +
       "to be edited: the affordance painted over a capability that is not there",
  file: "public/hubly.html",
  find: "  if(type==='footer-tag'){",
  with: "  if(type==='footer-tag-BROKEN'){",
});
say("1 [RULE] the markers were found, and every one the page renders can be edited from the page",
  rendered.length > 0 && unreachable.length === 0,
  unreachable.length ? `NO EDITOR FOR: ${unreachable.join(", ")}`
    : `${rendered.length} marker(s) found and all reachable — the count is half the assertion, because ` +
      `"none is unreachable" is trivially true of a scan that found none`);

// THE ONES HE ACTUALLY HIT, named so a regression here is unmistakable rather than a count.
for (const m of ["svc-price", "svc-name", "svc-dur"]) {
  say(`2 [RULE] "${m}" reaches an editor`,
    handled.has(m) || (partRule && /^svc-/.test(m)), partRule ? "via its service card" : "NO ROUTE");
}
say("3 [RULE] and the part opens the field it names, not just the card",
  /WS_PE_PART_FIELD/.test(src) && /'svc-price':\s*'ws-pe-svc-price'/.test(src)
    && /id="ws-pe-svc-price"/.test(src),
  "svc-price -> #ws-pe-svc-price, which exists in the popup");

// ── 4. AND NOTHING FAILS SILENTLY. The bare `}` is what made this invisible. ─────────────
say("4 [RULE] an unhandled marker SAYS SO instead of returning in silence",
  /no editor for data-pe/.test(src) && /change that one from here yet/.test(src),
  "the fall-through speaks");

// ── 5. THE PARTS ARE CLICK TARGETS, or the affordance never appears over the number. ────
say("5 [RULE] the price, name and length carry the edit affordance themselves",
  /\[data-pe="svc-price"\], \[data-pe="svc-name"\], \[data-pe="svc-dur"\]/.test(src)
    && /part\.classList\.add\('ws-pe-target'\)/.test(src),
  "marked as targets with their own labels");

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nEverything the page renders can be changed from the page.");
process.exit(failed ? 1 : 0);
