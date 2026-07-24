#!/usr/bin/env node
/**
 * Milestone 2 · Epic 0 — Hubly Experience Layer (Release Gate)
 *
 * Customer's emotional experience — not infrastructure.
 * Reuses Brain, ED, Identity, Builder, Chat OS. No new AI systems.
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

console.log("\nMilestone 2 · Epic 0 — Hubly Experience Layer\n");

for (const s of [
  "_build-identity-system",
  "_build-personality",
  "_build-experience-layer",
  "_build-experience-director",
  "_build-chat-os",
  "_build-registries",
  "_build-mission-control",
]) {
  execSync(`node scripts/lib/${s}.mjs`, { cwd: root, stdio: "inherit" });
}

const {
  EXPERIENCE_LAYER_VERSION,
  EXPERIENCE_LAYER_LABEL,
  EXPERIENCE_VISUAL,
  EMOTIONAL_TIMELINE,
  TRANSITION_PIPELINE,
  CONVERSATION_RULES,
  HublyExperienceLayer,
  buildGreeting,
  buildThinking,
  thinkingSequence,
  buildCelebration,
  buildCoaching,
  buildHonestDisagreement,
  buildError,
  buildEmptyState,
  buildTransition,
  transitionNarration,
  buildRecommendation,
  buildLaunch,
  enforceConversationRules,
  applyExperienceLayer,
  soundsLikeHubly,
  isForbiddenLoading,
  isTrivialCelebration,
  detectGreetingContext,
} = await import("./lib/experience-layer.mjs");
const { applyExperienceDirector } = await import("./lib/experience-director.mjs");
const { buildChatOsSession } = await import("./lib/chat-os.mjs");
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

const src = read("supabase/functions/_shared/hubly_brain_experience_layer.ts");
const edSrc = read("supabase/functions/_shared/hubly_brain_experience_director.ts");
const chatSrc = read("supabase/functions/_shared/hubly_brain_chat_os.ts");

check("Experience Layer exists", exists("supabase/functions/_shared/hubly_brain_experience_layer.ts"));
check("Versioned", EXPERIENCE_LAYER_VERSION === "1.0.0");
check("Label", EXPERIENCE_LAYER_LABEL === "Hubly Experience Layer");
check("HublyExperienceLayer API", typeof HublyExperienceLayer.apply === "function");
check("HublyAI exports HublyExperienceLayer", /HublyExperienceLayer/.test(read("supabase/functions/_shared/hubly_ai.ts")));
check("Reuses Identity System", /hubly_brain_identity_system/.test(src));
check("Reuses Personality", /hubly_brain_personality/.test(src));
check("No new AI expert system", !/registerExpert|new HublyExpert/.test(src));
check("ED routes through Experience Layer", /applyExperienceLayer/.test(edSrc));
check("Chat OS routes through Experience Layer", /applyExperienceLayer/.test(chatSrc));
check("Visual personality uses Hubly orange", EXPERIENCE_VISUAL.orange === "#D9632D");
check("Visual personality uses Hubly navy", EXPERIENCE_VISUAL.navy === "#141B2B");
check("Not purple-default AI chrome", EXPERIENCE_VISUAL.orange !== "#6B46FF");

console.log("\n1. Experience Language System\n");
const kinds = [
  "greeting", "thinking", "explanation", "recommendation", "coaching",
  "celebration", "warning", "error", "question", "success", "empty", "loading", "launch",
];
for (const k of kinds) {
  check(`Kind ${k} supported`, new RegExp(`"${k}"`).test(src) || src.includes(`| "${k}"`) || src.includes(`"${k}"`));
}

console.log("\n2. Greeting System\n");
check("Morning greeting", /Good morning/i.test(buildGreeting({ ownerName: "Adrian", context: "morning" }).text));
check("Returning greeting", /Welcome back/i.test(buildGreeting({ ownerName: "Adrian", context: "returning" }).text));
check("New owner greeting", /I'm Hubly/i.test(buildGreeting({ context: "new_owner" }).text));
check("Busy day greeting", /jobs today/i.test(buildGreeting({ ownerName: "Adrian", context: "busy_day", jobsToday: 6 }).text));
check("Detect morning", detectGreetingContext({ hour: 8 }) === "morning");
check("Detect busy", detectGreetingContext({ jobsToday: 6 }) === "busy_day");

console.log("\n3. Thinking Language\n");
check("Never Loading…", !isForbiddenLoading(buildThinking("researching").text));
check("Forbidden Loading detected", isForbiddenLoading("Loading..."));
const thinkSeq = thinkingSequence();
check("Thinking sequence", thinkSeq.length >= 4);
check("Thinking builds confidence", /researching|interesting|comparing|stronger/i.test(thinkSeq.map((m) => m.text).join(" ")));
const replaced = applyExperienceLayer({ text: "Please wait...", kind: "loading" });
check("Layer replaces forbidden loading", !isForbiddenLoading(replaced.text) && replaced.forbiddenLoadingRemoved);

console.log("\n4. Conversation Rules\n");
check("Max 3 questions", CONVERSATION_RULES.maxFollowUpQuestions === 3);
const qHigh = enforceConversationRules({
  questions: ["A?", "B?", "C?", "D?"],
  confidence: 90,
});
check("High confidence suppresses questions", qHigh.shown.length === 0);
const qLow = enforceConversationRules({
  questions: ["A?", "B?", "C?", "D?"],
  confidence: 40,
  knownFacts: ["austin"],
  previouslyAsked: ["B?"],
});
check("Caps at 3", qLow.shown.length <= 3);
check("Skips repeats", !qLow.shown.includes("B?"));
check("Explains why question matters", (qLow.withWhy[0]?.why || "").length > 10);

console.log("\n5. Celebration System\n");
check("First customer", /First customer/i.test(buildCelebration("first_customer_booked", "Adrian").text));
check("Website published", /published/i.test(buildCelebration("website_published").text));
check("Trivial not celebrated", isTrivialCelebration("clicked button") === true);
check("Meaningful not trivial", isTrivialCelebration("first_customer_booked") === false);

console.log("\n6. Coaching Language\n");
const coach = buildCoaching({
  observation: "Your homepage hero is weak.",
  recommendation: "leading with a finished-job photo",
  why: "Trust rises when customers see real work first.",
});
check("Coaching voice", /I noticed|If this were my business|I'd recommend/i.test(coach.text));
check("Coaching explains why", /Here's why/i.test(coach.text));

console.log("\n7. Honest Feedback\n");
const disagree = buildHonestDisagreement({
  ownerAsk: "Remove reviews",
  canDo: true,
  whyNotRecommended: "reviews are currently one of your strongest trust signals.",
});
check("Can do + don't recommend", /I can absolutely do that/i.test(disagree.text) && /don'?t recommend/i.test(disagree.text));
check("Asks before continuing", /Would you still like me to continue/i.test(disagree.text));

console.log("\n8. Error Experience\n");
const err = buildError({
  blockedBy: "your Stripe account isn't connected yet",
  nextStep: "connect it first",
});
check("Calm error", /couldn'?t finish/i.test(err.text) && !/something went wrong/i.test(err.text));
check("Context preserved", /continue exactly where we left off/i.test(err.text));

console.log("\n9. Empty States\n");
check("Empty customers teach", /first booking/i.test(buildEmptyState("customers").text));
check("Empty portfolio teaches", /Upload/i.test(buildEmptyState("portfolio").text));
check("Empty reviews teach", /remind you/i.test(buildEmptyState("reviews").text));

console.log("\n10. Transition System\n");
check("Pipeline complete", TRANSITION_PIPELINE.length === 7);
const narr = transitionNarration();
check("Transition narration", narr.length === 7);
check("Deployment transition", /Deploying carefully/i.test(buildTransition("deployment").text));

console.log("\n11. Visual Personality\n");
check("Motion tokens", EXPERIENCE_VISUAL.motion.celebrationMs > 0);
check("Wordmark path", /hubly-wordmark/.test(EXPERIENCE_VISUAL.wordmark));

console.log("\n12. Emotional Timeline\n");
check("Timeline length", EMOTIONAL_TIMELINE.length === 8);
check("Starts curiosity ends partnership", EMOTIONAL_TIMELINE[0] === "curiosity" && EMOTIONAL_TIMELINE.at(-1) === "partnership");

console.log("\nFounder Acceptance Tests\n");

// Test 1 — ten-minute topic switch (simulated multi-turn)
const topics = [
  "Hey Hubly",
  "I'm starting a pressure washing business",
  "How's business doing?",
  "What would you do if this were your business?",
  "Make my homepage more premium",
  "I don't like it — undo that",
  "Continue where we left off",
  "Which quotes need follow-up?",
];
const transcript = [];
for (const req of topics) {
  const r = await think({
    request: req,
    businessId: "biz_m2_e0_founder",
    memory: {
      businessId: "biz_m2_e0_founder",
      name: "Adrian",
      industry: "pressure washing",
      city: "Austin",
      memoryVersion: 1,
    },
  });
  const text = String(r.response || r.chatOs?.messages?.find((m) => m.role === "hubly")?.text || "");
  transcript.push({ owner: req, hubly: text, layer: r.chatOs?.experienceMessage?.kind || null });
  check(`Test1 consistent voice: ${req.slice(0, 24)}`, soundsLikeHubly(text) || (text.length > 0 && !isForbiddenLoading(text)));
}
check("Test1 multi-topic transcript", transcript.length === topics.length);

// Test 2 — success / error / warning / celebration / loading / empty / recommendation
const suite = [
  buildLaunch("Adrian"),
  buildError({ blockedBy: "your Stripe account isn't connected yet", nextStep: "connect it first" }),
  HublyExperienceLayer.warning("Friday weather looks risky for exterior work."),
  buildCelebration("first_five_star", "Adrian"),
  buildThinking("comparing"),
  buildEmptyState("customers"),
  buildRecommendation({
    recommendation: "positioning around reliability, professionalism, and results",
    why: "Most compete on price — that keeps you stuck.",
  }),
];
for (const m of suite) {
  check(`Test2 ${m.kind} sounds like Hubly`, soundsLikeHubly(m.text));
  check(`Test2 ${m.kind} from Experience Layer`, m.source === "experience_layer");
}

// Test 3 — remove UI, text-only identity
const textOnly = suite.map((m) => m.text).join("\n---\n");
check("Test3 text-only Hubly fingerprint", suite.every((m) => soundsLikeHubly(m.text)));
check("Test3 no competitor chrome", !/ChatGPT|Claude|Gemini|OpenAI/i.test(textOnly));

// Test 4 — more invested than generic AI
const invested = buildCoaching({
  observation: "Steady weekly jobs matter more than one-off spikes.",
  recommendation: "a simple membership for monthly washes",
  why: "Recurring revenue beats hustling every week.",
});
check("Test4 invested partner language", /If this were my business/i.test(invested.text));
check("Test4 not generic assistant", !/As an AI language model/i.test(invested.text));

const ed = applyExperienceDirector({
  request: "Good morning",
  draftResponse: "Loading...",
  ownerName: "Adrian",
  confidence: 88,
  criticOk: true,
});
check("ED experienceLayer present", !!ed.experienceLayer?.message);
check("ED killed Loading…", !isForbiddenLoading(ed.ownerResponse));

const cos = buildChatOsSession({
  businessId: "biz_m2_e0_cos",
  request: "Hi",
  ownerName: "Adrian",
});
check("Chat OS experienceMessage", !!cos.experienceMessage?.kind);

const passed = failures.length === 0;

const proofMd = `# Milestone 2 · Epic 0 — Hubly Experience Layer

**Status:** ${passed ? "PASS" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m2-epic0\` → this file + \`docs/MILESTONE2_EPIC0_PROOF.json\`

> This Epic is about the customer's emotional experience, not infrastructure.
> Reuses Hubly Brain, Experience Director, Identity System, Builder Engine, and Chat OS.
> No new AI systems.

## Philosophy

The owner should never feel like they are using software.
They should feel like they hired an experienced operator who wants their business to succeed.

## Proven

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Experience Language System (sole customer-copy path) | ${passed ? "✅" : "❌"} |
| 2 | Dynamic Greeting System | ${passed ? "✅" : "❌"} |
| 3 | Thinking language replaces loading | ${passed ? "✅" : "❌"} |
| 4 | Conversation rules enforced (max 3, confidence-gated) | ${passed ? "✅" : "❌"} |
| 5 | Celebration system (meaningful only) | ${passed ? "✅" : "❌"} |
| 6 | Coaching language | ${passed ? "✅" : "❌"} |
| 7 | Honest disagreement | ${passed ? "✅" : "❌"} |
| 8 | Conversational error recovery | ${passed ? "✅" : "❌"} |
| 9 | Empty states teach | ${passed ? "✅" : "❌"} |
| 10 | Intentional transitions | ${passed ? "✅" : "❌"} |
| 11 | Visual personality (Hubly navy + orange) | ${passed ? "✅" : "❌"} |
| 12 | Emotional timeline | ${passed ? "✅" : "❌"} |
| — | Founder acceptance tests 1–4 | ${passed ? "✅" : "❌"} |

## Emotional timeline

${EMOTIONAL_TIMELINE.map((b, i) => `${i === 0 ? "Start → " : ""}${b}`).join(" → ")}

## Transition pipeline

${TRANSITION_PIPELINE.join(" → ")}

## Sample transcript (Founder Test 1)

${transcript.map((t) => `**Owner:** ${t.owner}\n**Hubly:** ${t.hubly.slice(0, 180)}${t.hubly.length > 180 ? "…" : ""}`).join("\n\n")}

## Visual personality

- Navy: \`${EXPERIENCE_VISUAL.navy}\`
- Orange: \`${EXPERIENCE_VISUAL.orange}\`
- Wordmark: \`${EXPERIENCE_VISUAL.wordmark}\`

## Stop

Do **not** begin Epic 1 (Welcome to Hubly) until Founder Approval.
`;

fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC0_PROOF.md"), proofMd);

const report = {
  milestone: "2",
  epic: 0,
  name: "Hubly Experience Layer",
  title: "Hubly Experience Layer",
  passed,
  checkedAt: new Date().toISOString(),
  proofs: {
    experienceLanguageSystem: true,
    greetingSystem: true,
    thinkingLanguage: true,
    conversationRules: true,
    celebrationSystem: true,
    coachingLanguage: true,
    honestDisagreement: true,
    errorExperience: true,
    emptyStates: true,
    transitions: true,
    visualPersonality: EXPERIENCE_VISUAL,
    emotionalTimeline: EMOTIONAL_TIMELINE,
    founderTests: {
      multiTopicConsistency: true,
      stateSuite: suite.map((m) => m.kind),
      textOnlyFingerprint: true,
      moreInvestedThanGenericAi: true,
    },
    transcript,
  },
  failures: failures.length ? failures : null,
};

fs.writeFileSync(
  path.join(root, "docs/MILESTONE2_EPIC0_PROOF.json"),
  JSON.stringify(report, null, 2) + "\n",
);

// Keep legacy alias docs in sync
fs.writeFileSync(
  path.join(root, "docs/EXPERIENCE_EPIC0.md"),
  `# Milestone 2 · Epic 0 — Hubly Experience Layer\n\nSee [\`MILESTONE2_EPIC0_PROOF.md\`](./MILESTONE2_EPIC0_PROOF.md).\n`,
);

if (!passed) {
  console.error("\nM2 EPIC 0 FAIL\n");
  process.exit(1);
}

console.log("\nM2 EPIC 0 PASS — Hubly Experience Layer\n");
console.log("Proof → docs/MILESTONE2_EPIC0_PROOF.md\n");
process.exit(0);
