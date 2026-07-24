/**
 * Hubly Brain — AI Capability / Tool Registry + Knowledge Registry
 * (Milestone 1 · Section 11)
 *
 * Hubly Brain should never guess. It should know:
 *   - What it can do     → Tool / Capability Registry
 *   - Where it gets info → Knowledge Registry
 *
 * Experts declare name, version, purpose, responsibilities (Expert Framework).
 * Tools declare fine-grained capabilities (arrival windows, publish, …).
 * Knowledge sources declare access mode (read / read+write).
 *
 * Foundation for Milestone 1.5 Builder Engine: "Who owns this capability?"
 */

export const REGISTRIES_VERSION = "1.0.0" as const;
export const REGISTRIES_OWNER = "hubly_brain" as const;

export type HublyAccessMode = "read" | "write" | "read_write";

export type HublyToolCapability = {
  /** Stable capability id (e.g. arrival_windows). */
  id: string;
  /** Owner-facing label. */
  label: string;
  /** Keywords / phrases that route to this capability. */
  aliases: string[];
};

export type HublyToolDefinition = {
  id: string;
  name: string;
  version: string;
  purpose: string;
  responsibilities: string[];
  capabilities: HublyToolCapability[];
  /** Related expert ids (informational). */
  experts?: string[];
  category?: string;
};

export type HublyKnowledgeSource = {
  id: string;
  name: string;
  purpose: string;
  /** Provider / system label */
  source: string;
  access: HublyAccessMode;
  /** Domains this knowledge covers */
  domains: string[];
  aliases: string[];
};

export type HublyCapabilityMatch = {
  toolId: string;
  toolName: string;
  capabilityId: string;
  capabilityLabel: string;
  score: number;
};

export type HublyKnowledgeMatch = {
  knowledgeId: string;
  name: string;
  access: HublyAccessMode;
  source: string;
  score: number;
};

export type HublyRegistryRoutePlan = {
  request: string;
  capabilities: HublyCapabilityMatch[];
  knowledge: HublyKnowledgeMatch[];
  /** Primary tool Brain would ask: "Who owns this?" */
  primaryToolId: string | null;
  summary: string;
};

const TOOLS = new Map<string, HublyToolDefinition>();
const CAP_INDEX = new Map<string, { toolId: string; capabilityId: string }>();
const KNOWLEDGE = new Map<string, HublyKnowledgeSource>();
let BOOTSTRAPPED = false;

function cloneTool(t: HublyToolDefinition): HublyToolDefinition {
  return {
    ...t,
    responsibilities: [...t.responsibilities],
    capabilities: t.capabilities.map((c) => ({ ...c, aliases: [...c.aliases] })),
    experts: t.experts ? [...t.experts] : [],
  };
}

function cloneKnowledge(k: HublyKnowledgeSource): HublyKnowledgeSource {
  return { ...k, domains: [...k.domains], aliases: [...k.aliases] };
}

function indexTool(tool: HublyToolDefinition): void {
  for (const cap of tool.capabilities) {
    CAP_INDEX.set(cap.id, { toolId: tool.id, capabilityId: cap.id });
    for (const a of cap.aliases) {
      CAP_INDEX.set(normalizeKey(a), { toolId: tool.id, capabilityId: cap.id });
    }
  }
}

function normalizeKey(s: string): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function registerTool(def: HublyToolDefinition): HublyToolDefinition {
  if (!def?.id) throw new Error("Tool registration requires id");
  if (!def.capabilities?.length) throw new Error(`Tool ${def.id} requires capabilities`);
  const normalized: HublyToolDefinition = {
    id: String(def.id),
    name: String(def.name || def.id),
    version: String(def.version || "1.0.0"),
    purpose: String(def.purpose || ""),
    responsibilities: [...(def.responsibilities || [])],
    capabilities: def.capabilities.map((c) => ({
      id: String(c.id),
      label: String(c.label || c.id),
      aliases: [...(c.aliases || []), c.label, c.id].map(String),
    })),
    experts: def.experts ? [...def.experts] : [],
    category: def.category || "general",
  };
  TOOLS.set(normalized.id, normalized);
  indexTool(normalized);
  return cloneTool(normalized);
}

export function unregisterTool(id: string): boolean {
  const t = TOOLS.get(id);
  if (!t) return false;
  TOOLS.delete(id);
  // rebuild index
  CAP_INDEX.clear();
  for (const tool of TOOLS.values()) indexTool(tool);
  return true;
}

export function listTools(): HublyToolDefinition[] {
  return [...TOOLS.values()].map(cloneTool);
}

