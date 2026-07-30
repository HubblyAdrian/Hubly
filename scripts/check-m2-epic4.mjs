#!/usr/bin/env node
/**
 * Milestone 2 · Epic 4 — Hubly Architect (Recommend → Build → Show)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nMilestone 2 · Epic 4 — Hubly Architect\n");

const {
  CREATIVE_BUILD_VERSION,
  CREATIVE_BUILD_LABEL,
  CREATIVE_BUILD_TRANSITION,
  CREATIVE_BUILD_CHOICE_PROMPT,
  CREATIVE_BUILD_STAGES,
  HublyCreativeBuildExperience,
  orchestrateCreativeBuildExperience,
  creativeBuildExperiencesAreDistinct,
  applyInterruptToBuild,
  evaluateCreativeBuildHtml,
  conversationStrategy,
  inferArchitectIntent,
  ARCHITECT_INTENTS,
} = await import("./lib/creative-build-experience.mjs");

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
const evaled = evaluateCreativeBuildHtml(html);

check("Hubly Architect module", HublyCreativeBuildExperience.version === "2.0.0");
check("Label", CREATIVE_BUILD_LABEL === "Hubly Architect");
check("Version", CREATIVE_BUILD_VERSION === "2.0.0");
check("Seven stages", CREATIVE_BUILD_STAGES.length === 7);
check("Transition copy", CREATIVE_BUILD_TRANSITION.includes("proud of"));
check("Recommend three directions", /three directions/.test(CREATIVE_BUILD_CHOICE_PROMPT));
check("Three core intents", ARCHITECT_INTENTS.length === 3);

console.log("\nPage structure\n");
check("Creative Canvas exists", evaled.checks.creativeCanvas);
check("Conversation | Live Business layout", evaled.checks.conversationLive);
check("Progressive stages", evaled.checks.progressiveStages);
check("Live explanations", evaled.checks.liveExplanations);
check("Before/After moments", evaled.checks.beforeAfter);
check("Design confidence / % Built", evaled.checks.confidenceMeter);
check("Creative Decisions / checklist", evaled.checks.decisionsPanel);
check("Three-direction recommend choice", evaled.checks.dualChoice);
check("Live conversation interrupt + upload", evaled.checks.liveInterrupt);
check("Industry-specific building", evaled.checks.industrySpecific);
check("Behind-the-scenes collaboration", evaled.checks.behindScenes);
check("Proud transition copy", evaled.checks.transition);
check("Never says Build Complete", evaled.checks.noBuildComplete);
check("Thinking hands off to Creative Build", evaled.checks.thinkingHandoff);
check("Soft Reveal shell (Epic 5)", evaled.checks.revealShell);
check("Hubly brand on Creative Build", evaled.checks.wordmark);
check("Architect shell + strategy", evaled.checks.architectShell);
check("Recommend → Build → Show rhythm", evaled.checks.recommendBuildShow);
check(
  "Creative step markup",
  /id="is-step-creative-build"/.test(html) &&
    /data-creative-build-experience/.test(html) &&
    /data-hubly-architect/.test(html),
);

console.log("\nIndustry sequences\n");
const pw = orchestrateCreativeBuildExperience({ industryId: "pressure_washing" });
const photo = orchestrateCreativeBuildExperience({ industryId: "photography" });
const clean = orchestrateCreativeBuildExperience({ industryId: "cleaning" });
const hvac = orchestrateCreativeBuildExperience({ industryId: "hvac" });

check("Pressure washing sequence starts trust/structure", pw.sequence[0] === "structure" && pw.focus.includes("trust"));
check("Photography leads portfolio earlier", photo.sequence.indexOf("portfolio") < photo.sequence.indexOf("packages"));
check("Cleaning emphasizes recurring", clean.focus.includes("recurring") || clean.sequence[1] === "packages");
check("HVAC emphasizes booking/plans", hvac.sequence.includes("booking") && hvac.focus.includes("trust"));
check("Distinct industry builds", creativeBuildExperiencesAreDistinct(pw, photo));
check("All stages explained from reasoning", pw.stages.every((s) => s.explain && s.source === "strategy_creative_critic"));
check("No instant finished reveal", pw.fakeInstantReveal === false);
check("Three directions per pack", pw.directions?.length === 3 && pw.directions[0].id === "minimal");

console.log("\nFounder acceptance tests\n");
check(
  "Test1: feels like a designer (explanations + BTS + before/after)",
  pw.stages.some((s) => s.bts?.length) && pw.stages.every((s) => s.before && s.after),
);
check(
  "Test2: four industries build differently",
  creativeBuildExperiencesAreDistinct(pw, photo) &&
    creativeBuildExperiencesAreDistinct(clean, hvac) &&
    creativeBuildExperiencesAreDistinct(pw, clean),
);
const interrupted = applyInterruptToBuild(pw, "Make it more premium.");
check(
  "Test3: interrupt adapts naturally",
  interrupted.direction === "bold" && interrupted.updates.some((u) => /premium/i.test(u.text)),
);
check(
  "Test4: progressive stages (not sudden final site)",
  pw.stages.length === 7 && pw.sequence.length === 7,
);
check(
  "Test5: explanations from Strategy/Creative/Critic",
  pw.stages.every((s) => s.source === "strategy_creative_critic"),
);
check(
  "Test6: owner understands why (every stage has explain)",
  pw.stages.every((s) => String(s.explain).length > 20),
);
const strat = conversationStrategy({
  goal: "Build my business",
  milestone: "Choose a direction",
  showNow: "Three concepts",
  decision: "Pick Minimal, Bold, or Classic",
});
check(
  "Test7: conversation strategy shape",
  strat.goal && strat.milestone && strat.showNow && strat.decision,
);
check("Test8: intent inference — build", inferArchitectIntent("I want to open a storefront") === "build");
check("Test9: intent inference — grow", inferArchitectIntent("I need more customers and marketing") === "grow");
check(
  "Test10: intent inference — get something done",
  inferArchitectIntent("I need house cleaning this weekend") === "get_done",
);

const passed = failures.length === 0 && evaled.passed;

const proofMd = `# Milestone 2 · Epic 4 — Hubly Architect

**Status:** ${passed ? "PASS" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m2-epic4\`

> Recommend → Build → Show → Get Feedback → Improve  
> End: *${CREATIVE_BUILD_TRANSITION}*

## Proven

| Requirement | Status |
|-------------|--------|
| Architect shell (chat left / live right) | ${passed ? "✅" : "❌"} |
| Progressive stages | ${passed ? "✅" : "❌"} |
| Live explanations | ${passed ? "✅" : "❌"} |
| Before/After moments | ${passed ? "✅" : "❌"} |
| % Built / confidence | ${passed ? "✅" : "❌"} |
| Checklist / decisions | ${passed ? "✅" : "❌"} |
| Three-direction recommend | ${passed ? "✅" : "❌"} |
| Live interrupts + uploads | ${passed ? "✅" : "❌"} |
| Industry-specific builds | ${passed ? "✅" : "❌"} |
| Conversation strategy | ${passed ? "✅" : "❌"} |
| Three core intents | ${passed ? "✅" : "❌"} |
| Natural Reveal transition | ${passed ? "✅" : "❌"} |

## Industry sequences

- **Pressure Washing:** \`${pw.sequence.join(" → ")}\`
- **Photography:** \`${photo.sequence.join(" → ")}\`
- **Cleaning:** \`${clean.sequence.join(" → ")}\`
- **HVAC:** \`${hvac.sequence.join(" → ")}\`

## Transition

> ${CREATIVE_BUILD_TRANSITION}
`;

const proofJson = {
  epic: 4,
  title: CREATIVE_BUILD_LABEL,
  passed,
  checkedAt: new Date().toISOString(),
  version: CREATIVE_BUILD_VERSION,
  transition: CREATIVE_BUILD_TRANSITION,
  industries: {
    pressure_washing: { sequence: pw.sequence, confidence: pw.designConfidence },
    photography: { sequence: photo.sequence, confidence: photo.designConfidence },
    cleaning: { sequence: clean.sequence, confidence: clean.designConfidence },
    hvac: { sequence: hvac.sequence, confidence: hvac.designConfidence },
  },
  failures,
  htmlChecks: evaled.checks,
};

fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC4_PROOF.md"), proofMd);
fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC4_PROOF.json"), JSON.stringify(proofJson, null, 2) + "\n");

console.log(passed ? "\nM2 EPIC 4 PASS — Hubly Architect\n" : "\nM2 EPIC 4 FAIL\n");
console.log("Proof → docs/MILESTONE2_EPIC4_PROOF.md\n");

if (!passed) process.exit(1);
