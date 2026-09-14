#!/usr/bin/env node
/**
 * A COMPOSED SENTENCE MAY NOT OFFER A DOOR THAT DOES NOT EXIST.
 *
 *   node scripts/check-doors-offered-exist.mjs
 *
 * Assertions in scripts/lib/doors-offered.check.ts, run under DENO because the registry imports
 * over https. This wrapper exists so `npm test` can run it and so a missing Deno is CANNOT RUN
 * rather than a pass.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.stdout.write(execFileSync("deno", ["run", "--allow-read", "--allow-env", "--allow-net", join(ROOT, "scripts/lib/doors-offered.check.ts")],
    { encoding: "utf8", stdio: "pipe", cwd: ROOT }));
  process.exit(0);
} catch (e) {
  const status = typeof e.status === "number" ? e.status : null;
  const text = (e.stdout || "") + (e.stderr || "");
  if (status === 1) { process.stdout.write(text); process.exit(1); }
  console.error("CANNOT RUN — deno could not execute the check: " + text.slice(0, 400));
  process.exit(2);
}
