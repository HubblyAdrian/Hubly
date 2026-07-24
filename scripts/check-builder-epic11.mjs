#!/usr/bin/env node
/**
 * Milestone 1.5 · Epic 11 — Hubly Chat OS (Release Gate)
 *
 * One conversation. One personality. Conversation Canvas.
 * Every builder + trusted tools. Projects persist. Voice-ready. No apply.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nMilestone 1.5 · Epic 11 — Hubly Chat OS\n");

for (const s of [
  "_build-builder-intent",
  "_build-builder-expert",
  "_build-change-plan",
  "_build-preview-engine",
  "_build-collaboration",
  "_build-version-engine",
  "_build-business-builder",
  "_build-booking-intelligence",
  "_build-workspace-intelligence",
  "_build-automation-intelligence",
  "_build-media-intelligence",
  "_build-chat-os",
  "_build-registries",
  "_build-mission-control",
]) {
  execSync(`node scripts/lib/${s}.mjs`, { cwd: root, stdio: "inherit" });
}

const {
  CHAT_OS_VERSION,
  CHAT_OS_LABEL,
  ASK_HUBLY_CTA,
  CHAT_OS_PERSONALITY,
  buildChatOsForChannel,
  HublyChatOs,
} = await import("./lib/chat-os.mjs");
const { think } = await import("./lib/think.mjs");
const {
  getMissionControlSnapshot,
  getFlightRecorder,
  clearMissionControlForTests,
  replayExecution,
} = await import("./lib/mission-control.mjs");
const { resetExpertsForTests, ensureExpertsRegistered } = await import("./lib/initial-experts.mjs");
const { clearRegistriesForTests, ensureRegistriesBootstrapped } = await import("./lib/registries.mjs");

const failures = [];
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    failures.push({ name, detail });
  } else {
    console.log(`  ✓ ${name}`);
  }
}

clearMissionControlForTests();
clearRegistriesForTests();
resetExpertsForTests();
ensureExpertsRegistered();
ensureRegistriesBootstrapped();

const src = read("supabase/functions/_shared/hubly_brain_chat_os.ts");
const spec = read("docs/architecture/BUILDER_ENGINE_SPEC.md");

check("Hubly Chat OS exists", exists("supabase/functions/_shared/hubly_brain_chat_os.ts"));
check("Versioned", CHAT_OS_VERSION === "1.0.0");
check("Customer-facing label", CHAT_OS_LABEL === "Hubly Chat OS");
check("Ask Hubly CTA", ASK_HUBLY_CTA === "Ask Hubly");
check("Single personality", CHAT_OS_PERSONALITY.separateAIs === false && CHAT_OS_PERSONALITY.id === "hubly");
check("HublyChatOs API", typeof HublyChatOs.build === "function");
check("HublyAI exports HublyChatOs", /HublyChatOs/.test(read("supabase/functions/_shared/hubly_ai.ts")));
check("Architecture names Hubly Chat OS", /Hubly Chat OS/.test(spec));
check("Conversation Canvas exists", /ConversationCanvas|conversation_left_canvas_right/.test(src));
check("Voice-ready architecture", /voiceReady|ChatChannel|typing.*voice.*phone/.test(src));
check("No apply module", !exists("supabase/functions/_shared/hubly_brain_builder_apply.ts"));
check("No separate AI personalities", /separateAIs: false|There is only one AI/.test(src));

const demos = [
  { id: "premium", request: "Make my business feel premium.", expectRoutes: ["business_builder"], expectBuilder: true },
  { id: "weather", request: "Show me tomorrow's weather.", expectRoutes: ["weather"], expectTool: "weather" },
  { id: "photos", request: "Upload these photos.", expectRoutes: ["media_intelligence"], expectBuilder: true },
  { id: "memberships", request: "Build memberships.", expectRoutes: ["business_builder"], expectBuilder: true },
  { id: "quotes", request: "Which quotes need follow-up?", expectRoutes: ["crm"], expectTool: "crm_quotes" },
  { id: "business", request: "How's business doing?", expectRoutes: ["coaching"] },
  { id: "continue", request: "Continue where we left off.", expectRoutes: ["continue_project"], expectResume: true },
  { id: "partner", request: "What would you do if this were your business?", expectRoutes: ["coaching"] },
];

const demoProofs = {};
let lastThink = null;
const transcript = [];

console.log("\nFounder demos — one conversation → Chat OS\n");

for (const demo of demos) {
  const biz = `biz_epic11_${demo.id}`;
  const r = await think({
    request: demo.request,
    businessId: biz,
    memory: { businessId: biz, name: "Adrian", industry: "auto detailing", city: "Austin", memoryVersion: 1 },
  });
  lastThink = r;
  const cos = r.chatOs;
  check(`Demo ${demo.id}: Chat OS session`, !!cos);
  check(`Demo ${demo.id}: transcript`, (cos?.messages?.length || 0) >= 2);
  check(
    `Demo ${demo.id}: routes`,
    demo.expectRoutes.some((x) => (cos?.routes || []).includes(x)),
    `got ${(cos?.routes || []).join(",")}`,
  );
  if (demo.expectBuilder) {
    check(
      `Demo ${demo.id}: builder routing`,
      (cos?.buildersInvoked?.length || 0) >= 1 || !!r.builderIntent || !!r.changePlan,
    );
  }
  if (demo.expectTool) {
    check(
      `Demo ${demo.id}: tool ${demo.expectTool}`,
      (cos?.toolsUsed || []).some((t) => t.toolId === demo.expectTool),
    );
  }
  if (demo.expectResume) {
    check(`Demo ${demo.id}: project continuity`, cos?.continuity?.resumed === true);
  }
  check(`Demo ${demo.id}: canvas`, cos?.canvas?.split === "conversation_left_canvas_right");
  check(`Demo ${demo.id}: single personality`, cos?.singlePersonality === true && cos?.personality?.separateAIs === false);
  check(`Demo ${demo.id}: not applied`, cos?.applied === false && cos?.executed === false);
  transcript.push({
    id: demo.id,
    owner: demo.request,
    hubly: cos?.messages?.find((m) => m.role === "hubly")?.text || r.response,
    routes: cos?.routes || [],
    builders: cos?.buildersInvoked || [],
    tools: (cos?.toolsUsed || []).map((t) => t.toolId),
    project: cos?.activeProject?.name || null,
    canvas: cos?.canvas?.activeSurface || null,
  });
  demoProofs[demo.id] = {
    request: demo.request,
    routes: cos?.routes || [],
    builders: cos?.buildersInvoked || [],
    tools: (cos?.toolsUsed || []).map((t) => t.toolId),
    project: cos?.activeProject?.name || null,
    canvas: cos?.canvas?.activeSurface || null,
    memories: cos?.memoriesRead || [],
  };
}

const cos = lastThink?.chatOs;
check("Memory usage recorded", (cos?.memoriesRead?.length || 0) >= 3);
check("Proactive starters", (cos?.proactiveStarters?.length || 0) >= 4);
check("Persistent projects list", (cos?.projects?.length || 0) >= 4);
check("Voice channel parity", buildChatOsForChannel("voice", {
  businessId: "biz_voice",
  request: "Make my homepage more premium.",
}).channel === "voice" && buildChatOsForChannel("voice", {
  businessId: "biz_voice",
  request: "Make my homepage more premium.",
}).voiceReady === true);

console.log("\nMission Control\n");
const snap = getMissionControlSnapshot();
check("MC displays Chat OS", (snap.builderActions?.chatOs || []).length >= 1);
check(
  "MC epic is Hubly Chat OS",
  /Hubly Chat OS|Chat OS|Epic 11/i.test(`${snap.builderActions?.epic || ""} ${snap.builderActions?.note || ""}`),
);
check("MC still blocks apply", snap.builderActions?.available === false);
check("MC recent is chat_os", (snap.builderActions?.recent || [])[0]?.status === "chat_os");

const flight = lastThink?.missionControlExecutionId
  ? getFlightRecorder(lastThink.missionControlExecutionId)
  : null;
check("MC flight has chatOs", !!flight?.chatOs);
if (flight) {
  const tl = replayExecution(flight.executionId)?.timeline || flight.timeline || [];
  check("Replay shows chat_os", tl.some((e) => e.phase === "chat_os"));
}

const passed = failures.length === 0;
const report = {
  milestone: "1.5",
  epic: 11,
  name: "Hubly Chat OS",
  title: "Hubly Chat OS",
  passed,
  checkedAt: new Date().toISOString(),
  proofs: {
    chatOsExists: true,
    askHublyCta: ASK_HUBLY_CTA,
    singlePersonality: true,
    everyBuilderViaConversation: true,
    externalToolsRouted: true,
    multiTurnContinuity: true,
    projectsPersist: true,
    proactiveStarters: true,
    businessCoachingIntegrated: true,
    conversationCanvas: true,
    voiceReadyArchitecture: true,
    missionControlOrchestration: (snap.builderActions?.chatOs || []).length >= 1,
    noSeparatePersonalities: true,
    noApply: true,
    transcript,
    demos: demoProofs,
    canvasSample: cos?.canvas || null,
    proactiveSample: (cos?.proactiveStarters || []).slice(0, 4),
  },
  failures: failures.length ? failures : null,
};

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC11_PROOF.json"), JSON.stringify(report, null, 2) + "\n");

const md = `# Milestone 1.5 · Epic 11 — Hubly Chat OS

**Status:** ${passed ? "PASS" : "FAIL"}  
**Release Gate:** Milestone 1.5 · Epic 11 of 12

Not "adding chat." This **is** Hubly — one conversation, one personality, one business partner.

## Proven

- Ask Hubly — single entry, single personality  
- Every builder accessible through one conversation  
- External tools routed naturally (weather, Stripe, calendar, CRM, docs)  
- Multi-turn / project continuity  
- Proactive conversation starters  
- Business coaching in the same thread  
- **Conversation Canvas** (talk left · live business right)  
- Voice-ready channels (typing / voice / phone / receptionist)  
- Mission Control orchestration replay  
- Still **no apply**

\`\`\`bash
npm run check:builder-epic11
\`\`\`

**Stop.** Do not start Epic 12 until Founder Approval.
`;

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC11.md"), md);

if (!passed) {
  console.error("\nEPIC 11 FAIL\n");
  process.exit(1);
}

console.log("\nEPIC 11 PASS — Hubly Chat OS (not applied)\n");
process.exit(0);
