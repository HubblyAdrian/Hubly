/**
 * Hubly Brain — Platform Extensibility (Milestone 1 · Section 15)
 *
 * Question: Can Hubly evolve without engineers rewriting the core?
 *
 * Answer: Yes — by registering modules (experts, builders, industries,
 * capabilities, knowledge, integrations, workflows) through Feature Manifests.
 * Hubly Brain is not modified when new modules appear.
 *
 * Mission Control reads manifests for a live inventory of everything Hubly can do.
 */

import {
  registerExpert,
  unregisterExpert,
  isExpertRegistered,
  discoverExperts,
  runExpert,
  listDiscoveryLog,
  type HublyExpertDefinition,
  type HublyExpertHandler,
  type HublyExpertContext,
} from "./hubly_brain_expert_framework.ts";
import {
  registerTool,
  unregisterTool,
  registerKnowledgeSource,
  unregisterKnowledgeSource,
  whoOwnsCapability,
  getTool,
  getKnowledgeSource,
  listTools,
  listKnowledgeSources,
  ensureRegistriesBootstrapped,
  type HublyToolDefinition,
  type HublyKnowledgeSource,
} from "./hubly_brain_registries.ts";
import {
  registerDnaIndustryPack,
  unregisterDnaIndustryPack,
  listDnaIndustryPacks,
  getDnaIndustryPack,
  type HublyDnaKnowledgePack,
} from "./hubly_brain_dna_knowledge.ts";

export const PLATFORM_VERSION = "1.0.0" as const;
export const PLATFORM_OWNER = "hubly_brain" as const;
/** Minimum Brain version this platform layer targets. */
export const HUBLY_BRAIN_PLATFORM_VERSION = "1.0.0" as const;

export type HublyExtensionKind =
  | "expert"
  | "builder_module"
  | "industry_dna"
  | "capability"
  | "knowledge_source"
  | "integration"
  | "workflow"
  | "ui_extension";

export type HublyExtensionHealth = "healthy" | "degraded" | "unknown" | "disabled";

/**
 * Feature Manifest — every extension declares this.
 * Mission Control inventories the platform from these manifests.
 */
export type HublyFeatureManifest = {
  id: string;
  name: string;
  version: string;
  kind: HublyExtensionKind;
  owner: string;
  capabilities: string[];
  dependencies: string[];
  requiredPermissions: string[];
  /** JSON-schema-ish config description (keys → type hints). */
  configurationSchema: Record<string, string>;
  health: HublyExtensionHealth;
  documentationLink: string;
  /** Semver — minimum Hubly Brain / platform version. */
  minHublyBrainVersion: string;
  supportedCapabilities: string[];
  migrationRequirements: string[];
  description?: string;
};

export type ValidationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
  checkedAt: string;
};

export type PlatformLogEntry = {
  at: string;
  event:
    | "validate"
    | "validate_reject"
    | "register"
    | "unregister"
    | "discover"
    | "compat_check"
    | "capability_conflict"
    | "execute";
  kind: HublyExtensionKind | "platform";
  id: string;
  detail: string;
  meta?: Record<string, unknown>;
};

export type BuilderModuleDef = {
  id: string;
  name: string;
  version: string;
  purpose: string;
  capabilities: string[];
  /** Milestone when builder becomes available (e.g. 1.5). */
  milestone: string;
};

export type IntegrationDef = {
  id: string;
  name: string;
  version: string;
  authentication: "oauth2" | "api_key" | "none" | "mock";
  readPermissions: string[];
  writePermissions: string[];
  events: string[];
  capabilities: string[];
  failureBehavior: "retry" | "queue" | "degrade" | "fail";
};

export type WorkflowDef = {
  id: string;
  name: string;
  version: string;
  triggers: string[];
  steps: string[];
  capabilities: string[];
};

/** UI extension points — architecture only (not implemented UI). */
export type UiExtensionPoint = {
  id: string;
  surface: "dashboard_card" | "business_home_card" | "workspace_widget" | "ai_action";
  description: string;
  status: "reserved";
};

const manifests = new Map<string, HublyFeatureManifest>();
const builders = new Map<string, BuilderModuleDef>();
const integrations = new Map<string, IntegrationDef>();
const workflows = new Map<string, WorkflowDef>();
const LOG: PlatformLogEntry[] = [];
const MAX_LOG = 500;

