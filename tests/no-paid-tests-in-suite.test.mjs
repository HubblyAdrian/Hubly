/**
 * NO TEST IN THE DEFAULT SUITE MAY SPEND MODEL QUOTA.
 *
 * `npm test` used to run check-name-is-asked.mjs, which drives the live endpoint and
 * creates three real businesses with three generated websites. So an ordinary test run
 * cost money and left rows behind, and nothing said so. On 2026-09-09 the price of that
 * became concrete: ~35 signups drain a full OpenAI top-up, and draining it takes signup
 * AND the customer chat on every live business site down until someone notices.
 *
 * A suite that spends money is not a suite. This is the guard for the CLASS, not the one
 * file that was removed: it fails if any test reachable from `npm test` spawns a script
 * that calls a model-backed endpoint. Paid checks are opt-in — `npm run check:signup`,
 * `npm run measure:build-rate` — and print their price before spending it.
 */
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Endpoints that reach a model. Adding one here is cheaper than discovering it on a bill.
const PAID = [
  "functions/v1/hubly-conversation",
  "functions/v1/hubly-brain",
  "functions/v1/generate-site",
  "functions/v1/chatbot-message",
  "functions/v1/hubly-build-business",
  "functions/v1/hubly-find-pro",
  "functions/v1/analyze-photos",
  "functions/v1/ai-advisor",
  "functions/v1/mission-control",
];

function isPaid(file) {
  let src;
  try { src = readFileSync(file, "utf8"); } catch { return false; }
  return PAID.some((p) => src.includes(p));
}

test("no test in the default suite spends model quota", () => {
  const offenders = [];
  const SELF = path.basename(fileURLToPath(import.meta.url));  // this file lists the endpoints
  for (const name of readdirSync(path.join(ROOT, "tests")).filter((f) => f.endsWith(".test.mjs") && f !== SELF)) {
    const testFile = path.join(ROOT, "tests", name);
    const src = readFileSync(testFile, "utf8");

    if (isPaid(testFile)) offenders.push(`${name} — calls a model endpoint directly`);

    // ...and any checker it spawns.
    for (const m of src.matchAll(/scripts\/([A-Za-z0-9._-]+\.mjs)/g)) {
      if (isPaid(path.join(ROOT, "scripts", m[1]))) {
        offenders.push(`${name} — runs scripts/${m[1]}, which calls a model endpoint`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    `These are in \`npm test\` and cost real money every run:\n  ${offenders.join("\n  ")}\n` +
    `Move them out of tests/ and expose them as an opt-in npm script that prints its price.`);
});
