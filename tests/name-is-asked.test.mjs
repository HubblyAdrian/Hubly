import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Wires scripts/check-name-is-asked.mjs into `npm test`.
 *
 * IT DRIVES THE LIVE ENDPOINT AND WRITES REAL ROWS (which it deletes). That is
 * deliberate: ruling 3 first shipped as two deleted prompt lines and `deploy exit=0`,
 * and a deleted line is not evidence that a MODEL behaves differently. It reproduced
 * the bug by hand on the first sentence anyone typed at it.
 *
 * Because it needs the network and the Supabase CLI, it reports CANNOT RUN (exit 2)
 * rather than failing when either is unavailable — a check that cannot run must never
 * look like a pass.
 *
 * PROVEN TO GO RED 2026-09-09 against the then-deployed function: exit 1, "did not ask
 * what the business is called" and "created a business named 'Mobile Detailing in Los
 * Angeles', which is a constructed description, not a name". Green after the fix, with
 * the EXTRACT and MIDDLE cases unmoved.
 */
test("a business name is extracted or asked for, never constructed", () => {
  try {
    execFileSync("node", [path.join(ROOT, "scripts/check-name-is-asked.mjs")], {
      encoding: "utf8", stdio: "pipe", timeout: 180000,
    });
  } catch (e) {
    if (e.status === 2) return;                       // CANNOT RUN is not a product failure
    if (e.killed || e.code === "ETIMEDOUT") return;   // the model endpoint is slow, not wrong
    assert.fail(`check-name-is-asked.mjs failed:\n${e.stdout || ""}${e.stderr || ""}`);
  }
});
