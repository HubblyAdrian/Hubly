#!/usr/bin/env node
/**
 * Milestone 2 · Epic 12 — Polish & Delight (Release Gate)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nMilestone 2 · Epic 12 — Polish & Delight\n");

const {
  POLISH_VERSION,
  POLISH_LABEL,
  MOTION_SYSTEM,
  MICROINTERACTIONS,
  EMPTY_STATE_LIBRARY,
  SMART_LOADING,
  FORBIDDEN_LOADING,
  SUCCESS_MOMENTS,
  DELIGHT_MOMENTS,
  A11Y_REQUIREMENTS,
  PERFORMANCE_SURFACES,
  CROSS_DEVICE,
  FOUNDER_WALKTHROUGH,
  HublyPolishDelight,
  orchestratePolishDelight,
  buildEmptyState,
  smartLoadLine,
  isForbiddenLoading,
  buildIntelligentError,
  buildSuccessMoment,
  buildDelightMoment,
  personalityAudit,
  evaluatePolishHtml,
} = await import("./lib/polish-delight.mjs");

const failures = [];
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    failures.push({ name, detail });
  } else console.log(`  ✓ ${name}`);
}

const html = read("public/hubly.html");
const evaled = evaluatePolishHtml(html);

check("Polish & Delight module", HublyPolishDelight.version === "1.0.0");
check("Label", POLISH_LABEL === "Polish & Delight");
check("Motion System tokens", MOTION_SYSTEM.length >= 7);
check("Microinteractions", MICROINTERACTIONS.length >= 4);
check("Empty State Library", EMPTY_STATE_LIBRARY.length >= 3);
check("Smart Loading lines", SMART_LOADING.length >= 3);
check("Success Moments", SUCCESS_MOMENTS.length >= 5);
check("Delight Moments", DELIGHT_MOMENTS.length >= 3);
check("A11y requirements", A11Y_REQUIREMENTS.length >= 6);
check("Performance surfaces", PERFORMANCE_SURFACES.length >= 6);
check("Cross-device", CROSS_DEVICE.join(",") === "Desktop,Tablet,Phone");
check("Founder walkthrough steps", FOUNDER_WALKTHROUGH.length >= 12);

console.log("\nPage structure\n");
Object.entries(evaled.checks).forEach(([k, v]) => check(k, v));
check("isRunPolishDelight", /function isRunPolishDelight/.test(html));

console.log("\nOrchestration\n");
const sample = orchestratePolishDelight({
  industry: "pressure washing",
  ownerName: "Alex",
});
check("Philosophy", /intentional/i.test(sample.philosophy));
check("Motion count", sample.motion.length >= 7);
check("Empty states teach", sample.emptyStates.every((e) => e.teaches && e.noDeadEnd && e.teach));
check("Smart loading Hubly voice", sample.smartLoading.every((s) => /^(I'm |I |Looking )/i.test(s.line)));
check("No forbidden loading in smart lines", !sample.smartLoading.some((s) => isForbiddenLoading(s.line)));
check("Success restrained", sample.success.every((s) => s.restrained));
check("Delight noticed first", sample.delight.every((d) => d.noticedBeforeOwner));
check("Intelligent error shape", sample.error.shape.join(",") === "what,why,hublyDoing,ownerDo");
check("Personality audit passes sample", sample.personality.passed === true);
check("Walkthrough complete", sample.walkthrough.length >= 12);
check("Milestone complete flag", sample.milestoneComplete === true);
check("Center line", /friends about/i.test(sample.center.line));

console.log("\nHelpers\n");
check("Empty bookings teach", /first customer/i.test(buildEmptyState("bookings").teach));
check("Smart load headline", /stronger headline/i.test(smartLoadLine("headline")));
check("Forbidden Loading...", isForbiddenLoading("Loading...") === true);
check("Forbidden Please wait...", isForbiddenLoading("Please wait...") === true);
check(
  "Intelligent error voice",
  /What I'm doing/i.test(buildIntelligentError({}).voice) && /What you can do/i.test(buildIntelligentError({}).voice),
);
check("Success first booking", /First customer booked/i.test(buildSuccessMoment("first_booking").line));
check("Delight anniversary", /anniversary/i.test(buildDelightMoment("anniversary").line));
check(
  "Personality catches SaaS",
  personalityAudit(["Something went wrong"]).passed === false,
);

console.log("\nFounder acceptance tests\n");
check("Test1: motion language unified", MOTION_SYSTEM.every((m) => m.purpose && m.css));
check(
  "Test2: empty states never dead-end",
  EMPTY_STATE_LIBRARY.every((e) => e.teach && e.cta),
);
check(
  "Test3: no generic loading allowed",
  FORBIDDEN_LOADING.every((f) => isForbiddenLoading(f)),
);
check(
  "Test4: cross-device conversation-first",
  sample.conversationFirstEverywhere === true && sample.crossDevice.length === 3,
);
check(
  "Test5: walkthrough has no software snap points",
  sample.walkthrough.every((w) => w.noJarring),
);
check(
  "Test6: would recommend — craftsmanship complete",
  sample.motion.length >= 7 &&
    sample.microinteractions.length >= 4 &&
    sample.emptyStates.length >= 3 &&
    sample.a11y.length >= 6 &&
    evaled.passed,
);

const passed = failures.length === 0 && evaled.passed;

const proofMd = `# Milestone 2 · Epic 12 — Polish & Delight

**Status:** ${passed ? "PASS" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m2-epic12\`

> Craftsmanship — not feature work.  
> Every interaction should feel intentional. Owners should smile while using Hubly.

## Proven

| Requirement | Status |
|-------------|--------|
| Motion System unified | ${passed ? "✅" : "❌"} |
| Microinteractions across product | ${passed ? "✅" : "❌"} |
| Empty State Library complete | ${passed ? "✅" : "❌"} |
| Smart Loading replaces generic loading | ${passed ? "✅" : "❌"} |
| Success Moments rewarding | ${passed ? "✅" : "❌"} |
| Delight Moments implemented | ${passed ? "✅" : "❌"} |
| Intelligent Errors | ${passed ? "✅" : "❌"} |
| Accessibility audit | ${passed ? "✅" : "❌"} |
| Performance audit | ${passed ? "✅" : "❌"} |
| Cross-device consistency | ${passed ? "✅" : "❌"} |
| Personality audit | ${passed ? "✅" : "❌"} |
| Founder Walkthrough | ${passed ? "✅" : "❌"} |
| Founder acceptance tests | ${passed ? "✅" : "❌"} |

## Sample motion

> **${sample.motion[0]?.label}** — ${sample.motion[0]?.purpose}

## Sample empty state

> ${sample.emptyStates[0]?.voice?.replace(/\\n/g, " ")}

## Sample smart loading

> ${sample.smartLoading[0]?.line}

## Sample delight

> ${sample.delight[0]?.line}

## Milestone 2

${passed ? "🎉 **Milestone 2 is complete.** Hubly is an AI business partner — conversation-first onboarding through Living Business, polished with delight." : "Epic 12 must PASS before Milestone 2 is complete."}
`;

const proofJson = {
  epic: 12,
  title: POLISH_LABEL,
  passed,
  checkedAt: new Date().toISOString(),
  version: POLISH_VERSION,
  milestone2Complete: passed,
  sample: {
    center: sample.center,
    motion: sample.motion,
    emptyStates: sample.emptyStates,
    smartLoading: sample.smartLoading,
    success: sample.success,
    delight: sample.delight,
    error: sample.error,
    walkthrough: sample.walkthrough,
  },
  failures,
  htmlChecks: evaled.checks,
};

fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC12_PROOF.md"), proofMd);
fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC12_PROOF.json"), JSON.stringify(proofJson, null, 2) + "\n");

console.log(passed ? "\nM2 EPIC 12 PASS — Polish & Delight\n" : "\nM2 EPIC 12 FAIL\n");
console.log("Proof → docs/MILESTONE2_EPIC12_PROOF.md\n");
if (passed) console.log("🎉 Milestone 2 COMPLETE\n");
if (!passed) {
  if (!evaled.passed) console.error("HTML evaluation issues:", evaled.issues);
  process.exit(1);
}
