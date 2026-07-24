#!/usr/bin/env node
/**
 * Section 15 — Platform Extensibility (Release Gate)
 *
 * Can Hubly evolve without engineers rewriting the core?
 * Register modules — don't rewrite Brain.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PLATFORM_VERSION,
  PLATFORM_OWNER,
  HUBLY_BRAIN_PLATFORM_VERSION,
  UI_EXTENSION_POINTS,
  validateFeatureManifest,
  clearPlatformForTests,
  demoPlatformExtensibility,
  getPlatformInventory,
  listFeatureManifests,
  listPlatformLogs,
  registerBuilderModule,
  unregisterBuilderModule,
  registerIndustryDnaPack,
  unregisterIndustryDnaPack,
  HublyPlatform,
} from "./lib/platform.mjs";

import {
  clearRegistryForTests,
  discoverExperts,
  isExpertRegistered,
} from "./lib/expert-framework.mjs";
import { clearRegistriesForTests, ensureRegistriesBootstrapped, whoOwnsCapability } from "./lib/registries.mjs";
import { clearDnaIndustryPacksForTests, loadBusinessDnaKnowledge } from "./lib/dna-knowledge.mjs";
import { clearMissionControlForTests, getMissionControlSnapshot } from "./lib/mission-control.mjs";
import { resetExpertsForTests, ensureExpertsRegistered } from "./lib/initial-experts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const failures = [];
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failures.push({ name, error: e.message });
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

clearPlatformForTests();
clearDnaIndustryPacksForTests();
clearRegistriesForTests();
clearRegistryForTests();
clearMissionControlForTests();
resetExpertsForTests();
ensureExpertsRegistered();
ensureRegistriesBootstrapped();

console.log("\nSection 15 — Platform Extensibility\n");

await check("platform module + Feature Manifest contract", () => {
  assert.equal(PLATFORM_VERSION, "1.0.0");
  assert.equal(PLATFORM_OWNER, "hubly_brain");
  assert.equal(HUBLY_BRAIN_PLATFORM_VERSION, "1.0.0");
  assert.ok(UI_EXTENSION_POINTS.length >= 4);
  assert.ok(UI_EXTENSION_POINTS.every((u) => u.status === "reserved"));
  assert.equal(typeof HublyPlatform.inventory, "function");
  assert.equal(typeof HublyPlatform.validate, "function");
});

await check("extension validation rejects incomplete / incompatible manifests", () => {
  const missing = validateFeatureManifest({ id: "x", kind: "expert" });
  assert.equal(missing.ok, false);
  assert.ok(missing.issues.some((i) => i.code === "missing_metadata"));

  const incompat = validateFeatureManifest({
    id: "expert.future",
    name: "Future",
    version: "1.0.0",
    kind: "expert",
    owner: "test",
    capabilities: [],
    dependencies: [],
    requiredPermissions: [],
    configurationSchema: {},
    health: "healthy",
    documentationLink: "n/a",
    minHublyBrainVersion: "99.0.0",
    supportedCapabilities: [],
    migrationRequirements: [],
  });
  assert.equal(incompat.ok, false);
  assert.ok(incompat.issues.some((i) => i.code === "incompatible_brain_version"));
});

await check("full demo: register → discover → execute → unregister (no Brain rewrite)", async () => {
  const demo = await demoPlatformExtensibility();
  assert.ok(demo.registered.includes("expert.seo_expert"));
  assert.ok(demo.registered.includes("builder.scheduling_builder"));
  assert.ok(demo.registered.includes("industry.pool_cleaning"));
  assert.ok(demo.registered.includes("knowledge.google_business_profile"));
  assert.ok(demo.registered.includes("capability.maps_travel"));
  assert.ok(demo.registered.includes("integration.mock_quickbooks"));
  assert.ok(demo.registered.includes("workflow.new_review_followup"));
  assert.ok(demo.discovered.includes("seo_expert"));
  assert.equal(demo.executed.ok, true);
  assert.match(demo.executed.summary, /seo|title|city/i);
  assert.ok(demo.whoOwns);
  assert.equal(demo.whoOwns.toolId, "scheduling_builder");
  assert.equal(demo.whoOwns.capabilityId, "estimate_travel_time");
  assert.equal(demo.industryLoaded, "Pool Cleaning");
  assert.equal(demo.knowledgeFound, true);
  assert.equal(demo.integrationFound, true);
  assert.equal(demo.workflowFound, true);
  assert.equal(demo.validationRejected, true);
  assert.equal(demo.brainUntouched, true);
  assert.ok(demo.unregistered.length >= 7);

  // Clean removal proven
  assert.equal(isExpertRegistered("seo_expert"), false);
  assert.ok(!discoverExperts().some((e) => e.id === "seo_expert"));
  assert.equal(whoOwnsCapability("estimate_travel_time"), null);
});

await check("industry DNA pack loads via Brain DNA loader (no app code change)", async () => {
  clearPlatformForTests();
  clearDnaIndustryPacksForTests();
  registerIndustryDnaPack("pest control", {
    schemaVersion: "1.0.0",
    knowledgeVersion: 1,
    loadedAt: new Date().toISOString(),
    loadedBy: "hubly_brain",
    industryProfile: {
      industryName: "Pest Control",
      businessCategories: ["home services"],
      typicalBusinessStages: ["starting"],
      commonBusinessModels: ["route"],
      serviceDeliveryMethods: ["on-site"],
    },
    customerPsychology: {
      buyingTriggers: ["sighting"],
      buyingFears: ["toxicity"],
      trustBuilders: ["licensed"],
      decisionSpeed: "urgent",
      priceSensitivity: "moderate",
      emotionalMotivations: ["safety"],
      commonObjections: ["price"],
    },
    trustSignals: { signals: ["License"], rankedByImportance: ["License"] },
    serviceRelationships: {
      primaryServices: ["general pest"],
      upsells: [],
      crossSells: [],
      seasonalServices: [],
      serviceBundles: [],
      membershipOpportunities: [],
    },
    pricingIntelligence: {
      typicalPricingModels: ["per visit"],
      customerExpectations: ["clear"],
      premiumPositioningOpportunities: [],
      valuePositioning: [],
      discountRisks: [],
    },
    websiteIntelligence: {
      recommendedHomepageOrder: ["Hero", "Trust", "Book"],
      highConvertingLayouts: [],
      bookingBestPractices: [],
      galleryRecommendations: [],
      ctaStrategy: [],
      contentPriorities: [],
    },
    growthIntelligence: {
      growthOpportunities: [],
      referralIdeas: [],
      membershipIdeas: [],
      reviewStrategies: [],
      customerRetentionIdeas: [],
      expansionOpportunities: [],
    },
    seasonality: {
      busySeasons: ["summer"],
      slowSeasons: ["winter"],
      weatherImpact: [],
      holidayOpportunities: [],
      regionalSeasonality: [],
    },
    regionalIntelligence: {
      country: "US",
      state: null,
      city: null,
      climate: null,
      regionalBuyingBehavior: [],
      localTerminology: [],
    },
    communityLearning: {
      enabled: false,
      automaticLearning: false,
      version: 0,
      evidence: [],
      confidence: 0,
      source: "test",
      communityLearnings: [],
      validationHistory: [],
    },
    evidence: [],
  });
  const pack = loadBusinessDnaKnowledge({ industry: "pest control" });
  assert.equal(pack.industryProfile.industryName, "Pest Control");
  unregisterIndustryDnaPack("pest control");
});

await check("Mission Control surfaces Feature Manifest inventory", async () => {
  clearPlatformForTests();
  registerBuilderModule({
    id: "website_builder",
    name: "Website Builder",
    version: "0.1.0",
    purpose: "Website builder module",
    milestone: "1.5",
    capabilities: ["publish_site"],
  });
  const inv = getPlatformInventory();
  assert.equal(inv.title, "Hubly Platform Inventory");
  assert.ok(inv.totals.builders >= 1);
  assert.ok(inv.manifests.some((m) => m.id === "builder.website_builder"));
  assert.ok(inv.uiExtensionPoints.length >= 4);

  const snap = getMissionControlSnapshot();
  assert.ok(snap.platformInventory);
  assert.ok(snap.platformInventory.manifests.some((m) => m.kind === "builder_module"));
  unregisterBuilderModule("website_builder");
});

await check("registration + validation logs recorded", async () => {
  clearPlatformForTests();
  const demo = await demoPlatformExtensibility();
  const logs = listPlatformLogs(200);
  assert.ok(logs.some((l) => l.event === "register" && l.kind === "expert"));
  assert.ok(logs.some((l) => l.event === "register" && l.kind === "builder_module"));
  assert.ok(logs.some((l) => l.event === "register" && l.kind === "industry_dna"));
  assert.ok(logs.some((l) => l.event === "register" && l.kind === "knowledge_source"));
  assert.ok(logs.some((l) => l.event === "register" && l.kind === "capability"));
  assert.ok(logs.some((l) => l.event === "register" && l.kind === "integration"));
  assert.ok(logs.some((l) => l.event === "register" && l.kind === "workflow"));
  assert.ok(logs.some((l) => l.event === "unregister"));
  assert.ok(logs.some((l) => l.event === "validate_reject" || l.event === "compat_check"));
  assert.ok(logs.some((l) => l.event === "execute"));
  assert.equal(demo.brainUntouched, true);
  assert.equal(listFeatureManifests().length, 0);
});

await check("source wiring — HublyAI + no Brain rewrite required", () => {
  for (const rel of [
    "supabase/functions/_shared/hubly_brain_platform.ts",
    "scripts/lib/platform.mjs",
    "docs/HUBLY_BRAIN_SECTION15.md",
  ]) {
    assert.ok(fs.existsSync(path.join(root, rel)), rel);
  }
  const platformSrc = read("supabase/functions/_shared/hubly_brain_platform.ts");
  assert.match(platformSrc, /HublyFeatureManifest/);
  assert.match(platformSrc, /validateFeatureManifest/);
  assert.match(platformSrc, /getPlatformInventory/);
  assert.match(platformSrc, /registerBuilderModule/);
  assert.match(platformSrc, /registerIndustryDnaPack/);
  const ai = read("supabase/functions/_shared/hubly_ai.ts");
  assert.match(ai, /HublyPlatform/);
  const mc = read("supabase/functions/_shared/hubly_brain_mission_control.ts");
  assert.match(mc, /platformInventory/);
  const dna = read("supabase/functions/_shared/hubly_brain_dna_knowledge.ts");
  assert.match(dna, /registerDnaIndustryPack/);
  // Prove think / hubly_ai were not edited to add SEO expert specifically
  const think = read("supabase/functions/_shared/hubly_brain_think.ts");
  assert.ok(!/seo_expert/.test(think));
});

if (failures.length) {
  console.error(`\nFAILED ${failures.length} check(s)\n`);
  process.exit(1);
}

const demo = await demoPlatformExtensibility();
const logs = listPlatformLogs(200);
const inventory = getPlatformInventory();

const proof = {
  section: 15,
  name: "Platform Extensibility",
  title: "Platform Extensibility",
  status: "pass",
  passed: true,
  provenAt: new Date().toISOString(),
  summary:
    "Hubly grows by registering Feature Manifests — experts, builders, industries, capabilities, knowledge, integrations, and workflows — without modifying Hubly Brain. Validation, version compatibility, clean unregister, and Mission Control inventory are proven.",
  proofs: {
    featureManifest: true,
    validation: true,
    versionCompatibility: true,
    uiExtensionPoints: UI_EXTENSION_POINTS,
    demo,
    registrationLogs: logs.filter((l) => l.event === "register").slice(-20),
    validationLogs: logs.filter((l) => l.event === "validate" || l.event === "validate_reject").slice(-20),
    compatibilityChecks: logs.filter((l) => l.event === "compat_check").slice(-10),
    discoveryResults: {
      experts: demo.discovered,
      whoOwns: demo.whoOwns,
      industry: demo.industryLoaded,
    },
    executionProof: demo.executed,
    cleanRemoval: demo.unregistered,
    platformInventory: {
      title: inventory.title,
      totals: inventory.totals,
      health: inventory.health,
    },
    hublyAiExportsPlatform: true,
    brainUntouched: true,
  },
};

// Clean up demo leftovers for subsequent gates
clearPlatformForTests();
clearDnaIndustryPacksForTests();

fs.writeFileSync(
  path.join(root, "docs/HUBLY_BRAIN_SECTION15_PROOF.json"),
  JSON.stringify(proof, null, 2) + "\n",
);
console.log("\nWrote docs/HUBLY_BRAIN_SECTION15_PROOF.json");
console.log("Section 15 PASS\n");
process.exit(0);
