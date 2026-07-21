/**
 * Hubly Brain — Skills / Capability Registry (Phase 7.2 foundation)
 *
 * Capabilities describe what Hubly can do (Rule 5).
 * Executors perform the work (Rule 6).
 * AI never modifies the database directly (Rule 7).
 * Every business change flows through a capability (Rule 8).
 * Design capabilities to be reversible where practical (Rule 9).
 *
 * Understanding is a pipeline stage — not a capability. Do not add
 * "understandBusiness" as an executable skill; that collapses layers.
 */

export type HublySkillId =
  | "buildWebsite"
  | "updateWebsite"
  | "publishWebsite"
  | "unpublishWebsite"
  | "createCrm"
  | "createCustomer"
  | "deleteCustomer"
  | "createJob"
  | "scheduleJob"
  | "generateQuote"
  | "sendInvoice"
  | "createService"
  | "updateService"
  | "createMembership"
  | "createBookingFlow"
  | "buildDashboard"
  | "generateCampaign"
  | "optimizePricing"
  | "respondToReview"
  | "coachBusiness"
  | "analyzePhotos";

export type HublySkill = {
  id: HublySkillId;
  /** Human label — how we talk about the skill */
  label: string;
  description: string;
  /** Domain surface the skill eventually writes through */
  surface: "website" | "crm" | "quotes" | "payments" | "marketing" | "ops" | "coach";
  /** Phase 7.2/7.4 — false until an executor exists */
  executable: boolean;
  /**
   * Rule 9 — reversible where practical.
   * - true: executor should support undo/compensate
   * - partial: draft/versioned or soft-delete
   * - false: hard side effect (e.g. external send) — log + compensate manually
   */
  reversible: boolean | "partial";
  /** Companion undo capability id when known */
  reverseWith?: HublySkillId | null;
};

export const HUBLY_SKILLS: HublySkill[] = [
  { id: "buildWebsite", label: "Build Website", description: "Generate Instant Site draft, layout, and copy", surface: "website", executable: false, reversible: "partial", reverseWith: null },
  { id: "updateWebsite", label: "Update Website", description: "Apply website copy, layout, and brand changes", surface: "website", executable: false, reversible: "partial", reverseWith: null },
  { id: "publishWebsite", label: "Publish Website", description: "Publish the live Instant Site", surface: "website", executable: false, reversible: true, reverseWith: "unpublishWebsite" },
  { id: "unpublishWebsite", label: "Unpublish Website", description: "Take the Instant Site offline / revert publish", surface: "website", executable: false, reversible: true, reverseWith: "publishWebsite" },
  { id: "createCrm", label: "Create CRM", description: "Stand up CRM structure for the business", surface: "crm", executable: false, reversible: "partial", reverseWith: null },
  { id: "createCustomer", label: "Create Customer", description: "Create or update a CRM customer", surface: "crm", executable: false, reversible: true, reverseWith: "deleteCustomer" },
  { id: "deleteCustomer", label: "Delete Customer", description: "Remove or soft-delete a CRM customer", surface: "crm", executable: false, reversible: "partial", reverseWith: null },
  { id: "createJob", label: "Create Job", description: "Create a job / work order", surface: "ops", executable: false, reversible: "partial", reverseWith: null },
  { id: "scheduleJob", label: "Schedule Job", description: "Schedule or reschedule a job on the calendar", surface: "ops", executable: false, reversible: true, reverseWith: null },
  { id: "generateQuote", label: "Generate Quote", description: "Draft a quote / estimate", surface: "quotes", executable: false, reversible: "partial", reverseWith: null },
  { id: "sendInvoice", label: "Send Invoice", description: "Send an invoice or payment request", surface: "payments", executable: false, reversible: false, reverseWith: null },
  { id: "createService", label: "Create Service", description: "Add a service / package to the catalog", surface: "ops", executable: false, reversible: true, reverseWith: null },
  { id: "updateService", label: "Update Service", description: "Update service pricing or details", surface: "ops", executable: false, reversible: "partial", reverseWith: null },
  { id: "createMembership", label: "Create Membership", description: "Create a membership / recurring plan", surface: "payments", executable: false, reversible: "partial", reverseWith: null },
  { id: "createBookingFlow", label: "Create Booking Flow", description: "Configure booking intake and availability", surface: "ops", executable: false, reversible: "partial", reverseWith: null },
  { id: "buildDashboard", label: "Build Dashboard", description: "Configure owner dashboard / ops views", surface: "ops", executable: false, reversible: "partial", reverseWith: null },
  { id: "generateCampaign", label: "Generate Campaign", description: "Draft a marketing campaign", surface: "marketing", executable: false, reversible: "partial", reverseWith: null },
  { id: "optimizePricing", label: "Optimize Pricing", description: "Recommend pricing changes from memory + goals", surface: "ops", executable: false, reversible: "partial", reverseWith: null },
  { id: "respondToReview", label: "Respond to Review", description: "Draft a review response", surface: "marketing", executable: false, reversible: "partial", reverseWith: null },
  { id: "coachBusiness", label: "Coach Business", description: "Coach the owner on growth and operations", surface: "coach", executable: false, reversible: true, reverseWith: null },
  { id: "analyzePhotos", label: "Analyze Photos", description: "Analyze owner photos for galleries and copy", surface: "website", executable: false, reversible: true, reverseWith: null },
];

export function listSkills(): HublySkill[] {
  return HUBLY_SKILLS.map((s) => ({ ...s }));
}

export function getSkill(id: string): HublySkill | null {
  return HUBLY_SKILLS.find((s) => s.id === id) || null;
}

export function skillIds(): HublySkillId[] {
  return HUBLY_SKILLS.map((s) => s.id);
}