export function getTool(id: string): HublyToolDefinition | null {
  const t = TOOLS.get(String(id));
  return t ? cloneTool(t) : null;
}

export function registerKnowledgeSource(def: HublyKnowledgeSource): HublyKnowledgeSource {
  if (!def?.id) throw new Error("Knowledge source requires id");
  const normalized: HublyKnowledgeSource = {
    id: String(def.id),
    name: String(def.name || def.id),
    purpose: String(def.purpose || ""),
    source: String(def.source || def.name || def.id),
    access: def.access === "read" || def.access === "write" ? def.access : "read_write",
    domains: [...(def.domains || [])],
    aliases: [...(def.aliases || []), def.name, def.id].map(String),
  };
  KNOWLEDGE.set(normalized.id, normalized);
  return cloneKnowledge(normalized);
}

export function unregisterKnowledgeSource(id: string): boolean {
  return KNOWLEDGE.delete(String(id));
}

export function listKnowledgeSources(): HublyKnowledgeSource[] {
  return [...KNOWLEDGE.values()].map(cloneKnowledge);
}

export function getKnowledgeSource(id: string): HublyKnowledgeSource | null {
  const k = KNOWLEDGE.get(String(id));
  return k ? cloneKnowledge(k) : null;
}

/**
 * Answer: "Who owns this capability?"
 * Never guess — exact / alias match from the Tool Registry.
 */
export function whoOwnsCapability(capabilityOrPhrase: string): HublyCapabilityMatch | null {
  ensureRegistriesBootstrapped();
  const key = normalizeKey(capabilityOrPhrase);
  const direct = CAP_INDEX.get(key) || CAP_INDEX.get(String(capabilityOrPhrase));
  if (direct) {
    const tool = TOOLS.get(direct.toolId)!;
    const cap = tool.capabilities.find((c) => c.id === direct.capabilityId)!;
    return {
      toolId: tool.id,
      toolName: tool.name,
      capabilityId: cap.id,
      capabilityLabel: cap.label,
      score: 100,
    };
  }
  // fuzzy: scan aliases
  const low = String(capabilityOrPhrase || "").toLowerCase();
  let best: HublyCapabilityMatch | null = null;
  for (const tool of TOOLS.values()) {
    for (const cap of tool.capabilities) {
      const hit = [cap.id, cap.label, ...cap.aliases].some((a) => {
        const al = String(a).toLowerCase();
        return low.includes(al) || al.includes(low) || normalizeKey(al) === key;
      });
      if (hit) {
        const score = low === cap.label.toLowerCase() || key === cap.id ? 95 : 80;
        if (!best || score > best.score) {
          best = {
            toolId: tool.id,
            toolName: tool.name,
            capabilityId: cap.id,
            capabilityLabel: cap.label,
            score,
          };
        }
      }
    }
  }
  return best;
}

