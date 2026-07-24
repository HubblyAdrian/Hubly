#!/usr/bin/env node
/**
 * Section 17 — Architecture Documentation & Developer Experience (Release Gate)
 *
 * Proves the definitive engineering docs + ADRs exist, are versioned,
 * and are linked from Mission Control.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

console.log("\nSection 17 — Architecture Documentation & Developer Experience\n");

// Rebuild Node mirrors so Mission Control carries the docs catalog
execSync("node scripts/lib/_build-docs.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-mission-control.mjs", { cwd: root, stdio: "inherit" });

const {
  HUBLY_DOCS_VERSION,
  HUBLY_ARCHITECTURE_GUIDES,
  HUBLY_ADRS,
  getHublyDocumentationCatalog,
  HublyDocs,
} = await import("./lib/docs.mjs");

const { getMissionControlSnapshot, MISSION_CONTROL_VERSION } = await import("./lib/mission-control.mjs");

const failures = [];
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    failures.push({ name, detail });
  } else {
    console.log(`  ✓ ${name}`);
  }
}

check("docs module versioned", HUBLY_DOCS_VERSION === "1.0.0");
check("HublyDocs API", typeof HublyDocs.catalog === "function" && HublyDocs.owner === "hubly_brain");

const catalog = getHublyDocumentationCatalog();
check("catalog guide count ≥ 11", catalog.guideCount >= 11, `n=${catalog.guideCount}`);
check("catalog ADR count ≥ 5", catalog.adrCount >= 5, `n=${catalog.adrCount}`);
check("catalog version matches", catalog.version === HUBLY_DOCS_VERSION);

const requiredGuides = [
  ["system-architecture", "docs/architecture/SYSTEM_ARCHITECTURE.md"],
  ["ai-lifecycle", "docs/architecture/AI_LIFECYCLE.md"],
  ["builder-engine-spec", "docs/architecture/BUILDER_ENGINE_SPEC.md"],
  ["memory-guide", "docs/architecture/MEMORY_GUIDE.md"],
  ["expert-development", "docs/architecture/EXPERT_DEVELOPMENT.md"],
  ["business-dna-guide", "docs/architecture/BUSINESS_DNA_GUIDE.md"],
  ["capability-guide", "docs/architecture/CAPABILITY_GUIDE.md"],
  ["mission-control-guide", "docs/architecture/MISSION_CONTROL_GUIDE.md"],
  ["coding-standards", "docs/architecture/CODING_STANDARDS.md"],
  ["constitution-guide", "docs/architecture/CONSTITUTION_GUIDE.md"],
  ["developer-onboarding", "docs/architecture/DEVELOPER_ONBOARDING.md"],
];

for (const [id, p] of requiredGuides) {
  const entry = HUBLY_ARCHITECTURE_GUIDES.find((g) => g.id === id);
  check(`guide registered: ${id}`, !!entry && entry.path === p);
  check(`guide file exists: ${p}`, exists(p));
}

check("architecture index exists", exists("docs/architecture/README.md"));
check("ADR index exists", exists("docs/adr/README.md"));

const requiredAdrs = [
  "docs/adr/0001-hubly-brain-sole-ai-entry.md",
  "docs/adr/0002-memory-separation.md",
  "docs/adr/0003-experts-cannot-write-memory.md",
  "docs/adr/0004-registry-driven-capabilities.md",
  "docs/adr/0005-experience-director-gate.md",
];
for (const p of requiredAdrs) {
  check(`ADR exists: ${path.basename(p)}`, exists(p));
  const body = read(p);
  check(`${path.basename(p)} has Context/Decision`, /## Context/.test(body) && /## Decision/.test(body));
}

// Content proofs — key headings / concepts
const sys = read("docs/architecture/SYSTEM_ARCHITECTURE.md");
for (const heading of [
  "Hubly Brain",
  "Expert lifecycle",
  "Memory architecture",
  "Decision Engine",
  "Reasoning Engine",
  "Business DNA",
  "Conversation Intelligence",
  "Mission Control",
  "Capability Registry",
]) {
  check(`SYSTEM_ARCHITECTURE covers ${heading}`, sys.includes(heading));
}
check("SYSTEM_ARCHITECTURE has Purpose/Responsibilities tables", /\*\*Purpose\*\*/.test(sys) && /\*\*Extension points\*\*/.test(sys));

const life = read("docs/architecture/AI_LIFECYCLE.md");
for (const stage of [
  "User Request",
  "Hubly Brain",
  "Load Memories",
  "Load Business DNA",
  "Select Experts",
  "Execute Experts",
  "Reasoning",
  "Decision Engine",
  "Experience Director",
  "Memory Updates",
  "Mission Control Replay",
]) {
  check(`AI lifecycle stage: ${stage}`, life.includes(stage));
}

const builder = read("docs/architecture/BUILDER_ENGINE_SPEC.md");
check("Builder spec is not implementation", /do not implement|Specification only/i.test(builder));
for (const topic of [
  "Builder Expert responsibilities",
  "Change Plans",
  "Preview Engine",
  "Approval Flow",
  "Rollback Flow",
  "Safety rules",
  "Interaction with Hubly Brain",
  "Website",
  "CRM",
  "Booking",
  "Packages",
  "Automations",
  "Workspace",
  "Portfolio",
]) {
  check(`Builder spec: ${topic}`, builder.includes(topic) || new RegExp(topic, "i").test(builder));
}

