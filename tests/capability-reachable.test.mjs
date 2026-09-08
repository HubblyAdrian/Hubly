import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Wires scripts/check-capability-reachable.mjs into `npm test`, which is the only
 * automated path this repo has — the other check-*.mjs scripts (including
 * check-owner-id-invariant.mjs) are run by hand, which is worth fixing separately.
 *
 * A capability that is built but never registered in CONTEXT_CAPABILITY_ALLOWLIST is
 * dead code that type-checks: `operations` shipped 2026-09-05 and was unreachable
 * until 2026-09-07; `places` was unreachable for the length of the session that built
 * it. In both cases the model simply said the feature "isn't live in the workspace".
 */
test("every capability is reachable and every advertised capability exists", () => {
  try {
    execFileSync("node", [path.join(ROOT, "scripts/check-capability-reachable.mjs")], {
      encoding: "utf8", stdio: "pipe",
    });
  } catch (e) {
    // The checker's own output is the useful message; surface it verbatim.
    assert.fail(`check-capability-reachable.mjs failed:\n${e.stdout || ""}${e.stderr || ""}`);
  }
});
