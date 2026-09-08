import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Wires scripts/check-stripe-mode-filter.mjs into `npm test`.
 *
 * This one earns automation more than most: an unfiltered read of
 * stripe_connect_accounts does not throw. It feeds a Map keyed by business_id that
 * keeps whichever mode's row arrived last, and renders "Connected" for an account
 * that cannot take a payment. Nothing surfaces it.
 *
 * PROVEN TO GO RED 2026-09-08: replaced `.eq("mode", currentStripeMode());` with `;`
 * in loadStripeMap (_shared/mission_control.ts:139) -> exit 1,
 * "✗ ...mission_control.ts:134 reads stripe_connect_accounts without `.eq(\"mode\", …)`",
 * UNFILTERED 1 (must be 0). Restored via `git checkout --`; md5 back to baseline.
 */
test("every stripe_connect_accounts read filters by mode", () => {
  try {
    execFileSync("node", [path.join(ROOT, "scripts/check-stripe-mode-filter.mjs")], {
      encoding: "utf8", stdio: "pipe",
    });
  } catch (e) {
    assert.fail(`check-stripe-mode-filter.mjs failed:\n${e.stdout || ""}${e.stderr || ""}`);
  }
});