/** Reserved UI extension points — prepare architecture, don't implement UI. */
export const UI_EXTENSION_POINTS: UiExtensionPoint[] = [
  {
    id: "ui.dashboard_card",
    surface: "dashboard_card",
    description: "Future dashboard cards contributed by modules",
    status: "reserved",
  },
  {
    id: "ui.business_home_card",
    surface: "business_home_card",
    description: "Future Business Home cards contributed by modules",
    status: "reserved",
  },
  {
    id: "ui.workspace_widget",
    surface: "workspace_widget",
    description: "Future Workspace widgets contributed by modules",
    status: "reserved",
  },
  {
    id: "ui.ai_action",
    surface: "ai_action",
    description: "Future AI action chips / commands contributed by modules",
    status: "reserved",
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function log(
  event: PlatformLogEntry["event"],
  kind: PlatformLogEntry["kind"],
  id: string,
  detail: string,
  meta?: Record<string, unknown>,
): void {
  LOG.push({ at: nowIso(), event, kind, id, detail, meta });
  while (LOG.length > MAX_LOG) LOG.shift();
}

/** Compare simple semver a >= b */
export function semverGte(a: string, b: string): boolean {
  const pa = String(a || "0").split(".").map((x) => parseInt(x, 10) || 0);
  const pb = String(b || "0").split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return true;
}

export function checkVersionCompatibility(manifest: HublyFeatureManifest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!manifest.minHublyBrainVersion) {
    issues.push({
      code: "missing_min_version",
      message: "minHublyBrainVersion is required",
      severity: "error",
    });
  } else if (!semverGte(HUBLY_BRAIN_PLATFORM_VERSION, manifest.minHublyBrainVersion)) {
    issues.push({
      code: "incompatible_brain_version",
      message: `Requires Hubly Brain >= ${manifest.minHublyBrainVersion}; platform is ${HUBLY_BRAIN_PLATFORM_VERSION}`,
      severity: "error",
    });
  }
  log("compat_check", manifest.kind, manifest.id, issues.length ? "incompatible" : "compatible", {
    min: manifest.minHublyBrainVersion,
    platform: HUBLY_BRAIN_PLATFORM_VERSION,
  });
  return issues;
}

function capabilityConflict(capabilityIds: string[], excludeExtensionId?: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  ensureRegistriesBootstrapped();
  for (const cap of capabilityIds) {
    const owner = whoOwnsCapability(cap);
    if (owner && excludeExtensionId !== owner.toolId) {
      // Conflict only if another tool already owns this exact capability id
      const tool = getTool(owner.toolId);
      const exact = tool?.capabilities.some((c) => c.id === cap);
      if (exact && owner.toolId !== excludeExtensionId) {
        issues.push({
          code: "capability_conflict",
          message: `Capability "${cap}" already owned by ${owner.toolId}`,
          severity: "error",
        });
        log("capability_conflict", "capability", cap, `owned_by_${owner.toolId}`);
      }
    }
  }
  return issues;
}

function depsSatisfied(deps: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const d of deps || []) {
    if (manifests.has(d)) continue;
    if (isExpertRegistered(d)) continue;
    if (getTool(d)) continue;
    if (getKnowledgeSource(d)) continue;
    if (builders.has(d)) continue;
    if (integrations.has(d)) continue;
    if (getDnaIndustryPack(d)) continue;
    // Built-in deps that always exist
    if (["hubly_brain", "business_memory", "business_dna", "experience_director"].includes(d)) {
      continue;
    }
    issues.push({
      code: "missing_dependency",
      message: `Dependency not found: ${d}`,
      severity: "error",
    });
  }
  return issues;
}

export function validateFeatureManifest(manifest: Partial<HublyFeatureManifest>): ValidationResult {
  const issues: ValidationIssue[] = [];
  const required = ["id", "name", "version", "kind", "owner", "minHublyBrainVersion"] as const;
  for (const k of required) {
    if (!manifest?.[k]) {
      issues.push({ code: "missing_metadata", message: `Missing required field: ${k}`, severity: "error" });
    }
  }
  const kinds: HublyExtensionKind[] = [
    "expert",
    "builder_module",
    "industry_dna",
    "capability",
    "knowledge_source",
    "integration",
    "workflow",
    "ui_extension",
  ];
  if (manifest.kind && !kinds.includes(manifest.kind)) {
    issues.push({ code: "invalid_kind", message: `Unknown kind: ${manifest.kind}`, severity: "error" });
  }
  if (manifest.id && manifests.has(manifest.id)) {
    issues.push({
      code: "duplicate_id",
      message: `Extension already registered: ${manifest.id}`,
      severity: "error",
    });
  }
  if (manifest as HublyFeatureManifest) {
    issues.push(...checkVersionCompatibility(manifest as HublyFeatureManifest));
    issues.push(...depsSatisfied(manifest.dependencies || []));
    if (manifest.kind === "capability" || manifest.kind === "builder_module") {
      issues.push(...capabilityConflict(manifest.capabilities || [], manifest.id));
    }
  }
  // Permissions must be non-empty strings when present
  for (const p of manifest.requiredPermissions || []) {
    if (!String(p).trim()) {
      issues.push({ code: "invalid_permission", message: "Empty permission entry", severity: "error" });
    }
  }

  const ok = !issues.some((i) => i.severity === "error");
  log(ok ? "validate" : "validate_reject", (manifest.kind as HublyExtensionKind) || "platform", String(manifest.id || "?"), ok ? "ok" : "rejected", {
    issueCount: issues.length,
  });
  return { ok, issues, checkedAt: nowIso() };
}

