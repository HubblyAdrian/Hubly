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
check("Apex / is Welcome (not platform-home)", !/urlPath === '\/'[\s\S]{0,120}platform-home/.test(routerSrc));
check("Legacy marketing at /platform", /\/platform/.test(routerSrc) && /platform-home\.html/.test(routerSrc));
check("p-signup is Welcome", /id="p-signup"[\s\S]{0,200}data-welcome-experience/.test(html));
check("No old auth-shell signup title", !/id="p-signup"[\s\S]{0,2500}Let's build your site/.test(html));
check("goDash opens Business Home", /function goDash\(\)[\s\S]{0,200}openProductionBusinessHome/.test(html));
check("Advanced Studio escape hatch exists", /data-advanced-studio|openAdvancedStudio|Advanced Studio/.test(html));
check("No Classic workspace home escape", !/Classic workspace/.test(html));
check("Marketing CTAs go through Welcome", /function mktStartFromPrompt[\s\S]{0,400}p-signup/.test(html));
check("Editor deep-link → Creative Workspace", /opts\.openEditor[\s\S]{0,200}isEnterCreativeWorkspace/.test(html));

console.log("\nPhase C — Stranger walkthrough wiring\n");
const walk = [
  ["Welcome", /welcomeSubmit|data-welcome-experience/],
  ["Discovery", /is-step-talk|data-discovery-experience/],
  ["Thinking", /is-step-thinking/],
  ["Creative Build", /is-step-creative-build/],
  ["Reveal", /is-step-reveal/],
  ["Save Business", /is-step-save-business/],
  ["Launch", /is-step-business-launch/],
  ["Business Home", /is-step-business-home|openProductionBusinessHome/],
  ["Creative Workspace", /is-step-creative-workspace|isEnterCreativeWorkspace/],
  ["Hubly Daily", /is-step-hubly-daily|isRunHublyDaily/],
  ["Living Business", /is-step-living-business|isEnterLivingBusiness/],
];
for (const [label, re] of walk) check(`Walkthrough: ${label}`, re.test(html));

console.log("\nPhase D — Dead code / single product\n");
check("Stale root hubly.html twin removed", !fs.existsSync(rootTwin));
check("Router serves public/hubly.html only", /public\/hubly\.html/.test(routerSrc));
check("preferM2ExperienceHome defaults to cutover home", /function preferM2ExperienceHome[\s\S]{0,300}return true/.test(html));

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
check("Live router: / serves Welcome", /data-welcome-experience/.test(String(apex.body || "")));
const signup = await hit("hubly.app", "/signup");
check("Live router: /signup serves Welcome", /data-welcome-experience/.test(String(signup.body || "")));
const plat = await hit("hubly.app", "/platform");
check("Live router: /platform is legacy brochure", /Get Done|Build My Business/i.test(String(plat.body || "")));

const passed = failures.length === 0;
const proof = `# Milestone 2.5 — Production Cutover

**Status:** ${passed ? "PASS (wiring)" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m25-cutover\`

> Cutover ≠ integration. The designed product must be the only product.

## Phases

| Phase | Status |
|-------|--------|
| A Merge Everything | ${passed ? "✅" : "❌"} |
| B Replace Every Old Experience | ${passed ? "✅" : "❌"} |
| C Production Walkthrough (live hubly.app) | ⬜ Requires deploy to main |
| D Delete Dead Code | ${passed ? "✅ wiring" : "❌"} |

## Founder rule

If a stranger on hubly.app hits old signup, old dashboard, or old editor as the primary path — this milestone fails even if scripts pass.
`;

fs.writeFileSync(path.join(root, "docs/MILESTONE25_CUTOVER_PROOF.md"), proof);
fs.writeFileSync(
  path.join(root, "docs/MILESTONE25_CUTOVER_PROOF.json"),
  JSON.stringify({ milestone: "2.5", title: "Production Cutover", passed, failures, checkedAt: new Date().toISOString() }, null, 2) + "\n",
);

console.log(passed ? "\nM2.5 CUTOVER PASS (wiring)\n" : "\nM2.5 CUTOVER FAIL\n");
console.log("Proof → docs/MILESTONE25_CUTOVER_PROOF.md\n");
if (!passed) process.exit(1);
