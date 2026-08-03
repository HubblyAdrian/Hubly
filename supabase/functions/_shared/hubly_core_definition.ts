// supabase/functions/_shared/hubly_core_definition.ts
//
// Hubly Core Definition — the canonical PRODUCT definition of every Hubly
// capability. Not executable. Contains no logic, no handlers, no backend
// calls — just what a capability is for and why it matters to a business.
//
// This is the single source of truth every other layer reasons against:
// - The Hubly Planner asks "what should this business have?" against this.
// - The Capability Registry (_shared/hubly_capability_registry.ts) is the
//   separate, SEPARATE execution layer that answers "how do we actually do
//   it?" — it may implement all, some, or none of what's defined here at any
//   given time. The Planner never looks at the Registry. What Hubly product
//   decides a business needs and what engineering has shipped are
//   deliberately two different conversations (this is why: an unbuilt
//   capability is still a real, honest thing to say a business needs — the
//   Registry not having it yet doesn't make that untrue).
// - Hubly Conversation can reference this same definition for consistent
//   language about what each capability is and does.
//
// `dependencies` = hard prerequisites (this capability doesn't make sense
// without that one). `relatedCapabilities` = softer, complementary
// associations, not requirements. Every name referenced in either list must
// exist as its own entry below — see scratchpad validation, not enforced at
// runtime (this file has no logic to enforce anything with).

export type HublyCoreCapabilityDefinition = {
  name: string;
  purpose: string;
  customerValue: string;
  dependencies: string[];
  relatedCapabilities: string[];
};

export const HUBLY_CORE_DEFINITION: HublyCoreCapabilityDefinition[] = [
  {
    name: "website",
    purpose: "Build and manage a business's website.",
    customerValue: "Helps customers find and trust the business online.",
    dependencies: [],
    relatedCapabilities: ["online_presence", "storefront"],
  },
  {
    name: "online_presence",
    purpose: "Represent the business across listings and social profiles — Google Business, Facebook, Instagram.",
    customerValue: "Helps customers find and recognize the business wherever they're already looking.",
    dependencies: [],
    relatedCapabilities: ["website", "marketing"],
  },
  {
    name: "storefront",
    purpose: "Present services, packages, and pricing, and let customers act on them directly.",
    customerValue: "Turns visitors into paying customers without a phone call.",
    dependencies: ["website"],
    relatedCapabilities: ["booking", "payments"],
  },
  {
    name: "booking",
    purpose: "Let customers schedule appointments — availability, scheduling, confirmations, reminders.",
    customerValue: "Makes it effortless for a customer to book time with the business, any hour.",
    dependencies: [],
    relatedCapabilities: ["storefront", "crm"],
  },
  {
    name: "crm",
    purpose: "Track customers, leads, jobs, and history in one place.",
    customerValue: "Helps the business remember and take care of every customer, not just the loudest one.",
    dependencies: [],
    relatedCapabilities: ["booking", "marketing"],
  },
  {
    name: "marketing",
    purpose: "Reach and win new customers — campaigns, email, reviews, referrals.",
    customerValue: "Drives new business instead of waiting for word of mouth.",
    dependencies: ["crm"],
    relatedCapabilities: ["online_presence", "studio"],
  },
  {
    name: "payments",
    purpose: "Accept and manage payments, deposits, and billing.",
    customerValue: "Makes it easy for a customer to pay and for the business to actually get paid.",
    dependencies: ["storefront"],
    relatedCapabilities: ["crm"],
  },
  {
    name: "marketplace",
    purpose: "List the business where nearby customers are already searching for this kind of service.",
    customerValue: "Brings in customers who are actively looking, not just the ones who already know the business exists.",
    dependencies: [],
    relatedCapabilities: ["booking", "crm"],
  },
  {
    name: "studio",
    purpose: "Create and manage marketing and brand content.",
    customerValue: "Gives the business professional-looking content without hiring a designer.",
    dependencies: [],
    relatedCapabilities: ["marketing"],
  },
  {
    name: "analytics",
    purpose: "Show the business how it's actually performing.",
    customerValue: "Helps the owner make decisions from real numbers instead of a guess.",
    dependencies: [],
    relatedCapabilities: ["crm", "marketing"],
  },
  {
    name: "teams",
    purpose: "Manage staff, roles, permissions, and scheduling.",
    customerValue: "Lets the business grow beyond a single person doing everything.",
    dependencies: [],
    relatedCapabilities: ["booking", "crm"],
  },
  {
    name: "integrations",
    purpose: "Connect Hubly to tools the business already uses.",
    customerValue: "Meets the business where they already are instead of forcing them to switch everything at once.",
    dependencies: [],
    relatedCapabilities: ["crm", "payments", "booking"],
  },
];

export function findCoreDefinition(name: string): HublyCoreCapabilityDefinition | undefined {
  return HUBLY_CORE_DEFINITION.find((c) => c.name === name);
}