function storeManifest(m: HublyFeatureManifest): void {
  manifests.set(m.id, { ...m, capabilities: [...m.capabilities], dependencies: [...m.dependencies] });
}

function normalizeManifest(partial: Partial<HublyFeatureManifest> & { id: string; kind: HublyExtensionKind }): HublyFeatureManifest {
  return {
    id: String(partial.id),
    name: String(partial.name || partial.id),
    version: String(partial.version || "1.0.0"),
    kind: partial.kind,
    owner: String(partial.owner || "extension"),
    capabilities: [...(partial.capabilities || [])],
    dependencies: [...(partial.dependencies || [])],
    requiredPermissions: [...(partial.requiredPermissions || [])],
    configurationSchema: { ...(partial.configurationSchema || {}) },
    health: partial.health || "healthy",
    documentationLink: String(partial.documentationLink || `docs/extensions/${partial.id}.md`),
    minHublyBrainVersion: String(partial.minHublyBrainVersion || "1.0.0"),
    supportedCapabilities: [...(partial.supportedCapabilities || partial.capabilities || [])],
    migrationRequirements: [...(partial.migrationRequirements || [])],
    description: partial.description || "",
  };
}

function rejectOrThrow(v: ValidationResult, id: string): void {
  if (!v.ok) {
    const msg = v.issues.map((i) => i.message).join("; ");
    throw new Error(`Extension validation failed for ${id}: ${msg}`);
  }
}

/** Register an AI Expert — no Brain modifications. */
export function registerPlatformExpert(
  def: HublyExpertDefinition,
  handler: HublyExpertHandler,
  manifestExtras?: Partial<HublyFeatureManifest>,
): HublyFeatureManifest {
  const manifest = normalizeManifest({
    id: `expert.${def.id}`,
    name: def.name,
    version: def.version,
    kind: "expert",
    owner: manifestExtras?.owner || def.id,
    capabilities: def.capability?.can || [],
    dependencies: def.dependencies || ["hubly_brain"],
    requiredPermissions: def.capability?.tools || [],
    minHublyBrainVersion: manifestExtras?.minHublyBrainVersion || "1.0.0",
    supportedCapabilities: def.capability?.can || [],
    documentationLink: manifestExtras?.documentationLink,
    health: "healthy",
    description: def.purpose,
    ...manifestExtras,
  });
  const v = validateFeatureManifest(manifest);
  rejectOrThrow(v, manifest.id);
  registerExpert(def, handler);
  storeManifest(manifest);
  log("register", "expert", manifest.id, `${def.name}@${def.version}`);
  return { ...manifest };
}

export function unregisterPlatformExpert(expertId: string): boolean {
  const mid = expertId.startsWith("expert.") ? expertId : `expert.${expertId}`;
  const rawId = mid.replace(/^expert\./, "");
  const ok = unregisterExpert(rawId);
  manifests.delete(mid);
  log("unregister", "expert", mid, ok ? "removed" : "missing");
  return ok;
}

/** Register a Builder module (Milestone 1.5-ready) — capabilities only. */
export function registerBuilderModule(
  def: BuilderModuleDef,
  manifestExtras?: Partial<HublyFeatureManifest>,
): HublyFeatureManifest {
  const manifest = normalizeManifest({
    id: `builder.${def.id}`,
    name: def.name,
    version: def.version,
    kind: "builder_module",
    owner: def.id,
    capabilities: def.capabilities,
    dependencies: ["hubly_brain"],
    requiredPermissions: def.capabilities.map((c) => `builder:${c}`),
    minHublyBrainVersion: "1.0.0",
    supportedCapabilities: def.capabilities,
    description: def.purpose,
    configurationSchema: { milestone: "string" },
    ...manifestExtras,
  });
  const v = validateFeatureManifest(manifest);
  rejectOrThrow(v, manifest.id);

  // Register capabilities into Tool Registry under this builder
  registerTool({
    id: def.id,
    name: def.name,
    version: def.version,
    purpose: def.purpose,
    responsibilities: [`Builder module (${def.milestone})`],
    category: "builder",
    capabilities: def.capabilities.map((c) => ({
      id: c,
      label: c.replace(/_/g, " "),
      aliases: [c, c.replace(/_/g, " ")],
    })),
  });

  builders.set(def.id, { ...def, capabilities: [...def.capabilities] });
  storeManifest(manifest);
  log("register", "builder_module", manifest.id, `milestone=${def.milestone}`);
  return { ...manifest };
}

