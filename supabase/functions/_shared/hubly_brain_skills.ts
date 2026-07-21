/**
 * Hubly Brain — Skills (Phase 7.2 Capability Registry foundation)
 *
 * Skills are what Hubly can do — not "modes" the user picks.
 * Conversation → Planner chooses skills → Executors run them.
 *
 * Phase 7.5 Runtime marks Memory-safe capabilities executable via capability registry.
 * Website Builder Claude migration stays deferred — website capability writes Memory scaffold only.
 * The AI never manipulates the database directly.
 */

export type HublySkillId =
  | "buildWebsite"
  | "updateWebsite"
  | "publishWebsite"
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
  | "analyzePhotos"
  | "understandBusiness";

export type HublySkill = {
  id: HublySkillId;
  /** Human label — how we talk about the skill */
  label: string;
  description: string;
  /** Domain surface the skill eventually writes through */
  surface: "website" | "crm" | "quotes" | "payments" | "marketing" | "ops" | "coach" | "understanding";
  /** True when a Runtime executor can run this skill (Memory-safe or migrated). */
  executable: boolean;
};

export const HUBLY_SKILLS: HublySkill[] = [
  { id: "understandBusiness", label: "Understand Business", description: "Infer industry, services, stage, and goals from conversation", surface: "understanding", executable: true },
  { id: "buildWebsite", label: "Build Website", description: "Generate Instant Site draft, layout, and copy", surface: "website", executable: false },
  { id: "updateWebsite", label: "Update Website", description: "Apply website copy, layout, and brand changes", surface: "website", executable: false },
  { id: "publishWebsite", label: "Publish Website", description: "Publish the live Instant Site", surface: "website", executable: false },
  { id: "createCrm", label: "Create CRM", description: "Stand up CRM structure for the business", surface: "crm", executable: true },
  { id: "createCustomer", label: "Create Customer", description: "Create or update a CRM customer", surface: "crm", executable: false },
  { id: "deleteCustomer", label: "Delete Customer", description: "Remove a CRM customer", surface: "crm", executable: false },
  { id: "createJob", label: "Create Job", description: "Create a job / work order", surface: "ops", executable: false },
  { id: "scheduleJob", label: "Schedule Job", description: "Schedule or reschedule a job on the calendar", surface: "ops", executable: false },
  { id: "generateQuote", label: "Generate Quote", description: "Draft a quote / estimate", surface: "quotes", executable: false },
  { id: "sendInvoice", label: "Send Invoice", description: "Send an invoice or payment request", surface: "payments", executable: false },
  { id: "createService", label: "Create Service", description: "Add a service / package to the catalog", surface: "ops", executable: false },
  { id: "updateService", label: "Update Service", description: "Update service pricing or details", surface: "ops", executable: false },
  { id: "createMembership", label: "Create Membership", description: "Create a membership / recurring plan", surface: "payments", executable: false },
  { id: "createBookingFlow", label: "Create Booking Flow", description: "Configure booking intake and availability", surface: "ops", executable: true },
  { id: "buildDashboard", label: "Build Dashboard", description: "Configure owner dashboard / ops views", surface: "ops", executable: true },
  { id: "generateCampaign", label: "Generate Campaign", description: "Draft a marketing campaign", surface: "marketing", executable: false },
  { id: "optimizePricing", label: "Optimize Pricing", description: "Recommend pricing changes from memory + goals", surface: "ops", executable: false },
  { id: "respondToReview", label: "Respond to Review", description: "Draft a review response", surface: "marketing", executable: false },
  { id: "coachBusiness", label: "Coach Business", description: "Coach the owner on growth and operations", surface: "coach", executable: true },
  { id: "analyzePhotos", label: "Analyze Photos", description: "Analyze owner photos for galleries and copy", surface: "website", executable: false },
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
