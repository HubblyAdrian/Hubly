#!/usr/bin/env node
/**
 * Milestone 2 · Epic 8 — Business Home (Release Gate)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nMilestone 2 · Epic 8 — Business Home\n");

const {
  HOME_VERSION,
  HOME_LABEL,
  FORBIDDEN_HOME,
  MORNING_REVIEW_LINE,
  MORNING_FOCUS_LINE,
  INDUSTRY_TODAY,
  INDUSTRY_HOME_FOCUS,
  STAGE_EMPHASIS,
  WORKSPACE_MODES,
  CARD_ASK_PROMPTS,
  HublyBusinessHome,
  orchestrateBusinessHome,
  homeExperiencesAreDistinct,
  hasForbiddenDashboardLanguage,
  evaluateHomeHtml,
  buildWeekReturnSummary,
} = await import("./lib/business-home.mjs");

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
const evaled = evaluateHomeHtml(html);

check("Business Home module", HublyBusinessHome.version === "1.0.0");
check("Label", HOME_LABEL === "Business Home");
check("Version", HOME_VERSION === "1.0.0");
check("Morning review line", MORNING_REVIEW_LINE.includes("reviewed your business"));
check("Morning focus line", MORNING_FOCUS_LINE.includes("focus on today"));
check("No forbidden dashboard words in constants", !hasForbiddenDashboardLanguage(MORNING_REVIEW_LINE + MORNING_FOCUS_LINE));

console.log("\nPage structure\n");
check("Business Home canvas", evaled.checks.homeCanvas);
check("Not a dashboard (language)", evaled.checks.notDashboard);
check("Morning Brief", evaled.checks.morningBrief);
check("Today's Focus", evaled.checks.todaysFocus);
check("Business Health", evaled.checks.businessHealth);
check("Live website card", evaled.checks.liveWebsite);
check("Industry Today's Business", evaled.checks.industryToday);
check("Ask Hubly dock", evaled.checks.askHubly);
check("Business Timeline", evaled.checks.timeline);
check("Growth Opportunities", evaled.checks.growth);
check("Workspace Intelligence", evaled.checks.workspaceIntel);
check("Business Snapshot", evaled.checks.snapshot);
check("Card Ask Hubly", evaled.checks.cardAsk);
check("Adaptive stage / empty states", evaled.checks.adaptiveStage);
check("30-Second Rule", evaled.checks.thirtySecond);
check("Launch → Home handoff", evaled.checks.launchHandoff);
check("Continuous Ask conversation", evaled.checks.continuousAsk);
check("Hubly brand", evaled.checks.wordmark);
check("isRunBusinessHome", /function isRunBusinessHome/.test(html));
check("orchestrateBusinessHome in page", /orchestrateBusinessHome/.test(html));

console.log("\nOrchestration\n");
const sample = orchestrateBusinessHome({
  businessName: "ABC Pressure Washing",
  ownerName: "Adrian",
  industry: "pressure washing",
  businessStage: "growing",
  workspaceMode: "balanced",
  bookingCount: 12,
});
check("Not a dashboard flag", sample.notADashboard === true);
check("30-Second Rule flag", sample.thirtySecondRule === true);
check("Greeting", sample.brief.greeting.includes("Adrian"));
check("Single Today's Focus", !!sample.focus.action && sample.focus.impact);
check("Focus has why + impact + next", !!(sample.focus.why && sample.focus.impact && sample.focus.nextStep));
check("Health overall", sample.health.overall >= 1 && sample.health.overall <= 100);
check("Five health dimensions", sample.health.dimensions.length === 5);
check("Website actions", sample.website.actions.length === 4);
check("Growth has three with impact", sample.growth.length === 3 && sample.growth.every((g) => g.impact && g.why && g.nextStep));
check("Four questions answered", sample.answersFourQuestions.length === 4);
check("Ask dock continuous", sample.askDock.continuous === true);

console.log("\nIndustry-distinct homes\n");
const industries = [
  "pressure washing",
  "photography",
  "hvac",
  "lawn care",
  "cleaning",
];
const flows = industries.map((industry) =>
  orchestrateBusinessHome({ businessName: "Demo Co", ownerName: "Alex", industry, bookingCount: 8 }),
);
for (let i = 0; i < flows.length; i++) {
  for (let j = i + 1; j < flows.length; j++) {
    check(
      `Home distinct: ${flows[i].industryKey} ≠ ${flows[j].industryKey}`,
      homeExperiencesAreDistinct(flows[i], flows[j]) ||
        flows[i].todayBusiness.panels[0].label !== flows[j].todayBusiness.panels[0].label,
    );
  }
}
check("Five industry today packs", Object.keys(INDUSTRY_TODAY).length >= 5);
check(
  "Today panels differ across trades",
  new Set(flows.map((f) => f.todayBusiness.panels.map((p) => p.label).join("|"))).size === 5,
);
check(
  "Focus actions differ across trades",
  new Set(flows.map((f) => f.focus.action)).size === 5,
);

console.log("\nWorkspace + stage adaptation\n");
const jobsHome = orchestrateBusinessHome({ industry: "pressure washing", workspaceMode: "jobs", bookingCount: 8 });
const salesHome = orchestrateBusinessHome({ industry: "pressure washing", workspaceMode: "sales", bookingCount: 8 });
const webHome = orchestrateBusinessHome({ industry: "pressure washing", workspaceMode: "website", bookingCount: 8 });
check("Jobs workspace reorders", jobsHome.sectionOrder[2] === "today");
check("Sales workspace reorders", salesHome.sectionOrder[2] === "growth");
check("Website workspace reorders", webHome.sectionOrder[2] === "website");
check("Workspace modes exist", Object.keys(WORKSPACE_MODES).length === 4);

const newHome = orchestrateBusinessHome({ industry: "cleaning", businessStage: "new" });
const growHome = orchestrateBusinessHome({ industry: "cleaning", businessStage: "growing", bookingCount: 10 });
const estHome = orchestrateBusinessHome({ industry: "cleaning", businessStage: "established", bookingCount: 60 });
check("New stage emphasizes booking page", /booking page/i.test(newHome.stage.emphasis));
check("Growing emphasizes Growth", /Growth/i.test(growHome.stage.emphasis));
check("Established emphasizes Optimization", /Optimization/i.test(estHome.stage.emphasis));
check("Stage packs", Object.keys(STAGE_EMPHASIS).length === 3);

const weekAway = buildWeekReturnSummary({ daysAway: 7, awayBookings: 3, awaySiteChanges: 2 });
check("Week return summary", !!weekAway && /what changed/i.test(weekAway.headline));
const weekHome = orchestrateBusinessHome({
  industry: "hvac",
  daysAway: 7,
  awayBookings: 3,
  awaySiteChanges: 1,
  bookingCount: 20,
});
check("Week return on home", !!weekHome.weekReturn);

console.log("\nFounder acceptance tests\n");
check(
  "Test1: industry homes look different",
  new Set(flows.map((f) => f.signature)).size === 5 &&
    new Set(flows.map((f) => f.todayBusiness.panels[0].label)).size >= 4,
);
check(
  "Test2: 30s clarity without nav (brief+focus+health+ask)",
  sample.brief && sample.focus && sample.health && sample.askDock && sample.thirtySecondRule,
);
check("Test3: week away summarizes change", !!weekAway && weekAway.bullets.length >= 3);
check(
  "Test4: recommendations include why + impact + next",
  sample.growth.every((g) => g.why && g.impact && g.nextStep) &&
    sample.focus.why &&
    sample.focus.impact &&
    sample.focus.nextStep,
);
check(
  "Test5: every card answers why (today panels + website)",
  sample.todayBusiness.panels.every((p) => p.why) && !!sample.website.why,
);
check(
  "Test6: Ask Hubly continuous from cards",
  CARD_ASK_PROMPTS.length >= 5 &&
    /isHomeAsk/.test(html) &&
    /homeAskThread/.test(html) &&
    sample.askDock.continuous,
);

const passed = failures.length === 0 && evaled.passed;

const proofMd = `# Milestone 2 · Epic 8 — Business Home

**Status:** ${passed ? "PASS" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m2-epic8\`

> Personalized business briefing — not a dashboard.  
> **30-Second Rule:** today · attention · highest-impact action · health · Ask Hubly

## Proven

| Requirement | Status |
|-------------|--------|
| Business Home (not dashboard) | ${passed ? "✅" : "❌"} |
| Morning Brief | ${passed ? "✅" : "❌"} |
| Today's Focus (one highest-impact) | ${passed ? "✅" : "❌"} |
| Business Health explainable | ${passed ? "✅" : "❌"} |
| Live Website card | ${passed ? "✅" : "❌"} |
| Industry-specific Today's Business | ${passed ? "✅" : "❌"} |
| Ask Hubly always docked | ${passed ? "✅" : "❌"} |
| Business Timeline | ${passed ? "✅" : "❌"} |
| Growth Opportunities + impact | ${passed ? "✅" : "❌"} |
| Workspace Intelligence | ${passed ? "✅" : "❌"} |
| Business Snapshot | ${passed ? "✅" : "❌"} |
| Adaptive empty / stage states | ${passed ? "✅" : "❌"} |
| 30-Second Rule | ${passed ? "✅" : "❌"} |
| Founder acceptance tests | ${passed ? "✅" : "❌"} |

## Morning Brief sample

> ${sample.brief.greeting}  
> ${sample.brief.review}  
> ${sample.brief.focusLine}

## Today's Focus (${sample.industryKey})

> ${sample.focus.action}  
> Expected Impact: ${sample.focus.impact}

## Stop

Do **not** begin Epic 9 until Founder Approval.
`;

const proofJson = {
  epic: 8,
  title: HOME_LABEL,
  passed,
  checkedAt: new Date().toISOString(),
  version: HOME_VERSION,
  sample: {
    industryKey: sample.industryKey,
    brief: sample.brief,
    focus: sample.focus,
    health: sample.health,
    growth: sample.growth,
    stage: sample.stage,
    workspace: sample.workspace,
  },
  industries: flows.map((f) => ({
    industryKey: f.industryKey,
    focus: f.focus.action,
    today: f.todayBusiness.panels.map((p) => p.label),
  })),
  failures,
  htmlChecks: evaled.checks,
};

fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC8_PROOF.md"), proofMd);
fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC8_PROOF.json"), JSON.stringify(proofJson, null, 2) + "\n");

console.log(passed ? "\nM2 EPIC 8 PASS — Business Home\n" : "\nM2 EPIC 8 FAIL\n");
console.log("Proof → docs/MILESTONE2_EPIC8_PROOF.md\n");

if (!passed) {
  if (!evaled.passed) console.error("HTML evaluation issues:", evaled.issues);
  process.exit(1);
}
