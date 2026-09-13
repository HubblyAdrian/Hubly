/**
 * EVERY CHECK PRINTS WHAT IT ACTUALLY READ.
 *
 * Five instrument failures in one week, every one caught by a human noticing the answer was
 * implausible — which is attention, not method, and attention does not survive a long night:
 *
 *   1. nav audit v1 read the wrong file and reported 0 renderers for 25 working screens
 *   2. nav audit v2 walked one level and reported 0 database reads
 *   3. two reporters read one .jsonl under near-identical headers; 103 became 19
 *   4. check-computed-and-dropped resolved paths against its OWN repo root, so a red-proof
 *      parsed the real file twice and passed
 *   5. the same check's string escape hatch regexed raw source and was satisfied by the
 *      deletion comment naming the property it was meant to catch
 *
 * Failures 1 and 4 die instantly under one rule: SAY WHAT YOU OPENED. Absolute path, byte
 * count, content hash. A red-proof additionally declares which file it MEANT to read
 * differently, and the run FAILS if the hashes match when they were supposed to differ —
 * that is failure 4 caught mechanically instead of by eye.
 *
 *   import { receipt, expectDifferent } from "./lib/read-receipt.mjs";
 *   const src = receipt(path);                       // prints, returns the text
 *   expectDifferent(mutatedPath, baselinePath);      // exits 2 if they are the same bytes
 */
import { readFileSync, statSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const seen = new Map();

/** Read a file and print the receipt. Returns its contents. */
export function receipt(path, label = "read") {
  const abs = realpathSync(resolve(path));
  const text = readFileSync(abs, "utf8");
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 12);
  const bytes = statSync(abs).size;
  seen.set(abs, hash);
  console.log(`  [${label}] ${abs}  ${bytes}B  sha256:${hash}`);
  return text;
}

/** A red-proof's own postcondition: the mutated input must not be the baseline file.
 *  Exits 2 — CANNOT RUN, never a pass — when they are the same bytes. */
export function expectDifferent(mutatedPath, baselinePath) {
  const a = realpathSync(resolve(mutatedPath)), b = realpathSync(resolve(baselinePath));
  const ha = createHash("sha256").update(readFileSync(a, "utf8")).digest("hex").slice(0, 12);
  const hb = createHash("sha256").update(readFileSync(b, "utf8")).digest("hex").slice(0, 12);
  console.log(`  [red-proof] mutated ${a} sha256:${ha}`);
  console.log(`  [red-proof] baseline ${b} sha256:${hb}`);
  if (a === b || ha === hb) {
    console.error(`\nCANNOT RUN — the red-proof read the SAME BYTES it was meant to mutate.\n` +
      `A red-proof that passes on identical input is a result about the instrument, not the code.`);
    process.exit(2);
  }
  return true;
}

/** What this process has opened, for a check's own summary line. */
export function readSoFar() { return [...seen.entries()].map(([p, h]) => `${p} sha256:${h}`); }
