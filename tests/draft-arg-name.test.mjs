import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Wires scripts/check-draft-arg-name.mjs into `npm test`.
 *
 * Three occurrences in four days of a handler reading the argument name the engine
 * does NOT inject. It never throws: the read yields undefined, the guard fires on
 * every call, and the owner is told something false about their own business.
 *
 * FOUND A LIVE DEFECT ON ITS FIRST RUN, 2026-09-08, before anything was fixed:
 *   "operations.read (registry line 5022) reads args.businessId, but it is on
 *    DRAFT_INJECTED_ACTIONS" — shipped 2026-09-05, dead every day since.
 * The same run cleared booking.getAvailability, which reads args.businessId
 * correctly because booking is on the businessId injection branch.
 *
 * PROVEN TO GO RED on the two halves that had no live example:
 *   - added "website.newPag" to DRAFT_INJECTED_ACTIONS -> exit 1, "lists
 *     \"website.newPag\", which is NOT an action in the registry".
 *   - made booking.getAvailability read args.draftId -> exit 1, "reads args.draftId,
 *     but \"booking\" is injected with businessId"; wrong-name count 1 (must be 0).
 *   Both restored via `git checkout --`; md5 back to baseline, tree clean.
 */
test("every injected action reads the argument name its branch supplies", () => {
  try {
    execFileSync("node", [path.join(ROOT, "scripts/check-draft-arg-name.mjs")], {
      encoding: "utf8", stdio: "pipe",
    });
  } catch (e) {
    assert.fail(`check-draft-arg-name.mjs failed:\n${e.stdout || ""}${e.stderr || ""}`);
  }
});
