import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Wires scripts/check-customer-identity-invariant.mjs into `npm test`.
 *
 * Merging two customers is silent and has no undo, so this check has to run on
 * every commit rather than when someone thinks to run it.
 *
 * PROVEN TO GO RED 2026-09-08: inserted `.eq("name", String(name ?? ""))` into the
 * phone lookup in _shared/crm_customer.ts -> exit 1,
 * "✗ ...crm_customer.ts:122 filters a customers lookup on `name`", lookups filtering
 * on name 1 (must be 0). Restored via `git checkout --`; md5 back to baseline.
 */
test("one customer resolver, no name matching, no raw phone comparison", () => {
  try {
    execFileSync("node", [path.join(ROOT, "scripts/check-customer-identity-invariant.mjs")], {
      encoding: "utf8", stdio: "pipe",
    });
  } catch (e) {
    assert.fail(`check-customer-identity-invariant.mjs failed:\n${e.stdout || ""}${e.stderr || ""}`);
  }
});