export function unregisterBuilderModule(builderId: string): boolean {
  const mid = builderId.startsWith("builder.") ? builderId : `builder.${builderId}`;
  const raw = mid.replace(/^builder\./, "");
  const had = builders.delete(raw);
  unregisterTool(raw);
  manifests.delete(mid);
  log("unregister", "builder_module", mid, had ? "removed" : "missing");
  return had;
}

/** Register a Business DNA industry package — no app code changes. */
export function registerIndustryDnaPack(
  industryKey: string,
  pack: HublyDnaKnowledgePack,
  manifestExtras?: Partial<HublyFeatureManifest>,
): HublyFeatureManifest {
  const key = String(industryKey || "").toLowerCase().trim();
  const manifest = normalizeManifest({
    id: `industry.${key.replace(/\s+/g, "_")}`,
    name: pack.industryProfile?.industryName || key,
    version: String(pack.knowledgeVersion || "1"),
    kind: "industry_dna",
    owner: "business_dna",
    capabilities: ["industry_knowledge"],
    dependencies: ["business_dna", "hubly_brain"],
    requiredPermissions: ["read:business_dna"],
    minHublyBrainVersion: "1.0.0",
    supportedCapabilities: ["industry_knowledge"],
    description: `Business DNA package for ${key}`,
    ...manifestExtras,
  });
  const v = validateFeatureManifest(manifest);
  rejectOrThrow(v, manifest.id);
  registerDnaIndustryPack(key, pack);
  storeManifest(manifest);
  log("register", "industry_dna", manifest.id, key);
  return { ...manifest };
}

export function unregisterIndustryDnaPack(industryKey: string): boolean {
  const key = String(industryKey || "").toLowerCase().trim();
  const mid = `industry.${key.replace(/\s+/g, "_")}`;
  const ok = unregisterDnaIndustryPack(key);
  manifests.delete(mid);
  log("unregister", "industry_dna", mid, ok ? "removed" : "missing");
  return ok;
}

/** Register a capability via Tool Registry (discoverable). */
export function registerPlatformCapability(
  tool: HublyToolDefinition,
  manifestExtras?: Partial<HublyFeatureManifest>,
): HublyFeatureManifest {
  const caps = tool.capabilities.map((c) => c.id);
  const manifest = normalizeManifest({
    id: `capability.${tool.id}`,
    name: tool.name,
    version: tool.version,
    kind: "capability",
    owner: tool.id,
    capabilities: caps,
    dependencies: ["hubly_brain"],
    requiredPermissions: caps.map((c) => `cap:${c}`),
    minHublyBrainVersion: "1.0.0",
    supportedCapabilities: caps,
    description: tool.purpose,
    ...manifestExtras,
  });
  const v = validateFeatureManifest(manifest);
  rejectOrThrow(v, manifest.id);
  registerTool(tool);
  storeManifest(manifest);
  log("register", "capability", manifest.id, caps.join(","));
  return { ...manifest };
}

export function unregisterPlatformCapability(toolId: string): boolean {
  const mid = toolId.startsWith("capability.") ? toolId : `capability.${toolId}`;
  const raw = mid.replace(/^capability\./, "");
  const ok = unregisterTool(raw);
  manifests.delete(mid);
  log("unregister", "capability", mid, ok ? "removed" : "missing");
  return ok;
}

/** Register a knowledge source — Knowledge Registry discovers it. */
export function registerPlatformKnowledge(
  source: HublyKnowledgeSource,
  manifestExtras?: Partial<HublyFeatureManifest>,
): HublyFeatureManifest {
  const manifest = normalizeManifest({
    id: `knowledge.${source.id}`,
    name: source.name,
    version: "1.0.0",
    kind: "knowledge_source",
    owner: source.source || source.id,
    capabilities: source.domains || [],
    dependencies: ["hubly_brain"],
    requiredPermissions: [source.access === "read" ? "read:knowledge" : "read_write:knowledge"],
    minHublyBrainVersion: "1.0.0",
    supportedCapabilities: source.domains || [],
    description: source.purpose,
    ...manifestExtras,
  });
  const v = validateFeatureManifest(manifest);
  rejectOrThrow(v, manifest.id);
  registerKnowledgeSource(source);
  storeManifest(manifest);
  log("register", "knowledge_source", manifest.id, source.access);
  return { ...manifest };
}

export function unregisterPlatformKnowledge(knowledgeId: string): boolean {
  const mid = knowledgeId.startsWith("knowledge.") ? knowledgeId : `knowledge.${knowledgeId}`;
  const raw = mid.replace(/^knowledge\./, "");
  const ok = unregisterKnowledgeSource(raw);
  manifests.delete(mid);
  log("unregister", "knowledge_source", mid, ok ? "removed" : "missing");
  return ok;
}

