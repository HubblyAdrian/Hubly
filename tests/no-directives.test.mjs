import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/**
 * Wires scripts/check-no-directives-to-owners.mjs into `npm test`.
 *
 * hubly-conversation builds primaryReply as photoTruth || servicesTruth ||
 * contactHoursTruth, so those strings reach an owner VERBATIM. On 2026-09-09 the photo
 * path was shipping "do NOT claim it is showing; offer to rebuild the page around it"
 * to owners, and a fourth leak was found by this check in composeServicesTruth.
 *
 * PROVEN TO GO RED 2026-09-09 by appending "Do not claim they are showing." to an
 * owner-facing branch: exit 1, naming the phrase and the channel. Restored
 * byte-identical; re-run exit 0. Exits 2 CANNOT RUN without Deno.
 */
test("no model directive reaches an owner", () => {
  try {
    execFileSync("node", [path.join(ROOT, "scripts/check-no-directives-to-owners.mjs")], { encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    if (e.status === 2) return;
    assert.fail(`check-no-directives-to-owners.mjs failed:\n${e.stdout || ""}${e.stderr || ""}`);
  }
});
