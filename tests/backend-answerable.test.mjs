import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Wires scripts/check-backend-answerable.mjs into `npm test`.
 *
 * THE RULING: anything Hubly stores about a business, its owner must be able to ask
 * about. Every table classified `owner` in docs/backend-answerable.json must have a
 * slice that reads it, and every slice must name a real table — resolved THROUGH the
 * SQL functions, because counting a table name in application code counts a form and
 * missed eleven tables written only by SQL.
 *
 * The `--live` half (does the database hold a table the classification has never heard
 * of?) needs `supabase db query --linked` and is deliberately NOT run here. Run it by
 * hand: `node scripts/check-backend-answerable.mjs --live`. Last run 2026-09-08: 131
 * live tables, all classified, PASS.
 *
 * PROVEN TO GO RED 2026-09-08, twice, exit code read bare:
 *   - deleting the `customers` slice     -> exit 1, "customers has no slice that reads it"
 *   - adding an unread owner-facing table -> exit 1, "invoices_v2 has no slice that reads it"
 * Both restored byte-identical; re-run exit 0.
 */
test("every owner-facing table has a reader", () => {
  try {
    execFileSync("node", [path.join(ROOT, "scripts/check-backend-answerable.mjs")], {
      encoding: "utf8", stdio: "pipe",
    });
  } catch (e) {
    assert.fail(`check-backend-answerable.mjs failed:\n${e.stdout || ""}${e.stderr || ""}`);
  }
});