/** Register a mock / real integration surface. */
export function registerIntegration(
  def: IntegrationDef,
  manifestExtras?: Partial<HublyFeatureManifest>,
): HublyFeatureManifest {
  const manifest = normalizeManifest({
    id: `integration.${def.id}`,
    name: def.name,
    version: def.version,
    kind: "integration",
    owner: def.id,
    capabilities: def.capabilities,
    dependencies: ["hubly_brain"],
    requiredPermissions: [...def.readPermissions, ...def.writePermissions],
    minHublyBrainVersion: "1.0.0",
    supportedCapabilities: def.capabilities,
    configurationSchema: {
      authentication: "string",
      failureBehavior: "string",
    },
    description: `Integration: ${def.name}`,
    ...manifestExtras,
  });
  const v = validateFeatureManifest(manifest);
  rejectOrThrow(v, manifest.id);
  integrations.set(def.id, {
    ...def,
    readPermissions: [...def.readPermissions],
    writePermissions: [...def.writePermissions],
    events: [...def.events],
    capabilities: [...def.capabilities],
  });
  storeManifest(manifest);
  log("register", "integration", manifest.id, def.authentication);
  return { ...manifest };
}

export function unregisterIntegration(integrationId: string): boolean {
  const mid = integrationId.startsWith("integration.") ? integrationId : `integration.${integrationId}`;
  const raw = mid.replace(/^integration\./, "");
  const ok = integrations.delete(raw);
  manifests.delete(mid);
  log("unregister", "integration", mid, ok ? "removed" : "missing");
  return ok;
}

/** Register a workflow module — no workflow engine rewrite. */
export function registerWorkflow(
  def: WorkflowDef,
  manifestExtras?: Partial<HublyFeatureManifest>,
): HublyFeatureManifest {
  const manifest = normalizeManifest({
    id: `workflow.${def.id}`,
    name: def.name,
    version: def.version,
    kind: "workflow",
    owner: def.id,
    capabilities: def.capabilities,
    dependencies: ["hubly_brain"],
    requiredPermissions: ["run:workflow"],
    minHublyBrainVersion: "1.0.0",
    supportedCapabilities: def.capabilities,
    description: `Workflow: ${def.name}`,
    configurationSchema: { triggers: "string[]", steps: "string[]" },
    ...manifestExtras,
  });
  const v = validateFeatureManifest(manifest);
  rejectOrThrow(v, manifest.id);
  workflows.set(def.id, {
    ...def,
    triggers: [...def.triggers],
    steps: [...def.steps],
    capabilities: [...def.capabilities],
  });
  storeManifest(manifest);
  log("register", "workflow", manifest.id, def.triggers.join(","));
  return { ...manifest };
}

export function unregisterWorkflow(workflowId: string): boolean {
  const mid = workflowId.startsWith("workflow.") ? workflowId : `workflow.${workflowId}`;
  const raw = mid.replace(/^workflow\./, "");
  const ok = workflows.delete(raw);
  manifests.delete(mid);
  log("unregister", "workflow", mid, ok ? "removed" : "missing");
  return ok;
}

export function listFeatureManifests(): HublyFeatureManifest[] {
  return [...manifests.values()].map((m) => ({
    ...m,
    capabilities: [...m.capabilities],
    dependencies: [...m.dependencies],
    requiredPermissions: [...m.requiredPermissions],
    supportedCapabilities: [...m.supportedCapabilities],
    migrationRequirements: [...m.migrationRequirements],
    configurationSchema: { ...m.configurationSchema },
  }));
}

export function getFeatureManifest(id: string): HublyFeatureManifest | null {
  const m = manifests.get(String(id));
  return m ? listFeatureManifests().find((x) => x.id === m.id) || null : null;
}

export function listBuilderModules(): BuilderModuleDef[] {
  return [...builders.values()].map((b) => ({ ...b, capabilities: [...b.capabilities] }));
}

export function listIntegrations(): IntegrationDef[] {
  return [...integrations.values()].map((i) => ({
    ...i,
    readPermissions: [...i.readPermissions],
    writePermissions: [...i.writePermissions],
    events: [...i.events],
    capabilities: [...i.capabilities],
  }));
}

export function listWorkflows(): WorkflowDef[] {
  return [...workflows.values()].map((w) => ({
    ...w,
    triggers: [...w.triggers],
    steps: [...w.steps],
    capabilities: [...w.capabilities],
  }));
}

export function listPlatformLogs(limit = 80): PlatformLogEntry[] {
  return LOG.slice(-Math.max(1, limit)).map((e) => ({ ...e, meta: e.meta ? { ...e.meta } : undefined }));
}