const mem = read("docs/architecture/MEMORY_GUIDE.md");
for (const store of ["Business Memory", "Workspace Memory", "Conversation Intelligence"]) {
  check(`Memory guide: ${store}`, mem.includes(store));
}
check("Memory guide: who can update / versioning", /Who can update/i.test(mem) && /Versioning/i.test(mem));

const expert = read("docs/architecture/EXPERT_DEVELOPMENT.md");
for (const topic of [
  "Create an expert",
  "Register",
  "permissions",
  "capabilities",
  "reasoning",
  "confidence",
  "Constitution",
]) {
  check(`Expert guide: ${topic}`, new RegExp(topic, "i").test(expert));
}

const dna = read("docs/architecture/BUSINESS_DNA_GUIDE.md");
for (const topic of ["Add a new industry", "Version", "Validate", "regional"]) {
  check(`DNA guide: ${topic}`, new RegExp(topic, "i").test(dna));
}

const cap = read("docs/architecture/CAPABILITY_GUIDE.md");
for (const topic of [
  "Register a capability",
  "knowledge source",
  "integration",
  "Feature Manifest",
]) {
  check(`Capability guide: ${topic}`, new RegExp(topic, "i").test(cap));
}

const mcGuide = read("docs/architecture/MISSION_CONTROL_GUIDE.md");
for (const topic of ["Replay", "Trust Score", "Quality Score", "Brain Timeline", "Platform Inventory", "Documentation"]) {
  check(`Mission Control guide: ${topic}`, mcGuide.includes(topic));
}

const standards = read("docs/architecture/CODING_STANDARDS.md");
for (const topic of [
  "Naming conventions",
  "Folder structure",
  "Module boundaries",
  "Error handling",
  "Logging",
  "Versioning",
  "Testing expectations",
]) {
  check(`Coding standards: ${topic}`, standards.includes(topic));
}

const constitution = read("docs/architecture/CONSTITUTION_GUIDE.md");
check("Constitution guide references principles", /principle/i.test(constitution));
check("Constitution guide evaluation", /evaluat/i.test(constitution));

const onboard = read("docs/architecture/DEVELOPER_ONBOARDING.md");
for (const step of ["Clone", "architecture", "validation", "expert", "capability", "Business DNA", "release gates"]) {
  check(`Onboarding: ${step}`, new RegExp(step, "i").test(onboard));
}

// Mission Control linkage
const snap = getMissionControlSnapshot();
check("Mission Control version ≥ 1.4", typeof MISSION_CONTROL_VERSION === "string" && Number(MISSION_CONTROL_VERSION.split(".")[1]) >= 4);
check("Mission Control documentation present", !!snap.documentation);
check("MC docs version matches catalog", snap.documentation.version === catalog.version);
check("MC docs guideCount", snap.documentation.guideCount === catalog.guideCount);
check("MC docs adrCount", snap.documentation.adrCount === catalog.adrCount);
check("MC docs indexPath", snap.documentation.indexPath === "docs/architecture/README.md");

// Source wiring
check("docs source exists", exists("supabase/functions/_shared/hubly_brain_docs.ts"));
const ai = read("supabase/functions/_shared/hubly_ai.ts");
check("HublyAI exports HublyDocs", /HublyDocs/.test(ai));
const mcSrc = read("supabase/functions/_shared/hubly_brain_mission_control.ts");
check("Mission Control wires documentation", /documentation:\s*getHublyDocumentationCatalog/.test(mcSrc) || /documentation: HublyDocumentationCatalog/.test(mcSrc));
check("section evidence doc exists", exists("docs/HUBLY_BRAIN_SECTION17.md"));

const evidenceBody = exists("docs/HUBLY_BRAIN_SECTION17.md") ? read("docs/HUBLY_BRAIN_SECTION17.md") : "";
check("evidence mentions Architecture Documentation", /Architecture Documentation/i.test(evidenceBody));

const passed = failures.length === 0;
const report = {
  section: 17,
  name: "Architecture Documentation & Developer Experience",
  title: "Architecture Documentation & Developer Experience",
  passed,
  checkedAt: new Date().toISOString(),
  proofs: {
    docsVersion: HUBLY_DOCS_VERSION,
    missionControlVersion: MISSION_CONTROL_VERSION,
    guideCount: catalog.guideCount,
    adrCount: catalog.adrCount,
    guides: catalog.guides.map((g) => g.path),
    adrs: catalog.adrs.map((a) => a.path),
    missionControlLinked: !!snap.documentation,
    onboardingPath: "docs/architecture/DEVELOPER_ONBOARDING.md",
    builderSpecOnly: true,
  },
  failures: passed ? null : failures,
};

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(
  path.join(root, "docs/HUBLY_BRAIN_SECTION17_PROOF.json"),
  JSON.stringify(report, null, 2) + "\n",
);

if (!passed) {
  console.error(`\nFAILED ${failures.length} check(s)\n`);
  process.exit(1);
}

console.log("\nSECTION 17 PASS — Architecture Documentation & Developer Experience\n");
console.log(`  Docs v${HUBLY_DOCS_VERSION} · ${catalog.guideCount} guides · ${catalog.adrCount} ADRs`);
console.log("  Mission Control: documentation catalog linked\n");
process.exit(0);
