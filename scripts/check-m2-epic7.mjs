#!/usr/bin/env node
/**
 * Milestone 2 · Epic 7 — Business Launch Experience (Release Gate)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nMilestone 2 · Epic 7 — Business Launch Experience\n");

const {
  LAUNCH_VERSION,
  LAUNCH_LABEL,
  LAUNCH_ANIMATION_TITLE,
  LAUNCH_CELEBRATION,
  FOUNDER_LETTER_TEMPLATE,
  HOME_TRANSITION,
  LAUNCH_DEPLOY_STEPS,
  NEXT_STEPS,
  FUTURE_TIMELINE,
  INDUSTRY_LAUNCH_ADVICE,
  FORBIDDEN_LAUNCH,
  HublyBusinessLaunch,
  orchestrateBusinessLaunch,
  assessLaunchDeployment,
  launchExperiencesAreDistinct,
  evaluateLaunchHtml,
} = await import("./lib/business-launch.mjs");

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
const evaled = evaluateLaunchHtml(html);

check("Business Launch module", HublyBusinessLaunch.version === "1.0.0");
check("Label", LAUNCH_LABEL === "Business Launch Experience");
check("Version", LAUNCH_VERSION === "1.0.0");
check("Animation title", LAUNCH_ANIMATION_TITLE === "Launching your business...");
check("Celebration", LAUNCH_CELEBRATION.includes("officially launched"));
check("Deploy steps", LAUNCH_DEPLOY_STEPS.length === 6);
check("Next steps", NEXT_STEPS.length === 4);
check("Future timeline milestones", FUTURE_TIMELINE.length >= 9);

console.log("\nPage structure\n");
check("Launch canvas", evaled.checks.launchCanvas);
check("Launch animation", evaled.checks.animation);
check("No Loading/Publishing spinner", evaled.checks.noSpinner);
check("Celebration", evaled.checks.celebration);
check("Launch Summary", evaled.checks.summary);
check("Hubly advice", evaled.checks.advice);
check("Next step choices", evaled.checks.nextSteps);
check("Business Timeline", evaled.checks.timeline);
check("Future Timeline / Your Journey", evaled.checks.futureTimeline);
check("Day One certificate", evaled.checks.certificate);
check("Founder Letter", evaled.checks.founderLetter);
check("Honest failure path", evaled.checks.honestDeploy);
check("Business Home transition", evaled.checks.homeTransition);
check("Founder Moment → Launch handoff", evaled.checks.founderHandoff);
check("Industry advice embedded", evaled.checks.industryAdvice);
check("Hubly brand", evaled.checks.wordmark);
check(
  "Business Launch + Business Home steps",
  /id="is-step-business-launch"/.test(html) && /id="is-step-business-home"/.test(html),
);
check("isRunBusinessLaunchExperience", /function isRunBusinessLaunchExperience/.test(html));
check("assessLaunchDeployment in page", /assessLaunchDeployment/.test(html));

console.log("\nOrchestration\n");
const full = orchestrateBusinessLaunch({
  businessName: "ABC Pressure Washing",
  ownerName: "Adrian",
  industry: "pressure washing",
  stripeConnected: true,
  googleCalendarConnected: true,
});
check("Celebration lead", full.celebrationLead.includes("Adrian"));
check("Celebration copy", full.celebration === LAUNCH_CELEBRATION);
check("Summary includes Website Live", full.summary.some((s) => s.id === "website" && s.ok));
check("Payments shown when Stripe connected", full.summary.some((s) => s.id === "payments" && s.ok));
check("GCal shown when connected", full.summary.some((s) => s.id === "gcal" && s.ok));
check("Advice from pressure washing", full.industryKey === "pressure_washing");
check("Certificate version 1.0", full.certificate.version === "1.0");
check("Founder letter memorable", /Six minutes ago/.test(full.founderLetter.body));
check("Home transition", full.homeTransition === HOME_TRANSITION);
check("No fake success flag", full.noFakeSuccess === true);

console.log("\nHonest deployment (Stripe disconnected)\n");
const partial = assessLaunchDeployment({
  stripeConnected: false,
  googleCalendarConnected: false,
  websiteLive: true,
});
check("Partial when Stripe missing", partial.partial === true);
check("Payments not shown when disconnected", !partial.summary.some((s) => s.id === "payments"));
check("GCal not shown when disconnected", !partial.summary.some((s) => s.id === "gcal"));
check(
  "Booking issue mentions Stripe",
  partial.issues.some((i) => /Stripe isn't connected|couldn't be activated/i.test(i)),
);
check("Website still celebrated", partial.summary.some((s) => s.id === "website" && s.ok));

const partialFlow = orchestrateBusinessLaunch({
  businessName: "ABC Pressure Washing",
  ownerName: "Adrian",
  industry: "pressure washing",
  stripeConnected: false,
});
check("Orchestrated partial", partialFlow.partial === true);
check(
  "No fake Payments Connected in partial summary",
  !partialFlow.summary.some((s) => s.id === "payments"),
);

console.log("\nIndustry-distinct advice\n");
const industries = ["pressure washing", "photography", "hvac", "lawn care", "cleaning"];
const flows = industries.map((industry) =>
  orchestrateBusinessLaunch({ businessName: "Demo Co", ownerName: "Alex", industry }),
);
for (let i = 0; i < flows.length; i++) {
  for (let j = i + 1; j < flows.length; j++) {
    check(
      `Advice distinct: ${flows[i].industryKey} ≠ ${flows[j].industryKey}`,
      launchExperiencesAreDistinct(flows[i], flows[j]),
    );
  }
}
check("Five industry advice packs", Object.keys(INDUSTRY_LAUNCH_ADVICE).length >= 5);
check(
  "No identical first tips across trades",
  new Set(flows.map((f) => f.advice[0].title)).size === flows.length,
);

console.log("\nFounder acceptance tests\n");
check(
  "Test1: starting a company (not publishing software)",
  /officially launched/.test(LAUNCH_CELEBRATION) &&
    !FORBIDDEN_LAUNCH.some((f) => LAUNCH_CELEBRATION.includes(f)) &&
    /Launching your business/.test(LAUNCH_ANIMATION_TITLE),
);
check(
  "Test2: industry advice differs for five trades",
  new Set(flows.map((f) => f.signature)).size === 5,
);
check(
  "Test3: Stripe disconnect explained honestly",
  partial.issues.some((i) => /Stripe/i.test(i)) &&
    !partial.summary.some((s) => s.id === "payments" && s.ok),
);
check(
  "Test4: Founder Letter worth saving",
  /Six minutes ago this business existed only as an idea/.test(FOUNDER_LETTER_TEMPLATE) &&
    /— Hubly/.test(FOUNDER_LETTER_TEMPLATE),
);
check(
  "Test5: next steps without help center",
  NEXT_STEPS.every((n) => html.includes(n.label)) && /Here's what I'd do next/.test(html),
);
check(
  "Test6: excited to continue (Home transition after celebration)",
  /Let's get to work/.test(HOME_TRANSITION) &&
    /isEnterBusinessHome|readyForBusinessHome/.test(html) &&
    /Your Journey/.test(html),
);

const passed = failures.length === 0 && evaled.passed;

const proofMd = `# Milestone 2 · Epic 7 — Business Launch Experience

**Status:** ${passed ? "PASS" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m2-epic7\`

> Opening a business — not publishing a website.  
> End: *${HOME_TRANSITION}* → soft Business Home (Epic 8)

## Proven

| Requirement | Status |
|-------------|--------|
| Business Launch animation | ${passed ? "✅" : "❌"} |
| Launch Summary reflects real deployment | ${passed ? "✅" : "❌"} |
| Dynamic Growth Recommendations | ${passed ? "✅" : "❌"} |
| Next Step choices | ${passed ? "✅" : "❌"} |
| Business Timeline begins | ${passed ? "✅" : "❌"} |
| Day One Business Certificate | ${passed ? "✅" : "❌"} |
| Founder Letter | ${passed ? "✅" : "❌"} |
| Future Timeline / Your Journey | ${passed ? "✅" : "❌"} |
| Failed deployments communicated honestly | ${passed ? "✅" : "❌"} |
| Natural transition into Business Home | ${passed ? "✅" : "❌"} |
| Founder acceptance tests | ${passed ? "✅" : "❌"} |

## Celebration

> ${LAUNCH_CELEBRATION}

## Founder Letter

\`\`\`
${FOUNDER_LETTER_TEMPLATE}
\`\`\`

## Sample advice (${full.industryKey})

1. ${full.advice[0]?.title} — ${full.advice[0]?.estimated}
2. ${full.advice[1]?.title} — ${full.advice[1]?.estimated}
3. ${full.advice[2]?.title} — ${full.advice[2]?.estimated}

## Stop

Do **not** begin Epic 8 until Founder Approval.
`;

const proofJson = {
  epic: 7,
  title: LAUNCH_LABEL,
  passed,
  checkedAt: new Date().toISOString(),
  version: LAUNCH_VERSION,
  celebration: LAUNCH_CELEBRATION,
  homeTransition: HOME_TRANSITION,
  sample: {
    full: {
      industryKey: full.industryKey,
      summary: full.summary,
      advice: full.advice,
      certificate: full.certificate,
    },
    partial: {
      issues: partialFlow.issues,
      summary: partialFlow.summary,
    },
  },
  failures,
  htmlChecks: evaled.checks,
};

fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC7_PROOF.md"), proofMd);
fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC7_PROOF.json"), JSON.stringify(proofJson, null, 2) + "\n");

console.log(passed ? "\nM2 EPIC 7 PASS — Business Launch Experience\n" : "\nM2 EPIC 7 FAIL\n");
console.log("Proof → docs/MILESTONE2_EPIC7_PROOF.md\n");

if (!passed) {
  if (!evaled.passed) {
    console.error("HTML evaluation issues:", evaled.issues);
  }
  process.exit(1);
}
