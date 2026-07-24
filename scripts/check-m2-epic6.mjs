#!/usr/bin/env node
/**
 * Milestone 2 · Epic 6 — Delayed Account Creation (Release Gate)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nMilestone 2 · Epic 6 — Delayed Account Creation\n");

const {
  DELAYED_ACCOUNT_VERSION,
  DELAYED_ACCOUNT_LABEL,
  SAVE_BUSINESS_HEADLINE,
  VERSION_SAVED_LINE,
  LAUNCH_FORWARD,
  LAUNCH_CTA,
  SAVE_MANIFEST,
  AUTH_OPTIONS,
  FORBIDDEN_SAAS,
  HublyDelayedAccount,
  orchestrateDelayedAccount,
  hasSaasSignupLanguage,
  soundsLikeHublySave,
  evaluateDelayedAccountHtml,
} = await import("./lib/delayed-account.mjs");

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
const evaled = evaluateDelayedAccountHtml(html);

check("Delayed Account module", HublyDelayedAccount.version === "1.0.0");
check("Label", DELAYED_ACCOUNT_LABEL === "Delayed Account Creation");
check("Version", DELAYED_ACCOUNT_VERSION === "1.0.0");
check("Save headline", SAVE_BUSINESS_HEADLINE.includes("save everything"));
check("Three auth options", AUTH_OPTIONS.length === 3);
check("Manifest has 7 items", SAVE_MANIFEST.length === 7);

console.log("\nPage structure\n");
check("Save Business canvas", evaled.checks.saveCanvas);
check("Save language (not signup)", evaled.checks.saveLanguage);
check("Sign Up language removed from save flow", evaled.checks.noSignupCopy);
check("Save manifest explained", evaled.checks.manifest);
check("Continue with Google", evaled.checks.authGoogle);
check("Continue with Apple", evaled.checks.authApple);
check("Continue with Email", evaled.checks.authEmail);
check("Version 1.0 confirmation", evaled.checks.versionSaved);
check("Business Ownership certificate", evaled.checks.ownershipCert);
check("Personal welcome", evaled.checks.personalWelcome);
check("Founder Moment", evaled.checks.founderMoment);
check("Auth failure recovery", evaled.checks.recovery);
check("Security without fear", evaled.checks.security);
check("Natural transition to Launch", evaled.checks.launchForward);
check("Reveal hands off to Delayed Account", evaled.checks.revealHandoff);
check("Draft / state persistence", evaled.checks.draftPersist);
check("Hubly brand", evaled.checks.wordmark);
check(
  "Save + Founder Moment steps",
  /id="is-step-save-business"/.test(html) && /id="is-step-founder-moment"/.test(html),
);

console.log("\nOrchestration\n");
const flow = orchestrateDelayedAccount({
  businessName: "ABC Pressure Washing",
  ownerName: "Adrian",
  email: "adrian@example.com",
});
check("Zero required business fields", flow.requiredBusinessFields === 0);
check("Preserves draft", flow.preservesDraft === true);
check("No dashboard first", flow.noDashboardFirst === true);
check("Certificate owner", flow.certificate.owner === "Adrian");
check("Certificate business", flow.certificate.business === "ABC Pressure Washing");
check("Founder Moment CTA", flow.founderMoment.cta === LAUNCH_CTA);
check("Hubly save language", soundsLikeHublySave(flow.headline + flow.ownershipLine));
check("No SaaS in orchestrated copy", !hasSaasSignupLanguage(JSON.stringify(flow)));

console.log("\nFounder acceptance tests\n");
check(
  "Test1: feels like saving something valuable",
  soundsLikeHublySave(SAVE_BUSINESS_HEADLINE) && !FORBIDDEN_SAAS.some((f) => SAVE_BUSINESS_HEADLINE.includes(f)),
);
check(
  "Test2: disconnect recovery copy exists",
  /Everything we built is still here/.test(html) && /persistInstantSiteDraft/.test(html),
);
check(
  "Test3: Google / Apple / Email all present",
  AUTH_OPTIONS.every((a) => html.includes(a.label)),
);
check("Test4: zero additional business questions", flow.requiredBusinessFields === 0);
check(
  "Test5: Hubly language only in save slice",
  evaled.checks.noSignupCopy && evaled.checks.saveLanguage,
);
check(
  "Test6: ownership certificate + founder moment",
  flow.certificate.version === "1.0" && /officially started/.test(flow.founderMoment.headline),
);

const passed = failures.length === 0 && evaled.passed;

const proofMd = `# Milestone 2 · Epic 6 — Delayed Account Creation

**Status:** ${passed ? "PASS" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m2-epic6\`

> Account creation after value — saving the business, not signing up.  
> End: *${LAUNCH_FORWARD}* → **${LAUNCH_CTA}**

## Proven

| Requirement | Status |
|-------------|--------|
| No Sign Up / Create Account language | ${passed ? "✅" : "❌"} |
| Save-your-business primary message | ${passed ? "✅" : "❌"} |
| Manifest of what gets saved | ${passed ? "✅" : "❌"} |
| Google / Apple / Email options | ${passed ? "✅" : "❌"} |
| Draft + Version 1.0 persistence | ${passed ? "✅" : "❌"} |
| Auth failure never loses work | ${passed ? "✅" : "❌"} |
| Business Ownership certificate | ${passed ? "✅" : "❌"} |
| Version 1.0 confirmation | ${passed ? "✅" : "❌"} |
| Founder Moment | ${passed ? "✅" : "❌"} |
| Natural transition to Business Launch | ${passed ? "✅" : "❌"} |
| Founder acceptance tests | ${passed ? "✅" : "❌"} |

## Save headline

> ${SAVE_BUSINESS_HEADLINE}

## Version saved

> ${VERSION_SAVED_LINE}

## Stop

Do **not** begin Epic 7 until Founder Approval.
`;

const proofJson = {
  epic: 6,
  title: DELAYED_ACCOUNT_LABEL,
  passed,
  checkedAt: new Date().toISOString(),
  version: DELAYED_ACCOUNT_VERSION,
  headline: SAVE_BUSINESS_HEADLINE,
  versionSaved: VERSION_SAVED_LINE,
  launchForward: LAUNCH_FORWARD,
  launchCta: LAUNCH_CTA,
  sample: {
    certificate: flow.certificate,
    founderMoment: flow.founderMoment,
  },
  failures,
  htmlChecks: evaled.checks,
};

fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC6_PROOF.md"), proofMd);
fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC6_PROOF.json"), JSON.stringify(proofJson, null, 2) + "\n");

console.log(passed ? "\nM2 EPIC 6 PASS — Delayed Account Creation\n" : "\nM2 EPIC 6 FAIL\n");
console.log("Proof → docs/MILESTONE2_EPIC6_PROOF.md\n");

if (!passed) process.exit(1);
