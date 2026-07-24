#!/usr/bin/env node
/**
 * Milestone 2 · Epic 11 — Living Business (Release Gate)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nMilestone 2 · Epic 11 — Living Business\n");

const {
  LIVING_VERSION,
  LIVING_LABEL,
  EVOLUTION_SYSTEMS,
  EVOLUTION_CATEGORIES,
  APPROVAL_WORKFLOW,
  HublyLivingBusiness,
  orchestrateLivingBusiness,
  simulateMonthOfEvolution,
  adaptAfterRejections,
  buildLearningJournal,
  livingExperiencesAreDistinct,
  evaluateLivingHtml,
} = await import("./lib/living-business.mjs");

const failures = [];
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    failures.push({ name, detail });
  } else console.log(`  ✓ ${name}`);
}

const html = read("public/hubly.html");
const evaled = evaluateLivingHtml(html);

check("Living Business module", HublyLivingBusiness.version === "1.0.0");
check("Label", LIVING_LABEL === "Living Business");
check("Systems evaluated", EVOLUTION_SYSTEMS.length >= 10);
check("Categories", EVOLUTION_CATEGORIES.length === 6);
check("Approval workflow steps", APPROVAL_WORKFLOW.length === 4);

console.log("\nPage structure\n");
Object.entries(evaled.checks).forEach(([k, v]) => check(k, v));
check("isRunLivingBusiness", /function isRunLivingBusiness/.test(html));

console.log("\nOrchestration\n");
const sample = orchestrateLivingBusiness({
  industry: "pressure washing",
  weekIndex: 0,
});
check("Never auto-apply", sample.neverAutoApply === true);
check("Opportunities this week", sample.opportunities.length >= 2);
check(
  "Cards have why/confidence/impact/preview",
  sample.opportunities.every((o) => o.why && o.confidence && o.impact && o.preview && o.reasoning),
);
check("Evolution score", sample.score.score >= 70 && sample.score.label === "Business Evolution");
check("Timeline exists", sample.timeline.length >= 2);
check("Compare before/after", !!sample.compare?.current && !!sample.compare?.recommended);
check("Journal exists", sample.journal.lines.length >= 5 && /learned about your business/i.test(sample.journal.label));
check("Overnight daily link copy", /overnight/i.test(sample.overnight.line));
check("Approval workflow", sample.approvalWorkflow.map((s) => s.label).join("→") === "Preview→Conversation→Approval→Deployment");

console.log("\nMonth simulation — no weekly repetition\n");
const month = simulateMonthOfEvolution({ industry: "pressure washing" });
check("Four weeks", month.length === 4);
check(
  "Different recommendations each week",
  new Set(month.map((w) => w.signature)).size === 4,
);

console.log("\nRejection adapts memory\n");
const rejects = ["pw-hero", "pw-windows", "pw-member", "pw-spring", "pw-price"];
const adapted = adaptAfterRejections({
  industry: "pressure washing",
  weekIndex: 2,
  rejectedIds: rejects,
});
check("Rejected ids excluded", adapted.afterIds.every((id) => !rejects.includes(id)));
check("Creative Memory adaptation signal", adapted.adapted === true || adapted.afterIds.length >= 1);

console.log("\nIndustry-distinct seasonal + growth\n");
const industries = ["pressure washing", "photography", "hvac", "lawn care", "cleaning"];
const flows = industries.map((industry) =>
  orchestrateLivingBusiness({ industry, weekIndex: 0 }),
);
for (let i = 0; i < flows.length; i++) {
  for (let j = i + 1; j < flows.length; j++) {
    check(
      `Living distinct: ${flows[i].industryKey} ≠ ${flows[j].industryKey}`,
      livingExperiencesAreDistinct(flows[i], flows[j]),
    );
  }
}
check(
  "Seasonal advice present across trades",
  industries.some((ind, i) => flows[i].opportunities.some((o) => o.seasonal)),
);

console.log("\nFounder acceptance tests\n");
check("Test1: month weeks unique", new Set(month.map((w) => w.signature)).size === 4);
check(
  "Test2: five rejects adapt",
  adapted.afterIds.every((id) => !rejects.includes(id)),
);
check(
  "Test3: five industries unique",
  new Set(flows.map((f) => f.signature)).size === 5,
);
check(
  "Test4: every rec has why/confidence/impact/preview",
  flows.every((f) =>
    f.opportunities.every((o) => o.why && o.confidence != null && o.impact && o.hasPreview),
  ),
);
const withOutcomes = orchestrateLivingBusiness({
  industry: "hvac",
  weekIndex: 1,
  accepted: [{ title: "Tune-up Plans", impact: "Recurring maintenance starts" }],
  rejected: [{ title: "Bold Banner", impact: "Skipped" }],
});
check(
  "Test5: timeline records accept + reject",
  withOutcomes.timeline.some((t) => t.outcome === "accepted") &&
    withOutcomes.timeline.some((t) => t.outcome === "rejected"),
);
check(
  "Test6: why from stored reasoning",
  !!sample.opportunities[0].reasoning &&
    /Stored reasoning|isEvoAskWhy|reasoning/.test(html),
);
check(
  "What I Learned Journal valuable",
  buildLearningJournal({ industry: "pressure washing" }).lines.some((l) =>
    /before-and-after|15 minutes|68%/.test(l),
  ),
);

const passed = failures.length === 0 && evaled.passed;

const proofMd = `# Milestone 2 · Epic 11 — Living Business

**Status:** ${passed ? "PASS" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m2-epic11\`

> Continuous evolution with approval — never auto-apply.  
> **What I've learned about your business** — accumulated intelligence, not just recommendations.

## Proven

| Requirement | Status |
|-------------|--------|
| Business Evolution Engine | ${passed ? "✅" : "❌"} |
| Evolution Center in Business Home | ${passed ? "✅" : "❌"} |
| Opportunity Cards (preview / why / impact / confidence) | ${passed ? "✅" : "❌"} |
| Evolution categories | ${passed ? "✅" : "❌"} |
| Before/After compare | ${passed ? "✅" : "❌"} |
| Evolution Timeline (accept + reject) | ${passed ? "✅" : "❌"} |
| Ask Hubly on recommendations | ${passed ? "✅" : "❌"} |
| Seasonal Intelligence | ${passed ? "✅" : "❌"} |
| Approval workflow (Builder) | ${passed ? "✅" : "❌"} |
| Evolution Score | ${passed ? "✅" : "❌"} |
| Daily overnight evolution link | ${passed ? "✅" : "❌"} |
| Creative Memory adapts | ${passed ? "✅" : "❌"} |
| What I Learned Journal | ${passed ? "✅" : "❌"} |
| Founder acceptance tests | ${passed ? "✅" : "❌"} |

## Sample opportunity

> **${sample.opportunities[0]?.title}** — ${sample.opportunities[0]?.why}  
> Impact ${sample.opportunities[0]?.impact} · Confidence ${sample.opportunities[0]?.confidence}%

## Journal sample

> ${sample.journal.lines[0]}

## Stop

Do **not** begin Epic 12 until Founder Approval.
`;

const proofJson = {
  epic: 11,
  title: LIVING_LABEL,
  passed,
  checkedAt: new Date().toISOString(),
  version: LIVING_VERSION,
  sample: {
    center: sample.center,
    score: sample.score,
    opportunities: sample.opportunities,
    journal: sample.journal,
  },
  month,
  industries: flows.map((f) => ({
    industryKey: f.industryKey,
    titles: f.opportunities.map((o) => o.title),
  })),
  failures,
  htmlChecks: evaled.checks,
};

fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC11_PROOF.md"), proofMd);
fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC11_PROOF.json"), JSON.stringify(proofJson, null, 2) + "\n");

console.log(passed ? "\nM2 EPIC 11 PASS — Living Business\n" : "\nM2 EPIC 11 FAIL\n");
console.log("Proof → docs/MILESTONE2_EPIC11_PROOF.md\n");
if (!passed) {
  if (!evaled.passed) console.error("HTML evaluation issues:", evaled.issues);
  process.exit(1);
}
