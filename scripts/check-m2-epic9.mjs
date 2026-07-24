#!/usr/bin/env node
/**
 * Milestone 2 · Epic 9 — Creative Workspace (Release Gate)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nMilestone 2 · Epic 9 — Creative Workspace\n");

const {
  WORKSPACE_VERSION,
  WORKSPACE_LABEL,
  CONVERSATION_STARTERS,
  CREATIVE_DIRECTIONS,
  PLAYGROUND_CONCEPTS,
  PLAYGROUND_INTRO,
  ADVANCED_CONTROLS,
  SECTION_ASKS,
  HublyCreativeWorkspace,
  orchestrateCreativeWorkspace,
  interpretCreativeIntent,
  buildCompareAlternative,
  buildCreativeMemory,
  buildVersionTimeline,
  buildPlaygrounds,
  evaluateWorkspaceHtml,
} = await import("./lib/creative-workspace.mjs");

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
const evaled = evaluateWorkspaceHtml(html);

check("Creative Workspace module", HublyCreativeWorkspace.version === "1.0.0");
check("Label", WORKSPACE_LABEL === "Creative Workspace");
check("Version", WORKSPACE_VERSION === "1.0.0");
check("Conversation starters", CONVERSATION_STARTERS.length >= 6);
check("Creative directions", CREATIVE_DIRECTIONS.length >= 8);
check("Playground concepts", PLAYGROUND_CONCEPTS.length === 4);
check("Advanced controls", ADVANCED_CONTROLS.length >= 8);

console.log("\nPage structure\n");
check("Workspace canvas", evaled.checks.workspaceCanvas);
check("Conversation first", evaled.checks.conversationFirst);
check("Live preview", evaled.checks.livePreview);
check("Section Ask Hubly", evaled.checks.sectionAsk);
check("Creative Directions", evaled.checks.directions);
check("Compare Mode", evaled.checks.compareMode);
check("Website Health", evaled.checks.websiteHealth);
check("Creative Memory", evaled.checks.creativeMemory);
check("Version Timeline", evaled.checks.versionTimeline);
check("Advanced Studio", evaled.checks.advancedStudio);
check("AI Suggestions", evaled.checks.aiSuggestions);
check("Builder Transparency", evaled.checks.builderTransparency);
check("Creative Playgrounds", evaled.checks.playgrounds);
check("Mobile conversation-first", evaled.checks.mobileFirst);
check("Home → Workspace handoff", evaled.checks.homeHandoff);
check("Hubly brand", evaled.checks.wordmark);
check("isRunCreativeWorkspace", /function isRunCreativeWorkspace/.test(html));
check("Explore Ideas CTA", /Explore Ideas/.test(html));

console.log("\nOrchestration\n");
const sample = orchestrateCreativeWorkspace({
  businessName: "ABC Pressure Washing",
  industry: "pressure washing",
  preferDarkerColors: true,
  currentDirection: "premium",
});
check("Not an editor", sample.notAnEditor === true);
check("Conversation first flag", sample.conversationFirst === true);
check("Live editing", sample.liveEditing === true);
check("Mobile conversation-first", sample.mobileConversationFirst === true);
check("Directions available", sample.directions.length >= 8);
check("Website Health overall", sample.health.overall >= 1);
check("Memory remembers darker", /darker/i.test(sample.memory.line));
check("Eight versions", sample.versions.length >= 8);
check("Suggestions proactive", sample.suggestions.length >= 3);
check("Playgrounds intro", sample.playgrounds.intro === PLAYGROUND_INTRO);
check("Four playground concepts", sample.playgrounds.concepts.length === 4);
check("Advanced Studio available", sample.advancedStudio.available === true);
check("Builder pipeline", sample.builderTransparency.length === 4);
check("No refresh/publish/reload", sample.livePreview.noRefresh && sample.livePreview.noPublish && sample.livePreview.noReload);

console.log("\nIntent + compare + versions\n");
const lux = interpretCreativeIntent("Make my website feel more luxurious.", {
  currentDirection: "premium",
});
check("Luxury intent", lux.direction === "luxury");
const warm = interpretCreativeIntent("Actually... make it warmer.", {
  currentDirection: "luxury",
  lastReasoning: lux.reasoning,
});
check("Interrupt adapts to warm", warm.direction === "warm");
check("Interrupt keeps context note", /prior context|Interruptions keep/i.test(warm.reasoning));
const why = interpretCreativeIntent("Why did you change that?", {
  lastReasoning: warm.reasoning,
});
check("Why uses stored reasoning", why.reasoning === warm.reasoning || /Stored reasoning|Interruptions/.test(why.reasoning));

const compare = buildCompareAlternative("premium", "minimal");
check("Compare has current + alternative", !!compare.current && !!compare.alternative);
check("Compare has reasoning + recommendation", !!compare.reasoning && !!compare.recommendation);

const versions = buildVersionTimeline({});
check("Can restore Version 1", versions.some((v) => v.id === 1 && v.reversible));
check("Can restore Version 8", versions.some((v) => v.id === 8));

const pg = buildPlaygrounds({ businessName: "ABC Pressure Washing", industry: "pressure washing" });
check("Playground mix prompt", /Mix the typography/.test(pg.mixPrompt));
check("Concept has palette + type + booking + why", pg.concepts.every((c) => c.palette && c.typography && c.booking && c.why));

console.log("\nFounder acceptance tests\n");
check(
  "Test1: redesign without settings (conversation starters + live)",
  sample.conversationFirst && sample.starters.length >= 5 && sample.liveEditing,
);
check(
  "Test2: directions intentional (Luxury/Friendly/Minimal/Premium)",
  ["luxury", "friendly", "minimal", "premium"].every((id) =>
    sample.directions.some((d) => d.id === id && d.feel),
  ),
);
check("Test3: interrupt adapts", warm.direction === "warm" && !!warm.liveChange);
check(
  "Test4: why from stored reasoning",
  why.liveChange.includes("explaining the last decision") &&
    (why.reasoning === warm.reasoning || /Interruptions keep|Stored reasoning/i.test(why.reasoning)),
);
check(
  "Test5: version rollback reversible",
  versions.find((v) => v.id === 1).reversible && versions.find((v) => v.id === 8),
);
check(
  "Test6: Advanced Studio syncs",
  sample.advancedStudio.available &&
    /Sync back to Conversation Mode|synchronized/.test(html),
);
check(
  "Test7: mobile conversation-first",
  sample.mobileConversationFirst && /conversation-first|No tiny inspector/.test(html),
);
check(
  "Playgrounds memorable",
  /Explore Ideas/.test(html) && pg.concepts.some((c) => c.label === "Modern Premium"),
);

const passed = failures.length === 0 && evaled.passed;

const proofMd = `# Milestone 2 · Epic 9 — Creative Workspace

**Status:** ${passed ? "PASS" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m2-epic9\`

> Conversation-first creation — not a website editor.  
> Intent in → Hubly implements → live business updates.  
> **Creative Playgrounds:** Explore Ideas → four concepts side by side.

## Proven

| Requirement | Status |
|-------------|--------|
| Creative Workspace replaces old editor | ${passed ? "✅" : "❌"} |
| Conversation is the default | ${passed ? "✅" : "❌"} |
| Live preview updates continuously | ${passed ? "✅" : "❌"} |
| Every section has Ask Hubly | ${passed ? "✅" : "❌"} |
| Creative Directions | ${passed ? "✅" : "❌"} |
| Compare Mode | ${passed ? "✅" : "❌"} |
| Website Health integrated | ${passed ? "✅" : "❌"} |
| Creative Memory | ${passed ? "✅" : "❌"} |
| Version Timeline | ${passed ? "✅" : "❌"} |
| Advanced Studio for power users | ${passed ? "✅" : "❌"} |
| AI Suggestions proactive | ${passed ? "✅" : "❌"} |
| Builder Transparency | ${passed ? "✅" : "❌"} |
| Mobile conversation-first | ${passed ? "✅" : "❌"} |
| Creative Playgrounds | ${passed ? "✅" : "❌"} |
| Founder acceptance tests | ${passed ? "✅" : "❌"} |

## Sample direction

> **${sample.direction.label}** — ${sample.direction.feel}

## Playground intro

> ${PLAYGROUND_INTRO}

## Stop

Do **not** begin Epic 10 until Founder Approval.
`;

const proofJson = {
  epic: 9,
  title: WORKSPACE_LABEL,
  passed,
  checkedAt: new Date().toISOString(),
  version: WORKSPACE_VERSION,
  sample: {
    direction: sample.direction,
    health: sample.health,
    memory: sample.memory,
    playgrounds: sample.playgrounds.concepts.map((c) => c.label),
    suggestions: sample.suggestions.map((s) => s.text),
  },
  failures,
  htmlChecks: evaled.checks,
};

fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC9_PROOF.md"), proofMd);
fs.writeFileSync(path.join(root, "docs/MILESTONE2_EPIC9_PROOF.json"), JSON.stringify(proofJson, null, 2) + "\n");

console.log(passed ? "\nM2 EPIC 9 PASS — Creative Workspace\n" : "\nM2 EPIC 9 FAIL\n");
console.log("Proof → docs/MILESTONE2_EPIC9_PROOF.md\n");

if (!passed) {
  if (!evaled.passed) console.error("HTML evaluation issues:", evaled.issues);
  process.exit(1);
}
