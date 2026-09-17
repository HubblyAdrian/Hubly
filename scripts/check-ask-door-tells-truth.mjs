#!/usr/bin/env node
/**
 * A DOOR THAT REPORTS SUCCESS WITHOUT SENDING IS WORSE THAN A DOOR THAT DOES NOT EXIST.
 *
 *   node scripts/check-ask-door-tells-truth.mjs
 *
 * Google Calendar cannot leave Testing (no privacy policy or terms URL), so the design is: an owner
 * asks, we are notified, we add them by hand. There are **zero connections**.
 *
 * `google-calendar-connection` returned `{ok:true, requested:true}` WHETHER OR NOT THE NOTIFICATION
 * SENT. The email sat in a try/catch that only warned, behind a silent `if` on three env vars — so a
 * missing key, a Resend outage or a bad address all ended with the owner being told "You're on the
 * list" while nothing left the building. **That may be the entire explanation for zero connections:
 * people may have asked, we were told they did, and nobody was told.**
 *
 * Same shape as the silent-success fix: the turn's outcome is derived from what happened.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

let fn, page, sync;
try {
  fn = readFileSync(resolve(ROOT, "supabase/functions/google-calendar-connection/index.ts"), "utf8");
  page = readFileSync(resolve(ROOT, "public/hubly.html"), "utf8");
  sync = readFileSync(resolve(ROOT, "supabase/functions/_shared/google_calendar_sync.ts"), "utf8");
} catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

// ── 1. THE SERVER'S ANSWER IS DERIVED FROM THE SEND, NOT FROM REACHING THE HANDLER. ─────
// The negative clause here first read `!/requested:\s*true/`, which matched nothing in the return
// value but DID match the word "requested" inside the notification email's own body text. A
// negative assertion over a whole file catches prose; scope it to the return.
const ret = fn.slice(fn.indexOf("return jsonRes({\n        ok: true,"));
say("1 [RULE] `requested` is derived from whether the notification actually sent",
  /requested:\s*notified/.test(fn) && !/requested:\s*true/.test(ret.slice(0, 400)),
  "requested: notified");
say("2 [RULE] only a 2xx from the mail provider counts as sent",
  /notified\s*=\s*sendRes\.ok/.test(fn),
  "a 4xx for a bad address or unverified sender is NOT success");
say("3 [RULE] and the reason travels, so the client can say something true",
  /notify_error:/.test(fn) && /not_configured/.test(fn) && /no_owner_email/.test(fn),
  "not_configured · no_owner_email · resend_<status> · send_threw");

// ── 4. THE OWNER HEARS THE TRUTH, IN WORDS. ─────────────────────────────────────────────
say("4 [RULE] a failed send tells the owner he is NOT on the list",
  /data\.notified===false/.test(page) && /you are NOT on the list/.test(page),
  "in words, not a silent retry");
// ── 5. AND A FAILED REQUEST IS NOT REMEMBERED AS MADE — otherwise the lie is permanent for
//       that browser, because the next visit reads "you're already on the list". ─────────
say("5 [RULE] a failed request does not get marked as requested",
  /markGcalAccessRequestedFailed/.test(page)
    && /removeItem\(gcalAccessRequestedKey\(\)\)/.test(page),
  "the per-business key is cleared, not a stale global one");

// ── 6. THE SILENT EXPIRY: the column that existed and nothing wrote. ────────────────────
say("6 [RULE] a dead connection is recorded on the row",
  /last_error:/.test(sync) && /google_calendar_connections/.test(sync),
  "last_error is written on refresh failure");
say("7 [RULE] Google's own reason is kept, not flattened to 'failed'",
  /tokenJson\?\.error\b/.test(sync) && /error_description/.test(sync),
  "invalid_grant reads differently from a network blip");
// THE ABSENCE-MARKER TRAP, FOR THE THIRD TIME AND NOW IN A CHECK. The old sentence survives in the
// COMMENT explaining that it was removed, so a bare phrase match reports it as still present. Scope
// the negative to the thrown string, the way confirm-served now forces for absence markers.
// ANCHORED ON THE MESSAGE ITSELF, not on the file's first `throw` — which is a different one
// about missing credentials. A slice anchored on the wrong occurrence measures the wrong string.
const expIdx = sync.indexOf("stopped syncing because its access expired");
const thrown = expIdx < 0 ? "" : sync.slice(expIdx - 60, expIdx + 320);
say("8 [RULE] and the message names no control Hubly cannot see",
  !/in Settings|click|button|tab/i.test(thrown)
    && /stopped syncing because its access expired/.test(thrown),
  "says what happened and what fixes it, points at nothing");
// ── 9. RECORDING THE FAILURE MUST NOT REPLACE THE FAILURE. ──────────────────────────────
say("9 [RULE] if recording the error fails, the sync still stops",
  /could not record last_error/.test(sync) && /throw new Error\(/.test(sync),
  "the throw is outside the try");

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nThe ask-us door reports what happened, and a dying connection leaves a mark.");
process.exit(failed ? 1 : 0);
