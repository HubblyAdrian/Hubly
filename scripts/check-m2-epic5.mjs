#!/usr/bin/env node
/**
 * Milestone 2 · Epic 5 — Business Reveal (Release Gate)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nMilestone 2 · Epic 5 — Business Reveal\n");

const {
  REVEAL_VERSION,
  REVEAL_LABEL,
  REVEAL_HERO,
  REVEAL_PRIDE,
  REVEAL_FORWARD,
  TIME_CAPSULE_LABEL,
  HublyBusinessReveal,
  orchestrateBusinessReveal,
  revealExperiencesAreDistinct,
  answerWhyFromStore,
  evaluateRevealHtml,
} = await import("./lib/business-reveal.mjs");

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
const evaled = evaluateRevealHtml(html);

check("Reveal module", HublyBusinessReveal.version === "1.0.0");
check("Label", REVEAL_LABEL === "Business Reveal");
check("Version", REVEAL_VERSION === "1.0.0");
check("Hero statement (v3 visual)", REVEAL_HERO.includes("ready"));
check("Ready moment copy", /website|booking|CRM|packages/i.test(REVEAL_PRIDE));
check("Forward to workspace", /Workspace|Continue/i.test(REVEAL_FORWARD));
check("Time Capsule label (archive helper)", TIME_CAPSULE_LABEL.includes("Day One"));

console.log("\nPage structure (Hubly v3 — visual Reveal)\n");
check("Reveal canvas", evaled.checks.revealCanvas);
check("Hero statement in UI", evaled.checks.heroStatement);
check("Ready subtitle", evaled.checks.welcomeBiz);
check("Visual ready cards", evaled.checks.guidedSections);
check("Stored reasoning helpers", evaled.checks.whyExplain);
check("Visual surfaces", evaled.checks.snapshot);
check("No report confidence primary", evaled.checks.confidence);
check("Continue path", evaled.checks.alternatives);
check("Continue CTA", evaled.checks.interactiveWhy);
check("Ready moment", evaled.checks.prideMoment);
check("Transition to Workspace / Operate", evaled.checks.forwardLaunch);
check("No dashboard first on Reveal", evaled.checks.noDashboardFirst);
check("Never says Website complete", evaled.checks.noWebsiteComplete);
check("Version archive helper", evaled.checks.timeCapsule);
check("Creative hands off to Reveal", evaled.checks.creativeHandoff);
check("Hubly brand on Reveal", evaled.checks.wordmark);
check(
  "Reveal step markup",
  /id="is-step-reveal"/.test(html) && /data-business-reveal/.test(html) && /data-v3-reveal/.test(html),
);

console.log("\nIndustry reveals\n");
const pw = orchestrateBusinessReveal({
  industryId: "pressure_washing",
  businessName: "Summit Soft Wash",
  designConfidence: 96,
  chosenDirection: "luxury",
  creativeStages: [
    { id: "hero", explain: "I moved booking above the fold because homeowners usually want an immediate quote.", confidence: 97, decision: "Strong CTA" },
    { id: "packages", explain: "I simplified your services into three packages because that typically increases conversion.", confidence: 96, decision: "Three packages" },
  ],
});
const photo = orchestrateBusinessReveal({
  industryId: "photography",
  businessName: "Lumen Weddings",
  designConfidence: 94,
  chosenDirection: "luxury",
});
const clean = orchestrateBusinessReveal({
  industryId: "cleaning",
  businessName: "Nest Turnovers",
  designConfidence: 93,
});

check("Distinct industry stories", revealExperiencesAreDistinct(pw, photo) && revealExperiencesAreDistinct(photo, clean));
check("Snapshot complete", pw.snapshot.websiteReady && pw.snapshot.bookingReady && pw.snapshot.brandReady);
check("Time capsule captured", pw.timeCapsule?.label === TIME_CAPSULE_LABEL && pw.timeCapsule.firstSnapshot);
check("No dashboard-first flag", pw.noDashboardFirst === true);

console.log("\nFounder acceptance tests (v3)\n");
check(
  "Test1: visual ready (not report)",
  /ready/i.test(REVEAL_HERO) && /isRevealRenderReadyCards|data-v3-reveal/.test(html),
);
check(
  "Test2: three industries tell different stories",
  revealExperiencesAreDistinct(pw, photo) && revealExperiencesAreDistinct(pw, clean),
);

const topics = ["website", "booking", "packages", "identity", "portfolio"];
const whyAnswers = topics.map((t) => answerWhyFromStore(pw.reasoningStore, t));
check(
  "Test3: Why? answers from stored reasoning (behind the build)",
  whyAnswers.every((a) => a.ok && a.fromStore),
  whyAnswers.filter((a) => !a.ok).map((a) => a.text).join("; "),
);

check(
  "Test4: Continue enters Operate path",
  /isRevealContinueToWorkspace|openOperateHome/.test(html),
);
check(
  "Test5: no report chrome primary",
  !/Overall Business Confidence|Business Time Capsule|Business Snapshot/.test(
    html.slice(html.indexOf('id="is-step-reveal"'), html.indexOf('id="is-step-reveal"') + 4000),
  ),
);
check(
  "Test6: ready moment is visual",
  /Website|Booking|CRM|Packages|Calendar/.test(html) && /Your business is ready/.test(html),
);

const passed = failures.length === 0 && evaled.passed;

const proofMd = `# Milestone 2 · Epic 5 — Business Reveal

**Status:** ${passed ? "PASS" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m2-epic5\`

> Unveil a new business — not "website finished."  
> End: *${REVEAL_FORWARD}*

## Proven

| Requirement | Status |
|-------------|--------|
| Visual ready cards (v3) | ${passed ? "✅" : "❌"} |
| No dashboard first on Reveal | ${passed ? "✅" : "❌"} |
| Continue → Operate Home | ${passed ? "✅" : "❌"} |
| Why? from stored reasoning (behind build) | ${passed ? "✅" : "❌"} |
| No report chrome primary | ${passed ? "✅" : "❌"} |
| Founder acceptance tests | ${passed ? "✅" : "❌"} |

## Samples

- **Pressure Washing:** ${pw.businessName} — ${pw.tagline}
- **Photography:** ${photo.businessName} — ${photo.tagline}
- **Cleaning:** ${clean.businessName} — ${clean.tagline}

## Pride

> ${REVEAL_PRIDE}

## Time Capsule

> ${TIME_CAPSULE_LABEL}

## Stop

Do **not** begin Epic 6 until Founder Approval.
`;

const proofJson = {
  epic: 5,
  title: REVEAL_LABEL,
  passed,
  checkedAt: new Date().toISOString(),
  version: REVEAL_VERSION,
  hero: REVEAL_HERO,
  pride: REVEAL_PRIDE,
  forward: REVEAL_FORWARD,
  timeCapsule: TIME_CAPSULE_LABEL,
  industries: {
    pressure_washing: { name: pw.businessName, confidence: pw.overallConfidence, signature: pw.signature },
    photography: { name: photo.businessName, confidence: photo.overallConfidence, signature: photo.signature },
    cleaning: { name: clean.businessName, confidence: clean.overallConfidence, signature: clean.signature },
  },
  failures,
  htmlChecks: evaled.checks,
};

fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC5_PROOF.md"), proofMd);
fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC5_PROOF.json"), JSON.stringify(proofJson, null, 2) + "\n");

console.log(passed ? "\nM2 EPIC 5 PASS — Business Reveal\n" : "\nM2 EPIC 5 FAIL\n");
console.log("Proof → docs/MILESTONE2_EPIC5_PROOF.md\n");

if (!passed) process.exit(1);
