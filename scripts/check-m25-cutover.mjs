#!/usr/bin/env node
/**
 * Milestone 2.5 — Production Cutover gate
 *
 * Product migration, not routing. Verifies the designed product is the only
 * primary path — Advanced Studio is an escape hatch, never the home.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const failures = [];
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    failures.push({ name, detail });
  } else console.log(`  ✓ ${name}`);
}

console.log("\nMilestone 2.5 — Production Cutover\n");

const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const routerSrc = fs.readFileSync(path.join(root, "api/router.js"), "utf8");
const rootTwin = path.join(root, "hubly.html");

console.log("Phase A — Merge surface\n");
check("Welcome Experience in hubly.html", /data-welcome-experience/.test(html));
check("Thinking canvas", /id="is-step-thinking"/.test(html));
check("Creative Build", /id="is-step-creative-build"/.test(html));
check("Business Reveal", /id="is-step-reveal"/.test(html));
check("Business Home", /id="is-step-business-home"/.test(html));
check("Creative Workspace", /id="is-step-creative-workspace"/.test(html));
check("Hubly Daily", /id="is-step-hubly-daily"/.test(html));
check("Living Business", /id="is-step-living-business"/.test(html));
check("No conflict markers in package.json", !/<<<<<<|>>>>>>/.test(fs.readFileSync(path.join(root, "package.json"), "utf8")));

console.log("\nPhase B — Replace every old experience\n");
check("Apex / is classic platform landing", /urlPath === '\/'[\s\S]{0,400}platform-home\.html/.test(routerSrc));
check("Marketing also at /platform", /\/platform/.test(routerSrc) && /platform-home\.html/.test(routerSrc));
check("p-signup is Welcome", /id="p-signup"[\s\S]{0,200}data-welcome-experience/.test(html));
check("No old auth-shell signup title", !/id="p-signup"[\s\S]{0,2500}Let's build your site/.test(html));
check("goDash opens Operate Home (OS chassis)", /function goDash\(\)[\s\S]{0,240}openOperateHome/.test(html));
check("Advanced Studio escape hatch exists", /data-advanced-studio|openAdvancedStudio|Advanced Studio/.test(html));
check("No Classic workspace home escape", !/Classic workspace/.test(html));
check("Marketing CTAs go through Welcome", /function mktStartFromPrompt[\s\S]{0,400}p-signup/.test(html));
check("Editor deep-link → Creative Workspace", /opts\.openEditor[\s\S]{0,200}isEnterCreativeWorkspace/.test(html));

console.log("\nPhase C — Stranger walkthrough wiring\n");
check("Walkthrough: Landing (classic)", /urlPath === '\/'[\s\S]{0,400}platform-home\.html/.test(routerSrc));
const walk = [
  ["Welcome / Create", /welcomeSubmit|data-welcome-experience/],
  ["Discovery", /is-step-talk|data-discovery-experience/],
  ["Thinking", /is-step-thinking/],
  ["Creative Build", /is-step-creative-build/],
  ["Reveal", /is-step-reveal/],
  ["Save Business", /is-step-save-business/],
  ["Launch", /is-step-business-launch/],
  ["Business Home shell (archived)", /is-step-business-home/],
  ["Creative Workspace", /is-step-creative-workspace|isEnterCreativeWorkspace/],
  ["Operate Home", /openOperateHome|data-v3-operate-home/],
  ["Living Business shell (archived)", /is-step-living-business/],
];
for (const [label, re] of walk) check(`Walkthrough: ${label}`, re.test(html));

console.log("\nPhase D — Dead code / single product\n");
check("Stale root hubly.html twin removed", !fs.existsSync(rootTwin));
check("Router serves public/hubly.html only", /public\/hubly\.html/.test(routerSrc));
check("preferM2ExperienceHome off (Operate = chassis)", /function preferM2ExperienceHome[\s\S]{0,300}return false/.test(html));

// Router smoke
const router = require(path.join(root, "api/router.js"));
function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(c) {
      this.statusCode = c;
      return this;
    },
    send(b) {
      this.body = b;
      return this;
    },
    end() {
      return this;
    },
  };
}
async function hit(host, url) {
  const res = mockRes();
  await router({ url, headers: { host } }, res);
  return res;
}
const apex = await hit("hubly.app", "/");
check("Live router: / serves classic landing", /Get Done|Build My Business|platform-home/i.test(String(apex.body || "")) && !/data-welcome-experience/.test(String(apex.body || "")));
const signup = await hit("hubly.app", "/signup");
check("Live router: /signup serves Welcome (Create)", /data-welcome-experience/.test(String(signup.body || "")));
const plat = await hit("hubly.app", "/platform");
check("Live router: /platform is classic landing alias", /Get Done|Build My Business/i.test(String(plat.body || "")));

const passed = failures.length === 0;
const proof = `# Milestone 2.5 — Production Cutover

**Status:** ${passed ? "PASS (wiring A–D)" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m25-cutover\`

> Engineer green ≠ done.  
> **Phase E Founder Certification** on live hubly.app is the finish line.

## Phases

| Phase | Status |
|-------|--------|
| A Merge Everything | ${passed ? "✅" : "❌"} |
| B Replace Every Old Experience | ${passed ? "✅" : "❌"} |
| C Production Walkthrough (wiring) | ${passed ? "🟡" : "❌"} |
| D Dead Code Inventory | ${passed ? "🟡 report ready" : "❌"} |
| E Founder Certification (live hubly.app) | ⬜ |

## Founder rule

Milestone 2.5 is complete only when a brand-new customer can go from hubly.app to a fully launched business without ever realizing there was an old product.

See:

- \`docs/MILESTONE25_FOUNDER_CERTIFICATION.md\` — Tests 1–8
- \`docs/MILESTONE25_CUTOVER_REPORT.md\` — sign-off matrix
- \`docs/MILESTONE25_DEAD_CODE_INVENTORY.md\` — Delete / Archive / Still Required
`;

fs.writeFileSync(path.join(root, "docs/MILESTONE25_CUTOVER_PROOF.md"), proof);
fs.writeFileSync(
  path.join(root, "docs/MILESTONE25_CUTOVER_PROOF.json"),
  JSON.stringify(
    {
      milestone: "2.5",
      title: "Production Cutover",
      passed,
      wiringOnly: true,
      phaseE: "pending_founder_live",
      definitionOfDone:
        "A brand-new customer can go from hubly.app to a fully launched business without ever realizing there was an old product.",
      failures,
      checkedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);

console.log(passed ? "\nM2.5 CUTOVER PASS (wiring A–D)\n" : "\nM2.5 CUTOVER FAIL\n");
console.log("Phase E Founder Certification: ⬜ pending live hubly.app\n");
console.log("Proof → docs/MILESTONE25_CUTOVER_PROOF.md");
console.log("Sign-off → docs/MILESTONE25_CUTOVER_REPORT.md");
console.log("Tests → docs/MILESTONE25_FOUNDER_CERTIFICATION.md\n");
if (!passed) process.exit(1);
