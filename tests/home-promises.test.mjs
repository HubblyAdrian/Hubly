import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Wires scripts/check-home-promises.mjs into `npm test`.
 *
 * Every action card and suggested question on the owner's home screen names the
 * capability behind it, and this fails the build when that capability is gone. It exists
 * because "Set your hours" sat in the gaps panel for weeks offering owners a fix no
 * capability could make — found by clicking it on a real business, never by reading.
 *
 * PROVEN TO GO RED 2026-09-08 by pointing one chip's cap at 'business.setHours' (a real
 * capability that does not exist — the exact defect it guards): exit 1,
 * "q-service promises business.setHours". Restored; byte-identical; re-run exit 0.
 */
test("every home promise has a capability behind it", () => {
  try {
    execFileSync("node", [path.join(ROOT, "scripts/check-home-promises.mjs")], {
      encoding: "utf8", stdio: "pipe",
    });
  } catch (e) {
    assert.fail(`check-home-promises.mjs failed:\n${e.stdout || ""}${e.stderr || ""}`);
  }
});
