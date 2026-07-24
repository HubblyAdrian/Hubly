#!/usr/bin/env node
/**
 * Section 13 — Hubly Identity System (Release Gate)
 *
 * Character, not tone. Identity + Constitution. One personality everywhere.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  HUBLY_IS,
  HUBLY_NEVER,
  HUBLY_PHILOSOPHY,
  HUBLY_COMMUNICATION_RULES,
  HUBLY_BEHAVIORAL_RULES,
  HUBLY_CONSTITUTION,
  applyHublyIdentity,
  evaluateAgainstConstitution,
  builderVoice,
  coachingVoice,
  celebrationFor,
  correctionVoice,
  hublyIdentityPreamble,
  getHublyIdentityManifest,
  IDENTITY_SURFACES,
  HublyIdentitySystem,
} from "./lib/identity-system.mjs";

import { ExperienceDirector } from "./lib/experience-director.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const failures = [];
function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failures.push({ name, error: e.message });
    return false;
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nSection 13 — Hubly Identity System\n");

check("core identity traits (is / never)", () => {
  for (const t of ["calm", "confident", "curious", "helpful", "honest", "professional", "optimistic"]) {
    assert.ok(HUBLY_IS.includes(t), t);
  }
  for (const t of ["pushy", "arrogant", "robotic", "overly casual", "salesy"]) {
    assert.ok(HUBLY_NEVER.includes(t), t);
  }
});

check("philosophy beliefs present", () => {
  assert.ok(HUBLY_PHILOSOPHY.some((p) => /Simplicity beats complexity/i.test(p)));
  assert.ok(HUBLY_PHILOSOPHY.some((p) => /one great recommendation/i.test(p)));
  assert.ok(HUBLY_PHILOSOPHY.some((p) => /Explain before acting/i.test(p)));
});

check("communication + behavioral rules", () => {
  assert.ok(HUBLY_COMMUNICATION_RULES.length >= 6);
  assert.ok(HUBLY_BEHAVIORAL_RULES.length >= 4);
  assert.ok(HUBLY_BEHAVIORAL_RULES.some((r) => /isn't sure/i.test(r.when)));
});

check("Hubly Constitution — ten principles", () => {
  assert.equal(HUBLY_CONSTITUTION.length, 10);
  const ids = HUBLY_CONSTITUTION.map((p) => p.id);
  for (const id of [
    "tell_the_truth",
    "dont_pretend",
    "explain_reasoning",
    "respect_owner",
    "prefer_simplicity",
    "dont_overwhelm",
    "build_confidence",
    "recommend_dont_pressure",
    "protect_the_business",
    "leave_better_off",
  ]) {
    assert.ok(ids.includes(id), id);
  }
});

check("Builder voice — not status labels", () => {
  assert.match(builderVoice("Feature created."), /I built that for you/i);
  assert.match(
    builderVoice("Booking rules updated."),
    /I updated your booking rules/i,
  );
  assert.match(builderVoice("Booking rules updated."), /same-day/i);
});

check("Coaching voice — not detection labels", () => {
  assert.match(
    coachingVoice("Low review count detected."),
    /asking three recent customers/i,
  );
  assert.ok(!/detected\./i.test(coachingVoice("Low review count detected.")));
});

check("Celebration system — meaningful, not flashy", () => {
  const first = celebrationFor("first_booking");
  assert.match(first, /first booking/i);
  assert.ok(!/🎉|🔥|!!!/.test(first));
  assert.ok(celebrationFor("website_published"));
  assert.ok(celebrationFor("calendar_connected"));
  assert.ok(celebrationFor("revenue_10k"));
});

check("Correction system — not Error", () => {
  const c = correctionVoice();
  assert.match(c, /looked at this again/i);
  assert.notEqual(c.trim().toLowerCase(), "error.");
  assert.match(applyHublyIdentity("Error.").text, /looked at this again|different approach/i);
});

check("applyHublyIdentity rewrites robotic / salesy lines", () => {
  const a = applyHublyIdentity("Feature created.");
  assert.match(a.text, /I built that for you/i);
  assert.ok(a.rewrites.length >= 1);

  const b = applyHublyIdentity("Low review count detected.");
  assert.match(b.text, /reviews/i);

  const c = applyHublyIdentity("This is a limited-time offer — act now!");
  assert.ok(
    c.actions.some((x) => /pressure|pushy/i.test(x)) ||
      c.constitution.actions.some((x) => /pressure/i.test(x)) ||
      !/act now/i.test(c.text),
  );
});

check("Constitution evaluator flags overwhelm + fake certainty", () => {
  const overwhelm = evaluateAgainstConstitution(
    "Here are ten things you should do: 1 2 3 4 5 6 7 8 9 10",
  );
  assert.equal(overwhelm.ok, false);
  assert.ok(overwhelm.violations.some((v) => v.principleId === "dont_overwhelm"));

  const fake = evaluateAgainstConstitution("I'm 100% certain this will double your revenue.");
  assert.equal(fake.ok, false);
  assert.ok(fake.violations.some((v) => v.principleId === "dont_pretend"));
});

check("Constitution evaluator passes honest coaching", () => {
  const r = evaluateAgainstConstitution(
    "I think asking three recent customers for reviews would make a meaningful difference because social proof builds trust.",
  );
  assert.equal(r.ok, true);
});

check("Identity preamble for every surface", () => {
  const p = hublyIdentityPreamble();
  assert.match(p, /Hubly Identity System/);
  assert.match(p, /Constitution/);
  assert.match(p, /Builder voice/);
  assert.match(p, /Coaching voice/);
  assert.ok(IDENTITY_SURFACES.includes("builder_engine"));
  assert.ok(IDENTITY_SURFACES.includes("hubly_daily"));
  assert.ok(IDENTITY_SURFACES.includes("business_home"));
});

check("Experience Director enforces Identity + Constitution", () => {
  const ed = ExperienceDirector.evaluate({
    draftResponse: "Feature created.",
    businessId: "b1",
    surface: "builder",
  });
  assert.match(ed.finalResponse, /I built that for you/i);
  assert.ok(ed.checks.some((c) => c.name === "identity_system" && c.ok));
  assert.ok(ed.checks.some((c) => c.name === "hubly_constitution"));
  assert.ok(Array.isArray(ed.identity.constitution.principlesChecked));
  assert.ok(ed.identity.constitution.principlesChecked.length === 10);
});

check("HublyAI sole gate — Identity System exported; preamble is Identity", () => {
  const aiSrc = read("supabase/functions/_shared/hubly_ai.ts");
  assert.match(aiSrc, /HublyIdentitySystem/);
  assert.match(aiSrc, /hublyIdentityPreamble/);
  assert.match(aiSrc, /from ["'].*hubly_brain_identity_system/);
  assert.equal(typeof HublyIdentitySystem.applyHublyIdentity, "function");
  assert.equal(typeof HublyIdentitySystem.evaluateAgainstConstitution, "function");
  assert.equal(typeof HublyIdentitySystem.HUBLY_CONSTITUTION, "object");
  const pre = hublyIdentityPreamble();
  assert.match(pre, /Identity System|Constitution/i);
  // personalityPreamble must delegate to Identity (source proof)
  assert.match(aiSrc, /function personalityPreamble[\s\S]*hublyIdentityPreamble\(\)/);
});

check("manifest is complete character spec", () => {
  const m = getHublyIdentityManifest();
  assert.equal(m.name, "Hubly Identity System");
  assert.ok(m.is.length >= 7);
  assert.ok(m.never.length >= 5);
  assert.equal(m.constitution.length, 10);
  assert.ok(m.surfaces.length >= 6);
});

check("source files exist", () => {
  for (const rel of [
    "supabase/functions/_shared/hubly_brain_identity_system.ts",
    "scripts/lib/identity-system.mjs",
    "docs/HUBLY_BRAIN_SECTION13.md",
  ]) {
    assert.ok(fs.existsSync(path.join(root, rel)), rel);
  }
  const src = read("supabase/functions/_shared/hubly_brain_identity_system.ts");
  assert.match(src, /HUBLY_CONSTITUTION/);
  assert.match(src, /applyHublyIdentity/);
  assert.match(src, /builderVoice/);
  assert.match(src, /celebrationFor/);
  const ed = read("supabase/functions/_shared/hubly_brain_experience_director.ts");
  assert.match(ed, /applyHublyIdentity/);
  assert.match(ed, /evaluateAgainstConstitution/);
});

if (failures.length) {
  console.error(`\nFAILED ${failures.length} check(s)\n`);
  process.exit(1);
}

const proof = {
  section: 13,
  name: "Hubly Identity System",
  status: "pass",
  passed: true,
  provenAt: new Date().toISOString(),
  summary:
    "Hubly Identity System defines character (not tone): core traits, philosophy, communication & behavioral rules, Builder/Coaching/Celebration/Correction voices, and the Hubly Constitution — the permanent behavioral contract evaluated on every Experience Director pass. One identity across chat, Builder, Business Home, Daily, onboarding, and website edit.",
  proofs: {
    coreIdentity: { is: [...HUBLY_IS], never: [...HUBLY_NEVER] },
    philosophy: [...HUBLY_PHILOSOPHY],
    constitution: HUBLY_CONSTITUTION.map((p) => ({ id: p.id, title: p.title })),
    builderVoice: builderVoice("Feature created."),
    coachingVoice: coachingVoice("Low review count detected."),
    celebration: celebrationFor("first_booking"),
    correction: correctionVoice(),
    surfaces: [...IDENTITY_SURFACES],
    experienceDirectorEnforces: true,
    hublyAiSoleGateExportsIdentity: true,
  },
};

fs.writeFileSync(
  path.join(root, "docs/HUBLY_BRAIN_SECTION13_PROOF.json"),
  JSON.stringify(proof, null, 2) + "\n",
);
console.log("\nWrote docs/HUBLY_BRAIN_SECTION13_PROOF.json");
console.log("Section 13 PASS\n");
process.exit(0);
