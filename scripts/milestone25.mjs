#!/usr/bin/env node
/**
 * Milestone 2.5 — Production Cutover runner
 * Runs M1 + M1.5 + M2 + cutover wiring gate.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const steps = [
  { name: "Milestone 1", cmd: ["npm", "run", "milestone1"] },
  { name: "Milestone 1.5", cmd: ["npm", "run", "milestone15"] },
  { name: "Milestone 2", cmd: ["npm", "run", "milestone2"] },
  { name: "Cutover wiring", cmd: ["npm", "run", "check:m25-cutover"] },
];

console.log("\n🏔️  Milestone 2.5 — Production Cutover\n");

const results = [];
for (const step of steps) {
  console.log(`\n── ${step.name} ──\n`);
  const r = spawnSync(step.cmd[0], step.cmd.slice(1), { cwd: root, stdio: "inherit", env: process.env });
  const ok = r.status === 0;
  results.push({ name: step.name, ok });
  if (!ok) {
    console.error(`\nFAIL at ${step.name}\n`);
    break;
  }
}

const passed = results.length === steps.length && results.every((r) => r.ok);
const gate = {
  milestone: "2.5",
  name: "Production Cutover",
  passed,
  wiringOnly: true,
  phaseE: "pending_founder_live",
  definitionOfDone:
    "A brand-new customer can go from hubly.app to a fully launched business without ever realizing there was an old product.",
  results,
  checkedAt: new Date().toISOString(),
  note: "Phase E Founder Certification on live hubly.app is required before Milestone 3. See docs/MILESTONE25_CUTOVER_REPORT.md",
};
fs.writeFileSync(path.join(root, "docs/MILESTONE25_RELEASE_GATE.json"), JSON.stringify(gate, null, 2) + "\n");

console.log("\nOverall");
console.log(passed ? "Ready (wiring A–D)" : "Not ready");
console.log(`(${results.filter((r) => r.ok).length}/${steps.length} gates)\n`);
console.log("Phase E Founder Certification: ⬜ pending live hubly.app");
console.log("Sign-off doc → docs/MILESTONE25_CUTOVER_REPORT.md\n");
process.exit(passed ? 0 : 1);
