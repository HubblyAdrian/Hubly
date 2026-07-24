#!/usr/bin/env node
/**
 * Milestone 2 · Epic 3 — Hubly Thinking Experience (Release Gate)
 *
 * Visible intelligence — not a progress bar.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nMilestone 2 · Epic 3 — Hubly Thinking Experience\n");

const {
  THINKING_VERSION,
  THINKING_LABEL,
  THINKING_TRANSITION,
  HublyThinkingExperience,
  orchestrateThinkingExperience,
  thinkingExperiencesAreDistinct,
  hasPercentageProgress,
  evaluateThinkingHtml,
  buildThinkingReasoningObjects,
} = await import("./lib/thinking-experience.mjs");

const failures = [];
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    failures.push({ name, detail });
  } else {
    console.log(`  ✓ ${name}`);
  }
}

const html = read("public/hubly.html");
const brain = read("supabase/functions/hubly-brain/index.ts");
const evaled = evaluateThinkingHtml(html);

check("Thinking module", HublyThinkingExperience.version === "1.0.0");
check("Label", THINKING_LABEL === "Hubly Thinking Experience");
check("Version", THINKING_VERSION === "1.0.0");
check("Transition copy", THINKING_TRANSITION.includes("strong direction"));

console.log("\nPage structure\n");
check("Thinking Canvas exists", evaled.checks.thinkingCanvas);
check("Live Expert Timeline", evaled.checks.expertTimeline);
check("Aha cards", evaled.checks.ahaCards);
check("Expert collaboration visible", evaled.checks.collaboration);
check("Understanding panel", evaled.checks.understandingPanel);
check("Stage-based progress (not %)", evaled.checks.stageProgress);
check("Why explanations", evaled.checks.whyExplain);
check("No percentage progress UI", evaled.checks.noPercent);
check("No spinner / loading copy", evaled.checks.noSpinner);
check("Natural build transition", evaled.checks.transition);
check("Orchestrator wired", evaled.checks.orchestrator);
check("No fake delay in Thinking handoff", evaled.checks.noFakeSleep);
check("Brain / reasoning driven", evaled.checks.brainDriven);
check("Emotion pacing", evaled.checks.emotionPacing);
check("Hubly brand on Thinking", evaled.checks.wordmark);
check(
  "Discovery still hands off to Thinking",
  /isDiscoveryCompleteToThinking|isRunThinkingExperience/.test(html),
);
check(
  "Thinking step markup",
  /id="is-step-thinking"/.test(html) && /is-thinking-canvas|data-thinking-experience/.test(html),
);
check(
  "Brain exposes thinking_experience payload",
  /thinking_experience|thinkingExperience/.test(brain) || /reasoningObjects/.test(brain),
);

console.log("\nReasoning objects\n");
const pw = orchestrateThinkingExperience({
  industryId: "pressure_washing",
  area: "Salt Lake City",
  positioning: "premium",
  facts: {
    industry: { value: "Pressure Washing", label: "Pressure Washing", confidence: 92 },
    area: { value: "Salt Lake City", label: "Salt Lake City", confidence: 85 },
    positioning: { value: "premium", label: "Premium positioning", confidence: 84 },
    customer: { value: "residential", label: "Residential focus", confidence: 80 },
    operations: { value: "mobile", label: "Mobile business", confidence: 75 },
    goal: { value: "recurring_customers", label: "Wants more recurring customers", confidence: 88 },
  },
});
const photo = orchestrateThinkingExperience({
  industryId: "photography",
  positioning: "premium",
  facts: {
    industry: { value: "Photography", label: "Photography", confidence: 92 },
    positioning: { value: "premium", label: "Premium positioning", confidence: 88 },
    customer: { value: "wedding_clients", label: "Wedding clients", confidence: 86 },
  },
});

check("Reasoning objects produced", (pw.reasoningObjects || []).length >= 2);
check("Aha from reasoning", pw.ahaCards.some((c) => c.fromReasoning && /Aha/i.test(c.title)));
check("Fake delay is zero", pw.fakeDelayMs === 0);
check(
  "No % in thinking copy",
  !hasPercentageProgress(JSON.stringify(pw.timeline) + JSON.stringify(pw.stages)),
);

console.log("\nFounder acceptance tests\n");
check(
  "Test1: owner learns something (insights present)",
  pw.ahaCards.length > 0 && pw.primaryWhy?.explanation?.length > 20,
);
check(
  "Test2: no spinners / skeleton / generic loading",
  !/Loading…|skeleton|Please wait/i.test(html.match(/id="is-step-thinking"[\s\S]*?id="is-step-vibe"/)?.[0] || ""),
);
check(
  "Test3: discovery moments / aha from real reasoning objects",
  buildThinkingReasoningObjects({ industryId: "pressure_washing" }).every((r) => r.decisionKey && r.explanation),
);
check(
  "Test4: pressure washing ≠ wedding photographer Thinking",
  thinkingExperiencesAreDistinct(pw, photo),
  `${pw.industryLabel} vs ${photo.industryLabel}`,
);
check(
  "Test5: fast completion still shows meaningful reasoning",
  pw.timeline.length >= 4 && pw.collaboration.length >= 3 && pw.transition === THINKING_TRANSITION,
);

const passed = failures.length === 0 && evaled.passed;

const proofMd = `# Milestone 2 · Epic 3 — Hubly Thinking Experience

**Status:** ${passed ? "PASS" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m2-epic3\`

> Replace every loading state with visible intelligence.  
> The owner should feel like they're watching experts work on their business.

## Proven

| Requirement | Status |
|-------------|--------|
| Thinking Canvas | ${passed ? "✅" : "❌"} |
| Live Expert Timeline (Brain reasoning) | ${passed ? "✅" : "❌"} |
| Discovery Moments / Aha from reasoning | ${passed ? "✅" : "❌"} |
| Expert collaboration visible | ${passed ? "✅" : "❌"} |
| Understanding panel updates | ${passed ? "✅" : "❌"} |
| Stage-based progress (no %) | ${passed ? "✅" : "❌"} |
| Why explanations | ${passed ? "✅" : "❌"} |
| No fake delays | ${passed ? "✅" : "❌"} |
| Natural Build transition | ${passed ? "✅" : "❌"} |
| Different industries → different Thinking | ${passed ? "✅" : "❌"} |
| Founder acceptance tests | ${passed ? "✅" : "❌"} |

## Transition

> ${THINKING_TRANSITION}

## Sample — Pressure Washing Aha

> ${pw.ahaCards[0]?.body || ""}  
> ${pw.ahaCards[0]?.why || ""}

## Sample — Photography Aha

> ${photo.ahaCards[0]?.body || ""}  
> ${photo.ahaCards[0]?.why || ""}

## Stop

Do **not** begin Epic 4 until Founder Approval.
`;

const proofJson = {
  epic: 3,
  title: THINKING_LABEL,
  passed,
  checkedAt: new Date().toISOString(),
  version: THINKING_VERSION,
  transition: THINKING_TRANSITION,
  distinctIndustries: thinkingExperiencesAreDistinct(pw, photo),
  samples: {
    pressure_washing: { signature: pw.signature, aha: pw.ahaCards[0], why: pw.primaryWhy },
    photography: { signature: photo.signature, aha: photo.ahaCards[0], why: photo.primaryWhy },
  },
  failures,
  htmlChecks: evaled.checks,
};

fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC3_PROOF.md"), proofMd);
fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC3_PROOF.json"), JSON.stringify(proofJson, null, 2) + "\n");

console.log(passed ? "\nM2 EPIC 3 PASS — Hubly Thinking Experience\n" : "\nM2 EPIC 3 FAIL\n");
console.log("Proof → docs/MILESTONE2_EPIC3_PROOF.md\n");

if (!passed) process.exit(1);
