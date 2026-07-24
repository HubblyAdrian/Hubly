/**
 * Section 17 — Architecture Documentation & Developer Experience catalog.
 *
 * Versioned index of Hubly engineering docs + ADRs, linked from Mission Control.
 * Paths are repo-relative from the Hubly root.
 */

export const HUBLY_DOCS_VERSION = "1.0.0";

export type HublyDocEntry = {
  id: string;
  title: string;
  path: string;
  summary: string;
};

export type HublyAdrEntry = {
  id: string;
  title: string;
  path: string;
  status: "accepted" | "proposed" | "superseded";
};

/** Required Section 17 deliverables — single source of truth for the catalog. */
export const HUBLY_ARCHITECTURE_GUIDES: readonly HublyDocEntry[] = [
  {
    id: "system-architecture",
    title: "System Architecture Guide",
    path: "docs/architecture/SYSTEM_ARCHITECTURE.md",
    summary: "Overall platform architecture and component responsibilities.",
  },
  {
    id: "ai-lifecycle",
    title: "AI Lifecycle Guide",
    path: "docs/architecture/AI_LIFECYCLE.md",
    summary: "End-to-end request path from user input to Mission Control replay.",
  },
  {
    id: "builder-engine-spec",
    title: "Builder Engine Specification",
    path: "docs/architecture/BUILDER_ENGINE_SPEC.md",
    summary: "Blueprint for Milestone 1.5 — not implemented in Milestone 1.",
  },
  {
    id: "memory-guide",
    title: "Memory Guide",
    path: "docs/architecture/MEMORY_GUIDE.md",
    summary: "Business Memory, Workspace Memory, Conversation Intelligence.",
  },
  {
    id: "expert-development",
    title: "Expert Development Guide",
    path: "docs/architecture/EXPERT_DEVELOPMENT.md",
    summary: "Create, register, test, and ship experts safely.",
  },
  {
    id: "business-dna-guide",
    title: "Business DNA Guide",
    path: "docs/architecture/BUSINESS_DNA_GUIDE.md",
    summary: "Industry packs, versioning, validation, regional intelligence.",
  },
  {
    id: "capability-guide",
    title: "Capability Guide",
    path: "docs/architecture/CAPABILITY_GUIDE.md",
    summary: "Capabilities, knowledge, integrations, feature manifests.",
  },
  {
    id: "mission-control-guide",
    title: "Mission Control Guide",
    path: "docs/architecture/MISSION_CONTROL_GUIDE.md",
    summary: "Replay, trust, quality, timeline, health, platform inventory.",
  },
  {
    id: "coding-standards",
    title: "Coding Standards",
    path: "docs/architecture/CODING_STANDARDS.md",
    summary: "Naming, folders, boundaries, errors, logging, testing.",
  },
  {
    id: "constitution-guide",
    title: "Hubly Constitution Guide",
    path: "docs/architecture/CONSTITUTION_GUIDE.md",
    summary: "How every expert, builder, and module is evaluated.",
  },
  {
    id: "developer-onboarding",
    title: "Developer Onboarding",
    path: "docs/architecture/DEVELOPER_ONBOARDING.md",
    summary: "Clone → understand → validate → extend → release gates.",
  },
] as const;

export const HUBLY_ADRS: readonly HublyAdrEntry[] = [
  {
    id: "0001",
    title: "Hubly Brain is the only AI entry point",
    path: "docs/adr/0001-hubly-brain-sole-ai-entry.md",
    status: "accepted",
  },
  {
    id: "0002",
    title: "Business Memory separate from Conversation Intelligence",
    path: "docs/adr/0002-memory-separation.md",
    status: "accepted",
  },
  {
    id: "0003",
    title: "Experts cannot write directly to memory",
    path: "docs/adr/0003-experts-cannot-write-memory.md",
    status: "accepted",
  },
  {
    id: "0004",
    title: "Capabilities are registry-driven",
    path: "docs/adr/0004-registry-driven-capabilities.md",
    status: "accepted",
  },
  {
    id: "0005",
    title: "All AI must pass through the Experience Director",
    path: "docs/adr/0005-experience-director-gate.md",
    status: "accepted",
  },
] as const;

export type HublyDocumentationCatalog = {
  version: string;
  indexPath: string;
  adrIndexPath: string;
  guides: HublyDocEntry[];
  adrs: HublyAdrEntry[];
  guideCount: number;
  adrCount: number;
};

/** Versioned documentation catalog for Mission Control / tooling. */
export function getHublyDocumentationCatalog(): HublyDocumentationCatalog {
  return {
    version: HUBLY_DOCS_VERSION,
    indexPath: "docs/architecture/README.md",
    adrIndexPath: "docs/adr/README.md",
    guides: [...HUBLY_ARCHITECTURE_GUIDES],
    adrs: [...HUBLY_ADRS],
    guideCount: HUBLY_ARCHITECTURE_GUIDES.length,
    adrCount: HUBLY_ADRS.length,
  };
}

export const HublyDocs = {
  version: HUBLY_DOCS_VERSION,
  owner: "hubly_brain" as const,
  catalog: getHublyDocumentationCatalog,
  guides: () => [...HUBLY_ARCHITECTURE_GUIDES],
  adrs: () => [...HUBLY_ADRS],
};
