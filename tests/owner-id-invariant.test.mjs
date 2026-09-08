import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Wires scripts/check-owner-id-invariant.mjs into `npm test`. It was run by hand,
 * which means it was run when someone remembered — and the class it catches
 * (a writer that works on a draft and is refused forever once the owner signs up)
 * is invisible until an owner reports it days later.
 *
 * PROVEN TO GO RED, both halves, 2026-09-08:
 *   1. deleted `p_owner_id: ownerUid || null,` from the create_business_document
 *      payload at hubly_capability_registry.ts:523 -> exit 1,
 *      "FAIL ...:512 — create_business_document payload has no p_owner_id."
 *   2. deleted "places.add" from DRAFT_INJECTED_ACTIONS -> exit 1,
 *      "FAIL places.add reads the injected owner but is NOT in DRAFT_INJECTED_ACTIONS."
 *   Both restored via `git checkout --`; md5 back to the baseline, tree clean.
 */
test("every owner-authorised RPC payload carries p_owner_id, and every handler reading it is injected", () => {
  try {
    execFileSync("node", [path.join(ROOT, "scripts/check-owner-id-invariant.mjs")], {
      encoding: "utf8", stdio: "pipe",
    });
  } catch (e) {
    assert.fail(`check-owner-id-invariant.mjs failed:\n${e.stdout || ""}${e.stderr || ""}`);
  }
});