/**
 * Live platform inventory for Mission Control.
 */
export function getPlatformInventory() {
  ensureRegistriesBootstrapped();
  const all = listFeatureManifests();
  const byKind = (k: HublyExtensionKind) => all.filter((m) => m.kind === k);
  log("discover", "platform", "inventory", `${all.length}_manifests`);
  return {
    version: PLATFORM_VERSION,
    title: "Hubly Platform Inventory",
    checkedAt: nowIso(),
    hublyBrainVersion: HUBLY_BRAIN_PLATFORM_VERSION,
    totals: {
      manifests: all.length,
      experts: byKind("expert").length,
      builders: byKind("builder_module").length,
      industries: byKind("industry_dna").length,
      capabilities: byKind("capability").length,
      knowledge: byKind("knowledge_source").length,
      integrations: byKind("integration").length,
      workflows: byKind("workflow").length,
    },
    manifests: all,
    builders: listBuilderModules(),
    integrations: listIntegrations(),
    workflows: listWorkflows(),
    industryPacks: listDnaIndustryPacks(),
    tools: listTools().map((t) => ({ id: t.id, name: t.name, capabilityCount: t.capabilities.length })),
    knowledgeSources: listKnowledgeSources().map((k) => ({ id: k.id, name: k.name, access: k.access })),
    discoveredExperts: discoverExperts().map((e) => ({ id: e.id, name: e.name, version: e.version })),
    uiExtensionPoints: UI_EXTENSION_POINTS.map((u) => ({ ...u })),
    health: {
      healthy: all.filter((m) => m.health === "healthy").length,
      degraded: all.filter((m) => m.health === "degraded").length,
      unknown: all.filter((m) => m.health === "unknown").length,
    },
  };
}

export function clearPlatformForTests(): void {
  for (const id of [...manifests.keys()]) {
    if (id.startsWith("expert.")) unregisterPlatformExpert(id);
    else if (id.startsWith("builder.")) unregisterBuilderModule(id);
    else if (id.startsWith("industry.")) unregisterIndustryDnaPack(id.replace(/^industry\./, "").replace(/_/g, " "));
    else if (id.startsWith("capability.")) unregisterPlatformCapability(id);
    else if (id.startsWith("knowledge.")) unregisterPlatformKnowledge(id);
    else if (id.startsWith("integration.")) unregisterIntegration(id);
    else if (id.startsWith("workflow.")) unregisterWorkflow(id);
    else manifests.delete(id);
  }
  manifests.clear();
  builders.clear();
  integrations.clear();
  workflows.clear();
  LOG.length = 0;
}

/* ─── Demonstration helpers (Release Gate) ─── */

