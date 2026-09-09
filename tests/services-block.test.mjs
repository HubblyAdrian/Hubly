import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/**
 * Wires scripts/check-services-block.mjs into `npm test`.
 *
 * 38 of 120 generated pages have no services area and no placeholder rows, so their
 * owners were offered a full page rebuild for typing their prices. This is the small
 * answer, built on hubly_contact.ts's discipline.
 *
 * PROVEN TO GO RED 2026-09-09, twice: adding data-hubly-guess to a row -> exit 1
 * "NO PLACEHOLDER ROWS"; dropping the section stamp -> exit 1 "stamped at insertion".
 * Restored byte-identical both times; re-run exit 0. Exits 2 CANNOT RUN without Deno.
 */
test("a page with no services area gets a real one, never placeholders", () => {
  try {
    execFileSync("node", [path.join(ROOT, "scripts/check-services-block.mjs")], { encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    if (e.status === 2) return;
    assert.fail(`check-services-block.mjs failed:\n${e.stdout || ""}${e.stderr || ""}`);
  }
});
