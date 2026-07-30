import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CREATIVE_BUILD_LABEL,
  CREATIVE_BUILD_VERSION,
  CREATIVE_BUILD_CHOICE_PROMPT,
  ARCHITECT_INTENTS,
  conversationStrategy,
  inferArchitectIntent,
  orchestrateCreativeBuildExperience,
  applyInterruptToBuild,
  evaluateCreativeBuildHtml,
} from "../scripts/lib/creative-build-experience.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, "../public/hubly.html"), "utf8");

test("Hubly Architect module identity", () => {
  assert.equal(CREATIVE_BUILD_LABEL, "Hubly Architect");
  assert.equal(CREATIVE_BUILD_VERSION, "2.0.0");
  assert.match(CREATIVE_BUILD_CHOICE_PROMPT, /three directions/i);
  assert.equal(ARCHITECT_INTENTS.length, 3);
});

test("conversation strategy requires goal, milestone, showNow, decision", () => {
  const s = conversationStrategy({
    goal: "Build my business",
    milestone: "Packages",
    showNow: "Package cards",
    decision: "Keep or tweak",
  });
  assert.equal(s.goal, "Build my business");
  assert.equal(s.milestone, "Packages");
  assert.equal(s.showNow, "Package cards");
  assert.equal(s.decision, "Keep or tweak");
});

test("intent inference covers three core outcomes", () => {
  assert.equal(inferArchitectIntent("I want a storefront for sustainable fashion"), "build");
  assert.equal(inferArchitectIntent("Help me grow with marketing and reviews"), "grow");
  assert.equal(inferArchitectIntent("I need lawn care this weekend"), "get_done");
});

test("build packs recommend three choosable directions", () => {
  const exp = orchestrateCreativeBuildExperience({ industryId: "pressure_washing", seed: "I want a website" });
  assert.equal(exp.directions.length, 3);
  assert.deepEqual(
    exp.directions.map((d) => d.id),
    ["minimal", "bold", "classic"],
  );
});

test("interrupt adapts preview direction", () => {
  const exp = orchestrateCreativeBuildExperience({ industryId: "photography" });
  const r = applyInterruptToBuild(exp, "Make it more premium.");
  assert.equal(r.direction, "bold");
  assert.ok(r.updates.some((u) => /premium/i.test(u.text)));
});

test("Architect HTML shell: chat left, live browser right", () => {
  const evaled = evaluateCreativeBuildHtml(html);
  assert.equal(evaled.passed, true, evaled.issues.join("; "));
  assert.match(html, /data-hubly-architect/);
  assert.match(html, /is-architect-browser/);
  assert.match(html, /Live Sync/);
  assert.match(html, /Hubly Architect/);
  assert.match(html, /is-architect-upload/);
  assert.match(html, /% Built|is-architect-pct/);
  assert.match(html, /Ask Hubly to add features or style guides/);
  assert.match(html, /conversationStrategy|isArchitectEnsureIntent/);
  assert.match(html, /Recommend → Build → Show/);
});
