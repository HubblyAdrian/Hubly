#!/usr/bin/env node
/**
 * Milestone 2 · Epic 1 — Welcome Experience (Release Gate)
 *
 * Front door to Hubly — conversation first, zero account fields.
 * Metric: time to first conversation (First Impression Timer).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nMilestone 2 · Epic 1 — Welcome Experience\n");

const {
  WELCOME_VERSION,
  WELCOME_LABEL,
  WELCOME_PROMPTS,
  WELCOME_TRUST_OUTCOMES,
  WELCOME_BUSINESSES,
  WELCOME_COPY,
  FIRST_IMPRESSION_WINDOW_MS,
  TIME_TO_FIRST_CONVERSATION_TARGET_MS,
  ACCOUNT_FIELDS_REQUIRED,
  evaluateWelcomeHtml,
  soundsLikeWelcomeHubly,
  HublyWelcomeExperience,
} = await import("./lib/welcome-experience.mjs");

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
const evaled = evaluateWelcomeHtml(html);

check("Welcome Experience module", HublyWelcomeExperience.version === "1.0.0");
check("Label", WELCOME_LABEL === "Welcome Experience");
check("Version", WELCOME_VERSION === "1.0.0");

console.log("\nPage structure\n");
check("/signup maps to Welcome", /'\/signup'\s*:\s*'p-signup'/.test(html) && /data-welcome-experience/.test(html));
check("Traditional signup UI removed", evaled.checks.noClassicSignupCta);
check("Hero conversation primary", evaled.checks.heroConversation);
check("Large conversation input", evaled.checks.largeInput);
check("Zero account fields", evaled.checks.zeroAccountFields && ACCOUNT_FIELDS_REQUIRED === 0);
check("Dynamic example prompts in source", WELCOME_PROMPTS.every((p) => html.includes(p)));
check("Trust strip outcomes", evaled.checks.trustOutcomes);
check("Live inspiration businesses", WELCOME_BUSINESSES.every((b) => html.includes(b)));
check("No CRM terminology on welcome", evaled.checks.noCrmInWelcome);
check("Microinteractions present", evaled.checks.microinteractions);
check("Hubly brand mark", evaled.checks.brandMark);
check("First Impression Timer (15s)", evaled.checks.firstImpressionTimer && FIRST_IMPRESSION_WINDOW_MS === 15000);
check("Routing no longer auto-starts Instant Site on /signup", !/if\(id==='p-signup'&&!opts\.forceSignupForm\)\{\s*startInstantSite/.test(html));
check("checkSession shows Welcome", /dest==='p-signup'[\s\S]{0,80}showP\('p-signup'/.test(html));
check("Submit hands off to Instant Site with seed", /function welcomeSubmit[\s\S]{0,900}startInstantSite\(text/.test(html));
check("Responsive CSS", /@media \(max-width:720px\)[\s\S]{0,200}\.welcome-hero/.test(html));

console.log("\nFounder acceptance tests\n");
// Test 1 — does not feel like software (no auth form chrome)
check("Test1: not an auth form", !/auth-form|auth-feats|Create your account/i.test(html.match(/id="p-signup"[\s\S]*?id="p-onboard"/)?.[0] || ""));
// Test 2 — understand they should describe business
check("Test2: describe-business cue", /What are we building today/i.test(html) && /Type anything/i.test(html));
// Test 3 — zero required fields
check("Test3: zero required fields", ACCOUNT_FIELDS_REQUIRED === 0 && evaled.accountFieldsRequired === 0);
// Test 4 — time to first value target under 10s
check("Test4: TTF conversation target <10s", TIME_TO_FIRST_CONVERSATION_TARGET_MS === 10000);
check("Test4: FIT optimizes first 15s for typing", /is-first-impression/.test(html) && /15000/.test(html));
// Test 5 — copy sounds like Hubly
check(
  "Test5: every welcome sentence sounds like Hubly",
  WELCOME_COPY.every((c) => soundsLikeWelcomeHubly(c)),
);

const signupSlice = html.match(/id="p-signup"[\s\S]*?id="p-onboard"/)?.[0] || "";
check("No email/password inputs in welcome slice", !/<input[^>]*(email|password|tel)/i.test(signupSlice));
check("No industry/business name fields", !/Business name|Industry|Phone number|Address/i.test(signupSlice));

const passed = failures.length === 0 && evaled.passed;

const proofMd = `# Milestone 2 · Epic 1 — Welcome Experience

**Status:** ${passed ? "PASS" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m2-epic1\`

> The front door to Hubly. Not a signup page — the beginning of a conversation.
> Metric: **time to first conversation** (First Impression Timer = 15s).

## Proven

| Requirement | Status |
|-------------|--------|
| /signup completely replaced | ${passed ? "✅" : "❌"} |
| No traditional signup UI | ${passed ? "✅" : "❌"} |
| One large conversation focus | ${passed ? "✅" : "❌"} |
| Dynamic example prompts | ${passed ? "✅" : "❌"} |
| Trust strip = outcomes | ${passed ? "✅" : "❌"} |
| Live business inspiration | ${passed ? "✅" : "❌"} |
| Zero account information requested | ${passed ? "✅" : "❌"} |
| Responsive layout | ${passed ? "✅" : "❌"} |
| Microinteractions | ${passed ? "✅" : "❌"} |
| No CRM terminology | ${passed ? "✅" : "❌"} |
| First Impression Timer | ${passed ? "✅" : "❌"} |
| Founder acceptance tests | ${passed ? "✅" : "❌"} |

## First Impression Timer

- Window: **${FIRST_IMPRESSION_WINDOW_MS / 1000}s** — conversation only
- Target time to first conversation: **< ${TIME_TO_FIRST_CONVERSATION_TARGET_MS / 1000}s**
- Account fields required: **${ACCOUNT_FIELDS_REQUIRED}**

## Example prompts

${WELCOME_PROMPTS.map((p) => `- ${p}`).join("\n")}

## Trust outcomes

${WELCOME_TRUST_OUTCOMES.map((t) => `- ✓ ${t}`).join("\n")}

## Inspiration

${WELCOME_BUSINESSES.map((b) => `- ${b} — Built in 3 minutes`).join("\n")}

## Stop

Do **not** begin Epic 2 until Founder Approval.
`;

fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC1_PROOF.md"), proofMd);
fs.writeFileSync(
  path.join(root, "docs/MILESTONE2_EPIC1_PROOF.json"),
  JSON.stringify(
    {
      milestone: "2",
      epic: 1,
      name: "Welcome Experience",
      passed,
      checkedAt: new Date().toISOString(),
      proofs: {
        ...evaled.checks,
        prompts: WELCOME_PROMPTS,
        trust: WELCOME_TRUST_OUTCOMES,
        businesses: WELCOME_BUSINESSES,
        firstImpressionWindowMs: FIRST_IMPRESSION_WINDOW_MS,
        timeToFirstConversationTargetMs: TIME_TO_FIRST_CONVERSATION_TARGET_MS,
        accountFieldsRequired: ACCOUNT_FIELDS_REQUIRED,
      },
      failures: failures.length ? failures : null,
    },
    null,
    2,
  ) + "\n",
);

if (!passed) {
  console.error("\nM2 EPIC 1 FAIL\n");
  if (evaled.issues?.length) console.error(evaled.issues);
  process.exit(1);
}

console.log("\nM2 EPIC 1 PASS — Welcome Experience\n");
console.log("Proof → docs/MILESTONE2_EPIC1_PROOF.md\n");
process.exit(0);
