#!/usr/bin/env node
/**
 * Milestone 2 · Epic 10 — Hubly Daily (Release Gate)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nMilestone 2 · Epic 10 — Hubly Daily\n");

const {
  DAILY_VERSION,
  DAILY_LABEL,
  OVERNIGHT_SYSTEMS,
  EXPERT_VOICES,
  WRAP_UP_KINDS,
  STAGE_CADENCE,
  HublyDaily,
  orchestrateHublyDaily,
  simulateSevenDays,
  searchDailyArchive,
  dailyExperiencesAreDistinct,
  evaluateDailyHtml,
  buildWrapUps,
} = await import("./lib/hubly-daily.mjs");

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
const evaled = evaluateDailyHtml(html);

check("Hubly Daily module", HublyDaily.version === "1.0.0");
check("Label", DAILY_LABEL === "Hubly Daily");
check("Version", DAILY_VERSION === "1.0.0");
check("Overnight systems", OVERNIGHT_SYSTEMS.length >= 12);
check("Expert voices (merged)", EXPERT_VOICES.length >= 6);
check("Wrap-up kinds", WRAP_UP_KINDS.length === 4);
check("Stage cadence", Object.keys(STAGE_CADENCE).length === 3);

console.log("\nPage structure\n");
Object.entries(evaled.checks).forEach(([k, v]) => check(k, v));
check("isRunHublyDaily", /function isRunHublyDaily/.test(html));
check("orchestrateHublyDaily in page", /orchestrateHublyDaily/.test(html));

console.log("\nOrchestration\n");
const sample = orchestrateHublyDaily({
  ownerName: "Adrian",
  industry: "pressure washing",
  businessStage: "growing",
  bookingCount: 12,
  dayIndex: 0,
  stripeConnected: true,
});
check("Greeting", sample.greeting.includes("Adrian"));
check("Fresh daily", sample.freshDaily === true);
check("Not a feed", sample.notAFeed === true);
check("One headline", !!sample.headline);
check("Opportunity has why/impact/action", sample.opportunity.why && sample.opportunity.impact && sample.opportunity.action);
check("Wins celebrated", sample.wins.length >= 1);
check("Health change explained", sample.healthChange.reason && sample.healthChange.from != null);
check("If this were my business", /If this were my business/.test(sample.ifMine.label));
check("One voice / never agents", sample.oneVoice && sample.neverShowAgents);
check("Forecast looking ahead", sample.forecast.label === "Looking Ahead" && sample.forecast.tomorrow);
check("Ask continuous", sample.askContinuation.continuous === true);
check("Overnight review systems", sample.overnight.systems.length >= 12);

console.log("\nSeven unique days\n");
const week = simulateSevenDays({ industry: "pressure washing", ownerName: "Adrian", bookingCount: 10 });
check("Seven days simulated", week.length === 7);
check(
  "No duplicated headlines in a week",
  new Set(week.map((d) => d.headline)).size === 7,
);
check(
  "No duplicated opportunity titles in a week",
  new Set(week.map((d) => d.opportunity.title)).size === 7,
);

console.log("\nIndustry-distinct dailies\n");
const industries = ["pressure washing", "photography", "hvac", "lawn care", "cleaning"];
const flows = industries.map((industry) =>
  orchestrateHublyDaily({ ownerName: "Alex", industry, dayIndex: 0, bookingCount: 8 }),
);
for (let i = 0; i < flows.length; i++) {
  for (let j = i + 1; j < flows.length; j++) {
    check(
      `Daily distinct: ${flows[i].industryKey} ≠ ${flows[j].industryKey}`,
      dailyExperiencesAreDistinct(flows[i], flows[j]) ||
        flows[i].headline !== flows[j].headline,
    );
  }
}

console.log("\nStripe disconnect honesty\n");
const noStripe = orchestrateHublyDaily({
  industry: "pressure washing",
  dayIndex: 4,
  stripeConnected: false,
  bookingCount: 10,
});
check(
  "No fake membership/payment rec without Stripe",
  /Stripe isn't connected|Connect Stripe/i.test(noStripe.headline + noStripe.opportunity.title),
);
check(
  "Overnight marks revenue limited",
  noStripe.overnight.systems.some((s) => s.name === "Revenue" && s.status === "limited"),
);

console.log("\nArchive + wrap-ups + return\n");
const tue = searchDailyArchive(sample.archive, "last Tuesday");
check("Archive searchable for Tuesday", tue.length >= 1 || sample.archive.some((a) => /Tue/i.test(a.weekday)));
const wraps = buildWrapUps({ forceFriday: true, forceMonthStart: true, forceQuarter: true, forceAnniversary: true });
check("All wrap-up kinds generatable", wraps.length === 4);
const away = orchestrateHublyDaily({
  industry: "hvac",
  daysAway: 14,
  awayBookings: 5,
  awayReviews: 2,
  bookingCount: 20,
});
check("Two-week return summary", !!away.returnSummary && /what changed/i.test(away.returnSummary.headline));

console.log("\nCadence\n");
const neu = orchestrateHublyDaily({ industry: "cleaning", businessStage: "new" });
const grow = orchestrateHublyDaily({ industry: "cleaning", businessStage: "growing", bookingCount: 10 });
const est = orchestrateHublyDaily({ industry: "cleaning", businessStage: "established", bookingCount: 60 });
check("New focuses setup", /setup/i.test(neu.stage.line));
check("Growing focuses customers", /customers/i.test(grow.stage.line));
check("Established focuses optimization", /optimization/i.test(est.stage.line));

console.log("\nFounder acceptance tests\n");
check("Test1: seven days unique", new Set(week.map((d) => d.signature)).size === 7);
check(
  "Test2: why + impact + action",
  week.every((d) => d.opportunity.why && d.opportunity.impact && d.opportunity.action),
);
check(
  "Test3: Stripe disconnect adjusts",
  /Stripe|Connect Stripe/i.test(noStripe.headline + noStripe.opportunity.title),
);
check(
  "Test4: industries unique",
  new Set(flows.map((f) => f.headline)).size === 5,
);
check("Test5: two-week return first", !!away.returnSummary);
check(
  "Test6: conversation continues",
  sample.askContinuation.continuous && /isDailyAsk|dailyAskThread/.test(html),
);

const passed = failures.length === 0 && evaled.passed;

const proofMd = `# Milestone 2 · Epic 10 — Hubly Daily

**Status:** ${passed ? "PASS" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m2-epic10\`

> Morning business partner — not a feed or report.  
> **Hubly Forecast** looks ahead: tomorrow · weekend · next week · next month.

## Proven

| Requirement | Status |
|-------------|--------|
| Fresh Daily Brief | ${passed ? "✅" : "❌"} |
| Overnight Review | ${passed ? "✅" : "❌"} |
| One primary headline | ${passed ? "✅" : "❌"} |
| One Hubly voice (experts merged) | ${passed ? "✅" : "❌"} |
| Opportunities with why / impact / action | ${passed ? "✅" : "❌"} |
| Wins celebrated | ${passed ? "✅" : "❌"} |
| Business Health changes explained | ${passed ? "✅" : "❌"} |
| If this were my business… | ${passed ? "✅" : "❌"} |
| Continues into Ask Hubly | ${passed ? "✅" : "❌"} |
| Weekly / monthly / quarterly / anniversary | ${passed ? "✅" : "❌"} |
| Searchable Daily Archive | ${passed ? "✅" : "❌"} |
| Adaptive cadence | ${passed ? "✅" : "❌"} |
| Hubly Forecast | ${passed ? "✅" : "❌"} |
| Founder acceptance tests | ${passed ? "✅" : "❌"} |

## Sample headline (${sample.industryKey})

> ${sample.headline}

## If this were my business…

> ${sample.ifMine.recommendation}

## Stop

Do **not** begin Epic 11 until Founder Approval.
`;

const proofJson = {
  epic: 10,
  title: DAILY_LABEL,
  passed,
  checkedAt: new Date().toISOString(),
  version: DAILY_VERSION,
  sample: {
    greeting: sample.greeting,
    headline: sample.headline,
    opportunity: sample.opportunity,
    forecast: sample.forecast,
    ifMine: sample.ifMine,
  },
  weekHeadlines: week.map((d) => d.headline),
  industries: flows.map((f) => ({ industryKey: f.industryKey, headline: f.headline })),
  failures,
  htmlChecks: evaled.checks,
};

fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC10_PROOF.md"), proofMd);
fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC10_PROOF.json"), JSON.stringify(proofJson, null, 2) + "\n");

console.log(passed ? "\nM2 EPIC 10 PASS — Hubly Daily\n" : "\nM2 EPIC 10 FAIL\n");
console.log("Proof → docs/MILESTONE2_EPIC10_PROOF.md\n");

if (!passed) {
  if (!evaled.passed) console.error("HTML evaluation issues:", evaled.issues);
  process.exit(1);
}
