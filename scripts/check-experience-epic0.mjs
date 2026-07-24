#!/usr/bin/env node
/**
 * Milestone 2 · Epic 0 — Hubly Identity & Personality (Release Gate)
 *
 * Not infrastructure — make Hubly's character visible in the first 30 seconds.
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

console.log("\nMilestone 2 · Epic 0 — Hubly Identity & Personality\n");

for (const s of [
  "_build-identity-system",
  "_build-personality",
  "_build-experience-director",
  "_build-chat-os",
  "_build-registries",
  "_build-mission-control",
]) {
  execSync(`node scripts/lib/${s}.mjs`, { cwd: root, stdio: "inherit" });
}

const {
  PERSONALITY_VERSION,
  PERSONALITY_LABEL,
  PERSONALITY_MODES,
  HublyPersonality,
  detectPersonalityMode,
  personalityLine,
  applyPersonalityExpression,
  firstThirtySeconds,
  demonstrateAllModes,
} = await import("./lib/personality.mjs");
const { applyExperienceDirector } = await import("./lib/experience-director.mjs");
const { buildChatOsSession, ASK_HUBLY_CTA } = await import("./lib/chat-os.mjs");
const { think } = await import("./lib/think.mjs");
const { clearMissionControlForTests } = await import("./lib/mission-control.mjs");
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

const src = read("supabase/functions/_shared/hubly_brain_personality.ts");
const edSrc = read("supabase/functions/_shared/hubly_brain_experience_director.ts");
const chatSrc = read("supabase/functions/_shared/hubly_brain_chat_os.ts");

check("Personality module exists", exists("supabase/functions/_shared/hubly_brain_personality.ts"));
check("Versioned", PERSONALITY_VERSION === "1.0.0");
check("Label", PERSONALITY_LABEL === "Hubly Identity & Personality");
check("HublyPersonality API", typeof HublyPersonality.apply === "function");
check("HublyAI exports HublyPersonality", /HublyPersonality/.test(read("supabase/functions/_shared/hubly_ai.ts")));
check("Nine modes", PERSONALITY_MODES.length === 9);
check(
  "Modes cover founder list",
  [
    "greeting",
    "celebrate",
    "apologize",
    "explain",
    "ask",
    "disagree",
    "encourage",
    "uncertainty",
    "transition",
  ].every((m) => PERSONALITY_MODES.includes(m)),
);
check("Builds on Identity System", /hubly_brain_identity_system/.test(src));
check("ED wires visible personality", /applyPersonalityExpression|personalityExpression/.test(edSrc));
check("Chat OS wires personality", /applyPersonalityExpression|personalityExpression/.test(chatSrc));
check("Ask Hubly CTA still singular", ASK_HUBLY_CTA === "Ask Hubly");
// Epic 1 must stay locked — conversational Welcome not shipped yet
check("Signup still present (Epic 1 locked)", /p-signup/.test(read("public/hubly.html")));
check("Welcome conversation page not shipped", !/id=["']p-welcome["']/.test(read("public/hubly.html")));

console.log("\nVisible moments\n");
const demo = demonstrateAllModes("Adrian");
for (const m of demo) {
  check(`Mode ${m.mode} has line`, (m.line || "").length > 12);
  check(`Mode ${m.mode} explains why`, (m.why || "").length > 8);
}

const first = firstThirtySeconds({ ownerName: "Adrian" });
check("First 30s greeting", /what are we building today/i.test(first.greeting));
check("First 30s promise", /business partner/i.test(first.promise));
check("First 30s includes all modes", first.modes.length === 9);

const modeChecks = [
  { req: "Hey Hubly", expect: "greeting" },
  { req: "I don't like it — undo that", draft: "I'll restore the prior version.", expect: "apologize" },
  { req: "Why did you recommend arrival windows?", draft: "Because customers stop guessing.", expect: "explain" },
  { req: "What would you do?", draft: "I'd go a different direction.", expect: "disagree" },
  { req: "I'm stuck and overwhelmed", draft: "Let's pick one next step.", expect: "encourage" },
  { req: "Should we raise prices?", draft: "I'm not sure yet — need more signal.", expect: "uncertainty" },
  { req: "Continue where we left off", draft: "Same project.", expect: "transition" },
  { req: "Build memberships", draft: "Before I do — monthly or yearly?", expect: "ask" },
];

for (const c of modeChecks) {
  const mode = detectPersonalityMode({
    request: c.req,
    draftResponse: c.draft || "",
    correcting: /undo|don'?t like/.test(c.req),
    transitioning: /continue where/.test(c.req),
    opening: /^(hi|hey|hello)/i.test(c.req),
  });
  check(`Detect ${c.expect} from “${c.req.slice(0, 28)}”`, mode === c.expect, `got ${mode}`);
}

const celebrated = applyPersonalityExpression({
  text: "Your business has been updated.",
  request: "Ship it",
  ownerName: "Adrian",
  celebrate: true,
});
check("Celebrate is visible", celebrated.mode === "celebrate" && /nice work/i.test(celebrated.text));
check("Remembered as teammate", celebrated.rememberedAs === "teammate");

console.log("\nExperience Director + Chat OS\n");
const ed = applyExperienceDirector({
  request: "Hey Hubly",
  draftResponse: "I can help with your business.",
  ownerName: "Adrian",
  confidence: 88,
  criticOk: true,
});
check("ED returns personalityExpression", !!ed.personalityExpression?.mode);
check("ED greeting visible", ed.personalityExpression?.mode === "greeting" || /what are we building/i.test(ed.ownerResponse));
check("ED check visible_personality", (ed.checks || []).some((c) => c.name === "visible_personality" && c.ok));

const cos = buildChatOsSession({
  businessId: "biz_m2_e0",
  request: "Hey — what should we work on?",
  ownerName: "Adrian",
  industry: "auto detailing",
});
check("Chat OS personalityExpression", !!cos.personalityExpression?.mode);
check("Chat OS single personality", cos.singlePersonality === true && cos.personality?.separateAIs === false);

const t = await think({
  request: "Hey Hubly",
  businessId: "biz_m2_e0_think",
  memory: { businessId: "biz_m2_e0_think", name: "Adrian", industry: "detailing", city: "Austin", memoryVersion: 1 },
});
check("Think → Chat OS has personality", !!t.chatOs?.personalityExpression?.mode);
check(
  "Owner-facing text feels like Hubly",
  /hubly|building|partner|business/i.test(String(t.response || t.chatOs?.messages?.find((m) => m.role === "hubly")?.text || "")),
);

const passed = failures.length === 0;
const report = {
  milestone: "2",
  epic: 0,
  name: "Hubly Identity & Personality",
  title: "Hubly Identity & Personality",
  passed,
  checkedAt: new Date().toISOString(),
  proofs: {
    personalityModule: true,
    nineModes: PERSONALITY_MODES,
    firstThirtySeconds: first,
    moments: demo.map((m) => ({ mode: m.mode, line: m.line })),
    experienceDirectorWired: true,
    chatOsWired: true,
    rememberedAsTeammate: true,
    epic1StillLocked: true,
  },
  failures: failures.length ? failures : null,
};

fs.writeFileSync(path.join(root, "docs/EXPERIENCE_EPIC0_PROOF.json"), JSON.stringify(report, null, 2) + "\n");

const md = `# Milestone 2 · Epic 0 — Hubly Identity & Personality

**Status:** ${passed ? "PASS" : "FAIL"}  
**Release Gate:** Milestone 2 · Epic 0 of 12 (+ Epic 0)

Section 13 defined who Hubly is. Epic 0 makes it **visible**.

## Proven

- Greeting, celebrate, apologize, explain, ask, disagree, encourage, uncertainty, transition  
- First-30-seconds pack  
- Experience Director + Chat OS wire the expression layer  
- Remembered as teammate, not interface  
- Epic 1 (Welcome) still locked — no signup replacement yet  

\`\`\`bash
npm run check:experience-epic0
\`\`\`

**Stop.** Do not start Epic 1 until Founder Approval.
`;

fs.writeFileSync(path.join(root, "docs/EXPERIENCE_EPIC0.md"), md);

if (!passed) {
  console.error("\nEPIC 0 FAIL\n");
  process.exit(1);
}

console.log("\nEPIC 0 PASS — Hubly Identity & Personality (visible)\n");
process.exit(0);
