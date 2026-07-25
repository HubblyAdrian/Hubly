#!/usr/bin/env node
/** Gate: AI Create Connect — OpenAI discovery wiring (ChatGPT white-label). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    failures.push({ name, detail });
  } else console.log(`  ✓ ${name}`);
}

console.log("\nAI Create Connect\n");

const hubly = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const disc = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/hubly_brain_discovery_conversation.ts"),
  "utf8",
);
const think = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/hubly_brain_think.ts"),
  "utf8",
);
const brain = fs.readFileSync(path.join(root, "supabase/functions/hubly-brain/index.ts"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const checklist = fs.readFileSync(path.join(root, "AI_CREATE_CONNECT.md"), "utf8");

check("npm script", pkg.scripts?.["check:ai-create-connect"] === "node scripts/check-ai-create-connect.mjs");
check(
  "checklist doc",
  /North Star/.test(checklist) &&
    /OpenAI/.test(checklist) &&
    /first message/i.test(checklist) &&
    /ChatGPT/.test(checklist),
);
check("discovery conversation module", /runDiscoveryConversationTurn/.test(disc));
check("ChatGPT white-label system prompt", /ChatGPT, white-labeled as Hubly/.test(disc));
check("no onboarding mindset in prompt", /NOT onboarding software/.test(disc));
check("brain routes intent discovery", /intent === "discovery"/.test(think) && /runDiscoveryConversationTurn/.test(think));
check("hubly-brain accepts discovery payload", /discovery:\s*body\.discovery/.test(brain));
check("client isDiscoveryThinkTurn", /async function isDiscoveryThinkTurn\(/.test(hubly) && /intent:'discovery'/.test(hubly));
check(
  "OpenAI-first first message",
  /AI Connect — OpenAI Business Blueprint/.test(hubly) ||
    /AI Connect — first turns: OpenAI speaks first/.test(hubly),
);
check("silent live build (no scripted chat)", /silentChat:\s*true/.test(hubly) && /silentChat!==false/.test(hubly));
check("tracks discoveryAiSource", /discoveryAiSource/.test(hubly));
check("landing promises natural talk", /Talk naturally|type naturally|ChatGPT/i.test(hubly));
check(
  "industry packs for CEO test set",
  /flight_instruction/.test(hubly) &&
    /dog_grooming/.test(hubly) &&
    /detailing:/.test(hubly) &&
    /hvac:/.test(hubly) &&
    /spa:/.test(hubly),
);
const registry = fs.readFileSync(path.join(root, "public/business-blueprints/registry.js"), "utf8");
check(
  "dedicated blueprints registered",
  /fitness\.json/.test(registry) &&
    /flight-instruction\.json/.test(registry) &&
    /dog-grooming\.json/.test(registry),
);
for (const f of ["fitness.json", "flight-instruction.json", "dog-grooming.json"]) {
  check(
    `blueprint file ${f}`,
    fs.existsSync(path.join(root, "public/business-blueprints", f)),
  );
}
check(
  "fitness not aliased to spa",
  !/fitness\s*:\s*['"]spa['"]/.test(hubly) &&
    !/flight_instruction\s*:\s*['"]spa['"]/.test(hubly) &&
    !/dog_grooming\s*:\s*['"]spa['"]/.test(hubly),
);
check("Create seeds trade add-ons", /getTradeDefaultAddons/.test(hubly) && /editorAddons/.test(hubly));
check("Create seeds about copy", /ownerBio/.test(hubly) && /tradeChrome/.test(hubly));
check(
  "Create AI Workspace shell",
  /is-aw-shell/.test(hubly) &&
    /isEnterCreateAiWorkspace/.test(hubly) &&
    /isCreateAwSetSurface/.test(hubly) &&
    /is-aw-preview/.test(hubly),
);
check(
  "Create first-10s life UX",
  /Tell me about the business you want to build/.test(hubly) &&
    /Your business is coming to life/.test(hubly) &&
    /isCreateBeginLifeSequence/.test(hubly) &&
    /isCreateThinkAloud/.test(hubly) &&
    /data-create-grow/.test(hubly) &&
    /is-aw-progress/.test(hubly),
);
const systemsDoc = fs.readFileSync(path.join(root, "CREATE_SYSTEMS.md"), "utf8");
const createRegistry = fs.readFileSync(path.join(root, "public/create-systems/registry.js"), "utf8");
const assemble = fs.readFileSync(path.join(root, "public/create-systems/assemble.js"), "utf8");
check("CREATE_SYSTEMS north star", /Never ask/.test(systemsDoc) && /Business Blueprint/.test(systemsDoc));
check("component registry", /HublyCreateSystems/.test(createRegistry) && /hero_12/.test(createRegistry) && /DESIGN_DIRECTIONS/.test(createRegistry));
check("assemble engine", /HublyCreateAssemble/.test(assemble) && /normalizeBlueprint/.test(assemble));
check("client systems build sequence", /isCreateSystemsBuildSequence/.test(hubly) && /create-systems\/assemble/.test(hubly));
check(
  "router serves create-systems",
  /create-systems\//.test(fs.readFileSync(path.join(root, "api/router.js"), "utf8")),
);
check(
  "systems plan not overwritten by packs",
  /systemsLocked/.test(hubly) && /discoveryBuildPath/.test(hubly) && /isWaitForCreateAssemble/.test(hubly),
);
check(
  "discovery returns businessBlueprint",
  /businessBlueprint/.test(disc) && /designDirection/.test(disc) && /NEVER pick an industry template/.test(disc),
);

const passed = failures.length === 0;
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(
  path.join(root, "docs/AI_CREATE_CONNECT_PROOF.json"),
  JSON.stringify(
    {
      title: "AI Create Connect",
      passed,
      failures,
      note: "Static wiring only. Live OpenAI must be verified with OPENAI_API_KEY on Edge + a real /signup or /demo turn.",
      checkedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);
console.log(passed ? "\nAI CREATE CONNECT PASS (wiring)\n" : "\nAI CREATE CONNECT FAIL\n");
if (!passed) process.exit(1);
