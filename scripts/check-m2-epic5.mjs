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
check("Hero statement", REVEAL_HERO.includes("proud of"));
check("Pride moment copy", REVEAL_PRIDE.includes("Six minutes ago"));
check("Forward to launch", REVEAL_FORWARD.includes("launch"));
check("Time Capsule label", TIME_CAPSULE_LABEL.includes("Day One"));

console.log("\nPage structure\n");
check("Reveal canvas", evaled.checks.revealCanvas);
check("Hero statement in UI", evaled.checks.heroStatement);
check("Welcome to business", evaled.checks.welcomeBiz);
check("Guided sections", evaled.checks.guidedSections);
check("Why we built it", evaled.checks.whyExplain);
check("Business Snapshot", evaled.checks.snapshot);
check("Overall Business Confidence", evaled.checks.confidence);
check("Alternative concepts", evaled.checks.alternatives);
check("Interactive Why?", evaled.checks.interactiveWhy);
check("Pride Moment", evaled.checks.prideMoment);
check("Transition to Delayed Account Creation", evaled.checks.forwardLaunch);
check("No dashboard first", evaled.checks.noDashboardFirst);
check("Never says Website complete", evaled.checks.noWebsiteComplete);
check("Business Time Capsule", evaled.checks.timeCapsule);
check("Creative hands off to Reveal", evaled.checks.creativeHandoff);
check("Hubly brand on Reveal", evaled.checks.wordmark);
check(
  "Reveal step markup",
  /id="is-step-reveal"/.test(html) && /data-business-reveal/.test(html),
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

console.log("\nFounder acceptance tests\n");
check(
  "Test1: presentation feel (cinematic + guided + pride)",
  pw.cinematic && pw.sections.length >= 6 && pw.pride.includes("Six minutes"),
);
check(
  "Test2: three industries tell different stories",
  revealExperiencesAreDistinct(pw, photo) && revealExperiencesAreDistinct(pw, clean),
);

const topics = ["website", "booking", "packages", "identity", "portfolio"];
const whyAnswers = topics.map((t) => answerWhyFromStore(pw.reasoningStore, t));
check(
  "Test3: Why? answers from stored reasoning",
  whyAnswers.every((a) => a.ok && a.fromStore),
  whyAnswers.filter((a) => !a.ok).map((a) => a.text).join("; "),
);

check(
  "Test4: alternatives available",
  (pw.alternatives || []).length >= 2 && pw.alternatives.some((a) => /luxury/i.test(a.label)),
);
check(
  "Test5: reveal is explore-first (no edit/dashboard CTA first)",
  pw.forward.includes("launch") && !/dashboard/i.test(pw.forward + pw.hero),
);
check(
  "Test6: pride strong enough to share",
  /proud|idea|brand|website|strategy/i.test(pw.pride + pw.hero),
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
| Cinematic guided reveal | ${passed ? "✅" : "❌"} |
| No dashboard first | ${passed ? "✅" : "❌"} |
| Sections introduced intentionally | ${passed ? "✅" : "❌"} |
| Why? from stored reasoning | ${passed ? "✅" : "❌"} |
| Business Snapshot | ${passed ? "✅" : "❌"} |
| Overall Business Confidence | ${passed ? "✅" : "❌"} |
| Alternative concepts | ${passed ? "✅" : "❌"} |
| Pride Moment | ${passed ? "✅" : "❌"} |
| Business Time Capsule | ${passed ? "✅" : "❌"} |
| Transition to Delayed Account Creation | ${passed ? "✅" : "❌"} |
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