export async function demoPlatformExtensibility(): Promise<{
  registered: string[];
  discovered: string[];
  executed: { expertId: string; ok: boolean; summary: string };
  whoOwns: { capabilityId: string; toolId: string } | null;
  industryLoaded: string | null;
  knowledgeFound: boolean;
  integrationFound: boolean;
  workflowFound: boolean;
  validationRejected: boolean;
  unregistered: string[];
  brainUntouched: true;
}> {
  ensureRegistriesBootstrapped();
  const registered: string[] = [];

  // 1. Expert
  const expertManifest = registerPlatformExpert(
    {
      id: "seo_expert",
      name: "SEO Expert",
      version: "1.0.0",
      purpose: "Improve local search visibility",
      responsibilities: ["Suggest SEO improvements"],
      inputs: ["request", "memory"],
      outputs: ["seo_plan"],
      requiredMemory: ["business_memory"],
      capability: {
        can: ["seo", "local_search"],
        tools: [],
        reads: ["business_memory", "business_dna"],
        actions: ["recommend_seo"],
      },
      executionPriority: 55,
      failureBehavior: "fallback_local",
      intents: ["general", "website"],
    },
    async (ctx: HublyExpertContext) => ({
      expertId: "seo_expert",
      expertName: "SEO Expert",
      ok: true,
      summary: "I recommend tightening your homepage title around your main service and city.",
      confidence: 78,
      reasoning: [{
        reason: "Local SEO starts with clear service + city signals",
        evidence: [String(ctx.request || "").slice(0, 80)],
        confidence: 78,
        expectedImpact: "More qualified discovery traffic",
      }],
    }),
  );
  registered.push(expertManifest.id);

  // 2. Builder module
  const builderManifest = registerBuilderModule({
    id: "scheduling_builder",
    name: "Scheduling Builder",
    version: "0.1.0",
    purpose: "Owns schedule-related builder capabilities for Milestone 1.5",
    milestone: "1.5",
    capabilities: ["estimate_travel_time", "write_schedule"],
  });
  registered.push(builderManifest.id);

  // 3. Industry DNA
  const poolPack: HublyDnaKnowledgePack = {
    schemaVersion: "1.0.0",
    knowledgeVersion: 1,
    loadedAt: nowIso(),
    loadedBy: "hubly_brain",
    industryProfile: {
      industryName: "Pool Cleaning",
      businessCategories: ["home services"],
      typicalBusinessStages: ["starting", "growing"],
      commonBusinessModels: ["route-based"],
      serviceDeliveryMethods: ["on-site"],
    },
    customerPsychology: {
      buyingTriggers: ["green water", "party prep"],
      buyingFears: ["damage", "chemicals"],
      trustBuilders: ["licensed", "reviews"],
      decisionSpeed: "fast when urgent",
      priceSensitivity: "moderate",
      emotionalMotivations: ["pride", "safety"],
      commonObjections: ["price", "frequency"],
    },
    trustSignals: { signals: ["Reviews", "Insurance"], rankedByImportance: ["Reviews", "Insurance"] },
    serviceRelationships: {
      primaryServices: ["weekly cleaning"],
      upsells: ["filter deep clean"],
      crossSells: ["salt cell"],
      seasonalServices: ["spring open"],
      serviceBundles: ["weekly + chemicals"],
      membershipOpportunities: ["route membership"],
    },
    pricingIntelligence: {
      typicalPricingModels: ["per visit", "monthly"],
      customerExpectations: ["clear frequency"],
      premiumPositioningOpportunities: ["same-week guarantee"],
      valuePositioning: ["reliable route"],
      discountRisks: ["underpricing chemicals"],
    },
    websiteIntelligence: {
      recommendedHomepageOrder: ["Hero", "Services", "Trust", "Book"],
      highConvertingLayouts: ["route-service"],
      bookingBestPractices: ["zip first"],
      galleryRecommendations: ["before/after water"],
      ctaStrategy: ["Book a visit"],
      contentPriorities: ["clarity"],
    },
    growthIntelligence: {
      growthOpportunities: ["neighborhood density"],
      referralIdeas: ["neighbor discount"],
      membershipIdeas: ["monthly route"],
      reviewStrategies: ["ask after first month"],
      customerRetentionIdeas: ["seasonal check-ins"],
      expansionOpportunities: ["spa service"],
    },
    seasonality: {
      busySeasons: ["summer"],
      slowSeasons: ["winter"],
      weatherImpact: ["heat algae"],
      holidayOpportunities: ["memorial day"],
      regionalSeasonality: [],
    },
    regionalIntelligence: {
      country: "US",
      state: null,
      city: null,
      climate: null,
      regionalBuyingBehavior: [],
      localTerminology: ["pool guy"],
    },
    communityLearning: {
      enabled: false,
      automaticLearning: false,
      version: 0,
      evidence: [],
      confidence: 0,
      source: "extension pack",
      communityLearnings: [],
      validationHistory: [],
    },
    evidence: [{
      id: "pool_route",
      claim: "Route density beats random jobs for pool cleaning margins.",
      category: "growth",
      source: "Industry blueprint",
      confidence: 0.8,
      lastReviewed: nowIso().slice(0, 10),
      appliesTo: { industry: ["pool cleaning"], region: "global", businessStage: ["growing"] },
    }],
  };
  const industryManifest = registerIndustryDnaPack("pool cleaning", poolPack);
  registered.push(industryManifest.id);

  // 4. Knowledge source
  const knowledgeManifest = registerPlatformKnowledge({
    id: "google_business_profile",
    name: "Google Business Profile",
    purpose: "Local listing insights and reviews",
    source: "Google",
    access: "read",
    domains: ["reviews", "local_listing"],
    aliases: ["GBP", "Google My Business"],
  });
  registered.push(knowledgeManifest.id);

  // 5. Capability (standalone tool)
  const capabilityManifest = registerPlatformCapability({
    id: "maps_travel",
    name: "Maps Travel",
    version: "1.0.0",
    purpose: "Estimate travel time between jobs",
    responsibilities: ["Read maps", "Estimate travel"],
    category: "scheduling",
    capabilities: [{
      id: "read_maps",
      label: "Read Maps",
      aliases: ["maps", "travel time"],
    }],
  });
  registered.push(capabilityManifest.id);

  // 6. Integration
  const integrationManifest = registerIntegration({
    id: "mock_quickbooks",
    name: "QuickBooks (Mock)",
    version: "0.1.0",
    authentication: "oauth2",
    readPermissions: ["read:invoices"],
    writePermissions: ["write:expenses"],
    events: ["invoice.created", "payment.received"],
    capabilities: ["accounting_sync"],
    failureBehavior: "queue",
  });
  registered.push(integrationManifest.id);

  // 7. Workflow
  const workflowManifest = registerWorkflow({
    id: "new_review_followup",
    name: "New Review Follow-up",
    version: "0.1.0",
    triggers: ["review.created"],
    steps: ["thank_customer", "ask_referral"],
    capabilities: ["review_automation"],
  });
  registered.push(workflowManifest.id);

  // Validation reject proof (never registers incompatible modules)
  const incomplete = validateFeatureManifest({ id: "", name: "", kind: "expert" });
  const bad = validateFeatureManifest({
    id: "expert.too_new",
    name: "Too New",
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
  let validationRejected = !incomplete.ok && !bad.ok;
  try {
    registerPlatformExpert(
      {
        id: "too_new_expert",
        name: "Too New",
        version: "1.0.0",
        purpose: "Should be rejected",
        responsibilities: [],
        inputs: [],
        outputs: [],
        requiredMemory: [],
        capability: { can: [], tools: [], reads: [], actions: [] },
        executionPriority: 50,
      },
      async () => ({
        expertId: "too_new_expert",
        expertName: "Too New",
        ok: false,
        summary: "",
        confidence: 0,
        reasoning: [],
      }),
      { minHublyBrainVersion: "99.0.0" },
    );
    validationRejected = false;
  } catch {
    validationRejected = true;
  }

  // Discovery / use through existing registries
  const discovered = discoverExperts().map((e) => e.id);
  const owner = whoOwnsCapability("estimate_travel_time");
  const industry = getDnaIndustryPack("pool cleaning");
  const knowledgeFound = !!getKnowledgeSource("google_business_profile");
  const integrationFound = integrations.has("mock_quickbooks");
  const workflowFound = workflows.has("new_review_followup");

  const executed = await runExpert("seo_expert", {
    request: "Help my pool cleaning site rank locally",
    intent: "website",
    memory: { name: "Splash Clean", industry: "pool cleaning" },
    dna: null,
    workspace: null,
    conversation: null,
    priorOutputs: [],
  });
  log("execute", "expert", "expert.seo_expert", executed.summary);

  // Clean removal
  const unregistered: string[] = [];
  if (unregisterWorkflow("new_review_followup")) unregistered.push("workflow.new_review_followup");
  if (unregisterIntegration("mock_quickbooks")) unregistered.push("integration.mock_quickbooks");
  if (unregisterPlatformCapability("maps_travel")) unregistered.push("capability.maps_travel");
  if (unregisterPlatformKnowledge("google_business_profile")) unregistered.push("knowledge.google_business_profile");
  if (unregisterIndustryDnaPack("pool cleaning")) unregistered.push("industry.pool_cleaning");
  if (unregisterBuilderModule("scheduling_builder")) unregistered.push("builder.scheduling_builder");
  if (unregisterPlatformExpert("seo_expert")) unregistered.push("expert.seo_expert");

  return {
    registered,
    discovered,
    executed: {
      expertId: "seo_expert",
      ok: !!executed.ok,
      summary: executed.summary,
    },
    whoOwns: owner
      ? { capabilityId: owner.capabilityId, toolId: owner.toolId }
      : null,
    industryLoaded: industry?.industryProfile.industryName || null,
    knowledgeFound,
    integrationFound,
    workflowFound,
    validationRejected,
    unregistered,
    brainUntouched: true,
  };
}

export const HublyPlatform = {
  version: PLATFORM_VERSION,
  owner: PLATFORM_OWNER,
  brainVersion: HUBLY_BRAIN_PLATFORM_VERSION,
  validate: validateFeatureManifest,
  checkVersionCompatibility,
  semverGte,
  registerExpert: registerPlatformExpert,
  unregisterExpert: unregisterPlatformExpert,
  registerBuilder: registerBuilderModule,
  unregisterBuilder: unregisterBuilderModule,
  registerIndustry: registerIndustryDnaPack,
  unregisterIndustry: unregisterIndustryDnaPack,
  registerCapability: registerPlatformCapability,
  unregisterCapability: unregisterPlatformCapability,
  registerKnowledge: registerPlatformKnowledge,
  unregisterKnowledge: unregisterPlatformKnowledge,
  registerIntegration,
  unregisterIntegration,
  registerWorkflow,
  unregisterWorkflow,
  listManifests: listFeatureManifests,
  getManifest: getFeatureManifest,
  listBuilders: listBuilderModules,
  listIntegrations,
  listWorkflows,
  inventory: getPlatformInventory,
  uiExtensionPoints: UI_EXTENSION_POINTS,
  logs: listPlatformLogs,
  demo: demoPlatformExtensibility,
  clearForTests: clearPlatformForTests,
  expertDiscoveryLog: listDiscoveryLog,
};

export default HublyPlatform;
