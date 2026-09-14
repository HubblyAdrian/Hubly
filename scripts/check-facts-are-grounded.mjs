#!/usr/bin/env node
/**
 * NEVER PUBLISH A FACT THE OWNER DID NOT STATE — asserted, for the first time.
 *
 *   node scripts/check-facts-are-grounded.mjs
 *
 * The assertions live in scripts/lib/facts-grounded.check.ts and run under DENO: the registry
 * imports over https and Node's ESM loader will not take it. This wrapper exists so `npm test`
 * can run it, and so a missing Deno is reported as CANNOT RUN rather than as a pass.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN (never reported as either)
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = join(ROOT, "scripts/lib/facts-grounded.check.ts");

try {
  const out = execFileSync("deno", ["run", "--allow-read", "--allow-env", "--allow-net", CHECK],
    { encoding: "utf8", stdio: "pipe", cwd: ROOT });
  process.stdout.write(out);
  process.exit(0);
} catch (e) {
  const status = typeof e.status === "number" ? e.status : null;
  const text = (e.stdout || "") + (e.stderr || "");
  if (status === 1) { process.stdout.write(text); process.exit(1); }
  console.error("CANNOT RUN — deno could not execute the check: " + text.slice(0, 500));
  process.exit(2);
}
