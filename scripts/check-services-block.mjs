#!/usr/bin/env node
/**
 * A PAGE BUILT OUT OF PLACEHOLDERS STILL HAS A SERVICES SECTION.
 *
 * 120 of 159 generated pages carry a services section made of data-hubly-guess rows and
 * ZERO data-hubly-service anchors. allServiceAnchors() matches only the latter, so the
 * inserter reported "no services section" about a section visibly right there — and every
 * one of those owners was offered a full page rebuild the moment they typed a price, on
 * the signup path, before an account existed.
 *
 * The assertions live in scripts/lib/services-block.check.ts and run under DENO: the
 * registry imports over https and Node's ESM loader will not take it. This wrapper exists
 * so `npm test` can run it, and so a missing Deno is reported as CANNOT RUN rather than
 * as a pass.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN (never reported as either)
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = join(ROOT, "scripts/lib/services-block.check.ts");

let out;
try {
  out = execFileSync("deno", ["run", "--allow-read", "--allow-env", "--allow-net", CHECK],
    { encoding: "utf8", stdio: "pipe", cwd: ROOT });
} catch (e) {
  const status = typeof e.status === "number" ? e.status : null;
  const text = (e.stdout || "") + (e.stderr || "");
  if (status === 1) { process.stdout.write(text); process.exit(1); }
  if (status === 2) { process.stdout.write(text); process.exit(2); }
  console.error("CANNOT RUN — deno could not execute the check: " + text.slice(0, 400));
  process.exit(2);
}
process.stdout.write(out);
process.exit(0);
