import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Wires scripts/check-destructive-confirm.mjs into `npm test`.
 *
 * PROVEN TO GO RED 2026-09-08: deleted the refuseIfClassicSite() call from
 * website.setChrome -> exit 1, "website.setChrome can replace a live page but never
 * calls refuseIfClassicSite()", consulting 3 (must be 4). Restored; md5 back to
 * eb31c099476bacfe415257c5e3e067a5.
 *
 * A first draft of the checker reported generateDocument as a violation because its
 * handler is a one-line delegate to runDocumentGeneration(), where the gate lives.
 * That was the checker misreading a VALID form as a defect — the failure mode that
 * previously produced duplicate p_owner_id keys — so it now follows one level of
 * delegation instead of being relaxed.
 */
test("every destructive website action asks what the owner would lose", () => {
  try {
    execFileSync("node", [path.join(ROOT, "scripts/check-destructive-confirm.mjs")], {
      encoding: "utf8", stdio: "pipe",
    });
  } catch (e) {
    assert.fail(`check-destructive-confirm.mjs failed:\n${e.stdout || ""}${e.stderr || ""}`);
  }
});
