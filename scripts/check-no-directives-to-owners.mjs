#!/usr/bin/env node
/**
 * A MODEL DIRECTIVE MUST NEVER REACH AN OWNER.
 *
 * Some capability results are consumed by the model, which composes a reply from them —
 * "say that plainly" is correct there. Others are handed to the owner VERBATIM:
 * hubly-conversation builds `primaryReply` as `photoTruth || servicesTruth ||
 * contactHoursTruth || …`, and those come straight from a summary string.
 *
 * On 2026-09-09 the photo path was shipping this to owners, word for word:
 *   "…there's no open spot for it on the page as it's built — do NOT claim it is
 *    showing; offer to rebuild the page around it…"
 * The same session had already caught a capability-result blob reaching a customer
 * stored with role 'customer'. This is that class, in the reply channel.
 *
 * SO THIS TESTS THE COMPOSED OUTPUT, NOT THE TEMPLATE. It runs composeServicesTruth
 * over every branch and reads the actual strings, and it reads the literal summaries
 * that feed the verbatim channel.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN (never reported as either)
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = join(ROOT, "scripts/lib/no-directives.check.ts");

let out;
try {
  out = execFileSync("deno", ["run", "--allow-read", "--allow-env", "--allow-net", CHECK],
    { encoding: "utf8", stdio: "pipe", cwd: ROOT });
} catch (e) {
  const status = typeof e.status === "number" ? e.status : null;
  const text = (e.stdout || "") + (e.stderr || "");
  if (status === 1 || status === 2) { process.stdout.write(text); process.exit(status); }
  console.error("CANNOT RUN — deno could not execute the check: " + text.slice(0, 400));
  process.exit(2);
}
process.stdout.write(out);
process.exit(0);
