import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Wires scripts/check-draft-token-truthiness.mjs into `npm test`.
 *
 * The class appeared SEVEN times on 2026-09-08. The first sweep fixed four and missed
 * three, and the three were found by clicking a suggestion — not by searching. Grepping
 * harder was the thing that failed twice, so the invariant is enforced here instead.
 *
 * ITS FIRST RUN FOUND EIGHT SITES, five of them real and one nobody knew about: the
 * classic-site gate was UNREACHABLE, because the credential guard returned
 * "No draft business exists yet" before it — for exactly the 9 businesses the gate's
 * honest handoff was written for.
 *
 * PROVEN TO GO RED 2026-09-08 by reintroducing a real defect from that day — the photo
 * upload's `&& draftBusiness?.draftToken` — exit 1, "index.ts:1510 guards on draftToken
 * with no owner alternative", lacking 1 (must be 0). Restored via `git checkout --`; md5
 * back to baseline; re-run exit 0.
 */
test("no guard treats draftToken as the only credential", () => {
  try {
    execFileSync("node", [path.join(ROOT, "scripts/check-draft-token-truthiness.mjs")], {
      encoding: "utf8", stdio: "pipe",
    });
  } catch (e) {
    assert.fail(`check-draft-token-truthiness.mjs failed:\n${e.stdout || ""}${e.stderr || ""}`);
  }
});