export function resolveCapabilitiesForRequest(request: string): HublyCapabilityMatch[] {
  ensureRegistriesBootstrapped();
  const low = String(request || "").toLowerCase();
  const matches: HublyCapabilityMatch[] = [];
  const seen = new Set<string>();

  for (const tool of TOOLS.values()) {
    for (const cap of tool.capabilities) {
      const phrases = [cap.id.replace(/_/g, " "), cap.label, ...cap.aliases];
      for (const p of phrases) {
        const pl = String(p).toLowerCase();
        if (pl.length < 3) continue;
        if (low.includes(pl) || (pl.includes(" ") && low.includes(pl))) {
          const k = `${tool.id}:${cap.id}`;
          if (seen.has(k)) continue;
          seen.add(k);
          matches.push({
            toolId: tool.id,
            toolName: tool.name,
            capabilityId: cap.id,
            capabilityLabel: cap.label,
            score: pl.length > 12 ? 90 : 75,
          });
          break;
        }
      }
    }
  }

  // Special multi-tool: upload photos
  if (/upload.*(photo|image)|photo.*(upload|portfolio)/i.test(low)) {
    for (const id of ["portfolio_builder", "image_processor", "website_builder"]) {
      const tool = TOOLS.get(id);
      if (!tool) continue;
      const cap = tool.capabilities[0];
      const k = `${tool.id}:${cap.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      matches.push({
        toolId: tool.id,
        toolName: tool.name,
        capabilityId: cap.id,
        capabilityLabel: cap.label,
        score: 88,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

export function resolveKnowledgeForRequest(request: string): HublyKnowledgeMatch[] {
  ensureRegistriesBootstrapped();
  const low = String(request || "").toLowerCase();
  const matches: HublyKnowledgeMatch[] = [];
  for (const k of KNOWLEDGE.values()) {
    const phrases = [k.id, k.name, ...k.aliases, ...k.domains];
    if (phrases.some((p) => low.includes(String(p).toLowerCase()))) {
      matches.push({
        knowledgeId: k.id,
        name: k.name,
        access: k.access,
        source: k.source,
        score: 85,
      });
    }
  }
  // weather synonyms
  if (/weather|rain|forecast|temperature/i.test(low) && !matches.some((m) => m.knowledgeId === "weather")) {
    const w = KNOWLEDGE.get("weather");
    if (w) {
      matches.push({
        knowledgeId: w.id,
        name: w.name,
        access: w.access,
        source: w.source,
        score: 95,
      });
    }
  }
  if (/reschedule|job|customer|text|sms|notify/i.test(low)) {
    for (const id of ["business_memory", "crm_knowledge"]) {
      const src = KNOWLEDGE.get(id);
      if (src && !matches.some((m) => m.knowledgeId === id)) {
        matches.push({
          knowledgeId: src.id,
          name: src.name,
          access: src.access,
          source: src.source,
          score: 80,
        });
      }
    }
  }
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Full Brain route plan: capabilities + knowledge for a request.
 */
export function planRegistryRoute(request: string): HublyRegistryRoutePlan {
  ensureRegistriesBootstrapped();
  const capabilities = resolveCapabilitiesForRequest(request);
  const knowledge = resolveKnowledgeForRequest(request);
  const primary = capabilities[0] || null;
  const parts: string[] = [];
  if (knowledge.length) {
    parts.push(
      `Knowledge: ${knowledge.map((k) => `${k.name} (${k.access === "read" ? "read only" : "read + write"})`).join(", ")}`,
    );
  }
  if (capabilities.length) {
    parts.push(
      `Capabilities: ${capabilities.map((c) => `${c.capabilityLabel} → ${c.toolName}`).join("; ")}`,
    );
  }
  if (!parts.length) {
    parts.push("No registered capability or knowledge source matched.");
  }
  return {
    request: String(request || ""),
    capabilities,
    knowledge,
    primaryToolId: primary?.toolId || null,
    summary: parts.join(" · "),
  };
}

export function bootstrapDefaultRegistries(): void {
  if (BOOTSTRAPPED && TOOLS.size > 0 && KNOWLEDGE.size > 0) return;
  BOOTSTRAPPED = true;

  registerTool({
    id: "website_builder",
    name: "Website Builder",
    version: "1.0.0",
    purpose: "Own website structure, content, and publish actions",
    responsibilities: [
      "Update homepage layout and copy",
      "Change theme colors",
      "Add and remove sections",
      "Update hero",
      "Publish the live site",
    ],
    experts: ["creative_director", "strategy"],
    category: "builder",
    capabilities: [
      { id: "update_homepage", label: "Update Homepage", aliases: ["homepage", "rewrite homepage"] },
      { id: "change_colors", label: "Change Colors", aliases: ["colors", "theme colors"] },
      { id: "add_sections", label: "Add Sections", aliases: ["add section"] },
      { id: "remove_sections", label: "Remove Sections", aliases: ["remove section"] },
      { id: "update_hero", label: "Update Hero", aliases: ["hero", "hero image"] },
      { id: "publish_website", label: "Publish", aliases: ["publish", "go live", "publish website"] },
    ],
  });

  registerTool({
    id: "booking",
    name: "Booking",
    version: "1.0.0",
    purpose: "Own booking rules, availability, and calendar sync",
    responsibilities: [
      "Configure arrival windows",
      "Enforce booking rules",
      "Manage availability",
      "Sync calendars",
    ],
    experts: ["strategy"],
    category: "builder",
    capabilities: [
      { id: "arrival_windows", label: "Arrival Windows", aliases: ["arrival window", "arrival windows", "time windows"] },
      { id: "no_same_day_bookings", label: "No Same-Day Bookings", aliases: ["same-day", "same day bookings"] },
      { id: "booking_rules", label: "Booking Rules", aliases: ["booking rule"] },
      { id: "booking_availability", label: "Availability", aliases: ["booking availability"] },
      { id: "calendar_sync", label: "Calendar Sync", aliases: ["google calendar", "calendar sync"] },
    ],
  });

  registerTool({
    id: "crm",
    name: "CRM",
    version: "1.0.0",
    purpose: "Own customers, jobs, and CRM communications",
    responsibilities: [
      "Create and update jobs",
      "Update and merge customers",
      "Send email",
      "Archive customers",
    ],
    category: "builder",
    capabilities: [
      { id: "create_job", label: "Create Job", aliases: ["create job", "new job"] },
      { id: "update_customer", label: "Update Customer", aliases: ["update customer"] },
      { id: "send_email", label: "Send Email", aliases: ["email customer", "send email"] },
      { id: "merge_customers", label: "Merge Customers", aliases: ["merge customers"] },
      { id: "archive_customer", label: "Archive Customer", aliases: ["archive customer"] },
      { id: "reschedule_jobs", label: "Reschedule Jobs", aliases: ["reschedule", "reschedule jobs"] },
      { id: "send_text", label: "Send Text", aliases: ["text customers", "sms", "text the customers"] },
    ],
  });

  registerTool({
    id: "marketplace",
    name: "Marketplace",
    version: "1.0.0",
    purpose: "Own marketplace listing settings",
    responsibilities: ["Radius", "Pricing", "Availability", "Categories"],
    category: "builder",
    capabilities: [
      { id: "marketplace_radius", label: "Radius", aliases: ["service radius", "radius"] },
      { id: "marketplace_pricing", label: "Pricing", aliases: ["marketplace pricing"] },
      { id: "marketplace_availability", label: "Availability", aliases: ["marketplace availability"] },
      { id: "marketplace_categories", label: "Categories", aliases: ["marketplace categories"] },
    ],
  });

  registerTool({
    id: "automation",
    name: "Automation",
    version: "1.0.0",
    purpose: "Own workflows and automated reminders",
    responsibilities: [
      "Create / pause / delete workflows",
      "Send automated email and reminders",
    ],
    category: "builder",
    capabilities: [
      { id: "create_workflow", label: "Create Workflow", aliases: ["create workflow", "prep instructions", "after booking", "send prep"] },
      { id: "delete_workflow", label: "Delete Workflow", aliases: ["delete workflow"] },
      { id: "pause_workflow", label: "Pause Workflow", aliases: ["pause workflow"] },
      { id: "automation_send_email", label: "Send Email", aliases: ["automation email"] },
      { id: "send_reminder", label: "Send Reminder", aliases: ["send reminder", "reminder"] },
      { id: "prep_instructions", label: "Prep Instructions", aliases: ["prep instruction", "prep instructions", "ceramic coating"] },
    ],
  });

  registerTool({
    id: "portfolio_builder",
    name: "Portfolio Builder",
    version: "1.0.0",
    purpose: "Own portfolio galleries and photo placement",
    responsibilities: ["Upload portfolio photos", "Organize gallery"],
    category: "builder",
    capabilities: [
      { id: "upload_photos", label: "Upload Photos", aliases: ["upload photos", "portfolio photos"] },
      { id: "manage_gallery", label: "Manage Gallery", aliases: ["gallery"] },
    ],
  });

  registerTool({
    id: "image_processor",
    name: "Image Processor",
    version: "1.0.0",
    purpose: "Process and optimize images before publish",
    responsibilities: ["Process images", "Optimize photos"],
    category: "builder",
    capabilities: [
      { id: "process_images", label: "Process Images", aliases: ["process images", "image processor"] },
      { id: "optimize_photos", label: "Optimize Photos", aliases: ["optimize photos"] },
    ],
  });

  registerTool({
    id: "workspace_builder",
    name: "Workspace Builder",
    version: "1.0.0",
    purpose: "Own workspace layout and navigation preferences (Builder Engine)",
    responsibilities: ["Sidebar order", "Dashboard layout", "Pinned actions"],
    experts: ["builder"],
    category: "builder",
    capabilities: [
      { id: "sidebar_order", label: "Sidebar Order", aliases: ["sidebar", "move jobs", "jobs above", "jobs above customers"] },
      { id: "dashboard_layout", label: "Dashboard Layout", aliases: ["dashboard layout"] },
      { id: "pin_actions", label: "Pin Actions", aliases: ["pin", "pinned actions"] },
    ],
  });

  registerTool({
    id: "packages_builder",
    name: "Packages Builder",
    version: "1.0.0",
    purpose: "Own packages and pricing tiers",
    responsibilities: ["Create packages", "Pricing tiers"],
    experts: ["builder"],
    category: "builder",
    capabilities: [
      { id: "package_create", label: "Create Package", aliases: ["create package", "new package"] },
      { id: "pricing_tiers", label: "Pricing Tiers", aliases: ["pricing tier", "membership"] },
    ],
  });

  // Knowledge Registry
  registerKnowledgeSource({
    id: "weather",
    name: "Weather",
    purpose: "Forecast and conditions for scheduling decisions",
    source: "Weather Provider",
    access: "read",
    domains: ["weather", "forecast", "rain"],
    aliases: ["weather", "forecast", "rain"],
  });
  registerKnowledgeSource({
    id: "stripe",
    name: "Stripe",
    purpose: "Payments and payouts",
    source: "Payments",
    access: "read_write",
    domains: ["payments", "stripe", "invoices"],
    aliases: ["stripe", "payments"],
  });
  registerKnowledgeSource({
    id: "business_memory",
    name: "Business Memory",
    purpose: "Permanent facts about this business",
    source: "Hubly Brain",
    access: "read_write",
    domains: ["business", "customers", "jobs"],
    aliases: ["business memory", "memory"],
  });
  registerKnowledgeSource({
    id: "workspace_memory",
    name: "Workspace Memory",
    purpose: "How the owner likes to work",
    source: "Hubly Brain",
    access: "read_write",
    domains: ["workspace", "sidebar", "dashboard"],
    aliases: ["workspace memory", "workspace"],
  });
  registerKnowledgeSource({
    id: "business_dna",
    name: "Business DNA",
    purpose: "Industry knowledge packs (read-only for experts)",
    source: "Hubly Brain",
    access: "read",
    domains: ["dna", "industry", "blueprints"],
    aliases: ["business dna", "dna"],
  });
  registerKnowledgeSource({
    id: "marketplace_knowledge",
    name: "Marketplace",
    purpose: "Marketplace listing and demand data",
    source: "Marketplace",
    access: "read_write",
    domains: ["marketplace"],
    aliases: ["marketplace"],
  });
  registerKnowledgeSource({
    id: "website_knowledge",
    name: "Website",
    purpose: "Live website content and structure",
    source: "Website",
    access: "read_write",
    domains: ["website", "homepage"],
    aliases: ["website", "site"],
  });
  registerKnowledgeSource({
    id: "crm_knowledge",
    name: "CRM",
    purpose: "Customers, jobs, and communications",
    source: "CRM",
    access: "read_write",
    domains: ["crm", "customers", "jobs"],
    aliases: ["crm", "customers", "jobs"],
  });
  registerKnowledgeSource({
    id: "conversation_intelligence",
    name: "Conversation Intelligence",
    purpose: "What we are currently working on",
    source: "Hubly Brain",
    access: "read_write",
    domains: ["conversation", "projects", "commitments"],
    aliases: ["conversation intelligence", "working memory"],
  });
}

export function ensureRegistriesBootstrapped(): void {
  bootstrapDefaultRegistries();
}

export function clearRegistriesForTests(): void {
  TOOLS.clear();
  CAP_INDEX.clear();
  KNOWLEDGE.clear();
  BOOTSTRAPPED = false;
}

/** Expert declaration surface used by Section 11 proofs (from Expert Framework). */
export type HublyExpertDeclaration = {
  id: string;
  name: string;
  version: string;
  purpose: string;
  responsibilities: string[];
};

export function formatAccess(access: HublyAccessMode): string {
  if (access === "read") return "Read Only";
  if (access === "write") return "Write Only";
  return "Read + Write";
}

export const HublyToolRegistry = {
  version: REGISTRIES_VERSION,
  owner: REGISTRIES_OWNER,
  register: registerTool,
  unregister: unregisterTool,
  list: listTools,
  get: getTool,
  whoOwns: whoOwnsCapability,
  resolveCapabilities: resolveCapabilitiesForRequest,
  plan: planRegistryRoute,
  bootstrap: bootstrapDefaultRegistries,
  clearForTests: clearRegistriesForTests,
};

export const HublyKnowledgeRegistry = {
  version: REGISTRIES_VERSION,
  owner: REGISTRIES_OWNER,
  register: registerKnowledgeSource,
  unregister: unregisterKnowledgeSource,
  list: listKnowledgeSources,
  get: getKnowledgeSource,
  resolve: resolveKnowledgeForRequest,
  formatAccess,
  bootstrap: bootstrapDefaultRegistries,
};

export const HublyRegistries = {
  version: REGISTRIES_VERSION,
  owner: REGISTRIES_OWNER,
  tools: HublyToolRegistry,
  knowledge: HublyKnowledgeRegistry,
  ensure: ensureRegistriesBootstrapped,
  plan: planRegistryRoute,
  whoOwnsCapability,
};

export default HublyRegistries;
