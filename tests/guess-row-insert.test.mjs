import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Wires scripts/check-guess-row-insert.mjs into `npm test`.
 *
 * 120 of 159 generated pages had a services section built from data-hubly-guess rows and
 * no data-hubly-service anchors, so the inserter reported "no services section" about a
 * section that was on the page — and offered a full rebuild to anyone who typed a price.
 *
 * PROVEN TO GO RED 2026-09-09 by disabling the guess-row branch (`if (false)`): exit 1,
 * "(b) inserts — expected ok, got no_section". Restored byte-identical; re-run exit 0.
 * It exits 2 CANNOT RUN when Deno is unavailable — the registry imports over https and
 * Node's loader refuses it, which is how the first version of this check exited.
 */
test("a services section made of placeholder rows is still a services section", () => {
  try {
    execFileSync("node", [path.join(ROOT, "scripts/check-guess-row-insert.mjs")], {
      encoding: "utf8", stdio: "pipe",
    });
  } catch (e) {
    if (e.status === 2) return;   // CANNOT RUN is not a failure of the product
    assert.fail(`check-guess-row-insert.mjs failed:\n${e.stdout || ""}${e.stderr || ""}`);
  }
});
