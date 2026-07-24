/** Node mirror of hubly_brain_docs.ts — Section 17 (esbuild). */


// supabase/functions/_shared/hubly_brain_docs.ts
var HUBLY_DOCS_VERSION = "1.0.0";
var HUBLY_ARCHITECTURE_GUIDES = [
  {
    id: "system-architecture",
    title: "System Architecture Guide",
    path: "docs/architecture/SYSTEM_ARCHITECTURE.md",
    summary: "Overall platform architecture and component responsibilities."
  },
  {
    id: "ai-lifecycle",
    title: "AI Lifecycle Guide",
    path: "docs/architecture/AI_LIFECYCLE.md",
    summary: "End-to-end request path from user input to Mission Control replay."
  },
  {
    id: "builder-engine-spec",
    title: "Builder Engine Specification",
    path: "docs/architecture/BUILDER_ENGINE_SPEC.md",
    summary: "Blueprint for Milestone 1.5 \u2014 not implemented in Milestone 1."
  },
  {
    id: "memory-guide",
    title: "Memory Guide",
    path: "docs/architecture/MEMORY_GUIDE.md",
    summary: "Business Memory, Workspace Memory, Conversation Intelligence."
  },
  {
    id: "expert-development",
    title: "Expert Development Guide",
    path: "docs/architecture/EXPERT_DEVELOPMENT.md",
    summary: "Create, register, test, and ship experts safely."
  },
  {
    id: "business-dna-guide",
    title: "Business DNA Guide",
    path: "docs/architecture/BUSINESS_DNA_GUIDE.md",
    summary: "Industry packs, versioning, validation, regional intelligence."
  },
  {
    id: "capability-guide",
    title: "Capability Guide",
    path: "docs/architecture/CAPABILITY_GUIDE.md",
    summary: "Capabilities, knowledge, integrations, feature manifests."
  },
  {
    id: "mission-control-guide",
    title: "Mission Control Guide",
    path: "docs/architecture/MISSION_CONTROL_GUIDE.md",
    summary: "Replay, trust, quality, timeline, health, platform inventory."
  },
  {
    id: "coding-standards",
    title: "Coding Standards",
    path: "docs/architecture/CODING_STANDARDS.md",
    summary: "Naming, folders, boundaries, errors, logging, testing."
  },
  {
    id: "constitution-guide",
    title: "Hubly Constitution Guide",
    path: "docs/architecture/CONSTITUTION_GUIDE.md",
    summary: "How every expert, builder, and module is evaluated."
  },
  {
    id: "developer-onboarding",
    title: "Developer Onboarding",
    path: "docs/architecture/DEVELOPER_ONBOARDING.md",
    summary: "Clone \u2192 understand \u2192 validate \u2192 extend \u2192 release gates."
  }
];
var HUBLY_ADRS = [
  {
    id: "0001",
    title: "Hubly Brain is the only AI entry point",
    path: "docs/adr/0001-hubly-brain-sole-ai-entry.md",
    status: "accepted"
  },
  {
    id: "0002",
    title: "Business Memory separate from Conversation Intelligence",
    path: "docs/adr/0002-memory-separation.md",
    status: "accepted"
  },
  {
    id: "0003",
    title: "Experts cannot write directly to memory",
    path: "docs/adr/0003-experts-cannot-write-memory.md",
    status: "accepted"
  },
  {
    id: "0004",
    title: "Capabilities are registry-driven",
    path: "docs/adr/0004-registry-driven-capabilities.md",
    status: "accepted"
  },
  {
    id: "0005",
    title: "All AI must pass through the Experience Director",
    path: "docs/adr/0005-experience-director-gate.md",
    status: "accepted"
  }
];
function getHublyDocumentationCatalog() {
  return {
    version: HUBLY_DOCS_VERSION,
    indexPath: "docs/architecture/README.md",
    adrIndexPath: "docs/adr/README.md",
    guides: [...HUBLY_ARCHITECTURE_GUIDES],
    adrs: [...HUBLY_ADRS],
    guideCount: HUBLY_ARCHITECTURE_GUIDES.length,
    adrCount: HUBLY_ADRS.length
  };
}
var HublyDocs = {
  version: HUBLY_DOCS_VERSION,
  owner: "hubly_brain",
  catalog: getHublyDocumentationCatalog,
  guides: () => [...HUBLY_ARCHITECTURE_GUIDES],
  adrs: () => [...HUBLY_ADRS]
};
export {
  HUBLY_ADRS,
  HUBLY_ARCHITECTURE_GUIDES,
  HUBLY_DOCS_VERSION,
  HublyDocs,
  getHublyDocumentationCatalog
};
