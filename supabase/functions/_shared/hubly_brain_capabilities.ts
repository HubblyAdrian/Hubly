/**
 * Hubly Runtime — Capability Registry
 *
 * Architecture is frozen. Capabilities prove the Runtime through UX.
 * Register new capabilities here only — no special cases in the Orchestrator.
 *
 * Planner decides WHAT (capability + dependsOn).
 * Orchestrator decides HOW (order, parallel, retries).
 */

import { getSkill, type HublySkillId } from "./hubly_brain_skills.ts";

/** High-level Runtime capabilities (Execution Plan nodes). */
export type HublyCapabilityId =
  | "understanding"
  | "branding"
  | "website"
  | "booking"
  | "crm"
  | "payments"
  | "dashboard"
  | "marketing"
  | "quotes"
  | "coaching"
  | "marketplace"
  | "domain"
  | "calendar"
  | "services";

export type HublyCapability = {
  id: HublyCapabilityId;
  label: string;
  /** Human progress label — magical build language, not software config */
  progressLabel: string;
  description: string;
  /** Default dependency edges (Orchestrator may also read plan.dependsOn). */
  defaultDependsOn: HublyCapabilityId[];
  /** Skills this capability invokes (first executable wins for soft run). */
  skills: HublySkillId[];
  /**
   * Runtime may execute when true.
   * Soft Memory scaffolds are allowed; Website Builder Claude migration is NOT required.
   */
  executable: boolean;
};

/**
 * Canonical capability graph. Register new capabilities here only.
 */
export const HUBLY_CAPABILITIES: HublyCapability[] = [
  {
    id: "understanding",
    label: "Understanding",
    progressLabel: "✓ Understanding who you are",
    description: "Structure business facts into Memory + learn who customers are",
    defaultDependsOn: [],
    skills: ["understandBusiness"],
    executable: true,
  },
  {
    id: "branding",
    label: "Branding",
    progressLabel: "✓ Creating your brand",
    description: "Brand voice, accent, and personality in DNA",
    defaultDependsOn: ["understanding"],
    skills: ["understandBusiness"],
    executable: true,
  },
  {
    id: "website",
    label: "Website",
    progressLabel: "✓ Writing your website",
    description: "Express Business DNA as a live site — never “build a website from a prompt”",
    defaultDependsOn: ["branding"],
    skills: ["buildWebsite"],
    executable: true,
  },
  {
    id: "crm",
    label: "CRM",
    progressLabel: "✓ Creating your CRM",
    description: "CRM structure in Memory (self-growing later)",
    defaultDependsOn: ["understanding"],
    skills: ["createCrm"],
    executable: true,
  },
  {
    id: "booking",
    label: "Booking",
    progressLabel: "✓ Building your booking system",
    description: "Booking intake preferences in Memory",
    defaultDependsOn: ["understanding"],
    skills: ["createBookingFlow"],
    executable: true,
  },
  {
    id: "payments",
    label: "Payments",
    progressLabel: "✓ Setting up payments",
    description: "Payments readiness scaffold in Memory",
    defaultDependsOn: ["crm"],
    skills: ["sendInvoice"],
    executable: true,
  },
  {
    id: "dashboard",
    label: "Dashboard",
    progressLabel: "✓ Setting up your dashboard",
    description: "Owner dashboard preferences in Memory",
    defaultDependsOn: ["understanding"],
    skills: ["buildDashboard"],
    executable: true,
  },
  {
    id: "marketing",
    label: "Marketing",
    progressLabel: "Creating Campaign…",
    description: "Marketing (Living Business will keep this fresh)",
    defaultDependsOn: ["website"],
    skills: ["generateCampaign"],
    executable: false,
  },
  {
    id: "quotes",
    label: "Quotes",
    progressLabel: "Generating Quotes…",
    description: "Quotes (migration pending)",
    defaultDependsOn: ["crm"],
    skills: ["generateQuote"],
    executable: false,
  },
  {
    id: "coaching",
    label: "Coaching",
    progressLabel: "Coaching Business…",
    description: "Coaching focus in DNA — becomes proactive with Business Health",
    defaultDependsOn: ["understanding"],
    skills: ["coachBusiness"],
    executable: true,
  },
  {
    id: "marketplace",
    label: "Customer Profile",
    progressLabel: "✓ Preparing your marketplace profile",
    description: "Ready for Customer Runtime matching (Business DNA visible to findPro)",
    defaultDependsOn: ["website"],
    skills: ["publishWebsite"],
    executable: true,
  },
  {
    id: "domain",
    label: "Domain",
    progressLabel: "✓ Checking domain availability",
    description: "Intelligent domain suggestions — purchase later",
    defaultDependsOn: ["website"],
    skills: ["publishWebsite"],
    executable: true,
  },
  {
    id: "calendar",
    label: "Calendar",
    progressLabel: "Connecting Calendar…",
    description: "Scheduling (migration pending)",
    defaultDependsOn: ["booking"],
    skills: ["scheduleJob"],
    executable: false,
  },
  {
    id: "services",
    label: "Services",
    progressLabel: "Creating Services…",
    description: "Service catalog (migration pending)",
    defaultDependsOn: ["understanding"],
    skills: ["createService"],
    executable: false,
  },
];

export function listCapabilities(): HublyCapability[] {
  return HUBLY_CAPABILITIES.map((c) => ({ ...c, defaultDependsOn: [...c.defaultDependsOn], skills: [...c.skills] }));
}

export function getCapability(id: string): HublyCapability | null {
  return HUBLY_CAPABILITIES.find((c) => c.id === id) || null;
}

export function capabilityIds(): HublyCapabilityId[] {
  return HUBLY_CAPABILITIES.map((c) => c.id);
}

/** Map legacy skill ids → capability for plan bridging. */
export function skillToCapability(skill: HublySkillId | string): HublyCapabilityId | null {
  const map: Partial<Record<HublySkillId, HublyCapabilityId>> = {
    understandBusiness: "understanding",
    buildWebsite: "website",
    updateWebsite: "website",
    publishWebsite: "marketplace",
    createCrm: "crm",
    createBookingFlow: "booking",
    buildDashboard: "dashboard",
    sendInvoice: "payments",
    generateCampaign: "marketing",
    generateQuote: "quotes",
    coachBusiness: "coaching",
    scheduleJob: "calendar",
    createService: "services",
    analyzePhotos: "website",
  };
  return map[skill as HublySkillId] || null;
}

export function capabilityIsRunnable(id: HublyCapabilityId): boolean {
  const cap = getCapability(id);
  if (!cap?.executable) return false;
  if (id === "website" || id === "domain" || id === "marketplace" || id === "payments") return true;
  return cap.skills.some((s) =>
    getSkill(s)?.executable !== false ||
    ["understandBusiness", "createCrm", "createBookingFlow", "buildDashboard", "coachBusiness"].includes(s)
  );
}
