#!/usr/bin/env node
/**
 * Section 16 — Validation & Quality Assurance (Release Gate)
 *
 * Not unit tests. Intelligence validation.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runQualityGate,
  SCENARIO_LIBRARY,
  FOUNDER_BENCHMARK_SUITE,
  BUSINESS_GENERATION_INDUSTRIES,
  QUALITY_VERSION,
  QUALITY_OWNER,
  getQualityManifest,
  getQualityScoreSnapshot,
  clearQualityForTests,
  ensureQualityBound,
  HublyQuality,
} from "./lib/quality.mjs";

import { clearMissionControlForTests, getMissionControlSnapshot } from "./lib/mission-control.mjs";
import { clearRegistryForTests } from "./lib/expert-framework.mjs";
import { clearRegistriesForTests } from "./lib/registries.mjs";
import { resetExpertsForTests, ensureExpertsRegistered } from "./lib/initial-experts.mjs";
import { clearReliabilityForTests } from "./lib/reliability.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nSection 16 — Validation & Quality Assurance\n");
console.log("Running full intelligence validation suite…\n");

clearQualityForTests();
clearReliabilityForTests();
clearRegistriesForTests();
clearRegistryForTests();
clearMissionControlForTests();
resetExpertsForTests();
ensureExpertsRegistered();
ensureQualityBound();

const report = await runQualityGate();

const failures = [];
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    failures.push({ name, detail });
  } else {
    console.log(`  ✓ ${name}`);
  }
}

check("quality module versioned", QUALITY_VERSION === "1.0.0" && QUALITY_OWNER === "hubly_brain");
check("Scenario Library exists", SCENARIO_LIBRARY.length >= 8, `n=${SCENARIO_LIBRARY.length}`);
check("Founder Benchmark Suite exists", FOUNDER_BENCHMARK_SUITE.length >= 8, `n=${FOUNDER_BENCHMARK_SUITE.length}`);
check("multi-industry set covers 6 businesses", BUSINESS_GENERATION_INDUSTRIES.length >= 6);

const suiteNames = [
  "brain",
  "experts",
  "memory",
  "business_generation",
  "multi_industry",
  "identity",
  "capabilities",
  "security",
  "performance",
];
for (const name of suiteNames) {
  const suite = report.suites.find((s) => s.suite === name);
  check(`${name} validation passes`, !!suite && suite.ok, suite ? `${suite.passed}/${suite.passed + suite.failed}` : "missing");
}

check("Scenario Library all pass", report.scenarioLibrary.failed === 0, `${report.scenarioLibrary.passed}/${report.scenarioLibrary.total}`);
check("Founder Benchmarks all pass", report.founderBenchmarks.failed === 0, `${report.founderBenchmarks.passed}/${report.founderBenchmarks.total}`);
check("Quality Score reported", report.qualityScore.overall >= 85, `overall=${report.qualityScore.overall}`);
check("Quality dimensions complete", Object.keys(report.qualityScore.dimensions).length === 8);
check("Identity compliance reported", report.identityCompliance.rate >= 75, `rate=${report.identityCompliance.rate}`);
check("full suite ok", report.ok === true);

// Mission Control surfaces Quality Score
const snap = getMissionControlSnapshot();
check("Mission Control qualityAssurance present", !!snap.qualityAssurance?.score);
check("Mission Control score matches run", snap.qualityAssurance.score.overall === report.qualityScore.overall);
check("Mission Control identity compliance", snap.qualityAssurance.identityComplianceRate === report.identityCompliance.rate);

// Source wiring
check("quality source exists", fs.existsSync(path.join(root, "supabase/functions/_shared/hubly_brain_quality.ts")));
check("docs exist", fs.existsSync(path.join(root, "docs/HUBLY_BRAIN_SECTION16.md")));
const ai = read("supabase/functions/_shared/hubly_ai.ts");
check("HublyAI exports HublyQuality", /HublyQuality/.test(ai));
const mc = read("supabase/functions/_shared/hubly_brain_mission_control.ts");
check("Mission Control wires qualityAssurance", /qualityAssurance/.test(mc));
check("manifest lists regression suites", getQualityManifest().suites.includes("founder_benchmarks"));
check("HublyQuality API bound", typeof HublyQuality.runFull === "function");
check("score snapshot available", getQualityScoreSnapshot().overall === report.qualityScore.overall);

if (failures.length) {
  console.error(`\nFAILED ${failures.length} check(s)\n`);
  for (const s of report.suites.filter((x) => !x.ok)) {
    console.error(`Suite ${s.suite} failures:`);
    for (const c of s.cases.filter((x) => !x.ok)) {
      console.error(`  - ${c.id}: ${c.detail}`);
    }
  }
  if (report.scenarioLibrary.failed) {
    for (const c of report.scenarioLibrary.results.filter((x) => !x.ok)) {
      console.error(`Scenario ${c.id}: ${c.detail}`);
    }
  }
  if (report.founderBenchmarks.failed) {
    for (const c of report.founderBenchmarks.results.filter((x) => !x.ok)) {
      console.error(`Benchmark ${c.id}: ${c.detail}`);
    }
  }
  process.exit(1);
}

const proof = {
  section: 16,
  name: "Validation & Quality Assurance",
  title: "Validation & Quality Assurance",
  status: "pass",
  passed: true,
  provenAt: new Date().toISOString(),
  summary:
    "Intelligence validation suite: Brain, Experts, Memory, Business Generation, Multi-Industry, Identity, Capabilities, Security, Performance, Scenario Library, Founder Benchmark Suite, and Mission Control Quality Score.",
  proofs: {
    suites: report.suites.map((s) => ({
      suite: s.suite,
      ok: s.ok,
      passed: s.passed,
      failed: s.failed,
    })),
    scenarioLibrary: {
      total: report.scenarioLibrary.total,
      passed: report.scenarioLibrary.passed,
      failed: report.scenarioLibrary.failed,
      ids: SCENARIO_LIBRARY.map((s) => s.id),
    },
    founderBenchmarks: {
      total: report.founderBenchmarks.total,
      passed: report.founderBenchmarks.passed,
      failed: report.founderBenchmarks.failed,
      ids: FOUNDER_BENCHMARK_SUITE.map((b) => b.id),
    },
    identityCompliance: report.identityCompliance,
    decisionValidation: report.suites.find((s) => s.suite === "brain")?.cases
      .filter((c) => /decision|reasoning/.test(c.id))
      .map((c) => ({ id: c.id, ok: c.ok })),
    expertValidation: {
      passed: report.suites.find((s) => s.suite === "experts")?.passed,
      failed: report.suites.find((s) => s.suite === "experts")?.failed,
    },
    memoryValidation: {
      passed: report.suites.find((s) => s.suite === "memory")?.passed,
      failed: report.suites.find((s) => s.suite === "memory")?.failed,
    },
    performance: report.performance,
    qualityScore: report.qualityScore,
    missionControl: {
      overall: snap.qualityAssurance.score.overall,
      dimensions: snap.qualityAssurance.score.dimensions,
    },
    regressionSuite: true,
    hublyAiExportsQuality: true,
  },
};

fs.writeFileSync(
  path.join(root, "docs/HUBLY_BRAIN_SECTION16_PROOF.json"),
  JSON.stringify(proof, null, 2) + "\n",
);

console.log("\nQuality Score:", report.qualityScore.overall);
console.log("  ", Object.entries(report.qualityScore.dimensions).map(([k, v]) => `${k}=${v}`).join("  "));
console.log("\nWrote docs/HUBLY_BRAIN_SECTION16_PROOF.json");
console.log("Section 16 PASS\n");
process.exit(0);
