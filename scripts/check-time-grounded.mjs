#!/usr/bin/env node
/**
 * A JOB'S TIME IS GROUNDED IN WHAT HE ACTUALLY SAID, OR IT IS NOT WRITTEN.
 *
 *   node scripts/check-time-grounded.mjs
 *
 * Assertions in scripts/lib/time-grounding.check.ts, run under DENO because the grounding
 * module is Deno TypeScript. This wrapper exists so `npm test` can run it and so a missing
 * Deno is CANNOT RUN rather than a pass.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.stdout.write(execFileSync("deno", ["run", "--allow-read", join(ROOT, "scripts/lib/time-grounding.check.ts")],
    { encoding: "utf8", stdio: "pipe", cwd: ROOT }));
  process.exit(0);
} catch (e) {
  const status = typeof e.status === "number" ? e.status : null;
  const text = (e.stdout || "") + (e.stderr || "");
  if (status === 1) { process.stdout.write(text); process.exit(1); }
  console.error("CANNOT RUN — deno could not execute the check: " + text.slice(0, 400));
  process.exit(2);
}
